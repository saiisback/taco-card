import { NextRequest, NextResponse } from "next/server";
import { recordGameResult, getPlayerStats } from "@/lib/gameContract";
import { txUrl } from "@/lib/0g";

// ---------------------------------------------------------------------------
// POST /api/game/record
// Records a game result on-chain via the backend wallet.
//
// Body: { playerAddress, won, heroHp, bossHp }
// ---------------------------------------------------------------------------

interface RecordPayload {
  playerAddress: string;
  won: boolean;
  heroHp: number;
  bossHp: number;
}

export async function GET(req: NextRequest) {
  try {
    const player = req.nextUrl.searchParams.get("player");
    if (!player) {
      return NextResponse.json({ error: "player query param required" }, { status: 400 });
    }
    const stats = await getPlayerStats(player);
    return NextResponse.json({ stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to get player stats:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RecordPayload;
    const { playerAddress, won, heroHp, bossHp } = body;

    if (!playerAddress) {
      return NextResponse.json({ error: "playerAddress required" }, { status: 400 });
    }

    const txHash = await recordGameResult(playerAddress, won, heroHp, bossHp);
    const stats = await getPlayerStats(playerAddress);

    return NextResponse.json({ txHash, txExplorerUrl: txUrl(txHash), stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to record game:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
