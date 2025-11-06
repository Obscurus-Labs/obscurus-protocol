// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TicketNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract TicketFactory is Ownable {
    using Clones for address;

    // Base implementation (initializable ERC-721) to clone
    address public implementation;

    // eventId => event ERC-721 contract
    mapping(uint256 => address) public eventContractOf;
    // list (optional) for iteration/indexing
    address[] public allEvents;

    // --- Errors and events ---
    error InvalidImplementation();
    error EventAlreadyExists();
    error ZeroAddressOwner();

    event ImplementationUpdated(address indexed newImplementation);
    event EventCreated(
        uint256 indexed eventId,
        address indexed nft,
        string name,
        string symbol
    );

    constructor(address impl) Ownable(msg.sender) {
        if (impl == address(0)) revert InvalidImplementation();
        implementation = impl;
        emit ImplementationUpdated(impl);
    }

    // Rotate the base implementation (new audited version)
    function setImplementation(address impl) external onlyOwner {
        if (impl == address(0)) revert InvalidImplementation();
        implementation = impl;
        emit ImplementationUpdated(impl);
    }

    // Deterministic address of the clone for a given eventId
    function predictEventAddress(
        uint256 eventId
    ) public view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(eventId));
        return implementation.predictDeterministicAddress(salt, address(this));
    }

    // Creates the event ERC-721 contract (deterministic clone) and initializes its state
    function createEvent(
        uint256 eventId,
        string calldata name_,
        string calldata symbol_,
        string[] calldata ticketTypeNames_,
        string calldata baseURI_,
        string calldata contractURI_,
        address organizerOwner
    ) external onlyOwner returns (address nft) {
        if (eventContractOf[eventId] != address(0)) revert EventAlreadyExists();
        if (organizerOwner == address(0)) revert ZeroAddressOwner();

        bytes32 salt = keccak256(abi.encodePacked(eventId));
        nft = implementation.cloneDeterministic(salt);

        TicketNFT(nft).initialize(
            eventId,
            name_,
            symbol_,
            ticketTypeNames_,
            baseURI_,
            contractURI_,
            organizerOwner
        );

        eventContractOf[eventId] = nft;
        allEvents.push(nft);

        emit EventCreated(eventId, nft, name_, symbol_);
    }

    // Listing helpers
    function getEventsCount() external view returns (uint256) {
        return allEvents.length;
    }

    function getEventAt(uint256 index) external view returns (address) {
        return allEvents[index];
    }
}
