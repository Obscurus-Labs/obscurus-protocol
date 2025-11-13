import { buildPoseidon } from 'circomlibjs';
import { groth16 } from 'snarkjs';
import { ethers } from 'ethers';
import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat } from 'wagmi/chains';

export interface Identity {
  nullifier: bigint;
  trapdoor: bigint;
  commitment: bigint;
}

export interface ProofData {
  proof: any;
  publicSignals: string[];
  nullifierHash: bigint;
}

/**
 * Generate a new identity (nullifier + trapdoor)
 */
export async function generateIdentity(): Promise<Identity> {
  const wallet = ethers.Wallet.createRandom();
  const nullifier = BigInt(ethers.keccak256(wallet.privateKey));
  const trapdoor = BigInt(
    ethers.keccak256(
      ethers.concat([wallet.privateKey, ethers.toUtf8Bytes('0x01')])
    )
  );

  const poseidon = await buildPoseidon();
  const commitment = BigInt(
    poseidon.F.toString(poseidon([nullifier, trapdoor]))
  );

  return { nullifier, trapdoor, commitment };
}

/**
 * Calculate leaf = Poseidon([identityCommitment, ticketType])
 */
export async function calculateLeaf(
  identityCommitment: bigint,
  ticketType: bigint
): Promise<bigint> {
  const poseidon = await buildPoseidon();
  const leaf = BigInt(
    poseidon.F.toString(poseidon([identityCommitment, ticketType]))
  );
  return leaf;
}

/**
 * Get all leaves for a Semaphore group by indexing events
 * This is cleaner than storing leaves on-chain
 */
export async function getGroupLeavesFromEvents(
  semaphoreAddress: `0x${string}`,
  semaphoreGroupId: bigint,
  rpcUrl: string = 'http://localhost:8545',
  groupManagerAddress?: `0x${string}`,
  contextId?: bigint
): Promise<bigint[]> {
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(rpcUrl),
  });

  const leaves: bigint[] = [];

  // Try to get events from GroupManager first (works with MockSemaphore)
  if (groupManagerAddress && contextId !== undefined) {
    console.log(`[getGroupLeavesFromEvents] Searching GroupManager events for contextId ${contextId.toString()}...`);
    const groupManagerAbi = parseAbi([
      'event MemberAdded(uint256 indexed id, uint256 identityCommitment)',
    ]);

    try {
      const groupManagerLogs = await publicClient.getLogs({
        address: groupManagerAddress,
        event: groupManagerAbi[0],
        args: {
          id: contextId,
        },
        fromBlock: 0n,
      });

      console.log(`[getGroupLeavesFromEvents] Found ${groupManagerLogs.length} MemberAdded events from GroupManager`);
      
      for (const log of groupManagerLogs) {
        if (log.args.identityCommitment !== undefined) {
          leaves.push(BigInt(log.args.identityCommitment.toString()));
        }
      }
    } catch (error) {
      console.warn('[getGroupLeavesFromEvents] Error reading GroupManager events:', error);
    }
  }

  // If we found leaves from GroupManager, return them
  if (leaves.length > 0) {
    console.log(`[getGroupLeavesFromEvents] Returning ${leaves.length} leaves from GroupManager events`);
    return leaves;
  }

  // Fallback: Try Semaphore events (for real Semaphore)
  console.log(`[getGroupLeavesFromEvents] Trying Semaphore events for groupId ${semaphoreGroupId.toString()}...`);
  const semaphoreAbi = parseAbi([
    'event MemberAdded(uint256 indexed groupId, uint256 index, uint256 identityCommitment, uint256 merkleTreeRoot)',
    'event MembersAdded(uint256 indexed groupId, uint256 startIndex, uint256[] identityCommitments, uint256 merkleTreeRoot)',
    'event MockMemberAdded(uint256 indexed groupId, uint256 identityCommitment)',
  ]);

  // Build a map of index -> leaf
  const leavesMap = new Map<number, bigint>();

  try {
    // Get all MemberAdded events (real Semaphore)
    const memberAddedLogs = await publicClient.getLogs({
      address: semaphoreAddress,
      event: semaphoreAbi[0],
      args: {
        groupId: semaphoreGroupId,
      },
      fromBlock: 0n,
    });

    // Process MemberAdded events
    for (const log of memberAddedLogs) {
      if (log.args.index !== undefined && log.args.identityCommitment !== undefined) {
        leavesMap.set(Number(log.args.index), BigInt(log.args.identityCommitment.toString()));
      }
    }

    // Get all MembersAdded events (real Semaphore)
    const membersAddedLogs = await publicClient.getLogs({
      address: semaphoreAddress,
      event: semaphoreAbi[1],
      args: {
        groupId: semaphoreGroupId,
      },
      fromBlock: 0n,
    });

    // Process MembersAdded events
    for (const log of membersAddedLogs) {
      if (log.args.startIndex !== undefined && log.args.identityCommitments) {
        const startIndex = Number(log.args.startIndex);
        const commitments = log.args.identityCommitments as readonly bigint[];
        commitments.forEach((commitment, i) => {
          leavesMap.set(startIndex + i, BigInt(commitment.toString()));
        });
      }
    }

    // Get MockMemberAdded events (MockSemaphore)
    const mockMemberAddedLogs = await publicClient.getLogs({
      address: semaphoreAddress,
      event: semaphoreAbi[2],
      args: {
        groupId: semaphoreGroupId,
      },
      fromBlock: 0n,
    });

    // Process MockMemberAdded events (they don't have index, so we use array order)
    for (let i = 0; i < mockMemberAddedLogs.length; i++) {
      const log = mockMemberAddedLogs[i];
      if (log.args.identityCommitment !== undefined) {
        // Use the order in the logs as the index
        leavesMap.set(i, BigInt(log.args.identityCommitment.toString()));
      }
    }

    // Convert map to sorted array
    const maxIndex = Math.max(...Array.from(leavesMap.keys()), -1);
    if (maxIndex >= 0) {
      for (let i = 0; i <= maxIndex; i++) {
        const leaf = leavesMap.get(i);
        if (leaf !== undefined) {
          leaves.push(leaf);
        } else {
          console.warn(`[getGroupLeavesFromEvents] Warning: Missing leaf at index ${i}`);
        }
      }
    }
  } catch (error) {
    console.warn('[getGroupLeavesFromEvents] Error reading Semaphore events:', error);
  }

  console.log(`[getGroupLeavesFromEvents] Returning ${leaves.length} leaves total`);
  return leaves;
}

