import { useCallback, useEffect, useState } from "react";
import {
  API,
  POLL_MS,
  dayKey,
  fetchJSON,
  parseEconomy,
  parseSettlements,
  parseStatus,
} from "./data";
import type { WheelStatus, Settlements, Economy } from "./data";

interface Resource<T> {
  data?: T;
  error: boolean;
  updated?: number;
}
interface Data {
  status: Resource<WheelStatus>;
  hourly: Resource<Settlements>;
  history: Resource<Settlements>;
  economy: Resource<Economy>;
}
const CACHE = "wheel-canvas:data:v1";
function cached(): Data {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE) ?? "{}");
    // Cached objects have already passed the network parsers; bounds keep old versions out.
    const resources = saved.data;
    const finite = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0;
    const validTime = (value: unknown) =>
      typeof value === "string" && Number.isFinite(Date.parse(value));
    const validSettlements = (value: Settlements | undefined) =>
      !value ||
      (validTime(value.generatedAt) &&
        validTime(value.startAt) &&
        validTime(value.endAt) &&
        Array.isArray(value.buckets) &&
        value.buckets.every(
          (b) =>
            b &&
            validTime(b.startAt) &&
            validTime(b.endAt) &&
            finite(b.work) &&
            finite(b.blocks) &&
            finite(b.settlements),
        ));
    const valid =
      resources &&
      resources.status &&
      resources.hourly &&
      resources.history &&
      resources.economy &&
      (!resources.status.data ||
        (["SPINNING", "IDLE"].includes(resources.status.data.state) &&
          ["speed", "rpm", "work", "settledWork", "height", "progress"].every(
            (key) => finite(resources.status.data[key]),
          ) &&
          validTime(resources.status.data.observedAt))) &&
      validSettlements(resources.hourly.data) &&
      validSettlements(resources.history.data) &&
      (!resources.economy.data ||
        (typeof resources.economy.data.minted === "string" &&
          /^\d+$/.test(resources.economy.data.minted)));
    if (
      saved.version === 1 &&
      valid &&
      Date.now() - saved.savedAt < 31 * 86_400_000
    )
      return Object.fromEntries(
        ["status", "hourly", "history", "economy"].map((k) => [
          k,
          { ...saved.data[k], error: true },
        ]),
      ) as unknown as Data;
  } catch {
    /* Storage is optional on private browsers and gateways. */
  }
  return {
    status: { error: false },
    hourly: { error: false },
    history: { error: false },
    economy: { error: false },
  };
}
export function useWheelData() {
  const [data, setData] = useState<Data>(cached);
  const [today, setToday] = useState(dayKey());
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false,
      busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      setToday(dayKey());
      const results = await Promise.allSettled([
        fetchJSON("/status", parseStatus),
        fetchJSON("/settlements?range=24h", parseSettlements),
        fetchJSON("/settlements?range=30d", parseSettlements),
        fetchJSON("/economy/state", parseEconomy),
      ]);
      if (!cancelled) {
        setData((previous) => {
          const next = { ...previous };
          (["status", "hourly", "history", "economy"] as const).forEach(
            (key, i) => {
              const result = results[i];
              if (result.status === "fulfilled")
                Object.assign(next, {
                  [key]: {
                    data: result.value,
                    error: false,
                    updated: Date.now(),
                  },
                });
              else
                Object.assign(next, {
                  [key]: { ...previous[key], error: true },
                });
            },
          );
          try {
            localStorage.setItem(
              CACHE,
              JSON.stringify({ version: 1, savedAt: Date.now(), data: next }),
            );
          } catch {
            /* Quota does not interrupt live data. */
          }
          return next;
        });
        setLoading(false);
      }
      busy = false;
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [revision]);
  return { ...data, today, loading, retry, api: API };
}
