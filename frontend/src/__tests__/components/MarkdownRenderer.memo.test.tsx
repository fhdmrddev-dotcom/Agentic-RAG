/**
 * Plan 075.4-04 D-075.4-SC#6 — useMemo MarkdownRenderer regression test.
 *
 * Verifies:
 *   1. marked.parse + DOMPurify.sanitize fire EXACTLY ONCE when the content
 *      prop is byte-identical across re-renders.
 *   2. marked.parse fires AGAIN when content prop changes (memo invalidates).
 */
import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"

// vi.hoisted ensures the spies exist BEFORE the vi.mock factory is hoisted
// to the top of the module. Without this we hit "Cannot access X before
// initialization" because vi.mock is moved above the module-level const decls.
const mocks = vi.hoisted(() => ({
  markedParse: vi.fn((input: string) => `<p>${input}</p>`),
  sanitize: vi.fn((input: string) => input),
}))

vi.mock("marked", () => ({
  marked: {
    parse: mocks.markedParse,
    setOptions: () => undefined,
  },
}))

vi.mock("dompurify", () => ({
  default: { sanitize: mocks.sanitize },
}))

// Import AFTER vi.mock declaration (the import is hoisted by the bundler but
// the vi.mock calls above are ALSO hoisted by vitest's transformer, so the
// module receives the mocked deps at evaluation time).
// eslint-disable-next-line import/first
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer"

describe("MarkdownRenderer useMemo regression (Plan 075.4-04 SC#6)", () => {
  it("calls marked.parse and DOMPurify.sanitize exactly ONCE when content prop is unchanged across re-renders", () => {
    mocks.markedParse.mockClear()
    mocks.sanitize.mockClear()

    const { rerender } = render(<MarkdownRenderer content="hello" />)
    expect(mocks.markedParse).toHaveBeenCalledTimes(1)
    expect(mocks.sanitize).toHaveBeenCalledTimes(1)

    // Re-render with byte-identical content prop — useMemo should skip
    // both expensive calls.
    rerender(<MarkdownRenderer content="hello" />)
    rerender(<MarkdownRenderer content="hello" />)
    rerender(<MarkdownRenderer content="hello" />)

    expect(mocks.markedParse).toHaveBeenCalledTimes(1)
    expect(mocks.sanitize).toHaveBeenCalledTimes(1)
  })

  it("calls marked.parse + DOMPurify.sanitize AGAIN when content prop changes (memo invalidates)", () => {
    mocks.markedParse.mockClear()
    mocks.sanitize.mockClear()

    const { rerender } = render(<MarkdownRenderer content="hello" />)
    expect(mocks.markedParse).toHaveBeenCalledTimes(1)

    rerender(<MarkdownRenderer content="goodbye" />)

    // Different content → memo invalidates → both deps re-run.
    expect(mocks.markedParse).toHaveBeenCalledTimes(2)
    expect(mocks.sanitize).toHaveBeenCalledTimes(2)
  })

  it("supplies the marked.parse output to DOMPurify.sanitize (sanitization still gates the html)", () => {
    mocks.markedParse.mockClear()
    mocks.sanitize.mockClear()

    render(<MarkdownRenderer content="<script>alert(1)</script>" />)

    // The composition order: marked.parse(content) → sanitize(...) — so
    // sanitize is called with the OUTPUT of marked.parse, NOT the raw content.
    expect(mocks.markedParse).toHaveBeenCalledWith("<script>alert(1)</script>")
    // The first sanitize call receives the marked.parse return value.
    const firstSanitizeArg = mocks.sanitize.mock.calls[0]?.[0]
    expect(firstSanitizeArg).toBe("<p><script>alert(1)</script></p>")
  })
})
