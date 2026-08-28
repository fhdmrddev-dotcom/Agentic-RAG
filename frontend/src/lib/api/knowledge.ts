/**
 * Phase 207 — domain module split out of `lib/api.ts`.
 *
 * ⚠ MOVED VERBATIM, NOT REWRITTEN. `lib/api.ts` is still the only public entry
 * point and keeps its path, because suites mock this module BY PATH and `196-08`
 * measured 249 red tests from a single added export. Nothing outside `lib/` moves.
 *
 * ⚠ This docblock deliberately does NOT spell the mock call it describes: the
 * acceptance census greps for that literal, and prose containing it inflates the
 * count it is supposed to hold still (the 187-24 trap — measured here, not feared).
 */

import type { ClassificationRule, Document, MetadataFieldDef, RelType, RelatedDocumentsResponse, Relationship, SavedView, ViewFilter } from "../../types"
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
import type { FeedbackRequest, FeedbackStats, HealthOverview, HealthSummary, LowConfidenceDoc, LowConfidenceQuery, MostRetrievedDoc, NeverRetrievedDoc, PaginatedResponse, RetrievalTrendPoint, StaleDoc } from "./settings"
export async function getKnowledgeHealthSummary(staleDays = 90): Promise<HealthSummary> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/summary?stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load health summary")
  return res.json() as Promise<HealthSummary>
}

export async function getHealthOverview(staleDays = 90): Promise<HealthOverview> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/overview?stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load health overview")
  return res.json() as Promise<HealthOverview>
}

export async function getMostRetrieved(offset = 0, limit = 20): Promise<PaginatedResponse<MostRetrievedDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/most-retrieved?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load most retrieved documents")
  return res.json() as Promise<PaginatedResponse<MostRetrievedDoc>>
}

export async function getNeverRetrieved(offset = 0, limit = 20): Promise<PaginatedResponse<NeverRetrievedDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/never-retrieved?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load never retrieved documents")
  return res.json() as Promise<PaginatedResponse<NeverRetrievedDoc>>
}

export async function getStaleDocs(offset = 0, limit = 20, staleDays = 90): Promise<PaginatedResponse<StaleDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/stale?offset=${offset}&limit=${limit}&stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load stale documents")
  return res.json() as Promise<PaginatedResponse<StaleDoc>>
}

export async function getLowConfidenceDocs(offset = 0, limit = 20): Promise<PaginatedResponse<LowConfidenceDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/low-confidence/documents?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load low confidence documents")
  return res.json() as Promise<PaginatedResponse<LowConfidenceDoc>>
}

export async function getLowConfidenceQueries(offset = 0, limit = 20): Promise<PaginatedResponse<LowConfidenceQuery>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/low-confidence/queries?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load low confidence queries")
  return res.json() as Promise<PaginatedResponse<LowConfidenceQuery>>
}

export async function getRetrievalTrend(days = 30): Promise<RetrievalTrendPoint[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/retrieval-trend?days=${days}`, { headers })
  if (!res.ok) throw new Error("Failed to load retrieval trend")
  return res.json() as Promise<RetrievalTrendPoint[]>
}

// ── Phase 119 (DGOV-01/02) — Document Governance Health ──────────────────────
// Three read-only fetch helpers wrapping the Plan-01 `document_governance` router
// (`backend/app/api/document_governance.py`). Each mirrors the knowledge-health
// helpers above verbatim — getAuthHeaders() + throw-on-non-ok — and returns the
// shared `{items, total, offset, limit}` PaginatedResponse shape the 3 stacked
// Governance cards consume. Read-only / owner-scoped server-side; no write path.

/** A broken-relationship row (D-119-3). `readable_doc_id` (aliased `document_id`)
 *  is the OPENABLE end of a dangling edge — it MAY be null when both ends are
 *  gone, so the row link-out must guard the click. The broken end can't be opened. */
export interface GovBrokenItem {
  relationship_id: string
  rel_type: string
  broken_doc_id: string
  /** The openable end (the broken end's surviving counterpart). Null when both ends are gone. */
  readable_doc_id: string | null
  /** Alias of `readable_doc_id` — the doc the row navigates to. Null guards the link-out. */
  document_id: string | null
}

/** An unclassified-document row (D-119-4) — a doc with a pending
 *  `_classification.status == "suggested"`. */
export interface GovUnclassifiedItem {
  document_id: string
  filename: string
  folder_id: string | null
  suggested_folder_name?: string | null
}

/** A low-confidence-metadata row (D-119-5) — a doc with any extracted field whose
 *  `_confidence[field] < 0.5`. `min_confidence` is the worst field's RAW score
 *  (rendered honestly via the 112 ConfidenceChip, never fabricated). */
export interface GovLowConfidenceItem {
  document_id: string
  filename: string
  folder_id: string | null
  low_fields: Record<string, number>
  min_confidence: number
}

// Phase 148 (VIS-01 / D-04): the three `document-governance` signal reads are
// governed by `require_visible('governance_health')` (148-05). They throw `ApiError`
// (carrying `res.status`) — NOT a plain Error — so a mid-session governance_health
// tighten surfaces the 403 through the D-04 graceful bounce (GovernancePage auto-fetches
// all three on mount, so a non-operator landing after a tighten bounces home instead of
// dead-ending). ApiError extends Error, so existing message-only catch sites are unaffected.
export async function getGovBroken(offset = 0, limit = 20): Promise<PaginatedResponse<GovBrokenItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/broken-relationships?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load broken relationships", res.status)
  return res.json() as Promise<PaginatedResponse<GovBrokenItem>>
}

export async function getGovUnclassified(offset = 0, limit = 20): Promise<PaginatedResponse<GovUnclassifiedItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/unclassified?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load unclassified documents", res.status)
  return res.json() as Promise<PaginatedResponse<GovUnclassifiedItem>>
}

export async function getGovLowConfidence(offset = 0, limit = 20): Promise<PaginatedResponse<GovLowConfidenceItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/low-confidence?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load low-confidence metadata", res.status)
  return res.json() as Promise<PaginatedResponse<GovLowConfidenceItem>>
}

export async function moveDocument(id: string, folderId: string | null): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/move`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ folder_id: folderId }),
  })
  if (!res.ok) throw new Error("Failed to move document")
  return res.json() as Promise<Document>
}

