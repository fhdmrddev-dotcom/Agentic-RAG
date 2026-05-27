---
phase: 083-foundation-tool-dispatch-extraction-bug-fixes
reviewed: 2026-05-28T22:15:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/app/services/tool_dispatcher.py
  - backend/app/api/threads.py
  - backend/tests/unit/test_tool_dispatcher.py
  - backend/tests/unit/test_075_1_observability.py
  - frontend/src/lib/api.ts
  - frontend/src/components/chat/MessageList.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 083: Code Review Report

**Reviewed:** 2026-05-28T22:15:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 083 extracted the ~800 LOC tool-dispatch elif chain from threads.py into a clean registry-pattern dispatcher (tool_dispatcher.py), wired it into the agent loop, and closed 4 bugs (output file reconstruction, timer stability, Kimi think filter, title generation). The extraction is structurally sound -- ToolContext/ToolResult dataclasses are well-designed, the registry pattern is clean, and the 16 handlers faithfully reproduce the original behavior.

One critical issue was found: the title generation fallback path calls `.strip()` on a potentially-None value (AttributeError crash). Three warnings cover a code injection surface in sandbox file injection, a latent mutation-loss path in execute_code, and insufficient sanitization of skill filenames containing path traversal characters. Three informational items cover code quality.

## Critical Issues

### CR-01: Title generation fallback crashes on None content

**File:** `backend/app/api/threads.py:1055`
**Issue:** In the `generate_thread_title` function's `NotFoundError` fallback path, `response.choices[0].message.content.strip()` is called without guarding against `None`. The OpenAI SDK types `message.content` as `Optional[str]`. If the fallback model returns a response with `content=None` (e.g., a tool_call-only response, or a refusal with no text), this raises `AttributeError: 'NoneType' object has no attribute 'strip'`. The primary path at line 1023 correctly guards with `(response.choices[0].message.content or "").strip()`, but the fallback path does not.

This is caught by the broad `except Exception` at line 1056, so it doesn't crash the request -- but it silently swallows the error and returns a truncated-message fallback title instead of the LLM-generated one, making the fallback path partially dead code.

**Fix:**
```python
# Line 1055: add None guard matching the primary path
return (response.choices[0].message.content or "").strip() or "New Chat", fallback_info
```

## Warnings

### WR-01: Sandbox file injection filename allows code injection via string interpolation

**File:** `backend/app/services/tool_dispatcher.py:513-519`
**Issue:** The `safe_name` sanitization for skill file injection into the sandbox only escapes single quotes (`sf_filename.replace("'", "\\'")`). However, the filename is interpolated into an f-string that becomes executable Python code inside the sandbox container. A filename containing characters like `'); import os; os.system('...` or newlines would break out of the string context and execute arbitrary code.

While the sandbox is a Docker container with limited blast radius, and the filename originates from a DB record (not direct user input in this request), the LLM controls the `skill_files` argument and could potentially craft a malicious filename if a skill was saved with a pathological name. This is a defense-in-depth concern.

**Fix:**
```python
# Replace the manual escape with repr() which handles all special characters
safe_name = sf_filename.replace("/", "_").replace("\\", "_")  # strip path separators
b64 = base64.b64encode(sf_bytes).decode("ascii")
file_preamble += (
    f"import base64 as _b64, os as _os\n"
    f"_os.makedirs('/sandbox', exist_ok=True)\n"
    f"with open('/sandbox/' + {repr(safe_name)}, 'wb') as _f:\n"
    f"    _f.write(_b64.b64decode({repr(b64)}))\n"
    f"print('Injected skill file: ' + {repr(safe_name)})\n"
)
```

### WR-02: execute_code previous_files_in_run fallback creates orphaned dict

**File:** `backend/app/services/tool_dispatcher.py:451`
**Issue:** When `ctx.previous_files_in_run` is `None`, a new empty dict is created locally. The handler then mutates this dict at line 681 (`_previous_files_in_run.update(_iter_files)`), but since it's a local object not referenced by the caller's ToolContext, those mutations are lost. The next `execute_code` call in the same agent loop iteration would create another orphaned dict, losing cross-call file tracking and potentially causing duplicate file entries in the final output.

In practice, threads.py always passes a non-None dict (line 2609 references `_previous_files_in_run` initialized at line 1780), so this fallback path is currently dead. However, if a future caller (e.g., Phase 084/085 tools) creates a ToolContext without setting `previous_files_in_run`, file tracking silently breaks with no error.

