---
phase: 252-close-the-v42-audit-gaps
plan: 05
subsystem: count-gate
tags: [CRED-02, W-7, D-03, D-33, D-39, both-knobs, slack, SEED-280, ledger]
requires:
  - "252-03 — WatchRowCard.test.tsx (9 cases) and the sourceHealthVocabulary extension"
  - "252-04 — the TodosSection / PhaseCard case additions"
provides:
  - "WatchRowCard.test.tsx in BOTH count-gate knobs — the suite now RUNS and is GUARDED"
  - "ConnectionGrantsList.test.tsx pinned at 9 — W-7's slack closed after being exploited"
  - "seven per-file pins re-derived from the gate's own `actual` column, each attributed"
affects:
  - "scripts/vitest-count-gate.cjs (sole writer for phase 252)"
  - "CLAUDE.md + docs/HOT-FILE-LEDGER.md (same-commit sync)"
  - ".planning/seeds/SEED-280 (sixth case closed, five remain)"
tech-stack:
  added: []
  patterns:
    - "TARGETS decides what RUNS; BASELINE decides what is GUARDED — a file can be on the wrong side of both"
    - "a slack is closed AFTER being exploited, never on the arithmetic"
    - "compare failing SETS, never counts"
    - "re-derive a ledger triple; never increment a cell"
key-files:
  created: []
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/seeds/SEED-280-five-suites-in-neither-count-gate-knob.md
decisions: [D-03, D-33, D-38, D-39, D-44a]
metrics:
  duration: ~1h
  completed: 2026-09-16
---

# Phase 252 Plan 05: Both knobs, and a slack closed after being seen — Summary

Every suite this phase created or changed now both **runs** and **is guarded**, seven pins were
re-derived from the gate's own output rather than from the handover summaries (which were wrong in
three places), and a unit of permanent slack standing since Phase 221 was closed **after being
watched keeping the gate green on a deleted test**.

## What shipped

| # | Task | Commit |
|---|---|---|
| 1 | Re-derive the truth before editing the gate that asserts it | *(no diff — measurement only)* |
| 2 | Both knobs — adopt, re-pin, and close W-7's slack | `97174227b` |
| 3 | The ledger row and the seeds re-sweep | `86bb1f9c1` |

Base: `1a0eb720d` (`merge(252-02)`), main tree, branch `develop`, no worktree, no sibling agent.
`GSD_VITEST_MAX_WORKERS=2` on **every** invocation. ⛔ The cap was never touched.

---

## ⛔ TASK 1 — THE BASE WAS EXPECTED RED AND MEASURED GREEN

### The verbatim PRE verdict line

```
  total                                      7572    8391    +819
  total 8391  ·  failed 0  ·  pinned total 7572
--------------------------------------------------------------
count gate OK — 287/287 pinned files present, no per-file decrease, 0 failing.
```

Report: `C:\Users\fhdmr\AppData\Local\Temp\vitest-count-gate-109144-1789537553952.json`

### ⚠ THE FAILING SET IS EMPTY, AND THAT CONTRADICTS THE BASE THIS PLAN WAS BRIEFED ON

`252-CONTEXT.md` D-44a recorded the base as **`total 8379 · failed 2 · pinned 7572`**, both failures
being `src/components/library/__tests__/sketchComposition.test.tsx`'s §2 positive controls — the
`STACK_TRACE_ERROR` one and the *"the four shipped tab triggers render"* one — **SEED-171's recorded
pair on its FOURTH reproduction.**

Measured here on the merged wave-1 tree:

| | D-44a (base) | **this plan, PRE** | **this plan, POST** |
|---|---|---|---|
| grand total | 8379 | **8391** | **8400** |
| `failed` | **2** | **0** | **0** |
| pinned total | 7572 | 7572 | **7660** |
| pinned files | — | 287/287 | **288/288** |
| `sketchComposition.test.tsx` row | 2 red | **`47  47  0`** | **`47  47  0`** |

