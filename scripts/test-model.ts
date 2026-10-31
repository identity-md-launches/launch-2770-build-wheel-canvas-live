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
const a = "0x4168D958C147b626c16C2e6B3124B4412cA7CE05",
  b = "0xB4f55d6C56F43Ae94850B096A9d13280C3ebAaa9";
assert.equal(addressHue(a), addressHue(a.toLowerCase()));
const night: Night = { ...tonight, buckets: hourly.buckets, signers: [a, b] };
function digest(night: Night, live = false) {
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
  return createHash("sha256").update(JSON.stringify(calls)).digest("hex");
}
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
console.log(
  "PASS model checks: strict parsers; exact supply units; UTC rollover; chronological buckets; stable address hue; canonical render deterministic under input reorder/dedup; date, block, work, signatures and live speed affect marks.",
);
