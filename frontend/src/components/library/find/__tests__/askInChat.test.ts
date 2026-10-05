/**
 * Phase 271 plan 02 (D-02 / P-08) — the Ask handoff, as an ordered, injected sequence.
 *
 * Ask never answers inside the Library. It leaves: a NEW thread first, the question
 * pre-filled second, the chat surface third — and nothing is ever sent. The shipped
 * `handleTryInChat` creates no thread, which is exactly G-4 #4's failure (the question
 * lands in whatever thread happened to be selected), so this helper exists to make the
 * ORDER a tested property rather than a hope.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { askInChat } from "../askInChat"

function makeDeps(log: string[], opts: { rejectCreate?: boolean } = {}) {
  return {
    createThread: vi.fn(async () => {
      log.push("createThread")
      if (opts.rejectCreate) throw new Error("create failed")
      return { id: "t-new" }
    }),
    setPrefill: vi.fn((text: string) => {
      log.push(`setPrefill:${text}`)
    }),
    navigate: vi.fn(() => {
      log.push("navigate")
    }),
  }
}

describe("askInChat — the ordered Ask handoff (D-02, P-08)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    errorSpy.mockRestore()
  })

  it("creates a NEW thread, THEN sets the prefill, THEN navigates — and resolves true", async () => {
    const log: string[] = []
    const deps = makeDeps(log)
    const ok = await askInChat(deps, "What changed?")
    expect(ok).toBe(true)
    expect(log).toEqual(["createThread", "setPrefill:What changed?", "navigate"])
    expect(deps.createThread).toHaveBeenCalledTimes(1)
    expect(deps.setPrefill).toHaveBeenCalledTimes(1)
    expect(deps.navigate).toHaveBeenCalledTimes(1)
  })

  it("a rejected create sets NO prefill and navigates NOWHERE; logs once; resolves false", async () => {
    const log: string[] = []
    const deps = makeDeps(log, { rejectCreate: true })
    const ok = await askInChat(deps, "What changed?")
    expect(ok).toBe(false)
    expect(log).toEqual(["createThread"])
    expect(deps.setPrefill).not.toHaveBeenCalled()
    expect(deps.navigate).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it("a whitespace-only question calls nothing and resolves false", async () => {
    const log: string[] = []
    const deps = makeDeps(log)
    const ok = await askInChat(deps, "   ")
    expect(ok).toBe(false)
    expect(log).toEqual([])
  })

  it("trims the question before it is pre-filled", async () => {
    const log: string[] = []
    const deps = makeDeps(log)
    await askInChat(deps, "  What changed?  \n")
    expect(deps.setPrefill).toHaveBeenCalledWith("What changed?")
  })

  it("has no `send` seam at all — nothing in the handoff can send a message", async () => {
    const log: string[] = []
    const deps = { ...makeDeps(log), send: vi.fn() }
    await askInChat(deps, "What changed?")
    expect(deps.send).not.toHaveBeenCalled()
  })
})
