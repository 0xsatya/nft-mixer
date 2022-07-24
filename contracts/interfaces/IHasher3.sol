// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IHasher3 {
    // function poseidon(bytes32[3] calldata inputs) external pure returns (bytes32);

    function poseidon(uint256[3] calldata inputs) external pure returns (uint256);
}
