---
phase: 140-smart-dispatch-relevance-pre-filter-stretch
plan: 04
subsystem: api / agent hot-path (skill-catalog injection)
tags: [TRIG-02, smart-dispatch, pre-filter, agent_loop, pgvector, embeddings, D-06, D-05, Blocker-1, fail-open, run_in_threadpool]

# Dependency graph
requires:
  - phase: 140-01 (migration 091)
    provides: "match_skills(query_embedding, match_user_id, p_embedding_model) cosine RPC + skill_catalog_max_tokens budget column (NOT yet applied to live DB — [BLOCKING] Plan 05)"
  - phase: 140-02 (skill_embedding_service)
    provides: "kick_skill_backfill fire-and-forget self-heal primitive (Blocker-1)"
  - phase: 140-03 (skill_catalog_filter)
    provides: "resolve_skill_catalog_budget / build_skill_catalog_block / _recently_loaded_skill_names / _block (the pure DB-free contracts + the fits-budget gate helper)"
  - phase: 133 (EVAL-02)
    provides: "skill_catalog_override seam (None=live / ()=empty / tuple=eval arms) — the D-06 boundary the pre-filter slots into"
provides:
  - "the LIVE smart-dispatch pre-filter on the agent hot path: budget gate → threadpool embed → match_skills rank → build_skill_catalog_block trim, inside the override-None branch ONLY"
  - "fits-budget fast path with ZERO embed call (byte-identical to pre-140 Deep Mode — Pitfall 1)"
  - "Blocker-1 self-heal: fire-and-forget kick_skill_backfill for in-scope NULL-similarity skills"
  - "D-05 fail-open: any embed/RPC failure => sim_by_id=None => inject-all-up-to-budget, never crash/empty"
  - "verified D-02 load_skill-by-name escape hatch (menu-absent enabled skill still loads by exact name)"
