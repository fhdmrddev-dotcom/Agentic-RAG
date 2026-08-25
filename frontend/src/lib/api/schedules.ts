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
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
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
    throw new ApiError(await readScheduleFailure(res), res.status)
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
    throw new ApiError(await readScheduleFailure(res), res.status)
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
    throw new ApiError(await readScheduleFailure(res), res.status)
  }
  return (await res.json()) as ScheduleTriggerResult
}

/** Pull the server's own sentence out of a refusal, falling back to a status line.
 *
 *  ⚠ NOT exported. It is a private helper of the six above, and a seventh runtime export would
 *  cost twelve more mock-factory lines for something no component calls. */
async function readScheduleFailure(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === "string") return detail
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
