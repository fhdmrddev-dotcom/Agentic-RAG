/**
 * Phase 275 plan 04 (RET-01..04) — THE TYPED CLIENT for every `/retention` route.
 *
 * The route table is 275-03-SUMMARY.md's ("Final route list"), and the types below mirror
 * `backend/app/models/retention.py` field for field. Every call goes through `getAuthHeaders()`
 * (Bearer + `X-Org-Id`, which the server re-validates) and turns any non-2xx into an
 * `ApiRefusal` carrying the server's own sentence — so a door renders the server's words
 * ("Preview again before saving.", "Type 4 to confirm.") and never swallows them.
 *
 * ⛔ NOT re-exported from `lib/api.ts`: `apiBarrel.test.ts` requires every runtime export of the
 * domain modules it lists to be re-exported, and this module is not one of them. Consumers import
 * `@/lib/api/retention` directly.
 *
 * ⚠ `POST /retention/document-states` drops every null field (`response_model_exclude_none`), so
 * a missing key MEANS null. A member's payload has no `hold_names` key at all (D-17).
 */
import { API_BASE, getAuthHeaders } from "./_core"
import { ApiRefusal } from "./refusal"

// ── wire types ──────────────────────────────────────────────────────────────────────────────

export type RetentionUnit = "days" | "months" | "years"
export type RetentionClock = "document_date" | "date_added"
export type RetentionAction = "archive" | "delete" | "review"

export interface RetentionSummary {
  sweep_enabled: boolean
  sweep_hour_utc: number
  last_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  next_run_at?: string | null
  counts: { policies?: number; active_holds?: number; waiting?: number } & Record<string, number>
}

export interface PolicyDraft {
  name: string
  document_type_norm?: string | null
  folder_id?: string | null
  include_subfolders: boolean
  clock: RetentionClock
  stage1_value: number
  stage1_unit: RetentionUnit
  stage1_action: RetentionAction
  stage2_value?: number | null
  stage2_unit?: RetentionUnit | null
}

export interface PolicyTonight {
  due_now: number
  undecidable: number
  next_due?: string | null
}

export interface RetentionPolicy {
  id: string
  name: string
  scope_kind: string
  folder_id?: string | null
  folder_path?: string | null
  include_subfolders: boolean
  document_type_norm?: string | null
  clock: RetentionClock
  stage1_value: number
  stage1_unit: RetentionUnit
  stage1_action: RetentionAction
  stage2_value?: number | null
  stage2_unit?: RetentionUnit | null
  stage2_action?: string | null
  revision: number
  previewed_revision?: number | null
  created_by_name?: string | null
  updated_by_name?: string | null
  created_at?: string | null
  updated_at?: string | null
  scope_text: string
  kept_for_text: string
  rule_text: string
  /** null when tonight's numbers could not be computed (an incomplete org read). */
  tonight?: PolicyTonight | null
}

export interface PolicyList {
  policies: RetentionPolicy[]
  evaluation_incomplete: boolean
}

export interface PreviewRow {
  document_id: string
  name: string
  folder_path?: string | null
  document_date?: string | null
  due_at?: string | null
  kind: string
  why: string
  other_policy_name?: string | null
  hold_names: string[]
  kept_by?: string | null
  kept_at?: string | null
  archived_at?: string | null
}

export interface PreviewBuckets {
  act: PreviewRow[]
  hold: PreviewRow[]
  undecidable: PreviewRow[]
  kept: PreviewRow[]
  not_yet: PreviewRow[]
  already: PreviewRow[]
}

export interface PolicyPreview {
  draft_hash: string
  action: RetentionAction
  has_stage2: boolean
  buckets: PreviewBuckets
  counts: Record<string, number>
  private_not_covered: number
}

export interface DocumentTypeCount {
  value: string
  count: number
}

export interface LegalHold {
  id: string
  name: string
  reason?: string | null
  created_by_name?: string | null
  created_at?: string | null
  released_at?: string | null
  released_by_name?: string | null
  release_note?: string | null
  active: boolean
  document_count: number
  folder_ids: string[]
  folder_paths: string[]
  /** Documents held today; null when it could not be counted — never a fake 0. */
  held_today?: number | null
}

export interface HoldList {
  active: LegalHold[]
  released: LegalHold[]
}

export interface HoldCoverage {
  document_ids: string[]
  folder_ids: string[]
}

