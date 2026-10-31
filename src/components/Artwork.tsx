import { useEffect, useRef } from "react";
import { paintArt } from "../lib/art";
import type { Night, WheelStatus } from "../lib/data";

export function Artwork({
  night,
  live,
  paused = false,
  thumbnail = false,
}: {
  night: Night;
  live?: WheelStatus;
  paused?: boolean;
  thumbnail?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const idleStart = useRef<number | null>(null);
  if (live?.state === "IDLE") idleStart.current ??= performance.now();
  else idleStart.current = null;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const start = performance.now();
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * scale);
      canvas.height = Math.round(bounds.height * scale);
      cancelAnimationFrame(frame);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const paint = (now: number) => {
        const staticFrame = preference.matches || paused || thumbnail;
        const phase = staticFrame ? 1 : Math.min(1, (now - start) / 1600);
        const calm =
          live?.state === "IDLE"
            ? staticFrame
              ? 1
              : Math.min(1, (now - (idleStart.current ?? now)) / 12_000)
            : 0;
        paintArt(ctx, bounds.width, bounds.height, night, {
          live,
          phase,
          calm,
        });
        if (
          !staticFrame &&
          ((live?.state === "SPINNING" && phase < 1) ||
            (live?.state === "IDLE" && calm < 1))
        )
          frame = requestAnimationFrame(paint);
      };
      paint(performance.now());
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    preference.addEventListener("change", resize);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", resize);
      cancelAnimationFrame(frame);
    };
  }, [night, live, paused, thumbnail]);
  return (
    <canvas
      ref={ref}
      className="artwork"
      role="img"
      aria-label={
        night.source === "unavailable"
          ? `Artwork for ${night.date} is waiting for settlement data.`
          : `Generative wheel artwork for ${night.date}: ${night.work} work units, ${night.blocks} completed blocks, ${night.signers === null ? "signers not yet verified" : `${night.signers.length} community signers`}.`
      }
    />
  );
}
