/**
 * Phase 192.2-10 Task 2 (WR-02) — THE LOOKALIKE RUN-FIELD FENCE OVER `lib/api.ts`.
 *
 * `frontend/src/lib/api.ts` declares THREE fields spelled `last_run_status?: string | null` —
 * on `ThreadWorkflowState`, on `PublishedWorkflow` and on `WorkflowDraftRow`. They describe
 * different tables at different scopes, and **a swap between any two of them TYPECHECKS**,
 * exactly as the file's own warning twelve lines above the collision predicted. It also
 * carries ONE database column under TWO wire names: `workflow_runs.created_at` arrives as
 * `last_run_created_at` on the thread type and as `last_run_at` on the two library types.
 *
 * DEC-10-B decided the fix is a CROSS-REFERENCE, not a rename: `api.ts` is the hottest file in
 * this repository and Phase 197 declined its extraction seam on the recorded basis that its
 * change was type-only. So each of the three declarations now carries a docblock naming the
 * other two BY TYPE NAME (never by line number, which rots), and each embeds one marker token.
 * This suite is what keeps that true.
 *
 * ⚠ WHAT MAKES THIS SUITE GO RED, stated so a future reader does not have to infer it:
 *   · a FOURTH `last_run_status?: string | null` declaration added anywhere in `api.ts`
 *     without its cross-reference docblock and marker;
 *   · a marker DELETED from one of the three docblocks (i.e. the paragraph was rewritten away);
 *   · a cross-reference block that stops naming all three types.
 *
 * ⚠ THE DECLARATION DETECTOR IS LINE-ANCHORED, AND THAT IS LOAD-BEARING RATHER THAN TIDY.
 * Those three docblocks now DISCUSS the field by name, so a naive whole-file count of the
 * identifier reads 18 where the truth is 3 — the fence would be counting the prose that
 * documents the rule, and would satisfy itself. That is the 187-24 trap, which this project has
 * hit four times in one subtree. A JSDoc body line always begins with `*`, so an anchored match
 * on a line whose ONLY content is the declaration structurally cannot see a comment.
 *
 * ⚠ EVERY COUNT IS ASSERTED TO A RECORDED NUMBER, NEVER A LOWER BOUND. And every detector is
 * run over a synthetic source carrying the violation (a planted FOURTH declaration with only
 * THREE markers), because a fence with a broken matcher passes vacuously and looks exactly like
 * a fence that holds.
 */
import { describe, it, expect } from "vitest"
import { API_SOURCE as apiSource } from "@/lib/apiSource.testutil"

/** The single fixed literal embedded in each of the three cross-reference docblocks. */
const MARKER = "WR-02-LOOKALIKE-LAST-RUN-STATUS"

/** The three types that carry a `last_run_status`. Each cross-reference block names all three. */
const TYPES = ["ThreadWorkflowState", "PublishedWorkflow", "WorkflowDraftRow"] as const

/** The recorded truth this fence pins. Both are NUMBERS on purpose, never bounds. */
const EXPECTED_DECLARATIONS = 3
const EXPECTED_MARKERS = 3

/**
 * THE DECLARATION DETECTOR — a whole line whose only content is the declaration.
 * A JSDoc body line starts with `*` and a line comment starts with a slash, so neither can match.
 */
const declarationsIn = (src: string): string[] =>
  src.match(/^[ \t]*last_run_status\?: string \| null[ \t]*$/gm) ?? []

