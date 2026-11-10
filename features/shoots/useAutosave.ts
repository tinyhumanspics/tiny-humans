"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShootsApiError } from "@/lib/shoots/client";

export type SaveState = { kind: "idle" | "saving" | "saved" | "retrying" } | { kind: "error"; message: string };

/** Problems that won't go away by sending the same thing again (too long, removed elsewhere, signed out). */
const permanent = (err: unknown) => err instanceof ShootsApiError && [400, 401, 403, 404].includes(err.status);

/**
 * Saves the latest value a moment after typing stops. One save at a time; while one runs, newer typing waits and is
 * sent next (never out of order). A failed save keeps the value and tries again (2 s, 4 s, … up to 30 s) with
 * "Not saved yet, retrying…"; leaving the page sends what's still waiting.
 */
export function useAutosave<T>(save: (value: T) => Promise<void>, delay = 700) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const saveRef = useRef(save);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const running = useRef(false);
  const failures = useRef(0);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async function run(): Promise<void> {
    clearTimeout(timer.current);
    if (running.current || !pending.current) return;
    const { value } = pending.current;
    pending.current = null;
    running.current = true;
    setState({ kind: "saving" });
    try {
      await saveRef.current(value);
      failures.current = 0;
      running.current = false;
      if (pending.current) return run();
      setState({ kind: "saved" });
    } catch (err) {
      running.current = false;
      if (permanent(err)) {
        setState({ kind: "error", message: (err as Error).message });
        if (pending.current) timer.current = setTimeout(run, delay);
        return;
      }
      pending.current ??= { value };
      failures.current += 1;
      setState({ kind: "retrying" });
      timer.current = setTimeout(run, Math.min(30_000, 2000 * 2 ** (failures.current - 1)));
    }
  }, [delay]);

  const queue = useCallback(
    (value: T) => {
      pending.current = { value };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
      setState((s) => (s.kind === "retrying" ? s : { kind: "saving" }));
    },
    [delay, flush],
  );

  /** Drops anything still waiting (e.g. the card was removed). */
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
  }, []);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current) void saveRef.current(pending.current.value).catch(() => undefined);
    },
    [],
  );

  return { state, queue, flush, cancel };
}

/** The line under a form: "Saving…", "Saved", "Not saved yet, retrying…" or the problem. */
export function saveText(state: SaveState): string {
  switch (state.kind) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "retrying":
      return "Not saved yet, retrying…";
    case "error":
      return state.message;
    default:
      return "";
  }
}
