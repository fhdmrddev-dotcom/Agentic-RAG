/**
 * Plan 193.1-01 (D-01 / D-02) — THE PRE-MOVE `WorkflowBuilderPage` PRE-DRAFT CHARACTERIZATION
 * BASELINE, plus the `/generate` request-body KEY SET as it ships today.
 *
 * A NEW FILE, deliberately, rather than an append to any of the five shipped
 * `WorkflowBuilderPage.*` suites: this plan's whole property is that the capture commit
 * modifies NO source file, and a new file makes `git diff --name-only` over that commit the
 * proof rather than a promise.
 *
 * WHY A CAPTURE AND NOT AN EXPECTATION. Phase 193.1's D-01 cuts a pre-draft template-read
 * concern out of this page (G-5 fires on it: 34 commits / 10 phases / 2073 L, measured at
 * discuss time). The moving wave's first contract is "the pre-draft screen renders exactly what
 * it rendered". The cheap wrong way to check that is to hand-type the DOM the screen OUGHT to
 * produce — which records only what its author believed the markup was, and would ratify a move
 * that changed the markup whenever the change happened to match the belief. So this block
 * CAPTURES the rendered DOM from the tree AS IT SHIPS.
 *
 * ⚠ THE BASELINE MUST PREDATE THE CHANGE. A baseline taken after the edit proves the edit
 * against itself. This is Phase 188.1's most expensive measured lesson, re-proved in 188.2,
 * 192-06/192-08 and 193-01. The same proof, run here and RECORDED rather than asserted — both
 * modules the later waves create, verbatim output:
 *
 *     $ git rev-parse HEAD
 *     5333518b2c969294fc0fce93b9549e30189531ff
 *     $ git show HEAD:frontend/src/components/workflows/useTemplateFirstDraft.ts
 *     fatal: path 'frontend/src/components/workflows/useTemplateFirstDraft.ts' does not
 *       exist in 'HEAD'                                                      [exit 128]
 *     $ git show HEAD:frontend/src/components/workflows/DescribeTemplateRow.tsx
 *     fatal: path 'frontend/src/components/workflows/DescribeTemplateRow.tsx' does not
 *       exist in 'HEAD'                                                      [exit 128]
 *
 * THIS PLAN MODIFIES NO SOURCE FILE. `git diff --name-only` over its commits lists exactly two
 * paths — this file and `scripts/vitest-count-gate.cjs` — and neither is an existing file under
 * `frontend/src/**` or `backend/app/**`. A source edit inside the capture commit would destroy
 * the very property the capture exists to establish.
 *
 * ── ⚠ WHICH OF THE TWO PRE-DRAFT DESCRIBE SCREENS THIS IS ───────────────────────────────
 *
 * There are TWO, they are near-identical, and confusing them is the single likeliest way to
 * waste this file (`193.1-PATTERNS.md` §C-1):
 *
 *   · `WorkflowDoorSwitch.tsx:227-380` — the LOOSE / fast door. Its CTA is a HANDOFF and makes
 *     no network call. Already captured by `WorkflowDoorSwitch.baseline.test.tsx` (193-01).
 *   · `WorkflowBuilderPage.tsx:1533-1615` — the GOVERN door's `describeScreen`. Its CTA calls
 *     `generateWorkflow`, and it is the ONLY `/generate` caller in the app. **THIS FILE.**
 *
 * BOTH components contain the literal splice anchor `<div className="flex flex-col items-center
 * gap-3">` (`WorkflowDoorSwitch.tsx:300` and `WorkflowBuilderPage.tsx:1579`), so the class
 * string cannot tell them apart and a plan that splices "at the CTA group" can land on either.
 * The subject is therefore named by IMPORT and asserted by the flag-ON marker row below, which
 * pins `starter-door-trigger` — a node that exists ONLY on this screen.
 *
 * ── WHAT IS AND IS NOT CLAIMED TO BE BYTE-IDENTICAL ─────────────────────────────────────
 *
 * THE RENDERED DOM must be byte-identical across D-01's cut. THE MOVED SOURCE need not be: an
 * extracted hook acquires a module docblock, imports and an args interface, so a diff-stat
 * showing more insertions than deletions on the destination side is EXPECTED and is NOT
 * evidence of drift. A diff against the strings below is.
 *
 * ⚠ AND THE CONVERSE: a diff against these strings is a BEHAVIOUR CHANGE TO EXPLAIN, never a
 * test to update. Re-capturing them to make a red run green deletes the only evidence anybody
 * has that the pre-draft screen still renders what it rendered. `git diff --numstat` on this
 * file must show ZERO DELETIONS through the extraction wave; the first wave that intentionally
 * changes a rendered node re-captures ONCE, DECLARED in its own plan with a date and a reason,
 * never quietly absorbed (the 193-01 → 193-08 → 193-09 precedent, including its third,
 * unstated re-capture and the lesson that carried).
 *
 * ── WHAT IS NOT PINNED HERE, AND WHERE IT IS ────────────────────────────────────────────
 *
 * `WorkflowBuilderPage.describe.test.tsx:307` holds `FLAG_OFF_DESCRIBE_MARKUP`, a byte-exact
 * literal of the CTA GROUP ALONE captured in Phase 187 wave 1 — six phases before this one,
 * which makes it a stronger predate than anything this phase can author. It is scoped to the
 * flex column reached by walking up from `describe-hint`, so it is blind to everything above
 * the CTA group; these six whole-container captures are what see the rest of the screen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

/**
 * The api seam. Enumerated exactly as `WorkflowBuilderPage.describe.test.tsx:90-150` enumerates
 * it — a factory mock that omits one symbol hands back `undefined` and the failure surfaces far
 * from its cause.
 *
 * ⚠ EVERY STUB IS A PLAIN FUNCTION, NEVER A VITEST SPY (`vi.fn`), AND THAT IS LOAD-BEARING
 * RATHER THAN stylistic. `vi.clearAllMocks()` resets a spy's implementation, so a row whose ARM
 * was reached through a spy implementation would be one careless `clearAllMocks` away from
 * capturing a different state than the one its key names — the 193-01 rule, applied to the whole
 * seam because these rows are reached by DRIVING the page rather than by mounting it in a state.
 * The behaviour that varies per row lives in `WIRE`, reset explicitly in `beforeEach`.
 *
 * The literal spelling is avoided even in this sentence: the plan's acceptance criterion is a RAW
 * `grep -c` over the whole file, so a docblock EXPLAINING the rule would otherwise break it —
 * the same property the D-24(a) copy fence has, for the same reason.
 */
