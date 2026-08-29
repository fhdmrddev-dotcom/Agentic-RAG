/**
 * ⛔ THE RENAME FENCE — the things Phase 217's `Documents` → `Library` rename must NOT change,
 * asserted from SOURCE rather than carried by prose.
 *
 * Plan `217-04` renamed `IngestionPage.tsx` → `LibraryPage.tsx`, the nav label and the page
 * `<h1>`. Four things beside them look renameable and are not, and each is load-bearing for a
 * DIFFERENT reason:
 *
 *   (a) `ActiveView` keeps `"documents"` — it is a KEY, never printed to a user. Renaming it
 *       spends a migration across `citationNav.tsx`, `ChatLayout` and `App.tsx` for zero
 *       user-visible gain.
 *   (b) `ChatLayout`'s trailing `) : ( <KnowledgeHealthPage /> )` is the app's POSITIONAL
 *       FALLBACK — not a `default:` that throws. Disturbing it turns an unmatched `ActiveView`
 *       into a BLANK SCREEN (T-217-15). ⚠ Phase 218 owns replacing it; 217 must not.
 *   (c) the nav label is now `Library` WHILE `view: "documents"` is unchanged. A fence that
 *       reads only one of the two cannot tell a rename from a key migration.
 *   (d) `SIDEBAR_PIN_KEY = "documents.sidebar.pinnedExpanded"` is PERSISTED STATE. Renaming it
 *       silently resets every user's pinned sidebar (T-217-16) — a data loss that no type
 *       error and no test-of-behaviour would surface.
 *
 * ── ⭐ AND (e), WHICH IS WHY THIS FILE IMPORTS A `.py` ────────────────────────────────────
 *
 * `ingestion_step` MUST NEVER BE NULLED ON A TERMINAL WRITE. This is Phase 217's one hard
 * invariant that was carried by NOTHING EXECUTABLE: plans 01, 08 and 09 each restate it in
 * prose, and no plan's `files_modified` contains `documents.py`'s write blocks — which is an
 * ACCIDENT, not a guard. This project's own repeated finding is that a fence nobody has seen
 * fire is not a fence (Phase 190 shipped five that could not).
 *
 * It is load-bearing twice over:
 *   1. `backend/app/services/text_sanitize.py:9` diagnoses BUG-260825-01 by reading
 *      `status=failed` / `ingestion_step=embedding`. **Nulling the column deletes a
 *      diagnostic** — the failure would still be recorded, but not WHERE it failed.
 *   2. D-217-23: the strip's rule that a `completed` document reads `"metadata"` by RESIDUE
 *      rather than by observation is true only while that residue survives.
 *
 * ⛔ DO NOT FENCE THE WHOLE FILE FOR THE STRING. `documents.py`'s reingest RESET legitimately
 * writes `"ingestion_step": None` (it resets to `status: "pending"` before re-ingesting), so an
 * unscoped assertion is RED at HEAD and the obvious "fix" is deleting the guard. The scoping is
 * by STATUS, which excludes the legitimate case BY CONSTRUCTION rather than by an allow-list.
 *
 * ⭐ THE NON-VACUITY CONTROL IS LIVE, NOT SYNTHETIC. The SAME extractor, run over the
 * `"status": "pending"` payloads, MUST report at least one null write — that is the reingest
 * reset, and it proves the null DETECTOR fires against real source. A regex that matches
 * nothing can never prove that. A synthetic RED is observed too, but the live one is the
 * stronger evidence.
 *
 * ── ⚠ WHY LINE NUMBERS ARE NOT THE ANCHOR ────────────────────────────────────────────────
 *
 * Plans 01 and 02 both edit `documents.py` later in this phase, and the file is CRLF. So the
 * block boundaries are RE-DERIVED at run time from surrounding code identity, and the identity
 * anchors below are asserted BEFORE anything rests on the extraction.
 *
 * ── ⚠ EVERY PATTERN TOLERATES CRLF ───────────────────────────────────────────────────────
 *
 * Source files check out with Windows line endings on this box and a terminator spelled `\n\n`
 * silently never matches — which yields an empty result that passes VACUOUSLY.
 * (`argumentModel.test.ts:36-38`.) `[\s\S]` and `\r?\n` throughout, and every raw source is
 * normalised to LF before anything reads it.
 *
 * ── THE THREE SELF-GUARDS (`FileRow.sweep.test.ts:32-41` precedent) ───────────────────────
 *
 *   1. **length** — every `?raw` import asserts a non-trivial character count. Phase 192.1
 *      shipped a sweep over `""` that was green and defended nothing.
 *   2. **identity** — a symbol ONLY that file contains, because a non-empty sweep of the WRONG
 *      file is the same bug.
 *   3. **a stripper non-vacuity pair** — a token that exists only in a file's PROSE, asserted
 *      present in `source` and absent from `codeOf(source)`. A `codeOf` returning `""` would
 *      make every absence arm below pass; this pair is the one thing that reds when it does.
 *      ⚠ The `^\s*` on the line-comment replace is load-bearing: the UNANCHORED variant eats
 *      live code and turns every `not.toContain` into a pass.
 */
