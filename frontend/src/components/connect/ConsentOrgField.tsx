/**
 * Phase 307-03 (OAUTH-04; D-13; UI-SPEC §1a item 3, A-5) — which organisation the app acts in.
 *
 * One switched-on org (and nothing else) is a read-only fact. Otherwise a `role="radiogroup"` of radio
 * rows with roving tabindex and arrow keys (the 304 radio-row shape). ⛔ A switched-off org is NEVER
 * hidden: its row stays listed, `aria-disabled`, and carries the 304 sentence linked by
 * `aria-describedby`; clicks and arrow keys pass it by. The sentence is read from `MCP_KEY_COPY`, its
 * one home, never retyped.
 */
import { useId, useRef, type KeyboardEvent } from "react"

import { MCP_KEY_COPY } from "@/components/settings/apiKeys/mcpKeyCopy"
import type { ConsentOrg } from "@/lib/api/oauth"
import { cn } from "@/lib/utils"
import { OAUTH_COPY } from "./oauthCopy"

const C = OAUTH_COPY.consent

export function ConsentOrgField({
  orgs,
  value,
  onChange,
  disabled = false,
}: {
  orgs: readonly ConsentOrg[]
  value: string | null
  onChange: (orgId: string) => void
  disabled?: boolean
}) {
  const labelId = useId()
  const whyId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const on = orgs.filter((o) => o.mcp_off === null)

  if (orgs.length === 1 && on.length === 1) {
    return (
      <div className="grid gap-2">
        <span id={labelId} className="text-xs text-foreground">
          {C.orgField}
        </span>
        <b data-testid="consent-org-fact" className="text-sm font-bold">
          {orgs[0].name}
        </b>
      </div>
    )
  }

  // The row that holds the tab stop: the selected org, else the first switched-on one.
  const tabStop = orgs.findIndex((o) => o.id === value && o.mcp_off === null)
  const focusable = tabStop >= 0 ? tabStop : orgs.findIndex((o) => o.mcp_off === null)

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0
    if (!delta || disabled) return
    e.preventDefault()
    for (let step = 1; step <= orgs.length; step += 1) {
      const next = (i + delta * step + orgs.length * step) % orgs.length
      if (orgs[next].mcp_off === null) {
        onChange(orgs[next].id)
        refs.current[next]?.focus()
        return
      }
    }
  }

  return (
    <div className="grid gap-2">
      <span id={labelId} className="text-xs text-foreground">
        {C.orgField}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid max-h-[208px] gap-1 overflow-y-auto">
        {orgs.map((o, i) => {
          const off = o.mcp_off !== null
          const checked = !off && o.id === value
          const reasonId = `${whyId}-${i}`
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={off || disabled ? true : undefined}
              aria-describedby={off ? reasonId : undefined}
              tabIndex={i === focusable ? 0 : -1}
              onClick={() => {
                if (!off && !disabled) onChange(o.id)
              }}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex min-h-[44px] w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0",
                checked ? "border-primary ring-1 ring-primary" : "border-border",
                off ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 flex-none rounded-full border",
                  checked ? "border-primary bg-primary" : "border-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block break-words", off && "opacity-[0.62]")}>{o.name}</span>
                {off && (
                  <span id={reasonId} className="mt-0.5 block text-xs text-warning">
                    {MCP_KEY_COPY.mcp.offTileOrg}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
