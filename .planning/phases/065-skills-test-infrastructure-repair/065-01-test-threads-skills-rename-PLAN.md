---
phase: 065-skills-test-infrastructure-repair
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/tests/integration/test_threads_skills.py
autonomous: true
requirements: [TEST-DEBT-059]
must_haves:
  truths:
    - "Pytest collection of test_threads_skills.py raises 0 AttributeError on `app.api.threads.create_streaming_chat`"
    - "All 13 patches in test_threads_skills.py target `app.api.threads.create_adaptive_streaming_chat` (the symbol actually imported by threads.py:33)"
    - "All 13 fake functions in test_threads_skills.py return a 2-tuple `(iter(chunks), CallingMode.NATIVE)` so the production unpack `stream, calling_mode = create_adaptive_streaming_chat(...)` at threads.py:1475 succeeds against the mock"
    - "The combined skills test run reports 0 errors and 0 unexpected failures (passes or documented skips only)"
    - "058 + 059 binding gates remain green: `test_058_concurrency.py::test_cross_tab_unblocked_during_sse` and `test_059_disconnect.py` suite still pass"
  artifacts:
    - path: backend/tests/integration/test_threads_skills.py
      provides: "Repaired patch targets + tuple-shaped fake return values"
      contains: "create_adaptive_streaming_chat"
      min_lines: 600
  key_links:
    - from: "backend/tests/integration/test_threads_skills.py (patch sites)"
      to: "backend/app/api/threads.py:33 (import line)"
      via: "monkey-patch of imported name"
      pattern: 'patch\("app\.api\.threads\.create_adaptive_streaming_chat"'
    - from: "fake_create_streaming_chat returns"
      to: "threads.py:1475 unpack `stream, calling_mode = create_adaptive_streaming_chat(...)`"
      via: "tuple shape contract"
      pattern: "return \\(iter\\(.*\\), CallingMode\\.NATIVE\\)"
---

<objective>
Repair `backend/tests/integration/test_threads_skills.py` so that pytest collection and execution succeed cleanly. The file currently has 13 instances of `patch("app.api.threads.create_streaming_chat", ...)` targeting a symbol that is no longer imported by `app/api/threads.py` (the import line at threads.py:33 brings in `create_adaptive_streaming_chat` only). All 13 patches raise `AttributeError: module 'app.api.threads' does not have the attribute 'create_streaming_chat'` at test setup.

This plan does TWO mechanical edits in lockstep:
  1. Rename the patch target string from `app.api.threads.create_streaming_chat` → `app.api.threads.create_adaptive_streaming_chat` at all 13 sites.
  2. Update each `fake_create_streaming_chat` (or equivalent inner fake) to return a 2-tuple `(iter(stream_chunks), CallingMode.NATIVE)` instead of bare `iter(stream_chunks)`, because the new function's contract is `tuple[stream, calling_mode]` (see `backend/app/services/openai_service.py:790-797`) and the production call site unpacks accordingly (`stream, calling_mode = create_adaptive_streaming_chat(...)` at threads.py:1475).

Both edits MUST happen together — renaming the patch without fixing the return shape leaves tests broken (the production code will hit a TypeError trying to unpack a single iterator).

Purpose: Restore green test foundation for the skills test suite so the Skill Studio milestone (SEED-002) can extend these patterns without inheriting broken patches. Pure test-only maintenance — no production code touched.

Output: A single repaired test file + an atomic commit. No sprawling refactor; the goal is "rename and verify."
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/seeds/SEED-002-skill-studio-milestone-prep.md
@C:/Vibe Apps/Agentic RAG/CLAUDE.md
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_threads_skills.py
@C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py
@C:/Vibe Apps/Agentic RAG/backend/app/services/openai_service.py

<interfaces>
<!-- Key contracts the executor must respect. Extracted from the actual codebase. -->
<!-- DO NOT explore the codebase further; these are sufficient. -->

From backend/app/api/threads.py:33 — the symbol actually imported (this is what `patch("app.api.threads.X")` must target):
```python
from app.services.openai_service import create_adaptive_streaming_chat, get_llm_client, get_explorer_tools, EXPLORER_SYSTEM_PROMPT, _uses_max_completion_tokens, CallingMode, get_tools, resolve_calling_mode, normalize_finish_reason
```
Note: `create_streaming_chat` is NOT in that import list. Patching `app.api.threads.create_streaming_chat` therefore fails with AttributeError. The legacy `create_streaming_chat` still exists in `openai_service.py:770` as a backward-compat wrapper, but threads.py does not bind it.

From backend/app/api/threads.py:1475 — the production call site that must unpack against the mock's return value:
```python
stream, calling_mode = create_adaptive_streaming_chat(
    messages=messages,
    model=body.model,
    user_settings=user_settings,
    tool_choice=tool_choice,
    tools_override=active_tools,
)
```

