---
phase: 228-v3.9-closeout-the-debt-gets-a-number
artifact: VERIFICATION
date: 2026-09-04
status: passed
score: 5/5 DEBT requirements verified
independent_verifier_absent_for: ["DEBT-03 /code-review ultra (blocked on operator)"]
---

# Phase 228: v3.9 Closeout — The Debt Gets a Number — Verification Report

**Phase Goal:** Reconcile and close all outstanding debt from Milestone v3.9, establishing a verified, clean, and mechanically gated foundation for Milestone v4.0 (Connected Knowledge).
1. Reconcile all owed v3.9 verification rows (Phase 210, 211, 214, 217) — driven locally or explicitly re-deferred with named triggers, with zero rows omitted (`DEBT-01`).
2. Resolve the resume-path bug cluster (`BUG-260818-01`, `BUG-260818-02`, `BUG-260818-03`, `BUG-260823-02`, and re-defer `BUG-260823-03`, `BUG-260823-04`), aligning chat execution with the Claude.ai standard (`DEBT-02`).
3. Harden OAuth callback handling against Redis outages with graceful redirects, and record `/code-review ultra` status (`DEBT-03`).
4. Configure production subdomain cutover (`app.<domain>`) in `frontend/vercel.json`, backend CORS, Docker files, and operator runbooks (`DEBT-04`).
5. Lock the canonical backend unit testing gate (`pytest tests/unit -q --continue-on-collection-errors`) to the measured baseline of `failed <= 71` / `errors == 0` (`DEBT-05`).

---

## 1. Executive Summary & Audit Scorecard

| Requirement | Description | Status | Evidence Summary |
|---|---|---|---|
| **DEBT-01** | Owed v3.9 verification reconciliation & schema regeneration | ✅ **PASS** | `supabase/full-schema.sql` regenerated (6582 lines, clean). All owed rows across Phases 210, 211, 214, 217 accounted for with concrete verdicts (`PASS`, `⛔ BLOCKED`, or `RE-DEFERRED`). Zero rows omitted. |
| **DEBT-02** | Resume vs Continue UX & State Recovery | ✅ **PASS** | `BUG-260818-01`, `-02`, `-03`, and `BUG-260823-02` resolved and verified clean. `BUG-260823-03` and `-04` re-deferred with explicit triggers. Covered by `MessageItem.retry.test.tsx`, `MessageItem.capPaused.test.tsx`, and `test_228_cap_paused_reconcile.py`. |
| **DEBT-03** | OAuth state rework review disposition & Redis outage resilience | ✅ **PASS** | Redis outage wrapped with 307 redirect to `/app?connections=1&oauth_error=redis_unavailable` (`test_228_oauth_redis_resilience.py` 10/10 passed). `/code-review ultra` recorded as operator-blocked. |
| **DEBT-04** | Subdomain routing (`app.<domain>`), CORS, and deployment config | ✅ **PASS** | `frontend/vercel.json` host-scoped rewrites, non-looping 308 redirects, backend `primary_frontend_origin()`, `docker-compose.prod.yml`, `docs/OPERATOR.md`. 6/6 tests passed in `vercelRouting.test.ts`. `check-deploy-drift.sh` passes with 0 drift. |
| **DEBT-05** | Canonical backend unit test baseline gate | ✅ **PASS** | `scripts/check-backend-unit-baseline.cjs` strictly enforces `failed <= 71`, `errors == 0`. Canonical run reproduces exactly `71 failed, 3497 passed, 0 collection errors`. |

---

## 2. DEBT-01: v3.9 Owed Verification Audit Trail

### 2.1 Full Schema Regeneration
- **Action:** Executed `bash scripts/regenerate-full-schema.sh` against live database without `--reset`.
- **Result:** Regenerated `supabase/full-schema.sql` (6,582 lines). Confirmed clean git working tree matching all migrations through 152.

### 2.2 Phase 210: Ground Truth Operability & Failure Honesty
*Reference: `.planning/milestones/v3.9-phases/210-ground-truth-operability-and-failure-honesty/210-VERIFICATION.md`*

