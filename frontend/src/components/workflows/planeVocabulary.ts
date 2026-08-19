/**
 * Phase 200 (canvas port) — THE PLANE'S OWN WORDS.
 *
 * The canvas draws things that are not steps: the ○ end cap today, and whatever later
 * joins it. Their words live HERE, in one home, for the same reason `doorVocabulary.ts`,
 * `libraryVocabulary.ts`, `decisionsVocabulary.ts`, `runVocabulary.ts` and
 * `connectionState.ts` exist — a sentence with two spellings is two sentences, and the
 * second one rots.
 *
 * ⚠ THESE ARE NOT `phaseVocabulary.ts`'s WORDS, and the split is deliberate rather than
 * tidy. That module answers "what KIND of step is this, and what does it do" — a vocabulary
 * about PHASES. The end cap is not a phase: it has no config, no type, no run row, and it
 * is deliberately inert. Putting its sentence there would have made a phase vocabulary
 * describe a non-phase, which is how a map ends up with a member nothing can look up.
 *
 * A TRUE LEAF: it imports nothing at all, so it can never participate in a module cycle.
 */

/**
 * THE ○ END CAP, EXPLAINED TO THE PERSON LOOKING AT IT.
 *
 * ⚠ IT EXISTS BECAUSE THE CAP ANSWERED NOBODY. Operator feedback on the live canvas, in
 * their own words: *"at the very end of the workflow there is a circle, I don't know what
 * this is."* The cap was working exactly as designed — sketch 136's "every flow ends in an
 * explicit ○ cap, never a dangling stub" — and it already carried an `sr-only` sentence, so
 * a screen-reader user was being told. A SIGHTED user was told nothing at all. That is the
 * same defect class as a control that declines in silence: the information existed, and
 * only one audience could reach it.
 *
 * A PRODUCT SENTENCE, NOT A MECHANISM WORD. It says what the mark MEANS for the workflow
 * ("nothing runs after this point"), never what it is made of — no "terminal node", no
 * "end cap", no `phase_index`. The person asking the question is looking at a circle, not
 * at a graph model.
 *
 * ⚠ IT MAKES NO CLAIM ABOUT A RUN. "Nothing runs after this point" is a statement about the
 * SHAPE of the workflow — the cap is attached to the terminal step and there is no step
 * beyond it — and it stays true whether the workflow has ever run, is running, or failed
 * three steps earlier. A sentence here that said anything about what DID happen would be
 * inventing a fact the plane does not hold.
 *
 * ONE STRING, TWO SINKS, NO DOUBLE ANNOUNCEMENT. `PhaseNode.tsx` renders it BOTH as the
 * cap's `sr-only` text and as its `title`. That is safe rather than duplicative: under the
 * accessible-name spec `title` is the LOWEST-priority naming source, so an element whose
 * own content already names it never falls through to its title. The screen reader keeps
 * hearing it exactly once; the pointer user now sees it on hover.
 */
export const END_CAP_MEANING = "End of the workflow — nothing runs after this point."
