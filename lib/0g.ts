import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

// ---------------------------------------------------------------------------
// 0G Galileo Testnet config
// ---------------------------------------------------------------------------

export const ZG_RPC = process.env.NEXT_PUBLIC_0G_RPC ?? "https://evmrpc-testnet.0g.ai";
export const ZG_CHAIN_ID = 16602;
export const ZG_EXPLORER = "https://chainscan-galileo.0g.ai";
export const txUrl = (hash: string) => `${ZG_EXPLORER}/tx/${hash}`;

// ---------------------------------------------------------------------------
// Shared provider + wallet (server-side only)
// ---------------------------------------------------------------------------

let _provider: ethers.JsonRpcProvider | null = null;
export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(ZG_RPC);
  }
  return _provider;
}

let _wallet: ethers.Wallet | null = null;
export function getWallet(): ethers.Wallet {
  if (!_wallet) {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error("PRIVATE_KEY env var not set");
    _wallet = new ethers.Wallet(pk, getProvider());
  }
  return _wallet;
}

// ---------------------------------------------------------------------------
// 0G Serving broker singleton
// ---------------------------------------------------------------------------

let _broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;
let _ledgerReady = false;

export async function getBroker() {
  if (!_broker) {
    const wallet = getWallet();
    _broker = await createZGComputeNetworkBroker(wallet);
  }

  if (!_ledgerReady) {
    // Try to create the ledger; if it already exists, deposit more funds
    try {
      await _broker.ledger.addLedger(1);
      console.log("[0G] Ledger created with 1 0G");
    } catch (e: any) {
      const msg = `${e?.message ?? ""} ${e?.reason ?? ""}`;
      if (msg.includes("already") || msg.includes("AccountExists") || msg.includes("Ledger already exists")) {
        // Ledger exists — deposit additional funds to ensure sufficient balance
        try {
          await _broker.ledger.depositFund(1);
          console.log("[0G] Deposited 1 0G to existing ledger");
        } catch (depErr: any) {
          console.warn("[0G] depositFund warning:", depErr?.message);
        }
      } else {
        console.warn("[0G] addLedger warning:", msg);
      }
    }
    _ledgerReady = true;
  }

  return _broker;
}