From backend/app/services/openai_service.py:790-797 — the function signature + return type:
```python
def create_adaptive_streaming_chat(
    messages: list[dict],
    tool_choice: str = "auto",
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
    tools_override: list[dict] | None = None,
    max_tokens: int | None = None,
) -> tuple:
    """Returns (stream, calling_mode). calling_mode indicates how to parse the response."""
```

`CallingMode` is exported from `app.services.openai_service` and is already imported into `app.api.threads` via the line at threads.py:33. The test file does NOT currently import `CallingMode` directly; it must add the import to construct the fake's tuple return value. Use `CallingMode.NATIVE` — that is the default path the existing fakes were written against (no structured-mode prompt-injection branch is exercised by these tests).

From backend/tests/integration/test_threads_skills.py — the 13 patch sites (line numbers from grep at planning time, may drift slightly):
- Lines 125-129 (TestCatalogInjection.test_catalog_appended_when_skills_exist)
- Lines 166-170 (TestCatalogInjection.test_catalog_empty_when_no_skills)
- Lines 217-221 (TestExplorerModeNoSkills.test_explorer_mode_uses_explorer_tools)
- Lines 286-295 (TestLoadSkill.test_load_skill_success)
- Lines 330-339 (TestLoadSkill — second test)
- Lines 378-387
- Lines 421-430
- Lines 473-482
- Lines 517-526
- Lines 568-577
- Lines 634-645 (TestLoadSkillFiles.test_load_skill_returns_files — has multi-iteration fake with `call_count`)

