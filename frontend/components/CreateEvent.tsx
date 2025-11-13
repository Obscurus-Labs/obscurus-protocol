'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, NFT_FACTORY_ABI } from '@/lib/contracts';

export function CreateEvent({
  contextId,
  deployedNFTFactory,
}: {
  contextId: string;
  onContextIdChange?: (id: string) => void;
  deployedNFTFactory?: string | null;
}) {
  const [eventName, setEventName] = useState('VIP Concert');
  const [loading, setLoading] = useState(false);
  const [useCustomFactory, setUseCustomFactory] = useState(false);
  const [customFactoryAddress, setCustomFactoryAddress] = useState<string>('');
  const { address } = useAccount();

  // Determine which factory address to use
  const effectiveFactoryAddress = useCustomFactory && customFactoryAddress
    ? customFactoryAddress
    : (deployedNFTFactory || CONTRACT_ADDRESSES.NFT_FACTORY);
  
  const nftFactoryAddress = effectiveFactoryAddress as `0x${string}`;
  
  const { data: ownerAddress } = useReadContract({
    address: nftFactoryAddress,
    abi: NFT_FACTORY_ABI,
    functionName: 'owner',
    query: {
      enabled: !!nftFactoryAddress && /^0x[a-fA-F0-9]{40}$/.test(nftFactoryAddress),
    },
  });


  // Check if user is owner (only true if both address and ownerAddress are loaded and match)
  const isOwner = address && ownerAddress && address.toLowerCase() === (ownerAddress as string).toLowerCase();

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });
  
  // Button should be disabled if:
  // - No address connected
  // - Owner address not loaded yet
  // - Not the owner
  const isButtonDisabled = !address || !ownerAddress || !isOwner || isPending || isConfirming || loading || (useCustomFactory && (!customFactoryAddress || !/^0x[a-fA-F0-9]{40}$/.test(customFactoryAddress)));

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

    if (!isOwner) {
      alert(`Only the contract owner can create events.\n\nOwner address: ${ownerAddress}\nYour address: ${address}\n\nPlease switch to the owner account in MetaMask.`);
      return;
    }

    if (useCustomFactory && (!customFactoryAddress || !/^0x[a-fA-F0-9]{40}$/.test(customFactoryAddress))) {
      alert('Please enter a valid NFTFactory address');
      return;
    }

    setLoading(true);
    try {
      writeContract({
        address: nftFactoryAddress,
        abi: NFT_FACTORY_ABI,
        functionName: 'createCollection',
        args: [
          BigInt(contextId),
          eventName,
          'TICKET',
          'https://example.com/metadata/',
          'https://example.com/contract',
          address as `0x${string}`,
        ],
      });
    } catch {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="p-6 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          ✅ Event Created!
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-green-800">
            <strong className="text-green-900">Context ID:</strong> <span className="font-mono">{contextId}</span>
          </p>
          <p className="text-green-800">
            <strong className="text-green-900">Event Name:</strong> {eventName}
          </p>
          <p className="text-green-800">
            <strong className="text-green-900">Transaction:</strong> <span className="font-mono text-xs">{hash?.slice(0, 10)}...{hash?.slice(-8)}</span>
          </p>
          <p className="text-xs text-green-700 mt-3 pt-3 border-t border-green-200">
            NFT Collection created successfully. You can now add members to the group.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <div className="space-y-4">
        {/* NFTFactory Address Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use-custom-factory"
              checked={useCustomFactory}
              onChange={(e) => setUseCustomFactory(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="use-custom-factory" className="text-sm font-medium text-gray-700">
              Use custom NFTFactory address
            </label>
          </div>
          {useCustomFactory && (
            <div>
              <label htmlFor="factory-address" className="block text-xs text-gray-600 mb-1">
                NFTFactory Address
              </label>
              <input
                id="factory-address"
                type="text"
                value={customFactoryAddress}
                onChange={(e) => setCustomFactoryAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
          {!useCustomFactory && (
            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 p-2 rounded">
              <strong>Using:</strong>{' '}
              {deployedNFTFactory ? (
                <span className="font-mono">Deployed Factory ({deployedNFTFactory.slice(0, 10)}...{deployedNFTFactory.slice(-8)})</span>
              ) : (
                <span className="font-mono">Default ({CONTRACT_ADDRESSES.NFT_FACTORY.slice(0, 10)}...{CONTRACT_ADDRESSES.NFT_FACTORY.slice(-8)})</span>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="event-name" className="block text-sm font-medium text-gray-700 mb-2">
            Event Name
          </label>
          <input
            id="event-name"
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="VIP Concert"
          />
        </div>
        {ownerAddress && !isOwner && (
          <div className="p-3 bg-yellow-50 border-2 border-yellow-300 rounded-md mb-4">
            <p className="text-sm text-yellow-800 font-medium mb-1">
              ⚠️ Only contract owner can create events
            </p>
            <p className="text-xs text-yellow-700">
              <strong>NFTFactory Address:</strong> <span className="font-mono">{nftFactoryAddress.slice(0, 10)}...{nftFactoryAddress.slice(-8)}</span>
            </p>
            <p className="text-xs text-yellow-700">
              <strong>Owner:</strong> <span className="font-mono">{(ownerAddress as string).slice(0, 10)}...{(ownerAddress as string).slice(-8)}</span>
            </p>
            <p className="text-xs text-yellow-700">
              <strong>Your address:</strong> <span className="font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
            </p>
            <p className="text-xs text-yellow-700 mt-2 pt-2 border-t border-yellow-200">
              💡 <strong>Solution:</strong> Deploy a new NFTFactory from the "Deploy Contracts" section above, or switch to the owner account in MetaMask.
            </p>
          </div>
        )}
        {!ownerAddress && address && (
          <div className="p-3 bg-gray-50 border-2 border-gray-300 rounded-md mb-4">
            <p className="text-sm text-gray-800 font-medium">
              ⏳ Loading contract owner...
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleCreate}
          disabled={isButtonDisabled}
          className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending || isConfirming || loading
            ? 'Creating...'
            : 'Create Event'}
        </button>
        {(writeError || receiptError) && (
          <p className="text-sm text-red-600 font-medium mt-2">
            ⚠️ Error: {writeError?.message || receiptError?.message || 'Transaction failed'}
          </p>
        )}
        <p className="text-xs text-gray-600">
          Using Context ID: <span className="font-mono font-semibold text-gray-900">{contextId}</span>
        </p>
      </div>
    </div>
  );
}

