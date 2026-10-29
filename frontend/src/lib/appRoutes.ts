/**
 * Phase 297-02 (LINK-01 / D-11, D-12, D-13, D-16, D-17) — THE ROUTE TABLE.
 *
 * Every top-level view has one address under `/app`, and this module is the ONE home of that
 * vocabulary. The address bar is read through `parseAppLocation`; every address the app writes
 * comes out of `formatAppRoute` (a view change) or `canonicalAddress` (a legacy or bare shape
 * being normalised in place). Nothing else in the tree spells an `/app/...` path for a view.
 *
 * ⛔ THIS MODULE IS A STRICT LEAF. No React, no browser globals: pathname and search arrive as
 * ARGUMENTS, so the same functions serve the router hook, the parity suite and any test with
 * nothing to mock. Its only imports are a type (the `ActiveView` union, erased at runtime) and the
 * strict-UUID helpers in `runDeepLink.ts`, itself a leaf.
 *
 * ⛔ IT NEVER THROWS. The parser is total: anything it does not recognise is `not-found`, and a
 * thrown error inside it is caught and reported as `not-found` too. A route table that can throw
 * takes the whole app down on a mistyped link.
 *
 * ⛔ THE ADDRESS IS ATTACKER-CONTROLLED (T-297-05 / T-297-06). It arrives in shared links and
 * emails. So:
 *   • ids are strict UUIDs (the reviewed `runDeepLink` rule, T-289-21), lowercased; a partial
 *     match is `not-found`, never a best guess;
 *   • a path starting "//", or carrying a backslash, a percent-escape, an empty segment or a
 *     dotted segment, is `not-found` before any table lookup;
 *   • `canonicalAddress` builds its result ONLY from `formatAppRoute` plus the query params it
 *     did not own. It never echoes the input path, so every value it returns starts with `/app`
 *     and names no host. Unknown params alone never trigger a rewrite (an auth callback's
 *     `?code=` must survive until the auth client reads it — Pitfall 10).
 *
 * Two kinds of address are deliberately left alone: `/setup` and `/invite` are pre-auth pages App
 * renders itself (D-17), and bare `/` is chat (D-13 — the `app.` host serves the app there).
 *
 * Phase 299-02 (2026-10-28, LINK-02 / D-01): three ENTITY addresses join the table —
 * `/app/chat/<uuid>` (a thread), `/app/workflows/<uuid>` (a definition) and `/app/experts/<uuid>`
 * (an Expert bundle), beside 297's `/app/runs/<uuid>`. They are id-bearing variants of existing
 * views, not new `ActiveView` members, so `VIEW_PATHS` and the reachability route leg are
 * unchanged; the id-less forms still carry no id key at all (`/app` is exactly `{ view: "chat" }`).
 * Every rule above holds for them unchanged: strict UUIDs, lowercased, never throws, no host.
 * The legacy `?run=` alias stays the chat HOME's — a thread address keeps its thread.
 */

import type { ActiveView } from "@/App"
import { isStrictUuid, readRunParam } from "@/lib/runDeepLink"

export type AppRoute =
  | { view: "workflow-run"; runId: string }
  | { view: "skill-studio"; skillId: string }
  // Phase 299-02 (D-01): the entity variants. The id-less forms below stay id-free.
  | { view: "chat"; threadId: string }
  | { view: "workflows"; definitionId: string }
  | { view: "experts"; bundleId: string }
  | { view: Exclude<ActiveView, "workflow-run" | "skill-studio"> }

/** What an address resolves to: a view, nothing (`not-found`), or a pre-auth page App owns. */
export type ParsedLocation = AppRoute | { view: "not-found" } | { view: "pre-auth" }

/**
 * The D-11 table. Keyed by the whole union, so a new member without an address
 * is a compile error (TS2741) here, and the reachability route leg catches it at test time.
 */
export const VIEW_PATHS: Record<ActiveView, string> = {
  chat: "/app",
  documents: "/app/library",
  skills: "/app/skills",
  "skill-studio": "/app/skills",
  settings: "/app/settings",
  workflows: "/app/workflows",
  connections: "/app/connections",
  "control-room": "/app/admin",
  "admin-spend": "/app/admin/spend",
  "org-admin": "/app/org",
  "workflow-run": "/app/runs",
  experts: "/app/experts",
}

const NOT_FOUND: ParsedLocation = { view: "not-found" }
const PRE_AUTH_PATHS = new Set(["/setup", "/invite"])
/** Longer than any real address by an order of magnitude; past it, nothing is looked up. */
const MAX_PATH_LENGTH = 2048
/** First segments that open their view without the `/app` prefix (D-13). */
const BARE_PREFIXES = new Set(["chat", "library", "skills", "settings", "workflows", "connections", "admin", "org", "runs", "experts"])

/** The address of a route. Ids are written lowercased. */
export function formatAppRoute(route: AppRoute): string {
  if (route.view === "workflow-run") return `${VIEW_PATHS["workflow-run"]}/${route.runId.toLowerCase()}`
  if (route.view === "skill-studio") return `${VIEW_PATHS["skill-studio"]}/${route.skillId.toLowerCase()}`
  // Phase 299-02 (D-01 / D-32): a thread is `/app/chat/<id>`, never the `/app` home.
  if ("threadId" in route) return `/app/chat/${route.threadId.toLowerCase()}`
  if ("definitionId" in route) return `${VIEW_PATHS.workflows}/${route.definitionId.toLowerCase()}`
  if ("bundleId" in route) return `${VIEW_PATHS.experts}/${route.bundleId.toLowerCase()}`
  return VIEW_PATHS[route.view]
}

