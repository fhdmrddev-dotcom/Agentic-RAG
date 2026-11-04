/**
 * Phase 308-05 (HOOK-01, HOOK-02, HOOK-04, HOOK-05; D-04, D-12, D-19, D-27..D-29) — Settings →
 * Webhooks, the member's ONE home for webhook endpoints (sketch 308-webhooks winner A).
 *
 * Self-contained on the `ApiKeysTab` shape: it owns its read (`listWebhooks`), guards every setState
 * with an `alive` ref, and a failed re-read keeps what it last knew. Unlike `ApiKeysTab` it RE-READS
 * WHEN THE ACTIVE ORG CHANGES (P-2): an endpoint belongs to one org (D-04), so the load effect is
 * keyed on `org?.activeOrgId`, and a switch drops the list, the open card and any open secret.
 *
 * ⚠ NEVER OPTIMISTIC. Every write changes the screen only from the server's answer; failures keep
 *   the screen and say so in the server's words; receipts read "✎ … · recorded".
 * ⚠ THE ADDRESS IS TEXT, NEVER A LINK — here, on the card, in the sheets and in the log.
 * ⛔ THE SECRET (T-308-06). The just-created secret lives in THIS component's `useState` and is handed
 *   to `WebhookSecretOnce` as a prop — the secret lives in one component's props and nowhere else: no
 *   storage, no URL, no log, no cache. It is dropped on "I've saved the secret", on an org switch and on
 *   unmount (a Settings tab switch or a reload), so it can never be shown twice. Re-reads of
 *   `/webhooks` never carry one.
 * ⚠ The "Waiting on you" focus hint is read ONCE on mount (`readWebhookFocusOnce` clears it in the
 *   same read), and again whenever one is written while this tab is open (`WEBHOOK_FOCUS_EVENT`,
 *   308-REVIEW WR-06): in this org it opens and scrolls to that card; in another it says so with
 *   "Switch to {org}" (the `ElsewhereLine` behaviour: no navigation, the list re-reads).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Webhook } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  sendWebhookTest,
  type WebhookBody,
  type WebhookEndpoint,
  type WebhookList,
} from "@/lib/api/webhooks"
import { useOrgOptional } from "@/providers/OrgProvider"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { hostOf, memberAddress, slotParts } from "./webhookFacts"
import { readWebhookFocusOnce, WEBHOOK_FOCUS_EVENT, type WebhookFocus } from "./webhookFocus"
import { WEBHOOKS_COPY } from "./webhooksCopy"
import { DeleteWebhookSheet } from "./DeleteWebhookSheet"
import { WebhookEndpointCard } from "./WebhookEndpointCard"
import { WebhookEndpointForm } from "./WebhookEndpointForm"
import { WebhookSecretOnce } from "./WebhookSecretOnce"

const C = WEBHOOKS_COPY
const T = C.tab

interface JustCreated {
  endpoint: WebhookEndpoint
  secret: string
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : ""
}

function newestFirst(a: WebhookEndpoint, b: WebhookEndpoint): number {
  return b.created_at.localeCompare(a.created_at)
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
}

export function WebhooksTab({ onOpenRun }: { onOpenRun?: (runId: string) => void }) {
  const org = useOrgOptional()
  const activeOrgId = org?.activeOrgId ?? null
  const [list, setList] = useState<WebhookList | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [justCreated, setJustCreated] = useState<JustCreated | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null)
  const [deletedHost, setDeletedHost] = useState<string | null>(null)
  const [focus, setFocus] = useState<WebhookFocus | null>(null)
  const alive = useRef(true)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const toggles = useRef(new Map<string, HTMLButtonElement>())
  const capWhyId = "webhooks-cap-why"

  // The org the shown list belongs to. A read answered after a switch belongs to the OLD org and is
  // dropped, and the focus hint only acts on a list read for the org it names.
  const orgRef = useRef(activeOrgId)
  const [listOrg, setListOrg] = useState<string | null | undefined>(undefined)

  const load = useCallback(async () => {
    const forOrg = orgRef.current
    try {
      const res = await listWebhooks()
      if (!alive.current || orgRef.current !== forOrg) return
      setList(res)
      setListOrg(forOrg)
      setLoadError(null)
    } catch (err) {
      if (alive.current && orgRef.current === forOrg) setLoadError(messageOf(err)) // keep the last-known list
    }
  }, [])

  useEffect(() => {
    alive.current = true
    // 308 UAT row 3: never set null — StrictMode's dev re-run reads null after the first run consumed the hint.
    const hint = readWebhookFocusOnce()
    if (hint) setFocus(hint)
    return () => {
      alive.current = false
    }
  }, [])

  // WR-06: a hint written while this tab is already open is consumed here at once, never left behind.
  useEffect(() => {
    const onHint = () => {
      const hint = readWebhookFocusOnce()
      if (hint) setFocus(hint)
    }
    window.addEventListener(WEBHOOK_FOCUS_EVENT, onHint)
    return () => window.removeEventListener(WEBHOOK_FOCUS_EVENT, onHint)
  }, [])

  // P-2: the list is the ACTIVE org's. A switch drops what belonged to the old org — the list, the
  // open card, the form and, above all, any secret still showing — then reads the new one.
  useEffect(() => {
    orgRef.current = activeOrgId
    setList(null)
    setListOrg(undefined)
    setLoadError(null)
    setJustCreated(null)
    setAdding(false)
    setOpenId(null)
    setDeletedHost(null)
    void load()
  }, [activeOrgId, load])

  // The "Waiting on you" arrival: open, scroll to and focus the card once it is listed here.
  useEffect(() => {
    if (!focus || list === null || listOrg !== activeOrgId) return
    if (activeOrgId !== null && focus.orgId !== activeOrgId) return // the other-org notice says so
    setFocus(null)
    if (!list.endpoints.some((e) => e.id === focus.endpointId)) return // deleted meanwhile
    setOpenId(focus.endpointId)
    window.setTimeout(() => {
      const el = toggles.current.get(focus.endpointId)
      if (!el) return
      el.scrollIntoView?.({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" })
      el.focus()
    }, 0)
  }, [focus, list, listOrg, activeOrgId])

  async function handleCreate(body: WebhookBody) {
    const res = await createWebhook(body) // a refusal is the form's to show
    if (!alive.current) return
    setJustCreated({ endpoint: res.endpoint, secret: res.secret })
    setAdding(false)
    setDeletedHost(null)
    void load()
  }

  function onChanged(updated: WebhookEndpoint) {
    setList((cur) =>
      cur ? { ...cur, endpoints: cur.endpoints.map((e) => (e.id === updated.id ? updated : e)) } : cur,
    )
    void load()
  }

  function onDeleted(gone: WebhookEndpoint) {
    setDeletedHost(hostOf(gone.url))
    setOpenId(null)
    void load()
  }

  const endpoints = list ? [...list.endpoints].sort(newestFirst) : []
  // The just-created endpoint is shown by the secret-once card, not twice.
  const listed = justCreated ? endpoints.filter((e) => e.id !== justCreated.endpoint.id) : endpoints
  const cap = list?.cap ?? 10
  const orgName = list?.org_name || org?.orgs.find((o) => o.org_id === activeOrgId)?.name || ""
  const atCap = endpoints.length >= cap
  const showAdd = list !== null && endpoints.length > 0 && !adding && !justCreated
  const otherOrg =
    focus && activeOrgId !== null && focus.orgId !== activeOrgId
      ? org?.orgs.find((o) => o.org_id === focus.orgId) ?? null
      : null

  return (
    <div className="grid gap-3">
      <div className="ghost-border rounded-xl bg-card/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3
              ref={titleRef}
              tabIndex={-1}
              className="flex items-center gap-2 font-headline text-base font-semibold outline-none"
            >
              <Webhook className="h-4 w-4 flex-none" aria-hidden="true" />
              {T.title}
              {list !== null && (
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {fillCopy(T.count, { N: endpoints.length })}
                </span>
              )}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{T.description}</p>
            {orgName && (
              <p className="mt-2 text-xs text-muted-foreground">
                {slotParts(T.scope, { org: orgName }).map((p, i) =>
                  p.bold ? (
                    <b key={i} className="font-semibold text-foreground/80">
                      {p.text}
                    </b>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )}
              </p>
            )}
            {showAdd && atCap && (
              <p id={capWhyId} className="mt-2 text-xs text-muted-foreground">
                {fillCopy(T.capReached, { org: orgName })}
              </p>
            )}
          </div>
          {showAdd && (
            <Button
              type="button"
              className="gradient-primary"
              disabled={atCap}
              aria-describedby={atCap ? capWhyId : undefined}
              onClick={() => {
                setAdding(true)
                setDeletedHost(null)
              }}
            >
              {T.add}
            </Button>
          )}
        </div>
      </div>

      {deletedHost && (
        <p role="status" className="px-1 text-xs text-muted-foreground">
          {fillCopy(T.deletedReceipt, { host: deletedHost })}
        </p>
      )}

      {otherOrg && focus && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span>
            {slotParts(T.otherOrg, { org: otherOrg.name }).map((p, i) =>
              p.bold ? (
                <b key={i} className="font-semibold">
                  {p.text}
                </b>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => org?.switchOrg(focus.orgId)}
          >
            {fillCopy(T.switchTo, { org: otherOrg.name })}
          </button>
        </div>
      )}

      {list === null && loadError === null && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {T.loading}
        </p>
      )}
      {loadError !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[hsl(0_80%_80%)]"
        >
          <span>{[T.loadFailed, loadError].filter(Boolean).join(" ")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {T.retry}
          </Button>
        </div>
      )}

      {adding && <WebhookEndpointForm mode="add" save={handleCreate} onDiscard={() => setAdding(false)} />}

      {justCreated && (
        <WebhookSecretOnce
          mode="create"
          secret={justCreated.secret}
          host={hostOf(justCreated.endpoint.url)}
          sendTest={() => sendWebhookTest(justCreated.endpoint.id)}
          onDone={() => setJustCreated(null)} // the secret leaves the page here
        />
      )}

      {list !== null && endpoints.length === 0 && !adding && !justCreated && (
        <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center">
          <Webhook className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="mx-auto mb-4 mt-2 max-w-md text-sm text-muted-foreground">{T.empty}</p>
          <Button type="button" className="gradient-primary" onClick={() => setAdding(true)}>
            {T.add}
          </Button>
        </div>
      )}

      {listed.map((e) => (
        <WebhookEndpointCard
          key={e.id}
          endpoint={e}
          open={openId === e.id}
          onToggle={() => setOpenId((cur) => (cur === e.id ? null : e.id))}
          onChanged={onChanged}
          onDelete={setDeleteTarget}
          onOpenRun={onOpenRun}
          toggleRef={(el) => {
            if (el) toggles.current.set(e.id, el)
            else toggles.current.delete(e.id)
          }}
        />
      ))}

      <DeleteWebhookSheet
        target={deleteTarget ? { id: deleteTarget.id, address: memberAddress(deleteTarget.url).text } : null}
        onClose={() => setDeleteTarget(null)}
        remove={() => (deleteTarget ? deleteWebhook(deleteTarget.id) : Promise.resolve())}
        onDone={() => {
          if (deleteTarget) onDeleted(deleteTarget)
        }}
        focusAfterDelete={() => titleRef.current?.focus()}
      />
    </div>
  )
}
