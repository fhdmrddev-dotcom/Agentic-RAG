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

import { isSourceCapable } from "../sourceCapability"
import type { ConnectorConnection } from "@/lib/api/org"

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

  it("admits a family nobody wrote a branch for — rows, not code", () => {
    // The whole point. A server that registers a new family makes it selectable here with no
    // change to this file, this predicate, or the two components that call it.
    const withMcp = [...FAMILIES, "mcp_files_acme"]
    expect(isSourceCapable(conn({ service_id: "mcp_files_acme" }), withMcp)).toBe(true)
    expect(isSourceCapable(conn({ service_id: "mcp_files_acme" }), FAMILIES)).toBe(false)
  })
})
