# Monitoring Report: DeepSeek V4 Pro via OpenRouter — PPTX Generation Task

**Date:** 2026-05-25
**Provider:** OpenRouter / deepseek/deepseek-v4-pro
**Task:** Generate professional DBA defence PPTX with charts, tables, diagrams, references
**Prompt:** (same as all providers)
**Outcome:** SUCCESS — `Fahed_Mrad_DBA_Defense_Presentation.pptx` (425.3 KB) + 10 chart PNGs, 29 slides
**Total duration:** ~1434s (~23 min 54s) wall time (run card showed 275.5s — timer excludes sub-agent time)
**Run status:** "done" — 6 tool calls, 9 steps
**Total LangSmith tokens:** ~893K (nearly 1M)

**Pre-test fix:** Added `deepseek/deepseek-v4-pro` to MODEL_CAPABILITIES registry (timeout=900s, max_output=65536).

---

## 1. Timeline

| Elapsed | Step | Event | Duration | UI State |
|---------|------|-------|----------|----------|
| 0:00 | — | Prompt submitted | — | |
| ~0:04 | 1 | `query_documents` — SQL hallucination (FROM-clause error) | 48ms | Error visible |
| ~0:04 | 1 | `list_folder "/DBA"` — fallback | 34ms | "0 folders, 2 documents" |
| ~0:15 | 2 | `analyze_document` — sub-agent 1 (DOCX) via deepseek-v4-pro | **127.9s** | RUNNING, live streaming |
| ~2:13 | 2 | Sub-agent 1 completed (88K tokens) | — | Green check |
| ~2:15 | 3 | `analyze_document` — sub-agent 2 (PDF) via deepseek-v4-pro | **116.5s** | RUNNING |
| ~4:12 | 3 | Sub-agent 2 completed (97.6K tokens) | — | Green check |
| ~4:15 | 4 | `load_skill("pptx")` + `read_skill_file` | ~17s | DONE |
| ~4:30 | — | **TTFT gap #1 begins** | — | Ghost state — no visible indicator |
| ~12:42 | 5 | `execute_code` #1 — charts + PPTX Part 1 | **491.8s** LLM + exec | Code panel appears, executes |
| ~12:42 | — | **TTFT gap #2 begins** | — | Static screen again |
| ~20:47 | 6 | `execute_code` #2 — PPTX Part 2 | **485.6s** LLM + exec | Code panel appears, executes |
| ~21:40 | 7-8 | Post-execution iterations | ~49s | Planning |
| ~23:18 | 9 | Final text response — 29-slide breakdown | ~18s | Rich slide table |
| ~23:54 | — | Done — 3 follow-ups, Final outputs | — | 11 download links |

## 2. LangSmith Token Analysis

| Phase | Tokens | % of total |
|-------|--------|-----------|
| Sub-agents (2 calls) | 185,608 | 20.8% |
| Code gen #1 (491.8s) | 80,788 | 9.0% |
| Code gen #2 (485.6s) | 102,016 | 11.4% |
| Post-exec iterations (3 calls) | 308,696 | 34.6% |
| Other iterations (6 calls) | 215,892 | 24.2% |
| **Total** | **~893,000** | **100%** |

**This is the most expensive run by far** — 893K tokens vs ~340K (MiniMax, failed), ~331K (MiniMax est.), and unknown but estimated ~200K for GPT 5.4.

## 3. Output Files (11 total)

| File | Size |
|------|------|
| `Fahed_Mrad_DBA_Defense_Presentation.pptx` | **425.3 KB** |
| chart_cronbach.png | 45.5 KB |
| chart_csf_ranking.png | 41.4 KB |
| chart_failure_rate.png (batch 1) | 31.9 KB |
| chart_hypotheses.png (batch 1) | 85.5 KB |
| chart_predictors.png | 38.6 KB |
| chart_rpa_market.png | 39.3 KB |
| chart_efa.png | 33.6 KB |
| chart_failure_rate.png (batch 2) | 29.5 KB |
| chart_hypotheses.png (batch 2) | 84.7 KB |
| chart_strategies.png | 51.7 KB |

**Note:** Duplicate chart names across batches (failure_rate, hypotheses) — the multi-batch approach regenerated some charts. Total unique charts: 8.

## 4. Slide Structure (29 slides)

