/**
 * Phase 197-07 (AUTH-02 / ROADMAP SC#1, sketch 174, D-07 / D-08 / D-16 / D-17 / D-18 /
 * D-20) — DecisionsList.
 *
 * THE FIVE CHOICES THE GENERATION MADE ON THE AUTHOR'S BEHALF, MADE ANSWERABLE. A drafted
 * workflow arrives with a knowledge base bound, a template bound or not, a requirement
 * written, a name picked and a deliverable decided — none of which the author was asked
 * about. `SeedReceipt` next door explains the SAFETY the generation applied; this sibling
 * covers the other half, the ordinary decisions, and it does not merely report them: every
 * row hands the author to the control that already exists for that question.
 *
 * ── ALWAYS FIVE, ALWAYS THE SAME ORDER, AND THAT IS A CONSEQUENCE RATHER THAN A HABIT ──
 * The rows are produced by mapping `DECISION_ROW_ORDER`, the tuple `decisionsVocabulary`
 * exports as DATA. Writing five blocks in sequence would make the count a property of this
 * author's care; mapping the exported order makes it a property of the module, checkable
 * at the module level and by a count here. D-07 rejected *only the rows needing attention*
 * and *the weak ones flagged* for a measured reason: both need a per-row "did the AI get
 * this right?" predicate, and for the requirement row NO SUCH PREDICATE EXISTS (`SEED-163`
 * measured `gpt-5.5` naming one-run parameters in 5 of 5 requirements, all 20 of which were
 * still correctly stamped, because the stamp's question is the anti-echo one).
 *
 * ── THE FOUR THINGS THIS COMPONENT IS NOT ALLOWED TO DO ──
 * Copied from `SeedReceipt`'s charter, whose own suite enforces each clause with a `?raw`
 * fence and a positive control. This sibling adopts them deliberately, and its suite
 * carries the matching fences.
 *
 *  1. IT AUTHORS NO SENTENCE OF ITS OWN. Every user-visible string is an identifier
 *     imported from `decisionsVocabulary` — the one exception being the requirement
 *     verdict, which is the SERVER's sentence arriving on the wire and rendered verbatim.
 *     A sentence that lives inside a component is a sentence nobody can test for drift.
 *  2. IT DECLARES NO PREDICATE OF ITS OWN. It does not decide whether a requirement is
 *     durable, a name is good or a draft is publishable. D-16 binds every string here: the
 *     card says A MODEL WROTE THIS, and never THIS IS GOOD.
 *  3. IT OPENS NO REQUEST AND NAMES NO ROUTE. Its ONE contact with the API client module
 *     is a type-only import for the readiness shape, asserted as type-only rather than
 *     merely absent — a fence that passes because the import was deleted proves nothing.
 *  4. IT RENDERS EVERY SERVER- AND MODEL-AUTHORED STRING AS A PLAIN REACT TEXT CHILD. The
 *     workflow name, the requirement text and the template filename are all model- or
 *     user-authored. React escapes text children; the raw-HTML prop is never used here
 *     (T-197-19, the `SeedReceipt` rule).
 *
 * ── THE READINESS READ HAS THREE ARMS, AND THE THIRD IS ABSENCE (D-20 · T-197-03) ──
 * D-20 is a MEASUREMENT, not a preference. Research enumerated every gauntlet stage from
 * source: stage 1's `business_requirement_missing` is the ONLY definition-level predicate.
 * Nothing anywhere refuses a publish for a missing knowledge-base binding, a missing
 * template, an AI-chosen name or the deliverable. So exactly ONE row may borrow the gate's
 * register, and it borrows the gate's actual sentence; the other four say only *here is
 * what I chose*.
 *
 * The three arms:
 *   • `readiness` ABSENT   → the row renders its answer and NO verdict node at all.
 *   • status is missing    → the server's own `message`, verbatim, as a text child.
 *   • status is present    → NO verdict node — exactly what absence renders.
 * The second and third bullets are why absence can never be mistaken for a pass: they are
 * indistinguishable to the author, and the suite asserts that directly. The shape a
 * default object would give this read is forbidden by an acceptance grep, and a boolean
 * coercion is what turns *the server did not say* into *the server said yes*.
 *
 * ── ROWS 2 AND 5 ARE ONE MECHANISM (D-18) ──
 * Both jump to the step that produces the deliverable, and both render NO action at all
 * when there is no such step, because an action that selects nothing is worse than no
 * action. Row 2 deliberately does not mount `DescribeTemplateRow` (it needs a `state`
 * nobody produces on the drafted view) or `TemplateAttachSection` (it consults the server
 * keyed on a SAVED definition id, which a fresh draft does not have until its first
 * PATCH). It states the filename and hands the author to the step where the real field is
 * already mounted. Inline-editing the emit prompt on the row was rejected: it would put
 * Instructions in two places at once, against the page's own rule — *a second, different
 * answer to one question is drift.*
 *
 * ⚠ A KNOWN NARROWING OF ROW 5, STATED RATHER THAN SMOOTHED. `deliverableStepSlug` is
 * `terminalEmitSlug`'s answer, and 197-04 measured that it is `null` for TWO distinct
 * causes: there is no emit step, and there IS one whose slug cannot select anything. Both
 * mean *render no jump control*, which is why one prop drives the action. Row 5's ANSWER
 * is keyed on the same prop by this plan's binding props contract, so in the second case
 * the row says the workflow answers in chat while `soulDeliverable` would say `file`. The
 * honest fix is a separate deliverable prop, which would change a contract two later plans
 * are already written against. Re-open trigger: the first plan that widens this props
 * contract for any other reason.
 *
 * ── D-08, AND THE CORRECTION IS THE USEFUL PART ──
 * Row 5 covers the deliverable and NOTHING else. The original decision was to surface
 * 193.2's suppression of a step that pauses to ask the human, and that premise was
 * measured FALSE: 193.2's fix is a PROMPT CLAUSE (`workflow_authoring.py:141`), not a
 * post-hoc deletion, and its own comment binds the claim — *a prompt clause reduces how
 * often the model composes such a step; it can never guarantee absence.* Nothing is
 * removed, so there is no event to surface. There is no suppression line here.
 *
 * ── D-17 — ROW 4 EDITS IN PLACE ──
 * A controlled field whose value is the `name` prop and whose change handler forwards the
 * RAW value: no trimming, no empty-check. The store owns the write; a client rule here
 * would be the second copy D-182-06 forbids.
 *
 * ⚠ CORRECTED BY WR-01 (2026-08-18), and the original is named rather than quietly
 * rewritten: this docblock said *"the server owns emptiness"*, and that is MEASURED FALSE
 * for this field. The server's rule is `business_requirement_missing`, which is about a
 * DIFFERENT field; nothing anywhere refuses an empty workflow NAME, and `db/workflows.py`
 * writes it through with `SET name = $3`. So an author clearing this field really did
 * persist a blank title into the library. The no-trim policy SURVIVES the correction — it
 * is still right that this component invents no validation rule — but it survives on the
 * honest ground that the value is the author's, not on a server guarantee that does not
 * exist. The blank is handled where it is READ, by `libraryDisplayName`.
 * `ForkNameDialog` is declined by D-17 — it exists for naming a copy that does not yet
 * exist, whereas here the name already exists and is being edited, and a modal for one of
 * five rows breaks the surface's own grammar.
 *
 * ── A PURE PROJECTION, AND A LEAF ──
 * No local state hook, no ref hook, no cache: every answer is recomputed from props on
 * every render, which is exactly what makes a SECOND generation replace the first one's
 * card (the `SeedReceipt` D-187-09 property). Every answer is read LIVE off the definition
 * by the CALLER — the shipped `requirementIsAiProposed` idiom — so these are what the
 * definition says NOW, not what the generation said.
 *
 * ── 199-04 · ONE PRESENTATION ROW ADDED, AND NOTHING ELSE (DES-01) ──
 * Sketch 178's sheet `c5-draft-arrival` was reconciled against this component element by
 * element. Almost all of it is REFUSED and the refusals are the deliverable: the sheet
 * draws a per-row status badge — an affirmative word on a satisfied row, a "we need you"
 * word on a failing one, a grey caption on an unknown one — and that shape is exactly what
 * the three-arm contract above exists to forbid, because an affirmative badge on a PRESENT
 * readiness makes the present arm distinguishable from the ABSENT one. The sheet also
 * invents its own five row subjects and its own colour palette, neither of which is this
 * application's. The one thing the sheet asked for that this surface could express and did
 * not is the ROW WASH — see `ROW_HOVER_CLASS` below. Full reconciliation:
 * `.planning/phases/199-the-component-map/199-04-SUMMARY.md`.
 *
 * ⚠ NAME IDENTIFIERS, NEVER FORBIDDEN SPELLINGS, IN EVERY COMMENT HERE. The suite's fences
 * read this file's RAW source, and `196-08` tripped that trap four times — once inside the
 * comment written to explain the first three.
 */
