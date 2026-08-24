---
phase: 196-registry-backed-model-picker-canvas
plan: 02
subsystem: api
tags: [settings, judge-model, app_settings, UserEffectiveSettings, forced_emit, publish-gauntlet, eval-runner, pytest]

# Dependency graph
requires:
  - phase: 137.1
    provides: "app_settings.harness_judge_model + the Settings judge-model knob (the control this plan makes obey)"
  - phase: 111
    provides: "UserEffectiveSettings / load_app_settings_async — the DB-backed settings loader"
provides:
  - "All FOUR judge consumers resolve the judge model from DB-backed app_settings, not the env-level app.config.settings singleton"
  - "backend/tests/unit/test_196_judge_model_db_backed.py — the BINDING test BUG-260731-01 demanded, RED-first on all four consumers"
  - "A per-consumer regression fence: three of four can no longer regress silently behind a passing fourth"
affects: [196-09, 197, eval-matrix, publish-gauntlet, skill-studio-evals]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Function-local `from app.models.user_settings import load_app_settings_async` in a SERVICE module (the skill_tuner.py:728-730 idiom / Pitfall 4)"
    - "Settings-read fixture: patch `_load_settings_from_db` at the BOTTOM of the chain so the whole real path runs — never hand a SimpleNamespace to the resolver"

key-files:
  created:
    - backend/tests/unit/test_196_judge_model_db_backed.py
  modified:
    - backend/app/services/eval_runner_service.py
    - backend/app/services/harness/publish_service.py
    - backend/app/services/harness/validator_kinds.py
    - backend/tests/test_eval_runner.py

key-decisions:
  - "resolve_judge_model's body, signature and order are UNCHANGED — the defect was entirely in what the four consumers handed it"
  - "Settings.harness_judge_model stays in app/config.py — removing a field while changing its consumers would make a red test ambiguous"
  - "validator_kinds.py:83-86's forced_emission read (D-122-04 drift) deliberately NOT fixed here — latent, 0/61 registry rows affected; planted for 196-09"
  - "Consumer 2's hoist stops at the top of the grading block, NOT at run_eval_job's `for case in cases` loop — the plan's 'per-arm loop' premise was measured FALSE (no loop textually contains the call) and hoisting further would need the parameter-threading signature change the same plan forbids"

patterns-established:
  - "Per-consumer coverage, not one case on the resolver — a shared case lets N-1 consumers regress silently"
  - "Assert at the EMISSION boundary (the `model=` argument forced_emit actually received), not a helper's return value"
  - "A row value chosen to be NEITHER fallback candidate, so a pass cannot be a coincidence"

requirements-completed: [BUG-260731-01]

# Metrics
duration: ~75min
completed: 2026-08-18
---

# Phase 196 Plan 02: Make the Settings Judge-Model Knob Obey — Summary

**All four judge consumers now resolve `harness_judge_model` from DB-backed `UserEffectiveSettings` instead of the env-level `app.config.settings` singleton, closing `BUG-260731-01` behind the per-consumer RED-first test the report itself made binding.**

## Performance

- **Duration:** ~75 min (dominated by three full backend suite runs at ~8-9 min each)
- **Tasks:** 2 of 2
- **Files modified:** 4 (1 created, 3 source rewired, 1 test repaired)

## Accomplishments

- **The knob obeys.** The operator's `deepseek-v4-pro` is now the judge model at the eval judge shot, the recorded eval judge model, the publish-gauntlet hard wall, and the in-run `llm_judge_rubric` validator.
- **The binding condition is discharged.** A test that sets the row and asserts the RESOLVED model changes now exists, and all four consumer cases were observed RED against `develop` before a single line of production code moved.
- **A stale test expectation was caught by the fix rather than by luck** — `test_judge_provider_independent` derived its expected provider from the env singleton and would have silently pinned the wrong model forever.

## Task Commits

1. **Task 1: Write the BINDING test and drive all four consumers RED** — `5db2fb39` (test)
2. **Task 2: Rewire the four consumers to the DB-backed settings** — `48100d5a` (fix)

## The RED evidence — verbatim, all four consumers

`cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_196_judge_model_db_backed.py -q` at Task 1, against today's `develop`:

```
    async def test_consumer_1_eval_judge_shot_uses_db_backed_model(monkeypatch):
        """The eval judge SHOT routes to the model the operator set, not the env fallback."""
        _patch_settings_row(monkeypatch, ROW_MODEL)
>       assert await _drive_consumer_1(monkeypatch) == ROW_MODEL
E       AssertionError: assert 'claude-opus-4-8' == 'deepseek-v4-pro'
E
E         - deepseek-v4-pro
E         + claude-opus-4-8

tests\unit\test_196_judge_model_db_backed.py:204: AssertionError
______________ test_consumer_2_recorded_judge_model_is_db_backed ______________

    async def test_consumer_2_recorded_judge_model_is_db_backed(monkeypatch):
        """The judge model PERSISTED on the eval result is the model the operator set."""
        _patch_settings_row(monkeypatch, ROW_MODEL)
>       assert await _drive_consumer_2(monkeypatch) == ROW_MODEL
E       AssertionError: assert 'claude-opus-4-8' == 'deepseek-v4-pro'
E
E         - deepseek-v4-pro
E         + claude-opus-4-8

tests\unit\test_196_judge_model_db_backed.py:210: AssertionError
_____________ test_consumer_3_publish_gauntlet_judge_is_db_backed _____________

    async def test_consumer_3_publish_gauntlet_judge_is_db_backed(monkeypatch):
        """The publish-gauntlet judge - a HARD WALL - grades with the model the operator set."""
        _patch_settings_row(monkeypatch, ROW_MODEL)
>       assert await _drive_consumer_3(monkeypatch) == ROW_MODEL
E       AssertionError: assert 'claude-opus-4-8' == 'deepseek-v4-pro'
E
E         - deepseek-v4-pro
E         + claude-opus-4-8

tests\unit\test_196_judge_model_db_backed.py:216: AssertionError
______________ test_consumer_4_in_run_judge_rubric_is_db_backed _______________

    async def test_consumer_4_in_run_judge_rubric_is_db_backed(monkeypatch):
        """With config.model and ctx.judge_model both absent, rung 3 reads the DB-backed row."""
        _patch_settings_row(monkeypatch, ROW_MODEL)
>       assert await _drive_consumer_4(monkeypatch) == ROW_MODEL
E       AssertionError: assert 'claude-opus-4-8' == 'deepseek-v4-pro'
E
E         - deepseek-v4-pro
E         + claude-opus-4-8

tests\unit\test_196_judge_model_db_backed.py:222: AssertionError
=========================== short test summary info ===========================
FAILED tests/unit/test_196_judge_model_db_backed.py::test_consumer_1_eval_judge_shot_uses_db_backed_model
FAILED tests/unit/test_196_judge_model_db_backed.py::test_consumer_2_recorded_judge_model_is_db_backed
FAILED tests/unit/test_196_judge_model_db_backed.py::test_consumer_3_publish_gauntlet_judge_is_db_backed
FAILED tests/unit/test_196_judge_model_db_backed.py::test_consumer_4_in_run_judge_rubric_is_db_backed
4 failed, 5 passed, 1 warning in 1.27s
```

**Both controls were GREEN at Task 1**, exactly as the plan required — the negative control (empty row → `claude-opus-4-8`, parametrized across all four consumers) and the consumer-4 precedence control (`config["model"]` wins, the settings row is never read). If either had failed at Task 1 the test would have been measuring something other than the defect.

After Task 2: `19 passed` for `test_196_judge_model_db_backed.py + test_settings.py`, with **every `assert` line byte-identical to Task 1** — `git diff HEAD -- backend/tests/unit/test_196_judge_model_db_backed.py` was empty at the Task-2 verification.

## The three-row measurement, before and after

Both taken live against the local Supabase (`127.0.0.1:54322`) on 2026-08-18.

