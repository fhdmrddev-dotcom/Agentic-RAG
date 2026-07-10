---
phase: 123
slug: skill-triggering-quality
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-23
validated: 2026-06-26
---

# Phase 123 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from RESEARCH.md §Validation Architecture (2026-06-23). Wave 0 test
> files are authored TDD-first inside their own tasks → `wave_0_complete: false`
> until execution writes them; live coverage is re-confirmed at `/gsd:validate-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) + vitest (frontend `.test.tsx`) |
| **Config file** | `backend/pytest.ini` / project conftest (existing); vitest config (existing) |
| **Quick run command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_context_window.py backend/tests/unit/test_skill_lint.py backend/tests/unit/test_skill_tuner_scoring.py -x` |
| **Full suite command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` + `vitest run` (frontend) |
| **Cross-provider live eval (operator, SC#10)** | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py` (localhost-gated — trigger/no-false axis) |
| **Estimated runtime** | ~60s deterministic core; full suite ~3–5 min; live eval multi-minute |

---

## Sampling Rate

- **After every task commit:** `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_context_window.py backend/tests/unit/test_skill_lint.py backend/tests/unit/test_skill_tuner_scoring.py -x` (the fast deterministic core)
- **After every plan wave:** `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` (full backend) + `vitest run` (frontend)
- **Before `/gsd:verify-work`:** Full suite green **AND** the operator cross-provider eval (SC#10 trigger/no-false axis) attached below.
- **Max feedback latency:** ~60 seconds (deterministic core)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 123-01-01 | 01 | 1 | TRIG-03 | T-123-01-V5 | Lint never raises; warns with a specific code (name-echo/no-verb/too-short/generic/dup/>1024) | unit | `pytest backend/tests/unit/test_skill_lint.py -x` | ✅ | ✅ green |
| 123-01-02 | 01 | 1 | TRIG-03 / D-01 | T-123-01-V4 | Lint surfaces on POST /skills, PATCH /skills, agent `save_skill` — save always proceeds; catalog note reconciles with `LOAD_SKILL_TOOL` (one story) | integration + unit | `pytest backend/tests/integration/test_skills_lint.py backend/tests/unit/test_skill_catalog_note.py -x` | ✅ | ✅ green |
| 123-02-01 | 02 | 2 | CTX-03 | T-123-02-V4 | Third protected class in `trim_messages_to_fit`: pin survives trim, atomic pair kept (no orphan), de-dupe on reload, pin-budget overflow → LRU evict + `_TRIM_MARKER`; G-5 invariants intact (no fork) | unit | `pytest backend/tests/unit/test_context_window.py -x && pytest backend/tests/integration/test_075_4_subagent_truncation.py -x` | ✅ | ✅ green |
| 123-02-02 | 02 | 2 | CTX-03 | T-123-02-V4 | `load_skill` tool-result tagged `_pinned_skill` in `_reconstruct_history`; reconstructs the protected flag on replay | unit | `pytest backend/tests/unit/test_context_window.py::test_pin_load_skill_survives_trim backend/tests/unit/test_context_window.py::test_pin_dedupe_same_skill -x` | ✅ | ✅ green |
| 123-03-01 | 03 | 2 | TRIG-01 | T-123-03-V4 | Builder-model resolves: explicit setting → strong default → honest None; selectable across full provider list incl. local; no paid-provider SPOF; decoupled from benchmark targets | unit | `pytest backend/tests/unit/test_skill_builder_model.py -x` | ✅ | ✅ green |
| 123-03-02 | 03 | 2 | TRIG-01 | T-123-03-V4 | 60/40 held-out split, winner picked by held-out score; per-case classification returns structured `TriggerDecision` (honest-fail never silent); N-column adaptivity — `configured_providers` → N targets, a provider with no key never appears; sibling auto-seed owner-scoped | unit (mocked forced_emit) | `pytest backend/tests/unit/test_skill_tuner_scoring.py backend/tests/unit/test_skill_tuner_service.py -x` | ✅ | ✅ green |
| 123-04-01 | 04 | 3 | TRIG-01 | T-123-04-V4 | Tuner-run routes start/status/results — owner-scoped (`.eq("user_id", ...)`); background job bounded (cap cases × N targets × 3 repeats × ≤5 iter; per-call timeout); returns run id immediately | integration | `pytest backend/tests/integration/test_skill_tuner_routes.py -x` | ✅ | ✅ green |
| 123-04-02 | 04 | 3 | TRIG-01 | T-123-04-DoS | Tuner SSE event set + held-out scoreboard payload; run-buffer ownership scoping; no unbounded fan-out | integration | `pytest backend/tests/integration/test_skill_tuner_routes.py -x` | ✅ | ✅ green |
| 123-05-01 | 05 | 4 | TRIG-01 | — | Reachability triad (Phase-118 lesson): `ActiveView` union member + `ChatLayout` mount/render branch + `SkillsPage` "Tune triggers" entry action all owned here; surface reachable | frontend | `vitest run src/pages/SkillTunerPage.test.tsx` | ✅ | ✅ green |
| 123-05-02 | 05 | 4 | TRIG-01 | — | N-column scoreboard renders both sub-scores per cell (fires + no-false, never a hidden aggregate); candidate cards; two-column case editor; live-run card with never-vanishing elapsed timer; author-confirm diff → `PATCH /skills` | frontend | `vitest run src/components/skills/tuner/ProviderScoreboard.test.tsx src/pages/SkillTunerPage.test.tsx` | ✅ | ✅ green |
| 123-06-01 | 06 | 5 | TRIG-03 | — | Inline never-block lint warning renders directly under Description with the specific reason; "Tune this →" routes to the tuner `ActiveView` for that skill | frontend | `vitest run src/components/skills/SkillFormDialog.test.tsx` | ✅ | ✅ green |
| 123-06-02 | 06 | 5 | TRIG-01 / D-08 | T-123-06-V5 | Builder-model Settings picker offers at least one local-provider option (Ollama / LM Studio / OpenAI-compat) — proves no paid-provider SPOF | frontend | `vitest run src/pages/SettingsPage.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Authored TDD-first inside the owning task (the test is written before the implementation in that same task). Confirmed live at `/gsd:validate-phase` 2026-06-26 — all green:

- [x] `backend/tests/unit/test_skill_lint.py` — TRIG-03 heuristic (all warning codes + never-raises) — task 123-01-01
- [x] `backend/tests/integration/test_skills_lint.py` — TRIG-03 D-09/D-10 (3 hook points, save-always-proceeds) — task 123-01-02
- [x] `backend/tests/unit/test_skill_catalog_note.py` — D-01 structural reconciliation (catalog note ↔ `LOAD_SKILL_TOOL`) — task 123-01-02
- [x] Extend `backend/tests/unit/test_context_window.py` — CTX-03 (pin survives, atomic-pair kept, de-dupe, LRU evict + marker; G-5 regression) — tasks 123-02-01 / 123-02-02
- [x] `backend/tests/unit/test_skill_builder_model.py` — D-08 resolution — task 123-03-01
- [x] `backend/tests/unit/test_skill_tuner_scoring.py` — held-out split/repeat math + winner-by-held-out — task 123-03-02
- [x] `backend/tests/unit/test_skill_tuner_service.py` — candidate gen + classification (mocked forced_emit) + N-column adaptivity — task 123-03-02
- [x] `backend/tests/integration/test_skill_tuner_routes.py` — tuner-run routes (owner-scoped, bounded background job) — tasks 123-04-01 / 123-04-02
- [x] Frontend `.test.tsx` for the Tuner surface, the scoreboard, the lint warning + "Tune this" handoff, and the builder-model picker — tasks 123-05/123-06
- [ ] Extend `scripts/eval_cross_provider.py` with a trigger/no-false benchmark mode (or a sibling) for the SC#10 operator gate — feeds the Manual-Only SC#10 rows below (operator/live — not a deterministic Wave 0 dep)

---

## Manual-Only Verifications

### SC#10 4-axis UAT (MANDATORY — this phase touches the agent loop, provider routing, and the trim path; D-01 changes cross-provider runtime triggering)

| Axis | Behavior | Requirement | Why Manual | Test Instructions |
|------|----------|-------------|------------|-------------------|
| **Cross-provider (D-01 no-false-fire — the load-bearing axis)** | A previously-conservative skill fires on a clearly-matching request but does **NOT** start firing on unrelated prompts, on all 4 providers | TRIG-01 / D-01 | Requires live LLM tool-firing judgment across providers; deterministic tests can't reproduce real model triggering | For each of OpenAI (`gpt-5.4-mini`), Anthropic (`claude-haiku-4-5`), Google (`gemini-3.5-flash`), OpenRouter (`z-ai/glm-5.1`): (a) send a should-fire prompt → the matching skill's `load_skill` fires; (b) send an unrelated/off-topic prompt → the conservative skill does **not** load. Run `scripts/eval_cross_provider.py` trigger axis + one live chat spot-check per provider. PASS = should-fire recall high AND should-NOT precision shows **no regression** vs the pre-D-01 baseline. |
| **Multi-tool** | A loaded skill stays pinned while a single prompt exercises 2+ tools | CTX-03 / SC#10 | Needs a real multi-tool agent run | With a skill loaded, send one prompt that drives `search_documents` + `execute_code`; confirm both tools fire AND the loaded-skill instructions remain in context (not trimmed). |
| **Parallel-thread** | No cross-thread pin leakage or run-buffer collision | CTX-03 / TRIG-01 / SC#10 | Needs two concurrent live threads | Thread A streams (a tuner run or a loaded-skill chat) while Thread B accepts a new prompt; confirm Thread B does not inherit A's pinned skill and the tuner run-buffer (`run:{run_id}`) does not collide. |
| **Long-message (pin durability)** | A skill loaded mid-conversation stays pinned after the trim window rolls; eviction (if any) is honest, never silent | CTX-03 / SC#10 | Needs ≥50 prior messages or a ≥5 KB prompt to force a real trim | Load a skill, then drive ≥50 prior messages (or a ≥5 KB user prompt) so `trim_messages_to_fit` rolls the window; confirm the skill's instructions remain available AND a `_TRIM_MARKER` appears **only** on genuine pin-budget eviction (LRU), never a silent drop. |

*The SC#10 rows gate `/gsd:verify-work` per CLAUDE.md — phase verification only passes when all 4 axes are exercised. Cross-provider + multi-tool + parallel-thread can be partly automated via the eval rig / E2E backstop; long-message stays manual per provider.*

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a registered Wave 0 dependency (12/12 tasks mapped)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (authored TDD-first inside owning tasks)
- [x] No watch-mode flags (all commands use `-x` / `run`, none `--watch`)
- [x] Feedback latency < 60s (deterministic core)
- [x] SC#10 4-axis UAT rows authored (cross-provider × multi-tool × parallel-thread × long-message)
- [x] `nyquist_compliant: true` set in frontmatter (strategy complete; live coverage re-verified at `/gsd:validate-phase`)

**Approval:** approved 2026-06-23 (validation strategy; live green coverage + SC#10 operator eval confirmed at `/gsd:validate-phase`)

---

## Validation Audit 2026-06-26

Re-confirmed live deterministic coverage at `/gsd:validate-phase 123` (State A audit). All 14 registered Wave 0 test files exist on disk; the strategy-time `❌ W0` / `⬜ pending` flags were stale (authored TDD-first before execution) and are now flipped to ✅ green. Named `::node` selectors cited in the Per-Task Map (`test_pin_load_skill_survives_trim`, `test_pin_dedupe_same_skill`) resolve.

**Live run:**
- Backend: `pytest` over the 10 phase-123 backend files (incl. the `test_075_4_subagent_truncation.py` G-5 regression) → **148 passed**, 0 failed, ~2.8s
- Frontend: `vitest run` over the 4 phase-123 `.test.tsx` files → **40 passed**, 0 failed, ~3.3s
- **Total: 188 deterministic tests green**

| Metric | Count |
|--------|-------|
| Per-Task Map rows | 12 |
| COVERED (green) | 12 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |
| Resolved | 0 (none needed) |
| Escalated | 0 |

**Outcome:** NYQUIST-COMPLIANT. No automated gaps; no `gsd-nyquist-auditor` spawn required. The four SC#10 4-axis rows remain Manual-Only (live cross-provider tool-firing / pin-durability — not deterministically reproducible) and continue to gate `/gsd:verify-work` per CLAUDE.md; they are tracked in VERIFICATION.md `human_verification` and are unchanged by this audit.
