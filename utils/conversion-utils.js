const crypto = require('crypto');
const { ethers } = require('hardhat');
const BigNumber = ethers.BigNumber;
const { poseidon } = require('circomlibjs');
const bigIntUtils = require('ffjavascript').utils;

const poseidonHash = (items) => BigNumber.from(poseidon(items).toString());

/** Generate random number of specified byte length */
const randomBN = (nbytes = 31) => BigNumber.from(crypto.randomBytes(nbytes));

/** Generate random number of specified byte length */
const rbigint = (nbytes) => bigIntUtils.beBuff2int(crypto.randomBytes(nbytes));

/** BigNumber to hex string of specified length */
function toHex(number, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16);

  return '0x' + str.padStart(length * 2, '0');
}

/** BigNumber to hex string of specified length */
function toFixedHex(number, length = 32) {
  let result =
    '0x' +
    (number instanceof Buffer
      ? number.toString('hex')
      : BigNumber.from(number).toHexString().replace('0x', '')
    ).padStart(length * 2, '0');
  if (result.indexOf('-') > -1) {
    result = '-' + result.replace('-', '');
  }
  return result;
}

module.exports = {
  poseidonHash,
  randomBN,
  toFixedHex,
  rbigint,
  toHex,
};
