/**
 * Phase 292.1 (BUG-261024-03, D-12 / D-13) — the client's continue words are PINNED to the server's.
 *
 * The server decides whether a typed message resumes a paused run
 * (`backend/app/services/typed_continue.py`). The client keeps a mirror only as a RENDERING HINT:
 * when it expects a resume it skips the optimistic user bubble and assistant placeholder. If the two
 * lists drift, either the client shows a ghost bubble for a word the server resumes on, or it hides
 * the bubble for a word the server sends as a new message. This fence reads the backend set literal
 * and the shared case fixture at test time, so they cannot disagree without something going red.
 *
 * ⛔ Do NOT replace the parse with a literal list here — that would be a third hand-typed copy.
 */
import { describe, expect, it } from "vitest"

import { CONTINUE_WORDS, isContinueWord, shouldTryTypedContinue } from "../continueWords"

// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import typedContinuePy from "../../../../backend/app/services/typed_continue.py?raw"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import casesJson from "../../../../backend/tests/unit/fixtures/continue_words_cases.json?raw"

function backendWords(src: string): string[] {
  const line = src.split(/\r?\n/).find((l) => l.startsWith("CONTINUE_WORDS"))
  if (!line) {
    throw new Error("could not find CONTINUE_WORDS in typed_continue.py — update THIS parser, do not delete the fence")
  }
  return [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

const cases = JSON.parse(casesJson as string) as { words: string[]; match: string[]; no_match: string[] }

describe("292.1 — the continue words are in lockstep with the backend", () => {
  it("actually read both backend sources (non-vacuity)", () => {
    expect((typedContinuePy as string).length).toBeGreaterThan(200)
    expect(backendWords(typedContinuePy as string)).toHaveLength(6)
    expect(cases.match.length).toBeGreaterThan(0)
    expect(cases.no_match.length).toBeGreaterThan(0)
  })

  it("the client word set equals the backend set literal", () => {
    expect([...CONTINUE_WORDS].sort()).toEqual(backendWords(typedContinuePy as string).sort())
    expect([...CONTINUE_WORDS].sort()).toEqual([...cases.words].sort())
  })

  it.each(cases.match)("accepts %j", (text) => {
    expect(isContinueWord(text)).toBe(true)
  })

  it.each(cases.no_match)("refuses %j", (text) => {
    expect(isContinueWord(text)).toBe(false)
  })
})

describe("shouldTryTypedContinue — a client hint for a Deep cap-pause only", () => {
  const deep = { runId: "r", mode: "cap_paused" as const, capPaused: true, continuesRemaining: 2 }

  it("true for a continue word on a Deep cap-paused lock with Continues left", () => {
    expect(shouldTryTypedContinue(deep, "continue")).toBe(true)
  })

  it("false for other text, no lock, no Continues left, an unpaused lock, or a harness lock", () => {
    expect(shouldTryTypedContinue(deep, "please continue")).toBe(false)
    expect(shouldTryTypedContinue(undefined, "continue")).toBe(false)
    expect(shouldTryTypedContinue({ ...deep, continuesRemaining: 0 }, "continue")).toBe(false)
    expect(shouldTryTypedContinue({ ...deep, capPaused: false }, "continue")).toBe(false)
    expect(shouldTryTypedContinue({ ...deep, mode: "harness" as const }, "continue")).toBe(false)
  })
})
