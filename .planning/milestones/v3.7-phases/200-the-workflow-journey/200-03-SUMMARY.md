---
phase: 200-the-workflow-journey
plan: 03
subsystem: api
tags: [harness, workflow, ask_user, resume, refactor, g5, pytest, asyncpg]

requires:
  - phase: 200-02
    provides: "the measurable wire — migration 121, the seven phase-status write sites, the declared counts and the four transports; also the phase_types.py line drift this plan had to re-derive against"
  - phase: 096
    provides: "the boot-time resume sweep + resume_pending_prompt's re-emit-the-SAME-prompt contract, which this plan had to leave intact while building a second resume door"
provides:
  - "D-10: an unanswered `llm_human_input` step PAUSES the run instead of silently approving it (BUG-260816-06 closed by code)"
  - "`db.workflows.pause_run` — the FIRST writer of `workflow_runs.status = 'paused'` in the project's history"
  - "`db.workflows.resume_run` — its narrower inverse"
  - "`db.workflows.get_ask_user_response` — the durable-answer READ the resume contract always claimed existed"
  - "A new `PhaseOutcome` kind, `pause_run`, with its own engine arm and its own three prohibitions"
  - "`HumanInputTimeout` — a pause signal that is deliberately NOT an `asyncio.CancelledError`"
  - "The answer-triggered re-drive on `POST /runs/{id}/ask_user_response` (RESEARCH option (b))"
  - "D-13: `harness/human_input.py` — the human-input executor extracted from `phase_types.py`, discharging its long-named G-5 seam"
affects: [200-04, 200-05, 200-06, 200-07, workflow-run-surface, panel-phase-timeline, ask_user, harness-resume]

tech-stack:
  added: []
  patterns:
    - "MOVE plus IMPORT-BACK extraction with four executed proofs (byte-identity, one-object, a RED-driven plant, a failure-SET comparison in both directions)"
    - "A characterization pin that is MOVE-INVARIANT by construction — it resolves its patch target from the function's own `__module__` rather than spelling a module name"
    - "A pause disposition expressed as a PhaseOutcome kind rather than an exception the escape handler can see"
    - "A keyed, SINGLE-USE resume flag on ctx so a re-drive consumes the durable answer instead of re-asking"

key-files:
  created:
    - backend/app/services/harness/human_input.py
    - backend/tests/test_200_human_input_baseline.py
    - backend/tests/test_200_human_gate_pause.py
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness_engine.py
    - backend/app/db/workflows.py
    - backend/app/api/runs.py
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md

key-decisions:
  - "The audit row REUSES `policy_applied` with `metadata.policy = human_gate_pause` rather than adding a 25th `harness_audit` kind — a new kind is migration 122 plus a live-DB apply, and this plan ships no migration"
  - "`HumanInputTimeout` is a plain Exception, never `asyncio.CancelledError`, and is caught in `_run_phase_with_gates` BEFORE the escape handler can see it"
  - "The pause is NOT routed through `_route_on_failure`: nothing failed, and an author's `on_failure` disposition is not entitled to decide what happens when a person steps away"
  - "`_latest_phase_text` moved WITH the executor even though it has a second caller — leaving it would have created the one forbidden import edge back"
  - "Nine shipped test patch sites were repointed in the extraction commit, because the patch surface moves with the function (measured: 5 failures plus one HANG before repointing)"
  - "The executor consumes the durable answer on a keyed single-use re-drive; the boot sweep does not set the flag, so the 096-09 restart contract is untouched"
  - "Tasks 3 and 4 ride ONE commit — their artifacts interleave and a split would have been cosmetic"

patterns-established:
  - "Extraction proof 3: an identity assertion must be DRIVEN RED against a real plant, and so must the no-back-edge guard"
  - "A negative fence needs a positive control AND a fixture that lets it fire — one here was vacuous until a pending-prompt row was seeded, and only a plant revealed it"
  - "Pitfall 6 has a backend twin: a comment that spells `event_type=\"...\"` turns the G1 source scanner RED even while explaining why that kind was rejected"

requirements-completed: [DES-02]

