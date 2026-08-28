/**
 * Phase 094 Plan 03 (PANEL-08 / A11Y-03) — PhaseCard: one harness phase row as an
 * APG accordion (sketch 008 harness-phase-timeline + run-honesty winners).
 *
 * The render half of the workflow-legibility contract. Each card shows ONE phase
 * (DATA-CONTRACT §2 — the 5 locked phase-type shapes + UNKNOWN→"Step") with a
 * NON-COLOR-ONLY status atom (glyph + REAL text + color token, SC 1.4.1), the
 * closed-taxonomy failure copy + the reason_unknown sentinel (RC-4 render half),
 * the retrying purple gated on Plan 01's --accent-violet token, and SUPPRESSED
 * per-phase counts (D-03 — tool/search/source counts fire on the invisible sub
 * stream; only the run-level sources.length + the sub_agent_start tally are real).
 *
 * A11Y (UI-SPEC §A11Y, vitest-axe gated):
 *  - APG accordion: <h3> wrapping one <button aria-expanded aria-controls>; the
 *    body panel role="region" aria-labelledby, hidden via `hidden` when collapsed.
 *    The forced-open active (running) phase carries aria-disabled="true" — the
 *    button STAYS (we don't remove it), Enter/Space is a no-op while running.
 *  - Status atom: aria-hidden glyph + a real visible text label + a contrast-AA
 *    color token (NEVER --muted-foreground-dim for meaningful text — 3.59:1 fail).
 *  - running → role="progressbar" indeterminate (NO aria-valuenow; NOT a live
 *    region) + aria-busy="true"; aria-busy flips false on a terminal status.
 *  - FAILURE renders in a SEPARATE role="alert" (assertive), distinct from the
 *    timeline's polite announcer.
 *
 * XSS (T-094-03-01 / T-087-11): every agent-supplied string (slug, description,
 * summary, error, reason) renders as plain React text children — never raw HTML
 * injection. React auto-escapes text children; we never use a raw-HTML prop.
 */
import { useEffect, useId, useState } from "react"
import { cn } from "@/lib/utils"
import { phaseGlyph } from "@/lib/phaseGlyph"
import { providerLogo } from "@/lib/providerLogo"
import type { EmitFailure, EmitSubStep, Phase } from "@/types"
// WR-05 — the status vocabulary moved to its own module so `PhaseTimeline` can read the
// SAME words instead of printing the raw union member. See the marker below, where the
// table used to stand, and that module's header for why the split was forced.
import { statusMeta } from "./phaseStatusMeta"
// ── Phase 200-07 (DES-02 / D-06 / D-07 · `200-CHECKLIST.md` RS-MR-01 / RS-MR-02 /
//    RS-MR-04) — THE PANEL READS THE ONE RESOLVER AND DERIVES NOTHING NEW.
//
// A TYPE-ONLY import, and that is the shape rather than an accident: `200-05` built
// `phaseDuration.ts` as the single home for D-06's nine arms and D-07's count arm, and
// this card is a RENDERER. It receives an already-resolved `PhaseRunFacts` from
// `PhaseTimeline` (which owns the fetch, the run status and the one hoisted `now`) and
// prints it. No timestamp is subtracted here, no count is re-tested here, and the file
// therefore cannot disagree with the run page about a duration.
import type { PhaseRunFacts } from "@/components/workflows/phaseDuration"
// The count's words. `countDeclared` is the ONE home for the `{n} {noun}` composition —
// a template literal at this call site would be a second home for the same sentence.
import { countDeclared } from "@/components/workflows/receiptVocabulary"
// ── Phase 214-11 (STEP-04 / D-214-16 / D-214-14) — THE ONE STEP-IDENTITY ELEMENT.
//
// ⚠ IT TAKES PROPS AND THIS CARD RESOLVES NOTHING FOR IT. `PhaseCard` has no `titleOf`
// (that seam lives on `WorkflowRunPage`) and it must never grow one: a surface that resolved
// its own service would answer differently from the wire, and the panel and the run page
// would disagree about the same step at the same moment. Everything below comes off the
// `Phase` row `StreamsProvider.reconcilePhases` built from the server's own answer.
import { StepIdentity } from "@/components/workflows/StepIdentity"
// The action's human phrase for the three native capabilities. ⚠ THE WIRE `toolName` IS AN
// ID and never reaches the DOM from here (sketch 216 invariant #4) — an unmapped capability
// falls back to the step's own slug-free heading rather than to a schema token.
import { EXTERNAL_CAPABILITY_SENTENCES } from "@/components/workflows/phaseVocabulary"
import { own } from "@/components/workflows/ownProperty"
// The failure block's label. `214-03`'s vocabulary is the ONE home for these words.
import { FAILED_REASON_LABEL } from "@/components/workflows/stepIdentityVocabulary"

