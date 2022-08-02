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

module.exports = {
  poseidonHash,
  poseidonHash2,
  poseidonHash3,
  randomBN,
  toFixedHex,
  rbigint,
  toHex,
  toObject,
  fromDecimals,
  toDecimals,
};
