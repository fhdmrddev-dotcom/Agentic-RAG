---
phase: 065-skills-test-infrastructure-repair
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - backend/tests/integration/test_threads_skills.py
  - backend/tests/integration/test_skills_import_export.py
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
  blocker: 1
status: issues_found
---

# Phase 065: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 065 ships test-only changes across two integration files. Plan 01 mechanically renames 11 patch targets from `app.api.threads.create_streaming_chat` to `app.api.threads.create_adaptive_streaming_chat` and tuple-wraps 19 fake-stream returns to match the new `(stream, calling_mode)` contract. Plan 02 retargets 3 export-side assertions to the agentskills.io slug-prefixed bundle layout.

The narrow mechanical edits in Plan 01 are correct against the production import (`app/api/threads.py:33`) and the production unpack site (`app/api/threads.py:1475`). The narrow assertion updates in Plan 02 correctly match the production export shape (`app/api/skills.py:525,549,555`).

However, the review surfaces one **BLOCKER**-class structural defect Plan 01 explicitly punted on (acknowledged in `065-01-SUMMARY.md` and `deferred-items.md` D-065-01-DEFER-1) and several smaller warnings/info items that should be tracked.

The "test correctness" question the orchestrator asked — *do these patches actually exercise the production code paths intended?* — has a clear answer: **no**. All 11 tests in `test_threads_skills.py` short-circuit at `send_message`'s user-message INSERT and return HTTP 500 before ever reaching `create_adaptive_streaming_chat`, so none of the system-prompt / tool-result / SSE-event assertions actually run against production behavior. The patches are mechanically correct but functionally inert until the deferred fixture-shape repair lands.

## Blockers

### BL-01: All 11 tests in `test_threads_skills.py` short-circuit before the patched code path executes

**File:** `backend/tests/integration/test_threads_skills.py:117, 158, 209, 265, 319, 365, 408, 461, 505, 550, 613` (the "insert user msg" mock at index 1 of every `mock_builder.execute.side_effect` array)
**Issue:**
Production `send_message` at `backend/app/api/threads.py:905-933` performs an INSERT and immediately reads the returned id:
```python
_user_msg_resp = await aexec(supabase.table("messages").insert({...}))
_user_msg_data = _user_msg_resp.data if _user_msg_resp is not None else None
if isinstance(_user_msg_data, list):
    _user_msg_id = _user_msg_data[0].get("id") if _user_msg_data else None
...
if not _user_msg_id:
    logger.error("User-message INSERT did not return id ... aborting send_message", thread_id)
    raise HTTPException(status_code=500, detail="Failed to persist user message")
```

Every test in this file mocks the INSERT return as `_make_result([])` (empty list), which falls through to `_user_msg_id = None` and raises HTTP 500 before `event_stream`, `create_adaptive_streaming_chat`, or any tool-dispatch logic ever executes.

Concrete consequences:
- `TestCatalogInjection::test_catalog_appended_when_skills_exist` asserts `"## Available Skills" in system_content` — `captured_messages` is never populated; assertion fails or asserts on empty input.
- `TestExplorerModeNoSkills::test_explorer_mode_uses_explorer_tools` asserts `"tools_override" in captured_kwargs` — `captured_kwargs` is never populated.
- `TestLoadSkill`, `TestSaveSkill`, `TestReadSkillFile`, `TestSkillActivatedEvent`, `TestLoadSkillFiles` all assert on SSE event content (`skill_activated`, `tool_end`, etc.) — no events are ever emitted because the producer task never spawns.

The `065-01-SUMMARY.md` accomplishments section confirms: *"the 11 tests now collect cleanly but fail at a deeper mock-vs-production contract drift (User-message INSERT did not return id for thread ... aborting send_message at threads.py:926)."* This means Phase 065 ships a test file whose patch targets are correct but whose tests do not exercise the SUT — the suite is **green-collection / red-execution** in the worst possible way: a casual reader sees the AttributeError fixed and assumes the tests now run, but every assertion fails in a way that doesn't surface the underlying skip.

This was acknowledged as out-of-scope per Plan 01's `<done>` block, but the artifact this phase commits is a test file that compiles, collects, but does not perform the verification its docstrings claim to perform. Per BL-02-style "fail loudly" project conventions (see `app/api/threads.py:921-933`), this is a **shipped-broken-test contract** that future regressions in `create_adaptive_streaming_chat`, the explorer-mode tool list, the skill-catalog injection, or any of the tool dispatchers will not catch.

