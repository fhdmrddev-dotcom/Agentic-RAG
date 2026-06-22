---
phase: 121
slug: one-front-door-for-workflows-ia
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 121 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `121-RESEARCH.md` § Validation Architecture (HIGH confidence; live code read 2026-06-22).
> Task IDs in the Per-Task map are **planner-assigned** — validate-phase reconciles this draft to executed reality.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 (unit/component) + Playwright (E2E backstop) |
| **Config file** | `frontend/vitest.config.ts` (jsdom env, `setupFiles: ./src/setupTests.ts`, excludes `tests/e2e/**`) |
| **Quick run command** | `cd frontend && npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx src/components/chat/__tests__/ChatAreaBanner.test.tsx` |
| **Full suite command** | `cd frontend && npm run test` (`vitest run`) |
| **E2E command** | `cd frontend && npm run e2e` (`playwright test`) |
| **Estimated runtime** | Quick ~30s · full suite ~2–3 min |

---

## Sampling Rate

- **After every task commit:** Run the **Quick run command** (the directly-impacted component tests; < 30s).
- **After every plan wave:** Run the **Full suite command** (`npm run test`) — catches cross-component fallout (grep proved only 3 files reference the removed symbols, so fallout risk is near-zero, but the full run is the floor).
- **Before `/gsd:verify-work`:** Full vitest suite GREEN + the rewritten `ChatAreaMode` tests GREEN + SC#10 4-axis manual UAT complete.
- **Max feedback latency:** ~30 seconds (quick) / ~3 min (full).

---

## Per-Task Verification Map

> Task IDs are planner-assigned (this phase is small — likely 1–2 plans). Rows below bind each Success Criterion to its observable oracle; the planner wires each to a concrete task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner_ | _TBD_ | _TBD_ | IA-01 / SC#1 | — | N/A (UI removal) | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` | ⚠️ W0 (rewrite) | ⬜ pending |
| _planner_ | _TBD_ | _TBD_ | IA-01 / SC#3 (409) | T-121-EoP (preserve) | 409 server-enforced; client disable is courtesy only | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx` | ✅ (test b) | ⬜ pending |
| _planner_ | _TBD_ | _TBD_ | IA-01 / SC#3 (reconcile) | T-121-Tamper (preserve) | per-thread lock keyed by owning thread id; never global | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx` | ✅ infra (add lock case) | ⬜ pending |
| _planner_ | _TBD_ | _TBD_ | IA-01 / Cancel (D-01) | — | reachable Stop survives pill removal | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` | ⚠️ W0 (add assertion) | ⬜ pending |
| _planner_ | _TBD_ | _TBD_ | IA-01 / SC#2 (launch) | — | launch→new thread→Harness lock | integration / E2E | ChatLayout `doRun` test OR `npm run e2e` scenario | ⚠️ W0 (add) | ⬜ pending |
| _planner_ | _TBD_ | _TBD_ | IA-01 / no-regression | — | RunCard timer/model tests unchanged | unit (component) | `npx vitest run src/components/chat/RunCard.timer.test.tsx src/components/chat/RunCard.test.tsx` | ✅ (must NOT edit — stay GREEN) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Oracles (observable signals):**
- **SC#1:** `screen.queryByTestId("workflow-mode-selector")` is null; `queryByTestId("workflow-picker")` is null; `getByTestId("agent-mode-selector")` present; Model pill present.
- **SC#3 (409):** existing test (b) asserts 409 → `workflow-lock-error-banner` + no Retry — stays GREEN unchanged.
- **SC#3 (reconcile):** `getThreadWorkflow` mock `locked:true` → composer disabled + running placeholder; `locked:false` → enabled.
- **Cancel (D-01):** with `disabled`/streaming, `getByTestId("composer-stop")` present; click → `onStop` called.
- **SC#2:** `doRun` calls `createThread` + `postMessage({workflowDefinitionId})` + `onNavigate("chat")`; then `getThreadWorkflow` → `mode:"harness"`, `active_workflow_run_id` set.

---

## Wave 0 Requirements

- [ ] `ChatAreaMode.test.tsx` — **rewrite** all 3 tests: they currently assert `workflow-mode-selector` renders the right label. Post-removal they must assert the toggle is GONE, the picker is GONE, `agent-mode-selector` stays, **plus** a Cancel-reachability assertion (`composer-stop`) and a `workflowLocked` preserve assertion (disabled textarea + running placeholder). Covers SC#1 + Cancel + SC#3-preserve.
- [ ] `ChatAreaBanner.test.tsx` — **extend** (do not rewrite): test (b) 409 stays green unchanged; ADD a reconcile-lock case (`getThreadWorkflow` mock `locked:true` → composer disabled). Covers SC#3 reconcile.
- [ ] SC#2 launch path — **add** either a `ChatLayout`/`WorkflowsPage` integration test asserting the `doRun` path, OR a Playwright scenario (`doRun` is currently only exercised via live UAT).
- [ ] Framework install: **none** — vitest / RTL / playwright already present.

---

## Manual-Only Verifications

> SC#10 4-axis bandwidth is MANDATORY (this phase touches composer / mode / UI state). Automated E2E covers axes 1–3 partially; long-message stays manual per provider.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider launch → Harness | IA-01 / SC#2,#4 | Needs real provider streaming | Launch a workflow into Harness on **OpenAI, Anthropic, Google, OpenRouter** (one representative model each); confirm Harness lock + a reachable Stop + Deep no-regression after the run completes |
| Multi-tool launched run | IA-01 / SC#4 | Real tool execution | One launched run exercising 2+ tools (e.g. `search_documents` + `execute_code`); confirm the 2-pill composer + lock behave through it |
| Parallel-thread isolation | IA-01 / SC#3,#4 | Two live threads | Thread A runs a launched workflow (locked, streaming) while Thread B (Deep) accepts a new prompt in the 2-pill composer; confirm Thread B is NOT locked (per-thread lock) and Thread A's Stop is reachable |
| Long-message send (regression guard) | IA-01 / SC#4 + D-07 | Real send path under load | A Deep thread with ≥ 50 prior messages OR a ≥ 5 KB prompt; confirm the 2-pill composer sends normally — must NOT regress `general-chat-intermittent-silent-send-drop` |
| OQ-1: Cancel for a locked-but-NOT-streaming thread | Cancel (D-01) | Reload/cap_paused idle state | Observe a workflow-locked thread that is not actively streaming (reload-idle / cap_paused); if no reachable Stop, the D-01-compliant fix is to the run receipt, NOT a new composer chip |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (ChatAreaMode rewrite, ChatAreaBanner extend, SC#2 launch test)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 30s (quick) / < 3 min (full)
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] RunCard timer/model tests confirmed UNTOUCHED and GREEN (no-regression evidence)

**Approval:** pending
