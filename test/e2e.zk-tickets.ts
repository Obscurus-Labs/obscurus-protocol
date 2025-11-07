// ============================================================================
// CIRCUIT SETUP COMMANDS (run these BEFORE running this test)
// ============================================================================
//
// 1) Install circom and snarkjs globally:
//    npm install -g circom snarkjs
//
// 2) Create circuits folder:
//    mkdir -p circuits
//
// 3) Download a powers of tau file (use ptau12 for testing, ptau20+ for prod):
//    wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O pot12_final.ptau
//
// 4) Create circuits/semaphore.circom with the standard Semaphore circuit.
//    You can copy it from @semaphore-protocol/circuits or write a minimal version:
//
//    template Semaphore(nLevels) {
//        signal input identityNullifier;
//        signal input identityTrapdoor;
//        signal input treePathIndices[nLevels];
//        signal input treeSiblings[nLevels];
//        signal input externalNullifier;
//        signal input signalHash;
//
//        signal output merkleTreeRoot;
//        signal output nullifierHash;
//
//        // ... (implement identity commitment, merkle proof, nullifier logic)
//    }
//
//    component main {public [merkleTreeRoot, externalNullifier, signalHash]} = Semaphore(20);
//
// 5) Compile the circuit:
//    circom circuits/semaphore.circom --r1cs --wasm --sym -o circuits/
//
// 6) Generate proving key (setup):
//    snarkjs groth16 setup circuits/semaphore.r1cs pot12_final.ptau circuits/semaphore_0000.zkey
//
// 7) Contribute to the ceremony (adds randomness):
//    snarkjs zkey contribute circuits/semaphore_0000.zkey circuits/semaphore_final.zkey --name="local" -v
//
// 8) Export verification key:
//    snarkjs zkey export verificationkey circuits/semaphore_final.zkey circuits/verification_key.json
//
// 9) Now you can run this test:
//    npx hardhat test test/e2e.zk-tickets.ts
//
// ============================================================================

import { expect } from "chai";
import { ethers } from "ethers";
// @ts-ignore - snarkjs doesn't have type definitions
import { groth16 } from "snarkjs";
// @ts-ignore - circomlibjs doesn't have type definitions
import { buildPoseidon } from "circomlibjs";
import { network } from "hardhat";
import { fileURLToPath } from "node:url";

