/**
 * Phase 188.2-04 Task 1 (D-04) — phaseNodeCardContract.
 *
 * THE PHASE CARD'S SLOT CONTRACT, AND NOTHING ELSE. The fourteen slots `PhaseNodeCard`
 * paints, plus the badge budget and the two aliases its callers name. This is the surface
 * 185 / 188 / 189 add DATA to, so it is cut out on its own: 189 was to add a slot to a
 * contract of this size rather than to a 797-line component.
 *
 * ⚠ UPDATED AT 189-15, AND THE SENTENCE ABOVE IS KEPT BECAUSE IT IS THE RECORD OF WHY
 * 188.2 CUT WHERE IT DID — put into the past tense rather than deleted. The prediction has
 * now been tested and it came in UNDER budget: 189 spent badge slot 1 on the
 * state-conditional "Not connected" label (D-12 / D-18) and added NO slot at all. Not one
 * line of this file, of `PhaseNodeCard.tsx`, or of the other four fenced modules changed to
 * carry it — the whole feature is a second `BadgeSlot` object and an explicit-branch tuple
 * in the ADAPTER, arriving through the `badges` prop that already existed. The badge budget
 * is now FULL: both slots are taken and a third is a typecheck error (see `BadgeSlots`).
 *
 * A LEAF, AND A TYPES-ONLY ONE. It emits no runtime code whatsoever — six exported type
 * names, five type-only imports, zero values — so nothing in it can be called, mutated or
 * hot-reloaded, and it cannot participate in a value-level module cycle at all.
 *
 * ⚠ IT IS THE DIRECTORY'S FIRST TYPES-ONLY MODULE, and that is a MEASUREMENT rather than
 * an oversight. All 11 camelCase `.ts` leaves here — `builderStore`, `canvasModel`,
 * `canvasNudge`, `definitionOps`, `deriveTier`, `editAffordance`, `nodePresentation`,
 * `phaseVocabulary`, `runVocabulary`, `soulData`, `verdictModel` — export at least one
 * runtime value (measured, 11 of 11). A reader looking for a precedent for this shape in
 * this directory will not find one; the house ORDERING it copies is `deriveTier.ts:24-50`
 * (exported aliases first, then the exported interface, one docblock per member).
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future.
 * `BadgeSlot`, `BadgeSlot2Tuple`, `BadgeSlots`, `NodeVerdictMark`, `NodeRunStatus` and
 * `PhaseNodeCardProps` were MOVED here VERBATIM out of `PhaseNodeCard.tsx`, where they are
 * declared at `:139-285` (that file measured 797 L at HEAD `42b42cb7`, and 797 L still at
 * the commit that created this one). **AT THIS COMMIT THE CARD STILL DECLARES ITS OWN
 * COPIES AND IMPORTS NONE OF THESE**, and both trees typecheck — this is deliberately the
 * ADDITIVE half of 188.1's proven split of an extraction into *create additively*, then
 * *cut*, which is what makes the phase's diff read as a MOVE under `git diff --numstat`
 * rather than as a rewrite a reviewer has to re-derive. `188.2-06` performs the cut, and
 * it is specified as a HARD CUT: the card will declare none of the six any more, will
 * import them back from here, and NO re-export shim will be left behind. Any sentence
 * here claiming the cut has already happened would be false at this commit, so none is
 * written — a docblock that runs ahead of its own tree is the exact defect this phase's
 * verbatim-move rule exists to prevent.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED DOCBLOCKS POINT AT THE PRE-MOVE
 * `PhaseNodeCard.tsx` (797 L), not at this file. They are KEPT STALE ON PURPOSE, exactly
 * as 188.1 kept `editAffordance.ts`'s and `PlaneEditingLayer.tsx`'s: nothing below this
 * header was re-typed, re-ordered or tidied, including anything that is wrong. A
 * correction folded into a move commit destroys the one cheap check a reviewer has that a
 * behaviour-preserving change preserved behaviour. (One paragraph in the sibling leaf
 * `ownProperty.ts` IS rewritten, and it is named there as a DECISION — D-05 — rather than
 * slipped in as a tidy. Nothing in THIS file is edited at all.)
 *
 * These paragraphs are kept honest by machine, not by habit. `PhaseNodeCard.test.tsx`
 * reads this file's SOURCE through the 188.2-01 subtree fence — an `import.meta.glob`
 * `?raw` sweep whose path list already named `./phaseNodeCardContract.ts` before this file
 * existed — so the 17 negative scope fences that guarded these types inside the card now
 * read them HERE rather than quietly covering 147 fewer lines. A second fence in the same
 * suite forbids this module from naming a `PhaseNodeCard` specifier in ANY import form —
 * static, dynamic, re-export or type-only — because after the cut the card references the
 * extracted components as JSX values at module scope, and an import back would close a
 * live ESM cycle that typechecks clean, lints clean and fails only at RUNTIME.
 *
 * EVERY IMPORT BELOW IS `import type`, and that is required rather than stylistic:
 * `verbatimModuleSyntax: true` is on in `tsconfig.app.json`. Note the card's own line
 * `:113` is a VALUE import of `StatusChip` together with its `ChipTone` type, because the
 * card renders the chip; this leaf needs only the type, and splitting the two is what the
 * leaf rule requires rather than tidying.
 */
