import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Poseidon address from .env if it exists
let poseidonAddress: string | undefined = undefined;
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/POSEIDON_ADDR=(0x[a-fA-F0-9]+)/);
  if (match) {
    poseidonAddress = match[1];
  }
}

// Only configure libraries if we have a valid Poseidon address
const libraries: Record<string, Record<string, string>> = {};
if (poseidonAddress && poseidonAddress !== "0x0000000000000000000000000000000000000001") {
  libraries["poseidon-solidity/PoseidonT3.sol"] = {
    PoseidonT3: poseidonAddress,
  };
  libraries["@semaphore-protocol/contracts/base/"] = {
    PoseidonT3: poseidonAddress,
  };
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
          ...(Object.keys(libraries).length > 0 ? { libraries } : {}),
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
          ...(Object.keys(libraries).length > 0 ? { libraries } : {}),
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
