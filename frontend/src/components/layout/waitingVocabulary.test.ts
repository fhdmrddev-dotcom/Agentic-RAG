/**
 * Phase 301-03 (D-02, D-06, D-10, D-28; UI-SPEC Copywriting Contract, UI-D13, UI-D14) — the one
 * home of every word the "Waiting on you" control, its list and the drawer row show.
 *
 * Words-first: every string is asserted verbatim here and as rendered content in
 * WaitingOnYouControl.test.tsx. No raw wire value (question, approval, an ISO time, a UUID) is
 * ever one of these words.
 */
import { describe, it, expect } from "vitest"

import {
  WAITING_COPY,
  countSentence,
  pillText,
  kindWords,
  originWords,
  waitedPhrase,
  moreLine,
  orgInitial,
} from "./waitingVocabulary"
import leafRaw from "./waitingVocabulary.ts?raw"

const NOW = Date.parse("2026-10-30T12:00:00.000Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000
const HR = 60 * MIN
const DAY = 24 * HR

describe("countSentence (D-02, the control's accessible name)", () => {
  it.each([
    [0, "Waiting on you"],
    [null, "Waiting on you"],
    [1, "1 workflow run is waiting on you"],
    [2, "2 workflow runs are waiting on you"],
    [120, "120 workflow runs are waiting on you"],
  ] as [number | null, string][])("countSentence(%s) = %s", (n, words) => {
    expect(countSentence(n)).toBe(words)
  })
})

describe("pillText (UI-D6)", () => {
  it.each([
    [7, "7"],
    [99, "99"],
    [100, "99+"],
  ] as [number, string][])("pillText(%s) = %s", (n, words) => {
    expect(pillText(n)).toBe(words)
  })
})

describe("kindWords / originWords (D-06, D-28, UI-D13)", () => {
  it("names what each kind needs, and never the raw word", () => {
    expect(kindWords("question")).toBe("needs your answer")
    expect(kindWords("approval")).toBe("needs your approval")
    expect(kindWords("other")).toBe("needs you")
  })

  it("names a scheduled or key-started run, and nothing for the app or no origin", () => {
    expect(originWords("schedule")).toBe("scheduled")
    expect(originWords("key")).toBe("started by an API key")
    expect(originWords("app")).toBeNull()
    expect(originWords(null)).toBeNull()
    expect(originWords(undefined)).toBeNull()
  })
})

describe("waitedPhrase (UI-D14)", () => {
  it.each([
    ["30 s", ago(30_000), "waiting under a minute"],
    ["a future created_at", new Date(NOW + 5 * MIN).toISOString(), "waiting under a minute"],
    ["an unparseable string", "not a date", "waiting under a minute"],
    ["3 min", ago(3 * MIN), "waiting 3 min"],
    ["59 min 59 s", ago(59 * MIN + 59_000), "waiting 59 min"],
    ["60 min", ago(60 * MIN), "waiting 1 hr"],
    ["23 h 59 min", ago(23 * HR + 59 * MIN), "waiting 23 hr"],
    ["24 h", ago(DAY), "waiting 1 day"],
    ["49 h", ago(49 * HR), "waiting 2 days"],
  ])("%s → %s", (_label, created, words) => {
    expect(waitedPhrase(created, NOW)).toBe(words)
  })
})

describe("moreLine, WAITING_COPY, orgInitial (D-10, D-17, UI-D13)", () => {
  it("says how many more there are than shown", () => {
    expect(moreLine(3)).toBe("and 3 more")
  })

  it("carries every fixed string verbatim", () => {
    expect(WAITING_COPY.empty).toBe("Nothing is waiting on you.")
    expect(WAITING_COPY.loading).toBe("Checking what's waiting on you…")
    expect(WAITING_COPY.failed).toBe("Couldn't check right now. Trying again shortly.")
    expect(WAITING_COPY.stale).toBe("Couldn't refresh just now. This is the last list we got.")
    expect(WAITING_COPY.label).toBe("Waiting on you")
    expect(WAITING_COPY.header).toBe("Waiting on you")
    expect(WAITING_COPY.untitledWorkflow).toBe("Untitled workflow")
    expect(WAITING_COPY.unnamedOrg).toBe("Unnamed org")
  })

  it("takes the org's first character, upper-cased, or ?", () => {
    expect(orgInitial("acme legal")).toBe("A")
    expect(orgInitial("  ")).toBe("?")
  })

  it("never shows a raw wire word", () => {
    const all = JSON.stringify(WAITING_COPY)
    expect(all).not.toMatch(/\bquestion\b|\bapproval\b/)
  })

  it("is a zero-import leaf", () => {
    expect(leafRaw.split(/\r?\n/).filter((l) => /^import\b/.test(l))).toEqual([])
  })
})
