---
phase: 121
slug: one-front-door-for-workflows-ia
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-22
validated: 2026-06-23
---

# Phase 121 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `121-RESEARCH.md` § Validation Architecture; **reconciled to executed reality by
> validate-phase on 2026-06-23** — the plan-time `_planner_/_TBD_` rows are now bound to the
> shipped test files and commits, and re-run live (50/50 GREEN).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 (unit/component + integration) + Playwright (E2E backstop, unused this phase) |
| **Config file** | `frontend/vitest.config.ts` (jsdom env, `setupFiles: ./src/setupTests.ts`, excludes `tests/e2e/**`) |
| **Quick run command** | `cd frontend && npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx src/components/chat/__tests__/ChatAreaBanner.test.tsx src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` |
| **No-regression command** | `cd frontend && npx vitest run src/components/chat/RunCard.timer.test.tsx src/components/chat/RunCard.test.tsx src/components/chat/__tests__/MessageInputDrafts.test.tsx` |
| **Full suite command** | `cd frontend && npm run test` (`vitest run`) |
| **Estimated runtime** | Quick ~8s · full suite ~2–3 min |

---

## Sampling Rate

- **After every task commit:** Run the **Quick run command** (the directly-impacted oracle files; < 10s).
- **After every plan wave:** Run the **No-regression command** (RunCard + MessageInputDrafts — the only other tests rendering the changed components).
- **Before `/gsd:verify-work`:** Phase-121 oracle files GREEN + SC#10 4-axis manual UAT complete.
- **Max feedback latency:** ~8 seconds (quick) / ~3 min (full).

---

## Per-Task Verification Map

> Reconciled to executed reality. Plan 01 (`131584b6`/`6f8276de`) shipped the 2-pill removal + preserve;
> Plan 02 (`652e0e22`/`8545a70d`) shipped the oracles that bind every SC to a machine-checkable assertion.

| Task | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Oracle: 2-pill | 02 (`652e0e22`) | 2 | IA-01 / SC#1 | T-121-03 (XSS eliminated) | removed pills gone; no new render path | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` | ✅ rewritten | ✅ green |
| Oracle: Cancel reachability | 02 (`652e0e22`) | 2 | IA-01 / Cancel (D-01) | — | reachable Stop survives pill removal | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` | ✅ | ✅ green |
| Oracle: lock-preserve | 02 (`652e0e22`) | 2 | IA-01 / SC#3 (lock) | T-121-01 (preserve) | textarea disabled + running placeholder + Send gated | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` | ✅ | ✅ green |
| Oracle: 409 banner | 02 (`652e0e22`) | 2 | IA-01 / SC#3 (409) | T-121-01 (preserve) | 409 server-enforced; client disable is courtesy only | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx` | ✅ test b byte-unchanged | ✅ green |
| Oracle: reconcile-lock | 02 (`652e0e22`) | 2 | IA-01 / SC#3 (reconcile) | T-121-02 (preserve) | per-thread lock keyed by owning thread id; never global | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx` | ✅ lock case added | ✅ green |
| Oracle: launch path | 02 (`8545a70d`) | 2 | IA-01 / SC#2 (launch) | — | Workflows-page Run → new thread → Harness | **integration** (component) | `npx vitest run src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` | ✅ new file | ✅ green |
| No-regression: RunCard | 01 (preserve boundary) | 1 | IA-01 / no-regression | — | RunCard timer/model untouched | unit (component) | `npx vitest run src/components/chat/RunCard.timer.test.tsx src/components/chat/RunCard.test.tsx` | ✅ untouched | ✅ green |
| No-regression: drafts | 01 (preserve boundary) | 1 | IA-01 / no-regression | — | per-thread draft persistence survives MessageInput narrowing | unit (component) | `npx vitest run src/components/chat/__tests__/MessageInputDrafts.test.tsx` | ✅ untouched | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Live re-run 2026-06-23:** all 6 files GREEN — **50/50 tests passed** (8s). No MISSING automated coverage.

