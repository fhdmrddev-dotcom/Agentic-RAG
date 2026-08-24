---
phase: 189
plan: 08
subsystem: frontend-phase-state-derivation
tags: [wave-3, one-derivation, two-vocabularies, fail-closed, d-07, d-17, wr-04, falsification-plants, compiler-forcing]
requires:
  - "189-06 — migration 115, APPLIED: workflow_phases_status_check admits the slug recorded_not_sent"
  - "frontend/src/lib/phaseState.ts — the ONE phase-state derivation (188-05), with its own-property guard and its unknown floor"
  - "frontend/src/components/panel/PhaseCard.tsx STATUS_META — the exhaustive Record<Phase[\"status\"], …> that makes the widening FORCED"
  - "scripts/vitest-count-gate.cjs — TARGETS already carries both suites; only BASELINE moved"
provides:
  - "Phase[\"status\"] gains \"recorded-not-sent\" — the SOURCE of the compiler forcing"
  - "DB_PHASE_STATUS gains the sixth key: the DB slug (snake) mapping to the client member (kebab) — D-17 made mechanical"
  - "CanvasReading gains its 8th member, ARMING seven exhaustive tables downstream as typecheck errors for 189-10"
  - "canvasReading gains a one-line identity arm; the default: floor and the WR-04 guard both UNTOUCHED"
  - "the developer panel's own harness word: STATUS_META row `↛ Not sent` + the milestoneFor announcer sentence"
  - "the PHASE_TYPE_LABEL declination, recorded AND pinned by a test rather than merely commented"
affects:
  - "189-10 (the canvas vocabulary half — it inherits SEVEN typecheck errors, by design, as its worklist)"
  - "189-11 (the engine write that produces the slug this plan now renders)"
  - "the tree's tsc baseline: 33 → 40 until 189-10 fills the canvas tables"
tech-stack:
  added: []
  patterns:
    - "widening a union as a WORKLIST GENERATOR — the exhaustive Record is the reminder, and the intermediate state is honest because every reader is own-guarded down to an unknown floor"
    - "a DECLINED table slot recorded at the table AND pinned by a behavioural test, so the decision cannot later read as an oversight"
    - "prose that does NOT re-spell a glyph whose occurrence COUNT is the evidence for the claim about it (the 187-24 lesson, applied to a glyph rather than a token)"
    - "six wrong fixes planted into production source, each observed RED, restored by md5"
decisions:
  - "⚠ THE PLAN'S `tsc == 33` ACCEPTANCE CRITERION IS FALSIFIED BY MEASUREMENT, and the plan's own objective is what falsifies it. Widening `CanvasReading` forces SEVEN tables, not the one the criterion accounted for. The final number is 40 = 33 + 7, every one of the seven named below with its file, line and owner. The objective, the must_haves.artifacts entry and the key_links entry all mandate the widening in as many words; the number in the acceptance criteria is the drifted claim, and the plan hedges it (`or explained line by line`). See Deviations #1."
  - "The union widening is deliberately NOT deferred to 189-10. Deferring would have satisfied `tsc == 33` and silently deleted the mechanism the plan exists to arm: 189-10's four canvas tables would then be a prose to-do rather than a compiler error."
  - "The fail-closed floor was MEASURED in the intermediate state rather than argued. With 189-08 shipped and 189-10 not yet, the canvas renders the reading as the word `State unknown`, clause `null`, ring `{kind:\"length\",dash:1.5,gap:6}` (the DOTTED unknown ring) — never `Complete`, never the closed circle. Driven through the shipped `runReadingWord`/`runReadingClause`/`ringSpecFor`."
  - "`PHASE_TYPE_LABEL` was DECLINED a seventh entry, and the declination is pinned by a behavioural test rather than by a comment. The table already declines `llm_emit` and degrades an unmapped type to `Step`; a comment alone would have been deletable at green."
  - "The rejected glyph is NOT spelled in `PhaseCard.tsx` prose. Its `grep -c` in that file (0 at HEAD, 0 now) IS the evidence for the one-glyph-one-meaning claim, and prose spelling it would make the count unreadable. It is asserted against by name in the suite instead."
metrics:
  duration: "~75 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 7
  tests_added: 13
---

# Phase 189 Plan 08: The Client's ONE Derivation Carries the Sixth Slug Summary

