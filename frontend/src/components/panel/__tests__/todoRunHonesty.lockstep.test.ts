/**
 * Phase 250 (`HONEST-04`) — the run-ended marker is PINNED to the backend constant.
 *
 * ── WHY A FENCE AND NOT JUST A CAREFUL COPY ──────────────────────────────────────────
 *
 * `backend/app/services/todos_service.py::_RUN_ENDED_MARKER` is the suffix the run-end
 * reconciler appends to a still-open todo's `content`. Phase 250 stops showing that suffix to
 * the user: the panel strips it and puts the honesty in the STATUS slot instead.
 *
 * A strip is only as good as the string it strips. If the two copies drift by ONE character —
 * a hyphen where the em-dash (U+2014) is, a missing leading space, a reworded parenthetical —
 * the strip silently becomes a no-op and the row shows BOTH the raw `(run ended — not
 * completed)` text AND a `Not ticked` badge. **Two contradictory statements on one line, and
 * no other gate in this repo can see it**: the backend tests still pass (the marker is
 * correct), the frontend tests still pass (the helper is correct), and only the pair is wrong.
 *
 * Measured at the time of writing (`250-MEASUREMENT.md`): **25 stored rows already carry this
 * exact string.** Changing it is a data decision, not a wording decision.
 *
 * ⚠ The `?raw` import of a backend `.py` is the shipped idiom in this repo — see
 * `src/components/admin/__tests__/addProviderRoster.lockstep.test.ts` and
 * `src/components/ingestion/__tests__/acceptFormats.test.ts`.
 */
import { describe, expect, it } from "vitest"

import { RUN_ENDED_MARKER, stripRunEndedMarker } from "../todoRunHonesty"

// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import todosServicePySource from "../../../../../backend/app/services/todos_service.py?raw"

/**
 * Read the value of a top-level python string constant out of source text.
 *
 * Deliberately narrow: it anchors on `NAME = "` and reads to the closing quote on the same
 * line. `_RUN_ENDED_MARKER` has been written that way for its whole life. A parser that tried
 * to be general here would be a second implementation of Python — a worse bet than a fence
 * that fails loudly the day the source is reformatted.
 */
function pyStringConstant(source: string, name: string): string {
  const decl = `${name} = "`
  const start = source.indexOf(decl)
  if (start === -1) {
    throw new Error(
      `could not find \`${name}\` in backend/app/services/todos_service.py — if it was ` +
        `renamed or reformatted, update THIS parser rather than deleting the fence`,
    )
  }
  const from = start + decl.length
  const end = source.indexOf('"', from)
  if (end === -1) throw new Error(`unterminated string literal for \`${name}\``)
  return source.slice(from, end)
}

describe("todoRunHonesty — the run-ended marker is in lockstep with the backend", () => {
  it("matches backend/app/services/todos_service.py::_RUN_ENDED_MARKER byte for byte", () => {
    const backend = pyStringConstant(todosServicePySource as string, "_RUN_ENDED_MARKER")
    expect(RUN_ENDED_MARKER).toBe(backend)
  })

  it("still carries the two details a careless retype loses", () => {
    // These are asserted about the BACKEND value, so the fence keeps its meaning even if
    // someone "fixes" the frontend copy to match a drifted backend.
    const backend = pyStringConstant(todosServicePySource as string, "_RUN_ENDED_MARKER")
    expect(backend.startsWith(" ")).toBe(true) // the LEADING SPACE joins it as a suffix
    expect(backend).toContain("—") // EM-DASH, not a hyphen
  })

  it("strips cleanly off a real stored row", () => {
    // The shape measured in the database on 2026-09-15.
    const stored = `Translate full document content to Arabic${RUN_ENDED_MARKER}`
    expect(stored).toContain("(run ended")
    const { label, wasMarked } = stripRunEndedMarker(stored)
    expect(wasMarked).toBe(true)
    expect(label).toBe("Translate full document content to Arabic")
  })

  it("leaves an unmarked row completely alone", () => {
    const { label, wasMarked } = stripRunEndedMarker("Search knowledge base for report data")
    expect(wasMarked).toBe(false)
    expect(label).toBe("Search knowledge base for report data")
  })
})
