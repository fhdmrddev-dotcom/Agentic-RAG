---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 19
subsystem: planning/validation-record
tags: [vocab-01, vocab-02, vocab-03, g-4, gap-closure, validation, gates, m3-unblock, docs-only]
requires:
  - "187-VERIFICATION.md — the gaps_found record whose BLOCKER held M3, and whose human_verification block carries M3's blocking reason verbatim"
  - "187-16 / 187-17 / 187-18 SUMMARYs — each plan's recorded RED signature and measured counts, cross-checked here rather than transcribed"
  - "187-VALIDATION.md §Phase gates — measured (the 187-15 record) — the 980 / 443 / 33 before-values"
provides:
  - "six per-task verification rows for the closure round, each with the command from its own <verify> block"
  - "M3 UNBLOCKED — blocking reason preserved, closing plan named, row left unperformed"
  - "M9-M12 — the closure round's four lived-experience rows, authored in VALIDATION.md per G-4"
  - "§Phase gates — gap-closure round (h)-(o): every closure gate measured with raw output at the closure commit"
affects:
  - "/gsd:verify-work 187 re-verification — the manual board is now twelve rows, all unperformed"
tech-stack:
  added: []
  patterns:
    - "a base-identity proof (git diff --name-only over the two bases showing ZERO source files) that turns a prior record's numbers into this round's derived before-values, instead of re-running a checkout on a shared tree"
    - "declared-test-literal counting over git show blobs as a real instrument for a before/after DELTA when the before state cannot be run"
    - "proving 'no shipped file's count dropped' structurally — byte-identity of the untouched files — rather than inferring it from a rising total"
key-files:
  created:
    - ".planning/phases/187-business-vocabulary-ai-seeded-canvas/187-19-SUMMARY.md"
  modified:
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VALIDATION.md
decisions:
  - "M3's blocking reason is quoted from 187-VERIFICATION.md's FRONTMATTER phrasing ('fix the CR-01 gap before running this, or the operator will be confirming a receipt that lies'), not from the report body's 'recommend deferring this row until CR-01 is fixed'. The plan asked both that the history be preserved AND that the row no longer contain the words recommending deferral — the frontmatter phrasing carries the full reason without carrying the recommendation, so both hold with nothing softened."
  - "The 'before' figures are DERIVED from a measurement, not transcribed. The closure base ee5fff3b was proved source-identical to the phase-close commit 9602bd13 (git diff --name-only lists 8 files, ALL under .planning/), which carries the shipped 980 / 443 / 33 records forward by identity. Re-running the pre-fix state would have required checking out the base on the shared working tree; a worktree is not viable here (node_modules is gitignored)."
  - "Per-file before-counts for the five closure suites are derived as (measured after − measured delta), where the delta is measured NOW by counting declared test literals in the base blob and the HEAD blob via `git show`. Every one of the five deltas matched the corresponding SUMMARY's run-count delta exactly, so zero disagreements had to be recorded on both sides."
  - "'No shipped file's count may drop' is proved STRUCTURALLY: 10 of the 13 files across both named sets are byte-identical to the base, so their counts cannot have moved, and the two set deltas are exactly the two touched files' own growth. A rising total alone would not have excluded a compensating drop."
  - "The orchestrator's own STATE.md / ROADMAP.md commit (ce68aacd) is NAMED in gate (o) rather than left for a reader to trip over — `git status --porcelain` is empty, but `git diff --name-only ee5fff3b HEAD` does list both files, and an unexplained hit on a no-false-completion-record gate is exactly the kind of thing that gets re-inherited as a defect."
  - "The closure sign-off was ADDED beneath the shipped one, which is kept verbatim including its now-stale 'eight Manual-Only G-4 rows' wording, dated and marked as recorded at the close of the phase. Rewriting it would have erased the record of what was true then."
metrics:
  duration: ~40 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 19: The closure round gets its rows, its unblock and its measured gates — Summary

The phase's own verification held **M3** with *"fix the CR-01 gap before running this, or the
operator will be confirming a receipt that lies."* CR-01 is closed, so M3 is unblocked — and the
three fixes each changed something a person sees, which under **G-4** means four new rows a person
must look at. They are authored in `187-VALIDATION.md`, never inside a PLAN task, and every gate for
the round is measured rather than asserted.

