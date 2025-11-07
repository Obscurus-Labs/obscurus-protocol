// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {ISemaphoreGroups} from "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";

/// @title GroupManager
/// @notice Thin wrapper around Semaphore v4 groups
contract GroupManager {
    ISemaphore public immutable semaphore;

    // your logical id (event, collection, whatever) -> semaphore group id
    mapping(uint256 => uint256) public semaphoreGroupOf;
    // your logical id -> admin
    mapping(uint256 => address) public groupAdmin;
    // your logical id -> frozen flag
    mapping(uint256 => bool) public isFrozen;

    // events
    event GroupCreated(
        uint256 indexed id,
        uint256 indexed semaphoreGroupId,
        address indexed admin
    );
    event MemberAdded(uint256 indexed id, uint256 identityCommitment);
    event GroupFrozen(uint256 indexed id);

    // errors
    error GroupAlreadyInitialized();
    error GroupNotInitialized();
    error Unauthorized();
    error GroupAlreadyFrozen();

    constructor(address semaphoreAddress) {
        semaphore = ISemaphore(semaphoreAddress);
    }

    /// @notice create a new Semaphore group and bind it to your own id
    function createGroup(uint256 id, address admin) external {
        if (semaphoreGroupOf[id] != 0) revert GroupAlreadyInitialized();
        if (admin == address(0)) revert Unauthorized();

        // according to your doc version: createGroup() returns the group id
        uint256 semGroupId = semaphore.createGroup();

        semaphoreGroupOf[id] = semGroupId;
        groupAdmin[id] = admin;

        emit GroupCreated(id, semGroupId, admin);
    }

    /// @notice add a member (identity commitment) to that group
    function addMember(uint256 id, uint256 identityCommitment) external {
        address admin = groupAdmin[id];
        if (admin == address(0)) revert GroupNotInitialized();
        if (admin != msg.sender) revert Unauthorized();
        if (isFrozen[id]) revert GroupAlreadyFrozen();

        uint256 semGroupId = semaphoreGroupOf[id];
        semaphore.addMember(semGroupId, identityCommitment);

        emit MemberAdded(id, identityCommitment);
    }

    /// @notice stop adding members for that group
    function freezeGroup(uint256 id) external {
        address admin = groupAdmin[id];
        if (admin == address(0)) revert GroupNotInitialized();
        if (admin != msg.sender) revert Unauthorized();
        if (isFrozen[id]) revert GroupAlreadyFrozen();

        isFrozen[id] = true;
        emit GroupFrozen(id);
    }

    /// @notice Returns the Merkle root for a group
    /// @dev Required by ZKVerifier to get the root for proof verification
    function getActiveRoot(uint256 id) external view returns (uint256) {
        if (groupAdmin[id] == address(0)) revert GroupNotInitialized();
        uint256 semGroupId = semaphoreGroupOf[id];
        return ISemaphoreGroups(address(semaphore)).getMerkleTreeRoot(semGroupId);
    }
}
