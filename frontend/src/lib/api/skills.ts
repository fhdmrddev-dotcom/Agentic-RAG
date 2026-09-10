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

import type { EngineHealthBoard, EvalAggregate, EvalRun, EvalRunKickoff, EvalRunReadout, MatrixRunKickoff, ProposalApproveResult, PublishGate, Skill, SkillCreate, SkillProposal, SkillUpdate, SkillVersion, TestCase, TestCaseCreate, TestCaseUpdate } from "../../types"
import { API_BASE, getAuthHeaders } from "./_core"
export async function listSkills(): Promise<Skill[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills`, { headers })
  if (!res.ok) throw new Error("Failed to list skills")
  return res.json() as Promise<Skill[]>
}

export async function createSkill(body: SkillCreate): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to save skill. Please try again.")
  return res.json() as Promise<Skill>
}

export async function updateSkill(id: string, body: SkillUpdate): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update skill. Please try again.")
  return res.json() as Promise<Skill>
}

export async function deleteSkill(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete skill. Please try again.")
}

export async function toggleSkillEnabled(id: string): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/toggle-enabled`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) throw new Error("Failed to update skill.")
  return res.json() as Promise<Skill>
}

/** Phase 136 (GATE-01): a typed carrier for the structured 409 publish-gate
 *  refusal. Holds the server-computed `PublishGate` so the dialog can render the
 *  SAME honest counts/reason the server used — the client never recomputes `met`
 *  (D-07). Mirrors the ApiError idiom (a named Error with a typed field). */
export class PublishGateError extends Error {
  readonly gate: PublishGate
  constructor(gate: PublishGate) {
    super(gate.reason || "This skill can't be published yet — its eval gate isn't met.")
    this.gate = gate
    this.name = "PublishGateError"
  }
}

export async function toggleSkillOrgShared(id: string, override?: boolean): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/toggle-global`, {
    method: "PATCH",
    headers,
    // Only the private→org-shared publish direction sends a body ({ override }); the
    // ungated shared→private unshare direction (no arg) sends none — unchanged.
    ...(override !== undefined ? { body: JSON.stringify({ override }) } : {}),
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the skill owner can change org sharing")
    if (res.status === 409) {
      // Structured publish-gate refusal — detail is an OBJECT { error, gate }, NOT
      // a string (do NOT route through proposalError's string path). Surface the
      // gate via a typed error so the dialog renders the server's honest evidence.
      let gate: PublishGate | undefined
      try {
        const j = (await res.json()) as { detail?: { error?: string; gate?: PublishGate } }
        gate = j?.detail?.gate
      } catch {
        /* non-JSON / malformed 409 body — fall through to the generic message */
      }
      if (gate) throw new PublishGateError(gate)
      throw new Error("This skill can't be published yet — its eval gate isn't met.")
    }
    throw new Error("Failed to update skill.")
  }
  return res.json() as Promise<Skill>
}

/** GET /skills/{id}/publish-gate — the server-computed publish read-model the
 *  PublishGateDialog renders before a private→global share (D-05). Owner-scoped
 *  server-side (404 cross-user). Mirrors getEvalRun's getAuthHeaders→fetch→typed
 *  json cast; the client never computes `met` (D-07). */
export async function getPublishGate(skillId: string): Promise<PublishGate> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/publish-gate`, { headers })
  if (!res.ok) throw new Error("Failed to load publish gate.")
  return res.json() as Promise<PublishGate>
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 132 Plan 03 (EVAL-01 / VER-01) — eval test-case CRUD + read-only version
// history client. Mirrors the listSkills/createSkill/updateSkill/deleteSkill
// pattern above (getAuthHeaders → fetch → typed json cast). Owner-scoping is
// enforced SERVER-SIDE on every route (Plan 02 `.eq("user_id", …)`); this is a
// thin client and not itself a security boundary. Backs the THIN 132 foundation
// surface — the designed Evals panel is Phase 137 (PANEL-01, G-2).
// ────────────────────────────────────────────────────────────────────────────

export async function listTestCases(skillId: string): Promise<TestCase[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/test-cases`, { headers })
  if (!res.ok) throw new Error("Failed to load test cases.")
  return res.json() as Promise<TestCase[]>
}

export async function createTestCase(skillId: string, body: TestCaseCreate): Promise<TestCase> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/test-cases`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create test case.")
  return res.json() as Promise<TestCase>
}

