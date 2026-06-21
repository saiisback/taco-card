# TACO - Turn-based AI Combat Overlord

> A medieval card-battle game powered by 0G's decentralized AI infrastructure

---

## What is TACO?

TACO is an immersive turn-based card battle game where players choose a hero and battle against an **AI-powered Overlord boss**. The game combines strategic card gameplay with blockchain technology for permanent player progression and decentralized AI for dynamic, intelligent boss behavior.

---

## 0G Integration & Applications

### 1. **0G Serving SDK - Decentralized AI Inference**

The boss ("Overlord") isn't just a scripted enemy—it's powered by **0G's decentralized compute network** for real-time AI inference.

**How it works:**
- Every turn, the game state (hero HP, boss HP, gold, shield status) is sent to 0G's AI services
- The boss generates **dynamic, contextual taunts** based on the current battle situation
- Uses the `@0glabs/0g-serving-broker` SDK for:
  - Service discovery (finding available AI providers)
  - Automatic payment/ledger management
  - Request signing and fee settlement

**Code flow:**
```
Player plays card → Game state sent to 0G → AI generates boss taunt → Boss attacks with personalized dialogue
```

**Why 0G?**
- **Decentralized**: No single point of failure for AI inference
- **Cost-efficient**: Pay-per-use model with automatic fund management
- **Verifiable**: TEE (Trusted Execution Environment) ensures AI responses are authentic

### 2. **0G Galileo Testnet - On-Chain Game Records**

All game results are **permanently recorded on the 0G blockchain**.

**Smart Contract: `GameResults.sol`**

```solidity
function recordGame(address player, bool won, uint256 heroHpLeft, uint256 bossHpLeft) external
function getPlayerStats(address player) returns (uint256 wins, uint256 losses, uint256 gamesPlayed)
```

**What gets stored:**
- Player wallet address
- Win/loss outcome
- Remaining HP values
- Timestamp of each game

**Why this matters:**
- **True ownership**: Players own their stats forever
- **Verifiable achievements**: Anyone can verify a player's record on-chain
- **Future expandability**: Leaderboards, tournaments, NFT rewards can all be built on this foundation

### 3. **0G Ledger System**

The game automatically manages funds for AI services:
- Creates ledger accounts for paying AI providers
- Deposits funds when needed
- Handles micropayments for each AI inference call

---

## What Makes TACO Fun?

### Strategic Card Combat

| Feature | Description |
|---------|-------------|
| **Character Classes** | Choose between **Kael the Knight** (tank/defense) or **Lyra the Rogue** (burst damage) |
| **Unique Abilities** | Each hero has exclusive cards—Iron Judgment vs Phantom Strike |
| **Resource Management** | Balance gold for card shuffles vs saving for powerful abilities |
| **Risk/Reward** | Cards like Berserk Rage deal massive damage but hurt you too |

### Available Cards

**Shared Cards:**
- Cleric's Prayer (+15 HP heal)
- Tax Peasantry (+15 Gold)
- Berserk Rage (-30 Boss HP, -10 Self HP)

**Knight Exclusive:**
- Iron Judgment (-20 Boss HP)
- Fortress Stance (Shield + 5 HP)

**Rogue Exclusive:**
- Phantom Strike (-25 Boss HP, costs 5 Gold)
- Smoke Veil (100% damage block)

### Living AI Boss

The Overlord isn't a dumb NPC:
- **Reacts to the battle state** - taunts you when you're low on HP, gets desperate when losing
- **Dynamic dialogue** - never the same game twice
- **Voice acted** - deep, menacing voice via ElevenLabs TTS

### Immersive Experience

- **Animated sprites** - Fluid character animations (idle, attack, hurt, death)
- **Multiple battlefields** - Ember Plains, Shadow Keep, Frozen Wastes
- **Medieval aesthetics** - Gothic UI with gold accents and parchment textures
- **Full voice acting** - Both boss taunts and game events are spoken aloud

### Blockchain Integration

- **Connect wallet** to track your wins/losses on-chain
- **View transaction** on 0G Explorer after each game
- **Permanent record** - your victories live forever on the blockchain

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, TailwindCSS 4 |
| **Blockchain** | 0G Galileo Testnet, ethers.js, wagmi |
| **AI** | 0G Serving SDK (`@0glabs/0g-serving-broker`) |
| **Voice** | ElevenLabs TTS API |
| **Smart Contracts** | Solidity 0.8.20 |

---

## Why 0G is the Perfect Fit

| Requirement | 0G Solution |
|-------------|-------------|
| Need dynamic AI without centralized servers | 0G Serving SDK provides decentralized AI inference |
| Need permanent game records | 0G Galileo testnet stores results on-chain |
| Need low latency for real-time gameplay | 0G's optimized compute network delivers fast responses |
| Need affordable AI inference | Pay-per-use model keeps costs predictable |
| Need verifiable AI responses | TEE ensures authentic, untampered AI outputs |

---

## Key Differentiators

1. **First card game with decentralized AI opponents** - The boss thinks, adapts, and taunts using 0G's AI network
2. **True on-chain progression** - Not just a leaderboard; actual blockchain records of every game
3. **Full multimedia experience** - Voice acting + animations + beautiful UI
4. **Web3 native** - Wallet connection, on-chain transactions, explorer links

---

## Future Roadmap (Built on 0G)

- **NFT Rewards** - Mint victory NFTs after defeating the Overlord
- **Leaderboards** - Aggregate on-chain stats for global rankings
- **PvP Mode** - Use 0G for turn verification and anti-cheat
- **More Heroes** - Each with unique card sets and playstyles
- **Boss Variants** - Different AI personalities and difficulty levels
- **0G Storage** - Store replay data and game assets on 0G decentralized storage

---

## Summary

TACO demonstrates the power of **0G's decentralized infrastructure** in gaming:

> **"A game where the enemy thinks with blockchain AI and your victories live forever on-chain."**

Built with 0G Serving SDK + 0G Galileo Testnet to showcase real-world applications of decentralized AI and blockchain in entertainment.

---

**Contract Address (0G Galileo):** `0xB68f9Ec3275410e213E0DF9357e662eb5785401E`

**Explorer:** https://chainscan-galileo.0g.ai
