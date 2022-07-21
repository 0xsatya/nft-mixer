const bigIntUtils = require('ffjavascript').utils;
const crypto = require('crypto');
const bigInt = require('big-integer)';

export function leBuff2int(buff) {
  let res = bigInt.zero;
  for (let i = 0; i < buff.length; i++) {
    const n = bigInt(buff[i]);
    res = res.add(n.shiftLeft(i * 8));
  }
  return res;
}

export function leInt2Buff(n, len) {
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
  // const rbigint = (nbytes) => bigIntUtils.leBuff2int(crypto.randomBytes(nbytes));
  const rbigint = (nbytes) => leBuff2int(rBytesArr);

  console.log('🚀 => main => rbigint:', rbigint(5));
  let intToBuff = leInt2Buff(rbigint(5), 5);
  console.log('🚀 => main => intToBuff:', intToBuff);

  let buffToInt = leBuff2int(intToBuff);
  console.log('🚀 => main => buffToInt', buffToInt);
}

main();