affects: [140-05 (BLOCKING live-DB apply + real vector backfill unlocks the over-budget ranking end-to-end), verify-work SC#10 cross-provider UAT]

# Tech tracking
tech-stack:
  added: []   # zero new packages (T-140-SC accept) — reuses embed_texts, pgvector RPC, run_in_threadpool
  patterns:
    - "pre-filter strictly inside `if skill_catalog_override is None:`; eval-tuple branch keeps its OWN byte-identical assembly (D-06 hard fence)"
    - "budget-gate FIRST via the pure fn's own `_block` builder so 'we embedded' and 'it trimmed' can never diverge (Pitfall 1)"
    - "embed via run_in_threadpool (SEED-065 / D-v2.5-01); RPC via aexec; build_skill_catalog_block runs OUTSIDE the fail-open try/except (it is None-safe)"

key-files:
  created:
    - backend/tests/integration/test_140_escape_hatch.py
  modified:
    - backend/app/services/agent_loop.py
    - backend/tests/test_agent_loop_catalog_override.py

key-decisions:
  - "Restructured the shared `if enabled_skills:` catalog block into a per-override-branch assembly (Option C): the None branch owns the full pre-filter; the else/tuple branch keeps the OLD catalog_lines/catalog_note verbatim. The `else: enabled_skills = list(...)` line and the shared final `active_system_prompt += catalog_note` are untouched. This is the only way to keep the embed/rank/kick STRICTLY off the tuple path while preserving byte-identical tuple output."
  - "Reused the private `skill_catalog_filter._block` as the fits-budget gate (aliased `_skill_catalog_block`) rather than re-deriving the full-block string in agent_loop — guarantees the embed-gate matches build_skill_catalog_block's internal gate byte-for-byte (no divergence)."
  - "Base seam-test user_settings pins `skill_catalog_max_tokens = 0` (inject-all kill switch): a MagicMock would coerce via int() to 1 and spuriously trip the over-budget path in the pre-140 D-06 tests."

requirements-completed: [TRIG-02]

# Metrics
duration: ~50min
completed: 2026-07-07
tasks: 2
files: 3
---

# Phase 140 Plan 04: Smart-Dispatch Pre-Filter Hot-Path Wiring Summary

**The Plan 01 RPC + Plan 02 self-heal + Plan 03 pure trim fn become LIVE agent behavior: the relevance pre-filter is wired STRICTLY inside the `skill_catalog_override is None` branch of `agent_loop.py`'s catalog injection — fits budget => byte-identical fast path with zero embed (Pitfall 1); over budget => threadpool `embed_texts` + `match_skills` rank + `build_skill_catalog_block` trim, with a fire-and-forget `kick_skill_backfill` self-heal for NULL-similarity skills (Blocker-1) and D-05 fail-open on any embed/RPC failure — while the eval-tuple branch + Deep Mode stay byte-identical (D-06), and the `load_skill`-by-name escape hatch is verified (not rebuilt).**

## Performance
- **Duration:** ~50 min
- **Completed:** 2026-07-07
- **Tasks:** 2 (Task 1 RED→GREEN per-task TDD; Task 2 verification test)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

### Task 1 — pre-filter wiring (agent_loop.py) + extended seam tests
- Added imports: `embed_texts` (openai_service), `estimate_tokens` (context_window), `resolve_skill_catalog_budget` / `build_skill_catalog_block` / `_recently_loaded_skill_names` / `_block as _skill_catalog_block` (skill_catalog_filter), `kick_skill_backfill` (skill_embedding_service).
- The override-None `skills` query now `.select("id, name, description")` (was `name, description`) — the RPC + pin set key on **id** (SEED-102 name-collision-safe). Scope/order unchanged (owner+global enabled, name-ordered).
- Wiring, all STRICTLY inside `if skill_catalog_override is None:` → `if enabled_skills:`:
  1. `budget = resolve_skill_catalog_budget(user_settings)` (D-04; 0/disable = inject-all).
  2. `pinned_recent_ids` from `_recently_loaded_skill_names(history_resp.data)` mapped names→ids (D-02 always-keep).
  3. **Budget gate FIRST** (Pitfall 1): `_full_block = _skill_catalog_block(sorted(enabled_skills, name))`; only if `budget > 0 and estimate_tokens(_full_block, llm_model) > budget` do we embed. The fits path makes **zero** embed/RPC/kick calls.
  4. Over-budget `try`: `q_vec = (await run_in_threadpool(embed_texts, [body.content], user_settings=...))[0]` → `match_skills` RPC (via `aexec`) with `p_embedding_model` (D-10 stale guard) + `match_user_id` (V4 scope) → `sim_by_id = {r["id"]: r["similarity"] ...}` → `_stale_ids` (in-scope skills with `None` sim) → `kick_skill_backfill(..., only_skill_ids=_stale_ids)` fire-and-forget (Blocker-1).
  5. `except Exception` → `logger.warning(..., exc_info=True)`, `sim_by_id = None` (D-05 fail-open).
  6. `catalog_note = build_skill_catalog_block(enabled_skills, budget, llm_model, pinned_recent_ids, sim_by_id)` — runs OUTSIDE the try/except (None-safe), so the note is ALWAYS emitted.
- The `else` (eval-tuple) branch keeps its original `catalog_lines`/`catalog_note` assembly verbatim; the shared `active_system_prompt += catalog_note` is unchanged. **No embed/rank/kick can reach the tuple path.**
- Extended `test_agent_loop_catalog_override.py` (+6 tests) reusing the `_capture_system_prompt` harness: fits-budget byte-identical + zero-embed, over-budget least-relevant-cut + marker, fail-open on embed error, self-heal-kick fires only for NULL-sim ids, raising-kick doesn't propagate, and tuple-branch-never-embeds/ranks/kicks. Existing `test_deep_mode_unchanged` / `()` / `(skill,)` stay green.

### Task 2 — escape hatch verified (test_140_escape_hatch.py)
- `test_load_skill_by_name_bypasses_catalog`: an enabled skill ABSENT from the (trimmed) injected menu still loads by exact name via `_handle_load_skill` (keys on name + is_enabled, catalog-independent) — SC#3 half 2. `_handle_load_skill` is **not modified**.
- `test_load_skill_still_404s_when_truly_absent`: control — the hatch is name+is_enabled scoped, not an enablement bypass.

## Task Commits
1. **Task 1 (test — RED gate):** `72448803` — extended catalog-override seam (6 pre-filter cases)
2. **Task 1 (feat — GREEN gate):** `786ae5ef` — pre-filter wired into the override-None branch
3. **Task 2 (test):** `049d90d6` — load_skill-by-name escape-hatch verification

## Verification
- `pytest tests/test_agent_loop_catalog_override.py tests/integration/test_140_escape_hatch.py` → **11 passed**.
- `pytest tests/test_140_catalog_trim.py tests/integration/test_140_skill_embedding_service.py tests/test_load_skill_collision.py tests/test_load_skill_override.py tests/unit/test_skill_catalog_note.py` (regression) → **42 passed** (combined with the above).
- greps confirm `build_skill_catalog_block` + `run_in_threadpool(embed_texts` + `kick_skill_backfill` present in `agent_loop.py`.
- `files_modified` excludes `backend/app/api/threads.py` (G-5) and `tool_dispatcher.py` (escape hatch verified, not rebuilt) — confirmed unchanged via `git status`.

## Migration-not-applied handling (deferred to [BLOCKING] Plan 05)
Migration 091 (`skill_embeddings` table + `match_skills` RPC + `skill_catalog_max_tokens` column) is **NOT yet applied to the live DB** (operator-gated Plan 05). Accordingly:
- **Every test in this plan is MOCK-level** and passes now: the over-budget seam tests mock `embed_texts`, the `match_skills` RPC (via a supabase-`rpc` side_effect), and `kick_skill_backfill`; `test_140_escape_hatch.py` exercises only the `skills` table (which exists today), never `skill_embeddings`.
- **No test in this plan is EXPECTED-RED** — none depends on the not-yet-applied migration. The real end-to-end over-budget ranking (genuine query vector → live `match_skills` cosine → real `skill_embeddings` vectors) is unlocked by Plan 05's live-DB apply + vector backfill, and is exercised there / in the SC#10 cross-provider UAT.
- At runtime **today** (migration unapplied): the `match_skills` RPC does not exist, so the over-budget branch's `aexec(supabase.rpc(...))` would raise → caught by the D-05 fail-open `except` → `sim_by_id=None` → inject-all-up-to-budget by name. i.e. the feature degrades cleanly to today's behavior until Plan 05 lands (no crash, no starvation).

## Deviations from Plan

### Structural (within-discretion)
**1. [Design] Restructured the shared `if enabled_skills:` block into per-override-branch assembly (Option C).**
- **Why:** The plan's hard acceptance — "pre-filter strictly inside `if skill_catalog_override is None:`; the tuple branch never embeds, ranks, or kicks" — cannot be met while the note-assembly is a single block shared by both override branches (routing the tuple's id-less rows through the pre-filter risks a `KeyError` on `s["id"]` under a tiny eval budget, and could embed on the tuple path). So the None branch now owns its full pre-filter + `build_skill_catalog_block` call, and the `else` branch keeps the OLD `catalog_lines`/`catalog_note` assembly verbatim.
- **What stayed byte-identical:** the `else: enabled_skills = list(skill_catalog_override)` line, the tuple branch's emitted note, and the shared trailing `active_system_prompt += catalog_note`. The memory-injection + disabled-tools blocks below are untouched.
- **Proof:** `test_with_arm_injects_only_target`, `test_without_arm_injects_nothing`, `test_deep_mode_unchanged`, and the new `test_prefilter_tuple_branch_never_embeds_or_kicks` all green.
- **Commit:** `786ae5ef`.

