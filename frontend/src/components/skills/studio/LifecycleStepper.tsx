// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 01 (PANEL-01) — the shared 054-B lifecycle stepper.
//
// The ONE status-truth component consumed by BOTH the Studio header (condensed
// `strip` variant) and the slimmed detail panel (full vertical stepper). It renders
// the server `PublishGate` VERBATIM — Cases → Eval → Gate → Published — and resolves
// the literal 136-UAT "Publish ready 1/1" vs "0/2 with-skill cases passed"
// contradiction as two labeled, version-bound facts (D-03 / D-10).
//
// HONESTY LOCK (T-137-01): readiness is driven ONLY by `publishGate.met` and
// `publishGate.state`. This component NEVER recomputes the gate from
// `passed`/`measured` arithmetic — a naive `passed === measured` check would call a
// `passed_on_older_version` run (a stale full pass) "ready", but the server says
// `met=false`, so we render "not ready — stale". `passed`/`measured` are only ever
// DISPLAYED as the run's honest count, never compared to derive readiness.
//
// XSS LOCK (T-137-05): every stage label, message, and the override receipt render
// as plain React text nodes only — never raw HTML injection.
// ─────────────────────────────────────────────────────────────────────────────
import type { PublishGate } from "@/types"

type Stage = "cases" | "eval" | "gate"

interface LifecycleStepperProps {
  /** The server's publish-gate read-model — the ONLY status source. null while loading. */
  publishGate: PublishGate | null
  /** Test-case count for the Cases stage node (from listTestCases length). */
  caseCount: number
  /** The live skill version number, supplied by the consumer (never derived here). */
  skillVersion: number
  /** "full" = the vertical panel stepper; "strip" = the condensed header one-liner. */
  variant?: "full" | "strip"
  /** Optional proposal lifecycle label, composed into the current-stage read as a
   *  LABEL only — never a second truth-teller. */
  proposalState?: string | null
  /** Deep-link scroll handler; wired on the Cases / Eval / Gate nodes. */
  onNavigateStage?: (stage: Stage) => void
}

// state → which stage is "current"/blocked + whether that stage reads OK (green).
// Derived from `publishGate.state` ONLY (D-03) — never from passed/measured arithmetic.
// Stage indices: Cases=0, Eval=1, Gate=2, Published=3.
const STAGE_BY_STATE: Record<PublishGate["state"], { index: number; ok: boolean }> = {
  never_evaled: { index: 1, ok: false }, // parks on Eval — nothing measured yet
  latest_failed: { index: 2, ok: false }, // parks on Gate — the latest run failed
  passed_on_older_version: { index: 2, ok: false }, // parks on Gate — stale pass, re-run
  passed: { index: 3, ok: true }, // lights the path to Published
}

// The single condensed "state word" both variants share, so the strip and full
// surfaces can never disagree (D-10).
function stateWord(state: PublishGate["state"]): string {
  switch (state) {
    case "passed":
      return "Ready to publish"
    case "latest_failed":
      return "Latest eval failed"
    case "passed_on_older_version":
      return "Re-run needed"
    case "never_evaled":
    default:
      return "Not evaluated"
  }
}

// The current-stage narration — ported from SkillEvalSection.unmetGateLine (:118-128)
// + the met render (:543-567). ONLY the current stage speaks; other nodes stay quiet
// (052-A quiet-idle discipline). Renders server state only — no client-side gate math.
function stageMessage(
  gate: PublishGate,
  caseCount: number,
  skillVersion: number,
): string {
  const passed = gate.passed ?? 0
  const measured = gate.measured ?? 0
  switch (gate.state) {
    case "passed":
      return `Publish ready — eval passed ${passed}/${measured} on the current version (v${skillVersion}). Publishing is unlocked.`
    case "latest_failed":
      return `The gate is holding — the latest eval on v${skillVersion} passed ${passed}/${measured}. All measured cases must pass before this skill can go global.`
    case "passed_on_older_version":
      // The subtlest state: a passing eval exists, but on OLDER instructions. Name the
      // stale version vs the live version so "re-run on the current version" is instant.
      return `The passing eval is stale — it measured v${skillVersion - 1}, the live skill is v${skillVersion}. Re-run the eval on v${skillVersion} to re-open the gate.`
    case "never_evaled":
    default:
      return `Eval is the next step — ${caseCount} test case(s) are ready. Run them against v${skillVersion} to measure this skill.`
  }
}

// Tone → Aether Deep Midnight token classes (ported from sketch 054-B).
const NODE_TONE = {
  ok: "bg-emerald-500/15 border-emerald-500 text-emerald-500",
  warn: "bg-amber-500/15 border-amber-500 text-amber-500",
  dim: "bg-muted border-border text-muted-foreground",
} as const

const NAME_TONE = {
  ok: "text-emerald-500",
  warn: "text-amber-600 dark:text-amber-400",
  dim: "text-muted-foreground",
} as const

