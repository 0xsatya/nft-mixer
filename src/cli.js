// Temporary demo client
// Works both in browser and node.js

require('dotenv').config();
const { ethers } = require('hardhat');
const { BigNumber } = ethers;
const { utils } = ethers;
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const assert = require('assert');
const snarkjs = require('snarkjs');
const { zKey, wtns, groth16, r1cs } = require('snarkjs');

const bigIntUtils = require('ffjavascript').utils;

const crypto = require('crypto');
const circomlibjs = require('circomlibjs');
const bigInt = snarkjs.bigInt;
const { MerkleTree } = require('fixed-merkle-tree');
// const Web3 = require("web3");
const websnarkUtils = require('wasmsnark/src/utils');
const { toWei, fromWei, toBN, BN } = require('web3-utils');
// const config = require("./config");
const program = require('commander');
const {
  toFixedHex,
  poseidonHash,
  poseidonHash2,
  poseidonHash3,
  deployContract,
  contractAt,
  getSignerFromAddress,
} = require('./utils');

const fetch = (url) => import('node-fetch').then(({ default: fetch }) => fetch(url));

let provider,
  signer,
  senderAccount, //signer and senderAccount are same for testing
  chainId,
  web3,
  blender,
  circuit,
  provingKey,
  verificationKey,
  erc721Mock,
  erc1155Mock,
  netId,
  hasher2,
  hasher3,
  verifier,
  isERC721;
let tokenId = 1;
let MERKLE_TREE_HEIGHT, ETH_AMOUNT, TOKEN_AMOUNT, PRIVATE_KEY;

MERKLE_TREE_HEIGHT = process.env.MERKLE_TREE_HEIGHT || 20;

const ZERO_VALUE = '1370249852395389490700185797340442620366735189419093909046557908847258978065';

/** Whether we are in a browser or node.js */
const inBrowser = typeof window !== 'undefined';
let isLocalRPC = false;
const circutPath = path.join(__dirname, '/../circuit-build-nftMixer/output');
const circutPath1 = path.join(__dirname, '/../circuit-build-nftMixer');

// const circutPath = '/circuit-build-nftMixer/output';

const artifactContractPath = path.join(__dirname, '/../artifacts/contracts');

/** Generate random number of specified byte length */
const rbigint = (nbytes) => bigIntUtils.beBuff2int(crypto.randomBytes(nbytes));

/** Compute pedersen hash */
const pedersenHash = (data) => {
  // console.log('🚀 ~ data', data);
  // console.log('🚀 ~ circomlibjs.pedersenHash.hash(data)', circomlibjs.pedersenHash.hash(data));
  return circomlibjs.babyjub.unpackPoint(circomlibjs.pedersenHash.hash(data))[0];
};

/** BigNumber to hex string of specified length */
function toHex(number, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16);
  // console.log('number to hex', '0x' + str.padStart(length * 2, '0'));
  return '0x' + str.padStart(length * 2, '0');
}

/** Display ETH account balance */
async function printETHBalance({ address, name }) {
  console.log(`${name} ETH balance is`, web3.utils.fromWei(await web3.eth.getBalance(address)));
}

/** Checks NFT Token owner */
async function checkERC21Owner({ address, name, tokenAddress, tokenId, isERC721 }) {
  // TODO: check token ower;
  if (isERC721) {
    erc721Mock = await deployContract('ERC721Mock');
    return address == (await erc721Mock.ownerOf(tokenId));
  } else {
    erc1155Mock = await deployContract('ERC1155Mock');
    return await erc1155Mock.balanceOf(address, tokenId);
  }
}

// Deposit functions
async function setupAccount() {
  console.log('-------Settingup Account from the private key-------');
  provider = new ethers.getDefaultProvider();
  chainId = (await provider.getNetwork()).chainId;
  netId = chainId;
  console.log('🚀 ~ chainId', chainId);
  PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (PRIVATE_KEY) {
    // senderAccount = new ethers.Wallet(PRIVATE_KEY, provider);
    [senderAccount] = await ethers.getSigners();
    signer = senderAccount;
    console.log('🚀 ~ senderAccount', senderAccount.address);
  } else {
    console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit');
  }
}

async function deployBlender() {
  require('../scripts/compileHasher'); // creates compiled artifact for Hasher contract with 2 input
  require('../scripts/compileHasher3'); // creates compiled artifact for Hasher contract with 3 input
  hasher2 = await deployContract('Hasher');
  console.log('🚀 ~ hasher2', hasher2.address);
  hasher3 = await deployContract('Hasher3');
  console.log('🚀 ~ hasher3', hasher3.address);

  const input1 = '327020986635889390884424489746780353379988647814505886351348804092471306372';
  const input2 = '403582410511719803810147802798835900462401609230';
  const input3 = '1';

  verifier = await deployContract('Verifier'); // Verifier contract created after building circuit.
  console.log('🚀 ~ verifier', verifier.address, verifier);
  blender = await deployContract('NFTBlender', [
    verifier.address,
    hasher2.address,
    hasher3.address,
    MERKLE_TREE_HEIGHT,
  ]);
  console.log('🚀 ~ blender', blender.address);
  // circuit = await (await fetch('build/circuits/withdraw.json')).json();
  // provingKey = await (await fetch('build/circuits/withdraw_proving_key.bin')).arrayBuffer();

  const hash3 = poseidonHash([input1, input2, input3]);
  console.log('🚀 => deployBlender => hash3', hash3);
  const nullHash = await blender.poseidon3(input1, input2, input3);
  console.log('🚀 => deployBlender => nullHash', nullHash);

  console.log('🚀 ~ circutPath', circutPath);
  // circuit = require(circutPath + 'nftMixer.json').json();
  // provingKey = fs.readFileSync(circutPath + 'nftMixer_final.zkey').buffer;

  // circuit = JSON.parse(fs.readFileSync(`${circutPath}/nftMixer.json`, 'utf8'));
  // provingKey = fs.readFileSync(circutPath + '/nftMixer_final.zkey').arrayBuffer;
  // verificationKey = JSON.parse(fs.readFileSync(`${circutPath}/verification_key.json`));
}