import type { ReactNode } from "react"

import type { ChipTone } from "@/components/org/StatusChip"
import type { VerdictMarkKind } from "@/components/workflows/nodePresentation"
import type { CanvasReading } from "@/lib/phaseState"
import type { EmitFailure } from "@/types"

// ── The slot contract ───────────────────────────────────────────────────────────

/**
 * One word-badge. The WORD carries the meaning — `tone` is decoration and `glyph`,
 * when present, is rendered `aria-hidden` beside it (WCAG 1.4.1, never colour alone).
 *
 * `dataAttr` is spread onto the badge's WRAPPER, not onto the chip: the shipped
 * canvas suite selects on wrappers such as `[data-waits-for-you]` while `StatusChip`
 * owns its own `data-testid` / `data-tone`.
 */
export interface BadgeSlot {
  /** The chip's stable test hook — e.g. `"canvas-waits-for-you"`. */
  testId: string
  /** The shared three-tone org vocabulary. Domain→tone mapping stays at the CALLER,
   *  per `StatusChip`'s own scope rule — this file ships no such table. (Phase 185
   *  deleted `nodePresentation.GROUNDING_TONE` along with the badge it coloured;
   *  governance spends no colour and no badge slot.) */
  tone: ChipTone
  /** The visible label. A plain string, rendered as a React text child. */
  label: string
  /** An optional decorative mark rendered `aria-hidden` before the label. */
  glyph?: string
  /** Data attributes for the wrapper `<span>` — the canvas suite's selectors. */
  dataAttr?: Record<string, string>
}

/**
 * **THE 137-B TWO-BADGE BUDGET, ENFORCED BY THE TYPE SYSTEM.**
 *
 * A max-2 tuple union. Zero, one or two badges are representable; a third is a
 * TYPECHECK ERROR, not a review comment. That is deliberate and it is the mechanism
 * D-184-06 asks for: Phase 185 physically cannot spend this surface's badge budget on
 * a graded-governance chip, and Phase 188's run state cannot quietly become badge
 * three. No tool chips, no gate identifiers, no `phase_index` on the face (D-183-07).
 */
export type BadgeSlot2Tuple = readonly [BadgeSlot, BadgeSlot]
export type BadgeSlots = readonly [] | readonly [BadgeSlot] | BadgeSlot2Tuple

/**
 * The per-node validation mark (VALID-03). **Declared in 184-03, rendered by 184-08.**
 *
 * The slot exists here so the marks land as DATA on an existing card rather than as a
 * layout change to it — and that is exactly how it played out: 184-08 filled it by
 * changing this component's body and nobody else's contract. The adapter still does
 * not pass it in 184; 184-13 is where a canvas node first carries one.
 *
 * Every value is a SERVER verdict (D-182-06 / VALID-03 — the client never guesses a
 * severity). The colour budget stays with Phase 188: 184's marks are a red ✕ for
 * `error` and a dashed grey ○ for `incomplete`, so a 3-`incomplete` / 0-`error` draft
 * renders with zero destructive-token elements.
 *
 * The literal union itself lives in `nodePresentation` beside the table that renders
 * it, because a component module may not export shared constants (`react-refresh/
 * only-export-components` says so, and it is right — a const re-created on every hot
 * reload is a stale-identity bug waiting to happen). This alias keeps the name every
 * caller already knows.
 */
export type NodeVerdictMark = VerdictMarkKind

/**
 * The live run-state slot. **Declared in 184-03, FILLED by Phase 188 (plan 188-06).**
 *
 * IT IS NO LONGER OPAQUE. 184 had no run state at all, so declaring the literals then
 * would have been inventing them, and the alias was left as a bare string on purpose so
 * that 188 could narrow it later. That is exactly what happened here, and the seam paid
 * off precisely as D-184-06 predicted: narrowing it broke NO caller, because 184 shipped
 * none — the adapter never passed the slot and the card rendered nothing for it.
 *
 * The union itself is `CanvasReading`, imported from `lib/phaseState` rather than
 * re-typed here. That is load-bearing: `canvasReading()` is the ONE function that turns
 * a run row into a reading (and the one named place `retrying` collapses into running),
 * so re-spelling the seven members in this file would create a second, drift-prone copy
 * of the very union SPEC Req 4's subset property is stated over.
 */
export type NodeRunStatus = CanvasReading

