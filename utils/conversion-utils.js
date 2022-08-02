const crypto = require('crypto');
const { ethers } = require('hardhat');
const BigNumber = ethers.BigNumber;
const { poseidon } = require('circomlibjs');
const bigIntUtils = require('ffjavascript').utils;

const poseidonHash = (items) => BigNumber.from(poseidon(items).toString());
const poseidonHash2 = (a, b) => poseidonHash([a, b]);
const poseidonHash3 = (a, b, c) => poseidonHash([a, b, c]);

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

function toObject(input) {
  const strInput = JSON.stringify(input, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  const formatInput = JSON.parse(strInput, (key, value) => (value.type === 'BigNumber' ? value.hex : value));
  // console.log('toObject ~ formatInput', formatInput);
  return formatInput;
}

module.exports = {
  poseidonHash,
  poseidonHash2,
  poseidonHash3,
  randomBN,
  toFixedHex,
  rbigint,
  toHex,
  toObject,
};
