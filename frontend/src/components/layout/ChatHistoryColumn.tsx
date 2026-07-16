import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Folder as FolderIcon,
  AlertCircle,
  Square,
  Search,
} from "lucide-react"
import type { Folder, Thread } from "@/types"
// Phase 156 (POLISH-01 / D-01, Wave 1): the dedicated full-height chat-history
// column. This is a MOVE + wrap (D-09), NOT a rewrite — the entire row body is
// lifted VERBATIM from the old NavPanel.renderThreadList() (select / inline rename /
// delete-confirm / SEED-064 running dot + Stop / options menu / the Phase-155 A11Y-01
// CSS-gated action reveal). The only additions are the WRAPPER: the "Chats" header,
// the inline "Filter this list…" box (SC#2), and the date grouping (SC#3). Because the
// list now owns its own full-height column between the thin rail and the chat grid,
// nav growth can no longer starve it (D-10 — structurally relieves BUG-260711-01).
import {
  bucketFor,
  groupByDate,
  groupByFolder,
  matchesTitle,
  folderLabel,
  HighlightTitle,
} from "@/lib/threadGroups"
// SEED-064: cross-thread run visibility + Stop — moves with the list (it also pulls
// StreamsProvider, so any test rendering this column mocks/stubs that provider).
import { useStreamingThreadIds, useStreamActions } from "@/providers/StreamsProvider"
import { ActiveRunsTray } from "@/components/chat/ActiveRunsTray"

interface Props {
  threads: Thread[]
  selectedThread: Thread | null
  onSelectThread: (thread: Thread) => void
  onNewThread: (folderId?: string | null) => void
  onDeleteThread: (id: string) => Promise<void>
  onRenameThread: (id: string, title: string) => Promise<void>
  folders: Folder[]
  // Phase 156 Wave 2 (Plan 03): opens the ⌘K global finder from the chip inside the
  // filter box. Optional so the Wave-1 tests (which don't pass it) still render; wired
  // by ChatLayout since Wave 2.
  onOpenPalette?: () => void
}

