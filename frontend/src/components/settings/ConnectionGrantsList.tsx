/**
 * ConnectionGrantsList: Per-tool approval posture and grant controls for a connection.
 * Phase 213 (GRANT-01 · GRANT-02 / D-213-00 / D-213-05..D-213-10).
 *
 * Implements the 10 invariants from .planning/sketches/213-grants-and-the-approval-moment/BUILD-CONTRACT.generated.md.
 */

import { useMemo, useState } from "react"
import type { McpDiscoveredTool, ToolGrantPosture } from "@/lib/api"
import { GRANTS_COPY } from "./grantsVocabulary"
import { cn } from "@/lib/utils"

export interface ConnectionGrantsListProps {
  tools: McpDiscoveredTool[]
  toolGrants: Record<string, ToolGrantPosture | boolean>
  defaultPosture: ToolGrantPosture
  onChangeDefaultPosture?: (posture: ToolGrantPosture) => void
  onChangeToolGrant: (toolName: string, posture: ToolGrantPosture) => void
  onResetToolGrant: (toolName: string) => void
  readOnly?: boolean
  grantsArePersisted?: boolean
  connectionName?: string
}

function resolveItemPosture(
  toolName: string,
  toolGrants: Record<string, ToolGrantPosture | boolean>,
  defaultPosture: ToolGrantPosture,
): { posture: ToolGrantPosture; isOverridden: boolean } {
  if (toolName in toolGrants) {
    const raw = toolGrants[toolName]
    if (raw === "allow" || raw === true) return { posture: "allow", isOverridden: true }
    if (raw === "deny" || raw === false) return { posture: "deny", isOverridden: true }
    if (raw === "ask") return { posture: "ask", isOverridden: true }
  }
  return { posture: defaultPosture || "ask", isOverridden: false }
}

export function ConnectionGrantsList({
  tools,
  toolGrants,
  defaultPosture,
  onChangeDefaultPosture,
  onChangeToolGrant,
  onResetToolGrant,
  readOnly = false,
  grantsArePersisted = true,
}: ConnectionGrantsListProps) {
  const [search, setSearch] = useState("")

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tools
    return tools.filter((tool) => {
      const name = tool.name.toLowerCase()
      const title = (tool.title || "").toLowerCase()
      const desc = (tool.description || "").toLowerCase()
      return name.includes(q) || title.includes(q) || desc.includes(q)
    })
  }, [tools, search])

/** The direction hint, read from BOTH places it can legally live.
 *
 * ⚠ THE `annotations` ARM WAS MISSING AND THAT MADE PHASE 209 HALF-DEAD. `mcp_client.py`
 * forwards a server's `annotations` object verbatim *"so `readOnlyHint` reaches the
 * frontend"* — and nothing here ever looked inside it, so a server that DID annotate its
 * tools still rendered "this server does not say". The top-level field is read first
 * because it is the flatter, more specific spelling; the specification puts the hint
 * inside `annotations`, which is why the fallback is the one that fires in practice.
 *
 * ⚠ ABSENCE STILL MEANS UNKNOWN, AND UNKNOWN STILL MEANS TREAT AS DESTRUCTIVE. This
 * resolves where to LOOK, never what to assume — `?? undefined` rather than `?? false`,
 * because a hint nobody gave is not a hint that says no.
 */