| Source | PRE-fix | POST-fix |
|---|---|---|
| `app_settings.harness_judge_model` — what the operator set in the UI | `'deepseek-v4-pro'` | `'deepseek-v4-pro'` (unchanged — nothing was written) |
| `settings.harness_judge_model` — the env singleton | `None` | `None` (unchanged — the field stays in `config.py`) |
| **what the judge actually uses** | `resolve_judge_model(settings)` → **`'claude-opus-4-8'`** | `resolve_judge_model(await load_app_settings_async())` → **`'deepseek-v4-pro'`** |

The env-singleton resolution still returns `'claude-opus-4-8'` when asked directly — it is simply no longer what any consumer asks.

## ⚠ The live behaviour change, NAMED rather than discovered

**After this plan the publish-gauntlet judge on the operator's own box is `deepseek-v4-pro`, not `claude-opus-4-8`.** That is the fix working — the knob the operator turns is now the control the code obeys — but a phase that silently changed which model grades every publish would be exactly the surprise this phase exists to abolish. `deepseek-v4-pro` is `emit_tier: force`, provider `deepseek`, `forced_emission: True`, with `strict_json_schema` **inert** per D-122-04. This is UAT row **U-B1** in `196-VALIDATION.md`; a real publish shot routing to that provider is **not** claimed here — a unit test cannot prove it.

## Files Created/Modified

- `backend/tests/unit/test_196_judge_model_db_backed.py` (**created**, 246 lines) — six test functions / nine cases: four per-consumer, one negative control parametrized across all four, one consumer-4 precedence control. Patches `app.models.user_settings._load_settings_from_db` so the whole real chain runs; resets `_settings_cache` / `_settings_cache_time` around every case; pins `app.config.settings.harness_judge_model` to `None` explicitly so a machine with `HARNESS_JUDGE_MODEL` in `.env` cannot make a case pass for the wrong reason. Zero DB writes (CLAUDE.md rule 4 does not bind).
- `backend/app/services/eval_runner_service.py` — consumers 1 and 2.
- `backend/app/services/harness/publish_service.py` — consumer 3 (`_judge_golden_output`, the gauntlet hard wall).
- `backend/app/services/harness/validator_kinds.py` — consumer 4, **third rung only**.
- `backend/tests/test_eval_runner.py` — a stale expectation repaired (see Deviations).

## Acceptance criteria — measured

| Criterion | Result |
|---|---|
| ≥ 6 test functions | **6** (9 cases with parametrization) |
| `grep -c 'SimpleNamespace'` is 0 OR every hit annotated | **7 hits, all annotated** — 3 in the module docstring stating the rule, 1 on the import line, 3 on stub lines (`# loop-result stub … NOT the settings object`, `# DEFINITION stub — NOT the settings object`, `# RunContext/ctx stub — NOT the settings object`) |
| `grep -c '_load_settings_from_db'` ≥ 1 | **5** |
| `grep -c 'INSERT INTO\|UPDATE app_settings'` is 0 | **0** |
| `grep -c 'resolve_judge_model(settings)'` across the three service files is 0 | **1 hit — and it is `def resolve_judge_model(settings) -> str \| None:` at `validator_kinds.py:65`, the resolver DEFINITION the same plan forbids changing.** Zero CALL sites remain. The criterion's grep pattern matches the `def` line by construction; recorded rather than "fixed". |
| `grep -c 'load_app_settings_async'` ≥ 1 per file | `eval_runner_service.py` **5** · `publish_service.py` **2** · `validator_kinds.py` **2** |
| No change inside `resolve_judge_model`'s body (~65-90) or the `forced_emission` read | **Confirmed** — `git diff -U2` on `validator_kinds.py` shows exactly one hunk, at `:532-543`, inside `_validate_llm_judge_rubric` |
| `git diff backend/app/config.py` empty | **0 lines** |
| Consumer 2's `await load_app_settings_async()` textually above | **See Deviations** — hoisted to the top of the grading block; the plan's "loop" premise was measured false |
| Full backend suite: no NEW failures | **See below** |

## Backend suite: baseline vs post

| Run | Result |
|---|---|
| **PRE-plan baseline** (`pytest tests/ -q` at base `aa65101d`) | **211 failed · 3964 passed · 29 skipped · 5 xfailed · 9 xpassed · 1 error** (506.99 s) |
| **POST-plan** (same command at `48100d5a`) | **212 failed · 3972 passed · 29 skipped · 5 xfailed · 9 xpassed · 1 error** (550.56 s) |