export async function reingestDocument(id: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/reingest`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new Error("Failed to reingest document")
  return res.json() as Promise<Document>
}

/** Phase 112 (META-02) — manual single-field metadata edit. Clones the
 *  `moveDocument` PATCH shape. The body is `{ field, value }` ONLY — the client
 *  MUST NOT send `source`: the server hard-stamps provenance (`_source='user'`)
 *  so the client can never assert it (T-112-03-02). Returns the updated Document;
 *  the panel reconciles by calling `loadDocuments()` after a 200. */
export async function updateDocumentMetadata(id: string, field: string, value: unknown): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/metadata`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ field, value }),
  })
  if (!res.ok) throw new Error("Failed to update metadata")
  return res.json() as Promise<Document>
}

/** Phase 112 (META-02) — the caller's own + global metadata field definitions.
 *  Thin consumer of the already-secured `GET /metadata-fields` (own-or-global
 *  scoping enforced server-side, T-112-03-03). The panel renders the union of
 *  built-in fields + enabled custom defs. */
export async function listMetadataFields(): Promise<MetadataFieldDef[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/metadata-fields`, { headers })
  if (!res.ok) throw new Error("Failed to load metadata fields")
  return res.json() as Promise<MetadataFieldDef[]>
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 114 (VIEW-03 / UX-01) — saved-view ("virtual folder") CRUD + count.
//
// Thin consumers of the already-leak-safe document-views router (Plans 02/03):
//   POST   /document-views                       create a named saved view
//   GET    /document-views                       list own + global views
//   DELETE /document-views/{id}                  delete an owned view
//   GET    /document-views/{id}/resolve?count_only=true   → {total: N}
//   GET    /document-views/{id}/resolve                    → {documents, total}
//
// The client ONLY assembles the `filter_expr` AST — ALL field-whitelist
// validation + value binding happens server-side (T-114-05-01: the client is not
// a trust boundary). Mirrors the `listMetadataFields` fetch-wrapper conventions.
// ────────────────────────────────────────────────────────────────────────────

/** POST /document-views — persist the current filter as a named saved view
 *  (D-114-1: Save-as-view just persists what you're looking at). The server
 *  hard-sets `is_system_global=false` (the body never supplies it). Returns the new
 *  `SavedView`. */
export async function createView(
  name: string,
  filter_expr: ViewFilter,
  folder_scope?: string | null,
): Promise<SavedView> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      filter_expr,
      ...(folder_scope ? { folder_scope } : {}),
    }),
  })
  if (!res.ok) throw new Error("Failed to save view")
  return res.json() as Promise<SavedView>
}

/** PATCH /document-views/{id} — update an OWNED saved view in place (the
 *  `ViewUpdate` body shape: every field optional, the backend applies only the
 *  keys present via `exclude_none=True`). Used by the FilterBar's edit-on-save
 *  path (D-114-3): after "Edit view" a Save PATCHes the SAME row instead of
 *  POSTing a new one. Mirrors `createView`'s auth-header + fetch shape; the
 *  backend re-runs whitelist validation when `filter_expr` is present and
 *  returns the updated view. 404 on a cross-user / absent id (never 403). */
export async function updateView(
  id: string,
  body: { name?: string; filter_expr?: ViewFilter; folder_scope?: string | null },
): Promise<SavedView> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update view")
  return res.json() as Promise<SavedView>
}

/** GET /document-views — the caller's own + global saved views (leak-safe
 *  server-side, Phase 113). Selecting one loads its `filter_expr` back into the
 *  filter bar (D-114-1). */
export async function listViews(): Promise<SavedView[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views`, { headers })
  if (!res.ok) throw new Error("Failed to list views")
  return res.json() as Promise<SavedView[]>
}

