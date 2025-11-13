'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { CONTRACT_ADDRESSES, ZK_VERIFIER_ABI } from '@/lib/contracts';
import { type ProofData } from '@/lib/zk';

export function VerifyProof({
  contextId,
  proofData,
  proofArray,
  deployedZKVerifier,
}: {
  contextId: string;
  proofData: ProofData | null;
  proofArray: bigint[];
  deployedZKVerifier?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  // Use deployed address if provided, otherwise fall back to default
  const zkVerifierAddress = (deployedZKVerifier || CONTRACT_ADDRESSES.ZK_VERIFIER) as `0x${string}`;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  useWatchContractEvent({
    address: zkVerifierAddress,
    abi: ZK_VERIFIER_ABI,
    eventName: 'AccessGranted',
    onLogs() {
      setVerified(true);
    },
  });

  const handleVerify = async () => {
    if (!proofData || proofArray.length !== 8) {
      alert('Please generate a proof first');
      return;
    }

    const verifyArgs = [
      BigInt(contextId),
      1n,
      proofData.nullifierHash,
      proofArray as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
    ];

    setLoading(true);
    try {
      writeContract({
        address: zkVerifierAddress,
        abi: ZK_VERIFIER_ABI,
        functionName: 'verifyZKProof',
        args: verifyArgs,
      });
    } catch (error) {
      setLoading(false);
    }
  };

  if (verified || isSuccess) {
    return (
      <div className="p-6 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          ✅ Proof Verified!
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-green-700 mb-3">
            Your ZK proof has been verified on-chain. Access granted!
          </p>
          {hash && (
            <div className="space-y-1.5 mb-3">
              <p className="text-green-800">
                <strong className="text-green-900">Transaction:</strong> <span className="font-mono text-xs">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
              </p>
              {proofData && (
                <p className="text-green-800">
                  <strong className="text-green-900">Nullifier Hash:</strong> <span className="font-mono text-xs">{proofData.nullifierHash.toString().slice(0, 20)}...</span>
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-green-700 pt-3 border-t border-green-200">
            🎉 Your identity was verified without being revealed. The nullifier prevents double-spending.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <p className="text-gray-700 mb-4">
        Submit your ZK proof to the smart contract for verification.
      </p>
      <button
        type="button"
        onClick={handleVerify}
        disabled={!proofData || isPending || isConfirming || loading}
        className="w-full bg-green-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending || isConfirming || loading
          ? 'Verifying...'
          : 'Verify Proof'}
      </button>
      {!proofData && (
        <p className="text-sm text-red-600 font-medium mt-2">
          ⚠️ Please generate a proof first
        </p>
      )}
    </div>
  );
}

