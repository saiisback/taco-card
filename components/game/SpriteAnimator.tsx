"use client";

import { useState, useEffect, useRef } from "react";

interface SpriteAnimatorProps {
  /** Base path like "/assets/Knight" */
  basePath: string;
  /** Animation folder name like "Idle", "Attack", "Hurt", "Death" */
  animation: string;
  /** File prefix like "idle", "attack", "hurt", "death" */
  prefix: string;
  /** Number of frames in the animation */
  frameCount: number;
  /** ms per frame */
  fps?: number;
  /** Whether to loop */
  loop?: boolean;
  /** Whether to flip horizontally (for boss facing left) */
  flip?: boolean;
  /** Pixel size to render at */
  size?: number;
  /** Called when a non-looping animation finishes */
  onEnd?: () => void;
  className?: string;
}

export default function SpriteAnimator({
  basePath,
  animation,
  prefix,
  frameCount,
  fps = 100,
  loop = true,
  flip = false,
  size = 120,
  onEnd,
  className = "",
}: SpriteAnimatorProps) {
  const [frame, setFrame] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setFrame(1);
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setFrame((prev) => {
        if (prev >= frameCount) {
          if (loop) return 1;
          if (intervalRef.current) clearInterval(intervalRef.current);
          onEnd?.();
          return prev;
        }
        return prev + 1;
      });
    }, fps);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [basePath, animation, prefix, frameCount, fps, loop, onEnd]);

  const src = `${basePath}/${animation}/${prefix}${frame}.png`;

  return (
    <img
      src={src}
      alt={animation}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        imageRendering: "pixelated",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}