duration: 3h05m
completed: 2026-08-19
---

# Phase 200 Plan 03: The Human Gate Summary

**An unanswered `llm_human_input` step now pauses the run and stays resumable — the gate fails CLOSED — and the vehicle for the fix was D-13's extraction of that executor into its own module, which discharges a G-5 seam named since 2026-08-08.**

## Performance

- **Duration:** ~3h05m
- **Tasks:** 4 of 4 (Tasks 3 and 4 committed together — see Deviations)
- **Files modified:** 14 (3 created, 11 modified)
- **Base SHA:** `04e83292389a62fbd34d0e2ee35e6bc831c70390` — ⚠ the worktree forked from `3781a3fe` and the HEAD assertion corrected it, exactly as the prompt predicted for the third consecutive wave

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `64914dc6` | `test(200-03)`: characterization pin on the human-input executor, BEFORE the cut |
| 2 | `be17a154` | `refactor(200-03)`: D-13 extraction TAKEN — the human-input executor leaves phase_types |
| 3 | `61381442` | `fix(200-03)`: D-10 — an unanswered human gate PAUSES the run, never approves it |

## Accomplishments

### 1. The characterization pin PREDATES the cut, and passed with a numstat of nothing

`backend/tests/test_200_human_input_baseline.py` was committed **alone** (`git show --name-only --format= HEAD` → exactly one path) one commit before `human_input.py` existed. Across the extraction commit its `git diff --numstat` was **EMPTY**. *A baseline taken after the edit proves the edit against itself* — this one did not have to be.

⚠ **It is MOVE-INVARIANT BY CONSTRUCTION, and that is the reusable idea.** `_exec_llm_human_input` binds `subscribe_for_response` as a module GLOBAL, so a patch must target whichever module hosts the function. The pin resolves that from the function's own `__module__` (`sys.modules[_executor().__module__]`) instead of spelling `phase_types` or `human_input`. Every other pinning file in the tree spelled the module and had to be edited (below); this one did not.

### 2. D-13: the extraction, with all four proofs executed

`phase_types.py`'s whole diff is **`+3 / −144`**, and the three additions are one blank line, one banner comment and one import (`git diff -U0 | grep -c '^+[^+]'` → **2**). The `PHASE_TYPE_REGISTRY_ENTRIES` entry for `"llm_human_input"` is **character-identical** — only its line number moved — and so is `_external_action_inputs`' call to `_latest_phase_text`.

| # | Proof | Result |
|---|---|---|
| 1 | Byte-identical move, driven by a script asserting NINE pre-move line boundaries first and aborting on drift | `BYTE-IDENTICAL: _exec_llm_human_input (129 lines)` · `BYTE-IDENTICAL: _latest_phase_text (11 lines)` |
| 2 | One object, not two | `phase_types._exec_llm_human_input is human_input._exec_llm_human_input` → True (same for `_latest_phase_text`) |
| 3 | **Both guards DRIVEN RED against real plants** | duplicate `def` → identity `False`; planted `from … import phase_types` → back-edge count `1`. Both removed; **byte-exact restoration asserted** |
| 4 | Full `tests/unit` failure **SET**, both directions | zero newly-failing **and** zero newly-passing (62 failed / 2350 passed) |

**G-5 triple re-derived: `40 commits / 17 phases / 2497 L` before the cut, `2356 L` after.** One of seven executors is out; **six remain**, and the seam keeps its name. Ledger row (CLAUDE.md) and detail section (`docs/HOT-FILE-LEDGER.md`) landed in the **same commit**; `node scripts/check-claude-md-size.cjs` → `85884 chars · 57.3% · OK`.

### 3. D-10: the gate fails CLOSED

The measured defect, traced end to end: `subscribe_for_response` returns `None` → the shutdown branch does not fire → `answer` stays `""` → the executor **returns normally** → `PhaseOutcome("completed", …)` → `complete_phase` → **the next phase receives `""` as the human's answer.** With `timeout_seconds` defaulting to 300, four of five real runs of `doc_qa_scoped_098uat` completed their approval step that way at exactly the five-minute mark.

