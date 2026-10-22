import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Each suite boots its own embedded PostgreSQL database.
    fileParallelism: false,
    coverage: { provider: "v8", reportsDirectory: "coverage" },
  },
});
