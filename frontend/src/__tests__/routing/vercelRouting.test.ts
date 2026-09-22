/**
 * Phase 228 (DEBT-04 / SEED-242) — Vercel Subdomain Routing Configuration Tests.
 *
 * Verifies:
 * 1. vercel.json is valid and retains buildCommand: "vite build".
 * 2. Host-scoped rewrites route all requests on app.<domain> (host: app.*) to /app.html.
 * 3. Root-domain redirects issue permanent (308) redirects for /app, /setup, /invite to https://app.:host/...
 * 4. Negative lookahead (^(?!app\\.)) prevents infinite redirect loops on the app subdomain.
 * 5. Rewrites preserve /app and /app/(.*) fallbacks to /app.html for single-domain environments.
 * 6. Root domain / is NOT rewritten in vercel.json, preserving default filesystem serving of index.html.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

interface VercelRouteHas {
  type: string
  value: string
}

interface VercelRedirect {
  source: string
  has?: VercelRouteHas[]
  destination: string
  permanent?: boolean
}

interface VercelRewrite {
  source: string
  has?: VercelRouteHas[]
  destination: string
}

interface VercelConfig {
  $schema?: string
  buildCommand?: string
  redirects?: VercelRedirect[]
  rewrites?: VercelRewrite[]
}

describe("vercel.json routing configuration (DEBT-04 / SEED-242)", () => {
  const vercelJsonPath = resolve(__dirname, "../../../vercel.json")
  const rawContent = readFileSync(vercelJsonPath, "utf-8")
  const config: VercelConfig = JSON.parse(rawContent)

  it("is valid JSON with buildCommand: 'vite build'", () => {
    expect(config.buildCommand).toBe("vite build")
    expect(Array.isArray(config.rewrites)).toBe(true)
    expect(Array.isArray(config.redirects)).toBe(true)
  })

  it("rewrites all traffic on app.<domain> to /app.html", () => {
    const appSubdomainRewrite = config.rewrites?.find(
      (r) =>
        r.source === "/(.*)" &&
        r.destination === "/app.html" &&
        r.has?.some((h) => h.type === "host" && h.value.includes("app\\.")),
    )
    expect(appSubdomainRewrite).toBeDefined()
    expect(appSubdomainRewrite?.destination).toBe("/app.html")
  })

  it("redirects root domain /app, /setup, and /invite permanently (308) to https://app.:host/...", () => {
    const redirects = config.redirects || []

    const appRedirect = redirects.find((r) => r.source === "/app")
    expect(appRedirect).toBeDefined()
    expect(appRedirect?.destination).toBe("https://app.:host/app")
    expect(appRedirect?.permanent).toBe(true)

    const appWildcardRedirect = redirects.find((r) => r.source === "/app/(.*)")
    expect(appWildcardRedirect).toBeDefined()
    expect(appWildcardRedirect?.destination).toBe("https://app.:host/app/$1")
    expect(appWildcardRedirect?.permanent).toBe(true)

    const setupRedirect = redirects.find((r) => r.source === "/setup")
    expect(setupRedirect).toBeDefined()
    expect(setupRedirect?.destination).toBe("https://app.:host/setup")
    expect(setupRedirect?.permanent).toBe(true)

    const inviteRedirect = redirects.find((r) => r.source === "/invite")
    expect(inviteRedirect).toBeDefined()
    expect(inviteRedirect?.destination).toBe("https://app.:host/invite")
    expect(inviteRedirect?.permanent).toBe(true)
  })

  it("prevents redirect loops by excluding hostnames starting with app.", () => {
    const redirects = config.redirects || []
    for (const r of redirects) {
      const hostHas = r.has?.find((h) => h.type === "host")
      expect(hostHas).toBeDefined()
      // Verify negative lookahead for app. is present in the host match regex
      expect(hostHas?.value).toContain("(?!app\\.)")
    }
  })

  it("preserves /app and /app/(.*) rewrites to /app.html for single-domain fallbacks", () => {
    const rewrites = config.rewrites || []
    const appFallback = rewrites.find((r) => r.source === "/app" && !r.has)
    expect(appFallback).toBeDefined()
    expect(appFallback?.destination).toBe("/app.html")

    const appWildcardFallback = rewrites.find((r) => r.source === "/app/(.*)" && !r.has)
    expect(appWildcardFallback).toBeDefined()
    expect(appWildcardFallback?.destination).toBe("/app.html")
  })

  it("does not rewrite root path / unconditionally, allowing filesystem to serve index.html (landing)", () => {
    const rewrites = config.rewrites || []
    const unconditionalRootRewrite = rewrites.find(
      (r) => (r.source === "/" || r.source === "/(.*)") && !r.has,
    )
    expect(unconditionalRootRewrite).toBeUndefined()
  })

  // ── Phase 257.1 — /admin/* needed the same apex redirect the other deep paths have. ──
  // Phase 257 added an `/admin/spend` surface read by a literal `window.location.pathname`
  // check in App.tsx. On `app.<domain>` the host-scoped `/(.*)` rewrite already catches it,
  // but on the APEX there was no redirect entry and no file on disk — so a deep link or a
  // bookmark to `<domain>/admin/spend` 404s, while `<domain>/setup` and `<domain>/invite`
  // both work. Every path-bearing surface needs BOTH halves; this pins the missing one.
  it.each(["/admin", "/admin/(.*)"])(
    "redirects %s on the apex to the app subdomain, like /app, /setup and /invite",
    (source) => {
      const redirects = config.redirects || []
      const entry = redirects.find((r) => r.source === source)
      expect(entry).toBeDefined()
      expect(entry?.permanent).toBe(true)
      expect(entry?.destination).toMatch(/^https:\/\/app\.:host\/admin/)
      // the negative lookahead is what stops an infinite loop once already on app.*
      const hostRule = entry?.has?.find((h) => h.type === "host")
      expect(hostRule?.value).toContain("?!app\\.")
    },
  )
})
