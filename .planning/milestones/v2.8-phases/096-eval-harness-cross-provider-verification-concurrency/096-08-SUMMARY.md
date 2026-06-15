---
phase: 096-eval-harness-cross-provider-verification-concurrency
plan: 08
subsystem: config
tags: [model-curation, providers, registry, model-capabilities, sub-agent-defaults, app-settings, psycopg2]

# Dependency graph
requires:
  - phase: 096-06
    provides: "eval workflow rows + the runs.model assertion that catches silent downgrades post-hoc (Pitfall 1 backstop)"
  - phase: 089-agent-loop-extraction
    provides: "native-7 provider matrix + D-089 live /models curation method (int'l hosts, case-sensitive IDs)"
provides:
  - "scripts/curate_models.py — repeatable live /models fetch + names-only diff across all 4 curation targets (CURATE_LIVE / CURATE_MISSING / CURATE_STALE / CURATE_DEFAULT / CURATE_SKIP)"
  - "MODEL_CAPABILITIES live-validated 2026-06-07: +gpt-5.5-pro/+gpt-5.4-pro/+gpt-5.2/+claude-opus-4-8/+claude-sonnet-4-5-20250929/+kimi-k2.5/+MiniMax-M3; -o3/-o4/-deepseek-chat/-deepseek-reasoner/-deepseek\\/deepseek-reasoner/-minimax\\/minimax-m2.5:free; gpt-5.5 timeout 600s"
  - "_SUB_AGENT_MODEL_DEFAULTS curated (the table harness eval rows actually use): minimax=MiniMax-M2.7-highspeed, zhipu=glm-5-turbo"
  - "eval PROVIDERS pinned to live IDs: anthropic=claude-haiku-4-5-20251001, zhipu=glm-5.1, minimax=MiniMax-M2.7-highspeed"
  - "app_settings.provider_model_lists newest-first with newest default across 8 providers (ollama untouched)"
affects: [096-verification, eval-cross-provider, harness-eval, settings-ui, BENCHMARKS-seed-063]

# Tech tracking
tech-stack:
  added: []
  patterns: ["live /models pass IS the curation — secondary sources are only expectations (D-05)", "names-only output discipline for any script touching provider keys", "dated provenance comments on every curated registry block"]

key-files:
  created:
    - scripts/curate_models.py
    - .planning/phases/096-eval-harness-cross-provider-verification-concurrency/096-08-curation-output.txt
  modified:
    - backend/app/config.py
    - scripts/eval_cross_provider.py

key-decisions:
  - "gpt-5.5 timeout 300s -> 600s flagship tier (Open Q4 resolved, operator-approved)"
  - "claude-haiku-4-5 alias NOT registered — live /models serves only the dated ID, so eval PROVIDERS pinned to claude-haiku-4-5-20251001 instead (live truth refuted the plan's alias hypothesis)"
  - "deepseek-chat/-reasoner REMOVED (not deprecation-flagged) — the announced 2026-07-24 deprecation was effected early; live /models serves only the v4 tier"
  - "Settings openai default = mainline gpt-5.5 (not gpt-5.5-pro-2026-04-23 dated/pro variants) — operator-approved"
  - "Sub-agent defaults stay fast/cheap tier (never flagship): minimax M2.7-highspeed, zhipu glm-5-turbo"
  - "app_settings.llm_model untouched at gpt-5.4-mini (operator-approved explicit non-change)"

patterns-established:
  - "CURATE_ greppable vocabulary: LIVE/MISSING/STALE/DEFAULT/SKIP — STALE is the case-sensitive silent-downgrade trap detector with target attribution"
  - "Post-apply re-run as acceptance: CURATE_STALE count must be 0 across all 4 targets after curation ships"

requirements-completed: [EVAL-01]

# Metrics
duration: ~2h 10m wall (includes operator-review checkpoint pause between Task 1 and approval)
completed: 2026-06-07
---

# Phase 096 Plan 08: D-05 Full-Registry Model Curation Summary

**Live /models-validated curation of all 4 model targets (MODEL_CAPABILITIES, _SUB_AGENT_MODEL_DEFAULTS, eval PROVIDERS, Settings available_models) — 7 flagships added with exact live IDs, 6 stale IDs removed, newest-first defaults, CURATE_STALE swept to 0**

## Performance

- **Duration:** ~2h 10m wall (Task 1 commit 03:18Z -> final code commit 05:28Z; includes the blocking operator-approval checkpoint)
- **Started:** 2026-06-07T03:18:47Z (Task 1 commit, prior executor)
- **Completed:** 2026-06-07T05:28:32Z
- **Tasks:** 3/3 (Task 1 prior executor; Tasks 2-3 this continuation after operator approval)
- **Files modified:** 4 (2 created, 2 modified) + 1 DB row (app_settings)

## Accomplishments

