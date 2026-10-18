/**
 * Phase 286-02 (2026-10-18, REG-07 / D-10b) — THE BUILDER'S COPY CONSTANTS, MOVED VERBATIM.
 *
 * Every constant below, and every docblock above it, moved character-for-character and in
 * base order out of `pages/WorkflowBuilderPage.tsx` under G-5 (the page measured 57 commits /
 * 22 phases / 2993 lines at the cut). Nothing was re-worded. The page IMPORTS all eight and
 * RE-EXPORTS seven of them, so every test import (`from "./WorkflowBuilderPage"`) and every
 * caller still resolves through the page exactly as before; the page module's export set is
 * unchanged, and `WorkflowBuilderPage.seam286.pin.test.tsx` pins both the set and each value.
 *
 * WHY THIS IS A LEAF. String constants only, no imports, so the dependency direction stays
 * the one the whole `components/workflows` tree depends on: the page imports from here, and
 * nothing here can reach back into a page. Living in this directory also keeps the moved
 * strings inside every sweep that already walks it (`governanceVocabulary.test.ts`'s
 * `./*.{ts,tsx}` glob and the `/src/components/workflows/**` verb fence), so the move loses
 * no guard coverage.
 *
 * ⚠ `UNNAMED_KB_OPTION` IS EXPORTED HERE ONLY SO THE PAGE CAN IMPORT IT. The page does NOT
 * re-export it (that would grow the page's export set). Its docblock's "module-local" note
 * is kept verbatim and now reads as: local to the Builder — this leaf plus the one page that
 * renders it — and still said by nothing else.
 *
 * WHAT DID NOT MOVE, deliberately: the `GENERIC_SAVE_ERROR` tombstone, the
 * `SAVED_STILL_A_DRAFT` / `PUBLISHED_CONFLICT_MESSAGE` re-exports and `useCanvasGate`. The
 * header suite's `FLAG_OFF_HEADER_MARKUP` and its byte-exact band literals pin RENDERED markup,
 * which this move does not change; those literals stay where they are, unedited.
 */

/**
 * The empty draft's publish reason (D-184-15). An INVITATION, not a claimed verdict:
 * the client is not validating anything here, it is saying what to do next on a
 * workflow that has no steps yet. D-182-06 stays intact precisely because no severity,
 * no code and no lint rule is being computed — a zero-length phases array is not a
 * finding, and the moment a step exists the server owns every verdict.
 */
export const EMPTY_DRAFT_INVITATION = "Add a step to get started"

/**
 * The publish reason while the write loop still has a PATCH outstanding (WR-10, 186-16).
 * A WAIT, NOT A FAULT: nothing is wrong and the author has nothing to fix, so the sentence
 * says what is happening and that it ends by itself — a greyed control with a fault-shaped
 * explanation reads as a refusal the person caused.
 *
 * WHAT THE MOMENT'S WAIT BUYS. `publish_service.py` reads `stage0_token` when the gauntlet
 * starts and spends it at the stage-5 flip minutes later, so an autosave PATCH committing
 * after that read makes the token dead on arrival: the flip answers `-2` → `draft_changed`
 * AFTER a real golden run has burned wall clock and provider spend on a publish that could
 * never have succeeded — and the author sees that refusal for an edit made BEFORE Publish.
 */
export const SAVING_PUBLISH_WAIT = "Saving your last change — Publish will be ready in a moment"

/**
 * What the header says about a workflow bound to NO knowledge base (D-186-16).
 *
 * IT STATES THE CONSEQUENCE, NOT THE STATE. "Unbound", and the describe screen's own
 * "No specific knowledge base", both sound harmless — and BUG-260731-03's live evidence
 * is that they are not. With `project_folder_id` null, "the knowledge base" is
 * *everything*: the reported run drew 11 files from 5+ folders into a compliance report,
 * and the operator reproduced the same mistake on themselves within ten minutes because
 * nothing on the canvas ever said so. The sentence has to name what actually happens.
 *
 * AN INVITATION, NOT A CLAIMED VERDICT — the rule `EMPTY_DRAFT_INVITATION` above states,
 * for the same reason. The client is not validating anything here: no severity, no code
 * and no lint rule is being computed, a null `project_folder_id` is not a finding, and
 * D-182-06 stays intact because the server owns every verdict. The deterministic
 * build-time `/validate` verdict for an unbound retrieval workflow is Phase 187's
 * (D-186-14) and is deliberately NOT built here.
 *
 * WHERE IT IS ALLOWED TO TRAVEL: the header chip, and nowhere else. `UNBOUND_KB_INVITATION`
 * must never join `blockedReason` (that would make an unbound workflow unpublishable —
 * 187's call, not this phase's), never become a `Verdict`, never enter `verdicts` or
 * `groupVerdicts`, never add a problems-tray row and never mark a node. A comment-stripped
 * source fence in `WorkflowBuilderPage.header.test.tsx` asserts exactly that, in both
 * directions.
 */
export const UNBOUND_KB_INVITATION = "No knowledge base · searches everything"

