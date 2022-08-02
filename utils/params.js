const path = require('path');
const { ethers } = require('hardhat');
const BigNumber = ethers.BigNumber;

const contractPath = path.join(__dirname, '..', 'contracts');
const artifactContractPath = path.join(__dirname, '..', 'artifacts', 'contracts');

const circuitName = 'nftMixer';
const circuitPath = path.join(__dirname, '..', 'circuits', `${circuitName}`);
const circuitBuildPath = path.join(__dirname, '..', `circuit-build-${circuitName}`);
const circuitInputPath = path.join(circuitPath, `${circuitName}-input.json`);
const circuitBuildPath_build = path.join(circuitBuildPath, 'build');
const circuitBuildPath_output = path.join(circuitBuildPath, 'output');
const circuitBuildPath_solidity = path.join(circuitBuildPath, 'solidity');
const circuitBuildPath_tau = path.join(circuitBuildPath, 'tau');

const FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);
const ZERO_VALUE = '1370249852395389490700185797340442620366735189419093909046557908847258978065';

module.exports = {
  circuitName,
  circuitPath,
  circuitBuildPath,
  circuitBuildPath_build,
  circuitBuildPath_output,
  circuitBuildPath_solidity,
  circuitBuildPath_tau,
  contractPath,
  circuitInputPath,
  ZERO_VALUE,
  artifactContractPath,
};
