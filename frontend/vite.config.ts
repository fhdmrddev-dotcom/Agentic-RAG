import path from "path"
import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import Icons from "unplugin-icons/vite"
import { rewriteDevUrl } from "./devRouting"
import { docsContent } from "./plugins/docsContent"

// Entry routing for the dev + preview servers. The decision lives in devRouting.ts (a pure,
// unit-tested function); this plugin only applies it. Phase 276 added the /docs → docs.html rule.
function appRoutingPlugin(): Plugin {
  const rewrite = (req: any, _res: any, next: () => void) => {
    req.url = rewriteDevUrl(req.url || "/")
    next()
  }

  return {
    name: "app-routing-middleware",
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// Phase 276 — the docs entry (and the landing hero) embed Remotion compositions straight from
// ../video/src. Those files import remotion / @remotion/* / mediabunny / react as BARE specifiers,
// and video/node_modules is absent in worktrees, CI, Vercel and the onebox image — so every one
// of them must resolve to frontend/node_modules, exactly once (two React or two remotion copies
// crash the Player). `dedupe` forces that; tsconfig.app.json `paths` mirrors it for typecheck.
const VIDEO_DEDUPE = [
  "react",
  "react-dom",
  "remotion",
  "@remotion/player",
  "@remotion/transitions",
  "@remotion/media",
  "@remotion/google-fonts",
  "mediabunny",
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    Icons({ compiler: "jsx", jsx: "react" }),
    appRoutingPlugin(),
    // Phase 276 — docs manifest, page chunks, search index and media copy (all parsing lives in
    // scripts/lib/docs-content.cjs).
    docsContent({ frontendDir: __dirname }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@video": path.resolve(__dirname, "../video/src"),
    },
    dedupe: VIDEO_DEDUPE,
  },
  server: {
    fs: {
      // The dev server may read outside frontend/ ONLY from these named directories (T-276-07).
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        path.resolve(__dirname, "../video/src"),
        path.resolve(__dirname, "../video/public"),
        path.resolve(__dirname, "../docs"),
        path.resolve(__dirname, "../scripts/lib"),
      ],
    },
  },
  build: {
    // Phase 276-05 (G4-2) — dist/.vite/manifest.json lets scripts/check-landing-first-paint.cjs
    // prove the landing's first-paint chunks carry no Remotion/Scalar/docs code.
    manifest: true,
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app.html"),
        docs: path.resolve(__dirname, "docs.html"),
      },
    },
  },
})
