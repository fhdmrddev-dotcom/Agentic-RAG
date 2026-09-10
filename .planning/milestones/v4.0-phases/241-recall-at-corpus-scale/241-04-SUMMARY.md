---
phase: 241-recall-at-corpus-scale
plan: 04
subsystem: retrieval-measurement
tags: [recall, pgvector, hnsw, verdict, seed-076, seed-197, seed-265, g-5, self-verification]
requires:
  - "scripts/measure-recall.py + app.services.recall_eval (241-01) — the instrument"
  - "scripts/build-recall-bench.py (241-02) — the subject"
  - "supabase/migrations/176_app_settings_hnsw_knobs.sql (241-03) — the remedy, applied by the operator here"
provides:
  - ".planning/phases/241-recall-at-corpus-scale/241-VALIDATION.md — the verdict"
  - ".planning/phases/241-recall-at-corpus-scale/reports/*.json — 26 attributed runs"
  - ".planning/seeds/SEED-265 — SC#2's two unbuilt axes, carried forward with a trigger"
  - "supabase/full-schema.sql with migration 176 folded in"
affects:
  - "SEED-076 (partially-shipped; its lever ordering REFUTED by measurement)"
  - "SEED-197 (folded, deliberately still planted — the exposure was removed, not the ceiling)"
  - "docs/HOT-FILE-LEDGER.md + CLAUDE.md scan list (7 triples re-derived, 1 row added)"
tech-stack:
  added: []
  patterns:
    - "the artifact is regenerated BEFORE the thing that reads it (D-12) — ordering, not bookkeeping"
    - "one probe-vector cache serves every run, so a delta is a configuration change and never embedding drift"
    - "a build-time guard asserts the READ as the real role, because schema-presence checks cannot see a privilege hole"
key-files:
  created:
    - .planning/phases/241-recall-at-corpus-scale/241-VALIDATION.md
    - .planning/seeds/SEED-265-narrow-a-search-by-connection-or-by-saved-view.md
    - .planning/phases/241-recall-at-corpus-scale/reports/ (27 files)
  modified:
    - supabase/full-schema.sql
    - scripts/build-recall-bench.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/seeds/SEED-076-filtered-vector-search-recall-pgvector-index-scale.md
    - .planning/seeds/SEED-197-embed-texts-sends-every-chunk-in-one-request.md
decisions:
  - "D-08 honoured: the verdict says selectivity-driven collapse at a FEASIBLE size, never a 10M-chunk install reproduced on a laptop"
  - "D-13 honoured: SC#2 scored honestly-partial; the two missing axes were NOT built, and the reason is written down"
  - "D-17 honoured: SELF-verification stated in VALIDATION.md's own first section"
  - "D-11 honoured: the ledger was re-derived LAST; retrieval_service.py still reads extraction still OWED"
  - "SEED-076's lever ordering is REFUTED: ef_search is the lever, iterative_scan is the companion"
  - "ef_search = 1000 is reproducibly WORSE than 400 — reported as measured and explicitly NOT explained"
metrics:
  duration: "~2h"
  completed: 2026-09-10
  tasks: 3
  commits: 5
---

# Phase 241 Plan 04: The Verdict — Summary

The defect SEED-076 predicted in June is real, and it is now a number anyone can re-run: at the
shipped `hnsw.ef_search = 40` a tenant owning 0.2% of a 100,000-chunk corpus gets **`recall@20 =
0.040`** with **96% under-fill**, and the ten evaluation probes that score `Hit@1 0.78` at 7,959
chunks score **`0.44`** at 100,000 — three named documents silently ceasing to be found, with no
error and a *faster* response. `ef_search = 200` restores every one of those numbers exactly.

⛔ **This plan self-verified its own phase.** No independent §6.3 reviewer exists for Phase 241.

## Task 1 — the operator gate

Discharged before dispatch and **verified rather than trusted** at the start of this plan.