export async function updateTestCase(caseId: string, body: TestCaseUpdate): Promise<TestCase> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/test-cases/${caseId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update test case.")
  return res.json() as Promise<TestCase>
}

export async function deleteTestCase(caseId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/test-cases/${caseId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete test case.")
}

export async function listSkillVersions(skillId: string): Promise<SkillVersion[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/versions`, { headers })
  if (!res.ok) throw new Error("Failed to load version history.")
  return res.json() as Promise<SkillVersion[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 133 Plan 05 (EVAL-02) — eval-runner client. These mirror the existing
// fetch + getAuthHeaders() shape; the eval run writes a companion public.runs row
// (Plan 04, Pattern 3) so the chat-run stream client (subscribeToRun) reattaches
// with ZERO new stream code. The DURABLE readout always comes from getEvalRun
// (the DB) so it renders after the Redis buffer TTL expires (D-06 / SC#3).
// ─────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/evals/runs — kick off a bounded with/without eval run.
 *  Returns the run_id immediately (202, non-blocking — D-06); the run_id doubles
 *  as the stream run_id you pass to subscribeToRun. Model validation is the
 *  backend's job (registry check — Plan 04). */
export async function startEvalRun(
  skillId: string,
  body: { provider: string; model: string },
): Promise<EvalRunKickoff> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `Failed to start eval run (status ${res.status}).`
    try {
      const j = (await res.json()) as { detail?: string }
      if (j?.detail) detail = j.detail
    } catch {
      /* non-JSON body — keep the generic message */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<EvalRunKickoff>
}

/** GET /skills/{id}/evals/runs/{runId} — the DURABLE owner-scoped readout
 *  (eval_run row + the per-(case × variant) eval_results rows). */
export async function getEvalRun(skillId: string, runId: string): Promise<EvalRunReadout> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/runs/${runId}`, { headers })
  if (!res.ok) throw new Error("Failed to load eval run.")
  return res.json() as Promise<EvalRunReadout>
}

/** GET /skills/{id}/evals/runs — owner-scoped eval runs, newest-first. The
 *  skill-scoped analog of getActiveRuns for reattach discovery: a row whose
 *  status is still 'running' is a live run to reattach to via subscribeToRun
 *  (the thin client has no ephemeral eval thread_id to feed getActiveRuns —
 *  see SUMMARY deviation). */
export async function listEvalRuns(skillId: string): Promise<EvalRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/runs`, { headers })
  if (!res.ok) throw new Error("Failed to load eval runs.")
  return res.json() as Promise<EvalRun[]>
}

/** PUT /skills/{id}/evals/results/{resultId}/rating — set or CLEAR the caller's
 *  thumbs rating on ONE eval answer (EVAL-04). Owner-gated server-side (.eq(user_id)
 *  → 404 cross-user, T-134-11); the client cannot forge another user's rating. Pass
 *  null to clear (re-ratable — D-08). Mirrors startEvalRun's fetch + getAuthHeaders()
 *  + error-detail extraction shape. Returns the persisted rating; the caller should
 *  re-load the durable readout (getEvalRun) so thumbs state stays derived from the DB,
 *  never a separate stale store (respects the BUG-260701-02 skill-switch reset). */
export async function rateEvalResult(
  skillId: string,
  resultId: string,
  rating: "up" | "down" | null,
): Promise<{ eval_result_id: string; rating: string | null }> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/evals/results/${resultId}/rating`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ rating }),
    },
  )
  if (!res.ok) {
    let detail = `Failed to rate eval answer (status ${res.status}).`
    try {
      const j = (await res.json()) as { detail?: string }
      if (j?.detail) detail = j.detail
    } catch {
      /* non-JSON body — keep the generic message */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<{ eval_result_id: string; rating: string | null }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 137.1 (EVAL-05) — matrix runs, engine smoke-sweep health, and run-history
// aggregation client. THIN wrappers over the Plan 04/05/07 routes; they mirror the
// existing eval fetch + getAuthHeaders() shape and carry NO backend logic. Owner-
// scoping is enforced SERVER-SIDE on every route (404 cross-user); this is a thin
// client and not itself a security boundary. Each matrix arm rides the existing
// eval_* SSE via subscribeToRun (its run_id), and the DURABLE readout still comes
// from getEvalRun / getEvalRunById (the DB) after the Redis buffer TTL expires.
// ─────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/evals/matrix — kick off a matrix run (N single-provider arms
 *  under one matrix_group_id; D-06). `gate_provider` designates the arm whose rows
 *  feed the publish gate (D-05; defaults server-side to the user's active provider
 *  when omitted). Returns the group id + per-arm kickoffs (202, non-blocking). */
export async function startMatrixRun(
  skillId: string,
  body: { gate_provider?: string } = {},
): Promise<MatrixRunKickoff> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/matrix`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `Failed to start matrix run (status ${res.status}).`
    try {
      const j = (await res.json()) as { detail?: string }
      if (j?.detail) detail = j.detail
    } catch {
      /* non-JSON body — keep the generic message */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<MatrixRunKickoff>
}

/** POST /evals/engine-sweep — kick the skill-less cross-provider smoke sweep (D-02).
 *  Returns the refreshed engine-health board (each provider ✓/✗ with its verbatim
 *  error). Skill-less by design — the built-in in-memory fixture persists arms with
 *  NULL skill_id (migration 085), so the sweep never pollutes a user's run history. */
export async function runEngineSweep(): Promise<EngineHealthBoard> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/evals/engine-sweep`, { method: "POST", headers })
  if (!res.ok) throw new Error("Failed to run engine sweep.")
  return res.json() as Promise<EngineHealthBoard>
}

