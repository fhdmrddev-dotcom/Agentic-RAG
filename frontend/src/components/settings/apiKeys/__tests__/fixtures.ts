/**
 * Phase 293-04 — shared builders for the API key component suites (not a suite itself).
 * Local-time constructors, because every card formats in the viewer's zone.
 */
import type { ApiKeyCall, ApiKeyRead, StartableWorkflow } from "@/lib/api/apiKeys"

export const NOW = new Date(2026, 9, 25, 12, 0)
export const iso = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m, d, h, min).toISOString()

export function makeKey(over: Partial<ApiKeyRead> = {}): ApiKeyRead {
  return {
    id: "k1",
    label: "n8n-prod",
    key_prefix: "srl_live_Ab3d",
    workflows: [{ id: "w1", name: "Contract review", state: "startable" }],
    state: "active",
    expires_at: iso(2027, 0, 22),
    revoked_at: null,
    revoked_by_name: null,
    revoked_by_admin: false,
    last_used_at: iso(2026, 9, 25, 10, 42),
    created_at: iso(2026, 9, 1),
    owner_name: "Dana Kim",
    owner_is_you: true,
    calls: [],
    ...over,
  }
}

export function makeCall(over: Partial<ApiKeyCall> = {}): ApiKeyCall {
  return {
    at: iso(2026, 9, 25, 10, 42),
    verb: "start",
    workflow_id: "w1",
    workflow_name: "Contract review",
    run_id: "7f3a91c2-0000-4000-8000-000000000000",
    ok: true,
    outcome: "started",
    reason: null,
    detail: null,
    ...over,
  }
}

export function makeStartable(over: Partial<StartableWorkflow> = {}): StartableWorkflow {
  return {
    id: "w1",
    name: "Contract review",
    fields: [
      { key: "counterparty", label: "Counterparty", required: true },
      { key: "due_date", label: "Due date", required: false },
    ],
    startable: true,
    reason: null,
    ...over,
  }
}
