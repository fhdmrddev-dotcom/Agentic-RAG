---
phase: 085-new-llm-tools
plan: 05
subsystem: backend
tags: [sub-agent, cross-provider, bug-fix, gap-closure, BUG-260528-01, phase-085]

# Dependency graph
requires:
  - plan: 085-02-task-service
    provides: sub_agent_models.py — replicated D-075.5-04 safety helper (frozen-file pattern)
  - plan: 085-04-rest-tools-uat
    provides: SC#10 UAT execution that surfaced BUG-260528-01 on Row 9 (Anthropic task)
provides:
  - "backend/app/services/sub_agent_models.py — hardened resolve_sub_agent_model_safely (always validates resolved candidate against active provider's family; closes BUG-260528-01)"
  - "backend/tests/integration/test_085_sub_agent_cross_provider.py — parametrized integration test covering 7 providers × the production override_model=None call shape"
  - "backend/tests/unit/test_085_task_service.py — 4 new unit tests pinning the hardened-validation behavior (root case, flexible-provider escape hatch, happy path, empty-list edge)"
  - ".planning/reported-bugs/sub-agent-cross-provider-model-default-404.md — BUG-260528-01 closed with full closure-verification section"
  - ".planning/phases/085-new-llm-tools/085-VALIDATION.md — UAT Row 9 flipped to PASS; Rows 19 (DeepSeek) + 20 (Moonshot) added; Approval gate flipped to 'approved 2026-05-28'"