## What Was Built

**Task 1 — the board (commit `8b1435ea`)**

- A dated **§"The gap-closure round"** section above the per-task map, naming which plan closes which
  finding, the base commit (`ee5fff3b`), and the scope boundary: WR-01, WR-04, WR-05, WR-06, WR-07
  and IN-01…IN-05 are **unchanged and still open**, absorbed by nothing.
- It also records the **two forks the round resolved against the reviewer's own suggested minimum**,
  because both change what a reader should expect the code to do: CR-01 kept all three causes and
  split the *lead* (filtering the list would have left the typical draft's deliverable wearing an
  unexplained ⛨ seal — the exact SC#3 hole the receipt exists to close), and WR-02 **excluded**
  `llm_emit` against its own field docblock, answering the reviewer's parenthetical *"only if the
  emit executor really does bound-scope retrieval"* with a measured **no**.
- **Six per-task rows** — `187-16-T1/T2`, `187-17-T1/T2`, `187-18-T1/T2` — in the shipped ten-column
  format, each with the automated command taken from that task's own `<verify>` block and each
  threat ref from its `<threat_model>`.
- **M3 unblocked**, its blocking reason quoted, `187-16` named as the plan that closed CR-01, and the
  row left **UNPERFORMED and UNTICKED** — with *"unblocking a row is not performing it"* stated on
  the row itself.
- **M9–M12**: the receipt's new honesty on a real `llm_agent → llm_emit` draft; the zero-detected
  arrival (D-187-10); the non-retrieval node face with its **positive** half (WR-02); the picker→card
  agreement (WR-03). Each carries a "Why Manual" that is a *reason* — a judgement no render test can
  make — not a restatement of the behaviour.
- **M1–M8 untouched.** M5 (VOCAB-03 template copy) and M8 (D-181-01 flag-OFF screen) survive
  unticked and un-re-scoped, and are called out by name as still owed.

**Task 2 — the gates (commit `89357612`)**

A new **§"Phase gates — gap-closure round"** with sub-gates (h)–(o), every figure accompanied by the
command that produced it.

## Measurements

All run at the closure commit, against base `ee5fff3b`.

| Gate | Command | Result |
|---|---|---|
| zero migrations | `git diff --stat ee5fff3b HEAD -- supabase/migrations` + `git status --porcelain supabase/migrations` | **both empty** |
| **D-187-14 mount cap** | `git diff --numstat ee5fff3b HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` | **empty — 0 ins / 0 del, unmoved** |
| 8-file vocabulary/canvas set, isolated | `npx vitest run …×8` | **998 passed, 0 failed** (base 980, **+18**) |
| 5-file consumer set, isolated | `npx vitest run …×5` | **447 passed, 0 failed** (base 443, **+4**) |
| the five closure suites | the plan's own `<verify>` command | **452 passed, 0 failed** |
| `npx tsc -b` | total `error TS` · in `components/workflows/` · in `pages/WorkflowBuilderPage*` | **33 · 0 · 0** (base 33 · 0 · 0 — zero delta) |
| `npx vite build` | exit code | **0** |
| no false completion record | `git status --porcelain` over `REQUIREMENTS.md` / `STATE.md` / `ROADMAP.md` | **empty** |

Per-file, each suite run **individually** so the number is a measurement and not a share of a total:

| Suite | Before (derived) | **After (measured)** | Δ (measured) | SUMMARY agrees? |
|---|---|---|---|---|
| `SeedReceipt.test.tsx` | 33 | **47** | +14 | ✅ |
| `definitionOps.test.ts` | 223 | **227** | +4 | ✅ |
| `phaseVocabulary.test.ts` | 72 | **90** | +18 | ✅ (as a pair) |
| `phaseVocabulary.corpus.test.ts` | 42 | **45** | +3 | ✅ (as a pair) |
| `StepTypePicker.test.tsx` | 36 | **43** | +7 | ✅ |
| **all five** | 410 | **452, 0 failed** | +42 | — |

**Disagreements with the three SUMMARYs: none.** Every figure was reproduced independently.

### How "before" is a measurement rather than a transcription

The pre-fix state cannot be re-run without checking out the base on this shared working tree. It did
not need to be, and the substitute is a measurement rather than an assumption:

```
$ git diff --name-only 9602bd13 ee5fff3b
.planning/ROADMAP.md · .planning/STATE.md · four 187-1x-PLAN.md · 187-REVIEW.md · 187-VERIFICATION.md
```

**Zero source files** — the closure base is source-identical to the phase-close commit, so §(c)/§(e)'s
shipped `980` / `443` / `33` are this round's before-values by identity. Per-file deltas were then
measured now, over the real base content:

```
$ git show ee5fff3b:<path> | grep -cE '^[[:space:]]*(it|test)(\.each\(|\.skip)?\('
$ git show HEAD:<path>     | grep -cE '…'
SeedReceipt 33→47 (+14) · definitionOps 113→117 (+4) · phaseVocabulary 60→78 (+18)
corpus 14→17 (+3) · StepTypePicker 29→36 (+7)
```

⚠ Recorded as a limit rather than glossed: absolute literal counts are **not** run counts (`it.each`
expands), so only the **deltas** are used as the instrument and the absolute before-values are
derived from the measured after-values. Every delta matched its SUMMARY's run-count delta exactly.

### "No shipped file's count dropped" — proved, not inferred

A rising total does not exclude a compensating drop. Of the 13 files across both named sets, only
three appear in `git diff --name-only ee5fff3b HEAD`; the other **ten are byte-identical to the
base**, so their counts cannot have moved. The two set deltas are exactly the two touched files' own
growth. The third, `WorkflowBuilderPage.canvas.test.tsx`, was modified but declares **110 literals at
both revisions** — confirming 187-17's claim that no other row of that suite moved.

### `tsc -b`, stated more strongly than the criterion asks

33 errors across **19 files** (`useMessages.test.ts` 5, `ChatAreaMode.test.tsx` 4, `FilePreview` 3,
`FilesSection` 3, `OrgProvider` 2, `SettingsPage.tsx` 2, `SkillFormDialog.tsx` 2, 12 singles) — and
**not one is among the four source files this round modified**. ⚠ `tsc -b` has never exited 0 here
(`D-ITEM-01`); the criterion is *no NEW error, none in the touched files*, not a clean exit. ⚠
`tsc -b` ≠ `--noEmit` (the v3.3 lesson).

## Deviations from Plan

**1. [Rule 3 — the plan's two M3 instructions are in tension; resolved without softening either]**

- **Found during:** Task 1.
- **Issue:** The `<action>` says to keep *"the original blocking reason quoted so the history is not
  erased."* The acceptance criterion says *"the M3 row no longer contains the words recommending
  deferral."* `187-VERIFICATION.md` states the hold twice — the report body recommends deferral, the
  frontmatter does not.
- **Fix:** quote the **frontmatter** phrasing (*"fix the CR-01 gap before running this, or the
  operator will be confirming a receipt that lies"*), which carries the full blocking reason without
  carrying the recommendation. Both instructions hold, nothing was softened, and the history is
  intact. Verified: `grep "^| M3 " … | grep -ci "recommend deferring…"` → **0**.
- **Files modified:** `187-VALIDATION.md` · **Commit:** `8b1435ea`

**2. [Rule 3 — the before-state could not be run; measured a different way rather than transcribed]**

- **Found during:** Task 2.
- **Issue:** The action demands every number come from *"a command run now … not transcribed from a
  plan's own SUMMARY"*, and also demands **before** counts for five suites. The before state is a
  different commit; re-running it means a checkout of the shared tree, and a worktree is not viable
  in this project (`node_modules` is gitignored, per the standing note).
- **Fix:** two commands run now that produce the before-values as derivations — the base-identity
  proof (§h) and the declared-literal delta over `git show` blobs (§l) — with the `it.each` caveat
  stated in-file so the instrument is not over-read. No number is transcribed; the SUMMARY figures
  appear only in an "agree?" column as a second, independent measurement.
- **Files modified:** `187-VALIDATION.md` · **Commit:** `89357612`

**3. [Honesty note, not a deviation] gate (o) has a hit that needed naming**

`git status --porcelain` over the three planning files is empty, but `git diff --name-only ee5fff3b
HEAD` **does** list `STATE.md` and `ROADMAP.md`. That is the orchestrator's own tracking commit
`ce68aacd`, which is whose job it is. It is named in gate (o) rather than left for the next reader to
find and mis-read as a false completion record. `REQUIREMENTS.md` was not touched at all — its
VOCAB-01/02/03 rows still read Pending, correct until re-verification says otherwise.

**4. [Scope boundary — logged, not fixed] the wider-glob axe flake**

`PublishGauntlet.test.tsx` / `WorkflowCanvas.test.tsx` axe cases still fail non-deterministically
under whole-glob parallel load and pass in isolation (`D-ITEM-02`, `deferred-items.md`). Both files
are inside the named sets measured above and are **green** there. Not this round's, not chased, not
used as a gate — §(c)'s rule that the two isolated named sets are the gate is unchanged.

No architectural change was needed; no Rule 4 checkpoint was reached. **This plan modified exactly
one file and touched no source, no migration and no backend.**

## What this round did NOT prove — stated in-file, repeated here

- **Nothing on the manual board.** All **twelve** rows (M1–M12) remain **UNPERFORMED**; they are the
  operator's. M3 is *unblocked*, which is not *done*.
- **The three ❌ SC#10 rows are untouched** — OpenRouter's non-deterministic name drop, OpenAI's
  `gpt-5.6-sol` endpoint refusal, MiniMax's non-emission. All provider-side; no frontend fix could
  move them and none tried.
- **Seven review findings remain open** (WR-01, WR-04, WR-05, WR-06, WR-07, IN-01…IN-05), out of
  scope by the operator's own routing.
- **The backend was not re-run and did not need to be** — the round committed zero backend files, so
  §(d)'s pre-existing-rot record stands unchanged.

## Threat Model Coverage

| Threat ID | Disposition | How it was discharged |
|---|---|---|
| T-187-19-01 | mitigate | Every figure in §(h)–(o) is pasted with the command that produced it, run at the closure commit. The before-values are derived from two commands run now (base identity + literal deltas), never transcribed; the three SUMMARYs appear only as an independent second measurement in an "agree?" column. Zero disagreements arose, so no both-sides record was needed. |
| T-187-19-02 | mitigate | `grep -c "^\| M5 \|^\| M8 "` returns **2** after the edit — both rows survive. M1–M8 are unchanged, the four new rows are additive, and the roster rule (recorded, never omitted) is applied to the manual board and restated for it. |
| T-187-19-03 | mitigate | None of `requirements.mark-complete`, `state.advance-plan`, `roadmap.update-plan-progress` was called. `git status --porcelain` over the three planning files is **empty**, and the one `STATE`/`ROADMAP` commit in the range is named as the orchestrator's. |
| T-187-19-04 | mitigate | The zero-migration gate re-measured against `ee5fff3b` with raw output — `git diff --stat` and `git status --porcelain` over `supabase/migrations` both empty. Truth #11 survives the round. |

## Known Stubs

None. Documentation-only: no placeholder value, empty-data path or unwired component exists to
introduce. Every new manual row carries full instructions and a stated reason.

## Threat Flags

None. No source file, network endpoint, auth path, file-access pattern or schema shape was added or
moved — `git status --porcelain frontend/src backend/app supabase/migrations` is empty.

## Self-Check: PASSED

- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VALIDATION.md` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-19-SUMMARY.md` — FOUND
- commit `8b1435ea` — FOUND
- commit `89357612` — FOUND
- `grep -c "187-16-T1\|187-17-T1\|187-18-T1" …/187-VALIDATION.md` → **4** (plan requires ≥ 3)
- `git status --porcelain frontend/src backend/app supabase/migrations` → **empty**
- `git status --porcelain .planning/REQUIREMENTS.md .planning/STATE.md .planning/ROADMAP.md` → **empty**
