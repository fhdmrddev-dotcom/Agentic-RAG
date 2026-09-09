---
phase: 241-recall-at-corpus-scale
plan: 03
subsystem: retrieval
tags: [settings, pgvector, hnsw, migration, g-5, seed-076, seed-171]
requires:
  - "app_settings singleton + _val fallback chain (migrations 010/011)"
  - "get_user_pg_connection's transaction (dependencies.py:159-177)"
  - "the shipped Settings -> Search -> Retrieval SectionCard"
provides:
  - "app_settings.hnsw_ef_search / .hnsw_iterative_scan (migration 176, AUTHORED not applied)"
  - "backend/app/services/retrieval_tuning.py -- the SET LOCAL helper"
  - "GET /settings serves the knobs + their bounds + the three enum members"
  - "PATCH /settings refuses out-of-range with a worded cost"
  - "two operator controls on the shipped Retrieval card"
affects:
  - "backend/app/services/retrieval_service.py (G-5 hot file -- SECOND landing, extraction STILL OWED)"
  - "scripts/vitest-count-gate.cjs (harness fix: the gate could not run at the phase base)"
tech-stack:
  added: []
  patterns:
    - "SET LOCAL inside the transaction that already reverts it (D-10)"
    - "bounds SERVED by the API, never re-typed in the form (SEED-258)"
    - "the refusal states the COST, not merely the range (SEED-258)"
    - "migration authored-but-not-applied is fail-soft by construction (migration 174)"
key-files:
  created:
    - supabase/migrations/176_app_settings_hnsw_knobs.sql
    - backend/app/services/retrieval_tuning.py
    - backend/tests/unit/test_241_hnsw_knobs.py
  modified:
    - backend/app/config.py
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/app/services/retrieval_service.py
    - backend/tests/unit/test_settings.py
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/pages/SettingsPage.test.tsx
    - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
    - frontend/src/lib/api/skills.ts
    - scripts/vitest-count-gate.cjs
    - .planning/seeds/SEED-171-workflows-library-suites-flake-independent-of-cap.md
decisions:
  - "D-09/D-12 honoured: migration 176 AUTHORED, never applied; no db push, no db reset"
  - "The count gate was BROKEN AT THE PHASE BASE by a Windows cmd command-length cap; fixed by removing the shell, NOT by trimming TARGETS"
  - "The knobs sit OUTSIDE the hybrid-search block -- they govern the vector scan, which the vector-only path also runs"
  - "The default configuration issues ZERO SQL statements: no round trips, and no silent override of a hand-tuned server"
metrics:
  tasks: 3
  commits: 5
  duration: "~2h"
  completed: 2026-09-10
---

# Phase 241 Plan 03: The HNSW Knobs as a Product Capability — Summary

`hnsw.ef_search` and `hnsw.iterative_scan` ship as operator settings on the existing Retrieval
card, applied per request with `SET LOCAL` inside the transaction that already reverts them —
and `retrieval_service.py` grew by a call while its G-5 extraction stayed owed.

## What was built

| Layer | What landed |
|---|---|
| Migration **176** | Two nullable columns on `app_settings` with named CHECK bounds. **AUTHORED, NOT APPLIED.** |
| `config.py` | `hnsw_ef_search=40`, `hnsw_iterative_scan="off"` (the `_val` env targets), plus `hnsw_max_scan_tuples=20000` / `hnsw_scan_mem_multiplier=1.0` — **hardcoded-only** per D-09. |
| `user_settings.py` | Two model fields, two `_val` calls, and the bounds constants (`HNSW_EF_SEARCH_FLOOR=10`, `_CEILING=1000`, `HNSW_ITERATIVE_SCAN_VALUES`) in the SEED-258 home. |
| `api/settings.py` | Both knobs on GET + PATCH; floor / ceiling / the three enum members **served**; a worded 400 that names the cost. |
| `retrieval_tuning.py` | **New.** One public coroutine, four private statement constants, per-knob `try`. |
| `retrieval_service.py` | A signature, a guard, a call, two argument expressions. **11 non-comment lines.** |
| `SettingsPage.tsx` | Two `FieldRow`s on the shipped Retrieval card + a plain-words label map. |

