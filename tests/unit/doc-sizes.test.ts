import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every session loads these files: keep them small (brief 00).
const LIMITS: [file: string, maxBytes: number][] = [
  ["AGENTS.md", 5 * 1024],
  ["docs/STATE.md", 4 * 1024],
  ["docs/DECISIONS.md", 6 * 1024],
];

describe("session docs stay small", () => {
  for (const [file, maxBytes] of LIMITS) {
    it(`${file} is at most ${maxBytes / 1024} KB`, () => {
      expect(statSync(join(process.cwd(), file)).size).toBeLessThanOrEqual(maxBytes);
    });
  }
});
