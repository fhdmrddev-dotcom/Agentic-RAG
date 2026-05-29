import { useCallback, useEffect, useRef, useState } from "react"
import { NavPanel } from "./NavPanel"
import { ChatArea } from "@/components/chat/ChatArea"
import { WorkspacePanel, type PanelState } from "@/components/panel/WorkspacePanel"
import { subscribeOpenPanel } from "@/components/panel/panelOpenSignal"
import { IngestionPage } from "@/pages/IngestionPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { SkillsPage } from "@/pages/SkillsPage"
import { KnowledgeHealthPage } from "@/pages/KnowledgeHealthPage"
import { useThreads } from "@/hooks/useThreads"
import { useFolders } from "@/hooks/useFolders"
import { useTheme } from "@/hooks/useTheme"
import { useAskUserPrompt, useViewingThread } from "@/providers/StreamsProvider"
import type { ActiveView } from "@/App"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MessageSquare, FileText, Activity, Zap, Settings, Plus } from "lucide-react"

const NAV_ITEMS_MOBILE = [
  { view: "chat" as ActiveView,           icon: MessageSquare, label: "Chat" },
  { view: "documents" as ActiveView,      icon: FileText,      label: "Documents" },
  { view: "library-health" as ActiveView, icon: Activity,      label: "Library Health" },
  { view: "skills" as ActiveView,         icon: Zap,           label: "Skills" },
  { view: "settings" as ActiveView,       icon: Settings,      label: "Settings" },
] as const

interface Props {
  onSignOut: () => void
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  prefillMessage: string | null
  onSetPrefillMessage: (msg: string | null) => void
}

