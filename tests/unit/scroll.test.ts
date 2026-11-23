import { afterEach, describe, expect, test, vi } from "vitest";
import { scrollBehavior } from "@/lib/scroll";

const prefers = (reduce: boolean) => vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: reduce && q === "(prefers-reduced-motion: reduce)" }) });

describe("scrollBehavior", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("smooth for most visitors", () => {
    prefers(false);
    expect(scrollBehavior()).toBe("smooth");
  });

  test("instant for visitors who asked for reduced motion", () => {
    prefers(true);
    expect(scrollBehavior()).toBe("auto");
  });
});
