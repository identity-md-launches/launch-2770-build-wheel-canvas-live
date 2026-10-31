import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildNights,
  emptyNight,
  formatMinted,
  number,
  parseEconomy,
  parseSettlements,
  parseStatus,
} from "../src/lib/data";
import { addressHue, paintArt } from "../src/lib/art";
import type { Night } from "../src/lib/data";
const timestamp = "2026-10-31T08:30:00Z";
const status = parseStatus({
  generatedAt: timestamp,
  measurement: {
    coreStatus: "SPINNING",
    rpmMilli: 12345,
    speedMmPerSecond: 210,
    cumulativeWorkUnits: "58518",
    observedAt: timestamp,
    freshness: "online",
  },
  builder: { anchor: { blockHeight: "5204", blockProgress: "637347328" } },
});
assert.equal(status.rpm, 12.345);
assert.equal(status.speed, 0.21);
assert.equal(status.progress, 0.637347328);
assert.throws(() => number(null));
assert.throws(() => number("NaN"));
assert.throws(() => number(-1));
assert.throws(() => parseStatus({}));
const minted = parseEconomy({
  generatedAt: timestamp,
  supply: { totalMintedBaseUnits: "20709575486483509966868467" },
});
assert.equal(formatMinted(minted.minted), "20,709,575");
const raw = {
  generatedAt: timestamp,
  window: { startAt: "2026-10-30T09:00:00Z", endAt: "2026-10-31T09:00:00Z" },
  recentSettlements: [{ blockHeight: "5204" }],
  buckets: [
    {
      startAt: "2026-10-31T00:00:00Z",
      endAt: "2026-10-31T01:00:00Z",
      workAdded: "100",
      settlementCount: "6",
      completedBlockCount: "8",
    },
    {
      startAt: "2026-10-30T23:00:00Z",
      endAt: "2026-10-31T00:00:00Z",
      workAdded: "200",
      settlementCount: "6",
      completedBlockCount: "16",
    },
  ],
};
const hourly = parseSettlements(raw);
assert.equal(hourly.buckets[0].work, 200);
const tonight = buildNights("2026-10-31", hourly)[0];
assert.equal(tonight.work, 100);
assert.equal(tonight.blocks, 8);
assert.equal(tonight.firstHeight, 5196);
assert.equal(buildNights("2026-11-01", hourly)[0].source, "unavailable");
assert.equal(buildNights("2026-10-31", hourly).length, 31);
assert.equal(emptyNight("2026-10-31").signers, null);
const noon = Date.parse("2026-10-31T12:00:00Z");
const daily = parseSettlements({
  ...raw,
  recentSettlements: [{ blockHeight: "5204" }],
  buckets: [
    { ...raw.buckets[0], startAt: "2026-10-29T12:00:00Z", endAt: "2026-10-30T12:00:00Z" },
    { ...raw.buckets[1], startAt: "2026-10-30T12:00:00Z", endAt: "2026-10-31T12:00:00Z" },
  ],
});
const beforeClose = buildNights("2026-10-31", hourly, daily, noon - 1);
assert.equal(beforeClose[0].source, "hourly", "live hourly data remains available");
assert.equal(beforeClose[1].source, "unavailable", "yesterday's open noon-to-noon bucket stays out");
assert.deepEqual(beforeClose[1].buckets, []);
assert.equal(beforeClose[1].intervalEnd, "2026-10-31T12:00:00Z", "waiting viewer preserves the actual bucket interval");
assert.equal(beforeClose[2].source, "daily");
assert.equal(beforeClose[2].lastHeight, 5188);
assert.equal(buildNights("2026-10-31", hourly, daily, noon + 1)[1].source, "unavailable", "cached partial data cannot mature with wall time");
const atClose = { ...daily, generatedAt: new Date(noon).toISOString() };
assert.equal(buildNights("2026-10-31", hourly, atClose, noon)[1].source, "unavailable");
const afterClose = { ...daily, generatedAt: new Date(noon + 1).toISOString() };
assert.equal(buildNights("2026-10-31", hourly, afterClose, noon - 1)[1].source, "unavailable", "clock-skewed snapshots cannot expose future buckets");
assert.equal(buildNights("2026-10-31", hourly, afterClose, noon + 1)[1].source, "daily");
const growing = { ...daily, lastHeight: daily.lastHeight! + 7, buckets: [daily.buckets[0], { ...daily.buckets[1], blocks: daily.buckets[1].blocks + 7, work: 900 }] };
assert.deepEqual(buildNights("2026-10-31", hourly, growing, noon - 1)[2], beforeClose[2], "an open bucket growing leaves closed nights and heights unchanged");
const a = "0x4168D958C147b626c16C2e6B3124B4412cA7CE05",
  b = "0xB4f55d6C56F43Ae94850B096A9d13280C3ebAaa9";