export function ChatLayout({ onSignOut, activeView, onNavigate, prefillMessage, onSetPrefillMessage }: Props) {
  const {
    threads,
    selectedThread,
    loading: _loading,
    loadThreads,
    selectThread,
    newThread,
    deleteThread,
    renameThread,
    updateThreadTitle,
  } = useThreads()

  const { folders } = useFolders()
  const { theme, toggleTheme } = useTheme()

  const selectedThreadRef = useRef(selectedThread)
  useEffect(() => {
    selectedThreadRef.current = selectedThread
  }, [selectedThread])

  const handleTitleUpdate = useCallback(
    (title: string) => {
      const thread = selectedThreadRef.current
      if (thread) updateThreadTitle(thread.id, title)
    },
    [updateThreadTitle],
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileFolderId, setMobileFolderId] = useState<string | null>(null)

  const handleTryInChat = useCallback((skillName: string) => {
    onSetPrefillMessage(`Use the ${skillName} skill`)
    onNavigate("chat")
  }, [onSetPrefillMessage, onNavigate])

  // ── Plan 06: lifted panel state machine (panel-shell.md D1). The chat|panel
  //    split is a single ChatLayout-level CSS grid; WorkspacePanel + the chat-
  //    header toggle + the seam signal all drive THIS state. ──
  const [panelState, setPanelState] = useState<PanelState>("open")

  // In-panel header chevron: open → rail → hidden → open.
  const cycleState = useCallback(() => {
    setPanelState((s) => (s === "open" ? "rail" : s === "rail" ? "hidden" : "open"))
  }, [])
  // Persistent chat-header button + ⌘./Ctrl+.: open ↔ hidden (D6).
  const toggleWorkspace = useCallback(() => {
    setPanelState((s) => (s === "hidden" ? "open" : "hidden"))
  }, [])
  // Rail icon / seam pointer: → open.
  const expand = useCallback(() => setPanelState("open"), [])
  // Mobile sheet X / onOpenChange(false): → hidden.
  const hidePanel = useCallback(() => setPanelState("hidden"), [])

  // ⌘./Ctrl+. toggles open ↔ hidden (moved up from WorkspacePanel).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault()
        toggleWorkspace()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleWorkspace])

  // Chat-side seam affordances request a panel-open via the module-level signal
  // (additive wiring — moved up from WorkspacePanel; PANEL-06 safe).
  useEffect(() => subscribeOpenPanel(expand), [expand])

  // Pending ask_user for the currently-viewed thread → drives the chat-header
  // pulsing dot when the panel is not open (gap 4 / PANEL-01). Same hook
  // WorkspacePanel already uses — additive, no new store.
  const viewingThreadId = useViewingThread()
  const { data: pendingAsks } = useAskUserPrompt(viewingThreadId)
  const workspacePending = pendingAsks.length > 0 && panelState !== "open"

  return (
    <div className="flex h-screen bg-background">
      <NavPanel
        activeView={activeView}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        threads={threads}
        selectedThread={selectedThread}
        onSelectThread={selectThread}
        onNewThread={newThread}
        loadThreads={loadThreads}
        onDeleteThread={deleteThread}
        onRenameThread={renameThread}
        folders={folders}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar/95 backdrop-blur-md flex flex-col md:hidden">
          {/* Thread list (scrollable, top) */}
          <div className="flex-1 overflow-y-auto px-2 pt-4">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Chat
            </p>
            <div className="px-1 mb-2">
              <Button
                onClick={() => { newThread(mobileFolderId); setMobileFolderId(null) }}
                className="w-full justify-center gap-2 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
              {folders.length > 0 && (
                <select
                  value={mobileFolderId ?? ""}
                  onChange={(e) => setMobileFolderId(e.target.value || null)}
                  className="w-full text-xs rounded-lg px-2 py-1.5 bg-card text-foreground ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all mt-2"
                >
                  <option value="">All documents</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-0.5 mt-2">
              {threads.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-4 italic">No recent chats</p>
              )}
              {threads.map((thread) => {
                const isSelected = selectedThread?.id === thread.id
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "relative rounded-lg cursor-pointer transition-all duration-150 py-1.5",
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
                    )}
                    onClick={() => selectThread(thread)}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-500" />
                    )}
                    <div className="px-3 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="text-sm truncate" title={thread.title}>{thread.title}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Nav icon row (bottom, fixed) */}
          <div className="border-t border-border/20 px-2 py-3 flex items-center justify-around">
            {NAV_ITEMS_MOBILE.map(({ view, icon: Icon, label }) => {
              const isActive = activeView === view
              return (
                <button
                  key={view}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => { onNavigate(view); setDrawerOpen(false) }}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    !isActive && "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
                  )}
                >
                  {isActive ? (
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-sm shadow-primary/20">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activeView === "chat" ? (
        // Phase 087-06: App-level chat|panel CSS grid (panel-shell.md D1). The
        // panel column resolves against the REAL row width (not the panel's own
        // indefinite flex width), so 1fr + clamp(...) always sums to the row —
        // zero horizontal overflow in open/rail/hidden, flush-right panel, and
        // the chat centers within its own 1fr column (no dead band).
        <div
          className="grid min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
          style={{
            gridTemplateColumns:
              "1fr " +
              (panelState === "open"
                ? "clamp(300px,30%,420px)"
                : panelState === "rail"
                  ? "52px"
                  : "0px"),
          }}
        >
          <main className="min-w-0 overflow-hidden">
            <ChatArea
              thread={selectedThread}
              onCreateThread={newThread}
              onTitleUpdate={handleTitleUpdate}
              folders={folders}
              prefillMessage={prefillMessage}
              onClearPrefill={() => onSetPrefillMessage(null)}
              onOpenDrawer={() => setDrawerOpen(true)}
              onToggleWorkspace={toggleWorkspace}
              workspacePending={workspacePending}
            />
          </main>
          <WorkspacePanel
            selectedThread={selectedThread}
            state={panelState}
            onCycle={cycleState}
            onExpand={expand}
            onHide={hidePanel}
          />
        </div>
      ) : (
        <main className="flex-1 overflow-hidden">
          {activeView === "documents" ? (
            <IngestionPage />
          ) : activeView === "skills" ? (
            <SkillsPage onTryInChat={handleTryInChat} />
          ) : activeView === "settings" ? (
            <SettingsPage />
          ) : (
            <KnowledgeHealthPage />
          )}
        </main>
      )}
    </div>
  )
}
