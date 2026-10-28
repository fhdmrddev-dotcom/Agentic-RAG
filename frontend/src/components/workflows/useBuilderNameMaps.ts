/**
 * Phase 286-02 (2026-10-18, REG-07 / D-10a) — THE BUILDER'S ID-TO-NAME LOOKUP CLUSTER, MOVED
 * VERBATIM OUT OF `pages/WorkflowBuilderPage.tsx` UNDER G-5.
 *
 * The page measured 57 commits / 22 phases / 2993 lines at the cut, and its named seam
 * (save/concurrency) was already taken in 186-07 as `useDraftPersistence`. This is the next
 * cluster D-10 names: six state values and the ONE mount read that fills them. Every
 * `useState`, every comment and the whole effect body below ran on the page, in this order,
 * with these words. Nothing was re-worded and no request was added.
 *
 * ── THE CONTRACT ─────────────────────────────────────────────────────────────────────────
 *
 * OWNS: the six values (`folderNames`, `folderOptions`, `skillNames`, `connectionNames`,
 * `mcpServerUrls`, `toolReadOnly`), their setters, and the one mount effect — three
 * independent best-effort reads, each in its own `try`, behind one `cancelled` flag.
 *
 * THE PAGE READS, AND NEVER SETS. The setters never leave this hook; the page receives plain
 * values and threads them into `nameContext`, the bound-folder chip, the knowledge-base
 * picker and the panel props, exactly where it always did.
 *
 * WHERE THE PAGE CALLS IT, AND WHY THERE. At the old state-block position, beside the other
 * `useState` declarations. `nameContext` is memoised from these values a few lines later, and
 * two announcement callbacks list `nameContext` in their dependencies, so the values must
 * exist before any of that is declared. The consequence is stated rather than hidden: this
 * effect now REGISTERS before the page's other mount effects (it used to be declared after
 * them), so the three reads below fire first in the same commit phase. All of them are
 * independent best-effort reads, and the faces already settle when this read resolves
 * (PITFALL 1, accepted on the page).
 *
 * THE SPECIFIER IS LOAD-BEARING. The three list functions are imported from `@/lib/api`, the
 * same module specifier the page used, so every suite's `vi.mock("@/lib/api")` factory still
 * intercepts them. `WorkflowBuilderPage.seam286.pin.test.tsx` pins one call per read, the
 * resolved faces, the connectors-refusal isolation and both read-only banner arms.
 *
 * ⚠ NAMES ONLY cross the trust boundary here (CONN-03 SC#4): `id`, `name`, `mcp_server_url`
 * and, through `buildToolReadOnlyMap`, each discovered tool's explicit `readOnlyHint`.
 *
 * ── PHASE 298-04 (D-08 / D-15 / UI-D11) ──────────────────────────────────────────────────
 *
 * The folder list is now NARROWED to the active org (298-01), so a folder this workflow binds
 * in ANOTHER org is no longer in it. Two additions, both best-effort like the reads above:
 *   1. The mount read re-runs when the active org changes (`useActiveOrgId()`), the same
 *      `cancelled` idiom dropping a late answer. No keyed remount (297 rule).
 *   2. For the bound ids the page passes (`project_folder_id` and every phase's `folder_scope`)
 *      that the list lacks, ONE folder-labels read asks what they are called and where they
 *      live. Their chip-form names ("Q3 Contracts · lives in Acme Legal") join `folderNames`,
 *      so every face that already reads the map shows the marker as words; the raw labels go
 *      to `folderLabels` for the page's `<option>`. An id the read omits gets NO name — the
 *      page's `UNNAMED_KB_OPTION` fallback stays exactly as it was.
 */
import { useEffect, useMemo, useState } from "react"
import { getFolderLabels, listConnectorConnections, listFolders, listSkills } from "@/lib/api"
import type { FolderLabel } from "@/lib/api/orgItems"
import { useActiveOrgId } from "@/hooks/useActiveOrgId"
import { chipLabel } from "@/components/workflows/folderLabel"
import { buildToolReadOnlyMap } from "@/components/workflows/toolReadOnlyMap"
import type { IdNameMap } from "@/components/workflows/PhaseFormPanel"

