// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract NFTEscrow is IERC1155Receiver, IERC721Receiver {

    struct EscrowedToken {
        address owner;
        address token;
        uint256 tokenId;
        uint256 amount; //amount to be collected from nft receiver
        // address receipient;
        uint256 timestamp;
        bool isERC721;
        bool isAmountDeposited;
    }

    mapping (bytes32 => EscrowedToken) private escrows;
    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => bool) public commitments;

    //events
    event NFTDeposited(address token, address owner, uint256 tokenId, uint256 value, bool isERC721);
    event NFTWithdrawn(address token, address owner, uint256 tokenId, uint256 value, bool isERC721);

    function depositNft(bytes32 _commitment, address _token, uint256 _tokenId, uint256 _amount, bool _isERC721) external {
        escrows[_commitment] = EscrowedToken(msg.sender, _token, _tokenId, _amount, block.timestamp, _isERC721, false);
        if (_isERC721) IERC721(_token).safeTransferFrom(msg.sender, address(this), _tokenId);
        else IERC1155(_token).safeTransferFrom(msg.sender, address(this), _tokenId, 1, '');
        emit NFTDeposited(_token, msg.sender, _tokenId, _amount, _isERC721);
    }

    function withdrawNft(bytes32 _commitment, bytes32 _nullifierHash, address _receipient) external {
        //if amount is deposited for the nft then only allow nft to withdraw
        /** It checks following
            1. Amount ==0 or it should be depposited
            2. msg.sender should be nft receipient.
            3. nullifier should be unused.
         */
        require(!nullifierHashes[_nullifierHash], "The note has been already spent");
        EscrowedToken memory escrow = escrows[_commitment];
        // require(msg.sender == escrow.receipient, 'Only receiver can call withdraw');
        //checks if the specifed amount has been deposited or not
        require(escrow.amount == 0 || escrow.isAmountDeposited, "Deposit requisite amount before withdrawing");
        nullifierHashes[_nullifierHash] = true;

        _processWithdrawNft(escrow, _receipient);

        emit NFTWithdrawn(escrow.token, msg.sender, escrow.tokenId, escrow.amount, escrow.isERC721);
        // delete escrows[msg.sender];
    }


    function _processWithdrawNft(EscrowedToken memory escrow, address _receipient) internal {
        if(escrow.isERC721) IERC721(escrow.token).safeTransferFrom(address(this), _receipient, escrow.tokenId);
        else IERC1155(escrow.token).safeTransferFrom(address(this), _receipient, escrow.tokenId, 1, '');
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) public virtual override  returns (bytes4) {
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
        return interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ;
    }
}