⛔ **THIS IS NOT EVIDENCE THE PAIR IS FIXED, AND IT MUST NOT BE WRITTEN UP AS ONE.** *One green
sample of a flaky suite proves nothing* — that is SEED-171's own rule, and this reading is simply
the inverse of the sample that produced D-44a, on a tree where
`git status --short frontend/src/components/library/` is empty. **Recorded as *provably unmodified*,
⛔ never as *fine*.** The suite is a member of SEED-171's five and is byte-unchanged at this base.

⭐ **What the empty set DOES establish is exactly what the plan needed:** the failing SET was empty
before the edit and empty after it, so **this phase added no red**. Compared as SETS, never counts.

### The triage procedure, run even though nothing was red

| Step | Result |
|---|---|
| failing filenames pulled from the gate's own persisted JSON *before* any re-run | **none — `failed 0`** |
| `git diff --numstat` / `git status --short` against each failure | **vacuous, no failures to disposition** |
| cap adjusted? | ⛔ **no.** `GSD_VITEST_MAX_WORKERS=2` on every run |
| re-runs to "get a better result"? | ⛔ **none.** The first run was the recorded one, both times |

### Every row the plan cares about, read off the gate's own `actual` column

```
  sourceHealthVocabulary.test.ts               42      74     +32
  PhaseCard.test.tsx                           41      60     +19
  PhaseTimeline.test.tsx                       35      38      +3
  WatchedFoldersSection.test.tsx               27      49     +22
  TodosSection.test.tsx                        24      26      +2
  ConnectionGrantsList.test.tsx                 8       9      +1
  WorkspacePanel.derived.test.tsx               4       4       0
  sketchComposition.test.tsx                   47      47       0
```

`WatchRowCard.test.tsx` appears **nowhere** in that output — it ran in no gate at all.

---

## ⚠ THE HANDOVER SUMMARIES WERE WRONG IN THREE PLACES. THE GATE WON EACH TIME.

| Claim | Source | ⛔ The gate |
|---|---|---|
| `sourceHealthVocabulary.test.ts` is "a **42**-case suite", so the move is `42 → M` | 252-03's plan | base is **69**. The pin of 42 was stale by 27 and the real move is **69 → 74** |
| `PhaseCard.test.tsx` — re-baseline to the measured post value | 252-04 | ✅ **agreed, and it flagged its own slack** — `55 − 41 = 14` units, none of it 252's |
| `PhaseTimeline.test.tsx` — 3 units of slack, none of it this plan's | 252-04 | ✅ **agreed** — 38 at base, 38 after, `+0` cases from 252 |
| `WatchedFoldersSection.test.tsx` | **named by NEITHER handover table as a pin to move** | pinned **27**, actual **49** — **22 units of slack**, surfaced only by reading every row |

⭐ The fourth row is the one worth carrying: **a file can be missing from a handover table and still
be 22 units adrift.** Reading the gate's whole `actual` column, rather than only the rows a summary
nominated, is what found it.

---

## ⭐ W-7 — THE SLACK WAS EXPLOITED BEFORE IT WAS CLOSED

`ConnectionGrantsList.test.tsx` carried **9** cases against a pin of **8** — one unit of permanent
slack, standing for the entire life of the entry (Phase 213, extended at Phase 221).
⛔ It was **not** closed on the arithmetic. *A slack nobody has seen exploited is an assertion.*

### The drive, step by step

| Step | Command / observation | Measured |
|---|---|---|
| 1 | `grep -c "^\s*it(\|^\s*test("` | **9** cases, against pin **8** |
| 2 | **md5 BEFORE** | **`d8ec1ecbd8d2fbe715a1e847f1fc3fbc`** |
| 3 | delete one case — `it("Invariant 8: zero [title] attributes in the rendered output", …)`, lines 171-186 | `it(` count → **8**, md5 → `1a7142dd4d8955cdcb86b8d827e89074` |
| 4 | re-run the suite, feed its JSON report to **this script's own comparison code** (`node scripts/vitest-count-gate.cjs --json <report>`) | ⛔ **`ConnectionGrantsList.test.tsx     8       8       0`** |
| 5 | grep the gate's output for `count-decrease` | ⛔ **nothing.** A deleted test kept the gate green |
| 6 | restore from the pre-drive copy | **md5 AFTER: `d8ec1ecbd8d2fbe715a1e847f1fc3fbc`** — **identical**, `it(` count back to **9** |
| 7 | `git status --short` on the file | **clean** — byte-identical, not merely equivalent |