**Fix:**
```python
# Option A: Fail explicitly if the contract is violated
if ctx.previous_files_in_run is None:
    ctx.previous_files_in_run = {}
_previous_files_in_run = ctx.previous_files_in_run

# Option B: Or at minimum, assign back to ctx so subsequent calls see it
_previous_files_in_run = ctx.previous_files_in_run if ctx.previous_files_in_run is not None else {}
if ctx.previous_files_in_run is None:
    ctx.previous_files_in_run = _previous_files_in_run
```

### WR-03: read_skill_file and execute_code skill injection lack path traversal guard on filename

**File:** `backend/app/services/tool_dispatcher.py:389` and `backend/app/services/tool_dispatcher.py:509`
**Issue:** The `filename` argument from the LLM tool call is used directly in Supabase storage path construction (`f"{row['user_id']}/{row['id']}/{filename}"`) and in the sandbox file path (`f"/sandbox/{safe_name}"`). A filename like `../../etc/passwd` or `../../../important_file` would construct a storage path that traverses outside the expected directory.

For the Supabase storage path (line 389), the storage API likely handles this server-side, but it's not guaranteed. For the sandbox path (line 517), a traversal filename like `../../etc/crontab` could write to an unintended location inside the container.

The risk is limited because: (1) Supabase storage paths are flat keys, not filesystem paths; (2) the sandbox is a disposable Docker container. But this is a defense-in-depth gap.

**Fix:**
```python
# In both _handle_read_skill_file and _handle_execute_code skill injection:
import os.path
basename = os.path.basename(filename)  # strips all directory components
if not basename or basename != filename:
    return ToolResult(result=json.dumps({"error": f"Invalid filename: {filename}"}))
```

## Info

### IN-01: Kimi think filter does not handle partial tag at chunk boundary

**File:** `backend/app/api/threads.py:2248-2266`
**Issue:** The think tag filter state machine handles `<think>` and `</think>` tags that arrive within a single chunk, and correctly handles tags split across chunks (e.g., chunk 1 has content before `<think>`, chunk 2 has the thinking text, chunk 3 has `</think>`). However, if a chunk boundary falls within the tag name itself (e.g., chunk 1 ends with `<thi` and chunk 2 starts with `nk>`), the `find()` calls would not match and the partial tag would leak into visible content as literal text `<thi` + `nk>`.

The 083-03-SUMMARY.md acknowledges this: "In practice, Kimi sends `<think>` tags as atomic tokens so cross-chunk tag splitting is extremely unlikely." This is informational because the practical risk is negligible -- LLM tokenizers almost always emit XML-like tags as single tokens. No fix needed unless a provider is found to split mid-tag.

### IN-02: Test mutates global _TOOL_REGISTRY during test execution

**File:** `backend/tests/unit/test_tool_dispatcher.py:136-152`
**Issue:** `test_dispatch_routes_to_correct_handler` directly mutates the module-level `_TOOL_REGISTRY` dict (replacing the `ls` handler with a mock, then restoring it in a `finally` block). While the `finally` ensures cleanup, this creates a test ordering dependency -- if another test runs concurrently or if the `finally` block doesn't execute (e.g., process kill), the registry is corrupted.

**Fix:** Use `unittest.mock.patch.dict` which handles cleanup automatically:
```python
from unittest.mock import patch

async def _mock_ls(args, ctx):
    return ToolResult(result="mocked_ls_output")

with patch.dict(_TOOL_REGISTRY, {"ls": _mock_ls}):
    result = await dispatch_tool("ls", {}, ctx)
    assert result.result == "mocked_ls_output"
```

### IN-03: ToolContext uses Any types for typed fields

**File:** `backend/app/services/tool_dispatcher.py:54-59`
**Issue:** Several ToolContext fields are typed as `Any` (`redis`, `supabase`, `pool`, `user_settings`) despite having known types available in TYPE_CHECKING imports (line 39-42). The TYPE_CHECKING-guarded imports are present but unused in the field annotations. Using `Any` reduces IDE assistance and type checker coverage.

**Fix:** Use string annotations (already enabled by `from __future__ import annotations`) with the TYPE_CHECKING types:
```python
@dataclass
class ToolContext:
    redis: aioredis.Redis
    run_id: UUID
    thread_id: str
    supabase: Client
    pool: asyncpg.Pool
    user_settings: UserEffectiveSettings | None
    # ...
```

---

_Reviewed: 2026-05-28T22:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