Total patch sites: 13. Total fake function definitions: 13 (one per patch site). Some fakes return a single `iter(...)` immediately; others (line ~634) have branching logic via `call_count[0]` and may return different `iter(...)` per call — every return statement on every fake function must be wrapped to a tuple.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rename patch targets and tuple-wrap fake returns in test_threads_skills.py</name>
  <files>backend/tests/integration/test_threads_skills.py</files>

  <read_first>
    1. Read `backend/tests/integration/test_threads_skills.py` in full (667 lines — under the 2000-line single-read budget).
    2. Confirm imports at the top of the file: `from unittest.mock import MagicMock, patch` and `import pytest`. After this task, the imports must also include `CallingMode` from `app.services.openai_service` (added by this task).
    3. Confirm there are 13 occurrences of the literal string `app.api.threads.create_streaming_chat` and 13 fake function definitions named `fake_create_streaming_chat` via grep. If counts differ, STOP and report — do not silently rename.
  </read_first>

  <action>
    Make two coordinated edits to the file:

    **Edit A — patch target rename (13 sites):**
    Replace every occurrence of the literal string `app.api.threads.create_streaming_chat` with `app.api.threads.create_adaptive_streaming_chat`. The exact form to replace is the patch decorator/context-manager argument:
    ```
    patch("app.api.threads.create_streaming_chat", side_effect=fake_create_streaming_chat)
    ```
    becomes:
    ```
    patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat)
    ```
    Do NOT rename the inner Python function `fake_create_streaming_chat` itself — its name is irrelevant to mockability and renaming it would balloon the diff. The PATCH TARGET (string) is what binds; the side_effect function name is purely local.

    **Edit B — tuple-wrap every fake's return value (13 fakes):**
    The new function signature is `def create_adaptive_streaming_chat(...) -> tuple` and the production call site at threads.py:1475 unpacks `stream, calling_mode = create_adaptive_streaming_chat(...)`. Therefore every `return` inside every `fake_create_streaming_chat` must return `(iter([...]), CallingMode.NATIVE)` instead of `iter([...])`.

    Concrete transform pattern for the simple fakes (10 of 13):
    ```python
    def fake_create_streaming_chat(messages, **kwargs):
        captured_messages.extend(messages)
        return iter(stream_chunks)
    ```
    becomes:
    ```python
    def fake_create_streaming_chat(messages, **kwargs):
        captured_messages.extend(messages)
        return iter(stream_chunks), CallingMode.NATIVE
    ```

    Concrete transform pattern for the multi-iteration fake at line ~634 (TestLoadSkillFiles.test_load_skill_returns_files):
    ```python
    def fake_create_streaming_chat(messages, **kwargs):
        call_count[0] += 1
        if call_count[0] == 1:
            return iter([
                _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                _make_tool_calls_done_chunk(),
            ])
        captured_tool_messages.extend([m for m in messages if m.get("role") == "tool"])
        return iter([_make_sse_chunk("Done."), _make_done_chunk()])
    ```
    becomes:
    ```python
    def fake_create_streaming_chat(messages, **kwargs):
        call_count[0] += 1
        if call_count[0] == 1:
            return iter([
                _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                _make_tool_calls_done_chunk(),
            ]), CallingMode.NATIVE
        captured_tool_messages.extend([m for m in messages if m.get("role") == "tool"])
        return iter([_make_sse_chunk("Done."), _make_done_chunk()]), CallingMode.NATIVE
    ```
    (Every `return iter(...)` becomes `return iter(...), CallingMode.NATIVE`. There may be 1-3 fakes with multiple return statements — wrap each one independently.)

    **Edit C — add CallingMode import:**
    The file currently does not import `CallingMode`. Add to the imports near the top of the file (before the helper functions block):
    ```python
    from app.services.openai_service import CallingMode
    ```
    Place it after the `import pytest` line and before the `# ── Helpers ──` comment band.

    **Do NOT touch:**
    - Any `_make_sse_chunk`, `_make_done_chunk`, `_make_tool_call_chunk`, `_make_tool_calls_done_chunk`, `_make_result`, or `_collect_sse_events` helper.
    - Any `mock_builder.execute.side_effect = [...]` setup.
    - Any assertion (`assert "..." in system_content`, etc.) — assertions about captured messages/tool args are independent of the tuple shape.
    - Any test class structure or test function name.
    - The `client.stream(...)` invocation block.

    **Decision:** No tests are skipped in this plan. All 13 tests are expected to pass after the rename + tuple-wrap. If any individual test reveals a deeper drift (e.g. an assertion about an SSE event shape that has evolved), that is OUT OF SCOPE for Plan 01 — flag it as a finding in the summary and defer to Plan 02 or a follow-up. Per `<scope_reduction_prohibition>`, do not paper over real failures by skipping; surface them honestly.

    **Project rules to honor (CLAUDE.md):**
    - Backend uses `venv` at `backend/venv/` — activate before running pytest.
    - No production code is touched, so D-v2.5-01 (no blocking I/O in async handlers) and D-v2.5-02 (single uvicorn worker) do not apply here. Pure test maintenance.
  </action>

  <acceptance_criteria>
    1. Zero occurrences of the literal string `"app.api.threads.create_streaming_chat"` remain in `backend/tests/integration/test_threads_skills.py`.
    2. Exactly 13 occurrences of `"app.api.threads.create_adaptive_streaming_chat"` exist in the file (one per former patch site).
    3. Every `return iter(...)` line inside any `fake_create_streaming_chat` function in this file is followed by `, CallingMode.NATIVE` on the same logical line.
    4. The file imports `CallingMode` from `app.services.openai_service` once.
    5. `python -c "import ast; ast.parse(open('backend/tests/integration/test_threads_skills.py').read())"` returns 0 (file is syntactically valid Python).
  </acceptance_criteria>

  <verify>
    <automated>cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py -q --no-header 2>&1 | tee /tmp/065-01-pytest.log; grep -E "passed|failed|error" /tmp/065-01-pytest.log | tail -5</automated>
    <!-- Expected: pytest exit code 0; output line of the form "13 passed" (or higher if there are more tests in the file) and "0 failed", "0 errors". -->
    <!-- Counter-grep gates (must run after pytest passes; comments stripped to avoid self-invalidating gate per planner rule): -->
    <!-- 1. Old patch target eradicated: grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c '"app\.api\.threads\.create_streaming_chat"' must equal 0 -->
    <!-- 2. New patch target installed at 13 sites: grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c '"app\.api\.threads\.create_adaptive_streaming_chat"' must equal 13 -->
    <!-- 3. CallingMode import present: grep -c 'from app.services.openai_service import CallingMode' backend/tests/integration/test_threads_skills.py must equal 1 -->
    <!-- 4. Every fake's iter return is tuple-wrapped: grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -E 'return iter\(' | grep -vc 'CallingMode\.NATIVE' must equal 0 -->
  </verify>

  <done>
    All 4 counter-grep gates pass (zeros + 13 + 1 + 0). Pytest reports all tests in `test_threads_skills.py` either passed or are documented skips. No `AttributeError: module 'app.api.threads' does not have the attribute 'create_streaming_chat'` anywhere in the output. If individual assertions fail (deeper drift, e.g. evolved SSE event shape), report each failure to the summary and stop — do not skip-with-reason in this plan; the rename/tuple-wrap is the entire scope.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Verify no regression in 058/059 binding gates and commit atomically</name>
  <files>(no files modified — verification + commit)</files>

  <read_first>
    1. Confirm Task 1 left only the test file modified: `git status --short backend/tests/integration/test_threads_skills.py`. The diff should be ~30-50 lines (13 patch-target renames + 13-15 tuple-wrap edits + 1 import line).
    2. Confirm no other files in `backend/` were modified by Task 1 (production code is OFF LIMITS for this phase).
  </read_first>

  <action>
    Run the no-regression check against Phase 058 + 059 binding gates per ROADMAP success criterion #4. The repaired patch target and tuple-shaped return must NOT cascade into a regression in the SSE concurrency or disconnect suites.

    Commands (PowerShell-friendly, sequential — venv activation required per CLAUDE.md):

    ```bash
    cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -q
    cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py -q
    cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py -q
    ```

    All three must report 0 errors and 0 unexpected failures. If any of the 058/059 gates fails, STOP — Plan 01's rename has somehow leaked into the streaming pipeline (extremely unlikely since no production code is touched, but worth proving). Report the failure and do not commit.

    On all-green, create a single atomic commit. Per CLAUDE.md and the planner rule "atomically commit-friendly":

    ```bash
    git add backend/tests/integration/test_threads_skills.py
    git commit -m "test(065-01): rename patch target to create_adaptive_streaming_chat in test_threads_skills.py

    - Rename 13 patch sites: 'app.api.threads.create_streaming_chat' -> 'app.api.threads.create_adaptive_streaming_chat'
    - Tuple-wrap every fake_create_streaming_chat return: 'return iter(...)' -> 'return iter(...), CallingMode.NATIVE'
    - Add 'from app.services.openai_service import CallingMode' import

    The legacy create_streaming_chat is still defined in openai_service.py:770 as a
    backward-compat wrapper, but threads.py imports only create_adaptive_streaming_chat
    (line 33). Patches against the legacy name therefore raised AttributeError on every
    test in this file. The new function returns tuple[stream, calling_mode], which the
    production call site at threads.py:1475 unpacks; fakes must match that shape.

    No production code touched. 058 + 059 binding gates verified green pre-commit.

    Closes part of TEST-DEBT-059 surfaced during Phase 059-02 verification.
    Phase 065 / Plan 01."
    ```

    **Do NOT** use `--no-verify`, `--amend`, or include any other modified file in this commit. The plan owns one file.
  </action>

  <acceptance_criteria>
    1. `pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse` exits 0.
    2. `pytest tests/integration/test_059_disconnect.py` exits 0.
    3. `pytest tests/integration/test_threads_skills.py -q` exits 0 with all-passed output (no errors, no unexpected failures).
    4. `git log -1 --name-only` shows exactly one file (`backend/tests/integration/test_threads_skills.py`) in the new commit.
    5. `git status --short backend/` reports nothing related to test_threads_skills.py (clean working tree for that file).
  </acceptance_criteria>

  <verify>
    <automated>cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py tests/integration/test_threads_skills.py -q 2>&1 | tail -10 && git log -1 --name-only --format="%H%n%s%n%n%b" -- backend/tests/integration/test_threads_skills.py</automated>
    <!-- Expected: pytest exits 0 with all-passed output for 058 + 059 + threads_skills. git log shows the new commit with subject starting "test(065-01): rename patch target...". -->
  </verify>

  <done>
    Atomic commit landed on the current branch. 058 / 059 / test_threads_skills all green. ROADMAP success criterion #1 ("no AttributeError on create_streaming_chat") and #4 ("no regression in 058/059") both satisfied for the test_threads_skills.py surface. Plan 02 (export tests) can run independently against this clean baseline.
  </done>
</task>

</tasks>

<verification>
**Phase-level checks for this plan:**

1. **No AttributeError leakage:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py -q 2>&1 | grep -c "AttributeError.*create_streaming_chat"` returns 0.
2. **No-regression gate:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py -q` exits 0.
3. **Atomic commit hygiene:** `git log -1 --name-only` shows exactly one file changed.
4. **Counter-grep eradication:** `grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c '"app\.api\.threads\.create_streaming_chat"'` returns 0.
</verification>

<success_criteria>
- All tests in `backend/tests/integration/test_threads_skills.py` pass (or are documented skips — but Plan 01 expects all-pass).
- ROADMAP SC #1 satisfied: no `AttributeError: module 'app.api.threads' does not have the attribute 'create_streaming_chat'` in pytest output.
- ROADMAP SC #4 satisfied for this plan's surface: 058 + 059 binding gates green.
- Single atomic commit on current branch with subject `test(065-01): rename patch target to create_adaptive_streaming_chat in test_threads_skills.py`.
- No production code modified. No new files. ~30-50 LOC diff in the test file.
</success_criteria>

<output>
After completion, create `.planning/phases/065-skills-test-infrastructure-repair/065-01-SUMMARY.md` capturing:
- Final patch-site count (must be 13).
- Final tuple-wrap count (every `return iter(...)` followed by `, CallingMode.NATIVE`).
- Pytest result line for `test_threads_skills.py` (e.g., "13 passed in 4.21s").
- Pytest result line for 058 + 059 no-regression gate.
- The single commit SHA.
- Any individual test that surfaced deeper drift beyond the rename (should be zero; if non-zero, list each test name + the assertion that fails + a one-line hypothesis for the next plan to investigate).
</output>
