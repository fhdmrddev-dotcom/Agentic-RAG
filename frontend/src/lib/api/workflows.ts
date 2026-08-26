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

import { API_BASE, ApiError, getAuthHeaders, getAuthToken } from "./_core"
import type { GenerateResult, GenerateWorkflowBody, PublishOutcome, PublishVerdict, WorkflowDefinitionJSON, WorkflowDraftRow, WorkflowDraftWriteResult } from "./knowledge"
export class WorkflowConflictError extends Error {
  constructor(message = "workflow is published and cannot be modified") {
    super(message)
    this.name = "WorkflowConflictError"
  }
}

/** A draft mutation against a non-existent / non-owned definition → HTTP 404. */
export class WorkflowNotFoundError extends Error {
  constructor(message = "workflow not found") {
    super(message)
    this.name = "WorkflowNotFoundError"
  }
}

/**
 * The draft moved since this session read it → HTTP 409 coded `stale_token`
 * (Phase 186 / D-186-09). Another tab, another device, or the same author's older
 * window wrote first; this write matched 0 rows and was refused rather than applied.
 *
 * `currentToken` is the token the server holds NOW. It exists so that "overwrite with
 * what's on screen" costs ONE more PATCH instead of a re-read followed by a PATCH.
 * Returning it leaks nothing: the server's disambiguating re-read is owner-scoped, so
 * this is a token for a row the caller already owns. It is `null` when the refusal
 * carried no token, and it is opaque here exactly as everywhere else — echo it, never
 * inspect it.
 */
export class WorkflowStaleTokenError extends Error {
  readonly currentToken: string | null
  constructor(currentToken: string | null = null) {
    super("this draft was changed somewhere else since you loaded it")
    this.name = "WorkflowStaleTokenError"
    this.currentToken = currentToken
  }
}

/**
 * `PATCH /workflows/{id}` answered HTTP 422 — the draft's SHAPE was rejected before the
 * handler ran, so nothing was written (Phase 186 / D-186-04). A mid-edit definition can
 * legitimately reach this state, and the honest answer is "not saved, and here is why",
 * never a false `Saved ✓`.
 *
 * THE RAW BODY IS LOGGED HERE AND CARRIED NO FURTHER — the
 * `WorkflowValidateUnreadableError` precedent, copied deliberately. The constructor
 * writes it to the console once, at this boundary, and this error's `message` is a FIXED
 * business-plain sentence with nothing interpolated into it. A validation body is a list
 * of internal field paths and framework phrasing; pretty-printing it onto an authoring
 * surface aimed at business users would leak implementation detail and still not say what
 * to do. The class exists so the hook can branch on `name` rather than parse a string.
 */
export class WorkflowDraftUnreadableError extends Error {
  constructor(rawBody?: unknown) {
    super("the draft's shape could not be read, so nothing was saved")
    this.name = "WorkflowDraftUnreadableError"
    // Logged, never shown. One line, at the boundary that received it.
    console.warn("PATCH /workflows/{id} → 422 (shape rejected before the handler):", rawBody)
  }
}

/**
 * Phase 193 (AUTH-03, piece 2) — the descriptor `POST /workflows/{id}/template` returns.
 *
 * FIELD-FOR-FIELD the backend's `TemplateAssetRef` (`workflows.py:1617`), which is itself
 * field-for-field `app.models.harness.AssetRef`. That identity is the whole contract: the
 * object goes STRAIGHT into `definition.assets[]` and the `extra='forbid'` WorkflowDefinition
 * accepts it unchanged, so no client-side re-shaping exists to drift.
 *
 * `kind` is the single-value literal, not `string` — this door mints templates and never
 * `reference` assets, and typing it wide would let a caller write an asset the run engine's
 * `resolve_template_source` Branch 1 would silently skip.
 */
export interface WorkflowTemplateAsset {
  kind: "template"
  asset_id: string
  filename: string
  mime: string
}

/**
 * Phase 193 (AUTH-03) — `POST /workflows/{id}/template` refused, or never arrived.
 *
 * It carries the STATUS and the server's `detail` sentence SEPARATELY rather than one
 * pre-worded message, because the three refusals mean three different things to the person
 * looking at the panel and only the caller knows which surface is asking:
 *   • `404` — the workflow is gone or is not theirs (deliberately indistinguishable
 *     server-side, so the client must not invent a distinction either).
 *   • `422` — the FILE was refused. The backend's detail is a plain, actionable sentence by
 *     contract ("A workflow template must be a .docx, .pptx or .xlsx document (got .png).",
 *     "File too large. Maximum size is 10 MB.") and is safe to show verbatim.
 *   • `502` — Storage write failed. Also a clean sentence, never a traceback.
 * `"network"` is the request that never got an answer at all.
 *
 * `detail` is `null` whenever the body was missing or unreadable — a caller must therefore
 * always have a fallback sentence and can never render `null` at a person.
 */
export class WorkflowTemplateUploadError extends Error {
  readonly status: number | "network"
  readonly detail: string | null
  constructor(status: number | "network", detail: string | null) {
    super(detail ?? `workflow template upload failed (${status})`)
    this.name = "WorkflowTemplateUploadError"
    this.status = status
    this.detail = detail
  }
}

/**
 * Phase 193 (AUTH-03, piece 2) — attach a template to a workflow AT AUTHORING TIME.
 *
 * Mirrors `uploadWorkspaceTemplate`'s FormData + Bearer shape (see its comment): the
 * NO-`Content-Type` detail is load-bearing so the browser writes the multipart boundary
 * itself, and the single part is named `file` because that is the part name the route
 * declares.
 *
 * ⚠ THIS DOES NOT WRITE THE DEFINITION, and that is the backend's deliberate contract
 * (`AUTH-03-BACKEND-SUMMARY.md`): it returns the descriptor and stops. The caller appends it
 * to `definition.assets[]` and saves through the EXISTING draft-save path, which keeps
 * exactly ONE writer on the `definition` JSONB and off Phase 186's `If-Match` token.
 */
