import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler advice (react-hooks 7), warnings. Phase 8 fixed every finding; the four effects that load data
    // keep a line-level exception (decision: no data library, stale answers ignored). New code follows these rules.
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
