/**
 * Phase 204 (SCHED-01) — the workflow-schedule wire shapes.
 *
 * A standalone leaf: it imports nothing and is imported by the client (`lib/api.ts`) and the
 * modal. It deliberately does NOT live in `types/index.ts` — that file is 56 phases hot and a
 * union member added there owes a `SUBSTEP_META` entry in the same commit; a schedule is a
 * separate concern with no such obligation.
 *
 * ⚠ **THE FIELD LIST MIRRORS `WorkflowScheduleRead`, AND THE MIRRORING IS THE POINT.** The
 * backend's `response_model` DROPS UNDECLARED KEYS SILENTLY, so the three places a column has
 * to be spelled are the `.select()` string, that pydantic model, and — for the browser to see
 * it — this interface. A column present in two of the three reaches the database and nowhere
 * a person can read it, with every test still green.
 */

/** Exactly one of `cron_expression` / `interval_seconds` is ever non-null. */
export interface WorkflowSchedule {
  id: string
  workflow_id: string
  name: string
  cron_expression: string | null
  interval_seconds: number | null
  timezone: string
  is_active: boolean
  max_tokens_per_run: number
  max_duration_seconds: number
  inputs: Record<string, unknown>
  /**
   * ⚠ `null` and `undefined` are DIFFERENT and a normalizer must not collapse them.
   * `null` = the server looked and this schedule has never run. **Absent** = the wire never
   * mentioned the field, i.e. a frontend deployed ahead of its backend. Collapsing them makes
   * the UI state "never run" about a schedule that has run a hundred times — the exact defect
   * `library/runFacts.ts` carries a three-armed resolution for.
   */
  last_run_at?: string | null
  next_run_at?: string | null
  last_status?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** Joined by the cross-workflow list only; absent on the per-workflow list. */
  workflow_name?: string | null
}

/** The create body. The server refuses both-or-neither cadences with a 422. */
export interface WorkflowScheduleCreate {
  name: string
  cron_expression?: string | null
  interval_seconds?: number | null
  timezone?: string
  is_active?: boolean
  max_tokens_per_run?: number
  max_duration_seconds?: number
  inputs?: Record<string, unknown>
}

/** The patch body — every field optional; an absent key means "leave it alone". */
export type WorkflowScheduleUpdate = Partial<WorkflowScheduleCreate>

/** `POST /schedules/{id}/trigger`. `launched: false` carries a `detail` worth showing. */
export interface ScheduleTriggerResult {
  launched: boolean
  workflow_run_id?: string | null
  detail?: string | null
}

/**
 * The two cadence kinds, as the modal's own control models them.
 *
 * ⚠ It is a CLOSED union rather than a boolean, because "cron" and "every N" are two different
 * things a person means, not two states of one thing — and because a third kind (a one-shot
 * date, say) would then be a compile error at every branch rather than a silently-wrong
 * `else`.
 */
export type ScheduleCadenceKind = "cron" | "interval"
