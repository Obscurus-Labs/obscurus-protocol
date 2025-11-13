# ZK Tickets Frontend

Frontend demo for the ZK Tickets privacy-preserving ticketing system.

## Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Copy circuit files to public folder:**
```bash
# From project root
mkdir -p frontend/public/circuits
cp circuits/semaphore_js/semaphore.wasm frontend/public/circuits/
cp circuits/semaphore_final.zkey frontend/public/circuits/
```

3. **Set up environment variables (optional):**
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_NFT_FACTORY_ADDR=0x...
NEXT_PUBLIC_GROUP_MANAGER_ADDR=0x...
NEXT_PUBLIC_ZK_VERIFIER_ADDR=0x...
```

4. **Start Hardhat local node:**
```bash
# In project root
npx hardhat node
```

5. **Deploy contracts:**
```bash
# In project root (in another terminal)
npx hardhat run scripts/deployAll.ts --network localhost
```

6. **Update contract addresses:**
Copy the deployed addresses to `frontend/lib/contracts.ts` or set them in `.env.local`

7. **Run the frontend:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect Wallet** - Click "Connect Wallet" and select MetaMask
2. **Create Event** - Create a new event/collection
3. **Generate Identity** - Generate a private identity (stored locally)
4. **Add to Group** - Add your identity to the Merkle tree
5. **Freeze Group** - Lock the Merkle root
6. **Generate Proof** - Generate a ZK proof (this may take 10-30 seconds)
7. **Verify** - Submit proof to smart contract for verification

## Features

- ✅ Wallet connection with RainbowKit
- ✅ Create events/collections
- ✅ Generate private identities locally
- ✅ Add members to Merkle tree
- ✅ Generate ZK proofs in browser
- ✅ Verify proofs on-chain
- ✅ Real-time transaction status

## Tech Stack

- **Next.js 14** - React framework
- **wagmi** - Ethereum React hooks
- **RainbowKit** - Wallet connection UI
- **snarkjs** - ZK proof generation
- **TailwindCSS** - Styling


