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
import type { ExternalActionShape } from "./externalShapeVocabulary"
import { McpToolPicker } from "./McpToolPicker"
import { own } from "./ownProperty"

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
 *  way to switch `ActiveView`. Naming the destination is honest; a dead link is not.
 *
 *  ⚠ WR-04 — THE NINTH LIVE SINK IN THIS TREE, CLOSED HERE (Phase 206.2-02, UI-SPEC
 *  § "One WR-04 sink this branch makes live"). This line shipped as a bare bracket read with
 *  a `??` fallback over a plain object literal. A plain literal INHERITS `constructor`,
 *  `toString`, `__proto__` and friends, and an inherited member is never nullish — so the
 *  fallback never fires for those keys and the `Object` FUNCTION stringifies into the
 *  sentence. Eight instances of this exact class have been closed in this tree already; the
 *  most recent (`PhaseFormPanel`, Phase 200) rendered as NOTHING AT ALL rather than as
 *  `[Function Object]`, because React refused the child outright.
 *  It was unreachable here at 206.2's base — the section narrows the key before mounting the
 *  picker — and the MCP shape is what widens what reaches this file. `own()` is the
 *  zero-import leaf `ownProperty.ts` exists to be; the rendered output for all three
 *  capability words is unchanged, which three character-identity assertions already pin. */
export const noConnectionYetNote = (capability: string): string =>
  `No ${own(CONNECTION_CAPABILITY_WORDS, capability) ?? "external"} connection yet — add one in Settings → Connections.`

/** State 2, MCP shape — no MCP-shaped connection exists at all (UI-SPEC § Surface 2, verbatim).
 *
 *  ⚠ IT IS A SEPARATE SENTENCE FROM `noConnectionYetNote` ON PURPOSE. That one prints
 *  *"No external connection yet"* for an unrecognised key and *"No email connection yet"* for
 *  a known one; reusing either on this shape is `[PATTERNS]`'s named anti-pattern — an author
 *  looking for an MCP server would be told about something else.
 *
 *  Same shape as the shipped sentence (the fact, then where to fix it), and TEXT ONLY, NO
 *  LINK for the shipped reason: there is no router on this surface and a leaf inside the
 *  Builder has no way to switch `ActiveView`. Naming the destination is honest; a dead link
 *  is not. */
export const CONNECTION_PICKER_NO_MCP_NOTE =
  "No MCP server connection yet — add one in Settings → Connections."

/** State 2's FIFTH arm, MCP shape only (UI-SPEC § Surface 2 / AR-04, verbatim).
 *
 *  ⚠ A DIFFERENT FACT FROM "none exist", AND FOLDING THE TWO IS THE DEFECT THIS TREE HAS NOW
 *  RECORDED FIVE TIMES (`runFacts.ts` CR-01, `DecisionsList` D-20, `transcriptVocabulary.ts`,
 *  206.1's AR-05). An author told *"none yet"* while one sits switched off goes and creates a
 *  duplicate — the list was read, the rows were seen, and they were rejected for a reason the
 *  author is able to undo in one click. That is worth its own sentence. */
