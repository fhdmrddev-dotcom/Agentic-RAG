# UX Status Fidelity: The Agent Feels Stuck When It Isn't

**Date:** 2026-05-25
**Source:** Cross-provider live monitoring — DBA PPTX generation task
**Providers tested:** OpenAI GPT 5.4, Anthropic Sonnet 4.6, Google Gemini 3.5 Flash, OpenRouter Kimi k2.6, OpenRouter MiniMax M2.7
**Monitoring tools used:** Chrome DevTools MCP (UI), LangSmith SDK (traces/tokens), backend logs
**Purpose:** Produce actionable findings for a GSD fix phase that restores performance, transparency, and quality to the agent run UX

---

## Executive Summary

The 075.x streaming phase series (10+ phases) added significant infrastructure — tool_args_progress, code panels, step badges, focus mode, status pills, elapsed timers. **The plumbing is excellent.** But the UI now reflects too much detail in the wrong places and not enough signal where it matters. The result: during the most critical moments of a run (when the model is generating large code payloads), the user sees a frozen screen with "Thinking..." for 1–4 minutes per batch.

**The irony:** The data needed to fix this already exists in the backend. Phase 075.10 streams progressive code tokens (`tool_args_progress` with `argsCodeText`). The frontend caches it. But it's displayed only as a byte-count badge ("Generating... 5.2 KB") instead of a live code preview. The user stares at "Thinking..." while hundreds of lines of python-pptx code stream silently through the SSE pipe.

**What we need:** Fewer visual elements, more meaningful ones. Sacrifice detail for liveness. The user doesn't need to see every tool parameter — they need to know the agent is alive, what it's doing right now, and roughly how far along it is.

---

## 1. The Four "Stuck" Moments (ranked by severity)

### Stuck Moment #1: TTFT During Code Generation (30s–267s of silence)

**When it happens:** After `load_skill("pptx")` completes, the model begins generating the `execute_code` tool call. The `code` argument can be 500+ lines of python-pptx + matplotlib. The model streams tokens progressively, but:

**What the user sees:**
```
Loading skill "pptx"                              ● DONE · 1MS
─────────────────────────────────────────────────────────────────
NEXT  planning next step...                              queued
─────────────────────────────────────────────────────────────────
◌ Thinking...  ●●●
```
This exact screen stays **unchanged for 30s–267s** depending on the provider and code complexity.

**What's actually happening (the backend knows):**
- `tool_args_progress` events are firing every 5KB with `argsCodeText` containing the progressively-built code
- The tool name (`execute_code`) is known from `tool_preparing`
- The code text is cached in `StreamsProvider` as `argsCodeText` on the tool entry

**What the UI should show instead:**
```
Preparing  execute_code  "Generating DBA defence PPTX"    5.2 KB
─────────────────────────────────────────────────────────────────
 1  from pptx import Presentation
 2  from pptx.util import Inches, Pt
 3  from pptx.enum.text import PP_ALIGN
 4  import matplotlib.pyplot as plt
 5  ...
 6  # === SLIDE 1: Cover ===
 7  slide = prs.slides.add_slide(BLANK)
 8  bg(slide, NAVY)
 ...                                              ⏱ 45s elapsed
```
The code preview already works post-execution (the code panel shows syntax-highlighted code after `tool_start`). The fix is showing it **during generation** using the same component fed by `argsCodeText`.

**Measured gaps per provider:**

| Provider | Code gen TTFT | Batches | Total code gen time |
|----------|--------------|---------|-------------------|
| GPT 5.4 | 115s | 1 | 115s |
| Sonnet 4.6 | 74s, 267s, 253s, 236s | 4 | **830s** |
| MiniMax M2.7 | ~60s | 1 (failed) | ~60s |
| Kimi k2.6 | 14+ min (tool parse failure) | 0 | N/A |

### Stuck Moment #2: Sub-Agent Extraction (33s–178s with static panel)

**When it happens:** The `analyze_document` sub-agent extracts content from the dissertation. The sub-agent streams text, and the UI shows it in a scrollable panel.

