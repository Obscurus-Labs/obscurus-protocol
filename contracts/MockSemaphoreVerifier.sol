// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphoreVerifier} from "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";

/// @title MockSemaphoreVerifier
/// @notice Mock verifier for testing - ALWAYS returns true
/// @dev DO NOT use in production! This bypasses actual ZK verification.
///      For production, use a real verifier contract generated from your Semaphore circuit.
contract MockSemaphoreVerifier is ISemaphoreVerifier {
    /// @dev Always returns true - for testing purposes only
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[4] calldata,
        uint256
    ) external pure override returns (bool) {
        return true;
    }
}

