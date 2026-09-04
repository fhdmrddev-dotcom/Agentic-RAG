/**
 * ⭐ THE GOVERNED VOCABULARY — sketch 216, Phase 214 (STEP-04 / STEP-05, SC#4).
 * Closes `SEED-206` and `BUG-260826-05`; carries D-214-14 / -15 / -16 / -17.
 *
 * ⚠ MOST OF THIS SURFACE IS *NOT* COPY — it is a MARK plus TWO NAMES the system already holds.
 * That is the point of D-214-17: *"the mark is a REUSE, not a new decision."* The table below
 * is deliberately short, because a step's identity should be **data the system resolved**, never
 * a sentence a component invented.
 *
 * It ports as `frontend/src/components/workflows/stepIdentityVocabulary.ts`.
 */

const COPY = {
  // ── §1 · THE STEP'S IDENTITY — ONE SHAPE, EVERY SURFACE (D-214-16) ────────────────────
  //
  // ⭐ SC#4: *"A run's spine and run surfaces show the service's mark and the action's real
  // name."* Never "external action", never a capability id, never a tool slug on its own.
  //
  // ⚠ THE SEPARATOR IS A MIDDLE DOT, NOT A DASH OR A SLASH. It is the same separator the
  // shipped canvas node subtitle already uses (`Send an email · Aether Mail`), so the identity
  // reads identically at the four sizes it appears in.
  STEP_IDENTITY: (action, service) => `${action} · ${service}`,

  /**
   * ⚠ WHAT IS SAID WHEN THE SERVICE CANNOT BE RESOLVED — and it is the ACTION ALONE, never a
   * placeholder service. D-214-14 preserves the existing rule verbatim: *"never draw a name the
   * system cannot know."* A connection that was deleted, or a row whose display name is empty,
   * gets the action and the neutral mark. It does NOT get "Unknown service".
   */
  STEP_IDENTITY_SERVICE_UNKNOWN: (action) => action,

  // ── §2 · THE FAILED STEP SAYS *ITS OWN* REASON (STEP-05 · `BUG-260826-05`) ────────────
  //
  // ⚠ THE REASON IS THE ADAPTER'S OWN WORDS AND IS NOT AUTHORED HERE. What IS authored is the
  // label above it, and the sentinel below it.
  FAILED_REASON_LABEL: "Why it stopped",

  /**
   * ⚠ THE SHIPPED SENTINEL, CHARACTER FOR CHARACTER (`PhaseCard.tsx:253`). It is an HONESTY
   * MECHANISM, and D-214-18 is explicit about the risk: **firing it when the reason IS known
   * trains readers to distrust it.** So it is kept verbatim and its condition is narrowed, never
   * the other way round.
   */
  FAILED_REASON_UNKNOWN:
    "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success.",

  // ── §3 · THE APPROVAL PAUSE (D-214-15) ────────────────────────────────────────────────
  //
  // ⚠ THIS IS A DEFECT THE PHASE WOULD OTHERWISE CREATE. `_external_action_clause`
  // (`grounding.py:1279-1293`) renders `config.tool_args`. Under D-214-01 `tool_args` holds
  // ONLY THE FIXED VALUES — so an `Ask at launch` or `From an earlier step` argument is not in
  // it, and the pause would **name the constants and silently omit exactly the arguments that
  // vary**. On an approval surface that is worse than showing nothing.
  //
  // So the sentence is composed AFTER RESOLUTION, from what will actually leave.
  ASK_PAUSED: "Paused — waiting for you.",
  ASK_NOTHING_SENT: "Nothing has been sent yet.",
  /** Composed from the RESOLVED object, never from `tool_args`. */
  ASK_WILL_RUN: (action, service) => `It will run ${action} through ${service}.`,
  ASK_WILL_SEND: "What it will send",
  ASK_APPROVE: "Send it",
  ASK_DECLINE: "Do not run it",

  /**
   * ⭐ D-213-14 IS UNCHANGED AND IS SAID OUT LOUD RATHER THAN LEFT IMPLICIT: the arguments are
   * shown ONCE, in the moment, and are NEVER written to the audit ledger. *"Showing a person
   * what is about to leave is the whole point of the pause; writing it into a queryable ledger
   * forever is a different act."* The receipt keeps carrying capability, connection id, host and
   * tool name — and never the body.
   */
  ASK_NOT_RECORDED: "Shown here only. The record keeps what ran, not what it said.",

  // ── §4 · THE RUN RECEIPT'S OWN LINE ───────────────────────────────────────────────────
  RECEIPT_SENT: (action, service) => `Ran ${action} through ${service}.`,
  RECEIPT_REFUSED: (action, service) => `Did not run ${action} through ${service}.`,
}

if (typeof module !== "undefined") module.exports = { COPY }
