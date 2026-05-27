# Phase 079: D-v2.5-02 Supersession + Multi-Worker Enable - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Formally lift the single-worker constraint by authoring the D-PRD-12 ADR, updating CLAUDE.md, enabling `--workers 2` via `WORKER_COUNT` env var in the dev entrypoint, and shipping migration 052 (`runs.spawned_by_worker`). Phase 077's validation harness already proved multi-worker works (4/4 truths, 50-run synthetic load); this phase is the formal supersession + config flip + documentation update.

**Not in scope:** Production deployment docs (Phase 080), OpenRouter UAT (Phase 081), cross-cutting verification (Phase 082). Prod systemd/Docker configs are Phase 080's responsibility.

</domain>

<decisions>
## Implementation Decisions

### D-PRD-12 ADR Wording + Scope (Q-v2.6-05)
- **D-01:** D-PRD-12 includes a **singleton audit table** listing each module-level singleton, whether it's per-worker safe or Redis-backed, and the Phase 077 test that proves it. Plus a re-trigger clause for regression revert.
- **D-02:** D-PRD-12 includes a **scaling triggers section** — guidance on when to scale beyond 2 workers, using the Phase 078 `GET /admin/backpressure` endpoint (sustained >70% threadpool saturation across 2 workers) as the signal source.
- **D-03:** ADR reference style for Phase 077 evidence → **Claude's discretion** — follow existing DECISIONS.md conventions (test file paths vs verification report link).
- **D-04:** Re-trigger clause severity → **Claude's discretion** — pick appropriate revert threshold (immediate env var flip to `WORKER_COUNT=1` for data-corrupting regressions; diagnostic-first for non-user-visible issues).

### Worker Count + Config
- **D-05:** Default worker count is **2 workers fixed** (`WORKER_COUNT=2` in `.env`). Matches Phase 077 harness validation. Scale guidance in D-PRD-12.
- **D-06:** Uvicorn config lives in **`.env` + backend entrypoint**. `WORKER_COUNT=2` in `backend/.env.example`, backend entrypoint reads it. Consistent with existing `SANDBOX_ENABLED`, `REDIS_URL` pattern.
- **D-07:** Env var name is **`WORKER_COUNT`** — matches ROADMAP.md SC#3 wording, short, clear, project-specific.
- **D-08:** `WORKER_COUNT` placed **near the top of `.env.example` with infra vars** (alongside `SUPABASE_URL`, `REDIS_URL`, `SANDBOX_ENABLED`). Comment: `# Number of uvicorn workers. 2 is validated; see D-PRD-12 for scaling guidance.`
- **D-09:** Phase 079 updates **dev config only**. Prod deployment docs (systemd unit, Docker CMD) are Phase 080's responsibility.
- **D-10:** `restart-backend.ps1` update → **Claude's discretion** — decide based on whether the script is actively used in the workflow.

### Migration 052 (runs.spawned_by_worker)
- **D-11:** Migration **ships** — cheap debug utility. One nullable TEXT column on `runs`. Zero performance cost (NULL by default). Invaluable for post-mortem when diagnosing cross-worker edge cases.
- **D-12:** Column populated **at run INSERT time** — write `str(os.getpid())` when the run row is first INSERTed in threads.py. Always populated for new runs, NULL for historical.
- **D-13:** Worker identifier format is **PID string** — e.g., `'12345'`. Simple, unique per worker, matches uvicorn log output. Easy to correlate with process monitoring.
- **D-14:** Migration number is **052** — 045-051 are already used by prior phases.

