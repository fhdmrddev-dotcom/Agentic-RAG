/**
 * `phaseStatusMeta` — the developer panel's STATUS VOCABULARY, in its own module.
 *
 * ── WHY THIS FILE EXISTS (review finding WR-05) ──
 * `PhaseTimeline`'s doing-now line interpolated the internal `Phase["status"]` member
 * straight into copy a user reads: ``` `${activePhase.slug} — ${activePhase.status}` ```.
 * For the six pre-189 members that read tolerably (*notify — running*); for the member 189
 * ADDED it read **`notify — recorded-not-sent`** — a kebab-case internal identifier, on the
 * one surface in this phase whose entire discipline (D-17) is that the STORED SLUG, the
 * PANEL WORD and the CANVAS SENTENCE are three deliberately different spellings. Every
 * other consumer in the phase routes through a vocabulary table; that line bypassed
 * `STATUS_META`, which already held the correct word ("Not sent").
 *
 * The fix needs ONE table read by TWO components, and `eslint`'s
 * `react-refresh/only-export-components` says so in as many words: *"Fast refresh only
 * works when a file only exports components. Use a new file to share constants or functions
 * between components."* Exporting `statusWord` from `PhaseCard.tsx` was MEASURED as a new
 * ERROR on that file (3 → 4) before this module was written, so the split is the tooling's
 * own instruction rather than a preference. It is also the shape the review named as its
 * alternative ("or lift `STATUS_META` beside it"), and the shape 188.2 used five times over
 * for `PhaseNodeCard`'s siblings.
 *
 * ⚠ THIS IS A VERBATIM MOVE. The interface, the table (every row, every comment, every
 * colour token) and `statusMeta`'s own-property guard are byte-identical to what stood in
 * `PhaseCard.tsx`; only `statusWord` is new. No row was retuned, no glyph was rechosen and
 * no contrast token changed — `PhaseCard` imports what it used to declare, and its rendered
 * DOM is unmoved (`panel/__tests__/PhaseTimeline.test.tsx`, 21 cases, green across the
 * move).
 *
 * ── Phase 200-07 (DES-02 · `200-CHECKLIST.md` §4) — THIS MODULE FINALLY HAS ITS OWN SUITE ──
 *
 * ⚠ IT WAS UNPINNED FOR ITS ENTIRE LIFE, while being D-06's natural home. Every guarantee
 * below was exercised only TRANSITIVELY, through `PhaseCard` / `PhaseTimeline` renders —
 * and the count gate's own §187-29 correction says exactly why that is not enough:
 * *"a pinned TOTAL rising proves nothing about the NEW cases, because slack inside an
 * already-listed file absorbs them."* `phaseStatusMeta.test.ts` is the direct guard, pinned
 * in the commit that created it (the 196-05 / 196-07 rule: *"an unpinned file is not a
 * lightly-guarded one, it is an UNGUARDED one"*).
 *
 * ⚠ THE TWO INVARIANTS THAT SUITE EXISTS TO HOLD, stated once here so a later editor meets
 * them before the diff rather than after it:
 *
 *  1. **`statusMeta()` MUST STAY TOTAL over the nine declared members, and must NEVER become
 *     a coalesced bracket read.** `Record<Phase["status"], StatusMeta>` makes the compiler
 *     the parity guarantee for every DECLARED member and says nothing whatever about an
 *     INHERITED one — so an own-property guard with an explicit `unknown` row is the shape,
 *     and the tempting one-liner returns a FUNCTION for a prototype key rather than firing
 *     its fallback. (The forbidden expression is deliberately not spelled anywhere in this
 *     file: this plan's acceptance greps this source for it and a docblock quoting the
 *     needle would make its own guard read `1` instead of `0` — the 187-24 trap, which has
 *     now fired on five separate files in this phase.)
 *  2. **No word a person reads may be interpolated from a raw status member** (WR-05). The
 *     table holds the words; `statusWord` is the only door to them.
 *
 * ⚠ THIS MODULE HOLDS WORDS AND NO DERIVATION, and that split is deliberate rather than
 * incidental. D-06's nine timing arms live in `components/workflows/phaseDuration.ts` —
 * shared with the run page, so the panel half and the page half provably cannot disagree
 * about a duration. A second arm added here would be that disagreement's first day.
 *
 * ⚠ THE GLYPH-COUNT EVIDENCE MOVED WITH THE TABLE. `STATUS_META["recorded-not-sent"]`'s
 * comment argues its mark was chosen because a rejected alternative already means CANCELLED
 * elsewhere, and rests that claim on the rejected mark's occurrence COUNT *in the file the
 * table lives in*. That file is now THIS one. The claim is unchanged and still true; the
 * file it is true OF is what moved. Recorded so a future reader checking the count looks
 * here rather than concluding the evidence evaporated.
 */
