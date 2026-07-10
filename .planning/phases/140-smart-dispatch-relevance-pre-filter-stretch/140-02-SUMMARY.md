---
phase: 140-smart-dispatch-relevance-pre-filter-stretch
plan: 02
subsystem: skill-embedding / smart-dispatch pre-filter (data-population half)
tags: [TRIG-02, embeddings, reembed, self-heal, run_in_threadpool, D-01, D-05, V4]
requires:
  - "reembed_service.py shape (batched/resumable/RLS-scoped/non-destructive/threadpool)"
  - "openai_service.embed_texts (the single embed entrypoint)"
  - "skill_test_cases.prompt (migration 079 — the should_fire signal source)"
provides:
  - "build_skill_embed_source — D-01 embed-source builder (pure)"
  - "skill_source_text_hash — deterministic sha256 staleness fingerprint"
  - "skill_reembed_job — reembed-shaped stale-only backfill (owner-scoped, threadpool-wrapped, non-destructive, fail-open)"
  - "kick_skill_backfill — fire-and-forget self-heal primitive (immediate return, strong-ref'd, double-wrap fail-open)"
affects:
  - "Plan 04 (over-budget branch calls kick_skill_backfill on NULL-sim skills)"
  - "Plan 05 (applies migration 091 + runs the REAL vector backfill against the live table)"
tech-stack:
  added: []            # zero new packages (threat T-140-SC accept)
  patterns:
    - "reembed_service backfill shape reused for skill vectors"
    - "evals.py _RECONCILE_TASKS strong-ref fire-and-forget spawn"
    - "run_in_threadpool around EVERY blocking call (embed + supabase read + supabase write)"
key-files:
  created:
    - backend/app/services/skill_embedding_service.py
    - backend/tests/integration/test_140_skill_embedding_service.py
  modified: []
decisions:
  - "Job read is owner-scoped .eq(user_id) (reembed V4 precedent) — a global skill's vector is populated by ITS OWNER's job; the current user's kick self-heals only skills they own, which is fail-open-safe (a still-NULL-sim global skill is kept, ranked-last, by Plan 04)."
  - "Non-destructive write = upsert(on_conflict=skill_id) with user_id in the payload (the V4 write scope) — an upsert cannot chain a PostgREST .eq filter, so the row's user_id column IS the hand-scope; no bulk DELETE is ever issued."
  - "Staleness is computed in Python, not SQL — the hash-mismatch arm needs build_skill_embed_source (a concatenation SQL can't derive). The DB read only narrows scope/ids; the predicate runs after."
metrics:
  duration: ~40m
  completed: 2026-07-07
  tasks: 2
  files: 2
  tests: 12
---

# Phase 140 Plan 02: Skill Embedding Service (embed-source + backfill + self-heal) Summary

One-liner: A `reembed_service`-shaped skill-vector backfill (`skill_reembed_job`) plus the D-01
embed-source builder and a fire-and-forget `kick_skill_backfill` self-heal primitive — the
off-the-hot-path data-population half of the smart-dispatch pre-filter, authored + mock-tested with
the real vector round-trip deferred to the [BLOCKING] Plan 05.

## What was built

- **`build_skill_embed_source(skill, test_case_prompts)`** — the D-01 signal set: joins the skill
  `description` with each non-empty `should_fire` test-case prompt on newlines, falls back to the
  skill `name` when both are absent, and caps at 4000 chars so a huge test-suite can't dominate one
  embed. Pure, DB-free, unit-tested.
- **`skill_source_text_hash(text)`** — deterministic sha256 hexdigest staleness fingerprint (a
  non-crypto fast hash; ASVS V6 — no crypto boundary). Paired with the `embedding_model` tag for
  the D-10 cross-vector-space guard.
- **`skill_reembed_job(supabase, user_id, app_settings, *, batch_size, max_batches, only_skill_ids)`**
  — reembed-shaped backfill. Each pass reads the owner's enabled skills (+ their test-case prompts +
  current `skill_embeddings` row), selects the STALE ones (absent row OR `source_text_hash` mismatch
  OR `embedding_model` != current), embeds the batch, and NON-DESTRUCTIVELY upserts one row per skill.
  Owner `.eq("user_id", …)` hand-scope on the read; `user_id` baked into the upsert payload on the
  write (V4). `only_skill_ids` narrows the read (`.in_("id", …)`) for the self-heal kick. Fail-open:
  a failure logs a warning (`exc_info`) and returns an honest partial — it never crashes the caller.
- **`kick_skill_backfill(supabase, user_id, app_settings, *, only_skill_ids)`** — the Blocker-1
  self-heal primitive Plan 04 fires from the over-budget branch. Spawns `skill_reembed_job` via
  `asyncio.create_task`, strong-refs the task in module-level `_BACKFILL_TASKS` (+ `add_done_callback`
  discard — the evals.py `_RECONCILE_TASKS` no-GC pattern), and returns IMMEDIATELY. Double-wrapped
  fail-open (D-05): the inner coroutine swallows a spawned-job failure, and the spawn itself is
  wrapped so a `create_task` failure is also swallowed (the un-scheduled coroutine is `.close()`d to
  avoid a leak) — neither ever reaches the caller.

