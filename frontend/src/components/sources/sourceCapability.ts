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
 * Phase 239 (D-239-08) — TRANSPORT the row DECLARED -> the family the server registered for it.
 *
 * ⭐ **THE SERVER RESOLVES AN ADAPTER TWICE AND THIS PREDICATE ONLY DID IT ONCE.**
 * `services/sources/base.py` tries an exact `service_id`, and failing that the transport —
 * that second door exists because **an MCP server has no canonical name**: `service_id` is
 * whatever the person setting it up typed, and the next person will type something else. A
 * client keyed only on the exact id therefore calls a working MCP file source `⚠ Not usable`
 * and never offers it in the Library, for every server anyone ever connects.
 *
 * ⛔ **THIS IS NOT THE STRING GUESS THE HEADER ABOVE REFUSES, AND THE DIFFERENCE IS
 * TESTABLE.** The guess matched substrings of a VENDOR name and decided by itself. This
 * reads the row's own DECLARATION and still requires the SERVER to have published that
 * protocol as a family — drop `mcp` from `GET /connectors/source-families` and every row
 * below goes false with no edit here. `mcp` is a transport, the same category of word as
 * `https`; that is why `test_boundary_fence.py` tolerates it on the server too.
 *
 * ⛔ **A DICT AND NOT AN `||` CHAIN, BY THIS MODULE'S SERVER TWIN'S RECORDED INSTRUCTION** —
 * *"make the routing DATA (a dict keyed by service_id) rather than control flow"*. A second
 * protocol is a ROW here, mirroring `PROTOCOL_ADAPTERS`.
 *
 * ⚠ SAME-COMMIT SYNC: this table and `PROTOCOL_ADAPTERS` / `CONFIG_PROTOCOL_MARKERS` in
 * `backend/app/services/sources/base.py` describe the same resolution. A protocol added
 * there and not here is a source the Library silently refuses to show.
 */
const PROTOCOL_FAMILIES: Record<string, string> = { mcp: "mcp" }

/**
 * A `config` KEY that proves the row speaks a protocol, for rows written before `auth_type`
 * carried it. ⚠ Keyed off a NON-EMPTY value: an empty `source_tools` mapping declares an
 * intent nobody expressed (wave 1's `None`, never `{}`).
 */
const CONFIG_PROTOCOL_MARKERS: Record<string, string> = { source_tools: "mcp" }

/** Which transport this row speaks, or `null` — by DECLARATION, never by name-matching.
 *
 * ⛔ `mcp_server_url` IS DELIBERATELY NOT CONSULTED. The server does not read it either:
 * shipped rows carry an MCP URL with `auth_type: "static_key"` and no `source_tools`, and
 * `_protocol_of` returns `None` for every one of them. Admitting them here would print
 * `✓ Ready as source` on a row that resolves no adapter and cannot browse — TM-239-07's
 * false green, and a dead control in the Library picker.
 */
function protocolOf(c: ConnectorConnection): string | null {
  const declared = String(c.auth_type ?? "").trim().toLowerCase()
  if (declared in PROTOCOL_FAMILIES) return PROTOCOL_FAMILIES[declared]

  const config = (c.config ?? {}) as Record<string, unknown>
  for (const [marker, family] of Object.entries(CONFIG_PROTOCOL_MARKERS)) {
    const value = config[marker]
    if (value && (typeof value !== "object" || Object.keys(value).length > 0)) return family
  }
  return null
}

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
  if (families.includes((c.service_id || "").toLowerCase())) return true

  // …and only then the TRANSPORT, exactly as the server orders it: an exact `service_id`
  // always wins, so a first-party family that also carried a protocol marker keeps its own
  // adapter instead of being resolved by a generic one.
  const protocol = protocolOf(c)
  return protocol !== null && families.includes(protocol)
}
