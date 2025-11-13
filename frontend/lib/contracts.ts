// Contract addresses - GROUP_MANAGER and ZK_VERIFIER are hardcoded, others use env vars
export const CONTRACT_ADDRESSES = {
  BASE_NFT: process.env.NEXT_PUBLIC_BASE_NFT_ADDR || '',
  NFT_FACTORY: process.env.NEXT_PUBLIC_NFT_FACTORY_ADDR || '0x99dBE4AEa58E518C50a1c04aE9b48C9F6354612f',
  GROUP_MANAGER: process.env.NEXT_PUBLIC_GROUP_MANAGER_ADDR || '0x6F6f570F45833E249e27022648a26F4076F48f78',
  ZK_VERIFIER: process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDR || '0xCA8c8688914e0F7096c920146cd0Ad85cD7Ae8b9',
};

// ABIs in JSON format (required by wagmi)
export const NFT_FACTORY_ABI = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'collectionId', type: 'uint256' },
      { internalType: 'string', name: 'name_', type: 'string' },
      { internalType: 'string', name: 'symbol_', type: 'string' },
      { internalType: 'string', name: 'baseURI_', type: 'string' },
      { internalType: 'string', name: 'contractURI_', type: 'string' },
      { internalType: 'address', name: 'organizerOwner', type: 'address' },
    ],
    name: 'createCollection',
    outputs: [{ internalType: 'address', name: 'nft', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'collectionContractOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const GROUP_MANAGER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'address', name: 'admin', type: 'address' },
    ],
    name: 'createGroup',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'uint256', name: 'identityCommitment', type: 'uint256' },
    ],
    name: 'addMember',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'freezeGroup',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'isFrozen',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'getActiveRoot',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'semaphoreGroupOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'groupAdmin',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'getSemaphoreGroupId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSemaphoreAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'semaphore',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ZK_VERIFIER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'contextId', type: 'uint256' },
      { internalType: 'uint256', name: 'signal', type: 'uint256' },
      { internalType: 'uint256', name: 'nullifierHash', type: 'uint256' },
      { internalType: 'uint256[8]', name: 'proof', type: 'uint256[8]' },
    ],
    name: 'verifyZKProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'contextId', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'nullifierHash', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'signal', type: 'uint256' },
    ],
    name: 'AccessGranted',
    type: 'event',
  },
] as const;

export const BASE_NFT_ABI = [
  'function mint(address to) external',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
] as const;

