---
phase: 186-concurrency-autosave
plan: 20
subsystem: phase-bookkeeping
tags: [gap-closure, deferrals, re-open-triggers, measured-gate, wr-14, wr-15, wr-16, wr-17, wr-18]
gap_closure: true
closes: [WR-14, WR-15, WR-16, WR-17, WR-18]
requires:
  - "186-18 (CR-03 closed — its reorder is what widens WR-14, so the entry had to be written after it)"
  - "186-19 (WR-12/WR-13 closed — its edits move the line numbers WR-15..WR-18 cite)"
provides:
  - "five deferrals with concrete re-open triggers — nothing from the verification's anti-pattern table is dropped"
  - "the round's measured gate, pasted rather than asserted, in the phase's own validation file"
  - "a `wave_0_complete` flag that agrees with the filesystem"
affects:
  - .planning/phases/186-concurrency-autosave/deferred-items.md
  - .planning/phases/186-concurrency-autosave/186-VALIDATION.md
tech-stack:
  added: []
  patterns:
    - "a deferral is a scheduled decision: what / why / the observable event that re-opens it"
    - "a fix that closes a blocker may widen a warning — record the trade in the same round, do not leave it to be discovered"
    - "measure the delta PER FILE, never as one whole-suite number (the Phase 177 lesson)"
key-files:
  created:
    - .planning/phases/186-concurrency-autosave/186-20-SUMMARY.md
  modified:
    - .planning/phases/186-concurrency-autosave/deferred-items.md
    - .planning/phases/186-concurrency-autosave/186-VALIDATION.md
    - .planning/STATE.md
decisions:
  - "D-186-20-A — WR-16 and WR-17 are recorded as ONE deferral with one shared trigger, not two independent ones: they are the same edit to the same function, and splitting them across rounds would touch the CR-02 repair (this phase's most recently closed blocker) twice."
  - "D-186-20-B — the frontend delta is proven PER FILE against the pre-round tree (`b417584d`) rather than by re-running the suite at that commit: a per-file `it(`/`test(` count across all 11 files shows +1 / +2 / nine unchanged, which rules out a silent replacement more directly than one aggregate number would."
  - "D-186-20-C — the plan's `tsc` acceptance criterion (zero errors) is an inherited claim and is not achievable on this project; recorded as 33 pre-existing across 19 files, 0 in any phase-186 file — the same correction 186-19 made."
  - "D-186-20-D — the gate prose was reworded to avoid the literal tokens `to run` and `⛔` so the plan's own `grep -c` invariants hold; describing a status must not perturb the count of that status."
metrics:
  tasks: 2
  commits: 2
  duration: ~40 min
  completed: 2026-08-01
  migrations: 0
  package_changes: 0
  source_files_changed: 0
---

# Phase 186 Plan 20: Round Closure — Five Deferrals and a Measured Gate Summary

The eight anti-patterns the 2026-08-01 re-verification listed are now fully accounted for: three
were closed in code by 186-18 and 186-19, and the other five are recorded as deferrals with
observable re-open triggers — including the one this round made measurably worse — while the
round's green claims are backed by four commands whose output is pasted rather than described.

## What Was Written

### Task 1 — `deferred-items.md` gained WR-14 through WR-18 (`5a1cc5c8`)

Five `##` entries appended in the file's established shape (what is deferred / why / re-open
trigger), followed by a closing note that names CR-03, WR-12 and WR-13 as **closed** by plans
186-18 and 186-19 — so a reader of this file alone can separate the five carried from the three
fixed. **No existing entry was edited.**

| Measurement | Before | After |
|---|---|---|
| `grep -c "Re-open trigger"` | **6** | **11** (+5, exactly as required) |
| `git diff --numstat` | — | **175 insertions, 0 deletions** |
| `grep -o "WR-1[4-8]" \| sort -u` | — | `WR-14 WR-15 WR-16 WR-17 WR-18` (all five) |
| `grep -n "flag-off"` inside the WR-14 entry | — | line **221**, inside WR-14 (heading `191`, next heading `235`) ✅ |
| `grep -niE '"v1"\|simplified\|placeholder\|for now\|basic version'` | — | **no matches** — every entry is a full deferral, never a scope reduction |

The WR-14 entry states the widening explicitly: 186-18's CR-03 reorder lifted the `saving` branch
**above** the flag gate, so `SAVING_PUBLISH_WAIT` now outranks the verdict branches — and disables
the outer trigger, which spends nothing — on the **flag-off** Builder too. That was the correct
fix and it is also a cost, paid deliberately and now on the record.