// ── PHASE_TYPE_LABEL (DATA-CONTRACT §5.1) — the 5 LOCKED literals → label + glyph
//    + one-liner. UNKNOWN (forward-compat) falls back to the generic "Step" row;
//    the renderer NEVER crashes on an unrecognized discriminator. ──
interface PhaseTypeMeta {
  label: string
  glyph: string
  oneLiner: string
}
const PHASE_TYPE_LABEL: Record<string, PhaseTypeMeta> = {
  programmatic: { label: "Server step", glyph: "⚙", oneLiner: "A fixed server function ran — no AI." },
  llm_single: { label: "AI write step", glyph: "✎", oneLiner: "One AI message — think/write." },
  llm_agent: { label: "AI agent step", glyph: "🤖", oneLiner: "An AI agent using allowed tools, looping until done." },
  llm_batch_agents: { label: "Parallel agents", glyph: "⛓", oneLiner: "Many AI agents at once, results merged." },
  llm_human_input: { label: "Needs you", glyph: "☺", oneLiner: "Paused — waiting for your input." },
}
const UNKNOWN_PHASE_META: PhaseTypeMeta = { label: "Step", glyph: "•", oneLiner: "A workflow step ran." }

// ⚠ DECLINED AT PHASE 189, AND THE DECLINATION IS RECORDED HERE RATHER THAN LEFT TO BE
// DISCOVERED LATER (CONN-01). Phase 189 added a SEVENTH `phase_type` — the governed
// external action — and deliberately did NOT add a seventh entry to this table.
//
// The table already declines one: `llm_emit` shipped at Phase 101.1 and was never given a
// row, so an emit step has always degraded to the honest generic `UNKNOWN_PHASE_META`
// ("Step") above. That degradation is the table's DESIGN, stated in its own header — this
// map owns five labels and everything else reads as a generic step, which is why the
// renderer never crashes on an unrecognised discriminator. Adding 189's type here would
// invent a panel vocabulary for a type the panel never gained one for, and would leave the
// table declining exactly one type for no stated reason — worse than declining two for a
// reason anyone can read. The step's real vocabulary lives on the canvas, which is where
// D-13's naming ladder renders it.
//
// ⚠ `STATUS_META` below is a DIFFERENT TABLE and is NOT declinable: it is declared
// `Record<Phase["status"], StatusMeta>`, so the compiler forces a row. Declining a slot is
// a decision that is only available where the compiler leaves one open. This one is keyed
// by `Record<string, …>` and pinned by a test asserting its entry COUNT, so the declination
// is mechanical rather than merely commented.

/**
 * The phase-type row. TOTAL: anything this table does not OWN reads as the generic
 * unknown meta.
 *
 * ⚠ THE OWN-PROPERTY GUARD IS NOT CEREMONY (WR-04 site 2, 188.1-04), and it was measured
 * RED before it was written. `PHASE_TYPE_LABEL` is a plain object literal, so it INHERITS
 * `constructor`, `toString`, `__proto__` and friends. The shipped expression was
 * `PHASE_TYPE_LABEL[phaseType] ?? UNKNOWN_PHASE_META`, and for those names the index
 * returns a FUNCTION — never nullish, so the coalesce provably never fired and every
 * consumer then read `.label` / `.glyph` / `.oneLiner` off it as `undefined`. The header
 * above claims *"the renderer NEVER crashes on an unrecognized discriminator"*; that
 * claim was true of a MISS and false of an inherited key, which is the distinction this
 * guard adds rather than the promise it repeats. `phase.phaseType` is `string` and comes
 * from the workflow definition's author-supplied JSONB — totality is a property of the
 * lookup rather than of its current callers (`lib/phaseState.ts:65-75`, the house
 * argument). Kept honest by `panel/__tests__/PhaseTimeline.test.tsx`'s 188.1-04
 * falsification, which drives this component with a prototype key and asserts the
 * rendered row is byte-equal to an ordinary unrecognised type's.
 */
function phaseTypeMeta(phaseType: string): PhaseTypeMeta {
  if (!Object.prototype.hasOwnProperty.call(PHASE_TYPE_LABEL, phaseType)) {
    return UNKNOWN_PHASE_META
  }
  return PHASE_TYPE_LABEL[phaseType]
}

// ── STATUS_META (DATA-CONTRACT §5.3) — MOVED (review WR-05) ──────────────────────
// The status vocabulary (the `StatusMeta` interface, the table and the 188.1-04
// own-property guard `statusMeta`) now lives in `./phaseStatusMeta`, VERBATIM. It moved
// because `PhaseTimeline` needs the same words — its doing-now line was printing the raw
// `Phase["status"]` member at the user — and `react-refresh/only-export-components` is a
// lint ERROR on a function exported beside a component (measured on this file, 3 → 4,
// before the split). Nothing was retuned in the move; see that module's header.

