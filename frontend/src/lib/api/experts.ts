/**
 * Phase 260 / Phase 261 — domain module for Expert Bundles, AI drafting, and access grants.
 */

import type { ExpertBundle } from "../../types"
import { API_BASE, ApiError, entitlementRefusalMessage, getAuthHeaders } from "./_core"

export interface ExpertBundleCreate {
  name: string
  slug: string
  description?: string
  icon?: string
  category?: string
  when_to_use?: string
  example_output?: string
  scope_mode?: "restricted" | "biased"
  tool_floor_enabled?: boolean
  member_skills?: string[]
  required_connections?: string[]
  knowledge_folder_ids?: string[]
  prompt_suggestions?: Array<{ title: string; prompt: string }>
  visibility?: "private" | "org" | "public" | "granted"
  is_enabled?: boolean
  /** 263-REVIEW.md WR-08 - names CREATED in this authoring session, and only those.
   *  The server stamps ONLY these born-for. Request-only: never persisted, never
   *  on a response. Sent even when empty - an absent field means "this client said
   *  nothing" and stamps nothing, so [] is the positive statement. */
  born_skills?: string[]
}

/** ⛔ 263-REVIEW.md WR-03 - `slug` is ABSENT BY DECISION (operator, 2026-09-22), not by
 *  omission. It is immutable after creation: `get_expert_by_slug_service` resolves by it,
 *  so a rename silently invalidates anything holding the old value. The server model has
 *  no `slug` field either, and the studio renders the input readOnly in edit mode. This
 *  interface used to declare it, the studio used to send it, and it was DROPPED in silence
 *  while the save reported success. */
export interface ExpertBundleUpdate {
  name?: string
  icon?: string
  category?: string
  when_to_use?: string
  example_output?: string
  description?: string
  scope_mode?: "restricted" | "biased"
  tool_floor_enabled?: boolean
  member_skills?: string[]
  required_connections?: string[]
  knowledge_folder_ids?: string[]
  prompt_suggestions?: Array<{ title: string; prompt: string }>
  visibility?: "private" | "org" | "public" | "granted"
  is_enabled?: boolean
  /** 263-REVIEW.md WR-08 - names CREATED in this authoring session, and only those.
   *  The server stamps ONLY these born-for. Request-only: never persisted, never
   *  on a response. Sent even when empty - an absent field means "this client said
   *  nothing" and stamps nothing, so [] is the positive statement. */
  born_skills?: string[]
}

export interface ExpertGrant {
  id: string
  expert_id: string
  grantee_type: "user" | "role"
  grantee_id: string
  created_at: string
}

export interface ExpertGrantCreate {
  grantee_type: "user" | "role"
  grantee_id: string
}

/** Phase 266 (PACK-18 / PACK-19): the active org's install of a first-party Expert, as the
 *  server derives it. Wire type — declared HERE beside its siblings and imported by `@/types`
 *  with `import type` (elided at compile, so no runtime cycle).
 *  ⛔ The UI never decides readiness: `state` and `can_install` are server facts. `cause` is a
 *  raw string and is NEVER rendered as-is — `installView` (expertCatalog.ts) classifies it. */
export interface ExpertInstallState {
  state: "not_installed" | "installing" | "ready" | "failed"
  folder_id: string | null
  cause: string | null
  cause_source: "document" | "install" | null
  can_install: boolean
  updated_at: string | null
}

/** Phase 267 (PACK-22 · D-267-05): one required connection's state in the active org, as the
 *  server derives it from the ONE "is it connected" rule (`connection_states`, 267-01). Wire type,
 *  declared beside `ExpertInstallState` and imported by `@/types` with `import type`.
 *  ⛔ Server facts, the UI never decides readiness: `connected` (and the row's `can_connect`) are
 *  read by `connectionGate` (expertCatalog.ts) and by nothing else. */
export interface ExpertConnectionState {
  slug: string
  name: string
  connected: boolean
}

/** `POST /experts/{id}/install` → 202. */
export interface ExpertInstallResult {
  expert_bundle_id: string
  corpus_version: string
  install: ExpertInstallState
}

/** One row of `GET /experts/installs` — the active org's installs, for Library provenance. */
export interface ExpertInstallSummary {
  expert_bundle_id: string
  expert_name: string
  folder_id: string
  state: ExpertInstallState["state"]
}

/** Phase 263 (PACK-14): one capability the drafter judged the Expert needs and the
 *  library does not have. Wire type — it lives HERE, beside `ExpertDraftOutput`, because
 *  the studio already imports that from `@/lib/api/experts` rather than from `@/types`. */
export interface SuggestedNewSkill {
  name: string
  description: string
  why_needed: string
}

export interface ExpertDraftOutput {
  name: string
  slug: string
  description: string
  icon: string
  category: string
  when_to_use: string
  example_output: string
  scope_mode: "restricted" | "biased"
  member_skills: string[]
  required_connections: string[]
  knowledge_folder_ids: string[]
  prompt_suggestions: Array<{ title: string; prompt: string }>
  tool_floor_enabled: boolean
  /** Phase 263 — REQUIRED on the server model (`ExpertDraftOutput`), and may be `[]`. */
  suggested_new_skills: SuggestedNewSkill[]
}

