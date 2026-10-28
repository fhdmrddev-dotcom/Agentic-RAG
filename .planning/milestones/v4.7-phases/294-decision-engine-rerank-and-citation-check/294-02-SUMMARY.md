---
phase: 294-decision-engine-rerank-and-citation-check
plan: 02
subsystem: retrieval
tags: [measurement, recall, rerank, held-out, decision-engine]

requires:
  - phase: 294-01
    provides: rerank_engines package, capture_engine_calls / EngineCall, local.warm, compute_token_cost_usd_unquantized
  - phase: 241
    provides: recall_eval (EVAL_PROBES, compute_metrics, RecallUnmeasurable, describe_dsn) and the refusal-exit contract
provides:
  - "frozen held-out set decision_heldout_v1.json (57 items) + sha256 sidecar, pinned LF by .gitattributes"
  - "scripts/build-decision-heldout.py (--select to the scratchpad, --freeze with the 6-word verbatim check)"
  - "app/services/decision_eval.py: load_heldout, measure_arm, compare_arms, run_decision_measurement, ArmUnmeasured"
  - "scripts/measure-decision-engines.py: exit 0 + report, exit 2 + nothing written"
  - "294-MEASUREMENT.md + 294-measurement.json: per-engine numbers at pool 20 / top_k 5"
  - "SEED-020 routed (partially-answered, folded_into 294)"
affects: [294-04 settings engine copy, 294-05 live drive and M1 re-run]

tech-stack:
  added: []
  patterns:
    - "freeze-first: fixture + sha256 committed before the harness that reads it; harness refuses a mismatch"
    - "a fallback arm is UNMEASURED, never measured (a fallback returns exactly rerank-off)"
    - "chunk targets identified by (document_id, chunk_index, content sha256)"

key-files:
  created:
    - scripts/build-decision-heldout.py
    - backend/tests/unit/fixtures/decision_heldout_v1.json
    - backend/tests/unit/fixtures/decision_heldout_v1.sha256
    - backend/tests/unit/test_294_heldout_frozen.py
    - backend/app/services/decision_eval.py
    - scripts/measure-decision-engines.py
    - backend/tests/unit/test_294_decision_eval.py
    - .planning/phases/294-decision-engine-rerank-and-citation-check/294-MEASUREMENT.md
    - .planning/phases/294-decision-engine-rerank-and-citation-check/294-measurement.json
  modified:
    - .gitattributes
    - .planning/seeds/SEED-020-retrieval-quality-audit.md

key-decisions:
  - "294-02: a chunk target is (document_id, chunk_index, chunk_sha256); (document_id, chunk_index) is not unique locally (1,200 duplicated pairs)"
  - "294-02: an arm stops early only when its first 3 searches all fell back; any fallback makes the arm UNMEASURED"
  - "294-02: probe-target documents are excluded from the chunk sample so chunk items cover other documents"
  - "294-02: --dsn, when given, must name the same database as POSTGRES_DSN (the search path's database), else the run refuses"

requirements-completed: []  # DEC-02 is this plan's share only; REQUIREMENTS.md stays Pending until plans 04 and 05 land

duration: 85min
completed: 2026-10-20
---

# Phase 294 Plan 02: Frozen held-out set, decision_eval harness, engine measurement Summary

**A 57-question held-out set frozen under sha256 `bbbd6bdd…3d796` before any engine ran, a harness that drives the real hybrid search per engine and refuses rather than invents, and the measured result: Local, Jev and Cohere each lift recall from 73.7% to 80.7% with no flips; Jev cuts chunks but costs $0.00020713 more than it saves per search; OpenAI Decisions is UNMEASURED (403, no model access).**

## Base and worktree

- The worktree landed on `master` (`be7f4177a`). It was reset with `git reset --hard cbec70d41` before any work, as instructed (fresh worktree, nothing lost; `.claude/settings.local.json` was copied aside and restored, it is not part of any commit). `git log --oneline -1` then showed `cbec70d41`.
- `bash scripts/bootstrap-worktree.sh` → BOOTSTRAP OK.

## Task Commits

1. **Task 1: freeze the held-out set** — `729e1be19` `test(294-02): freeze the decision held-out set (sha256 bbbd6bdd…)` (fixture, sidecar, build script, frozen test, `.gitattributes`)
2. **Task 2: harness + CLI** — RED `0f7575f6e`, GREEN `45f840c1c`
3. **Task 3 fix (Rule 3)** — `f5ff2214e` `fix(294-02): load backend/.env when the measurement CLI runs from the repo root`
4. **Task 3: report + SEED-020** — `0b1b772ad`

Freeze order proven: `git merge-base --is-ancestor 729e1be19 45f840c1c` and `… 729e1be19 0b1b772ad` both true.