The WR-18 entry states its residual exposure so nobody has to re-derive its size: a null
`detail.token` costs the **optimistic** concurrency guard inside one owner's own drafts, **not** an
authorisation — the server's owner scope and published-row guard are untouched.

### Task 2 — the measured gate in `186-VALIDATION.md` (`a72b1fd7`)

A dated `## Post-gap-closure gate (2026-08-01 · plans 186-18 / 186-19 / 186-20)` subsection beneath
the sign-off block, carrying all four commands with their numbers; five sign-off checkboxes ticked
(only the provable ones); `wave_0_complete` flipped to `true` against `ls` evidence.

## Every claim re-derived, with the symbol it was read from

Four of four executors in this phase found an inherited claim false, so nothing below was taken
from `186-VERIFICATION.md` — each was read at `HEAD` (`be7303ca` at read time). **The verification
report predates 186-18 and 186-19, and five of its line references have moved.**

| Claim written into the file | Read from | Agrees with the verification report? |
|---|---|---|
| `saving` is `blockedReason`'s **first** statement, above the flag gate, above all four verdict branches | `WorkflowBuilderPage.tsx:1093-1102` — `:1094` saving, `:1095` gate, `:1096` empty-draft, `:1097` degraded, `:1098-1101` verdicts | ⚠️ **line moved** — report cites `:1077`; 186-18's reorder made it `:1094` |
| `blocked` is derived from the string and feeds both gates | `PublishGauntlet.tsx:846` (`blocked`), `:592` (`canPublish`), `:921` (`disabled={blocked}`) | ✅ matches |
| the outer trigger spends nothing — its whole handler opens the modal | `PublishGauntlet.tsx:920` — `onClick={() => setOpen(true)}` | ✅ matches (report asserted it; now measured) |
| the rank is a **shipped, tested** decision | `WorkflowBuilderPage.canvas.test.tsx:1864` — *"the saving reason OUTRANKS the empty-draft invitation"* | ✅ matches |
| `{kind:"saving"}` is set synchronously before the request leaves | `useDraftPersistence.ts:633` | ⚠️ **report imprecise** — cites `:605-610`, which today is the single-flight guard (`:603-608`), not the saving site |
| one terminal branch leaves the reading at `saving` (prior IN-01) | `useDraftPersistence.ts:638` — `if (creatingRef.current) break`, below the `saving` assignment, with no further `setState` | ⚠️ **line differs** — same finding, different site than the report's range |
| `performWrite`'s `finally` clears **only** `inFlightRef`, never the reading | `useDraftPersistence.ts:738-740` | ⚠️ **report's framing corrected** — the plan called the `finally` part of the bound; it is not, the bound rests entirely on the terminal branches |
| there is **no** client timeout/abort on the draft PATCH | `api.ts:3430-3449` — `signal?: AbortSignal` is optional and the hook's only call site (`useDraftPersistence.ts:650-654`) passes three arguments, no signal | ✅ matches |
| the absence of an abort belt is pinned as a CHOICE | `useDraftPersistence.test.tsx:712` — *"cancels no write — the abort belt `useLiveValidation` uses is deliberately absent"* | ✅ matches |
| `reload()`'s catch spans more than the request | `useDraftPersistence.ts:988-1032`; try opens `:993`, `rows.find` `:995`, `setDrafted` `:1008`, catch `:1015-1027`, `RELOAD_FAILED_NOTE` declared `:289` | ⚠️ **line moved** — report cites `:915-949` |
| a second Reload keeps the first failure's note | `useDraftPersistence.ts:988-993` — the entry takes the guard and sets `resolving`, and never touches `setState` | ⚠️ **line moved** — report cites `:910-914` |
| `overwrite()` adopts a possibly-`null` token unconditionally | `useDraftPersistence.ts:1058` (`tokenRef.current = conflictTokenRef.current`), above `await performWrite()` at `:1073` | ⚠️ **line moved** — report cites `:980`, which today is docblock prose inside `reload()` |
| the `null` originates in the transport and survives to the wire | `api.ts:3460` — `new WorkflowStaleTokenError(body.detail?.token ?? null)`; `refusalOf` (`useDraftPersistence.ts:403-412`) carries `carried ?? null`; stored at `:661`; `api.ts:3440-3443` adds `If-Match` **only** for a non-empty string | ✅ matches, and now traced end to end rather than asserted |

**One more inherited claim, from the plan itself, measured false:** the plan states *"five entries
already exist"* in `deferred-items.md`. There were **six** (`grep -c "Re-open trigger"` = 6; six
`##` headings). The acceptance criterion is written as a delta (+5), so it still holds — but the
absolute would have been wrong.

