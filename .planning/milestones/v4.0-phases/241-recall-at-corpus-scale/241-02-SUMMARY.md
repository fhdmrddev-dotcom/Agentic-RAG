---
phase: 241-recall-at-corpus-scale
plan: 02
subsystem: measurement-harness
tags: [recall, pgvector, hnsw, bench, safety-guard, tdd]
requires:
  - supabase/full-schema.sql
  - supabase/migrations/154_connection_scoped_visibility.sql
  - backend/app/dependencies.py
provides:
  - scripts/build-recall-bench.py
  - backend/tests/unit/test_241_bench_safety.py
  - recall_bench database (build + teardown, loopback only)
affects:
  - 241-04 (rebuilds the bench after migration 176 + regenerate-full-schema.sh)
tech-stack:
  added: []
  patterns:
    - "guard-before-destructive: assert_bench_target runs before every database-level drop/create, and the statements interpolate a module CONSTANT rather than any flag-parsed name"
    - "server-enforced read-only source (SET default_transaction_read_only = on), not read-only by convention"
    - "AST source fence: every destructive statement must sit in a function that calls the guard on an earlier line"
key-files:
  created:
    - scripts/build-recall-bench.py
    - backend/tests/unit/test_241_bench_safety.py
  modified: []
decisions:
  - "D-07 honoured: the bench is built from supabase/full-schema.sql, so match_document_chunks in the bench is the real function"
  - "The documented delta is THREE stubs, not one -- auth, storage and the supabase_realtime publication. Measured, not assumed."
  - "--sigma is a noise-to-signal NORM ratio, not a per-dimension sigma. Measured at the smoke build."
  - "250k is NOT advisable on this machine: 3.80 GB extrapolated against 5.1 GB free on C:. 100k proposed for 241-04."
metrics:
  duration: ~85 min
  completed: 2026-09-10
  tasks: 3
  commits: 5
---

# Phase 241 Plan 02: Build the Recall Bench Summary

A throwaway `recall_bench` database that is built from the project's own
`supabase/full-schema.sql`, carries the 7,953 real chunks verbatim, and creates the
tenant skew the live corpus cannot show — guarded so it is structurally incapable of
touching the operator's real database, and proven at 20k chunks where a 0.2% tenant
already under-fills a `k=20` request by 25% while every larger tenant fills completely.

## What shipped

| Artifact | What it does |
|---|---|
| `scripts/build-recall-bench.py` | Create · apply `full-schema.sql` · copy the real corpus verbatim · synthesise bulk by perturbation · realise the skew ladder · rebuild HNSW · report · teardown |
| `backend/tests/unit/test_241_bench_safety.py` | 21 cases pinning that the builder cannot be pointed anywhere but a loopback `recall_bench`, plus an AST source fence over every destructive statement |

## TDD gates

| Gate | Commit | Evidence |
|---|---|---|
| RED | `dfa4390bf` | `ImportError: the recall-bench builder does not exist yet: .../scripts/build-recall-bench.py` — collection error, `1 error in 0.83s` |
| GREEN | `adb9a1ea9` | `20 passed, 1 skipped` (the dead-code case skips while the builder holds no destructive statement) |
| GREEN | `f21a371e4` | `21 passed` — the full builder; the dead-code case now runs rather than skipping |
| FIX | `e33eeccb7` | `21 passed` after the two smoke-build defects |

## Planted defects, and the proof they were backed out

⚠ Both plants were driven against the property the fence actually claims to catch, and
both restorations are proved by **hash**, not by a green re-run.

### Plant 1 — the `in`-vs-`==` defect (mandated by the plan)

- Pre-plant md5: `e0dd989bdcf8006d9be9db0f19c0daf3`
- Change: `if database != BENCH_DB_NAME:` → `if BENCH_DB_NAME not in database:`
- RED, `4 failed, 16 passed, 1 skipped`, and the four names are the four that matter:
  - `test_a_database_merely_containing_recall_bench_is_refused[recall_bench_prod]`
  - `test_a_database_merely_containing_recall_bench_is_refused[myrecall_bench]`
  - `test_a_database_merely_containing_recall_bench_is_refused[recall_bench2]`
  - `test_a_database_merely_containing_recall_bench_is_refused[prod_recall_bench_live]`