## ⛔ G-5 — the extraction on `retrieval_service.py` is STILL OWED

This is the **SECOND** milestone landing on a file whose extraction has been owed since Phase 231.
Nothing here discharges it. The sentence is written **into the file itself**, verbatim:

> ⛔ **G-5 — READ THIS BEFORE ADDING ANYTHING ELSE HERE.** This file's extraction has been
> **OWED since Phase 231** and this landing does NOT discharge it. It is the SECOND milestone
> landing, permitted because the ROADMAP forbids a *third* without proposing the extraction
> first — so a THIRD must propose that extraction before it adds behaviour. The knob LOGIC
> (validation, the `set_config` statements, the degrade-not-fail arms, the hardcoded memory
> companions) deliberately lives in `app/services/retrieval_tuning.py` precisely so this
> file's delta stays a call and its arguments. Do not move it back, and do not edit the ledger
> row to say the obligation was met: `docs/HOT-FILE-LEDGER.md` still reads
> *extraction still OWED*.

- `git diff --numstat`: **`34 / 1`** on `retrieval_service.py`.
- The ledger row is **untouched** and still reads `⚠ extraction still OWED (SEED-224)`.
- A fence caps the landing at 12 non-comment lines and was driven RED at 13.

## TDD — every gate driven RED, every plant proved removed by HASH

| # | RED (measured) | Plant | Fence that fired | GREEN |
|---|---|---|---|---|
| Task 1 | `19 failed / 0 passed` (`733a1a14a`) | `_val` literal `40 → 0` | `test_the_val_fallback_literal_is_the_same_number_config_holds` | `19 passed` |
| Task 2 | `13 failed / 20 passed` (`7fa8b6af3`) | `f"SET LOCAL hnsw.ef_search = {ef_search}"` | `test_the_module_never_builds_a_SET_statement_by_concatenation` | `33 passed` |
| Task 2 | — | knobs threaded through `_keyword_search` | 3 fences: the landing cap, the keyword fence, the wiring case | `33 passed` |
| Task 3 | — | `min={10} max={1000}` hardcoded | `⛔ the breadth input takes its min/max from the SERVED bounds` | `23 passed` |

### Restoration proved by hash, not by "re-ran green"

| File | md5 before plant | md5 after restore | Same |
|---|---|---|---|
| `backend/app/models/user_settings.py` | `654de83586963277f164fa4fc28101c2` | `654de83586963277f164fa4fc28101c2` | ✅ |
| `backend/app/services/retrieval_tuning.py` | `7678840728b893e775d45c5761d3d538` | `7678840728b893e775d45c5761d3d538` | ✅ |
| `backend/app/services/retrieval_service.py` | `81b206cf4600b17951ba20f5c1618bf4` | `81b206cf4600b17951ba20f5c1618bf4` | ✅ |
| `frontend/src/pages/SettingsPage.tsx` | `630a6277d13b2756ed755d38d27301cc` | `630a6277d13b2756ed755d38d27301cc` | ✅ |

`git diff --stat` is **empty** at plan close and `grep -c "_planted\|f\"SET"` on `retrieval_tuning.py`
returns **0** — the injection plant left no fragment, which is the exact defect its fence exists to catch.

### ⭐ The plant that revealed why the fence was needed

Planting `0` in the `_val` literal turned **one** case red and left the other **18 GREEN** — including
the fail-soft case that reads `hnsw_ef_search == 40`. That is the finding, not an inconvenience:
`_val` returns `getattr(env_settings, env_attr)` **before** it ever reaches `default`, so the literal
written into the shipped call is dead code for as long as `config.py` carries the field. A wrong
literal there would surface only on the day somebody deleted the config field. The fence reads the
shipped call's source and pins the number, which is why the plan's named plant fires at all.

## ⛔ THE COUNT GATE COULD NOT RUN AT THE PHASE BASE — and it was nothing this plan changed

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` on an **untouched frontend**:

```
The syntax of the command is incorrect.
FATAL: vitest produced no JSON report at ...json (exit 255).
       The suite could not run; this is a harness error, not a gate failure.
