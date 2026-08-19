/**
 * Phase 193-05 Task 1, RE-VALUED BY 193-08 Task 1
 * (AUTH-01 — D-10 / D-11 as superseded by D-23 / D-12 / D-02 / D-08 / D-01)
 * — the AUTHORING DOORS' words.
 *
 * EVERY GOVERNED USER-FACING STRING ON THE TWO-DOOR AUTHORING SURFACE, IN ONE HOME:
 * the chooser's heading and sub, both door cards, both header strips, the describe
 * door's heading / CTA / hint fragments, the switch strip, and the soul-preview label.
 * Twenty-one ids, which is the whole COPY table and not a subset of it.
 *
 * ── THE RULE THIS FILE EXISTS TO KEEP ────────────────────────────────────────────────
 *
 * LOCK ELSEWHERE, MIRROR HERE. The words are LOCKED in
 * `.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md` and
 * MIRRORED here: a change is a decision taken in that generated contract and reflected
 * here, never the other way round. That is the `runVocabulary.ts:44-48` /
 * `libraryVocabulary.ts:5-13` habit, copied for a mechanical reason rather than a tidy
 * one — the contract's substitution audit is defined over the WHOLE table, so a module
 * holding a SUBSET means the module and the contract describe different things and the
 * next reader cannot tell which strings are governed (D-11). A vocabulary module with
 * two homes is not a single source of truth.
 *
 * PORTED FROM THE GENERATED BUILD CONTRACT, NOT TRANSCRIBED FROM PROSE (D-02). That
 * contract is emitted FROM the real `WorkflowDoorSwitch` DOM — `dom.generated.json` is a
 * dump of the shipped component, not a hand-written mock — so column A below is what a
 * human actually approved on screen rather than a re-typing of a README. The anti-drift
 * property only holds if EVERY consumer imports from here: one literal left in JSX is a
 * second home, and a second home cannot be re-worded by a one-line diff.
 *
 * ── ⚠ THESE ARE **COLUMN D**, THE PICK — NO LONGER THE SHIPPED COLUMN A ───────────────
 *
 * `193-05` put the shipped strings here as a pure MOVE; `193-08` (this wave) replaced every
 * one of them with **column D of the regenerated contract** — variant D, "the mix": B's door
 * NAMES with C's two uppercase TIER labels, everything else B verbatim (D-01). The values
 * were PORTED BY SCRIPT out of the generated markdown table and compared back 21/21, not
 * hand-typed (D-02). ⚠ Two ids (`describe.h1`, `hint.frag3`) INHERIT their column-A string
 * unchanged and are still governed — an id left out because "it isn't changing" is exactly
 * the second home the next reword trips over (D-11).
 *
 * TWO DECLARED EQUALITIES NOW HOLD ACROSS THIS TABLE, and they are declared HERE so the
 * exact-match rule's exceptions are a decision rather than a discovery:
 *
 *   • `STRIP_LABEL_GOVERN` ≡ `DOOR_B_NAME` — the same string, by D-23, pinned by a TYPE
 *     ANNOTATION (see that export). Not a coincidence to be tolerated: the point is that the
 *     govern strip echoes back the name of the door you opened.
 *   • `DOOR_B_NAME` is a strict PREFIX of `SWITCH_CTA` — the CTA is that name plus a chevron.
 *
 * `doorVocabulary.test.ts` pins both as EQUALITIES and every other pair as distinct.
 *
 * ── ⚠ THE SPLIT BETWEEN THE MOVE AND THE REWORD, AND WHY IT WAS LOAD-BEARING ──────────
 *
 * D-08 split them deliberately: a characterization baseline only proves something if it
 * PREDATES the change (the 188.1 lesson), so extracting and rewording in one commit would
 * have left the move unprovable. It worked — `193-03` and `193-05` both passed with the six
 * whole-`innerHTML` captures and the byte-exact band literal GREEN AND UNEDITED, which is
 * what proves those waves moved bytes rather than changed them. THIS wave is the first that
 * intentionally changes a rendered word, so those same instruments red here BY DESIGN and
 * were re-captured once, deliberately, with the reason recorded in each file.
 *
 * ⚠ THE MOVE'S PROOF WAS AT THE **DOM** LEVEL, NOT THE SOURCE LEVEL, and the reason is
 * still visible in the values below. JSX spells the ampersand as an entity; a plain
 * TypeScript string spells it as one character. React renders the identifier's value as a
 * text child and `innerHTML` re-serialises `&` back to the entity — so the rendered
 * `textContent` and the serialised markup were both unchanged while the SOURCE BYTES
 * differed. A source-level diff would have reported a difference the rendered surface did
 * not have.
 *
 * ── ⚠ EXACT-MATCH ASSERTIONS ONLY, AND IT BINDS HARDER HERE THAN ANYWHERE ─────────────
 *
 * `runVocabulary.ts:57-59` states the rule and `libraryVocabulary.ts:15-18` repeats it. On
 * THIS table it stopped being a caution and became arithmetic the moment column D landed:
 * `DOOR_B_NAME` is a strict PREFIX of `SWITCH_CTA` and is the SAME STRING as
 * `STRIP_LABEL_GOVERN`, so a containment check on that fragment is true of all three and
 * cannot identify a row at all.
 *
 * A `toContain` on a fragment of any of those three is vacuous BY CONSTRUCTION.
 * `doorVocabulary.test.ts` compares whole strings with `toBe`, spells column D as literals
 * in the TEST so the assertion falsifies this table rather than copying it, and carries the
 * two equalities above as a DECLARED exception list — `193-05` left that list empty with the
 * extension named in its docblock, and this wave EXTENDED it rather than weakening the
 * distinctness property to make a red go away.
 *
 * ── ZERO IMPORTS ─────────────────────────────────────────────────────────────────────
 *
 * `runVocabulary.ts` states "exactly TWO imports, both type-only". This module goes one
 * better and imports NOTHING AT ALL — no React, no hooks, no JSX, no sibling, not even a
 * type. Two consequences, both mechanical:
 *
 *   1. An ESM cycle through this module is impossible by construction, which is what makes
 *      the D-24(b) cycle risk on the door subtree ONE-DIRECTIONAL. `DoorHeaderStrip.tsx`
 *      may import this leaf precisely because this leaf can never import back.
 *   2. It is the reason D-10 puts the strings in a `.ts` LEAF rather than in
 *      `DoorHeaderStrip.tsx` as a `STRIP_COPY` const: `react-refresh/only-export-components`
 *      is an ACTIVE error in this repo (`FlowEdge.tsx:135` still carries one), so a
 *      component module may not export a shared runtime value.
 *
 * And it sits HERE rather than under `library/` (D-10): the doors are an AUTHORING
 * surface, and `library/` carries Phase 192's fences — nothing under it may name a
 * `WorkflowsPage` specifier (F4). Putting authoring copy there would muddy a boundary
 * Phase 192 spent a whole phase drawing.
 */