export async function uploadWorkflowTemplate(
  definitionId: string,
  file: File,
): Promise<WorkflowTemplateAsset> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/workflows/${definitionId}/template`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the boundary
      body: formData,
    })
  } catch {
    throw new WorkflowTemplateUploadError("network", null)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    const detail = typeof body?.detail === "string" ? body.detail : null
    throw new WorkflowTemplateUploadError(res.status, detail)
  }
  return (await res.json()) as WorkflowTemplateAsset
}

/**
 * What a bound template asks the step to fill in, and whether we could read it.
 *
 * `read` is not decoration. An empty `placeholders` list is ambiguous on its own —
 * it could mean *we opened the document and it carries no fill-in fields*, or *we
 * never opened it at all*. Rendering those two as the same sentence lets an author
 * conclude their template is field-less when the read simply failed, and they then
 * ship a workflow that fills nothing. The server therefore carries them separately.
 */
export interface WorkflowTemplatePlaceholders {
  read: "ok" | "unreadable"
  placeholders: string[]
}

/**
 * GET /workflows/{id}/template/placeholders — the fields a bound template expects.
 *
 * Sited HERE, beside `uploadWorkflowTemplate`, rather than beside `getGroundingBundle`:
 * it shares that function's concern (the template a workflow binds) and its gate
 * (`require_visible("workflow_authoring")`), not the palette's `require_canvas()`.
 *
 * ⚠ WHY THIS IS NOT `getGroundingBundle(assetId)`, recorded here because the older seam
 * next door looks like it should already do this job. `getGroundingBundle`'s
 * `templateAssetId` parameter feeds a backend query param typed `UUID | None`, while
 * every asset id this app mints is a Storage PATH (`{user_id}/_library/{definition_id}/…`)
 * — so passing a real one is a **measured 422** (`uuid_parsing`, before the handler
 * runs). That parameter, and the `GroundingBundle.template_placeholders` field it
 * populates, therefore remain **unused by the app**. They are left in place rather than
 * deleted: removing a shipped typed seam is a separate decision from adding this one.
 */
export async function getWorkflowTemplatePlaceholders(
  definitionId: string,
  assetId: string,
  signal?: AbortSignal,
): Promise<WorkflowTemplatePlaceholders> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/workflows/${definitionId}/template/placeholders?asset_id=${encodeURIComponent(assetId)}`,
    { headers, signal },
  )
  if (!res.ok) throw new Error(`Failed to read the template's fields (status ${res.status})`)
  return (await res.json()) as WorkflowTemplatePlaceholders
}

/**
 * Phase 193.1 (AUTH-03, D-05) — POST /workflows/template/placeholders: WHAT A DOCUMENT ASKS
 * FOR, READ FROM BYTES ALONE, BEFORE ANY WORKFLOW EXISTS.
 *
 * ── WHAT THIS IS FOR, AND WHAT IT DELIBERATELY IS NOT ────────────────────────────────────
 * It takes bytes and returns names. **It persists NOTHING** — no definition row, no Storage
 * object, no draft, not even a temporary one. That is the whole reason it needs no
 * `definitionId`: there is no row to key on because nothing is being written, which is what
 * makes it usable on the pre-draft describe screen where neither an id nor a saved asset
 * exists yet.
 *
 * ── ITS BOUND-TEMPLATE SIBLING, NAMED SO NOBODY HAS TO GUESS WHY THERE ARE TWO ───────────
 * `getWorkflowTemplatePlaceholders` above answers the same question about a document ALREADY
 * BOUND to a saved workflow, and is keyed on `(definitionId, assetId)` for exactly that
 * reason. Both return `WorkflowTemplatePlaceholders`, and the shared return type is a decision
 * rather than a convenience: ONE wire shape for both doors means a caller derives the SAME
 * reading arms from either, so the pre-draft screen and the deliverable step's rail can never
 * disagree about what an answer means.
 *
 * ── THE SHAPE, AND THE ONE DETAIL THAT IS LOAD-BEARING ───────────────────────────────────
 * `uploadWorkflowTemplate`'s body — FormData, a single part named `file` because that is the
 * part name the route declares, `Authorization: Bearer`, and **NO `Content-Type`** so the
 * browser writes the multipart boundary itself. Setting that header by hand produces a request
 * with no boundary and the server rejects it. Plus the abortable tail its sibling has and the
 * upload lacks: a pre-draft read is racing an author who may replace the file, so the caller
 * needs to cancel a read that has been overtaken.
 *
 * ⚠ NOTHING ABOUT THE CALLER IS SENT BEYOND THE TOKEN — no id, no path, no filename. The route
 * accepts no path and owns no row, so the cross-tenant class that required an owner-prefix
 * check on the bound-template door has nothing here to attach to. That is elimination by
 * construction, not a guard that could be removed.
 *
 * ── REFUSALS ARE RELAYED, NOT RE-WORDED ──────────────────────────────────────────────────
 * Throws `WorkflowTemplateUploadError` carrying `status: number | "network"` and the server's
 * own `detail` when the body has one, so a caller can show a 422's own actionable sentence
 * rather than inventing a second copy of a rule the server owns and can drift from.
 */
export async function readTemplatePlaceholdersFromFile(
  file: File,
  signal?: AbortSignal,
): Promise<WorkflowTemplatePlaceholders> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/workflows/template/placeholders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the boundary
      body: formData,
      signal,
    })
  } catch {
    throw new WorkflowTemplateUploadError("network", null)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    const detail = typeof body?.detail === "string" ? body.detail : null
    throw new WorkflowTemplateUploadError(res.status, detail)
  }
  return (await res.json()) as WorkflowTemplatePlaceholders
}

/** POST /workflows — create a draft. Returns {id, version, token} (Phase 186: the
 *  token seeds the session, because three of the Builder's four entry routes create). */
