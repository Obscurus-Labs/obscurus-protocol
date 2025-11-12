/**
 * LeanIMT (Lean Incremental Merkle Tree) implementation for test purposes
 * 
 * This replicates how Semaphore builds incremental Merkle trees.
 * LeanIMT adds nodes from left to right and maintains minimum tree height.
 */

import { buildPoseidon } from "circomlibjs";

interface MerkleProof {
  pathIndices: string[];
  siblings: string[];
}

/**
 * Calculate Merkle proof for a leaf using LeanIMT algorithm
 * @param leaves - Array of leaf values
 * @param leafIndex - Index of the leaf to prove
 * @param nLevels - Max depth of the tree
 * @returns Merkle proof with path indices and siblings
 */
export async function calculateLeanIMTProof(
  leaves: bigint[],
  leafIndex: number,
  nLevels: number = 10
): Promise<MerkleProof> {
  const poseidon = await buildPoseidon();
  
  const pathIndices: number[] = [];
  const siblings: bigint[] = [];
  
  // Build tree level by level using LeanIMT algorithm
  let currentLevel = [...leaves];
  let currentIndex = leafIndex;
  
  for (let level = 0; level < nLevels; level++) {
    if (currentLevel.length === 1) {
      // Reached root, pad rest with zeros
      while (pathIndices.length < nLevels) {
        pathIndices.push(0);
        siblings.push(0n);
      }
      break;
    }
    
    // Determine if current node is left (0) or right (1)
    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
    
    // Store path index
    pathIndices.push(isRight ? 1 : 0);
    
    // Store sibling (or 0 if no sibling)
    const sibling = siblingIndex < currentLevel.length ? currentLevel[siblingIndex] : 0n;
    siblings.push(sibling);
    
    // Build next level
    const nextLevel: bigint[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Both children exist - hash them
        const left = BigInt(currentLevel[i]);
        const right = BigInt(currentLevel[i + 1]);
        const parent = BigInt(poseidon.F.toString(poseidon([left, right])));
        nextLevel.push(parent);
      } else {
        // Odd node - push up without hashing (LeanIMT key behavior)
        nextLevel.push(currentLevel[i]);
      }
    }
    
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return {
    pathIndices: pathIndices.map(String),
    siblings: siblings.map(String),
  };
}

/**
 * Calculate Merkle root from leaves using LeanIMT algorithm
 * @param leaves - Array of leaf values
 * @returns The Merkle root
 */
export async function calculateLeanIMTRoot(leaves: bigint[]): Promise<bigint> {
  if (leaves.length === 0) return 0n;
  if (leaves.length === 1) return leaves[0];
  
  const poseidon = await buildPoseidon();
  let currentLevel = [...leaves];
  
  while (currentLevel.length > 1) {
    const nextLevel: bigint[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Both children exist - hash them
        const left = BigInt(currentLevel[i]);
        const right = BigInt(currentLevel[i + 1]);
        const parent = BigInt(poseidon.F.toString(poseidon([left, right])));
        nextLevel.push(parent);
      } else {
        // Odd node - push up without hashing
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }
  
  return currentLevel[0];
}

/**
 * Verify a Merkle proof using LeanIMT algorithm
 * @param leaf - The leaf value
 * @param pathIndices - Path indices (0=left, 1=right)
 * @param siblings - Sibling hashes at each level
 * @param expectedRoot - Expected Merkle root
 * @returns True if proof is valid
 */
export async function verifyLeanIMTProof(
  leaf: bigint,
  pathIndices: string[],
  siblings: string[],
  expectedRoot: bigint
): Promise<boolean> {
  const poseidon = await buildPoseidon();
  
  let currentNode = leaf;
  
  for (let i = 0; i < pathIndices.length; i++) {
    const sibling = BigInt(siblings[i]);
    
    // If sibling is 0, pass node through (incomplete level)
    if (sibling === 0n) {
      continue;
    }
    
    // Hash with sibling
    const isLeft = pathIndices[i] === "0";
    const left = isLeft ? currentNode : sibling;
    const right = isLeft ? sibling : currentNode;
    
    currentNode = BigInt(poseidon.F.toString(poseidon([left, right])));
  }
  
  return currentNode === expectedRoot;
}

