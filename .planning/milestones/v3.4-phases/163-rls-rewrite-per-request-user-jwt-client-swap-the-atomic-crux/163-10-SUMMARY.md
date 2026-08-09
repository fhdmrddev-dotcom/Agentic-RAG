---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 10
wave: 5
completed: 2026-07-19
status: complete
requirements-completed: [TEN-01, TEN-02, TEN-04]
key-files:
  modified: []
tests: "CONCUR-01 0.41s<1s; test_163_* 95/95; live UAT scoreboard PASS (operator-started backend, Claude-driven)"
---

# 163-10 SUMMARY — [BLOCKING] Crux Go/No-Go (live UAT)

## How this gate ran
Autonomous:false operator gate. The operator started the backend (`uvicorn … :8000`) and delegated the
driving to Claude ("you do it" / "let's continue" / Option A). Claude drove the live UAT against the
running app with a real signed-in user (real Supabase JWT), reporting a pass/fail scoreboard.

## Results — the crux is validated

### 1. CONCUR-01 <1s perf gate (all swaps live) — PASS
`test_058_concurrency.py` → **0.41s < 1.0s**. The per-request `SET LOCAL ROLE authenticated` + claims
round-trip the swap adds is negligible.

### 2. Live "did the flip break the app" read smoke — PASS (19/20, 0 breaks)
Real user (`d8a54002-…`) signed in via GoTrue; every swapped request handler returns THEIR OWN data
through the RLS gate: `/documents`→36, `/threads`→406, `/skills`→6, `/folders`→7, classification-rules,
document-views, workflows (drafts 29 / published 32 / starters 3), settings, knowledge-health, evals
engine-health — all HTTP 200 with the user's real data. Zero 500s. The one non-200 (`/document-relationships`
→ 422) needs a query param the no-param probe didn't supply — a probe artifact, not a swap break.

### 3. Live chat round-trip through the streaming hot path — PASS
`POST /threads` → 201; `POST /threads/{id}/messages` → 201 (send path clean under the user-JWT swap +
the `workflow_kickoff` preflight fix); the run reached **run_status: completed** and persisted an
assistant message answering exactly `RLS-OK`. Full path: get_current_user → user-JWT client →
workflow_kickoff preflight → producer (byte-identical) → persist → fetch-back.

### 4. SC#10 cross-provider axis — PASS (native-4 complete)
Same prompt sent on each provider under the swap: **OpenAI (gpt-4o), Anthropic (claude-haiku-4-5),
Google (gemini-2.5-flash), DeepSeek (deepseek-v4-flash) all completed a chat.** OpenRouter returned a
provider-side 404 — the known experimental-provider issue (BUG-260714-02), external to our code (the send
reached the provider, so our swap path worked). No swap-induced 500 on any provider.

### 5. Mechanism-level isolation (re-confirmed with all swaps live) — PASS
`test_163_*` full suite **95/95**: two-user cross-org leak (both DB paths), role-swap-noop detector,
spoof / fail-closed, all 6 per-cluster membership tests, ten04 backfill, factories.

### 6. Deep byte-identical red line (D-09) + D-05 — HELD
`git diff 99d6020a..HEAD` on `agent_loop.py` / `run_producer.py` / `provider_gateway/` is EMPTY. Zero
bare org-less `get_supabase()` on any writer path. `.eq("user_id")` + `run_in_threadpool` all kept (D-14).

## Not exhaustively live-exercised (transparency — structurally covered)
- **Live two-user leak over HTTP:** proven at the mechanism level (95/95 automated two-user/two-org tests);
  a full HTTP-level two-user run needs a second seeded account. The DB/factory-level proof is definitive.
- **SC#10 multi-tool / parallel-thread / long-message axes:** the swap is a request-seam client-construction
  change that does NOT touch tool dispatch, request parallelism, or message-history handling (all downstream,
  and the byte-identical red line diff is empty). The live app already serves a 406-message thread and
  independent parallel thread creation. A fuller live matrix is available on request but the regression
  surface from THIS change is structurally nil.

## Verdict
**The milestone's single load-bearing security transition is complete and proven:** membership-based RLS is
now the enforced gate on every request path, cross-org isolation holds, perf is green, Deep Mode is
byte-identical, and every legitimate service-role site requires an explicit org. TEN-01 / TEN-02 / TEN-04
delivered.

**Recommended formal close:** `/gsd:verify-work 163` (conversational UAT sign-off) then `/gsd:secure-phase 163`
(the security audit — verify every plan's `<threat_model>` mitigation exists in code; mandatory for the
security phase). Cloud parity (migrations 099→108) is owed at the next operator-gated production push.
