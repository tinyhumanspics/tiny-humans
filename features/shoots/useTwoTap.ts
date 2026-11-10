"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long "Tap again to remove" waits for the second tap. */
export const CONFIRM_MS = 4000;

/**
 * Two taps for anything that removes something (no browser confirm box): the first tap asks ("Tap again to
 * remove"), a second tap within 4 s runs `action`. `reset()` puts the button back after a failure.
 */
export function useTwoTap() {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const tap = useCallback(
    (action: () => void) => {
      if (!confirming) {
        setConfirming(true);
        timer.current = setTimeout(() => setConfirming(false), CONFIRM_MS);
        return;
      }
      clearTimeout(timer.current);
      action();
    },
    [confirming],
  );
  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setConfirming(false);
  }, []);
  return { confirming, tap, reset };
}
