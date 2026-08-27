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
// ⚠ THE TREE'S ONE OWN-GUARD SPELLING, imported rather than re-declared. `SERVICE_TO_SHAPE`
// is a plain object literal read with a free-text key that arrives from a person's keystrokes
// and from another tenant's stored row — the exact sink `own()` exists for (T-211-15a). This
// module is the sixth caller; the helper takes zero imports and is un-cyclable by construction.
import { own } from "@/components/workflows/ownProperty"
// Phase 212 — the presentation catalog is the ONE place a service is described. Declared HERE
// with the other imports and not mid-file: an `import` wedged between a docblock and the const
// it documents silently re-points that docblock at the import (it landed on
// `SERVICE_CUSTOM_ENDPOINT_LABEL`'s TDZ note, which is about something else entirely).
import {
  CATALOG_SERVICES,
  getCuratedServiceEntry,
} from "@/components/settings/servicesCatalog"

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
// 2 · THE SERVICE — named FIRST, and the rest of the form follows (Phase 211 / SC#1)
//
// ⚠ WHAT THIS SECTION REPLACED, AND WHY THE REPLACEMENT IS A DELETION RATHER THAN A HIDE.
// It used to hold a four-entry array that WAS the three-verb category chooser, and which
// ORGANISED the create flow: you picked a verb and the form appeared. ⚠ THAT CONSTANT'S NAME
// IS DELIBERATELY NOT SPELLED HERE — the acceptance check for its removal is a `grep -r` over
// this tree, and prose that quotes the needle makes its own count lie. (Plan 211-02 recorded
// the same trap firing three times in one migration; this is the fourth.) The suite's two
// fences compose the identifier from fragments for exactly that reason.
// `SEED-207` measured the cost of that axis: while two connection models coexist, every
// downstream surface (node face, service mark, filter, chat mention, catalog entry, picker)
// must branch, and each new surface pays the branch again. The array is DELETED rather than
// merely unrendered, because a control whose data still exists is one prop away from coming
// back — `ConnectionFormPanel.test.tsx`'s source fence asserts the panel no longer spells it.
//
// ⚠ THE VERB IS NOT DELETED. `ConnectorCapability` is untouched, `configFromDraft`'s three
// arms are untouched, and a Slack save still sends `capability: "post_message"`. CONN-05 is
// "keeps working unchanged": what moved is which fact ORGANISES the flow, not which facts
// exist. Naming a service is now how a person REACHES a capability.
// ═══════════════════════════════════════════════════════════════════════════════════════

export const SERVICE_LABEL = "Which service this connects to"

/**
 * The help line, and both of its clauses are load-bearing (D-211-02).
 *
 * The first says the identity LEADS — what the form asks for next follows from it, which is
 * the sentence the old chooser's help was making about a verb. The second says the curated
 * set is a SUGGESTION and not a constraint: a person who does not see their service must be
 * told, in place, that typing it anyway works. Without that clause the `<datalist>` reads as
 * a menu, and a menu is the closed set D-211-01 rejected wearing a friendlier control.
 */
export const SERVICE_HELP =
  "Name it first — what the form asks for next follows from it. The list is a shortcut, not a limit: type any service, including one nobody here has heard of."

/** A real identity from the list below, so the box shows the SHAPE of the answer (a short
 *  lowercase name) rather than a sentence describing one. */
export const SERVICE_PLACEHOLDER = "slack"

/**
 * The one suggestion that opens the endpoint field.
 *
 * ⚠ IT NAMES NO VENDOR AND PROMISES NO ACTION. WHICH tools such a server may run is decided
 * later, per tool, by the grants at the builder seam — so a label promising one action would
 * be promising something the row does not decide. (That paragraph is inherited verbatim in
 * substance from the label this one replaces; it was right about the MCP shape and it is
 * still right.)
 *
 * ⚠ It must contain neither `Jira site` nor `SMTP host and port`: the shipped field-set cases
 * assert both strings ABSENT on a non-matching shape, and a label carrying either would make
 * those cases pass or fail for a reason they are not about.
 *
 * ⚠ DECLARED ABOVE `SERVICE_SUGGESTIONS` AND NOT INSIDE IT, because a `const` is NOT hoisted
 * for initialisation — reading it from the array literal before this line runs is a
 * temporal-dead-zone `ReferenceError` at module load, which no type checker reports.
 */
