---
phase: 241-recall-at-corpus-scale
plan: 05
subsystem: review-closure
tags: [review-closure, wr-01, wr-05, wr-07, wr-08, tdd, guard, injection, vacuous-fence]
requires:
  - .planning/phases/241-recall-at-corpus-scale/241-REVIEW.md
  - backend/app/models/user_settings.py (HNSW_EF_SEARCH_FLOOR / _CEILING — the one home)
  - backend/app/services/recall_eval.py (validate_knobs — already idempotent)
provides:
  - "assert_bench_target refuses host LISTS, non-Supabase ports and query strings"
  - "apply_hnsw_session_knobs bounds ef_search at the apply boundary, per knob"
  - "an AST guard: every test_the_api_* case must cross the request boundary"
  - "_apply_hnsw_knobs validates where it interpolates, so its docstring is true"
affects:
  - "scripts/build-recall-bench.py (a multi-host or non-54322 --bench-dsn is now refused)"
  - "backend/app/services/retrieval_tuning.py (G-5 helper module, second landing)"
tech-stack:
  added: []
  patterns:
    - "refuse the DSN shapes a guard cannot reason about, rather than reason about one interpretation"
    - "validate AT the interpolation site, so a docstring's claim is a property of the function that makes it"
    - "the second door per knob: degrade the TUNING, never the SEARCH, and never the OTHER knob"
    - "an AST fence over a CLASS of vacuous test, not over the one case a review happened to find"
key-files:
  created:
    - .planning/phases/241-recall-at-corpus-scale/241-05-SUMMARY.md
  modified:
    - scripts/build-recall-bench.py
    - backend/app/services/retrieval_tuning.py
    - backend/app/services/recall_eval.py
    - backend/tests/unit/test_241_bench_safety.py
    - backend/tests/unit/test_241_hnsw_knobs.py
    - backend/tests/unit/test_241_recall_harness_honesty.py
decisions:
  - "WR-05: an out-of-range ef_search costs ITS OWN knob only — the review's suggested early `return` would have discarded an iterative_scan mode the operator did choose"
  - "WR-01: `localhost` deliberately KEPT in LOOPBACK_HOSTS; 241-02-PLAN names it an acceptance criterion and the exploit needs hosts-file admin. Recorded as a named residual, not silently dropped"
  - "WR-01: the query-string arm is MEASURED INERT on asyncpg 0.31.0 and shipped anyway, said out loud in both the code comment and the test docstring"
  - "WR-07: the RED is an AST guard over the vacuity CLASS, so it is genuinely red on the shipped tree rather than red only under a plant"
metrics:
  duration: ~95 min
  completed: 2026-09-10
  tasks: 4
  commits: 8
---

# Phase 241 Plan 05: Four Review Warnings, Closed with Fences That Can Fire — Summary

`WR-01` `WR-05` `WR-07` `WR-08` from `241-REVIEW.md`, each driven RED against the real
shipped defect before it was fixed — including the one whose defect *was* a test that
could not fail, which needed a guard over the vacuity class rather than over the one case
the review happened to notice.

## What shipped

| Finding | File | What changed |
|---|---|---|
| **WR-01** | `scripts/build-recall-bench.py` | `assert_bench_target` refuses a comma-separated host **LIST**, a port outside `ALLOWED_PORTS = {54322}`, and any query string |
| **WR-05** | `backend/app/services/retrieval_tuning.py` | `apply_hnsw_session_knobs` bounds `ef_search` against `HNSW_EF_SEARCH_FLOOR` / `_CEILING` at the apply boundary — the second door `iterative_scan` already had |
| **WR-07** | `backend/tests/unit/test_241_hnsw_knobs.py` | the boundary case now calls `update_settings` **and** asserts the value reached the write; an AST guard makes the vacuity class un-repeatable |
| **WR-08** | `backend/app/services/recall_eval.py` | `_apply_hnsw_knobs` calls `validate_knobs` itself, so the constraint its docstring claims lives in the function that does the splicing |

## The eight commits — RED before GREEN, four times