**The database's sixth `workflow_phases.status` literal now has a client status, its own canvas
reading and the developer panel's own honest word — derived in exactly one place, and unable to
read as success at any layer, including the layers 189-10 has not written yet.** Six wrong fixes
were planted into production source and each observed RED, the sharpest of them producing the
message this whole phase exists to prevent: *"the not-sent word must not be Complete"*.

## The two commits

| # | SHA | Task |
|---|---|---|
| 1 | `4b3e3136` | The ONE derivation: the status union, the DB map, the reading union, the switch arm |
| 2 | `a42dbf96` | The developer panel's own word: `STATUS_META` (forced), the announcer (silent), the declination (pinned) |

**Whole-plan scope, exactly as declared plus one:**

```
$ git diff --stat 4b3e3136~1..HEAD
 frontend/src/components/panel/PhaseCard.tsx            |  52 ++++++
 frontend/src/components/panel/PhaseTimeline.tsx        |  20 ++-
 frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx | 183 ++++++++++-
 frontend/src/lib/phaseState.test.ts                    | 113 +++++++++--
 frontend/src/lib/phaseState.ts                         |  58 ++++++-
 frontend/src/types/index.ts                            |  27 ++-
 scripts/vitest-count-gate.cjs                          |  26 ++-
 7 files changed, 453 insertions(+), 26 deletions(-)

$ git diff --diff-filter=D --name-only 4b3e3136~1..HEAD    →  (empty; no deletions)
```

**No canvas file, no `runVocabulary.ts`, no fenced card-subtree module was touched** — the
plan's scope rule holds. The seventh file is `PhaseTimeline.test.tsx`, which `files_modified`
omitted while the `<action>` block required it; see Deviations #2.

---

## ⚠ THE FAIL-CLOSED BASELINE, MEASURED BEFORE IT WAS SUPERSEDED

The plan's first instruction was to re-derive the wave-ordering freedom rather than inherit it.
A temporary probe was appended to `phaseState.test.ts`, driven against the untouched tree, and
removed before any source edit:

```js
expect(phaseStatusFromDb("recorded_not_sent")).toBe("unknown")
expect(phaseStatusFromDb("recorded_not_sent")).not.toBe("done")
expect(canvasReading(mkPhase({ status: phaseStatusFromDb("recorded_not_sent") }))).toBe("unknown")
```

```
Tests  35 passed (35)
```