**Fix:**
Apply the deferred D-065-01-DEFER-1 repair before merging Phase 065. For each of the 11 tests, replace the index-1 mock:
```python
# Before:
_make_result([]),                                       # insert user msg
# After:
_make_result([{"id": str(uuid4())}]),                   # insert user msg — must return id per threads.py:921
```
Additionally, every test assumes the SSE-on-POST architecture (`client.stream("POST", ...)` and `_collect_sse_events(response)`). Phase 063 (D-063-01) hard-cut this path: `send_message` now returns `JSONResponse({message_id, run_id})` synchronously and the SSE stream is consumed via `GET /runs/{rid}/stream`. Even after fixing the INSERT-id mock, the tests will still see an empty SSE iteration on the POST response — `_collect_sse_events` will return `[]`. The full repair requires either (a) splitting the test into POST→GET-stream pairs against a Redis-backed run buffer, or (b) re-targeting the patch at the producer task body and asserting against captured `_emit` calls. Neither is a one-line change. Until that lands, the 11 tests are documentation, not verification.

The `065-01-SUMMARY.md` "Recommended fix path" only mentions the INSERT-id patch and does not flag the SSE-on-POST architecture mismatch — that is a second layer of staleness that the next plan must also address.

## Warnings

### WR-01: Architectural staleness — `client.stream("POST", ...)` against a non-streaming endpoint

**File:** `backend/tests/integration/test_threads_skills.py:132-138, 173-179, 224-230, 298-304, 342-348, 390-396, 432-438, 485-491, 528-534, 580-586, 647-654` (every `with client.stream("POST", ...)` block)
**Issue:**
Phase 063 removed SSE-on-POST. Production `send_message` returns `JSONResponse(status_code=201, content={"message_id": ..., "run_id": ...})` at `app/api/threads.py:2719-2725`. Calling `client.stream("POST", ...)` on a JSON-returning endpoint and then iterating `response.iter_lines()` produces a single line of JSON, not SSE events — `_collect_sse_events` (line 84) filters for lines starting with `"data: "`, so it returns an empty list every time. None of the SSE-event assertions in the file can ever pass against the current production architecture, regardless of the BL-01 INSERT-id fix.

**Fix:**
The full repair plan should explicitly call out the SSE-on-POST → POST+GET-stream architecture migration as part of test recovery, not just the INSERT-id mock fix. Two paths:

1. Change tests to follow the production two-step flow:
   ```python
   resp = client.post(f"/threads/{tid}/messages", json={...}, headers=auth_headers)
   run_id = resp.json()["run_id"]
   with client.stream("GET", f"/runs/{run_id}/stream", headers=auth_headers) as sse_resp:
       events = _collect_sse_events(sse_resp)
   ```
   This requires a Redis fixture (the producer XADDs to `run:{run_id}` and the GET endpoint XREADs from it).

2. Patch the producer entry point (e.g. `_emit`) directly and assert against captured `(type, fields)` tuples instead of SSE wire format. This avoids Redis but couples the test to internal helpers.

Recommend filing as a follow-on plan (D-065-01-DEFER-1 update) and re-classifying the deferred work as "INSERT-id mock + SSE-architecture migration" rather than just "INSERT-id mock."

### WR-02: `THREAD_ID` is a module-level singleton — silent test cross-contamination risk

**File:** `backend/tests/integration/test_threads_skills.py:23` (`THREAD_ID = str(uuid4())`)
**Issue:**
`THREAD_ID` is generated once at import time and reused across all 11 tests. The `reset_mocks` autouse fixture in `tests/conftest.py:86-134` resets the Supabase builder between tests but does not regenerate `THREAD_ID`. If any test in the file (or any other test importing from this module) keys per-thread state in Redis or in module-level dicts (e.g. `RUN_TASKS` at `app/api/threads.py:80`, `runs_by_thread:{tid}` ZSET), state can leak between tests and produce flaky failures that depend on test execution order.

Today this is latent because BL-01 short-circuits before any thread-keyed state writes happen. Once BL-01 + WR-01 are fixed and tests actually reach the producer task, this becomes an active flake source.

**Fix:**
Move `THREAD_ID = str(uuid4())` into a fixture or generate per-test:
```python
@pytest.fixture
def thread_id():
    return str(uuid4())
```
Then take `thread_id` as a fixture parameter and use it in the `f"/threads/{thread_id}/messages"` URL.