import type { Phase } from "@/types"

// ── STATUS_GLYPH (DATA-CONTRACT §5.3) — status → glyph + REAL text + AA color
//    token (non-color-alone, UI-SPEC §A11Y). Status text uses --color-text /
//    --panel-status-* (≥4.5:1) — NEVER --muted-foreground-dim (3.59:1 fail).
//    `retrying` text reads "Attempt N" (filled in at render from phase.attempt). ──
export interface StatusMeta {
  glyph: string
  /** Base text (retrying substitutes "Attempt N" at render). */
  text: string
  /** Tailwind class for the AA-contrast status text color. */
  textClass: string
}
const STATUS_META: Record<Phase["status"], StatusMeta> = {
  pending: { glyph: "○", text: "Locked", textClass: "text-panel-muted-foreground" },
  running: { glyph: "●", text: "Running", textClass: "text-[hsl(var(--panel-status-active))]" },
  done: { glyph: "✓", text: "Complete", textClass: "text-[hsl(var(--panel-status-done))]" },
  // Lightened red text on the dim fill clears 4.5:1 (UI-SPEC §A11Y contrast note).
  failed: { glyph: "✕", text: "Failed", textClass: "text-[hsl(0_80%_80%)]" },
  // WR-04: the pill LABEL TEXT uses the LIGHTENED --accent-violet-text (9.83:1
  // dark / 8.52:1 light) to clear the ≥4.5:1 normal-text floor. The base
  // --accent-violet (text-accent-violet/border-accent-violet) is graphic-level
  // (≥3:1) and stays on the glyph + the card border below (UI-SPEC §Color).
  retrying: { glyph: "↻", text: "Attempt", textClass: "text-accent-violet-text" },
  skipped: { glyph: "⤳", text: "Skipped", textClass: "text-panel-muted-foreground" },
  // Phase 189 Plan 08 (CONN-01 / D-07) — ADDED, nothing above changed.
  // This row exists because the compiler demanded it: `Phase["status"]` gained
  // `"recorded-not-sent"` so the governed external-action step's terminal could stop being
  // absorbed by `done`, and `Record<Phase["status"], …>` then forced the developer panel to
  // state that honestly too. That forcing is the mechanism, not collateral damage — it was
  // observed as a real TS2741 on this table before this row was written.
  //
  // WHY NOT REUSE A SHIPPED WORD: none of the six above is true of this state. `Complete`
  // claims the send happened, `Failed` claims something went wrong, `Skipped` claims the
  // step did not run — and it DID run, and a person DID approve it. D-07 requires the
  // not-sent state be distinct from passed and done at every surface it renders.
  //
  // The glyph below is INHERITED from the unicode arrow set rather than invented, and it was
  // CHOSEN BY MEASUREMENT: it appears ZERO times across `frontend/src` today, so it arrives
  // carrying no other meaning. The obvious alternative — the circled-slash mark — was
  // rejected although it reads well, because it already means CANCELLED on the run band
  // (`pages/WorkflowRunPage.tsx`) and *no longer offered* in the admin model-discovery
  // panel, and one glyph carrying two meanings is what the icon convention forbids. That
  // rejected mark is NOT re-spelled in this comment on purpose: its occurrence COUNT in
  // this file is the evidence for the claim, and prose that spells it makes the count
  // unreadable (the 187-24 lesson). It is asserted against by name in the suite instead.
  // `text-panel-muted-foreground` is the same AA-cleared muted token
  // `pending`/`skipped`/`unknown` already use: this is a quiet terminal, not an alarm, and
  // spending a warning colour on a step that behaved exactly as designed would read as a
  // fault the run never raised.
  //
  // ⚠ THE PANEL KEEPS ITS OWN VOCABULARY. `Not sent` here and the canvas's business
  // sentence for the same state are two words for one state, which is CORRECT and is a
  // shipped rule (`lib/phaseState.ts` — the panel has harness words, the canvas has
  // business words, and only the DERIVATION is shared). The canvas sentence is deliberately
  // not repeated in this file.
  "recorded-not-sent": { glyph: "↛", text: "Not sent", textClass: "text-panel-muted-foreground" },
  // Phase 188 Plan 02 (RUNVIZ-02 / D-188-08 / D-188-06) — ADDED, nothing above changed.
  // This row exists because the compiler demanded it: `Phase["status"]` gained
  // `"unknown"` so `reconcilePhases` could stop resolving an unrecognised
  // `workflow_phases.status` to `done`, and `Record<Phase["status"], …>` then forced the
  // developer panel to state that honestly too. That forcing is the mechanism, not
  // collateral damage. The `?` is INHERITED from `VERDICT_MARK.unknown`
  // (`workflows/nodePresentation.ts:185`) rather than invented — 188 spends zero net-new
  // glyphs. `text-panel-muted-foreground` is the same AA-cleared muted token
  // `pending`/`skipped` already use; `--panel-*` is correct HERE because this is a
  // panel-scoped surface (it is the RUN surface, on `--background`, where it is forbidden).
  unknown: { glyph: "?", text: "Unknown", textClass: "text-panel-muted-foreground" },
  // Phase 194 Plan 04 (RUN-01 / D-04 / D-07 / D-13 / D-17) — ADDED, nothing above changed.
  // This row exists because the compiler demanded it: `Phase["status"]` gained `"cancelled"`
  // so the phase that was RUNNING when a person stopped the run could stop being absorbed by
  // `unknown`, and `Record<Phase["status"], …>` then forced the developer panel to state it.
  // That forcing is the mechanism, not collateral damage — it was observed as a real TS2741
  // on this table (one of ELEVEN the widening armed) before this row was written.
  //
  // WHY NOT REUSE A SHIPPED WORD: none of the eight above is true of this state. `Complete`
  // claims the step finished, `Failed` claims something went wrong, `Skipped` claims it never
  // ran — it DID run, and a person ended the run underneath it — `Not sent` is 189's governed
  // external-action terminal and has nothing to do with a stop, and `Unknown` claims we cannot
  // tell. We can: the database states it exactly. ⚠ AND `Unknown` IS WHAT SHIPPED HERE UNTIL
  // THIS ROW, measured on the unwidened tree rather than assumed — fail-CLOSED and therefore
  // not a lie, but not D-13's "the interrupted phase reads stopped, not failed" either.
  //
  // ⚠ THE SUBJECT IS THE STEP, NOT THE RUN, and the two words differ because the two subjects
  // do. The RUN-level word stays `cancelled` everywhere it already ships (`chat/RunCard.tsx`
  // and `pages/WorkflowRunPage.tsx` both render it, unchanged by this plan). A run is
  // cancelled; the step that was mid-flight when it happened was STOPPED. These are two words
  // for two different subjects, never two words for one concept.
  //
  // THE MARK WAS CHOSEN BY MEASUREMENT, and the measurement is in `194-04-SUMMARY.md` in full.
  // In short: it appears exactly ONCE in a render across `frontend/src` — `chat/RunCard.tsx`'s
  // glyph for the cancelled run state — and it carries NO second meaning anywhere, so this
  // panel becomes the second occurrence of one mark for one concept and 194 spends zero
  // net-new glyphs, which is `icon-convention.md` §4's actual requirement. The circled-slash
  // alternative was REJECTED although it reads well: it renders for cancelled on the run band
  // AND for "no longer offered" in the admin model-discovery panel, and one glyph carrying two
  // meanings is what the convention forbids. (That rejected mark is NOT spelled in this
  // comment, on purpose — the `recorded-not-sent` row above rests a shipped claim on its
  // occurrence COUNT in this file, and prose that spelled it would make the count unreadable.
  // Measured: that count is 0 before this row and 0 after it, so the shipped claim is
  // UNDISTURBED and owes no rewrite.) The sketch's `⏹` is refused outright — net-new, absent
  // from §4's table, and it owes a flagged proposal this plan is not the place to make.
  //
  // ⚠ ONE INHERITED FACT, RECORDED RATHER THAN FIXED HERE: the same square also ships as the
  // lucide `Square` STOP CONTROL at three sites (the composer, the active-runs tray, and the
  // panel's own Stop button added by 194-03). That is a control and this is a state, which is
  // exactly the distinction 194-03 drew when it refused this character for its BUTTON — so the
  // two decisions agree by construction rather than by luck. If a later phase decides a
  // control and a state may not share a shape, that is a convention change for the icon
  // convention to make across all five sites at once, not a thing to settle in one table.
  //
  // `text-panel-muted-foreground` is the same AA-cleared muted token
  // `pending`/`skipped`/`recorded-not-sent`/`unknown` already share: this is a quiet terminal,
  // not an alarm. Spending a warning colour on a step that did nothing wrong would read as a
  // fault the run never raised — the person stopped it on purpose and already knows.
  cancelled: { glyph: "■", text: "Stopped", textClass: "text-panel-muted-foreground" },
}

