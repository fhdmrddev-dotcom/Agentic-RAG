/**
 * Phase 190-17 (CONN-02 / CONN-03, UI-SPEC §3a–§3e, §9, §11b–§11d, §12) — the add/edit
 * panel's copy and its pure derivations.
 *
 * ── WHY A SECOND SIBLING `*Copy.ts` AND NOT EXPORTS OUT OF THE `.tsx` ──
 * The same measured reason `connectionsCopy.ts` states in its own header, taken again
 * rather than re-discovered: a `.tsx` that exports both components AND constants trips
 * `react-refresh/only-export-components`, and plan 190-12 MEASURED that cost at
 * `eslint src/components/workflows/` 5 → 10. Plan 190-16 took the sibling-module fix and
 * held `eslint src/components/settings/` at 5 → 5. Measured at HEAD before this file
 * existed: **5 errors, all pre-existing** (`ProviderPicker.tsx` ×2 react-refresh,
 * `ModelPillRow.tsx` ×2 static-components, `ProviderPicker.tsx` ×1). This split keeps that
 * number where it is instead of taking it to 5 + one per exported string.
 *
 * 190-16's own summary named this file's existence in advance: *"`connectionsCopy.ts` is
 * the established home for a string on this surface; the panel's own copy module belongs
 * beside it."* This is that module. `ConnectionFormPanel.tsx` exports components ONLY.
 *
 * ── THE SECRET IS WRITE-ONLY, AND NOTHING HERE MAY EVER CARRY ONE (§3d / T-190-17-SECRET) ──
 * `ConnectorConnection` — the ONLY shape that reaches this panel from the server —
 * declares no credential field in either form, and the Pydantic
 * `ConnectorConnectionResponse` behind it is `extra='forbid'` with a module-scope
 * projection assert that makes adding one an IMPORT failure (plan 190-06, proved by a
 * plant observed RED as a collection error). So the panel's edit branch has nothing to
 * pre-fill even if it wanted to — and it renders TEXT, never an input carrying a fake
 * value, because a fake value is a value the DOM holds.
 *
 * ── EVERY STRING HERE IS A CONTRACT (§11d) ──
 * Exported identifiers, asserted by CHARACTER IDENTITY in the suite (the
 * `GovernanceSection.tsx:10-17` idiom). A sentence that lives inline inside JSX is a
 * sentence nobody can test for drift.
 */
import type {
  ConnectorCapability,
  ConnectorConnection,
  ConnectorConnectionConfig,
} from "@/lib/api"

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · THE PANEL CHROME (§11d — the copy table, verbatim)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const PANEL_TITLE_CREATE = "Add a connection"

/** §11d verbatim. It names the armed-checkpoint promise (189 D-04) at the moment a person
 *  is creating the thing that could send — the only moment it does its work. */
export const PANEL_SUBTITLE_CREATE =
  "A real destination a workflow step can send to. It sends nothing until a person approves it in a run."

/** §11d verbatim. It states D-12 — org-shared — at the top of an EDIT, because editing a
 *  colleague-visible row is the moment that fact becomes actionable. */
export const PANEL_SUBTITLE_EDIT =
  "Everyone in your organisation can bind this to a workflow step."

export const PANEL_SAVE_CREATE = "Save connection"
export const PANEL_SAVE_EDIT = "Save changes"
export const PANEL_CANCEL = "Cancel"

/** The icon-only close control's accessible name (§12). Never left to a default — the
 *  same rule that gave the row `⋯` its own name in `connectionsCopy.moreActionsLabel`. */
export const PANEL_CLOSE_LABEL = "Close the connection panel"

/** The panel's own landmark name, so a screen-reader user hears WHICH region trapped
 *  their focus rather than "complementary". */
export const PANEL_REGION_LABEL_CREATE = "Add a connection"
export const panelRegionLabelEdit = (name: string): string => `Edit connection: ${name}`

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · THE CAPABILITY CHOOSER — chosen FIRST, and the rest of the form appears (§3b)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CAPABILITY_LABEL = "What this connection does"

/** §3b's opening finding, made into a help line: *"every capability needs different facts,
 *  and Slack needs almost none."* The chooser leads because the field set depends on it. */
export const CAPABILITY_HELP =
  "Pick this first — each kind of destination needs different facts, and one needs almost none."