export const SERVICE_CUSTOM_ENDPOINT_LABEL = "A server at an address you provide"

/**
 * The suggestion list — a PRESENTATION LOOKUP keyed by the free-text identity (D-211-02).
 *
 * ⭐ **IT IS A SUGGESTION, NEVER A CONSTRAINT.** It feeds a `<datalist>`, so a value that is
 * not on it is typed and accepted exactly like one that is. **A miss degrades to the raw
 * identifier** — never to a placeholder, never to a refusal, and never to a hidden row. That
 * is what makes adding a service cost ZERO ENGINEERING: a row here, not a migration.
 *
 * ⛔ **NO PER-VENDOR BRANCH MAY BE ADDED ANYWHERE.** These are rows in a lookup, not cases in
 * an `if`; the labels are DATA and nothing reads them to decide behaviour. The moment a
 * `serviceId === "slack"` comparison enters this tree, migration 116's closed-set mistake has
 * been moved to a nicer axis, which is precisely what D-211-01 rejected.
 *
 * The three identities are the ones **migration 127 backfills onto every pre-existing row**,
 * derived once from each row's `capability`. **Phase 212 owns this constant's CONTENT** — the
 * curated catalog, its marks and its starter prompts — and may move it into a table. Phase 211
 * commits only that identity does not DEPEND on it.
 */
export const SERVICE_SUGGESTIONS: ReadonlyArray<{
  service_id: string
  label: string
}> = [
  ...CATALOG_SERVICES.map((s) => ({
    service_id: s.serviceId,
    label: s.name,
  })),
  { service_id: "custom", label: SERVICE_CUSTOM_ENDPOINT_LABEL },
]

/**
 * Which FIELD SET a known identity asks for. **Presentation only** — it decides which
 * credential fields are shown and nothing else.
 *
 * ⚠ TOTAL BY CONSTRUCTION, AND READ THROUGH `own(...)` — never `MAP[key]`. This is a plain
 * object literal, so it INHERITS `constructor`, `toString`, `__proto__` and friends: a bare
 * bracket read does NOT fire its `??` fallback for those names, because the inherited member
 * is never nullish, and it hands back a FUNCTION typed as `ConnectionShape` (T-211-15a; nine
 * measured `[Function Object]` sinks in this tree, one of which hard-crashed a node face).
 * An identity this map does not hold resolves to `"service"`, which is a real shape rather
 * than an error state.
 */
export const SERVICE_TO_SHAPE: Record<string, ConnectionShape> = {
  slack: "post_message",
  jira: "create_ticket",
  smtp: "send_email",
  custom: "mcp",
  custom_mcp: "mcp",
  mcp: "mcp",
}

// ⚠ THIS MAP IS DELIBERATELY *NOT* GENERATED FROM `CATALOG_SERVICES`, and D-5 was briefly
// fixed twice — once here by spreading a catalog-derived `Object.fromEntries(...)` in, and
// once in `shapeForService` below. ONE mechanism was kept, and this is the one that went:
//
//   * `Object.fromEntries` is typed `{[k: string]: any}`, so the spread ERASED the
//     `Record<string, ConnectionShape>` annotation on every catalog-derived value — a
//     mistyped shape string would have compiled clean, in the map whose whole job is to be
//     total over five shapes.
//   * It spread AFTER the literal keys, so a future catalog row could silently override
//     `custom` / `custom_mcp` / `mcp` — order-fragility in a lookup nobody re-reads.
//   * It re-encoded markKey→shape as an inline ternary chain, which is a SECOND copy of the
//     knowledge the four literal rows above already hold. Two places to remember a service
//     is one more than D-5 existed to remove.
//
// What stays here is exactly what a catalog CANNOT know: which identities have a FIRST-PARTY
// ADAPTER behind them. `shapeForService` reads this first and the catalog second.

/**
 * The service-facing label for an identity.
 *
 * A hit renders the suggestion's human label; **a MISS renders the raw identifier itself** —
 * never a placeholder, never a blank, never a refusal (D-211-02). Renamed from
 * `capabilityLabelOf`, whose two call sites (the edit-mode static block, and this module's
 * own docblocks) moved with it.
 *
 * ⚠ `.find()` over an array rather than a map read: an array has no inherited keys to fall
 * through, so this reader needs no `own()` guard and gains none.
 */
