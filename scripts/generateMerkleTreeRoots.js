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

// It produces following output
/**
if (i == 0) return bytes32(0x030788afce09ac50700df971c8421f8936ea0756b8e1d4f093d75f8e09034711);
else if (i == 1) return bytes32(0x2c7cc3a0f1c05380d6226d9667d202c7e4067563c05dfda667263564b8af9984);
else if (i == 2) return bytes32(0x1ca697d6281b867174d6fb199f7511d8c16e083040d67741955bcf1ab2dbce5c);
else if (i == 3) return bytes32(0x2faf0eb03df651930f006f765f0ea15ec8bdb0159ac0757b62a2f974dc70c67e);
else if (i == 4) return bytes32(0x0603e1232bdcf27d95b7c72fbbb51a0a28819338771be8958e6d9edb3b5d44e6);
else if (i == 5) return bytes32(0x1387af2cd8edcb40ce4e24c4dd6bcb8c15e22e72b028c022a9ceaeb029354d18);
else if (i == 6) return bytes32(0x0e31cd28d37add39bb2b3544c2843ee9837440c245ba196418b1486457c932f4);
else if (i == 7) return bytes32(0x115e0ed9a368a2275ed111491d53a7817407b183f99efebb66c5e6f4e4bbf829);
else if (i == 8) return bytes32(0x082820e921eec0b44fc35a62c3a2995e8115df236e648f288d72ec826bee7c74);
else if (i == 9) return bytes32(0x00a3c058116d081266d45e93c64120e72b4bee73d16e39cb14d8ea1e758cd7a8);
else if (i == 10) return bytes32(0x0b5265dbba79d4ec14611aaa96a6b9d1db7a65b3c5114d80cace776406407718);
else if (i == 11) return bytes32(0x2e6a737b466520484cac8588a51758e9ecf8b45be754e39f9272261a9abadc89);
else if (i == 12) return bytes32(0x0c7f8149a660e21810963a36f371fec24f1ec38bfb01f88ea3a17212d66e01d1);
else if (i == 13) return bytes32(0x085e960f558b0b5b0198a721ee7db0c4bcf7f5879e2d8e441e94cc24ded530a9);
else if (i == 14) return bytes32(0x0cf15b3c4219b33f0ed4bbfea89dcae00a12e6ab383a36ebc971b8325c0f954a);
else if (i == 15) return bytes32(0x24283bbd5f363d1ab6436ff916745ae9a5ba523ec0341e776b333b78f5f0b8da);
else if (i == 16) return bytes32(0x26097bc63f6a339cc122ad38c9c1becfaa62d08d01c494b4be71841c09845ca9);
else if (i == 17) return bytes32(0x26d881b947653543036d921602420ce385b2b16567a29c1d6749d5167c92a699);
else if (i == 18) return bytes32(0x1edede7e431e5427822027acf20c54681c9530df97e834caa767240d2caa080c);
else if (i == 19) return bytes32(0x0c963e88eb9dbcdbef36cb48f1977ea886e3dd975abd3234abf5e2974dd8f453);
else if (i == 20) return bytes32(0x2c4366db1d2ce25506e4b995be6dcdb11b54e606a420f29a5476635054f1bd53);
else if (i == 21) return bytes32(0x01904d9c00867308635b3cd2fa3b3db9aa376a2791e461a30cd6051035ce6d8d);
else if (i == 22) return bytes32(0x0b62d1be8601d508d5ba0fc11b20791377dd99865c5c6caf79da59f0a4486222);
else if (i == 23) return bytes32(0x12a8425089857341de1e9dd4c71594109f1a0cde4ed7d9b8a9b8090e4e730af6);
else if (i == 24) return bytes32(0x2b2ffe25cb230b867be2adad1b9ebee7c4e0e793dd3c97f981401cfedf4bbcdf);
else if (i == 25) return bytes32(0x2d0970c0dc00717739756c68189dc8172ed5ee4d2de6c81e8d871296d7da7fd1);
else if (i == 26) return bytes32(0x1ac511d203d8f4fa87cf33028498a329419bc765b9a761b27ecd96ffa7b0e604);
else if (i == 27) return bytes32(0x29a114ca13e6fac155fae4c5ed62513e6c0f7748fd740bca9bd88a1417cfdd39);
else if (i == 28) return bytes32(0x00ab822d001880fbf1681cb734a11eb864e4b9663729db089f59f9ef6b5bddce);
else if (i == 29) return bytes32(0x234916a0c49ace3e1bce2884c38c07a389170ec3c2c7f3a0f72eddef3f93d4d5);
else if (i == 30) return bytes32(0x00272bc554099e0cca48e52ce8867c0fbd36acbbb8db86cb4185e8b2d36c544c);
else if (i == 31) return bytes32(0x0107c54a87db7b453245c841835ccaf847d3508847cde1e576457916079ce377);
else if (i == 32) return bytes32(0x02a18f442b92b72486af0c092f6cd90a9be2f2168e4e18e7bd832bcbfc092284);

 */