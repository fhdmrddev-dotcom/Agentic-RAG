/**
 * Phase 200 (the step-panel port, DES-02) — WHAT THIS STEP IS STILL MISSING.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────────────────
 *
 * The reference sheet — `.planning/sketches/200-journey-interactive/screens/step-panel.html`
 * — CLOSES the step panel with a card, pinned to the bottom above a top border, that reads
 * `2 things still missing` over two rows with a jump chevron each. It is the last thing a
 * person sees before they leave the step, and the shipped panel had nothing in that position
 * at all: an author who left a step half-configured found out at publish, or at run.
 *
 * ── ⚠ THE HARD RULE: NEVER INVENT A VALUE, AND NEVER INVENT AN INCOMPLETENESS ───────────
 *
 * A checklist is a CLAIM about the author's work, and a wrong one is worse than none — it
 * either nags about a step that is finished or stays silent on one that is not. So every row
 * below is derived from a field the executor genuinely requires and which genuinely holds
 * nothing. Two candidates the sketch itself draws are deliberately NOT rows, and saying which
 * is the point:
 *
 *   · **`Choose a model` is NOT a row.** A blank `model` is the shipped, documented, correct
 *     state — it means *use the run's model*, and 239 of 257 real phases are in it
 *     (`PhaseFormPanel.test.tsx`). Calling it missing would nag every author about a default.
 *   · **`Connect a knowledge source` is NOT a row.** An empty `folder_scope` is a step that
 *     reads nothing, which plenty of steps legitimately are, and this panel cannot write the
 *     field anyway (see `STEP_CARD_NO_SOURCE_ADD`). A checklist row for a thing the surface
 *     refuses to let you fix is a dead end wearing a chevron.
 *
 * Both are the sketch's PLACEHOLDER content, not a contract — the same status as its
 * `GPT-4o`. What is ported is the CARD, its position and its behaviour; what is not ported is
 * two example rows that would be false against this product's own semantics.
 *
 * ── ⚠ BOTH REFUSALS WERE RE-MEASURED AT THE 200 FE-WIRING PASS AND BOTH STILL HOLD ──────
 *
 * They are re-stated rather than assumed, because a refusal whose reason has quietly gone
 * false is exactly how a stale guard survives — and this project has measured that happening.
 * The two reasons above were checked against the live tree on 2026-08-20, not against this
 * docblock:
 *
 *   · **`Choose a model` — STILL A CORRECT STATE, and the panel now says so out loud.** A
 *     blank `model` does not merely fail to be an error: `PhaseFormPanel` renders it as a
 *     NAMED leading option reading *"Use the run's model (…)"*, pinned by
 *     `PhaseFormPanel.test.tsx`'s *"A BLANK stored model — the case 239 of 257 real phases are
 *     in"*. A checklist row would therefore accuse the author of omitting something the
 *     control beside it presents as a deliberate choice, on 93% of the phases that exist.
 *   · **`Connect a knowledge source` — STILL A DEAD END, on both halves.** `folder_scope` is
 *     still a READ-ONLY display in this panel (`PhaseFormPanel.tsx` — no `set("folder_scope")`
 *     anywhere), and the write it would need is still refused upstream:
 *     `WorkflowDefinition._folder_scope_requires_project` (`backend/app/models/harness.py`)
 *     still raises when a phase declares `folder_scope` on a workflow with no
 *     `project_folder_id`, which under D-186-04 leaves a permanently unsaveable draft.
 *
 * ⚠ RE-OPEN TRIGGER for the second one, dated rather than permanent: the phase that gives
 * this panel a `folder_scope` write seam AND resolves the 422 — at that point the row stops
 * being a chevron pointing at nothing and becomes owed. The first has no trigger short of the
 * product deciding a blank model is an error, which would be a change to what a workflow IS.
 *
 * ⚠ AND WHEN NOTHING IS MISSING, NOTHING RENDERS. Never `0 things still missing`, never a
 * green "all set" — a zero-state congratulation is a claim that the step is COMPLETE, which
 * is a much stronger statement than "none of the four fields we can check is blank", and the
 * publish gauntlet is the surface that is allowed to make it.
 *
 * ── A LEAF, FOR THE USUAL MEASURED REASON ───────────────────────────────────────────────
 *
 * `react-refresh/only-export-components` forbids a component file exporting shared non-component
 * values; 27 files in this tree answer that with a sibling leaf and there are zero
 * `eslint-disable`s of it. ⚠ And the `Context` suffix is load-bearing rather than decorative:
 * a leaf whose name differs from its component sibling ONLY IN CASE is a hard TypeScript error
 * on a case-insensitive filesystem (TS1149/TS1261 — measured on this Windows box at 199-06).
 */

