/**
 * Phase 289 (SC#3 / T-289-21) — the run page's shareable address: `/app?run=<uuid>`.
 *
 * The app has no URL router, so this is the smallest way to make a finished run reachable
 * by a link: App's view initializer and ChatLayout's run-id initializer each read it once on
 * boot, and the evidence report writes it while it is shown (and clears it when it leaves),
 * so the address bar always names the record on screen and a reload keeps it.
 *
 * ⚠ CORRECTED 2026-10-27 (Phase 297-02, D-18 / D-33) — THE PARAGRAPH ABOVE IS KEPT RATHER THAN
 * OVERWRITTEN. The app has a router now and the run page has its own address, `/app/runs/<id>`.
 * The router is the only History writer, so the write and clear helpers are deleted, and so is
 * the reader of the browser address. What survives is the strict rule and a pure reader over a
 * search STRING, which the route table (`appRoutes.ts`) uses to keep old `?run=` links working
 * as a legacy alias (they are replaced by the run's own address on arrival).
 *
 * ⚠ THE VALUE IS ATTACKER-CONTROLLABLE — it arrives in a shared link. The reader accepts a
 * strict UUID and nothing else; any other value is `null`, never a partial match. Access is
 * still decided by the server (a 404 for every refusal), so this guard keeps junk out of a
 * request path rather than standing in for authorisation.
 *
 * Pure helpers: no React, no browser globals, never throws.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PARAM = "run"

/** Phase 297-02 (D-12): THE one strict-UUID rule, shared with the route table (`appRoutes.ts`). */
export function isStrictUuid(value: string): boolean {
  return typeof value === "string" && UUID_RE.test(value)
}

/** Phase 297-02 (D-18): the `?run=` value from a search STRING — a strict UUID lowercased,
 *  else `null`. The route table parses the legacy alias through this. */
export function readRunParam(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get(PARAM)
    if (raw === null || !UUID_RE.test(raw)) return null
    return raw.toLowerCase()
  } catch {
    return null
  }
}
