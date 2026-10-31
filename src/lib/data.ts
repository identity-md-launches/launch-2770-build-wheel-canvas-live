export const API = "https://api.squeekchain.com/v1";
export const POLL_MS = 15_000;
export const UTC_DAY = 86_400_000;
export const dayKey = (date: Date | number = Date.now()) =>
  new Date(date).toISOString().slice(0, 10);
export const dayStart = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
export const number = (value: unknown): number => {
  if (!["number", "string"].includes(typeof value) || value === "")
    throw new Error("Missing number");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Invalid number");
  return parsed;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") throw new Error("Invalid response");
  return value as Record<string, unknown>;
};
const timestamp = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error("Invalid timestamp");
  return value;
};
export interface WheelStatus {
  state: "SPINNING" | "IDLE";
  settledWork: number;
  rpm: number;
  speed: number;
  work: number;
  height: number;
  progress: number;
  observedAt: string;
  generatedAt: string;
  freshness: string;
}
export interface Bucket {
  startAt: string;
  endAt: string;
  work: number;
  settlements: number;
  blocks: number;
}
export interface Settlements {
  buckets: Bucket[];
  lastHeight: number | null;
  generatedAt: string;
  startAt: string;
  endAt: string;
}
export interface Economy {
  minted: string;
  generatedAt: string;
}
export interface Night {
  date: string;
  buckets: Bucket[];
  firstHeight: number;
  lastHeight: number;
  work: number;
  blocks: number;
  source: "hourly" | "daily" | "unavailable";
  intervalStart: string;
  intervalEnd: string;
  signers: string[] | null;
}
export function parseStatus(input: unknown): WheelStatus {
  const raw = record(input),
    measurement = record(raw.measurement),
    anchor = record(record(raw.builder).anchor);
  if (!["SPINNING", "IDLE"].includes(String(measurement.coreStatus)))
    throw new Error("Unknown wheel state");
  return {
    state: measurement.coreStatus as WheelStatus["state"],
    settledWork: number(
      anchor.cumulativeWork ?? measurement.cumulativeWorkUnits,
    ),
    rpm: number(measurement.rpmMilli) / 1000,
    speed: number(measurement.speedMmPerSecond) / 1000,
    work: number(measurement.cumulativeWorkUnits),
    height: number(anchor.blockHeight),
    progress: Math.min(1, number(anchor.blockProgress) / 1e9),
    observedAt: timestamp(measurement.observedAt ?? raw.generatedAt),
    generatedAt: timestamp(raw.generatedAt),
    freshness:
      typeof measurement.freshness === "string"
        ? measurement.freshness
        : "unknown",
  };
}
export function parseSettlements(input: unknown): Settlements {
  const raw = record(input),
    window = record(raw.window);
  if (!Array.isArray(raw.buckets))
    throw new Error("Missing settlement buckets");
  const buckets = raw.buckets
    .map((item: unknown): Bucket => {
      const b = record(item);
      const startAt = timestamp(b.startAt),
        endAt = timestamp(b.endAt);
      if (Date.parse(endAt) <= Date.parse(startAt))
        throw new Error("Invalid bucket interval");
      return {
        startAt,
        endAt,
        work: number(b.workAdded),
        settlements: number(b.settlementCount),
        blocks: number(b.completedBlockCount),
      };
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const recent = Array.isArray(raw.recentSettlements)
    ? raw.recentSettlements
    : [];
  const heights = recent
    .map((v) => record(v).blockHeight)
    .filter((v) => v != null)
    .map(number);
  return {
    buckets,
    lastHeight: heights.length ? Math.max(...heights) : null,
    generatedAt: timestamp(raw.generatedAt),
    startAt: timestamp(window.startAt),
    endAt: timestamp(window.endAt),
  };
}
export function parseEconomy(input: unknown): Economy {
  const raw = record(input),
    supply = record(raw.supply);
  const minted = supply.totalMintedBaseUnits;
  if (typeof minted !== "string" || !/^\d+$/.test(minted))
    throw new Error("Invalid token supply");
  return { minted, generatedAt: timestamp(raw.generatedAt) };
}
export async function fetchJSON<T>(
  path: string,
  parse: (input: unknown) => T,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    signal: AbortSignal.timeout(11_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Data service returned ${response.status}`);
  return parse(await response.json());
}
export const emptyNight = (date: string): Night => ({
  date,
  buckets: [],
  firstHeight: 0,
  lastHeight: 0,
  work: 0,
  blocks: 0,
  source: "unavailable",
  intervalStart: `${date}T00:00:00Z`,
  intervalEnd: new Date(dayStart(date) + UTC_DAY).toISOString(),
  signers: null,
});
const totals = (buckets: Bucket[]) => ({
  work: buckets.reduce((s, b) => s + b.work, 0),
  blocks: buckets.reduce((s, b) => s + b.blocks, 0),
});
export function buildNights(
  today: string,
  hourly?: Settlements,
  history?: Settlements,
  now = Date.now(),
): Night[] {
  const days = Array.from({ length: 31 }, (_, i) =>
    emptyNight(dayKey(dayStart(today) - i * UTC_DAY)),
  );
  if (history) {
    // A cached, still-open bucket must not become an archive just as time passes.
    const completedBefore = Math.min(now, Date.parse(history.generatedAt));
    let height = Math.max(
      0,
      (history.lastHeight ?? 0) - totals(history.buckets).blocks,
    );
    for (const bucket of history.buckets) {
      const firstHeight = height;
      height += bucket.blocks;
      const night = days.find(
        (d) => d.date === dayKey(Date.parse(bucket.startAt)),
      );
      if (night && Date.parse(bucket.endAt) >= completedBefore) {
        // Preserve the interval for the waiting viewer, without exposing partial work.
        night.intervalStart = bucket.startAt;
        night.intervalEnd = bucket.endAt;
        continue;
      }
      if (night)
        Object.assign(night, {
          buckets: [bucket],
          ...totals([bucket]),
          firstHeight,
          lastHeight: height,
          source: "daily",
          intervalStart: bucket.startAt,
          intervalEnd: bucket.endAt,
        });
    }
  }
  if (hourly) {
    const buckets = hourly.buckets.filter(
      (b) => dayKey(Date.parse(b.startAt)) === today,
    );
    const t = totals(buckets);
    if (buckets.length)
      Object.assign(days[0], {
        buckets,
        ...t,
        firstHeight: Math.max(0, (hourly.lastHeight ?? 0) - t.blocks),
        lastHeight: hourly.lastHeight ?? t.blocks,
        source: "hourly",
        intervalStart: `${today}T00:00:00Z`,
        intervalEnd: new Date(
          Math.min(Date.parse(hourly.generatedAt), dayStart(today) + UTC_DAY),
        ).toISOString(),
      });
  }
  return days;
}
export function formatNumber(n: number, max = 0) {
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}
export function formatMinted(baseUnits: string) {
  const whole = BigInt(baseUnits) / 10n ** 18n;
  return whole.toLocaleString("en-US");
}
export function formatDate(date: string, full = false) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: full ? "long" : "short",
    day: "numeric",
    ...(full ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
