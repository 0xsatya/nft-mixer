require('dotenv').config();
const { ethers } = require('hardhat');

async function deployContract(name, args) {
  const factory = await ethers.getContractFactory(name);
  const ctr = await factory.deploy(...(args || []));
  await ctr.deployed();

  return ctr;
}

async function contractAt(name, address) {
  return await ethers.getContractAt(name, address);
}

async function getTokenIdfromTxHash(transactionHash) {
  const txReceipt = await ethers.provider.getTransactionReceipt(transactionHash);
  console.log('getTokenIdfromTxHash ~ txReceipt', txReceipt);
  const topics = txReceipt.logs[0].topics;
  console.log('getTokenIdfromTxHash ~ topics', topics);
  if (txReceipt) {
    const accountAdd = `0x${Buffer.from(ethers.utils.stripZeros(topics[2])).toString('hex')}`;
    const tokenId = parseInt(topics[3], 16);
    console.log('getTokenIdfromTxHash ~ accountAdd', accountAdd);
    console.log('getTokenIdfromTxHash ~ tokenId', tokenId);
    return accountAdd, tokenId;
  } else {
    return -1;
  }
}

/** Display ETH account balance */
async function printETHBalance({ address, name }) {
  console.log(`${name} ETH balance is`, web3.utils.fromWei(await web3.eth.getBalance(address)));
}

/** Checks NFT Token owner */
async function checkERC21Owner({ address, name, tokenAddress, tokenId, isERC721 }) {
  if (isERC721) {
    erc721Mock = await deployContract('ERC721Mock');
    return address == (await erc721Mock.ownerOf(tokenId));
  } else {
    erc1155Mock = await deployContract('ERC1155Mock');
    return await erc1155Mock.balanceOf(address, tokenId);
  }
}

async function setupAccounts() {
  const provider = new ethers.getDefaultProvider();
  const chainId = (await provider.getNetwork()).chainId;
  PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (PRIVATE_KEY) {
    const accounts = await ethers.getSigners();
    return provider, chainId, accounts;
  } else {
    console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit');
  }
}

async function getNftTokenOwner(contract, tokenId, isERC721, accountAdd = 0x0) {
  try {
    if (isERC721) return await contract.ownerOf(tokenId);
    else return await erc1155Mock.balanceOf(accountAdd, tokenId);
  } catch (error) {
    console.log('ERROR :', error);
    return false;
  }
}

module.exports = {
  deployContract,
  contractAt,
  getTokenIdfromTxHash,
  printETHBalance,
  checkERC21Owner,
  setupAccounts,
  getNftTokenOwner,
};
