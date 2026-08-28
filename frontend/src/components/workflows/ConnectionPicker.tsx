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
import { nodeTitle } from "@/components/workflows/phaseVocabulary"
import type { UpstreamPhase } from "@/components/workflows/argumentModel"
// ⚠ `discoverConnectorTools` IS ALREADY REQUIRED TRANSITIVELY by every suite that mounts this
// component — `McpToolPicker` imports it from the same module — so naming it here adds no new
// obligation to any `@/lib/api` mock factory. (Phase 196 measured what happens when that is
// not true: nine suites threw AT MOUNT and the gate read `failed 249`.)
import { discoverConnectorTools, listConnectorConnections } from "@/lib/api"
import type { ConnectorConnection } from "@/lib/api"
import { ArgumentEditor } from "./ArgumentEditor"
import { McpToolPicker } from "./McpToolPicker"
import { own } from "./ownProperty"

// ── THE COPY ─────────────────────────────────────────────────────────────────────────
// Exported identifiers, asserted by character-identity in `ConnectionPicker.test.tsx`.
// The three UI-SPEC §6d strings are verbatim; the label and the disconnected reading are
// authored here and recorded in the summary as this plan's own two sentences.

/** The field's own name. Plain-first (LANG-01): the author is answering *where does this
 *  send?*, which is the second of the section's two ordered questions. */
export const CONNECTION_PICKER_LABEL = "Where this sends"

/** State 1. One dim line, no spinner — this is a narrow panel field, not a run surface. */
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

/** State 2's SECOND arm — rows exist, but every one of them is switched off.
 *
 *  ── ⚠ 211-04 — RENAMED FROM `CONNECTION_PICKER_MCP_ALL_DISABLED`, AND THE RENAME IS THE
 *  POINT. The read is no longer capability-scoped and no longer shape-filtered, so there is
 *  ONE list and therefore ONE vocabulary for its absences. A sentence that still said *"every
 *  MCP server connection"* would name a subset the picker no longer distinguishes, and an
 *  author with a switched-off Slack row would be told nothing at all.
 *
 *  ⚠ AND ITS SIBLING `CONNECTION_PICKER_NO_MCP_NOTE` IS RETIRED RATHER THAN REWORDED. The
 *  "none exist" arm now reads `noConnectionYetNote("")`, whose FALLBACK branch — *"No external
 *  connection yet"* — is exactly the shape-neutral sentence this state needs, and reusing it
 *  keeps the WR-04 `own()` closure on a LIVE path rather than a dead one.
 *
 *  ⚠ A DIFFERENT FACT FROM "none exist", AND FOLDING THE TWO IS THE DEFECT THIS TREE HAS NOW
 *  RECORDED FIVE TIMES (`runFacts.ts` CR-01, `DecisionsList` D-20, `transcriptVocabulary.ts`,
 *  206.1's AR-05). An author told *"none yet"* while one sits switched off goes and creates a
 *  duplicate — the list was read, the rows were seen, and they were rejected for a reason the
 *  author is able to undo in one click. That is worth its own sentence. */
export const CONNECTION_PICKER_ALL_DISABLED =
  "Every connection is switched off. Turn one on in Settings → Connections."

const EMPTY_RECORD: Record<string, unknown> = Object.freeze({})

/**
 * ⭐ 214-07 (D-214-03) — THE CLIENT MIRROR OF `_BODY_ARG_FOR_CAPABILITY`
 * (`backend/app/services/harness/phase_types.py`), which is where the executor decides which
 * field an upstream step's text fills when nothing else names it.
 *
 * ⚠ IT LIVES HERE, NOT IN THE EDITOR. `ArgumentEditor` is shape-agnostic by design — one
 * renderer over one `inputSchema`, no capability branch anywhere (D-214-05) — and it is the
 * CALLER that is allowed to know a connection's shape, exactly as `boundIsRemote` already is.
 *
 * ⚠ A MIRROR NEEDS A FENCE, NOT A PROMISE. `ConnectionPicker.test.tsx` reads the backend's own
 * source and asserts these three pairs are character-identical to the map there — the same
 * cross-language guard `ExternalActionSection.test.tsx` keeps over `harness.py`'s capability
 * `Literal`. A fourth capability appearing on one side alone is then a RED TEST rather than a
 * silently unfilled body field, which is what `BUG-260826-01` looked like from the outside.
 *
 * ⛔ AN MCP-SHAPED STEP GETS `null`. The backend derives `body_arg` from the CAPABILITY and
 * from nothing else, so inventing one for a remote tool would pre-set a field the executor is
 * never going to fill — a visible promise with no mechanism behind it.
 */