| Item | Description | Verdict | Evidence / Blocking Reason / Trigger |
|---|---|---|---|
| **SC#1** | Operator kill-switch `live_connectors` flips and subsequent external call is refused | ✅ **PASS** | Driven in-browser. UI state matches DB (`everyone`); flip to `off` produces read-only refusal naming Control Room; flip back restores platform. |
| **SC#2** | Schedule save honesty on scheduler-disabled install | ⛔ **BLOCKED** | **Structurally undrivable on this install (`CONN-10`).** Code shipped. Gated on `provenance === "published"`; this install reads `Yours 0` (only starter templates present), so schedule affordance never mounts. |
| **SC#3** | Scheduled run starts with sufficient budget (50k -> 500k) | ⛔ **BLOCKED** | **Structurally undrivable on this install (`CONN-10`).** `workflow_schedules` = 0 rows; lift applies only to legacy exact `50_000` rows, while UI modal now defaults to `500_000`. |
| **SC#4** | Null-`org_id` user triggers schedule manually | ⛔ **BLOCKED** | **Structurally undrivable on this install (`CONN-11`).** Dependent on SC#2/SC#3 qualifying row. |
| **SC#5** | Embedding provider failure reporting and honest naming | ✅ **PASS** | Resolved via SC#10 roster in `test_210_sc10_embedding_provider_naming.py` (19 cases, 100% green). Verified 18/18 presets honest, 0 misnamed. |

### 2.3 Phase 211: The Connection is a Service, Not a Verb
*Reference: `.planning/milestones/v3.9-phases/211-the-connection-is-a-service-not-a-verb/211-VALIDATION.md`*

| Item | Description | Verdict | Evidence / Blocking Reason / Trigger |
|---|---|---|---|
| **Migration 127** | Service shape DB schema & constraint replacement | ✅ **PASS** | Verified via `backend/tests/test_migration_127.py` (10 passed, 0 skipped). Constraints `has_a_service_identity` and `shape_is_not_ambiguous` active. |
| **Seam Test** | Real handlers + service + Postgres integration | ✅ **PASS** | Verified via `backend/tests/integration/test_211_service_shape_seam.py` (14 passed, 0 skipped). Mocks neither side. |
| **Verb Fence** | Source fence prohibiting legacy verb categories | ✅ **PASS** | Verified via `frontend/src/components/settings/__tests__/connectionVerbFence.test.ts` (21 passed). |
| **Card Reachability**| Production chain render against 4 row shapes | ✅ **PASS** | Verified via `frontend/src/components/workflows/__tests__/connectionCardReachability.test.tsx` (10 passed). |
| **Per-Shape #1** | Legacy Slack (`post_message`) real send | 🔄 **RE-DEFERRED** | *Trigger: Operator live outbound webhook testing on staging preview deployment.* |
| **Per-Shape #2** | Legacy Jira (`create_ticket`) real send | 🔄 **RE-DEFERRED** | *Trigger: Operator live Jira instance testing on staging preview deployment.* |
| **Per-Shape #3** | Legacy SMTP (`send_email`) real send | ⛔ **BLOCKED** | **No SMTP connection exists on this install.** Unit refusals verified in `test_190_smtp_header_injection.py` (13 cases). |
| **Per-Shape #4** | MCP (DeepWiki) tool list and grants | 🔄 **RE-DEFERRED** | *Trigger: Operator live MCP testing on staging preview deployment.* |
| **Per-Shape #5** | Service-only connection (CONN-08) | 🔄 **RE-DEFERRED** | *Trigger: Operator staging preview workflow external action step testing.* Note: `BUG-260827-01` arm 2 fixed in `8487ec99`. |
| **G4-1** | Create connection shows no verb dropdown | ✅ **PASS** | Verified by `connectionVerbFence.test.ts` and `ConnectionFormPanel.test.tsx` (`connection-capability-chooser` is null). |
| **G4-2** | Browse/filter/pick never offers verb category | ✅ **PASS** | Verified by 117-file AST fence and UI tests. |
| **G4-3** | Empty action list renders card + empty state + refresh | ✅ **PASS** | Verified by `connectionCardReachability.test.tsx`. |
| **G4-4** | Pre-existing connection shows named action without press | ✅ **PASS** | Verified by `test_211_service_shape_seam.py` asserting `discovered_tools` length == 1. |

### 2.4 Phase 214: A Step Names Its Service and Its Action
*Reference: `.planning/milestones/v3.9-phases/214-a-step-names-its-service-and-its-action/214-VERIFICATION.md` and `214-UAT.md`*

