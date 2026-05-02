---
id: SEED-002
status: dormant
planted: 2026-05-02
planted_during: v2.5 (Phase 059 complete — SSE Architecture Refactor)
trigger_when: planning a milestone scoped to "Skills" / "Skill Studio" / "Eval" / v3.0 / v3.1 — or any milestone that extends the existing skills system, agent tools, or sub-agent service
scope: Large
---

# SEED-002: Skill Studio Milestone Preparation

## Why This Matters

The next major milestone after v2.5 is targeted at **Skill Studio** (see `PRD_Skill_Studio.md`) — an iterative skill development & evaluation environment. Multiple loose ends from v2.x intersect with this milestone in ways that are easy to miss if approached cold:

1. **Test infrastructure debt blocks the entry point.** The PRD explicitly says "All new agent tools are covered by integration tests following the pattern in `tests/integration/test_skills.py` and `tests/integration/test_threads_skills.py`." But 13 tests in `test_threads_skills.py` and 3 tests in `test_skills_import_export.py` are currently broken (pre-existing, surfaced during Phase 059 plan-02 verification). Starting Skill Studio on top of this means new tests get patched onto a broken patch model. Should be repaired BEFORE the milestone starts (or as Phase 1 of the milestone).

2. **MIME fidelity gap intersects PRD Open Question #3.** `import_skill` currently stores all skill files as `application/octet-stream` — round-trip works but MIME is lost. PRD Open Question #3 asks how eval runs handle file outputs (skills that generate files vs text). These problems share a root: skill-file content-type handling is incomplete. Solving one well likely solves both.

3. **Skills tab redesign was deferred TO this milestone.** PROJECT.md notes "Skills: align-only, full redesign deferred to Skill Studio milestone." The PRD adds a new Evals panel as an *addition* to the existing Skills tab — it does not address whether the broader redesign happens at the same time. Worth confirming scope upfront so Evals UI work isn't done twice (once on the old tab, once on the new).

4. **SKILL-01/02 (catalog full-inject) collides with PRD Open Question #2.** Existing tech debt: the skill catalog is injected in full into every agent context (no lazy loading). PRD Open Question #2 asks whether `run_skill_eval` should inject only the target skill's instructions or the full catalog. Decision can't be made cleanly without resolving the underlying catalog-injection-cost question first. They're the same architectural decision wearing two hats.

5. **Phase 059's pattern is a clean template for dual-execution evals.** The new `agent_runner` background producer + `asyncio.Queue` + `EventSourceResponse(ping=15)` consumer pattern in `backend/app/api/threads.py` is exactly the shape `run_skill_eval` needs — sequential or parallel, the queue can support either with minor consumer changes. The `_drive_sse_until_disconnect` ASGI test driver added by 059's CR-03 fix in `backend/tests/integration/test_059_disconnect.py` (lines 117-209) is also reusable for Skill Studio's SSE eval-event tests. Don't reinvent these.

## When to Surface

**Trigger:** planning a milestone scoped to "Skills" / "Skill Studio" / "Eval" / v3.0 / v3.1 — or any milestone that extends the existing skills system, agent tools, or sub-agent service

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone version is v3.0 or v3.1
- Milestone name or description contains "Skill", "Skills", "Eval", or "Studio"
- Milestone touches `backend/app/services/skill_service.py`, `backend/app/api/skills.py`, `backend/app/services/sub_agent_service.py`, or `frontend/src/components/Skills/`
- Milestone references `PRD_Skill_Studio.md`

## Scope Estimate

**Large** — A full milestone of work as designed in `PRD_Skill_Studio.md`:
- 2 new Supabase tables (eval_cases, eval_runs) with RLS + migration
- 3 new agent tools (`run_skill_eval`, `list_skill_evals`, `store_eval_feedback`) wired into `openai_service.py` tool dispatch loop and `threads.py` execution path
- New SSE event types for dual-run progress streaming
- New Evals panel in Skills tab (frontend) — design-system aligned, no new state libs
- Updated skill-creator seed skill instructions (DB row update)
- Integration test coverage following the existing pattern

