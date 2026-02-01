"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useSendTransaction } from "wagmi";
import { parseEther, encodeFunctionData } from "viem";
import { injected } from "wagmi/connectors";
import Card, { type CardType, CARD_DEFINITIONS } from "@/components/game/Card";
import SpriteAnimator from "@/components/game/SpriteAnimator";
import Lobby, { type CharacterId, type BattlefieldId } from "./lobby";
// Inline the contract address to avoid importing gameContract.ts (which pulls in Node.js-only 0g SDK)
const GAME_RESULTS_ADDRESS = "0xa8D1375737ba0D5fEEF362b2D430D3CD592CCf4C";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SpriteAnim = "idle" | "attack" | "hurt" | "death";

interface GameState {
  heroHp: number;
  bossHp: number;
  gold: number;
  isShielded: boolean;
  fullShield: boolean;
  hand: CardType[];
  log: string[];
  turnInProgress: boolean;
  bossShaking: boolean;
  gameOver: boolean;
  winner: "hero" | "boss" | null;
  heroAnim: SpriteAnim;
  bossAnim: SpriteAnim;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHARED_CARDS: CardType[] = ["clerics_prayer", "tax_peasantry", "berserk_rage"];
const CHARACTER_CARDS: Record<CharacterId, CardType[]> = {
  kael: [...SHARED_CARDS, "iron_judgment", "fortress_stance"],
  lyra: [...SHARED_CARDS, "phantom_strike", "smoke_veil"],
};
const HAND_SIZE = 3;
const REROLL_COST = 5;
const BOSS_MIN_DMG = 10;
const BOSS_MAX_DMG = 20;
const BOSS_TURN_DELAY = 800;
const GAME_FEE = 0.01; // A0GI per game

// ---------------------------------------------------------------------------
// Pure helpers (no state mutation)
// ---------------------------------------------------------------------------

function sampleHand(pool: CardType[]): CardType[] {
  const hand: CardType[] = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    hand.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return hand;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// Card effect resolver – returns a partial state update + log message.
// Extracted so you can later call an AI / 0G Serving SDK endpoint instead.
// ---------------------------------------------------------------------------

export function resolveCardEffect(
  card: CardType,
  current: Pick<GameState, "heroHp" | "bossHp" | "gold" | "isShielded" | "fullShield">
): {
  heroHp: number;
  bossHp: number;
  gold: number;
  isShielded: boolean;
  fullShield: boolean;
  log: string;
  bossDamaged: boolean;
} {
  let { heroHp, bossHp, gold, isShielded } = current;
  let fullShield = current.fullShield;
  let log = "";
  let bossDamaged = false;

  switch (card) {
    case "knights_strike":
      bossHp = clamp(bossHp - 15, 0, 100);
      log = "Knight's Strike hits the Overlord for 15 damage!";
      bossDamaged = true;
      break;
    case "clerics_prayer":
      heroHp = clamp(heroHp + 15, 0, 100);
      log = "Cleric's Prayer restores 15 HP.";
      break;
    case "shield_wall":
      isShielded = true;
      fullShield = false;
      log = "Shield Wall raised! Next attack blocked 50%.";
      break;
    case "berserk_rage":
      bossHp = clamp(bossHp - 30, 0, 100);
      heroHp = clamp(heroHp - 10, 0, 100);
      log = "Berserk Rage! 30 damage to Overlord, 10 to self!";
      bossDamaged = true;
      break;
    case "tax_peasantry":
      gold += 15;
      log = "Tax Peasantry collects 15 Gold.";
      break;
    case "iron_judgment":
      bossHp = clamp(bossHp - 20, 0, 100);
      log = "Iron Judgment crashes down for 20 damage!";
      bossDamaged = true;
      break;
    case "fortress_stance":
      isShielded = true;
      fullShield = false;
      heroHp = clamp(heroHp + 5, 0, 100);
      log = "Fortress Stance! Shield raised and 5 HP restored.";
      break;
    case "phantom_strike":
      if (gold >= 5) {
        gold -= 5;
        bossHp = clamp(bossHp - 25, 0, 100);
        log = "Phantom Strike deals 25 damage! (-5 Gold)";
        bossDamaged = true;
      } else {
        log = "Phantom Strike fizzles... not enough Gold!";
      }
      break;
    case "smoke_veil":
      isShielded = true;
      fullShield = true;
      log = "Smoke Veil! Next attack fully blocked.";
      break;
  }

  return { heroHp, bossHp, gold, isShielded, fullShield, log, bossDamaged };
}

// ---------------------------------------------------------------------------
// Boss turn logic – separated for future SDK integration.
// Call this with the current state; returns updated heroHp, isShielded & log.
// ---------------------------------------------------------------------------

export function triggerBossTurn(
  current: Pick<GameState, "heroHp" | "isShielded" | "fullShield">
): { heroHp: number; isShielded: boolean; fullShield: boolean; log: string } {
  const rawDmg =
    Math.floor(Math.random() * (BOSS_MAX_DMG - BOSS_MIN_DMG + 1)) + BOSS_MIN_DMG;

  let actualDmg = rawDmg;
  let shieldNote = "";

  if (current.isShielded) {
    if (current.fullShield) {
      actualDmg = 0;
      shieldNote = " (fully blocked!)";
    } else {
      actualDmg = Math.floor(rawDmg * 0.5);
      shieldNote = " (shielded!)";
    }
  }

  const heroHp = clamp(current.heroHp - actualDmg, 0, 100);
  const log = `Overlord strikes for ${actualDmg} damage${shieldNote}`;

  return { heroHp, isShielded: false, fullShield: false, log };
}

// ---------------------------------------------------------------------------
// AI integration – calls your /api/ai/boss-action endpoint (stub-ready).
// Replace the body / response handling to wire up 0G Serving SDK later.
// ---------------------------------------------------------------------------

async function fetchAiBossAction(
  state: Pick<GameState, "heroHp" | "bossHp" | "gold" | "isShielded">
): Promise<{ message: string }> {
  console.log("[TACO] Requesting AI boss action via 0G node...", state);
  const res = await fetch("/api/ai/boss-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    console.error("[TACO] AI boss action failed:", err);
    throw new Error(err.error ?? `AI boss action failed: ${res.status}`);
  }
  const result = await res.json();
  console.log("[TACO] AI boss response:", result.message);
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Sprite animation configs per character
type SpriteConfig = {
  basePath: string;
  anims: Record<SpriteAnim, { folder: string; prefix: string; frames: number }>;
};

const HERO_SPRITES: Record<CharacterId, SpriteConfig> = {
  kael: {
    basePath: "/assets/Knight",
    anims: {
      idle:   { folder: "Idle",   prefix: "idle",   frames: 12 },
      attack: { folder: "Attack_Extra", prefix: "attack_extra", frames: 8 },
      hurt:   { folder: "Hurt",   prefix: "hurt",   frames: 4 },
      death:  { folder: "Death",  prefix: "death",  frames: 10 },
    },
  },
  lyra: {
    basePath: "/assets/Rogue",
    anims: {
      idle:   { folder: "Idle",   prefix: "idle",   frames: 12 },
      attack: { folder: "Attack_Extra", prefix: "attack_extra", frames: 8 },
      hurt:   { folder: "Hurt",   prefix: "hurt",   frames: 4 },
      death:  { folder: "Death",  prefix: "death",  frames: 10 },
    },
  },
};

const BOSS_SPRITE_CONFIG = {
  basePath: "/assets/Mage",
  anims: {
    idle:   { folder: "Idle",       prefix: "idle",         frames: 14 },
    attack: { folder: "Fire",       prefix: "fire",         frames: 9 },
    hurt:   { folder: "Hurt",       prefix: "hurt",         frames: 4 },
    death:  { folder: "Death",      prefix: "death",        frames: 10 },
  },
} as const;

function createInitialState(cardPool: CardType[]): GameState {
  return {
    heroHp: 100,
    bossHp: 100,
    gold: 50,
    isShielded: false,
    fullShield: false,
    hand: sampleHand(cardPool),
    log: ["A new quest begins..."],
    turnInProgress: false,
    bossShaking: false,
    gameOver: false,
    winner: null,
    heroAnim: "idle",
    bossAnim: "idle",
  };
}

interface OnChainStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
}

// ---------------------------------------------------------------------------
// TTS – speaks game log lines aloud using ElevenLabs.
// Boss AI lines use a deep male voice; hero actions use a female voice.
// ---------------------------------------------------------------------------

let currentAudio: HTMLAudioElement | null = null;

async function speak(text: string) {
  if (typeof window === "undefined") return;

  // Stop any ongoing speech
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // Strip the "AI: " wrapper to read just the taunt
  const aiMatch = text.match(/— AI: "(.+)"$/);
  const isBoss = text.startsWith("Overlord") || !!aiMatch;
  const cleanText = aiMatch ? aiMatch[1] : text;

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText, isBoss }),
    });
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 0.9;
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };
    await audio.play();
  } catch {
    // silently fail – game continues without voice
  }
}

