import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";
import { client, TOKEN, approvalEvent, CHAIN_ID } from "./chain";
import { POLL_MS, UTC_DAY, dayKey, dayStart } from "./data";

export interface SignerDay {
  addresses: string[];
  checkedAt: number;
  throughBlock: string;
}
export interface SignerState {
  days: Record<string, SignerDay>;
  error: boolean;
  loading: boolean;
}
interface Signature {
  address: string;
  block: bigint;
}
const CACHE = "wheel-canvas:signers:v1";
const load = (): Record<string, SignerDay> => {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE) ?? "{}") as Record<
      string,
      SignerDay
    >;
    return Object.fromEntries(
      Object.entries(saved).filter(
        ([key, value]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(key) &&
          value &&
          Array.isArray(value.addresses) &&
          value.addresses.every((a) => /^0x[0-9a-fA-F]{40}$/.test(a)) &&
          Number.isFinite(value.checkedAt) &&
          /^\d+$/.test(value.throughBlock),
      ),
    );
  } catch {
    return {};
  }
};
const boundaries = new Map<number, bigint>();
/** First block at or after a UTC timestamp; estimates never define the final boundary. */
export async function firstBlockAt(
  timestamp: number,
  latest: bigint,
): Promise<bigint> {
  if (boundaries.has(timestamp)) return boundaries.get(timestamp)!;
  const head = await client.getBlock({ blockNumber: latest });
  if (Number(head.timestamp) < timestamp) return latest + 1n;
  let low = 0n,
    high = latest;
  const guess =
    latest -
    BigInt(Math.max(0, Math.floor((Number(head.timestamp) - timestamp) / 12)));
  const left = guess > 10_000n ? guess - 10_000n : 0n;
  const right = guess + 10_000n < latest ? guess + 10_000n : latest;
  const [a, b] = await Promise.all([
    client.getBlock({ blockNumber: left }),
    client.getBlock({ blockNumber: right }),
  ]);
  if (Number(a.timestamp) < timestamp) low = left;
  if (Number(b.timestamp) >= timestamp) high = right;
  while (low < high) {
    const mid = (low + high) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    if (Number(block.timestamp) < timestamp) low = mid + 1n;
    else high = mid;
  }
  boundaries.set(timestamp, low);
  return low;
}
async function readLogs(from: bigint, to: bigint): Promise<Signature[]> {
  if (from > to) return [];
  try {
    const logs = await client.getLogs({
      address: TOKEN,
      event: approvalEvent,
      fromBlock: from,
      toBlock: to,
      strict: true,
    });
    return logs
      .filter(
        (log) =>
          !log.removed &&
          log.args.owner?.toLowerCase() === log.args.spender?.toLowerCase() &&
          log.args.value === 0n,
      )
      .map((log) => ({
        address: getAddress(log.args.owner!),
        block: log.blockNumber,
      }));
  } catch (error) {
    const message = String(error);
    const rangeLimit =
      /block range|range limit|too many (results|logs)|response size|maximum.*(block|range|result)|exceed.*(block|range|result)/i.test(
        message,
      );
    if (to - from < 250n || !rangeLimit) throw error;
    const mid = (from + to) / 2n;
    return [...(await readLogs(from, mid)), ...(await readLogs(mid + 1n, to))];
  }
}
const unique = (addresses: string[]) =>
  [...new Set(addresses)].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