/** Every JSDoc block in a source, whole. */
const docblocksIn = (src: string): string[] => src.match(/\/\*\*[\s\S]*?\*\//g) ?? []

const markerCount = (src: string): number => src.split(MARKER).length - 1

/** A newline without writing an escape into a source this suite also greps. */
const NL = String.fromCharCode(10)

describe("WR-02 — the three lookalike last_run_status fields, and the marker that binds them", () => {
  it("NON-VACUITY — the raw import actually delivered api.ts, before anything is counted", () => {
    // ⚠ A `?raw` import that resolves to the EMPTY STRING makes every count below read 0 and
    // every negative assertion pass. This project measured exactly that failure for CSS under
    // vitest (192.2-07), so the length and three known anchors are asserted FIRST, never last.
    expect(typeof apiSource).toBe("string")
    expect(apiSource.length).toBeGreaterThan(100_000)
    expect(apiSource).toContain("interface ThreadWorkflowState")
    expect(apiSource).toContain("interface PublishedWorkflow")
    expect(apiSource).toContain("interface WorkflowDraftRow")
  })

  it("there are EXACTLY three declarations — a recorded number, not a lower bound", () => {
    expect(declarationsIn(apiSource)).toHaveLength(EXPECTED_DECLARATIONS)
  })

  it("the marker appears EXACTLY three times — one per declaration", () => {
    expect(markerCount(apiSource)).toBe(EXPECTED_MARKERS)
  })

  it("declarations and markers AGREE — the invariant a silent fourth field would break", () => {
    expect(declarationsIn(apiSource)).toHaveLength(markerCount(apiSource))
  })

  it("⚠ THE TRAP, MEASURED — an unanchored count reads far more than three", () => {
    // Recorded rather than merely warned about: the docblocks discuss the field by name, so an
    // unanchored count is wrong by a large factor and rises with every future paragraph. If it
    // changes because prose was edited, the ANCHORED count is unaffected — that is the whole
    // point, and this case exists to keep the contrast visible rather than assumed.
    const naive = apiSource.split("last_run_status").length - 1
    expect(naive).toBeGreaterThan(EXPECTED_DECLARATIONS)
    expect(declarationsIn(apiSource)).toHaveLength(EXPECTED_DECLARATIONS)
  })

  it("each of the three cross-reference blocks names ALL THREE types, by TYPE NAME", () => {
    const blocks = docblocksIn(apiSource).filter((b) => b.includes(MARKER))
    expect(blocks).toHaveLength(EXPECTED_MARKERS)
    for (const block of blocks) {
      for (const type of TYPES) expect(block).toContain(type)
    }
  })

  it("each block also states that the two TIMESTAMP names are one column", () => {
    // The other half of WR-02. A cross-reference that names the status fields but leaves the
    // `last_run_created_at` / `last_run_at` divergence unsaid answers only half the question.
    const blocks = docblocksIn(apiSource).filter((b) => b.includes(MARKER))
    expect(blocks).toHaveLength(EXPECTED_MARKERS)
    for (const block of blocks) {
      expect(block).toContain("last_run_created_at")
      expect(block).toContain("last_run_at")
      expect(block).toContain("workflow_runs.created_at")
    }
  })
})

describe("WR-02 — SYNTHETIC POSITIVE CONTROLS (the detectors, run over a planted violation)", () => {
  /**
   * A source in the shape `api.ts` would take if a FOURTH interface gained the field without its
   * cross-reference: FOUR declarations, THREE markers. It also plants the two decoys the real
   * file now contains — the field named inside a JSDoc line, and inside a line comment.
   */
  const PLANTED = [
    "export interface A {",
    "  /** " + MARKER + " — mentions last_run_status?: string | null in PROSE, and must not count.",
    "   *  Names ThreadWorkflowState, PublishedWorkflow and WorkflowDraftRow. */",
    "  last_run_status?: string | null",
    "}",
    "export interface B {",
    "  /** " + MARKER + " */",
    "  last_run_status?: string | null",
    "}",
    "export interface C {",
    "  /** " + MARKER + " */",
    "  last_run_status?: string | null",
    "}",
    "export interface D {",
    "  // the fourth, added with no cross-reference: last_run_status?: string | null",
    "  last_run_status?: string | null",
    "}",
  ].join(NL)

  it("the DECLARATION detector counts 4 in the planted source — the prose mentions excluded", () => {
    // FOUR real declarations. The JSDoc mention and the line-comment mention are NOT counted: an
    // unanchored matcher would read 6 here and the mismatch case below would still pass, for the
    // wrong reason. This is the case that proves the anchor is doing work.
    expect(declarationsIn(PLANTED)).toHaveLength(4)
  })

  it("the MARKER detector counts 3 in the planted source", () => {
    expect(markerCount(PLANTED)).toBe(3)
  })

  it("⚠ THE CONTROL — the agreement invariant REPORTS THE MISMATCH on the planted source", () => {
    // The exact assertion made against the real file, run against a source that violates it.
    // It must FAIL there, so the honest way to state it here is that the two disagree by one.
    expect(declarationsIn(PLANTED).length).not.toBe(markerCount(PLANTED))
    expect(declarationsIn(PLANTED).length - markerCount(PLANTED)).toBe(1)
  })

  it("a DELETED marker is caught too — the other direction of the same fence", () => {
    const rewritten = PLANTED.replace(
      "/** " + MARKER + " */",
      "/** (this paragraph was rewritten away) */",
    )
    expect(markerCount(rewritten)).toBe(2)
    expect(declarationsIn(rewritten).length).not.toBe(markerCount(rewritten))
  })

  it("a block that stops naming all three types is caught", () => {
    const blocks = docblocksIn(PLANTED).filter((b) => b.includes(MARKER))
    expect(blocks).toHaveLength(3)
    // Block 0 names all three; blocks 1 and 2 name none — so the per-block naming assertion made
    // against the real file provably discriminates rather than passing on anything at all.
    const naming = blocks.map((b) => TYPES.filter((t) => b.includes(t)).length)
    expect(naming).toEqual([3, 0, 0])
  })
})