import { useId } from "react"

import {
  DECISION_CHANGE_ACTION,
  DECISION_DELIVERABLE_CHAT,
  DECISION_DELIVERABLE_FILE,
  DECISION_EDIT_LIMIT_NOTE,
  DECISION_KB_NONE,
  DECISION_NAME_FIELD_LABEL,
  DECISION_NAME_NONE,
  DECISION_OPEN_STEP_ACTION,
  DECISION_REQUIREMENT_NONE,
  DECISION_ROW_ORDER,
  DECISION_TEMPLATE_NONE,
  decisionRowLabel,
} from "@/components/workflows/decisionsVocabulary"
import type { GenerateReadiness } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface DecisionsListProps {
  /** ── LIVE. Read off the definition by the CALLER on every render, with no mirrored
   *  copy — the shipped `requirementIsAiProposed` idiom. These are what the definition
   *  says NOW, not what the generation said. ── */
  /** The bound knowledge base's display name, or `null` when unbound. Resolved by the
   *  caller off its own `folderOptions`; this component looks nothing up. */
  folderName: string | null
  /** The bound template's filename, or `null` when none is bound. */
  templateFilename: string | null
  /** The durable business requirement. `""` when absent — never `null`. */
  businessRequirement: string
  /** The workflow's name. `""` when absent — never `null`. */
  name: string
  /** The step that produces the deliverable, from `terminalEmitSlug`. `null` when the
   *  workflow answers in chat. Rows 2 and 5 both jump here — ONE mechanism. */
  deliverableStepSlug: string | null

  /** ── SNAPSHOT. What the server said about ONE generation. ⚠ ABSENT means the server
   *  said nothing, and must never render as a pass. ── */
  readiness?: GenerateReadiness

  /** ── Actions. All REQUIRED (the 192.1 rule): a required member makes the typechecker
   *  enumerate the call sites where a default would let one hide. ── */
  onChangeKb: () => void
  onChangeRequirement: () => void
  onOpenStep: (slug: string) => void
  onChangeName: (name: string) => void
}

