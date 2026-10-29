/**
 * 300-01 Task 3 (D-14, client half) — the schedule doors' structured 422.
 *
 * `{detail: {code, message, missing}}` throws `ScheduleRefusalError` (still an `ApiError`) so a
 * surface routes the line by its CODE, never by matching words. The two shapes the reader
 * already handled — a string detail and FastAPI's array detail — keep today's `ApiError`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../_core", async () => {
  const actual = await vi.importActual<typeof import("../_core")>("../_core")
  return { ...actual, getAuthHeaders: vi.fn(async () => ({ Authorization: "Bearer t" })) }
})

import { ApiError } from "../_core"
import { createWorkflowSchedule, ScheduleRefusalError, updateSchedule } from "../schedules"

const SENTENCE = "Client name is required and has no value."

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

const BODY = {
  name: "n",
  cron_expression: "0 3 * * *",
  interval_seconds: null,
  timezone: "UTC",
  max_tokens_per_run: 1,
  max_duration_seconds: 1,
  inputs: {},
}

describe("schedules API — the structured missing_required refusal", () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it("an object detail throws ScheduleRefusalError with the code, the sentence and the labels", async () => {
    respond(422, { detail: { code: "missing_required", message: SENTENCE, missing: ["Client name"] } })
    const err = await createWorkflowSchedule("wf", BODY as never).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ScheduleRefusalError)
    expect(err).toBeInstanceOf(ApiError)
    const r = err as ScheduleRefusalError
    expect(r.code).toBe("missing_required")
    expect(r.message).toBe(SENTENCE)
    expect(r.missing).toEqual(["Client name"])
    expect(r.status).toBe(422)
  })

  it("the patch door throws the same error", async () => {
    respond(422, { detail: { code: "missing_required", message: SENTENCE, missing: ["Client name"] } })
    const err = await updateSchedule("s", { is_active: true }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ScheduleRefusalError)
    expect((err as ScheduleRefusalError).message).toBe(SENTENCE)
  })

  it("a string detail keeps today's ApiError", async () => {
    respond(400, { detail: "only a published workflow can be scheduled" })
    const err = await createWorkflowSchedule("wf", BODY as never).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).not.toBeInstanceOf(ScheduleRefusalError)
    expect((err as Error).message).toBe("only a published workflow can be scheduled")
  })

  it("an array detail keeps today's ApiError with the first msg", async () => {
    respond(422, { detail: [{ msg: "Value error, a schedule needs exactly one cadence" }] })
    const err = await createWorkflowSchedule("wf", BODY as never).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).not.toBeInstanceOf(ScheduleRefusalError)
    expect((err as Error).message).toBe("Value error, a schedule needs exactly one cadence")
  })
})
