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

// ── STATUS_GLYPH (DATA-CONTRACT §5.3) — status → glyph + REAL text + AA color
//    token (non-color-alone, UI-SPEC §A11Y). Status text uses --color-text /
//    --panel-status-* (≥4.5:1) — NEVER --muted-foreground-dim (3.59:1 fail).
//    `retrying` text reads "Attempt N" (filled in at render from phase.attempt). ──
interface StatusMeta {
  glyph: string
  /** Base text (retrying substitutes "Attempt N" at render). */
  text: string
  /** Tailwind class for the AA-contrast status text color. */
  textClass: string
}
const STATUS_META: Record<Phase["status"], StatusMeta> = {
  pending: { glyph: "○", text: "Locked", textClass: "text-panel-muted-foreground" },
  running: { glyph: "●", text: "Running", textClass: "text-[hsl(var(--panel-status-active))]" },
  done: { glyph: "✓", text: "Complete", textClass: "text-[hsl(var(--panel-status-done))]" },
  // Lightened red text on the dim fill clears 4.5:1 (UI-SPEC §A11Y contrast note).
  failed: { glyph: "✕", text: "Failed", textClass: "text-[hsl(0_80%_80%)]" },
  // WR-04: the pill LABEL TEXT uses the LIGHTENED --accent-violet-text (9.83:1
  // dark / 8.52:1 light) to clear the ≥4.5:1 normal-text floor. The base
  // --accent-violet (text-accent-violet/border-accent-violet) is graphic-level
  // (≥3:1) and stays on the glyph + the card border below (UI-SPEC §Color).
  retrying: { glyph: "↻", text: "Attempt", textClass: "text-accent-violet-text" },
  skipped: { glyph: "⤳", text: "Skipped", textClass: "text-panel-muted-foreground" },
  // Phase 188 Plan 02 (RUNVIZ-02 / D-188-08 / D-188-06) — ADDED, nothing above changed.
  // This row exists because the compiler demanded it: `Phase["status"]` gained
  // `"unknown"` so `reconcilePhases` could stop resolving an unrecognised
  // `workflow_phases.status` to `done`, and `Record<Phase["status"], …>` then forced the
  // developer panel to state that honestly too. That forcing is the mechanism, not
  // collateral damage. The `?` is INHERITED from `VERDICT_MARK.unknown`
  // (`workflows/nodePresentation.ts:185`) rather than invented — 188 spends zero net-new
  // glyphs. `text-panel-muted-foreground` is the same AA-cleared muted token
  // `pending`/`skipped` already use; `--panel-*` is correct HERE because this is a
  // panel-scoped surface (it is the RUN surface, on `--background`, where it is forbidden).
  unknown: { glyph: "?", text: "Unknown", textClass: "text-panel-muted-foreground" },
}

/**
 * The status atom. TOTAL: anything this table does not OWN reads as the declared
 * `unknown` row.
 *
 * ⚠ THE OWN-PROPERTY GUARD IS NOT CEREMONY (WR-04 site 3, 188.1-04), and it was measured
 * RED before it was written. This site was the sharpest of the five: the shipped
 * expression was a bare `STATUS_META[phase.status]` with NO FALLBACK AT ALL, so an
 * inherited name resolved to a FUNCTION and the header's status atom rendered its glyph,
 * its text and its colour class as `undefined` — an empty atom on a card still claiming
 * to show a phase. `Record<Phase["status"], StatusMeta>` makes the compiler the parity
 * guarantee for every DECLARED member (`lib/phaseState.test.ts:80-85` leans on exactly
 * that), and it says nothing at all about an inherited one. `phase.status` is derived one
 * function away from a server-supplied string — totality is a property of the lookup
 * rather than of its current callers (`lib/phaseState.ts:65-75`, the house argument).
 *
 * NO NEW VISUAL STATE WAS INVENTED. The fallback is the row this table ALREADY declares:
 * `unknown`, added by Phase 188 Plan 02 so an unrecognised `workflow_phases.status` reads
 * as *Unknown* and never as *Complete*. This guard is that same lesson applied to the key
 * space rather than to the value space, and it changes no shipped state because no
 * shipped status is a prototype key. Kept honest by
 * `panel/__tests__/PhaseTimeline.test.tsx`'s 188.1-04 falsification.
 */
function statusMeta(status: Phase["status"]): StatusMeta {
  if (!Object.prototype.hasOwnProperty.call(STATUS_META, status)) return STATUS_META.unknown
  return STATUS_META[status]
}

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
  const raw = (phase.error ?? "").trim()
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
      where: `phase: ${slug} · error field was empty`,
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

export interface PhaseCardProps {
  phase: Phase
  /** Native list position (for the visible "Phase i" ordinal). 0-based. */
  position: number
}

export function PhaseCard({ phase, position }: PhaseCardProps) {
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
                  "border-border/40 bg-card/20 opacity-60"
                : // done / skipped — folded calm.
                  "border-border/50 bg-card/30",
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
