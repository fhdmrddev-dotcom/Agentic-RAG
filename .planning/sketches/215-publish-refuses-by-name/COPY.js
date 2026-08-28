/**
 * ⭐ THE GOVERNED VOCABULARY — sketch 215, Phase 214 (STEP-03, SC#3, closes `BUG-260826-02`).
 *
 * ⚠ IT PORTS AS `frontend/src/components/workflows/publishRefusalVocabulary.ts`, beside the
 * shipped `doorVocabulary.ts` whose `DESCRIBE_REFUSAL` is this table's direct precedent —
 * a governed id, character-asserted, NEVER a sentence living inside a component.
 *
 * ── ⚠ THE REFUSAL CONTRACT, IN ONE LINE ──
 * D-214-09: *"Any arm unproved ⇒ refused, naming the step and the argument."*
 * The ROADMAP's own words: ***a refusal is only honest if it names the next action.***
 * So every headline below names **the step, in the author's own words** and **the argument, by
 * the name the author saw on the form** — and every one of them has exactly one way out.
 *
 * ── ⚠ WHAT THIS TABLE DELIBERATELY DOES NOT CONTAIN ──
 * No severity word. No exclamation. No stage name in the headline. No second sentence
 * restating the first. `BUG-260815-06`'s whole complaint is refusals that name a STAGE
 * instead of a CAUSE, and D-214-13 folds it *at this new refusal's edge only* — which means
 * this refusal has to be right from birth rather than repaired later.
 */

const COPY = {
  // ── §1 · THE THREE REFUSALS, ONE PER UNPROVED ARM (D-214-09) ──────────────────────────
  //
  // ⚠ THREE, NOT ONE. Each arm is proved on its OWN terms, so each failure is a different
  // fact about the world and a person needs to be told which. A single "step is invalid"
  // headline would be the stage-naming failure in a new costume.

  /** `Set here` chosen with nothing typed · no arm chosen at all. */
  REFUSE_NO_SOURCE: (step, arg) => `Nothing supplies “${arg}” in “${step}”.`,

  /**
   * ⚠ `Ask at launch` CHOSEN, BUT THE KEY IS NOT DECLARED IN `WorkflowDefinition.inputs[]`.
   * This is `BUG-260826-01` ITSELF — a declared intention no launcher can honour — and this
   * gate exists because that exact shape shipped once already. The sentence says what is
   * true: the step asks, and nothing asks on its behalf.
   */
  REFUSE_ASK_UNDECLARED: (step, arg) =>
    `“${step}” asks for “${arg}” when it runs, but nothing asks for it.`,

  /** `From an earlier step` chosen, and the named phase is absent or not upstream. */
  REFUSE_UPSTREAM_UNREACHABLE: (step, arg, upstream) =>
    `“${step}” takes “${arg}” from “${upstream}”, which does not run before it.`,

  /** D-214-07 — the action's shape is unknown, so "unknown" and "satisfied" must not match. */
  REFUSE_SHAPE_UNKNOWN: (step) => `We do not know what “${step}” needs.`,

  /** D-214-06 — a required argument this form structurally cannot fill. */
  REFUSE_UNRENDERABLE: (step, arg) =>
    `“${arg}” in “${step}” is a list of items — nothing here can fill it in.`,

  // ── §2 · THE ONE WAY OUT ──────────────────────────────────────────────────────────────
  //
  // ⚠ ONE CONTROL, NOT A MENU. Every refusal above lands the author on the step that caused
  // it, with the offending argument already in view. A refusal that offers three doors is a
  // refusal that has not decided what is wrong.
  REFUSE_NEXT: "Go to the step",
  /** The only second action, and only where re-discovery is genuinely the fix (D-214-07). */
  REFUSE_NEXT_REDISCOVER: "Refresh actions",

  // ── §3 · THE FRAME AROUND THE REFUSALS ────────────────────────────────────────────────
  //
  // ⚠ THE COUNT IS SAID BECAUSE THE WALL DID A *FULL* JOB. Stopping at the first problem
  // teaches an author to publish repeatedly to discover the rest.
  REFUSE_TITLE: "Not published",
  REFUSE_COUNT_ONE: "One step cannot run as written.",
  REFUSE_COUNT_MANY: (n) => `${n} steps cannot run as written.`,
  /** Said when every other step passed — the reassurance is a FACT, not a consolation. */
  REFUSE_REST_OK: (n) => `The other ${n} are ready.`,

  // ── §4 · THE STAGE ROWS (the SHIPPED gauntlet, unchanged) ─────────────────────────────
  //
  // ⚠ THE STAGE NAME STAYS ON ITS OWN ROW AND NEVER ENTERS THE HEADLINE. The gauntlet's
  // ten rows are shipped and honest — `PublishGauntlet.tsx:169-180` — and D-214-13 does not
  // touch them. What `BUG-260815-06` objects to is a stage name standing in for a CAUSE,
  // which is a different act from a spine saying where the run stopped.
  STAGE_STRUCTURE: "Structure",
  STAGE_STRUCTURE_WHAT: "Reachable · terminal · inputs satisfied · no orphans",
  STAGE_PASSED: "Checked",
  STAGE_BLOCKED: "Stopped here",
  STAGE_NOT_REACHED: "Not reached",

  // ── §5 · D-214-11 · THE GOLDEN RUN VALIDATED, AND STILL SENT NOTHING ──────────────────
  //
  // ⭐ D-16's no-send line is UNTOUCHED and is SAID rather than assumed. An author watching a
  // publish check an email step has every reason to wonder whether it just emailed someone.
  GOLDEN_NO_SEND: "Checked what each step would send. Nothing was sent.",

  // ── §6 · D-214-12 · NOTHING RETROACTIVE ───────────────────────────────────────────────
  //
  // ⚠ The gate binds the NEXT publish. Already-published workflows keep running — and keep
  // failing at the send honestly, with STEP-05's real reason now shown. Refusing to RUN them
  // would un-run live rows without warning.
  ALREADY_PUBLISHED_NOTE: "Published workflows keep running — this check applies the next time one is published.",
}

if (typeof module !== "undefined") module.exports = { COPY }
