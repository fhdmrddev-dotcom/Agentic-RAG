/**
 * Phase 190-12 Task 2 (CONN-02 / CONN-03 / D-13, UI-SPEC §6a-§6d, §5a Gate 1) —
 * ConnectionPicker: where an `external_action` step sends.
 *
 * ── WHY THIS IS A CHILD AND NOT THREE MORE PROPS ON THE SECTION ──
 * `190-CONTEXT.md` D-23 says the picker "extends the EXISTING `ExternalActionSection.tsx`",
 * describing it as having six props. Measured at HEAD it has THREE
 * (`ExternalActionSection.tsx:88-98`). The "six" are six SOURCE-PURITY FENCES
 * (`ExternalActionSection.test.tsx:381-412`) — a different thing and a far more binding
 * one: a `useEffect`, a `fetch(` or an `@/lib/api` import inside that file turns all six
 * RED. And its `onChange` is key-bound through `PhaseFormPanel.tsx`'s `set(key)`, so
 * writing `connection_id` through it needs a fourth prop on the section, hence a fourth
 * argument out of the panel — whose required diff for this phase is `0 0` (D-23).
 * So the effect, the read AND the write all live HERE, in a net-new sibling child, and the
 * section's whole cost is one relative import plus one gated JSX line.
 *
 * ── WHAT CROSSES INTO THE DEFINITION: A REFERENCE, AND NOTHING ELSE (D-13 / CONN-03) ──
 * The only key this component ever writes is `connection_id`. No host, no port, no channel,
 * no account, no token, no credential of any kind enters `workflow_definitions.definition`
 * — a published definition is readable by everyone in the org, so a destination fact copied
 * into it would be a disclosure with a friendly name. The credential itself is not on this
 * surface at all: it is write-only at the API boundary and is not sent back to any browser.
 * `ConnectionPicker.test.tsx`'s T6 asserts the patch object carries exactly that one key,
 * and was observed RED against a planted `smtp_password` write.
 *
 * ── GATE 1 IS A CLIENT GATE, AND THE COPY SAYS ONLY WHAT A CLIENT GATE DELIVERS ──
 * UI-SPEC §5a takes door (b) knowingly: the SERVER validates a `connection_id` write
 * against the row's org and its `is_enabled` flag, and deliberately does NOT read
 * `last_check_verdict`. A failing verdict is a QUALITY HINT, not an authorization boundary
 * — blocking the bind prevents no send, and a server bind-gate would hard-stop a plain
 * member holding a stale verdict they have no way to clear (checking is admin-only, U-02).
 * So this file enforces exactly one thing — the picker does not bind a failing connection —
 * and copy rule 5 binds every string in it: no sentence claims an absolute for a guarantee
 * only this gate provides. The subject of the sentence is *the picker*, and nothing wider.
 *
 * ── EVERY USER-VISIBLE STRING IS AN EXPORTED IDENTIFIER ──
 * The `GovernanceSection.tsx:10-17` discipline, for its stated reason: a sentence that
 * lives inline inside JSX is a sentence nobody can test for drift. The suite asserts
 * character-identity against the names below. (This module DOES consult the server, which
 * is the whole point of it existing; only the copy half of that idiom transfers.)
 *
 * ── DEGRADE, NEVER THROW ──
 * `ExternalActionSection.test.tsx` and `PhaseFormPanel.rails.test.tsx` both render their
 * subject standalone, with no Builder store and no slug provider. Both readers here are the
 * optional ones, and with either absent this component renders its disconnected state and
 * OPENS NO REQUEST — the guard is on the effect, not merely on the write, so a shipped
 * suite neither goes red nor grows an unmocked network call it never asked for.
 *
 * ── NO TOOLTIP AFFORDANCE ANYWHERE ──
 * Every reason on this surface is real DOM text wired by `aria-describedby` (142-B, the
 * 184-07 lesson). The `ProviderPicker.tsx:202-222` footer is the structural analog and its
 * truncation attribute is the ONE thing deliberately not copied.
 */
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react"

