/**
 * Phase 304-05 (KEY-01; D-27, D-28, D-29, D-45; UI-SPEC §1d) — "Connect a tool": the per-client
 * setup for an MCP key, used by the show-once card and by an MCP card's "How to connect".
 *
 * ⛔ THIS COMPONENT NEVER RECEIVES THE KEY (T-293-21, T-304-37). Its one data prop is the server's
 *   MCP URL (`list.mcp.url`, D-28). The snippet text comes from `mcpSnippets.ts`, whose builders take
 *   `(mcpUrl, SYREL_MCP_ENV)` and nothing else, so every snippet reads the key from the environment
 *   variable through that client's own syntax and sends it in a header, never in the URL (T-304-38).
 *   That is also why the snippets may be shown again after the show-once card is gone.
 *
 *  · tabs are WORDS only (no client logos: the icon convention has no editor marks), Claude Code
 *    first; Claude Desktop carries the warning chip "Workaround" and leads with the bridge line;
 *  · three numbered steps per tab: the env variable, where the snippet goes (with Copy), and how to
 *    reload. Claude Desktop's config can't read the environment, so its first step says so;
 *  · the Claude.ai organisation-connector warning (D-29) is a note under the tabs, on every tab and
 *    in the no-address state;
 *  · no public address (or one that could carry anything but an address) → the no-address line.
 *
 * `CopyButton` lives here (lifted from `ApiKeySecretOnce`, which imports it back), so both cards share
 * one `✓ Copied` / `Copy failed` control without a circular import.
 */
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import {
  MCP_CLIENTS,
  MCP_REMOTE_VERSION,
  MCP_SNIPPET_BUILDERS,
  SYREL_MCP_ENV,
  claudeCodeCliSnippet,
  safeMcpUrl,
  type McpClient,
} from "./mcpSnippets"

const C = API_KEYS_COPY
const M = MCP_KEY_COPY.mcp
const COPY_STATE_MS = 2000

export type CopyState = "idle" | "done" | "failed"

/** The shipped 293 Copy control: `✓ Copied` / `Copy failed` for 2 s, an aria-label per block. */
export function CopyButton({ state, label, onCopy }: { state: CopyState; label: string; onCopy: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-7 px-2 text-xs", state === "done" && "text-success", state === "failed" && "text-[hsl(0_80%_80%)]")}
      aria-label={label}
      onClick={onCopy}
    >
      {state === "done" ? C.once.copied : state === "failed" ? C.once.copyFailed : C.once.copy}
    </Button>
  )
}

type BlockId = McpClient | "claudeCodeCli"

function Block({
  id,
  text,
  label,
  header,
  state,
  onCopy,
}: {
  id: BlockId
  text: string
  label: string
  header?: string
  state: CopyState
  onCopy: () => void
}) {
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{header}</span>
        <CopyButton state={state} label={label} onCopy={onCopy} />
      </div>
      <pre
        data-testid={`mcp-snippet-${id}`}
        className="mt-1 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-[1.6]"
      >
        {text}
      </pre>
      {state === "failed" && <p className="mt-1 text-xs text-[hsl(0_80%_80%)]">{C.once.copyFailedLine}</p>}
    </div>
  )
}

export function McpConnectSnippets({ mcpUrl }: { mcpUrl: string | null }) {
  const url = safeMcpUrl(mcpUrl)
  const [copy, setCopy] = useState<Partial<Record<BlockId, CopyState>>>({})
  const [announce, setAnnounce] = useState("")
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  async function doCopy(id: BlockId, text: string) {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = false
    }
    setCopy((c) => ({ ...c, [id]: ok ? "done" : "failed" }))
    setAnnounce(ok ? C.once.copiedAnnounce : "")
    timers.current.push(
      window.setTimeout(() => {
        setCopy((c) => ({ ...c, [id]: "idle" }))
        setAnnounce("")
      }, COPY_STATE_MS),
    )
  }

  const block = (id: BlockId, text: string, label: string, header?: string) => (
    <Block id={id} text={text} label={label} header={header} state={copy[id] ?? "idle"} onCopy={() => void doCopy(id, text)} />
  )

  return (
    <div data-testid="mcp-connect" className="grid gap-2">
      <p className="text-xs text-muted-foreground">{M.connectHeading}</p>

      {url === null ? (
        <p className="text-sm">{M.noAddress}</p>
      ) : (
        <Tabs defaultValue="claudeCode">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {MCP_CLIENTS.map((c) => (
              <TabsTrigger key={c} value={c} className="gap-1">
                {M.clients[c]}
                {c === "desktop" && (
                  <span className="rounded-md border border-warning/50 px-1 text-xs text-warning">{M.workaroundChip}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {MCP_CLIENTS.map((c) => {
            const name = M.clients[c]
            const text = MCP_SNIPPET_BUILDERS[c](url, SYREL_MCP_ENV)
            return (
              <TabsContent key={c} value={c} className="mt-2">
                {c === "desktop" && <p className="mb-2 text-xs text-warning">{M.desktopLead}</p>}
                <ol className="grid list-decimal gap-2 pl-5 text-xs text-muted-foreground">
                  <li>{c === "desktop" ? M.stepEnvDesktop : fillCopy(M.stepEnv, { env: SYREL_MCP_ENV })}</li>
                  <li>
                    {M.stepPlace[c]}
                    {block(c, text, fillCopy(M.copySetup, { client: name }))}
                    {c === "claudeCode" &&
                      block("claudeCodeCli", claudeCodeCliSnippet(url, SYREL_MCP_ENV), fillCopy(M.copyCli, { client: name }), M.cliHeading)}
                    {c === "desktop" && MCP_REMOTE_VERSION === null && (
                      <p className="mt-1 text-xs text-warning">{M.desktopUnverified}</p>
                    )}
                  </li>
                  <li>{M.stepReload[c]}</li>
                </ol>
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      <div role="note" className="rounded-md border border-warning/55 bg-warning/[0.04] px-3 py-2 text-sm">
        {M.claudeAiWarning}
      </div>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  )
}