| Check | Measured |
|---|---|
| `app_settings.hnsw_ef_search` | `integer`, nullable **YES** |
| `app_settings.hnsw_iterative_scan` | `text`, nullable **YES** |
| `app_settings_hnsw_ef_search_bounds` | `CHECK (IS NULL OR (>= 10 AND <= 1000))` |
| `app_settings_hnsw_iterative_scan_values` | `CHECK (IS NULL OR IN ('off','strict_order','relaxed_order'))` |
| Live values | both **NULL** — the fail-soft state; `_val` reads `config.py` |
| Local server | pgvector **0.8.0** · PostgreSQL **17.6** · `hnsw.ef_search = 40` · `hnsw.iterative_scan = off` |

⛔ **`supabase db push` and `db reset` were never run**, by me or by anyone. The migration reached
the database only through the operator's SQL-editor paste.

**Cloud parity, verbatim from the operator's cloud SQL editor:**

```json
{"pgvector":"0.8.0","postgres":"PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit",
 "forces_guc_registration":1,"ef_search":"40","iterative_scan":"off"}
```

**Exact parity with local. D-14's gate is SATISFIED** — `hnsw.iterative_scan` exists in production
and may be claimed as the remedy. The ROADMAP's fallback verdict does not fire.

**Cloud DSN: NOT supplied to the executor.** The cloud AS-IS recall row is recorded ⛔ **blocked**
with its reason and unblocking action, in VALIDATION.md and below. It was never dropped, and no
credential was sought from the environment.

## Task 2 — the local verdict

### Step 1 — regenerate, WITHOUT `--reset`

`bash scripts/regenerate-full-schema.sh` (no flag). **+18 lines, a regeneration and not a hand
edit:** two columns, two named CHECK constraints, two `COMMENT ON COLUMN` blocks, all inside the
existing `app_settings` DDL. `grep -c hnsw_ef_search supabase/full-schema.sql` → **4** (was 0).
Commit `d76686821`.

### Step 2 — the bench at 100,000 chunks

`--chunks 100000` per the operator's confirmed figure (`reports/bench-build.json`):

| | |
|---|---|
| Chunks / documents | **100,000 / 3,842** |
| `document_chunks` | **1,617.2 MB** · HNSW index **781.0 MB** |
| Per chunk | ≈ **16.6 KB** heap + **8.0 KB** index = **24.6 KB** |
| Skew achieved | 0.002 / 0.02 / 0.2 — **exact on all three rungs**, plus a 69.8% filler |
| Stage seconds | create 0.095 · apply 0.208 · copy 5.02 · synthesize 187.8 · HNSW 46.7 |
| Provider calls | **0** |

Reproducible: the second build produced **byte-identical tenant user-ids** to the first (seed 241).

### Step 3-5 — 26 measured runs, one cache

⭐ **One probe-vector cache served every invocation**, local and bench, before and after:
`reports/probe-vectors.json`, md5 **`5be60f80415a6a74b054e832653d5f48`**, **re-checked unchanged at
the end of the plan.** Without it every delta would be a mixture of the configuration change and
embedding non-determinism.

**Layer 1 — `recall_at_k` / `underfill`, shape `none`, k=20, 25 query vectors, seed 241**
(`reports/l1-*.json`):

| Tenant share | **ef 40 (SHIPPED)** | ef 100 | ef 200 | ef 400 | ef 1000 | relaxed@40 | ef400+relaxed |
|---|---|---|---|---|---|---|---|
| **0.2%** | **0.040 / 0.960** | 1.000 / 0.000 | 1.000 / 0.000 | 1.000 / 0.000 | 0.926 / 0.074 | 0.494 / 0.500 | 1.000 / 0.000 |
| **2%** | **0.068 / 0.932** | 1.000 / 0.000 | 1.000 / 0.000 | 1.000 / 0.000 | 0.926 / 0.074 | 0.564 / 0.434 | 1.000 / 0.000 |
| **20%** | **0.360 / 0.588** | 0.976 / 0.024 | 1.000 / 0.000 | 1.000 / 0.000 | 0.982 / 0.018 | 0.684 / 0.214 | 1.000 / 0.000 |

**Shapes `folder` / `metadata` / `source_system`: `recall_at_k = 1.000` in all 63 shape-runs.**
Their under-fill is non-zero only at the 0.2% tenant (0.054 / 0.056 / 0.116) and is **unchanged by
every knob** — genuine scope size, not index starvation. Reporting either column alone would have
confused the two.

**Layer 2 — the semantic probes** (`reports/l2-*.json`, `reports/control-*.json`):

