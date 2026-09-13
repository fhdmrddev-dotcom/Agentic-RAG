# Phase 242 — BASELINE

**Measured 2026-09-11 at `7ac71638ecf25e234399eeba81ef996742d414bc`** (branch `develop`), clean
working tree, every command run from the repo root unless stated.

⚠⚠ **CORRECTED AT THE PHASE'S CLOSE — THIS FILE ORIGINALLY SAID "no sibling agent", AND THAT WAS
FALSE.** A **peer session was active on this repository throughout**, driving Phase 243's UAT in a
real browser: the base commit above is itself one of its commits (`docs(243): UAT driven in a real
browser — L-2 and L-3 PASS`, 08:01), and `bd088e6c6` landed at 08:06, one minute after this phase's
first commit. **The original sentence is struck rather than deleted because CLAUDE.md's cap rule is
explicit that at two concurrent test-running agents `count gate OK` goes non-deterministic**, and a
claim of quietness that nobody checked is exactly the kind this project keeps paying for.

⭐ **What it does NOT change, and why:** every gate run in this phase came back **green on the first
invocation** — `count gate OK` twice, `failed 0` both times. Oversubscription's signature is a
`STACK_TRACE_ERROR` timeout in an untouched file, i.e. a false RED; it does not manufacture a false
GREEN. So the verdicts stand. ⚠ Had any run gone red, this sentence would have been the first thing
to check. ⚠ **Every gate
criterion in this phase's plans is written as a SET DIFF against this file, never as a colour and
never as a count.** A count throws away the set; the set is what distinguishes a new failure from an
inherited one.

---

## 1. Backend unit suite — the ceiling, with zero headroom

```
cd backend && venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors
71 failed, 4517 passed, 2 xfailed, 2 xpassed, 43 warnings in 315.25s
```

| | |
|---|---|
| failed | **71** |
| passed | 4517 |
| xfailed / xpassed | 2 / 2 |
| collection errors | **0** |

⛔ **CLAUDE.md locks the ceiling at 71 with ZERO headroom. 72 breaks the gate.** The full failing
SET — all 71 node ids, sorted — is committed beside this file at **`242-backend-base-set.txt`**.
Diff against it; do not compare counts.

⚠ **CLAUDE.md's milestone-v4.0 line reads `71 failed, 3497 passed`.** The *passed* figure has grown
to 4517 and that is the gate WORKING — its contract is the failure ceiling, not a fixed total. The
ceiling itself is unchanged and is still 71.

⚠ **Four inherited failures sit inside this phase's blast radius** and must not be mistaken for its
own: `test_111_1_reembed_kickoff.py::test_dims_only_change_kicks_reembed`,
`::test_model_change_kicks_reembed`, `::test_model_only_change_kicks_without_resize`,
`::test_no_change_save_does_not_reembed`. They are about `PUT /settings`'s re-embed kick. **They are
red at this commit, before any edit.** A plan that touches `settings.py` and sees them red has seen
the baseline.

---

## 2. Frontend count gate — GREEN at base

```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs     # from the repo root
  total 8046  ·  failed 0  ·  pinned total 7276
count gate OK — 256/256 pinned files present, no per-file decrease, 0 failing.
```

| | |
|---|---|
| grand total | **8046** |
| pinned total | **7276** |
| pinned files | **256/256** |
| failing | **0** |

⭐ **Unlike Phase 243, this phase's base is GREEN**, so `count gate OK` IS reachable here and may be
used as a criterion — but the per-file deltas and the explicitly-run in-scope suites remain the
deterministic evidence, and a red run is still triaged by capturing the failing filenames from the
gate's own persisted JSON **before** re-running anything (SEED-171).

⚠ **A known standing red is invisible to this verdict, by a Phase 235 decision:**
`src/components/sources/sourceComposition.test.tsx` sits in NEITHER knob at ~18 failed / 31 passed.
If it appears in a run, it is inherited and is not this phase's.

