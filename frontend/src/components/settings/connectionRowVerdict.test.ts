/**
 * Phase 221 (D-221-12) — the row verdict.
 *
 * ⚠ The case that matters is `{ toolCount: 0 }`. Microsoft 365 read `✓ Ready` with zero
 * actions on this box for days, and no test could catch it because the verdict was an
 * `auth_type`/`status` check with no idea what the connection could actually DO.
 */
import { describe, expect, it } from "vitest"

import type { ConnectorConnection } from "@/lib/api"
import { connectionRowVerdict } from "./connectionRowVerdict"
import {
  CONNECTION_STATE_PARTLY,
  CONNECTION_STATE_PARTLY_COUNTED,
  CONNECTION_STATE_UNUSABLE,
  CONNECTION_STATE_WORDS,
  connectionStateOf,
} from "./connectionsCopy"

describe("connectionRowVerdict", () => {
  it("a connection with actions and nothing blocked is ready", () => {
    expect(connectionRowVerdict({ toolCount: 15, blockedApplicationCount: 0 })).toBe("ready")
  })

  it("a connection with some applications blocked is partly ready", () => {
    expect(connectionRowVerdict({ toolCount: 15, blockedApplicationCount: 3 })).toBe("partly")
  })

  it("⭐ zero actions AND a check that ran is unusable — the Microsoft 365 case", () => {
    expect(
      connectionRowVerdict({ toolCount: 0, blockedApplicationCount: 0, discoveryHasRun: true }),
    ).toBe("unusable")
  })

  it("⚠ zero actions and NO check is `undiscovered`, not `unusable` — AR-03", () => {
    // An empty discovery is not evidence. A row nobody has looked at is indistinguishable
    // from a row looked at and found barren, and asserting the second is the same error as
    // asserting `Ready` — pointed the other way.
    expect(connectionRowVerdict({ toolCount: 0, blockedApplicationCount: 0 })).toBe(
      "undiscovered",
    )
  })

  it("a zero-action verdict is reached FIRST, because zero actions means zero blocked too", () => {
    // ⚠ Order is the fix. "blocked === 0 therefore ready" is precisely the reasoning that
    // let a row with nothing in it claim Ready — *nothing is broken* and *nothing works*
    // are different facts.
    expect(connectionRowVerdict({ toolCount: 0, blockedApplicationCount: 0 })).not.toBe("ready")
  })

  it("a negative or absent count is treated as none rather than as some", () => {
    expect(connectionRowVerdict({ toolCount: -1, blockedApplicationCount: 0 })).toBe(
      "undiscovered",
    )
    expect(
      connectionRowVerdict({ toolCount: -1, blockedApplicationCount: 0, discoveryHasRun: true }),
    ).toBe("unusable")
  })
})

function connection(over: Partial<ConnectorConnection>): ConnectorConnection {
  return {
    id: "c1",
    org_id: "o1",
    service_id: "microsoft",
    name: "Microsoft 365",
    config: {},
    is_enabled: true,
    status: "active",
    auth_type: "oauth_byo",
    discovered_tools: [],
    ...over,
  } as ConnectorConnection
}

