/**
 * ⚠ THE TEARDOWN GUARD FOR SKETCH 202's SURFACE (`frontend/sketch/`), and it exists because
 * of a MEASURED near-miss rather than caution.
 *
 * Sketch 179 put a rendered sketch behind a dev route. It was torn down correctly by plan
 * `192.2-06` — but `docs/HOT-FILE-LEDGER.md` records what that exposed, verbatim:
 *
 *     "No pinned file decreased and 92/92 still resolve, because NO GATED SUITE EVER
 *      COVERED `src/dev/` AT ALL. So the gate could never have told anyone that a dev-only
 *      surface had outlived its sketch — the teardown obligation was carried by a note in a
 *      sketch README and by nothing executable."
 *
 * A sketch surface that outlives its sketch becomes production surface by accident.
 *
 * ── ⚠ WHY THE GUARD IS HERE AND NOT INSIDE `sketch/` ──────────────────────────────────
 *
 * A guard living inside the directory it polices is DELETED at teardown — i.e. it vanishes
 * at exactly the moment it is supposed to fire, and its silence afterwards is
 * indistinguishable from success. It lives under `src/` so it survives the thing it watches.
 *
 * ── ⚠ THE LIMITATION, STATED RATHER THAN HIDDEN ───────────────────────────────────────
 *
 * `scripts/vitest-count-gate.cjs`'s `TARGETS` reaches `src/` by ONE directory entry
 * (`src/components/workflows`) plus a handful of NAMED page files. There is no `src/__tests__`
 * entry, so **the count gate does not run this file.** A plain `npx vitest run` does, which is
 * the property that matters — but a green count gate is NOT evidence this guard passed. That
 * is the same gap 179 fell into, narrowed rather than closed: the obligation is now executable
 * somewhere, instead of nowhere.
 *
 * ── ⚠ HOUSE RULES OBEYED ──────────────────────────────────────────────────────────────
 *
 * No static `node:*` import — `tsconfig.app.json` sets `types: ["vite/client"]` and a static
 * one adds NEW `tsc` errors to the baseline every plan is measured against (it did, four of
 * them, on this guard's first draft). The read goes through `vi.importActual`, exactly as
 * `gutterTokens.fences.test.ts:110` does. Paths come from `import.meta.url` by STRING SURGERY,
 * never `new URL(…)` — Vite statically rewrites the latter into an asset reference
 * (same file, line 115).
 */
import { describe, expect, it, vi } from "vitest"

const nodeFs = await vi.importActual<{
  existsSync(path: string): boolean
  readdirSync(path: string): string[]
}>("node:fs")

/** `file:///C:/…/frontend/src/__tests__/<this file>` → `…/frontend`. */
const FRONTEND = (() => {
  const here = decodeURIComponent(new globalThis.URL(import.meta.url).pathname)
  const abs = here.slice(0, here.lastIndexOf("/src/__tests__/"))
  // Windows drive paths arrive as `/C:/…`; strip the leading slash so `fs` accepts them.
  return /^\/[A-Za-z]:\//.test(abs) ? abs.slice(1) : abs
})()

const SKETCH_DIR = `${FRONTEND}/sketch`
const SKETCH_TSCONFIG = `${FRONTEND}/tsconfig.sketch.json`
const REPO = FRONTEND.replace(/\/frontend$/, "")
const PHASES_DIR = `${REPO}/.planning/phases`
// ⚠ ADDED 2026-09-18. `.planning/phases/` holds only the ACTIVE milestone. At
// `/gsd:complete-milestone` a phase directory MOVES to `.planning/milestones/<ver>-phases/`,
// and a scan of the active dir alone then reports a phase that DID execute as un-executed.
// That is not hypothetical: it is why this suite was red — see the expiry test below.
const MILESTONES_DIR = `${REPO}/.planning/milestones`

const OWNING_SKETCH = "202"
const RETIRING_PHASE = "200.2"

/**
 * ⚠ A **SUMMARY** IS THE TRIGGER — not a PLAN and certainly not a CONTEXT. A summary is
 * written only when a plan has actually executed, so this fires at the precise moment the
 * sketch has been consumed rather than when it is merely scheduled.
 */
