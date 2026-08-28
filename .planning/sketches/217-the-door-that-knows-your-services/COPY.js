/**
 * ⭐ THE GOVERNED VOCABULARY — sketch 217, Phase 214 (STEP-06, SC#5). Closes `SEED-208`.
 *
 * ⚠ IT DOES NOT PORT AS A NEW MODULE. It ports as **additions to the shipped
 * `frontend/src/components/workflows/doorVocabulary.ts`**, whose `DESCRIBE_REFUSAL` is not merely
 * a precedent here — it is a SIBLING. The describe screen already refuses in a governed
 * vocabulary; this phase gives it a second reason to.
 *
 * ── ⭐ THE SHIPPED SHAPE THIS REUSES, RATHER THAN INVENTING ──
 *   `DESCRIBE_CTA          = "Write the first draft"`
 *   `DESCRIBE_CTA_REFUSED  = "Too thin to draft"`
 *   `DESCRIBE_REFUSAL      = "There is nothing here to draft from yet — describe the work in a sentence."`
 *
 * ⚠ THE DOOR ALREADY DRAWS ITS DISABLED CONTROL **CARRYING ITS REASON** — that is what
 * `DESCRIBE_CTA_REFUSED` is. Stitch arrived at the same idea independently (*"Waiting for
 * connection"*), which is a confirmation, not a discovery. **So the new refusal takes the
 * existing shape and adds one arm; it does not add a second mechanism beside it.**
 *
 * ── ⚠ THE HOUSE RULES THIS TABLE INHERITS FROM `doorVocabulary.ts`, VERBATIM ──
 *   · *"No severity word, no exclamation, no mechanism: it names what is missing and what to do."*
 *   · The dash is an EM DASH (U+2014); the suite asserts the codepoint over the whole table.
 *   · ⚠ **It must never render at rest.** An untouched empty box is refused by the same rule, and
 *     captioning THAT would put a red sentence on the first screen an author meets before they had
 *     done anything at all. `WorkflowDoorSwitch.baseline.test.tsx` pins all six resting states
 *     byte for byte — so this is a MECHANICAL requirement, not merely a taste one.
 */

const COPY = {
  // ── §1 · D-214-20 · THE AUTHOR PICKS THEIR SERVICES BEFORE THE AI DRAFTS ──────────────
  //
  // ⭐ THE GRANT GRAIN IS THE VOCABULARY GRAIN — which is why STEP-06's stated dependency is
  // Phase 213: **granted** tools, not merely discovered ones. The generator's vocabulary IS this
  // set, so a step naming an unconnected service is STRUCTURALLY IMPOSSIBLE rather than caught
  // afterwards. ⚠ Post-draft validation alone was rejected: it is a *model-behaviour* guarantee,
  // and the failure it must prevent is precisely "an invented step that validates and fails at
  // 03:00".
  SERVICES_LABEL: "Services this workflow may use",
  SERVICES_HINT: "Only what you tick can appear in the draft.",
  /** The count, said quietly beside a service that offers more than one action. */
  SERVICE_ACTIONS: (n) => (n === 1 ? "1 action" : `${n} actions`),
  /** ⚠ A CONNECTED SERVICE WITH NO GRANTED TOOL IS NOT SILENTLY ABSENT — it says why. */
  SERVICE_NO_GRANTS: "Nothing allowed yet",
  SERVICE_NO_GRANTS_NEXT: "Choose what it can do",
  SERVICES_EMPTY: "You have not connected anything yet.",
  SERVICES_EMPTY_NEXT: "Connect a service",

  // ── §2 · D-214-21 · THE REFUSAL NAMES THE SERVICE AND THE NEXT ACTION, AND DRAFTS NOTHING ─
  //
  // ⚠ For the case the picker cannot cover: the author's PROSE names a service they have not
  // connected. ⚠ **A refusal is only honest if it names the next action** (the ROADMAP's own
  // words), and this one names two real ones — in the author's own words, not ours.
  DOOR_REFUSAL: (service) =>
    `${service} is not connected — connect it in Settings, or describe this step without it.`,
  DOOR_REFUSAL_CONNECT: (service) => `Connect ${service}`,
  DOOR_REFUSAL_REVISE: "Revise the description",

  /**
   * ⚠ THE DISABLED CTA CARRIES ITS OWN REASON, WHICH IS THE SHIPPED
   * `DESCRIBE_CTA_REFUSED` SHAPE — a second arm on one mechanism, never a second mechanism.
   * ⚠ It names no service, because the control is one control and there may be two missing.
   */
  DOOR_CTA_REFUSED_SERVICE: "Waiting on a connection",

  /**
   * ⭐ THE GAP THE STITCH PASS LEFT, AND THE ONE THING THIS SKETCH ADDS THAT STITCH DID NOT
   * HAVE. In Stitch's `09` the service appeared in the sentence at the top and again in the
   * refusal at the bottom **with no thread between them** — so the refusal read as being about
   * the workflow rather than about *something the person wrote*.
   *
   * This is the label on the marked span in the author's own text.
   */
  DOOR_REFUSAL_ANCHOR: "why this stopped",

  // ── §3 · WHAT IS *NOT* REWORDED ───────────────────────────────────────────────────────
  //
  // ⚠ THE SHIPPED STRINGS ARE REPRODUCED HERE SO THE SUITE CAN ASSERT THEY ARE UNTOUCHED.
  // Rewording a governed literal Phase 187 settled is what D-13 and the 166-C precedent already
  // declined, twice. They are read from `doorVocabulary.ts`, never re-typed into a component.
  SHIPPED_DESCRIBE_CTA: "Write the first draft",
  SHIPPED_DESCRIBE_CTA_REFUSED: "Too thin to draft",
  SHIPPED_DESCRIBE_REFUSAL:
    "There is nothing here to draft from yet — describe the work in a sentence.",
}

if (typeof module !== "undefined") module.exports = { COPY }