/** Segments after `/app`, or `null` when the path is unsafe or malformed. Trailing slash dropped. */
function segmentsOf(pathname: string): string[] | null {
  if (pathname.length === 0 || pathname.length > MAX_PATH_LENGTH) return null
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null
  if (pathname.includes("\\") || pathname.includes("%")) return null
  const trimmed = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
  if (trimmed === "/") return []
  const segments = trimmed.slice(1).split("/")
  for (const segment of segments) {
    if (segment.length === 0 || segment.includes(".")) return null
  }
  return segments
}

/** The view a list of segments names (already stripped of any `/app` prefix). */
function viewOf(rest: string[]): ParsedLocation {
  const [head, id, extra] = rest
  if (rest.length === 0) return { view: "chat" }
  if (extra !== undefined) return NOT_FOUND
  if (id === undefined) {
    switch (head) {
      case "chat":
        return { view: "chat" }
      case "library":
        return { view: "documents" }
      case "skills":
        return { view: "skills" }
      case "settings":
        return { view: "settings" }
      case "workflows":
        return { view: "workflows" }
      case "connections":
        return { view: "connections" }
      case "admin":
        return { view: "control-room" }
      case "org":
        return { view: "org-admin" }
      case "experts":
        return { view: "experts" }
      default:
        return NOT_FOUND
    }
  }
  if (head === "admin" && id === "spend") return { view: "admin-spend" }
  if (head === "runs" && isStrictUuid(id)) return { view: "workflow-run", runId: id.toLowerCase() }
  if (head === "skills" && isStrictUuid(id)) return { view: "skill-studio", skillId: id.toLowerCase() }
  // Phase 299-02 (D-01): the entity arms, beside runs / skills and by the same strict-UUID rule.
  if (head === "chat" && isStrictUuid(id)) return { view: "chat", threadId: id.toLowerCase() }
  if (head === "workflows" && isStrictUuid(id)) return { view: "workflows", definitionId: id.toLowerCase() }
  if (head === "experts" && isStrictUuid(id)) return { view: "experts", bundleId: id.toLowerCase() }
  return NOT_FOUND
}

interface Resolution {
  parsed: ParsedLocation
  /** The query param this resolution consumed: `run` is removed, `connections` drops the query. */
  owned: "run" | "connections" | null
}

function resolve(pathname: string, search: string): Resolution {
  if (typeof pathname !== "string") return { parsed: NOT_FOUND, owned: null }
  if (PRE_AUTH_PATHS.has(pathname)) return { parsed: { view: "pre-auth" }, owned: null }
  const segments = segmentsOf(pathname)
  if (segments === null) return { parsed: NOT_FOUND, owned: null }

  let parsed: ParsedLocation
  if (segments[0] === "app") {
    parsed = viewOf(segments.slice(1))
  } else if (segments[0] === "admin" && segments[1] === "spend") {
    // Phase 257 (METER-07) legacy: `/admin/spend` and anything under it (D-16).
    parsed = { view: "admin-spend" }
  } else if (segments.length === 0 || BARE_PREFIXES.has(segments[0])) {
    parsed = viewOf(segments)
  } else {
    parsed = NOT_FOUND
  }

  // The legacy query aliases apply only where the path itself says "chat" (D-16) — and, since
  // 299-02, only on the chat HOME: a thread address keeps its thread (D-05).
  if (parsed.view === "chat" && !("threadId" in parsed)) {
    const query = new URLSearchParams(typeof search === "string" ? search : "")
    if (query.has("run")) {
      const runId = readRunParam(search)
      return runId ? { parsed: { view: "workflow-run", runId }, owned: "run" } : { parsed: NOT_FOUND, owned: null }
    }
    if (query.get("connections") === "1") return { parsed: { view: "connections" }, owned: "connections" }
  }
  return { parsed, owned: null }
}

/** What the address names. Total: never throws, anything unrecognised is `not-found`. */
export function parseAppLocation(pathname: string, search: string): ParsedLocation {
  try {
    return resolve(pathname, search).parsed
  } catch {
    return NOT_FOUND
  }
}

/**
 * The address the bar SHOULD hold, or `null` to leave it alone: not-found, pre-auth, bare `/`,
 * already canonical, or a canonical path carrying only params this module does not own.
 */
export function canonicalAddress(pathname: string, search: string): string | null {
  try {
    const { parsed, owned } = resolve(pathname, search)
    if (parsed.view === "not-found" || parsed.view === "pre-auth") return null
    const target = formatAppRoute(parsed)
    const pathIsBareRoot = pathname === "/"

    let query: string
    if (owned === "connections") {
      query = ""
    } else if (owned === "run") {
      const params = new URLSearchParams(search)
      params.delete("run")
      query = params.toString()
    } else {
      if (target === pathname || pathIsBareRoot) return null
      query = typeof search === "string" ? search.replace(/^\?/, "") : ""
    }
    const out = query ? `${target}?${query}` : target
    return out.startsWith("/app") ? out : null
  } catch {
    return null
  }
}
