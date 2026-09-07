/**
 * Phase 238 (SRC-03 / D-238-08) — the ONE answer to "can this connection be browsed?".
 *
 * ⚠ THIS REPLACES A STRING GUESS THAT LIVED IN TWO PLACES. `ConnectedSourceSection.tsx` and
 * `CreateWatchModal.tsx` each carried
 *
 *     id.includes("google") || id.includes("workspace") || id.includes("drive")
 *
 * and `ConnectedSourceSection`'s own docblock named the problem before Phase 238 arrived:
 * *"The server's SourceRegistry is the authority and there is no endpoint that publishes its
 * list, so this filter is the client's honest approximation of it... widening it by guess is
 * how a dead option appears in a dropdown."*
 *
 * ⛔ SO IT WAS NOT WIDENED. Adding `|| includes("microsoft")` would have satisfied this phase
 * and left Phase 239's MCP family needing the same edit again — the milestone's *"adding a
 * source family is rows, not code"* constraint, falsified on the frontend one phase later.
 * `GET /connectors/source-families` publishes the registry instead, and this predicate reads
 * it. A family registered on the server appears here with no frontend change at all.
 */
import type { ConnectorConnection } from "@/lib/api/org"

/**
 * Can this connection be browsed, previewed and watched?
 *
 * @param families the server's registered source families, or `null` while unknown.
 */
export function isSourceCapable(
  c: ConnectorConnection,
  families: string[] | null,
): boolean {
  if (c.status === "revoked" || c.status === "error") return false
  // ⚠ FAIL CLOSED WHILE UNKNOWN, and that direction is deliberate. A connection that is
  // offered and then cannot browse is worse than one that is not offered yet: the first is a
  // dead control a person clicks and blames themselves for, the second is a list that has not
  // finished loading. `null` is "we have not been told", never "allow everything".
  if (families === null) return false
  return families.includes((c.service_id || "").toLowerCase())
}
