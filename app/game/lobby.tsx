"use client";

import Image from "next/image";
import { useState } from "react";

export type CharacterId = "kael" | "lyra";
export type BattlefieldId = 1 | 2 | 3;

interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  archetype: string;
  description: string;
  spritePath: string;
  spriteFrames: number;
}

const CHARACTERS: CharacterDef[] = [
  {
    id: "kael",
    name: "Kael",
    title: "the Ironbound",
    archetype: "Knight",
    description: "A stalwart tank who weathers any storm. Wields Iron Judgment and Fortress Stance.",
    spritePath: "/assets/Knight/Idle/idle1.png",
    spriteFrames: 12,
  },
  {
    id: "lyra",
    name: "Lyra",
    title: "the Shadowveil",
    archetype: "Rogue",
    description: "A swift assassin who strikes from the shadows. Wields Phantom Strike and Smoke Veil.",
    spritePath: "/assets/Rogue/Idle/idle1.png",
    spriteFrames: 12,
  },
];

const BATTLEFIELDS = [
  { id: 1 as BattlefieldId, name: "Ember Plains", image: "/battle-bg/battle1.png" },
  { id: 2 as BattlefieldId, name: "Shadow Keep", image: "/battle-bg/battle2.png" },
  { id: 3 as BattlefieldId, name: "Frozen Wastes", image: "/battle-bg/battle3.png" },
];

interface LobbyProps {
  onStart: (character: CharacterId, battlefield: BattlefieldId) => void;
}

export default function Lobby({ onStart }: LobbyProps) {
  const [selectedChar, setSelectedChar] = useState<CharacterId | null>(null);
  const [selectedBf, setSelectedBf] = useState<BattlefieldId | null>(null);

  const canStart = selectedChar !== null && selectedBf !== null;

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-8 bg-[#0d0a06] overflow-auto"
      style={{ fontFamily: "'MedievalSharp', 'Space Grotesk', sans-serif" }}
    >
      {/* Title */}
      <h1 className="text-amber-400 text-4xl md:text-5xl font-bold tracking-widest uppercase drop-shadow-[0_2px_8px_rgba(180,120,40,0.5)]">
        Choose Your Champion
      </h1>

      {/* Character Selection */}
      <div className="flex gap-8">
        {CHARACTERS.map((c) => {
          const active = selectedChar === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedChar(c.id)}
              className={`relative flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all w-[320px]
                ${active
                  ? "border-amber-400 bg-amber-900/30 shadow-[0_0_25px_rgba(180,120,40,0.5)]"
                  : "border-amber-800/50 bg-[#1a1209] hover:border-amber-600 hover:bg-[#1e1710]"
                }`}
            >
              <Image
                src={c.spritePath}
                alt={c.name}
                width={140}
                height={140}
                style={{ imageRendering: "pixelated" }}
              />
              <div className="text-center">
                <p className="text-amber-300 font-bold text-2xl">{c.name}</p>
                <p className="text-amber-600 text-lg italic">{c.title}</p>
                <p className="text-amber-700 text-base mt-1 leading-tight">{c.archetype}</p>
              </div>
              <p className="text-amber-600/80 text-base leading-snug text-center">{c.description}</p>
              {active && (
                <div className="absolute -top-3 -right-3 bg-amber-500 text-black text-sm font-bold px-2 py-1 rounded">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Battlefield Selection */}
      <div>
        <h2 className="text-amber-500 text-xl font-bold tracking-wider uppercase text-center mb-4">
          Select Battlefield
        </h2>
        <div className="flex gap-6">
          {BATTLEFIELDS.map((bf) => {
            const active = selectedBf === bf.id;
            return (
              <button
                key={bf.id}
                onClick={() => setSelectedBf(bf.id)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all w-[260px] h-[150px]
                  ${active
                    ? "border-amber-400 shadow-[0_0_20px_rgba(180,120,40,0.5)]"
                    : "border-amber-800/50 hover:border-amber-600 opacity-70 hover:opacity-100"
                  }`}
              >
                <Image
                  src={bf.image}
                  alt={bf.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="absolute bottom-3 left-0 right-0 text-center text-amber-300 text-lg font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {bf.name}
                </span>
                {active && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-black text-sm font-bold px-2 py-1 rounded">
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Begin Battle Button */}
      <button
        disabled={!canStart}
        onClick={() => canStart && onStart(selectedChar!, selectedBf!)}
        className={`px-14 py-4 rounded-lg border-2 font-bold text-xl tracking-widest uppercase transition-all
          ${canStart
            ? "bg-amber-800 border-amber-500 text-amber-100 hover:bg-amber-700 hover:shadow-[0_0_25px_rgba(180,120,40,0.5)]"
            : "bg-[#1a1209] border-amber-900/40 text-amber-800 cursor-not-allowed"
          }`}
      >
        Begin Battle
      </button>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=MedievalSharp&family=Space+Grotesk:wght@300..700&display=swap');
      `}</style>
    </div>
  );
}
