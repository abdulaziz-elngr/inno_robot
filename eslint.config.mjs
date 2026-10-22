import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Next.js 16 ships `eslint-config-next` as native flat config, so the legacy
 * FlatCompat bridge is not needed (and actively breaks ESLint 9).
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", ".data/**", "drizzle/**", "coverage/**", "out/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "warn",
      // `_`-prefixed names are intentionally unused (destructured secrets, ignored args).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