export interface PhaseNodeCardProps {
  /** The phase slug — node identity, and the `canvas-node-<slug>` test hook. */
  slug: string
  /** The raw `phase_type` discriminator, surfaced as a data attribute only. */
  phaseType: string
  /** The resolved 3D mark. A `ReactNode` because the resolution is a module-scope
   *  lookup (`nodePresentation.renderPhaseMark`), never a component bound in a body. */
  icon: ReactNode
  /** The one title line. The adapter decides plain-language vs the ⌥ technical form,
   *  so there is exactly ONE technical-names state in the app. */
  title: string
  /** The one supporting line. An empty string renders nothing. */
  subtitle?: string
  /**
   * Phase 200 (canvas port) — does `subtitle` carry a MACHINE IDENTIFIER rather than a
   * sentence? It changes exactly one thing: whether that line may be truncated.
   *
   * ⚠ IT EXISTS BECAUSE TWO CORRECT RULES COLLIDED, and neither could simply win.
   * `screens/builder-canvas.html` truncates its supporting line on all ten of its nodes,
   * and the sketch is the absolute reference for LAYOUT. But 187-09 moved the ⌥
   * Technical-names reveal OUT of the title slot and INTO this one for the measured reason
   * that the title truncates: the reveal rendered as `AI agent step · find-renewal-t…`
   * with the SLUG clipped — the one token the reveal exists to show. Porting the sheet's
   * `truncate` unconditionally would have silently re-broken that fix.
   *
   * A shipped fix that prevents a real defect is a CONSTRAINT the layout must satisfy, not
   * a competitor to it. So the sheet's truncation is kept for the sentence case — which is
   * every card on a default Builder canvas, at the sheet's exact 72px — and suspended for
   * the identifier case, where the line wraps and the whole slug reaches the reader. No
   * hover or ⓘ affordance is needed, because nothing has to be hidden to satisfy both.
   *
   * DATA, NOT LAYOUT — extensibility seam #1's own rule. The card gains a slot; no caller
   * of any other slot changes; absent ⇒ the sheet's behaviour, so a caller that never sets
   * it gets the reference composition. The ADAPTER owns the answer, because the adapter is
   * already the one place that knows whether the reveal is on (D-183-08: exactly ONE
   * technical-names state in the app), and this card still renders provider-less.
   */
  subtitleIsIdentifier?: boolean
  /** An extra ⌥-reveal line. **Not passed by the 184 adapter** — the reveal is a
   *  title swap today; this slot exists so a later phase adds a line without
   *  re-cutting the card. Absent ⇒ renders nothing. */
  technicalLine?: string
  /** Phase 200-06 (`BC-MR-03`) — this step's own BRANCH CONDITION, already resolved to
   *  the target step's NAME by `canvasModel`'s projection. Absent ⇒ the card renders no
   *  condition element at all, which is the state every step without an `on_failure`
   *  branch is in, and also the state a step whose branch target does not resolve is in
   *  (the broken-reference stub already prints that whole sentence — 199-05's rule).
   *
   *  ⚠ IT IS A BODY LINE, NOT A BADGE, AND THAT IS FORCED RATHER THAN CHOSEN. `BadgeSlots`
   *  is a max-2 tuple union and both slots are SPENT ("Not connected", "Waits for you"), so
   *  a third badge is a TYPECHECK ERROR. The condition therefore lands in the body, which
   *  is also where it belongs: it is a SENTENCE, and a word-badge carries one word.
   *
   *  ⚠ NO SLUG EVER REACHES THIS SLOT. The value is business words about a named step; a
   *  slug here would put an identifier on the one surface a non-technical person reads. */
  condition?: string
  /** The icon-well tint, already resolved (with `DEFAULT_TINT` as the fallback) by
   *  the caller. The card performs no lookup and so cannot crash on an unknown type. */
  tint: string
  /** At most TWO word-badges — see `BadgeSlots`. Absent or empty ⇒ no badge row. */
  badges?: BadgeSlots
  /** The step's live run reading (Phase 188). **Supplying it puts the card in RUN
   *  MODE**, which is a mode and not a decoration: the status ring paints above the
   *  card, the run line appears in the body for EVERY reading (including *Not started*,
   *  so nothing reflows as the run progresses), and the card's minimum height rises to
   *  the run-mode floor. Absent ⇒ the Builder's card, byte-identical to 185's.
   *
   *  The reading is DERIVED BY THE CALLER, once, through `phaseState.canvasReading` —
   *  this card maps no status and collapses no state. */
  status?: NodeRunStatus
  /** The step's terminal emit failure, when the run row carries one. Selects which of
   *  three fixed clauses follows the word *Failed*; ignored for every other reading.
   *
   *  ⚠ THE HARNESS'S FREE-FORM FAILURE TEXT IS NEVER RENDERED ON THIS SURFACE. That
   *  string can carry slugs, model ids and gate identifiers, which is precisely what
   *  SPEC Req 2 forbids on the canvas. Only this TYPED enum reaches the card, and it
   *  only ever selects between three fixed sentences. The detailed reason stays in the
   *  developer timeline, one click away through "Open the chat thread". */
  emitFailure?: EmitFailure | null
  /**
   * Phase 200 (FE-WIRING) — THE STEP'S OWN ELAPSED, ALREADY WORDED BY THE CALLER.
   *
   * `screens/node-identity.html:265` draws `00:15` in the bottom-right corner of its RUNNING
   * node, and it was the one atom on that sheet whose every part already shipped one surface
   * over: `started_at` / `completed_at` are on the wire (`backend/app/api/workflow_runs.py`,
   * migration `121_workflow_phases_timings.sql`, applied), `phaseDuration.ts` formats them
   * through `fmtElapsed`, and the SPINE consumes them as `node-run-time`. Only this card had
   * no slot — `grep -n "elapsed\|duration" PhaseNodeCard.tsx phaseNodeCardContract.ts` → 0.
   *
   * ⚠ **A STRING, NOT A TIMESTAMP AND NOT A NUMBER.** The card formats no duration and
   * decides nothing about what an unrecorded one reads as — the identical discipline as
   * `label` and `noun` on `NodeRunState`, and as `runTense.total` on the spine. A card doing
   * its own wall-clock arithmetic would be a SECOND clock beside the page's, free to disagree
   * with the run band directly above it about the same run.
   *
   * ⚠ AND THE CLOCK CALL IS NOT NAMED HERE, DELIBERATELY. This file is inside
   * `CARD_SUBTREE_PATHS`, whose scope fence (`PhaseNodeCard.test.tsx` — *"the card reads no
   * DOM, no clock and no randomness"*) is a `?raw` SOURCE regex and cannot tell a mention in a
   * comment from a live call. Spelling the API in the sentence explaining why the card must
   * not call it turns that fence RED — which is exactly the trap `196-08` fell into four
   * times, once inside the comment written to explain the first three.
   *
   * ⚠ **ABSENT ⇒ NO ELEMENT AT ALL — never `00:00`, never `—`, never a spinner.** A step the
   * page holds no timing for is not a step that has run for zero seconds. This is the same
   * three-state discipline `count` carries on `NodeRunState` and the same floor
   * `runFacts.ts`'s four-arm correction records the cost of folding.
   *
   * ⚠ **RUN TENSE, SO IT IS UNREACHABLE FROM THE BUILDER BY CONSTRUCTION.** It rides
   * `NodeRunState`, which only a surface holding a real run supplies. An authoring canvas
   * passes no `runState` at all, so a draft cannot render an elapsed — which is exactly what
   * `199-02` refused, and the refusal now holds by shape rather than by care.
   */
  elapsed?: string | null
  /** The server's verdict mark (VALID-03), rendered by 184-08 and relocated to the
   *  card's LEFT edge by 185-01 (D-185-17 — top-right is CLAIMED for the governance
   *  seal). **Every value here is SERVER-DERIVED** — the caller reads it off
   *  `verdictModel.markFor(slug)`, which reads `verdict.severity` and derives nothing.
   *  Absent ⇒ the card renders no verdict element at all, which is the state a draft
   *  is in before its first check has answered (D-184-15). */
  verdict?: NodeVerdictMark
  /** GOVERN-02 (sketch 143-A) — this step must prove it. Renders the corner seal.
   *
   *  THE SEAL IS NEVER CONDITIONAL ON RUN STATE: run status overwrites the border, so
   *  the seal is the only carrier that survives mid-run, and hiding, dimming or moving
   *  it would delete the reading at exactly the moment it matters most. Top-right of
   *  the card is CLAIMED for governance — 188/189 may not take it.
   *
   *  Resolved by the CALLER, once, at projection time (`canvasModel.buildPhaseData`
   *  via `phaseVocabulary.groundingCauseOf` — the ONE client home of the rule the
   *  panel's dial also reads). This card neither derives it nor asks why. */
  grounded?: boolean
  /** The 137-B step number. Declared, rendered as nothing in 184-03 — D-183-07 keeps
   *  `phase_index` off the face today, and putting it on is a sketch decision with its
   *  own acceptance bar, not a side effect of an extraction. */
  stepNumber?: number
  /** Whether the canvas has this node selected. Border treatment only; **motion never
   *  keys off selection.** */
  selected?: boolean
  /** The graph library's hidden edge anchors, injected by the `PhaseNode` adapter.
   *  Rendered as the FIRST child so the DOM is byte-identical to the pre-split node.
   *  It is a plain `ReactNode` precisely so this file imports no graph library: a
   *  provider-less render (unit tests, Phase 188's reuse) simply omits it. */
  anchors?: ReactNode
}
