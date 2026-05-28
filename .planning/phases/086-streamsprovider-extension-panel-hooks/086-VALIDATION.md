---
phase: 086
slug: streamsprovider-extension-panel-hooks
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
---

# Phase 086 — Validation Strategy

> Per-phase validation contract. Authored directly from 086-CONTEXT.md `<failure_criteria>`
> (10 testable modes), D-086-16 (SC#10 4-axis UAT matrix), and D-086-17 (4 G-4 lived-experience
> scenarios). Research was skipped per ROADMAP §086, so there is no RESEARCH §Validation
> Architecture to seed this — the source of truth is CONTEXT.md.
>
> Per CLAUDE.md "UAT scoreboard recipe": UAT rows live HERE, never in PLAN.md tasks. The Plan
> 086-02 Task 3 integration backstop covers SC#10 axes 1-3 automatically; cross-provider breadth
> and long-message (axis 4) stay manual per provider.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend unit/integration) + Chrome DevTools MCP (lived-experience UAT) |
| **Config file** | `frontend/vitest.config.ts` (existing) |
| **Quick run command** | `cd frontend; npx vitest run src/providers/__tests__/panelHooks.test.tsx` |
| **Full suite command** | `cd frontend; npx vitest run` |
| **Estimated runtime** | ~15 s (panel backstop file) / ~full-suite varies |

---

## Sampling Rate

- **After every task commit:** `cd frontend; npx tsc --noEmit` (type gate — all Plan 01/02 tasks)
- **After Plan 086-02 Task 3:** Quick run command (panel backstop)
- **After every plan wave:** Full suite command
- **Before `/gsd:verify-work`:** Full suite green + all manual UAT rows below executed via Chrome MCP
- **Max feedback latency:** ~15 s (quick) / type-check sub-10 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 086-01-01 | 01 | 1 | PANEL-05, PANEL-06 | — | 4 wire-mirror types match backend JSON; additive-only | type | `cd frontend; npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 086-01-02 | 01 | 1 | PANEL-05, PANEL-06 | T-086-03 | Legacy analyze_document dispatch byte-identical; sub_run_id sole discriminator | type | `cd frontend; npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 086-01-03 | 01 | 1 | PANEL-06 | T-086-01 | Cache key user-scoped + version-guarded (no cross-user leak) | type | `cd frontend; npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 086-02-01 | 02 | 2 | PANEL-05, PANEL-06 | T-086-04 | Immutable Map-replace; closure-bound actions; AbortController helper | type | `cd frontend; npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 086-02-02 | 02 | 2 | PANEL-05, PANEL-06 | T-086-04 | Null-safe selectors + stable EMPTY refs; raw store hidden | type | `cd frontend; npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 086-02-03 | 02 | 2 | PANEL-05, PANEL-06 | T-086-03, T-086-04 | Dispatch routing + abort + per-hook error isolation | integration | `cd frontend; npx vitest run src/providers/__tests__/panelHooks.test.tsx` | ❌ W0 (Plan 02 Task 3 creates) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Failure-Criteria → Verification Map (G-6)

Every one of CONTEXT.md's 10 testable failure modes maps to ≥ 1 row below.

| FC# | Failure Mode | Coverage | Type | Where |
|-----|--------------|----------|------|-------|
| FC#1 | Chat re-renders from panel events (PANEL-06) | panelHooks.test.tsx — bucket selector ref stable after workspace_file_written | integration (auto) | 086-02 Task 3.6 |
| FC#2 | Two SSE connections per thread (PANEL-05) | UAT-A1 — DevTools Network shows ONE text/event-stream with panel open | manual (Chrome MCP) | UAT-A1 |
| FC#3 | sub_agent_start mis-routing (legacy vs task) | panelHooks.test.tsx — both variants on same thread; correct callback fires | integration (auto) | 086-02 Task 3.1 + UAT-A2 |
| FC#4 | analyze_document regression | panelHooks.test.tsx — legacy 2-arg call byte-identical + delta unchanged | integration (auto) | 086-02 Task 3.1 + UAT-A2 |
| FC#5 | Rapid thread-switch stale data | panelHooks.test.tsx — abort asserted; no cross-thread bleed | integration (auto) | 086-02 Task 3.4 + UAT-G1 |
| FC#6 | ask_user_response orphan | panelHooks.test.tsx — ask removed by tool_call_id | integration (auto) | 086-02 Task 3.3 + UAT-G2 |
| FC#7 | Refresh-loses-ask | UAT-G3 — refresh during active ask; reconcile re-surfaces within ~500 ms | manual (Chrome MCP) | UAT-G3 |
| FC#8 | localStorage cross-user leak | UAT-S1 — log out / log in as second user; cached todos NOT visible | manual (Chrome MCP) | UAT-S1 |
| FC#9 | Provider-specific dispatch hole | UAT-X1..X4 — todo_updated updates useTodos on all 4 providers | manual (Chrome MCP) | SC#10 matrix |
| FC#10 | Cross-worker ask_user gap | UAT-G2 (parallel-thread) + UAT-X cross-provider with WORKER_COUNT=2 | manual (Chrome MCP) | UAT-G2 |

---

## SC#10 4-Axis UAT Matrix (D-086-16)

Per CLAUDE.md MANDATORY recipe — all 4 axes exercised. Plan 086-02 Task 3 automates axes 1-3
(dispatch routing, multi-tool callback fan-out, parallel-thread state isolation in vitest); the
rows below are the lived-experience runs via Chrome DevTools MCP against the real app
(`http://localhost:5173/`, login `fhdmrd@gmail.com / 123456`). One representative model per provider
class; OpenRouter is experimental per `feedback_openrouter_is_experimental`.