⭐ **The demonstration used the gate's OWN comparison code, not a hand-applied rule.** The `--json`
entry point replays a real report through `delta = got − pinned; if (delta < 0) …`, which is the
exact line that was supposed to catch this and did not.

**Pin raised `8 → 9` in the same commit**, with the drive written into the comment beside it.

⚠ **The fix was NOT separately re-driven.** With the pin at 9, deleting a case would now produce
`9 8 -1` and fire `[count-decrease]` by that same line — that is arithmetic on code shown working,
not a fresh measurement, and it is stated as such rather than claimed as a second RED.

---

## Every changed pin, with its attribution

⛔ **MOST OF THE `+88` IS SLACK, NOT NEW CASES.** Reading a bigger number as growth is precisely the
drift this column exists to catch, so each row separates the two.

| File | pin → pin | base `actual` | post `actual` | of which THIS phase's | Attribution written beside the pin |
|---|---|---|---|---|---|
| `sourceHealthVocabulary.test.ts` | 42 → **74** | **69** | 74 | **+5** | 252-03: three `token_revoked` label cases, the `connection_disabled` occurrence pin, and ⛔ W-2's own measurement (429/503/timeout all classify `unreachable`; the union carries NO rate-limit member). **27 was pre-existing slack since 235-12** |
| `PhaseCard.test.tsx` | 41 → **60** | **55** | 60 | **+5** | 252-04: *THE LIE* · *THE CONTROL* · *THE DEFAULT* · a TERMINAL status is untouched by `runLive={false}` · retrying is the OTHER live reading. **14 was pre-existing slack** — re-baselined to 60, ⛔ never to `41 + 5` |
| `WatchedFoldersSection.test.tsx` | 27 → **49** | **49** | 49 | **0** | 252-03 deleted an SC#2 line that was PINNING W-2's rate-limit defect; case count did not move. **All 22 is slack since 235-10** |
| `PhaseTimeline.test.tsx` | 35 → **38** | **38** | 38 | **0** | ⛔ 252 added no case to this file. **All 3 is slack**, closed only because the file sits in 252-04's blast radius |
| `TodosSection.test.tsx` | 24 → **26** | 24 | 26 | **+2** | 252-04: "a reconciling thread still reads IN PROGRESS" (the thread-open flash, BUG-260915-01) and "a genuinely idle thread STILL reads NOT TICKED" (the HONEST-03 control). ⭐ **No slack at all** |
| `ConnectionGrantsList.test.tsx` | 8 → **9** | 9 | 9 | **0** | W-7, RED-driven above. Slack since Phase 221 |
| `WatchRowCard.test.tsx` | — → **9** | *not run* | 9 | **+9** | ⭐ NEW ADOPTION, both knobs. Count measured by vitest's own JSON reporter, never hand-counted |
| `WorkspacePanel.derived.test.tsx` | 4 → 4 | 4 | 4 | **0** | ⛔ **No change.** 252-04 added `useReconcilingForThread` to its mock factory and no case. Recorded in the file so a reader can tell *"measured, unmoved"* from *"not looked at"* |

### The arithmetic that separates growth from drift — residual ZERO on both totals

```
pinned total   7660 − 7572 = 88
               1 + 22 + 9 + 32 + 2 + 19 + 3 = 88        residual 0
grand total    8400 − 8391 =  9
               WatchRowCard.test.tsx now RUNS, 9 cases   residual 0
pinned files    288 −  287 =  1   (WatchRowCard)
```

⭐ **Nine of the nine new grand-total cases are the adopted suite.** Nothing else moved, which is the
positive evidence that this diff touched the gate and nothing else.

---

## ⭐ THE ADOPTION IS THE PHASE'S FINDING, NOT ITS BOOKKEEPING

