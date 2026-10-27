---
phase: 293-start-from-outside-and-close-out
plan: 02
subsystem: inbound-door / unattended-launch / run-origin
tags: [api-keys, inbound, scheduler-seam, run-origin, trust-03, openapi]
base: 8a5f577d5f86c686fcabf9b26fdf1374f6238a79
requires: [293-01]
provides:
  - "services/unattended_launch.py: launch_unattended_run, _drive_run, parse_definition_row, template_refusal (moved from scheduler_service)"
  - "services/harness/run_read_words.py: waiting_who, unsourced_who, compose_waiting_on, _first_line, _WAITING_FALLBACK_NAME (moved from api/workflow_runs.py, re-exported)"
  - "create_workflow_run(origin_kind, origin_label, origin_ref) keyword-only, default None; stamped app / schedule / key"
  - "inbound_inputs.UNTRUSTED_FLAG + wrap_untrusted_input; batch sub-question enveloped on key-started runs"
  - "api/inbound.py: POST /inbound/workflows/{id}/runs, GET /inbound/runs/{id}, GET /inbound/files/{token}"
  - "run_evidence.final_output_text"
affects: [293-03, 293-04, 293-05]
tech-stack:
  added: []
  patterns:
    - "one unattended start core shared by schedules and keys; caller-specific facts passed in (on_finish, origin, caps)"
    - "one-time download token: Redis SET EX 300, GET+DEL in one MULTI on use"
    - "refusal audits awaited (audit_key_call_now) before every raise; normal returns use BackgroundTasks"
key-files:
  created:
    - backend/app/services/unattended_launch.py
    - backend/app/services/harness/run_read_words.py
    - backend/app/api/inbound.py
    - backend/tests/unit/phase293_inbound_fakes.py
    - backend/tests/unit/test_293_seams_moved.py
    - backend/tests/unit/test_293_origin_stamp.py
    - backend/tests/unit/test_293_untrusted_fence.py
    - backend/tests/unit/test_293_inbound_start.py
    - backend/tests/unit/test_293_inbound_status.py
  modified:
    - backend/app/services/scheduler_service.py
    - backend/app/api/workflow_runs.py
    - backend/app/db/workflows.py
    - backend/app/api/threads.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/inbound_inputs.py
    - backend/app/services/run_evidence.py
    - backend/app/main.py
    - backend/tests/unit/test_scheduler_breaker_seam.py
    - backend/tests/unit/test_256_producer_shells.py
    - backend/tests/unit/test_scheduler_string_guard.py
    - scripts/build-public-openapi.cjs
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/public/api/overview.md
key-decisions:
  - "293-02: the shared unattended core takes an already-parsed, linted, entitlement-checked definition; parse + template refusal are shared helpers beside it, entitlement stays per caller (None for the tick, HTTP 403 for a key)"
  - "293-02: the inbound owner-can-run check uses db/api_keys.get_key_workflows (the key-create predicate, org-scoped), not get_definition, after an org-scoped existence read so a foreign row is the same 404"
  - "293-02: the file list uses kind IS DISTINCT FROM 'template_input' — the plan's <> would have dropped every NULL-kind produced file"
  - "293-02: assumptions adopted — A1 (500 000 tokens / 1 800 s on inbound runs), A2 (300 s one-time links, fresh on every read), A3 (envelope at the batch sub-question, inventory below), A6 (Run now stamps schedule origin)"
requirements-completed: [START-02, START-04]
duration: ~95 min
completed: 2026-10-25
---

# Phase 293 Plan 02: The inbound door Summary

**Schedules and API keys now start runs through one moved unattended core. Every run's origin is stamped once by `create_workflow_run`. `/inbound` starts a listed published workflow with a key, reads it back by the starting key only, and serves each produced file once through a 300 s link.**

BASE: `8a5f577d5f86c686fcabf9b26fdf1374f6238a79`

## Task commits

| Task | Commit | Message |
|---|---|---|
| 1 A (move) | `ee9c5a44f` | refactor(293-02): take the scheduler and run-read seams, move-only |
| 1 B (fix) | `0ef96ba57` | fix(293-02): stamp the org on the unattended thread insert |
| 2 RED | `bfed05712` | test(293-02): failing tests for the origin stamp and the untrusted-input fence |
| 2 GREEN | `ff75b0248` | feat(293-02): stamp each run's origin once at start, and fence inbound text |
| 3 RED | `06eef6d62` | test(293-02): failing tests for the inbound start, status read and file link |
| 3 GREEN | `533659b0d` | feat(293-02): the inbound door: start, status read and one-time file link |

## Task 1: the two seams, move-only

