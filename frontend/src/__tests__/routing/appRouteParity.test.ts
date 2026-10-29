// @vitest-environment node
//
// Phase 297-04 (LINK-08 / D-26, D-41) — THREE-LAYER ROUTING PARITY OVER THE ROUTE TABLE.
//
// Every address the app writes must be served `app.html` by every layer that can receive it:
// the Vite dev/preview rewrite (frontend/devRouting.ts), Vercel (frontend/vercel.json on the
// `app.` host, and on the apex through its redirect) and the one-box nginx (frontend/nginx.conf).
// A route that works under Vite but 404s on Vercel or opens the landing on the one-box is exactly
// the failure LINK-08 names; this suite makes it a red test instead of a production surprise.
//
// ⛔ THE INPUTS COME FROM THE ROUTE TABLE, NEVER FROM A HAND LIST. Every canonical address is
// `formatAppRoute` over every key of `VIEW_PATHS` (a `Record<ActiveView, string>`, so a new view
// is a new row here with no edit). The legacy shapes and pre-auth pages are the only literals,
// because they are by definition the addresses the table does NOT write.
//
// ⚠ The three config files are read as `?raw` (typed by vite/client), never through node:fs, so
// this suite adds nothing to the app typecheck's error set (Pitfall 11). The evaluators live in
// ./routingLayers.testutil — the Vercel one is the evaluator docsVercelRouting.test.ts already
// used, moved there (D-41: one evaluator, not a copy).
//
// ⚠ Every evaluator has a PERMANENT negative control below: a synthetic config with the app rule
// removed must NOT come back as app.html, so an evaluator that always says yes reds here.
import { describe, expect, it } from "vitest"
import type { ActiveView } from "@/App"
import { formatAppRoute, VIEW_PATHS, type AppRoute } from "@/lib/appRoutes"
import { rewriteDevUrl } from "../../../devRouting"
import middlewareRaw from "../../../middleware.ts?raw"
import nginxRaw from "../../../nginx.conf?raw"
import vercelRaw from "../../../vercel.json?raw"
import {
  followVercelRedirect,
  middlewareRewritesAppHost,
  resolveNginx,
  resolveVercel,
  type VercelConfig,
} from "./routingLayers.testutil"

const config = JSON.parse(vercelRaw) as VercelConfig

const LANDING = "syrel.example"
const APP = "app.syrel.example"

// Fixture ids — strict UUIDs, so the table writes them as real run / skill addresses.
const RUN_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e"
const SKILL_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"

function sampleRoute(view: ActiveView): AppRoute {
  if (view === "workflow-run") return { view, runId: RUN_ID }
  if (view === "skill-studio") return { view, skillId: SKILL_ID }
  return { view } as AppRoute
}

const VIEWS = Object.keys(VIEW_PATHS) as ActiveView[]
const CANONICAL: string[] = VIEWS.map((view) => formatAppRoute(sampleRoute(view)))

// The addresses the table does not write but every layer must still hand to the app.
const LEGACY = [`/app?run=${RUN_ID}`, "/app?connections=1&oauth_error=x", "/admin/spend"]
const PRE_AUTH = ["/setup", "/invite?token=x"]

// Phase 299-02 (LINK-02 / D-01): the entity addresses. They are NOT `ActiveView` members (a thread,
// a workflow and an Expert open inside the chat / workflows / experts views), so they come from the
// SAME formatter over the route table's id-bearing variants, in their own list — CANONICAL above
// stays one address per member.
const THREAD_ID = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e6f"
const DEFINITION_ID = "7e1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e7f"
const BUNDLE_ID = "9f2e4c1a-5d3b-4e8f-a09c-3b4c5d6e7f80"
const ENTITY: string[] = [
  formatAppRoute({ view: "chat", threadId: THREAD_ID }),
  formatAppRoute({ view: "workflows", definitionId: DEFINITION_ID }),
  formatAppRoute({ view: "experts", bundleId: BUNDLE_ID }),
]

