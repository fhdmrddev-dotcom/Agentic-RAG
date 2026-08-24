# Phase 192.2 — Does This One Work? · CONTEXT

**Authored 2026-08-19 from the sketch-179 session**, not from a `/gsd:discuss-phase` run. Every
decision below was settled with the operator in conversation and is backed by a measurement taken
during that session, not by assumption. Recorded here so the planner inherits the reasoning rather
than re-deriving it.

## <decisions>

**D-01 — The card language is settled: sketch 179, variant C.** Operator picked C on 2026-08-19.

| Slot | Carries |
|---|---|
| gutter, 3px | last-run outcome — worked / failed / never run. Colour, **and never colour alone** |
| line 1 | the **name**, dim mono version right-aligned |
| line 2 | the run truth in words, then the state in **business** words |
| everything else | **cut** from the resting card |

**D-02 — C partially REFUTES sketches 177/178, and the refutation is the decision.** Both argued
*lead with lifecycle state; the name cannot be the differentiator*. **C keeps the name as the lead.**
What moved is the encoding, not the headline: outcome goes to the gutter, arriving peripherally.
A plan that demotes the name has misread the verdict.

**D-03 — The work is SUBTRACTION plus one field, not a redesign.** Rendering the real component
(sketch 179 variant A, dev route `/sketch-card`) showed the shipped card is **nine information rows
deep**. Six atoms leave the resting card: the purpose sentence, `needs kickoff_prompt`, the phase
glyphs, `STRICT`, `produces: … · file`, and the two-line fork-consequence paragraph.

**D-04 — LIB-05 stays COMPLETE and must not be re-opened.** The shipped identity line already renders
`3 share this name · changed 2 days ago` — confirmed on screen. Four prior sketches treated the
repeated-name problem as unsolved; it ships today. LIB-06 is a different question: not *which is
which* but *which is worth running*.

**D-05 — G-5 is discharged FIRST, in Wave 1, before the feature.** `WorkflowCard.tsx` (8 commits /
3 phases / 818 lines) carries an obligation undischarged since sketch 175. The lead/defer decision
lands in a **presentation module** — one place that resolves what a row leads with and what defers,
so the three library surfaces share ONE language instead of three copies. This is the order D-01 of
Phase 192.1 required and honoured.

⚠ **Confirmed against the file, not assumed:** the state pill sits in a *different flex child* from
the name (`flex flex-none items-center gap-1` on the right vs `min-w-0` on the left). Any reordering
crosses a structural boundary — **it is not a CSS change.**

**D-06 — Two defects found by reading the component are folded here.** The card's marks are **emoji**
(`📄 ✨ 📝` in `ROW_FACE`), against our single-source icon convention; and the state words are
**system vocabulary** (`published` / `draft`) rather than business words.

**D-07 — The backend half is a JOIN, not a migration.** `workflow_runs` already holds the data. Add
`last_run_at` + `last_run_status` to `PublishedWorkflow` and `WorkflowDraftRow` via a
`LEFT JOIN LATERAL`, normalize onto `LibraryRow`. **No new table, no new writes, no migration.**

**D-08 — Three arms, never two.** A row with no run renders an explicit *"Never run"*. A feed that
does not carry the keys renders *unknown*. ⚠ **Neither may render blank, a fabricated time, or a
green tick.** The frontend must survive a backend deployed behind it — the `updated_at` docblock in
`api.ts` is the house precedent and says exactly this.

## <constraints>

- **No new hex.** Deep Midnight tokens only.
- **No emoji anywhere on the card** (D-06 removes the existing ones; do not add more).
- **Colour is never the only carrier** — every coloured state says its word.
- **Feed-level only.** Run facts arrive with the list; **no per-card fetch** (107+ rendered rows).
- ⚠ **`updated_at` is NOT a run time.** On a published row it is the *publish* time, deliberately
  and documented as such. Do not conflate them; do not "fix" it.
- **The three library surfaces share the presentation module** — no second copy of the language.

## <measurements>

Taken against the live local DB, 2026-08-19. Test rows (`Global WF`, `Preview WF`) excluded.

| Fact | Value |
|---|---|
| real rows / distinct slugs / distinct names | **117 / 96 / 37** |
| `Compliance Gap Report` | **43 rows across 41 DISTINCT slugs** — 41 separate workflows, not versions |
| drafts | **81 of 117 (69%)** |
| `business_requirement` populated | **16 / 117 — 14%** ❌ cannot carry the differentiator |
| non-empty `phases` | **28 / 117 — 24%** ❌ cannot either |
| **≥1 run, published rows** | **32 of 36 — 89%** ✅ |
| `workflow_runs` | **228 rows** — 186 completed · 31 failed · 11 cancelled |

⚠ **Collapsing versions does not help** (117 → 96). The duplicates are distinct workflows.

## <deferred>

- **Renaming / de-duplicating the 41 same-named workflows.** A data-hygiene problem, not a card
  problem. Sketch 162-B's rename prompt is the product's existing answer.
- **`business_requirement` as a card atom.** At 14% populated it cannot lead. Re-open trigger:
  authoring starts requiring a requirement, pushing that figure past ~70%.
- **Run *duration* and run *counts* on the card.** Available, but they lose to outcome + recency on a
  card this quiet. Re-open trigger: an operator asks "how long does this take?" from the library.

## <verification-notes>

- **G-2 SATISFIED** — sketch 179, winner C, `.planning/sketches/179-what-the-eye-lands-on-honestly/`.
  It is the project's first sketch that RENDERS the shipped component, so `SEED-155` cannot recur.
- **G-1 does not fire** — only one prior `192.x`.
- **G-4 rows must be driven on the real library**, not on the dev route, and must locate rows by
  reading the screen — **never by `getElementById`** (D-27, the rule Phase 192's own re-drive broke).
- ⚠ **Teardown owed inside this phase**: `frontend/src/dev/SketchLibraryCard.tsx` and the
  `/sketch-card` branch in `frontend/src/main.tsx` delete together once the real card lands.
