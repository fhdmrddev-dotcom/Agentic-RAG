/**
 * Plan 193-01 Task 1 (D-08) — THE PRE-MOVE `WorkflowDoorSwitch` CHARACTERIZATION BASELINE.
 *
 * A NEW FILE, deliberately, rather than an append to `WorkflowDoorSwitch.test.tsx`: D-08's
 * whole property is that the capture commit modifies NO source file and NOTHING else, and a
 * new file makes `git diff --name-only` over that commit the proof rather than a promise.
 *
 * WHY A CAPTURE AND NOT AN EXPECTATION. Phase 193 does two things to this component. D-04/D-05
 * lift the govern door's `doorGroup` band out into `DoorHeaderStrip.tsx` (one component, BOTH
 * variants, `ml-auto` present iff NOT `inline`), and AUTH-01 moves the door COPY strings out
 * into `doorVocabulary.ts`. The phase's first contract on both moves is "the doors render
 * exactly what they rendered". The cheap wrong way to check that is to hand-type the DOM the
 * doors OUGHT to produce — which records only what its author believed the markup was, and
 * would ratify a move that changed the markup whenever the change happened to match the
 * belief. So this block CAPTURES the rendered DOM from the tree AS IT SHIPS.
 *
 * ⚠ THE BASELINE MUST PREDATE THE CHANGE. A baseline taken after the edit proves the edit
 * against itself. This is not a preference: it is Phase 188.1's most expensive measured
 * lesson, re-proved in 188.2, 192-06 and 192-08, and 188.2 discharged it by showing every
 * destination module answered "does not exist" at its capture commit. The same proof, run here
 * and RECORDED rather than asserted — both destination modules, verbatim output:
 *
 *     $ git rev-parse HEAD
 *     501b3c141d5a8e2b5cffc57f7e1b7ddfadba3406
 *     $ git show HEAD:frontend/src/components/workflows/DoorHeaderStrip.tsx
 *     fatal: path 'frontend/src/components/workflows/DoorHeaderStrip.tsx' does not exist
 *       in 'HEAD'                                                            [exit 128]
 *     $ git show HEAD:frontend/src/components/workflows/doorVocabulary.ts
 *     fatal: path 'frontend/src/components/workflows/doorVocabulary.ts' does not exist
 *       in 'HEAD'                                                            [exit 128]
 *
 * THIS PLAN MODIFIES NO SOURCE FILE. `git diff --name-only` over this commit lists exactly two
 * paths — this file and `scripts/vitest-count-gate.cjs` — and neither is under `frontend/src/**`
 * outside a `*.test.tsx`. A source edit inside the capture commit would destroy the very
 * property the capture exists to establish.
 *
 * ── WHAT IS AND IS NOT CLAIMED TO BE BYTE-IDENTICAL ─────────────────────────────────────
 *
 * THE RENDERED DOM must be byte-identical. THE MOVED SOURCE need not be byte-identical in its
 * surroundings: the `doorGroup` fragment becomes a component with a props signature, and the
 * copy strings become named exports read through an import — so the destination modules acquire
 * a module docblock, import lines and (for the strip) a wrapper. A diff-stat showing more
 * insertions than deletions on the destination side is therefore EXPECTED and is NOT evidence
 * of drift. A diff against the strings below is.
 *
 * ⚠ AND THE CONVERSE: a diff against these strings is a BEHAVIOUR CHANGE TO EXPLAIN, never a
 * test to update. Re-capturing them to make a red run green deletes the only evidence anybody
 * has that the doors still render what they rendered. `git diff --numstat` on this file must
 * show ZERO DELETIONS through waves 2-3 (T-193-02).
 *
 * ── WHAT IS NOT PINNED HERE, AND WHERE IT IS ────────────────────────────────────────────
 *
 * `WorkflowBuilderPage.header.test.tsx:~304` already holds `FLAG_OFF_HEADER_MARKUP`, a
 * byte-exact literal of the govern band captured in Phase 184.1 — NINE phases before this one,
 * which makes it a stronger predate than anything this phase can author. Wave 1 keeping it
 * green with ZERO edits is the primary proof; the two govern rows below are belt-and-braces.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act, fireEvent } from "@testing-library/react"

/**
 * The api seam, mocked exactly as `WorkflowDoorSwitch.test.tsx:26-37` and the ready-made
 * sketch harness (`.planning/sketches/164-telling-the-doors-apart/emit.test.tsx.src:19-30`)
 * already mock it — reused rather than reinvented. The govern door mounts the REAL
 * `WorkflowBuilderPage`, which fetches folders + skills on mount, so this set is the minimum
 * the two govern rows need to render offline.
 */
const { mockGenerateWorkflow, mockListFolders, mockListSkills, mockGroundingBundle } = vi.hoisted(
  () => ({
    mockGenerateWorkflow: vi.fn(),
    mockListFolders: vi.fn(),
    mockListSkills: vi.fn(),
    mockGroundingBundle: vi.fn(),
  }),
)
vi.mock("@/lib/api", () => ({
  // 204-03 (SCHED-01) — THE MEASURED MOCK BUDGET, SPENT IN THE COMMIT THAT ADDED THE EXPORTS.
  // A whole-module `vi.mock("@/lib/api")` factory that omits a newly-added RUNTIME export makes
  // every suite reaching it throw AT MOUNT, far from the cause: `196-08` cost 249 red tests
  // exactly this way. `WorkflowsPage` now mounts `WorkflowScheduleModal`, which imports these
  // six. They resolve to empty/no-op answers because no case here opens the schedules dialog —
  // their job is to EXIST.
  listSchedules: () => Promise.resolve([]),
  listWorkflowSchedules: () => Promise.resolve([]),
  createWorkflowSchedule: () => Promise.resolve({}),
  updateSchedule: () => Promise.resolve({}),
  deleteSchedule: () => Promise.resolve(undefined),
  triggerSchedule: () => Promise.resolve({ launched: false }),
  generateWorkflow: mockGenerateWorkflow,
  createWorkflowDraft: vi.fn(),
  updateWorkflowDraft: vi.fn(),
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  // ⚠ ONE MEMBER BEYOND THE SKETCH HARNESS'S SET, and it is not optional: with the canvas
  // gate ON (which the three `inline` rows require — see `canvasOn` below) the Builder's
  // hosted header mounts `useGroundingBundle`, whose `getGroundingBundle(…)` call throws
  // *"No `getGroundingBundle` export is defined on the `@/lib/api` mock"* at mount and takes
  // the whole capture with it. Resolved to the same empty bundle the four shipped
  // `WorkflowBuilderPage.*` suites use, so nothing about the capture is invented here.
  getGroundingBundle: mockGroundingBundle,
  // 196-08 (AUTH-04) — a SECOND member beyond the sketch harness's set, arriving for exactly
  // the reason the comment above records for the first: the hosted Builder now reads the author
  // model registry at mount, and an undeclared export throws there rather than returning
  // undefined. The stub is an empty registry; these rows are about the door, not the picker.
  getAuthorModelRegistry: () => Promise.resolve({ models: [], run_default_model: null }),
  // 214-13 (STEP-06) — THE DESCRIBE DOOR NOW MOUNTS `DescribeServicePicker`, WHICH READS THIS.
  //
  // ⚠ IT IS NOT OPTIONAL AND ITS ABSENCE IS NOT LOUD, WHICH IS WHY IT IS DECLARED HERE IN THE
  // COMMIT THAT ADDED THE MOUNT. The picker's read is wrapped in the shipped best-effort
  // `try/catch`, so an undeclared export does NOT throw a visible *"No export is defined on the
  // @/lib/api mock"* — it is SWALLOWED, and the picker silently renders its "we could not ask"
  // arm. A capture taken in that state would pin an error arm as though it were the resting
  // one. That is the 196-08 mock-budget trap wearing a disguise: measured here rather than
  // predicted. Resolved to an empty list, which is the picker's honest EMPTY arm.
  listConnectorConnections: () => Promise.resolve([]),
}))

import { WorkflowDoorSwitch, type WorkflowDoorSwitchProps } from "./WorkflowDoorSwitch"
// Phase 193-08: the marker rows below name the door words. They READ them off the vocabulary
// module rather than re-typing them — a re-typed word here would be the second home D-11
// removes, and would go stale silently the next time the copy is re-worded.
import { DOOR_A_NAME, DOOR_B_NAME, STRIP_BACK, STRIP_LABEL_GOVERN } from "./doorVocabulary"

