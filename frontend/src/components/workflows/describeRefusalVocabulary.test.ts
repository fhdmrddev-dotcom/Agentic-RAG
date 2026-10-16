/**
 * Phase 281 (FIX-10, SEED-221) — the DESCRIBE REFUSAL table's own suite.
 *
 * The table is a property of DATA, so its whole-table invariants are asserted against the data
 * (the `runVocabulary.test.ts` rule). The rendered half — that the sentence reaches the screen and
 * the code does not, with the technical-names reveal off — lives in `WorkflowBuilderPage.test.tsx`.
 *
 * ⚠ EVERY EXPECTED WORD IS READ OFF THE MODULE, never retyped here, except the forbidden-word list
 * (which is the point: those words must NOT appear) and the entitlement sentence (which is server
 * text the table must pass through untouched, so it has no home in the module to read from).
 * Comparisons are WHOLE-STRING; a containment check on a shared token proves nothing.
 */
import { describe, expect, it } from "vitest"

import { SERVICES_LABEL } from "./doorVocabulary"
import {
  REFUSAL_FALLBACK,
  REFUSAL_FOR_KEY,
  REQUEST_FAILED_KEY,
  ENTITLEMENT_REFUSED_KEY,
  describeRefusal,
  refusalKey,
  type DescribeRefusalKey,
} from "./describeRefusalVocabulary"

const ALL_KEYS = Object.keys(REFUSAL_FOR_KEY) as DescribeRefusalKey[]

/** The four server codes plus the three sub-reasons — the whole contract, stated once. */
const EXPECTED_KEYS: DescribeRefusalKey[] = [
  "connection_not_allowed",
  "connection_not_allowed:no_service_chosen",
  "connection_not_allowed:service_not_allowed",
  "connection_not_allowed:action_not_allowed",
  "no_authoring_model",
  "could_not_generate",
  "grounding_failed",
]

/** Words no sentence or next step may carry: machine codes and the never-say list (D-14/D-24). */
const FORBIDDEN = [
  "connection_not_allowed",
  "no_authoring_model",
  "could_not_generate",
  "grounding_failed",
  "no_service_chosen",
  "service_not_allowed",
  "action_not_allowed",
  "coming soon",
  "later",
  "Settings",
  "Connected services",
]

describe("281 (D-11) — the table is total and every row is real words", () => {
  it("maps exactly the four codes and three sub-reasons", () => {
    expect([...ALL_KEYS].sort()).toEqual([...EXPECTED_KEYS].sort())
  })

  it("every key resolves to a non-empty sentence and a non-empty next step", () => {
    for (const key of ALL_KEYS) {
      const r = describeRefusal(key)
      expect(r.sentence, key).toBe(REFUSAL_FOR_KEY[key].sentence)
      expect(r.next, key).toBe(REFUSAL_FOR_KEY[key].next)
      expect(r.sentence.trim().length, key).toBeGreaterThan(0)
      expect(r.next.trim().length, key).toBeGreaterThan(0)
    }
  })

  it("every sentence is pairwise distinct (each situation has its OWN sentence — D-13)", () => {
    const sentences = ALL_KEYS.map((k) => REFUSAL_FOR_KEY[k].sentence)
    expect(new Set(sentences).size).toBe(sentences.length)
    expect(sentences).not.toContain(REFUSAL_FALLBACK.sentence)
  })

  it("no sentence or next step spells a code or a never-say word", () => {
    const words = [
      ...ALL_KEYS.flatMap((k) => [REFUSAL_FOR_KEY[k].sentence, REFUSAL_FOR_KEY[k].next]),
      REFUSAL_FALLBACK.sentence,
      REFUSAL_FALLBACK.next,
    ]
    for (const w of words) {
      for (const f of FORBIDDEN) expect(w.includes(f), `"${w}" carries "${f}"`).toBe(false)
    }
  })
})

describe("281 (D-24) — the door word is IMPORTED, never retyped", () => {
  it("no_service_chosen's next step names the real picker label", () => {
    const r = describeRefusal("connection_not_allowed:no_service_chosen")
    expect(r.next.includes(SERVICES_LABEL)).toBe(true)
  })

  it("the bare connection_not_allowed fallback also points at the real picker label", () => {
    expect(describeRefusal("connection_not_allowed").next.includes(SERVICES_LABEL)).toBe(true)
  })
})