function phaseHasExecuted(phase: string): boolean {
  // Every root a phase directory can live in — the active milestone, and each archived one.
  const roots: string[] = []
  if (nodeFs.existsSync(PHASES_DIR)) roots.push(PHASES_DIR)
  if (nodeFs.existsSync(MILESTONES_DIR)) {
    for (const m of nodeFs.readdirSync(MILESTONES_DIR)) {
      const archived = `${MILESTONES_DIR}/${m}`
      try {
        if (nodeFs.readdirSync(archived).length > 0) roots.push(archived)
      } catch {
        // A path we cannot read is not evidence of execution.
      }
    }
  }
  for (const root of roots) {
    let dirs: string[]
    try {
      dirs = nodeFs.readdirSync(root).filter((d: string) => d.startsWith(`${phase}-`))
    } catch {
      continue
    }
    for (const d of dirs) {
      try {
        if (nodeFs.readdirSync(`${root}/${d}`).some((e: string) => e.endsWith("-SUMMARY.md"))) {
          return true
        }
      } catch {
        // A path we cannot read is not evidence of execution.
      }
    }
  }
  return false
}

describe("the sketch surface is throwaway, and its teardown is executable", () => {
  // ⚠ NON-VACUITY FIRST, AND IT IS LOAD-BEARING. If `FRONTEND` resolved wrongly, every
  // `existsSync` below would answer `false` and this suite would report a clean teardown that
  // never happened — green for exactly the wrong reason. That is the `gutterTokens` lesson
  // (`?raw` silently returns "" for CSS under vitest) applied to a path derivation.
  it("resolved the real frontend root", () => {
    expect(FRONTEND.endsWith("/frontend")).toBe(true)
    expect(nodeFs.existsSync(`${FRONTEND}/package.json`)).toBe(true)
    expect(nodeFs.existsSync(`${FRONTEND}/src/main.tsx`)).toBe(true)
    expect(nodeFs.existsSync(PHASES_DIR)).toBe(true)
  })

  // ── 1. EXPIRY — the assertion 179's teardown had no equivalent of ────────────────────
  it(`is gone once Phase ${RETIRING_PHASE} has executed`, () => {
    if (!phaseHasExecuted(RETIRING_PHASE)) {
      // Still inside the sketch's window. Assert the surface IS here rather than passing
      // silently, so a green run can never be misread as "there is no sketch surface".
      expect(nodeFs.existsSync(SKETCH_DIR)).toBe(true)
      return
    }
    if (nodeFs.existsSync(SKETCH_DIR)) {
      throw new Error(
        `Phase ${RETIRING_PHASE} has executed, so sketch ${OWNING_SKETCH}'s surface is overdue.\n` +
          `Delete frontend/sketch/ AND frontend/tsconfig.sketch.json IN ONE COMMIT.\n` +
          `See .planning/sketches/${OWNING_SKETCH}-the-run-column-rendered/README.md.`,
      )
    }
    expect(nodeFs.existsSync(SKETCH_DIR)).toBe(false)
  })

  // ── 2. THE PAIRING — the sketch dir and its tsconfig live and die together ───────────
  //
  // ⚠ A HALF-TEARDOWN IS AS BROKEN AS NONE. A leftover `tsconfig.sketch.json` pointing at a
  // deleted directory is a config that silently typechecks nothing; a sketch with no config
  // is a sketch outside `tsc` entirely — which forfeits SEED-155's whole guarantee, that a
  // proposal needing a field the wire does not carry fails the compiler rather than review.
  it("keeps frontend/sketch and tsconfig.sketch.json alive or dead together", () => {
    const dir = nodeFs.existsSync(SKETCH_DIR)
    const cfg = nodeFs.existsSync(SKETCH_TSCONFIG)
    expect(
      dir === cfg,
      dir
        ? "frontend/sketch/ exists but tsconfig.sketch.json is gone — the sketch is no longer typechecked."
        : "tsconfig.sketch.json remains but frontend/sketch/ is gone — it typechecks nothing.",
    ).toBe(true)
  })

  // ── 3. THE SHIPPED ENTRY POINT IS UNTOUCHED ─────────────────────────────────────────
  //
  // ⚠ THIS IS THE INVARIANT THE WHOLE `frontend/sketch/` PLACEMENT EXISTS TO BUY. The first
  // attempt reached the sketch through a guarded pathname branch in `src/main.tsx`, and put
  // the component under `src/dev/` — which turned `RunReceipt.test.tsx` RED, because that
  // suite sweeps `import.meta.glob("/src/**")` and asserts EXACTLY ONE importer of
  // `RunReceipt` (199-02's refusal). A sketch under `src/` is production surface as far as a
  // shipped fence is concerned. Keeping the entry point clean is what keeps that fence at
  // full strength while the sketch still mounts the real components.
  it("leaves src/main.tsx with no reference to the sketch", async () => {
    const main = (await import("@/main?raw")).default as string
    expect(main.length).toBeGreaterThan(200)
    expect(main).toContain("createRoot")
    expect(/sketch/i.test(main)).toBe(false)
    expect(/\/dev\//.test(main)).toBe(false)
  })
})
