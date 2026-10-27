---
phase: 296-close-v4-7-debt
part: backend
reviewed: 2026-10-27T00:00:00Z
depth: standard
diff_base: 27f1cdf9b33b1f6f76e1963fd746e84bbff2840e
files_reviewed: 57
files_reviewed_list:
  - backend/app/api/api_keys.py
  - backend/app/api/citation_checks.py
  - backend/app/api/folders.py
  - backend/app/api/inbound.py
  - backend/app/api/runs.py
  - backend/app/api/schedules.py
  - backend/app/api/threads.py
  - backend/app/api/workflow_authoring_doors.py
  - backend/app/api/workflow_run_evidence.py
  - backend/app/api/workflow_runs.py
  - backend/app/api/workflow_wire.py
  - backend/app/api/workflows.py
  - backend/app/db/api_keys.py
  - backend/app/db/workflows.py
  - backend/app/main.py
  - backend/app/models/api_key.py
  - backend/app/models/schedule.py
  - backend/app/services/agent_loop.py
  - backend/app/services/citation_claims.py
  - backend/app/services/describe_draft_guards.py
  - backend/app/services/describe_files.py
  - backend/app/services/eval_runner_service.py
  - backend/app/services/forced_emit.py
  - backend/app/services/harness/form_inputs.py
  - backend/app/services/harness/human_input.py
  - backend/app/services/harness/phase_confidence.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness/run_handoff.py
  - backend/app/services/harness/validator_kinds.py
  - backend/app/services/harness_engine.py
  - backend/app/services/inbound_inputs.py
  - backend/app/services/provider_gateway/openai_compat.py
  - backend/app/services/provider_gateway/schema_moonshot.py
  - backend/app/services/rate_limit.py
  - backend/app/services/rerank_engines/local.py
  - backend/app/services/rerank_engines/registry.py
  - backend/app/services/rerank_engines/tracing.py
  - backend/app/services/run_evidence.py
  - backend/app/services/run_lifecycle.py
  - backend/app/services/run_producer.py
  - backend/app/services/run_reconciler.py
  - backend/app/services/scheduler_service.py
  - backend/app/services/text_tool_calls.py
  - backend/app/services/tools/render_template.py
  - backend/app/services/tools/sandbox.py
  - backend/app/services/unattended_launch.py
  - backend/app/services/workflow_authoring.py
  - backend/app/services/workflow_kickoff.py
  - scripts/check-backend-unit-baseline.cjs
  - scripts/check-migration-216-live.py
  - scripts/check-seeds-register.cjs
  - scripts/decision-fault-server.py
  - scripts/full-schema-supplement.sql
  - scripts/run-296-board.py
  - supabase/migrations/215_api_keys_and_run_origin.sql
  - supabase/migrations/216_neutral_default_org_name.sql
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
independent_review: self
---

# Phase 296: Code Review Report (backend half)

**Reviewed:** 2026-10-27
**Depth:** standard (diff-scoped: `git diff 27f1cdf9b..HEAD -- <file>`, plus the called code each change relies on)
**Files Reviewed:** 57
**Status:** issues_found

## Summary

The backend, scripts and migrations 215/216 were reviewed with weight on tenancy, SECURITY DEFINER
posture, run lifecycle / resume races, cross-provider routing, inbound caps, and scripts touching
non-local hosts. The test suite was not run (another process holds the local-DB lock). Every finding
below was traced through the called code. None is pattern-matched only.

**Verified sound (no finding):**
- **Migration 216.** `CREATE OR REPLACE` keeps the mig-181 ACL. The `REVOKE ... FROM PUBLIC` lines stand in
  `full-schema.sql:11013`. `organizations.name` has no unique constraint, so a constant name cannot
  collide (only `slug` is UNIQUE, and it is NULL here). The supplement copy changed in the same commit.
  No backend path still builds an org name from an email.
- **Migration 215 regex narrowing.** Correct.
- **Org stamping.** `create_folder` and `create_draft` stamp only a membership-validated org
  (`resolve_active_org_or_none`). The RLS INSERT policies re-check `org_id IN current_user_org_ids()`.
  `autofill_org_id_by_owner` keeps an explicit value.
