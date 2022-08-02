const crypto = require('crypto');
const { ethers } = require('hardhat');
const BigNumber = ethers.BigNumber;
const { poseidon } = require('circomlibjs');
const circomlibjs = require('circomlibjs');
const bigIntUtils = require('ffjavascript').utils;

const { poseidonHash, toHex, toFixedHex } = require('./conversion-utils');

/** Compute pedersen hash using js*/
const pedersenHash = (data) => {
  return circomlibjs.babyjub.unpackPoint(circomlibjs.pedersenHash.hash(data))[0];
};

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

  return deposit;
}

function getNoteString(depositData) {
  const note = toHex(depositData.preimage, 124);
  const noteString = `blender-${note}`;
  console.log(`🚀 ~ NOTE STRING CREATED: ${noteString} \n`);
  return noteString;
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

module.exports = {
  pedersenHash,
  createDeposit,
  getNoteString,
  getSolidityProof,
};
