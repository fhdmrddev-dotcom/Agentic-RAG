/**
 * Phase 103-03 Task 3 (REQ-6 / REQ-1) — workflow authoring client fns.
 *
 * These tests pin the load-bearing CLIENT contracts:
 *  - publishWorkflow distinguishes the 4 HTTP outcomes. A 200 carrying
 *    {published:false, blocked_stage:...} is a BLOCK, NOT a success — the client
 *    reads the SERVER verdict verbatim, never re-derives pass/block, and a binary
 *    `200 = ok else = error` handler is FORBIDDEN (T-103-03-01).
 *  - generateWorkflow reads a 200 `ok:false` structured error WITHOUT throwing
 *    (the route returns 200 even on a failed generation).
 *  - updateWorkflowDraft throws a typed WorkflowConflictError on 409 (a published
 *    or cross-user mutation is never swallowed as success — T-103-03-04).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock Supabase auth so getAuthHeaders returns a token without a real session.
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}))
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: mockGetSession },
  },
}))

import {
  createWorkflowDraft,
  listDraftWorkflows,
  updateWorkflowDraft,
  deleteWorkflowDraft,
  generateWorkflow,
  publishWorkflow,
  WorkflowConflictError,
  WorkflowNotFoundError,
  type PublishVerdict,
} from "@/lib/api"

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "u1" }, access_token: "tok-123" } },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("publishWorkflow — the 4 distinct HTTP outcomes (no binary 200/else handler)", () => {
  it("a 200 with {published:false, blocked_stage:'judge'} is surfaced as a BLOCK, not success", async () => {
    const verdict: PublishVerdict = {
      published: false,
      version: null,
      golden_run_id: null,
      blocked_stage: "judge",
      named_failures: [{ criterion: "answers_business_requirement", score: 2, evidence: "..." }],
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, verdict)))

    const out = await publishWorkflow("wf-1", "do the thing")

    expect(out.kind).toBe("verdict")
    if (out.kind !== "verdict") throw new Error("expected a verdict outcome")
    // The block must survive — the client reads body.published, never re-derives.
    expect(out.verdict.published).toBe(false)
    expect(out.verdict.blocked_stage).toBe("judge")
    expect(out.verdict.named_failures).toHaveLength(1)
  })

  it("a 200 with {published:true} is surfaced as a successful verdict", async () => {
    const verdict: PublishVerdict = {
      published: true,
      version: 2,
      golden_run_id: "run-9",
      blocked_stage: null,
      named_failures: [],
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, verdict)))

    const out = await publishWorkflow("wf-1", "do the thing")
    expect(out.kind).toBe("verdict")
    if (out.kind !== "verdict") throw new Error("expected a verdict outcome")
    expect(out.verdict.published).toBe(true)
    expect(out.verdict.version).toBe(2)
    expect(out.verdict.golden_run_id).toBe("run-9")
  })

  it("a 400 maps to kind:'business_requirement' carrying the verdict from detail", async () => {
    const verdict: PublishVerdict = {
      published: false,
      version: null,
      golden_run_id: null,
      blocked_stage: "business_requirement",
      named_failures: ["the workflow has no business_requirement"],
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(400, { detail: verdict })))

    const out = await publishWorkflow("wf-1", "x")
    expect(out.kind).toBe("business_requirement")
    if (out.kind !== "business_requirement") throw new Error("expected business_requirement")
    expect(out.verdict.blocked_stage).toBe("business_requirement")
  })

  it("a 404 maps to kind:'not_found'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, { detail: "workflow not found" })))
    const out = await publishWorkflow("missing", "x")
    expect(out.kind).toBe("not_found")
  })

  it("a 409 maps to kind:'already_published'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(409, { detail: "already published" })))
    const out = await publishWorkflow("wf-1", "x")
    expect(out.kind).toBe("already_published")
  })

  it("an unexpected status (500) throws (never silently treated as a verdict)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, { detail: "boom" })))
    await expect(publishWorkflow("wf-1", "x")).rejects.toThrow()
  })
})

describe("generateWorkflow — a 200 ok:false is a structured error, never a throw", () => {
  it("reads {ok:false, error, detail} from a 200 without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonRes(200, { ok: false, error: "could not generate", detail: "model emitted no definition" }),
      ),
    )
    const out = await generateWorkflow({ describe: "summarize my KB" })
    expect(out.ok).toBe(false)
    if (out.ok) throw new Error("expected ok:false")
    expect(out.error).toBe("could not generate")
    expect(out.detail).toBe("model emitted no definition")
  })

  it("reads {ok:true, definition} from a 200", async () => {
    const definition = { slug: "wf", version: 1, phases: [] }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { ok: true, definition })))
    const out = await generateWorkflow({ describe: "x" })
    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok:true")
    expect(out.definition).toEqual(definition)
  })
})

describe("draft CRUD — typed conflict / not-found errors (never a silent overwrite)", () => {
  it("createWorkflowDraft returns {id, version} on 201", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(201, { id: "wf-new", version: 1 })))
    const out = await createWorkflowDraft({ slug: "wf", phases: [] })
    expect(out).toEqual({ id: "wf-new", version: 1 })
  })

  it("listDraftWorkflows returns the rows on 200", async () => {
    const rows = [{ id: "wf-1", slug: "wf", version: 1, name: "My WF" }]
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, rows)))
    const out = await listDraftWorkflows()
    expect(out).toEqual(rows)
  })

  it("updateWorkflowDraft throws WorkflowConflictError on 409 (published row frozen)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(409, { detail: "workflow is published" })))
    await expect(updateWorkflowDraft("wf-1", { slug: "wf", phases: [] })).rejects.toBeInstanceOf(
      WorkflowConflictError,
    )
  })

  it("updateWorkflowDraft throws WorkflowNotFoundError on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, { detail: "not found" })))
    await expect(updateWorkflowDraft("missing", { slug: "wf", phases: [] })).rejects.toBeInstanceOf(
      WorkflowNotFoundError,
    )
  })

  it("deleteWorkflowDraft throws WorkflowConflictError on 409 and resolves on 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(409, { detail: "published" })))
    await expect(deleteWorkflowDraft("wf-1")).rejects.toBeInstanceOf(WorkflowConflictError)

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) }))
    await expect(deleteWorkflowDraft("wf-1")).resolves.toBeUndefined()
  })
})
