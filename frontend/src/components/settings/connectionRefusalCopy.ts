/**
 * Phase 190-18 (CONN-02 / CONN-03, UI-SPEC §4a–§4d, §5b, §5c, §11d) — the refusal copy, the
 * check moments, and every sentence this surface is allowed to say about a security decision.
 *
 * ── WHY A THIRD SIBLING `*Copy.ts` ──
 * The measured reason `connectionsCopy.ts` and `connectionFormCopy.ts` each state in their own
 * headers, taken a third time rather than re-discovered: a `.tsx` exporting components AND
 * constants trips `react-refresh/only-export-components`, which plan 190-12 measured at
 * `eslint src/components/workflows/` 5 → 10. Plans 190-16 and 190-17 both held
 * `eslint src/components/settings/` at 5 → 5 with a sibling module. Measured at HEAD before
 * this file existed: **5 errors, all pre-existing** (`ProviderPicker.tsx` ×3,
 * `ModelPillRow.tsx` ×2). This file keeps that number where it is.
 *
 * ── THE ONE RULE THAT MATTERS MOST HERE (§4c) ──
 * ⚠ **NO SENTENCE ON THIS SURFACE IS IMPROVISED AT A CALL SITE.** Sketch 156 drew ONE refusal
 * (a private address, on SMTP). `backend/app/security/egress.py` refuses for **six** reasons
 * across three capabilities, and there are three further outcome shapes §4d keeps apart. Every
 * one of them is authored here, ONCE, as an exported identifier asserted by CHARACTER IDENTITY
 * in the suite (the `GovernanceSection.tsx:10-17` idiom). A sentence written inline inside JSX
 * is a sentence nobody can test for drift — and on a security surface a drifted sentence is a
 * defect, not a style change.
 *
 * ── WHAT MAY NEVER APPEAR IN ANY STRING BELOW (§4a-1 / D-08) ──
 * The credential, in any form. Not the typed secret, not a stored envelope, not a request
 * body. A refusal that names the secret defeats the guard it is reporting. The audit line
 * every refusal closes with states the discipline the BACKEND enforces, which is why it can
 * be said at all.
 *
 * ── THE AUDIENCE IS AN ORG ADMIN, NOT AN ENGINEER (§4a-2) ──
 * The nine jargon terms §4a bans are fenced by this module's own suite, over the EXPORTS,
 * rather than named here — a fence that greps for a literal is unable to be described using
 * that literal (the 190-15 / 190-17 finding, met a third time and handled the same way). The
 * register to aim at is sketch 156's: *"a private address inside the network this platform
 * runs on."*
 *
 * ── COPY RULE 5 (§11d) AND WHAT IT ACTUALLY GOVERNS ──
 * §11d rule 5, paraphrased so this docblock does not itself spell the literals the suite
 * greps for (the 190-15 finding: a fence that greps for a phrase is unable to be described
 * using that phrase): *no string may use an absolute verb for a guarantee only a CLIENT gate
 * provides — such a sentence must name a SERVER-ENFORCED mechanism, and where only the picker
 * enforces it the sentence says* the picker.
 *
 * So the rule is not a word ban — it is a **claim** ban. The three absolute phrasings §14
 * names appear NOWHERE below; they are spelled once, in the suite's `ABSOLUTE_VERB_FENCE`,
 * which is the only place they belong. §4b's block-9 heading is the one string here carrying
 * a bare absolute, and it is legitimate under the rule as written: it names a
 * **server-enforced** 503 (`api/connectors.py:172`), it is §11d's own copy-table row label for
 * that state, and it is quoted verbatim from an operator-approved sketch. See
 * `190-18-SUMMARY.md` for the measurement.
 */
import type { ConnectorCapability, ConnectorCheckBucket } from "@/lib/api"