export function ChatHistoryColumn({
  threads,
  selectedThread,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  folders,
  onOpenPalette,
}: Props) {
  // SEED-064: which threads have a live run (reactive on start/stop, not tokens)
  // + the cross-thread stop action. Lifted verbatim from NavPanel.
  const streamingThreadIds = useStreamingThreadIds()
  const streamActions = useStreamActions()

  // Row state — lifted verbatim from NavPanel (D-09).
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Wave-1 wrapper state: the inline title filter (SC#2).
  const [query, setQuery] = useState("")
  // Wave-3 (Plan 04 / D-04, OPTIONAL): group the list by date (default — keeps SC#3
  // intact) or by folder. Folder mode swaps each row's folder chip for its date bucket.
  const [groupMode, setGroupMode] = useState<"date" | "folder">("date")

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  function startRename(thread: Thread) {
    setMenuOpenId(null)
    setEditingId(thread.id)
    setEditValue(thread.title)
  }

  async function commitRename(id: string) {
    const trimmed = editValue.trim()
    if (trimmed) await onRenameThread(id, trimmed)
    setEditingId(null)
  }

  // A single thread row — lifted VERBATIM from NavPanel.renderThreadList() (:138-278).
  // The ONLY changes from the original: the raw {thread.title} is rendered through the
  // XSS-safe <HighlightTitle> (T-156-01), and the bare FolderIcon is replaced by a
  // folder chip via folderLabel(). Everything else — the group wrapper, the selected /
  // editing / menu / running branches, the active-indicator bar, the primary <button>
  // title row, the SEED-064 resting dot with its hover/focus fade, the ALWAYS-rendered
  // CSS-gated actions block (opacity-0 group-hover:opacity-100 group-focus-within:
  // opacity-100 — the A11Y-01 keyboard reveal), the Stop <button>, the options <button>,
  // and the dropdown menu — is preserved intact (D-09).
  function renderRow(thread: Thread) {
    const isSelected = selectedThread?.id === thread.id
    const isEditing = editingId === thread.id
    const isMenuOpen = menuOpenId === thread.id
    // SEED-064: live run on this thread?
    const isRunning = streamingThreadIds.has(thread.id)

    return (
      <div key={thread.id} className="relative">
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => commitRename(thread.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename(thread.id)
              if (e.key === "Escape") setEditingId(null)
            }}
            className="w-full px-3 py-1.5 text-xs bg-card border border-border/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          />
        ) : (
          // Phase 155 (A11Y-01 / D-05): the row is a real <button> for the primary
          // "open thread" action; the Stop + options controls are SIBLINGS (never
          // nested inside the row button — nested buttons are invalid HTML), so every
          // control is independently keyboard-operable. The Stop/options actions row is
          // ALWAYS rendered and CSS-gated (opacity), revealed on hover OR keyboard
          // focus-within (or while the options menu is open) — never render-gated on
          // mouse state — so a keyboard-only user can Tab to Stop / Rename / Delete.
          <div
            className={cn(
              "group relative rounded-lg transition-all duration-150",
              isSelected
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
            )}
          >
            {/* Active indicator */}
            {isSelected && (
              <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-500 z-10" />
            )}
            {/* Title row — the primary click/keyboard target */}
            <button
              type="button"
              onClick={() => onSelectThread(thread)}
              className="w-full py-1.5 cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="px-3 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                <span className="text-sm truncate flex-1 min-w-0" title={thread.title}>
                  <HighlightTitle title={thread.title} query={query} />
                </span>
                {/* Per-row meta (sketch .r-meta rowCompact swap): DATE mode shows the
                    folder chip (name, or an italic "Unfiled"); FOLDER mode shows the
                    date bucket instead — the group header already names the folder, so
                    the chip would be redundant — reusing the tested `bucketFor`. */}
                {groupMode === "folder" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] shrink-0 whitespace-nowrap text-muted-foreground">
                    {bucketFor(thread.updated_at)}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] shrink-0 whitespace-nowrap",
                      thread.folder_id ? "text-muted-foreground" : "text-muted-foreground/70 italic",
                    )}
                  >
                    {thread.folder_id && (
                      <FolderIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    )}
                    {folderLabel(folders, thread.folder_id)}
                  </span>
                )}
              </div>
            </button>

            {/* SEED-064: resting running dot — ambient "this chat is working" signal.
                CSS-gated (not render-gated): it fades out on hover OR keyboard
                focus-within (or while the options menu is open) and never overlaps
                Stop for a keyboard user. `pointer-events-none` keeps it click-through. */}
            {isRunning && (
              <div
                className={cn(
                  "absolute inset-y-0 right-0 flex items-center pl-6 pr-3 bg-gradient-to-l from-sidebar via-sidebar to-transparent rounded-r-lg pointer-events-none",
                  "transition-opacity group-hover:opacity-0 group-focus-within:opacity-0",
                  isMenuOpen && "opacity-0",
                )}
                aria-label="Run in progress"
              >
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              </div>
            )}

            {/* Actions: Stop (if running) + the rename/delete menu. ALWAYS rendered and
                CSS-gated — hidden at rest (opacity-0), revealed on hover OR keyboard
                focus-within (or while the options menu is open) so a keyboard-only user
                can Tab to them (A11Y-01). The gradient scrim fades a long title out
                behind the buttons so they never visually collide with the text. */}
            <div
              className={cn(
                "absolute inset-y-0 right-0 flex items-center gap-1 pl-10 pr-1.5 bg-gradient-to-l from-sidebar via-sidebar to-transparent rounded-r-lg",
                "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                isMenuOpen && "opacity-100",
              )}
            >
              {isRunning && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void streamActions.stopThread(thread.id)
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-destructive/40 text-destructive bg-destructive/15 hover:bg-destructive/25 transition-colors"
                  aria-label="Stop run"
                >
                  <Square className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent hover:bg-muted cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(isMenuOpen ? null : thread.id)
                }}
                aria-label="Thread options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Dropdown menu */}
        {isMenuOpen && (
          <div
            className="absolute right-2 top-full mt-0.5 z-50 w-36 rounded-lg ghost-border bg-popover shadow-lg shadow-black/20 py-1"
            onMouseLeave={() => setMenuOpenId(null)}
          >
            <button
              onClick={() => startRename(thread)}
              className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </button>
            <button
              onClick={() => { setMenuOpenId(null); setDeleteConfirmId(thread.id) }}
              className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
              aria-label="Delete Thread"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  // SC#2 (inline tier): substring filter over the loaded threads via the shared
  // predicate; SC#3: date grouping of the filtered set (empty buckets folded away).
  // D-04 (OPTIONAL): the Folder view swaps date buckets for folder groups; DATE stays
  // the default, so SC#3 is satisfied by an untouched column.
  const filtered = threads.filter((t) => matchesTitle(t, query))
  const groups: { label: string; items: Thread[] }[] =
    groupMode === "folder" ? groupByFolder(filtered, folders) : groupByDate(filtered)

  return (
    <div className="hidden md:flex flex-col w-[300px] shrink-0 bg-sidebar border-r border-border/20">
      {/* hc-top: title + New + folder-scope picker + the inline filter */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex flex-col gap-2.5 border-b border-border/10 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-headline text-lg font-semibold text-sidebar-foreground m-0">
            Chats
          </h2>
          <div className="flex items-center gap-1">
            {/* SEED-064: cross-thread active-runs counter + Stop tray (null when idle). */}
            <ActiveRunsTray threads={threads} />
            <button
              type="button"
              onClick={() => {
                onNewThread(selectedFolderId)
                setShowFolderPicker(false)
              }}
              className="flex p-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              title="New Chat"
              aria-label="New chat"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {folders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFolderPicker((prev) => !prev)}
                className={cn(
                  "flex p-1 rounded-md transition-colors items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  showFolderPicker
                    ? "bg-accent text-primary"
                    : "hover:bg-accent/40 text-muted-foreground hover:text-sidebar-foreground",
                )}
                title="Choose folder"
                aria-label="Choose folder"
              >
                <FolderIcon className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {showFolderPicker && folders.length > 0 && (
          <div className="px-0.5">
            <select
              value={selectedFolderId ?? ""}
              onChange={(e) => setSelectedFolderId(e.target.value || null)}
              aria-label="Scope new chat to a folder"
              className="w-full text-xs rounded-lg px-2 py-1.5 bg-card text-foreground ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            >
              <option value="">All documents</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Scope this chat to a folder
            </p>
          </div>
        )}

        {/* Inline "Filter this list…" box (SC#2) — sketch .search + focus-within ring. */}
        <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-card border border-border/30 transition-all focus-within:ring-2 focus-within:ring-primary/30">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter this list…"
            aria-label="Filter chats"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          {/* Phase 156 Wave 2 (Plan 03): the ⌘K chip — opens the global finder (the
              column filters what you're looking at; ⌘K jumps anywhere, Sketch 078-D). The
              inline filter above is unchanged; this is purely additive. Optional seam —
              rendered only when the layout wires onOpenPalette. */}
          {onOpenPalette && (
            <button
              type="button"
              onClick={onOpenPalette}
              title="Search all chats (⌘K)"
              aria-label="Search all chats"
              className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
                ⌘K
              </span>
            </button>
          )}
        </div>

        {/* Phase 156 Wave 3 (Plan 04 / D-04, OPTIONAL): the Date⇄Folder group toggle
            (sketch .seg). DEFAULTS to Date so SC#3 is unaffected; Folder groups rows by
            folder name ("Unfiled" last). aria-pressed = the app's toggle-button idiom. */}
        <div
          className="inline-flex self-start rounded-full bg-card ghost-border p-0.5"
          role="group"
          aria-label="Group chats by"
        >
          {(["date", "folder"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGroupMode(mode)}
              aria-pressed={groupMode === mode}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                groupMode === mode
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-sidebar-foreground",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* hc-list: date-grouped rows, or the honest empty-state. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10 px-3">
            {query.trim() ? "No chats match your search." : "No recent chats"}
          </p>
        ) : (
          groups.map((group, gi) => (
            // key includes the index so two folders that share a name (Folder view)
            // never collide on a duplicate React key (HI-01); date-bucket labels are
            // already unique so this is a no-op for the default Date view.
            <div key={`${group.label} ${gi}`} className="mb-1">
              <div className="sticky top-0 z-[2] flex items-center gap-[7px] px-2 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground bg-sidebar">
                <span className="flex-1">{group.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 rounded-full">
                  {group.items.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((thread) => renderRow(thread))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog — lifted verbatim from NavPanel. */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This will permanently delete this thread and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteConfirmId) {
                  await onDeleteThread(deleteConfirmId)
                  setDeleteConfirmId(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
