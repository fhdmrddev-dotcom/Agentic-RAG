/**
 * Phase 190-17 (CONN-02 / CONN-03 / D-23 / D-26 / D-27, UI-SPEC §3a–§3e, §9, §11a–§11d, §12) —
 * the add / edit panel sketch 156-A locked.
 *
 * ── WHY A 400px PUSH/SPLIT PANEL AND NOT A DIALOG (§3a, D-27 — locked) ──
 * 156-A won on PLACEMENT, not on form content: the form is byte-identical across the three
 * sketch variants by construction. What A buys is that **the list stays visible**, and the
 * reason that matters is a specific moment — *"when a check fails the honest next action is
 * to look at the list: which connection is now unusable, is anything else in the same
 * state. A dialog scrims that away."*
 *
 * ⚠ WHAT A COSTS, PAID HERE RATHER THAN DISCOVERED IN REVIEW (§3a / §12): `Dialog` would
 * have given a FOCUS TRAP and a FOCUS RESTORE for free. A push/split panel gives NEITHER.
 * Both are net-new a11y work and both are real code below — asserted in the suite via
 * `document.activeElement`, never by the presence of a handler. §14's failure condition is
 * verbatim *"the panel traps focus nowhere (Tab escapes into the table behind it)"*.
 *
 * ── WHY NOT REUSE THE SHIPPED RADIX `Sheet` FOR THE MOBILE HALF ──
 * `DocumentDetailPanel.tsx:283-292` drops into `<Sheet side="bottom">` below 768px, and
 * that is a good pattern for a panel with no trap of its own. This one HAS a trap, and
 * Radix's `Dialog` brings a second one: two traps competing for the same subtree is how a
 * keyboard user ends up unable to leave. One implementation, one restore, one set of
 * assertions — so the mobile branch is the same `<aside>` positioned as a bottom sheet
 * (`data-layout="sheet"`), and the trap below serves both layouts.
 *
 * ── `PhaseFormPanel.tsx` IS THE LINEAGE AND A HARD EMPTY-DIFF FENCE (D-23 / §1b) ──
 * Its two type rules are MIRRORED, never imported:
 *     panel title  → text-[13px] font-semibold   (PhaseFormPanel.tsx:742)
 *     field label  → text-[11px] font-medium     (PhaseFormPanel.tsx:228)
 * They are NOT unified with the Settings card title (`text-base font-headline` at weight
 * 700, SettingsPage.tsx:189-195) — those are two different SHIPPED rules and 190 declares
 * neither (§11b). This file imports nothing from `PhaseFormPanel`, and that file's measured
 * `git diff --numstat` is `0 0`: the G-5 ledger row says the next surface that needs the
 * panel gets its OWN component, and 189-14 already spent the one gated line.
 *
 * ── SPACING: THE OFF-GRID VALUES ARE INHERITED, NOT INTRODUCED (§11a) ──
 * The shipped panel form uses `padding: 16px 18px` on header/body/footer and ~`14px`
 * between fields. These are JUSTIFIED, PRE-EXISTING exceptions inherited from
 * `PhaseFormPanel` and `StatusChip.tsx:42`. **190 must NOT "fix" them onto the 4px grid** —
 * doing so would change shipped visual rhythm on five surfaces that never asked for it AND
 * would require editing `PhaseFormPanel.tsx`, whose required diff is `0 0`. The fix would
 * itself break a hard fence. Recorded here so a later gap-closure round does not correct
 * them; §14 names that correction as a failure condition in its own right.
 *
 * ── NO `title` ATTRIBUTE ANYWHERE (§12 / 142-B / the 184-07 lesson) ──
 * Every reason on this surface is real DOM text, wired by `aria-describedby` where it
 * explains a control. `ProviderPicker.tsx:211` uses a `title` ATTRIBUTE as a truncation
 * affordance for its footer; that half is deliberately NOT copied — this footer wraps
 * (`break-all`) instead of truncating — and the suite asserts zero `[title]` nodes in the
 * rendered output, which is stronger than a source grep because it also catches one
 * arriving through a spread or a shared primitive.
 *
 * ── THE COPY AND THE DERIVATIONS LIVE IN `connectionFormCopy.ts` ──
 * That module's header states the measured `react-refresh/only-export-components` reason.
 * THIS file exports components and nothing else.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════
 * PHASE 190-18 (UI-SPEC §4a–§4d, §5b, §5c, §2g) — the refusals, the check moments and the
 * graded destructive guards. Four rules bind everything added below:
 *
 * 1. ⚠ **NO SENTENCE IS WRITTEN HERE.** Every user-facing string comes from
 *    `connectionRefusalCopy.ts` (the §4c/§4d/§5b/§5c copy) or `connectionsCopy.ts` (the §2g
 *    guard copy, reused rather than re-authored so the panel and the row are unable to drift). The
 *    `REFUSAL_` / `CHECK_` / `CIPHER_UNAVAILABLE` greps are what prove it.
 *
 * 2. ⚠ **THE §4b ASYMMETRY IS THE CONTRACT, NOT A PREFERENCE.** An egress refusal leaves Save
 *    ENABLED (a refusal you can fix); a `no_encryption_key` refusal DISABLES Save with
 *    `aria-describedby` pointing at real DOM text (a refusal nothing you type helps). THIS IS
 *    THE ONE PLACE ON THIS SURFACE WHERE `disabled` IS RIGHT — everywhere else a write
 *    affordance that is unable to act is REMOVED (the shipped 185 rule; 190-16's plant C
 *    proved `toBeDisabled()` passes on that defect). Here the control is meaningful and its
 *    refusal IS the message, so removing it would hide the thing the message is about.
 *
 * 3. ⚠ **§4d's THREE STATES NEVER FLATTEN.** refused / unreachable / rejected keep three
 *    glyphs, three headings and three next steps. A refusal may never render the word
 *    "failed" and an unreachable host may never render the word "refused" — those two swaps
 *    make a security decision read as a bug and a bug read as a policy (§14).
 *
 * 4. ⚠ **THE GUARDS ARE GRADED BY CONSEQUENCE (§2g / 146–148, locked)**, and they reuse the
 *    row's shipped sheet copy verbatim: Delete → victim-naming sheet ALWAYS; Disable → sheet
 *    when `Used by > 0`, direct flip otherwise; Enable → direct (restorative); Replace →
 *    direct, and it SAYS it clears the check verdict because the server does exactly that.
 *    Every write lands as `✎ {verb} · recorded` — a receipt, never a transient pop-up.
 * ═════════════════════════════════════════════════════════════════════════════════════
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { ConnectorApiError } from "@/lib/api"
import type {
  ConnectorCapability,
  ConnectorCheckResult,
  ConnectorConnection,
  ConnectorConnectionCreate,
  ConnectorConnectionUpdate,
} from "@/lib/api"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  CAPABILITY_CHOICES,
  CAPABILITY_HELP,
  CAPABILITY_LABEL,
  CAPABILITY_LOCKED_NOTE,
  EMPTY_DRAFT,
  FIELD_JIRA_EMAIL_HELP,
  FIELD_JIRA_EMAIL_LABEL,
  FIELD_JIRA_EMAIL_PLACEHOLDER,
  FIELD_JIRA_PROJECT_HELP,
  FIELD_JIRA_PROJECT_LABEL,
  FIELD_JIRA_PROJECT_PLACEHOLDER,
  FIELD_JIRA_SECRET_LABEL,
  FIELD_JIRA_SITE_HELP,
  FIELD_JIRA_SITE_LABEL,
  FIELD_JIRA_SITE_PLACEHOLDER,
  FIELD_NAME_HELP,
  FIELD_NAME_LABEL,
  FIELD_SLACK_CHANNEL_HELP,
  FIELD_SLACK_CHANNEL_LABEL,
  FIELD_SLACK_CHANNEL_PLACEHOLDER,
  FIELD_SLACK_SECRET_LABEL,
  FIELD_SMTP_FROM_HELP,
  FIELD_SMTP_FROM_LABEL,
  FIELD_SMTP_FROM_PLACEHOLDER,
  FIELD_SMTP_HOST_HELP,
  FIELD_SMTP_HOST_LABEL,
  FIELD_SMTP_HOST_PLACEHOLDER,
  FIELD_SMTP_PORT_PLACEHOLDER,
  FIELD_SMTP_SECRET_LABEL,
  FOOTER_GLYPH,
  FOOTER_PREFIX,
  FOOTER_SERVER_NOTE,
  ORG_SHARED_FALLBACK_NAME,
  PANEL_CANCEL,
  PANEL_CLOSE_LABEL,
  PANEL_NON_ADMIN_NOTE,
  PANEL_OFF_BODY,
  PANEL_OFF_FOOTER,
  PANEL_OFF_GLYPH,
  PANEL_OFF_HEADING,
  PANEL_OFF_OPERATOR_PREFIX,
  PANEL_OFF_OPERATOR_SUFFIX,
  PANEL_REGION_LABEL_CREATE,
  PANEL_SAVE_CREATE,
  PANEL_SAVE_EDIT,
  PANEL_SAVE_FAILED,
  PANEL_SAVING,
  PANEL_SUBTITLE_CREATE,
  PANEL_SUBTITLE_EDIT,
  PANEL_TITLE_CREATE,
  SECRET_CREATE_HELP,
  SECRET_DOTS,
  SECRET_REPLACE_CANCEL,
  SECRET_REPLACE_INVALIDATES,
  SECRET_REPLACE_LABEL,
  SECRET_STORED_DATE_NOTE,
  SECRET_STORED_NOTE,
  capabilityLabelOf,
  configFromDraft,
  destinationFooterOf,
  draftFromConnection,
  orgSharedLine,
  panelRegionLabelEdit,
  secretStoredLabel,
  type ConnectionDraft,
} from "@/components/settings/connectionFormCopy"
import {
  CONNECTIONS_ACTION_CHECK,
  CONNECTIONS_ACTION_DELETE,
  CONNECTIONS_ACTION_DISABLE,
  CONNECTIONS_ACTION_ENABLE,
  CONNECTIONS_BANNER_OPERATOR_FLAG,
  CONNECTIONS_WRITE_FAILED,
  DELETE_CANCEL_LABEL,
  DISABLE_CANCEL_LABEL,
  RECEIPT_CHECKED,
  RECEIPT_DELETED,
  RECEIPT_DISABLED,
  RECEIPT_ENABLED,
  deleteConfirmLabel,
  deleteSheetBody,
  deleteSheetTitle,
  disableConfirmLabel,
  disableSheetBody,
  disableSheetTitle,
} from "@/components/settings/connectionsCopy"
import {
  CHECK_FAILURE_SENTENCE,
  CHECK_INFLIGHT_BODY,
  CHECK_INFLIGHT_BUTTON,
  CHECK_INFLIGHT_FOOTER,
  CHECK_INFLIGHT_HEADING,
  CHECK_NOT_RUN_GLYPH,
  CHECK_NOT_RUN_HEADING,
  CHECK_SUCCESS_FOOTER,
  CHECK_SUCCESS_GLYPH,
  CHECK_SUCCESS_HEADLINE,
  CHECK_UNAVAILABLE_DISABLED,
  CHECK_VERBATIM_LABEL,
  CIPHER_UNAVAILABLE_BLOCK,
  CIPHER_UNAVAILABLE_GLYPH,
  CIPHER_UNAVAILABLE_HEADING,
  CIPHER_UNAVAILABLE_REASON,
  CIPHER_UNAVAILABLE_SAVE_DISABLED_REASON,
  REFUSAL_AUDIT_LINE,
  REFUSAL_HEADINGS,
  REFUSAL_ORDERING_LINE,
  capabilityWordOf,
  checkPlatformBody,
  checkRejectedReachedLine,
  checkSuccessBody,
  isEgressRefusalReason,
  refusalBodyFor,
  refusalHeadingFor,
  vendorOf,
} from "@/components/settings/connectionRefusalCopy"

const MOBILE_BREAKPOINT = 768

/** Inline mobile hook — the project convention, declared per-file rather than shared
 *  (`DocumentDetailPanel.tsx:44-54` and `ClassificationRulesPage.tsx:34-44` each carry
 *  their own copy, both citing `WorkspacePanel.tsx:59-71`). Kept inline here for the same
 *  reason a copy module exists next door: a hook exported from a `.tsx` is a non-component
 *  export, which is the measured `react-refresh/only-export-components` cost 190-12
 *  recorded and 190-16 declined to repeat. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return isMobile
}

/** Everything a keyboard can land on, in DOM order. Recomputed on every Tab rather than
 *  cached: the form's control set CHANGES as you type (Replace swaps a span for an input,
 *  a capability switch swaps a whole field set), and a cached list would trap focus on a
 *  node that no longer exists. */