- **Task 1 (prior executor, 6fd1bfde):** `scripts/curate_models.py` hit all 8 live /models endpoints (names-only discipline — env-var names + model IDs, never key values), diffed against all 4 curation targets, and captured the authoritative live evidence to `096-08-curation-output.txt`. All 8 provider keys present; zero CURATE_SKIP.
- **Checkpoint (Task 3 gate):** full per-provider curation diff presented; operator replied "approved" for ALL of it, including the 4 flagged judgment calls (gpt-5.5 600s timeout; openai Settings default = mainline gpt-5.5; deepseek-chat/-reasoner removal; haiku alias -> dated ID in eval PROVIDERS).
- **Task 2 (this continuation, e6a50e24):** applied the approved diff verbatim to all 4 targets; every added ID cross-checked against Task 1's CURATE_LIVE output (zero assumed IDs); post-apply live re-run shows **CURATE_STALE count = 0** — the case-sensitive silent-downgrade trap is swept.

## Task Commits

1. **Task 1: curate_models.py — live /models fetch + 4-target diff** — `6fd1bfde` (feat)
2. **Tasks 2-3: apply operator-approved curation (config.py + eval PROVIDERS)** — `e6a50e24` (feat) — committed post-approval per the Task 3 gate
3. **Target 4 (app_settings)** — data change, not a commit; see "app_settings UPDATE (audit record)" below

Final plan commit set contains scripts/curate_models.py (6fd1bfde) + backend/app/config.py + scripts/eval_cross_provider.py (e6a50e24), satisfying the Task 3 acceptance criterion across the plan's commits.

## Curation Applied (per provider, names only)

| Provider | Added to registry | Removed/replaced | Sub-agent default | Settings default |
|---|---|---|---|---|
| openai | gpt-5.5-pro (900s), gpt-5.4-pro (900s), gpt-5.2 (600s) | o3, o4 removed; gpt-5.5 timeout 300s->600s | gpt-5.4-mini (unchanged) | gpt-5.5 |
| anthropic | claude-opus-4-8 (900s), claude-sonnet-4-5-20250929 (600s) | undated claude-sonnet-4-5 replaced by dated ID | claude-haiku-4-5-20251001 (unchanged) | claude-opus-4-8 |
| google | — (no registry change) | — | gemini-3.5-flash (unchanged) | gemini-3.5-flash |
| deepseek | — | deepseek-chat, deepseek-reasoner removed (2026-07-24 deprecation effected early) | deepseek-v4-flash (unchanged) | deepseek-v4-pro |
| moonshot | kimi-k2.5 (600s) | comment fix api.moonshot.cn -> api.moonshot.ai | kimi-k2.6 (unchanged) | kimi-k2.6 |
| zhipu | — (all 7 IDs re-validated live) | — | glm-4.6 -> **glm-5-turbo** | glm-5.1 |
| minimax | MiniMax-M3 (600s, exact PascalCase) | — | MiniMax-M2.5-highspeed -> **MiniMax-M2.7-highspeed** | MiniMax-M3 |
| openrouter | — | deepseek/deepseek-reasoner, minimax/minimax-m2.5:free removed (registry + Settings) | "" (unchanged — falls back to user model) | z-ai/glm-5.1 |

eval PROVIDERS (Deep-mode rows): anthropic -> claude-haiku-4-5-20251001, zhipu -> glm-5.1, minimax -> MiniMax-M2.7-highspeed (single hunk, only edit to the eval script). MODEL_CONTEXT_DEFAULTS rows added/renamed/removed to match (conservative published-size caps for new models).

## app_settings UPDATE (audit record — T-096-08-02)

Executed via psycopg2 against local Supabase (localhost:54322), constant SQL + params, after the live row was verified to use key `id = 'global'`:

```sql
UPDATE app_settings SET provider_model_lists = %s::jsonb, updated_at = now() WHERE id = 'global'
```

The single `%s` parameter was the full approved JSON object (9 provider lists, first item = default):

- openai: gpt-5.5, gpt-5.5-pro, gpt-5.4, gpt-5.4-pro, gpt-5.4-mini, gpt-5.4-nano, gpt-5.2, gpt-5, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini, o1
- anthropic: claude-opus-4-8, claude-opus-4-7, claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5-20251001, claude-sonnet-4-5-20250929
- google: gemini-3.5-flash, gemini-3.1-pro-preview, gemini-3.1-flash-lite, gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite
- deepseek: deepseek-v4-pro, deepseek-v4-flash
- moonshot: kimi-k2.6, kimi-k2.5, moonshot-v1-8k
- zhipu: glm-5.1, glm-5, glm-5-turbo, glm-4.7, glm-4.6, glm-4.5-air
- minimax: MiniMax-M3, MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-M2.5-highspeed
- openrouter: prior list minus deepseek/deepseek-reasoner and minimax/minimax-m2.5:free (12 entries, z-ai/glm-5.1 first)
- ollama: unchanged (7 entries)

