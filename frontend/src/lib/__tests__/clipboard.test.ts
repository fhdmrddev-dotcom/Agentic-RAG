/**
 * Phase 299-03 (D-21 / UI-D7) — the clipboard leaf the can't-be-opened card and the link surface
 * (299-04) share. Extracted from FilePreview's copy idiom: the failure arm is NOT optional, because
 * a control that silently no-ops tells the person they hold text they do not hold.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { copyText, copyShortcutWord, selectAllIn } from "../clipboard"
import clipboardSource from "../clipboard.ts?raw"

function stubClipboard(writeText: ((t: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText === undefined ? undefined : { writeText },
  })
}

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined })
  vi.restoreAllMocks()
})

describe("copyText — copied or refused, never a throw", () => {
  it("resolves 'copied' when the write resolves, with the exact text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    await expect(copyText("host/app/runs/abc")).resolves.toBe("copied")
    expect(writeText).toHaveBeenCalledWith("host/app/runs/abc")
  })

  it("resolves 'refused' when the write rejects (document not focused, permission refused)", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")))
    await expect(copyText("x")).resolves.toBe("refused")
  })

  it("resolves 'refused' when the clipboard API is missing (insecure context)", async () => {
    stubClipboard(undefined)
    await expect(copyText("x")).resolves.toBe("refused")
  })

  it("resolves 'refused' when writeText itself throws synchronously", async () => {
    stubClipboard(() => {
      throw new Error("boom")
    })
    await expect(copyText("x")).resolves.toBe("refused")
  })
})

describe("the fallback: select the text, name the shortcut", () => {
  it("selectAllIn selects exactly the element's text", () => {
    const el = document.createElement("code")
    el.textContent = "example.test/app/chat/1"
    document.body.appendChild(el)
    selectAllIn(el)
    expect(window.getSelection()?.toString()).toBe("example.test/app/chat/1")
    el.remove()
  })

  it("selectAllIn(null) does nothing and does not throw", () => {
    expect(() => selectAllIn(null)).not.toThrow()
  })

  it("copyShortcutWord says Ctrl+C off a Mac and ⌘C on one", () => {
    const platform = vi.spyOn(navigator, "platform", "get")
    platform.mockReturnValue("Win32")
    expect(copyShortcutWord()).toBe("Press Ctrl+C to copy")
    platform.mockReturnValue("MacIntel")
    expect(copyShortcutWord()).toBe("Press ⌘C to copy")
  })

  it("is a leaf: no React import", () => {
    expect(clipboardSource).not.toMatch(/from ["']react["']/)
  })
})
