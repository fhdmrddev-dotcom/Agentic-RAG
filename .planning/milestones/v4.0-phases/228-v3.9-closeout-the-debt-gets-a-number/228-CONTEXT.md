# Phase 228: v3.9 Closeout — The Debt Gets a Number - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 228 is the closeout and debt-reconciliation phase for Milestone v3.9, establishing a clean, verified foundation for Milestone v4.0 (Connected Knowledge). It delivers:
1. Complete verification verdicts for all owed v3.9 verification rows (Phase 210, 211, 214, 217) — either driven locally with concrete evidence or explicitly re-deferred with named triggers (DEBT-01).
2. Resolution of the resume-path bug cluster (`BUG-260818-01`, `BUG-260818-02`, `BUG-260818-03`, `BUG-260823-02`, `BUG-260823-04`), bringing chat run continuation and retry into strict alignment with the Claude.ai standard (DEBT-02).
3. OAuth state rework review disposition and callback Redis error hardening, with `/code-review ultra` prepared for the operator (DEBT-03).
4. Cloud deployment configuration and preview verification gating for serving the product at `app.<domain>` and the landing page at the root (`SEED-242` / DEBT-04).
5. Canonical mechanical gating for backend unit tests (`pytest tests/unit -q --continue-on-collection-errors`), locking the measured baseline of 71 failing / 3497 passing tests (DEBT-05).

No new database tables or architectural migrations are introduced. G-5 hot files `MessageItem.tsx`, `RunCard.tsx`, and `ToolCallPanel.tsx` were discharged at Phase 227; UI changes here are honoured by construction on the unified run frame.
</domain>

<decisions>
## Implementation Decisions

### Resume vs Continue UX & State Recovery (Claude.ai Parity)
- **D-01 (Claude AI Semantic Model):** Strict separation between "Continue" and "Retry turn":
  - **"Continue"** is reserved for runs interrupted mid-generation or capped by iterations/tool limits (`max_iterations = 15`, `cap_paused`). It seamlessly resumes remaining tools and generation in the same turn without replaying prompts.
  - **"Retry turn"** replaces the misleading "Resume" label on failed or timed-out runs. It honestly indicates a fresh execution of the turn from the user prompt with full conversation context.
- **D-02 (Model & Provider Persistence on Retry - BUG-260818-02):** The "Retry turn" handler in `StreamsProvider.tsx` / `MessageItem.tsx` extracts `model` and `provider` stamped on the failed message/run metadata and forwards them to `sendMessage`, ensuring the turn is re-executed with the exact model the user originally selected rather than falling back to system defaults.
- **D-03 (Durable Continue Affordance - BUG-260818-03):** Persist `cap_paused` status and continuation count (`continue_count < 3`) on the `runs` record in Postgres/Supabase and reconcile it during thread message loading. The Continue card renders reliably even after full page reload or navigation, overcoming ephemeral SSE state loss.
- **D-04 (Clean Transcript Presentation on Retry - BUG-260818-01):** When a user clicks "Retry turn", the failed attempt is collapsed/marked cleanly as a prior attempt in the UI, avoiding duplicate user prompt bubbles in the transcript while preserving attempt history.

### Production Subdomain Cutover (app.<domain> / SEED-242 / DEBT-04)
- **D-05 (Config Authoring & Operator Push Checklist):** Phase 228 authors host-scoped rewrites in `frontend/vercel.json`, backend CORS configuration in `config.py` / `main.py`, and documentation in `docs/OPERATOR.md` and `docs/DEPLOYMENT-WORKFLOW.md`. Live cloud dashboard operations (Vercel domain mapping, Coolify env vars, Supabase Auth redirect allowlist) are prepared as an operator-action checklist for the production promotion.
- **D-06 (Preview Deployment Gating):** Strict preview verification is enforced before promotion: root `/` serves landing (`index.html`), `/app` issues a 308 redirect to `app.<domain>`, `/app.html` mounts the application root, and OAuth callbacks target `app.<domain>/app?connections=1`.

### v3.9 Owed Verification Drive vs Deferral (DEBT-01)
- **D-07 (Reachable Rows Driven Locally):** All verification rows reachable locally (regenerating `supabase/full-schema.sql` via `scripts/regenerate-full-schema.sh`, verifying Phase 210, 211, and 217 UI flows in browser/test harness) are actively executed and recorded with concrete DOM/computed-style evidence.
- **D-08 (Operator Provider Roster & Drives Scheduled):** The Phase 214 eight-row native provider roster and eight G-4 operator drives are executed for locally provisioned credentials; rows requiring unprovisioned external credentials or human visual judgment are formally re-deferred with explicit triggers in `228-VERIFICATION.md`, never faked with synthetic mocks.