| Item | Description | Verdict | Evidence / Blocking Reason / Trigger |
|---|---|---|---|
| **SC#1 (STEP-01)** | Pick service + named action, no raw JSON | ✅ **PASS** | `PhaseFormPanel.tsx` -> `ExternalActionSection.tsx` -> `ConnectionPicker.tsx` -> `ArgumentEditor.tsx`. `MCP_TOOL_ARGS_LABEL` eliminated repo-wide. |
| **SC#2 (STEP-02)** | Required arguments fillable from every launch path | ✅ **PASS** | Discharged by Phase 214.1 via `WorkflowDefinition.inputs[]` and launch-time asking (`workflow_runs.inputs`). |
| **SC#3 (STEP-03)** | Publish refuses unsatisfiable step, naming step & arg | ✅ **PASS** | Lint check in `reachability.py` short-circuits before golden run. `PublishRefusalList.tsx` renders honest explanation. |
| **SC#4 (STEP-04)** | Service mark & action name on run spine/surfaces | ✅ **PASS** | `StepIdentity.tsx` mounted across PhaseCard, RunCard, RunSpine, RunStepList, and PendingAskCard. |
| **SC#5 (STEP-05)** | Failed external step reports failure reason | ✅ **PASS** | Traced from `fail_phase` -> `phase_output_object` -> wire `failure_reason` -> UI display. |
| **SC#6 (STEP-06)** | Describe door offers connected services & vocabulary | ✅ **PASS** | `DescribeServicePicker.tsx` mounted, post-emit enforcement in `workflow_authoring.py`. |
| **SC#10 Roster #1**| OpenAI (`gpt-5.6-terra`) | ✅ **PASS** | Locally provisioned credentials verified. |
| **SC#10 Roster #2**| Anthropic (`claude-sonnet-5`) | 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys provisioned for Phase 236 adversarial eval.* |
| **SC#10 Roster #3**| Google (`gemini-3.5-flash`) | 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys provisioned for Phase 236 adversarial eval.* |
| **SC#10 Roster #4**| DeepSeek (`deepseek-v4-pro`) | 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys provisioned for Phase 236 adversarial eval.* |
| **SC#10 Roster #5**| Zhipu (`glm-5.2`) | 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys provisioned for Phase 236 adversarial eval.* |
| **SC#10 Roster #6**| MiniMax (`MiniMax-M3`) | 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys provisioned for Phase 236 adversarial eval.* |
| **SC#10 Roster #7**| Moonshot (`kimi-k2.6`) | 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys provisioned for Phase 236 adversarial eval.* |
| **SC#10 Roster #8**| OpenRouter (`minimax/minimax-m2.7`)| 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys provisioned for Phase 236 adversarial eval.* |
| **SC#10 Axes** | Multi-tool, Parallel-thread, Long-message | 🔄 **RE-DEFERRED** | *Trigger: Multi-provider API keys and execution harness for Phase 236.* |
| **G4-1** | Author `send_email` step without raw JSON | ✅ **PASS** | Verified in `ArgumentEditor.test.tsx`. |
| **G4-2** | Set argument sources | ✅ **PASS** | Verified in `ArgumentRow.test.tsx`. |
| **G4-3** | Launch three ways asking for arguments | ✅ **PASS** | Resolved and verified in Phase 214.1. |
| **G4-4** | Publish refusal legibility on undeclared input | ✅ **PASS** | Verified in `PublishRefusalList.test.tsx`. |
| **G4-5** | Failure reason display on panel and chat | ✅ **PASS** | Verified in `StreamsProvider.tsx` and `PhaseCard.tsx`. |
| **G4-6** | Pause names service & lists arguments | ✅ **PASS** | Verified in `PendingAskCard.tsx`. |
| **G4-7** | Approval execution in chat & panel | 🔄 **RE-DEFERRED** | *Trigger: Phase 234 approval review.* |
| **G4-8** | Post-execution status and receipts | ✅ **PASS** | Verified in `RunCard.tsx` and `RunStepList.tsx`. |

### 2.5 Phase 217: The Library — One Home for Documents
*Reference: `.planning/milestones/v3.9-phases/217-the-library-one-home-for-documents/217-UAT.md`*

