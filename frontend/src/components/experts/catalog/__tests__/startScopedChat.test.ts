/**
 * Phase 262 plan 04 (PACK-13) — the handoff's ORDER, fenced.
 *
 * ⛔ "EACH MOCK WAS CALLED" IS NOT THE CONTRACT HERE. Five seams called in the wrong order produce
 * a chat that looks scoped and is not, or a history row that silently un-scopes the conversation
 * the next time it is clicked — both of which pass an every-mock-was-called assertion. So every
 * call appends to one shared log and the log itself is asserted.
 *
 * ⛔ AND THE SELECTED THREAD IS IDENTITY-COMPARED. The row the creating call returns and the row
 * the PATCH returns are both Threads with the same id; only one of them carries the Expert. A
 * structural comparison would accept either.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { startScopedChat, type StartScopedChatDeps } from "../startScopedChat"
import type { ExpertBundle, Thread } from "@/types"

const EXPERT = {
  id: "expert-uuid",
  name: "Filing Reconciler",
  slug: "filing-reconciler",
  description: "",
  scope_mode: "biased",
  member_skills: [],
  required_connections: [],
  knowledge_folder_ids: [],
  prompt_suggestions: [],
  visibility: "granted",
  is_system: false,
  is_enabled: true,
} as ExpertBundle

/** What the creating call hands back — `active_expert_id` is null, and that is the whole trap. */
const CREATED = {
  id: "thread-1",
  user_id: "u1",
  title: "New Chat",
  folder_id: null,
  active_expert_id: null,
  created_at: "2026-09-22T00:00:00Z",
  updated_at: "2026-09-22T00:00:00Z",
} as Thread

/** What the PATCH hands back — a DIFFERENT object, carrying the Expert. */
const SCOPED = { ...CREATED, active_expert_id: EXPERT.id } as Thread

let log: string[]

function deps(over: Partial<StartScopedChatDeps> = {}): StartScopedChatDeps {
  return {
    createThread: vi.fn(async () => {
      log.push("createThread")
      return CREATED
    }),
    setExpert: vi.fn(async () => {
      log.push("setExpert")
      return SCOPED
    }),
    refreshThreads: vi.fn(async () => {
      log.push("refreshThreads")
    }),
    selectThread: vi.fn(() => {
      log.push("selectThread")
    }),
    navigate: vi.fn(() => {
      log.push("navigate")
    }),
    ...over,
  }
}

beforeEach(() => {
  log = []
  vi.clearAllMocks()
})

describe("startScopedChat — PACK-13's ordered handoff", () => {
  it("(1) fires its five seams in exactly one order", async () => {
    await startScopedChat(deps(), EXPERT)
    expect(log).toEqual([
      "createThread",
      "setExpert",
      "refreshThreads",
      "selectThread",
      "navigate",
    ])
  })

  it("(2) refreshThreads runs BEFORE selectThread — the list must hold the patched row", async () => {
    await startScopedChat(deps(), EXPERT)
    // Stated as an ordering fact rather than inferred from case (1), because this is the pair a
    // future refactor is most likely to swap: the refetch looks like a cache-warm and is not.
    expect(log.indexOf("refreshThreads")).toBeLessThan(log.indexOf("selectThread"))
    expect(log.indexOf("refreshThreads")).toBeGreaterThan(log.indexOf("setExpert"))
  })

  it("(3) the thread handed to selectThread is the one the PATCH resolved, by identity", async () => {
    const d = deps()
    const result = await startScopedChat(d, EXPERT)

    expect(d.selectThread).toHaveBeenCalledTimes(1)
    expect(vi.mocked(d.selectThread).mock.calls[0][0]).toBe(SCOPED)
    // ⛔ And explicitly NOT the row the creating call returned, whose column is null.
    expect(vi.mocked(d.selectThread).mock.calls[0][0]).not.toBe(CREATED)
    expect(result).toBe(SCOPED)
  })

  it("(4) the PATCH is addressed to the created thread and the chosen Expert", async () => {
    const d = deps()
    await startScopedChat(d, EXPERT)
    expect(d.setExpert).toHaveBeenCalledWith(CREATED.id, EXPERT.id)
  })

  it("(5) a REJECTED patch does not navigate, and the rejection reaches the caller", async () => {
    const boom = new Error("Failed to update thread active expert")
    const d = deps({
      setExpert: vi.fn(async () => {
        log.push("setExpert")
        throw boom
      }),
    })

    await expect(startScopedChat(d, EXPERT)).rejects.toThrow(boom)

    // ⛔ An unscoped chat that LOOKS scoped is the failure this arm exists to prevent.
    expect(d.navigate).not.toHaveBeenCalled()
    expect(d.selectThread).not.toHaveBeenCalled()
    expect(d.refreshThreads).not.toHaveBeenCalled()
    expect(log).toEqual(["createThread", "setExpert"])
  })

  it("(6) a REJECTED creation reaches neither the patch nor the navigation", async () => {
    const boom = new Error("Failed to create thread")
    const d = deps({
      createThread: vi.fn(async () => {
        log.push("createThread")
        throw boom
      }),
    })

    await expect(startScopedChat(d, EXPERT)).rejects.toThrow(boom)

    expect(d.setExpert).not.toHaveBeenCalled()
    expect(d.navigate).not.toHaveBeenCalled()
    expect(log).toEqual(["createThread"])
  })
})

// 262-UAT 3.6, driven with the scoping PATCH refused: the created thread was left behind as an
// empty, unscoped "New Chat" in the person's history.
describe("startScopedChat — a refused patch cleans up the thread it created (262-UAT 3.6)", () => {
  it("(7) discards the created thread, then re-throws the ORIGINAL error", async () => {
    const boom = new Error("Failed to update thread active expert")
    const discardThread = vi.fn(async (id: string) => {
      log.push(`discardThread:${id}`)
    })
    const d = deps({
      setExpert: vi.fn(async () => {
        log.push("setExpert")
        throw boom
      }),
      discardThread,
    })

    await expect(startScopedChat(d, EXPERT)).rejects.toBe(boom)
    expect(log).toEqual(["createThread", "setExpert", "discardThread:thread-1"])
    expect(d.navigate).not.toHaveBeenCalled()
  })

  it("(8) a FAILED discard still surfaces the original error, never the cleanup's", async () => {
    const boom = new Error("patch refused")
    const d = deps({
      setExpert: vi.fn(async () => {
        throw boom
      }),
      discardThread: vi.fn(async () => {
        throw new Error("delete also refused")
      }),
    })
    await expect(startScopedChat(d, EXPERT)).rejects.toBe(boom)
  })
})
