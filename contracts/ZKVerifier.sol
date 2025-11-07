// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

interface IGroupManager {
    function semaphoreGroupOf(uint256 id) external view returns (uint256);

    function getActiveRoot(uint256 id) external view returns (uint256);
}

/// @title ZKVerifier
/// @notice Generic verifier for Semaphore-based access / one-time actions.
///         Works for tickets, memberships, votes, anything that is:
///         "I am in this group and I haven't used this nullifier here".
contract ZKVerifier {
    ISemaphore public immutable semaphore;
    IGroupManager public immutable groupManager;

    // contextId => nullifierHash => used
    mapping(uint256 => mapping(uint256 => bool)) public nullifierUsed;

    event AccessGranted(
        uint256 indexed contextId,
        uint256 nullifierHash,
        uint256 signal
    );

    error InvalidProof();
    error DuplicateUse();

    constructor(address semaphore_, address groupManager_) {
        semaphore = ISemaphore(semaphore_);
        groupManager = IGroupManager(groupManager_);
    }

    /// @param contextId abstract logical id (event, collection, room, poll, …)
    /// @param signal optional public value (can be 1 or can be "ticketType")
    /// @param nullifierHash Semaphore nullifier for uniqueness
    /// @param proof Groth16 proof
    function verifyZKProof(
        uint256 contextId,
        uint256 signal,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        if (nullifierUsed[contextId][nullifierHash]) revert DuplicateUse();

        // map logical id -> actual semaphore group
        uint256 groupId = groupManager.semaphoreGroupOf(contextId);
        uint256 merkleRoot = groupManager.getActiveRoot(contextId);

        // scope so the same proof can't be replayed in another context
        uint256 externalNullifier = uint256(
            keccak256(abi.encodePacked("ZK_CTX", address(this), contextId))
        );

        ISemaphore.SemaphoreProof memory sp = ISemaphore.SemaphoreProof({
            merkleTreeDepth: 20, // Must match circuit depth (nLevels in semaphore.circom)
            merkleTreeRoot: merkleRoot,
            nullifier: nullifierHash,
            message: signal,
            scope: externalNullifier,
            points: proof
        });

        bool ok = semaphore.verifyProof(groupId, sp);
        if (!ok) revert InvalidProof();

        nullifierUsed[contextId][nullifierHash] = true;

        emit AccessGranted(contextId, nullifierHash, signal);
    }
}