export function LifecycleStepper({
  publishGate,
  caseCount,
  skillVersion,
  variant = "full",
  proposalState,
  onNavigateStage,
}: LifecycleStepperProps) {
  // Null gate → nothing honest to show yet (never fabricate a pass).
  if (!publishGate) {
    return (
      <p className="text-xs text-muted-foreground">
        No eval has run yet — {caseCount} test case(s) ready on v{skillVersion}.
      </p>
    )
  }

  // Readiness is the server's, verbatim (D-03). `met` gates the Published stage;
  // `state` drives the stage/message mapping. Nothing is recomputed from the counts.
  const met = publishGate.met
  const stage = STAGE_BY_STATE[publishGate.state]
  const passed = publishGate.passed
  const measured = publishGate.measured

  // The Eval node's honest count — displayed verbatim, never compared.
  const evalCount =
    publishGate.state === "never_evaled" ? "not run" : `${passed ?? 0}/${measured ?? 0}`

  // The Gate node value. For passed_on_older_version we surface the passing-eval-exists
  // fact ("passed on v{N-1}") — the met-Gate LABEL — while the OVERALL gate stays
  // not-met (Published locked). Two labeled facts, never one flat contradiction.
  const gateValue =
    publishGate.state === "passed"
      ? "met"
      : publishGate.state === "passed_on_older_version"
        ? `passed on v${skillVersion - 1}`
        : publishGate.state === "latest_failed"
          ? "not met"
          : "—"

  const overrideDate = publishGate.last_override
    ? new Date(publishGate.last_override.created_at).toLocaleDateString()
    : null

  // The amber force-publish receipt — ALWAYS rendered when present, never softened
  // (D-01/D-02, owner-visible audit).
  const overrideReceipt = publishGate.last_override ? (
    <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
      <span aria-hidden="true">⚠</span>
      <span>Published without a passing eval on {overrideDate} — force-publish recorded.</span>
    </p>
  ) : null

  // ── STRIP variant: a compact one-line condensation of the SAME fields (D-10). ──
  if (variant === "strip") {
    const detail =
      publishGate.state === "passed" || publishGate.state === "latest_failed"
        ? `${passed ?? 0}/${measured ?? 0} on v${skillVersion}`
        : publishGate.state === "passed_on_older_version"
          ? `passing eval on v${skillVersion - 1} · live v${skillVersion}`
          : `${caseCount} cases ready`
    return (
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${met ? NAME_TONE.ok : NAME_TONE.warn}`}>
            {stateWord(publishGate.state)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-[11px] text-muted-foreground">{detail}</span>
          {proposalState && (
            <span className="text-[10px] text-muted-foreground/80">
              (improvement: {proposalState})
            </span>
          )}
        </p>
        {overrideReceipt}
      </div>
    )
  }

  // ── FULL variant: the vertical 4-node journey. ──
  const stages: { name: string; value: string; nav: Stage | null }[] = [
    { name: "Cases", value: `${caseCount} ready`, nav: "cases" },
    { name: "Eval", value: evalCount, nav: "eval" },
    { name: "Gate", value: gateValue, nav: "gate" },
    { name: "Published", value: met ? "unlocked" : "private", nav: null },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start">
        {stages.map((s, i) => {
          const done = i < stage.index
          const here = i === stage.index
          const tone: keyof typeof NODE_TONE = done
            ? "ok"
            : here
              ? stage.ok
                ? "ok"
                : "warn"
              : "dim"
          const glyph = done || (here && stage.ok) ? "✓" : here ? "!" : String(i + 1)
          const nav = s.nav
          const clickable = nav !== null && !!onNavigateStage
          const content = (
            <>
              {/* Connector runs edge-to-edge BETWEEN circles (13px radius + 4px gap
                  each side) — the node backgrounds are translucent, so a full-width
                  line would show through the circles. */}
              {i < stages.length - 1 && (
                <span
                  className={`absolute left-[calc(50%+17px)] top-[12px] h-0.5 w-[calc(100%-34px)] ${done ? "bg-emerald-500/45" : "bg-border"}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 text-[11px] ${NODE_TONE[tone]}`}
              >
                {glyph}
              </span>
              <span className={`mt-1.5 text-[10px] font-semibold ${NAME_TONE[tone]}`}>
                {s.name}
              </span>
              <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                {s.value}
              </span>
              {/* passed_on_older_version: an explicit green "passed" sub-label on the
                  Gate node — the met-Gate fact standing beside the amber stale status. */}
              {s.name === "Gate" && publishGate.state === "passed_on_older_version" && (
                <span className="mt-0.5 text-[9px] font-medium text-emerald-500">
                  passing eval exists
                </span>
              )}
            </>
          )
          const baseCls = "relative flex flex-1 flex-col items-center text-center"
          return clickable ? (
            <button
              key={s.name}
              type="button"
              className={`${baseCls} cursor-pointer bg-transparent`}
              onClick={() => onNavigateStage(nav)}
              aria-label={`Go to ${s.name}`}
            >
              {content}
            </button>
          ) : (
            <div key={s.name} className={baseCls}>
              {content}
            </div>
          )
        })}
      </div>

      {/* Only the CURRENT stage narrates itself (052-A quiet-idle). */}
      <div
        className={`rounded-md px-3 py-2 text-xs leading-relaxed ${
          stage.ok
            ? "bg-emerald-500/10 text-muted-foreground"
            : "bg-amber-500/10 text-muted-foreground"
        }`}
      >
        {stageMessage(publishGate, caseCount, skillVersion)}
        {proposalState && (
          <span className="mt-1 block text-[11px] text-muted-foreground/80">
            Improvement: {proposalState}
          </span>
        )}
      </div>

      {overrideReceipt}
    </div>
  )
}
