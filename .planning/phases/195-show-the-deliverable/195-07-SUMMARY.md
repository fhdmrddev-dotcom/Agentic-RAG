---
phase: 195-show-the-deliverable
plan: 07
wave: 4
subsystem: frontend/source-fences + CI gate
tags: [RUN-03, SC#2, source-sweep, non-vacuity, byte-identity, D-13, D-195-04-D, P6, P7, P10, plants]
requires:
  - "195-04 (chat converted; ⚠ D-195-04-D — the P7(a) finding this plan consumes)"
  - "195-05 (panel converted)"
  - "195-06 (run page converted; the WorkflowRunPage pin at 108)"
  - "195-BASELINE.md (BASE_SHA f2eef045, the two call-site md5s, tsc 33)"
provides:
  - "FileRow.sweep.test.ts — the ONLY artefact in the tree that measures SC#2 rather than believing it"
  - "Four guarded ?raw arms proving exactly ONE formatBytes, ONE icon path and ONE row markup"
  - "The stripper non-vacuity guard, driven — and the THREE arms it caught passing vacuously on the empty string"
  - "Chat's public capability pinned three ways: prop-set exactness, the unexported interface, and byte-identity to a NAMED base"
  - "Every Phase-195 count-gate pin verified AT the gate's own printed actual, and the sweep adopted file-level"
affects:
  - "195-08 (the doc sweep — this plan touched no doc, no seed, no ledger)"
  - "any future phase re-introducing a second file presentation: this sweep is what reds"
tech-stack:
  added: []
  patterns:
    - "length + identity + stripper-pair guard per ?raw import (the 192.1 remedy), driven rather than asserted"
    - "an absence assertion paired with a presence clause, so a broken reader reds instead of passing"
key-files:
  created:
    - frontend/src/components/files/__tests__/FileRow.sweep.test.ts
  modified:
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-195-07-A: the `<FileRow` DELEGATION COUNT is the direct measurement of 'one row markup' in OutputFileCard.tsx; the layout-class signature is the COMPLEMENT, not the primary — the signature is legitimately absent from that file, so asserting its absence alone cannot fail for the right reason"
  - "D-195-07-B: no layout-signature clause for the run page — `WorkflowRunPage.tsx:896` uses the same three utility classes for its HEADER, so a signature sweep there would red on unrelated layout. Stated in the suite rather than silently omitted"
  - "D-195-07-C: `lib/fileIcons.tsx` and `panel/SeamCard.tsx` are a RECORDED BOUNDARY, asserted as strings and never imported — SeamCard is a FIFTH presentation whose docblock claim to reuse OutputFileCard's chip shape is measurably FALSE"
  - "D-195-07-D (FINDING): the plan's bare-grep acceptance criterion for the bare-directory entry is UNSATISFIABLE once anything documents it — it matched its own explanation twice. Corrected, and recorded beside the original"
  - "D-195-07-E: tasks 1 and 3 ship in ONE commit, because the gate's same-commit pin rule outranks per-task commit symmetry"
metrics:
  tasks: 3
  commits: 3
  cases_added: 20
  plants_driven_red: 15
  duration_minutes: 47
  completed: 2026-08-17
---

# Phase 195 Plan 07: The SC#2 source sweep — Summary

**SC#2 — *no second file UI* — stopped being a belief and became a measurement.** One suite now
reads all four in-scope sources over a line-anchored comment stripper and proves there is exactly
ONE byte formatter, ONE per-extension icon path and ONE row markup in the tree; it was driven RED
**once per swept file** and, when its stripper was broken, **it named the three of its own arms that
would otherwise have shipped defending nothing.**

**Measured base SHA: `fda792141b0129de7b15dd40ddc1082e76f95a2a` → reset → `1c027f4907f2154f78cb4a97198a26b2d3d49dc7`.**
The dispatch predicted this exactly; it is the **19th consecutive** wrong-base fork. See Deviations.

---

## Commits

| # | Hash | Subject |
|---|---|---|
| 1 | `b4c5a7ee` | `test(195-07): the SC#2 source sweep, and every Phase-195 pin at its measured actual` |
| 2 | `e39d074c` | `docs(195-07): record the self-tripping acceptance grep, and make the bare-directory check discriminating` |
| 3 | *(this file)* | `docs(195-07): the sweep's four firings, the stripper's three catches, and the three-form byte-identity arm` |

**Task 2 produced no commit.** It is a set of PROOFS about tasks 1 and 3, driven against real
production source and restored md5-identically; its artifact is this record, not a diff. Stated
plainly rather than manufacturing a commit to look symmetrical (the 195-04 precedent).

---

## The four sweep firings — one per swept file, with what each caught

⚠ **Every plant edits REAL production source, is observed RED with the failing case NAMES read (not
just the count — 194-06), and is restored with md5 before == after.** The harness aborts on an empty
diff (the 195-03 CRLF trap, which reported GREEN while applying nothing) and refuses to compare a
digest it could not compute (the 195-04 false-pass, where `[ "" = "" ]` reported a successful
restore).

### FIRING 1 — `frontend/src/pages/WorkflowRunPage.tsx` (three sub-plants, one per clause)

`expect` short-circuits, so a single plant leaves the later clauses of a case unproven (194-10 needed
six plants where two were named; 194-12 needed eleven). All three clauses of ARM 1 were driven:

| Sub-plant | Edit | Failing case NAMES | Verdict |
|---|---|---|---|
| **a1** | re-add `function formatBytes` (with the KiB arithmetic) | *ARM 1 — the run page declares no formatBytes, no baseName and no iconFor* · *the KiB arithmetic itself lives in NONE of the four swept files* | `2 failed \| 18 passed (20)` |
| **a2** | re-add `function baseName` | *ARM 1 — …* | `1 failed \| 19 passed (20)` |
| **a3** | re-add `function iconFor` | *ARM 1 — …* | `1 failed \| 19 passed (20)` |

md5 `f6df326482d98bcbeef2ec981fad57aa` → planted (`0f6384c5…` / `c13c2556…` / `d882d890…`) → **restored
`f6df326482d98bcbeef2ec981fad57aa` on all three.**

### FIRING 2 — `frontend/src/components/panel/FilesSection.tsx` (three sub-plants)

| Sub-plant | Edit | Failing case NAMES | Verdict |
|---|---|---|---|
| **b1** | re-add `function formatBytes` | *ARM 2 — the panel file list declares no formatBytes and no iconFor* | `1 failed \| 19 passed (20)` |
| **b2** *(the plan's plant (c))* | re-add an inline `iconFor` **with a `codeExts` array** | *ARM 2 — …* · *ARM 4b — no OTHER in-scope file declares an extension-to-glyph map* | `2 failed \| 18 passed (20)` |
| **i** | import `@/lib/fileIcon` DIRECTLY, opening a second import edge | *ARM 4c — exactly ONE import edge: no converted surface imports the icon module* | `1 failed \| 19 passed (20)` |

md5 `1440032f5e7116324c11c531f84c1b8c` → planted → **restored identical on all three.**

### FIRING 3 — `frontend/src/components/chat/OutputFileCard.tsx` (three sub-plants)

| Sub-plant | Edit | Failing case NAMES | Verdict |
|---|---|---|---|
| **c1** | re-add `function formatBytes` | *ARM 3a — chat's output card declares no formatBytes* | `1 failed \| 19 passed (20)` |
| **d1** | a **third** `<FileRow` delegation | *ARM 3b — chat renders exactly TWO shared rows and no hand-written row root* | `1 failed \| 19 passed (20)` |
| **d2** | a **hand-written** row root carrying the chat density's layout signature | *ARM 3b — …* | `1 failed \| 19 passed (20)` |

**d1 and d2 red the SAME case through DIFFERENT clauses**, which is why both exist: the plan offered
a choice between the two measurements and this suite carries both (D-195-07-A). md5
`97d08bd607dc16cf8169b668372011fc` → planted → **restored identical on all three.**

### FIRING 4 — `frontend/src/lib/fileIcon.tsx`

| Sub-plant | Edit | Failing case NAMES | Verdict |
|---|---|---|---|
| **j** | drop `export` from `export function fileIcon(` | *ARM 4a — `lib/fileIcon.tsx` IS that one path* | `1 failed \| 19 passed (20)` |

md5 `e2622f626e4d9b41d72325ad2a809add` → `15f323eb…` → **restored identical.**

**No plant produced a SKIP** (194-12's failure mode) — every run reported `N failed | M passed (20)`.

---

## ⚠ THE STRIPPER PLANT — and the THREE arms it caught passing on the empty string

**This is the plan's adopted 27th plant and the most load-bearing measurement in the file.** `codeOf`
was broken to return `""`; the suite was re-run and **every case name on both sides was read.**

**Result: `15 failed | 5 passed (20)`.**

**RED, as predicted** — the stripper's own self-proving case plus **all four** non-vacuity guards:

```
× the comment stripper actually strips, and it is the LINE-ANCHORED form
× non-vacuity — run page really loaded, is the RIGHT file, and its prose really strips
× non-vacuity — panel file list really loaded, is the RIGHT file, and its prose really strips
× non-vacuity — chat output card really loaded, is the RIGHT file, and its prose really strips
× non-vacuity — icon module really loaded, is the RIGHT file, and its prose really strips
```

⚠ **GREEN — and these three are the finding.** They are the arms whose every substantive clause is
an ABSENCE assertion, so on an empty string they pass while measuring nothing:

```
✓ the KiB arithmetic itself lives in NONE of the four swept files
✓ ARM 4b — no OTHER in-scope file declares an extension-to-glyph map
✓ chat capability — no swept file renders raw markup
```

**That is the 192.1 failure, reproduced on purpose inside the very suite built to prevent it.** Three
fences defending nothing, reporting green — exactly the shape of `librarySubtree.fences` sweeping a
renamed module against `""`. **The only reason they cannot ship that way is the four non-vacuity
guards above**, which is the measured justification for their existence rather than an argument for it.

**The plan predicted "the four non-vacuity cases red, NOT the SC#2 arms." The measurement is stronger
and is recorded as it came out, not as it was predicted:** ten *further* cases also red, because every
absence clause in this suite is deliberately paired with a PRESENCE clause (the import edge is still
there; the delegation count is still 2; `EXT_MAP` and the exported `fileIcon` are still present; the
props block still parses). Only the three arms above are pure-absence, and they are the three that
passed. **Both readings are published so the difference between the prediction and the measurement is
visible rather than smoothed over.**

Restored md5 `c2d7dfc3d837abc0d78a8b07494ef685` == before. ✅

---

## The guard evidence, as numbers

| File | `?raw` source chars | floor asserted | `codeOf` chars | floor asserted | identity anchor (unique to that file) | prose token (source ✅ / code ❌) |
|---|---|---|---|---|---|---|
| `WorkflowRunPage.tsx` | **64,150** | > 20,000 | **19,167** | > 8,000 | `run-deliverables` | `Phase 195-06` |
| `FilesSection.tsx` | **13,522** | > 6,000 | **6,445** | > 3,000 | `Workspace files` | `CORRECTION 2` |
| `OutputFileCard.tsx` | **12,082** | > 5,000 | **2,742** | > 1,200 | `resolveOutputUrl` | `D-195-02-B` |
| `fileIcon.tsx` | **13,392** | > 6,000 | **4,364** | > 2,000 | `EXT_MAP` | `T-195-03-03` |

**The stripper's own case is self-proving and tests the ANCHORING, not merely the stripping.** A
synthetic sample carries `function formatBytes(` in a block comment, in a line comment and in an
INDENTED line comment, alongside `const keep = "https://example.test/a"`. The case asserts the token
is gone, that real code survives, **and that the URL literal survives intact** — which is the single
property separating the line-anchored `codeOf` from the `ChatLayout.launch.test.tsx:458` variant that
eats from any `//` to end of line. That variant was **not** copied:
`grep -c` for its literal in the suite → **0**.

### ⚠ Why reading stripped code is not a convenience here — measured on this exact corpus

| File | Token | Where it actually is |
|---|---|---|
| `FilesSection.tsx` | `@/lib/fileIcon`, `FileSpreadsheet`, `FileCode`, `FileImage` | **prose only** — the CORRECTION-2 docblock explaining the deliberate glyph change; the file imports none of them |
| `WorkflowRunPage.tsx` | `1024` | **prose only** — inside the citation `types/index.ts:1024` |
| `fileIcon.tsx` | `codeExts`, `iconFor` | **prose only** — the nine-extension note and the branch-order note |

A raw sweep reds on all three, i.e. **on the explanations rather than on a defect**, and the only way
to make it green would be to delete the explanations (the 187-24 trap on its seventh recorded
instance in this repository). Each of these is asserted in BOTH directions by the suite — present in
`source`, absent from `code` — so the distinction is measured, not claimed.

---

## The byte-identity arm (P7a) — all THREE forms, at the phase's final state

⚠ **Written this way because of `D-195-04-D`, which is a measured defect in the criterion as the plan
worded it.** 195-04 planted one byte and found the `<BASE> HEAD` form **blind to it**; a P7(a)
assertion written as a commit-to-commit `numstat` alone would pass trivially.

**The base was PROVED, never assumed** (7/7 worktrees forked wrong in 194, 8/8 in 194.1):

| Check | Output |
|---|---|
| `git rev-parse --verify f2eef045…` | `f2eef045096efabdf7f05a1175271272b55617b9` — the SHA exists |
| `git merge-base --is-ancestor f2eef045… HEAD` | **exit 0** |
| Subject at that SHA | `docs(195): plans verified — 8 plans / 4 waves, checker PASSED first iteration` — matches `195-BASELINE.md` verbatim |
| HEAD | `1c027f49` · `docs(phase-195): close wave 3 — 6/8 plans, all three surfaces on the shared row` |

**All three forms, clean at the phase's final state:**

| # | Form | Output |
|---|---|---|
| 1 | `git diff --numstat f2eef045… HEAD -- MessageItem.tsx ExecuteCodeBody.tsx` | **EMPTY** |
| 2 | `git diff --numstat f2eef045… -- <same>` (working-tree) | **EMPTY** |
| 3 | `md5sum` | `4a83da8b27f91e70ff3e18d2ce181242` · `386ed875acf6938f3fbcd0bac38777ab` — **exactly `195-BASELINE.md`'s two recorded digests** |

**POSITIVE CONTROL on the form-1 SHAPE**, so its emptiness is not vacuous — 195-04's control,
re-driven here rather than inherited:

```
git diff --numstat 7e5d1fb8~1 7e5d1fb8 -- MessageItem.tsx ExecuteCodeBody.tsx
94      3       frontend/src/components/chat/MessageItem.tsx
```

**AND `D-195-04-D` WAS RE-DRIVEN, NOT QUOTED.** One space byte planted at offset 5378 of
`MessageItem.tsx` (**48,235 → 48,236, verified +1**):

| Form, with the plant applied | Output | Fires? |
|---|---|---|
| 1 — `<BASE> HEAD` | `""` | ❌ **NO — the defect reproduces exactly** |
| 2 — working-tree | `1\t1\tfrontend/src/components/chat/MessageItem.tsx` | ✅ yes |
| 3 — md5 | `aa0d89a716739acde9fd616044809172` | ✅ yes |

The planted digest is **the same value 195-04 recorded** — independent corroboration of that finding
from a different worktree, a different base and two waves later. Restored to
`4a83da8b27f91e70ff3e18d2ce181242`; the working-tree numstat is empty again.

**Corroborated structurally as well:** the props-interface block md5 is
`545b317289222e38b09139e8dcc41e55` (unchanged since 195-04) and
`grep -c "export interface OutputFileCardProps\|export type OutputFileCardProps"` → **0**.

### P7(b) and P7(c) — the two capability plants

| Plant | Edit | Suite | Failing case NAMES | Verdict |
|---|---|---|---|---|
| **f** — P7(b) | a **fourth** optional prop (`onPreview?`) on `OutputFileCardProps` | the sweep | *chat capability — the prop set is EXACTLY the six declared keys, with no seventh* | `1 failed \| 19 passed (20)` |
| **g** — P7(b2) | `interface` → `export interface` | the sweep | *chat capability — the props interface is still NOT exported* | `1 failed \| 19 passed (20)` |
| **h** — P7(c) | chat's live row becomes a `<button>` | **`OutputFileCard.baseline.test.tsx`** (the DOM fence, not the sweep) | *LIVE branch: a url-bearing file with `supersedes` renders the Replaces subline* · *the live row is an `<a>` with href, download and target — not a button, not a div[role]* | `2 failed \| 19 passed (21)` |

All three restored to `97d08bd607dc16cf8169b668372011fc`. **P7(c) was run against the suite that owns
the assertion, and that suite is named here** as the plan required.

---

## Task 3 — the pins, verified rather than re-raised

⚠ **Every number below is THIS SCRIPT'S OWN printed `actual` column across TWO AGREEING RUNS**, never
hand-counted from `it(` literals. Hand-counting would have been wrong for the new suite by a measured
margin: **16 plain `it(` + ONE 4-way `it.each` = 20 cases**, so an `it(`-grep reads 16 and a grep
counting both literal forms reads 17.

**Run 1 and run 2, verdict line verbatim, identical:**

```
  total                                      4096    4170     +74
  total 4170  ·  failed 0  ·  pinned total 4096
--------------------------------------------------------------
count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing.
```

**All nine Phase-195 suites, from the gate's own per-file lines (`pinned  actual  delta`):**

| Suite | pinned | actual | Δ | Raised by |
|---|---|---|---|---|
| `WorkflowRunPage.test.tsx` | 108 | **108** | 0 | 102 → 105 (195-02), 105 → 108 (195-06) |
| `fileIcon.test.tsx` | 41 | **41** | 0 | 11 → 41 — ⚠ by the **ORCHESTRATOR** at the wave-2 close; 195-03 left it at 11 |
| `FileRow.test.tsx` | 40 | **40** | 0 | 195-03 (new) |
| `fileRowUtils.test.ts` | 22 | **22** | 0 | 195-03 (new) |
| `FilesSection.test.tsx` | 22 | **22** | 0 | 11 → 22 (195-05) |
| `OutputFileCard.baseline.test.tsx` | 21 | **21** | 0 | 195-02 (new) |
| **`FileRow.sweep.test.ts`** | **20** | **20** | **0** | **195-07 — new, this commit** |
| `StopControl.baseline.test.tsx` | 15 | **15** | 0 | 195-02 (adopted) |
| `MessageItem.finalOutputs.test.tsx` | 11 | **11** | 0 | 195-02 (adopted) |

**Nothing needed re-raising — every pin already sat AT its actual**, which is the state the plan's
must_have asks for. The gate's comment block now carries that whole table with OLD → NEW and the plan
that grew each, plus the reason a pin must never lag: the contract is *no per-file DECREASE*, so a pin
of 11 against an actual of 41 means **thirty cases can be deleted with the gate green** — the exact
state `fileIcon.test.tsx` was in for a whole wave.

**Adoption is FILE-LEVEL, never the bare directory.** 195-03's block predicted this by name
(*"including `FileRow.sweep.test.ts`, which does NOT exist yet and whose adoption belongs to plan
195-07, with 07's numbers and 07's reasons"*) — honoured exactly. The path was `ls`-confirmed before
the entry was written (a non-existent `TARGETS` path makes the gate **ERROR at exit 2**, not fail, for
every later plan), and the bare filename confirmed unique tree-wide by `find` (the BASELINE key space
is global). ⚠ `git ls-files | grep -c` read **0** at that moment — because the file was still
untracked, not because it was absent; recorded so the reading is not mistaken for a contradiction.

### Both knobs, because a green gate covers a minority of this phase

| Knob | Result |
|---|---|
| Count gate | ✅ `count gate OK — 83/83 …, 0 failing` · `total 4170 · failed 0 · pinned total 4096` — **two agreeing runs, and a third after the commit-2 edit, all identical** |
| The explicit **ungated** command from `195-VALIDATION.md` | ✅ **6 files / 156 passed / 0 failed** = 22 + 11 + 41 + 40 + 22 + 20 |
| The plan's task-2 verify set | ✅ **7 files / 248 passed / 0 failed** |

Both gate totals **exceed** the `195-BASELINE.md` floor (`3972 / 3898 / 75`) — a growing number is the
gate WORKING, since its contract is *no per-file decrease* + *zero failing*, never a fixed total.

**SEED-171 did not fire.** The gate came back clean on its **first** run and on every subsequent run,
so there were no failing filenames to capture and the capture-before-re-run rule had nothing to
record. Stated as a measured fact rather than left to silence.

---

## Verification

| Check | Result |
|---|---|
| `bash scripts/bootstrap-worktree.sh "$(pwd)"` ran **FIRST** | ✅ `BOOTSTRAP OK` |
| Base asserted, corrected `fda79214` → `1c027f49` | ✅ echoed below and in Deviations |
| `tsc --noEmit -p tsconfig.app.json` | ✅ **33** — the `195-BASELINE.md` floor, unmoved, before and after |
| ⚠ The three pre-existing `TS2304` in `FilesSection.test.tsx` | ✅ **still present** — a reading of 30 would mean they were touched; 195-08 owns them |
| Count gate verdict, verbatim, two agreeing runs | ✅ `count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing.` |
| Ungated command | ✅ 156 passed / 0 failed |
| `?raw` **import statements** in the suite | ✅ **exactly 4** (a bare `grep -c '?raw'` reads 5 — the 5th is prose; see D-195-07-D) |
| `grep -c toBeGreaterThan` | ✅ **5** (≥ 4 required) |
| Unanchored `ChatLayout` stripper copied? | ✅ **0** |
| A case selectable by `-t "chat capability"` | ✅ 4 cases |
| Docblock names both deliberate exclusions with reasons | ✅ `lib/fileIcons.tsx` · `panel/SeamCard.tsx` |
| `grep -c FileRow.sweep.test.ts scripts/vitest-count-gate.cjs` | ✅ **9** (≥ 2 required) |
| A **bare-directory** `TARGETS` entry exists? | ✅ **no** — anchored array-element regex exits 1 |
| Every plant-touched file md5-identical afterwards | ✅ all six (4 swept + `MessageItem.tsx` + `ExecuteCodeBody.tsx`) |
| `package.json` / `package-lock.json` | ✅ **EMPTY** numstat — no install, no `slopcheck` owed |
| `.planning/STATE.md` · `ROADMAP.md` · `CLAUDE.md` · `docs/HOT-FILE-LEDGER.md` | ✅ **EMPTY** numstat — untouched, committed and uncommitted |
| `git diff --diff-filter=D` on this plan | ✅ **EMPTY** — nothing deleted |
| Working tree after every plant | ✅ `git status --short` clean |

---

## Threat model — dispositions discharged

| Threat ID | Disposition | How |
|---|---|---|
| **T-195-07-01** Repudiation — the sweep's own validity | ✅ **mitigated, and the mitigation was MEASURED to be necessary** | Length + identity guard per `?raw` import; a stripper non-vacuity pair per file; and the stripper plant, which broke `codeOf` to return `""` and showed **exactly three arms passing vacuously** while all four guards red. Without them this suite would have been the 192.1 defect it was built to prevent |
| **T-195-07-02** Repudiation — the gate's numbers | ✅ **mitigated** | Every pin read from the printed `actual` across two agreeing runs, both quoted verbatim; all nine Phase-195 pins end **AT** actual with delta 0 |
| **T-195-07-03** DoS (CI) — a non-existent `TARGETS` path | ✅ **mitigated** | Path `ls`-confirmed before the entry was written; filename confirmed unique tree-wide; the gate run as the task's verify, three times, `OK` each time |
| **T-195-07-04** Tampering — production source during plants | ✅ **mitigated** | 15 plants across 6 files; **every one restored and verified md5-identical**, digests recorded above. The harness aborts on an empty diff and refuses an empty digest |
| **T-195-07-SC** package installs | ✅ **n/a** | `git diff --numstat` on `package.json` / `package-lock.json` **EMPTY**. No install attempted |

---

## Known Stubs

**None.** This plan ships no runtime code — one test file and one CI-script edit. Every assertion in
the suite reads a real file and every needle carries a positive control.

## Threat Flags

**None.** No endpoint, fetch, route, hook, persistence, auth path or dependency. The only files
touched by the commits are a test and a CI script.

---

## Deviations from Plan

### ⚠ 1. [Rule 3 — blocking] The worktree forked from the WRONG base. **19th recorded instance.**

`git rev-parse HEAD` read **`fda792141b0129de7b15dd40ddc1082e76f95a2a`** — the same `master` merge
commit that caught 195-02, 195-03 and 195-04 — and `git merge-base HEAD 1c027f49` returned
**`3781a3fe`**, not the expected SHA. `git reset --hard 1c027f49` applied per the dispatch's assertion
block; the corrected HEAD was re-verified before the plan was read.

**The assertion is the only reason it was caught, and it matters more here than usual:** this plan's
headline claim is a byte-identity assertion measured against a NAMED base, and a wrong base would have
made it trivially true — which is precisely the failure `195-BASELINE.md` warns about.

### 2. [D-195-07-E] Tasks 1 and 3 ship in ONE commit

The plan asks for per-task commits; the gate's own rule — restated three times in
`vitest-count-gate.cjs` and again in this plan's own task 3 (*"in this commit — the commit that created
the file"*) — requires a new suite's `TARGETS` + `BASELINE` entries to land **in the same commit as the
file**. The two cannot both be honoured. The same-commit rule wins, because splitting them would ship a
commit whose gate ERRORS at exit 2 (if TARGETS led) or whose new suite is invisible to CI (if the file
led). Task 2 produced no commit because it produced no artifact.

### ⚠ 3. [D-195-07-D — FINDING] The plan's bare-grep acceptance criterion is UNSATISFIABLE once documented, and it fired TWICE

The criterion was: `grep -n '"src/components/files"' scripts/vitest-count-gate.cjs` returns nothing.
The first version of the new `TARGETS` comment wrote that path double-quoted **while explaining that no
such entry exists** — so the grep matched its own explanation and read 1. The second version replaced
it with a stricter anchored regex, quoted in full — **and matched THAT.**

This is 195-06's finding one level up (a grep that cannot tell `not.toMatch(` from `toMatch(` reads 3
where the truth is 0) and 187-24's *prose is never exempt*. It is also, precisely, the reason every arm
of the new suite reads STRIPPED code rather than raw bytes — **the plan's own acceptance criterion fell
into the trap the artifact it was accepting is built to avoid.**

**Resolved in commit `e39d074c`, with the original recorded beside the correction:** the path is written
in backticks throughout (195-03's form), the discriminating check is *described* rather than quoted, and
the criterion now reads clean. The check that actually discriminates is an anchored regex matching a
whole ARRAY-ELEMENT line — `^\s*"<the bare directory path>",\s*$` — which a prose mention structurally
cannot satisfy, because prose is preceded by `//`. It exits 1.

The same class of defect is recorded for the `?raw` criterion: `grep -c '?raw'` reads **5**, because the
docblock says *"every `?raw` import"*. The count of actual import STATEMENTS
(`grep -cE '^import [A-Za-z]+ from "[^"]+\?raw"$'`) is **4**, as required.

### 4. [Scope +9] Fifteen plants, where the plan named six

The plan required four P6 plants + the stripper + P7(b) + P7(c). Fifteen were driven, and the extras
are not padding — each closes a specific short-circuit gap:

- **a2, a3** — ARM 1 has three clauses and `expect` short-circuits, so a1 alone left `baseName` and
  `iconFor` unproven (the 194-10 / 194-12 lesson).
- **d1, d2** — ARM 3b's two clauses measure "one row markup" two different ways (D-195-07-A); one
  plant would have proved only one of them.
- **i** — ARM 4c (the single import edge) has no other plant that reaches it.
- **j** — ARM 4a's `export` clause likewise.
- **g** — the "still not exported" case is a distinct capability claim from the prop-set case, and
  P7(b) as worded only reaches the latter.
- **The P7(a) one-byte plant** — re-driven rather than inherited from 195-04, because
  *"don't inherit unmeasured claims"* applies to measured ones too when the tree has moved two waves.

### ⚠ 5. [Recorded, not fixed] The stripper plant's outcome differs from the plan's prediction

The plan predicted the four non-vacuity cases would red and the SC#2 arms would not. **Ten further
cases also red**, because every absence clause in this suite is paired with a presence clause. Exactly
three arms are pure-absence and exactly those three passed. Both the prediction and the measurement are
published above; the measurement is the stronger result and it is written as it came out.

---

## What this plan does NOT claim

1. **No browser rendered anything.** This is a SOURCE sweep plus git/md5 measurements. It proves the
   tree contains one of each; it does not prove a user sees one of each. D-20's visual acceptance is
   not discharged here and belongs to 195-08's UAT.
2. **The sweep does not read `lib/fileIcons.tsx` or `panel/SeamCard.tsx`.** That is a RECORDED
   BOUNDARY (D-195-07-C), asserted in the suite and explained in its docblock — **not** a claim that
   only four presentations exist. ⚠ **SeamCard is a FIFTH**, and its own docblock's claim to *"reuse
   OutputFileCard's chip shape"* is measurably FALSE today (`grep -c` for `fileIcon`, `formatBytes`
   and `FileRow` → **0** for all three). Whoever converts it owns adding the fifth arm.
3. **`FileRow.tsx` itself is not swept.** The suite proves the three surfaces delegate to it and that
   nothing else declares a row; it does not fence the shared row's own internals. `FileRow.test.tsx`
   (40 cases) and `fileRowUtils.test.ts` (22) do that.
4. **The run page has no layout-signature clause** (D-195-07-B), and that is a stated gap rather than
   an oversight: `WorkflowRunPage.tsx:896` legitimately uses the same three utility classes for its
   header. The page is measured by its delegation count alone.
5. **Two `codeOf` implementations still ship in this tree.** This plan used the line-anchored one and
   proved the anchoring in a case; it did **not** unify them. `ChatLayout.launch.test.tsx:458` still
   carries the unanchored form.
6. **This plan touched no document, no seed and no ledger row.** `CLAUDE.md`,
   `docs/HOT-FILE-LEDGER.md` and every `.planning/seeds/` file are byte-unchanged — 195-08 owns the
   doc sweep, and the `OutputFileCard.tsx` / `FilesSection.tsx` G-5 obligations flagged by
   `195-BASELINE.md` remain 195-08's to discharge.

---

## Self-Check: PASSED

- `frontend/src/components/files/__tests__/FileRow.sweep.test.ts` — **FOUND** (26,939 bytes, 20 cases)
- `scripts/vitest-count-gate.cjs` — **FOUND**, carries `FileRow.sweep.test.ts` ×9
- `.planning/phases/195-show-the-deliverable/195-07-SUMMARY.md` — **FOUND**
- commit `b4c5a7ee` — **FOUND** in `git log --oneline --all`
- commit `e39d074c` — **FOUND** in `git log --oneline --all`
- The plant harness (`plant.cjs`, `drive.cjs`, `plants.json`, `p7a.cjs`, `probe.cjs`) — written to the
  **scratchpad only**, never inside the watched tree, never committed (`git status --short` clean)
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md` — **UNTOUCHED**,
  both committed and uncommitted

---

*Phase 195 Plan 07 — SC#2 is now something the repository checks, and the guards that make it real were
themselves proved able to fail.*
