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
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type {
  ConnectorCapability,
  ConnectorConnection,
  ConnectorConnectionCreate,
  ConnectorConnectionUpdate,
} from "@/lib/api"
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
import { CONNECTIONS_BANNER_OPERATOR_FLAG } from "@/components/settings/connectionsCopy"

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
 *  cannot see. */
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
}: ConnectionFormPanelProps) {
  const isMobile = useIsMobile()
  const rootRef = useRef<HTMLElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const fieldId = useId()

  const [draft, setDraft] = useState<ConnectionDraft>(EMPTY_DRAFT)
  const [replacing, setReplacing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  /** WRITES are possible only for an org admin on a platform whose switch is on — both
   *  halves mirror a REAL server gate, and neither is the gate itself. */
  const canWrite = isOrgAdmin && liveConnectorsOn
  const readOnly = !canWrite

  // ── Seed the draft when the panel opens (or the row behind it changes). ──
  // ⚠ `secret` is seeded to `""` BY CONSTRUCTION — `draftFromConnection` cannot do
  // otherwise, because `ConnectorConnection` declares no credential field to copy from.
  useEffect(() => {
    if (!open) return
    setDraft(mode === "edit" && connection ? draftFromConnection(connection) : EMPTY_DRAFT)
    setReplacing(false)
    setSaveFailed(false)
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

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setSaveFailed(false)
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
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const capability: ConnectorCapability = mode === "edit" && connection
    ? connection.capability
    : draft.capability

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

        {/* The actions. REMOVED, not disabled, whenever a write is impossible — for a
            non-admin (U-02) and while the kill-switch is off (D-26 / §9). */}
        <div className="mt-3 flex items-center justify-end gap-2">
          {saveFailed && (
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
              disabled={saving}
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
    </aside>
  )
}

export default ConnectionFormPanel
