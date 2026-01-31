"use client";

import Image from "next/image";

export type CardType =
  | "knights_strike"
  | "clerics_prayer"
  | "shield_wall"
  | "berserk_rage"
  | "tax_peasantry"
  | "iron_judgment"
  | "fortress_stance"
  | "phantom_strike"
  | "smoke_veil";

export interface CardData {
  type: CardType;
  name: string;
  description: string;
  image: string;
}

export const CARD_DEFINITIONS: Record<CardType, CardData> = {
  knights_strike: {
    type: "knights_strike",
    name: "Knight's Strike",
    description: "-15 Boss HP",
    image: "/cards/Knight-strike.png",
  },
  clerics_prayer: {
    type: "clerics_prayer",
    name: "Cleric's Prayer",
    description: "+15 Player HP",
    image: "/cards/Cleric-prayer .png",
  },
  shield_wall: {
    type: "shield_wall",
    name: "Shield Wall",
    description: "Blocks 50% next attack",
    image: "/cards/sheild-wall.png",
  },
  berserk_rage: {
    type: "berserk_rage",
    name: "Berserk Rage",
    description: "-30 Boss HP, -10 Player HP",
    image: "/cards/breseker.png",
  },
  tax_peasantry: {
    type: "tax_peasantry",
    name: "Tax Peasantry",
    description: "+15 Gold",
    image: "/cards/tax.png",
  },
  iron_judgment: {
    type: "iron_judgment",
    name: "Iron Judgment",
    description: "-20 Boss HP",
    image: "/cards/iron-judgment.png",
  },
  fortress_stance: {
    type: "fortress_stance",
    name: "Fortress Stance",
    description: "Shield + heal 5 HP",
    image: "/cards/fortress-stance.png",
  },
  phantom_strike: {
    type: "phantom_strike",
    name: "Phantom Strike",
    description: "-25 Boss HP, costs 5 Gold",
    image: "/cards/phantom-strike.png",
  },
  smoke_veil: {
    type: "smoke_veil",
    name: "Smoke Veil",
    description: "Block 100% next attack",
    image: "/cards/smoke-veil.png",
  },
};

interface CardProps {
  card: CardType;
  onPlay: (card: CardType) => void;
  disabled: boolean;
}

export default function Card({ card, onPlay, disabled }: CardProps) {
  const def = CARD_DEFINITIONS[card];

  return (
    <button
      disabled={disabled}
      onClick={() => onPlay(card)}
      className={`
        border-none rounded p-0
        transition-all
        hover:shadow-[0_0_10px_rgba(180,120,40,0.2)] active:scale-95
        disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none
      `}
    >
      <Image src={def.image} alt={def.name} width={220} height={220} className="rounded" />
    </button>
  );
}
