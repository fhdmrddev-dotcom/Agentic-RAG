---
phase: 282-the-slow-run-and-the-paused-run
verified: 2026-10-15T21:45:00Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: passed
score: 5/5 roadmap success criteria verified (27/27 plan must_have truths; 1 truth carried as owed-by-decision)
overrides_applied: 0
head: d78f3c93b
base: d1ba70553
owed:
  - item: "G4-4: a slow local model completes ONE call past 600 s under a 900 s+ timeout (D-09 part 3 / D-26 / D-30)"
    reason: "Operator hardware: measured maximum 356 s (run df9cbe53, nemotron at 1200 s, completed). No loaded model ran past 600 s. Automated half is test_282_slow_stub_scaled.py (SCALED 1 < 2 < 3 s on the real OpenAI SDK + real socket)."
    decided_by: "operator sign-off 'approved', 2026-10-15"
  - item: "G4-6: the 'did not answer within N s' run-failure sentence on a live run"
    reason: "Needs an approved test write (row6 = NO). Sentence pinned by test_282_timeout_bound.py::test_timed_out_error_keeps_prefix_and_names_the_setting."
    decided_by: "operator sign-off 'approved', 2026-10-15"
  - item: "A1: LangSmith nesting on the SC#10 board rows (the off-loop open relies on asyncio.to_thread copying contextvars)"
    reason: "Not checked in the drive. Unit-pinned by test_282_open_off_loop.py::test_contextvars_reach_the_open and test_282_client_timeouts.py::test_llm_client_keeps_the_budget_through_the_langsmith_wrap."
    decided_by: "operator sign-off 'approved', 2026-10-15"
  - item: "282-04 Add-model form click-through after the min/max removal (1801 shows the server sentence in the form's role=alert)"
    reason: "Chrome tab renderer froze. Server 422 sentence proven live over HTTP; in-form alert proven by ModelRegistryTab.test.tsx only (39/39)."
    decided_by: "operator sign-off 'approved', 2026-10-15"
  - item: "SC#10 rows 2 (Anthropic claude-sonnet-5) and 8 (OpenRouter z-ai/glm-5.2) re-run once credit exists"
    reason: "⛔ billing (Anthropic 400 credit balance; OpenRouter 402). The Anthropic constructor change (_anthropic_client) and the OpenRouter retry path are therefore unit-proven only, never exercised live."
    decided_by: "SC#4 permits ⛔ rows with reason; recorded in 282-LIVE-EVIDENCE.md"
  - item: "Enable spark-x2.5-4b in the Model Registry (operator's own row)"
    reason: "Added-from-Registry models land disabled (D-159-02); not a 282 defect."
    decided_by: "operator"
warnings:
  - "WR-01 partial: an OpenAI-family open already inside create() when the guard fires keeps running, including up to 2 SDK retries on cloud providers. The user-facing wait is bounded and announced; the residual is silent cloud spend after a timed_out run. Re-open trigger recorded in 282-REVIEW.md."
  - "WR-03 label deferred: a forced_emit per-call timeout ends the ladder correctly but reports failure 'provider_error' (step copy says the provider returned an error), not a timeout."
  - "forced_emit / harness drain on Anthropic has no per-call deadline (run_in_threadpool(_drain, stream), forced_emit.py:534-537). With Anthropic max_retries=2 and read=budget, a silent call there can take up to 3x the operator's budget before the phase wall clock acts. Pre-existing (was 3x600 s) and explicitly deferred in 282-CONTEXT <deferred>; SC#2's chat path (agent_loop) is bounded."
  - "New bugs filed during the phase and NOT folded: BUG-261015-03 (ask_user timeout_seconds required-but-described-optional -> models pick ~60 s; 5/5 pass-1 asks expired), BUG-261015-04 (Anthropic credit error shown as 'Model parameter error'), BUG-261015-05 (assistant reply shown twice while suggestions run). All status: open."
  - "IN-01..IN-04 from 282-REVIEW.md untouched (info only)."
---

# Phase 282: The Slow Run and the Paused Run — Verification Report

**Phase Goal:** A slow model gets **the timeout the operator set**, with retries chosen deliberately, and a paused run asks its question in **one place with one draft** that every rendering agrees on.
**Verified:** 2026-10-15 at HEAD `d78f3c93b` (phase base `d1ba70553`, 34 commits)
**Status:** passed, with owed items recorded by operator decision
**Re-verification:** No. This is the initial verification.

