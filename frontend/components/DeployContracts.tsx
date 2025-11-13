'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, useWaitForTransactionReceipt, useSendTransaction } from 'wagmi';
import { parseAbi, encodeDeployData } from 'viem';
import contractsBytecode from '@/lib/contracts-bytecode.json';

// BaseNFT constructor: no parameters
const BASE_NFT_ABI = parseAbi(['constructor()']);

// NFTFactory constructor: takes address implementation
const NFT_FACTORY_ABI = parseAbi(['constructor(address impl)']);

export function DeployContracts({
  onContractsDeployed,
}: {
  onContractsDeployed?: (baseNFT: string, nftFactory: string) => void;
}) {
  const [baseNFTAddress, setBaseNFTAddress] = useState<string | null>(null);
  const [nftFactoryAddress, setNftFactoryAddress] = useState<string | null>(null);
  const [baseNFTHash, setBaseNFTHash] = useState<`0x${string}` | null>(null);
  const [factoryHash, setFactoryHash] = useState<`0x${string}` | null>(null);
  const [isDeployingBaseNFT, setIsDeployingBaseNFT] = useState(false);
  const [isDeployingFactory, setIsDeployingFactory] = useState(false);
  const [baseNFTError, setBaseNFTError] = useState<Error | null>(null);
  const [factoryError, setFactoryError] = useState<Error | null>(null);
  const [useExistingBaseNFT, setUseExistingBaseNFT] = useState(false);
  const [existingBaseNFTAddress, setExistingBaseNFTAddress] = useState<string>('');
  
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const { sendTransaction, isPending: isSendingTransaction } = useSendTransaction();

  const {
    isLoading: isConfirmingBaseNFT,
    isSuccess: isBaseNFTDeployed,
    data: baseNFTReceipt,
  } = useWaitForTransactionReceipt({
    hash: baseNFTHash || undefined,
  });

  const {
    isLoading: isConfirmingFactory,
    isSuccess: isFactoryDeployed,
    data: factoryReceipt,
  } = useWaitForTransactionReceipt({
    hash: factoryHash || undefined,
  });

  useEffect(() => {
    if (isBaseNFTDeployed && baseNFTReceipt) {
      const deployedAddress = baseNFTReceipt.contractAddress;
      if (deployedAddress) {
        setBaseNFTAddress(deployedAddress);
        setIsDeployingBaseNFT(false);
      }
    }
  }, [isBaseNFTDeployed, baseNFTReceipt]);

  useEffect(() => {
    if (isFactoryDeployed && factoryReceipt) {
      const deployedAddress = factoryReceipt.contractAddress;
      if (deployedAddress) {
        setNftFactoryAddress(deployedAddress);
        setIsDeployingFactory(false);
        if (onContractsDeployed && baseNFTAddress) {
          onContractsDeployed(baseNFTAddress, deployedAddress);
        }
      }
    }
  }, [isFactoryDeployed, factoryReceipt, baseNFTAddress, onContractsDeployed]);

  const handleDeployBaseNFT = () => {
    if (!contractsBytecode.baseNFT || !address) {
      alert('Please connect your wallet and wait for bytecode to load.');
      return;
    }

    setIsDeployingBaseNFT(true);
    setBaseNFTError(null);

    try {
      const deployData = encodeDeployData({
        abi: BASE_NFT_ABI,
        bytecode: contractsBytecode.baseNFT as `0x${string}`,
        args: [],
      });

      sendTransaction(
        {
          data: deployData,
        },
        {
          onSuccess: (hash) => {
            setBaseNFTHash(hash);
          },
          onError: (error) => {
            setBaseNFTError(error);
            setIsDeployingBaseNFT(false);
          },
        }
      );
    } catch (error) {
      setBaseNFTError(error as Error);
      setIsDeployingBaseNFT(false);
    }
  };

  const handleUseExistingBaseNFT = () => {
    if (!existingBaseNFTAddress) {
      alert('Please enter a BaseNFT address');
      return;
    }

    // Basic address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(existingBaseNFTAddress)) {
      alert('Invalid address format');
      return;
    }

    setBaseNFTAddress(existingBaseNFTAddress as `0x${string}`);
  };

  const handleDeployFactory = () => {
    if (!contractsBytecode.nftFactory || !baseNFTAddress || !address) {
      alert('BaseNFT address is required!');
      return;
    }

    setIsDeployingFactory(true);
    setFactoryError(null);

    try {
      const deployData = encodeDeployData({
        abi: NFT_FACTORY_ABI,
        bytecode: contractsBytecode.nftFactory as `0x${string}`,
        args: [baseNFTAddress as `0x${string}`],
      });

      sendTransaction(
        {
          data: deployData,
        },
        {
          onSuccess: (hash) => {
            setFactoryHash(hash);
          },
          onError: (error) => {
            setFactoryError(error);
            setIsDeployingFactory(false);
          },
        }
      );
    } catch (error) {
      setFactoryError(error as Error);
      setIsDeployingFactory(false);
    }
  };

  if (isFactoryDeployed && nftFactoryAddress) {
    return (
      <div className="p-6 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          ✅ Contracts Deployed!
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-green-800">
            <strong className="text-green-900">BaseNFT:</strong>{' '}
            <span className="font-mono text-xs">{baseNFTAddress}</span>
          </p>
          <p className="text-green-800">
            <strong className="text-green-900">NFTFactory:</strong>{' '}
            <span className="font-mono text-xs">{nftFactoryAddress}</span>
          </p>
          <p className="text-xs text-green-700 mt-3 pt-3 border-t border-green-200">
            🎉 You are now the owner of NFTFactory! You can create events.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <div className="space-y-4">
        <p className="text-gray-700">
          Deploy the contracts to become the owner. This allows you to create events.
        </p>

        {/* BaseNFT Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">1. BaseNFT Address</p>
            {baseNFTAddress && (
              <p className="text-xs text-green-700 font-mono">
                ✓ {baseNFTAddress.slice(0, 10)}...{baseNFTAddress.slice(-8)}
              </p>
            )}
          </div>

          {!baseNFTAddress && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="use-existing-base-nft"
                  checked={useExistingBaseNFT}
                  onChange={(e) => setUseExistingBaseNFT(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="use-existing-base-nft" className="text-sm text-gray-700">
                  Use existing BaseNFT address
                </label>
              </div>

              {useExistingBaseNFT ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={existingBaseNFTAddress}
                    onChange={(e) => setExistingBaseNFTAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleUseExistingBaseNFT}
                    disabled={!existingBaseNFTAddress || isSendingTransaction}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Use Address
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDeployBaseNFT}
                  disabled={isDeployingBaseNFT || isConfirmingBaseNFT || isSendingTransaction || !contractsBytecode.baseNFT}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeployingBaseNFT || isConfirmingBaseNFT ? 'Deploying...' : 'Deploy BaseNFT'}
                </button>
              )}
            </>
          )}

          {baseNFTError && (
            <p className="text-xs text-red-600 font-medium">⚠️ Error: {baseNFTError.message}</p>
          )}
        </div>

        {/* Deploy NFTFactory */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">2. Deploy NFTFactory</p>
              {nftFactoryAddress && (
                <p className="text-xs text-green-700 font-mono mt-1">
                  ✓ Deployed: {nftFactoryAddress.slice(0, 10)}...{nftFactoryAddress.slice(-8)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDeployFactory}
              disabled={
                !baseNFTAddress ||
                isDeployingFactory ||
                isConfirmingFactory ||
                isSendingTransaction ||
                !!nftFactoryAddress ||
                !contractsBytecode.nftFactory
              }
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeployingFactory || isConfirmingFactory ? 'Deploying...' : 'Deploy NFTFactory'}
            </button>
          </div>
          {factoryError && (
            <p className="text-xs text-red-600 font-medium">⚠️ Error: {factoryError.message}</p>
          )}
        </div>

        {!contractsBytecode.baseNFT && (
          <p className="text-xs text-gray-500">Loading contract bytecodes...</p>
        )}
      </div>
    </div>
  );
}

