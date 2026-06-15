---
phase: 095-chat-tool-card-unification
verified: 2026-06-06T12:00:00Z
status: human_needed
score: 4/4 must-haves verified (gap-closure re-verification)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/4 automated; operator live-UAT found 3 gaps
  gaps_closed:
    - "GAP-095-01: fold-all shared boolean — replaced with per-step expandedSteps Set; one click expands only that card"
    - "GAP-095-02: hero highlight leaks working files — _select_hero_filenames returns exactly ONE hero on every branch; canonical _hero_set shared by emit + persist (live == reload)"
    - "GAP-095-03 HIGH essence + un-gate: finished cards rest as a single result-bearing essence line from step 1 (no >=3 gate)"
    - "GAP-095-03 MED bloom: active-step bloom (primary-dim wash + inset 2px primary left bar) replaces the outer glow"
    - "GAP-095-03 MED chip chrome: header status strip is a rounded-full pill (bg + border + divider bars)"
    - "GAP-095-03 MED single verb: activity verb renders exactly once (in the strip only, not in the title)"
    - "GAP-095-03 MED run-sub: 'turn N' subline restored from iterationCount (no backend field)"
    - "GAP-095-03 MED icon sizes: hero 48px / working 30px"
    - "GAP-095-03 MED hero glow: soft 24px primary halo replaces flat 1px ring"
    - "GAP-095-03 MED top-rule/eyebrow: borderless top-rule + uppercase dim mono eyebrow replaces bordered card"
    - "GAP-095-03 LOW chip-order: status-first, jump trailing"
    - "GAP-095-03 LOW intermediates copy: 'Working files (N) — intermediates, all downloadable'"
    - "WR-01 (code review): double-frame regression fixed via header-bare placement variant on RunStatusStrip"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Long run stays honest — timer continuous, step count == cards, no sub-agent dup, freeze at true terminal"
    expected: "Kimi/Moonshot ~11-step run: timer never blinks out, step N in header == step N in strip == N deduped cards in panel, read/summarize sub-agent appears exactly once, timer freezes at run end; also verify WR-03 (sub_agent_start before tool_start ordering) does not drop args"
    why_human: "Needs a real long multi-step run across a slow provider; browser-only behavior; cannot simulate live SSE + real-time DOM updates programmatically"
  - test: "Multi-tool calm — search_documents + execute_code; finished folds, active open, auto-scroll follows edge"
    expected: "One prompt fires both tools; finished tools collapse to summary essence row; active tool is expanded with bloom; chat follows the live edge while at bottom; scrolling up shows jump chip with status-first / jump-trailing order"
    why_human: "Live streaming + scroll behavior requires a real browser with DevTools MCP; cannot test scroll physics in jsdom"
  - test: "Hero file downloads — ask for a .docx; hero is the single doc (not all docs); one-click download; reopen chat next day — download still works; if multi-cell run, still exactly one hero on reload"
    expected: "The .docx is the sole hero card (above 'Working files (N) — intermediates, all downloadable'); Download button works immediately; on a next-day reload the hero card still shows exactly one hero and the download still succeeds via the re-sign endpoint"
    why_human: "Needs real file generation + re-sign path + next-day reopen; cannot simulate Supabase Storage signed URLs or multi-session elapsed time in tests"
  - test: "Two threads + 6-provider parity — Thread A streaming while Thread B accepts a prompt; unified frame identical across all 6 native providers"
    expected: "No cross-thread bleed; the RunCard frame, step count, timer, sub-agent zero-dup, single-essence finished cards, and file hero/working layout are indistinguishable across OpenAI / Anthropic / Google / OpenRouter / DeepSeek / MiniMax; per-card collapse works on all providers"
    why_human: "Requires parallel streaming sessions + cross-provider live runs; browser-only multi-tab behavior"
---

# Phase 095: Chat Tool-Card Unification Verification Report

**Phase Goal:** Chat tool-cards render in one consistent frame with auto-scroll, details-on-demand collapse, no duplicates, consistent timer/step-count, and a working download — closing the felt-experience defects in the chat execution surface.

