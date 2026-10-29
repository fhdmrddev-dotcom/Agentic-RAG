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

import type { ScheduleTriggerResult, WorkflowSchedule, WorkflowScheduleCreate, WorkflowScheduleUpdate } from "@/types/schedule"
import { API_BASE, ApiError, entitlementRefusalMessage, getAuthHeaders } from "./_core"
export async function listSchedules(signal?: AbortSignal): Promise<WorkflowSchedule[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/schedules`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load schedules (status ${res.status})`, res.status)
  }
  return (await res.json()) as WorkflowSchedule[]
}

/** Every schedule the caller owns on ONE workflow. An unknown id returns `[]`, never a 404 —
 *  the route refuses to be an existence oracle for workflow ids. */
export async function listWorkflowSchedules(
  workflowId: string,
  signal?: AbortSignal,
): Promise<WorkflowSchedule[]> {
  const headers = await getAuthHeaders()
  // `encodeURIComponent` on a path segment for the same reason `getWorkflowRun` does it: the id
  // is server-supplied today but arrives here as a plain string, and `/` `?` `#` are STRUCTURAL.
  const res = await fetch(
    `${API_BASE}/workflows/${encodeURIComponent(workflowId)}/schedules`,
    { headers, signal },
  )
  if (!res.ok) {
    throw new ApiError(`Failed to load schedules (status ${res.status})`, res.status)
  }
  return (await res.json()) as WorkflowSchedule[]
}

/** Create a schedule on a PUBLISHED workflow.
 *
 *  ⚠ The server's refusals are worth surfacing verbatim rather than folding into one message:
 *  a 422 means the cadence itself is wrong (a malformed cron, an unknown zone, both or neither
 *  cadence) and a 400 means the workflow is still a draft. They ask the person for two
 *  completely different actions. */
export async function createWorkflowSchedule(
  workflowId: string,
  body: WorkflowScheduleCreate,
): Promise<WorkflowSchedule> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/workflows/${encodeURIComponent(workflowId)}/schedules`,
    { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) },
  )
  if (!res.ok) {
    throw await scheduleFailure(res)
  }
  return (await res.json()) as WorkflowSchedule
}

/** Patch or toggle a schedule. An absent key means "leave it alone". */
export async function updateSchedule(
  scheduleId: string,
  patch: WorkflowScheduleUpdate,
): Promise<WorkflowSchedule> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(scheduleId)}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    throw await scheduleFailure(res)
  }
  return (await res.json()) as WorkflowSchedule
}

/** Delete a schedule. Does NOT cancel runs it already launched — those are ordinary runs with
 *  their own Stop control, and killing live work because its trigger was removed is a surprise. */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(scheduleId)}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) {
    throw new ApiError(`Failed to delete the schedule (status ${res.status})`, res.status)
  }
}

/** Run a schedule NOW. ⚠ This does NOT advance its cadence — "show me what this does" is not
 *  "consider this cadence satisfied", and advancing would silently skip the next real firing. */
export async function triggerSchedule(scheduleId: string): Promise<ScheduleTriggerResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/schedules/${encodeURIComponent(scheduleId)}/trigger`,
    { method: "POST", headers },
  )
  if (!res.ok) {
    throw await scheduleFailure(res)
  }
  return (await res.json()) as ScheduleTriggerResult
}

/** 300-01 (D-14) — a schedule refusal the server STRUCTURED: `detail = {code, message, missing}`
 *  (today only `missing_required`, from create / patch-inputs / resume). It is still an
 *  `ApiError`; a surface routes the line by `code`, never by matching the words.
 *
 *  ⚠ Exported from this module only, NOT re-exported through `lib/api.ts` (see the note on
 *  `readScheduleFailure`): the schedule modal reads `code` off the thrown error instead of
 *  importing the class, so no suite that mocks `@/lib/api` by factory has to learn a name. */
export class ScheduleRefusalError extends ApiError {
  readonly code: string
  readonly missing: string[]
  constructor(message: string, status: number, code: string, missing: string[] = []) {
    super(message, status)
    this.name = "ScheduleRefusalError"
    this.code = code
    this.missing = missing
  }
}

/** The thrown error for a refusal: structured → `ScheduleRefusalError`, else today's `ApiError`. */
async function scheduleFailure(res: Response): Promise<ApiError> {
  const failure = await readScheduleFailure(res)
  if (typeof failure === "string") return new ApiError(failure, res.status)
  return new ScheduleRefusalError(failure.message, res.status, failure.code, failure.missing)
}

/** Pull the server's own sentence out of a refusal, falling back to a status line.
 *
 *  ⚠ NOT exported. It is a private helper of the six above, and a seventh runtime export would
 *  cost twelve more mock-factory lines for something no component calls. */
async function readScheduleFailure(
  res: Response,
): Promise<string | { message: string; code: string; missing: string[] }> {
  try {
    const body = await res.json()
    const tierMsg = entitlementRefusalMessage(body) // UAT-265-258-c: a tier refusal names the plan
    if (tierMsg) return tierMsg
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === "string") return detail
    // 300-01 (D-14): a structured refusal — the sentence plus the code that routes it.
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const d = detail as { code?: unknown; message?: unknown; missing?: unknown }
      if (typeof d.code === "string" && typeof d.message === "string") {
        const missing = Array.isArray(d.missing)
          ? d.missing.filter((m): m is string => typeof m === "string")
          : []
        return { message: d.message, code: d.code, missing }
      }
    }
    // FastAPI's 422 detail is an ARRAY of per-field errors; the first one's `msg` is the
    // sentence a person can act on ("Value error, a schedule needs exactly one cadence...").
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown }
      if (typeof first?.msg === "string") return first.msg
    }
  } catch {
    // fall through — a non-JSON body is not worth a second failure mode
  }
  return `The request was refused (status ${res.status})`
}
