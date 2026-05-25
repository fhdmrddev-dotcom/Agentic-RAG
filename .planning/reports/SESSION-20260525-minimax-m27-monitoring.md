# Monitoring Report: MiniMax M2.7 via OpenRouter — PPTX Generation Task

**Date:** 2026-05-25
**Provider:** OpenRouter / minimax/minimax-m2.7
**Task:** Generate professional DBA defence PPTX with charts, tables, diagrams, references
**Prompt:** "search for a research that is authored by Fahed MRad, generate a professional-ready pptx to be presnted to the DBA defence committee. Maintain academic and accurate information and make it rich and full with charts, tables, diagrams, refrences."
**Outcome:** FAILED — run marked "failed" after 249.3s; execute_code dispatched but run ended without producing output
**Total duration:** 249.3s (~4 min 9s)
**Run status:** "failed" — 6 tool calls, 5 steps; "Resume" button shown

---

## 1. Timeline

| Elapsed | Step | Event | Tool Time | UI State |
|---------|------|-------|-----------|----------|
| 0:00 | — | Prompt submitted | — | Message sent |
| ~0:03 | 1 | `search_documents` "Fahed MRad research thesis dissertation" | 1.7s | DONE badge |
| ~0:04 | 1 | `query_documents` — SQL metadata query (parallel tool call) | instant | DONE badge |
| ~0:05 | 1 | **Text streamed**: "I found the DBA dissertation by **Fahed Mrad**..." | — | Narration visible between tool calls |
| ~0:08 | 2 | `analyze_document` "Fahed Mrad Chapters 1 to 4.pdf" (sub-agent 1) | 65.8s | RUNNING badge, live text streaming |
| ~0:42 | 2 | Sub-agent 1 streaming — detailed extraction (title, hypotheses H1-H6, methodology N=309, Cronbach's alpha, KMO test) | — | Rich scrollable panel |
| ~1:14 | 2 | Sub-agent 1 completed | — | Green check |
| ~1:29 | 3 | Sub-agent 2 started (second analyze_document on same file) | 94.6s | RUNNING badge |
| ~3:03 | 3 | Sub-agent 2 completed | — | Green check |
| ~3:04 | 4 | `load_skill("pptx")` | instant | Skill description loaded |
| ~3:15 | — | **TTFT gap begins** — model generating execute_code payload | — | "Skill activated: pptx" + "Thinking..." |
| ~3:30 | — | TTFT gap continues | — | Static screen |
| ~3:46 | — | 3 rapid ChatOpenrouter calls (9.1s, 11.2s, 25.3s) | — | "NEXT planning/deciding" visible |
| ~4:05 | 5 | `execute_code` dispatched — "Create DBA defense PPTX presentation" | — | RUNNING badge, code panel visible |
| ~4:09 | — | **Run failed** | — | "Run · 6 tools · failed · 249.3s" + "Resume" button |

## 2. LangSmith Trace Analysis

All 11 LangSmith-tracked runs succeeded individually — the failure was at the orchestration layer, not the LLM layer.

### Token Usage (from LangSmith)

| Call | Input Tokens | Output Tokens | Total | Duration |
|------|-------------|---------------|-------|----------|
| ChatOpenrouter (iter 1) | 81 | 8 | 89 | 1.9s |
| ChatOpenrouter (iter 2) | 5,815 | 141 | 5,956 | 2.6s |
| search-documents | — | — | — | 1.7s |
| ChatOpenrouter (iter 3) | 8,142 | 273 | 8,415 | 5.6s |
| Sub-agent 1 (analyze_document) | **74,052** | **13,834** | **87,886** | 64.9s |
| Sub-agent 2 (analyze_document) | **67,633** | **23,018** | **90,651** | 94.1s |
| ChatOpenrouter (iter 4) | 41,755 | 135 | 41,890 | 9.1s |
| ChatOpenrouter (iter 5) | 44,683 | 65 | 44,748 | 11.2s |
| ChatOpenrouter (iter 6) | 49,391 | 1,655 | 51,046 | 25.3s |
| **Total** | **~291K** | **~39K** | **~331K** | — |

**Key observations:**
- Sub-agents consumed **178K total tokens** (87.9K + 90.7K) — massive context usage
- Post-sub-agent calls show rapidly growing input context (41K → 44K → 49K) as the conversation history accumulates
- Final call produced only 1,655 output tokens — likely the beginning of the execute_code payload before something failed
- **Total token cost: ~331K tokens** — significantly more than GPT 5.4's run

### Probable failure cause
The execute_code step showed "RUNNING" in the UI (code panel was visible with python-pptx imports and a "Midnight Executive" color palette), but the run marked as "failed" shortly after. Possible causes:
1. **Output token limit hit** — the code payload was truncated mid-generation (1,655 tokens in the last call is far short of a complete PPTX generator)
2. **Timeout** — the 249.3s total exceeded the per-model timeout budget
3. **Sandbox execution error** — the partial code was dispatched to Docker but failed to execute

No explicit error message was visible in the UI or backend logs.

## 3. Issues Identified

### Issue A: Two Sequential Sub-Agent Calls (wasteful)

MiniMax ran TWO `analyze_document` sub-agents **sequentially** on the same document — the first (65.5s) and the second (94.6s). Combined: 160s of sub-agent time. GPT 5.4 used a single sub-agent (33.7s). This doubled the extraction phase and consumed 178K tokens.

The second sub-agent appears to have extracted additional detail (23K output tokens vs 13.8K), suggesting MiniMax was trying to get more comprehensive coverage. But this came at a massive time and token cost.

### Issue B: Rapidly Growing Context Window

Post-sub-agent calls show the conversation context growing from 41K → 44K → 49K input tokens across just 3 iterations. This is because both sub-agent outputs (~37K combined output tokens) were accumulated in the conversation history. This context bloat slowed each subsequent call and may have contributed to the truncation.

### Issue C: SQL Metadata Query (same as Kimi k2.6)

Like Kimi, MiniMax passed a SQL metadata query through `query_documents`:
```sql
SELECT filename, metadata FROM documents WHERE metadata::text ILIKE '%Fahed%' OR metadata::text ILIKE '%MRad%'
```
This is the same Phase 076 hallucination pattern. Unlike GPT 5.4's second run (which used a proper text query), both OpenRouter models defaulted to raw SQL.

### Issue D: Text Between Tool Calls (unique to MiniMax)

MiniMax emitted narration text between tool calls: "I found the DBA dissertation by **Fahed Mrad** — *Challenges and Strategies...*. Let me now do a deep analysis to extract all the key content for the presentation."

This is **a positive UX signal** — the user gets feedback about what the model is doing. GPT 5.4 and Anthropic emit zero text between `tool_use` calls (going directly from one tool to the next with only "Thinking..." showing).

### Issue E: Chose PDF Instead of DOCX

MiniMax analyzed the `.pdf` version instead of the `.docx`. The previous providers chose `.docx`. The PDF path may have produced different extraction quality (pypdf vs python-docx).

## 4. Cross-Provider Comparison (updated)

| Aspect | OpenAI (GPT 5.4) | Anthropic (Sonnet 4.6) | Kimi k2.6 | MiniMax M2.7 |
|--------|-------------------|----------------------|-----------|-------------|
| **Outcome** | **SUCCESS** | PARTIAL | FAILED | **FAILED** |
| **Total time** | **178.5s** | ~463s | 1026s | 249.3s |
| **Output** | PPTX (280KB) + 5 PNGs | Partial PPTX | Charts only | None |
| **Tool calls** | 5 | Multiple | 10+ | 6 |
| **Sub-agents** | 1 (33.7s) | 0 | 1 | **2 (160s)** |
| **Total tokens** | Unknown | Unknown | Unknown | **~331K** |
| **TTFT gap** | ~115s | 60-120s/batch | 14+ min | ~60s |
| **Text between tools** | None | None | None | **Yes** |
| **File chosen** | .docx | .docx | .docx | **.pdf** |
| **SQL hallucination** | Yes (test 1) / No (test 2) | N/A | N/A | **Yes** |
| **execute_code success** | Yes (2.6s) | Partial | No | **Failed** |

## 5. What MiniMax Did Well

- **Parallel initial tool calls** — fired `search_documents` and `query_documents` simultaneously in Step 1
- **Text narration between tool calls** — "I found the DBA dissertation..." — gives users feedback about model intent
- **Comprehensive sub-agent extraction** — 37K output tokens of detailed content (hypotheses with H₁/H₀ notation, Cronbach's Alpha values, KMO scores, methodology detail)
- **Styled code output** — the execute_code panel showed a "Midnight Executive" color palette with navy/teal/gold color scheme, helper functions for cards/shapes/bullets — the intended PPTX would have been visually polished
- **Fast initial response** — first tool call at 1.7s, user saw activity immediately

## 6. What MiniMax Did Poorly

- **Double sub-agent calls** — ran two sequential extractions on the same document, wasting 95s and 90K tokens
- **Failed to complete** — the execute_code step was dispatched but the run failed (likely output truncation or timeout)
- **Massive token consumption** — 331K tokens total vs ~120K estimated for GPT 5.4
- **SQL hallucination** — passed raw SQL as metadata filter
- **No output files** — 4+ minutes of work produced zero downloadable files

## 7. Recommendations

### For MiniMax via OpenRouter:
1. **Investigate the execute_code failure** — check if the code was truncated (output token limit) or if sandbox execution errored. The backend logs show no explicit error, suggesting the failure may have been a silent timeout or stream closure.
2. **Cap sub-agent count per document** — prevent the model from running multiple sub-agents on the same document. One comprehensive extraction is sufficient.
3. **Monitor OpenRouter output token limits** — MiniMax M2.7's output may have been capped by OpenRouter's compatibility layer, truncating the execute_code payload mid-generation.

### For the app:
4. **Surface error details on failed runs** — the UI shows "failed" with no explanation. The user has no idea whether it was a timeout, code error, or truncation. Even a generic "Agent reached time limit" or "Code execution failed" would help.
5. **Show partial progress on failed runs** — the sub-agent extractions were valuable content. On failure, the extracted data is lost behind the collapsed run card.

## 8. Files for Reference

- GPT 5.4 report: `.planning/reports/SESSION-20260525-openai-gpt54-monitoring.md`
- Kimi report: `.planning/reports/SESSION-20260525-kimi-openrouter-monitoring.md`
- Streaming investigation: `.planning/reports/SESSION-20260525-streaming-timeout-investigation.md`
- SEED for TTFT gap: `.planning/seeds/SEED-030-streaming-silence-gap-ux.md`
- LangSmith project: `agentic-rag-module2`
