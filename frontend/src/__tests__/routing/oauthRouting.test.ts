// @vitest-environment node
//
// Phase 307-04 (OAUTH-05 / D-30, D-11, D-35) — OAUTH DISCOVERY + THE CONSENT ROUTE ON EVERY LAYER.
//
// Two of the roadmap's named failure modes are config, not code:
//   1. "`.well-known` returns the SPA" — on the one-box the issuer is https://<host>/api, so RFC 8414 /
//      RFC 9728 path insertion puts BOTH discovery documents at the ORIGIN ROOT
//      (/.well-known/oauth-authorization-server/api, /.well-known/oauth-protected-resource/api/mcp),
//      where nginx's `location /` would answer index.html with a 200. A client reading HTML as
//      metadata fails with no useful error.
//   2. The consent page (/app/connect/<request id>) framed by a third-party site (clickjacking,
//      T-307-05), or its request id leaking through a Referer (T-307-07).
//
// ⛔ Every positive row here has a NEGATIVE CONTROL: the same evaluator over the config with the new
// rule removed must come back as the SPA / without the headers, so no row can pass vacuously.
//
// Vercel carries NO .well-known rule by design: Claude derives every discovery URL from the backend
// origin (api.<domain>), never from the app host (measured in 307-RESEARCH §Routing per topology).
// The local topology talks to uvicorn directly, so dev only needs the consent headers.
import { describe, expect, it } from "vitest"
import { devHeadersFor, rewriteDevUrl } from "../../../devRouting"
import nginxRaw from "../../../nginx.conf?raw"
import vercelRaw from "../../../vercel.json?raw"
import {
  resolveNginx,
  resolveNginxLocation,
  resolveVercel,
  vercelHeadersFor,
  type VercelConfig,
} from "./routingLayers.testutil"

const config = JSON.parse(vercelRaw) as VercelConfig

const LANDING = "syrel.example"
const APP = "app.syrel.example"
const REQUEST_ID = "0b7f3a1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b"
const CONSENT = `/app/connect/${REQUEST_ID}`

// The anti-framing + no-referrer set every layer must attach to the consent route (D-35).
const CONSENT_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
}

// The discovery paths a spec-following client derives on the one-box (issuer https://<host>/api).
const ONEBOX_DISCOVERY = [
  "/.well-known/oauth-authorization-server/api",
  "/.well-known/oauth-protected-resource/api/mcp",
  "/.well-known/oauth-protected-resource",
]

// The removed-rule configs the negative controls evaluate.
const NGINX_WITHOUT_WELL_KNOWN = nginxRaw.replace(/location \^~ \/\.well-known\/oauth- \{[^}]*\}/, "")
const NGINX_WITHOUT_OPENID = nginxRaw.replace(/location \^~ \/\.well-known\/openid-configuration \{[^}]*\}/, "")
const NGINX_WITHOUT_CONNECT = nginxRaw.replace(/location \^~ \/app\/connect\/ \{[^}]*\}/, "")

function expectProxiedUnchanged(confText: string, path: string): void {
  const outcome = resolveNginxLocation(confText, path)
  expect(outcome.kind, `nginx ${path}`).toBe("proxy")
  if (outcome.kind !== "proxy") return
  // Variable upstream, NO URI part and NO rewrite: the path reaches the backend exactly as asked
  // (T-307-22 — the backend registers these literals, 307-02).
  expect(outcome.target, `nginx ${path} upstream`).toBe("$backend_upstream")
  expect(outcome.rewrites, `nginx ${path} rewrites`).toEqual([])
}

function expectConsentHeaders(headers: Record<string, string>, where: string): void {
  for (const [key, value] of Object.entries(CONSENT_HEADERS)) expect(headers[key], `${where} ${key}`).toBe(value)
}

