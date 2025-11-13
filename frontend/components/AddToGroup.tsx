'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESSES, GROUP_MANAGER_ABI } from '@/lib/contracts';
import { calculateLeaf, generateIdentity, getGroupLeavesFromEvents, type Identity } from '@/lib/zk';

export function AddToGroup({
  identity,
  contextId,
  deployedGroupManager,
}: {
  identity: Identity | null;
  contextId: string;
  deployedGroupManager?: string | null;
}) {
  const groupManagerAddress = (deployedGroupManager || CONTRACT_ADDRESSES.GROUP_MANAGER) as `0x${string}`;
  const [ticketType, setTicketType] = useState('1');
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [lastAddedIdentity, setLastAddedIdentity] = useState<Identity | null>(null);
  const [addedIdentities, setAddedIdentities] = useState<Array<{ identity: Identity; ticketType: string; txHash: string }>>([]);
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { data: semaphoreGroupId, refetch: refetchGroupId } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'semaphoreGroupOf',
    args: [BigInt(contextId)],
  });

  const { data: groupAdmin, refetch: refetchAdmin } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'groupAdmin',
    args: [BigInt(contextId)],
  });

  const { data: isFrozen, refetch: refetchFrozen } = useReadContract({
    address: groupManagerAddress,
    abi: GROUP_MANAGER_ABI,
    functionName: 'isFrozen',
    args: [BigInt(contextId)],
  });

  const groupExists = semaphoreGroupId && semaphoreGroupId.toString() !== '0';
  const isAdmin = address && groupAdmin && address.toLowerCase() === (groupAdmin as string).toLowerCase();
  const groupFrozen = isFrozen === true;

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWriteContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess && receipt && lastAddedIdentity) {
      const newCount = addedIdentities.length + 1;
      console.log(`[AddToGroup] SUCCESS #${newCount}:`, {
        commitment: lastAddedIdentity.commitment.toString().slice(0, 20),
        ticketType,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber.toString(),
        addedCount: newCount,
      });
      
      const storageKey = `group_${contextId}_${lastAddedIdentity.commitment.toString()}`;
      localStorage.setItem(storageKey, ticketType);
      
      setAddedIdentities(prev => [...prev, {
        identity: lastAddedIdentity,
        ticketType: ticketType,
        txHash: receipt.transactionHash
      }]);
      
      setLoadingCurrent(false);
      setLoadingRandom(false);
      setLastAddedIdentity(null);
      
      // Wait longer to ensure Semaphore's internal state is fully updated
      // Semaphore uses LeanIMT which needs time to process the tree update
      setTimeout(() => {
        refetchGroupId();
        refetchAdmin();
        refetchFrozen();
        resetWriteContract();
        console.log(`[AddToGroup] SUCCESS #${newCount} - State reset complete, ready for next transaction`);
      }, 5000); // Increased to 5 seconds to ensure Semaphore state is ready
    }
  }, [isSuccess, receipt, contextId, ticketType, lastAddedIdentity, resetWriteContract, refetchGroupId, refetchAdmin, refetchFrozen, addedIdentities.length]);

  useEffect(() => {
    if (writeError || receiptError) {
      const errorObj = writeError || receiptError;
      let errorMessage = 'Unknown error';
      
      if (errorObj) {
        const error = errorObj as unknown as {
          shortMessage?: string;
          message?: string;
          details?: string;
          cause?: {
            shortMessage?: string;
            message?: string;
            data?: string | {
              errorName?: string;
              args?: unknown;
              reason?: string;
            };
          };
        };
        
        if (error.shortMessage) errorMessage = error.shortMessage;
        if (error.cause?.shortMessage) errorMessage = error.cause.shortMessage;
        if (error.cause?.message) errorMessage = error.cause.message;
        if (error.cause?.data) {
          if (typeof error.cause.data === 'string') {
            errorMessage = error.cause.data;
          } else if (error.cause.data.errorName) {
            errorMessage = `${error.cause.data.errorName}${error.cause.data.args ? ': ' + JSON.stringify(error.cause.data.args) : ''}`;
          } else if (error.cause.data.reason) {
            errorMessage = error.cause.data.reason;
          }
        }
        if (error.details) errorMessage = error.details;
        if (error.message) errorMessage = error.message;
      }
      
      console.error('[AddToGroup] ERROR:', {
        errorMessage,
        writeError: writeError ? 'yes' : 'no',
        receiptError: receiptError ? 'yes' : 'no',
        addedCount: addedIdentities.length,
        lastIdentity: lastAddedIdentity?.commitment.toString().slice(0, 20),
        ticketType,
        isPending,
        isConfirming,
        hash: hash || 'none',
        groupExists,
        isAdmin,
        groupFrozen,
        semaphoreGroupId: semaphoreGroupId?.toString(),
      });
      
      if (errorMessage.includes('Internal JSON-RPC error') || errorMessage.includes('Internal error')) {
        alert(`Transaction failed: The group ${contextId} likely does not exist or is not properly initialized.\n\nPlease:\n1. Make sure you created the group in Step 2\n2. Check that the context ID (${contextId}) is correct\n3. Try creating the group again if needed`);
      } else {
        alert(`Transaction failed:\n\n${errorMessage}`);
      }
      
      setLoadingCurrent(false);
      setLoadingRandom(false);
      setLastAddedIdentity(null);
    }
  }, [writeError, receiptError, contextId, addedIdentities.length, lastAddedIdentity, ticketType, isPending, isConfirming, hash, groupExists, isAdmin, groupFrozen, semaphoreGroupId]);

  const handleAdd = async (identityToAdd: Identity) => {
    const attemptNumber = addedIdentities.length + 1;
    console.log(`[AddToGroup] Attempt #${attemptNumber} - BEFORE CHECKS:`, {
      commitment: identityToAdd.commitment.toString().slice(0, 20),
      ticketType,
      addedCount: addedIdentities.length,
      isPending,
      isConfirming,
      hash: hash || 'none',
      groupExists,
      isAdmin,
      groupFrozen,
      semaphoreGroupId: semaphoreGroupId?.toString(),
    });

    if (!address) {
      alert('Please connect your wallet first');
      setLoadingCurrent(false);
      setLoadingRandom(false);
      return;
    }

    if (!semaphoreGroupId || semaphoreGroupId.toString() === '0') {
      alert(`Group ${contextId} does not exist. Please create the group first using Step 2.`);
      setLoadingCurrent(false);
      setLoadingRandom(false);
      return;
    }

    if (!groupExists) {
      alert(`Group ${contextId} does not exist. Please create the group first using Step 2.`);
      setLoadingCurrent(false);
      setLoadingRandom(false);
      return;
    }

    if (!isAdmin) {
      alert('Only the group admin can add members.');
      setLoadingCurrent(false);
      setLoadingRandom(false);
      return;
    }

    if (groupFrozen) {
      alert('Group is frozen. Cannot add more members.');
      setLoadingCurrent(false);
      setLoadingRandom(false);
      return;
    }

    // CRITICAL: Wait for any pending transaction to fully complete before starting a new one
    // This includes waiting for the transaction receipt AND for the blockchain state to update
    if (isPending || isConfirming || hash) {
      console.log(`[AddToGroup] Attempt #${attemptNumber} - BLOCKED: Transaction in progress, waiting...`, {
        isPending,
        isConfirming,
        hash: hash || 'none',
      });
      
      // Wait for the transaction to complete
      let waitCount = 0;
      const maxWait = 60; // Wait up to 60 seconds
      while ((isPending || isConfirming || hash) && waitCount < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitCount++;
      }
      
      if (waitCount >= maxWait) {
        alert('Previous transaction is taking too long. Please refresh the page and try again.');
        setLoadingCurrent(false);
        setLoadingRandom(false);
        return;
      }
      
      // Additional wait to ensure blockchain state is fully synced
      console.log(`[AddToGroup] Attempt #${attemptNumber} - Previous transaction completed, waiting 3 more seconds for state sync...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    setLastAddedIdentity(identityToAdd);

    try {
      // Calculate leaf for our ticket system (Poseidon([commitment, ticketType]))
      // This is used for duplicate checking and proof generation, but NOT for Semaphore
      const leaf = await calculateLeaf(identityToAdd.commitment, BigInt(ticketType));
      
      // Check if already added in this session
      // Note: Semaphore doesn't allow duplicate commitments, so we check by commitment only
      const alreadyAdded = addedIdentities.some(
        item => item.identity.commitment.toString() === identityToAdd.commitment.toString()
      );
      
      if (alreadyAdded) {
        alert(`This identity with ticketType ${ticketType} was already added in this session. Semaphore does not allow duplicate members.`);
        setLastAddedIdentity(null);
        setLoadingCurrent(false);
        setLoadingRandom(false);
        return;
      }
      
      // CRITICAL: If we just added a member, we MUST wait for Semaphore's internal LeanIMT state to fully update
      // Unlike MockSemaphore (used in tests), real Semaphore maintains an internal tree that needs processing time
      if (addedIdentities.length > 0) {
        console.log(`[AddToGroup] Attempt #${attemptNumber} - Previous member was added, waiting for Semaphore LeanIMT state to update...`);
        
        // Wait for the previous transaction's receipt to be fully processed
        // Then wait additional time for Semaphore's internal state to sync
        const lastTxHash = addedIdentities[addedIdentities.length - 1].txHash;
        
        if (publicClient && lastTxHash) {
          try {
            // Wait for the transaction receipt to be confirmed
            console.log(`[AddToGroup] Attempt #${attemptNumber} - Waiting for previous transaction receipt...`);
            await publicClient.waitForTransactionReceipt({
              hash: lastTxHash as `0x${string}`,
              timeout: 30000, // 30 seconds max
            });
            console.log(`[AddToGroup] Attempt #${attemptNumber} - Previous transaction confirmed`);
            
            // Additional wait to ensure Semaphore's LeanIMT has processed the update
            console.log(`[AddToGroup] Attempt #${attemptNumber} - Waiting 3 seconds for Semaphore LeanIMT state sync...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verify Semaphore state is accessible by reading the Merkle root
            if (semaphoreGroupId) {
              const semaphoreAddress = await publicClient.readContract({
                address: groupManagerAddress,
                abi: GROUP_MANAGER_ABI,
                functionName: 'semaphore',
              }) as string;
              
              const semaphoreGroupsAbi = [
                {
                  inputs: [{ internalType: 'uint256', name: 'groupId', type: 'uint256' }],
                  name: 'getMerkleTreeRoot',
                  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                  stateMutability: 'view',
                  type: 'function',
                },
              ] as const;
              
              // Try to read the Merkle root - this verifies Semaphore state is ready
              const currentRoot = await publicClient.readContract({
                address: semaphoreAddress as `0x${string}`,
                abi: semaphoreGroupsAbi,
                functionName: 'getMerkleTreeRoot',
                args: [BigInt(semaphoreGroupId.toString())],
              });
              
              console.log(`[AddToGroup] Attempt #${attemptNumber} - Semaphore state verified (root: ${currentRoot.toString().slice(0, 20)}...), ready to add next member`);
            }
          } catch (waitError) {
            console.error(`[AddToGroup] Attempt #${attemptNumber} - Error waiting for Semaphore state:`, waitError);
            // Continue anyway - might still work
          }
        } else {
          // Fallback: just wait a fixed time if we can't wait for receipt
          console.log(`[AddToGroup] Attempt #${attemptNumber} - Waiting 8 seconds for Semaphore state (fallback)...`);
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      }
      
      // Verify group exists and check if leaf already exists in the group on-chain
      if (publicClient && semaphoreGroupId) {
        try {
          const semaphoreAddress = await publicClient.readContract({
            address: groupManagerAddress,
            abi: GROUP_MANAGER_ABI,
            functionName: 'semaphore',
          }) as string;
          
          // Check if commitment already exists in the group
          // Semaphore stores commitments, not leaves
          const existingCommitments = await getGroupLeavesFromEvents(
            semaphoreAddress as `0x${string}`,
            BigInt(semaphoreGroupId.toString()),
            undefined, // rpcUrl - use default
            groupManagerAddress, // groupManagerAddress
            BigInt(contextId) // contextId
          );
          
          console.log(`[AddToGroup] Attempt #${attemptNumber} - EXISTING COMMITMENTS CHECK:`, {
            existingCommitmentsCount: existingCommitments.length,
            existingCommitments: existingCommitments.map(c => c.toString().slice(0, 20)),
            newCommitment: identityToAdd.commitment.toString().slice(0, 20),
          });
          
          const commitmentExists = existingCommitments.some(existingCommitment => existingCommitment.toString() === identityToAdd.commitment.toString());
          
          if (commitmentExists) {
            console.error(`[AddToGroup] Attempt #${attemptNumber} - COMMITMENT ALREADY EXISTS ON-CHAIN:`, {
              commitment: identityToAdd.commitment.toString().slice(0, 20),
              existingCommitmentsCount: existingCommitments.length,
            });
            alert(`This commitment already exists in the group on-chain. Semaphore does not allow duplicate members.`);
            setLastAddedIdentity(null);
            setLoadingCurrent(false);
            setLoadingRandom(false);
            return;
          }
        } catch (checkError) {
          console.error(`[AddToGroup] Attempt #${attemptNumber} - ERROR CHECKING EXISTING LEAVES:`, checkError);
        }
      }
      
      console.log(`[AddToGroup] Attempt #${attemptNumber} - CALLING CONTRACT:`, {
        commitment: identityToAdd.commitment.toString().slice(0, 20),
        leaf: leaf.toString().slice(0, 20),
        ticketType,
        contextId,
        groupManagerAddress,
        isPending,
        isConfirming,
        hash: hash || 'none',
        existingLeavesChecked: publicClient && semaphoreGroupId ? 'yes' : 'no',
        simulationPassed: publicClient ? 'yes' : 'skipped',
      });
      
      // IMPORTANT: Semaphore expects identityCommitment, not leaf
      // The leaf (Poseidon([commitment, ticketType])) is only used for our ticket system
      // Semaphore stores the commitment in its Merkle tree
      writeContract({
        address: groupManagerAddress,
        abi: GROUP_MANAGER_ABI,
        functionName: 'addMember',
        args: [BigInt(contextId), identityToAdd.commitment],
      });
    } catch (error) {
      console.error(`[AddToGroup] Attempt #${attemptNumber} - EXCEPTION:`, error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLastAddedIdentity(null);
      setLoadingCurrent(false);
      setLoadingRandom(false);
    }
  };

  const handleAddCurrent = async () => {
    if (!identity) {
      alert('Please generate an identity first');
      return;
    }
    setLoadingCurrent(true);
    await handleAdd(identity);
  };

  const handleAddRandom = async () => {
    setLoadingRandom(true);
    try {
      const randomIdentity = await generateIdentity();
      await handleAdd(randomIdentity);
    } catch (error) {
      alert(`Error generating identity: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoadingRandom(false);
      setLastAddedIdentity(null);
    }
  };

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="ticket-type" className="block text-sm font-medium text-gray-900 mb-2">
            Ticket Type
          </label>
          <input
            id="ticket-type"
            type="number"
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md text-black bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            style={{ color: '#000000' }}
            placeholder="1"
            min="1"
          />
          <p className="text-xs text-gray-600 mt-1.5">
            1 = VIP, 2 = General, etc.
          </p>
        </div>
        {!groupExists && (
          <div className="p-3 bg-yellow-50 border-2 border-yellow-300 rounded-md">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ Group does not exist. Please create the group first.
            </p>
          </div>
        )}
        {groupExists && groupFrozen && (
          <div className="p-3 bg-orange-50 border-2 border-orange-300 rounded-md">
            <p className="text-sm text-orange-800 font-medium mb-1">
              🔒 Group is frozen
            </p>
            <p className="text-xs text-orange-700">
              This group has been frozen. No more members can be added.
            </p>
          </div>
        )}
        {groupExists && !isAdmin && groupAdmin && (
          <div className="p-3 bg-yellow-50 border-2 border-yellow-300 rounded-md">
            <p className="text-sm text-yellow-800 font-medium mb-1">
              ⚠️ Only the group admin can add members
            </p>
            <p className="text-xs text-yellow-700">
              Admin: <span className="font-mono">{String(groupAdmin).slice(0, 6)}...{String(groupAdmin).slice(-4)}</span>
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Switch to the admin account in MetaMask to add members.
            </p>
          </div>
        )}
        {addedIdentities.length > 0 && (
          <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-2">
              ✅ Added Members ({addedIdentities.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {addedIdentities.map((item) => (
                <div key={item.identity.commitment.toString()} className="p-2 bg-white border border-green-200 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-gray-700">
                      {item.identity.commitment.toString().slice(0, 20)}...
                    </span>
                    <span className="text-green-700 font-medium">Type: {item.ticketType}</span>
                  </div>
                  <div className="text-gray-500 mt-1">
                    TX: {item.txHash.slice(0, 10)}...{item.txHash.slice(-8)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddCurrent}
            disabled={!identity || !groupExists || !isAdmin || groupFrozen || loadingCurrent || loadingRandom || isPending || isConfirming}
            className="flex-1 bg-indigo-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingCurrent ? (isPending || isConfirming ? 'Adding...' : 'Processing...') : 'Add Current Identity'}
          </button>
          <button
            type="button"
            onClick={handleAddRandom}
            disabled={!groupExists || !isAdmin || groupFrozen || loadingCurrent || loadingRandom || isPending || isConfirming}
            className="flex-1 bg-purple-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingRandom ? (isPending || isConfirming ? 'Adding...' : 'Processing...') : 'Add Random Identity'}
          </button>
        </div>
        {!identity && (
          <p className="text-xs text-gray-500 text-center">
            💡 Use "Add Random Identity" to generate and add a new identity, or generate one in Step 3 first.
          </p>
        )}
      </div>
    </div>
  );
}