export interface QueueRow {
  document_id: string
  name: string
  folder_path?: string | null
  document_date?: string | null
  due_since?: string | null
  kind: string
  found_at?: string | null
}

export interface SkippedNote {
  name: string
  why: string
}

export interface QueueBatch {
  policy_id: string
  policy_name: string
  kind: "delete" | "review"
  scope_text: string
  kept_for_text: string
  found_at?: string | null
  rows: QueueRow[]
  held: SkippedNote[]
  undecidable: SkippedNote[]
}

export interface QueueList {
  batches: QueueBatch[]
  total: number
}

export interface ConfirmBatchBody {
  delete_ids: string[]
  keep_ids: string[]
  archive_ids: string[]
  typed_count: number
}

export interface ConfirmItem {
  document_id: string
  name?: string | null
  reason?: string
  held_since?: string | null
  /** `failed` rows only: which decision failed (`delete` / `keep` / `archive`). */
  decision?: string
  error?: string
}

export interface ConfirmResult {
  deleted: ConfirmItem[]
  did_not_delete: ConfirmItem[]
  kept: ConfirmItem[]
  archived: ConfirmItem[]
  not_found: ConfirmItem[]
  skipped: ConfirmItem[]
  /** 275-REVIEW B-WR-04: families that failed for a non-hold reason — nothing of them was
   *  committed and they are still waiting. Optional: an older server omits it. */
  failed?: ConfirmItem[]
  /** Storage paths of committed deletes whose stored file could not be removed. */
  bytes_not_removed?: string[]
}

export interface UnarchiveResult {
  document_id: string
  name: string
  policy_name: string
  skip_written: boolean
}

export interface HistoryRow {
  id: string
  action: string
  /** The ✎ write mark (062-A); a dry run is a read and carries none. */
  written: boolean
  document_id?: string | null
  document_name?: string | null
  policy_name?: string | null
  hold_name?: string | null
  /** A person's name, "Nightly sweep", or "a former member". */
  actor_name: string
  detail: Record<string, unknown>
  created_at: string
}

export interface HistoryPage {
  rows: HistoryRow[]
  offset: number
  has_more: boolean
}

export interface SweepRunResult {
  status: string
  counts: Record<string, number>
  error?: string | null
}

export type RetentionChipValue =
  | "on_hold"
  | "archived"
  | "delete_pending"
  | "archives_tonight"
  | "in_review"
  | "policies_disagree"
  | "no_date"

export type RetentionSourceChip = "deleted_at_source" | "no_longer_shared" | "source_disconnected"

export type RetentionSectionKind =
  | "hold"
  | "archived"
  | "delete_pending"
  | "archives_tonight"
  | "in_review"
  | "no_date"
  | "disagree"
  | "kept"
  | "unarchived"
  | "not_due"
  | "none"

export interface RetentionDocumentSection {
  kind: RetentionSectionKind
  policy_name?: string | null
  other_policy_name?: string | null
  due_at?: string | null
  archived_at?: string | null
  kept_by?: string | null
  kept_at?: string | null
  rule_text?: string | null
}

export interface RetentionDocumentState {
  document_id: string
  chip?: RetentionChipValue | null
  source_chip?: RetentionSourceChip | null
  held: boolean
  hold_line?: string | null
  /** ORG ADMINS ONLY (D-17). The key is ABSENT from a member's payload. */
  hold_names?: string[] | null
  archived: boolean
  can_unarchive: boolean
  section: RetentionDocumentSection
}

export interface RetentionFolderPolicyLine {
  kind: "own" | "inherited"
  policy_id: string
  policy_name: string
  action: RetentionAction
  kept_for_text: string
  rule_text: string
  from_folder_path?: string | null
}

export interface RetentionFolderState {
  folder_id: string
  policy?: RetentionFolderPolicyLine | null
  held: boolean
  /** ORG ADMINS ONLY (D-17). The key is ABSENT from a member's payload. */
  hold_names?: string[] | null
}

export interface DocumentStatesResponse {
  documents: RetentionDocumentState[]
  folders: RetentionFolderState[]
  can_manage: boolean
}

// ── the one request helper ─────────────────────────────────────────────────────────────────

/**
 * Read FastAPI's `detail` once: a string, `{title?, message?}`, or a pydantic 422 list (whose
 * `msg` carries the model's own sentence behind pydantic's "Value error, " prefix). Anything
 * else falls back to `fallback` — never raw HTML.
 */
