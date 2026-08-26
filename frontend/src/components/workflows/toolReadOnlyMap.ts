/**
 * Phase 209 (Item 2 · SC#2) — build the `connection id → tool name → readOnlyHint` lookup the
 * effect banner resolves against.
 *
 * ── WHY THIS IS A MODULE AND NOT FOUR LINES IN A `useEffect` ────────────────────────────────
 * The mapping carries the phase's only real judgement — *which tools contribute a key at all* —
 * and that judgement is a safety property, not a formatting choice. Inline in a mount effect it
 * would be reachable only by mounting the whole Builder page, which is the same
 * fixture-supplies-what-the-pipeline-does-not trap this phase already shipped once.
 *
 * ── THE RULE, AND WHY `false` AND *ABSENT* ARE NOT THE SAME THING ───────────────────────────
 * ONLY an explicit boolean is recorded. A tool whose server sent no `annotations`, or an
 * `annotations` object carrying no `readOnlyHint`, contributes **no key**.
 *
 * Today a missing key and a stored `false` render identically — both fail closed to
 * `CHANGES SOMETHING OUTSIDE`. They are still kept apart, because they are different FACTS:
 * `false` is *the server said this writes*, absent is *the server said nothing*. The MCP
 * specification treats an unannotated tool as destructive, so the day anything else reads this
 * map — a filter, a warning, a catalog column — a fabricated `false` would be a claim no server
 * ever made. `runFacts.ts`'s four-arm correction is the same lesson in this repo already.
 *
 * ⚠ AND NEVER, EVER FROM THE TOOL'S NAME. This phase's first draft decided read-ness with
 * `/^(read|get|list|search|…)/i` over `tool_name`. MCP does not constrain tool naming, so
 * `get_user_and_purge_records` matched and rendered `ONLY READS` while it deleted. There is no
 * name inspection in this module and there must never be one.
 */
import type { ConnectorConnection } from "@/lib/api"

/** connection id → tool name → the server's own `readOnlyHint`. */
export type ToolReadOnlyMap = Readonly<Record<string, Readonly<Record<string, boolean>>>>

/**
 * TOTAL over any input — a malformed connection, a malformed tool, a missing list and a
 * non-array all yield an empty map rather than throwing. This runs in a mount effect whose
 * `catch` is deliberately non-fatal, so a throw here would silently blank every face on the
 * canvas rather than surfacing anything.
 *
 * A connection contributing no hints gets NO entry at all, so `Object.keys(map).length` is a
 * meaningful count of *connections that declared something* rather than of connections seen.
 */
export function buildToolReadOnlyMap(
  connections: readonly ConnectorConnection[] | null | undefined,
): ToolReadOnlyMap {
  const out: Record<string, Record<string, boolean>> = {}
  if (!Array.isArray(connections)) return out

  for (const connection of connections) {
    const id = connection?.id
    if (typeof id !== "string" || id.trim().length === 0) continue

    const tools = connection.discovered_tools
    if (!Array.isArray(tools)) continue

    const perTool: Record<string, boolean> = {}
    for (const tool of tools) {
      const name = typeof tool?.name === "string" ? tool.name.trim() : ""
      if (name.length === 0) continue
      // The whole rule, in one line: an explicit boolean, or nothing.
      const hint = tool?.annotations?.readOnlyHint
      if (typeof hint === "boolean") perTool[name] = hint
    }

    if (Object.keys(perTool).length > 0) out[id.trim()] = perTool
  }

  return out
}
