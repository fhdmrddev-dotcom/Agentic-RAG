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
} from "@/providers/StreamsProvider"
import type { Thread, WorkspaceFile } from "@/types"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { PanelSection } from "./PanelSection"
import { PanelEmpty } from "./PanelEmpty"
import { PanelRail } from "./PanelRail"
import { TodosSection } from "./TodosSection"
import { FilesSection } from "./FilesSection"
import { VersionDiff } from "./VersionDiff"
import { PendingAskStack } from "./PendingAskCard"
import { PhaseTimeline } from "./PhaseTimeline"
import { BatchResultList } from "./BatchResultList"

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

export interface WorkspacePanelProps {
  selectedThread: Thread | null
  /** Controlled panel state — owned by ChatLayout (Plan 06 hoist). */
  state: PanelState
  /** Single in-panel toggle (nav-parity): open ↔ rail. The open-state header
   *  control and the rail Expand control both flip this. */
  onToggle: () => void
  /** Rail Expand control / seam pointer: → open (force-open). */
  onExpand: () => void
}

export function WorkspacePanel({
  selectedThread: _selectedThread,
  state,
  onToggle,
  onExpand,
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
  const workflowLock = useWorkflowLockForThread(threadId)
  const isHarness = workflowLock != null
  const showTimeline = isHarness || phases.length > 0
  const showBatchResults = showTimeline && tasks.length > 0

  const isMobile = useIsMobile()

  // The file whose Versions the Versions section compares (lifted so FilesSection
  // sets it and VersionDiff consumes it — never orphaned).
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null)

  const hasActivity =
    todos.length > 0 || files.length > 0 || pendingAsks.length > 0 || phases.length > 0

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
        <PanelEmpty />
      ) : (
        <>
          <PanelSection title="Todos" count={{ done: todosDone, total: todos.length }}>
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
      <aside role="complementary" aria-label="Agent workspace">
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
      role="complementary"
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
