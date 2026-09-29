/**
 * Phase 268 plan 03 (CHAT-08 · D-268-12c / UI-SPEC §5.2-§5.4, §7.2) — THE ONE HOME for the words of
 * the composer's scope chip, its picker and the pending note.
 *
 * ⛔ ONE PAYLOAD DECIDES WHAT IS SEARCHED. The chip, the picker ledger and the transcript card render
 * from the server's `ScopeEffect` (`held` / `next` / `stops` / `saved`); nothing here re-derives the
 * Expert rule. `explainFor` is the ONE place the words `Biased` / `Restricted` are chosen, and it
 * chooses them from the payload's `expert` — so `ScopeChip.tsx` and `ScopePicker.tsx` never read the
 * Expert's mode at all (a `?raw` fence in `ScopePicker.test.tsx` pins that).
 *
 * ⛔ Shared literals are IMPORTED, never re-spelled: `All your documents` (`EVENT_COPY`),
 * `Chat attachments` (`LEDGER_COPY`), the unnameable-folder phrase (`UNNAMEABLE_FOLDER`).
 *
 * The folder PATH built here from the caller's `folders` list (`parent_id` chain) is presentation
 * only — the chip's label — never a scope decision.
 */
import type { ScopeEffect, ScopeTranscriptLine } from "@/lib/api/threads"
import type { LedgerColumn, LedgerItem } from "@/components/experts/ScopeLedger"
import { UNNAMEABLE_FOLDER } from "@/components/experts/catalog/ExpertDetailModal"
import { LEDGER_COPY } from "@/components/experts/catalog/expertCatalog"
import { EVENT_COPY, SCOPE_EVENT_COPY, scopeFolderLabel } from "./expertEventCopy"

/** The chip label truncates to `…/{last segment}` past this many characters (UI-SPEC §5.2). */
export const CHIP_LABEL_MAX = 32

export const SCOPE_COPY = {
  allDocuments: EVENT_COPY.allDocuments,
  chatAttachments: LEDGER_COPY.chatAttachments,
  unnameable: UNNAMEABLE_FOLDER,
  heldSuffix: "· not searched",
  chipAria: (label: string): string => `Search scope: ${label}. Change folder`,
  chipAriaHeld: (label: string, expert: string): string =>
    `Search scope: ${label}, not searched while ${expert} is active. Change folder`,
  title: "Search in",
  subIdle: "Applies from your next message. Earlier answers keep their sources.",
  subStreaming: "The answer in progress keeps its scope. This applies from your next message.",
  current: "current",
  ledger: {
    next: "Next message searches",
    stops: "Stops searching",
    saved: "Saved",
    searching: "Searching",
  },
  nothingChanges: "Nothing changes",
  expertTag: "Expert",
  loading: "Checking what your next message will search…",
  previewError: "Couldn't check what your next message will search.",
  tryAgain: "Try again",
  apply: "Apply",
  applying: "Applying…",
  cancel: "Cancel",
  refusal: (reason: string, saved: string): string =>
    `Couldn't change the folder. ${reason} This chat still searches ${saved}.`,
  networkReason: "The server could not be reached.",
  // 268-REVIEW iter-2 WR-01: a 409 means another tab moved the folder first. State what is in effect
  // NOW (from the re-read thread), never the folder this client last saw.
  conflict: (current: string): string =>
    `The folder changed while you were choosing — this chat now searches ${current}. Pick again.`,
  conflictHeld: (current: string, expert: string): string =>
    `The folder changed while you were choosing — ${current} is now saved for when ${expert} leaves. Pick again.`,
  conflictUnknown: "The folder changed while you were choosing. Pick again.",
  pending: (old: string, next: string): string =>
    `The answer in progress keeps searching ${old}. ${next} applies from your next message.`,
  pendingHeld: (next: string, expert: string): string =>
    `The answer in progress keeps its scope. ${next} is saved for when ${expert} leaves.`,
  biasedExplain: (expert: string): string =>
    `${expert} is Biased, so it adds its own folder to whatever you pick here.`,
  heldLead: (expert: string): string => `No effect while ${expert} is active.`,
  heldRest: (folders: string, draft: string, expert: string): string =>
    ` Restricted reads ${folders} only. ${draft} is saved and is searched once ${expert} leaves.`,
} as const

/**
 * 268-REVIEW iter-2 WR-01: the scope PATCH lost a race (409). Its `message` is the FINISHED refusal
 * sentence, built from the re-read thread by the ONE scope PATCH home (ChatArea) — the picker shows it
 * as-is and never appends the stale "still searches" line.
 */
export class ScopeConflictError extends Error {}

/** `A` · `A and B` · `A, B and C` (the 267 gate-line rule). */
export function joinFolders(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

interface FolderLike {
  id: string
  name: string
  parent_id?: string | null
}

/** A folder's full path from the caller's list (`"Client ACME/Q3 Contracts"`), or null when the id
 *  is not in the list (a folder the caller cannot see). Cycle-safe. */
export function folderPathOf(folderId: string | null | undefined, folders: FolderLike[]): string | null {
  if (!folderId) return null
  const byId = new Map(folders.map((f) => [f.id, f]))
  const parts: string[] = []
  const seen = new Set<string>()
  let cur: string | null | undefined = folderId
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const f = byId.get(cur)
    if (!f) break
    parts.push(f.name)
    cur = f.parent_id
  }
  return parts.length ? parts.reverse().join("/") : null
}