/** What the page reads. Plain values; the setters stay inside the hook. */
export interface BuilderNameMaps {
  /** Folder id → name. 298-04: an out-of-org bound folder's entry is its chip-form label. */
  folderNames: IdNameMap
  /** 298-04 (D-15): the folder-labels read's answer for bound ids the narrowed list lacks. */
  folderLabels: Record<string, FolderLabel>
  folderOptions: Array<{ id: string; name: string }>
  skillNames: IdNameMap
  connectionNames: IdNameMap
  mcpServerUrls: Record<string, string | null>
  toolReadOnly: Record<string, Record<string, boolean>>
}

/**
 * 298-04 — the folders the workflow binds, as the page already holds them: the definition's
 * `project_folder_id` and each phase's `folder_scope`. Loose shapes on purpose: the hook reads
 * two keys and nothing else.
 */
export interface BuilderBoundFolders {
  meta?: { project_folder_id?: unknown } | null
  phases?: ReadonlyArray<{ config?: unknown }> | null
}

function boundIdsOf(bound: BuilderBoundFolders | undefined): string[] {
  const ids = new Set<string>()
  const project = bound?.meta?.project_folder_id
  if (typeof project === "string" && project.length > 0) ids.add(project)
  for (const phase of bound?.phases ?? []) {
    const scope = (phase?.config as { folder_scope?: unknown } | undefined)?.folder_scope
    if (!Array.isArray(scope)) continue
    for (const id of scope) if (typeof id === "string" && id.length > 0) ids.add(id)
  }
  return [...ids].sort()
}