/**
 * The status atom. TOTAL: anything this table does not OWN reads as the declared
 * `unknown` row.
 *
 * ⚠ THE OWN-PROPERTY GUARD IS NOT CEREMONY (WR-04 site 3, 188.1-04), and it was measured
 * RED before it was written. This site was the sharpest of the five: the shipped
 * expression was a bare `STATUS_META[phase.status]` with NO FALLBACK AT ALL, so an
 * inherited name resolved to a FUNCTION and the header's status atom rendered its glyph,
 * its text and its colour class as `undefined` — an empty atom on a card still claiming
 * to show a phase. `Record<Phase["status"], StatusMeta>` makes the compiler the parity
 * guarantee for every DECLARED member (`lib/phaseState.test.ts:80-85` leans on exactly
 * that), and it says nothing at all about an inherited one. `phase.status` is derived one
 * function away from a server-supplied string — totality is a property of the lookup
 * rather than of its current callers (`lib/phaseState.ts:65-75`, the house argument).
 *
 * NO NEW VISUAL STATE WAS INVENTED. The fallback is the row this table ALREADY declares:
 * `unknown`, added by Phase 188 Plan 02 so an unrecognised `workflow_phases.status` reads
 * as *Unknown* and never as *Complete*. This guard is that same lesson applied to the key
 * space rather than to the value space, and it changes no shipped state because no
 * shipped status is a prototype key. Kept honest by
 * `panel/__tests__/PhaseTimeline.test.tsx`'s 188.1-04 falsification.
 */
