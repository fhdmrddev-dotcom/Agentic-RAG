/**
 * Phase 244 plan 05 Task 1 (SHELL-04 / D-244-22 / D-244-25 / D-244-26) —
 * THE FILE THAT BELONGS TO THIS CHAT, said where the file is.
 *
 * ONE component, THREE states. Sketch 236's winner is **A — Scope on the chip** (operator,
 * 2026-09-11), and its whole rationale is durability: *"a menu is read once and closed, a chip is
 * still on screen while the person types and survives into the transcript."*
 *
 * ⛔ SO THE SCOPE WORD IS RENDERED IN THE `sent` STATE TOO, not only in `pending`. D-244-22,
 * verbatim: *"a build that puts it solely in the composer has shipped B's weakness with A's
 * cost."* This is the most skippable-looking line in the plan and it is the reason A won.
 *
 * ⛔ EVERY STRING COMES FROM `composerCopy` — a PORT of the sketch's own `COPY.js`. There are no
 * user-visible string literals in this file: the scope sentence resolves from `COPY.a.chipScope` /
 * `COPY.a.sentNote` and appears nowhere in the JSX.
 * ⚠ THAT CLAIM IS NOT GREPPABLE NAIVELY, and the near-miss is worth recording. This docblock used
 * to spell the sentence out and assert its own `grep -c` was 0 — which it was not, because the
 * assertion contained the sentence. Prose about code is not code. `grep` this file with comments
 * stripped (`__tests__/ChatAttachmentChip.states.test.tsx`'s `code()` helper does exactly that),
 * or the claim measures the docblock instead of the render.
 *
 * ⚠ `expired` IS DERIVED, NEVER PASSED. D-244-04 made the TTL a READ GATE rather than a delete
 * sweeper: the row survives invisibly and the file simply stops resolving, so a week-old
 * transcript holds a chip pointing at nothing. The caller cannot know that — the `expires_at` on
 * the row does — so the component reads it. What it must never do is vanish: an attachment that
 * silently disappears from an old transcript is the repudiation threat (T-244-05-05).
 *
 * ⚠ AND THE READING IS IMPORTED, NOT RE-DERIVED. `expiryCaption` lives in
 * `components/panel/FilesSection.tsx` and carries THREE readings plus a total return type:
 * ABSENT → `expiry unknown` (the wire did not say), UNPARSEABLE → the SAME third case, otherwise
 * a real countdown. That function has been wrong twice already (a blank, then "expires in NaNm");
 * a second copy of its rules here is how the panel and the chat come to disagree.
 * ⛔ The word is `expiry unknown`, NEVER `no expiry` — "no expiry" is a KNOWN-NONE, a claim
 * nobody made — and the unknown reading is NOT amber: painting an absent field amber
 * manufactures an alarm out of a missing value.
 *
 * ⛔ NO `dangerouslySetInnerHTML` and no hand-drawn mark. The filename is attacker-controlled
 * text (T-244-05-03): React escapes it as a text node, and the row is bounded by
 * `truncate max-w-[140px]` — the `ActiveConnectorChips` template — so a 4 KB filename cannot
 * displace the composer. The icon is `@/lib/fileIcon`, the ONE per-extension mark
 * (`references/icon-convention.md` — *"inventing a canvas mark when a shipped one exists"* is
 * the named failure).
 */

import { X } from "lucide-react"
import { fileIcon } from "@/lib/fileIcon"
import { formatBytes } from "@/lib/formatBytes"
import { expiryCaption } from "@/components/panel/FilesSection"
import { COPY } from "./composerCopy"
import { cn } from "@/lib/utils"
import type { WorkspaceFile } from "@/types"

/** The state the CALLER knows. `expired` is derived here and can override either of them. */
export type ChatAttachmentChipState = "pending" | "sent"

export interface ChatAttachmentChipProps {
  file: WorkspaceFile
  state: ChatAttachmentChipState
  /** Only meaningful while `pending` — the sent chip is read-only by construction. */
  onRemove?: () => void
}

/**
 * The EFFECTIVE state of a chip, derived from the row the server sent.
 *
 * ⚠ Exported because `MessageItem` needs the same answer for a transcript row and must not
 * re-implement it — one rule, two readers, the same discipline `expiryCaption` itself carries.
 */
export function chatAttachmentState(
  file: WorkspaceFile,
  requested: ChatAttachmentChipState,
): "pending" | "sent" | "expired" {
  return expiryCaption(file.expires_at) === "expired" ? "expired" : requested
}

/** The display name of an attachment. `path` is the workspace-relative name the server stamped. */
export function attachmentDisplayName(file: WorkspaceFile): string {
  const segments = file.path.split("/")
  return segments[segments.length - 1] || file.path
}

export function ChatAttachmentChip({ file, state, onRemove }: ChatAttachmentChipProps) {
  const effective = chatAttachmentState(file, state)
  const name = attachmentDisplayName(file)
  const caption = expiryCaption(file.expires_at)

  // The drawn TTL word for the ordinary case; the honest reading when the wire did not say.
  // ⛔ Never a per-second countdown — `FilesSection` computes on render with NO timer, and the
  // sketch draws a flat `24h`, which is the PROMISE, not a clock.
  const expiryWord = caption === COPY.engine.TTL_HOURS + "h" || caption.startsWith("expires in")
    ? COPY.a.chipTtl
    : caption

  const base = cn(
    "inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-full text-xs font-medium",
    "bg-background border border-border/80 shadow-xs text-foreground",
    "hover:border-border transition-colors animate-in fade-in zoom-in-95 duration-150",
  )

  if (effective === "expired") {
    return (
      <span
        data-testid="chat-attachment-chip"
        data-chip-state="expired"
        title={COPY.shared.expiredWhy}
        className={cn(base, "border-dashed opacity-60")}
      >
        {fileIcon(name, 13, { ribbon: false, tone: "inherit" })}
        <span data-chip-name className="truncate max-w-[140px] line-through">
          {name}
        </span>
        <span data-chip-expiry className="text-muted-foreground">
          {COPY.shared.expiredChip}
        </span>
      </span>
    )
  }

  return (
    <span data-testid="chat-attachment-chip" data-chip-state={effective} className={base}>
      {fileIcon(name, 13, { ribbon: false, tone: "inherit" })}
      <span data-chip-name className="truncate max-w-[140px]">
        {name}
      </span>
      <span className="text-muted-foreground">{formatBytes(file.size_bytes)}</span>
      {/* ⭐ D-244-22 — rendered in BOTH states. `sentNote` and `chipScope` are the same
          sentence in the port precisely so the transcript cannot quietly say something else. */}
      <span
        data-chip-scope
        className="pl-1.5 border-l border-border/60 text-muted-foreground"
      >
        {effective === "sent" ? COPY.a.sentNote : COPY.a.chipScope}
      </span>
      <span data-chip-expiry className="text-muted-foreground">
        {expiryWord}
      </span>
      {effective === "pending" && onRemove && (
        <button
          type="button"
          data-chip-remove
          aria-label={`${COPY.a.chipRemove} ${name}`}
          onClick={onRemove}
          className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