export const serviceLabelOf = (serviceId: string): string =>
  SERVICE_SUGGESTIONS.find((s) => s.service_id === serviceId)?.label ?? serviceId

/**
 * The field set a draft asks for, from what the person has actually supplied.
 *
 * ⚠ ONE EXPLICIT OVERRIDE, AND IT IS FIRST: an `https://` endpoint selects the remote-server
 * shape whatever the identity says. That is what keeps a STORED endpoint row in its own shape
 * on edit — migration 127 backfilled such rows with their HOST as the identity, and the host
 * is not in the suggestion list. The override reads a POSITIVE fact about the draft (there is
 * an address, and it is TLS-shaped), never an absence.
 *
 * ⚠ It is HTTPS-SHAPED, not merely non-empty. A plaintext address selects nothing, so a
 * half-typed `http://…` cannot smuggle a person into a shape whose Save the server would then
 * refuse for a reason the form never named.
 */
export function shapeForService(serviceId: string, endpoint: string = ""): ConnectionShape {
  if ((endpoint || "").trim().toLowerCase().startsWith("https://")) return "mcp"

  // 1 · An identity with a FIRST-PARTY ADAPTER behind it keeps its capability field set.
  //     This arm is read FIRST and its three rows are the reason: `slack` is a catalog entry
  //     whose `markKey` is `"slack"`, but `jira` and `smtp` would BOTH satisfy arm 2's shape
  //     test on a future catalog edit, and an adapter-backed row silently becoming an MCP row
  //     is a credential pointed at the wrong wire.
  const explicit = own(SERVICE_TO_SHAPE, (serviceId || "").trim().toLowerCase())
  if (explicit) return explicit

  // 2 · Phase 212 (D-5) — OTHERWISE THE CATALOG'S OWN SHAPE DECIDES, AND THAT IS THE WHOLE FIX.
  //
  // ⚠ THIS FUNCTION USED TO END AT ARM 1, AND THREE OF SEVEN `isPopular` SERVICES WERE
  // UNUSABLE BECAUSE OF IT. `github`, `notion` and `google` ship in `POPULAR_SERVICES` with
  // `markKey: "mcp"`, and none of them is a key of `SERVICE_TO_SHAPE` — so they resolved to
  // `"service"`, whose field set is Name and NOTHING ELSE. The card rendered, the panel
  // opened, and there was no field to type a URL or a token into. Driven 2026-08-27: typing
  // `github` offered one field; typing `custom_mcp` offered three.
  //
  // ⚠ AND IT IS WHY SC#3 PASSED WHILE BEING FALSE — verification confirmed the Popular row
  // RENDERED and never clicked through to a form. Rendering a card is not connecting a service.
  //
  // Keyed on SHAPE, adding a Popular service now costs a catalog row instead of a code branch,
  // which is exactly what migration 127's `service_id` COMMENT already promises.
  //
  // ⚠ `getCuratedServiceEntry`, NOT `getServiceCatalogEntry`. The total lookup synthesizes a
  // fallback entry carrying `markKey: "mcp"` for ANY unknown identity, so keyed on it every
  // uncurated `service_id` would become an MCP row and the `"service"` shape would cease to
  // exist. A MISS must still fall through to arm 3 — that is CONN-08's whole row.
  const curated = getCuratedServiceEntry(serviceId)
  if (curated?.markKey === "mcp") return "mcp"

  // 3 · An identity nothing knows about names a service and no way to reach it yet. A real
  //     shape, not an error state — Phase 215's OAuth is what gives it a way through.
  return "service"
}

/**
 * On EDIT the service is STATIC TEXT, never a control.
 *
 * ⚠ EDITING A CONNECTION'S IDENTITY IS CONN-07, AND PHASE 212 OWNS IT. Plan 211-02
 * deliberately left `ConnectorConnectionUpdate` without a `service_id` field, so a control
 * here would compose a body the model silently discards — a change that appears to work and
 * does not. The same reasoning the shipped note carried about the capability, one axis over:
 * the field set and the stored credential both hang off it.
 */