import { describe, it, expect } from "vitest"

import appSource from "@/App.tsx?raw"
import layoutSource from "@/components/layout/ChatLayout.tsx?raw"
import navSource from "@/lib/nav-items.ts?raw"
import pageSource from "@/pages/LibraryPage.tsx?raw"
// The cross-language `?raw` over a backend `.py` is the shipped idiom in this repository
// (`argumentModel.test.ts:29-32`). From `src/__tests__/library/` the relative depth to the
// repo root is identical: four levels.
import docsPySource from "../../../../backend/app/api/documents.py?raw"

// ── NORMALISATION ─────────────────────────────────────────────────────────────────────────
const lf = (s: string): string => s.replace(/\r\n/g, "\n")

const APP = lf(appSource)
const LAYOUT = lf(layoutSource)
const NAV = lf(navSource)
const PAGE = lf(pageSource)
const DOCS_PY = lf(docsPySource)

/** The LINE-ANCHORED comment stripper (`FileRow.sweep.test.ts:104`). */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const APP_CODE = codeOf(APP)
const NAV_CODE = codeOf(NAV)

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 0 · THE SELF-GUARDS — a fence that sweeps the empty string is green and defends nothing
// ═══════════════════════════════════════════════════════════════════════════════════════════

describe("renameFence · self-guards", () => {
  it("every ?raw import carries a non-trivial file, not an empty string", () => {
    expect(APP.length).toBeGreaterThan(4000)
    expect(LAYOUT.length).toBeGreaterThan(20000)
    expect(NAV.length).toBeGreaterThan(1500)
    expect(PAGE.length).toBeGreaterThan(15000)
    expect(DOCS_PY.length).toBeGreaterThan(50000)
  })

  it("each source is the file this fence thinks it is (identity, not merely non-empty)", () => {
    // A non-empty sweep of the WRONG file is the same bug as a sweep of the empty string.
    expect(APP).toContain("export type ActiveView")
    expect(LAYOUT).toContain("export function ChatLayout")
    expect(NAV).toContain("export const NAV_ITEMS")
    expect(PAGE).toContain("export function LibraryPage")
    expect(DOCS_PY).toContain('supabase.table("documents")')
  })

  it("the comment stripper is non-vacuous — prose leaves, code stays", () => {
    // Tokens that exist ONLY in each file's prose. If `codeOf` returned "" every absence
    // assertion in this file would pass; this pair is what reds instead.
    expect(APP).toContain("the three-homes contract holds")
    expect(APP_CODE).not.toContain("the three-homes contract holds")
    expect(APP_CODE).toContain("export type ActiveView")

    expect(NAV).toContain("the sketch VANISH")
    expect(NAV_CODE).not.toContain("the sketch VANISH")
    expect(NAV_CODE).toContain("export const NAV_ITEMS")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1 · THE FOUR THINGS THE RENAME MUST NOT CHANGE
// ═══════════════════════════════════════════════════════════════════════════════════════════

describe("renameFence · what the Documents→Library rename must not touch", () => {
  it("(a) ActiveView still carries \"documents\" — it is a key, never printed", () => {
    const decl = /export type ActiveView\s*=([\s\S]*?)\r?\n/.exec(APP_CODE)
    expect(decl).not.toBeNull()
    expect(decl?.[1]).toContain('"documents"')
    // And the union did not shrink while nobody was looking.
    const members = [...(decl?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1])
    expect(members.length).toBeGreaterThanOrEqual(12)
    expect(members).toContain("documents")
  })

  it("(b) ChatLayout's trailing else is still <KnowledgeHealthPage /> — the default view", () => {
    // ⚠ T-217-15. Not a `default:` that throws: an unmatched ActiveView renders THIS.
    // Phase 218 owns replacing it. Sketch fence `A8` reads this exact shape.
    expect(/\)\s*:\s*\(\s*<KnowledgeHealthPage \/>\s*\)/.test(LAYOUT)).toBe(true)
    // It is the LAST arm of the chain, not merely present somewhere in the file.
    const lastTernary = LAYOUT.lastIndexOf("<KnowledgeHealthPage />")
    const libraryMount = LAYOUT.indexOf("<LibraryPage")
    expect(libraryMount).toBeGreaterThan(-1)
    expect(lastTernary).toBeGreaterThan(libraryMount)
  })

  it("(c) the nav label reads Library while `view: \"documents\"` is unchanged", () => {
    expect(/\{\s*view:\s*"documents",[^}]*label:\s*"Library"\s*\}/.test(NAV_CODE)).toBe(true)
    expect(/view:\s*"documents",[^}]*label:\s*"Documents"/.test(NAV_CODE)).toBe(false)
    // The label moved; the KEY did not. A rename of the key is a different (and much larger)
    // change and must not slip in under this one.
    expect(NAV_CODE).not.toMatch(/view:\s*"library"/)
  })

  it("(d) SIDEBAR_PIN_KEY's literal is still \"documents.sidebar.pinnedExpanded\"", () => {
    // ⚠ T-217-16. Persisted state — a rename silently resets every user's pinned sidebar.
    expect(PAGE).toContain('const SIDEBAR_PIN_KEY = "documents.sidebar.pinnedExpanded"')
    expect(PAGE).not.toContain("library.sidebar.pinnedExpanded")
  })

  it("the `activeView === \"documents\"` branch mounts LibraryPage — the one key link", () => {
    // The rename is only real if the branch that renders the surface moved with it. A stale
    // import would not typecheck; a stale BRANCH would render the positional fallback and
    // look like a missing page rather than a missing edit.
    expect(
      /activeView === "documents" \?[\s\S]{0,120}<LibraryPage onNavigate=\{onNavigate\} \/>/.test(
        LAYOUT,
      ),
    ).toBe(true)
    expect(LAYOUT).not.toContain("<IngestionPage")
  })

  it("the page subtitle is the contract's sentence, and the one it replaced is gone", () => {
    expect(PAGE).toContain("What the agent can read, and how well it reads it.")
    expect(PAGE).not.toContain("Upload documents to give the AI context for your conversations.")
  })

  it("the `library-health` and `governance` nav entries survive — 218 retires them, not 217", () => {
    expect(NAV_CODE).toMatch(/view:\s*"library-health"/)
    expect(NAV_CODE).toMatch(/view:\s*"governance"/)
    // And Governance keeps its feature gate while the Library entry stays ungated. That
    // asymmetry is the thing the 218 merge must carry explicitly rather than inherit.
    expect(/view:\s*"governance",[\s\S]{0,140}feature:\s*"governance_health"/.test(NAV_CODE)).toBe(
      true,
    )
    expect(/\{\s*view:\s*"documents",[^}]*feature:/.test(NAV_CODE)).toBe(false)
  })

  it("the rename itself DID land — this fence is not guarding a no-op", () => {
    expect(PAGE).toContain(">Library</h1>")
    expect(PAGE).not.toContain(">Documents</h1>")
    expect(LAYOUT).toContain('from "@/pages/LibraryPage"')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ (e) `ingestion_step` IS NEVER NULLED ON A TERMINAL WRITE
// ═══════════════════════════════════════════════════════════════════════════════════════════

interface Payload {
  status: string
  body: string
  nullsIngestionStep: boolean
}

/** The null-write detector. Exported as a function so the SYNTHETIC RED can re-run it on a
 *  mutated copy of a real payload rather than on a string typed by hand. */
const nullsIngestionStep = (body: string): boolean =>
  /["']ingestion_step["']\s*:\s*(None|null|undefined)\b/.test(body)

/**
 * Every `documents` UPDATE payload in `documents.py` that sets a `status`, classified by the
 * status it sets.
 *
 * ⚠ THE `\s*` BETWEEN `.table("documents")` AND `.update({` IS REQUIRED AND IS NOT COSMETIC.
 * The reingest reset — this fence's live positive control — is formatted with `.update({` on
 * its own line, and a pattern without the `\s*` silently misses the one block the control
 * depends on.
 */
function statusBearingPayloads(): Payload[] {
  const out: Payload[] = []
  const re = /supabase\.table\("documents"\)\s*\.update\(\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(DOCS_PY)) !== null) {
    const start = m.index + m[0].length
    const end = DOCS_PY.indexOf("})", start)
    if (end === -1) continue
    const body = DOCS_PY.slice(start, end)
    const st = /["']status["']\s*:\s*["']([a-z_]+)["']/.exec(body)
    if (st === null) continue
    out.push({ status: st[1], body, nullsIngestionStep: nullsIngestionStep(body) })
  }
  return out
}

const PAYLOADS = statusBearingPayloads()

describe("renameFence · ingestion_step's diagnostic residue", () => {
  it("the extraction found the blocks it claims to guard (identity anchors)", () => {
    // Asserted BEFORE anything rests on the extraction. Measured at planning time
    // (2026-08-29): SEVEN status-bearing payloads — 1 completed, 3 failed, 2 pending,
    // 1 processing. The floor is four; a grown file is fine, an empty one is not.
    expect(PAYLOADS.length).toBeGreaterThanOrEqual(4)

    const completed = PAYLOADS.filter((p) => p.status === "completed")
    expect(completed).toHaveLength(1)
    expect(completed[0].body).toContain("chunk_count")
    expect(completed[0].body).toContain('"extractor": engine_used')

    const failed = PAYLOADS.filter((p) => p.status === "failed")
    expect(failed.length).toBeGreaterThanOrEqual(1)
    expect(failed.some((p) => p.body.includes('"error_message": str(e)[:500]'))).toBe(true)
  })

  it("⭐ LIVE POSITIVE CONTROL — the detector provably fires on real source", () => {
    // The SAME extractor over the `pending` payloads. `documents.py`'s reingest RESET is the
    // ONE legitimate `"ingestion_step": None` in the file. If this arm ever goes green-by-
    // absence, the absence assertions below are vacuous and must not be believed.
    const pending = PAYLOADS.filter((p) => p.status === "pending")
    expect(pending.length).toBeGreaterThanOrEqual(1)
    expect(pending.filter((p) => p.nullsIngestionStep).length).toBeGreaterThanOrEqual(1)
  })

  it("no terminal write (completed | failed) nulls ingestion_step", () => {
    // ⚠ Nulling it deletes a DIAGNOSTIC: `text_sanitize.py:9` reads
    // `status=failed` / `ingestion_step=embedding` to place BUG-260825-01's failure. And
    // D-217-23's "a completed document reads `metadata` by RESIDUE" holds only while the
    // residue survives.
    const terminal = PAYLOADS.filter((p) => p.status === "completed" || p.status === "failed")
    expect(terminal.length).toBeGreaterThanOrEqual(2)
    const offenders = terminal.filter((p) => p.nullsIngestionStep).map((p) => p.status)
    expect(offenders).toEqual([])
  })

  it("SYNTHETIC RED — splicing the null into a real completed payload IS rejected", () => {
    // The predicate is re-run on a MUTATED COPY of the extracted payload, never on a string
    // typed here: a hand-written sample proves the regex works on a hand-written sample.
    const completed = PAYLOADS.find((p) => p.status === "completed")
    expect(completed).toBeDefined()
    expect(nullsIngestionStep(completed!.body)).toBe(false)

    const planted = completed!.body.replace(
      '"status": "completed"',
      '"status": "completed",\n            "ingestion_step": None,',
    )
    expect(planted).not.toBe(completed!.body)
    expect(nullsIngestionStep(planted)).toBe(true)
  })
})