export async function createWorkflowDraft(
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<WorkflowDraftWriteResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows`, {
    method: "POST",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (!res.ok) throw new Error(`Failed to create workflow draft (status ${res.status})`)
  return (await res.json()) as WorkflowDraftWriteResult
}

/** GET /workflows/drafts — the caller's own draft rows (owner-scoped server-side). */
export async function listDraftWorkflows(signal?: AbortSignal): Promise<WorkflowDraftRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/drafts`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list draft workflows (status ${res.status})`)
  return (await res.json()) as WorkflowDraftRow[]
}

/**
 * PATCH /workflows/{id} — update a draft. Throws WorkflowConflictError on 409
 * (the row is published/frozen) and WorkflowNotFoundError on 404 — a 409/404 is
 * NEVER swallowed as success (T-103-03-04).
 *
 * `token` is the opaque concurrency token from the response that seeded this session
 * (Phase 186 / D-186-07). When present it travels as the conditional-request header,
 * and the server refuses the write if the row moved since that token was minted. When
 * absent NO header is sent and the server runs today's unguarded UPDATE — the
 * deliberate one-release concession for a tab that was already open when the guard
 * shipped, recorded on the route as well.
 *
 * The token is inserted BEFORE `signal` in the argument list. That is safe because no
 * call site passed a third argument (verified by grep across `frontend/src`, 186-03).
 */
export async function updateWorkflowDraft(
  id: string,
  def: WorkflowDefinitionJSON,
  token?: string | null,
  signal?: AbortSignal,
): Promise<WorkflowDraftWriteResult> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  // The header is ADDED, never substituted: a missing token must send no header at
  // all, not an empty one (an empty conditional value would guard against nothing
  // while still reading as guarded).
  const headers: Record<string, string> =
    typeof token === "string" && token.length > 0
      ? { ...authHeaders, "If-Match": token }
      : authHeaders
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (res.status === 409) {
    // Phase 186: this arm used to throw the body away, which made a second 409 cause
    // invisible. Read it, and branch on the machine `code` — NEVER on the prose, and
    // never on a narrowed union: `code` stays `string` because the SERVER owns the
    // refusal vocabulary (the `Verdict.code` rule below, VALID-03 / D-182-06). A client
    // allow-list would make this a second, drifting copy of a one-owner vocabulary.
    const body = (await res.json().catch(() => ({}))) as {
      detail?: { code?: string; token?: string }
    }
    const code = body.detail?.code
    if (code === "stale_token") throw new WorkflowStaleTokenError(body.detail?.token ?? null)
    // EVERY other value lands here: a missing body, a body that would not parse, a body
    // with no `detail`, and a code minted after this client shipped. That is today's
    // behaviour, kept deliberately — a refusal we cannot classify must never become a
    // success (the WR-02 malformed-body rule, `publishWorkflow` below).
    throw new WorkflowConflictError()
  }
  if (res.status === 422) {
    // Read the body for the LOG only; a body that will not parse must not mask the 422.
    const rawBody = await res.json().catch(() => null)
    throw new WorkflowDraftUnreadableError(rawBody)
  }
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to update workflow draft (status ${res.status})`)
  return (await res.json()) as WorkflowDraftWriteResult
}

/** DELETE /workflows/{id} — delete a draft (204). Throws WorkflowConflictError on
 *  409 (published/frozen) and WorkflowNotFoundError on 404. */
