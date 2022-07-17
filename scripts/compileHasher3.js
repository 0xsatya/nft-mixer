// Generates Hasher artifact at compile-time using external compilermechanism
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const { poseidon_gencontract } = require("circomlibjs");
const outputPath = path.join(__dirname, "..", "artifacts", "contracts");
const outputFile = path.join(outputPath, "Hasher3.json");

// const VM = require("ethereumjs-vm").default;
// const BN = require("bn.js");
// const vm = new VM();

const inputCount = 3;

if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

function getPoseidonFactory(nInputs) {
  const bytecode = poseidon_gencontract.createCode(nInputs);
  const abiJson = poseidon_gencontract.generateABI(nInputs);
  // console.log("🚀 ~ abiJson", abiJson);
  const abi = new ethers.utils.Interface(abiJson);
  // console.log("🚀 ~ abi", abi);
  // return new ethers.ContractFactory(abi, bytecode);
  // vm.runCode({
  //     code: Buffer.from(creationBytecode + abiEncodedConstructorArguments, "hex"),
  //     gasLimit: new BN(...),
  // }).then(results => {
  //     const actualDeployedBytecode = results.returnValue.toString("hex");
  //     console.log(actualDeployedBytecode);
  // });

  return { abi, abiJson, bytecode };
}

const { abi, abiJson, bytecode } = getPoseidonFactory(inputCount);

const contract = {
  _format: "hh-sol-artifact-1",
  contractName: "Hasher3",
  sourceName: "contracts/Hasher3.sol",
  abi: abiJson,
  bytecode: bytecode,
  deployedBytecode: bytecode,
  linkReferences: {},
  deployedLinkReferences: {},
};

// console.log("hasher contract \n :", contract);
fs.writeFileSync(outputFile, JSON.stringify(contract, null, 2));