/** DELETE /document-views/{id} — remove an owned view (204; 404 on a cross-user
 *  miss, never 403 — D-113-4). Idempotent from the UI's perspective. */
export async function deleteView(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete view")
}

/** GET /document-views/{id}/resolve — resolve a SAVED view. `count_only` returns
 *  just `{total: N}` (the live builder count + per-view sidebar badges, D-114-15);
 *  the full resolve returns `{documents, total}`. The returned `documents` are
 *  plain rows (no response_model) so `_source`/`_confidence` survive (112 CR-01). */
export async function resolveView(
  id: string,
  opts: { count_only?: boolean } = {},
): Promise<{ documents?: Document[]; total: number }> {
  const headers = await getAuthHeaders()
  const qs = opts.count_only ? "?count_only=true" : ""
  const res = await fetch(`${API_BASE}/document-views/${id}/resolve${qs}`, { headers })
  if (!res.ok) throw new Error("Failed to resolve view")
  return res.json() as Promise<{ documents?: Document[]; total: number }>
}

/** POST /document-views/resolve — STATELESS ad-hoc resolve/count for an UNSAVED
 *  filter (114 CR-01). Carries the `filter_expr` AST inline; the backend runs the
 *  SAME caller-scoped own+global two-leg resolve as the saved-view route but writes
 *  NO `document_views` row and NO audit entry — so it is safe to call on every
 *  debounced keystroke. `count_only` returns `{total}`; otherwise `{documents,
 *  total}` (plain rows so `_source`/`_confidence` survive, 112 CR-01).
 *
 *  This REPLACES the old `createView → resolve → deleteView` dance, which fired a
 *  `view.create` governance-audit row per keystroke that was never cleaned up
 *  (audit-log pollution) and double-round-tripped (the page + the bar each ran
 *  their own transient cycle). */
export async function resolveAdHoc(
  filter_expr: ViewFilter,
  opts: { count_only?: boolean } = {},
): Promise<{ documents?: Document[]; total: number }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/resolve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filter_expr, count_only: opts.count_only ?? false }),
  })
  if (!res.ok) throw new Error("Failed to resolve filter")
  return res.json() as Promise<{ documents?: Document[]; total: number }>
}

/** Live "N documents match" count for an AD-HOC (unsaved) filter (D-114-2).
 *  Thin count-only wrapper over the stateless `resolveAdHoc` endpoint (114 CR-01) —
 *  NO transient view, NO audit pollution. An empty filter (`conditions: []`) is "no
 *  narrowing" and needs no round-trip — the caller short-circuits before calling. */
