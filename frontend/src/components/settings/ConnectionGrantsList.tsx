/**
 * ConnectionGrantsList: per-application, per-action approval posture for a connection.
 * Phase 213 (GRANT-01 · GRANT-02 / D-213-00 / D-213-05..D-213-10) ·
 * Phase 221 (D-221-02 · D-221-03 · D-221-05 · D-221-09 · D-221-10 · D-221-11).
 *
 * Implements the 10 invariants from
 * `.planning/sketches/213-grants-and-the-approval-moment/BUILD-CONTRACT.generated.md`
 * and the composition from `.planning/sketches/221-six-applications-one-token/index.html`.
 *
 * ── ⚠ THIS FILE COMPOSES. IT OWNS NO ROW MARKUP, AND THAT IS ENFORCED BY A LINE COUNT ──
 * At Phase 221's open this file was **344 lines and one phase old**, so G-5 could not fire
 * on it — and the six-application split would have roughly doubled it, which is how every
 * file in `docs/HOT-FILE-LEDGER.md` became hot in the first place. A guardrail that fires
 * two phases late is not a guardrail, so the seam was ARGUED rather than triggered and
 * taken inside 221 rather than deferred to a refactor phase that would first have had to
 * undo a ~700-line component.
 *
 * What it keeps: the connection-level default control, the search box, and the arrangement.
 * What it hands to children: every application (`ApplicationGroup`), every band
 * (`DirectionBand`), every row (`ActionRow`), and every decision about grouping and
 * posture resolution (`toolGroups.ts`, pure).
 *
 * ⚠ **The acceptance criterion is falsifiable: this file must measure BELOW 344 lines.** If
 * it grows, the disposition recorded in the ledger was not honoured — that is the report,
 * not "the plan turned out bigger than expected".
 *
 * ── D-221-10 · ONE SEARCH BOX, ABOVE THE GROUPS ────────────────────────────────────────
 * It filters across every application and hides a group that matches nothing. Google at 15
 * actions does not need it and Google at ~30 will once writes land; one behaviour at 15 and
 * at GitHub's 44 beats a control that appears at a threshold nobody can predict.
 */

import { useMemo, useState } from "react"
import type { McpDiscoveredTool, ToolGrantPosture } from "@/lib/api"
import { ApplicationGroup } from "./ApplicationGroup"
import { GRANTS_COPY } from "./grantsVocabulary"
import { directionHint, groupToolsByApplication } from "./toolGroups"
import { cn } from "@/lib/utils"

export interface ConnectionGrantsListProps {
  tools: McpDiscoveredTool[]
  toolGrants: Record<string, ToolGrantPosture | boolean>
  defaultPosture: ToolGrantPosture
  onChangeDefaultPosture?: (posture: ToolGrantPosture) => void
  onChangeToolGrant: (toolName: string, posture: ToolGrantPosture) => void
  onResetToolGrant: (toolName: string) => void
  /** Phase 221 (D-221-05) — the middle rung. Absent on a surface that cannot persist it. */
  onChangeApplicationGrant?: (application: string, posture: ToolGrantPosture) => void
  readOnly?: boolean
  grantsArePersisted?: boolean
  connectionName?: string
}

const POSTURES: readonly ToolGrantPosture[] = ["allow", "ask", "deny"] as const
const POSTURE_WORD: Record<ToolGrantPosture, string> = {
  allow: GRANTS_COPY.POSTURE_ALLOW,
  ask: GRANTS_COPY.POSTURE_ASK,
  deny: GRANTS_COPY.POSTURE_DENY,
}

function matchesQuery(tool: McpDiscoveredTool, q: string): boolean {
  return (
    tool.name.toLowerCase().includes(q) ||
    (tool.title || "").toLowerCase().includes(q) ||
    (tool.description || "").toLowerCase().includes(q)
  )
}

