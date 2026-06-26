/**
 * Phase 124-02 Task 2 (WUX-02, sketch 047-A variant A / D-01 / D-05) —
 * WorkflowDoorSwitch: the explicit-fork "two doors" shell at the Studio authoring
 * ENTRY.
 *
 * The shell holds ONE piece of local door state (`"both" | "describe" | "govern"`,
 * default `"both"`) and forks the authoring entry into two doors:
 *   - "Describe & run" (LOOSE, fastest path): the describe-box lineage descended
 *     from WorkflowBuilderPage's empty screen (a textarea labelled for the business
 *     requirement + a draft CTA + an honest hint) PLUS a <WorkflowSoul scale="card">
 *     soul PREVIEW of the current draft/definition PLUS a visible
 *     "switch to Author & govern ›" strip (D-05 — nothing lost by picking fast).
 *   - "Author & govern" (STRICT, full control): mounts the EXISTING
 *     `WorkflowBuilderPage` (drafted/govern view) whose form panel already owns the
 *     citation-policy picker / gate chips / folder-scope / model with LIVE tier
 *     recompute and a LOCKED-always-on judge (`llm_judge_rubric`). The advanced
 *     controls are DELEGATED, never re-implemented here (D-05).
 *
 * A persistent "‹ both doors" control returns from either open door to the "both"
 * chooser (D-05).
 *
 * RED LINES this shell holds:
 *  - D-01: the library-card Run path (doRun → createThread → postMessage →
 *    create_workflow_run) is NOT wrapped by this fork — it lives elsewhere
 *    (WorkflowsPage RunModal / ChatLayout.doRun) and is never routed through here.
 *  - The shell adds NO API call and NO tier re-derivation of its own. Governance is
 *    delegated to the Builder; the tier display is delegated to WorkflowSoul. A
 *    STRICT workflow can never be silently downgraded by this shell (T-124-07).
 *  - XSS (T-124-05): the describe text + the soul-preview strings render as plain
 *    React text children (auto-escaped). NEVER `dangerouslySetInnerHTML`.
 */
import { useState } from "react"
import { WorkflowBuilderPage, type BuilderInitial } from "@/pages/WorkflowBuilderPage"
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
import { type DefShape } from "@/components/workflows/soulData"

type DoorState = "both" | "describe" | "govern"

export interface WorkflowDoorSwitchProps {
  /** The current draft/definition for the soul preview (undefined for a true fresh
   *  build with nothing described yet). Loose read-shape — display only. */
  def?: DefShape | null
  /** The existing definition + row id for "Author & govern a draft" (Open/Tweak);
   *  absent for a fresh build. Passed straight through to the Builder's `initial`. */
  initial?: BuilderInitial
  /** The Builder's publish-gauntlet render seam — passed straight through to the
   *  govern door's `WorkflowBuilderPage` (the shell never owns the gauntlet). */
  renderPublish?: (
    def: import("@/pages/WorkflowBuilderPage").BuilderDefinition,
    draftId: string | null,
  ) => React.ReactNode
  /** The describe-CTA handler — the loose door forwards the describe text to the
   *  EXISTING draft/generate path (the shell adds no new sink; D-01/T-124-08). */
  onDescribeDraft?: (describe: string) => void
  /** Which door to open initially (default "both"). Open/Tweak land in "govern"
   *  (the fork is the Studio authoring entry — D-01/D-05). */
  initialDoor?: DoorState
}

