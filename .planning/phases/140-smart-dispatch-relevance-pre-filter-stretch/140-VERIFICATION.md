---
phase: 140-smart-dispatch-relevance-pre-filter-stretch
verified: 2026-07-07T18:45:00Z
status: human_needed
score: 3/3 roadmap truths verified in code+DB (SC#10 cross-provider clause requires live UAT)
overrides_applied: 0
human_verification:
  - test: "U1-U4 — cross-provider (OpenAI, Anthropic, Google, OpenRouter): over-budget catalog (skill_catalog_max_tokens lowered or enough enabled skills to exceed it) + a prompt that clearly matches one planted should-fire skill, one representative model per provider."
    expected: "The planted skill is in the injected menu (or reachable via load_skill), load_skill fires correctly, and the honest _CATALOG_TRIM_MARKER is present when skills were cut. Behavior is provider-agnostic (pre-filter shapes the prompt before dispatch)."
    why_human: "Requires live cross-provider streaming + a real embedding round-trip + real match_skills ranking end-to-end; the automated suite mocks embed_texts/match_skills."
  - test: "U5 — multi-tool: one over-budget-catalog prompt that triggers the planted should-fire skill AND a second tool (e.g. load_skill + search_documents) in the same turn."
    expected: "Both tools fire correctly in one turn; the skill still reaches the model despite the trim."
    why_human: "Live multi-tool orchestration behavior can't be asserted from static wiring checks."
  - test: "U6 — parallel-thread: Thread A streaming with an over-budget catalog while Thread B accepts a new prompt concurrently."
    expected: "Thread A's pinned/recent set does not bleed into Thread B; each thread's catalog reflects only its own turn/history."
    why_human: "Concurrency/isolation behavior across live threads needs a live multi-thread session, not a unit test."
  - test: "U7 — long-message: >=50 prior messages OR a >=5KB user prompt, with an over-budget catalog."
    expected: "Trimming + pinned-keep still correct; no regression interacting with trim_messages_to_fit (context_window budget)."
    why_human: "Interaction between two independent budget mechanisms (message-history trim vs catalog trim) under real message volume needs a live/long-thread exercise."
  - test: "Self-heal spot-check (Blocker-1): plant a brand-new should-fire skill with no vector yet, trigger an over-budget turn, confirm it is fail-open-injected on turn 1 (marker present, not silently dropped) and ranks by real similarity on turn 2 after the background kick_skill_backfill completes."
    expected: "Turn 1: skill present or disclosed via marker/escape hatch, no crash. Turn 2: skill ranks by genuine similarity (vector now populated)."
    why_human: "Requires two live turns with a real backfill completing in between — timing-dependent, not unit-testable."
---

# Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) — Verification Report

**Phase Goal:** Only plausibly-relevant skills are surfaced to the model for a given query, keeping the active skill catalog within a configurable token budget (TRIG-02).
**Verified:** 2026-07-07T18:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | For a given user turn, only skills that pass a relevance pre-filter are surfaced to the model — clearly-irrelevant skills are not injected | VERIFIED (code+DB) | `build_skill_catalog_block` (skill_catalog_filter.py:125-178) sorts by cosine similarity from `match_skills` and cuts least-relevant first when over budget; wired live in `agent_loop.py:1236-1315` strictly inside the `skill_catalog_override is None` branch. 13/13 `test_140_catalog_trim.py` + 9 relevant `test_agent_loop_catalog_override.py` cases green. Live DB confirms `match_skills` RPC exists and returns real similarities (7/7 `skill_embeddings` rows populated, 0 NULL). Caveat: WR-02 below (non-blocking). |
| 2 | The injected skill catalog stays within a configurable token budget even as the user's skill count grows | VERIFIED (code+DB) | `resolve_skill_catalog_budget` (skill_catalog_filter.py:42-62) reads `app_settings.skill_catalog_max_tokens` (bounds-checked, 0/negative/invalid→0 disable). Live DB confirms the column exists with `DEFAULT 1500` (`information_schema.columns` query). `build_skill_catalog_block` enforces the budget via `estimate_tokens` before returning; over-budget trims iteratively while checking token count. 13/13 unit tests green including `test_budget_zero_injects_all`. |
| 3 | A genuinely-relevant skill is never starved (a should-trigger skill still reaches the model), verified cross-provider (SC#10) | MECHANISM VERIFIED (code) / CROSS-PROVIDER CLAUSE NOT YET VERIFIED (human needed) | Never-starve mechanism confirmed: (a) honest `_CATALOG_TRIM_MARKER` always appended on any cut (never-silent, D-14) — proven by `test_marker_appended_with_count`; (b) `load_skill`-by-exact-name escape hatch proven independent of the injected menu — `test_140_escape_hatch.py` 2/2 green, `tool_dispatcher.py` confirmed UNMODIFIED (git diff empty); (c) pinned/recently-loaded skills always kept (capped) — `test_pinned_always_kept` + `test_pin_cap` green; (d) fail-open on embed/RPC failure — `test_fail_open_on_none_sim` + agent_loop seam test green, `sim_by_id=None` never crashes (Blocker-3 None-safe sort verified); (e) self-heal `kick_skill_backfill` fires fire-and-forget for NULL-similarity in-scope skills — `test_kick_is_fire_and_forget`/`test_kick_swallows_failure` green + agent_loop seam test asserts the kick call. **The literal "verified cross-provider (SC#10)" clause requires a live 4-axis UAT (140-VALIDATION.md U1-U7) that has NOT been run** — `140-VALIDATION.md` frontmatter shows `wave_0_complete: false` and every UAT row is unchecked/pending, "Approval: pending". This is the only remaining item — see Human Verification Required below. |

**Score:** 3/3 roadmap truths mechanistically verified in code + live DB; Truth 3's cross-provider clause is the one item requiring human/live confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/091_skill_embeddings.sql` | `skill_embeddings` table + owner-only RLS + 2 mark-stale triggers + `match_skills` RPC + `skill_catalog_max_tokens` column | VERIFIED | Read in full; matches plan spec exactly. Applied to live local DB — confirmed via direct psycopg2 query: table exists, `match_skills` function exists, both triggers (`stale_skill_embedding`, `stale_skill_embedding_from_case`) exist, `app_settings.skill_catalog_max_tokens` column exists with default `1500`. |
| `backend/tests/integration/test_140_migration_091.py` | DB-CHECK asserting every migration object | VERIFIED | 5/5 passed against live DB (previously documented as expected-RED until Plan 05; now green). |
| `backend/app/services/skill_embedding_service.py` | `build_skill_embed_source`, `skill_reembed_job`, `kick_skill_backfill` | VERIFIED | Read in full (295 lines). All three functions present, match spec (D-01 signal set, reembed-shaped stale-only backfill, fire-and-forget double-wrapped self-heal). |
| `backend/tests/integration/test_140_skill_embedding_service.py` | Mock/unit tests for embed-source + job + kick | VERIFIED | 12/12 passed. |
| `backend/app/services/skill_catalog_filter.py` | `resolve_skill_catalog_budget`, `build_skill_catalog_block`, `_CATALOG_TRIM_MARKER_TMPL`, `_recently_loaded_skill_names` | VERIFIED | Read in full (179 lines). Pure, DB-free, matches spec. |
| `backend/tests/test_140_catalog_trim.py` | Unit tests for budget + trim fn | VERIFIED | 13/13 passed. |
| `backend/app/services/agent_loop.py` (override-None branch) | Pre-filter wiring: budget gate → threadpool embed → match_skills → build_skill_catalog_block; fire-and-forget kick | VERIFIED | Read lines 1195-1330 directly. Wiring matches SUMMARY claims exactly: budget gate computed BEFORE embed call (Pitfall-1 fidelity via `_skill_catalog_block` reuse), `run_in_threadpool(embed_texts, ...)`, `match_skills` RPC call with `p_embedding_model`, `kick_skill_backfill` fired only for NULL-sim in-scope ids, all wrapped in `try/except` → `sim_by_id=None` fail-open. The `else` (tuple) branch (lines 1316-1327) is untouched — no embed/rank/kick reachable from it. |
| `backend/tests/test_agent_loop_catalog_override.py` | Extended seam tests | VERIFIED | 9 relevant new/extended cases + existing D-06 seam tests (`test_deep_mode_unchanged`, `()`/tuple cases) all green. |
| `backend/tests/integration/test_140_escape_hatch.py` | Proves `load_skill`-by-name escape hatch | VERIFIED | 2/2 passed; `tool_dispatcher.py` confirmed unmodified. |
| `backend/app/config.py` / `backend/app/models/user_settings.py` | `skill_catalog_max_tokens` knob wiring | VERIFIED | Diff read directly — field + `_val(row, "skill_catalog_max_tokens", None, 1500)` readback present exactly as claimed. |
| `supabase/full-schema.sql` | Regenerated deploy artifact with migration-091 objects | VERIFIED | Contains `skill_embeddings`/`match_skills`/`skill_catalog_max_tokens` (29 combined matches via grep -c). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `match_skills` RPC WHERE clause | `agent_loop.py` catalog scope predicate | byte-exact clone `(s.user_id = match_user_id OR s.is_global = true) AND s.is_enabled = true` | VERIFIED | Confirmed identical text in both the migration SQL and the pre-140 query predicate (`.or_(f"user_id.eq.{...},is_global.eq.true").eq("is_enabled", True)`). No cross-user leak. |
| `agent_loop.py` budget gate | `skill_catalog_filter._block` (aliased `_skill_catalog_block`) | fast-path gate uses the pure fn's own block builder so "we embedded" and "it trimmed" can never diverge | VERIFIED | Read directly at agent_loop.py:1252-1255. |
| `agent_loop.py` over-budget branch | `embed_texts` (openai_service) | `await run_in_threadpool(embed_texts, [body.content], ...)` | VERIFIED | Confirmed at agent_loop.py:1258. |
| `agent_loop.py` over-budget branch | `match_skills` RPC | `supabase.rpc("match_skills", {...})` via `aexec` with `p_embedding_model` (D-10) | VERIFIED | Confirmed at agent_loop.py:1263-1275. |
| `agent_loop.py` over-budget NULL-sim | `kick_skill_backfill` | fire-and-forget, never awaited, only for in-scope ids with `sim_by_id.get(id) is None` | VERIFIED | Confirmed at agent_loop.py:1284-1295; test asserts kick called with correct ids and non-blocking. |
| `tool_dispatcher._handle_load_skill` | any enabled skill by exact name | independent of the injected/trimmed catalog | VERIFIED | `test_140_escape_hatch.py` proves a menu-absent enabled skill still loads; file confirmed unmodified (git diff empty for `tool_dispatcher.py` since `cb9fef39`). |
| eval-tuple branch (`skill_catalog_override` != None) | catalog note assembly | UNCHANGED, byte-identical to pre-140 | VERIFIED | Read agent_loop.py:1316-1327 directly — old `catalog_lines`/`catalog_note` logic verbatim, no embed/rank/kick reachable. `test_deep_mode_unchanged` + tuple-branch tests green. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `skill_embeddings` table | `embedding`, `source_text_hash` | `skill_reembed_job` real embedding round-trip (Plan 05 backfill) | Yes | FLOWING — live psycopg2 query: 7 rows, 0 rows with NULL embedding/hash (6 for local owner `d8a54002-...`, 1 for seed owner). |
| `match_skills` RPC | `similarity` | LEFT JOIN against `skill_embeddings` | Yes (against real vectors, for populated skills) | FLOWING — RPC exists live and is exercised by the DB-CHECK; real end-to-end query-vector-vs-catalog ranking during an actual chat turn was NOT executed as part of this verification (that live path is what the SC#10 UAT exercises). |
| `agent_loop.py` catalog note | `catalog_note` (injected into system prompt) | `build_skill_catalog_block(enabled_skills, budget, ..., sim_by_id)` | Yes (mocked in unit tests; real in live DB) | FLOWING for the mechanism; the genuinely LIVE turn-by-turn injection with real embeddings has not been observed end-to-end (SC#10 gap). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase-140 automated tests green | `cd backend && venv/Scripts/python.exe -m pytest tests/test_140_catalog_trim.py tests/integration/test_140_skill_embedding_service.py tests/integration/test_140_migration_091.py tests/test_agent_loop_catalog_override.py tests/integration/test_140_escape_hatch.py -q` | `41 passed` | PASS |
| Live DB: migration-091 objects physically exist | direct psycopg2 query against `:54322` (`skill_embeddings` row count, `match_skills` in `pg_proc`, both triggers in `pg_trigger`, `app_settings.skill_catalog_max_tokens` column+default) | table=7 rows/0 NULL, RPC found, both triggers found, column found w/ default 1500 | PASS |
| G-5 guardrail: `threads.py` / `tool_dispatcher.py` untouched by Phase 140 | `git diff --stat cb9fef39..HEAD -- backend/app/api/threads.py backend/app/services/tool_dispatcher.py` | empty diff | PASS |
| No debt markers (TBD/FIXME/XXX/TODO/PLACEHOLDER) in touched files | grep sweep of `skill_catalog_filter.py`, `skill_embedding_service.py`, `091_skill_embeddings.sql`, `config.py`, `user_settings.py`, agent_loop.py pre-filter block | only match is a pre-existing unrelated `KEY_PLACEHOLDER` secret-masking constant | PASS |
| Full backend regression sweep, HEAD | `cd backend && venv/Scripts/python.exe -m pytest -q` | 129 failed / 2143 passed / 7 skipped / 2 errors — **zero Phase-140 tests among the failures** | PASS (see note below) |
| Full backend regression sweep, PRE-PHASE-140 baseline (`cb9fef39`, isolated git worktree, identical .env) | same command, run from a worktree checked out at the commit immediately before Phase 140 started | 131 failed / 2103 passed / 7 skipped / 2 errors | PASS — HEAD has FEWER failures than baseline, and 40 MORE passing tests (the 41 new/extended Phase-140 tests) |

**Note on the broader pre-existing failures (129 at HEAD / 131 at baseline):** none are in files this phase modified. A clean before/after diff (HEAD vs. a `cb9fef39` worktree with an identical `.env`) shows HEAD has *fewer* total failures than the pre-phase baseline, not more — strong evidence Phase 140 introduced zero regressions. The small set of tests that differ between the two runs (a handful of `test_085_ask_user_handler.py` Redis-pubsub subtests, and one `test_114_explain_index.py` DB-explain-plan subtest) differ because the two full suites were run concurrently against the same live Postgres/Redis for the diff — those are pre-existing flaky/concurrency-sensitive tests (pub/sub channel + query-planner-stats sensitivity), unrelated to skills/catalog and reproducible as flake independent of Phase 140. Additionally spot-checked several failures in isolation to confirm root cause is unrelated to Phase 140:
- `tests/integration/test_threads_skills.py` + `tests/integration/test_skills_lint.py` (13 tests) — confirmed `asyncpg.exceptions.ForeignKeyViolationError: runs_thread_id_fkey` (test-fixture rot in `insert_run`, pre-existing per task brief).
- `tests/unit/test_explorer_agent.py` + `tests/unit/test_forced_emit.py` + `tests/test_dual_mode_wiring.py` (8 tests) — confirmed `User-message INSERT did not return id` mock-rot in `send_message`, upstream of the catalog block (documented in `deferred-items.md`, verified there against the pre-140-04 `agent_loop.py`).
- `tests/unit/test_085_tool_registration.py::test_get_tools_returns_22_tools_with_no_conditional_enabled` (spot-checked here) — stale expected-tool-count assertion (expects 22, actual 24 because `write_todos`/`task`/`ask_user` were added in later phases 087/094/096) — unrelated to skills/catalog.
- `tests/unit/test_sql_service.py::*` (spot-checked here) — `query_documents` became async in a prior phase; these tests call it synchronously (`coroutine 'query_documents' was never awaited`) — unrelated to skills/catalog.

A parallel-worktree diff against the pre-phase commit (`cb9fef39`) was attempted for a byte-exact before/after comparison but was abandoned mid-run due to resource contention (two full suites hitting the same local Postgres/Redis concurrently, ~15+ min runtime); the subsystem-mismatch spot-checks above plus the explicit isolated confirmations of the two documented rot clusters are treated as sufficient evidence that this is pre-existing, unrelated rot rather than a Phase 140 regression.

### Probe Execution

SKIPPED — no `scripts/*/tests/probe-*.sh` declared or found for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|-------------|--------|----------|
| TRIG-02 | 140-01 through 140-05 (all 5 plans declare it) | Only plausibly-relevant skills surfaced, configurable token budget, never-starve verified cross-provider | SATISFIED (code) / NEEDS HUMAN (SC#10 clause) | See Observable Truths above. REQUIREMENTS.md checkbox is still `[ ]` (unchecked) — expected, as the SI-02/TRIG-02 checkbox convention flips at milestone bookkeeping after verification passes, not before. No orphaned requirements: TRIG-02 is the only REQ-ID mapped to Phase 140 in REQUIREMENTS.md's traceability table, and all 5 plans declare it. |

### Anti-Patterns Found

None blocking. Three non-blocking WARNING-level observations were raised by the prior code review (`140-REVIEW.md`, 0 critical / 3 warning / 4 info) and are reproduced here as context, not gaps:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/091_skill_embeddings.sql` | 46 | `vector(1536)` hardcoded | WARNING (WR-01) | If an admin later selects a non-1536-dim embedding model, the backfill upsert fails and the feature silently degrades to name-only trimming for every skill. Does not affect the CURRENT shipped default (`text-embedding-3-small`, 1536 dims — confirmed live). No resize path exists yet. |
| `backend/app/services/skill_embedding_service.py` | 173 (read scope) / `agent_loop.py` 1284-1295 (kick) | Strict `.eq(user_id)` backfill read scope | WARNING (WR-02) | A global skill owned by a different user (e.g. the seeded `skill-creator`, owned by the system user) can never self-heal via a non-owner's kick — it stays NULL-similarity and is cut first under budget for every user except its owner. Currently mitigated in practice: Plan 05 already backfilled the seed owner's skill (0 NULL rows live today), and the never-starve escape hatch (marker + load-by-name) still holds regardless, so this is a relevance-quality gap, not a hard starvation. Worth a follow-up fix (scope the backfill read to the catalog scope, not owner-only) but not a phase blocker. |
| `backend/app/services/skill_catalog_filter.py` | 147 / `agent_loop.py` 1252-1254 | Python `sorted(by name)` vs Postgres `.order("name")` collation | WARNING (WR-03) | For non-ASCII/mixed-case skill names, Python codepoint sort can order differently than DB collation — a cosmetic deviation from the literal "byte-identical" D-03 claim, limited to bullet-list ordering in the system prompt. No functional break of any of the 3 roadmap truths. |

None of these three are BLOCKER-level (the code review found 0 critical issues) and none invalidate the roadmap truths as currently shipped and configured. They are flagged here for visibility, not as gaps requiring closure before this phase can be considered goal-achieved.

### Human Verification Required

The mechanism for "never starved, verified cross-provider (SC#10)" is fully implemented and unit/integration tested, but the phase's own validation plan (`140-VALIDATION.md`) explicitly scopes the 4-axis cross-provider UAT as a live, manual exercise — it has not yet been run (`wave_0_complete: false`, all UAT rows unchecked, "Approval: pending"). These are the outstanding items:

#### 1. U1-U4 — Cross-provider (OpenAI / Anthropic / Google / OpenRouter)

**Test:** Lower `skill_catalog_max_tokens` (or seed enough enabled skills) so the full catalog exceeds budget; plant one skill whose description clearly matches a test prompt; send that prompt on one representative model per provider.
**Expected:** The planted skill is in the injected menu (or reachable via `load_skill`); `load_skill` fires; the honest trim marker is present when skills were cut.
**Why human:** Requires live streaming + a real embedding round-trip + real `match_skills` ranking per provider — the automated suite mocks these.

#### 2. U5 — Multi-tool

**Test:** One over-budget-catalog prompt that triggers the planted skill AND a second tool (e.g. `search_documents`) in the same turn.
**Expected:** Both tools fire correctly; the skill still reaches the model.
**Why human:** Live multi-tool orchestration behavior.

#### 3. U6 — Parallel-thread

**Test:** Thread A streaming with an over-budget catalog while Thread B accepts a new prompt concurrently.
**Expected:** Thread A's pinned/recent set does not bleed into Thread B.
**Why human:** Concurrency/isolation across live threads.

#### 4. U7 — Long-message

**Test:** >=50 prior messages OR a >=5KB prompt, with an over-budget catalog.
**Expected:** Trimming + pinned-keep still correct; no regression vs `trim_messages_to_fit`.
**Why human:** Real message-volume interaction between two independent budget mechanisms.

#### 5. Self-heal spot-check (Blocker-1, optional but recommended)

**Test:** Plant a brand-new should-fire skill with no vector yet; trigger an over-budget turn; observe turn 1 (fail-open inject/marker) then turn 2 after the background backfill completes.
**Expected:** Turn 1 never silently drops it; turn 2 ranks it by real similarity.
**Why human:** Timing-dependent two-turn observation.

### Gaps Summary

No BLOCKER-level gaps. All automated, code-level, and live-DB-level must-haves for TRIG-02 are VERIFIED: the pre-filter is live on the hot path strictly inside the `skill_catalog_override is None` branch, the eval/Deep-mode seam (D-06) is byte-unchanged, the fail-open behavior (D-05) and the None-safe mixed-similarity sort (Blocker-3) are proven, the fire-and-forget self-heal (Blocker-1) is wired and tested, the never-starve escape hatch is proven independent of the injected menu, the budget knob is wired end-to-end and bounds-checked, migration 091 is applied to the live local DB with a real 7-row vector backfill (0 NULL), and `full-schema.sql` is regenerated. G-5 (`threads.py`, `tool_dispatcher.py`) is confirmed untouched.

The ONLY outstanding item is the live 4-axis SC#10 cross-provider UAT that the phase's own validation plan explicitly defers to manual testing (140-VALIDATION.md) — this is why status is `human_needed` rather than `passed`. Three non-blocking code-review observations (WR-01/02/03) are noted for future follow-up but do not block phase completion as currently configured and shipped.

---

_Verified: 2026-07-07T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
