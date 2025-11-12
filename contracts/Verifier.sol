// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphoreVerifier} from "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";
import "./Groth16Verifier.sol";

/**
 * @title Verifier
 * @notice Wrapper contract that adapts the generated Groth16Verifier to implement ISemaphoreVerifier interface
 * @dev This contract bridges the gap between snarkjs-generated verifier and Semaphore's expected interface
 */
contract Verifier is ISemaphoreVerifier {
    Groth16Verifier public immutable groth16Verifier;
    
    constructor() {
        groth16Verifier = new Groth16Verifier();
    }
    
    /**
     * @notice Verifies a Groth16 ZK-SNARK proof
     * @param pA First public input (proof point A)
     * @param pB Second public input (proof point B) 
     * @param pC Third public input (proof point C)
     * @param pubSignals Public signals array [merkleTreeRoot, nullifierHash, signalHash, externalNullifier]
     * @return True if the proof is valid, false otherwise
     */
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[4] calldata pubSignals,
        uint256 // merkleTreeDepth (unused in this implementation)
    ) external view override returns (bool) {
        return groth16Verifier.verifyProof(pA, pB, pC, pubSignals);
    }
}
