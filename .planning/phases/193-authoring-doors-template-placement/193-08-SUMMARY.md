---
phase: 193-authoring-doors-template-placement
plan: 08
subsystem: workflow-authoring-doors
tags: [AUTH-01, copy, vocabulary, characterization, re-capture, variant-D]
requires:
  - "193-04 — the REGENERATED BUILD-CONTRACT.generated.md carrying `strip.labelGovern` (D-23)"
  - "193-05 — `doorVocabulary.ts` at the shipped values, with `DECLARED_EQUALITIES` left EMPTY and its extension named in the docblock"
  - "193-03 — the `DoorHeaderStrip.tsx` extraction (green with zero baseline edits, which is what licensed this wave's re-capture)"
provides:
  - "All 21 governed door strings at column D — variant D, 'the mix' (D-01)"
  - "`STRIP_LABEL_GOVERN: typeof DOOR_B_NAME` — a literal-type agreement fence, proved to fire"
  - "`doorVocabulary.test.ts` as a full falsification suite: 21 column-D literals spelled once, five codepoints pinned, the generated contract re-read at test time"
  - "Re-capture 1 of 2 on the six door baselines and the header's three-band literal, each dated and reasoned in its own file"
affects:
  - "193-09 — owns re-capture 2 of 2 (D-04/D-22 restack, STRUCTURE not words)"
  - "193-11 — owns the count-gate pin sweep; `doorVocabulary.test.ts` is now 39 cases (was 9)"
  - "UAT row U6 — the 🔧 asymmetry on the govern strip is routed there to be judged by looking"
tech-stack:
  added: []
  patterns:
    - "`libraryVocabulary.ts:291-297` literal-type agreement fence, applied to a second table"
    - "`runVocabulary.test.ts` D16_WORD falsification: the locked word is a literal in the TEST, never in the source"
    - "contract-agreement: the generated acceptance bar is re-parsed AT TEST TIME and deep-equalled against the test's own literals"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/doorVocabulary.ts
    - frontend/src/components/workflows/doorVocabulary.test.ts
    - frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.describe.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
decisions:
  - "D-01 / D-02 shipped: all 21 values PORTED BY SCRIPT from column D, compared back 21/21 — no string hand-typed"
  - "D-23 shipped: `strip.labelGovern` = door B's name, fenced by `typeof DOOR_B_NAME`, proved 33 → 34 → 33"
  - "`DECLARED_EQUALITIES` EXTENDED to one pair, never weakened — and the declared pair is itself asserted equal so the list cannot document a fiction"
  - "CORRECTION ON MEASUREMENT: Task 3's `grep → 0` criterion is unreachable as written; `WorkflowBuilderPage.tsx` holds a SECOND ungoverned copy of four strings that no plan in this phase owns"
metrics:
  duration: ~55 min
  completed: 2026-08-13
  tasks: 3
  commits: 3
  base_sha: d6480ea6c8dfceb24afa59a0942c68dcaeae07da
  head_sha: a961b9ad036934d901aaac3b85dff1963a62c9d6
---

# Phase 193 Plan 08: Ship Variant D Summary

**The 21 words the phase exists for now ship, ported by script from the generated contract's
column D rather than re-typed, with the govern strip's label type-fenced to door B's own name.**

---

## What shipped

### Task 1 — `doorVocabulary.ts` re-valued to column D · commit `dc6910b0`

All 21 governed ids replaced with the regenerated `BUILD-CONTRACT.generated.md`'s column D.
**PORTED, NOT TRANSCRIBED (D-02):** a Node parser reads the markdown COPY table, strips the
`**…**` emphasis and the `⬅ from C` provenance annotation, resolves an `*(inherit)*` cell to
column A, and maps `doorA.tier → DOOR_A_TIER` mechanically. The 21/21 comparison, verbatim:

```
COLUMN D PORT COMPARISON — /.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md
  module exports parsed: 21
  21/21 exact matches, 0 mismatches
exit=0
```

Structural pins held: `grep -c "^export const"` → **21** (unchanged), `grep -cE "^import |from \""`
→ **0** (still a true zero-import leaf), `eslint doorVocabulary.ts` → **0 / 0**.

**The D-23 agreement fence, PROVED rather than asserted.** `STRIP_LABEL_GOVERN` carries the
literal-type annotation `typeof DOOR_B_NAME` (the `libraryVocabulary.ts:291-297` idiom). A
differing literal was planted and `tsc -p tsconfig.app.json` observed:

| | error count | the error |
|---|---|---|
| baseline | **33** | — |
| plant (`"Build it myselfX"`) | **34** | `doorVocabulary.ts(214,14): error TS2322: Type '"Build it myselfX"' is not assignable to type '"Build it myself"'.` |
| restored | **33** | md5 `4cb7e40672d5486b7e95079920c1694b` before and after |

