---
phase: 189
plan: 13
subsystem: frontend-canvas-vocabulary-presentation
tags: [wave-6, same-commit-two-maps, split-brain-property, wr-04, falsification-plants, tripwires-discharged, deferred-item-closed, prose-correction]
requires:
  - "189-12 — external_action in PhaseTypeId / PHASE_TYPE_ORDER / SLUG_BASE / requiredConfigFor (the type this plan gives a face to)"
  - "189-04 — D-189-DEF-02, the author-facing-rail deferred item, carried explicitly to this plan"
  - "frontend/src/components/workflows/soulData.ts PHASE_GLYPHS + frontend/src/lib/phaseGlyph.tsx PHASE_GLYPH_MARKS (the same-commit pair, 127-01 / 184-01)"
  - "frontend/src/components/workflows/phaseVocabulary.ts derivedFace — the numbered ladder 187-04 built"
  - "@iconify-json/fluent-emoji@1.2.7 — ALREADY INSTALLED; this plan installs nothing"
provides:
  - "the 7th 3D mark — external_action -> outbox-tray, in BOTH glyph maps in ONE commit"
  - "PHASE_GLYPH_MARK_KEYS — the exported key list that makes the split-brain rule machine-checkable"
  - "the split-brain guard as a PROPERTY: the two maps' key SETS are identical, so a ninth type inherits it"
  - "ICON_TINT.external_action = hsl(310 85% 66% / 0.38), and the six-count pin DERIVED from the glyph vocabulary"
  - "the three per-type words: Reach outside / Stops for your approval before it acts outside / External action"
  - "EXTERNAL_CAPABILITY_SENTENCES — the D-13 tier-4 map, EXPORTED as ONE constant for 189-14's picker"
  - "derivedFace tier (4), an INTEGER tier on a NAMED gate, with tiers 4->5 and 5->6 renumbered"
  - "notConnectedOf — the badge slot-1 predicate, type test and state test on SEPARATE lines"
  - "PhaseNodeData.notConnected + one delegating line in buildPhaseData"
  - "the canvasModel PHASE_TYPE_SUBTITLES read is now own-property guarded (WR-04) — one unguarded sink closed"
  - "D-189-DEF-02 CLOSED — five cases fencing the author-facing rail away from external_action"
affects:
  - "189-14 — imports EXTERNAL_CAPABILITY_SENTENCES for its picker labels; owns the §7b picker-selection question named below"
  - "189-15 — one of its six reserved-slot prose sites (canvasModel.ts) was corrected HERE, in the commit that falsified it; it must re-derive"
  - "189-16 — UAT row U1 (the rendered luminance of the 📤 on Deep Midnight) is the check jsdom structurally cannot make"
  - "the tree's tsc baseline: 33 -> 33, unmoved. The count gate: 2560 -> 2587."
tech-stack:
  added: []
  patterns:
    - "a same-commit two-file invariant upgraded from a docblock sentence to an asserted key-set PROPERTY"
    - "exporting the KEYS of a private lookup table rather than the table, so the guard is testable and the own-property guard cannot be bypassed"
    - "a discharged tripwire REWRITTEN in place to the finished claim, never deleted (the gate refuses a per-file decrease, and a deletion drops the only assertion)"
    - "four wrong fixes planted into production source, each observed RED and each attributable to one named case"
decisions:
  - "PHASE_GLYPH_MARK_KEYS exports the KEYS, not the MAP. Handing out the map would let a caller read a mark without phaseGlyph()'s own-property guard, which is the [Function Object] React child that hard-crashed a node face before 188.1-04. A key list cannot be misused that way."
  - "The ICON_TINT coverage assertion lives in PhaseNodeCard.test.tsx (which already imports ICON_TINT and DEFAULT_TINT and already owns the tint pin), NOT in soulData.test.ts. It asserts every GLYPH-vocabulary key has a tint and that none of them equals DEFAULT_TINT — the floor stays for an unknown discriminator, but a SHIPPED type reaching it would be a missing tint, and those two must not look alike."
  - "⚠ THE PICKER ROW FOR external_action READS \"Sends an email\", NOT UI-SPEC §6d's predicted \"Reach outside\" — and that is the resolution of 189-12's open question, not a drift. A step placed from that row arrives with capability: send_email (189-12's requiredConfigFor), so D-13's tier 4 fires. The property that binds is WR-03: THE ROW PREVIEWS THE CARD THAT LANDS. Making the row say \"Reach outside\" while the placed card says \"Sends an email\" would break it."
  - "The tier-3 floor (\"Reach outside\") is REACHABLE and driven — it is the face of a stored phase whose capability is absent or unrecognised. UI-SPEC §7b's \"no row selected\" PICKER state is explicitly ASSIGNED TO 189-14, which owns ExternalActionSection."
  - "Two slot-1 reservation prose sites were corrected HERE rather than left for 189-15: canvasModel.ts's `grounded` docblock and phaseVocabulary.ts's badge-slot section header. Both live in files this plan edits and both were falsified BY this plan's own diff. ⚠ The phaseVocabulary.ts site is a SEVENTH site neither CONTEXT's list of five nor UI-SPEC's list of six contains."
  - "canvasModel.ts's WR-04 guard is the INLINE hasOwnProperty form rather than an import of ownProperty.ts — matching its two shipped siblings (nodePresentation.ts, runVocabulary.ts) and avoiding a new importer of a module inside the fenced card subtree."
