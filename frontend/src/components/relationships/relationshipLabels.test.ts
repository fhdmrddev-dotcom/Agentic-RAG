/**
 * Phase 271-03 Task 2 (FIND-03 / D-04 / D-07 / T-271-13) — the 8-verb Relationship filter
 * table, DERIVED from the shipped Phase 117 maps and PINNED to the backend.
 *
 * Three pins, each answering a different way the vocabulary could drift:
 *   1. the derived table equals the UI-SPEC table exactly (keys, words, rel type, side);
 *   2. the table is COMPUTED: a changed map changes the derived label (never retyped);
 *   3. its keys equal the backend `_INVERSE_LABEL` keys plus values, read from the Python
 *      source itself (`?raw`), with a positive control that the regex parsed 4 pairs.
 */
import { describe, it, expect } from "vitest"

import {
  INCOMING_LABEL,
  OUTGOING_LABEL,
  RELATIONSHIP_FILTER_VERBS,
  deriveFilterVerbs,
} from "./relationshipLabels"

// @ts-ignore — Vite `?raw` import of a backend source file (the established precedent).
import relationshipServiceSource from "../../../../backend/app/services/document_relationship_service.py?raw"

describe("RELATIONSHIP_FILTER_VERBS (UI-SPEC S6)", () => {
  it("is exactly the 8-verb table, in order", () => {
    expect(RELATIONSHIP_FILTER_VERBS).toEqual([
      { key: "supersedes", label: "Supersedes", relType: "supersedes", direction: "outgoing" },
      { key: "superseded_by", label: "Is superseded by", relType: "supersedes", direction: "incoming" },
      { key: "amends", label: "Amends", relType: "amends", direction: "outgoing" },
      { key: "amended_by", label: "Is amended by", relType: "amends", direction: "incoming" },
      { key: "references", label: "References", relType: "references", direction: "outgoing" },
      { key: "referenced_by", label: "Is referenced by", relType: "references", direction: "incoming" },
      { key: "attached_to", label: "Is attached to", relType: "attached_to", direction: "outgoing" },
      { key: "has_attachment", label: "Has attachment", relType: "attached_to", direction: "incoming" },
    ])
  })

  it("leaves the Phase 117 chip maps untouched (the dialog and section still read them)", () => {
    expect(OUTGOING_LABEL).toEqual({
      supersedes: "Supersedes",
      amends: "Amends",
      references: "References",
      attached_to: "Attached to",
    })
    expect(INCOMING_LABEL).toEqual({
      supersedes: "Superseded by",
      amends: "Amended by",
      references: "Referenced by",
      attached_to: "Has attachment",
    })
  })
})

describe("deriveFilterVerbs — the table is computed, never typed", () => {
  it("a change to OUTGOING_LABEL.supersedes changes the derived label", () => {
    const derived = deriveFilterVerbs({ ...OUTGOING_LABEL, supersedes: "Replaces" }, INCOMING_LABEL)
    expect(derived.find((v) => v.key === "supersedes")?.label).toBe("Replaces")
  })

  it("a participle phrase gains 'Is ' and a lower-cased first letter; a finite verb is unchanged", () => {
    const derived = deriveFilterVerbs(
      { ...OUTGOING_LABEL, references: "Cited by" },
      { ...INCOMING_LABEL, amends: "Revises" },
    )
    expect(derived.find((v) => v.key === "references")?.label).toBe("Is cited by")
    expect(derived.find((v) => v.key === "amended_by")?.label).toBe("Revises")
  })
})

describe("the 8 keys are pinned to the backend _INVERSE_LABEL", () => {
  it("equal its keys plus values, read from the Python source", () => {
    const src = relationshipServiceSource as string
    const block = /_INVERSE_LABEL\s*=\s*\{([\s\S]*?)\}/.exec(src)
    expect(block).not.toBeNull()
    const pairs = [...(block?.[1] ?? "").matchAll(/"([a-z_]+)"\s*:\s*"([a-z_]+)"/g)].map(
      (m) => [m[1], m[2]] as const,
    )
    // Positive control: the regex really parsed the map. A loop over zero pairs passes free.
    expect(pairs).toHaveLength(4)

    const backendKeys = new Set(pairs.flatMap(([k, v]) => [k, v]))
    expect(new Set(RELATIONSHIP_FILTER_VERBS.map((v) => v.key))).toEqual(backendKeys)

    // Each relType's incoming key is exactly its backend inverse name.
    const incomingByType = Object.fromEntries(
      RELATIONSHIP_FILTER_VERBS.filter((v) => v.direction === "incoming").map((v) => [v.relType, v.key]),
    )
    expect(incomingByType).toEqual(Object.fromEntries(pairs))
  })
})
