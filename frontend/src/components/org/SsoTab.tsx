/**
 * Phase 168 Plan 06 (SSO-01 / D-168-01 / D-168-05) — the live org SSO tab.
 *
 * The Phase-166 "SSO" LockedTab flips LIVE here. Clones the InvitationsTab / OrgSettingsTab
 * PURE-LEAF posture (props in, DOM out; the shell owns the fetch + the create/remove
 * mutations + the re-fetch-not-optimistic refresh). Styled as a sibling in the indigo org
 * zone — NO new visual language, NO operator warning tint.
 *
 * Renders (UI-SPEC §1):
 *   - a metadata-URL + email-domain create form (NO XML upload — D-168-01), whose "Add SSO
 *     connection" CTA is honest-ABSENT for a non-`canManageSso` user (never a disabled button
 *     that lies — T-166-09 precedent);
 *   - the connection row(s): domain + opaque `provider_id` mono chip + a server-truth status
 *     chip (Pending approval → primary · Active → success · Disabled → muted; reuse the 166
 *     chip vocabulary, NEVER the reserved operator warning tint) + a victim-naming remove
 *     confirm (re-fetch-not-optimistic; NO undo — removal deletes the GoTrue provider);
 *   - a static SP-metadata well (Entity ID · ACS URL · NameID) read from the deployment's
 *     Supabase URL (NO API call), each with a Copy/Copied affordance.
 *
 * SECURITY: render courtesy only. `canManageSso` gates the affordances for honesty; the
 * server `require_sso_manage` + the mig-104 RLS are the real wall (T-168-06). NO management
 * token / secret ever crosses to this leaf — only domain / provider_id / status (T-168-04).
 *
 * Typography (UI-SPEC 2-weight 400/700): the SP-metadata + create-form micro-labels stay 400 +
 * `uppercase tracking-wide` — the distinction there is size + case + tone, not a third weight.
 *
 * NOTE (Phase 177 / D-08/D-09): the connection STATUS chip's former UPPERCASE, `py-1`, off-grid
 * fork was RETIRED for family cohesion — status now renders through the ONE shared `StatusChip`
 * (grid-correct `px-2 py-0.5`, no `uppercase tracking-wide`), and the connection row snaps to the
 * sibling `px-3.5 py-3` row anatomy. This intentionally reverses the earlier keep-the-off-grid-fork
 * instruction: the deviation is now the cohesion target, not a gate-required exception. The
 * remaining `uppercase tracking-wide` are the metadata/form LABELS (a different element) — leave those.
 */
import { useState } from "react"
import { Check, Copy, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react"

import type { SsoConfig } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusChip, type ChipTone } from "./StatusChip"

interface SsoTabProps {
  /** Every SSO connection the shell fetched; `null` while the fetch is in flight. */
  configs: SsoConfig[] | null
  /** Render-only gate (sso:manage): show the create/remove affordances + SP metadata. The
   *  server `require_sso_manage` is the real wall — this only keeps the UI honest (T-168-06). */
  canManageSso: boolean
  /** Create a connection from a metadata URL + email domain (shell re-fetches on success). */
  onCreate: (metadataUrl: string, emailDomain: string) => Promise<void>
  /** Remove a connection by id (shell deletes the provider then re-fetches — no optimism). */
  onRemove: (id: string) => Promise<void>
}

/** Map the server-truth `sso_configs.status` to a plain label + a 166-vocabulary tone. Pending
 *  is the live indigo (primary) chip — the in-zone waiting state, NEVER the reserved operator
 *  warning tint (D-168-05); active is success-green; disabled is the calm muted chip. */
function statusChip(status: SsoConfig["status"]): { label: string; tone: ChipTone } {
  switch (status) {
    case "active":
      return { label: "Active", tone: "success" }
    case "disabled":
      return { label: "Disabled", tone: "muted" }
    case "pending_approval":
    default:
      return { label: "Pending approval", tone: "primary" }
  }
}

