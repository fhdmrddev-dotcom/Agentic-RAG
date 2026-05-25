# Monitoring Report: OpenAI GPT 5.4 — PPTX Generation Task

**Date:** 2026-05-25
**Provider:** OpenAI / gpt-5.4
**Task:** Generate professional DBA defence PPTX with charts, tables, diagrams, references
**Prompt:** "search for a research that is authored by Fahed MRad, generate a professional-ready pptx to be presnted to the DBA defence committee. Maintain academic and accurate information and make it rich and full with charts, tables, diagrams, refrences."
**Outcome:** SUCCESS — `Fahed_Mrad_DBA_Defence_Committee_Deck.pptx` (280.0 KB) + 5 chart images generated
**Total duration:** 178.5s (~2 min 58s)
**Run status:** "done" — task genuinely completed, 6 output files produced and downloadable

---

## 1. Timeline

| Elapsed | Step | Event | Tool Time | UI State |
|---------|------|-------|-----------|----------|
| 0:00 | — | Prompt submitted | — | Message sent |
| ~0:03 | 1 | `search_documents` — proper text query "research authored by Fahed Mrad..." | 3.5s | DONE badge |
| ~0:07 | 2 | `search_file_contents` — regex "Fahed\s+Mrad\|Fahed\s+MRad" | 43ms | DONE badge, "2 matches" |
| ~0:08 | 3 | `analyze_document` — sub-agent on "Fahed Mrad Chapters 1 to 4.docx" | 33.7s | RUNNING badge, live text streaming |
| ~0:12 | 3 | Sub-agent streaming visible — structured extraction with headings | — | Title/Topic, Research Problem, Objectives... scrollable |
| ~0:42 | 3 | Sub-agent completed — comprehensive DBA defence outline | — | Green check |
| ~0:45 | 4 | `load_skill("pptx")` | instant | Skill description loaded, green check |
| ~0:58 | — | **TTFT gap begins** — model generating execute_code payload | — | "Skill activated: pptx" + "Thinking..." |
| ~1:07 | — | TTFT gap continues — screen static, "Thinking..." | — | No change for 14s |
| ~1:30 | — | TTFT gap continues — 72s elapsed, step timer at 141s | — | Run card header timer spinning, nothing else |
| ~1:49 | — | TTFT gap continues — 107s elapsed | — | Still "Thinking..." |
| ~2:05 | — | TTFT gap continues — ~120s of silence | — | Identical screenshot to 58s mark |
| ~2:53 | 5 | `execute_code` — "Generating DBA defence PowerPoint presentation" | **2.6s** | Python code panel with rich imports (pptx.chart, CategoryChartData, MSO_SHAPE, MSO_CONNECTOR) |
| ~2:53 | 5 | Output files: PPTX (280 KB) + 5 PNGs (framework, gender, hypo, means, roles) | — | Download cards visible |
| ~2:58 | 6 | Final text response with slide summary + 3 follow-ups | — | Clean markdown, "Final outputs" section with 6 download links |

## 2. Issues Identified

### Issue A: TTFT Silence Gap (~115s between skill load and execute_code)

The dominant issue. Between Step 4 (load_skill at ~0:58) and Step 5 (execute_code at ~2:53) — approximately **115 seconds** of "Thinking..." with **zero visual change**. The user saw the exact same screen for nearly 2 minutes.

During this window, GPT 5.4 was generating a massive python-pptx code payload that included:
- python-pptx slide creation with widescreen layout
- CategoryChartData for embedded charts
- matplotlib figure generation for 5 separate chart images
- MSO_SHAPE/MSO_CONNECTOR for diagram elements
- Table construction with styled cells
- References slide with proper citations

**The code was rich and correct**, but the generation time was invisible to the user. The only indicator was the run card header timer (which required scrolling up to see) and the spinning "Thinking..." indicator at the bottom.

**Comparison to simpler prompt:** When tested with a simpler prompt ("generate a DBA defence PPTX"), the TTFT gap was ~43s and produced a 52.9 KB text-only deck. The richer prompt caused a **2.7x longer gap** (115s vs 43s) because the code payload was much larger.

### Issue B: No SQL Hallucination (improved over simpler prompt test)

