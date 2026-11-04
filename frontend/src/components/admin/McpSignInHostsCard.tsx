/**
 * Phase 307-05 (D-08, D-51; UI-SPEC Surface 5; A-18, A-19, A-25) — Control Room → Controls →
 * "AI tool sign-in: return addresses": the hosts an AI tool may send a member back to after sign-in.
 *
 * Mounted ONCE in `ControlRoomPage`, directly under the capability grid (beside the `mcp_enabled`
 * switch it qualifies) and above the maintenance panel, which stays spatially apart (065-A).
 * Self-contained on the `OrgMcpSwitchCard` shape: its own read and writes, an `alive` ref, and
 * `onRecorded()` after every server-confirmed write (the band pulse; the ledger row lands in Recent
 * actions — 062-A).
 *
 * ⛔ THE 066 GRADED GUARD. Allow address = DIRECT (reversible, no victim). Remove = ARM-TO-CONFIRM (the
 *   `MaintenancePanel` shape: a global effect on every member): the first click arms an inline prompt,
 *   focus moves to Keep, Esc disarms, and only the second, deliberate click writes.
 * ⛔ NEVER A GUESSED LIST (the 304 switch rule): a failed read renders the words and Retry, and no
 *   rows and no add control. NEVER OPTIMISTIC: a row appears or leaves only from the server's answer.
 * ⛔ THE CLIENT NEVER REWRITES INPUT (T-307-29): the typed value is sent verbatim; the server refuses
 *   a scheme, path, port, wildcard, uppercase, IP or loopback with a sentence shown here as is.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { allowSignInHost, getSignInHosts, removeSignInHost, type SignInHost } from "@/lib/api/oauth"
import { OAUTH_COPY } from "@/components/connect/oauthCopy"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { formatDay } from "@/components/settings/apiKeys/apiKeyFacts"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"

const H = OAUTH_COPY.hosts

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : ""
}

export function McpSignInHostsCard({ onRecorded }: { onRecorded?: () => void }) {
  const [hosts, setHosts] = useState<SignInHost[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [armedHost, setArmedHost] = useState<string | null>(null)
  const keepRef = useRef<HTMLButtonElement | null>(null)
  const alive = useRef(true)
  const showTechnical = useTechnicalNamesOptional()?.showTechnical ?? false

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      const res = await getSignInHosts()
      if (alive.current) setHosts(res.hosts)
    } catch {
      if (alive.current) setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  useEffect(() => {
    if (armedHost !== null) keepRef.current?.focus()
  }, [armedHost])

  async function write(run: () => Promise<{ hosts: SignInHost[] }>, onOk?: () => void) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      const res = await run()
      if (!alive.current) return
      setHosts(res.hosts)
      onOk?.()
      onRecorded?.()
    } catch (err) {
      if (alive.current) setFailure(fillCopy(H.saveFailed, { sentence: messageOf(err) }).trim())
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const typed = value // sent VERBATIM: the server validates, the client never rewrites
    void write(() => allowSignInHost(typed), () => setValue(""))
  }

  const now = new Date()

  return (
    <section
      data-testid="mcp-sign-in-hosts"
      aria-label={H.title}
      className="rounded-xl border border-border bg-card p-4"
    >
      <h4 className="font-headline text-base font-semibold text-foreground">{H.title}</h4>
      {showTechnical && <code className="mt-0.5 block font-mono text-xs text-muted-foreground">{H.technicalKey}</code>}
      <p className="mt-1 text-xs text-muted-foreground">{H.sub}</p>

      {hosts === null && !loadFailed && <p className="mt-3 text-xs text-muted-foreground">{H.loading}</p>}

      {loadFailed && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[hsl(0_80%_80%)]">
          <span>{H.loadFailed}</span>
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => void load()}>
            {H.retry}
          </Button>
        </div>
      )}

      {hosts !== null && !loadFailed && (
        <>
          {hosts.length === 0 ? (
            <p className="mt-3 text-xs text-warning">{H.empty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {hosts.map((h) => (
                <li key={h.host} data-testid={`sign-in-host-${h.host}`} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{h.host}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.built_in
                        ? H.builtIn
                        : h.added_by_name && h.added_at
                          ? fillCopy(H.addedBy, { name: h.added_by_name, date: formatDay(h.added_at, now) })
                          : H.addedByUnknown}
                    </span>
                    <span className="flex-1" />
                    {armedHost !== h.host && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-destructive"
                        aria-label={fillCopy(H.removeAria, { host: h.host })}
                        disabled={busy}
                        onClick={() => {
                          setFailure(null)
                          setArmedHost(h.host)
                        }}
                      >
                        {H.remove}
                      </Button>
                    )}
                  </div>
                  {armedHost === h.host && (
                    <div
                      data-testid="sign-in-host-armed"
                      aria-live="polite"
                      className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setArmedHost(null)
                      }}
                    >
                      <p className="text-sm text-foreground">{fillCopy(H.armed, { host: h.host })}</p>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Button
                          ref={keepRef}
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={fillCopy(H.keepAria, { host: h.host })}
                          onClick={() => setArmedHost(null)}
                          disabled={busy}
                        >
                          {fillCopy(H.keep, { host: h.host })}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => void write(() => removeSignInHost(h.host), () => setArmedHost(null))}
                        >
                          {fillCopy(H.confirmRemove, { host: h.host })}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={submit}>
            <Input
              className="h-9 max-w-xs font-mono"
              aria-label={H.inputAria}
              placeholder={H.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
            />
            <Button type="submit" variant="outline" disabled={busy || value === ""}>
              {H.add}
            </Button>
          </form>
          <p className="mt-1 text-xs text-muted-foreground">{H.hint}</p>
          {failure !== null && (
            <p data-testid="sign-in-hosts-failure" role="status" className="mt-1 text-xs text-[hsl(0_80%_80%)]">
              {failure}
            </p>
          )}
        </>
      )}
    </section>
  )
}
