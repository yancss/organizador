import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Extra ignores to keep dev iterations fast (no linting generated/tmp scripts)
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Local scratch / scripts
    "tmp_*.*",
    "scripts/tmp_*.js",
    "scripts/tmp_*.ts",
    "scripts/tmp_*.mjs",

    // Node bootstrap/check scripts (CommonJS)
    "scripts/*.js",
  ]),

  // Reduce noisy/over-strict rules that don't correlate with real runtime bugs in this app.
  {
    rules: {
      // The React Compiler rule-set can be overly strict for normal Next apps.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",

      // Keep type safety, but don't block dev for small casts.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