### WR-03: `_skill_row()` mock returned as a list, but production uses `.maybe_single()`

**File:** `backend/tests/integration/test_skills_import_export.py:85, 105, 150, 189` (all `_make_result([_skill_row()])` calls feeding the export endpoint)
**Issue:**
Production `export_skill` at `app/api/skills.py:519` calls `.maybe_single()`, which against real PostgREST returns `data` as a single dict (or `None`), not a list. The production code defensively handles both shapes at line 524 (`skill_row = skill.data[0] if isinstance(skill.data, list) else skill.data`), so the test's list shape works — but it tests the defensive branch, not the canonical PostgREST shape.

The same conftest pattern of returning lists where `.maybe_single()` would return a dict is used elsewhere; this is a project-wide test-fixture convention rather than a per-test bug. Worth noting because if a future production change drops the defensive `isinstance(list)` branch (assuming canonical PostgREST shape), every export test will silently flip to running against the dict-extraction branch only — and any test that relied on the list branch covering a real edge case will lose coverage.

**Fix:**
Either (a) align fixture shape with PostgREST canonical (`_make_result(_skill_row())` for `.maybe_single()` calls, no list wrapper), or (b) document the dual-shape convention in `tests/conftest.py` so future contributors know the mock is intentionally permissive. Preference (a) — fail closer to real PostgREST behavior.

### WR-04: `test_export_returns_zip` performs strict content-type equality on a header that may include encoding

**File:** `backend/tests/integration/test_skills_import_export.py:92` (`assert response.headers["content-type"] == "application/zip"`)
**Issue:**
Production sets `media_type="application/zip"` on a `StreamingResponse`. Starlette's response layer may append `; charset=utf-8` or other parameters depending on middleware. Strict equality is brittle. The same test then loosens to `"attachment" in response.headers["Content-Disposition"]` (substring check) one line later — inconsistent rigor.

**Fix:**
```python
assert response.headers["content-type"].startswith("application/zip")
```

## Info

### IN-01: Misleading assertion message references old function name

**File:** `backend/tests/integration/test_threads_skills.py:140, 181`
**Issue:**
The assertion message strings still reference the old function name:
```python
assert len(captured_messages) > 0, "create_streaming_chat was not called"
assert "tools_override" not in captured_kwargs, "tools_override not passed to create_streaming_chat"
```
After the rename, these messages should reference `create_adaptive_streaming_chat` to match the patched symbol. Pure cosmetic; doesn't affect test behavior, but a future debugger reading a failing test will grep for the wrong symbol name.

**Fix:** Update string to `"create_adaptive_streaming_chat was not called"` (and similar at line 232).

### IN-02: Unused import `pytest` in `test_skills_import_export.py`

**File:** `backend/tests/integration/test_skills_import_export.py:11`
**Issue:**
`import pytest` is imported at module top but never referenced (no `@pytest.mark.*` decorators, no `pytest.raises`, no `pytest.fixture` defs). Some Python linters (ruff F401) will flag this.

**Fix:** Remove the `import pytest` line, or add a `# noqa: F401` comment explaining the intent (e.g. for future test additions).

### IN-03: `test_import_invalid_yaml` accepts both 400 and 201 — weakens contract

**File:** `backend/tests/integration/test_skills_import_export.py:303-316`
**Issue:**
```python
assert response.status_code in (400, 201)
```
A test that accepts two different status codes is two tests, not one. The comment explains the rationale ("if ALL skills fail, 400 is more user-friendly"), but the test never asserts which path the production code actually took. If a future refactor flips the response from 400 to 201 (or vice versa) the test still passes silently — the test no longer pins the contract. Also note that 201 means "created" — for a request where no skill was actually created, returning 201 would itself be a contract violation (the test should fail in that case, not pass).

Looking at production at `app/api/skills.py:194-197`, the actual behavior is deterministic: when `not parsed and not errors` → raise 400; when `not parsed and errors` → raise 400 with `errors[0]["error"]` as detail. This invalid-YAML test should assert exactly 400 (parsing fails, errors non-empty, second branch fires) and assert the error detail mentions "yaml" or "frontmatter" to verify the failure mode is the expected one rather than (e.g.) an UnboundLocalError that produces 500.

**Fix:**
```python
assert response.status_code == 400
assert "yaml" in response.json()["detail"].lower() or "frontmatter" in response.json()["detail"].lower()
```

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