async function setupTestToken() {
  console.log('-----Deploying Mock NFT Contracts-----');
  erc721Mock = await deployContract('ERC721Mock', ['Mock721', 'M721']);
  erc1155Mock = await deployContract('ERC1155Mock', ['https://token-cdn-domain/']);
  console.log('🚀 ~ ERC721Mock', erc721Mock.address);
  console.log('🚀 ~ ERC1155Mock', erc1155Mock.address);

  console.log('-----Miniting a Test Token to sender account-----');
  await (await erc721Mock.connect(senderAccount).mint(senderAccount.address, tokenId)).wait();

  console.log('-----Approving Token To Blender Contract-----');
  await (await erc721Mock.connect(senderAccount).approve(blender.address, tokenId)).wait();
  console.log('---- setupToken Successful -----');
  return { nftAdd: erc721Mock.address, tokenId: tokenId };
}

/**
 * Create deposit object from secret and nullifier
 */
function createDeposit({ nullifier, secret, tokenAddr, tokenId }) {
  const deposit = { nullifier, secret, tokenAddr, tokenId };
  // console.log('🚀 ~ deposit', deposit);
  // const nfr = { nullifier, tokenAddr, tokenId };
  // console.log('🚀 👉🏼 checking tokenAddrss to and fro conversion :');
  // console.log('nft.tokenAdd in BigInt:', nfr.tokenAddr);
  // console.log('nft.tokenAdd from bigInt to hex:', toHex(nfr.tokenAddr));
  // console.log('int to buff :', bigIntUtils.beInt2Buff(nfr.tokenAddr, 31));
  // console.log(
  //   '🚀 int to buff to int to buff :',
  //   bigIntUtils.beInt2Buff(bigIntUtils.beBuff2int(bigIntUtils.beInt2Buff(nfr.tokenAddr, 31)), 31),
  // );
  // contract address = 32 bytes (actual 20 byte value size or 40 hex chars or 160 bits
  // contract address => it is last 20 bytes o fkeccak-256 hash of public key)
  // with 0x it is 42 char long
  // 0x 46 b1 42 DD 1E 92 4F Ab 83 eC c3 c0 8e 4D 46 E8 2f 00 5e 0E
  // 0x46b142dd1e924fab83ecc3c08e4d46e82f005e0e
  // console.log(
  //   '🚀 ~ bigIntUtils.beInt2Buff(nfr.nullifier, 16),',
  //   bigIntUtils.beInt2Buff(nfr.nullifier, 31),
  //   bigIntUtils.beInt2Buff(nfr.tokenAddr, 31),
  //   bigIntUtils.beInt2Buff(nfr.tokenId, 31),
  //   bigIntUtils.beInt2Buff(deposit.secret, 31),
  // );

  // nfr.preimage = Buffer.concat([
  //   bigIntUtils.beInt2Buff(nfr.nullifier, 31),
  //   bigIntUtils.beInt2Buff(nfr.tokenAddr, 31),
  //   bigIntUtils.beInt2Buff(nfr.tokenId, 31),
  // ]);
  // console.log('🚀 => createDeposit => nfr.preimage', nfr.preimage);

  deposit.preimage = Buffer.concat([
    bigIntUtils.beInt2Buff(deposit.nullifier, 31),
    bigIntUtils.beInt2Buff(deposit.tokenAddr, 31),
    bigIntUtils.beInt2Buff(deposit.tokenId, 31),
    bigIntUtils.beInt2Buff(deposit.secret, 31),
  ]);

  // deposit.commitment = pedersenHash(deposit.preimage);
  // deposit.commitmentHex = toHex(deposit.commitment);
  // deposit.nullifierHash = pedersenHash(nfr.preimage);
  // deposit.nullifierHex = toHex(deposit.nullifierHash);

  deposit.nullifierHash = poseidonHash([deposit.nullifier, deposit.tokenAddr, deposit.tokenId]);
  deposit.commitment = poseidonHash([deposit.nullifier, deposit.tokenAddr, deposit.tokenId, deposit.secret]);
  deposit.commitmentHex = toHex(deposit.commitment);
  deposit.nullifierHex = toHex(deposit.nullifierHash);

  // console.log('🚀 => deployBlender => hash3', hash3);
  // const nullHash = await blender.poseidon3(input1, input2, input3);
  // console.log('🚀 => deployBlender => nullHash', nullHash);
  // console.log('===> deposit nullifer int           :', deposit.nullifier);
  // console.log('===> deposit nullifer buff          :', bigIntUtils.beInt2Buff(deposit.nullifier, 31));
  // console.log('===> deposit nullifer from preimage :', deposit.preimage.slice(0, 31));
  // console.log('===> deposit nullifer from bytes :', Buffer.from(deposit.preimage.slice(0, 31), 'hex'));

  // console.log(
  //   '===> deposit nullifer from preimage int:',
  //   bigIntUtils.beBuff2int(deposit.preimage.slice(0, 31)),
  // );q
  // console.log(
  //   '===> deposit nullifer from preimage int:',
  //   bigIntUtils.beBuff2int(bigIntUtils.beInt2Buff(deposit.nullifier, 31)),
  // );
  console.log('🚀 => createDeposit => deposit.preimage', deposit.preimage);
  console.log('🚀 => createDeposit => deposit', deposit);

  // console.log('🚀 => createDeposit => deposit.preimage as NOTE string', deposit.preimage);
  // console.log('createDeposit ~ deposit.commitment', deposit.commitment);
  // console.log('createDeposit ~ deposit.commitmentHex', deposit.commitmentHex);
  // console.log('createDeposit ~ deposit.nullifierHash', deposit.nullifierHash);
  // console.log('createDeposit ~ deposit.nullifierHex', deposit.nullifierHex);
  return deposit;
}

