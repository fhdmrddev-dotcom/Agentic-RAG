# Phase 096: Eval Harness + Cross-Provider Verification + Concurrency - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The v2.8 closing phase — it builds almost no new features; it **proves the harness is trustworthy and makes that proof permanent**. Three pillars:

1. **EVAL-01** — extend `scripts/eval_cross_provider.py` (exists, ~700 lines, currently Deep-mode tool-use eval on 8 providers) to drive a **multi-phase workflow** end-to-end per provider; wire a standing regression gate; model-ID curation pass.
2. **EVAL-02** — 4-axis UAT scoreboard + **uvicorn-restart-mid-workflow** smoke per phase type (incl. mid-`ask_user`) + HARNESS-03 kill-and-resume verification (no skipped phases, no double side-effects).
3. **CONC-01** — verify `llm_batch_agents` fan-out fairness (the `max_parallel_agents=5` semaphore already shipped in 091 — this is *verification*, not building) AND fix **BUG-260530-01** (15-30s thread-switch hang) via the frontend stream-cap.

**Folded bug:** BUG-260605-01 (orphaned ask_user 404s silently) — fix + verify here (D-06).

</domain>

<decisions>
## Implementation Decisions

### CI gate semantics (EVAL-01)
- **D-01 — Hybrid CI gate:**
  1. A **deterministic harness-workflow regression test with a fake/mock provider** added to real GitHub CI (`.github/workflows/backend-tests.yml`) — drives a full multi-phase workflow through the engine, catching structural breaks (phase sequencing, gate retries, whitelist enforcement, resume 2-phase writes) on every push. Free, never flaky, no secrets.
  2. The **live cross-provider eval stays operator-run** and becomes the **documented mandatory gate** for phase closure on any provider-touching phase (same standing as the 4-axis UAT recipe), with a greppable scoreboard diff. The script's localhost-hard-gate stays; no GitHub secrets for provider keys.

### Eval scope & curation (EVAL-01)
- **D-02 — One max-coverage workflow per provider:** the eval drives a single workflow chosen to touch the most phase types (programmatic split → `llm_batch_agents` fan-out → `llm_agent` → `llm_single`), once per provider. The full native-7 × 5-phase-type × 4-workflow matrix is NOT re-run per eval — that breadth was proven live in 093 D-21 and stays the VALIDATION.md deep-check.
- **D-02a — Auto-answered `ask_user`:** the script answers the `llm_human_input` prompt via the same POST endpoint the panel uses — the F10 round-trip (broken twice: F10, BUG-260605-01) is robot-watched on every eval run.
- **D-03 — Provider matrix carried forward (D-089-05):** native-7 (openai, anthropic, google, deepseek, moonshot, zhipu, minimax) is the hard pass/fail bar; OpenRouter best-effort (recorded, never gating).
- **D-04 — Measure feature-fit, don't act on it:** the eval scoreboard is extended to persist a **per-provider capability table** (tool-use fidelity, workflow completion, retry counts, wall-clock) as a versioned artifact. Actual routing changes (per-feature provider defaults) are a deliberate separate pass — **deferred to v2.9**.
- **D-05 — Full-registry model curation:** curate `MODEL_CAPABILITIES` + Settings model lists (not just the eval PROVIDERS constant), validated against each provider's **live `/models` endpoint**, newest-first ordering with newest as default (standing operator preference). The registry is where the case-sensitive silent-downgrade trap lives (zhipu/minimax → structured-mode regression).