/** GET /evals/engine-health — the per-provider ✓/✗ smoke-sweep board (D-02 / 060-A).
 *  A missing provider key renders as an honest ✗ with its verbatim error, never a
 *  blocker. `swept_at` is null before the first sweep. */
export async function getEngineHealth(): Promise<EngineHealthBoard> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/evals/engine-health`, { headers })
  if (!res.ok) throw new Error("Failed to load engine health.")
  return res.json() as Promise<EngineHealthBoard>
}

/** GET /evals/runs/{runId} — the SKILL-LESS run readout (D-02). Same run+results
 *  shape as the skill-scoped getEvalRun, but keyed only by run_id so a NULL-skill
 *  smoke-sweep arm (migration 085) is readable without a skill_id in the path.
 *  Owner-scoped server-side (404 cross-user). */
export async function getEvalRunById(runId: string): Promise<EvalRunReadout> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/evals/runs/${runId}`, { headers })
  if (!res.ok) throw new Error("Failed to load eval run.")
  return res.json() as Promise<EvalRunReadout>
}

/** GET /skills/{id}/evals/aggregate — mean±stddev/delta over the accumulated eval-run
 *  history, grouped per (provider, model) (D-07). stddev is null at run_count<2; the
 *  analyst_notes are deterministic backend-computed lines (D-08). Empty configs = no
 *  history yet. */
export async function getEvalAggregate(skillId: string): Promise<EvalAggregate> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/aggregate`, { headers })
  if (!res.ok) throw new Error("Failed to load eval aggregate.")
  return res.json() as Promise<EvalAggregate>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 135 (SI-01) — self-improvement proposal lifecycle helpers.
//
// The whole propose → review → approve → re-eval → promote/not-promote loop.
// All authorization is enforced server-side (owner gate, 404-not-403 for cross-
// user — Plans 04/05, T-135-01); these helpers only carry getAuthHeaders() and
// never trust client state for authorization. The re-eval rides the EXISTING
// eval_* SSE via the companion `re_eval_run_id` — subscribe with subscribeToRun,
// no new demux branch. Each helper copies the startEvalRun fetch + getAuthHeaders
// + error-detail-extraction shape.
// ─────────────────────────────────────────────────────────────────────────────

/** Shared detail-extracting error for the proposal helpers (mirrors startEvalRun). */
async function proposalError(res: Response, fallback: string): Promise<Error> {
  let detail = `${fallback} (status ${res.status}).`
  try {
    // FastAPI 422 responses return `detail` as an ARRAY of objects, not a
    // string — assign only when it's actually a string, else keep the generic
    // fallback so validation errors never render as "[object Object]" (WR-04).
    const j = (await res.json()) as { detail?: unknown }
    if (typeof j?.detail === "string") detail = j.detail
  } catch {
    /* non-JSON body — keep the generic message */
  }
  return new Error(detail)
}

/** POST /skills/{id}/proposals — propose an improved instructions revision from
 *  a source eval run. Returns the fresh `proposed` SkillProposal. */
export async function proposeImprovement(
  skillId: string,
  sourceEvalRunId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/proposals`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source_eval_run_id: sourceEvalRunId }),
  })
  if (!res.ok) throw await proposalError(res, "Failed to propose improvement")
  return res.json() as Promise<SkillProposal>
}

