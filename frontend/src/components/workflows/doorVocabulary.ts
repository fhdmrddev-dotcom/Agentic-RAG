/**
 * Phase 193-05 Task 1 (AUTH-01 — D-10 / D-11 as superseded by D-23 / D-12 / D-02 / D-08)
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
 * ── ⚠ THESE ARE THE **SHIPPED** VALUES (COLUMN A). `193-08` REPLACES THEM. ────────────
 *
 * This module is the MOVE, not the reword. D-08 splits them deliberately and the split is
 * load-bearing rather than cosmetic: a characterization baseline only proves something if
 * it PREDATES the change (the 188.1 lesson), so extracting and rewording in one commit
 * would leave the move unprovable. A reader landing between the two waves is looking at
 * the strings exactly as they ship today; `193-08` flips each one to the contract's
 * column D. Do not "helpfully" reword anything here before that wave.
 *
 * ⚠ THE MOVE'S PROOF IS AT THE **DOM** LEVEL, NOT THE SOURCE LEVEL, and the reason is
 * visible in the values below. JSX spells `Describe &amp; run`; a plain TypeScript string
 * spells `Describe & run`. React renders the identifier's value as a text child, and
 * `innerHTML` re-serialises `&` back to `&amp;` — so the rendered `textContent` and the
 * serialised markup are both unchanged while the SOURCE BYTES differ. A source-level diff
 * of these strings would therefore show a difference where the DOM shows none, which is
 * why `193-01`'s six whole-`innerHTML` captures and
 * `WorkflowBuilderPage.header.test.tsx`'s byte-exact band literal are the instruments
 * that prove this wave, and why both had to pass with ZERO edits.
 *
 * ── ⚠ EXACT-MATCH ASSERTIONS ONLY, AND IT BINDS HARDER HERE THAN ANYWHERE ─────────────
 *
 * `runVocabulary.ts:57-59` states the rule and `libraryVocabulary.ts:15-18` repeats it. On
 * THIS table it stops being a caution and becomes arithmetic — after `193-08`:
 *
 *   • `DOOR_B_NAME` is a strict PREFIX of `SWITCH_CTA` (the CTA is the door name plus a
 *     chevron), so a `toContain` on the name is TRUE of both.
 *   • `STRIP_LABEL_GOVERN` becomes the SAME STRING as `DOOR_B_NAME` — that is D-23's
 *     whole point, echoing the door's name back on the door you opened — so a
 *     containment check cannot distinguish them at all.
 *
 * A `toContain` on a fragment of any of those three is vacuous BY CONSTRUCTION.
 * `doorVocabulary.test.ts` compares whole strings, and its pairwise-distinctness property
 * carries a declared exception SET (empty today, non-empty from `193-08`) so the next
 * author extends a list rather than discovering a surprise.
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
export const CHOOSER_H1 = "How do you want to build this?"

/** `chooser.sub` — the chooser's sub-line, directly beneath the heading. */
export const CHOOSER_SUB =
  "Pick the fast path or full control — nothing is locked, you can switch anytime."

// ── Door A — the loose door (`door-card-describe`) ───────────────────────────────────

/** `doorA.tier` — the uppercase tier line on door A's card. */
export const DOOR_A_TIER = "loose · fastest path"

/**
 * `doorA.name` — door A's name.
 *
 * ⚠ Spelled with a plain `&`. The JSX it replaces spelled `Describe &amp; run`; the
 * rendered text is identical and the serialised `innerHTML` is identical, which is the
 * entity conversion the header explains.
 */
export const DOOR_A_NAME = "Describe & run"

/** `doorA.desc` — door A's description paragraph. */
export const DOOR_A_DESC =
  "Say what recurring work this should do — the AI drafts the phases and sets the strictness."

/**
 * `doorA.note` — door A's italic footnote.
 *
 * ⚠ Plain `&` again (JSX: `Author &amp; govern`). Note this string NAMES the other door,
 * so `193-08` must reword it in step with `DOOR_B_NAME` or the two doors will disagree
 * about what the other one is called.
 */
export const DOOR_A_NOTE = "nothing locked — switch to Author & govern anytime"

// ── Door B — the strict door (`door-card-govern`) ────────────────────────────────────

/** `doorB.tier` — the uppercase tier line on door B's card. */
export const DOOR_B_TIER = "power · full control"

/**
 * `doorB.name` — door B's name. ⚠ Plain `&` (JSX: `Author &amp; govern`).
 *
 * After `193-08` this string is a strict PREFIX of `SWITCH_CTA` and EQUAL to
 * `STRIP_LABEL_GOVERN` — see the exact-match paragraph in the header.
 */
export const DOOR_B_NAME = "Author & govern"

/** `doorB.desc` — door B's description paragraph. */
export const DOOR_B_DESC =
  "Open the full Builder — every advanced control, the live strictness tier, the locked judge."

/** `doorB.note` — door B's italic footnote. ⚠ Plain `&` (JSX: `scope &amp; model`). */
export const DOOR_B_NOTE = "citation policy · gate set · per-phase scope & model"

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
export const STRIP_BACK = "‹ both doors"

/** `strip.label` — the describe door's current-door label. ⚠ Plain `&`. */
export const STRIP_LABEL = "⚡ Describe & run"

/**
 * `strip.labelGovern` — the govern door's current-door label. ⚠ Plain `&`.
 *
 * THE 21ST ID, and the contract did not govern it until D-23 (`193-04` added it to
 * `build.cjs` and regenerated). Before that, `🔧 Author & govern` was the one surviving
 * instance of the exact wording SEED-147 reports as illegible, sitting on the door whose
 * card `193-08` renames. It goes through the generated contract like every other id,
 * which is what preserves D-02's derived-never-re-typed property.
 */
export const STRIP_LABEL_GOVERN = "🔧 Author & govern"

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
export const DESCRIBE_CTA = "Draft the workflow"

// ── The describe hint — THREE FRAGMENTS, composed in JSX (D-12) ──────────────────────
//
// The hint is NOT one string. The component owns the `<b>` markup and the non-bold
// connective text; this module owns only the three bold fragments. That matches the
// contract's worked examples exactly, keeps markup out of the data, and needs no parser.
// REJECTED: a single template string with `{1}`/`{2}`/`{3}` markers — it would put a
// miniature templating language in a vocabulary leaf to save two exports.

/** `hint.frag1` — the first bold fragment of the describe hint. */
export const HINT_FRAG1 = "drafts the phases"

/** `hint.frag2` — the second bold fragment. */
export const HINT_FRAG2 = "sets the strictness"

/**
 * `hint.frag3` — the third bold fragment. ⚠ The other id variant D inherits unchanged;
 * see `DESCRIBE_H1` for why it lives here regardless.
 */
export const HINT_FRAG3 = "asks about anything it had to guess"

// ── The switch strip (loose door → strict door) ──────────────────────────────────────

/** `switch.prompt` — the `switch-strip` prompt. */
export const SWITCH_PROMPT = "Need citation policy, gates, or per-phase scope?"

/**
 * `switch.cta` — the `switch-to-govern` button. ⚠ Plain `&` (JSX: `Author &amp; govern ›`).
 *
 * The trailing character is U+203A SINGLE RIGHT-POINTING ANGLE QUOTATION MARK, the mirror
 * of `STRIP_BACK`'s leading one. Asserted by codepoint in the suite.
 */
export const SWITCH_CTA = "Author & govern ›"

// ── The soul preview ─────────────────────────────────────────────────────────────────

/** `soul.label` — the uppercase label above the `describe-soul-preview` aside. */
export const SOUL_LABEL = "This workflow's soul"