// ═══════════════════════════════════════════════════════════════════════════════════════
// 0 · THE CLOSED SET THE GUARD ITSELF DECLARES — and how it is kept honest
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * The six destination-refusal codes `backend/app/security/egress.py` declares
 * (`REFUSAL_REASONS`, lines 77-86) — and which that module guards with its own
 * `len(REFUSAL_REASONS) == 6` assert plus a raise-time membership check.
 *
 * ⚠ THIS IS A SECOND SPELLING OF ONE TRUTH, AND IT IS KEPT MECHANICAL RATHER THAN REMEMBERED.
 * A browser is unable to import a Python module, so the agreement is asserted two ways:
 *
 *   1. **here, at module scope** — `REFUSAL_REASON_BODIES` and `REFUSAL_HEADING_BY_REASON`
 *      must have EXACTLY these keys. A seventh sentence added without a code, or a code added
 *      without a sentence, is an import-time throw rather than an empty block rendered at a
 *      person who is trying to fix something (T-190-18-CODE).
 *   2. **in the suite** — the list below is compared against `egress.py`'s OWN source, read
 *      through the same Vite `?raw` loader `PublishGauntlet.test.tsx:46` already uses to read
 *      the backend. That is the fence that catches the guard growing a seventh code.
 *
 * Neither alone is enough: (1) is internally consistent by construction, and only (2) can see
 * across the language boundary.
 */
export const EGRESS_REFUSAL_REASONS = [
  "address_not_public",
  "scheme_not_tls",
  "host_not_allowed",
  "host_not_ascii",
  "unresolvable",
  "redirected",
] as const

export type EgressRefusalReason = (typeof EGRESS_REFUSAL_REASONS)[number]

/** A tiny closed-key assertion. Throws at IMPORT time, deliberately — the alternative is a
 *  blank refusal block, which is the one failure mode a person meeting a refusal is least able
 *  to act on. */