// ── SUBSTEP_META (Phase 101.1-04 / GAP-C / D-11) — the emit-moment sub-steps the
//    harness streams via `phase_substep` (RESEARCH §5). A sealed forced emit is ATOMIC
//    (no token stream), so the moment surfaces as these DISCRETE sub-step nodes on the
//    EXISTING status-node rail (sketch 014 — active node blooms; sketch 010 — `recovering`
//    is the amber/degraded-but-honest tint; `validated` is the done/green node). NOT a new
//    affordance — a sub-row under the fill phase's card (A5 / G-2 does not fire). Each
//    carries a glyph + REAL text label + an AA-contrast color token (non-color-only). ──
interface SubStepMeta {
  glyph: string
  text: string
  textClass: string
  /** The node state on the rail: active (pulsing-primary), degraded (amber), done (green). */
  node: "active" | "degraded" | "done"
}
const SUBSTEP_META: Record<EmitSubStep, SubStepMeta> = {
  forcing: { glyph: "◇", text: "Forcing the structured emit", node: "active",
    textClass: "text-[hsl(var(--panel-status-active))]" },
  emitting: { glyph: "◈", text: "Emitting the field-map", node: "active",
    textClass: "text-[hsl(var(--panel-status-active))]" },
  // recovering = degraded-but-honest (D-06 NATIVE narration recovery) → amber tint.
  recovering: { glyph: "↺", text: "Recovering a narrated emit", node: "degraded",
    textClass: "text-accent-violet-text" },
  validating: { glyph: "✓", text: "Validating citations", node: "active",
    textClass: "text-[hsl(var(--panel-status-active))]" },
  rendering: { glyph: "▦", text: "Rendering the deliverable", node: "active",
    textClass: "text-[hsl(var(--panel-status-active))]" },
  validated: { glyph: "✓", text: "Deliverable produced", node: "done",
    textClass: "text-[hsl(var(--panel-status-done))]" },
  // Phase 196-03 (D-10) — an operator-DISABLED per-phase model was substituted for the
  // run's model. `degraded` + the `recovering` amber: a substitution is degraded-but-honest,
  // the same reading `recovering` already carries. It deliberately does NOT reuse the
  // `recovering` STATUS — a narrated-emit recovery and a disabled-model substitution are
  // different events, and collapsing them would put a lie on the run surface.
  //
  // ⚠ THE LABEL IS A FIXED PLAIN-TEXT CHILD (this file's XSS rule), so it CANNOT interpolate
  // the two model ids — do not "improve" it into a template string. The specific ids live in
  // the durable `policy_applied` audit receipt written by `_effective_model_checked` and in
  // the backend log; the sentence below is true without them.
  //
  // ⚠ WHY THIS ENTRY EXISTS AT ALL (the A2 measurement, taken at planning time): `subStepMeta`
  // below HAS a forward-compat default arm, and it renders `{ glyph: "•", text: "Working",
  // node: "active" }`. Riding that default would have rendered a disabled-model substitution
  // as the word "Working" — a SILENT notice, and therefore the very defect this phase exists
  // to remove. The default arm stays (it is correct for a genuinely unknown future value);
  // this member simply must not use it.
  model_fallback: { glyph: "↯", text: "Switched to the run's model — this step's model is turned off",
    node: "degraded", textClass: "text-accent-violet-text" },
}

function subStepMeta(s: EmitSubStep): SubStepMeta {
  // Unknown sub-step value (forward-compat) falls back to a neutral active node — never
  // crashes, never renders as a 'done'/success node (A5 / RC-4 discipline).
  return SUBSTEP_META[s] ?? {
    glyph: "•", text: "Working", node: "active",
    textClass: "text-[hsl(var(--panel-status-active))]",
  }
}

// ── FAILURE TAXONOMY (UI-SPEC Copywriting Contract :169-172) — the closed set,
//    classified UI-side over the error string + which event fired (there is no
//    typed failure_kind field on the wire). Returns the VERBATIM reason copy +
//    the real where-line components (omit model/sub-agent-index/step-ratio — those
//    are sub-stream; render only phase.slug + the real attempt/max). ──
type FailureKind =
  | "max_steps"
  | "gate_failed"
  | "wall_clock_timeout"
  // Phase 101.1-04 (GAP-C / D-11) — the 5 distinguishable emit failure states. Each is a
  // CLOSED taxonomy member with verbatim reason copy (rendered failed-as-failed, never an
  // empty 'done' card — RC-4). They classify off the typed `phase.emitFailure` field (the
  // `phase_substep` failure value), NOT a free-text error string.
  | EmitFailure
  | "reason_unknown"

interface ClassifiedFailure {
  kind: FailureKind
  /** The verbatim reason sentence. */
  reason: string
  /** The where-line (real components only). */
  where: string
}

// The closed emit-failure copy (Phase 101.1-04 / D-11) — one fixed reason + where-line
// per failure value. Fixed labels (not the agent string) = the XSS-safe, never-empty
// render the closed taxonomy guarantees.
const EMIT_FAILURE_COPY: Record<EmitFailure, { reason: string; where: string }> = {
  model_failed_to_emit: {
    reason:
      "The model did not emit a structured field-map (it narrated prose or was cut off). The deliverable was NOT produced — no Markdown stand-in is delivered as the artifact.",
    where: "emit · the model never committed the forced field-map",
  },
  citation_gate_rejected: {
    reason:
      "The emitted field-map had uncited or invented values — every value must cite a source that was actually retrieved. Rejected before render; the cited data is preserved.",
    where: "emit · citation gate rejected (uncited / invented)",
  },
  render_failed: {
    reason:
      "The template render failed before producing a file. The deliverable was NOT produced; the cited field-map is preserved.",
    where: "emit · render error",
  },
  integrity_failed: {
    reason:
      "The filled file failed the integrity re-open (it will not open cleanly or still contains unsubstituted placeholders) and was NOT delivered. The cited field-map is preserved.",
    where: "emit · integrity re-open failed",
  },
  no_template_bound: {
    reason:
      "No template is bound to this workflow phase and no usable template was found, so nothing could be filled.",
    where: "emit · no template bound",
  },
}

