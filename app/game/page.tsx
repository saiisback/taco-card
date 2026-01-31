"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import Card, { type CardType, CARD_DEFINITIONS } from "@/components/game/Card";
import SpriteAnimator from "@/components/game/SpriteAnimator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SpriteAnim = "idle" | "attack" | "hurt" | "death";

interface GameState {
  heroHp: number;
  bossHp: number;
  gold: number;
  isShielded: boolean;
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

const ALL_CARDS: CardType[] = Object.keys(CARD_DEFINITIONS) as CardType[];
const HAND_SIZE = 3;
const REROLL_COST = 5;
const BOSS_MIN_DMG = 10;
const BOSS_MAX_DMG = 20;
const BOSS_TURN_DELAY = 800;

// ---------------------------------------------------------------------------
// Pure helpers (no state mutation)
// ---------------------------------------------------------------------------

function sampleHand(): CardType[] {
  const hand: CardType[] = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    hand.push(ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)]);
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
  current: Pick<GameState, "heroHp" | "bossHp" | "gold" | "isShielded">
): {
  heroHp: number;
  bossHp: number;
  gold: number;
  isShielded: boolean;
  log: string;
  bossDamaged: boolean;
} {
  let { heroHp, bossHp, gold, isShielded } = current;
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
  }

  return { heroHp, bossHp, gold, isShielded, log, bossDamaged };
}

// ---------------------------------------------------------------------------
// Boss turn logic – separated for future SDK integration.
// Call this with the current state; returns updated heroHp, isShielded & log.
// ---------------------------------------------------------------------------

export function triggerBossTurn(
  current: Pick<GameState, "heroHp" | "isShielded">
): { heroHp: number; isShielded: boolean; log: string } {
  const rawDmg =
    Math.floor(Math.random() * (BOSS_MAX_DMG - BOSS_MIN_DMG + 1)) + BOSS_MIN_DMG;

  let actualDmg = rawDmg;
  let shieldNote = "";

  if (current.isShielded) {
    actualDmg = Math.floor(rawDmg * 0.5);
    shieldNote = " (shielded!)";
  }

  const heroHp = clamp(current.heroHp - actualDmg, 0, 100);
  const log = `Overlord strikes for ${actualDmg} damage${shieldNote}`;

  return { heroHp, isShielded: false, log };
}

// ---------------------------------------------------------------------------
// AI integration – calls your /api/ai/boss-action endpoint (stub-ready).
// Replace the body / response handling to wire up 0G Serving SDK later.
// ---------------------------------------------------------------------------