```

Reproduced on two consecutive runs. **Diagnosed, not guessed:** `spawnSync(..., {shell: true})`
routes through `cmd.exe /d /s /c "…"`, whose total command line is capped. `TARGETS` has grown past
150 entries and the composed line measures **8,078 characters**. A controlled probe pinned the
boundary between 8,100 (accepted) and 8,150 (refused) on this box:

```js
for (const n of [7900, 8000, 8050, 8100, 8150])
  spawnSync('node', ['-e','process.exit(0)', 'x'.repeat(n-20)], {shell:true})
// => 0, 0, 0, 0, 1
```

**Fixed by removing the shell**, not by shortening the scan list: the gate now spawns the resolved
`vitest.mjs` with `process.execPath` and `shell: false`, handing argv to CreateProcess (32,767-char
ceiling) with each target as its own argument. It runs the identical file `npx` resolved.

⛔ **Trimming `TARGETS` to fit a shell limit would have silently un-run suites** — precisely the
failure the TARGETS/BASELINE two-knob rule exists to prevent. A gate that quietly stops running
files is worse than one that refuses to start, because only the second one tells anybody.

⚠ `require.resolve("vitest/vitest.mjs")` does **not** work — the package's `exports` map blocks the
deep path (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Resolve `package.json` and join the `bin` entry.

## Gates

**Backend** (`pytest tests/unit -q --continue-on-collection-errors`, from `backend/`):

| Run | Result |
|---|---|
| Base commit `0ce1a7c43` | `71 failed · 4374 passed · 2 xfailed · 2 xpassed` · 0 collection errors |
| After Task 1 (first attempt) | ⛔ **`74 failed`** — 3 over the ceiling |
| After Task 1 (fixed) | `71 failed · 4393 passed` · 0 collection errors · `comm -13` **empty** |
| After Task 2 | `71 failed · 4407 passed · 2 xfailed · 2 xpassed` · 0 collection errors · `comm -13` **empty** |

The three regressions were **real and mine**: `test_settings.py`'s `_fake_settings` is a
`SimpleNamespace`, so `_build_response` raised `AttributeError: 'types.SimpleNamespace' object has no
attribute 'hnsw_ef_search'`. Fixed by adding both fields to the stub — the same thing SEED-226 and
SEED-258 did, for the reason that file already records: *"a getattr default here would hide a field
the API forgot to build."* ⚠ **The ceiling has zero headroom, so this was caught only because the
full gate was run per task rather than once at the end.**

**Frontend count gate** — verdict line **verbatim**, from the repo root:

```
  total 7940  ·  failed 0  ·  pinned total 7170
count gate OK — 249/249 pinned files present, no per-file decrease, 0 failing.
```

Arithmetic, so growth is distinguishable from drift: pre-Task-3 (after the harness fix) read
`7930 / 7160 / 249`; the close reads `7940 / 7170 / 249`. **`+10` on both totals — exactly this
plan's ten new cases**, with no residual and no per-file decrease.

⚠ **CLAUDE.md's last recorded figures are the 2026-09-07 rot at `7816 / 7020 / 241`. The measured
current ones are `7940 / 7170 / 249` — the SEVENTH rot, three days.** A bigger number is the gate
working; its contract is *no per-file DECREASE* and *zero failing*.

**`SettingsPage.test.tsx`**: `23 passed` (13 → 23), equal to the new BASELINE.

**Typecheck** (`npx tsc -p tsconfig.app.json --noEmit` — ⛔ never the vacuous bare form): **67 at
base, 67 at close, zero NEW as a set diff on `file + code + message`.** One genuinely new error
appeared mid-task (`SettingsPage.a11y.test.tsx`'s fixture missing the five new fields) and was
fixed. ⚠ The remaining `SettingsPage.test.tsx` `TS2322` is **inherited** — present at base; only its
`... N more ...` elision count shifted, which the diff normalises.

**Ledger gate**: `node scripts/check-hot-file-ledger.cjs 241` → `ledger gate OK`, exit 0.

## ⚠ One red gate run, and it reproduced SEED-171 EXACTLY

The first full gate run after Task 3 read `failed 3`. Procedure followed to the letter — filenames
taken from the gate's **own persisted JSON before anything was re-run**:

| File | Test | Signature |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door — flag ON (D-183-01) | `Error: STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the mount harness works" | `Error: STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the four shipped tab triggers render" | `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` |