**The problem:** The panel auto-scrolls briefly, then **the visible portion stays the same** for the remainder of the extraction. The user sees "Comprehensive Document Analysis" at the top and the same 5-6 lines for 30s–178s. The sub-agent IS streaming new content below the fold, but the user doesn't see it unless they manually scroll inside the panel.

**Measured sub-agent times:**

| Provider | Duration | Output tokens |
|----------|----------|--------------|
| GPT 5.4 | 33.7s | ~8K |
| MiniMax M2.7 | 65.5s + 94.6s | 13.8K + 23K |
| Sonnet 4.6 | **178.4s** | ~15K+ |

**What would help:**
- Auto-scroll the sub-agent panel to follow new content (or show a "▼ New content below" indicator)
- Show a byte/line counter on the sub-agent panel so the user sees numbers growing
- Or: collapse the sub-agent panel to a summary line ("Extracting document... 12.4 KB extracted") and let the user expand if curious

### Stuck Moment #3: Between Iterations (5s–30s, repeated)

**When it happens:** After every tool call completes, the backend sends the result back to the model and waits for the next response. This is a genuine TTFT gap — no data from the provider.

**What the user sees:** "NEXT planning next step... queued" — the word "queued" is misleading. The LLM call is ACTIVE (tokens may already be streaming), not queued.

**What would help:**
- Replace "queued" with an elapsed timer: "NEXT planning next step... 8s"
- If tokens are arriving (delta events), show an active spinner instead of the static "queued" label
- These gaps are typically 2-15s and are acceptable if the user knows something is happening

### Stuck Moment #4: Run Card Header Scrolls Offscreen

**When it happens:** During any long operation, the user scrolls down to read the sub-agent output or the latest code panel. The run card header (which shows Step count + elapsed timer) scrolls above the viewport.

**What the user sees at the bottom of the screen:**
```
◌ Thinking...  ●●●

──────────────────────
Ask anything...
──────────────────────
Anthropic ▾  claude-sonnet-4-6 ▾  General ▾
```
No timer. No step count. No indication of progress. Just a spinner that hasn't changed in 4 minutes.

**What would help:** A sticky status bar above the input box during active runs:
```
──────────────────────────────────────────────────
⏱ 3:42  ·  Step 5  ·  8 files  ·  Generating code...
──────────────────────────────────────────────────
Ask anything...
```

---

## 2. Per-Provider Issue Catalog

### OpenAI GPT 5.4 — SUCCESS in 178.5s

| Issue | Severity | Detail |
|-------|----------|--------|
| 115s TTFT silence | High | Single code gen gap. `tool_args_progress` streams code tokens but UI shows "Thinking..." |
| SQL hallucination in search_documents | Medium | Passed raw SQL as metadata_filter (first test only). Phase 076 fix may cover this |
| No text between tool calls | Low | Model goes directly tool→tool. User sees no narration between steps |

**Output:** 280 KB PPTX + 5 chart PNGs. Good quality, fastest completion.

### Anthropic Sonnet 4.6 — SUCCESS in 1116.7s

| Issue | Severity | Detail |
|-------|----------|--------|
| 830s cumulative TTFT (4 batches × 74–267s) | **Critical** | Multi-batch code gen. Each gap shows "Thinking..." with no progress. UI looks stuck for 4+ min per batch |
| 178.4s sub-agent with static panel | High | Longest extraction. Panel doesn't auto-scroll to show new content |
| 4x text duplication | Medium | "Now I have all the content..." repeated 4 times between batches |
| Misleading "stuck" perception | **Critical** | Monitor concluded run failed. User would likely stop the run mid-flight. **The best output was nearly killed by bad UX** |
| Multi-batch progress invisible | High | 4 separate execute_code calls. No batch count, no "2 of 4" indicator |
| Chat title from disclaimer | Low | Auto-title picked up "I appreciate your request, but I need to clarify my limitations" instead of task |

**Output:** 573.2 KB PPTX + 10 chart PNGs + 19-slide table. **Best quality of all providers** — but nearly abandoned due to UX.

### OpenRouter / Kimi k2.6 — FAILED in 1026s