export async function resolveFilterCount(filter_expr: ViewFilter): Promise<number> {
  const { total } = await resolveAdHoc(filter_expr, { count_only: true })
  return total
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 117 (REL-02 / UX-01) — document-relationships read + create + remove.
//
// Thin consumers of the leak-safe relationship router:
//   GET    /document-relationships?document_id={id}   read outgoing + incoming
//                                                      links (the net-new Plan 02
//                                                      read seam) → RelatedDocumentsResponse
//   POST   /document-relationships                     create an OUTGOING link
//                                                      (visible-both gate server-side)
//   DELETE /document-relationships/{id}                remove an owned link (204;
//                                                      404-tolerant own-scoped delete)
//
// The client is NOT a trust boundary — the per-viewer readability re-check + the
// visible-both create gate are enforced server-side. A masked row arrives with
// `document_id: null` (D-117-8); the client never sees the hidden id/title. Mirrors
// the `document-views` family fetch-wrapper conventions (getAuthHeaders + throw-on-
// non-ok + the 404-tolerant DELETE).
// ────────────────────────────────────────────────────────────────────────────

/** GET /document-relationships?document_id= — a document's outgoing + incoming
 *  typed links (the Plan 02 read seam). Returns the plain dict the panel renders
 *  (subject + total + rows); a row's `document_id` is null for a masked "no access"
 *  endpoint (D-117-8). 404 on an unreadable/unknown subject → throws (the section
 *  renders its honest error state, distinct from empty — D-117-10). */
export async function listRelationships(documentId: string): Promise<RelatedDocumentsResponse> {
  const headers = await getAuthHeaders()
  // encodeURIComponent the id (IN-02, folded into WR-01): doc ids are UUIDs today so
  // this is safe in practice, but defensive URL construction keeps a non-UUID/whitespace
  // value from corrupting the query (and pairs with the route's uniform-404 hardening).
  const res = await fetch(
    `${API_BASE}/document-relationships?document_id=${encodeURIComponent(documentId)}`,
    { headers },
  )
  if (!res.ok) throw new Error("Failed to load relationships")
  return res.json() as Promise<RelatedDocumentsResponse>
}

/** POST /document-relationships — create an OUTGOING link from the open document
 *  (D-117-1: outgoing-only authoring). Body is `{ source_doc_id, target_doc_id,
 *  rel_type }` EXACTLY (mirrors `RelationshipCreate`). The server runs the
 *  visible-both gate + self-link guard; a non-ok (422 = unseeable endpoint /
 *  self-link / forged type, uniform) throws. Idempotent server-side (D-116-6).
 *  Returns the persisted `Relationship` (the POST 201 body).
 *
 *  Throws an `ApiError` carrying `res.status` (WR-03): a 422 is a PERMANENT
 *  rejection (self-link / unseeable / forged type — uniform server-side, never
 *  succeeds on retry), so the caller can render a non-retry-implying message and
 *  reserve "try again" for network/5xx. */
export async function createRelationship(
  source_doc_id: string,
  target_doc_id: string,
  rel_type: RelType,
): Promise<Relationship> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source_doc_id, target_doc_id, rel_type }),
  })
  if (!res.ok) throw new ApiError("Failed to create link", res.status)
  return res.json() as Promise<Relationship>
}

/** DELETE /document-relationships/{id} — remove an owned link (204; either
 *  direction — D-117-2). Own-scoped server-side, so a cross-user/absent id is a
 *  uniform 404 → treated as a no-op (404-tolerant, the `deleteView` pattern):
 *  the link is gone either way, so a 404 is not an error from the UI's view. */
export async function deleteRelationship(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 404) throw new Error("Failed to remove link")
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 118 (CLASS-01 / CLASS-03) — classification-rule CRUD + accept/dismiss.
//
// Thin consumers of the leak-safe classification-rules router (Plans 02/03):
//   GET    /classification-rules                          list own + global rules
//   POST   /classification-rules                          create a rule (is_system_global server-owned)
//   PATCH  /classification-rules/{id}                      update an owned rule (incl. the enabled toggle)
//   DELETE /classification-rules/{id}                      delete an owned rule (204; 404-tolerant)
//   PATCH  /documents/{id}/classification/accept           accept the suggestion (moves + stamps prior_folder_id)
//   PATCH  /documents/{id}/classification/dismiss          dismiss the suggestion (clears _classification; no move)
//
// The client is NOT a trust boundary — the `match_expr` whitelist validation, the
// `is_system_global` hard-set, the own+global leak-safe reads, and the accept-move folder
// re-check are all enforced server-side. The builder's "would match N" live count
// REUSES the existing `resolveAdHoc`/`resolveFilterCount` (a rule's `match_expr` is
// the SAME `ViewFilter` AST) — NO new count fn, NO new backend endpoint. Undo reuses
// the existing `moveDocument(id, prior_folder_id)` — reversible by construction
// (D-118-6). Mirrors the `document-views` family fetch-wrapper conventions
// (getAuthHeaders + throw-on-non-ok + the 404-tolerant DELETE).
// ────────────────────────────────────────────────────────────────────────────

/** GET /classification-rules — the caller's own + global classification rules
 *  (leak-safe server-side, the `.or_()` own+global predicate). The Automation
 *  sidebar group + the rules page render these. */
