// @vitest-environment node
//
// Phase 276-02 — /docs on Vercel. Reads the REAL frontend/vercel.json and simulates Vercel's
// documented precedence over it: redirects → filesystem → rewrites (in array order). Memory note
// `reference_vercel_filesystem_precedes_rewrites`: a real file always beats a rewrite, which is
// why docs assets live under /docs-assets/ and never under /docs/.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

type HostHas = { type: string; value: string }
type Rule = { source: string; destination: string; has?: HostHas[]; permanent?: boolean }
type VercelConfig = { redirects?: Rule[]; rewrites?: Rule[]; cleanUrls?: boolean }

const configPath = path.resolve(__dirname, "../../../vercel.json")
const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as VercelConfig

// The static output a `vite build` produces (the three entries + emitted docs assets).
const FILESYSTEM = new Set([
  "/index.html",
  "/app.html",
  "/docs.html",
  "/docs-assets/search-index.json",
  "/docs-assets/openapi.public.json",
  "/vo/clip-chat.wav",
  "/assets/index-abc.js",
])

// Vercel sources here use only literal segments and `(.*)` groups.
function sourceRegex(source: string): RegExp {
  return new RegExp("^" + source + "$")
}

function hostMatches(rule: Rule, host: string): boolean {
  if (!rule.has) return true
  return rule.has.every((h) => h.type !== "host" || new RegExp("^(?:" + h.value + ")$").test(host))
}

type Outcome = { kind: "redirect"; to: string } | { kind: "file"; path: string } | { kind: "rewrite"; to: string } | { kind: "404" }

function resolve(host: string, pathname: string): Outcome {
  for (const r of config.redirects ?? []) {
    if (sourceRegex(r.source).test(pathname) && hostMatches(r, host)) return { kind: "redirect", to: r.destination }
  }
  const filePath = pathname === "/" ? "/index.html" : pathname
  if (FILESYSTEM.has(filePath)) return { kind: "file", path: filePath }
  for (const r of config.rewrites ?? []) {
    if (sourceRegex(r.source).test(pathname) && hostMatches(r, host)) return { kind: "rewrite", to: r.destination }
  }
  return { kind: "404" }
}

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