## The held-out set

- **sha256:** `bbbd6bddc437356fa7fd6efc88e299926543fc452beb87f967fb99d917b3d796` (sidecar matches `sha256sum`).
- 57 items: 48 chunk questions (one per document, seeded 294, stratified by file type, chunks ≥ 300 characters) and 9 of the 10 `EVAL_PROBES` verbatim. `2026 Q3 board pack.pdf` is not in the local DB; it is recorded in `unresolved_probes`, not dropped.
- Questions were written from chunk text only, in the scratchpad, before any harness or engine code existed. Two drafts were rejected by the 6-word check and rewritten (`c38`, `c39`); the final freeze output:

```
[build-decision-heldout] read 127.0.0.1:54322/postgres
  items: 57 (48 chunk, 9 probe)
  items rejected for a 6-word verbatim run: 0
  UNRESOLVED probe target: 2026 Q3 board pack.pdf
  sha256 bbbd6bddc437356fa7fd6efc88e299926543fc452beb87f967fb99d917b3d796
```

- The raw chunk dump stayed in the scratchpad; the script refuses an `--out` inside the repository. The fixture holds questions, ids and hashes only (a test pins that no `content` key exists).

## Measurement (pool 20, top_k 5, hybrid on, main model deepseek-v4-flash at $0.30 / 1M input)

| Arm | Recall | vs off | Recall gate | Chunks | Chunks gate | Cost gate | Latency p50 / p95 | Flips |
|---|---|---|---|---|---|---|---|---|
| off | 73.7% (42/57) | — | — | 4.54 | — | — | — | — |
| local | 80.7% (46/57) | +7.02 pp | pass | 4.54 | N/A (reorders only, D-08) | N/A (reorders only, D-08) | 18,499 / 121,620 ms | none |
| jev | 80.7% (46/57) | +7.02 pp | pass | 4.02 | pass | **fail**: costs $0.00020713 more than it saves per search; breaks even at 11 re-sends | 773 / 927 ms | none |
| openai_decisions | **UNMEASURED** | | | | | | | engine fell back on 3 of 3 searches (stopped early); `HTTPStatusError:403`, vendor text *"The project does not have access to this model."* |
| cohere | 80.7% (46/57) | +7.02 pp | pass | 4.54 | N/A (reorders only, D-08) | N/A (reorders only, D-08) | 830 / 1,658 ms | none |

- Local model download + load (first use): **51.5 s**, done as a warm-up before the run; inside the run it loaded from disk in 17.9 s. Whole run 1,633 s, of which the Local arm was 1,509 s.
- Keys: preflight found keys for all three hosted engines (presence only, never values). The OpenRouter key resolved through the settings loader although research recorded the DB column as empty, so it most likely comes from the `.env` fallback; plan 05 should confirm where it lives before the live drive.
- Full table, the ranked metrics, the four shared gains and the cost explanation: `294-MEASUREMENT.md`.

## Targeted test results

