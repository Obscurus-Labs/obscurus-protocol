import { network } from "hardhat";
import { ethers } from "ethers";

async function main() {
  const { ethers: hre } = await network.connect();
  const [deployer] = await hre.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log("Deployer:", deployerAddress);
  
  const groupManagerAddr = "0xa0fE24e38bc346999D00D525A3bd7133De480Df5";
  const semaphoreAddr = "0x3889927F0B5Eb1a02C6E2C20b39a1Bd4EAd76131";
  
  const GroupManager = await hre.getContractFactory("GroupManager");
  const groupManager = GroupManager.attach(groupManagerAddr);
  
  // Try to call createGroup with staticCall to see the error
  const contextId = 999999n;
  console.log(`\nTrying to create group with contextId: ${contextId.toString()}`);
  
  try {
    // First, check if we can call the Semaphore contract directly
    console.log("\n1. Testing direct Semaphore call...");
    const SemaphoreABI = [
      "function createGroup(address admin) external returns (uint256)",
      "function createGroup() external returns (uint256)",
    ];
    const semaphore = await hre.getContractAt(SemaphoreABI, semaphoreAddr);
    
    try {
      // Try calling createGroup() without admin
      const result1 = await semaphore.createGroup.staticCall();
      console.log("   ✓ createGroup() works, would return:", result1.toString());
    } catch (e: any) {
      console.log("   ❌ createGroup() failed:", e.message);
    }
    
    try {
      // Try calling createGroup(address) with GroupManager address
      const result2 = await semaphore.createGroup.staticCall(groupManagerAddr);
      console.log("   ✓ createGroup(address) works, would return:", result2.toString());
    } catch (e: any) {
      console.log("   ❌ createGroup(address) failed:", e.message);
      if (e.data) {
        console.log("   Error data:", e.data);
      }
    }
    
    // Now try through GroupManager
    console.log("\n2. Testing GroupManager.createGroup...");
    try {
      const result = await groupManager.createGroup.staticCall(contextId, deployerAddress);
      console.log("   ✓ createGroup would succeed, result:", result);
    } catch (e: any) {
      console.log("   ❌ createGroup failed:", e.message);
      if (e.data) {
        console.log("   Error data:", e.data);
        // Try to decode the error
        try {
          const errorInterface = new ethers.Interface([
            "error GroupAlreadyInitialized()",
            "error Unauthorized()",
            "error GroupNotInitialized()",
            "error GroupAlreadyFrozen()",
          ]);
          const decoded = errorInterface.parseError(e.data);
          console.log("   Decoded error:", decoded?.name);
        } catch (decodeError) {
          console.log("   Could not decode error");
        }
      }
    }
    
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

