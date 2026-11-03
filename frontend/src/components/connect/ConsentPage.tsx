/**
 * Phase 307-03 (OAUTH-04; D-10, D-11, D-12, D-13, D-14, D-35, D-41; UI-SPEC §Surface 1) — the
 * consent route, `/app/connect/<request id>`, rendered by App OUTSIDE the app shell (no nav rail, no
 * org provider) inside the shipped `AuthCardShell`.
 *
 * It owns its own reads (the request, then the picked org's folders, with an `alive` guard and the
 * last-known values kept on a failed re-read), every state in UI-SPEC §1b, and the only way the
 * browser leaves Syrel toward the client.
 *
 * ⛔ SECURITY (D-35, T-307-01, T-307-05, T-307-07):
 *   • In a frame (`window.top !== window.self`) the page renders "can't be shown here" and never
 *     reads the request or renders Allow — defence in depth over 307-04's anti-framing headers.
 *   • The browser leaves only through `navigate` (default `window.location.replace`, so a used
 *     request never sits in the Back history), and only after `redirectMatchesShown` says the
 *     server's URL is https (or loopback http) on EXACTLY the host the page showed. A mismatch renders
 *     "redirect not registered" and does not navigate. A refused or expired request never navigates.
 *   • Focus starts on the card title, never on Allow; nothing auto-submits; there is no <form>, so
 *     Enter inside a field never submits.
 *   • The title never carries the client's name; the summary says "This app".
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, Clock, Loader2, ShieldX, X } from "lucide-react"

import { AuthCardShell } from "@/components/auth/AuthCardShell"
import { Button } from "@/components/ui/button"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { McpKeyFields } from "@/components/settings/apiKeys/McpKeyFields"
import { MCP_KEY_COPY } from "@/components/settings/apiKeys/mcpKeyCopy"
import { MCP_DRAFT_DEFAULT, draftFolderIds, draftTools, type McpDraft } from "@/components/settings/apiKeys/mcpKeyFacts"
import { ApiError } from "@/lib/api/_core"
import type { PickableFolder } from "@/lib/api/apiKeys"
import {
  approveConsent,
  denyConsent,
  getConsentRequest,
  listFoldersForOrg,
  type ConsentClient,
  type ConsentOrg,
  type ConsentRefusalReason,
  type ConsentRequest,
} from "@/lib/api/oauth"
import { ConsentOrgField } from "./ConsentOrgField"
import { ConsentWhoIsAsking } from "./ConsentWhoIsAsking"
import { copyParts, displayHost, firstUnmetAllow, redirectMatchesShown, summaryParts, type CopyPart } from "./consentFacts"
import { OAUTH_COPY } from "./oauthCopy"

const C = OAUTH_COPY.consent
/** The 304 Create-key blocker words, from their one home (never retyped). */
const BLOCKER_WORDS = {
  needTool: MCP_KEY_COPY.mcp.needTool,
  needFolder: MCP_KEY_COPY.mcp.needFolder,
  waitTools: MCP_KEY_COPY.mcp.waitTools,
  waitFolders: MCP_KEY_COPY.mcp.waitFolders,
} as const

type Ready = Extract<ConsentRequest, { status: "ready" }>

type Phase =
  | { kind: "loading" }
  | { kind: "loadFailed" }
  | { kind: "ready"; request: Ready }
  | { kind: "expired" }
  | { kind: "refused"; reason: ConsentRefusalReason; host: string | null }
  | { kind: "deploymentOff"; host: string | null }
  | { kind: "done"; client: ConsentClient }
  | { kind: "denied"; host: string | null; loopback: boolean }

const defaultNavigate = (url: string) => window.location.replace(url)
const defaultIsFramed = () => {
  try {
    return window.top !== window.self
  } catch {
    return true // a cross-origin parent throws on access: that is a frame
  }
}

/** The page's default org: the active one if switched on, else the first switched-on one. */
function defaultOrg(orgs: readonly ConsentOrg[]): string | null {
  const active = orgs.find((o) => o.active && o.mcp_off === null)
  return (active ?? orgs.find((o) => o.mcp_off === null))?.id ?? null
}