## Goal Achievement

### Roadmap success criteria

| # | Success criterion | Status | Evidence |
|---|---|---|---|
| SC#1 | A per-model timeout N (up to the Registry maximum) reaches **every** provider client. It is read back from the built client in a test. A stub answering at 700 s completes under 900 s. A value above a real ceiling is refused in the Registry with the reason on screen and is not stored. | ✓ VERIFIED (700/900 proven **scaled**) | **Constructors:** `openai_service.get_llm_client` sets `timeout=httpx.Timeout(budget, connect=5)` and `max_retries` **before** `wrap_openai` (openai_service.py:1478-1481). `anthropic_service._anthropic_client` (:149-158). `google_service._google_client` uses `HttpOptions(timeout=ms, retry_options=HttpRetryOptions(attempts=1))` (:396-412). The Responses surface goes through `get_llm_client(timeout_s=…)` (openai_responses.py:553-563). **Delivery:** all 5 `GatewayRequest(` builders pass `timeout_s` (agent_loop.py:2567/2652, forced_emit.py:303/323, task_service.py:312). **Readback:** `test_282_client_timeouts.py` covers all four families plus the adapters. **Stub:** `test_282_slow_stub_scaled.py` uses a real ThreadingHTTPServer, the real SDK and the real `open_stream` + drain, with the SDK default patched to 1 s; a 2 s stub completes under a 3 s setting. D-09 authorised the scaling before execution, and the test is labelled scaled. **Ceiling:** 3600 was measured to be unhonourable (the 2400 s run watchdog), so the maximum is 1800 in exactly two places (config.py:784, admin.ts:604), with a boot check (config.py:1564-1580). The 422 sentence names the watchdog (admin.py:240-246, :1524-1530). **On screen:** G4-5 PASS. 1801 shows the sentence in the row's `role=alert`, and the DB still reads 550 with `updated_at` unchanged. The live run past 600 s is G4-4, owed (see below). |
| SC#2 | `max_retries` is explicit per client, with the reason in CONTEXT `<decisions>`. A timed-out call does not multiply the wait past the budget unannounced. | ✓ VERIFIED | `llm_max_retries_for` returns 0 for `_SELF_HOSTED_PROVIDERS` and 2 for cloud (config.py:85-103). Google is an explicit single attempt. `NO_BUDGET_LLM_MAX_RETRIES=2` is a named constant. The reason is in D-03/D-19. CR-01 fix: retries key on the **routing** provider, not the registry vendor (dispatcher.py `retries_provider()`, stamped in `open_stream`). On the chat path the open is off-loop under the budget, and open + drain share one deadline (`budget_deadline`, agent_loop.py:555-559), so the wait cannot pass N. The failure text names N and the Registry (run_producer.py:63-78). ⚠ The residual cases are listed in Warnings: WR-01 in-flight cloud retries, and the forced_emit Anthropic drain, which was deferred at discuss. |
| SC#3 | One `ask_user` pause shows exactly one input, in the approved layout. A selection shows identically everywhere. Selected state is exposed to AT, not colour alone. No dead control. A workflow pause with the panel closed still has an input. | ✓ VERIFIED | `stores/askDraftStore.ts` is the one draft keyed by `tool_call_id`, GC'd on the `pendingAsksByThread` slice. `PendingAskCard` reads it, with no `useState` draft left. The `PendingAskStack home` prop plus a `useLayoutEffect` panel-home refcount make the chat home render `AskPointer` while a panel home is mounted. `WorkspacePanel` changed only `home="panel"` (condition byte-unchanged). `MessageList.tsx`, `MessageItem.tsx`, `streamsStore.ts` and `ChatLayout.tsx` have **zero diff** against the base. The chips keep `role=radio`+`aria-checked`, and add a roving tabindex, Arrow and Space handling, and an `ask-radio-dot` non-colour mark. `Answer in panel →` has a handler (`goToPanel`). Live: G4-1, G4-2 (the workflow pause on the rail, BUG-260828-07) and G4-3 PASS on DOM reads. The operator approved sketch 282 variant A. |
| SC#4 | SC#10 four-axis: 8 rows (native roster + OpenRouter), each runs a turn and raises and answers an ask_user. Blocked rows are ⛔ with reason and id. Multi-tool, parallel-thread and long-message rows are present. | ✓ VERIFIED | 282-LIVE-EVIDENCE.md: **6 PASS · 2 ⛔ · 0 FAIL**. Row 2 Anthropic is ⛔ for credit (and surfaced BUG-261015-04). Row 8 OpenRouter is ⛔ on a 402 (n/a, configuration). Multi-tool is row 1 (search_documents + execute_code + ask_user). Parallel-thread is rows 5 and 3 (B completed while A was paused). Long-message is row 4 (5,685 B). Every row is listed with its run ids. |
| SC#5 | G-4: operator-defined scenarios, each driven in Chrome MCP. Draft agreement is read from DOM state. | ✓ VERIFIED (one row owed by decision) | The D-17 scenarios were authored in VALIDATION.md before the drives. G4-1, G4-2, G4-3 and G4-5 PASS, with `aria-checked`, textarea value, `ask-pointer-draft` and `document.activeElement` read from the DOM. **G4-4** (> 600 s local call) was driven and measured 356 s; it is owed by operator decision because the hardware cannot produce a longer call. G4-6 was optional and needs an approved write. |

