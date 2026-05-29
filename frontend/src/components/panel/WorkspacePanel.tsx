/**
 * Phase 087 Plan 02 Task 3 — WorkspacePanel (PANEL-01, sketch 004 / panel-shell.md).
 *
 * The panel shell + grid-state machine — the capstone that makes Waves 1-2
 * reachable. Composes the four sections (Todos · Files · Pending · Versions) into
 * one stacked-accordion scroll, pins the pending ask_user stack to the very top,
 * and owns the open/rail/hidden state machine, the ⌘./Ctrl+. toggle, the empty
 * short-circuit, and the <768px bottom-sheet.
 *
 * Data: useViewingThread() + the four Phase 086 reactive hooks (null-safe; `data`
 * never undefined, empty array is a stable ref — PANEL-06). The panel reconciles
 * to current state with NO page refresh.
 *
 * Layout (panel-shell.md D1 — Pitfall 3): the live ChatLayout is flex, not grid,
 * so the push/split grid lives INSIDE this component's own container. Three
 * desktop states animate via grid-template-columns:
 *   - open   → `1fr clamp(300px,30%,420px)`  (chat | panel)
 *   - rail   → `1fr 52px`                     (chat | 52px rail strip)
 *   - hidden → `1fr 0`                        (chat reclaims the column)
 * Below 1024px the panel drops to rail if the chat would starve (<600px).
 * Below 768px the panel becomes a bottom-sheet (Sheet) instead of a side column.
 *
 * A11Y: <aside role="complementary" aria-label="Agent workspace">; the grid
 * transition + chevron respect prefers-reduced-motion (motion-safe: variant).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { PanelRightClose, PanelRightOpen, X } from "lucide-react"
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
import { subscribeOpenPanel } from "./panelOpenSignal"

type PanelState = "open" | "rail" | "hidden"

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
}

export function WorkspacePanel({ selectedThread: _selectedThread }: WorkspacePanelProps) {
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

  // ── State machine. Default open when there's activity, else hidden. ──
  const [state, setState] = useState<PanelState>("open")

  // The header button cycles open → rail → hidden → open (desktop).
  const cycleState = useCallback(() => {
    setState((s) => (s === "open" ? "rail" : s === "rail" ? "hidden" : "open"))
  }, [])

  // ⌘./Ctrl+. toggles open ↔ hidden (Raycast instinct, D6).
  const toggleHidden = useCallback(() => {
    setState((s) => (s === "hidden" ? "open" : "hidden"))
  }, [])

  // Rail icon / seam pointer → expand the panel open.
  const expand = useCallback(() => setState("open"), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault()
        toggleHidden()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleHidden])

  // Chat-side seam affordances (SeamPointer / SeamCard in MessageItem) request a
  // panel-open via the module-level signal (additive wiring — PANEL-06 safe).
  useEffect(() => subscribeOpenPanel(expand), [expand])

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
        onClick={cycleState}
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
        <Sheet open={state !== "hidden"} onOpenChange={(o) => setState(o ? "open" : "hidden")}>
          <SheetContent side="bottom" className="max-h-[70vh]" hideCloseButton>
            <div className="flex items-center gap-2 px-4 pb-2 pt-1">
              <span className="font-headline text-sm font-semibold text-foreground">
                Workspace
              </span>
              <button
                type="button"
                onClick={() => setState("hidden")}
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

  // ── Desktop: push/split grid INSIDE this component (Pitfall 3). ──
  const panelCol =
    state === "open" ? "clamp(300px,30%,420px)" : state === "rail" ? "52px" : "0px"

  return (
    <aside
      role="complementary"
      aria-label="Agent workspace"
      className="grid h-screen min-h-0 motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
      style={{ gridTemplateColumns: `0 ${panelCol}` }}
    >
      {/* Column 0 is a zero-width spacer (chat lives in ChatLayout's flex sibling;
          this aside only owns the panel column). */}
      <div aria-hidden="true" />

      <div
        className={cn(
          "flex min-w-0 flex-col overflow-hidden border-l border-border bg-sidebar",
          state === "hidden" && "pointer-events-none opacity-0",
        )}
      >
        {state === "rail" ? (
          <PanelRail
            todos={{ done: todosDone, total: todos.length }}
            filesCount={files.length}
            pendingCount={pendingAsks.length}
            onExpand={expand}
          />
        ) : state === "open" ? (
          <>
            {header}
            {body}
          </>
        ) : null}
      </div>
    </aside>
  )
}

export default WorkspacePanel