| # | Commit | Gate | Measured |
|---|---|---|---|
| 1 | `9f2de4884` | RED WR-01 | `17 failed, 23 passed` |
| 2 | `4600f19dd` | GREEN WR-01 | `40 passed` |
| 3 | `00ac98592` | RED WR-05 | `4 failed, 36 passed` |
| 4 | `d776141d3` | GREEN WR-05 | `40 passed` |
| 5 | `238c69d40` | RED WR-07 | `1 failed, 41 passed` |
| 6 | `39ce2a5f3` | GREEN WR-07 | `42 passed` |
| 7 | `b65781f1f` | RED WR-08 | `5 failed, 25 passed` |
| 8 | `1ba041574` | GREEN WR-08 | `30 passed` |

⚠ **Two unrelated commits by another agent landed between my base read and my first
commit** — `19925a5bb` and `7a1e120b2`, both `docs(241)` on `241-VALIDATION.md` and a new
verdict-correction file. My commits therefore sit on top of them rather than directly on
`43f93cbc4`. `git diff --numstat 7a1e120b2..HEAD` names **exactly six files**, all mine;
`241-VALIDATION.md` and `241-REVIEW.md` were never opened for writing here. Recorded
because "the base is `43f93cbc4`" is no longer literally true of this branch and the next
reader would otherwise derive a diff that includes somebody else's work.

---

## WR-01 — the guard enforced a weaker invariant than the one it states

### What was driven RED, and against what

Not a plant: **the defect was shipped**. The four new host-list cases, five port cases,
five query cases and the two constants all failed on the tree as it stood — `17 failed`.

**The premise was measured, not quoted from the review.** `241-REVIEW` says asyncpg fails
over; I asked asyncpg:

```
>>> cu._parse_connect_dsn_and_args(dsn="postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/recall_bench", ...)
addrs = [('localhost', 54322), ('prod.example.com', 5432)]      database = 'recall_bench'
>>> urllib.parse.urlparse(same_dsn).hostname
'localhost'
```

That premise now ships as its own case (`test_the_premise_asyncpg_really_fails_over_to_a_second_host`)
so a future asyncpg that drops host-list support turns this refusal from load-bearing into
belt-and-braces *visibly*, rather than silently.

### ⭐ A finding the review did not have: `urlparse(...).port` RAISES on the bypass DSN

```
ValueError: Port could not be cast to integer value as '54322,prod.example.com:5432'
```

So the review's suggested ordering is **load-bearing, not stylistic**: a port check written
before the host-list check crashes with an unhandled `ValueError` instead of refusing. The
shipped guard checks the comma first and still wraps `.port`, because *"cannot parse"* must
never fall through to *"accepted"*.

### Proven against the review's exact bypass string

```
maint would have been: postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/postgres
REFUSED: refusing target 'postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/recall_bench':
         'localhost:54322,prod.example.com:5432' is a comma-separated host LIST, which cannot be
         proven loopback -- asyncpg fails over to the later hosts and urlparse().hostname never
         reports them. Name exactly one loopback host.
default DSN still ACCEPTED
```

`--help` still runs; the shipped `--source-dsn` / `--bench-dsn` defaults (both `127.0.0.1:54322`)
are unaffected, and a positive control asserts it.

### ⭐ The AST source fence fired on my own docstring, and was reworded rather than exempted

The GREEN commit's first run was **not** green:

```
line 124: destructive statement in assert_bench_target() with no assert_bench_target(...) above it:
  '``DROP DATABASE IF EXISTS "recall_bench" WITH (FORCE)``. On a machine where local Docker'
```

That is the fence behaving exactly as designed — it is deliberately blind to intent, and
241-02 recorded it doing the same thing to the builder's own author. **The prose was
reworded; no prose exemption was added**, because a guard that can be talked out of firing
is not a guard.

### ⚠ Named residual — NOT taken, and why

The review lists two smaller gaps in the same function. One is closed (the port). The other
— *"`localhost` is resolver-dependent, drop it from `LOOPBACK_HOSTS`"* — is **deliberately
not taken**:

- `241-02-PLAN.md:116` names it as an acceptance criterion in as many words
  (*"A DSN whose database is `recall_bench` on `127.0.0.1` / `localhost` is ACCEPTED"*), and
  two shipped cases pin it.
