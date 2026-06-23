# TACO

TACO is a fantasy card battler built with Next.js. Players connect a wallet on the 0G Galileo testnet, pick a hero, play cards against an AI boss, and record completed game results through an on-chain `GameResults` contract.

## Features

- Landing page with animated video background and game entry flow.
- Turn-based card combat with hero selection, battlefield selection, sprite animation, combat logs, rerolls, shields, healing, and gold costs.
- Wallet connection through Wagmi and the injected browser wallet connector.
- 0G Galileo testnet integration for game payments and on-chain result recording.
- 0G Serving AI endpoint for boss taunts based on the current game state.
- Optional ElevenLabs text-to-speech API route for spoken hero and boss lines.
- Solidity contract and deployment script for the game results ledger.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Wagmi, Viem, and Ethers
- 0G Serving Broker SDK
- Solidity 0.8.x
- Bun lockfile for dependency management

## Getting Started

Install dependencies:

```bash
bun install
```

Run the development server:

```bash
bun dev
```

Open `http://localhost:3000` and use `/game` to enter the playable card battle.

## Scripts

```bash
bun dev      # Start the Next.js dev server
bun build    # Create a production build
bun start    # Start the production server
bun lint     # Run ESLint
```

## Environment Variables

Create `.env.local` for local development:

```bash
PRIVATE_KEY=0x...
NEXT_PUBLIC_0G_RPC=https://evmrpc-testnet.0g.ai
ELEVENLABS_API_KEY=...
```

`PRIVATE_KEY` is used server-side for contract writes and 0G Serving broker actions. Keep it out of client code and never commit it.

`NEXT_PUBLIC_0G_RPC` is optional because the app defaults to the 0G Galileo RPC.

`ELEVENLABS_API_KEY` is only needed if the `/api/tts` route is used.

## Contract Deployment

The game result contract lives in `contracts/GameResults.sol`. It tracks deposits, withdrawals, player wins, losses, and total games played.

Deploy it with:

```bash
bun run scripts/deploy.ts
```

The deploy script compiles the Solidity contract, deploys it to the configured 0G RPC, and updates `lib/gameContract.ts` with the deployed address. The client game page also has an inline `GAME_RESULTS_ADDRESS`, so update that value if you redeploy.

## Project Structure

```text
app/
  page.tsx                 Landing page
  game/                    Playable game screen and lobby
  api/ai/boss-action/      0G Serving AI boss response route
  api/game/record/         On-chain result read/write route
  api/tts/                 ElevenLabs text-to-speech route
components/game/           Card and sprite UI components
contracts/                 Solidity game result contract
lib/                       0G, wallet, and contract helpers
public/                    Card art, character sprites, music, and backgrounds
scripts/                   Contract deployment utilities
```

## Gameplay Notes

Each game starts with 100 HP for the hero and boss, 50 gold, and a random hand of three cards. Cards can damage the boss, heal the hero, add shields, or generate gold. The boss responds after player turns, with AI taunts generated through the backend route when the 0G service is available.

Completed games are recorded through the backend `/api/game/record` route. The contract charges the configured game fee from the player's deposited balance before updating stats.

## Production Notes

- Configure the backend wallet with enough testnet A0GI for contract writes and 0G Serving operations.
- Fund player contract balances before recording games.
- Keep API keys and private keys only in server-side environment variables.
- Rebuild after changing contract addresses or public RPC configuration.