The arithmetic closes exactly: **+9 passes** are this plan's nine new cases; the **+1 failure / −1 pass** is
`tests/integration/test_075_tool_args_progress.py::test_google_path_emits_code_so_far`, which
**passes in isolation** and is **provably unmodified** by this plan (it does not appear in
`git diff --name-only aa65101d HEAD`, and it exercises the Google tool-args streaming path — no
relation to judge-model resolution). Per CLAUDE.md's SEED-171 discipline the failing filename was
captured from the run output **before** any re-run, and one green sample is recorded as an
observation, **not** as proof of innocence.

The failing-set diff between the two post-fix runs is published because it is the evidence, not a
summary of it: `test_judge_provider_independent` disappears (repaired), `test_google_path_emits_code_so_far`
appears (flake). Nothing else moved.

## Decisions Made

- **`resolve_judge_model` is untouched.** Its `getattr(settings, "harness_judge_model", None)` works identically on a `UserEffectiveSettings`, so the whole defect lived in the argument.
- **`Settings.harness_judge_model` stays in `app/config.py`.** Removing a field while changing its consumers would make any red test ambiguous about which change caused it. It is simply no longer what the judge reads.
- **`validator_kinds.py:83-86`'s `forced_emission` read was deliberately NOT touched.** D-122-04 drift, measured latent: `bool(forced_emission) != (emit_tier in {"force","force_strict"})` holds for **0 of 61** registry rows, and both fallback candidates resolve identically under either flag. Changing inert code inside a critical-bug plan adds risk with zero observable benefit and would have made this plan's binding test harder to attribute if it went red. It is owed as a seed with a mechanical re-open trigger in plan **196-09**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `test_judge_provider_independent` derived its expectation from the very singleton this plan retired**

- **Found during:** Task 2 (post-rewire full-suite run)
- **Issue:** `backend/tests/test_eval_runner.py:705` computed
  `expected_judge_provider = get_model_capability(resolve_judge_model(app_settings))` where
  `app_settings` was `app.config.settings` — the env singleton. Post-fix the code resolves through
  the DB-backed settings, so the test read `claude-opus-4-8` → `anthropic` while the shot correctly
  routed to the operator's `deepseek-v4-pro` → `deepseek`:
  `AssertionError: judge routed to 'deepseek', not the independent judge provider 'anthropic'`.
  **The CLAIM under test was never violated** — the judge still routes to the judge model's own
  registry provider and still never to `user_settings.active_provider` (`openai`, the
  provider-under-test). Only the derivation of the expected value had rotted.
- **Fix:** derive the expectation through the SAME source the code now uses —
  `resolve_judge_model(await load_app_settings_async())` — with a comment recording why, and drop
  the now-unused `settings as app_settings` alias from the function-local import.
