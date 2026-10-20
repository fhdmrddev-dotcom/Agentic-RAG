/**
 * Phase 295-06 (D-02 / D-03 / D-32 / D-39 / UI-SPEC A.4) — the ONE reading of `ask.engine_pause`.
 *
 * `PendingAskCard.tsx` FIRES under G-5, so its budget for the found-nothing pause is ONE field
 * read and ONE leaf mount. Every new conditional that pause needs lives here instead, and the
 * card's arms read only these results.
 *
 * ⚠ THIS MODULE COMPOSES NO PROMPT AND NO CHOICE. The server builds both (295-03,
 * `engine_ask.py`), in a fixed order, with absent choices removed rather than blanked. The two
 * labels below exist only so this module can RECOGNISE the server's choices; they must match the
 * server's `ENGINE_CHOICE_SEARCH` / `ENGINE_CHOICE_STOP` exactly.
 *
 * ⚠ AN ENGINE PAUSE HAS NO DEADLINE (D-37). It arrives with `timeout_seconds: null`, so the card's
 * shipped no-deadline arm already says the run is waiting and draws no clock. Nothing here touches
 * the clock, the wait lines or the retirement arm.
 *
 * Pure: no React, no API import, no I/O.
 */
import type { EnginePause, PendingAsk } from "@/types"

/** The server's label for the "look somewhere else" choice (295-03 `ENGINE_CHOICE_SEARCH`). */
export const ENGINE_CHOICE_SEARCH = "Search another folder"

/** The server's label for the "end the run here" choice (295-03 `ENGINE_CHOICE_STOP`). */
export const ENGINE_CHOICE_STOP = "Stop the run"

/** The answered header every ask has always read. Moved here verbatim from the card (295-06). */
export const ANSWERED_RESUMED = "Answered · agent resumed"

/** The answered header for a Stop: "agent resumed" would be false (UI-SPEC decided 6). */
export const ANSWERED_STOPPED = "Answered · run stopped"

type EngineFolder = EnginePause["folders"][number]

function cleanFolders(raw: unknown): EngineFolder[] {
  if (!Array.isArray(raw)) return []
  const out: EngineFolder[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const { id, name, depth } = row as Record<string, unknown>
    // A nameless row is dropped, never rendered blank (UI-SPEC A.3). Without an id it cannot be
    // answered, so it is dropped too.
    if (typeof id !== "string" || id.length === 0) continue
    if (typeof name !== "string" || name.trim().length === 0) continue
    const d = typeof depth === "number" && Number.isFinite(depth) && depth > 0 ? Math.floor(depth) : 0
    out.push({ id, name, depth: d })
  }
  return out
}

/**
 * The prompt's engine pause, or null for an ordinary ask. A malformed `folders` entry is dropped;
 * everything else is passed through as the server sent it.
 */
export function readEnginePause(ask: PendingAsk): EnginePause | null {
  const raw: unknown = ask.engine_pause
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const ep = raw as Partial<EnginePause>
  return {
    kind: ep.kind as EnginePause["kind"],
    phase: typeof ep.phase === "string" ? ep.phase : "",
    continue_allowed: ep.continue_allowed === true,
    locked: ep.locked === true,
    folders: cleanFolders(ep.folders),
  }
}

/**
 * True only while the person has selected the server's search choice on an engine pause that
 * offered at least one folder. Gates the folder chooser, the Send Answer requirement and
 * `folder_id` on the answer.
 */
export function needsFolder(ask: PendingAsk, choiceIndex: number | null): boolean {
  if (choiceIndex === null) return false
  const ep = readEnginePause(ask)
  if (!ep || ep.folders.length === 0) return false
  return (ask.options ?? [])[choiceIndex] === ENGINE_CHOICE_SEARCH
}

/** The answered arm's header: a Stop on an engine pause says so; every other answer is unchanged. */
export function answeredHeader(ask: PendingAsk, answeredLabel: string): string {
  if (readEnginePause(ask) && answeredLabel === ENGINE_CHOICE_STOP) return ANSWERED_STOPPED
  return ANSWERED_RESUMED
}

/**
 * The words that follow `You answered` for a folder answer: the choice plus the chosen folder's
 * name. Null for every other answer, so the card keeps its shipped receipt.
 *
 * ⚠ RESOLVED AT SUBMIT, NOT AT RENDER. A successful answer settles the draft (282-02), which
 * drops the chosen folder with it, so the answered arm could no longer look the folder up.
 */
export function answeredReceipt(
  ask: PendingAsk,
  answeredLabel: string,
  folderId: string | undefined,
): string | null {
  if (answeredLabel !== ENGINE_CHOICE_SEARCH || !folderId) return null
  const ep = readEnginePause(ask)
  const folder = ep?.folders.find((f) => f.id === folderId)
  return folder ? `${answeredLabel} — ${folder.name}` : null
}