`WatchRowCard.tsx` shipped three defects — WATCH-04's completion claim, the invented `(0 changes)`
literal, and a refusal and a success co-rendering on one card. It had **no test file at all**, and
`src/components/sources` is a set of ~14 individually-named TARGETS entries and **not a directory
entry**. So the suite 252-03 wrote would have run in **no gate** until its basename was typed.

**TARGETS decides what RUNS, BASELINE decides what is GUARDED, and this file was on the wrong side
of BOTH.** Both knobs, one commit — the fifth consecutive phase to record this about this directory.

### ⛔ The directory entry was DECLINED, deliberately

A `src/components/sources` directory entry would adopt ~10 unpinned suites in one edit and move the
shared gate for reasons unrelated to this phase — **including `sourceComposition.test.tsx`, which is
red (16 failed / 33 passed, re-measured 18/31) by a standing Phase 235 decision.** Adopting it would
redden the shared gate; adopting it with an allowance would make a gate that cannot fail. Recorded
as a deferred idea in `252-CONTEXT.md` and written into SEED-280; **a seed is owed at close.**

### ⚠ A SIBLING FIND, NAMED RATHER THAN SILENTLY LEFT

`frontend/src/components/sources/bug260912AppCredentials.test.ts` is in **neither knob either** —
252-03 moved its occurrence pin `4 → 5` and the gate could not see the file at all. **Not adopted**,
because this plan was authorised for exactly one adoption and an unrequested one moves the shared
gate for an unrelated reason. **Named in the gate's own TARGETS comment** so the omission reads as a
decision rather than as an oversight, and added to SEED-280 as its seventh case.

---

## The verbatim POST verdict line

```
  total                                      7660    8400    +740
  total 8400  ·  failed 0  ·  pinned total 7660
--------------------------------------------------------------
count gate OK — 288/288 pinned files present, no per-file decrease, 0 failing.
```

Every re-pinned row reads delta **0** after the edit:

```
  sourceHealthVocabulary.test.ts               74      74       0
  PhaseCard.test.tsx                           60      60       0
  WatchedFoldersSection.test.tsx               49      49       0
  sketchComposition.test.tsx                   47      47       0
  PhaseTimeline.test.tsx                       38      38       0
  TodosSection.test.tsx                        26      26       0
  ConnectionGrantsList.test.tsx                 9       9       0
  WatchRowCard.test.tsx                         9       9       0
  WorkspacePanel.derived.test.tsx               4       4       0
```

### The failing SET, both times, compared as SETS

| | PRE | POST |
|---|---|---|
| `[failing-tests]` | **absent** | **absent** |
| `[count-decrease]` | **absent** | **absent** |
| `[missing-file]` | **absent** | **absent** |
| failing set | **∅** | **∅** |

⭐ **Identical. Empty both times.** ⛔ Compared by grepping the gate's failure lines out of each
captured run, never by comparing `failed 0` to `failed 0`.

### Scope

```
$ git diff --stat        # for the task-2 commit
 scripts/vitest-count-gate.cjs | 81 ++++++++++++++++++++--
```

⛔ **Exactly one file.** No product file entered this plan's diff.
⚠ Two files were dirty in the tree **before this plan started** and were never staged:
`.claude/settings.local.json` and `.planning/phases/236-…/236-ROSTER-REPORT.md`. Stated rather than
left to be inferred from a `git diff --stat` that lists three paths.

---

## Task 3 — the ledger triple, RE-DERIVED

⚠ **Never incremented.** The row read `215 / 47 / 5682` and was **STALE a 6th time**; the one before
it read `211 / 46 / 5618` and was stale a 5th.

```
$ git log --oneline -- scripts/vitest-count-gate.cjs | wc -l
222

$ raw subject buckets  →  52
$ six-digit DATED QUICK-TASK buckets, SUBTRACTED  →  260807  260808  260814   (three)
$ phases = 52 − 3 = 49

$ wc -l scripts/vitest-count-gate.cjs
5787
```

| | shipped row | **re-derived 2026-09-16** |
|---|---|---|
| commits | 215 | **222** |
| phases | 47 | **49** |
| lines | 5682 | **5787** |