- Redirecting `localhost` requires writing the machine's `hosts` file, which needs
  administrator rights — i.e. an attacker who could equally edit this script. The host-list
  and port gaps require **no** privilege at all, which is why those two were taken and this
  one was weighed.
- A resolver-based check (`getaddrinfo("localhost")`, assert every address is loopback)
  would close it without removing the alias, but it would break this test file's stated
  contract — *"no network, no database and no environment variable"* — by making the verdict
  depend on the machine's resolver.

**Re-open trigger:** any phase that widens `LOOPBACK_HOSTS`, or that runs the bench on a
machine whose `hosts` file is not operator-controlled (CI, a shared box, a container image).

---

## WR-05 — `ef_search` had no second door, and the env route walks past both

### What was driven RED, against the actual route

Not a plant. `test_the_config_env_route_is_bounded_too` drives WR-05's own failure scenario
end to end and failed at the last line:

```
assert 'hnsw.ef_search' not in ['hnsw.ef_search']
E  a value that reached the settings object only through backend/.env was issued to the
   server; it passed neither the API 400 nor migration 176's CHECK
```

The first half of that case is the part worth keeping: with `env_settings.hnsw_ef_search`
monkeypatched to `250_000`, **`_build_settings_from_row({})` returns `250_000`** — so the
`config.py` → `_val` → settings-object route is real, not hypothetical, and it is the state
of every row until an operator sets a value.

### ⚠ The fix DEVIATES from the review's suggested patch, deliberately

The review's snippet ends the whole function on an out-of-range value:

```python
if not FLOOR <= resolved_ef <= CEILING:
    logger.warning(...)
    return            # <- ends apply_hnsw_session_knobs
```

That `return` sits **above** the `iterative_scan` block, so one rejected number would have
silently discarded a scan mode the operator *did* choose. The shipped fix falls back to
`_SERVER_DEFAULT_EF_SEARCH` instead — which the existing `!=` no-op check turns into
"issue nothing for this knob" — and lets the other knob ride. That is byte-symmetric with
the arm directly above it (the `int()` failure), and with the module's own rule *degrade the
TUNING, never the SEARCH*. It is pinned by
`test_an_out_of_range_ef_search_does_not_cost_the_OTHER_knob`.

The bounds are **imported from the one home**, asserted by identity
(`rt.HNSW_EF_SEARCH_FLOOR is us.HNSW_EF_SEARCH_FLOOR`), so a re-typed copy cannot drift from
what the API refuses on and the UI renders.

---

## WR-07 — a fence that could not fail, and the guard so it cannot come back

### The RED is real on the shipped tree, not only under a plant

WR-07 has no source defect: the API bound is correct. A fence written to the review's
suggested shape is therefore GREEN the moment it is authored, which would have made a
"RED commit" a fiction. So the RED commit carries a different thing — an **AST guard over
the vacuity class**: every case named `test_the_api_*` must call `_patch()`, i.e. must cross
the boundary its name claims to be about. On the shipped tree it named the offender without
being told:

```
E  these cases are named for what the API does but never call update_settings, so the bound
   they claim to guard could be changed without any of them failing:
   test_the_api_accepts_both_boundaries_and_the_shipped_default
```

It carries its own positive control (the helper must be able to *see* `_patch` where it is
plainly called, or both assertions pass vacuously).

### The plant drive, as the success criterion requires

| Step | Measured |
|---|---|
| `git hash-object backend/app/api/settings.py` **before** | `a186baafde33c24119776648765691b0c7a8c07b` |
| Planted at `settings.py:602` | `if not FLOOR <= body.hnsw_ef_search <= CEILING:` → `if not FLOOR < body.hnsw_ef_search < CEILING:` |
| **The OLD form under the plant** (`SettingsUpdate(hnsw_ef_search=ok).hnsw_ef_search == ok`, all four) | **4/4 still GREEN** — the vacuity, demonstrated rather than argued |
| **The NEW form under the plant** | **2 failed** — `[10]` and `[1000]`, exactly the two boundaries |
| Restored (`git checkout -- backend/app/api/settings.py`) | `git hash-object` → `a186baafde33c24119776648765691b0c7a8c07b` — **identical**; `git diff --stat` **empty** |