- `pytest tests/unit/test_294_decision_eval.py tests/unit/test_294_heldout_frozen.py tests/unit/test_241_recall_harness_honesty.py tests/unit/test_257_single_token_conversion_home.py` → **65 passed**.
- RED run before the harness existed: 25 failed (all of `test_294_decision_eval.py`).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/294-decision-engine-rerank-and-citation-check` → ledger gate OK.
- `node scripts/check-seeds-register.cjs` → OK (371/371).
- Full backend baseline NOT run (orchestrator runs it once after the wave merges, as instructed).

Tampered-copy drive (one byte changed in a scratchpad copy, sidecar copied beside it):

```
[measure-decision-engines] REFUSED: could not measure: the held-out set's sha256 b925d81f6631f5a9ff96b01f5965f44b343e7f7d497d7c7115e4db493a0a7ed7 differs from the committed sidecar bbbd6bddc437356fa7fd6efc88e299926543fc452beb87f967fb99d917b3d796; the frozen questions were changed (D-18)
[measure-decision-engines] no number was produced and no report was written.
exit=2
```

The directory afterwards held only the two copied files.

Acceptance greps: `recall_eval.py` diff vs `cbec70d41` empty; `grep -c "costs \$" decision_eval.py` = 2; "more than it saves per search" present; `save_app_settings` count 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chunk targets were ambiguous by (document_id, chunk_index)**
- **Found during:** Task 1 freeze (item `c39` failed the "still matches the database" check).
- **Issue:** the local DB has 1,200 duplicated `(document_id, chunk_index)` pairs (for example a table chunk and a text chunk both at index 0), so the plan's "exact {document_id, chunk_index}" would count a different chunk as found.
- **Fix:** a chunk item is found only when document, index AND content sha256 all match; the freeze check reads every chunk at that index and matches by hash. Recorded in the fixture's selection text.
- **Files:** `scripts/build-decision-heldout.py`, `backend/app/services/decision_eval.py`. **Commit:** `729e1be19`, `45f840c1c`.

**2. [Rule 2 - Correctness] The fixture's hash would break on a Windows checkout**
- **Issue:** `core.autocrlf=true` here, so a fresh checkout would rewrite the LF fixture as CRLF and the sha256 would no longer match.
- **Fix:** `.gitattributes` pins `eol=lf` on the fixture and sidecar (the Phase 266 corpora precedent); a test asserts the bytes have no `\r`. `.gitattributes` is outside `files_modified`. **Commit:** `729e1be19`.

**3. [Rule 3 - Blocking] The CLI could not load the backend config from the repo root**
- **Found during:** Task 3, first live run: `REFUSED: could not measure: the backend configuration did not load (ValidationError)`, exit 2, nothing written (the refusal branch worked as designed).
- **Issue:** `app.config` reads `.env` relative to the CWD.
- **Fix:** the CLI loads `backend/.env` with `override=False`, only under `__main__`. **Commit:** `f5ff2214e`.

**4. [Rule 2 - Honesty] Two extra arm refusals beyond the plan's list**
- An arm whose engine was never called on a search that returned passages is UNMEASURED (it would measure rerank-off, the Pitfall 5 shape). The harness also refuses the whole run when a frozen target is no longer in the database, or when `--dsn` names a different database from `POSTGRES_DSN`.

**5. [Detail] Early stop**
- An arm stops after its first 3 searches if all 3 fell back (OpenAI's 403 would otherwise be repeated 57 times). Any later fallback still makes the arm UNMEASURED, with the "fell back on N of M searches" reason.

**6. [Detail] Cohere was measured**
- The plan's arms were off, local, jev, openai_decisions, with Cohere only when a key exists. A Cohere key resolved, so `--arms` included `cohere` and it has a row.

**7. [Detail] Fixture path**
- RESEARCH named `backend/tests/fixtures/`; the plan's `files_modified` names `backend/tests/unit/fixtures/`. The plan's path was used.

---

**Total deviations:** 3 auto-fixed issues, 4 recorded details. **Impact:** no scope change; every must-have holds.

## TDD Gate Compliance

Task 2: `test(294-02)` RED `0f7575f6e` (25 failed) then `feat(294-02)` GREEN `45f840c1c` (25 passed). Task 1's commit is the freeze itself (`test(…)` type, as the plan names it).

## Facts plans 04 and 05 need

- **OpenAI Decisions:** the configured OpenAI key's project returns 403 *"The project does not have access to this model."* for `gpt-6-luna`. Operator action: enable Decisions access for that project or store a key that has it, then run 294-VALIDATION row M1 (`--arms off,openai_decisions`). The probe script used to read the vendor text is at `C:/Users/fhdmr/AppData/Local/Temp/claude/C--Vibe-Apps-Agentic-RAG/1d3cea47-3a25-4e59-afa1-8008ae0db94d/scratchpad/openai_403_probe.py` (prints status and vendor error fields only, never the key).
- **LangSmith:** tracing was on, but the configured key got `403 Forbidden` on `runs/multipart` for every batch, so no trace from this run reached LangSmith. The D-19 trace check stays with plan 05, and the LangSmith key needs fixing first.
- **Settings copy (plan 04):** on this CPU-only box Local adds a median of 18.5 s per search (p95 121.6 s). Jev against a cheap main model costs more than it saves per search (break-even 11 re-sends); the same cut is worth more against a dearer main model. Both facts belong near the engine cards.
- **Local warm-up:** the weights are now in the Hugging Face cache on this machine (first download + load 51.5 s), so the live drive will not pay the download again.
- **Re-run:** the harness caches query vectors at `%TEMP%/agentic-rag-294-decision-vectors-v1.json` (outside the repo); a re-run reuses them, so arms stay comparable.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The real candidate passages left the box during the jev and cohere arms and the first three (refused) openai_decisions searches (T-294 boundary "harness → hosted engines", accepted in the plan); no key is in the report or logs (the JSON was scanned for `sk-`, `api_key` and `password`: 0 hits; the DSN is host/port/database only).

## Self-Check: PASSED

- All 9 created files and 2 modified files exist.
- Commits `729e1be19`, `0f7575f6e`, `45f840c1c`, `f5ff2214e`, `0b1b772ad` are in `git log`.

---
*Phase: 294-decision-engine-rerank-and-citation-check*
*Completed: 2026-10-20*
