/**
 * Phase 297-02 (LINK-01 / D-11, D-12, D-13, D-16, D-17) — THE ROUTE TABLE CONTRACT.
 *
 * `appRoutes.ts` is the one home of the app's path vocabulary. Every address the browser can
 * hold passes through `parseAppLocation`, and every address the app writes comes out of
 * `formatAppRoute` or `canonicalAddress`. Both directions are pinned here.
 *
 * ⛔ THE ADDRESS BAR IS ATTACKER-CONTROLLED (T-297-05 / T-297-06). A shared link, an email or a
 * typed URL reaches the parser verbatim, and `canonicalAddress`'s result becomes a navigation
 * target. So the hostile inputs below must (a) never throw, (b) parse to not-found, and (c) never
 * yield a value that starts "//" or contains "://" — the open-redirect shape.
 */

import { describe, it, expect } from "vitest"

import type { ActiveView } from "@/App"
import { canonicalAddress, formatAppRoute, parseAppLocation, VIEW_PATHS, type AppRoute } from "@/lib/appRoutes"

const RUN = "229f45ae-c85e-4707-a46c-bf4787541547"
const SKILL = "0b9c3a51-7d2e-4f6a-9a8b-1c2d3e4f5a6b"

/** One sample route per member — the ids are fixtures, the views are the union. */
function sampleRoute(view: ActiveView): AppRoute {
  if (view === "workflow-run") return { view, runId: RUN }
  if (view === "skill-studio") return { view, skillId: SKILL }
  return { view } as AppRoute
}

const MEMBERS = Object.keys(VIEW_PATHS) as ActiveView[]

describe("appRoutes · formatAppRoute ↔ parseAppLocation round-trip (D-11)", () => {
  it("VIEW_PATHS names all twelve members", () => {
    expect(MEMBERS.length).toBe(12)
  })

  it.each(MEMBERS)("%s round-trips through format then parse", (view) => {
    const route = sampleRoute(view)
    const path = formatAppRoute(route)
    expect(parseAppLocation(path, "")).toEqual(route)
  })

  it.each(MEMBERS)("%s formats to an /app path with no dotted segment", (view) => {
    const path = formatAppRoute(sampleRoute(view))
    expect(path.startsWith("/app")).toBe(true)
    for (const segment of path.split("/")) expect(segment).not.toContain(".")
  })

  it("the D-11 table, spelled out", () => {
    expect(formatAppRoute({ view: "chat" })).toBe("/app")
    expect(formatAppRoute({ view: "documents" })).toBe("/app/library")
    expect(formatAppRoute({ view: "skills" })).toBe("/app/skills")
    expect(formatAppRoute({ view: "skill-studio", skillId: SKILL })).toBe(`/app/skills/${SKILL}`)
    expect(formatAppRoute({ view: "settings" })).toBe("/app/settings")
    expect(formatAppRoute({ view: "workflows" })).toBe("/app/workflows")
    expect(formatAppRoute({ view: "connections" })).toBe("/app/connections")
    expect(formatAppRoute({ view: "control-room" })).toBe("/app/admin")
    expect(formatAppRoute({ view: "admin-spend" })).toBe("/app/admin/spend")
    expect(formatAppRoute({ view: "org-admin" })).toBe("/app/org")
    expect(formatAppRoute({ view: "workflow-run", runId: RUN })).toBe(`/app/runs/${RUN}`)
    expect(formatAppRoute({ view: "experts" })).toBe("/app/experts")
  })

  it("an id is written lowercased", () => {
    expect(formatAppRoute({ view: "workflow-run", runId: RUN.toUpperCase() })).toBe(`/app/runs/${RUN}`)
  })
})

describe("appRoutes · chat and the bare root (D-13, SEED-242)", () => {
  it("/app and /app/chat are chat", () => {
    expect(parseAppLocation("/app", "")).toEqual({ view: "chat" })
    expect(parseAppLocation("/app/chat", "")).toEqual({ view: "chat" })
  })

  it("/app/chat is rewritten to /app; /app is left alone", () => {
    expect(canonicalAddress("/app/chat", "")).toBe("/app")
    expect(canonicalAddress("/app", "")).toBeNull()
  })

  it("bare / is chat and is NEVER rewritten (the app. host serves it)", () => {
    expect(parseAppLocation("/", "")).toEqual({ view: "chat" })
    expect(canonicalAddress("/", "")).toBeNull()
  })
})

