import * as https from "https";
import * as http from "http";

/**
 * Request ETH from Sepolia faucets
 * 
 * Usage:
 *   npx tsx scripts/request-sepolia-faucet.ts
 * 
 * Or set environment variables:
 *   ALCHEMY_API_KEY - Your Alchemy API key (optional, for Alchemy faucet)
 */
async function main() {
  const address = "0xaa8b40254ce796b40e609df0c8269c735e5c67d4";
  
  console.log("🚰 Requesting ETH from Sepolia faucets...");
  console.log(`📍 Address: ${address}\n`);

  // Try multiple faucets
  const faucets = [
    {
      name: "Alchemy Faucet",
      url: `https://eth-sepolia.g.alchemy.com/v2/demo`,
      method: "POST",
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_requestFunds",
        params: [address],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    },
    {
      name: "QuickNode Faucet",
      url: "https://faucet.quicknode.com/ethereum/sepolia",
      method: "POST",
      body: JSON.stringify({
        address: address,
        network: "ethereum-sepolia",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    },
  ];

  // Try Alchemy first (most reliable)
  console.log("1️⃣  Trying Alchemy Faucet...");
  try {
    await requestFaucet(faucets[0], address);
    console.log("✅ Success! Check your wallet in a few minutes.\n");
    return;
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}\n`);
  }

  // Try QuickNode
  console.log("2️⃣  Trying QuickNode Faucet...");
  try {
    await requestFaucet(faucets[1], address);
    console.log("✅ Success! Check your wallet in a few minutes.\n");
    return;
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}\n`);
  }

  // Manual faucet links
  console.log("📋 Manual Faucet Links:");
  console.log("   You can manually request ETH from these faucets:");
  console.log(`   1. Alchemy: https://sepoliafaucet.com/`);
  console.log(`   2. Infura: https://www.infura.io/faucet/sepolia`);
  console.log(`   3. QuickNode: https://faucet.quicknode.com/ethereum/sepolia`);
  console.log(`   4. PoW Faucet: https://sepolia-faucet.pk910.de/`);
  console.log(`\n   Your address: ${address}`);
  console.log("\n   Copy your address and paste it in any of the above faucets.");
}

function requestFaucet(faucet: any, address: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(faucet.url);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: faucet.method,
      headers: faucet.headers,
    };

    const client = url.protocol === "https:" ? https : http;

    const req = client.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || "Faucet error"));
            } else {
              console.log(`   ✓ Request submitted successfully`);
              resolve();
            }
          } catch (e) {
            // Some faucets return plain text
            if (data.includes("success") || data.includes("Success")) {
              console.log(`   ✓ Request submitted successfully`);
              resolve();
            } else {
              reject(new Error("Unexpected response format"));
            }
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (faucet.body) {
      req.write(faucet.body);
    }

    req.end();
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