import { Label } from "@/components/ui/label"
import { useBuilderStoreOptional } from "@/components/workflows/BuilderStoreProvider"
import { useSelectedPhaseSlug } from "@/components/workflows/SelectedPhaseSlugContext"
import { listConnectorConnections } from "@/lib/api"
import type { ConnectorConnection } from "@/lib/api"
import { McpToolPicker } from "./McpToolPicker"

// ── THE COPY ─────────────────────────────────────────────────────────────────────────
// Exported identifiers, asserted by character-identity in `ConnectionPicker.test.tsx`.
// The three UI-SPEC §6d strings are verbatim; the label and the disconnected reading are
// authored here and recorded in the summary as this plan's own two sentences.

/** The field's own name. Plain-first (LANG-01): the author is answering *where does this
 *  send?*, which is the second of the section's two ordered questions. */
export const CONNECTION_PICKER_LABEL = "Where this sends"

/** State 1. One dim line, no spinner — this is a 400px panel field, not a run surface. */
export const CONNECTION_PICKER_LOADING = "Loading…"

/** State 3's option text. The unbound choice is a real, selectable, named option rather
 *  than an absence, so unbinding is as reachable as binding. */
export const CONNECTION_PICKER_NONE_OPTION = "— none —"

/** State 3's footer (UI-SPEC §6d, verbatim). `Not sent — recorded` is the run-time word
 *  and is deliberately NOT repeated here; this says what the step will DO. */
export const CONNECTION_PICKER_NOTHING_BOUND_FOOTER =
  "🔒 nothing bound — this step will record, not send"

/** State 7 (UI-SPEC §6d, verbatim) — the honest fourth reading. Populated, empty, loading
 *  and error are four different facts, and a read failure that renders as "none exist"
 *  would tell an author to create something they already have. */
export const CONNECTION_PICKER_READ_FAILED =
  "Could not load connections. The step will record, not send, until one is bound."

/** Gate 1's inline refusal (UI-SPEC §5a, verbatim). Note the subject: the sentence names
 *  the fix and its home, and claims nothing about what any other surface will accept. */
export const CONNECTION_PICKER_FAILING_REFUSAL =
  "This connection's credential is failing. Fix it in Settings → Connections, then pick it here."

/** State 5's marker. Glyph AND word, so it reads in greyscale (WCAG 1.4.1). */
export const CONNECTION_STATE_FAILED = "✕ credential failed"

/** State 6's marker — an unchecked connection is not a failed one, and stays selectable. */
export const CONNECTION_STATE_NOT_CHECKED = "◌ not checked"

/** The plain word for each capability. The wire id is never rendered — the author reads
 *  sentences, the ids are wire values (the D-20 boundary `ExternalActionSection` keeps). */
export const CONNECTION_CAPABILITY_WORDS: Record<string, string> = {
  send_email: "email",
  create_ticket: "ticket",
  post_message: "message",
}

/** State 2 (UI-SPEC §6d, verbatim shape). TEXT ONLY, NO LINK, and that is a decision:
 *  the three-homes IA has no router on this surface and a leaf inside the Builder has no
 *  way to switch `ActiveView`. Naming the destination is honest; a dead link is not. */
export const noConnectionYetNote = (capability: string): string =>
  `No ${CONNECTION_CAPABILITY_WORDS[capability] ?? "external"} connection yet — add one in Settings → Connections.`

const EMPTY_RECORD: Record<string, unknown> = Object.freeze({})

/** Slack's API host is a module constant in `backend/app/security/egress.py` (D-02) — one
 *  of the three destinations that is unforgeable by construction, which is why a Slack
 *  connection stores a channel and no URL at all. Rendered here so the footer can still
 *  answer *where does this send?* for that capability; the SERVER's constant is the
 *  authority and this string is a reading of it, not a second source. */
export const SLACK_FIXED_DESTINATION = "slack.com/api"

// ── LOOKS ────────────────────────────────────────────────────────────────────────────

const FIELD_CLASSES = "mt-2 border-t border-border/60 pt-2"

const LABEL_CLASSES = "text-[11px] font-medium text-foreground"

