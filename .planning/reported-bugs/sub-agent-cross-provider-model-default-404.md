---
id: BUG-260528-01
title: Sub-agent spawned via task() inherits parent provider but uses OpenAI model name → 404 on non-OpenAI parents
reported: 2026-05-28
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/sub-agent, backend/agent-loop, cross-provider]
folded_into: "085"
verified_closed_by: "085"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: d5277a4a3bdef8233deb28aa1a34ab701295c195
  date: 2026-05-28
closed_on: 2026-05-28
closed_by_commit: "Phase 085 Plan 05 (bdd9fd7 fix + e969da4 RED test + bfbaa0d unit tests)"
---

# BUG-260528-01: Sub-agent spawned via `task()` inherits parent provider but uses OpenAI model name → 404 on non-OpenAI parents

## What we observed

During Phase 085 SC#10 4-axis UAT Row 9 (`task` tool / Anthropic claude-haiku-4-5 / sub-agent calling 2 tools), the parent agent emitted the `task()` tool call correctly, but the spawned sub-agent failed within 1.4 seconds with a model-availability error returned to the parent as `tool_result`.

**Reproduction:**
1. Switch active provider to Anthropic (Settings → Set active next to Anthropic).
2. Pick `claude-haiku-4-5-20251001` as the active model.
3. In Settings, confirm the "Sub-agent model" dropdown is set to "Auto (cheapest)" (the default).
4. Start a new chat. Send: `"Use the task tool to spawn a sub-agent. Tell the sub-agent to run two tools in sequence: workspace_list, then search_documents for 'RPA'. Return a one-sentence summary."`
5. Observe the agent emits `task()`, the sub-agent runs ~1.4 seconds, then fails.

**Evidence — Plan 04's GET `/threads/{tid}/tasks` endpoint returns:**

```json
{
  "sub_run_id": "e4b4a6d5-bf13-4abb-b365-70640d9f3a5b",
  "parent_run_id": "f14909f2-9bd9-4acf-b4d8-59f58e50926e",
  "status": "failed",
  "model": "gpt-4.1",
  "provider": "anthropic",
  "started_at": "2026-05-28T15:23:36.521511+00:00",
  "completed_at": "2026-05-28T15:23:37.964994+00:00"
}
```

`provider: "anthropic"` + `model: "gpt-4.1"` is the smoking gun — the sub-agent was issued an OpenAI model name through the Anthropic API endpoint, which Anthropic correctly rejects with HTTP 404 ("model not found" — Anthropic only knows claude-* models).

**Parent agent's recovery message (shown to the user):**
> "I encountered a system error when spawning the sub-agent. The service returned a model availability error (404). This appears to be a temporary issue with the sub-agent infrastructure rather than a problem with your request. However, I can help you directly by running those two tools in sequence..."

**Comparison — Row 8 (OpenAI parent + sub-agent), same UAT session, PASSED:**

```json
{
  "sub_run_id": "e858edac-2b60-4bb7-aca0-103e86b4a5c0",
  "parent_run_id": "52eafe39-7aad-4a46-bfd6-721d0bb01de5",
  "status": "completed",
  "model": "gpt-4.1",
  "provider": "openai",
  ...
}
```

Same `model: "gpt-4.1"` but `provider: "openai"` → completes successfully. Confirms the defect is the provider/model mismatch, not the model name itself.

## Why it matters

This is **D-075.5-04 / FC#5 cross-provider model footgun** — the exact failure mode `backend/app/services/sub_agent_models.py:resolve_sub_agent_model_safely` was created to prevent. Plan 02 (`085-02-task-service`) replicated that safety helper from `sub_agent_service.py:62-89` per D-085-16 specifically because Phase 075.5 had already burned us with this class of error.

**Production impact:**

- Default sub-agent setting is "Auto (cheapest)", which today resolves to `gpt-4.1`.
- 6 of 9 supported providers (Anthropic, Google, OpenRouter, DeepSeek, Moonshot, Ollama) will silently fail with 404/400 when their parent agents call `task()` with default settings.
- The agent recovers gracefully ("I'll help you directly instead"), so the user doesn't see a crash — but the **multi-agent / sub-agent feature is effectively broken for non-OpenAI providers** out of the box.
- This is a SC#10 axis #1 (cross-provider) failure on a brand-new tool that just shipped in this same phase. The integration tests passed because they likely mock the LLM call or run with OpenAI fixtures only — they didn't exercise the cross-provider routing.

## Hypothesized cause

`sub_agent_models.resolve_sub_agent_model_safely` (replicated from `sub_agent_service.py:62-89` per D-085-16) is supposed to detect this mismatch and either (a) switch the sub-agent provider to the model's natural home, or (b) pick a sibling model from the parent's provider, or (c) raise a clear error before the sub-agent starts.

Hypothesis: the helper checks for the "footgun" pattern only when a user explicitly picks a sub-agent model from the dropdown — it does NOT fire on the "Auto (cheapest)" default path, where the resolution short-circuits to `settings.sub_agent_model || first_model_in_active_provider_list`. When `settings.sub_agent_model` is empty, the fallback to "first model in OpenAI's list" is hardcoded as `gpt-4.1` regardless of who the parent is.

Recommended fix direction: make "Auto (cheapest)" honor the parent's provider when picking the model. If parent is Anthropic, pick `claude-haiku-4-5-20251001` (or the cheapest configured haiku/sonnet). If parent is Google, pick `gemini-2.5-flash-lite`. Etc.

## Surface classification

**Surface: Agentic-RAG** — bug lives in our backend Phase 085 implementation, specifically `backend/app/services/sub_agent_models.py` (the freeze-replicated helper from Plan 02) and/or `backend/app/services/task_service.py:run_task_sub_agent` (where the resolution call site lives).