/** GET /skills/{id}/proposals — owner-scoped proposals for the skill. */
export async function listProposals(skillId: string): Promise<SkillProposal[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/proposals`, { headers })
  if (!res.ok) throw await proposalError(res, "Failed to load proposals")
  return res.json() as Promise<SkillProposal[]>
}

/** GET /skills/{id}/proposals/{proposalId} — one proposal (durable readout). */
export async function getProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}`,
    { headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to load proposal")
  return res.json() as Promise<SkillProposal>
}

/** POST /skills/{id}/proposals/{proposalId}/approve — accept the proposal and
 *  kick off the companion re-eval. Returns the updated proposal + the
 *  `re_eval_run_id` to subscribe to (rides the existing eval_* SSE). */
export async function approveProposal(
  skillId: string,
  proposalId: string,
): Promise<ProposalApproveResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/approve`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to approve proposal")
  return res.json() as Promise<ProposalApproveResult>
}

/** POST /skills/{id}/proposals/{proposalId}/rerun — re-run the re-eval (e.g.
 *  after an interrupted run). Returns the updated proposal + a fresh
 *  `re_eval_run_id`. */
export async function rerunProposalReeval(
  skillId: string,
  proposalId: string,
): Promise<ProposalApproveResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/rerun`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to re-run proposal re-eval")
  return res.json() as Promise<ProposalApproveResult>
}

/** POST /skills/{id}/proposals/{proposalId}/reject — dismiss the proposal. */
export async function rejectProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/reject`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to reject proposal")
  return res.json() as Promise<SkillProposal>
}

/** POST /skills/{id}/proposals/{proposalId}/force-promote — operator override
 *  that promotes despite a failed gate (`override_forced` is recorded). */
export async function forcePromoteProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/force-promote`,
    // Send an explicit empty JSON body — a body-less POST 422s against the
    // force-promote route (CR-01, belt-and-suspenders per REVIEW.md). Content-Type
    // is already application/json via getAuthHeaders().
    { method: "POST", headers, body: JSON.stringify({}) },
  )
  if (!res.ok) throw await proposalError(res, "Failed to force-promote proposal")
  return res.json() as Promise<SkillProposal>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 139 (SI-02) — description-proposal wires. These mirror the SI-01 proposal
// helpers above but hit the `/description-proposals` routes. Additive, D-13: no
// shared-path change, reuse getAuthHeaders() + proposalError. A description
// proposal wraps a Trigger Tuner run's held-out winning DESCRIPTION in the
// propose→review-diff→approve→immutable-version lifecycle — there is NO
// post-approval re-eval (D-07), so approve returns a PLAIN SkillProposal (not the
// ProposalApproveResult / re_eval_run_id shape the SI-01 approve carries).
// ─────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/description-proposals — propose a new trigger description
 *  from a Trigger Tuner run's held-out per-provider winner. Body carries the
 *  tuner run's `run_id`; the `source_tuner_run_id` provenance FK is derived
 *  server-side from `tuner_runs.id`. Returns the fresh `proposed` SkillProposal
 *  (`kind='description'`). */
export async function proposeDescription(
  skillId: string,
  runId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals`,
    { method: "POST", headers, body: JSON.stringify({ run_id: runId }) },
  )
  if (!res.ok) throw await proposalError(res, "Failed to propose description")
  return res.json() as Promise<SkillProposal>
}

/** GET /skills/{id}/description-proposals — owner-scoped description proposals for
 *  the skill, newest-first. Returns the most recent row (or null when none) for
 *  rehydration-on-open of the Triggering-tab proposal card. */
export async function getLatestDescriptionProposal(
  skillId: string,
): Promise<SkillProposal | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals`,
    { headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to load description proposals")
  const rows = (await res.json()) as SkillProposal[]
  return rows.length > 0 ? rows[0] : null
}

/** POST /skills/{id}/description-proposals/{proposalId}/approve — accept the
 *  proposal, writing skills.description (which the 079 trigger versions). Returns
 *  a PLAIN SkillProposal — there is no companion re-eval run (D-07), so this does
 *  NOT return the ProposalApproveResult / re_eval_run_id shape the SI-01 approve
 *  carries. */
export async function approveDescriptionProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals/${proposalId}/approve`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to approve description proposal")
  return res.json() as Promise<SkillProposal>
}

/** POST /skills/{id}/description-proposals/{proposalId}/reject — dismiss the
 *  description proposal. Returns the updated SkillProposal. */
export async function rejectDescriptionProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals/${proposalId}/reject`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to reject description proposal")
  return res.json() as Promise<SkillProposal>
}

