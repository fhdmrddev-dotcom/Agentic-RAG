// ─────────────────────────────────────────────────────────────────────────────
// Phase 148 Plan 09 (ADMIN-03 / sketch 068-A) — the Users & Access roster.
//
// The locked Users & Access tab UNLOCKS into a dense instrument-table roster:
//   [avatar] [email / joined · docs · chats] [last-active] [status] [role] [actions]
// searchable, newest-active-first (the server already orders it that way).
//
// HONEST LAST-ACTIVE (068-A, never fabricated): `last_sign_in_at` NULL renders
// "never signed in" in italic — NEVER a made-up timestamp. A recent sign-in is
// green; a stale one is dim. This is the load-bearing honesty beat of the roster.
//
// GRADED ACTION GUARDS (068-A / the 066 rule — friction scales with consequence):
//   • Disable HAS A VICTIM → the 064-B victim-naming confirm SHEET: it NAMES the
//     user, states the immediate effect (sign-in refused · API refused · in-flight
//     run cancelled), states what is KEPT (their documents/chats/settings, untouched),
//     states reversibility, and says it's recorded. Nothing happens until Confirm.
//   • Enable is RESTORATIVE → it flips DIRECT (no sheet — the deliberate asymmetry).
//   • Grant / revoke operator → an AMBER blast-radius sheet (they can see every
//     user's activity, kill anyone's runs…); revoke keeps their normal account and
//     past operator actions stay in the trail forever.
//   • SELF-ROW Disable + Remove-operator are DISABLED with a tooltip — courtesy
//     only; the server self-guard (148-06, 409 before any mutation) is the real wall.
//
// Every write flips the row to a `✎ … · recorded` receipt (062-A); the shell
// re-fetches the roster so the status/role chips reflect the new persisted truth.
//
// D-02: impersonation ("Sign in as user") is DELIBERATELY NOT built — the roster +
// audit browser + active-runs are the support surface. Do not add it here.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (ControlRoomPage) owns the
// fetch + the server writes; this leaf renders the table + the graded guards and
// reports the intended action. `rows === null` → a calm loading placeholder.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, Check, Loader2, Search, ShieldCheck } from "lucide-react"

import type { UserRosterRow } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/** A sign-in inside this window reads as "recent" (green); older reads as stale/dim. */
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

interface UsersAndAccessProps {
  /** Every roster row the shell fetched; `null` while the fetch is in flight. */
  rows: UserRosterRow[] | null
  /** The signed-in operator's own user id — used to disable the self-row guards
   *  (courtesy; the server 409 is the real wall). `null` while identity loads. */
  currentOperatorId: string | null
  /** Disable a user (server: GoTrue ban + in-flight cancel + recorded). Resolves on
   *  success; rejects so the row can surface a retryable error. */
  onDisable: (userId: string) => Promise<void>
  /** Re-enable a user (restorative; direct). */
  onEnable: (userId: string) => Promise<void>
  /** Grant operator access (amber blast-radius). */
  onGrantOperator: (userId: string) => Promise<void>
  /** Revoke operator access (amber; keeps the normal account). */
  onRevokeOperator: (userId: string) => Promise<void>
}

/** A user is disabled when `banned_until` is a real timestamp in the future
 *  (the GoTrue ban the Disable action sets — ~100 years out). */
function isDisabled(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false
  const t = Date.parse(bannedUntil)
  return Number.isFinite(t) && t > Date.now()
}

type LastActiveTone = "recent" | "stale" | "never"

/** Honest last-active (068-A): NULL/unparseable → "never signed in" italic, NEVER a
 *  fabricated time. Recent (≤7d) reads green; older reads dim. */
function lastActive(iso: string | null): { text: string; tone: LastActiveTone } {
  if (!iso) return { text: "never signed in", tone: "never" }
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return { text: "never signed in", tone: "never" }
  const diffMs = Date.now() - t
  return { text: relativeTime(diffMs), tone: diffMs <= RECENT_WINDOW_MS ? "recent" : "stale" }
}

/** Compact relative time — "just now", "5m ago", "3h ago", "2d ago", "4mo ago". */
function relativeTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 30) return `${Math.floor(d / 30)}mo ago`
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return "just now"
}

