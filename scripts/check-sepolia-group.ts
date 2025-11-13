import { network } from "hardhat";

async function main() {
  const { ethers: hre } = await network.connect();
  const [deployer] = await hre.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log("Deployer:", deployerAddress);
  
  const groupManagerAddr = "0xa0fE24e38bc346999D00D525A3bd7133De480Df5";
  const semaphoreAddr = "0x3889927F0B5Eb1a02C6E2C20b39a1Bd4EAd76131";
  
  const GroupManager = await hre.getContractFactory("GroupManager");
  const groupManager = GroupManager.attach(groupManagerAddr);
  
  const contextId = 1n;
  const semGroupId = await groupManager.semaphoreGroupOf(contextId);
  console.log(`\nGroup ID ${contextId}: ${semGroupId.toString()}`);
  
  if (semGroupId === 0n) {
    console.log("Group doesn't exist, trying to create...");
    
    // Check Semaphore contract
    const SemaphoreABI = [
      "function createGroup(address admin) external returns (uint256)",
      "function groupCounter() external view returns (uint256)",
    ];
    const semaphore = await hre.getContractAt(SemaphoreABI, semaphoreAddr);
    const counter = await semaphore.groupCounter();
    console.log(`Semaphore groupCounter: ${counter.toString()}`);
    
    try {
      const result = await groupManager.createGroup.staticCall(contextId, deployerAddress);
      console.log("Static call succeeded:", result);
    } catch (e: any) {
      console.log("Static call failed:", e.message);
      if (e.data) {
        console.log("Error data:", e.data);
      }
    }
  } else {
    console.log("Group exists!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

