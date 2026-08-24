/**
 * Phase 190-16 (CONN-02, UI-SPEC §2c–§2h, §11d, §12) — the Connections tab's copy and
 * its pure derivations.
 *
 * ── WHY THIS FILE EXISTS, AND WHY IT IS A `.ts` AND NOT PART OF THE `.tsx` ──
 * UI-SPEC §11d makes every user-visible string on this surface a CONTRACT, and the way
 * this project keeps a contract honest is to make each string an exported identifier that
 * a suite asserts by CHARACTER IDENTITY (the `GovernanceSection.tsx:10-17` idiom): a
 * sentence that lives inline inside JSX is a sentence nobody can test for drift.
 *
 * But a `.tsx` that exports both components AND constants trips
 * `react-refresh/only-export-components`, and plan 190-12 MEASURED the cost of ignoring
 * that: `eslint src/components/workflows/` went 5 → 10 on exactly this rule, and its
 * summary named the one-line fix — a sibling copy module. It is taken here rather than
 * repeated. Measured at HEAD before this file existed: `eslint src/components/settings/`
 * reports **5 errors, all pre-existing `react-refresh/only-export-components`** (in
 * `ProviderPicker.tsx` and `ModelPillRow.tsx`). This split keeps that number at 5 instead
 * of taking it to 5 + one per exported string.
 *
 * So: EVERY user-visible string and every pure derivation lives here; `ConnectionsTab.tsx`
 * exports components and nothing else.
 *
 * ── THE FOUR STATE WORDS ARE GLYPH **AND** WORD (WCAG 1.4.1 / UI-SPEC §12) ──
 * `✓ Ready` · `◌ Not checked` · `✕ Credential failed` · `⏻ Disabled`. Colour is
 * reinforcement, never the carrier — remove every colour from this surface and all four
 * still read. The shipped `UsersAndAccess.tsx:280-290` analog carries the WORD but not the
 * GLYPH; the glyph is added here and the analog's `text-[11px] font-medium` is kept.
 *
 * ── NOTHING HERE MAY EVER CARRY A CREDENTIAL ──
 * The stored secret is write-only at the API boundary and is never returned to any browser
 * (UI-SPEC §3d, T-190-09-T7). No string in this module interpolates a credential, a
 * ciphertext or a token, and no derivation below reads one — `ConnectorConnection` declares
 * no such field in either form, deliberately (`lib/api.ts:5535-5547`).
 */
import type { ConnectorConnection, EffectiveFeatures, PublishedWorkflow } from "@/lib/api"

// ═══════════════════════════════════════════════════════════════════════════════════════
// 0 · READING `live_connectors` OUT OF THE EFFECTIVE-FEATURES MAP
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The governed key, spelled ONCE. It is also the exact string the OFF banner renders in
 *  its `<code>` (§2h) — one literal, so the thing a person is told to search for and the
 *  thing this app actually reads can never drift apart. */
export const LIVE_CONNECTORS_FEATURE_KEY = "live_connectors"

/**
 * Is live sending on for this platform?
 *
 * ⚠ THE CAST IS DELIBERATE AND HAS AN OWNER — `D-190-DEF-09`. `GET /features` really does
 * return this key (plan 190-09 put it in the backend's `_GOVERNED_FEATURES`, and
 * `api/features.py:81` iterates that dict), but the client's `GovernedFeature` union does
 * NOT yet name it: widening it fails five `Record<GovernedFeature, …>` exhaustive maps,
 * two of them inside `/admin`, which phase 190's D-25 fences. The union and the operator's
 * `FeatureVisibility` card land together in a later commit; this reader exists so 190-16
 * does not half-widen a type it cannot honestly finish.
 *
 * **FAILS CLOSED, and on this surface that is the honest direction:** an absent key, a
 * non-boolean value, or a failed read all resolve to OFF. Claiming sending is off when we
 * cannot tell is the non-over-claiming error; the opposite would render a table with no
 * banner over a platform that sends nothing.
 */
