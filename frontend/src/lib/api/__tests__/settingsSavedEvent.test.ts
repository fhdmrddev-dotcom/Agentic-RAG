/**
 * 294 UAT C5 follow-up — a saved Settings change must reach the chat's citation-check line.
 *
 * Switching the rerank engine (or turning reranking off) in Settings left the chat offering
 * "Check citations · Jev" until a full reload: the citation store asks the server for availability
 * only for message ids it has not asked about yet. `updateSettings` now announces a successful save
 * with `agentic:settings-saved`, and the store forgets what it knew, so the next thread view asks again.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../supabase", () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 3600 } } }),
    refreshSession: async () => ({ data: { session: null } }),
  } },
}))

import { updateSettings } from "../settings"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("updateSettings announces a successful save", () => {
  it("dispatches agentic:settings-saved after a 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rerank_provider: "local" }), { status: 200 })))
    const heard = vi.fn()
    window.addEventListener("agentic:settings-saved", heard)
    await updateSettings({ rerank_provider: "local" } as never)
    window.removeEventListener("agentic:settings-saved", heard)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it("stays silent when the save is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "no" }), { status: 400 })))
    const heard = vi.fn()
    window.addEventListener("agentic:settings-saved", heard)
    await expect(updateSettings({ rerank_provider: "nope" } as never)).rejects.toThrow("no")
    window.removeEventListener("agentic:settings-saved", heard)
    expect(heard).not.toHaveBeenCalled()
  })
})
