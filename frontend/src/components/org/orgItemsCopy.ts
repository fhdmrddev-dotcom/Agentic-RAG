/**
 * Phase 298 (298-UI-SPEC.md) — the one home of the phase's new words.
 *
 * ⛔ A STRICT LEAF: no imports, no React, nothing but strings and string functions. Every surface
 * that shows one of these sentences imports it from here, so a wording change is one edit and a
 * test can assert the rendered words against the same constant.
 */

/** UI-D8 — the Library folder tree while the active org's folders are not answered yet. */
export const LOADING_FOLDERS = "Loading folders…"

/** UI-D8 / D-11 — the chat history column during an org-switch refetch (never "No recent chats"). */
export const LOADING_CHATS = "Loading your chats…"

/** UI-D11 — where an out-of-org folder lives. Exactly `lives in {Org}`, lower-case "lives". */
export function LIVES_IN(org: string): string {
  return `lives in ${org}`
}

// ── Phase 298-05 (D-17 / UI-D5) — the elsewhere line ─────────────────────────────────────────

/** `{n} more {one|many}` with an exact plural ("1 more folder", "2 more folders"). */
function more(n: number, one: string, many: string): string {
  return `${n} more ${n === 1 ? one : many}`
}

/** The kinds of narrowed list that carry an elsewhere line. */
export type ElsewhereKind = "library" | "workflows" | "threads" | "runs"

/** One other org's counts, structurally (this leaf imports nothing). */
export interface ElsewhereCountsShape {
  folders: number
  root_documents: number
  workflows: number
  threads: number
  runs: number
}

/**
 * The line's lead for one org and one list, or `null` when there is nothing to say (every count
 * this list reads is 0). The Library line counts folders AND Root documents in one sentence, and
 * drops whichever part is 0. ⛔ Never returns a sentence containing "0 more".
 */
export function elsewhereLead(kind: ElsewhereKind, c: ElsewhereCountsShape): string | null {
  if (kind === "library") {
    const parts = [
      c.folders > 0 ? more(c.folders, "folder", "folders") : null,
      c.root_documents > 0 ? more(c.root_documents, "Root document", "Root documents") : null,
    ].filter((p): p is string => p !== null)
    return parts.length > 0 ? parts.join(" and ") : null
  }
  if (kind === "workflows") return c.workflows > 0 ? more(c.workflows, "workflow", "workflows") : null
  if (kind === "threads") return c.threads > 0 ? more(c.threads, "chat", "chats") : null
  return c.runs > 0 ? more(c.runs, "run", "runs") : null
}

/** The line's button text, and its accessible name (UI-D7). */
export const SWITCH = "Switch"
export function switchToLabel(org: string): string {
  return `Switch to ${org}`
}

// ── Phase 298-05 (D-21 / D-33 / UI-D15..UI-D18) — "Move to <org>…" ──────────────────────────

/** A row-menu item / the detail-panel button. The ellipsis says a sheet follows. */
export function moveToMenuLabel(org: string): string {
  return `Move to ${org}…`
}
/** The collapsed form at 4+ orgs (3+ targets). */
export const MOVE_TO_ANOTHER_ORG = "Move to another organization…"

/** Sheet titles. */
export const MOVE_PICK_TITLE = "Move to another organization?"
export function moveTitle(org: string): string {
  return `Move to ${org}?`
}
export function moveRefusedTitle(org: string): string {
  return `This can't move to ${org} yet`
}

/** Sheet captions (rendered uppercase by CSS; the DOM keeps sentence case). */
export function movesToCaption(org: string): string {
  return `Moves to ${org}`
}
export const WHAT_CHANGES = "What changes"
export function whatChanges(from: string, to: string): string {
  return `It leaves ${from}. Switch to ${to} to find it there. You can move it back the same way.`
}