describe("appRoutes · strict ids (D-12 / T-297-06)", () => {
  it("/app/runs/<UPPERCASE uuid> is the run, lowercased", () => {
    expect(parseAppLocation(`/app/runs/${RUN.toUpperCase()}`, "")).toEqual({ view: "workflow-run", runId: RUN })
  })

  it("the uppercase form is normalised to the lowercase address", () => {
    expect(canonicalAddress(`/app/runs/${RUN.toUpperCase()}`, "")).toBe(`/app/runs/${RUN}`)
  })

  it.each([
    "/app/runs",
    "/app/runs/run-1",
    `/app/runs/${RUN}x`,
    `/app/runs/${RUN}/extra`,
    `/app/runs/${RUN.slice(0, 35)}`,
  ])("%s is not-found", (path) => {
    expect(parseAppLocation(path, "")).toEqual({ view: "not-found" })
    expect(canonicalAddress(path, "")).toBeNull()
  })

  it("/app/skills/<uuid> is the studio; /app/skills/not-a-uuid is not-found", () => {
    expect(parseAppLocation(`/app/skills/${SKILL}`, "")).toEqual({ view: "skill-studio", skillId: SKILL })
    expect(parseAppLocation("/app/skills/not-a-uuid", "")).toEqual({ view: "not-found" })
  })
})

describe("appRoutes · legacy ?run= (D-16 / D-18)", () => {
  it("/app?run=<uuid> is the run and becomes /app/runs/<uuid>", () => {
    expect(parseAppLocation("/app", `?run=${RUN}`)).toEqual({ view: "workflow-run", runId: RUN })
    expect(canonicalAddress("/app", `?run=${RUN}`)).toBe(`/app/runs/${RUN}`)
  })

  it("an uppercase ?run= value lands on the lowercase address", () => {
    expect(canonicalAddress("/app", `?run=${RUN.toUpperCase()}`)).toBe(`/app/runs/${RUN}`)
  })

  it("other params beside ?run= are kept", () => {
    expect(canonicalAddress("/app", `?run=${RUN}&keep=1`)).toBe(`/app/runs/${RUN}?keep=1`)
  })

  it("/app?run=junk is not-found and the bar is left alone", () => {
    expect(parseAppLocation("/app", "?run=junk")).toEqual({ view: "not-found" })
    expect(canonicalAddress("/app", "?run=junk")).toBeNull()
  })
})

describe("appRoutes · legacy ?connections=1 OAuth return (D-16)", () => {
  it.each(["?connections=1&oauth_error=x", "?connections=1&oauth_connected=1", "?connections=1"])(
    "/app%s is Connections and the WHOLE query is dropped",
    (search) => {
      expect(parseAppLocation("/app", search)).toEqual({ view: "connections" })
      expect(canonicalAddress("/app", search)).toBe("/app/connections")
    },
  )
})

describe("appRoutes · legacy /admin/spend (D-16)", () => {
  it.each(["/admin/spend", "/admin/spend/x"])("%s is admin-spend at /app/admin/spend", (path) => {
    expect(parseAppLocation(path, "")).toEqual({ view: "admin-spend" })
    expect(canonicalAddress(path, "")).toBe("/app/admin/spend")
  })

  it("/admin/spending is not-found", () => {
    expect(parseAppLocation("/admin/spending", "")).toEqual({ view: "not-found" })
    expect(canonicalAddress("/admin/spending", "")).toBeNull()
  })
})

describe("appRoutes · bare known prefixes (D-13)", () => {
  it.each<[string, AppRoute]>([
    ["/workflows", { view: "workflows" }],
    ["/library", { view: "documents" }],
    ["/settings", { view: "settings" }],
    ["/skills", { view: "skills" }],
    ["/connections", { view: "connections" }],
    ["/org", { view: "org-admin" }],
    ["/experts", { view: "experts" }],
    ["/admin", { view: "control-room" }],
    ["/chat", { view: "chat" }],
    [`/runs/${RUN}`, { view: "workflow-run", runId: RUN }],
  ])("%s opens its view and is rewritten under /app", (path, route) => {
    expect(parseAppLocation(path, "")).toEqual(route)
    expect(canonicalAddress(path, "")).toBe(formatAppRoute(route))
  })

  it("a bare prefix keeps any query it carried", () => {
    expect(canonicalAddress("/workflows", "?x=1")).toBe("/app/workflows?x=1")
  })
})