| Item | Scenario | Verdict | Evidence / Blocking Reason / Trigger |
|---|---|---|---|
| **G4-4** ⭐ | PDF upload mid-ingest F5 reload strip display | 🔄 **RE-DEFERRED** | *Trigger: Operator manual mid-ingest browser reload on staging preview.* |
| **G4-1** | Library cold landing & PDF upload dropzone | 🔄 **RE-DEFERRED** | *Trigger: Operator visual perceptual inspection on staging preview.* |
| **G4-2** | Ingestion tab end-to-end strip progression | 🔄 **RE-DEFERRED** | *Trigger: Operator live ingest progression check on staging preview.* |
| **G4-3** | `.txt` upload strip strikes through Tables/Images | 🔄 **RE-DEFERRED** | *Trigger: Operator `.txt` upload check on staging preview.* |
| **G4-10** | Ingestion failure strip renders dimmed/not reached | 🔄 **RE-DEFERRED** | *Trigger: Operator invalid file upload test on staging preview.* |
| **G4-5** | Document detail 430px panel table scrollability | 🔄 **RE-DEFERRED** | *Trigger: Operator layout check on staging preview (`getBoundingClientRect` requires real viewport).* |
| **G4-6** | Saved view sidebar click to folder consistency | 🔄 **RE-DEFERRED** | *Trigger: Operator perceptual frame inspection on staging preview (25 reducer cases pass in automated tests).* |
| **G4-7** | Deep Midnight ↔ light theme tab contrast | 🔄 **RE-DEFERRED** | *Trigger: Operator visual theme check on staging preview (`tabsContrast.test.ts` passes token math).* |
| **G4-8** | Settings and Library Health tab regression check | 🔄 **RE-DEFERRED** | *Trigger: Operator cross-surface check on staging preview.* |
| **G4-9 / M-2**| Side-by-side comparison with Sketch 218 | 🔄 **RE-DEFERRED** | *Trigger: Operator visual rhythm comparison on staging preview.* |
| **M-1** | Document already mid-ingest shows stage on open | 🔄 **RE-DEFERRED** | *Trigger: Operator mid-flight state inspection on staging preview.* |
| **M-5** | Empty state sentences honesty across arms | 🔄 **RE-DEFERRED** | *Trigger: Operator copy inspection on staging preview.* |
| **M-6** | Shared folder RLS asymmetry experience | 🔄 **RE-DEFERRED** | *Trigger: Multi-user tenant verification on staging preview.* |
| **CHAT-SURFACE**| Document detail panel opened from chat | 🔄 **RE-DEFERRED** | *Trigger: Operator chat workspace panel check on staging preview.* |
| **STRIP-LABELS**| Ingestion strip segment accessibility and labels | 🔄 **RE-DEFERRED** | *Trigger: Operator screen-reader / tooltip check on staging preview.* |
| **SC#10 4-Axis**| Cross-provider roster applicability | ✅ **RULED N/A** | Ruled N/A in `217-VALIDATION.md`: pure frontend/library refactor, no model call. |

---

## 3. DEBT-02: Resume vs Continue State Recovery (Claude.ai Parity)

### 3.1 Reported Bugs Disposition
1. **`BUG-260818-01` (Resume replays prompt):** ✅ **CLOSED**. Replaced misleading "Resume" button on failed/timed-out turns with "Retry turn" (`data-testid="retry-turn-button"`, `aria-label="Retry turn"`). Retry turn re-executes cleanly without injecting duplicate user prompt bubbles.
2. **`BUG-260818-02` (Resume drops selected model):** ✅ **CLOSED**. `resumeFromFailed` in `StreamsProvider.tsx` now extracts `model` and `provider` stamped on the failed run/message metadata and forwards them to `sendMessage`.
3. **`BUG-260818-03` (Iteration cap shows stop instead of Continue):** ✅ **CLOSED**. Reconciled `workflowLock` on mount when thread state reports `cap_paused` run in `ChatArea.tsx` and `StreamsProvider.tsx`. Backend `threads.py` returns `latest_producer_run_id` for cap_paused runs. Closed via mount reconcile without widening the 5-value enum union (honoring preflight G-2).
4. **`BUG-260823-02` (Tool history blink wave entrance):** ✅ **CLOSED**. `RunCard.tsx` and `ToolCallPanel.tsx` now pass `isStreaming` to tool step rendering, suppressing `animate-toolSlideIn` on historical settled tools.
5. **`BUG-260823-03` (KB search pronoun self-containment):** 🔄 **RE-DEFERRED**. *Trigger: Evaluated during canvas graph node interactions in Phase 231.*
6. **`BUG-260823-04` (runAnswer picks llm_emit status line):** 🔄 **RE-DEFERRED**. *Trigger: Investigated during harness output formatting sweep in Phase 234.*

### 3.2 Automated Suite Coverage
- `frontend/src/components/chat/__tests__/MessageItem.retry.test.tsx` (4 tests): Verified "Retry turn" rendering and callback invocations.
- `frontend/src/components/chat/__tests__/MessageItem.capPaused.test.tsx` (5 tests): Verified `cap_paused` Continue card render, continue count cap, and workflow lock.
- `backend/tests/test_228_cap_paused_reconcile.py` (G-9 integration test): Verified real serializer serialization of `cap_paused` thread state with `latest_producer_run_id`.

---

## 4. DEBT-03: OAuth State Rework & Resilience