export function statusMeta(status: Phase["status"]): StatusMeta {
  if (!Object.prototype.hasOwnProperty.call(STATUS_META, status)) return STATUS_META.unknown
  return STATUS_META[status]
}

/**
 * The PANEL WORD for a phase status — `STATUS_META`'s `text`, and nothing derived twice.
 *
 * ── REVIEW FINDING WR-05 · WHY THIS IS EXPORTED ──
 * `PhaseTimeline`'s doing-now line interpolated the internal `Phase["status"]` member
 * straight into user-visible copy: ``` `${activePhase.slug} — ${activePhase.status}` ```.
 * For the six pre-189 members that read tolerably (*notify — running*); for the member 189
 * added it read **`notify — recorded-not-sent`** — a kebab-case internal identifier, on the
 * one surface in this phase whose whole discipline (D-17) is that the STORED SLUG, the
 * PANEL WORD and the CANVAS SENTENCE are three deliberately different spellings. Every
 * other consumer in the phase routes through a vocabulary table; that one line bypassed
 * this one, which already held the correct word ("Not sent").
 *
 * Exported rather than duplicated, and it goes through `statusMeta` rather than indexing
 * `STATUS_META` directly, so the 188.1-04 own-property guard covers this caller too: an
 * inherited key answers *Unknown*, never a function's name or `undefined`.
 *
 * ⚠ `retrying`'s base text is the bare word "Attempt" — the card substitutes the number at
 * render from `phase.attempt`, which this function has no access to and must not invent.
 * Callers wanting the counted form read the card's own render path. Recorded so the seam is
 * a known limit rather than a surprise.
 */