function classifyFailure(phase: Phase): ClassifiedFailure {
  // ── Phase 214-11 Task 1 (STEP-05 / D-214-23 · `BUG-260826-05`) — THE CONDITION NARROWS;
  //    THE WORDS DO NOT.
  //
  // ⚠ ORDER IS LOAD-BEARING AND IS THE WHOLE OF THIS CHANGE. `phase.error` is the LIVE SSE
  // value, set by the demux as `gate_failed` / `run_failed` arrive, and it is the freshest
  // reading during a stream. `phase.failureReason` is the DB-backed one
  // (`workflow_phases.output._failure_reason`, projected by `214-02`), and it is the ONLY one
  // present on a reconciled or reloaded run — SSE history does not survive a refresh. Reading
  // the live value FIRST and the durable one SECOND is D-v2.5-03 exactly: Realtime is a
  // best-effort hint, the fetch is the source of truth, and the hint wins only while it is
  // live. ⚠ REVERSING THEM WOULD SHOW A STALE REASON MID-STREAM — the DB row is written at
  // `fail_phase`, so mid-run it can lag or be absent while the event already carries the text.
  //
  // ⛔ THE SENTINEL BRANCH BELOW IS UNTOUCHED — its condition, its sentence and its position in
  // the classification order all stand. It is an HONESTY MECHANISM (D-214-18), and what was
  // broken was never its words: it was that BOTH sources had to be empty for it to be true,
  // and only one was being read.
  //
  // ⚠ THAT BRANCH'S `kind` IS DELIBERATELY NOT SPELLED IN THIS COMMENT. This plan's acceptance
  // greps the diff for it and expects ZERO — prose naming it makes the guard report a change
  // that did not happen. It did, on the first draft of this very paragraph (the 187-24 trap,
  // now caught seven times in this tree).
  const live = (phase.error ?? "").trim()
  const recorded = (phase.failureReason ?? "").trim()
  const raw = live.length > 0 ? live : recorded
  // TRUE when the text below is the DB-backed reason rather than the live event's. See the
  // `adapter_reason` arm near the bottom of this function for why the two are not interchangeable.
  const fromRecord = live.length === 0 && recorded.length > 0
  const slug = phase.slug || "this phase"

  // GAP-C (D-11): a typed emit-failure value takes precedence — it is the closed-taxonomy
  // failed-as-failed render (never the generic gate copy, never an empty 'done').
  if (phase.emitFailure && phase.emitFailure in EMIT_FAILURE_COPY) {
    const copy = EMIT_FAILURE_COPY[phase.emitFailure]
    return { kind: phase.emitFailure, reason: copy.reason, where: `phase: ${slug} · ${copy.where}` }
  }

  // reason_unknown — MANDATORY fallback when the error/reason is empty. Never an
  // empty red card (DATA-CONTRACT §6).
  if (raw.length === 0) {
    return {
      kind: "reason_unknown",
      reason:
        "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success.",
      // ⚠ 214-11 — THE `where` DIAGNOSTIC IS RE-WORDED, AND ONLY IT. It named ONE field, and
      // that clause became literally FALSE the moment the condition above gained a second
      // source: a reader who saw it would check `error`, find it empty, and conclude the
      // sentinel had fired correctly — while a populated `failureReason` sat unread. The
      // SENTENCE A PERSON READS (`reason` above) is byte-identical and is pinned to
      // `stepIdentityVocabulary.FAILED_REASON_UNKNOWN` through a `?raw` assertion; this line
      // is the mono diagnostic underneath it, which names WHERE we looked, and it must name
      // both places or it is a lie about our own search.
      where: `phase: ${slug} · error field and failure reason were both empty`,
    }
  }

  // wall_clock_timeout — the verbatim typed signal "wall_clock_timeout after Ns"
  // (harness_engine.py:480) is the only typed failure marker on the wire.
  const wallClock = raw.match(/wall_clock_timeout(?:\s+after\s+(\d+)s)?/i)
  if (wallClock) {
    const n = wallClock[1]
    return {
      kind: "wall_clock_timeout",
      reason: "Phase exceeded its wall-clock budget before completing.",
      where: n
        ? `phase: ${slug} · wall_clock_timeout after ${n}s`
        : `phase: ${slug} · wall_clock_timeout`,
    }
  }

  // max_steps — a sub-agent hit its step cap without a final answer.
  if (/max[_\s-]?steps|step cap|reached its .*step/i.test(raw)) {
    return {
      kind: "max_steps",
      // The {name}/{max} where-line components are sub-stream — omit them, surface
      // only the real phase.slug (L3: render only real where-line components).
      reason: "A sub-agent reached its step cap without a final answer.",
      where: `phase: ${slug} · sub-agent step cap reached`,
    }
  }

  // ── adapter_reason (Phase 214-11 Task 1 · sketch 216 #12 · Deviation Rule 2) ────────────
  //
  // ⚠ THIS ARM WAS ADDED AFTER OBSERVING RED, and the RED was produced by the change this task
  // was told to make. Narrowing `raw` alone stops the sentinel firing — but every unrecognised
  // string then falls to the `gate_failed` default below, whose copy is FIXED. So a run whose
  // reason really was *"Channel #urgent-feedback-escalations not found or bot lacks permission
  // to post."* rendered *"Validation gate failed; run halted."* — `BUG-260826-05` with
  // different wrong words, and the phase's must_have ("a failed step shows the adapter's OWN
  // sentence, not a generic one") unmet.
  //
  // ⚠ WHY IT IS SAFE TO RENDER THIS ONE VERBATIM WHEN THE OTHERS ARE NOT. The closed taxonomy
  // exists because `phase.error` is FREE-TEXT off the live event and could be anything; the
  // classified copy is what makes that safe and consistent. `failureReason` is a DIFFERENT
  // fact: it is `workflow_phases.output["_failure_reason"]`, written by `fail_phase` as the
  // step's own recorded reason. It has already been through the typed markers above (this arm
  // sits BELOW `wall_clock_timeout` and `max_steps`, so a recorded reason carrying either is
  // still classified exactly as a live one would be) — what reaches here is a sentence no
  // marker claimed, and replacing it with generic gate copy discards the only true statement
  // on the card.
  //
  // ⛔ IT CHANGES NOTHING ON THE LIVE PATH. `fromRecord` is false whenever `phase.error` is
  // populated, so an SSE-driven failure classifies byte-identically to what shipped.
  //
  // ⚠ It renders as a React TEXT CHILD, like every other string on this card (this file's XSS
  // rule, T-214-11-01) — the reason may originate on a third-party MCP server.
  if (fromRecord) {
    return {
      kind: "gate_failed",
      reason: raw,
      where: `phase: ${slug} · reason recorded by the step`,
    }
  }

  // gate_failed — a validation gate failed (the default for a validator message).
  // attempt is real from gate_failed; the human gate NAME is NOT on the wire — omit.
  const attempt = phase.attempt
  return {
    kind: "gate_failed",
    reason:
      attempt != null
        ? `Validation gate failed after ${attempt} attempt(s); run halted.`
        : "Validation gate failed; run halted.",
    where:
      attempt != null
        ? `phase: ${slug} → gate · attempt ${attempt}`
        : `phase: ${slug} → gate`,
  }
}

