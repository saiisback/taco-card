"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/40" />
      <main className="relative z-10 flex flex-col items-center gap-12">
        <Image
          src="/landing.png"
          alt="TACO"
          width={500}
          height={200}
          priority
          className="w-[300px] sm:w-[500px] drop-shadow-[0_2px_8px_rgba(255,215,0,0.4)]"
        />
        <Link
          href="/game"
          className="rounded-full px-10 py-4 text-lg font-bold text-black transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,215,0,0.6)]"
          style={{
            background:
              "linear-gradient(180deg, #ffd700 0%, #b8860b 100%)",
            fontFamily: "'MedievalSharp', 'Space Grotesk', sans-serif",
          }}
        >
          Play Now
        </Link>
      </main>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=MedievalSharp&family=Space+Grotesk:wght@300..700&display=swap');
      `}</style>
    </div>
  );
}
