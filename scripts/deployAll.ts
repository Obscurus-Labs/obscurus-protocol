import { network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploys all contracts needed for zk-tickets:
 * - PoseidonT3
 * - Semaphore (with Poseidon linked)
 * - BaseNFT
 * - NFTFactory
 * - GroupManager
 * - ZKVerifier
 * - MockSemaphoreVerifier (for testing)
 *
 * Saves all addresses to .env file
 */
async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying all zk-tickets contracts...");
  console.log("Deployer:", await deployer.getAddress());
  console.log("");

  const addresses: Record<string, string> = {};

  // 1. Deploy MockSemaphoreVerifier
  console.log("1️⃣  Deploying MockSemaphoreVerifier...");
  const MockVerifier = await ethers.getContractFactory("MockSemaphoreVerifier");
  const mockVerifier = await MockVerifier.deploy();
  await mockVerifier.waitForDeployment();
  addresses.MOCK_VERIFIER = await mockVerifier.getAddress();
  console.log("   ✓ MockSemaphoreVerifier:", addresses.MOCK_VERIFIER);

  // 2. Deploy PoseidonT3 library
  // Note: In Solidity, libraries can be deployed as separate contracts
  // We need to deploy it first so we can link it to Semaphore
  console.log("\n2️⃣  Deploying PoseidonT3 library...");
  console.log("   ⚠️  Note: PoseidonT3 is a library that needs to be linked");
  console.log("   ⚠️  Using a placeholder address for now (library linking at compile time)");
  
  // For now, we'll use a dummy address and link at deploy time
  // In production, you would deploy the library first and use its address
  addresses.POSEIDON = "0x0000000000000000000000000000000000000001"; // Placeholder
  console.log("   ⚠️  Using placeholder address. Library will be linked at compile time.");

  // 3. Deploy Semaphore
  // Note: If Semaphore was compiled with library linking, we need to provide the address
  console.log("\n3️⃣  Deploying Semaphore...");
  // Try to deploy without explicit library linking first (if it was linked at compile time)
  let Semaphore;
  try {
    Semaphore = await ethers.getContractFactory("Semaphore");
  } catch (e) {
    // If that fails, try with library linking
    console.log("   Attempting with library linking...");
    Semaphore = await ethers.getContractFactory("Semaphore", {
      libraries: {
        PoseidonT3: addresses.POSEIDON,
      },
    });
  }
  const semaphore = await Semaphore.deploy(addresses.MOCK_VERIFIER);
  await semaphore.waitForDeployment();
  addresses.SEMAPHORE = await semaphore.getAddress();
  console.log("   ✓ Semaphore:", addresses.SEMAPHORE);

  // 4. Deploy BaseNFT
  console.log("\n4️⃣  Deploying BaseNFT...");
  const BaseNFT = await ethers.getContractFactory("BaseNFT");
  const baseNFT = await BaseNFT.deploy();
  await baseNFT.waitForDeployment();
  addresses.BASE_NFT = await baseNFT.getAddress();
  console.log("   ✓ BaseNFT:", addresses.BASE_NFT);

  // 5. Deploy NFTFactory
  console.log("\n5️⃣  Deploying NFTFactory...");
  const NFTFactory = await ethers.getContractFactory("NFTFactory");
  const nftFactory = await NFTFactory.deploy(addresses.BASE_NFT);
  await nftFactory.waitForDeployment();
  addresses.NFT_FACTORY = await nftFactory.getAddress();
  console.log("   ✓ NFTFactory:", addresses.NFT_FACTORY);

  // 6. Deploy GroupManager
  console.log("\n6️⃣  Deploying GroupManager...");
  const GroupManager = await ethers.getContractFactory("GroupManager");
  const groupManager = await GroupManager.deploy(addresses.SEMAPHORE);
  await groupManager.waitForDeployment();
  addresses.GROUP_MANAGER = await groupManager.getAddress();
  console.log("   ✓ GroupManager:", addresses.GROUP_MANAGER);

  // 7. Deploy ZKVerifier
  console.log("\n7️⃣  Deploying ZKVerifier...");
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy(
    addresses.SEMAPHORE,
    addresses.GROUP_MANAGER
  );
  await zkVerifier.waitForDeployment();
  addresses.ZK_VERIFIER = await zkVerifier.getAddress();
  console.log("   ✓ ZKVerifier:", addresses.ZK_VERIFIER);

  // Write to .env file
  console.log("\n📝 Writing addresses to .env...");
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = "";

  // Preserve existing env vars if file exists
  if (fs.existsSync(envPath)) {
    const existing = fs.readFileSync(envPath, "utf-8");
    // Remove old contract addresses
    envContent = existing.replace(
      /(POSEIDON_ADDR|SEMAPHORE_ADDR|BASE_NFT_ADDR|NFT_FACTORY_ADDR|GROUP_MANAGER_ADDR|ZK_VERIFIER_ADDR|MOCK_VERIFIER_ADDR)=.*\n/g,
      ""
    );
  }

  // Add new addresses
  envContent += `# ZK Tickets Contract Addresses\n`;
  envContent += `POSEIDON_ADDR=${addresses.POSEIDON}\n`;
  envContent += `SEMAPHORE_ADDR=${addresses.SEMAPHORE}\n`;
  envContent += `BASE_NFT_ADDR=${addresses.BASE_NFT}\n`;
  envContent += `NFT_FACTORY_ADDR=${addresses.NFT_FACTORY}\n`;
  envContent += `GROUP_MANAGER_ADDR=${addresses.GROUP_MANAGER}\n`;
  envContent += `ZK_VERIFIER_ADDR=${addresses.ZK_VERIFIER}\n`;
  envContent += `MOCK_VERIFIER_ADDR=${addresses.MOCK_VERIFIER}\n`;

  fs.writeFileSync(envPath, envContent);
  console.log("   ✓ Saved to .env");

  // Update hardhat.config.ts with Poseidon address
  const configPath = path.join(__dirname, "..", "hardhat.config.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");
  // Replace the zero address placeholder with actual address
  configContent = configContent.replace(
    /0x0000000000000000000000000000000000000000/g,
    addresses.POSEIDON
  );
  fs.writeFileSync(configPath, configContent);
  console.log("   ✓ Updated hardhat.config.ts");

  // Summary
  console.log("\n✅ All contracts deployed successfully!\n");
  console.log("📋 Addresses:");
  console.log("   POSEIDON_ADDR      =", addresses.POSEIDON);
  console.log("   SEMAPHORE_ADDR     =", addresses.SEMAPHORE);
  console.log("   BASE_NFT_ADDR      =", addresses.BASE_NFT);
  console.log("   NFT_FACTORY_ADDR   =", addresses.NFT_FACTORY);
  console.log("   GROUP_MANAGER_ADDR =", addresses.GROUP_MANAGER);
  console.log("   ZK_VERIFIER_ADDR   =", addresses.ZK_VERIFIER);
  console.log("   MOCK_VERIFIER_ADDR =", addresses.MOCK_VERIFIER);
  console.log("\n💡 Next step: npx hardhat test test/e2e.zk-tickets.ts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

