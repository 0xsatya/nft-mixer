require('dotenv').config();
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { groth16 } = require('snarkjs');
const bigIntUtils = require('ffjavascript').utils;
const program = require('commander');

const { logMessage } = require('../utils/general-utils');
const params = require('../utils/params');
const convert = require('../utils/conversion-utils');
const etherUtils = require('../utils/ether-uitls');
const snarkUtils = require('../utils/snark-utils');
const merkUtils = require('../utils/merkle-utils');

let blender, erc721Mock, erc1155Mock, hasher2, hasher3, verifier;
let isERC721;
let tokenId = 1;
let MERKLE_TREE_HEIGHT;

MERKLE_TREE_HEIGHT = process.env.MERKLE_TREE_HEIGHT || 20;

const ZERO_VALUE = params.ZERO_VALUE;

async function setupAccount() {
  logMessage('Settingup Account from the private key', '➡️', 2);
  const Accounts = await etherUtils.setupAccounts();
  [senderAccount, account2, account3] = Accounts;
  console.log('SenderAccount address', senderAccount.address);
  console.log('Account2 address', account2.address);
  console.log('Account3 address', account3.address);
}

async function deployBlender() {
  logMessage('Deploying hashers, verifier, and Blender Contracts', '➡️', 2);

  require('../scripts/compileHasher');
  require('../scripts/compileHasher3');
  hasher2 = await etherUtils.deployContract('Hasher');
  hasher3 = await etherUtils.deployContract('Hasher3');
  verifier = await etherUtils.deployContract('Verifier');
  blender = await etherUtils.deployContract('NFTBlender', [
    verifier.address,
    hasher2.address,
    hasher3.address,
    MERKLE_TREE_HEIGHT,
  ]);

  console.log('🚀 ~ hasher2', hasher2.address);
  console.log('🚀 ~ hasher3', hasher3.address);
  console.log('🚀 ~ verifier', verifier.address);
  console.log('🚀 ~ blender', blender.address);
}

async function setupTestToken() {
  logMessage('Deploying Mock NFT Contracts', '➡️', 2);

  erc721Mock = await etherUtils.deployContract('ERC721Mock', ['Mock721', 'M721']);
  erc1155Mock = await etherUtils.deployContract('ERC1155Mock', ['https://token-cdn-domain/']);

  console.log('🚀 ~ ERC721Mock address:', erc721Mock.address);
  console.log('🚀 ~ ERC1155Mock address:', erc1155Mock.address);

  logMessage('✅ Miniting a Test Token to sender account', '- -', 2);

  let tx = await (await erc721Mock.connect(senderAccount).mint(senderAccount.address, tokenId)).wait();

  console.log('🚀 ~ current NFT owner :', await etherUtils.getNftTokenOwner(erc721Mock, tokenId, true, 0x0));

  logMessage('✅ Approving Token To Blender Contract', '- -', 2);
  await (await erc721Mock.connect(senderAccount).approve(blender.address, tokenId)).wait();

  logMessage('✅ setupToken Successful', '');
  logMessage('', '--');
  return { nftAdd: erc721Mock.address, tokenId: tokenId };
}

/**
 * Make a deposit
 * @param currency Сurrency
 * @param amount Deposit amount
 */
async function deposit({ nftAdd, tokenId }) {
  const deposit = snarkUtils.createDeposit({
    nullifier: convert.rbigint(31),
    secret: convert.rbigint(31),
    tokenAddr: BigInt(nftAdd),
    tokenId: BigInt(tokenId),
  });
  const noteString = snarkUtils.getNoteString(deposit);
  logMessage('✅ Submitting deposit transaction to Blender Contract', '- -');
  const tx = await blender
    .connect(senderAccount)
    .depositNft(convert.toHex(deposit.commitment), nftAdd, tokenId, ethers.utils.parseEther('1'), true);
  let res = await tx.wait();
  logMessage('✅ Deposit NFT to Blender Successful');
  logMessage('', '--');
  return noteString;
}

