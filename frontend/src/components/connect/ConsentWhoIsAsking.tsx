/**
 * Phase 307-03 (OAUTH-04; D-12, D-09; T-307-23; UI-SPEC §1a item 1) — who is asking.
 *
 * The NAME is a claim; the redirect HOST is the fact. So:
 *   • the mark comes only from the redirect kind the server proved (Globe = web, Laptop = loopback),
 *     never from anything the client asserted — no logo is fetched or drawn;
 *   • a self-registered (DCR) name is followed by "calls itself" and tagged "name not checked";
 *   • a CIMD client says where its details are published, tagged "verified";
 *   • a loopback redirect is tagged "this computer" (neutral, not accent);
 *   • the host chip shows the hostname only, never a port.
 *
 * ⛔ Client strings are React TEXT: never HTML, never a link, never a `title` built into markup. The
 *   name is cut at 60 characters with the full value in `title`.
 */
import { BadgeCheck, Globe, Laptop } from "lucide-react"

import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import type { ConsentClient } from "@/lib/api/oauth"
import { displayHost, whyLine } from "./consentFacts"
import { OAUTH_COPY } from "./oauthCopy"

const C = OAUTH_COPY.consent
const NAME_MAX = 60
const TAG = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"

export function ConsentWhoIsAsking({ client }: { client: ConsentClient }) {
  const loopback = client.redirect_kind === "loopback"
  const cimd = client.name_source === "cimd"
  const Mark = loopback ? Laptop : Globe
  const name = client.name
  const shown = name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}…` : name
  const host = displayHost(client.redirect_host)

  return (
    <div className="flex gap-3 rounded-md border border-border bg-background/60 p-3">
      <span
        data-testid="consent-mark"
        data-kind={loopback ? "loopback" : "web"}
        className="grid h-9 w-9 flex-none place-items-center rounded-md bg-muted"
        aria-hidden="true"
      >
        <Mark className="h-5 w-5 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-1">
          <span data-testid="consent-client-name" title={name} className="break-all font-headline text-base font-bold text-foreground">
            {shown}
          </span>
          {!cimd && <span className="text-xs text-muted-foreground">{C.callsItself}</span>}
        </p>
        <p className="flex flex-wrap items-center gap-1">
          <span data-testid="consent-host" className="rounded border border-border bg-background px-2 py-0.5 font-mono text-xs">
            {host}
          </span>
          {!cimd && <span className={`${TAG} bg-warning/15 text-warning`}>{C.tagUnchecked}</span>}
          {loopback && <span className={`${TAG} border border-border text-muted-foreground`}>{C.tagThisComputer}</span>}
        </p>
        {cimd && (
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span>{fillCopy(C.publishedAt, { host: displayHost(client.published_host ?? "") })}</span>
            <span className={`${TAG} bg-success/15 text-success`}>
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              {C.tagVerified}
            </span>
          </p>
        )}
        <p data-testid="consent-why" className="text-xs text-muted-foreground">
          {whyLine(client)}
        </p>
      </div>
    </div>
  )
}