export async function deleteWorkflowDraft(id: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "DELETE",
    headers,
    signal,
  })
  if (res.status === 409) throw new WorkflowConflictError()
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to delete workflow draft (status ${res.status})`)
}

// ── Phase 184-06 (VALID-02 / VALID-03 · D-184-13 / D-184-14) — the FIRST clients of
//    the two canvas routes Phase 182 shipped and nothing called. Both are consumed
//    EXACTLY as shipped: this plan changes no backend file. ─────────────────────────

/**
 * One finding from `POST /workflows/validate`, exactly as the wire carries it.
 *
 * `code` IS DECLARED AS `string`, DELIBERATELY, AND MUST STAY THAT WAY (VALID-03 /
 * D-182-06). The SERVER owns the whole verdict vocabulary — reachability's lint codes,
 * grounding's fidelity codes, the two the route mints itself, and the degraded marker —
 * and the route's own classifier FAILS CLOSED, meaning a code nobody has classified yet
 * comes back at the hard severity rather than the soft one. The client's job is to render
 * whatever arrives, including codes it has never seen; Phase 185 adds more of them and
 * this file must need no edit for that. Narrowing this to a union of literals would make
 * the client a second, drifting copy of a vocabulary that has exactly one owner — which is
 * the red line the whole server-validation seam exists to hold. Do not "helpfully" narrow it.
 *
 * `phase` is the phase SLUG (== the canvas node id), or `null` for a workflow-wide
 * finding, which therefore needs a home in the problems tray rather than on a node.
 *
 * ONE SHAPE, TWO DECLARATIONS, AND A COMPILE-TIME BRIDGE. `builderStore.ts` declares the
 * structurally identical `ServerVerdict`, because it landed first and because the two
 * modules cannot import each other: the store carries a source fence forbidding it from
 * naming this API client at all (an undo must never be able to write to the server), and
 * this client must not import a store that type-imports `WorkflowBuilderPage`. So instead
 * of a silent second copy, `useLiveValidation.ts` — the one module that legitimately sees
 * both — carries a mutual-assignability assertion, making any drift a typecheck error.
 */
export interface Verdict {
  code: string
  phase: string | null
  message: string
  severity: "error" | "incomplete"
}

/**
 * The always-200 envelope of `POST /workflows/validate`, returned UNTOUCHED.
 *
 * `ok === (verdicts.length === 0)` is the server's invariant, not a client derivation —
 * an `incomplete`-only verdict set still reports not-ok, because an unfinished draft
 * cannot publish either. Nothing here interprets, filters, re-orders or re-classifies
 * the array.
 */
export interface ValidateResponse {
  ok: boolean
  verdicts: Verdict[]
}

/**
 * `GET /workflows/grounding-bundle` — the server-sourced palette of valid building
 * blocks (the CANVAS-04 tool whitelist, the KB folder tree, the enabled skills).
 *
 * `degraded` IS THE HONESTY FIELD AND IT IS NOT OPTIONAL READING. It names the registries
 * whose read FAILED, sorted. An EMPTY array is the ONLY value that means "this palette is
 * complete" — because a registry blip serves `{folders: [], skills: []}` at HTTP 200,
 * which is byte-indistinguishable from an author who genuinely owns nothing. A picker
 * that renders an empty-but-normal dropdown on a failed read is telling the user
 * something false, so a caller MUST branch on this rather than on emptiness.
 */
export interface GroundingBundle {
  tools: string[]
  /** D-185-09 — the SERVER's safety-defining list of knowledge-base-reading tool names.
   *  The client intersects it with a step's `available_tools` to PREDICT the lock; it
   *  never enforces (the run-time gate is server-side and unconditional), so a wrong
   *  read here is a display bug by construction. Never re-declare this list client-side. */
  kb_tools: string[]
  folders: { id: string; name: string; parent_id: string | null }[]
  skills: { id: string; name: string | null }[]
  template_placeholders: string[]
  degraded: string[]
}

/**
 * `POST /workflows/validate` answered HTTP 422 — the definition's SHAPE was rejected
 * before the handler ran (the model's forbid-extra-keys tier, or one of the two
 * cross-field model validators), so the always-200 envelope was bypassed entirely.
 *
 * THE RAW BODY IS LOGGED HERE AND CARRIED NO FURTHER (D-184-14 / T-184-06-01). The
 * constructor writes it to the console once, at this boundary, and the error's `message`
 * is a FIXED business-plain sentence with nothing interpolated into it. A validation
 * error body is a list of internal field paths and framework phrasing; pretty-printing it
 * onto an authoring surface aimed at business users would leak implementation detail and
 * still not tell them what to do. Turning those bodies into something a person can act on
 * is a server-side envelope change that is deliberately deferred — it is not a job for a
 * client-side formatter, and this class exists so the hook can branch on `name` rather
 * than parse a string.
 */
export class WorkflowValidateUnreadableError extends Error {
  constructor(rawBody?: unknown) {
    super("the workflow's shape could not be read by the validator")
    this.name = "WorkflowValidateUnreadableError"
    // Logged, never shown. One line, at the boundary that received it.
    console.warn("POST /workflows/validate → 422 (shape rejected before the handler):", rawBody)
  }
}

/**
 * POST /workflows/validate — the live structural check (VALID-02).
 *
 * Takes a RAW definition, never a draft id, so an UNSAVED draft validates with no save
 * and no row. Returns the `{ok, verdicts}` envelope verbatim: no severity classifier, no
 * code allow-list, no friendly-message map. The 422 branch is typed and comes BEFORE the
 * generic not-ok throw, because a shape rejection and an unreachable server are different
 * things the caller must be able to word differently (D-184-14).
 *
 * `signal` is the house signature and is what makes the live loop's abort-on-new-edit
 * possible; an abort surfaces as the usual DOM abort error and is the caller's to ignore.
 */
export async function validateWorkflow(
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<ValidateResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/validate`, {
    method: "POST",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (res.status === 422) {
    // Read the body for the LOG only; a body that will not parse must not mask the 422.
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new WorkflowValidateUnreadableError(body)
  }
  if (!res.ok) throw new Error(`Failed to validate workflow (status ${res.status})`)
  return (await res.json()) as ValidateResponse
}

/**
 * GET /workflows/grounding-bundle — the palette (CANVAS-04).
 *
 * `templateAssetId` is appended only when supplied; the base palette returns an empty
 * placeholder list. The response is returned untouched, `degraded` included — see the
 * `GroundingBundle` docblock for why that field, and not emptiness, is what a caller
 * must branch on.
 */
