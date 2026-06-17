import { ethers } from "ethers";
import { getProvider, getWallet } from "./0g";

// ---------------------------------------------------------------------------
// Replace with your deployed contract address on 0G Galileo testnet
// ---------------------------------------------------------------------------
export const GAME_RESULTS_ADDRESS = "0xB68f9Ec3275410e213E0DF9357e662eb5785401E";

export const GAME_RESULTS_ABI = [
  "function recordGame(address player, bool won, uint256 heroHpLeft, uint256 bossHpLeft) external",
  "function getPlayerStats(address player) external view returns (uint256 wins, uint256 losses, uint256 gamesPlayed)",
  "event GameRecorded(address indexed player, bool won, uint256 heroHpLeft, uint256 bossHpLeft, uint256 timestamp)",
] as const;

function getContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    GAME_RESULTS_ADDRESS,
    GAME_RESULTS_ABI,
    signerOrProvider ?? getProvider()
  );
}

export async function recordGameResult(
  playerAddress: string,
  won: boolean,
  heroHp: number,
  bossHp: number
) {
  const contract = getContract(getWallet());
  const tx = await contract.recordGame(playerAddress, won, heroHp, bossHp);
  await tx.wait();
  return tx.hash;
}

export async function getPlayerStats(playerAddress: string) {
  const contract = getContract();
  const [wins, losses, gamesPlayed] = await contract.getPlayerStats(playerAddress);
  return {
    wins: Number(wins),
    losses: Number(losses),
    gamesPlayed: Number(gamesPlayed),
  };
}