/**
 * Make a deposit
 * @param currency Сurrency
 * @param amount Deposit amount
 */
async function deposit({
  // currency,
  // amount,
  nftAdd,
  tokenId,
  // currNftOwnerAddr,
}) {
  const deposit = createDeposit({
    nullifier: rbigint(31),
    secret: rbigint(31),
    tokenAddr: BigInt(nftAdd),
    tokenId: BigInt(tokenId),
  });

  // console.log('🚀 ===> deposit ~ deposit', deposit);

  const note = toHex(deposit.preimage, 124);
  // console.log('🚀 hex note string : ', note);
  const noteString = `blender-${nftAdd}-${tokenId}-${netId}-${note}`;

  console.log('Submitting deposit transaction');
  const tx = await blender
    .connect(senderAccount)
    .depositNft(toHex(deposit.commitment), nftAdd, tokenId, ethers.utils.parseEther('1'), true);
  let res = await tx.wait();
  // console.log('🚀 ~ tx', tx);
  // console.log('🚀 ~ res', res, res.blockNumber);
  // console.log("--- Filtering Deposit data ---");
  // let depositData = await loadDepositData({ deposit });
  // console.log('🚀 ~ depositData', depositData);

  console.log(`Your note: ${noteString}`);
  return noteString;
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the tornado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(deposit, { blender }) {
  console.log('🚀 => generateMerkleProof => deposit', deposit);
  // Get all deposit events from smart contract and assemble merkle tree from them
  console.log('Getting current state from smart contract');
  // const events = await tornado.getPastEvents("Deposit", {
  //   fromBlock: 0,
  //   toBlock: "latest",
  // });
  // const leaves = events
  //   .sort((a, b) => a.returnValues.leafIndex - b.returnValues.leafIndex) // Sort events in chronological order
  //   .map((e) => e.returnValues.commitment);

  const { events, tree } = await buildMerkleTree(blender);
  console.log('🚀 => generateMerkleProof => events', events);

  // Find current commitment in the tree
  const depositEvent = events.find((e) => e.args.commitment === toHex(deposit.commitment));
  const leafIndex = depositEvent ? depositEvent.args.leafIndex : -1;
  console.log('🚀 => generateMerkleProof => leafIndex', leafIndex);

  // Validate that our data is correct
  const root = tree.root;
  console.log('🚀 => generateMerkleProof => root', root);
  const contractRoot = await blender.getLastRoot();
  console.log('🚀 ~ contractRoot', BigNumber.from(contractRoot));
  const isValidRoot = await blender.isKnownRoot(toHex(root));
  const isSpent = await blender.isSpent(toHex(deposit.nullifierHash));
  assert(isValidRoot === true, 'Merkle tree is corrupted');
  assert(isSpent === false, 'The note is already spent');
  assert(leafIndex >= 0, 'The deposit is not found in the tree');

  // Compute merkle proof of our commitment
  const { pathElements, pathIndices } = tree.path(leafIndex);
  console.log('generateMerkleProof ~ pathElements', pathElements);
  console.log('generateMerkleProof ~ pathIndices', pathIndices);

  // const commBytes32 = toHex(deposit.commitment);
  // const checkHash = poseidonHash(commBytes32, ZERO_VALUE);

  // console.log('PO Hash :', poseidonHash([commBytes32, ZERO_VALUE]));

  return { pathElements, pathIndices, root: tree.root };
}

function getNewTree(leaves) {
  return new MerkleTree(MERKLE_TREE_HEIGHT, leaves, {
    hashFunction: poseidonHash2,
    zeroElement: ZERO_VALUE,
  });
}

/**
 * builds merkle tree
 * @param {contract} blenderContract blender NFT Mixer contract
 * @returns all the events from the block chain and new merkle tree
 */
async function buildMerkleTree({ blenderContract }) {
  const filter = blender.filters.NFTDeposited();
  const fromBlock = await ethers.provider.getBlockNumber();
  const events = await blender.queryFilter(filter, 0, fromBlock);

  console.log('buildMerkleTree ~ events', events);

  const leaves = events
    .sort((a, b) => a.args.leafIndex - b.args.leafIndex)
    .map((e) => BigNumber.from(e.args.commitment));

  console.log('🚀 => buildMerkleTree => leaves', leaves);

  // const tree = new MerkleTree(MERKLE_TREE_HEIGHT, leaves, {
  //   hashFunction: poseidonHash2,
  // });

  const tree = getNewTree(leaves);

  console.log('buildMerkleTree ~ tree', tree.root, tree);

  return { events: events, tree: tree };
}

function toObject(input) {
  return JSON.parse(
    JSON.stringify(
      input,
      (key, value) => (typeof value === 'bigint' ? value.toString() : value), // return everything else unchanged
    ),
  );
}

/**
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 * @param relayer Relayer address
 * @param fee Relayer fee
 * @param refund Receive ether for exchanged tokens
 */
async function generateProof({
  deposit,
  recipient,
  relayerAddress = 0,
  fee = 0,
  refund = 0,
  tokenAddr,
  tokenId,
}) {
  // Compute merkle proof of our commitment
  const { root, pathElements, pathIndices } = await generateMerkleProof(deposit, { blender });

  // Prepare circuit input
  const input = {
    // Public snark inputs
    root: root,
    nullifierHash: deposit.nullifierHash,
    recipient: BigNumber.from(recipient),
    relayer: BigNumber.from(relayerAddress),
    fee: BigNumber.from(fee),
    refund: BigNumber.from(refund),
    nftAddress: BigNumber.from(deposit.tokenAddr),
    tokenId: BigNumber.from(deposit.tokenId),

    // Private snark inputs
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: pathElements,
    pathIndices: pathIndices,
  };
  console.log('==========> input', input, toObject(input));

  console.log('Generating SNARK proof');
  console.time('Proof time');
  // const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key);
  // const { proof } = websnarkUtils.toSolidityInput(proofData);

  // const { proof, publicSignals } = await groth16.prove(
  //   circutPath + '/nftMixer_final.zkey',
  //   circutPath + '/nftMixer.wtns',
  // );

  // console.timeEnd('Proof time');
  // console.log('proof', proof, publicSignals);
  // const wasmPath = circutPath + '/nftMixer.wasm';
  const wasmPath = circutPath1 + '/build/nftMixer_js/nftMixer.wasm';
  const zkeyPath = circutPath + '/nftMixer_final.zkey';

  console.log('🚀 =>===============');
  const dataResult = await exportCallDataGroth16(toObject(input), wasmPath, zkeyPath);
  let verResult = await verifier.verifyProof(dataResult.a, dataResult.b, dataResult.c, dataResult.Input);
  console.log('🚀 => verResult', verResult);
  console.log('🚀 =>===============');

  // const verificationResult = await groth16.verify(
  //   JSON.parse(fs.readFileSync(`${circutPath}/verification_key.json`, 'utf8')),
  //   JSON.parse(fs.readFileSync(`${circutPath}/public.json`, 'utf8')),
  //   JSON.parse(fs.readFileSync(`${circutPath}/proof.json`, 'utf8')),
  // );
  const verificationResult = await groth16.verify(
    JSON.parse(fs.readFileSync(`${circutPath}/verification_key.json`, 'utf8')),
    publicSignals,
    proof,
  );
  console.log('🚀 => verificationResult', verificationResult);

  const args = [
    toHex(input.root),
    toHex(input.nullifierHash),
    toHex(input.recipient, 20),
    toHex(input.relayer, 20),
    toHex(input.fee),
    toHex(input.nullifier),
    toHex(input.nftAddress, 20),
    toHex(input.tokenId),
    true,
    true,
  ];
  console.log('args', args);

  return { proof, args };
}

async function exportCallDataGroth16(input, wasmPath, zkeyPath) {
  const { proof: _proof, publicSignals: _publicSignals } = await groth16.prove(input, wasmPath, zkeyPath);
  const calldata = await groth16.exportSolidityCallData(_proof, _publicSignals);

  const argv = calldata
    .replace(/["[\]\s]/g, '')
    .split(',')
    .map((x) => BigInt(x).toString());

  const a = [argv[0], argv[1]];
  const b = [
    [argv[2], argv[3]],
    [argv[4], argv[5]],
  ];
  const c = [argv[6], argv[7]];
  const Input = [];

  for (let i = 8; i < argv.length; i++) {
    Input.push(argv[i]);
  }

  return { a, b, c, Input };
}

function getSolidityProof(proof) {
  return (
    '0x' +
    toFixedHex(proof.pi_a[0]).slice(2) +
    toFixedHex(proof.pi_a[1]).slice(2) +
    toFixedHex(proof.pi_b[0][0]).slice(2) +
    toFixedHex(proof.pi_b[0][1]).slice(2) +
    toFixedHex(proof.pi_b[1][0]).slice(2) +
    toFixedHex(proof.pi_b[1][1]).slice(2) +
    toFixedHex(proof.pi_c[0]).slice(2) +
    toFixedHex(proof.pi_c[1]).slice(2)
  );
}

/**
 * Do an ETH withdrawal
 * @param noteString Note to withdraw
 * @param recipient Recipient address
 */
async function withdraw({ deposit, recipient, relayerURL = '0', refund = '0', fee = '0' }) {
  // if (currency === 'eth' && refund !== '0') {
  //   throw new Error('The ETH purchase is supposed to be 0 for ETH withdrawals');
  // }
  // refund = toWei(refund);
  relayerURL = false;
  if (relayerURL) {
    // if (relayerURL.endsWith(".eth")) {
    //   throw new Error(
    //     "ENS name resolving is not supported. Please provide DNS name of the relayer. See instuctions in README.md"
    //   );
    // }
    // const relayerStatus = await axios.get(relayerURL + "/status");
    // const { relayerAddress, netId, gasPrices, ethPrices, relayerServiceFee } =
    //   relayerStatus.data;
    // assert(
    //   netId === (await web3.eth.net.getId()) || netId === "*",
    //   "This relay is for different network"
    // );
    // console.log("Relay address: ", relayerAddress);

    // const decimals = isLocalRPC
    //   ? 18
    //   : config.deployments[`netId${netId}`][currency].decimals;
    // const fee = calculateFee({
    //   gasPrices,
    //   currency,
    //   amount,
    //   refund,
    //   ethPrices,
    //   relayerServiceFee,
    //   decimals,
    // });
    // if (fee.gt(fromDecimals({ amount, decimals }))) {
    //   throw new Error("Too high refund");
    // }
    const relayerAddress = utils.computeAddress('0');
    const fee = 0;
    const { proof, args } = await generateProof({
      deposit,
      recipient,
      relayerAddress,
      fee,
      refund,
    });

    console.log('Sending withdraw transaction through relay');
    try {
      // const relay = await axios.post(relayerURL + "/relay", {
      //   contract: tornado._address,
      //   proof,
      //   args,
      // });
      // if (netId === 1 || netId === 42) {
      //   console.log(
      //     `Transaction submitted through the relay. View transaction on etherscan https://${getCurrentNetworkName()}etherscan.io/tx/${
      //       relay.data.txHash
      //     }`
      //   );
      // } else {
      //   console.log(
      //     `Transaction submitted through the relay. The transaction hash is ${relay.data.txHash}`
      //   );
      // }

      // todo: set withdraw transacation
      const relay = await blender.withdraw();

      const receipt = await waitForTxReceipt({ txHash: relay.data.txHash });
      console.log('Transaction mined in block', receipt.blockNumber);
    } catch (e) {
      if (e.response) {
        console.error(e.response.data.error);
      } else {
        console.error(e.message);
      }
    }
  } else {
    let relayer = 0;
    // let recipient = ethers.constants.AddressZero;
    // using private key
    const { proof, args } = await generateProof({ deposit, recipient });

    console.log('Submitting withdraw transaction');
    // await blender
    //   .withdrawNft(proof, ...args)
    //   .send({ from: senderAccount, value: refund.toString(), gas: 1e6 })
    //   .on('transactionHash', function (txHash) {
    //     if (netId === 1 || netId === 42) {
    //       console.log(
    //         `View transaction on etherscan https://${getCurrentNetworkName()}etherscan.io/tx/${txHash}`,
    //       );
    //     } else {
    //       console.log(`The transaction hash is ${txHash}`);
    //     }
    //   })
    //   .on('error', function (e) {
    //     console.error('on transactionHash error', e.message);
    //   });
    let solProof = getSolidityProof(proof);
    console.log('🚀 => withdraw => solProof', solProof);

    let tx = await blender.connect(senderAccount).withdrawNft(solProof, ...args, {
      gasLimit: 50000000,
    });
    let res = await tx.wait();
    console.log('🚀 => withdraw => res', res);
  }
  console.log('Done');
}

function fromDecimals({ amount, decimals }) {
  amount = amount.toString();
  let ether = amount.toString();
  const base = new BN('10').pow(new BN(decimals));
  const baseLength = base.toString(10).length - 1 || 1;

  const negative = ether.substring(0, 1) === '-';
  if (negative) {
    ether = ether.substring(1);
  }

  if (ether === '.') {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, invalid value');
  }

  // Split it into a whole and fractional part
  const comps = ether.split('.');
  if (comps.length > 2) {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei,  too many decimal points');
  }

  let whole = comps[0];
  let fraction = comps[1];

  if (!whole) {
    whole = '0';
  }
  if (!fraction) {
    fraction = '0';
  }
  if (fraction.length > baseLength) {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, too many decimal places');
  }

  while (fraction.length < baseLength) {
    fraction += '0';
  }

  whole = new BN(whole);
  fraction = new BN(fraction);
  let wei = whole.mul(base).add(fraction);

  if (negative) {
    wei = wei.mul(negative);
  }

  return new BN(wei.toString(10), 10);
}

function toDecimals(value, decimals, fixed) {
  const zero = new BN(0);
  const negative1 = new BN(-1);
  decimals = decimals || 18;
  fixed = fixed || 7;

  value = new BN(value);
  const negative = value.lt(zero);
  const base = new BN('10').pow(new BN(decimals));
  const baseLength = base.toString(10).length - 1 || 1;

  if (negative) {
    value = value.mul(negative1);
  }

  let fraction = value.mod(base).toString(10);
  while (fraction.length < baseLength) {
    fraction = `0${fraction}`;
  }
  fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1];

  const whole = value.div(base).toString(10);
  value = `${whole}${fraction === '0' ? '' : `.${fraction}`}`;

  if (negative) {
    value = `-${value}`;
  }

  if (fixed) {
    value = value.slice(0, fixed);
  }

  return value;
}

function getCurrentNetworkName() {
  switch (netId) {
    case 1:
      return '';
    case 42:
      return 'kovan.';
  }
}

function calculateFee({ gasPrices, currency, amount, refund, ethPrices, relayerServiceFee, decimals }) {
  const decimalsPoint =
    Math.floor(relayerServiceFee) === Number(relayerServiceFee)
      ? 0
      : relayerServiceFee.toString().split('.')[1].length;
  const roundDecimal = 10 ** decimalsPoint;
  const total = toBN(fromDecimals({ amount, decimals }));
  const feePercent = total.mul(toBN(relayerServiceFee * roundDecimal)).div(toBN(roundDecimal * 100));
  const expense = toBN(toWei(gasPrices.fast.toString(), 'gwei')).mul(toBN(5e5));
  let desiredFee;
  switch (currency) {
    case 'eth': {
      desiredFee = expense.add(feePercent);
      break;
    }
    default: {
      desiredFee = expense
        .add(toBN(refund))
        .mul(toBN(10 ** decimals))
        .div(toBN(ethPrices[currency]));
      desiredFee = desiredFee.add(feePercent);
      break;
    }
  }
  return desiredFee;
}

/**
 * Waits for transaction to be mined
 * @param txHash Hash of transaction
 * @param attempts
 * @param delay
 */
function waitForTxReceipt({ txHash, attempts = 60, delay = 1000 }) {
  return new Promise((resolve, reject) => {
    const checkForTx = async (txHash, retryAttempt = 0) => {
      const result = await web3.eth.getTransactionReceipt(txHash);
      if (!result || !result.blockNumber) {
        if (retryAttempt <= attempts) {
          setTimeout(() => checkForTx(txHash, retryAttempt + 1), delay);
        } else {
          reject(new Error('tx was not mined'));
        }
      } else {
        resolve(result);
      }
    };
    checkForTx(txHash);
  });
}

/**
 * Parses Tornado.cash note
 * @param noteString the note
 */
function parseNote(noteString) {
  const noteRegex = /blender-(?<tokenAddr>\w+)-(?<tokenId>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{248})/g;
  const match = noteRegex.exec(noteString);
  if (!match) {
    throw new Error('The note has invalid format');
  }

  const buf = Buffer.from(match.groups.note, 'hex');
  const nullifier = bigIntUtils.beBuff2int(buf.slice(0, 31));
  const tokenAddr = bigIntUtils.beBuff2int(buf.slice(31, 62));
  const tokenId = bigIntUtils.beBuff2int(buf.slice(62, 93));
  const secret = bigIntUtils.beBuff2int(buf.slice(93, 124));
  const deposit = createDeposit({ nullifier, secret, tokenAddr, tokenId });
  const netId = Number(match.groups.netId);

  return {
    tokenAddr: match.groups.tokenAddr,
    tokenId: match.groups.tokenId,
    netId,
    deposit,
  };
}

async function loadDepositData({ deposit }) {
  try {
    const filter = blender.filters.NFTDeposited();
    const fromBlock = await ethers.provider.getBlockNumber();
    const eventWhenHappened = await blender.queryFilter(filter, 0, fromBlock);
    if (eventWhenHappened.length === 0) {
      throw new Error('There is no related deposit, the note is invalid');
    }
    const { timestamp } = eventWhenHappened[0].args;
    const txHash = eventWhenHappened[0].transactionHash;
    const isSpent = await blender.isSpent(deposit.nullifierHex);
    return {
      timestamp,
      txHash,
      isSpent,
      // from: receipt.from,
      commitment: deposit.commitmentHex,
    };
  } catch (e) {
    console.error('loadDepositData', e);
  }
  return {};
}
async function loadWithdrawalData({ amount, currency, deposit }) {
  try {
    const events = await tornado.getPastEvents('Withdrawal', {
      fromBlock: 0,
      toBlock: 'latest',
    });

    const withdrawEvent = events.filter((event) => {
      return event.returnValues.nullifierHash === deposit.nullifierHex;
    })[0];

    const fee = withdrawEvent.returnValues.fee;
    const decimals = config.deployments[`netId${netId}`][currency].decimals;
    const withdrawalAmount = toBN(fromDecimals({ amount, decimals })).sub(toBN(fee));
    const { timestamp } = await web3.eth.getBlock(withdrawEvent.blockHash);
    return {
      amount: toDecimals(withdrawalAmount, decimals, 9),
      txHash: withdrawEvent.transactionHash,
      to: withdrawEvent.returnValues.to,
      timestamp,
      nullifier: deposit.nullifierHex,
      fee: toDecimals(fee, decimals, 9),
    };
  } catch (e) {
    console.error('loadWithdrawalData', e);
  }
}

/**
 * Init web3, contracts, and snark
 */
// async function init({ rpc, noteNetId, nftAdd, tokenId, isERC721 }) {
//   let blenderJson, // contractJson
//     erc721ContractJson, // erc20ContractJson,
//     erc1155ContractJson, // erc20tornadoJson,
//     blenderAddress; // tornadoAddress,
//   // nftAddress // tokenAddress;
//   // tokenId
//   // TODO do we need this? should it work in browser really?
//   if (inBrowser) {
//     // Initialize using injected web3 (Metamask)
//     // To assemble web version run `npm run browserify`
//     web3 = new Web3(window.web3.currentProvider, null, {
//       transactionConfirmationBlocks: 1,
//     });
//     contractJson = await (await fetch('build/contracts/ETHTornado.json')).json();
//     circuit = await (await fetch('build/circuits/withdraw.json')).json();
//     provingKey = await (await fetch('build/circuits/withdraw_proving_key.bin')).arrayBuffer();
//     MERKLE_TREE_HEIGHT = 20;
//     ETH_AMOUNT = 1e18;
//     TOKEN_AMOUNT = 1e19;
//     senderAccount = (await web3.eth.getAccounts())[0];
//   } else {
//     // Initialize from local node
//     // web3 = new Web3(rpc, null, { transactionConfirmationBlocks: 1 });
//     // blenderJson = require(contractArtifactPath +
//     //   "NFTBlender.sol/NFTBlender.json");
//     // console.log('🚀 ~ circutPath', circutPath);
//     // circuit = require(circutPath + 'nftMixer.json');
//     // provingKey = fs.readFileSync(circutPath + 'nftMixer_final.zkey').buffer;
//     // MERKLE_TREE_HEIGHT = process.env.MERKLE_TREE_HEIGHT || 20;
//     // ETH_AMOUNT = process.env.ETH_AMOUNT;
//     // TOKEN_AMOUNT = process.env.TOKEN_AMOUNT;
//     // PRIVATE_KEY = process.env.PRIVATE_KEY;
//     // if (PRIVATE_KEY) {
//     //   senderAccount = ethers.utils.privateKeyToAccount("0x" + PRIVATE_KEY);
//     //   // web3.eth.accounts.wallet.add("0x" + PRIVATE_KEY);
//     //   // web3.eth.defaultAccount = account.address;
//     //   // senderAccount = account.address;
//     // } else {
//     //   console.log(
//     //     "Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit"
//     //   );
//     // }
//     // erc721ContractJson = require(contractArtifactPath +
//     //   "Mocks/ERC721Mock.sol/ERC721Mock.json");
//     // erc1155ContractJson = require(contractArtifactPath +
//     //   "Mocks/ERC1155Mock.sol/ERC1155Mock.json");
//   }
//   // groth16 initialises a lot of Promises that will never be resolved, that's why we need to use process.exit to terminate the CLI
//   // groth16 = await buildGroth16();
//   // netId = await ethers.utils.getId();
//   // console.log("🚀 ~ netId", netId);
//   // if (noteNetId && Number(noteNetId) !== netId) {
//   //   throw new Error(
//   //     "This note is for a different network. Specify the --rpc option explicitly"
//   //   );
//   // }
//   // isLocalRPC = netId > 42;

//   // if (isLocalRPC) {
//   //   blenderAddress = blenderJson.networks[netId].address;

//   // tornadoAddress =
//   //   currency === "eth"
//   //     ? contractJson.networks[netId].address
//   //     : erc20tornadoJson.networks[netId].address;
//   // tokenAddress =
//   //   currency !== "eth" ? erc20ContractJson.networks[netId].address : null;
//   // senderAccount = (await web3.eth.getAccounts())[0];
//   // } else {
//   //   try {
//   //     tornadoAddress =
//   //       config.deployments[`netId${netId}`][currency].instanceAddress[amount];
//   //     if (!tornadoAddress) {
//   //       throw new Error();
//   //     }
//   //     tokenAddress = config.deployments[`netId${netId}`][currency].tokenAddress;
//   //   } catch (e) {
//   //     console.error(
//   //       "There is no such tornado instance, check the currency and amount you provide"
//   //     );
//   //     process.exit(1);
//   //   }
//   // }
//   // require("../scripts/compileHasher");
//   // require("../scripts/compileHasher3");
//   // const hasher2 = await deployContract("Hasher");
//   // const hasher3 = await deployContract("Hasher3");
//   // const verifier = await deployContract("Verifier");
//   // blender = await deployContract("NFTBlender", [
//   //   verifier.address,
//   //   hasher2.address,
//   //   hasher3.address,
//   //   MERKLE_TREE_HEIGHT,
//   // ]);
//   // if (isERC721) {
//   //   erc721 = await ethers.getContractAtFromArtifact(
//   //     erc721ContractJson.abi,
//   //     nftAdd
//   //   );
//   // } else {
//   //   erc1155 = await ethers.getContractAtFromArtifact(
//   //     erc1155ContractJson.abi,
//   //     nftAdd
//   //   );
//   // }
//   // tornado = new web3.eth.Contract(contractJson.abi, tornadoAddress);
//   // erc20 =
//   //   currency !== "eth"
//   //     ? new web3.eth.Contract(erc20ContractJson.abi, tokenAddress)
//   //     : {};
// }

async function main() {
  if (inBrowser) {
    const instance = { currency: 'eth', amount: '0.1' };
    await init(instance);
    window.deposit = async () => {
      await deposit(instance);
    };
    window.withdraw = async () => {
      const noteString = prompt('Enter the note to withdraw');
      const recipient = (await web3.eth.getAccounts())[0];

      const { currency, amount, netId, deposit } = parseNote(noteString);
      await init({ noteNetId: netId, currency, amount });
      await withdraw({ deposit, currency, amount, recipient });
    };
  } else {
    program
      .option('-r, --rpc <URL>', 'The RPC, CLI should interact with', 'http://localhost:8545')
      .option('-R, --relayer <URL>', 'Withdraw via relayer');
    // program
    //   .command("deposit <NftAddress> <tokenId>")
    //   .description("Submit a deposit of NFt token from specified Nft Contract")
    //   .action(async (nftAdd, tokenId) => {
    //     nftAdd = ethers.utils.getAddress(nftAdd);
    //     isERC721 = true;
    //     await init({
    //       rpc: program.rpc,
    //       nftAdd: nftAdd,
    //       tokenId: tokenId,
    //       isERC721: true,
    //     });
    //     await deposit({ nftAdd: nftAdd, tokenId: tokenId });
    //   });
    program
      .command('deposit')
      .description(
        'Submit a deposit of NFt token from specified Nft Contract (for testing it will depoisit a mock nft token from a mock nft contract)',
      )
      .action(async () => {
        await setupAccount();
        await deployBlender();
        let { nftAdd, tokenId } = await setupTestToken();
        // const nftAdd = erc721Mock.address;
        console.log('🧨 nftAdd and tokenId :', nftAdd, tokenId);
        isERC721 = true;
        // await init({
        //   rpc: program.rpc,
        //   nftAdd: nftAdd,
        //   tokenId: tokenId,
        //   isERC721: true,
        // });
        console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');

        let noteString = await deposit({ nftAdd: nftAdd, tokenId: tokenId });

        console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');

        //TODO: use below code in withdraw command
        let { tokenAddr, tokenId: nftId, netId, deposit: depositObj } = parseNote(noteString);

        console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');

        // console.log(
        //   '🚀 => .action =>  tokenAddr, tokenId, netId, depositObj: ',
        //   tokenAddr,
        //   toHex(tokenAddr, 20),
        //   nftId,
        //   netId,
        //   depositObj,
        // );
        // console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');

        // let data = await generateMerkleProof(depositObj, { blender });

        //generate merkle tree
        // console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');
        let recipient = ethers.constants.AddressZero;

        await withdraw({
          deposit: depositObj,
          // currency,
          // amount,
          recipient,
          // refund,
          // relayerURL: program.relayer,
        });

        //
      });
    program
      .command('withdraw <note> <recipient> [ETH_purchase]')
      .description(
        'Withdraw a note to a recipient account using relayer or specified private key. You can exchange some of your deposit`s tokens to ETH during the withdrawal by specifing ETH_purchase (e.g. 0.01) to pay for gas in future transactions. Also see the --relayer option.',
      )
      .action(async (noteString, recipient, refund) => {
        const { currency, amount, netId, deposit } = parseNote(noteString);
        await init({ rpc: program.rpc, noteNetId: netId, currency, amount });
        await withdraw({
          deposit,
          currency,
          amount,
          recipient,
          refund,
          relayerURL: program.relayer,
        });
      });
    program
      .command('balance <address> [token_address]')
      .description('Check ETH and ERC20 balance')
      .action(async (address, tokenAddress) => {
        await init({ rpc: program.rpc });
        await printETHBalance({ address, name: '' });
        if (tokenAddress) {
          await printERC20Balance({ address, name: '', tokenAddress });
        }
      });
    program
      .command('compliance <note>')
      .description(
        'Shows the deposit and withdrawal of the provided note. This might be necessary to show the origin of assets held in your withdrawal address.',
      )
      .action(async (noteString) => {
        const { currency, amount, netId, deposit } = parseNote(noteString);
        await init({ rpc: program.rpc, noteNetId: netId, currency, amount });
        const depositInfo = await loadDepositData({ deposit });
        const depositDate = new Date(depositInfo.timestamp * 1000);
        console.log('\n=============Deposit=================');
        console.log('Deposit     :', amount, currency);
        console.log('Date        :', depositDate.toLocaleDateString(), depositDate.toLocaleTimeString());
        console.log(
          'From        :',
          `https://${getCurrentNetworkName()}etherscan.io/address/${depositInfo.from}`,
        );
        console.log(
          'Transaction :',
          `https://${getCurrentNetworkName()}etherscan.io/tx/${depositInfo.txHash}`,
        );
        console.log('Commitment  :', depositInfo.commitment);
        if (deposit.isSpent) {
          console.log('The note was not spent');
        }

        const withdrawInfo = await loadWithdrawalData({
          amount,
          currency,
          deposit,
        });
        const withdrawalDate = new Date(withdrawInfo.timestamp * 1000);
        console.log('\n=============Withdrawal==============');
        console.log('Withdrawal  :', withdrawInfo.amount, currency);
        console.log('Relayer Fee :', withdrawInfo.fee, currency);
        console.log(
          'Date        :',
          withdrawalDate.toLocaleDateString(),
          withdrawalDate.toLocaleTimeString(),
        );
        console.log(
          'To          :',
          `https://${getCurrentNetworkName()}etherscan.io/address/${withdrawInfo.to}`,
        );
        console.log(
          'Transaction :',
          `https://${getCurrentNetworkName()}etherscan.io/tx/${withdrawInfo.txHash}`,
        );
        console.log('Nullifier   :', withdrawInfo.nullifier);
      });
    program
      .command('test')
      .description(
        'Perform an automated test. It deposits and withdraws one ETH and one ERC20 note. Uses ganache.',
      )
      .action(async () => {
        console.log('Start performing ETH deposit-withdraw test');
        let currency = 'eth';
        let amount = '0.1';
        await init({ rpc: program.rpc, currency, amount });
        let noteString = await deposit({ currency, amount });
        let parsedNote = parseNote(noteString);
        await withdraw({
          deposit: parsedNote.deposit,
          currency,
          amount,
          recipient: senderAccount,
          relayerURL: program.relayer,
        });

        console.log('\nStart performing DAI deposit-withdraw test');
        currency = 'dai';
        amount = '100';
        await init({ rpc: program.rpc, currency, amount });
        noteString = await deposit({ currency, amount });
        parsedNote = parseNote(noteString);
        await withdraw({
          deposit: parsedNote.deposit,
          currency,
          amount,
          recipient: senderAccount,
          refund: '0.02',
          relayerURL: program.relayer,
        });
      });
    try {
      await program.parseAsync(process.argv);
      process.exit(0);
    } catch (e) {
      console.log('Error:', e);
      process.exit(1);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
