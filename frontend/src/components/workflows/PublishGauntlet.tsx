/**
 * Phase 103-05 Task 1 (REQ-6 / WFAUTH-01, sketch 020-B "Publish Gauntlet Honesty")
 * — the publish-gauntlet UI CLIENT.
 *
 * Phase 103-ux: the gauntlet no longer crams into the Builder HEADER (where the
 * full 8-stage spine + verdict overflowed and OVERLAPPED the read-only diagram +
 * step-form). The resting render is now a COMPACT "Publish…" trigger button that
 * fits the header; the full gauntlet content opens in a centered MODAL over a
 * dimmed/blurred backdrop (the SAME shell as WorkflowsPage's RunModal — same
 * z-index, backdrop, Escape/focus contract). Only the CONTAINER is new — every
 * honesty contract below is byte-for-behavior unchanged and lives in the modal.
 *
 * Publishing is NOT a button that succeeds: it triggers the EXISTING server-side
 * 8-stage gauntlet (owner → definition-valid → business_requirement → lint →
 * interactive-phase → a REAL golden run on the project KB → structural gate →
 * an independent judge → flip). This component RENDERS that gauntlet's verdict; it
 * NEVER re-runs or re-derives it. The honesty contracts (the G-6 silent-pass
 * guards) are LOAD-BEARING — do not soften them:
 *
 *  1. VERBATIM verdict — the 5 PublishVerdict fields (published / version /
 *     golden_run_id / blocked_stage / named_failures) render exactly as the server
 *     returned them. The display is a SUCCESS only when `verdict.published === true`;
 *     a 200-with-`published:false` (any blocked_stage incl. "judge") is a BLOCK. The
 *     client never recomputes published/blocked_stage. (T-103-05-01)
 *  2. 4 DISTINCT HTTP outcomes — the Plan-03 `publishWorkflow` maps the statuses to
 *     a discriminated `PublishOutcome.kind`; we switch on `kind` (verdict /
 *     business_requirement / not_found / already_published). A binary
 *     `200=ok/else=error` handler is FORBIDDEN. (T-103-05-02)
 *  3. JUDGE HARD WALL — there is NO override / "publish anyway" anywhere; the absent
 *     override is rendered struck-through; the only forward affordance is
 *     "Fix & re-publish". (T-103-05-03)
 *  4. KEY-DETECTION — `named_failures` is POLYMORPHIC across stages (lint
 *     `{code,phase,message}` / judge `{criterion,score,evidence}` / `{summary}` /
 *     interactive `{phase,message}` / bare string). `renderFailure` detects the
 *     shape per ENTRY (never switches on blocked_stage). ANY bare string / missing-
 *     criterion / unrecognized shape renders as a BLOCK, never a pass. (T-103-05-04)
 *
 * The run link gates strictly on `golden_run_id != null` (stage 3+ reached);
 * otherwise an explicit no-run note. Lint codes render the LOWERCASE literals.
 */
import { useEffect, useId, useRef, useState } from "react"
import type { ComponentType, SVGProps } from "react"
import { publishWorkflow, type PublishOutcome, type PublishVerdict } from "@/lib/api"
// Phase 124-03 Task 2 (WUX-01, D-06, sketch 046-A ③) — the publish-summary soul
// block. PREPEND ONLY: <WorkflowSoul scale="pub"> sits ABOVE the existing 8-stage
// gauntlet ladder + verdict, which stay byte-behavior-identical (the ladder re-skin
// is WUX-03 / Phase 127). The definition is threaded from the Builder's renderPublish.
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
import type { DefShape } from "@/components/workflows/soulData"
// Phase 186-05 (CONCUR-02, D-186-11) — the worded refusal. The map + its total resolver
// live in the pure verdict module, next to the other sentences a surface says about a
// check; see that module's docblock for why a component file cannot own them.
import { blockedSentence } from "@/components/workflows/verdictModel"
// Phase 127-02 Task 1 (WUX-03, sketch 051-A) — the engized gauntlet re-skin.
// The engine chip mirrors RunCard's providerLogo()→Bot fallback (icon-convention
// §1); the 8 stage glyphs are the bundled 3D fluent-emoji set (icon-convention §3).
import { Bot } from "lucide-react"
import { providerLogo } from "@/lib/providerLogo"
// The gauntlet-node 3D glyphs, bundled at build time by unplugin-icons — one per row of
// the STAGES table below, in the same order and the same count. Only API-verified-present
// fluent-emoji slugs are used (icon-convention §3 / RESEARCH §Pitfall 2). The empty-render
// traps (`direct-hit` / `no-entry-sign`) are NEVER referenced — and because an unverified
// slug renders as an EMPTY svg rather than failing to build, the newest addition here is
// pinned by a render assertion in the suite, not by this comment.
import Shield from "~icons/fluent-emoji/shield"
import CheckMarkButton from "~icons/fluent-emoji/check-mark-button"
import Bullseye from "~icons/fluent-emoji/bullseye"
import MagnifyingGlassTiltedLeft from "~icons/fluent-emoji/magnifying-glass-tilted-left"
import RaisedHand from "~icons/fluent-emoji/raised-hand"
import Rocket from "~icons/fluent-emoji/rocket"
import Locked from "~icons/fluent-emoji/locked"
import BalanceScale from "~icons/fluent-emoji/balance-scale"
import ChequeredFlag from "~icons/fluent-emoji/chequered-flag"

