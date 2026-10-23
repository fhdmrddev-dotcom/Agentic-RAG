/**
 * Phase 281 (FIX-10, folding SEED-221) — THE DESCRIBE REFUSAL TABLE.
 *
 * ── WHAT THIS FILE IS ────────────────────────────────────────────────────────────────────
 * The ONE place a describe-door refusal code becomes words (D-11). `POST /workflows/generate`
 * answers a refused draft with `{ ok: false, error: <code>, reason_code?, detail? }`. Before 281
 * the hook stored `error` verbatim and the Builder page printed it after a dash, so an author read
 * `connection_not_allowed` — a machine code — as the only explanation of why nothing was drafted.
 * Now the hook stores a KEY (`refusalKey`), and the page asks this table for one plain sentence
 * plus one next step (`describeRefusal`). The raw code and the server's `detail` (which carries
 * the step slug) are kept, but only for the app-wide technical-names reveal (D-12) — the same
 * two-audience rule the canvas already follows (sketch-findings `node-vocabulary-and-reveal.md`).
 *
 * ⚠ IT IS A LEAF BESIDE `doorVocabulary.ts`, NOT GROWTH OF IT (D-22). That module is a G-5 hot
 * file and its governed-id count is pinned by two suites; adding seven rows there would move both
 * pins for words that are not door words. This file imports the ONE door word it needs.
 *
 * ── WHY EACH SENTENCE IS THE SENTENCE IT IS ──────────────────────────────────────────────
 * • `no_authoring_model` — the drafting model is ENV-ONLY (`Settings.harness_authoring_model`,
 *   `backend/app/config.py:1510`). No settings page holds it, for any role. D-14's first draft
 *   said "choose one in Settings", which would have sent a member to a door that does not exist
 *   (T-281-10), so D-24 replaced it with asking whoever runs the workspace.
 * • `connection_not_allowed` has THREE situations (D-13), distinguished by the server's additive
 *   `reason_code`:
 *     – no service chosen: the author ticked nothing, and a step acts outside the app. The picker
 *       lives on the PREVIOUS screen (the describe door), so the next step says "go back", and it
 *       names the picker by its real label, IMPORTED as `SERVICES_LABEL` — never retyped (the
 *       D-24(a) copy fence sweeps this file to hold that).
 *     – service not allowed: the step names a service the author did not tick. The allowed set
 *       is the author's OWN ticks, so D-14's "or ask an admin" named the wrong door; the polish
 *       sends them back to tick it, or to describe the step without it.
 *     – action not allowed: the service is ticked but the action is not granted on it.
 *     – no / unknown sub-reason (a pre-281 server, or a future one): a general sentence that is
 *       still true of all three, pointing at the same picker.
 * • `could_not_generate` / `grounding_failed` — the model's fault, not the author's, so the next
 *   step is to try again or say more. `grounding_failed` is the fourth code D-24 added: the draft
 *   named a tool, skill or folder the workflow cannot use.
 * • No sentence promises anything unowned: no "coming soon", no "later" (run-honesty never-say).
 *
 * ── THE CATCH ARM (D-24) ─────────────────────────────────────────────────────────────────
 * A request that fails before a body is read (a non-OK status) throws in `generateWorkflow`, and
 * its message may be a real server SENTENCE — the entitlement refusal ("Your plan doesn't
 * include …") is the case that matters. 281-REVIEW WR-03: that sentence arrives TYPED
 * (`EntitlementRefusalError`); the hook stores it under `ENTITLEMENT_REFUSED_KEY` and this table
 * renders it AS IS. Every OTHER throw (`Failed to fetch`, `… (status 502)`) is stored under
 * `REQUEST_FAILED_KEY` and reads the fallback sentence, its raw text only under the reveal.
 *
 * ── WHAT THE PAGE DOES WITH THE RESULT ───────────────────────────────────────────────────
 * `sentence` and `next` always render. `technical` (the key, its two parts joined by " · ") and
 * `technicalDetail` (the server's own text) render small, in mono, only when technical names are
 * on. Everything renders as React text children; nothing here is ever HTML.
 */
import { SERVICES_LABEL } from "@/components/workflows/doorVocabulary"

/** Every key this table words: the four server codes, plus their `reason_code` sub-reasons. */
export type DescribeRefusalKey =
  | "connection_not_allowed"
  | "connection_not_allowed:no_service_chosen"
  | "connection_not_allowed:service_not_allowed"
  | "connection_not_allowed:action_not_allowed"
  | "no_authoring_model"
  | "could_not_generate"
  | "could_not_generate:grounding_unavailable"
  | "could_not_generate:removed_powers_broke_draft"
  | "grounding_failed"

/** One plain sentence and one next step — the whole of what an author reads (D-11). */
export interface RefusalWords {
  sentence: string
  next: string
}