**That table is identical — three cases, three signatures — to SEED-171's 2026-09-06 sighting.** Both
files are **provably unmodified** by this plan: neither appears in `git status --short` nor in
`git diff --numstat <base> HEAD`, and neither imports anything this plan touched. In isolation
together: `200 passed | 1 skipped`. The same gate read `failed 0` before the frontend edits and
`failed 0` on the re-run after them — **green, red, green at cap 2. The cap was never touched.**

⚠ Recorded as **provably unmodified**, never as "fine" — one green sample of a flaky suite is not
proof of innocence. **The sighting was written back into `SEED-171`**, which turns a single 2026-09-06
observation into a reproduction and strengthens that seed's best lead: a duplicate accessible name
leaking between sibling tests in one worker is an isolation defect with a fingerprint, not a timeout.

## Migration discipline

- `ls supabase/migrations/176_*.sql` → exactly one file, matching `^[0-9]+_[a-z0-9_]+\.sql$` (no letter suffix).
- `git status` showed it as a **new file only**; `supabase/full-schema.sql` is unchanged by this plan.
- ⛔ **No `supabase db push` and no `supabase db reset` was run at any point.** The operator pastes 176 in 241-04.
- Fail-soft proved without a database: `_build_settings_from_row({})` yields `40` / `"off"` — the live
  server configuration measured 2026-09-10. Applying this plan changes **no search** until an operator
  both pastes the migration and sets a value.

## Security (threat register)

| Threat | Disposition |
|---|---|
| **T-241-13** unbounded `ef_search` | Bounded in three places. ⚠ The **API refusal is load-bearing and the CHECK is the backstop**, because `BUG-260909-01` records `save_app_settings` swallowing a CHECK violation. Said so in the migration header. |
| **T-241-14** injection into a `SET` | GUC name is a hardcoded literal per statement constant; only the value is bound as `$1`. `int()` coercion + enum validation before binding. Behavioural fence **and** a comment-stripped source fence, driven RED against a planted f-string. |
| **T-241-15** leak to the next pool borrower | `set_config(..., true)` asserted as an **argument**, so a refactor to `false` turns a test red rather than leaking silently. |
| **T-241-16** memory companions | Absent from `UserEffectiveSettings` and from `SettingsUpdate` — asserted, not asserted-about. |
| **T-241-17** pgvector < 0.8 | Per-knob `try` swallowing `UndefinedObjectError` / `InvalidParameterValueError`; both failure orders driven. |
| **T-241-18** RLS posture | Verified rather than inferred: **no `app_settings ENABLE ROW LEVEL SECURITY` exists anywhere under `supabase/`**. Columns on an existing table; no new RLS surface. Stated in the migration header. |
| **T-241-SC** package installs | **None.** No Python package, no npm dependency. |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] The vitest count gate could not run at the phase base**
- **Found during:** Task 1's gate baseline, before any frontend edit.
- **Issue:** `shell: true` + a ~8,078-char command line → `cmd.exe` refusal, exit 255, no report.
- **Fix:** spawn the resolved `vitest.mjs` via `process.execPath` with `shell: false`.
- **Files:** `scripts/vitest-count-gate.cjs` (in `files_modified`). **Commit:** `1706e939e`

**2. [Rule 1 — Bug] `test_settings.py`'s stub broke `_build_response`**
- **Found during:** Task 1's full backend gate — `74 failed`, 3 over the ceiling.
- **Fix:** both fields added to `_fake_settings`, per the SEED-226/258 precedent.
- **Files:** `backend/tests/unit/test_settings.py`. **Commit:** `7b58731bc`

**3. [Rule 3 — Blocking] Frontend wire types**
- `frontend/src/lib/api/skills.ts` is **not** in `files_modified`, but `FullAppSettings` /
  `SettingsUpdate` must carry the five new keys or `SettingsPage.tsx` cannot typecheck.
- **Files:** `frontend/src/lib/api/skills.ts`. **Commit:** `1706e939e`

**4. [Rule 1 — Bug] `SettingsPage.a11y.test.tsx` fixture**
- The only genuinely NEW typecheck error; its fixture lacked the five required fields.
- **Files:** `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx`. **Commit:** `1706e939e`