/**
 * What the header's requirement control says when the workflow has not declared its
 * purpose yet (quick 260809-klo · BUG-260809-02).
 *
 * IT ASKS FOR THE THING, AND NAMES THE CONSEQUENCE. The blocking sentence the author
 * eventually meets — "a workflow must declare exactly one business_requirement before
 * publish" — names an internal FIELD, which is precisely why the reporting operator had
 * no recovery path from inside the product. This placeholder is the other end of that
 * sentence: it asks in plain words for what the field holds, and says when it is needed.
 * (The blocking copy itself is authored in two BACKEND sites and relayed verbatim by
 * `blockedReason` below; rewriting it here would install exactly the client-side message
 * mapping D-182-06 forbids. Carried as `D-klo-DEF-01` with its own re-open trigger.)
 *
 * AN INVITATION, NOT A CLAIMED VERDICT — the same fence `UNBOUND_KB_INVITATION` above
 * carries, for the same reason. No severity and no code is computed here: an empty
 * `business_requirement` is not a client-side finding, and the emptiness rule stays the
 * server's (`grounding.py:894`). D-182-06 stays intact.
 *
 * WHERE IT IS ALLOWED TO TRAVEL: this one placeholder, and nowhere else. It must never
 * join `blockedReason`, never become a `Verdict`, never enter `verdicts` or
 * `groupVerdicts`, never add a problems-tray row and never mark a node. The server
 * already owns this verdict (`backend/app/api/workflows.py:712-721`), it already routes
 * to the tray as a workflow-wide `incomplete`, and its message is what `blockedReason`
 * relays word for word. A second warning authored here would be a second truth-teller.
 */
export const REQUIREMENT_INVITATION = "What must this workflow deliver? · required to publish"

/**
 * Phase 193.2-09 (D-06, `SEED-163`) — the VISIBLE half of the requirement's provenance.
 *
 * WHY A MARK AT ALL, AND WHY THIS IS NOT DECORATION. `193.2-05` made the generator PROPOSE
 * a `business_requirement` and `193.2-07` made that proposal DURABLE
 * (`WorkflowDefinition.business_requirement_seeded_by_ai`, stamped server-side after
 * validation and never read off the emitted payload). Between those two and this one the
 * field arrives pre-filled with nothing anywhere saying the AI wrote it — a decision the
 * author is never shown, which is `SEED-163`'s own root failure repeated in miniature. D-06
 * rejects that silent pre-fill explicitly, and rejects the other direction too (an empty
 * field with a click-to-accept proposal is still one extra act before publish, which is the
 * friction `SEED-163` exists to remove).
 *
 * IT IS ALSO WHAT MAKES D-09 HONEST. The publish gate is unchanged: stage 1's
 * `business_requirement_missing` (`backend/app/services/harness/grounding.py`) only checks
 * the field is non-empty, so an AI-seeded value passes it untouched. That is ACCEPTED —
 * because the author can SEE the value is the AI's and overrule it, and pressing Publish is
 * the consent (T-193.2-03). Without this mark, D-09 would be a silent weakening of the
 * judge's own `answers_business_requirement` criterion rather than a stated trade.
 *
 * THE REGISTER: what is true, plainly (D-13). Not an endorsement — it does not say the
 * proposal is good — and not a warning: the ordinary case is that the proposal is right and
 * the author ships it. It reads *the AI proposed this; it is yours to change*, and the
 * second clause is a fact about behaviour that ships in this same plan (the store clears the
 * flag on any edit), never a promise about future work. **No `planned` / `coming` / `soon` /
 * `deferred` / `future release`** — D-14, whose whole reason for existing is that `SEED-164`
 * came from a docblock calling shipped work "deferred" and leaving it reading as a plan for
 * a year.
 *
 * NO GLYPH, DELIBERATELY, AND THE RULE IS THE PROJECT'S OWN. The icon convention's §4 states
 * it for the shipped `waitsForYou` badge: *the WORD carries the meaning; tone is decoration*,
 * and an emoji there spends visual budget the design withholds. Two further reasons make it
 * binding here rather than a preference: `✦` — the one glyph a sketch has ever proposed for
 * "AI-drafted" — is REFUSED, because it is the shipped Working badge and sits on the verdict
 * mark's coordinates on a canvas-adjacent surface; and inventing a NEW canvas mark when the
 * vocabulary has none is the exact drift §4's "what to avoid" list names. The affordance's
 * own `✎` already leads the row and is not repeated.
 */
export const REQUIREMENT_AI_MARK_LABEL = "AI-proposed"

/** The fuller sentence, carried as `title` — the shipped idiom on this header, where
 *  `net-new-flag` and `judge-locked` both explain themselves the same way. */
export const REQUIREMENT_AI_MARK_EXPLANATION =
  "The generator proposed this line when this workflow was created. Edit it and this mark clears."

/**
 * What the picker calls a binding it cannot NAME — a folder that is not in the author's
 * own list, because it was deleted or because the draft was forked from a workflow that
 * bound someone else's.
 *
 * It exists so an unnameable binding cannot render as a blank control, which would read
 * as *unbound* — the exact invisibility this whole plan is fixing. Still a neutral fact
 * about configuration, with no severity and no code: the workflow IS bound, we simply
 * cannot say to what. Not the raw id, because 103-ux's rule for this chip is that it
 * shows a NAME and never a UUID. Module-local: nothing outside this file says it.
 */
export const UNNAMED_KB_OPTION = "A knowledge base outside your folders"

/**
 * The unsaved-work prompt (D-184-16 debt 1). Named in 184-11 because a session could then
 * be five structural edits deep with no autosave at all.
 *
 * ⚠ 186-07 KEPT THE GUARD AND CHANGED WHAT IT MEANS (D-186-03). Same words, same code, still
 * keyed on `dirty` — but autosave clears `dirty` continuously now, so what it asks moved
 * from *"you forgot to save"* (the 184 common case, the kind of prompt people learn to click
 * through) to *"a write genuinely failed or is being held"*. A guard that fires only on a
 * real refusal is worth more than one that fires on every exit; that is why it stayed.
 */
export const UNSAVED_LEAVE_PROMPT =
  "This draft has unsaved changes. Leave without saving?"