## Warning-1 / D-v2.5-01 compliance (threadpool)

Every blocking call runs through `run_in_threadpool` — the `embed_texts` embed AND the supabase
`.select` read AND each `.upsert` write — exactly like `reembed_service` (which wraps EVERY supabase
call, not just the embed). `test_job_threadpool_wraps_io` proves it by swapping `run_in_threadpool`
for a recording spy and asserting the read + embed + write all route through it (≥3 wrapped calls).

## Tests (12 — all mock/unit, green now)

| Test | Proves |
|------|--------|
| test_embed_source_builder | description + should_fire prompt both present |
| test_embed_source_name_fallback | empty description + no cases → name |
| test_embed_source_caps_at_4000 | huge test-suite capped at 4000 chars |
| test_source_text_hash_deterministic | deterministic sha256; changed source → changed hash |
| test_job_selects_only_stale | absent + model-mismatch embedded; fresh skipped |
| test_job_only_skill_ids_narrows | kick's NULL-sim ids narrow the read (`.in_`) |
| test_job_hand_scopes_user_id | V4: read `.eq(user_id)`, write payload `user_id` |
| test_job_non_destructive_upsert | no bulk DELETE; upsert on_conflict=skill_id, keyed skill_id+user_id |
| test_job_fail_open_on_embed_error | embed raise → logged warning + honest partial, no crash |
| test_job_threadpool_wraps_io | embed + read + write all via run_in_threadpool |
| test_kick_is_fire_and_forget | immediate return; job still in flight; strong-ref'd |
| test_kick_swallows_failure | swallows BOTH a spawned-job failure AND a spawn failure |

## Deferred to Plan 05 (migration-not-applied trap — expected)

Migration 091 (`skill_embeddings` table + `match_skills` RPC + `skill_catalog_max_tokens` column) is
NOT applied to the live DB until the operator-gated [BLOCKING] Plan 05. Accordingly, this plan's test
file contains **no live-table assertion** — every test is mock-level (recording supabase stand-in +
deterministic `embed_texts` stub), so all 12 pass now with no DB. The **real vector round-trip** (job
writing genuine vectors into the live `skill_embeddings` table, and the cross-user RLS/scope proof
against real two-user rows à la `test_111_1_reembed_rls.py`) is the Plan 05 concern and was
intentionally not authored here. Nothing in this plan is EXPECTED-RED — no live-DB test was written
that would only flip green post-apply.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty embedded-resource list crashed the staleness check**
- **Found during:** Task 2 GREEN (own newly-written code).
- **Issue:** `_is_stale` did `existing[0] if isinstance(existing, list) else existing`; PostgREST
  returns the embedded `skill_embeddings` resource as an **empty list** `[]` when the skill has no
  vector row yet (the common absent/first-backfill case) — `[][0]` raised `IndexError`, which the
  job's fail-open `except` swallowed into a `failed` result, masking the true "stale → embed" path.
- **Fix:** treat an empty list as absent (`row = existing[0] if existing else None`).
- **Files modified:** backend/app/services/skill_embedding_service.py
- **Commit:** 44db75de (Task 2 GREEN)

**2. [Rule 2 - Resource cleanup] Un-awaited coroutine leak on spawn failure**
- **Found during:** Task 2 GREEN (spawn-failure test emitted a `coroutine was never awaited` warning).
- **Issue:** `kick_skill_backfill` created the `_run()` coroutine as the argument to
  `asyncio.create_task`; when `create_task` raises (the spawn-failure fail-open path), the coroutine
  object was never scheduled → resource leak + RuntimeWarning.
- **Fix:** bind the coroutine to a name and `coro.close()` in the spawn-failure `except` branch.
- **Files modified:** backend/app/services/skill_embedding_service.py
- **Commit:** 44db75de (Task 2 GREEN)

Both fixes are within the newly-authored code of this plan (not pre-existing surface); the plan's
intent — stale-only, hand-scoped, non-destructive, threadpool-wrapped, fail-open + fire-and-forget
self-heal — is delivered exactly as written.

## Threat surface

No new security surface beyond the plan's `<threat_model>`. The job's reads/writes touch only the
declared `skill_embeddings` table under the V4 owner hand-scope; T-140-03 (cross-user disclosure),
T-140-04 (event-loop block), and T-140-12 (crash/half-write) mitigations are all present and tested.
Zero new packages (T-140-SC accept). No threat flags.

## Known Stubs

None. All logic is real; no placeholder/mock data flows to any consumer. (The mock supabase +
deterministic embed stub live only in the test file, per the plan's mock-level design.)

## Self-Check: PASSED

- FOUND: backend/app/services/skill_embedding_service.py (294 lines; min_lines 70 satisfied)
- FOUND: backend/tests/integration/test_140_skill_embedding_service.py (12 tests, all green)
- Commits FOUND: 9ddb9b31 (test RED), df2e0b2e (feat GREEN), 3c9f3166 (test RED), 44db75de (feat GREEN)
- G-5 respected: diff touches neither `threads.py` nor `agent_loop.py`
- Plan verify: `run_in_threadpool` count ≥ 3 (embed + read + write) and `kick_skill_backfill` present — OK