| Run | Corpus | Hit@1 | MRR | Wall |
|---|---|---|---|---|
| Control — real DB, shipped | 7,953 chunks | 0.78 | 0.778 | 5.375 s |
| Control — real DB, re-check | 7,959 chunks | **0.78** | **0.778** | 0.484 s |
| **Bench 100k, shipped** | 100,000 | **0.44** | **0.444** | 0.141 s |
| Bench 100k, `ef_search 200` | 100,000 | **0.78** | **0.778** | 5.812 s |
| Bench 100k, `ef 200` + `relaxed_order` | 100,000 | 0.78 | 0.778 | 5.891 s |

Broke at scale, restored by the knob: `northwind-commercials-renewal.md`,
`Triangulation_Research_Complete_with_Visuals.docx`, `sample_master_rate_sheet.xlsx`.
⚠ Two probes miss at **both** sizes — pre-existing retrieval *quality* (SEED-020), not this defect;
counting them in would have overstated the collapse by two thirds. One target is **ABSENT** from
the database and is excluded from the metric, not scored as a miss.

## Task 3 — cloud, the verdict, the seeds, the ledger

- **`241-VALIDATION.md`** — SELF-verification stated in its own first section; the honest framing
  before any number; the before/after tables; SC#1/#2/#3 scored; the five ROADMAP failure
  conditions each answered with its report; seven OWED items stated as decisions.
- **`SEED-265` planted** — `status: planted`, trigger = *the first UI control, tool-schema
  parameter or workflow binding that would actually narrow a search by connection or by saved View.*
- **`SEED-076` → `status: partially-shipped`** (⚠ deliberately **not** `closed`), `folded_into: 241`,
  with a new `re_open_trigger_after_241` for lever 4 that is **measured rather than predicted** — it
  did NOT fire, because `ef_search = 200` reached 1.000 at every measured selectivity.
- **`SEED-197` → `status: planted`, ON PURPOSE**, `folded_into: 241`, `answered: 2026-09-10`. D-08
  **removed the exposure** (no bench path calls `embed_texts`; `provider_calls: 0`) and **did not
  fix the ceiling**. A seed closed because the folding phase declined to go near it is a deletion
  wearing a decision's clothes.
- **The ledger, re-derived LAST** — recipe run, never a figure copied.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] The bench built perfectly green and no one could read it**
- **Found during:** Task 2, on the harness's FIRST query — `42501 permission denied for table documents`.
- **Issue:** `supabase/full-schema.sql` is produced by `pg_dump --no-privileges`, so it carries **no
  table ACLs at all**, and default privileges live in `pg_default_acl`, which is **per-database** and
  therefore absent from a brand-new `recall_bench`. Measured: `public.documents.relacl` was `NULL`
  where the real database reads `{postgres=arwdDxtm/postgres,anon=…,authenticated=…,service_role=…}`.
  241-02 never hit this because its smoke queries went through `match_document_chunks`, which is
  `SECURITY DEFINER` and runs as the owner; the harness reads the tables directly as the caller.
- **Fix:** `PRELUDE_SQL` now installs the real database's own default privileges — **read back from
  `pg_default_acl`, not invented** — before the apply, so every table acquires them at CREATE time
  exactly as production does. Plus a build-time guard reading all four harness tables **as
  `authenticated`**, driven RED against the genuinely ungranted bench first.
- **Files:** `scripts/build-recall-bench.py`. **Commit:** `df416c927`
- ⚠ **This is not a defect in `full-schema.sql` as a Supabase one-paste bootstrap** — a real
  Supabase project already carries those default privileges. It is a finding about building a
  **plain** Postgres database from the artifact.

**2. [Rule 1 — Bug] `full-schema.sql:33` leaves RLS disabled on the session that applies it**
- **Found during:** the fix above — the second refusal was different from the first:
  `query would be affected by row-level security policy for table "documents"`.
- **Issue:** pg_dump emits `SET row_security = off;` and it is a **SESSION** setting. It survives
  the apply, so every later statement the builder issues on that connection runs with RLS disabled.
  Harmless for a one-paste deploy (the session ends); a live trap for a program that applies the
  artifact and keeps working. ⚠ It also makes a privilege refusal *look* like a grant refusal,
  which sends the next reader to the wrong fix.
