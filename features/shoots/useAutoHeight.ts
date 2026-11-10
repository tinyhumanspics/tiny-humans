"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * A textarea that grows with its text (long lines wrap on a phone), so nothing hides below its edge; measured again
 * when the chalk font arrives or the phone turns. Returns the ref to put on the textarea.
 */
export function useAutoHeight(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 4}px`;
  }, []);
  useLayoutEffect(fit, [value, fit]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    void document.fonts?.ready.then(fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);
  return ref;
}