assert.equal(addressHue(a), addressHue(a.toLowerCase()));
const night: Night = { ...tonight, buckets: hourly.buckets, signers: [a, b] };
function renderCommands(night: Night, live = false) {
  const calls: unknown[] = [];
  const gradient = {
    addColorStop: (...args: unknown[]) => calls.push(["colorStop", ...args]),
  };
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "createRadialGradient"
          ? (...args: unknown[]) => {
              calls.push([key, ...args]);
              return gradient;
            }
          : (...args: unknown[]) => {
              if (key === "arc" || key === "ellipse") {
                assert(
                  Number(args[2]) <= 250,
                  "wheel marks must fit inside the 500px artwork height",
                );
                if (key === "ellipse") assert(Number(args[3]) <= 250);
              }
              return calls.push([key, ...args]);
            },
      set: (_, key, value) => {
        calls.push([key, value === gradient ? "gradient" : value]);
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  paintArt(ctx, 800, 500, night, live ? { live: status } : {});
  return calls as [string, ...unknown[]][];
}
const digest = (night: Night, live = false) =>
  createHash("sha256").update(JSON.stringify(renderCommands(night, live))).digest("hex");
assert.equal(digest(night), digest(night));
assert.equal(
  digest(night),
  digest({
    ...night,
    buckets: [...night.buckets].reverse(),
    signers: [b, a.toLowerCase(), a],
  }),
);
for (const changed of [
  { ...night, date: "2026-10-30" },
  { ...night, firstHeight: night.firstHeight + 1 },
  { ...night, signers: [a] },
  { ...night, buckets: [{ ...night.buckets[0], work: 401 }] },
])
  assert.notEqual(digest(night), digest(changed));
assert.notEqual(digest(night), digest(night, true));
const archived = (work: number, buckets = 1): Night => ({
  ...beforeClose[2], work, blocks: 1000,
  buckets: Array.from({ length: buckets }, (_, i) => ({
    startAt: new Date(Date.parse("2026-10-29T00:00:00Z") + i * 3600000).toISOString(),
    endAt: new Date(Date.parse("2026-10-29T00:00:00Z") + (i + 1) * 3600000).toISOString(),
    work: work / buckets, blocks: 1000 / buckets, settlements: 6,
  })),
});
for (const work of [0, 150, 4000, 10891, 15000, 30000]) {
  const commands = renderCommands(archived(work));
  assert.equal(commands.filter(([name]) => name === "ellipse").length, work ? Math.round(300 + 900 * Math.min(1, work / 15000)) : 0);
  let mode = "source-over";
  const stack: string[] = [];
  for (const [name, value] of commands) {
    if (name === "save") stack.push(mode);
    if (name === "restore") mode = stack.pop()!;
    if (name === "globalCompositeOperation") mode = String(value);
    if (name === "ellipse") assert.equal(mode, "source-over", "archive strokes do not additively saturate");
    if (name === "strokeStyle" && String(value).startsWith("hsla")) assert.match(String(value), /,0\.35\)$/);
    if (name === "fillRect") assert.equal(mode, "source-over", "only block rings use lighter");
  }
  assert.equal(commands.filter(([name]) => name === "arc").length, 2004, "each of 1000 blocks keeps its ring and accent");
}
assert.equal(renderCommands(archived(15000, 10)).filter(([name]) => name === "ellipse").length, 1200, "stroke budget is per night, not per bucket");
console.log(
  "PASS model checks: strict parsers; units/UTC rollover; open/end-boundary/cached-partial/clock-skew archive exclusion; stable completed-night heights; live hourly data preserved; per-night stroke budget at six work levels; source-over at 0.35 alpha; one lighter ring per block; deterministic seeded geometry and signer dedup; live speed affects marks.",
);
