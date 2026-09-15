import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    environment: "node",
    env: {
      DATABASE_URL:
        "postgresql://degreepath:degreepath@127.0.0.1:54329/degreepath?schema=public",
    },
    testTimeout: 15000,
  },
});
