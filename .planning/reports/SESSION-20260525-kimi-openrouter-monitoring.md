# Monitoring Report: Kimi k2.6 via OpenRouter — PPTX Generation Task

**Date:** 2026-05-25
**Provider:** OpenRouter / moonshotai/kimi-k2.6
**Task:** Generate DBA defence PPTX from 180-page dissertation
**Outcome:** FAILED — no PPTX generated, max_iterations exhausted
**Total duration:** 1026s (17 minutes)
**Run status:** "done" (misleading — hit max_iterations without completing the task)

---

## 1. Timeline

| Elapsed | Event | UI State |
|---------|-------|----------|
| 0:00 | Prompt submitted | Message sent |
| ~0:10 | `analyze_document` sub-agent starts | Sub-agent text streaming visibly — good UX |
| ~0:25 | Sub-agent completes | Full document extraction visible in tool body |
| ~0:30 | `execute_code` — "Generating chart images" | RUNNING badge, live code panel with matplotlib |
| ~0:40 | Charts completed (5 PNG files) | Download cards visible: chart_correlation.png (82.8KB), chart_demographics.png (73.4KB), chart_hypothesis.png (71.6KB), chart_market_growth.png (56.3KB), chart_success_framework.png (70.5KB) |
| ~0:45 | **TTFT gap #1 begins** | "NEXT planning next step... queued" + "Thinking..." |
| ~1:15 | `load_skill("pptx")` #2 fires | Brief activity, then back to silence |
| ~5:00 | `load_skill("pptx")` #3-4 fire | loadSkillCount climbs to 4, then 5 |
| ~10:00 | Still in silence | "NEXT deciding next step... queued" — 10 minutes of frozen screen |
| ~14:00 | Tool call syntax leaks as text | Raw `<\|tool_calls_section_begin\|>` markup visible in chat |
| ~17:00 | `max_iterations` (15) exhausted | Run marked "done", follow-up questions shown, no PPTX |

## 2. Issues Identified

### Issue A: TTFT Silence Gap (same as all providers)

The inter-batch silence gap lasted **14+ minutes** — from charts completing (~0:45) to the run ending (~17:00). The user saw a completely static screen the entire time.

This is the same fundamental gap documented in SESSION-20260525-streaming-timeout-investigation.md — the backend has no data from the provider during the code-generation TTFT window.

### Issue B: Structured-Mode Tool Parsing Failure (Kimi-specific)

**Root cause:** Kimi k2.6's native tool call format uses `<|tool_calls_section_begin|>` / `<|tool_call_begin|>` / `<|tool_call_argument_begin|>` delimiters. The OpenRouter OpenAI-compatibility layer is supposed to parse these into standard `tool_calls` in the response, but it **failed** for the `execute_code` call.

**Evidence:** Raw tool call markup appeared as text in `message.content`:
```
<|tool_calls_section_begin|> <|tool_call_begin|> functions.execute_code:16 <|tool_call_argument_begin|> {"code":
```

**Consequence:** The model kept trying to call `execute_code` but the calls were never parsed as tool invocations. Instead, the raw text was streamed as `delta` events. The model then re-loaded the pptx skill (5 times total) hoping to "unlock" the execute_code capability, and eventually gave up after exhausting max_iterations.

**This is likely a known OpenRouter issue with Kimi's tool calling for large argument payloads.** The chart-generation `execute_code` call worked (smaller code), but the PPTX-generation call (500+ lines of python-pptx code) exceeded whatever buffer/parsing limit OpenRouter has for Kimi's tool format.

### Issue C: load_skill Loop

Kimi called `load_skill("pptx")` **5 times** during the run. Each call is instant but wastes an iteration. The system prompt says "ONLY call `load_skill(skill_name)` when the user explicitly names a skill" — but Kimi ignored this and kept re-loading it, possibly because the tool call failures made it think the skill wasn't loaded.

### Issue D: "Done" Status Misleading

The run shows "✓ done" because the model eventually emitted a text response (follow-up questions) on the last iteration. But the task was NOT completed — no PPTX was generated. The "done" status is technically correct (the model returned a response) but misleading from the user's perspective.

## 3. Comparison with Anthropic (Sonnet 4.6)

| Aspect | Anthropic (Sonnet 4.6) | Kimi k2.6 (OpenRouter) |
|--------|----------------------|----------------------|
| Initial tool selection | search_documents → load_skill → read_skill_file | analyze_document (sub-agent) |
| Sub-agent streaming | N/A (no sub-agent used) | Visible text streaming — good UX |
| Chart generation | Inline in PPTX code (matplotlib) | Separate execute_code step first |
| PPTX code generation | Works but hits TTFT gap (60s+) | **FAILS** — tool call parsing broken |
| Tool call format | Anthropic native (works) | Kimi native (`<\|tool_calls\|>`) — broken via OpenRouter |
| TTFT gap duration | ~60-120s per batch | 14+ minutes (entire remaining run) |
| Outcome | Slides 1-5 generated, then API credit error | Charts only, no PPTX, max_iterations exhausted |
| Text duplication | Yes (narration repeated 4x) | Not observed (different text pattern) |
| Total time | ~463s (failed at API limit) | 1026s (completed but task not done) |

## 4. Provider-Specific Observations

### What Kimi Did Well
- **Sub-agent streaming**: The `analyze_document` sub-agent showed live text extraction — much better UX than Anthropic's silent approach
- **Strategy**: Generating charts first as separate images, then building PPTX, is actually a better approach (smaller execute_code calls, reusable assets)
- **Chart quality**: Generated 5 meaningful charts from the dissertation data

### What Kimi Did Poorly
- **Tool call parsing**: The core `execute_code` call for PPTX generation failed silently
- **Iteration waste**: Loaded the pptx skill 5 times unnecessarily
- **No error surfacing**: The tool call failure was never shown to the user — just silence
- **Gave up without explanation**: The final response asks follow-up questions instead of explaining that it couldn't generate the code

## 5. Recommendations

### For the OpenRouter/Kimi path specifically:
1. **Investigate OpenRouter tool call parsing for large args** — the chart execute_code (small) succeeded but the PPTX execute_code (large) failed. There may be a payload size limit in OpenRouter's Kimi compatibility layer.
2. **Detect raw tool call markup in deltas** — if `<|tool_calls_section_begin|>` appears as text content, the backend could intercept it and either retry or surface an error instead of silently streaming it as text.
3. **Cap `load_skill` calls per run** — prevent the model from wasting iterations re-loading the same skill. After 2 calls to the same skill, return "already loaded" without consuming an iteration.

### For all providers:
4. **TTFT silence gap** — remains the #1 UX issue across all providers. See SEED-030 for proposed approaches.
5. **"Done" vs "task completed" distinction** — the run can be "done" (model responded) without the task being completed. Consider surfacing whether output files were produced.

## 6. Files for Reference

- Session report: `.planning/reports/SESSION-20260525-streaming-timeout-investigation.md`
- SEED for future work: `.planning/seeds/SEED-030-streaming-silence-gap-ux.md`
- Timeout config: `backend/app/config.py` MODEL_CAPABILITIES registry
- Tool parsing: `backend/app/services/openai_service.py` (OpenRouter structured mode)
