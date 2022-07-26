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

const websnarkUtils = require('wasmsnark/src/utils');
const { toWei, fromWei, toBN, BN } = require('web3-utils');

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
  senderAccount,
  account2,
  account3,
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

const artifactContractPath = path.join(__dirname, '/../artifacts/contracts');

/** Generate random number of specified byte length */
const rbigint = (nbytes) => bigIntUtils.beBuff2int(crypto.randomBytes(nbytes));

/** Compute pedersen hash */
const pedersenHash = (data) => {
  return circomlibjs.babyjub.unpackPoint(circomlibjs.pedersenHash.hash(data))[0];
};

/** BigNumber to hex string of specified length */
function toHex(number, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16);

  return '0x' + str.padStart(length * 2, '0');
}

/** Display ETH account balance */
async function printETHBalance({ address, name }) {
  console.log(`${name} ETH balance is`, web3.utils.fromWei(await web3.eth.getBalance(address)));
}

/** Checks NFT Token owner */
async function checkERC21Owner({ address, name, tokenAddress, tokenId, isERC721 }) {
  if (isERC721) {
    erc721Mock = await deployContract('ERC721Mock');
    return address == (await erc721Mock.ownerOf(tokenId));
  } else {
    erc1155Mock = await deployContract('ERC1155Mock');
    return await erc1155Mock.balanceOf(address, tokenId);
  }
}

async function setupAccount() {
  console.log('-------Settingup Account from the private key-------');
  provider = new ethers.getDefaultProvider();
  chainId = (await provider.getNetwork()).chainId;
  netId = chainId;
  // console.log('🚀 ~ chainId', chainId);
  PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (PRIVATE_KEY) {
    [senderAccount, account2, account3] = await ethers.getSigners();
    signer = senderAccount;
    console.log('🚀 ~ senderAccount', senderAccount.address);
  } else {
    console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit');
  }
}

async function deployBlender() {
  require('../scripts/compileHasher');
  require('../scripts/compileHasher3');
  hasher2 = await deployContract('Hasher');
  console.log('🚀 ~ hasher2', hasher2.address);
  hasher3 = await deployContract('Hasher3');
  console.log('🚀 ~ hasher3', hasher3.address);

  verifier = await deployContract('Verifier');
  console.log('🚀 ~ verifier', verifier.address);
  blender = await deployContract('NFTBlender', [
    verifier.address,
    hasher2.address,
    hasher3.address,
    MERKLE_TREE_HEIGHT,
  ]);
  console.log('🚀 ~ blender', blender.address);

  // const hash3 = poseidonHash([input1, input2, input3]);
  // const nullHash = await blender.poseidon3(input1, input2, input3);
}

async function setupTestToken() {
  console.log('-----Deploying Mock NFT Contracts-----');
  erc721Mock = await deployContract('ERC721Mock', ['Mock721', 'M721']);
  erc1155Mock = await deployContract('ERC1155Mock', ['https://token-cdn-domain/']);
  console.log('🚀 ~ ERC721Mock address:', erc721Mock.address);
  console.log('🚀 ~ ERC1155Mock address:', erc1155Mock.address);

  console.log('-----Miniting a Test Token to sender account-----');
  await (await erc721Mock.connect(senderAccount).mint(senderAccount.address, tokenId)).wait();

  console.log('current NFT owner :', await getNftTokenOwner(tokenId, true, 0x0));
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

  deposit.preimage = Buffer.concat([
    bigIntUtils.beInt2Buff(deposit.nullifier, 31),
    bigIntUtils.beInt2Buff(deposit.tokenAddr, 31),
    bigIntUtils.beInt2Buff(deposit.tokenId, 31),
    bigIntUtils.beInt2Buff(deposit.secret, 31),
  ]);

  deposit.nullifierHash = poseidonHash([deposit.nullifier, deposit.tokenAddr, deposit.tokenId]);
  deposit.commitment = poseidonHash([deposit.nullifier, deposit.tokenAddr, deposit.tokenId, deposit.secret]);
  deposit.commitmentHex = toHex(deposit.commitment);
  deposit.nullifierHex = toHex(deposit.nullifierHash);

  // console.log('🚀 => createDeposit => deposit.preimage', deposit.preimage);
  // console.log('🚀 => createDeposit => deposit', deposit);
  return deposit;
}

function getNoteString(depositData, nftAdd, tokenId) {
  const note = toHex(depositData.preimage, 124);
  const noteString = `blender-${nftAdd}-${tokenId}-${netId}-${note}`;
  console.log(`NOTE STRING CREATED: ${noteString}`);
  return noteString;
}

/**
 * Make a deposit
 * @param currency Сurrency
 * @param amount Deposit amount
 */