/** Phase 263 (PACK-15): one authored skill body, for HUMAN REVIEW before it is saved.
 *  ⛔ Receiving this is not creating anything — the row is written by `POST /skills`. */
export interface AuthoredSkillBody {
  instructions: string
  summary: string
}

/** Phase 263 (PACK-16 / D-263-10): a typed carrier for the structured 422 save-time
 *  refusal, so the banner renders the SERVER's names rather than re-deriving them from a
 *  client-side library snapshot that may be stale. Mirrors `PublishGateError` in
 *  `lib/api/skills.ts` — a named Error with one `readonly` typed field. */
export class ExpertMemberSkillsUnknownError extends Error {
  readonly unknownSkills: string[]
  constructor(unknownSkills: string[], message?: string) {
    super(
      message ||
        `${unknownSkills.length} of this Expert's capabilities do not exist in your library: ${unknownSkills.join(", ")}.`,
    )
    this.unknownSkills = unknownSkills
    this.name = "ExpertMemberSkillsUnknownError"
  }
}

/** Phase 263 (D-263-14): the operator's FLAG-01 kill-switch, NOT an outage. It is a
 *  distinct type because the 503 arm means the opposite thing — "try again later" — and
 *  the author's next action differs: here they write the instructions by hand. */
export class SkillBodyDisabledError extends Error {
  constructor(message?: string) {
    super(
      message ||
        "AI drafting of skill instructions is turned off. You can still create the skill and write its instructions yourself.",
    )
    this.name = "SkillBodyDisabledError"
  }
}

/** Read the structured `detail` object off an error response, or `undefined` when the body
 *  is absent, non-JSON, or FastAPI's own LIST-bodied request-validation payload.
 *  ⛔ The `error` discriminator is mandatory, not defensive: FastAPI reserves 422 for
 *  `RequestValidationError`, whose `detail` is an ARRAY. A bare `res.status === 422` arm
 *  would swallow a genuine Pydantic failure and throw the wrong error type at the dialog. */
async function readRefusalDetail(
  res: Response,
): Promise<{ error?: string; detail?: string; unknown_skills?: unknown } | undefined> {
  try {
    const j = (await res.clone().json()) as { detail?: unknown }
    const d = j?.detail
    if (d && typeof d === "object" && !Array.isArray(d)) {
      return d as { error?: string; detail?: string; unknown_skills?: unknown }
    }
  } catch {
    /* non-JSON or malformed body — the caller falls through to handleResponse */
  }
  return undefined
}

async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  if (!res.ok) {
    let msg = fallbackError
    try {
      const err = await res.json()
      if (typeof err.detail === "string") {
        msg = err.detail
      } else if (err.detail?.detail) {
        msg = err.detail.detail
      } else if (err.detail?.upgrade_hint) {
        msg = err.detail.upgrade_hint
      } else if (Array.isArray(err.detail) && err.detail.length > 0) {
        msg = err.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ")
      } else if (err.message) {
        msg = err.message
      }
    } catch {
      // Keep default
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function listExperts(
  includeSystem = true,
  enabledOnly = true,
  forManagement = false,
): Promise<ExpertBundle[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (!includeSystem) params.set("include_system", "false")
  if (!enabledOnly) params.set("enabled_only", "false")
  if (forManagement) params.set("for_management", "true")
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API_BASE}/experts${qs}`, { headers })
  return handleResponse<ExpertBundle[]>(res, "Failed to list experts")
}

export async function getExpert(bundleId: string): Promise<ExpertBundle> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, { headers })
  return handleResponse<ExpertBundle>(res, "Failed to get expert")
}

// ── Phase 267 plan 04 (PACK-25 · D-267-17..19) — the restricted-cost preview ────────────────────
//
// What a restricted Expert WILL and WILL NOT read on this thread, asked BEFORE the invite. The
// route lives under `/threads` (it is a statement about a thread's scope) but its shape is an
// Expert's, so it is declared here beside the other Expert reads. ⛔ One response feeds both
// ledger columns: the `Won't use · N` heading is `excluded_count`, never a list length.

export interface ExpertScopePreview {
  expert_id: string
  expert_name: string
  mode: "biased" | "restricted"
  /** Server-named; `name: null` = a folder the caller cannot see. */
  expert_folders: { id: string; name: string | null }[]
  thread_folder: { id: string; name: string; doc_count: number } | null
  excluded_count: number
  /** At most five names; `excluded_count` may be larger. */
  excluded_names: string[]
}

export async function getExpertScopePreview(
  expertId: string,
  threadId?: string | null,
): Promise<ExpertScopePreview> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ expert_id: expertId })
  if (threadId) params.set("thread_id", threadId)
  const res = await fetch(`${API_BASE}/threads/expert-scope-preview?${params.toString()}`, { headers })
  if (!res.ok) {
    // The refusal-preserving shape `postMessage` uses: a tier refusal names the plan, any other
    // string detail is the server's own sentence, and only then the generic fallback.
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    throw new ApiError(
      entitlementRefusalMessage(body) ??
        (typeof body?.detail === "string" ? body.detail : "Failed to check the Expert's scope"),
      res.status,
    )
  }
  return res.json() as Promise<ExpertScopePreview>
}

