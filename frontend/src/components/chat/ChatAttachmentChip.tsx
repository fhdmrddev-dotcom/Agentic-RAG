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

/**
 * ── THE DETACH REGISTRY (Phase 244 / 244-05 T2) ─────────────────────────────────────────
 *
 * ⚠ REMOVE IS A DETACH, NOT A DELETE, AND SAYING SO IS THE HONEST PART.
 * `backend/app/api/workspace.py` ships SIX routes and **none of them is a DELETE** — measured at
 * this base: one `POST /files` and five GETs. So a file the person "removes" from the composer is
 * still in `workspace_files`, still inside its 24h read gate, and still hydrated into
 * `/sandbox/attachments/` for this thread by `244-02`. What removal can honestly mean is
 * therefore: *this file is not part of the message I am about to send.*
 *
 * This registry is what carries that from the composer to the transcript. It is module-scoped and
 * SESSION-SCOPED — the same shape as `composerDraftsByThread` and `activeConnectorsByThread`,
 * which sit in `MessageInput.tsx` for the same reason.
 *
 * ⛔ ITS LIMIT, STATED RATHER THAN HIDDEN: after a hard reload, within the TTL, a detached file
 * falls back inside the time window and re-associates with the next sent message. The honest
 * close is a DELETE route on the workspace door — backend scope this plan does not carry — and
 * until then the chip is at least TRUE (the file does belong to this chat, and the agent can read
 * it). ⛔ Do not "fix" this with a persisted client-side hide: that would claim the bytes are
 * gone when they are not, which is the one thing this whole surface exists to stop doing.
 */
const detachedByThread = new Map<string, Set<string>>()

export function detachAttachment(threadId: string, path: string): void {
  const set = detachedByThread.get(threadId) ?? new Set<string>()
  set.add(path)
  detachedByThread.set(threadId, set)
}

export function isAttachmentDetached(threadId: string, path: string): boolean {
  return detachedByThread.get(threadId)?.has(path) ?? false
}

/** Test-only: reset the module-scoped detach registry between cases. */
export function _resetDetachedAttachmentsForTest(): void {
  detachedByThread.clear()
}

/**
 * ── THE ASSOCIATION RULE (Phase 244 / 244-05 T3) ────────────────────────────────────────
 *
 * Which attachments belong to a SENT user message?
 *
 * ⛔ THE CONSTRAINT THAT PICKS THE RULE: it must survive a reload. D-244-22's whole reason for
 * choosing variant A is that *"reopening the chat tomorrow, the transcript still says
 * `this chat only`"*. A client-only field stamped at send time would satisfy every test in this
 * repo and **fail the requirement the day after**, because a message loaded from the database
 * carries no such field. ⛔ And a backend field is out: D-244-01 and the ROADMAP both say
 * `Migrations: none expected`.
 *
 * So the association is DERIVED from two things that are both persisted — the thread's
 * `workspace_files` rows (each with a `created_at`) and the messages' own `created_at` —
 * plus the session-scoped detach registry above.
 *
 * **The rule, stated once:** an upload belongs to the FIRST user message sent at or after it.
 * Equivalently, for user message `M` with predecessor user message `P`:
 *
 *     P.created_at  <  file.created_at  <=  M.created_at        (no lower bound if M is first)
 *
 * and the file is `kind === "template_input"` (what `workspace.py`'s upload route stamps —
 * ⛔ an AGENT-written workspace file is not an attachment and must never wear this chip) and is
 * not detached.
 *
 * ⚠ THE CONSEQUENCE, NAMED RATHER THAN DISCOVERED LATER: a file uploaded AFTER the last user
 * message belongs to no sent message. That is correct — it is still pending in the composer —
 * and it is why the composer holds its own list instead of reading this.
 *
 * ⚠ CLOCK SKEW IS A REAL EDGE HERE, and the boundary is chosen for it. `created_at` on the file
 * is stamped by Postgres; `created_at` on an optimistic user message is stamped by the client.
 * The `<=` upper bound is INCLUSIVE so a file and a message written in the same millisecond
 * associate rather than falling through to the next message; the lower bound is EXCLUSIVE so the
 * same file cannot land on two rows. ⛔ Never make both inclusive.
 *
 * ⚠ `previousUserMessageAt` IS A SCALAR ON PURPOSE, and it is the reason this function takes a
 * timestamp rather than the message list. `MessageItem` is `React.memo`'d so a 50-message thread
 * does not re-render every row on every stream delta; handing a row the messages ARRAY — as a
 * prop or as a selector result — reinstates that cost, because the array identity changes on
 * every delta. `StreamsProvider.usePreviousUserMessageAt` selects this one string instead.
 */
export function attachmentsForMessage(
  message: { role: string; created_at: string; thread_id?: string },
  /** The `created_at` of the USER message immediately before this one; `null` if it is the first. */
  previousUserMessageAt: string | null,
  files: readonly WorkspaceFile[],
): WorkspaceFile[] {
  if (message.role !== "user") return []

  const upper = new Date(message.created_at).getTime()
  if (Number.isNaN(upper)) return []
  const prev = previousUserMessageAt === null ? NaN : new Date(previousUserMessageAt).getTime()
  // ⚠ An UNPARSEABLE predecessor is NOT treated as "no predecessor" — that would widen the window
  // and hand this row every earlier attachment in the thread. It is treated as an unbounded lower
  // edge only when the predecessor is genuinely ABSENT (the first user message).
  const lower = previousUserMessageAt === null ? -Infinity : Number.isNaN(prev) ? upper : prev

  return files.filter((f) => {
    if (f.kind !== "template_input") return false
    if (!f.created_at) return false
    const at = new Date(f.created_at).getTime()
    if (Number.isNaN(at)) return false
    if (!(at > lower && at <= upper)) return false
    if (message.thread_id && isAttachmentDetached(message.thread_id, f.path)) return false
    return true
  })
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
