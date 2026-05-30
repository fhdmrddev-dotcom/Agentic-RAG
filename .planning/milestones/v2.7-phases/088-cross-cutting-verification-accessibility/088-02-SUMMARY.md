---
phase: 088-cross-cutting-verification-accessibility
plan: 02
subsystem: testing
tags: [cross-provider, eval-harness, tool-use, psycopg2, requests, supabase-auth, seed-034, fold-gate, observability]

# Dependency graph
requires:
  - phase: 075.5
    provides: scripts/observe-run.py — the proven env-load / psycopg2-RealDictCursor / Redis / LangSmith plumbing this script is modeled on (no hand-rolled plumbing)
  - phase: 075.4
    provides: frontend/tests/e2e/fixtures/db-teardown.fixture.ts:18-29 — the assertLocalhostOnly hard-gate pattern replicated in Python
  - phase: 084
    provides: workspace_files table (migration 054) — the workspace_write persistence assertion target
  - phase: 085
    provides: ask_user tool + tool_calls[].kind='ask_user_prompt' marker (panel.py:128 containment query); todos table (migration 055) — write_todos persistence target
provides:
  - scripts/eval_cross_provider.py — reusable cross-provider tool-use measurement engine (MVP seed of the v2.8 harness, D-02/D-08)
  - A localhost-gated, secret-safe script that drives the REAL POST /threads/{id}/messages route per (provider × canonical-prompt) and asserts tool-invocation + arg-shape + DB persistence
  - Greppable EVAL_ROW / EVAL_SUMMARY scoreboard output — the before/after evidence Plan 04's SEED-034 fold-gate (D-05) diffs
  - CLI single-cell re-run (--provider/--prompt/--model) for the fold-gate + new-model onboarding
affects: [088-04 SEED-034 conditional fold (consumes this script as fold-gate evidence), 088-05 verification capstone, v2.8 productized eval harness (D-08)]

# Tech tracking
tech-stack:
  added: []  # reuses backend venv's existing psycopg2 / requests / python-dotenv — no new deps
  patterns:
    - "Eval engine modeled verbatim on observe-run.py (env-load :36-48, psycopg2/RealDictCursor :151-194) — reuse, don't hand-roll"
    - "Localhost hard-gate (assert_localhost_only) replicated from db-teardown.fixture.ts:18-29 — fail-closed before any DB/agent-loop access"
    - "Provider switch via the per-request MessageCreate.provider/model override (threads.py:1285) — measures the REAL active_system_prompt without mutating global user_settings (no shared-state bleed)"
    - "DB persistence asserted via fixed per-table constant COUNT queries (no table-name interpolation) + parameterized %s thread_id — injection-safe by construction"
    - "Per-cell error isolation: one failing (provider×prompt) cell records a note, never aborts the matrix; BackendUnavailable routes to a clean no-traceback exit"
    - "Greppable EVAL_ROW / EVAL_SUMMARY scoreboard lines for machine before/after diffing"

key-files:
  created:
    - scripts/eval_cross_provider.py
  modified: []

key-decisions:
  - "Drove the provider switch via the per-request MessageCreate.provider/model override (threads.py:1285 override_provider) rather than a persistent user_settings UPDATE — same effective active_system_prompt (Pitfall 2 satisfied), but zero global-state mutation, RLS-safe, no cross-test bleed"
  - "Implemented count_rows as a fixed dict of FULL constant query strings (not f-string with an allowlist check) so the only dynamic value is the parameterized %s thread_id — injection-safe by construction AND satisfies the literal 'FROM todos'/'FROM workspace_files' key_links pattern"
  - "Authenticate the test user via the Supabase password-grant endpoint (apikey + email/password); the bearer token is verified server-side by get_current_user → supabase.auth.get_user — the same auth the app uses"
  - "Poll public.runs.status (psycopg2) for run completion rather than consuming the SSE stream — durable, simpler, and the script already holds a DB connection for assertions"
  - "Exit code is gated: 0 = all cells pass, 2 = at least one gated cell failed, 1 = backend/Supabase unreachable — so Plan 04 / an operator can branch on it"

patterns-established:
  - "Cross-provider eval engine: env-load → localhost gate → mint token → for (provider×prompt): create thread, POST real route w/ provider override, poll runs.status, assert tool_calls JSONB + DB rows → greppable scoreboard"
  - "Secret-safe script discipline: presence/absence only for every env var; never echo token/password/anon-key/response-body; fabricated values only in error strings"

requirements-completed: [A11Y-01]

# Metrics
duration: 6min
completed: 2026-05-29
---

# Phase 088 Plan 02: Cross-Provider Eval Script Summary

