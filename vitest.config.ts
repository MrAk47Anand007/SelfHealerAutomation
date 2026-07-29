import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@uiheal/adapters-a360": resolve(__dirname, "packages/adapters-a360/src/index.ts"),
      "@uiheal/adapters-json": resolve(__dirname, "packages/adapters-json/src/index.ts"),
      "@uiheal/adapters-playwright": resolve(__dirname, "packages/adapters-playwright/src/index.ts"),
      "@uiheal/adapters-puppeteer": resolve(__dirname, "packages/adapters-puppeteer/src/index.ts"),
      "@uiheal/adapters-selenium": resolve(__dirname, "packages/adapters-selenium/src/index.ts"),
      "@uiheal/ai": resolve(__dirname, "packages/ai/src/index.ts"),
      "@uiheal/artifacts": resolve(__dirname, "packages/artifacts/src/index.ts"),
      "@uiheal/cdp": resolve(__dirname, "packages/cdp/src/index.ts"),
      "@uiheal/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@uiheal/state-planner": resolve(__dirname, "packages/state-planner/src/index.ts")
    }
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true
  }
});
