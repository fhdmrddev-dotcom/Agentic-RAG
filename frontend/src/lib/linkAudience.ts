/**
 * Phase 299-04 (D-33 / D-34 / UI-D15) — who a link to an item opens for, in words.
 *
 * ⭐ ONE RULE, TWO TWINS, ONE FIXTURE. The server's rule is `audience_of` in
 * `backend/app/services/link_resolver.py`; this leaf mirrors it so the link surface can say
 * who can open the link from the facts it already holds. Both are pinned to
 * `backend/tests/unit/fixtures/link_audience_cases.json` (the `linkAudience.lockstep` fence), so
 * they cannot drift without something going red.
 *
 * ⛔ The line NEVER promises more than the rule (T-299-32): a chat, a draft, a published
 *    workflow that is not system-global, and a run that has not finished open only for their
 *    owner (D-33 / D-34) — never "members". A link is an address, never a grant.
 * ⛔ A STRICT LEAF — no dependencies, no React. The surface derives the audience here, never twice.
 */

export type Audience = "only_you" | "org_members" | "granted" | "everyone" | "managers_only"

export type LinkAudienceKind = "thread" | "workflow" | "run" | "expert"

export interface AudienceFacts {
  status?: string | null
  is_system_global?: boolean | null
  is_system?: boolean | null
  is_enabled?: boolean | null
  visibility?: string | null
  has_org?: boolean | null
}

/** A run is finished — and so readable by its org's members (D-34) — only in these statuses. */
export const TERMINAL_RUN_STATUSES: readonly string[] = ["completed", "failed", "cancelled"]

/** The same rule as `link_resolver.audience_of`. */
export function audienceOf(kind: LinkAudienceKind, facts: AudienceFacts): Audience {
  if (kind === "workflow") return facts.is_system_global ? "everyone" : "only_you"
  if (kind === "run") {
    const finished = typeof facts.status === "string" && TERMINAL_RUN_STATUSES.includes(facts.status)
    return finished && facts.has_org ? "org_members" : "only_you"
  }
  if (kind === "expert") {
    if (facts.is_system) return "everyone"
    if (facts.is_enabled === false) return "managers_only"
    if (facts.visibility === "org" || facts.visibility === "public") return "org_members"
    if (facts.visibility === "granted") return "granted"
    return "only_you"
  }
  return "only_you"
}

const ONLY_YOU = "Opens only for you, on any device you're signed in on."

/** The parts of the UI-D15 line, so a surface can render the org name in its own weight. */
export function audienceParts(audience: Audience, orgName: string | null): { before: string; org: string | null; after: string } {
  if (audience === "everyone") return { before: "Opens for anyone signed in to Syrel.", org: null, after: "" }
  // An org-scoped line with no org name would claim members of an unnamed org — fall back.
  if (audience === "only_you" || !orgName) return { before: ONLY_YOU, org: null, after: "" }
  if (audience === "org_members") return { before: "Opens for members of ", org: orgName, after: "." }
  if (audience === "granted") return { before: "Opens for the people it's shared with in ", org: orgName, after: "." }
  return { before: "It's turned off, so it opens only for people who manage Experts in ", org: orgName, after: "." }
}

/** The UI-D15 sentence for an audience, with the org name substituted. */
export function audienceLine(audience: Audience, orgName: string | null): string {
  const { before, org, after } = audienceParts(audience, orgName)
  return `${before}${org ?? ""}${after}`
}

/** The noun the trigger and the surface heading use ("Link to this {noun}"). */
export function linkNoun(kind: LinkAudienceKind): "chat" | "workflow" | "workflow run" | "Expert" {
  if (kind === "thread") return "chat"
  if (kind === "workflow") return "workflow"
  if (kind === "run") return "workflow run"
  return "Expert"
}