const BODY_ARG_FOR_CAPABILITY: Record<string, string> = {
  send_email: "body",
  create_ticket: "description",
  post_message: "text",
}

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

/** `{service} · {name}` — plus the state word, which rides the option itself so the list
 *  reads honestly before it is opened.
 *
 *  ── ⚠ 211-04 (SC#3 / CONN-05) — THE SERVICE JOINED THE LABEL, AND IT HAD TO. Until this
 *  plan the list was capability-scoped, so every row in it was the same KIND of thing and the
 *  connection's own name was enough. One unscoped read puts `#ops-alerts`, `Ops mailbox` and
 *  `DeepWiki` in ONE list, where the name alone answers *which one is this?* and not *what is
 *  it?* — and *what is it?* is precisely the question this phase says a connection answers.
 *
 *  ⚠ `service_id` IS RENDERED VERBATIM, AND THAT IS A DECISION RATHER THAN AN OMISSION. It is
 *  free text by construction (migration 127 guarantees only that it is non-blank), and D-211-02
 *  puts the curated presentation lookup in Phase 212. Inventing a label map here would be that
 *  phase's work done without its review, and a MISS in such a map is how a row goes generic or
 *  invisible. A verbatim reading is never wrong; it is only ever plainer than it will be.
 *
 *  ⚠ IT IS A LABEL, NEVER A VALUE, A `data-` ATTRIBUTE OR A TEST ID. The shipped rule that no
 *  raw wire id reaches the DOM in those three positions is unchanged, and still asserted. */
export const optionLabelOf = (connection: ConnectorConnection): string => {
  const head = `${connection.service_id} · ${connection.name}`
  if (isFailing(connection)) return `${head}  ${CONNECTION_STATE_FAILED}`
  if (connection.last_check_verdict === "ok") return head
  return `${head}  ${CONNECTION_STATE_NOT_CHECKED}`
}

/** Every settled read carries the KEY it answered. A result for a previous step is therefore
 *  not a result at all — the field reads `loading` again by derivation, with no synchronous
 *  `setState` in the effect body and so no cascading render. */
type ReadState =
  | { kind: "loading"; key: string }
  | {
      kind: "ready"
      key: string
      connections: ConnectorConnection[]
      /** How many rows the read returned, counted BEFORE the `is_enabled` filter ran.
       *
       *  ⚠ 211-04 — THIS USED TO BE COUNTED AFTER A SHAPE FILTER, AND THE SHIPPED COMMENT
       *  EXPLAINING THAT ORDER IS GONE WITH THE FILTER RATHER THAN LEFT DESCRIBING IT. There
       *  is now exactly ONE filter on this path, so the count means what its name says: how
       *  many connections this org has at all. It is what tells *"none exist"* apart from
       *  *"every one is switched off"*, and it reaches no DOM node — the empty render derives
       *  one attribute and one sentence from it. */
      totalCount: number
    }
  | { kind: "error"; key: string }