- **`services/unattended_launch.py`** holds what used to be the second half of `launch_scheduled_run` plus all of `_drive_run`: the thread insert, `create_workflow_run`, `arm_run_budget` (still before the drive task, inside try/except) and `asyncio.create_task(_drive_run(...))`. `_drive_run` keeps its `finally` (`finalize_run_terminal`, the missing-usage warning, `mirror_run_active`). `record_schedule_outcome` became an awaited `on_finish(status)` callback. The docblock's three ⚠ paragraphs moved with the code.
  - `scheduler_service.launch_scheduled_run` keeps its signature and the schedule-only facts: cap normalisation, `_schedule_*` keys, `ScheduledLaunchRefused`, the entitlement check, and binding the outcome record as `on_finish`. 471 → 290 lines.
- **`harness/run_read_words.py`** holds `waiting_who`, `unsourced_who`, `compose_waiting_on`, `_first_line` and `_WAITING_FALLBACK_NAME`, copied verbatim. `api/workflow_runs.py` re-exports them (one import block), so every importer and patch target still works. `panel_unsourced_who` stayed. 1455 → 1385 lines.
- **Fences retargeted on purpose.** Each fence file has a "Phase 293" reason paragraph:
  - `test_scheduler_breaker_seam.py`: the source scans now read `UNATTENDED`.
  - `test_256_producer_shells.py`: site 5's subject file, `getsource`, warning-literal count and `_SHELL_FUNCTIONS` now point at `unattended_launch`. The drive binds `on_finish` the way the scheduler does. A new assertion pins the scheduler's literal count at 0.
  - `test_scheduler_string_guard.py`: now patches `unattended_launch._drive_run`.
- **Pass/fail set, base vs post-move.** The suite is the plan's eight files.
  - Base: 170 passed. Post-move: 170 passed. 0 failed both times.
  - Diffing the outcome lines (normalised for random uuids in param ids and the renamed `[...scheduler_service.py]` → `[...unattended_launch.py]` param id) gives IDENTICAL.
  - The only raw differences were those param ids, and log lines naming the new module.
- **Commit B:** the thread insert now carries `"org_id": str(org_id)` whenever the org is known. The seam test was RED first ("1 failed, 5 passed"), then GREEN.

## Task 2: origin and the untrusted fence

- `create_workflow_run` has keyword-only `origin_kind`, `origin_label` and `origin_ref`.
  - Callers that pass none bind NULL for all three.
  - A kind outside `{app, schedule, key}` raises `ValueError` before any write.
  - The three columns are added to the INSERT as `$8..$10`. Nothing else in the file changed.
- Stamp sites:
  - `api/threads.py` kickoff: `origin_kind="app"` (one kwarg).
  - `launch_scheduled_run`: `schedule` + `schedule["name"]` + schedule id (A6: Run now goes through the same function).
  - The core passes the origin straight through.
  - The golden run in `publish_service.py` is untouched; an AST fence asserts it passes no origin keyword.
- `inbound_inputs.wrap_untrusted_input(field, text)` builds the TRUST-03 envelope and neutralises `</external_input` case-insensitively. `UNTRUSTED_FLAG = "_untrusted_inputs"`.
- `phase_types`:
  - `_untrusted_inputs` is added by name to `_NON_ACTION_RUN_INPUTS`.
  - In the batch fan-out, `shown` (the wrapped sub-question) is used in both `description` and `system_prompt_override`, but only when `ctx.inputs` is a dict and the flag is literally `True`. A MagicMock ctx or a truthy string never switches it on (pinned).
- RED: 12 failed, 3 passed (the golden-run fence, the byte-identical case and the not-true-flag case, which pass by design). GREEN: 21 passed together with the seam suite.

### Input-site inventory (A3)

From `grep -rn 'ctx.inputs\|run_inputs\|getattr(ctx, "inputs"' backend/app/services/harness backend/app/services/harness_engine.py`:

| Site | What reaches it | Disposition |
|---|---|---|
| `phase_types.py:1025-1048` batch `_one` | sub-questions from `split_topic` of a declared `topic` | **LLM-visible → wrapped here** |
| `phase_types.py:203` `_kickoff_prompt` | `kickoff_prompt` | raw on purpose: server-composed `Run {name}` for key runs |
| `phase_types.py:744-755` programmatic fn input | declared values → `split_topic` | data path; code, not a model. Its output (`{"sub_questions"}`, no `text`) reaches a model only through the batch path above. `handoff_text` returns None for a dict without text, so it never chains raw. |
| `phase_types.py:1725` / `form_inputs.py:53-75` form overlay | declared values with a server-minted `input:<key>` citation | data path; raw on purpose (wrapping would corrupt the deliverable) |
| `phase_types.py:2162` `_external_action_inputs`, `:2440`, `:2949`, `harness_engine.py:980-985` | action arguments | data path; approval-armed by structure. `_untrusted_inputs` is excluded by name. |
| `harness_engine.py:2497` | resume inputs (the same persisted bag) | inherits the flag, so the envelope also applies on resume |
| `scope.py:241`, `engine_ask.py:872` | `folder_id` | never caller-set: `validate_inbound_inputs` refuses `folder_id` as unknown |
| `publish_service.py:903-921` | golden-run recorded inputs | not a key path |
| `reachability.py:308` | static lint | no values |

