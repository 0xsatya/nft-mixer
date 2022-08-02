const { MerkleTree } = require('fixed-merkle-tree');
const { ethers } = require('hardhat');
const BigNumber = ethers.BigNumber;

function getNewTree(leaves, treeHeight, hashFunction, zeroValue) {
  return new MerkleTree(treeHeight, leaves, {
    hashFunction: hashFunction,
    zeroElement: zeroValue,
  });
}

/**
 * builds merkle tree
 * @param {contract} NFT Mixer contract
 * @returns all the events from the block chain and new merkle tree
 */
async function buildMerkleTree(nftContract, treeHeight, hashFunction, zeroValue) {
  const filter = nftContract.filters.NFTDeposited();
  const latestBlcok = await ethers.provider.getBlockNumber();
  const events = await nftContract.queryFilter(filter, 0, latestBlcok);

  const leaves = events
    .sort((a, b) => a.args.leafIndex - b.args.leafIndex)
    .map((e) => BigNumber.from(e.args.commitment));

  console.log('🚀 ~ buildMerkleTree => leaves', leaves);

  const tree = getNewTree(leaves, treeHeight, hashFunction, zeroValue);

  return { events: events, tree: tree };
}

module.exports = {
  getNewTree,
  buildMerkleTree,
};
