/**
 * Phase 221 — the grouping leaf.
 *
 * ⚠ Every fixture below is REAL SHAPE, measured 2026-08-31, not invented:
 *   · Google — the 15 specs and their six applications, from `extra_descriptors_for_service`.
 *   · GitHub — 44 discovered tools, 27 `readOnlyHint: true` / 17 false, from the live row.
 *   · DeepWiki — three tools carrying NO `annotations` at all.
 * A fixture that is prettier than production proves the code works on a world we do not ship.
 */
import { describe, expect, it } from "vitest"

import type { McpDiscoveredTool, ToolGrantPosture } from "@/lib/api"
import {
  applicationGrantKey,
  applicationLabel,
  directionHint,
  groupToolsByApplication,
  isWriteTool,
  resolveGroupedPosture,
} from "./toolGroups"

function tool(
  name: string,
  opts: { app?: string; readOnly?: boolean } = {},
): McpDiscoveredTool {
  const t: McpDiscoveredTool = { name }
  if (opts.app) (t as { app?: string }).app = opts.app
  // The server always sends `annotations.readOnlyHint` for a capability-shaped service;
  // an MCP server may send nothing, which is the DeepWiki fixture below.
  if (opts.readOnly !== undefined) t.annotations = { readOnlyHint: opts.readOnly }
  return t
}

/** The 15 Google actions in spec order, with their measured applications. */
const GOOGLE: McpDiscoveredTool[] = [
  tool("search_files", { app: "drive", readOnly: true }),
  tool("read_file", { app: "drive", readOnly: true }),
  tool("search_email", { app: "gmail", readOnly: true }),
  tool("read_email", { app: "gmail", readOnly: true }),
  tool("list_sheet_tabs", { app: "sheets", readOnly: true }),
  tool("read_sheet", { app: "sheets", readOnly: true }),
  tool("read_doc", { app: "docs", readOnly: true }),
  tool("list_calendars", { app: "calendar", readOnly: true }),
  tool("list_events", { app: "calendar", readOnly: true }),
  tool("get_event", { app: "calendar", readOnly: true }),
  tool("find_free_time", { app: "calendar", readOnly: true }),
  tool("list_labels", { app: "gmail", readOnly: true }),
  tool("read_thread", { app: "gmail", readOnly: true }),
  tool("read_attachment", { app: "gmail", readOnly: true }),
  tool("search_contacts", { app: "contacts", readOnly: true }),
]

/** GitHub's real shape: one application, 27 reads and 17 writes. */
const GITHUB: McpDiscoveredTool[] = [
  ...Array.from({ length: 27 }, (_, i) => tool(`get_thing_${i}`, { readOnly: true })),
  ...Array.from({ length: 17 }, (_, i) => tool(`create_thing_${i}`, { readOnly: false })),
]

/** DeepWiki: measured to send NO annotations on any tool. */
const DEEPWIKI: McpDiscoveredTool[] = [
  tool("read_wiki_structure"),
  tool("read_wiki_contents"),
  tool("ask_question"),
]

describe("groupToolsByApplication — the first axis", () => {
  it("splits Google into its six applications with the measured counts", () => {
    const groups = groupToolsByApplication(GOOGLE)
    expect(groups.map((g) => g.key)).toEqual([
      "drive",
      "gmail",
      "sheets",
      "docs",
      "calendar",
      "contacts",
    ])
    expect(Object.fromEntries(groups.map((g) => [g.key, g.tools.length]))).toEqual({
      drive: 2,
      gmail: 5,
      sheets: 2,
      docs: 1,
      calendar: 4,
      contacts: 1,
    })
  })

  it("keeps the order the tools ARRIVE in, never alphabetical", () => {
    // `list_labels` is the 12th spec but belongs to gmail, the 2nd application. Grouping
    // must not promote it, and must not re-sort the applications into d-c-d-g-s-s either.
    const keys = groupToolsByApplication(GOOGLE).map((g) => g.key)
    expect(keys).not.toEqual([...keys].sort())
    expect(keys[0]).toBe("drive")
  })

  it("labels every Google application, and falls back to the raw key for an unknown one", () => {
    expect(applicationLabel("drive")).toBe("Drive")
    expect(applicationLabel("calendar")).toBe("Calendar")
    // ⚠ never "" — an empty label renders a headerless group, which is worse than a slug.
    expect(applicationLabel("newthing")).toBe("newthing")
    expect(applicationLabel(null)).toBe("")
  })

  it("D-221-09: a single-product connector is ONE grouping keyed null", () => {
    const groups = groupToolsByApplication(GITHUB)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBeNull()
    expect(groups[0].tools).toHaveLength(44)
  })

  it("returns nothing for no tools rather than an empty group", () => {
    expect(groupToolsByApplication([])).toEqual([])
  })
})