describe("one-box nginx: OAuth discovery reaches the backend, never the SPA (D-30, F-9)", () => {
  it.each(ONEBOX_DISCOVERY)("nginx proxies %s to the backend with the path unchanged", (path) => {
    expectProxiedUnchanged(nginxRaw, path)
    expect(resolveNginx(nginxRaw, path)).not.toBe("/index.html")
    expect(resolveNginx(nginxRaw, path)).not.toBe("/app.html")
  })

  it("/.well-known/openid-configuration is a clean 404, never the SPA (F-9)", () => {
    const outcome = resolveNginxLocation(nginxRaw, "/.well-known/openid-configuration")
    expect(outcome).toMatchObject({ kind: "return", target: "404" })
    expect(resolveNginx(nginxRaw, "/.well-known/openid-configuration")).toBe("=404")
  })

  it("the MCP endpoint itself still goes through the existing /api/ block (prefix stripped)", () => {
    const outcome = resolveNginxLocation(nginxRaw, "/api/mcp")
    expect(outcome.kind).toBe("proxy")
    if (outcome.kind !== "proxy") return
    expect(outcome.location).toBe("/api/")
    expect(outcome.rewrites).toEqual(["^/api/(.*)$ /$1 break"])
  })

  it("negative control: without the .well-known/oauth- location the discovery rows flip back to the SPA", () => {
    expect(NGINX_WITHOUT_WELL_KNOWN).not.toBe(nginxRaw)
    for (const path of ONEBOX_DISCOVERY) {
      expect(resolveNginx(NGINX_WITHOUT_WELL_KNOWN, path), `without the location: ${path}`).toBe("/index.html")
      expect(() => expectProxiedUnchanged(NGINX_WITHOUT_WELL_KNOWN, path)).toThrow()
    }
  })

  it("negative control: without the openid-configuration location it is swallowed by the SPA", () => {
    expect(NGINX_WITHOUT_OPENID).not.toBe(nginxRaw)
    expect(resolveNginx(NGINX_WITHOUT_OPENID, "/.well-known/openid-configuration")).toBe("/index.html")
  })
})

describe("the consent route serves app.html with anti-framing headers on every layer (D-11, D-35)", () => {
  it("Vite dev: rewritten to app.html and devHeadersFor returns the three headers", () => {
    expect(rewriteDevUrl(CONSENT)).toBe("/app.html")
    expect(devHeadersFor(CONSENT)).toEqual(CONSENT_HEADERS)
    expect(devHeadersFor(`${CONSENT}?x=1`)).toEqual(CONSENT_HEADERS)
  })

  it("Vite dev: no headers anywhere else in the app", () => {
    expect(devHeadersFor("/app/chat")).toEqual({})
    expect(devHeadersFor("/app/connect")).toEqual({})
    expect(devHeadersFor("/")).toEqual({})
  })

  it("Vercel app host: rewritten to app.html and carries the three headers", () => {
    expect(resolveVercel(config, APP, CONSENT)).toEqual({ kind: "rewrite", to: "/app.html" })
    expectConsentHeaders(vercelHeadersFor(config, APP, CONSENT), `Vercel ${APP}`)
  })

  it("Vercel apex: redirected to the app host, and the headers apply there too", () => {
    const outcome = resolveVercel(config, LANDING, CONSENT)
    expect(outcome.kind).toBe("redirect")
    expectConsentHeaders(vercelHeadersFor(config, LANDING, CONSENT), `Vercel ${LANDING}`)
  })

  it("Vercel: no headers on other app routes, and vercel.json carries no .well-known rule", () => {
    expect(vercelHeadersFor(config, APP, "/app/chat")).toEqual({})
    expect(vercelRaw.includes("well-known")).toBe(false)
  })

  it("one-box nginx: served IN its own location with the three headers (F-10)", () => {
    const outcome = resolveNginxLocation(nginxRaw, CONSENT)
    expect(outcome).toMatchObject({ kind: "try_files", target: "/app.html", location: "/app/connect/" })
    expectConsentHeaders(outcome.headers, "nginx")
  })

  it("one-box nginx: /app/chat still goes through location /app/ with no new headers", () => {
    const outcome = resolveNginxLocation(nginxRaw, "/app/chat")
    expect(outcome.kind).toBe("try_files")
    expect(outcome.target).toBe("/app.html")
    expect(outcome.headers).toEqual({})
  })

  it("negative control: without the /app/connect/ location nginx still serves app.html but LOSES the headers", () => {
    expect(NGINX_WITHOUT_CONNECT).not.toBe(nginxRaw)
    const outcome = resolveNginxLocation(NGINX_WITHOUT_CONNECT, CONSENT)
    expect(outcome.target).toBe("/app.html")
    expect(outcome.headers).toEqual({})
    expect(() => expectConsentHeaders(outcome.headers, "nginx")).toThrow()
  })

  it("negative control (F-10): an internal-redirect fallback drops the location's headers", () => {
    const viaRedirect = nginxRaw.replace("try_files /app.html =404;", "try_files $uri /app.html;")
    expect(viaRedirect).not.toBe(nginxRaw)
    const outcome = resolveNginxLocation(viaRedirect, CONSENT)
    expect(outcome.target).toBe("/app.html")
    expect(outcome.headers).toEqual({})
  })

  it("negative control: Vercel without the headers entry carries none", () => {
    const noHeaders: VercelConfig = { ...config, headers: [] }
    expect(vercelHeadersFor(noHeaders, APP, CONSENT)).toEqual({})
    expect(() => expectConsentHeaders(vercelHeadersFor(noHeaders, APP, CONSENT), "Vercel")).toThrow()
  })
})
