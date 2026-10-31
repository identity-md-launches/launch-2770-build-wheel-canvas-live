import type { Night, WheelStatus } from "./data";

export const ART_VERSION = "wheel-v1";
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const addressHue = (address: string) =>
  hash(address.toLowerCase()) % 360;
export interface ArtOptions {
  live?: WheelStatus;
  phase?: number;
  calm?: number;
  centered?: boolean;
}
/** A pure canonical renderer: no clock, random source, device dimensions or arrival order in its seed. */
export function paintArt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  night: Night,
  options: ArtOptions = {},
) {
  const { live, phase = 1, calm = 0 } = options;
  ctx.save();
  ctx.fillStyle = "#101112";
  ctx.fillRect(0, 0, width, height);
  const size = Math.min(width, height),
    cx = width / 2,
    cy = height / 2,
    radius = size * 0.43;
  const background = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.45);
  background.addColorStop(0, "#271b14");
  background.addColorStop(0.62, "#181613");
  background.addColorStop(1, "#101112");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const decor = random(hash(`${ART_VERSION}:${night.date}:field`));
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(222,187,137,${0.06 + decor() * 0.15})`;
    ctx.fillRect(decor() * width, decor() * height, 1, 1);
  }
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = "#302920";
  for (const fraction of [0.22, 0.5, 0.78, 1]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * fraction, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Registration marks frame the wheel without pretending to represent measurements.
  ctx.strokeStyle = "#52452e";
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const r = radius * 1.07;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.lineTo(
      cx + Math.cos(angle) * (r + (i % 4 === 0 ? 5 : 2)),
      cy + Math.sin(angle) * (r + (i % 4 === 0 ? 5 : 2)),
    );
    ctx.stroke();
  }
  const energy = live ? Math.min(1, live.speed / 0.6) : 0.65;
  const baseSeed = `${ART_VERSION}:${night.date}:${night.firstHeight}`;
  let cursor = night.firstHeight * 17;
  let block = night.firstHeight;
  ctx.globalCompositeOperation = "lighter";
  const paintRing = (height: number) => {
    const rng = random(hash(`${ART_VERSION}:${night.date}:block:${height}`));
    const r = radius * (0.19 + rng() * 0.78),
      angle = rng() * Math.PI * 2;
    ctx.strokeStyle = `rgba(255,${158 + Math.floor(rng() * 72)},93,${0.025 + rng() * 0.07})`;
    ctx.lineWidth = 0.4 + rng() * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,221,142,0.5)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + 0.025 + rng() * 0.07);
    ctx.stroke();
  };
  for (const bucket of [...night.buckets].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  )) {
    const rng = random(hash(`${baseSeed}:height:${block}`));
    // More real work paints more marks. Each mark has a fixed cumulative-work coordinate.
    const count = Math.min(1200, Math.ceil(bucket.work / 4));
    for (let i = 0; i < count; i++) {
      const work = cursor + (i / Math.max(count, 1)) * bucket.work;
      const turn = (((work % 10_000) + 10_000) % 10_000) / 10_000;
      const angle = turn * Math.PI * 26 + rng() * 0.12;
      const r =
        radius * (0.16 + Math.sqrt(turn) * 0.78) +
        (rng() - 0.5) * radius * 0.055;
      const length = 0.02 + rng() * 0.1 + energy * 0.06;
      const hue = 19 + rng() * 28;
      const light = 37 + rng() * 27;
      ctx.strokeStyle = `hsla(${hue},${65 + rng() * 25}%,${light}%,${0.28 + rng() * 0.45})`;
      ctx.lineWidth = 0.35 + rng() * 1.2;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        r,
        r * (0.9 + rng() * 0.08),
        angle * 0.03,
        angle,
        angle + length,
      );
      ctx.stroke();
      if (i % 7 === 0) {
        const x = cx + Math.cos(angle) * r,
          y = cy + Math.sin(angle) * r;
        ctx.fillStyle = "rgba(255,192,91,0.7)";
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
    cursor += bucket.work;
    // One bright, hairline ring per completed Squeek block. Rings have independent seeds.
    for (let b = 0; b < bucket.blocks; b++) {
      paintRing(++block);
    }
  }
  // Status can confirm a block before the settlement index has caught up.
  if (live && night.source !== "unavailable") {
    for (let height = night.lastHeight + 1; height <= live.height; height++) {
      paintRing(height);
    }
  }
  // Unsettled work paints an accumulating trail between settlement checkpoints.
  // Coordinates are derived from work units, so reconnecting reproduces the trail.
  if (live && live.work > live.settledWork) {
    const delta = live.work - live.settledWork;
    const step = Math.max(2, Math.ceil(delta / 1200));
    for (let work = live.settledWork; work < live.work; work += step) {
      const rng = random(
        hash(`${night.date}:${live.height}:unsettled:${work}`),
      );
      const angle = work * 0.016;
      const r = radius * (0.3 + ((work % 8000) / 8000) * 0.65);
      ctx.strokeStyle = `rgba(255,${160 + Math.floor(rng() * 60)},105,${0.25 + energy * 0.4})`;
      ctx.lineWidth = 0.5 + energy * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle, angle + 0.025 + energy * 0.08);
      ctx.stroke();
    }
  }
  // A reproducible live tip responds to this poll's work, block height and speed.
  if (live?.state === "SPINNING" && live.speed > 0) {
    const tip = random(hash(`${night.date}:${live.height}`));
    const angle = live.work * 0.016 + tip();
    const r = radius * (0.3 + ((live.work % 8000) / 8000) * 0.65);
    ctx.lineWidth = 1.2 + energy;
    ctx.strokeStyle = "rgba(255,204,106,0.95)";
    ctx.shadowColor = "#ff952e";
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + (0.06 + energy * 0.55) * phase);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // Exactly one deterministic accent stroke for each distinct, sorted signer.
  for (const address of [
    ...new Set((night.signers ?? []).map((a) => a.toLowerCase())),
  ].sort()) {
    const rng = random(hash(`${night.date}:signer:${address}`));
    const angle = rng() * Math.PI * 2,
      r = radius * (0.35 + rng() * 0.62);
    ctx.strokeStyle = `hsl(${addressHue(address)},75%,70%)`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + 0.18 + rng() * 0.16);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  if (calm > 0) {
    ctx.fillStyle = `rgba(14,17,22,${Math.min(0.54, calm * 0.54)})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}