// ── The chooser ("both doors") ───────────────────────────────────────────────────────

/** `chooser.h1` — the chooser's heading. */
export const CHOOSER_H1 = "How do you want to start?"

/** `chooser.sub` — the chooser's sub-line, directly beneath the heading. */
export const CHOOSER_SUB =
  "Both end up in the same place. You can switch between them at any time."

// ── Door A — the loose door (`door-card-describe`) ───────────────────────────────────

/**
 * `doorA.tier` — the uppercase tier line on door A's card.
 *
 * ⚠ ONE OF THE TWO CELLS D TAKES FROM VARIANT C rather than B (the contract marks it
 * `⬅ from C`). B's tier stated a BENEFIT; C's states what it COSTS YOU, and benefit
 * language is what made the shipped wording vague in the first place (D-01).
 */
export const DOOR_A_TIER = "you write one paragraph"

/** `doorA.name` — door A's name. It answers WHO DOES THE WORK, which is the question
 *  SEED-147's operator actually had. */
export const DOOR_A_NAME = "Draft it for me"

/** `doorA.desc` — door A's description paragraph. */
export const DOOR_A_DESC =
  "Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess."

/**
 * `doorA.note` — door A's italic footnote.
 *
 * ⚠ The dash is an EM DASH (U+2014), not a hyphen and not an en dash; the suite asserts the
 * codepoint rather than trusting it to survive an editor. Note that column D's note no longer
 * NAMES the other door, so the two doors can no longer disagree about what the other one is
 * called — which is what the shipped string risked.
 */