| Issue | Severity | Detail |
|-------|----------|--------|
| Tool call parsing failure (large args) | **Critical** | Raw `<\|tool_calls_section_begin\|>` markup leaked as text. OpenRouter compatibility layer failed to parse Kimi's native tool format for large payloads |
| 5x load_skill waste | High | Loaded pptx skill 5 times, wasting 5 iterations |
| "done" without task completion | High | Run showed "done" but no PPTX was generated. Misleading terminal status |
| 14+ min silence | Critical | Entire remaining run was a single frozen screen |

**Output:** 5 chart PNGs generated (but never assembled into PPTX). Zero deliverable.

### OpenRouter / MiniMax M2.7 — FAILED in 249.3s

| Issue | Severity | Detail |
|-------|----------|--------|
| Run failed with no error message | **Critical** | "Run · 6 tools · failed" with zero explanation. User has no idea why |
| Double sub-agent (sequential) | High | Two analyze_document calls on same file (65.5s + 94.6s), wasting 95s and 90K tokens |
| 331K total tokens consumed | Medium | Most expensive run. Context bloat from dual sub-agent outputs |
| execute_code dispatched but run failed | High | Code was partially generated (1655 output tokens). Likely truncated by output limit |
| SQL hallucination in metadata filter | Medium | Same Phase 076 pattern as Kimi |

**Output:** Nothing. 4+ minutes of work produced zero files. User got a "Resume" button with no context.

**Positive note:** MiniMax was the only provider to emit narration text between tool calls ("I found the DBA dissertation..."), giving the user feedback about intent. Other providers go tool→tool silently.

---

## 3. What the 075.x Series Built vs. What's Missing

### Built and working (the plumbing is solid):

| Feature | Phase | Status |
|---------|-------|--------|
| `tool_args_progress` SSE events (5KB boundary) | 075.10 | Working — events fire, frontend caches `argsCodeText` |
| Code panel with syntax highlighting | 075.6 | Working — shows code after `tool_start` |
| Step counter in RunCard header | 075 | Working — but scrolls offscreen |
| Elapsed timer in RunCard header | 075 | Working — but scrolls offscreen |
| StatusPill per tool (preparing → running → done) | 075.8 | Working |
| "Thinking..." spinner | 075.8 | Working — but used for 3+ different states |
| Live stdout from sandbox | 075 / 075.9 | Working |
| Focus Mode (step collapse) | 075.6 | Working — but hides output files |
| `tool_preparing` early name reveal | 075.10 | Working — tool name known before args finish |

### Missing (the data exists but isn't surfaced):

| Gap | Data available | Current display | Fix |
|-----|---------------|----------------|-----|
| **Live code preview during generation** | `argsCodeText` on tool entry (updates every 5KB) | Byte-count badge only ("5.2 KB") | Feed `argsCodeText` to the same CodePanel used post-execution |
| **Sticky progress bar during runs** | `iterationCount`, `elapsedSeconds`, output file count | Only in RunCard header (scrolls away) | Sticky bar above input box |
| **"Generating code" vs "Executing code"** | `tool_preparing` → `tool_start` transition | Both show "RUNNING" badge | Two distinct visual states |
| **Failure reason on failed runs** | Backend has the error (timeout, truncation, code error) | "failed" with no detail | Surface error category in UI |
| **Batch progress for multi-batch runs** | Each execute_code is a separate tool_call | No batch count visible | "Batch 2 of 4" or cumulative file count |
| **"queued" → active transition** | Delta events arrive → tokens are streaming | "queued" label stays static | Replace with elapsed timer or active spinner |

---

## 4. The Hypothesis: Did 075.x Make It Worse?

**Before 075.x:** The agent ran with minimal UI — text streaming, basic tool call indicators. Runs felt simple. The UX matched expectations because there was little to show.

**After 075.x:** The UI now shows step panels, code panels, status pills, badges, timers, focus mode, collapse/expand — a rich execution dashboard. But this creates a **higher bar for liveness**. When the dashboard goes quiet for 2 minutes, it feels MORE stuck than a simple spinner would, because the user has been trained to expect activity.

**The specific regression:** The code panel (Phase 075.6) established an expectation that code is visible during execution. But it only appears after `tool_start` (when code starts executing in the sandbox). During the 30s–267s `tool_preparing` phase (when code is being generated), the panel is absent. The user knows the code panel EXISTS but it's not showing — this feels like a bug, not a wait.