const ALL = [...CANONICAL, ...ENTITY, ...LEGACY, ...PRE_AUTH]

function split(url: string): { pathname: string; search: string } {
  const i = url.indexOf("?")
  return i === -1 ? { pathname: url, search: "" } : { pathname: url.slice(0, i), search: url.slice(i) }
}

// ── Layer assertions. Each takes the layer as an argument, so the SAME helper backs the positive
// rows and the negative controls — a helper that cannot fail would red its own control.

function expectDevServesApp(rewrite: (rawUrl: string) => string, url: string): void {
  const { search } = split(url)
  expect(rewrite(url), `dev rewrite of ${url}`).toBe("/app.html" + search)
}

function expectAppHostServesApp(cfg: VercelConfig, url: string): void {
  const { pathname } = split(url)
  expect(resolveVercel(cfg, APP, pathname), `Vercel ${APP}${pathname}`).toEqual({ kind: "rewrite", to: "/app.html" })
}

function expectApexRedirectsToApp(cfg: VercelConfig, url: string): void {
  const { pathname } = split(url)
  const outcome = resolveVercel(cfg, LANDING, pathname)
  expect(outcome.kind, `Vercel ${LANDING}${pathname}`).toBe("redirect")
  if (outcome.kind !== "redirect") return
  expect(outcome.to.startsWith("https://app.:host/"), outcome.to).toBe(true)
  // T-297-18: the redirect keeps the path and lands on the app host of THIS host, never another.
  const target = followVercelRedirect(cfg, LANDING, pathname)
  expect(target, `substituted redirect for ${pathname}`).toEqual({ host: APP, pathname })
  if (!target) return
  expect(resolveVercel(cfg, target.host, target.pathname), `followed ${target.host}${target.pathname}`).toEqual({
    kind: "rewrite",
    to: "/app.html",
  })
}

function expectNginxServesApp(confText: string, url: string): void {
  const { pathname } = split(url)
  expect(resolveNginx(confText, pathname), `nginx ${pathname}`).toBe("/app.html")
}

describe("the parity inputs are the route table's (LINK-08)", () => {
  it("covers every ActiveView member, one distinct address each", () => {
    expect(VIEWS.length).toBe(12)
    expect(new Set(CANONICAL).size).toBe(VIEWS.length)
    expect(CANONICAL).toContain(`/app/runs/${RUN_ID}`)
    expect(CANONICAL).toContain(`/app/skills/${SKILL_ID}`)
  })

  it("299-02: the three entity addresses are distinct, under /app, and none is a view's own address", () => {
    expect(ENTITY).toEqual([`/app/chat/${THREAD_ID}`, `/app/workflows/${DEFINITION_ID}`, `/app/experts/${BUNDLE_ID}`])
    expect(new Set(ENTITY).size).toBe(3)
    for (const path of ENTITY) expect(CANONICAL).not.toContain(path)
  })

  it("every canonical address starts /app and no segment contains a dot", () => {
    for (const path of CANONICAL) {
      expect(path === "/app" || path.startsWith("/app/"), path).toBe(true)
      for (const segment of path.split("/")) expect(segment.includes("."), `${path} segment ${segment}`).toBe(false)
    }
  })
})

describe("Vite dev (devRouting.ts) serves app.html for every address", () => {
  it.each(ALL)("dev serves app.html for %s, keeping the query", (url) => {
    expectDevServesApp(rewriteDevUrl, url)
  })
})

describe("Vercel app host (vercel.json) serves app.html for every address", () => {
  it.each(ALL)("app host serves app.html for %s", (url) => {
    expectAppHostServesApp(config, url)
  })
})

describe("Vercel apex (vercel.json) redirects every address to the app host", () => {
  it.each(ALL)("apex redirects %s to the app host, path kept, and it lands on app.html", (url) => {
    expectApexRedirectsToApp(config, url)
  })
})

