import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
    // Phase 075.4 Plan 05 Task 2 — keep Playwright E2E scenarios out of
    // vitest's glob. Default vitest pattern would match scenario-NN-*.spec.ts
    // and try to execute Playwright tests under jsdom (would crash).
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