**2. [Rule 3 - test-harness fix] Base seam-test user_settings needed a real budget value.**
- **Found during:** Task 1 GREEN — `test_deep_mode_unchanged` started 500-ing.
- **Issue:** the seam harness builds `user_settings` as a `MagicMock`; `resolve_skill_catalog_budget` does `int(getattr(s, "skill_catalog_max_tokens", 1500))`, and `int(MagicMock())` coerces to **1** (MagicMock implements `__int__`) — spuriously tripping the over-budget branch and calling `embed_texts` with a MagicMock base_url (crash).
- **Fix:** pin `s.skill_catalog_max_tokens = 0` (the inject-all kill switch) + `s.embedding_model` on the base `_make_user_settings()` so the pre-140 D-06 seam tests stay byte-identical with zero embed. The pre-filter budget tests set their own real int via `_make_prefilter_settings`.
- **Files modified:** `backend/tests/test_agent_loop_catalog_override.py` (test-only). **Commit:** `72448803`.

## Deferred Issues (out of scope — logged, not fixed)
Regression sweep of `run_agent_loop`-driving suites surfaced **8 pre-existing baseline failures** (test_forced_emit, test_dual_mode_wiring, test_explorer_agent send_message cases). Verified they fail **identically against the pre-140-04 `agent_loop.py`** (root cause = `User-message INSERT did not return id` mock rot in `send_message`, upstream of the pre-filter). Logged to `deferred-items.md`; NOT caused by this plan, NOT fixed here.

## Threat surface
No new security surface beyond the plan's `<threat_model>`. T-140-07 (cross-user leak) — the `match_skills` scope + fail-open inject only this user's `enabled_skills` set; T-140-08 (DoS) — embed only on the over-budget branch, threadpool-wrapped, fail-open, fire-and-forget kick; T-140-09 (eval seam) — pre-filter strictly in the None branch, tuple byte-identical. Zero new packages (T-140-SC). No threat flags.

## Known Stubs
None. All logic is real. The over-budget ranking depends on Plan 05's live-DB migration + vector backfill (documented above as deferred, degrades cleanly to fail-open until then) — not a stub, a phased data-population dependency.

## Self-Check: PASSED
- FOUND: `backend/app/services/agent_loop.py`
- FOUND: `backend/tests/test_agent_loop_catalog_override.py`
- FOUND: `backend/tests/integration/test_140_escape_hatch.py`
- FOUND commit: `72448803` (Task 1 test)
- FOUND commit: `786ae5ef` (Task 1 feat)
- FOUND commit: `049d90d6` (Task 2 test)
- G-5 honored: `git status` confirms `backend/app/api/threads.py` and `tool_dispatcher.py` unchanged.

---
*Phase: 140-smart-dispatch-relevance-pre-filter-stretch*
*Completed: 2026-07-07*