/**
 * The MCP shape's chooser label (206.1 item 1 / D-206.1-03).
 *
 * ⚠ IT NAMES THE CAPABILITY, NOT ONE ACT, and the asymmetry with its three siblings is
 * deliberate. `Send an email` / `Create a Jira ticket` / `Post a Slack message` each name ONE
 * action, because each of those connections can do exactly one thing. An MCP server cannot be
 * described that way: WHICH tools it may run is decided later, per tool, by the grants at the
 * builder seam — so a label promising one action would be promising something the row does not
 * decide.
 *
 * ⚠ It must contain neither `Jira site` nor `SMTP host and port`: the shipped field-set case
 * asserts both strings ABSENT on a non-matching shape, and a chooser label carrying either
 * would make that case pass or fail for a reason it is not about.
 *
 * ⚠ DECLARED ABOVE `CAPABILITY_CHOICES` AND NOT BESIDE ITS SIBLINGS BELOW, because a `const`
 * is NOT hoisted for initialisation — reading it from the array literal before this line runs
 * is a temporal-dead-zone `ReferenceError` at module load, which no type checker reports.
 */
export const CAPABILITY_CHOICE_MCP_LABEL = "Use tools from an MCP server"

/**
 * The chooser's four entries.
 *
 * The first three are the closed capability set, in the order mig 116's CHECK constraint and
 * `ConnectorCapability` spell it. ⚠ **The fourth is not a capability at all** — it is the MCP
 * SHAPE (`ConnectionShape`'s `"mcp"` sentinel, declared beside `ConnectionDraft` below), and
 * it is APPENDED LAST precisely so the three capabilities keep their mig-116 order: a member
 * added at the end cannot re-order the ones a person already knows.
 *
 * ⚠ The shipped docblock read *"a fourth member is a phase, not a field (D-32)"*. **That was
 * right and it is why 206.1 is a phase.** The rule is not superseded — it was OBEYED.
 */
export const CAPABILITY_CHOICES: ReadonlyArray<{
  capability: ConnectionShape
  label: string
}> = [
  { capability: "send_email", label: "Send an email" },
  { capability: "create_ticket", label: "Create a Jira ticket" },
  { capability: "post_message", label: "Post a Slack message" },
  { capability: "mcp", label: CAPABILITY_CHOICE_MCP_LABEL },
]

/** On EDIT the capability is STATIC TEXT, never a control: `ConnectorConnectionUpdate`
 *  carries no `capability` field on purpose (`api.ts:5590`) — changing it would orphan
 *  both the config shape and the stored credential in one edit. */
export const CAPABILITY_LOCKED_NOTE =
  "The kind cannot be changed after it is created — it would orphan both the saved facts and the stored credential. Add a new connection instead."

export const capabilityLabelOf = (capability: string): string =>
  CAPABILITY_CHOICES.find((c) => c.capability === capability)?.label ?? capability

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE FIELDS, BY CAPABILITY (§3b — EXACTLY 4 / 5 / 3, and nothing else)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const FIELD_NAME_LABEL = "Name"
export const FIELD_NAME_HELP = "What your colleagues will see in the picker."

// ── send_email (4 fields: Name · SMTP host and port · Send from · App password) ──
export const FIELD_SMTP_HOST_LABEL = "SMTP host and port"
export const FIELD_SMTP_HOST_PLACEHOLDER = "smtp.fastmail.com"
export const FIELD_SMTP_PORT_PLACEHOLDER = "465"

/** §3b VERBATIM. It states the plaintext refusal BEFORE a person can trip it — a refusal
 *  told after the fact is a refusal that cost someone a round trip. */
export const FIELD_SMTP_HOST_HELP =
  "Must be reachable on the public internet over TLS. Plain smtp:// is refused, including for addresses inside this network."

export const FIELD_SMTP_FROM_LABEL = "Send from"
export const FIELD_SMTP_FROM_PLACEHOLDER = "ops@northwind.co"
export const FIELD_SMTP_FROM_HELP = "The address a recipient will see this arrive from."
export const FIELD_SMTP_SECRET_LABEL = "App password"

// ── create_ticket (5 fields: Name · Jira site · Project key · Account email · API token) ──
export const FIELD_JIRA_SITE_LABEL = "Jira site"
export const FIELD_JIRA_SITE_PLACEHOLDER = "northwind.atlassian.net"
export const FIELD_JIRA_SITE_HELP = "Your Jira Cloud site. Reached over TLS, never plain http."
export const FIELD_JIRA_PROJECT_LABEL = "Project key"
export const FIELD_JIRA_PROJECT_PLACEHOLDER = "NW"
export const FIELD_JIRA_PROJECT_HELP = "The short key in front of every issue number."
export const FIELD_JIRA_EMAIL_LABEL = "Account email"
export const FIELD_JIRA_EMAIL_PLACEHOLDER = "ops@northwind.co"

/** The basic-auth USERNAME half of the Jira pair (D-03) — a NON-secret fact, which is
 *  exactly why it can be shown to an org admin without decrypting anything. */
export const FIELD_JIRA_EMAIL_HELP =
  "The account the token belongs to. This half is not a secret and is shown back to you; the token is not."
export const FIELD_JIRA_SECRET_LABEL = "API token"