⚠ **The subtraction is load-bearing and this file's own cell has been corrected for skipping it
before** (206.1-01 published `114 / 22` where the truth was `114 / 19`). Raw `52` would overstate
G-5 by three.

Row updated in `CLAUDE.md:703` **and** its scan-list row in `docs/HOT-FILE-LEDGER.md:10424`, with
the narrative appended to that file's §`Phase 252 Plan 05` — **all in the same commit** (`86bb1f9c1`).

⚠ **The disposition cap bit, and it bit twice.** The first cell measured **203 chars** and the second
**201**, against the 200 cap — `[disposition-too-long]`, exit 1, both times. ⭐ **The gate fired in
the turn the prose was authored**, which is exactly what it exists to do; the cell was cut to 197 and
the reasons went into the detail file. ⚠ Note the cap is measured on the **`docs/HOT-FILE-LEDGER.md`
scan-list row**, not on CLAUDE.md's copy — a local `[...s].length` of 199 on the CLAUDE.md string
disagreed with the gate's 203, and **the gate won**.

### Gates

| Gate | Result |
|---|---|
| `node scripts/check-claude-md-size.cjs` | ✅ **`claude-md size gate OK`** — `102478 chars · 68.3% of limit · headroom 47522`. No `[disposition-too-long]`, no `[duplicate-row]`, no `[malformed-row]` |
| `node scripts/check-hot-file-ledger.cjs 252` | ✅ **`ledger gate OK`** — 281 rows · 31 subject files · 13 watched · every one has a row |
| `node scripts/check-seeds-register.cjs --phase 252` | ✅ **`seeds register gate OK`** — 293/293 parsed, 0 duplicate ids, 293/293 carry all 5 required keys |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | ✅ **`count gate OK`** — 8400 · failed 0 · pinned 7660 · 288/288 |

---

## The seeds sweep — ⭐ a real blast radius for the first time

⭐ **D-38 recorded that at scoping this printed `0 seeds matched` while also printing that the phase
declared no surfaces — an honest non-result, never a clean sweep.** With `files_modified` now present
across five PLAN.md files it matched **seven**. Full output, with each hit dispositioned:

⚠ The sweep still prints `the phase declares NO surfaces, so trigger_surfaces matched nothing here` —
**that arm remains a non-result**; all seven hits came from `trigger_paths`.

| Seed | status | Matched path **and glob** | ⛔ Routing |
|---|---|---|---|
| **SEED-280** — *Five suites run by the count gate and guarded by nothing* | `planted` | `**/vitest-count-gate.cjs` → `scripts/vitest-count-gate.cjs` | ⭐ **GENUINE HIT — routing written into the seed.** Its **sixth** case is CLOSED (`WatchRowCard`, both knobs). ⛔ **Stays `planted`:** this plan's own pre-gate re-measured the original five still in the `new` column at counts **IDENTICAL** to the seed's 2026-08-31 table — `PromptVariableChips 3` · `RunHero 18` · `automationFacts 11` · `nodeEffectBanner 8` · `toolReadOnlyMap 7`. Sixteen days, zero drift, zero action. A **seventh** case added (`bug260912AppCredentials.test.ts`) |
| SEED-177 — MCP connections both ways | `partially-answered` | `backend/app/**` → `setup.py`, `connector_service.py`, `connectors.py` | ⛔ **Broad-glob match, NOT routed.** Nothing in this wave advances or answers MCP breadth; writing a routing would be a false record |
| SEED-185 — no client-side router | `planted` | `frontend/src/**` → 13 files | ⛔ **Broad-glob match, NOT routed.** No route was added or removed anywhere in phase 252 |
| SEED-188 — anti-prompt-injection asserted in prose, verified by nobody | `open` | `backend/app/**`, `backend/tests/**` | ⛔ **Broad-glob match, NOT routed.** 252-02's two backend suites are a credential-boundary fence, not an injection harness |
| SEED-198 — Experts | `planted` | `backend/app/**` | ⛔ **Broad-glob match, NOT routed.** No subsystem composition in scope |
| SEED-266 — `full-schema.sql` carries no table ACLs | `partially-answered` | `**/full-schema.sql` → `supabase/full-schema.sql` | ⛔ **NOT routed.** The file is in a wave-1 plan's `files_modified` as a regenerated artifact; no ACL work was done and claiming otherwise would be the false record this register exists to prevent |
| SEED-284 — three file-local elapsed formatters | `planted` | `**/ThinkingBlock.tsx` | ⛔ **NOT routed.** No formatter was added or unified by this phase |

