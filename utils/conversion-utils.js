const crypto = require('crypto');
const { ethers } = require('hardhat');
const BigNumber = ethers.BigNumber;
const { poseidon } = require('circomlibjs');

const poseidonHash = (items) => BigNumber.from(poseidon(items).toString());

/** Generate random number of specified byte length */
const randomBN = (nbytes = 31) => BigNumber.from(crypto.randomBytes(nbytes));

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
};