### Live Verification Scope
- **D-15:** Two-tab live test (SC#3) is a **quick smoke test** (~5 min). Two browser tabs, same user. Tab A starts a chat. Tab B starts a different chat while Tab A streams. Verify both complete. Then cancel cross-tab. Phase 077 already did the heavy lifting.
- **D-16:** Phase 077 test suite **re-run** after enabling `WORKER_COUNT=2` to confirm config change didn't break anything.
- **D-17:** **Backpressure endpoint spot-check** included — hit `GET /admin/backpressure` while two runs are active (one per worker), verify `per_worker_run_count` reports correctly for both worker PIDs.

### CLAUDE.md Rule Update
- **D-18:** Replace the single-worker rule with a **short reference**: "Multi-worker uvicorn is the default (WORKER_COUNT=2); see D-PRD-12 in DECISIONS.md for the singleton audit checklist and scaling guidance." One line, points at the ADR for details.
- **D-19:** **Skip creating backend/CLAUDE.md** — repo-root CLAUDE.md already covers backend rules. No sync burden. Adjust SC#2 expectation.

### PROJECT.md Key Decisions Update
- **D-20:** **Add a new row** to the Key Decisions table for D-PRD-12. Mark the existing D-v2.5-02 row as SUPERSEDED.

### Claude's Discretion
- ADR reference style (test file paths vs verification report) — follow DECISIONS.md conventions
- Re-trigger clause severity threshold — data-corrupting = immediate revert; non-user-visible = diagnose first
- `restart-backend.ps1` update — based on active usage
- Lifespan hook ordering documentation — Phase 077 already validated; document if relevant during planning
- Graceful shutdown under multi-worker — zombie-heal path handles it; document if gaps found during planning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Multi-worker architecture
- `.planning/prd-reset/DECISIONS.md` § D-PRD-08 — Original decision to lift D-v2.5-02 in v2.6; contains context, consequences, singleton audit scope
- `.planning/PRDs/v2.6.md` § 2 (D-v2.5-02 row) + § 13 (Q-v2.6-02, Q-v2.6-05) — PRD context for the supersession; Q-v2.6-02 resolved to "phased", Q-v2.6-05 is the ADR wording question this phase answers

### Phase 077 validation evidence
- `.planning/phases/077-multi-worker-validation-harness/077-VERIFICATION.md` — 4/4 truths verified; 50-run load + cross-worker cancel + sandbox re-attach + per-worker Redis singleton
- `backend/tests/integration/test_077_multi_worker.py` — 50-parallel-run synthetic load test
- `backend/tests/integration/test_077_cross_cancel.py` — Cross-worker cancel via Redis zombie-heal
- `backend/tests/integration/test_077_sandbox_reattach.py` — Docker container re-attach by thread_id

### Phase 078 backpressure
- `.planning/phases/078-backpressure-json-primitive-code-quality-bundle/078-CONTEXT.md` — D-078-07 backpressure endpoint auth; per-worker RUN_TASKS count is a signal source

### Config files to modify
- `CLAUDE.md` line 26 — Current single-worker rule text (to be replaced)
- `backend/.env.example` — Add WORKER_COUNT=2
- `.planning/PROJECT.md` Key Decisions table — Add D-PRD-12 row, mark D-v2.5-02 SUPERSEDED

### REQUIREMENTS.md
- `.planning/REQUIREMENTS.md` — WORKER-LIFT-01 (full enablement), WORKER-LIFT-03 (ADR + CLAUDE.md update)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 077 test infrastructure (`test_077_*.py`) — already validates multi-worker behavior; re-run as regression check
- `GET /admin/backpressure` endpoint (Phase 078) — `per_worker_run_count` signal for verification
- `backend/app/dependencies.py` — `_supabase`, `_redis`, `_pg_pool` singletons all lazy-init per-worker (verified by Phase 077)
- `backend/app/main.py` lifespan — `aclose()` for Supabase + Redis already in place (Phase 078)

### Established Patterns
- `.env` → backend entrypoint pattern: `SANDBOX_ENABLED`, `REDIS_URL`, `CONSUMER_TIMEOUT_SECONDS` all read from env
- D-PRD ADR format in DECISIONS.md: Context → Decision → Consequences → Alternatives → Re-trigger conditions
- `RUN_TASKS` dict at `threads.py:92` — per-worker registry, cancelled in lifespan

### Integration Points
- `backend/app/main.py` — uvicorn startup (needs `--workers` from `WORKER_COUNT`)
- `CLAUDE.md` Rules section line 26 — single-worker rule text
- `.planning/prd-reset/DECISIONS.md` — new D-PRD-12 entry
- `.planning/PROJECT.md` Key Decisions table — new row + D-v2.5-02 SUPERSEDED annotation
- `supabase/migrations/052_runs_worker_id.sql` — new migration
- `backend/app/api/threads.py` run INSERT site — write `spawned_by_worker` column

</code_context>

<specifics>
## Specific Ideas

- Singleton audit table in D-PRD-12 should cover: `_supabase`, `_redis`, `_pg_pool`, `RUN_TASKS`, `sandbox_manager._sessions`, `_BACKGROUND_TASKS`, settings TTL cache, LangSmith client — each with per-worker/Redis-backed status and Phase 077 test reference
- Scaling trigger wording should reference the specific backpressure endpoint field: "When `GET /admin/backpressure` shows `anyio_threadpool_depth` sustained above 70% of pool size across both workers for >5 minutes, consider scaling to `WORKER_COUNT=4`"
- D-v2.5-02 supersession should be inline annotation on the existing entry + the new D-PRD-12 entry — both need to exist so readers find the story from either direction

</specifics>

<failure_criteria>
## How We'd Know This Failed

1. **Worker crash on startup:** uvicorn with `--workers 2` fails to start or one worker crashes within 30s. Root cause: a singleton init that doesn't tolerate fork().
2. **Cross-worker state corruption:** A run started in worker A shows partial/corrupt data when read from worker B. Observable as: garbled tool output, missing messages, or duplicate runs in the DB.
3. **Backpressure endpoint wrong counts:** `per_worker_run_count` shows incorrect values (e.g., both workers report the union instead of their own count).
4. **Sandbox session attaches to wrong container:** A code execution request routed to worker B attaches to worker A's sandbox container for a different thread.
5. **Documentation inconsistency:** CLAUDE.md still says single-worker after the ADR says multi-worker, or D-PRD-12 contradicts Phase 077's actual test results.

</failure_criteria>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Bug Cross-Check (surface: Agentic-RAG, status: open)
- BUG-260526-02 (Kimi thinking leaks) — NOT Phase 079 domain (backend/streaming, frontend/chat)
- BUG-260526-03 (output files SSE-only) — NOT Phase 079 domain (frontend/chat, backend/streaming)
- BUG-260526-04 (timer disappears mid-cycle) — NOT Phase 079 domain (frontend/chat, frontend/streaming)

</deferred>

---

*Phase: 079-d-v2-5-02-supersession-multi-worker-enable*
*Context gathered: 2026-05-27*