function Parts({ parts, bold }: { parts: CopyPart[]; bold: readonly string[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.slot !== null && bold.includes(p.slot) ? (
          <b key={i} className="font-bold text-foreground">
            {p.text}
          </b>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

/** One end-state card: a glyph, a body, an optional muted line, an optional action. */
function EndState({
  title,
  subhead,
  glyph,
  children,
}: {
  title: ReactNode
  subhead: ReactNode
  glyph: ReactNode
  children: ReactNode
}) {
  return (
    <AuthCardShell title={title} subhead={subhead}>
      <div className="grid justify-items-center gap-3 text-center">
        {glyph}
        {children}
      </div>
    </AuthCardShell>
  )
}

export interface ConsentPageProps {
  requestId: string
  onSignOut: () => Promise<void> | void
  /** Accepted from App for parity with the other pre-shell pages; the account shown is the server's. */
  user?: unknown
  /** Test seams. Production uses `window.location.replace` and `window.top !== window.self`. */
  navigate?: (url: string) => void
  isFramed?: () => boolean
}

export function ConsentPage({
  requestId,
  onSignOut,
  navigate = defaultNavigate,
  isFramed = defaultIsFramed,
}: ConsentPageProps) {
  const framed = useMemo(() => isFramed(), [isFramed])
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [orgId, setOrgId] = useState<string | null>(null)
  const [draft, setDraft] = useState<McpDraft>(MCP_DRAFT_DEFAULT)
  const [folders, setFolders] = useState<PickableFolder[] | null>(null)
  const [foldersFailed, setFoldersFailed] = useState(false)
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null)
  const [alert, setAlert] = useState<string | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const alive = useRef(true)
  const titleRef = useRef<HTMLSpanElement>(null)
  const ids = { why: "consent-allow-why" }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    document.title = C.tabTitle
  }, [])

  const toPhase = useCallback((req: ConsentRequest) => {
    if (req.status === "ready") {
      setPhase({ kind: "ready", request: req })
      setOrgId((prev) => {
        const keep = prev !== null && req.orgs.some((o) => o.id === prev && o.mcp_off === null)
        return keep ? prev : defaultOrg(req.orgs)
      })
    } else if (req.status === "refused") setPhase({ kind: "refused", reason: req.reason, host: req.host })
    else if (req.status === "deployment_off") setPhase({ kind: "deploymentOff", host: req.host })
    else setPhase({ kind: "expired" })
  }, [])

  const load = useCallback(
    (opts: { quiet?: boolean } = {}) => {
      if (!opts.quiet) setPhase({ kind: "loading" })
      getConsentRequest(requestId)
        .then((req) => {
          if (alive.current) toPhase(req)
        })
        .catch(() => {
          // A quiet re-read keeps what is on screen; only the first read shows the failure card.
          if (alive.current && !opts.quiet) setPhase({ kind: "loadFailed" })
        })
    },
    [requestId, toPhase],
  )

  useEffect(() => {
    if (!framed) load()
  }, [framed, load])

  // The picked org's folders, read with that org named explicitly (P-6).
  useEffect(() => {
    if (framed || phase.kind !== "ready" || orgId === null) return
    const ctrl = new AbortController()
    setFolders(null)
    setFoldersFailed(false)
    listFoldersForOrg(orgId, ctrl.signal)
      .then((list) => {
        if (alive.current && !ctrl.signal.aborted) setFolders(list.folders)
      })
      .catch(() => {
        if (alive.current && !ctrl.signal.aborted) setFoldersFailed(true)
      })
    return () => ctrl.abort()
    // Re-read only when the org changes, never on a re-read of the same request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, framed, phase.kind === "ready"])

  // Focus the title whenever a new state renders (a screen reader reads who is asking first).
  useEffect(() => {
    titleRef.current?.focus()
  }, [phase.kind])

  // Leave Syrel only after the end-state card has rendered.
  useEffect(() => {
    if (pendingUrl !== null) navigate(pendingUrl)
  }, [pendingUrl, navigate])

  const retryFolders = useCallback(() => {
    if (orgId === null) return
    setFoldersFailed(false)
    listFoldersForOrg(orgId)
      .then((list) => alive.current && setFolders(list.folders))
      .catch(() => alive.current && setFoldersFailed(true))
  }, [orgId])

  const title = (text: string) => (
    <span ref={titleRef} tabIndex={-1} data-testid="consent-title" className="outline-none">
      {text}
    </span>
  )

  // ── answers ─────────────────────────────────────────────────────────────────────────────────

  function leave(url: string, host: string, kind: "web" | "loopback" | null, onOk: () => void) {
    if (!redirectMatchesShown(url, host, kind)) {
      setPhase({ kind: "refused", reason: "not_registered", host })
      return
    }
    onOk()
    setPendingUrl(url)
  }

  function failed(err: unknown) {
    if (err instanceof ApiError && err.status === 410) {
      setPhase({ kind: "expired" })
      return
    }
    if (err instanceof ApiError && (err.status === 403 || err.status === 422)) {
      setAlert(err.message)
      load({ quiet: true }) // a newly switched-off org shows its row reason; choices are kept
      return
    }
    const detail = err instanceof Error && err.message ? err.message : ""
    setAlert(fillCopy(C.submitFailed, { detail }).replace(/ {2,}/g, " "))
  }

  async function allow(req: Ready) {
    if (orgId === null) return
    setBusy("allow")
    setAlert(null)
    try {
      const { redirect_url } = await approveConsent(requestId, {
        org_id: orgId,
        tools: draftTools(draft, req.tools),
        folder_ids: draftFolderIds(draft, folders),
        include_external: draft.external,
      })
      if (!alive.current) return
      leave(redirect_url, req.client.redirect_host, req.client.redirect_kind, () =>
        setPhase({ kind: "done", client: req.client }),
      )
    } catch (err) {
      if (alive.current) failed(err)
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  async function deny(host: string | null, kind: "web" | "loopback" | null) {
    setBusy("deny")
    setAlert(null)
    try {
      const { redirect_url } = await denyConsent(requestId)
      if (!alive.current) return
      leave(redirect_url, host ?? "", kind, () => setPhase({ kind: "denied", host, loopback: kind === "loopback" }))
    } catch (err) {
      if (alive.current) failed(err)
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  async function otherAccount() {
    await onSignOut()
    window.location.reload()
  }

  // ── states ──────────────────────────────────────────────────────────────────────────────────

  const glyph = (Icon: typeof Check, tone: string) => <Icon className={`h-7 w-7 ${tone}`} aria-hidden="true" />
  const muted = "text-muted-foreground"
  const refusedTone = "text-[hsl(0_80%_80%)]"

  if (framed) {
    return (
      <EndState title={title(C.framed.title)} subhead={C.framed.subhead} glyph={glyph(ShieldX, refusedTone)}>
        <p className="text-sm">{C.framed.body}</p>
      </EndState>
    )
  }

  if (phase.kind === "loading") {
    return (
      <AuthCardShell title={title(C.title)} subhead={C.subhead}>
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {C.loading}
        </p>
      </AuthCardShell>
    )
  }

  if (phase.kind === "loadFailed") {
    return (
      <AuthCardShell title={title(C.title)} subhead={C.subhead}>
        <div role="alert" className="flex items-center justify-between gap-2 text-sm text-[hsl(0_80%_80%)]">
          <span>{C.loadFailed}</span>
          <Button type="button" variant="outline" size="sm" className="font-bold" onClick={() => load()}>
            {C.tryAgain}
          </Button>
        </div>
      </AuthCardShell>
    )
  }

  if (phase.kind === "expired") {
    return (
      <EndState title={title(C.expired.title)} subhead={C.expired.subhead} glyph={glyph(Clock, muted)}>
        <p className="text-sm">{C.expired.body}</p>
      </EndState>
    )
  }

  if (phase.kind === "refused") {
    const host = phase.host ? displayHost(phase.host) : C.refused.unknownHost
    const body: Record<ConsentRefusalReason, string> = {
      host_not_allowed: C.refused.hostNotAllowed,
      not_registered: C.refused.notRegistered,
      unknown_client: C.refused.unknownClient,
      metadata_unreadable: C.refused.metadataUnreadable,
    }
    return (
      <EndState title={title(C.refused.title)} subhead={C.refused.subhead} glyph={glyph(ShieldX, refusedTone)}>
        <p data-testid="consent-refused-body" className="text-sm">
          <Parts parts={copyParts(body[phase.reason] ?? C.refused.notRegistered, { host })} bold={["host"]} />
        </p>
        {phase.reason === "host_not_allowed" && (
          <p className="text-xs text-muted-foreground">{fillCopy(C.refused.hostNotAllowedHelp, { host })}</p>
        )}
      </EndState>
    )
  }

  if (phase.kind === "deploymentOff") {
    const host = phase.host
    return (
      <EndState title={title(C.deploymentOff.title)} subhead={C.deploymentOff.subhead} glyph={glyph(ShieldX, muted)}>
        <p className="text-sm">{MCP_KEY_COPY.mcp.offTileDeployment}</p>
        {alert && (
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            {alert}
          </p>
        )}
        <Button type="button" variant="outline" className="font-bold" disabled={busy !== null} onClick={() => deny(host, null)}>
          {busy === "deny" ? C.goingBack : C.goBack}
        </Button>
      </EndState>
    )
  }

  if (phase.kind === "done") {
    const loopback = phase.client.redirect_kind === "loopback"
    const subhead = loopback ? C.done.subheadLoopback : fillCopy(C.done.subhead, { host: displayHost(phase.client.redirect_host) })
    return (
      <EndState title={title(C.done.title)} subhead={subhead} glyph={glyph(Check, "text-success")}>
        <p className="text-sm">{C.done.body}</p>
        <p className="text-xs text-muted-foreground">{C.done.undo}</p>
      </EndState>
    )
  }

  if (phase.kind === "denied") {
    const subhead =
      phase.loopback || phase.host === null
        ? C.denied.subheadLoopback
        : fillCopy(C.denied.subhead, { host: displayHost(phase.host) })
    return (
      <EndState title={title(C.denied.title)} subhead={subhead} glyph={glyph(X, muted)}>
        <p className="text-sm">{C.denied.body}</p>
      </EndState>
    )
  }

  // ── ready ───────────────────────────────────────────────────────────────────────────────────

  const req = phase.request
  const client = req.client
  const loopback = client.redirect_kind === "loopback"
  const picked = req.orgs.find((o) => o.id === orgId && o.mcp_off === null) ?? null
  const orgName = picked?.name ?? ""
  const sentFolders = draftFolderIds(draft, folders)
  const blocker = firstUnmetAllow({
    orgOn: picked !== null,
    draft,
    catalogue: req.tools,
    foldersLoaded: folders !== null,
  })
  const blockerText = blocker === null ? null : blocker === "needOrg" ? C.needOrg : BLOCKER_WORDS[blocker]
  const host = displayHost(client.redirect_host)

  return (
    <AuthCardShell title={title(C.title)} subhead={C.subhead}>
      <div className="grid gap-4">
        <ConsentWhoIsAsking client={client} />

        <p data-testid="consent-account" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            <Parts parts={copyParts(C.signingInAs, { email: req.account.email ?? "" })} bold={["email"]} />
          </span>
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={busy !== null}
            onClick={otherAccount}
          >
            {C.otherAccount}
          </button>
        </p>

        <ConsentOrgField
          orgs={req.orgs}
          value={orgId}
          disabled={busy !== null}
          onChange={(next) => {
            if (next === orgId) return
            setOrgId(next)
            // A new org: All folders in it, and mail and synced sources left out again.
            setDraft((d) => ({ ...d, folderMode: "all", folderIds: [], external: false }))
          }}
        />

        <fieldset disabled={busy !== null} className="m-0 min-w-0 border-0 p-0">
          <McpKeyFields
            variant="consent"
            orgName={orgName || null}
            catalogue={req.tools}
            catalogueFailed={false}
            onRetryCatalogue={() => load({ quiet: true })}
            folders={folders}
            foldersFailed={foldersFailed}
            onRetryFolders={retryFolders}
            value={draft}
            onChange={setDraft}
          />
        </fieldset>

        {picked !== null && (
          <p data-testid="consent-summary" className="border-l-[3px] border-primary bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Parts
              parts={summaryParts({ draft, catalogue: req.tools, folderCount: sentFolders?.length ?? 0, orgName })}
              bold={["can", "where"]}
            />
          </p>
        )}

        <div className="grid gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="font-bold"
              disabled={busy !== null}
              onClick={() => deny(client.redirect_host, client.redirect_kind)}
            >
              {busy === "deny" ? C.goingBack : C.deny}
            </Button>
            <Button
              type="button"
              className="gradient-primary font-bold"
              disabled={busy !== null || blocker !== null}
              aria-describedby={blockerText ? ids.why : undefined}
              onClick={() => allow(req)}
            >
              {busy === "allow" ? C.connecting : C.allow}
            </Button>
          </div>
          {blockerText && (
            <p id={ids.why} className="text-right text-xs text-muted-foreground">
              {blockerText}
            </p>
          )}
          {busy !== null && (
            <span role="status" className="sr-only">
              {busy === "allow" ? C.connecting : C.goingBack}
            </span>
          )}
          {alert && (
            <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
              {alert}
            </p>
          )}
        </div>

        <p data-testid="consent-fine" className="text-xs text-muted-foreground">
          {loopback ? C.fineLoopback : <Parts parts={copyParts(C.fine, { host })} bold={["host"]} />}
        </p>
      </div>
    </AuthCardShell>
  )
}