What ships:

- **`pause_run`** — the FIRST writer of `workflow_runs.status = 'paused'` in the backend's history (all seven prior grep hits were reads). Run-keyed, `$N` placeholders, guarded `status NOT IN ('completed','failed','cancelled')`, and **it does not touch the thread anchor**.
- **A new `PhaseOutcome` kind**, declared in the comment block that *is* the kind vocabulary, plus its own arm.
- **`HumanInputTimeout`** — a plain `Exception`, caught in `_run_phase_with_gates` before the escape handler can see it.

**The arm does none of the three forbidden things**, and each is asserted rather than intended:

| Prohibition | Consequence if violated | How it is held |
|---|---|---|
| no `asyncio.CancelledError` | `_expire_pending_ask_user` kills the prompt; `cancel_phase` flips the step to `cancelled` | the pause is a `PhaseOutcome`, not an escape; driven RED by plant 2 |
| no `finish_run` | clears `threads.active_workflow_run_id` ⇒ **permanently unresumable** | driven RED by plant 1 |
| no `completed` phase | `find_resumable_runs` requires an `active` row | the arm writes **no** `workflow_phases` row at all — *the absence IS the mechanism* |

### 4. The answer-triggered re-drive (RESEARCH option (b))

Without it, a paused run resumes **only on a server restart** — and the UI would have to say so. `submit_ask_user_response` gains a Step 5, gated on the `_origin == "harness"` branch (already owner-scoped and anchor-confirmed, 404 never 403). It **BRANCHES, never replaces**: Step 1's `runs` SELECT is byte-identical and still first (`git diff -U0 | grep -c '^-.*table("runs")'` → **0**), the persist and publish are untouched, and a failure is logged, never raised.

`claim_run` is the anti-double-drive: a real CAS on the migration-062 lease, so this route racing the boot sweep produces exactly one producer. The minted producer shell is terminalized on every exit path. The golden-run exclusion is carried verbatim — **a security property, not housekeeping** (Phase 190 / A4).

## Deviations from Plan

### Auto-fixed / recorded

**1. [Rule 2 — missing critical functionality] The re-drive would have RE-ASKED the question**

- **Found during:** Task 4 (verifying binding constraint 7, *"the boot sweep must still work"*).
- **Issue:** `resume_stranded_workflows`' docstring says of an already-answered ask_user phase: *"the answer is durable → do NOT re-ask; let `run_workflow` re-run the phase, which re-reads the durable answer and proceeds."* **Nothing re-read it.** `_exec_llm_human_input` mints a fresh `uuid4().hex` on every entry, so a re-driven phase inserts a SECOND prompt row and blocks again. From the person's chair: they answer, and the question comes back — D-10's promise broken in a new way rather than a fixed one.
- **Fix:** `db.workflows.get_ask_user_response` (the existing EXISTS query, structurally identical, SELECTing the payload and excluding `expired` rows) plus a **keyed, single-use** `ctx.resume_answered_tool_call_id` the re-drive sets and the executor consumes. Keyed, because a "latest prompt" lookup would let a run's SECOND human phase inherit the FIRST one's answer — the silent auto-approval this plan removes, re-introduced by a convenience. Cleared before the read, so it can fire at most once.
- **Blast radius:** the boot sweep does **not** set the flag, so the 096-09 restart contract is untouched — asserted by `test_without_the_flag_the_executor_takes_the_shipped_ask_path`.
- **Commit:** `61381442`

**2. [Rule 3 — blocking issue] The patch surface moved with the function; nine shipped test sites had to be repointed**

