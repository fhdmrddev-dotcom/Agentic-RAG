/**
 * Phase 221 (D-221-02 / D-221-05 / D-221-06 / D-221-09 / D-221-11) —
 * the two axes a connection's actions are read on, and the ladder they are granted on.
 *
 * ⚠ **PURE. NO JSX, NO REACT IMPORT.** Every decision this module makes is testable without
 * a DOM, which is the whole reason it exists as a leaf: `ConnectionGrantsList.tsx` was
 * 344 lines and one phase old when the six-application split was scoped, and a naive build
 * would have doubled it. G-5 could not have fired in time — one phase — so the seam was
 * argued rather than triggered, and taken here.
 *
 * ── THE TWO AXES, AND WHY THIS ORDER (D-221-02) ────────────────────────────────────────
 * **Application first, direction second.**
 *
 * Claude.ai's connector screen — the reference the operator brought — groups a connector's
 * tools purely by direction: *Interactive · 7*, *Read-only · 22*, *Write/delete · 11*. That
 * is right for Atlassian Rovo, which has ONE axis: it is a single product surface.
 *
 * Google is six products, six APIs, six OAuth scopes and **six independent failure modes**.
 * Measured 2026-08-31: three of the six were switched off in the Cloud project separately,
 * and enabled separately hours later. **Direction cannot express "Calendar is switched
 * off"; application can.** Organise on the axis the failures actually arrive on.
 *
 * ── D-221-03 · THE DIRECTION BAND GRANTS NOTHING ───────────────────────────────────────
 * ⛔ This module hands `DirectionBand` a label and a count and NOTHING ELSE, and that is a
 * safety property rather than a layout choice. The ROADMAP's rule:
 *
 *   > "The run-time gate may key on direction; the grant-time gate must NOT" —
 *   > because a read is exactly where prompt injection enters.
 *
 * Claude.ai puts a `Needs approval` control on its *Read-only · 22* group, which sets
 * twenty-two grants in one click on the one axis that rule forbids. A poisoned search
 * result is the attack; *allow all reads* is its front door. So the bulk control lives on
 * the APPLICATION, where the axis is the product.
 */

import type { McpDiscoveredTool, ToolGrantPosture } from "@/lib/api"

/** ⚠ Must equal `APPLICATION_GRANT_PREFIX` in `backend/app/services/connectors/grants.py`.
 *  Those two and `_sanitize_tool_grants`'s key check are the three places that agree; a
 *  fourth spelling is how they stop agreeing. */
export const APPLICATION_GRANT_PREFIX = "app:"

/** The `tool_grants` key an application's posture is stored under. */
export function applicationGrantKey(application: string): string {
  return `${APPLICATION_GRANT_PREFIX}${application}`
}

/**
 * ⚠ `null` means *"this connector has ONE unnamed application"* — GitHub, Jira, Notion and
 * every MCP server. It does NOT mean "unknown". The backend omits the `app` key entirely
 * for such a service rather than sending `null`, so there is exactly one absent-shape to
 * handle here and not two.
 */
export type ApplicationKey = string | null

export type Direction = "read" | "write"

export interface DirectionBandGroup {
  direction: Direction
  tools: McpDiscoveredTool[]
}

export interface ApplicationGrouping {
  key: ApplicationKey
  /** The word a person reads. Falls back to the raw key for an application the catalog
   *  has never heard of — never to an empty string, which would render a headerless group. */
  label: string
  tools: McpDiscoveredTool[]
  /**
   * ⚠ D-221-11 — `null` means **DO NOT BAND**, not "no bands happen to be needed".
   *
   * `readOnlyHint` was measured ABSENT in the wild (DeepWiki sends no `annotations` on any
   * of its three tools), and the MCP specification says an unannotated tool is to be
   * treated as destructive. Banding a set where any member's direction is unknown would
   * print a heading — *Only reads* — that is a guess about a tool the server declined to
   * describe. **Absence is not a third band; it is the absence of banding.**
   */
  bands: DirectionBandGroup[] | null
}

/** The six Google applications, in the order the specs declare them.
 *
 *  ⚠ PRESENTATION ONLY. This maps a key to a WORD; it decides nothing about routing,
 *  scope or reachability. An application missing from here still groups — it just shows
 *  its raw key — which is what keeps a new backend application from rendering nothing. */
const APPLICATION_LABELS: Record<string, string> = {
  drive: "Drive",
  gmail: "Gmail",
  sheets: "Sheets",
  docs: "Docs",
  calendar: "Calendar",
  contacts: "Contacts",
}

export function applicationLabel(key: ApplicationKey): string {
  if (!key) return ""
  return APPLICATION_LABELS[key] ?? key
}

/**
 * The direction hint, read from BOTH places it can legally live.
 *
 * ⚠ Lifted from `ConnectionGrantsList.tsx` rather than re-derived, because two resolvers
 * that disagree about the same tool is how the row and its heading come to contradict each
 * other. The top-level field is read first (flatter, more specific); the specification puts
 * the hint inside `annotations`, which is the arm that fires in practice.
 *
 * ⚠ `?? undefined`, never `?? false`: a hint nobody gave is not a hint that says no.
 */
