/**
 * Phase 293-04 (D-17) — a key's recent calls (the last 30 days the server sends), newest first.
 *
 * The activity record IS the audit record (293-01 reads it from `audit_log`), so this table and
 * the admin audit browser show the same calls in the same words. A run id is a link only when
 * the viewer can open it (`onOpenRun`); otherwise it is plain mono text. The Workflow column hides
 * below 768px; the call strip's detail line repeats the full row on one line.
 */
import type { ApiKeyCall } from "@/lib/api/apiKeys"
import { cn } from "@/lib/utils"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { callWords, formatCallTime, runCellText, type CallContext } from "./apiKeyFacts"
import { MCP_KEY_COPY } from "./mcpKeyCopy"

const C = API_KEYS_COPY
const M = MCP_KEY_COPY

/** 305-03 (UI-SPEC §Surface 3): an AI tool key's calls — Time · Tool · Result. An MCP read has no
 *  workflow and no run, and no query text is ever recorded, so none can be shown. */
function McpActivity({
  calls,
  lastUsed,
  now,
  ctx,
  onOpenAudit,
}: {
  calls: readonly ApiKeyCall[]
  lastUsed: string
  now: Date
  ctx: CallContext
  onOpenAudit?: () => void
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{fillCopy(C.activity.header, { when: lastUsed })}</span>
        {onOpenAudit && (
          <button type="button" className="text-primary hover:underline" onClick={onOpenAudit}>
            {C.activity.auditLink}
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-muted/40">
        <table className="w-full text-left text-xs">
          <thead className="sr-only">
            <tr>
              <th scope="col">{C.activity.colTime}</th>
              <th scope="col">{M.activity.colTool}</th>
              <th scope="col">{C.activity.colResult}</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call, i) => {
              const words = callWords(call, { ...ctx, now })
              return (
                <tr key={`${call.at}-${i}`} className="border-t border-border/60 first:border-t-0">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-muted-foreground">{formatCallTime(call.at, now)}</td>
                  <td className="px-3 py-1.5">
                    {call.tool ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{call.tool}</span>
                    ) : (
                      <span className="text-muted-foreground">{M.activity.noTool}</span>
                    )}
                  </td>
                  <td className={cn("px-3 py-1.5", words.ok ? "text-success" : "text-[hsl(0_80%_80%)]")}>{words.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ApiKeyActivity({
  calls,
  revoked,
  lastUsed,
  now,
  ctx = {},
  onOpenRun,
  onOpenAudit,
}: {
  calls: readonly ApiKeyCall[]
  revoked: boolean
  lastUsed: string
  now: Date
  ctx?: CallContext
  onOpenRun?: (runId: string) => void
  onOpenAudit?: () => void
}) {
  const isMcp = ctx.key?.kind === "mcp"
  if (calls.length === 0) {
    const empty = revoked ? C.activity.noCallsRevoked : isMcp ? M.activity.noCalls : C.activity.noCalls
    return <p className="text-xs text-muted-foreground">{empty}</p>
  }
  if (isMcp) {
    return <McpActivity calls={calls} lastUsed={lastUsed} now={now} ctx={ctx} onOpenAudit={onOpenAudit} />
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{fillCopy(C.activity.header, { when: lastUsed })}</span>
        {onOpenAudit && (
          <button type="button" className="text-primary hover:underline" onClick={onOpenAudit}>
            {C.activity.auditLink}
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-muted/40">
        <table className="w-full text-left text-xs">
          <thead className="sr-only">
            <tr>
              <th scope="col">{C.activity.colTime}</th>
              <th scope="col">{C.activity.colVerb}</th>
              <th scope="col">{C.activity.colWorkflow}</th>
              <th scope="col">{C.activity.colRun}</th>
              <th scope="col">{C.activity.colResult}</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call, i) => {
              const words = callWords(call, { ...ctx, now })
              return (
                <tr key={`${call.at}-${i}`} className="border-t border-border/60 first:border-t-0">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-muted-foreground">{formatCallTime(call.at, now)}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono",
                        call.verb === "start" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {call.verb}
                    </span>
                  </td>
                  <td className="hidden px-3 py-1.5 md:table-cell">{call.workflow_name ?? C.activity.noWorkflow}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {call.run_id && onOpenRun ? (
                      <button
                        type="button"
                        className="font-mono text-primary hover:underline"
                        onClick={() => onOpenRun(call.run_id as string)}
                      >
                        {runCellText(call.run_id)}
                      </button>
                    ) : (
                      <span className={cn("font-mono", !call.run_id && "text-muted-foreground")}>{runCellText(call.run_id)}</span>
                    )}
                  </td>
                  <td className={cn("px-3 py-1.5", words.ok ? "text-success" : "text-[hsl(0_80%_80%)]")}>{words.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