export async function downloadCard(night: Night, address?: string) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create a PNG.");
  ctx.fillStyle = "#101112";
  ctx.fillRect(0, 0, 1600, 1200);
  const artwork = document.createElement("canvas");
  artwork.width = 1488;
  artwork.height = 850;
  const art = artwork.getContext("2d")!;
  paintArt(art, 1488, 850, night);
  ctx.drawImage(artwork, 56, 100);
  ctx.fillStyle = "#f4ede3";
  ctx.font = '600 36px "DM Sans",sans-serif';
  ctx.fillText("Wheel Canvas", 64, 67);
  ctx.fillStyle = "#d8b16c";
  ctx.font = '400 24px "Silkscreen",monospace';
  ctx.textAlign = "right";
  ctx.fillText(`${night.date} · UTC`, 1536, 64);
  ctx.textAlign = "left";
  ctx.strokeStyle = "#39322b";
  ctx.beginPath();
  ctx.moveTo(64, 970);
  ctx.lineTo(1536, 970);
  ctx.stroke();
  const items = [
    [`${night.work.toLocaleString("en-US")}`, "work units"],
    [`${night.blocks.toLocaleString("en-US")}`, "blocks completed"],
    [
      night.signers ? String(night.signers.length) : "Unavailable",
      "community signers",
    ],
  ];
  items.forEach(([value, label], i) => {
    ctx.fillStyle = "#f4ede3";
    ctx.font = '600 36px "DM Sans",sans-serif';
    ctx.fillText(value, 64 + i * 430, 1038);
    ctx.fillStyle = "#b7ada0";
    ctx.font = '400 22px "DM Sans",sans-serif';
    ctx.fillText(label, 64 + i * 430, 1078);
  });
  const signed =
    address &&
    night.signers?.some((a) => a.toLowerCase() === address.toLowerCase());
  ctx.fillStyle = "#f6b65b";
  ctx.font = '400 22px "DM Sans",sans-serif';
  ctx.fillText(
    signed
      ? `I signed it · ${address!.slice(0, 6)}…${address!.slice(-4)}`
      : "Painted by Squeektoshi. Signed by the community.",
    64,
    1154,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "#b7ada0";
  ctx.fillText("squeekchain.com · Sepolia testnet", 1536, 1154);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wheel-canvas-${night.date}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