export function directionHint(
  tool: { readOnlyHint?: boolean; annotations?: { readOnlyHint?: boolean } },
): boolean | undefined {
  return tool.readOnlyHint ?? tool.annotations?.readOnlyHint
}

function toolApplication(tool: McpDiscoveredTool): ApplicationKey {
  const raw = (tool as { app?: unknown }).app
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

/**
 * Group a connection's tools by application, then by direction.
 *
 * ⚠ **ORDER IS THE ORDER THE TOOLS ARRIVE IN**, never alphabetical. `SERVICE_TOOL_SPECS`
 * declares Google's applications in a deliberate order and `discovered_tools` preserves it,
 * so sorting here would silently overrule a decision made at the spec — and the two sides
 * would then disagree about which application is "first" with nothing reporting it.
 *
 * ⚠ **D-221-09 — a single-application connector returns exactly ONE grouping with
 * `key: null`.** That is not a special case downstream; it is what lets `apps.length === 1`
 * skip one header and lift the bands, which is the Rovo shape, from the same component.
 */
export function groupToolsByApplication(
  tools: readonly McpDiscoveredTool[],
): ApplicationGrouping[] {
  const order: ApplicationKey[] = []
  const byKey = new Map<ApplicationKey, McpDiscoveredTool[]>()

  for (const tool of tools) {
    const key = toolApplication(tool)
    if (!byKey.has(key)) {
      byKey.set(key, [])
      order.push(key)
    }
    byKey.get(key)!.push(tool)
  }

  return order.map((key) => {
    const grouped = byKey.get(key)!
    return {
      key,
      label: applicationLabel(key),
      tools: grouped,
      bands: bandsFor(grouped),
    }
  })
}

/**
 * ⚠ Returns `null` the moment ANY tool's direction is unknown — see `bands` above.
 *
 * ⚠ And it returns `null` for a set with only ONE direction too, because a lone band
 * headed *Only reads* over every action in the group is a heading that distinguishes
 * nothing. Google today is reads-only in all six applications, so this arm is the one that
 * fires until writes land; the band appears exactly when it starts carrying information.
 */
function bandsFor(tools: readonly McpDiscoveredTool[]): DirectionBandGroup[] | null {
  const reads: McpDiscoveredTool[] = []
  const writes: McpDiscoveredTool[] = []

  for (const tool of tools) {
    const hint = directionHint(tool)
    if (hint === undefined) return null
    ;(hint ? reads : writes).push(tool)
  }

  if (!reads.length || !writes.length) return null
  return [
    { direction: "read", tools: reads },
    { direction: "write", tools: writes },
  ]
}

/** Is this tool one that changes something outside? ⚠ Unknown counts as YES — the MCP
 *  spec's own instruction, and the reason the ladder's write cap fails closed. */
export function isWriteTool(tool: McpDiscoveredTool): boolean {
  return directionHint(tool) !== true
}

export type PostureSource = "action" | "application" | "connection"

/**
 * The THREE-rung ladder (D-221-05), mirroring `grants.py::resolve_effective_posture`.
 *
 * ⚠ **THIS IS A MIRROR, NOT THE GATE.** The server decides; this exists so the panel can
 * show a person what the server will decide. The two must agree arm for arm, and
 * `test_221_application_grouping.py` plus `toolGroups.test.ts` assert the same four cases
 * on each side so a drift is RED on one of them.
 *
 * ⚠ **D-221-06 — an application `allow` never arms a write.** *"Allow everything Drive
 * does"* is a sentence people say about reading; it is not consent to create, overwrite or
 * delete, and whoever set it was never shown the write it would arm. `deny` still travels:
 * the cap only ever tightens.
 */
export function resolveGroupedPosture(args: {
  toolName: string
  application: ApplicationKey
  isWrite: boolean
  grants: Record<string, ToolGrantPosture | boolean>
  connectionDefault: ToolGrantPosture
}): { posture: ToolGrantPosture; source: PostureSource } {
  const { toolName, application, isWrite, grants, connectionDefault } = args

  const action = postureOf(grants?.[toolName])
  if (action) return { posture: action, source: "action" }

  if (application) {
    const app = postureOf(grants?.[applicationGrantKey(application)])
    if (app) {
      if (isWrite && app === "allow") return { posture: "ask", source: "application" }
      return { posture: app, source: "application" }
    }
  }

  return { posture: connectionDefault || "ask", source: "connection" }
}

/** One grant VALUE -> a legal posture, or `null`.
 *
 *  ⚠ The legacy boolean arm is kept because rows written before Phase 213 still carry
 *  `true`/`false`. The server refuses those on the way IN, which does nothing about what
 *  is already stored. */
function postureOf(value: ToolGrantPosture | boolean | undefined): ToolGrantPosture | null {
  if (value === "allow" || value === "ask" || value === "deny") return value
  if (value === true) return "allow"
  if (value === false) return "deny"
  return null
}