metrics:
  duration: "~150 min"
  completed: 2026-08-07
  tasks: 3
  commits: 3
  files_created: 0
  files_modified: 14
  tests_added: 25
---

# Phase 189 Plan 13: The Seventh Type Gets Its Face Summary

**`external_action` now has one 3D mark, one tint, three words, a capability-derived
sentence and the predicate its badge will read — and the two invariants that could
silently break were upgraded from docblock sentences into machine-checked properties.**
The glyph's two maps were swapped in ONE commit and their key sets are now asserted
IDENTICAL (observed RED against a one-sided plant AND against a missing-slug build);
D-13's tier is an INTEGER tier on a NAMED gate whose lookup is own-property guarded; two
WR-04 sinks are guarded where there was one unguarded before; and `D-189-DEF-02` is
closed with five cases, four of which went RED against the exact wrong fix.

## The commits

| SHA | Task | Scope |
|---|---|---|
| `f5ba6c5a` | 1 | the 7th mark in BOTH glyph maps, the tint, the split-brain property, the 3D-mark tripwire discharged |
| `6712f314` | 2 | the three words, the D-13 tier, `notConnectedOf`, the canvasModel WR-04 fix, the vocabulary tripwire discharged |
| `5963ba4b` | 3 (deviation) | `D-189-DEF-02` closed — the author-facing rail fenced away from `external_action` |

```
$ git show --stat f5ba6c5a | tail -9
 .../components/workflows/PhaseNodeCard.test.tsx    | 28 +++++++-
 .../components/workflows/StepTypePicker.test.tsx   | 37 +++++++---
 .../src/components/workflows/nodePresentation.ts   | 16 +++++
 frontend/src/components/workflows/soulData.test.ts | 80 ++++++++++++++++++++--
 frontend/src/components/workflows/soulData.ts      | 15 ++++
 frontend/src/lib/phaseGlyph.tsx                    | 37 ++++++++--
 scripts/vitest-count-gate.cjs                      | 27 +++++++-
 7 files changed, 216 insertions(+), 24 deletions(-)

$ git diff --diff-filter=D --name-only f5ba6c5a~1..HEAD    →  (empty; no deletions in any commit)
```

