---
phase: 074-seed-009-seed-011-polish-bundle
reviewed: 2026-05-18T00:00:00Z
depth: quick
files_reviewed: 6
files_reviewed_list:
  - backend/app/config.py
  - backend/app/services/openai_service.py
  - backend/tests/unit/test_resolve_max_tokens.py
  - backend/tests/integration/conftest.py
  - backend/tests/integration/test_062_stream_replay.py
  - backend/tests/integration/test_063_post_then_subscribe.py
findings_count:
  critical: 0
  warning: 0
  info: 2
  total: 2
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 074: Code Review Report

**Reviewed:** 2026-05-18
**Depth:** quick
**Files Reviewed:** 6
**Status:** issues_found (info only — no blocking issues)

## Summary

Polish bundle scoped to SEED-009 (per-model `max_tokens` clamp gate in
`_resolve_max_tokens`) and SEED-011 (hoist of `_reset_redis_singleton`
fixture into `tests/integration/conftest.py`). The diff is tight, well
commented with explicit citations to RESEARCH.md decisions and pitfalls,
and the unit-test coverage for the clamp gate is thorough (boundary
cases, pass-through for missing registry / missing key, `:exacto` strip,
defensive `:free`-not-stripped case).

Quick-depth scan results:
- No hardcoded secrets (the `"test-key"` literals in
  `test_resolve_max_tokens.py` are `MagicMock` scaffolding values for
  `s.llm_api_key`, not real credentials — standard test pattern).
- No dangerous functions (`eval`, `exec`, `shell_exec`, etc.).
- No debug artifacts (`TODO`, `FIXME`, `XXX`, `HACK`, `debugger`).
- No empty `except: pass` blocks.

Two minor info-level observations below — neither blocks merge.

## Info

### IN-01: `import asyncio as _asyncio_inner` placed inline inside test body

**File:** `backend/tests/integration/test_063_post_then_subscribe.py:110`
**Issue:** `asyncio` is imported inline inside the test function body with
a rename (`_asyncio_inner`) rather than at module top. The sibling file
`test_062_stream_replay.py` imports `asyncio` at the top level
(line 11) and uses it as `await asyncio.sleep(0.2)` (line 87). The
test_063 form
```python
import asyncio as _asyncio_inner
await _asyncio_inner.sleep(0.2)
```
works fine but is inconsistent with 062 and re-runs the import every
test invocation. The rename was presumably defensive (against shadowing
something named `asyncio` higher up), but nothing at module scope shadows
it — module top is safe.

**Fix:** Hoist to module imports for consistency with `test_062`:
```python
# top of file (alphabetical with other stdlib)
import asyncio
...
# inside test
await asyncio.sleep(0.2)
```

### IN-02: `_FALLBACK_MAX_TOKENS` (8192) does not have a clamp safety-net

**File:** `backend/app/services/openai_service.py:687, 702, 717-727`
**Issue:** When `model_id` is empty string (legacy mode with no model
set anywhere — `user_settings.llm_model` empty AND `settings.llm_model`
empty), `_resolve_max_tokens` skips the clamp block entirely (`if
model_id:` guard at line 718). For any normal config path
`settings.llm_model` defaults to `"gpt-4o"` (config.py:286), so this
empty-string branch is essentially unreachable in production — but the
clamp's silent skip rather than fall-through is worth a brief comment
on line 718 to confirm the behavior is intentional (D-074-02
pass-through-when-no-registry-entry, applied here as
pass-through-when-no-model-id-at-all).

**Fix:** Optional one-line comment to document the intentional skip:
```python
# D-074-02 pass-through: with no model_id we cannot resolve a registry
# entry, so the clamp gate is bypassed (matches the no-registry-entry path).
if model_id:
    lookup_key = ...
```
This is purely documentation polish — the runtime behavior is correct.

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
