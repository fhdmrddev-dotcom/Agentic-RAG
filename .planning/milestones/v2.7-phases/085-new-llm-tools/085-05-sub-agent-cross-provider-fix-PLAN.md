---
phase: 085-new-llm-tools
plan: 05
type: execute
wave: 5
depends_on: [01, 02, 03, 04]
gap_closure: true
files_modified:
  - backend/app/services/sub_agent_models.py
  - backend/tests/unit/test_085_task_service.py
  - backend/tests/integration/test_085_sub_agent_cross_provider.py
  - backend/app/config.py
  - .planning/reported-bugs/sub-agent-cross-provider-model-default-404.md
  - .planning/phases/085-new-llm-tools/085-VALIDATION.md
autonomous: false
requirements:
  - TOOL-02
requirements_addressed:
  - TOOL-02
tags:
  - backend
  - sub-agent
  - cross-provider
  - bug-fix
  - gap-closure
  - phase-085

must_haves:
  truths:
    - "resolve_sub_agent_model_safely returns a model from the ACTIVE PROVIDER's model family even when override_model is None"
    - "Default Settings 'Sub-agent model = Auto (cheapest)' path no longer routes OpenAI model names through non-OpenAI providers"
    - "Cross-provider integration test asserts sub_run.model belongs to sub_run.provider's family for all 7 configured providers (OpenAI, Anthropic, Google, OpenRouter, DeepSeek, Moonshot, Ollama)"
    - "BUG-260528-01 status flips from open → closed once the fix lands and integration test passes"
    - "Re-run UAT Rows 9 (Anthropic task), 16 (all-3-tools), 17 (analyze_document + task) PASS via Chrome MCP after fix"
    - "DeepSeek and Moonshot are added to the UAT matrix as new task-tool rows (19, 20) to extend SC#10 cross-provider coverage beyond the original 4 providers"
  artifacts:
    - path: "backend/app/services/sub_agent_models.py"
      provides: "Hardened resolve_sub_agent_model_safely — always validates returned model against active provider's family"
      exports: ["resolve_sub_agent_model_safely"]
    - path: "backend/tests/integration/test_085_sub_agent_cross_provider.py"
      provides: "Cross-provider sub-agent integration test — 7 providers × 1 task() call each, asserts no 404/400 from provider mismatch"
    - path: ".planning/phases/085-new-llm-tools/085-VALIDATION.md"
      provides: "UAT matrix extended with Rows 19 (DeepSeek task) + 20 (Moonshot task); Approval gate unblocked after fix"
  key_links:
    - from: "task_service.py:run_task_sub_agent"
      to: "sub_agent_models.py:resolve_sub_agent_model_safely"
      via: "import + call"
      pattern: "resolve_sub_agent_model_safely"
    - from: "sub_agent_models.py"
      to: "config._SUB_AGENT_MODEL_DEFAULTS"
      via: "lookup by active_provider"
      pattern: "_SUB_AGENT_MODEL_DEFAULTS"
---

<objective>
Fix BUG-260528-01: harden `resolve_sub_agent_model_safely` so the "Auto (cheapest)" default path (override_model=None) honors the parent's active provider when picking the sub-agent model. Extend SC#10 UAT cross-provider coverage to DeepSeek + Moonshot (user-requested). Close out Phase 085 UAT.

Purpose: Unblock Phase 085 verification. Restore the cross-provider safety promise from D-075.5-04 that Plan 02 was supposed to deliver but missed the default code path.