import * as fs from "node:fs";
import * as path from "node:path";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("E2E: ZK Tickets Flow", function () {
  // Increase timeout because proof generation can take 10-30 seconds
  this.timeout(60000);

  it("should complete full privacy-preserving ticketing flow", async function () {
    // ========================================================================
    // STEP A: Deploy all contracts (or use existing from .env)
    // ========================================================================
    console.log("\n📦 STEP A: Setting up contracts...");

    const { ethers: hre } = await network.connect();
    const [deployer, organizer, user] = await hre.getSigners();

    console.log("  Deployer:", await deployer.getAddress());
    console.log("  Organizer:", await organizer.getAddress());
    console.log("  User:", await user.getAddress());

    let mockVerifier: any,
      semaphore: any,
      baseNFTImpl: any,
      nftFactory: any,
      groupManager: any,
      zkVerifier: any;

    // Always deploy fresh contracts in test mode (hardhat network resets each test)
    console.log("\n  🚀 Deploying fresh contracts for this test...");

    // Deploy MockSemaphoreVerifier
    const MockVerifier = await hre.getContractFactory("MockSemaphoreVerifier");
    mockVerifier = await MockVerifier.deploy();
    await mockVerifier.waitForDeployment();
    console.log("  ✓ MockSemaphoreVerifier:", await mockVerifier.getAddress());

    // Deploy Semaphore (with library linking)
    const Semaphore = await hre.getContractFactory("Semaphore", {
      libraries: {
        PoseidonT3: "0x0000000000000000000000000000000000000001", // Placeholder - linking at compile time
      },
    });
    semaphore = await Semaphore.deploy(await mockVerifier.getAddress());
    await semaphore.waitForDeployment();
    console.log("  ✓ Semaphore:", await semaphore.getAddress());

    // Deploy BaseNFT
    const BaseNFT = await hre.getContractFactory("BaseNFT");
    baseNFTImpl = await BaseNFT.deploy();
    await baseNFTImpl.waitForDeployment();
    console.log("  ✓ BaseNFT:", await baseNFTImpl.getAddress());

    // Deploy NFTFactory
    const NFTFactory = await hre.getContractFactory("NFTFactory");
    nftFactory = await NFTFactory.deploy(await baseNFTImpl.getAddress());
    await nftFactory.waitForDeployment();
    console.log("  ✓ NFTFactory:", await nftFactory.getAddress());

    // Deploy GroupManager
    const GroupManager = await hre.getContractFactory("GroupManager");
    groupManager = await GroupManager.deploy(await semaphore.getAddress());
    await groupManager.waitForDeployment();
    console.log("  ✓ GroupManager:", await groupManager.getAddress());

    // Deploy ZKVerifier
    const ZKVerifier = await hre.getContractFactory("ZKVerifier");
    zkVerifier = await ZKVerifier.deploy(
      await semaphore.getAddress(),
      await groupManager.getAddress()
    );
    await zkVerifier.waitForDeployment();
    console.log("  ✓ ZKVerifier:", await zkVerifier.getAddress());

    // ========================================================================
    // STEP B: Create an "event" (collection)
    // ========================================================================
    console.log("\n🎫 STEP B: Creating event/collection...");

    const contextId = 1n;
    const collectionName = "VIP Concert Tickets";
    const collectionSymbol = "VCTKN";
    const baseURI = "https://example.com/metadata/";
    const contractURI = "https://example.com/contract";

    await nftFactory
      .connect(deployer)
      .createCollection(
        contextId,
        collectionName,
        collectionSymbol,
        baseURI,
        contractURI,
        await organizer.getAddress()
      );

    const collectionAddress = await nftFactory.collectionContractOf(contextId);
    console.log("  ✓ Collection deployed at:", collectionAddress);

    const collection = await hre.getContractAt("BaseNFT", collectionAddress);

    // Mint 1 NFT to the user (this represents ticket ownership)
    await collection.connect(organizer).mint(await user.getAddress());
    console.log("  ✓ NFT #0 minted to user");

    // ========================================================================
    // STEP C: Create a group for this context in GroupManager
    // ========================================================================
    console.log("\n👥 STEP C: Creating Semaphore group...");

    await groupManager
      .connect(deployer)
      .createGroup(contextId, await organizer.getAddress());

    const semaphoreGroupId = await groupManager.semaphoreGroupOf(contextId);
    console.log("  ✓ Group created with Semaphore ID:", semaphoreGroupId);

    // ========================================================================
    // STEP D: Build the user's identity LOCALLY
    // ========================================================================
    console.log("\n🔐 STEP D: Generating user identity...");

    // Create a random wallet for the user's identity
    const identityWallet = ethers.Wallet.createRandom();
    console.log("  Identity wallet:", identityWallet.address);

    // Derive identity components from private key
    // IMPORTANT: In production, use Poseidon hash from circomlibjs
    // Here we mock with keccak256 for simplicity
    const identity_nullifier = BigInt(
      ethers.keccak256(identityWallet.privateKey)
    );
    const identity_trapdoor = BigInt(
      ethers.keccak256(
        ethers.concat([identityWallet.privateKey, ethers.toUtf8Bytes("0x01")])
      )
    );

    console.log("  Identity nullifier:", identity_nullifier.toString());
    console.log("  Identity trapdoor:", identity_trapdoor.toString());

    // Compute identityCommitment using REAL Poseidon (matches circuit)
    console.log("  Computing identityCommitment with Poseidon...");
    const poseidon = await buildPoseidon();
    const identityCommitment = BigInt(
      poseidon.F.toString(poseidon([identity_nullifier, identity_trapdoor]))
    );

    console.log(
      "  ✓ Identity commitment (Poseidon):",
      identityCommitment.toString()
    );

    // ========================================================================
    // STEP E: Add member with ticket type to the group
    // ========================================================================
    console.log("\n🎟️  STEP E: Adding member to group with ticket type...");

    const ticketType = 1n; // 1 = VIP, 2 = General, etc.

    // Compute leaf = Poseidon([identityCommitment, ticketType]) using REAL Poseidon
    console.log("  Computing leaf with Poseidon...");
    const leaf = BigInt(
      poseidon.F.toString(poseidon([identityCommitment, ticketType]))
    );

    console.log("  Ticket type:", ticketType.toString());
    console.log("  ✓ Leaf (Poseidon):", leaf.toString());

    await groupManager.connect(organizer).addMember(contextId, leaf);
    console.log("  ✓ Member added to group");

    // ========================================================================
    // STEP F: Freeze the group and get Merkle root
    // ========================================================================
    console.log("\n🔒 STEP F: Freezing group...");

    await groupManager.connect(organizer).freezeGroup(contextId);
    console.log("  ✓ Group frozen");

    // This should NOT revert because we're calling getActiveRoot, not trying to add members
    const merkleRoot = await groupManager.getActiveRoot(contextId);
    console.log("  📊 Merkle root:", merkleRoot.toString());
    console.log("  📊 Merkle root (hex):", "0x" + merkleRoot.toString(16));

    // ========================================================================
    // STEP G: Generate ZK PROOF using snarkjs
    // ========================================================================
    console.log("\n🔮 STEP G: Generating ZK proof...");

    // Check if circuit artifacts exist
    const wasmPath = path.join(
      __dirname,
      "..",
      "circuits",
      "semaphore_js",
      "semaphore.wasm"
    );
    const zkeyPath = path.join(
      __dirname,
      "..",
      "circuits",
      "semaphore_final.zkey"
    );

    if (!fs.existsSync(wasmPath)) {
      console.log("  ⚠️  WASM file not found at:", wasmPath);
      console.log(
        "  ⚠️  Please run the circuit setup commands (see top of file)"
      );
      console.log("  ⚠️  Skipping proof generation...");
      this.skip();
      return;
    }

    if (!fs.existsSync(zkeyPath)) {
      console.log("  ⚠️  zkey file not found at:", zkeyPath);
      console.log(
        "  ⚠️  Please run the circuit setup commands (see top of file)"
      );
      console.log("  ⚠️  Skipping proof generation...");
      this.skip();
      return;
    }

    console.log("  ✓ Circuit artifacts found");

    // Compute externalNullifier EXACTLY like Solidity
    const zkVerifierAddress = await zkVerifier.getAddress();
    const externalNullifier = ethers.solidityPackedKeccak256(
      ["string", "address", "uint256"],
      ["ZK_CTX", zkVerifierAddress, contextId]
    );

    console.log("\n  📊 KEY VALUES FOR DEBUGGING:");
    console.log("  📊 Merkle Root:", merkleRoot.toString());
    console.log("  📊 Merkle Root (hex):", "0x" + merkleRoot.toString(16));
    console.log("  📊 External Nullifier:", externalNullifier);
    console.log(
      "  📊 External Nullifier (computed as: keccak256('ZK_CTX', verifier, contextId))"
    );
    console.log("  📊 ZK Verifier Address:", zkVerifierAddress);
    console.log("  📊 Context ID:", contextId.toString());

    // Build circuit input
    // ⚠️ The circuit expects arrays of size 20 (nLevels), so we fill with zeros for 1-member tree
    // In a real multi-member tree, you must compute the actual Merkle proof path
    const nLevels = 20;
    const circuitInput = {
      identityNullifier: identity_nullifier.toString(),
      identityTrapdoor: identity_trapdoor.toString(),
      ticketType: ticketType.toString(), // Ticket type (1 = VIP, 2 = General, etc.) - needed to compute correct leaf
      treePathIndices: new Array(nLevels).fill("0"), // Fill with zeros for 1-member tree
      treeSiblings: new Array(nLevels).fill("0"), // Fill with zeros for 1-member tree
      externalNullifier: BigInt(externalNullifier).toString(),
      signalHash: "1", // Can be any value, we use 1 for simplicity
    };

    console.log("  Circuit input prepared:");
    console.log(
      "    - identityNullifier:",
      circuitInput.identityNullifier.slice(0, 20) + "..."
    );
    console.log(
      "    - identityTrapdoor:",
      circuitInput.identityTrapdoor.slice(0, 20) + "..."
    );
    console.log("    - ticketType:", circuitInput.ticketType);
    console.log(
      "    - externalNullifier:",
      circuitInput.externalNullifier.slice(0, 20) + "..."
    );
    console.log("    - signalHash:", circuitInput.signalHash);
    console.log(
      "    - ⚠️  treePathIndices: [" + nLevels + " zeros] (1 member tree)"
    );
    console.log(
      "    - ⚠️  treeSiblings: [" + nLevels + " zeros] (1 member tree)"
    );

    console.log("\n  Generating proof (this may take 10-30 seconds)...");
    const startTime = Date.now();

    const { proof, publicSignals } = await groth16.fullProve(
      circuitInput,
      wasmPath,
      zkeyPath
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  ✓ Proof generated in ${elapsed}s`);

    // Export to Solidity calldata format
    const calldata = await groth16.exportSolidityCallData(proof, publicSignals);

    // Parse calldata: "[a,b] [[b],[b]] [c] [pub1,pub2,...]"
    const argv = calldata
      .replace(/["[\]\s]/g, "")
      .split(",")
      .map((x: string) => BigInt(x));

    // First 8 elements are the proof (a, b, c components)
    const proofArray: [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint
    ] = [
      argv[0],
      argv[1],
      argv[2],
      argv[3],
      argv[4],
      argv[5],
      argv[6],
      argv[7],
    ];

    // Public signals typically include:
    // [0] merkleTreeRoot
    // [1] nullifierHash
    // [2] signalHash
    // [3] externalNullifier
    const nullifierHash = argv[8 + 1]; // publicSignals[1]
    const signal = 1n; // We used signalHash = 1

    console.log("\n  📊 PROOF GENERATION RESULTS:");
    console.log("  📊 Public signals:");
    console.log("    - merkleTreeRoot:", argv[8].toString());
    console.log("    - nullifierHash:", nullifierHash.toString());
    console.log(
      "    - nullifierHash (hex):",
      "0x" + nullifierHash.toString(16)
    );
    console.log("    - signalHash:", argv[8 + 2].toString());
    console.log("    - externalNullifier:", argv[8 + 3].toString());
    console.log("  📊 Proof array length:", proofArray.length);
    console.log(
      "  📊 Proof[0] (first element):",
      proofArray[0].toString().slice(0, 20) + "..."
    );

    // Verify the merkleTreeRoot in public signals matches what we got from contract
    expect(argv[8]).to.equal(merkleRoot);
    console.log("  ✓ Merkle root from proof matches contract root!");

    // ========================================================================
    // STEP H: Verify proof on-chain
    // ========================================================================
    console.log("\n✅ STEP H: Verifying proof on-chain...");

    // First verification should succeed
    await expect(
      zkVerifier
        .connect(user)
        .verifyZKProof(contextId, signal, nullifierHash, proofArray)
    )
      .to.emit(zkVerifier, "AccessGranted")
      .withArgs(contextId, nullifierHash, signal);

    console.log("  ✓ Proof verified successfully!");
    console.log("  ✓ AccessGranted event emitted");

    // Try to use the same proof again (should revert - double-spend protection)
    console.log("\n  Testing duplicate nullifier detection...");
    await expect(
      zkVerifier
        .connect(user)
        .verifyZKProof(contextId, signal, nullifierHash, proofArray)
    ).to.be.revertedWithCustomError(zkVerifier, "DuplicateUse");

    console.log("  ✓ Duplicate nullifier correctly rejected!");

    // ========================================================================
    // TEST COMPLETE
    // ========================================================================
    console.log("\n🎉 E2E TEST COMPLETE!");
    console.log("\n📋 Summary:");
    console.log(
      "  - Deployed all contracts (Semaphore, Factory, GroupManager, Verifier)"
    );
    console.log("  - Created event collection and minted NFT to user");
    console.log(
      "  - Generated user identity locally (private key never shared)"
    );
    console.log("  - Added member to Semaphore group with ticket type");
    console.log("  - Froze group and obtained Merkle root");
    console.log("  - Generated ZK proof client-side using snarkjs");
    console.log("  - Verified proof on-chain successfully");
    console.log("  - Prevented duplicate use of same nullifier");
    console.log("\n✨ Privacy-preserving ticketing flow verified!");
  });
});