export interface ProviderInfo {
  id: string
  name: string
  base_url: string
  has_key: boolean
  is_active: boolean
  models: string[]
}

export interface FullAppSettings {
  active_provider: string
  llm_model: string
  available_models: string[]
  providers: ProviderInfo[]
  embedding_model: string
  embedding_base_url: string
  embedding_dimensions: number
  embedding_has_api_key: boolean
  // Phase 111.1 — the stored provider the picker reads back to show the current
  // selection (routes by stored provider, never name-inference — D-06 / D-09).
  embedding_provider: string
  extraction_provider: string
  extraction_model: string
  rerank_enabled: boolean
  rerank_provider: string
  rerank_model: string
  rerank_top_n: number
  rerank_has_api_key: boolean
  /** SEED-227 — per-document ceiling on images read by the vision model. */
  multimodal_max_vision_calls: number
  /** SEED-226. Empty means "use the active chat model" — never a pinned name. */
  vision_model: string
  vision_max_pages: number
  /**
   * SEED-258 — the largest file ANY connected source (Google Drive, Microsoft Graph, any
   * MCP file surface) will import, in MB. ONE knob: the MCP JSON-RPC envelope cap is
   * DERIVED from it server-side and is never a second field.
   */
  source_max_file_size_mb: number
  /**
   * ⛔ THE BOUNDS ARE SERVED, and that is deliberate. `api/settings.py:79`: *"a form
   * carrying its own copy of `50` is a fourth private constant, which is the defect this
   * replaced."* Read them; never re-type them in a component.
   */
  source_max_file_size_mb_floor: number
  source_max_file_size_mb_ceiling: number
  retrieval_top_k: number
  retrieval_match_threshold: number
  hybrid_search_enabled: boolean
  hybrid_candidate_count: number
  vector_search_weight: number
  keyword_search_weight: number
  rrf_k: number
  /**
   * Phase 241 (QUEUE-06 / D-09) — how many candidate vectors the index walks before the
   * search's filters are applied (`hnsw.ef_search`), and whether it keeps scanning until
   * enough results survive them (`hnsw.iterative_scan`).
   */
  hnsw_ef_search: number
  hnsw_iterative_scan: string
  /**
   * ⛔ THE BOUNDS AND THE ENUM MEMBERS ARE SERVED, for the same reason
   * `source_max_file_size_mb_floor` is: a form carrying its own copy of `1000`, or its own
   * list of the three pgvector modes, is a second private constant that drifts from the
   * database's CHECK with nothing to notice. Read them; never re-type them in a component.
   */
  hnsw_ef_search_floor: number
  hnsw_ef_search_ceiling: number
  hnsw_iterative_scan_values: string[]
  web_search_enabled: boolean
  web_search_has_api_key: boolean
  web_search_max_results: number
  sandbox_enabled: boolean
  // Phase 147 (FLAG-01 / migration 097) — the three net-new per-feature kill-switch
  // + maintenance flags added to the `FullSettingsResponse` contract (Plan 147-01).
  // `getSettings()` is the Control Room grid's flag-read source (no new flags GET);
  // `setFlag()` is the write path. Defaults keep existing behavior byte-identical:
  // self_improve/workflows default true, maintenance_mode false.
  self_improve_enabled: boolean
  workflows_enabled: boolean
  maintenance_mode: boolean
  // Phase 159 (MODEL-03 / D-159-04) — the persisted operator toggle that hides known
  // non-chat "utility" model ids (embeddings / audio / image / …) from the model-
  // discovery panel by default. Default true (migration 103). Rides the same
  // `getSettings()` read + `setFlag("model_discovery_filter_enabled", …)` write path as
  // the FLAG-01 booleans above; purely a display/curation concern (never gates the
  // confirmable diff — 149 red line). ControlRoomPage passes it to ModelDiscoveryPanel.
  model_discovery_filter_enabled: boolean
  context_window_max_tokens: number
  sub_agent_max_output_tokens: number
  sub_agent_model: string
  resolved_sub_agent_model: string
  // Phase 123 (D-08 / TRIG-01) — the skill-builder model knob (the model that
  // WRITES candidate descriptions + seeds Tuner cases). `skill_builder_model` is
  // the raw setting ("" => unset); `resolved_skill_builder_model` is the strong
  // default the resolver picks when unset (null only if no forceable default
  // exists — the honest-None floor). Decoupled from the benchmark targets.
  skill_builder_model: string
  resolved_skill_builder_model: string | null
  // Phase 137.1 (EVAL-05 / D-11, D-12) — the INDEPENDENT judge model knob (the model
  // that grades eval answers + the publish gate). `harness_judge_model` is the raw
  // setting ("" => unset); `resolved_harness_judge_model` is the strong registry
  // default the resolver picks when unset (claude-opus-4-8; null only if no forceable
  // default exists). Mirrors the skill_builder_model pair above; ONE resolver (D-11).
  harness_judge_model: string
  resolved_harness_judge_model: string | null
  llm_max_output_tokens: number
  openrouter_tool_strategy: "quality" | "native" | "xml"
  // Phase 075.3 D-075.3-13: registry-known model_ids — frontend uses this set
  // to decide whether to render the "unverified" badge inline next to each
  // model in the main LLM dropdown + selected-label.
  verified_models: string[]
  // Phase 075.3 D-075.3-13 + D-075.3-12: per-unknown-model inferred provider
  // mapping; frontend reads this to substitute {provider} in the tooltip text.
  inferred_provider_for: Record<string, string>
  // Phase 149 (MODEL-01 / D-149-05) — the global set of model_ids flagged
  // `deprecated` in the model registry. Plan 05 populates this in the backend
  // settings payload; the picker (ModelPillRow / MessageInput) reads it
  // defensively (`new Set(deprecated_models ?? [])`) to render an informational
  // `deprecated` badge on those pills. Optional so an older backend response
  // without the field never crashes the frontend (absent → empty set → no badge).
  deprecated_models?: string[]
}