**The fix direction:** Show the code panel DURING generation (using `argsCodeText`), not just during execution. This turns the longest silence gap into the most visually active moment of the run.

---

## 5. Design Principles for the Fix Phase

1. **Liveness over detail.** A moving progress bar beats a static info panel. Remove elements that add detail but not liveness.

2. **One thing always moving.** At every moment during a run, at least one visual element should be changing — a timer counting up, a code line appearing, a byte count growing, a spinner rotating. If nothing is changing for >3s, the user assumes it's stuck.

3. **Honest labels.** "queued" when it's active. "RUNNING" for both code generation and execution. "done" when the task failed. These lies erode trust. Even "Waiting for model..." is better than a false state.

4. **Sticky essentials.** Timer + step count + file count must be visible regardless of scroll position. Everything else can be in the expandable run card.

5. **Provider-agnostic UX.** The user chose a model, not an architecture. The UI should never expose provider-specific artifacts (Kimi's `<|tool_calls|>` markup, Anthropic's 4x narration). Normalize at the backend.

6. **Graceful degradation.** Google delivers tool args atomically (no progressive streaming). The UI should handle this honestly: "Waiting for model..." with a timer, not pretending to be "queued."

---

## 6. Recommended Phase Scope for GSD

**Phase goal:** Restore status fidelity so the agent run always feels alive and never feels stuck when it's working.

**What to research (for the GSD deep-research phase):**
1. How to display `argsCodeText` progressively during `tool_preparing` state — reuse CodePanel component or create a lighter preview
2. Sticky status bar implementation — floating above input, auto-hides when run completes
3. Per-provider TTFT characteristics — what signals are available from each (Anthropic content_block_start, OpenAI function.arguments chunks, Google atomic, OpenRouter varies)
4. Whether to collapse sub-agent panels to a summary by default (trades detail for liveness)
5. Backend error surfacing on failed runs — what error categories exist and how to pass them to the frontend
6. Text deduplication for Anthropic's repeated narration blocks

**What NOT to do:**
- Don't add more detail (more badges, more panels, more stats)
- Don't add provider-specific UI paths
- Don't redesign the run card — refine the existing states
- Don't break the 075.x plumbing — it's solid, just underutilized

---

## 7. Test Matrix for Verification

Any fix should be verified against this exact task (DBA PPTX generation) across all 4 providers:

| Axis | What to verify |
|------|---------------|
| **Liveness** | At no point during the run does the visible screen stay unchanged for >5s |
| **Accuracy** | Status labels match actual backend state (not "queued" when active, not "RUNNING" when generating) |
| **Progress** | User can estimate completion (timer, step count, file count, or batch indicator visible) |
| **Failure clarity** | On failed runs, user knows WHY (timeout, code error, truncation, model limit) |
| **Scroll resilience** | Progress indicator visible regardless of scroll position |
| **Multi-batch** | For Sonnet's 4-batch approach, user can see batch progress and cumulative output |

---

## 8. Prior Art: The Reverted Streaming Changes (Critical Context)

In a previous session, changes were made (commit `0dce56a`) to surface LangSmith-like iteration detail in the UI — e.g., "Generating slides 1-6", then "Generating slides 7-12". **These were reverted** (commit `61e5eb1`) because:

1. **Text/code leaking to UI** — models' internal narration ("now generating slides 7-12") and thinking text leaked into the chat area as visible text, particularly with Kimi and OpenRouter models
2. **UI became extremely heavy** — extra `planning` SSE events with `planningHint` fired before every LLM call, causing heavy React re-renders. The chat was barely scrollable during execution
3. **System prompt narration rule backfired** — instructing models to "emit brief status between execute_code batches" caused unpredictable behavior (some models narrated when they shouldn't, some leaked thinking text)
4. **`planningHint` field leaked** — the frontend tried to render model names in the "Thinking..." row, visible to users as raw technical text

**What was reverted:**
- Extra `planning` events with `hint=f"Calling {model_id}..."` before each LLM call
- `planningHint` field in the message state
- `maxIterations` in `iteration_start` events
- System prompt narration rule
- Removal of `iteration > 0` guard on `planning` events

**What was kept:** Timeout bumps (300s flash, 600s pro/sonnet, 900s reasoning) and output token ceiling increases (16K→32K).

**Lesson:** Adding more SSE events and more UI elements made things worse, not better. The fix direction is to better utilize EXISTING events and signals, not add new ones.

---

## 9. Per-Provider Architecture Differences (Investigation Needed)

### System prompt is identical for all providers
The same `SYSTEM_PROMPT` (threads.py:342-477) is sent to all backends. No provider-specific sections. This means:
- Models unaware of the latest Supabase schema may hallucinate SQL in `search_documents` (observed with GPT 5.4, Kimi, MiniMax)
- Models with different tool-calling conventions get the same instructions
- Models with different token budgets get the same length expectations

### Sub-agent model varies by provider
| Provider | Main model (user picks) | Sub-agent model (hardcoded) |
|----------|------------------------|---------------------------|
| OpenAI | gpt-5.4 | gpt-5.4-mini |
| Anthropic | claude-sonnet-4-6 | claude-haiku-4-5 |
| Google | gemini-3.5-flash | gemini-2.5-flash |
| OpenRouter | kimi-k2.6 / minimax-m2.7 | **same as main model** (no default) |

**OpenRouter fallback is expensive** — when the sub-agent uses the same model as the main agent, extraction costs balloon (MiniMax: 178K tokens for sub-agents alone). Dedicated sub-agent defaults should be set for OpenRouter models.

### Tool arg streaming varies by provider
| Provider | Tool args streaming | UI impact |
|----------|-------------------|-----------|
| OpenAI | Progressive (chunks) | `tool_args_progress` fires, `argsCodeText` available |
| Anthropic | Progressive (`input_json_delta`) | `tool_args_progress` fires, `argsCodeText` available |
| Google | **Atomic** (all-at-once) | No progressive data. Code panel appears instantly when complete |
| OpenRouter | Varies by underlying model | Kimi leaked raw tool markup; MiniMax truncated |

### Questions for the research phase:
1. Should the system prompt be tuned per provider? (e.g., different tool-calling instructions for OpenRouter models)
2. Should OpenRouter models get dedicated sub-agent defaults? (e.g., `minimax/minimax-m2.5:free` for sub-agents)
3. How do providers handle long code generation on their OWN platforms? (Claude.ai, ChatGPT, Gemini app, Kimi.ai)
4. Should we set provider-specific iteration limits, timeouts, or output token caps?
5. Should metadata_filter instructions be provider-specific to prevent SQL hallucination?
6. Should title generation use a different (cheaper/faster) model?

---

## Appendix: Raw Monitoring Data

| Provider | Total time | Outcome | PPTX size | Charts | Tool calls | Steps | Biggest TTFT | LangSmith calls | Unique UX issue |
|----------|-----------|---------|-----------|--------|------------|-------|-------------|----------------|-----------------|
| GPT 5.4 | 178.5s | SUCCESS | 280 KB | 5 | 5 | 6 | 115s | 8 | Silent TTFT gap |
| Sonnet 4.6 | 1116.7s | SUCCESS | 573.2 KB | 10 | 6 | 9 | 267s | 13 | 4x text duplication, multi-batch invisible progress |
| Gemini 3.5 Flash | 272s | SUCCESS | 218.3 KB | 2 | 6 | 6 | 88s | 12 | **Ghost state: active indicator hidden 88s**, atomic args (no preview possible) |
| Kimi k2.6 | 1026s | FAILED | — | 5 (lost) | 10+ | 15 | 14+ min | — | Tool parse failure, "done" without completion |
| MiniMax M2.7 | 249.3s | FAILED | — | 0 | 6 | 5 | ~60s | 11 | No error message on failure |

Detailed per-provider reports:
- `.planning/reports/SESSION-20260525-openai-gpt54-monitoring.md`
- `.planning/reports/SESSION-20260525-anthropic-sonnet46-monitoring.md`
- `.planning/reports/SESSION-20260525-google-gemini35flash-monitoring.md`
- `.planning/reports/SESSION-20260525-minimax-m27-monitoring.md`
- `.planning/reports/SESSION-20260525-kimi-openrouter-monitoring.md`
- `.planning/reports/SESSION-20260525-streaming-timeout-investigation.md`