export function WorkflowDoorSwitch({
  def,
  initial,
  renderPublish,
  onDescribeDraft,
  initialDoor = "both",
}: WorkflowDoorSwitchProps) {
  const [door, setDoor] = useState<DoorState>(initialDoor)
  const [describe, setDescribe] = useState("")
  const canDraft = describe.trim().length > 0

  // ── GOVERN DOOR — the EXISTING Builder (delegated, never re-implemented). The
  //    Builder's form panel owns the citation-policy picker / gate chips /
  //    folder-scope / model with live tier recompute + the LOCKED always-on judge
  //    (D-05). ──
  if (door === "govern") {
    return (
      <div data-testid="door-govern" className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <button
            type="button"
            data-testid="both-doors"
            onClick={() => setDoor("both")}
            className="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground"
          >
            ‹ both doors
          </button>
          <span className="text-[13px] font-medium text-foreground">🔧 Author &amp; govern</span>
          <span
            data-testid="judge-locked"
            title="The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn)."
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet"
          >
            <span aria-hidden="true">🔒</span> judge always-on
          </span>
        </div>
        <div className="min-h-0 flex-1">
          {/* The govern door IS the existing Builder — its advanced governance
              controls are delegated, with live tier recompute + the locked judge. */}
          <WorkflowBuilderPage initial={initial} renderPublish={renderPublish} />
        </div>
      </div>
    )
  }

  // ── DESCRIBE DOOR — the 018-A describe-box lineage + a soul preview + the
  //    one-click "switch to Author & govern ›" strip (D-05). ──
  if (door === "describe") {
    return (
      <div data-testid="door-describe" className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <button
            type="button"
            data-testid="both-doors"
            onClick={() => setDoor("both")}
            className="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground"
          >
            ‹ both doors
          </button>
          <span className="text-[13px] font-medium text-foreground">⚡ Describe &amp; run</span>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1fr_320px]">
          {/* The describe box (descends from WorkflowBuilderPage's empty screen). */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span aria-hidden="true" className="text-3xl">
                ✎
              </span>
              <h1 className="text-[1.4rem] font-semibold text-foreground">
                What recurring work should this automate?
              </h1>
            </div>
            <textarea
              aria-label="business requirement"
              data-testid="describe-box"
              value={describe}
              onChange={(e) => setDescribe(e.target.value)}
              placeholder="Describe the goal in plain language…"
              rows={5}
              className="w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                data-testid="describe-draft"
                disabled={!canDraft}
                onClick={() => {
                  // Forward the describe text to the EXISTING draft/generate path
                  // (the shell adds no new sink). The govern door (the Builder) owns
                  // the actual generate→draft flow — D-05/T-124-08.
                  onDescribeDraft?.(describe)
                  setDoor("govern")
                }}
                className="rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                Draft the workflow
              </button>
              <p data-testid="describe-hint" className="text-center text-[13px] text-muted-foreground">
                You describe the goal — the AI{" "}
                <b className="font-medium text-foreground">drafts the phases</b>,{" "}
                <b className="font-medium text-foreground">sets the strictness</b>, and{" "}
                <b className="font-medium text-foreground">asks about anything it had to guess</b>.
              </p>
            </div>
            {/* D-05: nothing lost by picking fast — advanced is one click away. */}
            <div
              data-testid="switch-strip"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-violet/30 bg-accent-violet/5 px-3 py-2 text-[12px] text-muted-foreground"
            >
              <span aria-hidden="true">🔧</span>
              <span>Need citation policy, gates, or per-phase scope?</span>
              <button
                type="button"
                data-testid="switch-to-govern"
                onClick={() => setDoor("govern")}
                className="ml-auto rounded-md border border-accent-violet/40 px-2.5 py-1 text-[12px] font-medium text-accent-violet hover:bg-accent-violet/10"
              >
                Author &amp; govern ›
              </button>
            </div>
          </div>
          {/* The soul PREVIEW of the current draft/definition (D-05). */}
          <aside data-testid="describe-soul-preview" className="rounded-lg border border-border bg-card/40 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              This workflow's soul
            </p>
            <WorkflowSoul def={def} scale="card" />
          </aside>
        </div>
      </div>
    )
  }

  // ── BOTH DOORS (default chooser) — two big side-by-side door cards. ──
  return (
    <div data-testid="workflow-doors" className="flex h-full flex-col bg-background">
      <div className="flex flex-col gap-1 border-b border-border px-6 py-4">
        <h1 className="text-[18px] font-semibold text-foreground">How do you want to build this?</h1>
        <p className="text-[13px] text-muted-foreground">
          Pick the fast path or full control — nothing is locked, you can switch anytime.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 py-6 md:grid-cols-2">
        {/* Door A — Describe & run (loose). */}
        <button
          type="button"
          data-testid="door-card-describe"
          onClick={() => setDoor("describe")}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/60"
        >
          <span aria-hidden="true" className="text-3xl">
            ⚡
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            loose · fastest path
          </span>
          <span className="text-[16px] font-semibold text-foreground">Describe &amp; run</span>
          <span className="text-[13px] text-muted-foreground">
            Say what recurring work this should do — the AI drafts the phases and sets the strictness.
          </span>
          <span className="mt-1 text-[13px] font-medium text-primary">
            Open <span aria-hidden="true">›</span>
          </span>
          <span className="mt-1 text-[11px] italic text-muted-foreground">
            nothing locked — switch to Author &amp; govern anytime
          </span>
        </button>

        {/* Door B — Author & govern (strict). */}
        <button
          type="button"
          data-testid="door-card-govern"
          onClick={() => setDoor("govern")}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-accent-violet/60"
        >
          <span aria-hidden="true" className="text-3xl">
            🔧
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            power · full control
          </span>
          <span className="text-[16px] font-semibold text-foreground">Author &amp; govern</span>
          <span className="text-[13px] text-muted-foreground">
            Open the full Builder — every advanced control, the live strictness tier, the locked judge.
          </span>
          <span className="mt-1 text-[13px] font-medium text-accent-violet">
            Open <span aria-hidden="true">›</span>
          </span>
          <span className="mt-1 text-[11px] italic text-muted-foreground">
            citation policy · gate set · per-phase scope &amp; model
          </span>
        </button>
      </div>
    </div>
  )
}

export default WorkflowDoorSwitch
