import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const recipient = "0xAA8B40254CE796B40E609df0c8269C735E5c67d4";

  console.log("Sending ETH to:", recipient);
  console.log("From:", await deployer.getAddress());

  const balanceBefore = await ethers.provider.getBalance(recipient);
  console.log("Balance before:", ethers.formatEther(balanceBefore), "ETH");

  const tx = await deployer.sendTransaction({
    to: recipient,
    value: ethers.parseEther("100.0"),
  });

  console.log("Transaction hash:", tx.hash);
  await tx.wait();

  const balanceAfter = await ethers.provider.getBalance(recipient);
  console.log("Balance after:", ethers.formatEther(balanceAfter), "ETH");
  console.log("✅ Funds sent successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


