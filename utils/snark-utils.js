const crypto = require('crypto');
const { ethers } = require('hardhat');
const BigNumber = ethers.BigNumber;
const { poseidon } = require('circomlibjs');
const circomlibjs = require('circomlibjs');

/** Compute pedersen hash using js*/
const pedersenHash = (data) => {
  return circomlibjs.babyjub.unpackPoint(circomlibjs.pedersenHash.hash(data))[0];
};

module.exports = {
  pedersenHash,
};
