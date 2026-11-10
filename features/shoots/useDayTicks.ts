"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shootsApi, ShootsApiError } from "@/lib/shoots/client";
import type { DaySheet } from "@/lib/shoots/types";

/** How often an open day sheet checks for the other phone's ticks and edits. */
export const POLL_MS = 10_000;

/**
 * The day sheet's data and ticks, shared by both phones: a tick shows at once (optimistic) and is sent; a failed
 * send keeps the tick on screen, says "Not saved yet, retrying…" and tries again. While the page is visible it
 * reloads the day every ~10 s, and right away when the phone comes back to it.
 */
export function useDayTicks(date: string) {
  const [day, setDay] = useState<DaySheet | null>(null);
  const [error, setError] = useState<ShootsApiError | null>(null);
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const [retrying, setRetrying] = useState(false);
  const pendingRef = useRef(pending);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const d = await shootsApi.day(date);
      if (ticket !== latest.current) return;
      setDay(d);
      setError(null);
    } catch (err) {
      if (ticket !== latest.current) return;
      setError(err as ShootsApiError);
    }
  }, [date]);

  /** Sends every tick still waiting; whatever fails stays waiting and is retried. */
  const flush = useCallback(async function send(): Promise<void> {
    clearTimeout(retryTimer.current);
    const waiting = [...pendingRef.current];
    if (!waiting.length) {
      setRetrying(false);
      return;
    }
    const failed: string[] = [];
    for (const [key, on] of waiting) {
      try {
        await shootsApi.tick(date, key, on);
        setDay((d) => (d ? { ...d, ticks: on ? [...new Set([...d.ticks, key])] : d.ticks.filter((k) => k !== key) } : d));
        setPending((p) => {
          if (p.get(key) !== on) return p;
          const next = new Map(p);
          next.delete(key);
          return next;
        });
      } catch {
        failed.push(key);
      }
    }
    setRetrying(failed.length > 0);
    if (failed.length) retryTimer.current = setTimeout(() => void send(), 4000);
  }, [date]);

  useEffect(() => {
    // load what is on screen, then keep it fresh
    void load();
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      clearTimeout(retryTimer.current);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [load]);

  /** On screen: the server's ticks with this phone's unsent changes on top. */
  const isTicked = useCallback(
    (key: string) => (pending.has(key) ? pending.get(key)! : Boolean(day?.ticks.includes(key))),
    [pending, day],
  );

  const toggle = useCallback(
    (key: string) => {
      const on = !isTicked(key);
      const next = new Map(pendingRef.current);
      next.set(key, on);
      pendingRef.current = next;
      setPending(next);
      void flush();
    },
    [isTicked, flush],
  );

  /** "Clear all ticks": both phones see an empty sheet after their next check. */
  const clearAll = useCallback(async () => {
    await shootsApi.clearTicks(date);
    const none = new Map<string, boolean>();
    pendingRef.current = none;
    setPending(none);
    setDay((d) => (d ? { ...d, ticks: [] } : d));
  }, [date]);

  return { day, error, isTicked, toggle, clearAll, retrying, reload: load };
}
