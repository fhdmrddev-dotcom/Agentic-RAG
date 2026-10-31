/**
 * Phase 304-05 (D-08, D-11, D-12, D-22, D-23) — the pure rules of an MCP key: presets ↔ tools,
 * companion tools, the folder tree with subtree inclusion, the card's scope model and the Create
 * key blocker.
 *
 * PURE: no React, no fetch, and it spells NO copy. It returns keys and values; the components
 * (and `apiKeyFacts.ts`) map them through `MCP_KEY_COPY`.
 *
 * ⚠ THE CATALOGUE IS THE SERVER'S (D-11). Every preset is derived from the `McpToolRef` list the
 *   server sends on `GET /api-keys`; nothing here names a tool. A renamed or added tool changes the
 *   presets with no client edit.
 */
import type { ApiKeyFolderRef, McpToolRef, PickableFolder } from "@/lib/api/apiKeys"

export type McpPreset = "read" | "ask" | "run"
export type McpPresetChoice = McpPreset | "custom"
export const MCP_PRESETS: readonly McpPreset[] = ["read", "ask", "run"]
export const MCP_PRESET_CHOICES: readonly McpPresetChoice[] = ["read", "ask", "run", "custom"]
export const MCP_GROUPS: readonly McpToolRef["group"][] = ["read", "ask", "run"]

const PRESET_GROUPS: Record<McpPreset, readonly McpToolRef["group"][]> = {
  read: ["read"],
  ask: ["read", "ask"],
  run: ["read", "ask", "run"],
}

/** The preset's tools, in catalogue order. */
export function toolsForPreset(preset: McpPreset, catalogue: readonly McpToolRef[]): string[] {
  const groups = PRESET_GROUPS[preset]
  return catalogue.filter((t) => groups.includes(t.group)).map((t) => t.name)
}

/** D-12: each present lead brings its companions; a companion never stays without its lead; an
 *  unknown name is dropped. Catalogue order. */
export function withCompanions(tools: readonly string[], catalogue: readonly McpToolRef[]): string[] {
  const picked = new Set(tools)
  return catalogue
    .filter((t) => (t.travels_with ? picked.has(t.travels_with) : picked.has(t.name)))
    .map((t) => t.name)
}

/** The lead a tool travels with, or null when it is chosen on its own. */
export function companionLead(name: string, catalogue: readonly McpToolRef[]): string | null {
  return catalogue.find((t) => t.name === name)?.travels_with ?? null
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

/** The preset whose tool set equals `tools`, else `custom` (an empty set is never a preset). */
export function presetFor(tools: readonly string[], catalogue: readonly McpToolRef[]): McpPresetChoice {
  if (tools.length === 0) return "custom"
  for (const p of MCP_PRESETS) {
    const set = toolsForPreset(p, catalogue)
    if (set.length > 0 && sameSet(set, tools)) return p
  }
  return "custom"
}

// ── the folder tree ───────────────────────────────────────────────────────────────────────────

export interface FolderRow {
  folder: PickableFolder
  depth: number
  /** `Root / Child / This`, for the row's `title` once the indent stops growing. */
  path: string
  /** Ticked by the member, or inside a ticked folder's subtree. */
  checked: boolean
  /** Inside a ticked ancestor's subtree: checked, and not the member's own choice here. */
  included: boolean
}

/** The member's folders nested by `parent_id`, each level by name (the `ScopePicker.flattenTree`
 *  shape). An orphan (parent not visible) sits at the top level; folders caught in a parent cycle
 *  are listed once at the top level, so the walk always terminates. */
export function flattenFolders(folders: readonly PickableFolder[], ticked: ReadonlySet<string>): FolderRow[] {
  const ids = new Set(folders.map((f) => f.id))
  const byParent = new Map<string | null, PickableFolder[]>()
  for (const f of folders) {
    const parent = f.parent_id && ids.has(f.parent_id) ? f.parent_id : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), f])
  }
  const byName = (a: PickableFolder, b: PickableFolder) => a.name.localeCompare(b.name)
  for (const list of byParent.values()) list.sort(byName)

  const out: FolderRow[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number, path: string[], inTicked: boolean, roots?: PickableFolder[]) => {
    for (const f of roots ?? byParent.get(parent) ?? []) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      const own = ticked.has(f.id)
      const here = [...path, f.name]
      out.push({ folder: f, depth, path: here.join(" / "), checked: own || inTicked, included: inTicked })
      walk(f.id, depth + 1, here, inTicked || own)
    }
  }
  walk(null, 0, [], false)
  // A parent cycle has no root: list each unreached folder once at the top level.
  const rest = folders.filter((f) => !seen.has(f.id)).sort(byName)
  if (rest.length) walk(null, 0, [], false, rest)
  return out
}

/** Rows whose name contains the query (case-insensitive); a blank query keeps every row. */
export function filterFolderRows(rows: readonly FolderRow[], query: string): FolderRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...rows]
  return rows.filter((r) => r.folder.name.toLowerCase().includes(q))
}

