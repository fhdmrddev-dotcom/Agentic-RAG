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
import type { Phase, TaskRunIndexItem } from "@/types"

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

function phaseTypeMeta(phaseType: string): PhaseTypeMeta {
  return PHASE_TYPE_LABEL[phaseType] ?? UNKNOWN_PHASE_META
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
}

// ── FAILURE TAXONOMY (UI-SPEC Copywriting Contract :169-172) — the closed set,
//    classified UI-side over the error string + which event fired (there is no
//    typed failure_kind field on the wire). Returns the VERBATIM reason copy +
//    the real where-line components (omit model/sub-agent-index/step-ratio — those
//    are sub-stream; render only phase.slug + the real attempt/max). ──
type FailureKind = "max_steps" | "gate_failed" | "wall_clock_timeout" | "reason_unknown"

interface ClassifiedFailure {
  kind: FailureKind
  /** The verbatim reason sentence. */
  reason: string
  /** The where-line (real components only). */
  where: string
}

function classifyFailure(phase: Phase): ClassifiedFailure {
  const raw = (phase.error ?? "").trim()
  const slug = phase.slug || "this phase"

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

// ── A sub-agent child row (llm_agent / llm_batch_agents). description + live
//    status + summary on done. NO per-row tool/search count (sub-stream). ──
function SubAgentRow({ agent }: { agent: TaskRunIndexItem }) {
  const done = agent.status === "completed" || agent.status === "done"
  const failed = agent.status === "failed"
  return (
    <li className="flex flex-col gap-0.5 border-l border-border/50 pl-3 text-[13px]">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "h-[6px] w-[6px] flex-none rounded-full",
            failed
              ? "bg-[hsl(var(--destructive))]"
              : done
                ? "bg-[hsl(var(--panel-status-done))]"
                : "bg-[hsl(var(--panel-status-active))]",
          )}
        />
        <span className="min-w-0 truncate text-foreground">{agent.description ?? "Sub-agent"}</span>
        <span className={cn("ml-auto flex-none text-[11px]", done ? "text-[hsl(var(--panel-status-done))]" : failed ? "text-[hsl(0_80%_80%)]" : "text-panel-muted-foreground")}>
          {failed ? "Failed" : done ? "Done" : "Running"}
        </span>
      </div>
      {done && agent.summary && (
        <p className="pl-3 text-[12px] leading-relaxed text-panel-muted-foreground">{agent.summary}</p>
      )}
    </li>
  )
}

export interface PhaseCardProps {
  phase: Phase
  /** Native list position (for the visible "Phase i" ordinal). 0-based. */
  position: number
}

export function PhaseCard({ phase, position }: PhaseCardProps) {
  const meta = phaseTypeMeta(phase.phaseType)
  const status = STATUS_META[phase.status]
  const isRunning = phase.status === "running"
  const isFailed = phase.status === "failed"
  const isTerminal = phase.status === "done" || phase.status === "failed" || phase.status === "skipped"

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
        "flex flex-col rounded-md border",
        isFailed
          ? "border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.08)]"
          : isRunning
            ? "border-[hsl(var(--panel-status-active)/0.45)] bg-[hsl(var(--panel-status-active)/0.06)]"
            : phase.status === "retrying"
              ? "border-accent-violet/50 bg-accent-violet/5"
              : "border-border/60 bg-card/40",
        // The llm_batch_agents purple left-border accent (--accent-violet, Plan 01).
        phase.phaseType === "llm_batch_agents" && "border-l-2 border-l-accent-violet",
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
          {/* Phase-type glyph (decorative — the label text carries the meaning). */}
          <span aria-hidden="true" className="flex-none text-[13px] leading-none text-panel-muted-foreground">
            {meta.glyph}
          </span>

          {/* Phase identity: the honest ordinal + the slug (plain text children). */}
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-panel-muted-foreground">
                Phase {position + 1}
              </span>
              <span className="text-[11px] text-panel-muted-foreground">· {meta.label}</span>
            </span>
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
        <p className="text-[12px] leading-relaxed text-panel-muted-foreground">{meta.oneLiner}</p>

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

        {/* Sub-agent child rows (llm_agent / llm_batch_agents). The ONLY count is
            the client tally of sub_agent_start (phase.subAgents.length) — NO
            per-phase tool/search/source chip (D-03 / Pitfall 5 suppression). */}
        {phase.subAgents.length > 0 && (
          <>
            <span className="text-[11px] font-medium text-panel-muted-foreground">
              {phase.subAgents.length} {phase.subAgents.length === 1 ? "agent" : "agents"}
            </span>
            <ol className="flex flex-col gap-1.5">
              {phase.subAgents.map((agent) => (
                <SubAgentRow key={agent.sub_run_id} agent={agent} />
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}

export default PhaseCard