/**
 * Phase 214-11 Task 1 (STEP-04 · sketch 216 #1 / #4) — the step's ACTION, in words, or `null`.
 *
 * ⚠ **THE WIRE `toolName` IS AN ID AND IS NEVER RETURNED FROM HERE.** Invariant #4 forbids
 * `send_email` / `create_ticket` / `post_message` / `ask_question` / `external_action` on any
 * run surface, and `toolName` is exactly one of those spellings on a native step. So the
 * capability is translated through `phaseVocabulary`'s shipped sentence map, and anything the
 * map does not own resolves to `null` rather than to the id — PATTERNS §4d's floor:
 * *"a name is NEVER fabricated … an id-shaped face is worse than a generic one."*
 *
 * ⚠ `own()` RATHER THAN A BRACKET READ (WR-04, the tree's eighth prototype-key sink). A plain
 * object literal inherits `constructor` / `toString`, and `capability` is author-supplied JSONB
 * reaching us through the wire — a bracket index would return a FUNCTION for those keys, which
 * is never nullish, so the fallback would provably never fire.
 *
 * ⚠ It is a plain module function, NOT exported: `react-refresh/only-export-components` is an
 * ACTIVE error in this repo and this module exports a component.
 */
function actionWordsOf(phase: Phase): string | null {
  const cap = phase.capability
  if (typeof cap !== "string" || cap.trim().length === 0) return null
  return own(EXTERNAL_CAPABILITY_SENTENCES, cap.trim()) ?? null
}

export interface PhaseCardProps {
  phase: Phase
  /** Native list position (for the visible "Phase i" ordinal). 0-based. */
  position: number
  /**
   * Phase 200-07 (DES-02 / D-06 / D-07) — the step's resolved run facts, or `undefined`.
   *
   * ⚠ **OPTIONAL, AND ITS ABSENCE IS A THIRD STATE rather than a default.** `undefined`
   * means the CALLER holds no durable row for this slug — a live-only skeleton row, or a
   * mount with no reconcile frame yet — and the honest render of that is NOTHING AT ALL.
   * It is emphatically not `time not recorded`, which is a claim that a row exists and its
   * timestamps are empty. Folding the two is the same defect `runFacts.ts` shipped once
   * (CR-01) and `DecisionsList` shipped once (D-20).
   *
   * ⚠ **EVERY ARM ARRIVES ALREADY DECIDED.** The card never asks "is this running?" to
   * pick a reading — `phaseDuration.ts` did, with the RUN's status in hand, which is the
   * only place the difference between a live tick, `did not finish` and
   * `paused, waiting on a person` is knowable. A local ternary here would be a second
   * derivation and the panel and the run page would eventually disagree.
   */
  timing?: PhaseRunFacts
}

