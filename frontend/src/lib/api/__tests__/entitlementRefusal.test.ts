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
import { createWorkflowDraft, generateWorkflow, publishWorkflow, updateWorkflowDraft } from "../workflows"
import { triggerSchedule } from "../schedules"
import { createThread, handoffThread, postMessage, setThreadActiveExpert } from "../threads"
import { ApiError } from "../_core"

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
  // UAT-265-258-b: the draft PATCH and /generate refused but did not name the plan.
  it("draft update (PATCH)", async () => {
    reply403()
    await expect(updateWorkflowDraft("wf-1", {} as never)).rejects.toThrow("It is part of the Enterprise plan.")
  })
  it("generate", async () => {
    reply403()
    await expect(generateWorkflow({} as never)).rejects.toThrow("It is part of the Enterprise plan.")
  })
  // UAT-265-258-c: schedule create / patch / run-now share readScheduleFailure.
  it("schedule run-now", async () => {
    reply403()
    await expect(triggerSchedule("sch-1")).rejects.toThrow("It is part of the Enterprise plan.")
  })
})

// ── Phase 267 plan 04 (D-267-24 · SEED-309 R265-audit-fixes-06, D-267-21, D-267-14) ─────────────
//
// ⛔ THE CHAT-SEND CASE IS THE ONE THE 265 REVIEW FOUND MISSING: `entitlementRefusalMessage(body) ??`
// → `null ??` in `threads.ts` left this file GREEN ("Tests 4 passed"). It was driven RED against
// that exact plant before it was trusted, and the plant was reverted (267-04-SUMMARY.md).
// The thread writes this phase adds (create with an Expert, the Expert PATCH, the handoff) adopt
// the same refusal-preserving shape, so the server's sentence reaches the person on every one.

const PRO_REFUSAL = {
  detail: { error: "entitlement_required", capability: "workflows", required_tier: "pro" },
}

describe("thread surfaces carry the server's sentence (267-04)", () => {
  beforeEach(() => vi.restoreAllMocks())
  const reply = (status: number, body: unknown) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    )

  it("chat send names the plan, with status 403 (R265-audit-fixes-06)", async () => {
    reply(403, PRO_REFUSAL)
    const err = await postMessage("t-1", "hello").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe("Your plan doesn't include workflows. It is part of the Pro plan.")
    expect((err as ApiError).status).toBe(403)
  })

  it("the Expert PATCH keeps the server's string detail and its status", async () => {
    reply(403, { detail: "Choose an organization before inviting an Expert." })
    const err = await setThreadActiveExpert("t-1", "e-1").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe("Choose an organization before inviting an Expert.")
    expect((err as ApiError).status).toBe(403)
  })

  it("the Expert PATCH names the plan on a tier refusal", async () => {
    reply(403, PRO_REFUSAL)
    await expect(setThreadActiveExpert("t-1", "e-1")).rejects.toThrow("It is part of the Pro plan.")
  })

  it("createThread carries active_expert_id only when given (D-267-21)", async () => {
    const spy = reply(201, { id: "t-new", title: "New Chat" })
    await createThread("New Chat", "f-1", "e-1")
    const body = JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body))
    expect(body).toEqual({ title: "New Chat", folder_id: "f-1", active_expert_id: "e-1" })
    spy.mockClear()
    spy.mockResolvedValue(
      new Response(JSON.stringify({ id: "t-2" }), { status: 201, headers: { "Content-Type": "application/json" } }),
    )
    await createThread("New Chat", null)
    const plain = JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body))
    expect(plain).toEqual({ title: "New Chat" })
  })

  it("createThread's refusal keeps the server's sentence", async () => {
    reply(403, { detail: "You don't have access to this Expert." })
    await expect(createThread("New Chat", null, "e-1")).rejects.toThrow("You don't have access to this Expert.")
  })

  it("handoffThread is ONE POST with the Expert and the model; its refusal keeps the sentence (D-267-14)", async () => {
    const spy = reply(201, { id: "t-b", title: "Contract Reviewer · Q3" })
    const t = await handoffThread("t-1", "e-cr", { model: "gpt-5.4", provider: "openai" })
    expect(t.id).toBe("t-b")
    expect(spy).toHaveBeenCalledTimes(1)
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/threads\/t-1\/handoff$/)
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toEqual({ expert_id: "e-cr", model: "gpt-5.4", provider: "openai" })
    spy.mockResolvedValue(
      new Response(JSON.stringify({ detail: "This chat could not be summarised." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await expect(handoffThread("t-1", "e-cr")).rejects.toThrow("This chat could not be summarised.")
  })
})
