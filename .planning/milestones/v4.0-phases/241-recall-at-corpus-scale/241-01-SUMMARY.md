---
phase: 241-recall-at-corpus-scale
plan: 01
subsystem: retrieval-measurement
tags: [recall, pgvector, hnsw, harness, tdd, honesty-guard]
requires:
  - "public.match_document_chunks (mig 154:148-174) — the seven-predicate DEFINER RPC under measurement"
  - "app.dependencies._apply_rls_user_context — the role + both-GUC-forms idiom, copied not re-derived"
  - "app.services.openai_service.embed_texts — probe embedding, called ONCE then cached"
provides:
  - "app.services.recall_eval — the ONE home for EVAL_PROBES, both measurement layers, RecallUnmeasurable"
  - "scripts/measure-recall.py — one CLI, --dsn driven, local and cloud, non-zero on unmeasurable"
  - "backend/tests/unit/test_241_recall_harness_honesty.py — the honesty guard on the canonical gate"
affects:
  - "241-02/03/04 — every later plan in this phase measures with this tool"
tech-stack:
  added: []
  patterns:
    - "Honest third state: could-not-measure raises and exits non-zero; it never shares an exit code with measured-and-fine"
    - "SET LOCAL planner GUCs inside the measuring transaction — revert at transaction end, cannot leak to another connection"
    - "Bind parameters for every filter value; the only interpolated SQL text is two allow-listed GUC values"
key-files:
  created:
    - backend/tests/unit/test_241_recall_harness_honesty.py
  modified:
    - backend/app/services/recall_eval.py
    - scripts/measure-recall.py
  deleted:
    - backend/tests/eval/test_retrieval_recall_baseline.py
    - backend/tests/eval/__init__.py
decisions:
  - "D-01/D-16 honoured: EVAL_PROBES has one definition site; the CLI imports it; no module-scope DSN survives"
  - "D-02 honoured: a miss is None and there is no code path that assigns a miss the value 1"
  - "D-03 honoured: RecallUnmeasurable raises; the CLI prints to stderr, writes no report, exits 2"
  - "A raw-bytes md5 is NOT a sound restoration proof in this repo — git checkout rewrites LF to CRLF. Proof switched to git blob hash + empty diff"
  - "The Case E fence was corrected from a line-anchored regex to an AST read after it fired on correct code"
metrics:
  duration: "~25 min"
  completed: "2026-09-10"
  tasks: 3
  commits: 3
---

# Phase 241 Plan 01: The Recall Measurement Summary

Replaced a harness that could only print `MRR 1.000` with one that raises `RecallUnmeasurable`
and exits non-zero when it cannot honestly produce a number — pinned by a guard driven RED against
two planted defects and restored by hash.

## What was built

**`backend/app/services/recall_eval.py`** (67 → 981 L) — the one home.

- `EVAL_PROBES` — the ONLY definition site. It was duplicated verbatim across this module and
  the CLI; the CLI now imports it.
- `compute_metrics` — **kept BYTE-IDENTICAL**, proof below. It already treated `None` as a miss
  and its arithmetic was already right; the defect was entirely in what fed it.
- `RecallUnmeasurable(RuntimeError)` — raised on every failure to reach the database, establish
  the caller's role, read the server's configuration, sample query vectors, or obtain probe
  vectors. No function in the module returns metrics on an error path and none prints.
- `FILTER_SHAPES` — the three reachable SC#2 axes plus a baseline, as data: `none`, `folder`
  (`p_folder_ids`), `metadata` (`document_type`), `source_system` (nested jsonb containment under
  `source`). Live values are bound at run time; a shape whose axis has no live value is **skipped
  with a stated reason**, never silently dropped and never scored.
- `measure_layer1` — for each query vector × shape, calls `match_document_chunks` **twice with
  identical arguments**: an *exact* arm with `enable_indexscan` / `enable_indexonlyscan` /
  `enable_bitmapscan` all `off` (forced sequential scan ⇒ true k-NN), and an *ann* arm with the
  planner untouched plus the caller's `hnsw.ef_search` / `hnsw.iterative_scan`. Reports
  `recall_at_k = |ann ∩ exact| / |exact|` on chunk ids and `underfill = 1 − |ann|/k`.
- `measure_layer2` — the ten probes at `match_count = k`, chunk hits collapsed to first-occurrence
  document order, the target's 1-based position scored **or `None`**. Probes whose target is not
  in the database at all are reported as `target_missing` and **excluded from the metric rather
  than scored as misses** — "the document is not here" and "retrieval did not find it" are
  different facts.
- `run_measurement` — the one entry point; gathers server + corpus provenance, runs the requested
  layers, returns a report or raises.