### Task 2 — the falsification suite · commit `663596ff`

`doorVocabulary.test.ts`: **9 → 39 cases**, 490 lines.

- **`COLUMN_D`** holds all 21 strings as literals **in the test**, spelled exactly once in this
  repository, with one named `it` per id asserting `toBe`. The literal living in the TEST is what
  makes the assertion a falsification of the table rather than a copy of it.
- **The key sets are asserted to be the SAME SET**, so a value added to one and not the other is
  a failure rather than a silent gap.
- **Contract agreement (D-02, mechanised):** a case re-reads `BUILD-CONTRACT.generated.md` at
  test time via `?raw`, re-parses column D with the same rules, and deep-equals it against
  `COLUMN_D`. A fixture positive control proves the parser really reads the **D** cell (not B)
  and really resolves an `*(inherit)*` row to column A. A further case pins the contract's own
  *"Variant D — 19 substitution(s) matched the real DOM; zero misses"* line.
- **Five codepoints pinned:** `‹` 0x2039, `›` 0x203A, `·` 0x00B7, `—` 0x2014, `⚡` 0x26A1. The
  dash and dot rules are stated over the WHOLE table and scoped to **space-flanked separators**,
  so `per-step` keeps its legitimate hyphen; both walks carry positive controls (an en dash and
  a bullet are each shown to be caught).
- **`DECLARED_EQUALITIES` EXTENDED, never weakened.** `193-05` left it `[]` with the extension
  named in its docblock; this wave added exactly `["STRIP_LABEL_GOVERN", "DOOR_B_NAME"]`. The
  declared pair is *itself* asserted to really be equal, so the list cannot document a fiction.
- **Zero containment matchers**, and the banned matcher's name is not spelled anywhere in the
  file (the 187-24 lesson `runVocabulary.test.ts` already records). Character negatives are
  written as explicit `.includes(…) === false`.

**RED-first proof.** A single-character en-dash substitution in `DOOR_A_NOTE` reddened **both**
intended cases:

```
× DOOR_A_NOTE is byte-exactly column D
    AssertionError: expected 'you can open the full editor at any p…' to be 'you can open the full editor at any p…'
× every SEPARATOR dash in the table is an EM DASH (U+2014), never a hyphen or an en dash
    AssertionError: DOOR_A_NOTE uses a dash that is not an em dash: expected 8211 to be 8212
```

Source restored **md5-identical**: `4cb7e40672d5486b7e95079920c1694b` before and after.

### Task 3 — re-capture 1 of 2 · commit `a961b9ad`

Every literal was **re-captured from the rendered tree** by each suite's own driver, run twice
and agreeing byte for byte, then substituted in by script. Nothing was hand-edited.

**WHY IT IS LEGITIMATE NOW.** `193-03` and `193-05` both passed with these literals GREEN AND
UNEDITED. That is the proof both waves were verbatim moves, and it is a proof that could only
ever be collected *before* a word changed.

**WHAT CHANGED — THE WORDS ONLY, MEASURED.** Old vs new compared with tags and text separated.

`WorkflowDoorSwitch.baseline.test.tsx` (6 captures):

| capture | structure identical | text-node slots | text nodes changed |
|---|---|---|---|
| CHOOSER_STANDALONE | ✅ true | 43 → 43 | 10 |
| CHOOSER_INLINE | ✅ true | 47 → 47 | 10 |
| DESCRIBE_STANDALONE | ✅ true | 71 → 71 | 8 |
| DESCRIBE_INLINE | ✅ true | 73 → 73 | 8 |
| GOVERN_STANDALONE | ✅ true | 39 → 39 | 2 |
| GOVERN_INLINE | ✅ true | 53 → 53 | 2 |

`WorkflowBuilderPage.header.test.tsx` — the band literal that had stood unedited for **nine
phases**:

| band | structure identical | text nodes | changed |
|---|---|---|---|
| 1 (breadcrumb) | ✅ true | 3 → 3 | **0** |
| 2 (the door band) | ✅ true | 4 → 4 | **2** |
| 3 (save cluster) | ✅ true | 4 → 4 | **0** |

Band 2's two, in full:

```
"‹ both doors"           ->  "‹ Change how I start"     (strip.back)
"🔧 Author &amp; govern"  ->  "Build it myself"          (strip.labelGovern, D-23)
```

"Structure identical" is `tagsOnly(before) === tagsOnly(after)` — **every** tag, class list,
`data-testid`, the judge badge's `title`, the inline `style`, and the `ml-auto` conditional,
byte for byte.

**⚠ THIS IS RE-CAPTURE 1 OF 2.** `193-09`'s D-04/D-22 restack will red these same literals
again — on **STRUCTURE** rather than on words, which is exactly the distinction these notes
make checkable. Both are legitimate; both are stated in the files themselves, not only here.
Any further re-capture whose diff shows a **tag** difference the plan did not name is a
behaviour change to explain, not a test to update.

