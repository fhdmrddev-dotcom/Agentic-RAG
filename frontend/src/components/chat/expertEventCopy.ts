/**
 * Phase 267 plan 04 (PACK-23 / PACK-24 · D-267-09 / D-267-11 / D-267-15 / D-267-16 / D-267-18 /
 * D-267-19 / D-267-27 / D-267-33) — THE ONE VOCABULARY for the chat transcript's Expert events.
 *
 * ⭐ ONE STRUCTURED PAYLOAD RENDERS TO WORDS HERE AND NOWHERE ELSE. The backend stores a typed
 * payload as `messages.tool_calls[0]` (`backend/app/models/message.py`); this module turns it into
 * the header, the Now / Dropped / Here / Open lines and the exclusion sub-line. `ExpertEventCard`
 * and `HandoffCard` only draw what the selectors below return, and no component spells a literal
 * that lives here (D-267-11, D-267-27 ⛔ — two derivations of one statement can disagree).
 *
 * ⛔ THE ROW'S `content` SENTENCE IS NEVER RENDERED. It exists because the column is NOT NULL and
 * for a person reading the database; the card reads the payload, so what it says is what the
 * server snapshotted at the moment of the change — a later rename does not rewrite history.
 *
 * ⛔ THE KIND ALLOWLIST MIRRORS `TRANSCRIPT_EVENT_KINDS` in `backend/app/models/message.py` and is
 * cross-pinned to it by `?raw` (`__tests__/expertEventCopy.test.ts` case 1). Any other system row
 * (`context_truncated`, `ask_user_*`, …) is NOT a transcript event and renders nothing (T-267-41).
 * "handoff" is deliberately absent: the handoff summary is a USER row the model must see.
 *
 * ⭐ FORWARD SHAPE: Phase 268's folder-scope event (CHAT-08) adds a KIND and a header here — the
 * Now / Dropped lines are generic scope lines, so it never needs a second renderer.
 */

import type { Message } from "@/types"
import type {
  ExpertChangedEvent,
  ExpertHandoffEvent,
  HandoffMarker,
  TranscriptScopeLine,
} from "@/lib/api/threads"
import { UNNAMEABLE_FOLDER } from "@/components/experts/catalog/ExpertDetailModal"
import { LEDGER_COPY } from "@/components/experts/catalog/expertCatalog"

/** Mirror of the backend frozenset — see the module docblock. */
export const TRANSCRIPT_EVENT_KINDS: ReadonlySet<string> = new Set([
  "expert_changed",
  "expert_handoff",
  "scope_changed",
])

export type TranscriptEvent = ExpertChangedEvent | ExpertHandoffEvent

/** How many excluded file names the event sub-line lists before `and {k} more`. */
const EXCLUDED_VISIBLE = 5
/** The handoff card's source-title cap (UI-SPEC §5.8). */
const SOURCE_TITLE_CAP = 60

export const EVENT_COPY = {
  joined: (expert: string): string => `${expert} joined`,
  left: (expert: string): string => `${expert} left`,
  swap: (from: string, to: string): string => `${from} → ${to}`,
  keys: { now: "Now", dropped: "Dropped", here: "Here", open: "Open" },
  nothing: "Nothing",
  allDocuments: "All your documents",
  threadFolder: (name: string, n: number | null): string =>
    n === null || n === undefined ? `/${name}` : `/${name} (${n})`,
  attachmentsReadable: "Chat attachments stay readable.",
  handoffHeader: (expert: string): string => `${expert} · new chat`,
  stays: (expert: string): string => `${expert} stays`,
  open: (title: string): string => `${title} →`,
  // 267-REVIEW WR-09: the `{title} · deleted` label is RETIRED. The pointer only ever knew that the
  // in-memory thread list did not hold the target (still loading, made in another tab, a failed
  // load) — never that the thread was deleted. An unfound target now reads as its plain title.
  handedOffFrom: (title: string): string => `Handed off from “${title}”`,
  /** D-267-33: the handoff thread inherits the source's folder, and the event says so. */
  sameFolder: (name: string): string => `Same folder: /${name}`,
  more: LEDGER_COPY.more,
  ariaLabel: (time: string): string => `Expert change at ${time}`,
} as const

function firstCall(message: Pick<Message, "tool_calls">): { kind?: unknown } | null {
  const tc = message.tool_calls?.[0] as unknown
  return tc && typeof tc === "object" ? (tc as { kind?: unknown }) : null
}

/** The typed payload for an allowlisted system row, else `null`. */
export function transcriptEventOf(
  message: Pick<Message, "role" | "tool_calls">,
): TranscriptEvent | null {
  if (message.role !== "system") return null
  const tc = firstCall(message)
  if (!tc || typeof tc.kind !== "string" || !TRANSCRIPT_EVENT_KINDS.has(tc.kind)) return null
  return tc as unknown as TranscriptEvent
}

/** The handoff marker on the new thread's first USER message, else `null`. */
export function handoffMarkerOf(message: Pick<Message, "role" | "tool_calls">): HandoffMarker | null {
  if (message.role !== "user") return null
  const tc = firstCall(message)
  return tc && tc.kind === "handoff" ? (tc as unknown as HandoffMarker) : null
}