- **Found during:** Task 2, immediately after the cut.
- **Issue:** `subscribe_for_response` is a module GLOBAL of whichever module hosts the executor, so `patch.object(phase_types, "subscribe_for_response", …)` patches a name nothing reads. **Measured before repointing, never assumed:** `test_harness_engine.py` → **4 failed**, `test_200_phase_counts.py` → **1 failed**, and `test_dual_mode_wiring.py` → **HUNG OUTRIGHT** (the real block primitive against a fake redis).
- **Fix:** repointed in `test_harness_engine.py` (×4), `test_200_phase_counts.py`, `test_harness_templates.py`, `test_096_ci_workflow_regression.py` (×1 patch + ×1 docblock) and `test_dual_mode_wiring.py`, all inside the extraction commit — which is why the failure set still compares clean.
- ⚠ **This is the one category the precedent's *"consumers were deliberately not repointed"* rule does not cover, and the next executor cut will meet it again.**
- **Commit:** `be17a154`

**3. [decision] The audit row reuses `policy_applied`; no 25th kind, no migration**

- The plan specified a dedicated run-paused audit kind. `_AUDIT_EVENT_TYPES` must stay in LOCKSTEP with the `harness_audit.event_type` Postgres CHECK, and `tests/unit/test_audit_event_registration.py` pins them EQUAL **in both directions** — so a new kind is migration 122 plus a live-DB apply, and this plan ships no migration (121 belongs to `200-02`, which runs alone against real Postgres). Registering it in code alone would MOVE the failure from a fast `ValueError` to a Postgres 23514 mid-run, which is precisely what that set exists to prevent (`BUG-260731-02`).
- Phase 196's recorded precedent for this exact situation. `metadata.policy = "human_gate_pause"` names the event so the ledger row is unambiguous and a later migration can promote it.
- **WRITE-before-EMIT is unaffected:** the durable fact is `pause_run`'s status write, and it lands first — asserted by `test_write_lands_before_emit_in_the_pause_arm`.
- Fenced by `test_no_twenty_fifth_audit_kind_was_added`, so the decision cannot rot silently.