No further LLM-visible site was found, so no extra wrap was added.

## Task 3: the inbound routes

- **`POST /inbound/workflows/{workflow_id}/runs`** (201 `{run_id, status: "running"}`). The checks run in this order:
  1. The limiter (`start`). A 429 or 503 is audited `over_limit` / `limiter_unavailable` and re-raised with `Retry-After`.
  2. The id must be on the key's list (a malformed id counts as not on it) → 404.
  3. An org-scoped existence read (`org_id = $2 OR is_system_global`) → 404, with detail `{deleted: true}`.
  4. `get_key_workflows` readable → 403 `cannot_run`.
  5. `published` → 409.
  6. `enforce_entitlement` → the shipped 403 body.
  7. `template_refusal` → 422.
  8. `validate_inbound_inputs` → 422 with the UI-SPEC sentence; the audit detail carries `names`.
  9. `launch_unattended_run`:
     - inputs = validated fields + `kickoff_prompt="Run {name}"` + `_untrusted_inputs=True`
     - title `{name} · via key {label}`
     - caps 500 000 / 1 800
     - origin `key` / label / key id
     - `model=None`, set by the core
  10. An `api_key.start` audit (background).
- **`GET /inbound/runs/{run_id}`**:
  - The limiter (`read`) runs first.
  - Then the single access query: `SELECT id, thread_id, status, user_id, org_id, definition_snapshot FROM workflow_runs WHERE id = $1 AND origin_kind = 'key' AND origin_ref = $2 AND user_id = $3`.
  - Status mapping: active → `running` with `step_index`/`step_total`. paused with an unanswered ask → `waiting_for_person`, and `waiting_on.who` = `waiting_who(is_owner=False, …)`, with no prompt text. Any other pause → `paused`. Terminal statuses are passed through verbatim.
  - Step names come from `run_evidence.compose_definition` and `final_output_text`. `end_reason` comes from `resolve_end_reason`, falling back to the audit.
  - Files are read degrade-safe. Each gets `SET apikey:dl:{token} {key_id,run_id,file_id} EX 300` and a URL `/inbound/files/{token}`.
  - Audit `api_key.read`, with outcome = the wire status.
- **`GET /inbound/files/{token}`** (no bearer):
  1. The token shape is checked.
  2. `GET` + `DEL` run in one `pipeline(transaction=True)`.
  3. The key row is read by id. It must be live (not revoked, not expired), the owner must still be a member and not banned, then the limiter (`read`) runs.
  4. The run is re-checked on the D-12 predicate, and the file must be in that run's thread, unexpired, and not a `template_input`.
  5. The bytes come from `get_file_by_id` + `_get_file_content`.
  6. Audit `api_key.read` with `call: "file"`.
- `main.py`: one import word and one include line. `canvas_gate.py` is not touched (`/inbound` count 0).
- **OpenAPI.** Regenerated: 263 paths, 319 operations, 312 schemas. The diff is additions only.
  - `inbound` added to Automation `TAG_GROUPS`.
  - `components.securitySchemes` = `HTTPBearer` + `ApiKey`. Start and read carry `[{"ApiKey": []}]`; `/api-keys` keeps `HTTPBearer`; the file route has no security (it is a signed link).
  - `--check` OK.
  - `router:inbound` added to `overview.md` `covers:`; `check-docs-coverage.cjs` OK.
- RED: collection ImportError (no `app.api.inbound`). GREEN: 35 passed.
- **Counterfactual plants.** Each was driven, then the file restored md5-identical (`plant.py` in the scratchpad):
  - Dropping the not-on-key check made `test_not_on_key_unknown_and_foreign_org_are_byte_identical_404s` fail.
  - Dropping `origin_kind/origin_ref` from the access SQL made `test_the_access_query_is_the_d12_predicate_with_explicit_columns` fail.
  - Setting `shown = question` made `test_a_key_started_run_envelopes_the_sub_question_in_both_prompts` fail.

## Verification