async function headBlock() {
  const [chainId, head] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber({ cacheTime: 0 }),
  ]);
  if (chainId !== CHAIN_ID) throw new Error("RPC is not Sepolia");
  // One confirmation; the next poll rescans the full day to remove reorged logs.
  return head > 1n ? head - 1n : head;
}
export async function readDay(date: string): Promise<SignerDay> {
  const latest = await headBlock();
  const [start, end] = await Promise.all([
    firstBlockAt(dayStart(date) / 1000, latest),
    firstBlockAt((dayStart(date) + UTC_DAY) / 1000, latest),
  ]);
  const to = end > latest ? latest : end - 1n;
  const addresses: string[] = [];
  for (let from = start; from <= to; from += 2_000n)
    addresses.push(
      ...(await readLogs(from, from + 1_999n < to ? from + 1_999n : to)).map(
        (s) => s.address,
      ),
    );
  return {
    addresses: unique(addresses),
    checkedAt: Date.now(),
    throughBlock: to.toString(),
  };
}
/** Fetch the archive once, grouping verified event blocks by their real UTC timestamps. */
export async function readArchive(
  today: string,
  cancelled: () => boolean,
): Promise<Record<string, SignerDay>> {
  const latest = await headBlock();
  const start = await firstBlockAt(
    (dayStart(today) - 30 * UTC_DAY) / 1000,
    latest,
  );
  const end = await firstBlockAt(dayStart(today) / 1000, latest);
  const last = end - 1n;
  const signatures: Signature[] = [];
  const chunks: bigint[] = [];
  for (let from = start; from <= last; from += 8_000n) chunks.push(from);
  // Keep public RPC use bounded; two ranges at a time, no relay or indexer.
  for (let i = 0; i < chunks.length; i += 2) {
    if (cancelled()) return {};
    const results = await Promise.all(
      chunks
        .slice(i, i + 2)
        .map((from) =>
          readLogs(from, from + 7_999n < last ? from + 7_999n : last),
        ),
    );
    results.forEach((r) => signatures.push(...r));
  }
  const dates = new Map<bigint, string>();
  for (const block of [...new Set(signatures.map((s) => s.block))]) {
    if (cancelled()) return {};
    dates.set(
      block,
      dayKey(
        Number((await client.getBlock({ blockNumber: block })).timestamp) *
          1000,
      ),
    );
  }
  const days: Record<string, SignerDay> = {};
  for (let i = 1; i <= 30; i++) {
    const date = dayKey(dayStart(today) - i * UTC_DAY);
    days[date] = {
      addresses: unique(
        signatures
          .filter((s) => dates.get(s.block) === date)
          .map((s) => s.address),
      ),
      checkedAt: Date.now(),
      throughBlock: last.toString(),
    };
  }
  return days;
}
export function useSigners(today: string, selected?: string) {
  const [state, setState] = useState<SignerState>(() => ({
    days: load(),
    error: false,
    loading: true,
  }));
  const [revision, setRevision] = useState(0);
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [archiveError, setArchiveError] = useState(false);
  const retry = useCallback(() => {
    setRevision((v) => v + 1);
    setArchiveRevision((v) => v + 1);
  }, []);
  const save = (days: Record<string, SignerDay>) => {
    const cutoff = Date.now() - 33 * UTC_DAY;
    Object.keys(days).forEach((key) => {
      if (dayStart(key) < cutoff) delete days[key];
    });
    try {
      localStorage.setItem(CACHE, JSON.stringify(days));
    } catch {
      /* Optional cache. */
    }
  };
  useEffect(() => {
    let alive = true,
      busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      const dates = [
        ...new Set([
          today,
          ...(selected && selected !== today ? [selected] : []),
        ]),
      ];
      let error = false;
      for (const date of dates) {
        try {
          const result = await readDay(date);
          if (alive)
            setState((old) => {
              const days = { ...old.days, [date]: result };
              save(days);
              return { days, error: false, loading: false };
            });
        } catch {
          error = true;
        }
      }
      if (alive) setState((old) => ({ ...old, error, loading: false }));
      busy = false;
    };
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [today, selected, revision]);
  useEffect(() => {
    let cancelled = false;
    setArchiveError(false);
    const stale = Array.from({ length: 30 }, (_, i) =>
      dayKey(dayStart(today) - (i + 1) * UTC_DAY),
    ).some(
      (d) => !state.days[d] || Date.now() - state.days[d].checkedAt > 3_600_000,
    );
    if (stale)
      void readArchive(today, () => cancelled)
        .then((archive) => {
          if (!cancelled)
            setState((old) => {
              const days = { ...old.days, ...archive };
              save(days);
              return { ...old, days };
            });
        })
        .catch(() => {
          if (!cancelled) setArchiveError(true);
        });
    return () => {
      cancelled = true;
    };
  }, [today, archiveRevision]);
  return { ...state, archiveError, retry };
}
