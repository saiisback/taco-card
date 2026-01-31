"use client";

import { useEffect, useRef, useState } from "react";

export default function BgMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const getAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio("/bg.mp3");
      audio.loop = true;
      audio.volume = 0.3;
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  const toggle = () => {
    const audio = getAudio();
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(console.error);
    }
  };

  return (
    <button
      onClick={toggle}
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "50%",
        width: 40,
        height: 40,
        cursor: "pointer",
        color: "white",
        fontSize: 18,
      }}
      title={playing ? "Mute" : "Play music"}
    >
      {playing ? "🔊" : "🔇"}
    </button>
  );
}