async function refusal(res: Response, fallback: string): Promise<ApiRefusal> {
  const body = await res.json().catch(() => null)
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === "string" && detail.trim() !== "") return new ApiRefusal(res.status, "", detail)
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = (detail[0] as { msg?: unknown })?.msg
    if (typeof msg === "string" && msg.trim() !== "") {
      return new ApiRefusal(res.status, "", msg.replace(/^Value error,\s*/, ""))
    }
  }
  const structured = (detail ?? null) as { title?: unknown; message?: unknown } | null
  const title = typeof structured?.title === "string" ? structured.title : ""
  const message =
    typeof structured?.message === "string" && structured.message.trim() !== ""
      ? structured.message
      : fallback
  return new ApiRefusal(res.status, title, message)
}

async function call<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/retention${path}`, { ...init, headers })
  if (!res.ok) throw await refusal(res, fallback)
  return (await res.json()) as T
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) })

// ── routes (275-03-SUMMARY.md, "Final route list") ─────────────────────────────────────────

export function getRetentionSummary(): Promise<RetentionSummary> {
  return call("/summary", { method: "GET" }, "Couldn't load retention.")
}

export function listPolicies(): Promise<PolicyList> {
  return call("/policies", { method: "GET" }, "Couldn't load the policies.")
}

export function previewPolicy(draft: PolicyDraft, policyId?: string | null): Promise<PolicyPreview> {
  return call(
    "/policies/preview",
    post(policyId ? { draft, policy_id: policyId } : { draft }),
    "Preview couldn't finish.",
  )
}

export function createPolicy(draft: PolicyDraft): Promise<RetentionPolicy> {
  return call("/policies", post(draft), "Couldn't save the policy.")
}

export function updatePolicy(id: string, draft: PolicyDraft): Promise<RetentionPolicy> {
  return call(`/policies/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(draft) }, "Couldn't save the policy.")
}

export function removePolicy(id: string): Promise<{ id: string; name: string }> {
  return call(`/policies/${encodeURIComponent(id)}`, { method: "DELETE" }, "Couldn't remove the policy.")
}

export function listDocumentTypes(): Promise<DocumentTypeCount[]> {
  return call("/document-types", { method: "GET" }, "Couldn't load the document types.")
}

export function listHolds(): Promise<HoldList> {
  return call("/holds", { method: "GET" }, "Couldn't load the legal holds.")
}

export function createHold(body: { name: string; reason: string } & HoldCoverage): Promise<LegalHold> {
  return call("/holds", post(body), "Couldn't place the hold.")
}

export function addHoldCoverage(holdId: string, body: HoldCoverage): Promise<LegalHold> {
  return call(`/holds/${encodeURIComponent(holdId)}/coverage`, post(body), "Couldn't add to the hold.")
}

export function releaseHold(holdId: string, note?: string | null): Promise<LegalHold> {
  return call(`/holds/${encodeURIComponent(holdId)}/release`, post(note ? { note } : {}), "Couldn't release the hold.")
}

export function countHoldCoverage(body: HoldCoverage): Promise<{ count: number }> {
  return call("/holds/count", post(body), "Couldn't count the documents.")
}

export function listQueue(): Promise<QueueList> {
  return call("/queue", { method: "GET" }, "Couldn't load what is waiting.")
}

/** The sentence a confirm refusal carries when the server sent none of its own (275-REVIEW F-WR-01). */
export const CONFIRM_FALLBACK = "Couldn't confirm the batch."

export function confirmBatch(policyId: string, body: ConfirmBatchBody): Promise<ConfirmResult> {
  return call(`/queue/${encodeURIComponent(policyId)}/confirm`, post(body), CONFIRM_FALLBACK)
}

export function unarchiveDocument(documentId: string): Promise<UnarchiveResult> {
  return call(`/documents/${encodeURIComponent(documentId)}/unarchive`, post({}), "Couldn't un-archive.")
}

export function listHistory(offset = 0, limit = 50): Promise<HistoryPage> {
  return call(`/history?offset=${offset}&limit=${limit}`, { method: "GET" }, "Couldn't load the history.")
}

export function runSweepNow(): Promise<SweepRunResult> {
  return call("/sweep/run", post({}), "The sweep failed. Nothing was changed.")
}

export function getDocumentStates(body: HoldCoverage): Promise<DocumentStatesResponse> {
  return call("/document-states", post(body), "Couldn't load retention.")
}