⚠ Restoration is proved by `git hash-object` + an empty `git diff --stat`, never by md5:
this repo rewrites LF→CRLF on checkout, so md5 differs on a byte-identical working file.

### And a second half the review did not ask for

The rewritten case asserts **both** that the request was not refused **and** that
`saved["hnsw_ef_search"] == ok` — the value reached the write. "Did not raise" is only half
of *accepted*; a handler that silently dropped the key would satisfy the first half
perfectly, which is Phase 240's *"screen that discards its own answer"*.

### [Rule 2] An autouse fixture restores the file's own stated property

`test_241_hnsw_knobs.py`'s docstring says **"EVERY CASE HERE RUNS WITHOUT A DATABASE."**
CR-01 (commit `43f93cbc4`, this same review round) put a live `information_schema` probe at
the top of `update_settings`, ahead of both bounds, failing **closed**. That is right for
production and wrong here: on any database without migration 176 the refusal cases would
meet a 409 about the migration instead of the 400 they are about, so the file's verdict
depended on whether somebody had pasted a migration. A narrow autouse fixture stubs **only**
`app_settings_has_hnsw_columns → True`. CR-01's own behaviour keeps its own file
(`test_241_cr01_settings_write_without_migration.py`, 5 passed) and is not weakened.

---

## WR-08 — the docstring claimed a validation that lived in a caller

### What was driven RED, and what it actually executed

Not a plant — measured through the **public** entry point:

```
EXECUTED VERBATIM ->  SET LOCAL hnsw.iterative_scan = ''; DROP TABLE public.documents --'
```

on a connection that `measuring_connection` carries as `SET LOCAL ROLE authenticated`.
`measure_layer1` returned normally and reported metrics. Five cases red: the three entry
points (`_apply_hnsw_knobs`, `measure_layer1`, `measure_layer2`), the `ef_search` range that
travels with the allow-list, and an AST fence asserting the constraint is **inside** the
function whose docstring claims it. The positive control (a legitimate `200` /
`relaxed_order` pair still rides) was green throughout, so the five reds are the missing
validation and nothing else.

### The fix

`_apply_hnsw_knobs` now opens with `checked_ef, checked_scan = validate_knobs(...)` and
interpolates only the checked values. `validate_knobs` is idempotent, so `run_measurement`'s
own call at `:923` is unchanged. Both false prose claims were corrected in place — the
function's own docstring, and `_match`'s wider *"the only interpolated text in this module
is the two allow-listed GUC values"*, which was true of one caller and is now true of the
module.

---

## Verification

| Check | Result |
|---|---|
| `tests/unit/test_241_bench_safety.py` | **40 passed** (was 21) |
| `tests/unit/test_241_hnsw_knobs.py` | **42 passed** (was 33) |
| `tests/unit/test_241_recall_harness_honesty.py` | **30 passed** (was 24) |
| `tests/unit/test_241_cr01_settings_write_without_migration.py` | **5 passed** (unchanged) |
| `python scripts/build-recall-bench.py --help` | exits 0, all flags intact |
| Real corpus, re-derived after all work | **160 documents · 7,959 chunks** — unchanged |
| `pg_database` | `['_supabase', 'postgres', 'template0', 'template1']` — **no `recall_bench`**; none created, none dropped |

### The canonical backend gate — argued, not asserted

```
BEFORE (base):  71 failed · 4457 passed · 2 xfailed · 2 xpassed · 0 collection errors · 184.10s
AFTER:          71 failed · 4491 passed · 2 xfailed · 2 xpassed · 0 collection errors · 174.98s
```

- `failed` **unchanged at 71** — the ceiling holds with the zero headroom it has. Counted
  with `grep -c '^FAILED '` on both runs, never derived from the summary line.
- **The failing SET was diffed in BOTH directions and is identical.** The raw `comm` showed
  one apparent NEW/GONE pair on
  `test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route[async def upload_document(]`
  — that is pytest gluing a `RuntimeWarning: coroutine '_enrich_with_filenames' was never
  awaited` onto the end of the `FAILED` line, exactly the artefact `CLAUDE.md` warns about.
  Normalising each line to the test id makes both directions **empty**, 71 = 71.