async function deposit({ nftAdd, tokenId }) {
  const deposit = createDeposit({
    nullifier: rbigint(31),
    secret: rbigint(31),
    tokenAddr: BigInt(nftAdd),
    tokenId: BigInt(tokenId),
  });
  const noteString = getNoteString(deposit, nftAdd, tokenId);
  console.log('🚀🚀🚀🚀🚀 Submitting deposit transaction to Blender Contract');
  const tx = await blender
    .connect(senderAccount)
    .depositNft(toHex(deposit.commitment), nftAdd, tokenId, ethers.utils.parseEther('1'), true);
  let res = await tx.wait();
  console.log('🚀🚀🚀🚀🚀 DEPOSIT NFT TO BLENDER  SUCCESSFUL :');
  return noteString;
}

// transfer NFT ownership
async function transferNftOwnership({
  deposit,
  recipient,
  transferAccount,
  newCommData,
  relayerURL = '0',
  refund = '0',
  fee = '0',
}) {
  let relayer = 0;
  let isWithdraw = false;
  console.log('GENERATING SNARK PROOF...');
  const { proofData, args } = await generateProof({ deposit, recipient, isWithdraw });
  console.log('newCommData :', newCommData);
  console.log('🚀🚀🚀🚀🚀 SUBMITTING TRANSFER TXN...');
  let solProof = getSolidityProof(proofData.proof);

  console.log('args, newComm.commitment :', args, newCommData.commitment);

  let tx = await blender
    .connect(transferAccount)
    .withdrawNft(solProof, ...args, toHex(newCommData.commitment), {
      gasLimit: 50000000,
    });
  let res = await tx.wait();
  console.log('----- Transfer Tx Done -----');
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the tornado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(deposit, { blender }) {
  // console.log('🚀 => generating merkle proof...');

  const { events, tree } = await buildMerkleTree(blender);
  // console.log('🚀 => generateMerkleProof => events', events);

  const depositEvent = events.find((e) => e.args.commitment === toHex(deposit.commitment));
  const leafIndex = depositEvent ? depositEvent.args.leafIndex : -1;

  const root = tree.root;
  console.log('generateMerkleProof ~ root', root);
  const contractRoot = await blender.getLastRoot();
  console.log('generateMerkleProof ~ contractRoot', BigNumber.from(contractRoot));

  const isValidRoot = await blender.isKnownRoot(toHex(root));
  const isSpent = await blender.isSpent(toHex(deposit.nullifierHash));
  assert(isValidRoot === true, 'Merkle tree is corrupted');
  assert(isSpent === false, 'The note is already spent');
  assert(leafIndex >= 0, 'The deposit is not found in the tree');

  const { pathElements, pathIndices } = tree.path(leafIndex);
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
  const latestBlcok = await ethers.provider.getBlockNumber();
  const events = await blender.queryFilter(filter, 0, latestBlcok);

  console.log('buildMerkleTree ~ events', events);

  const leaves = events
    .sort((a, b) => a.args.leafIndex - b.args.leafIndex)
    .map((e) => BigNumber.from(e.args.commitment));

  console.log('🚀 => buildMerkleTree => leaves', leaves);

  const tree = getNewTree(leaves);

  // console.log('buildMerkleTree ~ tree', tree.root, tree);

  return { events: events, tree: tree };
}

function toObject(input) {
  const strInput = JSON.stringify(input, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  const formatInput = JSON.parse(strInput, (key, value) => (value.type === 'BigNumber' ? value.hex : value));
  // console.log('toObject ~ formatInput', formatInput);
  return formatInput;
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
  isWithdraw = false,
  isERC721 = true,
  relayerAddress = 0,
  fee = 0,
  refund = 0,
  tokenAddr,
  tokenId,
}) {
  const { root, pathElements, pathIndices } = await generateMerkleProof(deposit, { blender });

  const input = {
    root: root,
    nullifierHash: deposit.nullifierHash,
    recipient: recipient,
    relayer: relayerAddress,
    fee: fee,
    refund: refund,
    nftAddress: deposit.tokenAddr,
    tokenId: deposit.tokenId,

    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: pathElements,
    pathIndices: pathIndices,
  };

  // console.log('Generating SNARK proof');
  // console.time('Proof time');

  const wasmPath = circutPath1 + '/build/nftMixer_js/nftMixer.wasm';
  const zkeyPath = circutPath + '/nftMixer_final.zkey';

  console.log('🚀 creating proof data from input, wasm and zkey');
  const proofData = await exportCallDataGroth16(toObject(input), wasmPath, zkeyPath);

  console.log('Directly verifying from verifier coontract :');
  let verResult = await verifier.verifyProof(proofData.a, proofData.b, proofData.c, proofData.publicInput);
  console.log('🚀 => verResult', verResult);
  console.log('🚀 =>===============');

  const verificationResult = await groth16.verify(
    JSON.parse(fs.readFileSync(`${circutPath}/verification_key.json`, 'utf8')),
    proofData.publicInput,
    proofData.proof,
  );
  console.log('🚀 => verificationResult', verificationResult);

  const args = [
    input.root,
    input.nullifierHash,
    toHex(input.recipient, 20),
    toHex(input.relayer, 20),
    input.fee,
    input.nullifier,
    toHex(input.nftAddress, 20),
    input.tokenId,
    isERC721,
    isWithdraw,
  ];
  // console.log('args', args);

  return { proofData, args };
}

async function exportCallDataGroth16(input, wasmPath, zkeyPath) {
  const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);

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
  const publicInput = [];

  for (let i = 8; i < argv.length; i++) {
    publicInput.push(argv[i]);
  }
  const solidityProofInput = argv;
  return { a, b, c, publicInput, proof, solidityProofInput };
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
async function withdraw({ deposit, recipient, withdrawAccount, relayerURL = '0', refund = '0', fee = '0' }) {
  let relayer = 0;
  let isWithdraw = true;
  console.log('GENERATING SNARK PROOF...');
  const { proofData, args } = await generateProof({ deposit, recipient, isWithdraw });

  console.log('🚀🚀🚀🚀🚀 SUBMITTING WITHDRAW TXN...');
  let solProof = getSolidityProof(proofData.proof);
  let tx = await blender.connect(withdrawAccount).withdrawNft(solProof, ...args, {
    gasLimit: 50000000,
  });
  let res = await tx.wait();
  console.log('----- Withdraw tx Done -----');
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

async function getNftTokenOwner(tokenId, isERC721, accountAdd = 0x0) {
  try {
    if (isERC721) return await erc721Mock.ownerOf(tokenId);
    else return await erc1155Mock.balanceOf(accountAdd, tokenId);
  } catch (error) {
    console.log('ERROR :', error);
    return false;
  }
}

/**
 * Init web3, contracts, and snark
 */

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

    program
      .command('deposit')
      .description('Submit a deposit of NFt token from specified Nft Contract.')
      .action(async () => {
        await setupAccount();
        await deployBlender();
        let { nftAdd, tokenId } = await setupTestToken();

        // console.log('🧨 nftAdd and tokenId :', nftAdd, tokenId);
        isERC721 = true;
        console.log('🚀 🚀 🚀 🚀 🚀 🚀 🚀   DEPOSIT NFT  🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 ');

        let noteString = await deposit({ nftAdd: nftAdd, tokenId: tokenId });
        let nftOwner1 = await getNftTokenOwner(tokenId, isERC721);
        let { tokenAddr, tokenId: nftId, netId, deposit: depositObj } = parseNote(noteString);
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
      .description('Performs an automated test. It deposits, transfers, and withdraws one MockERC721.')
      .action(async () => {
        await setupAccount();
        await deployBlender();
        let { nftAdd, tokenId } = await setupTestToken();

        // console.log('🧨 nftAdd and tokenId :', nftAdd, tokenId);
        isERC721 = true;
        console.log('🚀 🚀 🚀 🚀 🚀 🚀 🚀   DEPOSIT NFT  🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 ');

        let noteString = await deposit({ nftAdd: nftAdd, tokenId: tokenId });
        let nftOwner1 = await getNftTokenOwner(tokenId, isERC721);
        console.log('🚀 => .action => nftOwner1 after deposit - to be blenderACct:', nftOwner1);

        let { tokenAddr, tokenId: nftId, netId, deposit: depositObj } = parseNote(noteString);

        console.log('🚀 🚀 🚀 🚀 🚀 🚀 🚀   TRANSFER NFT OWNERSHIP 🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 ');

        // transfer NFT onchain in Blender contract
        const transferNftData = createDeposit({
          nullifier: rbigint(31),
          secret: rbigint(31),
          tokenAddr: BigInt(nftAdd),
          tokenId: BigInt(tokenId),
        });

        const newNoteString = getNoteString(transferNftData, nftAdd, tokenId);
        console.log('.action ~ Transfer NFT ~ newNoteString', newNoteString);

        // call contract to transfer NFT to account2.address from senderAccount.address
        await transferNftOwnership({
          deposit: depositObj,
          recipient: account2.address,
          transferAccount: account2,
          newCommData: transferNftData,
        });

        console.log('🚀 🚀 🚀 🚀 🚀 🚀 🚀   WITHDRAW NFT 🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 ');
        let parseNoteData = parseNote(noteString);

        const recipient = account3.address;
        // console.log('.action ~ recipient', recipient);
        await withdraw({
          deposit: parseNoteData.deposit,
          recipient,
          withdrawAccount: account3,
        });
        let nftOwner2 = await getNftTokenOwner(tokenId, isERC721);
        console.log('🚀 => .action => nftOwner1 after deposit - to be blenderACct:', nftOwner1);
        console.log('🚀 => .action => nftOwner2 after withdraw - to be account3:', recipient);
        console.log('Sender account Address :', senderAccount.address);
        console.log('Account2 Address :', account2.address);
        console.log('Account3 Address :', account3.address);
        console.log('Blender contract address :', blender.address);
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