- **Fix:** restored to the server default after the apply; the new guard also sets
  `SET LOCAL row_security = on` so it is self-defending.
- **Files:** `scripts/build-recall-bench.py`. **Commit:** `df416c927`

⭐ **Both were found by RUNNING the artifact, not reading it** — and 241-02 had already recorded
that its smoke build was *"the first thing that has ever exercised `full-schema.sql` end to end"*.
Two more defects surfaced the second time, on a path one grant wider.

### Plan text corrected by measurement

**3. ⚠⚠ The plan's cloud parity test was REFUTED, and it would have withdrawn a working remedy.**
`241-04-PLAN.md`'s `<interfaces>` says *"a NULL there IS the parity answer"* for
`current_setting('hnsw.iterative_scan', true)`. **False.** The `hnsw.*` GUCs register on first
extension use, so NULL is returned on pgvector **0.8.0** too in any session that has not touched a
vector op — proven against the LOCAL server of known version. The first cloud probe **did** return
`{ef_search: null, iterative_scan: null}`; read through the plan's rule that meant *"cloud is below
0.8, withdraw the remedy"* from a server at exact parity. A second, independent defect in the same
test: the block was four statements and the Supabase SQL editor returns only the **last** result
set, so the two statements that answer the question never came back. Full record and the corrected
single-statement probe: `241-PARITY-PROBE-CORRECTION.md`. ⭐ **The cost of catching it was one query
against a server of a KNOWN version, and that control was in hand the whole time.**

**4. The plan's Step 5 says the real corpus is "7,953 chunks". It is not one number.** The harness
reports the corpus **as the caller sees it under RLS** (155-156 documents / 7,953-7,957 chunks for
the measuring user); the raw table holds **159-160 / 7,955-7,959**. The gap is three leak-test orgs
left by Phases 117 and 217.1. Both readings are right and they answer different questions.

**5. `--chunks 250000` was not attempted.** 241-02 measured and refused it; the operator confirmed
100,000. Disk had since recovered to 52 GB free, but the confirmed number was used rather than
silently changed.

### Deliberate choices

**6. The `ef_search = 1000` anomaly was investigated and then left UNEXPLAINED.** It was
characterised (bimodal: 23 of 25 vectors perfect, two at `ann_size` 1-2) and its determinism was
established (a full re-run reproduced the same two vector indices exactly). A plan-level explanation
was attempted via `EXPLAIN` and **abandoned rather than guessed**: `match_document_chunks` is
`SECURITY DEFINER`, so an outer `EXPLAIN` shows only a function scan, and confirming the plan needs
`auto_explain` inside the function body. **Reporting an unexplained reproducible result beats
reporting a plausible mechanism nobody measured.**

**7. No cloud connection was opened at all.** No DSN was supplied and none was sought from the
environment. ⛔ No bench corpus was built in cloud Supabase.

## The four measured surprises

1. **The cloud parity test was wrong** (above) — it would have recorded a hardware limitation that
   does not exist, in a document nobody re-runs.
2. **`iterative_scan` alone is NOT sufficient** — 0.494 / 0.564 / 0.684 at the shipped `ef_search`,
   leaving 11-13 of 25 query vectors under-filled. **This reverses SEED-076 §3's lever ordering.**
3. **The curve is not monotone** — `ef_search = 1000` reproducibly worse than 400. ⛔ *"Set it as
   high as it goes"* is measurably wrong advice for this index.
4. **Adding a filter makes this product's search MORE accurate.** At the shipped configuration the
   20% tenant's `none` shape returns `ann_size` 4-17 of 20 while its own `folder`/`metadata`/
   `source_system` subsets return 20/20. **A superset returning fewer rows than its own subset is
   impossible under one execution plan** — so the narrowed shapes are not on the HNSW path, and the
   dangerous query is the broad one. Established by the recall data itself, not inferred from latency.

⭐ **And the reading lesson underneath all four:** an aggregate of `0.926` sounds healthy and
describes a system where two users in twenty-five get one or two results out of twenty. **Report
the per-vector spread, never the mean alone.**

## Gates

