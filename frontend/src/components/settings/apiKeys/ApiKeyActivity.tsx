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

const C = API_KEYS_COPY

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
  if (calls.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{revoked ? C.activity.noCallsRevoked : C.activity.noCalls}</p>
    )
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
