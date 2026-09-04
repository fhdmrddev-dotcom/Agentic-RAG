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
import { PublishBlockedStepCard } from "@/components/workflows/PublishBlockedStepCard"
// The SAME predicate the card uses to decide whether it renders — imported, never re-spelled,
// so the anchor and the card can never disagree about whether a cause block exists.
import { blockedStepOf } from "@/components/workflows/publishBlockedStep"
import type { DefShape } from "@/components/workflows/soulData"
// Phase 186-05 (CONCUR-02, D-186-11) — the worded refusal. The map + its total resolver
// live in the pure verdict module, next to the other sentences a surface says about a
// check; see that module's docblock for why a component file cannot own them.
import { blockedSentence } from "@/components/workflows/verdictModel"
// Phase 214-10 (STEP-03, sketch 215) — the ARGUMENT-GAP refusal, and the ONE thing this
// file gains from it: an import and a mounted child. Every one of the five sentences, the
// count line, the two next actions and D-214-12's not-retroactive note live in the leaf and
// in `publishRefusalVocabulary.ts` — deliberately breaking this file's growth pattern, which
// has been to render each new refusal shape inline (see the hot-file ledger row).
//
// ⚠ `isArgumentRefusal` is the KEY-DETECTION predicate for those five codes, and it is used
// here for one purpose only: to keep the generic renderer below from printing the SAME
// failure a second time as a raw diagnostic. Rule 4 is preserved — the detection is per
// ENTRY, and everything the predicate declines still renders exactly as it shipped. It is a
// separate pure module from the component because `react-refresh/only-export-components` is
// an ACTIVE error here (measured at 214-10; same finding as `argumentVocabulary.ts`'s).
import { PublishRefusalList } from "@/components/workflows/PublishRefusalList"
import { isArgumentRefusal } from "@/components/workflows/publishRefusalEntry"
// Sketch 215 #11 — what the golden run says on a passing row. The reader's actual question
// at this moment is *did it just email my customer?* — and #8's three stage words, which
// put the spine's state in LANGUAGE rather than only in colour.
import {
  GOLDEN_NO_SEND,
  STAGE_BLOCKED,
  STAGE_NOT_REACHED,
  STAGE_PASSED,
} from "@/components/workflows/publishRefusalVocabulary"
// Phase 127-02 Task 1 (WUX-03, sketch 051-A) — the engized gauntlet re-skin.
// The engine chip mirrors RunCard's providerLogo()→Bot fallback (icon-convention
// §1); the stage glyphs are the bundled 3D fluent-emoji set (icon-convention §3) —
// one per STAGES row, so the count follows the table rather than a numeral here.
import { Bot } from "lucide-react"
import { providerLogo } from "@/lib/providerLogo"
// The gauntlet-node 3D glyphs, bundled at build time by unplugin-icons — one per row of
// the STAGES table below, in the same order and the same count. Only API-verified-present
// fluent-emoji slugs are used (icon-convention §3 / RESEARCH §Pitfall 2). The empty-render
// traps (`direct-hit` / `no-entry-sign`) are NEVER referenced — and because an unverified
// slug renders as an EMPTY svg rather than failing to build, the newest addition here is
// pinned by a render assertion in the suite, not by this comment.
import Shield from "~icons/fluent-emoji/shield"
import Books from "~icons/fluent-emoji/books"
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
   * Phase 186-07 (D-186-12) — a BOOLEAN report of whether the gauntlet is running.
   *
   * The Builder holds its autosave writes while a publish is in flight: a stray keystroke
   * mid-gauntlet costs minutes of golden run and real provider spend, and the stage-5
   * token guard would then honestly refuse the publish. Edits accumulate as dirty and
   * flush when this goes false.
   *
   * OPTIONAL AND ADDITIVE, in the `blockedReason` shape: absent ⇒ today's behaviour, byte
   * for byte. This component already owns the `loading` flag (it blocks the close
   * affordances with it); this prop only lets a parent observe the flag it already keeps,
   * and adds no state, no request and no rendered element.
   */
  onRunningChange?: (running: boolean) => void
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
   *
   * ── PHASE 186-16 (WR-10): IT NOW GATES THE INNER PUBLISH TOO, NOT ONLY THE TRIGGER ──
   * The modal can sit open for as long as the author takes to write a golden input, so
   * the click that actually spends money is the INNER one — and it used to be checked
   * against nothing but the input and `loading`. The finding that made that expensive:
   * the Builder's hold stops NEW writes once a publish is running (D-186-12) but cannot
   * recall one already outstanding, so an autosave PATCH committing after
   * `publish_service.py` reads `stage0_token` makes that token dead on arrival — the
   * stage-5 flip answers `draft_changed` only AFTER a real golden run has burned minutes
   * and provider spend on a publish that could never have succeeded.
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
 * Every row but the last is a CHECK. The last row is the publish COMMIT — the flip
 * itself, which sketch 020-B D2 has always carried as its own row and which the spine
 * had no node for until Phase 186-05. It sits last on purpose: a refusal there happened
 * AFTER the grader passed, so folding its code into the Judge row would tell an author
 * the grader stopped them, which is false.
 *
 * ── PHASE 186-10 (WR-02): THE MIRROR CLAIM IS NOW CHECKED, NOT ASSERTED ──
 * The paragraph above used to argue that the table was safe to extend only by APPENDING,
 * because the running highlight below pointed at the golden-run row by a literal index.
 * That is no longer the reason it is safe, and leaving it written would send the next
 * reader to the wrong invariant: the highlight now LOCATES its row by the stage it
 * belongs to (see `RUNNING_STAGE_INDEX`), so a row may be inserted at its true pipeline
 * position without moving the pulse. `Grounding` is the first row that needed that — it
 * runs BEFORE the golden run in `publish_service.py`, so appending it would have drawn
 * the pipeline in the wrong order to spare the code.
 *
 * And the first sentence of this docblock — that the table mirrors the server's stage
 * list — was prose for three phases and was FALSE for two of them: `grounding_fidelity`
 * has been emitted since Phase 182 with no row here, so the most likely real refusal on a
 * KB-bound workflow painted a spine that could place nothing. It is now pinned by F18 in
 * the co-located suite, which reads the `stage="…"` literals out of `publish_service.py`
 * itself and drives one render per stage. A stage added to the service and forgotten here
 * fails that test; it can no longer be a comment that quietly stops being true.
 */