export async function getGroundingBundle(
  templateAssetId?: string,
  signal?: AbortSignal,
): Promise<GroundingBundle> {
  const headers = await getAuthHeaders()
  const query =
    templateAssetId !== undefined && templateAssetId !== null && templateAssetId !== ""
      ? `?template_asset_id=${encodeURIComponent(templateAssetId)}`
      : ""
  const res = await fetch(`${API_BASE}/workflows/grounding-bundle${query}`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to load the grounding bundle (status ${res.status})`)
  return (await res.json()) as GroundingBundle
}

// ── Phase 188 Plan 08 (RUNVIZ-03 / D-188-14 / D-188-15) — the ONE net-new read that
//    gives a workflow RUN an address. Mirrors `GET /workflow-runs/{id}` (Plan 03).
//    Sited beside the two other canvas-gated reads above rather than beside
//    `getThreadWorkflow`, because it shares their gate, not their router. ──────────

/** One durable `workflow_phases` row as the run read returns it (backend
 *  `WorkflowRunPhaseRead`). `status` is the **DB-native** vocabulary
 *  (`pending | active | completed | failed | skipped`) and is deliberately
 *  untranslated on the wire — `@/lib/phaseState`'s `phaseStatusFromDb` owns the one
 *  mapping to the client union, and this client must never grow a second one.
 *  `phase_type` is derived server-side from the definition JSON (the table stores no
 *  such column), so it is nullable for a slug the definition no longer names. */
export interface WorkflowRunPhase {
  slug: string
  phase_index: number
  status: string
  phase_type: string | null
  /** Phase 200 (DES-02 / D-05) — when this step flipped to active.
   *
   *  ⚠ `null` means **the time was not recorded**, not "zero". Either the step never ran
   *  (a `skipped` phase is routed around, so it has no start instant at all) or it ran
   *  before migration 121 existed. **There is NO BACKFILL** — a value derived from
   *  `updated_at` would be right for some rows and silently wrong for others, with nothing
   *  on the row to say which. Render nothing for `null`; never render `0s`. */
  started_at?: string | null
  /** Phase 200 (DES-02 / D-05) — when this step reached a terminal status.
   *
   *  With `started_at`, this is the first per-step duration the wire has ever carried:
   *  `completed_at − started_at`. `null` while the step is still running, on a `skipped`
   *  step, and on every pre-migration-121 row. ⚠ A run SPAN is
   *  `min(started_at) → max(completed_at)` across the phases — see `WorkflowRunRead`. */
  completed_at?: string | null
  /** Phase 200 (DES-02 / D-07) — the count this step's phase type DECLARED, read from the
   *  step's own output server-side.
   *
   *  ⚠ **`0` AND `null` ARE DIFFERENT ANSWERS AND MUST BE BRANCHED, NEVER COALESCED.**
   *  `0` is a real measurement — the step searched and found nothing. `null` means **this
   *  phase type declares no count at all**, and four of the seven do: `programmatic`,
   *  `llm_single`, `llm_human_input`, `external_action`. Writing `step_count ?? 0` prints
   *  "0 sources" under a step that never claimed to measure anything. Test for `null`
   *  explicitly (or `typeof === "number"`) and render nothing when absent — never a `0`,
   *  never a dash. */
  step_count?: number | null
  /** Phase 200 (DES-02 / D-07) — the noun for `step_count`: `sources` | `agents` |
   *  `fields`. Non-null iff `step_count` is non-null.
   *
   *  ⚠ AUTHORED COPY owned by the executor that declares it, and deliberately
   *  domain-neutral. Render the pair verbatim (`312 sources`). **Never substitute a domain
   *  word of your own** — "312 docs matched" is a claim about the customer's domain that
   *  nothing measured. */
  step_noun?: string | null
  /** Phase 200.1 (RUN-04) — this step's own `output["text"]`: the answer it produced,
   *  verbatim and unclamped.
   *
   *  ⚠ **`null` MEANS THIS STEP WROTE NO TEXT, AND AN EMPTY STRING IS NEVER SENT.** The
   *  server collapses "no `text` key", "output was not an object" and `text === ""` into
   *  one `null`, deliberately: an empty answer and no answer are not two facts worth
   *  distinguishing on a surface whose job is to say what was produced. So `=== null` and
   *  a truthiness test agree here, which is the point.
   *
   *  ⚠ **IT IS NOT SAFE TO CALL THE LAST ROW'S TEXT "THE RUN'S ANSWER".** A `confirm`
   *  step carries `text` too, and it is a QUESTION — measured on real data:
   *  *"Does this draft answer your question? Add any corrections."* The run's answer is
   *  **the LAST server-ordered row carrying a non-empty `deliverable_text`**, which is a
   *  different rule and the one `WorkflowRunPage` applies.
   *
   *  ⚠ **UNCLAMPED, ON EVERY ROW THAT HAS ONE** (`D-200.1-02-B`). Measured max 38,935
   *  characters on one row, mean 3,871, p95 15,431 — a five-step run typically ~19 KB.
   *  A clamp without a second signalling field would be a silent truncation, and a
   *  populate-only-the-final-row rule would be invisible on the wire. Re-open trigger: the
   *  first surface reading this for a LIST of runs rather than for one run.
   *
   *  ⚠ **MODEL-AUTHORED CONTENT — render it as a text node**, never through React's raw-HTML
   *  escape hatch. ⚠ That prop is not SPELLED here on purpose: `WorkflowRunPage.tsx` carries a
   *  fence sweeping its own RAW source for it at zero occurrences, and this tree has recorded
   *  six times that a comment naming a forbidden token satisfies the grep meant to forbid it. */
  deliverable_text?: string | null
}

/**
 * One workflow run + the definition version that RAN + its durable phase spine
 * (backend `WorkflowRunRead`, `api/workflow_runs.py`).
 *
 * ⚠ **THE ID TRAP.** `WorkflowRunRead.id` is a `workflow_runs.id`. It is **NOT**
 * `PostMessageResponse.run_id`, which is the producer `runs` row consumed by
 * `GET /runs/{id}/stream`. **They are different tables with different id spaces** —
 * `backend/app/api/runs.py:714-729` has to resolve a `workflow_runs.id` handed to a
 * `runs` route as a documented repair, which is the whole reason this route is spelled
 * `/workflow-runs/{id}` and not `/runs/{id}` (D-188-15). Navigating the run surface with
 * the wrong one yields a page that resolves nothing, and the two ids look identical
 * (both bare uuids), so the compiler cannot help — read the field name.
 *
 * **Why `definition` is returned INLINE, and why it is the version that ACTUALLY ran
 * (D-188-14).** The server joins it on `workflow_runs.definition_id`, never by slug:
 * `listPublishedWorkflows` only ever returns the *current* published version, so a
 * re-opened older run resolved by slug would be drawn against a definition it never
 * executed — a spine whose steps the run never had. Carrying it inline also means a
 * terminal run renders with no stream and no second fetch.
 *
 * **`claimed_at` is the ONLY honest elapsed anchor** *(⚠ SUPERSEDED FOR A RUN SPAN —
 * Phase 200. The original sentence is kept rather than deleted, because erasing a
 * superseded invariant hides that a promise changed.)*
 *
 * It stays TRUE OF THIS TABLE: `workflow_runs` still has no `started_at` and no
 * `completed_at`, so a run-row duration is `updated_at − claimed_at` and a null
 * `claimed_at` means the run has not started processing at all (D-188-18).
 *
 * ⚠ **But it is no longer the best anchor for a run SPAN, and the reason is measured
 * rather than stylistic: `claimed_at` is null on 100% of completed runs** — 149 rows, 0
 * with `claimed_at` (`WorkflowRunPage.tsx:849-851`). So the anchor this sentence
 * recommends is, in practice, absent exactly when a span is wanted. Since Phase 200 the
 * PHASE rows carry their own timestamps, so the honest span is
 * `min(phases.started_at) → max(phases.completed_at)` — derived from steps that really
 * ran, and null-safe because a phase that never ran contributes neither end.
 *
 * The degrade path Plan 03 recorded: if the definition row cannot be read, the server
 * returns `workflow_name: ""` / `workflow_slug: ""` / `workflow_version: 0` /
 * `definition: null` rather than 404ing. Treat an empty `workflow_name` as "definition
 * unavailable", never render the empty string.
 */
export interface WorkflowRunRead {
  /** `workflow_runs.id` — NOT `PostMessageResponse.run_id`. See the docblock. */
  id: string
  /** The thread this run streamed into. The deliverable list and the live phase slice
   *  are both reachable from it, which is why no new file endpoint was needed. */
  thread_id: string
  definition_id: string
  workflow_name: string
  workflow_slug: string
  workflow_version: number
  /** `active | paused | cap_paused | completed | failed | cancelled` — the
   *  `workflow_runs_status_check` members. Consumers must map it TOTALLY: an
   *  unrecognised value reads as unknown, never as success. */
  status: string
  created_at: string | null
  /** When the worker picked the run up. **The elapsed anchor** — null ⇒ queued. */
  claimed_at: string | null
  updated_at: string | null
  /** The raw `workflow_definitions.definition` JSONB of the version that ran. */
  definition: WorkflowDefinitionJSON | null
  phases: WorkflowRunPhase[]
}

/**
 * GET /workflow-runs/{id} — the run read (Plan 03). Ownership-gated server-side: a run
 * belonging to another account is indistinguishable from one that does not exist, and
 * both are a 404.
 *
 * Throws the shipped status-carrying `ApiError` rather than the bare `Error` most reads
 * in this file use, because the run surface has to WORD a 404 ("That run isn't
 * available.") differently from a 5xx ("We couldn't load this run."). That is the
 * existing in-tree convention (`ApiError`, used by `postMessage`), not a second one —
 * the alternative would have been a bespoke error class per outcome, which is what
 * `getWorkflowDeletePreview` does and what this deliberately does not multiply.
 * `ApiError`'s 403 side-effect cannot fire here: it is gated on the exact
 * `VISIBILITY_REFUSAL` literal, and this route's gate answers `{"detail": "Not Found"}`.
 *
 * ⚠ APPENDED BY 188.1-04 (WR-07), not a rewrite of the above. The run id is now encoded
 * into the path segment. The ownership gate this docblock already describes is the
 * SECURITY control and is unchanged; the encode is the defensive URL construction that
 * pairs with it, in the `listRelationships` register. A falsification in
 * `pages/WorkflowRunPage.test.tsx` asserts the URL a mocked `fetch` actually RECEIVES for
 * `runId = "a/b"` — it was observed RED before the encode was written.
 *
 * The unused `signal` parameter is DELIBERATELY left alone (D4). The same review
 * paragraph proposed threading an `AbortController` through it; that changes request-
 * cancellation behaviour on a live polling surface and is a behaviour change this
 * refactor phase may not make. Re-open trigger: the next phase touching
 * `WorkflowRunPage`'s fetch lifecycle, or a superseded read causing a visible defect.
 */
export async function getWorkflowRun(
  runId: string,
  signal?: AbortSignal,
): Promise<WorkflowRunRead> {
  const headers = await getAuthHeaders()
  // encodeURIComponent the id (WR-07): run ids are UUIDs today so this is safe in
  // practice, but `/`, `?` and `#` are STRUCTURAL in a path segment — defensive URL
  // construction keeps a non-UUID value from reshaping the request the client sends
  // (and pairs with the route's ownership gate, which answers a uniform 404).
  const res = await fetch(`${API_BASE}/workflow-runs/${encodeURIComponent(runId)}`, {
    headers,
    signal,
  })
  if (!res.ok) throw new ApiError(`Failed to load the run (status ${res.status})`, res.status)
  return (await res.json()) as WorkflowRunRead
}

/** One citation passage retrieved for a specific step in a workflow run. */
export interface RunStepCitation {
  document_id: string
  filename: string
  chunk_index: number | null
  passage: string | null
}

/**
 * GET /workflow-runs/{run_id}/phases/{phase_slug}/citations — lazy citation passages (Phase 200.2).
 *
 * Owner-scoped and run+step-scoped on the backend (D-09). Returns allow-listed citation objects
 * stripped of similarity scores and internal metadata (D-10 / A-05).
 */
export async function getWorkflowRunPhaseCitations(
  runId: string,
  phaseSlug: string,
  signal?: AbortSignal,
): Promise<RunStepCitation[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/workflow-runs/${encodeURIComponent(runId)}/phases/${encodeURIComponent(phaseSlug)}/citations`,
    {
      headers,
      signal,
    },
  )
  if (!res.ok) {
    throw new ApiError(`Failed to load step citations (status ${res.status})`, res.status)
  }
  return (await res.json()) as RunStepCitation[]
}

// ── SEED-190 — THE RUN LOG ──────────────────────────────────────────────────────────
//
// ⚠ THIS FIRES THE 197 DECLINE'S OWN RE-OPEN TRIGGER AND THE TRIGGER IS BEING HONOURED
// RATHER THAN STEPPED AROUND. `docs/HOT-FILE-LEDGER.md` records this file as the hottest in
// the repository (176 commits / 100 phases / 6430 lines) with a standing DECLINE to extract,
// whose trigger reads: *"the next phase adding a RUNTIME export or a second concern here"*.
// `listWorkflowRuns` below IS a runtime export. It is added here anyway, and the reason is
// that it is not a second CONCERN: it sits directly beneath `getWorkflowRun`, hits the same
// router, shares its `ApiError` convention and its encode discipline, and an extraction that
// moved one without the other would split a two-function surface across two files. **The
// trigger is not thereby discharged** — it is recorded as fired, with the next phase touching
// this file owing the extraction rather than another paragraph explaining why not.

/**
 * One row of the run log (backend `WorkflowRunListItem`).
 *
 * ⚠ IT IS A PROJECTION OF `WorkflowRunRead`, NOT A SECOND VOCABULARY. Every field is the
 * same field under the same name; what is ABSENT is `definition` (a log draws no spine) and
 * the per-phase rows (the span is pre-reduced server-side). A client that starts deriving
 * something here that `WorkflowRunRead` derives differently is the defect this note exists
 * to name in advance.
 */
export interface WorkflowRunListItem {
  /** ⚠ A `workflow_runs.id` — the SAME id space `getWorkflowRun` takes, and NOT a `runs.id`.
   *  The id trap is documented in full on `WorkflowRunRead` above. */
  id: string
  thread_id: string
  definition_id: string
  /** ⚠ EMPTY STRING when the definition row is gone. Deleting a workflow does not delete its
   *  runs, so an orphaned run reaches the log with no name and the surface says so in words.
   *  It is never `null` — the backend normalises, so the client has one case, not two. */
  workflow_name: string
  workflow_slug: string
  workflow_version: number
  /** The DB-native status. The sentence a person reads comes from `runFacts` (D-17). */
  status: string
  created_at: string | null
  /** Phase rows this run created — a fact about the RUN, not about the definition today. */
  step_total: number
  /** `min(started_at)` across the run's phases. ⚠ NULL on every pre-migration-121 run, and
   *  that is "not recorded", never zero. */
  started_at: string | null
  /** `max(completed_at)` across the run's phases. NULL while a run is still going. */
  completed_at: string | null
}

/** One page of the run log (backend `WorkflowRunListRead`). `total` is the count UNDER THE
 *  SAME FILTER — the number the surface says "showing N of" against. */
export interface WorkflowRunListPage {
  runs: WorkflowRunListItem[]
  total: number
  limit: number
  offset: number
}

/**
 * GET /workflow-runs — this caller's runs, newest first.
 *
 * Owner-scoped in the query server-side; there is no "everyone" mode to ask for. An empty
 * page is a 200 with no rows, never a 404 — "you have no runs" is an answer.
 *
 * @param slug restrict to ONE workflow, across every version sharing the slug. ⚠ NOT a
 *   `definition_id`: a workflow's runs span its published versions, so a definition filter
 *   would show a VERSION's history under the workflow's name. Measured on the dev database:
 *   `pm-weekly-status-report` has 21 runs across 3 definition rows.
 *
 * Throws the status-carrying `ApiError`, matching `getWorkflowRun` directly above, because
 * the log has to word a canvas-off 404 differently from a 5xx.
 */
export async function listWorkflowRuns(
  options: { slug?: string; limit?: number; offset?: number; signal?: AbortSignal } = {},
): Promise<WorkflowRunListPage> {
  const headers = await getAuthHeaders()
  // `URLSearchParams` rather than template interpolation — a slug is server-supplied today
  // but reaches here as a plain string, and `&` / `#` are STRUCTURAL in a query string. Same
  // defensive-construction rule as `getWorkflowRun`'s path encode (WR-07), one component over.
  const params = new URLSearchParams()
  if (options.slug !== undefined) params.set("slug", options.slug)
  if (options.limit !== undefined) params.set("limit", String(options.limit))
  if (options.offset !== undefined) params.set("offset", String(options.offset))
  const query = params.toString()
  const res = await fetch(`${API_BASE}/workflow-runs${query ? `?${query}` : ""}`, {
    headers,
    signal: options.signal,
  })
  if (!res.ok) {
    throw new ApiError(`Failed to load the run log (status ${res.status})`, res.status)
  }
  return (await res.json()) as WorkflowRunListPage
}

// ── Phase 152-04 (WFIN-03 / D-LOCK-03/04/05) — the published-workflow safe DELETE
//    cascade + its server-sourced victim-naming counts. These hit DISTINCT routes on
//    api/workflows.py (Plan 02, D-08) — NEVER the draft `DELETE /workflows/{id}` above
//    (Pitfall 7 — the routes must not collide). ────────────────────────────────────

/** The victim-naming delete sheet's EXACT server-sourced counts (D-LOCK-03). The sheet
 *  never guesses these: `versions` + `runs` are the Removed group (definition versions +
 *  run records hard-deleted), `threads` is the Kept group (chats detached but preserved),
 *  and `in_flight` is the count of runs STILL LIVE — the honest signal the amber
 *  cancel-first banner gates on (D-LOCK-05). `in_flight` is the LIVE count, never `runs`
 *  (which is historical run records — "in progress" off that would be a lie). */
export interface WorkflowDeletePreview {
  name: string
  versions: number
  runs: number
  threads: number
  in_flight: number
}

/** GET /workflows/{id}/delete-preview — the server-sourced Removed/Kept counts the
 *  victim-naming sheet renders BEFORE commit (D-LOCK-03). Owner-gated + 404-collapse on
 *  the backend (a non-owner / unknown id → WorkflowNotFoundError, no existence leak). The
 *  error is NOT swallowed — the sheet renders its own load-error state on a throw. */
export async function getWorkflowDeletePreview(
  id: string,
  signal?: AbortSignal,
): Promise<WorkflowDeletePreview> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}/delete-preview`, { headers, signal })
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to load workflow delete preview (status ${res.status})`)
  return (await res.json()) as WorkflowDeletePreview
}