// ── The expert_changed card ────────────────────────────────────────────────────────────────

export interface ScopeLineModel {
  /** Folder labels in payload order; `["Nothing"]` when the whole line is empty. */
  items: string[]
  /** Connection names (the card draws a Plug beside each). */
  connections: string[]
  /** True when the line states nothing — the card mutes the "Nothing" literal. */
  empty: boolean
}

export interface EventCardModel {
  kind: "expert_changed"
  variant: "join" | "swap" | "removal"
  header: string
  tone: "violet" | "neutral"
  at: string
  now: ScopeLineModel
  dropped: ScopeLineModel
  /** Restricted exclusions only: ≤ 5 names, `and {k} more`, then the attachments promise. */
  excludedSubline: string | null
}

function folderLabel(name: string | null): string {
  return typeof name === "string" && name.trim() ? name : UNNAMEABLE_FOLDER
}

function scopeLine(line: TranscriptScopeLine): ScopeLineModel {
  const items: string[] = []
  for (const f of line.folders ?? []) items.push(folderLabel(f.name))
  if (line.thread_folder) {
    const tf = line.thread_folder
    items.push(
      typeof tf.name === "string" && tf.name.trim()
        ? EVENT_COPY.threadFolder(tf.name, tf.doc_count)
        : UNNAMEABLE_FOLDER,
    )
  }
  if (line.all_documents) items.push(EVENT_COPY.allDocuments)
  const connections = [...(line.connections ?? [])]
  if (items.length === 0 && connections.length === 0) {
    return { items: [EVENT_COPY.nothing], connections: [], empty: true }
  }
  return { items, connections, empty: false }
}

function excludedSubline(excluded: ExpertChangedEvent["excluded"]): string | null {
  if (!excluded || !(excluded.count > 0)) return null
  const names = (excluded.names ?? []).slice(0, EXCLUDED_VISIBLE)
  // ⛔ k comes from the server's COUNT, never from the list's length (the list is capped).
  const k = Math.max(excluded.count, excluded.names?.length ?? 0) - names.length
  const parts = [...names]
  if (k > 0) parts.push(EVENT_COPY.more(k))
  parts.push(EVENT_COPY.attachmentsReadable)
  return parts.join(" · ")
}

export function eventCardModel(event: ExpertChangedEvent): EventCardModel {
  const before = event.before?.name ?? null
  const after = event.after?.name ?? null
  let variant: EventCardModel["variant"]
  let header: string
  if (before && after) {
    variant = "swap"
    header = EVENT_COPY.swap(before, after)
  } else if (after) {
    variant = "join"
    header = EVENT_COPY.joined(after)
  } else {
    variant = "removal"
    header = EVENT_COPY.left(before ?? "")
  }
  return {
    kind: "expert_changed",
    variant,
    header,
    tone: variant === "removal" ? "neutral" : "violet",
    at: event.at,
    now: scopeLine(event.now),
    dropped: scopeLine(event.dropped),
    excludedSubline: excludedSubline(event.excluded),
  }
}

// ── The expert_handoff pointer (source thread) ─────────────────────────────────────────────

export interface HandoffEventModel {
  kind: "expert_handoff"
  header: string
  at: string
  /** `{active} stays`, or `null` when the source thread had no Expert. */
  here: string | null
  targetThreadId: string
  title: string
  openLabel: string
  /** D-267-33: `Same folder: /{name}` when the new thread inherited a folder. */
  folderLine: string | null
}

export function handoffEventModel(event: ExpertHandoffEvent): HandoffEventModel {
  return {
    kind: "expert_handoff",
    header: EVENT_COPY.handoffHeader(event.expert_name),
    at: event.at,
    here: event.stays_expert_name ? EVENT_COPY.stays(event.stays_expert_name) : null,
    targetThreadId: event.target_thread_id,
    title: event.target_title,
    openLabel: EVENT_COPY.open(event.target_title),
    folderLine: event.folder_name ? EVENT_COPY.sameFolder(event.folder_name) : null,
  }
}

// ── The handoff card (new thread's first message) ──────────────────────────────────────────

export interface HandoffCardModel {
  header: string
  /** One bullet per summary item, or `null` for a legacy single-string summary. */
  bullets: string[] | null
  paragraph: string | null
}

export function handoffCardModel(marker: HandoffMarker): HandoffCardModel {
  const raw = marker.source_title ?? ""
  const title = raw.length > SOURCE_TITLE_CAP ? `${raw.slice(0, SOURCE_TITLE_CAP)}…` : raw
  const summary = marker.summary as unknown
  if (Array.isArray(summary)) {
    return { header: EVENT_COPY.handedOffFrom(title), bullets: summary.map(String), paragraph: null }
  }
  return {
    header: EVENT_COPY.handedOffFrom(title),
    bullets: null,
    paragraph: typeof summary === "string" ? summary : "",
  }
}

// ── Time ───────────────────────────────────────────────────────────────────────────────────

/** `HH:mm` on the same local day as `now`; otherwise `MMM d, HH:mm`. */
export function eventTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return time
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" })
  return `${date}, ${time}`
}