const STAGES: { label: string; what: string; codes: string[]; Icon: StageIcon }[] = [
  { label: "Owner", what: "Owner check — RLS-resolve + you own it", codes: ["not_found"], Icon: Shield },
  { label: "Valid", what: "Definition valid — re-validates as a WorkflowDefinition", codes: ["definition_invalid"], Icon: CheckMarkButton },
  { label: "Goal", what: "business_requirement — exactly one must be declared", codes: ["business_requirement"], Icon: Bullseye },
  { label: "Structure", what: "Structural lint — reachable · terminal · inputs satisfied · no orphans", codes: ["lint"], Icon: MagnifyingGlassTiltedLeft },
  { label: "Pause", what: "Interactive-phase check — human-pause phases can't validate synchronously", codes: ["interactive_phase"], Icon: RaisedHand },
  { label: "Grounding", what: "Grounding check — the folders, tools and skills this workflow points at must all resolve", codes: ["grounding_fidelity"], Icon: Books },
  { label: "Golden run", what: "Golden run — a REAL harness run against the project KB", codes: ["golden_run_timeout", "golden_run_error"], Icon: Rocket },
  { label: "Citations", what: "Structural gate — citations / integrity checked during the run", codes: ["structural_gate"], Icon: Locked },
  { label: "Judge", what: "Independent judge — an independent model grades the deliverable", codes: ["judge"], Icon: BalanceScale },
  { label: "Commit", what: "Publish commit — the draft must not have changed while we were checking it", codes: ["draft_changed"], Icon: ChequeredFlag },
]

/**
 * Which row pulses while a publish is in flight — LOCATED BY THE STAGE IT BELONGS TO, never
 * by a literal index (Phase 186-10 / WR-02).
 *
 * The golden run is the only stage the author actually waits on: everything before it is a
 * cheap static check that resolves in milliseconds, and everything after it grades a run that
 * has already finished. So the amber aura and the energy comet both belong to this row.
 *
 * It used to be a bare index literal, compared against the loop counter in two separate
 * places (the node tone and the energy comet). That number was a fact about the table's
 * SHAPE, not about the golden run, so inserting `Grounding` at its true pipeline position
 * would have moved the pulse silently onto the wrong node — the surface claiming a different
 * stage is running than the one that is. Derived here, a row may be inserted anywhere and the
 * pulse follows the run.
 */
const RUNNING_STAGE_INDEX = STAGES.findIndex((s) => s.codes.includes("golden_run_timeout"))

