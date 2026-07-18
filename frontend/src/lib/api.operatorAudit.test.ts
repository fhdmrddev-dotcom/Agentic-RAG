/**
 * Phase 146 (ADMIN-01 / CR-01) — getOperatorAudit envelope-unwrap contract.
 *
 * The backend `GET /admin/audit` returns an ENVELOPE `{"entries": [...]}` (admin.py),
 * the same shape as `getAuditLogs`. The client MUST unwrap `.entries` and return the
 * bare row array — casting the raw object to `OperatorAuditRow[]` shipped a `{entries}`
 * object into ControlRoom `auditRows` state, whose next `.slice(...)` threw and
 * unmounted the whole Control Room tree (no error boundary → white screen). These
 * tests pin the unwrap so that regression can never ship silently again.
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

import { getOperatorAudit, type OperatorAuditRow } from "@/lib/api"

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

const ROW: OperatorAuditRow = {
  id: "log-1",
  action: "health.view",
  label: "Viewed system health",
  is_write: false,
  target_type: null,
  target_id: null,
  created_at: "2026-07-11T00:00:00Z",
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

describe("getOperatorAudit — unwraps the {entries:[...]} envelope (CR-01)", () => {
  it("returns the bare row array from the {entries:[...]} envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { entries: [ROW] })))

    const out = await getOperatorAudit(200)

    // The result is a real array (has .slice) — NOT the raw {entries} object that
    // crashed the Control Room. Array.isArray is the load-bearing assertion.
    expect(Array.isArray(out)).toBe(true)
    expect(out).toEqual([ROW])
    expect(out.slice(0, 6)).toEqual([ROW])
  })

  it("returns [] when the envelope carries an empty entries array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { entries: [] })))
    const out = await getOperatorAudit()
    expect(out).toEqual([])
  })

  it("returns [] when entries is absent (defensive, never undefined)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, {})))
    const out = await getOperatorAudit()
    expect(Array.isArray(out)).toBe(true)
    expect(out).toEqual([])
  })

  it("throws an ApiError on a non-ok response (never a silent empty feed)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, { detail: "boom" })))
    await expect(getOperatorAudit()).rejects.toThrow()
  })
})