- Post-restore md5: `e0dd989bdcf8006d9be9db0f19c0daf3` — **identical**. `git diff --stat -- scripts/build-recall-bench.py` empty after commit.

### Plant 2 — an unguarded destructive statement (not mandated; done because the fence is new)

- Pre-plant md5: `3fa92571fe55032759a22b858f396ffd`
- Change: added `await (await connect(args.bench_dsn)).execute("DROP DATABASE somebody_elses_db")` as the first line of `_run_teardown`
- RED, and the failure reads as a sentence naming the line and the function:
  > `line 852: destructive statement in _run_teardown() with no assert_bench_target(...) above it`
- Post-restore md5: `3fa92571fe55032759a22b858f396ffd` — **identical**.

### A third RED that was not planted — the fence fired on its own author

Immediately after Task 1's GREEN the fence failed on **line 9 of the builder's own
docstring**, because the prose said "issues irreversible ``DROP DATABASE`` /
``CREATE DATABASE``". That is the fence behaving correctly: it is deliberately blind to
intent, and adding a prose exemption would be the hole. The docstring was reworded
instead. ⚠ Recorded because a guard that can be talked out of firing is not a guard.

### A hole in the fence, found during GREEN and closed (Rule 1)

`_GUARD_CALL = r"\bassert_bench_target\s*\("` also matches **`def assert_bench_target(`**,
so the guard's own definition line satisfied the fence for anything written inside the
guard itself. Closed with a `_DEF_LINE` exclusion in the same GREEN commit. Without it
the fence would have been satisfiable by declaring the function and never calling it.

## The measured deltas from production — THREE, not one

The plan's `<interfaces>` block measured the `auth.uid()` (156) and `auth.users` (43)
counts and named **one** delta. Running the apply found **three**, because
`full-schema.sql` is `pg_dump --schema=public` **plus a cross-schema supplement**
(lines 7150-7413) that writes into objects a brand-new database does not have:

| Delta | Why the apply needs it | Security-bearing? |
|---|---|---|
| `auth` schema + `auth.users` + `auth.uid()` | 156 call sites, 43 foreign keys | ⛔ **YES** |
| `storage` schema + `buckets` / `objects` / `foldername()` | the supplement inserts 4 buckets and creates 8 RLS policies on `storage.objects` | no — nothing in the retrieval path reads it |
| `supabase_realtime` publication | `ALTER PUBLICATION ... ADD TABLE` ×3, wrapped only against `duplicate_object`, so a **missing** publication raises `undefined_object` and aborts | no |

Plus one **post**-apply step: `full-schema.sql` installs `on_auth_user_created`, which
provisions a personal org for every new `auth.users` row. The bench provisions its
tenants explicitly — the skew ladder is the whole point — so leaving that trigger
installed would silently give every real and synthetic user a **second** org and
`current_user_org_ids()` would return two. It is dropped **after** the apply, never
before, so the apply still exercises it.

### The refusal comment and the docstring sentence, verbatim

Module docstring:

> **The hand-rolled `auth.uid()` stub exists ONLY inside `recall_bench`; it must never
> be copied into `supabase/migrations/` nor into `full-schema.sql`, because production's
> `auth.uid()` is Supabase Auth's own and a hand-rolled one would be an authentication
> bypass on 156 call sites.**

Refusal comment directly above the stub:

> `# The hand-rolled auth.uid() stub exists ONLY inside recall_bench; it must never be`
> `# copied into supabase/migrations/ nor into full-schema.sql, because production's`
> `# auth.uid() is Supabase Auth's own and a hand-rolled one would be an authentication`
> `# bypass on the 156 call sites that ask it who the caller is.`

`git status --short supabase/` is **empty**: no migration and no `full-schema.sql` byte
moved. The stub lives in the builder only.

## Task 3 — the 20k smoke build

`full-schema.sql` applied **with zero errors**, first time, in **0.277 s**. This is the
first thing that has ever exercised that artifact end to end.

Three RPCs asserted present in the bench: **`match_document_chunks`**,
**`keyword_search_chunks`**, **`connection_doc_is_visible`**. The HNSW index was
asserted present at the migration-002 parameters, verbatim from `pg_indexes`:

```
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
  USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64')
```

### Stage timings (20,000 chunks)

| Stage | Seconds |
|---|---|
| `create_database` | 0.162 |
| `apply_full_schema` | 0.277 |
| `copy_real_corpus` | 12.593 |
| `synthesize` | 27.693 |
| `build_hnsw_index` | 15.850 |
| **total** | **56.6** |

### Achieved skew vs requested — exact on all three rungs

| Tenant | Requested share | Achieved share | Chunks |
|---|---|---|---|
| `bench-skew_0.002` | 0.002 | **0.002** | 40 |
| `bench-skew_0.02` | 0.02 | **0.02** | 400 |
| `bench-skew_0.2` | 0.2 | **0.2** | 4000 |
| `bench-filler` | 0.38035 | 0.38035 | 7607 |
| real: `fhdmrd@gmail.com's Organization` | — | 0.39755 | 7951 |
| real: two Phase-217.1 leak-test orgs | — | 0.00005 each | 1 each |

Relative error on the smallest rung: **0%** (acceptance allowed 10%). All 7,953 real
chunks copied verbatim (7951 + 1 + 1 across the three real orgs — matching F-5's
"3 distinct orgs").

### Sizes

`document_chunks` **335.1 MB** total relation size, of which the HNSW index is
**156.1 MB**, at 20,000 chunks / 642 documents. Per synthetic chunk: **7.83 KB** heap +
**7.99 KB** index.

### ⛔ The 250k build does NOT fit on this machine — say the number, not "it's fine"

| | |
|---|---|
| Extrapolated 250k footprint | heap 1,938 MB + HNSW 1,951 MB = **3.80 GB** |
| Free on `C:` (measured) | **5.1 GB** |
| Extrapolated 250k wall time | synthesise ≈ 9.3 min + HNSW ≈ 4.1 min (n·log n) + copy 13 s ≈ **14 min** |

Time is not the problem; **disk is**. 3.80 GB against 5.1 GB free leaves ~1.3 GB on a
Windows **system** drive, before WAL from the bulk load and before the HNSW build's temp
space. ⚠ And the headroom does not recover: free space read **5.1 GB before the smoke
build and 5.1 GB after teardown** — Docker Desktop's WSL2 `vhdx` grows to a high-water
mark and `DROP DATABASE` does not shrink it. So every build permanently consumes its own
footprint from `C:` until the operator compacts the disk image.

**Proposal for 241-04: `--chunks 100000`** (≈1.5 GB, ≈4 min). The framing D-08 requires
is *selectivity measured at a feasible size*, and the measurement supports it directly:
**the collapse was already visible at 20k**, so the larger corpus buys curve legibility,
not the existence of the defect. If the operator frees ≥ 6 GB on `C:` first, 250k is
reachable — that is an operator decision, and it is named here rather than assumed.

### The mechanism is visible — the bench works

Driven through the **real** `match_document_chunks` as `authenticated`, with both GUC
forms set exactly as `_apply_rls_user_context` sets them, `k=20`, threshold 0.3,
`hnsw.ef_search = 40`:

| Tenant | share | returned | under-fill |
|---|---|---|---|
| `bench-skew_0.002` | 0.2% | **15/20** | **0.25** |
| `bench-skew_0.02` | 2% | 20/20 | 0.0 |
| `bench-skew_0.2` | 20% | 20/20 | 0.0 |
| `bench-filler` | 38% | 20/20 | 0.0 |

⚠ **This is a mechanism proof, not the verdict.** Scoring recall@k and under-fill is
241-01/241-03's job; this is only evidence that the bench can show what the live corpus
structurally cannot.

### Teardown — the operator's database is provably untouched

```
torn down: recall_bench is absent from pg_database
source before: {'documents': 159, 'chunks': 7953}
source after : {'documents': 159, 'chunks': 7953}
```