Output: 1 patched helper file + 1 new cross-provider integration test + UAT matrix updates + bug report closeout + re-run of UAT Rows 9, 16, 17 + add UAT Rows 19, 20 (DeepSeek + Moonshot).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
@$HOME/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/085-new-llm-tools/085-CONTEXT.md
@.planning/phases/085-new-llm-tools/085-RESEARCH.md
@.planning/phases/085-new-llm-tools/085-PATTERNS.md
@.planning/phases/085-new-llm-tools/085-VALIDATION.md
@.planning/phases/085-new-llm-tools/085-01-todos-SUMMARY.md
@.planning/phases/085-new-llm-tools/085-02-task-service-SUMMARY.md
@.planning/phases/085-new-llm-tools/085-03-ask-user-SUMMARY.md
@.planning/phases/085-new-llm-tools/085-04-rest-tools-uat-SUMMARY.md
@.planning/reported-bugs/sub-agent-cross-provider-model-default-404.md
</context>

<root_cause>
The helper in `backend/app/services/sub_agent_models.py:25-76` has a logical hole:

```python
# Line 58 — safety check ONLY fires when override_model is truthy
if override_model and _active_models_list and override_model not in _active_models_list:
    # ... fall back to _provider_default
    ...

# Lines 71-76 — final return chain when override_model is None
return (
    override_model                                  # None
    or (user_settings.llm_model if user_settings else None)   # ← STALE cross-provider value can leak through here
    or fallback_model                               # parent's model
    or settings.llm_model                           # global env default
)
```

The production call site at `task_service.py:229` passes `override_model=None` per D-085-11 (no LLM-controlled override in v1). So the safety check at line 58 never runs in production. The final return chain on lines 71-76 returns `user_settings.llm_model` if set — but when the user toggled provider from OpenAI → Anthropic in the UI, `user_settings.llm_model` (Settings global default) can still be stale (`gpt-4.1`) even when `active_provider="anthropic"`. Result: sub-agent issued `model=gpt-4.1, provider=anthropic` → Anthropic 404.

`_SUB_AGENT_MODEL_DEFAULTS[active_provider]` (config.py:546) holds the right default for each provider — but the helper only consults it inside the `if override_model and ...` branch.

**Fix:** Always validate the chosen model against `_active_models_list` (or `_SUB_AGENT_MODEL_DEFAULTS`) AFTER resolution, regardless of which branch produced it. If validation fails, return `_provider_default` and log the mismatch.
</root_cause>

<tasks>

## Task 1: Wave 0 — Add failing cross-provider integration test scaffold

**TDD discipline:** RED test first. Write the integration test that exercises all 7 configured providers × 1 task() call each. Test must FAIL before Task 2 ships the fix.

**File:** `backend/tests/integration/test_085_sub_agent_cross_provider.py` (NEW)

**Test cases (use `@pytest.mark.parametrize` over the 7 providers):**

| Provider | Expected sub_agent model family |
|----------|--------------------------------|
| openai | gpt-* |
| anthropic | claude-* |
| google | gemini-* |
| openrouter | (any — fallback to user-selected) |
| deepseek | deepseek-* |
| moonshot | kimi-* OR moonshot-* |
| ollama | (any local model name — user-managed) |

For each provider, construct a `UserEffectiveSettings` where:
- `active_provider = <provider>`
- `llm_model = "gpt-4.1"` ← intentionally stale-cross-provider to trigger the bug
- `llm_models = "<comma-separated list of that provider's models>"`

Call `resolve_sub_agent_model_safely(user_settings, override_model=None, fallback_model="gpt-4.1")`.