/** DELETE /workflows/{id}/cascade — the WFIN-03 hard-delete (204): the definition + ALL
 *  versions + ALL runs are removed; in-flight runs are cancelled-first server-side; threads
 *  are detached-but-KEPT (they become normal chats). A DISTINCT route from the draft
 *  `DELETE /workflows/{id}` (Pitfall 7 — never collide). Owner-gated on the backend (404 on
 *  non-owner). The error is NOT swallowed — the sheet's error state renders on a throw, and
 *  the card is removed only AFTER the server confirms (D-LOCK-04 — no optimistic vanish,
 *  no undo; hard-delete is irreversible). */
export async function deleteWorkflowCascade(id: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}/cascade`, {
    method: "DELETE",
    headers,
    signal,
  })
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to delete workflow (status ${res.status})`)
}

/** POST /workflows/generate — NL one-shot structured generation. The route
 *  returns HTTP 200 even on a FAILED generation (`ok:false`), so we read the body
 *  and NEVER throw on `ok:false` (only on a real HTTP/network error). */
export async function generateWorkflow(
  body: GenerateWorkflowBody,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`Failed to generate workflow (status ${res.status})`)
  return (await res.json()) as GenerateResult
}

/** POST /workflows/{id}/publish — run the 8-stage publish gauntlet. The client
 *  distinguishes the 4 HTTP outcomes and reads the SERVER verdict verbatim:
 *   - 200 → {kind:"verdict"}: the body tells pass (published:true) from BLOCK
 *     (published:false / blocked_stage set) — we DO NOT re-derive it.
 *   - 400 → {kind:"business_requirement"}: the verdict is in `detail`.
 *   - 404 → {kind:"not_found"}.
 *   - 409 → {kind:"already_published"}.
 *   - anything else → throw.
 *  A binary `200 = ok / else = error` handler is FORBIDDEN (T-103-03-01). */
