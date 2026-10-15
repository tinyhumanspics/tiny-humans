import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler advice (react-hooks 7), warnings for now. Phase 8 slice 6 fixed all but four effects that load
    // data (LeadsPanel, RescheduleFlow, DepositReturn, useBookingFlow): slice 7 decides how data is fetched.
    // New code should follow these rules.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      // `const { secret: _s, ...rest } = obj` leaves out keys on purpose
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "scripts/local-db/**", "test-results/**", "playwright-report/**"]),
]);