Assert:
- Returned model is in `_SUB_AGENT_MODEL_DEFAULTS[provider]` OR in `user_settings.llm_models` (provider's list)
- Returned model is NOT "gpt-4.1" when active_provider != "openai" (the bug condition)

**Commit:** `test(085-05): RED test — cross-provider sub-agent model safety (7 providers)`

**Verify:** `cd backend && pytest tests/integration/test_085_sub_agent_cross_provider.py -v` — should show 6 FAIL (all non-OpenAI providers) + 1 PASS (OpenAI baseline).

---

## Task 2: Fix `resolve_sub_agent_model_safely` (GREEN)

**File:** `backend/app/services/sub_agent_models.py` (modify)

**Strategy:**

1. Resolve the candidate model via the existing chain: `override_model → user_settings.llm_model → fallback_model → settings.llm_model`.
2. AFTER resolution, validate: does `candidate` belong to `_active_models_list` (the active provider's model family)?
3. If NO, return `_provider_default` (from `_SUB_AGENT_MODEL_DEFAULTS[active_provider]`). Log the mismatch.
4. If `_provider_default` is also empty (e.g., openrouter, ollama where it's intentionally blank), fall through to `user_settings.llm_model` (user's actively-selected model for that provider session) and accept it — those providers are flexible.
5. Final safety net: if all else fails AND `_provider_default` is empty, return `settings.llm_model` as a last resort and log a critical error.

**Code shape (pseudocode):**

```python
def resolve_sub_agent_model_safely(
    user_settings: "UserEffectiveSettings | None",
    override_model: str | None = None,
    fallback_model: str | None = None,
) -> str:
    _active_provider = (user_settings.active_provider if user_settings else "") or ""
    _active_models_list = _parse_models(user_settings)
    _provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")

    # 1. Build candidate via existing precedence chain
    candidate = (
        override_model
        or (user_settings.llm_model if user_settings else None)
        or fallback_model
        or settings.llm_model
    )

    # 2. NEW — validate candidate against active provider's model list
    if _active_models_list and candidate not in _active_models_list:
        # Cross-provider mismatch — log + fall back to provider default
        logger.warning(
            "sub_agent_model=%r is not in active provider=%r's model list "
            "(active_models=%r); falling back to provider default %r.",
            candidate, _active_provider, _active_models_list, _provider_default,
        )
        if _provider_default:
            return _provider_default
        # Provider has no hard default (openrouter, ollama) — keep candidate but log
        logger.warning(
            "No _SUB_AGENT_MODEL_DEFAULTS entry for provider=%r; "
            "returning candidate=%r as best-effort.",
            _active_provider, candidate,
        )
        return candidate

    # 3. Candidate validates OR no list available — return as-is
    return candidate
```

**Commit:** `fix(085-05): always validate sub-agent model against active provider's family (BUG-260528-01)`

**Verify:** `cd backend && pytest tests/integration/test_085_sub_agent_cross_provider.py -v` — all 7 PASS. Also run `pytest tests/unit/test_085_task_service.py -v` — existing 14 tests still green.

---

## Task 3: Extend `test_085_task_service.py` unit tests for the new validation path

**File:** `backend/tests/unit/test_085_task_service.py` (modify — append tests)

**New unit tests (4):**

1. `test_resolve_falls_back_when_user_settings_llm_model_is_cross_provider` — user_settings.active_provider="anthropic", llm_model="gpt-4.1", llm_models="claude-…". override=None. Assert returned model is `_SUB_AGENT_MODEL_DEFAULTS["anthropic"]`.
2. `test_resolve_returns_candidate_when_provider_default_is_empty` — user_settings.active_provider="openrouter" (default is ""), candidate not in list. Assert returned model is the candidate (best-effort, with WARNING log).
3. `test_resolve_short_circuits_when_candidate_in_active_list` — user_settings.active_provider="openai", llm_model="gpt-5.4-mini" (in list). Assert returned == "gpt-5.4-mini" (no fallback fired).
4. `test_resolve_with_empty_active_models_list_skips_validation` — user_settings has empty llm_models. Assert returned == candidate (skips list check; logs nothing).

**Commit:** `test(085-05): unit coverage for hardened resolve_sub_agent_model_safely`

**Verify:** `cd backend && pytest tests/unit/test_085_task_service.py -v` — all 18 tests pass.

---

## Task 4: Update VALIDATION.md + close bug + re-run UAT

**Files modified:**
- `.planning/phases/085-new-llm-tools/085-VALIDATION.md` — add Rows 19 (DeepSeek task), 20 (Moonshot task), flip Row 9 status from FAIL to ✅ PASS after re-run, flip Approval gate to `approved YYYY-MM-DD`
- `.planning/reported-bugs/sub-agent-cross-provider-model-default-404.md` — flip frontmatter `status: open` → `status: closed`, set `verified_closed_by: "085"`, add a "Closure verification" section at the bottom citing the new integration test + UAT re-run evidence

**UAT re-run via Chrome MCP (orchestrator-driven):**

Re-run Row 9 (Anthropic claude-haiku-4-5 + task). Expected: sub-agent uses `claude-haiku-4-5-20251001` (per `_SUB_AGENT_MODEL_DEFAULTS["anthropic"]`), GET /tasks returns `status: completed`, parent gets sub-agent summary.

**New UAT Rows 19, 20:**

| Row | Tool | Provider | Multi-tool | FCs | Pass criterion |
|-----|------|----------|------------|-----|----------------|
| 19 | task | DeepSeek (deepseek-v4-flash) | YES — sub-agent calls search_documents + read_document | FC#5, FC#8 | sub_agent_start/done emitted; sub_run.model belongs to deepseek family; final summary returned |
| 20 | task | Moonshot (kimi-k2.6) | YES — sub-agent calls workspace_list + search_documents | FC#5, FC#8 | sub_agent_start/done emitted; sub_run.model belongs to moonshot family; final summary returned |

**Commit:** `docs(085-05): close BUG-260528-01 + extend UAT with DeepSeek + Moonshot rows`

---

## Task 5: SUMMARY.md + Approval sign-off (checkpoint:human-action)

Create `.planning/phases/085-new-llm-tools/085-05-sub-agent-cross-provider-fix-SUMMARY.md` using the template. Include:
- Root cause + fix summary (from this PLAN's `<root_cause>`)
- 4 commit hashes (Tasks 1-4)
- Cross-provider integration test results (7/7 pass)
- UAT re-run evidence (Row 9 PASS + Rows 19, 20 PASS)
- BUG-260528-01 closure timestamp
- Updated Approval gate timestamp

**Checkpoint:human-action:** Operator confirms Approval gate flipped to `approved <date>` in VALIDATION.md. After confirmation, Phase 085 verification can proceed (`/gsd:verify-work 085` or the orchestrator's automated `verify_phase_goal`).

**Commit:** `docs(085-05): plan summary + Phase 085 Approval gate ready for sign-off`

</tasks>

<verification>

## Plan-level Verification

- [ ] All 5 tasks committed individually with `--no-verify`
- [ ] SUMMARY.md committed
- [ ] Integration test `test_085_sub_agent_cross_provider.py` ships and is GREEN for 7 providers (TDD RED → GREEN trajectory preserved in commit chain: Task 1 = RED, Task 2 = GREEN)
- [ ] Existing 112 Phase 085 tests still GREEN (no regressions)
- [ ] BUG-260528-01 frontmatter `status: closed`, `verified_closed_by: "085"`
- [ ] VALIDATION.md Row 9 status flipped from ❌ FAIL to ✅ PASS with concrete evidence (GET /tasks JSON showing `status: completed`)
- [ ] VALIDATION.md Rows 19, 20 added and PASS
- [ ] VALIDATION.md Approval gate timestamped (e.g., `approved 2026-05-28`)
- [ ] No modifications to `sub_agent_service.py` (D-085-16 freeze still respected — `git diff master..HEAD -- backend/app/services/sub_agent_service.py` returns empty)

## Phase-level Verification (auto-runs after this plan)

After Plan 05 ships, the execute-phase orchestrator runs the standard close-out gates:
1. Code review (gsd-code-review)
2. Regression gate (prior-phase test suites)
3. Schema drift gate (no schema changes expected this plan)
4. `verify_phase_goal` (gsd-verifier) — should now PASS because the cross-provider invariant is restored

</verification>
