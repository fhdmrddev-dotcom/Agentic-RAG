# Phase 096 — Deferred Items

Out-of-scope discoveries logged during execution (scope-boundary rule: not fixed, not chased).

## DI-096-02-A — Pre-existing rot: test_085_sub_agent_cross_provider stub uses the dead `llm_models` field

- **Found during:** 096-02 Task 2 (touched-surface net-new-failure sweep)
- **What:** 4 of 7 params of `tests/integration/test_085_sub_agent_cross_provider.py::test_cross_provider_default_path_no_footgun` fail (anthropic / google / deepseek / moonshot): the resolver returns the stale `gpt-4.1` candidate instead of the provider default.
- **Root cause (static):** the test's `_StubUserSettings` sets `llm_models` (the old CSV field), but `resolve_sub_agent_model_safely` reads `available_models` since the 093-03 D-06 field fix (`sub_agent_models.py:84-94` — the docstring documents the rename). With no `available_models` on the stub, `_active_models_list` is `[]` → the documented empty-list passthrough returns the candidate → the 4 hard-default params fail. The test encodes the pre-093 field contract.
- **Decoupling proof (why it is NOT 096-02 net-new):** the test file imports ONLY `app.config._SUB_AGENT_MODEL_DEFAULTS` + `app.services.sub_agent_models.resolve_sub_agent_model_safely` (lines 36-37) and never executes `task_service.run_task_sub_agent` — the sole production function 096-02 touched. Zero coupling to the 096-02 diff.
- **Suggested fix (one line, whoever owns it):** add `self.available_models = [m.strip() for m in llm_models.split(",")]` to `_StubUserSettings.__init__` so the stub matches the real `UserEffectiveSettings` field the resolver reads.
- **Re-open trigger:** any plan touching `sub_agent_models.py` or the 085 integration suite; or the Phase 096 verifier's baseline sweep.

## DI-096-01-A — Pre-existing gap: full-schema.sql is schema-only; greenfield bootstraps carry NO seed workflows

- **Found during:** 096-01 Task 3 (post-apply full-schema regeneration)
- **What:** the plan's acceptance criterion `grep -c "eval_coverage" supabase/full-schema.sql >= 1` is unsatisfiable by design — `scripts/regenerate-full-schema.sh` runs `pg_dump --schema-only` (line 95), so NO seed data rows ever land in the bootstrap artifact. Verified precedent: migration 061's seed slugs (`literature_review`, `doc_qa_human`) are equally absent from full-schema.sql today (grep -c = 0 for both).
- **Consequence:** a greenfield environment bootstrapped from `full-schema.sql` alone gets the schema but NONE of the seed workflows (061 templates, 065 fixes, 066 eval_coverage) nor the seed system user. Greenfield deploys must also replay the numbered migrations (which the Supabase CLI does anyway) or apply seed migrations manually.
- **Why not fixed here:** pre-existing characteristic of the deploy artifact since 061 — changing the dump to include data from selected tables is an architectural change to `regenerate-full-schema.sh` / the deploy story (Rule 4 territory), out of 096-01 scope.
- **Re-open trigger:** any phase building the greenfield/cloud deploy path, or the first time `full-schema.sql` is actually used to bootstrap an environment that needs the seed workflow templates.

## DI-096-06-A — Pre-existing bug: harness writes double-encoded jsonb (audit metadata / phase outputs stored as jsonb STRINGS)

- **Found during:** 096-06 Task 1 live dry-run (`--workflow --provider openai`, 2026-06-07)
- **What:** `harness_audit.metadata` is `jsonb_typeof = 'string'` for 386/386 live rows; `workflow_phases.output` is `'string'` for 95/99 rows (the 4 object rows came from a different write path). The writer double-encodes: the dict is JSON-serialized to a string and stored as a jsonb STRING scalar instead of a jsonb object, so direct SQL JSON operators (`metadata->>'phase'`, `output->'source_refs'`) return NULL on those rows.
- **Why not fixed here:** pre-existing backend behavior (not caused by this plan's changes); the fix lives in the shared harness write path (`write_audit` / phase-output persist — supabase-py insert serialization), which 096-06 must not touch. The eval script normalizes BOTH shapes via `CASE WHEN jsonb_typeof(...) = 'string' THEN (... #>> '{}')::jsonb ELSE ... END`, so it keeps working whether or not the writer is fixed.
- **Impact today:** app behavior is fine (these columns are read back through Python where the json-string round-trips); only direct SQL JSON-operator consumers are affected. `messages.tool_calls` rows ARE proper jsonb objects (different insert path) — the `/pending` queries are unaffected.
- **Suggested fix (whoever owns it):** pass dicts (not `json.dumps(...)` strings) on that insert path, or route it through the asyncpg pool's JSONB codec (D-073-06 — the 4 correct object rows prove the codec path works). Re-audit any direct-SQL consumers of these columns after.
- **Re-open trigger:** any plan touching `harness_engine.write_audit` / phase-output persistence, or any new SQL consumer of `harness_audit.metadata` / `workflow_phases.output`.
