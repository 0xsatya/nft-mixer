const bigIntUtils = require('ffjavascript').utils;
const crypto = require('crypto');
const bigInt = require('big-integer');

function leBuff2int(buff) {
  console.log('leBuff2int ~ buff', buff);
  let res = bigInt.zero;
  console.log('leBuff2int ~ res', res);
  for (let i = 0; i < buff.length; i++) {
    console.log('leBuff2int ~ buff[i]', buff[i]);
    const n = bigInt(buff[i]);
    console.log('leBuff2int ~ n', n);
    res = res.add(n.shiftLeft(i * 8));
    console.log('leBuff2int ~ n.shiftLeft(i * 8)', n.shiftLeft(i * 8));
    console.log('leBuff2int ~ res.add(n.shiftLeft(i * 8))', res.add(n.shiftLeft(i * 8)));
    console.log('leBuff2int ~ res', res);
  }
  return res;
}

function leInt2Buff(n, len) {
  let r = n;
  let o = 0;
  const buff = new Uint8Array(len);
  while (r.gt(bigInt.zero) && o < buff.length) {
    let c = Number(r.and(bigInt(255)));
    buff[o] = c;
    o++;
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
  const rbigint = leBuff2int(rBytesArr);
  console.log('🚀 => main => rbigint:', rbigint);

  let intToBuff = leInt2Buff(rbigint, 5);
  console.log('🚀 => main => intToBuff:', intToBuff);

  let buffToInt = leBuff2int(intToBuff);
  console.log('🚀 => main => buffToInt', buffToInt);
  console.log('-------using npm module---------');
  const rbigintMod = bigIntUtils.leBuff2int(rBytesArr);
  console.log('🚀 => main => rbigintMod:', rbigintMod);

  let intToBuffMod = bigIntUtils.leInt2Buff(rbigintMod, 5);
  console.log('🚀 => main => intToBuffMod:', intToBuffMod);

  let buffToIntMod = bigIntUtils.leBuff2int(intToBuffMod);
  console.log('🚀 => main => buffToIntMod', buffToIntMod);
}

main();