function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",")
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (node) => node.getAttribute("aria-hidden") !== "true",
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// One field row — label (11px/500, the MIRRORED PhaseFormPanel:228 rule) + help + control
// ═══════════════════════════════════════════════════════════════════════════════════════

function Field({
  label,
  help,
  htmlFor,
  children,
}: {
  label: string
  help?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  const helpId = `${htmlFor ?? label}-help`
  return (
    // ~14px between fields: the SHIPPED panel rhythm, an inherited exception (§11a).
    <div data-testid="connection-field" className="mb-3.5">
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-[11px] font-medium text-foreground"
      >
        {label}
      </label>
      {help && (
        <p id={helpId} className="mb-1 text-[11px] leading-snug text-muted-foreground">
          {help}
        </p>
      )}
      {children}
    </div>
  )
}

/** One editable text input, or — when the panel is read-only — the same value as static
 *  text. NOT a `disabled` input: a control that could never do anything is REMOVED, which
 *  is the shipped 185 rule and the one 190-16's plant C proved a `toBeDisabled()` assertion
 *  is unable to see. */
function TextControl({
  id,
  value,
  onChange,
  placeholder,
  describedBy,
  readOnly,
  className,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  describedBy?: string
  readOnly: boolean
  className?: string
}) {
  if (readOnly) {
    return (
      <div
        id={id}
        data-testid="connection-field-static"
        className={cn("font-mono text-[11px] text-muted-foreground", className)}
      >
        {value || "—"}
      </div>
    )
  }
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none",
        className,
      )}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 190-18 · One notice block — the shared frame every refusal, every unfixable refusal and
