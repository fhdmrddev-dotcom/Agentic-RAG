/**
 * Phase 304-05 (D-19, D-30; KEY-06) — the ONE switched-off sentence, wherever MCP being off is said:
 * the member tab's header (`member`), an MCP key card (`card`), the disabled kind tile (`tile`) and
 * the org admin's key list (`admin`, mounted by 304-06).
 *
 * Words only from `MCP_KEY_COPY`; they begin with the server's own refusal sentences
 * (`principal_liveness.py`), so the screen and a refused tool call say the same thing. The caller
 * passes the scope the server reported; the deployment's wins over the org's — the server applies
 * that one order both to `mcp_off` and to a refused call (`principal_still_allowed`, 304-REVIEW
 * WR-03), so with both switches off the two name the same switch. A 12px warning line, colour
 * never the only signal (it is words).
 */
import type { McpOff } from "@/lib/api/apiKeys"
import { cn } from "@/lib/utils"
import { fillCopy } from "./apiKeysCopy"
import { MCP_KEY_COPY } from "./mcpKeyCopy"

const M = MCP_KEY_COPY.mcp

export type McpOffVariant = "member" | "card" | "tile" | "admin"

export function mcpOffSentence(scope: McpOff, variant: McpOffVariant, orgName?: string | null): string {
  if (variant === "card") return scope === "deployment" ? M.offDeployment : M.offOrg
  if (variant === "admin" && scope === "org") return fillCopy(M.offAdmin, { org: orgName || M.orgFallback })
  return scope === "deployment" ? M.offTileDeployment : M.offTileOrg
}

export function McpOffNotice({
  scope,
  variant = "member",
  orgName,
  className,
}: {
  scope: McpOff | null
  variant?: McpOffVariant
  orgName?: string | null
  className?: string
}) {
  if (!scope) return null
  return (
    <p data-testid="mcp-off-notice" data-scope={scope} className={cn("text-xs text-warning", className)}>
      {mcpOffSentence(scope, variant, orgName)}
    </p>
  )
}