const SELECT_CLASSES =
  "mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"

const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"

const FOOTER_CLASSES = "mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground"

const REFUSAL_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-destructive"

// ── DERIVATIONS (during render, never from state) ────────────────────────────────────

/** A connection whose last check failed. Absent / `not_checked` / `ok` are all NOT this —
 *  the guard is deliberately narrow, because widening it would refuse a connection nobody
 *  has checked yet, which is the one thing UI-SPEC §6d state 6 forbids. */
const isFailing = (connection: ConnectorConnection): boolean =>
  connection.last_check_verdict === "failed"

/** The row's `Sends to` facts, built from parts during render — the
 *  `ProviderPicker.tsx:159-165` derived-footer idiom. One mark, one shape, three surfaces:
 *  this is the same 🔒 destination form the Settings table column and the Settings panel
 *  render, so the seam invents no second vocabulary (UI-SPEC §6d). */
export const destinationPartsOf = (connection: ConnectorConnection): string[] => {
  // Read defensively through `unknown`: `ConnectorConnectionConfig` is a three-member
  // union and this reader is deliberately total over it, so a fourth member added later
  // degrades to an empty footer rather than to a compile error in an unrelated file.
  const config = connection.config as unknown as Record<string, unknown>
  const text = (key: string): string => (typeof config[key] === "string" ? (config[key] as string) : "")
  if (connection.capability === "send_email") {
    const host = text("host")
    const port = typeof config.port === "number" ? String(config.port) : ""
    const from = text("from_address")
    return [host && port ? `${host}:${port}` : host, from ? `from ${from}` : ""].filter(Boolean)
  }
  if (connection.capability === "create_ticket") {
    return [text("base_url"), text("project_key")].filter(Boolean)
  }
  const channel = text("default_channel")
  return [SLACK_FIXED_DESTINATION, channel ? (channel.startsWith("#") ? channel : `#${channel}`) : ""].filter(
    Boolean,
  )
}

/** `{name}` · `{name}  ✕ credential failed` · `{name}  ◌ not checked` — the state word
 *  rides the option itself so the list reads honestly before it is opened. */
export const optionLabelOf = (connection: ConnectorConnection): string => {
  if (isFailing(connection)) return `${connection.name}  ${CONNECTION_STATE_FAILED}`
  if (connection.last_check_verdict === "ok") return connection.name
  return `${connection.name}  ${CONNECTION_STATE_NOT_CHECKED}`
}

/** Every settled read carries the KEY it answered. A result for a previous capability is
 *  therefore not a result at all — the field reads `loading` again by derivation, with no
 *  synchronous `setState` in the effect body and so no cascading render. */
type ReadState =
  | { kind: "loading"; key: string }
  | { kind: "ready"; key: string; connections: ConnectorConnection[] }
  | { kind: "error"; key: string }

export interface ConnectionPickerProps {
  /** The step's chosen capability, already narrowed to a recognised one by the section.
   *  The picker is mounted only once this is answered — the two questions are ordered. */
  capability: string
}