- **Evidence D-05 cascade and the canonical-UUID filter.** Both are correct and fail closed.
- **Citation rate limit.** It sits before the in-flight claim, and it fails closed when Redis is down.
- **Download token.** The peek-then-consume uses an atomic GET+DEL and compares the value.
- **API keys.** The `revoked_now` audit dedupe and the `create_key` "offered" check are correct.
- **`forced_emit` `active_provider` copy (293-F-4).** Correct for the cloud-key branch.
- **`check-migration-216-live.py`.** Refuses a non-local host.
- **`run-296-board.py`.** Its DB and Redis guards are correct (but see WR-05).

**The main problem:** the SEED-362 resume fix (CR-01) records the run's provider and model but leaves the
re-driven ctx on the owner's default-provider settings. A resumed run started on any non-default
provider now sends the run's model through the wrong provider. This has not been driven live: the board
evidence ran against a backend that predates 296-06, so `metadata.provider` was null.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A resumed run sends its own model through the owner's default provider (SEED-362 regression)

**File:** `backend/app/services/harness_engine.py:2589-2606` (also reached from `backend/app/api/runs.py:766` through the answer re-drive)

**Issue:**
- 296-06 makes every in-app kickoff record `metadata.provider = _resolved_provider` (`threads.py:2089`).
- On resume, `_build_resume_context` then sets `ctx.model = run["model"]` and `ctx.provider = _run_provider`.
- But `ctx.user_settings` is still `_owner_settings` from `load_user_settings(owner)`. Its
  `active_provider`, `llm_api_key`, `llm_base_url` and `available_models` belong to the owner's default
  provider.
- The live kickoff does not do this. It runs `override_provider(user_settings, resolved_provider)`
  (`run_model_resolution.py:~279`), so live settings, model and provider agree. On resume they disagree.

How each step type routes on resume:
- **`llm_single`** calls `task_service._stream_one_iteration(model=ctx.model, user_settings=ctx.user_settings, provider=None)`.
  The route key falls back to `user_settings.active_provider` (`task_service.py:257`), and the key comes
  from the owner's settings.
- **`llm_agent`** goes through `_resolve_sub_agent_effective_model(settings, ctx_model)`, which keys on
  `user_settings.active_provider`. It silently swaps back to the owner's provider, so SEED-362 is still
  not met for agent steps.
- **Only `llm_emit`** reads `ctx.provider`.

**Failure scenario:**
1. The owner's default is OpenAI. A user picks a Claude model in the composer and starts a workflow:
   step 1 `llm_human_input`, step 2 `llm_single`.
2. They answer the pause.
3. `_redrive_paused_workflow_run` → `_build_resume_context` sets `ctx.model = "claude-…"` with
   OpenAI `user_settings`.
4. Step 2 is routed with `_provider = "openai"`. The adapter provider then comes from the registry
   (`anthropic`), but the settings carry the OpenAI key and base URL.
5. The call returns 401/404 and the run fails after the person answered. This is the
   `6eab949f` repro shape that `run_model_resolution.py` documents ("claude model + openai default
   active_provider → routed to OpenAI SDK → 404").

Before 296, the resume used the owner-default model, so it was wrong-provider but working.

This is exactly the board's own `--resume-model` workflow (`_resume_def`: human ask, then `llm_single`).
It read PASS only because the live backend predated 296-06 and recorded no provider
(`296-05-SUMMARY.md:137`).

**Fix:** align the settings with the recorded provider, as the live kickoff does:
```python
from app.models.user_settings import override_provider
if _run_provider and _owner_settings is not None:
    _owner_settings = override_provider(_owner_settings, _run_provider)
# then resolve _ctx_model as now, and pass user_settings=_owner_settings
```
- `override_provider` returns the settings unchanged when the provider has no key. In that case, fall
  back to `resolve_sub_agent_model_safely`, never the raw recorded model.
- Add a unit test that asserts `ctx.user_settings.active_provider == ctx.provider` on resume.
- Then re-run `run-296-board.py --resume-model` against a restarted backend.

## Warnings

### WR-01: The boot sweep's human-input arm takes the run's latest prompt, which may belong to an earlier step

**File:** `backend/app/services/harness_engine.py:2766-2772, 2816-2818`; guard at `backend/app/services/harness/human_input.py:195`

**Issue:**
- Arm 2c takes the run's latest `ask_user_prompt` (`get_pending_ask_user`, which is
  `ORDER BY created_at DESC LIMIT 1` over every prompt of the run, answered or not).
- If that prompt was answered, it sets `ctx.resume_answered_tool_call_id` to its id.
- Nothing checks that the prompt belongs to the active step. The executor's own comment says this flag
  must be "NEVER A 'LATEST PROMPT' LOOKUP" (`human_input.py:171-176`).