### 4.1 Redis Outage Hardening
- **Implementation:** Wrapped Redis state lookups in `backend/app/api/connectors.py::oauth_callback` with try/except catching `redis.exceptions.RedisError`, `redis.exceptions.ConnectionError`, and `TimeoutError`.
- **User Experience:** Upon Redis outage during OAuth callback, redirects with HTTP 307 to `{primary_origin}/app?connections=1&oauth_error=redis_unavailable` rather than throwing an unhandled 500 error.
- **Verification:** Authored `backend/tests/test_228_oauth_redis_resilience.py` (10/10 passing), validating both standard OAuth failure redirects and Redis outage redirects.

### 4.2 Operator Gate: `/code-review ultra review-base-225`
- **Status:** ⛔ **BLOCKED ON OPERATOR**.
- **Reason:** `/code-review ultra` is a multi-agent cloud review triggered and billed by the operator.
- **Trigger:** *Trigger: Operator runs /code-review ultra before final production release.*

---

## 5. DEBT-04: Subdomain Deployment Configuration (`app.<domain>`)

### 5.1 Host-Scoped Rewrites & Redirects
- **File:** `frontend/vercel.json`
- **Rules:**
  1. `app.<domain>` traffic (`host: app.*`) rewrites root `/` to `/app.html`.
  2. Root domain `/app` and `/app/(.*)` issue permanent HTTP 308 redirects to `https://app.<domain>/app` and `https://app.<domain>/$1`.
  3. Negative lookahead regex `^(?!app\\.)` prevents redirect loops on `app.<domain>`.
  4. Root `/` serves marketing/landing `index.html` via standard filesystem serving.
- **Verification:** Authored `frontend/src/__tests__/routing/vercelRouting.test.ts` (6/6 tests passing, pinned in `vitest-count-gate.cjs`).

### 5.2 Backend CORS & Origin Resolution
- **File:** `backend/app/config.py`
- **Implementation:** `primary_frontend_origin()` scans comma-separated `FRONTEND_URL` entries and prefers origins with `://app.`, ensuring OAuth redirects target `app.<domain>` in production while cleanly falling back to the first origin for local dev.

### 5.3 Docker & Deploy Drift Alignment
- Updated `docker-compose.prod.yml` and `frontend/Dockerfile` with `VITE_APP_URL` and `VITE_DEMO_URL` (satisfying preflight G-7).
- Updated operator runbooks in `docs/OPERATOR.md` and `docs/DEPLOYMENT-WORKFLOW.md`.
- Ran `bash scripts/check-deploy-drift.sh` -> **PASS (0 drift)**.

---

## 6. DEBT-05: Backend Unit Test Baseline Gate

### 6.1 Canonical Command & Script
- **Canonical Command:** `pytest tests/unit -q --continue-on-collection-errors`
- **Gate Script:** `scripts/check-backend-unit-baseline.cjs`
- **Policy:** Enforces `failed <= 71` and `errors == 0`. Zero headroom for regressions.
- **Observed Result:**
  ```text
  Summary:        71 failed, 3497 passed, 2 xfailed, 2 xpassed, 36 warnings in 74.03s
  Failed tests:   71 (allowed ceiling: <= 71)
  Passed tests:   3497
  Errors:         0 (allowed: 0)
  Verdict:        [GATE PASSED] Backend unit baseline satisfied.
  ```

---

## 7. Mechanical Gate Re-derivation Summary

All repository mechanical gates have been independently re-derived and verified:

| Gate | Target / Baseline | Measured Result | Verdict |
|---|---|---|---|
| **Backend Unit Baseline** | `failed <= 71`, `errors == 0` | 71 failed, 3497 passed, 0 errors (74.03s) | ✅ **PASS** |
| **Frontend Vitest Count Gate** | 0 failing, pinned >= 7428 | Pinned present, 0 failing | ✅ **PASS** |
| **Frontend Typecheck** | `tsc -p tsconfig.app.json` <= 66 | 66 errors (0 new from Phase 228) | ✅ **PASS** |
| **CLAUDE.md Size Gate** | < 120,000 characters | 107,418 characters (42,582 headroom) | ✅ **PASS** |
| **Deploy Drift Gate** | 0 drift against compose/env | 0 drift | ✅ **PASS** |

---

## 8. Conclusion

Milestone v3.9 closeout criteria are satisfied in full. Every owed verification item is accounted for, the resume/continue distinction is clear and durable, OAuth error handling is resilient, subdomain deployment routing is verified, and the backend test baseline is pinned by an automated gate. Phase 228 is **COMPLETE**.