Assertions that named a door word now READ it off `doorVocabulary` rather than re-typing it —
a page suite spelling a governed string is a second home (D-11). Two shapes were strengthened
while being updated, because column D made the old ones vacuous: the door cards are now
asserted **in both directions** (each card names its own door and NOT the other), and the
switch CTA is compared as a **whole string** (it is `DOOR_B_NAME` plus a chevron, so a fragment
check could not tell it from the card or from the govern strip).

---

## The 🔧 asymmetry — stated, not smoothed (→ UAT row U6)

`strip.labelGovern`'s column-D value is `Build it myself`, with **no glyph**, while
`strip.label` keeps `⚡ Drafting it for you`. That follows from D-23's own wording ("its string
becomes variant D's door name") — the door name carries no glyph, and inventing one to restore
symmetry would be re-typing rather than porting (D-02). It is written into the module's
docblock, **asserted** in the suite (the govern label's first codepoint is proved to be below
U+2000, so a glyph cannot be quietly restored), and routed to **UAT row U6** so the operator
rules on it by looking — the only instrument that can settle a question about how a header
reads.

---

## Deviations from Plan

### 1. [Rule 1 — criterion corrected on measurement] Task 3's `grep → 0` is unreachable as written

**Found during:** Task 3, when `WorkflowBuilderPage.describe.test.tsx` (19/19) and
`.canvas.test.tsx` (128/128) both stayed **GREEN** after variant D landed, against the plan's
expectation that all four suites would red.

**What is actually true.** `WorkflowBuilderPage.tsx` holds its **OWN** copy of four of these
strings — the CTA at `:1527` and the three hint fragments at `:1531-1533` — which `193-05` never
moved into `doorVocabulary.ts` (its scope was `WorkflowDoorSwitch` + `DoorHeaderStrip`). Those
two suites mount the **page directly**, so they assert the page's literal, not the door's. The
criterion as written could therefore only be met by editing `WorkflowBuilderPage.tsx`, which is
**not in this plan's `files_modified`** — and `grep -l "WorkflowBuilderPage.tsx"` over the whole
phase directory returns only `193-RESEARCH.md`: **no plan in Phase 193 owns that file.**

**Corrected criterion, and its measurement.** *Zero **door-copy** assertions survive in any test
file.* Measured after the change: **8** remaining hits of the retired-string grep, **all** of them
`Draft the workflow`, **all** naming the page's own literal, **zero** naming door copy. The two
extra hits inside `WorkflowDoorSwitch.baseline.test.tsx` are inside the `GOVERN_*` **captures** —
i.e. the Builder's screen as rendered, which is the evidence for this finding rather than a
violation of it.

**Not fixed here, deliberately.** Rewording a source file no plan owns, in a wave whose whole
claim is "words only, structure untouched", would put an unreviewed source change inside the
commit that must be provably minimal.

### 2. [Rule 1 — assertion corrected on measurement] one runtime inequality is a typecheck error

`expect(SWITCH_CTA === DOOR_B_NAME).toBe(false)` — the natural way to say "prefix, not equal" —
raises **TS2367** here, because the two literal types have no overlap, and would have taken
`tsc` from 33 to 34. TypeScript proving the inequality statically is **stronger** than a green
runtime assertion, so the case asserts the proper-prefix relation instead
(`startsWith` + a length comparison) and records why in a comment.

### 3. Prose-trap note (the 187-24 pattern, met for the third time this phase)

Task 2's `grep -c "toContain" → 0` criterion was met **honestly and without mutilating prose**,
by following the analog file's own solution: the banned matcher is described in words and never
spelled. `grep -c` → **0**. Task 3's retired-string grep, by contrast, could **not** be met that
way — a re-capture note whose entire job is to say *which words changed* must be allowed to
name them, so the two re-capture blocks quote the retired strings and the criterion is reported
assertion-scoped instead (see deviation 1).

---

## Deferred

| Item | Trigger |
|---|---|
| **`WorkflowBuilderPage.tsx`'s second, ungoverned home for `describe.cta` + `hint.frag1/2/3`.** After this plan the loose door reads *Write the first draft* / *writes the steps* while the govern door's first screen still reads *Draft the workflow* / *drafts the phases*. Visible to anyone who opens both doors. | **Re-open when any plan takes `WorkflowBuilderPage.tsx` into `files_modified`, or at the phase's UAT if row U6/U7 observes the mismatch.** The fix is one import and four substitutions; the cost is that `WorkflowBuilderPage.describe.test.tsx:287`'s CTA-region literal and both `GOVERN_*` baselines must be re-captured with it — which is why it wants its own plan and its own words-only proof. Documented at three sites in code (`WorkflowDoorSwitch.baseline.test.tsx` capture docblock, `WorkflowBuilderPage.describe.test.tsx` docblock, `WorkflowBuilderPage.canvas.test.tsx:draftIt`). |
| **`FeatureVisibility.tsx:154`** — an admin-surface sentence that names both doors by their column-A titles. Not governed copy, not in any COPY table, not in `files_modified`. | Re-open when the operator surface is next touched, or if a UAT row observes the admin panel naming doors that no longer exist. |
| **Count-gate pins.** `doorVocabulary.test.ts` 9 → 39 (+30). Not raised here — `193-11` owns the sweep, and the gate only fails on a DECREASE. | `193-11`. |