// ── the Create key blocker ────────────────────────────────────────────────────────────────────

export type FolderMode = "all" | "only"
export type McpBlocker = "needLabel" | "needTool" | "needFolder" | "waitTools" | "waitFolders"

/** The first unmet condition, in the UI-SPEC §1c order: label → tool → folder (D-08) → loading. */
export function mcpCreateBlocker(d: {
  label: string
  tools: readonly string[]
  folderMode: FolderMode
  folderIds: readonly string[]
  catalogueLoaded: boolean
  foldersLoaded: boolean
}): McpBlocker | null {
  if (!d.label.trim()) return "needLabel"
  if (d.catalogueLoaded && d.tools.length === 0) return "needTool"
  if (d.folderMode === "only" && d.folderIds.length === 0) return "needFolder"
  if (!d.catalogueLoaded) return "waitTools"
  if (d.folderMode === "only" && !d.foldersLoaded) return "waitFolders"
  return null
}

// ── the draft ─────────────────────────────────────────────────────────────────────────────────

export type McpExpiry = "30" | "90" | "365"
export const MCP_EXPIRIES: readonly McpExpiry[] = ["30", "90", "365"]
export const MCP_EXPIRY_DAYS: Record<McpExpiry, 30 | 90 | 365> = { "30": 30, "90": 90, "365": 365 }

/** The MCP rows' choices, kept by the draft card across a switch of kind (UI-SPEC §1b). */
export interface McpDraft {
  preset: McpPresetChoice
  /** The hand-picked tools; read only while `preset` is `custom`. */
  custom: string[]
  folderMode: FolderMode
  /** Folders the member ticked (not the ones a ticked ancestor includes). */
  folderIds: string[]
  external: boolean
  expiry: McpExpiry
}

/** SC2 / KEY-04 (D-07, D-12, D-23): Read only, All folders, mail and synced left out, 90 days. */
export const MCP_DRAFT_DEFAULT: McpDraft = {
  preset: "read",
  custom: [],
  folderMode: "all",
  folderIds: [],
  external: false,
  expiry: "90",
}

/** The tools the draft grants, companions included, in catalogue order. */
export function draftTools(d: McpDraft, catalogue: readonly McpToolRef[]): string[] {
  return withCompanions(d.preset === "custom" ? d.custom : toolsForPreset(d.preset, catalogue), catalogue)
}

/** The body's `folder_ids`: null for All folders; otherwise each ticked folder still visible, with
 *  one whose ancestor is also ticked left out (the ancestor already includes it). */
export function draftFolderIds(d: McpDraft, folders: readonly PickableFolder[] | null): string[] | null {
  if (d.folderMode === "all") return null
  if (!folders) return [...d.folderIds]
  const rows = flattenFolders(folders, new Set(d.folderIds))
  return rows.filter((r) => d.folderIds.includes(r.folder.id) && !r.included).map((r) => r.folder.id)
}

// ── an MCP call's bar (306-05; UI-SPEC §7b) ───────────────────────────────────────────────────

/** The two tools whose `ok` call STARTS something: the server's `STARTS` annotation
 *  (`app/mcp/tools.py`). The one place this module names a tool: a bar kind is not a preset. */
const STARTS_SOMETHING: ReadonlySet<string> = new Set(["ask_agent", "run_workflow"])

export type McpBarKind = "start" | "read" | "refused"

/** An ok `ask_agent` / `run_workflow` call is a start bar; every other ok call the short read bar;
 *  a call that was not answered the tall refused bar. */
export function mcpBarKind(call: { ok: boolean; tool?: string | null }): McpBarKind {
  if (!call.ok) return "refused"
  return call.tool && STARTS_SOMETHING.has(call.tool) ? "start" : "read"
}

// ── the card's scope model ────────────────────────────────────────────────────────────────────

export const MAX_FOLDER_CHIPS = 4

export interface McpScopeModel {
  tools: { preset: McpPresetChoice; count: number; names: string[] }
  folders: { all: boolean; shown: ApiKeyFolderRef[]; more: ApiKeyFolderRef[] }
  external: boolean
}

/** A key's scope as chips: its preset (or a count when it matches none, or no catalogue is known),
 *  All folders or the first four folders plus the rest, and the external flag. */
export function mcpScopeChips(
  key: { tools: readonly string[] | null; folders: readonly ApiKeyFolderRef[] | null; include_external: boolean },
  catalogue: readonly McpToolRef[] | undefined,
): McpScopeModel {
  const names = [...(key.tools ?? [])]
  const folders = key.folders === null ? null : [...key.folders]
  return {
    tools: { preset: catalogue ? presetFor(names, catalogue) : "custom", count: names.length, names },
    folders: {
      all: folders === null,
      shown: folders ? folders.slice(0, MAX_FOLDER_CHIPS) : [],
      more: folders ? folders.slice(MAX_FOLDER_CHIPS) : [],
    },
    external: key.include_external,
  }
}
