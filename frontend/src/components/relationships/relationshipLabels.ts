/**
 * Phase 117 Plan 04 — the inverse-label DISPLAY mirror (D-117-6).
 *
 * The backend OWNS the relationship vocabulary: `tool_dispatcher._INVERSE_LABEL`
 * maps each rel_type to its inverse snake_case key (supersedes→superseded_by,
 * amends→amended_by, references→referenced_by, attached_to→has_attachment). The
 * GET read seam returns each row's `direction` + raw `label` already; this tiny
 * casing map is the frontend's display mirror — it MUST stay 1:1 with those keys.
 * NEVER invent wording here (the sketch + CONTEXT D-117-6 lock this): a relationship
 * is one edge seen from two ends, and the inverse label is how the OTHER end reads.
 *
 * Outgoing rows show the verb verbatim ("Supersedes"); incoming rows show the
 * inverse ("Superseded by"). The maps are keyed by the 4 closed RelType values so a
 * new/renamed backend rel_type forces a compile-time update here, not silent drift.
 */
import type { RelType } from "@/types"

/** Outgoing chip label — the verb read from the open document's perspective. */
export const OUTGOING_LABEL: Record<RelType, string> = {
  supersedes: "Supersedes",
  amends: "Amends",
  references: "References",
  attached_to: "Attached to",
}

/** Incoming chip label — the INVERSE, mirrored 1:1 from the backend
 *  `_INVERSE_LABEL` (superseded_by / amended_by / referenced_by / has_attachment). */
export const INCOMING_LABEL: Record<RelType, string> = {
  supersedes: "Superseded by",
  amends: "Amended by",
  references: "Referenced by",
  attached_to: "Has attachment",
}

/** The label for a row, chosen by its direction (the display mirror of the
 *  backend's raw `label`/`direction`). Outgoing → verb; incoming → inverse. */
export function relLabel(relType: RelType, direction: "outgoing" | "incoming"): string {
  return direction === "outgoing" ? OUTGOING_LABEL[relType] : INCOMING_LABEL[relType]
}

/** The 4 closed rel types, in the sketch's segmented-chip order (type-first
 *  authoring — CreateLinkDialog). */
export const REL_TYPES: RelType[] = ["supersedes", "amends", "references", "attached_to"]

// ── Phase 271 (FIND-03 / D-04 / D-07) — the Relationship FILTER verbs ─────────────────────
//
// Find filters by both directions of all 4 stored types, so it needs 8 verbs, each reading as
// "<result> <verb> <picked document>". They are DERIVED from the two maps above — never
// retyped — so the chip labels and the filter verbs cannot drift apart.

/** The backend inverse key for each rel type. Mirrors `_INVERSE_LABEL` in
 *  `backend/app/services/document_relationship_service.py` 1:1 — pinned by the `?raw` read
 *  of that file in `relationshipLabels.test.ts`, so a renamed backend key reds there. */
const INVERSE_KEY = {
  supersedes: "superseded_by",
  amends: "amended_by",
  references: "referenced_by",
  attached_to: "has_attachment",
} as const satisfies Record<RelType, string>

/** The 8 filter verb keys: the 4 rel types plus their 4 inverse keys. */
export type RelVerbKey = RelType | (typeof INVERSE_KEY)[RelType]

export interface FilterVerb {
  key: RelVerbKey
  /** The verb as the result row reads it (e.g. Supersedes; the derived "Is …" predicates). */
  label: string
  relType: RelType
  /** `outgoing`: result → picked. `incoming`: picked → result. */
  direction: "outgoing" | "incoming"
}

/**
 * THE ONE STATED TRANSFORM (UI-SPEC copy vs the chip maps): a chip label that is a
 * PARTICIPLE PHRASE — its first word ends in "ed" ("Superseded by", "Amended by",
 * "Referenced by", "Attached to") — becomes "Is " + the label with its first letter
 * lower-cased, so it reads as a predicate after the result's name. A FINITE verb
 * ("Supersedes", "Amends", "References", "Has attachment") is used unchanged.
 */
function asFilterVerb(chipLabel: string): string {
  const firstWord = chipLabel.split(" ")[0] ?? ""
  if (!firstWord.endsWith("ed")) return chipLabel
  return `Is ${chipLabel.charAt(0).toLowerCase()}${chipLabel.slice(1)}`
}

/** Derive the 8-verb table from a pair of chip maps. Order: for each `REL_TYPES` entry,
 *  outgoing then incoming. Exported so the suite can prove the table is COMPUTED. */
export function deriveFilterVerbs(
  outgoing: Record<RelType, string>,
  incoming: Record<RelType, string>,
): FilterVerb[] {
  return REL_TYPES.flatMap((relType): FilterVerb[] => [
    { key: relType, label: asFilterVerb(outgoing[relType]), relType, direction: "outgoing" },
    {
      key: INVERSE_KEY[relType],
      label: asFilterVerb(incoming[relType]),
      relType,
      direction: "incoming",
    },
  ])
}

/** The Relationship filter's closed verb table (UI-SPEC S6). */
export const RELATIONSHIP_FILTER_VERBS: FilterVerb[] = deriveFilterVerbs(OUTGOING_LABEL, INCOMING_LABEL)
