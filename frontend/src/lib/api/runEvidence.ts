/**
 * Phase 289 (VIS-03 / D-01 / D-03 / D-05) — the evidence read of a FINISHED workflow run.
 *
 * `GET /workflow-runs/{id}/evidence` (plan 289-03) composes the four sections of the
 * read-only record — the definition the run ran, the phase log, the verdicts and the cited
 * sources — for the run's owner and for any member of the run's organisation. Every refusal
 * (no such run, another organisation, a run that has not finished) answers the SAME 404
 * body, so the client cannot tell them apart and neither can the page.
 *
 * ⚠ ITS OWN SPECIFIER, NOT A RE-EXPORT THROUGH `lib/api.ts`. That file is the hottest in the
 * repository and suites mock it by path, so a new export there is a blast radius; the report
 * imports this module directly and its tests mock exactly this path.
 *
 * ⚠ THE TYPES BELOW ARE THE WIRE CONTRACT VERBATIM (289-03-PLAN.md <interfaces>). Plan 05
 * pins the key sets from both sides with one shared fixture, so a rename here must be a rename
 * there in the same change.
 */
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
import type { RunPhaseConfidence } from "./workflows"

export interface RunEvidenceRun {
  id: string
  status: "completed" | "failed" | "cancelled"
  workflow_name: string | null
  started_at: string | null
  completed_at: string | null
  started_by: { name: string; email: string | null; is_you: boolean }
  org_name: string | null
  model: string | null
  viewer_is_owner: boolean
  thread_id: string | null
}

export interface RunEvidenceDefinitionPhase {
  n: number
  slug: string
  name: string
  phase_type: string | null
}

export interface RunEvidenceDefinition {
  recorded: boolean
  version: number | null
  phases: RunEvidenceDefinitionPhase[]
  full: Record<string, unknown> | null
}

export interface RunEvidenceDefinitionChanged {
  changed: boolean
  current_version: number | null
}

export interface RunEvidenceDeliverable {
  kind: "file" | "text" | "none"
  name: string | null
  file_id: string | null
}

export interface RunEvidenceHumanInput {
  answered: boolean
  question: string | null
  answer: string | null
  answered_by: string | null
}

export interface RunEvidencePhase {
  n: number
  slug: string
  name: string
  phase_type: string | null
  status: string
  started_at: string | null
  completed_at: string | null
  step_count: number | null
  step_noun: string | null
  output_text: string | null
  failure_reason: string | null
  confidence: RunPhaseConfidence | null
  human_input: RunEvidenceHumanInput | null
}

export interface RunEvidenceVerdict {
  step_n: number | null
  phase_slug: string | null
  kind: string
  result: "passed" | "failed" | "recorded"
  checked: string[]
  at: string | null
}

export interface RunEvidenceSource {
  masked: boolean
  document_id: string | null
  filename: string | null
  locations: number[]
  cited_by: number[]
}

export interface RunEvidence {
  run: RunEvidenceRun
  definition: RunEvidenceDefinition
  definition_changed: RunEvidenceDefinitionChanged
  kb_label: string
  deliverable: RunEvidenceDeliverable
  phase_log: RunEvidencePhase[]
  verdicts: RunEvidenceVerdict[]
  sources: RunEvidenceSource[]
}

/**
 * Read a finished run's evidence. Throws the status-carrying `ApiError` (the
 * `getWorkflowRun` convention) so the report can word a 404 — "This run isn't available" —
 * differently from any other failure. The id is encoded into its path segment.
 */
export async function getRunEvidence(runId: string, signal?: AbortSignal): Promise<RunEvidence> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflow-runs/${encodeURIComponent(runId)}/evidence`, {
    headers,
    signal,
  })
  if (!res.ok) throw new ApiError(`Failed to load the run record (status ${res.status})`, res.status)
  return (await res.json()) as RunEvidence
}
