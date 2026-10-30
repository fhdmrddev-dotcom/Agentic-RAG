/**
 * Phase 293-04 (D-17, D-19) — the API key wire types match the backend's contract fixture.
 *
 * `backend/tests/unit/test_293_api_keys_routes.py` asserts the live route payloads carry exactly
 * the keys in `api_keys_contract.json`; this suite reads the SAME file, so a field renamed on
 * either side fails one of the two (the 289 `runEvidence.contract.test.ts` shape).
 *
 * Two layers: `SAMPLE_*` is declared with `satisfies`, so `tsc -p tsconfig.app.json` rejects a
 * missing or an extra field; and at run time every key path of the sample must equal the
 * fixture's, so the TYPE is compared with the CONTRACT, never with itself.
 *
 * A failure means the frontend departed from the contract: fix the type, never the fixture.
 */
import { describe, expect, it } from "vitest"
import contractRaw from "../../../../../../backend/tests/fixtures/phase293/api_keys_contract.json?raw"
import type {
  ApiKeyCreated,
  ApiKeyList,
  ApiKeyRead,
  OrgMcpAccess,
  PickableFolderList,
} from "@/lib/api/apiKeys"

const contract = JSON.parse(contractRaw) as {
  ApiKeyList: unknown
  ApiKeyCreated: unknown
  McpApiKeyCreated: unknown
  PickableFolderList: unknown
  OrgMcpAccess: unknown
}

/** Every key path in `value`, arrays read through their first element (`keys[].label`). */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.length > 0 ? keyPaths(value[0], `${prefix}[]`) : []
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
      const here = prefix ? `${prefix}.${k}` : k
      return [here, ...keyPaths(v, here)]
    })
  }
  return []
}

const KEY = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  label: "n8n-prod",
  key_prefix: "srl_live_Ab3d",
  workflows: [{ id: "55555555-5555-4555-8555-555555555555", name: "Contract review", state: "startable" }],
  state: "active",
  expires_at: "2027-01-23T10:00:00Z",
  revoked_at: null,
  revoked_by_name: null,
  revoked_by_admin: false,
  last_used_at: "2026-10-25T09:12:00Z",
  created_at: "2026-10-25T09:00:00Z",
  owner_name: "Dana Kim",
  owner_is_you: true,
  calls: [
    {
      at: "2026-10-25T09:12:00Z",
      verb: "start",
      workflow_id: "55555555-5555-4555-8555-555555555555",
      workflow_name: "Contract review",
      run_id: "77777777-7777-4777-8777-777777777777",
      ok: true,
      outcome: "started",
      reason: null,
      detail: null,
    },
  ],
  // Phase 304 — a workflow key's MCP fields.
  kind: "workflow",
  tools: null,
  folders: null,
  include_external: false,
  org_name: null,
  mcp_off: null,
} satisfies ApiKeyRead

const SAMPLE_LIST = {
  keys: [KEY],
  limits: { starts_per_minute: 10, reads_per_minute: 120 },
  mcp: {
    available: true,
    off: null,
    url: "https://syrel.example.com/mcp",
    tools: [{ name: "search_knowledge_base", group: "read", label: "Search your knowledge base", travels_with: null }],
  },
} satisfies ApiKeyList

const SAMPLE_CREATED = {
  key: { ...KEY, last_used_at: null, owner_name: null, calls: [] },
  secret: "srl_live_EXAMPLEnotARealKey0000000000000000000000000",
} satisfies ApiKeyCreated

// Phase 304: an MCP key, its folders named by the server (keyPaths reads arrays through their
// first element, so `folders[].id` is pinned here and nowhere else).
const SAMPLE_MCP_CREATED = {
  key: {
    ...KEY,
    key_prefix: "srl_mcp_Xy9z",
    workflows: [],
    last_used_at: null,
    owner_name: null,
    calls: [],
    kind: "mcp",
    tools: ["search_knowledge_base", "list_documents", "read_document"],
    folders: [{ id: "f0000000-0000-4000-8000-000000000001", name: "Contracts" }],
    org_name: "Acme Legal",
  },
  secret: "srl_mcp_EXAMPLEnotARealKey00000000000000000000000000",
} satisfies ApiKeyCreated

const SAMPLE_FOLDERS = {
  folders: [{ id: "f0000000-0000-4000-8000-000000000001", name: "Contracts", parent_id: null, shared: false, source: null }],
} satisfies PickableFolderList

const SAMPLE_ORG_ACCESS = { enabled: true } satisfies OrgMcpAccess

describe("293-04 api key wire types vs the backend contract fixture", () => {
  it("ApiKeyList: every fixture key path exists on the typed sample, and no extra one does", () => {
    expect(new Set(keyPaths(SAMPLE_LIST))).toEqual(new Set(keyPaths(contract.ApiKeyList)))
  })

  it("ApiKeyCreated: the same, including the one `secret` field", () => {
    // The fixture's created key has an empty `calls` array, so its call paths come from the list.
    expect(new Set(keyPaths(SAMPLE_CREATED))).toEqual(new Set(keyPaths(contract.ApiKeyCreated)))
    expect(keyPaths(contract.ApiKeyCreated)).toContain("secret")
  })

  it("304: an MCP key's created payload, the pickable folders and the org switch", () => {
    expect(new Set(keyPaths(SAMPLE_MCP_CREATED))).toEqual(new Set(keyPaths(contract.McpApiKeyCreated)))
    expect(new Set(keyPaths(SAMPLE_FOLDERS))).toEqual(new Set(keyPaths(contract.PickableFolderList)))
    expect(new Set(keyPaths(SAMPLE_ORG_ACCESS))).toEqual(new Set(keyPaths(contract.OrgMcpAccess)))
  })

  it("no list path carries a secret or a digest (the secret lives in one response only)", () => {
    const paths = keyPaths(contract.ApiKeyList)
    expect(paths.some((p) => /secret|hash/i.test(p))).toBe(false)
  })
})