describe("281 (D-12) — the code is kept for the technical reveal, never in the words", () => {
  it("a known key with a sub-reason shows both parts, joined by a middle dot", () => {
    const r = describeRefusal("connection_not_allowed:no_service_chosen", "phase 'x' acts outside")
    expect(r.technical).toBe("connection_not_allowed · no_service_chosen")
    expect(r.technicalDetail).toBe("phase 'x' acts outside")
  })

  it("an unknown sub-reason falls back to the code-only entry, technical shows both parts", () => {
    const r = describeRefusal("connection_not_allowed:new_sub")
    expect(r.sentence).toBe(REFUSAL_FOR_KEY["connection_not_allowed"].sentence)
    expect(r.next).toBe(REFUSAL_FOR_KEY["connection_not_allowed"].next)
    expect(r.technical).toBe("connection_not_allowed · new_sub")
  })

  it("an unknown code falls back to a SENTENCE, never to the code", () => {
    const r = describeRefusal("totally_new_code", "server words")
    expect(r.sentence).toBe(REFUSAL_FALLBACK.sentence)
    expect(r.next).toBe(REFUSAL_FALLBACK.next)
    expect(r.technical).toBe("totally_new_code")
    expect(r.technicalDetail).toBe("server words")
  })

  it("a missing key falls back to a sentence with nothing technical", () => {
    for (const k of [null, undefined, ""]) {
      const r = describeRefusal(k)
      expect(r.sentence).toBe(REFUSAL_FALLBACK.sentence)
      expect(r.next).toBe(REFUSAL_FALLBACK.next)
      expect(r.technical).toBeNull()
    }
  })
})

describe("281 (D-24) — the catch arm: a server sentence renders AS IS", () => {
  const ENTITLEMENT = "Your plan doesn't include workflows. It is part of the Team plan."

  it("REQUEST_FAILED_KEY is a client-only key, not a server code in the table", () => {
    expect(ALL_KEYS as string[]).not.toContain(REQUEST_FAILED_KEY)
  })

  it("the entitlement sentence is the visible sentence, verbatim", () => {
    // 281-REVIEW WR-03: the server-worded entitlement refusal arrives on its OWN typed key —
    // REQUEST_FAILED_KEY no longer trusts whatever was thrown.
    const r = describeRefusal(ENTITLEMENT_REFUSED_KEY, ENTITLEMENT)
    expect(r.sentence).toBe(ENTITLEMENT)
    expect(r.next).toBe(REFUSAL_FALLBACK.next)
    expect(r.technical).toBeNull()
    expect(r.technicalDetail).toBeNull()
  })

  it("with no detail it falls back to the fallback sentence", () => {
    expect(describeRefusal(REQUEST_FAILED_KEY, "").sentence).toBe(REFUSAL_FALLBACK.sentence)
    expect(describeRefusal(REQUEST_FAILED_KEY).sentence).toBe(REFUSAL_FALLBACK.sentence)
    expect(describeRefusal(ENTITLEMENT_REFUSED_KEY, "").sentence).toBe(REFUSAL_FALLBACK.sentence)
  })

  it("281-REVIEW WR-03: ENTITLEMENT_REFUSED_KEY is client-only too, never a table code", () => {
    expect(typeof ENTITLEMENT_REFUSED_KEY).toBe("string")
    expect(ENTITLEMENT_REFUSED_KEY).not.toBe(REQUEST_FAILED_KEY)
    expect(ALL_KEYS as string[]).not.toContain(ENTITLEMENT_REFUSED_KEY)
  })

  it.each([
    "Failed to generate workflow (status 502)",
    "Failed to fetch",
    "Your plan doesn't include workflows.",
  ])("281-REVIEW WR-03: any other thrown text (%s) reads the fallback; the raw text is reveal-only", (raw) => {
    const r = describeRefusal(REQUEST_FAILED_KEY, raw)
    expect(r.sentence).toBe(REFUSAL_FALLBACK.sentence)
    expect(r.next).toBe(REFUSAL_FALLBACK.next)
    expect(r.technical).toBeNull()
    expect(r.technicalDetail).toBe(raw)
  })
})

describe("281 (D-13) — refusalKey joins the code and the additive sub-reason", () => {
  it("joins with a colon when a sub-reason is present", () => {
    expect(refusalKey("connection_not_allowed", "no_service_chosen")).toBe(
      "connection_not_allowed:no_service_chosen",
    )
  })

  it("returns the bare code when the sub-reason is absent (a pre-281 server)", () => {
    expect(refusalKey("no_authoring_model")).toBe("no_authoring_model")
    expect(refusalKey("no_authoring_model", null)).toBe("no_authoring_model")
    expect(refusalKey("no_authoring_model", "")).toBe("no_authoring_model")
  })
})