async function fetchAiBossAction(
  state: Pick<GameState, "heroHp" | "bossHp" | "gold" | "isShielded">
): Promise<{ message: string }> {
  const res = await fetch("/api/ai/boss-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `AI boss action failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Sprite animation configs
const SPRITE_CONFIG = {
  hero: {
    basePath: "/assets/Knight",
    anims: {
      idle:   { folder: "Idle",   prefix: "idle",   frames: 12 },
      attack: { folder: "Attack_Extra", prefix: "attack_extra", frames: 8 },
      hurt:   { folder: "Hurt",   prefix: "hurt",   frames: 4 },
      death:  { folder: "Death",  prefix: "death",  frames: 10 },
    },
  },
  boss: {
    basePath: "/assets/Mage",
    anims: {
      idle:   { folder: "Idle",       prefix: "idle",         frames: 14 },
      attack: { folder: "Fire",       prefix: "fire",         frames: 9 },
      hurt:   { folder: "Hurt",       prefix: "hurt",         frames: 4 },
      death:  { folder: "Death",      prefix: "death",        frames: 10 },
    },
  },
} as const;

function createInitialState(): GameState {
  return {
    heroHp: 100,
    bossHp: 100,
    gold: 50,
    isShielded: false,
    hand: sampleHand(),
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
// TTS – speaks game log lines aloud using the Web Speech API.
// Boss AI lines get a deeper pitch; hero actions get a normal voice.
// ---------------------------------------------------------------------------

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // stop any ongoing speech

  // Strip the "AI: " wrapper to read just the taunt
  const aiMatch = text.match(/— AI: "(.+)"$/);
  const isBossLine = text.startsWith("Overlord") || !!aiMatch;

  const utterance = new SpeechSynthesisUtterance(aiMatch ? aiMatch[1] : text);
  utterance.rate = isBossLine ? 0.85 : 1;
  utterance.pitch = isBossLine ? 0.6 : 1;
  utterance.volume = 0.9;

  // Try to pick a deeper voice for the boss
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const preferred = isBossLine
      ? voices.find((v) => /daniel|thomas|male/i.test(v.name))
      : voices.find((v) => /samantha|female|fiona/i.test(v.name));
    if (preferred) utterance.voice = preferred;
  }

  window.speechSynthesis.speak(utterance);
}

export default function GamePage() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<GameState>(createInitialState);
  const [stats, setStats] = useState<OnChainStats | null>(null);
  const [recording, setRecording] = useState(false);
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const prevLogLen = useRef(0);

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

  // Fetch on-chain stats when wallet connects
  useEffect(() => {
    if (!address) { setStats(null); return; }
    fetch(`/api/game/record?player=${address}`)
      .then(() => {})
      .catch(() => {});
  }, [address]);

  // Record game result on-chain
  const recordResult = useCallback(async (won: boolean, heroHp: number, bossHp: number) => {
    const playerAddress = address ?? "0x0000000000000000000000000000000000000000";
    setRecording(true);
    setLastTxUrl(null);
    try {
      const res = await fetch("/api/game/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress, won, heroHp, bossHp }),
      });
      if (!res.ok) throw new Error(`Record failed: ${res.status}`);
      const data = await res.json();
      if (data.stats) setStats(data.stats);
      if (data.txExplorerUrl) setLastTxUrl(data.txExplorerUrl);
    } catch (err) {
      console.error("Failed to record game on-chain:", err);
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

      // 1. Resolve card
      const result = resolveCardEffect(card, state);

      const afterCard: Partial<GameState> = {
        heroHp: result.heroHp,
        bossHp: result.bossHp,
        gold: result.gold,
        isShielded: result.isShielded,
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
        recordResult(
          checked.winner === "hero",
          checked.heroHp ?? 0,
          checked.bossHp ?? 0
        );
        return;
      }

      // 2. Delay then boss turn
      await new Promise((r) => setTimeout(r, BOSS_TURN_DELAY));

      setState((s) => ({ ...s, bossShaking: false, heroAnim: "idle", bossAnim: "attack" }));

      const currentForBoss = {
        heroHp: result.heroHp,
        bossHp: result.bossHp,
        gold: result.gold,
        isShielded: result.isShielded,
      };

      const aiResult = await fetchAiBossAction(currentForBoss);
      const bossResult = triggerBossTurn({
        heroHp: result.heroHp,
        isShielded: result.isShielded,
      });

      const bossLog = `${bossResult.log} — AI: "${aiResult.message}"`;

      // Show hero getting hurt
      setState((s) => ({ ...s, heroAnim: "hurt" }));
      await new Promise((r) => setTimeout(r, 400));

      const afterBoss: Partial<GameState> = {
        heroHp: bossResult.heroHp,
        isShielded: bossResult.isShielded,
        log: [...(checked.log ?? state.log), bossLog],
        hand: sampleHand(),
        turnInProgress: false,
        heroAnim: "idle",
        bossAnim: "idle",
      };

      const finalState = checkEnd(afterBoss);
      if (finalState.gameOver && finalState.winner === "boss") {
        finalState.heroAnim = "death";
      }
      setState((s) => ({ ...s, ...finalState }));

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
      hand: sampleHand(),
      log: [...s.log, `Taco Shuffle! (-${REROLL_COST} Gold)`],
    }));
  }, [state.gold, state.turnInProgress, state.gameOver]);

  // ---- Restart ----
  const restart = () => { setState(createInitialState()); setLastTxUrl(null); };

  // Pick a random battle bg on mount
  const [bgIndex] = useState(() => Math.floor(Math.random() * 3) + 1);
  const lastLog = state.log[state.log.length - 1] ?? "";

  // ---- Render ----
  if (!mounted) {
    return <div className="h-screen bg-black" />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}>
      {/* ===== Battle Scene (top ~60%) ===== */}
      <div
        className="relative flex-1 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('/battle-bg/battle${bgIndex}.png')` }}
      >
        {/* Dark vignette overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)"
        }} />

        {/* Wallet badge - top left */}
        <div className="absolute top-2 left-2 z-10">
          {isConnected ? (
            <button onClick={() => disconnect()} className="bg-black/70 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-800/50">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
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
          onClick={() => { setTtsEnabled((v) => !v); window.speechSynthesis?.cancel(); }}
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
              <span className="text-amber-400 font-bold text-sm tracking-wider uppercase">Hero</span>
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
            basePath={SPRITE_CONFIG.boss.basePath}
            animation={SPRITE_CONFIG.boss.anims[state.bossAnim].folder}
            prefix={SPRITE_CONFIG.boss.anims[state.bossAnim].prefix}
            frameCount={SPRITE_CONFIG.boss.anims[state.bossAnim].frames}
            fps={state.bossAnim === "idle" ? 120 : 80}
            loop={state.bossAnim === "idle"}
            flip
            size={280}
          />
        </div>

        {/* ----- Hero Sprite (right side, facing left) ----- */}
        <div className="absolute top-[20%] right-[25%] z-10 translate-x-1/2">
          <SpriteAnimator
            basePath={SPRITE_CONFIG.hero.basePath}
            animation={SPRITE_CONFIG.hero.anims[state.heroAnim].folder}
            prefix={SPRITE_CONFIG.hero.anims[state.heroAnim].prefix}
            frameCount={SPRITE_CONFIG.hero.anims[state.heroAnim].frames}
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
                  <Card key={`${card}-${i}`} card={card} onPlay={playCard} disabled={state.turnInProgress || state.gameOver} />
                ))}
              </div>
              <button
                onClick={reroll}
                disabled={state.gold < REROLL_COST || state.turnInProgress || state.gameOver}
                className="w-full bg-amber-900/60 text-amber-400 font-bold py-1.5 rounded border border-amber-800/60 text-xs tracking-wider uppercase disabled:opacity-25 hover:bg-amber-900/80 transition-colors"
              >
                Shuffle Cards ({REROLL_COST}g)
              </button>
            </div>

            {/* Right: Story dialogue */}
            <div className="flex-1 rounded border border-amber-900/60 bg-[#1e1710] px-4 py-3 overflow-y-auto max-h-[160px]">
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
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');
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
