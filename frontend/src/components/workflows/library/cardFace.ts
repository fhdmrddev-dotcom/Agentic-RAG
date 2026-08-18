/**
 * Phase 192.2-02 Task 2 (LIB-06 — CONTEXT D-05 / D-06, threats T-05 / T-06 / T-07) — THE ONE
 * PLACE A LIBRARY ROW'S FACE IS DECIDED.
 *
 * ── WHY THIS MODULE EXISTS, AND WHY IT SHIPS BEFORE THE FEATURE ──────────────────────────
 * `WorkflowCard.tsx` measures **8 commits / 3 phases / 818 lines** and carries a G-5 obligation
 * undischarged since sketch 175 — the ledger cell reads *"⚠ obligation UNDISCHARGED — next phase
 * touching it owes a refactor rec FIRST"*. This is that refactor, and it lands in the wave BEFORE
 * the one that changes the card's language, because that is the order Phase 192.1's D-01
 * established and this project keeps: **the seam ships before the feature it makes room for.**
 *
 * THREE library surfaces need the same lead/defer language. Today each would need its own copy of
 * it, and a second copy is how two surfaces come to disagree about what a row IS. This module is
 * the one vocabulary; that is what makes Wave 4 a small diff in one file rather than conditionals
 * threaded through 818 lines.
 *
 * ── A PURE, VALUE-ONLY LEAF (T-05) ───────────────────────────────────────────────────────
 * NO React import, NO `@/lib/api` import, no side effect, no clock, no I/O. The house precedent
 * for this shape in this directory is `libraryRow.ts` (types-only) and `deriveTier.ts` (pure
 * derivation); the ORDERING copied here is `deriveTier.ts:24-50` — exported aliases first, then
 * the exported interface, one docblock per member, then the table, then the function.
 *
 * A leaf that imported React could not be reused by anything but a component, which would
 * re-create exactly the copies this module exists to prevent. Its input is a `LibraryRow` and
 * NOTHING ELSE, so it cannot reach for data the feed does not carry — the same discipline
 * `WorkflowCard.tsx` already holds when it refuses to compute slugs and versions.
 *
 * ── THE STATE WORDS ARE IMPORTED, NOT SPELLED (T-06) ─────────────────────────────────────
 * ⚠ THE PLAN SAID TO SPELL THE BUSINESS WORDS HERE. THAT WOULD HAVE CREATED THE SECOND COPY
 * T-06 FORBIDS, because they are already shipped: `STATE_RUNNABLE` / `STATE_DRAFT` /
 * `STATE_STARTER` live in `libraryVocabulary.ts:297-307`, ported from sketch 163's GENERATED
 * build contract, consumed today by `rowIdentity.ts` for the identity line's state axis. D-14's
 * rule is that a copy change is a ONE-LINE DIFF IN ONE FILE; a module re-typing `Ready to run`
 * would silently fork the acceptance bar. So this module owns the DECISION — which state a row is
 * in, what leads, what defers — and `libraryVocabulary.ts` keeps owning the WORDS.
 *
 * ⚠ AND THE SYSTEM SPELLINGS ARE AN INPUT ONLY. `published` / `draft` / `starter` arrive on
 * `row.provenance` and reach no returned field. That is where D-06's vocabulary defect — the card
 * renders the raw lifecycle word `published` as its state pill today — is structurally prevented
 * from recurring, even though Wave 4 is what makes the fix visible on screen.
 *
 * ── THE MARK IS A KEY, NEVER A GLYPH (D-06, the icon convention) ─────────────────────────
 * `mark` returns one of three plain words and no emoji and no icon component. The card maps that
 * key to whatever it draws, so the single-source icon convention has ONE enforcement point rather
 * than one per surface. Importing an icon component here would also make this leaf impure, which
 * is T-05 by another door.
 *
 * ⚠ DELIBERATELY NOT CALLED A *"t‑o‑k‑e‑n"*, THE OBVIOUS WORD FOR IT. That spelling already names
 * the draft's OPAQUE FIELD everywhere else in this subtree (`libraryRow.ts`, `useWorkflowFork.ts`,
 * D-16), and `librarySubtree.fences.test.ts`'s F6 scoping control enumerates by NAME the modules
 * that mention it. Reusing the word for an unrelated concept would put this leaf on that list and
 * cost a reader one adjudication every time they grep — measured, not foreseen: the fence's
 * control went red on this file's first draft and named it.
 *
 * ⚠ TODAY THE CARD MAPS THOSE THREE KEYS BACK TO THE EMOJI IT ALREADY RENDERS. That is
 * deliberate and it is this plan's whole constraint: **192.2-02 CHANGES NO PIXEL.** The emoji
 * leave in Wave 4, from the map in `WorkflowCard.tsx`, in one edit.
 *
 * ── ABSENCE IS EXPLICIT, NEVER A BLANK STRING (D-08's three arms) ────────────────────────
 * `lead` and `version` are `string | null`, and `null` means THE ROW CARRIED NONE. A blank string
 * would be a value that renders like an absence and compares like a presence — the defect
 * `libraryRow.ts` already legislates against for `isMine` and `updatedAt`, and the shape of
 * `WR-01`, where an empty name blanked the library title. What a nameless row should SAY instead
 * is a pixel decision and therefore Wave 4's; this module's job is to make the absence legible to
 * whoever decides.
 *
 * ⚠ THERE IS NO RECENCY FIELD HERE, AND ITS ABSENCE IS THE DECISION. `updatedAt` is on the row,
 * but *when this changed* is resolved by `resolveIdentity` over the whole LIST (`RowIdentity.when`
 * — `null` when the wire did not say, never fabricated). A face that computed its own recency
 * would be the second copy again, one field down. This module is deliberately BLIND to
 * `updatedAt`, and its suite asserts that a row missing it produces an identical face.
 */