Unlike the simpler prompt test (which hallucinated a raw SQL metadata query), this run used proper tool calls:
- `search_documents` with natural language query — DONE in 3.5s, returned results
- `search_file_contents` with regex — 43ms, 2 matches

This suggests the SQL hallucination from the simpler prompt may have been a one-off, not a systematic issue with GPT 5.4.

### Issue C: Step-List Collapse Hides Output Files

After the run completes, the expanded step details (including the code panel and the 6 output file cards from the execute_code step) are collapsed into a "Run · 5 tool calls · done · 178.5s" summary. The user can still access files via the "Final outputs" section at the bottom, but the in-step context (what code generated which file) is lost unless they expand.

## 3. What GPT 5.4 Did Well

### a) Rich output — charts, tables, diagrams, and PPTX all in one call
The model generated **6 output files** in a single execute_code call:

| File | Size | Description |
|------|------|-------------|
| `Fahed_Mrad_DBA_Defence_Committee_Deck.pptx` | 280.0 KB | Full defence deck |
| `framework.png` | 82.6 KB | Conceptual framework diagram |
| `gender.png` | 32.2 KB | Gender distribution chart |
| `hypo.png` | 39.6 KB | Hypotheses relationship diagram |
| `means.png` | 71.0 KB | Means comparison chart |
| `roles.png` | 42.8 KB | Roles distribution chart |

Total output: **548.2 KB** across 6 files. The PPTX is **5.3x larger** than the simple-prompt version (280 KB vs 52.9 KB), confirming the model responded to the richer prompt with genuinely richer content.

### b) Correct tool strategy — no wasted iterations
5 tool calls, 6 steps, no retries, no wasted `load_skill` calls. Every tool call served a purpose:
1. Find the research → 2. Verify author → 3. Extract content → 4. Load PPTX skill → 5. Generate everything

### c) Comprehensive sub-agent extraction (33.7s)
The `analyze_document` sub-agent prompt was specifically tailored for this prompt: "Extract a comprehensive, academically accurate presentation outline for a DBA defence committee. Include... quantitative values, categories, models, or relationships that can be visualized as charts, tables, or diagrams." The extraction took 33.7s with live streaming throughout.

### d) Clean response text with proper structure
Response identified both DBA folder documents (.docx and .pdf), explained which was used as primary source, listed the PPTX and its contents, and offered 3 follow-ups:
- More visually premium version with branding/icons
- 20-slide extended viva version with speaker notes
- Matching Word briefing document

### e) Reliable tool call parsing for massive payload
The execute_code call contained hundreds of lines of python-pptx + matplotlib code. Parsed and executed correctly on the first attempt (2.6s execution). No syntax leakage, no partial parsing.

## 4. Cross-Provider Comparison

| Aspect | OpenAI (GPT 5.4) | Anthropic (Sonnet 4.6) | Kimi k2.6 (OpenRouter) |
|--------|-------------------|----------------------|----------------------|
| **Outcome** | **SUCCESS** — PPTX + 5 charts | PARTIAL — slides 1-5, then API credit error | **FAILED** — no PPTX, max_iterations |
| **Total time** | **178.5s** | ~463s (failed) | 1026s (failed) |
| **Output files** | **6** (PPTX + 5 PNGs) | Partial PPTX only | Charts only, no PPTX |
| **PPTX size** | **280.0 KB** | N/A (incomplete) | N/A (not generated) |
| **Tool calls** | 5 | Multiple batches | 10+ (5 skill loads wasted) |
| **execute_code success** | Yes (2.6s) | Yes (but hit credit limit) | **No** — tool parsing broken |
| **TTFT gap (largest)** | **~115s** | ~60-120s per batch | 14+ minutes |
| **Charts generated** | **5** (framework, gender, hypo, means, roles) | None | 5 (but never made it to PPTX) |
| **search_documents** | Proper text query (3.5s) | N/A (used different approach) | N/A |
| **Sub-agent streaming** | Good UX (33.7s, live text) | No sub-agent used | Good UX (live text) |
| **Text duplication** | None | Yes (4x narration) | None |
| **load_skill calls** | 1 | N/A | 5 (wasted iterations) |
| **Strategy** | Single execute_code with embedded charts | Multi-batch code gen | Charts first, then PPTX (failed) |