Independently re-derived after teardown on a fresh connection:
`pg_database` rows matching `recall_bench` → **0**; `datname` list →
`['_supabase', 'postgres', 'template0', 'template1']`; source `documents` → **159**;
source `document_chunks` → **7,953**. Both re-derived, never quoted from the plan.
`source_default_transaction_read_only` reported **`on`** by the server for the whole run
— the source was protected by Postgres, not by convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `--sigma` was a per-dimension sigma; it had to be a noise-to-signal norm ratio**
- **Found during:** Task 3, by running the bench rather than by reading it
- **Issue:** an embedding is unit-norm over 1536 dimensions, so a typical component is ~1/√1536 ≈ 0.026. A per-dimension σ = 0.15 adds noise carrying **~5.9× the norm of the signal**, producing near-random vectors. Measured: the nearest non-self neighbour sat at **0.1722** similarity — **below** `match_document_chunks`'s 0.3 threshold — so **every probe returned 0 rows, for every tenant including the 38% filler**. D-08 says explicitly that uniform random vectors make HNSW recall unrepresentative; the builder was producing exactly those.
- **Fix:** per-dimension σ is now `sigma × ‖v‖ / √d`, so `cos(v, perturbed) ≈ 1/√(1+σ²)` and the shipped default 0.15 gives ≈ 0.989. The measurement and the wrong number are written into the function's docstring so the distinction cannot be re-lost.
- **Files modified:** `scripts/build-recall-bench.py`
- **Commit:** `e33eeccb7`

⭐ **The tell was that even the 38% filler tenant returned 0/20.** Selectivity starvation
cannot produce that; a threshold rejecting everything can. Reading the failure as
"starvation, working as intended" was available and would have been wrong.

**2. [Rule 2 - Missing critical functionality] the stub `auth` schema had no grants**
- **Found during:** Task 3, on the first query issued as `authenticated`
- **Issue:** `asyncpg.exceptions.InsufficientPrivilegeError: permission denied for schema auth`. Real Supabase ships `GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role`; the stub omitted it. RLS policy expressions evaluate `auth.uid()` as the **calling** role, so **every** query the harness will make would have failed — while the build itself reported perfectly green.
- **Fix:** the prelude now grants `USAGE` on `auth` and `storage` and `SELECT` on `auth.users` / `storage.buckets` / `storage.objects` to the three Supabase roles, with the measured failure written beside it.
- **Files modified:** `scripts/build-recall-bench.py`
- **Commit:** `e33eeccb7`

**3. [Rule 1 - Bug] the source fence could be satisfied by a `def` line**
- **Found during:** Task 1 GREEN
- **Issue:** `_GUARD_CALL` matched `def assert_bench_target(`, so the guard's own definition satisfied the fence for anything inside the guard.
- **Fix:** `_DEF_LINE` exclusion.
- **Files modified:** `backend/tests/unit/test_241_bench_safety.py`
- **Commit:** `adb9a1ea9`

### Plan text corrected by measurement

- **"the ONE delta"** → **three** stubs plus one trigger drop. `full-schema.sql`'s
  cross-schema supplement was not in the plan's `<interfaces>` block. The
  security-bearing delta is still exactly one, which is the part that mattered.
- **`document_chunks` column list.** The plan's Task 2 lists `folder_id`,
  `source_connection_id`, `ingest_visibility`, `is_latest` and `metadata` as
  `document_chunks` columns. Measured: they are **`documents`** columns.
  `document_chunks` carries `id, document_id, user_id, content, chunk_index, embedding,
  created_at, search_vector, embedding_model, embedding_dimensions, org_id,
  embedded_at`. The copy is column-driven from `information_schema`, so it was
  unaffected — but the RPC's seven predicates read five of them off `documents`, and a
  hand-written column list would have been wrong.
- **`--report` shape.** Written to the scratchpad, not into the watched tree.

### Deliberate scope choices

- **`connector_connections.secret_ciphertext` and `oauth_client_secret_ciphertext` are
  redacted to NULL on copy.** A throwaway harness has no business holding tenant
  ciphertext, and nothing in the retrieval path reads either column.
- **`auth.users` copies `id` only** — no email, no password hash, no identity metadata.
  43 foreign keys need the ids and nothing else.
- **Generated and tsvector columns are excluded from the verbatim copy** so the bench
  *computes* `document_type_norm`, `date_typed` and `search_vector` exactly as
  production does, rather than carrying copies of them.

## Verification