/** The capture commit, recorded so the proof in the docblock is re-runnable rather than believed. */
const CAPTURE_SHA = "501b3c141d5a8e2b5cffc57f7e1b7ddfadba3406"

/**
 * The host's band content, as a FIXED deterministic node. A `vi.fn()`-driven or date-bearing
 * lead would make the capture a sample of something that varies; this one renders the same
 * bytes on every run, which is what lets `inline` rows be compared byte for byte at all.
 */
const HOST_LEAD = (
  <nav data-testid="host-lead" aria-label="breadcrumb">
    &lt; Workflows
  </nav>
)

/** A no-op observer hook. A plain function, not a `vi.fn()`: `beforeEach` clears mocks, and a
 *  row whose behaviour lived in a mock implementation would be one `clearAllMocks` away from
 *  capturing a different state than the one its key names. */
const noopDescribeDraft = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
  mockGroundingBundle.mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] })
  mockGenerateWorkflow.mockResolvedValue({ ok: true, definition: { slug: "vendor-risk", phases: [] } })
})

type CaptureRow = {
  /** The props the door is rendered with. */
  props: WorkflowDoorSwitchProps
  /** The door root this state paints, asserted present before the DOM is read. */
  root: "workflow-doors" | "door-describe" | "door-govern"
  /**
   * Drives the REAL `useCanvasGate` through the REAL `EffectiveFeaturesProvider` — no module
   * mock, no `app_settings` flip.
   *
   * ⚠ THIS FIELD IS NOT DECORATION, AND THE REASON IS MEASURED. `inline` is never a free
   * choice: `WorkflowsPage` evaluates the ONE shared gate rule and passes the answer down, so
   * `inline` is set IF AND ONLY IF the canvas gate is on. It is mirrored here rather than
   * assumed because the govern door hands its door group to the Builder as `headerTrail`, and
   * the Builder hosts that merged row only when `canvasEnabled && (lead ?? trail)`
   * (`WorkflowBuilderPage.tsx`, `preDraftHeaderHosted`). Captured with the gate OFF, the
   * `GOVERN_INLINE` row renders the describe screen with NO door group at all — measured at
   * 1400 bytes carrying neither `both-doors` nor `judge-locked` — and its
   * `not.toContain("ml-auto")` assertion would then pass because nothing was rendered, not
   * because the branch is right. That is a fence that cannot fire (the 192.1 lesson), so the
   * gate is driven ON for exactly the rows the app sets `inline` for.
   */
  canvasOn: boolean
}

/**
 * ONE render → settle → read → unmount, shared by the capture and by the assertion.
 *
 * A second helper is exactly how a capture and the assertion that guards it drift apart: the
 * assertion would then be measuring a render nobody captured. Every string in
 * `DOOR_HTML_BASELINE` below came out of this function, and every `expect` below calls this
 * same function.
 *
 * The whole `container.innerHTML` is read (the 192-03 default), never a subtree: the door
 * ROOT's own attributes are part of what the phase must not change, and a subtree read would
 * be blind to them.
 */
async function doorCapture(row: CaptureRow): Promise<string> {
  // The REAL provider carrying the REAL `useCanvasGate` — reached through a dynamic import
  // (the shipped `RunModal.test.tsx:408` idiom) so the gate is exercised through the shipped
  // code path rather than around it.
  const { EffectiveFeaturesProvider } = await import("@/providers/EffectiveFeaturesProvider")
  const rendered = render(
    <EffectiveFeaturesProvider
      value={{
        features: row.canvasOn ? { visual_workflow_canvas: true } : {},
        loading: false,
        refetch: () => {},
      }}
    >
      <WorkflowDoorSwitch {...row.props} />
    </EffectiveFeaturesProvider>,
  )
  // The door root must exist before anything is read — otherwise an empty capture would be
  // indistinguishable from a component that failed to mount (T-193-03).
  await screen.findByTestId(row.root)
  // Let the govern door's Builder settle its mount fetches, so what is captured is a RESTING
  // state rather than a race. Harmless for the four rows that mount no Builder.
  await act(async () => {
    await Promise.resolve()
  })
  const html = rendered.container.innerHTML
  rendered.unmount()
  return html
}

/**
 * The SIX render states, declared ONCE so the props the baseline was captured from and the
 * props the assertion renders cannot diverge.
 *
 *   · CHOOSER_STANDALONE  — the default "both" chooser, no `inline`: what a fresh Create lands on.
 *   · CHOOSER_INLINE      — `inline` + `headerLead`: exercises the chooser's adopted breadcrumb band.
 *   · DESCRIBE_STANDALONE — the loose door's own surface, its own band.
 *   · DESCRIBE_INLINE     — exercises `{inline && headerLead}` inside the describe band.
 *   · GOVERN_STANDALONE   — ⚠ THE `ml-auto` PRESENT BRANCH. The band is this shell's own, and
 *                           `ml-auto` is what pushes the judge badge to the far edge.
 *   · GOVERN_INLINE       — ⚠ THE `ml-auto` ABSENT BRANCH, via `headerTrail` into the Builder's
 *                           merged row, where the class would open a gap instead.
 *
 * Rows 5 and 6 are the load-bearing pair: they are the only two that differ by exactly the D-05
 * class conditional, and a baseline missing either cannot detect the `ml-auto` regression D-05
 * warns about.
 */
const DOOR_HTML_ROWS: Record<string, CaptureRow> = {
  CHOOSER_STANDALONE: {
    props: { onDescribeDraft: noopDescribeDraft },
    root: "workflow-doors",
    canvasOn: false,
  },
  CHOOSER_INLINE: {
    props: { onDescribeDraft: noopDescribeDraft, inline: true, headerLead: HOST_LEAD },
    root: "workflow-doors",
    canvasOn: true,
  },
  DESCRIBE_STANDALONE: {
    props: { onDescribeDraft: noopDescribeDraft, initialDoor: "describe" },
    root: "door-describe",
    canvasOn: false,
  },
  DESCRIBE_INLINE: {
    props: {
      onDescribeDraft: noopDescribeDraft,
      initialDoor: "describe",
      inline: true,
      headerLead: HOST_LEAD,
    },
    root: "door-describe",
    canvasOn: true,
  },
  GOVERN_STANDALONE: {
    props: { initialDoor: "govern" },
    root: "door-govern",
    canvasOn: false,
  },
  GOVERN_INLINE: {
    props: { initialDoor: "govern", inline: true, headerLead: HOST_LEAD },
    root: "door-govern",
    canvasOn: true,
  },
}

