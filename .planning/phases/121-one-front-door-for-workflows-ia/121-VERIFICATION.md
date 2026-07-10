---
phase: 121-one-front-door-for-workflows-ia
verified: 2026-06-22T23:35:00Z
status: passed
score: 9/9 must-haves verified (the 2 manual SC#10 axes resolved via live UAT — 121-HUMAN-UAT.md 4/4 PASS, 0 Phase-121 defects)
overrides_applied: 0
human_verification_resolved: 2026-06-23 — all 4 axes driven live via Chrome DevTools MCP; see 121-HUMAN-UAT.md (status: passed, commit bc85809a)
human_verification:
  - test: "Cross-provider workflow launch + Harness lock: on OpenAI, Anthropic, Google, OpenRouter (one representative model each), launch a published workflow from the Workflows page, confirm the thread switches to Harness mode, the 2-pill composer shows the locked placeholder ('Workflow running — Cancel to switch back'), the Stop button is reachable, and Deep chat works normally after the run completes."
    expected: "Each provider: launch succeeds, thread goes Harness, composer shows running placeholder + Stop reachable, Deep unblocked post-run."
    why_human: "Requires real provider streaming + live Harness↔Deep lock state. Not automatable in Vitest."
  - test: "Parallel-thread isolation: Thread A runs a launched workflow (locked, streaming) while Thread B (Deep) accepts a new prompt in the 2-pill composer. Confirm Thread B is NOT locked (per-thread lock) and Thread A's Stop is reachable."
    expected: "Thread B composer is fully enabled (non-empty placeholder, non-disabled textarea). Thread A shows the locked placeholder + Stop button. No cross-thread lock bleed."
    why_human: "Two live concurrent threads required. Not automatable in Vitest."
  - test: "Multi-tool launched run: launch a workflow that exercises 2+ tools (e.g. search_documents + execute_code). Confirm the 2-pill composer + lock behave correctly throughout."
    expected: "Composer stays locked with running placeholder + Stop reachable during the multi-tool run. Unlocks cleanly on completion."
    why_human: "Requires real tool execution in the sandbox loop. Not automatable in Vitest."
  - test: "Long-message send regression guard: in a Deep thread with >= 50 prior messages OR a >= 5 KB user prompt, confirm the 2-pill composer sends normally. Guards against general-chat-intermittent-silent-send-drop regression."
    expected: "Send completes and a response streams back. No silent drop. The 2-pill composer layout is correct under load."
    why_human: "Real send path under message load + live SSE stream required. Not automatable in Vitest."
---

# Phase 121: One Front Door for Workflows (IA-01) Verification Report

**Phase Goal:** A user launches workflows from a single, obvious front door (the Workflows page); the chat composer is simplified to a 2-pill General/Explorer control with the Harness pill and in-chat workflow selector removed, while the existing Harness↔Deep lock / 409 / reconcile behavior is preserved exactly.
**Verified:** 2026-06-22T23:35:00Z
**Status:** passed (the 4 human-verification axes were driven live and passed 4/4 — 121-HUMAN-UAT.md, 2026-06-23)
**Re-verification:** No — initial verification; human_needed axes resolved by live SC#10 UAT

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Composer renders exactly 2 pills (General/Explorer + Model); `workflow-mode-selector` and `workflow-picker` are GONE | ✓ VERIFIED | `rg` exit 1 on MessageInput.tsx for all removed testids/symbols. `ChatAreaMode.test.tsx` test 1 asserts `queryByTestId("workflow-mode-selector")` is null + `queryByTestId("workflow-picker")` is null + `getByTestId("agent-mode-selector")` present + Model label `gpt-test` present. 11/11 tests GREEN. |
| 2 | `workflowLocked` gating preserved: textarea disabled + "Workflow running — Cancel to switch back" placeholder + Send gated | ✓ VERIFIED | MessageInput.tsx L174-176: `placeholder={workflowLocked ? "Workflow running — Cancel to switch back" : "Ask anything…"}`, `disabled={disabled \|\| workflowLocked}`. `ChatAreaMode.test.tsx` locked-preserve test asserts disabled textarea + exact placeholder + onSend not called after Enter. GREEN. |
| 3 | `composer-stop` Stop button still renders when streaming; click calls onStop (Cancel-reachability, D-01) | ✓ VERIFIED | MessageInput.tsx L347-357: `{disabled ? <Button data-testid="composer-stop" onClick={onStop}>`. `ChatAreaMode.test.tsx` Cancel-reachability test asserts stop renders and click calls onStop spy. GREEN. |
| 4 | Mount reconcile via `getThreadWorkflow` is preserved byte-identical | ✓ VERIFIED | ChatArea.tsx L157-183: full reconcile effect using `getThreadWorkflow(tid)` → `setWorkflowLockForThread` or `clearWorkflowLockForThread`. `ChatAreaBanner.test.tsx` reconcile-lock tests: `locked:true` → composer disabled; `locked:false` → enabled. GREEN. |
| 5 | 409 lock banner preserved: `workflow-lock-error-banner` testid + no Retry for 409 | ✓ VERIFIED | ChatArea.tsx L469-474: `data-testid={reconcileError instanceof ApiError && reconcileError.status === 409 ? "workflow-lock-error-banner" : "reconcile-error-banner"}`. `ChatAreaBanner.test.tsx` test b (byte-unchanged) asserts the 409 banner testid + no Retry. GREEN. |
| 6 | Workflows-page launch path (ChatLayout.doRun → createThread + postMessage({workflowDefinitionId}) + onNavigate("chat")) is untouched | ✓ VERIFIED | `ChatLayoutLaunch.test.tsx` drives the full WorkflowsPage Run → doRun flow and asserts `createThread("Vendor-risk review")` + `postMessage("thread-new", "review Acme Corp", { workflowDefinitionId: "pub-1" })` + `onNavigate("chat")`. GREEN. |
| 7 | No backend file and no migration touched — frontend-only change (D-06/G-5) | ✓ VERIFIED | `git diff --stat 131584b6^ HEAD -- 'backend/**' 'supabase/migrations/**'` returns empty. All 4 phase commits modify only `frontend/src/components/chat/` and `frontend/src/components/layout/__tests__/`. |
| 8 | Cross-provider launch → Harness lock + SC#10 4-axis coverage (SC#4 manual axes) | ✓ VERIFIED (live UAT) | Automated oracles cover SC#1/SC#2/SC#3. The SC#10 4-axis (cross-provider, multi-tool, parallel-thread, long-message) was driven LIVE via Chrome DevTools MCP — **4/4 PASS, 0 Phase-121 defects** (121-HUMAN-UAT.md, status: passed, commit bc85809a). Observed pre-existing render/reconcile artifacts (dup-bubble BUG-260610-01, pre-lock + lock-release reconcile lag) are disjoint from the Phase-121 changed files and routed to Phase 124 per D-07 — not regressions. |
| 9 | No chat-side workflow pointer or empty-state nudge added (D-04) | ✓ VERIFIED | ChatArea.tsx welcome-state renders the Sparkles icon + "How can I help you?" + folder scope selector. No workflow link or nudge added. MessageInput.tsx has no workflow-related render path. `Workflow`/`Sparkles` lucide icons removed from MessageInput imports (only remaining references are the `workflowLocked` placeholder strings, correct). |

**Score:** 9/9 truths verified (the 2 manual-only axes were driven live and passed 4/4 — see 121-HUMAN-UAT.md)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/chat/MessageInput.tsx` | 2-pill composer: workflow-mode-selector + workflow-picker + 6 props + WorkflowOption + labelMode removed; agent-mode-selector, Model pill, workflowLocked gating, composer-stop KEPT | ✓ VERIFIED | All removed symbols absent (rg exit 1). All KEEP symbols present: `data-testid="agent-mode-selector"` (L310), `data-testid="composer-stop"` (L353), `workflowLocked` in placeholder/disabled/handleSend (L125, L143, L174-176). `Workflow`/`Sparkles` lucide imports removed; `Layers`/`Compass`/`Cpu`/`Square`/`ChevronDown`/`ArrowUp` retained. |
| `frontend/src/components/chat/ChatArea.tsx` | 6 removed props no longer passed, picker/toggle useState + listPublishedWorkflows + kickoffWorkflowId branch removed; reconcile/lock/409 banner KEPT | ✓ VERIFIED | All removed symbols absent (rg exit 1). PRESERVE LIST present: `useWorkflowLockForThread` (2 matches: L85-86), `getThreadWorkflow` (3 matches: L17 import + L161 + reconcile logic), `workflow-lock-error-banner` testid (L471), `workflowLocked` (2 matches: derivation L86 + prop passthrough L368). `requestOpenPanel`/`listPublishedWorkflows`/`PublishedWorkflow` imports removed. `Sparkles` retained (welcome-state icon L390, correct). |
| `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx` | Rewritten 2-pill / Cancel-reachability / workflowLocked-preserve assertions; `queryByTestId("workflow-mode-selector")` present | ✓ VERIFIED | File rewritten. Contains `queryByTestId("workflow-mode-selector")` (null assertion) and `queryByTestId("workflow-picker")` (null assertion). 5 tests cover SC#1 + Cancel-reachability (D-01) + workflowLocked-preserve (SC#3). All GREEN. |
| `frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx` | 409 lock-banner test b byte-unchanged GREEN; extended with reconcile-lock cases | ✓ VERIFIED | Test b (L133-144) unchanged: asserts 409 → `workflow-lock-error-banner` + no Retry. New `describe("121 reconcile-lock")` block (L193-233) asserts `locked:true` → disabled + running placeholder; `locked:false` → enabled. `workflowLockByThread: new Map()` added to beforeEach reset (test-isolation fix). All GREEN. |
| `frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` | New SC#2 integration test; asserts doRun → createThread + postMessage({workflowDefinitionId}) + onNavigate("chat") | ✓ VERIFIED | File created. Renders real `ChatLayout activeView="workflows"`, mocks api seam, drives WorkflowsPage Run flow, asserts createThread + postMessage with `{ workflowDefinitionId: "pub-1" }` + onNavigate("chat"). GREEN. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ChatArea.tsx` | `MessageInput.tsx` | `workflowLocked={workflowLocked}` prop passthrough (KEEP) | ✓ WIRED | ChatArea.tsx L368: `workflowLocked={workflowLocked}` passed to `<MessageInput>`. The 6 removed props are absent. `rg 'workflowLocked' ChatArea.tsx` = 2 matches (derivation + passthrough). |
| `ChatArea.tsx` | `GET /threads/{id}/workflow` | `getThreadWorkflow` mount reconcile (preserved) | ✓ WIRED | ChatArea.tsx L161: `getThreadWorkflow(tid, controller.signal)` in useEffect with `thread?.id` dep. Lock set/cleared via `streamActions.setWorkflowLockForThread` / `clearWorkflowLockForThread`. |
| `ChatAreaMode.test.tsx` | `MessageInput.tsx` | `render(<MessageInput/>)` isolation, query composer testids | ✓ WIRED | Test imports `MessageInput` directly, renders it with live Props (no removed props passed), asserts testids. |
| `ChatLayoutLaunch.test.tsx` | `ChatLayout.tsx` | `render(<ChatLayout activeView='workflows'/>)` → WorkflowsPage Run → doRun | ✓ WIRED | Test drives real `ChatLayout` + real `WorkflowsPage`, stubs only NavPanel/WorkspacePanel (StreamsProvider seams irrelevant to doRun). `createThread` + `postMessage` asserted on real call path. |

---

### Data-Flow Trace (Level 4)

Not applicable: Phase 121 is a pure removal phase with no new dynamic data-rendering artifacts. The preserved data flows (`getThreadWorkflow` → `workflowLock` → `workflowLocked` → `MessageInput`) existed before this phase and remain structurally intact (verified in Key Links above).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SC#1: 2-pill composer oracle | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` | 5 tests PASS | ✓ PASS |
| SC#3: 409 banner + reconcile-lock oracle | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx` | 6 tests PASS | ✓ PASS |
| SC#2: launch path oracle | `npx vitest run src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` | 1 test PASS | ✓ PASS |
| No removed symbols in MessageInput.tsx | `rg -c '...' src/components/chat/MessageInput.tsx` | exit 1 (0 matches) | ✓ PASS |
| No removed symbols in ChatArea.tsx | `rg -c '...' src/components/chat/ChatArea.tsx` | exit 1 (0 matches) | ✓ PASS |
| No backend/migration files changed | `git diff --stat ... 'backend/**' 'supabase/migrations/**'` | empty (no output) | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IA-01 | 121-01-PLAN.md, 121-02-PLAN.md | A user launches workflows from one front door (Workflows page); chat composer is 2-pill General/Explorer; Harness pill + in-chat workflow selector removed; lock/409/reconcile preserved | ✓ SATISFIED | Removal verified clean (rg exit 1 on both source files). Automated oracles GREEN (11/11). REQUIREMENTS.md traceability table marks IA-01 Phase 121 as Complete. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/chat/MessageInput.tsx` | 64 | `react-refresh/only-export-components` on `_resetComposerDraftsForTest` | ℹ️ Info | Pre-existing (April/May 2026 per git blame); not introduced by Phase 121. Logged as IN-01 in REVIEW.md. No action required. |
| `frontend/src/components/chat/MessageInput.tsx` | 95 | `react-hooks/refs` — `valueRef.current = value` during render | ℹ️ Info | Pre-existing; not introduced by Phase 121. Logged as IN-01 in REVIEW.md. |
| `frontend/src/components/chat/ChatArea.tsx` | 559 | `react-hooks/purity` — `useRef(Date.now())` in `StickyTimerBar` render | ℹ️ Info | Pre-existing; not introduced by Phase 121. Logged as IN-01 in REVIEW.md. |

No TBD, FIXME, or XXX debt markers found in the modified files. No stubs. No placeholder implementations. This is a pure removal phase.

The 27 pre-existing unrelated Vitest failures (across `streamsProvider.test.tsx`, `IngestionPage.test.tsx`, `MessageItem.test.tsx`, `useMessages.test.ts`, `PhaseTimeline.test.tsx`, `PublishGauntlet.test.tsx`, `model-info.test.ts`, `Plan04.frontend.test.tsx`) are disjoint from the Phase 121 changed-component import graph, confirmed pre-existing in 121-02-SUMMARY.md and logged in `deferred-items.md`. They are NOT attributable to this phase.

---

### Human Verification Required

> **RESOLVED 2026-06-23 — all 4 axes driven live via Chrome DevTools MCP, 4/4 PASS, 0 Phase-121 defects.** Full evidence in `121-HUMAN-UAT.md` (status: passed, commit `bc85809a`). The four items below were the manual SC#10 gates; each is now confirmed passing on the running app. Retained here for the record.

#### 1. Cross-Provider Workflow Launch + Harness Lock

**Test:** Launch a published workflow from the Workflows page on each of OpenAI, Anthropic, Google, and OpenRouter (one representative model each). After launch, confirm the thread shows the 2-pill composer in locked state ("Workflow running — Cancel to switch back" placeholder + disabled textarea), the Stop button is reachable, and after the run completes the composer returns to normal Deep mode.
**Expected:** All 4 providers: launch succeeds, thread enters Harness mode, composer is locked during the run with reachable Stop, composer unlocks cleanly post-run.
**Why human:** Requires real provider streaming and live Harness↔Deep lock state machine. Not automatable in Vitest (declared manual-only in 121-VALIDATION.md).

#### 2. Parallel-Thread Lock Isolation

**Test:** With Thread A running a launched workflow (locked + streaming), open Thread B (a Deep chat thread) and type a new prompt. Confirm Thread B's composer is fully enabled (normal "Ask anything…" placeholder, non-disabled textarea, working Send) while Thread A shows the locked composer + reachable Stop.
**Expected:** Thread B compositor is NOT locked. Thread A compositor IS locked. No cross-thread lock bleed.
**Why human:** Requires two concurrent live threads. `ChatAreaBanner.test.tsx` reconcile-lock test covers the per-thread lock mechanism automatically, but the parallel-thread live interaction (SC#10 axis 3) requires manual UAT.

#### 3. Multi-Tool Launched Run

**Test:** Launch a workflow that exercises 2+ tools (e.g. `search_documents` + `execute_code`) in one prompt. Observe that the 2-pill composer stays locked with the running placeholder + reachable Stop throughout, and unlocks cleanly when the run completes.
**Expected:** 2-pill composer behaves correctly under multi-tool run. Lock → unlock lifecycle is clean.
**Why human:** Requires real tool execution in the sandbox loop. SC#10 axis 2.

#### 4. Long-Message Send Regression Guard

**Test:** In a Deep chat thread with >= 50 prior messages OR a >= 5 KB user prompt, send a new message using the 2-pill composer and confirm it streams back a response.
**Expected:** Message sends successfully and response streams back. No silent drop. The 2-pill composer layout is stable.
**Why human:** Real send path under message load + live SSE stream required. Guards against `general-chat-intermittent-silent-send-drop` regression (D-07 open bug). SC#10 axis 4.

---

### Gaps Summary

No gaps. The automated oracles are fully GREEN (11/11 tests across 3 files). All removal seams are clean. The PRESERVE LIST is intact. No backend or migration files touched. The 4 human verification items (SC#10 manual axes declared in 121-VALIDATION.md) were driven live via Chrome DevTools MCP on 2026-06-23 and passed **4/4 with 0 Phase-121 defects** (121-HUMAN-UAT.md). Phase 121 has **zero open functional gaps**.

---

_Verified: 2026-06-22T23:35:00Z_
_Verifier: Claude (gsd-verifier)_
_Human-verification resolved: 2026-06-23 (verify-work — live SC#10 UAT 4/4 PASS; status human_needed → passed)_