function directionHint(tool: { readOnlyHint?: boolean; annotations?: { readOnlyHint?: boolean } }) {
  return tool.readOnlyHint ?? tool.annotations?.readOnlyHint
}

  /** Does ANY action on this connection have an unknown direction?
   *
   *  ⚠ Derived from `tools`, NOT from `filteredTools`: the sentence explains a property of
   *  the SERVER, and that property does not change because someone typed in the search box.
   *  Keying it to the filter would make the explanation flicker in and out while a person
   *  narrows a 44-row list — the same "is it still true?" jitter the reserved edge lane
   *  exists to prevent one grain down. */
  const anyUnknownDirection = useMemo(
    () => tools.some((tool) => directionHint(tool) == null),
    [tools],
  )

  return (
    <div data-testid="connection-grants-list" className="flex flex-col gap-3">
      {/* ── 1. The Connection-Level Default Posture Control (GRANT-02) ── */}
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <div className="text-[11px] font-medium text-foreground">
          {GRANTS_COPY.DEFAULT_POSTURE_LABEL}
        </div>
        <div className="mt-1.5 flex items-center">
          <div
            className="inline-flex rounded-md border border-border overflow-hidden bg-card"
            role="group"
            aria-label={GRANTS_COPY.DEFAULT_POSTURE_LABEL}
          >
            <button
              type="button"
              disabled={readOnly || !grantsArePersisted}
              aria-pressed={defaultPosture === "allow"}
              onClick={() => onChangeDefaultPosture?.("allow")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                defaultPosture === "allow"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {GRANTS_COPY.POSTURE_ALLOW}
            </button>
            <button
              type="button"
              disabled={readOnly || !grantsArePersisted}
              aria-pressed={defaultPosture === "ask"}
              onClick={() => onChangeDefaultPosture?.("ask")}
              className={cn(
                "border-l border-border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                defaultPosture === "ask"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {GRANTS_COPY.POSTURE_ASK}
            </button>
            <button
              type="button"
              disabled={readOnly || !grantsArePersisted}
              aria-pressed={defaultPosture === "deny"}
              onClick={() => onChangeDefaultPosture?.("deny")}
              className={cn(
                "border-l border-border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                defaultPosture === "deny"
                  ? "bg-destructive text-white font-semibold"
                  : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              )}
            >
              {GRANTS_COPY.POSTURE_DENY}
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {GRANTS_COPY.DEFAULT_POSTURE_HELP}
        </p>

        {/* ── The "Unknown" explanation, ONCE ─────────────────────────────────────────────
            ⚠ OPERATOR-DRIVEN, 2026-08-27: this sentence used to render INSIDE EVERY
            unknown row. `readOnlyHint` is measured ABSENT on the one server we can reach,
            so on a 44-tool connection nearly every row is Unknown and the same sentence was
            printed ~44 times — *"directing the user is good but contaminating the UI is
            not"*.

            The split is by GRAIN, not by taste: the **tag** is a fact about ONE action and
            stays on its row; the **explanation** is a fact about the SERVER and belongs
            once, beside the other line that explains how this screen works.

            Invariant #7 still holds — an unknown direction still "explains itself in real
            DOM text". What changed is that it explains itself ONCE, which is what the
            amended test now pins (and it asserts the count, so a regression to per-row
            cannot pass). */}
        {anyUnknownDirection && (
          <p
            data-testid="grants-unknown-direction-help"
            className="mt-1 text-[11px] leading-snug text-muted-foreground"
          >
            {GRANTS_COPY.DIRECTION_UNKNOWN_HELP}
          </p>
        )}
      </div>

      {/* ── 2. Search Input ── */}
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

      {/* ── 3. Empty Search State ── */}
      {filteredTools.length === 0 && (
        <div
          data-state="empty"
          className="rounded-lg border border-border bg-card p-4 text-center text-[12px] text-muted-foreground"
        >
          {GRANTS_COPY.LIST_EMPTY}
        </div>
      )}

      {/* ── 4. Action Rows List ── */}
      {filteredTools.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {filteredTools.map((tool) => {
            const { posture, isOverridden } = resolveItemPosture(
              tool.name,
              toolGrants,
              defaultPosture,
            )

            // Direction calculation — one resolver, so the row and the summary sentence
            // above it can never disagree about the same tool.
            const hint = directionHint(tool)
            const isRead = hint === true
            const isChange = hint === false
            const isUnknown = hint == null

            return (
              <div
                key={tool.name}
                data-testid={`action-row-${tool.name}`}
                className={cn(
                  "arow flex items-start gap-3 p-2.5 transition-colors",
                  "border-l-2",
                  isOverridden
                    ? "overridden border-l-primary bg-primary/[0.06]"
                    : "border-l-transparent bg-card",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-medium text-foreground">
                      {tool.name}
                    </span>
                  </div>
                  {tool.description && (
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                      {tool.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {/* Direction Tags */}
                    {isRead && (
                      <span className="tag rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {GRANTS_COPY.DIRECTION_READS}
                      </span>
                    )}
                    {isChange && (
                      <span className="tag changes rounded border border-warning/35 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                        {GRANTS_COPY.DIRECTION_CHANGES}
                      </span>
                    )}
                    {isUnknown && (
                      <span className="tag unknown rounded border border-warning/35 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                        {GRANTS_COPY.DIRECTION_UNKNOWN}
                      </span>
                    )}

                    {/* ⚠ NOISE AUDIT 2026-08-31 (operator, item C1) — the "You changed
                        this" TAG is gone. It sat beside a reset link that only ever
                        appears on an overridden row, so the link already carried the
                        fact; down a 44-action list that was two controls where one means
                        something.

                        ⚠ AND NO `title` REPLACES IT. The first attempt put the sentence on
                        a tooltip and went RED against this file's own Invariant 8 — "zero
                        [title] attributes in the rendered output" — which exists because a
                        tooltip is unreachable by touch and by keyboard, so meaning parked
                        there is meaning removed for some people. The link's own words are
                        the explanation: a control that says "Use the default" and appears
                        only when you are not on it needs no second sentence. */}
                    {isOverridden && !readOnly && grantsArePersisted && (
                      <button
                        type="button"
                        onClick={() => onResetToolGrant(tool.name)}
                        data-testid="grant-reset"
                        className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer"
                      >
                        {GRANTS_COPY.OVERRIDDEN_RESET}
                      </button>
                    )}
                  </div>

                </div>

                {/* Tri-state Segmented Posture Control for this tool */}
                <div
                  className="inline-flex rounded-md border border-border overflow-hidden bg-card flex-none"
                  role="group"
                  aria-label={`${tool.name} permission posture`}
                >
                  <button
                    type="button"
                    disabled={readOnly || !grantsArePersisted}
                    aria-pressed={posture === "allow"}
                    onClick={() => onChangeToolGrant(tool.name, "allow")}
                    className={cn(
                      "px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                      posture === "allow"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {GRANTS_COPY.POSTURE_ALLOW}
                  </button>
                  <button
                    type="button"
                    disabled={readOnly || !grantsArePersisted}
                    aria-pressed={posture === "ask"}
                    onClick={() => onChangeToolGrant(tool.name, "ask")}
                    className={cn(
                      "border-l border-border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                      posture === "ask"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {GRANTS_COPY.POSTURE_ASK}
                  </button>
                  <button
                    type="button"
                    disabled={readOnly || !grantsArePersisted}
                    aria-pressed={posture === "deny"}
                    onClick={() => onChangeToolGrant(tool.name, "deny")}
                    className={cn(
                      "border-l border-border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                      posture === "deny"
                        ? "bg-destructive text-white font-semibold"
                        : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                    )}
                  >
                    {GRANTS_COPY.POSTURE_DENY}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ConnectionGrantsList