export async function listRules(): Promise<ClassificationRule[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules`, { headers })
  if (!res.ok) throw new Error("Failed to list rules")
  return res.json() as Promise<ClassificationRule[]>
}

/** POST /classification-rules — create a named rule. The body is
 *  `{ name, match_expr, suggest_folder_id }` ONLY — it NEVER supplies `is_system_global`
 *  (the server hard-sets it false; mirrors `createView`, T-118-04-01). The server
 *  re-runs the `match_expr` whitelist + operand validation (the client is not a
 *  trust boundary). Returns the new `ClassificationRule`. */
export async function createRule(
  name: string,
  match_expr: ViewFilter,
  suggest_folder_id: string | null,
): Promise<ClassificationRule> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, match_expr, suggest_folder_id }),
  })
  if (!res.ok) throw new Error("Failed to create rule")
  return res.json() as Promise<ClassificationRule>
}

/** PATCH /classification-rules/{id} — update an OWNED rule in place (the
 *  `RuleUpdate` body: every field optional, the backend applies only the keys
 *  present). The `enabled` toggle rides THIS path — no separate endpoint. The
 *  backend re-runs whitelist validation when `match_expr` is present and returns
 *  the updated rule. 404 on a cross-user / absent id (never 403). */
export async function updateRule(
  id: string,
  body: { name?: string; match_expr?: ViewFilter; suggest_folder_id?: string | null; enabled?: boolean },
): Promise<ClassificationRule> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update rule")
  return res.json() as Promise<ClassificationRule>
}

/** DELETE /classification-rules/{id} — remove an owned rule (204; 404 on a
 *  cross-user miss, never 403). Idempotent from the UI's perspective (the
 *  `deleteView` 404-tolerant pattern). */
export async function deleteRule(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete rule")
}

/** PATCH /documents/{id}/classification/accept — accept the doc's active
 *  classification suggestion. The server moves the doc to the suggested folder,
 *  stamps `prior_folder_id` (the Undo target, D-118-6), flips the suggestion
 *  `status` to `"accepted"`, and writes the `classification.apply` audit AFTER
 *  the move succeeds. Returns the updated Document; the section reconciles by
 *  re-fetching (not optimistic). Undo = `moveDocument(id, prior_folder_id)`. */
export async function acceptClassification(docId: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${docId}/classification/accept`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) throw new Error("Failed to accept classification")
  return res.json() as Promise<Document>
}

/** PATCH /documents/{id}/classification/dismiss — dismiss the doc's active
 *  classification suggestion. The server clears `_classification` from the doc's
 *  metadata; NO move, NO audit. Returns the updated Document; the section
 *  reconciles by re-fetching (not optimistic). */
export async function dismissClassification(docId: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${docId}/classification/dismiss`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) throw new Error("Failed to dismiss classification")
  return res.json() as Promise<Document>
}

// -- Feedback API functions ---------------------------------------------------

/**
 * Submit thumbs-up or thumbs-down rating for an assistant message.
 * Returns raw Response so callers can inspect status 409 (already rated) themselves.
 * Throws only on network errors, never on HTTP error status codes.
 */
export async function submitFeedback(body: FeedbackRequest): Promise<Response> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  return res
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/feedback/stats`, { headers })
  if (!res.ok) throw new Error("Failed to load feedback stats")
  return res.json() as Promise<FeedbackStats>
}

// ── Workflow authoring API (Phase 103, REQ-1 / REQ-2 / REQ-6) ────────────────
//
// The client layer the Builder (Plan 04), the publish gauntlet (Plan 05), and
// the Workflows page (Plan 06) all consume. Mirrors the new /workflows authoring
// routes from Plans 01/02 (NEVER threads.py). The load-bearing contract is that
// the client NEVER re-derives a server verdict and NEVER swallows a 409/404 as
// success (threat T-103-03-01 / -04).

/** A permissive `WorkflowDefinition` JSONB alias — the Builder (Plan 04) refines
 *  the real shape. The authoring CRUD/generate fns pass it through opaquely. */
export type WorkflowDefinitionJSON = Record<string, unknown>

/** Mirror of the backend `PublishVerdict` (api/workflows.py:84-93). Rendered
 *  VERBATIM by the publish-gauntlet UI — the client never re-derives any field.
 *  `named_failures` is POLYMORPHIC across stages (lint `{code,phase,message}` /
 *  judge `{criterion,score,evidence}` / `{summary}` / bare string) so it is typed
 *  `unknown[]` and rendered by KEY-DETECTION in Plan 05 (D-103-CONF-3). */
export interface PublishVerdict {
  published: boolean
  version: number | null
  golden_run_id: string | null
  blocked_stage: string | null
  named_failures: unknown[]
  /**
   *  ── BUG-260828-09 — THE JOIN NOTHING PERFORMED, NOW ON THE WIRE ─────────────────────
   *  Which step of the AUTHOR'S OWN workflow stopped the golden run, and why. `null` on
   *  every block that cannot name one (a lint block, a judge block, a crash before any
   *  phase ran) and absent entirely from a pre-fix server, which is why it is optional.
   *
   *  ⚠ **IT IS A FIELD OF ITS OWN AND NOT A SIXTH `named_failures` SHAPE.** That array is
   *  POLYMORPHIC and its consumers must detect shape PER ENTRY, never switch on
   *  `blocked_stage` (`PublishGauntlet.tsx` docblock rule 4). A refusal that LEADS the
   *  surface must not be reachable only by a successful shape guess, so the array is
   *  untouched — every existing entry renders byte-for-byte as it did.
   *
   *  ⚠ **`step_name` IS `null` WHEN THE AUTHOR NAMED NOTHING, AND IS NEVER THE SLUG.** The
   *  server enforces that at the producer; the visible face is resolved on this side through
   *  `phaseVocabulary.nodeTitle`. Read it via `publishBlockedStep.blockedStepOf` — this
   *  declaration is the wire shape, that module is the one consumer contract.
   *
   *  `cause` leads; `reason` is the same sentence with its `Phase {n} ({slug}) …:` machine
   *  prefix intact and belongs in the raw disclosure. When the prefix does not match, `cause`
   *  IS `reason`, so a surface leading with `cause` can never render empty.
   */
  blocked_step?: {
    step_slug?: string | null
    step_index?: number | null
    step_name?: string | null
    reason?: string | null
    cause?: string | null
  } | null
}