**Verified:** 2026-06-06T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — gap-closure re-verification after plans 095-06..09 + WR-01 code-review fix

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                   | Status     | Evidence                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tool-cards render in one consistent frame with auto-scroll and details-on-demand collapse; no duplicate cards on any provider (closing BUG-260529-02). | ✓ VERIFIED | GAP-095-01 fixed: `stepsCollapsed`/`setStepsCollapsed`/`shouldCollapse` all = 0 in ToolCallPanel.tsx; `expandedSteps` >= 13 occurrences; `expandedSteps.has` = 5; 12/12 ToolCallPanel tests green including 5 new per-step cases. GAP-095-03 essence + un-gate: single essence line resting state, no >=3 gate; sub-agent transparency line remains visible at rest. D-05 sub-agent dedup unchanged (tc.sub_agent stamp, m.sub_agent = 0). |
| 2   | The run timer stays visible for the full duration of long runs; step count matches between the timer and the panel. | ✓ VERIFIED | D-06 timer from Date.parse(message.created_at) unchanged (frozenEndRef/startMs/elapsedLabel confirmed untouched in Plan 07). D-04 unifiedStepCount wiring on all 3 sites unchanged. Run-sub `turn N` added from iterationCount (no backend field). GAP-095-03 MED strip pill chrome: `rounded-full` = 5 in RunStatusStrip.tsx; `w-px bg-border` = 2 (divider bars); middots replaced; outerBannerLabel = 1 call site (strip only); verb removed from headerTitle. 28/28 RunCard tests green (23 existing + 5 new Plan 07). |
| 3   | The output-file download link works end-to-end (no dead link); SC#10 cross-provider UAT confirms the unified frame behaves identically across all 6 native providers and survives a parallel-thread + long-message scenario. | ? PARTIAL  | GAP-095-02 fixed: `_select_hero_filenames` now returns exactly 1 hero on every branch via `_hero_pick` tie-break; old multi-hero test assertion gone; 19/19 backend tests green; `_select_hero_filenames(list(_previous_files_in_run` = 0 (partial per-cell computation removed); `_hero_set` = 5 (computed once, shared by emit + re-stamp); `final_output_files` emit sites = 1 (unchanged). GAP-095-03 file-axis: hero icon 48px, working 30px, soft 24px halo, borderless top-rule + dim eyebrow, intermediates copy, status-first chip. WR-01 fix: `header-bare` placement added to RunStatusStrip (no double-frame). Frontend file suites 7/7 + 9/9 green. SC#10 cross-provider 4-axis = operator-owned live UAT (4 scenarios in 095-VALIDATION.md). |
| 4   | The change is contained to the frontend chat surface (plus D-08 additive backend field) and does not regress PANEL-06 isolation or the StreamsProvider demux. | ✓ VERIFIED | dangerouslySetInnerHTML = 0 in all gap-closure files (ToolCallPanel, RunCard, RunStatusStrip, OutputFileCard, MessageItem, MessageList — 4 occurrences found are in pre-existing MarkdownRenderer/ChatArea/ShikiCode). PANEL-06 panel-store reads unchanged. final_output_files event name = 1 (unchanged). sandbox_outputs.py untouched (is_hero never feeds the re-sign path). Full vitest: 17 failed / 497 passed — identical pre-existing baseline, ZERO net-new failures. tsc -b = 37 (documented baseline). vite build exit 0. |

