import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import Icons from "unplugin-icons/vite"
import path from "path"

export default defineConfig({
  plugins: [react(), Icons({ compiler: "jsx", jsx: "react" })],
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
      // Phase 276 — mirrors vite.config.ts: Remotion compositions are imported from ../video/src.
      "@video": path.resolve(__dirname, "../video/src"),
    },
    // Phase 276-05 — mirrors vite.config.ts VIDEO_DEDUPE: files under ../video/src import these as
    // bare specifiers and video/node_modules is absent in worktrees and CI, so they must resolve to
    // frontend/node_modules (one React, one remotion) for a suite that imports a real composition.
    dedupe: [
      "react",
      "react-dom",
      "remotion",
      "@remotion/player",
      "@remotion/transitions",
      "@remotion/media",
      "@remotion/google-fonts",
      "mediabunny",
    ],
  },
})