PLUS the prep work this seed flags:
- Skills test infrastructure repair (small phase, blocks entry)
- MIME fidelity decision (resolve alongside file-output handling)
- Skills tab redesign scope confirmation (decide upfront)
- Catalog-injection cost decision (resolve alongside PRD Open Question #2)

## Breadcrumbs

**The PRD itself:**
- `PRD_Skill_Studio.md` — full requirements (332 lines, status: Draft, target v3.1)

**Test debt blocking entry:**
- `backend/tests/integration/test_threads_skills.py` — 13 tests broken (patch `create_streaming_chat` instead of `create_adaptive_streaming_chat`)
- `backend/tests/integration/test_skills_import_export.py` — 3 export tests broken (pre-existing)
- `.planning/phases/059-sse-architecture-refactor/deferred-items.md` — full failure list documented during 059-02 verification

**Existing skills code to extend (per PRD § "What Does NOT Need to Change"):**
- `backend/app/api/skills.py` — CRUD endpoints (no changes needed)
- `backend/app/services/skill_service.py` — core skill logic
- `backend/app/services/sub_agent_service.py` — extend or parallel for eval execution (PRD Open Question #1)
- `backend/app/services/openai_service.py` — tool definitions to extend
- `backend/app/api/threads.py` — tool dispatch loop + new event emit sites
- `backend/supabase/migrations/` — next number is 033
- `frontend/src/components/Skills/` — Evals panel addition
- `frontend/src/hooks/` — useX patterns for new eval hooks

**Reusable patterns from Phase 059:**
- `backend/app/api/threads.py:520-1856` — `agent_runner` producer + `asyncio.Queue` + `event_consumer` consumer + shielded persist + CancelledError raise. Template for dual-execution `run_skill_eval` runs.
- `backend/tests/integration/test_059_disconnect.py:117-209` — `_drive_sse_until_disconnect` real ASGI driver. Reusable for any SSE event test in Skill Studio.

**Project memory pointers (persistent across sessions):**
- `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_skills_mime_known_gap.md` — MIME fidelity gap details
- `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_settings_design_guidance.md` — Skills tab redesign deferral note

**Tech debt entries in PROJECT.md:**
- SKILL-01/02 — catalog still full-inject, deferred to Skills Studio
- Human UAT gaps for Phases 45, 46, 48 (not all skills-related but worth checking before milestone planning)

## Notes

**Suggested entry plan when this seed surfaces:**

1. Run `/gsd:new-milestone` with v3.0 or v3.1 as the version, scope = "Skill Studio: iterative skill development & evaluation"
2. As Phase 1 (or 0) of the milestone: skills test infrastructure repair — fix the 13+ broken patches, restore green test foundation. Estimated 1-2 hours.
3. As Phase 2: resolve the four upfront design questions before any code:
   - MIME fidelity (intersects PRD Open Question #3)
   - Skills tab redesign scope (full vs Evals-panel-only)
   - Catalog injection strategy (intersects PRD Open Question #2)
   - Sub-agent service extension vs parallel (PRD Open Question #1)
4. Then proceed with the PRD's component dependency order: tables → tools → SSE events → frontend panel → updated seed skill.

**Why a small repair phase first instead of bundling into Phase 1 of Skill Studio:**
The repair work touches the same files Skill Studio will be modifying heavily (`test_threads_skills.py`, etc.). Doing it as standalone scope means Skill Studio commits don't get tangled with maintenance commits — cleaner blame, cleaner PR history, easier to verify the maintenance work in isolation.

**v2.5 context at planting time:**
- v2.5 milestone scoped to phases 058-062 (SSE concurrency + reconnect stability)
- Phases 058 (cross-tab unblock) and 059 (SSE architecture refactor) shipped 2026-05-01 / 2026-05-02
- Phases 060 (frontend race fixes), 061 (reconnect handlers), 062 (validation harness) still pending
- CONCUR-01 and CONCUR-02 closed; STREAM-02 still open scoped to 060-062
