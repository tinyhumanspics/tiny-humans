import { afterEach, describe, expect, it, vi } from "vitest";
import { builtInCatalog } from "@/lib/pricing/catalog";

describe("built-in bundles", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("are used locally and in CI (no Vercel environment)", () => {
    vi.stubEnv("VERCEL_ENV", "");
    expect(builtInCatalog().map((b) => b.id)).toEqual(["little-moments", "our-little-story", "forever-little"]);
  });

  it("stay available on preview deployments", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(builtInCatalog()).toHaveLength(3);
  });

  it("are refused on the live site", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => builtInCatalog()).toThrow();
  });
});