// transfer NFT ownership
async function transferNftOwnership({ deposit, recipient, transferAccount, newCommData }) {
  logMessage('✅ Generating SNARK Proof', '- -');

  let isWithdraw = false;

  const { proofData, args } = await generateProof({ deposit, recipient, isWithdraw });
  console.log('🚀 ~ new commitment data: ', newCommData.commitment);

  logMessage('✅ Submitting Transfer Transaction', '- -');

  let solProof = snarkUtils.getSolidityProof(proofData.proof);

  let tx = await (
    await blender
      .connect(transferAccount)
      .withdrawNft(solProof, ...args, convert.toHex(newCommData.commitment), {
        gasLimit: 50000000,
      })
  ).wait();

  logMessage('✅ Transfer Tx Done');
  logMessage('', '--');
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the tornado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(deposit, { blender }) {
  logMessage('✅ Building Merkle Tree', '- -');

  const { events, tree } = await merkUtils.buildMerkleTree(
    blender,
    MERKLE_TREE_HEIGHT,
    convert.poseidonHash2,
    ZERO_VALUE,
  );

  const depositEvent = events.find((e) => e.args.commitment === convert.toHex(deposit.commitment));
  const leafIndex = depositEvent ? depositEvent.args.leafIndex : -1;

  const root = tree.root;
  const contractRoot = await blender.getLastRoot();

  const isValidRoot = await blender.isKnownRoot(convert.toHex(root));
  const isSpent = await blender.isSpent(convert.toHex(deposit.nullifierHash));
  assert(isValidRoot === true, 'Merkle tree is corrupted');
  assert(isSpent === false, 'The note is already spent');
  assert(leafIndex >= 0, 'The deposit is not found in the tree');
  assert(convert.toHex(root) === contractRoot, 'Solidity Root and JS Root did not match');

  const { pathElements, pathIndices } = tree.path(leafIndex);
  return { pathElements, pathIndices, root: tree.root };
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
  const circuitName = params.circuitName;
  const wasmPath = path.join(params.circuitBuildPath_build + `/${circuitName}_js/${circuitName}.wasm`); // circutPath1 + '/build/nftMixer_js/nftMixer.wasm';
  const zkeyPath = path.join(params.circuitBuildPath_output + `/${circuitName}_final.zkey`);

  logMessage('✅ creating proof data from input, wasm and zkey', '- -');
  const proofData = await exportCallDataGroth16(convert.toObject(input), wasmPath, zkeyPath);

  logMessage('✅ Directly verifying from verifier coontract :', '- -');
  let verResult = await verifier.verifyProof(proofData.a, proofData.b, proofData.c, proofData.publicInput);
  console.log('🚀 => Verifier.sol verificationResult', verResult);

  const verificationResult = await groth16.verify(
    JSON.parse(fs.readFileSync(path.join(params.circuitBuildPath_output, 'verification_key.json'), 'utf8')),
    proofData.publicInput,
    proofData.proof,
  );
  logMessage('✅ Verifying from SnarkJS module :', '- -');
  console.log('🚀 => SnarkJS verificationResult', verificationResult);

  const args = [
    input.root,
    input.nullifierHash,
    convert.toHex(input.recipient, 20),
    input.nullifier,
    convert.toHex(input.nftAddress, 20),
    input.tokenId,
    isERC721,
    isWithdraw,
  ];

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

/**
 * Do an ETH withdrawal
 * @param noteString Note to withdraw
 * @param recipient Recipient address
 */
async function withdraw({ deposit, recipient, withdrawAccount, relayerURL = '0', refund = '0', fee = '0' }) {
  let relayer = 0;
  let isWithdraw = true;
  logMessage('✅ Generating SNARK Proof', '- -');
  const { proofData, args } = await generateProof({ deposit, recipient, isWithdraw });

  logMessage('✅ Submitting withdraw transaction', '- -');
  let solProof = snarkUtils.getSolidityProof(proofData.proof);
  let tx = await blender.connect(withdrawAccount).withdrawNft(solProof, ...args, convert.toHex(0), {
    gasLimit: 50000000,
  });
  let res = await tx.wait();

  logMessage('✅ Withdraw Tx Done');
  logMessage('', '--');
}

/**
 * Parses Tornado.cash note
 * @param noteString the note
 */
function parseNote(noteString) {
  const noteRegex = /blender-0x(?<note>[0-9a-fA-F]{248})/g;
  const match = noteRegex.exec(noteString);
  if (!match) {
    throw new Error('The note has invalid format');
  }

  const buf = Buffer.from(match.groups.note, 'hex');
  const nullifier = bigIntUtils.beBuff2int(buf.slice(0, 31));
  const tokenAddr = bigIntUtils.beBuff2int(buf.slice(31, 62));
  const tokenId = bigIntUtils.beBuff2int(buf.slice(62, 93));
  const secret = bigIntUtils.beBuff2int(buf.slice(93, 124));
  const deposit = snarkUtils.createDeposit({ nullifier, secret, tokenAddr, tokenId });
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

async function main() {
  program
    .command('test')
    .description('Performs an automated test. It deposits, transfers, and withdraws one MockERC721.')
    .action(async () => {
      await setupAccount();
      await deployBlender();
      let { nftAdd, tokenId } = await setupTestToken();

      isERC721 = true;
      logMessage('DEPOSIT NFT', '➡️', 2);

      let noteString = await deposit({ nftAdd: nftAdd, tokenId: tokenId });
      let nftOwner1 = await etherUtils.getNftTokenOwner(erc721Mock, tokenId, isERC721);
      console.log('🚀 => nftOwner1 after deposit - to be blenderAcct:', nftOwner1);

      let { tokenAddr, tokenId: nftId, netId, deposit: depositObj } = parseNote(noteString);

      logMessage('TRANSFER NFT OWNERSHIP', '➡️', 2);

      // transfer NFT onchain in Blender contract
      const transferNftData = snarkUtils.createDeposit({
        nullifier: convert.rbigint(31),
        secret: convert.rbigint(31),
        tokenAddr: BigInt(nftAdd),
        tokenId: BigInt(tokenId),
      });

      const newNoteString = snarkUtils.getNoteString(transferNftData, nftAdd, tokenId);

      // call contract to transfer NFT to account2.address from senderAccount.address
      await transferNftOwnership({
        deposit: depositObj,
        recipient: account2.address,
        transferAccount: account2,
        newCommData: transferNftData,
      });

      logMessage('WITHDRAW NFT', '➡️', 2);

      let parseNoteData = parseNote(newNoteString);

      const recipient = account3.address;

      await withdraw({
        deposit: parseNoteData.deposit,
        recipient,
        withdrawAccount: account3,
      });

      let nftOwner2 = await etherUtils.getNftTokenOwner(erc721Mock, tokenId, isERC721);
      console.log('🚀 => nftOwner1 after deposit - to be blenderACct:', nftOwner1);
      console.log('🚀 => nftOwner2 after withdraw - to be account3:', recipient);
      console.log('🚀 => Sender account Address :', senderAccount.address);
      console.log('🚀 => Account2 Address :', account2.address);
      console.log('🚀 => Account3 Address :', account3.address);
      console.log('🚀 => Blender contract address :', blender.address);
    });
  try {
    await program.parseAsync(process.argv);
    process.exit(0);
  } catch (e) {
    console.log('Error:', e);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
