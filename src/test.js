const bigIntUtils = require('ffjavascript').utils;
const crypto = require('crypto');
const bigInt = require('big-integer');

function leBuff2int(buff) {
  // console.log('leBuff2int ~ buff', buff);
  let res = bigInt.zero;
  // console.log('leBuff2int ~ res', res);
  for (let i = 0; i < buff.length; i++) {
    // console.log('leBuff2int ~ buff[i]', buff[i]);
    const n = bigInt(buff[i]);
    // console.log('leBuff2int ~ n', n);
    res = res.add(n.shiftLeft(i * 8));
    // console.log('leBuff2int ~ n.shiftLeft(i * 8)', n.shiftLeft(i * 8));
    // console.log('leBuff2int ~ res.add(n.shiftLeft(i * 8))', res.add(n.shiftLeft(i * 8)));
    // console.log('leBuff2int ~ res', res);
  }
  return res;
}

function leInt2Buff(n, len) {
  console.log('leInt2Buff ~ n', n);
  console.log('leInt2Buff ~ len', len);
  let r = n;
  let o = 0;
  const buff = new Uint8Array(len);
  console.log('leInt2Buff ~ buff', buff);
  while (r.gt(bigInt.zero) && o < buff.length) {
    console.log('leInt2Buff ~ bigInt(255)', bigInt(255));
    console.log('leInt2Buff ~ r.and(bigInt(255))', r.and(bigInt(255)));
    let c = Number(r.and(bigInt(255)));
    console.log('leInt2Buff ~ c', c);
    buff[o] = c;
    console.log('leInt2Buff ~ buff[o]', buff[o]);
    o++;
    console.log('leInt2Buff ~ r.shiftRight(8)', r.shiftRight(8));
    r = r.shiftRight(8);
    console.log('leInt2Buff ~ r', r);
  }
  if (!r.eq(bigInt.zero)) {
    throw new Error('Number does not fit in this length');
  }
  console.log('leInt2Buff ~ buff', buff);
  return buff;
}

function beBuff2int(buff) {
  let res = bigInt.zero;
  for (let i = 0; i < buff.length; i++) {
    const n = bigInt(buff[buff.length - i - 1]);
    res = res.add(n.shiftLeft(i * 8));
  }
  return res;
}

function beInt2Buff(n, len) {
  let r = n;
  let o = len - 1;
  const buff = new Uint8Array(len);
  while (r.gt(bigInt.zero) && o >= 0) {
    let c = Number(r.and(bigInt('255')));
    buff[o] = c;
    o--;
    r = r.shiftRight(8);
  }
  if (!r.eq(bigInt.zero)) {
    throw new Error('Number does not fit in this length');
  }
  return buff;
}

function main() {
  //   let nbytes = 5;

  let rBytesArr = crypto.randomBytes(5);
  console.log('random bytes :', rBytesArr);

  console.log('-------witout module---------');
  const rbigint = beBuff2int(rBytesArr);
  console.log('🚀 => main => rbigint:', rbigint);

  let intToBuff = beInt2Buff(rbigint, 5);
  console.log('🚀 => main => intToBuff:', intToBuff);

  let buffToInt = beBuff2int(intToBuff);
  console.log('🚀 => main => buffToInt', buffToInt);

  console.log('-------using npm module---------');
  const rbigintMod = bigIntUtils.beBuff2int(rBytesArr);
  console.log('🚀 => main => rbigintMod:', rbigintMod);

  let intToBuffMod = bigIntUtils.beInt2Buff(rbigintMod, 5);
  console.log('🚀 => main => intToBuffMod:', intToBuffMod);

  let buffToIntMod = bigIntUtils.beBuff2int(intToBuffMod);
  console.log('🚀 => main => buffToIntMod', buffToIntMod);
}

main();