export const CONNECTION_PICKER_MCP_ALL_DISABLED =
  "Every MCP server connection is switched off. Turn one on in Settings → Connections."

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
 *  render, so the seam invents no second vocabulary (UI-SPEC §6d).
 *
 *  ── ⚠ REPAIRED 2026-08-25 (Phase 206.2 / D-206.2-20) — THE CORRECTION, BESIDE ITS ORIGINAL ──
 *  The docblock above and the *"deliberately total over the union"* note below both stand as
 *  written, because the reasoning they record is still the right reasoning. What was wrong was
 *  the SHAPE OF THE LADDER, not its intent: the last arm was POSITIONAL — a trailing `return`
 *  rather than a branch — so every row that was neither `send_email` nor `create_ticket` was
 *  described as sending to Slack. An MCP row's `capability` is null, so an MCP row landed
 *  there, and the footer on the one surface whose whole job is answering *where does this
 *  send?* read `🔒 slack.com/api` for a connection pointed at `https://mcp.deepwiki.com/mcp`.
 *  Driven at this plan's base, verbatim: `expected [ 'slack.com/api' ] to deeply equal
 *  [ 'mcp.deepwiki.com' ]`.
 *
 *  This is BYTE-FOR-BYTE the defect `connectionsCopy.destinationFactsOf` shipped one file over
 *  and Phase 206.1 repaired as its own verified SC#4 — the same ladder, the same trailing
 *  return, the same wrong host. It survived HERE only because nothing in production could
 *  produce an MCP row for this component: the picker's read was capability-scoped, so the arm
 *  was unreachable. **This plan is what makes it reachable, which is why this plan repairs it.**
 *  A row naming the WRONG host is worse than a row naming none — a governed send is approved
 *  on the strength of this line.
 *
 *  ── ⚠ TWO SPELLINGS OF ONE RULE, AND THIS PHASE DOES NOT MERGE THEM ──
 *  `destinationPartsOf` (workflows) and `connectionsCopy.destinationFactsOf` (settings) are two
 *  spellings of ONE rule, living in two component subtrees. Recording the drift is the honest
 *  first step; merging them is a refactor this phase was not scoped for, and doing it quietly
 *  inside a repair would put an unreviewed cross-subtree dependency into a governance surface.
 *  Both files carry this note, landed in the SAME COMMIT — a note in only one of them is the
 *  drift the same-commit rule exists to forbid.
 *  RE-OPEN TRIGGER: *the first phase whose `files_modified` names BOTH files, or a third
 *  surface needing the same footer.* */
export const destinationPartsOf = (connection: ConnectorConnection): string[] => {
  // Read defensively through `unknown`: `ConnectorConnectionConfig` is a three-member
  // union and this reader is deliberately total over it, so a fourth member added later
  // degrades to an empty footer rather than to a compile error in an unrelated file.
  const config = connection.config as unknown as Record<string, unknown>
  const text = (key: string): string => (typeof config[key] === "string" ? (config[key] as string) : "")
  // ⚠ THE MCP ARM GOES ABOVE THE CAPABILITY ARMS, and above rather than below because an MCP
  // row's shape is resolved by its URL — its `capability` is null, so an arm placed after the
  // capability checks would be reached by falling through them rather than by matching.
  if (connection.mcp_server_url) {
    const url = connection.mcp_server_url
    // HOST ONLY — the path is the server's business and the host is the fact being approved.
    // No `URL` parser: a malformed value must still render SOMETHING true rather than throw,
    // and the raw string is the truest thing available when it does not split. (Ported from
    // the repaired twin at `settings/connectionsCopy.ts`, not reinvented beside it.)
    const host = url.replace(/^https?:\/\//, "").split("/")[0]
    return [host || url].filter(Boolean)
  }
  if (connection.capability === "send_email") {
    const host = text("host")
    const port = typeof config.port === "number" ? String(config.port) : ""
    const from = text("from_address")
    return [host && port ? `${host}:${port}` : host, from ? `from ${from}` : ""].filter(Boolean)
  }
  if (connection.capability === "create_ticket") {
    return [text("base_url"), text("project_key")].filter(Boolean)
  }
  // ⚠ EXPLICIT, NOT POSITIONAL. The Slack arm names the capability it serves. Its body is
  // verbatim what the trailing return held; what changed is that it is now a branch.
  if (connection.capability === "post_message") {
    const channel = text("default_channel")
    return [SLACK_FIXED_DESTINATION, channel ? (channel.startsWith("#") ? channel : `#${channel}`) : ""].filter(
      Boolean,
    )
  }

  // ⚠ THE NEUTRAL TAIL — this is the repair, and the arm above it is what it was repaired
  // FROM. A fifth shape gets an EMPTY destination list, which renders as no facts at all,
  // rather than silently inheriting the host of whichever arm happened to be written last.
  // Proved by a synthetic-fifth-shape negative control in the suite, which asserts BOTH that
  // the list is empty AND that it does not name Slack — "not Slack" alone would pass against
  // a footer naming some other wrong host.
  return []
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
  | {
      kind: "ready"
      key: string
      connections: ConnectorConnection[]
      /** MCP shape only — how many rows of THIS shape the read returned, counted BEFORE the
       *  `is_enabled` filter ran. It is what tells *"none exist"* apart from *"every one is
       *  switched off"*, and it reaches no DOM node: the empty render derives one attribute
       *  and one sentence from it. Absent on the capability shape, whose `.then` body is
       *  byte-identical to its shipped form (D-206.2-08). */
      shapedCount?: number
    }
  | { kind: "error"; key: string }

