/**
 * Phase 087 — WorkspacePanel (PANEL-01, sketch 004 / panel-shell.md).
 *
 * The panel body/header/rail/mobile-sheet — composes the four sections
 * (Todos · Files · Pending · Versions) into one stacked-accordion scroll, pins
 * the pending ask_user stack to the very top, short-circuits to one calm empty
 * state, and drops to a <768px bottom-sheet.
 *
 * Plan 06 re-architecture: the panel is now CONTROLLED. The state machine, the
 * ⌘./Ctrl+. key listener, and the subscribeOpenPanel(expand) effect were LIFTED
 * to ChatLayout (panel-shell.md D1 — the chat|panel split is a single
 * ChatLayout-level CSS grid so the panel column resolves against the real row
 * width). WorkspacePanel no longer owns its own width; it just fills the grid
 * track ChatLayout sizes and reports collapse/expand intent via callbacks.
 *
 * Plan 08 (operator directive 2026-05-29): consolidated to a NAV-STYLE 2-state
 * machine — `state: "open" | "rail"` (the "hidden" state is gone). The panel has
 * ONE in-panel toggle that mirrors NavPanel's single button: the open-state
 * header control collapses → rail; the rail's always-present Expand control
 * reopens → open. There is no chat-header toggle. The ~52px rail is always
 * present (reopen-by-mouse on every thread incl. the empty/welcome screen) and
 * hosts the pulsing-amber-dot pending indicator.
 *
 * Data: useViewingThread() + the four Phase 086 reactive hooks (null-safe; `data`
 * never undefined, empty array is a stable ref — PANEL-06). The panel reconciles
 * to current state with NO page refresh.
 *
 * A11Y: <aside role="complementary" aria-label="Agent workspace">; the toggle
 * respects prefers-reduced-motion (the grid transition lives on ChatLayout).
 */
import { useEffect, useMemo, useState } from "react"
import { PanelRightClose, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useTodos,
  useWorkspaceFiles,
  useAskUserPrompt,
  useViewingThread,
  usePhases,
  useTasks,
  useWorkflowLockForThread,
  useDerivedPanel,
} from "@/providers/StreamsProvider"
import type { Thread, WorkspaceFile } from "@/types"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { PanelSection } from "./PanelSection"
import { PanelEmpty } from "./PanelEmpty"
import { TemplateUpload } from "./TemplateUpload"
import { PanelRail } from "./PanelRail"
import { TodosSection } from "./TodosSection"
import { FilesSection } from "./FilesSection"
import { VersionDiff } from "./VersionDiff"
import { PendingAskStack } from "./PendingAskCard"
import { PhaseTimeline } from "./PhaseTimeline"
import { BatchResultList } from "./BatchResultList"
// Phase 124-03 Task 1 (WUX-01, D-07/D-08, sketch 046-A ② run-header) — the run
// soul header. This is an ADDITIVE SIBLING of the live PhaseTimeline section
// (the G-5 red line): WorkflowSoul is a fresh presentational component that reads
// the DEFINITION only; PhaseTimeline / PhaseCard are NOT imported here for it, NOT
// given a new prop, and NOT threaded with any soul atom. The run soul sources the
// published definition ADDITIVELY by id (A2) — getThreadWorkflow gives the run
// frame's definition_slug, listPublishedWorkflows gives the SAME owner-scoped
// WorkflowDefinitionJSON the library card already reads (PublishedWorkflow.definition).
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
import type { DefShape } from "@/components/workflows/soulData"
import { getThreadWorkflow, listPublishedWorkflows } from "@/lib/api"

export type PanelState = "open" | "rail"

const MOBILE_BREAKPOINT = 768

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return isMobile
}

