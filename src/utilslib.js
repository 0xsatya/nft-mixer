const bigInt = require('big-integer');

function leBuff2int(buff) {
  let res = bigInt.zero;
  for (let i = 0; i < buff.length; i++) {
    const n = bigInt(buff[i]);
    res = res.add(n.shiftLeft(i * 8));
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

module.exports = { leBuff2int, leInt2Buff };
