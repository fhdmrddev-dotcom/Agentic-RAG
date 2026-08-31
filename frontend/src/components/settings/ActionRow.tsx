/**
 * Phase 221 — one action row, LIFTED VERBATIM out of `ConnectionGrantsList.tsx`'s `.map()`
 * body. Every class string, every `data-testid` and every conditional is the shipped one.
 *
 * ⚠ **THIS IS A MOVE, NOT A REDESIGN.** The extraction exists because the six-application
 * split would otherwise have doubled a 344-line component that had no hot-file-ledger row
 * at all — G-5 could not have fired on it (one phase old), so the seam was argued and taken
 * rather than triggered. A visual change smuggled into a move is invisible in review,
 * because the diff looks like relocation.
 *
 * ── The invariants it carries, all inherited from Phase 213 ────────────────────────────
 * ⚠ **INVARIANT 8 — ZERO `title` ATTRIBUTES.** A tooltip is unreachable by touch and by
 * keyboard, so meaning parked there is meaning removed for some readers entirely. The
 * "You changed this" tag was tried as a tooltip and REJECTED for exactly this.
 *
 * ⚠ **The overridden edge is the whole visual contract of GRANT-02:** a row a person
 * deliberately changed carries a coloured left edge and a tinted ground; an inherited row
 * stays plain and quiet, so the difference is legible while scrolling 44 of them.
 *
 * ⚠ **The reset link appears ONLY on an overridden row**, which is why the noise audit
 * deleted the tag beside it — the control's own words are the explanation.
 *
 * ⚠ **Three direction arms, never two.** `readOnlyHint` was measured ABSENT in the wild,
 * and the MCP spec says an unannotated tool is to be treated as destructive: unknown gets
 * its own chip and is NOT quietly folded into either side.
 */

import type { McpDiscoveredTool, ToolGrantPosture } from "@/lib/api"
import { cn } from "@/lib/utils"
import { GRANTS_COPY } from "./grantsVocabulary"
import { directionHint } from "./toolGroups"

export interface ActionRowProps {
  tool: McpDiscoveredTool
  posture: ToolGrantPosture
  isOverridden: boolean
  readOnly: boolean
  grantsArePersisted: boolean
  onChangeToolGrant: (toolName: string, posture: ToolGrantPosture) => void
  onResetToolGrant: (toolName: string) => void
}

export function ActionRow({
  tool,
  posture,
  isOverridden,
  readOnly,
  grantsArePersisted,
  onChangeToolGrant,
  onResetToolGrant,
}: ActionRowProps) {
  // One resolver, so the row and the band above it can never disagree about the same tool.
  const hint = directionHint(tool)
  const isRead = hint === true
  const isChange = hint === false
  const isUnknown = hint == null

  return (
    <div
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
          <span className="font-mono text-[12px] font-medium text-foreground">{tool.name}</span>
        </div>
        {tool.description && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {tool.description}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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

          {isOverridden && !readOnly && grantsArePersisted && (
            <button
              type="button"
              onClick={() => onResetToolGrant(tool.name)}
              data-testid="grant-reset"
              className="cursor-pointer text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {GRANTS_COPY.OVERRIDDEN_RESET}
            </button>
          )}
        </div>
      </div>

      <div
        className="inline-flex flex-none overflow-hidden rounded-md border border-border bg-card"
        role="group"
        aria-label={`${tool.name} permission posture`}
      >
        <button
          type="button"
          disabled={readOnly || !grantsArePersisted}
          aria-pressed={posture === "allow"}
          onClick={() => onChangeToolGrant(tool.name, "allow")}
          className={cn(
            "cursor-pointer px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            posture === "allow"
              ? "bg-primary font-semibold text-primary-foreground"
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
            "cursor-pointer border-l border-border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            posture === "ask"
              ? "bg-primary font-semibold text-primary-foreground"
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
            "cursor-pointer border-l border-border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            posture === "deny"
              ? "bg-destructive font-semibold text-white"
              : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
          )}
        >
          {GRANTS_COPY.POSTURE_DENY}
        </button>
      </div>
    </div>
  )
}

export default ActionRow
