/**
 * Static export for the click-through prototype (NOT used by Vercel).
 *
 * API route handlers can't be statically exported, so app/api is moved
 * outside app/ for the duration of the build and always restored afterwards,
 * even if the build fails or is interrupted. The prototype uses the
 * in-browser mock booking provider and browser-only owner area instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const API = "app/api";
const PARKED = ".static-build-api";

if (existsSync(PARKED)) {
  // a previous run was interrupted: put the routes back first
  if (!existsSync(API)) renameSync(PARKED, API);
  else throw new Error(`Both ${API} and ${PARKED} exist; resolve manually.`);
}

let moved = false;
const restore = () => {
  if (moved && existsSync(PARKED) && !existsSync(API)) renameSync(PARKED, API);
  moved = false;
};
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { restore(); process.exit(1); });

let status = 1;
try {
  if (existsSync(API)) {
    renameSync(API, PARKED);
    moved = true;
  }
  const res = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_PROTOTYPE: "1" },
  });
  status = res.status ?? 1;
} finally {
  restore();
}
process.exit(status);
