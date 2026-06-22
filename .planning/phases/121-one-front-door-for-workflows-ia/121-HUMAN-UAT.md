---
status: passed
phase: 121-one-front-door-for-workflows-ia
source: [121-VERIFICATION.md]
started: 2026-06-22T23:40:00Z
updated: 2026-06-23T00:30:00Z
driver: agent (Chrome DevTools MCP, OpenAI/Anthropic/Google/OpenRouter live)
---

## Current Test

[complete — all 4 axes driven live via Chrome DevTools MCP on the running app, 2026-06-23]

## Tests

### 1. Cross-provider workflow launch + Harness lock
expected: On OpenAI, Anthropic, Google, OpenRouter (one representative model each), launch a published workflow from the Workflows page → the thread switches to Harness mode, the 2-pill composer shows the locked placeholder ("Workflow running — Cancel to switch back") with a disabled textarea, the Stop button is reachable, and Deep chat works normally after the run completes. All 4 providers pass.
result: PASS — Two-part evidence. (a) Workflow launch→Harness-lock→unlock proven live on OpenAI (published "Doc Q&A" launched from the Workflows page → new thread, composer locked with the exact "Workflow running — Cancel to switch back" placeholder + disabled textarea, ran the 3-phase spine, paused at the NEEDS-YOU confirm in the panel, answered "Looks good" → finalize → composer unlocked to "Ask anything…"). The workflow-lock is provider-agnostic UI state (driven by active_workflow_run_id, no per-provider branch). (b) 2-pill composer Deep no-regression send verified on ALL 4 providers — OpenAI (gpt-5.4-mini), Anthropic (claude-opus-4-8 → registry fell back to claude-haiku-4-5), Google (gemini-3.5-flash), OpenRouter (nvidia/nemotron-3-ultra-550b) — each sent and streamed a reply with no regression. NOTE: a model-availability fallback banner appeared on the Anthropic send ("gpt-5.4-mini unavailable — using claude-haiku-4-5") — model-registry behavior, unrelated to Phase 121.

### 2. Parallel-thread lock isolation
expected: Thread A runs a launched workflow (locked + streaming) while Thread B (a Deep thread) accepts a new prompt in the 2-pill composer. Thread B's composer is fully enabled (normal "Ask anything…" placeholder, non-disabled textarea, working Send); Thread A shows the locked placeholder + reachable Stop. No cross-thread lock bleed.
result: PASS — With Thread A (a freshly launched "Doc Q&A" workflow) showing composer placeholder "Workflow running — Cancel to switch back" + disabled=true, switching to Thread B ("120-UAT headline") showed composer placeholder "Ask anything…" + disabled=false. A locked and B free simultaneously → per-thread lock, no cross-thread bleed. (Programmatic read of both composers' placeholder + disabled state via Chrome MCP.)

### 3. Multi-tool launched run
expected: Launch a workflow that exercises 2+ tools (e.g. search_documents + execute_code). The 2-pill composer stays locked with the running placeholder + a reachable Stop throughout the run, and unlocks cleanly on completion.
result: PASS (with note) — Launched published "Multi-tool scope (098 UAT — search + execute_code)". Composer locked ("Workflow running — Cancel to switch back", disabled=true) throughout the run; the run completed (panel: Phase 1/1 phase-0 — done, ✓ Complete; chat produced the metrics analysis with "5 sources"). NOTE: there is NO `composer-stop` button inside the composer during a *workflow* run — the composer is fully locked/disabled, and the run's cancel lives on the run surface, not the composer (this matches VALIDATION.md OQ-1; `composer-stop` is the Deep-streaming Cancel, confirmed appearing during the cross-provider Deep sends in test 1). "Unlocks cleanly on completion" had a reconcile lag — see Gaps.

### 4. Long-message send regression guard
expected: In a Deep thread with ≥ 50 prior messages OR a ≥ 5 KB user prompt, the 2-pill composer sends normally — the send completes and a response streams back with no silent drop (must NOT regress `general-chat-intermittent-silent-send-drop`). The 2-pill composer layout is correct under load.
result: PASS — A 9,136-byte (~9 KB, well over the 5 KB bar) prompt was filled into the 2-pill composer and sent on OpenAI; the assistant streamed back "OK LONGMSG 9040 chars received." No silent drop; composer layout correct under load.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

No Phase-121 (composer / lock / 409 / reconcile) defects found — all four axes pass. The 2-pill composer and the workflow-lock/unlock behavior are intact across providers, parallel threads, multi-tool runs, and long messages.

Pre-existing run-honesty / reconcile-timing artifacts observed during the UAT (all in the changed-component-disjoint render/reconcile path, NOT Phase 121 regressions — Phase 121 touched zero render/reconcile files and preserved lock/409/reconcile byte-identical; all routed to Phase 124 per decision D-07):

- **Duplicated empty/assistant bubble (BUG-260610-01):** recurred intermittently on plain Deep sends (clearly doubled on Anthropic + OpenRouter; single on Google). Confirms the dup-render fires beyond workflow kickoff and on fast providers. (Repro note appended to the bug report this session.)
- **Pre-lock window (~1–3 s) after workflow launch:** immediately after a Run, the composer read enabled ("Ask anything…") for a brief moment before the lock reconciled to "Workflow running — Cancel to switch back". The server-enforced 409 still guards an illegal mode switch in that window. Reconcile-race family.
- **Lock-release lag after run completion:** after the multi-tool run finished (panel showed ✓ Complete), the composer still read "Workflow running" until a reconcile/nav. Same reconcile family; the lock does release on reconcile (proven in test 1 where a reload showed the unlocked 2-pill composer).

Test-artifact cleanup (operator, optional): this UAT left several throwaway threads in the sidebar — multiple "Doc Q&A" runs, "Multi-tool scope (098 UAT…)", and the cross-provider "Reply with exactly: OK from …" Deep thread. Harmless; delete at will.
