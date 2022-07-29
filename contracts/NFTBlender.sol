// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IHasher3 } from "./interfaces/IHasher3.sol";
import "./MerkleTreeWithHistory.sol";

import "hardhat/console.sol";

interface IVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory input
    ) external returns (bool);
}

contract NFTBlender is IERC1155Receiver, IERC721Receiver, ReentrancyGuard, MerkleTreeWithHistory {
    IVerifier public immutable verifier;
    IHasher3 public immutable hasher3;

    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => bool) public commitments;

    //events
    event NFTDeposited(
        address token,
        uint256 tokenId,
        uint256 value,
        bool isERC721,
        bytes32 indexed commitment,
        uint32 leafIndex,
        uint256 timestamp
    );
    event NFTWithdrawn(bytes32 nullifierHash, address recipient, address token, uint256 tokenId, uint256 value, bool isERC721);
    event TransferOwnership(bytes32 _commitment, uint32 insertedIndex, uint256 timestamp);

    constructor(
        IVerifier _verifier,
        address _hasher,
        address _hasher3,
        uint32 _merkleTreeHeight
    ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
        verifier = _verifier;
        hasher3 = IHasher3(_hasher3);
    }

    function depositNft(
        bytes32 _commitment,
        address _token,
        uint256 _tokenId,
        uint256 _amount,
        bool _isERC721
    ) external {
        require(!commitments[_commitment], "The commitment has been submitted");
        uint32 _insertedIndex = insertCommitment(_commitment);
        _processDeposit(_isERC721, _token, _tokenId);

        emit NFTDeposited(_token, _tokenId, _amount, _isERC721, _commitment, _insertedIndex, block.timestamp);
    }

    function insertCommitment(bytes32 _commitment) internal returns (uint32 _insertedIndex) {
        _insertedIndex = _insert(_commitment);
        commitments[_commitment] = true;
        return _insertedIndex;
    }

    function _processDeposit(
        bool _isERC721,
        address _token,
        uint256 _tokenId
    ) internal {
        if (_isERC721) IERC721(_token).safeTransferFrom(msg.sender, address(this), _tokenId);
        else IERC1155(_token).safeTransferFrom(msg.sender, address(this), _tokenId, 1, "");
    }

    function poseidon3(
        uint256 a,
        uint256 b,
        uint256 c
    ) public view returns (uint256) {
        uint256[3] memory input;
        input[0] = uint256(a);
        input[1] = uint256(b);
        input[2] = uint256(c);
        return hasher3.poseidon(input);
    }

    function parseProof(bytes memory proof, uint256[4] memory _input) internal returns (bool r) {
        // solidity does not support decoding uint[2][2] yet
        (uint256[2] memory a, uint256[2] memory b1, uint256[2] memory b2, uint256[2] memory c) = abi.decode(
            proof,
            (uint256[2], uint256[2], uint256[2], uint256[2])
        );

        r = verifier.verifyProof(a, [[b1[1], b1[0]], [b2[1], b2[0]]], c, _input);
    }

    function withdrawNft(
        bytes memory _proof,
        uint256 _root,
        uint256 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _nullifier,
        address _tokenAddrs,
        uint256 _tokenId,
        bool isERC721,
        bool isWithdraw, // if true, nft is withdrwan to address, else owenership transferred
        bytes32 _commitment
    ) external {
        require(!nullifierHashes[bytes32(_nullifierHash)], "The note has been already spent");
        require(isKnownRoot(bytes32(_root)), "Cannot find your merkle root"); // Make sure to use a recent one

        uint256[4] memory _input;
        _input[0] = uint256(_root);
        _input[1] = uint256(_nullifierHash);
        _input[2] = uint256(uint160(_tokenAddrs));
        _input[3] = _tokenId;

        bool result = parseProof(_proof, _input);

        require(result, "Invalid withdraw proof");

        nullifierHashes[bytes32(_nullifierHash)] = true;
        console.log(uint256(_commitment));

        if (isWithdraw) {
            uint256[3] memory input;
            input[0] = uint256(_nullifier);
            input[1] = uint256(uint160(_tokenAddrs));
            input[2] = uint256(_tokenId);
            require(_nullifierHash == (hasher3.poseidon(input)), "nullifier Hash mismatch");
            _processWithdrawNft(_tokenAddrs, _tokenId, _recipient, isERC721);
            emit NFTWithdrawn(bytes32(_nullifierHash), _recipient, _tokenAddrs, _tokenId, _fee, isERC721);
        } else {
            require(!commitments[_commitment], "The commitment has been submitted");
            uint32 _insertedIndex = insertCommitment(_commitment);
            emit TransferOwnership(_commitment, _insertedIndex, block.timestamp);
            emit NFTDeposited(_tokenAddrs, _tokenId, 0, isERC721, _commitment, _insertedIndex, block.timestamp);
        }
    }

    function _processWithdrawNft(
        address _tokenAddrs,
        uint256 _tokenId,
        address _receipient,
        bool isERC721
    ) internal {
        if (isERC721) IERC721(_tokenAddrs).safeTransferFrom(address(this), _receipient, _tokenId);
        else IERC1155(_tokenAddrs).safeTransferFrom(address(this), _receipient, _tokenId, 1, "");
    }

    /** @dev whether a note is already spent */
    function isSpent(bytes32 _nullifierHash) public view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }

    /** @dev whether an array of notes is already spent */
    function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory spent) {
        spent = new bool[](_nullifierHashes.length);
        for (uint256 i = 0; i < _nullifierHashes.length; i++) {
            if (isSpent(_nullifierHashes[i])) {
                spent[i] = true;
            }
        }
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC721Receiver).interfaceId;
    }
}