---

## Verification

| Check | Expected | Measured |
|---|---|---|
| column-D port comparison | 21/21, 0 mismatches | ✅ **21/21, 0 mismatches** |
| `grep -c "^export const" doorVocabulary.ts` | 21 | ✅ **21** |
| `grep -cE "^import \|from \"" doorVocabulary.ts` | 0 | ✅ **0** |
| D-23 fence fires | 33 → 34 → 33 | ✅ **33 → 34 (TS2322) → 33**, md5 identical |
| `grep -c "toContain" doorVocabulary.test.ts` | 0 | ✅ **0** |
| `doorVocabulary.test.ts` | all pass | ✅ **39 passed, 0 failed** |
| the 7 affected suites | all pass | ✅ **7 files passed** |
| `tsc --noEmit -p tsconfig.app.json` | 33 | ✅ **33** |
| `eslint` on this plan's 7 files | 0 new | ✅ **1 error, INHERITED** (`canvas.test.tsx:3148 '_omitted' unused` — present at base `d6480ea6`, verified by `git show`) |
| `node ../scripts/vitest-count-gate.cjs` | exit 0, no `[count-decrease]` | ✅ **exit 0 · 67/67 pinned files present · no per-file decrease · failed 0 · total 3537** |

The gate total reconciles exactly against the orchestrator's baseline: **3507 + 30 = 3537**, the
+30 being this plan's own new cases; every other per-file delta shown (`PhaseTimeline` +4,
`soulData` +16, …) is inherited drift that `193-11` owns and that was deliberately **not**
touched here.

---

## Worktree / process notes

- `bash scripts/bootstrap-worktree.sh` ran **first**, before anything else.
- **The worktree forked from the wrong base again — 7 of 7 agents in this phase now.** HEAD was
  `fda792141b0129de7b15dd40ddc1082e76f95a2a` (merge-base `3781a3fe`) rather than the dispatched
  `d6480ea6`. Corrected with `git reset --hard d6480ea6`, then **re-bootstrapped**. Both upstream
  sanity checks passed after the correction: `doorVocabulary.ts` present, `strip.labelGovern`
  appearing **2×** in the regenerated contract.
- `GSD_VITEST_MAX_WORKERS=4` exported in every test shell.
- No `git stash`, no `git clean`, no `rm -rf`. ⚠ A pre-existing entry sits on the **shared**
  stash list (`stash@{0}: WIP on develop: ea958149`) — observed, untouched, reported.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were **not** modified. No `gsd-sdk query state.*`
  verb was called.

---

## Self-Check: PASSED

```
FOUND: frontend/src/components/workflows/doorVocabulary.ts                  (269 L)
FOUND: frontend/src/components/workflows/doorVocabulary.test.ts             (490 L, ≥ 120 required)
FOUND: frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
FOUND: frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
FOUND: frontend/src/pages/WorkflowBuilderPage.header.test.tsx
FOUND: frontend/src/pages/WorkflowBuilderPage.describe.test.tsx
FOUND: frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
FOUND: dc6910b0   feat(193-08): port column D into doorVocabulary, with the D-23 agreement fence
FOUND: 663596ff   test(193-08): the exact-match column-D suite — literals here, codepoints pinned
FOUND: a961b9ad   test(193-08): RE-CAPTURE 1 OF 2 — the consumer suites speak variant D, words only
```

`doorVocabulary.ts` contains `Build it myself` (the `must_haves.artifacts.contains` needle) and
names `BUILD-CONTRACT` as the source of its values (the `key_links.pattern` needle).

## Known Stubs

None.

## Threat Flags

None. This plan adds no endpoint, no auth path, no file access and no schema surface. The two
trust boundaries in its threat model (generated contract → module, module → consumer suites) are
both now mechanically defended: **T-193-31** by the port script *and* the test-time contract
re-read; **T-193-32** by the zero-containment rule plus the declared-and-asserted equalities;
**T-193-33** by five codepoint assertions driven RED against a real one-character change;
**T-193-34** by the published tags-vs-text diff, which showed *structure identical: true* for
every one of the nine re-captured literals. **T-193-35** did not fire — `canvas.test.tsx` passed
128/128 on every run and its ~14 % flake was never observed.