/** Phase 266 (D-266-01 / D-266-02): install a first-party Expert's corpus into the ACTIVE org.
 *  ⛔ No body at all (T-266-24) — the org travels only in the `X-Org-Id` header, which the
 *  server re-validates against membership. A 409 (`expert_not_installable` / `install_conflict`
 *  / `install_folder_not_owned`) and a 403 surface as an Error carrying the server's sentence
 *  through `handleResponse`'s `detail.detail` arm. */
export async function installExpert(bundleId: string): Promise<ExpertInstallResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}/install`, {
    method: "POST",
    headers,
  })
  return handleResponse<ExpertInstallResult>(res, "Failed to install expert")
}

/** Phase 266 (D-266-13): the active org's installs, read for the Library's provenance label.
 *  ⚠ A 403 is the TIER refusal (the whole `/experts` router is capability-gated), and for a
 *  standard-tier org it is the expected answer, not an error — so it becomes `[]` BEFORE
 *  `handleResponse`, the `draftSkillBody` call-site-arm precedent (RESEARCH Pitfall 10). */
export async function listExpertInstalls(): Promise<ExpertInstallSummary[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/installs`, { headers })
  if (res.status === 403) return []
  return handleResponse<ExpertInstallSummary[]>(res, "Failed to list expert installs")
}

export async function createExpert(payload: ExpertBundleCreate): Promise<ExpertBundle> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  await throwIfMemberSkillsUnknown(res)
  return handleResponse<ExpertBundle>(res, "Failed to create expert")
}

/** The status-discriminated arm, placed BEFORE `handleResponse` at each call site.
 *  ⛔ Deliberately NOT a change to `handleResponse` itself: nine functions route through
 *  it, so widening its throw type would change every catch site in the studio and in
 *  `OrgExpertsTab`. `toggleSkillOrgShared` is this repo's precedent for the call-site arm. */
async function throwIfMemberSkillsUnknown(res: Response): Promise<void> {
  if (res.status !== 422) return
  const d = await readRefusalDetail(res)
  if (d?.error === "expert_member_skills_unknown" && Array.isArray(d.unknown_skills)) {
    throw new ExpertMemberSkillsUnknownError(d.unknown_skills as string[], d.detail)
  }
}

export async function updateExpert(bundleId: string, payload: ExpertBundleUpdate): Promise<ExpertBundle> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  await throwIfMemberSkillsUnknown(res)
  return handleResponse<ExpertBundle>(res, "Failed to update expert")
}

export async function deleteExpert(bundleId: string): Promise<{ deleted: boolean; id: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, {
    method: "DELETE",
    headers,
  })
  return handleResponse<{ deleted: boolean; id: string }>(res, "Failed to delete expert")
}

export async function draftExpert(
  description: string,
  files?: File[],
): Promise<ExpertDraftOutput> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  // Strip Content-Type so browser fetch sets multipart/form-data boundary automatically
  const { "Content-Type": _, ...headers } = authHeaders
  const formData = new FormData()
  formData.append("description", description)
  if (files && files.length > 0) {
    for (const f of files) {
      formData.append("files", f)
    }
  }
  const res = await fetch(`${API_BASE}/experts/draft`, {
    method: "POST",
    headers,
    body: formData,
  })
  return handleResponse<ExpertDraftOutput>(res, "Failed to draft expert")
}

/** Phase 263 (PACK-15): ask the platform to author ONE proposed skill's instruction body.
 *  ⛔ A JSON body, in `createExpert`'s shape — NOT `draftExpert`'s FormData shape, which
 *  exists only because that endpoint accepts ephemeral brainstorm files.
 *  The 409 arm is typed because it is the operator's deliberate switch; the 503 "provider
 *  unavailable" arm deliberately arrives as a plain message through `handleResponse`. */
export async function draftSkillBody(payload: {
  skill_name: string
  skill_description: string
  why_needed: string
  expert_name: string
  expert_description: string
}): Promise<AuthoredSkillBody> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts/draft-skill-body`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (res.status === 409) {
    const d = await readRefusalDetail(res)
    if (d?.error === "self_improve_disabled") throw new SkillBodyDisabledError(d.detail)
  }
  return handleResponse<AuthoredSkillBody>(res, "Failed to draft skill instructions")
}

export async function getExpertGrants(bundleId: string): Promise<ExpertGrant[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}/grants`, { headers })
  return handleResponse<ExpertGrant[]>(res, "Failed to get expert grants")
}

export async function addExpertGrant(bundleId: string, payload: ExpertGrantCreate): Promise<ExpertGrant> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts/${bundleId}/grants`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ExpertGrant>(res, "Failed to add expert grant")
}

export async function removeExpertGrant(bundleId: string, grantId: string): Promise<{ deleted: boolean; id: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}/grants/${grantId}`, {
    method: "DELETE",
    headers,
  })
  return handleResponse<{ deleted: boolean; id: string }>(res, "Failed to remove expert grant")
}
