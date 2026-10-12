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
  /** S3 — Legal holds (1B hold card). */
  holdsTitle: "Legal holds",
  holdsSub:
    "A held document cannot be deleted by anyone, through any door, and every policy skips it until the hold is released.",
  newHold: "+ New hold",
  holding: "Holding",
  addDocuments: "Add documents…",
  releaseHoldEllipsis: "Release hold…",
  /** S4 — Waiting for you (3A). */
  waitingCrumb: "Retention › Waiting for you",
  waitingEmpty: "Nothing is waiting for approval.",
  colDocument: "Document",
  colFolder: "Folder",
  colDocumentDate: "Document date",
  colDueSince: "Due since",
  undone: "This can't be undone.",
  done: "Done",
  auditTail:
    "One audit record per document names the document, the policy, the action, who approved it and when.",
  /** S1 — the Retention tab (1B). */
  tabRetention: "Retention",
  tabPolicies: "Policies",
  tabWaiting: "Waiting for you",
  tabHistory: "History",
  newPolicy: "+ New policy",
  colName: "Name",
  colAppliesTo: "Applies to",
  colKeptFor: "Kept for",
  colThen: "Then",
  colTonight: "Tonight",
  nothingElseDue: "nothing else due",
  /** S2 — the policy editor (2B). */
  policiesCrumb: "Retention › Policies ›",
  newPolicyTitle: "New policy",
  labelDocumentType: "Document type",
  labelKeepFor: "Keep for",
  labelCountedFrom: "Counted from",
  anyType: "Any type",
  anyFolder: "Any folder",
  subfolders: "subfolders",
  clockDocumentDate: "the document date",
  clockDateAdded: "the day it was added to the Library",
  actionArchive: "archive it",
  actionDelete: "delete it",
  actionReview: "ask a person to decide",
  noteArchive:
    "Archived documents stop appearing in chat answers. They stay in the Library, findable with “Include archived”, and open and download as normal.",
  noteDelete:
    "Deletes never run on their own. Tonight's sweep lists what is due, and an org admin confirms each document by name.",
  noteReview: "Due documents are listed for a person. Nothing is changed automatically.",
  previewButton: "1 · Preview what this would do",
  saveButton: "2 · Save policy",
  staleBanner: "You changed the policy after the preview. Preview again before saving.",
  previewTitle: "Preview · what tonight's sweep would do",
  nothingPreviewed: "Nothing previewed yet.",
  cantSaveYet: "A policy can't be saved until you've seen what it would do.",
  noteNoDate: "Give these a document date, or count from “added to the Library” instead.",
  noteCollision: "A document under two policies that disagree is never touched: change one of them.",
  notYet: "not due yet",
  alreadyArchived: "already archived",
  /** S5 — History (dry-run verbs + the late-hold tail). */
  verbDeleted: "deleted",
  verbReviewed: "reviewed",
  lateHoldTail: ": put on legal hold after the sweep",
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
  /** S3 — holds (Claude's discretion in the UI-SPEC). */
  holdsEmptyTitle: "No legal holds",
  holdsEmptyBody: "Place a hold to stop any document or folder from being deleted, by a person or by a policy.",
  newHoldTitle: "New hold",
  matterName: "Matter name",
  reason: "Reason",
  covers: "Covers",
  folders: "Folders",
  documents: "Documents",
  nameMatter: "Name the matter.",
  sayWhy: "Say why it is held.",
  pickOne: "Pick at least one folder or document.",
  countFailed: "Couldn't count the documents yet.",
  placeHold: "Place hold",
  addToHold: "Add to hold",
  placeFailed: "Couldn't place the hold. Nothing changed. Nothing is held yet.",
  addFailed: "Couldn't add to the hold. Nothing changed. The hold still covers what it did before.",
  keepHold: "Keep hold",
  releaseHold: "Release hold",
  releaseFailed: "Couldn't release the hold. It is still in force.",
  /** S4 — the D-11 deviation (changed from the sketch). */
  untickedNote: "Unticked documents are kept. They are not proposed again unless the policy is edited or the document changes.",
  confirmFailed:
    "Couldn't confirm the batch. Some documents may already be deleted. History shows exactly which. Reload this list before trying again.",
  decisionsFailed: "Couldn't record your decisions. Nothing was archived or kept. Reload this list before trying again.",
  reload: "Reload",
  decision: "Decision",
  decisionKeep: "Keep",
  decisionArchive: "Archive",
  decisionDelete: "Delete",
  /** S1 — the load error (reused by every self-fetching retention body). */
  loadFailed: "Couldn't load retention. Try again.",
  tryAgain: "Try again",
  /** S5 — an actor whose account no longer exists (never blank). */
  formerMember: "a former member",
  /** S1 — posture states (D-29 / D-06). */
  loading: "Loading retention…",
  sweepsOff: "Scheduled sweeps are off. Nothing is archived or queued until they are turned on. Preview still works.",
  neverRun: "No sweep has run yet. Preview a policy to see what the first one would do.",
  policiesEmptyTitle: "No retention policies yet",
  policiesEmptyBody:
    "Nothing in the Library is archived or deleted until a policy says so. Create one and preview it before it can run.",
  /** S2 — the editor. */
  backToPolicies: "Back to policies",
  unitDays: "days",
  unitMonths: "months",
  unitYears: "years",
  later: "Later",
  thenQueue: "Then queue it for deletion",
  after: "after",
  stage2Helper: "Counted from the same date. Deletion still waits for an org admin to confirm.",
  nameRequired: "Give the policy a name.",
  scopeRequired: "A policy needs a document type, a folder, or both.",
  stage2After: "The delete step must come after the archive step.",
  previewFirst: "Preview first. A policy can't be saved until you've seen what it would do.",
  previewFailed: "Preview couldn't finish, so this policy can't be saved yet. Nothing was changed.",
  saveFailed: "Couldn't save the policy. Nothing changed. Your preview is still here.",
  removePolicyEllipsis: "Remove policy…",
  removeBody:
    "No documents are deleted. Documents it already archived stay archived, and anything it queued leaves “Waiting for you”.",
  keepPolicy: "Keep policy",
  removePolicy: "Remove policy",
  removeFailed: "Couldn't remove the policy. It is still active.",
  bucketKept: "kept by an admin — skipped until this policy or the document changes",
  /** S5 — History. */
  historyEmpty: "No retention actions yet. Every archive, delete, hold and policy change will be listed here.",
  showOlder: "Show older",
  whatDeletion: "deletion",
  whatReview: "review",
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
  /** S3 — the hold card. */
  activeCount: "{N} active",
  releasedCount: "{N} released hold(s)",
  holdPlaced: "Placed by {name} on {date}",
  holdCovers: "covers {N} document(s)",
  holdCoversFolders: " + {folders} (and anything added to it later)",
  heldToday: "**{N} document(s) held today**",
  /** S4 — the batch card. */
  batchSub: "{scope} · kept {kept_for} · found by the sweep on {date}",
  skippedNote:
    "Not in this list: {held} on legal hold ({held_names}) · {undecidable} that can't be decided ({undecidable_list}). Those are never deleted.",
  recheck:
    "Every document is **checked again at the moment you confirm**. Anything put on hold, moved or edited since the sweep is dropped, not deleted.",
  typeToConfirm: "Type **{N}** to confirm.",
  deletePermanently: "Delete {N} document(s) permanently",
  deletedResult: "**Deleted {N} document(s).**",
  lateHold: "Kept {M}: {names} went on legal hold after the sweep, so it was dropped at confirm.",
  /** S1 — the posture line and the Policies table. */
  postureHealthy: "Last sweep **{date}** finished, nothing failed",
  postureNext: "Next sweep **{date}**",
  postureCounts: "{P} policies · {H} legal hold(s)",
  policiesSub: "Checked every night at {time}. Archive happens on its own. Delete always waits for a person.",
  dueNow: "**{N}** due now",
  undecidableCount: "{N} undecidable",
  nextDue: "next: {date}",
  /** S2 — the editor title and the Preview buckets. */
  editTitle: "Edit “{name}”",
  bucketActDelete: "would be **queued for you to approve** deletion",
  bucketActArchive: "would be **archived**",
  bucketActReview: "would be **listed for a person to decide**",
  bucketHold: "skipped — **on legal hold**",
  bucketUndecidable: "**can't be decided — nothing will happen to them**",
  rowDue: "{doc} · due {date}",
  notYetNext: " · next: {doc}, {date}",
  /** S5 — receipts the sketch writes. */
  historyArchived: "Archived **{doc}** under “{policy}”",
  historyDeleted: "Deleted **{doc}** under “{policy}”, approved by {name}",
  historyDidNotDelete: "Did not delete **{doc}**",
  historyHoldPlaced: "Placed legal hold **{matter}** on {docs} and {folders}",
  historyPolicySaved: "Saved policy **{name}**",
  historyDryRun: "Ran a dry run of **{policy}**: {act} would be {verb}, {hold} held, {undecidable} undecidable",
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
  /** S3 — dialogs. */
  holdCountLine: "{N} document(s) will be held today. Anything added to these folders later is held too.",
  addTitle: "Add to “{matter}”",
  releaseTitle: "Release “{matter}”?",
  releaseBody:
    "{N} document(s) will no longer be protected. Policies can archive them or queue them for deletion at the next sweep. Documents still covered by another hold stay held.",
  andMore: "and {N} more",
  releasedOn: "Released {date}",
  removeDocAria: "Remove {doc} from the hold",
  /** S4 — type-the-count and decisions. */
  typeAria: "Type {N} to confirm",
  keepAll: "Keep {N} document(s)",
  keptResult: "Kept {N} document(s).",
  archivedResult: "Archived {N} document(s).",
  reviewFooter: "{a} to keep · {b} to archive · {c} to delete · {d} undecided",
  applyDecisions: "Apply {N} decision(s)",
  applyAndDelete: "Apply decisions and delete {c} permanently",
  /** S1 — posture + the Waiting tab's accessible name. */
  postureNotFinished:
    "Last sweep {date time} did not finish. It changed nothing for the policies it could not complete.",
  waitingAria: "Waiting for you, {N} waiting",
  /** S2 — remove + the kept bucket's rows. */
  removeTitle: "Remove “{name}”?",
  keptRow: "{doc} · kept by {name} on {date}",
  /** S5 — receipts the UI-SPEC writes. */
  historyOnHoldSince: " (on hold since {time})",
  historyQueued: "Queued **{doc}** for {what} under “{policy}”",
  historyKept: "Kept **{doc}** under “{policy}”, kept by {name}",
  historyReviewArchived: "Archived **{doc}** under “{policy}”, decided by {name}",
  historyUnarchived: "Un-archived **{doc}**. “{policy}” skips it until the policy or the document changes",
  historyHoldExtended: "Added {docs} and {folders} to legal hold **{matter}**",
  historyHoldReleased: "Released legal hold **{matter}** ({N} document(s) no longer held)",
  historyPolicyRemoved: "Removed policy **{name}**",
  countDocuments: "{N} document(s)",
  countFolders: "{N} folder(s)",
} as const

/** CONTEXT decision copy with no UI-SPEC home; segments fenced against `275-CONTEXT.md`. */
const decisionTemplates = {
  /** D-34 — Preview counts the private documents a policy does not reach. */
  privateNotCovered: "{N} private documents are not covered",
} as const

/** The client's copies of `backend/app/services/retention/hold_guard.py`'s document sentences. */
const server = {
  documentAdmin: "This document is on legal hold (“{matter}”). Release the hold in Org admin → Retention first.",
  documentAdminNoMatter: "This document is on legal hold. Release the hold in Org admin → Retention first.",
  documentMember: "This document is on legal hold. Ask an org admin if you think it should be released.",
} as const

/** The client's copy of `backend/app/models/retention.py`'s scope refusal (275-03 deviation 4). */
const serverModels = {
  scopeOneOnly: "A policy covers one folder or one document type. Make a second policy for the other.",
} as const

export const RETENTION_COPY = {
  ported,
  contract,
  sketchTemplates,
  specTemplates,
  decisionTemplates,
  server,
  serverModels,
} as const

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
