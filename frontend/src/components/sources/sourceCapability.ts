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

/**
 * Phase 239 gap-closure round 1 (HI-01) — SERVICE IDS THAT NAME A TRANSPORT, NOT A VENDOR.
 *
 * ⭐ **`custom_mcp` IS THE DEFAULT `service_id` FOR EVERY BY-URL MCP CONNECTION *AND* A
 * FAMILY THE SERVER REGISTERS, AND THAT COLLISION WAS THE DEFECT.** `McpAuthDoor` composes
 * `service_id: draft.serviceId.trim() || "custom_mcp"`, and `mcp_source.py` carries
 * `@SourceRegistry.register("custom_mcp")` beside `@SourceRegistry.register("mcp")` — so
 * `GET /connectors/source-families` publishes `custom_mcp`, the exact-id arm below matched
 * it, and **every** row created through that door was called a source before one byte of
 * evidence was read. A Linear MCP server nobody had ever contacted printed
 * `✓ Ready as source` and appeared in `CreateWatchModal`, which is TM-239-07 exactly.
 *
 * ⛔ **THE NARROWING IS THE ID, NEVER THE ROW.** A `custom_mcp` row that DECLARED the
 * transport (`auth_type: "mcp"`) or carries a `source_tools` binding is still a source —
 * it just has to reach that verdict through the evidence doors below rather than inherit it
 * from a word. Refusing the name outright would silence every MCP file source the product
 * ships, which is the over-correction `connectionRowVerdict`'s header records shipping once.
 *
 * ⚠ SAME-COMMIT SYNC, AND IT IS EXECUTABLE NOW. `sourceCapability.test.ts` reads every
 * `@SourceRegistry.register("…")` out of `mcp_source.py` through `?raw` and requires each to
 * appear as a key here — because the version of this rule that was only a comment is what
 * let `custom_mcp` through.
 */
export const PROTOCOL_SERVICE_IDS: Record<string, string> = { mcp: "mcp", custom_mcp: "mcp" }

/** Which transport this row speaks, or `null` — by DECLARATION, never by name-matching.
 *
 * ⛔ `mcp_server_url` IS DELIBERATELY NOT CONSULTED, and the reason is narrower than this
 * comment used to claim. It said the server *"resolves no adapter for them"*, and that was
 * **refuted by driving the shipped registry** (review LO-01, re-driven at this fix):
 *
 *     {service_id: "custom_mcp", auth_type: "static_key", config: {}}
 *       _protocol_of  -> None
 *       get_adapter   -> <McpSourceAdapter>      ⛔ resolved by the EXACT-KEY arm
 *
 * So `_protocol_of` returning `None` is true, and the conclusion drawn from it was not.
 * This client is deliberately STRICTER than that arm: a URL somebody pasted is a
 * destination, not a statement that the server has files. Admitting it would print
 * `✓ Ready as source` on a row whose first browse is a 502 — a dead control in the Library
 * picker, which is the thing the `/source-families` route exists to end.
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

  // The exact `service_id`, exactly as the server orders it — EXCEPT when that id is a
  // TRANSPORT WORD rather than a vendor. ⛔ HI-01: `custom_mcp` is the default id for every
  // by-URL MCP connection, so inheriting capability from it asserts a file surface for a row
  // nobody has contacted. A transport-named row must PROVE it below; a vendor-named one is
  // still a family the adapter knows by name and needs no declaration.
  const id = (c.service_id || "").toLowerCase()
  if (!(id in PROTOCOL_SERVICE_IDS) && families.includes(id)) return true

  // …and only then the TRANSPORT the row DECLARED. A first-party family that also carried a
  // protocol marker kept its own adapter above, so this arm can only widen to rows that
  // said something about themselves: `auth_type: "mcp"`, or a non-empty `source_tools`.
  const protocol = protocolOf(c)
  return protocol !== null && families.includes(protocol)
}
