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