/** The DOM ids the jump rows scroll to. One home, so a row can never aim at nothing. */
export const STEP_ANCHOR_WHAT_IT_DOES = "step-card-what-it-does"
export const STEP_ANCHOR_OUTSIDE = "step-card-outside"
export const STEP_ANCHOR_FILES = "step-card-files"

/** One thing the step still owes, and where the person goes to give it. */
export interface StepGap {
  /** A stable id for a fence to name the row by. */
  id: string
  /** The plain, verb-first ask — the sheet's own register. */
  label: string
  /** The `id` of the card that fixes it. */
  anchorId: string
}

/** The types whose executor reads `prompt`. A step of these types with a blank one has not
 *  been told what to do, which is the one incompleteness no default can cover. */
const PROMPT_BEARING = [
  "llm_single",
  "llm_agent",
  "llm_batch_agents",
  "llm_human_input",
  "llm_emit",
]

/** The facts the panel already holds. Nothing here is fetched, derived or guessed. */
export interface StepReadinessInput {
  phaseType: string
  /** `config.prompt`, already stringified by the caller. */
  prompt: string
  /** `config.fn`, already stringified by the caller. */
  fn: string
  /**
   * The SENTENCE for the chosen external capability, or `undefined` when nothing the closed
   * set carries was chosen.
   *
   * ⚠ THE CALLER RESOLVES IT, this module does not. `outsideChangeSentence` is the one home
   * for that lookup and it reads through `own()`; re-doing the lookup here would be the
   * second copy the one-home rule exists to prevent, and a bracket read would be the ninth
   * live WR-04 prototype-key sink in this tree.
   */
  outsideSentence: string | undefined
  /**
   * Whether the caller is WIRED for templates at all, and if so what is bound.
   *
   * ⚠ `undefined` MEANS "WE WERE NOT TOLD", NOT "NOTHING IS ATTACHED", and the two must not
   * collapse. Every other mount of this panel passes no template prop, so treating absence as
   * emptiness would make a checklist row appear on surfaces that have no attach control to
   * satisfy it with.
   */
  template?: { filename?: string }
}

/**
 * Everything this step still owes, in the order the panel's cards appear.
 *
 * Pure, total, and it returns an ARRAY rather than a count — a count cannot be rendered as
 * rows, and rows are what make the card actionable rather than accusatory.
 */
export function stepGaps(input: StepReadinessInput): StepGap[] {
  const gaps: StepGap[] = []

  if (PROMPT_BEARING.includes(input.phaseType) && input.prompt.trim() === "") {
    gaps.push({
      id: "prompt",
      label: "Say what this step should do",
      anchorId: STEP_ANCHOR_WHAT_IT_DOES,
    })
  }

  if (input.phaseType === "programmatic" && input.fn.trim() === "") {
    gaps.push({
      id: "fn",
      label: "Name the function this step runs",
      anchorId: STEP_ANCHOR_WHAT_IT_DOES,
    })
  }

  if (input.phaseType === "external_action" && input.outsideSentence === undefined) {
    gaps.push({
      id: "capability",
      label: "Choose what this step changes outside the workflow",
      anchorId: STEP_ANCHOR_OUTSIDE,
    })
  }

  // ⚠ `input.template !== undefined` FIRST — see the prop's own note. An unwired caller is
  // told nothing about templates and is therefore owed no row about one.
  if (
    input.phaseType === "llm_emit" &&
    input.template !== undefined &&
    (input.template.filename ?? "").trim() === ""
  ) {
    gaps.push({
      id: "template",
      label: "Attach the file this step fills in",
      anchorId: STEP_ANCHOR_FILES,
    })
  }

  return gaps
}

/**
 * The card's heading, pluralised.
 *
 * ⚠ IT IS NEVER CALLED WITH `0` — the card does not render at zero, and the caller's guard is
 * what makes that true. This function stays total anyway rather than throwing, because a
 * heading that crashes a panel is a worse failure than a heading nobody should have asked for.
 */
export function stillMissingHeading(count: number): string {
  return `${count} thing${count === 1 ? "" : "s"} still missing`
}