- `passed` **+34**, and the arithmetic has **no residual**: bench_safety `+19`,
  hnsw_knobs `+9`, harness_honesty `+6` — 34, which is precisely the number of cases these
  four fixes add. No pre-existing test changed outcome.
- `test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery` (the known
  flake) failed on **both** runs, so it is inherited on both sides and needed no re-run.

## Deviations from Plan

### Auto-fixed / deliberate

**1. [Rule 1 — Bug] The bench builder's AST source fence fired on this plan's own docstring**
- **Found during:** WR-01 GREEN, first run
- **Issue:** the new docstring quoted `DROP DATABASE IF EXISTS "recall_bench" WITH (FORCE)` as
  prose; the fence is deliberately blind to intent and refused it.
- **Fix:** reworded to *"the guarded, irreversible database-level drop below"*. **No prose
  exemption was added to the fence** — that would be the hole.
- **Commit:** `4600f19dd`

**2. [Rule 2 — Missing critical functionality] `test_241_hnsw_knobs.py` no longer ran without a database**
- See WR-07 above. Autouse fixture stubs only CR-01's column probe.
- **Commit:** `39ce2a5f3`

**3. [Deliberate] WR-05's fix is not the review's suggested `return`**
- Per-knob degrade instead, so a rejected `ef_search` cannot discard a chosen
  `iterative_scan`. Pinned by its own case. **Commit:** `d776141d3`

**4. [Deliberate] WR-01's query-string arm is measured INERT and shipped anyway**
- On asyncpg 0.31.0, `?host=` / `?port=` / `?dbname=` are ignored when the netloc supplies
  the value (measured: the parser still returns `[('127.0.0.1', 54322)]`, database
  `recall_bench`). Said out loud in the code comment **and** the test docstring, so nobody
  later reads it as a closed hole that it is not. It ships because the guard's contract is
  *refuse what it cannot reason about*.

### Out of scope, untouched, and named

`CR-01` (already closed at the base commit), `WR-02`, `WR-03`, `WR-04`, `WR-06` and every
`IN-*` finding were not touched. `241-VALIDATION.md` and `241-REVIEW.md` were not edited.
`STATE.md` and `ROADMAP.md` were not modified — the orchestrator owns those.

⚠ Two of the untouched findings are worth naming because this plan walked past them:
- **`IN-07`** — `test_241_hnsw_knobs.py` reads a developer's `.env` through
  `env_settings.hnsw_ef_search`. My WR-05 case *monkeypatches* that field rather than
  reading it, so it adds no new exposure — but the three cases `IN-07` names still read the
  live env and can still red the zero-headroom gate on a machine with `HNSW_EF_SEARCH` set.
- **`IN-04`** — the `'f"SET'` source fence in the same file matches one spelling. My WR-05
  change adds no `set_config` interpolation, so nothing new hides behind it.

## Threat Flags

None new. Two existing surfaces were **narrowed**: `assert_bench_target` (WR-01, a
`DROP DATABASE` reachable on a remote cluster) and `_apply_hnsw_knobs` (WR-08, a closed
single-quote injection into `SET LOCAL` on an `authenticated` connection). Both are now
refused at the boundary, and both refusals are driven by cases that were RED against the
shipped behaviour first.

## Self-Check: PASSED

- `scripts/build-recall-bench.py` — FOUND
- `backend/app/services/retrieval_tuning.py` — FOUND
- `backend/app/services/recall_eval.py` — FOUND
- `backend/tests/unit/test_241_bench_safety.py` — FOUND
- `backend/tests/unit/test_241_hnsw_knobs.py` — FOUND
- `backend/tests/unit/test_241_recall_harness_honesty.py` — FOUND
- `9f2de4884` RED WR-01 — FOUND
- `4600f19dd` GREEN WR-01 — FOUND
- `00ac98592` RED WR-05 — FOUND
- `d776141d3` GREEN WR-05 — FOUND
- `238c69d40` RED WR-07 — FOUND
- `39ce2a5f3` GREEN WR-07 — FOUND
- `b65781f1f` RED WR-08 — FOUND
- `1ba041574` GREEN WR-08 — FOUND