### Bug routing + restart UAT (EVAL-02)
- **D-06 — BUG-260605-01 FOLDED as a fix** (not UAT-only): backend harness-failure cleanup (a run reaching terminal status clears/marks its pending `ask_user`) + frontend honesty (a card whose run is terminal renders expired/disabled; a 404 on submit surfaces a visible error, never silence). EVAL-02's restart-mid-`ask_user` UAT verifies the fix. Frontmatter updated (status=folded, folded_into=096).
- **D-07 — BUG-260603-01 stays open:** composer/send surface, no overlap with 096; SEED-055 holds the residual. re_open_trigger records the 096 review.
- **D-08 — Operator-driven restart smoke, script-assisted:** a helper script seeds the right workflow, signals exactly when to kill ("phase N is now `active` — restart now"), and after the operator restarts uvicorn asserts DB truth: no skipped phases, no double-applied side effects, `ask_user` prompt re-emitted. Operator runs the backend in a visible terminal (standing preference) — the human IS the restart mechanism; the robot owns setup + assertions. Kill points: mid-`programmatic`, mid-`llm_agent`, mid-`ask_user` (SC#4).

### Stream-cap behavior (CONC-01 frontend — approach locked 2026-05-30: frontend cap-live-streams)
- **D-09 — Pool size 3:** the viewed thread ALWAYS holds a live stream + the **2 most-recently-viewed** background runs; max 3 held-open streaming fetches, leaving 3 of the browser's 6 per-host connections free for normal traffic. One configurable constant.
- **D-10 — Honest background indicator:** a capped-out background thread keeps its "running" pulse/spinner (run status is known from the runs list, not the stream) — **no live token progress, no fake activity**. Show what we know, never simulate what we don't.
- **D-11 — Switch-back reconcile:** snapshot fetch (`GET /threads/{id}/snapshot`) renders full current state instantly, then the live stream **re-attaches with replay from the Redis `run:{run_id}` buffer** (lossless reconnect is what the run-buffer was built for), evicting the least-recently-viewed background stream. <1s reconcile per SC#5.
- **D-11a — The cap trade-off is asserted, not apologized for:** with ≥4 concurrent runs, threads beyond the pool show NO live tokens until visited — a designed behavior. The 4-axis parallel-thread UAT row asserts this explicitly so a future phase doesn't "fix" it as a bug.

### Claude's Discretion
- Exact mock-provider design for the CI structural test (fixture vs fake gateway adapter).
- Capability-table artifact format (markdown vs JSON vs both) and storage location.
- Cross-tab GET <50ms measurement method + AnyIO threadpool budget verification approach (SEED-036a, SC#3).
- Helper-script UX details for the restart smoke (polling cadence, output format).
- LRU bookkeeping details for the stream pool, as long as PANEL-06 isolation + per-thread demux are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Eval (EVAL-01)
- `scripts/eval_cross_provider.py` — the existing Deep-mode eval to EXTEND (native-8 PROVIDERS list, localhost-hard-gate, drives live `POST /threads/{id}/messages`, greppable PASS/FAIL scoreboard; reuse its env-load + psycopg2 patterns)
- `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md` — the eval's origin seed (per-provider prompt strategy + new-model compatibility assurance)
- `.github/workflows/backend-tests.yml` — the CI home for the D-01 mock-provider structural test

### Harness / restart UAT (EVAL-02)
- `backend/app/models/harness.py` — `max_parallel_agents: int = 5` (line ~72) + phase-config models
- `backend/app/services/harness/phase_types.py` — the `asyncio.Semaphore(max_parallel_agents)` fan-out bound (line ~347) CONC-01 verifies
- `.planning/reported-bugs/orphaned-askuser-prompt-failed-run-404-silent.md` — BUG-260605-01, FOLDED here (D-06); full repro + observed behavior
- `.planning/phases/093-harness-cross-provider-parity/` — 093's D-21 live re-UAT format is the model for the VALIDATION.md scoreboard

### Concurrency / stream-cap (CONC-01)
- `.planning/reported-bugs/thread-switch-hang-stream-connection-saturation.md` — BUG-260530-01, folded into 096 (mechanism: HTTP/1.1 6-connection cap saturated by held-open streaming fetches)
- `frontend/src/providers/StreamsProvider.tsx` — the stream-cap surface (G-5 hot file, satisfied 075.7; PANEL-06 isolation + per-thread demux MUST survive)
- `.planning/seeds/SEED-036-task-global-concurrency-scale.md` — SEED-036/036a (global Redis-Lua cap 20, AnyIO threadpool budget)
- `REDIS-SETUP.md` — run-buffer key conventions (`run:{run_id}` stream replay is the D-11 substrate)

### Standing rules that bind this phase
- `CLAUDE.md` → "UAT scoreboard recipe (MANDATORY)" — the 4-axis bandwidth definition (UAT rows in VALIDATION.md, never PLAN.md)
- `.planning/ROADMAP.md` → Phase 096 entry — SC#1-5 verbatim + Notes (CONC-01 covers backend fan-out AND frontend saturation; rejected alternatives: multiplexed transport, HTTP/2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/eval_cross_provider.py` — 702 lines, already native-8, already localhost-gated, already scoreboard-emitting; EVAL-01 is an EXTENSION (add a workflow-mode row type), not a rewrite
- `max_parallel_agents` semaphore — already implemented in 091 (`phase_types.py:347`); CONC-01's backend half is pure verification (N=10 fans out ≤5 concurrent)
- `GET /threads/{id}/snapshot` — the existing reconcile endpoint background runs use on return (D-v2.5-03 fetch-on-reconnect)
- Redis `run:{run_id}` stream replay — lossless reconnect already proven; D-11 re-attach builds on it
- `scripts/observe-run.py`, `scripts/capture_run_events.py` — env-load + DB-query patterns to reuse for the restart-smoke helper script

### Established Patterns
- 093's D-21 live re-UAT scoreboard — the format for EVAL-02's VALIDATION.md
- 089/092.5 byte-identical SSE-diff proof method — available if the stream-cap work risks touching shared paths (it shouldn't; it's frontend-only)
- TDD RED→GREEN with baseline-failure proof via git stash (095.1 pattern) — frontend vitest has a documented ~16-failure pre-existing baseline cluster; prove net-new=0 the same way

### Integration Points
- `.github/workflows/backend-tests.yml` — where the D-01 mock-provider structural test lands
- `StreamsProvider.tsx` connection management — where the D-09/D-10/D-11 pool lives; chat selectors must never re-render from pool churn (PANEL-06)
- `submit_ask_user_response` (093-04's workflow_run-id fallback) — the endpoint the D-02a auto-answer drives and the D-06 cleanup hardens

### Known constraints
- Playwright E2E suite is rotted (SEED-049, 16/17 fail at baseline) — it is NOT a usable backstop for this phase; don't lean on it
- Operator starts uvicorn manually in a visible terminal — never run_in_background (standing preference; also what makes D-08 natural)

</code_context>

<specifics>
## Specific Ideas

- "The robot watches ask_user": auto-answering the prompt in the eval exists specifically because the round-trip broke twice (F10, BUG-260605-01) — it's regression insurance, not convenience.
- The stream-cap trade-off is a FEATURE statement: ≥4 concurrent runs → unwatched threads show "running" but no live tokens until visited. Assert it in UAT (D-11a) so it's never re-litigated as a bug.
- "CI gate" honesty: GitHub CI proves structure (deterministic, free, every push); only the operator's live eval proves providers (costly, flaky, on-demand). Don't pretend either can do the other's job.

</specifics>

<deferred>
## Deferred Ideas

- **Feature-fit provider routing changes** (per-feature provider defaults driven by the D-04 capability table) → v2.9, as a deliberate decision pass once the measurement artifact exists. (Memory: project_provider_feature_fit_routing.)
- **BUG-260603-01** (silent send-drop) → stays open; dedicated composer/send-reliability fix when scoped (SEED-055 residual).
- **Live-eval GitHub Actions job** (manual-trigger workflow_dispatch with provider secrets) → possible later hardening of D-01 if the operator ritual proves insufficient; rejected for now (cost, secrets, provider flakiness, localhost-gate philosophy).
- **Playwright E2E revival** → SEED-049 (separate effort; explicitly NOT part of 096's CI gate).

</deferred>

---

*Phase: 096-eval-harness-cross-provider-verification-concurrency*
*Context gathered: 2026-06-06*
