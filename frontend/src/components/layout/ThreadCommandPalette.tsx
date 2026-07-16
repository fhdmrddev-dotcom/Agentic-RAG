import { useEffect, useId, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { MessageSquare, Search } from "lucide-react"
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
// Phase 156 (POLISH-01 / D-03 / D-05, Wave 2) — the global ⌘K command palette.
//
// HAND-ROLLED on the existing Radix ui/dialog.tsx (D-05 fallback — NOT cmdk; the
// unattended run forbids the install-gating checkpoint, hard-directive 1). Radix
// Dialog owns focus-trap + Esc + aria-modal + scroll-lock + focus-restore for free;
// this component owns ONLY the filtered listbox roving (role="listbox"/"option",
// ↑↓ moves the active option, ↵ opens, click selects — Esc is Radix's).
//
// It reuses the ONE shared engine (matchesTitle + groupByDate + the XSS-safe
// HighlightTitle — T-156-01) so the palette and the inline column filter behave
// identically over the SAME threads. It is StreamsProvider-free (reads only threads +
// two callbacks) so it mounts once at the ChatLayout root and renders in tests without
// a provider — and, over the Wave-1 app-wide loadThreads, is never empty off-chat
// (RESEARCH Pitfall 1).
import { groupByDate, matchesTitle, HighlightTitle } from "@/lib/threadGroups"
import { cn } from "@/lib/utils"
import type { Thread } from "@/types"
import type { ActiveView } from "@/App"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  threads: Thread[]
  onSelectThread: (thread: Thread) => void
  onNavigate: (view: ActiveView) => void
}

export function ThreadCommandPalette({
  open,
  onOpenChange,
  threads,
  onSelectThread,
  onNavigate,
}: Props) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Stable, collision-free ids for the combobox ↔ listbox ↔ option ARIA wiring.
  const baseId = useId()
  const listId = `${baseId}-listbox`
  const optionId = (threadId: string) => `${baseId}-opt-${threadId}`

  // Fresh palette on every open: clear the query and reset the active row so a new
  // ⌘K always starts at the top with an empty search (matches the sketch focus reset).
  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
    }
  }, [open])

  // Any query change re-filters the result set — snap the active row back to the top.
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // The SAME predicate + grouping as the inline column filter (fidelity). `flat` is the
  // visible options in DOM/visual order — the roving index maps into it 1:1.
  const filtered = threads.filter((t) => matchesTitle(t, query))
  const groups = groupByDate(filtered)
  const flat = groups.flatMap((g) => g.items)
  const active = flat.length ? Math.min(activeIndex, flat.length - 1) : -1
  const activeDescendant = active >= 0 ? optionId(flat[active].id) : undefined

  // Keep the active option scrolled into view as ↑↓ moves it (guarded — jsdom has no
  // layout and does not implement scrollIntoView).
  useEffect(() => {
    if (!open || activeDescendant == null) return
    const el = typeof document !== "undefined" ? document.getElementById(activeDescendant) : null
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" })
  }, [activeDescendant, open])

  function selectAt(index: number) {
    const thread = flat[index]
    if (!thread) return
    onSelectThread(thread)
    onNavigate("chat")
    onOpenChange(false)
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // We hand-own ONLY the listbox roving. Escape is Radix Dialog's (close +
    // focus-restore); ArrowDown/Up must not scroll the page (preventDefault).
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min((flat.length ? Math.min(i, flat.length - 1) : 0) + 1, Math.max(flat.length - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max((flat.length ? Math.min(i, flat.length - 1) : 0) - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      selectAt(active)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-50 bg-black/55 backdrop-blur-sm" />
        <DialogPrimitive.Content
          // Radix would focus the content first; steer the initial focus straight to
          // the search input so the user can type immediately.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
          // The palette is title-labelled (sr-only DialogTitle below) but intentionally
          // has no description — opt out of Radix's description warning explicitly.
          aria-describedby={undefined}
          className={cn(
            "fixed left-[50%] top-[74px] z-50 flex max-h-[520px] w-[min(600px,88%)] translate-x-[-50%] flex-col overflow-hidden",
            "rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-black/40 outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          {/* Radix requires a titled dialog for its accessible name — visually hidden. */}
          <DialogTitle className="sr-only">Search all chats</DialogTitle>

          {/* cmdk-search: the query input (a combobox controlling the listbox below). */}
          <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3.5">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
              aria-label="Search all chats"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={`Search all ${threads.length} chats…`}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <span className="rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">
              esc
            </span>
          </div>

          {/* cmdk-results: date-grouped options, or the honest empty-state. */}
          <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
            <div id={listId} role="listbox" aria-label="All chats">
              {groups.map((group) => (
                <div
                  key={group.label}
                  role="group"
                  aria-label={`${group.label}, ${group.items.length} chats`}
                  className="mb-1 flex flex-col gap-0.5"
                >
                  <div
                    aria-hidden="true"
                    className="sticky top-0 z-[2] flex items-center gap-[7px] bg-popover px-2 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground"
                  >
                    <span className="flex-1">{group.label}</span>
                    <span className="rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                      {group.items.length}
                    </span>
                  </div>
                  {group.items.map((thread) => {
                    const flatIndex = flat.indexOf(thread)
                    const isActive = flatIndex === active
                    return (
                      <div
                        key={thread.id}
                        id={optionId(thread.id)}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => selectAt(flatIndex)}
                        onMouseMove={() => setActiveIndex(flatIndex)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate" title={thread.title}>
                          <HighlightTitle title={thread.title} query={query} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {flat.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                No chats match your search.
              </p>
            )}
          </div>

          {/* cmdk-foot: the keyboard-forward hints (sketch .cmdk-foot). */}
          <div className="flex items-center gap-4 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
            <span>
              <span className="mr-1 rounded border border-border px-1 font-mono">↑↓</span>navigate
            </span>
            <span>
              <span className="mr-1 rounded border border-border px-1 font-mono">↵</span>open
            </span>
            <span>
              <span className="mr-1 rounded border border-border px-1 font-mono">esc</span>close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
