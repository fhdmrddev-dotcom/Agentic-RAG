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

/** The closed set, in the order mig 116's CHECK constraint and `ConnectorCapability`
 *  spell it. A fourth member is a phase, not a field (D-32). */
export const CAPABILITY_CHOICES: ReadonlyArray<{
  capability: ConnectorCapability
  label: string
}> = [
  { capability: "send_email", label: "Send an email" },
  { capability: "create_ticket", label: "Create a Jira ticket" },
  { capability: "post_message", label: "Post a Slack message" },
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

/** The field COUNT per capability, as data rather than as prose, so the suite walks the
 *  same closed set the panel renders (§3b: 4 / 5 / 3, asserted, so an extra field fails
 *  loudly — T-190-17-SCOPE). */
export const FIELD_COUNTS: Record<ConnectorCapability, number> = {
  send_email: 4,
  create_ticket: 5,
  post_message: 3,
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · THE DRAFT — one flat shape, so the footer can derive from it during render
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Everything the form holds, flat and all-string.
 *
 * FLAT ON PURPOSE: the 🔒 footer must update AS YOU TYPE and must be built from PARTS
 * DURING RENDER, never from state (`ProviderPicker.tsx:159-165`'s `footerParts` idiom). A
 * derived footer held in state is a footer that can disagree with the field above it, and
 * on this surface that disagreement is the whole threat (T-190-17-DEST).
 */
export interface ConnectionDraft {
  capability: ConnectorCapability
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
    capability: connection.capability,
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

/** The draft's config, in the shape the API's create/update bodies declare. Total over the
 *  closed capability set; no `username` is written, because §3b lists no such field and
 *  every extra field is a surface nobody threat-modelled (D-32). */
export function configFromDraft(draft: ConnectionDraft): ConnectorConnectionConfig {
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
  return { default_channel: draft.channel.trim() }
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