## 5. TTFT Gap Analysis

The 115s TTFT gap is the core UX problem. Here's a breakdown of what the user experienced vs. what was actually happening:

| Time | What user sees | What's actually happening |
|------|---------------|--------------------------|
| 0:58 | "Skill activated: pptx" → "Thinking..." | Model begins generating execute_code tool call |
| 1:00–1:30 | Static "Thinking..." spinner | Model streaming tool call tokens (code argument) |
| 1:30–2:00 | Static "Thinking..." spinner | Model still streaming code (charts, tables, shapes) |
| 2:00–2:50 | Static "Thinking..." spinner | Model finishing the massive code payload |
| 2:53 | Code panel appears, RUNNING → DONE 2.6s | Tool call fully parsed, code executes instantly |

**Why the gap was longer than the simple prompt:**
- Simple prompt: ~250 lines of python-pptx code, text-only slides → ~43s TTFT
- Rich prompt: ~500+ lines of python-pptx + matplotlib + chart data + shape drawing → ~115s TTFT
- The gap scales roughly linearly with code payload size

**Potential mitigations (all tracked in SEED-030):**
1. **tool_args_progress** (Phase 075.10) is active for OpenAI — code tokens stream progressively. But the UI shows "Thinking..." until the tool call is fully parsed and dispatched. The code panel only appears when execution begins.
2. An elapsed timer on the "Thinking..." state would at least show the user something is progressing.
3. A progress estimation based on prompt complexity could set expectations.

## 6. UX Observations

| UX Element | Rating | Notes |
|-----------|--------|-------|
| Run card header | Good | "Run · 5 tools · done · 178.5s" — clear, accurate |
| Step badges | Good | DONE badges with timing (3.5s, 43ms, 33.7s, instant, 2.6s) |
| Sub-agent streaming | Excellent | 33.7s of live text extraction — rich, structured, scrollable |
| Code panel | Good | Syntax-highlighted python-pptx + matplotlib code |
| Output files (in-step) | Good | 6 files listed with sizes in collapsed panel |
| Final outputs section | Excellent | All 6 files with download links and sizes at bottom of response |
| TTFT gap UX | **Poor** | **115s of static "Thinking..."** — identical screenshots across entire gap |
| Follow-up buttons | Good | 3 contextual follow-ups (premium visual, speaker notes, Word briefing) |
| Run card timer | OK | Timer visible in header (top of run card), but user needs to scroll up to see it during gap |

## 7. Recommendations

### For the TTFT silence gap (all providers):
1. **Show the code panel during tool_args_progress streaming** — the backend already receives progressive code tokens from OpenAI. Instead of waiting for the full tool call to parse, show the code panel populating line-by-line during the gap. This would turn 115s of silence into 115s of visible code writing.
2. **Elapsed timer on "Thinking..." state** — display how long the model has been thinking, so the user knows something is alive.
3. **Progress hint based on prompt complexity** — if the prompt mentions charts/tables/diagrams, set a longer time expectation in the UI.

### For output quality:
4. **Validate chart content** — the 5 PNG charts were generated, but their content accuracy should be verified against the dissertation data. Are the gender percentages, hypothesis relationships, and means values correct?

### For UX polish:
5. **"Final outputs" section is excellent** — this pattern of surfacing all output files at the end of the response (outside the collapsed run card) solves the step-list-collapse discoverability problem. No action needed.

## 8. Files for Reference

- Kimi monitoring report: `.planning/reports/SESSION-20260525-kimi-openrouter-monitoring.md`
- Streaming investigation: `.planning/reports/SESSION-20260525-streaming-timeout-investigation.md`
- SEED for TTFT gap: `.planning/seeds/SEED-030-streaming-silence-gap-ux.md`
- Phase 076 metadata_filter fix: commit `7d92217`
- Timeout config: `backend/app/config.py` MODEL_CAPABILITIES registry
- Tool parsing: `backend/app/services/openai_service.py`
- Phase 075.10 tool_args_progress: fine-grained streaming for OpenAI/OpenRouter
