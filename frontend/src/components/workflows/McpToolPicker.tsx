/**
 * Phase 206 (CONN-02 / CONN-03 / D-206-05 / D-206-06 / F-1 / F-2 / F-7) —
 * McpToolPicker: Leaf component for discovering, selecting, and configuring MCP tools.
 *
 * ── ZERO-HOOK PIN DELEGATION (F-7) ──
 * `PhaseFormPanel.tsx` has a strict zero-hook pin (0 useState / 0 useEffect / 0 useMemo)
 * guarded by `PhaseFormPanel.test.tsx:668`. All state for tool discovery, selection,
 * argument editing, and grant verification lives exclusively inside this leaf component.
 *
 * ── PER-TOOL GRANT PREDICATE (F-1 / F-2) ──
 * Boolean mapping `{ [tool_name: string]: boolean }`.
 * Evaluated strictly via `Object.prototype.hasOwnProperty.call(grants, toolName) && Boolean(grants[toolName])`.
 */

import { useCallback, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { discoverConnectorTools } from "@/lib/api"
import type { ConnectorConnection, McpDiscoveredTool } from "@/lib/api"

export const MCP_TOOL_PICKER_HEADING = "MCP Tool & Action"
export const MCP_DISCOVER_BUTTON_LABEL = "Discover Tools"
export const MCP_DISCOVERING_LABEL = "Discovering tools…"
export const MCP_NO_TOOLS_DISCOVERED =
  "No tools discovered yet. Click Discover Tools to fetch available actions from the remote server."
export const MCP_TOOL_SELECT_LABEL = "Select Tool"
export const MCP_TOOL_NONE_OPTION = "— choose a tool —"
export const MCP_GRANT_GRANTED_LABEL = "Permission Granted"
export const MCP_GRANT_DENIED_LABEL = "Permission Not Granted"
export const MCP_GRANT_DENIED_WARNING =
  "This tool is not granted permission on this connection. Execution will be refused by policy at run time."
export const MCP_TOOL_ARGS_LABEL = "Tool Arguments (JSON)"

export interface McpToolPickerProps {
  connection: ConnectorConnection | null
  toolName?: string | null
  toolArgs?: Record<string, unknown> | null
  onSelectTool?: (toolName: string) => void
  onChangeArgs?: (args: Record<string, unknown>) => void
  disabled?: boolean
}

/** Check whether a tool is granted permission strictly per F-1 / F-2. */
export function isToolGranted(
  grants: Record<string, boolean> | undefined | null,
  toolName: string | null | undefined,
): boolean {
  if (!grants || !toolName) return false
  return (
    Object.prototype.hasOwnProperty.call(grants, toolName) &&
    Boolean(grants[toolName])
  )
}

export function McpToolPicker({
  connection,
  toolName = "",
  toolArgs = {},
  onSelectTool,
  onChangeArgs,
  disabled = false,
}: McpToolPickerProps) {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [localDiscoveredTools, setLocalDiscoveredTools] = useState<
    McpDiscoveredTool[] | null
  >(null)
  const [argsJsonString, setArgsJsonString] = useState<string>(() =>
    toolArgs && Object.keys(toolArgs).length > 0
      ? JSON.stringify(toolArgs, null, 2)
      : ""
  )
  const [jsonError, setJsonError] = useState<string | null>(null)

  const tools: McpDiscoveredTool[] =
    localDiscoveredTools ?? connection?.discovered_tools ?? []

  const handleDiscover = useCallback(async () => {
    if (!connection?.id) return
    setIsDiscovering(true)
    setDiscoveryError(null)
    try {
      const result = await discoverConnectorTools(connection.id)
      setLocalDiscoveredTools(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to discover tools"
      setDiscoveryError(msg)
    } finally {
      setIsDiscovering(false)
    }
  }, [connection?.id])

  const handleToolChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = e.target.value
      if (onSelectTool) {
        onSelectTool(selected)
      }
    },
    [onSelectTool]
  )

  const handleArgsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value
      setArgsJsonString(val)
      if (!val.trim()) {
        setJsonError(null)
        if (onChangeArgs) onChangeArgs({})
        return
      }
      try {
        const parsed = JSON.parse(val)
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          setJsonError(null)
          if (onChangeArgs) onChangeArgs(parsed as Record<string, unknown>)
        } else {
          setJsonError("Arguments must be a JSON object")
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid JSON syntax"
        setJsonError(msg)
      }
    },
    [onChangeArgs]
  )

  if (!connection?.mcp_server_url) {
    return null
  }

  const selectedTool = tools.find((t) => t.name === toolName)
  const isGranted = isToolGranted(connection.tool_grants, toolName)

  return (
    <div
      data-testid="mcp-tool-picker"
      className="mt-3 flex flex-col gap-2.5 rounded-md border border-border bg-card/60 p-3 text-xs"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Wrench className="h-3.5 w-3.5 text-primary" />
          <span>{MCP_TOOL_PICKER_HEADING}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="mcp-discover-btn"
          disabled={disabled || isDiscovering || !connection.id}
          onClick={handleDiscover}
          className="h-6 gap-1 px-2 text-[11px]"
        >
          <RefreshCw
            className={`h-3 w-3 ${isDiscovering ? "animate-spin" : ""}`}
          />
          <span>
            {isDiscovering
              ? MCP_DISCOVERING_LABEL
              : MCP_DISCOVER_BUTTON_LABEL}
          </span>
        </Button>
      </div>

      {discoveryError && (
        <p
          role="alert"
          data-testid="mcp-discovery-error"
          className="text-[11px] text-destructive"
        >
          {discoveryError}
        </p>
      )}

      {tools.length === 0 ? (
        <p
          data-testid="mcp-no-tools"
          className="text-[11px] text-muted-foreground"
        >
          {MCP_NO_TOOLS_DISCOVERED}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="mcp-tool-select"
            className="text-[11px] font-normal text-muted-foreground"
          >
            {MCP_TOOL_SELECT_LABEL}
          </Label>
          <select
            id="mcp-tool-select"
            data-testid="mcp-tool-select"
            value={toolName || ""}
            disabled={disabled}
            onChange={handleToolChange}
            className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{MCP_TOOL_NONE_OPTION}</option>
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {toolName && (
        <div className="mt-1 flex flex-col gap-2">
          {/* Grant Status Indicator */}
          <div
            data-testid="mcp-grant-status"
            data-granted={isGranted ? "true" : "false"}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
              isGranted
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isGranted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{MCP_GRANT_GRANTED_LABEL}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-medium">{MCP_GRANT_DENIED_LABEL}</div>
                  <div className="text-[10px] leading-tight text-muted-foreground">
                    {MCP_GRANT_DENIED_WARNING}
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedTool?.description && (
            <p
              data-testid="mcp-tool-description"
              className="text-[11px] text-muted-foreground"
            >
              {selectedTool.description}
            </p>
          )}

          {/* Tool Arguments Input */}
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="mcp-tool-args"
              className="text-[11px] font-normal text-muted-foreground"
            >
              {MCP_TOOL_ARGS_LABEL}
            </Label>
            <Textarea
              id="mcp-tool-args"
              data-testid="mcp-tool-args"
              value={argsJsonString}
              disabled={disabled}
              placeholder='{ "key": "value" }'
              onChange={handleArgsChange}
              rows={3}
              className="font-mono text-[11px]"
            />
            {jsonError && (
              <p
                role="alert"
                data-testid="mcp-args-error"
                className="text-[10px] text-destructive"
              >
                {jsonError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default McpToolPicker