**`scripts/measure-recall.py`** (155 → 258 L) — a thin CLI with no measurement logic. Required
`--dsn` (the hardcoded local DSN is deleted, not defaulted), `--user-id`, `--layer`, `--k`,
`--ef-search`, `--iterative-scan`, `--query-vectors`, `--query-vector-seed`, `--probe-cache`,
`--label`, `--json-out`.

**`backend/tests/eval/` — deleted.** Its `assert count == 77` was RED against 159 live documents
and invisible to `pytest tests/unit`; its only measurement asserted against a literal rank list.
The three genuine `compute_metrics` cases moved onto the canonical gate in Task 1.

## The RED drives — three of them, all against planted defects

### Task 1 — the guard authored first, RED before any Task-2 source existed

`15 failed, 8 passed`. Each honesty property failed by its own name:

| Case | Failing test | Reason |
|---|---|---|
| A miss arm | `test_a_absent_target_scores_none_not_rank_one`, `test_a_empty_result_set_scores_none`, `test_a_a_miss_drags_hit_at_1_below_one`, `test_a_repeated_document_collapses_to_first_occurrence` | `ImportError: cannot import name 'score_probe_ranks'` |
| B source fence | `test_b_no_rank_is_one_in_measure_cli` | the shipped `rank`-is-one assignment in `measure-recall.py` |
| B source fence | `test_b_no_synthetic_rank_fallbacks[mock_ranks]` | the hardcoded synthetic benchmark |
| C refusal | `test_c_unreachable_dsn_raises_recall_unmeasurable`, `test_c_refusal_names_the_host_and_never_the_password`, `test_c_recall_unmeasurable_is_an_exception` | `ImportError: cannot import name 'RecallUnmeasurable'` |
| C refusal | `test_c_describe_dsn_drops_the_password` | `ImportError: cannot import name 'describe_dsn'` |
| D exit code | `test_d_cli_returns_non_zero_on_unreachable_dsn`, `test_d_cli_refusal_does_not_leak_the_password` | `TypeError: main() takes 0 positional arguments but 1 was given` |
| E one home | `test_e_cli_imports_eval_probes_rather_than_redefining_them` | the CLI owned a second `EVAL_PROBES` copy |
| E one home | `test_e_cli_imports_from_the_one_home` | no import from `app.services.recall_eval` |
| E one home | `test_e_no_hardcoded_dsn_in_either_file` | the module-scope DSN constant |

⛔ **The module asserts no corpus size, no document count, no recall threshold and no live
database fact** — verified by reading the file. The only numbers it pins are the arithmetic
(`0.25 / 0.50 / 0.75 / 0.425`, the all-ones case, the empty case, the all-misses case) and set
sizes it constructs itself. It imports nothing from `backend/tests/eval/`.

### Plant 1 — the miss arm returns a hit

Planted in the committed file: `rank_target`'s miss branch changed from `else None` to `else 1` —
verbatim the D-02 defect.

```
FAILED test_a_absent_target_scores_none_not_rank_one
FAILED test_a_empty_result_set_scores_none
FAILED test_a_a_miss_drags_hit_at_1_below_one
3 failed, 5 passed
```

### Plant 2 — the refusal manufactures a number

Planted: `run_measurement` wrapped so `RecallUnmeasurable` is swallowed and a synthetic report
carrying `compute_metrics([1,1,2,1,1,3,2,1,1,2])` is returned — verbatim the Phase 230 fallback.
**It fired on BOTH arms**, the module refusal and the CLI exit code:

```
FAILED test_c_unreachable_dsn_raises_recall_unmeasurable
FAILED test_c_refusal_names_the_host_and_never_the_password
FAILED test_d_cli_returns_non_zero_on_unreachable_dsn
3 failed, 21 passed
```

### Restoration — proved by hash, not by colour

| | pre-plant | post-restore |
|---|---|---|
| `backend/app/services/recall_eval.py` (git blob) | `a7315e5ad539e5d8237858cd944fdb54ffc958a5` | `a7315e5ad539e5d8237858cd944fdb54ffc958a5` |
| `scripts/measure-recall.py` (git blob) | `96f5241ec9ea32cb6658c0b006b367290a9e5a3c` | `96f5241ec9ea32cb6658c0b006b367290a9e5a3c` |
| `git status --short` | — | **empty** |
| `git diff --stat <file>` | — | **empty** |

Guard re-run after restoration: **24 passed**.