describe("one-box nginx (nginx.conf) serves app.html for every address", () => {
  it.each(ALL)("nginx serves app.html for %s", (url) => {
    expectNginxServesApp(nginxRaw, url)
  })
})

describe("the app host root (middleware.ts)", () => {
  it("the matcher is exactly '/' and it rewrites to /app.html on an app. host", () => {
    expect(middlewareRewritesAppHost(middlewareRaw)).toEqual({ matcher: "/", rewritesAppHost: true })
  })

  it("vercel.json alone answers the app host root from the filesystem — the reason middleware exists", () => {
    expect(resolveVercel(config, APP, "/")).toEqual({ kind: "file", path: "/index.html" })
    expect(rewriteDevUrl("/")).toBe("/")
  })
})

describe("known facts, pinned so a change is noticed (D-13)", () => {
  it("bare /workflows: dev app.html, app host app.html, apex 404, one-box landing", () => {
    expect(rewriteDevUrl("/workflows")).toBe("/app.html")
    expect(resolveVercel(config, APP, "/workflows")).toEqual({ kind: "rewrite", to: "/app.html" })
    expect(resolveVercel(config, LANDING, "/workflows")).toEqual({ kind: "404" })
    expect(resolveNginx(nginxRaw, "/workflows")).toBe("/index.html")
  })
})

describe("permanent negative controls — no evaluator is vacuous", () => {
  it("nginx without the `location /app/` block does not serve app.html for /app/library", () => {
    const withoutApp = nginxRaw.replace(/location \/app\/ \{[^}]*\}/, "")
    expect(withoutApp).not.toBe(nginxRaw)
    expect(resolveNginx(withoutApp, "/app/library")).toBe("/index.html")
    expect(() => expectNginxServesApp(withoutApp, "/app/library")).toThrow()
  })

  it("the nginx evaluator refuses a regex location instead of ignoring it", () => {
    const withRegex = nginxRaw.replace("location / {", "location ~ ^/app/(.*)$ {\n        try_files $uri /index.html;\n    }\n    location / {")
    expect(withRegex).not.toBe(nginxRaw)
    expect(() => resolveNginx(withRegex, "/app/library")).toThrow(/regex location/)
  })

  it("Vercel without the app-host catch-all (and the /app rewrites) does not serve app.html", () => {
    const rewrites = config.rewrites ?? []
    const noCatchAll: VercelConfig = { ...config, rewrites: rewrites.filter((r) => !(r.source === "/(.*)" && r.has)) }
    expect(noCatchAll.rewrites?.length).toBe(rewrites.length - 1)
    expect(resolveVercel(noCatchAll, APP, "/setup")).toEqual({ kind: "404" })
    expect(() => expectAppHostServesApp(noCatchAll, "/setup")).toThrow()
    expect(() => expectApexRedirectsToApp(noCatchAll, "/setup")).toThrow()

    const noApp: VercelConfig = { ...noCatchAll, rewrites: (noCatchAll.rewrites ?? []).filter((r) => !r.source.startsWith("/app")) }
    expect(resolveVercel(noApp, APP, "/app/library")).toEqual({ kind: "404" })
    expect(() => expectAppHostServesApp(noApp, "/app/library")).toThrow()
  })

  it("a dev rewrite that serves the landing fails the dev assertion", () => {
    expect(() => expectDevServesApp(() => "/index.html", "/app/library")).toThrow()
  })

  it("the middleware check notices a widened matcher or a different host", () => {
    expect(middlewareRewritesAppHost(middlewareRaw.replace('matcher: "/"', 'matcher: "/(.*)"')).matcher).toBe("/(.*)")
    expect(middlewareRewritesAppHost(middlewareRaw.replace('startsWith("app.")', 'startsWith("www.")')).rewritesAppHost).toBe(false)
  })
})
