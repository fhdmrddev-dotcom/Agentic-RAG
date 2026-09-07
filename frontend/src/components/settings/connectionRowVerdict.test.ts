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
import { isSourceCapable } from "@/components/sources/sourceCapability"
import {
  CONNECTION_STATE_PARTLY,
  CONNECTION_STATE_PARTLY_COUNTED,
  CONNECTION_STATE_SOURCE_ONLY,
  CONNECTION_STATE_UNUSABLE,
  CONNECTION_STATE_WORDS,
  connectionStateOf,
} from "./connectionsCopy"

/** The families `GET /connectors/source-families` publishes at Phase 239, measured in
 *  `239-02-SUMMARY.md` §F-1 rather than invented here. `mock_source` is excluded by the
 *  route; `mcp` is the PROTOCOL key and `custom_mcp` the by-URL service id. */
const FAMILIES = [
  "custom_mcp",
  "google",
  "google_workspace",
  "mcp",
  "microsoft",
  "microsoft_graph",
]

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

  // ── Phase 239 (D-239-08 / BUG-260907-01) — zero ACTIONS is not zero USES ─────────────
  //
  // ⚠ The input set went incomplete rather than the logic going wrong. Everything above is
  // still right about ACTIONS; Phase 238 created a class of connection that has none and
  // works — a file SOURCE. `isSourceCapable` is the fourth input, and it is the SERVER's
  // answer (`GET /connectors/source-families` + the row's declared protocol), never a guess
  // made here.

  it("⭐ zero actions AND source-capable is `source-only` — the OneDrive row, BUG-260907-01", () => {
    // Measured on the live row the bug reports: `service_id=microsoft · status=active ·
    // is_enabled=True · last_check_verdict=ok · discovered_tools=[]`, while `browse()`
    // returned 6 real folders and `read_file()` returned 1395 correct bytes.
    expect(
      connectionRowVerdict({
        toolCount: 0,
        blockedApplicationCount: 0,
        discoveryHasRun: true,
        isSourceCapable: true,
      }),
    ).toBe("source-only")
  })

  it("...and it holds BEFORE any check has run — the first screen after the OAuth round trip", () => {
    // ⚠ This is deliberately NOT the AR-03 case, and the difference is what it CLAIMS. `✓
    // Ready` asserts actions exist, which an empty discovery cannot evidence. `✓ Ready as
    // source` asserts an ADAPTER exists for this family and the credential is not revoked —
    // two facts we hold from the registry and the row, not an absence read as success.
    expect(
      connectionRowVerdict({ toolCount: 0, blockedApplicationCount: 0, isSourceCapable: true }),
    ).toBe("source-only")
  })

  it("⛔ NOT source-capable keeps today's split exactly — nothing else moves", () => {
    expect(
      connectionRowVerdict({
        toolCount: 0,
        blockedApplicationCount: 0,
        discoveryHasRun: true,
        isSourceCapable: false,
      }),
    ).toBe("unusable")
    expect(
      connectionRowVerdict({ toolCount: 0, blockedApplicationCount: 0, isSourceCapable: false }),
    ).toBe("undiscovered")
  })

  it("⛔ an ABSENT `isSourceCapable` reads as NOT capable — the fail-closed default", () => {
    // TM-239-07. The families list arrives over the network; while it is unknown every
    // caller passes nothing, and a default of `true` would make the loading state a green
    // claim on every row in the table.
    expect(
      connectionRowVerdict({ toolCount: 0, blockedApplicationCount: 0, discoveryHasRun: true }),
    ).toBe("unusable")
  })

  it("⛔ source capability NEVER upgrades or downgrades a row that HAS actions", () => {
    expect(
      connectionRowVerdict({ toolCount: 5, blockedApplicationCount: 0, isSourceCapable: true }),
    ).toBe("ready")
    expect(
      connectionRowVerdict({ toolCount: 5, blockedApplicationCount: 3, isSourceCapable: true }),
    ).toBe("partly")
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
    for (const kind of [
      "ready",
      "source_only",
      "partly",
      "unusable",
      "not_checked",
      "failed",
      "disabled",
      "revoked",
    ] as const) {
      expect(CONNECTION_STATE_WORDS[kind]).toBeTruthy()
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════════════
  // Phase 239 (D-239-08 / BUG-260907-01) — the row that works and says it does not
  //
  // ⚠ EVERY CASE BELOW COMPOSES THE REAL `isSourceCapable` OVER THE REAL FAMILIES LIST
  // rather than passing a hand-picked boolean. The defect is a MISSING INPUT, so a suite
  // that supplies the input by hand tests the half that was never broken.
  // ═══════════════════════════════════════════════════════════════════════════════════

  const capable = (c: ConnectorConnection, families: string[] | null = FAMILIES) =>
    connectionStateOf(c, undefined, isSourceCapable(c, families))

  it("⭐ THE BUG: the live OneDrive row reads `✓ Ready as source`, not `⚠ Not usable`", () => {
    const row = connection({
      service_id: "microsoft",
      name: "Microsoft 365",
      auth_type: "oauth_byo",
      status: "active",
      discovered_tools: [],
      last_check_verdict: "ok",
    })
    // Before this phase: `unusable`. The connection browsed 6 folders the same session.
    expect(capable(row)).toBe("source_only")
    expect(CONNECTION_STATE_WORDS[capable(row)]).toBe("✓ Ready as source")
    expect(CONNECTION_STATE_WORDS[capable(row)]).not.toBe(CONNECTION_STATE_UNUSABLE)
  })

  it("⭐ the word is the deliverable, and it is asserted by character identity", () => {
    // Phase 235's lesson: a presence assertion cannot see content drift, and the WORDS on
    // this row are what the bug is about.
    expect(CONNECTION_STATE_SOURCE_ONLY).toBe("✓ Ready as source")
    expect(CONNECTION_STATE_WORDS.source_only).toBe(CONNECTION_STATE_SOURCE_ONLY)
  })

  it("⭐ an MCP file server resolves by PROTOCOL — its service_id is whatever someone typed", () => {
    // The server resolves this row through `PROTOCOL_ADAPTERS` (`base.py`), because an MCP
    // server has no canonical name. A client keyed only on `service_id` would call a working
    // file source unusable for the whole of Phase 239.
    const row = connection({
      service_id: "mcp.acme.internal",
      name: "Acme files",
      auth_type: "mcp",
      mcp_server_url: "https://mcp.acme.internal/mcp",
      status: "active",
      discovered_tools: [],
      last_check_verdict: "ok",
    })
    expect(capable(row)).toBe("source_only")
  })

  it("⛔ TM-239-07 — a REVOKED source-capable row says revoked, never `Ready as source`", () => {
    const row = connection({ service_id: "microsoft", status: "revoked", discovered_tools: [] })
    expect(capable(row)).toBe("revoked")
  })

  it("⛔ TM-239-07 — a DISABLED source-capable row says disabled", () => {
    const row = connection({
      service_id: "microsoft",
      is_enabled: false,
      last_check_verdict: "ok",
      discovered_tools: [],
    })
    expect(capable(row)).toBe("disabled")
  })

  it("⛔ TM-239-07 — an ERRORED source-capable row never claims it", () => {
    const row = connection({
      service_id: "microsoft",
      status: "error",
      last_check_verdict: "ok",
      discovered_tools: [],
    })
    expect(capable(row)).not.toBe("source_only")
  })

  it("⛔ TM-239-07 — while the families list is UNKNOWN the row keeps its old, honest word", () => {
    // `null` is "we have not been told". A green manufactured out of a pending fetch is the
    // exact false positive this threat names.
    const row = connection({
      service_id: "microsoft",
      last_check_verdict: "ok",
      discovered_tools: [],
    })
    expect(capable(row, null)).toBe("unusable")
  })

  it("⛔ a service_id the server never registered NEVER claims `Ready as source`", () => {
    // ⚠ It reads `✓ Ready` today, from the generic `last_check_verdict === "ok"` fallback,
    // and that is a SEPARATE over-claim on the static_key arm that Phase 221 closed only for
    // `oauth_byo`. Out of scope here and reported rather than silently widened — what this
    // case guards is that the NEW word cannot be reached by a row with no adapter.
    const row = connection({
      service_id: "dropbox_drive",
      auth_type: "static_key",
      last_check_verdict: "ok",
      discovered_tools: [],
    })
    expect(isSourceCapable(row, FAMILIES)).toBe(false)
    expect(capable(row)).not.toBe("source_only")
  })

  it("⛔ the three CAPABILITY rows are untouched when the real predicate is composed", () => {
    // The regression three byte-for-byte row pins caught in Phase 221, re-driven through the
    // new input: none of these families is registered as a source, so none can reach the new
    // arm at any tool count.
    for (const service of ["smtp", "slack", "jira"]) {
      const row = connection({
        service_id: service,
        auth_type: "static_key",
        capability: "send_email",
        last_check_verdict: "ok",
        discovered_tools: [],
      })
      expect(isSourceCapable(row, FAMILIES)).toBe(false)
      expect(capable(row)).toBe("ready")
    }
  })

  it("⛔ a source-capable row WITH actions still reads `✓ Ready` — not demoted", () => {
    const row = connection({
      service_id: "google_workspace",
      last_check_verdict: "ok",
      discovered_tools: [{ name: "search_files" }],
    })
    expect(capable(row)).toBe("ready")
  })
})
