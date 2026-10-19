/**
 * Phase 289-04 Task 1 (SC#3 / T-289-21) — `/app?run=<uuid>` is the run page's shareable
 * address. The value is attacker-controllable (it arrives in a shared link), so the reader
 * accepts a strict UUID and nothing else; the server still decides access.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { clearRunDeepLink, readRunDeepLink, writeRunDeepLink } from "./runDeepLink"

const UUID = "4f1c9a2e-1111-4222-8333-444455556666"

function setUrl(path: string) {
  window.history.replaceState(null, "", path)
}

afterEach(() => {
  // Unstub FIRST: the no-window case replaces `window`, and resetting the address needs it.
  vi.unstubAllGlobals()
  setUrl("/")
})

describe("readRunDeepLink", () => {
  it("returns a valid uuid, lowercased", () => {
    setUrl(`/app?run=${UUID.toUpperCase()}`)
    expect(readRunDeepLink()).toBe(UUID)
  })

  it.each([
    ["missing", "/app"],
    ["empty", "/app?run="],
    ["not a uuid", "/app?run=run-1"],
    ["a path", "/app?run=../x"],
    ["a uuid with a tail", `/app?run=${UUID}x`],
    ["an encoded script", "/app?run=%3Cscript%3E"],
  ])("returns null when the value is %s", (_label, path) => {
    setUrl(path)
    expect(readRunDeepLink()).toBeNull()
  })

  it("never throws when there is no window", () => {
    vi.stubGlobal("window", undefined)
    expect(() => readRunDeepLink()).not.toThrow()
    expect(readRunDeepLink()).toBeNull()
  })
})

describe("writeRunDeepLink / clearRunDeepLink", () => {
  it("sets ?run= with replaceState, keeping the path and other params", () => {
    setUrl("/app?tab=files#top")
    const before = window.history.length
    writeRunDeepLink(UUID)
    expect(window.location.pathname).toBe("/app")
    const q = new URLSearchParams(window.location.search)
    expect(q.get("run")).toBe(UUID)
    expect(q.get("tab")).toBe("files")
    expect(window.location.hash).toBe("#top")
    expect(window.history.length).toBe(before)
  })

  it("writes nothing for a value that is not a uuid", () => {
    setUrl("/app?tab=files")
    writeRunDeepLink("run-1")
    expect(window.location.search).toBe("?tab=files")
  })

  it("removes only the run param", () => {
    setUrl(`/app?run=${UUID}&tab=files`)
    clearRunDeepLink()
    expect(window.location.pathname).toBe("/app")
    expect(window.location.search).toBe("?tab=files")
  })

  it("leaves the address alone when there is no run param", () => {
    setUrl("/app?tab=files")
    const spy = vi.spyOn(window.history, "replaceState")
    clearRunDeepLink()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