**⚠ Task 1's acceptance criterion is satisfied by construction and by measurement:
`soulData.ts` and `lib/phaseGlyph.tsx` are both in the `f5ba6c5a` stat above.** That was
not a convenience — `phaseGlyph.tsx:34` states the rule verbatim (*"swapping one alone
leaves `phaseGlyph()` returning the old component while the string fallback changed, a
silent split-brain"*), and the plant below shows exactly what a split commit produces.

---

## ⚠ HOW THE ICON SLUG'S PRESENCE WAS VERIFIED — read, not trusted

The plan, UI-SPEC §5a and the executor prompt all assert `outbox-tray` is present. **None
of them was believed.** The INSTALLED package's own icon data was read directly, this
session, before the import was written:

```
$ node -e "const p=require('./node_modules/@iconify-json/fluent-emoji/package.json');
           const d=require('./node_modules/@iconify-json/fluent-emoji/icons.json'); …"
version 1.2.7 · icons 3174
outbox-tray    PRESENT
outbox         ABSENT        ← the empty-icon trap
gear / memo / compass / handshake / raised-hand / package   all PRESENT
```

**And presence was proved SUFFICIENT for the build, by falsification.** The bare `outbox`
was planted into the import path and `npx vite build` was run:

```
$ npx vite build            # with `~icons/fluent-emoji/outbox`
✗ Build failed in 3.62s
error during build:
Error: Icon `fluent-emoji/outbox` not found

$ npx vite build            # restored
✓ built in 29.68s
```

So *"a missing slug FAILS THE BUILD"* is a measurement in this repository today, not an
inherited claim — which is the verify-or-bundle discipline stated as a mechanism.

⚠ **Presence is NECESSARY, NOT SUFFICIENT for VISIBILITY**, and this plan cannot close
that half. `llm_batch_agents` once shipped a slug that existed and measured *luminance
34.5 on Deep Midnight, ~4× dimmer than the other five, and disappeared*. UI-SPEC's
palette estimate puts `outbox-tray` at **168.4**, inside the shipped band (`package`
148.2 … `handshake` 189.0) — but that is an unweighted palette figure, and **jsdom
applies no CSS and paints nothing**. The rendered check is **UAT row U1** (Chrome MCP,
plan 189-16), and that sentence is written into `soulData.test.ts`'s own comment so the
green there is never mistaken for the visual proof.

---

## ⚠ THE SPLIT-BRAIN GUARD — RED OBSERVED, and the shape of the fix

**Before:** `soulData.test.ts` asserted the six glyph keys INDIVIDUALLY. That is not the
same rule: six comparisons stop covering the moment a seventh type arrives, which is
precisely when the rule matters.

**After:** ONE property — `Object.keys(PHASE_GLYPHS)` and `PHASE_GLYPH_MARK_KEYS` are
asserted to be the same set — so a **ninth** type inherits the guard with nobody
remembering to extend a list.

**PLANT Y — the key added to only ONE map** (the literal split-brain), driven into
`lib/phaseGlyph.tsx`:

```
×  the two maps have IDENTICAL KEY SETS (the same-commit rule, as a property)
   AssertionError: expected [ 'llm_agent', …(5) ] to deeply equal [ Array(7) ]
×  the property is FALSIFIABLE — a one-sided key fails the same comparison
   AssertionError: expected false to be true
×  every slug in the string map resolves to a bundled component, none to null
   AssertionError: expected null not to be null
3 failed | 14 passed (17)
```

Restored by `cp` from a pre-plant backup and verified by **md5**
(`5dbf981eff46f3fc05ddb2670d3bab56`, identical before and after) with
`grep -c "PLANT"` → **0**.

**The design decision inside it:** `PHASE_GLYPH_MARK_KEYS` exports the **keys**, not the
map. Exporting the map would let a second consumer read a mark WITHOUT `phaseGlyph()`'s
own-property guard — and an inherited key read that way is the `[Function Object]` React
child that hard-crashed a whole node face before 188.1-04. A key list cannot be misused
that way.

**THE REWRITE DID NOT REDUCE THE FILE'S COUNT**, which the plan flagged as a trap: the six
individual key assertions were **kept** and the seventh added beside them, with the
property added as new cases. `soulData.test.ts` **14 → 17**, read from the gate's own
`actual` column.

---

## The three new words, each beside a shipped sibling from its own map

| Map | Register | A shipped sibling | 189's entry |
|---|---|---|---|
| `PHASE_TYPE_SENTENCES` (business voice — the tier-3 FLOOR) | verb-first, what it does for you | `llm_single: "Write it up"` | **`external_action: "Reach outside"`** |
| `PHASE_TYPE_SUBTITLES` (mechanism voice — the ONE supporting line) | third-person, how it works | `llm_human_input: "Pauses here until you answer"` | **`external_action: "Stops for your approval before it acts outside"`** |
| `PHASE_TYPE_LABELS` (⌥ Technical-names reveal) | terse technical noun | `llm_emit: "Deliverable"` | **`external_action: "External action"`** |

**No phrase is reused across the three, and that is now a test** over the whole
vocabulary rather than a claim about the new row.

⚠ **The subtitle is worded to SURVIVE PHASE 190** and is asserted to be:
`expect(PHASE_TYPE_SUBTITLES.external_action).not.toMatch(/not sent|nothing is sent|never sends/i)`.
It says nothing about not-sending, so it does not become a lie the day the node is wired
up. The not-sent fact is carried by the badge (design time, D-12) and the run word (run
time, D-16), which is where those decisions put it.

---

## D-13 — the tier, and WHY it is (4) rather than (3.5)

```
(1) BOUND SKILL          `Run the ${skillName}`                   — ungated
(2) TEMPLATE             `Fill ${templateFilename}`               — GATED on llm_emit
(3) FOLDER SCOPE         `Search ${folderName}`                   — GATED on GROUNDING_DIAL_TYPES
(4) EXTERNAL CAPABILITY  Sends an email / Creates a ticket /
                         Posts a message                          — GATED on external_action   ← NEW
(5) HUMAN INPUT          "Wait for your approval"                 — GATED on llm_human_input   (was 4)
(6) otherwise NULL       the honest floor                                                       (was 5)
```

Tiers (1)-(3) all read a NAME out of the injected `NameContext` and **can** fabricate;
tiers (4) and (5) read the config alone and **cannot**. The capability tier is therefore a
sibling of HUMAN INPUT, not of the three name-reading tiers — so it sits directly above it
and the two below were **renumbered**, not decimalised. A `3.5` would defeat the ordering
test the numbering exists to force, and it invites a `3.75`.

**The numbering is asserted on the SOURCE** (integers `(1)`…`(6)` present, no
`/\/\/\s*\(\d+\.\d+\)/` anywhere) with a positive control proving the decimal regex really
matches a decimal tier — because a comment convention is exactly the kind of claim nothing
else checks.

**The gate is a NAMED module-scope constant** (`EXTERNAL_ACTION_PHASE_TYPE`), following
`HUMAN_INPUT_PHASE_TYPE`'s form, and that is asserted on the source too.

### The WR-04 guard is the INLINE form, and the file still has ZERO imports

```
$ grep -c "^import " frontend/src/components/workflows/phaseVocabulary.ts
0
```

Asserted mechanically as well (`expect(phaseVocabularySource).not.toMatch(/^import\s/m)`,
with a positive control). Importing the shared `ownProperty` helper would have made this
change the file's first import ever; the `runVocabulary.ts:103-107` inline precedent is
copied instead.

### `GROUNDING_DIAL_TYPES` — READ, never edited

Pinned by membership (`toEqual(["llm_agent","llm_batch_agents"])`) **and** by its
consequence (a folder bound on an `external_action` step still faces nothing). The gate
stays correct for this type: its three capabilities are disjoint from the KB tools, so the
step reads no knowledge base, carries no ⛨ seal, and is free to think **by construction**
— correct, not a gap.

---

## ANTI-VACUITY: FOUR PLANTS INTO PRODUCTION SOURCE, EVERY ONE RED

All four driven into `phaseVocabulary.ts`, observed, removed; restore verified by md5
(`f759cd0aa228577d52bdd5184a23192e`) with `grep -c "PLANT"` → **0** across all five
production files this plan touches.

### PLANT Z1 — the PLAUSIBLE wrong fix: a bare lookup with a `??` floor

The one a reviewer would wave through, which is exactly why it had to be falsified:

```
×  WR-04: an INHERITED key falls through — `constructor` never reaches the face
   AssertionError: expected [Function Object] to be null
×  the WR-04 guard is the INLINE form — this module still has ZERO imports
2 failed | 161 passed
```

**`[Function Object]`, verbatim** — the same measured value that hard-crashed a node face
at 188.1-04, one map along. This is why the guard is not ceremony.

### PLANT Z2 — the UNGATED tier (any type carrying a capability claims the face)

```
×  THE GATE: no OTHER phase type can claim a capability face
   AssertionError: expected [ 'Sends an email', …(2) ] to not include 'Sends an email'
×  the ladder is numbered with INTEGERS and gated on NAMED constants, not literals
2 failed
```

### PLANT Z3 — the FABRICATED face (`"Reaches an external service"` for an unknown name)

```
×  an UNRECOGNISED stored capability falls through and NEVER fabricates a face
   AssertionError: expected 'Reaches an external service' to be null
×  WR-04: an INHERITED key falls through
2 failed
```

T-189-39 (spoofing — a fabricated face claiming a capability the step does not have) is
mitigated by a test that has now been observed failing.

### PLANT Z4 — the FUSED one-liner Phase 190 would have to unpick

```
×  the TYPE test and the STATE test are on SEPARATE LINES (the Phase-190 seam)
1 failed
```

**Exactly one failure, attributable to the one claim.** D-12 chose a STATE-conditional
badge over a TYPE-conditional one so 190 edits ONE line and neither the adapter,
`PhaseNode.tsx` nor the card is re-opened. That shape is now asserted rather than
described.

### PLANT Z5 — the D-20 hole, one language up (see the deviation below)

---

## THE FIXED WR-04 SINK — before and after

`canvasModel.buildPhaseData` held the **only read of `PHASE_TYPE_SUBTITLES` outside its
own declaration**, and it was unguarded.

**BEFORE:**

```ts
subtitle: PHASE_TYPE_SUBTITLES[phaseType] ?? "",
```

**AFTER:**

```ts
subtitle: Object.prototype.hasOwnProperty.call(PHASE_TYPE_SUBTITLES, phaseType)
  ? PHASE_TYPE_SUBTITLES[phaseType]
  : "",
```

**Why the shipped `?? ""` was not enough, restated because it is counter-intuitive:** the
map is a plain object literal, so `PHASE_TYPE_SUBTITLES["constructor"]` is the `Object`
FUNCTION — never nullish — and the fallback does not fire. A table MISS behaved correctly
and always did; only an INHERITED key distinguishes the guard from its absence, which is
why the probe is a **separate case** rather than another line in the existing
unknown-type one.

⚠ **Two WR-04 sinks are now guarded where there was one unguarded before** — the new
capability lookup, and this pre-existing one.

---

## ⚠ THE TWO TRIPWIRES 189-12 ARMED — both fired, both DISCHARGED

189-12 pinned two falsifiable exclusion lists in `StepTypePicker.test.tsx` so its
intermediate state could not outlive its reason. Both went RED on arrival, exactly as
their comments promised.

| List | 189-12 said it was owed by | MEASURED owner | Outcome |
|---|---|---|---|
| `TYPES_AWAITING_A_3D_MARK` | 189-13 | ✅ 189-13 | emptied in `f5ba6c5a` |
| `TYPES_AWAITING_A_VOCABULARY_ENTRY` | **189-14** | ⚠ **189-13** — this plan owns all three vocabulary maps; 189-14 owns the capability PICKER | emptied in `6712f314` |

**Both cases were REWRITTEN IN PLACE, never deleted**, for two reasons stated together:
the gate refuses a per-file decrease (deleting an `it(` would have blocked the run at
`[count-decrease]`), and deleting the case would have dropped the only assertion that no
row is sitting on the `•` floor. `StepTypePicker.test.tsx` stays at **46** and its pin was
deliberately **not** moved.

The constants are kept at `[]` rather than removed, so the MECHANISM is visible the next
time a phase type arrives ahead of its mark.

---

## ⚠ 189-12's UNFINISHED BUSINESS — resolved, and the half that is ASSIGNED

**The question, as 189-12 handed it over:** `requiredConfigFor` emits a REAL capability
(`send_email`) because `capability` is a closed `Literal` and `""` would 422 the whole
definition on first save. Consequence: *"a node placed from the picker no longer reaches
[UI-SPEC §7b's 'Nothing chosen yet'] state."*

**RESOLVED — the node-face half, here.** The floor is **reachable and driven**: a stored
phase whose `capability` is absent, non-string, unrecognised or an inherited name falls
THROUGH to `"Reach outside"` and never fabricates. That is five cases in
`phaseVocabulary.test.ts`, three of them observed RED under plants. So the state UI-SPEC
§9 calls *"Not configured"* is exactly where 189-07's SUMMARY said it lives — a stored
value the client does not recognise — and it is now guarded rather than asserted.

**⚠ AND ONE CONSEQUENCE THE HANDOVER DID NOT NAME, found by RUNNING the suite:** the
**picker row** for `external_action` now reads **`Sends an email`**, not UI-SPEC §6d's
predicted `Reach outside`. `StepTypePicker` previews each row as
`nodeTitle(minimalPhaseFor(type…))`, and `minimalPhaseFor` emits the real default
capability, so D-13's tier 4 fires on the preview.

**This is a DECISION, recorded, not a drift accepted.** The property that binds is the one
that whole `describe` exists for — **WR-03: the row previews the card that LANDS** — and
the row is telling the truth: a step placed from it genuinely arrives saying "Sends an
email". Making the row say `Reach outside` while the placed card says `Sends an email`
would break WR-03 to satisfy a prediction written before 189-12's decision. The case was
rewritten with that reasoning inline, and it still forbids a FABRICATED verb
(`expect(Object.values(EXTERNAL_CAPABILITY_SENTENCES)).toContain(rowTitle(…))`).

**EXPLICITLY ASSIGNED TO 189-14 — the PICKER-SELECTION half.** UI-SPEC §7b's *"Three
radio-style rows, none selected"* state is not reachable from a placed node, because the
stored value is `send_email`. 189-14 owns `ExternalActionSection` and must decide, in
writing, between: (a) render `send_email` PRE-SELECTED, which is the honest reading of the
stored config and is this executor's recommendation; or (b) invent a representation of
"nothing chosen" that survives `model_validate` — which the D-15 fence in
`test_189_external_action_model.py` forbids making optional. **Nothing about that choice is
blocked by this plan.** The §7b *"no row selected"* rendering remains correct for the case
it was written for: an unrecognised stored value.

---

## Verification

**The plan's `<verification>` block, run:**

```
$ npx vitest run soulData.test.ts phaseVocabulary.test.ts canvasModel.test.ts
   (all green — 17 / 112 / 51)

$ npx tsc --noEmit -p tsconfig.app.json | grep -c "error TS"
33                        ← THE BASELINE, unmoved, and ZERO in any file this plan touched

$ npx vite build
✓ built in 4.41s          ← the real check that the icon slug resolves

$ node scripts/vitest-count-gate.cjs
  total   2587  2587  0
  count gate OK — 46/46 pinned files present, no per-file decrease, 0 failing.

$ npx vitest run src/components/workflows src/pages src/lib src/components/panel src/components/layout
  Tests  1 failed | 3116 passed (3117)
```

**The ONE failure is PRE-EXISTING and outside the gate's blast radius:**
`src/lib/model-info.test.ts > MODEL_INFO > costTier values` (`expected 'mid' to be
'high'`). Its last touching commit is `47a6294b feat(registry): add 2026 flagship models`
— nothing to do with this phase — and `src/lib` is covered by the gate only through the
named file `src/lib/phaseState.test.ts`, so it is not in the gate's run at all. 189-12
recorded the identical failure.

**The count gate, COUNT columns — not the `failed` column (`D-188.2-DEF-01`):**

| Point | total | files | pins moved |
|---|---|---|---|
| Baseline, re-derived before any edit | **2560** | 46/46 | — |
| After Task 1 | 2564 | 46/46 | `soulData` 14→17 · `PhaseNodeCard` 130→131 |
| After Task 2 | 2582 | 46/46 | `phaseVocabulary` 96→112 · `canvasModel` 49→51 |
| After Task 3 | **2587** | 46/46 | `PhaseFormPanel.rails` 27→32 |

⚠ **FIVE suites changed ASSERTIONS but not COUNTS and their pins were deliberately NOT
moved** — moving them would make the gate disagree with reality: `StepTypePicker.test.tsx`
(46), `phaseVocabulary.corpus.test.ts` (45), `panel/__tests__/PhaseTimeline.test.tsx` (17),
`canvasModel.fixtures.test.ts` (100) and `PhaseFormPanel.test.tsx` (19, untouched).
`BASELINE_TOTAL`'s prose note moved 2560 → 2587 in the same commits; the gate itself keeps
reading the `reduce`.

**⚠ Every count that moved was read from THIS SCRIPT'S OWN `actual` column, never
hand-counted.** And every count-bearing assertion this plan wrote or edited is DERIVED
(`PHASE_TYPE_ORDER.length`, `Object.keys(PHASE_GLYPHS).length`, a `>= 7` floor) rather than
re-pinned at 7 — 189-10 / 189-12's lesson, so the EIGHTH type does not read as a regression.

**Scope, verified by `git diff` rather than by intention:**

```
$ git diff --stat f5ba6c5a~1..HEAD -- <the six fenced card-subtree modules>   → (empty)
$ git diff --stat f5ba6c5a~1..HEAD -- backend/ supabase/                      → (empty)
$ git diff --diff-filter=D --name-only f5ba6c5a~1..HEAD                       → (empty)
$ grep -n "CARD_SUBTREE_PATHS).toHaveLength"                                  → :553  still 6
```

`PhaseNodeCard.test.tsx` WAS edited (its tint pin is this plan's, per 189-12) — that is the
card's TEST file, not one of the six fenced SOURCE modules, and the `CARD_SUBTREE_PATHS`
length pin is unmoved.

### Re-derived, not inherited

| Claim | How | Result |
|---|---|---|
| `tsc -p tsconfig.app.json` = 33 | run before any edit | ✅ **33** (and 33 after) |
| count gate 2508 / 45 files (the plan's `<context>`) | run before any edit | ⚠ **STALE — 2560 / 46/46.** The plan and UI-SPEC §13 both carried the pre-189-08 figure |
| `soulData.test.ts` pin = 14 · `PhaseNodeCard` = 130 · `phaseVocabulary` = 96 · `canvasModel` = 49 · `rails` = 27 | the gate's `pinned` column | ✅ all five confirmed |
| `PHASE_GLYPHS` is in `soulData.ts`, NOT `phaseVocabulary.ts` | symbol search | ✅ **`soulData.ts:43`** — the CONTEXT pointer was right to be corrected |
| `ICON_TINT` six-count pin at `PhaseNodeCard.test.tsx:796` | symbol search | ⚠ **`:800`** — off by 4 |
| `PHASE_TYPE_SUBTITLES` read is unguarded and is the ONLY read outside its declaration | grep + read | ✅ **CONFIRMED**, `canvasModel.ts` `buildPhaseData` |
| `phaseVocabulary.ts` has ZERO imports | `grep -c "^import "` | ✅ **0**, before and after |
| `outbox-tray` present / `outbox` absent in the INSTALLED set | read `icons.json` | ✅ **PRESENT / ABSENT**, 3174 icons, v1.2.7 |
| a missing slug fails the build | **planted and observed** | ✅ `Error: Icon \`fluent-emoji/outbox\` not found` |
| `TYPES_AWAITING_A_VOCABULARY_ENTRY` is 189-14's | read the plans | ⚠ **FALSE — it is 189-13's.** This plan writes the sentences; 189-14 writes the picker |
| `phaseVocabulary.corpus.test.ts:221` pin is 189-14's (189-12's note) | read the derivation | ⚠ **FALSE for the same reason** — moved here |
| the D-21 `canvasModel.ts:201-203` correction is this plan's | grep the sibling plans | ⚠ **NO — it is 189-15's.** Left untouched |
| the generic tool rail renders for `external_action` (D-189-DEF-02's premise) | read `PhaseFormPanel.tsx` | ⚠ **FALSE at HEAD** — six mutually exclusive `pt ===` branches, no default arm. See Deviation 1 |

---

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] `D-189-DEF-02` was closed, and the deferred item's PREMISE was measured FALSE first

- **Found during:** Task 2, reading `PhaseFormPanel.tsx` for the rail.
- **Issue:** the executor prompt carries `D-189-DEF-02` as a security-shaped item this plan
  must close — *"the author-facing tool rail shows a registry-less name struck through and
  still pressable"*. It is not in the plan's `files_modified`.
- **What was MEASURED before anything was written:** the rail is **already unreachable**
  for this type. `PhaseFormPanel.tsx` renders `ToolsField` inside exactly two mutually
  exclusive branches (`pt === "llm_agent"`, `pt === "llm_batch_agents"`) and the render body
  has **no default arm** — six `pt ===` branches, no fallback. So `external_action` gets no
  rail, no capability is painted struck through, and **no render code needed to change.**
- **What WAS missing — and it is the whole point:** a **mechanical guard**. "True today by
  construction" is exactly the claim a later branch silently falsifies, and this phase's
  own history is the argument (189-04's PLANT 2 proved the entire fidelity suite stays
  GREEN while the D-20 hole is open — V22 is the only thing that can see it).
- **Fix:** five cases in `PhaseFormPanel.rails.test.tsx` — no rail (nor the degraded one)
  for `external_action` with a non-vacuity floor that the panel DID render; a positive
  control that the identical rails DO produce a rail on `llm_agent`; no capability NAME
  anywhere in the panel HTML under three `toolOptions` shapes **including `"degraded"`**
  (which prints what the step already names); `toolOptions` NOT widened, asserted on source;
  and `<ToolsField` mounted exactly twice with no `external_action`-gated mount.
- **PLANT Z5 — the exact wrong fix D-20 rejects** (give the type the generic rail and widen
  its options with the three capability names) — **observed RED on four of the five**:

  ```
  ×  external_action renders NO tool rail at all — not even the degraded one
  ×  no capability NAME appears anywhere in the external_action panel
     AssertionError: expected '<aside …' not to contain 'send_email'
  ×  `toolOptions` was NOT widened — the three capabilities are absent from the source
  ×  the rail is reachable ONLY from the two tool-carrying branches
     AssertionError: expected [ '<ToolsField', …(1) ] to have a length of 2 but got 3
  4 failed | 28 passed (32)
  ```

  Restored by md5-verified `cp`; `grep -c "PLANT" PhaseFormPanel.tsx` → **0**.
- **V22 re-run and GREEN**, and no backend file was touched:
  `test_182_grounding_bundle.py::test_external_action_capabilities_are_absent_from_the_author_facing_tool_options`
  → `1 passed`.
- **Commit:** `5963ba4b`

### 2. [Rule 1 — bug] ⚠ Task 1's commit left a RED test in `panel/__tests__/PhaseTimeline.test.tsx`, and the reason I did not see it is worth more than the fix

- **Found during:** Task 2's wider sweep.
- **What happened:** after Task 1 I ran `npx vitest run src/components/workflows src/pages
  src/lib` (green but for `model-info`) and `node scripts/vitest-count-gate.cjs`, which
  printed **`failed 1`**. I attributed that 1 to `model-info.test.ts` — **which the gate
  does not run at all** (`src/lib` is covered only by the named file
  `phaseState.test.ts`). The gate's 1 failure was `PhaseTimeline.test.tsx`, which IS in
  TARGETS and which my hand-run scope did not include. **Two different scopes, one number,
  matched to the wrong suite.** `D-188.2-DEF-01` says the `failed` column is not a
  regression backstop; the correct lesson from this incident is narrower and sharper:
  **a failure count is worthless until you have named WHICH file produced it.**
- **The defect:** the case *"DECLINES a seventh `PHASE_TYPE_LABEL` entry"* asserted
  `seventhText === ordinaryText` — that the 7th type renders byte-identically to a
  genuinely unknown type. Landing the 3D mark falsified it: the unknown type still renders
  the `•` fallback and `external_action` now renders an `<svg>`.
- **Fix, and why it is a NARROWING rather than a repair:** two DIFFERENT tables answer
  there. `PHASE_TYPE_LABEL` is the PANEL's own vocabulary and 189 **declined** a row (the
  table already declined `llm_emit`); that declination still holds and is what the case
  exists to pin. The 3D mark is the SHARED canvas glyph vocabulary and 189-13 **did** land
  a row. Byte-identity to an unknown type was never the property — it was a coincidence of
  two tables being empty at once. The case now asserts the label half directly
  (`toContain("Step")`, `not.toContain("External action")`) plus the exact residual
  difference (`ordinaryText === "•" + seventhText`), so a SECOND divergence still fails.
- **Commit:** `6712f314`

### 3. [Rule 3 — blocking] 14 committed canvas snapshots regenerated — and the diff is the evidence

- **Found during:** Task 2's sweep. `canvasModel.fixtures.test.ts` is not in the plan's
  `files_modified` and its 13 fixture snapshots all failed the moment `PhaseNodeData`
  gained a field.
- **Fix:** `npx vitest run canvasModel.fixtures.test.ts -u`.
- **⚠ The diff was audited rather than trusted**, because `-u` is exactly the command that
  can bless a real regression:

  ```
  $ git diff --stat -- .../__snapshots__/canvasModel.fixtures.test.ts.snap
   1 file changed, 36 insertions(+)
  $ git diff … | grep "^[+-]" | grep -v "^[+-][+-]" | sort | uniq -c
        36 +        "notConnected": false,
  ```

  **36 additions, ZERO deletions, and every one of them the same line.** No title, no
  subtitle, no edge, no position moved. The file's count stayed 100 and its pin did not move.
- **Commit:** `6712f314`

### 4. [Rule 2] The `phaseVocabulary.corpus.test.ts` pin was 189-13's, not 189-14's

189-12's SUMMARY recorded *"189-14 owes that pin move, in the commit that writes the
sentence."* The second clause is right and the plan number is wrong: **this** plan writes
the sentence, so `RAW_PHASE_TYPE_TOKENS = Object.keys(PHASE_TYPE_SENTENCES)` went 6 → 7
here. It was moved to a **`>= 7` floor** plus explicit membership rather than re-pinned at
7, so the eighth type does not read as a regression while the non-vacuity still holds.
The suite's COUNT did not change (45), so its gate pin did not move.

### 5. [Rule 2, beyond the plan] TWO slot-1 reservation prose sites corrected here — and one of them is a SEVENTH site nobody's list contains

`canvasModel.ts`'s `grounded` docblock said *"Badge slot 1 is deliberately EMPTY from this
plan onward"*, three fields above the `notConnected` field this plan added to the same
interface. `phaseVocabulary.ts`'s badge-slot section header said *"nothing here reserves
the slot, because a reserved slot is a slot spent."* **Both were falsified by this plan's
own diff, in files this plan owns**, so both were corrected in the commit that falsified
them — the D-20 discipline 189-04 applied to four sites at once.

⚠ **The `phaseVocabulary.ts` site appears in NEITHER list**: CONTEXT's D-12 names five
sites, UI-SPEC §2e names six. This is a **seventh**. (UI-SPEC's own §14 pointer audit
already found that CONTEXT's list was short by one; the pattern repeats.)

**⚠ NOTE FOR 189-15,** which owns *"flip six reserved-slot prose claims"* and the D-21
correction: **one of your six (`canvasModel.ts`) is already done**, and there is a seventh
you do not have. Your plan instructs you to re-derive; do. **D-21's
`canvasModel.ts:201-203` sentence was left UNTOUCHED** — it is yours, and this plan
confirmed by grep that no other plan claims it.

### 6. [Documented, not auto-fixed] The plan's own baseline was stale

The plan's `<context>` says *"count gate **total 2508, 45/45**"* and UI-SPEC §13 repeats it.
Measured before any edit: **2560, 46/46**. Both figures predate 189-08. Recorded rather than
silently corrected, because it is the fourth consecutive plan in this phase to inherit a
stale gate figure — and it is why the standing instruction is to re-derive.

### 7. Out-of-scope, untouched

`scripts/_uat111*`, `scripts/_uat111_1/`, `scripts/pm-pack/out/`, `scripts/.sse_after_run1/`,
`backend/RUN-BACKEND.md`, `backend/scripts/115_*.json`,
`backend/settings_override.json.migrated` are pre-existing operator artifacts. **Not
staged, not modified, not deleted.** Every file in every commit was staged individually by
path. `supabase/` was not touched and **`requirements.mark-complete` was NOT run — CONN-01
stays `Pending`**, with three plans still owed (189-14, 189-15, 189-16).

---

## Deferred Issues

**One closed, three carried, each with a named owner.**

- **`D-189-DEF-02` — CLOSED** (Deviation 1). It is recorded here as closed rather than in
  `deferred-items.md` alone.
- **UI-SPEC §7b's picker-SELECTION state → 189-14.** Resolved for the node face here;
  the picker half is assigned in writing above, with a recommendation.
- **One of 189-15's six reserved-slot prose sites is already flipped, and a seventh
  exists** (Deviation 5).
- **UAT row U1 → 189-16.** jsdom cannot see whether the 📤 is VISIBLE on Deep Midnight.
  The palette estimate (168.4, inside the shipped band) is not a rendered measurement, and
  the `llm_batch_agents` precedent is that a present, plausible slug can still disappear.

## Authentication Gates

None.

## Known Stubs

**None.** The intermediate state 189-12 declared — a picker row reading the raw
discriminator `external_action` with the `•` fallback mark — is **gone**: both halves
landed in this plan and both tripwires that pinned the gap were discharged. No `TODO`, no
"coming soon", no component wired to empty data, no hardcoded empty value reaching the UI.

## Threat Flags

None. This plan adds presentation data, one pure predicate and test guards. It opens no
route, reads no credential, makes no request and gains no privilege. Its own register is
addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-24** — Tampering: prototype pollution through the capability-sentence and subtitles lookups (**WR-04**) | **mitigated, BOTH sinks** | The capability map is own-guarded with the INLINE form (this file still has zero imports, asserted); the `canvasModel` subtitles read — the one that was UNGUARDED at HEAD — is fixed in the same commit as its 7th key. `"constructor"` probes cover both, and **PLANT Z1 returned `[Function Object]`**, the measured crash value. The two coexisting guard spellings were NOT merged. |
| **T-189-39** — Spoofing: a fabricated face claiming a capability the step does not have | **mitigated** | An unrecognised, non-string or inherited capability falls THROUGH to the type sentence. **PLANT Z3** (invented copy for an unknown name) observed RED. |
| **T-189-40** — EoP: `external_action` joining `GROUNDING_DIAL_TYPES` | **mitigated** | Byte-identical to HEAD; pinned by membership AND by consequence (a bound folder still faces nothing). **PLANT Z2** (the ungated tier) observed RED. |
| **T-189-41** — DoS: a missing icon slug, or a split-brain between the two glyph maps | **mitigated, and BOTH halves observed RED** | The slug was verified against the INSTALLED package before import; `npx vite build` succeeds and **FAILED under a planted missing slug** with `Error: Icon \`fluent-emoji/outbox\` not found`; the key sets are asserted identical and **PLANT Y** (one-sided key) produced 3 failures. |
| **T-189-05 / D-20** — EoP via the author-facing tool rail (**D-189-DEF-02**) | **mitigated** | Five new guards; **PLANT Z5** RED on four of them; V22 re-run GREEN; `toolOptions` not widened; zero backend diff. |
| **T-189-SC** — package installs | accept | **This plan installed NOTHING.** The icon is a slug inside an already-installed package, confirmed by reading the installed `icons.json` directly rather than by a network lookup. No `npm install` ran, so no legitimacy checkpoint is owed. |
| — | Information Disclosure | n/a | No new attack surface. No route, no credential, no request. |

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `frontend/src/components/workflows/soulData.ts` — 7th `PHASE_GLYPHS` entry | FOUND |
| `frontend/src/lib/phaseGlyph.tsx` — the import, the 7th mark, `PHASE_GLYPH_MARK_KEYS` | FOUND |
| `frontend/src/components/workflows/nodePresentation.ts` — the 7th `ICON_TINT` | FOUND |
| `frontend/src/components/workflows/phaseVocabulary.ts` — three words, `EXTERNAL_CAPABILITY_SENTENCES`, tier (4), `notConnectedOf` | FOUND |
| `frontend/src/components/workflows/canvasModel.ts` — `notConnected` + the guarded subtitles read | FOUND |
| `frontend/src/components/workflows/soulData.test.ts` — 17 green | FOUND |
| `frontend/src/components/workflows/phaseVocabulary.test.ts` — 112 green | FOUND |
| `frontend/src/components/workflows/canvasModel.test.ts` — 51 green | FOUND |
| `frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx` — 32 green | FOUND |
| `scripts/vitest-count-gate.cjs` — five pins moved, total 2587 | FOUND |
| `.planning/phases/189-.../189-13-SUMMARY.md` | FOUND |
| commits `f5ba6c5a`, `6712f314`, `5963ba4b` | FOUND in `git log` |
| `tsc --noEmit -p tsconfig.app.json` == 33 | **33** |
| `npx vite build` succeeds | **✓ built** |
| count gate OK, 46/46, no per-file decrease, 0 failing | **OK** |
| no plant residue — `grep -c "PLANT"` over the 5 production files touched | **0 / 0 / 0 / 0 / 0** |
| md5 restore of every planted source | `phaseGlyph` `5dbf981e…` · `phaseVocabulary` `f759cd0a…` · `PhaseFormPanel` `8c740775…` — identical before and after |
| the six fenced card-subtree modules untouched | **zero-line diff across all three commits** |
| `CARD_SUBTREE_PATHS` still 6 | **`:553`, unmoved** |
| `backend/` and `supabase/` untouched | **zero-line diff** |
| no file deleted in any commit | **CONFIRMED** |
| `phaseVocabulary.ts` still has ZERO imports | **0** |
| V22 green | **1 passed** |
| CONN-01 still `Pending` in REQUIREMENTS.md | **CONFIRMED — `requirements.mark-complete` not run** |
</content>
</invoke>
