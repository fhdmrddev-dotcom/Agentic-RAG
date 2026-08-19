/**
 * Phase 200 (canvas port) — THE EFFECT BANNER, the third line sketch 200's canvas draws
 * on a step that touches something beyond this workspace.
 *
 * `screens/builder-canvas.html` draws it verbatim, on four of its ten nodes:
 *
 *   CHANGES SOMETHING OUTSIDE   · 9px, bold, wide-tracked, in the warning tone
 *   ONLY READS                  · the same shape, in the dim tone
 *
 * and `screens/node-identity.html` says why it exists, in one sentence directly beneath
 * its node grid: *"A step that touches another application wears that application's own
 * mark."* The banner is the WORD half of that claim — the half that survives a reader who
 * cannot see the mark, and the half that survives a connector whose logo we do not ship.
 *
 * ── ⚠ ONLY ONE OF THE SHEET'S TWO BANNERS IS ON THE WIRE, AND THE OTHER IS NOT WRITTEN ──
 *
 * The sheet draws a Jira READ node ("Read this week's tickets" · `ONLY READS`) beside a
 * Jira WRITE node ("Raise a ticket for anything unresolved" · `CHANGES SOMETHING OUTSIDE`),
 * so a reader of the sheet alone would conclude this app models a read/write split on
 * external steps. **It does not.** `phaseVocabulary.EXTERNAL_CAPABILITY_SENTENCES` is the
 * closed set of external capabilities the client recognises, and all three of its members
 * — `send_email`, `create_ticket`, `post_message` — are WRITES. There is no capability, no
 * column and no flag anywhere on the wire that could resolve a step to `ONLY READS`.
 *
 * So the second banner is DECLINED rather than approximated, and this module exports no
 * constant for it. Rendering it would require choosing which steps "only read", and that
 * choice would be the model's, not the data's — a fabricated claim on the highest-
 * consequence surface available, made in the most confident typography on the card. The
 * project's own standing rule (`CLAUDE.md`, and `runFacts.ts`'s four-arm correction) is
 * that an absent fact renders NOTHING, never a plausible-looking default.
 *
 * ⚠ RE-OPEN TRIGGER, so the decline is dated rather than permanent: the first capability
 * added to `EXTERNAL_CAPABILITY_SENTENCES` that does not mutate anything outside — or any
 * wire field that distinguishes a read capability from a write one. At that point this
 * module gains a second constant and `effectBannerFor` gains a third arm; until then the
 * function is deliberately total over a single positive case.
 *
 * ── WHY THE TYPE AND NOT THE CAPABILITY ──────────────────────────────────────────────
 *
 * The banner keys on `external_action`, the phase TYPE, and not on the resolved capability
 * sentence. That is deliberate and it is the same argument `PHASE_TYPE_SUBTITLES`'
 * `external_action` entry records: reaching outside is the type's ONE INVARIANT FACT, true
 * of every step of that type including one whose capability is unset or is a name this
 * client does not recognise. Keying on the capability would silently blank the banner for
 * exactly the steps whose effect is least legible — the unrecognised ones.
 *
 * A TRUE LEAF: it imports nothing at all, so it can never participate in a module cycle.
 */

/** The one type that reaches beyond this workspace. Spelled once. */
const EXTERNAL_ACTION_PHASE_TYPE = "external_action"

/**
 * The sheet's own string, ONE home — the `doorVocabulary.ts` / `libraryVocabulary.ts` /
 * `runVocabulary.ts` one-string-home rule, applied to the canvas face.
 *
 * Upper-cased HERE rather than by a CSS `uppercase` utility, because the sheet writes it
 * upper-cased in its own markup and this is the string a screen reader announces. A
 * CSS-only transform would announce "changes something outside" while the card reads
 * `CHANGES SOMETHING OUTSIDE`, which is two spellings of one fact.
 */
export const EFFECT_BANNER_OUTSIDE = "CHANGES SOMETHING OUTSIDE"

/**
 * TOTAL over every phase type: the one external type resolves to the banner, and every
 * other type — including a forward-compat discriminator this client has never seen —
 * resolves to `null`, which the card renders as NO element at all.
 *
 * `null` and not `""`: an empty string is falsy at a JSX guard but truthy to a reader of
 * this signature, and `runFacts.ts` records what folding two absences together costs.
 */
export function effectBannerFor(phaseType: string): string | null {
  return phaseType === EXTERNAL_ACTION_PHASE_TYPE ? EFFECT_BANNER_OUTSIDE : null
}
