/**
 * Phase 101.1-09 (gap 3) — downloadWorkspaceFile helper (the 067.3 blob pattern
 * for workspace deliverables) + the phase_substep demux branch (gap 6).
 *
 * Task 1: downloadWorkspaceFile(threadId, fileId, filename) injects the Bearer
 * token, fetches the raw-bytes route, and on 200 blobs → programmatic <a download>
 * click; on 401/404 throws DownloadError(status) — mirroring downloadSandboxOutput.
 *
 * Task 2: a `phase_substep` SSE invokes the new onPhaseSubstep callback with the
 * flat payload {phase, phaseIndex, status?, failure?}; the branch carries NO
 * return (cursor still advances).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ── Mock Supabase auth so getAuthToken returns a token without a real session ──
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}))
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: mockGetSession },
  },
}))

import {
  downloadWorkspaceFile,
  DownloadError,
  subscribeToRun,
  type StreamCallbacks,
} from "@/lib/api"

const THREAD = "thread-1"
const FILE = "file-abc"

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

describe("downloadWorkspaceFile (gap 3 — Bearer blob download of a workspace deliverable)", () => {
  it("injects the Bearer token, hits the raw-bytes route, and triggers an <a download> click on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["bytes"], { type: "application/octet-stream" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    // Spy the programmatic anchor click.
    const clickSpy = vi.fn()
    const realCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag)
      if (tag === "a") el.click = clickSpy
      return el
    })
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:fake"),
      revokeObjectURL: vi.fn(),
    })

    await downloadWorkspaceFile(THREAD, FILE, "risk-register.docx")

    // The raw-bytes route was hit with a Bearer header.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      `http://localhost:8000/threads/${THREAD}/workspace/files/${FILE}/raw`,
    )
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok-123",
    })
    // The download was triggered.
    expect(clickSpy).toHaveBeenCalledTimes(1)
    createSpy.mockRestore()
  })

  it("throws DownloadError(401) on a 401 (session expired)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(downloadWorkspaceFile(THREAD, FILE, "f.docx")).rejects.toMatchObject({
      name: "DownloadError",
      status: 401,
    })
  })

  it("throws DownloadError(404) on a 404 (non-owner / expired / missing — collapsed)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const err = await downloadWorkspaceFile(THREAD, FILE, "f.docx").catch((e) => e)
    expect(err).toBeInstanceOf(DownloadError)
    expect((err as DownloadError).status).toBe(404)
  })

  it("throws DownloadError(401) when there is no auth session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    vi.stubGlobal("fetch", vi.fn())
    await expect(downloadWorkspaceFile(THREAD, FILE, "f.docx")).rejects.toMatchObject({
      name: "DownloadError",
      status: 401,
    })
  })
})

// ── SSE wire-byte helper (port of phaseHooks.test.tsx) ────────────────────────
function mockSseFetch(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  const body = {
    getReader() {
      return {
        async read() {
          const next = queue.shift()
          if (next === undefined) return { done: true, value: undefined }
          return { done: false, value: next }
        },
      }
    },
  }
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, body })
}

describe("phase_substep demux branch (gap 6 — onPhaseSubstep callback)", () => {
  function baseCallbacks(overrides: Partial<StreamCallbacks> = {}): StreamCallbacks {
    return {
      onTerminal: () => {},
      ...overrides,
    }
  }

  it("a phase_substep with a status invokes onPhaseSubstep with {phase, phaseIndex, status}", async () => {
    const onPhaseSubstep = vi.fn()
    const onCursor = vi.fn()
    const cbs = baseCallbacks({ onPhaseSubstep, onCursor })
    const wire =
      'id: 5-0\ndata: {"type":"phase_substep","phase":"fill","phase_index":1,"status":"validating"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await subscribeToRun("run-1", "0", cbs)
    expect(onPhaseSubstep).toHaveBeenCalledWith({
      phase: "fill",
      phaseIndex: 1,
      status: "validating",
      failure: undefined,
    })
    // No return on the branch → the cursor still advanced for that event.
    expect(onCursor).toHaveBeenCalledWith("5-0")
  })

  it("a phase_substep with a failure invokes onPhaseSubstep with the failure field", async () => {
    const onPhaseSubstep = vi.fn()
    const cbs = baseCallbacks({ onPhaseSubstep })
    const wire =
      'data: {"type":"phase_substep","phase":"fill","phase_index":1,"failure":"citation_gate_rejected"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await subscribeToRun("run-2", "0", cbs)
    expect(onPhaseSubstep).toHaveBeenCalledWith({
      phase: "fill",
      phaseIndex: 1,
      status: undefined,
      failure: "citation_gate_rejected",
    })
  })
})