| Gate | Verdict (verbatim where the plan asks for it) |
|---|---|
| Backend | `71 failed, 4452 passed, 2 xfailed, 2 xpassed, 40 warnings in 182.83s` — **the ceiling exactly**, `grep -c "^FAILED "` = **71**, and pytest's summary carries **no `errors` term** (the 12 `^ERROR` lines are captured app log records, as 241-02 documented) |
| Hot-file ledger | `ledger gate OK — every watched file has a row.` (249 scan-list rows) · exit **0** |
| CLAUDE.md size | `claude-md size gate OK` · `87114 chars · 58.1% of limit · headroom 62886` · exit **0** |
| G-7 gap-closure | `G-7 clear — no gap-closure plans in this phase.` · exit **0** |
| Vitest count gate | ⛔ **RED**: `total 7940  ·  failed 3  ·  pinned total 7170` / `RESULT: COUNT GATE VIOLATED (1 reason(s))` / `FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.` · exit **1** |

### The backend set, argued rather than asserted

`failed` **71** and `passed` **4452** are both **identical** to the post-Wave-1 reading in
`241-WAVE1-GATES.md`. This plan added no test cases, so no residual is expected and none appears.
**No failing test is in a file this plan touched** (`grep -c` over the sorted FAILED set for
`bench_safety` / `recall_harness` / `hnsw_knobs` → **0**), and the 15 `test_retrieval_service.py`
failures are the inherited async-caller rot Wave 1 already proved predates the phase.
⚠ **What was NOT done:** no independent full-suite run at the base commit inside this session, so
`comm -13` was not literally executed. The argument is (a) identical counts on both sides, (b) zero
new test cases, and (c) `scripts/build-recall-bench.py` is imported by exactly one test file, which
passes 21/21. ⚠ The flaky `test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery`
did **not** fire on this run.

### The vitest red is inherited, and it was triaged before anything was re-run

Filenames taken from the gate's **own persisted JSON** first:

| File | Case | Signature |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door — flag ON (D-183-01) | `Error: STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — the page renders its heading | `Error: STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 — the four shipped tab triggers render | `Found multiple elements with the role "tab" and name "Documents"` |

**That table is identical — three cases, three signatures — to `241-03`'s red run and to SEED-171's
2026-09-06 sighting.** Reachability, not merely diff-cleanliness: **this plan's entire non-report
diff is two files** — `scripts/build-recall-bench.py` and `supabase/full-schema.sql` — and
`git diff --numstat 202e5dde4 HEAD -- frontend/` prints **nothing**. Neither a Python script nor a
`.sql` file can reach a vitest suite.

**The gate's OTHER contract held:** `[failing-tests]` was the only violation reason, and
`total 7940 / pinned 7170` are **identical** to the Wave-1 post-merge reading — **no per-file
decrease.** ⭐ Recorded as **provably unmodified**, never as "fine" — one green sample of a flaky
suite is not proof of innocence, and this was not even a green sample.

The cap was **not** touched. It stayed at `GSD_VITEST_MAX_WORKERS=2` throughout.

## Corpus provenance — and one number that moved

| | documents | chunks |
|---|---|---|
| **Start of plan** | **159** | **7,955** |
| **End of plan** (after teardown) | **160** | **7,959** |

⚠ **The corpus changed, and it was NOT the bench.** The delta is one document — a `.eml` message,
4 chunks, owned by the operator's own user, `source_connection_id IS NULL`, created
**`2026-09-10T04:00:56Z`**, inside the working window. The product ingested it via Phase 240's mail
path. It is not in the bench's naming scheme (`bench-<label>-<n>.txt`) and not in a `bench-*` org.

**T-241-20's property — the bench never wrote to the operator's database — holds, proven three ways:**

1. The source connection is opened with server-enforced `default_transaction_read_only = on`,
   reported back by the server as `on` for the whole run.
2. Every destructive statement interpolates a module constant behind `assert_bench_target(...)`,
   enforced by an AST source fence (`test_241_bench_safety.py`, **21 passed**).
3. **Each build re-read the source counts on both sides of its own work and both reported
   before == after** (159/7,955 then; 160/7,959 now).

**Teardown, verbatim:**

```
torn down: recall_bench is absent from pg_database
source before: {'documents': 160, 'chunks': 7959}
source after : {'documents': 160, 'chunks': 7959}
```

