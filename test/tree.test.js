const hre = require("hardhat");
const { ethers, waffle } = hre;
const { loadFixture } = waffle;
const { expect } = require("chai");
const { poseidon_gencontract } = require("circomlibjs");

const { poseidonHash2, toFixedHex } = require("../src/utils");
const { poseidon } = require("circomlibjs");
const LeftLeaft = 0;
const RightLeaf = 0;
const MERKLE_TREE_HEIGHT = 5;
const ZERO_VALUE =
  "1370249852395389490700185797340442620366735189419093909046557908847258978065"; // = keccak256("blender") % FIELD_SIZE

const { MerkleTree } = require("fixed-merkle-tree");
const { BigNumber } = require("ethers");

describe("MerkleTreeWithHistory", function () {
  this.timeout(20000);

  function getPoseidonFactory(nInputs) {
    const bytecode = poseidon_gencontract.createCode(nInputs);
    const abiJson = poseidon_gencontract.generateABI(nInputs);
    const abi = new ethers.utils.Interface(abiJson);
    // console.log(
    //   "🚀 ~ file: tree.test.js ~ line 20 ~ getPoseidonFactory ~ abi",
    //   abi
    // );

    return new ethers.ContractFactory(abi, bytecode);
  }

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName);
    const instance = await Factory.deploy(...args);
    // const instance = await Factory.deploy();
    return instance.deployed();
  }

  function getNewTree() {
    return new MerkleTree(MERKLE_TREE_HEIGHT, [], {
      hashFunction: poseidonHash2,
      zeroElement: ZERO_VALUE,
    });
  }

  async function fixture() {
    // TODO: check later to use compileHasher to generate hasher artifact
    // require("../scripts/compileHasher");
    // const hasher = await deploy("Hasher");
    const [signer] = await ethers.getSigners();
    const hasher = await getPoseidonFactory(2).connect(signer).deploy();
    // console.log("🚀 ~ file: tree.test.js ~ line 41 ~ fixture ~ hasher", hasher);

    // const hasher = await hasherContractFactory.deploy();
    // await hasher.deployed();
    // const instance = await Factory.deploy();
    console.log("deployed hasher address :", hasher.address);

    const merkleTreeWithHistory = await deploy(
      "MerkleTreeWithHistoryMock",
      MERKLE_TREE_HEIGHT,
      hasher.address
    );
    await merkleTreeWithHistory.initialize();
    return { hasher, merkleTreeWithHistory };
  }

  // it('should return cloned tree in fixture', async () => {
  //   const { tree: tree1 } = await loadFixture(fixture)
  //   tree1.insert(1)
  //   const { tree: tree2 } = await loadFixture(fixture)
  //   expect(tree1.root()).to.not.equal(tree2.root())
  // })

  describe("#constructor", () => {
    it("should correctly hash 2 leaves", async () => {
      const { hasher, merkleTreeWithHistory } = await loadFixture(fixture);
      // console.log(
      //   "🚀 ~ file: tree.test.js ~ line 73 ~ it.only ~ hasher",
      //   hasher
      // );
      // console.log(hasher)
      const hash0 = await merkleTreeWithHistory.hashLeftRight(
        toFixedHex(123),
        toFixedHex(456)
      );
      console.log("🚀 ~ file: tree.test.js ~ line 72 ~ it.only ~ hash0", hash0);

      // TODO: check hasher contract frontend poseidon fun
      // const hash1 = await hasher.poseidon([toFixedHex(123), toFixedHex(456)]);
      // console.log("🚀 ~ file: tree.test.js ~ line 74 ~ it.only ~ hash1", hash1);
      // console.log(poseidon([123, 456]));

      const hash2 = await poseidonHash2(123, 456);
      console.log("🚀 ~ file: tree.test.js ~ line 82 ~ it.only ~ hash2", hash2);
      expect(hash0).to.equal(hash2);
    });

    it("should initialize", async () => {
      const { merkleTreeWithHistory } = await loadFixture(fixture);
      const zeroValue = await merkleTreeWithHistory.ZERO_VALUE();
      console.log(
        "🚀 ~ file: tree.test.js ~ line 100 ~ it ~ zeroValue",
        zeroValue,
        zeroValue.toHexString()
      );
      const firstSubtree = await merkleTreeWithHistory.filledSubtrees(0);
      console.log(
        "🚀 ~ file: tree.test.js ~ line 102 ~ it ~ firstSubtree",
        firstSubtree
      );
      const firstZero = await merkleTreeWithHistory.zeros(0);
      console.log(
        "🚀 ~ file: tree.test.js ~ line 104 ~ it ~ firstZero",
        firstZero
      );
      expect(firstSubtree).to.be.equal(zeroValue);
      expect(firstZero).to.be.equal(zeroValue);
    });

    it("should have correct merkle root", async () => {
      const { merkleTreeWithHistory } = await loadFixture(fixture);
      const contractRoot = await merkleTreeWithHistory.getLastRoot();
      console.log("🚀 ~ contractRoot", contractRoot);

      const tree = getNewTree();
      console.log("JS tree", tree);
      console.log("JS tree root:", tree.root.toHexString());

      expect(tree.root.toHexString()).to.equal(contractRoot);
    });
  });

  describe("#insert", () => {
    it("should insert", async () => {
      const { merkleTreeWithHistory } = await loadFixture(fixture);
      const tree = getNewTree();
      await merkleTreeWithHistory.insert(toFixedHex(123), toFixedHex(456));
      tree.bulkInsert([123, 456]);
      expect(tree.root.toHexString()).to.be.be.equal(
        await merkleTreeWithHistory.getLastRoot()
      );

      await merkleTreeWithHistory.insert(toFixedHex(678), toFixedHex(876));
      tree.bulkInsert([678, 876]);
      expect(tree.root.toHexString()).to.be.be.equal(
        await merkleTreeWithHistory.getLastRoot()
      );
    });

    it("hasher gas", async () => {
      const { merkleTreeWithHistory } = await loadFixture(fixture);
      const gas = await merkleTreeWithHistory.estimateGas.hashLeftRight(
        toFixedHex(123),
        toFixedHex(456)
      );
      console.log("hasher gas", gas - 21000);
    });
  });

  describe("#isKnownRoot", () => {
    async function fixtureFilled() {
      const { merkleTreeWithHistory, hasher } = await loadFixture(fixture);
      await merkleTreeWithHistory.insert(toFixedHex(123), toFixedHex(456));
      return { merkleTreeWithHistory, hasher };
    }

    it("should return last root", async () => {
      const { merkleTreeWithHistory } = await fixtureFilled(fixture);
      const tree = getNewTree();
      tree.bulkInsert([123, 456]);
      expect(
        await merkleTreeWithHistory.isKnownRoot(tree.root.toHexString())
      ).to.equal(true);
    });

    it("should return older root", async () => {
      const { merkleTreeWithHistory } = await fixtureFilled(fixture);
      const tree = getNewTree();
      tree.bulkInsert([123, 456]);
      await merkleTreeWithHistory.insert(toFixedHex(234), toFixedHex(432));
      expect(
        await merkleTreeWithHistory.isKnownRoot(tree.root.toHexString())
      ).to.equal(true);
    });

    it("should fail on unknown root", async () => {
      const { merkleTreeWithHistory } = await fixtureFilled(fixture);
      const tree = getNewTree();
      tree.bulkInsert([456, 654]);
      expect(
        await merkleTreeWithHistory.isKnownRoot(tree.root.toHexString())
      ).to.equal(false);
    });

    it("should not return uninitialized roots", async () => {
      const { merkleTreeWithHistory } = await fixtureFilled(fixture);
      expect(await merkleTreeWithHistory.isKnownRoot(toFixedHex(0))).to.equal(
        false
      );
    });
  });
});
