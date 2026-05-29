/**
 * Phase 087 — WorkspacePanel (PANEL-01, sketch 004 / panel-shell.md).
 *
 * The panel body/header/rail/mobile-sheet — composes the four sections
 * (Todos · Files · Pending · Versions) into one stacked-accordion scroll, pins
 * the pending ask_user stack to the very top, short-circuits to one calm empty
 * state, and drops to a <768px bottom-sheet.
 *
 * Plan 06 re-architecture: the panel is now CONTROLLED. The open/rail/hidden
 * state machine, the ⌘./Ctrl+. key listener, and the subscribeOpenPanel(expand)
 * effect were LIFTED to ChatLayout (panel-shell.md D1 — the chat|panel split is
 * a single ChatLayout-level CSS grid so the panel column resolves against the
 * real row width). WorkspacePanel no longer owns its own width; it just fills the
 * grid track ChatLayout sizes and reports collapse/expand intent via callbacks.
 *
 * Data: useViewingThread() + the four Phase 086 reactive hooks (null-safe; `data`
 * never undefined, empty array is a stable ref — PANEL-06). The panel reconciles
 * to current state with NO page refresh.
 *
 * A11Y: <aside role="complementary" aria-label="Agent workspace">; the chevron
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

export type PanelState = "open" | "rail" | "hidden"

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
  /** In-panel header chevron: open → rail → hidden → open. */
  onCycle: () => void
  /** Rail icon: → open. */
  onExpand: () => void
  /** Mobile sheet X / onOpenChange(false): → hidden. */
  onHide: () => void
}

export function WorkspacePanel({
  selectedThread: _selectedThread,
  state,
  onCycle,
  onExpand,
  onHide,
}: WorkspacePanelProps) {
  const threadId = useViewingThread()
  const { data: todos } = useTodos(threadId)
  const { data: files } = useWorkspaceFiles(threadId)
  const { data: pendingAsks } = useAskUserPrompt(threadId)

  const isMobile = useIsMobile()

  // The file whose Versions the Versions section compares (lifted so FilesSection
  // sets it and VersionDiff consumes it — never orphaned).
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null)

  const hasActivity =
    todos.length > 0 || files.length > 0 || pendingAsks.length > 0

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
              <p className="px-3 py-4 text-[13px] text-muted-foreground">
                Select a file to compare versions
              </p>
            )}
          </PanelSection>
        </>
      )}
    </div>
  )

  const header = (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <span className="font-headline text-sm font-semibold text-foreground">Workspace</span>
      <button
        type="button"
        onClick={onCycle}
        aria-label="Collapse workspace"
        className="ml-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <PanelRightClose className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )

  // ── Mobile (<768px): bottom-sheet instead of a side column (D5). ──
  if (isMobile) {
    return (
      <aside role="complementary" aria-label="Agent workspace">
        <Sheet open={state !== "hidden"} onOpenChange={(o) => (o ? onExpand() : onHide())}>
          <SheetContent side="bottom" className="max-h-[70vh]" hideCloseButton>
            <div className="flex items-center gap-2 px-4 pb-2 pt-1">
              <span className="font-headline text-sm font-semibold text-foreground">
                Workspace
              </span>
              <button
                type="button"
                onClick={onHide}
                aria-label="Close workspace"
                className="ml-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
  //    No self-referential aside grid — the width animation lives on ChatLayout. ──
  return (
    <aside
      role="complementary"
      aria-label="Agent workspace"
      className={cn(
        "flex h-screen min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-sidebar",
        state === "hidden" && "pointer-events-none opacity-0",
      )}
    >
      {state === "rail" ? (
        <PanelRail
          todos={{ done: todosDone, total: todos.length }}
          filesCount={files.length}
          pendingCount={pendingAsks.length}
          onExpand={onExpand}
        />
      ) : state === "open" ? (
        <>
          {header}
          {body}
        </>
      ) : null}
    </aside>
  )
}

export default WorkspacePanel