⭐ **A live dev database is not a frozen object.** Stating both readings and the cause is the honest
version of "unchanged"; asserting 7,955 at the end would have been false, and quietly re-baselining
would have hidden that the product was running.

## Security (threat register)

| Threat | Disposition |
|---|---|
| **T-241-20** data loss via `db push` / `db reset` | ⛔ **Neither was run.** `regenerate-full-schema.sh` ran WITHOUT `--reset`. Corpus provenance above. |
| **T-241-21** cloud DSN disclosure | **No DSN existed to leak** — none was supplied and none was sought. Sweep over this phase's files finds only loopback shapes: `postgresql://postgres:postgres@127.0.0.1:54322/{postgres,recall_bench}` and the refusal fixture `postgresql://nobody:x@127.0.0.1:1/none`. No cloud host, no cloud credential. |
| **T-241-22** harness writing to the live cloud DB | **Vacuously discharged — nothing connected to cloud.** The parity evidence came through the operator's SQL editor. |
| **T-241-23** forced sequential scan against cloud | **Vacuously discharged.** The forced-exact arm ran only against the local bench and the local real DB. |
| **T-241-24** a verdict nobody can re-run | VALIDATION.md carries the verbatim command for both environments; every one of the 26 reports carries seed, sample size, both server versions, the live and requested `hnsw.*` values and the corpus counts. |
| **T-241-25** a self-verification read as an independent review | **Stated in VALIDATION.md's own first section, in STATE.md, in the ROADMAP row and in this SUMMARY.** ⛔ No bus item routed `--to gemini`. 241 joins 238 and 240 in owing a §6.3 review. |
| **T-241-26** hand-editing `full-schema.sql` | Only ever produced by the script. The diff is `+18` lines inside the existing `app_settings` DDL — a regeneration, quoted above. |
| **T-241-SC** package installs | **None.** No Python package, no npm dependency, no `requirements.txt` change. |

## Known Stubs

None. Every artifact this plan produced is wired: the reports are cited by VALIDATION.md, the seeds
carry live triggers in their frontmatter, and the ledger rows point at their own sections.

## Threat Flags

None. This plan added no network endpoint, no auth path, no file-access pattern and no schema
change of its own. It regenerated a deploy artifact from a migration the operator applied by hand,
and it widened privileges **only inside a throwaway database that no longer exists**.

## What is OWED after this plan

1. **Cloud migration 176** at the next operator-triggered deploy — until then the Settings controls
   read `config.py`'s defaults in production and the knobs cannot be changed there.
2. **The cloud AS-IS number + D-15's proof the knobs change cloud behaviour** — blocked on a DSN;
   must reuse the same `--probe-cache` file, md5 `5be60f80415a6a74b054e832653d5f48`.
3. **An independent §6.3 review** of Phase 241.
4. **`retrieval_service.py`'s G-5 extraction** — `19 / 11 / 456`; a THIRD landing must propose it first.
5. **The `ef_search = 1000` non-monotonicity** — reproducible, unexplained.

## Self-Check: PASSED

Files verified present:
- `.planning/phases/241-recall-at-corpus-scale/241-VALIDATION.md` — FOUND
- `.planning/seeds/SEED-265-narrow-a-search-by-connection-or-by-saved-view.md` — FOUND
- `.planning/phases/241-recall-at-corpus-scale/reports/bench-build.json` — FOUND
- `.planning/phases/241-recall-at-corpus-scale/reports/probe-vectors.json` — FOUND (md5 unchanged)
- 24 `l1-*.json` / `l2-*.json` / `control-*.json` reports — FOUND
- `supabase/full-schema.sql` contains `hnsw_ef_search` — FOUND (4 occurrences)
- `docs/HOT-FILE-LEDGER.md` `retrieval_service.py` row contains `extraction still OWED` — FOUND
- `recall_bench` — CONFIRMED ABSENT from `pg_database` (intended)

Commits verified in `git log`:
- `d76686821` chore(241-04) regenerate full-schema.sql — FOUND
- `df416c927` fix(241-04) the bench was built green and was unreadable — FOUND
- `a984caeef` feat(241-04) the local verdict, 26 runs — FOUND
- `6f24ed719` docs(241-04) the verdict, the seeds answered, the ledger — FOUND
