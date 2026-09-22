/**
 * v4.3 audit (TIER-03) — a tier refusal must NAME the plan on every workflow surface.
 *
 * The backend's EntitlementDeniedException answers a structured 403; chat send, draft create
 * and publish each threw a generic "Failed … (status 403)" over it, so the person never learned
 * which plan would allow the action. `entitlementRefusalMessage` is the one reader.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../supabase", () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 3600 } } }),
    refreshSession: async () => ({ data: { session: null } }),
  } },
}))

import { entitlementRefusalMessage } from "../_core"
import { createWorkflowDraft, publishWorkflow } from "../workflows"

const REFUSAL = {
  detail: {
    detail: "Capability 'workflows' requires 'enterprise' tier (current tier: 'standard')",
    error: "entitlement_required",
    capability: "workflows",
    required_tier: "enterprise",
    current_tier: "standard",
    upgrade_hint: "Upgrade to Enterprise to use workflows.",
  },
}

describe("entitlementRefusalMessage", () => {
  it("names the capability and the plan that allows it", () => {
    expect(entitlementRefusalMessage(REFUSAL)).toBe(
      "Your plan doesn't include workflows. It is part of the Enterprise plan.",
    )
  })
  it("returns null for anything that is not a tier refusal", () => {
    expect(entitlementRefusalMessage({ detail: "Workflow not found" })).toBeNull()
    expect(entitlementRefusalMessage(null)).toBeNull()
    expect(entitlementRefusalMessage({ detail: { error: "other" } })).toBeNull()
  })
})

describe("workflow surfaces carry the plan, not a status code", () => {
  beforeEach(() => vi.restoreAllMocks())
  const reply403 = () =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(REFUSAL), { status: 403, headers: { "Content-Type": "application/json" } }),
    )

  it("draft create", async () => {
    reply403()
    await expect(createWorkflowDraft({} as never)).rejects.toThrow("It is part of the Enterprise plan.")
  })
  it("publish", async () => {
    reply403()
    await expect(publishWorkflow("wf-1", "golden input")).rejects.toThrow("It is part of the Enterprise plan.")
  })
})