- The only backstop is `_answers_this_step`, which compares prompt text.

**Failure scenario:**
1. A review workflow has step 1 "Approve this draft?" (answered) and step 3 "Approve this draft?".
2. The server restarts after step 3 becomes active but before its prompt row is inserted. That insert is
   explicitly best-effort (`human_input.py` "a failed insert only affects the /pending replay"), so
   this also happens whenever that insert failed.
3. The sweep finds step 1's answered prompt and sets the flag.
4. Step 3 consumes step 1's answer: a silent approval nobody gave.

**Fix:** only accept a prompt created during the active phase. For example, add
`AND m.created_at >= <active phase started_at>` (or match a stored phase slug in the prompt's
`tool_calls`). Otherwise leave `_hi_tcid = None` so the ordinary re-drive asks once.

### WR-02: The inbound body cap is bypassed by a chunked request

**File:** `backend/app/api/inbound.py:83-101`

**Issue:**
- `_BodyCapRoute` refuses only when a `Content-Length` header is present and too large.
- A request sent with `Transfer-Encoding: chunked` has no `Content-Length`, so it "passes untouched".
- uvicorn (h11/httptools) accepts chunked request bodies. FastAPI then reads and JSON-parses the whole
  body before any dependency runs, including the IP limiter.
- No other body limit exists in `backend/app`. The onebox nginx allows 100 MB
  (`frontend/nginx.conf:8`), and a direct Coolify backend has no limit.

**Failure scenario:** an unauthenticated client streams an arbitrarily large chunked JSON body to
`POST /inbound/.../runs`, and the worker buffers all of it in memory. 293-IN-03 is closed only for
well-behaved clients.

**Fix:** enforce the cap on the received stream, not on the header. Wrap `request.receive` (or use a
small ASGI middleware scoped to `/inbound`) so it counts bytes and returns 413 once
`INBOUND_MAX_BODY_BYTES` is exceeded. Keep the `Content-Length` fast path.

### WR-03: `needs_typed_task` refuses workflows that need no typed task

**File:** `backend/app/services/inbound_inputs.py:130-135`; used by `api/api_keys.py:103,236,314` and `validate_inbound_inputs:194`

**Issue:**
- `needs_typed_task` returns `not fields`, where `fields = declared_fields(...)`. `declared_fields`
  already drops `kb_auto` inputs and reserved keys.
- The docstring says this mirrors the browser's `entryInputFields` kickoff fallback. It does not:
  `entryInputFields` (`soulData.ts:254-278`) falls back to `kickoff_prompt` only when `inputs[]` is
  empty. A workflow whose only inputs are Look-it-up (`kb_auto`) inputs gets no kickoff box in the
  browser and starts without a typed task.

**Failure scenario:** a published workflow whose inputs are all `source: kb_auto`:
- It is greyed out in the key picker as "needs_task".
- `create_key` refuses it with "starts from a typed task, which a key can't send yet". That is false.
- An existing key naming it reads `needs_task`, and an inbound start returns `needs_task`.

**Fix:** classify on the raw `inputs[]` / `input_keys` being empty, not on the filtered launch fields.
```python
def needs_typed_task(definition) -> bool:
    raw = ...  # decode as declared_fields does
    return not (raw.get("input_keys") or raw.get("inputs"))
```
Callers then pass the definition, or a pre-filter flag.

### WR-04: The reconciler still ends a crash-finished branched run as `failed`

**File:** `backend/app/services/run_reconciler.py:300-304, 329-330`

**Issue:**
- `all_completed` counts only `completed` / `recorded_not_sent` steps.
- A `skip_to_phase` route marks a step `skipped` (`db/workflows.py:2057`, `harness_engine.py:1994`).
- The engine treats `skipped` as done (`harness_engine.py:1561`). The reconciler's own WHERE treats it
  as terminal (`_TERMINAL_PHASE_STATUSES`).

**Failure scenario:** a branched workflow finishes every step, with one `skipped`. The worker dies
before `finish_run`. The reconciler then ends the run `failed` with "Finalised by the reconciler" and
writes a `run_failed` audit, although the deliverable exists. That is the exact defect 295-IN-02 / 296-02
set out to remove, still open for every branched workflow.

**Fix:** `AND wp.status NOT IN ('completed', 'recorded_not_sent', 'skipped')`, while requiring at least
one `completed` step so an all-skipped run is not called completed.

### WR-05: `run-296-board.py` sends its writes to an unguarded API host

