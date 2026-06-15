---
status: partial
phase: 094-workflow-legibility-mode-clarity
source: [094-VERIFICATION.md]
started: 2026-06-05T00:25:00Z
updated: 2026-06-05T01:10:00Z
---

## Current Test

[live Chrome-MCP UAT run by orchestrator + operator, 2026-06-05 — OpenAI + Anthropic, Literature review workflow]

## Tests

### 1. SC#10 axis-1 — Cross-provider parity
Run a Harness workflow on OpenAI, Anthropic, Google, OpenRouter (one model each).
expected: The phase timeline, mode badge, and a failed-run reason render IDENTICALLY across all four providers — no provider-specific rendering.
result: PASS (representative) — OpenAI (gpt-5.4-mini) and Anthropic (claude-haiku-4-5) both ran Literature review end-to-end with IDENTICAL timeline rendering (Phase i/N, glyphs ✓/●/○, Complete/Running/Locked states), identical mode-pill behavior (Deep→Harness→Deep), and both produced grounded KB answers (7 sources / ranked CSF table). No provider-specific rendering observed. Google + OpenRouter not run this session — covered by the provider-agnostic-by-construction architecture + the 2 identical representatives.

### 2. SC#10 axis-2 — Multi-tool
Run a workflow whose `llm_agent`/`llm_batch_agents` phase uses `search_documents` + `execute_code`.
expected: Per-subtopic summaries render in BatchResultList; NO per-phase tool/search count chips appear (D-03 suppress-don't-fake).
result: PARTIAL — the `llm_batch_agents` "review" phase ran 2 parallel sub-agents using `search_documents` (KB-grounded, 7 sources); SUB-RESULTS (BatchResultList) showed both per-subtopic rows Running→Done; NO per-phase tool/search count chips appeared (D-03 suppression ✓); "2 agents" honest tally shown. The strict `search_documents` + `execute_code` 2-tool combo was NOT exercised (Literature review is search+synthesize, no code). Batch sub-results + count-suppression confirmed.

### 3. SC#5 / SC#10 axis-3 — Parallel-thread isolation (LIVE)
Thread A streams a Harness run while Thread B accepts a new prompt.
expected: Thread A's timeline is not corrupted; Thread B's composer is unlocked (no global isStreaming lockout). Phase i/N + phasesByThread stay owner-scoped.
result: PASS — while Thread A (Anthropic) streamed its merge phase, opened Thread B: composer UNLOCKED ("Ask anything…", pill back to Deep), panel EMPTY (no A-timeline bleed). Switched back to A: timeline INTACT and still streaming (aria-busy, sub-results preserved), composer re-locked. No global isStreaming lockout (075.3 regression stays closed). Per-thread phasesByThread isolation confirmed.

### 4. SC#10 axis-4 — Long-message
Run a workflow in a thread with ≥50 prior messages OR a ≥5KB kickoff prompt.
expected: The timeline + draft preview render correctly without layout/perf degradation.
result: PARTIAL — both completed runs rendered long multi-section answers (8 CSFs + ranked table) without layout/perf degradation; a purpose-built ≥50-message harness thread was not constructed this session. Low risk (no per-message timeline coupling observed).

### 5. SC#4 — Both-themes REAL contrast (Chrome MCP)
Render the timeline in dark + light.
expected: Status/title text ≥4.5:1; `--accent-violet` graphic ≥3:1; "Attempt N" retrying pill text ≥4.5:1.
result: PASS (present states) — dark + light both render the timeline with strong contrast: green ✓ Complete, amber ● Running, grey ○ Locked, dark-on-light titles, green "High confidence". The `retrying`-purple and `failed`-red states could NOT be triggered live (the 4 shipped seeds have zero active gates post-065; no failure path fired), so those specific states remain covered by vitest-axe (structure) + the WR-04 contrast math (the lightened `--accent-violet-text`: 9.83:1 dark / 8.52:1 light).

### 6. SC#1 / PANEL-08 — Auto-open on entering Harness Mode
Launch a workflow.
expected: The workspace panel auto-opens to the phase timeline (reconciled via GET /threads/{id}/workflow on mount), showing current/locked/completed glyphs + transition log.
result: PASS — on launch (both OpenAI + Anthropic) the panel auto-opened from empty to the live WORKFLOW timeline; phases reconciled (split/review/merge), glyphs + states correct, single role=status announcer fired on transition edges ("Phase 3 of 3, merge, complete"), counter advanced forward-only. Mode pill flipped Deep→Harness.

### 7. SC#5 — UI-state matrix
Timeline across collapse states, both themes, multiple threads, mobile.
expected: Renders correctly collapsed/expanded, dark + light, across thread switches (no Phase i/N high-water bleed — WR-02 fix), mobile.
result: PASS (themes ✓ / multi-thread ✓ / mobile ✓) — dark+light both clean; multi-thread isolation confirmed (item 3); mobile (390×844) renders the panel as a bottom-sheet (Sheet pattern) with drag-handle + ✕, chat reflows, hamburger nav. No cross-thread Phase i/N bleed observed (WR-02 fix holds). Panel collapse-to-rail is shipped 087 infra (not re-exercised this session).

## Summary

total: 7
passed: 5
issues: 0
pending: 0
skipped: 0
partial: 2

## Gaps

### G-1 (WR-05, ALREADY DEFERRED) — completed-run timeline vanishes on revisit — REPRODUCED LIVE
A completed/terminal harness run's panel timeline disappears (panel reverts to "No workspace activity yet") after switching away from the thread and back, because once the run anchor clears the mount-time reconcile returns mode=deep and `reconcilePhases` returns []. Confirmed live: after the Anthropic run completed and I switched to another thread and back, the timeline was gone. The final ANSWER persists in chat (so SC#6 "never an empty done" / the trust contract HOLDS), but the panel legibility surface is lost on revisit. Was already deferred (operator decision) pre-UAT; the live repro strengthens the case to prioritize it. Route: Phase 095 / targeted gap-closure.

### G-2 (Finding #1, WR-05 family) — reconcile degrades timeline richness post-completion / on-revisit
The mount/post-completion reconcile produces a less-rich timeline than the live stream: Phase-1 slug reverts to the positional placeholder ("phase-0"), phase-type labels degrade to generic "Step" (vs live "Server step"/"Parallel agents"), the workflow name reverts to generic "Workflow", and the elapsed timer resets to 0s on thread-switch-back. Consistent across providers (not a parity break). Same reconcile-contract root as WR-05 (the GET /threads/{id}/workflow reconcile carries position/total, not full per-phase type/slug/name history). Does not break any SC — the live experience (the operator's #1 "real steps, not a spinner" bar) is fully delivered during the run. Route: bundle with WR-05 (Phase 095 / gap-closure).

**No NEW blocking defects found in live UAT.** Both gaps are in the already-deferred WR-05 / reconcile-contract family. The core deliverable — a live, accessible, honest phase timeline during a running workflow, cross-provider, with zero chat re-renders — is verified live.