export const DOOR_A_NOTE = "you can open the full editor at any point — nothing is locked in"

// ── Door B — the strict door (`door-card-govern`) ────────────────────────────────────

/** `doorB.tier` — the uppercase tier line on door B's card. ⚠ The OTHER `⬅ from C` cell;
 *  see `DOOR_A_TIER` for why D takes C here and B everywhere else. */
export const DOOR_B_TIER = "you decide every setting"

/**
 * `doorB.name` — door B's name, and the string this whole table now pivots on.
 *
 * It is a strict PREFIX of `SWITCH_CTA` and EQUAL to `STRIP_LABEL_GOVERN` — both declared in
 * the header, both pinned in the suite, and the second one pinned by a TYPE ANNOTATION so a
 * rename on either side is a typecheck error rather than two words that quietly disagree.
 */
export const DOOR_B_NAME = "Build it myself"

/** `doorB.desc` — door B's description paragraph. ⚠ Em dash (U+2014). */
export const DOOR_B_DESC =
  "Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step."

/**
 * `doorB.note` — door B's italic footnote. ⚠ Plain `&` (JSX: `sources &amp; model`).
 *
 * The separators are MIDDLE DOTS (U+00B7), not bullets (U+2022) and not full stops. The
 * suite asserts the codepoint and rejects both lookalikes.
 */
export const DOOR_B_NOTE = "what it must cite · required checks · per-step sources & model"

// ── The header strips (both open doors) ──────────────────────────────────────────────

/**
 * `strip.back` — the return control, and it is ONE id with TWO JSX sites: the govern
 * door's strip (`DoorHeaderStrip.tsx`) and the describe door's own band
 * (`WorkflowDoorSwitch.tsx`), which carry identical class lists.
 *
 * That duplication is exactly the drift this module removes. Both sites import this
 * constant; the D-24(a) fence in `WorkflowDoorSwitch.test.tsx` sweeps BOTH sources and
 * says so if either is ever re-typed.
 *
 * The leading character is U+2039 SINGLE LEFT-POINTING ANGLE QUOTATION MARK — not a
 * less-than sign and not a guillemet. `doorVocabulary.test.ts` asserts the codepoint.
 */
export const STRIP_BACK = "‹ Change how I start"

/** `strip.label` — the describe door's current-door label. The `⚡` is U+26A1, matching the
 *  glyph the describe door's card already carries; the suite asserts the codepoint. */
export const STRIP_LABEL = "⚡ Drafting it for you"

/**
 * `strip.labelGovern` — the govern door's current-door label. THE 21ST ID; the contract did
 * not govern it until D-23 (`193-04` added it to `build.cjs` and regenerated), so it reaches
 * this module through the generated contract like every other id, which is exactly what
 * preserves D-02's derived-never-re-typed property.
 *
 * ⚠ THE TYPE ANNOTATION IS THE FENCE, and it costs nothing at runtime — the
 * `libraryVocabulary.ts:291-297` idiom. `DOOR_B_NAME` is a `const` with a literal
 * initialiser, so its type IS the literal, and a rename on either side becomes a TYPECHECK
 * ERROR rather than two words that quietly disagree. The literal is still spelled out
 * because the build contract declares `strip.labelGovern` as its own key; this pins the
 * agreement without making the strip's label a derivative of the card's name.
 *
 * WHAT THIS CLOSES. Before D-23, the govern strip carried the shipped door-B name with a 🔧
 * in front of it — and after variant D ships everywhere else, that would have been THE ONE
 * SURVIVING INSTANCE IN THE PRODUCT of the exact wording SEED-147 reports as illegible,
 * sitting on the door whose own card now reads *Build it myself*. Echoing the door's name
 * back confirms the choice in the same words the person used to make it.
 *
 * ⚠ THE 🔧 IS GONE FROM THIS LABEL WHILE `STRIP_LABEL` KEEPS ITS ⚡ — STATED, NOT SMOOTHED.
 * That asymmetry is a direct CONSEQUENCE of D-23's wording ("its string becomes variant D's
 * door name"), not a discretionary choice made here: the door name carries no glyph, and
 * inventing one to restore symmetry would be re-typing rather than porting (D-02). It is
 * routed to **UAT row U6** so the operator rules on it BY LOOKING, which is the only
 * instrument that can settle a question about how a header reads.
 */