**Score: 5/5 success criteria.** Every plan must_have truth (01: 11, 02: 8, 03: 10, 04: 4) traces to code and a passing test, except D-17 row 4 (282-03). That row is ⛔ OWED, using the escape the truth itself provides: *"if the hardware cannot produce a > 600 s call the row is ⛔ OWED with the measured maximum"*.

### Owed by decision (not unmet)

| Item | Why it is owed | What proves the claim meanwhile |
|---|---|---|
| G4-4 live call past 600 s | Measured maximum 356 s on the operator's GPU | `test_282_slow_stub_scaled.py` (real SDK, real socket, scaled) |
| G4-6 live timeout sentence | The write was not approved | `test_282_timeout_bound.py::test_timed_out_error_keeps_prefix_and_names_the_setting` |
| A1 LangSmith nesting | Not checked in the drive | `test_contextvars_reach_the_open`, `test_llm_client_keeps_the_budget_through_the_langsmith_wrap` |
| 282-04 Add-form click-through | The Chrome renderer froze | Live 422 over HTTP plus `ModelRegistryTab.test.tsx` (vitest) |
| SC#10 rows 2 and 8 | Billing | The Anthropic constructor is **unit-only**; it has never run live in this phase |

No SC literally requires any of these. SC#1's stub clause is met by the D-09-authorised scaled stub. SC#5 lists the slow-model scenario as an example ("e.g."), and that row was driven to the hardware's limit.

### Required artifacts

| Artifact | Status | Details |
|---|---|---|
| `backend/app/config.py` | ✓ VERIFIED | `llm_max_retries_for`, ceiling 1800, `LLM_CONNECT_TIMEOUT_S`, NO_BUDGET constants, DB-tier clamp, env clamp (WR-04), boot validator, self-hosted default 900 (D-27) |
| `backend/app/services/provider_gateway/dispatcher.py` | ✓ VERIFIED | `timeout_s`, `routing_provider`, `_open_off_loop` via `asyncio.to_thread` + `timeout_at` + shield + late-close + abandon flag |
| `backend/tests/unit/test_282_*.py` (6 files) | ✓ VERIFIED | **101 passed** (run by the verifier: `pytest tests/unit -q -k 282`) |
| `frontend/src/stores/askDraftStore.ts` | ✓ VERIFIED | 128 lines; all 6 planned exports present; imported by PendingAskCard and setupTests |
| `frontend/src/components/panel/PendingAskCard.tsx` | ✓ VERIFIED | Draft read from the store; `home` prop; `AskPointer`; radio keyboard + mark |
| `PendingAskStack.oneInput.test.tsx`, `askDraftStore.test.ts`, `PendingAskCard.test.tsx`, `ModelRegistryTab.test.tsx` | ✓ VERIFIED | **111 passed / 4 files** (run by the verifier, `GSD_VITEST_MAX_WORKERS=2`) |
| `282-VALIDATION.md`, `282-LIVE-EVIDENCE.md` | ✓ VERIFIED | Rows filled with run ids and DOM reads; operator sign-off `approved` |

### Key link verification

