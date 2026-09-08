/**
 * Phase 238 (D-238-08) — the predicate that replaced a string guess.
 *
 * ⭐ THE CASE THAT MATTERS is `a service_id that LOOKS like a source is still refused when the
 * server did not register it`. Before this, two components decided with
 * `id.includes("google") || includes("workspace") || includes("drive")`, and the tempting fix
 * for SRC-03 was to append `|| includes("microsoft")`. That would have passed every test
 * anyone would think to write, shipped Phase 238, and left Phase 239's MCP file family needing
 * the identical edit — the milestone's "adding a source is rows, not code" constraint,
 * falsified on the client one phase later. The test below fails if anyone reintroduces it.
 */
import { describe, expect, it } from "vitest"

import { isSourceCapable, PROTOCOL_SERVICE_IDS } from "../sourceCapability"
import { POPULAR_SERVICES } from "@/components/settings/servicesCatalog"
import type { ConnectorConnection } from "@/lib/api/org"
// The ADAPTER's own source, through Vite's `?raw` loader — the shipped house idiom for a
// fence no rendered DOM can express. It is what makes the same-commit sync rule stated in
// `sourceCapability.ts` EXECUTABLE rather than a comment: the registrations live there.
import mcpSourceSource from "../../../../../backend/app/services/sources/adapters/mcp_source.py?raw"
// The CREATE path's own source, for the same reason: the default `service_id` is a literal
// in a `||` fallback there, and a fixture that does not match it tests a row nobody has.
import mcpAuthDoorSource from "@/components/settings/McpAuthDoor.tsx?raw"

const conn = (over: Partial<ConnectorConnection> = {}): ConnectorConnection =>
  ({
    id: "c1",
    service_id: "google",
    name: "Work Drive",
    status: "active",
    ...over,
  } as ConnectorConnection)

const FAMILIES = ["google", "google_workspace", "microsoft", "microsoft_graph"]