/**
 * Phase 124-03 Task 1 (WUX-01, D-07/D-08, A2) — the run-surface soul header.
 *
 * An ADDITIVE SIBLING of the live PhaseTimeline (the G-5 red line): it reads the
 * DEFINITION only and renders <WorkflowSoul scale="run">. It must NEVER:
 *  - consume usePhases(threadId) for live phase state,
 *  - render an elapsed timer or a per-phase slug (would re-open BUG-260610-01 /
 *    BUG-260609-04 — those belong to the live timeline, not the soul),
 *  - read PhaseCard / PhaseTimeline internals or add a prop to either.
 *
 * Definition sourcing (A2): the run frame (ThreadWorkflowState) carries only
 * definition_slug + run-state phases, NOT the authored definition. So we do a
 * sibling-only additive read — getThreadWorkflow → definition_slug, then
 * listPublishedWorkflows → the SAME owner-scoped PublishedWorkflow.definition JSONB
 * the library card already consumes (no new endpoint, no widened fields, RLS
 * unchanged — T-124-12 accept). A draft test-run with a null business_requirement
 * is covered by WorkflowSoul's honest "draft · purpose not declared yet" empty-state.
 */
function RunSoul({ threadId }: { threadId: string | null }) {
  const [def, setDef] = useState<DefShape | null>(null)

  useEffect(() => {
    if (!threadId) {
      setDef(null)
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    void (async () => {
      try {
        // 1) The run frame — the only thing that names which published definition
        //    this thread's run is executing (definition_slug). Run-state only.
        const frame = await getThreadWorkflow(threadId, ctrl.signal)
        const slug = frame.definition_slug
        if (!slug) {
          if (!cancelled) setDef(null)
          return
        }
        // 2) The published list — the SAME owner-scoped read the card uses; match
        //    the run frame's slug to recover the full authored definition JSONB.
        const published = await listPublishedWorkflows(undefined, ctrl.signal)
        const match = published.find((w) => w.slug === slug)
        if (!cancelled) setDef((match?.definition as DefShape | undefined) ?? null)
      } catch {
        // A reconcile/list miss is non-fatal — the soul falls back to its honest
        // empty-states (no purpose / chat output) rather than crashing the panel.
        if (!cancelled) setDef(null)
      }
    })()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [threadId])

  return (
    <div className="px-1">
      <WorkflowSoul def={def} scale="run" />
    </div>
  )
}

/**
 * Phase 188 Plan 10 (RUNVIZ-03 / D-188-13) — the run receipt, and the OTHER HALF of a
 * bidirectional seam.
 *
 * The run surface already carries a line back into this thread. This is its counterpart:
 * one line, from the thread that anchors a workflow run back to that run's own surface.
 *
 * WHY IT IS NOT A CONVENIENCE. `GET /runs` and the cross-workflow runs home are deferred
 * by the SPEC, and the app has no router — so there are no links and no list. Chat history
 * IS the index of runs, because a launch mints one thread per run. Without this line a run
 * becomes unreachable the moment the user navigates away from it, and "a finished run
 * re-opens" would be true of the endpoint and false of the product.
 *
 * THE ID IS RESOLVED FROM THE THREAD FRAME, and deliberately NOT from the panel's workflow
 * lock. The lock's id field is documented as the anchor but is overwritten with a PRODUCER
 * run id at kickoff and again on a Continue re-subscribe (StreamsProvider), and the lock is
 * cleared outright once a run goes terminal — which is exactly the case this line exists to
 * serve. Both ids are bare uuids, so a swap typechecks and then resolves nothing.
 *
 * ⚠ CORRECTED (CR-03). This block previously asserted that *"the thread frame's anchor
 * survives termination ... and is the only honest source"*, and read `active_workflow_run_id`
 * alone on the strength of it. The claim was FALSE and the falseness is in the DB:
 * `finish_run` runs `UPDATE threads SET active_workflow_run_id = NULL WHERE
 * active_workflow_run_id = $1` in the SAME transaction as the terminal status — described in
 * its own docblock as "the SINGLE authoritative clear site", and correctly stated by
 * `reconcilePhases`' comment ("a COMPLETED workflow run CLEARS the thread anchor"). So this
 * receipt rendered ONLY while a run was live, i.e. never for the finished run it was built
 * for, and with `GET /runs` deferred and no router that run then had zero entry points.
 *
 * That clear is Phase 092's SC#2 (no dangling lock survives a terminal run) and is NOT
 * undone. Instead the frame now also carries `last_workflow_run_id` — the anchor-then-latest
 * resolution the SAME endpoint already performed to source its phase spine, surfaced rather
 * than recomputed (no migration, no new query). The live anchor is still preferred, so a
 * mid-run receipt is byte-unchanged; the fallback is reached only once the anchor is gone.
 *
 * ADDITIVE SIBLING, and the same G-5 red line the run-soul section observes: it does not
 * read PhaseCard / PhaseTimeline internals and adds a prop to neither. It also renders
 * nothing at all when the callback is absent, so every existing caller and every existing
 * panel test is byte-unchanged; and it sits inside the SAME harness gate as its
 * neighbours, so a Deep / no-run thread sees nothing new (the D-08 discipline).
 *
 * ⚠ The visible words are written ONCE, in the constant below. The acceptance fence counts
 * that literal in this file, so no comment here spells it — a comment that did would turn
 * a measurement of the rendered line into a measurement of the prose (the 187-24 lesson).
 */
const RUN_RECEIPT_LABEL = "Open the run"

function RunSeam({
  threadId,
  onOpenRun,
}: {
  threadId: string | null
  onOpenRun?: (runId: string) => void
}) {
  const [runId, setRunId] = useState<string | null>(null)
  // The callback is read at CLICK time, never captured here, so the effect keys on its
  // PRESENCE rather than its identity. An inline arrow from the caller would otherwise
  // change identity every render and re-fire this read on every render it caused.
  const enabled = onOpenRun != null

  useEffect(() => {
    if (!threadId || !enabled) {
      setRunId(null)
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    void (async () => {
      try {
        const frame = await getThreadWorkflow(threadId, ctrl.signal)
        // Live anchor first (unchanged mid-run), then the anchor that survives termination.
        if (!cancelled) {
          setRunId(frame.active_workflow_run_id ?? frame.last_workflow_run_id ?? null)
        }
      } catch {
        // A frame read that fails degrades to no line — an unreachable receipt is better
        // than one that opens a surface it cannot resolve, and this must never throw
        // into the panel.
        if (!cancelled) setRunId(null)
      }
    })()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [threadId, enabled])

  if (!onOpenRun || !runId) return null

  return (
    <div className="border-b border-border/40 px-3 py-2">
      <button
        type="button"
        onClick={() => onOpenRun(runId)}
        data-testid="panel-run-receipt"
        className="text-[13px] font-medium text-primary transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {RUN_RECEIPT_LABEL}
      </button>
    </div>
  )
}

export interface WorkspacePanelProps {
  selectedThread: Thread | null
  /** Controlled panel state — owned by ChatLayout (Plan 06 hoist). */
  state: PanelState
  /** Single in-panel toggle (nav-parity): open ↔ rail. The open-state header
   *  control and the rail Expand control both flip this. */
  onToggle: () => void
  /** Rail Expand control / seam pointer: → open (force-open). */
  onExpand: () => void
  /** OPTIONAL — open the run this thread anchors (D-188-13's second half). Omitted by
   *  any caller that has nowhere to send the user; the receipt then does not render. */
  onOpenRun?: (runId: string) => void
}

export function WorkspacePanel({
  selectedThread: _selectedThread,
  state,
  onToggle,
  onExpand,
  onOpenRun,
}: WorkspacePanelProps) {
  const threadId = useViewingThread()
  const { data: todos } = useTodos(threadId)
  const { data: files } = useWorkspaceFiles(threadId)
  const { data: pendingAsks } = useAskUserPrompt(threadId)
  // Phase 094 (PANEL-08): the harness phase-timeline slice + the server-truth
  // workflow lock (presence ⇒ harness mode). The Workflow section mounts when
  // mode==="harness" OR phases exist (DATA-CONTRACT §6), else PanelEmpty.
  const { data: phases } = usePhases(threadId)
  // Phase 094 WR-01 (D-06 / SC#6): the run-level sub-agent rows (the honest
  // per-subtopic `sub_agent_done.summary` source). Mounted thread-scoped beneath
  // the live timeline so batch sub-results become VISIBLE before the merge — under
  // the same harness/phases-exist gate as the timeline, AND only when tasks exist.
  const { data: tasks } = useTasks(threadId)
  // Phase 095.1 Plan 06 (GAP-1 / WORKSPACE-PARITY): the activity-derived workspace
  // panel signal. REUSE the existing Plan-02 hook — it already applies the smart
  // gate (write_todos OR ≥2 deduped MEANINGFUL tools) internally and returns the
  // stable EMPTY ref when the thread doesn't qualify (so reading it never churns a
  // chat re-render — PANEL-06 preserved). `derived.length > 0` is the correct
  // "earns a derived panel" signal; do NOT re-derive the gate here.
  const derived = useDerivedPanel(threadId)
  const workflowLock = useWorkflowLockForThread(threadId)
  const isHarness = workflowLock != null
  const showTimeline = isHarness || phases.length > 0
  const showBatchResults = showTimeline && tasks.length > 0

  const isMobile = useIsMobile()

  // The file whose Versions the Versions section compares (lifted so FilesSection
  // sets it and VersionDiff consumes it — never orphaned).
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null)

  // Phase 095.1 Plan 06 (GAP-1, D-095.1-01/02): include the derived signal so a
  // thread with ONLY tool-call activity that earns a derived panel (the
  // no-write_todos cross-provider parity case) renders the panel body instead of
  // short-circuiting to <PanelEmpty/> — letting TodosSection (precedence 2) show
  // the derived rows. Without this the derivation was structurally unreachable.
  const hasActivity =
    todos.length > 0 ||
    files.length > 0 ||
    pendingAsks.length > 0 ||
    phases.length > 0 ||
    derived.length > 0

  const todosDone = useMemo(
    () => todos.filter((t) => t.status === "completed").length,
    [todos],
  )

  // ── The panel body (shared by the side column AND the mobile sheet). ──
  const body = (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Pending ask_user pins to the VERY TOP regardless of section order (D-03). */}
      {pendingAsks.length > 0 && (
        <div className="border-b border-border/40 p-2">
          <PendingAskStack />
        </div>
      )}

      {!hasActivity ? (
        // Empty short-circuit (D3): ONE calm centered state, never four headers.
        // Phase 100 (D-01): the template-upload affordance must stay reachable on
        // a no-activity thread — without this, the FilesSection copy of the button
        // is structurally unreachable exactly where a template-fill flow starts.
        <PanelEmpty>{threadId ? <TemplateUpload /> : null}</PanelEmpty>
      ) : (
        <>
          {/* Phase 095.1 Plan 06 (GAP-1): keep the Todos count badge HONEST. With
              derived-only activity there are no REAL todos, so a {done:0,total:0}
              badge would render a misleading "0/0". Omit the count badge entirely
              when there are no real todos (PanelSection renders no badge when count
              is undefined — same omission idiom the Files section uses); the
              "derived from activity" marker inside TodosSection signals the state. */}
          <PanelSection
            title="Todos"
            count={todos.length > 0 ? { done: todosDone, total: todos.length } : undefined}
          >
            <TodosSection />
          </PanelSection>

          <PanelSection title="Files" count={files.length}>
            <FilesSection onSelectFile={setSelectedFile} />
          </PanelSection>

          <PanelSection title="Versions" defaultOpen={false}>
            {selectedFile && threadId ? (
              <VersionDiff threadId={threadId} file={selectedFile} />
            ) : (
              <p className="px-3 py-4 text-[13px] text-panel-muted-foreground">
                Select a file to compare versions
              </p>
            )}
          </PanelSection>

          {/* Phase 124-03 Task 1 (WUX-01, D-07/D-08, sketch 046-A ②): the run soul
              header — an ADDITIVE SIBLING section ABOVE the live Workflow timeline.
              It reads the DEFINITION only (purpose · tier · glyph-dot spine · needs ·
              output) via a sibling-only by-id read; it never touches the timeline's
              live phase state. Gated to the SAME showTimeline condition (harness runs
              only) so Deep / no-run threads never see it — Deep stays byte-identical,
              no shared-path fork (D-08). The PhaseTimeline section below is UNCHANGED. */}
          {showTimeline && (
            <PanelSection title="This workflow">
              <RunSoul threadId={threadId} />
            </PanelSection>
          )}

          {/* Phase 188 Plan 10 (RUNVIZ-03 / D-188-13): the run receipt — an ADDITIVE
              SIBLING line, above the live timeline section, under the SAME harness gate
              as the run soul above it, so Deep / no-run threads stay byte-identical.
              See the component's docblock for why the id comes from the thread anchor
              and never from the panel's lock. */}
          {showTimeline && <RunSeam threadId={threadId} onOpenRun={onOpenRun} />}

          {/* Phase 094 (PANEL-08): the harness phase-timeline — the 5th section,
              mounted only for a harness run (server-truth lock) OR when phases
              exist. Deep / no-run threads never see it (reuses PanelEmpty above). */}
          {showTimeline && (
            <PanelSection title="Workflow" count={phases.length || undefined}>
              <PhaseTimeline threadId={threadId} />
            </PanelSection>
          )}

          {/* Phase 094 WR-01 (D-06 / SC#6): the batch sub-results section — the
              per-subtopic sub_agent_done.summary rows, readable BEFORE the merge.
              Sibling block beneath the live timeline; mounted only for a harness
              run/phases-exist context AND when tasks exist (never in Deep mode,
              never an empty box). Thread-scoped via useTasks (PANEL-09 isolation —
              the chat never re-renders). */}
          {showBatchResults && (
            <PanelSection title="Sub-results" count={tasks.length || undefined}>
              <div className="px-2 pb-2">
                <BatchResultList threadId={threadId} />
              </div>
            </PanelSection>
          )}
        </>
      )}
    </div>
  )

  // Single in-panel toggle, open state (nav-parity with NavPanel's collapse
  // button): PanelRightClose + "Collapse workspace" → rail. The rail owns the
  // matching Expand control (PanelRightOpen + "Expand workspace" → open).
  const header = (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <span className="font-headline text-sm font-semibold text-foreground">Workspace</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Collapse workspace"
        className="ml-auto grid h-7 w-7 place-items-center rounded-md text-panel-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <PanelRightClose className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )

  // ── Mobile (<768px): bottom-sheet instead of a side column (D5). The rail is a
  //    desktop affordance; on phone the 2-state machine maps open → sheet shown,
  //    rail → sheet dismissed. Dismiss (X / backdrop / onOpenChange(false))
  //    collapses to rail via onToggle; the seam pointer (onExpand) reopens it.
  //    Otherwise byte-equivalent to Plan 06's sheet branch. ──
  if (isMobile) {
    return (
      <aside aria-label="Agent workspace">
        <Sheet open={state === "open"} onOpenChange={(o) => (o ? onExpand() : onToggle())}>
          <SheetContent side="bottom" className="max-h-[70vh]" hideCloseButton>
            <div className="flex items-center gap-2 px-4 pb-2 pt-1">
              <span className="font-headline text-sm font-semibold text-foreground">
                Workspace
              </span>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Close workspace"
                className="ml-auto grid h-7 w-7 place-items-center rounded-md text-panel-muted-foreground hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {body}
          </SheetContent>
        </Sheet>
      </aside>
    )
  }

  // ── Desktop: plain panel container that FILLS the grid column ChatLayout sizes.
  //    No self-referential aside grid — the width animation lives on ChatLayout.
  //    Nav-style 2-state: open → header + body; rail → the always-present rail
  //    (no "hidden" opacity branch). ──
  return (
    <aside
      aria-label="Agent workspace"
      className={cn(
        // Phase 087 (gaps 5/6): dedicated panel surface + strengthened left edge
        // so the panel reads as a distinct surface from chat (dark) / page (light)
        // — NOT bg-sidebar/border-border (those stay shared with NavPanel).
        "flex h-screen min-h-0 min-w-0 flex-col overflow-hidden border-l border-[hsl(var(--panel-border))] bg-[hsl(var(--panel-surface))]",
      )}
    >
      {state === "rail" ? (
        <PanelRail
          todos={{ done: todosDone, total: todos.length }}
          filesCount={files.length}
          pendingCount={pendingAsks.length}
          // Pulsing-amber-dot (PANEL-01): a pending ask_user while collapsed must
          // never go silent. The rail's always-present Expand control is its
          // permanent host (moved off the removed chat-header toggle).
          pending={pendingAsks.length > 0}
          onExpand={onExpand}
        />
      ) : (
        <>
          {header}
          {body}
        </>
      )}
    </aside>
  )
}

export default WorkspacePanel
