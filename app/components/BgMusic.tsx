"use client";

import { useEffect, useRef, useState } from "react";

export default function BgMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const startedRef = useRef(false);

  const getAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio("/bg.mp3");
      audio.loop = true;
      audio.volume = 0.3;
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  // Auto-play music on the first user interaction (browsers require a gesture)
  useEffect(() => {
    const tryPlay = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const audio = getAudio();
      audio.play().then(() => setPlaying(true)).catch(() => {
        // If play still fails, reset so we can retry
        startedRef.current = false;
      });
    };

    window.addEventListener("click", tryPlay, { once: false });
    window.addEventListener("keydown", tryPlay, { once: false });

    // Also try immediately in case autoplay is allowed
    const audio = getAudio();
    audio.play().then(() => {
      startedRef.current = true;
      setPlaying(true);
    }).catch(() => {
      // Blocked by browser, will play on first interaction
    });

    return () => {
      window.removeEventListener("click", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
  }, []);

  // Sync pause/play when user toggles
  useEffect(() => {
    if (!startedRef.current) return;
    const audio = getAudio();
    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing]);

  const toggle = () => {
    if (!startedRef.current) {
      // First interaction, start playing
      const audio = getAudio();
      audio.play().then(() => {
        startedRef.current = true;
        setPlaying(true);
      }).catch(console.error);
      return;
    }
    setPlaying((p) => !p);
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
