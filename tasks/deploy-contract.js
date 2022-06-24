// const ethers = require("ethers");
const { task, types } = require("hardhat/config");

task("deploy:contract", "Deploy a solidity contract & its Verifier contract")
  .addOptionalParam("logs", "Logs ", true, types.boolean)
  .setAction(async (logs, hre) => {
    // const Verifier = await hre.ethers.getContractFactory("Verifier");
    const ContractFactory = await hre.ethers.getContractFactory("Greeter");
    // const [owner] = await hre.ethers.getSigners()

    // const verifierContract = await Verifier.deploy();
    // await verifierContract.deployed();

    const contract = await ContractFactory.deploy("Hello");
    await contract.deployed();

    logs && console.log(`Contract has been deployed to: ${contract.address}`);

    return contract;
  });