function assertKeys(name: string, actual: readonly string[], expected: readonly string[]): void {
  const a = [...actual].sort().join(",")
  const b = [...expected].sort().join(",")
  if (a !== b) {
    throw new Error(
      `190-18: ${name} must carry exactly the codes egress.py declares. ` +
        `Got [${a}], expected [${b}]. Add the sentence before adding the code.`,
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · §4d — REFUSED ≠ UNREACHABLE ≠ REJECTED. Three glyphs, three headings, three next steps
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ THE SINGLE MOST LIKELY COPY DEFECT ON THIS SURFACE IS FLATTENING THESE THREE.
 *
 * They are separate states with separate causes and separate next actions:
 *
 *   **refused**     — WE declined to open the socket, for a security property. Our decision.
 *   **unreachable** — the address was allowed and nothing answered on it. The network.
 *   **rejected**    — we reached it and IT said no. Their decision.
 *
 * Collapsing them into one *"could not connect"* trains a person to retry a security decision,
 * which is exactly what §4a-3 forbids. §14 states the two forbidden swaps as failure
 * conditions in their own right, and the suite asserts both on rendered output:
 * **a refusal may never render the word "failed", and an unreachable host may never render the
 * word "refused"** — those two swaps make a security decision read as a bug and a bug read as
 * a policy.
 *
 * `nextStep` is `null` for `rejected` on purpose: its next step IS the vendor's verbatim words
 * (§5b), which no client string may paraphrase (071-A).
 */
export interface RefusalHeading {
  glyph: string
  heading: string
  nextStep: string | null
}

export const REFUSAL_HEADINGS: Record<ConnectorCheckBucket, RefusalHeading> = {
  refused: {
    glyph: "⛔",
    heading: "That address was refused before anything was sent",
    nextStep: "Correct the host and try again.",
  },
  unreachable: {
    glyph: "✕",
    heading: "That host did not answer",
    nextStep:
      "The address is allowed — nothing answered on it. Check the host and port, then check again.",
  },
  rejected: {
    glyph: "✕",
    heading: "The host rejected this credential",
    nextStep: null,
  },
}

/**
 * §4c's one heading exception, and U-05's whole point.
 *
 * `unresolvable` is DELIBERATELY worded as a lookup failure rather than as a security refusal:
 * it is the one row where the person genuinely made a typo, and calling it a refusal would
 * train the distrust §4a-3 forbids. It still arrives in the `refused` BUCKET (the guard raises
 * it), so it keeps the bucket's ⛔ glyph — the glyph is the bucket's, the heading and the body
 * are the row's.
 */
export const REFUSAL_LOOKUP_HEADING = "That address could not be looked up"

export const REFUSAL_HEADING_BY_REASON: Record<EgressRefusalReason, string> = {
  address_not_public: REFUSAL_HEADINGS.refused.heading,
  scheme_not_tls: REFUSAL_HEADINGS.refused.heading,
  host_not_allowed: REFUSAL_HEADINGS.refused.heading,
  host_not_ascii: REFUSAL_HEADINGS.refused.heading,
  unresolvable: REFUSAL_LOOKUP_HEADING,
  redirected: REFUSAL_HEADINGS.refused.heading,
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · §4c — THE CLOSED SIX-ROW REASON TABLE. The part sketch 156 did not draw
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * What a refusal sentence is allowed to interpolate.
 *
 * ⚠ `ip` AND `allowed` ARE OPTIONAL, AND THAT IS A MEASUREMENT RATHER THAN A CONVENIENCE.
 * §4c's `address_not_public` row interpolates `{ip}` and its `host_not_allowed` row
 * interpolates `{allowed}`. The guard knows both (`EgressRefused.ip`;
 * `egress.ALLOWED_HOST_SUFFIXES`) — but the WIRE SHAPE that reaches this browser carries
 * neither: plan 190-15 added `reason_code` to `ConnectorCheckResponse` and named the refused
 * `ip` and the permitted-host list as DELIBERATELY not added (its deviation 3, under D-32).
 *
 * So each sentence has a measured shorter form for the fact it does not have, and §4c's
 * literal wording renders the moment the value is supplied. **The alternative — re-typing the
 * permitted-host list in the client — is what §4c forbids in the same breath as it names it
 * (*"rendered from the guard's own list, never re-typed in the client"*), because a second
 * copy of a security list is a second copy that goes stale silently.**
 *
 * REVERSAL: add `ip` and `allowed` to `ConnectorCheckResponse` (backend) and to
 * `ConnectorCheckResult` (`api.ts`), then pass them here — no sentence below changes.
 */
export interface RefusalParts {
  host: string
  ip?: string | null
  vendor?: string | null
  capabilityWord: string
  allowed?: string | null
}

/** §4c's substitution set: `email` · `ticket` · `message` — never the wire id. A person
 *  configuring a mailbox is not helped by reading `send_email`. */
export function capabilityWordOf(capability: ConnectorCapability | string): string {
  if (capability === "send_email") return "email"
  if (capability === "create_ticket") return "ticket"
  if (capability === "post_message") return "message"
  return "connection"
}

/**
 * The vendor a capability speaks to, where naming one is TRUE.
 *
 * `send_email` returns `null` on purpose and it is not an omission: `egress.py:242-254` gives
 * `post_message` and `create_ticket` fixed host rules, while `send_email`'s permitted host is
 * **the one the org itself configured** (`_CALLER`). There is no vendor to name, so the
 * sentence for it says so instead of inventing one.
 */
export function vendorOf(capability: ConnectorCapability | string): string | null {
  if (capability === "create_ticket") return "Jira"
  if (capability === "post_message") return "Slack"
  return null
}

/**
 * THE CLOSED SIX-ROW TABLE (§4c), keyed by the guard's OWN reason code.
 *
 * Each value is a template over `RefusalParts`. The executor renders from this map and never
 * from a literal at a call site — that is the whole mechanism, and `REFUSAL_` is the grep that
 * proves the panel obeys it.
 */
export const REFUSAL_REASON_BODIES: Record<
  EgressRefusalReason,
  (parts: RefusalParts) => string
> = {
  /** §4c verbatim when `{ip}` is known. Sketch 156's original refusal, and the register every
   *  other row is written to match. */
  address_not_public: ({ host, ip }) =>
    ip
      ? `${host} resolves to ${ip} — a private address inside the network this platform runs on. Connections may only reach the public internet.`
      : `${host} resolves to a private address inside the network this platform runs on. Connections may only reach the public internet.`,

  /** §4c verbatim. It states the refusal in the same words `FIELD_SMTP_HOST_HELP` states the
   *  rule BEFORE a person can trip it, so meeting it twice reads as one rule, not two. */
  scheme_not_tls: ({ host }) =>
    `${host} was given without encryption. Connections must be encrypted end to end — a plain http:// or smtp:// address is refused, including inside this network.`,

  /** §4c, with the two measured shorter forms described on `RefusalParts`. */
  host_not_allowed: ({ host, vendor, capabilityWord, allowed }) => {
    const first = vendor
      ? `${host} is not a ${vendor} address.`
      : `${host} is not an address this connection is allowed to reach.`
    const second = allowed
      ? `A ${capabilityWord} connection may only send to ${allowed}.`
      : `A ${capabilityWord} connection may only send to the addresses this platform permits for it, which are decided on the server rather than in this form.`
    return `${first} ${second}`
  },

  /** §4c verbatim. The homograph refusal, told as what a person can SEE — two addresses that
   *  look alike — rather than as a character-encoding property. */
  host_not_ascii: ({ host }) =>
    `${host} contains characters that can be made to look like another address. Type the address using plain Latin letters.`,

  /** §4c verbatim, and U-05's exception: worded as a LOOKUP FAILURE, not as a refusal. Its
   *  heading differs for the same reason (`REFUSAL_LOOKUP_HEADING`). */
  unresolvable: ({ host }) =>
    `Nothing on the internet answers to ${host}. Check the spelling — nothing was sent, and your password was never read.`,

  /** §4c verbatim. It states the no-redirect property as the REASSURANCE it actually is: the
   *  address you type is the only address that is ever contacted. */
  redirected: ({ host }) =>
    `${host} answered by pointing somewhere else. Connections follow no redirects, so the address you type is the only address that is ever contacted.`,
}

assertKeys("REFUSAL_REASON_BODIES", Object.keys(REFUSAL_REASON_BODIES), EGRESS_REFUSAL_REASONS)
assertKeys(
  "REFUSAL_HEADING_BY_REASON",
  Object.keys(REFUSAL_HEADING_BY_REASON),
  EGRESS_REFUSAL_REASONS,
)

/**
 * ⚠ D-06, TOLD IN USER-FACING WORDS — and it is NOT optional prose.
 *
 * The n8n CVE inversion is that the guard does not depend on a credential being present: the
 * destination is validated BEFORE the secret is decrypted, so a refused address never causes a
 * credential to be read at all. `test_190_egress_ordering.py` proves the property; this is the
 * one sentence that makes it visible to a human, and the suite asserts it by character
 * identity so it is unable to be trimmed as filler (T-190-18-D06).
 */
export const REFUSAL_ORDERING_LINE =
  "The refusal happened before your password was read, so it was never used and never left this form."

/**
 * §4c: **every row closes with this line, unchanged.**
 *
 * It states the discipline the BACKEND enforces (D-08 — capability, host and reason are
 * recorded; the credential is not), which is the only reason a refusal is allowed to promise
 * anything about what was written down.
 *
 * ⚠ It carries the word *refusal* on every row INCLUDING `unresolvable`, and that is §4c's
 * instruction rather than an oversight: the audit RECORD is a refusal record whatever the
 * sentence above it says. The suite therefore asserts the no-refusal-vocabulary property of
 * the `unresolvable` row against its BODY, not against the whole block.
 */
export const REFUSAL_AUDIT_LINE =
  "Recorded as a refusal: capability, host and reason — never the credential."

/**
 * The honest sentence for a code this table has no row for.
 *
 * T-190-18-CODE's second half. The module-scope assert catches a code added to the guard AND
 * to this file inconsistently; this catches a code added to the guard alone and deployed ahead
 * of the client. Rendering a blank block, or a bare enum with no sentence around it, at a
 * person who is trying to fix something is the failure being avoided — so the code IS shown
 * (it is the exact string an operator needs, the same LANG-01 carve-out `live_connectors`
 * gets) inside a sentence that says what is and is not known.
 */
export function refusalUnknownBody(reasonCode: string | null, host: string): string {
  const where = host ? host : "That address"
  const tail = reasonCode
    ? ` Show an operator this reason, exactly as written: ${reasonCode}`
    : " The server gave no reason code with it."
  return (
    `${where} was refused before anything was sent, and this screen has no wording for the reason the server gave. ` +
    `Nothing was sent, and your password was never read.${tail}`
  )
}

/** The heading for a reason code — the lookup wording for `unresolvable`, the refusal wording
 *  for the other five, and the refusal wording for anything unrecognised. */
export function refusalHeadingFor(reasonCode: string | null): string {
  if (reasonCode && reasonCode in REFUSAL_HEADING_BY_REASON) {
    return REFUSAL_HEADING_BY_REASON[reasonCode as EgressRefusalReason]
  }
  return REFUSAL_HEADINGS.refused.heading
}

/** The body for a reason code — one of §4c's six, or the honest fallback. Never `""`. */
export function refusalBodyFor(reasonCode: string | null, parts: RefusalParts): string {
  if (reasonCode && reasonCode in REFUSAL_REASON_BODIES) {
    return REFUSAL_REASON_BODIES[reasonCode as EgressRefusalReason](parts)
  }
  return refusalUnknownBody(reasonCode, parts.host)
}

/** Is this the code of a DESTINATION refusal (§4c's closed six) rather than a PLATFORM one? */
export function isEgressRefusalReason(reasonCode: string | null): reasonCode is EgressRefusalReason {
  return reasonCode !== null && (EGRESS_REFUSAL_REASONS as readonly string[]).includes(reasonCode)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · §4b — THE OTHER HALF OF THE ASYMMETRY: the refusal a person is unable to fix
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⭐ THE BINDING ASYMMETRY (§4b, 156-A locked):
 *
 *   > **A refusal you can fix leaves the door open; a refusal you are unable to fix closes it.**
 *
 * | | 8 · egress refused | 9 · no encryption key |
 * |---|---|---|
 * | can the person fix it? | **yes** — correct the host | **no** — nothing they type helps |
 * | Save | **stays ENABLED** | **goes DISABLED**, `aria-describedby` → the reason |
 *
 * ⚠ **THIS IS THE ONE PLACE ON THIS WHOLE SURFACE WHERE `disabled` IS RIGHT AND `removed` IS
 * WRONG**, and the distinction is 190-17's hand-off written down: everywhere else a write
 * affordance that is unable to act is REMOVED (the shipped 185 rule, and 190-16's plant C
 * proved `toBeDisabled()` passes on the defect). Here the control is MEANINGFUL — the person
 * filled a valid form and Save would work the moment an operator sets the key — so removing it
 * would hide the very thing the message is about. Its refusal IS the message, wired by
 * `aria-describedby` to real DOM text (§4a-4 / §12 / 142-B: never a `title`).
 */
export const CIPHER_UNAVAILABLE_REASON = "no_encryption_key"

export const CIPHER_UNAVAILABLE_GLYPH = "⛔"

/**
 * §4b block 9's heading, VERBATIM.
 *
 * ⚠ It carries a bare absolute verb, and under §11d copy rule 5 that is legitimate rather than
 * an oversight: the rule bans an absolute **for a guarantee only a client gate provides**, and
 * this one names a SERVER-ENFORCED mechanism — `api/connectors.py:172` answers 503 with
 * `reason_code: no_encryption_key` and writes nothing. §11d's own copy table uses the same
 * verb in its label for this row. The three absolute phrasings §14 actually names appear
 * nowhere in this module and are fenced by the suite's `ABSOLUTE_VERB_FENCE`, which is the one
 * place they are spelled.
 *
 * It is therefore the SINGLE occurrence of that verb in this file — measured, and stated so a
 * later reader meeting it knows it was weighed rather than missed.
 */
export const CIPHER_UNAVAILABLE_HEADING = "This platform cannot store a credential safely yet"

/**
 * §4b block 9's three paragraphs, VERBATIM and in order.
 *
 * They follow the 142-B shape the whole surface uses: **name the cause, name what the refusal
 * COSTS, then name how it is lifted.** The middle paragraph is the one that stops this reading
 * as a shrug — it says which OTHER surface the person will see this on (`external_action`
 * steps keep reading the shipped `Not sent — recorded` string, §11d rule 4: one string, one
 * meaning, never a second phrase for that state).
 */
export const CIPHER_UNAVAILABLE_BLOCK: readonly [string, string, string] = [
  "No encryption key is configured, so a token saved now would sit in the database as readable text — and it would be your organisation's token, not ours.",
  "What this costs you: no connection can be created until it is set, so every external_action step keeps reading “Not sent — recorded”.",
  "To lift it: an operator sets SECRETS_ENCRYPTION_KEY and restarts the backend. Nothing you have typed here is sent anywhere in the meantime.",
]

/** §4b's `aria-describedby` target for the disabled Save. Real DOM text, never a `title`. */
export const CIPHER_UNAVAILABLE_SAVE_DISABLED_REASON =
  "Disabled because no encryption key is configured."

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · §5c — THE THREE CHECK MOMENTS
// ═══════════════════════════════════════════════════════════════════════════════════════

// ── in flight ──
export const CHECK_INFLIGHT_HEADING = "Checking the credential…"

/** §5c verbatim. The second sentence is the one doing the work: a person about to click a
 *  button on a live mail server needs to know, before it runs, that nothing leaves. */
export const CHECK_INFLIGHT_BODY =
  "Asking the host who this token belongs to. No email, ticket or message is sent by this check."

export const CHECK_INFLIGHT_BUTTON = "⟳ Checking…"
export const CHECK_INFLIGHT_FOOTER = "Saved. Nothing is sent by a check."

// ── success ──
export const CHECK_SUCCESS_GLYPH = "✓"

/** §5c verbatim, and load-bearing: the second clause is the whole reason a person is willing
 *  to press this button on a production mailbox. It is only honest because plan 190-15 proved
 *  it per capability at the transport — no `chat.postMessage`, no `POST /rest/api/3/issue`, no
 *  SMTP `DATA` verb, and no request body on any exchange. */
export const CHECK_SUCCESS_HEADLINE = "Credential works — and nothing was sent"

export const CHECK_SUCCESS_FOOTER = "Checked just now · re-checking is always safe."

/**
 * ⭐ THE CLOSED NEGATION TABLE — AND THE REASON IT IS RE-DERIVED RATHER THAN RE-TYPED.
 *
 * §5c says the closing negation is picked from *"the same closed table 189 §9d already ships,
 * never improvised"*. The table 189 ships is
 * `backend/app/services/harness/phase_types.py::_EXTERNAL_ACTION_NEGATION`, and its three
 * values are the ones below.
 *
 * ⚠ **THE `send_email` ROW IS THE ONE TO READ.** Plan 190-18's own task text, UI-SPEC §5c as
 * originally written, and plan 190-15's `<interfaces>` block ALL quoted it as
 * *"No mail was delivered to anyone."* — inside the sentence forbidding improvisation. Plan
 * 190-15 found it by RUNNING the assertion rather than by reading, and corrected the document:
 * production source says **`No email was sent.`**, confirmed independently in
 * `phase_types.py:1700`, `189-UI-SPEC.md:761`, `189-UAT.md:104` (read straight out of
 * `workflow_phases.output`) and `189-SECURITY.md:92`. Shipping the document's version would
 * have given a three-row CLOSED table a fourth sentence — the exact drift the clause exists to
 * prevent, arriving through the clause itself.
 *
 * **Every value below was read out of `_EXTERNAL_ACTION_NEGATION` at HEAD, not typed from any
 * plan or spec**, and the suite pins all three against that source through Vite's `?raw`
 * loader so the next divergence is a RED test rather than a re-reading.
 */
export const CHECK_NEGATION_BY_CAPABILITY: Record<ConnectorCapability, string> = {
  send_email: "No email was sent.",
  create_ticket: "No ticket was created.",
  post_message: "No message was posted.",
}

assertKeys("CHECK_NEGATION_BY_CAPABILITY", Object.keys(CHECK_NEGATION_BY_CAPABILITY), [
  "send_email",
  "create_ticket",
  "post_message",
])

/**
 * §5c's success body, verbatim, closing with the capability's own negation.
 *
 * `identity` is the half that makes a green check mean something — a credential that works for
 * the WRONG account is a distinct failure from one that does not work — so an absent identity
 * degrades the clause rather than printing `null`.
 */
export function checkSuccessBody(params: {
  identity: string | null
  host: string
  port: number | null
  capability: ConnectorCapability
}): string {
  const where = params.port ? `${params.host}:${params.port}` : params.host
  const who = params.identity
    ? `Authenticated as ${params.identity} at ${where}.`
    : `Authenticated at ${where}.`
  return `${who} The check connected, authenticated and disconnected. ${
    CHECK_NEGATION_BY_CAPABILITY[params.capability]
  }`
}

// ── failure: §5b's rejected block ──

/** §5b verbatim. It separates the two things a person confuses at this moment: the address is
 *  fine, the password is not. */
export function checkRejectedReachedLine(host: string, port: number | null): string {
  const where = port ? `${host}:${port}` : host
  return `Reached ${where} and it answered — the address is fine, the password is not.`
}

/**
 * ⭐ §5b's MIDDLE PARAGRAPH — the single most likely regression in this whole section (§14).
 *
 * Sketch 156 moment 6 shipped a sentence promising that the connection is saved but that no
 * step would be permitted to use it until the check passes (quoted in full in §5, and spelled
 * literally only in the suite's `ABSOLUTE_VERB_FENCE`). The backend does not honour that, and
 * the checker's round-1 BLOCKER 2 took **door (b)**: the copy is narrowed to the gates that
 * actually exist rather than the gates hand-waved up to the copy.
 *
 * Each clause maps to exactly ONE shipped mechanism, and neither over-claims:
 *
 * | clause | honoured by |
 * |---|---|
 * | `The picker will not offer it while it is failing` | **Gate 1** — client, `aria-disabled`, inline refusal (§5a) |
 * | `a step already bound to it will fail on the next run rather than pretend` | **run time** — §8a / D-17, the send is attempted and the true outcome reported |
 *
 * ⚠ **Gate 2 validates org and `is_enabled` ONLY** — plan 190-15 asserted that as a POSITIVE
 * test and measured `grep -c "last_check_verdict" phase_types.py` → **0**. So a bind naming a
 * failing connection IS accepted by the server, and any future edit restoring one of the three
 * absolute phrasings (spelled in the suite's `ABSOLUTE_VERB_FENCE`) is the U-07a defect §14
 * names. Reversing to door (a) is a FOUR-edit change recorded verbatim in `190-15-SUMMARY.md`, and no
 * subset of it is legitimate: a gate without the copy under-claims, and the copy without the
 * gate is the §5 defect this phase exists to avoid.
 */
export const CHECK_FAILURE_SENTENCE =
  "The connection is saved. The picker will not offer it while it is failing, and a step already bound to it will fail on the next run rather than pretend."

/** 071-A: the vendor's own words go under a label that SAYS they are verbatim, in `font-mono`,
 *  never paraphrased and never truncated. */
export const CHECK_VERBATIM_LABEL = "what the host said, verbatim"

// ── the check that did not run at all ──

/**
 * A fourth shape, and it is deliberately NOT one of §4d's three.
 *
 * §4d's three are all statements about a DESTINATION. These two are statements about the
 * PLATFORM, and `api/connectors.py:188-226` keeps their codes in a separate space for exactly
 * that reason: *"a person told 'correct the host and try again' about a missing encryption key
 * retries forever."* Wearing one of §4d's headings here would be the same flattening one level
 * up.
 */
export const CHECK_NOT_RUN_GLYPH = "✕"
export const CHECK_NOT_RUN_HEADING = "The check did not run"

export const CHECK_PLATFORM_BODIES: Record<string, string> = {
  connection_disabled:
    "This connection is switched off, so its credential was not checked. Turn it back on, then check it.",
  credential_unreadable:
    "The stored credential for this connection could not be read, so nothing was checked. Replace it to store it again.",
}

/** Never `""`: an unrecognised platform code still gets a sentence, with the server's own code
 *  shown so an operator has the exact string to search for. */
export function checkPlatformBody(reasonCode: string | null): string {
  if (reasonCode && reasonCode in CHECK_PLATFORM_BODIES) return CHECK_PLATFORM_BODIES[reasonCode]
  return reasonCode
    ? `The check did not reach the host, and this screen has no wording for the reason the server gave. Nothing was sent. Show an operator this reason, exactly as written: ${reasonCode}`
    : "The check did not reach the host, and the server gave no reason with it. Nothing was sent. Try again, and tell an operator if it keeps happening."
}

/** Shown in place of the check affordance on a switched-off connection. The button is REMOVED
 *  rather than left to answer 409 — the shipped 185 rule — and this line is why, so its
 *  absence reads as a decision rather than as a missing feature. */
export const CHECK_UNAVAILABLE_DISABLED =
  "Switched off — turn it back on to check its credential."
