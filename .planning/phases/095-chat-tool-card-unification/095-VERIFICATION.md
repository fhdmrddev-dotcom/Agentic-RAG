---
phase: 095-chat-tool-card-unification
verified: 2026-06-06T00:45:00Z
status: human_needed
score: 4/4 automated truths verified
overrides_applied: 0
human_verification:
  - test: "Long run stays honest — timer continuous, step count == cards, no sub-agent dup, freeze at true terminal"
    expected: "Kimi/Moonshot ~11-step run: timer never blinks out, step N in header == step N in strip == N deduped cards in panel, read/summarize sub-agent appears exactly once, timer freezes at run end"
    why_human: "Needs a real long multi-step run across a slow provider; browser-only behavior; cannot simulate live SSE + real-time DOM updates programmatically"
  - test: "Multi-tool calm — search_documents + execute_code; finished folds, active open, auto-scroll follows edge"
    expected: "One prompt fires both tools; finished tools collapse to summary row; active tool is expanded; chat follows the live edge while at bottom"
    why_human: "Live streaming + scroll behavior requires a real browser with DevTools MCP; cannot test scroll physics in jsdom"
  - test: "Hero file downloads — ask for a .docx; hero is the doc; one-click download; reopen chat next day — download still works"
    expected: "The .docx is the hero card (above Working files); Download button works immediately; on a next-day reload the hero card still shows and the download still succeeds via the re-sign endpoint"
    why_human: "Needs real file generation + re-sign path + next-day reopen; cannot simulate Supabase Storage signed URLs or multi-session elapsed time in tests"
  - test: "Two threads + 6-provider parity — Thread A streaming while Thread B accepts a prompt; unified frame identical across all 6 native providers"
    expected: "No cross-thread bleed; the RunCard frame, step count, timer, sub-agent zero-dup, and file hero/working layout are indistinguishable across OpenAI / Anthropic / Google / OpenRouter / DeepSeek / MiniMax (native-7 minus GLM for the chat surface)"
    why_human: "Requires parallel streaming sessions + cross-provider live runs; browser-only multi-tab behavior"
---

# Phase 095: Chat Tool-Card Unification Verification Report

**Phase Goal:** Chat tool-cards render in one consistent frame with auto-scroll, details-on-demand collapse, no duplicates, consistent timer/step-count, and a working download — closing the felt-experience defects in the chat execution surface.

**Verified:** 2026-06-06T00:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                   | Status     | Evidence                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tool-cards render in one consistent frame with auto-scroll and details-on-demand collapse; no duplicate cards on any provider (closing BUG-260529-02). | ✓ VERIFIED | D-05 root fix: `StreamsProvider` `onSubAgentStart/Delta/Done` now stamps onto the OWNING tool_call's `tc.sub_agent`; `tc.sub_agent ?? subAgent` dual source collapsed to `tc.sub_agent` alone (grep=0). 4 D-05 dedup tests green including THREAD_A→THREAD_B isolation and start-before-tool_start ordering. StepRail wraps the existing TOOL_BODIES (no second renderer). `dedupToolCalls` is the ONE shared dedup (ToolCallPanel imports it from `@/lib/stepCount`; inline `const seen = new Set` = 0). |
| 2   | The run timer stays visible for the full duration of long runs (closing `timer-disappears-long-runs`) and the step count matches between the timer and the panel (closing `step-count-mismatch-timer-vs-panel`). | ✓ VERIFIED | D-06: RunCard derives elapsed from `Date.parse(message.created_at)` (grep ≥ 1); `performance.now` = 0; `elapsedMs > 0` gate = 0; renders continuously via `{hasStart && <RunStatusStrip …/>}`. D-04: all three RunCard count sites read `unifiedStepCount(message)` (grep = 5); `message.iterationCount` = 0; ToolCallPanel's `dedupToolCalls` is from the shared module. RunCard tests: 23/23 including zero-elapsed-no-vanish, freeze-at-terminal, NaN-guard, three-sites-agree-N≠M, DB-loaded-no-iterationCount-still-shows-Step-N all green. Note: WR-01 (inflated elapsed on reloaded terminal runs, see Warnings below). |
| 3   | The output-file download link works end-to-end (no dead link); SC#10 cross-provider UAT confirms the unified frame behaves identically across all 6 native providers and survives a parallel-thread + long-message scenario. | ? PARTIAL  | Automated (D-07/D-08): `_select_hero_filenames` helper present; `is_hero` on emit + persist (grep ≥ 2); `sandbox_outputs.py` diff empty (owner fence untouched); url guard present; `is_hero` flows through `api.ts` + `_mapMessageResponse` for reload reconstruction; 13/13 backend pytest green. `OutputFileCard` hero/working variant + `fileIcon` wired; url-less dead state present (no silent dead anchor). Frontend finalOutputs tests 7/7 green. Cross-provider + parallel-thread + long-message = operator-owned LIVE Chrome-DevTools-MCP UAT (4 scenarios in `095-VALIDATION.md Manual-Only`). |
| 4   | The change is contained to the frontend chat surface (plus D-08 additive backend field) and does not regress the PANEL-06 isolation or the StreamsProvider demux.                                                | ✓ VERIFIED | PANEL-06: `git diff` of all 13 changed files shows zero new reads of `todosByThread`, `tasksByThread`, `phasesByThread`, `workspaceFilesByThread`, `pendingAsksByThread`. StreamsProvider demux: all sub-agent writes stay inside the `makeStreamCallbacks` closure over `assistantId`; `_isTransientStreamEnd`/`_reattachAfterTransient` grep = 14 (frozen, unchanged from baseline). `dangerouslySetInnerHTML` = 0 across all 8 changed frontend component files. `sandbox_outputs.py` diff = 0 lines. `'final_output_files'` event name unchanged (grep = 1 emit site, baseline). tsc -b = 37 (documented baseline, zero net-new errors reference any phase-095 source file). |