**File:** `scripts/run-296-board.py:641-642` (guards); `scripts/conc_probe.py:241-242` (`base_url`)

**Issue:**
- The board's write modes create threads, workflow definitions and live provider runs through
  `kit.base_url()`, which is `os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000")`.
- None of the three guards checks it. `assert_localhost_only` checks `SUPABASE_URL`, and
  `_assert_local_db` checks the DSN and Redis.
- `assert_localhost_only` is also a substring `search` for `localhost|127.0.0.1`, so
  `https://<prod>.supabase.co/?x=localhost` passes it.

**Failure scenario:** with `EVAL_BASE_URL` left pointing at a staging or prod backend (it is the eval
harness's documented override), `--first-step`, `--multi-tool`, `--pinned-emit` and the other write
modes POST real runs there, carrying a bearer token minted for the local test user. The phase brief says
scripts touching non-local hosts must refuse.

**Fix:** in `main()`, after `load_env()`:
```python
from urllib.parse import urlparse
if urlparse(kit.base_url()).hostname not in {"127.0.0.1", "localhost"}:
    raise SystemExit("REFUSING: EVAL_BASE_URL is not 127.0.0.1/localhost")
```
Also tighten `assert_localhost_only` to `urlparse(url).hostname in {...}`.

### WR-06: `create_folder` still makes blocking supabase-py calls on the event loop (the rewritten insert included)

**File:** `backend/app/api/folders.py:80, 95`

**Issue:**
- 296-01 rewrote the folder INSERT (`result = supabase.table("folders").insert(row).execute()`) and left
  it, and the duplicate-name check above it, as synchronous `.execute()` calls inside `async def`.
- This breaks D-v2.5-01 ("wrap with `run_in_threadpool`"). Under `WORKER_COUNT=2` a slow PostgREST
  round-trip stalls every stream on that worker.
- The module already imports `run_in_threadpool`, and the codebase has `aexec`.

**Fix:** `await aexec(supabase.table("folders").insert(row))` and
`await aexec(name_check_query.maybe_single())`.

## Info

### IN-01: `recording_by_design` reads the `live_connectors` audience without a freshness check

**File:** `backend/app/services/harness/validator_kinds.py:250-262`

The external-action executor runs `await ensure_settings_fresh()` before
`feature_audience("live_connectors")` (`phase_types.py:2738`). That was the CR-03 fix for a flipped flag
still reading as on. The judge-side twin reads the cache directly. If the switch changes inside the
cache TTL, the judge can be told a recording was by design while the executor recorded it for a missing
grant, or the reverse. **Fix:** `await ensure_settings_fresh()` before the read, or pass the executor's
decision through the output.

### IN-02: The baseline gate's path detection misses common path spellings, and `--json` gets no JSON on a gate error

**File:** `scripts/check-backend-unit-baseline.cjs:164-167, 210-215`

- `/^tests([\\/]|$)/` does not match `./tests/unit/x.py` or `backend/tests/...`. Those runs silently get
  `tests/unit` prepended and run the whole gated set plus the file.
- The new fail-closed branch exits 2 before any JSON is written, so a `--json` consumer sees no
  document.

**Fix:** normalise a leading `./` / `backend/`, and emit `{"error": ...}` in JSON mode.

### IN-03: The golden run gives Look-it-up and file inputs a text stand-in, and the publish note names them

**File:** `backend/app/services/harness/publish_service.py:1550-1585`

`golden_run_inputs` loops over every `definition.inputs` entry, including `source: kb_auto` and
`type: file`. It assigns `"a short example answer"` and adds the label to `stood_in`. The publish
note then says "The practice run had no example for <Look-it-up input>". That is misleading, because a
Look-it-up input is never asked for (the overlay and `launch_kickoff` both skip it). **Fix:** skip
`source != "user"` (and `type == "file"`) when building the stand-ins and the note.

### IN-04: `inline_refs` raises a bare `ValueError` on a recursive `$ref`

**File:** `backend/app/services/provider_gateway/schema_moonshot.py:61-66`

On a Moonshot endpoint, every tool's `parameters` goes through `inline_refs`. That includes
connector/MCP tools, whose schemas are authored externally. One recursive schema (a tree or comment
thread) raises `ValueError` inside `open_openai_compat_stream`, which is not a provider-shaped error.
**Fix:** on a cycle, return that tool unchanged (or drop that one tool with a logged warning) instead of
raising for the whole request.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