**PASSED.** At HEAD the slug missed the own-property guard, resolved to `unknown`, fell through
`canvasReading`'s `default:` and rendered as the honest unknown — **never as `Complete`**. That
is why migration 115 could land a wave ahead of any client vocabulary without the UI ever lying.
(The run also independently confirmed the gate's own pin: 34 shipped cases + 1 probe = 35.)

**The assertion that superseded it**, verbatim from `phaseState.test.ts`:

```js
expect(phaseStatusFromDb("recorded_not_sent")).toBe("recorded-not-sent")
expect(
  phaseStatusFromDb("recorded_not_sent"),
  "a step that deliberately sent nothing must never read as one that succeeded",
).not.toBe("done")
expect(
  phaseStatusFromDb("recorded_not_sent"),
  "the slug is now RECOGNISED — leaving it on the unknown floor would lose D-07",
).not.toBe("unknown")
```

**Both negatives are asserted explicitly**, per the plan. Asserting only the positive would still
pass if the value were ALSO aliased to `done` somewhere — which is this phase's stated failure
mode rather than a hypothetical one.

**And the floor SURVIVES.** `phaseStatusFromDb("a_status_nobody_ships")` still returns `unknown`
at both derivations, and is asserted `!== "done"` and `!== "recorded-not-sent"` at each.

---

## ⚠ THE FINDING: `tsc` cannot return to 33, and the plan's own objective is why

**Measured, in three steps, never eyeballed:**

| Point | `npx tsc --noEmit -p tsconfig.app.json` |
|---|---|
| HEAD, before any edit | **33** (the inherited baseline, CONFIRMED) |
| After Task 1 (both unions widened) | **41** — the forcing FIRED |
| After Task 2 (`STATUS_META` filled) | **40** |

The plan's acceptance criterion says *"reads exactly **33** — the measured baseline"*, and
parenthetically explains the intermediate rise as *"because `STATUS_META` is forced"*. **That
accounts for ONE of the eight.** Widening `CanvasReading` forces seven more, and the plan's own
`<objective>` says so in as many words: *"widening `CanvasReading` here is what makes the four
exhaustive `Record<CanvasReading, …>` tables in 189-10 a TYPECHECK ERROR rather than a silent
gap. The compiler is the reminder, and this plan arms it."*

**All eight, named with file, line and owner** — every one is the same `TS2741`, *Property
`"recorded-not-sent"` is missing*:

| # | Site | Table | Owner |
|---|---|---|---|
| 1 | `panel/PhaseCard.tsx:89` | `STATUS_META` | **THIS PLAN — filled in Task 2** |
| 2 | `workflows/runVocabulary.ts:61` | `RUN_READING_WORD` ⇐ D-16's home | 189-10 |
| 3 | `workflows/runVocabulary.ts:170` | `STATIC_CLAUSE` | 189-10 |
| 4 | `workflows/runVocabulary.ts:313` | `RING_GEOMETRY` | 189-10 (owes the 8th ring shape, UI-SPEC §4) |
| 5 | `workflows/NodeRunOverlay.tsx:134` | `RING_STROKE` | 189-10 |
| 6 | `workflows/PhaseNode.test.tsx:367` | `ALL_READINGS` | 189-10 |
| 7 | `workflows/PhaseNodeCard.test.tsx:178` | `ALL_READINGS_TABLE` | 189-10 |
| 8 | `workflows/PhaseNodeCard.test.tsx:2733` | `CARD_READING_SHAPES` | 189-10 |

**⇒ the final number is 40 = 33 + 7, and the 7 are 189-10's worklist, generated by the compiler
rather than by a checklist.** Two corrections fall out of the measurement:

- **RESEARCH §B9 counts FOUR forced `CanvasReading` sites. There are SEVEN.** §B9's table is
  correct about *source* files and silently omits the two canvas TEST files, whose
  `Record<CanvasReading, …>` tables `tsconfig.app.json` DOES typecheck (`include: ["src"]`, no
  test exclusion). `PhaseNodeCard.test.tsx` carries two of them.
- **The plan's `key_links` says "the four exhaustive Record tables downstream".** Same
  undercount, inherited from §B9.

**Why the widening was not deferred.** Deferring `CanvasReading` to 189-10 would have satisfied
`tsc == 33` and destroyed the mechanism: 189-10's tables would become a prose to-do. It also
contradicts `must_haves.artifacts` (`phaseState.ts` *provides* "the 8th `CanvasReading` member")
and `must_haves.key_links` outright. The number in the acceptance criteria is the drifted claim
— and the criterion itself allows for exactly this (*"Any other number is explained line by line
in the SUMMARY"*), as does the executor prompt (*"at 33 (or the delta explained)"*).

### ⚠ The intermediate state is HONEST, and that was MEASURED not argued

The above leaves seven tables missing a key while a real run can already produce the reading. The
plan asserts the readers are own-guarded; that was driven through the shipped functions rather
than trusted:

```
canvasReading(…status: "recorded-not-sent")  →  "recorded-not-sent"
runReadingWord(reading)                      →  "State unknown"
runReadingClause(reading)                    →  null
ringSpecFor(reading)                         →  {"kind":"length","dash":1.5,"gap":6}
```

**Never `Complete`, and never `{kind:"solid"}` — the closed ring `done` owns.** Every canvas
lookup is `own(TABLE, reading) ?? TABLE.unknown`, so a widened union lands on the unknown row and
the dotted unknown ring until 189-10 states the real one. The wave-ordering freedom migration 115
bought is preserved in the opposite direction too.

---

## Task 1 — the ONE derivation

Four edits, in the order that made each force the next.

**1. `types/index.ts`** — `Phase["status"]` gains `"recorded-not-sent"`. This is the SOURCE of the
forcing, and its docblock now records D-17 at the union itself: the DB stores snake, this union
carries kebab, and the rendered sentence is a third spelling again that lives nowhere near either.

**2. `DB_PHASE_STATUS`** — one key. **KEY = the database slug, VALUE = the client member.**

```ts
recorded_not_sent: "recorded-not-sent",
```

**3. The docblock correction the plan demanded, in the commit that needed it.** The shipped prose
claimed its *"five keys are exactly `workflow_phases_status_check`
(`pending | active | completed | failed | skipped`)"* — migration 115 falsified that. The
PROPERTY it defends is unchanged and is now stated **without a count**, because a number in prose
rots on every additive widening and the rule does not.

**4. `CanvasReading` + the switch arm.** The 8th member is spelled IDENTICALLY to the status
member, as `failed` and `skipped` already are, so the arm is a one-line identity with no place
for the two unions to drift. **The `default:` floor returning `unknown` is untouched**, verified
by reading the diff and by the unrecognised-status case. **`phaseStatusFromDb` needed no change**
— it reads the map behind the own-property guard and was already total.

### The one-derivation grep

```
$ grep -rn "recorded_not_sent" frontend/src --include=*.ts --include=*.tsx
frontend/src/lib/phaseState.ts:64:  recorded_not_sent: "recorded-not-sent",
  (+5 occurrences, all in phaseState.test.ts)
```

**Exactly ONE non-test occurrence — the `DB_PHASE_STATUS` key.** A second would be a second
derivation. ⚠ A first draft put the slug in the docblock too, which would have made the count read
2; the prose was reworded to state the D-17 rule *without re-spelling the string*, for the same
reason the shipped fences assemble their needles from parts (187-24).

---

## Task 2 — the panel's own vocabulary

**`STATUS_META` — ADD ONLY, and proved so:**

```
$ git diff -U0 -- frontend/src/components/panel/PhaseCard.tsx | grep "^-" | grep -v "^---"
(empty)
```

Zero removed lines: no shipped row's text, glyph or class moved.

```ts
"recorded-not-sent": { glyph: "↛", text: "Not sent", textClass: "text-panel-muted-foreground" },
```

The comment is written in the shipped `unknown` row's voice — it states that the row exists
because the compiler demanded it, names Phase 189 / CONN-01 / D-07 as why the union grew, and
explains why no shipped word was reusable (`Complete` claims the send happened, `Failed` claims
something went wrong, `Skipped` claims the step did not run — and it DID run, and a person DID
approve it).

**The glyph was chosen by measurement.** `↛` appears **0 times** across `frontend/src`, so it
arrives carrying no other meaning. The circled-slash mark was rejected because it already means
CANCELLED on the run band and *no longer offered* in the admin model-discovery panel.

| Check | HEAD | Now |
|---|---|---|
| `grep -c "⊘" frontend/src/components/panel/PhaseCard.tsx` | **0** | **0** ✅ unchanged |
| `grep -c "↛" frontend/src/components/panel/PhaseCard.tsx` | 0 | **1** — the row, and nothing else |

⚠ **A first draft of that comment SPELLED the rejected glyph, taking the count 0 → 1 and
falsifying my own acceptance criterion.** Caught by running the grep rather than by reading the
diff. The prose now names the mark in words; the count stays evidence. This is the 187-24 lesson
transposed from a token to a glyph.

**`milestoneFor` — the SILENT consumer.** It carries a `default:` arm, so a widened union is not a
typecheck error there: a screen-reader user would simply have been told **nothing** when the step
reached its terminal. It was found from a written list of consumers, and its docblock now records
that so the next widening does not have to rediscover it. The arm follows the shipped pattern
(ordinal, slug, state) and the `default:` floor STAYS — silence is the honest announcement for a
state this component cannot name.

**`PHASE_TYPE_LABEL` — DECLINED, RECORDED, and PINNED.** No seventh entry. The table already
declines `llm_emit` (since 101.1) and degrades an unmapped type honestly to `Step`; inventing a
panel vocabulary for a type the panel never gained one for would leave it declining exactly one
type for no stated reason. **The declination is not merely a comment**: a test renders the new
`phase_type` and asserts its header is byte-equal to an ordinary unrecognised type's, with a
positive control that the generic row really carries `Step` and `•`. PLANT O drove it RED.

---

## ANTI-VACUITY: six plants, every one observed RED

All six were driven into **production source**, observed, and removed. Restoration verified by
**md5sum against pre-plant backups** and `grep -c "PLANT"` → **0** in every file.

| Plant | The wrong fix | RED |
|---|---|---|
| **J** | `recorded_not_sent: "done"` — the slug aliased to success in the map | **4 failed** |
| **K** | the switch arm folded into the `done` branch | **3 failed** |
| **L** | `canvasReading`'s `default:` returning `"done"` — the floor deleted | **3 failed** |
| **N** | the `STATUS_META` row reading `✓ Complete` | **2 failed** |
| **M** | the announcer arm deleted (falls to `default:`) | **1 failed** |
| **O** | a seventh `PHASE_TYPE_LABEL` entry | **1 failed** |

### PLANT N — the phase's stated failure mode, driven

```
FAILED …PhaseTimeline.test.tsx > … > renders the declared row: the ↛ glyph and the exact text `Not sent`
AssertionError: expected 'Complete' to be 'Not sent'
FAILED …PhaseTimeline.test.tsx > … > collides with NO shipped panel word — D-07's binding constraint
AssertionError: the not-sent word must not be Complete: expected 'Complete' not to be 'Complete'
2 failed | 15 passed (17)
```

This is the exact shape of 189-09's PLANT F (a receipt-shaped body that read *"Delivered
successfully"*) one language layer up, and it is why D-07 is worded as it is.

### PLANT J — the map aliased to success

```
AssertionError: expected 'done' to be 'recorded-not-sent'
×  maps the server value at index 5 to its client status
×  resolves to its own client member, and explicitly NOT to done or unknown
×  lands inside the paintable set for every RECONCILABLE status
×  derives one value that both views read, for server row #5
4 failed | 36 passed (40)
```

### PLANT L — the floor removed

```
AssertionError: expected 'done' to be 'unknown'
×  keeps the unknown FLOOR intact for a status nobody ships
×  handles every member of the status union without falling outside the set
×  reads an EXISTING row with an unrecognised status as unknown
3 failed | 37 passed (40)
```

**Note which case did NOT fire under J, K or L: none of the four canvas tables.** They cannot see
a derivation error, because they are handed the answer. That is the correct separation and it is
also the reason the plants had to be driven at this layer rather than downstream.

**Restoration, verified:**

```
$ md5sum src/lib/phaseState.ts
631647625828c6a43bb4d52bd839562f   (identical before and after)
$ md5sum src/components/panel/PhaseCard.tsx src/components/panel/PhaseTimeline.tsx
f01bb20185c3bc9e39b59c46f345fe15 / 13ecbf280d6be659e3e70f69e89c3482   (identical)
$ grep -c "PLANT" <all three>   →  0 / 0 / 0
```

---

## Verification

**The plan's `<verification>` command:**

```
$ npx vitest run src/lib/phaseState.test.ts     →  40 passed  (was 34)
$ npx vitest run src/components/panel           →  207 passed, 14 files
```

**`tsc`:** 33 → 41 → **40**. Accounted for line by line above.

**The count gate — the COUNT columns, not the `failed` column (D-188.2-DEF-01):**

| Point | total | pinned | files |
|---|---|---|---|
| Baseline, re-derived | **2508** | 2508 | 45/45 |
| After Task 1 | **2514** | 2514 | 45/45 |
| After Task 2 | **2521** | 2521 | 45/45 |

```
count gate OK — 45/45 pinned files present, no per-file decrease, 0 failing.
```

**Both pins moved in the SAME COMMIT as their tests (S2):**

| File | Pin | Why |
|---|---|---|
| `phaseState.test.ts` | 34 → **40** | +2 from `DB_TABLE` gaining a row (it drives the totality loop AND the parity loop, so one row is two cases) · +4 from the dedicated block (the double negative, the floor at both derivations, the new reading with precedence, the prototype probe re-pinned) |
| `PhaseTimeline.test.tsx` | 10 → **17** | +4 panel-card cases (the row, D-07 non-collision, the WR-04 floor, the declination) · +3 announcer cases (the new sentence, a `complete` positive control, the `default:` silence) |

⚠ **No per-file DECREASE anywhere**, and `TARGETS` was not edited — both files were already
inside it, so only `BASELINE` moved, exactly as the plan predicted.

### D-07 non-collision — asserted, never assumed

The rendered panel word is asserted **NOT EQUAL** (exact match, never `toContain`) to every word
this panel ships: `Locked`, `Running`, `Complete`, `Failed`, `Attempt`, `Skipped`, `Unknown` —
plus the two D-07 names singled out, and the glyph asserted distinct from `⊘` and `✓`. The
positive control renders a `done` card and confirms the comparison can find equality, so seven
inequalities are seven measurements.

⚠ **Exact match is load-bearing here** and UI-SPEC §3d says why: the canvas's word for this state
shares the prefix `"Not "` with the shipped `Not started`, so a `toContain("Not")` becomes
ambiguous the moment anyone reads across surfaces.

### Re-derived, not inherited

| Claim | How | Result |
|---|---|---|
| `tsc -p tsconfig.app.json` = 33 | run before any edit | ✅ **33** |
| count gate 2508 / 45 files | run before any edit | ✅ **2508 / 45** |
| `phaseState.test.ts` pin = 34 | the probe run (34 + 1) and the gate's `actual` | ✅ **34** |
| `PhaseTimeline.test.tsx` pin = 10 | the gate's `actual` column | ✅ **10** |
| the fail-closed baseline | driven probe, removed | ✅ **PASSED — `unknown`, not `done`** |
| the slug's spelling | read from `115_workflow_phases_recorded_not_sent.sql` | ✅ byte-identical |
| `↛` unused in `frontend/src` | `grep -rc` | ✅ **0** |
| `⊘` in `PhaseCard.tsx` | `grep -c`, HEAD vs now | ✅ **0 / 0** |
| RESEARCH §B9's "4 forced `CanvasReading` sites" | the tsc run | ⚠ **SEVEN** — §B9 omits the two canvas TEST files |
| the plan's `tsc == 33` criterion | the tsc run | ⚠ **FALSIFIED — 40.** See the FINDING |
| `STATUS_META` at `PhaseCard.tsx:89` | symbol search | ✅ HELD |
| `milestoneFor` at `PhaseTimeline.tsx:57` | symbol search | ✅ HELD |
| `DB_PHASE_STATUS` at `phaseState.ts:41` | symbol search | ✅ HELD at read time (`:59` after the docblock correction) |

---

## Deviations from Plan

### 1. [Documented, not auto-fixed] The `tsc == 33` acceptance criterion is unsatisfiable alongside the plan's own objective

- **Found during:** the post-Task-1 measurement.
- **Issue:** the criterion accounts for one forced table; the widening the objective mandates
  forces eight. Both cannot hold.
- **Resolution:** the objective, `must_haves.artifacts` and `must_haves.key_links` — three
  binding statements — mandate the widening; the acceptance number is the drifted claim and both
  the criterion and the executor prompt provide for explaining a delta. Final: **40 = 33 + 7**,
  each of the seven named with file, line and owner above.
- **Consequence, stated rather than smoothed:** HEAD carries seven typecheck errors beyond
  baseline until 189-10 lands. `vite build` does not run `tsc`, the vitest run is transpile-only
  (all 2521 cases green), and every affected runtime lookup is own-guarded down to the unknown
  row — **measured**, above. **189-10 must not treat 40 as its baseline**; its target is 33.
- **Files modified:** none — this is a record.

### 2. [Rule 3 — Blocking] `PhaseTimeline.test.tsx` is a 7th file, absent from `files_modified`

- **Found during:** Task 2.
- **Issue:** the plan's `<action>` says *"Extend the panel suites with…"* and three acceptance
  criteria depend on those tests, but `files_modified` lists six files and `<verification>` says
  `git diff --stat` should list *"exactly the six declared files"*. The two cannot both hold —
  the same shape 189-07 hit with `backend/app/api/runs.py`.
- **Fix:** the tests were written; the file count is **seven**, stated rather than smoothed. It
  is the only panel suite that already sits in `TARGETS` and already drives `PhaseCard` directly
  (the 188.1-04 note explains why a fixture-driven case would be vacuous here), so it is the
  correct home rather than a convenient one.
- **Commit:** `a42dbf96`

### 3. [Rule 2] My own acceptance criterion was violated by my own comment, and caught by running it

- **Found during:** the Task 2 acceptance greps, before committing.
- **Issue:** the criterion is `grep -c "⊘" PhaseCard.tsx` **unchanged from HEAD**. A docblock
  explaining why that glyph was rejected took the count 0 → 1.
- **Fix:** the mark is named in words, not spelled, with the reason recorded inline. Re-measured
  0 / 0. **Recorded because it is the general lesson**: prose about a token whose COUNT is the
  evidence destroys the evidence.
- **Commit:** `a42dbf96`

### 4. [Rule 2] Three announcer tests, where the plan asked for one

The plan asked for *"the announcer sentence for the new status"*. Alone that is consistent with an
announcer that says whatever the last arm returns, so it ships with a `complete` **positive
control** on the same seam and a case pinning that an unnameable status produces **silence**
rather than an invented sentence. All three drive the REAL `PhaseTimeline` over the REAL store —
a unit call on the private switch would have proved the sentence exists without proving it is ever
spoken (the announcer only writes on a transition EDGE for the ACTIVE phase).

### 5. Out-of-scope, untouched

`scripts/_uat111*`, `scripts/pm-pack/out/`, `graphify-out/`, `backend/scripts/115_*_results.json`
and ~38 `supabase/snippets/Untitled query *.sql` are pre-existing operator artifacts. **Not
staged, not modified, not deleted.** Every file in both commits was staged individually by path.

---

## Deferred Issues

None new. Two constraints are carried forward, both belonging to **189-10**:

- **The seven armed typecheck errors ARE 189-10's worklist.** Its target is `tsc == 33`, not 40.
  Two of the seven live in canvas TEST files that RESEARCH §B9 does not list.
- **`RING_GEOMETRY` is not a table fill.** Its docblock states a BUILD CRITERION — *the arc
  geometry IS the state; colour only ever reinforces it* — so the 8th reading owes a shape that
  is unique in an assertable property in greyscale. UI-SPEC §4b decides it; this plan neither
  chose nor pre-empted it.
- `D-189-DEF-02` (the author-facing rail rendering a capability struck through) is untouched and
  still **189-13**'s.

## Authentication Gates

None.

## Known Stubs

None. Every value added is real and rendered: the map key resolves a real DB slug, the status atom
renders real text and a real glyph in the running app, and the announcer speaks a real sentence.
The seven unfilled canvas tables are **not stubs** — they are unwritten by design, they carry no
placeholder, and each resolves through a shipped own-property guard to a shipped honest row. That
distinction was measured, not asserted (see the intermediate-state probe above).

## Threat Flags

None. This plan adds one string to a union, one key to a lookup, one switch arm and two
presentational rows. It opens no route, reads no credential, makes no request and gains no
privilege. Its register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-23** — Spoofing: an unrecognised status read as success | **mitigated** | `canvasReading`'s `default:` floor and `phaseStatusFromDb`'s own-property guard both survive, pinned by cases asserting an unshipped status is still `unknown` and is `!== "done"` at BOTH derivations, and the new status is NEITHER `done` NOR `unknown`. **PLANT L** (the floor returning `done`) and **PLANT J** (the slug aliased to `done`) each observed RED. The canvas layer was separately measured to render `State unknown` and the DOTTED ring in the intermediate state — never `Complete`, never the closed circle. |
| **T-189-24** — Tampering: prototype pollution through `DB_PHASE_STATUS[raw]` (**WR-04**) | **mitigated** | The shipped `Object.prototype.hasOwnProperty.call` guard is untouched and is re-pinned beside the growth: `phaseStatusFromDb("constructor")` → `unknown`, `!== "recorded-not-sent"`, with a positive control proving the inherited member really is reachable by index. The panel's own WR-04 site-3 floor was re-pinned too — an inherited key still renders `Unknown`, never `Not sent`. |
| **T-189-25** — Repudiation: a second local derivation drifting | **mitigated** | `grep -rn "recorded_not_sent" frontend/src` → **exactly ONE** non-test occurrence, the `DB_PHASE_STATUS` key. No second map, no second lookup, no local status rule. The docblock was reworded so prose cannot inflate that count. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `frontend/src/types/index.ts` carries the new union member | FOUND |
| `frontend/src/lib/phaseState.ts` carries the key, the 8th member and the arm | FOUND |
| `frontend/src/lib/phaseState.test.ts` — 40 cases green | FOUND |
| `frontend/src/components/panel/PhaseCard.tsx` — the `↛ Not sent` row, add-only diff | FOUND |
| `frontend/src/components/panel/PhaseTimeline.tsx` — the announcer arm | FOUND |
| `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx` — 17 cases green | FOUND |
| `scripts/vitest-count-gate.cjs` — both pins moved | FOUND |
| `.planning/phases/189-governed-external-action-node-model/189-08-SUMMARY.md` | FOUND |
| commit `4b3e3136` | FOUND in `git log` |
| commit `a42dbf96` | FOUND in `git log` |
| no plant residue — `grep -c "PLANT"` over all three sources | **0 / 0 / 0** |
| no probe residue — `git status --short -- frontend/` | EMPTY |
