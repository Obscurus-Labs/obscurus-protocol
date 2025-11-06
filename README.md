# ARG25 Project Submission

## Project Title
ZK Tickets: Modular NFT + ZK Infrastructure for Fraud-Proof, Private Event Access

## Team
- **Team/Individual Name:** ZK Tickets Labs  
- **GitHub Handles:** @mathigertner  
- **Devfolio Handles:** mathigertner  

---

## Project Description

**ZK Tickets** is a next-generation, privacy-preserving ticketing infrastructure built on **modular NFT contracts** and **zero-knowledge proofs**.  
It combines the verifiability of NFTs with the privacy of ZK systems, enabling users to prove they own a valid ticket — **without revealing their identity or exposing ticket metadata on-chain**.

> “I hold a valid ticket of type _X_ for event _Y_, and I haven’t used it before.”  
All proven privately through a single zk-SNARK.

The architecture leverages **minimal proxy contracts (EIP-1167)** to deploy an isolated ERC-721 clone for every event. Each event maintains its own NFT state, ticket types, and ZK membership tree, enabling:
- Independent event isolation (no shared state)
- Ultra-low gas deployments (90% cheaper)
- Clean, auditable upgrade paths
- No centralized database

The system is fully **non-custodial**, **deterministic**, and **privacy-preserving**, with all identity secrets kept client-side.

---

## Tech Stack

### 🧩 On-Chain
- **Solidity (0.8.x)** — `TicketFactory`, `TicketNFT`, `GroupManager`, `Verifier`
- **EIP-1167 Minimal Proxies** — gas-efficient cloning pattern
- **ERC-721Upgradeable + OwnableUpgradeable** — base NFT logic (OpenZeppelin)
- **Poseidon Hash / Merkle Trees** — ZK-compatible group commitments
- **Semaphore-style nullifiers** — prevent double access

### ⚙️ Zero-Knowledge Layer
- **Circom / Noir DSL** — circuits for membership + nullifier validation  
- **Groth16 SNARKs** — efficient proof system for on-chain verification  
- **WASM Proof Generator** — client-side proof generation in browser/app  

### 🖥 SDK & Infrastructure
- **TypeScript SDK** — unified interface for contracts + proof lifecycle  
- **React + WASM Frontend Demo** — mint → prove → verify UX  
- **Hardhat / Forge** — contract deployment + testing  
- **Docker** — reproducible environment  
- **GitHub Actions** — CI/CD  

---

## Objectives

By the end of ARG25, ZK Tickets will demonstrate:

- ✅ **Modular NFT Factory System:** Event-specific ERC-721 clones via minimal proxies.  
- ✅ **ZK Membership Flow:** Identity commitments added to per-event Merkle trees.  
- ✅ **Client-Side Proof Generation:** WASM-based zk-SNARKs with nullifier checks.  
- ✅ **Verifier Integration:** Smart contract verifying Merkle inclusion + nullifier uniqueness.  

**Stretch Goals:**
- Recursive proof aggregation (multi-ticket verification).  
- Optional on-chain event root freezing + verification audit trail.  
- SDK integration for third-party Web2 ticketing platforms.  

---

## Architecture Overview

### 🔹 Smart Contract Modules

| Contract | Purpose |
|-----------|----------|
| **TicketFactory** | Deploys minimal proxy clones for each event (`TicketNFT`). |
| **TicketNFT** | ERC-721 collection storing ticket type and metadata; initialized per event. |
| **GroupManager** | Manages identity commitments, generates Merkle roots, and handles group freezing. |
| **Verifier** | Verifies ZK proofs and consumes nullifiers to prevent double entry. |

Each event has its own NFT contract clone and Merkle tree, ensuring total isolation and verifiable ownership without exposing user identities.

### 🔹 Lifecycle Flow

1. **Create Event** → Factory deploys new `TicketNFT` clone deterministically (EIP-1167).  
2. **Mint Tickets** → Organizer mints NFTs per user and assigns ticket type (`general`, `vip`, etc.).  
3. **Register Identity** → User generates `identityCommitment` (Poseidon hash of secret) → added to `GroupManager`.  
4. **Freeze Root** → Organizer freezes the event’s Merkle root before access time.  
5. **Generate Proof** → User locally computes zk-SNARK proof that:  
   - They are a valid member of the event’s Merkle tree.  
   - Their nullifier hasn’t been used.  
   - Their ticket type matches (`general`, `vip`, …).  
6. **Verify Access** → `Verifier` contract checks proof and consumes the nullifier (proof cannot be reused).  

---

## Weekly Progress

### Week 1 (ends Oct 31)
**Goals:**
- Define architecture (factory, NFT clones, group contracts).
- Research interoperability with Semaphore circuits.

### Week 2 (ends Nov 7)
**Goals:**
- Implement `TicketFactory` + `TicketNFT` (cloning + initialization).
- Implement ZK circuit + client-side proof generation (Circom → Groth16).
- Deploy prototype and integrate event creation + mint flow.

### Week 3 (ends Nov 14)
**Goals:**
- Integrate on-chain verifier and full lifecycle (mint → prove → verify).
- SDK implementation + frontend demo.

---

## Final Wrap-Up

**Deliverables:**
- ✅ Solidity contracts: Factory + Clone-based NFT system + ZK Verifier
- ✅ Circom circuits for membership and nullifier validation
- ✅ Client-side WASM proof generator
- ✅ TypeScript SDK for third-party integrations
- ✅ Demo app (mint + proof + verification)

**Main Repository:** [https://github.com/mathigertner/arg25-Projects](https://github.com/mathigertner/arg25-Projects)
**Demo / Deployment:** *TBD*
**Slides / Presentation:** *TBD*

---

## 🧾 Learnings

- Minimal proxies enable **scalable NFT deployments** with isolated state per event.
- ZK proofs add **privacy and non-transferability** without centralized KYC.
- Combining NFTs + ZK is the cleanest way to bring **provable yet private access control** to real-world events.

---

## Next Steps

- On-chain freezing with audit trail (root + timestamp).
- Batch proof aggregation for multiple users.
- SDK integration for external event platforms (plug-and-play proof layer).
- Deploy mainnet version.
