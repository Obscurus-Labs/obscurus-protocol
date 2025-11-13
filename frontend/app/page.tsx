'use client';

import { useState } from 'react';
import { WalletButton } from '@/components/WalletButton';
import { DeployContracts } from '@/components/DeployContracts';
import { CreateEvent } from '@/components/CreateEvent';
import { CreateGroup } from '@/components/CreateGroup';
import { GenerateIdentity } from '@/components/GenerateIdentity';
import { AddToGroup } from '@/components/AddToGroup';
import { GenerateProof } from '@/components/GenerateProof';
import { VerifyProof } from '@/components/VerifyProof';
import { FreezeGroup } from '@/components/FreezeGroup';
import { type Identity, type ProofData } from '@/lib/zk';
import { CONTRACT_ADDRESSES } from '@/lib/contracts';

export default function Home() {
  const [contextId, setContextId] = useState('1');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [proofArray, setProofArray] = useState<bigint[]>([]);
  const [deployedNFTFactory, setDeployedNFTFactory] = useState<string | null>(null);
  const [deployedGroupManager, setDeployedGroupManager] = useState<string | null>(null);
  const [deployedZKVerifier, setDeployedZKVerifier] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎫 ZK Tickets
          </h1>
          <p className="text-gray-600">
            Privacy-Preserving Ticketing with Zero-Knowledge Proofs
          </p>
          <div className="mt-4 flex justify-center">
            <WalletButton />
          </div>
        </div>

        {/* Context ID Input */}
        <div className="mb-6 p-4 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
          <label htmlFor="global-context-id" className="block text-sm font-medium text-gray-900 mb-2">
            Context ID (Event ID)
          </label>
          <input
            id="global-context-id"
            type="number"
            value={contextId}
            onChange={(e) => setContextId(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="1"
            min="1"
          />
          <p className="text-xs text-gray-600 mt-2">
            This ID is used across all steps. Change it to create a different event.
          </p>
        </div>

        {/* Contract Addresses Input */}
        <div className="mb-6 p-4 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Contract Addresses (Optional)</h3>
          <p className="text-xs text-gray-600 mb-3">
            If you deployed GroupManager or ZKVerifier manually, enter their addresses here. Otherwise, default addresses will be used.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="group-manager-addr" className="block text-xs font-medium text-gray-700 mb-1">
                GroupManager Address
              </label>
              <input
                id="group-manager-addr"
                type="text"
                value={deployedGroupManager || ''}
                onChange={(e) => {
                  const addr = e.target.value.trim();
                  setDeployedGroupManager(addr || null);
                }}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-md text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                placeholder="0x..."
              />
            </div>
            <div>
              <label htmlFor="zk-verifier-addr" className="block text-xs font-medium text-gray-700 mb-1">
                ZKVerifier Address
              </label>
              <input
                id="zk-verifier-addr"
                type="text"
                value={deployedZKVerifier || ''}
                onChange={(e) => {
                  const addr = e.target.value.trim();
                  setDeployedZKVerifier(addr || null);
                }}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-md text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
                placeholder="0x..."
              />
            </div>
          </div>
        </div>

        {/* Deploy Contracts Section */}
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <span className="bg-gray-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
              0
            </span>
            <h2 className="text-xl font-semibold text-gray-900">Deploy Contracts (Optional)</h2>
          </div>
          <DeployContracts
            onContractsDeployed={(baseNFT, nftFactory) => {
              setDeployedNFTFactory(nftFactory);
            }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {/* Step 1: Create Event */}
          <div>
            <div className="flex items-center mb-2">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
                1
              </span>
              <h2 className="text-xl font-semibold text-gray-900">Create Event</h2>
            </div>
            <CreateEvent contextId={contextId} deployedNFTFactory={deployedNFTFactory} />
          </div>

          {/* Step 2: Create Group */}
          <div>
            <div className="flex items-center mb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
                2
              </span>
              <h2 className="text-xl font-semibold text-gray-900">Create Group</h2>
            </div>
            <CreateGroup contextId={contextId} deployedGroupManager={deployedGroupManager} />
          </div>

          {/* Step 3: Generate Identity */}
          <div>
            <div className="flex items-center mb-2">
              <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
                3
              </span>
              <h2 className="text-xl font-semibold text-gray-900">Generate Identity</h2>
            </div>
            <GenerateIdentity
              onIdentityGenerated={(id) => setIdentity(id)}
            />
          </div>

          {/* Step 4: Add to Group */}
          <div>
            <div className="flex items-center mb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
                4
              </span>
              <h2 className="text-xl font-semibold text-gray-900">Add to Group</h2>
            </div>
            <AddToGroup identity={identity} contextId={contextId} deployedGroupManager={deployedGroupManager} />
          </div>

          {/* Step 5: Freeze Group */}
          <div>
            <div className="flex items-center mb-2">
              <span className="bg-orange-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
                5
              </span>
              <h2 className="text-xl font-semibold text-gray-900">Freeze Group</h2>
            </div>
            <FreezeGroup contextId={contextId} deployedGroupManager={deployedGroupManager} />
          </div>

          {/* Step 6: Generate Proof */}
          <div>
            <div className="flex items-center mb-2">
              <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
                6
              </span>
              <h2 className="text-xl font-semibold text-gray-900">Generate ZK Proof</h2>
            </div>
            <GenerateProof
              identity={identity}
              contextId={contextId}
              onProofGenerated={(proof, array) => {
                setProofData(proof);
                setProofArray(array);
              }}
              deployedGroupManager={deployedGroupManager}
              deployedZKVerifier={deployedZKVerifier}
            />
          </div>

          {/* Step 7: Verify */}
          <div>
            <div className="flex items-center mb-2">
              <span className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-2">
                7
              </span>
              <h2 className="text-xl font-semibold text-gray-900">Verify On-Chain</h2>
            </div>
            <VerifyProof
              contextId={contextId}
              proofData={proofData}
              proofArray={proofArray}
              deployedZKVerifier={deployedZKVerifier}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-600 text-sm">
          <p>
            Built with Next.js, wagmi, and snarkjs | Privacy-Preserving ZK
            Proofs
          </p>
        </div>
      </div>
    </main>
  );
}