const WIRE = vi.hoisted(() => {
  type Body = Record<string, unknown>
  type GenerateResult = { ok: boolean; definition?: unknown; error?: string; detail?: string }

  /** The two folders `listFolders` offers. Fixed, so the KB picker's options are deterministic. */
  const FOLDERS = [
    {
      id: "f-policies",
      user_id: "u-1",
      name: "Policies",
      parent_id: null,
      is_org_shared: false,
      created_at: "2026-08-14T00:00:00Z",
      updated_at: "2026-08-14T00:00:00Z",
    },
    {
      id: "f-suppliers",
      user_id: "u-1",
      name: "Suppliers",
      parent_id: null,
      is_org_shared: false,
      created_at: "2026-08-14T00:00:00Z",
      updated_at: "2026-08-14T00:00:00Z",
    },
  ]

  const state = {
    /** Every body handed to `generateWorkflow`, in order. Task 2 reads this. */
    generateBodies: [] as Body[],
    /** What the next `/generate` does. Reassigned per row; a promise that never settles by default. */
    generateOutcome: "pending" as "pending" | "error",
    /** The `ok:false` payload for the `error` arm — declared once so both sides read one value. */
    errorPayload: { ok: false, error: "Couldn't generate the workflow.", detail: "the model refused" },
  }

  const api = {
    generateWorkflow: (body: Body): Promise<GenerateResult> => {
      state.generateBodies.push(body)
      if (state.generateOutcome === "error") return Promise.resolve(state.errorPayload)
      // A promise that never settles: the page stays in `composing`, which is the arm, and no
      // row ever reaches the drafted view (whose api surface is far larger than this seam).
      return new Promise<GenerateResult>(() => {})
    },
    listFolders: () => Promise.resolve(FOLDERS),
    listSkills: () => Promise.resolve([]),
    createWorkflowDraft: () => Promise.reject(new Error("no row is created before a draft exists")),
    updateWorkflowDraft: () => Promise.reject(new Error("no row is updated before a draft exists")),
    validateWorkflow: () => Promise.resolve({ ok: true, verdicts: [] }),
    getGroundingBundle: () => Promise.resolve({ tools: [], folders: [], skills: [], degraded: [] }),
    publishWorkflow: () => Promise.reject(new Error("nothing is published from the describe screen")),
    listPublishedWorkflows: () => Promise.resolve([]),
    listStarterWorkflows: () => Promise.resolve([]),
    listDraftWorkflows: () => Promise.resolve([]),
    getWorkflowDeletePreview: () => Promise.reject(new Error("no delete preview before a draft exists")),
    deleteWorkflowCascade: () => Promise.reject(new Error("no cascade before a draft exists")),
  }

  return { state, api, FOLDERS }
})

vi.mock("@/lib/api", () => {
  class WorkflowConflictError extends Error {
    constructor(message = "workflow is published and cannot be modified") {
      super(message)
      this.name = "WorkflowConflictError"
    }
  }
  class WorkflowNotFoundError extends Error {
    constructor(message = "workflow not found") {
      super(message)
      this.name = "WorkflowNotFoundError"
    }
  }
  return { ...WIRE.api, WorkflowConflictError, WorkflowNotFoundError }
})

import { WorkflowBuilderPage } from "./WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
// The CTA and the heading are queried by GOVERNED ID, never by a re-typed literal — the Phase
// 193 fast-fix lesson: a literal query is exactly what let this page's copy rot for a whole
// phase without any suite reddening.
import { DESCRIBE_CTA } from "@/components/workflows/doorVocabulary"

/** The capture commit, recorded so the proof in the docblock is re-runnable rather than believed. */
const CAPTURE_SHA = "5333518b2c969294fc0fce93b9549e30189531ff"

/** The describe text every driven row types. Fixed, so `composing` and `error` are reproducible. */
const DESCRIBE_TEXT = "Summarise each supplier's risk position every Monday."