export async function publishWorkflow(
  id: string,
  golden_input: string,
  signal?: AbortSignal,
): Promise<PublishOutcome> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}/publish`, {
    method: "POST",
    headers,
    body: JSON.stringify({ golden_input }),
    signal,
  })
  if (res.status === 200) {
    const verdict = (await res.json()) as PublishVerdict
    return { kind: "verdict", verdict }
  }
  if (res.status === 400) {
    // WR-02: defend against a detail-less / mistyped 400 body. The backend rides the
    // full PublishVerdict in `detail` (api/workflows.py:209), but a malformed body must
    // NEVER cast `undefined` to PublishVerdict — the gauntlet would then crash on
    // `verdict.named_failures.length`. Verify the shape; otherwise throw an honest error.
    const body = (await res.json().catch(() => ({}))) as { detail?: unknown }
    const detail = body.detail
    if (detail && typeof detail === "object" && "published" in detail) {
      return { kind: "business_requirement", verdict: detail as PublishVerdict }
    }
    throw new Error("business_requirement block: malformed verdict body (no PublishVerdict in detail)")
  }
  if (res.status === 404) return { kind: "not_found" }
  if (res.status === 409) return { kind: "already_published" }
  throw new Error(`Failed to publish workflow (status ${res.status})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 123-05 (TRIG-01) — Skill Trigger Tuner client calls.
