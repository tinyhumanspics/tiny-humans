import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler advice (react-hooks 7). Existing code predates it; fix while splitting Booking.tsx (Phase 8),
    // without changing behavior or motion. New code should follow these rules.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "scripts/local-db/**", "test-results/**", "playwright-report/**"]),
]);
