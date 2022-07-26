const { ethers } = require('hardhat');

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

module.exports = { getTokenIdfromTxHash };
