// @vitest-environment node
//
// Phase 276-02 — /docs on Vercel. Reads the REAL frontend/vercel.json and simulates Vercel's
// documented precedence over it: redirects → filesystem → rewrites (in array order). Memory note
// `reference_vercel_filesystem_precedes_rewrites`: a real file always beats a rewrite, which is
// why docs assets live under /docs-assets/ and never under /docs/.
//
// ⚠ Named docsVercelRouting, NOT vercelRouting: scripts/vitest-count-gate.cjs keys BASELINE by
// BASENAME, and src/__tests__/routing/vercelRouting.test.ts (Phase 228) is already pinned — under
// the shared name the gate summed both suites (8 → 16) and guarded neither on its own.
//
// The file is read as `?raw` (typed by vite/client) rather than through node:fs, so this suite
// adds nothing to the app typecheck's error set (tsconfig.app.json carries no node types).
import { describe, expect, it } from "vitest"
import vercelRaw from "../../../vercel.json?raw"
// Phase 297-04 (D-41): the evaluator moved to the shared routing-layer util, verbatim, so the parity
// suite (src/__tests__/routing/appRouteParity.test.ts) and this one run ONE evaluator, not two copies.
import { resolveVercel, sourceRegex, type VercelConfig, type VercelOutcome } from "../../__tests__/routing/routingLayers.testutil"

const config = JSON.parse(vercelRaw) as VercelConfig

const resolve = (host: string, pathname: string): VercelOutcome => resolveVercel(config, host, pathname)

const LANDING = "syrel.example"
const APP = "app.syrel.example"

describe("vercel.json — /docs on the landing host (276-02, G4-4)", () => {
  it("rewrites /docs and any /docs/* deep link to docs.html", () => {
    expect(resolve(LANDING, "/docs")).toEqual({ kind: "rewrite", to: "/docs.html" })
    expect(resolve(LANDING, "/docs/use/chat")).toEqual({ kind: "rewrite", to: "/docs.html" })
    expect(resolve(LANDING, "/docs/changelog/v4.5")).toEqual({ kind: "rewrite", to: "/docs.html" })
  })

  it("serves docs assets and docs.html itself from the filesystem", () => {
    expect(resolve(LANDING, "/docs-assets/search-index.json")).toEqual({ kind: "file", path: "/docs-assets/search-index.json" })
    expect(resolve(LANDING, "/docs.html")).toEqual({ kind: "file", path: "/docs.html" })
  })

  it("has no redirect rule that matches any /docs path", () => {
    for (const p of ["/docs", "/docs/", "/docs/use/chat"]) {
      const hit = (config.redirects ?? []).filter((r) => sourceRegex(r.source).test(p))
      expect(hit, p).toEqual([])
    }
  })

  it("does not enable cleanUrls (it would change filesystem matching)", () => {
    expect(config.cleanUrls).toBeUndefined()
  })
})

describe("vercel.json — the app host and /app are unchanged", () => {
  it("the app host catch-all wins first, even for /docs paths", () => {
    expect(resolve(APP, "/docs/use/chat")).toEqual({ kind: "rewrite", to: "/app.html" })
    expect(resolve(APP, "/app")).toEqual({ kind: "rewrite", to: "/app.html" })
  })

  it("the landing host still redirects /app to the app host", () => {
    expect(resolve(LANDING, "/app")).toEqual({ kind: "redirect", to: "https://app.:host/app" })
  })

  it("the landing root is still the landing page", () => {
    expect(resolve(LANDING, "/")).toEqual({ kind: "file", path: "/index.html" })
  })

  it("the docs rewrites sit AFTER the host-scoped app catch-all", () => {
    const rw = config.rewrites ?? []
    const appIdx = rw.findIndex((r) => r.source === "/(.*)" && r.has?.some((h) => h.type === "host"))
    const docsIdx = rw.findIndex((r) => r.source === "/docs")
    const docsDeepIdx = rw.findIndex((r) => r.source === "/docs/(.*)")
    expect(appIdx).toBeGreaterThanOrEqual(0)
    expect(docsIdx).toBeGreaterThan(appIdx)
    expect(docsDeepIdx).toBeGreaterThan(appIdx)
  })
})
