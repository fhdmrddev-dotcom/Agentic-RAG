/**
 * Phase 231 · VIS-02 — every word the "who will see this" surface says.
 *
 * ⭐ THE SENTENCE IS THE DELIVERABLE, not decoration around a control. SC#1: *"A person setting up
 *    a connection reads one plain sentence saying who will be able to see everything it brings in
 *    — before it brings anything in. There is no configuration path where that sentence is
 *    absent."*
 *
 * That clause is why the copy lives in one file rather than inline at each mount: a sentence that
 * exists in three hand-written variants is a sentence that will go missing from one of them.
 *
 * Sketch 228, locked B + A (operator 2026-09-05):
 *   B — the sentence IS the option (`AUDIENCE_ROWS`), so you cannot choose without reading what
 *       the choice does.
 *   A — the always-on footer (`scopeFooterSentence`), the coverage rule for every path B does not
 *       reach, including edit-later screens.
 *
 * ⚠ NO `dept` COPY EXISTS HERE, deliberately. The stored value is enum-shaped
 *   `private | org | dept` and the SQL resolver carries a `dept` branch, but D-5 says the scope is
 *   INERT and no UI offers it. Writing its words now would be the first step to shipping it by
 *   accident. *Inert means invisible.*
 */

import type { IngestVisibility } from "@/lib/api/org"

/** The scopes a person may actually choose today. `dept` is absent on purpose (D-5). */
export const OFFERED_VISIBILITIES = ["private", "org"] as const
export type OfferedVisibility = (typeof OFFERED_VISIBILITIES)[number]

export interface AudienceRow {
  value: OfferedVisibility
  /** The choice, as a person would say it. */
  title: string
  /** The consequence of the choice. This is the sentence SC#1 is about. */
  consequence: (orgName: string, memberCount: number | null) => string
  /** Widening reads louder — colour is reinforcement, never the only carrier (WCAG 1.4.1). */
  tone: "calm" | "warn"
}

/** Variant B — the sentence IS the option. */
export const AUDIENCE_ROWS: readonly AudienceRow[] = [
  {
    value: "private",
    title: "Only me",
    tone: "calm",
    consequence: (orgName) =>
      `Nobody else in ${orgName} will see these documents in the Library, in search, or in an ` +
      `answer the agent gives.`,
  },
  {
    value: "org",
    title: "Everyone in this organisation",
    tone: "warn",
    // ⚠ THE LAST CLAUSE IS PITFALL 2 STATED ON SCREEN — the connecting person must not silently
    //   become a gateway. Their own access to the source is being re-exported to people who do
    //   not have it. A footer can omit this; a row that IS the choice cannot.
    consequence: (orgName, memberCount) =>
      `${describeAudience(orgName, memberCount)} will be able to read these documents, and the ` +
      `agent will quote them in answers — including to people who cannot open the originals at ` +
      `the source.`,
  },
] as const

/**
 * Variant A — the always-on footer.
 *
 * ⚠ Returns a sentence for EVERY value, including ones no UI offers and any value this client does
 *   not recognise. A surface that renders nothing for an unexpected value is a configuration path
 *   with no sentence, which is the exact thing SC#1 forbids. The unknown arm names the scope
 *   rather than guessing at its audience.
 */
export function scopeFooterSentence(
  visibility: IngestVisibility | string | null | undefined,
  orgName: string,
  memberCount: number | null,
): string {
  switch (visibility) {
    case "private":
      return (
        `Documents this connection brings in will be visible to you only. ` +
        `Nobody else in ${orgName} will see them in the Library, in search, or in an answer the ` +
        `agent gives.`
      )
    case "org":
      return (
        `Documents this connection brings in will be visible to ` +
        `${describeAudience(orgName, memberCount)} — in the Library, in search, and in answers ` +
        `the agent gives.`
      )
    case "dept":
      // Unreachable through the UI (D-5). Kept honest rather than silent, because a value that
      // exists in the database can reach a screen through a route nobody drew.
      return (
        `This connection is set to a department scope, which this version cannot yet describe ` +
        `precisely. Until departments are available it behaves as ${orgName}-wide.`
      )
    default:
      return (
        `This connection has an unrecognised sharing setting (${String(visibility)}). Nothing it ` +
        `brings in will be shared until you choose who can see it.`
      )
  }
}

/** The count is more honest than the label, and more alarming — which is the point. */
function describeAudience(orgName: string, memberCount: number | null): string {
  if (memberCount === null || memberCount < 1) return `everyone in ${orgName}`
  if (memberCount === 1) return `the 1 person in ${orgName}`
  return `all ${memberCount} people in ${orgName}`
}

export const VISIBILITY_FIELD_LABEL = "Who can see what this brings in"

/** Shown where the choice is made, above the rows. */
export const VISIBILITY_FIELD_HELP =
  "This applies to everything this connection brings in, from now on."

/**
 * ⚠ Changing the scope does NOT re-scope what is already here — the stamped value on each
 * document is deliberate (migration 155). Saying so prevents the reasonable and wrong assumption
 * that narrowing a connection retroactively hides what it already placed.
 */
export const VISIBILITY_CHANGE_NOTE =
  "Changing this affects documents brought in from now on. Documents already brought in keep the " +
  "setting they arrived with."