⭐ **Two SettingsPage suites are gated by NOTHING** and were found while planning:
`src/pages/__tests__/SettingsPage.a11y.test.tsx` and
`src/pages/__tests__/SettingsPage.sourceCeiling.test.tsx`. `grep -n "SettingsPage"` over the gate
returns exactly two hits — the `BASELINE` key `"SettingsPage.test.tsx": 23` and the `TARGETS` path
`"src/pages/SettingsPage.test.tsx"` — and **`src/pages` is not a directory entry**, so neither
orphan has ever run under the gate. 242-02 adopts both. **Adoption raises the total; that is the
desirable direction and must not be read as drift.**

---

## 3. Frontend typecheck

```
cd frontend && npx tsc -p tsconfig.app.json --noEmit
67 errors
```

⛔ **`npx tsc --noEmit` (no `-p`) is VACUOUS here** — `frontend/tsconfig.json` is solution-style
(`{"files": [], "references": [...]}`) and type-checks **zero** files, exiting 0 over anything.
Measured 2026-09-08 at Phase 239-08, where it reported green over 24 real `TS6133` errors. **Use the
app config, and measure a SET DIFF** — "zero errors" is not a reachable criterion at 67 base errors.

The full sorted error set is at `242-tsc-base.txt` (scratchpad copy retained for the phase).

---

## 4. Hot-file ledger triples, re-derived at this commit

| File | measured `commits / phases / lines` | CLAUDE.md row said | verdict |
|---|---|---|---|
| `backend/app/api/settings.py` | **36 / 19 / 854** | `35 / 19 / 814` | ⚠ STALE — 242-02 updates it |
| `frontend/src/pages/SettingsPage.tsx` | **45 / 23 / 1751** | `44 / 23 / 1738` | ⚠ STALE — 242-02 updates it |
| `backend/app/models/user_settings.py` | **50 / 32 / 1561** | `50 / 32 / 1561` | ✅ current — **and this phase does not modify it**, so no row edit is owed |

All three FIRE G-5. `242-CONTEXT.md`'s `<code_context>` figures agree with these exactly — the
CONTEXT was measured at HEAD and has not rotted.

---

## 5. Cloud, read over the Supabase MCP (read-only, free)

Taken during discussion on 2026-09-11 against project `esnfauggawekgbvkqkyf` and recorded here so a
plan does not re-query what is already measured:

| | |
|---|---|
| `app_settings.multimodal_max_vision_calls` | **100** (the column default — in range) |
| `hnsw_ef_search` / `hnsw_iterative_scan` | **NULL / NULL** (server default 40 applies) |
| corpus | **2,068 chunks · 47 documents · 1 owner · 1 org** |
| migrations `153-156, 166..176` | **present** — 17/19 structural checks PASS, both FAILs explained and false |

⛔ **Migration 178 is NOT applied to cloud by this phase.** A cloud write needs explicit
per-action operator approval; the phase record names it as operator-owed.

⚠⚠ **CORRECTED AT THE PHASE'S CLOSE — the struck clause is kept because inheriting it would be the
error.** This paragraph originally continued *"…alongside migration 177 (`BUG-260911-01`), which is
also written, applied to local, and **awaiting the same approval**"*, inheriting `242-CONTEXT.md`
D-242-07 without re-measuring it. **Measured on 2026-09-11 over the read-only Supabase MCP:
migration 177 IS APPLIED TO CLOUD.** Its own VERIFY block returns **7/7 PASS** — RLS enabled on both
`app_settings` and `user_settings`, `anon` unable to read or write either, `anon` unable to execute
`resize_embedding_column`, `service_role` still writing — and the Supabase security advisor's
`rls_disabled_in_public` **ERROR is gone**, with no ERROR-level finding left on the project.
**`BUG-260911-01` is remediated in production.** ⛔ The 13 SECURITY DEFINER functions still flagged
at WARN are unchanged and expected: 177's own header warns that a role-by-role revoke sweep would
**silently achieve nothing**, because the grant comes from `PUBLIC`.

---

## 6. What "green" means in this phase

| Gate | Criterion |
|---|---|
| backend unit | failing **SET** identical to `242-backend-base-set.txt`; **71 is a ceiling, not a target** |
| count gate | `count gate OK`, no per-file decrease; a red run is triaged from the persisted JSON before any re-run |
| typecheck | set diff against the 67 base errors **empty both ways**, via `-p tsconfig.app.json` |
| `check-claude-md-size.cjs` | exit 0 |
| `check-hot-file-ledger.cjs 242` | exit 0 at the phase's close |