/** An unplugin-icons bundled 3D SVG component (accepts standard SVG attrs + size). */
type StageIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

export interface PublishGauntletProps {
  /** The draft definition id to publish (POST /workflows/{id}/publish). */
  definitionId: string
  /** Phase 124-03 Task 2 (WUX-01, D-06): the authored definition for the prepended
   *  pub-scale soul block. OPTIONAL + additive — absent (e.g. a draftId-only call
   *  site) renders the soul's honest draft empty-states, never a crash. Threaded
   *  from the Builder's renderPublish(state.definition, draftId). */
  definition?: DefShape | null
  /** Fired on a PASS so the parent (Plan 06) can auto-return to the Workflows page. */
  onPublished?: (version: number) => void
  /**
   * Phase 184-11 (R12, sketch 141-B) — WHY publish cannot be attempted yet, in the
   * author's own words, or absent/null when it can.
   *
   * ABSENT ⇒ TODAY'S BEHAVIOUR, BYTE-FOR-BYTE. This component is rendered by every
   * publish call site in the app, and only the flagged canvas Builder has a live
   * structural verdict to hand it — so a missing prop must leave the trigger exactly as
   * it shipped, enabled and unadorned. The 24 shipped assertions in
   * `PublishGauntlet.test.tsx` render without it and are the guard on that.
   *
   * A NON-EMPTY STRING DISABLES THE TRIGGER **AND NAMES THE REASON**. Greying alone is
   * not enough: a disabled control with no stated reason is the exit hidden, and R12 is
   * explicit that the author must be told what to fix. The sentence is rendered visibly
   * beside the control and tied to it with `aria-describedby`, so it reaches a screen
   * reader too — a disabled button is skipped by some reading modes, and the reason is
   * the part that matters.
   *
   * THE WORDING IS THE CALLER'S. This component neither derives it nor rewrites it: the
   * page passes the server's own first message verbatim (or the plain invitation on an
   * empty draft). There is no severity, code or lint table anywhere in this file.
   */
  blockedReason?: string | null
}

/**
 * The server-fixed gauntlet, row by row (sketch 020-B D2 / publish_service.py `STAGES`).
 * The client DISPLAYS them in order — it does not invent or reorder them. The `codes`
 * are the verbatim `blocked_stage` values a block at that row emits; the spine highlight
 * (passed-up-to / blocked-at) is a VISUAL derivation only — the PASS/BLOCK truth comes
 * from the server verdict, never re-computed here.
 *
 * The first eight rows are the eight CHECKS. The last row is the publish COMMIT — the
 * flip itself, which sketch 020-B D2 has always carried as its own row and which the
 * spine had no node for until Phase 186-05. It is appended rather than inserted, on
 * purpose and in two senses: a refusal there happened AFTER the grader passed, so
 * folding its code into the Judge row would tell an author the grader stopped them,
 * which is false; and appending leaves the golden-run row at the same index the running
 * highlight below points at.
 */
const STAGES: { label: string; what: string; codes: string[]; Icon: StageIcon }[] = [
  { label: "Owner", what: "Owner check — RLS-resolve + you own it", codes: ["not_found"], Icon: Shield },
  { label: "Valid", what: "Definition valid — re-validates as a WorkflowDefinition", codes: ["definition_invalid"], Icon: CheckMarkButton },
  { label: "Goal", what: "business_requirement — exactly one must be declared", codes: ["business_requirement"], Icon: Bullseye },
  { label: "Structure", what: "Structural lint — reachable · terminal · inputs satisfied · no orphans", codes: ["lint"], Icon: MagnifyingGlassTiltedLeft },
  { label: "Pause", what: "Interactive-phase check — human-pause phases can't validate synchronously", codes: ["interactive_phase"], Icon: RaisedHand },
  { label: "Golden run", what: "Golden run — a REAL harness run against the project KB", codes: ["golden_run_timeout", "golden_run_error"], Icon: Rocket },
  { label: "Citations", what: "Structural gate — citations / integrity checked during the run", codes: ["structural_gate"], Icon: Locked },
  { label: "Judge", what: "Independent judge — an independent model grades the deliverable", codes: ["judge"], Icon: BalanceScale },
  { label: "Commit", what: "Publish commit — the draft must not have changed while we were checking it", codes: ["draft_changed"], Icon: ChequeredFlag },
]

