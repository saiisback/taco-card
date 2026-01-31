import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const RPC = process.env.NEXT_PUBLIC_0G_RPC ?? "https://evmrpc-testnet.0g.ai";
const PK = process.env.PRIVATE_KEY;

if (!PK) {
  console.error("PRIVATE_KEY not set in .env.local");
  process.exit(1);
}

const abi = [
  "function recordGame(address player, bool won, uint256 heroHpLeft, uint256 bossHpLeft) external",
  "function getPlayerStats(address player) external view returns (uint256 wins, uint256 losses, uint256 gamesPlayed)",
  "event GameRecorded(address indexed player, bool won, uint256 heroHpLeft, uint256 bossHpLeft, uint256 timestamp)",
];

// Compiled bytecode for GameResults.sol (solc 0.8.20, no optimization)
// We'll compile inline using solc if available, otherwise use pre-compiled bytecode
const SOL_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "contracts", "GameResults.sol"),
  "utf-8"
);

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK!, provider);

  console.log("Deploying from:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "0G");

  if (balance === 0n) {
    console.error("Wallet has no funds. Get testnet tokens from the 0G faucet.");
    process.exit(1);
  }

  // Use solc to compile
  let solc: any;
  try {
    solc = require("solc");
  } catch {
    console.error("Installing solc...");
    const { execSync } = require("child_process");
    execSync("bun add -d solc", { stdio: "inherit" });
    solc = require("solc");
  }

  const input = {
    language: "Solidity",
    sources: {
      "GameResults.sol": { content: SOL_SOURCE },
    },
    settings: {
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  console.log("Compiling contract...");
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors?.some((e: any) => e.severity === "error")) {
    console.error("Compilation errors:", output.errors);
    process.exit(1);
  }

  const compiled = output.contracts["GameResults.sol"]["GameResults"];
  const bytecode = "0x" + compiled.evm.bytecode.object;

  console.log("Deploying GameResults...");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Deployed at:", address);

  // Update the address in gameContract.ts
  const contractFile = path.join(__dirname, "..", "lib", "gameContract.ts");
  let content = fs.readFileSync(contractFile, "utf-8");
  content = content.replace(
    '0x0000000000000000000000000000000000000000',
    address
  );
  fs.writeFileSync(contractFile, content);
  console.log("Updated lib/gameContract.ts with deployed address.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