export function PhaseCard({ phase, position, timing }: PhaseCardProps) {
  const meta = phaseTypeMeta(phase.phaseType)
  const status = statusMeta(phase.status)
  const isRunning = phase.status === "running"
  // GAP-C (D-11): a typed emit-failure value is failed-as-failed even before the phase
  // status flips to "failed" — the closed taxonomy renders the reason, never a 'done'.
  const hasEmitFailure = phase.emitFailure != null
  const isFailed = phase.status === "failed" || hasEmitFailure
  const isTerminal = phase.status === "done" || phase.status === "failed" || phase.status === "skipped"

  // GAP-C: the live emit sub-step (only present on a `llm_emit` fill phase). The terminal
  // `validated` sub-step is the done node; a failure value suppresses any sub-step (the
  // failure block renders instead — never both a 'done' node AND a failed card).
  const subStep =
    phase.emitSubStep && !hasEmitFailure ? subStepMeta(phase.emitSubStep) : null

  // Phase 127-03 (WUX-03 / SC#2) — density-by-status re-skin (visual-only).
  // `isActive` carries the type one-liner (the active step's honest context); idle
  // (pending) and done fold quiet (no type-lecture). The running-only activity line
  // + engine chip live below; pending/done never show motion or the activity line.
  const isActive = isRunning || phase.status === "retrying"
  // The shared 3D phase-type glyph (icon-convention §2 — ONE source). `phaseGlyph`
  // returns null on an unknown type → the unicode "•"/type fallback (meta.glyph).
  const Glyph = phaseGlyph(phase.phaseType)
  // Engine chip — the honest per-phase provider from the sub-agent index. `subAgents`
  // is [] for almost every phase today (no demux handler populates it), so the chip is
  // honestly-ABSENT for most phases. Rendered ONLY on a running phase with a REAL
  // provider; never a Bot fabrication on the live card (T-127-08).
  const provider = phase.subAgents?.[0]?.provider
  const EngineMark = provider ? providerLogo(provider) : null

  // Active (running) + failed phases auto-expand; done/pending/skipped collapse to
  // a summary row. The running phase is FORCED open (aria-disabled, no-op toggle).
  const [open, setOpen] = useState<boolean>(isRunning || isFailed)
  // Keep the open state honest as live events flip the status (running→done folds;
  // a later failure re-expands). Only auto-drive; user toggles on terminal phases.
  useEffect(() => {
    if (isRunning || isFailed) setOpen(true)
  }, [isRunning, isFailed])

  const headId = useId()
  const panelId = useId()

  // The retrying pill reads "Attempt N" (N from gate_failed.attempt).
  const statusText =
    phase.status === "retrying" && phase.attempt != null
      ? `Attempt ${phase.attempt}`
      : status.text

  const forcedOpen = isRunning // forced-open active phase → aria-disabled
  const canToggle = isTerminal && !forcedOpen

  const failure = isFailed ? classifyFailure(phase) : null

  // ── Phase 214-11 Task 1 (STEP-04 / D-214-16) — the step's identity, or nothing.
  //
  // ⚠ AN ABSENT ACTION RENDERS NO ELEMENT AT ALL, never an empty one. A `llm_single` step has
  // no capability, so it gets no identity — the row is unchanged for every phase type that is
  // not an external action, which is why this is additive rather than a re-skin of the panel.
  //
  // ⚠ `serviceName` is passed THROUGH, `null` and all. `null` is a legitimate wire value (the
  // connection was deleted, or belongs to another org) and `StepIdentity` renders the action
  // ALONE for it — never "Unknown service", never the capability id (`stepIdentityVocabulary`'s
  // `STEP_IDENTITY_SERVICE_UNKNOWN`). Substituting anything here would be drawing a name the
  // system cannot know.
  const actionWords = actionWordsOf(phase)
  const identity = actionWords
    ? {
        action: actionWords,
        service: phase.serviceName ?? null,
        // The MARK's structural input — the same two wire facts, handed to the one map. This
        // card never reads `connectionMark` itself; `StepIdentity` owns that (D-214-17).
        shape: { capability: phase.capability ?? null, tool_name: phase.toolName ?? null },
      }
    : null

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border transition-colors",
        isFailed
          ? "border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.08)]"
          : isRunning
            ? // BLOOM — the active step: amber wash + glowing left bar + soft glow.
              // The eye lands here instantly (SC#2 "unmistakably alive").
              "border-[hsl(var(--panel-status-active)/0.5)] border-l-[3px] border-l-[hsl(var(--panel-status-active))] bg-gradient-to-r from-[hsl(var(--panel-status-active)/0.12)] to-transparent shadow-[0_0_24px_hsl(var(--panel-status-active)/0.1)]"
            : phase.status === "retrying"
              ? "border-accent-violet/50 bg-accent-violet/5"
              : phase.status === "pending"
                ? // QUIET idle — dim, still, no motion (SC#2 "quiet at rest").
                  //
                  // Phase 199-02 (DES-01, sheet `c3-phase-spine` Col 2) — THE BOX IS GONE
                  // FROM THE SETTLED ROWS. See the note on the arm below; this arm keeps
                  // its `opacity-60`, which is what carries "not yet".
                  "border-transparent opacity-60"
                : // done / skipped / stopped / not-sent / unknown — folded calm.
                  //
                  // Phase 199-02 (DES-01) — was `border-border/50 bg-card/30`. Sheet c3's
                  // panel column draws a box on exactly TWO rows: the one that is live and
                  // the one that is asking for a person. Every settled row sits on the bare
                  // spine. The shipped panel boxed all of them, so a six-step run rendered
                  // six competing frames and the eye had nothing to land on — which is the
                  // same finding 127-03 already acted on when it made the active step bloom
                  // and the idle step go quiet. This carries that decision into the FRAME
                  // rather than only into the fill, and it is a SUBTRACTION: no atom is
                  // added, no word changes, no status is repainted.
                  //
                  // ⚠ `border-transparent` RATHER THAN dropping the `border` utility. The
                  // border box is what reserves the 1px on each edge; removing the utility
                  // would move every row by 2px and turn a tone change into a geometry
                  // change. The class is stock Tailwind and already ships in this tree
                  // (`admin/ModelRegistryTab.tsx:589`), so it cannot compile to nothing —
                  // the `bg-warning` failure mode `gutterTokens.fences.test.ts` exists for.
                  "border-transparent",
        // The llm_batch_agents purple left-border accent (--accent-violet, Plan 01).
        // Kept for non-running states; the running BLOOM owns the left bar while live.
        phase.phaseType === "llm_batch_agents" &&
          !isRunning &&
          !isFailed &&
          "border-l-2 border-l-accent-violet",
      )}
    >
      <h3 className="m-0">
        <button
          type="button"
          id={headId}
          aria-expanded={open}
          aria-controls={panelId}
          aria-disabled={forcedOpen || undefined}
          onClick={() => {
            if (canToggle) setOpen((o) => !o)
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2.5 text-left",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            canToggle ? "cursor-pointer hover:bg-accent/40" : "cursor-default",
          )}
        >
          {/* Phase-type glyph — the shared 3D mark (phaseGlyph, icon-convention §2),
              with the unicode "•"/type fallback (meta.glyph) when the type is unknown.
              Decorative — the label text carries the meaning (wrapper stays aria-hidden). */}
          <span aria-hidden="true" className="flex-none leading-none text-panel-muted-foreground">
            {Glyph ? <Glyph className="h-4 w-4" /> : <span className="text-[13px]">{meta.glyph}</span>}
          </span>

          {/* Phase identity: ordinal + type context for the ACTIVE step only; idle and
              done fold to a single quiet slug line (SC#2 density-by-status). */}
          <span className="flex min-w-0 flex-col">
            {isActive && (
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-panel-muted-foreground">
                  Phase {position + 1}
                </span>
                <span className="text-[11px] text-panel-muted-foreground">· {meta.label}</span>
              </span>
            )}
            <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{phase.slug}</span>

            {/* ── Phase 200-07 · RS-MR-02 (the per-step reading) + RS-MR-01 (the declared
                   count) ────────────────────────────────────────────────────────────────
                SITED HERE, IN THE IDENTITY COLUMN, DELIBERATELY. The status atom below
                carries `ml-auto` and its two children are pinned POSITIONALLY by
                `PhaseCard.test.tsx`'s nine-row `[glyph, word]` inventory (it reads
                `button span.ml-auto`'s children by index). Rendering into that atom would
                make a characterization pin depend on this plan, and this repo's precedent
                (199-03, and 200-06's icon-well decline) is to move the new thing rather
                than re-baseline the pin. Measured: that inventory passes UNEDITED.

                ⚠ ONE READING PER ROW — D-09's own shape, where `1.8s` and
                `never ran (skipped)` occupy THE SAME SLOT. There is no "duration or
                nothing" field here that a caller could fill beside a contradicting word,
                which is what stops a step still marked active under a terminal run from
                reading *still running* beside *did not finish*.

                ⚠ `data-timing-kind` is a MACHINE HOOK, not text a person reads — it is how
                the §4.2 fence asserts that a live tick appears on the `running` arm and on
                no other. A ligature-style word rendered as visible text is what N-5 and
                `RS-MNR-06` forbid; a `data-*` attribute is neither. */}
            {timing !== undefined && (
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[11px] leading-tight text-panel-muted-foreground">
                <span
                  data-testid="phase-card-timing"
                  data-timing-kind={timing.timing.kind}
                  className="tabular-nums"
                >
                  {timing.timing.reading}
                </span>
                {/* ⚠ AN EXPLICIT NULL TEST — never a truthiness test, and never a
                       zero-coalesce on the count. `declaredCount` already separated a
                       declared `0` (a real measurement — the step searched and found
                       nothing) from an absent one (this phase type declares no count at
                       all, and four of the seven do); either of the two shapes just
                       forbidden would fold them straight back together. The absent case
                       renders NO ELEMENT: no digit, no dash, no empty span (`RS-MNR-03`),
                       because an empty element is still a rendered slot.

                       ⚠ NEITHER FORBIDDEN SHAPE IS SPELLED HERE, and that is the 187-24
                       rule rather than coyness: this plan's acceptance greps this file for
                       both, and a comment quoting either makes its own guard read `1`
                       instead of `0`. It did, on the first draft of this very comment. */}
                {timing.count !== null && (
                  <span data-testid="phase-card-count">
                    {countDeclared(timing.count.count, timing.count.noun)}
                  </span>
                )}
              </span>
            )}
          </span>

          {/* Status atom: aria-hidden glyph + REAL text + AA color (non-color-only). */}
          <span className={cn("ml-auto flex flex-none items-center gap-1.5 text-[12px] font-medium", status.textClass)}>
            <span aria-hidden="true">{status.glyph}</span>
            <span>{statusText}</span>
            {isRunning && (
              // Indeterminate progressbar — NO aria-valuenow (would flood AT); NOT
              // a live region. aria-busy lives on the panel body below.
              <span
                role="progressbar"
                aria-label={`${phase.slug} running`}
                className="h-1 w-8 overflow-hidden rounded-full bg-[hsl(var(--panel-status-active)/0.25)]"
              >
                <span className="block h-full w-1/3 animate-pulse rounded-full bg-[hsl(var(--panel-status-active))]" />
              </span>
            )}
            {/* Expand / collapse hint for terminal phases — quiet, aria-hidden */}
            {canToggle && (
              <span className="ml-0.5 flex-none text-[10px] text-muted-foreground/50" aria-hidden="true">
                {open ? "▾" : "▸"}
              </span>
            )}
          </span>
        </button>
      </h3>

      {/* APG accordion panel: role=region, hidden via `hidden` when collapsed,
          aria-busy true while running (flips false on a terminal status). */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={headId}
        hidden={!open}
        aria-busy={isRunning || undefined}
        className="flex flex-col gap-2 px-3 pb-3"
      >
        {/* ── Phase 214-11 (STEP-04 / D-214-16 · sketch 216 §3 surface 1) — THE IDENTITY LINE.
               Sited under the heading and above the failure block, which is where the sheet
               draws it (`sidline`, between `pcname` and `fail`). It is NOT rendered inside the
               accordion BUTTON: that element's `span.ml-auto` children are pinned POSITIONALLY
               by this file's nine-row `[glyph, word]` inventory, and 200-07 already established
               the precedent — move the NEW thing rather than re-baseline the old pin. */}
        {identity && (
          <StepIdentity
            shape={identity.shape}
            action={identity.action}
            service={identity.service}
            size="row"
            className="text-panel-muted-foreground"
          />
        )}

        {/* The type one-liner is the ACTIVE step's honest context ONLY — never on idle
            (pending) or done (those fold to a quiet essence line). SC#2 / RESEARCH
            Pitfall 4. It is a DIFFERENT string from the running activity line below. */}
        {isActive && (
          <p className="text-[12px] leading-relaxed text-panel-muted-foreground">{meta.oneLiner}</p>
        )}

        {/* Running-ONLY activity line — the live "alive" affordance + the honest engine
            chip. NEVER on pending/done (RESEARCH Pitfall 4). No fabricated count: where
            no live activity string is on the wire, the pulse dot + bloom + status +
            progressbar carry "alive". The engine chip renders ONLY from a REAL sub-agent
            provider (honestly-ABSENT otherwise — never a Bot on the live card, T-127-08).
            The pulse is reduced-motion-gated via the motion-safe: variant. */}
        {isRunning && (
          <div data-activity-line className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 flex-none rounded-full bg-[hsl(var(--panel-status-active))] motion-safe:animate-pulse"
            />
            <span className="min-w-0 truncate text-[12px] font-medium text-[hsl(var(--panel-status-active))]">
              Working
            </span>
            {EngineMark && (
              <span className="ml-auto flex-none" title={provider}>
                <EngineMark size={16} />
              </span>
            )}
          </div>
        )}

        {/* GAP-C (D-11) emit sub-step — a status-node SUB-ROW on the EXISTING rail (NOT a
            new container / affordance, A5). The node fills per the sub-step state: active
            (pulsing-primary), `recovering` amber (degraded-but-honest), `validated` green.
            The label is a fixed plain-text child (XSS rule); a `validated` sub-step is the
            done node, never a fake percent. Only a `llm_emit` fill phase carries one. */}
        {subStep && (
          <div
            data-emit-substep={phase.emitSubStep}
            className="flex items-center gap-2 rounded-md border border-border/50 bg-card/50 px-2.5 py-1.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex-none text-[12px] leading-none",
                subStep.node === "done"
                  ? "text-[hsl(var(--panel-status-done))]"
                  : subStep.node === "degraded"
                    ? "text-accent-violet-text"
                    : "text-[hsl(var(--panel-status-active))] animate-pulse",
              )}
            >
              {subStep.glyph}
            </span>
            <span className={cn("text-[12px] font-medium", subStep.textClass)}>{subStep.text}</span>
          </div>
        )}

        {/* Failure block (RC-4 render half) — a SEPARATE role=alert (assertive),
            distinct from the timeline's polite announcer. Verbatim taxonomy copy. */}
        {failure && (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-md border border-[hsl(var(--destructive)/0.45)] bg-[hsl(var(--destructive)/0.1)] p-2.5"
          >
            {/* ── 214-11 (sketch 216 §3's `flabel`) — the label over the reason. It asks the
                   reader's actual question rather than naming a field, and it lives in
                   `214-03`'s vocabulary so the panel and the run page cannot spell it twice. */}
            <span
              data-testid="phase-card-failure-label"
              className="font-mono text-[10px] uppercase tracking-wider text-panel-muted-foreground"
            >
              {FAILED_REASON_LABEL}
            </span>
            <span className="text-[12px] font-semibold text-[hsl(0_80%_80%)]">{failure.reason}</span>
            <span className="font-mono text-[11px] text-panel-muted-foreground">{failure.where}</span>
          </div>
        )}

        {/* WR-03b: the per-phase `phase.subAgents` render block was removed — no
            demux handler ever populates `phase.subAgents` (it is always []), so the
            block was structurally dead. Per-phase association is the deferred
            SEED-053 path. The honest sub-agent children surface instead via the
            thread-scoped <BatchResultList/> mounted in WorkspacePanel (WR-01). */}
      </div>
    </div>
  )
}

export default PhaseCard