import type { LibraryRow, Provenance } from "./libraryRow"
import { STATE_DRAFT, STATE_RUNNABLE, STATE_STARTER } from "./libraryVocabulary"

/**
 * The face's mark, as a KEY. Business-facing by construction: none of the three is a lifecycle
 * spelling, so a consumer cannot accidentally render the system word by rendering the key.
 *
 * It doubles as the face's stable discriminator — `state` is a human sentence and a bad map key.
 */
export type CardMark = "ready" | "starter" | "building"

/** What a library row leads with and what it defers. Resolved once, per row. */
export interface CardFace {
  /**
   * THE LEAD (D-02). Sketches 177/178 argued the name cannot be the differentiator and the
   * operator's pick — 179-C — kept it anyway: what moved is the ENCODING, not the headline. A
   * plan that demotes the name has misread the verdict.
   *
   * `null` = the row carried no name at all. See the ⚠ absence paragraph in this file's header.
   */
  lead: string | null
  /**
   * The version, DEFERRED to the right of the lead — dim mono, D-01 line 1. Already composed
   * (`v3`), because the `v` is part of the word rather than a decoration the caller adds.
   *
   * `null` = the row carries no version. Never faked to 1, the rule `libraryRow.ts:66-72` states
   * for the same field one layer down.
   */
  version: string | null
  /** The state, IN BUSINESS WORDS. Imported from `libraryVocabulary.ts` — see T-06 above. */
  state: string
  /** The mark key. The consumer maps it to a glyph; this module names no glyph. */
  mark: CardMark
  /**
   * Whether this row can be run — the fact that picks the primary verb. A DRAFT IS NEVER
   * RUNNABLE, on its face or in its menu: the page's own load-bearing contract
   * (`WorkflowsPage.tsx:14`, *"A DRAFT cannot be Run (publish is the test)"*).
   */
  runnable: boolean
}

/**
 * The three faces, keyed by the system spelling — WHICH IS THE ONLY PLACE IT APPEARS, and it
 * appears as an INPUT KEY rather than as any returned value.
 *
 * `satisfies Record<Provenance, …>` is the fence: a fourth provenance becomes a typecheck error
 * here rather than a row that silently renders no face at all.
 */
const FACES = {
  published: { mark: "ready", state: STATE_RUNNABLE, runnable: true },
  starter: { mark: "starter", state: STATE_STARTER, runnable: true },
  draft: { mark: "building", state: STATE_DRAFT, runnable: false },
} as const satisfies Record<Provenance, { mark: CardMark; state: string; runnable: boolean }>

/** The version's prefix, spelled once. Part of the word, not a decoration. */
const VERSION_PREFIX = "v"

/**
 * cardFace — resolve one row's face. Pure, O(1), and total over `Provenance`.
 *
 * ⚠ THE EMPTY-NAME TEST IS `=== ""`, NOT A TRIM, and that is a deliberate choice rather than a
 * looser check written carelessly. A trim would additionally collapse a whitespace-only name to
 * `null`, which renders identically to the eye but drops a text node from the DOM — i.e. it would
 * be a change to the rendered output, and this plan's headline constraint is that there is none.
 * Whitespace names are Wave 4's to consider, along with what a `null` lead should say.
 */
export function cardFace(row: LibraryRow): CardFace {
  const face = FACES[row.provenance]

  return {
    lead: row.name === "" ? null : row.name,
    version: row.version === undefined ? null : `${VERSION_PREFIX}${row.version}`,
    state: face.state,
    mark: face.mark,
    runnable: face.runnable,
  }
}