export interface ConnectionPickerProps {
  /** The step's chosen capability, already narrowed to a recognised one by the section.
   *
   *  ⚠ OPTIONAL SINCE 206.2-02, AND THE TWO QUESTIONS ARE ORDERED: the section answers the
   *  SHAPE first, and only the capability shape has a second question of this kind. An MCP
   *  step's row carries no capability at all — its destination is its own URL — so requiring
   *  one here would mean inventing a value the schema has no column for. */
  capability?: string
  /** How this step reaches outside. Defaults to `"capability"`, and the default is the whole
   *  reason no shipped call site and no shipped test moved when this prop landed: every
   *  render that says nothing about the shape renders exactly what it rendered before. */
  shape?: ExternalActionShape
}

export function ConnectionPicker({ capability, shape = "capability" }: ConnectionPickerProps) {
  const store = useBuilderStoreOptional()
  const slug = useSelectedPhaseSlug()
  const selectId = useId()
  const refusalId = useId()

  /** What this render is asking for. A capability change (or a different step) makes the
   *  settled answer stale, which is a derivation rather than an effect.
   *
   *  ⚠ THE SHAPE IS A TERM OF IT (206.2-02). A shape switch changes which rows are being
   *  asked for, so the settled answer for the other shape is not an answer at all — the field
   *  reads `loading` again by derivation, with no synchronous `setState` in the effect body
   *  and so no cascading render. The key reaches no DOM node, which is asserted rather than
   *  stated: the capability shape's whole `outerHTML` is pinned byte-for-byte in the suite. */
  const requestKey = `${shape}::${slug ?? ""}::${capability ?? ""}`
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

  /**
   * ── 206.2-04 · ADOPT THE RESPONSE ROW ────────────────────────────────────────────────
   *
   * `updateConnectorGrants` returns the full updated `ConnectorConnection`, so the grant
   * switch hands it back up here and it REPLACES the matching entry in the settled read.
   * `bound` then re-derives, the badge and the switch both move, and the NEXT toggle merges
   * from a fresh map.
   *
   * ⚠ THIS CALLBACK IS NOT AN OPTIMISATION — IT IS WHAT MAKES THE ROUTE CORRECT. `PATCH
   * /grants` is a whole-column REPLACE; if the returned row is not written back, this list
   * and the server go out of sync and the next toggle merges from a stale map, which is a
   * silent lost update on the column that decides whether egress is permitted.
   *
   * ⚠ THE REJECTED ALTERNATIVE IS A RE-FETCH NONCE, and it is rejected for a measured
   * reason: it re-issues the WHOLE connection list on every toggle inside a 400px panel
   * field, and the response IS the row. Re-open trigger: *a second writer of `tool_grants`
   * appearing anywhere in the builder, or the first observed clobber.*
   *
   * The key check is deliberate: a response for a read that has since been superseded (a
   * shape switch, another step) must not resurrect a stale settled answer.
   */
  const adoptConnection = useCallback((row: ConnectorConnection) => {
    setSettled((prev) =>
      prev.kind !== "ready"
        ? prev
        : {
            ...prev,
            connections: prev.connections.map((existing) =>
              existing.id === row.id ? row : existing,
            ),
          },
    )
  }, [])

  // THE READ. Gated on the same two nulls the write is, so a provider-less render opens no
  // request at all — see the docblock: this is what keeps two shipped suites unaffected.
  // The guard is ahead of BOTH arms, so that property holds in either shape.
  useEffect(() => {
    if (store === null || slug === null) return
    let cancelled = false

    // ── THE MCP ARM (206.2-02, D-206.2-03) ──────────────────────────────────────────────
    // ⚠ NO ARGUMENT. `api.ts` builds an empty query string for a falsy argument, so this is a
    // CALL-SITE change and `api.ts` is not edited (Phase 207 owns that file). The one line
    // above this arm is what SEED-200 is about: the shipped read passes a capability, an MCP
    // row's capability is null, so an MCP connection was filtered out of every read this
    // picker ever performed and the `McpToolPicker` mount below was dead code.
    if (shape === "mcp") {
      listConnectorConnections()
        .then((rows) => {
          if (cancelled) return
          // ⚠ THE ORDER OF THE TWO FILTERS IS LOAD-BEARING. An unfiltered read returns
          // capability rows as well, so the shape filter runs FIRST and the count is taken
          // from its result: "every one is switched off" is a fact about MCP-shaped rows
          // specifically, and counting before the shape filter would report it whenever the
          // only disabled row in the org was a Slack connection.
          const shaped = rows.filter((row) => Boolean(row.mcp_server_url))
          setSettled({
            kind: "ready",
            key: requestKey,
            // The SAME `is_enabled` rule, not a laxer one — a DISABLED connection is not a
            // choice, and this shape inherits that rather than renegotiating it.
            connections: shaped.filter((row) => row.is_enabled),
            shapedCount: shaped.length,
          })
        })
        .catch(() => {
          if (!cancelled) setSettled({ kind: "error", key: requestKey })
        })
      return () => {
        cancelled = true
      }
    }

    // ── THE CAPABILITY ARM — UNTOUCHED. Two arms, one of them byte-identical to its shipped
    // form (D-206.2-08); the two filter chains are deliberately NOT unified into one shared
    // expression, because that would rewrite the very line the byte-identity pin protects.
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
  }, [store, slug, shape, capability, requestKey])

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

  // STATE 2 — none exist for this shape, and on the MCP shape that splits into TWO facts.
  //
  // ⚠ THE ATTRIBUTE IS ADDED TO THE MCP SHAPE ONLY, AND THE ASYMMETRY IS DELIBERATE (AR-04).
  // The honesty argument — *none exist* and *every one is switched off* are two facts and an
  // author told the first while the second is true goes and creates a duplicate — is
  // shape-independent, and it would otherwise be owed on both. D-206.2-08 is LOCKED: a
  // capability step's picker behaviour is asserted byte-identical, and `data-empty-reason` on
  // this node would change the very bytes that criterion pins. Recording the asymmetry as a
  // decision is better than a fold nobody noticed.
  // RE-OPEN TRIGGER: the first phase permitted to re-baseline the capability shape's empty
  // render — at which point the same arm is owed there.
  //
  // The element, its `data-testid` and its `data-state` do not move. The fifth arm is a
  // SECOND SENTENCE INSIDE THE SAME NODE plus one attribute.
  if (connections.length === 0) {
    const mcpEmpty =
      shape !== "mcp"
        ? undefined
        : (read.shapedCount ?? 0) > 0
          ? { reason: "all-disabled", note: CONNECTION_PICKER_MCP_ALL_DISABLED }
          : { reason: "none", note: CONNECTION_PICKER_NO_MCP_NOTE }
    return (
      <div data-testid="connection-picker" data-state="empty" className={FIELD_CLASSES}>
        {label}
        <p
          data-testid="connection-picker-empty"
          className={NOTE_CLASSES}
          {...(mcpEmpty === undefined ? {} : { "data-empty-reason": mcpEmpty.reason })}
        >
          {mcpEmpty === undefined ? noConnectionYetNote(capability ?? "") : mcpEmpty.note}
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
          onConnectionUpdated={adoptConnection}
        />
      )}
    </div>
  )
}

export default ConnectionPicker