describe("bands — the second axis", () => {
  it("GitHub bands into 27 reads and 17 writes", () => {
    const [github] = groupToolsByApplication(GITHUB)
    expect(github.bands).not.toBeNull()
    expect(github.bands!.map((b) => [b.direction, b.tools.length])).toEqual([
      ["read", 27],
      ["write", 17],
    ])
  })

  it("D-221-11: a connector that declares NO direction gets NO bands", () => {
    const [deepwiki] = groupToolsByApplication(DEEPWIKI)
    // ⚠ null, not []. Absence is not a third band; it is the absence of banding. An empty
    // array would render a heading over a set the server declined to describe.
    expect(deepwiki.bands).toBeNull()
  })

  it("one unknown direction suppresses the bands for the WHOLE application", () => {
    const mixed = [
      tool("a", { app: "drive", readOnly: true }),
      tool("b", { app: "drive", readOnly: false }),
      tool("c", { app: "drive" }), // no hint
    ]
    expect(groupToolsByApplication(mixed)[0].bands).toBeNull()
  })

  it("a single-direction application gets no band, because it would distinguish nothing", () => {
    // Google today is reads-only in all six. Six groups each headed "Only reads" is six
    // labels saying the same thing — the noise the 2026-08-31 audit deleted.
    for (const group of groupToolsByApplication(GOOGLE)) {
      expect(group.bands).toBeNull()
    }
  })

  it("reads the hint from BOTH legal places, and absence stays absent", () => {
    expect(directionHint({ readOnlyHint: true })).toBe(true)
    expect(directionHint({ annotations: { readOnlyHint: false } })).toBe(false)
    // ⚠ undefined, never false — a hint nobody gave is not a hint that says no.
    expect(directionHint({})).toBeUndefined()
    // the flatter spelling wins when both are present
    expect(directionHint({ readOnlyHint: true, annotations: { readOnlyHint: false } })).toBe(true)
  })

  it("an unknown direction counts as a WRITE", () => {
    expect(isWriteTool(tool("x", { readOnly: true }))).toBe(false)
    expect(isWriteTool(tool("x", { readOnly: false }))).toBe(true)
    expect(isWriteTool(tool("x"))).toBe(true) // the MCP spec's own instruction
  })
})

describe("resolveGroupedPosture — the ladder, mirroring grants.py", () => {
  const base = {
    application: "drive" as const,
    connectionDefault: "ask" as ToolGrantPosture,
  }

  it("an action grant beats an application grant", () => {
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "read_file",
        isWrite: false,
        grants: { "app:drive": "allow", read_file: "deny" },
      }),
    ).toEqual({ posture: "deny", source: "action" })
  })

  it("an application grant beats the connection default", () => {
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "search_files",
        isWrite: false,
        grants: { "app:drive": "allow" },
      }),
    ).toEqual({ posture: "allow", source: "application" })
  })

  it("falls through to the connection default", () => {
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "search_files",
        isWrite: false,
        grants: {},
      }),
    ).toEqual({ posture: "ask", source: "connection" })
  })

  it("D-221-06: an application allow NEVER arms a write", () => {
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "create_file",
        isWrite: true,
        grants: { "app:drive": "allow" },
      }),
    ).toEqual({ posture: "ask", source: "application" })
  })

  it("only an explicit action grant can allow a write", () => {
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "create_file",
        isWrite: true,
        grants: { "app:drive": "allow", create_file: "allow" },
      }),
    ).toEqual({ posture: "allow", source: "action" })
  })

  it("the cap only tightens — an application deny still denies a write", () => {
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "create_file",
        isWrite: true,
        grants: { "app:drive": "deny" },
      }).posture,
    ).toBe("deny")
  })

  it("the write cap does not touch the connection default", () => {
    // A connection-level `allow` is a separate decision with its own surface. Narrowing it
    // here would silently change every pre-221 connection.
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "create_file",
        isWrite: true,
        grants: {},
        connectionDefault: "allow",
      }),
    ).toEqual({ posture: "allow", source: "connection" })
  })

  it("an application key is inert for a connector with one unnamed application", () => {
    expect(
      resolveGroupedPosture({
        toolName: "search_code",
        application: null,
        isWrite: false,
        grants: { "app:drive": "allow" },
        connectionDefault: "ask",
      }),
    ).toEqual({ posture: "ask", source: "connection" })
  })

  it("reads legacy boolean grants, which the server refuses on the way in but not out", () => {
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "read_file",
        isWrite: false,
        grants: { read_file: true },
      }).posture,
    ).toBe("allow")
    expect(
      resolveGroupedPosture({
        ...base,
        toolName: "read_file",
        isWrite: false,
        grants: { read_file: false },
      }).posture,
    ).toBe("deny")
  })

  it("the key spelling agrees with the backend constant", () => {
    expect(applicationGrantKey("drive")).toBe("app:drive")
  })
})
