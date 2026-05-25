# Monitoring Report: Google Gemini 3.5 Flash — PPTX Generation Task

**Date:** 2026-05-25
**Provider:** Google / gemini-3.5-flash
**Task:** Generate professional DBA defence PPTX with charts, tables, diagrams, references
**Prompt:** (same as all providers)
**Outcome:** SUCCESS — `Fahed_Mrad_DBA_Defense.pptx` (218.3 KB) + 2 chart PNGs
**Total duration:** ~272s (~4 min 32s)
**Run status:** "done" — 6 tool calls, Step 6, 3 output files

---

## 1. Timeline

| Elapsed | Step | Event | Duration | UI State |
|---------|------|-------|----------|----------|
| 0:00 | — | Prompt submitted | — | |
| ~0:04 | 1 | `query_documents` — SQL metadata query | 32ms | DONE |
| ~0:06 | 1 | Sub-agent panel on .docx (from first analyze_document) | — | Spinner on sub-agent |
| ~0:10 | 2 | `list_folder "/DBA"` | 31ms | DONE |
| ~0:15 | 3 | `analyze_document` "Fahed Mrad Chapters 1 to 4.docx" | 59.8s | RUNNING, sub-agent streaming |
| ~1:15 | 3 | Sub-agent completed — structured extraction visible | — | Green check |
| ~1:25 | 4 | `load_skill("pptx")` + `read_skill_file("pptx")` | instant | DONE |
| ~1:30 | — | **"Thinking..." + "NEXT planning... queued"** hidden behind sub-agent panel | — | **GHOST STATE: active indicator not visible at bottom** |
| ~1:30 | — | TTFT gap begins — model generating execute_code atomically | — | Static screen (no progressive code preview possible) |
| ~2:58 | — | TTFT gap: **~88s of silence** | — | "Thinking..." only visible if user scrolls up |
| ~2:58 | 6 | `execute_code` — code appears ALL AT ONCE (atomic) | 1.3s | Code panel pops in instantly, DONE |
| ~3:05 | — | Output files: PPTX + 2 PNGs | — | Download cards |
| ~3:45 | — | Final response streaming — detailed slide-by-slide breakdown | 37.6s | Rich markdown with slide descriptions |
| ~4:32 | — | Done — 3 follow-up buttons | — | |

## 2. LangSmith Trace

12 LLM calls, all success. Sub-agent: 59.8s. Execute_code TTFT: 87.3s. Final response: 37.6s.

## 3. Output Files

| File | Size |
|------|------|
| `Fahed_Mrad_DBA_Defense.pptx` | 218.3 KB |
| `csf_correlations.png` | 89.7 KB |
| `rpa_platforms.png` | 92.7 KB |

**Total: 400.7 KB** — smallest of the successful providers.

## 4. Google-Specific UX Issues

### Issue A: Active Indicator Hidden Behind Sub-Agent Panel (CRITICAL)

After the sub-agent completed, the "Thinking..." and "NEXT planning... queued" indicators were rendered **inside the run card body** — but the sub-agent extraction panel took up the entire visible viewport. When scrolled to the bottom, the user saw completed Step 2 (list_folder) and the sub-agent panel, with **no spinner, no timer, no "Thinking..." visible anywhere**.

This is **worse than other providers** where "Thinking..." is at least visible at the bottom of the chat. With Gemini, the active indicator was completely hidden above the fold.

**Duration of ghost state:** ~88s (from sub-agent completion to execute_code appearing).

### Issue B: Atomic Tool Args (No Progressive Code Preview)

Google's SDK delivers tool call arguments atomically — all at once when the model finishes generating them. Unlike OpenAI/Anthropic where `tool_args_progress` streams progressive code chunks, Google provides **zero intermediate signal** during code generation.

**What this means for the TTFT gap fix:**
- The P1 fix "show code preview during tool_args_progress" **cannot work for Google**
- For Google specifically, the only option is an honest "Waiting for model..." with an elapsed timer
- The code panel will always "pop in" rather than stream — this is a structural SDK limitation

### Issue C: Duplicate User Message Display

The user's prompt was displayed twice in the message area — once as the user message, once as a system echo. This is cosmetic but reduces trust.

### Issue D: Chat Title Uses Raw Prompt

The auto-generated chat title was "search for a research that is authored b" (truncated prompt text) instead of a generated summary. GPT 5.4 and Sonnet both generate proper titles.

### Issue E: SQL Hallucination in query_documents

Gemini passed raw SQL:
```sql
SELECT d.id, d.filename, d.mime_type, f.name AS folder FROM documents d JOIN folders f ON d.folder_id = f.id WHERE f.name = 'DBA' OR f.name LIKE '%DBA%'
```
Same Phase 076 pattern. The query succeeded because the SQL happened to be valid, but it's still the wrong approach.

### Issue F: Weaker Follow-Up Questions

Gemini's follow-ups were help-desk oriented:
- "How can I download the file?" (the download link is right there)
- "Can you list the slide-by-slide outline?" (it just did, in the response)
- "Is the generated presentation fully editable?" (generic)

Compare to Sonnet's follow-ups: branding customization, appendices, time-frame adaptation — much more useful.

## 5. What Gemini Did Well

- **Second fastest** — 272s total, only GPT 5.4 was faster (178.5s)
- **Fast sub-agent** — 59.8s (vs 178.4s Sonnet, 160s MiniMax)
- **Single execute_code call** — like GPT 5.4, avoided multi-batch complexity
- **Chose DOCX** — like GPT 5.4, used the better-parsed format
- **Detailed response text** — slide-by-slide breakdown with visual elements, core content, and specific stats
- **Fast execution** — 1.3s sandbox time (code worked on first try)

## 6. Updated Cross-Provider Scoreboard (5 providers)

| | GPT 5.4 | Sonnet 4.6 | Gemini 3.5 Flash | Kimi k2.6 | MiniMax M2.7 |
|---|---|---|---|---|---|
| **Outcome** | SUCCESS | SUCCESS | **SUCCESS** | FAILED | FAILED |
| **Time** | **178.5s** | 1116.7s | **272s** | 1026s | 249.3s |
| **PPTX size** | 280 KB | **573.2 KB** | 218.3 KB | — | — |
| **Charts** | 5 | **10** | 2 | 5 (lost) | 0 |
| **Sub-agent** | 33.7s | 178.4s | **59.8s** | 65.5s | 160s |
| **TTFT gap** | 115s | 830s (cumulative) | **88s** | 14+ min | ~60s |
| **Atomic args** | No (progressive) | No (progressive) | **Yes (atomic)** | N/A | N/A |
| **Ghost state** | No | No | **Yes (88s invisible)** | No | No |
| **Follow-ups** | Good | Excellent | Weak | N/A | N/A |

## 7. Google-Specific Recommendations

1. **Sticky progress bar is MANDATORY for Google** — since there's no progressive code preview possible, the timer is the ONLY liveness signal. If it's hidden (as it was for 88s), the user has zero feedback.
2. **Auto-scroll after sub-agent completion** — when analyze_document finishes, scroll to the "NEXT planning..." indicator so the user can see the run is still active.
3. **Chat title generation** — Google's title gen produced raw prompt text. Either use a dedicated title-gen call or truncate better.
4. **Follow-up quality** — consider whether the system prompt should guide follow-up generation with examples of good follow-ups (task-extension, not help-desk).