**4. [Rule 1 — bug in this plan's own output] A comment that spelled its own forbidden token turned a shipped guard RED**

- The first draft of the arm's comment wrote the rejected kind as an `event_type="…"` keyword while explaining why it was rejected. `test_audit_event_registration.py`'s G1 extractor scans module SOURCE, comments included, and named `harness_engine.py`. **Pitfall 6 on the backend.** Rewritten, and the trap is now recorded in the comment itself.
- The same trap bit the pin's docblock, which mentioned the two local-infra ports literally and failed the plan's own `grep -c "54322\|:6379"` criterion. Also rewritten.

**5. [decision] Two shipped tests pinned the defect and were deliberately RED-flipped**

- `test_harness_engine.py::test_human_input_clamps_timeout_to_hard_cap` (`assert out["answer"] == ""  # no response on timeout`) and `test_200_phase_counts.py::test_llm_human_input_emits_no_measure_key` (which used a timeout to obtain an output dict). **Both quote their original assertion verbatim rather than deleting it**, with the measured reason.
- The clamp half — the ARGUMENT handed to the block primitive — is unchanged, which is what that case is named for.

**6. [decision] Tasks 3 and 4 ride ONE commit**

- Their artifacts interleave: the raise and the durable-answer consume are in the same function; `pause_run` / `resume_run` are a matched pair in one file; the pause and re-drive cases are one test file. Partial staging is not available here, so a split would have been cosmetic rather than reviewable. Stated as a decision, not omitted.

**7. [correction] The plan's `grep -c "phase_types" human_input.py == 0` criterion is WRONG, and the strengthened check was driven RED**

- The count is **6**, and all six are PROSE in the module docblock naming where the code came from — exactly what the precedent's own docblock does. Erasing the provenance to satisfy a grep would have made the move less auditable, not more.
- The criterion that means something is the IMPORT-scoped one: `grep -cE '^\s*(from|import)\s+.*phase_types'` → **0**, and it was driven RED against a planted import edge. The honest invariant is likewise stated at its real strength — *never import `phase_types` back* — because true leaf-ness is unachievable for this cut (the moved function needs `settings`, `subscribe_for_response` and `aexec`).

**8. [correction] RESEARCH §B9's `_latest_phase_text` grep is STALE**

- §B9 measured `grep -c` → 2 (the def plus one call) and concluded *"it is used only here"*. At HEAD it is **3**: `_exec_llm_human_input` **and** `_external_action_inputs` (the 189 executor). Moving it is still correct — leaving it would have created the one forbidden edge — and the second caller rides the re-import unchanged. Recorded because *"used only here"* is exactly the kind of claim that decides an extraction's shape.

**9. [correction] The G-5 triple in BOTH CLAUDE.md and `200-CHECKLIST.md` §6.6 was stale before this plan ran**

- Both published `39 / 16 / 2424`; measured `40 / 17 / 2497` pre-cut. The cause is inside this phase: **`200-02` landed on the same file earlier in the same phase.** The ledger's most repeated finding, reproducing within one phase rather than across days.

## Known Stubs

None. Every artifact this plan created is wired and exercised.

## Threat Flags

None. The new surface is one route STEP on an already owner-scoped, anchor-confirmed branch, and two run-keyed writers that take no user-supplied filter. The one place new surface could have leaked — the re-drive's row predicate — carries `find_resumable_runs`' golden-run exclusion verbatim, asserted by `test_a_golden_run_can_never_be_woken_by_an_answer`.

## Verification

### Explicitly-run in-scope suites (deterministic; never "the gate is green")

| Suite | Result |
|---|---|
| `tests/test_200_human_input_baseline.py` | **6 passed** — 5 GREEN across all three commits, **exactly one RED-flipped** on the D-10 commit |
| `tests/test_200_human_gate_pause.py` | **17 passed** (6 pause assertions + 4 source fences + 7 re-drive/consume cases) |
| `tests/test_harness_engine.py` · `test_200_phase_counts.py` · `test_harness_resume.py` | **89 passed, 0 failed** |
| `tests/test_cancel_run.py` · `test_l01_finish_run_terminal_guard.py` · `test_workflow_phase_cancel.py` · `test_188_workflow_run_read.py` | **43 passed, 0 failed** |
| `tests/unit/test_audit_event_registration.py` | **6 passed** (was RED on the first draft of the arm's comment) |
| `tests/unit` (full) | **62 failed / 2350 passed** — the failure SET compared against the pre-plan baseline with `comm` in **both** directions: **zero newly-failing, zero newly-passing** |

### Baselines held

| Baseline | Checklist §6 | Measured at close |
|---|---|---|
| `tests/unit` | 62 failed / 2350 passed | **62 / 2350**, and the SET is identical |
| wire slice (six suites) | 1 failed / 121 passed | **1 failed / 133 passed** (the +12 is this plan's two new files) — the one failure is the named pre-existing `test_thread_workflow_state_shape` |
| `tsc -p tsconfig.app.json --noEmit` | 33 errors / 19 files | **33 errors**, unmoved. ⚠ My file-count grep reads 23, not 19 — a difference in how paths are extracted from multi-line diagnostics, **not** drift: the frontend diff is provably EMPTY (below) |
| frontend + `scripts/` diff vs base | — | **EMPTY** (`git diff --numstat 04e83292 HEAD -- frontend/ scripts/`) |
| vitest count gate | 4970 · 4543 · 96/96 | **NOT RUN, and stated rather than implied.** This plan's frontend diff is empty, so the gate could not move; running a non-deterministic gate (`SEED-171`) to re-confirm an empty diff would produce a reading nothing here caused |

### `test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` — status UNCHANGED

Still RED, exactly as `200-CHECKLIST.md` §6.3 names it. It is in this plan's blast radius (`ThreadWorkflowState`) and was **not** touched: this plan changes no wire model.

### Three suites had NO published baseline, so one was MEASURED rather than assumed

`test_dual_mode_wiring.py`, `test_harness_templates.py` and `test_096_askuser_cleanup.py` are in neither §6.2 nor §6.3. They report **23 failed / 53 passed**, and every failure was confirmed **pre-existing at `04e83292`** by restoring the base content of the touched files, re-running, and restoring HEAD byte-exactly: **newly failing NONE, newly passing NONE.** The distinct causes are all in modules this plan never opens — `app.api.threads does not have the attribute 'insert_run'` (×8, fallout of the 2026-08-17 `run_transport` extraction), `get_service_role_supabase requires an explicit org_id` (×5), `KeyError: 'created_at'` (×2), `app.api.panel does not have get_pg_pool`, and five template-seed assertions.

A second, narrower case was measured the same way: `test_096_askuser_cleanup.py::test_cancel_mid_phase_expires_pending_prompt` **passes alone and fails when run after three sibling suites** — a cross-file interaction that is also **identical at the base** (3 failed / 97 passed, same three node ids).

### The plants — every negative fence has been shown to fail

| Plant | Fences it reddened |
|---|---|
| `pause_run` → `finish_run(pool, run_id, "paused")` | `test_the_run_reads_paused`, `test_finish_run_is_never_called`, `test_the_thread_anchor_is_intact`, `test_write_lands_before_emit_in_the_pause_arm`, `test_the_pause_arm_does_none_of_the_three_forbidden_things` |
| `cancel_phase` + `_expire_pending_ask_user` inside the arm | `test_cancel_phase_is_never_reached`, `test_the_pending_prompt_is_not_expired`, `test_the_phase_is_left_active`, `test_the_pause_arm_does_none_of_the_three_forbidden_things` |
| duplicate `def` in `phase_types.py` | the identity assertion → `False` |
| `from app.services.harness import phase_types` in `human_input.py` | the no-back-edge count → `1` |

⚠ **ONE FENCE WAS FOUND VACUOUS BY A PLANT AND FIXED.** `test_the_pending_prompt_is_not_expired` did **not** fire on the first run of plant 2, because `_expire_pending_ask_user` INSERTs one expiry row **per row returned** by its pending-prompt SELECT — and the fixture's fetch queue was empty, so it wrote nothing even when it *was* reached. A live pending-prompt row is now seeded (with the reason recorded inline), and the plant reddens it. **This is the `199-03` failure caught before it shipped:** a guard that passes green because nothing fired.

## Owed — a DRIVEN row, not a claim

⚠ **The unit half proves the WIRING; only the driven row proves the PROMISE.** Stated plainly rather than folded into a pass:

- **Automated here:** the executor raises instead of returning; the arm writes `paused` and nothing else; `finish_run`/`cancel_phase`/prompt-expiry are unreachable and unwritten; the anchor survives; the re-drive fires exactly once for a `paused` run and zero times otherwise; the CAS refuses a double-drive; a golden run is excluded; the executor consumes the durable answer rather than re-asking.
- **OWED (manual, `200-VALIDATION.md`):** start a run with an `llm_human_input` step, **walk away past 300 s**, come back and answer — the run reads `paused`, the prompt is still answerable, and answering resumes it **without a restart**. No automated path drives real Redis pub/sub plus a real engine re-drive, and claiming otherwise would be the *"another row's evidence is not this row's"* mistake.
- **Also owed:** a driven confirmation that the BOOT sweep still re-drives a paused run after a restart. The code path is untouched (the sweep does not set the resume flag, and `find_resumable_runs`' predicate already admits `'paused'` — that clause has been in the query since before this plan, waiting for a writer), but no automated case restarts a process.

## Next

`200-04` … `200-07` (the four frontend surfaces) inherit two facts from here:

1. **A run can now legitimately read `paused`** with an `active` phase row under it. Any surface that renders run status or a phase spine needs an arm for it — and it must not be spelled as *stopped*, *failed* or *waiting to start*.
2. **`phase_types.py` has one fewer executor** (`40 / 17 / 2356`). The seam is open and named: six executors remain, `llm_emit` the strongest next candidate.

## Self-Check: PASSED

All four created artifacts exist on disk (`backend/app/services/harness/human_input.py`, `backend/tests/test_200_human_input_baseline.py`, `backend/tests/test_200_human_gate_pause.py`, this SUMMARY) and all three commit hashes resolve in `git log --all` (`64914dc6`, `be17a154`, `61381442`). No file deletions across the plan (`git diff --diff-filter=D --name-only 04e83292 HEAD` → empty); no untracked files left behind; `STATE.md` and `ROADMAP.md` untouched, as the wave's orchestrator owns those writes.
