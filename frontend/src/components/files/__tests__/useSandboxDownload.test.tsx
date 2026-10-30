/**
 * Phase 302 plan 01 (FIX-01, UI-D5) — the ONE home of sandbox-output download behaviour.
 *
 * The chat's OutputFileCard and the panel's generated rows both call this hook, so the
 * URL resolution, the error words, the 3 s clear and the in-flight guard can never drift
 * between the two surfaces. Each case below asserts exact strings, not presence.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { MouseEvent } from "react"

class FakeDownloadError extends Error {
  readonly status: number | "network"
  constructor(status: number | "network", message: string) {
    super(message)
    this.status = status
    this.name = "DownloadError"
  }
}

const downloadSandboxOutput = vi.fn()
vi.mock("@/lib/api", () => ({
  downloadSandboxOutput: (...a: unknown[]) => downloadSandboxOutput(...a),
  DownloadError: FakeDownloadError,
}))

// eslint-disable-next-line import/first
import { resolveOutputUrl, useSandboxDownload } from "@/components/files/useSandboxDownload"

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""

function clickEvent() {
  const preventDefault = vi.fn()
  return { e: { preventDefault } as unknown as MouseEvent<HTMLAnchorElement>, preventDefault }
}

describe("resolveOutputUrl (D-067.2-03, lifted at 302-01)", () => {
  it("prefixes a relative /sandbox-outputs path with VITE_API_BASE_URL", () => {
    expect(resolveOutputUrl("/sandbox-outputs/u/e/c1.png")).toBe(`${API_BASE}/sandbox-outputs/u/e/c1.png`)
  })

  it("passes an absolute legacy URL through unchanged", () => {
    expect(resolveOutputUrl("https://x/y")).toBe("https://x/y")
  })
})

describe("useSandboxDownload (UI-D5 — chat and panel download through one hook)", () => {
  beforeEach(() => {
    downloadSandboxOutput.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("href is the resolved URL when a url is given, undefined when it is not", () => {
    const live = renderHook(() => useSandboxDownload("/sandbox-outputs/u/e/c1.png", "c1.png"))
    expect(live.result.current.href).toBe(`${API_BASE}/sandbox-outputs/u/e/c1.png`)
    const dead = renderHook(() => useSandboxDownload(undefined, "x"))
    expect(dead.result.current.href).toBeUndefined()
    expect(dead.result.current.downloading).toBe(false)
    expect(dead.result.current.errorText).toBeNull()
  })

  it("onClick prevents default, calls downloadSandboxOutput once, and ignores a second click while pending", async () => {
    let resolve!: () => void
    downloadSandboxOutput.mockImplementation(() => new Promise<void>((r) => { resolve = r }))
    const { result } = renderHook(() => useSandboxDownload("/sandbox-outputs/u/e/c1.png", "c1.png"))
    const first = clickEvent()
    act(() => { void result.current.onClick(first.e) })
    expect(first.preventDefault).toHaveBeenCalledTimes(1)
    expect(downloadSandboxOutput).toHaveBeenCalledTimes(1)
    expect(downloadSandboxOutput).toHaveBeenCalledWith("/sandbox-outputs/u/e/c1.png", "c1.png")
    expect(result.current.downloading).toBe(true)

    const second = clickEvent()
    act(() => { void result.current.onClick(second.e) })
    expect(second.preventDefault).toHaveBeenCalledTimes(1)
    expect(downloadSandboxOutput).toHaveBeenCalledTimes(1)

    await act(async () => { resolve() })
    expect(result.current.downloading).toBe(false)
    expect(result.current.errorText).toBeNull()
  })

  it("a DownloadError shows its own message, then clears after 3000 ms", async () => {
    vi.useFakeTimers()
    downloadSandboxOutput.mockRejectedValue(new FakeDownloadError(404, "File not found."))
    const { result } = renderHook(() => useSandboxDownload("/sandbox-outputs/u/e/c1.png", "c1.png"))
    await act(async () => { await result.current.onClick(clickEvent().e) })
    expect(result.current.errorText).toBe("File not found.")
    expect(result.current.downloading).toBe(false)
    act(() => { vi.advanceTimersByTime(2999) })
    expect(result.current.errorText).toBe("File not found.")
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.errorText).toBeNull()
  })

  it("any other rejection shows the generic sentence", async () => {
    vi.useFakeTimers()
    downloadSandboxOutput.mockRejectedValue(new TypeError("boom"))
    const { result } = renderHook(() => useSandboxDownload("/sandbox-outputs/u/e/c1.png", "c1.png"))
    await act(async () => { await result.current.onClick(clickEvent().e) })
    expect(result.current.errorText).toBe("Download failed — try again.")
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.errorText).toBeNull()
  })
})