/**
 * Calculate Merkle root from leaves using LeanIMT algorithm
 * This replicates how Semaphore builds incremental Merkle trees
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
        // Odd node - push up without hashing (LeanIMT key behavior)
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }
  
  return currentLevel[0];
}

/**
 * Calculate Merkle proof for a leaf using LeanIMT algorithm
 * This replicates how Semaphore builds incremental Merkle trees
 */
export async function calculateLeanIMTProof(
  leaves: bigint[],
  leafIndex: number,
  nLevels: number = 10
): Promise<{ pathIndices: string[]; siblings: string[] }> {
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
 * Generate ZK proof
 */
export async function generateProof(
  identity: Identity,
  ticketType: bigint,
  merkleRoot: bigint,
  contextId: bigint,
  zkVerifierAddress: string,
  treePathIndices: string[],
  treeSiblings: string[]
): Promise<ProofData> {
  // Calculate external nullifier
  const externalNullifierRaw = ethers.solidityPackedKeccak256(
    ['string', 'address', 'uint256'],
    ['ZK_CTX', zkVerifierAddress, contextId]
  );

  const signal = 1n;
  const signalBytes = ethers.solidityPacked(['uint256'], [signal]);
  const signalHashForCircuit = BigInt(ethers.keccak256(signalBytes)) >> 8n;
  const externalNullifierBytes = ethers.solidityPacked(
    ['uint256'],
    [BigInt(externalNullifierRaw)]
  );
  const externalNullifierForCircuit =
    BigInt(ethers.keccak256(externalNullifierBytes)) >> 8n;

  // Calculate leaf for logging
  const poseidon = await buildPoseidon();
  const leafForProof = BigInt(
    poseidon.F.toString(poseidon([identity.commitment, ticketType]))
  );
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 [generateProof] CIRCUIT INPUT PREPARATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔑 Identity Nullifier:', identity.nullifier.toString());
  console.log('   🔑 Identity Trapdoor:', identity.trapdoor.toString());
  console.log('   🔑 Identity Commitment:', identity.commitment.toString());
  console.log('   🎫 Ticket Type:', ticketType.toString());
  console.log('   🍃 Leaf (Poseidon([commitment, ticketType])):', leafForProof.toString());
  console.log('   🌳 Expected Merkle Root:', merkleRoot.toString());
  console.log('   📍 Tree Path Indices:', JSON.stringify(treePathIndices));
  console.log('   🌿 Tree Siblings:', JSON.stringify(treeSiblings));
  console.log('   🔐 External Nullifier (raw):', externalNullifierRaw);
  console.log('   🔐 External Nullifier (for circuit):', externalNullifierForCircuit.toString());
  console.log('   📡 Signal:', signal.toString());
  console.log('   📡 Signal Hash (for circuit):', signalHashForCircuit.toString());
  console.log('═══════════════════════════════════════════════════════════');

  const circuitInput = {
    identityNullifier: identity.nullifier.toString(),
    identityTrapdoor: identity.trapdoor.toString(),
    ticketType: ticketType.toString(),
    treePathIndices,
    treeSiblings,
    signalHash: externalNullifierForCircuit.toString(),
    externalNullifier: signalHashForCircuit.toString(),
  };
  
  console.log('📝 [generateProof] Final circuit input object:');
  console.log(JSON.stringify(circuitInput, null, 2));

  // Load WASM and zkey from public folder
  console.log('📁 [generateProof] Loading circuit files...');
  console.log('   🔍 Attempting to load: /circuits/semaphore.wasm');
  let wasmResponse: Response;
  try {
    wasmResponse = await fetch('/circuits/semaphore.wasm');
    console.log('   📊 WASM Response status:', wasmResponse.status, wasmResponse.statusText);
    if (!wasmResponse.ok) {
      const errorText = await wasmResponse.text().catch(() => 'Unable to read error');
      console.error('   ❌ WASM fetch failed:', {
        status: wasmResponse.status,
        statusText: wasmResponse.statusText,
        url: wasmResponse.url,
        error: errorText.slice(0, 200)
      });
      throw new Error(`Failed to load semaphore.wasm: ${wasmResponse.status} ${wasmResponse.statusText}. Make sure the file exists in public/circuits/ and the Next.js dev server is running.`);
    }
  } catch (error: any) {
    if (error.message.includes('Failed to load')) {
      throw error;
    }
    console.error('   ❌ WASM fetch exception:', error);
    throw new Error(`Error loading semaphore.wasm: ${error.message}. Make sure the file exists in public/circuits/ and the Next.js dev server is running.`);
  }
  
  const wasmBuffer = await wasmResponse.arrayBuffer();
  console.log('✅ [generateProof] WASM loaded:', wasmBuffer.byteLength, 'bytes');

  console.log('   🔍 Attempting to load: /circuits/semaphore_final.zkey');
  let zkeyResponse: Response;
  try {
    zkeyResponse = await fetch('/circuits/semaphore_final.zkey');
    console.log('   📊 ZKEY Response status:', zkeyResponse.status, zkeyResponse.statusText);
    if (!zkeyResponse.ok) {
      const errorText = await zkeyResponse.text().catch(() => 'Unable to read error');
      console.error('   ❌ ZKEY fetch failed:', {
        status: zkeyResponse.status,
        statusText: zkeyResponse.statusText,
        url: zkeyResponse.url,
        error: errorText.slice(0, 200)
      });
      throw new Error(`Failed to load semaphore_final.zkey: ${zkeyResponse.status} ${zkeyResponse.statusText}. Make sure the file exists in public/circuits/ and the Next.js dev server is running.`);
    }
  } catch (error: any) {
    if (error.message.includes('Failed to load')) {
      throw error;
    }
    console.error('   ❌ ZKEY fetch exception:', error);
    throw new Error(`Error loading semaphore_final.zkey: ${error.message}. Make sure the file exists in public/circuits/ and the Next.js dev server is running.`);
  }
  
  const zkeyBuffer = await zkeyResponse.arrayBuffer();
  console.log('✅ [generateProof] ZKEY loaded:', zkeyBuffer.byteLength, 'bytes');

  // Generate proof
  console.log('🔮 [generateProof] Starting groth16.fullProve...');
  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    new Uint8Array(wasmBuffer),
    new Uint8Array(zkeyBuffer)
  );
  console.log('✅ [generateProof] Proof generated, publicSignals count:', publicSignals.length);

  // Parse public signals
  const nullifierHash = BigInt(publicSignals[1]);

  return {
    proof,
    publicSignals,
    nullifierHash,
  };
}

