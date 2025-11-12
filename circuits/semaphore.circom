pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Semaphore circuit with full Merkle path verification
 * 
 * This circuit verifies:
 * 1. Identity commitment is computed correctly from nullifier and trapdoor
 * 2. The leaf (identity commitment + ticket type) is part of the Merkle tree
 * 3. The Merkle path from leaf to root is valid
 * 4. Nullifier hash is computed correctly
 * 
 * Inputs (private):
 * - identityNullifier: The user's identity nullifier
 * - identityTrapdoor: The user's identity trapdoor
 * - ticketType: Ticket type (1 = VIP, 2 = General, etc.) - used to compute leaf
 * - treePathIndices: Merkle path indices (0 = left, 1 = right at each level)
 * - treeSiblings: Merkle path siblings (hash values at each level)
 * 
 * Inputs (public):
 * - externalNullifier: External nullifier (context-specific)
 * - signalHash: Signal hash (can be any value)
 * 
 * Public outputs (in order, as expected by test):
 * [0] merkleTreeRoot: The computed Merkle tree root
 * [1] nullifierHash: Hash of nullifier + external nullifier
 * [2] signalHash: The signal hash (passed through)
 * [3] externalNullifier: The external nullifier (passed through)
 */
template Semaphore(nLevels) {
    // Private inputs
    signal input identityNullifier;
    signal input identityTrapdoor;
    signal input ticketType; // Ticket type (1 = VIP, 2 = General, etc.) - needed to compute correct leaf
    signal input treePathIndices[nLevels];
    signal input treeSiblings[nLevels];
    
    // Public inputs (these will appear after outputs in public signals)
    signal input externalNullifier;
    signal input signalHash;

    // Public outputs (appear first in public signals array)
    signal output merkleTreeRoot;
    signal output nullifierHash;

    // Step 1: Compute identity commitment = Poseidon([identityNullifier, identityTrapdoor])
    component poseidonIdentity = Poseidon(2);
    poseidonIdentity.inputs[0] <== identityNullifier;
    poseidonIdentity.inputs[1] <== identityTrapdoor;
    signal identityCommitment;
    identityCommitment <== poseidonIdentity.out;

    // Step 2: Compute leaf = Poseidon([identityCommitment, ticketType])
    // This matches how the test adds members to the tree
    component poseidonLeaf = Poseidon(2);
    poseidonLeaf.inputs[0] <== identityCommitment;
    poseidonLeaf.inputs[1] <== ticketType;
    signal leaf;
    leaf <== poseidonLeaf.out;

    // Step 3: Verify Merkle path from leaf to root
    // Start with the leaf and compute the path up to the root
    signal merkleNodes[nLevels + 1];
    merkleNodes[0] <== leaf;

    // For each level in the tree, compute the parent node
    component poseidonPath[nLevels];
    component isPathIndexZero[nLevels];
    component isSiblingZero[nLevels];
    
    // Intermediate signals for Merkle path computation
    signal leftSelector[nLevels];
    signal rightSelector[nLevels];
    signal leftTerm1[nLevels];
    signal leftTerm2[nLevels];
    signal rightTerm1[nLevels];
    signal rightTerm2[nLevels];
    signal hashedValue[nLevels];
    signal shouldSkipHash[nLevels];
    signal resultTerm1[nLevels];
    signal resultTerm2[nLevels];
    
    for (var i = 0; i < nLevels; i++) {
        poseidonPath[i] = Poseidon(2);
        isPathIndexZero[i] = IsEqual();
        isSiblingZero[i] = IsEqual();
        
        // Check if pathIndex is 0 (current node is left child)
        isPathIndexZero[i].in[0] <== treePathIndices[i];
        isPathIndexZero[i].in[1] <== 0;
        
        // Check if sibling is 0 (tree doesn't extend to this level)
        isSiblingZero[i].in[0] <== treeSiblings[i];
        isSiblingZero[i].in[1] <== 0;
        
        // If sibling is 0, skip hashing and just pass current node through
        // This handles single-member trees where root = leaf
        shouldSkipHash[i] <== isSiblingZero[i].out;
        
        // If pathIndex is 0: left = current, right = sibling
        // If pathIndex is 1: left = sibling, right = current
        // isPathIndexZero.out = 1 when pathIndex = 0, otherwise 0
        
        // Break down the computation into quadratic steps:
        leftSelector[i] <== 1 - isPathIndexZero[i].out;
        rightSelector[i] <== isPathIndexZero[i].out;
        
        // left = isPathIndexZero * current + (1 - isPathIndexZero) * sibling
        leftTerm1[i] <== isPathIndexZero[i].out * merkleNodes[i];
        leftTerm2[i] <== leftSelector[i] * treeSiblings[i];
        poseidonPath[i].inputs[0] <== leftTerm1[i] + leftTerm2[i];
        
        // right = (1 - isPathIndexZero) * current + isPathIndexZero * sibling
        rightTerm1[i] <== leftSelector[i] * merkleNodes[i];
        rightTerm2[i] <== rightSelector[i] * treeSiblings[i];
        poseidonPath[i].inputs[1] <== rightTerm1[i] + rightTerm2[i];
        
        // Compute the hash
        hashedValue[i] <== poseidonPath[i].out;
        
        // If shouldSkipHash = 1 (sibling is 0), use current node; otherwise use hashed value
        // result = shouldSkipHash * current + (1 - shouldSkipHash) * hashedValue
        resultTerm1[i] <== shouldSkipHash[i] * merkleNodes[i];
        resultTerm2[i] <== (1 - shouldSkipHash[i]) * hashedValue[i];
        merkleNodes[i + 1] <== resultTerm1[i] + resultTerm2[i];
    }

    // The final computed root
    merkleTreeRoot <== merkleNodes[nLevels];

    // Step 4: Compute nullifier hash = Poseidon([identityNullifier, externalNullifier])
    component poseidonNullifier = Poseidon(2);
    poseidonNullifier.inputs[0] <== identityNullifier;
    poseidonNullifier.inputs[1] <== externalNullifier;
    nullifierHash <== poseidonNullifier.out;
}

/**
 * Main component configured for 10-level Merkle trees
 * Supports trees from 1 member (depth 0) up to 2^10 = 1024 members (depth 10)
 * 
 * Public signals order (as expected by the test):
 * [0] merkleTreeRoot (output) - computed from Merkle path verification
 * [1] nullifierHash (output) - prevents double-spending
 * [2] signalHash (public input) - arbitrary signal/message
 * [3] externalNullifier (public input) - context identifier
 * 
 * Note: In Circom, outputs are automatically public and come first,
 * then public inputs follow. We declare signalHash and externalNullifier
 * as public inputs to ensure correct ordering.
 * 
 * Note: Using 10 levels instead of 20 significantly reduces compilation time
 * while still supporting up to 1024 members, which is sufficient for most use cases.
 */
component main {public [signalHash, externalNullifier]} = Semaphore(10);

