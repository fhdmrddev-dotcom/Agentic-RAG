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
 */
import { useEffect, useState } from "react"
import { listConnectorConnections, listFolders, listSkills } from "@/lib/api"
import { buildToolReadOnlyMap } from "@/components/workflows/toolReadOnlyMap"
import type { IdNameMap } from "@/components/workflows/PhaseFormPanel"

/** What the page reads. Plain values; the setters stay inside the hook. */
export interface BuilderNameMaps {
  folderNames: IdNameMap
  folderOptions: Array<{ id: string; name: string }>
  skillNames: IdNameMap
  connectionNames: IdNameMap
  mcpServerUrls: Record<string, string | null>
  toolReadOnly: Record<string, Record<string, boolean>>
}

export function useBuilderNameMaps(): BuilderNameMaps {
  // Phase 103-ux: id→name maps so the form panel renders folder + skill NAMES (never
  // UUIDs). Fetched once on mount; failures degrade to showing the raw id.
  const [folderNames, setFolderNames] = useState<IdNameMap>({})
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
  }, [])

  return { folderNames, folderOptions, skillNames, connectionNames, mcpServerUrls, toolReadOnly }
}
