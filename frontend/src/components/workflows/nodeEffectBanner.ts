/**
 * Phase 200 (canvas port) / Phase 209 (Item 2 · D-209-02) — THE EFFECT BANNER.
 *
 * `screens/builder-canvas.html` draws it verbatim:
 *
 *   CHANGES SOMETHING OUTSIDE   · 9px, bold, wide-tracked, in the warning tone
 *   ONLY READS                  · the same shape, in the dim tone
 *
 * ── MECHANISM: EXPLICIT ANNOTATION ONLY, FAIL CLOSED ──
 *
 * Phase 200 declined `ONLY READS` because capabilities on the wire were exclusively
 * writes (`send_email`, `create_ticket`, `post_message`). Phase 206 added MCP steps
 * (`tool_name`, `available_tools`), where tools like `read_wiki_structure` or `get_issues`
 * only read information.
 *
 * Phase 209 resolves the banner direction — but the mechanism is NOT tool-name inspection.
 * MCP imposes no constraint on tool naming: `get_user_and_purge_records` would pass a
 * `get_` prefix check while it deletes. The ONLY safe signal is the MCP-spec `annotations`
 * field that a tool server explicitly opts into.
 *
 * RESOLUTION (operator ruling, 2026-08-26, `.planning/209-HANDOFF.md`):
 *  1. `readOnlyHint === true`: explicit server annotation → `ONLY READS`.
 *  2. All other `external_action` steps (absent, `false`, or malformed) → `CHANGES SOMETHING OUTSIDE`.
 *  3. Non-`external_action` phase types → `null` (no banner).
 *
 * FAIL CLOSED: an absent hint is NOT a read signal. It keeps `CHANGES SOMETHING OUTSIDE`.
 *
 * WIRE: the `readOnlyHint` reaches the frontend via `mcp_client.py`'s sanitizer, which
 * now forwards the `annotations` object from the MCP `tools/list` response into the stored
 * tool schema. A tool server that does not set annotations has an absent hint; this resolves
 * to `CHANGES SOMETHING OUTSIDE`, which is correct.
 *
 * ⚠ DeepWiki ships NO annotations on any of its 3 tools — it can only demonstrate the
 * absent-hint arm (`CHANGES SOMETHING OUTSIDE`). The `ONLY READS` arm requires a tool server
 * that actually sets `readOnlyHint: true`. This is a measured fact, not a gap:
 * `.planning/209-HANDOFF.md` records it explicitly.
 *
 * A TRUE LEAF: imports nothing at all.
 */

/** The one type that reaches beyond this workspace. Spelled once. */
const EXTERNAL_ACTION_PHASE_TYPE = "external_action"

/**
 * The write banner: warns that this step mutates or alters state outside the workspace.
 * Rendered in the warning tone (`text-warning`).
 */
export const EFFECT_BANNER_OUTSIDE = "CHANGES SOMETHING OUTSIDE"

/**
 * The read-only banner: indicates that this step only inspects or retrieves data.
 * Rendered in the dim tone (`text-muted-foreground`).
 *
 * Only emitted on an explicit `readOnlyHint === true` from the MCP tool annotations.
 * See module docblock for why tool-name inference is rejected.
 */
export const EFFECT_BANNER_READ_ONLY = "ONLY READS"

/**
 * Does this external action config represent a read-only tool?
 *
 * Returns `true` ONLY on an explicit `readOnlyHint === true` in the config.
 * Absent, `false`, or any other value returns `false` (fail closed).
 *
 * Total over nullish/malformed configs.
 */
export function isReadOnlyExternalAction(config?: Record<string, unknown> | null): boolean {
  if (!config || typeof config !== "object") return false
  return config.readOnlyHint === true
}

/**
 * TOTAL over every phase type and config:
 *  - Non-`external_action` types → `null` (no banner rendered).
 *  - `external_action` with explicit `readOnlyHint === true` → `EFFECT_BANNER_READ_ONLY` ("ONLY READS").
 *  - All other `external_action` steps (absent, false, or malformed hint) → `EFFECT_BANNER_OUTSIDE`.
 */
export function effectBannerFor(
  phaseType: string,
  config?: Record<string, unknown> | null,
): string | null {
  if (phaseType !== EXTERNAL_ACTION_PHASE_TYPE) return null
  if (isReadOnlyExternalAction(config)) return EFFECT_BANNER_READ_ONLY
  return EFFECT_BANNER_OUTSIDE
}