**Post-write verification:** rowcount = 1; re-SELECT confirmed the stored JSONB equals the approved lists exactly; `llm_model` remains `gpt-5.4-mini` (approved non-change); `updated_at` = 2026-06-07T05:27:42Z.

## Verification Results

| Check | Result |
|---|---|
| config.py imports clean (`MODEL_CAPABILITIES`, `_SUB_AGENT_MODEL_DEFAULTS`, `MODEL_CONTEXT_DEFAULTS`) | PASS — 55 capability rows, 9 defaults, 54 context rows |
| `pytest tests -q -k "config or capabilities"` | 14 passed pre-edit baseline, 14 passed post-edit — net-new failures 0 |
| `py_compile scripts/eval_cross_provider.py` | PASS |
| `grep -c "api.moonshot.cn" backend/app/config.py` | 0 (stale comment fixed) |
| `grep -c "2026-06-07" backend/app/config.py` | 27 (dated provenance on every touched block) |
| eval script diff hunk count | exactly 1 (PROVIDERS constant only, 3 lines) |
| Every added ID in Task-1 CURATE_LIVE | PASS — gpt-5.5-pro, gpt-5.4-pro, gpt-5.2, claude-opus-4-8, claude-sonnet-4-5-20250929, kimi-k2.5, MiniMax-M3 all present in 096-08-curation-output.txt |
| Post-apply live re-run: CURATE_STALE | **0** across all 4 targets (silent-downgrade trap swept) |
| Post-apply CURATE_DEFAULT | sub-agent defaults intentionally fast/cheap tier, not live-newest (per plan: never flagship in sub-agent default) |

Note on the "DEPRECATED 2026-07-24" acceptance grep: the criterion was conditional — flag IF live still serves those IDs, "else removal with comment". Live /models no longer serves deepseek-chat/-reasoner, so the removal branch applies; the dated removal comment in config.py records the 2026-07-24 deprecation being effected early.

## Decisions Made

- **Open Q4 resolved:** gpt-5.5 at 300s was drift; bumped to the 600s flagship tier (operator-approved at checkpoint).
- **Live truth over plan hypothesis:** the plan expected registering a `claude-haiku-4-5` alias row; live /models showed the alias is NOT served, so the eval PROVIDERS entry was pinned to the dated ID instead and no alias row was added.
- **deepseek-chat/-reasoner removed, not flagged:** live list already dropped them ahead of the announced 2026-07-24 date — the conditional acceptance criterion's removal branch.
- **Settings openai default = mainline gpt-5.5**, not the dated gpt-5.5-pro-2026-04-23 (operator-approved — mainline over pro/dated variants for the chat default).
- **app_settings.llm_model untouched** at gpt-5.4-mini (explicit operator-approved non-change).

## Deviations from Plan

None - plan executed exactly as written (Task 2's expected actions were hypotheses; the live CURATE_ output adjudicated each one per the plan's own "driven ONLY by Task 1's live output" rule, with the operator approving the resulting diff at the Task 3 gate).

## Authentication Gates

None — all 8 provider keys were present in backend/.env; zero CURATE_SKIP lines.

## Checkpoint Record

- **Type:** checkpoint:human-verify (Task 3, blocking gate)
- **Paused:** after Task 1 (commit 6fd1bfde) with the full per-provider curation diff (names only)
- **Operator response:** "approved" — all tables including the 4 flagged judgment calls
- **Resumed:** continuation executor applied the diff verbatim, verified, committed e6a50e24

## Known Stubs

None — config data + script changes only; no UI components or placeholder data paths introduced.

## Threat Flags

None — no security surface beyond the plan's threat model. T-096-08-01 (names-only output) held across script, checkpoint, and this SUMMARY; T-096-08-02 satisfied by the parameterized localhost-only UPDATE recorded above; T-096-08-03 satisfied (zero assumed IDs); T-096-08-04 satisfied (operator approved before commit; Plan 06 runs.model assertion is the post-hoc backstop).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Note: backend uvicorn picks up the new app_settings row on its normal settings read path; no restart-required code change shipped (config.py changes apply on next backend start, which the operator controls).

## Next Phase Readiness

- The defaults table the harness eval depends on (Pitfall 1) is now curated truth — Plan 06 eval rows will exercise MiniMax-M2.7-highspeed and glm-5-turbo as effective sub-agent models.
- `scripts/curate_models.py` is a repeatable curation tool for future model-onboarding passes (SEED-063 BENCHMARKS feed, D-08 new-model onboarding seed).
- Phase 096 verification can assert CURATE_STALE = 0 as a standing invariant.

## Self-Check: PASSED

All claimed files exist (curate_models.py, config.py, eval_cross_provider.py, 096-08-curation-output.txt, this SUMMARY); commits 6fd1bfde and e6a50e24 verified in git log.

---
*Phase: 096-eval-harness-cross-provider-verification-concurrency*
*Completed: 2026-06-07*