/**
 * Convert proof to format for contract call
 */
export async function proofToContractFormat(proof: any, publicSignals: string[]): Promise<bigint[]> {
  try {
    // exportSolidityCallData may be async in some versions
    let calldataResult = groth16.exportSolidityCallData(proof, publicSignals);
    
    // Handle both sync and async cases
    const calldata = calldataResult instanceof Promise 
      ? await calldataResult 
      : calldataResult;
    
    // Ensure calldata is a string
    if (typeof calldata !== 'string') {
      console.error('❌ [proofToContractFormat] calldata is not a string:', typeof calldata, calldata);
      throw new Error(`exportSolidityCallData returned ${typeof calldata} instead of string`);
    }
    
    const argv = calldata
      .replace(/["[\]\s]/g, '')
      .split(',')
      .map((x: string) => BigInt(x));

    if (argv.length < 8) {
      throw new Error(`Expected at least 8 values in calldata, got ${argv.length}`);
    }

    return [
      argv[0], // pA[0]
      argv[1], // pA[1]
      argv[2], // pB[0][0]
      argv[3], // pB[0][1]
      argv[4], // pB[1][0]
      argv[5], // pB[1][1]
      argv[6], // pC[0]
      argv[7], // pC[1]
    ];
  } catch (error) {
    console.error('❌ [proofToContractFormat] Error formatting proof:', error);
    console.error('Proof:', proof);
    console.error('Public signals:', publicSignals);
    throw error;
  }
}