const ROW_ACTION_CLASS =
  "shrink-0 rounded px-1.5 py-px text-[11.5px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"

/**
 * ── 199-04 · THE ROW WASH — the one row of sheet `c5-draft-arrival` this surface could
 * express and did not (DES-01) ────────────────────────────────────────────────────────
 *
 * MEASURED ABSENT BEFORE THE CHANGE: `grep -n "hover:"` over this file returned exactly
 * ONE line, and it was the action control's own `text` change. The ROW carried no response
 * at all — on a list whose every control is an 11.5px dotted-underline word, which is a
 * small target beside a long answer. A wash is what tells a reader which row the control
 * they are about to click belongs to.
 *
 * ⚠ FILL ONLY, AND NO GEOMETRY. It emits no padding, no margin, no radius and no
 * transform, so the list's declared vertical box is byte-identical before and after — the
 * `SEED-184` complaint is about hierarchy, and answering it by growing the surface would
 * be answering a different question. It is also NOT applied to every row: see below.
 *
 * ⚠ THE COLOUR IS A THEME TOKEN THAT RESOLVES, AND THAT WAS CHECKED RATHER THAN ASSUMED.
 * Sheet c5 draws this wash in a Material-3 palette (`surface-variant`), and **not one of
 * that palette's tokens exists in `tailwind.config.js`** — measured: 15 of the sheet's 18
 * colour candidates resolve to nothing, which is the `bg-warning` failure `192.2` shipped
 * unguarded. `accent` is the shipped Deep Midnight token, already used at this exact
 * opacity by `DraftArrivalCard`, `BuilderSaveRegion` and `GovernanceSection`.
 */