export function statusWord(status: Phase["status"]): string {
  return statusMeta(status).text
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 252-04 (SC#5 hole 2 / D-26) — THE RUN ENDED AND THIS STEP NEVER REPORTED.
//
// ⛔ THIS IS DELIBERATELY *NOT* A KEY IN `STATUS_META`, and the distinction is the whole
// design. `STATUS_META` is `Record<Phase["status"], …>` and `Phase["status"]` is a WIRE
// TYPE — every row above exists because the backend can emit that member and the compiler
// then demanded the panel state it. This state is not on the wire and never will be: the
// backend emits nothing at all here, which is precisely the failure. Adding a tenth key
// would claim the server can send a status it cannot, and would make the next reader
// hunt for the emitter. So this is a PRESENTATION OVERRIDE, applied at read time by the
// function below, over a status the wire DID send (`running` / `retrying`) which has
// simply stopped being true.
//
// ⛔ WHY NOT REUSE A SHIPPED WORD: none of the nine is true of this state. `Failed` claims
// something went wrong — nothing did, on this step's own terms. `Skipped` claims it did not
// run; it DID. `Complete` claims it finished. `Stopped` is 194's word for a person ending
// the run, and nobody necessarily did. `Not sent` is 189's governed external-action
// terminal. `Unknown` claims we cannot tell which status it is — we can, we just never
// heard how it ended. "No outcome" says exactly that and claims nothing further.
//
// ⚠ THE GLYPH WAS CHOSEN BY MEASUREMENT, exactly as the `recorded-not-sent` row's was:
// it appears ZERO times across `frontend/src` today, so it arrives carrying no other
// meaning. It is inherited from the mathematical-operator block rather than invented — a
// line running into a bar. Its occurrence COUNT is the evidence, so no rejected candidate
// is spelled here: prose that spells one makes the count unreadable (the 187-24 lesson).
//
// `text-panel-muted-foreground` is the same AA-cleared muted token
// `pending`/`skipped`/`unknown`/`recorded-not-sent` already share. ⛔ NO WARNING COLOUR:
// the run ending is not this step's fault, and spending an alarm here would read as a
// fault nothing raised.
const INTERRUPTED_META: StatusMeta = {
  glyph: "⊣",
  text: "No outcome",
  textClass: "text-panel-muted-foreground",
}

/** The two wire statuses that ASSERT LIVENESS, and are therefore the only two a dead run
 *  can falsify. Every other member describes an outcome the run ending cannot revise. */
const LIVE_CLAIMING_STATUSES: ReadonlySet<string> = new Set(["running", "retrying"])

/**
 * The status reading for a phase, given what the CALLER knows about the run.
 *
 * ⛔ `runLive === undefined` means the caller holds no answer, and the honest render of
 * that is TODAY'S BEHAVIOUR — not the interrupted row. `PhaseTimeline` passes `undefined`
 * before its frame fetch resolves, and every other caller passes nothing at all; both must
 * be byte-unchanged. So the override fires ONLY on an explicit `false`.
 *
 * ⚠ It is a strict `=== false` rather than a falsy test for that exact reason.
 */
export function statusMetaForRun(status: Phase["status"], runLive?: boolean): StatusMeta {
  if (runLive === false && LIVE_CLAIMING_STATUSES.has(status)) return INTERRUPTED_META
  return statusMeta(status)
}
