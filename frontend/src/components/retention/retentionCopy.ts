/**
 * Phase 275 (D-07) — THE RETENTION COPY.
 *
 * Every string a retention surface renders lives here, and `__tests__/retentionCopy.test.ts`
 * fences each group against its OWN source, so a re-typed value goes red rather than shipping:
 *   · `ported`          — static words from sketch 275 (`.planning/sketches/275-retention-legal-hold/
 *                         index.html`, winners 1B · 2B · 3A · 4B), asserted VERBATIM in the sketch.
 *   · `contract`        — static words the UI-SPEC (`275-UI-SPEC.md`) sets where the sketch had none,
 *                         or changes by a locked decision (§Sketch deviations), asserted VERBATIM there.
 *   · `sketchTemplates` — sentences the sketch builds with `${…}`. A template carries `{placeholders}`,
 *                         `**bold**` and `(s)`; every literal segment between them (≥ 4 chars) is
 *                         asserted verbatim in the sketch.
 *   · `specTemplates`   — the same shape for UI-SPEC sentences, segments asserted in the UI-SPEC.
 *   · `server`          — the client's copies of `hold_guard.py`'s sentences, asserted in that source.
 *
 * ⛔ A hold sentence the SERVER sends (a 409 refusal, the admin `hold_line`) is rendered as-is. The
 * `server` group exists only for the pre-open refusal (S10, D-14): a door that already KNOWS the
 * document is held opens straight into the refusal, so it needs the same sentence before any 409.
 */

/** Ported verbatim from sketch 275. */
const ported = {
  /** S9 — screen 4's toggle: `<label class="toggle">… Include archived</label>`. */
  includeArchived: "Include archived",
  /** S10 — screen 4's refusal box lead: `<b>Can't delete.</b>`. */
  refusalTitle: "Can't delete.",
  /** S6 — the 4B row tags (`retentionFor`). */
  chipOnHold: "On hold",
  chipArchived: "Archived",
  chipDeletePending: "Delete pending",
  chipArchivesTonight: "Archives tonight",
  chipInReview: "In review",
  chipNoDate: "No date",
  /** S7 — the folder line's "then …" words, by action. */
  thenArchive: "archived",
  thenDelete: "deleted after an admin approves",
  thenReview: "reviewed by a person",
  /** S8 — no policy applies. */
  sectionNone: "No retention policy applies. It is kept until someone deletes it.",
  /** S9 — the archived-hidden line's link. */
  show: "Show",
  /** S1/S4/S7 — the action tags (`actTag`). */
  tagArchive: "Archive",
  tagDelete: "Delete · needs approval",
  tagReview: "Review",
} as const

/** UI-SPEC contract copy (no sketch source, or changed by a locked decision). */
const contract = {
  /** S9 — the Find chip when on (primary-tinted, with a ✕). */
  archivedIncluded: "Archived: included",
  /** S9 — the on-chip's ✕ accessible name. */
  stopIncludingArchived: "Stop including archived documents",
  /** S10 — the refusal notice's single dismiss. */
  close: "Close",
  /** S10 — what a NON-hold delete failure still says (the hold refusal replaces it). */
  deleteFailed: "Delete failed. Please try again.",
  /** S6 — chips the sketch had no word for. */
  chipPoliciesDisagree: "Policies disagree",
  chipDeletedAtSource: "Deleted at source",
  chipNoLongerShared: "No longer shared at source",
  chipSourceDisconnected: "Source disconnected",
  /** S7 — the member's folder hold line (D-17: no matter name). */
  folderHoldMember: "Everything in this folder is on legal hold.",
  /** S8 — the member's hold section, EXACTLY (D-17). */
  memberHoldLine: "On legal hold. Ask an org admin.",
  memberHoldSecond: "It can't be deleted until the hold is released.",
  /** S8 — source states (D-21), rendered BELOW the retention sentence. */
  sourceDeleted: "Deleted at source.",
  sourceNoLongerShared: "No longer shared at source.",
  sourceDisconnected: "Source disconnected.",
  sourceTail: "Chat no longer answers from it. It still opens and downloads here.",
  /** S8 — the admin-only Un-archive (D-19). */
  unarchive: "Un-archive",
  unarchiveReceipt: "✎ Un-archived · recorded",
  unarchiveFailed: "Couldn't un-archive. Nothing changed.",
  /** S9 — the archived-hidden line once shown. */
  hide: "Hide",
} as const

