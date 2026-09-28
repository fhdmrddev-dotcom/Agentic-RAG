/**
 * Phase 268 plan 03 (CHAT-08 · D-268-12c / UI-SPEC §5.3, §8.4) — the scope chip's picker.
 *
 * ⭐ THE EFFECT IS STATED BEFORE APPLY. Every draft is previewed by the server
 * (`GET /threads/{id}/scope-effect`, one request per selection, latest wins) and the ledger renders
 * THAT payload: `Next message searches` / `Stops searching`, or `Saved` / `Searching` when an active
 * Restricted Expert holds the change (Save & say — nothing is blocked). ⛔ This leaf never reads the
 * Expert's mode: `held` comes from the payload, and the explain words come from `explainFor`
 * (`scopeCopy.ts`). A `?raw` fence in `ScopePicker.test.tsx` pins the absence.
 *
 * ⛔ RADIX MENU TRAPS TAB (§8.4). The tree nodes are radio items and Cancel / Apply / Try again are
 * menu items — a plain `<button>` inside this content would be unreachable by keyboard
 * (`AttentionPopover`'s pattern is wrong here). Selecting a node or pressing Apply calls
 * `preventDefault`, so the menu stays open; Cancel / Esc / an outside click discard the draft.
 *
 * ⛔ IT WRITES NOTHING. Apply hands the draft to `onApply` — ChatArea's one scope PATCH home — and a
 * refusal is stated here, in the menu, while the chip it hangs from never moved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Folder as FolderGlyph, Loader2 } from "lucide-react"
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { ScopeLedger } from "@/components/experts/ScopeLedger"
import { getScopeEffect } from "@/lib/api"
import type { ScopeEffect } from "@/lib/api/threads"
import type { Folder } from "@/types"
import { cn } from "@/lib/utils"
import { SCOPE_COPY, chipLabel, explainFor, ledgerColumnsFor } from "./scopeCopy"

/** The radio value of the tree root ("All your documents" — clears the folder). */
const ROOT = "__all__"

type Preview = { status: "loading" } | { status: "ready"; effect: ScopeEffect } | { status: "error" }

interface TreeNode {
  folder: Folder
  depth: number
}

/** The caller's folders nested by `parent_id`, each level sorted by name. Cycle-safe; an orphan
 *  (parent not in the list) sits at the top level. */