describe("isSourceCapable", () => {
  it("admits a family the server registered", () => {
    expect(isSourceCapable(conn({ service_id: "google" }), FAMILIES)).toBe(true)
    expect(isSourceCapable(conn({ service_id: "microsoft" }), FAMILIES)).toBe(true)
  })

  it("refuses a service_id that LOOKS like a source but was never registered", () => {
    // ⭐ The guess this replaced would have said TRUE for both of these: one contains "drive",
    // the other contains "workspace". Neither has an adapter.
    expect(isSourceCapable(conn({ service_id: "dropbox_drive" }), FAMILIES)).toBe(false)
    expect(isSourceCapable(conn({ service_id: "notion_workspace" }), FAMILIES)).toBe(false)
  })

  it("fails CLOSED while the families list is unknown", () => {
    // A connection offered and then unable to browse is a dead control a person clicks and
    // blames themselves for. `null` is "not told yet", never "allow everything".
    expect(isSourceCapable(conn({ service_id: "google" }), null)).toBe(false)
  })

  it("refuses a revoked or errored connection whatever the families say", () => {
    expect(isSourceCapable(conn({ status: "revoked" }), FAMILIES)).toBe(false)
    expect(isSourceCapable(conn({ status: "error" }), FAMILIES)).toBe(false)
  })

  it("is case-insensitive on service_id and tolerates a missing one", () => {
    expect(isSourceCapable(conn({ service_id: "MICROSOFT" }), FAMILIES)).toBe(true)
    expect(isSourceCapable(conn({ service_id: "" }), FAMILIES)).toBe(false)
  })

  // ── Phase 239 (D-239-08) — the SECOND door the server has and this predicate did not ──
  //
  // ⭐ `services/sources/base.py` resolves an adapter TWICE: an exact `service_id`, and
  // failing that the TRANSPORT the row declared (`PROTOCOL_ADAPTERS`, `auth_type: "mcp"`,
  // or a `config.source_tools` marker). An MCP server has no canonical name — `service_id`
  // is whatever the person setting it up typed — so a client keyed only on the exact id
  // calls a working file source unusable, and the Library never offers it.
  //
  // ⚠ THIS IS NOT THE GUESS THE FILE HEADER REFUSES. The guess matched SUBSTRINGS of a
  // vendor name and decided on its own; this reads the row's DECLARED protocol and still
  // requires the SERVER to have published that protocol as a family. Remove `mcp` from the
  // published list and every case below goes false.

  const MCP_FAMILIES = [...FAMILIES, "mcp", "custom_mcp"]

  it("⭐ admits a row that DECLARED the mcp transport, whatever its service_id says", () => {
    const row = conn({ service_id: "mcp.acme.internal", auth_type: "mcp" } as Partial<ConnectorConnection>)
    expect(isSourceCapable(row, MCP_FAMILIES)).toBe(true)
  })

  it("⭐ admits a row the server MARKED by config, for rows written before auth_type carried it", () => {
    // `CONFIG_PROTOCOL_MARKERS = {"source_tools": "mcp"}` — the same key, read the same way.
    const row = conn({
      service_id: "files.acme.internal",
      auth_type: "static_key",
      config: { source_tools: { list_tool: "ls", read_tool: "cat" } },
    } as Partial<ConnectorConnection>)
    expect(isSourceCapable(row, MCP_FAMILIES)).toBe(true)
  })

  it("⛔ the protocol door is CLOSED unless the server published that protocol", () => {
    // The whole point of reading the published list rather than deciding here.
    const row = conn({ service_id: "mcp.acme.internal", auth_type: "mcp" } as Partial<ConnectorConnection>)
    expect(isSourceCapable(row, FAMILIES)).toBe(false)
    expect(isSourceCapable(row, null)).toBe(false)
  })

  it("⛔ AN `mcp_server_url` ALONE IS NOT A SOURCE CLAIM — the server does not read it either", () => {
    // ⚠ THE FALSE GREEN THIS CASE EXISTS TO STOP. Plenty of shipped rows carry an MCP URL
    // with `auth_type: "static_key"` and no `source_tools` (see `connectionRowVerdict.test`
    // fixtures) — `_protocol_of` returns None for them, so the server resolves NO adapter.
    // Admitting them here would put a dead option in the Library picker and print
    // `✓ Ready as source` on a row that cannot browse: TM-239-07, exactly.
    const row = conn({
      service_id: "mcp.acme.internal",
      auth_type: "static_key",
      mcp_server_url: "https://mcp.acme.internal/mcp",
    } as Partial<ConnectorConnection>)
    expect(isSourceCapable(row, MCP_FAMILIES)).toBe(false)
  })

  it("⛔ a revoked or errored row is refused even through the protocol door", () => {
    for (const status of ["revoked", "error"] as const) {
      const row = conn({ service_id: "mcp.acme.internal", auth_type: "mcp", status } as Partial<ConnectorConnection>)
      expect(isSourceCapable(row, MCP_FAMILIES)).toBe(false)
    }
  })

  it("⛔ an EMPTY source_tools marker declares nothing — `None`, never `{}`", () => {
    // Wave 1's rule, mirrored: `CONFIG_PROTOCOL_MARKERS` keys off a NON-EMPTY value, so an
    // empty mapping must not assert an intent nobody expressed.
    const row = conn({
      service_id: "files.acme.internal",
      auth_type: "static_key",
      config: { source_tools: {} },
    } as Partial<ConnectorConnection>)
    expect(isSourceCapable(row, MCP_FAMILIES)).toBe(false)
  })

  // ── Phase 239 gap-closure round 1 (HI-01) — A DEFAULT IS NOT A CLAIM ─────────────────
  //
  // ⭐ THE DEFECT EVERY CASE ABOVE WALKED PAST. `custom_mcp` is BOTH the `service_id` every
  // by-URL MCP connection is created with (`McpAuthDoor.tsx`, `servicesCatalog.ts`) AND a
  // family the server publishes (`@SourceRegistry.register("custom_mcp")`). So the exact-id
  // arm returned `true` for EVERY such row before one byte of evidence was consulted, and a
  // never-contacted Linear / Sentry / Jira MCP server printed `✓ Ready as source` and appeared
  // in the Library's watch picker — the dead control `/source-families` exists to end.
  //
  // ⚠ AND THIS SUITE COULD NOT SEE IT, WHICH IS THE SECOND HALF OF THE FINDING. The negative
  // case above uses `service_id: "mcp.acme.internal"` — a value the product NEVER WRITES.
  // `custom_mcp` appeared here only inside `MCP_FAMILIES`, never as a row's id. A negative
  // test written around the one fixture that avoids the defect is a green that means nothing,
  // so the fixture below is DERIVED from the catalog rather than typed.

  /** The `service_id` the product ACTUALLY writes for a by-URL MCP connection. ⚠ DERIVED,
   *  never typed, and derived on `category` rather than `shape` — SEVEN of the eight popular
   *  entries carry `shape: "mcp"` (it names the FORM, not the door), so a `shape` predicate
   *  silently resolves to `github`. That mistake was made here first and this suite's own
   *  premise case caught it, which is the argument for having one. */
  const BY_URL_MCP_SERVICE_ID = POPULAR_SERVICES
    .find((e) => e.category === "custom" && e.shape === "mcp")!.serviceId

  it("⚠ THE PREMISE — the default `service_id` IS a published family, and that is the collision", () => {
    // Both halves stated as facts, because the bug is their INTERSECTION and neither alone is
    // wrong. If either stops being true this case fails and says which one.
    expect(BY_URL_MCP_SERVICE_ID).toBe("custom_mcp")
    expect(MCP_FAMILIES).toContain(BY_URL_MCP_SERVICE_ID)
    // …and it is what the CREATE PATH actually writes, not merely what a catalog row is
    // called. `McpAuthDoor` composes `service_id: draft.serviceId.trim() || "custom_mcp"`,
    // so this is the literal a person who typed no id ends up stored with.
    expect(mcpAuthDoorSource).toContain(`|| "${BY_URL_MCP_SERVICE_ID}"`)
  })

  it("⛔ HI-01 — a `custom_mcp` row with NO evidence is NOT a source, however loudly it is registered", () => {
    // The reported row, verbatim: somebody pasted a Linear MCP URL into *Custom MCP Server*.
    // Never contacted, no tools, no binding — nothing here is EVIDENCE of a file surface.
    const row = conn({
      service_id: BY_URL_MCP_SERVICE_ID,
      auth_type: "static_key",
      mcp_server_url: "https://mcp.linear.app/mcp",
      config: {},
      discovered_tools: [],
    } as Partial<ConnectorConnection>)
    expect(isSourceCapable(row, MCP_FAMILIES)).toBe(false)
  })

  it("⛔ …and the bare transport word `mcp` inherits nothing either", () => {
    // `mcp` is registered too, so a row somebody typed that id into sits in exactly the same
    // position: a transport name is not an assertion about files.
    const row = conn({ service_id: "mcp", auth_type: "static_key" } as Partial<ConnectorConnection>)
    expect(isSourceCapable(row, MCP_FAMILIES)).toBe(false)
  })

  it("⭐ THE FIX CONSULTS EVIDENCE — the SAME id with a declaration or a binding IS a source", () => {
    // ⚠ THE CASE THAT SEPARATES A FIX FROM A DENY-LIST. Refusing the NAME `custom_mcp`
    // outright would break every real MCP file source the product ships — the over-correction
    // one direction over from the defect, and the shape `connectionRowVerdict`'s own header
    // records itself having shipped once already.
    const declared = conn({
      service_id: BY_URL_MCP_SERVICE_ID,
      auth_type: "mcp",
    } as Partial<ConnectorConnection>)
    expect(isSourceCapable(declared, MCP_FAMILIES)).toBe(true)

    const bound = conn({
      service_id: BY_URL_MCP_SERVICE_ID,
      auth_type: "static_key",
      config: { source_tools: { list_tool: "ls", read_tool: "cat" } },
    } as Partial<ConnectorConnection>)
    expect(isSourceCapable(bound, MCP_FAMILIES)).toBe(true)
  })

  it("⛔ a VENDOR family still resolves by name — the narrowing is protocol ids ONLY", () => {
    // The containment claim. `google` / `microsoft_graph` name a SERVICE whose file surface
    // the adapter knows; they carry no `auth_type` and no binding, and must stay capable.
    expect(isSourceCapable(conn({ service_id: "google" }), MCP_FAMILIES)).toBe(true)
    expect(isSourceCapable(conn({ service_id: "microsoft_graph" }), MCP_FAMILIES)).toBe(true)
  })

  it("⚠ SAME-COMMIT SYNC — every id the MCP adapter registers is a PROTOCOL id here", () => {
    // ⛔ THE COMMENT THAT CARRIED THIS RULE COULD NOT FIRE. `mcp_source.py` gaining a third
    // alias would silently re-open HI-01 for that alias, exactly as `custom_mcp` did.
    const registered = [...mcpSourceSource.matchAll(/@SourceRegistry\.register\("([^"]+)"\)/g)]
      .map((m) => m[1])
    // NON-VACUITY CONTROL — a `?raw` import resolving to "" would satisfy the loop below.
    expect(registered).toContain("mcp")
    expect(registered.length).toBeGreaterThanOrEqual(2)
    for (const id of registered) {
      expect(Object.keys(PROTOCOL_SERVICE_IDS)).toContain(id)
    }
  })

  it("admits a family nobody wrote a branch for — rows, not code", () => {
    // The whole point. A server that registers a new family makes it selectable here with no
    // change to this file, this predicate, or the two components that call it.
    const withMcp = [...FAMILIES, "mcp_files_acme"]
    expect(isSourceCapable(conn({ service_id: "mcp_files_acme" }), withMcp)).toBe(true)
    expect(isSourceCapable(conn({ service_id: "mcp_files_acme" }), FAMILIES)).toBe(false)
  })
})