export const STRIP_LABEL_GOVERN: typeof DOOR_B_NAME = "Build it myself"

// ── The describe door ────────────────────────────────────────────────────────────────

/**
 * `describe.h1` — the describe door's heading.
 *
 * ⚠ One of the two ids variant D INHERITS UNCHANGED (the contract's D cell reads
 * *(inherit)*). It lives here anyway, because D-11's one-home rule is about the whole
 * table: an id left in JSX because "it isn't changing" is precisely the second home the
 * next reword trips over.
 */
export const DESCRIBE_H1 = "What recurring work should this automate?"

/** `describe.cta` — the `describe-draft` button. */
export const DESCRIBE_CTA = "Write the first draft"

/**
 * `describe.refusal` — what the describe box SAYS when it has an input it cannot act on.
 *
 * ⚠ THE 23rd GOVERNED ID, AND THE SECOND THAT POSTDATES THE GENERATED CONTRACT (199-08, sheet
 * `c9-doors-describe` §3). Like `DESCRIBE_ATTACH_PROMPT` above it belongs to a DIFFERENT
 * acceptance bar and cannot reach `__contracts__/doors-copy.generated.md`; `doorVocabulary.test.ts`
 * therefore carries it in the post-contract set and asserts it is ABSENT from the parsed contract,
 * rather than widening the contract parse to a row the contract does not have.
 *
 * ── ⚠ IT DESCRIBES A SHIPPED RULE. IT DOES NOT CREATE ONE ────────────────────────────────
 * The CTA has been gated on a trimmed-length test since Phase 124 and on an in-flight document
 * read since 193.1. Nothing about either changes here: this string only says out loud what the
 * FIRST of those two already decides in silence. A refusal SENTENCE is presentation; a refusal
 * RULE would be behaviour, and behaviour is outside this phase's fence. `199-08`'s Task-1 pin
 * measures the predicate in source AND drives it, so the claim is checked rather than asserted.
 *
 * ── ⚠ WHY NOT THE SHEET'S OWN WORDS ──────────────────────────────────────────────────────
 * Sheet c9 draws this state captioned with a VAGUENESS verdict over a real sentence
 * (*"Automate my emails."*) and names two things it claims are missing. We can make no such
 * judgement: no predicate in this product reads an input for vagueness, so shipping that caption
 * would be printing a verdict nothing computes — the `UNDETERMINED` refusal `199-03` made one
 * sheet earlier, pointed the other way. What our rule actually refuses is an input that is blank
 * once its whitespace is taken off, so that is what this says.
 *
 * ── ⚠ IT MUST NEVER RENDER AT REST ───────────────────────────────────────────────────────
 * An untouched empty box is refused by the same rule, and captioning THAT would put a red
 * sentence on the first screen an author meets before they had done anything at all. The
 * component gates this on a non-empty input, so the resting DOM is unchanged — which is
 * additionally a MECHANICAL requirement here, not merely a taste one:
 * `WorkflowDoorSwitch.baseline.test.tsx` pins all six resting states byte for byte.
 *
 * No severity word, no exclamation, no mechanism: it names what is missing and what to do.
 * The dash is an EM DASH (U+2014); the suite asserts the codepoint over the whole table.
 */
export const DESCRIBE_REFUSAL =
  "There is nothing here to draft from yet — describe the work in a sentence."