// check outcome renders through, so none of them can grow its own shape
// ═══════════════════════════════════════════════════════════════════════════════════════

/** `warning` = the platform is off (§9). `destructive` = a refusal or a failure.
 *  `positive` = the one green moment on this surface. `neutral` = work in flight. */
type NoticeTone = "destructive" | "positive" | "neutral"

const NOTICE_TONE: Record<NoticeTone, { box: string; glyph: string }> = {
  destructive: { box: "border-destructive/40 bg-destructive/10", glyph: "text-destructive" },
  positive: { box: "border-success/40 bg-success/10", glyph: "text-success" },
  neutral: { box: "border-border bg-muted/30", glyph: "text-muted-foreground" },
}

function NoticeBlock({
  tone,
  glyph,
  heading,
  testId,
  role,
  children,
}: {
  tone: NoticeTone
  glyph: string
  heading: string
  testId: string
  role?: "status"
  children?: React.ReactNode
}) {
  const t = NOTICE_TONE[tone]
  return (
    <div
      data-testid={testId}
      role={role}
      className={cn("mb-3 flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5", t.box)}
    >
      {/* The glyph is decorative: §12 requires the state to read in greyscale, which the
          HEADING already does. A screen reader hearing "⛔" adds nothing the words do not. */}
      <span aria-hidden="true" className={cn("mt-px text-[13px] leading-none", t.glyph)}>
        {glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div data-testid={`${testId}-heading`} className="text-[13px] font-medium text-foreground">
          {heading}
        </div>
        {children}
      </div>
    </div>
  )
}

/** One paragraph inside a notice. Kept as a component so every notice paragraph carries the
 *  same type, and so a future edit adds a STRING rather than a class. */
function NoticeLine({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className="mt-1 text-[13px] leading-relaxed text-muted-foreground"
    >
      {children}
    </p>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The panel
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface ConnectionFormPanelProps {
  open: boolean
  /** `create` shows the capability chooser; `edit` renders the stored row. */
  mode: "create" | "edit"
  /** The row being edited. Required in `edit` mode; ignored in `create`. */
  connection?: ConnectorConnection | null
  /** Render-only (U-02). `require_org_manage` on the API is the wall (plan 190-09). */
  isOrgAdmin: boolean
  /** Render-only (D-26 / §9). `require_visible("live_connectors")` on the three WRITE
   *  endpoints is the wall; with it off every write affordance HERE is REMOVED, and the
   *  ⛨ notice says the panel is read-only rather than promising a save the API declines. */
  liveConnectorsOn: boolean
  /** For the §3e org-shared line. Falls back to a name-free wording, never to a blank. */
  orgName?: string | null
  onClose: () => void
  /** Absent ⇒ NO save affordance (removed, never inert). */
  onCreate?: (body: ConnectorConnectionCreate) => Promise<void>
  onUpdate?: (id: string, body: ConnectorConnectionUpdate) => Promise<void>
  /** 190-18 · §5c. Absent ⇒ NO check affordance. Runs on the STORED connection and returns a
   *  VERDICT — never a credential (`ConnectorCheckResult` declares none, and the Pydantic
   *  `ConnectorCheckResponse` behind it is `extra='forbid'`). */
  onCheck?: (connection: ConnectorConnection) => Promise<ConnectorCheckResult>
  /** 190-18 · §2g. Absent ⇒ NO delete affordance. Guarded by the victim-naming sheet, always. */
  onDelete?: (connection: ConnectorConnection) => Promise<void>
  /** 190-18 · §2g. Absent ⇒ NO disable/enable affordance. Graded by `usedBy`. */
  onSetEnabled?: (connection: ConnectorConnection, next: boolean) => Promise<void>
  /** §2g's victim count — the same caller-scoped FLOOR the table row renders
   *  (`connectionsCopy.usageCountsFrom`). It GRADES the disable guard; it never blocks. */
  usedBy?: number
}

/** §2g's two sheets, and `null` for "no confirm open". Mirrors `ConnectionsTab`'s own
 *  `ConfirmKind` so the two surfaces grade identically. */
type PanelConfirmKind = "delete" | "disable" | null

/**
 * What the SAVE path refused with (§4b).
 *
 * ⚠ THE TWO BRANCHES ARE NOT SYMMETRIC AND THAT IS THE CONTRACT: `cipher` DISABLES Save,
 * `egress` leaves it enabled. `generic` is the shape `readConnectorReasonCode` returning
 * `null` lands in — it names no cause it is unable to read, which is why 190-17 shipped one
 * generic sentence rather than guessing.
 */
type SaveRefusal =
  | { kind: "cipher" }
  | { kind: "egress"; reasonCode: string }
  | { kind: "generic" }

/** The three §5c moments, plus the platform shape §4d deliberately does not own. */
type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; result: ConnectorCheckResult }
  | { kind: "platform"; reasonCode: string | null }

/**
 * Classify a save failure into §4b's two refusals, or into neither.
 *
 * Keyed off the SERVER'S OWN `reason_code`, surfaced verbatim by `ConnectorApiError` and
 * NEVER translated (`api.ts:5597-5632`). A client that invents its own wording produces a
 * seventh sentence nobody ratified — which is the whole reason §4c is a closed table.
 */
function saveRefusalFrom(error: unknown): SaveRefusal {
  if (error instanceof ConnectorApiError) {
    if (error.reasonCode === CIPHER_UNAVAILABLE_REASON) return { kind: "cipher" }
    if (isEgressRefusalReason(error.reasonCode)) {
      return { kind: "egress", reasonCode: error.reasonCode }
    }
  }
  return { kind: "generic" }
}

export function ConnectionFormPanel({
  open,
  mode,
  connection = null,
  isOrgAdmin,
  liveConnectorsOn,
  orgName,
  onClose,
  onCreate,
  onUpdate,
  onCheck,
  onDelete,
  onSetEnabled,
  usedBy = 0,
}: ConnectionFormPanelProps) {
  const isMobile = useIsMobile()
  const rootRef = useRef<HTMLElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const fieldId = useId()

  const [draft, setDraft] = useState<ConnectionDraft>(EMPTY_DRAFT)
  const [replacing, setReplacing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveRefusal, setSaveRefusal] = useState<SaveRefusal | null>(null)
  const [check, setCheck] = useState<CheckState>({ kind: "idle" })
  const [confirm, setConfirm] = useState<PanelConfirmKind>(null)
  const [busy, setBusy] = useState(false)
  const [writeFailed, setWriteFailed] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

  /** WRITES are possible only for an org admin on a platform whose switch is on — both
   *  halves mirror a REAL server gate, and neither is the gate itself. */
  const canWrite = isOrgAdmin && liveConnectorsOn
  const readOnly = !canWrite

  // ── Seed the draft when the panel opens (or the row behind it changes). ──
  // ⚠ `secret` is seeded to `""` BY CONSTRUCTION — `draftFromConnection` is unable to do
  // otherwise, because `ConnectorConnection` declares no credential field to copy from.
  //
  // ⚠ 190-18 — IT RE-SEEDS ON A DIFFERENT **ROW**, NOT ON A DIFFERENT **OBJECT**, and that
  // is a fix rather than a tidy-up. This plan gives the panel a Check button whose container
  // handler RE-FETCHES the list (the 068-A rule: a chip comes from the server's new truth,
  // never from an optimistic flip). A re-fetch hands back a NEW object for the SAME row, so
  // re-seeding on object identity would discard whatever the person had typed — at the exact
  // moment they were checking a credential before saving it. The guard below is written as a
  // seeded-key ref rather than as a narrowed dependency array so the dependency stays honest
  // (`connection` IS read here) and the rule stays on.
  const seededKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      seededKeyRef.current = null
      return
    }
    const key = `${mode}:${connection?.id ?? ""}`
    if (seededKeyRef.current === key) return
    seededKeyRef.current = key
    setDraft(mode === "edit" && connection ? draftFromConnection(connection) : EMPTY_DRAFT)
    setReplacing(false)
    setSaveRefusal(null)
    setCheck({ kind: "idle" })
    setReceipt(null)
    setWriteFailed(false)
  }, [open, mode, connection])

  // ── FOCUS RESTORE (§12 — net-new; `Dialog` would have given it free). ──
  // The opener is captured on open and re-focused on close, INCLUDING a close that follows
  // a successful save, because the cleanup runs on every transition out of `open`.
  useEffect(() => {
    if (!open) return
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null
    headingRef.current?.focus()
    const opener = openerRef.current
    return () => {
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [open])

  // ── FOCUS TRAP (§12 — net-new). Tab and Shift+Tab cycle WITHIN the panel. ──
  // ⚠ Attached as a NATIVE listener on the panel node, not as an `onKeyDown` JSX prop.
  // Two reasons, and the second is the real one: (a) `jsx-a11y/no-noninteractive-element-
  // interactions` refuses a keyboard handler on an `<aside>`, measured — the prop form took
  // `eslint src/components/settings/` 5 → 6; (b) the rule is RIGHT about the general case
  // and wrong about this one. The handler is not making the `<aside>` interactive; it is a
  // container-level key policy for the subtree, which is exactly what a native listener
  // expresses and a JSX prop does not. Nothing about the trap's behaviour changes — the
  // event still bubbles from whichever control has focus, and `preventDefault()` on the
  // native event is what `userEvent.tab()` reads before moving focus itself.
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const nodes = focusablesIn(rootRef.current)
      if (nodes.length === 0) {
        event.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      const inside = active !== null && rootRef.current?.contains(active) === true
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    const node = rootRef.current
    if (!open || !node) return
    node.addEventListener("keydown", onKeyDown)
    return () => node.removeEventListener("keydown", onKeyDown)
  }, [open, onKeyDown])

  // ── THE 🔒 FOOTER, DERIVED DURING RENDER (§3c). Never held in state — a derived footer
  //    kept in state is a footer that can disagree with the field above it, and on this
  //    surface that disagreement IS the threat (T-190-17-DEST). ──
  const footer = useMemo(() => destinationFooterOf(draft), [draft])

  const set = (patch: Partial<ConnectionDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const canSubmit = mode === "create" ? onCreate !== undefined : onUpdate !== undefined
  const showSave = canWrite && canSubmit

  /**
   * ⭐ §4b's ASYMMETRY, as one boolean.
   *
   * TRUE only for the cipher refusal — the one thing on this surface nothing the person types
   * can fix. An egress refusal deliberately leaves this FALSE so Save stays live over a
   * corrected host: *"a refusal you can fix leaves the door open."*
   */
  const saveBlocked = saveRefusal?.kind === "cipher"
  const saveDisabledReasonId = `${fieldId}-save-disabled-reason`

  /** One write, its receipt, and a retry on failure — `ConnectionsTab.tsx:533`'s idiom,
   *  reused rather than re-invented so the panel and the row report a write identically.
   *  The RECEIPT is transient (062-A: a receipt, never a transient pop-up); a connection's own state
   *  chip in the table is the CONSEQUENCE, and the two are deliberately separate. */
  async function runWrite(fn: () => Promise<void>, recorded: string) {
    if (busy) return
    setBusy(true)
    setWriteFailed(false)
    setConfirm(null)
    try {
      await fn()
      setReceipt(recorded)
      window.setTimeout(() => setReceipt(null), 4000)
    } catch {
      setWriteFailed(true)
    } finally {
      setBusy(false)
    }
  }

  /**
   * §5c — the check, in its three moments.
   *
   * ⚠ IT POSTS NO BODY. The check runs on the connection ALREADY STORED, so no plaintext
   * secret crosses the wire for a non-storage purpose, and it exercises the same org-scoped
   * resolver a RUN uses (plan 190-15 asserted the no-body property three ways: signature,
   * OpenAPI, and over the wire).
   */
  async function handleCheck() {
    if (!connection || !onCheck || check.kind === "checking") return
    setCheck({ kind: "checking" })
    setWriteFailed(false)
    try {
      const result = await onCheck(connection)
      setCheck({ kind: "done", result })
      // A check that could not even READ the credential is §4b moment 9 wearing a 503 —
      // same refusal, same disabled Save, told once.
      setReceipt(RECEIPT_CHECKED)
      window.setTimeout(() => setReceipt(null), 4000)
    } catch (error) {
      const reasonCode = error instanceof ConnectorApiError ? error.reasonCode : null
      if (reasonCode === CIPHER_UNAVAILABLE_REASON) {
        setSaveRefusal({ kind: "cipher" })
        setCheck({ kind: "idle" })
        return
      }
      setCheck({ kind: "platform", reasonCode })
    }
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setSaveRefusal(null)
    try {
      if (mode === "create") {
        await onCreate?.({
          capability: draft.capability,
          name: draft.name.trim(),
          config: configFromDraft(draft),
          secret: draft.secret,
        })
      } else if (connection) {
        const body: ConnectorConnectionUpdate = {
          name: draft.name.trim(),
          config: configFromDraft(draft),
        }
        // A present `secret` is a REPLACE, never a merge — so it is sent ONLY when the
        // person actually typed a new one. Sending an empty string would replace a working
        // credential with nothing AND reset the verdict, in one silent UPDATE.
        if (replacing && draft.secret !== "") body.secret = draft.secret
        await onUpdate?.(connection.id, body)
      }
      onClose()
    } catch (error) {
      // §4b — keyed off the SERVER's own reason code, never off a status or a message.
      setSaveRefusal(saveRefusalFrom(error))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  // `connection.capability` is optional since 206 (an MCP row has none). The draft's own
  // value is the fallback, not a cast: this panel edits capability connections.
  const capability: ConnectorCapability = mode === "edit" && connection
    ? connection.capability ?? draft.capability
    : draft.capability

  /**
   * The host a SAVE-path refusal is about — the thing the person typed.
   *
   * ⚠ The CHECK path never uses this: its refusal names `result.host`, which is the host the
   * SERVER resolved from the STORED row. Naming the typed value there would report a refusal
   * about a string the guard never saw.
   *
   * Slack has no typed host by construction (D-02: its endpoint is a constant in our source),
   * so it degrades to the destination the footer already renders rather than to a blank.
   */
  const typedHost =
    capability === "post_message"
      ? footer.destination
      : capability === "create_ticket"
        ? draft.baseUrl.trim()
        : draft.host.trim()

  const secretLabel =
    capability === "send_email"
      ? FIELD_SMTP_SECRET_LABEL
      : capability === "create_ticket"
        ? FIELD_JIRA_SECRET_LABEL
        : FIELD_SLACK_SECRET_LABEL

  const title = mode === "create" ? PANEL_TITLE_CREATE : (connection?.name ?? "")
  const regionLabel =
    mode === "create" ? PANEL_REGION_LABEL_CREATE : panelRegionLabelEdit(connection?.name ?? "")

  return (
    <aside
      ref={rootRef}
      aria-label={regionLabel}
      data-testid="connection-form-panel"
      data-layout={isMobile ? "sheet" : "split"}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden border-border bg-card",
        // Desktop: the 400px grid track the parent sizes. Mobile (<768px): a bottom sheet,
        // per the shipped shell rule — and it must remain usable at 375px, which is why the
        // BODY below is the scroll container and the notice blocks live inside it.
        isMobile
          ? "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-[14px] border-t shadow-2xl"
          : "h-full border-l",
      )}
    >
      {/* ── Header. Title type MIRRORS PhaseFormPanel.tsx:742 — text-[13px] font-semibold —
             and is NOT unified with the Settings card title (§11b, U-13). 16px/18px
             padding is the inherited shipped value (§11a). ── */}
      <header className="flex items-start justify-between gap-2 border-b border-border px-[18px] py-4">
        <div className="min-w-0">
          <h2
            ref={headingRef}
            tabIndex={-1}
            data-testid="connection-form-title"
            className="truncate text-[13px] font-semibold text-foreground outline-none"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {mode === "create" ? PANEL_SUBTITLE_CREATE : PANEL_SUBTITLE_EDIT}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={PANEL_CLOSE_LABEL}
          data-testid="connection-form-close"
          className="-mr-1 inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {/* ── The body IS the scroll container. At 375px the notice blocks are the tallest
             content and are what would otherwise become unreachable (§12's 375px row). ── */}
      <div
        data-testid="connection-form-body"
        className="min-h-0 flex-1 overflow-y-auto px-[18px] py-4"
      >
        {/* D-26 / §9 — told at the panel, because the person is about to create a
            connection that will not send, and not saying so would be the coy version.
            The SENTENCE is the D-190-DEF-07 correction 190-16 handed to this plan; see
            `connectionFormCopy.PANEL_OFF_BODY`'s docblock for the branch and its cost. */}
        {!liveConnectorsOn && (
          <div
            data-testid="connection-form-off-notice"
            className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-warning/30 bg-warning/10 px-3 py-2.5"
          >
            <span aria-hidden="true" className="mt-px text-[13px] leading-none text-warning">
              {PANEL_OFF_GLYPH}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground">{PANEL_OFF_HEADING}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {PANEL_OFF_BODY}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {PANEL_OFF_OPERATOR_PREFIX}
                <code className="font-mono text-[11px] text-warning">
                  {CONNECTIONS_BANNER_OPERATOR_FLAG}
                </code>
                {PANEL_OFF_OPERATOR_SUFFIX}
              </p>
              <p
                data-testid="connection-form-off-footer"
                className="mt-1.5 font-mono text-[11px] text-warning"
              >
                {PANEL_OFF_FOOTER}
              </p>
            </div>
          </div>
        )}

        {/* U-02 — the same sentence the table header carries, in the place the Save button
            is not. One fact, one wording, two surfaces. */}
        {!isOrgAdmin && (
          <p
            data-testid="connection-form-non-admin-note"
            className="mb-4 text-[11px] leading-snug text-muted-foreground"
          >
            {PANEL_NON_ADMIN_NOTE}
          </p>
        )}

        {/* ── The capability is chosen FIRST and the rest of the form appears (§3b). On
               edit it is STATIC — `ConnectorConnectionUpdate` carries no `capability`. ── */}
        {mode === "create" && !readOnly ? (
          <div data-testid="connection-capability-chooser" className="mb-3.5">
            <label
              htmlFor={`${fieldId}-capability`}
              className="mb-1 block text-[11px] font-medium text-foreground"
            >
              {CAPABILITY_LABEL}
            </label>
            <p
              id={`${fieldId}-capability-help`}
              className="mb-1 text-[11px] leading-snug text-muted-foreground"
            >
              {CAPABILITY_HELP}
            </p>
            {/* A native <select>, the 190-12 precedent: one control, a real <label>, and no
                portal for a keyboard user to escape into while a trap is armed. */}
            <select
              id={`${fieldId}-capability`}
              value={draft.capability}
              aria-describedby={`${fieldId}-capability-help`}
              onChange={(e) => set({ capability: e.target.value as ConnectorCapability })}
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground focus:border-primary focus:outline-none"
            >
              {CAPABILITY_CHOICES.map((choice) => (
                <option key={choice.capability} value={choice.capability}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div data-testid="connection-capability-static" className="mb-3.5">
            <div className="mb-1 text-[11px] font-medium text-foreground">{CAPABILITY_LABEL}</div>
            <div className="text-[13px] text-foreground">{capabilityLabelOf(capability)}</div>
            {mode === "edit" && (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {CAPABILITY_LOCKED_NOTE}
              </p>
            )}
          </div>
        )}

        {/* ── 1 · Name — every capability's first field. ── */}
        <Field label={FIELD_NAME_LABEL} help={FIELD_NAME_HELP} htmlFor={`${fieldId}-name`}>
          <TextControl
            id={`${fieldId}-name`}
            value={draft.name}
            onChange={(name) => set({ name })}
            describedBy={`${fieldId}-name-help`}
            readOnly={readOnly}
          />
        </Field>

        {/* ── 2 · The per-capability facts. EXACTLY what §3b binds and nothing beyond it:
               no CC field, no attachment field, no issue-type picker, no advanced section.
               Each extra field is a surface nobody threat-modelled (D-32 / T-190-17-SCOPE). ── */}
        {capability === "send_email" && (
          <>
            <Field
              label={FIELD_SMTP_HOST_LABEL}
              help={FIELD_SMTP_HOST_HELP}
              htmlFor={`${fieldId}-host`}
            >
              {/* The `1fr 92px` two-column row 156-A drew — one FIELD, two inputs. */}
              <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 92px" }}>
                <TextControl
                  id={`${fieldId}-host`}
                  value={draft.host}
                  onChange={(host) => set({ host })}
                  placeholder={FIELD_SMTP_HOST_PLACEHOLDER}
                  describedBy={`${fieldId}-host-help`}
                  readOnly={readOnly}
                />
                <TextControl
                  id={`${fieldId}-port`}
                  value={draft.port}
                  onChange={(port) => set({ port })}
                  placeholder={FIELD_SMTP_PORT_PLACEHOLDER}
                  describedBy={`${fieldId}-host-help`}
                  readOnly={readOnly}
                  className="font-mono"
                />
              </div>
            </Field>

            <Field
              label={FIELD_SMTP_FROM_LABEL}
              help={FIELD_SMTP_FROM_HELP}
              htmlFor={`${fieldId}-from`}
            >
              <TextControl
                id={`${fieldId}-from`}
                value={draft.fromAddress}
                onChange={(fromAddress) => set({ fromAddress })}
                placeholder={FIELD_SMTP_FROM_PLACEHOLDER}
                describedBy={`${fieldId}-from-help`}
                readOnly={readOnly}
              />
            </Field>
          </>
        )}

        {capability === "create_ticket" && (
          <>
            <Field
              label={FIELD_JIRA_SITE_LABEL}
              help={FIELD_JIRA_SITE_HELP}
              htmlFor={`${fieldId}-site`}
            >
              <TextControl
                id={`${fieldId}-site`}
                value={draft.baseUrl}
                onChange={(baseUrl) => set({ baseUrl })}
                placeholder={FIELD_JIRA_SITE_PLACEHOLDER}
                describedBy={`${fieldId}-site-help`}
                readOnly={readOnly}
              />
            </Field>
            <Field
              label={FIELD_JIRA_PROJECT_LABEL}
              help={FIELD_JIRA_PROJECT_HELP}
              htmlFor={`${fieldId}-project`}
            >
              <TextControl
                id={`${fieldId}-project`}
                value={draft.projectKey}
                onChange={(projectKey) => set({ projectKey })}
                placeholder={FIELD_JIRA_PROJECT_PLACEHOLDER}
                describedBy={`${fieldId}-project-help`}
                readOnly={readOnly}
                className="font-mono"
              />
            </Field>
            <Field
              label={FIELD_JIRA_EMAIL_LABEL}
              help={FIELD_JIRA_EMAIL_HELP}
              htmlFor={`${fieldId}-email`}
            >
              <TextControl
                id={`${fieldId}-email`}
                value={draft.accountEmail}
                onChange={(accountEmail) => set({ accountEmail })}
                placeholder={FIELD_JIRA_EMAIL_PLACEHOLDER}
                describedBy={`${fieldId}-email-help`}
                readOnly={readOnly}
              />
            </Field>
          </>
        )}

        {capability === "post_message" && (
          <Field
            label={FIELD_SLACK_CHANNEL_LABEL}
            help={FIELD_SLACK_CHANNEL_HELP}
            htmlFor={`${fieldId}-channel`}
          >
            <TextControl
              id={`${fieldId}-channel`}
              value={draft.channel}
              onChange={(channel) => set({ channel })}
              placeholder={FIELD_SLACK_CHANNEL_PLACEHOLDER}
              describedBy={`${fieldId}-channel-help`}
              readOnly={readOnly}
            />
          </Field>
        )}

        {/* ── 3 · The write-only secret (§3d / T-190-17-SECRET). ── */}
        <Field label={secretLabel} htmlFor={`${fieldId}-secret`}>
          {mode === "create" || replacing ? (
            <>
              {/* THE ONE PASSWORD-INPUT SITE IN THIS FILE. On edit it exists only after an
                  explicit Replace — never pre-filled, because there is nothing to pre-fill:
                  the response model carries no credential in either form. */}
              <input
                id={`${fieldId}-secret`}
                type="password"
                value={draft.secret}
                autoComplete="new-password"
                aria-describedby={`${fieldId}-secret-note`}
                onChange={(e) => set({ secret: e.target.value })}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground focus:border-primary focus:outline-none"
              />
              <p
                id={`${fieldId}-secret-note`}
                data-testid="connection-secret-create-help"
                className="mt-1 text-[11px] leading-snug text-muted-foreground"
              >
                {SECRET_CREATE_HELP}
              </p>
              {replacing && (
                <>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {SECRET_REPLACE_INVALIDATES}
                  </p>
                  <button
                    type="button"
                    data-testid="connection-secret-replace-cancel"
                    onClick={() => {
                      setReplacing(false)
                      set({ secret: "" })
                    }}
                    className="mt-1.5 inline-flex items-center rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {SECRET_REPLACE_CANCEL}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {/* ⚠ A `font-mono` <span> of DOTS — never an `<input type=password>`
                    carrying a fake value. A fake value is a value the DOM holds, and the
                    suite asserts BOTH halves (no password input in edit mode, and the dots
                    are a SPAN). `ProviderPicker.tsx:167`'s masked-key sentinel is the
                    concept; this renders text, not an input. */}
                <span
                  data-testid="connection-secret-dots"
                  aria-hidden="true"
                  className="font-mono text-[13px] tracking-widest text-muted-foreground"
                >
                  {SECRET_DOTS}
                </span>
                <span
                  data-testid="connection-secret-stored"
                  className="font-mono text-[11px] text-muted-foreground"
                >
                  {secretStoredLabel(connection?.created_at)}
                </span>
                {canWrite && (
                  <button
                    type="button"
                    data-testid="connection-secret-replace"
                    onClick={() => setReplacing(true)}
                    className="ml-auto inline-flex items-center rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent"
                  >
                    {SECRET_REPLACE_LABEL}
                  </button>
                )}
              </div>
              <p
                data-testid="connection-secret-note"
                className="mt-1.5 text-[11px] leading-snug text-muted-foreground"
              >
                {SECRET_STORED_NOTE}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {SECRET_STORED_DATE_NOTE}
              </p>
            </>
          )}
        </Field>

        {/* ── 4 · The org-shared line (§3e), at the foot of the fields. ── */}
        <p
          data-testid="connection-org-shared"
          className="mt-4 text-[11px] leading-snug text-muted-foreground"
        >
          {orgSharedLine(orgName?.trim() || ORG_SHARED_FALLBACK_NAME)}
        </p>
      </div>

      {/* ── The ALWAYS-ON 🔒 destination footer (§3c). Never conditional, never collapsible,
             never hover-revealed, never behind an “advanced” disclosure — it lives in the
             footer region so it stays on screen while the body scrolls. ── */}
      <div className="border-t border-border px-[18px] py-4">
        {/* ═══════════════════════════════════════════════════════════════════════════
            190-18 · THE REFUSALS AND THE CHECK MOMENTS.
            They live in the FOOTER region, beside the controls they are about, so a
            reason never scrolls away from the button it explains. All of it is real DOM
            text — never a `title` (§4a-4 / §12 / 142-B, the 184-07 lesson).
            ═══════════════════════════════════════════════════════════════════════════ */}

        {/* ── §4b MOMENT 9 — the refusal you are unable to fix. Save goes DISABLED. ── */}
        {saveRefusal?.kind === "cipher" && (
          <NoticeBlock
            tone="destructive"
            glyph={CIPHER_UNAVAILABLE_GLYPH}
            heading={CIPHER_UNAVAILABLE_HEADING}
            testId="connection-cipher-refusal"
          >
            {CIPHER_UNAVAILABLE_BLOCK.map((paragraph) => (
              <NoticeLine key={paragraph}>{paragraph}</NoticeLine>
            ))}
            {/* ⚠ The `aria-describedby` TARGET. Real DOM text, wired to the disabled Save —
                this is the one control on this surface that is disabled rather than
                removed, and this is the sentence that makes that legible. */}
            <p
              id={saveDisabledReasonId}
              data-testid="connection-save-disabled-reason"
              className="mt-1.5 text-[11px] leading-snug text-destructive"
            >
              {CIPHER_UNAVAILABLE_SAVE_DISABLED_REASON}
            </p>
          </NoticeBlock>
        )}

        {/* ── §4b MOMENT 8 — an egress refusal on the SAVE path. Save stays ENABLED. ── */}
        {saveRefusal?.kind === "egress" && (
          <NoticeBlock
            tone="destructive"
            glyph={REFUSAL_HEADINGS.refused.glyph}
            heading={refusalHeadingFor(saveRefusal.reasonCode)}
            testId="connection-save-refusal"
          >
            <NoticeLine testId="connection-save-refusal-body">
              {refusalBodyFor(saveRefusal.reasonCode, {
                host: typedHost,
                vendor: vendorOf(capability),
                capabilityWord: capabilityWordOf(capability),
              })}
            </NoticeLine>
            {/* ⚠ D-06 IN USER-FACING WORDS, AND IT IS NOT OPTIONAL PROSE. The rendered
                sentence reads "The refusal happened before your password was read, so it
                was never used and never left this form." — the n8n CVE inversion made
                visible to a human, and the ONLY place a person can see the ordering
                property `test_190_egress_ordering.py` proves. Asserted by character
                identity so it is unable to be trimmed as filler (T-190-18-D06). */}
            <NoticeLine>{REFUSAL_ORDERING_LINE}</NoticeLine>
            <NoticeLine>{REFUSAL_HEADINGS.refused.nextStep}</NoticeLine>
            <NoticeLine>{REFUSAL_AUDIT_LINE}</NoticeLine>
          </NoticeBlock>
        )}

        {/* ── §5c MOMENT 1 — in flight. Says, before it runs, that nothing leaves. ── */}
        {check.kind === "checking" && (
          <NoticeBlock
            tone="neutral"
            glyph="⟳"
            heading={CHECK_INFLIGHT_HEADING}
            testId="connection-check-inflight"
            role="status"
          >
            <NoticeLine>{CHECK_INFLIGHT_BODY}</NoticeLine>
          </NoticeBlock>
        )}

        {/* ── §5c MOMENT 2 — the one green moment, and its second clause is load-bearing. ── */}
        {check.kind === "done" && check.result.ok && (
          <NoticeBlock
            tone="positive"
            glyph={CHECK_SUCCESS_GLYPH}
            heading={CHECK_SUCCESS_HEADLINE}
            testId="connection-check-success"
            role="status"
          >
            <NoticeLine testId="connection-check-success-body">
              {checkSuccessBody({
                identity: check.result.identity,
                host: check.result.host,
                port: check.result.port,
                capability,
              })}
            </NoticeLine>
            <NoticeLine>{CHECK_SUCCESS_FOOTER}</NoticeLine>
          </NoticeBlock>
        )}

        {/* ── §4d — THREE STATES, NEVER FLATTENED. ──
               A refusal (we declined to open the socket) is not a failure (we tried and
               nothing answered) is not a rejection (we reached it and IT said no). Each
               arrives in its own `bucket` on the wire and renders its own heading, its own
               glyph and its own next step. §14 names the two forbidden swaps directly. */}
        {check.kind === "done" && !check.result.ok && (
          <NoticeBlock
            tone="destructive"
            glyph={
              check.result.bucket
                ? REFUSAL_HEADINGS[check.result.bucket].glyph
                : CHECK_NOT_RUN_GLYPH
            }
            heading={
              check.result.bucket === "refused"
                ? refusalHeadingFor(check.result.reason_code)
                : check.result.bucket
                  ? REFUSAL_HEADINGS[check.result.bucket].heading
                  : CHECK_NOT_RUN_HEADING
            }
            testId="connection-check-outcome"
            role="status"
          >
            {/* REFUSED — §4c's sentence for the guard's own code, D-06's ordering line, the
                next step, and the audit line. It renders no vendor words: on this bucket
                there is no vendor to quote, because no socket was opened. */}
            {check.result.bucket === "refused" && (
              <>
                <NoticeLine testId="connection-check-outcome-body">
                  {refusalBodyFor(check.result.reason_code, {
                    host: check.result.host,
                    vendor: vendorOf(capability),
                    capabilityWord: capabilityWordOf(capability),
                  })}
                </NoticeLine>
                <NoticeLine>{REFUSAL_ORDERING_LINE}</NoticeLine>
                <NoticeLine>{REFUSAL_HEADINGS.refused.nextStep}</NoticeLine>
                <NoticeLine>{REFUSAL_AUDIT_LINE}</NoticeLine>
              </>
            )}

            {/* UNREACHABLE — the address was ALLOWED. The next step is the network, not the
                token, and the sentence says so without borrowing the word "refused". */}
            {check.result.bucket === "unreachable" && (
              <NoticeLine testId="connection-check-outcome-body">
                {REFUSAL_HEADINGS.unreachable.nextStep}
              </NoticeLine>
            )}

            {/* REJECTED — §5b. The address is fine, the password is not; the middle
                paragraph claims exactly Gate 1's reach and no more (U-07a); and the host's
                own words go under a label that says they are verbatim (071-A). */}
            {check.result.bucket === "rejected" && (
              <>
                <NoticeLine testId="connection-check-outcome-body">
                  {checkRejectedReachedLine(check.result.host, check.result.port)}
                </NoticeLine>
                <NoticeLine testId="connection-check-failure-sentence">
                  {CHECK_FAILURE_SENTENCE}
                </NoticeLine>
                {check.result.provider_message !== "" && (
                  <>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {CHECK_VERBATIM_LABEL}
                    </div>
                    {/* NEVER paraphrased and NEVER truncated — `break-all`, not `truncate`. */}
                    <div
                      data-testid="connection-check-verbatim"
                      className="mt-1 break-all rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] text-foreground"
                    >
                      {check.result.provider_message}
                    </div>
                  </>
                )}
              </>
            )}

            {/* An `ok:false` with NO bucket is a shape the wire should never carry. It gets
                an honest sentence rather than an empty block — the 186 lesson that an
                unrecognised status must never render as a confident one. */}
            {check.result.bucket === null && (
              <NoticeLine testId="connection-check-outcome-body">
                {checkPlatformBody(check.result.reason_code)}
              </NoticeLine>
            )}
          </NoticeBlock>
        )}

        {/* ── The check that did not run. A PLATFORM condition, deliberately outside §4d's
               three: telling someone to "correct the host" about a switched-off connection
               sends them to fix something that is not broken. ── */}
        {check.kind === "platform" && (
          <NoticeBlock
            tone="destructive"
            glyph={CHECK_NOT_RUN_GLYPH}
            heading={CHECK_NOT_RUN_HEADING}
            testId="connection-check-not-run"
            role="status"
          >
            <NoticeLine testId="connection-check-not-run-body">
              {checkPlatformBody(check.reasonCode)}
            </NoticeLine>
          </NoticeBlock>
        )}

        <div
          data-testid="connection-destination-footer"
          data-refused={footer.refusedReason ? "true" : "false"}
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-3 py-2",
            footer.refusedReason
              ? "border border-destructive/50 bg-destructive/10"
              : "border border-primary/20 bg-primary/10",
          )}
        >
          {/* The LITERAL 🔒, not a lucide `Lock` — `ConnectionsTab.tsx:540`'s `Sends to`
              cell and `ConnectionPicker.tsx:335`'s bound footer both render the glyph, and
              §6d's rule is one mark, one shape, three surfaces. */}
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 text-[11px]",
              footer.refusedReason ? "text-destructive" : "text-primary",
            )}
          >
            {FOOTER_GLYPH}
          </span>
          <span className="text-[11px] text-muted-foreground">{FOOTER_PREFIX}</span>
          <span
            data-testid="connection-destination-value"
            className="min-w-0 break-all font-mono text-[11px] text-foreground"
          >
            {footer.destination}
          </span>
          {footer.tags.map((tag) => (
            <span
              key={tag}
              data-testid="connection-destination-tag"
              className={cn(
                "shrink-0 rounded border px-1 text-[11px]",
                footer.refusedReason
                  ? "border-destructive/50 text-destructive"
                  : "border-border text-muted-foreground",
              )}
            >
              {tag}
            </span>
          ))}
          {footer.detail && (
            <span className="font-mono text-[11px] text-muted-foreground">{footer.detail}</span>
          )}
        </div>
        {footer.refusedReason && (
          <p
            data-testid="connection-destination-refused-reason"
            className="mt-1 text-[11px] leading-snug text-destructive"
          >
            {footer.refusedReason}
          </p>
        )}
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{FOOTER_SERVER_NOTE}</p>

        {/* ── 190-18 · §2g — THE GRADED DESTRUCTIVE GUARDS, on the row the panel is editing.
               Present only when a write is genuinely possible: an org admin, a live
               platform, a stored row and a handler. Otherwise REMOVED, never inert. ── */}
        {canWrite && mode === "edit" && connection && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            {/* §5c's check. Its own footer sentence sits beside it while it runs, because
                that is the moment a person wants to be told nothing is being sent. */}
            {onCheck &&
              (connection.is_enabled ? (
                <button
                  type="button"
                  disabled={check.kind === "checking"}
                  onClick={() => void handleCheck()}
                  data-testid="connection-check-button"
                  className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                >
                  {check.kind === "checking" ? CHECK_INFLIGHT_BUTTON : CONNECTIONS_ACTION_CHECK}
                </button>
              ) : (
                <p
                  data-testid="connection-check-unavailable"
                  className="text-[11px] text-muted-foreground"
                >
                  {CHECK_UNAVAILABLE_DISABLED}
                </p>
              ))}
            {check.kind === "checking" && (
              <span className="text-[11px] text-muted-foreground">{CHECK_INFLIGHT_FOOTER}</span>
            )}

            {/* Disable is GRADED HONESTLY by whether a victim exists (§2g). Enable is
                RESTORATIVE and flips DIRECT — the deliberate asymmetry 068-A ships. */}
            {onSetEnabled &&
              (connection.is_enabled ? (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="connection-panel-disable"
                  onClick={() => {
                    if (usedBy > 0) setConfirm("disable")
                    else void runWrite(() => onSetEnabled(connection, false), RECEIPT_DISABLED)
                  }}
                  className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                >
                  {CONNECTIONS_ACTION_DISABLE}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="connection-panel-enable"
                  onClick={() => void runWrite(() => onSetEnabled(connection, true), RECEIPT_ENABLED)}
                  className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                >
                  {CONNECTIONS_ACTION_ENABLE}
                </button>
              ))}

            {/* Delete: ALWAYS the victim-naming sheet. Irreversible, and the credential it
                destroys is unrecoverable whatever the count says. */}
            {onDelete && (
              <button
                type="button"
                disabled={busy}
                data-testid="connection-panel-delete"
                onClick={() => setConfirm("delete")}
                className="inline-flex items-center rounded-md border border-destructive/40 px-2.5 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
              >
                {CONNECTIONS_ACTION_DELETE}
              </button>
            )}

            {/* ✎ {verb} · recorded — a RECEIPT, never a transient pop-up (062-A). The row's persistent
                state chip is the CONSEQUENCE, and the two stay separate. */}
            {receipt && (
              <span
                role="status"
                data-testid="connection-panel-receipt"
                className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-foreground"
              >
                <Check className="h-3 w-3 flex-none text-success" aria-hidden="true" />
                {receipt}
              </span>
            )}
          </div>
        )}

        {writeFailed && (
          <p role="status" data-testid="connection-panel-write-failed" className="mt-2 text-[11px] text-destructive">
            {CONNECTIONS_WRITE_FAILED}
          </p>
        )}

        {/* The actions. REMOVED, not disabled, whenever a write is impossible — for a
            non-admin (U-02) and while the kill-switch is off (D-26 / §9). The ONE exception
            is §4b moment 9, immediately below: there the control is meaningful and its
            refusal IS the message, so it is DISABLED with its reason in real DOM text. */}
        <div className="mt-3 flex items-center justify-end gap-2">
          {saveRefusal?.kind === "generic" && (
            <span
              role="status"
              data-testid="connection-save-failed"
              className="mr-auto text-[11px] text-destructive"
            >
              {PANEL_SAVE_FAILED}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            data-testid="connection-form-cancel"
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {PANEL_CANCEL}
          </button>
          {showSave && (
            <button
              type="button"
              disabled={saving || saveBlocked}
              aria-describedby={saveBlocked ? saveDisabledReasonId : undefined}
              onClick={() => void handleSave()}
              data-testid="connection-form-save"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {saving ? PANEL_SAVING : mode === "create" ? PANEL_SAVE_CREATE : PANEL_SAVE_EDIT}
            </button>
          )}
        </div>
      </div>

      {/* ── §2g's two sheets. The SAME copy the table row renders (`connectionsCopy`), so
             the guard reads identically wherever a person meets it — and the victim is named
             in the BUTTON LABEL, not only in the prose above it (the 064-B shape).
             Radix portals these to `document.body`, i.e. OUTSIDE this panel's subtree, so
             the panel's own Tab/Escape listener never competes with the sheet's — the two
             traps the 156-A decision refused to stack are still not stacked. ── */}
      {connection && (
        <>
          <Sheet open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
            <SheetContent side="bottom" className="mx-auto max-w-lg">
              <SheetHeader>
                <SheetTitle>{deleteSheetTitle(connection.name)}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4">
                <p data-testid="connection-panel-delete-body" className="text-[13px] leading-relaxed text-foreground">
                  {deleteSheetBody(usedBy)}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {DELETE_CANCEL_LABEL}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    data-testid="connection-panel-confirm-delete"
                    onClick={() =>
                      void runWrite(async () => {
                        await onDelete?.(connection)
                        // The row this panel is editing no longer exists — staying open on
                        // it would be a form over nothing.
                        onClose()
                      }, RECEIPT_DELETED)
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {deleteConfirmLabel(connection.name)}
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={confirm === "disable"} onOpenChange={(o) => !o && setConfirm(null)}>
            <SheetContent side="bottom" className="mx-auto max-w-lg">
              <SheetHeader>
                <SheetTitle>{disableSheetTitle(connection.name)}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4">
                <p data-testid="connection-panel-disable-body" className="text-[13px] leading-relaxed text-foreground">
                  {disableSheetBody(usedBy)}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {DISABLE_CANCEL_LABEL}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    data-testid="connection-panel-confirm-disable"
                    onClick={() =>
                      void runWrite(
                        () => onSetEnabled?.(connection, false) ?? Promise.resolve(),
                        RECEIPT_DISABLED,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {disableConfirmLabel(connection.name)}
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </aside>
  )
}

export default ConnectionFormPanel