### Backend Test Baseline Gating Standard (DEBT-05) & OAuth Hardening (DEBT-03)
- **D-09 (Canonical pytest Baseline & Gate Script):** Lock `pytest tests/unit -q --continue-on-collection-errors` as the canonical backend gate. The measured baseline of 71 failures and 3497 passing tests is enforced via a dedicated gate script/check that alerts on any new failing test names or failure count > 71.
- **D-10 (OAuth Callback Hardening - DEBT-03):** Harden `connectors.py` OAuth callback error handling against Redis connection outages (gracefully redirecting to `/app?connections=1&oauth_error=redis_unavailable` rather than throwing an unhandled 500), document all Phase 225 review resolutions, and leave `/code-review ultra` ready for the operator.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoping & Architecture
- `.planning/ROADMAP.md` § Phase 228 — Success criteria and constraints.
- `.planning/REQUIREMENTS.md` § DEBT-01..05 — Debt requirements definitions.
- `.planning/seeds/SEED-242-product-at-app-subdomain-on-production.md` — 7-step subdomain cutover specification.
- `CLAUDE.md` — Hot-file ledger and gate invariants.
- `docs/HOT-FILE-LEDGER.md` — Ledger status for `MessageItem.tsx`, `RunCard.tsx`, and `ToolCallPanel.tsx`.

### Reported Bugs & Precedents
- `.planning/reported-bugs/BUG-260818-01-resume-replays-the-original-prompt-instead-of-continuing.md`
- `.planning/reported-bugs/BUG-260818-02-resume-drops-the-threads-selected-model.md`
- `.planning/reported-bugs/BUG-260818-03-iteration-cap-shows-stop-instead-of-continue.md`
- `.planning/reported-bugs/BUG-260823-02-tool-history-replays-staggered-entrance-as-a-blink-wave.md`
- `.planning/reported-bugs/BUG-260823-04-run-answer-rule-picks-llm-emit-status-line.md`
- `.planning/reported-bugs/BUG-260904-04-frontend-url-list-breaks-every-oauth-redirect.md`
- `.planning/milestones/v3.9-phases/227-the-run-frame-has-one-owner/227-CONTEXT.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets & Anchor Seams
- `frontend/src/providers/StreamsProvider.tsx:resumeFromFailed`: Current site walking back to user message; update to forward `opts.model`/`opts.provider` and invoke "Retry turn" semantics.
- `frontend/src/components/chat/MessageItem.tsx:539`: `continueRun(workflowLock.runId)` invocation on the Continue card; update gating to check persisted `run.status === 'cap_paused'` from thread data.
- `backend/app/api/runs.py:708`: `continue_run` endpoint (`POST /runs/{id}/continue`) with `load_cap_paused_tool_calls` — working continuation endpoint to wire durably.
- `backend/app/api/connectors.py:oauth_callback`: Redis lookup site; wrap Redis connection errors in graceful redirect.
- `frontend/vercel.json`: Host-scoped rewrite rules for `app.<domain>` and root domain redirects.
- `scripts/vitest-count-gate.cjs`: Reference implementation for test count gating.

</code_context>

<specifics>
## Specific Ideas

- **Claude.ai UX Parity:** The user explicitly affirmed: *"continue should be used also if model ran out of tool calls or ran out of iterations... What exactly we should just match the how claude ai do it"*. Ensure the copy, placement, and behavior faithfully reflect Claude.ai's distinction between continuing an interrupted generation/loop and retrying an error.
- **Clean Attempt Separation:** Avoid dirtying the chat thread with repeated user prompt bubbles on retry.

</specifics>

<deferred>
## Deferred Ideas

- **SEED-180 (Infinite Continuation):** Continuing runs across context window exhaustion / multi-turn compaction remains a future milestone capability.
- **SEED-178 (Thread Selection Surviving Full Reload):** Full URL-based thread routing (`/chat/:id`) is tracked under SEED-178 and deferred to future routing work.

</deferred>

---

*Phase: 228-v3.9-closeout-the-debt-gets-a-number*
*Context gathered: 2026-09-04*
