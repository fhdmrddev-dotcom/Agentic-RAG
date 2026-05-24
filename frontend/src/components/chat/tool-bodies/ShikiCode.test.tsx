/**
 * Phase 075.9 T5 — ShikiCode WR-01 + WR-02 tests.
 *
 * WR-01: rejected promise singleton no longer poisons subsequent mounts.
 *   Mock `import("shiki")` to throw on first call → assert ShikiCode falls
 *   through to its plain-pre fallback.
 *   Reset state, mock to succeed on second call → assert the next mount
 *   ATTEMPTS the import (singleton is no longer cached as rejected) and
 *   the imported succeed-mock IS invoked.
 *
 * WR-02: the trust-contract JSDoc is documentation — verified by inspection
 *   in the source file. This test file doesn't assert documentation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { ShikiCode, __resetShikiHighlighterForTests } from "./ShikiCode"

// Vitest's vi.doMock for `shiki` is per-module-resolution; the simplest
// pattern that works against the ESM `await import("shiki")` call is to
// register the mock via vi.mock at the top of the file with a factory
// whose behavior we toggle through a module-level counter.
let shikiCallCount = 0
let shikiShouldFail = true

vi.mock("shiki", () => ({
  createHighlighter: vi.fn(async () => {
    shikiCallCount += 1
    if (shikiShouldFail) {
      throw new Error("Mocked Shiki WASM init failure (WR-01 simulation)")
    }
    return {
      codeToHtml: (code: string) =>
        `<pre data-mocked="shiki"><code>${code.replace(/</g, "&lt;")}</code></pre>`,
    }
  }),
}))

describe("ShikiCode — Phase 075.9 T5 WR-01 promise reset on rejection", () => {
  beforeEach(() => {
    // Reset the module-scope singleton between tests so each case starts
    // from a clean state. Without this, the first test's mocked
    // rejection (or success) would persist into the next test.
    __resetShikiHighlighterForTests()
    shikiCallCount = 0
    shikiShouldFail = true
  })

  it("first mount: shiki init throws → ShikiCode renders the plain-pre fallback", async () => {
    render(<ShikiCode code={"print('hi')"} />)
    // The plain-pre fallback carries data-testid="shiki-code-fallback".
    expect(screen.getByTestId("shiki-code-fallback")).toBeInTheDocument()
    // Wait for the catch path to settle (the useEffect runs the import
    // promise and on rejection setHtml(null) keeps the fallback visible).
    await waitFor(() => {
      expect(shikiCallCount).toBeGreaterThanOrEqual(1)
    })
    // The fallback is still the rendered surface (no highlighted HTML).
    expect(screen.queryByTestId("shiki-code")).not.toBeInTheDocument()
    expect(screen.getByTestId("shiki-code-fallback")).toBeInTheDocument()
  })

  it("WR-01: after a rejected first init, the next mount re-attempts createHighlighter (singleton was reset)", async () => {
    // First mount — fails.
    const r1 = render(<ShikiCode code={"first-attempt"} />)
    await waitFor(() => {
      expect(shikiCallCount).toBeGreaterThanOrEqual(1)
    })
    const callCountAfterFirst = shikiCallCount
    r1.unmount()

    // Flip the mock to succeed on the next call.
    shikiShouldFail = false
    // CRITICAL invariant: without WR-01, highlighterPromise stays as the
    // rejected promise from mount 1, so getHighlighter() short-circuits
    // and never re-invokes `createHighlighter`. With WR-01, the singleton
    // was nulled in the catch — the next mount kicks a FRESH attempt.
    render(<ShikiCode code={"second-attempt"} />)
    await waitFor(() => {
      expect(shikiCallCount).toBeGreaterThan(callCountAfterFirst)
    })
    // And the second mount eventually renders the highlighted DOM
    // (data-testid="shiki-code") because the succeed-mock returns valid
    // HTML for setHtml() to inject.
    await waitFor(() => {
      expect(screen.getByTestId("shiki-code")).toBeInTheDocument()
    })
  })

  it("happy path: when shiki succeeds on first call, ShikiCode renders the highlighted DOM (sanity check)", async () => {
    shikiShouldFail = false
    render(<ShikiCode code={"print('ok')"} />)
    await waitFor(() => {
      expect(screen.getByTestId("shiki-code")).toBeInTheDocument()
    })
    // First call counted; no extra retries.
    expect(shikiCallCount).toBe(1)
  })

  it("streaming=true: ShikiCode still mounts and falls back / succeeds as the non-streaming path does", async () => {
    shikiShouldFail = false
    render(<ShikiCode code={"x = 1"} streaming={true} />)
    await waitFor(() => {
      expect(screen.getByTestId("shiki-code")).toBeInTheDocument()
    })
  })
})