- Plan verification suites (`test_293_seams_moved / origin_stamp / untrusted_fence / inbound_start / inbound_status` + `test_276_openapi_snapshot_fresh` + `test_214_failure_reason_seam`): **95 passed**.
- Task 1 verify set: 176 passed. Neighbour suites (`test_185_detection`, `test_214_args_leaf`, `test_255_extension_contract_guard`, `test_289_phase_confidence`, `test_295_09_review_fixes`, `test_2141_*`, `test_harness_engine`, `test_258_*`, `test_293_inbound_inputs`): green.
  - Two failures sit outside `tests/unit`, and neither is caused by this plan:
    - `tests/test_200_phase_counts.py::test_llm_single_emits_no_measure_key`: a stub lacks the `usage_box` kwarg.
    - `tests/test_migration_122.py`: a live-DB row is stored as a string scalar.
- `node scripts/check-hot-file-ledger.cjs 293`: OK (64 watched files).
- **Full backend baseline** (`node scripts/check-backend-unit-baseline.cjs`, under the local-DB lock, released after): **70 failed, 9805 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors**. The gate passed (70 ≤ 71); wave 1 was 70 failed / 9748 passed.
  - No failing file is one this plan created.
  - The two that looked near this plan's code were checked:
    - `test_published_workflow_ownership.py` fails on `next_schedule_*` fields that this plan does not touch.
    - `test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration` fails on migration 215 from wave 1.

## Deviations from Plan

1. **[Rule 3] Core signature.**
   - **Plan:** the core's action text listed "definition load + parse, lint refusal, entitlement" inside `launch_unattended_run`, while its signature took a parsed `definition`.
   - **Why:** the inbound route needs each refusal as a distinct HTTP outcome, before the launch.
   - **What shipped:** the core starts at the thread insert. `parse_definition_row` and `template_refusal` moved beside it as shared helpers that both callers call. Entitlement stays per caller: the tick needs `None` → `launch_failed`, the key needs the shipped 403. Both use the one `entitlement_service` home.
   - `refused_exc` was not needed.
   - The core also takes `run_label` / `log_ref` so log and finalize wording says "key-started" vs "scheduled". The scheduler's text is unchanged.
2. **[Rule 1] Org passed to the drive.** The scheduler used to pass `schedule.get("org_id")` to `_drive_run` and the fallback `org_id` to the thread client. The core now uses the one resolved `org_id` for both. This only differs when a schedule row has no org, which the NOT NULL column forbids.
3. **[Rule 1] NULL-kind files.** The file-list SQL uses `kind IS DISTINCT FROM 'template_input'`. The planned `kind <> 'template_input'` would have dropped every ordinary produced file (kind NULL). This is pinned in `test_293_inbound_status.py`.
4. **[Rule 2] Owner-can-run read.** It uses `db/api_keys.get_key_workflows` (the create-time predicate, scoped to the key's org, per the 293-01 note) instead of `get_definition`. It runs after an org-scoped existence read, so a foreign-org row is the same 404 (D-06). This is SQL in the route by design (the plan's access queries live there too).
5. **[Rule 2] Body schema.** `InboundStartBody.inputs` is `dict[str, Any]` documented as `{string: string}` (`WithJsonSchema`). With a framework `dict[str, str]`, a non-text value would get FastAPI's 422 with no audit row. Now it gets the house sentence "Input {key} must be text." and an `invalid_body` audit.
6. **Extra refusal codes.**
   - `no_template` (fill step without a template) and `limiter_unavailable` (503) are audit reasons not in 293-04's list. 293-04's activity text should fall back for them.
   - `over_limit` is used for 429, as 293-04 expects.
7. **File-link revocation is audited.** A link refused because its key was revoked, expired or its owner left writes `api_key.refused` with `detail.file: true`. A link that is unknown or already used writes nothing (no key is known).
8. **Test helper.** `backend/tests/unit/phase293_inbound_fakes.py` is shared by the two route suites. It was not listed in `files_modified` and is not collected (no `test_` prefix).
9. **Commit-msg hook.** The first Task 3 GREEN message was refused at 14 lines (cap 12) and re-written shorter. No `--no-verify`.
10. **Not done here by design:**
    - The ledger rows and `docs/HOT-FILE-LEDGER.md` sections for the touched hot files are re-derived at the 293-05 close, per the plan-time rows. The new files already had rows, and the ledger gate passes.
    - `graphify update` was not run inside the worktree.

## Known Stubs

None. Every route reads real tables or Redis; caps and limits are real.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: unauthenticated-route | backend/app/api/inbound.py | `GET /inbound/files/{token}` has no bearer by design (T-293-16): the 300 s one-time token is the credential, and key/run/file are re-checked against live state on use. Token consumption precedes the limiter, so a 429 on a link burns it (a fresh link comes with the next status read). |

## Self-Check: PASSED

- Files exist: `backend/app/services/unattended_launch.py`, `backend/app/services/harness/run_read_words.py`, `backend/app/api/inbound.py` and the five new test files plus the fakes module.
- Commits present: `ee9c5a44f`, `0ef96ba57`, `bfed05712`, `ff75b0248`, `06eef6d62`, `533659b0d`.
