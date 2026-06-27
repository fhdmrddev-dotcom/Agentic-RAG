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
import { useEffect, useRef, useState } from "react"
import type { ComponentType, SVGProps } from "react"
import { publishWorkflow, type PublishOutcome, type PublishVerdict } from "@/lib/api"
// Phase 124-03 Task 2 (WUX-01, D-06, sketch 046-A ③) — the publish-summary soul
// block. PREPEND ONLY: <WorkflowSoul scale="pub"> sits ABOVE the existing 8-stage
// gauntlet ladder + verdict, which stay byte-behavior-identical (the ladder re-skin
// is WUX-03 / Phase 127). The definition is threaded from the Builder's renderPublish.
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
import type { DefShape } from "@/components/workflows/soulData"
// Phase 127-02 Task 1 (WUX-03, sketch 051-A) — the engized gauntlet re-skin.
// The engine chip mirrors RunCard's providerLogo()→Bot fallback (icon-convention
// §1); the 8 stage glyphs are the bundled 3D fluent-emoji set (icon-convention §3).
import { Bot } from "lucide-react"
import { providerLogo } from "@/lib/providerLogo"
// The 8 gauntlet-stage 3D glyphs, bundled at build time by unplugin-icons. Only
// API-verified-present fluent-emoji slugs are used (icon-convention §3 / RESEARCH
// §Pitfall 2; aligned 1:1 with the STAGES order below). The empty-render traps
// (`direct-hit` / `no-entry-sign`) are NEVER referenced.
import Shield from "~icons/fluent-emoji/shield"
import CheckMarkButton from "~icons/fluent-emoji/check-mark-button"
import Bullseye from "~icons/fluent-emoji/bullseye"
import MagnifyingGlassTiltedLeft from "~icons/fluent-emoji/magnifying-glass-tilted-left"
import RaisedHand from "~icons/fluent-emoji/raised-hand"
import Rocket from "~icons/fluent-emoji/rocket"
import Locked from "~icons/fluent-emoji/locked"
import BalanceScale from "~icons/fluent-emoji/balance-scale"

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
}

/**
 * The 8 server-fixed stages (sketch 020-B D2 / publish_service.py `STAGES`). The
 * client DISPLAYS them in order — it does not invent or reorder them. The
 * `code` is the verbatim `blocked_stage` a block at that stage emits; the spine
 * highlight (passed-up-to / blocked-at) is a VISUAL derivation only — the PASS/BLOCK
 * truth comes from the server verdict, never re-computed here.
 */
