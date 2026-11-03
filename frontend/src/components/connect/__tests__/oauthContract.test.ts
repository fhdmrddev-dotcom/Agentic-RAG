/**
 * Phase 307-03 (OAUTH-04) — the consent wire types match the backend route that builds them.
 *
 * `backend/app/api/oauth_consent.py` builds its responses as literal dicts, so the field names are in
 * its source. Each `SAMPLE_*` below is declared with `satisfies`, so `tsc -p tsconfig.app.json`
 * rejects a missing or extra field; at run time every field name of every sample must appear as a
 * quoted key in the Python source. A renamed field on either side fails here, not on a screen.
 *
 * The client calls are pinned too: the request id is URL-encoded, Allow and Deny are POSTs, and the
 * folder read for a PICKED org sends that org as `X-Org-Id` explicitly (P-6), never the active one.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import routeSource from "../../../../../backend/app/api/oauth_consent.py?raw"
import modelsSource from "../../../../../backend/app/models/api_key.py?raw"

vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer t", "X-Org-Id": "active-org" }),
  }
})

import {
  approveConsent,
  denyConsent,
  disconnectApp,
  disconnectOrgApp,
  getConsentRequest,
  listFoldersForOrg,
  listMyConnectedApps,
  listOrgConnectedApps,
  revokeAllConnectedApps,
  type ConnectedApp,
  type ConsentApproveBody,
  type ConsentRedirect,
  type ConsentRequest,
  type OrgConnectedApp,
  type RevokeAllResult,
} from "@/lib/api/oauth"
import type { McpAvailability } from "@/lib/api/apiKeys"
import { ApiError } from "@/lib/api/_core"

const SAMPLE_READY = {
  status: "ready",
  client: {
    name: "Claude",
    name_source: "dcr",
    published_host: null,
    redirect_host: "claude.ai",
    redirect_kind: "web",
    host_seeded: true,
  },
  account: { email: "dana@acme.example" },
  orgs: [{ id: "o", name: "Acme", mcp_off: null, active: true }],
  tools: [{ name: "search_knowledge_base", group: "read", label: "Search", travels_with: null }],
} satisfies ConsentRequest

const SAMPLE_REFUSED = { status: "refused", reason: "host_not_allowed", host: "evil.example" } satisfies ConsentRequest
const SAMPLE_OFF = { status: "deployment_off", host: "claude.ai" } satisfies ConsentRequest
const SAMPLE_EXPIRED = { status: "expired" } satisfies ConsentRequest
const SAMPLE_APPROVE = {
  org_id: "o",
  tools: ["search_knowledge_base"],
  folder_ids: null,
  include_external: false,
} satisfies ConsentApproveBody
const SAMPLE_REDIRECT = { redirect_url: "https://claude.ai/cb?code=x" } satisfies ConsentRedirect

// 307-05 (D-25 / D-26): the connected-app wire types, pinned against the Pydantic models.
const SAMPLE_APP = {
  id: "g1",
  client_name: "Claude",
  name_source: "dcr",
  redirect_host: "claude.ai",
  redirect_kind: "web",
  org_id: "o1",
  org_name: "Acme",
  tools: ["search_knowledge_base"],
  folders: null,
  include_external: false,
  created_at: "2026-11-01T10:00:00Z",
  last_used_at: null,
  expires_at: "2027-01-30T10:00:00Z",
  mcp_off: null,
} satisfies ConnectedApp
const SAMPLE_ORG_APP = { ...SAMPLE_APP, owner_name: "Lee Park", owner_is_you: false } satisfies OrgConnectedApp
const SAMPLE_REVOKE_ALL = { revoked: 2, members: 1 } satisfies RevokeAllResult

/** The field names of one Pydantic class in models/api_key.py (CRLF-tolerant). */
function modelFields(name: string): string[] {
  const body = modelsSource.match(new RegExp(`class ${name}\\([A-Za-z]+\\):([\\s\\S]*?)(?:\\r?\\n\\r?\\n\\r?\\n|$)`))?.[1] ?? ""
  return [...body.matchAll(/^\s{4}([a-z_]+):\s/gm)].map((m) => m[1])
}

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.length ? keysOf(value[0]) : []
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [k, ...keysOf(v)])
  }
  return []
}

describe("307-03 consent wire contract", () => {
  it("every response field the client reads is a quoted key in oauth_consent.py", () => {
    const keys = new Set(
      [SAMPLE_READY, SAMPLE_REFUSED, SAMPLE_OFF, SAMPLE_EXPIRED, SAMPLE_REDIRECT].flatMap(keysOf),
    )
    expect(keys.size).toBeGreaterThanOrEqual(20)
    for (const k of keys) expect(routeSource, k).toContain(`"${k}"`)
  })

  it("every approve body field is a field of the Pydantic body, and no other field exists", () => {
    // CRLF-tolerant: a Windows checkout (autocrlf) carries \r before every \n.
    const model = routeSource.match(/class ConsentApprove\(BaseModel\):([\s\S]*?)\r?\n\r?\n\r?\n/)?.[1] ?? ""
    expect(model).toContain('extra="forbid"')
    const fields = [...model.matchAll(/^\s{4}([a-z_]+):\s/gm)].map((m) => m[1])
    expect(fields.sort()).toEqual(Object.keys(SAMPLE_APPROVE).sort())
  })

  it("the status and reason unions are exactly the ones the route can send", () => {
    for (const s of ["ready", "expired", "refused", "deployment_off"]) expect(routeSource).toContain(`"${s}"`)
  })
})