/**
 * ⚠ THIS LITERAL IS A CAPTURE, NOT AN EXPECTATION. Every character below was READ OUT of the
 * rendered DOM by running `doorCapture` above and writing what it produced into this file by
 * SUBSTITUTION. Not one attribute here was typed from the source, computed by hand, or
 * reasoned about.
 *
 * OBSERVED TWICE and the two runs agreed byte for byte — so it is a baseline rather than one
 * sample of something that might vary. These doors read no clock, no randomness and no
 * measurement API, so a capture that differed between two runs would be a REAL FINDING to
 * report and not flake to re-roll.
 *
 * ── ⚠ RE-CAPTURED ONCE, DELIBERATELY, BY PLAN `193-08` ON 2026-08-13 ────────────────────
 *
 * The six strings were originally captured at `CAPTURE_SHA`, before `DoorHeaderStrip.tsx` and
 * `doorVocabulary.ts` existed. THEY WERE RE-CAPTURED FROM THE RENDERED TREE IN `193-08` — by
 * the same `doorCapture` driver, twice, agreeing byte for byte again — and here is the whole
 * reason, stated rather than absorbed:
 *
 *  • WHY IT IS LEGITIMATE NOW. `193-03` (the strip move) and `193-05` (the copy move) BOTH
 *    passed with these six literals GREEN AND UNEDITED — `git diff --numstat` over this file
 *    EMPTY across both waves. That is the proof those two waves were verbatim moves, and it is
 *    a proof that could only ever be collected BEFORE a word changed. `193-08` is the first
 *    plan in the phase that intentionally changes a RENDERED WORD (variant D, D-01), so these
 *    literals have already discharged the purpose the docblock above sets for them.
 *
 *  • WHAT CHANGED: THE WORDS ONLY, and it is measured rather than asserted. Old and new were
 *    compared with tags-vs-text separated: `structure identical: true` for all six rows — every
 *    tag, class list, `data-testid`, `title`, `style` and the `ml-auto` conditional byte-for-byte
 *    unchanged — and the text-node slot COUNT unchanged in every row (43/43, 47/47, 71/71,
 *    73/73, 39/39, 53/53). Only 10 / 10 / 8 / 8 / 2 / 2 text nodes differ, and each difference
 *    is one governed id moving from column A to column D.
 *
 *  • ⚠ THIS IS RE-CAPTURE **ONE OF TWO**. `193-09`'s D-04/D-22 restack will red these same six
 *    again — on STRUCTURE rather than on words, which is exactly the difference this note makes
 *    checkable. Both are legitimate; both must be stated. A third re-capture in this phase, or
 *    any re-capture whose diff shows a tag difference the plan did not name, is a behaviour
 *    change to explain and not a test to update.
 *
 *  • ⚠ AND ONE THING THE DIFF EXPOSES THAT IS **NOT** THIS PHASE'S TO FIX. In both GOVERN rows
 *    only the two strip nodes changed: the Builder's own describe screen still reads its
 *    column-A words, because `WorkflowBuilderPage.tsx` holds a SECOND, UNGOVERNED copy of the
 *    CTA and the three hint fragments that `193-05` never moved and no plan in this phase owns.
 *    It is visible right here in `GOVERN_STANDALONE`. See `193-08-SUMMARY.md` § Deferred.
 *    ⚠⚠ **THIS BULLET IS NOW FALSE OF THE LITERALS BELOW — 193 REVIEW WR-02.** It is kept, not
 *    deleted, because it is the RECORD OF WHY the third re-capture happened. The operator took
 *    the fix (`294a2ac8`): the page now renders `DESCRIBE_CTA` / `DESCRIBE_H1` / `HINT_FRAG1-3`
 *    by id, so both GOVERN rows read variant D end to end and there is no second home left.
 *
 * ── ⚠ RE-CAPTURED A SECOND AND FINAL TIME BY PLAN `193-09` ON 2026-08-13 ────────────────
 *
 * The note above promised this one and named what it would be. It is here, and it is the
 * **STRUCTURE** re-capture: D-04 demoted the govern strip's return control and inserted a
 * decorative rule beside it, D-22 demoted the describe band's control identically, and both
 * are visible in the tags below. Same `doorCapture` driver, run twice, agreeing byte for byte
 * again, substituted in by an ENCODER THAT WAS VALIDATED FIRST — re-stringifying all six OLD
 * literals had to reproduce this file's own bytes exactly before one new byte was written.
 *
 *  • WHAT CHANGED — THE STRUCTURE ONLY, and it is the exact complement of `193-08`'s proof.
 *    Old vs new compared with tags and text separated:
 *
 *      | capture             | tag deltas                          | non-empty text nodes |
 *      |---------------------|-------------------------------------|----------------------|
 *      | CHOOSER_STANDALONE  | NONE — literal untouched            | 16 → 16, identical   |
 *      | CHOOSER_INLINE      | NONE — literal untouched            | 17 → 17, identical   |
 *      | DESCRIBE_STANDALONE | 1 return-control class list         | 24 → 24, identical   |
 *      | DESCRIBE_INLINE     | 1 return-control class list         | 25 → 25, identical   |
 *      | GOVERN_STANDALONE   | 1 class list + 1 INSERTED rule span | 14 → 14, identical   |
 *      | GOVERN_INLINE       | 1 class list + 1 INSERTED rule span | 16 → 16, identical   |
 *
 *    ⚠ READ THE TEXT COLUMN LITERALLY: in ALL SIX rows the sequence of non-empty text nodes is
 *    IDENTICAL, element for element. Not one rendered WORD moved. A naive index-wise diff of
 *    the raw `split(/<[^>]*>/)` slots reports ~21 "changed" nodes in the two GOVERN rows, and
 *    every one of those is the INDEX SHIFT caused by inserting a node — which is precisely the
 *    artefact that would let a real word change hide inside a structural re-capture, so it is
 *    measured as a sequence rather than by position.
 *
 *  • THE TWO CHOOSER LITERALS WERE NOT RE-WRITTEN AT ALL (`git diff --numstat` on this file:
 *    4 changed lines, not 6). The chooser has no escape hatch to demote, so it has nothing to
 *    say here — and a re-capture that touched it anyway would have been the tell.
 *
 *  • ⚠ THIS IS RE-CAPTURE **TWO OF TWO**, AND THE PHASE EXPECTS NO THIRD. `193-08` changed the
 *    words; `193-09` changed the structure. Any further re-capture of these six is a behaviour
 *    change to explain in its own plan, not a test to update — and the two notes above now give
 *    the next author a worked example of what "explain" has to look like.
 *
 * ── ⚠ RE-CAPTURED A **THIRD** TIME BY THE 193 FAST-FIX (`294a2ac8`) — 193 REVIEW WR-02 ──────
 *
 * The note directly above said the phase expected no third. **It got one.** This is the
 * explanation that note demanded, added after the fact because the fast-fix made the edit
 * SILENTLY — which is the actual defect. The instrument's entire value is that a re-capture
 * must be stated; an unstated one turns a proof into a habit.
 *
 *  • WHAT CHANGED: **THE WORDS ONLY**, and only in the two GOVERN rows. Measured with whole TAG
 *    TOKENS (attributes included) and text nodes separated: tags **40/40 and 54/54 IDENTICAL**,
 *    text nodes 14/14 and 16/16 with exactly **THREE differing each** — the page's CTA and its
 *    two hint fragments moving to column D. The four other literals were not rewritten at all.
 *
 *  • WHY IT HAPPENED: the bullet in the FIRST note records that `WorkflowBuilderPage.tsx` held a
 *    second, ungoverned copy of those strings. The operator chose fix-now over defer, so the page
 *    now renders them by id and both GOVERN rows read variant D end to end. **That earlier bullet
 *    is now false of the literals below and is marked as such in place, not deleted** — it is the
 *    record of the cause.
 *
 *  • ⚠ SO THE CONTRACT IS RESTATED, NOT ABANDONED: this is re-capture **THREE OF THREE**, and a
 *    FOURTH is a behaviour change to explain in its own plan. The lesson the third one teaches is
 *    narrower and worth more than the count: **a re-capture made inside a commit whose stated
 *    claim is "words only" must still say so HERE**, because this docblock — not the commit
 *    message — is what the next author reads.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * ⚠ RE-CAPTURE **1 of 1 FOR PHASE 193.1** (the FOURTH on this file overall) — DECLARED,
 *   DATED, REASONED, AND CARRYING A CORRECTION TO THE PLAN THAT ORDERED IT.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * **Date:** 2026-08-15. **Plan:** `193.1-08`. **Reason:** under D-24 the AUTH-03 pre-draft
 * template row mounts on BOTH describe screens — the loose door's, in this file, and the govern
 * door's, in `WorkflowBuilderPage.tsx`. Four of the six captures render one of those screens, so
 * four of the six had to move.
 *
 * ⚠ **THE PLAN SAID TWO ROWS WOULD MOVE. MEASURED, FOUR DO — AND THE PLAN'S REASON FOR
 * EXPECTING TWO IS WHERE IT WENT WRONG, SO IT IS CORRECTED HERE BESIDE THE CLAIM RATHER THAN
 * OVER IT.** `193.1-08-PLAN.md` says: *"⚠ The `GOVERN_*` rows must NOT move — nothing in this
 * plan touches the govern door's own markup."* The first half is false and the second half is
 * TRUE: this plan changes not one byte of the govern door's own band. But **the govern door IS
 * the Builder** (`WorkflowDoorSwitch.tsx:182-223` returns `<WorkflowBuilderPage>`), and these are
 * whole-`container.innerHTML` captures — so both `GOVERN_*` strings contain the Builder's
 * `describeScreen` inline, and that screen gained the same row in this plan's Task 1. A capture
 * of a component that DELEGATES sees its delegate's markup; "I did not touch the band" is not the
 * same claim as "the capture cannot move".
 *
 * **WHAT MOVED, MEASURED RATHER THAN ASSERTED.** Longest-common-prefix/suffix against the
 * previous literals, per row:
 *
 *     row                  length          tags        removed
 *     CHOOSER_STANDALONE   2166 → 2166     42 → 42     ""   ← NOT REWRITTEN
 *     CHOOSER_INLINE       2315 → 2315     46 → 46     ""   ← NOT REWRITTEN
 *     DESCRIBE_STANDALONE  3610 → 4625     70 → 81     ""
 *     DESCRIBE_INLINE      3683 → 4698     72 → 83     ""
 *     GOVERN_STANDALONE    2325 → 3340     40 → 51     ""
 *     GOVERN_INLINE        3077 → 4092     54 → 65     ""
 *
 * **EVERY MOVED ROW IS A PURE INSERTION** — `removed: ""` on all four, so not one previously
 * captured byte was dropped: no word changed, no class changed, no node was re-parented. And the
 * inserted span is the **IDENTICAL 1015 characters / 11 tags in all four**, which is itself the
 * evidence that D-24 shipped ONE component mounted twice rather than two similar controls. The
 * same 1015/11 appears in all six rows of `WorkflowBuilderPage.preDraft.baseline.test.tsx`.
 *
 * **THE TWO CHOOSER LITERALS WERE NOT REWRITTEN AT ALL** — they render neither describe screen,
 * so a re-capture that touched them would have been the tell. `git diff` on this file shows
 * exactly four changed literal lines.
 *
 * ⚠ **NOTHING WAS RAISED, LOWERED OR REMOVED TO MAKE A CAPTURE PASS.** No absence assertion was
 * touched; every marker row, the `ml-auto` D-05 pair, the host-band difference rows and the
 * chooser rows are byte-unchanged. Observed TWICE, agreeing byte for byte, by this file's own
 * `doorCapture` driver.
 *
 * **AND THE CONTRACT IS RESTATED, NOT SPENT:** a FIFTH re-capture is a behaviour change to
 * explain in its own plan, not a test to update.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * ⚠ RE-CAPTURE **1 of 1 FOR SKETCH 200** (the FIFTH on this file overall) — THE ONE THE
 *   NOTE DIRECTLY ABOVE SAID WOULD NEED ITS OWN EXPLANATION. HERE IT IS.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * **Date:** 2026-08-20. **Driver:** the sketch-200 port of `doors.html`.
 *
 * ── ⚠ FIRST, THE POSTURE THIS FILE HELD, AND WHO OVERRULED IT ────────────────────────
 *
 * This pin's standing instruction — stated four times above, and correct every previous time
 * it was applied — is that a red here is *"a BEHAVIOUR CHANGE TO EXPLAIN, never a test to
 * update"*. It was enforced at its strongest by plan `199-03`, which **WITHDREW A COMPLETED
 * CHANGE** rather than re-baseline these strings: a finished re-tone of the soul preview was
 * reverted because it would have moved `<WorkflowSoul scale="card" />` inside these captures.
 * That is the posture, and it is recorded here rather than paraphrased because it is the thing
 * being set aside.
 *
 * **THE OPERATOR HAS OVERRULED IT, EXPLICITLY, BY NAMING SKETCH 200 AS THE ABSOLUTE
 * REFERENCE FOR THIS SURFACE.** Where a shipped pin and the sheet disagree, the sheet now
 * wins — the reverse of the rule `199-03` followed. So this re-capture is AUTHORISED, and the
 * authorisation is written down here rather than living in a commit message, because this
 * docblock is what the next author reads.
 *
 * ⚠ **WHAT IS *NOT* AUTHORISED, AND HAS NOT HAPPENED:** re-baselining to make a red go green.
 * Every moved byte below is accounted for against a drawn element of the sheet. A future red
 * whose diff cannot be accounted for that way is still a behaviour change to explain.
 *
 * ── SECOND, WHAT MOVED — MEASURED, PER ROW, NOT ASSERTED ─────────────────────────────
 *
 * Longest-common-prefix/suffix against the previous literals, by this file's own `doorCapture`
 * driver:
 *
 *     row                  length          tags        verdict
 *     CHOOSER_STANDALONE   2166 → 3219     21 → 29     RESTRUCTURED (the sheet's column)
 *     CHOOSER_INLINE       2315 → 3368     23 → 31     RESTRUCTURED (idem + the host band)
 *     DESCRIBE_STANDALONE  4625 → 5026     41 → 47     RESTRUCTURED (the sheet's column)
 *     DESCRIBE_INLINE      4698 → 5099     42 → 48     RESTRUCTURED (idem + the host band)
 *     GOVERN_STANDALONE    3340 → 3340     26 → 26     ⚠ UNCHANGED BUT FOR A `useId` COUNTER
 *     GOVERN_INLINE        4092 → 4092     33 → 33     ⚠ UNCHANGED BUT FOR A `useId` COUNTER
 *
 * **THE FOUR RESTRUCTURED ROWS** are the port: the chooser drops its bordered header band for
 * a centred `max-w-[720px]` column with a 32px heading; its door cards become the sheet's
 * header-row-over-paragraph shape with the tier in the sheet's chip slot and the note behind a
 * hover/focus disclosure; the describe screen drops the `lg:grid-cols-[1fr_320px]` split for
 * the same single column, binds its heading to the box as a `label`, takes the sheet's
 * textarea metrics, right-aligns the CTA, and puts hairlines between the box, the knowledge
 * question and the template question.
 *
 * ── ⚠ THIRD, AND THIS IS THE FINDING WORTH MORE THAN THE RE-CAPTURE ITSELF ───────────
 *
 * **THE TWO `GOVERN_*` ROWS DID NOT CHANGE.** Same length to the byte, same tag count, and the
 * longest-common-prefix/suffix diff on each is **103 characters wide and contains exactly one
 * moving part**: React's `useId` counter, `_r_2_` → `_r_7_` and `_r_3_` → `_r_9_`, on the
 * template row's `label for` / `input id` pair. Not one class, not one word, not one node.
 *
 * That is a MEASUREMENT rather than a claim, and it discharges the thing a whole-container
 * capture exists to catch. `193.1-08` recorded the trap in its own note: the govern door IS
 * the Builder, so these strings contain the Builder's `describeScreen` inline and *"I did not
 * touch the band" is not the same claim as "the capture cannot move"*. Here the capture really
 * did not move — and the reason the two literals still had to be rewritten is that this
 * component now calls `useId` before the Builder does, which shifts an opaque counter in a
 * subtree nobody edited.
 *
 * ⚠ **SO THE `GOVERN_*` REWRITE IS THE ONE LINE IN THIS RE-CAPTURE THAT CARRIES NO DESIGN
 * INTENT AT ALL**, and it is flagged rather than folded in with the other four: if a later
 * reader diffs these two rows expecting to find the port, they will find a counter. The port
 * is in the other four.
 *
 * ── FOURTH, WHAT WAS NOT TOUCHED ─────────────────────────────────────────────────────
 *
 * No absence assertion was weakened; no marker row was removed; the `ml-auto` D-05 pair, the
 * host-band difference rows and the `classListOf` positive control are byte-unchanged and all
 * still run against the new literals. `<WorkflowSoul def={previewDef} scale="card" />` is
 * itself UNCHANGED — the element `199-03` withdrew a change rather than disturb is moved from
 * a 320px aside to the last section of the column and is otherwise identical, which is why the
 * soul subtree appears verbatim inside the two new `DESCRIBE_*` strings.
 *
 * **AND THE CONTRACT IS RESTATED ONCE MORE, NOT SPENT:** a SIXTH re-capture needs its own
 * authorisation and its own measurement. The operator's ruling covers sketch 200's port of
 * this surface; it is not a standing licence.
 *
 * ── ⚠ THE SIXTH RE-CAPTURE — 200-WIRE, AND IT IS NARROWER THAN THE FIVE ABOVE ──────────
 *
 * **WHAT CHANGED, EXACTLY:** the two `DESCRIBE_*` rows gained ONE fragment, spliced between
 * `</section>` (the template row's close) and `<div data-testid="switch-strip"` — a hairline
 * `<div aria-hidden="true" class="h-px w-full bg-border">` and the `starter-door-trigger`
 * button's resting line. **Nothing else in either string moved by a byte**, which is checkable
 * without trusting this sentence: diff the two rows against their predecessor and the only
 * hunk is that insertion. `CHOOSER_*` and `GOVERN_*` are UNTOUCHED.
 *
 * **WHY, AND WHY IT IS NOT A REGRESSION BEING HIDDEN.** `doors.html:307-319` draws a starter
 * shelf on this door — *"Start from something that already works"* — and the port that
 * captured these strings did not render it. It was not among that port's seven recorded
 * refusals; it was simply absent, so these captures pinned a surface that was short one whole
 * section and could never have said so. The control mounted here is the SHIPPED
 * `StarterTemplatePicker`, already mounted on the govern door (it appears verbatim inside the
 * untouched `GOVERN_INLINE` row below — which is the cheapest available proof that this
 * fragment is a MOUNT and not a new component: the same bytes were already in this file).
 *
 * **WHAT THE RE-CAPTURE DOES NOT COVER.** It is authorised for the omission above and for
 * nothing else. `<WorkflowSoul def={previewDef} scale="card" />` is once again byte-unchanged
 * inside both rows — 200-WIRE widened that component's `needs` line to render an AUTHORED
 * input label where a definition carries one, and a draft preview carries no `inputs[]` at
 * all, so the soul subtree renders `kickoff_prompt` in the identical mono treatment it always
 * did. That the soul appears verbatim here is therefore EVIDENCE about the widening, not an
 * exemption from it. A SEVENTH re-capture still needs its own authorisation.
 *
 * ── ⚠ THE SEVENTH RE-CAPTURE — 214-13 (STEP-06 / D-214-20). AUTHORISED, MEASURED, AND ITS
 *    BEFORE/AFTER DIFF READ BEFORE ANYTHING WAS REGENERATED ───────────────────────────────
 *
 * THE ONE AUTHORISED CHANGE: the describe door gains `<DescribeServicePicker />` and the
 * hairline rule that separates it from the section above, between the knowledge picker and the
 * template row. That is a MOUNT, and it is the whole of what the two DESCRIBE rows may differ
 * by.
 *
 * **THE DIFF, MEASURED RATHER THAN CLAIMED** — every row compared to its committed predecessor
 * with `difflib.SequenceMatcher` and the opcode list read verbatim:
 *
 *   row                    before   after   delta   identical
 *   CHOOSER_STANDALONE       3218    3218      +0   true
 *   CHOOSER_INLINE           3367    3367      +0   true
 *   DESCRIBE_STANDALONE      5502    6228    +726   false
 *   DESCRIBE_INLINE          5575    6301    +726   false
 *   GOVERN_STANDALONE        3339    3339      +0   true
 *   GOVERN_INLINE            4091    4091      +0   true
 *
 * ⭐ FOUR OF THE SIX ARE BYTE-IDENTICAL, and the two that moved contain **exactly one opcode
 * that is not `equal`, and it is an `insert`** — zero `replace`, zero `delete`. Nothing that
 * was rendered before is altered or removed; 726 bytes of new section arrive at one point in
 * each. That shape is the evidence: a re-capture that had quietly changed something else would
 * show a `replace` opcode, and this one does not.
 *
 * ⚠ AND THE COLOUR RULING CHANGED NOTHING HERE — WHICH CORRECTS THE PREDICTION THAT SENT THIS
 * PLAN LOOKING. `doorVocabulary.ts`'s colour section warns that unifying the refusal's tone on
 * the WARNING token *"RE-BASELINES `WorkflowDoorSwitch.baseline.test.tsx`, WHICH PINS ALL SIX
 * RESTING STATES BYTE FOR BYTE"*. Measured: `destructive` occurs **zero** times across all six
 * captures BEFORE the change and zero times after, because the refusal never renders at rest.
 * The ruling was applied in full — the swap is real in `WorkflowDoorSwitch.tsx` and asserted in
 * `WorkflowDoorSwitch.test.tsx` — and it is invisible to this file. **Sketch 217 invariant #1
 * is therefore confirmed by the diff rather than merely asserted**, and the thing that actually
 * forced this re-capture is the MOUNT.
 *
 * An EIGHTH re-capture still needs its own authorisation.
 */