// Deposit ABI for encoding
const DEPOSIT_ABI = [{ type: "function", name: "deposit", inputs: [], outputs: [], stateMutability: "payable" }] as const;
const WITHDRAW_ABI = [{ type: "function", name: "withdraw", inputs: [], outputs: [], stateMutability: "nonpayable" }] as const;

export default function GamePage() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"lobby" | "battle">("lobby");
  const [selectedChar, setSelectedChar] = useState<CharacterId>("kael");
  const [selectedBf, setSelectedBf] = useState<BattlefieldId>(1);
  const cardPool = CHARACTER_CARDS[selectedChar];
  const [state, setState] = useState<GameState>(() => createInitialState(cardPool));
  const [stats, setStats] = useState<OnChainStats | null>(null);
  const [recording, setRecording] = useState(false);
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const prevLogLen = useRef(0);

  // Turn loading state
  const [turnPhase, setTurnPhase] = useState<"idle" | "hero_attack" | "connecting_node" | "ai_thinking" | "boss_attack">("idle");

  // Deposit system state
  const [balance, setBalance] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("0.1");

  useEffect(() => { setMounted(true); }, []);

  // Speak new log entries
  useEffect(() => {
    if (!ttsEnabled || state.log.length <= prevLogLen.current) {
      prevLogLen.current = state.log.length;
      return;
    }
    const newEntry = state.log[state.log.length - 1];
    prevLogLen.current = state.log.length;
    if (newEntry) speak(newEntry);
  }, [state.log.length, ttsEnabled]);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();

  const hasEnoughBalance = balance !== null && parseFloat(balance) >= GAME_FEE;

  // Fetch on-chain stats + balance when wallet connects
  const fetchPlayerData = useCallback(async (addr: string) => {
    console.log(`[TACO] Fetching on-chain data for ${addr}...`);
    try {
      const res = await fetch(`/api/game/record?player=${addr}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.stats) { setStats(data.stats); console.log("[TACO] Player stats:", data.stats); }
      if (data.balance !== undefined) { setBalance(data.balance); console.log(`[TACO] Player balance: ${data.balance} A0GI`); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!address) { setStats(null); setBalance(null); return; }
    fetchPlayerData(address);
  }, [address, fetchPlayerData]);

  // Deposit handler
  const handleDeposit = useCallback(async () => {
    if (!address || depositing) return;
    setDepositing(true);
    try {
      console.log(`[TACO] Signing deposit tx: ${depositAmount} A0GI to contract ${GAME_RESULTS_ADDRESS}`);
      const data = encodeFunctionData({ abi: DEPOSIT_ABI, functionName: "deposit" });
      const txHash = await sendTransactionAsync({
        to: GAME_RESULTS_ADDRESS as `0x${string}`,
        data,
        value: parseEther(depositAmount),
      });
      console.log(`[TACO] Deposit tx signed: ${txHash}`);
      console.log(`[TACO] Explorer: https://chainscan-galileo.0g.ai/tx/${txHash}`);
      // Wait a moment for chain to update, then refresh balance
      await new Promise((r) => setTimeout(r, 3000));
      await fetchPlayerData(address);
      console.log("[TACO] Deposit confirmed, balance refreshed");
    } catch (err) {
      console.error("[TACO] Deposit failed:", err);
    } finally {
      setDepositing(false);
    }
  }, [address, depositing, depositAmount, sendTransactionAsync, fetchPlayerData]);

  // Withdraw handler
  const handleWithdraw = useCallback(async () => {
    if (!address || withdrawing || !balance || parseFloat(balance) <= 0) return;
    setWithdrawing(true);
    try {
      console.log(`[TACO] Signing withdraw tx from contract ${GAME_RESULTS_ADDRESS}`);
      const data = encodeFunctionData({ abi: WITHDRAW_ABI, functionName: "withdraw" });
      const txHash = await sendTransactionAsync({
        to: GAME_RESULTS_ADDRESS as `0x${string}`,
        data,
      });
      console.log(`[TACO] Withdraw tx signed: ${txHash}`);
      console.log(`[TACO] Explorer: https://chainscan-galileo.0g.ai/tx/${txHash}`);
      await new Promise((r) => setTimeout(r, 3000));
      await fetchPlayerData(address);
      console.log("[TACO] Withdraw confirmed, balance refreshed");
    } catch (err) {
      console.error("[TACO] Withdraw failed:", err);
    } finally {
      setWithdrawing(false);
    }
  }, [address, withdrawing, balance, sendTransactionAsync, fetchPlayerData]);

  // Record game result on-chain
  const recordResult = useCallback(async (won: boolean, heroHp: number, bossHp: number) => {
    const playerAddress = address ?? "0x0000000000000000000000000000000000000000";
    setRecording(true);
    setLastTxUrl(null);
    console.log(`[TACO] Recording game result on-chain: player=${playerAddress}, won=${won}, heroHp=${heroHp}, bossHp=${bossHp}`);
    try {
      const res = await fetch("/api/game/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress, won, heroHp, bossHp }),
      });
      if (!res.ok) throw new Error(`Record failed: ${res.status}`);
      const data = await res.json();
      if (data.txHash) console.log(`[TACO] Game recorded tx: ${data.txHash}`);
      if (data.txExplorerUrl) console.log(`[TACO] Explorer: ${data.txExplorerUrl}`);
      if (data.stats) { setStats(data.stats); console.log("[TACO] Updated stats:", data.stats); }
      if (data.balance !== undefined) { setBalance(data.balance); console.log(`[TACO] Updated balance: ${data.balance} A0GI`); }
      if (data.txExplorerUrl) setLastTxUrl(data.txExplorerUrl);
    } catch (err) {
      console.error("[TACO] Failed to record game on-chain:", err);
      throw err;
    } finally {
      setRecording(false);
    }
  }, [address]);

  // ---- Win / lose check ----
  const checkEnd = useCallback(
    (next: Partial<GameState>): Partial<GameState> => {
      const hp = next.heroHp ?? state.heroHp;
      const bhp = next.bossHp ?? state.bossHp;
      if (bhp <= 0) return { ...next, gameOver: true, winner: "hero" };
      if (hp <= 0) return { ...next, gameOver: true, winner: "boss" };
      return next;
    },
    [state.heroHp, state.bossHp]
  );

  // ---- Play a card ----
  const playCard = useCallback(
    async (card: CardType) => {
      if (state.turnInProgress || state.gameOver) return;

      setState((s) => ({ ...s, turnInProgress: true, heroAnim: "attack" }));
      setTurnPhase("hero_attack");

      // 1. Resolve card
      const result = resolveCardEffect(card, state);

      const afterCard: Partial<GameState> = {
        heroHp: result.heroHp,
        bossHp: result.bossHp,
        gold: result.gold,
        isShielded: result.isShielded,
        fullShield: result.fullShield,
        log: [...state.log, result.log],
        bossShaking: result.bossDamaged,
        bossAnim: result.bossDamaged ? "hurt" : "idle",
      };

      const checked = checkEnd(afterCard);
      if (checked.gameOver && checked.winner === "hero") {
        checked.bossAnim = "death";
      }
      setState((s) => ({ ...s, ...checked }));

      if (checked.gameOver) {
        setState((s) => ({ ...s, turnInProgress: false, heroAnim: "idle" }));
        setTurnPhase("idle");
        recordResult(
          checked.winner === "hero",
          checked.heroHp ?? 0,
          checked.bossHp ?? 0
        );
        return;
      }

      // 2. Delay then boss turn
      await new Promise((r) => setTimeout(r, BOSS_TURN_DELAY));

      setTurnPhase("connecting_node");
      setState((s) => ({ ...s, bossShaking: false, heroAnim: "idle", bossAnim: "attack" }));

      const currentForBoss = {
        heroHp: result.heroHp,
        bossHp: result.bossHp,
        gold: result.gold,
        isShielded: result.isShielded,
      };

      setTurnPhase("ai_thinking");
      const aiResult = await fetchAiBossAction(currentForBoss);
      setTurnPhase("boss_attack");
      const bossResult = triggerBossTurn({
        heroHp: result.heroHp,
        isShielded: result.isShielded,
        fullShield: result.fullShield,
      });

      const bossLog = `${bossResult.log} — AI: "${aiResult.message}"`;

      // Show hero getting hurt
      setState((s) => ({ ...s, heroAnim: "hurt" }));
      await new Promise((r) => setTimeout(r, 400));

      const afterBoss: Partial<GameState> = {
        heroHp: bossResult.heroHp,
        isShielded: bossResult.isShielded,
        fullShield: bossResult.fullShield,
        log: [...(checked.log ?? state.log), bossLog],
        hand: sampleHand(cardPool),
        turnInProgress: false,
        heroAnim: "idle",
        bossAnim: "idle",
      };

      const finalState = checkEnd(afterBoss);
      if (finalState.gameOver && finalState.winner === "boss") {
        finalState.heroAnim = "death";
      }
      setState((s) => ({ ...s, ...finalState }));
      setTurnPhase("idle");

      if (finalState.gameOver) {
        recordResult(
          finalState.winner === "hero",
          finalState.heroHp ?? 0,
          finalState.bossHp ?? 0
        );
      }
    },
    [state, checkEnd, recordResult]
  );

  // ---- Reroll ----
  const reroll = useCallback(() => {
    if (state.gold < REROLL_COST || state.turnInProgress || state.gameOver) return;
    setState((s) => ({
      ...s,
      gold: s.gold - REROLL_COST,
      hand: sampleHand(cardPool),
      log: [...s.log, `Taco Shuffle! (-${REROLL_COST} Gold)`],
    }));
  }, [state.gold, state.turnInProgress, state.gameOver]);

  // ---- Restart ----
  const restart = () => { setState(createInitialState(cardPool)); setLastTxUrl(null); };

  // Lobby start handler
  const handleLobbyStart = useCallback((char: CharacterId, bf: BattlefieldId) => {
    setSelectedChar(char);
    setSelectedBf(bf);
    setState(createInitialState(CHARACTER_CARDS[char]));
    setPhase("battle");
  }, []);

  const heroSprites = HERO_SPRITES[selectedChar];
  const lastLog = state.log[state.log.length - 1] ?? "";

  // ---- Render ----
  if (!mounted) {
    return <div className="h-screen bg-black" />;
  }

  if (phase === "lobby") {
    return <Lobby onStart={handleLobbyStart} />;
  }

  const insufficientBalance = !isConnected || !hasEnoughBalance;
  const cardsDisabled = state.turnInProgress || state.gameOver || insufficientBalance;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ fontFamily: "'MedievalSharp', 'Space Grotesk', sans-serif" }}>
      {/* ===== Battle Scene (top ~60%) ===== */}
      <div
        className="relative flex-1 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('/battle-bg/battle${selectedBf}.png')` }}
      >
        {/* Dark vignette overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)"
        }} />

        {/* Wallet badge + balance - top left */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
          {isConnected ? (
            <>
              <button onClick={() => disconnect()} className="bg-black/70 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-800/50">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </button>
              {balance !== null && (
                <span className="bg-black/70 text-amber-400 text-[10px] px-2 py-0.5 rounded border border-amber-800/50">
                  {parseFloat(balance).toFixed(3)} A0GI
                </span>
              )}
              {balance !== null && parseFloat(balance) > 0 && (
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="bg-black/70 text-red-400 text-[10px] px-1.5 py-0.5 rounded border border-red-800/50 hover:bg-red-900/40 disabled:opacity-50"
                >
                  {withdrawing ? "..." : "Withdraw"}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="bg-amber-900/80 text-amber-200 text-[10px] px-2 py-0.5 rounded border border-amber-600 font-bold"
            >
              Connect
            </button>
          )}
        </div>

        {/* TTS toggle */}
        <button
          onClick={() => { setTtsEnabled((v) => !v); if (currentAudio) { currentAudio.pause(); currentAudio = null; } }}
          className="absolute top-2 left-[50%] -translate-x-1/2 z-10 bg-black/70 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-800/50"
        >
          {ttsEnabled ? "Voice ON" : "Voice OFF"}
        </button>

        {/* Stats badge - top right */}
        {stats && (
          <div className="absolute top-2 right-2 z-10 bg-black/70 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-800/50 flex gap-2">
            <span>W:{stats.wins}</span>
            <span>L:{stats.losses}</span>
          </div>
        )}

        {/* Wallet not connected or insufficient balance overlay */}
        {insufficientBalance && !state.gameOver && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="bg-[#1a1209] border-2 border-amber-700 rounded-lg px-6 py-4 text-center max-w-xs">
              {!isConnected ? (
                <>
                  <p className="text-amber-400 font-bold text-sm mb-2">Connect Wallet to Play</p>
                  <p className="text-amber-600 text-xs mb-3">
                    You need to connect your wallet and deposit funds to play.
                  </p>
                  <button
                    onClick={() => connect({ connector: injected() })}
                    className="bg-amber-800 text-amber-100 px-4 py-1.5 rounded border border-amber-600 font-bold text-xs tracking-wider uppercase hover:bg-amber-700 transition-colors"
                  >
                    Connect Wallet
                  </button>
                </>
              ) : (
                <>
                  <p className="text-amber-400 font-bold text-sm mb-2">Deposit to Play</p>
                  <p className="text-amber-600 text-xs mb-3">
                    Each game costs {GAME_FEE} A0GI. Your balance: {balance ?? "0"} A0GI
                  </p>
                  <div className="flex items-center gap-2 justify-center mb-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="bg-black/60 border border-amber-800 text-amber-300 text-xs rounded px-2 py-1 w-20 text-center"
                    />
                    <span className="text-amber-600 text-xs">A0GI</span>
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={depositing}
                    className="bg-amber-800 text-amber-100 px-4 py-1.5 rounded border border-amber-600 font-bold text-xs tracking-wider uppercase hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {depositing ? "Confirming..." : "Deposit"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ----- Boss HP (top-left) ----- */}
        <div className="absolute top-8 left-3 w-[55%] max-w-[300px] z-10">
          <div className="bg-[#1a1209] border-2 border-amber-700 rounded px-3 py-2 shadow-[0_0_15px_rgba(180,120,40,0.3)]"
               style={{ backgroundImage: "linear-gradient(135deg, #1a1209 0%, #2a1f10 50%, #1a1209 100%)" }}>
            <div className="flex justify-between items-center">
              <span className="text-amber-400 font-bold text-sm tracking-wider uppercase">Overlord</span>
              <span className="text-amber-600 text-xs italic">Lv.50</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-red-500">HP</span>
              <div className="flex-1 bg-black/60 rounded-sm h-3 overflow-hidden border border-amber-900/50">
                <div
                  className={`h-full transition-all duration-300 ${
                    state.bossHp > 50 ? "bg-gradient-to-r from-red-800 to-red-600" : state.bossHp > 20 ? "bg-gradient-to-r from-red-900 to-orange-600" : "bg-gradient-to-r from-red-950 to-red-500"
                  } ${state.bossShaking ? "animate-shake" : ""}`}
                  style={{ width: `${state.bossHp}%` }}
                />
              </div>
            </div>
            <div className="text-right text-[10px] text-amber-600 mt-0.5">
              {state.bossHp} / 100
            </div>
          </div>
        </div>

        {/* ----- Hero HP (bottom-right) ----- */}
        <div className="absolute bottom-4 right-3 w-[55%] max-w-[300px] z-10">
          <div className="bg-[#1a1209] border-2 border-amber-700 rounded px-3 py-2 shadow-[0_0_15px_rgba(180,120,40,0.3)]"
               style={{ backgroundImage: "linear-gradient(135deg, #1a1209 0%, #2a1f10 50%, #1a1209 100%)" }}>
            <div className="flex justify-between items-center">
              <span className="text-amber-400 font-bold text-sm tracking-wider uppercase">{selectedChar === "kael" ? "Kael" : "Lyra"}</span>
              <span className="text-amber-600 text-xs italic">Lv.42</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-500">HP</span>
              <div className="flex-1 bg-black/60 rounded-sm h-3 overflow-hidden border border-amber-900/50">
                <div
                  className={`h-full transition-all duration-300 ${
                    state.heroHp > 50 ? "bg-gradient-to-r from-emerald-800 to-emerald-500" : state.heroHp > 20 ? "bg-gradient-to-r from-yellow-800 to-yellow-500" : "bg-gradient-to-r from-red-900 to-red-500"
                  }`}
                  style={{ width: `${state.heroHp}%` }}
                />
              </div>
            </div>
            <div className="text-right text-[10px] text-amber-600 mt-0.5">
              {state.heroHp} / 100
            </div>
            <div className="flex gap-3 text-[10px] text-amber-500 mt-0.5">
              <span>{state.gold} Gold</span>
              {state.isShielded && <span className="text-cyan-400">Shielded</span>}
            </div>
          </div>
        </div>

        {/* ----- Boss Sprite (left side, facing right) ----- */}
        <div className="absolute bottom-[20%] left-[25%] z-10 -translate-x-1/2">
          <SpriteAnimator
            basePath={BOSS_SPRITE_CONFIG.basePath}
            animation={BOSS_SPRITE_CONFIG.anims[state.bossAnim].folder}
            prefix={BOSS_SPRITE_CONFIG.anims[state.bossAnim].prefix}
            frameCount={BOSS_SPRITE_CONFIG.anims[state.bossAnim].frames}
            fps={state.bossAnim === "idle" ? 120 : 80}
            loop={state.bossAnim === "idle"}
            flip
            size={280}
          />
        </div>

        {/* ----- Hero Sprite (right side, facing left) ----- */}
        <div className="absolute top-[20%] right-[25%] z-10 translate-x-1/2">
          <SpriteAnimator
            basePath={heroSprites.basePath}
            animation={heroSprites.anims[state.heroAnim].folder}
            prefix={heroSprites.anims[state.heroAnim].prefix}
            frameCount={heroSprites.anims[state.heroAnim].frames}
            fps={state.heroAnim === "idle" ? 120 : 80}
            loop={state.heroAnim === "idle"}
            size={280}
          />
        </div>
      </div>

      {/* ===== Bottom Panel (Gothic medieval) ===== */}
      <div className="bg-[#0d0a06] border-t-2 border-amber-800 p-2"
           style={{ backgroundImage: "linear-gradient(180deg, #1a1209 0%, #0d0a06 100%)" }}>

        {state.gameOver ? (
          <div className="px-2 py-4 flex flex-col items-center gap-2">
            <p className="text-amber-400 font-bold text-lg tracking-wide">
              {state.winner === "hero" ? "Victory! The Overlord Falls!" : "Defeat... The Hero Has Fallen."}
            </p>
            {recording && <p className="text-xs text-amber-700 italic">Inscribing onto the chain...</p>}
            {lastTxUrl && (
              <a href={lastTxUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-500 underline">
                View on Explorer
              </a>
            )}
            <button onClick={restart} className="bg-amber-800 text-amber-100 px-6 py-2 rounded border border-amber-600 font-bold text-sm tracking-wider uppercase hover:bg-amber-700 transition-colors">
              Play Again
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {/* Left: Cards + Shuffle */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex gap-3 -mt-24 relative z-50">
                {state.hand.map((card, i) => (
                  <Card key={`${card}-${i}`} card={card} onPlay={playCard} disabled={cardsDisabled} />
                ))}
              </div>
              <button
                onClick={reroll}
                disabled={state.gold < REROLL_COST || cardsDisabled}
                className="w-full bg-amber-900/60 text-amber-400 font-bold py-1.5 rounded border border-amber-800/60 text-xs tracking-wider uppercase disabled:opacity-25 hover:bg-amber-900/80 transition-colors"
              >
                Shuffle Cards ({REROLL_COST}g)
              </button>
            </div>

            {/* Right: Story dialogue */}
            <div className="flex-1 rounded border border-amber-900/60 bg-[#1e1710] px-4 py-3 overflow-y-auto max-h-[160px]">
              {/* Turn phase loading indicator */}
              {turnPhase !== "idle" && (
                <div className="flex items-center gap-2 mb-2 px-1 py-1.5 rounded bg-black/40 border border-amber-900/40">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] text-amber-400 tracking-wide">
                    {turnPhase === "hero_attack" && "Resolving your move..."}
                    {turnPhase === "connecting_node" && "Connecting to 0G AI node..."}
                    {turnPhase === "ai_thinking" && "Overlord is deciding next move..."}
                    {turnPhase === "boss_attack" && "Overlord attacks!"}
                  </span>
                </div>
              )}
              {state.log.map((entry, i) => (
                <p key={i} className={`text-sm leading-relaxed italic ${i === state.log.length - 1 ? "text-amber-300" : "text-amber-700"}`}>
                  {entry}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* shake keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=MedievalSharp&family=Space+Grotesk:wght@300..700&display=swap');
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out 2; }
      `}</style>
    </div>
  );
}
