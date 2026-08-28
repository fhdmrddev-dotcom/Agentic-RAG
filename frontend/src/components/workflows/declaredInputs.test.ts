/**
 * Phase 214.1-01 Task 1 (STEP-02 · D-214.1-02 · D-214.1-03) — the declared-input leaf.
 *
 * WHY THIS SUITE EXISTS AT ALL. `BUG-260828-02` survived a sixteen-plan phase with green
 * gates because EVERY test built `definition.inputs[]` by hand — the fixtures could reach a
 * state no human could. These cases drive the code that MINTS those entries, so the shape a
 * person can actually produce is the shape under assertion.
 *
 * ⚠ THE `Object.keys` FENCE IS THE LOAD-BEARING CASE. `InputFieldSpec` is `_StrictBase`
 * (`extra="forbid"`) and `selectDefinition` spreads `meta` STRAIGHT into the autosave PATCH
 * body, so ONE stray key on an entry is a 422 that destroys the very first write.
 */
import { describe, it, expect } from "vitest"

import declaredInputsSource from "./declaredInputs?raw"
import {
  declaredInputFor,
  refuseDeclaredInputKey,
  undeclaredAskKeys,
  type DeclaredInput,
} from "./declaredInputs"
import { RESERVED_LAUNCH_INPUT_KEYS } from "./soulData"
import { ARG_SOURCE_ASK } from "./argumentVocabulary"
import { DECLARED_INPUTS_TITLE } from "./declaredInputsVocabulary"

// ── 1. The three refusals ─────────────────────────────────────────────────────────────

describe("refuseDeclaredInputKey — emptiness", () => {
  it("refuses the empty string", () => {
    expect(refuseDeclaredInputKey("", [])).toBe("empty")
  })

  it("refuses a whitespace-only key", () => {
    expect(refuseDeclaredInputKey("   ", [])).toBe("empty")
  })
})

describe("refuseDeclaredInputKey — the RESERVED set, ITERATED", () => {
  // ⭐ ITERATED, never two literals. A third reserved key added to the shipped set inherits
  // the refusal with no edit here — which is the whole reason the set is imported rather
  // than re-typed (D-214.1-03).
  it("refuses EVERY member of the shipped RESERVED_LAUNCH_INPUT_KEYS", () => {
    const members = [...RESERVED_LAUNCH_INPUT_KEYS]
    // NON-VACUITY: an empty set would make the loop below assert nothing at all.
    expect(members.length).toBeGreaterThan(0)
    for (const key of members) {
      expect(refuseDeclaredInputKey(key, [])).toBe("reserved")
    }
  })

  it("POSITIVE CONTROL — a made-up key is NOT refused as reserved", () => {
    expect(refuseDeclaredInputKey("recipient", [])).toBeNull()
    expect(refuseDeclaredInputKey("kickoff_prompt_but_not_really", [])).toBeNull()
  })

  it("the client set equals the backend frozenset, and the source NAMES its other half", () => {
    expect(RESERVED_LAUNCH_INPUT_KEYS).toEqual(new Set(["kickoff_prompt", "folder_id"]))

    // The other half of the one rule is a backend frozenset. The leaf's own docblock names
    // it so the next reader can find the owner rather than re-deriving the set.
    // NON-VACUITY CONTROL FIRST: the `?raw` read really did produce source.
    expect(declaredInputsSource.length).toBeGreaterThan(200)
    expect(declaredInputsSource).toContain("backend/app/models/message.py")
    expect(declaredInputsSource).toContain("RESERVED_RUN_INPUT_KEYS")
    // And the read is not matching everything: a path NOT in the file is absent.
    expect(declaredInputsSource).not.toContain("backend/app/models/nonexistent_module.py")
  })
})

describe("refuseDeclaredInputKey — duplicates and acceptance", () => {
  const existing: DeclaredInput[] = [declaredInputFor("to")]

  it("refuses a key already declared", () => {
    expect(refuseDeclaredInputKey("to", existing)).toBe("duplicate")
  })

  it("accepts the same key when nothing declares it yet", () => {
    expect(refuseDeclaredInputKey("to", [])).toBeNull()
  })

  it("applies NO format rule beyond emptiness — InputFieldSpec.key is an unconstrained str", () => {
    // A client-side identifier regex would be a second copy of a server predicate that does
    // not exist (D-182-06). The server accepts these; so does this door.
    expect(refuseDeclaredInputKey("Recipient Email", [])).toBeNull()
    expect(refuseDeclaredInputKey("to-address", [])).toBeNull()
    expect(refuseDeclaredInputKey("123", [])).toBeNull()
  })

  it("trims before comparing, so a padded duplicate is still a duplicate", () => {
    expect(refuseDeclaredInputKey("  to  ", existing)).toBe("duplicate")
  })
})

// ── 2. The stored shape — THE 422 FENCE ───────────────────────────────────────────────

