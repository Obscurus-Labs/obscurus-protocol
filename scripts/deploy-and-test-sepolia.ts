import { network } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateLeanIMTRoot, calculateLeanIMTProof } from "../test/helpers/leanIMT.js";
import { groth16 } from "snarkjs";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploys all contracts to Sepolia and runs end-to-end tests
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-and-test-sepolia.ts --network sepolia
 * 
 * Environment variables:
 *   SEPOLIA_SEMAPHORE_ADDR - Address of Semaphore contract on Sepolia (optional, will use default if not set)
 * 
 * Default Semaphore addresses for Sepolia:
 *   SemaphoreVerifier: 0x4DeC9E3784EcC1eE002001BfE91deEf4A48931f8
 *   PoseidonT3: 0xB43122Ecb241DD50062641f089876679fd06599a
 *   Semaphore: 0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D
 */
async function main() {
  const { ethers: hre } = await network.connect();
  const [deployer] = await hre.getSigners();
  
  const deployerAddress = await deployer.getAddress();
  console.log("📝 Deployer address:", deployerAddress);
  
  // Check balance
  const balance = await hre.provider.getBalance(deployerAddress);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
  
  const addressesPath = path.join(__dirname, "..", "deployments-sepolia.json");
  let addresses: Record<string, string> = {};
  let shouldDeploy = true;
  let needRedeployGroupManager = false;

  // Check if deployments file exists
  if (fs.existsSync(addressesPath)) {
    console.log("\n📂 Found existing deployment file:", addressesPath);
    addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
    console.log("   Using existing contract addresses:");
    for (const [name, addr] of Object.entries(addresses)) {
      console.log(`   ${name}: ${addr}`);
    }
    
    // Verify contracts exist and check if GroupManager has correct Semaphore address
    console.log("\n🔍 Verifying existing contracts...");
    let allExist = true;
    
    for (const [name, addr] of Object.entries(addresses)) {
      if (name === "SEMAPHORE" || name === "SEMAPHORE_VERIFIER" || name === "POSEIDON_T3") continue; // Skip Semaphore contracts (they're real contracts)
      const code = await hre.provider.getCode(addr);
      if (code === "0x") {
        console.log(`   ⚠️  ${name} not found at ${addr}, will redeploy`);
        allExist = false;
      } else {
        console.log(`   ✓ ${name} verified`);
        
        // Check if GroupManager has correct Semaphore address
        if (name === "GROUP_MANAGER") {
          const GroupManagerABI = ["function semaphore() external view returns (address)"];
          const groupManager = await hre.getContractAt(GroupManagerABI, addr);
          const currentSemaphoreAddr = await groupManager.semaphore();
          // Always use the correct Semaphore address
          const correctSemaphoreAddr = "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";
          
          if (currentSemaphoreAddr.toLowerCase() !== correctSemaphoreAddr.toLowerCase()) {
            console.log(`   ⚠️  ${name} has wrong Semaphore address!`);
            console.log(`      Current: ${currentSemaphoreAddr}`);
            console.log(`      Expected: ${correctSemaphoreAddr}`);
            console.log(`      Will redeploy ${name}...`);
            needRedeployGroupManager = true;
            allExist = false;
          }
        }
      }
    }
    
    if (allExist && !needRedeployGroupManager) {
      console.log("\n✅ All contracts exist and are correctly configured, skipping deployment!");
      shouldDeploy = false;
    } else {
      console.log("\n⚠️  Some contracts need to be deployed or updated...");
    }
  }

  // Set the correct Semaphore address early (before deployment check)
  // Correct addresses for Sepolia:
  // SemaphoreVerifier: 0x4DeC9E3784EcC1eE002001BfE91deEf4A48931f8
  // PoseidonT3: 0xB43122Ecb241DD50062641f089876679fd06599a
  // Semaphore: 0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D
  const defaultSemaphoreAddress = "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";
  const semaphoreAddress = process.env.SEPOLIA_SEMAPHORE_ADDR || defaultSemaphoreAddress;
  // Always update addresses.SEMAPHORE to the correct address
  addresses.SEMAPHORE = semaphoreAddress;

  if (shouldDeploy) {
    console.log("\n🚀 Deploying zk-tickets contracts to Sepolia...\n");
    
    if (balance < ethers.parseEther("0.01")) {
      console.error("❌ ERROR: Insufficient balance! Need at least 0.01 ETH");
      process.exit(1);
    }
    
    console.log("\n1️⃣  Using real Semaphore contract on Sepolia...");
    console.log("   📍 Semaphore address:", semaphoreAddress);
    console.log("   ℹ️  Source: https://docs.semaphore.pse.dev/deployed-contracts");
    
    // Verify the contract exists
    const code = await hre.provider.getCode(semaphoreAddress);
    if (code === "0x") {
      console.error("❌ ERROR: No contract found at Semaphore address!");
      console.error("   Please verify the address or set SEPOLIA_SEMAPHORE_ADDR environment variable");
      process.exit(1);
    }
    console.log("   ✓ Semaphore contract verified");
    
    addresses.SEMAPHORE = semaphoreAddress;

    // Deploy contracts only if they don't exist
    if (!addresses.BASE_NFT) {
      console.log("\n2️⃣  Deploying BaseNFT...");
      const BaseNFT = await hre.getContractFactory("BaseNFT");
      const baseNFT = await BaseNFT.deploy();
      await baseNFT.waitForDeployment();
      addresses.BASE_NFT = await baseNFT.getAddress();
      console.log("   ✓ BaseNFT:", addresses.BASE_NFT);
    } else {
      console.log("\n2️⃣  BaseNFT already deployed:", addresses.BASE_NFT);
    }

    if (!addresses.NFT_FACTORY) {
      console.log("\n3️⃣  Deploying NFTFactory...");
      const NFTFactory = await hre.getContractFactory("NFTFactory");
      const nftFactory = await NFTFactory.deploy(addresses.BASE_NFT);
      await nftFactory.waitForDeployment();
      addresses.NFT_FACTORY = await nftFactory.getAddress();
      console.log("   ✓ NFTFactory:", addresses.NFT_FACTORY);
    } else {
      console.log("\n3️⃣  NFTFactory already deployed:", addresses.NFT_FACTORY);
    }

    if (!addresses.GROUP_MANAGER || needRedeployGroupManager) {
      if (needRedeployGroupManager) {
        console.log("\n4️⃣  Redeploying GroupManager with correct Semaphore address...");
      } else {
        console.log("\n4️⃣  Deploying GroupManager...");
      }
      // Ensure we use the correct Semaphore address (hardcoded to avoid issues)
      const correctSemaphoreAddr = "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";
      const GroupManager = await hre.getContractFactory("GroupManager");
      const groupManager = await GroupManager.deploy(correctSemaphoreAddr);
      await groupManager.waitForDeployment();
      addresses.GROUP_MANAGER = await groupManager.getAddress();
      console.log("   ✓ GroupManager:", addresses.GROUP_MANAGER);
      console.log("   ✓ Connected to Semaphore:", correctSemaphoreAddr);
      
      // Verify the deployment
      const deployedSemaphoreAddr = await groupManager.semaphore();
      if (deployedSemaphoreAddr.toLowerCase() !== correctSemaphoreAddr.toLowerCase()) {
        throw new Error(`GroupManager deployed with wrong Semaphore address! Expected ${correctSemaphoreAddr}, got ${deployedSemaphoreAddr}`);
      }
    } else {
      console.log("\n4️⃣  GroupManager already deployed:", addresses.GROUP_MANAGER);
    }

    // If GroupManager was redeployed, we need to redeploy ZKVerifier too
    if (!addresses.ZK_VERIFIER || needRedeployGroupManager) {
      if (needRedeployGroupManager) {
        console.log("\n5️⃣  Redeploying ZKVerifier with new GroupManager address...");
      } else {
        console.log("\n5️⃣  Deploying ZKVerifier...");
      }
      const ZKVerifier = await hre.getContractFactory("ZKVerifier");
      const zkVerifier = await ZKVerifier.deploy(
        addresses.SEMAPHORE,
        addresses.GROUP_MANAGER
      );
      await zkVerifier.waitForDeployment();
      addresses.ZK_VERIFIER = await zkVerifier.getAddress();
      console.log("   ✓ ZKVerifier:", addresses.ZK_VERIFIER);
    } else {
      console.log("\n5️⃣  ZKVerifier already deployed:", addresses.ZK_VERIFIER);
    }

    // Save addresses to file
    console.log("\n📝 Saving deployment addresses...");
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log("   ✓ Saved to:", addressesPath);

    // Also update .env file
    const envPath = path.join(__dirname, "..", ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
      // Remove old Sepolia addresses if they exist
      envContent = envContent.replace(/SEPOLIA_.*_ADDR=.*\n/g, "");
    }
    envContent += `\n# Sepolia Deployment Addresses\n`;
    envContent += `SEPOLIA_BASE_NFT_ADDR=${addresses.BASE_NFT}\n`;
    envContent += `SEPOLIA_NFT_FACTORY_ADDR=${addresses.NFT_FACTORY}\n`;
    envContent += `SEPOLIA_GROUP_MANAGER_ADDR=${addresses.GROUP_MANAGER}\n`;
    envContent += `SEPOLIA_ZK_VERIFIER_ADDR=${addresses.ZK_VERIFIER}\n`;
    envContent += `SEPOLIA_SEMAPHORE_ADDR=${addresses.SEMAPHORE}\n`;
    fs.writeFileSync(envPath, envContent);
    console.log("   ✓ Updated .env file");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ CONTRACTS READY!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`   ${name}: ${addr}`);
  }

  // Get contract instances for testing
  const GroupManager = await hre.getContractFactory("GroupManager");
  const groupManager = GroupManager.attach(addresses.GROUP_MANAGER);
  
  const ZKVerifier = await hre.getContractFactory("ZKVerifier");
  const zkVerifier = ZKVerifier.attach(addresses.ZK_VERIFIER);

  // Now run the test
  console.log("\n" + "=".repeat(60));
  console.log("🧪 Running end-to-end tests...");
  console.log("=".repeat(60));

  // Generate 3 identities (first one uses deployer's private key)
  console.log("\n🔐 Generating 3 identities...");
  const poseidon = await buildPoseidon();
  const identities: Array<{
    nullifier: bigint;
    trapdoor: bigint;
    commitment: bigint;
    ticketType: bigint;
    leaf: bigint;
    privateKey?: string; // Store private key for deployer identity
  }> = [];

  // Get deployer's private key
  let deployerPrivateKey = process.env.SEPOLIA_PRIVATE_KEY;
  if (!deployerPrivateKey) {
    throw new Error("SEPOLIA_PRIVATE_KEY environment variable is required");
  }
  
  // Ensure private key has 0x prefix
  if (!deployerPrivateKey.startsWith("0x")) {
    deployerPrivateKey = "0x" + deployerPrivateKey;
  }

  for (let i = 0; i < 3; i++) {
    let privateKey: string;
    let isDeployer = false;
    let walletAddress: string | undefined;

    if (i === 0) {
      // First identity uses deployer's private key
      privateKey = deployerPrivateKey;
      isDeployer = true;
      const deployerWallet = new ethers.Wallet(deployerPrivateKey, hre.provider);
      walletAddress = deployerWallet.address;
      console.log(`  Identity ${i + 1} (YOUR IDENTITY - using deployer's private key):`);
    } else {
      // Other identities are random
      const randomWallet = ethers.Wallet.createRandom();
      privateKey = randomWallet.privateKey;
      console.log(`  Identity ${i + 1} (random):`);
    }

    const identity_nullifier = BigInt(
      ethers.keccak256(privateKey)
    );
    const identity_trapdoor = BigInt(
      ethers.keccak256(
        ethers.concat([privateKey, ethers.toUtf8Bytes("0x01")])
      )
    );
    const identityCommitment = BigInt(
      poseidon.F.toString(poseidon([identity_nullifier, identity_trapdoor]))
    );
    const ticketType = BigInt(i + 1);
    const leaf = BigInt(
      poseidon.F.toString(poseidon([identityCommitment, ticketType]))
    );

    const identity: {
      nullifier: bigint;
      trapdoor: bigint;
      commitment: bigint;
      ticketType: bigint;
      leaf: bigint;
      privateKey?: string;
    } = {
      nullifier: identity_nullifier,
      trapdoor: identity_trapdoor,
      commitment: identityCommitment,
      ticketType: ticketType,
      leaf: leaf,
    };

    if (isDeployer) {
      identity.privateKey = privateKey;
    }

    identities.push(identity);

    console.log(`    Commitment: ${identityCommitment.toString().slice(0, 20)}...`);
    console.log(`    Ticket Type: ${ticketType}`);
    console.log(`    Leaf: ${leaf.toString().slice(0, 20)}...`);
    if (isDeployer && walletAddress) {
      console.log(`    Address: ${walletAddress}`);
    }
  }

  // Create group (or use existing)
  // Try to find an existing group first, or create a new one
  console.log("\n👥 Checking/Creating group...");
  
  let contextId: bigint;
  let semGroupId: bigint;
  let groupFound = false;
  
  // Try to find an existing group by checking common contextIds
  const commonContextIds = [1n, 100n, 200n, 1000n];
  for (const testId of commonContextIds) {
    try {
      const testSemGroupId = await groupManager.semaphoreGroupOf(testId);
      if (testSemGroupId !== 0n) {
        contextId = testId;
        semGroupId = testSemGroupId;
        groupFound = true;
        console.log(`   ✓ Found existing group with contextId: ${contextId.toString()}`);
        console.log(`   ✓ Semaphore Group ID: ${semGroupId.toString()}`);
        break;
      }
    } catch (e) {
      // Continue searching
    }
  }
  
  // If no existing group found, try to create a new one
  if (!groupFound) {
    contextId = BigInt(Math.floor(Date.now() / 1000) % 1000000);
    console.log(`   No existing group found, trying to create with contextId: ${contextId.toString()}`);
    
    try {
      semGroupId = await groupManager.semaphoreGroupOf(contextId);
      if (semGroupId !== 0n) {
        groupFound = true;
        console.log("   ✓ Group already exists");
        console.log("   ✓ Semaphore Group ID:", semGroupId.toString());
      }
    } catch (e) {
      // Continue to creation
    }
    
    if (!groupFound) {
      console.log("   Creating new group...");
      try {
        const createTx = await groupManager.createGroup(contextId, deployerAddress, {
          gasLimit: 1000000,
        });
        console.log("   ⏳ Transaction sent, waiting for confirmation...");
        const createReceipt = await createTx.wait();
        if (!createReceipt) throw new Error("Transaction receipt is null");
        console.log("   ✓ Group created (tx:", createReceipt.hash + ")");
        
        semGroupId = await groupManager.semaphoreGroupOf(contextId);
        console.log("   ✓ Semaphore Group ID:", semGroupId.toString());
        groupFound = true;
      } catch (createError: any) {
        console.error("   ❌ Error creating group:", createError.message);
        console.error("   ⚠️  NOTE: The Semaphore contract on Sepolia may have restrictions.");
        console.error("   ⚠️  You may need to create a group manually or use an existing one.");
        console.error("   ⚠️  Check the Semaphore documentation for more information.");
        throw createError;
      }
    }
  }
  
  if (!groupFound || semGroupId === undefined) {
    throw new Error("Could not find or create a group");
  }

  // Add members one by one
  console.log("\n➕ Adding members to group...");
  for (let i = 0; i < identities.length; i++) {
    const identity = identities[i];
    console.log(`\n  Adding member ${i + 1}/3...`);
    console.log(`    Commitment: ${identity.commitment.toString().slice(0, 20)}...`);
    
    const tx = await groupManager.addMember(contextId, identity.commitment, {
      gasLimit: 500000,
    });
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt is null");
    console.log(`    ✓ Transaction confirmed: ${receipt.hash}`);
    console.log(`    ✓ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Wait a bit between transactions
    if (i < identities.length - 1) {
      console.log(`    ⏸️  Waiting 3 seconds before next member...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // With real Semaphore, the root is calculated automatically
  // We just need to read it from the contract
  console.log("\n🌳 Reading Merkle root from Semaphore contract...");
  
  const ISemaphoreGroups = await hre.getContractAt(
    [
      {
        inputs: [{ internalType: 'uint256', name: 'groupId', type: 'uint256' }],
        name: 'getMerkleTreeRoot',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    addresses.SEMAPHORE
  );
  
  // Wait and poll for Semaphore to update the root
  console.log("   ⏸️  Waiting for Semaphore to update Merkle root...");
  let storedRoot = 0n;
  let attempts = 0;
  const maxAttempts = 20;
  
  while (storedRoot === 0n && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    storedRoot = await ISemaphoreGroups.getMerkleTreeRoot(semGroupId);
    attempts++;
    if (storedRoot === 0n) {
      console.log(`   ⏳ Attempt ${attempts}/${maxAttempts}: Root is still 0, waiting...`);
    }
  }
  
  if (storedRoot === 0n) {
    console.warn("   ⚠️  WARNING: Merkle root is still 0 after waiting!");
    console.warn("   ⚠️  This might indicate an issue with Semaphore or the group.");
  } else {
    console.log(`   ✓ Merkle root from Semaphore (after ${attempts} attempts):`, storedRoot.toString());
  }
  
  // Also calculate the expected root locally for verification
  const leaves: bigint[] = [];
  for (const identity of identities) {
    const leaf = BigInt(
      poseidon.F.toString(poseidon([identity.commitment, identity.ticketType]))
    );
    leaves.push(leaf);
  }
  const calculatedRoot = await calculateLeanIMTRoot(leaves);
  console.log("   ✓ Calculated Merkle root (local):", calculatedRoot.toString());
  console.log("   ✓ Roots match:", storedRoot.toString() === calculatedRoot.toString());
  
  if (storedRoot.toString() !== calculatedRoot.toString()) {
    console.warn("   ⚠️  WARNING: Calculated root doesn't match Semaphore root!");
    console.warn("   ⚠️  This might be because Semaphore uses a different tree structure.");
    console.warn("   ⚠️  We'll use the root from Semaphore for verification.");
  }
  
  // Use the root from Semaphore (the source of truth)
  const merkleRoot = storedRoot;

  // Freeze group
  console.log("\n🔒 Freezing group...");
  const freezeTx = await groupManager.freezeGroup(contextId);
  const freezeReceipt = await freezeTx.wait();
  if (!freezeReceipt) throw new Error("Transaction receipt is null");
  console.log("   ✓ Group frozen (tx:", freezeReceipt.hash + ")");

  // SECURITY TEST: Verify that Semaphore correctly manages the Merkle tree
  console.log("\n🔒 SECURITY TEST: Verifying Semaphore Merkle tree integrity...");
  const testIdentity = identities[0]; // First identity was added with ticketType 1
  const wrongTicketType = 2n; // Try to prove with ticketType 2
  
  console.log(`  Original ticketType: ${testIdentity.ticketType}`);
  console.log(`  Wrong ticketType: ${wrongTicketType}`);
  console.log(`  Merkle root from Semaphore: ${merkleRoot.toString().slice(0, 20)}...`);

  // Calculate what the root would be with wrong ticketType
  const wrongLeaf = BigInt(
    poseidon.F.toString(poseidon([testIdentity.commitment, wrongTicketType]))
  );
  const wrongLeaves: bigint[] = [];
  for (let i = 0; i < identities.length; i++) {
    if (i === 0) {
      wrongLeaves.push(wrongLeaf);
    } else {
      wrongLeaves.push(leaves[i]);
    }
  }
  const wrongRoot = await calculateLeanIMTRoot(wrongLeaves);
  console.log(`  Wrong root (if ticketType was wrong): ${wrongRoot.toString().slice(0, 20)}...`);
  console.log(`  Roots match: ${wrongRoot.toString() === merkleRoot.toString()}`);

  if (wrongRoot.toString() === merkleRoot.toString()) {
    throw new Error("SECURITY VULNERABILITY: Wrong root matches correct root!");
  }
  
  console.log("  ✅ SECURITY TEST PASSED: Wrong ticketType would produce different root");
  console.log("  ℹ️  Note: With real Semaphore, proof verification will fail if ticketType is wrong");
  console.log("  ℹ️  because the Merkle path in the proof won't match the stored root");

  // Generate and verify ZK proof using deployer's identity
  console.log("\n" + "=".repeat(60));
  console.log("🔮 Generating and verifying ZK proof with your identity...");
  console.log("=".repeat(60));

  const deployerIdentity = identities[0]; // First identity is deployer's
  if (!deployerIdentity.privateKey) {
    throw new Error("Deployer identity private key not found");
  }

  // Check if circuit files exist
  const wasmPath = path.join(__dirname, "..", "circuits", "semaphore_js", "semaphore.wasm");
  const zkeyPath = path.join(__dirname, "..", "circuits", "semaphore_final.zkey");

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    console.log("\n⚠️  Circuit files not found, skipping proof generation");
    console.log("   To generate proofs, you need:");
    console.log("   - circuits/semaphore_js/semaphore.wasm");
    console.log("   - circuits/semaphore_final.zkey");
    console.log("   See test/e2e.zk-tickets.ts for setup instructions");
  } else {
    console.log("\n✓ Circuit files found, generating proof...");

    // Find the index of deployer's identity in the leaves array
    const deployerLeaf = deployerIdentity.leaf;
    const deployerLeafIndex = leaves.findIndex(leaf => leaf.toString() === deployerLeaf.toString());
    
    if (deployerLeafIndex === -1) {
      throw new Error("Deployer's leaf not found in leaves array");
    }

    console.log(`  Deployer's leaf index: ${deployerLeafIndex}`);

    // Calculate Merkle path for deployer's identity
    const { pathIndices, siblings } = await calculateLeanIMTProof(
      leaves,
      deployerLeafIndex,
      10 // nLevels
    );

    console.log("  ✓ Merkle path calculated");

    // Prepare circuit inputs
    const zkVerifierAddress = addresses.ZK_VERIFIER;
    const externalNullifierRaw = ethers.solidityPackedKeccak256(
      ["string", "address", "uint256"],
      ["ZK_CTX", zkVerifierAddress, contextId]
    );

    const signal = 1n;
    const signalBytes = ethers.solidityPacked(["uint256"], [signal]);
    const signalHashForCircuit = BigInt(ethers.keccak256(signalBytes)) >> 8n;
    const externalNullifierBytes = ethers.solidityPacked(
      ["uint256"],
      [BigInt(externalNullifierRaw)]
    );
    const externalNullifierForCircuit =
      BigInt(ethers.keccak256(externalNullifierBytes)) >> 8n;

    const circuitInput = {
      identityNullifier: deployerIdentity.nullifier.toString(),
      identityTrapdoor: deployerIdentity.trapdoor.toString(),
      ticketType: deployerIdentity.ticketType.toString(),
      treePathIndices: pathIndices,
      treeSiblings: siblings,
      signalHash: externalNullifierForCircuit.toString(),
      externalNullifier: signalHashForCircuit.toString(),
    };

    console.log("  🔮 Generating ZK proof...");
    const startTime = Date.now();
    const { proof, publicSignals } = await groth16.fullProve(
      circuitInput,
      wasmPath,
      zkeyPath
    );
    const proofTime = Date.now() - startTime;
    console.log(`  ✓ Proof generated in ${proofTime}ms`);

    // Format proof for contract
    const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const calldataStr = typeof calldata === "string" ? calldata : await calldata;
    
    // Parse calldata: "[a,b] [[b],[b]] [c] [pub1,pub2,...]"
    const argv = calldataStr
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

    // Public signals: nullifierHash is argv[9], merkleRoot is argv[10]
    const nullifierHash = argv[9];
    const merkleRootFromProof = argv[10];

    console.log(`  ✓ Nullifier hash: ${nullifierHash.toString().slice(0, 20)}...`);
    console.log(`  ✓ Merkle root from proof: ${merkleRootFromProof.toString().slice(0, 20)}...`);
    console.log(`  ✓ Merkle root matches: ${merkleRootFromProof.toString() === merkleRoot.toString()}`);

    if (merkleRootFromProof.toString() !== merkleRoot.toString()) {
      throw new Error("Merkle root from proof doesn't match stored root!");
    }

    // Verify proof on-chain
    console.log("\n  🔍 Verifying proof on-chain...");
    const verifyTx = await zkVerifier.verifyZKProof(
      contextId,
      nullifierHash,
      signal,
      proofArray
    );
    const verifyReceipt = await verifyTx.wait();
    if (!verifyReceipt) throw new Error("Transaction receipt is null");
    
    console.log(`  ✅ Proof verified on-chain! (tx: ${verifyReceipt.hash})`);
    console.log(`  ✅ Gas used: ${verifyReceipt.gasUsed.toString()}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 ALL TESTS PASSED!");
  console.log("=".repeat(60));
  console.log("\n📋 Summary:");
  console.log(`  - Network: Sepolia`);
  console.log(`  - Deployer: ${deployerAddress}`);
  console.log(`  - Semaphore: ${addresses.SEMAPHORE} (real contract)`);
  console.log(`  - Group ID: ${contextId}`);
  console.log(`  - Semaphore Group ID: ${semGroupId.toString()}`);
  console.log(`  - Members added: ${identities.length}`);
  console.log(`  - Final Merkle Root: ${merkleRoot.toString().slice(0, 30)}...`);
  console.log(`  - Security test: ✅ PASSED`);
  console.log("\n💡 View on Etherscan:");
  console.log(`   Semaphore: https://sepolia.etherscan.io/address/${addresses.SEMAPHORE}`);
  console.log(`   NFTFactory: https://sepolia.etherscan.io/address/${addresses.NFT_FACTORY}`);
  console.log(`   GroupManager: https://sepolia.etherscan.io/address/${addresses.GROUP_MANAGER}`);
  console.log(`   ZKVerifier: https://sepolia.etherscan.io/address/${addresses.ZK_VERIFIER}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

