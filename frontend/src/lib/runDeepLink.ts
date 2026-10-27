/**
 * Phase 289 (SC#3 / T-289-21) — the run page's shareable address: `/app?run=<uuid>`.
 *
 * The app has no URL router, so this is the smallest way to make a finished run reachable
 * by a link: App's view initializer and ChatLayout's run-id initializer each read it once on
 * boot, and the evidence report writes it while it is shown (and clears it when it leaves),
 * so the address bar always names the record on screen and a reload keeps it.
 *
 * ⚠ THE VALUE IS ATTACKER-CONTROLLABLE — it arrives in a shared link. The reader accepts a
 * strict UUID and nothing else; any other value is `null`, never a partial match. Access is
 * still decided by the server (a 404 for every refusal), so this guard keeps junk out of a
 * request path rather than standing in for authorisation.
 *
 * Pure DOM-API helpers: no React, never throws (no window → null / no-op).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PARAM = "run"

function hasWindow(): boolean {
  return typeof window !== "undefined" && window !== null && typeof window.location !== "undefined"
}

/** Phase 297-02 (D-12): THE one strict-UUID rule, shared with the route table (`appRoutes.ts`). */
export function isStrictUuid(value: string): boolean {
  return typeof value === "string" && UUID_RE.test(value)
}

/** Phase 297-02 (D-18): the `?run=` value from a search STRING (no window read) — a strict
 *  UUID lowercased, else `null`. The route table parses the legacy alias through this. */
export function readRunParam(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get(PARAM)
    if (raw === null || !UUID_RE.test(raw)) return null
    return raw.toLowerCase()
  } catch {
    return null
  }
}

/** The `?run=` value when it is a valid UUID (lowercased), else `null`. */
export function readRunDeepLink(): string | null {
  try {
    if (!hasWindow()) return null
    const raw = new URLSearchParams(window.location.search).get(PARAM)
    if (raw === null || !UUID_RE.test(raw)) return null
    return raw.toLowerCase()
  } catch {
    return null
  }
}

function replaceWith(url: URL): void {
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
}

/** Put `?run=<id>` in the address bar without a history entry. A non-UUID id writes nothing. */
export function writeRunDeepLink(runId: string): void {
  try {
    if (!hasWindow() || !UUID_RE.test(runId)) return
    const url = new URL(window.location.href)
    if (url.searchParams.get(PARAM) === runId.toLowerCase()) return
    url.searchParams.set(PARAM, runId.toLowerCase())
    replaceWith(url)
  } catch {
    /* never throws */
  }
}

/** Remove `run` from the address bar, leaving every other param. */
export function clearRunDeepLink(): void {
  try {
    if (!hasWindow()) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has(PARAM)) return
    url.searchParams.delete(PARAM)
    replaceWith(url)
  } catch {
    /* never throws */
  }
}