/** Phase 214 (STEP-03) — the OPTIONAL keys a publish-refusal entry may carry, so a refusal can
 *  name the STEP and the ARGUMENT it is about.
 *
 *  ⚠ **`named_failures` STAYS `unknown[]` AND THAT IS DELIBERATE.** It is POLYMORPHIC across
 *  stages — lint `{code,phase,message}`, judge `{criterion,score,evidence}`, `{summary}`, a
 *  bare string — and `PublishGauntlet.tsx`'s docblock rule 4 requires KEY DETECTION PER ENTRY,
 *  never a switch on `blocked_stage`. Narrowing the array to this shape would break every
 *  other stage's rendering, so this type describes an entry a consumer may DETECT, and the
 *  array's element type is untouched.
 *
 *  ⚠ **ALL THREE KEYS ARE OPTIONAL, and the reason is compatibility rather than laziness.** An
 *  entry produced before Phase 214, or by any of the other stages, carries none of them and
 *  **must still render**. A required key here would be a claim about every stage's output that
 *  nothing enforces.
 *
 *  ⚠ TYPE-ONLY — plan `214-10` supplies the values; no call site reads these yet. */
export interface PublishNamedFailure {
  /** The AUTHORED name of the step the refusal is about — never its slug, never its index. */
  step_name?: string
  /** The argument that could not be proved satisfiable. `null` when the refusal is about the
   *  step as a whole rather than one of its arguments — a different fact from absent. */
  argument?: string | null
  /** The upstream step a `From an earlier step` binding named, when THAT is what failed.
   *  `null` when the failing arm was `Fixed value` or `Ask at launch`. */
  upstream?: string | null
}

/** A lint failure entry (the 5 LOWERCASE `LintError.code` literals:
 *  bad_index / unsatisfiable_skip / orphan_phase / no_terminal / input_unsatisfied). */
export interface LintError {
  code: string
  phase: string
  message: string
}

/** A draft row from GET /workflows/drafts (owner-scoped on the backend).
 *
 *  Phase 103-06 (REQ-7 D9/D10): `definition` is the ADDITIVE full WorkflowDefinition
 *  JSONB the drafts-shelf card uses to derive the tier badge + phase chain
 *  client-side. Optional — pre-103 shelf callers ignore it. */