const STAGES: { label: string; what: string; codes: string[]; Icon: StageIcon }[] = [
  { label: "Owner check", what: "RLS-resolve + you own it", codes: ["not_found"], Icon: Shield },
  { label: "Definition valid", what: "re-validates as a WorkflowDefinition", codes: ["definition_invalid"], Icon: CheckMarkButton },
  { label: "business_requirement", what: "exactly one declared", codes: ["business_requirement"], Icon: Bullseye },
  { label: "Structural lint", what: "reachable · terminal · inputs satisfied · no orphans", codes: ["lint"], Icon: MagnifyingGlassTiltedLeft },
  { label: "Interactive-phase check", what: "human-pause phases can't validate synchronously", codes: ["interactive_phase"], Icon: RaisedHand },
  { label: "Golden run on your KB", what: "a REAL harness run against the project KB", codes: ["golden_run_timeout", "golden_run_error"], Icon: Rocket },
  { label: "Structural gate", what: "citations / integrity checked during the run", codes: ["structural_gate"], Icon: Locked },
  { label: "Independent judge", what: "an independent model grades the deliverable", codes: ["judge"], Icon: BalanceScale },
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
 * The 8-stage energy-spine. `blockedStage` (server-truth) drives the highlight.
 *
 * Phase 127-02 Task 1 (WUX-03, sketch 051-A): the eight wrapping boxes become a
 * compact horizontal spine of 3D icon nodes joined by energy connectors — passed
 * nodes glow green with a ✓ badge, the running golden-run node (i===5) pulses an
 * amber aura with an energy comet flowing into it, a blocked node turns red. The
 * pass/block TRUTH is unchanged: `blockedIndex` / `isPassed` / `running && i===5`
 * are byte-identical to the shipped derivation — this is markup + tone only, never
 * a recompute of pass/block. All motion is gated behind prefers-reduced-motion
 * (colour + glyph + ✓ badge carry the state without any animation).
 */
function GauntletSpine({ blockedStage, running }: { blockedStage: string | null; running: boolean }) {
  // Find the FIRST stage whose codes contain the server's blocked_stage (visual only).
  const blockedIndex = blockedStage
    ? STAGES.findIndex((s) => s.codes.includes(blockedStage))
    : -1
  return (
    <div data-testid="gauntlet-spine" className="flex items-start overflow-x-auto py-4">
      {STAGES.map((stage, i) => {
        const isBlocked = blockedIndex === i
        const isPassed = blockedIndex === -1 ? !running : i < blockedIndex
        const isRunning = running && i === 5
        const Icon = stage.Icon
        // The connector LEADING INTO this node is "reached" up to (and incl.) the block.
        const connReached = blockedIndex === -1 ? !running : i <= blockedIndex
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
              <div className={`relative mt-[18px] h-0.5 w-4 shrink-0 sm:w-6 ${connReached ? "bg-success/50" : "bg-border"}`}>
                {/* The energy comet flows along the connector INTO the running golden-run node. */}
                {running && i === 5 && <span className="gauntlet-comet" aria-hidden />}
              </div>
            )}
            <div className="flex w-[60px] shrink-0 flex-col items-center gap-1">
              <div
                className={`relative grid h-9 w-9 place-items-center rounded-full border ${nodeTone} ${
                  isRunning ? "gauntlet-node-run" : ""
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {isPassed && (
                  <span
                    className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-success text-[8px] font-bold leading-none text-white"
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
 * An honest engine chip — the resolved provider's `@lobehub/icons` brand mark, or
 * the neutral `Bot` fallback for an unmapped provider. Mirrors RunCard's
 * `providerLogo()`→`Bot` pattern (icon-convention §1). Rendered ONLY when a real
 * provider string is available; the publish surface omits the chip entirely
 * otherwise — never a fabricated engine (T-127-06).
 */
function EngineChip({ provider }: { provider: string }) {
  const EngineMark = providerLogo(provider)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      {EngineMark ? <EngineMark size={14} /> : <Bot className="h-3.5 w-3.5" />}
      <span>{provider}</span>
    </span>
  )
}

/**
 * The golden-run HERO while the gauntlet blocks the request. Phase 127-02 Task 1
 * (WUX-03, sketch 051-A): the calm notice becomes the hero moment — a glowing
 * amber panel (breathing aura, reduced-motion-gated) around the rocket node + a
 * live elapsed-seconds clock, so the synchronous golden-run wait reads as "your
 * workflow is running for real," not a dead spinner. The `publish-elapsed` testid
 * + the live mm/ss clock are unchanged. The optional `provider` drives the engine
 * chip — when no honest provider value is available on this surface the chip is
 * OMITTED (honestly-absent), never guessed.
 */
function PublishingNotice({ elapsedSec, provider }: { elapsedSec: number; provider?: string }) {
  const mm = Math.floor(elapsedSec / 60)
  const ss = elapsedSec % 60
  const clock = mm > 0 ? `${mm}m ${String(ss).padStart(2, "0")}s` : `${ss}s`
  return (
    <div className="gauntlet-hero-glow relative overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-[12px] text-amber-600 dark:text-amber-400">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <span
            className="gauntlet-node-run relative grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-500 bg-amber-500/10"
            aria-hidden
          >
            <Rocket className="h-4 w-4" />
          </span>
          Publishing… running the golden run on your KB
        </div>
        <span data-testid="publish-elapsed" className="font-mono text-[12px] tabular-nums text-amber-600 dark:text-amber-400">
          {clock} elapsed
        </span>
      </div>
      {/* Engine chip — honest provider only; omitted entirely when unknown (T-127-06). */}
      {provider && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Engine:</span>
          <EngineChip provider={provider} />
        </div>
      )}
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Publish runs your <b>whole workflow for real</b> against your knowledge base, then an independent judge grades the
        result — so a multi-step workflow can take a <b>few minutes</b>. Same harness, same tools, same model, so the judge
        grades a <b>real</b> deliverable, not a dry-run. It blocks until the verdict is ready — please <b>don’t close the
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

  return (
    <div className="w-full">
      {/* Phase 124-03 Task 2 (WUX-01, D-06, sketch 046-A ③): the PREPENDED pub-scale
          soul block — purpose · needs · glyph-dot spine · tier chip · output — ABOVE
          the resting publish form. The 8-stage ladder + verdict below stay UNCHANGED
          (the ladder re-skin is WUX-03 / Phase 127). When `definition` is absent the
          soul renders its honest draft empty-states. */}
      <div data-testid="publish-soul" className="mb-4 rounded-lg border border-border bg-card p-4">
        <WorkflowSoul def={definition} scale="pub" />
      </div>

      {/* D1 — the resting publish form: ONE golden_input textarea + Publish. */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="font-mono text-[11px] font-semibold text-foreground">◆ Publish this workflow</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Publishing runs the full <b>8-stage gauntlet</b> — including a <b>real golden run</b> of this workflow against
          your project KB and an <b>independent judge</b> of the result. It can honestly block.
        </p>
        <label
          htmlFor="golden_input"
          className="mt-4 mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          golden_input
        </label>
        <textarea
          id="golden_input"
          ref={goldenInputRef}
          value={goldenInput}
          onChange={(e) => setGoldenInput(e.target.value)}
          placeholder="A representative kickoff prompt — choose something typical, not a corner case."
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

      {/* The 8-stage spine + the golden-run hero while the gauntlet blocks the request. */}
      <GauntletSpine blockedStage={verdict?.blocked_stage ?? null} running={loading} />

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
                You don’t own it, or it doesn’t exist (a cross-user attempt collapses to the same 404 — no existence
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
              className={`rounded border p-4 ${
                isSuccess ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
              }`}
            >
              <div className={`flex items-center gap-2 font-semibold ${isSuccess ? "text-success" : "text-destructive"}`}>
                <span aria-hidden>{isSuccess ? "✓" : "✕"}</span>
                {isSuccess ? (
                  <span>Published v{verdict.version ?? "—"}</span>
                ) : (
                  <span>
                    Blocked at <span className="font-mono">{verdict.blocked_stage ?? "unknown"}</span>
                  </span>
                )}
              </div>
              {isBlock && (
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {verdict.blocked_stage === "judge"
                    ? "The golden run succeeded — but the independent judge would not pass its result. This is a hard wall — there is no “publish anyway.”"
                    : "The gauntlet honestly blocked this publish. Fix the cause and re-publish."}
                </p>
              )}

              {/* The verbatim 5-field verdict grid. */}
              <VerdictFields verdict={verdict} />

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
export function PublishGauntlet({ definitionId, definition, onPublished }: PublishGauntletProps) {
  const [open, setOpen] = useState(false)
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
      {/* The resting trigger — compact, fits the Builder header's shrink-0 slot. */}
      <button
        type="button"
        data-testid="publish-trigger"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
      >
        ◆ Publish…
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Publish this workflow"
          data-testid="publish-modal"
          className="fixed inset-0 z-[9000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
          onMouseDown={(e) => {
            // Click the dimmed backdrop (not the card) to close — blocked mid-publish.
            if (e.target === e.currentTarget) requestClose()
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
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
                title={loading ? "Can’t close while the gauntlet is running" : "Close"}
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
