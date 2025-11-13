'use client';

import { useState, useEffect } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESSES, GROUP_MANAGER_ABI } from '@/lib/contracts';
import { generateProof, proofToContractFormat, calculateLeaf, calculateLeanIMTProof, getGroupLeavesFromEvents, type Identity, type ProofData } from '@/lib/zk';

export function GenerateProof({
  identity,
  contextId,
  onProofGenerated,
  deployedGroupManager,
  deployedZKVerifier,
}: {
  identity: Identity | null;
  contextId: string;
  onProofGenerated: (proof: ProofData, proofArray: bigint[]) => void;
  deployedGroupManager?: string | null;
  deployedZKVerifier?: string | null;
}) {
  // Use deployed addresses if provided, otherwise fall back to defaults
  const zkVerifierAddress = (deployedZKVerifier || CONTRACT_ADDRESSES.ZK_VERIFIER) as `0x${string}`;
  const [loading, setLoading] = useState(false);
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [ticketType, setTicketType] = useState('1');

  // Use deployed address if provided, otherwise fall back to default
  const groupManagerAddress = (deployedGroupManager || CONTRACT_ADDRESSES.GROUP_MANAGER) as `0x${string}`;
  const publicClient = usePublicClient();

  const { data: merkleRoot, refetch: refetchMerkleRoot } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'getActiveRoot',
    args: [BigInt(contextId)],
  });

  // Get Semaphore group ID and address - use same function as AddToGroup
  const { data: semaphoreGroupId, isLoading: isLoadingGroupId, refetch: refetchGroupId } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'semaphoreGroupOf',
    args: [BigInt(contextId)],
  });

  // Check if group exists (group ID should not be 0 or undefined)
  const groupExists = semaphoreGroupId !== undefined && semaphoreGroupId !== null && semaphoreGroupId.toString() !== '0';

  // Refetch when contextId or groupManagerAddress changes, and periodically to catch updates
  useEffect(() => {
    if (contextId && groupManagerAddress) {
      refetchGroupId();
      refetchMerkleRoot();
      
      // Also refetch periodically to catch updates from other components
      const interval = setInterval(() => {
        refetchGroupId();
        refetchMerkleRoot();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [contextId, groupManagerAddress, refetchGroupId, refetchMerkleRoot]);


  const handleGenerate = async () => {
    if (!identity || merkleRoot === undefined || merkleRoot === null) {
      alert('Please ensure identity is generated and group is frozen');
      return;
    }

    if (!semaphoreGroupId || semaphoreGroupId.toString() === '0') {
      alert('Group not found. Please create a group first.');
      return;
    }

    // Get semaphore address directly from contract
    if (!publicClient) {
      alert('Public client not available');
      return;
    }

    // Get semaphore address using public getter (more reliable than getSemaphoreAddress)
    let addressToUse: string;
    try {
      // Use the public getter semaphore() which returns the address directly
      addressToUse = await publicClient.readContract({
        address: groupManagerAddress,
        abi: GROUP_MANAGER_ABI,
        functionName: 'semaphore',
      }) as string;
    } catch {
      // If that fails, try getSemaphoreAddress
      try {
        addressToUse = await publicClient.readContract({
          address: groupManagerAddress,
          abi: GROUP_MANAGER_ABI,
          functionName: 'getSemaphoreAddress',
        }) as string;
      } catch {
        alert(`Could not get Semaphore address from GroupManager at ${groupManagerAddress}.\n\nThis usually means the contract is not deployed correctly or the address is wrong.`);
        return;
      }
    }
    
    if (!addressToUse || addressToUse === '0x0000000000000000000000000000000000000000') {
      alert('Semaphore address is invalid or zero. Please check the GroupManager contract deployment.');
      return;
    }


    setLoading(true);
    try {
      const groupLeaves = await getGroupLeavesFromEvents(
        addressToUse as `0x${string}`,
        BigInt(semaphoreGroupId.toString()),
        undefined, // rpcUrl - use default
        groupManagerAddress, // groupManagerAddress
        BigInt(contextId) // contextId
      );

      if (!groupLeaves || groupLeaves.length === 0) {
        throw new Error('No members found in group. Please add members first.');
      }

      // groupLeaves contains commitments, not leaves
      // We need to find the commitment of the current identity
      const commitmentIndex = groupLeaves.findIndex(
        (commitment) => commitment.toString() === identity.commitment.toString()
      );
      
      if (commitmentIndex === -1) {
        throw new Error(
          `Your identity commitment ${identity.commitment.toString().slice(0, 20)}... was not found in the group. ` +
          `Make sure you added this identity to the group first.`
        );
      }

      console.log(`[GenerateProof] Found identity at index ${commitmentIndex} in group`);

      // Now calculate leaves for all commitments using the ticketType for the proof
      // Note: This assumes all members use the same ticketType, or that we're proving
      // with the ticketType that matches what was stored in localStorage
      const leaves: bigint[] = [];
      for (const commitment of groupLeaves) {
        const leaf = await calculateLeaf(commitment, BigInt(ticketType));
        leaves.push(leaf);
      }

      // Calculate the proof leaf
      const proofLeaf = await calculateLeaf(identity.commitment, BigInt(ticketType));
      console.log(`[GenerateProof] Proof leaf: ${proofLeaf.toString().slice(0, 20)}...`);

      const nLevels = 10;
      const { pathIndices, siblings } = await calculateLeanIMTProof(
        leaves,
        commitmentIndex, // Use commitmentIndex as leafIndex since we built leaves in the same order
        nLevels
      );

      const proof = await generateProof(
        identity,
        BigInt(ticketType),
        BigInt(merkleRoot.toString()),
        BigInt(contextId),
        zkVerifierAddress,
        pathIndices,
        siblings
      );

      const proofArray = await proofToContractFormat(proof.proof, proof.publicSignals);
      
      setProofData(proof);
      onProofGenerated(proof, proofArray);
    } catch (error: any) {
      console.error('❌ [GenerateProof] Error generating proof:', error);
      const errorMessage = error?.message || 'Unknown error';
      alert(`Error generating proof: ${errorMessage}\n\nCheck the browser console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  if (proofData) {
    return (
      <div className="p-6 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          ✅ Proof Generated!
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-green-700 mb-3">
            ZK proof generated successfully. Ready to verify on-chain.
          </p>
          <div className="text-xs font-mono bg-white border border-green-200 p-3 rounded space-y-1.5 mb-3">
            <div className="text-gray-900"><strong className="text-green-900">Nullifier Hash:</strong> {proofData.nullifierHash.toString().slice(0, 30)}...</div>
            <div className="text-gray-900"><strong className="text-green-900">Merkle Root:</strong> {merkleRoot?.toString().slice(0, 30)}...</div>
            <div className="text-gray-900"><strong className="text-green-900">Ticket Type:</strong> {ticketType}</div>
          </div>
          <p className="text-xs text-green-700 pt-3 border-t border-green-200">
            🔐 This proof proves membership without revealing your identity. Ready to verify!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="proof-ticket-type" className="block text-sm font-medium text-gray-900 mb-2">
            Ticket Type
          </label>
          <input
            id="proof-ticket-type"
            type="number"
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md text-black bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="1"
            min="1"
            style={{ color: '#000000' }}
          />
          <p className="text-xs text-gray-600 mt-1.5">
            Use the same ticket type that was used when adding the member to the group.
          </p>
        </div>
        {merkleRoot !== undefined && merkleRoot !== null && (
          <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 p-2.5 rounded">
            <strong className="text-gray-900">Merkle Root:</strong> <span className="font-mono text-xs">{merkleRoot.toString().slice(0, 20)}...</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!identity || !merkleRoot || !semaphoreGroupId || semaphoreGroupId.toString() === '0' || isLoadingGroupId || loading}
          className="w-full bg-purple-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating Proof...' : 'Generate Proof'}
        </button>
        {(merkleRoot === undefined || merkleRoot === null) && (
          <p className="text-sm text-red-600 font-medium">
            ⚠️ Please freeze the group first
          </p>
        )}
        {isLoadingGroupId && (
          <p className="text-sm text-gray-600 font-medium">
            ⏳ Loading group information...
          </p>
        )}
        {!isLoadingGroupId && groupExists && semaphoreGroupId && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 p-2 rounded">
            <strong>Group ID:</strong> <span className="font-mono">{semaphoreGroupId.toString()}</span>
          </div>
        )}
        {!isLoadingGroupId && !groupExists && (
          <p className="text-sm text-red-600 font-medium">
            ⚠️ Group not found. Please create a group first.
          </p>
        )}
      </div>
    </div>
  );
}