export interface WorkflowDraftRow {
  id: string
  slug: string
  version: number
  name: string | null
  definition?: WorkflowDefinitionJSON | null
  /**
   * OPAQUE concurrency token (Phase 186 / D-186-07). Echo it VERBATIM on the next
   * PATCH and treat it as bytes with no internal structure.
   *
   * NEVER PARSE IT INTO A JS DATE VALUE — not with the `Date` constructor, not with
   * `Date.parse`, not with any library that wraps either. Postgres keeps microseconds
   * and a JS date value keeps only milliseconds, so a parsed-and-re-rendered token is
   * truncated and matches ZERO rows: every save would then refuse as stale (probed
   * against the live database, 2026-08-01). The server renders it and the server
   * compares it; this client only carries it.
   *
   * ⚠ IF YOU CAME HERE WANTING A TIMESTAMP, THE FIELD YOU WANT IS `updated_at` DIRECTLY
   * BELOW. Phase 192.1 (D-16) added it as a SEPARATE field precisely because this one must
   * never be parsed as a date, even though both are rendered from the same
   * `workflow_definitions.updated_at` column server-side. Two fields off one column is the
   * intended shape, not duplication.
   */
  token: string
  /**
   * Phase 192.1 (LIB-05 / D-15) — when this draft last changed, ISO-8601 as the server
   * rendered it. Feeds the library identity line's "changed <rel>" segment.
   *
   * PLACED HERE, ADJACENT TO `token`, ON PURPOSE: this is where a reader wondering why there
   * are two near-identical timestamps will look. See the ⚠ paragraph on `token` above — the
   * token is opaque and comparison-only; this field is formattable and display-only. They
   * are never interchangeable, and collapsing them makes every save after the first refuse
   * as stale.
   *
   * Optional and nullable on the same stale-deploy contract as `PublishedWorkflow`:
   * `undefined` is "the wire did not say", rendered as no `changed` segment.
   */
  updated_at?: string | null
  /**
   * Phase 192.2 (LIB-06 / D-07 / D-08) — when this DRAFT last ran, and what that run did.
   * The mirror of the two fields on `PublishedWorkflow`; read their docblocks for the
   * three-state rule, which is identical here and is the load-bearing part.
   *
   * ⚠ A DRAFT'S RUN IS ITS GOLDEN RUN, AND COUNTING IT IS DELIBERATE. A draft cannot be Run
   * from the library — publish IS the test — so the only runs a draft has are the ones the
   * publish gauntlet made. *"Your test run failed"* is exactly the answer LIB-06 asks for on
   * a shelf that is 69% drafts, so the join does not exclude them.
   *
   * ⚠ AND NEITHER OF THESE IS `token`. See the ⚠ paragraph on that field above: it is opaque
   * by contract and parsing it as a date breaks every later save. These two are display
   * fields off a different table entirely.
   */
  last_run_at?: string | null
  /**
   * Phase 192.2 (LIB-06 / D-08) — the RAW `workflow_runs.status` of the run `last_run_at`
   * describes. The mirror of `PublishedWorkflow.last_run_status`; read that docblock for the
   * three-state rule and for why it is `string` rather than a union.
   *
   * ⚠ WR-02-LOOKALIKE-LAST-RUN-STATUS — THREE IDENTICALLY-TYPED `last_run_status?: string | null`
   * FIELDS EXIST IN THIS FILE, AND A SWAP BETWEEN ANY TWO OF THEM TYPECHECKS. They live on
   * `ThreadWorkflowState`, on `PublishedWorkflow` and on `WorkflowDraftRow`. Named by TYPE and
   * never by line number, because a line number rots on the next edit to this 6,000-line file.
   *
   *   · `ThreadWorkflowState.last_run_status` — THE LIVE THREAD's last `workflow_runs` row,
   *     keyed to `last_workflow_run_id`. Paired with `last_run_created_at`.
   *   · `PublishedWorkflow.last_run_status` and `WorkflowDraftRow.last_run_status` — THE
   *     LIBRARY ROW's last run, OWNER-SCOPED (`r.user_id = $1`). Both paired with `last_run_at`.
   *
   * ⚠ AND THE TWO TIMESTAMP NAMES ARE THE SAME COLUMN. `last_run_created_at` (on
   * `ThreadWorkflowState`) and `last_run_at` (on the two library rows) BOTH render
   * `workflow_runs.created_at`. That divergence is KNOWN AND DECIDED (192.2-10 DEC-10-B), not an
   * oversight: renaming either one is a wire change across the backend, three serializers, two
   * interfaces here and both library normalizers — a large blast radius to make two names agree
   * about a readability defect, taken inside a gap-closure round, on the hottest file in this
   * repository. `last_run_at` is also the better name for the question the LIBRARY asks (*when
   * did it last run*), where `last_run_created_at` names the column's provenance for a surface
   * that also shows `last_run_updated_at`. The rename is DECLINED; the cross-reference is the fix.
   *
   * The marker token above is bound by `apiRunFields.fences.test.ts`, which counts THREE
   * declarations and THREE markers. Deleting one of these paragraphs reds it.
   */
  last_run_status?: string | null
  /**
   * Phase 192.2 (LIB-06 / CR-01) — the mirror of `PublishedWorkflow.has_any_run`; read THAT
   * docblock for the three states and the disclosure budget, which are identical here and are
   * the load-bearing part.
   *
   * ⚠ MIRRORED FOR CONSISTENCY, AND SAYING SO IS THE POINT. `/workflows/drafts` is already
   * scoped to `created_by = $1`, so on this feed the caller is normally the only person with
   * runs and the row-level bit AGREES with the two owner-scoped fields above. That agreement is
   * a property of THIS FEED, not an invariant of the pair — leaving the field off here would
   * have made *"the two facts agree"* an unstated assumption that the next feed quietly breaks.
   */
  has_any_run?: boolean | null
}