/** The joined date for the identity sub-line — absolute, not fabricated. */
function formatJoined(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "unknown"
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** The 068-A instrument roster with graded action guards + honest last-active. */
export function UsersAndAccess({
  rows,
  currentOperatorId,
  onDisable,
  onEnable,
  onGrantOperator,
  onRevokeOperator,
}: UsersAndAccessProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (rows == null) return null
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => (r.email ?? "").toLowerCase().includes(q))
  }, [rows, query])

  return (
    <section aria-label="Users & Access">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-headline text-base font-bold text-foreground">Users &amp; Access</h3>
        <span className="flex-1" />
        {/* Search over the loaded page (068-A) — client-side, never an unbounded fetch. */}
        <label className="relative inline-flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/60"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email…"
            aria-label="Search users by email"
            className="w-56 rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-muted-foreground/40 focus:outline-none"
          />
        </label>
      </div>

      {rows == null ? (
        <div
          aria-busy="true"
          className="rounded-[10px] border border-border bg-card px-4 py-6 text-sm text-muted-foreground opacity-40"
        >
          Loading users…
        </div>
      ) : filtered != null && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <div className="text-sm font-semibold text-foreground">
            {query.trim() ? "No users match that search" : "No users yet"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {query.trim() ? "Try a different email fragment." : "Users appear here once they sign up."}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="divide-y divide-border/60">
            {(filtered ?? []).map((row) => (
              <RosterRow
                key={row.id}
                row={row}
                isSelf={currentOperatorId != null && row.id === currentOperatorId}
                onDisable={onDisable}
                onEnable={onEnable}
                onGrantOperator={onGrantOperator}
                onRevokeOperator={onRevokeOperator}
              />
            ))}
          </div>
        </div>
      )}

      <p className="mt-2 px-0.5 text-xs text-muted-foreground">
        Disabling names the person first and is reversible; their documents, chats and settings
        are kept. Every change here is recorded with your name.
      </p>
    </section>
  )
}

type ConfirmKind = "disable" | "grant" | "revoke" | null

/** One roster row + its graded guards. Owns its transient write state (busy/error)
 *  + the `✎ … recorded` receipt; the row's chips come from the shell's re-fetched
 *  props (no optimistic status flip — the server is the source of truth). */