export function ConnectionPicker() {
  const store = useBuilderStoreOptional()
  const slug = useSelectedPhaseSlug()
  const selectId = useId()
  const refusalId = useId()

  /** What this render is asking for. A different step makes the settled answer stale, which
   *  is a derivation rather than an effect.
   *
   *  ⚠ 211-04 — THE SHAPE AND THE CAPABILITY ARE NO LONGER TERMS OF IT, because neither is a
   *  term of the READ any more. One unscoped call answers every step, so the only thing that
   *  can make a settled answer stale is the step itself. The key still reaches no DOM node. */
  const requestKey = `${slug ?? ""}`
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

  /** The bound ROW, derived here rather than at the render site, because 211-04 gives the
   *  action write below a reason to know the connection's shape. `read` already carries the
   *  key check, so a settled answer for a previous step contributes nothing. */
  const bound: ConnectorConnection | undefined =
    read.kind === "ready" && boundId !== null
      ? read.connections.find((row) => row.id === boundId)
      : undefined

  /** ⚠ THE ONE PLACE THE CONNECTION'S SHAPE DECIDES ANYTHING IN THIS FEATURE, and it decides
   *  a WRITE rather than a render. `McpToolPicker` is forbidden from reading this field at all
   *  (D-211-12, fenced in its own suite); the caller is allowed to know it, and this is the
   *  caller. Two shapes, exactly the two the executor branches on — no third is invented. */
  const boundIsRemote = Boolean(bound?.mcp_server_url)

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

  /** 214-07 — `arg_sources`, read exactly as `tool_args` is. ⚠ THE STRING SNAPSHOT IS THE
   *  POINT: `useSyncExternalStore` compares snapshots by identity, and a fresh object every
   *  render is an infinite loop. Its twin above is the shipped precedent, not a new idea. */
  const argSourcesSnapshot = useCallback((): string => {
    if (store === null || slug === null) return "{}"
    const phase = store.getState().phases.find((p) => p.slug === slug)
    const val = (phase?.config as Record<string, unknown> | undefined)?.arg_sources
    return typeof val === "object" && val !== null ? JSON.stringify(val) : "{}"
  }, [store, slug])
  const argSourcesJson = useSyncExternalStore(subscribe, argSourcesSnapshot, argSourcesSnapshot)
  const argSources = useMemo(() => {
    try {
      return JSON.parse(argSourcesJson) as Record<string, unknown>
    } catch {
      return EMPTY_RECORD
    }
  }, [argSourcesJson])

  /** The step's stored `capability` — the FIRST-PARTY shape's answer to *which action?*, and
   *  the other half of what `handleSelectTool` writes. Needed here because the argument form
   *  is derived from the BOUND ACTION's schema and a capability row's action is its
   *  capability (migration 127 §2b's descriptor advertises exactly that). */
  const capabilitySnapshot = useCallback((): string => {
    if (store === null || slug === null) return ""
    const phase = store.getState().phases.find((p) => p.slug === slug)
    const val = (phase?.config as Record<string, unknown> | undefined)?.capability
    return typeof val === "string" ? val : ""
  }, [store, slug])
  const capability = useSyncExternalStore(subscribe, capabilitySnapshot, capabilitySnapshot)

  /** Every step that runs BEFORE this one, named by `nodeTitle` — the author's own name for
   *  it, never its slug (that function's own first floor). ⚠ The store's `phases` array IS
   *  the run order; `movePhase` / `insertPhaseAt` maintain it, so a positional slice is the
   *  reachability answer rather than an approximation of one. */
  const upstreamSnapshot = useCallback((): string => {
    if (store === null || slug === null) return "[]"
    const phases = store.getState().phases
    const index = phases.findIndex((p) => p.slug === slug)
    if (index <= 0) return "[]"
    return JSON.stringify(
      phases.slice(0, index).map((phase) => ({ slug: phase.slug, title: nodeTitle(phase) })),
    )
  }, [store, slug])
  const upstreamJson = useSyncExternalStore(subscribe, upstreamSnapshot, upstreamSnapshot)
  const upstreamPhases = useMemo(() => {
    try {
      return JSON.parse(upstreamJson) as UpstreamPhase[]
    } catch {
      return [] as UpstreamPhase[]
    }
  }, [upstreamJson])

  /**
   * THE BOUND ACTION, AND ITS DECLARED SHAPE — the client counterpart of
   * `args.schema_for_bound_tool`, and deliberately the SAME two arms in the same order.
   *
   * ⚠ ONE LIST SERVES BOTH SHAPES, which is the whole reason there is no branch below it: a
   * first-party connection's action IS its capability, and migration 127 §2b writes a
   * descriptor into `discovered_tools` under exactly that name. So `tool_name || capability`
   * resolves against ONE list, and the schema it yields is the same JSON the backend emits
   * (`descriptors._plain_json` writes it in the MCP sanitizer's own key order, precisely so).
   *
   * ⚠ `null` IS NOT `{}`. An action with no schema on the row means *we do not know*, and the
   * editor says so and offers a refresh; an empty object would mean *this action takes
   * nothing*, which is a different fact and would render an empty form as if it were finished.
   */
  const boundAction = toolName !== "" ? toolName : capability
  const boundSchema =
    boundAction === ""
      ? null
      : ((bound?.discovered_tools ?? []).find((tool) => tool.name === boundAction)?.inputSchema ??
        null)

  /**
   * ── 211-04 (CONN-05 / D-211-11) · THE ACTION WRITE — EXACTLY ONE KEY, NEVER BOTH ───────
   *
   * The author answers ONE question here — *which action?* — and the answer lands in the
   * field the EXECUTOR reads for the connection's own shape. A remote-server row's action is
   * a `tool_name`; a first-party row's action IS its capability, which is precisely what
   * migration 127 §2b's descriptor advertises (`post_message` → the tool named
   * `post_message`).
   *
   * ⚠ THE OTHER FIELD IS CLEARED IN THE SAME PATCH, and that is not tidiness. Migration 127's
   * `connector_connections_shape_is_not_ambiguous` refuses an ambiguous CONNECTION, and this
   * is the step-level counterpart: a config carrying both would be read by whichever branch
   * the executor reaches first, silently, with nothing in the UI saying so. ⛔ AND THERE IS NO
   * DEFAULT — a step with no connection chosen never reaches this callback at all, because
   * the card that calls it is not rendered.
   *
   * ⚠ `tool_args` CLEARS WITH `tool_name`, NEVER WITHOUT IT — arguments for a tool that no
   * longer exists are the half-clear `ExternalActionSection`'s AR-05 reasoning refused.
   *
   * ⚠ 214-07 — `arg_sources` JOINS IT, IN BOTH CLEARS, AND THE HAZARD IS IDENTICAL. A source
   * map naming an argument of a tool that no longer exists is the same stale fact one field
   * over: it would survive onto the next action, be read by `resolve_arguments` against a
   * schema that never declared those properties, and show the author a form that has already
   * decided things nobody chose. The two keys are written together and cleared together, or
   * they are a half-clear with two names.
   */
  const handleSelectTool = useCallback(
    (tool: string) => {
      if (store === null || slug === null) return
      store.getState().patchConfig(
        slug,
        boundIsRemote
          ? { tool_name: tool, capability: undefined }
          : { capability: tool, tool_name: undefined, tool_args: undefined, arg_sources: undefined },
      )
      store.getState().flushHistory()
    },
    [store, slug, boundIsRemote],
  )

  const handleChangeArgs = useCallback(
    (args: Record<string, unknown>) => {
      if (store === null || slug === null) return
      store.getState().patchConfig(slug, { tool_args: args })
      store.getState().flushHistory()
    },
    [store, slug],
  )

  /** 214-07 — the source write, the SAME `patchConfig` + `flushHistory` shape as its twin
   *  above. One home for *what a step sends*, one for *where each part of it comes from*. */
  const handleChangeSources = useCallback(
    (sources: Record<string, unknown>) => {
      if (store === null || slug === null) return
      store.getState().patchConfig(slug, { arg_sources: sources })
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
   * reason: it re-issues the WHOLE connection list on every toggle inside a narrow panel
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

  /**
   * 214-07 (D-214-07) — THE EXISTING RE-DISCOVERY ROUTE, REACHED FROM THE ARGUMENT FORM.
   *
   * ⭐ NO NEW ROUTE IS ADDED. `discoverConnectorTools` is the client half of
   * `connector_service.discover_connection_tools` (`connector_service.py:864` — RE-VERIFIED at
   * execute time, because PATTERNS flagged the previously-cited line as unchecked and a line
   * number quoted without checking is how the next reader is misled).
   *
   * ⚠ THE RESPONSE IS ADOPTED THROUGH `adoptConnection`, not held locally. The argument form
   * derives its fields from the BOUND ROW's `discovered_tools`, so a refresh that wrote only a
   * local list would leave the form still saying it does not know the shape while the picker
   * above it listed the action — two surfaces disagreeing about one fact.
   */
  const handleRediscover = useCallback(async () => {
    if (bound === undefined) return
    try {
      const tools = await discoverConnectorTools(bound.id)
      adoptConnection({ ...bound, discovered_tools: tools })
    } catch {
      // The editor is already saying we do not know what this action needs, and after a
      // failed refresh that is still exactly true. There is no second sentence to add here
      // that would be honest and is not already on screen.
    }
  }, [bound, adoptConnection])

  // THE READ. Gated on the same two nulls the write is, so a provider-less render opens no
  // request at all — see the docblock: this is what keeps two shipped suites unaffected.
  // The guard is ahead of BOTH arms, so that property holds in either shape.
  useEffect(() => {
    if (store === null || slug === null) return
    let cancelled = false

    // ── 211-04 (SC#3 / SEED-207) · ONE UNSCOPED READ, AND IT REPLACES TWO ARMS ───────────
    //
    // ⚠ NO ARGUMENT. `api.ts` builds an empty query string for a falsy argument, so this is a
    // CALL-SITE change and `api.ts` is not edited. The `?capability=` query parameter is KEPT
    // on the server and in the client signature deliberately (211-02's recorded decision) —
    // what ends here is this picker's USE of it, because a verb is an attribute of a
    // connection and not an axis the author browses along.
    //
    // ⚠ AND THE CLIENT-SIDE SHAPE FILTER IS GONE, NOT MOVED. `rows.filter(row =>
    // Boolean(row.mcp_server_url))` split the org's connections into two lists an author had
    // to choose between BEFORE choosing a connection. There is one list now: every enabled
    // connection in the org, of every shape.
    //
    // ⚠ ONE FILTER SURVIVES AND ITS ORDER RELATIVE TO THE COUNT IS STILL LOAD-BEARING — but
    // the shipped comment explaining a two-filter order is REWRITTEN rather than left
    // describing a filter that no longer exists. `totalCount` is taken from the RAW response,
    // so *"every one is switched off"* means exactly that: rows came back and none of them is
    // a choice.
    listConnectorConnections()
      .then((rows) => {
        if (cancelled) return
        setSettled({
          kind: "ready",
          key: requestKey,
          // A DISABLED connection is not listed at all — it is not a choice (UI-SPEC §6d).
          connections: rows.filter((row) => row.is_enabled),
          totalCount: rows.length,
        })
      })
      .catch(() => {
        if (!cancelled) setSettled({ kind: "error", key: requestKey })
      })
    return () => {
      cancelled = true
    }
  }, [store, slug, requestKey])

  /**
   * THE BIND WRITE — one REFERENCE, and D-13's whole obligation is that no destination fact
   * and no credential ever joins it.
   *
   * ── ⚠ 211-04 · THE PATCH GREW THREE CLEARS, AND THE THREAT IT ANSWERS IS NOT D-13's ──
   * D-13 forbids a HOST, a port, an account or a token crossing into `definition`. Nothing
   * here does: the three added keys are the step's OWN action fields, and the suite's sweep
   * over every emitted patch still refuses anything matching `secret|token|password|host|
   * base_url` and still refuses a value that looks like a host.
   *
   * ⚠ WHY THEY ARE OWED HERE NOW. 206.2 put this clear on the SHAPE control — pressing *a
   * tool on an MCP server* cleared `capability`, and pressing back cleared `tool_name` and
   * `tool_args`. This plan deletes that control, so re-binding is the only remaining moment
   * at which a step's shape can change, and the obligation moves with it rather than
   * evaporating. Left behind, a `tool_name` from a remote row survives onto a step now bound
   * to a first-party connection — the AR-05 hazard, one control over.
   *
   * ⚠ AND IT APPLIES TO THE UNBIND TOO. An action chosen on a connection that is no longer
   * bound is not a smaller fact than a stale destination; it is the same fact.
   */
  const bind = (id: string | null) => {
    if (store === null || slug === null) return
    store.getState().patchConfig(slug, {
      connection_id: id,
      capability: undefined,
      tool_name: undefined,
      tool_args: undefined,
      // ⚠ 214-07 — THE FIFTH KEY, and it is owed here for the reason the fourth is: re-binding
      // is a moment at which the step's whole action can change, and a source map for an
      // action that is no longer bound is the AR-05 hazard with a different noun.
      arg_sources: undefined,
    })
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

  // STATE 2 — nothing to choose from, and that splits into TWO facts, on EVERY shape.
  //
  // ── ⚠ 211-04 — AR-04's ASYMMETRY IS DISCHARGED, ON ITS OWN RECORDED TRIGGER. The shipped
  // comment here said the attribute was MCP-only *"because D-206.2-08 is LOCKED: a capability
  // step's picker behaviour is asserted byte-identical, and `data-empty-reason` on this node
  // would change the very bytes that criterion pins"*, and it named its re-open trigger as
  // *"the first phase permitted to re-baseline the capability shape's empty render"*. THIS IS
  // THAT PHASE — the read is no longer capability-scoped, so a capability-scoped empty
  // sentence would be a fact about a subset nobody asked for. Both reasons now reach both
  // shapes, because there is only one shape of list left.
  //
  // ⚠ THE TWO REASON VALUES STAY DISTINGUISHABLE. Collapsing them into one would retire a
  // diagnostic silently, which is this tree's five-times-recorded defect: an author told
  // *"none yet"* while one sits switched off goes and creates a duplicate.
  if (connections.length === 0) {
    const empty =
      read.totalCount > 0
        ? { reason: "all-disabled", note: CONNECTION_PICKER_ALL_DISABLED }
        : { reason: "none", note: noConnectionYetNote("") }
    return (
      <div data-testid="connection-picker" data-state="empty" className={FIELD_CLASSES}>
        {label}
        <p
          data-testid="connection-picker-empty"
          className={NOTE_CLASSES}
          data-empty-reason={empty.reason}
        >
          {empty.note}
        </p>
      </div>
    )
  }

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

      {/* ── ⭐ 211-04 (D-211-12) · THE MOUNT GATES ON A BOUND CONNECTION ─────────────────
          ⚠ WHAT WAS HERE: `bound?.mcp_server_url && …`. RESEARCH §A.6 named eight readers
          gating on that field; this was one of them, and it is the reason a first-party
          connection's own action list had no surface even after plan 211-01 wrote the
          descriptors and 211-02 backfilled the rows. One question, then one question: you
          have chosen a connection — here is what it can do.
          ⚠ `grantsEnforced` IS WHERE THE SHAPE STILL MATTERS, and it is a WRITE-side fact
          rather than a render-side one: `tool_grants` is read by the executor only inside its
          remote-server branch, so the permission surface would otherwise state a refusal that
          never happens on the first-party path. */}
      {bound !== undefined && (
        <McpToolPicker
          connection={bound}
          toolName={toolName}
          toolArgs={toolArgs}
          onSelectTool={handleSelectTool}
          onChangeArgs={handleChangeArgs}
          onConnectionUpdated={adoptConnection}
          grantsEnforced={boundIsRemote}
        />
      )}

      {/* ── ⭐ 214-07 (SC#1 / SC#2 / D-214-01) · WHAT THIS STEP SENDS ───────────────────
          The third question, and it only exists once the first two are answered: you have
          chosen a connection, you have chosen one of its actions — here is what that action
          needs, and where each part of it comes from.

          ⚠ THIS COMPONENT IS THE MOUNT POINT because it is *"the only child on this surface
          holding a store reference"*. `ArgumentEditor` is a leaf: it reads no context, holds
          no store and opens no request, and every one of the five facts below is resolved
          HERE and handed down. That is the same division `McpToolPicker` above already has.

          ⚠ THE GATE IS *AN ACTION IS CHOSEN*, NOT *A SHAPE*. A step with a connection but no
          action yet has nothing whose arguments could be described, and D-214-07's
          unknown-shape state is for an action whose shape we lack — NOT for the absence of
          one. Rendering it earlier would answer a question nobody has asked. */}
      {bound !== undefined && boundAction !== "" && (
        <ArgumentEditor
          schema={boundSchema}
          toolArgs={toolArgs}
          argSources={argSources}
          upstreamPhases={upstreamPhases}
          // WR-04 — read through `own()`, never a bare bracket read over a plain literal. An
          // inherited member is never nullish, so a `??` fallback would not fire for
          // `constructor` / `toString` and the `Object` FUNCTION would reach the pre-set.
          bodyArgKey={own(BODY_ARG_FOR_CAPABILITY, capability) ?? null}
          onChangeArgs={handleChangeArgs}
          onChangeSources={handleChangeSources}
          onRediscover={handleRediscover}
        />
      )}
    </div>
  )
}

export default ConnectionPicker

