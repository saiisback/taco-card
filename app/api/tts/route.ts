import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

// Two different voices for boss vs hero lines
const BOSS_VOICE_ID = "VR6AewLTigWG4xSOukaG"; // Arnold – deep, commanding
const HERO_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel – female

export async function POST(req: NextRequest) {
  const { text, isBoss } = (await req.json()) as {
    text: string;
    isBoss: boolean;
  };

  if (!text) {
    return NextResponse.json({ error: "No text" }, { status: 400 });
  }

  const voiceId = isBoss ? BOSS_VOICE_ID : HERO_VOICE_ID;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: isBoss ? 0.15 : 0.5,
          similarity_boost: isBoss ? 0.9 : 0.75,
          style: isBoss ? 0.95 : 0.4,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: "ElevenLabs error", detail: err },
      { status: res.status }
    );
  }

  const audioBuffer = await res.arrayBuffer();

  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
