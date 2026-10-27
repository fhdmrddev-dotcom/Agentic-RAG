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
import type { ApiKeyCreated, ApiKeyList, ApiKeyRead } from "@/lib/api/apiKeys"

const contract = JSON.parse(contractRaw) as { ApiKeyList: unknown; ApiKeyCreated: unknown }

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
} satisfies ApiKeyRead

const SAMPLE_LIST = {
  keys: [KEY],
  limits: { starts_per_minute: 10, reads_per_minute: 120 },
} satisfies ApiKeyList

const SAMPLE_CREATED = {
  key: { ...KEY, last_used_at: null, owner_name: null, calls: [] },
  secret: "srl_live_EXAMPLEnotARealKey0000000000000000000000000",
} satisfies ApiKeyCreated

describe("293-04 api key wire types vs the backend contract fixture", () => {
  it("ApiKeyList: every fixture key path exists on the typed sample, and no extra one does", () => {
    expect(new Set(keyPaths(SAMPLE_LIST))).toEqual(new Set(keyPaths(contract.ApiKeyList)))
  })

  it("ApiKeyCreated: the same, including the one `secret` field", () => {
    // The fixture's created key has an empty `calls` array, so its call paths come from the list.
    expect(new Set(keyPaths(SAMPLE_CREATED))).toEqual(new Set(keyPaths(contract.ApiKeyCreated)))
    expect(keyPaths(contract.ApiKeyCreated)).toContain("secret")
  })

  it("no list path carries a secret or a digest (the secret lives in one response only)", () => {
    const paths = keyPaths(contract.ApiKeyList)
    expect(paths.some((p) => /secret|hash/i.test(p))).toBe(false)
  })
})