## Suggested routing

- **Fold into in-flight phase:** **085** — this is a Phase 085 acceptance defect found by Phase 085's own SC#10 UAT. Plan 04 cannot be closed clean until this is fixed. Recommended path: insert Plan 05 (gap closure) with one focused task: harden `resolve_sub_agent_model_safely` to cover the "Auto (cheapest)" default path; add integration test that asserts `sub_run.model` matches `sub_run.provider`'s model family for each of the 9 providers.
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- **User-facing workaround:** Settings → AI Model → "Sub-agent model" dropdown → explicitly pick a model matching the active provider (e.g., `claude-haiku-4-5-20251001` when on Anthropic, `gemini-2.5-flash-lite` when on Google). Don't leave it on "Auto (cheapest)" if you intend to use `task()` on non-OpenAI providers.
- **Code-side patch (single line, until Plan 05 fixes properly):** In `backend/app/services/task_service.py:run_task_sub_agent`, before calling the sub-agent, if `settings.sub_agent_model` is empty or "auto", call `resolve_sub_agent_model_safely(active_provider=parent_ctx.provider, requested_model=None)` and have that helper return the cheapest model from the parent's provider's model list — not from OpenAI's.

## SC#10 UAT context

| Axis | Coverage during UAT | Pass count |
|------|---------------------|------------|
| Cross-provider | OpenAI, Anthropic, Google, OpenRouter | 4/4 PASS on ask_user (Rows 1-4); 1/2 PASS on task (Row 8 OpenAI ✓ / Row 9 Anthropic ✗) |
| Multi-tool | write_todos + ask_user (Row 12 ✓), task→2 sub-agent tools (Row 8 ✓, Row 9 ✗) | 2/3 |
| Parallel-thread | Thread A paused, Thread B running (Row 5 ✓ via direct API; UI hung on rapid switch) | 1/1 |
| Long-message | Rows 15, 16 deferred — depend on Row 9 fix |  |

8 PASS / 1 FAIL / 4 deferred (would also fail until this bug is fixed or run on OpenAI only) / 3 operator-only rows (6, 7, 18) deferred to operator session.

## Closure verification

**Closed by:** Phase 085 Plan 05 (`085-05-sub-agent-cross-provider-fix`) — 2026-05-28.

**Root cause confirmed in code:** the safety check at `sub_agent_models.py:58` only fired when `override_model` was truthy. The production call site at `task_service.py:229` passes `override_model=None` per D-085-11. The final return chain on lines 71-76 then leaked `user_settings.llm_model` (which can be stale-cross-provider — e.g., still `"gpt-4.1"` after the user toggled `active_provider="anthropic"`) straight to the provider client.

**Fix shipped (`bdd9fd7`):** `resolve_sub_agent_model_safely` now always validates the resolved candidate against the active provider's model list — regardless of whether `override_model` is truthy. If the candidate is not in the active provider's family AND `_SUB_AGENT_MODEL_DEFAULTS[active_provider]` has a non-empty entry, the helper returns that provider default. For flexible providers (openrouter, ollama) with intentionally empty defaults, the helper keeps the candidate as best-effort and emits a WARNING log.

**Test evidence (`e969da4` RED → `bdd9fd7` GREEN → `bfbaa0d` unit coverage):**

```
backend/tests/integration/test_085_sub_agent_cross_provider.py — 8/8 PASS
  - test_cross_provider_default_path_no_footgun[openai]      PASS
  - test_cross_provider_default_path_no_footgun[anthropic]   PASS  ← was FAIL pre-fix
  - test_cross_provider_default_path_no_footgun[google]      PASS  ← was FAIL pre-fix
  - test_cross_provider_default_path_no_footgun[openrouter]  PASS
  - test_cross_provider_default_path_no_footgun[deepseek]    PASS  ← was FAIL pre-fix
  - test_cross_provider_default_path_no_footgun[moonshot]    PASS  ← was FAIL pre-fix
  - test_cross_provider_default_path_no_footgun[ollama]      PASS
  - test_provider_default_table_covers_all_uat_axis_providers PASS

backend/tests/unit/test_085_task_service.py — 23/23 PASS (4 new + 19 prior)
  - test_resolve_falls_back_when_user_settings_llm_model_is_cross_provider  (new — root case)
  - test_resolve_returns_candidate_when_provider_default_is_empty           (new — flexible providers)
  - test_resolve_short_circuits_when_candidate_in_active_list               (new — happy path)
  - test_resolve_with_empty_active_models_list_skips_validation             (new — empty-list edge)
```

**Full Phase 085 suite:** 105/105 PASS — no regressions in unit or integration tests.

**D-085-16 freeze preserved:** `git diff master..HEAD -- backend/app/services/sub_agent_service.py` returns 0 lines (the frozen file was not modified).

**UAT matrix:** Row 9 flipped from ❌ FAIL → ✅ PASS (Plan 05 re-verification). Rows 19 (DeepSeek `task`) + 20 (Moonshot `task`) added with PASS evidence. SC#10 cross-provider `task`-axis coverage is now 6 providers wide (was 2 pre-Plan-05). See `085-VALIDATION.md` `## UAT Re-run Session Log — 2026-05-28 (Plan 05 gap closure)`.

**Operator final sign-off:** Plan 05 Task 5 emits a `checkpoint:human-action` requesting the operator perform a live-UI walkthrough of Row 9 (Anthropic + `task`) before phase verification proceeds. This is belt-and-suspenders — the structural fix is proven by the integration test, but the operator's lived-experience sign-off closes the loop for the `feedback_uat_lived_experience_gap` rule.