function flattenTree(folders: Folder[]): TreeNode[] {
  const ids = new Set(folders.map((f) => f.id))
  const byParent = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const parent = f.parent_id && ids.has(f.parent_id) ? f.parent_id : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), f])
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  const out: TreeNode[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number) => {
    for (const f of byParent.get(parent) ?? []) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      out.push({ folder: f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

const NODE =
  "min-h-[44px] sm:min-h-0 gap-1 rounded-md py-2 pr-2 text-xs leading-relaxed [&>span:first-child]:hidden"
const SELECTED = "bg-indigo-500/10 dark:bg-indigo-500/[0.18] text-indigo-700 dark:text-indigo-200"
const ACTION = "min-h-[44px] sm:min-h-0 justify-center rounded-md px-3 py-1.5 text-xs font-semibold"

export interface ScopePickerProps {
  threadId: string
  /** The thread's saved folder (null = All your documents). */
  savedFolderId: string | null
  folders: Folder[]
  /** This thread is streaming an answer — the sub-line says that answer keeps its scope. */
  streaming: boolean
  /** A PATCH is in flight (owned by the chip, which also shows it). */
  applying: boolean
  onApplyingChange: (applying: boolean) => void
  onApply: (next: string | null) => Promise<void>
  /** Close the menu after a successful Apply. */
  onDone: () => void
}

export function ScopePicker({
  threadId,
  savedFolderId,
  folders,
  streaming,
  applying,
  onApplyingChange,
  onApply,
  onDone,
}: ScopePickerProps) {
  const saved = savedFolderId ?? ROOT
  const [draft, setDraft] = useState<string>(saved)
  const [preview, setPreview] = useState<Preview>({ status: "loading" })
  const [refusal, setRefusal] = useState<string | null>(null)
  const reqRef = useRef(0)
  const savedNodeRef = useRef<HTMLDivElement>(null)
  const tree = useMemo(() => flattenTree(folders), [folders])

  // One request per selection; a stale answer is dropped (latest wins, T-268-27). The saved folder
  // is read AT REST (no draft param), so a folder the caller can no longer see still states itself.
  const requestPreview = useCallback(
    (value: string) => {
      const req = ++reqRef.current
      setPreview({ status: "loading" })
      new Promise<ScopeEffect>((resolve) =>
        resolve(
          value === saved
            ? getScopeEffect(threadId)
            : getScopeEffect(threadId, { folderId: value === ROOT ? null : value }),
        ),
      ).then(
        (effect) => {
          if (req === reqRef.current) setPreview({ status: "ready", effect })
        },
        () => {
          if (req === reqRef.current) setPreview({ status: "error" })
        },
      )
    },
    [threadId, saved],
  )

  useEffect(() => {
    requestPreview(saved)
    // On open the draft is the saved folder, and focus lands on its node (UI-SPEC §5.3).
    const raf = requestAnimationFrame(() => savedNodeRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [requestPreview, saved])

  const draftId = draft === ROOT ? null : draft
  const draftLabel = chipLabel(draftId, folders).full
  const savedLabel = chipLabel(savedFolderId, folders).full
  const ready = preview.status === "ready" ? preview.effect : null
  const explain = ready ? explainFor(ready, draftLabel) : null
  const canApply = ready !== null && draft !== saved && !applying

  const choose = (value: string) => {
    if (applying || value === draft) return
    setDraft(value)
    setRefusal(null)
    requestPreview(value)
  }

  const apply = async () => {
    if (!canApply) return
    setRefusal(null)
    onApplyingChange(true)
    try {
      await onApply(draftId)
    } catch (err) {
      onApplyingChange(false)
      const reason = err instanceof Error && err.message.trim() ? err.message : SCOPE_COPY.networkReason
      setRefusal(SCOPE_COPY.refusal(reason, savedLabel))
      return
    }
    onApplyingChange(false)
    onDone()
  }

  const node = (value: string, label: string, depth: number, isSaved: boolean) => {
    const selected = draft === value
    return (
      <DropdownMenuRadioItem
        key={value}
        ref={isSaved ? savedNodeRef : undefined}
        value={value}
        data-testid={`scope-picker-node-${value === ROOT ? "all" : value}`}
        disabled={applying}
        onSelect={(e) => e.preventDefault()}
        style={{ paddingLeft: 8 + 16 * depth }}
        className={cn(NODE, selected && SELECTED)}
      >
        <FolderGlyph className="h-3 w-3 flex-none" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {isSaved && <span className="flex-none text-[11px] text-muted-foreground">{SCOPE_COPY.current}</span>}
        {selected && <Check className="h-3 w-3 flex-none text-indigo-700 dark:text-indigo-200" aria-hidden="true" />}
      </DropdownMenuRadioItem>
    )
  }

  return (
    <DropdownMenuContent
      side="top"
      align="start"
      sideOffset={8}
      data-testid="scope-picker"
      className="w-[380px] max-w-[calc(100vw-2rem)] p-3"
    >
      <p className="text-sm font-semibold leading-snug text-foreground">{SCOPE_COPY.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {streaming ? SCOPE_COPY.subStreaming : SCOPE_COPY.subIdle}
      </p>

      <div className="mt-3 max-h-[224px] overflow-y-auto rounded-lg border border-border/60 p-1">
        <DropdownMenuRadioGroup value={draft} onValueChange={choose}>
          {node(ROOT, SCOPE_COPY.allDocuments, 0, saved === ROOT)}
          {tree.map(({ folder, depth }) => node(folder.id, folder.name, depth, saved === folder.id))}
        </DropdownMenuRadioGroup>
      </div>

      {preview.status === "loading" && (
        <div
          role="status"
          className="mt-3 flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground"
        >
          <Loader2 className="h-3 w-3 flex-none animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {SCOPE_COPY.loading}
        </div>
      )}

      {preview.status === "error" && (
        <div
          role="alert"
          data-testid="scope-picker-error"
          className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <span>{SCOPE_COPY.previewError}</span>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              requestPreview(draft)
            }}
            className="flex-none px-2 py-1 text-xs font-semibold text-foreground"
          >
            {SCOPE_COPY.tryAgain}
          </DropdownMenuItem>
        </div>
      )}

      {ready && (
        <div data-testid="scope-picker-ledger">
          <ScopeLedger columns={ledgerColumnsFor(ready, draftLabel)} />
        </div>
      )}

      {explain && explain.tone === "info" && (
        <p className="mt-3 rounded-r-md border-l-2 border-indigo-600 bg-indigo-500/10 px-3 py-2 text-xs leading-relaxed text-foreground dark:border-indigo-400">
          {explain.text}
        </p>
      )}
      {explain && explain.tone === "held" && (
        <p className="mt-3 rounded-r-md border-l-2 border-amber-600 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground dark:border-amber-400">
          <span className="font-semibold">{explain.lead}</span>
          {explain.text}
        </p>
      )}

      {refusal && (
        <p
          role="alert"
          data-testid="scope-refusal"
          className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
        >
          {refusal}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <DropdownMenuItem data-testid="scope-picker-cancel" disabled={applying} className={cn(ACTION, "text-foreground")}>
          {SCOPE_COPY.cancel}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="scope-picker-apply"
          disabled={!canApply}
          aria-busy={applying || undefined}
          onSelect={(e) => {
            e.preventDefault()
            void apply()
          }}
          className={cn(ACTION, "bg-primary text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground")}
        >
          {applying && <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {applying ? SCOPE_COPY.applying : SCOPE_COPY.apply}
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  )
}