describe("connectionStateOf — D-221-12 in the shipped resolver", () => {
  it("⭐ an oauth row that connected and discovered nothing is NOT ready", () => {
    // The live Microsoft 365 row: oauth_byo, active, zero actions, never checked.
    expect(connectionStateOf(connection({}))).toBe("not_checked")
  })

  it("...and once a check HAS run and still found nothing, it is unusable", () => {
    const state = connectionStateOf(connection({ last_check_verdict: "ok" }))
    expect(state).toBe("unusable")
    expect(CONNECTION_STATE_WORDS[state]).toBe(CONNECTION_STATE_UNUSABLE)
  })

  it("⛔ a CAPABILITY row with an empty discovery is untouched — it is not an oauth row", () => {
    // ⚠ THE REGRESSION THREE BYTE-FOR-BYTE ROW PINS CAUGHT. `discovered_tools` is a
    // presentation cache; a capability row's actions come from SERVICE_TOOL_SPECS and the
    // executor never reads that column. Marking these `Not usable` would have called three
    // working connections broken.
    for (const service of ["smtp", "slack", "jira"]) {
      expect(
        connectionStateOf(
          connection({
            service_id: service,
            auth_type: "static_key",
            capability: "send_email",
            last_check_verdict: "ok",
            discovered_tools: [],
          }),
        ),
      ).toBe("ready")
    }
  })

  it("the same row WITH actions is ready", () => {
    expect(
      connectionStateOf(connection({ discovered_tools: [{ name: "search_files" }] })),
    ).toBe("ready")
  })

  it("disabled and revoked still win — they say something more specific about why", () => {
    expect(connectionStateOf(connection({ is_enabled: false }))).toBe("disabled")
    expect(connectionStateOf(connection({ status: "revoked" }))).toBe("revoked")
  })

  it("a capability row with actions and an ok check is still ready", () => {
    expect(
      connectionStateOf(
        connection({
          service_id: "slack",
          auth_type: "static_key",
          capability: "post_message",
          last_check_verdict: "ok",
          discovered_tools: [{ name: "post_message" }],
        }),
      ),
    ).toBe("ready")
  })

  it("an MCP row with an empty discovery still reads Not checked — AR-03 holds", () => {
    expect(
      connectionStateOf(
        connection({
          service_id: "mcp.example.com",
          auth_type: "static_key",
          mcp_server_url: "https://mcp.example.com/mcp",
          discovered_tools: [],
        }),
      ),
    ).toBe("not_checked")
  })

  // ── Phase 221 plan 02 (D-221-12) — `partly` stops being unreachable ─────────────────
  //
  // ⚠ Until plan 02 the second argument did not exist and `blockedApplicationCount` was
  // the literal 0, so `⚠ Partly ready` was unreachable BY CONSTRUCTION. These are the
  // tests that would have had nothing to assert.

  it("⭐ three blocked applications reads `partly`, and names three", () => {
    const state = connectionStateOf(
      connection({ service_id: "google", discovered_tools: [{ name: "search_files" }], last_check_verdict: "ok" }),
      3,
    )
    expect(state).toBe("partly")
    expect(CONNECTION_STATE_WORDS[state]).toBe(CONNECTION_STATE_PARTLY)
  })

  it("zero blocked applications reads `ready`, not `partly`", () => {
    expect(
      connectionStateOf(
        connection({ service_id: "google", discovered_tools: [{ name: "search_files" }], last_check_verdict: "ok" }),
        0,
      ),
    ).toBe("ready")
  })

  it("⚠ an ABSENT count reads `ready`, never `partly` — nobody looked", () => {
    // Availability is a MEASUREMENT. On a fresh page load nothing has been checked, and
    // inventing `Partly ready` from no evidence is the same error as `Ready` from no
    // evidence, pointed the other way.
    expect(
      connectionStateOf(
        connection({ service_id: "google", discovered_tools: [{ name: "search_files" }], last_check_verdict: "ok" }),
      ),
    ).toBe("ready")
  })

  it("⛔ a blocked count NEVER rescues a zero-action row from `unusable`", () => {
    // The tool-count arm runs FIRST and must keep doing so: a connection with no actions
    // at all is not "partly" anything.
    expect(connectionStateOf(connection({ last_check_verdict: "ok" }), 2)).toBe("unusable")
  })

  it("⛔ a DISABLED row stays disabled whatever the availability says", () => {
    expect(
      connectionStateOf(
        connection({ is_enabled: false, discovered_tools: [{ name: "x" }] }),
        3,
      ),
    ).toBe("disabled")
  })

  it("⭐ the counted sentence is acceptance #6, verbatim", () => {
    // ⚠ The COUNT is the actionable half — `Partly ready` alone says something is wrong and
    // nothing about how much. Asserted by character identity so it cannot drift.
    expect(CONNECTION_STATE_PARTLY_COUNTED(3)).toBe("⚠ Partly ready · 3 need attention")
  })

  it("one blocked application says `needs`, not `need`", () => {
    expect(CONNECTION_STATE_PARTLY_COUNTED(1)).toBe("⚠ Partly ready · 1 needs attention")
  })

  it("the counted sentence always contains the bare word — one source, not two", () => {
    for (const n of [1, 2, 6]) {
      expect(CONNECTION_STATE_PARTLY_COUNTED(n)).toContain(CONNECTION_STATE_PARTLY)
    }
  })

  it("every state kind has a word — the closed union stays covered", () => {
    for (const kind of ["ready", "partly", "unusable", "not_checked", "failed", "disabled", "revoked"] as const) {
      expect(CONNECTION_STATE_WORDS[kind]).toBeTruthy()
    }
  })
})