/** The HTTP status surfaced for each discriminated outcome kind (for the badge). */
function httpStatusForKind(kind: PublishOutcome["kind"]): number {
  switch (kind) {
    case "verdict":
      return 200
    case "business_requirement":
      return 400
    case "not_found":
      return 404
    case "already_published":
      return 409
  }
}

/** A bare-string block message — the un-producible-verdict / pre-run honest line. */
function BlockMessage({ text }: { text: string }) {
  return (
    <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] leading-relaxed text-destructive">
      {text}
    </div>
  )
}

/** A judge per-criterion row: {criterion, score, evidence}. */
function CriterionRow({ criterion, score, evidence }: { criterion: unknown; score: unknown; evidence: unknown }) {
  const pct = typeof score === "number" ? Math.max(0, Math.min(1, score)) * 100 : 0
  return (
    <div className="mb-2 grid grid-cols-[24px_1fr_64px] items-center gap-3 rounded border border-destructive/40 bg-card px-3 py-2">
      <span className="text-destructive" aria-hidden>
        ✕
      </span>
      <div>
        <div className="font-mono text-[12px] text-foreground">{String(criterion)}</div>
        {evidence != null && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{String(evidence)}</div>
        )}
      </div>
      <div className="text-right">
        <div className="font-mono text-[12px] text-destructive">{typeof score === "number" ? score.toFixed(2) : "—"}</div>
        <div className="mt-1 h-[3px] overflow-hidden rounded bg-muted">
          <i className="block h-full bg-destructive" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

/** A lint row: {code, phase, message}; the code is a LOWERCASE LintError literal. */
function LintRow({ code, phase, message }: { code: unknown; phase: unknown; message: unknown }) {
  return (
    <div className="mb-2 rounded border border-destructive/40 bg-card px-3 py-2 text-[12px]">
      <span className="font-mono text-destructive">{String(code)}</span>
      {phase != null && <span className="ml-2 font-mono text-[11px] text-muted-foreground">{String(phase)}</span>}
      {message != null && <div className="mt-0.5 text-[11px] leading-relaxed text-foreground">{String(message)}</div>}
    </div>
  )
}

/** An interactive-phase row: {phase, message}. */
function PhaseRow({ phase, message }: { phase: unknown; message: unknown }) {
  return (
    <div className="mb-2 rounded border border-destructive/40 bg-card px-3 py-2 text-[12px]">
      <span className="font-mono text-destructive">{String(phase)}</span>
      {message != null && <div className="mt-0.5 text-[11px] leading-relaxed text-foreground">{String(message)}</div>}
    </div>
  )
}

/** The server-authored judge summary paragraph. */
function SummaryLine({ text }: { text: unknown }) {
  return (
    <div className="mb-2 rounded border border-border bg-card px-3 py-2">
      <div className="mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
        judge summary (one paragraph, server-authored)
      </div>
      <div className="text-[12px] leading-relaxed text-foreground">{String(text)}</div>
    </div>
  )
}

/**
 * KEY-DETECTION render of one `named_failures` entry (sketch 020-B D4/D10,
 * RESEARCH Pattern 5). Detect which keys the entry has — NEVER switch on
 * blocked_stage (the list can MIX shapes). ANY bare string / missing-criterion /
 * unrecognized shape renders as a BLOCK, never a pass.
 */
function renderFailure(entry: unknown, key: number) {
  if (typeof entry === "string") return <BlockMessage key={key} text={entry} />
  if (entry && typeof entry === "object") {
    const e = entry as Record<string, unknown>
    if ("criterion" in e) return <CriterionRow key={key} criterion={e.criterion} score={e.score} evidence={e.evidence} />
    if ("code" in e) return <LintRow key={key} code={e.code} phase={e.phase} message={e.message} />
    if ("phase" in e && "message" in e) return <PhaseRow key={key} phase={e.phase} message={e.message} />
    if ("summary" in e) return <SummaryLine key={key} text={e.summary} />
  }
  return <BlockMessage key={key} text="the judge could not produce a verdict — treated as a block, never a pass" />
}

/** A single verbatim verdict field row (key + value, mono). */
function VerdictRow({ name, value }: { name: keyof PublishVerdict; value: unknown }) {
  let rendered: React.ReactNode
  if (value === null || value === undefined) {
    rendered = <span className="italic text-muted-foreground">null</span>
  } else if (typeof value === "boolean") {
    rendered = <span className={value ? "text-success" : "text-destructive"}>{String(value)}</span>
  } else if (name === "blocked_stage") {
    rendered = <span className="text-destructive">{String(value)}</span>
  } else if (name === "named_failures" && Array.isArray(value)) {
    rendered = <span>{value.length === 0 ? "[] (empty)" : `list · ${value.length} item(s) (rendered above)`}</span>
  } else {
    rendered = <span>{String(value)}</span>
  }
  return (
    <div
      data-testid={`verdict-${name}`}
      className="grid grid-cols-[160px_1fr] items-center gap-3 border-b border-border px-3 py-2 text-[12px] last:border-b-0"
    >
      <span className="font-mono text-[10px] text-muted-foreground">{name}</span>
      <span className="break-words font-mono text-[11.5px] text-foreground">{rendered}</span>
    </div>
  )
}

/** The verbatim 5-field PublishVerdict grid (rendered, never re-derived). */
function VerdictFields({ verdict }: { verdict: PublishVerdict }) {
  return (
    <div className="mt-4 overflow-hidden rounded border border-border">
      <VerdictRow name="published" value={verdict.published} />
      <VerdictRow name="version" value={verdict.version} />
      <VerdictRow name="golden_run_id" value={verdict.golden_run_id} />
      <VerdictRow name="blocked_stage" value={verdict.blocked_stage} />
      <VerdictRow name="named_failures" value={verdict.named_failures} />
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 font-mono text-[9px] text-muted-foreground">
        <span className="text-accent-violet" aria-hidden>
          ▦
        </span>
        rendered verbatim from the server — not re-derived in the client.
      </div>
    </div>
  )
}

/** The "view the golden run" link, gated on golden_run_id != null; else the note.
 *  IR-02: the run-surface route is deferred (D-103-A → 103.1/104), so this is NOT
 *  yet navigable. Render it as a disabled button (not an <a href="#"> that scrolls
 *  to top) with an honest "coming soon" title — no dead affordance. */
function RunLink({ goldenRunId }: { goldenRunId: string | null }) {
  if (goldenRunId != null) {
    return (
      <button
        type="button"
        data-testid="run-link"
        disabled
        title="Run view coming soon — the golden-run surface lands in a later phase (D-103-A)."
        className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary opacity-70"
      >
        ▦ Golden run that was judged · {goldenRunId.slice(0, 8)}… (view coming soon)
      </button>
    )
  }
  return (
    <div
      data-testid="no-run-note"
      className="mt-4 rounded border border-dashed border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground"
    >
      ↳ <span className="text-foreground">golden_run_id</span> is{" "}
      <span className="italic">null</span> — this blocked before stage 3, so there is no run to open. (A pre-run block
      never has a run link.)
    </div>
  )
}

/** The judge hard wall — the no-override strip + Fix & re-publish. */
function HardWall({ onFix }: { onFix: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-border bg-card px-3 py-2 text-[12px]">
      <span className="text-muted-foreground">
        The only path forward is to fix the deliverable and re-publish — each attempt is a brand-new golden run and a
        fresh judge verdict.
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">
        no override · <s className="opacity-60">publish anyway</s>
      </span>
      <button
        type="button"
        onClick={onFix}
        className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary"
      >
        ↻ Fix &amp; re-publish
      </button>
    </div>
  )
}

/**
 * The gauntlet energy-spine. `blockedStage` (server-truth) drives the highlight.
 *
 * Phase 127-02 Task 1 (WUX-03, sketch 051-A): the wrapping boxes become a compact
 * horizontal spine of 3D icon nodes joined by energy connectors — passed nodes glow
 * green with a ✓ badge, the running golden-run node (i===5) pulses an amber aura with
 * an energy comet flowing into it, a blocked node turns red. All motion is gated behind
 * prefers-reduced-motion (colour + glyph + ✓ badge carry the state without any
 * animation).
 *
 * ── PHASE 186-05: THE SPINE FAILS CLOSED ON A STAGE IT CANNOT PLACE (F7) ──
 * `findIndex` answers -1 for a stage this client has never seen, which is the SAME value
 * it answers when nothing was blocked at all. Both per-node reads below used to branch
 * straight off that single -1, so the two cases collapsed and a refusal painted every
 * node passed: a full green spine with ✓ badges underneath a "Blocked" headline. A green
 * indicator scoped to the wrong thing is the T-185-04-01 pattern, and it became reachable
 * in production the moment the publish commit began refusing a draft that moved.
 *
 * The repair is a PROPERTY, not a special case for the code that exposed it: the -1
 * sentinel is now interpreted exactly once, into two named states with opposite meanings,
 * and every future `blocked_stage` the backend adds inherits the closed behaviour with no
 * edit here. There is deliberately NO client-side list of acceptable stages — the server
 * owns the verdict vocabulary (D-182-06 / VALID-03, stated on `Verdict.code` in the API
 * client), so the client renders what arrives and fails closed on what it has not seen.
 */
function GauntletSpine({ blockedStage, running }: { blockedStage: string | null; running: boolean }) {
  // Find the FIRST stage whose codes contain the server's blocked_stage (visual only).
  const blockedIndex = blockedStage
    ? STAGES.findIndex((s) => s.codes.includes(blockedStage))
    : -1
  // A block HAPPENED — `blockedStage != null` is the server saying so — but we could not
  // place it on the spine. The missing index carries BOTH meanings, and this is the line
  // that separates them: everything after it may read the remaining -1 as "no block".
  // Derived ONCE, above the map, so the two per-node reads cannot drift apart again.
  const unknownBlock = blockedStage != null && blockedIndex === -1
  return (
    <div data-testid="gauntlet-spine" className="flex items-start overflow-x-auto py-4">
      {STAGES.map((stage, i) => {
        const isBlocked = blockedIndex === i
        // Unplaceable block first, placed block second, no block last. Only in that order
        // is the fail-closed case unreachable by falling through anything — and the tail
        // is honest precisely BECAUSE the guard ran first: a missing index that is not an
        // unknown block can only be "nothing blocked", which still waits for the run.
        const isPassed = unknownBlock ? false : blockedIndex >= 0 ? i < blockedIndex : !running
        const isRunning = running && i === 5
        const Icon = stage.Icon
        // The connector LEADING INTO this node is "reached" up to (and incl.) the block.
        // The SAME guard in the SAME order, because this is a SECOND, independent read of
        // the same index: repairing only the line above left the connectors lighting green
        // under a refusal, which is exactly the half-fix the suite pins separately.
        const connReached = unknownBlock ? false : blockedIndex >= 0 ? i <= blockedIndex : !running
        const nodeTone = isBlocked
          ? "border-destructive/60 bg-destructive/10"
          : isPassed
            ? "border-success/50 bg-success/10"
            : isRunning
              ? "border-amber-500 bg-amber-500/10"
              : "border-border bg-card"
        const labelTone = isBlocked
          ? "text-destructive"
          : isPassed
            ? "text-success"
            : isRunning
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
        return (
          <div key={stage.label} className="flex items-start" title={stage.what}>
            {i > 0 && (
              <div className={`relative mt-[20px] h-[3px] w-4 shrink-0 rounded-full sm:w-6 ${connReached ? "bg-success/50" : "bg-border"}`}>
                {/* The energy comet flows along the connector INTO the running golden-run node. */}
                {running && i === 5 && <span className="gauntlet-comet" aria-hidden />}
              </div>
            )}
            <div className="flex w-[64px] shrink-0 flex-col items-center gap-1">
              <div
                className={`relative grid h-10 w-10 place-items-center rounded-xl border-2 ${nodeTone} ${
                  isRunning ? "gauntlet-node-run" : ""
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {isPassed && (
                  <span
                    className="absolute -right-1.5 -top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-success text-[8px] font-bold leading-none text-white"
                    aria-hidden
                  >
                    ✓
                  </span>
                )}
              </div>
              <div className={`text-center font-mono text-[9px] leading-tight ${labelTone}`}>{stage.label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The golden-run HERO while the gauntlet blocks the request. Phase 127-02 Task 1
 * (WUX-03, sketch 051-A): the calm notice becomes the hero moment — a glowing
 * amber panel (breathing aura, reduced-motion-gated) around the rocket node + a
 * live elapsed-seconds clock, so the synchronous golden-run wait reads as "your
 * workflow is running for real," not a dead spinner. The `publish-elapsed` testid
 * + the live mm/ss clock are unchanged. The optional `provider` drives the engine
 * chip via the shared `providerLogo()`→`Bot` pattern (mirrors RunCard.tsx:256/310,
 * icon-convention §1) — when no honest provider value is available on this surface
 * the chip is OMITTED entirely (honestly-absent), never a fabricated engine
 * (T-127-06).
 */
function PublishingNotice({ elapsedSec, provider }: { elapsedSec: number; provider?: string }) {
  const mm = Math.floor(elapsedSec / 60)
  const ss = elapsedSec % 60
  const clock = mm > 0 ? `${mm}m ${String(ss).padStart(2, "0")}s` : `${ss}s`
  // The resolved provider brand mark (null for unmapped/undefined → Bot fallback).
  // Resolved at the component top, mirroring RunCard's HeaderMark pattern verbatim
  // (providerLogo is total over undefined → null). providerLogo returns a STABLE
  // module-level component reference from the `MARKS` map — it does NOT create a
  // new component per render, so static-components is a false positive here (same
  // pattern as RunCard.tsx:256/311, which the rule does not flag in its larger body).
  const EngineMark = providerLogo(provider)
  return (
    <div className="gauntlet-hero-glow relative mt-2 overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-[12px] text-amber-600 dark:text-amber-400">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 font-semibold">
          <span
            className="gauntlet-node-run relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-amber-500 bg-amber-500/20"
            aria-hidden
          >
            <Rocket className="h-5 w-5" />
          </span>
          Running the golden run on your KB…
        </div>
        <span data-testid="publish-elapsed" className="flex-none font-mono text-[13px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
          {clock} elapsed
        </span>
      </div>
      {/* Engine chip — honest provider only; omitted entirely when unknown (T-127-06). */}
      {provider && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Engine:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {/* eslint-disable-next-line react-hooks/static-components -- EngineMark is a stable module-level mark from providerLogo's MARKS map (false positive; mirrors RunCard.tsx:311). */}
            {EngineMark ? <EngineMark size={14} /> : <Bot className="h-3.5 w-3.5" />}
            <span>{provider}</span>
          </span>
        </div>
      )}
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Publish runs your <b>whole workflow for real</b> against your knowledge base, then an independent judge grades the
        result — so a multi-step workflow can take a <b>few minutes</b>. Same harness, same tools, same model, so the judge
        grades a <b>real</b> deliverable, not a dry-run. It blocks until the verdict is ready — please <b>don't close the
        tab</b>; the verdict comes back inline when the run + judge finish.
      </p>
    </div>
  )
}

/**
 * The full gauntlet content (the resting publish form + the 8-stage spine +
 * the in-progress notice + the verbatim outcome). Rendered INSIDE the modal.
 * The honesty contracts live here, unchanged — only the container moved.
 */
function GauntletContent({
  definitionId,
  definition,
  onPublished,
  loading,
  setLoading,
  goldenInputRef,
}: {
  definitionId: string
  definition?: DefShape | null
  onPublished?: (version: number) => void
  loading: boolean
  setLoading: (v: boolean) => void
  goldenInputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [goldenInput, setGoldenInput] = useState("")
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)

  const canPublish = goldenInput.trim().length > 0 && !loading

  // Elapsed-seconds ticker — runs only while the golden run is in flight, so the
  // user can SEE the synchronous publish is alive (no live per-phase progress).
  useEffect(() => {
    if (!loading) return
    setElapsedSec(0)
    const started = Date.now()
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [loading])

  async function runGauntlet() {
    if (!canPublish) return
    setLoading(true)
    setError(null)
    setOutcome(null)
    try {
      const result = await publishWorkflow(definitionId, goldenInput)
      setOutcome(result)
      // VERBATIM: a PASS is ONLY published === true (never re-derived).
      if (result.kind === "verdict" && result.verdict.published === true) {
        onPublished?.(result.verdict.version ?? 0)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "publish failed")
    } finally {
      setLoading(false)
    }
  }

  // Derive the verdict (for kinds that carry one) WITHOUT re-deriving pass/block.
  const verdict =
    outcome && (outcome.kind === "verdict" || outcome.kind === "business_requirement") ? outcome.verdict : null
  // A SUCCESS is exclusively published === true on a 200 verdict — server truth.
  const isSuccess = outcome?.kind === "verdict" && verdict?.published === true
  const isBlock = outcome != null && !isSuccess

  // Phase 127-02 Task 2 (WUX-03, sketch 051-A): the plain-worded headline that LEADS
  // the resolved block — DERIVED from server truth (verdict.published / blocked_stage),
  // it NEVER re-derives pass/block (T-127-03). Lead-with-words: a business user reads a
  // pass/block in ~3 seconds; the verbatim 5-field grid is demoted behind the <details>
  // below (one click away, never removed).
  //
  // Phase 186-05: the refusal arm no longer interpolates the server's stage token into
  // the sentence a business user reads. `blockedSentence` is total — it answers a
  // SENTENCE for a stage it has never seen — so no machine code can reach this line,
  // while the verbatim token keeps rendering inside the raw-verdict disclosure below.
  // The wording lives in the pure module because a component file may not export shared
  // constants (`react-refresh/only-export-components`).
  const wordedHeadline = verdict
    ? isSuccess
      ? `Published — v${verdict.version ?? "—"} is live`
      : blockedSentence(verdict.blocked_stage)
    : ""

  return (
    <div className="w-full">
      {/* Phase 124-03 Task 2 (WUX-01, D-06, sketch 046-A ③): the PREPENDED pub-scale
          soul block — purpose · needs · glyph-dot spine · tier chip · output — ABOVE
          the resting publish form. When `definition` is absent the soul renders its
          honest draft empty-states. */}
      <div data-testid="publish-soul" className="mb-3 rounded-lg border border-border bg-card p-4">
        <WorkflowSoul def={definition} scale="pub" />
      </div>

      {/* D0 — 8-stage energy-spine: ABOVE the form (sketch 051-A). The spine is the
          centrepiece of the gauntlet — always visible once the modal opens so the user
          can see the 8 checks at a glance before and after clicking Publish. */}
      <GauntletSpine blockedStage={verdict?.blocked_stage ?? null} running={loading} />

      {/* D1 — the resting publish form: hidden once a verdict arrives (the HardWall's
          "Fix & re-publish" clears the verdict and re-shows the form). For 404/409
          (no verdict body) the form stays visible so the user can still try again. */}
      {!verdict && (
        <div className="mt-2 rounded-lg border border-border bg-card p-4">
          <div className="font-mono text-[11px] font-semibold text-foreground">◆ Publish this workflow</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Publishing runs the full <b>8-stage gauntlet</b> — including a <b>real golden run</b> of this workflow against
            your project KB and an <b>independent judge</b> of the result. It can honestly block.
          </p>
          <label
            htmlFor="golden_input"
            className="mt-4 mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            golden_input — a representative kickoff prompt
          </label>
          <textarea
            id="golden_input"
            ref={goldenInputRef}
            value={goldenInput}
            onChange={(e) => setGoldenInput(e.target.value)}
            placeholder="Choose something typical, not a corner case — this is the prompt the judge grades."
            className="min-h-[88px] w-full resize-y rounded border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground focus:border-primary focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              disabled={!canPublish}
              onClick={runGauntlet}
              className="rounded bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? "Publishing…" : "Publish ▸ run the gauntlet"}
            </button>
          </div>
        </div>
      )}

      {loading && <PublishingNotice elapsedSec={elapsedSec} />}

      {error && !loading && <div className="mt-3 text-[12px] text-destructive">Publish request failed: {error}</div>}

      {outcome && !loading && (
        <div className="mt-2">
          {/* The verbatim HTTP outcome badge — the 4 outcomes are DISTINCT. */}
          <div className="mb-2 flex items-center gap-2">
            <span
              data-testid="http-outcome"
              className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                outcome.kind === "verdict"
                  ? "border-border text-foreground"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {httpStatusForKind(outcome.kind)} · {outcome.kind}
            </span>
          </div>

          {/* not_found (404) and already_published (409) carry no verdict body. */}
          {outcome.kind === "not_found" && (
            <div data-testid="publish-block" className="rounded border border-destructive/40 bg-destructive/10 p-4">
              <div className="font-semibold text-destructive">Workflow not found</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                You don't own it, or it doesn't exist (a cross-user attempt collapses to the same 404 — no existence
                leak).
              </p>
            </div>
          )}
          {outcome.kind === "already_published" && (
            <div data-testid="publish-block" className="rounded border border-destructive/40 bg-destructive/10 p-4">
              <div className="font-semibold text-destructive">Already published</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                This version is already published (a concurrent double-publish lost the race). Tweak forks a new draft
                version.
              </p>
            </div>
          )}

          {/* 200 verdict / 400 business_requirement — render the verbatim verdict. */}
          {verdict && (
            <div
              data-testid={isSuccess ? "publish-success" : "publish-block"}
              className={`rounded-lg border p-4 ${
                isSuccess ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
              }`}
            >
              {/* Lead-with-words: big emoji icon + enlarged worded headline (sketch 051-A).
                  The icon is aria-hidden; the headline text carries the meaning (server-truth
                  derived, T-127-03). The verbatim 5-field grid stays demoted behind <details>. */}
              <div className="mb-3 flex items-start gap-3">
                <span className="flex-none text-4xl leading-none" aria-hidden>
                  {isSuccess ? "🎉" : verdict.blocked_stage === "judge" ? "⚖️" : "⛔"}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    data-testid="verdict-headline"
                    className={`text-[17px] font-bold leading-snug ${isSuccess ? "text-success" : "text-destructive"}`}
                  >
                    {wordedHeadline}
                  </div>
                  {isBlock && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {verdict.blocked_stage === "judge"
                        ? 'The golden run succeeded — but the independent judge would not pass its result. This is a hard wall — there is no "publish anyway."'
                        : "The gauntlet honestly blocked this publish. Fix the cause and re-publish."}
                    </p>
                  )}
                </div>
              </div>

              {/* The verbatim 5-field verdict grid — DEMOTED behind a disclosure so the
                  resolved block LEADS with words. The verbatim render + the `▦ rendered
                  verbatim` provenance cap stay INSIDE the <details> (VerdictFields kept
                  whole), so the honesty is one click away, not removed (T-127-03). The
                  per-criterion judge rows + RunLink + HardWall below stay FIRST-CLASS. */}
              <details data-testid="raw-verdict" className="rawbox mt-4">
                <summary className="font-mono text-[11px] text-accent-violet">
                  Show raw verdict — the 5 server fields, verbatim
                </summary>
                <VerdictFields verdict={verdict} />
              </details>

              {/* named_failures rendered by KEY-DETECTION (any string/unknown → block). */}
              {verdict.named_failures.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    named_failures — what blocked publish
                  </div>
                  {verdict.named_failures.map((entry, i) => renderFailure(entry, i))}
                </div>
              )}

              {/* The run link gates on golden_run_id != null. */}
              {!isSuccess && <RunLink goldenRunId={verdict.golden_run_id} />}
              {isSuccess && verdict.golden_run_id != null && <RunLink goldenRunId={verdict.golden_run_id} />}

              {/* The judge / any block is a HARD WALL — no override, only Fix & re-publish. */}
              {isBlock && <HardWall onFix={() => setOutcome(null)} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The exported gauntlet: a COMPACT trigger button + a centered MODAL (sketch
 * 020-B, Phase 103-ux). At rest it is JUST the "Publish…" button (fits the
 * Builder header's shrink-0 slot). Clicking it opens the full gauntlet content
 * in a modal over a dimmed/blurred backdrop — the SAME shell as WorkflowsPage's
 * RunModal (same z-[9000] backdrop, same Escape/focus contract). Because the
 * modal is `position:fixed`, it escapes the header's overflow/shrink-0 context
 * and never clips or crams into the layout.
 */
export function PublishGauntlet({
  definitionId,
  definition,
  onPublished,
  blockedReason,
}: PublishGauntletProps) {
  const [open, setOpen] = useState(false)
  // Phase 184-11 (R12): the reason's id, so `aria-describedby` can point at it. `useId`
  // keeps two gauntlets on one page from colliding.
  const blockedReasonId = useId()
  // An empty string is NOT a reason, so it does not block — a caller that has nothing to
  // say must not be able to disable the control by accident.
  const blocked = typeof blockedReason === "string" && blockedReason.trim().length > 0
  // `loading` lives on the wrapper so close affordances (✕ / backdrop / Escape)
  // can be BLOCKED while a publish is in flight (the gauntlet runs synchronously).
  const [loading, setLoading] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const goldenInputRef = useRef<HTMLTextAreaElement>(null)

  function requestClose() {
    // Never close while a publish is in flight (the request blocks; closing would
    // orphan the in-progress notice + the user's elapsed-time reassurance).
    if (loading) return
    setOpen(false)
  }

  // Initial focus lands on the golden_input textarea once the modal opens.
  useEffect(() => {
    if (open) goldenInputRef.current?.focus()
  }, [open])

  // Escape-to-close + simple Tab focus containment — mirrors RunModal's contract.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key !== "Tab") return
      const root = dialogRef.current
      if (!root) return
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading])

  return (
    <>
      {/* The resting trigger — compact, fits the Builder header's shrink-0 slot.
          Phase 184-11 (R12): while a reason is supplied it is DISABLED and the reason is
          named right beside it — never greyed in silence. With no reason supplied both
          the `disabled` and the `aria-describedby` attributes are absent, so the rendered
          control is the one that shipped. */}
      <button
        type="button"
        data-testid="publish-trigger"
        onClick={() => setOpen(true)}
        disabled={blocked}
        aria-describedby={blocked ? blockedReasonId : undefined}
        // The blocked styling is APPENDED rather than expressed as `disabled:` variants,
        // so the unblocked class string is the shipped one character for character.
        className={
          "rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90" +
          (blocked ? " cursor-not-allowed opacity-50" : "")
        }
      >
        ◆ Publish…
      </button>
      {blocked && (
        <span
          id={blockedReasonId}
          data-testid="publish-blocked-reason"
          className="ml-2 text-[12px] leading-snug text-muted-foreground"
        >
          {blockedReason}
        </span>
      )}

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Publish this workflow"
          data-testid="publish-modal"
          className="fixed inset-0 z-[9000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
        >
          {/* Phase 155 (A11Y-01): backdrop-dismiss lives on a dedicated tabIndex=-1
              <button> instead of a mousedown handler on the role="dialog" element
              (jsx-a11y/no-noninteractive-element-interactions). Click the dimmed
              backdrop (not the card) to close — blocked mid-publish (requestClose
              no-ops while loading). */}
          <button
            type="button"
            data-testid="publish-modal-backdrop"
            aria-label="Close dialog"
            tabIndex={-1}
            className="absolute inset-0 cursor-default"
            onMouseDown={requestClose}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">◆</span>
                <span className="text-[15px] font-semibold text-foreground">Publish this workflow</span>
              </div>
              <button
                type="button"
                data-testid="publish-modal-close"
                onClick={requestClose}
                disabled={loading}
                aria-label="Close"
                title={loading ? "Can't close while the gauntlet is running" : "Close"}
                className="rounded-md border border-border px-2 py-0.5 text-[15px] leading-none text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✕
              </button>
            </div>
            {/* The scrollable body so the 8-stage spine + verdict never overflow. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <GauntletContent
                definitionId={definitionId}
                definition={definition}
                onPublished={onPublished}
                loading={loading}
                setLoading={setLoading}
                goldenInputRef={goldenInputRef}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