// ── post_message (3 fields: Name · Channel · Bot token — and NOTHING else) ──
export const FIELD_SLACK_CHANNEL_LABEL = "Channel"
export const FIELD_SLACK_CHANNEL_PLACEHOLDER = "#ops-alerts"

/** §3b VERBATIM. D-02 told to the PERSON: one of the three destinations is unforgeable by
 *  construction, and a surface whose whole job is *where does this send?* should say which
 *  one cannot be pointed anywhere. Do NOT add a URL field here to make the form symmetric. */
export const FIELD_SLACK_CHANNEL_HELP =
  "The only thing you supply. The address this posts to is a constant in our source — it cannot be pointed anywhere else, by you or by a workflow."
export const FIELD_SLACK_SECRET_LABEL = "Bot token"

// ── mcp (3 fields: Name · MCP server URL · Access token — and NOTHING else) ──
//    206.1 item 1. No headers editor, no transport picker, no timeout, no "test connection":
//    each is a surface nobody threat-modelled (D-32 / T-190-17-SCOPE). The wire's `config` is
//    `{ headers: {} }` and this form does not offer to fill it.

export const FIELD_MCP_URL_LABEL = "MCP server URL"

/** ⚠ A RESERVED EXAMPLE DOMAIN (RFC 2606), never a real vendor's endpoint. A placeholder
 *  naming a live third party is an endorsement this form is not entitled to make — and it
 *  would be read as a recommendation the moment someone pasted it unchanged. */
export const FIELD_MCP_URL_PLACEHOLDER = "https://mcp.example.com/mcp"

/** The `FIELD_SMTP_HOST_HELP` shape, verbatim: it states the refusal BEFORE a person can trip
 *  it, because a refusal told after the fact is a refusal that cost someone a round trip. Both
 *  clauses mirror a real server-side rule — `_validate_connection_shape` raises on a non-HTTPS
 *  `mcp_server_url`, and `validate_mcp_destination` refuses a private address at call time. */
export const FIELD_MCP_URL_HELP =
  "Must be an https:// address reachable on the public internet. A plain http:// address is refused, and so is an address inside this network."

/** The MCP client sends the credential as Bearer or Basic, so the honest noun is a TOKEN.
 *  ⚠ NOT `Bot token` (Slack's) and NOT `API token` (Jira's): a label shared across kinds is
 *  exactly how the fourth positional ladder becomes invisible — today an MCP draft falls
 *  through `secretLabel`'s trailing arm and is labelled with Slack's word. */
export const FIELD_MCP_SECRET_LABEL = "Access token"

/**
 * D-206.1-06 — the credential is OPTIONAL for the MCP shape, and only for it.
 *
 * ⚠ AFFIRMATIVE, NEVER A WARNING. Many MCP servers authenticate nobody; a form that treated
 * that as a fault would be telling a person their working configuration is broken. So this
 * carries no destructive tone, no red, and no error register — it states a fact and what
 * happens next.
 *
 * It renders BESIDE `SECRET_CREATE_HELP` and never replaces it: the encryption promise is told
 * for every kind, including the kind that may not need a credential at all.
 *
 * ⚠ A capability connection still REQUIRES a secret — WR-05 at the model, and the guard sits
 * after the MCP branch returns. This note must never be shown for one.
 */
export const FIELD_MCP_SECRET_OPTIONAL_NOTE =
  "Optional — many MCP servers ask for none. Leaving this empty saves a connection with no credential."

/**
 * D-206.1-05 — why Save is off, in the person's own words.
 *
 * ⚠ THE SECOND CLAUSE IS LOAD-BEARING AND MAY NOT BE TRIMMED AS FILLER. This panel's check is
 * a COURTESY, never the security boundary: the model raises on a non-HTTPS `mcp_server_url`
 * before the row is written, and `validate_mcp_destination` refuses again at call time, after
 * the address resolves, every time a step sends. This sentence is the only place on this
 * surface a person can see that the form is not the wall — and a disabled Save is kinder than
 * a 422.
 */
export const MCP_SAVE_DISABLED_REASON =
  "Save is off until the server address starts with https://. This form refuses it here; the server refuses it again before anything is sent."

/** The field COUNT per SHAPE, as data rather than as prose, so the suite walks the same closed
 *  set the panel renders (§3b: 4 / 5 / 3, plus 206.1's 3 for MCP — asserted, so an extra field
 *  fails loudly — T-190-17-SCOPE).
 *  ⚠ TOTAL over `ConnectionShape`: a fifth member added without a bound count is a TYPE ERROR
 *  here rather than an unasserted field set discovered in a browser. */
