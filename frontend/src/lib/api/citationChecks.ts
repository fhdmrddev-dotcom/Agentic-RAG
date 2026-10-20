/**
 * Phase 294-05 (DEC-03, D-13, D-15, D-16) — the citation-check client.
 *
 * `GET /citation-checks?message_ids=a,b` (at most 100 ids) answers the stored checks the caller
 * may see plus whether a check can run right now; `POST /citation-checks/{message_id}` runs (or
 * re-runs) one. The request carries a message id and nothing else: the server derives every claim
 * from the stored message (plan 294-03, T-294-14).
 *
 * ⚠ ITS OWN SPECIFIER, NOT A RE-EXPORT THROUGH `lib/api.ts`. That file is the hottest in the
 * repository and suites mock it by path, so a new export there is a blast radius; the store
 * imports this module directly and its tests mock exactly this path.
 *
 * ⚠ THE TYPES BELOW ARE THE WIRE CONTRACT VERBATIM (`backend/app/models/citation_check.py`).
 * `__tests__/citationChecks.contract.test.ts` pins the key sets against the backend's own fixture
 * and `citationVerdicts.parity.test.ts` reads the Literals from the Python source, so a rename
 * there must be a rename here in the same change.
 */
import { API_BASE, ApiError, getAuthHeaders } from "./_core"

export type Verdict = "supported" | "partly_supported" | "not_supported" | "contradicted" | "couldnt_check"
export type CheckEngineId = "jev" | "openai_decisions"
export type UnavailableReason = "off" | "engine_reorders_only" | "key_missing"

export interface CitationClaimResult {
  ordinal: number
  n: number
  sentence: string
  verdict: Verdict
  confidence: number | null
}

export interface CitationCheckCounts {
  supported: number
  partly_supported: number
  not_supported: number
  contradicted: number
  couldnt_check: number
}

export interface CitationCheckUsage {
  input_tokens: number | null
  cost_usd: number | null
}

export interface CitationCheckResult {
  version: 1
  engine: CheckEngineId
  model: string
  checked_at: string
  claims: CitationClaimResult[]
  counts: CitationCheckCounts
  usage: CitationCheckUsage
}

export interface CitationCheckAvailability {
  available: boolean
  engine: CheckEngineId | null
  reason: UnavailableReason | null
}

export interface CitationChecksResponse {
  availability: CitationCheckAvailability
  checks: Record<string, CitationCheckResult>
}

/**
 * A refused check. `reason` is the server's 409 `{"detail": {"reason": …}}` word (`off`,
 * `engine_reorders_only`, `key_missing`, `in_flight`) or its 503 `engine_failed` (no engine call
 * answered, nothing stored — 294-REVIEW CR-01), or null when the detail is a plain string
 * (422) or unreadable. The UI words every case from its own fixed vocabulary; `detail` is kept for
 * diagnosis only and is never rendered.
 */
export class CitationCheckApiError extends ApiError {
  readonly reason: string | null
  readonly detail: unknown
  constructor(message: string, status: number, detail: unknown) {
    super(message, status)
    this.name = "CitationCheckApiError"
    this.detail = detail
    const r = (detail as { reason?: unknown } | null)?.reason
    this.reason = detail && typeof detail === "object" && typeof r === "string" ? r : null
  }
}

async function readDetail(res: Response): Promise<unknown> {
  try {
    const body = (await res.json()) as { detail?: unknown } | null
    return body?.detail ?? null
  } catch {
    return null
  }
}

/** Stored checks for these messages (one request, ids encoded one by one) + availability. */
export async function getCitationChecks(
  messageIds: string[],
  signal?: AbortSignal,
): Promise<CitationChecksResponse> {
  const headers = await getAuthHeaders()
  const ids = messageIds.map(encodeURIComponent).join(",")
  const res = await fetch(`${API_BASE}/citation-checks?message_ids=${ids}`, { headers, signal })
  if (!res.ok) throw new ApiError(`Failed to load citation checks (status ${res.status})`, res.status)
  return (await res.json()) as CitationChecksResponse
}

/** Run (or re-run) the check for one settled assistant answer. A re-check replaces the stored one. */
export async function runCitationCheck(messageId: string): Promise<CitationCheckResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/citation-checks/${encodeURIComponent(messageId)}`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    const detail = await readDetail(res)
    throw new CitationCheckApiError(`Citation check refused (status ${res.status})`, res.status, detail)
  }
  return (await res.json()) as CitationCheckResult
}