/** The deployment's Supabase (GoTrue) URL is the SAML SP. Read the value the app already
 *  resolved — prefer the LIVE client's URL (correct on the D-07 no-rebuild overlay path),
 *  fall back to the baked `VITE_SUPABASE_URL`. Static per deployment; NO API call. */
function spMetadataBase(): string {
  const live = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl
  const baked = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ""
  return (live || baked).replace(/\/+$/, "")
}

/** The live org SSO home — create form + connection row(s) + SP-metadata (SSO-01). */
export function SsoTab({ configs, canManageSso, onCreate, onRemove }: SsoTabProps) {
  // Transient UI: whether the "add another" create form is expanded once a connection exists.
  const [adding, setAdding] = useState(false)
  const hasConnections = (configs?.length ?? 0) > 0
  const showForm = canManageSso && (!hasConnections || adding)

  return (
    <section aria-label="Single sign-on" className="mx-auto max-w-2xl px-6 py-6">
      <div className="rounded-lg border border-border bg-card px-6 py-6">
        {/* Heading — 700 Manrope, indigo shield glyph. */}
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
          <h2 className="font-headline text-base font-bold text-foreground">Single sign-on</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Connect your identity provider so your team can sign in with SAML single sign-on.
          Email and password sign-in stays available.
        </p>

        {configs == null ? (
          <div
            aria-busy="true"
            className="rounded-md border border-border bg-background px-4 py-6 text-sm text-muted-foreground opacity-40"
          >
            Loading SSO connections…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection row(s) — the anchor once a connection exists (server-truth status). */}
            {hasConnections && (
              <div className="overflow-hidden rounded-md border border-border">
                <div className="divide-y divide-border/60">
                  {configs!.map((c) => (
                    <SsoConnectionRow
                      key={c.id}
                      config={c}
                      canManageSso={canManageSso}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state — the calm no-connection read. */}
            {!hasConnections && (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center">
                <div className="text-sm font-bold text-foreground">No SSO connection yet</div>
                <div className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {canManageSso
                    ? "Add your identity provider's metadata URL to let your team sign in with single sign-on. Email and password sign-in stays available."
                    : "Your organization hasn't set up single sign-on yet. Email and password sign-in stays available."}
                </div>
              </div>
            )}

            {/* Create form — honest-absent for a non-manager (the CTA never renders disabled). */}
            {showForm && (
              <SsoCreateForm
                onCreate={onCreate}
                onDone={() => setAdding(false)}
                collapsible={hasConnections}
              />
            )}

            {/* Add-another affordance — only once a connection exists + a manager (honest). */}
            {canManageSso && hasConnections && !adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add another connection
              </button>
            )}

            {/* SP metadata — the admin pastes these into their IdP (static, no API call). */}
            {canManageSso && <SpMetadataWell />}
          </div>
        )}
      </div>
    </section>
  )
}

interface SsoCreateFormProps {
  onCreate: (metadataUrl: string, emailDomain: string) => Promise<void>
  onDone: () => void
  /** When a connection already exists this is an "add another" form — show a Cancel. */
  collapsible: boolean
}

/** The metadata-URL + email-domain create form. The server rejects public domains + validates
 *  the metadata URL and returns the actionable `{detail}` copy, surfaced verbatim on failure. */
function SsoCreateForm({ onCreate, onDone, collapsible }: SsoCreateFormProps) {
  const [metadataUrl, setMetadataUrl] = useState("")
  const [emailDomain, setEmailDomain] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await onCreate(metadataUrl.trim(), emailDomain.trim().toLowerCase())
      setMetadataUrl("")
      setEmailDomain("")
      onDone()
    } catch (err) {
      // Render the server `detail` verbatim (the four UI-SPEC create-error copies).
      setError(err instanceof Error ? err.message : "Failed to add the SSO connection.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border border-border bg-background px-4 py-4"
    >
      <div className="space-y-2">
        <Label
          htmlFor="sso-metadata-url"
          className="text-[11px] font-normal uppercase tracking-wide text-muted-foreground"
        >
          Metadata URL
        </Label>
        <Input
          id="sso-metadata-url"
          type="url"
          value={metadataUrl}
          onChange={(e) => setMetadataUrl(e.target.value)}
          placeholder="https://idp.example.com/saml/metadata"
          className="font-mono"
          required
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="sso-email-domain"
          className="text-[11px] font-normal uppercase tracking-wide text-muted-foreground"
        >
          Email domain
        </Label>
        <Input
          id="sso-email-domain"
          value={emailDomain}
          onChange={(e) => setEmailDomain(e.target.value.toLowerCase())}
          placeholder="example.com"
          required
          autoComplete="off"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add SSO connection"}
        </Button>
        {collapsible && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

interface SsoConnectionRowProps {
  config: SsoConfig
  canManageSso: boolean
  onRemove: (id: string) => Promise<void>
}

/** One connection row — domain + opaque provider_id + server-truth status chip + a
 *  victim-naming remove confirm (re-fetch-not-optimistic; the shell unmounts this row on
 *  a successful delete). A `pending_approval` connection shows the waiting note. */
function SsoConnectionRow({ config, canManageSso, onRemove }: SsoConnectionRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const chip = statusChip(config.status)

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await onRemove(config.id)
      // On success the shell re-fetches and this row unmounts — no optimistic local delete.
    } finally {
      setRemoving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm text-foreground" title={config.email_domain}>
            {config.email_domain}
          </span>
          {config.provider_id && (
            <span
              className="truncate font-mono text-[11px] text-muted-foreground"
              title={config.provider_id}
            >
              {config.provider_id}
            </span>
          )}
        </div>

        {/* Server-truth status chip — the shared StatusChip (D-08; the off-grid UPPERCASE fork retired). */}
        <div className="flex-none">
          <StatusChip tone={chip.tone} testId="sso-status">
            {chip.label}
          </StatusChip>
        </div>

        {/* Remove — honest-absent for a non-manager; a two-step victim-naming confirm below. */}
        {canManageSso && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={removing}
            aria-label={`Remove SSO for ${config.email_domain}`}
            className="inline-flex flex-none items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors enabled:hover:border-destructive/40 enabled:hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            Remove connection
          </button>
        )}
      </div>

      {config.status === "pending_approval" && (
        <p className="text-xs text-muted-foreground">
          Waiting for operator approval before this connection can route sign-ins.
        </p>
      )}

      {removing && (
        <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
          Updating…
        </span>
      )}

      {/* Victim-naming confirm sheet (graded-guard: target-specific destructive → name it). */}
      {confirming && !removing && (
        <div className="rounded-md border border-destructive/30 bg-destructive/[0.06] px-3 py-2">
          <p className="text-sm text-foreground">
            Remove SSO for <span className="font-bold">{config.email_domain}</span>?
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Members who sign in with{" "}
            <span className="font-bold text-foreground">{config.email_domain}</span> will fall
            back to email and password.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="destructive" size="sm" onClick={handleRemove}>
              Remove connection
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** The static SP-metadata well — the three values the admin pastes into their IdP. Read from
 *  the deployment's Supabase URL (NO API call); each value is copyable. */
function SpMetadataWell() {
  const base = spMetadataBase()
  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Entity ID", value: `${base}/auth/v1/sso/saml/metadata` },
    { label: "ACS URL", value: `${base}/auth/v1/sso/saml/acs` },
    { label: "NameID format", value: "emailAddress" },
  ]
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Give these to your identity provider
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">Entity ID · ACS URL · NameID format</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <SpMetaRow key={r.label} label={r.label} value={r.value} />
        ))}
      </div>
    </div>
  )
}

/** One copyable SP-metadata line — uppercase micro-label + accent-mono value + Copy/Copied. */
function SpMetaRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the value is visible in the row regardless */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-[11px] text-primary" title={value}>
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="inline-flex flex-none items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy
          </>
        )}
      </button>
    </div>
  )
}

export default SsoTab