**Score:** 4/4 truths verified (SC#3's cross-provider 4-axis lived-experience UAT routes to human_verification)

---

### Deferred Items

No items deferred to later phases. All originally-deferred items remain in SEED-054 (per-file subtitle + folded-page SVG icon) as previously documented.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | --------- | ------ | ------- |
| `frontend/src/components/chat/ToolCallPanel.tsx` | Per-step expandedSteps Set; single essence-line resting state; un-gated fold; active bloom; no stepsCollapsed | ✓ VERIFIED | expandedSteps = 13 refs; stepsCollapsed/setStepsCollapsed/shouldCollapse = 0; `inset 2px 0 0` in index.css = 2; ToolEssenceLine present |
| `frontend/src/__tests__/components/ToolCallPanel.test.tsx` | 12 tests including 5 per-step + 2 Task 2 cases | ✓ VERIFIED | 12/12 green; expand-one-only assertion present; former expand-all assertion replaced |
| `frontend/src/index.css` | .tc-active-wrap = primary-dim wash + inset 2px left bar | ✓ VERIFIED | Lines 399-404: `background: hsl(var(--primary) / 0.06)` + `box-shadow: inset 2px 0 0 hsl(var(--primary))`; old `0 0 24px` outer glow absent from this block |
| `frontend/src/components/chat/RunStatusStrip.tsx` | Three placements: header (pill), header-bare (plain), floating (pill); divider bars; no middots | ✓ VERIFIED | All 3 placement branches confirmed; `rounded-full` = 5; `w-px bg-border` = 2; dangerouslySetInnerHTML = 0 |
| `frontend/src/components/chat/RunCard.tsx` | Calm title (no verb); `turn N` run-sub; outerBannerLabel call count = 1 (import + 1 call site) | ✓ VERIFIED | headerTitle derives `Run · N steps` / `Agent run` (no outerBannerLabel); `turn ` present = 1 in run-sub; outerBannerLabel call = 1 (strip activityVerb only) |
| `frontend/src/components/chat/OutputFileCard.tsx` | icon 48/30; soft 24px halo; no flat 1px ring | ✓ VERIFIED | `isHeroVariant ? 48 : 30` = 1; `shadow-[0_0_24px_hsl(239_100%_82%/0.18)]` = 1; old `0_0_0_1px_rgba(99,102,241,0.08)` = 0 |
| `frontend/src/components/chat/MessageItem.tsx` | borderless top-rule + dim eyebrow; intermediates copy; no bordered box | ✓ VERIFIED | `border-t border-border/60 pt-3.5` = 1; `uppercase tracking-[0.1em]` = 1; `intermediates, all downloadable` = 1; `rounded-md ghost-border bg-card/40 p-3` = 0 |
| `frontend/src/components/chat/MessageList.tsx` | RunStatusStrip LEADS with placement=header-bare; jump span TRAILS | ✓ VERIFIED | RunStatusStrip at line 204, jump span at line 213 (strip before span); `placement="header-bare"` confirmed; `aria-label="Jump to live"` = 1; `data-testid="jump-to-live-chip"` = 1 |
| `backend/app/services/agent_loop.py` | `_hero_pick`; single-hero on every branch; `_hero_set` shared by emit + re-stamp; no partial per-cell call | ✓ VERIFIED | `_hero_pick` helper defined; `max(matched_metas` via `_hero_pick(matched_metas)` = 1; `_hero_set` = 5 refs; `_select_hero_filenames(list(_previous_files_in_run` = 0 (removed); `final_output_files` = 1 emit; `re.findall` = 3 (token detection) |
| `backend/tests/test_095_final_output_tag.py` | 19 cases; multi-cell live==reload test; `len(...) == 1` assertions; old multi-hero assertion gone | ✓ VERIFIED | 19/19 pytest green; `len(heroes) == 1` = 9 occurrences; old `{"a.docx", "b.docx"}` assertion = 0; `test_multi_cell_live_equals_reload_single_hero` present |

---

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `ToolCallPanel.tsx` collapsed branch | `expandedSteps` Set membership | `!expandedSteps.has(stepKeyOf(tc, i))` | ✓ WIRED | Gate confirmed at line 605; un-gated (no >=3 threshold) |
| Collapsed essence row onClick | `expandedSteps` mutation | `setExpandedSteps(prev => new Set(prev).add(key))` | ✓ WIRED | expandStep/collapseStep helpers confirmed |
| `RunCard.tsx` headerTitle | calm run identity (no verb) | title = `Run · N steps` / `Agent run` | ✓ WIRED | headerTitle derivation confirmed; outerBannerLabel not in title path |
| `RunCard.tsx` strip activityVerb | `outerBannerLabel` (single call site) | `isStreamingNow ? outerBannerLabel(...) : null` | ✓ WIRED | Confirmed sole call site in the strip's activityVerb prop |
| `MessageList.tsx` floating chip | `RunStatusStrip` with `placement="header-bare"` | no double-frame (WR-01 fix) | ✓ WIRED | `placement="header-bare"` at line 208; RunStatusStrip leads, jump span trails |
| `OutputFileCard.tsx` hero variant | `fileIcon(file.filename, 48)` | `isHeroVariant ? 48 : 30` | ✓ WIRED | Line 82 confirmed |
| `_select_hero_filenames` all branches | `_hero_pick(metas)["filename"]` | single tie-break applied on declared/requested-ext/fallback | ✓ WIRED | All 3 branches confirmed; returns `{winner["filename"]}` |
| Loop-end `_hero_set` | Persisted execute_code rows | Post-loop re-stamp iterates `persisted_tool_calls` | ✓ WIRED | `_hero_set` = 5 refs; re-stamp guard present; `_persist_assistant_message` called after re-stamp |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ToolCallPanel.tsx` ToolEssenceLine | `summarizeToolCall(tc)` result text | Real `tc.result` from SSE/DB `tool_calls` | Yes | ✓ FLOWING |
| `ToolCallPanel.tsx` expandedSteps | component-local Set keyed on stepKeyOf | Real `toolCalls` prop each render | Yes — re-derived from live SSE/DB | ✓ FLOWING |
| `RunStatusStrip.tsx` header placement | elapsedLabel, stepCount, activityVerb | RunCard passes from Date.parse(created_at) + unifiedStepCount(message) + outerBannerLabel | Yes | ✓ FLOWING |
| `RunCard.tsx` runSub | `turn N` | `message.iterationCount` (0-based, from SSE/DB) | Yes | ✓ FLOWING |
| `OutputFileCard.tsx` hero/working | file.url, file.is_hero, file.filename | `final_output_files` SSE event or DB-loaded tool_calls result | Yes | ✓ FLOWING |
| `MessageItem.tsx` FinalOutputsPanel | heroes[], working[] | `message.finalOutputFiles` filtered by `is_hero` | Yes — canonical `_hero_set` from agent_loop.py | ✓ FLOWING |
| `agent_loop.py` `_hero_set` | hero filenames | `_hero_pick` over complete `_previous_files_in_run` | Yes — real sandbox harvest | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| GAP-095-01 per-card collapse: expand one, others stay folded | `npx vitest run src/__tests__/components/ToolCallPanel.test.tsx` | 12/12 passed | ✓ PASS |
| GAP-095-03 single-step un-gate: 1 finished step folds to essence from step 1 | Included in ToolCallPanel suite above | 12/12 passed | ✓ PASS |
| GAP-095-03 bloom: .tc-active-wrap = primary-dim wash + inset 2px left bar | `grep -c "inset 2px 0 0" frontend/src/index.css` | 2 | ✓ PASS |
| GAP-095-03 chip chrome: RunStatusStrip header = rounded-full pill | `grep -c "rounded-full" frontend/src/components/chat/RunStatusStrip.tsx` | 5 | ✓ PASS |
| WR-01 fix: floating chip uses header-bare (no double-frame) | `grep -c "header-bare" frontend/src/components/chat/MessageList.tsx` | 1 | ✓ PASS |
| GAP-095-03 single verb: outerBannerLabel call sites = 1 | RunCard.tsx outerBannerLabel grep (import + 1 call) | 1 call site in strip | ✓ PASS |
| GAP-095-03 icon sizes: hero 48, working 30 | `grep -c "isHeroVariant ? 48 : 30" OutputFileCard.tsx` | 1 | ✓ PASS |
| GAP-095-03 top-rule/eyebrow: no bordered box | `grep -c "rounded-md ghost-border bg-card/40 p-3" MessageItem.tsx` | 0 | ✓ PASS |
| GAP-095-03 intermediates copy | `grep -c "intermediates, all downloadable" MessageItem.tsx` | 1 | ✓ PASS |
| GAP-095-02 single-hero backend: 19 cases all branches single | `cd backend && venv/Scripts/python -m pytest tests/test_095_final_output_tag.py` | 19/19 passed | ✓ PASS |
| GAP-095-02 no partial per-cell hero computation | `grep -c "_select_hero_filenames(list(_previous_files_in_run" agent_loop.py` | 0 | ✓ PASS |
| GAP-095-02 canonical _hero_set shared by emit + persist | `grep -c "_hero_set" agent_loop.py` | 5 | ✓ PASS |
| Full frontend suite: zero net-new failures | `npx vitest run` | 17 failed / 497 passed (documented pre-existing baseline, ZERO net-new) | ✓ PASS |
| RunCard suite: 28/28 green | `npx vitest run src/components/chat/RunCard.test.tsx` | 28/28 passed | ✓ PASS |
| tsc -b baseline maintained | `npx tsc -b` | 37 errors (documented baseline) | ✓ PASS |
| vite build clean | `npx vite build` | exit 0 | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CHAT-04 | 095-01..09 (all plans incl. gap closure) | Chat tool-cards render in one consistent frame with auto-scroll, details-on-demand collapse, no duplicates, consistent timer/step-count, and a working download | ✓ SATISFIED (automated) + ? HUMAN (live UAT) | All structural gap fixes verified in code; 4 lived-experience UAT scenarios remain in Manual-Only queue |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `frontend/src/components/chat/RunCard.tsx` | 108-124 | WR-01 (timer inflation) is fixed for live runs. The cold-reload timer (reloaded terminal runs) still uses `frozenEndRef.current` captured at page-load instant → e.g. `1440m 0s` for a day-old run. This is a honesty gap but not a new regression from the gap plans — it existed before plan 06-09. SC#2 target (live-run vanish) is fixed. | ⚠️ Warning | Cold-loaded terminal runs show a wrong (inflated) duration. Follow-on `/gsd:quick` recommended. |
| `frontend/src/components/chat/ToolCallPanel.tsx` | 429-433 | IN-03: `nodeStateOf` queued branch is unreachable for the real `ToolCall.status` union. | ℹ️ Info | Defensive dead code, harmless today. |
| `backend/app/services/agent_loop.py` | 820-886 | IN-02 note: `f.get("filename")` vs `f["filename"]` mixed access is resolved (Plan 09 added `_hero_pick` with consistent access). | ℹ️ Info | Resolved by Plan 09. |
| `frontend/src/components/chat/ToolCallPanel.tsx` | 514-524 | IN-02 (code review): stale "075.6 collapse-at-3+" comments still describe the removed mechanism. | ℹ️ Info | Comment staleness only; no behavioral impact. |

---

### Human Verification Required

Per `095-VALIDATION.md` Manual-Only section and SC#3 cross-provider requirement. All four scenarios require Chrome DevTools MCP + live providers:

#### 1. Long Run Stays Honest (+ WR-03 check)

**Test:** Run a Kimi/Moonshot prompt that triggers ~11 tool calls (e.g. "Research and write a 10-slide PPTX on enterprise RAG architecture"). Watch the RunCard header from first token to completion.

**Expected:**
- Timer shows and ticks continuously from kick-off (never blinks out mid-run)
- "Step N" in the header strip and in the panel always shows the same N
- The read/summarize (analyze_document) sub-agent card appears exactly ONCE (no duplicate)
- Timer freezes to a final duration at run-end
- Per-card collapse: each finished essence row expands only itself when clicked
- WR-03 check: does Kimi/Moonshot trigger `sub_agent_start` before `tool_start`? If so, verify the sub-agent row still has its args visible (the rare ordering edge case)

**Why human:** Requires a real long multi-step run on a slow provider; continuous DOM timer ticks; live SSE + real-time DOM.

#### 2. Multi-Tool Calm

**Test:** One prompt to any native provider: "Search my knowledge base for RAG papers and then run Python to plot a bar chart of the top 5 papers by citation count."

**Expected:**
- `search_documents` and `execute_code` both appear as numbered rail rows
- When `search_documents` completes, it folds to a single essence line (Focus Mode, un-gated from step 1)
- The active `execute_code` row stays expanded with the active bloom (primary-dim wash + inset 2px left bar)
- Clicking one finished essence row expands only that row (per-card collapse — the #1 fix)
- Auto-scroll follows the live edge; scrolling up releases the pin; the "↓ Jump to live" chip shows with status segments leading and "↓ Jump to live" trailing

**Why human:** Live streaming + actual DOM scroll physics; jsdom cannot simulate viewport geometry.

#### 3. Hero File Downloads (Including Single-Hero + Next-Day)

**Test:** Ask any provider: "Create a summary report as a Word document (.docx) and include a CSV data table." After the run completes:
- Verify the .docx appears as the SINGLE "★ Your file" hero card above "Working files (N) — intermediates, all downloadable"
- The CSV appears in the Working files group (not as a hero)
- Click the Download button on the hero — verify it downloads (not a 404)
- Close and reopen the chat thread
- Verify the hero card still shows exactly ONE hero (the .docx) and the Download button still works
- (Multi-cell check) If the run used multiple execute_code cells, confirm only one hero on reload (WR-02 fix)

**Why human:** Needs real Supabase Storage signed URLs + re-sign endpoint + multi-session elapsed time.

#### 4. Two Threads + 6-Provider Parity

**Test:** Open Thread A with one provider (e.g. OpenAI) on a multi-tool prompt. While Thread A is streaming, open Thread B with a different provider (e.g. Anthropic) and send a prompt. Then sweep 4 more providers (Google, OpenRouter, DeepSeek, MiniMax) each with a 2+ tool prompt.

**Expected:**
- No cross-thread bleed
- The RunCard frame, per-card collapse, active bloom, step count, timer, sub-agent zero-dup, single essence line, and file hero/working layout are indistinguishable across all 6 providers
- The `turn N` run-sub and pill-chrome strip look consistent

**Why human:** Parallel streaming sessions require a real browser; cross-provider visual parity requires live runs.

---

### Gap-Closure Summary

All 3 operator-UAT gaps from 2026-06-06 have been structurally closed by plans 095-06..09 plus a code-review WR-01 fix (commit 4065580b):

| Gap | Root Cause | Fix | Code Evidence | Tests |
| --- | ---------- | --- | ------------- | ----- |
| GAP-095-01 fold-all | Single shared `stepsCollapsed` boolean | Per-step `expandedSteps` Set keyed on stepKeyOf | stepsCollapsed/setStepsCollapsed/shouldCollapse = 0; expandedSteps = 13 refs | 12/12 ToolCallPanel ✓ |
| GAP-095-02 hero leak | `_select_hero_filenames` returned multi-element set; partial per-cell hero vs complete emit | `_hero_pick` tie-break, single hero every branch; loop-end re-stamp | `_hero_set` = 5; partial call = 0; single-hero len asserts = 9 | 19/19 backend ✓ |
| GAP-095-03 sketch divergences | 9 visual/UX gaps (HIGH/MED/LOW) across ToolCallPanel, header, file-axis | Plans 06 (essence+bloom), 07 (chip chrome+verb+subline), 08 (file-axis+chip-order) | All grep acceptance criteria pass | All suites ✓ |
| WR-01 double-frame | Plan 07 gave header chrome to placement="header"; Plan 08 embedded it inside the floating pill | `header-bare` placement variant (plain segments, no nested pill) | `header-bare` in RunStatusStrip.tsx type + MessageList.tsx usage | — |

Remaining items: 4 lived-experience UAT scenarios (Manual-Only, require Chrome DevTools MCP + live providers). WR-01 (cold-reload timer inflation) is a pre-existing honesty gap, recommended as a follow-on `/gsd:quick`.

---

_Verified: 2026-06-06T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: gap-closure after plans 095-06..09 + WR-01 fix_
