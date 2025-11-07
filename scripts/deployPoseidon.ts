import { network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploys PoseidonT3 library and updates hardhat.config.ts with its address
 */
async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  console.log("Deploying PoseidonT3 library with account:", await deployer.getAddress());

  // Deploy PoseidonT3 wrapper (library is included in bytecode)
  const PoseidonWrapper = await ethers.getContractFactory("PoseidonT3Wrapper");
  const poseidonWrapper = await PoseidonWrapper.deploy();
  await poseidonWrapper.waitForDeployment();

  const poseidonAddress = await poseidonWrapper.getAddress();
  console.log("✓ PoseidonT3 wrapper deployed to:", poseidonAddress);
  console.log("⚠️  Note: Library linking happens at compile time");

  // Update .env file
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
    // Remove old POSEIDON_ADDR if exists
    envContent = envContent.replace(/POSEIDON_ADDR=.*\n/g, "");
  }
  envContent += `POSEIDON_ADDR=${poseidonAddress}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log("✓ Updated .env with POSEIDON_ADDR");

  // Update hardhat.config.ts with the Poseidon address
  const configPath = path.join(__dirname, "..", "hardhat.config.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");
  // Replace the zero address placeholder with actual address
  configContent = configContent.replace(
    /0x0000000000000000000000000000000000000000/g,
    poseidonAddress
  );
  fs.writeFileSync(configPath, configContent);
  console.log("✓ Updated hardhat.config.ts with Poseidon address");

  console.log("\n⚠️  IMPORTANT: Recompile contracts after updating config:");
  console.log("   npx hardhat compile");

  return poseidonAddress;
}

main()
  .then((address) => {
    console.log("\n✅ Poseidon deployment complete:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

