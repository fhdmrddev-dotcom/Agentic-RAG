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
  WorkflowStaleTokenError,
  WorkflowDraftUnreadableError,
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

  it("WR-02: a 400 with a missing/mistyped detail throws — never an undefined verdict", async () => {
    // A detail-less 400 body must NOT cast `undefined` to PublishVerdict (the gauntlet
    // would crash on verdict.named_failures.length). It throws an honest error instead.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(400, { message: "bad request" })))
    await expect(publishWorkflow("wf-1", "x")).rejects.toThrow(/malformed verdict body/)

    // A 400 whose detail is a bare string (not a PublishVerdict object) also throws.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(400, { detail: "no business requirement" })))
    await expect(publishWorkflow("wf-1", "x")).rejects.toThrow(/malformed verdict body/)
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

// ── Phase 186-03 (CONCUR-02 · D-186-07) — the opaque concurrency token ────────────
//
// The token must ride EVERY response that seeds a builder session, because a draft
// reaches the Builder by FOUR routes: fresh build (create), fork a starter (create),
// Tweak (create) and open-a-draft (the drafts LIST). Miss one and that path autosaves
// with no guard at all. These cases pin all three origins plus the request header.
describe("the concurrency token — every seeding response carries it, the PATCH echoes it", () => {
  // A realistic server token: microsecond precision, which is exactly why the client
  // must treat it as an opaque string and never round-trip it through a JS date type.
  const TOKEN_A = "2026-08-01 12:00:00.123456+00"
  const TOKEN_B = "2026-08-01 12:00:07.987654+00"

  function headersOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
    const init = fetchMock.mock.calls[0][1] as RequestInit
    return (init.headers ?? {}) as Record<string, string>
  }

  it("createWorkflowDraft returns the token from a 201 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonRes(201, { id: "wf-new", version: 1, token: TOKEN_A })),
    )
    const out = await createWorkflowDraft({ slug: "wf", phases: [] })
    expect(out).toEqual({ id: "wf-new", version: 1, token: TOKEN_A })
  })

  it("listDraftWorkflows returns rows carrying the token", async () => {
    const rows = [{ id: "wf-1", slug: "wf", version: 1, name: "My WF", token: TOKEN_A }]
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, rows)))
    const out = await listDraftWorkflows()
    expect(out[0].token).toBe(TOKEN_A)
  })

  it("updateWorkflowDraft sends the token VERBATIM as the If-Match request header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { id: "wf-1", version: 1, token: TOKEN_B }))
    vi.stubGlobal("fetch", fetchMock)

    await updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, TOKEN_A)

    // VERBATIM: byte-for-byte what the server handed us, microseconds intact.
    expect(headersOf(fetchMock)["If-Match"]).toBe(TOKEN_A)
  })

  it("updateWorkflowDraft sends NO If-Match header when it has no token", async () => {
    // An absent header is today's unguarded write — the deliberate one-release
    // concession for a tab that was already open when the guard shipped.
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { id: "wf-1", version: 1, token: TOKEN_B }))
    vi.stubGlobal("fetch", fetchMock)

    await updateWorkflowDraft("wf-1", { slug: "wf", phases: [] })

    expect(headersOf(fetchMock)).not.toHaveProperty("If-Match")

    // …and a null token is the same case (the hook holds `null` before its first read).
    const nullMock = vi.fn().mockResolvedValue(jsonRes(200, { id: "wf-1", version: 1, token: TOKEN_B }))
    vi.stubGlobal("fetch", nullMock)
    await updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, null)
    expect(headersOf(nullMock)).not.toHaveProperty("If-Match")
  })

  it("updateWorkflowDraft returns the response's token, so writes chain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonRes(200, { id: "wf-1", version: 1, token: TOKEN_B })),
    )
    const out = await updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, TOKEN_A)
    // The value the NEXT PATCH must send — a write that returned no fresh token would
    // leave the next one guarded by a token the server has already superseded.
    expect(out.token).toBe(TOKEN_B)
    expect(out.version).toBe(1)
  })
})

// ── Phase 186-03 (D-186-04 / D-186-09) — the two refusals the 409 arm used to throw
//    away, and the 422 arm that did not exist at all ───────────────────────────────
describe("updateWorkflowDraft — a refusal is classified by machine code, never by prose", () => {
  it("a 409 coded stale_token throws WorkflowStaleTokenError carrying the CURRENT token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonRes(409, {
          detail: {
            code: "stale_token",
            message: "this draft was changed somewhere else since you loaded it",
            token: "T-current",
          },
        }),
      ),
    )
    const err = await updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, "T-stale").catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(WorkflowStaleTokenError)
    // The token the server holds NOW, so "overwrite with what's on screen" is ONE
    // more PATCH rather than a re-read followed by a PATCH.
    expect((err as WorkflowStaleTokenError).currentToken).toBe("T-current")
    // Consumers branch on the NAME (a rejection that crossed a module boundary still
    // classifies), so the name is part of the contract.
    expect((err as Error).name).toBe("WorkflowStaleTokenError")
  })

  it("a 409 coded already_published throws WorkflowConflictError (today's sentence, unchanged)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonRes(409, {
          detail: { code: "already_published", message: "workflow is published and cannot be modified" },
        }),
      ),
    )
    await expect(
      updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, "T-any"),
    ).rejects.toBeInstanceOf(WorkflowConflictError)
  })

  it("WR-02: a 409 whose body will not parse REJECTS — it never resolves as a save", async () => {
    // The failure mode this guards is a refusal quietly becoming a success receipt.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input")
        },
      }),
    )
    await expect(
      updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, "T-any"),
    ).rejects.toBeInstanceOf(WorkflowConflictError)

    // A body that parses but carries no `detail` is the same unclassifiable case.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(409, {})))
    await expect(
      updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, "T-any"),
    ).rejects.toBeInstanceOf(WorkflowConflictError)
  })

  it("a 409 carrying a code this client has never seen falls back to WorkflowConflictError", async () => {
    // The SERVER owns the refusal vocabulary. An unknown code fails CLOSED here rather
    // than being narrowed away by a client-side allow-list.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonRes(409, { detail: { code: "a_cause_invented_after_this_client_shipped" } }),
      ),
    )
    await expect(
      updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, "T-any"),
    ).rejects.toBeInstanceOf(WorkflowConflictError)
  })

  it("a 422 throws WorkflowDraftUnreadableError whose message leaks NONE of the raw body", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const rawBody = {
      detail: [
        {
          loc: ["body", "phases", 0, "config", "reticulation_prompt"],
          msg: "Field required",
          type: "missing",
        },
      ],
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(422, rawBody)))

    const err = await updateWorkflowDraft("wf-1", { slug: "wf", phases: [] }, "T-any").catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(WorkflowDraftUnreadableError)

    // A validation body is internal field paths and framework phrasing. It is logged
    // ONCE at this boundary and carried no further — never onto an authoring surface
    // aimed at business users.
    const message = (err as Error).message
    for (const leak of [
      "loc",
      "body",
      "phases",
      "config",
      "reticulation_prompt",
      "Field required",
      "missing",
    ]) {
      expect(message).not.toContain(leak)
    }
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })
})