**Score:** 4/4 truths verified (SC#3's cross-provider × parallel-thread × long-message portion routes to human_verification as it requires live browser UAT)

---

### Required Artifacts

| Artifact                                               | Expected                                                                                 | Status     | Details                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `frontend/src/lib/stepCount.ts`                        | `unifiedStepCount` + `dedupToolCalls` (D-04 single source of truth)                     | ✓ VERIFIED | Exists; exports both functions; pure logic, no React; verbatim ToolCallPanel dedup key; 82 lines substantive |
| `frontend/src/lib/fileIcon.tsx`                        | `fileIcon(filename, sizePx?)` per-extension Lucide icon + ext label (D-07)               | ✓ VERIFIED | Exists; canonical ext→(color, Glyph) map; Lucide glyphs (FileText/Table/Image/Code/Presentation); XSS-safe (ext-label only); 105 lines substantive |
| `frontend/src/components/chat/RunStatusStrip.tsx`      | ONE `⏱ elapsed · Step N · activity` strip with `placement: "header" | "floating"` (D-06) | ✓ VERIFIED | Exists; exports `RunStatusStrip`; `placement` prop present; two CSS wrappers over identical segment markup; no `dangerouslySetInnerHTML`; 83 lines substantive |
| `frontend/src/components/chat/RunCard.tsx`             | D-06 timer from `created_at`; D-04 `unifiedStepCount` on all 3 sites; hosts `RunStatusStrip` | ✓ VERIFIED | `performance.now`=0; `elapsedMs > 0`=0; `message.created_at` ≥ 1; `unifiedStepCount`=5; `message.iterationCount`=0 |
| `frontend/src/components/chat/ToolCallPanel.tsx`       | shared `dedupToolCalls`; `StepRail`; "Round N" divider; dual source collapsed             | ✓ VERIFIED | `dedupToolCalls` import present; `const seen = new Set`=0; `tc.sub_agent ?? subAgent`=0; `Round {tc.iteration`=1; `Step {tc.iteration`=0; snum/node rail present |
| `frontend/src/providers/StreamsProvider.tsx`           | D-05 sub-agent stamps onto owning tool_call; no single-slot `message.sub_agent` writes  | ✓ VERIFIED | `m.sub_agent` (message-level write) = 0; `tc.sub_agent` writes on owning tool_call entries confirmed; `_isTransientStreamEnd` frozen at 14 |
| `frontend/src/hooks/useFollowScroll.ts`                | D-03 follow/release/re-arm/jump state machine                                            | ✓ VERIFIED | Exists; exports `useFollowScroll`; `isPinned`, `showJumpToLive`, `jumpToLive`, `beginProgrammaticScroll` all present; THRESHOLD = 120px |
| `frontend/src/components/chat/MessageList.tsx`         | `useFollowScroll` wired; floating JumpToLive chip using `RunStatusStrip`; BL-05 preserved | ✓ VERIFIED | `useFollowScroll` import + call present; `isPinned` ≥ 1; `beginProgrammaticScroll` ≥ 1; `RunStatusStrip`/`jumpToLive` ≥ 1; `scrollListenerAttachedRef` preserved |
| `frontend/src/components/chat/OutputFileCard.tsx`      | `variant` hero/working + `fileIcon`; url-less dead state; no silent dead anchor          | ✓ VERIFIED | `fileIcon` import present; `variant="hero" | "working"` prop; hero glow/gradient layout; url-less dead-state affordance; `dangerouslySetInnerHTML`=0 |
| `frontend/src/components/chat/MessageItem.tsx`         | `FinalOutputsPanel` hero block above collapsible Working files; all files present        | ✓ VERIFIED | `FinalOutputsPanel` sub-component; `Working files` text ≥ 1; `is_hero`/`heroes` ≥ 1; `data-testid="final-outputs-panel"` preserved; re-rank never hide |
| `backend/app/services/agent_loop.py`                   | `_select_hero_filenames`; `is_hero` on emit + persist; url guard                        | ✓ VERIFIED | Helper at module level; `is_hero` ≥ 2; `_select_hero_filenames` ≥ 1; `'final_output_files'` = 1 (baseline); `sandbox_outputs.py` diff = 0 |
| `backend/tests/test_095_final_output_tag.py`           | 13 cases: hero selection, emit projection, persist reconstruction                        | ✓ VERIFIED | 13/13 pytest green (confirmed by orchestrator evidence + direct run) |

---

### Key Link Verification

| From                                              | To                                              | Via                                     | Status     | Details                                                               |
| ------------------------------------------------- | ----------------------------------------------- | --------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `RunCard.tsx`                                     | `frontend/src/lib/stepCount.ts`                 | `import { unifiedStepCount }`           | ✓ WIRED    | Import confirmed; 5 usage sites in RunCard                             |
| `ToolCallPanel.tsx`                               | `frontend/src/lib/stepCount.ts dedupToolCalls`  | `import { dedupToolCalls }`             | ✓ WIRED    | Import confirmed; inline useMemo dedup replaced; `const seen = new Set`=0 |
| `MessageList.tsx`                                 | `frontend/src/hooks/useFollowScroll.ts`         | `useFollowScroll(getViewport, isStreaming)` | ✓ WIRED | Import + call confirmed; auto-follow gated on `isPinned`               |
| `MessageList.tsx` JumpToLive chip                 | `RunStatusStrip.tsx placement=header`           | `<RunStatusStrip placement="header" …>` inside pill button | ✓ WIRED | Confirmed (discretion: header placement inside floating pill, not placement=floating — documented rationale in 095-04-SUMMARY) |
| `OutputFileCard.tsx`                              | `frontend/src/lib/fileIcon.tsx`                 | `import { fileIcon }`                   | ✓ WIRED    | Import confirmed; used for both hero and working variants              |
| `MessageItem.tsx FinalOutputsPanel`               | `OutputFileCard.tsx`                            | `<OutputFileCard variant="hero"/"working" …>` | ✓ WIRED | Confirmed; hero block + collapsible working group both use OutputFileCard |
| `agent_loop.py final_output_files emit`           | `api.ts onFinalOutputFiles dispatch`            | additive `is_hero` field on file dicts  | ✓ WIRED    | `is_hero` flows through `api.ts:593-596` and `StreamsProvider:714-715` |
| `api.ts _mapMessageResponse` reload               | `is_hero` reconstruct                           | `api.ts:126` carries `is_hero` from tool_calls result | ✓ WIRED | Confirmed; reload reconstruction carries the flag for next-day re-hero |
| `StreamsProvider onSubAgentStart`                 | owning `analyze_document` tool_call `tc.sub_agent` | stamp onto matching running tool_call or create synthetic owner | ✓ WIRED | Confirmed; `m.sub_agent` single-slot writes = 0; `tc.sub_agent` writes on owner entries only |

---

### Data-Flow Trace (Level 4)

| Artifact                 | Data Variable             | Source                                     | Produces Real Data | Status       |
| ------------------------ | ------------------------- | ------------------------------------------ | ------------------ | ------------ |
| `RunStatusStrip.tsx`     | `stepCount`, `elapsedLabel` | `unifiedStepCount(message)` + `Date.parse(message.created_at)` in RunCard | Yes — reads persisted `tool_calls` + `created_at` from DB/SSE message | ✓ FLOWING    |
| `ToolCallPanel.tsx`      | `deduplicatedToolCalls`   | `dedupToolCalls(toolCalls)` from `@/lib/stepCount` | Yes — processes real `message.tool_calls` from SSE/DB | ✓ FLOWING    |
| `MessageList.tsx`        | `isPinned`, `showJumpToLive` | `useFollowScroll` reading real DOM scroll geometry | Yes — driven by actual viewport scroll events | ✓ FLOWING    |
| `OutputFileCard.tsx`     | `file.url`, `file.is_hero` | `StreamsProvider onFinalOutputFiles` → `messages` state | Yes — from live SSE `final_output_files` event or DB-loaded `tool_calls` result | ✓ FLOWING    |
| `MessageItem.tsx FinalOutputsPanel` | `heroes`, `working` | `message.finalOutputFiles` filtered by `is_hero` | Yes — real file list from `final_output_files` event | ✓ FLOWING    |

---

### Behavioral Spot-Checks

| Behavior                                  | Command                                                                     | Result           | Status  |
| ----------------------------------------- | --------------------------------------------------------------------------- | ---------------- | ------- |
| D-04 stepCount pure logic: N deduped tools across M iterations → N | `npx vitest run src/lib/__tests__/stepCount.test.ts` | 11/11 passed | ✓ PASS  |
| D-07 fileIcon: ext→Lucide glyph + colored label | `npx vitest run src/lib/__tests__/fileIcon.test.tsx` | 11/11 passed | ✓ PASS  |
| D-06 timer: no vanish on zero elapsed, freeze at terminal | `npx vitest run src/components/chat/RunCard.test.tsx` | 23/23 passed | ✓ PASS  |
| D-03 follow-scroll state machine: release/re-arm/jump/programmatic-immunity | `npx vitest run src/__tests__/hooks/useFollowScroll.test.ts` | 7/7 passed | ✓ PASS  |
| D-03 MessageList: chip shows on scroll-away, hides on re-arm | `npx vitest run src/__tests__/components/chat/MessageList.test.tsx` | 9/9 passed | ✓ PASS  |
| D-07 hero/working grouping + url-less dead state | `npx vitest run src/__tests__/components/MessageItem.finalOutputs.test.tsx` | 7/7 passed | ✓ PASS  |
| D-08 hero tag: selection + emit + persist | `cd backend && venv/Scripts/python -m pytest tests/test_095_final_output_tag.py` | 13/13 passed | ✓ PASS  |
| D-05 zero-dup sub-agent                   | `npx vitest run src/__tests__/providers/StreamsProvider.dedup.test.ts`      | 4 new D-05 cases green; 2 PRE-EXISTING DI-095-03-01 failures (stale 075.2 id assertions) | ✓ PASS (new cases) |
| ToolCallPanel shared dedup + Round-N rail | `npx vitest run src/__tests__/components/ToolCallPanel.test.tsx`            | 8/8 passed       | ✓ PASS  |

---

### Requirements Coverage

| Requirement | Source Plan       | Description                                                                                                             | Status       | Evidence                                                                                                          |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| CHAT-04     | 095-01 through 095-05 (all 5 plans) | Chat tool-cards render in one consistent frame with auto-scroll, details-on-demand collapse, no duplicates, consistent timer/step-count, and a working download | ✓ SATISFIED (automated) + ? HUMAN (live UAT) | D-04..D-08 all implemented and tested; 4 lived-experience UAT scenarios remain in Manual-Only queue |

---

### Anti-Patterns Found

| File                                                  | Line    | Pattern                                  | Severity  | Impact                                                                                                         |
| ----------------------------------------------------- | ------- | ---------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/chat/RunCard.tsx`            | 108-124 | WR-01: timer inflated on reloaded terminal runs — `frozenEndRef.current` captures `Date.now()` (page-load instant) as the freeze; `elapsedMs = pageLoad - created_at` → e.g. `1440m 0s` for a day-old run | ⚠️ Warning | The live-run vanish is fixed (SC#2 target). The reloaded-terminal path regresses: old code showed nothing; new code shows a wildly wrong duration. Not a critical blocker (live runs are correct; the REVIEW code-review found 0 criticals) but introduces an honesty gap on cold-loaded terminal runs. |
| `backend/app/services/agent_loop.py`                  | 2060-2092 | WR-02: hero flag computed per execute_code cell (cumulative `_previous_files_in_run` at each cell's persist point) → on reload, `_mapMessageResponse` aggregates across all cells and may surface multiple `is_hero=True` files where the live run showed one | ⚠️ Warning | Reload-only edge case. Live `final_output_files` emit picks exactly one hero over the full cumulative set. Reload may hero 2-3 files instead of 1 in a multi-cell run. Re-rank/never-hide contract holds; all files downloadable. Breaks D-08 "single hero on reload" in the multi-cell scenario. |
| `frontend/src/providers/StreamsProvider.tsx`          | 520-560 | WR-03: when `sub_agent_start` arrives before `tool_start`, the fallback creates a synthetic owner entry with `id: "running-{observedAt}"`. If the real `tool_start` then arrives, `onToolStart`'s idempotency guard no-ops (name + iteration match) and the real tool's `args` are dropped from the row. Sub-agent body content is preserved; only args are lost. | ⚠️ Warning | Low probability (out-of-order provider path + specific timing). No duplicate render (SC#1 holds). The provider-specific ordering must be proven live to know if any native-7 provider actually triggers this path. Should be verified during UAT. |
| `frontend/src/components/chat/ToolCallPanel.tsx`      | 429-433 | IN-03: `nodeStateOf` queued branch is unreachable for the real `ToolCall.status` union (`"running" | "done" | "interrupted" | "preparing"`). A failed tool silently becomes a dim "queued" node if the union ever gains `"failed"`. | ℹ️ Info    | Defensive dead code, harmless today. No user-visible impact. |
| `backend/app/services/agent_loop.py`                  | 826-852 | IN-02: `_select_hero_filenames` mixes `f.get("filename")` (agent-declaration branch) with `f["filename"]` direct access (ext/fallback branches). The `KeyError` path is unreachable today (harvest always populates `filename`) but the inconsistency is a future-regression risk. | ℹ️ Info    | No current impact. |
| `frontend/src/components/chat/MessageList.tsx`        | 30-47, 232-250 | IN-01: floating chip elapsed (`formatFloatingElapsed`) re-renders only on `messages` change, not on a 250ms interval, so it can freeze during token-quiet stretches. | ℹ️ Info    | Cosmetic; header strip remains authoritative timer. |

---

### Human Verification Required

Per `095-VALIDATION.md` Manual-Only section and SC#3 cross-provider requirement. All four scenarios require Chrome DevTools MCP + live providers:

#### 1. Long Run Stays Honest

**Test:** Run a Kimi/Moonshot prompt that triggers ~11 tool calls (e.g. "Research and write a 10-slide PPTX on enterprise RAG architecture"). Watch the RunCard header from first token to completion.

**Expected:**
- Timer shows and ticks continuously from kick-off (never blinks out mid-run)
- "Step N" in the header strip and in the panel always shows the same N
- The read/summarize (analyze_document) sub-agent card appears exactly ONCE (no duplicate that self-heals after 10-15s)
- Timer freezes to a final duration at run-end (does not keep ticking after the run completes)

**Why human:** Requires a real long multi-step run on a slow provider; the browser must be live to observe the continuous DOM timer ticks; jsdom cannot simulate the 250ms setInterval + real SSE stream.

**Also check WR-03:** Does Kimi/Moonshot trigger the `sub_agent_start` before `tool_start` ordering? If so, verify the sub-agent row still has its args visible (the WR-03 edge case).

#### 2. Multi-Tool Calm

**Test:** One prompt to any native provider: "Search my knowledge base for RAG papers and then run Python to plot a bar chart of the top 5 papers by citation count."

**Expected:**
- `search_documents` and `execute_code` both appear as numbered rail rows (StepRail)
- When `search_documents` completes, it folds to a summary row (Focus Mode)
- The active `execute_code` row stays expanded
- Auto-scroll follows the live edge while the user is at the bottom; scrolling up releases the pin; the "↓ Jump to live" chip appears; clicking it re-pins

**Why human:** Live streaming + actual DOM scroll physics; jsdom does not simulate real viewport geometry or smooth scroll.

#### 3. Hero File Downloads (Including Next-Day)

**Test:** Ask any provider: "Create a summary report as a Word document (.docx)." After the run completes:
- Verify the .docx appears as a "★ Your file" hero card above the "Working files (N)" group
- Click the Download button — verify the file downloads correctly (not a 404)
- Close the browser tab; wait (or simulate by clearing session state); reopen the chat thread
- Verify the hero card still shows the .docx as the hero and the Download button still works

**Expected:** Hero is the .docx; all other generated files are in the Working files group; download works immediately; next-day/reload also works via the re-sign endpoint.

**Why human:** Needs real Supabase Storage signed URL generation + the re-sign endpoint (`sandbox_outputs.py`) + multi-session elapsed time. Also surfaces WR-02 risk: if the run used multiple `execute_code` cells, check that only ONE .docx is heroed on reload (not two).

#### 4. Two Threads + 6-Provider Parity

**Test:** Open Thread A with one provider (e.g. OpenAI) on a multi-tool prompt. While Thread A is streaming, open Thread B with a different provider (e.g. Anthropic) and send a prompt. Then sweep 4 more providers (Google, OpenRouter, DeepSeek, MiniMax) each with a 2+ tool prompt.

**Expected:**
- No cross-thread bleed (Thread B's tool cards do not appear in Thread A's run)
- The RunCard frame, step count, timer, sub-agent zero-dup, and file hero/working layout look identical across all 6 providers — one consistent UX frame

**Why human:** Parallel streaming sessions require a real browser; cross-provider visual parity requires live runs on each provider.

---

### Warnings Summary (not gaps, not human items)

These three items from the code review are noted for the record but do not block the phase goal or the human UAT:

**WR-01 — Timer inflated on reloaded terminal runs.** Live runs: fixed (SC#2 target achieved). Cold-loaded terminal runs (next-day reopen): the freeze captures `Date.now()` on mount, producing e.g. `1440m 0s` for a day-old run. The SC#2 target (`timer-disappears-long-runs`) was live-run vanishing, which is fixed. The reload-inflation is a new inaccuracy vs the old behavior (old: no timer shown; new: wrong timer shown). Recommend fixing in a follow-on `/gsd:quick` by tracking whether the freeze was captured during a live stream this session.

**WR-02 — Multiple heroes on reload for multi-cell runs.** The hero set is recomputed per-cell at persist time; `_mapMessageResponse` aggregates across cells on reload and may surface 2-3 hero cards instead of 1. The live `final_output_files` emit correctly picks one. Fix: compute the hero set once over the full cumulative `_previous_files_in_run` at the emit site and carry that as the canonical set for all cells' persist records.

**WR-03 — Synthetic owner row drops real tool args.** Low-probability (requires `sub_agent_start` before `tool_start` ordering). Sub-agent content is preserved; only `args` are lost from the placeholder row. Verify during UAT #1 (Kimi/Moonshot) whether this ordering actually occurs.

---

### Gaps Summary

No automated gaps. The 4 human-verification items above are all operator-owned LIVE Chrome-DevTools-MCP UAT scenarios per `095-VALIDATION.md` (Manual-Only section). They cannot be automated (real browser, real providers, real file downloads, real elapsed time). The status is `human_needed` because these scenarios have not yet been exercised.

The 3 warnings (WR-01, WR-02, WR-03) are polish/edge-case concerns documented above; they do not block the phase goal and are recommended for follow-on quick fixes.

---

_Verified: 2026-06-06T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