## The gate — four commands, raw output

### Command 1 — the phase-186 frontend consumer set

```
$ cd frontend && npx vitest run --fileParallelism=false \
    src/pages/WorkflowBuilderPage.test.tsx src/pages/WorkflowBuilderPage.session.test.tsx \
    src/pages/WorkflowBuilderPage.header.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx \
    src/hooks/useDraftPersistence.test.tsx src/lib/api.workflows.test.ts \
    src/components/workflows/PublishGauntlet.test.tsx src/components/workflows/builderStore.test.ts \
    src/components/workflows/BuilderSaveRegion.test.tsx \
    src/components/workflows/WorkflowCanvas.editing.test.tsx \
    src/components/workflows/canvasNudge.test.ts

 RUN  v4.1.0 C:/Vibe Apps/Agentic RAG/frontend

 Test Files  11 passed (11)
      Tests  429 passed (429)
   Duration  151.47s
```

**The delta, measured per file** (`b417584d` — the commit immediately before 186-18's first commit
`64042c12` — versus `HEAD`):

```
$ for f in <the 11 files>; do git show $BASE:$f | grep -cE '^\s*(it|test)(\.[a-z]+)?\('; ... done
  CHANGED frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx: 87 -> 88
  CHANGED frontend/src/hooks/useDraftPersistence.test.tsx: 50 -> 52
TOTAL it/test declarations: base=412 head=415 delta=3

$ git diff --stat b417584d..HEAD -- frontend backend supabase
 frontend/src/hooks/useDraftPersistence.test.tsx    | 156 ++++++++++++++++++++-
 frontend/src/hooks/useDraftPersistence.ts          |  93 +++++++++++-
 .../src/pages/WorkflowBuilderPage.canvas.test.tsx  |  37 +++++
 frontend/src/pages/WorkflowBuilderPage.tsx         |  40 ++++--
 4 files changed, 313 insertions(+), 13 deletions(-)
```

So the pre-round runner total for this set was **426**, and **429 − 426 = +3** — exactly 186-18's
one canvas row and 186-19's F20i and F23, with **nine of the eleven files unchanged**. The
increase is fully attributed and no file lost a row. (The static count 415 < the runner's 429
because some rows are generated in loops; the *delta* is identical either way, and the delta is
what the guard measures.)

`--fileParallelism=false` is a carried deviation — see Deviations below.

### Command 2 — the phase-186 backend files

```
$ cd backend && ./venv/Scripts/python.exe -m pytest \
    tests/unit/test_186_concurrent_patch.py tests/unit/test_186_publish_race.py \
    tests/unit/test_103_published_409.py -q

.....................                                                    [100%]
============================== warnings summary ===============================
venv\Lib\site-packages\requests\__init__.py:113
  RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.4.3)/charset_normalizer (3.4.6) doesn't match a supported version!
21 passed, 1 warning in 1.69s
```

**21 passed, 0 skipped.** The skip count is the interesting number and it is **zero**: the per-test
`skipif` guards shipped by WR-06 / 186-11 did **not** fire, which means the local Postgres at
`:54322` was **present** and the live-DB guards (F1/F2/F3/F13/F5/F6) genuinely executed rather than
being silently waived. The single warning is the pre-existing `requests`/`urllib3` version notice.

```
$ ./venv/Scripts/python.exe -m pytest --collect-only -q
3474 tests collected in 6.84s
```

Non-decreasing against both recorded baselines (3457 original, 3465 after 186-11). This round added
zero backend tests, so the +9 predates it.

### Command 3 — typecheck

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json
=== total error lines: 33 ===
=== phase-186 files ===
(none)
```

Per-file breakdown (19 files): `useMessages.test.ts` 5 · `ChatAreaMode.test.tsx` 4 ·
`FilePreview.test.tsx` 3 · `FilesSection.test.tsx` 3 · `OrgProvider.test.tsx` 2 ·
`SettingsPage.tsx` 2 · `SkillFormDialog.tsx` 2 · then one each in `streamsStore.ts`,
`StreamsProvider.tsx`, `SettingsPage.test.tsx`, `api.test.ts`, `MemorySection.tsx`,
`NavPanel.test.tsx`, `ChatLayoutLaunch.test.tsx`, `MessageSkeleton.tsx`,
`streamsProvider_state01b_403.test.tsx`, `useFolders.test.ts`, `useDocuments.test.ts`,
`IngestionPage.test.tsx`.

Filtered on `WorkflowBuilderPage`, `useDraftPersistence`, `PublishGauntlet`, `BuilderSaveRegion`,
`builderStore`, `api.workflows`, `WorkflowCanvas`, `canvasNudge`: **no match**. The round touched
four files and none appears in the error list, so all 33 are pre-existing **by construction**. The
count is identical to the 33 plan 186-19 measured — though 186-19's *file attribution* ("in
`OrgProvider.test.tsx`, `StreamsProvider.tsx` and `streamsStore.ts`") accounts for only 4 of the
33 and is corrected here.

### Command 4 — no migrations, no packages

```
$ git status --porcelain supabase/migrations
(empty)
$ git diff --stat frontend/package.json
(empty)
$ git diff --stat b417584d..HEAD -- frontend/package.json frontend/package-lock.json \
                                    backend/requirements.txt supabase/migrations