export interface ChipLabel {
  /** What the chip shows (truncated past 32 characters). */
  label: string
  /** The full text — the accessible name and `title` always carry it. */
  full: string
  /** True = a folder the caller cannot see (S4). */
  unnamed: boolean
}

/** The chip's label for a saved folder id (UI-SPEC §5.2): `All your documents` / `/{path}` /
 *  `…/{last}` past 32 characters / the unnameable phrase. */
export function chipLabel(folderId: string | null | undefined, folders: FolderLike[]): ChipLabel {
  if (!folderId) return { label: SCOPE_COPY.allDocuments, full: SCOPE_COPY.allDocuments, unnamed: false }
  const path = folderPathOf(folderId, folders)
  if (!path) return { label: UNNAMEABLE_FOLDER, full: UNNAMEABLE_FOLDER, unnamed: true }
  const full = `/${path}`
  if (full.length <= CHIP_LABEL_MAX) return { label: full, full, unnamed: false }
  const last = path.split("/").pop() ?? path
  return { label: `…/${last}`, full, unnamed: false }
}

/** One scope line as ledger items: the Expert's folders (tagged `Expert` when an Expert is active),
 *  the thread folder as `/{path} ({n})`, the no-filter literal, then connections. */
function ledgerItems(line: ScopeTranscriptLine, opts: { expertTag: boolean; allLabel: string }): LedgerItem[] {
  const items: LedgerItem[] = []
  for (const f of line.folders ?? []) {
    const named = typeof f.name === "string" && f.name.trim()
    items.push({
      label: named ? (f.name as string) : UNNAMEABLE_FOLDER,
      unnameable: !named,
      tag: opts.expertTag ? SCOPE_COPY.expertTag : undefined,
    })
  }
  const tf = line.thread_folder
  if (tf) {
    const label = scopeFolderLabel(tf)
    if (label === UNNAMEABLE_FOLDER) items.push({ label, unnameable: true })
    else items.push({ label: tf.doc_count === null || tf.doc_count === undefined ? label : `${label} (${tf.doc_count})` })
  }
  if (line.all_documents) items.push({ label: opts.allLabel })
  for (const c of line.connections ?? []) items.push({ label: c })
  return items
}

/**
 * The picker ledger's columns, from the SERVER payload (UI-SPEC §5.3): held → `Saved` / `Searching`;
 * otherwise `Next message searches` / `Stops searching` (or the muted `Nothing changes`).
 * `Chat attachments` is pinned last in the searching column — it is never folded into `and k more`.
 */
export function ledgerColumnsFor(effect: ScopeEffect, draftLabel: string): LedgerColumn[] {
  const next: LedgerItem[] = [
    ...ledgerItems(effect.next, { expertTag: effect.expert != null, allLabel: SCOPE_COPY.allDocuments }),
    { label: SCOPE_COPY.chatAttachments, pinned: true },
  ]
  if (effect.held) {
    return [
      { tone: "held", heading: SCOPE_COPY.ledger.saved, items: [{ label: effect.saved ? scopeFolderLabel(effect.saved) : draftLabel }] },
      { tone: "yes", heading: SCOPE_COPY.ledger.searching, items: next },
    ]
  }
  const stops = ledgerItems(effect.stops, { expertTag: false, allLabel: SCOPE_EVENT_COPY.allOtherDocuments })
  return [
    { tone: "yes", heading: SCOPE_COPY.ledger.next, items: next },
    {
      tone: "no",
      heading: SCOPE_COPY.ledger.stops,
      items: stops.length ? stops : [{ label: SCOPE_COPY.nothingChanges, muted: true }],
    },
  ]
}

export interface ScopeExplain {
  tone: "info" | "held"
  /** Held only: the bold first sentence. */
  lead: string | null
  text: string
}

/**
 * The picker's explain box, from the SERVER payload. Held → the Save & say sentence naming the
 * Expert's folders and the draft; a Biased Expert → the union sentence; no Expert → none.
 * ⛔ `held` decides the held box; `expert.scope_mode` only chooses the Biased WORDS.
 */
export function explainFor(effect: ScopeEffect, draftLabel: string): ScopeExplain | null {
  const expert = effect.expert
  if (!expert) return null
  if (effect.held) {
    const names = (effect.next.folders ?? []).map((f) =>
      typeof f.name === "string" && f.name.trim() ? f.name : UNNAMEABLE_FOLDER,
    )
    return {
      tone: "held",
      lead: SCOPE_COPY.heldLead(expert.name),
      text: SCOPE_COPY.heldRest(names.length ? joinFolders(names) : EVENT_COPY.nothing, draftLabel, expert.name),
    }
  }
  if (expert.scope_mode === "biased") {
    return { tone: "info", lead: null, text: SCOPE_COPY.biasedExplain(expert.name) }
  }
  return null
}