/**
 * `ctrl.label` — the pre-draft attach control's prompt, directly below the KB picker's label.
 *
 * ⚠ THE 22nd GOVERNED ID, AND THE FIRST ONE THIS TABLE HAS GAINED SINCE THE CONTRACT WAS
 * GENERATED. Every id above is column D of `__contracts__/doors-copy.generated.md`; this one
 * is not in that contract and cannot be, because it belongs to a DIFFERENT acceptance bar —
 * sketch 165's `ctrl.label` slot, as ruled by D-28. `doorVocabulary.test.ts` therefore carries
 * TWO governed sets and asserts their union is this module's export set, rather than widening
 * the contract parse to a row the contract does not have.
 *
 * ── WHY THE SKETCH'S OWN WORDS ARE NOT WHAT SHIPS (D-21 → D-28) ──────────────────────────
 * Sketch 165 proposed *"Filling in a template?"*. On the Builder's describe screen that lands
 * roughly two inches from the shipped, governed, byte-pinned `STARTER_DOOR_LINE`
 * (`definitionOps.ts`), which seeds the describe box from a curated starter WORKFLOW — two
 * meanings for one word on one screen. D-21 ruled that the NEW control is reworded and the
 * SHIPPED line is not touched: this string is unshipped, ungoverned-by-any-pin and rendered
 * nowhere today, so it is the cheapest thing on the screen to change, whereas rewording the
 * shipped line would reopen a governed literal Phase 187 settled — exactly what D-13 and the
 * 166-C precedent already declined.
 *
 * ── WHY THESE WORDS (D-28) ───────────────────────────────────────────────────────────────
 * It is a QUESTION, not a noun. The KB picker directly above already asks one, and a bare noun
 * label would read as a third field to FILL rather than an optional branch to ignore — SC#4
 * says the fast door stays fast. That is the sketch contract's own stated rule for this slot,
 * which is why the rationale survives the reword intact.
 *
 * ⚠ THE COLLIDING WORD IS STILL ON THIS SCREEN, BY DESIGN, AND THAT IS RECORDED RATHER THAN
 * SMOOTHED. D-21 removed it from the LABEL only. The control's button is deliberately the
 * shipped `TEMPLATE_ATTACH_LABEL`, character for character, so that two doors onto one act do
 * not acquire two names — and that string, plus the note beside it, still carry the word. UAT
 * row U2 is the instrument for whatever collision remains, and it must be driven by someone
 * who has not read this file.
 */
export const DESCRIBE_ATTACH_PROMPT = "Have a document to fill in?"

// ── The describe hint — THREE FRAGMENTS, composed in JSX (D-12) ──────────────────────
//
// The hint is NOT one string. The component owns the `<b>` markup and the non-bold
// connective text; this module owns only the three bold fragments. That matches the
// contract's worked examples exactly, keeps markup out of the data, and needs no parser.
// REJECTED: a single template string with `{1}`/`{2}`/`{3}` markers — it would put a
// miniature templating language in a vocabulary leaf to save two exports.

/** `hint.frag1` — the first bold fragment of the describe hint. */
export const HINT_FRAG1 = "writes the steps"

/** `hint.frag2` — the second bold fragment. */
export const HINT_FRAG2 = "sets how strict it is"

/**
 * `hint.frag3` — the third bold fragment. ⚠ The other id variant D inherits unchanged;
 * see `DESCRIBE_H1` for why it lives here regardless.
 */
export const HINT_FRAG3 = "asks about anything it had to guess"

// ── The switch strip (loose door → strict door) ──────────────────────────────────────

/** `switch.prompt` — the `switch-strip` prompt. */
export const SWITCH_PROMPT = "Need to set citations, checks, or per-step sources yourself?"

/**
 * `switch.cta` — the `switch-to-govern` button: `DOOR_B_NAME` plus a chevron, which is why
 * the door name is a strict PREFIX of this string and why no assertion anywhere in this repo
 * may use containment to tell the two apart.
 *
 * The trailing character is U+203A SINGLE RIGHT-POINTING ANGLE QUOTATION MARK, the mirror
 * of `STRIP_BACK`'s leading one. Asserted by codepoint in the suite.
 */
export const SWITCH_CTA = "Build it myself ›"

// ── The soul preview ─────────────────────────────────────────────────────────────────

/** `soul.label` — the uppercase label above the `describe-soul-preview` aside. */
export const SOUL_LABEL = "What this will do"
