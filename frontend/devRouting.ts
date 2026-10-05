// frontend/devRouting.ts — the dev/preview server's entry routing, as a PURE function so it can
// be unit-tested (src/docs/__tests__/devRouting.test.ts). vite.config.ts's appRoutingPlugin is
// the only caller.
//
// Three entries share one Vite server: index.html (landing), app.html (the product) and
// docs.html (public docs, Phase 276). Vercel and the onebox nginx route the same way — see
// vercel.json and nginx.conf; the three must agree.
//
// ⚠ ORDER IS THE CONTRACT (Pitfall 2): the /docs rule must run BEFORE the catch-all app.html
// rule, which matches every non-root, dot-less path and would otherwise swallow /docs/use/chat.

const INTERNAL_PREFIX = /^\/(@|__|src|node_modules)/

export function rewriteDevUrl(rawUrl: string): string {
  const url = rawUrl || "/"
  const [pathname, ...rest] = url.split("?")
  const search = rest.length ? "?" + rest.join("?") : ""

  // The landing root and Vite's own routes pass through untouched.
  if (pathname === "/" || INTERNAL_PREFIX.test(pathname)) return url

  // ⚠ BEFORE the dotted-path check: docs routes legitimately contain dots
  // (/docs/changelog/v4.5), and no real file ever lives under /docs/ — docs assets are served
  // from /docs-assets/ precisely so this rule can claim the whole /docs/ prefix.
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return "/docs.html" + search

  // Any other dotted path is a file (assets, docs-assets/*.json, vo/*.wav, music/*.mp3).
  if (pathname.includes(".")) return url

  return "/app.html" + search
}