| Row | Axis: Cross-provider | Axis: Multi-tool | Axis: Parallel-thread | Axis: Long-message | Backstops | Status |
|-----|----------------------|------------------|-----------------------|--------------------|-----------|--------|
| UAT-X1 | OpenAI | `write_todos` + `workspace_write` + `task` in one prompt | single thread | normal | FC#3, FC#9 — todos + files + task all populate their panel Maps; analyze_document run in same thread still works (legacy path) | ⬜ |
| UAT-X2 | Anthropic | `write_todos` + `ask_user` | Thread A streams todos while Thread B receives an ask_user prompt | normal | FC#9, FC#10, parallel-thread isolation (PANEL-06) | ⬜ |
| UAT-X3 | Google | `workspace_write` + `task` | single thread | ≥ 50 prior messages (long-message axis) | FC#9 — events still demux correctly on a long thread; no chat re-render storm | ⬜ |
| UAT-X4 | OpenRouter (experimental) | `write_todos` + `ask_user` | single thread | ≥ 5 KB user prompt (long-message axis) | FC#9 — provider-agnostic dispatch holds; native-safe (no shared-path regression) | ⬜ |

> Multi-tool coverage: UAT-X1 exercises 3 tools in one prompt (exceeds the ≥1 row / 2+ tools requirement).
> Parallel-thread coverage: UAT-X2 (Thread A streaming while Thread B accepts a prompt).
> Long-message coverage: UAT-X3 (≥50 prior messages) AND UAT-X4 (≥5 KB prompt).

---

## G-4 Lived-Experience UAT Scenarios (D-086-17)

Operator-defined "I'd recognize failure here" scenarios, set at scope-time. Chrome DevTools MCP
drives all four — wire format + screenshots alone are insufficient (CLAUDE.md G-4).

| Row | Scenario | Pass Condition | FC Backstop | Status |
|-----|----------|----------------|-------------|--------|
| UAT-G1 | Switch threads mid-stream while an `ask_user` prompt is pending on Thread A | Switching back to A reconciles via `GET /ask_user/pending` and re-displays the pending prompt; no stale Thread B data shown under A | FC#5 | ⬜ |
| UAT-G2 | Submit an `ask_user` response while parallel Thread B streams todos | Both threads' panel state stays independent — zero cross-thread bleed; A's ask clears, B's todos keep streaming (PANEL-06) | FC#6, FC#10 | ⬜ |
| UAT-G3 | Refresh the page during an active `ask_user` prompt | First paint shows cached panel data (todos/tasks via localStorage); reconcile fetches pending asks within ~500 ms (pendingAsks NOT cached per D-086-03) | FC#7 | ⬜ |
| UAT-G4 | SSE `buffer_expired` during a `task` sub-agent run | Panel reconciles via `GET /tasks` on subscription restart; the sub-agent stays in `tasksByThread` (not lost) | FC#9, FC#10 | ⬜ |

---

## Security UAT (T-086-01 / FC#8)

| Row | Scenario | Pass Condition | Status |
|-----|----------|----------------|--------|
| UAT-S1 | Log in as User A (build cached todos/tasks), log out, log in as User B on the same browser | User B's panel never shows User A's cached todos/tasks; cache key is user-scoped and version-guarded (post 1→2 bump, all v1 keys dropped) | ⬜ |

---

## Wave 0 Requirements

- [ ] `frontend/src/providers/__tests__/panelHooks.test.tsx` — created by Plan 086-02 Task 3 (the integration backstop for FC#1/#3/#4/#5/#6/#9). All other tasks use the existing `npx tsc --noEmit` type gate.

*No new framework install — vitest + Chrome DevTools MCP already available.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single SSE connection with panel open (FC#2) | PANEL-05 | Requires live browser Network panel inspection | Open a thread, open the panel (Phase 087 stub or DevTools store inspection), confirm exactly one open `text/event-stream` in DevTools Network |
| Cross-provider dispatch (FC#9) | PANEL-05, PANEL-06 | Requires real provider API calls across 4 provider classes | Run UAT-X1..X4 with the multi-tool prompts; confirm each Map updates |
| Refresh-loses-ask (FC#7) | PANEL-05 | Requires page-refresh timing observation | UAT-G3 |
| Cross-worker ask_user (FC#10) | PANEL-05 | Requires WORKER_COUNT=2 + parallel threads | UAT-G2 / UAT-X2 with multi-worker uvicorn running |
| localStorage cross-user isolation (FC#8) | PANEL-06 | Requires two-account login flow on one browser | UAT-S1 |
| Long-message demux (axis 4) | PANEL-05, PANEL-06 | Requires ≥50-message / ≥5 KB thread setup | UAT-X3 / UAT-X4 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (every task has `npx tsc --noEmit`; Plan 02 Task 3 adds vitest)
- [ ] Wave 0 covers all MISSING references (panelHooks.test.tsx)
- [ ] No watch-mode flags (uses `vitest run`, not `vitest`)
- [ ] Feedback latency < 15 s
- [ ] All 10 failure criteria mapped to ≥ 1 row
- [ ] SC#10 4 axes all exercised
- [ ] 4 G-4 lived-experience scenarios authored
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
