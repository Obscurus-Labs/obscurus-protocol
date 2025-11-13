'use client';

import { useState } from 'react';
import { generateIdentity, type Identity } from '@/lib/zk';

export function GenerateIdentity({
  onIdentityGenerated,
}: {
  onIdentityGenerated: (identity: Identity) => void;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const newIdentity = await generateIdentity();
      setIdentity(newIdentity);
      onIdentityGenerated(newIdentity);
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  if (identity) {
    return (
      <div className="p-6 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          ✅ Identity Generated
        </h3>
        <p className="text-sm text-green-700 mb-3">
          Your identity is stored locally and never shared.
        </p>
        <div className="text-xs font-mono bg-white border border-green-200 p-3 rounded space-y-1.5 mb-3">
          <div className="text-gray-900"><strong className="text-green-900">Commitment:</strong> {identity.commitment.toString().slice(0, 30)}...</div>
          <div className="text-gray-900"><strong className="text-green-900">Nullifier:</strong> {identity.nullifier.toString().slice(0, 30)}...</div>
        </div>
        <p className="text-xs text-green-700 pt-3 border-t border-green-200">
          💡 This identity will be used to generate ZK proofs without revealing your identity.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      <p className="text-gray-700 mb-4">
        Generate a private identity for ZK proof generation. This is done
        locally and never shared.
      </p>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-purple-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Generating...' : 'Generate Identity'}
      </button>
    </div>
  );
}