**Oracles (observable signals):**
- **SC#1:** `queryByTestId("workflow-mode-selector")` null; `queryByTestId("workflow-picker")` null; `getByTestId("agent-mode-selector")` present; Model pill (`gpt-test` label) present.
- **SC#3 (409):** test (b) asserts 409 → `workflow-lock-error-banner` + no Retry — GREEN, byte-unchanged.
- **SC#3 (reconcile):** `getThreadWorkflow` mock `locked:true` → composer disabled + running placeholder; `locked:false` → enabled.
- **Cancel (D-01):** with `disabled`/streaming, `getByTestId("composer-stop")` present; click → `onStop` called.
- **SC#2:** `doRun` calls `createThread("Vendor-risk review")` + `postMessage(..., { workflowDefinitionId: "pub-1" })` + `onNavigate("chat")`.

---

## Wave 0 Requirements

- [x] `ChatAreaMode.test.tsx` — **rewritten** (`652e0e22`): asserts the toggle + picker are GONE, `agent-mode-selector` stays, Cancel-reachability (`composer-stop`), and `workflowLocked` preserve. Covers SC#1 + Cancel + SC#3-preserve. GREEN.
- [x] `ChatAreaBanner.test.tsx` — **extended** (`652e0e22`): test (b) 409 byte-unchanged GREEN; reconcile-lock case added (`getThreadWorkflow` `locked:true` → disabled). Covers SC#3 reconcile. GREEN.
- [x] SC#2 launch path — **added** as an automated integration test `ChatLayoutLaunch.test.tsx` (`8545a70d`), not deferred to manual/E2E. GREEN.
- [x] Framework install: **none** — vitest / RTL / playwright already present.

---

## Manual-Only Verifications

> SC#10 4-axis bandwidth is MANDATORY (this phase touches composer / mode / UI state). These axes require
> real provider streaming and are genuinely not automatable in Vitest. **They were driven LIVE via Chrome
> DevTools MCP on 2026-06-23 — 4/4 PASS, 0 Phase-121 defects (`121-HUMAN-UAT.md`, status: passed, `bc85809a`).**

| Behavior | Requirement | Why Manual | Status |
|----------|-------------|------------|--------|
| Cross-provider launch → Harness lock | IA-01 / SC#2,#4 | Real provider streaming | ✅ PASS live (OpenAI/Anthropic/Google/OpenRouter — Deep send+stream all 4; launch→lock→unlock on OpenAI; lock is provider-agnostic UI state) |
| Multi-tool launched run | IA-01 / SC#4 | Real tool execution | ✅ PASS live (search + execute_code run; composer locked throughout → ✓ Complete) |
| Parallel-thread isolation | IA-01 / SC#3,#4 | Two live threads | ✅ PASS live (Thread A locked + Thread B free simultaneously; no cross-thread lock bleed) |
| Long-message send (regression guard) | IA-01 / SC#4 + D-07 | Real send path under load | ✅ PASS live (9 KB prompt sent + streamed; no silent drop; layout correct) |
| OQ-1: Cancel for a locked workflow run | Cancel (D-01) | Reload/cap_paused idle state | ✅ RESOLVED live — a workflow-locked composer is fully disabled with NO `composer-stop`; the run-cancel lives on the run surface (matches the D-01-compliant expectation). `composer-stop` is the Deep-streaming Cancel, confirmed live during the cross-provider sends. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (ChatAreaMode rewrite, ChatAreaBanner extend, SC#2 launch test)
- [x] No watch-mode flags (`vitest run`, not `vitest`)
- [x] Feedback latency < 30s (quick) / < 3 min (full)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] RunCard timer/model tests confirmed UNTOUCHED and GREEN (no-regression evidence)

**Approval:** verified 2026-06-23

---

## Validation Audit 2026-06-23

| Metric | Count |
|--------|-------|
| Requirements (SC oracles) | 6 automatable + 4 SC#10 manual axes + OQ-1 |
| COVERED (automated, green live) | 6/6 |
| MISSING (automatable but untested) | 0 |
| Manual-only (not Vitest-automatable) | 5 — all PASS live (121-HUMAN-UAT.md 4/4 + OQ-1 resolved) |
| Gaps escalated | 0 |

**Method:** State A reconcile — the plan-time draft (`status: draft`, all `_planner_/_TBD_/⬜`) was bound to the shipped
oracle files + commits and **re-run live: 50/50 GREEN** across the 3 Phase-121 oracle files + the 3 no-regression files.
No MISSING automated gaps ⇒ no auditor spawn, no gap-fix wave. The SC#10 manual axes are genuinely unautomatable in
Vitest (live provider streaming) and were independently driven live 4/4 PASS. Phase 121 is **NYQUIST-COMPLIANT**.