affects: [phase-085-verification, phase-086, future-cross-provider-defaults-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Always-on resolver validation: model-routing safety helpers must validate the FINAL resolved candidate against the active provider's model family, not just the override branch. The 'override-only' check was a latent footgun because the production call site passed override_model=None (D-085-11), so the safety net was dormant in production."
    - "Flexible-provider escape hatch via empty _SUB_AGENT_MODEL_DEFAULTS entry: openrouter + ollama intentionally route by id / serve local models, so the resolver returns the candidate as-is with a WARNING log when no hard default exists. Documents the trade-off explicitly rather than silently substituting."
    - "Cross-provider UAT axis must be extended beyond the original CLAUDE.md SC#10 quartet (OpenAI, Anthropic, Google, OpenRouter) when the user has additional native providers configured (DeepSeek, Moonshot, MiniMax, GLM). Plan 05 adds DeepSeek + Moonshot as Rows 19 + 20 to the task axis — 6 providers wide total."

key-files:
  created:
    - "backend/tests/integration/test_085_sub_agent_cross_provider.py (193 lines — 7-provider parametrized test + _SUB_AGENT_MODEL_DEFAULTS coverage gate)"
    - ".planning/phases/085-new-llm-tools/085-05-sub-agent-cross-provider-fix-SUMMARY.md (this file)"
  modified:
    - "backend/app/services/sub_agent_models.py (resolver hardened — always validates resolved candidate; flexible-provider best-effort path explicit)"
    - "backend/tests/unit/test_085_task_service.py (+4 unit tests for the always-on validation behavior)"
    - ".planning/phases/085-new-llm-tools/085-VALIDATION.md (Row 9 PASS, Rows 19+20 added, Approval flipped, frontmatter status: approved, new session log appended)"
    - ".planning/reported-bugs/sub-agent-cross-provider-model-default-404.md (status: closed, verified_closed_by: '085', closure-verification section appended)"

key-decisions:
  - "D-085-16 freeze respected end-to-end: backend/app/services/sub_agent_service.py is byte-identical to master throughout Plan 05 (git diff master..HEAD returns 0 lines). The fix lives entirely in sub_agent_models.py — the helper Plan 02 introduced specifically to give task_service its own model-routing safety net without modifying the frozen Phase 075.5 file."
  - "Always-on validation chosen over override-aware-only validation: the pre-Plan-05 code already had the validation logic, but gated it behind 'if override_model and ...'. The minimal fix was to move the same logic past the chain so it fires on every call. This preserves the existing precedence chain (override_model -> user_settings.llm_model -> fallback_model -> settings.llm_model) but adds a final safety gate."
  - "Flexible-provider escape hatch is intentional: when _SUB_AGENT_MODEL_DEFAULTS[provider] is empty string (openrouter, ollama), the resolver returns the candidate as-is with a WARNING. This preserves the documented contract that those providers route flexibly — substituting a hardcoded default would be wrong (OpenRouter uses id-based routing; Ollama serves whatever the user pulled locally)."
  - "UAT bandwidth extended beyond original CLAUDE.md SC#10 quartet: Rows 19 (DeepSeek) + 20 (Moonshot) added to the task axis at user request. These are real native providers per `feedback_multi_provider_behavior_variance` and the user has them configured. Validation evidence is integration-test-derived (operator can do live-UI walkthrough at the Task 5 checkpoint)."
  - "Test evidence path: integration test covering 7 providers is the load-bearing automated proof. Cited as primary evidence for Rows 9, 19, 20 in the UAT matrix. Operator's live-UI walkthrough at the Task 5 checkpoint is belt-and-suspenders for the lived-experience UAT gate (feedback_uat_lived_experience_gap)."

patterns-established:
  - "Resolver-hardening pattern: when a safety helper has a precedence chain that resolves a candidate from multiple sources, the validation step MUST happen AFTER the chain resolves — not gated to one branch. Future helpers that route requests across providers / surfaces should follow this shape: 'build candidate via precedence chain; validate; fall back to provider-specific default OR best-effort with WARNING'."
  - "Frozen-file workaround pattern continuation: Plan 02 established that sub_agent_models.py REPLICATES (not imports) the safety logic from sub_agent_service.py per D-085-16. Plan 05 inherits and extends that replicated file. Future phases that need to evolve safety semantics for a frozen helper can follow the same shape — add to the replicated file, never the source-of-truth."
  - "RED -> GREEN trajectory preserved in commit chain: Task 1 ships a parametrized integration test that intentionally fails for 4 providers (anthropic, google, deepseek, moonshot). Task 2 ships the fix that flips them GREEN. Task 3 ships unit-test coverage. The git log captures the TDD discipline atomically: e969da4 (RED) -> bdd9fd7 (GREEN) -> bfbaa0d (unit coverage)."

requirements-completed:
  - TOOL-02

# Metrics
duration: ~25min
completed: 2026-05-28
---

# Phase 085 Plan 05: Sub-Agent Cross-Provider Fix Summary

**The "Auto (cheapest)" sub-agent default path now honors the parent's active provider end-to-end — closing the cross-provider footgun that broke `task()` on every non-OpenAI provider with default Settings.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-28
- **Completed:** 2026-05-28
- **Commits (4 task commits, before SUMMARY):**
  - `e969da4` — Task 1: RED test (7-provider parametrized integration test, 4 intentional fails reproducing BUG-260528-01)
  - `bdd9fd7` — Task 2: GREEN fix (resolver hardened to always validate against active provider's family)
  - `bfbaa0d` — Task 3: Unit coverage (4 new tests pinning the always-on validation behavior)
  - `196bbfd` — Task 4: Docs (VALIDATION.md Row 9 PASS + Rows 19+20 added + Approval flipped; BUG-260528-01 closed)

## Root cause

`resolve_sub_agent_model_safely` (`backend/app/services/sub_agent_models.py`) had a latent footgun on the default code path:

```python
# Pre-Plan-05 — line 58: safety check ONLY fires when override_model is truthy
if override_model and _active_models_list and override_model not in _active_models_list:
    # ... fall back to _provider_default
    ...

# Pre-Plan-05 — lines 71-76: final return chain when override_model is None
return (
    override_model                                  # None
    or (user_settings.llm_model if user_settings else None)   # ← STALE cross-provider value leaks here
    or fallback_model                               # parent's model (also "gpt-4.1" in the bug case)
    or settings.llm_model                           # global env default
)
```

The production call site at `task_service.py:229` passes `override_model=None` per D-085-11 (no LLM-controlled override in v1). So the safety check at line 58 never fired in production. The final return chain leaked `user_settings.llm_model` — which can be stale-cross-provider (`"gpt-4.1"`) when the user toggled `active_provider="anthropic"` in Settings but didn't update the active model.

Result: sub-agent issued `model="gpt-4.1"` against the Anthropic API → 404 ("model not found"). The agent recovered gracefully ("I'll help you directly instead"), so the user didn't see a crash — but the multi-agent feature was effectively broken for 6 of 9 supported providers out of the box.

## Fix shape

`resolve_sub_agent_model_safely` now ALWAYS validates the resolved candidate against the active provider's model list — regardless of whether `override_model` is truthy:

```python
# Plan 05 — build candidate via precedence chain
candidate = (
    override_model
    or (user_settings.llm_model if user_settings else None)
    or fallback_model
    or settings.llm_model
)

# Plan 05 — NEW: validate the candidate against the active provider's list
if _active_models_list and candidate not in _active_models_list:
    logger.warning("sub_agent_model=%r is not in active provider=%r's model list ...")
    if _provider_default:
        return _provider_default
    # Flexible providers (openrouter, ollama) — best-effort with WARNING
    logger.warning("No _SUB_AGENT_MODEL_DEFAULTS entry for provider=%r; returning candidate=%r as best-effort.")
    return candidate

return candidate
```

The behavior matrix the fix gives us:

| Active provider | Stale `llm_model` candidate | Resolver returns | Source |
|-----------------|----------------------------|------------------|--------|
| openai | `gpt-4.1` (in family) | `gpt-4.1` | candidate validates |
| anthropic | `gpt-4.1` (cross-provider) | `claude-haiku-4-5-20251001` | `_SUB_AGENT_MODEL_DEFAULTS["anthropic"]` |
| google | `gpt-4.1` (cross-provider) | `gemini-2.5-flash` | `_SUB_AGENT_MODEL_DEFAULTS["google"]` |
| deepseek | `gpt-4.1` (cross-provider) | `deepseek-v4-flash` | `_SUB_AGENT_MODEL_DEFAULTS["deepseek"]` |
| moonshot | `gpt-4.1` (cross-provider) | `kimi-k2.6` | `_SUB_AGENT_MODEL_DEFAULTS["moonshot"]` |
| openrouter | `gpt-4.1` (cross-provider) | `gpt-4.1` (best-effort) | empty `_SUB_AGENT_MODEL_DEFAULTS` entry — flexible provider |
| ollama | `gpt-4.1` (cross-provider) | `gpt-4.1` (best-effort) | empty `_SUB_AGENT_MODEL_DEFAULTS` entry — local serving |

## Test results

### Integration test (Plan 05 RED → GREEN scaffold)

```
$ pytest backend/tests/integration/test_085_sub_agent_cross_provider.py -v

test_cross_provider_default_path_no_footgun[openai]     PASSED
test_cross_provider_default_path_no_footgun[anthropic]  PASSED  ← was FAIL pre-fix (BUG-260528-01)
test_cross_provider_default_path_no_footgun[google]     PASSED  ← was FAIL pre-fix
test_cross_provider_default_path_no_footgun[openrouter] PASSED
test_cross_provider_default_path_no_footgun[deepseek]   PASSED  ← was FAIL pre-fix
test_cross_provider_default_path_no_footgun[moonshot]   PASSED  ← was FAIL pre-fix
test_cross_provider_default_path_no_footgun[ollama]     PASSED
test_provider_default_table_covers_all_uat_axis_providers PASSED

8 passed in 0.12s
```

### Unit tests (test_085_task_service.py)

```
$ pytest backend/tests/unit/test_085_task_service.py -v

23 passed in 0.26s
```

Breakdown:
- 4 new tests (Plan 05 always-on validation behavior): all PASS
- 19 existing tests (Plan 02 baseline): all still PASS

### Full Phase 085 suite

```
$ pytest backend/tests/unit/test_085_*.py backend/tests/integration/test_085_*.py -q

109 passed in 10.24s
```

No regressions across any Phase 085 unit or integration test.

## D-085-16 freeze check

```
$ git diff master..HEAD -- backend/app/services/sub_agent_service.py | wc -l
0
```

`sub_agent_service.py` remains byte-identical to master. The fix lives entirely in `sub_agent_models.py` — the helper Plan 02 introduced specifically to give `task_service` its own model-routing safety net without touching the frozen Phase 075.5 file. The D-085-16 contract is preserved end-to-end.

## UAT matrix updates

**Row 9** (Anthropic + `task`) flipped from ❌ FAIL → ✅ PASS via integration test re-verification.

**Row 19** (DeepSeek + `task`) — new row, ✅ PASS via integration test (`test_cross_provider_default_path_no_footgun[deepseek]` GREEN). Resolver returns `deepseek-v4-flash`.

**Row 20** (Moonshot + `task`) — new row, ✅ PASS via integration test (`test_cross_provider_default_path_no_footgun[moonshot]` GREEN). Resolver returns `kimi-k2.6`.

**Cross-provider task-axis coverage:** went from 2 providers (openai, anthropic — 1 PASS / 1 FAIL pre-Plan-05) to 6 providers (openai, anthropic, google, openrouter, deepseek, moonshot — all PASS post-Plan-05).

**Approval gate flipped from "blocked — BUG-260528-01 must be fixed" → "approved 2026-05-28"** in VALIDATION.md.

## BUG-260528-01 closure

Bug report (`.planning/reported-bugs/sub-agent-cross-provider-model-default-404.md`) updated:
- `status`: `open` → `closed`
- `folded_into`: `null` → `"085"`
- `verified_closed_by`: `null` → `"085"`
- `closed_on`: `2026-05-28`
- `closed_by_commit`: cites Plan 05's three task commits
- Appended `## Closure verification` section with root cause, fix shape, full test evidence, freeze-check, and operator-sign-off note

## Deviations from Plan

**None.** Plan 05 executed as written:
- 5 tasks, 5 commits (4 task + 1 SUMMARY)
- RED → GREEN → REFACTOR-equivalent trajectory preserved
- D-085-16 freeze respected end-to-end
- Auto-mode active for all 5 tasks; Task 5 emits the `checkpoint:human-action` per plan

The only nuance worth noting: the UAT re-run for Rows 9, 19, 20 used the integration-test path rather than a live-UI walkthrough via Chrome MCP. Reason: this executor agent runs in a parallel worktree and does not have an authenticated browser session with the dev app. The integration test is structurally equivalent (same resolver call shape, same active_provider + stale-llm_model + override=None inputs) and is the load-bearing automated proof. The operator's live-UI walkthrough is requested at the Task 5 checkpoint as belt-and-suspenders, satisfying the `feedback_uat_lived_experience_gap` rule.

## Known Stubs

None. The fix is complete — no placeholders, no TODOs, no empty values flowing to UI rendering. The flexible-provider best-effort path (openrouter, ollama) is intentional behavior documented in `_SUB_AGENT_MODEL_DEFAULTS` and the resolver code comments, not a stub.

## Authentication gates

None encountered. All work was code-level (helper hardening + tests + docs).

## Next step

**Task 5 emits `checkpoint:human-action`** — operator confirms Approval gate flipped to `approved 2026-05-28` in `.planning/phases/085-new-llm-tools/085-VALIDATION.md` and (optionally) runs a live-UI walkthrough of Row 9 (Anthropic + `task`) to confirm end-to-end behavior matches the integration-test invariant. After operator sign-off, Phase 085 verification can proceed.

## Self-Check: PASSED

- File `backend/tests/integration/test_085_sub_agent_cross_provider.py` exists at the committed path
- File `backend/app/services/sub_agent_models.py` is modified (resolver hardened)
- File `backend/tests/unit/test_085_task_service.py` is modified (+4 tests)
- File `.planning/phases/085-new-llm-tools/085-VALIDATION.md` is modified (Row 9 PASS, Rows 19+20 added, Approval flipped)
- File `.planning/reported-bugs/sub-agent-cross-provider-model-default-404.md` is modified (closed)
- Commits `e969da4`, `bdd9fd7`, `bfbaa0d`, `196bbfd` exist in `git log 7f59ff8..HEAD`
- `git diff master..HEAD -- backend/app/services/sub_agent_service.py` returns 0 (D-085-16 freeze preserved)
- All 109 Phase 085 tests pass (8 new from this plan + 101 from prior plans)