export function useBuilderNameMaps(bound?: BuilderBoundFolders): BuilderNameMaps {
  // 298-04 (D-08): the org key the mount read below re-runs on.
  const activeOrgId = useActiveOrgId()
  // Phase 103-ux: id→name maps so the form panel renders folder + skill NAMES (never
  // UUIDs). Fetched once on mount; failures degrade to showing the raw id.
  // 298-04: the narrowed list's names; `folderNames` below is this plus the labelled misses.
  const [listedNames, setFolderNames] = useState<IdNameMap>({})
  // 298-04: `null` until the folder list has answered (a miss is only a miss once it has).
  const [listed, setListed] = useState<ReadonlySet<string> | null>(null)
  const [folderLabels, setFolderLabels] = useState<Record<string, FolderLabel>>({})
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; name: string }>>([])
  const [skillNames, setSkillNames] = useState<IdNameMap>({})
  // Phase 200 (FE-WIRING): connection id→name, so an `external_action` step's face names its
  // destination. Same lifecycle and same failure mode as the two maps above — fetched once on
  // mount, best-effort, and an empty map is the SHIPPED state (the destination-free sentence),
  // never a degraded one. ⚠ NAMES ONLY: nothing from `ConnectorConnection.config` is read here,
  // so no host, port or credential can reach the canvas (CONN-03 SC#4).
  const [connectionNames, setConnectionNames] = useState<IdNameMap>({})
  // Phase 209 (Item 1 fix) — connection id → mcp_server_url | null. Built alongside
  // `connectionNames` in the same mount fetch; the same PITFALL-1 applies. Stored as
  // `null` for capability-type connections (no mcp_server_url) so a missing key can mean
  // "not yet fetched" rather than "not an MCP connection" — that distinction matters for
  // the mark resolver in `canvasModel.ts`. Only `mcp_server_url` is read (CONN-03 SC#4).
  const [mcpServerUrls, setMcpServerUrls] = useState<Record<string, string | null>>({})
  // Phase 209 (Item 2 · SC#2) — connection id → tool name → the SERVER'S OWN
  // `annotations.readOnlyHint`. Read from the same `listConnectorConnections` response as the
  // two maps above, so it costs no extra request. An absent connection, an absent tool, or a
  // tool whose server sent no hint all leave the lookup `undefined`, and the banner FAILS
  // CLOSED to `CHANGES SOMETHING OUTSIDE` — never "only reads" on silence.
  const [toolReadOnly, setToolReadOnly] = useState<Record<string, Record<string, boolean>>>({})

  // Phase 103-ux: fetch folders + skills ONCE on mount → id→name maps for the form
  // panel + the project picker. Best-effort; a failure leaves the maps empty (the
  // panel then falls back to showing the raw id, never a crash).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const folders = await listFolders()
        if (cancelled) return
        const map: IdNameMap = {}
        for (const f of folders) map[f.id] = f.name
        setFolderNames(map)
        setFolderOptions(folders.map((f) => ({ id: f.id, name: f.name })))
        setListed(new Set(folders.map((f) => f.id)))
      } catch {
        /* non-fatal — the panel falls back to the raw id */
      }
      try {
        const skills = await listSkills()
        if (cancelled) return
        const map: IdNameMap = {}
        for (const s of skills) map[s.id] = s.name
        setSkillNames(map)
      } catch {
        /* non-fatal */
      }
      // Phase 200 (FE-WIRING) — the connection names, third and last of the mount's id→name
      // reads. UNNARROWED (no `capability` argument): the map is joined on `connection_id`,
      // and a step's capability can be edited without re-fetching, so narrowing the fetch would
      // make the face go blank on exactly the edit that changed it.
      //
      // ⚠ ITS OWN `try`, deliberately, rather than joining the block above. This route is the
      // NEWEST of the three and the only one that can refuse for a reason unrelated to the
      // author (`no_encryption_key` — an operator-level configuration state, `ConnectorApiError`).
      // A shared `catch` would let a connectors refusal swallow the skill map that had already
      // resolved beside it, and every derived skill face would silently drop to its type
      // sentence on an installation that simply has no connectors configured.
      try {
        const connections = await listConnectorConnections()
        if (cancelled) return
        const map: IdNameMap = {}
        const urlMap: Record<string, string | null> = {}
        for (const c of connections) {
          map[c.id] = c.name
          // Phase 209 (Item 1 fix) — store null for non-MCP connections so the mark resolver
          // can distinguish "non-MCP" (null) from "not fetched yet" (missing key).
          urlMap[c.id] = c.mcp_server_url ?? null
        }
        setConnectionNames(map)
        setMcpServerUrls(urlMap)
        // Phase 209 (Item 2 · SC#2) — the per-tool read/write declaration, built by the ONE
        // module that owns the explicit-boolean-only rule. Deliberately not inlined here: the
        // judgement it carries is a safety property and belongs somewhere directly testable.
        setToolReadOnly(buildToolReadOnlyMap(connections))
      } catch {
        /* non-fatal — every external face falls back to its destination-free sentence */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrgId])

  // 298-04 (D-15) — the bound ids the answered list lacks, as one stable key.
  const boundKey = boundIdsOf(bound).join(",")
  const missingKey = useMemo(() => {
    if (listed === null || boundKey === "") return ""
    return boundKey
      .split(",")
      .filter((id) => !listed.has(id))
      .join(",")
  }, [boundKey, listed])

  // ONE label read per distinct set of misses, best-effort in its own `try` (a refusal or an
  // older mock without the symbol leaves the names as they were — the UNNAMED fallback).
  useEffect(() => {
    if (missingKey === "") return
    let cancelled = false
    void (async () => {
      try {
        const labels = await getFolderLabels(missingKey.split(","))
        if (cancelled) return
        const next: Record<string, FolderLabel> = {}
        for (const label of labels) next[label.id] = label
        setFolderLabels(next)
      } catch {
        /* non-fatal — an unlabelled miss keeps the page's UNNAMED_KB_OPTION fallback */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [missingKey])

  const folderNames = useMemo<IdNameMap>(() => {
    const ids = Object.keys(folderLabels).filter((id) => !(id in listedNames))
    if (ids.length === 0) return listedNames
    const merged: IdNameMap = { ...listedNames }
    for (const id of ids) merged[id] = chipLabel(id, { label: folderLabels[id], activeOrgId })
    return merged
  }, [listedNames, folderLabels, activeOrgId])

  return { folderNames, folderLabels, folderOptions, skillNames, connectionNames, mcpServerUrls, toolReadOnly }
}
