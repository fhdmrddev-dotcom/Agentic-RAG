/**
 * Phase 299-05 (LINK-06 / D-22, D-23, D-24) — RETURN TO THE LINK.
 *
 * A person who opens a link while signed out must land on that link once they are signed in.
 * Password sign-in never leaves the page, so the address is simply still there. SSO and sign-up
 * DO leave it (the IdP, the confirmation email), so the place to come back to has to travel:
 * as the `redirectTo` / `emailRedirectTo` the auth server sends the browser back to, and as a
 * same-tab sessionStorage copy in case the auth server falls back to the Site URL instead.
 *
 * ⛔ A STRICT LEAF. Its only dependency is the route table (`appRoutes.ts`, itself a strict leaf).
 * Pathname and search arrive as ARGUMENTS; the one browser global it touches is sessionStorage,
 * and every touch is wrapped in try/catch (private mode, a disabled store, SSR).
 *
 * ⛔ REBUILD, NEVER ECHO (D-23 / T-297-05 / T-299-11). The address is attacker-shapeable: it
 * arrives in shared links. `returnTarget` returns `formatAppRoute(parseAppLocation(...))` for a
 * parsed `/app` route and `null` for everything else — `//host`, absolute URLs, backslashes,
 * `/setup`, `/invite`, unknown paths. The value stored or forwarded is always that REBUILT
 * string, so it starts with `/app`, names no host and carries no query or hash. No token is ever
 * written into anything this module returns (T-299-13).
 *
 * ⛔ THE STORED COPY IS UNTRUSTED ON READ (T-299-12). Another script on the origin could plant
 * it, so `takeReturnTarget` re-validates the stored path through `returnTarget`, honours a
 * 15-minute TTL, and consumes the entry ONCE (it is removed before it is judged). Why
 * sessionStorage and not localStorage: the round trip is same-tab only (SSO returns to the tab
 * that left), and a copy that outlives the tab would resume on a normal visit days later — the
 * exact failure Pitfall 7 names. Password sign-in clears it (`forgetReturnTarget`).
 *
 * ⛔ THE KIND, NEVER THE TITLE (D-22 / T-299-14). `kindWord` names what the link opens from its
 * path alone; a signed-out visitor may not learn the item's name. It matches the parsed view by
 * the presence of an id key (`runId`, `threadId`, `definitionId`, `bundleId`), so entity routes
 * added to the table later light up here without editing this file.
 */
import { formatAppRoute, parseAppLocation } from "@/lib/appRoutes"

/** The address to come back to, rebuilt from the route table, or `null`. Never throws. */
export function returnTarget(pathname: string, search: string): string | null {
  try {
    const parsed = parseAppLocation(pathname, search)
    if (parsed.view === "not-found" || parsed.view === "pre-auth") return null
    const out = formatAppRoute(parsed)
    return typeof out === "string" && out.startsWith("/app") && !out.startsWith("//") ? out : null
  } catch {
    return null
  }
}

export type ReturnKind = "a chat" | "a workflow" | "a workflow run" | "an Expert"

/** Id key → the kind word. Order is irrelevant: a route carries at most one of them. */
const KIND_BY_KEY: ReadonlyArray<readonly [string, ReturnKind]> = [
  ["runId", "a workflow run"],
  ["threadId", "a chat"],
  ["definitionId", "a workflow"],
  ["bundleId", "an Expert"],
]

/** What kind of thing the address opens — entity routes only; views and home name nothing. */
export function kindWord(pathname: string, search: string): ReturnKind | null {
  try {
    const parsed = parseAppLocation(pathname, search) as Record<string, unknown>
    if (parsed.view === "not-found" || parsed.view === "pre-auth") return null
    for (const [key, kind] of KIND_BY_KEY) {
      if (typeof parsed[key] === "string" && parsed[key] !== "") return kind
    }
    return null
  } catch {
    return null
  }
}

/** S5's two sentences (299-UI-SPEC). One home: AuthPage renders them, tests assert them. */
export const RETURN_LINE = {
  signin: (kind: ReturnKind) => `After you sign in, you'll go to ${kind}.`,
  signup: (kind: ReturnKind) => `After you sign up, you'll go to ${kind}.`,
} as const

const STORAGE_KEY = "syrel:return-target"
const TTL_MS = 15 * 60 * 1000

/** A path that survives a rebuild unchanged, or `null`. */
function rebuilt(path: unknown): string | null {
  if (typeof path !== "string") return null
  const q = path.indexOf("?")
  return q === -1 ? returnTarget(path, "") : returnTarget(path.slice(0, q), path.slice(q))
}

/** Store the place to come back to. Only a rebuilt, valid path is ever written. */
export function rememberReturnTarget(path: string): void {
  const target = rebuilt(path)
  if (target === null) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ path: target, at: Date.now() }))
  } catch {
    // private mode / a disabled store — the redirectTo still carries the address.
  }
}

/** The stored place, once: removed before it is judged, re-validated, expired after 15 min. */
export function takeReturnTarget(): string | null {
  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  forgetReturnTarget()
  if (raw === null) return null
  try {
    const entry = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (typeof entry?.at !== "number" || !Number.isFinite(entry.at)) return null
    const age = Date.now() - entry.at
    if (age < 0 || age > TTL_MS) return null
    const target = rebuilt(entry.path)
    return target !== null && target === entry.path ? target : null
  } catch {
    return null
  }
}

/** Drop the stored copy (password sign-in: the address never left). */
export function forgetReturnTarget(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear when the store is unavailable
  }
}