//
// Mirror the Plan-04 router contract (backend/app/api/skill_tuner.py):
//   POST   /skills/{id}/tuner/runs           → kick off a BOUNDED background run, get a run_id
//   GET    /skills/{id}/tuner/runs/{run}/stream  → live tuner_* SSE progress
//   GET    /skills/{id}/tuner/runs/{run}     → the held-out scoreboard once complete
//
// The per-provider cell shape (`{ provider, model, axes: { fires, no_false }, score }`)
// is the ProviderScoreboard render input (042-A — BOTH sub-scores present, never a
// hidden aggregate). The scoreboard is N-column = the org's configured targets; the
// candidate set is held-out-scored and the author picks the winner by held-out (D-03).
// ─────────────────────────────────────────────────────────────────────────────

/** A benchmark target column = a provider + its representative model (043-A run config). */
export interface TunerTarget {
  provider: string
  model: string
}

/** One (client-held) benchmark case: a user prompt + whether the skill SHOULD fire on it
 *  (the should-NOT cases are the false-fire rail). Cases are ephemeral / never persisted. */
export interface TunerCase {
  prompt: string
  should_fire: boolean
}

/** A single per-provider scoreboard cell. BOTH sub-scores carry the honest unmeasured
 *  sentinel from 123.1-06 (TT-05/TT-12): `fires` = should-trigger recall, `no_false`
 *  = should-NOT precision — each is `null` when that axis had NO cases to score (the
 *  frontend renders "n/a"), NEVER a fabricated `1.0`. `score` is the server-computed
 *  combined cell score (the mean of the MEASURED axes) and is `null` when the cell is
 *  WHOLLY unmeasured. `measured` is `false` (and `error_count > 0`) when every classify
 *  call for the cell RAISED — an all-error column that the scoreboard must render
 *  honestly as "could not measure", distinct from a measured `0.00`. `error_count` is the
 *  count of classify calls that raised. (`measured`/`error_count` are optional so a
 *  legacy cell that predates 123.1-06 still types — a missing `measured` is treated as
 *  measured, and `score == null` is the unmeasured signal regardless.) */
export interface TunerCell {
  provider: string
  model: string
  axes: { fires: number | null; no_false: number | null }
  score: number | null
  measured?: boolean
  error_count?: number
}

/** One scored candidate description: its held-out score + the per-provider cells. */
export interface TunerCandidate {
  index: number
  description: string
  cells: TunerCell[]
  held_out_score: number
  is_baseline: boolean
}

/** The held-out scoreboard returned by GET results (and carried on tuner_complete). */
export interface TunerScoreboard {
  skill_id: string
  candidates: TunerCandidate[]
  winner_index: number | null
  winner_description: string | null
}

/** The POST /runs response (run kicked off; reconcile via /stream + /results). */
export interface StartTunerRunResponse {
  run_id: string
  skill_id: string
  targets: TunerTarget[]
  case_count: number
  n: number
}

export interface StartTunerRunBody {
  cases?: TunerCase[]
  targets?: TunerTarget[]
  n?: number
}

/** Kick off a bounded background tuning run; the response carries the run_id to
 *  stream + reconcile (D-06 non-blocking). 409 means a run is already in flight. */
