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

  it("admits a family nobody wrote a branch for — rows, not code", () => {
    // The whole point. A server that registers a new family makes it selectable here with no
    // change to this file, this predicate, or the two components that call it.
    const withMcp = [...FAMILIES, "mcp_files_acme"]
    expect(isSourceCapable(conn({ service_id: "mcp_files_acme" }), withMcp)).toBe(true)
    expect(isSourceCapable(conn({ service_id: "mcp_files_acme" }), FAMILIES)).toBe(false)
  })
})
