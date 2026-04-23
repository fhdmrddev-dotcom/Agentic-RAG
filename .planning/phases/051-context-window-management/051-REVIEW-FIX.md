---
phase: 051-context-window-management
fixed_at: 2026-04-23T00:00:00Z
review_path: .planning/phases/051-context-window-management/051-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 051: Code Review Fix Report

**Fixed at:** 2026-04-23
**Source review:** .planning/phases/051-context-window-management/051-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 through WR-04; CR and Info excluded by scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `_build_candidate` trim-marker edge case on exhausted history

**Files modified:** `backend/app/services/context_window.py`
**Commit:** d38d1ad
**Applied fix:** Replaced the inline `estimate_messages_tokens(...)` call inside the `if trimmed_any or (...)` condition with a pre-computed `protected_only_tokens` variable that is only evaluated when `not trimmed_any and trimmable == []`. This eliminates the redundant estimation call on the common trim path and clearly documents the degenerate single-turn case where the protected tail alone exceeds the budget.

---

### WR-02: `_remove_oldest_atomic` null `tool_call_id` bulk-remove bug

**Files modified:** `backend/app/services/context_window.py`
**Commit:** 9ab27e5
**Applied fix:** Added `if tool_call_id is not None:` guard around the sibling-tool-message removal loop in the orphaned-tool-message branch. When `tool_call_id` is `None`, the loop is skipped entirely and only the single leading tool message is removed, preventing `None == None` from matching unrelated tool messages and bulk-deleting them.

---

### WR-03: `gpt-5.4-nano` non-existent model ID in sub_agent_service.py

**Files modified:** `backend/app/services/sub_agent_service.py`
**Commit:** 5219b7b
**Applied fix:** Changed `_SUB_AGENT_MODEL_DEFAULTS["openai"]` from `"gpt-5.4-nano"` to `"gpt-4.1-nano"`. The previous value is not a real OpenAI model ID and would cause every OpenAI sub-agent call to fail with a 404/model-not-found error. `gpt-4.1-nano` is the correct current model and is already present in `MODEL_INFO` and `_MODEL_OUTPUT_DEFAULTS`.

---

### WR-04: `handleReset` resets all tabs regardless of active tab

**Files modified:** `frontend/src/pages/SettingsPage.tsx`
**Commit:** 58440cd
**Applied fix:** Updated `handleReset` to only call `hydrate(s)` unconditionally when `activeTab === "0"` (the AI Model tab, most common reset target). When on any other tab, `window.confirm("Reset all unsaved changes across all tabs?")` is shown first. This prevents silent discard of cross-tab edits while keeping the fast path on the primary tab unchanged.

---

_Fixed: 2026-04-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
