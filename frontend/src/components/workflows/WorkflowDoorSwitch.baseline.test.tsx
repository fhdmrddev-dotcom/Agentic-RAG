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
import { render, screen, act } from "@testing-library/react"

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
 */
const DOOR_HTML_BASELINE: Record<string, string> = {
  CHOOSER_STANDALONE: "<div data-testid=\"workflow-doors\" class=\"flex h-full flex-col bg-background\"><div class=\"flex flex-col gap-1 border-b border-border px-6 py-4\"><h1 class=\"text-[18px] font-semibold text-foreground\">How do you want to start?</h1><p class=\"text-[13px] text-muted-foreground\">Both end up in the same place. You can switch between them at any time.</p></div><div class=\"grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 py-6 md:grid-cols-2\"><button type=\"button\" data-testid=\"door-card-describe\" class=\"flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/60\"><span aria-hidden=\"true\" class=\"text-3xl\">⚡</span><span class=\"font-mono text-[10px] uppercase tracking-wider text-muted-foreground\">you write one paragraph</span><span class=\"text-[16px] font-semibold text-foreground\">Draft it for me</span><span class=\"text-[13px] text-muted-foreground\">Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.</span><span class=\"mt-1 text-[13px] font-medium text-primary\">Open <span aria-hidden=\"true\">›</span></span><span class=\"mt-1 text-[11px] italic text-muted-foreground\">you can open the full editor at any point — nothing is locked in</span></button><button type=\"button\" data-testid=\"door-card-govern\" class=\"flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-accent-violet/60\"><span aria-hidden=\"true\" class=\"text-3xl\">🔧</span><span class=\"font-mono text-[10px] uppercase tracking-wider text-muted-foreground\">you decide every setting</span><span class=\"text-[16px] font-semibold text-foreground\">Build it myself</span><span class=\"text-[13px] text-muted-foreground\">Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step.</span><span class=\"mt-1 text-[13px] font-medium text-accent-violet\">Open <span aria-hidden=\"true\">›</span></span><span class=\"mt-1 text-[11px] italic text-muted-foreground\">what it must cite · required checks · per-step sources &amp; model</span></button></div></div>",
  CHOOSER_INLINE: "<div data-testid=\"workflow-doors\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><nav data-testid=\"host-lead\" aria-label=\"breadcrumb\">&lt; Workflows</nav></div><div class=\"flex flex-col gap-1 border-b border-border px-6 py-4\"><h1 class=\"text-[18px] font-semibold text-foreground\">How do you want to start?</h1><p class=\"text-[13px] text-muted-foreground\">Both end up in the same place. You can switch between them at any time.</p></div><div class=\"grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 py-6 md:grid-cols-2\"><button type=\"button\" data-testid=\"door-card-describe\" class=\"flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/60\"><span aria-hidden=\"true\" class=\"text-3xl\">⚡</span><span class=\"font-mono text-[10px] uppercase tracking-wider text-muted-foreground\">you write one paragraph</span><span class=\"text-[16px] font-semibold text-foreground\">Draft it for me</span><span class=\"text-[13px] text-muted-foreground\">Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.</span><span class=\"mt-1 text-[13px] font-medium text-primary\">Open <span aria-hidden=\"true\">›</span></span><span class=\"mt-1 text-[11px] italic text-muted-foreground\">you can open the full editor at any point — nothing is locked in</span></button><button type=\"button\" data-testid=\"door-card-govern\" class=\"flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-accent-violet/60\"><span aria-hidden=\"true\" class=\"text-3xl\">🔧</span><span class=\"font-mono text-[10px] uppercase tracking-wider text-muted-foreground\">you decide every setting</span><span class=\"text-[16px] font-semibold text-foreground\">Build it myself</span><span class=\"text-[13px] text-muted-foreground\">Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step.</span><span class=\"mt-1 text-[13px] font-medium text-accent-violet\">Open <span aria-hidden=\"true\">›</span></span><span class=\"mt-1 text-[11px] italic text-muted-foreground\">what it must cite · required checks · per-step sources &amp; model</span></button></div></div>",
  DESCRIBE_STANDALONE: "<div data-testid=\"door-describe\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span class=\"text-[13px] font-medium text-foreground\">⚡ Drafting it for you</span></div><div class=\"grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1fr_320px]\"><div class=\"flex flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"text-[1.4rem] font-semibold text-foreground\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" data-testid=\"describe-box\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><span hidden=\"\" aria-hidden=\"true\" data-testid=\"describe-kb-state\" data-state=\"none\"></span><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" data-testid=\"describe-draft\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div><div data-testid=\"switch-strip\" class=\"flex flex-wrap items-center gap-2 rounded-lg border border-accent-violet/30 bg-accent-violet/5 px-3 py-2 text-[12px] text-muted-foreground\"><span aria-hidden=\"true\">🔧</span><span>Need to set citations, checks, or per-step sources yourself?</span><button type=\"button\" data-testid=\"switch-to-govern\" class=\"ml-auto rounded-md border border-accent-violet/40 px-2.5 py-1 text-[12px] font-medium text-accent-violet hover:bg-accent-violet/10\">Build it myself ›</button></div></div><aside data-testid=\"describe-soul-preview\" class=\"rounded-lg border border-border bg-card/40 p-4\"><p class=\"mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground\">What this will do</p><div data-testid=\"workflow-soul\" data-scale=\"card\" class=\"flex flex-col gap-2\"><p data-testid=\"soul-purpose\" class=\"text-sm font-semibold leading-snug text-foreground\"><span class=\"italic text-muted-foreground\">draft · purpose not declared yet</span></p><p data-testid=\"soul-needs\" class=\"text-[11px] text-muted-foreground\"><span class=\"font-medium\">needs</span> <span class=\"font-mono text-foreground/80\">kickoff_prompt</span></p><p data-testid=\"soul-spine-empty\" class=\"text-[11px] italic text-muted-foreground\">No phases yet</p><div><span data-testid=\"soul-tier\" data-tier=\"LOOSE\" title=\"Draft citations; the judge still runs (always-on).\" class=\"inline-flex items-center gap-1 rounded-full border border-border font-mono font-semibold uppercase tracking-wide text-foreground px-2 py-0.5 text-[9.5px]\"><span aria-hidden=\"true\">○</span>Loose</span></div><p data-testid=\"soul-output\" class=\"text-[11px] text-muted-foreground\"><span>produces: answer in chat</span></p></div></aside></div></div>",
  DESCRIBE_INLINE: "<div data-testid=\"door-describe\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><nav data-testid=\"host-lead\" aria-label=\"breadcrumb\">&lt; Workflows</nav><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span class=\"text-[13px] font-medium text-foreground\">⚡ Drafting it for you</span></div><div class=\"grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1fr_320px]\"><div class=\"flex flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"text-[1.4rem] font-semibold text-foreground\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" data-testid=\"describe-box\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><span hidden=\"\" aria-hidden=\"true\" data-testid=\"describe-kb-state\" data-state=\"none\"></span><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" data-testid=\"describe-draft\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div><div data-testid=\"switch-strip\" class=\"flex flex-wrap items-center gap-2 rounded-lg border border-accent-violet/30 bg-accent-violet/5 px-3 py-2 text-[12px] text-muted-foreground\"><span aria-hidden=\"true\">🔧</span><span>Need to set citations, checks, or per-step sources yourself?</span><button type=\"button\" data-testid=\"switch-to-govern\" class=\"ml-auto rounded-md border border-accent-violet/40 px-2.5 py-1 text-[12px] font-medium text-accent-violet hover:bg-accent-violet/10\">Build it myself ›</button></div></div><aside data-testid=\"describe-soul-preview\" class=\"rounded-lg border border-border bg-card/40 p-4\"><p class=\"mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground\">What this will do</p><div data-testid=\"workflow-soul\" data-scale=\"card\" class=\"flex flex-col gap-2\"><p data-testid=\"soul-purpose\" class=\"text-sm font-semibold leading-snug text-foreground\"><span class=\"italic text-muted-foreground\">draft · purpose not declared yet</span></p><p data-testid=\"soul-needs\" class=\"text-[11px] text-muted-foreground\"><span class=\"font-medium\">needs</span> <span class=\"font-mono text-foreground/80\">kickoff_prompt</span></p><p data-testid=\"soul-spine-empty\" class=\"text-[11px] italic text-muted-foreground\">No phases yet</p><div><span data-testid=\"soul-tier\" data-tier=\"LOOSE\" title=\"Draft citations; the judge still runs (always-on).\" class=\"inline-flex items-center gap-1 rounded-full border border-border font-mono font-semibold uppercase tracking-wide text-foreground px-2 py-0.5 text-[9.5px]\"><span aria-hidden=\"true\">○</span>Loose</span></div><p data-testid=\"soul-output\" class=\"text-[11px] text-muted-foreground\"><span>produces: answer in chat</span></p></div></aside></div></div>",
  GOVERN_STANDALONE: "<div data-testid=\"door-govern\" class=\"flex h-full flex-col bg-background\"><div class=\"flex items-center gap-3 border-b border-border px-4 py-2\"><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span aria-hidden=\"true\" class=\"mx-0.5 h-4 w-px bg-border\"></span><span class=\"text-[13px] font-medium text-foreground\">Build it myself</span><span data-testid=\"judge-locked\" title=\"The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn).\" class=\"ml-auto inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet\"><span aria-hidden=\"true\">🔒</span> judge always-on</span></div><div class=\"min-h-0 flex-1\"><div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div></div></div></div></div>",
  GOVERN_INLINE: "<div data-testid=\"door-govern\" class=\"flex h-full flex-col bg-background\"><div class=\"min-h-0 flex-1\"><div class=\"flex h-full flex-col bg-background\"><header data-testid=\"builder-header-bar\" class=\"flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-2\"><div class=\"flex min-w-0 flex-wrap items-center gap-2\"><nav data-testid=\"host-lead\" aria-label=\"breadcrumb\">&lt; Workflows</nav></div><div class=\"ml-auto flex shrink-0 items-center gap-2\"><button type=\"button\" data-testid=\"both-doors\" class=\"px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">‹ Change how I start</button><span aria-hidden=\"true\" class=\"mx-0.5 h-4 w-px bg-border\"></span><span class=\"text-[13px] font-medium text-foreground\">Build it myself</span><span data-testid=\"judge-locked\" title=\"The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn).\" class=\"inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet\"><span aria-hidden=\"true\">🔒</span> judge always-on</span></div></header><div class=\"min-h-0 flex-1\"><div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p><div class=\"relative\"><button type=\"button\" data-testid=\"starter-door-trigger\" aria-haspopup=\"menu\" aria-expanded=\"false\" class=\"border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">Not sure where to start? Start from a template.</button></div></div></div></div></div></div></div></div>",
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
})