| Check | Result |
|---|---|
| `pytest tests/unit/test_241_bench_safety.py -q` | **21 passed** |
| `build-recall-bench.py --help` lists `--source-dsn --bench-dsn --chunks --skew --seed --teardown --report` | ✅ all seven, plus `--sigma --chunks-per-doc --batch-size --vector-pool --schema` |
| `grep -v '^\s*#' ... \| grep -c "embed_texts"` | **0** |
| `grep -v '^\s*#' ... \| grep -c "import numpy"` | **0** (`numpy` appears once, in prose explaining why it is not used) |
| `git status --short supabase/` | **empty** |
| No new Python package | ✅ `asyncpg` only, already a backend dependency |
| Backend gate: `pytest tests/unit -q --continue-on-collection-errors` | **71 failed · 4395 passed · 2 xfailed · 2 xpassed · 0 collection errors · 204.90 s** |

### The backend baseline gate, argued rather than asserted

The phase-start baseline (241-CONTEXT F-9) is **71 failed / 4374 passed / 2 xfailed /
2 xpassed / 0 collection errors**. This run: **71 failed / 4395 passed / 2 xfailed /
2 xpassed / 0 collection errors**.

- `failed` **unchanged at 71** — the ceiling holds with the zero headroom it has.
- `passed` **+21**, which is **exactly** the 21 cases in the one test file this plan
  adds. No pre-existing test changed outcome; the arithmetic has no residual.
- `grep -c "241_bench_safety"` over the sorted FAILED set → **0**. None of the 71 is mine.

⚠ **What was NOT done, stated rather than glossed:** no independent full-suite run at the
base commit inside this worktree, so the `comm -13` was not literally executed. The set
diff is argued from (a) the failed count being identical, (b) the passed delta equalling
the added case count exactly, and (c) no failing name belonging to a file this plan
touched. The plan's two new files are imported by nothing under `backend/app`.

⚠ **The 12 `ERROR` lines in the output are captured application log records**
(`run_producer`, `main`, `sandbox_service`), **not pytest collection errors** — the
summary line carries no `errors` term. Counting `^ERROR` and reporting 12 collection
errors would have been the `| tail`-shaped mistake in a different costume.

### Local infra

The stack was already up. `scripts/start-local-infra.ps1` could not be invoked (the
sandbox refuses `powershell` from this worktree agent), so the port was verified
directly: **54322, 54321 and 6379 all accept a real TCP connection**, and
`select version()` returned **PostgreSQL 17.6**. No port-reservation diagnosis applied —
nothing was refused.

## Notes for 241-04

1. ⛔ **This smoke build applied the CURRENT `full-schema.sql`.** Per D-12, 241-04 must
   rebuild **after** migration 176 has been pasted into the SQL editor and
   `bash scripts/regenerate-full-schema.sh` has folded it in. The bench reads that
   artifact, so regenerating it is not bookkeeping here.
2. **Use `--chunks 100000`, not 250000**, unless the operator frees ≥ 6 GB on `C:` first.
   Reason and numbers above.
3. **`--seed` is fixed at 241 by default** and the report records seed, sigma, the
   requested and achieved ladders, every stage timing and both size figures, so two
   builds can be diffed rather than argued about (T-241-12).
4. The teardown arm re-reads the source counts on both sides of the drop and exits
   non-zero if they differ — run it, do not assume it.

## Threat Flags

None. The plan's threat register is discharged as written: T-241-07 by the guard plus
the constant-interpolated statement plus the AST fence (all three driven RED);
T-241-08 by the server-enforced read-only source, proved by the count diff across the
whole run; T-241-09 by the refusal comment, the docstring repeat and the empty
`git status --short supabase/`; T-241-11 by measuring at 20k and **refusing** the 250k
extrapolation on disk headroom rather than shrinking the claim silently; T-241-12 by the
fixed seed and the JSON report; T-241-SC by installing nothing.

## Self-Check: PASSED

- `scripts/build-recall-bench.py` — FOUND
- `backend/tests/unit/test_241_bench_safety.py` — FOUND
- `dfa4390bf` (RED) — FOUND
- `adb9a1ea9` (GREEN, seam) — FOUND
- `f21a371e4` (GREEN, full builder) — FOUND
- `e33eeccb7` (smoke-build fixes) — FOUND
