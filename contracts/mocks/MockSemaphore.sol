// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {ISemaphoreGroups} from "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";

/// @title MockSemaphore
/// @notice Lightweight mock of Semaphore for testing when Poseidon linking fails
/// @dev DO NOT use in production! This bypasses all ZK verification.
contract MockSemaphore is ISemaphore, ISemaphoreGroups {
    uint256 private _groupCounter;
    mapping(uint256 => bool) private _groups;
    mapping(uint256 => uint256) private _memberCount; // Track member count per group
    mapping(uint256 => uint256) private _merkleRoots; // Store actual merkle roots

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
        _memberCount[groupId]++;
        emit MockMemberAdded(groupId, identityCommitment);
    }

    function addMembers(uint256 groupId, uint256[] calldata identityCommitments) external override {
        require(_groups[groupId], "Group does not exist");
        _memberCount[groupId] += identityCommitments.length;
        for (uint256 i = 0; i < identityCommitments.length; i++) {
            emit MockMemberAdded(groupId, identityCommitments[i]);
        }
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

    // Internal function that accepts memory struct (for use from other contracts)
    function _verifyProofInternal(uint256 groupId, uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] memory points) internal view returns (bool) {
        if (!_groups[groupId]) {
            return false;
        }
        return true;
    }
    
    function verifyProof(uint256 groupId, SemaphoreProof calldata proof) external view override returns (bool) {
        // Check group exists (like onlyExistingGroup modifier in real Semaphore)
        if (!_groups[groupId]) {
            return false;
        }
        
        // In mock mode, always return true if group exists
        // We don't validate the proof itself - this is for testing only
        return true;
    }
    
    // Non-view version for use from ZKVerifier (avoids memory->calldata conversion issue)
    function verifyProofNonView(uint256 groupId, uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] memory points) external returns (bool) {
        if (!_groups[groupId]) {
            return false;
        }
        return true;
    }

    /// @dev Mock implementation of getMerkleTreeRoot (from ISemaphoreGroups)
    function getMerkleTreeRoot(uint256 groupId) external view override returns (uint256) {
        // Don't use require - return 0 if group doesn't exist (view function should not revert)
        if (!_groups[groupId]) {
            return 0;
        }
        // Return stored root if available, otherwise return mock root
        if (_merkleRoots[groupId] != 0) {
            return _merkleRoots[groupId];
        }
        // Return a mock root (just the groupId shifted)
        return uint256(keccak256(abi.encodePacked("MOCK_ROOT", groupId)));
    }
    
    /// @dev Set the merkle root for a group (for testing purposes)
    function setMerkleRoot(uint256 groupId, uint256 root) external {
        require(_groups[groupId], "Group does not exist");
        _merkleRoots[groupId] = root;
    }
    
    /// @dev Mock implementation of getMerkleTreeSize (from ISemaphoreGroups)
    function getMerkleTreeSize(uint256 groupId) external view override returns (uint256) {
        // Return 0 if group doesn't exist, otherwise return member count
        if (!_groups[groupId]) {
            return 0;
        }
        return _memberCount[groupId];
    }
    
    function getGroupAdmin(uint256 groupId) external view override returns (address) {
        if (!_groups[groupId]) {
            return address(0);
        }
        return address(0); // Mock: no admin tracking
    }
    
    function hasMember(uint256 groupId, uint256 identityCommitment) external view override returns (bool) {
        if (!_groups[groupId]) {
            return false;
        }
        return false; // Mock: always return false
    }
    
    function indexOf(uint256 groupId, uint256 identityCommitment) external view override returns (uint256) {
        if (!_groups[groupId]) {
            return 0;
        }
        return 0; // Mock: always return 0
    }
    
    function getMerkleTreeDepth(uint256 groupId) external view override returns (uint256) {
        if (!_groups[groupId]) {
            return 0;
        }
        return 20; // Mock: return standard depth
    }
    
    /// @dev Function to identify this as a mock (returns true)
    function isMock() external pure returns (bool) {
        return true;
    }
}