export type AppSettings = FullAppSettings

export interface ProviderUpdate {
  id: string
  api_key?: string
  models?: string[]
  base_url?: string
}

export interface SettingsUpdate {
  active_provider?: string
  llm_model?: string
  providers?: ProviderUpdate[]
  embedding_model?: string
  embedding_api_key?: string
  embedding_base_url?: string
  embedding_dimensions?: number
  // Phase 111.1 — explicit provider pinning (D-06 embedding / D-09 extraction).
  // The picker stores the preset key so the backend routes by it. `extraction_model`
  // travels with the picker default; the backend persists `extraction_provider`
  // through the contract today (the model is stored via app_settings).
  embedding_provider?: string
  extraction_provider?: string
  extraction_model?: string
  confidence_bucket_high?: number
  confidence_bucket_medium?: number
  rerank_enabled?: boolean
  rerank_provider?: string
  rerank_api_key?: string
  rerank_model?: string
  rerank_top_n?: number
  multimodal_max_vision_calls?: number
  vision_model?: string
  vision_max_pages?: number
  /**
   * SEED-258. ⛔ There is no `_floor` / `_ceiling` here and there must never be: the bounds
   * are the SERVER's, read-only on the response. An out-of-range value is refused with a
   * 400 whose body says what raising the ceiling costs — the form does not clamp it away.
   */
  source_max_file_size_mb?: number
  retrieval_top_k?: number
  retrieval_match_threshold?: number
  hybrid_search_enabled?: boolean
  hybrid_candidate_count?: number
  vector_search_weight?: number
  keyword_search_weight?: number
  rrf_k?: number
  /**
   * Phase 241 (QUEUE-06 / D-09). ⛔ No `_floor` / `_ceiling` / `_values` here and there must
   * never be: the bounds are the SERVER's, read-only on the response. An out-of-range value
   * is refused with a 400 whose body says what a bigger search breadth COSTS.
   */
  hnsw_ef_search?: number
  hnsw_iterative_scan?: string
  tavily_api_key?: string
  web_search_max_results?: number
  sandbox_enabled?: boolean
  context_window_max_tokens?: number
  sub_agent_max_output_tokens?: number
  sub_agent_model?: string
  // Phase 123 (D-08) — the skill-builder model id (any provider incl. local; no SPOF).
  skill_builder_model?: string
  // Phase 137.1 (D-12) — the independent judge model id (registry-validated server-side;
  // "" clears back to the resolver default). Any provider incl. local — no SPOF.
  harness_judge_model?: string
  llm_max_output_tokens?: number
  openrouter_tool_strategy?: "quality" | "native" | "xml"
}
