/**
 * Phase 221 (D-221-01 / D-221-02 / D-221-05 / D-221-09) — one application inside one
 * connection.
 *
 * ── WHY AN APPLICATION IS A THING AND NOT SIX CONNECTIONS (D-221-01) ───────────────────
 * Google Workspace is ONE connection, ONE OAuth token, ONE consent screen and ONE Revoke,
 * covering six products. Six separate connections would mean six consents, six refresh
 * tokens — each expiring independently every 7 days while the consent screen is in Testing
 * — six rows in the list for one account, and six places to revoke. `service_tools.py`
 * records the operator's own instruction: a `gmail` service id *"would have meant a second
 * row, a second consent and two places to revoke."*
 *
 * ── D-221-09 · THIS COMPONENT ALSO DRAWS THE SINGLE-PRODUCT SCREEN ────────────────────
 * A connector's applications are the distinct values of the `app` key across its tools.
 * Google resolves to six; GitHub, Jira, Notion and every MCP server resolve to ONE, keyed
 * `null`. When there is exactly one, the header is redundant — the connection header above
 * already names it — so `headless` drops it and the bands rise to the top. That is the
 * Rovo-shaped screen, from the same component, at the cost of one boolean.
 *
 * ⚠ **THE POSTURE CONTROL LIVES HERE AND NOT ON THE BAND (D-221-03).** This is the axis a
 * bulk grant is allowed to key on — the PRODUCT. The direction band deliberately carries
 * nothing interactive; see `DirectionBand.tsx` for the ROADMAP sentence that forbids it.
 */

import type { McpDiscoveredTool, ToolGrantPosture } from "@/lib/api"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { cn } from "@/lib/utils"
import { ActionRow } from "./ActionRow"
import { DirectionBand } from "./DirectionBand"
import { GRANTS_COPY } from "./grantsVocabulary"
import type { ApplicationGrouping } from "./toolGroups"
import { applicationGrantKey, isWriteTool, resolveGroupedPosture } from "./toolGroups"

export interface ApplicationGroupProps {
  group: ApplicationGrouping
  /** D-221-09 — one application means no header, and the first band sits flush. */
  headless: boolean
  expanded: boolean
  onToggle: () => void
  toolGrants: Record<string, ToolGrantPosture | boolean>
  defaultPosture: ToolGrantPosture
  readOnly: boolean
  grantsArePersisted: boolean
  onChangeToolGrant: (toolName: string, posture: ToolGrantPosture) => void
  onResetToolGrant: (toolName: string) => void
  onChangeApplicationGrant: (application: string, posture: ToolGrantPosture) => void
  /** Phase 221 plan 02 fills this. Deliberately a slot rather than a prop shape, so the
   *  availability work cannot be half-rendered from here before it is built. */
  availabilitySlot?: React.ReactNode
}

const POSTURES: readonly ToolGrantPosture[] = ["allow", "ask", "deny"] as const

const POSTURE_WORD: Record<ToolGrantPosture, string> = {
  allow: GRANTS_COPY.POSTURE_ALLOW,
  ask: GRANTS_COPY.POSTURE_ASK,
  deny: GRANTS_COPY.POSTURE_DENY,
}

function PostureControl({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: ToolGrantPosture
  disabled: boolean
  onChange: (posture: ToolGrantPosture) => void
}) {
  return (
    <div
      className="inline-flex flex-none overflow-hidden rounded-md border border-border bg-card"
      role="group"
      aria-label={label}
    >
      {POSTURES.map((posture, i) => (
        <button
          key={posture}
          type="button"
          disabled={disabled}
          aria-pressed={value === posture}
          onClick={(e) => {
            // ⚠ The header is a <button>; without this the toggle fires too and the group
            // collapses the instant a posture is set.
            e.stopPropagation()
            onChange(posture)
          }}
          className={cn(
            "cursor-pointer px-2 py-1 text-[10.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            i > 0 && "border-l border-border",
            value !== posture && "text-muted-foreground hover:bg-accent hover:text-foreground",
            value === posture && posture === "deny" && "bg-destructive font-semibold text-white",
            value === posture &&
              posture !== "deny" &&
              "bg-primary font-semibold text-primary-foreground",
          )}
        >
          {POSTURE_WORD[posture]}
        </button>
      ))}
    </div>
  )
}

export function ApplicationGroup({
  group,
  headless,
  expanded,
  onToggle,
  toolGrants,
  defaultPosture,
  readOnly,
  grantsArePersisted,
  onChangeToolGrant,
  onResetToolGrant,
  onChangeApplicationGrant,
  availabilitySlot,
}: ApplicationGroupProps) {
  const open = headless || expanded

  const rowsFor = (tools: readonly McpDiscoveredTool[]) =>
    tools.map((tool) => {
      const { posture, source } = resolveGroupedPosture({
        toolName: tool.name,
        application: group.key,
        isWrite: isWriteTool(tool),
        grants: toolGrants,
        connectionDefault: defaultPosture,
      })
      return (
        <ActionRow
          key={tool.name}
          tool={tool}
          posture={posture}
          // ⚠ Only an ACTION grant is an override. Inheriting an application's posture is
          // still inheriting — marking it as overridden would put the coloured edge on
          // fifteen rows at once and destroy the one signal GRANT-02 depends on.
          isOverridden={source === "action"}
          readOnly={readOnly}
          grantsArePersisted={grantsArePersisted}
          onChangeToolGrant={onChangeToolGrant}
          onResetToolGrant={onResetToolGrant}
        />
      )
    })

  const applicationPosture: ToolGrantPosture = (() => {
    if (!group.key) return defaultPosture
    const raw = toolGrants?.[applicationGrantKey(group.key)]
    if (raw === "allow" || raw === "ask" || raw === "deny") return raw
    if (raw === true) return "allow"
    if (raw === false) return "deny"
    return defaultPosture
  })()

  return (
    <div
      data-testid={group.key ? `application-group-${group.key}` : "application-group-single"}
      data-open={open ? "true" : "false"}
      className="bg-card"
    >
      {!headless && (
        <button
          type="button"
          data-testid={`application-header-${group.key}`}
          aria-expanded={open}
          onClick={onToggle}
          className="flex w-full items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-accent/50"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={cn(
              "mt-1 h-3.5 w-3.5 flex-none text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          >
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <ConnectionMarkGlyph
            shape={{ service_id: `google-${group.key}`, capability: null }}
            size="row"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-foreground">{group.label}</span>
              <span className="text-[10.5px] tabular-nums text-muted-foreground">
                {GRANTS_COPY.APPLICATION_COUNT(group.tools.length)}
              </span>
            </span>
            {availabilitySlot}
          </span>
          {group.key && (
            <PostureControl
              label={GRANTS_COPY.APPLICATION_POSTURE_LABEL(group.label)}
              value={applicationPosture}
              disabled={readOnly || !grantsArePersisted}
              onChange={(posture) => onChangeApplicationGrant(group.key!, posture)}
            />
          )}
        </button>
      )}

      {open &&
        (group.bands
          ? group.bands.map((band, i) => (
              <div key={band.direction}>
                <DirectionBand
                  direction={band.direction}
                  count={band.tools.length}
                  flush={headless && i === 0}
                />
                <div className="divide-y divide-border">{rowsFor(band.tools)}</div>
              </div>
            ))
          : (
            <div className={cn("divide-y divide-border", !headless && "border-t border-border")}>
              {rowsFor(group.tools)}
            </div>
          ))}
    </div>
  )
}

export default ApplicationGroup