const DOOR_HTML_BASELINE: Record<string, string> = {
  CHOOSER_STANDALONE: "<div data-testid=\"workflow-doors\" class=\"flex h-full flex-col bg-background\"><div class=\"min-h-0 flex-1 overflow-y-auto px-4 py-8\"><div class=\"mx-auto flex w-full max-w-[720px] flex-col gap-8\"><header class=\"flex flex-col gap-1\"><h1 class=\"text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground\">How do you want to start?</h1><p class=\"text-[16px] leading-[1.6] text-muted-foreground\">Both end up in the same place. You can switch between them at any time.</p></header><section class=\"grid gap-4 sm:grid-cols-2\"><button type=\"button\" data-testid=\"door-card-describe\" class=\"group relative flex flex-col gap-2 overflow-hidden rounded border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary hover:border-primary/60\"><div class=\"flex items-start justify-between gap-2\"><div class=\"flex items-center gap-2\"><span aria-hidden=\"true\" class=\"text-[20px] leading-none text-primary\">⚡</span><h2 class=\"text-[18px] font-semibold leading-[1.4] text-foreground\">Draft it for me</h2></div><span class=\"shrink-0 rounded-sm border px-2 py-1 font-mono text-[12px] leading-[1.4] border-primary/20 bg-primary/10 text-primary\">you write one paragraph</span></div><p class=\"text-[14px] leading-[1.5] text-muted-foreground\">Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.</p><span class=\"flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100\"><span class=\"text-[13px] font-medium text-primary\">Open <span aria-hidden=\"true\">›</span></span><span class=\"text-[11px] italic text-muted-foreground\">you can open the full editor at any point — nothing is locked in</span></span></button><button type=\"button\" data-testid=\"door-card-govern\" class=\"group relative flex flex-col gap-2 overflow-hidden rounded border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary hover:border-accent-violet/60\"><div class=\"flex items-start justify-between gap-2\"><div class=\"flex items-center gap-2\"><span aria-hidden=\"true\" class=\"text-[20px] leading-none text-accent-violet\">🔧</span><h2 class=\"text-[18px] font-semibold leading-[1.4] text-foreground\">Build it myself</h2></div><span class=\"shrink-0 rounded-sm border px-2 py-1 font-mono text-[12px] leading-[1.4] border-accent-violet/20 bg-accent-violet/10 text-accent-violet\">you decide every setting</span></div><p class=\"text-[14px] leading-[1.5] text-muted-foreground\">Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step.</p><span class=\"flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100\"><span class=\"text-[13px] font-medium text-accent-violet\">Open <span aria-hidden=\"true\">›</span></span><span class=\"text-[11px] italic text-muted-foreground\">what it must cite · required checks · per-step sources &amp; model</span></span></button></section></div></div></div>",
  CHOOSER_INLINE: "<div data-testid=\"workflow-doors\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><nav data-testid=\"host-lead\" aria-label=\"breadcrumb\">&lt; Workflows</nav></div><div class=\"min-h-0 flex-1 overflow-y-auto px-4 py-8\"><div class=\"mx-auto flex w-full max-w-[720px] flex-col gap-8\"><header class=\"flex flex-col gap-1\"><h1 class=\"text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground\">How do you want to start?</h1><p class=\"text-[16px] leading-[1.6] text-muted-foreground\">Both end up in the same place. You can switch between them at any time.</p></header><section class=\"grid gap-4 sm:grid-cols-2\"><button type=\"button\" data-testid=\"door-card-describe\" class=\"group relative flex flex-col gap-2 overflow-hidden rounded border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary hover:border-primary/60\"><div class=\"flex items-start justify-between gap-2\"><div class=\"flex items-center gap-2\"><span aria-hidden=\"true\" class=\"text-[20px] leading-none text-primary\">⚡</span><h2 class=\"text-[18px] font-semibold leading-[1.4] text-foreground\">Draft it for me</h2></div><span class=\"shrink-0 rounded-sm border px-2 py-1 font-mono text-[12px] leading-[1.4] border-primary/20 bg-primary/10 text-primary\">you write one paragraph</span></div><p class=\"text-[14px] leading-[1.5] text-muted-foreground\">Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.</p><span class=\"flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100\"><span class=\"text-[13px] font-medium text-primary\">Open <span aria-hidden=\"true\">›</span></span><span class=\"text-[11px] italic text-muted-foreground\">you can open the full editor at any point — nothing is locked in</span></span></button><button type=\"button\" data-testid=\"door-card-govern\" class=\"group relative flex flex-col gap-2 overflow-hidden rounded border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary hover:border-accent-violet/60\"><div class=\"flex items-start justify-between gap-2\"><div class=\"flex items-center gap-2\"><span aria-hidden=\"true\" class=\"text-[20px] leading-none text-accent-violet\">🔧</span><h2 class=\"text-[18px] font-semibold leading-[1.4] text-foreground\">Build it myself</h2></div><span class=\"shrink-0 rounded-sm border px-2 py-1 font-mono text-[12px] leading-[1.4] border-accent-violet/20 bg-accent-violet/10 text-accent-violet\">you decide every setting</span></div><p class=\"text-[14px] leading-[1.5] text-muted-foreground\">Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step.</p><span class=\"flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100\"><span class=\"text-[13px] font-medium text-accent-violet\">Open <span aria-hidden=\"true\">›</span></span><span class=\"text-[11px] italic text-muted-foreground\">what it must cite · required checks · per-step sources &amp; model</span></span></button></section></div></div></div>",
  DESCRIBE_STANDALONE: "<div data-testid=\"door-describe\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span class=\"text-[13px] font-medium text-foreground\">⚡ Drafting it for you</span></div><div class=\"min-h-0 flex-1 overflow-y-auto px-4 py-8\"><div class=\"mx-auto flex w-full max-w-[720px] flex-col gap-8\"><div class=\"flex flex-col gap-2\"><label for=\"_r_2_\" class=\"font-mono text-[14px] leading-[1.4] text-foreground\">What recurring work should this automate?</label><textarea id=\"_r_2_\" aria-label=\"business requirement\" data-testid=\"describe-box\" placeholder=\"Describe the steps…\" rows=\"5\" class=\"w-full resize-y rounded border border-border bg-card p-4 text-[14px] leading-[1.5] text-foreground focus:border-primary focus:outline-none focus:ring-0\"></textarea><div class=\"flex justify-end\"><button type=\"button\" data-testid=\"describe-draft\" disabled=\"\" class=\"rounded bg-primary px-6 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button></div><p data-testid=\"describe-hint\" class=\"text-[13px] leading-[1.5] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><div class=\"flex flex-col gap-2\"><span hidden=\"\" aria-hidden=\"true\" data-testid=\"describe-kb-state\" data-state=\"none\"></span><span class=\"font-mono text-[14px] leading-[1.4] text-foreground\">Which knowledge base should this use?</span><div class=\"flex flex-col gap-1\"><div data-testid=\"describe-kb-empty\" class=\"flex w-full items-center justify-between gap-2 px-2 py-2 opacity-70\"><span class=\"text-[14px] leading-[1.5] text-muted-foreground\">You have no folders yet</span></div></div></div><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><div data-testid=\"describe-services\" class=\"flex flex-col gap-2\"><span hidden=\"\" aria-hidden=\"true\" data-testid=\"describe-services-state\" data-state=\"none\"></span><span class=\"font-mono text-[14px] leading-[1.4] text-foreground\">Services this workflow may use</span><div class=\"flex flex-col gap-2\"><div data-testid=\"describe-services-empty\" class=\"flex w-full items-center justify-between gap-2 px-2 py-2 opacity-70\"><span class=\"text-[14px] leading-[1.5] text-muted-foreground\">You have not connected anything yet.</span><span data-testid=\"describe-services-empty-next\" class=\"shrink-0 font-mono text-[12px] text-primary\">Connect a service</span></div></div></div><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_3_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_3_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><div class=\"relative\"><button type=\"button\" data-testid=\"starter-door-trigger\" aria-haspopup=\"menu\" aria-expanded=\"false\" class=\"border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">Not sure where to start? Start from a template.</button></div><div data-testid=\"switch-strip\" class=\"flex flex-wrap items-center gap-2 rounded border border-accent-violet/30 bg-accent-violet/5 px-3 py-2 text-[12px] text-muted-foreground\"><span aria-hidden=\"true\">🔧</span><span>Need to set citations, checks, or per-step sources yourself?</span><button type=\"button\" data-testid=\"switch-to-govern\" class=\"ml-auto rounded-sm border border-accent-violet/40 px-2.5 py-1 text-[12px] font-medium text-accent-violet hover:bg-accent-violet/10\">Build it myself ›</button></div><aside data-testid=\"describe-soul-preview\" class=\"rounded border border-border bg-card/40 p-4\"><p class=\"mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground\">What this will do</p><div data-testid=\"workflow-soul\" data-scale=\"card\" class=\"flex flex-col gap-2\"><p data-testid=\"soul-purpose\" class=\"text-sm font-semibold leading-snug text-foreground\"><span class=\"italic text-muted-foreground\">draft · purpose not declared yet</span></p><p data-testid=\"soul-needs\" class=\"text-[11px] text-muted-foreground\"><span class=\"font-medium\">needs</span> <span class=\"font-mono text-foreground/80\">kickoff_prompt</span></p><p data-testid=\"soul-spine-empty\" class=\"text-[11px] italic text-muted-foreground\">No phases yet</p><div><span data-testid=\"soul-tier\" data-tier=\"LOOSE\" title=\"Draft citations; the judge still runs (always-on).\" class=\"inline-flex items-center gap-1 rounded-full border border-border font-mono font-semibold uppercase tracking-wide text-foreground px-2 py-0.5 text-[9.5px]\"><span aria-hidden=\"true\">○</span>Loose</span></div><p data-testid=\"soul-output\" class=\"text-[11px] text-muted-foreground\"><span>produces: answer in chat</span></p></div></aside></div></div></div>",
  DESCRIBE_INLINE: "<div data-testid=\"door-describe\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><nav data-testid=\"host-lead\" aria-label=\"breadcrumb\">&lt; Workflows</nav><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span class=\"text-[13px] font-medium text-foreground\">⚡ Drafting it for you</span></div><div class=\"min-h-0 flex-1 overflow-y-auto px-4 py-8\"><div class=\"mx-auto flex w-full max-w-[720px] flex-col gap-8\"><div class=\"flex flex-col gap-2\"><label for=\"_r_4_\" class=\"font-mono text-[14px] leading-[1.4] text-foreground\">What recurring work should this automate?</label><textarea id=\"_r_4_\" aria-label=\"business requirement\" data-testid=\"describe-box\" placeholder=\"Describe the steps…\" rows=\"5\" class=\"w-full resize-y rounded border border-border bg-card p-4 text-[14px] leading-[1.5] text-foreground focus:border-primary focus:outline-none focus:ring-0\"></textarea><div class=\"flex justify-end\"><button type=\"button\" data-testid=\"describe-draft\" disabled=\"\" class=\"rounded bg-primary px-6 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button></div><p data-testid=\"describe-hint\" class=\"text-[13px] leading-[1.5] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><div class=\"flex flex-col gap-2\"><span hidden=\"\" aria-hidden=\"true\" data-testid=\"describe-kb-state\" data-state=\"none\"></span><span class=\"font-mono text-[14px] leading-[1.4] text-foreground\">Which knowledge base should this use?</span><div class=\"flex flex-col gap-1\"><div data-testid=\"describe-kb-empty\" class=\"flex w-full items-center justify-between gap-2 px-2 py-2 opacity-70\"><span class=\"text-[14px] leading-[1.5] text-muted-foreground\">You have no folders yet</span></div></div></div><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><div data-testid=\"describe-services\" class=\"flex flex-col gap-2\"><span hidden=\"\" aria-hidden=\"true\" data-testid=\"describe-services-state\" data-state=\"none\"></span><span class=\"font-mono text-[14px] leading-[1.4] text-foreground\">Services this workflow may use</span><div class=\"flex flex-col gap-2\"><div data-testid=\"describe-services-empty\" class=\"flex w-full items-center justify-between gap-2 px-2 py-2 opacity-70\"><span class=\"text-[14px] leading-[1.5] text-muted-foreground\">You have not connected anything yet.</span><span data-testid=\"describe-services-empty-next\" class=\"shrink-0 font-mono text-[12px] text-primary\">Connect a service</span></div></div></div><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_5_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_5_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div aria-hidden=\"true\" class=\"h-px w-full bg-border\"></div><div class=\"relative\"><button type=\"button\" data-testid=\"starter-door-trigger\" aria-haspopup=\"menu\" aria-expanded=\"false\" class=\"border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">Not sure where to start? Start from a template.</button></div><div data-testid=\"switch-strip\" class=\"flex flex-wrap items-center gap-2 rounded border border-accent-violet/30 bg-accent-violet/5 px-3 py-2 text-[12px] text-muted-foreground\"><span aria-hidden=\"true\">🔧</span><span>Need to set citations, checks, or per-step sources yourself?</span><button type=\"button\" data-testid=\"switch-to-govern\" class=\"ml-auto rounded-sm border border-accent-violet/40 px-2.5 py-1 text-[12px] font-medium text-accent-violet hover:bg-accent-violet/10\">Build it myself ›</button></div><aside data-testid=\"describe-soul-preview\" class=\"rounded border border-border bg-card/40 p-4\"><p class=\"mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground\">What this will do</p><div data-testid=\"workflow-soul\" data-scale=\"card\" class=\"flex flex-col gap-2\"><p data-testid=\"soul-purpose\" class=\"text-sm font-semibold leading-snug text-foreground\"><span class=\"italic text-muted-foreground\">draft · purpose not declared yet</span></p><p data-testid=\"soul-needs\" class=\"text-[11px] text-muted-foreground\"><span class=\"font-medium\">needs</span> <span class=\"font-mono text-foreground/80\">kickoff_prompt</span></p><p data-testid=\"soul-spine-empty\" class=\"text-[11px] italic text-muted-foreground\">No phases yet</p><div><span data-testid=\"soul-tier\" data-tier=\"LOOSE\" title=\"Draft citations; the judge still runs (always-on).\" class=\"inline-flex items-center gap-1 rounded-full border border-border font-mono font-semibold uppercase tracking-wide text-foreground px-2 py-0.5 text-[9.5px]\"><span aria-hidden=\"true\">○</span>Loose</span></div><p data-testid=\"soul-output\" class=\"text-[11px] text-muted-foreground\"><span>produces: answer in chat</span></p></div></aside></div></div></div>",
  GOVERN_STANDALONE: "<div data-testid=\"door-govern\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span aria-hidden=\"true\" class=\"mx-0.5 h-4 w-px bg-border\"></span><span class=\"text-[13px] font-medium text-foreground\">Build it myself</span><span data-testid=\"judge-locked\" title=\"The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn).\" class=\"ml-auto inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet\"><span aria-hidden=\"true\">🔒</span> judge always-on</span></div><div class=\"min-h-0 flex-1\"><div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_7_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_7_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div></div></div></div></div>",
  GOVERN_INLINE: "<div data-testid=\"door-govern\" class=\"flex h-full flex-col bg-background\"><div class=\"min-h-0 flex-1\"><div class=\"flex h-full flex-col bg-background\"><header data-testid=\"builder-header-bar\" class=\"flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-2\"><div class=\"flex min-w-0 flex-wrap items-center gap-2\"><nav data-testid=\"host-lead\" aria-label=\"breadcrumb\">&lt; Workflows</nav></div><div class=\"ml-auto flex shrink-0 items-center gap-2\"><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span aria-hidden=\"true\" class=\"mx-0.5 h-4 w-px bg-border\"></span><span class=\"text-[13px] font-medium text-foreground\">Build it myself</span><span data-testid=\"judge-locked\" title=\"The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn).\" class=\"inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet\"><span aria-hidden=\"true\">🔒</span> judge always-on</span></div></header><div class=\"min-h-0 flex-1\"><div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_9_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_9_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p><div class=\"relative\"><button type=\"button\" data-testid=\"starter-door-trigger\" aria-haspopup=\"menu\" aria-expanded=\"false\" class=\"border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">Not sure where to start? Start from a template.</button></div></div></div></div></div></div></div></div>",
}