const ROW_HOVER_CLASS = "transition-colors duration-150 hover:bg-accent/30"

export function DecisionsList({
  folderName,
  templateFilename,
  businessRequirement,
  name,
  deliverableStepSlug,
  readiness,
  onChangeKb,
  onChangeRequirement,
  onOpenStep,
  onChangeName,
}: DecisionsListProps) {
  const nameFieldId = useId()

  // Bound to a const so the jump callbacks below narrow without a non-null assertion.
  // Rows 2 and 5 share it: one slug, one handler, one absence rule.
  const stepSlug = deliverableStepSlug

  // ── THE THREE ARMS (D-20 / T-197-03) ──
  // ABSENT is its own arm and resolves to `null` here, exactly as `present` does, so the
  // two are rendered identically downstream. Nothing below can distinguish them, which is
  // the property that stops an absence reading as a pass.
  //
  // ── THE FOURTH CONDITION IS A STALENESS GUARD, ADDED BY CR-01 (2026-08-18) ──────────
  // `readiness` is a SNAPSHOT of one `POST /generate` (written once, in the page's
  // `onDrafted` handler, and never recomputed); `businessRequirement` is LIVE off the
  // definition. Without the guard the two halves of ONE row run on two clocks, and the
  // stale half renders the gate's IMPERATIVE — "Add the Business requirement … before
  // publishing" — underneath the requirement the author just added. Three clicks
  // reproduced it: arrive with a `missing` verdict, press this row's own Change, type.
  //
  // ⚠ IT IS NOT A SECOND PREDICATE, AND CLAUSE 2 OF THE CHARTER ABOVE STILL HOLDS. This
  // does not decide whether a requirement is durable, sufficient or publishable, and it
  // re-implements no part of `business_requirement_missing` — that predicate has ONE home
  // (`grounding.py`) and keeps it. What this expresses is narrower: a sentence computed
  // over an input may not outlive a visible change to that input. The server still owns
  // the verdict; this only stops the client from repeating it after its premise is gone.
  //
  // ⚠ THE INVERSE ARM IS DELIBERATELY SILENT, AND THAT IS A LIMITATION RATHER THAN A FIX.
  // A `present` snapshot survives the author CLEARING the requirement, and the card then
  // says nothing about a gate about to refuse. Silence is the `undefined` arm's own
  // semantics — *the server did not say* — and it is not a pass, because absence and green
  // already render identically here. Manufacturing a warning would require deciding
  // publishability in this component. RE-OPEN TRIGGER: the first surface that needs the
  // card to WARN rather than fall silent, at which point the verdict must be re-fetched or
  // recomputed server-side, never derived here.
  const requirementVerdict =
    readiness !== undefined &&
    readiness.business_requirement.status === "missing" &&
    businessRequirement === ""
      ? readiness.business_requirement.message
      : null

  return (
    <div
      data-testid="decisions-list"
      // Derived from the exported tuple, never from a literal — the count is the module's
      // property, and this attribute is what makes it checkable from the outside.
      data-row-count={DECISION_ROW_ORDER.length}
      className="w-full"
    >
      <ul className="flex flex-col divide-y divide-border/50">
        {DECISION_ROW_ORDER.map((key) => {
          let answer: React.ReactNode
          let action: React.ReactNode = null
          let verdict: React.ReactNode = null

          switch (key) {
            case "knowledge-base":
              answer = folderName !== null && folderName !== "" ? folderName : DECISION_KB_NONE
              action = (
                <button
                  type="button"
                  data-testid="decision-action-knowledge-base"
                  onClick={onChangeKb}
                  className={ROW_ACTION_CLASS}
                >
                  {DECISION_CHANGE_ACTION}
                </button>
              )
              break
            case "template":
              answer =
                templateFilename !== null && templateFilename !== ""
                  ? templateFilename
                  : DECISION_TEMPLATE_NONE
              action =
                stepSlug !== null ? (
                  <button
                    type="button"
                    data-testid="decision-action-template"
                    onClick={() => onOpenStep(stepSlug)}
                    className={ROW_ACTION_CLASS}
                  >
                    {DECISION_OPEN_STEP_ACTION}
                  </button>
                ) : null
              break
            case "requirement":
              answer =
                businessRequirement !== "" ? businessRequirement : DECISION_REQUIREMENT_NONE
              action = (
                <button
                  type="button"
                  data-testid="decision-action-requirement"
                  onClick={onChangeRequirement}
                  className={ROW_ACTION_CLASS}
                >
                  {DECISION_CHANGE_ACTION}
                </button>
              )
              // The ONLY verdict on this surface, and it is not authored here.
              verdict =
                requirementVerdict !== null ? (
                  <p
                    data-testid="decision-verdict-requirement"
                    className="mt-1 pl-[136px] text-[11.5px] leading-[1.45] text-muted-foreground"
                  >
                    {requirementVerdict}
                  </p>
                ) : null
              break
            case "name":
              // D-17 — the field IS the action. No sibling control on this row.
              answer = (
                <input
                  id={nameFieldId}
                  type="text"
                  data-testid="decision-name-input"
                  aria-label={DECISION_NAME_FIELD_LABEL}
                  placeholder={DECISION_NAME_NONE}
                  value={name}
                  onChange={(e) => onChangeName(e.target.value)}
                  className="min-w-0 w-full bg-transparent font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )
              break
            case "deliverable":
              answer = stepSlug !== null ? DECISION_DELIVERABLE_FILE : DECISION_DELIVERABLE_CHAT
              action =
                stepSlug !== null ? (
                  <button
                    type="button"
                    data-testid="decision-action-deliverable"
                    onClick={() => onOpenStep(stepSlug)}
                    className={ROW_ACTION_CLASS}
                  >
                    {DECISION_OPEN_STEP_ACTION}
                  </button>
                ) : null
              break
            default: {
              // A 6th `DecisionRowKey` is a TYPECHECK error here rather than a blank row.
              const _never: never = key
              void _never
              answer = null
            }
          }

          // ── 199-04 · IS THERE ANYTHING HERE FOR THE CURSOR TO REACH? ──────────────
          // DERIVED from what the switch above already produced, never re-decided. Rows 2
          // and 5 render NO jump when there is no producing step, and a row that lit up
          // under the cursor there would promise an interaction that does not exist — the
          // `199-01` argument for suppressing the canvas node's hover in run mode, applied
          // to a row. Row 4 is the second term and not an oversight: D-17 makes its FIELD
          // its action, so it carries no sibling control for `action !== null` to see.
          const interactive = action !== null || key === "name"

          return (
            <li
              key={key}
              data-testid={`decision-row-${key}`}
              data-row-key={key}
              // Published so the rule above is checkable from the DOM rather than from a
              // class-string grep — the sibling attribute sweep demands a query for it.
              data-row-interactive={interactive}
              className={cn("py-[5px] text-[12.5px]", interactive && ROW_HOVER_CLASS)}
            >
              <div className="flex items-baseline gap-2">
                <span className="w-[128px] shrink-0 text-muted-foreground">
                  {decisionRowLabel(key)}
                </span>
                <span
                  data-testid={`decision-answer-${key}`}
                  className={cn(
                    "min-w-0 flex-1 font-medium text-foreground",
                    key !== "name" && "truncate",
                  )}
                >
                  {answer}
                </span>
                {action}
              </div>
              {verdict}
            </li>
          )
        })}
      </ul>

      {/* D-03's limit, STATED rather than hidden — a limit an author discovers by being
          surprised is worse than one line of copy. */}
      <p
        data-testid="decisions-limit-note"
        className="mt-2 text-[11.5px] leading-[1.45] text-muted-foreground"
      >
        {DECISION_EDIT_LIMIT_NOTE}
      </p>
    </div>
  )
}