(empty)
```

Empty in the working tree **and** across the whole gap-closure round.

### Task 2's `<automated>` verify

```
$ npx vitest run --fileParallelism=false WorkflowBuilderPage.canvas WorkflowBuilderPage.header \
    useDraftPersistence PublishGauntlet BuilderSaveRegion

 Test Files  5 passed (5)
      Tests  227 passed (227)
   Duration  97.91s
```

## `wave_0_complete` — the `ls` evidence

```
$ ls -1 backend/tests/unit/test_186_concurrent_patch.py backend/tests/unit/test_186_publish_race.py \
        frontend/src/hooks/useDraftPersistence.test.tsx \
        frontend/src/components/workflows/PublishGauntlet.test.tsx \
        backend/tests/unit/test_103_published_409.py \
        frontend/src/components/workflows/builderStore.test.ts

backend/tests/unit/test_103_published_409.py
backend/tests/unit/test_186_concurrent_patch.py
backend/tests/unit/test_186_publish_race.py
frontend/src/components/workflows/builderStore.test.ts
frontend/src/components/workflows/PublishGauntlet.test.tsx
frontend/src/hooks/useDraftPersistence.test.tsx
```

All six present → the flag was flipped `false` → `true`. It was a **stale record, not a missing
artifact**: the files were created inside the 186-01 / 186-02 / 186-06 Task 1s and nobody flipped
the flag afterwards.

## What stayed open, deliberately

| Invariant | Before | After |
|---|---|---|
| `grep -c "to run"` in `186-VALIDATION.md` | 8 | **8** ✅ unchanged |
| `grep -c "⛔"` | 1 | **1** ✅ unchanged (row 4 still blocked-not-reachable) |
| `grep -n "^\*\*Approval:\*\* pending"` | matches | **still matches** (line 190) |
| `git status --porcelain .planning/REQUIREMENTS.md` | empty | **empty** — this plan wrote no requirement status |
| Manual-Only table rows | 9 data rows | **unedited** — the diff's only deletions are the frontmatter flag and 5 sign-off checkbox lines |

Sign-off checkboxes ticked: **automated-verify coverage**, **sampling continuity**, **Wave-0
coverage**, **test COUNT recorded / no decrease**, **no watch-mode flags** — each with its number
written beside it. Left unticked: **every F-guard RED-before-GREEN** (needs per-plan evidence
across 17 plans, not this round's to prove), **feedback latency < 30 s** (the aggregate gate took
151 s — ticking it would be a false record), and **`nyquist_compliant`** (a nyquist-auditor call).

## Deviations from Plan

**1. [Rule 3 — Blocking] Command 1 was run with `--fileParallelism=false`.**
- **Found during:** Task 2, before the first measurement.
- **Issue:** The plan's Command 1 omits the flag. Under vitest's default parallel workers
  `PublishGauntlet.test.tsx` flakes on `user-event` timeouts — measured and documented by 186-18 as
  **D-186-18-D** (46/46 green alone, 2-5 spurious failures in aggregate across three consecutive
  runs). A flaky aggregate cannot serve as a gate.
- **Fix:** Carried D-186-18-D forward. Serial execution, 11/11 files green, 429/429 tests. The flag
  is recorded in the pasted command in `186-VALIDATION.md` so the number is reproducible.
- **Files modified:** none (a command-line change).

**2. [Rule 1 — false inherited claim] The plan's `tsc` criterion ("zero errors") is not achievable.**
- **Measured:** 33 errors across 19 files, **0** in any phase-186 file, identical to what 186-19
  measured. Recorded as *"0 in the phase's files, 33 pre-existing elsewhere"*. Nothing was fixed —
  out of scope, and none of the 33 is in a file this round touched.

**3. [Rule 1 — false inherited claim] "five entries already exist" in `deferred-items.md`.**
- **Measured:** six. The +5 delta criterion is unaffected; recorded so the next reader does not
  inherit the absolute.

**4. [Rule 3 — self-inflicted, caught by the plan's own invariant] The gate prose initially broke
the `to run` and `⛔` counts it was required to leave unchanged.**
- **Issue:** The "what this gate does NOT close" paragraph used the literal tokens `to run` and
  `⛔` to *describe* the untouched rows, pushing `grep -c "to run"` from 8 to 9 and `⛔` from 1 to 2
  — a status count perturbed by prose about that status.
- **Fix:** Reworded to "all still unrun" / "correctly recorded as BLOCKED-not-reachable" before
  committing. Both counts verified back at 8 and 1. Recorded as **D-186-20-D**.

**5. [Deviation from the plan's method, not its intent] The pre-round frontend total was derived
per file rather than by re-running the suite at `b417584d`.**
- **Why:** `node_modules` is gitignored, so a throwaway worktree at the base commit cannot run
  vitest (the recorded worktree-incompatibility constraint), and checking out the base on the live
  tree to re-run a 151 s suite would disturb the working tree mid-round. A per-file `it(`/`test(`
  count across **all eleven** files proves the stronger property — no file lost a row — which is
  what the Phase 177 lesson actually guards against. Recorded as **D-186-20-B**.

No Rule 2 or Rule 4 conditions arose. No auth gates. No checkpoints. No package-manager install.

## Threat Model Disposition

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-186-20-01 | mitigate | **Met.** All five entries carry an observable re-open trigger (count 6 → 11), so "we knew and chose" is distinguishable from "we forgot". WR-18's entry states its residual exposure explicitly (a lost optimistic guard, not a lost authorisation) so its size need not be re-derived. WR-16/WR-17 share one trigger by design (D-186-20-A). |
| T-186-20-02 | mitigate | **Met and verified.** Only provable checkboxes ticked; `**Approval:** pending` still matches at line 190; `to run` count 8 → 8 and `⛔` 1 → 1 after the D-186-20-D rewording; `git status --porcelain .planning/REQUIREMENTS.md` empty. None of the three banned SDK verbs (`requirements.mark-complete`, `state.advance-plan`, `roadmap.update-plan-progress`) was called. |
| T-186-20-03 | accept | **Unchanged.** WR-18's entry names no credential, no token value and no bypass technique not already visible in the source it cites, and it states the server-side containment in the same breath. |
| T-186-20-04 | mitigate | **Met.** Every number in the gate subsection has its command output pasted above. No count decreased; the one increase (+3) is attributed per file. |
| T-186-20-SC | n/a | **Met.** No install ran. `git diff --stat` for this plan covers exactly two `.planning/` markdown files; zero source files, zero migrations, zero package changes across the whole round. |

## Known Stubs

None. This plan wrote two planning documents and changed no code; no placeholder value, empty
literal or "coming soon" string was introduced.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema was added or altered.

## Commits

| Task | Type | Hash | Description |
|---|---|---|---|
| 1 | docs | `5a1cc5c8` | record WR-14..WR-18 as deferrals, each with a re-open trigger |
| 2 | docs | `a72b1fd7` | record the measured post-gap-closure gate in `186-VALIDATION.md` |

## What's Left / Follow-ups

- **The eight Manual-Only rows are still unrun, and no plan can close them.** SC#4 / D-186-13 / G-4
  make live operator observation the acceptance bar; `CONCUR-01` and `CONCUR-02` stay **Pending**
  in `.planning/REQUIREMENTS.md` until the board is driven. Rows 3b and 8 are the two most likely
  to surface WR-14's flicker in the field.
- **`186-VERIFICATION.md` is a dated artifact and its WR line references are now stale** — five of
  them are corrected in the table above. It was deliberately not rewritten; the next verification
  pass supersedes it.
- **WR-16 and WR-17 re-open together**, in one plan, with one falsification pass over the
  failed-exit (F21) family.

## Self-Check: PASSED

Both modified files and this SUMMARY exist on disk; both commits (`5a1cc5c8`, `a72b1fd7`) resolve
in `git log`; `git diff --diff-filter=D` is empty for both — nothing was deleted.

## What this executor deliberately did NOT do

Requirement status (`CONCUR-01`, `CONCUR-02`), the plan counter, and ROADMAP plan-progress are left
exactly as the orchestrator set them. The three banned SDK verbs were not called. No source file,
no migration and no package manifest was touched.