describe("declaredInputFor — the 422 fence", () => {
  it("mints EXACTLY the four keys InputFieldSpec declares for this door", () => {
    expect(Object.keys(declaredInputFor("recipient")).sort()).toEqual([
      "key",
      "label",
      "required",
      "type",
    ])
  })

  it("writes type as the literal text — InputFieldSpec.type has NO default", () => {
    expect(declaredInputFor("recipient").type).toBe("text")
  })

  it("defaults required to true, matching InputFieldSpec.required = True", () => {
    expect(declaredInputFor("recipient").required).toBe(true)
  })

  it("writes label === key — an invented friendly name would fabricate an author's words", () => {
    expect(declaredInputFor("recipient").label).toBe("recipient")
  })

  it("trims the key it is handed", () => {
    expect(declaredInputFor("  recipient  ").key).toBe("recipient")
  })

  it("POSITIVE CONTROL — the key-set comparison really does name a stray key", () => {
    const withStray = { ...declaredInputFor("recipient"), description: "nope" }
    expect(Object.keys(withStray).sort()).not.toEqual(["key", "label", "required", "type"])
  })

  it("carries NO description — the field does not exist on InputFieldSpec (extra=forbid)", () => {
    expect(declaredInputFor("recipient")).not.toHaveProperty("description")
  })
})

// ── 3. undeclaredAskKeys — the exit from BUG-260828-02's loop ─────────────────────────

const askPhase = (slug: string, argSources: Record<string, unknown>) => ({
  slug,
  phase_index: 0,
  config: { phase_type: "external_action", arg_sources: argSources },
})

describe("undeclaredAskKeys", () => {
  it("returns the ask_key a step names when nothing declares it (NON-VACUITY)", () => {
    const out = undeclaredAskKeys({
      phases: [askPhase("act", { to: { source: "ask", ask_key: "recipient" } })],
    })
    // The non-vacuity control for the whole describe: at least ONE shape returns something.
    expect(out.length).toBeGreaterThan(0)
    expect(out).toEqual(["recipient"])
  })

  it("falls back to the SCHEMA PROPERTY NAME when ask_key is absent (args.py: key = ask_key or name)", () => {
    expect(undeclaredAskKeys({ phases: [askPhase("act", { to: { source: "ask" } })] })).toEqual([
      "to",
    ])
  })

  it("does not offer a key inputs[] already declares", () => {
    expect(
      undeclaredAskKeys({
        inputs: [declaredInputFor("recipient")],
        phases: [askPhase("act", { to: { source: "ask", ask_key: "recipient" } })],
      }),
    ).toEqual([])
  })

  it("ignores fixed and upstream sources", () => {
    expect(
      undeclaredAskKeys({
        phases: [
          askPhase("act", {
            to: { source: "fixed" },
            body: { source: "upstream", upstream_slug: "write" },
          }),
        ],
      }),
    ).toEqual([])
  })

  it("does NOT offer a reserved key a step happens to name", () => {
    expect(
      undeclaredAskKeys({
        phases: [askPhase("act", { to: { source: "ask", ask_key: "kickoff_prompt" } })],
      }),
    ).toEqual([])
  })

  it("de-duplicates across steps and keeps phase order then property order", () => {
    expect(
      undeclaredAskKeys({
        phases: [
          askPhase("first", {
            to: { source: "ask", ask_key: "recipient" },
            subject: { source: "ask" },
          }),
          askPhase("second", { cc: { source: "ask", ask_key: "recipient" } }),
          askPhase("third", { body: { source: "ask" } }),
        ],
      }),
    ).toEqual(["recipient", "subject", "body"])
  })

  it("degrades to nothing on server JSONB that is not the shape it expects", () => {
    expect(undeclaredAskKeys({})).toEqual([])
    expect(undeclaredAskKeys({ phases: null })).toEqual([])
    expect(undeclaredAskKeys({ phases: "not an array" })).toEqual([])
    expect(undeclaredAskKeys({ phases: [null, 7, "x"] })).toEqual([])
    expect(undeclaredAskKeys({ phases: [{ config: "not an object" }] })).toEqual([])
    expect(undeclaredAskKeys({ phases: [{ config: { arg_sources: [1, 2] } }] })).toEqual([])
    expect(undeclaredAskKeys({ phases: [{ config: { arg_sources: { to: null } } }] })).toEqual([])
  })

  it("tolerates a non-array inputs without throwing away the offer", () => {
    expect(
      undeclaredAskKeys({
        inputs: "not an array",
        phases: [askPhase("act", { to: { source: "ask", ask_key: "recipient" } })],
      }),
    ).toEqual(["recipient"])
  })
})

// ── 4. The door and the arm are the SAME SUBJECT ──────────────────────────────────────

describe("declaredInputsVocabulary — the title agrees with the argument arm", () => {
  it("DECLARED_INPUTS_TITLE is ARG_SOURCE_ASK verbatim", () => {
    // `BUG-260828-02` IS the gap between choosing an arm and having nowhere to satisfy it.
    // An author who meets two different names for one subject meets that gap again.
    expect(DECLARED_INPUTS_TITLE).toBe(ARG_SOURCE_ASK)

    // POSITIVE CONTROL: the comparison is not passing because both are empty or undefined.
    expect(DECLARED_INPUTS_TITLE.length).toBeGreaterThan(0)
  })
})
