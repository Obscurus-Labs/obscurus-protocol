'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESSES, GROUP_MANAGER_ABI } from '@/lib/contracts';
import { getGroupLeavesFromEvents, calculateLeaf, calculateLeanIMTRoot } from '@/lib/zk';

export function FreezeGroup({ 
  contextId, 
  deployedGroupManager 
}: { 
  contextId: string;
  deployedGroupManager?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const publicClient = usePublicClient();

  // Use deployed address if provided, otherwise fall back to default
  const groupManagerAddress = (deployedGroupManager || CONTRACT_ADDRESSES.GROUP_MANAGER) as `0x${string}`;

  // Check if group is already frozen
  const { data: isFrozen } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'isFrozen',
    args: [BigInt(contextId)],
  });

  const { data: semaphoreGroupId } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'semaphoreGroupOf',
    args: [BigInt(contextId)],
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const { writeContract: writeMockSemaphore } = useWriteContract();

  const calculateAndStoreMerkleRoot = async () => {
    if (!publicClient || !semaphoreGroupId) return;

    try {
      console.log('[FreezeGroup] Calculating real Merkle root...');
      
      // Get Semaphore address
      const semaphoreAddress = await publicClient.readContract({
        address: groupManagerAddress,
        abi: GROUP_MANAGER_ABI,
        functionName: 'semaphore',
      }) as string;

      // Get all commitments from events
      const commitments = await getGroupLeavesFromEvents(
        semaphoreAddress as `0x${string}`,
        BigInt(semaphoreGroupId.toString()),
        undefined,
        groupManagerAddress,
        BigInt(contextId)
      );

      if (commitments.length === 0) {
        console.warn('[FreezeGroup] No commitments found, cannot calculate root');
        return;
      }

      // Calculate leaves: for each commitment, get its ticketType from localStorage
      // and calculate leaf = Poseidon([commitment, ticketType])
      const leaves: bigint[] = [];
      for (const commitment of commitments) {
        // Try to get ticketType from localStorage
        const storageKey = `group_${contextId}_${commitment.toString()}`;
        const storedTicketType = localStorage.getItem(storageKey);
        const ticketType = storedTicketType ? BigInt(storedTicketType) : 1n; // Default to 1 if not found
        
        const leaf = await calculateLeaf(commitment, ticketType);
        leaves.push(leaf);
      }

      // Calculate the Merkle root
      const merkleRoot = await calculateLeanIMTRoot(leaves);
      console.log('[FreezeGroup] Calculated Merkle root:', merkleRoot.toString());

      // Store the root in MockSemaphore
      const mockSemaphoreAbi = [
        {
          inputs: [
            { internalType: 'uint256', name: 'groupId', type: 'uint256' },
            { internalType: 'uint256', name: 'root', type: 'uint256' },
          ],
          name: 'setMerkleRoot',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ] as const;

      // Wait a bit for the freeze transaction to be fully processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      writeMockSemaphore({
        address: semaphoreAddress as `0x${string}`,
        abi: mockSemaphoreAbi,
        functionName: 'setMerkleRoot',
        args: [BigInt(semaphoreGroupId.toString()), merkleRoot],
      });

      console.log('[FreezeGroup] Merkle root storage transaction sent');
    } catch (error) {
      console.error('[FreezeGroup] Error calculating/storing Merkle root:', error);
      // Don't fail the freeze operation if root calculation fails
    }
  };

  useEffect(() => {
    if (isSuccess && receipt && publicClient && semaphoreGroupId) {
      // After freezing, calculate and store the real Merkle root
      calculateAndStoreMerkleRoot();
    }
  }, [isSuccess, receipt, publicClient, semaphoreGroupId, contextId, groupManagerAddress, writeMockSemaphore]);

  const handleFreeze = async () => {
    setLoading(true);
    try {
      writeContract({
        address: groupManagerAddress,
        abi: GROUP_MANAGER_ABI,
        functionName: 'freezeGroup',
        args: [BigInt(contextId)],
      });
    } catch (error) {
      setLoading(false);
    }
  };

  if (isSuccess || isFrozen) {
    return (
      <div className="p-6 bg-orange-50 border-2 border-orange-300 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-orange-800 mb-3">
          🔒 Group Frozen!
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-orange-800">
            <strong className="text-orange-900">Context ID:</strong> <span className="font-mono">{contextId}</span>
          </p>
          {hash && (
            <p className="text-orange-800">
              <strong className="text-orange-900">Transaction:</strong> <span className="font-mono text-xs">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
            </p>
          )}
          <p className="text-xs text-orange-700 mt-3 pt-3 border-t border-orange-200">
            🔒 The Merkle root is now locked. No more members can be added. You can now generate ZK proofs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <p className="text-gray-700 mb-4">
        Freeze the group to lock the Merkle root before generating proofs.
      </p>
      <button
        type="button"
        onClick={handleFreeze}
        disabled={isPending || isConfirming || loading}
        className="w-full bg-orange-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending || isConfirming || loading ? 'Freezing...' : 'Freeze Group'}
      </button>
    </div>
  );
}

