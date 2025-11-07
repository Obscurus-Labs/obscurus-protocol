// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title MockSemaphore
/// @notice Lightweight mock of Semaphore for testing when Poseidon linking fails
/// @dev DO NOT use in production! This bypasses all ZK verification.
contract MockSemaphore is ISemaphore {
    uint256 private _groupCounter;
    mapping(uint256 => bool) private _groups;

    event MockGroupCreated(uint256 indexed groupId);
    event MockMemberAdded(uint256 indexed groupId, uint256 identityCommitment);

    function groupCounter() external view override returns (uint256) {
        return _groupCounter;
    }

    function createGroup() external override returns (uint256 groupId) {
        _groupCounter++;
        groupId = _groupCounter;
        _groups[groupId] = true;
        emit MockGroupCreated(groupId);
        return groupId;
    }

    function createGroup(address) external override returns (uint256) {
        _groupCounter++;
        uint256 groupId = _groupCounter;
        _groups[groupId] = true;
        emit MockGroupCreated(groupId);
        return groupId;
    }

    function createGroup(address, uint256) external override returns (uint256) {
        _groupCounter++;
        uint256 groupId = _groupCounter;
        _groups[groupId] = true;
        emit MockGroupCreated(groupId);
        return groupId;
    }

    function addMember(uint256 groupId, uint256 identityCommitment) external override {
        require(_groups[groupId], "Group does not exist");
        emit MockMemberAdded(groupId, identityCommitment);
    }

    function addMembers(uint256, uint256[] calldata) external pure override {
        revert("Not implemented in mock");
    }

    function updateGroupAdmin(uint256, address) external pure override {
        revert("Not implemented in mock");
    }

    function acceptGroupAdmin(uint256) external pure override {
        revert("Not implemented in mock");
    }

    function updateGroupMerkleTreeDuration(uint256, uint256) external pure override {
        revert("Not implemented in mock");
    }

    function updateMember(
        uint256,
        uint256,
        uint256,
        uint256[] calldata
    ) external pure override {
        revert("Not implemented in mock");
    }

    function removeMember(uint256, uint256, uint256[] calldata) external pure override {
        revert("Not implemented in mock");
    }

    function validateProof(uint256, SemaphoreProof calldata) external pure override {
        revert("Not implemented in mock");
    }

    function verifyProof(uint256, SemaphoreProof calldata) external pure override returns (bool) {
        return true; // Always return true for testing
    }

    /// @dev Mock implementation of getMerkleTreeRoot
    function getMerkleTreeRoot(uint256 groupId) external view returns (uint256) {
        require(_groups[groupId], "Group does not exist");
        // Return a mock root (just the groupId shifted)
        return uint256(keccak256(abi.encodePacked("MOCK_ROOT", groupId)));
    }
}