describe("307-05 connected-apps wire contract", () => {
  it("ConnectedApp, OrgConnectedApp and RevokeAllResult equal the backend models field for field", () => {
    expect(modelFields("ConnectedApp").sort()).toEqual(Object.keys(SAMPLE_APP).sort())
    expect([...modelFields("ConnectedApp"), ...modelFields("OrgConnectedApp")].sort()).toEqual(
      Object.keys(SAMPLE_ORG_APP).sort(),
    )
    expect(modelFields("RevokeAllResult").sort()).toEqual(Object.keys(SAMPLE_REVOKE_ALL).sort())
  })

  it("McpAvailability.oauth exists on both sides (D-15)", () => {
    expect(modelFields("McpAvailability")).toContain("oauth")
    const sample = { available: true, off: null, url: null, tools: [], oauth: true } satisfies McpAvailability
    expect(Object.keys(sample).sort()).toEqual(modelFields("McpAvailability").sort())
  })
})

describe("307-03 consent client calls", () => {
  const fetchMock = vi.fn()
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
  const fail = (status: number, body: unknown) => ({ ok: false, status, json: async () => body }) as Response

  it("getConsentRequest reads the encoded id", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(ok(SAMPLE_EXPIRED)))
    expect(await getConsentRequest("a/b")).toEqual(SAMPLE_EXPIRED)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/oauth\/requests\/a%2Fb$/)
  })

  it("approve and deny POST and return the redirect; a refusal throws the server sentence", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValueOnce(ok(SAMPLE_REDIRECT)))
    expect(await approveConsent("r1", SAMPLE_APPROVE)).toEqual(SAMPLE_REDIRECT)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/oauth\/requests\/r1\/approve$/)
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual(SAMPLE_APPROVE)

    fetchMock.mockResolvedValueOnce(ok(SAMPLE_REDIRECT))
    expect(await denyConsent("r1")).toEqual(SAMPLE_REDIRECT)
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/oauth\/requests\/r1\/deny$/)
    expect(fetchMock.mock.calls[1][1].method).toBe("POST")

    fetchMock.mockResolvedValueOnce(fail(403, { detail: "MCP access is switched off for this organisation by an admin." }))
    const err = await approveConsent("r1", SAMPLE_APPROVE).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(err.message).toBe("MCP access is switched off for this organisation by an admin.")

    fetchMock.mockResolvedValueOnce(
      fail(422, { detail: [{ msg: "Value error, Tick at least one folder, or choose All folders I can see." }] }),
    )
    const err2 = await approveConsent("r1", SAMPLE_APPROVE).catch((e) => e)
    expect(err2.message).toBe("Tick at least one folder, or choose All folders I can see.")
  })

  it("listMyConnectedApps reads /api-keys/connected-apps", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(ok({ apps: [SAMPLE_APP] })))
    expect(await listMyConnectedApps()).toEqual({ apps: [SAMPLE_APP] })
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api-keys\/connected-apps$/)
  })

  it("disconnectApp POSTs the EXISTING revoke route with the GRANT's org as X-Org-Id (D-27)", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(ok({})))
    await disconnectApp({ ...SAMPLE_APP, id: "g/1", org_id: "grant-org" })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api-keys\/g%2F1\/revoke$/)
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["X-Org-Id"]).toBe("grant-org")
    fetchMock.mockResolvedValueOnce(fail(404, { detail: "API key not found." }))
    const err = await disconnectApp(SAMPLE_APP).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe("API key not found.")
  })

  it("the org admin's reads and writes use the org routes (active org)", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(ok({ apps: [] })))
    await listOrgConnectedApps()
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/org\/api-keys\/connected-apps$/)
    fetchMock.mockResolvedValueOnce(ok({}))
    await disconnectOrgApp("g1")
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/org\/api-keys\/g1\/revoke$/)
    expect(fetchMock.mock.calls[1][1].method).toBe("POST")
    fetchMock.mockResolvedValueOnce(ok(SAMPLE_REVOKE_ALL))
    expect(await revokeAllConnectedApps()).toEqual(SAMPLE_REVOKE_ALL)
    expect(String(fetchMock.mock.calls[2][0])).toMatch(/\/org\/api-keys\/connected-apps\/revoke-all$/)
    expect(fetchMock.mock.calls[2][1].method).toBe("POST")
  })

  it("listFoldersForOrg sends the PICKED org as X-Org-Id, never the active one (P-6)", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(ok({ folders: [] })))
    expect(await listFoldersForOrg("picked-org")).toEqual({ folders: [] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api-keys\/folders$/)
    expect((init.headers as Record<string, string>)["X-Org-Id"]).toBe("picked-org")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t")
  })
})