function RosterRow({
  row,
  isSelf,
  onDisable,
  onEnable,
  onGrantOperator,
  onRevokeOperator,
}: {
  row: UserRosterRow
  isSelf: boolean
  onDisable: (userId: string) => Promise<void>
  onEnable: (userId: string) => Promise<void>
  onGrantOperator: (userId: string) => Promise<void>
  onRevokeOperator: (userId: string) => Promise<void>
}) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

  const disabled = isDisabled(row.banned_until)
  const active = lastActive(row.last_sign_in_at)
  const email = row.email ?? "unknown user"
  const initial = (row.email ?? "?").trim().charAt(0).toUpperCase() || "?"

  /** Run one write, show its receipt, surface a retry on failure. The shell owns the
   *  re-fetch that updates the chips; we only own the transient receipt + error. */
  async function runWrite(fn: () => Promise<void>, recorded: string) {
    if (busy) return
    setBusy(true)
    setFailed(false)
    setConfirm(null)
    try {
      await fn()
      setReceipt(recorded)
      window.setTimeout(() => setReceipt(null), 4000)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3", disabled && "bg-muted/20")}>
      {/* Identity: avatar + email + joined · docs · chats. */}
      <div className="flex min-w-0 flex-[2] items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            "flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold",
            disabled
              ? "bg-muted text-muted-foreground/60"
              : "bg-gradient-to-br from-primary to-primary/60 text-white",
          )}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground" title={email}>
            {email}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            joined {formatJoined(row.created_at)} · {row.doc_count} doc
            {row.doc_count === 1 ? "" : "s"} · {row.chat_count} chat
            {row.chat_count === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Honest last-active. */}
      <div
        className={cn(
          "flex-1 whitespace-nowrap text-xs tabular-nums",
          active.tone === "recent" && "text-success",
          active.tone === "stale" && "text-muted-foreground",
          active.tone === "never" && "italic text-muted-foreground",
        )}
      >
        {active.text}
      </div>

      {/* Status chip. */}
      <div className="flex-none">
        {disabled ? (
          <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            Disabled
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            Active
          </span>
        )}
      </div>

      {/* Role chip — amber (⛨ operator), NEVER kill-switch red. */}
      <div className="w-24 flex-none">
        {row.is_operator && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Operator
          </span>
        )}
      </div>

      {/* Actions + receipt. */}
      <div className="flex flex-none items-center justify-end gap-1.5">
        {receipt ? (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
            role="status"
          >
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            {receipt}
          </span>
        ) : (
          <>
            {/* Enable is restorative → direct (no sheet). Disable opens the victim
                sheet. Self-row disable is disabled with a courtesy tooltip. */}
            {disabled ? (
              <RowButton
                onClick={() => void runWrite(() => onEnable(row.id), "Re-enabled · recorded")}
                busy={busy}
                tone="neutral"
              >
                Enable
              </RowButton>
            ) : isSelf ? (
              <RowButton disabledReason="You cannot disable yourself" tone="neutral">
                Disable
              </RowButton>
            ) : (
              <RowButton onClick={() => setConfirm("disable")} busy={busy} tone="danger">
                Disable
              </RowButton>
            )}

            {/* Operator grant/revoke (amber). Self remove-operator is guarded. */}
            {row.is_operator ? (
              isSelf ? (
                <RowButton disabledReason="You cannot remove your own operator access" tone="amber">
                  Remove operator
                </RowButton>
              ) : (
                <RowButton onClick={() => setConfirm("revoke")} busy={busy} tone="amber">
                  Remove operator
                </RowButton>
              )
            ) : (
              <RowButton onClick={() => setConfirm("grant")} busy={busy} tone="amber">
                Make operator
              </RowButton>
            )}
          </>
        )}
      </div>

      {failed && (
        <div className="w-full text-right text-[11px] text-destructive" role="status">
          Couldn&rsquo;t apply that change — try again.
        </div>
      )}

      {/* Disabled-user notice — what THAT user now sees (068-A honesty). */}
      {disabled && (
        <div className="w-full text-[11px] italic text-muted-foreground">
          This account is disabled — they see &ldquo;This account is disabled — contact your
          administrator.&rdquo;
        </div>
      )}

      {/* ── Disable: the 064-B victim-naming sheet (names WHO, the effect, what is
             KEPT, reversibility, that it's recorded). Nothing fires until Confirm. ── */}
      <Sheet open={confirm === "disable"} onOpenChange={(o) => !o && setConfirm(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>Disable {email}?</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">{email}</span> loses access immediately — sign-in is
              refused, their API calls are refused, and any in-flight run is cancelled.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Their documents, chats and settings are kept, untouched. This is reversible — you can
              re-enable them at any time. This change is recorded with your name.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Keep active
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runWrite(() => onDisable(row.id), "Disabled · recorded")}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Disable {email}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Grant operator: an AMBER blast-radius sheet. ── */}
      <Sheet open={confirm === "grant"} onOpenChange={(o) => !o && setConfirm(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>Give {email} operator access?</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-400" aria-hidden="true" />
              <p className="text-sm text-foreground">
                As an operator, <span className="font-medium">{email}</span> can see every user's
                activity, disable other users, kill anyone's runs, and change platform-wide settings.
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              You can remove this at any time. This change is recorded with your name.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runWrite(() => onGrantOperator(row.id), "Operator granted · recorded")
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Make operator
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Revoke operator: an AMBER sheet — keeps their normal account; the trail stays. ── */}
      <Sheet open={confirm === "revoke"} onOpenChange={(o) => !o && setConfirm(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>Remove {email}'s operator access?</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">{email}</span> keeps their normal account — only the
              operator powers are removed. Their past operator actions stay in the audit trail.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">This change is recorded with your name.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runWrite(() => onRevokeOperator(row.id), "Operator access removed · recorded")
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Remove operator
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** A compact row-action button. When `disabledReason` is set it renders disabled with
 *  the reason as a tooltip (the self-row courtesy guard). Tone drives the color. */
function RowButton({
  children,
  onClick,
  busy,
  tone,
  disabledReason,
}: {
  children: ReactNode
  onClick?: () => void
  busy?: boolean
  tone: "neutral" | "danger" | "amber"
  disabledReason?: string
}) {
  const isDisabledBtn = Boolean(disabledReason) || Boolean(busy)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabledBtn}
      title={disabledReason}
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
        tone === "amber" && "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
        tone === "neutral" && "border-border bg-accent text-foreground hover:bg-accent/80",
      )}
    >
      {children}
    </button>
  )
}