// ⚠ ADDING A CODE IS A COMPILE ERROR until REFUSAL_FOR_KEY gains its entry
export const REFUSAL_FOR_KEY: Record<DescribeRefusalKey, RefusalWords> = {
  "connection_not_allowed:no_service_chosen": {
    sentence: "This step acts outside the app, but no service is chosen for this workflow.",
    next: `Go back, tick a service under “${SERVICES_LABEL}”, then draft again.`,
  },
  "connection_not_allowed:service_not_allowed": {
    sentence: "This step uses a connected service this workflow isn't allowed to use.",
    next: `Go back and tick that service under “${SERVICES_LABEL}”, or describe the step without it.`,
  },
  "connection_not_allowed:action_not_allowed": {
    sentence: "That service doesn't allow the action this step needs.",
    next: "Describe the step with a different action, or choose a different service.",
  },
  connection_not_allowed: {
    sentence: "This step uses a connected service in a way this workflow doesn't allow.",
    next: `Go back and check the services ticked under “${SERVICES_LABEL}”, then draft again.`,
  },
  no_authoring_model: {
    sentence: "No model is set up for drafting workflows.",
    next: "Ask whoever runs this workspace to set up a drafting model.",
  },
  could_not_generate: {
    sentence: "The model couldn't produce a usable draft.",
    next: "Try again, or describe the work in more detail.",
  },
  // 291-05 (D-20 / SEED-133 / SEED-221) — the degraded-registry refusal 291-02 returns BEFORE
  // any provider call. It is about us, not the model, so it must not read the row above.
  "could_not_generate:grounding_unavailable": {
    sentence: "We couldn't read your folders, skills or tools just now, so the draft wasn't written.",
    next: "Try again in a moment.",
  },
  // 291-06 (WR-08) — the powers guard's own refusal: removing actions only the author's
  // description could add left a draft that cannot run. The two halves are the server's words,
  // backend/app/services/describe_draft_guards.py:_BROKE_DRAFT_DETAIL, split at its last
  // sentence (UI-SPEC: render the server's sentence verbatim). Without this row the author
  // read the generic sentence above, which blames the model for what the guard did.
  "could_not_generate:removed_powers_broke_draft": {
    sentence:
      "Your attached files asked for actions only your description can add. Removing them left a workflow that cannot run, so no draft was made.",
    next: "Describe the steps you want and try again.",
  },
  grounding_failed: {
    sentence: "The draft pointed at a tool, skill or folder this workflow can't use.",
    next: "Try again, or describe the work in more detail.",
  },
}

/** What an unknown code reads as. Never the code itself — that stays behind the reveal. */
export const REFUSAL_FALLBACK: RefusalWords = {
  sentence: "Something stopped the draft from being written.",
  next: "Try again.",
}

/** A CLIENT-ONLY key for the hook's catch arm (a thrown request). Never a server code. */
export const REQUEST_FAILED_KEY = "request_failed"

/** 281-REVIEW WR-03: a CLIENT-ONLY key for a TYPED entitlement refusal
 *  (`EntitlementRefusalError`) — the one thrown message the server wrote for a person. */
export const ENTITLEMENT_REFUSED_KEY = "entitlement_refused"

/** 291-06 (CR-02): a CLIENT-ONLY key for an attached form the generate body cannot carry
 *  (a cap the server would refuse). The hook stops the draft BEFORE any call, rather than
 *  dropping the form and drafting blind. */
export const FORM_NOT_SENDABLE_KEY = "form_not_sendable"

/** Generic on purpose: true for every cap that can still trip (field count, option count,
 *  total options, an option or key over 200 characters, `{ } < >` in a field name). The cap
 *  itself is the hook's detail, shown only under the technical-names reveal. */
export const FORM_NOT_SENDABLE_WORDS: RefusalWords = {
  sentence: "This form can't be sent to the drafter as it is, so no draft was made.",
  next: "Remove the form to draft from your description alone, or attach a different copy of the form.",
}

/** The key the hook stores: the server code, joined to its additive sub-reason when present. */
export function refusalKey(code: string, reasonCode?: string | null): string {
  return reasonCode ? `${code}:${reasonCode}` : code
}

/** The resolved words, plus what the technical-names reveal may show. */
export interface DescribedRefusal extends RefusalWords {
  technical: string | null
  technicalDetail: string | null
}

const isKnownKey = (key: string): key is DescribeRefusalKey =>
  Object.prototype.hasOwnProperty.call(REFUSAL_FOR_KEY, key)

/** The key as the reveal shows it: its two parts joined by a middle dot. */
const technicalOf = (key: string): string => key.split(":").join(" · ")

/** Turn a stored key (and the server's detail) into what the describe door renders. Total. */
export function describeRefusal(
  key: string | null | undefined,
  detail?: string | null,
): DescribedRefusal {
  const technicalDetail = detail ? detail : null
  if (!key) {
    return { ...REFUSAL_FALLBACK, technical: null, technicalDetail }
  }
  if (key === ENTITLEMENT_REFUSED_KEY) {
    // D-24: a sentence the server already wrote for a person renders as is.
    const sentence = detail && detail.trim() ? detail : REFUSAL_FALLBACK.sentence
    return { sentence, next: REFUSAL_FALLBACK.next, technical: null, technicalDetail: null }
  }
  if (key === REQUEST_FAILED_KEY) {
    // 281-REVIEW WR-03: any OTHER thrown text (`Failed to fetch`, a status line) is not words
    // for a person — the table's sentence renders, and the raw text only under the reveal.
    return { ...REFUSAL_FALLBACK, technical: null, technicalDetail }
  }
  if (key === FORM_NOT_SENDABLE_KEY) {
    // 291-06 (CR-02): the visible words stay true whichever cap tripped; the cap is reveal-only.
    return { ...FORM_NOT_SENDABLE_WORDS, technical: null, technicalDetail }
  }
  if (isKnownKey(key)) {
    return { ...REFUSAL_FOR_KEY[key], technical: technicalOf(key), technicalDetail }
  }
  // A known code with a sub-reason this client has not learned yet: the code-only words.
  const code = key.split(":")[0]
  if (isKnownKey(code)) {
    return { ...REFUSAL_FOR_KEY[code], technical: technicalOf(key), technicalDetail }
  }
  return { ...REFUSAL_FALLBACK, technical: technicalOf(key), technicalDetail }
}
