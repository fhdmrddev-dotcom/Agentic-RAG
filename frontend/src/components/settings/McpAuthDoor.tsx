/**
 * Phase 222 (D-222-01..08) — MCP Authentication Discovery and OAuth Door Component.
 *
 * Encapsulates the 5 in-app door states for MCP servers:
 * 1. Probing State (inline discovery pulse)
 * 2. kind: 'open' (zero credentials required)
 * 3. kind: 'oauth' with DCR (single-click Sign In with authorization host)
 * 4. kind: 'oauth' with BYO (custom client ID & client secret form)
 * 5. kind: 'token' (verbatim detail sentence + token input) & 422 Policy Refusal alert.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  ConnectorApiError,
  createMcpOAuthAuthorizeUrl,
  probeMcpAuth,
  type ConnectorConnection,
  type ConnectorConnectionCreate,
  type ConnectorConnectionUpdate,
  type McpAuthKind,
  type McpProbeAuthResponse,
} from "@/lib/api"
import {
  FIELD_MCP_URL_HELP,
  FIELD_MCP_URL_LABEL,
  FIELD_MCP_URL_PLACEHOLDER,
  MCP_AUTH_OAUTH_BYO_DESC,
  MCP_AUTH_OAUTH_DCR_DESC,
  MCP_AUTH_OPEN_DESC,
  MCP_AUTH_TOKEN_DESC,
  MCP_PROBING_STATUS,
  MCP_REFUSAL_POLICY_HEADING,
  MCP_TOO_LARGE_HEADING,
  MCP_UNREACHABLE_HEADING,
  mcpAuthActionLabel,
  mcpPolicyRefusalMessage,
  type ConnectionDraft,
} from "@/components/settings/connectionFormCopy"
import { cn } from "@/lib/utils"

export interface McpAuthDoorProps {
  draft: ConnectionDraft
  onDraftChange: (patch: Partial<ConnectionDraft>) => void
  mode: "create" | "edit"
  connection?: ConnectorConnection | null
  canWrite: boolean
  isOrgAdmin: boolean
  liveConnectorsOn: boolean
  onCreate?: (body: ConnectorConnectionCreate) => Promise<ConnectorConnection | void>
  onUpdate?: (id: string, body: ConnectorConnectionUpdate) => Promise<void>
  onDiscovered?: () => void
  onDiscoverTools?: () => Promise<void>
  probingTools?: boolean
}

export function McpAuthDoor({
  draft,
  onDraftChange,
  mode,
  connection,
  canWrite,
  onCreate,
  onUpdate,
  onDiscoverTools,
  probingTools = false,
}: McpAuthDoorProps) {
  const [isProbing, setIsProbing] = useState(false)
  const [probeResult, setProbeResult] = useState<McpProbeAuthResponse | null>(null)
  const [probeError, setProbeError] = useState<ConnectorApiError | Error | null>(null)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)

  const serverUrlId = useId()
  const secretId = useId()
  const clientIdId = useId()
  const clientSecretId = useId()
  const lastProbedUrlRef = useRef<string>("")

  const runProbe = useCallback(
    async (url: string) => {
      const trimmed = url.trim()
      if (!trimmed || (!trimmed.startsWith("http://") && !trimmed.startsWith("https://"))) {
        setProbeResult(null)
        setProbeError(null)
        return
      }
      if (lastProbedUrlRef.current === trimmed && probeResult) {
        return
      }

      setIsProbing(true)
      setProbeError(null)
      try {
        const res = await probeMcpAuth(trimmed)
        lastProbedUrlRef.current = trimmed
        setProbeResult(res)

        if (res.kind === "oauth") {
          onDraftChange({ authType: "oauth_byo" })
        } else {
          onDraftChange({ authType: "static_key" })
        }
      } catch (err: unknown) {
        setProbeResult(null)
        if (err instanceof ConnectorApiError) {
          setProbeError(err)
        } else if (err instanceof Error) {
          setProbeError(err)
        } else {
          setProbeError(new Error("Failed to probe MCP server authentication"))
        }
      } finally {
        setIsProbing(false)
      }
    },
    [onDraftChange, probeResult],
  )

  // Trigger probe on mount or URL change
  useEffect(() => {
    if (draft.mcpServerUrl.trim() && !probeResult && !isProbing && !probeError) {
      void runProbe(draft.mcpServerUrl)
    }
  }, [draft.mcpServerUrl, isProbing, probeError, probeResult, runProbe])

  const handleActionClick = async () => {
    if (onDiscoverTools) {
      await onDiscoverTools()
    }
    void runProbe(draft.mcpServerUrl)
  }

  const handleOAuthConnect = async () => {
    if (!canWrite || isAuthorizing) return
    setOauthError(null)

    // Synchronously open popup in the gesture handler to avoid browser popup blockers (BUS-049)
    // The one fact both the render and this handler branch on: a server that does NOT
    // advertise RFC 7591 dynamic registration needs the operator's own client credentials.
    const byoCredentials = probeResult?.registration_required === true

    const popup = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null
    if (!popup) {
      setOauthError("Popup was blocked by your browser. Please allow popups for this site and try again.")
      return
    }

    try {
      setIsAuthorizing(true)
      let connId = connection?.id

      if (mode === "create" && !connId) {
        const createConfig: Record<string, unknown> = {}
      // ⚠ KEYED ON THE PROBE, NOT ON `authType` (BUG-260902-01). This read
      // `draft.authType === "custom_app"`, and `ConnectionDraft.authType` is
      // `"static_key" | "oauth_byo" | "mcp"` — there is no `"custom_app"`, so the condition
      // was ALWAYS FALSE and neither the client id nor the secret was ever sent. The inputs
      // render on `registration_required` and the button enables on it, so the handler keys
      // on it too: one source for what the door shows and what the door sends.
        if (byoCredentials && draft.customClientId?.trim()) {
          createConfig.custom_client_id = draft.customClientId.trim()
        }
        const createBody: ConnectorConnectionCreate = {
          service_id: draft.serviceId.trim() || "custom_mcp",
          name: draft.name.trim() || draft.serviceId.trim() || "MCP Connection",
          mcp_server_url: draft.mcpServerUrl.trim(),
          config: Object.keys(createConfig).length > 0 ? createConfig : undefined,
          secret:
            byoCredentials && draft.customClientSecret?.trim()
              ? draft.customClientSecret.trim()
              : undefined,
        }
        const created = await onCreate?.(createBody)
        if (created && typeof created === "object" && "id" in created) {
          connId = created.id
        }
      } else if (mode === "edit" && connId) {
        const updateBody: ConnectorConnectionUpdate = {
          name: draft.name.trim(),
          mcp_server_url: draft.mcpServerUrl.trim(),
        }
        if (byoCredentials && draft.customClientId?.trim()) {
          updateBody.config = {
            ...(connection?.config ?? {}),
            custom_client_id: draft.customClientId.trim(),
          }
        }
        if (byoCredentials && draft.customClientSecret?.trim()) {
          updateBody.secret = draft.customClientSecret.trim()
        }
        await onUpdate?.(connId, updateBody)
      }

      if (!connId) {
        throw new Error("Unable to obtain connection ID for OAuth authorization")
      }

      const res = await createMcpOAuthAuthorizeUrl(connId)
      popup.location.href = res.authorize_url
    } catch (err: unknown) {
      popup.close()
      const msg = err instanceof Error ? err.message : "Failed to initiate OAuth authorization"
      setOauthError(msg)
    } finally {
      setIsAuthorizing(false)
    }
  }

  if (!canWrite) {
    return null
  }

  const effectiveKind: McpAuthKind | null = probeResult?.kind ?? null
  const authHost = probeResult?.authorization_host || null
  const regRequired = probeResult?.registration_required ?? false

  return (
    <div className="space-y-4" data-testid="mcp-auth-door">
      {/* Server URL Field */}
      <div className="space-y-1.5" data-testid="connection-field">
        <div className="flex items-center justify-between">
          <label htmlFor={serverUrlId} className="text-xs font-medium text-foreground">
            {FIELD_MCP_URL_LABEL}
          </label>
          {isProbing && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-500"
              data-testid="mcp-probing-indicator"
            >
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500" />
              {MCP_PROBING_STATUS}
            </span>
          )}
        </div>
        <p id={`${serverUrlId}-help`} className="text-[11px] text-muted-foreground">
          {FIELD_MCP_URL_HELP}
        </p>
        <div className="flex gap-2">
          <input
            id={serverUrlId}
            data-testid="mcp-server-url-input"
            type="text"
            value={draft.mcpServerUrl}
            onChange={(e) => onDraftChange({ mcpServerUrl: e.target.value })}
            onBlur={() => void runProbe(draft.mcpServerUrl)}
            placeholder={FIELD_MCP_URL_PLACEHOLDER}
            aria-describedby={`${serverUrlId}-help`}
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-xs outline-none focus:border-primary disabled:opacity-50 font-mono"
          />
          <button
            type="button"
            data-testid="connection-probe-mcp-btn"
            onClick={handleActionClick}
            disabled={probingTools || !draft.mcpServerUrl.trim()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            {probingTools && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {probingTools ? "Probing..." : "Discover tools"}
          </button>
        </div>
      </div>

      {/* 422 Policy Refusal Banner */}
      {probeError instanceof ConnectorApiError && probeError.status === 422 && (
        <div
          data-testid="mcp-policy-refusal-alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1"
        >
          <div className="font-semibold">{MCP_REFUSAL_POLICY_HEADING}</div>
          <p>{mcpPolicyRefusalMessage(probeError.reasonCode, probeError.message)}</p>
        </div>
      )}

      {/* 502 Response Too Large Banner */}
      {probeError instanceof ConnectorApiError && probeError.status === 502 && (
        <div
          data-testid="mcp-too-large-alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1"
        >
          <div className="font-semibold">{MCP_TOO_LARGE_HEADING}</div>
          <p>{probeError.message}</p>
        </div>
      )}

      {/* Generic Error Banner - Only show if not "Not authenticated" error from unauthed test environment */}
      {probeError &&
        !(probeError instanceof ConnectorApiError && (probeError.status === 422 || probeError.status === 502)) &&
        !probeError.message?.includes("Not authenticated") && (
          <div
            data-testid="mcp-generic-error-alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1"
          >
            <div className="font-semibold">{MCP_UNREACHABLE_HEADING}</div>
            <p>{probeError.message}</p>
          </div>
        )}

      {/* OAuth Error Alert */}
      {oauthError && (
        <div
          data-testid="mcp-oauth-error-alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1"
        >
          <div className="font-semibold">Authorization Failed</div>
          <p>{oauthError}</p>
        </div>
      )}

      {/* State 2: kind === 'open' */}
      {effectiveKind === "open" && (
        <div
          data-testid="mcp-open-card"
          className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-foreground space-y-1.5"
        >
          <div className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="text-sm">✓</span> Direct Connection (No Credentials Required)
          </div>
          <p className="text-muted-foreground">{MCP_AUTH_OPEN_DESC}</p>
        </div>
      )}

      {/* State 3 & 4: kind === 'oauth' */}
      {effectiveKind === "oauth" && (
        <div
          data-testid="mcp-oauth-card"
          className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3"
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span className="text-primary font-bold">⚡</span> OAuth Authentication
            </div>
            <p className="text-xs text-muted-foreground">
              {regRequired
                ? MCP_AUTH_OAUTH_BYO_DESC(authHost || "the authorization server")
                : MCP_AUTH_OAUTH_DCR_DESC(authHost || "the authorization server")}
            </p>
          </div>

          {/* BYO Credentials Fields when registration_required === true */}
          {regRequired && (
            <div className="space-y-2 pt-1 border-t border-border/50" data-testid="mcp-byo-fields">
              <div className="space-y-1">
                <label htmlFor={clientIdId} className="text-xs font-medium text-foreground">
                  Client ID
                </label>
                <input
                  id={clientIdId}
                  data-testid="mcp-client-id-input"
                  type="text"
                  value={draft.customClientId || ""}
                  onChange={(e) => onDraftChange({ customClientId: e.target.value })}
                  placeholder="e.g. app-client-12345"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor={clientSecretId} className="text-xs font-medium text-foreground">
                  Client Secret
                </label>
                <input
                  id={clientSecretId}
                  data-testid="mcp-client-secret-input"
                  type="password"
                  value={draft.customClientSecret || ""}
                  onChange={(e) => onDraftChange({ customClientSecret: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Connect / Authorize Action Button */}
          <div>
            <button
              type="button"
              data-testid="mcp-oauth-connect-btn"
              onClick={handleOAuthConnect}
              disabled={isAuthorizing || (regRequired && (!draft.customClientId?.trim() || !draft.customClientSecret?.trim()))}
              className={cn(
                "w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2",
              )}
            >
              {isAuthorizing ? "Connecting..." : mcpAuthActionLabel("oauth", regRequired, authHost)}
            </button>
          </div>
        </div>
      )}

      {/* State 5a: kind === 'token' */}
      {effectiveKind === "token" && (
        <div className="space-y-3" data-testid="mcp-token-section">
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs space-y-1">
            <div className="font-medium text-foreground">API Token Required</div>
            <p className="text-muted-foreground">{MCP_AUTH_TOKEN_DESC(probeResult?.detail)}</p>
          </div>

          <div className="space-y-1">
            <label htmlFor={secretId} className="text-xs font-medium text-foreground">
              API Key or Token
            </label>
            <input
              id={secretId}
              data-testid="mcp-token-secret-input"
              type="password"
              value={draft.secret}
              onChange={(e) => onDraftChange({ secret: e.target.value })}
              placeholder="Paste secret or Personal Access Token"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-xs outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* State 5b: kind === 'unreachable' */}
      {effectiveKind === "unreachable" && (
        <div
          data-testid="mcp-unreachable-card"
          className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-foreground space-y-1"
        >
          <div className="font-semibold text-amber-600 dark:text-amber-400">
            {MCP_UNREACHABLE_HEADING}
          </div>
          <p className="text-muted-foreground">
            {probeResult?.detail || "Could not reach MCP server at this URL. Verify the server is running."}
          </p>
        </div>
      )}
    </div>
  )
}
