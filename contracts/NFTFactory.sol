// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./BaseNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract NFTFactory is Ownable {
    using Clones for address;

    address public implementation;
    mapping(uint256 => address) public collectionContractOf;
    address[] public allCollections;

    error InvalidImplementation();
    error CollectionAlreadyExists();
    error ZeroAddressOwner();

    event ImplementationUpdated(address indexed newImplementation);
    event CollectionCreated(
        uint256 indexed collectionId,
        address indexed nft,
        string name,
        string symbol
    );

    constructor(address impl) Ownable(msg.sender) {
        if (impl == address(0)) revert InvalidImplementation();
        implementation = impl;
        emit ImplementationUpdated(impl);
    }

    function setImplementation(address impl) external onlyOwner {
        if (impl == address(0)) revert InvalidImplementation();
        implementation = impl;
        emit ImplementationUpdated(impl);
    }

    function predictCollectionAddress(
        uint256 collectionId
    ) public view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(collectionId));
        return implementation.predictDeterministicAddress(salt, address(this));
    }

    function createCollection(
        uint256 collectionId,
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        string calldata contractURI_,
        address organizerOwner
    ) external onlyOwner returns (address nft) {
        if (collectionContractOf[collectionId] != address(0))
            revert CollectionAlreadyExists();
        if (organizerOwner == address(0)) revert ZeroAddressOwner();

        bytes32 salt = keccak256(abi.encodePacked(collectionId));
        nft = implementation.cloneDeterministic(salt);

        BaseNFT(nft).initialize(
            collectionId,
            name_,
            symbol_,
            baseURI_,
            contractURI_,
            organizerOwner
        );

        collectionContractOf[collectionId] = nft;
        allCollections.push(nft);

        emit CollectionCreated(collectionId, nft, name_, symbol_);
    }

    function getCollectionsCount() external view returns (uint256) {
        return allCollections.length;
    }

    function getCollectionAt(uint256 index) external view returns (address) {
        return allCollections[index];
    }
}
