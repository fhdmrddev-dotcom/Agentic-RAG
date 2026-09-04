/**
 * Operator-reported 2026-09-01: a run row read `✗ failed - failed`.
 *
 * ⚠ THE COMPOSITION WAS `${statusWord} - ${shortLabel}`, and `DEFAULT_CATEGORY.shortLabel`
 * is the literal string "failed" — so EVERY unrecognised error printed the status word
 * twice with a dash between them. The default label is not the bug and is unchanged; what
 * was wrong is appending a category that merely repeats the status.
 */
import { describe, expect, it } from "vitest"

import { categorizeError } from "@/lib/errorCategories"

/** Mirrors `RunCard.tsx`'s exported behaviour through the one input that drives it. */
function suffixFor(word: string, runError?: string): string {
  if (!runError) return ""
  const label = categorizeError(runError).shortLabel.trim()
  if (!label) return ""
  if (label.toLowerCase() === word.trim().toLowerCase()) return ""
  return ` - ${label}`
}

describe("a category that repeats the status says nothing", () => {
  it("⭐ an UNRECOGNISED error no longer doubles the word", () => {
    // The exact shape from the screenshot: an error the categoriser cannot place.
    expect(suffixFor("failed", "something nobody wrote a pattern for")).toBe("")
    expect(`failed${suffixFor("failed", "something nobody wrote a pattern for")}`).toBe("failed")
  })

  it("the default label itself is UNCHANGED — it is right on its own", () => {
    expect(categorizeError("unplaceable").shortLabel).toBe("failed")
  })

  it("a category that ADDS something is still shown", () => {
    expect(suffixFor("failed", "429 rate limit exceeded")).not.toBe("")
    expect(`failed${suffixFor("failed", "invalid api key 401")}`).toBe("failed - auth error")
  })

  it("the collision is caught on MEANING, not bytes", () => {
    // "timed out" vs a differently-cased label would otherwise print "timed out - Timed out"
    expect(suffixFor("timed out", "the request timed out")).toBe("")
  })

  it("no error at all adds no suffix", () => {
    expect(suffixFor("failed")).toBe("")
    expect(suffixFor("failed", "")).toBe("")
  })
})