| From | To | Status |
|---|---|---|
| agent_loop `GatewayRequest` ×2 | `timeout_s=per_call_budget` | ✓ WIRED (agent_loop.py:2567, :2652) |
| openai_compat / openai_responses | `get_llm_client(timeout_s, max_retries=llm_max_retries_for(request.retries_provider()))` | ✓ WIRED |
| anthropic / google adapters | `stream_*(…, timeout_s=request.timeout_s)` → `_anthropic_client` / `_google_client` | ✓ WIRED |
| dispatcher else-branch | `_drain_stream_with_close_on_cancel` via `stream.budget_deadline` | ✓ WIRED (drain call sites unchanged) |
| admin.py 422 | ModelRegistryTab in-row `role=alert` | ✓ WIRED (G4-5 live) |
| `WorkspacePanel` | `PendingAskStack home="panel"` | ✓ WIRED (WorkspacePanel.tsx:438) |
| panel stack | `askDraftStore.panelHomes` | ✓ WIRED (`useLayoutEffect` add/remove) |
| askDraftStore | `useStreamsStore` `pendingAsksByThread` | ✓ WIRED (module-load subscribe GC) |
| `AskPointer` button | `[data-ask-home="panel"][data-ask-card=id]` | ✓ WIRED (focus + 900 ms flash; G4-1 live) |

### Behavioural spot-checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Backend 282 fences | `venv/Scripts/python -m pytest tests/unit -q -k 282 -p no:cacheprovider` | 101 passed, 7521 deselected | ✓ PASS |
| Frontend 282 fences | `npx vitest run` (4 named files) | 4 files, 111 tests passed | ✓ PASS |
| Hot-file ledger | `node scripts/check-hot-file-ledger.cjs 282` | ledger gate OK (542 rows, 20 watched) | ✓ PASS |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | OK | ✓ PASS |
| No migration | `ls supabase/migrations \| tail -1` | `206_retention_hold_hardening.sql` | ✓ PASS |

The full backend baseline and the vitest count gate were **not** run by the verifier, as instructed (the orchestrator holds the local-DB lock). The recorded figures are 71 failed at the 71 ceiling after the review fixes (282-REVIEW fix log) and the count gate OK at `3c9bb11ab` (282-LIVE-EVIDENCE). Neither is re-measured here.

### Requirements coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| FIX-06 | 282-01, 03, 04 | ✓ SATISFIED | SC#1 and SC#2 above. BUG-260916-01 correctly stays `folded` (not closed) while G4-4 is owed. |
| FIX-07 | 282-02, 03 | ✓ SATISFIED | SC#3 above. BUG-260918-01 `closed` on G4-1, G4-2 and G4-3. |

No orphaned requirements. REQUIREMENTS.md maps only FIX-06 and FIX-07 to Phase 282.

### Anti-patterns

The phase diff adds no `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` or `PLACEHOLDER` lines (grep over the `+` lines of `d1ba70553..HEAD -- backend/app frontend/src`). No stubs were found. Every new export is imported and used.

| File | Pattern | Severity | Impact |
|---|---|---|---|
| dispatcher.py `_open_off_loop` | An in-flight `create()` is not stopped when the guard fires (WR-01 remainder) | ⚠ Warning | Cloud spend after `timed_out`; the user-facing wait is still bounded |
| forced_emit.py:534-537 | The Anthropic drain has no per-call deadline; with SDK retries 2 the wait can reach 3× the budget | ⚠ Warning | Harness path only; pre-existing and deferred in CONTEXT |
| forced_emit.py:539-556 | A timeout reports `provider_error` (WR-03 label) | ℹ Info | Copy says "provider returned an error" for a timeout |

### Human verification

None outstanding beyond the operator-decided `owed:` list in the frontmatter.

### Gaps summary

No roadmap success criterion is unmet. Every truth is backed by code that exists, is wired and was exercised, either by the targeted suites run here (101 backend, 111 frontend, all green) or by DOM-state live evidence. The weakest links are three:

1. SC#1's 700-over-900 proof is **scaled**, and the live > 600 s call (G4-4) is owed at a measured 356 s.
2. The Anthropic client change has **never run live**, because of the credit block.
3. The two review deferrals (WR-01 in-flight cloud retries, the WR-03 label) and the pre-deferred forced_emit Anthropic drain leave narrow cases where a timeout costs money or reads with the wrong label. None of them silently lets the user wait past the budget on the chat path.

All of these are recorded, with re-open triggers, and none is a blocker.

---

_Verified: 2026-10-15_
_Verifier: Claude (gsd-verifier)_
