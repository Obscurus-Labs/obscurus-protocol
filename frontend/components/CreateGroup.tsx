'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, GROUP_MANAGER_ABI } from '@/lib/contracts';

export function CreateGroup({ 
  contextId, 
  deployedGroupManager 
}: { 
  contextId: string;
  deployedGroupManager?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const { address } = useAccount();

  // Use deployed address if provided, otherwise fall back to default
  const groupManagerAddress = (deployedGroupManager || CONTRACT_ADDRESSES.GROUP_MANAGER) as `0x${string}`;

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  // Check if group exists and if it's frozen
  const { data: semaphoreGroupId } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'semaphoreGroupOf',
    args: [BigInt(contextId)],
  });

  const { data: isFrozen } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'isFrozen',
    args: [BigInt(contextId)],
  });

  const groupExists = semaphoreGroupId && semaphoreGroupId.toString() !== '0';

  useEffect(() => {
    if (isSuccess && receipt) {
      setLoading(false);
    }
  }, [isSuccess, receipt]);

  useEffect(() => {
    if (writeError || receiptError) {
      setLoading(false);
    }
  }, [writeError, receiptError]);

  const handleCreate = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      writeContract({
        address: groupManagerAddress,
        abi: GROUP_MANAGER_ABI,
        functionName: 'createGroup',
        args: [BigInt(contextId), address as `0x${string}`],
      });
    } catch (error) {
      setLoading(false);
    }
  };

  if (isSuccess || groupExists) {
    return (
      <div className={`p-6 border-2 rounded-lg shadow-sm ${isFrozen ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
        <h3 className={`text-lg font-semibold mb-3 ${isFrozen ? 'text-orange-800' : 'text-green-800'}`}>
          {isFrozen ? '🔒 Group Frozen' : '✅ Group Created!'}
        </h3>
        <div className="space-y-2 text-sm">
          <p className={isFrozen ? 'text-orange-800' : 'text-green-800'}>
            <strong className={isFrozen ? 'text-orange-900' : 'text-green-900'}>Context ID:</strong> <span className="font-mono">{contextId}</span>
          </p>
          {hash && (
            <p className={isFrozen ? 'text-orange-800' : 'text-green-800'}>
              <strong className={isFrozen ? 'text-orange-900' : 'text-green-900'}>Transaction:</strong> <span className="font-mono text-xs">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
            </p>
          )}
          <p className={`text-xs mt-3 pt-3 border-t ${isFrozen ? 'text-orange-700 border-orange-200' : 'text-green-700 border-green-200'}`}>
            {isFrozen 
              ? '🔒 The group is frozen. No more members can be added. You can now generate ZK proofs.'
              : '👥 Group is ready. You can now add members.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <div className="space-y-4">
        <p className="text-gray-700">
          Create a Semaphore group for this event. You will be the admin and can add members.
        </p>
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">
          <strong>GroupManager Address:</strong> <span className="font-mono">{groupManagerAddress}</span>
          {deployedGroupManager && (
            <span className="ml-2 text-green-600">✓ Using deployed address</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || isConfirming || loading || !address}
          className="w-full bg-indigo-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending || isConfirming || loading ? 'Creating...' : 'Create Group'}
        </button>
        {(writeError || receiptError) && (
          <div className="p-3 bg-red-50 border-2 border-red-300 rounded-md">
            <p className="text-sm text-red-800 font-medium mb-1">
              ⚠️ Error creating group
            </p>
            <p className="text-xs text-red-700">
              {writeError?.message || receiptError?.message || 'Transaction failed'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

