/**
 * Phase 293-03 (START-04 / D-22, D-23) — `originSentence`, the only home of the six origin
 * sentences (293-UI-SPEC Surface 4). An unrecorded or unknown origin is `null`: no surface may
 * print "app", "manual" or any other default for a run whose start was not recorded.
 */
import { describe, expect, it } from "vitest"
import vocabRaw from "../runOriginVocabulary.ts?raw"
import { originSentence } from "../runOriginVocabulary"
import type { RunOrigin } from "@/types"

const o = (kind: RunOrigin["kind"], label: string | null = null, actor_name: string | null = null) =>
  ({ kind, label, actor_name }) as RunOrigin

describe("originSentence (293-03)", () => {
  it.each([
    [o("app", null, "Dana Whitfield"), "Started in the app by Dana Whitfield"],
    [o("app"), "Started in the app"],
    [o("schedule", "Monday digest"), "Started by schedule Monday digest"],
    [o("schedule"), "Started by a schedule"],
    [o("key", "n8n-prod"), "Started by key n8n-prod"],
    [o("key"), "Started by an API key"],
  ])("speaks the recorded case %#", (origin, sentence) => {
    expect(originSentence(origin)).toBe(sentence)
  })

  it("an absent origin is null, never a default (D-23)", () => {
    expect(originSentence(null)).toBeNull()
    expect(originSentence(undefined)).toBeNull()
  })

  it("an unknown kind is null, never guessed as app", () => {
    expect(originSentence({ kind: "manual", label: null, actor_name: "Dana" } as unknown as RunOrigin)).toBeNull()
    expect(originSentence({ kind: "", label: "x", actor_name: null } as unknown as RunOrigin)).toBeNull()
  })

  it("a blank label or name reads as absent", () => {
    expect(originSentence(o("key", "   "))).toBe("Started by an API key")
    expect(originSentence(o("app", null, "  "))).toBe("Started in the app")
  })

  it("a label with markup comes back as the same text (rendered as a text child)", () => {
    expect(originSentence(o("key", "<b>x</b>"))).toBe("Started by key <b>x</b>")
  })

  it("the vocabulary spells no default kind word", () => {
    expect(vocabRaw).not.toContain('"manual"')
  })
})