export function ConnectionPicker({ capability }: ConnectionPickerProps) {
  const store = useBuilderStoreOptional()
  const slug = useSelectedPhaseSlug()
  const selectId = useId()
  const refusalId = useId()

  /** What this render is asking for. A capability change (or a different step) makes the
   *  settled answer stale, which is a derivation rather than an effect. */
  const requestKey = `${slug ?? ""}::${capability}`
  const [settled, setSettled] = useState<ReadState>({ kind: "loading", key: "" })
  const read: ReadState = settled.key === requestKey ? settled : { kind: "loading", key: requestKey }
  /** The id an author reached for and Gate 1 declined. Cleared by any accepted choice. */
  const [refusedId, setRefusedId] = useState<string | null>(null)

  // The bound id, read REACTIVELY off the store. `store.getState()` inside a component is
  // a snapshot, not a subscription (the React-19 rule `BuilderStoreProvider.tsx:61-77`
  // records for the temporal store) — so an undo that clears `connection_id` has to move
  // this field too. `useSyncExternalStore` rather than `useStore` because the store may be
  // null and a hook may not be called conditionally.
  const subscribe = useCallback(
    (onChange: () => void) => (store === null ? () => {} : store.subscribe(onChange)),
    [store],
  )
  const boundIdSnapshot = useCallback((): string | null => {
    if (store === null || slug === null) return null
    const phase = store.getState().phases.find((p) => p.slug === slug)
    const value = phase?.config?.connection_id
    return typeof value === "string" && value !== "" ? value : null
  }, [store, slug])
  const boundId = useSyncExternalStore(subscribe, boundIdSnapshot, boundIdSnapshot)

  const toolNameSnapshot = useCallback((): string => {
    if (store === null || slug === null) return ""
    const phase = store.getState().phases.find((p) => p.slug === slug)
    const val = (phase?.config as Record<string, unknown> | undefined)?.tool_name
    return typeof val === "string" ? val : ""
  }, [store, slug])
  const toolName = useSyncExternalStore(subscribe, toolNameSnapshot, toolNameSnapshot)

  const toolArgsSnapshot = useCallback((): string => {
    if (store === null || slug === null) return "{}"
    const phase = store.getState().phases.find((p) => p.slug === slug)
    const val = (phase?.config as Record<string, unknown> | undefined)?.tool_args
    return typeof val === "object" && val !== null ? JSON.stringify(val) : "{}"
  }, [store, slug])
  const toolArgsJson = useSyncExternalStore(subscribe, toolArgsSnapshot, toolArgsSnapshot)
  const toolArgs = useMemo(() => {
    try {
      return JSON.parse(toolArgsJson) as Record<string, unknown>
    } catch {
      return EMPTY_RECORD
    }
  }, [toolArgsJson])

  const handleSelectTool = useCallback(
    (tool: string) => {
      if (store === null || slug === null) return
      store.getState().patchConfig(slug, { tool_name: tool })
      store.getState().flushHistory()
    },
    [store, slug],
  )

  const handleChangeArgs = useCallback(
    (args: Record<string, unknown>) => {
      if (store === null || slug === null) return
      store.getState().patchConfig(slug, { tool_args: args })
      store.getState().flushHistory()
    },
    [store, slug],
  )

  // THE READ. Gated on the same two nulls the write is, so a provider-less render opens no
  // request at all — see the docblock: this is what keeps two shipped suites unaffected.
  useEffect(() => {
    if (store === null || slug === null) return
    let cancelled = false
    listConnectorConnections(capability)
      .then((rows) => {
        if (cancelled) return
        // A DISABLED connection is not listed at all — it is not a choice (UI-SPEC §6d).
        setSettled({ kind: "ready", key: requestKey, connections: rows.filter((row) => row.is_enabled) })
      })
      .catch(() => {
        if (!cancelled) setSettled({ kind: "error", key: requestKey })
      })
    return () => {
      cancelled = true
    }
  }, [store, slug, capability, requestKey])

  /** THE WRITE — one key, and the plan's whole D-13 obligation is that it stays one key. */
  const bind = (id: string | null) => {
    if (store === null || slug === null) return
    store.getState().patchConfig(slug, { connection_id: id })
    store.getState().flushHistory()
  }

  const onSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value
    if (id === "") {
      setRefusedId(null)
      bind(null)
      return
    }
    const chosen = read.kind === "ready" ? read.connections.find((row) => row.id === id) : undefined
    if (chosen === undefined) return
    if (isFailing(chosen)) {
      // ── GATE 1 ── The picker declines, writes nothing, and says why in real DOM text.
      setRefusedId(id)
      return
    }
    setRefusedId(null)
    bind(id)
  }

  const label = (
    <Label htmlFor={selectId} className={LABEL_CLASSES}>
      {CONNECTION_PICKER_LABEL}
    </Label>
  )

  // STATE 0 — disconnected. No store or no selected step: nothing to read, nothing to
  // write, and no control offered that could not be honoured. The footer still tells the
  // truth about the step, which is the one thing this render can honestly say.
  if (store === null || slug === null) {
    return (
      <div data-testid="connection-picker" data-state="disconnected" className={FIELD_CLASSES}>
        {label}
        <p data-testid="connection-picker-footer" className={FOOTER_CLASSES}>
          {CONNECTION_PICKER_NOTHING_BOUND_FOOTER}
        </p>
      </div>
    )
  }

  // STATE 1 — loading.
  if (read.kind === "loading") {
    return (
      <div data-testid="connection-picker" data-state="loading" className={FIELD_CLASSES}>
        {label}
        <p data-testid="connection-picker-loading" className={NOTE_CLASSES}>
          {CONNECTION_PICKER_LOADING}
        </p>
      </div>
    )
  }

  // STATE 7 — the read failed. A live region, because it arrives after first paint.
  if (read.kind === "error") {
    return (
      <div data-testid="connection-picker" data-state="error" className={FIELD_CLASSES}>
        {label}
        <p data-testid="connection-picker-error" role="alert" className={REFUSAL_CLASSES}>
          {CONNECTION_PICKER_READ_FAILED}
        </p>
      </div>
    )
  }

  const connections = read.connections

  // STATE 2 — none exist for this capability.
  if (connections.length === 0) {
    return (
      <div data-testid="connection-picker" data-state="empty" className={FIELD_CLASSES}>
        {label}
        <p data-testid="connection-picker-empty" className={NOTE_CLASSES}>
          {noConnectionYetNote(capability)}
        </p>
      </div>
    )
  }

  const bound = boundId === null ? undefined : connections.find((row) => row.id === boundId)

  // STATE 5 renders its refusal PERSISTENTLY, not only after an attempt: a binding that
  // predates the failure is kept rather than silently dropped, so the author needs the
  // reason in front of them whenever the field is on screen.
  const showRefusal = refusedId !== null || (bound !== undefined && isFailing(bound))

  // STATES 3 / 4 — the footer, built from parts during render, never from state.
  const footer =
    bound === undefined
      ? CONNECTION_PICKER_NOTHING_BOUND_FOOTER
      : `🔒 ${destinationPartsOf(bound).join(" · ")}`

  return (
    <div
      data-testid="connection-picker"
      data-state={bound === undefined ? "unbound" : isFailing(bound) ? "bound-failing" : "bound"}
      className={FIELD_CLASSES}
    >
      {label}
      <select
        id={selectId}
        data-testid="connection-picker-select"
        className={SELECT_CLASSES}
        value={bound === undefined ? "" : bound.id}
        onChange={onSelect}
        {...(showRefusal ? { "aria-describedby": refusalId } : {})}
      >
        <option value="">{CONNECTION_PICKER_NONE_OPTION}</option>
        {connections.map((row) => (
          <option
            key={row.id}
            value={row.id}
            data-testid="connection-picker-option"
            data-verdict={row.last_check_verdict ?? "not_checked"}
            // GATE 1's announced half. `aria-disabled` rather than the hard `disabled`
            // attribute is DELIBERATE and is the difference between a rule and a rule with
            // no reachable explanation: a hard-disabled option is unreachable, so the
            // refusal sentence §5a requires could never render and would be dead copy. The
            // option is announced as unavailable, and the handler declines the write.
            {...(isFailing(row) ? { "aria-disabled": "true" } : {})}
          >
            {optionLabelOf(row)}
          </option>
        ))}
      </select>

      {showRefusal && (
        <p id={refusalId} data-testid="connection-picker-refusal" className={REFUSAL_CLASSES}>
          {CONNECTION_PICKER_FAILING_REFUSAL}
        </p>
      )}

      <p data-testid="connection-picker-footer" className={FOOTER_CLASSES}>
        {footer}
      </p>

      {bound?.mcp_server_url && (
        <McpToolPicker
          connection={bound}
          toolName={toolName}
          toolArgs={toolArgs}
          onSelectTool={handleSelectTool}
          onChangeArgs={handleChangeArgs}
        />
      )}
    </div>
  )
}

export default ConnectionPicker