export const SERVICE_LOCKED_NOTE =
  "The service cannot be changed after it is created — it would orphan both the saved facts and the stored credential. Add a new connection instead."

/**
 * Save is off until this reason is gone (the `"service"` shape only).
 *
 * ⚠ A DISABLED SAVE IS KINDER THAN A 422, and that is the whole of this predicate's job. The
 * server's `ServiceId` is `min_length=1` plus an `AfterValidator` that strips and rejects
 * blank, and the database's `connector_connections_has_a_service_identity` refuses a blank
 * `btrim` again underneath it — so a blank identity is a certain refusal, and saying so here
 * costs nothing. Do not describe this as the gate.
 */
export const SERVICE_SAVE_DISABLED_REASON =
  "Save is off until this connection has a name and names a service. Both are asked for above."

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
/**
 * The NEUTRAL terminal for the panel's `secretLabel` ladder (206.1, SC#4 extended).
 *
 * ⚠ IT EXISTS SO THAT LADDER HAS SOMETHING TRUE TO END WITH. Every other arm names a specific
 * vendor's own word — `App password` / `API token` / `Bot token` / `Access token` — and a
 * trailing arm that is also the fallback hands an UNRECOGNISED shape one of those four, which
 * is the `destinationFactsOf` defect wearing a label. `Credential` claims nothing about which
 * vendor or which mechanism; it is also the word the table's own column header already uses,
 * so a person meets one noun rather than two.
 *
 * ⚠ It is not offered anywhere a person can reach today — no shipped shape resolves to it.
 * That is the point: it is what a FUTURE shape gets before anyone has written its label.
 */
export const FIELD_SECRET_LABEL_NEUTRAL = "Credential"

export const MCP_SAVE_DISABLED_REASON =
  "Save is off until the server address starts with https://. This form refuses it here; the server refuses it again before anything is sent."

/** The field COUNT per SHAPE, as data rather than as prose, so the suite walks the same closed
 *  set the panel renders (§3b: 4 / 5 / 3, plus 206.1's 3 for MCP — asserted, so an extra field
 *  fails loudly — T-190-17-SCOPE).
 *  ⚠ TOTAL over `ConnectionShape`: a member added without a bound count is a TYPE ERROR
 *  here rather than an unasserted field set discovered in a browser. **That rule fired in
 *  Phase 211 exactly as written**, and `service` below is the fifth member it demanded.
 *
 *  ⚠ `service: 1` IS NOT A TYPO, AND IT COUNTS WHAT IT SAYS. These are `connection-field`
 *  nodes. The service control lives in its OWN always-present slot — the one the three-verb
 *  chooser occupied, which was likewise never a `connection-field` — so the service shape
 *  binds exactly one: the Name. There is no credential field, because an identified row with
 *  no reachable path has nothing to authenticate with until OAuth lands in Phase 215, and a
 *  password box offered for a credential that cannot yet be used is a lie the DOM holds. */
