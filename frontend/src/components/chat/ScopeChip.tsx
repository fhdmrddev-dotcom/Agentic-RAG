/**
 * Phase 268 plan 03 (CHAT-08 · D-268-12c / D-268-12d / UI-SPEC §5.2) — the composer's scope chip:
 * what this thread searches, at rest, and the door to change it.
 *
 * Mounted in `MessageInput`'s chip row right after `ActiveExpertChip` (Expert, scope, connectors — the
 * sketch's order), and only on an existing thread; a brand-new chat keeps ChatArea's `<select>`.
 *
 * States (§5.2): S1 normal (indigo) · S2 held (dashed, `· not searched` VISIBLE at rest) · S3 a PATCH
 * in flight (spinner, `aria-busy`) · S4 a folder the caller cannot see (the shipped phrase + EyeOff) ·
 * S5 the payload has not loaded (S1 styling, NO suffix — the chip never claims `not searched` without
 * the server saying so).
 *
 * ⛔ `held` IS THE SERVER'S WORD (`ScopeEffect.held`). This leaf never reads the Expert's mode; a
 * `?raw` fence in `ScopePicker.test.tsx` pins the absence. The folder PATH in the label is
 * presentation from the caller's own folder list, never a scope decision.
 */
import { useState } from "react"
import { ChevronDown, EyeOff, Folder as FolderGlyph, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ScopeEffect } from "@/lib/api/threads"
import type { Folder } from "@/types"
import { cn } from "@/lib/utils"
import { SCOPE_COPY, chipLabel } from "./scopeCopy"
import { ScopePicker } from "./ScopePicker"

/** The `ActiveExpertChip` container family, so the two chips read as one control set (§2). */
const BASE =
  "text-xs font-medium rounded-md px-2.5 py-1 min-h-6 flex items-center gap-1.5 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
const NORMAL =
  "border-indigo-600/40 dark:border-indigo-500/40 bg-indigo-500/10 dark:bg-indigo-500/[0.18] text-indigo-700 dark:text-indigo-200 hover:border-indigo-600/60 dark:hover:border-indigo-400/60"
const HELD = "border-dashed border-border bg-transparent text-muted-foreground"

export interface ScopeChipProps {
  threadId: string
  /** The thread's saved folder (null = All your documents). */
  folderId: string | null
  /** The caller's folders — for the label's path and the picker's tree. */
  folders: Folder[]
  /** The thread's at-rest ScopeEffect; `null` = not loaded (S5). */
  effect: ScopeEffect | null
  /** This thread is streaming an answer. */
  streaming: boolean
  /** ChatArea's one scope PATCH home. Rejects with the reason sentence on a refusal. */
  onApply: (next: string | null) => Promise<void>
}

export function ScopeChip({ threadId, folderId, folders, effect, streaming, onApply }: ScopeChipProps) {
  const [open, setOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const label = chipLabel(folderId, folders)
  const held = effect?.held === true && effect.expert != null
  const name = held
    ? SCOPE_COPY.chipAriaHeld(label.full, effect?.expert?.name ?? "")
    : SCOPE_COPY.chipAria(label.full)
  const Glyph = label.unnamed ? EyeOff : FolderGlyph

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        // S3: while a PATCH is in flight the menu neither closes nor re-opens.
        if (!applying) setOpen(next)
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="scope-chip"
          aria-label={name}
          title={name}
          aria-busy={applying || undefined}
          className={cn(BASE, held ? HELD : NORMAL)}
        >
          <Glyph className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span className="min-w-0 max-w-[18rem] truncate font-mono">{label.label}</span>
          {applying ? (
            <Loader2 className="h-3 w-3 flex-none animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3 flex-none" aria-hidden="true" />
          )}
          {held && (
            <span className="flex-none text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {SCOPE_COPY.heldSuffix}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      {open && (
        <ScopePicker
          threadId={threadId}
          savedFolderId={folderId}
          folders={folders}
          streaming={streaming}
          applying={applying}
          onApplyingChange={setApplying}
          onApply={onApply}
          onDone={() => setOpen(false)}
        />
      )}
    </DropdownMenu>
  )
}