/**
 * The class list of the element carrying `data-testid={testId}`, read out of a COMMITTED
 * capture string.
 *
 * It walks back to the element's own `<` and forward to the end of its opening tag, so it is
 * indifferent to attribute ORDER — a fence that assumed `class` follows `data-testid` would
 * silently start reading a neighbour's attributes the day someone reorders a JSX prop.
 */
function classListOf(html: string, testId: string): string {
  const at = html.indexOf(`data-testid="${testId}"`)
  expect(at, `${testId} is absent from the capture`).toBeGreaterThan(-1)
  const open = html.lastIndexOf("<", at)
  const close = html.indexOf(">", at)
  const tag = html.slice(open, close + 1)
  const match = /class="([^"]*)"/.exec(tag)
  expect(match, `${testId} carries no class attribute`).not.toBeNull()
  return (match as RegExpExecArray)[1]
}

describe("WorkflowDoorSwitch 193-01 — the pre-move rendered DOM, byte for byte", () => {
  it("the capture commit is recorded, and BOTH destination modules do not exist in it", () => {
    // The mechanical half of the proof lives in the docblock above (the three commands and
    // their verbatim output) and in 193-01-SUMMARY.md. This pins the SHA those commands were
    // run at, so a later reader can re-run them rather than take the claim on trust.
    expect(CAPTURE_SHA).toMatch(/^[0-9a-f]{40}$/)
  })

  it("captures exactly the six declared states, keyed identically on both sides", () => {
    // A row present in one map and absent from the other would silently go uncaptured or
    // unasserted — the driver loop below iterates ONE of them and would never notice.
    expect(Object.keys(DOOR_HTML_BASELINE).sort()).toEqual(
      [
        "CHOOSER_INLINE",
        "CHOOSER_STANDALONE",
        "DESCRIBE_INLINE",
        "DESCRIBE_STANDALONE",
        "GOVERN_INLINE",
        "GOVERN_STANDALONE",
      ],
    )
    expect(Object.keys(DOOR_HTML_ROWS).sort()).toEqual(Object.keys(DOOR_HTML_BASELINE).sort())
  })

  for (const row of Object.keys(DOOR_HTML_ROWS)) {
    it(`${row} reproduces the DOM CAPTURED from the unmoved tree, byte for byte`, async () => {
      // NON-VACUITY, first: a `toBe` against an empty string would pass forever if the row ever
      // stopped rendering and the baseline were ever re-captured from that silence (T-193-03).
      expect(DOOR_HTML_BASELINE[row].length).toBeGreaterThan(0)
      expect(await doorCapture(DOOR_HTML_ROWS[row])).toBe(DOOR_HTML_BASELINE[row])
    })
  }

  // ── THE MARKER ROWS ─────────────────────────────────────────────────────────────────────
  // Byte-identity alone is compatible with a row that quietly rendered nothing: an empty
  // capture equals an empty render forever. These rows say WHAT each capture contains, so a
  // state that stopped painting its blocks is a failure rather than a pass. They read the
  // COMMITTED baseline strings, not a fresh render — the claim being pinned is about what was
  // captured.

  it("both CHOOSER captures carry both door cards and both shipped door names", () => {
    for (const key of ["CHOOSER_STANDALONE", "CHOOSER_INLINE"]) {
      const html = DOOR_HTML_BASELINE[key]
      expect(html).toContain('data-testid="workflow-doors"')
      expect(html).toContain('data-testid="door-card-describe"')
      expect(html).toContain('data-testid="door-card-govern"')
      // The two shipped door names. ⚠ READ OFF `doorVocabulary` rather than re-typed as of
      // `193-08`: this row exists to say the capture is not an empty render, and a hard-coded
      // pair of words would make it a SECOND home for the copy — the exact drift D-11 removes.
      // Escaped for the serialised form, because `innerHTML` re-serialises `&`.
      expect(html).toContain(DOOR_A_NAME.replace(/&/g, "&amp;"))
      expect(html).toContain(DOOR_B_NAME.replace(/&/g, "&amp;"))
      // The chooser is not a door: neither open door's root may be inside it.
      expect(html).not.toContain('data-testid="door-describe"')
      expect(html).not.toContain('data-testid="door-govern"')
    }
  })

  it("the two CHOOSER captures differ by exactly the adopted host band", () => {
    // Without this, the `inline` row is satisfiable by a capture identical to the standalone
    // one — i.e. by a chooser that silently dropped the host's only way back.
    expect(DOOR_HTML_BASELINE.CHOOSER_INLINE).not.toBe(DOOR_HTML_BASELINE.CHOOSER_STANDALONE)
    expect(DOOR_HTML_BASELINE.CHOOSER_INLINE).toContain('data-testid="host-lead"')
    expect(DOOR_HTML_BASELINE.CHOOSER_STANDALONE).not.toContain('data-testid="host-lead"')
  })

  it("both DESCRIBE captures carry the whole loose-door surface", () => {
    for (const key of ["DESCRIBE_STANDALONE", "DESCRIBE_INLINE"]) {
      const html = DOOR_HTML_BASELINE[key]
      for (const testId of [
        "door-describe",
        "both-doors",
        "describe-box",
        "describe-draft",
        "describe-hint",
        "switch-strip",
        "switch-to-govern",
        "describe-soul-preview",
      ]) {
        expect(html).toContain(`data-testid="${testId}"`)
      }
    }
  })

  it("the two DESCRIBE captures differ by exactly the adopted host band", () => {
    expect(DOOR_HTML_BASELINE.DESCRIBE_INLINE).not.toBe(DOOR_HTML_BASELINE.DESCRIBE_STANDALONE)
    expect(DOOR_HTML_BASELINE.DESCRIBE_INLINE).toContain('data-testid="host-lead"')
    expect(DOOR_HTML_BASELINE.DESCRIBE_STANDALONE).not.toContain('data-testid="host-lead"')
  })

  it("both GOVERN captures carry the return control, the locked judge and the shipped govern label", () => {
    for (const key of ["GOVERN_STANDALONE", "GOVERN_INLINE"]) {
      const html = DOOR_HTML_BASELINE[key]
      expect(html).toContain('data-testid="door-govern"')
      expect(html).toContain('data-testid="both-doors"')
      expect(html).toContain('data-testid="judge-locked"')
      // The band's own words, which AUTH-01 moved into `doorVocabulary.ts` — READ OFF the
      // module as of `193-08`, never re-typed, so a future reword cannot leave this row
      // asserting a string the product no longer speaks.
      expect(html).toContain(STRIP_LABEL_GOVERN.replace(/&/g, "&amp;"))
      expect(html).toContain(STRIP_BACK)
      // …and the judge badge's own word, which is NOT governed copy and stays a literal.
      expect(html).toContain("judge always-on")
    }
  })

  it("the GOVERN pair differ by WHERE the group is drawn — this shell's band vs the Builder's merged row", () => {
    // The standalone door draws its own bordered band; the inline one hands the SAME group to
    // the Builder as `headerTrail` and the Builder hosts it. Both must be captured, because
    // the D-05 conditional exists only to make one group serve both homes.
    expect(DOOR_HTML_BASELINE.GOVERN_STANDALONE).not.toContain('data-testid="builder-header-bar"')
    expect(DOOR_HTML_BASELINE.GOVERN_INLINE).toContain('data-testid="builder-header-bar"')
    // The host's only way back travels with the inline row. An author stranded on a screen with
    // no `← Workflows` is a worse defect than a tall header, so its presence is pinned.
    expect(DOOR_HTML_BASELINE.GOVERN_INLINE).toContain('data-testid="host-lead"')
    expect(DOOR_HTML_BASELINE.GOVERN_STANDALONE).not.toContain('data-testid="host-lead"')
  })

  it("⚠ THE D-05 PAIR: the judge badge carries `ml-auto` STANDALONE and not INLINE", () => {
    // This is the one assertion the whole six-row shape exists for. `DoorHeaderStrip` must
    // render in BOTH variants with `ml-auto` present iff NOT `inline`; a strip that hard-coded
    // either side would still satisfy a baseline that captured only one of them.
    //
    // ⚠ IT IS ASSERTED ON THE BADGE'S OWN CLASS LIST, NOT ON THE WHOLE CAPTURE, AND THAT IS A
    // CORRECTION ON MEASUREMENT rather than a stylistic choice. The obvious form —
    // `expect(GOVERN_INLINE).not.toContain("ml-auto")` — is FALSE on the shipped tree: with the
    // canvas gate on, `BuilderHeaderBar` puts `ml-auto` on its OWN trailing group
    // (`<div class="ml-auto flex shrink-0 …">`), so the inline capture legitimately contains
    // the token twice over while the badge itself does not. A whole-capture negative would
    // therefore have to be deleted the moment the row was captured honestly, and a
    // whole-capture negative that passed would only be measuring the header bar.
    const standalone = classListOf(DOOR_HTML_BASELINE.GOVERN_STANDALONE, "judge-locked")
    const inline = classListOf(DOOR_HTML_BASELINE.GOVERN_INLINE, "judge-locked")
    expect(standalone.split(" ")).toContain("ml-auto")
    expect(inline.split(" ")).not.toContain("ml-auto")
    // …and the two class lists differ by EXACTLY that token and nothing else. Concatenated in
    // the source (`${inline ? "" : "ml-auto "}…`) precisely so the non-inline string is
    // character-for-character the class list that shipped — this is that claim, measured.
    expect(standalone).toBe(`ml-auto ${inline}`)
    // …and the two captures are genuinely different renders, not one string read twice.
    expect(DOOR_HTML_BASELINE.GOVERN_INLINE).not.toBe(DOOR_HTML_BASELINE.GOVERN_STANDALONE)
  })

  it("POSITIVE CONTROL — `classListOf` really reads the named element's own class list", () => {
    // Without this the row above is satisfiable by a helper that returns "" for everything:
    // `"".split(" ")` contains no "ml-auto", so the negative half would pass on a broken
    // reader. These two are read off the SAME committed strings the fence reads.
    expect(classListOf(DOOR_HTML_BASELINE.GOVERN_STANDALONE, "judge-locked")).toContain(
      "text-accent-violet",
    )
    expect(classListOf(DOOR_HTML_BASELINE.CHOOSER_STANDALONE, "workflow-doors")).toBe(
      "flex h-full flex-col bg-background",
    )
  })

  it("every capture is non-empty and none is a placeholder", () => {
    // The substitution that filled this map is mechanical; this is the cheap tell that it ran
    // for every row rather than for the ones somebody remembered.
    for (const [key, html] of Object.entries(DOOR_HTML_BASELINE)) {
      expect(html.length).toBeGreaterThan(200)
      expect(html, key).not.toContain("PLACEHOLDER")
      expect(html.startsWith("<div")).toBe(true)
    }
  })

  // ── 214-13 (sketch 217 #1) — THE REFUSAL NEVER RENDERS AT REST, WITH A POSITIVE CONTROL ──
  //
  // ⚠ AN ABSENCE ASSERTION OVER SIX STRINGS IS FREE UNLESS SOMETHING PROVES THE NEEDLE CAN
  // MATCH. The control below drives the SAME door to a refusing state through a real keystroke
  // and asserts the refusal IS there — so the six zeros above it are measurements rather than
  // typos, and a component that simply stopped rendering the block would fail here instead of
  // passing everywhere.

  it("⛔ NO refusal, and NO destructive token, in any of the six RESTING captures (#1)", () => {
    for (const [key, html] of Object.entries(DOOR_HTML_BASELINE)) {
      expect(html, key).not.toContain('data-testid="describe-refusal"')
      // The colour ruling's own evidence: the token was absent from every resting capture
      // BEFORE the swap and is absent after, because this block never renders at rest.
      expect(html, key).not.toContain("destructive")
    }
    // The two DESCRIBE rows DO carry the newly-mounted picker — the one authorised difference,
    // asserted positively so "unchanged" cannot silently mean "stopped rendering".
    for (const key of ["DESCRIBE_STANDALONE", "DESCRIBE_INLINE"]) {
      expect(DOOR_HTML_BASELINE[key], key).toContain('data-testid="describe-services"')
    }
  })

  it("POSITIVE CONTROL — the REFUSING DOM differs from the resting one, and spends warning", async () => {
    const { EffectiveFeaturesProvider } = await import("@/providers/EffectiveFeaturesProvider")
    const rendered = render(
      <EffectiveFeaturesProvider value={{ features: {}, loading: false, refetch: () => {} }}>
        <WorkflowDoorSwitch onDescribeDraft={noopDescribeDraft} initialDoor="describe" />
      </EffectiveFeaturesProvider>,
    )
    await screen.findByTestId("door-describe")
    await act(async () => {
      await Promise.resolve()
    })
    const resting = rendered.container.innerHTML

    // ⚠ THIS RESTING STRING IS DELIBERATELY *NOT* COMPARED TO `DOOR_HTML_BASELINE`, AND THE
    // REASON IS A MEASURED PROPERTY OF THE CAPTURES RATHER THAN A WEAKENING. `useId` numbers
    // its output by RENDER ORDER within the file — the committed captures carry `for=\"_r_2_\"`
    // through `for=\"_r_9_\"` — so any render occurring after the driver loop gets a different
    // counter and can never equal a committed literal, whatever the markup does. Driven here:
    // the equality was asserted first and failed with two strings that differ only in that id.
    // **The byte-for-byte claim belongs to the driver loop above and to nowhere else**; this
    // case's whole subject is that REFUSING ≠ RESTING within ONE render, which is unaffected.
    expect(resting).toContain('data-testid="describe-services"')
    expect(resting).not.toContain('data-testid="describe-refusal"')

    // A whitespace-only box is the shipped thinness refusal — a real keystroke, not a prop.
    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: " " } })
    const refusingHtml = rendered.container.innerHTML
    expect(refusingHtml).not.toBe(resting)
    expect(refusingHtml).toContain('data-testid="describe-refusal"')
    // 214-03's colour ruling, on the arm that used to be destructive.
    expect(refusingHtml).toContain("border-l-warning")
    expect(refusingHtml).not.toContain("destructive")
    rendered.unmount()
  })
})