export const FIELD_COUNTS: Record<ConnectionShape, number> = {
  send_email: 4,
  create_ticket: 5,
  post_message: 3,
  mcp: 3,
  service: 1,
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
 *
 * ── PHASE 211 ADDS `"service"`, AND IT IS THE THIRD SHAPE RATHER THAN A FIFTH VERB ──
 * A connection that names a SERVICE and no way to reach it yet: no capability, no endpoint,
 * no credential. It is CONN-08's row, and until migration 127 the database refused to store
 * one at all (mig 126's `CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)`).
 * ⚠ It is where an UNKNOWN identity lands, which is why `shapeForService` is total: a shape
 * that renders honestly is strictly better than an error state for a service we have simply
 * not curated yet. `EMPTY_DRAFT` starts here, so the create form has no capability default —
 * *a default is not a way through a gate*.
 */
export type ConnectionShape = ConnectorCapability | "mcp" | "service"

/**
 * Everything the form holds, flat and all-string.
 *
 * FLAT ON PURPOSE: the 🔒 footer must update AS YOU TYPE and must be built from PARTS
 * DURING RENDER, never from state (`ProviderPicker.tsx:159-165`'s `footerParts` idiom). A
 * derived footer held in state is a footer that can disagree with the field above it, and
 * on this surface that disagreement is the whole threat (T-190-17-DEST).
 */
export interface ConnectionDraft {
  /**
   * ⚠ PHASE 211 — THIS IS NOW A **DERIVED** FIELD, NEVER A CHOSEN ONE, and that distinction
   * is what keeps the docblock above's rejection of alternative (a) intact.
   *
   * `serviceId` is the connection's IDENTITY (what a person supplies); `capability` is the
   * FIELD SET that follows from it (what the form renders). They are two different facts, so
   * this is not the "separate `shape` field beside `capability`" that (a) rejected — the two
   * cannot disagree about the same thing because they are not about the same thing.
   *
   * It is recomputed by `shapeForService` at exactly ONE derivation site in the panel, which
   * both the service field and the endpoint field call. Nothing else assigns it in create
   * mode. On EDIT it is still seeded from the ROW by `draftFromConnection`, which is a
   * positive fact about a stored connection rather than a derivation from a keystroke.
   */
  capability: ConnectionShape
  /**
   * Phase 211 (D-211-01) — the SERVICE this connection reaches, as typed. FREE TEXT, and it
   * must never become a union: a closed set here would be migration 116's `capability`
   * mistake moved to a nicer axis (SEED-207). Flat and all-string like every other field.
   */
  serviceId: string
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
  // ⚠ IT USED TO READ `send_email`, AND THAT WAS THE DEFAULT SC#1 EXISTS TO KILL. A create
  // form that starts pointed at one of the three verbs is a form that can submit a capability
  // nobody chose — *a default is not a way through a gate* (`phase_types.py`'s preamble
  // records the same defect from the other end). It now starts in the shape that asserts
  // nothing: an identity has not been named yet, so no field set is claimed.
  capability: "service",
  serviceId: "",
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
    // ⚠ PHASE 211 — READ VERBATIM OFF THE ROW, NEVER DERIVED FROM THE URL OR THE CAPABILITY.
    // D-211-01 rejected URL-derived identity outright (it breaks for two connections to the
    // same service, and for a generic SMTP host). Migration 127 derives from a host ONCE, for
    // rows that predate the column, and nothing downstream re-derives — so a row whose
    // identity disagrees with its endpoint still reads back its own stored value.
    serviceId: connection.service_id,
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
 * The HOST of a typed MCP server URL — the fact a refusal is about (206.1).
 *
 * ⚠ NO URL PARSER, DELIBERATELY. A half-typed value must still yield SOMETHING true rather
 * than throw while a person is mid-keystroke, and the raw string is the truest thing available
 * when it cannot be split. This is the same split `connectionsCopy.destinationFactsOf`
 * performs for the ROW — one derivation, two surfaces, exactly the relationship these two copy
 * modules already have for every other reading on this page.
 */
export function mcpHostOf(rawUrl: string): string {
  const url = rawUrl.trim()
  if (!url) return ""
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0] || url
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
  // ⚠ PHASE 211 — THE SERVICE ARM NAMES ITS OWN CONDITION, exactly like its four siblings,
  // rather than leaning on the neutral terminal below. The two produce the same object today;
  // what differs is that this one is a STATEMENT (an identified row with no reachable path
  // asserts nothing about a destination) while the terminal is a DEGRADATION (this shape is
  // not one I know). Collapsing them would make CONN-08's row indistinguishable from a bug.
  if (draft.capability === "service") {
    return {}
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

  // ⚠ PHASE 211 — THE SERVICE ARM, NAMED. A row that identifies a service and no way to reach
  // it has NO destination, and that is a fact rather than a gap: the footer says so in the
  // same words it uses before a person has typed anything, because both are honestly "not yet".
  // It is spelled out rather than left to the terminal below for the same reason every other
  // arm is — a positional fallback is how `destinationFactsOf` came to show an MCP connection
  // sending to Slack's API host on a live screen (206.1 / commit `147f3c57`).
  if (draft.capability === "service") {
    return {
      destination: FOOTER_NOTHING_YET,
      tags: [],
      detail: null,
      refusedReason: null,
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

/**
 * Does this draft carry the facts its shape needs before Save is worth offering?
 *
 * ⚠ SCOPE, STATED SO IT IS NOT MISTAKEN FOR A VALIDATOR. This is the CLIENT'S COURTESY and
 * never the boundary — the server validates every shape again, and the database validates two
 * of them a third time. It exists so a person is not handed a 422 for a fact the form could
 * see was missing, and for no other reason.
 *
 * ⚠ THE THREE CAPABILITY SHAPES ARE DELIBERATELY UNGATED, byte-for-byte as shipped. Adding a
 * completeness gate to them would be a behaviour change with no defect behind it, in a phase
 * whose whole point is to move ONE axis; their refusals already arrive through §4b's machinery
 * with a cause a person can read.
 */
export function draftIsSavable(draft: ConnectionDraft): boolean {
  if (draft.capability === "service") {
    // CONN-08's row: an identity and a name, and nothing else. No secret, no config.
    // ⚠ TRIMMED, because `'   '` is a PRESENT value that this form would happily send and
    // that the database's `btrim(service_id) <> ''` refuses — the gap between "non-empty
    // string" and "non-blank string" is exactly where a 500 lives instead of a 422.
    return draft.name.trim() !== "" && draft.serviceId.trim() !== ""
  }
  if (draft.capability === "mcp") {
    // The shipped courtesy, unchanged and stated in one place rather than two: Save is off
    // until the address is TLS-shaped. `MCP_SAVE_DISABLED_REASON` is the sentence that says so.
    return draft.mcpServerUrl.trim().toLowerCase().startsWith("https://")
  }
  return true
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 212 (D-4b) — REFRESHING A SAVED CONNECTION'S ACTION LIST
//
// ⚠ THE OPERATOR FOUND THIS BY DRIVING, AFTER D-4 WAS ALREADY FIXED: *"for the old
// connections like JIRA and email and slack it does not show discover tools, it is only
// showing check credentials."* They were right, and it is the SAME defect family as D-4 — a
// working endpoint with no button on it. `discover_connection_tools` grew a CAPABILITY arm in
// Phase 211 that re-reads the adapter's own static descriptor with NO network call, precisely
// so a row saved before an adapter's `INPUT_SCHEMA` changed can self-heal in one click. The
// control for it was never drawn, so the arm has never been reachable from the UI.
//
// ⚠ THE TWO CONTROLS DO DIFFERENT THINGS AND THE COPY MUST NOT BLUR THEM. `Check credentials`
// contacts the vendor with the stored secret and writes a verdict. This one asks *what can
// this connection DO* — over the network for MCP, from a local descriptor for a capability.
// A capability refresh contacts nothing, so its label must not promise a round trip.
// ═══════════════════════════════════════════════════════════════════════════════════════

export const REFRESH_ACTIONS_LABEL = "Refresh actions"
export const REFRESH_ACTIONS_BUSY = "Refreshing..."

/** Why the control is here at all, on a shape that contacts nothing. */
export const REFRESH_ACTIONS_HELP =
  "Re-reads what this connection can do. It contacts nothing and sends nothing — the list comes from this app's own description of the service."

/** ⚠ A CAPABILITY ROW'S ACTIONS ARE NOT GRANTABLE HERE, AND SAYING SO IS THE HONEST HALF.
 *  `handleSave` writes `tool_grants` only on the `mcp` shape, so rendering a "Granted" checkbox
 *  beside a capability action would offer a switch Save does not persist — the 185 rule that a
 *  write affordance unable to act is REMOVED, not disabled. Reachability, not permission, is
 *  what this list reports for these shapes. */
export const REFRESH_ACTIONS_NOT_GRANTABLE =
  "These are the actions this service publishes. Which of them a workflow step may use is decided at the step, not here."

/** The LAST-RESORT discovery failure sentence, for a thrown value that is not an `Error`.
 *
 *  ⚠ IT MUST NOT NAME A SERVER. It replaced *"Failed to discover tools from MCP server"* on a
 *  handler that now serves three shapes — a capability refresh contacts NOTHING, so naming an
 *  MCP server there sends the reader hunting an outage that does not exist. Both API clients
 *  now carry the server's own words, so this is genuinely a last resort rather than the string
 *  operators used to see. */
export const DISCOVER_FAILED_FALLBACK =
  "Could not read this connection's actions. Nothing was changed."