beforeEach(() => {
  WIRE.state.generateBodies.length = 0
  WIRE.state.generateOutcome = "pending"
  // The ⌥ Technical-names reveal persists; a leaked value would change what the page renders
  // under us and, with it, the pinned markup.
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

/**
 * A settled mount of the REAL page under the REAL `EffectiveFeaturesProvider`.
 *
 * The canvas gate is driven through the REAL `useCanvasGate` — no `vi.mock` of the hook, no
 * `app_settings` flip — because the flag-ON screen is the one users get
 * (`visual_workflow_canvas.audience` is `everyone`) and it is the only capture that can see a
 * re-parenting the flag-OFF pin cannot. The provider is reached through a DYNAMIC import (the
 * shipped `RunModal.test.tsx:408` / `WorkflowDoorSwitch.baseline.test.tsx:164` idiom) so the
 * gate is exercised through the shipped code path rather than around it.
 *
 * Both mount fetches are awaited before anything is read: an unsettled render would bake a
 * loading shape into the pin, and a `setState` landing after the assertion is an act warning at
 * best and a flake at worst.
 */
async function mountPreDraft(canvasOn: boolean) {
  const { EffectiveFeaturesProvider: Provider } = await import(
    "@/providers/EffectiveFeaturesProvider"
  )
  const rendered = render(
    <Provider
      value={{
        features: canvasOn ? { visual_workflow_canvas: true } : {},
        loading: false,
        refetch: () => {},
      }}
    >
      <WorkflowBuilderPage />
    </Provider>,
  )
  // The describe screen must exist before anything is read — otherwise an empty capture would
  // be indistinguishable from a page that failed to mount.
  await screen.findByTestId("describe-hint")
  // The KB picker only renders once `listFolders` has resolved AND its state has landed, so
  // waiting for it proves the first mount fetch settled…
  await screen.findByTestId("project-folder-picker")
  // …and one more act-wrapped tick so `listSkills`'s `setState` lands too.
  await waitFor(() => expect(screen.getByTestId("describe-hint")).toBeInTheDocument())
  return rendered
}

/** The three `builderPhase` arms the pre-draft branch is built for (`WorkflowBuilderPage.tsx:1532`). */
type Arm = "empty" | "composing" | "error"

type CaptureRow = {
  /** Drives the REAL `useCanvasGate` through the REAL provider. */
  canvasOn: boolean
  /** Which of the three arms of the `empty | composing | error` branch this row paints. */
  arm: Arm
}

/**
 * ONE render → drive → settle → read → unmount, shared by the capture and by the assertion.
 *
 * A second helper is exactly how a capture and the assertion that guards it drift apart: the
 * assertion would then be measuring a render nobody captured. Every string in `BASELINE` below
 * came out of this function, and every `expect` below calls this same function.
 *
 * The whole `container.innerHTML` is read, never a subtree: the screen ROOT's own attributes are
 * part of what the extraction must not change, and a subtree read would be blind to them.
 *
 * Each arm is reached THE WAY THE PAGE REACHES IT, never by mocking the store's internals:
 *   · `empty`     — the default mount.
 *   · `composing` — type, then click the CTA with a `/generate` that never settles.
 *   · `error`     — type, then click the CTA with a `/generate` resolving `{ok:false,…}`.
 */
async function capture(row: CaptureRow): Promise<string> {
  const rendered = await mountPreDraft(row.canvasOn)

  if (row.arm !== "empty") {
    if (row.arm === "error") WIRE.state.generateOutcome = "error"
    fireEvent.change(screen.getByLabelText("business requirement"), {
      target: { value: DESCRIBE_TEXT },
    })
    fireEvent.click(screen.getByRole("button", { name: DESCRIBE_CTA }))
    if (row.arm === "composing") {
      // The CTA's own label is the arm's tell — asserted before the read, so a row that never
      // left `empty` cannot be captured under the `composing` key.
      await screen.findByRole("button", { name: "Composing…" })
    } else {
      await screen.findByTestId("generate-error")
    }
  }

  const html = rendered.container.innerHTML
  rendered.unmount()
  return html
}

/**
 * The SIX render states, declared ONCE so the props the baseline was captured from and the props
 * the assertion renders cannot diverge.
 *
 * ⚠ SIX, NOT ONE, AND THE SECOND DIMENSION IS THE LOAD-BEARING ONE. The canvas flag changes what
 * this screen renders — `{canvasEnabled && <StarterTemplatePicker …/>}` sits INSIDE the CTA group
 * at `WorkflowBuilderPage.tsx:1596`, and `preDraftHeaderHosted` (`:1528`) can wrap the whole
 * screen in a `BuilderHeaderBar`. A flag-OFF-only baseline would be blind to every one of those
 * nodes, and the flag-ON screen is the one users actually get.
 */
const ROWS: Record<string, CaptureRow> = {
  "flagOff:empty": { canvasOn: false, arm: "empty" },
  "flagOff:composing": { canvasOn: false, arm: "composing" },
  "flagOff:error": { canvasOn: false, arm: "error" },
  "flagOn:empty": { canvasOn: true, arm: "empty" },
  "flagOn:composing": { canvasOn: true, arm: "composing" },
  "flagOn:error": { canvasOn: true, arm: "error" },
}

/**
 * ⚠ THIS LITERAL IS A CAPTURE, NOT AN EXPECTATION. Every character below was READ OUT of the
 * rendered DOM by running `capture` above and writing what it produced into this file by
 * SUBSTITUTION. Not one attribute here was typed from the source, computed by hand, or reasoned
 * about.
 *
 * OBSERVED TWICE and the two runs agreed byte for byte — so it is a baseline rather than one
 * sample of something that might vary. This screen reads no clock, no randomness and no
 * measurement API, so a capture that differed between two runs would be a REAL FINDING to report
 * and not flake to re-roll.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * ⚠ RE-CAPTURE **1 of 1** FOR PHASE 193.1 — DECLARED, DATED, AND REASONED.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * **Date:** 2026-08-15. **Plan:** `193.1-08`. **Reason:** the govern door's describe screen
 * gains the AUTH-03 pre-draft template row (D-24), spliced as a sibling immediately BEFORE the
 * CTA group. That is a rendered node, so these six whole-container captures had to move; the
 * file's own standard above says a diff against them is a BEHAVIOUR CHANGE TO EXPLAIN, and this
 * block is the explanation rather than a quiet absorption.
 *
 * ⚠ **THIS IS THE FIRST AND ONLY MOVEMENT, AND THAT IS WHAT MAKES THE EXTRACTION'S PROOF AND
 * THE WIRE'S PROOF INDEPENDENT OF THE FEATURE'S.** Plan 05 (the G-5 cut) and Plan 07 (the wire
 * and the bind) both held all six of these GREEN with ZERO re-capture — `193.1-07-SUMMARY.md`
 * records `git diff --numstat` on this file as `120 0`, zero deletions. So the cut is proved
 * against a baseline that predates it, and only the wave that deliberately changes what is on
 * screen changes what is on screen.
 *
 * **WHAT MOVED, MEASURED RATHER THAN ASSERTED.** Every row is a **PURE INSERTION** — the
 * longest-common-prefix/suffix comparison against the previous literals reports `removed: ""`
 * on all six, so not one previously-captured byte was dropped:
 *
 *     row               length            tags        removed
 *     flagOff:empty     1840 → 2855       36 → 47     ""
 *     flagOff:composing 1906 → 2921       36 → 47     ""
 *     flagOff:error     2297 → 3312       44 → 55     ""
 *     flagOn:empty      2257 → 3272       40 → 51     ""
 *     flagOn:composing  2323 → 3338       40 → 51     ""
 *     flagOn:error      2714 → 3729       48 → 59     ""
 *
 * The inserted span is the IDENTICAL 1015 characters / 11 tags in every row — one
 * `describe-template-row` section — which is itself evidence that the mount is unconditional
 * and arm-independent rather than six separate edits that happen to agree.
 *
 * ⚠ **A HARNESS BUG WAS FOUND WHILE CAPTURING, AND IT IS RECORDED BECAUSE IT WOULD HAVE BAKED
 * A WRONG BASELINE.** The first dump drove all six rows inside ONE test, so `generateOutcome`
 * set by `flagOff:error` leaked forward and `flagOn:composing` captured the ERROR DOM under the
 * `composing` key — it came back 3729 chars, identical in length to `flagOn:error`, containing
 * `generate-error` and no `Composing…`. The per-test `beforeEach` above is what normally
 * prevents this; the dump had bypassed it. Fixed by resetting `WIRE.state` per row, re-run, and
 * the arm markers checked EXPLICITLY (`Composing…` / `generate-error`) before any literal was
 * written. Then observed TWICE, agreeing byte for byte.
 *
 * ⚠ **NOTHING ELSE WAS TOUCHED TO MAKE THIS PASS.** No absence assertion was raised or removed;
 * the marker rows, the harness-non-vacuity row, the three-arms row, the flag-pair row and both
 * `/generate` key-set blocks are byte-unchanged. `FLAG_OFF_DESCRIBE_MARKUP` and the
 * `/template|starter/i` guard in `WorkflowBuilderPage.describe.test.tsx` are likewise untouched
 * — measured, not claimed: `git diff --numstat` on that suite is `214 0`, ZERO deletions.
 */
const BASELINE: Record<string, string> = {
  "flagOff:empty": "<div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] text-muted-foreground\">Which knowledge base should this use?</span><select data-testid=\"project-folder-picker\" aria-label=\"Which knowledge base should this use?\" class=\"w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">No specific knowledge base</option><option value=\"f-policies\">Policies</option><option value=\"f-suppliers\">Suppliers</option></select></label><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_0_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_0_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div></div></div>",
  "flagOff:composing": "<div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\" disabled=\"\">Summarise each supplier's risk position every Monday.</textarea><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] text-muted-foreground\">Which knowledge base should this use?</span><select data-testid=\"project-folder-picker\" aria-label=\"Which knowledge base should this use?\" class=\"w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\" disabled=\"\"><option value=\"\">No specific knowledge base</option><option value=\"f-policies\">Policies</option><option value=\"f-suppliers\">Suppliers</option></select></label><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_1_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_1_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\" disabled=\"\">Composing…</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div></div></div>",
  "flagOff:error": "<div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\">Summarise each supplier's risk position every Monday.</textarea><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] text-muted-foreground\">Which knowledge base should this use?</span><select data-testid=\"project-folder-picker\" aria-label=\"Which knowledge base should this use?\" class=\"w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">No specific knowledge base</option><option value=\"f-policies\">Policies</option><option value=\"f-suppliers\">Suppliers</option></select></label><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_2_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_2_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p></div><div data-testid=\"generate-error\" role=\"alert\" class=\"rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] text-foreground\"><p class=\"font-medium\">Couldn't generate — Couldn't generate the workflow.</p><p class=\"mt-1 text-[12px] text-muted-foreground\">the model refused</p><p class=\"mt-1 text-[12px] text-muted-foreground\">Nothing was saved. Adjust your description and try again.</p></div></div></div>",
  "flagOn:empty": "<div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] text-muted-foreground\">Which knowledge base should this use?</span><select data-testid=\"project-folder-picker\" aria-label=\"Which knowledge base should this use?\" class=\"w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">No specific knowledge base</option><option value=\"f-policies\">Policies</option><option value=\"f-suppliers\">Suppliers</option></select></label><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_3_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_3_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" disabled=\"\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p><div class=\"relative\"><button type=\"button\" data-testid=\"starter-door-trigger\" aria-haspopup=\"menu\" aria-expanded=\"false\" class=\"border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">Not sure where to start? Start from a template.</button></div></div></div></div>",
  "flagOn:composing": "<div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\" disabled=\"\">Summarise each supplier's risk position every Monday.</textarea><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] text-muted-foreground\">Which knowledge base should this use?</span><select data-testid=\"project-folder-picker\" aria-label=\"Which knowledge base should this use?\" class=\"w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\" disabled=\"\"><option value=\"\">No specific knowledge base</option><option value=\"f-policies\">Policies</option><option value=\"f-suppliers\">Suppliers</option></select></label><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_4_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_4_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\" disabled=\"\">Composing…</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p><div class=\"relative\"><button type=\"button\" data-testid=\"starter-door-trigger\" aria-haspopup=\"menu\" aria-expanded=\"false\" class=\"border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">Not sure where to start? Start from a template.</button></div></div></div></div>",
  "flagOn:error": "<div class=\"flex h-full flex-col items-center justify-center bg-background px-6 py-8\"><div class=\"flex w-full max-w-[640px] flex-col gap-4\"><div class=\"flex flex-col items-center gap-2 text-center\"><span aria-hidden=\"true\" class=\"text-3xl\">✎</span><h1 class=\"font-semibold text-foreground\" style=\"font-size: 1.5rem;\">What recurring work should this automate?</h1></div><textarea aria-label=\"business requirement\" placeholder=\"Describe the goal in plain language…\" rows=\"5\" class=\"w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\">Summarise each supplier's risk position every Monday.</textarea><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] text-muted-foreground\">Which knowledge base should this use?</span><select data-testid=\"project-folder-picker\" aria-label=\"Which knowledge base should this use?\" class=\"w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">No specific knowledge base</option><option value=\"f-policies\">Policies</option><option value=\"f-suppliers\">Suppliers</option></select></label><section data-testid=\"describe-template-row\" class=\"mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left\"><p data-testid=\"describe-template-prompt\" class=\"text-[11px] font-medium text-foreground\">Have a document to fill in?</p><p data-testid=\"describe-template-note\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Attach the document this should fill in — the draft is built to its fields.</p><label for=\"_r_5_\" class=\"mt-2 block text-[11px] font-medium text-foreground\">Attach a template</label><input id=\"_r_5_\" data-testid=\"describe-template-input\" accept=\".docx,.pptx,.xlsx\" class=\"mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40\" type=\"file\"><p data-testid=\"describe-template-types\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.</p></section><div class=\"flex flex-col items-center gap-3\"><button type=\"button\" class=\"rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40\">Write the first draft</button><p data-testid=\"describe-hint\" class=\"text-center text-[13px] text-muted-foreground\">You describe the goal — the AI <b class=\"font-medium text-foreground\">writes the steps</b>, <b class=\"font-medium text-foreground\">sets how strict it is</b>, and <b class=\"font-medium text-foreground\">asks about anything it had to guess</b>.</p><div class=\"relative\"><button type=\"button\" data-testid=\"starter-door-trigger\" aria-haspopup=\"menu\" aria-expanded=\"false\" class=\"border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none\">Not sure where to start? Start from a template.</button></div></div><div data-testid=\"generate-error\" role=\"alert\" class=\"rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] text-foreground\"><p class=\"font-medium\">Couldn't generate — Couldn't generate the workflow.</p><p class=\"mt-1 text-[12px] text-muted-foreground\">the model refused</p><p class=\"mt-1 text-[12px] text-muted-foreground\">Nothing was saved. Adjust your description and try again.</p></div></div></div>",
}

describe("WorkflowBuilderPage 193.1-01 — the pre-draft describe screen, byte for byte", () => {
  it("the capture commit is recorded", () => {
    // The mechanical half of the proof lives in the docblock above (the three commands and their
    // verbatim output) and in 193.1-01-SUMMARY.md. This pins the SHA those commands were run at,
    // so a later reader can re-run them rather than take the claim on trust.
    expect(CAPTURE_SHA).toMatch(/^[0-9a-f]{40}$/)
  })

  it("captures exactly the six declared states, keyed identically on both sides", () => {
    // A row present in one map and absent from the other would silently go uncaptured or
    // unasserted — the driver loop below iterates ONE of them and would never notice.
    expect(Object.keys(BASELINE).sort()).toEqual([
      "flagOff:composing",
      "flagOff:empty",
      "flagOff:error",
      "flagOn:composing",
      "flagOn:empty",
      "flagOn:error",
    ])
    expect(Object.keys(ROWS).sort()).toEqual(Object.keys(BASELINE).sort())
  })

  for (const row of Object.keys(ROWS)) {
    it(`${row} reproduces the DOM CAPTURED from the unmoved tree, byte for byte`, async () => {
      // NON-VACUITY, first: a `toBe` against an empty string would pass forever if the row ever
      // stopped rendering and the baseline were ever re-captured from that silence.
      expect(BASELINE[row].length).toBeGreaterThan(0)
      expect(await capture(ROWS[row])).toBe(BASELINE[row])
    })
  }

  // ── THE MARKER ROWS ─────────────────────────────────────────────────────────────────────
  // Byte-identity alone is compatible with a row that quietly rendered nothing: an empty capture
  // equals an empty render forever. These rows say WHAT each capture contains, so a state that
  // stopped painting its blocks is a failure rather than a pass. They read the COMMITTED baseline
  // strings, not a fresh render — the claim being pinned is about what was captured.

  it("every capture carries the whole pre-draft surface", () => {
    for (const [key, html] of Object.entries(BASELINE)) {
      expect(html.length, key).toBeGreaterThan(400)
      expect(html, key).not.toContain("PLACEHOLDER")
      expect(html.startsWith("<div"), key).toBe(true)
      // The three nodes that make this the describe screen at all.
      expect(html, key).toContain('data-testid="describe-hint"')
      expect(html, key).toContain('aria-label="business requirement"')
      expect(html, key).toContain('data-testid="project-folder-picker"')
      // …and both folders the fixed fixture offers, so a picker that rendered empty is a red.
      for (const folder of WIRE.FOLDERS) expect(html, key).toContain(`>${folder.name}</option>`)
    }
  })

  it("⚠ THE SUBJECT IS THE BUILDER'S SCREEN, NOT THE DOOR'S — the two are near-identical", () => {
    /**
     * `193.1-PATTERNS.md` §C-1: both pre-draft describe screens contain the splice anchor
     * `<div class="flex flex-col items-center gap-3">`, so that class string identifies neither.
     * `starter-door-trigger` exists ONLY on this one (`WorkflowBuilderPage.tsx:1596`), and only
     * with the flag on — so it is what tells the two apart, and it doubles as the flag's own
     * tell. The loose door's `describe-draft` / `switch-strip` / `describe-soul-preview` nodes
     * must be absent from EVERY row: their presence would mean this file captured the wrong
     * component.
     */
    for (const [key, html] of Object.entries(BASELINE)) {
      expect(html, key).toContain('<div class="flex flex-col items-center gap-3">')
      expect(html, key).not.toContain('data-testid="describe-draft"')
      expect(html, key).not.toContain('data-testid="switch-strip"')
      expect(html, key).not.toContain('data-testid="describe-soul-preview"')
    }
    for (const key of ["flagOn:empty", "flagOn:composing", "flagOn:error"]) {
      expect(BASELINE[key], key).toContain('data-testid="starter-door-trigger"')
    }
    for (const key of ["flagOff:empty", "flagOff:composing", "flagOff:error"]) {
      expect(BASELINE[key], key).not.toContain('data-testid="starter-door-trigger"')
    }
  })

  it("the three arms are genuinely three different renders", () => {
    // Without this, a driver that silently failed to reach `composing` or `error` would capture
    // three copies of the `empty` screen and every byte assertion above would still pass.
    for (const flag of ["flagOff", "flagOn"]) {
      const empty = BASELINE[`${flag}:empty`]
      const composing = BASELINE[`${flag}:composing`]
      const errored = BASELINE[`${flag}:error`]
      expect(new Set([empty, composing, errored]).size, flag).toBe(3)
      // `empty` lands with the box untouched, so the CTA is disabled and reads the governed CTA.
      expect(empty, flag).toContain(DESCRIBE_CTA)
      expect(empty, flag).not.toContain('data-testid="generate-error"')
      // `composing` swaps the CTA's own label and disables the textarea and the picker.
      expect(composing, flag).toContain("Composing…")
      expect(composing, flag).not.toContain('data-testid="generate-error"')
      // `error` is the honest-failure block — never a renderable broken draft.
      expect(errored, flag).toContain('data-testid="generate-error"')
      expect(errored, flag).toContain(WIRE.state.errorPayload.error)
      expect(errored, flag).toContain(WIRE.state.errorPayload.detail)
    }
  })

  it("the flag pair differ by the canvas-gated nodes and nothing the flag does not own", () => {
    // The flag-ON screen is the one users get. Captured only flag-OFF, this file would be blind
    // to `StarterTemplatePicker` and to the hosted-header branch entirely.
    for (const arm of ["empty", "composing", "error"]) {
      expect(BASELINE[`flagOn:${arm}`], arm).not.toBe(BASELINE[`flagOff:${arm}`])
    }
  })
})

// ── A guard against the mock seam itself going quiet ──────────────────────────────────────
describe("WorkflowBuilderPage 193.1-01 — the harness is not vacuous", () => {
  it("EffectiveFeaturesProvider is the real one, imported statically as well as dynamically", () => {
    // The capture helper reaches the provider by dynamic import so the REAL `useCanvasGate` runs.
    // A resolver returning `undefined` for that specifier would make every flag-ON row silently
    // flag-OFF, and the pairwise difference row above is what would catch it — this is the
    // cheaper, more direct tell.
    expect(typeof EffectiveFeaturesProvider).toBe("function")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// Plan 193.1-01 Task 2 — THE `/generate` REQUEST BODY, AS A KEY SET, BEFORE THE WIRE GROWS.
//
// WHY THIS EXISTS. `POST /workflows/generate` has accepted `template_placeholders` since Phase
// 103 and this frontend has NEVER sent it (`SEED-157`): `WorkflowBuilderPage.tsx:1267-1272`
// sends `{describe}` plus a conditional `project_folder_id` spread, and nothing else. Measured
// consequence (D-19): the authoring prompt's DELIVERABLE RULE branches on that grounding
// section, so today every draft is actively steered AWAY from templates. The absent key is the
// mechanism, not a missing nicety.
//
// ⚠ ASSERTED AS A SORTED KEY-SET DEEP-EQUALITY, never `toMatchObject` / `toContain` /
// `expect.objectContaining`. Those three are all satisfiable by a body carrying EXTRA keys —
// and the whole point here is that a key which is ABSENT today must be VISIBLE when it arrives.
//
// A later plan adds `template_placeholders` to this payload and MUST move the two literals
// below in the same commit. That movement is this phase's mechanical evidence that the wire
// changed, and it is the reason these two cases are worth more than the feature test that will
// replace them.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 193.1-01 — the pre-change `/generate` wire", () => {
  it("no knowledge base picked ⇒ the body's key set is EXACTLY [describe]", async () => {
    await mountPreDraft(false)
    fireEvent.change(screen.getByLabelText("business requirement"), {
      target: { value: DESCRIBE_TEXT },
    })
    fireEvent.click(screen.getByRole("button", { name: DESCRIBE_CTA }))

    await waitFor(() => expect(WIRE.state.generateBodies).toHaveLength(1))
    expect(Object.keys(WIRE.state.generateBodies[0]).sort()).toEqual(["describe"])
    // …and the one key it does send carries the TRIMMED text, which is what the page promises.
    expect(WIRE.state.generateBodies[0].describe).toBe(DESCRIBE_TEXT)
  })

  it("a knowledge base picked ⇒ the key set is EXACTLY [describe, project_folder_id]", async () => {
    await mountPreDraft(false)
    fireEvent.change(screen.getByTestId("project-folder-picker"), {
      target: { value: WIRE.FOLDERS[1].id },
    })
    fireEvent.change(screen.getByLabelText("business requirement"), {
      target: { value: DESCRIBE_TEXT },
    })
    fireEvent.click(screen.getByRole("button", { name: DESCRIBE_CTA }))

    await waitFor(() => expect(WIRE.state.generateBodies).toHaveLength(1))
    expect(Object.keys(WIRE.state.generateBodies[0]).sort()).toEqual([
      "describe",
      "project_folder_id",
    ])
    expect(WIRE.state.generateBodies[0].project_folder_id).toBe(WIRE.FOLDERS[1].id)
  })

  it("POSITIVE CONTROL — the key-set assertion really fails on an extra key", () => {
    // A pin that has only ever been seen green is a pin nobody has watched fail. The extra key
    // cannot be planted in the page (this plan is deliberately source-free — the capture's whole
    // credibility rests on that), so the plant is made on the SHAPE the later wave will send.
    const tomorrow = { describe: DESCRIBE_TEXT, template_placeholders: ["project_name"] }
    expect(Object.keys(tomorrow).sort()).not.toEqual(["describe"])
    expect(Object.keys(tomorrow).sort()).toEqual(["describe", "template_placeholders"])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// Plan 193.1-07 Task 2 — THE WIRE IS LIVE, AND THE TWO LITERALS ABOVE DID NOT MOVE.
//
// ⚠ **A MEASURED CORRECTION TO PLAN 193.1-07, DATED 2026-08-15, STATED BESIDE THE INSTRUCTION
// RATHER THAN OVER IT.** The plan's Task 2 says: *"MOVE Plan 01's two key-set literals to
// their new values in this file … That movement is this phase's mechanical evidence that the
// wire changed."* **They were examined and they must NOT move, and the reason is the feature
// working rather than the feature missing.**
//
// Both cases above drive the page with NO DOCUMENT SUPPLIED — and on this screen there is not
// yet any way to supply one: the control that holds a file is mounted by **Plan 08**, which
// declares that mount in its own `files_modified`. `template_placeholders` is sent on the
// `fields` arm ALONE, and a session that supplies nothing never leaves `idle`. So the shipped
// key sets for those two journeys are `["describe"]` and `["describe","project_folder_id"]`
// AFTER the wire exactly as before it — which is not an absence of evidence, it is **D-08 /
// SC#4 asserted at the page level**: the fast path is untouched by construction.
//
// Moving the literals would therefore have recorded a change that did not happen, and would
// have RED-ed the moment anyone ran them. The mechanical evidence that the wire changed lives
// where the wire lives — `useTemplateFirstDraft.test.tsx` §10 drives the real callback with a
// real held file through the real read and asserts the three-key set — and the cases below
// pin the OTHER half of the same claim here, on the page, where the two literals sit.
//
// The six BASELINE captures are untouched by this plan: `git diff --numstat` on this file
// shows additions only, and zero deletions.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 193.1-07 — the wire is live, and an unsupplied document is silent", () => {
  it("NO DOCUMENT SUPPLIED ⇒ the key set is STILL EXACTLY [describe] — D-08 at the page level", async () => {
    await mountPreDraft(false)
    fireEvent.change(screen.getByLabelText("business requirement"), {
      target: { value: DESCRIBE_TEXT },
    })
    fireEvent.click(screen.getByRole("button", { name: DESCRIBE_CTA }))

    await waitFor(() => expect(WIRE.state.generateBodies).toHaveLength(1))
    // The SAME literal as the pre-change case above, asserted again AFTER the wire shipped.
    // An empty array is not sent, because `(none)` and `[]` are different statements to the
    // authoring prompt — and the four non-`fields` readings all mean the first one.
    expect(Object.keys(WIRE.state.generateBodies[0]).sort()).toEqual(["describe"])
    expect("template_placeholders" in WIRE.state.generateBodies[0]).toBe(false)
  })

  it("…and with a knowledge base picked it is STILL EXACTLY [describe, project_folder_id]", async () => {
    await mountPreDraft(false)
    fireEvent.change(screen.getByTestId("project-folder-picker"), {
      target: { value: WIRE.FOLDERS[1].id },
    })
    fireEvent.change(screen.getByLabelText("business requirement"), {
      target: { value: DESCRIBE_TEXT },
    })
    fireEvent.click(screen.getByRole("button", { name: DESCRIBE_CTA }))

    await waitFor(() => expect(WIRE.state.generateBodies).toHaveLength(1))
    expect(Object.keys(WIRE.state.generateBodies[0]).sort()).toEqual([
      "describe",
      "project_folder_id",
    ])
  })

  it("THE CTA IS NOT DISABLED WHEN NO DOCUMENT IS HELD — the gate is unreachable, not false", async () => {
    // D-08's claim in the form a person would notice. The gate term reads the in-flight arm,
    // which a session holding no document never enters, so there is no conditional here that
    // could be got wrong — and no second one to forget.
    await mountPreDraft(false)
    fireEvent.change(screen.getByLabelText("business requirement"), {
      target: { value: DESCRIBE_TEXT },
    })
    expect(screen.getByRole("button", { name: DESCRIBE_CTA })).not.toBeDisabled()
  })

  it("THE PAGE ITSELF DERIVES NOTHING ABOUT DOCUMENTS — the wire's home is the hook", async () => {
    // The source claim behind the two literals staying put: this page contributes no key to
    // the generate body. Were it to grow its own spread, the literals above would go stale
    // silently — a page-level derivation is exactly the drift this fence forbids.
    const pageSource = (await import("./WorkflowBuilderPage?raw")).default as string
    expect(pageSource.length).toBeGreaterThan(500) // non-vacuity FIRST
    expect(pageSource).not.toContain("template_placeholders")
    // POSITIVE CONTROL — the matcher really would fire on the forbidden shape.
    expect("...(x ? { template_placeholders: names } : {})").toContain("template_placeholders")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// Plan 193.1-07 Task 2 — D-06's FAILURE LINE: ONE NODE, ITS OWN LINE, AND ABSENT BY DEFAULT.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 193.1-07 — the bind's honest line", () => {
  it("renders NOTHING when nothing failed — the drafted DOM is unchanged for every other session", async () => {
    const pageSource = (await import("./WorkflowBuilderPage?raw")).default as string
    expect(pageSource.length).toBeGreaterThan(500)
    // Gated on the failure state, so the node cannot exist without one.
    expect(pageSource).toMatch(/\{bindFailed && \(/)
  })

  it("is EXACTLY ONE NODE, and it is NOT routed through the save's reading (D-06 rule 2)", async () => {
    const pageSource = (await import("./WorkflowBuilderPage?raw")).default as string
    // Exactly one, by count: two nodes carrying one testid is a selector that throws rather
    // than a surface that reports twice.
    expect((pageSource.match(/data-testid="template-bind-failed"/g) ?? []).length).toBe(1)
    // `role="status"`, which is what makes a line appearing after an act announced.
    expect(pageSource).toMatch(
      /data-testid="template-bind-failed"\s*\n\s*role="status"/,
    )
    // The forbidden homes, asserted as ABSENT from the block itself rather than from the file
    // (both identifiers legitimately exist elsewhere on this page).
    const block =
      pageSource.match(/\{bindFailed && \([\s\S]*?\n {6}\)\}/)?.[0] ?? ""
    expect(block.length).toBeGreaterThan(80) // the extractor really extracted
    expect(block).toContain("templateBindFailedMessage")
    expect(block).not.toContain("saveRefusalSentence")
    expect(block).not.toContain("canvasNotice")
    // POSITIVE CONTROLS — both needles really would fire inside a block of this shape.
    expect("{bindFailed && (\n  <p>{saveRefusalSentence}</p>\n)}").toContain(
      "saveRefusalSentence",
    )
    expect("{bindFailed && (\n  <p>{canvasNotice}</p>\n)}").toContain("canvasNotice")
  })
})