export function ConnectionGrantsList({
  tools,
  toolGrants,
  defaultPosture,
  onChangeDefaultPosture,
  onChangeToolGrant,
  onResetToolGrant,
  onChangeApplicationGrant,
  readOnly = false,
  grantsArePersisted = true,
}: ConnectionGrantsListProps) {
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tools
    return tools.filter((tool) => matchesQuery(tool, q))
  }, [tools, search])

  // ⚠ Grouped from the FILTERED set, so a group matching nothing is absent from the DOM
  // rather than rendered empty — the sketch's rule, and the reason the search box can sit
  // above the groups without leaving a row of empty headers behind it.
  const groups = useMemo(() => groupToolsByApplication(filteredTools), [filteredTools])

  /** Does ANY action on this connection have an unknown direction? (Phase 213, Invariant 7)
   *
   *  ⚠ Derived from `tools`, NOT from `filteredTools`: the sentence explains a property of
   *  the SERVER, and that property does not change because someone typed in the search box.
   *  Keying it to the filter would make the explanation flicker in and out while a person
   *  narrows a 44-row list.
   *
   *  ⚠ And it is rendered ONCE, beside the default control — the TAG is a fact about one
   *  action and stays on its row; the EXPLANATION is a fact about the server. Phase 221's
   *  extraction dropped this line and `ConnectionGrantsList.test.tsx` caught it, which is
   *  the whole argument for that suite asserting a COUNT rather than a presence. */
  const anyUnknownDirection = useMemo(
    () => tools.some((tool) => directionHint(tool) == null),
    [tools],
  )

  // D-221-09 — one application means no header and no chevron; the bands rise to the top.
  const headless = groups.length === 1 && groups[0].key === null

  return (
    <div data-testid="connection-grants-list" className="flex flex-col gap-3">
      {/* ── 1. The connection-level default posture control (GRANT-02) ── */}
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <div className="text-[11px] font-medium text-foreground">
          {GRANTS_COPY.DEFAULT_POSTURE_LABEL}
        </div>
        <div className="mt-1.5 flex items-center">
          <div
            className="inline-flex overflow-hidden rounded-md border border-border bg-card"
            role="group"
            aria-label={GRANTS_COPY.DEFAULT_POSTURE_LABEL}
          >
            {POSTURES.map((posture, i) => (
              <button
                key={posture}
                type="button"
                disabled={readOnly || !grantsArePersisted}
                aria-pressed={defaultPosture === posture}
                onClick={() => onChangeDefaultPosture?.(posture)}
                className={cn(
                  "cursor-pointer px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  i > 0 && "border-l border-border",
                  defaultPosture !== posture &&
                    "text-muted-foreground hover:bg-accent hover:text-foreground",
                  defaultPosture === posture &&
                    posture === "deny" &&
                    "bg-destructive font-semibold text-white",
                  defaultPosture === posture &&
                    posture !== "deny" &&
                    "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {POSTURE_WORD[posture]}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {headless ? GRANTS_COPY.DEFAULT_POSTURE_HELP : GRANTS_COPY.APPLICATION_INHERITS}
        </p>
        {anyUnknownDirection && (
          <p
            data-testid="grants-unknown-direction-help"
            className="mt-1 text-[11px] leading-snug text-muted-foreground"
          >
            {GRANTS_COPY.DIRECTION_UNKNOWN_HELP}
          </p>
        )}
      </div>

      {/* ── 2. Search (D-221-10) ── */}
      {tools.length > 0 && (
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={GRANTS_COPY.SEARCH_PLACEHOLDER(tools.length)}
            aria-label={GRANTS_COPY.SEARCH_PLACEHOLDER(tools.length)}
            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {/* ── 3. Empty search state ── */}
      {groups.length === 0 && (
        <div
          data-state="empty"
          className="rounded-lg border border-border bg-card p-4 text-center text-[12px] text-muted-foreground"
        >
          {GRANTS_COPY.LIST_EMPTY}
        </div>
      )}

      {/* ── 4. Applications, each owning its own bands and rows ── */}
      {groups.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {groups.map((group) => (
            <ApplicationGroup
              key={group.key ?? "__single__"}
              group={group}
              headless={headless}
              // ⚠ Open by default. A person who came here to change a permission should not
              // have to discover six chevrons first; collapsing is the deliberate act.
              expanded={!collapsed[group.key ?? "__single__"]}
              onToggle={() =>
                setCollapsed((prev) => {
                  const k = group.key ?? "__single__"
                  return { ...prev, [k]: !prev[k] }
                })
              }
              toolGrants={toolGrants}
              defaultPosture={defaultPosture}
              readOnly={readOnly}
              grantsArePersisted={grantsArePersisted}
              onChangeToolGrant={onChangeToolGrant}
              onResetToolGrant={onResetToolGrant}
              onChangeApplicationGrant={(application, posture) =>
                onChangeApplicationGrant?.(application, posture)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ConnectionGrantsList