/**
 * What a draft WRITE answers with — the create (201) and the PATCH (200) return the
 * identical shape, so both share this type (Phase 186 / D-186-07).
 *
 * `token` is the value the NEXT write must echo. A save that dropped it would leave the
 * following one guarded by a token the server has already superseded, which is a
 * self-inflicted stale refusal on the second keystroke.
 *
 * NOTE ON THE PATCH's RETURN TYPE. `updateWorkflowDraft` was declared as returning
 * `WorkflowDefinitionJSON`; that was a type lie from the start — the route has always
 * answered `DraftCreateResponse` (`api/workflows.py`), and nothing read the result, so
 * nothing noticed. It is corrected here rather than left, because the autosave hook now
 * genuinely reads the response to chain the next write.
 */
export interface WorkflowDraftWriteResult {
  id: string
  version: number
  token: string
}

/** Phase 197 (D-13) — the server's publish-readiness verdict for ONE generated draft.
 *  THREE representable states, and the THIRD IS THE ABSENCE OF THIS WHOLE OBJECT:
 *  `{status:"present"}` · `{status:"missing", message}` · the field not there at all.
 *  ⚠ ABSENT MEANS THE SERVER SAID NOTHING — never that everything is fine. A
 *  `readiness ?? {}` default, or a `=== "missing"` read whose false branch renders a
 *  green tick, collapses that third state into the first. Both are the shipped floor
 *  in one shape: `useModelRegistry`'s (a failed read is `status:"failed"`, never an
 *  empty success) and `model_registry`'s (an ABSENT override row means ENABLED).
 *  ⚠ ONE ENTRY, DELIBERATELY. Measured across the whole publish gauntlet, stage 1's
 *  `business_requirement` is the ONLY definition-level predicate — nothing anywhere
 *  refuses a publish for a missing knowledge-base binding, a missing document, the
 *  AI-chosen name or the deliverable. A second key here would be a claim no gate makes.
 *  ⚠ IT RIDES THE `ok:true` ARM ALONE. A failed generation carries no verdict
 *  server-side, so reading one off the failure arm is a typecheck error here too. */
export type GenerateReadiness = {
  business_requirement:
    | { status: "present" }
    | { status: "missing"; message: string }
}

/** The structured result of POST /workflows/generate. The route returns HTTP 200
 *  even on a FAILED generation (`ok:false`) — read the body, never throw on it. */
export type GenerateResult =
  | { ok: true; definition: WorkflowDefinitionJSON; readiness?: GenerateReadiness }
  | { ok: false; error: string; detail?: string }

/** The body of POST /workflows/generate (D-103-CONF-2 / D-103-3 template supply). */
export interface GenerateWorkflowBody {
  describe: string
  project_folder_id?: string | null
  template_asset_id?: string | null
  template_placeholders?: string[]
  /** Phase 214 (STEP-01 / D-214-13) — the connections the author allows a generated workflow to
   *  bind an external step to.
   *
   *  ⚠ **ABSENT AND EMPTY ARE DIFFERENT FACTS AND MUST NEVER COLLAPSE.**
   *    · **absent (`undefined`)** — today's UNCONSTRAINED behaviour: the author expressed no
   *      preference, and generation may bind whatever it legitimately can.
   *    · **`[]` (empty array)** — the author's DECISION that **no external step may be
   *      emitted at all**. It is a constraint, not a missing value.
   *
   *  Coalescing an absent value to an empty array turns "no preference" into "forbid
   *  everything"; coalescing an empty array to `undefined` turns "forbid everything" into "no
   *  preference". ⚠ **Neither forbidden form is SPELLED here**: the fence that refuses them
   *  sweeps `src/`, and a docblock quoting one would count its own prose — the 187-24 trap,
   *  which fired on this very field during Phase 214 and is recorded rather than predicted.
   *  Both are one character of convenience buying a silently wrong outbound decision — the same
   *  `0`-vs-`null` family this module documents on `WorkflowRunPhase.step_count`. Branch on
   *  `=== undefined` explicitly. A fence in `lib/apiRunFields.fences.test.ts` sweeps `src/`
   *  for both collapses at zero occurrences.
   *
   *  ⚠ TYPE-ONLY — plan `214-13` supplies the values; no call site sends this yet. */
  allowed_connection_ids?: string[]
}

/** The 4 distinguished outcomes of POST /workflows/{id}/publish. A binary
 *  `200 = ok / else = error` handler is FORBIDDEN — a 200 can carry a BLOCK
 *  (`published:false`), and 400/404/409 each mean something distinct. */
export type PublishOutcome =
  | { kind: "verdict"; verdict: PublishVerdict }
  | { kind: "business_requirement"; verdict: PublishVerdict }
  | { kind: "not_found" }
  | { kind: "already_published" }

/** A published-row mutation (or a cross-user attempt resolving to a published
 *  row) → HTTP 409. Thrown (never swallowed) so the UI surfaces it instead of a
 *  silent overwrite (T-103-03-04). */