export const FIELD_COUNTS: Record<ConnectionShape, number> = {
  send_email: 4,
  create_ticket: 5,
  post_message: 3,
  mcp: 3,
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · THE DRAFT — one flat shape, so the footer can derive from it during render
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * What KIND of connection this form is composing — the three capabilities, plus 206.1's MCP
 * sentinel.
 *
 * ⚠ THE TYPE IS WIDENED; THE STATE IS NOT FORKED, and the two alternatives are recorded here
 * so they are not re-proposed:
 *
 *   (a) A separate `shape` field beside `capability`. Rejected: it turns ~10 shipped render
 *       guards into two-term conjunctions, and it lets two fields DISAGREE — a draft claiming
 *       `shape: "mcp"` and `capability: "send_email"` is representable, and something would
 *       eventually read the wrong one.
 *   (b) `capability: ConnectorCapability | null`. Rejected: `<select value={null}>` is an
 *       uncontrolled-input warning, and it makes the panel's `??` fallback ambiguous in exactly
 *       the place D-206.1-22's defect already lives.
 *
 * Widening the union costs nothing at the guards: every shipped
 * `capability === "send_email" | "create_ticket" | "post_message"` comparison stays LITERALLY
 * unchanged and simply does not match.
 *
 * ⚠ THE SENTINEL NEVER REACHES THE WIRE. `handleSave` branches on it BEFORE composing a body,
 * and the MCP body carries no `capability` key at all — the model's `_validate_connection_shape`
 * returns on `mcp_server_url` before the capability arm, and `"mcp"` is not a member of the
 * server's `ConnectorCapability`.
 */
export type ConnectionShape = ConnectorCapability | "mcp"

/**
 * Everything the form holds, flat and all-string.
 *
 * FLAT ON PURPOSE: the 🔒 footer must update AS YOU TYPE and must be built from PARTS
 * DURING RENDER, never from state (`ProviderPicker.tsx:159-165`'s `footerParts` idiom). A
 * derived footer held in state is a footer that can disagree with the field above it, and
 * on this surface that disagreement is the whole threat (T-190-17-DEST).
 */
export interface ConnectionDraft {
  capability: ConnectionShape
  name: string
  /** send_email */
  host: string
  port: string
  fromAddress: string
  /** create_ticket */
  baseUrl: string
  projectKey: string
  accountEmail: string
  /** post_message */
  channel: string
  /** mcp (206.1) — the whole destination, as typed. Flat and all-string like every other
   *  field, so the 🔒 footer derives it during render rather than holding a parsed copy. */
  mcpServerUrl: string
  /** Write-only, at this boundary and nowhere else. Never populated from a read. */
  secret: string
}

export const EMPTY_DRAFT: ConnectionDraft = {
  capability: "send_email",
  name: "",
  host: "",
  port: "",
  fromAddress: "",
  baseUrl: "",
  projectKey: "",
  accountEmail: "",
  channel: "",
  mcpServerUrl: "",
  secret: "",
}

/**
 * A draft from a stored row.
 *
 * ⚠ `secret` IS ALWAYS THE EMPTY STRING and that is not a defensive habit — there is
 * nothing to copy. `ConnectorConnection` declares no credential field, so this function
 * COULD NOT pre-fill one even if a later edit wanted it to. Read defensively through
 * `unknown` because `config` is a three-member union and this reader is deliberately TOTAL
 * over it (`connectionsCopy.destinationFactsOf`'s argument, one surface across).
 */
export function draftFromConnection(connection: ConnectorConnection): ConnectionDraft {
  const config = connection.config as unknown as Record<string, unknown>
  const text = (key: string): string =>
    typeof config[key] === "string" ? (config[key] as string) : ""
  return {
    ...EMPTY_DRAFT,
    // ┌─ SUPERSEDED 2026-08-25 (206.1 / D-206.1-22) — KEPT VERBATIM, DO NOT RE-APPLY ────────┐
    // │ "An MCP connection carries no capability (206), and this draft describes the        │
    // │  CAPABILITY form. Falling back to the empty draft's own default keeps the form      │
    // │  constructable rather than inventing a capability the row does not have."           │
    // └────────────────────────────────────────────────────────────────────────────────────┘
    // ⚠ THAT PARAGRAPH READS AS A DECISION AND IS IN FACT A STATEMENT OF A DEFECT. The
    // fallback did keep the form constructable — as the SMTP form. Measured: opening a stored
    // MCP row rendered `Send an email`, SMTP host/port fields and an `App password` label, and
    // its Save composed a `SendEmailConfig` that the API refused with a generic
    // "Couldn’t save that — try again." A person could not attribute that failure to anything.
    //
    // THE CORRECTED RULE: the shape is read from the ROW — `connection.mcp_server_url != null`
    // — and NEVER from a missing capability. Absence read as a default is precisely the shape
    // D-206.1-11 forbids, and `capability === null` would be that same mistake pointed the
    // other way: a future row that legitimately lacks a capability for some third reason would
    // be dragged into the MCP form.
    //
    // ⚠ A ROW CARRYING BOTH SEEDS MCP. The URL wins because MCP is a SHAPE, not a capability:
    // the server's own validator returns on `mcp_server_url` before it ever looks at the
    // capability arm, so the URL is what the wire will act on.
    capability: connection.mcp_server_url ? "mcp" : (connection.capability ?? EMPTY_DRAFT.capability),
    mcpServerUrl: connection.mcp_server_url ?? "",
    name: connection.name,
    host: text("host"),
    port: typeof config.port === "number" ? String(config.port) : "",
    fromAddress: text("from_address"),
    baseUrl: text("base_url"),
    projectKey: text("project_key"),
    accountEmail: text("account_email"),
    channel: text("default_channel"),
    secret: "",
  }
}

/**
 * ⚠ `tls` IS DERIVED FROM THE PORT, NOT CHOSEN — and the reason is that §3b binds FOUR
 * fields for `send_email` and a TLS radio would be a fifth.
 *
 * The derivation is the universal SMTP convention: 465 is implicit TLS (SMTPS), everything
 * else negotiates STARTTLS. `SendEmailConnectionConfig.tls` is a CLOSED two-member union
 * (`api.ts:5524`) precisely because D-07 requires TLS either way — there is no plaintext
 * member to pick, so nothing is lost by not asking. **And the choice is never silent:** the
 * 🔒 footer renders the resulting mode as a tag on every keystroke, which is the same cure
 * 024-A applied to a silently mis-routed endpoint.
 */
export function tlsModeOf(port: string): "implicit" | "starttls" {
  return port.trim() === "465" ? "implicit" : "starttls"
}

/**
 * The draft's config, in the shape the API's create/update bodies declare.
 *
 * Total over the closed shape set; no `username` is written, because §3b lists no such field
 * and every extra field is a surface nobody threat-modelled (D-32).
 *
 * ⚠ EVERY ARM NAMES ITS OWN CONDITION AND THE TAIL IS NEUTRAL — the `destinationFactsOf`
 * repair (`connectionsCopy.ts`, commit `147f3c57`), applied here before it could ship the same
 * way. Until 206.1 the trailing statement WAS the Slack arm and the fallback at once, so an
 * unrecognised shape composed a `PostMessageConfig` with an EMPTY `default_channel` — which
 * `NonEmpty` refuses at the model, turning an unknown shape into a 422 wearing the generic
 * "Couldn’t save that" sentence. A neutral tail degrades to a config the API will reject on
 * its own terms rather than to another kind's config.
 */
export function configFromDraft(draft: ConnectionDraft): ConnectorConnectionConfig {
  // ⚠ FIRST, and by its own condition. `McpConfig` is `extra="forbid"` with exactly ONE field,
  // so this object's KEY SET is the contract — a second key is a 422 no client type can see.
  if (draft.capability === "mcp") {
    return { headers: {} }
  }
  if (draft.capability === "send_email") {
    const parsed = Number.parseInt(draft.port.trim(), 10)
    return {
      host: draft.host.trim(),
      port: Number.isFinite(parsed) ? parsed : 0,
      from_address: draft.fromAddress.trim(),
      tls: tlsModeOf(draft.port),
    }
  }
  if (draft.capability === "create_ticket") {
    return {
      base_url: draft.baseUrl.trim(),
      project_key: draft.projectKey.trim(),
      account_email: draft.accountEmail.trim(),
    }
  }
  // ⚠ EXPLICIT, NOT POSITIONAL. Slack's arm names the capability it serves, so a shape this
  // ladder does not know falls to the neutral below instead of silently inheriting Slack's.
  if (draft.capability === "post_message") {
    return { default_channel: draft.channel.trim() }
  }

  // The NEUTRAL terminal. It claims no kind's facts. `McpConnectionConfig` declares `headers`
  // optional, so an empty object satisfies the union without asserting anything — and it is
  // distinguishable from the MCP arm above, whose key set is exactly `["headers"]`.
  return {}
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · THE ALWAYS-ON 🔒 DESTINATION FOOTER (§3c — T-190-17-DEST)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const FOOTER_GLYPH = "🔒"
export const FOOTER_PREFIX = "sends to"

/** Shown while a destination field is still blank, so the footer NEVER disappears — an
 *  absent footer is the state a person could bind through without reading. */
export const FOOTER_NOTHING_YET = "nothing yet — fill the fields above"

export const FOOTER_TAG_IMPLICIT_TLS = "implicit TLS"
export const FOOTER_TAG_STARTTLS = "STARTTLS"
export const FOOTER_TAG_FIXED = "fixed in code"
export const FOOTER_TAG_TLS = "TLS"
export const FOOTER_TAG_REFUSED = "refused"

/** Slack's real endpoint — a module constant in `backend/app/security/egress.py`
 *  (`SLACK_API_BASE`), which is what makes the `fixed in code` tag TRUE rather than
 *  reassuring. This literal is the only place the client spells it. */
export const SLACK_ENDPOINT = "https://slack.com/api/chat.postMessage"

/**
 * ⚠ THE HONEST SCOPE OF THE `refused` TAG, stated because copy rule 5 forbids an absolute
 * verb for a guarantee only a client provides.
 *
 * The SERVER refuses a destination by RESOLVING it and inspecting the resulting IP
 * (`app/security/egress.py: refuse_reason` / `validate_destination`). A browser cannot
 * resolve anything, so the client can only recognise the refusals that are provable FROM
 * THE TEXT — a plaintext scheme, or an address literal that is loopback / private /
 * link-local. Everything else renders with NO verdict at all rather than a green one: this
 * footer says WHERE it sends, and only claims *refused* where it can prove it.
 *
 * That is why the sentence below names the mechanism instead of promising an outcome.
 */
export const FOOTER_SERVER_NOTE =
  "This line reads what you typed. The address is checked again on the server, after it resolves, every time a step sends."

/** The reason words, closed. Each is a fact about the TEXT, never about the network. */
export const REFUSAL_PLAINTEXT_SCHEME = "a plain, unencrypted address is refused"
export const REFUSAL_PRIVATE_LITERAL = "an address inside a private network is refused"

const PRIVATE_V4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

/**
 * Can this typed host be refused on the strength of its TEXT alone?
 *
 * Returns the reason, or `null` for *nothing provable here* — which is NOT the same as
 * *allowed*, and the footer renders no verdict in that case.
 */
export function refusalOf(rawHost: string): string | null {
  const host = rawHost.trim().toLowerCase()
  if (!host) return null
  // A scheme typed into a host box. `https://` and `smtps://` are the encrypted forms and
  // are left alone; every other scheme is plaintext by name.
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//.exec(host)
  if (schemeMatch && schemeMatch[1] !== "https" && schemeMatch[1] !== "smtps") {
    return REFUSAL_PLAINTEXT_SCHEME
  }
  const bare = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split("/")[0]
  if (bare === "localhost" || bare.endsWith(".localhost")) return REFUSAL_PRIVATE_LITERAL
  if (bare === "::1" || bare === "[::1]") return REFUSAL_PRIVATE_LITERAL
  if (PRIVATE_V4.test(bare)) return REFUSAL_PRIVATE_LITERAL
  return null
}

/** What the footer renders. Built from PARTS during render, never held in state. */
export interface DestinationFooter {
  /** The destination itself, or `FOOTER_NOTHING_YET`. */
  destination: string
  /** The mode tags, in order. Never empty for a filled destination. */
  tags: string[]
  /** The trailing facts (`· from ops@northwind.co`). */
  detail: string | null
  /** Provable from the text alone — see `refusalOf`'s docblock. */
  refusedReason: string | null
}

/**
 * The footer, derived from the draft on every render (§3c).
 *
 * RENDERED ALWAYS, updating as you type, NEVER behind an “advanced” disclosure. This is
 * 024-A's cure for BUG-260616-01 (a silently mis-routed endpoint) applied to a destination
 * instead of a model: **you can never bind a connection without seeing where it sends.**
 */
export function destinationFooterOf(draft: ConnectionDraft): DestinationFooter {
  if (draft.capability === "post_message") {
    const channel = draft.channel.trim()
    return {
      destination: SLACK_ENDPOINT,
      tags: [FOOTER_TAG_FIXED, FOOTER_TAG_TLS],
      detail: channel ? `· ${channel.startsWith("#") ? channel : `#${channel}`}` : null,
      refusedReason: null,
    }
  }

  if (draft.capability === "create_ticket") {
    const site = draft.baseUrl.trim()
    const refusedReason = refusalOf(site)
    const project = draft.projectKey.trim()
    return {
      destination: site ? (site.includes("://") ? site : `https://${site}`) : FOOTER_NOTHING_YET,
      tags: site ? (refusedReason ? [FOOTER_TAG_REFUSED] : [FOOTER_TAG_TLS]) : [],
      detail: project ? `· project ${project}` : null,
      refusedReason,
    }
  }

  // ⚠ 206.1 — THE MCP ARM, COMPOSED FROM THE SHIPPED TAG VOCABULARY AND NO NEW TAG. The
  // destination IS the typed URL: unlike Slack's, it is entirely the author's, which is why
  // this surface exists at all.
  // ⚠ `refusalOf` IS REUSED VERBATIM AND NOT RE-IMPLEMENTED. It is already a text-only mirror
  // of `validate_mcp_destination` — plaintext scheme, loopback, private literal — and a second
  // URL validator on this surface would be a SECOND ANSWER, free to drift from the first.
  if (draft.capability === "mcp") {
    const url = draft.mcpServerUrl.trim()
    const refusedReason = refusalOf(url)
    return {
      // Normalised for DISPLAY only, exactly as the Jira site field's arm does — the wire
      // carries what the person typed, and Save is off until that starts with `https://`.
      destination: url ? (url.includes("://") ? url : `https://${url}`) : FOOTER_NOTHING_YET,
      tags: url ? (refusedReason ? [FOOTER_TAG_REFUSED] : [FOOTER_TAG_TLS]) : [],
      // No second part to name. An MCP server's tools are decided by the GRANTS, not here, so
      // a detail line would be a fact this form does not hold.
      detail: null,
      refusedReason,
    }
  }

  // ⚠ EXPLICIT, NOT POSITIONAL (206.1). Until this arm named `send_email`, it was the SMTP arm
  // and the fallback at once — so an unrecognised shape rendered an SMTP footer, tagged with a
  // TLS mode derived from a port it was never given, beside a `from` address it did not have.
  if (draft.capability === "send_email") {
    const host = draft.host.trim()
    const port = draft.port.trim()
    const refusedReason = refusalOf(host)
    const mode = tlsModeOf(port) === "implicit" ? FOOTER_TAG_IMPLICIT_TLS : FOOTER_TAG_STARTTLS
    const from = draft.fromAddress.trim()
    return {
      destination: host ? (port ? `${host}:${port}` : host) : FOOTER_NOTHING_YET,
      tags: host ? (refusedReason ? [FOOTER_TAG_REFUSED] : [mode]) : [],
      detail: from ? `· from ${from}` : null,
      refusedReason,
    }
  }

  // The NEUTRAL terminal. The footer NEVER disappears — an absent footer is the state a person
  // could bind through without reading — so it degrades to the WORD rather than to nothing,
  // and it claims no tag, no detail and no verdict about a destination it cannot name.
  return {
    destination: FOOTER_NOTHING_YET,
    tags: [],
    detail: null,
    refusedReason: null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · THE WRITE-ONLY SECRET (§3d — T-190-17-SECRET)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** §3d verbatim, on CREATE. */
export const SECRET_CREATE_HELP =
  "Encrypted before it touches the database, and never rendered back to any browser once saved."

/** §3d verbatim, on EDIT. Three audiences named on purpose — *not to you, not to an admin,
 *  not to the workflow author* — because the question a person actually asks is *"who CAN
 *  see it?"*, and the honest answer is nobody. */
export const SECRET_STORED_NOTE =
  "The stored value is never sent back to this browser — not to you, not to an admin, not to the workflow author who picks this connection. It can be replaced, never read."

/** A `font-mono` `<span>`, NEVER an `<input type=password>` carrying a fake value — a fake
 *  value is a value the DOM holds, and the suite asserts both halves. */
export const SECRET_DOTS = "••••••••••••••••"

export const SECRET_REPLACE_LABEL = "Replace"
export const SECRET_REPLACE_CANCEL = "Keep the stored one"

/**
 * ⚠ `stored {date}` IS NOT WRITTEN, AND THE SUBSTITUTION IS A MEASUREMENT.
 *
 * Sketch 156-A's row reads `•••• ··· stored 3 Aug`. Measured against the shape that
 * actually reaches this panel: `ConnectorConnection` carries `created_at` and `updated_at`
 * and **no secret timestamp at all** (`api.ts:5562-5573`) — and `updated_at` moves on a
 * RENAME as much as on a secret replace, so rendering it beside the dots would date the
 * credential from a field that is not about the credential. That is precisely the
 * fabricated-timestamp error `connectionsCopy.credentialLabel` refuses one column away
 * (*"NEVER a fabricated timestamp"*), so it is refused here too.
 *
 * What IS true and IS knowable: a connection cannot exist without a secret (`secret` is
 * REQUIRED on create, `api.ts:5584`), so one has been stored since the row was created.
 * The label says exactly that much and the note beside it says what is not known.
 */
export function secretStoredLabel(createdAt: string | null | undefined): string {
  if (!createdAt) return "stored"
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return "stored"
  const d = new Date(t)
  return `stored since ${d.getUTCDate()} ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
      d.getUTCMonth()
    ]
  }`
}

export const SECRET_STORED_DATE_NOTE =
  "That is when this connection was created. The date a credential was last replaced is not sent to this browser either."

/** Replacing the secret resets `last_check_verdict` to `not_checked` IN THE SAME UPDATE
 *  (`connector_service.py:561`, research OQ#4) — so the panel says so BEFORE the person
 *  replaces, rather than letting the state chip change under them afterwards. */
export const SECRET_REPLACE_INVALIDATES =
  "Replacing it clears the last credential check — the connection reads “◌ Not checked” again until you check it."

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · THE ORG-SHARED LINE (§3e — verbatim)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** §3e verbatim, stating D-12 as a PROPERTY — because the person creating this is
 *  authorising their colleagues, and the RLS shape mig 116 ships (org-wide SELECT, no
 *  global escape branch) is what makes the second half true rather than reassuring. */
export const orgSharedLine = (orgName: string): string =>
  `⚭ Shared with everyone in ${orgName} — a connection exists so colleagues' workflows can use it. It is never visible to another organisation.`

/** When the org name has not resolved, the SHAPE of the sentence must not change — the
 *  fact it states does not depend on knowing the name. */
export const ORG_SHARED_FALLBACK_NAME = "your organisation"

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 · READ-ONLY: the non-admin branch (U-02) and the kill-switch branch (D-26 / §9)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** U-02. The same sentence the table's header carries, deliberately — one fact, one
 *  wording, two places a person can meet it. */
export const PANEL_NON_ADMIN_NOTE =
  "Only an organisation admin can add or change a connection. You can bind an existing one to a workflow step."

export const PANEL_OFF_GLYPH = "⛨"
export const PANEL_OFF_HEADING = "Live sending is off for this platform"

/**
 * ⭐ THE OWED HALF OF D-190-DEF-07, PAID HERE — read this before editing the sentence.
 *
 * Sketch 156-A moment 10, which UI-SPEC §9 carried verbatim, read:
 *
 *   "You can save this connection and workflow authors can bind it to a step. Nothing
 *    will leave: steps record what they would have done and read “Not sent — recorded”.
 *    An operator turns live_connectors on in the Control Room."
 *
 * The first clause is **FALSE**, for exactly the reason §2h's was: `api/connectors.py`
 * carries `require_visible("live_connectors")` on all three WRITE endpoints, so while the
 * switch is off an org admin's create / edit / delete is refused 403. Plan 190-16 resolved
 * §2h via **branch (b)** — the gate is right, the copy moves — and named this notice as the
 * remaining half, owed by THIS plan, in its summary, in §2h and in `deferred-items.md`.
 * It is paid in the commit that builds the panel, which is what 190-16 asked for.
 *
 * **THE STRUCTURAL HALF RIDES WITH IT**, and it is the part a copy-only fix would miss:
 * while the switch is off, the panel's WRITE affordances are **REMOVED, not disabled** —
 * no Save, no Replace, no editable input. The fields render as static text. A hidden button
 * the API still honours is one defect; a rendered button the API refuses is the other, and
 * this panel ships neither. 190-16 measured the trap directly (its plant C: an Add button
 * rendered `disabled` instead of REMOVED **passes** `toBeDisabled()`), so the suite asserts
 * ABSENCE.
 *
 * **REVERSAL COST — the four edits 190-16 recorded, plus this string.** They may never be
 * separated: delete the three `dependencies=[Depends(require_visible("live_connectors"))]`
 * entries in `backend/app/api/connectors.py`, re-point `test_190_connectors_api.py` case 9,
 * restore §2h + `CONNECTIONS_BANNER_BODY`, restore §9 + this constant to 156-A's wording,
 * and drop BOTH affordance removals (`ConnectionsTab.tsx`'s and this panel's).
 */
export const PANEL_OFF_BODY =
  "This connection is read-only until an operator turns it on — it cannot be added or changed here, and nothing will leave: steps record what they would have done and read “Not sent — recorded”."

/** The closing line, split so `live_connectors` renders inside a `<code>` — the one place
 *  a technical name is allowed on this surface, because it is the exact string the operator
 *  must find (LANG-01's carve-out). Re-uses the table banner's fragments so the two
 *  surfaces cannot drift. */
export const PANEL_OFF_OPERATOR_PREFIX = "An operator turns "
export const PANEL_OFF_OPERATOR_SUFFIX = " on in the Control Room."

/**
 * §9's `font-mono` `--warning` footer. 156-A's was `will save · will not send`.
 *
 * That is the SAME false promise as the notice above it, one line down — under branch (b)
 * it will not save either — so it moves with it. Corrected in this commit.
 */
export const PANEL_OFF_FOOTER = "read-only · will not send"

// ═══════════════════════════════════════════════════════════════════════════════════════
// 9 · SAVE + ITS FAILURE (the generic half only — §4b/§4c's refusal table is plan 190-18)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** D-32 / the plan's scope fence: the panel SAVES here, and the six closed refusal
 *  sentences of §4c plus §4b's two refusal blocks are plan 190-18's surface. This one
 *  string is the generic branch — it names no cause it cannot read, which is exactly the
 *  shape `readConnectorReasonCode` returning `null` is designed to land in. */
export const PANEL_SAVE_FAILED = "Couldn’t save that — try again."

export const PANEL_SAVING = "Saving…"