| Section | Slides | Content |
|---------|--------|---------|
| Title & Outline | 1-2 | Title slide + agenda |
| Part 01 — Introduction | 3-6 | Research problem, gap, purpose, questions ($22.79B, 43.9% CAGR, 30-50% failure) |
| Part 02 — Literature Review | 7-9 | TOE + BPM + STS framework, challenges & CSFs, market + failure charts |
| Part 03 — Methodology | 10-12 | Mixed methods (N=309 + N=8), constructs, 6 hypotheses |
| Part 04 — Quantitative Results | 13-17 | Cronbach's alpha, EFA, descriptive stats, hypothesis testing, CSF ranking |
| Part 05 — Qualitative Validation | 18-20 | Expert CSFs, strategy effectiveness, challenges |
| Part 06 — SUCCESS Framework | 21-23 | Six pillars, readiness assessment, sustainability |
| Part 07 — Discussion | 24-28 | Contributions, recommendations, limitations, 16 references |
| Thank You | 29 | Q&A |

## 5. Issues Identified

### Issue A: ~8 min per code generation call (2 calls = ~16 min of TTFT)
Two execute_code LLM calls: 491.8s and 485.6s. Combined TTFT: **~16 minutes** of waiting for code to generate. During both gaps, the UI showed zero progress — ghost state with static text and no visible activity indicator.

### Issue B: ~893K total tokens (most expensive run)
Nearly 1 million tokens for a single PPTX generation task. Driven by: dual sub-agents (185K), massive accumulated context (post-exec calls at 102K input each), and two large code payloads (22.6K + 21.8K output).

### Issue C: 4x text duplication
"I found two versions..." repeated 4 times in the response text. Same pattern as Anthropic.

### Issue D: Sub-agent panel rendered 3x in DOM
Same sub-agent panel appeared at 3 different points, creating a 19,007-line DOM snapshot (1.1 MB). **Chrome DevTools MCP crashed** during monitoring due to the DOM size.

### Issue E: Ghost state for 5+ minutes
After sub-agents completed and skill loaded, the bottom of the chat showed static narration text. No spinner, no timer, no "Thinking..." visible. The active indicator was scrolled above the viewport.

### Issue F: Run card timer misleading (275.5s vs ~1434s actual)
The run card showed "275.5s" but the actual wall time was ~24 minutes. The timer appears to exclude sub-agent execution time, giving a false impression of a fast run.

### Issue G: Duplicate chart names across batches
Two batches generated charts with the same filenames (chart_failure_rate.png, chart_hypotheses.png). The second batch's files may overwrite the first in the sandbox.

## 6. What DeepSeek V4 Pro Did Well

- **Richest slide structure** — 29 slides (most of any provider), well-organized into 7 thematic sections
- **8 unique charts** embedded from actual data — Cronbach's alpha, CSF ranking, hypotheses, EFA, market growth, failure rate, predictors, strategies
- **"Dark/Light sandwich" design** — professional visual structure with section dividers
- **Comprehensive extraction** — analyzed BOTH DOCX and PDF, extracting all 30 tables with page numbers
- **Good chat title** — "Research by Fahed MRad PPTX"
- **Text narration** — gave feedback about intent between tool calls
- **Graceful SQL recovery** — fell back to list_folder after hallucinated SQL failed

## 7. Final Scoreboard (6 providers)

| | GPT 5.4 | Sonnet 4.6 | Gemini 3.5 | Kimi k2.6 | MiniMax M2.7 | DeepSeek V4 |
|---|---|---|---|---|---|---|
| **Outcome** | SUCCESS | SUCCESS | SUCCESS | FAILED | FAILED | **SUCCESS** |
| **Wall time** | **178.5s** | 1116.7s | **272s** | 1026s | 249.3s | **~1434s** |
| **PPTX size** | 280 KB | 573 KB | 218 KB | — | — | **425 KB** |
| **Slides** | ~12 | 19 | ~14 | — | — | **29** |
| **Charts** | 5 | 10 | 2 | 5 (lost) | 0 | **8** |
| **Total output** | 548 KB | 1,202 KB | 401 KB | 0 | 0 | **~907 KB** |
| **Total tokens** | ~200K est. | unknown | unknown | unknown | 331K | **893K** |
| **TTFT (biggest)** | 115s | 267s | 88s | 14+ min | 60s | **492s** |
| **Ghost state** | No | No | Yes (88s) | No | No | **Yes (5+ min)** |
| **Text dup** | None | 4x | None | None | None | **4x** |

## 8. Files for Reference

- Master findings: `.planning/reports/SESSION-20260525-ux-status-fidelity-findings.md`
- Config change: `backend/app/config.py` (added deepseek-v4-pro registry entry)
- LangSmith project: `agentic-rag-module2`
