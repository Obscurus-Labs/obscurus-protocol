// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract BaseNFT is Initializable, ERC721Upgradeable, OwnableUpgradeable {
    uint256 private _nextTokenId;
    uint256 public collectionId;
    string private _baseTokenURI;
    string public contractURI;

    function initialize(
        uint256 collectionId_,
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        string calldata contractURI_,
        address owner_
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init(owner_);
        collectionId = collectionId_;
        _baseTokenURI = baseURI_;
        contractURI = contractURI_;
    }

    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
