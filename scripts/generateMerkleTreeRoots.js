const { poseidonHash2, toFixedHex } = require("../src/utils");
const { ethers } = require("ethers");

const FIELD_SIZE =
  "21888242871839275222246405745257275088548364400416034343698204186575808495617";

const MERKLE_TREE_HEIGHT = 32;
// const ZERO_VALUE =
//   "21663839004416932945382355908790599225266501822907911457504978515578255421292"; // = keccak256("tornado") % FIELD_SIZE
// let left = ZERO_VALUE;
// let right = ZERO_VALUE;

function getRoot2(left, right) {
  const hash2 = poseidonHash2(left, right);
  return hash2;
}

function generateZLeaf() {
  let zVal = BigInt(
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("blender"))
  );
  console.log("🚀 --------------- zVal", zVal);
  let zLeaf = zVal % BigInt(FIELD_SIZE);
  console.log("ZERO VALUE DERIVED ---- zVal2", zLeaf);
  return zLeaf;
}

function main() {
  let zLeaf = generateZLeaf();
  console.log("zLeaf..", zLeaf);
  console.log("generating roots");
  let i = 0;
  let tempLeaf = zLeaf.toString();
  console.log("tempLeaf", tempLeaf);

  console.log(`if (i == ${i}) return bytes32(${toFixedHex(tempLeaf)});`);
  for (let index = 0; index < MERKLE_TREE_HEIGHT; index++) {
    const tempRoot = getRoot2(tempLeaf, tempLeaf);
    console.log(
      `else if (i == ${index + 1}) return bytes32(${tempRoot._hex});`
    );
    tempLeaf = tempRoot;
  }
}

main();