export function liveConnectorsOnFrom(features: EffectiveFeatures): boolean {
  const map = features as unknown as Record<string, unknown>
  return map[LIVE_CONNECTORS_FEATURE_KEY] === true
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · THE COLUMNS — the contract (sketch 155-C, locked; UI-SPEC §2c)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The five column words, in order. Sketch 155-C locked BOTH the set and the order, so
 *  this is a tuple the header renders by mapping — never five hand-typed headings that
 *  could drift from each other or from the suite that asserts them. */
export const CONNECTIONS_COLUMNS = [
  "Connection",
  "Sends to",
  "Used by",
  "Credential",
  "State",
] as const

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · THE FOUR STATE WORDS (155-C, locked — must read in greyscale)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CONNECTION_STATE_READY = "✓ Ready"
export const CONNECTION_STATE_NOT_CHECKED = "◌ Not checked"
export const CONNECTION_STATE_CREDENTIAL_FAILED = "✕ Credential failed"
export const CONNECTION_STATE_DISABLED = "⏻ Disabled"

/** The four states this surface can render, as a closed union. */
export type ConnectionStateKind = "ready" | "not_checked" | "failed" | "disabled"

/** Every state word, keyed by kind — so the suite can walk all four rather than name
 *  four literals it might later disagree with. */
export const CONNECTION_STATE_WORDS: Record<ConnectionStateKind, string> = {
  ready: CONNECTION_STATE_READY,
  not_checked: CONNECTION_STATE_NOT_CHECKED,
  failed: CONNECTION_STATE_CREDENTIAL_FAILED,
  disabled: CONNECTION_STATE_DISABLED,
}

/**
 * The row's state, derived during render and never stored.
 *
 * ⚠ `is_enabled === false` WINS over any verdict, and that ordering is the honest one: a
 * disabled connection sends nothing whatever its credential last did, so reading it as
 * `✓ Ready` would be the over-claim this phase exists to avoid. An ABSENT verdict is
 * `not_checked`, not `failed` — an unchecked connection is not a failing one (the same
 * narrowness `ConnectionPicker.isFailing` keeps).
 */
export function connectionStateOf(connection: ConnectorConnection): ConnectionStateKind {
  if (!connection.is_enabled) return "disabled"
  if (connection.last_check_verdict === "failed") return "failed"
  if (connection.last_check_verdict === "ok") return "ready"
  return "not_checked"
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE FILTER BAR + THE LIVE COUNT (UI-SPEC §2d — load-bearing, not decoration)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CONNECTIONS_FILTER_PLACEHOLDER = "Filter connections…"
export const CONNECTIONS_FILTER_LABEL = "Filter connections by name or destination"

/** The chip rail. `null` is the All chip — every other member is a capability, so the rail
 *  can never drift from the closed capability set the backend and mig 116 both hold. */
export const CONNECTIONS_FILTER_CHIPS: ReadonlyArray<{ capability: string | null; label: string }> = [
  { capability: null, label: "All" },
  { capability: "send_email", label: "Email" },
  { capability: "create_ticket", label: "Tickets" },
  { capability: "post_message", label: "Messages" },
]

/**
 * The live count. `{N} connections` unfiltered · `{N} of {total}` filtered — the two
 * readings are DIFFERENT facts and §2d requires both, because "3 connections" while a
 * filter is on would quietly claim the org has three.
 */
export function connectionsCountLabel(shown: number, total: number, filtered: boolean): string {
  if (filtered) return `${shown} of ${total}`
  return `${total} ${total === 1 ? "connection" : "connections"}`
}

/**
 * Does this row match the typed text? Matches name, destination and detail (§2d) — never
 * the row id, which is a wire value no author ever types, and never any config key whose
 * value could be sensitive: the reader below is an explicit allow-list of destination
 * facts, not a walk of the whole config object.
 */
export function connectionMatchesQuery(connection: ConnectorConnection, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [connection.name, ...destinationFactsOf(connection)].join(" ").toLowerCase()
  return haystack.includes(q)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · `Sends to` — ONE destination shape across three surfaces (UI-SPEC §2c, §6d)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Slack's API host is a module constant in `backend/app/security/egress.py` (D-02) — one
 *  of the three destinations unforgeable by construction, which is why a Slack connection
 *  stores a channel and no URL at all. The surface says so with the `fixed` tag below. */
export const SLACK_FIXED_HOST = "slack.com/api"

/** The tag a Slack row carries in its `Sends to` cell, because D-02 makes its host a code
 *  constant and a surface whose whole job is *where does this send?* should say which
 *  destination cannot be pointed anywhere else. */
export const CONNECTION_FIXED_TAG = "fixed"

/**
 * The destination facts, in order, for one connection.
 *
 * Read defensively through `unknown`: `ConnectorConnectionConfig` is a three-member union
 * and this reader is deliberately TOTAL over it, so a fourth capability added later
 * degrades to an empty cell rather than to a compile error in an unrelated file. This is
 * the same derivation `ConnectionPicker.destinationPartsOf` performs at the builder seam —
 * one mark, one shape, three surfaces (§6d).
 */
export function destinationFactsOf(connection: ConnectorConnection): string[] {
  const config = connection.config as unknown as Record<string, unknown>
  const text = (key: string): string =>
    typeof config[key] === "string" ? (config[key] as string) : ""
  if (connection.capability === "send_email") {
    const host = text("host")
    const port = typeof config.port === "number" ? String(config.port) : ""
    return [host && port ? `${host}:${port}` : host].filter(Boolean)
  }
  if (connection.capability === "create_ticket") {
    return [text("base_url"), text("project_key")].filter(Boolean)
  }
  // ⚠ AN MCP CONNECTION HAS NO CAPABILITY, AND ITS DESTINATION IS ITS OWN URL. Before this
  // arm existed the ladder below was POSITIONAL — a trailing `return` rather than a branch —
  // so every row that was not `send_email` or `create_ticket` was described as sending to
  // Slack. Seen on screen in live UAT (2026-08-25): a connection pointed at
  // `https://mcp.deepwiki.com/mcp` rendered its destination as `slack.com/api`.
  //
  // That is not a cosmetic slip on this surface. This column is the ONE place a person is
  // told where their organisation's data is about to go, and a governed send is approved on
  // the strength of it. A row naming the wrong host is worse than a row naming none.
  if (connection.mcp_server_url) {
    const url = connection.mcp_server_url
    // Host only — the path is the server's business and the host is the fact being approved.
    // No URL parser: a malformed value must still render SOMETHING true rather than throw,
    // and the raw string is the truest thing available when it cannot be split.
    const host = url.replace(/^https?:\/\//, "").split("/")[0]
    return [host || url].filter(Boolean)
  }

  // ⚠ EXPLICIT, NOT POSITIONAL. The Slack arm now names the capability it serves, so the next
  // capability added to the closed set gets an EMPTY destination list — which renders as
  // "none you can see" — instead of silently inheriting Slack's host.
  if (connection.capability === "post_message") {
    const channel = text("default_channel")
    return [SLACK_FIXED_HOST, channel ? (channel.startsWith("#") ? channel : `#${channel}`) : ""].filter(
      Boolean,
    )
  }

  return []
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · `Used by` — a MEASURED count with an honestly-worded floor
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * How many published workflow steps reference each connection.
 *
 * ⚠ THE SCOPE IS THE CALLER'S, AND THAT IS WHY THE ZERO CASE HAS ITS OWN WORD.
 * The only shipped read of published definitions is `GET /workflows/published`
 * (`api/workflows.py:175-220`), which is OWNER-scoped (`created_by = me` OR
 * `is_system_global`) — not org-wide. So this count is a FLOOR: it is every step the
 * caller can see, and a colleague's published workflow is invisible to it. Rendering a
 * bare `0 steps` off a partial read would claim *nothing depends on this*, which the read
 * cannot support — hence `usedByLabel`'s `none you can see` at zero, and the one-line
 * scope note at the foot of the table.
 *
 * ⚠ MEASURED BEFORE COMMITTING TO A LIVE COUNT (the plan's own instruction, research
 * OQ#6), against the local corpus on 2026-08-09: 204 `workflow_definitions` rows, of which
 * **125 published**, holding **48 kB** of `definition` JSONB in total (2.21 phases per
 * definition on average, 5 at most). The equivalent server-side JSONB scan
 * (`jsonb_array_elements(definition->'phases')`) measured **1.6 ms**. A live count is
 * therefore taken rather than the plan's named on-demand-expand fallback — and it costs
 * ZERO new wire, because the definitions ride the ONE existing `listPublishedWorkflows()`
 * response that already returns `definition` inline (`api.ts:1335-1340`).
 */
export function usageCountsFrom(workflows: PublishedWorkflow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const workflow of workflows) {
    const definition = workflow.definition as unknown as Record<string, unknown> | null | undefined
    const phases = definition?.phases
    if (!Array.isArray(phases)) continue
    for (const phase of phases) {
      const config = (phase as { config?: unknown })?.config
      if (config === null || typeof config !== "object") continue
      // Own-property guard (the WR-04 lesson): a definition is author-supplied JSONB, and
      // `config["constructor"]` on a plain object is the `Object` FUNCTION — never nullish,
      // so a bare read would count a prototype member as a binding.
      if (!Object.prototype.hasOwnProperty.call(config, "connection_id")) continue
      const id = (config as { connection_id?: unknown }).connection_id
      if (typeof id !== "string" || id === "") continue
      counts[id] = (counts[id] ?? 0) + 1
    }
  }
  return counts
}

/** `N steps` — and at zero, the honest reading of a caller-scoped count. */
export function usedByLabel(count: number): string {
  if (count <= 0) return "none you can see"
  return `${count} ${count === 1 ? "step" : "steps"}`
}

/** Said ONCE, at the foot of the table — never per row (§2h's 24-identical-lines finding,
 *  one scale down). It states the read's real scope so the column above it can be read
 *  correctly, rather than leaving the floor to be discovered during a delete. */
export const CONNECTIONS_USED_BY_SCOPE_NOTE =
  "“Used by” counts published workflow steps you can see. A colleague’s published workflow is not counted here."

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · `Credential` — checked {relative} / never checked
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CREDENTIAL_NEVER_CHECKED = "never checked"

/** Compact relative time — the shipped `UsersAndAccess.tsx:87-97` form, reused rather than
 *  re-invented so two instrument tables never disagree about what "3h ago" means. */
export function relativeTime(ms: number): string {
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

/** `checked {relative}` or `never checked` — NEVER a fabricated timestamp (the 068-A
 *  honest-last-active rule, applied to a credential check). An unparseable value reads as
 *  never checked, because a value we cannot read is not a check we can claim happened. */
export function credentialLabel(
  lastCheckedAt: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!lastCheckedAt) return CREDENTIAL_NEVER_CHECKED
  const t = Date.parse(lastCheckedAt)
  if (!Number.isFinite(t)) return CREDENTIAL_NEVER_CHECKED
  return `checked ${relativeTime(now - t)}`
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · THE TWO EMPTY STATES — DIFFERENT FACTS, DIFFERENT COPY (UI-SPEC §2d, §2e)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Filtered to zero. This is a statement about the FILTER. Conflating it with the empty
 *  state below is §2d's named risk, and the suite asserts the two strings are not equal. */
export const CONNECTIONS_FILTERED_TO_ZERO = "No connection matches this filter."

export const CONNECTIONS_EMPTY_GLYPH = "⇗"
export const CONNECTIONS_EMPTY_HEADING = "No connections yet"

/** Verbatim from sketch 155-C. The SECOND SENTENCE IS LOAD-BEARING and must not be
 *  trimmed: it is the armed-checkpoint promise (189 D-04) told at the moment someone first
 *  meets the concept, which is the only moment it can do its work. */
export const CONNECTIONS_EMPTY_BODY =
  "A connection is a real destination — a mailbox, a Jira project, a Slack channel — that a workflow step can send to. Nothing sends until a person approves it in the run."

export const CONNECTIONS_LOADING = "Loading connections…"

/** The read failed. Populated ≠ empty ≠ loading ≠ error — the same honest four-state set
 *  `ConnectionPicker` keeps, for the same reason: an error rendered as "none exist" tells
 *  a person to create something they may already have. */
export const CONNECTIONS_READ_FAILED =
  "Could not load connections. Nothing is wrong with them — this page could not read them."

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 · ACTIONS (UI-SPEC §2f — at most three primary at rest)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CONNECTIONS_ADD_CTA = "＋ Add a connection"
export const CONNECTIONS_ACTION_CHECK = "Check credential"
export const CONNECTIONS_ACTION_DISABLE = "Disable"
export const CONNECTIONS_ACTION_ENABLE = "Enable"
export const CONNECTIONS_ACTION_DELETE = "Delete"

/** The icon-only row-overflow trigger's accessible name (UI-SPEC §12). It carries the
 *  connection's OWN name so a screen-reader user in a 24-row table hears WHICH row's menu
 *  they are on. Radix supplies no name for a glyph child, so this is never left to a
 *  default — 24 nodes that all announce as "button, more" is the failure the rule exists
 *  to prevent. */
export const moreActionsLabel = (name: string): string => `More actions for ${name}`

/** U-02. For a non-admin the Add button is REMOVED, not disabled (the shipped 185 rule: a
 *  control that could never do anything is removed), and this line stands at the foot of
 *  the table header in its place — so the absence reads as a decision rather than a bug. */
export const CONNECTIONS_NON_ADMIN_NOTE =
  "Only an organisation admin can add or change a connection. You can bind an existing one to a workflow step."

// ═══════════════════════════════════════════════════════════════════════════════════════
// 9 · DESTRUCTIVE GUARDS (UI-SPEC §2g — the graded-guard rule, 146–148, locked)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The victim clause, graded by whether there IS a victim. Singular is authored rather
 *  than pluralised by an `s`, because "1 published workflow steps send" is the kind of
 *  sentence that makes a person distrust the number beside it. */
function victimClause(count: number): string {
  if (count <= 0) {
    return "No published workflow step you can see sends through this connection — though a colleague's published workflow would not be visible to this page."
  }
  if (count === 1) {
    return "1 published workflow step sends through this connection."
  }
  return `${count} published workflow steps send through this connection.`
}

export const deleteSheetTitle = (name: string): string => `Delete ${name}?`

/** §11d verbatim, with the victim clause graded. Names the cause, then the cost, then the
 *  irreversibility, then that it is recorded (142-B ordering). */
export const deleteSheetBody = (count: number): string =>
  `${victimClause(count)} They will read “Not sent — recorded” until another connection is bound. The stored credential is destroyed and cannot be recovered. This is recorded with your name.`

export const deleteConfirmLabel = (name: string): string => `Delete ${name}`
export const DELETE_CANCEL_LABEL = "Keep it"

export const disableSheetTitle = (name: string): string => `Disable ${name}?`

export const disableSheetBody = (count: number): string =>
  `${victimClause(count)} They will read “Not sent — recorded” until it is enabled again. The stored credential is kept, untouched. You can enable it at any time. This is recorded with your name.`

export const disableConfirmLabel = (name: string): string => `Disable ${name}`
export const DISABLE_CANCEL_LABEL = "Keep it enabled"

/** Every write lands as a RECEIPT, never a toast (the 062-A rule). `consequence ≠ receipt`:
 *  a disabled connection keeps its persistent `⏻ Disabled` state chip, which is its
 *  CONSEQUENCE — separate from this one-time acknowledgement that the write landed. */
export const receiptFor = (verb: string): string => `✎ ${verb} · recorded`

export const RECEIPT_DELETED = receiptFor("Deleted")
export const RECEIPT_DISABLED = receiptFor("Disabled")
export const RECEIPT_ENABLED = receiptFor("Enabled")
export const RECEIPT_CHECKED = receiptFor("Checked")

/** A write that did not land. Retryable, and it says so — never a silent no-op. */
export const CONNECTIONS_WRITE_FAILED = "Couldn’t apply that change — try again."

// ═══════════════════════════════════════════════════════════════════════════════════════
// 10 · THE `live_connectors` OFF BANNER (D-26 / UI-SPEC §2h)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The banner's mark — the SAME `⛨` authority shield the Control Room uses (icon-convention
 *  §4: one authority mark, two surfaces). It is not a new glyph. */
export const CONNECTIONS_BANNER_GLYPH = "⛨"

export const CONNECTIONS_BANNER_HEADING = "Live sending is off for this platform"

/**
 * ⭐ D-190-DEF-07 RESOLVED HERE — THE COPY HALF. Read this before editing the sentence.
 *
 * Sketch 155-C's operator-approved banner read, verbatim:
 *
 *   "Connections below can be saved and bound to a workflow, but no message, ticket or
 *    email will leave."
 *
 * That sentence is **FALSE** against the surface plan 190-09 shipped. `api/connectors.py`
 * carries `require_visible("live_connectors")` on all three WRITE endpoints, so while the
 * switch is off an org admin's create / edit / delete is refused 403 — the banner promised
 * a save the API declines, to exactly the audience that reads it. 190-09 recorded the
 * contradiction in three places rather than smoothing it (its module header, its summary,
 * and `deferred-items.md` D-190-DEF-07) and handed the one-line choice to this plan.
 *
 * **THE BRANCH TAKEN: (b) the GATE is right, and the COPY moves.** Reasons, in order:
 *   1. Branch (a) — deleting the three `require_visible` entries — would REMOVE a security
 *      gate from a security phase, inside a Settings-table plan, and would turn a shipped
 *      plant-driven test RED (`test_190_connectors_api.py` case 9 asserts the OFF direction
 *      refuses the write). Removing a gate that was PROVED to work is not a copy fix.
 *   2. Of the two possible errors, the gate is the more restrictive one. A phase whose whole
 *      discipline is not over-claiming should not ship a live-credential write surface
 *      MORE open than its plan says.
 *   3. The copy is what this plan OWNS. The banner string is authored here, in this commit.
 *   4. The banner renders ONLY while the switch is off — the exact state it now describes —
 *      so the corrected sentence can never be shown in a state it does not fit.
 *
 * **REVERSAL COST — one line each side, and they may never be separated:** delete the three
 * `dependencies=[Depends(require_visible("live_connectors"))]` entries in
 * `backend/app/api/connectors.py`, re-point `test_190_connectors_api.py`'s case 9, restore
 * this sentence to 155-C's wording, and drop the OFF-state write-affordance removal in
 * `ConnectionsTab.tsx`. A gate without the copy under-claims; the copy without the gate is
 * the D-31 defect this phase exists to avoid.
 */
export const CONNECTIONS_BANNER_BODY =
  "Connections below are read-only until an operator turns it on — nothing here can be added or changed, and no message, ticket or email will leave. Steps still record what they would have done and read “Not sent — recorded”."

/** The banner's closing line, split so `live_connectors` can be rendered inside a `<code>`.
 *  It is the ONE place a technical name appears on this surface, because it is the exact
 *  string the operator must find in the Control Room — a plain-language paraphrase would be
 *  unsearchable, which is the one thing this sentence cannot afford (LANG-01's carve-out). */
export const CONNECTIONS_BANNER_OPERATOR_PREFIX = "An operator turns "
export const CONNECTIONS_BANNER_OPERATOR_FLAG = LIVE_CONNECTORS_FEATURE_KEY
export const CONNECTIONS_BANNER_OPERATOR_SUFFIX = " on in the Control Room."

/** The whole closing line as one string, for a suite that wants to assert it without
 *  reassembling three fragments. */
export const CONNECTIONS_BANNER_OPERATOR_LINE = `${CONNECTIONS_BANNER_OPERATOR_PREFIX}${CONNECTIONS_BANNER_OPERATOR_FLAG}${CONNECTIONS_BANNER_OPERATOR_SUFFIX}`

// ═══════════════════════════════════════════════════════════════════════════════════════
// 11 · THE SECTION'S OWN TITLE + DESCRIPTION (rendered by SettingsPage's SectionCard)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CONNECTIONS_SECTION_TITLE = "Connections"

export const CONNECTIONS_SECTION_DESCRIPTION =
  "The real destinations your organisation's workflows may send to. A step sends nothing until a person approves it in the run."