**5. [Rule 2 — Missing bookkeeping] SEED-171 sighting written back into the seed**
- CLAUDE.md: *"A seed is answered by editing the seed"*; a finding recorded only in a SUMMARY rots.
- **Files:** `.planning/seeds/SEED-171-...md`. **Commit:** `1706e939e`

### Plan instructions that were measured WRONG, and corrected

**6. The plan's `<verify>` command for Task 3 is stale.** `npx vitest run … --reporter=basic` fails
outright on vitest 4.1.0 — `Failed to load url basic (resolved id: basic). Does the file exist?`
The `basic` reporter no longer exists. Used the default reporter.

**7. The plan, `241-CONTEXT` and `CLAUDE.md` all name the Settings tab "Search & Retrieval". The
product does not.** `usePlainLabel("settings.tab.retrieval")` resolves `plain: "Search"` and the
provider defaults OFF, so **"Search & Retrieval" is the ⌥ Technical-names reveal, not the shipped
label.** The test suite first asserted the technical name and failed **nine cases at once**. The
reason is written into the helper so the next reader does not repeat it.

**8. My own predicted landing size was wrong, and the correction is recorded beside it.** I wrote
*"Measured at 241-03: 8 non-comment lines"* from counting the edit I intended; the shipped landing
measures **11** (the `_vector_search` argument expression wraps across three lines, and one
docstring line names the module). The fence docstring now says so explicitly, cap 12.

### Choices the plan left open, decided and pinned

**9. The default configuration issues ZERO statements.** The plan said the choice "must be pinned by
a test rather than left to be discovered". Chosen: silence. Issuing them would cost two extra round
trips on **every** search to assert what is already true, and would silently override a server whose
`postgresql.conf` had been tuned away from 40 by somebody who meant it.

**10. The controls sit OUTSIDE the `hybridEnabled` block.** The plan said "below the RRF-K row",
which is inside it. `search_documents` calls `_vector_search` on the **vector-only** path too, so
placing them inside would hide a control that is still in effect. Pinned by a test that also asserts
the RRF-K row really is absent, so the case cannot pass vacuously.

**11. Bounds constants live in `user_settings.py`, re-exported by `api/settings.py`.** The plan said
"module constants in `api/settings.py`". `retrieval_tuning.py` (a service) needs the enum, and a
service importing an API module is the wrong dependency direction. `SOURCE_MAX_FILE_SIZE_MB_*` set
this precedent exactly. A test asserts `settings_api.HNSW_EF_SEARCH_FLOOR is us.HNSW_EF_SEARCH_FLOOR`,
so "one source" is enforced rather than described.

## Known Stubs

None. Every control is wired end to end: served bounds → rendered `min`/`max`, served enum →
rendered options, save payload → API → `app_settings` → `_val` → `SET LOCAL`.

## Threat Flags

None. No new network endpoint, no new auth path, no new file access, no new table. The one schema
change adds nullable columns to a table whose RLS posture was verified, not assumed.

## What 241-04 must do

1. **Paste `supabase/migrations/176_app_settings_hnsw_knobs.sql` into the Supabase SQL editor.**
   ⛔ Never `db push` / `db reset`.
2. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) — **not optional bookkeeping here**:
   D-07's bench reads `full-schema.sql` as its build input.
3. Verify cloud pgvector parity (D-14). This code is safe either way — an old server degrades the
   tuning, never the search — which is what lets the parity check be a measurement, not a prerequisite.

## Self-Check: PASSED

Files verified present:
- `supabase/migrations/176_app_settings_hnsw_knobs.sql` — FOUND
- `backend/app/services/retrieval_tuning.py` — FOUND
- `backend/tests/unit/test_241_hnsw_knobs.py` — FOUND

Commits verified in `git log`:
- `733a1a14a` test(241-03) RED — FOUND
- `7b58731bc` feat(241-03) GREEN — FOUND
- `7fa8b6af3` test(241-03) RED — FOUND
- `3c28156f5` feat(241-03) GREEN — FOUND
- `1706e939e` feat(241-03) — FOUND

TDD gate sequence: `test(...)` precedes `feat(...)` for **both** behaviour-adding tasks.
