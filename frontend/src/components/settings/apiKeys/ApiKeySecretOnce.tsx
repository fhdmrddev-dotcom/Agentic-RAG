/**
 * Phase 293-04 (D-19, T-293-21) — the just-created key, its secret shown ONCE, and ready `curl`.
 *
 * ⛔ THIS COMPONENT RECEIVES THE SECRET AS A PROP AND KEEPS IT NOWHERE ELSE. It writes no storage,
 *   no URL, no log; its only copy goes to the clipboard when the person asks. The owner of the
 *   secret is `ApiKeysTab`'s state, which drops it on "I've saved the secret", unmount or tab
 *   switch — so once this card is gone, the secret is gone from the page.
 *
 * The commands are built by `curlExamples.ts` from the real base URL, the real secret, the real
 * workflow id and that workflow's declared launch fields (UI-SPEC failure 2). Copy buttons show
 * `✓ Copied` / `Copy failed` for 2 s; a failure adds the copy-by-hand line under that block, and a
 * polite live region announces success.
 *
 * Phase 304-05 (D-19, D-27): for an MCP key the secret box, the warning, the live region and "I've
 * saved the secret" are the same, the chips are its scope, and `<McpConnectSnippets>` replaces the
 * two `curl` blocks, the status sample and the guide. The snippets get the server's MCP URL ONLY:
 * the secret is never handed to them (they read it from SYREL_MCP_KEY). A workflow key's card is
 * unchanged. `CopyButton` now lives in `McpConnectSnippets.tsx` (one control for both cards).
 */
import { useEffect, useRef, useState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ApiKeyRead, McpToolRef, StartableField } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { keyCardFacts } from "./apiKeyFacts"
import { startCurl, statusCurl, statusSampleJson } from "./curlExamples"
import { CopyButton, McpConnectSnippets, type CopyState } from "./McpConnectSnippets"

const C = API_KEYS_COPY
const COPY_STATE_MS = 2000

type CopyId = "secret" | "start" | "status"

export function ApiKeySecretOnce({
  created,
  secret,
  base,
  fields,
  onDone,
  mcpUrl = null,
  mcpTools,
}: {
  created: ApiKeyRead
  secret: string
  base: string
  /** The FIRST workflow's declared launch fields, in declared order. */
  fields: readonly StartableField[]
  onDone: () => void
  /** Phase 304: an MCP key's connection address (`list.mcp.url`); never the secret. */
  mcpUrl?: string | null
  /** Phase 304: the server's catalogue, for the scope chips' preset name. */
  mcpTools?: readonly McpToolRef[]
}) {
  const isMcp = created.kind === "mcp"
  const [copy, setCopy] = useState<Record<CopyId, CopyState>>({ secret: "idle", start: "idle", status: "idle" })
  const [announce, setAnnounce] = useState("")
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const first = created.workflows[0]
  const others = created.workflows.length - 1
  const start = first ? startCurl({ base, secret, workflowId: first.id, fields }) : ""
  const status = isMcp ? "" : statusCurl({ base, secret })
  const text: Record<CopyId, string> = { secret, start, status }

  async function doCopy(id: CopyId) {
    let ok = false
    try {
      await navigator.clipboard.writeText(text[id])
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

  const failedLine = (id: CopyId) =>
    copy[id] === "failed" ? <p className="mt-1 text-xs text-[hsl(0_80%_80%)]">{C.once.copyFailedLine}</p> : null

  return (
    <div data-testid="api-key-once" className="rounded-[14px] border border-warning/55 bg-warning/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className="font-headline text-base font-semibold">{created.label}</span>
        <span className="rounded-md border border-success/40 px-1.5 py-0.5 text-xs text-success">{C.once.tag}</span>
        <span className="font-mono text-xs text-muted-foreground">{created.key_prefix}…</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {isMcp
          ? keyCardFacts(created, new Date(), mcpTools).chips.map((chip) => (
              <span
                key={chip.id}
                data-testid="api-key-chip"
                title={chip.title}
                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs"
              >
                {chip.text}
              </span>
            ))
          : created.workflows.map((w) => (
              <span key={w.id} className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs">
                {w.name}
              </span>
            ))}
      </div>

      <p className="mt-4 text-sm text-warning">{C.once.warning}</p>

      <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-background p-3">
        <span data-testid="api-key-secret" className="flex-1 break-all font-mono text-sm">
          {secret}
        </span>
        <CopyButton state={copy.secret} label={C.once.copySecretLabel} onCopy={() => void doCopy("secret")} />
      </div>
      {failedLine("secret")}

      {isMcp && (
        <div className="mt-4">
          <McpConnectSnippets mcpUrl={mcpUrl} />
        </div>
      )}

      {!isMcp && first && (
        <>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {others > 0
                ? fillCopy(C.once.startHeaderMore, { workflow: first.name, N: others })
                : fillCopy(C.once.startHeader, { workflow: first.name })}
            </span>
            <CopyButton state={copy.start} label={C.once.copyStartLabel} onCopy={() => void doCopy("start")} />
          </div>
          <pre
            data-testid="curl-start"
            className="mt-1 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-[1.6]"
          >
            {start}
          </pre>
          {failedLine("start")}
        </>
      )}

      {!isMcp && (
        <>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{C.once.statusHeader}</span>
            <CopyButton state={copy.status} label={C.once.copyStatusLabel} onCopy={() => void doCopy("status")} />
          </div>
          <pre
            data-testid="curl-status"
            className="mt-1 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-[1.6]"
          >
            {status}
          </pre>
          {failedLine("status")}

          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">{C.once.sample}</summary>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-[1.6]">
              {statusSampleJson()}
            </pre>
          </details>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" className="gradient-primary" onClick={onDone}>
          {C.once.done}
        </Button>
        {!isMcp && (
          <a className="text-xs text-primary hover:underline" href={C.once.guideHref} target="_blank" rel="noopener noreferrer">
            {C.once.guide}
          </a>
        )}
      </div>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  )
}