describe("appRoutes · pre-auth addresses are never touched (D-17)", () => {
  it.each<[string, string]>([
    ["/setup", ""],
    ["/invite", ""],
    ["/invite", "?token=x"],
    ["/setup", "?token=x"],
  ])("%s%s is pre-auth and canonicalAddress is null", (path, search) => {
    expect(parseAppLocation(path, search)).toEqual({ view: "pre-auth" })
    expect(canonicalAddress(path, search)).toBeNull()
  })
})

describe("appRoutes · unknown params never trigger a rewrite (Pitfall 10)", () => {
  it("/app?code=x is chat and the bar is left alone (an auth callback)", () => {
    expect(parseAppLocation("/app", "?code=x")).toEqual({ view: "chat" })
    expect(canonicalAddress("/app", "?code=x")).toBeNull()
  })

  it("a canonical path with any unknown query is left alone", () => {
    expect(canonicalAddress("/app/library", "?a=b%20c&d")).toBeNull()
  })
})

describe("appRoutes · trailing slashes normalise", () => {
  it.each([
    ["/app/library/", "/app/library"],
    ["/app/", "/app"],
    [`/app/runs/${RUN}/`, `/app/runs/${RUN}`],
    ["/app/admin/spend/", "/app/admin/spend"],
  ])("%s → %s", (path, canonical) => {
    expect(parseAppLocation(path, "")).toEqual(parseAppLocation(canonical, ""))
    expect(canonicalAddress(path, "")).toBe(canonical)
  })
})

describe("appRoutes · hostile inputs (T-297-05 / T-297-06)", () => {
  const HOSTILE = [
    "//evil.com",
    "//evil.com/app",
    "/\\evil.com",
    "/app/\\evil.com",
    "/app/%2e%2e",
    "/app/%2F%2Fevil.com",
    "/app/../admin",
    "/app/./library",
    "/app/library.json",
    "/app.html",
    "/app//library",
    `/app/${"a".repeat(10_000)}`,
    "/app/ライブラリ",
    "/https://evil.com",
    "/app/https:/evil.com",
    "",
    "app/library",
    "/APP/LIBRARY",
    "/nonsense",
    "/app/nonsense",
  ]

  it.each(HOSTILE)("%s never throws and parses to not-found", (path) => {
    expect(() => parseAppLocation(path, "")).not.toThrow()
    expect(parseAppLocation(path, "")).toEqual({ view: "not-found" })
  })

  it.each(HOSTILE)("%s never yields an off-origin canonical address", (path) => {
    let out: string | null = "unset"
    expect(() => {
      out = canonicalAddress(path, "")
    }).not.toThrow()
    expect(out).toBeNull()
  })

  it("no canonical address for any input ever starts // or contains ://", () => {
    const inputs: Array<[string, string]> = [
      ...HOSTILE.map((p) => [p, ""] as [string, string]),
      ["/workflows", ""],
      ["/admin/spend", ""],
      ["/app", `?run=${RUN}`],
      ["/app", "?connections=1&oauth_error=https://evil.com"],
      ["/app/chat", ""],
    ]
    for (const [p, s] of inputs) {
      const out = canonicalAddress(p, s)
      if (out === null) continue
      expect(out.startsWith("/app")).toBe(true)
      expect(out.startsWith("//")).toBe(false)
      expect(out).not.toContain("://")
    }
  })

  it("non-string input never throws", () => {
    expect(() => parseAppLocation(undefined as unknown as string, undefined as unknown as string)).not.toThrow()
    expect(parseAppLocation(undefined as unknown as string, "")).toEqual({ view: "not-found" })
    expect(canonicalAddress(null as unknown as string, null as unknown as string)).toBeNull()
  })
})