⚠ **THE PLAN'S PROOF METHOD WAS UNSOUND ON THIS REPO AND THE CORRECTION IS RECORDED RATHER THAN
QUIETLY SUBSTITUTED.** The acceptance criterion asked for an md5 of the file, recorded before
planting and re-checked after. Measured: pre-plant md5 `56edcda70a39c45ca48b94ddde4ad7b9`,
post-restore md5 `a61fe1e5d23f1ca4a941eb1560a8e0c6` — **different, on a byte-identical file**.
The cause is `core.autocrlf`: the file as authored has LF endings, `git checkout --` writes it back
with CRLF, and a raw-bytes md5 sees that as a changed file. An executor trusting the md5 alone
would have concluded the restoration failed and started "fixing" a file that was already correct.
**`git hash-object` (line-ending-normalised) and an empty `git diff --stat` are the sound proof
here, and both are quoted above.** A later plan in this phase should use the blob hash.

## compute_metrics kept byte-identical

Extracted with `ast.get_source_segment` so the proof is reproducible and position-independent:

| segment | chars | md5 before | md5 after |
|---|---|---|---|
| `compute_metrics` | 714 | `59798972b791a78f8f14538bab59af64` | `59798972b791a78f8f14538bab59af64` |
| `EVAL_PROBES` | 1466 | `77a5b83ccac343781056c23379c1f650` | `77a5b83ccac343781056c23379c1f650` |

## Acceptance evidence

| Criterion | Result |
|---|---|
| `pytest tests/unit/test_241_recall_harness_honesty.py` | **24 passed** |
| Unreachable-DSN CLI invocation | **exit code 2**; stdout contains none of `Hit@1`, `Hit@5`, `MRR`, `recall@`; refusal on stderr; no JSON written |
| `--help` lists `--dsn --layer --k --ef-search --iterative-scan --label --json-out` | yes (plus `--user-id`, `--query-vectors`, `--query-vector-seed`, `--probe-cache`) |
| `grep -c "postgresql://" scripts/measure-recall.py` excluding `#` lines | **0** |
| `grep -n "postgresql://" backend/app/services/recall_eval.py` | **no output** |
| `backend/tests/eval/test_retrieval_recall_baseline.py` | **deleted** (`git status` shows `D`, not emptied); directory removed with it |
| `node scripts/check-hot-file-ledger.cjs --files backend/app/services/recall_eval.py` | **ledger gate OK** — row present, left untouched per the plan (241-04 re-derives the triple LAST) |
| No new Python package | diffstat touches 5 files, none of them `requirements.txt` |

### Backend baseline gate — the ceiling held with zero headroom

| | base commit `0ce1a7c43` | after this plan |
|---|---|---|
| failed | **71** | **71** |
| passed | 4374 | **4398** |
| xfailed / xpassed | 2 / 2 | 2 / 2 |
| collection errors | 0 | **0** |

**Failing NAME SET diffed both directions — `comm -13` empty AND `comm -23` empty.** The count was
never derived from `| tail`; the full set was extracted with `grep "^FAILED "` and sorted, and the
set is what was compared. `+24` passed is exactly the honesty guard's 24 cases, with no residual.

⚠ **A trap in that comparison, recorded because it looked like drift and was not.** The first
`comm` reported two test ids as "new" and two as "gone" — the same two ids. pytest interleaves
`RuntimeWarning` text directly onto a `FAILED` line with no separator (`...data_is_noneC:\Vibe
Apps\...`), and the warning names a different coroutine on each run, so the raw lines differ while
the node ids do not. Normalising the interleaved path text away makes both diffs empty. A set
comparison on raw pytest output is not reliable; strip the warning tail first.

## Deviations from Plan

**1. [Rule 3 — blocking] Task 2's acceptance ("the suite exits 0") is unreachable at Task 2.**
Seven of the guard's cases pin `scripts/measure-recall.py`, which Task 3 rewrites. Task 2 took the
suite from `15 failed` to `7 failed / 16 passed` — every Case A and Case C case green, all seven
survivors naming the CLI — and Task 3 took it to `24 passed`. No code was bent to close the gap
early. Commits: `be02f6c09`, `7b861326b`.

**2. [Rule 1 — bug in my own Task-1 fence] The Case E fence read formatting, not meaning.**
`test_e_cli_imports_eval_probes_rather_than_redefining_them` required `EVAL_PROBES` to sit on a
line *starting* with `from`/`import`. The CLI's import is a parenthesised multi-line block — the
house idiom — so the fence went **red on correct code**. It would also have gone *green* on the
token appearing in a comment beside an `import` keyword. Corrected to read the module's **AST**
(`ast.ImportFrom` aliases from `app.services.recall_eval`, and module-scope `ast.Assign` targets),
which asserts the fact D-01 actually claims and cannot be fooled in either direction. A `tmp_path`
positive control drives both helpers against a synthetic file. Commit: `7b861326b`.

⭐ This is the same failure class the project already paid for twice, arriving from the opposite
side: Phase 240's `'"user_id"' in body` fence stayed green when the real call was deleted because
a neighbouring line carried the string, and Phase 235's `data-testid` presence assertion could not
see content drift. **A fence that matches text rather than structure fails in both directions.**

