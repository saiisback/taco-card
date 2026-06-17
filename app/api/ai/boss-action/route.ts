import { NextRequest, NextResponse } from "next/server";
import { getBroker } from "@/lib/0g";

// ---------------------------------------------------------------------------
// POST /api/ai/boss-action
//
// Receives the current game state and returns an AI-generated boss taunt
// using the 0G Serving SDK, with fallback to random taunts.
//
// Request body: { heroHp, bossHp, gold, isShielded }
// Response:     { message: string }
// ---------------------------------------------------------------------------

interface BossActionPayload {
  heroHp: number;
  bossHp: number;
  gold: number;
  isShielded: boolean;
}

const SYSTEM_PROMPT = `You are a medieval overlord AI boss in a card-based battle game. You speak in short, menacing taunts (1-2 sentences max). You reference the game state when relevant. Stay in character.`;

let _providerReady = new Set<string>();

async function ensureProviderAccount(providerAddress: string) {
  if (_providerReady.has(providerAddress)) return;

  const broker = await getBroker();

  // 1. Ensure the provider's TEE signer is acknowledged (creates sub-account + acknowledges)
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    console.log(`[0G] Provider ${providerAddress} acknowledged`);
  } catch (e: any) {
    // If already acknowledged or account already exists, that's fine
    const msg = `${e?.message ?? ""} ${e?.reason ?? ""}`;
    if (!msg.includes("already") && !msg.includes("Acknowledged")) {
      console.warn("[0G] acknowledgeProviderSigner warning:", msg);
    }
  }

  _providerReady.add(providerAddress);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BossActionPayload;

  const broker = await getBroker();
  const services = await broker.inference.listService();

  if (!services || services.length === 0) {
    return NextResponse.json({ error: "No 0G AI services available" }, { status: 503 });
  }

  // Pick the first available service
  // ServiceStructOutput is a tuple: [provider, serviceType, url, inputPrice, outputPrice, updatedAt, model, ...]
  const service = services[0];
  const providerAddress = service[0];
  const serviceType = service[1]; // e.g. "chatbot"
  const endpoint = service[2];
  const model = service[6];

  console.log(`[DEBUG] Using provider=${providerAddress}, serviceType=${serviceType}, model=${model}`);

  // Ensure the sub-account exists and provider signer is acknowledged
  try {
    await ensureProviderAccount(providerAddress);
  } catch (e: any) {
    console.error("[0G] ensureProviderAccount failed:", e?.message);
    return NextResponse.json({ error: "Failed to setup provider account" }, { status: 500 });
  }

  const userContent = `Game state: Hero HP=${body.heroHp}, Boss HP=${body.bossHp}, Gold=${body.gold}, Shielded=${body.isShielded}. Respond with a short boss taunt.`;

  // getRequestHeaders internally calls topUpAccountIfNeeded which handles transferFund
  const headers = await broker.inference.getRequestHeaders(
    providerAddress,
    userContent
  );

  const chatRes = await fetch(`${endpoint}/v1/proxy/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: 80,
    }),
  });

  if (!chatRes.ok) {
    const errText = await chatRes.text();
    console.error("0G AI response not ok:", chatRes.status, errText);
    return NextResponse.json({ error: `0G AI error: ${chatRes.status}` }, { status: 502 });
  }

  const data = await chatRes.json();
  const chatId: string | undefined = data.id;
  const aiMessage: string | undefined = data.choices?.[0]?.message?.content;

  if (!aiMessage) {
    return NextResponse.json({ error: "No message in AI response" }, { status: 502 });
  }

  // Settle fees — pass chatId from the response
  await broker.inference.processResponse(
    providerAddress,
    chatId,
    aiMessage
  );

  return NextResponse.json({ message: aiMessage });
}
