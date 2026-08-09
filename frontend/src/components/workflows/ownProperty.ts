/**
 * Phase 188.2-04 Task 2 (D-05) — ownProperty.
 *
 * ONE FUNCTION: the safe read of a keyed presentation table. It is the WR-04
 * prototype-pollution mitigation the phase card's two lookups go through, and it is
 * moved out on its own because the card's two sinks are about to land in two DIFFERENT
 * destination modules.
 *
 * **THIS MODULE TAKES ZERO IMPORTS, AND THAT IS ITS CONTRACT RATHER THAN AN ACCIDENT.**
 * It is therefore un-cyclable BY CONSTRUCTION — a leaf with no edges cannot sit on a
 * cycle, so the ESM hazard 188.1 spent a whole fence on is not merely unlikely here, it
 * is unreachable. It also means this file satisfies the leaf fence WITHOUT the "allowed
 * import" non-vacuity line `editAffordance.ts` carries: it has no allowed import to point
 * at, and inventing one to make the guard look symmetrical would be the falsest kind of
 * tidy. `grep -Ec "^import" ownProperty.ts` is **0**, and one import falsifies the whole
 * argument above.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future.
 * `own<T>()` and the docblock below were MOVED here out of `PhaseNodeCard.tsx`, where they
 * are declared at `:289-310` (that file measured 797 L at HEAD `42b42cb7`, and 797 L still
 * at the commit that created this one). **AT THIS COMMIT THE CARD STILL DECLARES ITS OWN
 * PRIVATE COPY AND IMPORTS NOTHING FROM HERE** — this is the ADDITIVE half of 188.1's
 * proven split of an extraction into *create additively*, then *cut*. `188.2-06` performs
 * the cut, and it is specified as a HARD CUT with NO re-export shim. The function body
 * moved byte-for-byte; the only change to the declaration is the `export` keyword, which
 * is what a module-private helper needs in order to become a shared one.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED DOCBLOCK POINT AT THE PRE-MOVE
 * `PhaseNodeCard.tsx` (797 L), not at this file. Kept stale on purpose, exactly as 188.1
 * kept `editAffordance.ts`'s. Everything below moved unedited — including anything that is
 * wrong — with ONE named exception, marked in place as D-05 and argued rather than
 * slipped in, because a correction folded into a move commit destroys the one cheap check
 * a reviewer has that a behaviour-preserving change preserved behaviour.
 *
 * THE FOUR OTHER INLINE OWN-GUARDS IN THIS TREE STAY WHERE THEY ARE
 * (`lib/phaseState.ts:77`, `lib/phaseGlyph.tsx:92`, `PhaseNode.tsx:165`,
 * `nodePresentation.ts:128`). Collapsing them into this module is a behaviour-shaped
 * change owed its own phase, not a line in a move — the same rule `editAffordance.ts:42-44`
 * states for a different duplication. What this module does hold constant is the tree's
 * one SPELLING: the `hasOwnProperty.call` form below is the only own-guard shipped
 * anywhere in `frontend/src` — the ES2022 static alternative occurs **zero** times,
 * measured — and this phase introduces no second spelling. (Both identifiers are left
 * unspelled in this paragraph on purpose: an acceptance grep counts the guard's
 * occurrences in this file, and prose that quotes the needle makes its own count lie.)
 *
 * These paragraphs are kept honest by machine, not by habit. `PhaseNodeCard.test.tsx`
 * reads this file's SOURCE through the 188.2-01 subtree fence — an `import.meta.glob`
 * `?raw` sweep whose path list already named `./ownProperty.ts` before this file existed —
 * so the negative scope fences that guarded this helper inside the card now read it HERE.
 * A second fence in the same suite forbids this module from naming a `PhaseNodeCard`
 * specifier in ANY import form (static, dynamic, re-export or type-only); with zero
 * imports that fence is satisfied trivially today, and it is what keeps the zero-import
 * contract from being quietly relaxed in one direction later.
 */
/**
 * Read one entry out of a keyed presentation table SAFELY (188.1-04, WR-04 sites 4/5).
 *
 * ⚠ NOT CEREMONY — it is `runVocabulary.own`'s argument applied to this file's own two
 * tables, and both were measured RED before this helper was written. Every table here is
 * a plain object literal, so it INHERITS `constructor`, `toString`, `__proto__` and
 * friends: `TABLE[key] ?? fallback` does NOT fire its fallback for those names, because
 * the inherited member is never nullish. It hands back a *function* typed as the table's
 * value type — `[Function Object]` — and the two sinks in this file are a rendered mark
 * (three `undefined` reads) and an SVG `stroke` ATTRIBUTE (React refuses a function-valued
 * DOM prop and OMITS the attribute, so the arc paints nothing at all).
 *
 * ⚠ D-05 — THE ONE PARAGRAPH THAT DID NOT MOVE UNEDITED, AND WHY. What stood here read
 * *"WRITTEN LOCALLY RATHER THAN IMPORTED, deliberately … One concept, two small private
 * copies, is cheaper here than one shared function with a blast radius."* That decision
 * is SUPERSEDED rather than deleted, and it is recorded here so the reasoning it replaces
 * stays readable. It weighed exactly TWO options — a second private copy in the card, or
 * exporting and WIDENING `runVocabulary.ts`'s `own()`, which is module-private, typed to
 * `CanvasReading` rather than to a bare key, and whose signature that file's own `?raw`
 * fences constrain. Both premises still hold. What changed is the arithmetic: 188.2 splits
 * the card's two sinks across two DIFFERENT destination modules, so "two small private
 * copies" became THREE, and a small dedicated leaf is a third option the paragraph above
 * never had to consider. Three copies is what it loses to. THE CONSTRAINT IT NAMED IS
 * UNTOUCHED: `runVocabulary.ts:84-88` keeps its own private copy with its different
 * second-parameter type, called at its four sites, and its fences stay exactly as shipped
 * — this module does not import it, widen it, or ask it to change.
 */
export function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? (table as Record<string, T>)[key]
    : undefined
}