**A reusable, localhost-gated `scripts/eval_cross_provider.py` that drives the REAL `POST /threads/{id}/messages` route per (provider × canonical-prompt) across OpenAI/Anthropic/Google-3.x/OpenRouter and asserts tool-invocation + arg-shape + DB persistence, emitting a greppable PASS/FAIL scoreboard as the SEED-034 fold-gate evidence source.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-29T17:40:45Z
- **Completed:** 2026-05-29T17:46:52Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- Built the MVP-seed cross-provider tool-use measurement engine (D-02) — 687 lines, modeled verbatim on `observe-run.py`'s env-load / psycopg2 / RealDictCursor plumbing (no hand-rolled plumbing).
- Drives the REAL HTTP route `POST /threads/{id}/messages` (Pitfall 2) so it measures the actual `active_system_prompt` — the precondition for the SEED-034 fold-gate (D-05). Provider is switched per-request via the `MessageCreate.provider/model` override, with no global `user_settings` mutation.
- Three durable-truth assertion families: (a) invocation via `messages.tool_calls` JSONB (column, not a table — Pitfall 3); (b) arg-shape (`write_todos args["todos"]` is a `list`, the BUG-260529-01 case); (c) persistence via `todos` / `workspace_files` row counts + the `ask_user_prompt` JSONB containment query.
- Localhost hard-gate (`assert_localhost_only`) replicated from `db-teardown.fixture.ts:18-29`, called before any DB/agent-loop access; verified fail-closed against a cloud URL.
- 4 canonical prompts × 4 providers (OpenAI `gpt-5.4-mini`, Anthropic `claude-haiku-4-5`, Google `gemini-3.5-flash` [3.x+ per D-03], OpenRouter `z-ai/glm-5.1`) + a greppable `EVAL_ROW` / `EVAL_SUMMARY` scoreboard for Plan 04 before/after diffing, plus `--provider/--prompt/--model` single-cell re-run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold — env load, localhost hard-gate, DB assertion helpers** - `ae70312b` (feat)
2. **Task 2: Live agent-loop driver + 4×4 matrix + PASS/FAIL scoreboard** - `f517771c` (feat)

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP)_ committed separately.

## Files Created/Modified
- `scripts/eval_cross_provider.py` - Reusable cross-provider tool-use eval engine. Reads `backend/.env` (presence-only), hard-gates to localhost, mints a test-user bearer token via the Supabase password grant, then per (provider × canonical-prompt): creates a thread, POSTs the prompt to the real `/threads/{id}/messages` route with a per-request provider override, polls `public.runs.status` to terminal, and asserts invocation (`messages.tool_calls` JSONB) + arg-shape + DB persistence (`todos`/`workspace_files`/`ask_user_prompt` containment). Emits a greppable scoreboard.

## Decisions Made
- **Per-request provider override over persistent `user_settings` UPDATE:** `MessageCreate` already accepts `provider`/`model`, which `threads.py:1285` applies via `override_provider` before assembling the identical `active_system_prompt`. This satisfies Pitfall 2 (real shared path measured) with zero global-state mutation — cleaner, RLS-safe, and no cross-cell bleed than mutating the shared test-user settings row.
- **`count_rows` as fixed full-query dict:** Mapping `{"todos": "...FROM todos...", "workspace_files": "...FROM workspace_files..."}` (no name interpolation) is injection-safe by construction and also satisfies the plan's literal `FROM (todos|workspace_files)` `key_links` pattern (an f-string `FROM {table}` would not).
- **Poll `runs.status` not SSE:** the script already holds a psycopg2 connection for assertions; polling the durable `runs` row to a terminal state is simpler and avoids a second streaming consumer.
- **Gated exit code (0/2/1):** all-pass / some-gated-fail / backend-unreachable, so Plan 04 and operators can branch programmatically.

## Deviations from Plan

None — plan executed exactly as written. Both tasks delivered the specified scaffold (Task 1) and live driver + matrix + scoreboard (Task 2), against the verified interfaces in the plan's `<interfaces>` block.

_Implementation note (not a deviation):_ the plan offered two provider-switch mechanisms — "the same effective-settings the app resolves in `get_llm_client:785`" via either "the app's settings-update path **or** a direct UPDATE on user_settings." The discretion was exercised toward the per-request `MessageCreate.provider/model` override (the same `get_llm_client` effective resolution path, the same route the app + `scenario-02` use), which the plan's `<interfaces>` explicitly documents as resolving the effective provider. This is the cleaner of the in-scope options, not a new mechanism.

## Issues Encountered
- The acceptance criteria / `key_links` require the literal substrings `FROM todos` and `FROM workspace_files`. An initial `FROM {table}` f-string (allowlist-validated) was injection-safe but did not contain those literals. Resolved by switching to a fixed dict of full constant query strings — strictly safer AND literally greppable. Verified parse-clean and pattern-present.

## User Setup Required
**The eval script is authored here but RUN LIVE in Plans 04/05** (this plan does not execute it against live providers — D-02 says "build the engine," Plans 04/05 run it with the operator's backend). To run it, the operator must:
- Start the backend uvicorn in a visible terminal (`feedback_user_starts_backend`) — never `run_in_background`.
- Ensure `backend/.env` has a LOCALHOST `SUPABASE_URL` (the script hard-gates against cloud), `SUPABASE_ANON_KEY`, `DATABASE_URL` (or it falls back to the local default), and provider API keys (OpenAI/Anthropic/Google-3.x/OpenRouter) configured.
- Then: `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py` (full 4×4) or `--provider/--prompt` for a single cell.

See the plan's `user_setup` block for the canonical service/env-var list.

## Next Phase Readiness
- **Plan 04 (SEED-034 conditional fold)** can now run this script to capture the before/after `EVAL_ROW` evidence the fold-gate (D-05) needs: re-run after any prompt/tool-description text change and diff the greppable rows (≥1 previously-failing model now passes, zero strong-model regressions).
- **Plan 05 (verification capstone)** can use it as the automated cross-provider tool-use backstop alongside the manual UAT scoreboard.
- **No live execution performed here** (by design): the script is parse-clean (`ast.parse` + `py_compile` OK), 687 lines, drives `/threads/`, is localhost-gated, never prints secret values, and a no-backend invocation exits cleanly with a connection message (no traceback).

## Self-Check: PASSED

- FOUND: `scripts/eval_cross_provider.py`
- FOUND: `.planning/phases/088-cross-cutting-verification-accessibility/088-02-SUMMARY.md`
- FOUND commit: `ae70312b` (Task 1)
- FOUND commit: `f517771c` (Task 2)

---
*Phase: 088-cross-cutting-verification-accessibility*
*Completed: 2026-05-29*