- **Files modified:** `backend/tests/test_eval_runner.py` (not in the plan's `files_modified`)
- **Verification:** `pytest tests/test_eval_runner.py -q` → `test_judge_provider_independent` passes;
  the three remaining failures in that file (`test_results_persist_after_buffer_expiry`,
  `test_cross_user_404`, `test_post_applies_provider_override_to_user_settings`) are the recorded
  pre-existing 403/404 rot set and are unchanged.
- **Committed in:** `48100d5a` (part of the Task 2 commit)

### Plan premise corrected by measurement

**2. Consumer 2 is NOT inside a loop, and the plan's hoist instruction could not be executed as written**

The plan states *"Consumer 2 sits inside a per-arm loop … Resolve once above the loop"*, and its
acceptance criterion asks that the call be *"textually ABOVE the loop that used to contain it"*.
**Measured: no loop textually contains it.** The call lived at `eval_runner_service.py:639-645`,
inside the `if status == "completed" and output.strip():` grading branch of `_run_arm_body` — a
helper the `for case in cases:` loop in `run_eval_job` calls twice per case (WITH arm and WITHOUT
arm). The plan's own `<interfaces>` block warned its line numbers were extracted this session and
could rot; the *"inside a PER-ARM loop"* annotation is the part that did.

Hoisting to `run_eval_job` — the only place that IS above the loop — requires threading a new
parameter through both `_run_arm` and `_run_arm_body`, i.e. exactly the signature change the same
plan forbids (*"no signature changes anywhere"*) and the new surface that would void its
G-5-honoured-by-construction claim.

**What was done instead:** the resolution is hoisted to the **top of the grading block**, above the
judge shot and above the branch that used to hold it, into a local (`judge_app_settings`) that the
graded branch reuses. The comment in the source names the reason and names the further hoist that
was declined. **The plan's underlying `must_haves.truths` entry is satisfied on the property it
cares about** — *"the eval matrix does not gain an N-times settings read"*: `load_app_settings_async`
is TTL-cached at 30 s, so this hoisted read and `_judge_eval_answer`'s own resolution (consumer 1,
microseconds later) collapse into **one** DB read per arm. Before this plan there were two
`app.config.settings` reads per arm and zero DB reads; after it there is at most one DB read per
arm, not two, and never one per consumer.

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug) + 1 plan premise corrected by measurement.
**Impact on plan:** No scope creep. The auto-fix is a one-expression change in a test whose claim is
unchanged; the premise correction narrows the hoist to what the file's actual shape permits and is
argued from a measurement rather than a preference.

## Issues Encountered

- **The pre-plan baseline capture was piped through `tail -25`**, so only the totals survived, not the
  per-test failing set. The totals are what the acceptance criterion asks for, and the +9/−1
  arithmetic closes exactly, so the conclusion is sound — but a future plan should redirect the full
  run to a file and capture every `FAILED` line, because *"211"* alone cannot tell you **which** test
  moved. The two post-fix runs WERE captured in full, which is how the flake was identified by name.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema change. `T-196-JUDGE-I` is
mitigated as planned (the test patches `_load_settings_from_db` with an in-memory fake; no real
credential, no real `app_settings` row and no provider key is read or written).

## Known Stubs

None.

## Next Phase Readiness

- **Owed to plan 196-09 (D-22 / D-23), stated so it cannot evaporate:**
  - `backend/app/services/harness/validator_kinds.py` was **ABSENT from the hot-file ledger** and this
    plan modified it — per D-23 it now owes a **row + a `docs/HOT-FILE-LEDGER.md` detail section**,
    re-derived at close with CLAUDE.md's recipe (six-digit quick-task buckets subtracted), never
    copied from D-22's `11 / 4 / 744`.
  - `backend/app/services/harness/publish_service.py` is in the ledger at `19 / 7 / 1243` marked
    *"honoured by construction (193.2)"* — this plan continues that disposition and owes a
    **re-derived triple**, not a copy.
  - `backend/app/services/eval_runner_service.py` is **also absent from the ledger** and was modified
    twice by this plan — it is named here so the next audit can see it.
  - The **D-122-04 `forced_emission` drift** at `validator_kinds.py:83-86` is planted for 196-09 with
    a mechanical re-open trigger: it becomes non-latent the moment any registry row has
    `bool(forced_emission) != (emit_tier in {"force","force_strict"})` (currently 0 of 61).
- **Owed to UAT:** row **U-B1** in `196-VALIDATION.md` — a real publish shot observed routing to
  `deepseek` in `workflow_runs` / `harness_audit`. Not claimable from a unit test.

## Self-Check: PASSED

- All six claimed files exist on disk (`ls -1` verified).
- Both claimed commits exist (`5db2fb39`, `48100d5a`), on `worktree-agent-a0b4a0dbb0449e00d`, base `aa65101d` asserted.
- `git diff --name-only aa65101d HEAD` returns exactly the five source/test files claimed — which is
  also the evidence for the *"provably unmodified"* claim about
  `tests/integration/test_075_tool_args_progress.py`: it is absent from that list.
- `STATE.md` and `ROADMAP.md` untouched (orchestrator owns those writes).

---
*Phase: 196-registry-backed-model-picker-canvas*
*Completed: 2026-08-18*