/** Sentences the sketch builds; their literal segments are fenced against the sketch. */
const sketchTemplates = {
  /** S7 — own policy (4B `folderLine`). */
  folderPolicy: "This folder: **kept {kept_for}**, then {then}.",
  /** S8 — `retentionFor`, one sentence per state. */
  sectionArchived:
    "**Archived {date}** by the “{policy}” policy. Chat no longer answers from it. It still opens, downloads and shows up with “Include archived”.",
  sectionDeletePending: "Due for deletion under “{policy}” since {date}. **Waiting for an org admin to approve.**",
  sectionArchivesTonight: "Due under “{policy}” since {date}: **archived at tonight's sweep**.",
  sectionInReview: "Due under “{policy}” since {date}: **listed for a person to decide**.",
  sectionNoDate:
    "“{policy}” counts from the document date, and this document has none, so **nothing will happen to it**. Set a document date to fix that.",
  /** S8 — the not-due tail after the server's rule text. */
  sectionDue: "**Due {date}** (“{policy}”).",
  /** S9 — browse hides archived rows behind this line. */
  archivedHidden: "{N} archived document(s) hidden",
} as const

/** UI-SPEC sentences with placeholders; their literal segments are fenced against the UI-SPEC. */
const specTemplates = {
  /** S7 — an inherited policy (D-23). */
  folderInherited: " (from “{policy}” on {path})",
  /** S7 — an admin's folder hold line names the matter (the member's has none, D-17). */
  folderHoldAdmin: "Everything in this folder is on legal hold — {matter}.",
  /** S8 — Claude's-discretion states. */
  sectionDisagree:
    "“{A}” and “{B}” disagree about this document, so **nothing will happen to it** until one of them changes.",
  sectionKept: "Kept by {name} on {date} under “{policy}”. The policy skips it until the policy or the document changes.",
  sectionUnarchived: "Un-archived by {name} on {date}. “{policy}” skips it until the policy or the document changes.",
  /** S8 — Un-archive success (D-19). */
  unarchiveDone: "Un-archived by you just now. “{policy}” skips it until the policy or the document changes.",
  /** S9 — the shown state of the hidden line. */
  showingArchived: "Showing {N} archived document(s)",
} as const

/** The client's copies of `backend/app/services/retention/hold_guard.py`'s document sentences. */
const server = {
  documentAdmin: "This document is on legal hold (“{matter}”). Release the hold in Org admin → Retention first.",
  documentAdminNoMatter: "This document is on legal hold. Release the hold in Org admin → Retention first.",
  documentMember: "This document is on legal hold. Ask an org admin if you think it should be released.",
} as const

export const RETENTION_COPY = { ported, contract, sketchTemplates, specTemplates, server } as const

// ── helpers ─────────────────────────────────────────────────────────────────────────────────

export type CopyVars = Record<string, string | number | null | undefined>

/**
 * Fill `{key}` placeholders and resolve `(s)` against `count` (default `vars.N`). A missing value
 * leaves its placeholder visible rather than inventing one.
 */
export function fillCopy(template: string, vars: CopyVars = {}, count?: number): string {
  const n = count ?? (typeof vars.N === "number" ? vars.N : undefined)
  return template
    .replace(/\{([^}]+)\}/g, (whole, key: string) => {
      const v = vars[key]
      return v === null || v === undefined ? whole : String(v)
    })
    .replace(/\(s\)/g, n === 1 ? "" : "s")
}

export interface RichPart {
  text: string
  bold: boolean
}

/** Split a filled template on `**` into plain and bold runs (the sketch's `<b>`). */
export function richParts(text: string): RichPart[] {
  return text
    .split("**")
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((p) => p.text !== "")
}

/** A missing date reads this (the 270 rule) — never a substituted date. */
export const NOT_RECORDED_DATE = "not recorded"

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

function parse(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `12 Oct 2026` (the 271 `FIND_DATE_FORMAT`). A date-only value is built in local time. */
export function formatRetentionDate(raw: string | null | undefined): string {
  if (!raw) return NOT_RECORDED_DATE
  const d = parse(raw)
  return d ? d.toLocaleDateString(undefined, DATE_FORMAT) : NOT_RECORDED_DATE
}

/** `12 Oct 2026, 02:00` — receipts and the sweep posture. */
export function formatRetentionDateTime(raw: string | null | undefined): string {
  if (!raw) return NOT_RECORDED_DATE
  const d = parse(raw)
  return d ? d.toLocaleString(undefined, DATE_TIME_FORMAT) : NOT_RECORDED_DATE
}

/**
 * The pre-open refusal sentence for a held document (S10). An org admin's payload carries
 * `hold_names`; a member's has none, so a member can never be shown a matter name here (D-17).
 */
export function holdRefusalFor(
  holdNames: readonly string[] | null | undefined,
  canManage: boolean,
): { title: string; message: string } {
  const title = RETENTION_COPY.ported.refusalTitle
  if (!canManage) return { title, message: RETENTION_COPY.server.documentMember }
  const matter = holdNames && holdNames.length > 0 ? holdNames[0] : null
  return {
    title,
    message: matter
      ? fillCopy(RETENTION_COPY.server.documentAdmin, { matter })
      : RETENTION_COPY.server.documentAdminNoMatter,
  }
}