⚠ **Six of seven fired on a directory-wide glob.** A `trigger_paths` of `frontend/src/**` fires on
every frontend phase forever, which makes it a *notification*, not a trigger — worth saying, because
a sweep that reports seven hits and means one is the same rubber stamp this plan spent its day
removing from the count gate. **A seed is answered by editing the seed**, so only the one this plan
genuinely moved was edited; the other six are left byte-unchanged.

---

## Deviations from Plan

### `[Rule 2 - Correctness]` Two pins re-baselined that no handover table named

**Found during:** Task 2(c).
**Issue:** `WatchedFoldersSection.test.tsx` (pinned 27, actual 49) and `PhaseTimeline.test.tsx`
(pinned 35, actual 38) carried **25 combined units of slack**. `PhaseTimeline` was flagged in the
orchestrator brief; `WatchedFoldersSection` was named by **neither** 252-03's nor 252-04's handover
table and was found only by reading the gate's whole `actual` column.
**Fix:** both re-pinned to the measured `actual`, each with an attribution stating explicitly that
**none of the delta is this phase's**.
**Why this is Rule 2, not scope creep:** a pin below the real case count is functionally identical
to W-7's slack — the exact defect this plan exists to close, one file over. Leaving a measured
22-unit hole open while closing a 1-unit one would have been closing the smaller of two known bugs.
**Files modified:** `scripts/vitest-count-gate.cjs`. **Commit:** `97174227b`.

### `[Rule 2 - Correctness]` The sibling find was recorded in the gate, not only in this SUMMARY

**Found during:** Task 2(b). `bug260912AppCredentials.test.ts` is in neither knob.
**Fix:** ⛔ **Not adopted** (out of the plan's one-adoption authorisation), but **named in the gate's
own TARGETS comment** and added to SEED-280.
**Why:** *a fact in a register nobody re-reads is the same as no fact*. The gate file is the register
read when this question is next asked; a SUMMARY is not.

### Not a deviation — the base reading disagreed with D-44a

The plan was briefed on a red base and measured a green one. ⛔ **No plan text was changed and no
criterion was relaxed**: the plan's actual criterion is *"the failing SET is identical to Task 1's"*,
which holds (∅ = ∅). Full treatment above.

**Everything else executed exactly as written.**

---

## Authentication gates

None.

## Known Stubs

None. This plan wrote no product code.

## Threat Flags

None. The plan's own register (TM-252-21/22/23) is discharged:

| ID | Threat | Discharged by |
|---|---|---|
| TM-252-21 | a suite adopted into one knob only guards nothing | `grep -c "WatchRowCard.test.tsx"` → **2** |
| TM-252-22 | a pin raised to absorb a genuine regression hides it | every pin set to the gate's measured `actual`; both totals reconcile with **residual 0**; failing set ∅ before and after |
| TM-252-23 | vacuous slack lets a deleted test keep the gate green | RED-driven: `8 8 0`, no `[count-decrease]`, restored md5-identical |

---

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `scripts/vitest-count-gate.cjs` modified | FOUND — 75 insertions / 6 deletions in `97174227b` |
| `CLAUDE.md` row updated | FOUND — line 703 reads `222 / 49 / 5787` |
| `docs/HOT-FILE-LEDGER.md` row + section updated in the SAME commit | FOUND — line 10424 and §`Phase 252 Plan 05`, both in `86bb1f9c1` |
| `SEED-280` routing written back | FOUND — `status_note` carries the 2026-09-16 entry |
| commit `97174227b` | FOUND |
| commit `86bb1f9c1` | FOUND |
| `grep -c "WatchRowCard.test.tsx"` == 2 | FOUND — **2** |
| `ConnectionGrantsList.test.tsx` pinned at 9 | FOUND — line 2917 |