/** "A", "A and B", "A, B and C". */
function listOf(parts: string[]): string {
  if (parts.length <= 1) return parts.join("")
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The preview's counts, structurally. */
export interface MoveCountsShape {
  subfolders: number
  documents: number
  earlier_versions: number
  past_runs: number
}

/**
 * UI-D18 — the sentence that names what moves, from the SERVER's counts, zero parts dropped.
 * `name` is the item's name (curly-quoted for a document; a folder and a draft say "This …").
 */
export function moveCountSentence(
  kind: "folder" | "document" | "draft",
  name: string,
  c: MoveCountsShape,
  to: string,
): string {
  if (kind === "folder") {
    const parts = ["This folder"]
    if (c.subfolders > 0) parts.push(count(c.subfolders, "subfolder", "subfolders"))
    if (c.documents > 0) parts.push(count(c.documents, "document", "documents"))
    return parts.length === 1 ? `This folder moves to ${to}.` : `${listOf(parts)} move to ${to}.`
  }
  if (kind === "document") {
    return c.earlier_versions > 0
      ? `“${name}” and its ${count(c.earlier_versions, "earlier version", "earlier versions")} move to ${to}.`
      : `“${name}” moves to ${to}.`
  }
  return `This draft moves to ${to}.`
}

/** A draft's past runs stay where they ran — said only when there are some. */
export function pastRunsStay(n: number, from: string): string | null {
  if (n <= 0) return null
  return n === 1 ? `Its 1 earlier run stays in ${from}.` : `Its ${n} earlier runs stay in ${from}.`
}

/** Buttons and terminals (UI-D17). */
export const KEEP_IT_HERE = "Keep it here"
export const CLOSE = "Close"
export const CONTINUE = "Continue"
export const TRY_AGAIN = "Try again"
export function moveButton(org: string): string {
  return `Move to ${org}`
}
export const CHECKING_MOVE = "Checking what this will move…"
export const PREVIEW_FAILED = "Couldn't check what this would move."
export const MOVE_FAILED = "Couldn't move it. Nothing was changed."
export const MOVING = "Moving…"
export function movedTo(org: string): string {
  return `Moved to ${org} · recorded`
}
export const RECORDED_FOOTER = "✎ Recorded with your name in the audit log."
/** The radio list's accessible name at 4+ orgs. */
export const PICK_TARGET_LABEL = "Organization to move it to"

// ── Phase 299-03 (D-16 / D-17 / D-19 / D-37 / D-39 / UI-SPEC S3) — "This is in <org> — switch?" ──
// The Accept button reuses `switchToLabel(org)` above (the 298 vocabulary).

/** The prompt's heading. */
export function thisIsIn(org: string): string {
  return `This is in ${org}`
}
/** The prompt's body. */
export function workingIn(current: string, org: string): string {
  return `You're working in ${current}. Switch to ${org} to open it?`
}
/** The body's tail, only while a chat in the active org is answering. Leading space on purpose. */
export const KEEPS_GOING_TAIL = " Your chat that's answering now keeps going."
/** The item box caption per kind (rendered uppercase by CSS; the DOM keeps sentence case). */
export const KIND_CAPTION = {
  thread: "Chat",
  workflow: "Workflow",
  run: "Workflow run",
  expert: "Expert",
} as const
/** The decline (the safe default; outline). */
export function stayIn(current: string): string {
  return `Stay in ${current}`
}
/** In place of the buttons while the switch lands. */
export function switchingTo(org: string): string {
  return `Switching to ${org}…`
}
/** The still-answering chip: one chat by title (curly quotes), or a count. */
export function stillAnsweringOne(title: string): string {
  return `“${title}” is still answering`
}
export function stillAnsweringMany(n: number): string {
  return `${n} chats are still answering`
}
export const BACK_TO_IT = "Back to it"
/** UI-D9 — the Stay notice on the surface the person lands on. */
export function stayedIn(current: string): string {
  return `You stayed in ${current}. The link wasn't opened.`
}
export const OPEN_IT_AFTER_ALL = "Open it after all"
/** UI-D10 — after a Switch with a chat still answering in the org that was left. Present tense
 *  only: reattach-on-return is research assumption A1, unproven until G-4 row 2. */
export function yourChatInStill(previous: string): string {
  return `Your chat in ${previous} is still answering.`
}
export const SWITCH_BACK = "Switch back"
/** When an org's name is not known yet (the memberships have not answered). */
export const THIS_ORG = "this organization"