/**
 * The codes the GOLDEN RUN row itself can refuse with — read off the table's own row rather
 * than written down a second time (Phase 214-10, sketch 215 #11).
 *
 * ⚠ `golden_run_id != null` alone is NOT "the golden run passed": a run that timed out or
 * errored can still have produced a row, and telling that author *"nothing was sent"* would
 * be a claim about a run that did not finish its own check. The reassurance is gated on the
 * row PASSING, and the gate follows the table wherever the row moves.
 */
const GOLDEN_RUN_CODES: readonly string[] = STAGES[RUNNING_STAGE_INDEX]?.codes ?? []

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
      {/* ⚠ BUG-260815-06 §5 REACHES THIS SENTENCE TOO. `HardWall` renders on EVERY block,
          not only the grader's, and it read *"fix the DELIVERABLE and re-publish"* — which
          on a `structural_gate` refusal names an artefact that was never produced. It now
          says "the cause", which is true on every arm; the headline above it is what names
          which cause. The no-override strip below is untouched, byte for byte. */}
      <span className="text-muted-foreground">
        The only path forward is to fix the cause and publish again — each attempt is a brand-new trial run and a fresh
        independent review.
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
 * green with a ✓ badge, the running golden-run node (`RUNNING_STAGE_INDEX`, located by its
 * stage rather than by a literal index since Phase 186-10) pulses an amber aura with
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
 *
 * ── PHASE 199-03 (DES-01, sheet 178 `c7-gauntlet-soul`): ONE COMPACT STRIP, MEASURED ──
 * The sheet's whole gauntlet claim is that it reads as ONE compact strip. Ours already WAS
 * one strip — the shape was right — but it did not FIT: ten 64px columns plus nine 16/24px
 * connectors measure 856px against a modal body of 640px (`max-w-2xl` 672 − `px-4` twice),
 * so the strip that is supposed to show every check at a glance ended in a horizontal
 * scrollbar with the Judge and Commit nodes off-screen. A strip you have to scroll to
 * finish reading is not a glance.
 *
 * This is pure subtraction — the column, the node box, the icon and the connectors each
 * shrink; NOTHING is removed from the strip and no stage is folded away. 10 × 48 + 9 × 16
 * = 624 ≤ 640, and that arithmetic is CHECKED rather than asserted: the suite reads the
 * widths back off the rendered `data-testid="spine-stage"` / `"spine-conn"` class strings
 * and does the sum, so the next person who nudges a width finds out from a test instead of
 * from a scrollbar. `overflow-x-auto` stays as the safety valve for narrow viewports.
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
    <div data-testid="gauntlet-spine" className="flex items-start justify-between overflow-x-auto py-4">
      {STAGES.map((stage, i) => {
        const isBlocked = blockedIndex === i
        // Unplaceable block first, placed block second, no block last. Only in that order
        // is the fail-closed case unreachable by falling through anything — and the tail
        // is honest precisely BECAUSE the guard ran first: a missing index that is not an
        // unknown block can only be "nothing blocked", which still waits for the run.
        const isPassed = unknownBlock ? false : blockedIndex >= 0 ? i < blockedIndex : !running
        const isRunning = running && i === RUNNING_STAGE_INDEX
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
        // ── PHASE 214-10 (SKETCH 215 #8): THE SPINE'S STATE, IN WORDS ────────────────
        //
        // The strip has carried its state in COLOUR and a ✓ badge alone since 127-02, so a
        // reader who cannot separate the greens from the reds — or who is being read this
        // page aloud — gets no state at all, and no test could assert one either.
        //
        // ⚠ IT IS EMITTED ONLY WHEN A BLOCK WAS PLACED, AND THAT RESTRAINT IS THE POINT.
        // At rest `blockedIndex` is -1 and `isPassed` is `!running`, i.e. TRUE for every
        // node — the ladder is drawn hopefully before anything has run. Writing *"Checked"*
        // into the DOM there would turn a visual convention into an explicit claim that ten
        // checks passed when none of them has been attempted. The fail-closed unknown-block
        // case (`unknownBlock`) is likewise -1 and likewise says nothing: we could not place
        // the refusal, so we do not name any node's state.
        const stageState =
          blockedIndex >= 0
            ? isBlocked
              ? STAGE_BLOCKED
              : isPassed
                ? STAGE_PASSED
                : STAGE_NOT_REACHED
            : undefined
        return (
          <div
            key={stage.label}
            className="flex items-start"
            title={stageState ? `${stage.what} — ${stageState}` : stage.what}
          >
            {/* ── PORTED FROM SKETCH 200 `publish.html` (2026-08-20) ────────────────────
                The sheet draws the strip as round 32px beads on ONE hairline rule, each with
                a small ✓ tucked at its lower-right, under an uppercase wide-tracked caption.
                Ours drew 36px rounded-XL boxes joined by 3px pills — the same information,
                in a heavier hand.

                ⚠ THE SEGMENTED CONNECTOR IS KEPT, THOUGH THE SHEET DRAWS ONE CONTINUOUS
                LINE. The sheet's rule is a single absolutely-positioned element because it
                has no state to carry; ours carries the reached/not-reached fact PER SEGMENT,
                which is the second, independent read of the block index the F7 repair exists
                to keep honest. Collapsing nine stateful segments into one decorative rule
                would delete a fact to match a drawing. They are drawn AS the sheet's rule —
                one hairline — and keep their meaning.

                ⚠ AND THE SHEET'S GLYPHS ARE NOT ADOPTED. It names nine Material Symbols
                (`person`, `fact_check`, `flag`, `account_tree`, `pause`, `anchor`,
                `emoji_events`, `format_quote`, `gavel`); this product's stage glyphs are the
                bundled 3D fluent-emoji set fixed by `icon-convention.md` §3, and a second
                icon family on one surface is exactly the drift that convention forbids. The
                sheet also draws NINE stages; the server runs TEN (`Commit` is real and
                refuses on a moved draft), and dropping it to match a drawing would hide a
                refusal an author can actually hit. */}
            {i > 0 && (
              <div
                data-testid="spine-conn"
                className={`relative mt-[16px] h-px w-[12px] shrink-0 sm:w-[16px] ${connReached ? "bg-success/60" : "bg-border"}`}
              >
                {/* The energy comet flows along the connector INTO the running golden-run node. */}
                {running && i === RUNNING_STAGE_INDEX && <span className="gauntlet-comet" aria-hidden />}
              </div>
            )}
            <div
              data-testid="spine-stage"
              data-stage-state={stageState}
              className="flex w-[48px] shrink-0 flex-col items-center gap-2"
            >
              <div
                data-testid="spine-node"
                className={`relative grid h-8 w-8 place-items-center rounded-full border-2 ${nodeTone} ${
                  isRunning ? "gauntlet-node-run" : ""
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {isPassed && (
                  <span
                    className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-success text-[8px] font-bold leading-none text-white"
                    aria-hidden
                  >
                    ✓
                  </span>
                )}
              </div>
              <div
                className={`text-center font-mono text-[9px] uppercase leading-tight tracking-wider ${labelTone}`}
              >
                {stage.label}
              </div>
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
  blocked,
  blockedReason,
  onCancel,
}: {
  definitionId: string
  definition?: DefShape | null
  onPublished?: (version: number) => void
  loading: boolean
  setLoading: (v: boolean) => void
  goldenInputRef: React.RefObject<HTMLTextAreaElement | null>
  /** Phase 186-16 (WR-10) — the wrapper's DERIVED emptiness test, handed down rather
   *  than recomputed. One home for "is this string a reason", so the trigger and the
   *  inner Publish can never disagree about whether one was supplied. */
  blocked: boolean
  blockedReason?: string | null
  /** The wrapper's `requestClose` — the SAME one the ✕ and the backdrop route through, so
   *  the sheet's footer Cancel inherits the "never close mid-publish" guard rather than
   *  becoming a second, unguarded exit. */
  onCancel: () => void
}) {
  const [goldenInput, setGoldenInput] = useState("")
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  // Its OWN id, in the shape the trigger's already uses. A second element is needed
  // rather than a reference to the trigger's because the trigger's reason sits behind
  // the modal backdrop and cannot be read from inside the dialog — and a disabled button
  // whose explanation is unreachable IS the greyed-in-silence failure R12 names.
  const innerBlockedReasonId = useId()

  // Phase 186-16 (WR-10): `!blocked` is the third term. `runGauntlet` already returns
  // immediately when `!canPublish`, so the request cannot leave while a reason stands and
  // no early return had to be added anywhere else.
  const canPublish = goldenInput.trim().length > 0 && !loading && !blocked

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

  // ── PHASE 214-10 (STEP-03, sketch 215) — THE CAUSE, AND WHAT THE RUN DID NOT DO ───────
  //
  // The entries the argument-gap refusal claims. Derived ONCE and used twice — the cause
  // block renders them, the generic list below skips them — so the two can never disagree
  // about which entries were already said in plain words.
  const argumentRefusals = verdict ? verdict.named_failures.filter(isArgumentRefusal) : []
  // Everything else, VERBATIM and in order, through the shipped KEY-DETECTION renderer.
  const genericFailures = verdict ? verdict.named_failures.filter((e) => !isArgumentRefusal(e)) : []
  // Sketch 215 #11: the golden run ran AND was not the row that stopped. See
  // `GOLDEN_RUN_CODES` for why the run id alone is not enough to make this claim.
  const goldenRunPassed =
    verdict != null &&
    verdict.golden_run_id != null &&
    !(verdict.blocked_stage != null && GOLDEN_RUN_CODES.includes(verdict.blocked_stage))

  // ── BUG-260828-09 — RENDERING THE ANSWER IS NOT SHOWING IT ───────────────────────────
  //
  // ⚠ MEASURED IN A REAL BROWSER, ON A REAL FAILED PUBLISH (2026-08-28), and NOT catchable
  // from inside jsdom — which is why it survived a green suite. On arrival the modal body
  // sat at `scrollTop 713` of `scrollHeight 1254`: the cause card was at `top: -399`, the
  // verdict headline at `-69`, and the two things actually ON SCREEN were the **raw-verdict
  // disclosure** and the no-send note.
  //
  // THE CAUSE IS FOCUS, NOT LAYOUT. The publish FORM unmounts when the verdict arrives, so
  // the browser hands focus to the first focusable element in the replacement content — the
  // `<summary>` of *"Show raw verdict — the 5 server fields, verbatim"* — and scrolls it into
  // view. `document.activeElement` on that real run was exactly that summary. So the surface
  // was AIMING THE READER'S EYE AT THE MACHINE FIELDS and leaving the plain sentence four
  // hundred pixels above the fold. That is the operator's complaint restated as a DOM fact:
  // *"a lot of information are displayed and none of them are useful."*
  //
  // ⚠ SCROLLING TO THE TOP IS THE WRONG FIX, and it is wrong on the arm that has no card. A
  // judge block names no step, so its answer IS the verdict headline BELOW the spine —
  // scrolling to the top would replace one hidden answer with another. The anchor is
  // therefore the LEADING ANSWER that actually rendered: the cause card when there is one,
  // else the headline. Both carry `tabIndex={-1}` so focus is programmatic only and no new
  // tab stop is added for keyboard users.
  const causeAnchorRef = useRef<HTMLDivElement>(null)
  const headlineAnchorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (outcome == null) return
    const anchor = causeAnchorRef.current ?? headlineAnchorRef.current
    if (!anchor) return
    // `preventScroll` then an explicit `scrollIntoView`: focusing alone scrolls the element to
    // wherever the browser likes, and we want its TOP against the top of the scroll port.
    anchor.focus({ preventScroll: true })
    // ⚠ THE GUARD IS NOT DEFENSIVE PADDING — jsdom DOES NOT IMPLEMENT `scrollIntoView` AT ALL.
    // Unguarded, this threw `TypeError: anchor.scrollIntoView is not a function` and took 44 of
    // `PublishGauntlet.test.tsx`'s cases down with it, measured here rather than reasoned about.
    // The irony is the finding: the SAME jsdom limitation that made this defect invisible for a
    // phase — no layout, no scrolling, no viewport — is what makes its fix unrunnable there. So
    // the guard is required, and it also means NO TEST IN THIS REPO COVERS THE LINE BELOW. It
    // was verified the only way it can be: driven in a real browser on a real failed publish.
    if (typeof anchor.scrollIntoView === "function") anchor.scrollIntoView({ block: "start" })
  }, [outcome])

  return (
    <div className="w-full">
      {/* Phase 124-03 Task 2 (WUX-01, D-06, sketch 046-A ③): the PREPENDED pub-scale
          soul block — purpose · needs · glyph-dot spine · tier chip · output — ABOVE
          the resting publish form. When `definition` is absent the soul renders its
          honest draft empty-states. */}
      {/* ⚠ THE CARD AROUND THE SOUL IS GONE (sketch 200 `publish.html`). The sheet puts the
          hero, the quiet line and the compact bar directly on the modal surface — a card
          inside a card is a second frame around content that is already framed, and it cost
          32px of the 640px body on a surface whose whole claim is "every check at a glance".
          The `publish-soul` node itself STAYS (the resting-inventory pin reads it), and the
          soul's own five atoms are untouched — only this wrapper's paint changed. */}
      <div data-testid="publish-soul" className="mb-2">
        <WorkflowSoul def={definition} scale="pub" />
      </div>

      {/* ── PHASE 214-10 (STEP-03, sketch 215 #7): THE CAUSE SITS ABOVE THE SPINE ────────
          A person reads WHAT IS WRONG before they read WHERE IT STOPPED. The spine is a map
          of the checks; it is not an answer, and putting it first makes an author decode a
          stage name to reach a sentence they could have read directly — which is
          `BUG-260815-06` in one line of JSX.

          It renders NOTHING when no entry is one of the five, so every other stage's block
          is byte-for-byte the surface that shipped. `totalSteps` is passed only when the
          caller actually holds the definition; absent, the *"the other N are ready"* line is
          not rendered rather than guessed. */}
      {argumentRefusals.length > 0 && (
        <PublishRefusalList
          entries={verdict?.named_failures ?? []}
          totalSteps={definition?.phases?.length ?? null}
        />
      )}

      {/* ── BUG-260828-09 — THE SAME SLOT, THE OTHER PRODUCER ───────────────────────────
          The block directly above claims the argument-gap entries out of `named_failures`;
          this one claims the step-level failure of the golden RUN. They cannot both render:
          an argument gap blocks a run before it starts, and this fact only exists for a run
          that started and then stopped. Same frame and same slot on purpose — two cause
          blocks that looked like two features would say the surface has two kinds of refusal
          in it, when it has one kind with two producers.

          It renders NOTHING when the verdict carries no phrasable step cause, so every stage
          the golden run did not reach is byte-for-byte the surface that shipped. `definition`
          is passed so the face resolves through `nodeTitle`'s ladder; absent, the card still
          renders and falls back to the server's name and then to the step's ordinal — never
          to the slug. */}
      {/* The anchor wraps rather than replaces the card, so `PublishBlockedStepCard` keeps
          rendering `null` on every stage that names no step — and the ref is then also null,
          which is exactly what makes the effect above fall through to the headline. */}
      {blockedStepOf(verdict?.blocked_step) != null && (
        <div ref={causeAnchorRef} tabIndex={-1} className="scroll-mt-2 outline-none">
          <PublishBlockedStepCard step={verdict?.blocked_step} definition={definition} />
        </div>
      )}

      {/* THE SPINE IS CONTEXT, AND IT SITS BELOW THE ANSWER — the same reason the refusal
          list above does. A person reads WHAT IS WRONG before they read WHERE IT STOPPED;
          putting a ten-row map of the checks first makes an author decode a stage name to
          reach a sentence they could have read directly, which is `BUG-260828-09` in one
          line of JSX. */}

      {/* D0 — 8-stage energy-spine: ABOVE the form (sketch 051-A). The spine is the
          centrepiece of the gauntlet — always visible once the modal opens so the user
          can see the 8 checks at a glance before and after clicking Publish. */}
      <GauntletSpine blockedStage={verdict?.blocked_stage ?? null} running={loading} />

      {/* D1 — the resting publish form: hidden once a verdict arrives (the HardWall's
          "Fix & re-publish" clears the verdict and re-shows the form). For 404/409
          (no verdict body) the form stays visible so the user can still try again. */}
      {!verdict && (
        <div className="mt-2 rounded-lg border border-border bg-card p-4">
          {/* Phase 199-03 (DES-01, sheet 178 c7): the section heading that used to sit here
              said "◆ Publish this workflow" — the SAME four words the dialog's own title bar
              says about two lines above it. "Text is noise — cut it, but the purpose must
              survive the cut": the purpose is untouched, because the title bar still carries
              it, and the paragraph below (what publishing COSTS, and that it can honestly
              block) is the part that actually carries information and is deliberately kept.
              The suite proves the subtraction by INVERTING its resting-inventory count from
              two occurrences to one, never by deleting the assertion. */}
          {/* ── THE SHEET'S EXPLANATION SENTENCE, WORD FOR WORD (sketch 200) ────────────
              *"Publishing runs the full check above, including a real trial run of this
              workflow against your knowledge base and an independent review of the result.
              It can honestly refuse."*

              Three machine words leave with it — `gauntlet`, `golden run`, `judge` — and the
              claim underneath is IDENTICAL: publishing costs a real run and a real review,
              and it can say no. That is the purpose this paragraph has to keep, and it keeps
              it. The mechanism's own names survive where they belong: `blocked_stage` and
              `golden_run_id` still render verbatim inside the raw-verdict disclosure. */}
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Publishing runs the <b>full check above</b>, including a <b>real trial run</b> of this workflow against your
            knowledge base and an <b>independent review</b> of the result. It can honestly refuse.
          </p>
          {/* The sheet labels the field *"A typical instruction to test with"* — a sentence,
              not a wire key. ⚠ THE WIRE KEY IS NOT DROPPED, IT IS DEMOTED: `golden_input` is
              the name of the field on `POST /workflows/{id}/publish` and an author reading
              backend logs or a support thread needs to be able to connect the two, so it
              rides along as a quiet mono token carrying the full sentence in its `title`.
              It also keeps the field reachable by `getByLabelText(/golden_input/i)`, which
              two suites outside this file needle. */}
          <label
            htmlFor="golden_input"
            className="mt-4 mb-1.5 flex flex-wrap items-baseline gap-2 text-[13px] font-medium text-foreground"
          >
            A typical instruction to test with
            <span
              data-testid="golden-input-wire-name"
              title="Sent to the server as golden_input — the instruction the review is run against."
              className="cursor-help font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
            >
              golden_input
            </span>
          </label>
          <textarea
            id="golden_input"
            ref={goldenInputRef}
            value={goldenInput}
            onChange={(e) => setGoldenInput(e.target.value)}
            placeholder="Choose something typical, not a corner case — this is what gets graded."
            className="min-h-[88px] w-full resize-y rounded border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground focus:border-primary focus:outline-none"
          />
          {/* ── THE SHEET'S FOOTER BAR ──────────────────────────────────────────────────
              The sheet closes the dialog with a raised, full-bleed row carrying Cancel and
              the primary, and nothing else. Ours had a bare right-aligned button floating at
              the bottom of the form card and no Cancel at all — the only ways out were the
              header ✕, the backdrop and Escape. `-mx-4 -mb-4` bleeds it to the card's edges
              so it reads as a footer rather than as one more row of the form.

              ⚠ CANCEL IS BLOCKED MID-PUBLISH, like every other close affordance: it routes
              through the SAME `requestClose` the ✕ and the backdrop use, which no-ops while
              the request is in flight. A second, unguarded exit would orphan the run. */}
          <div className="-mx-4 -mb-4 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/30 px-4 py-3">
            {/* R12, applied to the one control that did not have it: greying alone is
                never enough. `mr-auto` puts the sentence at the row's left WITHOUT
                changing the row's own classes, so with no reason supplied the rendered
                markup is the one that shipped, character for character. */}
            {blocked && (
              <span
                id={innerBlockedReasonId}
                data-testid="publish-inner-blocked-reason"
                className="mr-auto text-[12px] leading-snug text-muted-foreground"
              >
                {blockedReason}
              </span>
            )}
            <button
              type="button"
              data-testid="publish-cancel"
              onClick={onCancel}
              disabled={loading}
              className="h-9 rounded border border-border px-4 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canPublish}
              aria-describedby={blocked ? innerBlockedReasonId : undefined}
              onClick={runGauntlet}
              className="h-9 rounded bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? "Publishing…" : "Publish — run the checks"}
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
                {/* The FALLBACK anchor (BUG-260828-09). Used only when no cause card
                    rendered — a judge block, a lint block, a stage that names no step —
                    because on those arms this headline IS the leading answer. */}
                <div ref={headlineAnchorRef} tabIndex={-1} className="min-w-0 flex-1 scroll-mt-2 outline-none">
                  <div
                    data-testid="verdict-headline"
                    className={`text-[17px] font-bold leading-snug ${isSuccess ? "text-success" : "text-destructive"}`}
                  >
                    {wordedHeadline}
                  </div>
                  {/* ── BUG-260815-06 §5: THREE ARMS, NOT TWO (2026-08-20) ──────────────
                      The `else` arm read *"The gauntlet honestly blocked this publish. Fix
                      the cause and re-publish."* — and on `structural_gate` that is
                      misdirecting rather than merely vague. `structural_gate` covers a run
                      that NEVER REACHED the review, so "fix the cause and re-publish" beside
                      a headline about a deliverable sends an author to inspect an output
                      that was never produced. The operator hit it three times in one sitting
                      and could not diagnose any of them.

                      ⚠ THE NEW ARM NAMES NO STEP, ON PURPOSE. The precise cause is stored
                      verbatim in `harness_audit` against the `golden_run_id` this response
                      already carries, and nothing joins them on the wire yet — that half of
                      the report is a server change. Claiming a step here would be inventing
                      one. What it can honestly say is WHICH SIDE stopped, and that is the
                      part that redirects the author.

                      ⚠ BUG-260828-09 SHIPPED THAT SERVER CHANGE, AND THIS ARM STILL NAMES NO
                      STEP — deliberately. `PublishBlockedStepCard` above names it when
                      `blocked_step` is present; this is the arm that has to be right when it
                      is ABSENT (a pre-fix server; a `structural_gate` raised by the argument
                      re-projection, which fails no phase and so names none). A headline that
                      claimed a step would have to invent one on exactly those paths. The
                      paragraph above is preserved rather than rewritten because its
                      prediction — that this was a server change — was correct. */}
                  {isBlock && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {verdict.blocked_stage === "judge"
                        ? 'The trial run finished — but the independent review would not pass its result. This is a hard wall — there is no "publish anyway."'
                        : verdict.blocked_stage === "structural_gate"
                          ? "The trial run stopped part-way: one of the steps did not satisfy its own checks, so nothing was produced for the review to look at. Your deliverable was not graded — the run did not get that far."
                          : "Publishing honestly refused. Fix the cause named below and try again."}
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

              {/* named_failures rendered by KEY-DETECTION (any string/unknown → block).
                  ⚠ PHASE 214-10 SUBTRACTS EXACTLY ONE THING HERE AND NOTHING ELSE: the
                  entries the cause block above already said IN PLAIN WORDS are not repeated
                  as raw diagnostics. Printing the server's own sentence underneath the
                  author-facing one is how a surface ends up saying the same failure twice,
                  once honestly and once in machine words. Every OTHER shape — bare string,
                  judge criterion, summary, interactive phase, structural lint, an unknown
                  code — is untouched and still renders here, which is rule 4 preserved
                  rather than narrowed. */}
              {genericFailures.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    named_failures — what blocked publish
                  </div>
                  {genericFailures.map((entry, i) => renderFailure(entry, i))}
                </div>
              )}

              {/* ⚠ SKETCH 215 #11 — WHAT THE RUN DID NOT DO, SAID IN THE SAME BREATH AS THE
                  RESULT. The reader's actual question the moment a golden run is named is
                  *did it just email my customer?* Leaving it to be inferred from "trial run"
                  is leaving the most alarming reading available. */}
              {goldenRunPassed && (
                <div
                  data-testid="golden-no-send"
                  className="mt-4 rounded border border-border bg-card px-3 py-2 text-[12px] leading-relaxed text-muted-foreground"
                >
                  {GOLDEN_NO_SEND}
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
  onRunningChange,
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

  /**
   * Phase 186-07 (D-186-12) — report the in-flight flag this component already keeps, and
   * report `false` on unmount so a Builder cannot be left holding its writes forever
   * because the gauntlet was closed while a request was outstanding. No-ops entirely when
   * no parent asked, which is every call site outside the Builder.
   */
  useEffect(() => {
    if (!onRunningChange) return
    onRunningChange(loading)
    return () => onRunningChange(false)
  }, [loading, onRunningChange])

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
          /*
           * ⚠ `block` + a bounded `max-w`, NOT `ml-2` inline. MEASURED IN A REAL BROWSER
           * 2026-08-28: as an inline span beside the button this reason rendered 722px wide
           * starting at x=901, so its right edge landed at 1623 against a 1536 viewport — it
           * ran 87px OFF THE SCREEN and the operator could read only
           * `…but this workflow is not bo`. The cause is one level up:
           * `BuilderHeaderBar.tsx`'s `ml-auto flex shrink-0` row REFUSES to shrink, so an
           * inline child of any length pushes past the edge instead of wrapping.
           *
           * ⚠ NO TEST COULD HAVE CAUGHT THIS. This file's own suite asserts the span EXISTS
           * in the code; jsdom lays nothing out, so `getBoundingClientRect` is all zeroes and
           * an overflow is invisible to it. The guard is the bounded width here, not a case.
           */
          className="mt-1 block max-w-[44ch] text-[12px] leading-snug text-muted-foreground"
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
                blocked={blocked}
                blockedReason={blockedReason}
                onCancel={requestClose}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
