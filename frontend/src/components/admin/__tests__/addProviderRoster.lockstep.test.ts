/**
 * Phase 249 Plan 01 (MODEL-04 / SEED-172) — the Add-model provider roster is PINNED to the
 * backend routing roster.
 *
 * ── WHY A FENCE AND NOT JUST A LONGER ARRAY ─────────────────────────────────────────
 *
 * The roster existed THREE times:
 *
 *   1. `backend/app/config.py::_PROVIDER_BASE_URLS`                 — the routing roster (11)
 *   2. `backend/app/services/model_discovery_service.py::PROVIDER_ENDPOINTS` — SSRF allowlist (8)
 *   3. `frontend/.../ModelRegistryTab.tsx::ADD_PROVIDER_ROSTER`     — hand-typed again (8)
 *
 * (2) is a DIFFERENT LIST FOR A DIFFERENT REASON and is deliberately shorter — it is the set of
 * URLs the server will fetch. But (3) was a hand-typed copy of (2) that was *meant* to be a copy
 * of (1), and the gap — `ollama` / `lmstudio` / `custom` — made every self-hosted model unaddable
 * from the UI for its entire life.
 *
 * Widening (3) by hand fixes today and guarantees tomorrow's drift. This fence reads (1) out of
 * the backend source at test time, so the two cannot disagree without something going red.
 *
 * ⛔ DO NOT "simplify" this by asserting a literal list of 11 names. That would be a FOURTH
 * hand-typed roster, which is the defect wearing a test's clothes.
 *
 * ⚠ The `?raw` import of a backend `.py` is the shipped idiom in this repo — see
 * `src/components/ingestion/__tests__/acceptFormats.test.ts`, which binds an accept-list to
 * `backend/app/api/documents.py` the same way.
 */
import { describe, expect, it } from "vitest"

import { ADD_PROVIDER_ROSTER } from "../ModelRegistryTab"

// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import configPySource from "../../../../../backend/app/config.py?raw"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import discoveryPySource from "../../../../../backend/app/services/model_discovery_service.py?raw"

/**
 * Pull the KEYS of a top-level python dict literal out of source text.
 *
 * Deliberately narrow: it anchors on the declaration line, then reads until the closing brace at
 * column 0. Both target dicts are written that way and have been for their whole lives. A parser
 * that tried to be general here would be a second implementation of Python, which is a worse bet
 * than a fence that fails loudly if the source is ever reformatted.
 */
function dictKeys(source: string, declaration: string): string[] {
  const start = source.indexOf(declaration)
  if (start === -1) {
    throw new Error(
      `could not find "${declaration}" in the backend source — if it was renamed or reformatted, ` +
        `update THIS parser rather than deleting the fence`,
    )
  }
  const end = source.indexOf("\n}", start)
  if (end === -1) throw new Error(`no closing brace for "${declaration}"`)
  const body = source.slice(start, end)
  // ⚠ EXACTLY four spaces, not `\s+`. `PROVIDER_ENDPOINTS`' values are nested dicts whose
  // CONTINUATION lines also start with whitespace then a quoted key (`"auth"`, `"key_env"`), so
  // a lax indent match pulls those in and the roster reads far longer than it is. This fence
  // caught that on its own first run — which is the argument for driving a fence RED before
  // trusting it.
  return [...body.matchAll(/^ {4}"([a-z0-9_]+)"\s*:/gm)].map((m) => m[1])
}

describe("the add-model provider roster is pinned to the backend routing roster", () => {
  /**
   * ⚠ A `?raw` import that resolves to an empty string would make every assertion below pass
   * vacuously. This is the guard against a green test that measured nothing — the exact failure
   * class Phase 242 found in two of this project's other gates.
   */
  it("actually read both backend sources", () => {
    expect(configPySource.length).toBeGreaterThan(1000)
    expect(discoveryPySource.length).toBeGreaterThan(1000)
  })

  it("offers exactly the providers the backend can route through", () => {
    const routing = dictKeys(configPySource, "_PROVIDER_BASE_URLS: dict[str, str] = {")

    expect(routing.length).toBeGreaterThan(0)
    expect([...ADD_PROVIDER_ROSTER].sort()).toEqual([...routing].sort())
  })

  it("includes the three self-hosted providers SEED-172 was about", () => {
    // Named explicitly as well as covered by the set equality above, so a future reader sees
    // WHICH members this fence exists for without re-deriving the history.
    expect(ADD_PROVIDER_ROSTER).toContain("ollama")
    expect(ADD_PROVIDER_ROSTER).toContain("lmstudio")
    expect(ADD_PROVIDER_ROSTER).toContain("custom")
  })

  /**
   * ⛔ THE NEGATIVE HALF. The picker roster must be a STRICT SUPERSET of the SSRF discovery
   * allowlist — never equal to it, and never the thing that drags a self-hosted provider into it.
   * If this goes red because `ollama` appeared in `PROVIDER_ENDPOINTS`, that is a new outbound
   * surface pointed at an operator-supplied URL, not a roster tidy-up.
   */
  it("does not drag a self-hosted provider into the SSRF discovery allowlist", () => {
    const discovery = dictKeys(discoveryPySource, "PROVIDER_ENDPOINTS: dict[str, dict[str, str]] = {")

    expect(discovery).not.toContain("ollama")
    expect(discovery).not.toContain("lmstudio")
    expect(discovery).not.toContain("custom")
    expect(discovery.length).toBeLessThan(ADD_PROVIDER_ROSTER.length)
  })
})
