// Generates Hasher artifact at compile-time using external compilermechanism
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const { poseidon_gencontract } = require("circomlibjs");
const outputPath = path.join(__dirname, "..", "artifacts", "contracts");
const outputFile = path.join(outputPath, "Hasher.json");

if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

const contract = {
  _format: "hh-sol-artifact-1",
  sourceName: "contracts/Hasher.sol",
  linkReferences: {},
  deployedLinkReferences: {},
  contractName: "Hasher",
  abi: new ethers.utils.Interface(poseidon_gencontract.generateABI(2)),
  bytecode: poseidon_gencontract.createCode(2),
};

console.log("hasher contract \n :", contract);
fs.writeFileSync(outputFile, JSON.stringify(contract, null, 2));