**3. [Rule 2 — missing critical functionality] Password redaction added to the refusal path.**
T-241-01 asks that the DSN's password never reach a report, a printed line or an exception message.
`describe_dsn` covers what the harness composes, but a *driver* exception composes its own text and
can quote the connection it failed on. `_redact` removes the password substring from any driver
message before it is surfaced, and two guard cases assert the credential appears in neither stream.
A redaction that runs beats an assumption that does not.

## Threat model — dispositions applied

| Threat | Applied |
|---|---|
| T-241-01 information disclosure (DSN) | `describe_dsn` drops user + password; `_redact` strips the password from driver messages; the report carries host/port/database only. Asserted by `test_c_describe_dsn_drops_the_password`, `test_c_refusal_names_the_host_and_never_the_password`, `test_d_cli_refusal_does_not_leak_the_password` |
| T-241-02 SQL injection (filter shapes) | Every filter value is an asyncpg bind parameter; the `jsonb` argument is passed as a Python object and encoded ONCE by a codec registered exactly as the app's pool registers it (a pre-encoded string would double-encode). No f-string builds a `WHERE`. The only interpolated SQL text is `hnsw.ef_search` (through `int()` and a 1..10000 range) and `hnsw.iterative_scan` (a closed allow-list) — an unknown value refuses |
| T-241-03 elevation (synthesized claims) | Accepted per the plan. The idiom is copied verbatim from `dependencies.py:145-155`, never re-derived, with a comment stating why an owner-role measurement would read as total recall failure |
| T-241-04 DoS (forced sequential scan) | Planner GUCs are `SET LOCAL` inside the measuring transaction only; the Layer-1 sample is bounded by `--query-vectors` (default 25); per-shape and total wall time are in the report |
| T-241-05 information disclosure (chunk content) | The RPC projection selects `id`, `document_id` and `similarity` only — never `content`. Recall is computed on id sets; the report stores ids, filenames and set sizes |
| T-241-06 repudiation | Every report carries the label, the ISO timestamp, host+database, the server's PostgreSQL and pgvector versions, the live `hnsw.*` values, the corpus counts, and the query-vector sample size and seed |
| T-241-SC package installs | **No package installed.** The diffstat touches 5 files and `requirements.txt` is not among them |

## Known Stubs

None. Every function in `recall_eval.py` is wired: `run_measurement` drives both layers, the CLI
drives `run_measurement`, and the guard imports the module directly.

⚠ **What is NOT claimed:** no live smoke run against the real local database was performed, and
none is claimed. The plan states explicitly that 241-04 takes the verdict. The only database
interaction exercised here is the *refusal* path against an unreachable DSN, which is real (a
genuine `ConnectionRefusedError [WinError 1225]`, not a mock). Layer 1 and Layer 2 have never been
run against live data — **241-04 is where they are first exercised, and it should expect to find
things.**

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file-access pattern and no schema
change. It opens outbound Postgres connections to an operator-supplied DSN from an operator shell
that already holds that DSN.

## Notes for the next plan

- **The probe-vector cache defaults to
  `.planning/phases/241-recall-at-corpus-scale/probe-vectors.json`** and does not exist yet. The
  first Layer-2 run embeds the ten probe strings in one request and writes it; **every later run,
  and the cloud run, must reuse that file** — identical query vectors are the only thing that makes
  before/after and local/cloud comparable. If the cache is absent and embedding is unavailable, the
  harness refuses rather than substituting a vector.
- **`--user-id` is load-bearing and easy to get wrong.** A measurement taken as `postgres`/owner
  returns zero rows and reads as total recall failure, because `auth.uid()` is NULL inside the
  DEFINER body. Pass a real user id that owns documents.
- **`|exact| = 0` is a legitimate outcome** for some query vectors (the `match_threshold`
  predicate) and is reported as `null` with a reason, never as `1.0`. A shape where *every* vector
  hits that case reports `recall_at_k: null` plus a reason — read the reason, do not read it as a
  failure to measure the index.
- **Two SC#2 axes are deliberately not built** (connection-by-id, saved View) per D-13. The
  deferred-items seed for them is still owed by a later plan in this phase.

## Self-Check: PASSED

- `backend/app/services/recall_eval.py` — FOUND
- `scripts/measure-recall.py` — FOUND
- `backend/tests/unit/test_241_recall_harness_honesty.py` — FOUND
- `backend/tests/eval/test_retrieval_recall_baseline.py` — CONFIRMED ABSENT (intended)
- `backend/tests/eval/__init__.py` — CONFIRMED ABSENT (intended)
- commit `4785fb7b3` — FOUND
- commit `be02f6c09` — FOUND
- commit `7b861326b` — FOUND
