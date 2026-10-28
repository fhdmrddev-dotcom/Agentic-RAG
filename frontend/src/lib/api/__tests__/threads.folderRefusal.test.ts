/**
 * Phase 298-02 (ORG-05 / D-36 / UI-D12) — the attended launch's folder refusal reaches the person
 * in the server's own words.
 *
 * The attended preflight answers a workflow bound to another org's folder with a 422 whose
 * `detail` is an OBJECT, `{code: "folder_in_other_org", message}` (the `stale_token` precedent).
 * `postMessage` used to read `detail` only when it was a string, so that sentence was replaced by
 * "Failed to send message". The Run modal and the chat launch form both render `e.message`
 * verbatim, so this one change is what puts the sentence on both surfaces.
 *
 * Pinned here:
 *   - an object `detail` with a string `message` → the thrown ApiError carries that message,
 *     its status, and the machine `code` (what the in-thread starter branches on);
 *   - a string `detail` behaves exactly as before;
 *   - an object `detail` with no string `message` (a FastAPI validation array) keeps the
 *     generic fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("../_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_core")>()
  return {
    ...actual,
    API_BASE: "http://api.test",
    getAuthHeaders: async () => ({ Authorization: "Bearer tok" }),
  }
})

import { ApiError } from "../_core"
import { postMessage } from "../threads"

const SENTENCE =
  "“Q3 Contracts” is in Acme Legal, not in this workflow's organization (Personal). Pick a folder from Personal."

function res(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

describe("298-02 — postMessage keeps the server's sentence from an object detail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("an object detail with a string message → that message, the status and the code", async () => {
    vi.mocked(fetch).mockResolvedValue(
      res(422, { detail: { code: "folder_in_other_org", message: SENTENCE } }),
    )
    const err = await postMessage("t1", "Run it", { workflowDefinitionId: "wf" }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe(SENTENCE)
    expect((err as ApiError).status).toBe(422)
    expect((err as { code?: string }).code).toBe("folder_in_other_org")
  })

  it("a string detail behaves as today", async () => {
    vi.mocked(fetch).mockResolvedValue(res(400, { detail: "Workflow is not runnable" }))
    const err = await postMessage("t1", "Run it", {}).catch((e: unknown) => e)
    expect((err as ApiError).message).toBe("Workflow is not runnable")
    expect((err as { code?: string }).code).toBeUndefined()
  })

  it("an array detail keeps the generic fallback", async () => {
    vi.mocked(fetch).mockResolvedValue(res(422, { detail: [{ loc: ["body"], msg: "x" }] }))
    const err = await postMessage("t1", "Run it", {}).catch((e: unknown) => e)
    expect((err as ApiError).message).toBe("Failed to send message")
  })
})
