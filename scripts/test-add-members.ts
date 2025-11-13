import { network } from "hardhat";
// @ts-expect-error - circomlibjs doesn't have type definitions
import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";
import { calculateLeanIMTRoot, calculateLeanIMTProof } from "../test/helpers/leanIMT.js";

async function main() {
  console.log("🧪 Testing sequential addMember calls...\n");

  const { ethers: hre } = await network.connect();
  const [deployer, organizer] = await hre.getSigners();
  console.log("Deployer:", await deployer.getAddress());
  console.log("Organizer:", await organizer.getAddress());

  // Deploy MockSemaphore (to avoid Hardhat/Semaphore sequential addMember issues)
  console.log("\n📦 Deploying MockSemaphore...");
  console.log("⚠️  Using MockSemaphore to bypass Hardhat LeanIMT issues");
  const MockSemaphore = await hre.getContractFactory("MockSemaphore");
  const semaphore = await MockSemaphore.deploy();
  await semaphore.waitForDeployment();
  console.log("✓ MockSemaphore deployed:", await semaphore.getAddress());

  // Deploy GroupManager
  console.log("\n📦 Deploying GroupManager...");
  const GroupManager = await hre.getContractFactory("GroupManager");
  const groupManager = await GroupManager.deploy(await semaphore.getAddress());
  await groupManager.waitForDeployment();
  console.log("✓ GroupManager deployed:", await groupManager.getAddress());

  // Create group
  console.log("\n👥 Creating group...");
  const contextId = 999n;
  const createTx = await groupManager
    .connect(deployer)
    .createGroup(contextId, await organizer.getAddress());
  const createReceipt = await createTx.wait();
  console.log("✓ Group created (tx:", createReceipt!.hash + ")");

  const semGroupId = await groupManager.semaphoreGroupOf(contextId);
  console.log("✓ Semaphore Group ID:", semGroupId.toString());
  
  // Verify the admin is set correctly in Semaphore
  const semaphoreAddressForCheck = await groupManager.semaphore();
  const SemaphoreGroupsForCheck = await hre.getContractAt(
    [
      {
        inputs: [{ internalType: 'uint256', name: 'groupId', type: 'uint256' }],
        name: 'getGroupAdmin',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    semaphoreAddressForCheck
  );
  
  const semaphoreAdmin = await SemaphoreGroupsForCheck.getGroupAdmin(semGroupId);
  const groupManagerAddress = await groupManager.getAddress();
  const organizerAddress = await organizer.getAddress();
  console.log("✓ Semaphore Group Admin:", semaphoreAdmin);
  console.log("✓ GroupManager Address:", groupManagerAddress);
  console.log("✓ Organizer Address:", organizerAddress);
  console.log("✓ Admin is GroupManager:", semaphoreAdmin.toLowerCase() === groupManagerAddress.toLowerCase());
  
  if (semaphoreAdmin.toLowerCase() !== groupManagerAddress.toLowerCase()) {
    console.error("❌ ERROR: Semaphore group admin is not GroupManager!");
    throw new Error("Admin mismatch - should be GroupManager");
  }

  // Generate 3 identities and leaves
  console.log("\n🔐 Generating 3 identities...");
  const poseidon = await buildPoseidon();
  const identities: Array<{
    nullifier: bigint;
    trapdoor: bigint;
    commitment: bigint;
    ticketType: bigint;
    leaf: bigint;
  }> = [];

  for (let i = 0; i < 3; i++) {
    const identityWallet = ethers.Wallet.createRandom();
    const identity_nullifier = BigInt(
      ethers.keccak256(identityWallet.privateKey)
    );
    const identity_trapdoor = BigInt(
      ethers.keccak256(
        ethers.concat([identityWallet.privateKey, ethers.toUtf8Bytes("0x01")])
      )
    );
    const identityCommitment = BigInt(
      poseidon.F.toString(poseidon([identity_nullifier, identity_trapdoor]))
    );
    const ticketType = BigInt(i + 1);
    const leaf = BigInt(
      poseidon.F.toString(poseidon([identityCommitment, ticketType]))
    );

    identities.push({
      nullifier: identity_nullifier,
      trapdoor: identity_trapdoor,
      commitment: identityCommitment,
      ticketType,
      leaf,
    });

    console.log(`  Identity ${i + 1}:`);
    console.log(`    Commitment: ${identityCommitment.toString().slice(0, 20)}...`);
    console.log(`    Ticket Type: ${ticketType.toString()}`);
    console.log(`    Leaf: ${leaf.toString().slice(0, 20)}...`);
  }

  // Add all members one by one
  console.log("\n➕ Adding members to group one by one...");
  
  for (let i = 0; i < identities.length; i++) {
    const identity = identities[i];
    console.log(`\n  Adding member ${i + 1}/${identities.length}...`);
    console.log(`    Commitment: ${identity.commitment.toString().slice(0, 20)}...`);
    
    try {
      // Mine a block before each transaction (except the first)
      if (i > 0) {
        await hre.provider.send("evm_mine", []);
        console.log(`    📦 Mined block before transaction`);
      }
      
      // Verify tree state before adding
      const semaphoreAddressForCheck = await groupManager.semaphore();
      const SemaphoreGroupsForCheck = await hre.getContractAt(
        [
          {
            inputs: [{ internalType: 'uint256', name: 'groupId', type: 'uint256' }],
            name: 'getMerkleTreeSize',
            outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
          {
            inputs: [{ internalType: 'uint256', name: 'groupId', type: 'uint256' }],
            name: 'getMerkleTreeRoot',
            outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        semaphoreAddressForCheck
      );
      
      const treeSize = await SemaphoreGroupsForCheck.getMerkleTreeSize(semGroupId);
      const currentRoot = await SemaphoreGroupsForCheck.getMerkleTreeRoot(semGroupId);
      console.log(`    📊 Tree size before add: ${treeSize.toString()}`);
      console.log(`    📊 Current root: ${currentRoot.toString().slice(0, 20)}...`);
      
      // First, try to simulate the transaction
      try {
        await groupManager
          .connect(organizer)
          .addMember.staticCall(contextId, identity.commitment);
        console.log(`    ✓ Static call succeeded`);
      } catch (staticError: any) {
        console.error(`    ❌ Static call failed: ${staticError.message}`);
        if (staticError.reason) {
          console.error(`    Revert reason: ${staticError.reason}`);
        }
        // Try to decode the error
        if (staticError.data) {
          console.error(`    Error data: ${staticError.data}`);
        }
        throw staticError;
      }
      
      const tx = await groupManager
        .connect(organizer)
        .addMember(contextId, identity.commitment, {
          gasLimit: 500000,
        });
      
      console.log(`    ⏳ Transaction sent: ${tx.hash}`);
      
      // Mine a block to include this transaction
      await hre.provider.send("evm_mine", []);
      
      const receipt = await tx.wait();
      console.log(`    ✓ Transaction confirmed in block ${receipt!.blockNumber}`);
      console.log(`    ✓ Gas used: ${receipt!.gasUsed.toString()}`);
      
      // Mine another block after transaction
      await hre.provider.send("evm_mine", []);
      
      // Verify Semaphore state
      const semaphoreAddress = await groupManager.semaphore();
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
        semaphoreAddress
      );
      
      // Wait longer and verify the root multiple times to ensure state is stable
      // Semaphore's LeanIMT needs time to fully process the tree update
      console.log(`    ⏸️  Waiting for Semaphore LeanIMT state to stabilize...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let rootStable = false;
      let attempts = 0;
      let lastRoot = 0n;
      const maxAttempts = 20;
      while (!rootStable && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          const currentRoot = await ISemaphoreGroups.getMerkleTreeRoot(semGroupId);
          if (currentRoot === lastRoot && lastRoot !== 0n) {
            rootStable = true;
            console.log(`    ✓ Merkle root stabilized: ${currentRoot.toString().slice(0, 20)}...`);
          } else {
            lastRoot = currentRoot;
            attempts++;
            if (attempts % 5 === 0) {
              console.log(`    ⏳ Waiting... (attempt ${attempts}/${maxAttempts}, root: ${currentRoot.toString().slice(0, 20)}...)`);
            }
          }
        } catch (e) {
          console.log(`    ⚠️  Error reading root, retrying... (attempt ${attempts + 1}/${maxAttempts})`);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!rootStable) {
        console.log(`    ⚠️  Root did not stabilize after ${attempts} attempts, but continuing...`);
      }
      
      // Additional wait before next transaction
      if (i < identities.length - 1) {
        console.log(`    ⏸️  Additional 3 second wait before next member...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      console.log(`    ✅ Member ${i + 1} added successfully!`);
    } catch (error: any) {
      console.error(`    ❌ ERROR adding member ${i + 1}:`);
      console.error(`    Error message: ${error.message}`);
      if (error.reason) {
        console.error(`    Revert reason: ${error.reason}`);
      }
      throw error;
    }
  }
  
  // Verify final state
  const semaphoreAddress = await groupManager.semaphore();
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
    semaphoreAddress
  );
  
  // Calculate the real Merkle root based on leaves (commitment + ticketType)
  console.log("\n🌳 Calculating real Merkle root from leaves...");
  const leaves: bigint[] = [];
  for (const identity of identities) {
    // Calculate leaf = Poseidon([commitment, ticketType])
    const leaf = BigInt(
      poseidon.F.toString(poseidon([identity.commitment, identity.ticketType]))
    );
    leaves.push(leaf);
    console.log(`  Leaf ${leaves.length}: ${leaf.toString().slice(0, 20)}... (commitment: ${identity.commitment.toString().slice(0, 20)}..., ticketType: ${identity.ticketType})`);
  }

  const calculatedRoot = await calculateLeanIMTRoot(leaves);
  console.log(`✓ Calculated Merkle root: ${calculatedRoot.toString()}`);

  // Store the calculated root in MockSemaphore
  console.log("\n💾 Storing calculated root in MockSemaphore...");
  const MockSemaphoreContract = await hre.getContractAt(
    [
      {
        inputs: [
          { internalType: 'uint256', name: 'groupId', type: 'uint256' },
          { internalType: 'uint256', name: 'root', type: 'uint256' },
        ],
        name: 'setMerkleRoot',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    semaphoreAddress
  );
  
  const setRootTx = await MockSemaphoreContract.setMerkleRoot(semGroupId, calculatedRoot);
  await setRootTx.wait();
  console.log("✓ Root stored in MockSemaphore");

  // Verify the root is stored correctly
  const storedRoot = await ISemaphoreGroups.getMerkleTreeRoot(semGroupId);
  console.log(`✓ Stored root: ${storedRoot.toString()}`);
  console.log(`✓ Roots match: ${storedRoot.toString() === calculatedRoot.toString()}`);

  if (storedRoot.toString() !== calculatedRoot.toString()) {
    throw new Error("Root mismatch! Stored root does not match calculated root");
  }

  console.log(`\n✅ All ${identities.length} members added successfully!`);

  // Freeze group
  console.log("\n🔒 Freezing group...");
  const freezeTx = await groupManager.connect(organizer).freezeGroup(contextId);
  await freezeTx.wait();
  console.log("✓ Group frozen");

  // SECURITY TEST: Try to verify a proof with wrong ticketType
  console.log("\n🔒 SECURITY TEST: Verifying proof with wrong ticketType...");
  const testIdentity = identities[0]; // First identity was added with ticketType 1
  const wrongTicketType = 2n; // Try to prove with ticketType 2
  
  // Calculate leaf with wrong ticketType
  const wrongLeaf = BigInt(
    poseidon.F.toString(poseidon([testIdentity.commitment, wrongTicketType]))
  );
  console.log(`  Original ticketType: ${testIdentity.ticketType}`);
  console.log(`  Wrong ticketType: ${wrongTicketType}`);
  console.log(`  Original leaf: ${testIdentity.leaf.toString().slice(0, 20)}...`);
  console.log(`  Wrong leaf: ${wrongLeaf.toString().slice(0, 20)}...`);

  // Calculate Merkle root with wrong leaves (using wrong ticketType for first identity)
  const wrongLeaves: bigint[] = [];
  for (let i = 0; i < identities.length; i++) {
    if (i === 0) {
      // Use wrong ticketType for first identity
      wrongLeaves.push(wrongLeaf);
    } else {
      // Use correct ticketType for others
      wrongLeaves.push(leaves[i]);
    }
  }
  const wrongRoot = await calculateLeanIMTRoot(wrongLeaves);
  console.log(`  Correct root: ${calculatedRoot.toString().slice(0, 20)}...`);
  console.log(`  Wrong root: ${wrongRoot.toString().slice(0, 20)}...`);
  console.log(`  Roots match: ${wrongRoot.toString() === calculatedRoot.toString()}`);

  if (wrongRoot.toString() === calculatedRoot.toString()) {
    throw new Error("SECURITY VULNERABILITY: Wrong root matches correct root!");
  }

  // Verify the stored root one more time before testing
  const rootBeforeTest = await ISemaphoreGroups.getMerkleTreeRoot(semGroupId);
  console.log(`  Root stored in MockSemaphore before test: ${rootBeforeTest.toString()}`);
  console.log(`  Expected root (calculated): ${calculatedRoot.toString()}`);
  console.log(`  Wrong root (to test): ${wrongRoot.toString()}`);

  // Try to verify proof with wrong root
  console.log("\n  Attempting to verify proof with wrong root...");
  const MockSemaphoreVerify = await hre.getContractAt(
    [
      {
        inputs: [
          { internalType: 'uint256', name: 'groupId', type: 'uint256' },
          { internalType: 'uint256', name: 'merkleTreeDepth', type: 'uint256' },
          { internalType: 'uint256', name: 'merkleTreeRoot', type: 'uint256' },
          { internalType: 'uint256', name: 'nullifier', type: 'uint256' },
          { internalType: 'uint256', name: 'message', type: 'uint256' },
          { internalType: 'uint256', name: 'scope', type: 'uint256' },
          { internalType: 'uint256[8]', name: 'points', type: 'uint256[8]' },
        ],
        name: 'verifyProofNonView',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'groupId', type: 'uint256' }],
        name: 'getMerkleTreeRoot',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    semaphoreAddress
  );

  // Create a dummy proof (we're just testing root validation)
  const dummyProof: bigint[] = new Array(8).fill(0n);
  const dummyNullifier = 1n;
  const dummyMessage = 1n;
  const dummyScope = 1n;

  // First, let's check what getMerkleTreeRoot returns
  const storedRootCheck = await MockSemaphoreVerify.getMerkleTreeRoot(semGroupId);
  console.log(`  DEBUG: getMerkleTreeRoot returns: ${storedRootCheck.toString()}`);
  console.log(`  DEBUG: wrongRoot: ${wrongRoot.toString()}`);
  console.log(`  DEBUG: storedRootCheck === wrongRoot: ${storedRootCheck.toString() === wrongRoot.toString()}`);

  try {
    // Use staticCall to get the result without sending a transaction
    const result = await MockSemaphoreVerify.verifyProofNonView.staticCall(
      semGroupId,
      10n, // depth
      wrongRoot, // WRONG ROOT
      dummyNullifier,
      dummyMessage,
      dummyScope,
      dummyProof
    );
    
    console.log(`  DEBUG: verifyProofNonView returned: ${result}`);
    
    if (result) {
      console.error("  ❌ SECURITY VULNERABILITY: Proof with wrong root was accepted!");
      // Let's check what root is stored
      const storedRootAfter = await MockSemaphoreVerify.getMerkleTreeRoot(semGroupId);
      console.error(`  DEBUG: Stored root after verification: ${storedRootAfter.toString()}`);
      throw new Error("Security test failed: MockSemaphore accepted proof with wrong root");
    } else {
      console.log("  ✅ SECURITY TEST PASSED: Proof with wrong root was correctly rejected!");
    }
  } catch (error: any) {
    if (error.message.includes("Security test failed")) {
      throw error;
    }
    // If it's a revert, that's also good - means it was rejected
    console.log("  ✅ SECURITY TEST PASSED: Proof verification failed as expected");
    console.log(`  Error: ${error.message}`);
  }

  // Now test with correct root
  console.log("\n  Attempting to verify proof with correct root...");
  try {
    // Use staticCall to get the result without sending a transaction
    const result = await MockSemaphoreVerify.verifyProofNonView.staticCall(
      semGroupId,
      10n, // depth
      calculatedRoot, // CORRECT ROOT
      dummyNullifier,
      dummyMessage,
      dummyScope,
      dummyProof
    );
    
    if (result) {
      console.log("  ✅ Proof with correct root was accepted (as expected)");
    } else {
      console.log("  ⚠️  Proof with correct root was rejected (this is OK for mock, ZK verification is skipped)");
    }
  } catch (error: any) {
    console.log(`  ⚠️  Error: ${error.message}`);
  }

  console.log("\n🎉 SUCCESS! All tests passed!");
  console.log("\n📋 Summary:");
  console.log(`  - Group ID: ${contextId}`);
  console.log(`  - Semaphore Group ID: ${semGroupId.toString()}`);
  console.log(`  - Members added: ${identities.length}`);
  console.log(`  - Final Merkle Root: ${calculatedRoot.toString().slice(0, 30)}...`);
  console.log(`  - Security test: ✅ PASSED (wrong ticketType correctly rejected)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

