---
phase: 099
slug: workflow-skill-composition
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 099 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `099-RESEARCH.md` → `## Validation Architecture`. UAT rows live HERE, not in PLAN.md tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, `venv`) — `[VERIFIED: backend/tests/ has 098 + harness suites]` |
| **Config file** | none — tests live under `backend/tests/`; pytest run from the backend venv |
| **Quick run command** | `cd backend && .\venv\Scripts\python -m pytest tests/test_099_skill_composition.py -x` |
| **Full suite command** | `cd backend && .\venv\Scripts\python -m pytest tests/ -q` |
| **Estimated runtime** | quick ~3s (offline fixtures) · full suite ~30s (baseline 81/81 green per Phase 098 close) |

**Offline-first convention** (from `test_098_scope_governance.py:23-25`): unit tests use conftest fakes (`_FakeRedis`, `make_tool_context`, `fake_redis`, `mock_asyncpg_pool`) — no live Redis/Postgres. The snapshot-materialize test adds a faked Storage download/upload recorder modeled on the conftest `_FakeRedis` XADD recorder. The cross-provider round-trip is LIVE UAT (manual, per D-12).

---

## Sampling Rate

- **After every task commit:** Run `cd backend && .\venv\Scripts\python -m pytest tests/test_099_skill_composition.py -x`
- **After every plan wave:** Run `cd backend && .\venv\Scripts\python -m pytest tests/ -q` (full suite must stay green — baseline 81/81 + the new 099 file)
- **Before `/gsd-verify-work`:** Full suite green AND the representative-4 cross-provider UAT (manual table below) all PASS
- **Max feedback latency:** 30 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 099-01-01 | 01 | 0 | WFSKILL-01 | — | Wave 0 — author 8 unit-test stubs (xfail until impl lands) | unit | `pytest tests/test_099_skill_composition.py -x` | ❌ → ✅ (this task creates it) | ⬜ pending |
| 099-01-02 | 01 | 0 | WFSKILL-01 | T-099-04 (injected JSONB key) | `extra="forbid"` rejects unknown keys; old published rows still `model_validate()` | unit | `pytest tests/test_099_skill_composition.py::test_skill_ref_additive_optional -x` | ✅ W0 | ⬜ pending |
| 099-01-03 | 01 | 0 | WFSKILL-01 | T-099-05 (Deep red-line breach) | `ToolContext.skill_snapshot` defaults `None` → Deep dispatch byte-identical | unit | `pytest tests/test_099_skill_composition.py::test_toolcontext_field_default_none -x` | ✅ W0 | ⬜ pending |
| 099-02-01 | 02 | 1 | WFSKILL-01 | — | Skill block composes at `system_prompt =` seam (3 executors); `llm_single` omits file list (D-07); `""` no-op when no snapshot | unit | `pytest tests/test_099_skill_composition.py::test_skill_block_compose -x` | ✅ W0 | ⬜ pending |
| 099-02-02 | 02 | 1 | WFSKILL-01 | T-099-02 (IDOR via skill_ref) | `read_skill_file` auto-whitelisted on BOTH layers when snapshot present; inert on `llm_single`; snapshot ctx attached at `_build_phase_tool_context` | unit | `pytest tests/test_099_skill_composition.py::test_auto_whitelist -x` | ✅ W0 | ⬜ pending |
| 099-03-01 | 03 | 1 | WFSKILL-01 | T-099-05 (Deep red-line breach) | Gated branch: `ctx.skill_snapshot is None` → live path byte-identical (SC#3); present → snapshot routing | unit | `pytest tests/test_099_skill_composition.py::test_deep_noop -x` + `::test_snapshot_routing -x` | ✅ W0 | ⬜ pending |
| 099-03-02 | 03 | 1 | WFSKILL-01 | T-099-01/02/03 (resurrect / IDOR / private-skill) | Publish gate raises `ValueError` on missing / not-visible / disabled skill (D-10); materializer copies instructions→JSONB + Storage-copies files; idempotent | unit (faked Storage) | `pytest tests/test_099_skill_composition.py::test_publish_gate_rejects -x` + `::test_snapshot_materialize -x` + `::test_snapshot_immune_to_live_edit -x` | ✅ W0 | ⬜ pending |
| 099-04-01 | 04 | 2 | WFSKILL-01 | T-099-01/02/03 | `threads.py` one-line kickoff call: validate → materialize-if-needed; `ValueError → 400`; first-run snapshot then deterministic | unit | `pytest tests/test_099_skill_composition.py::test_kickoff_snapshot_wiring -x` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/test_099_skill_composition.py` — the 9 unit-test stubs covering SC#1 / SC#2 / SC#3 (Plan 01 Task 1 creates this file). Tests for not-yet-implemented behavior are marked `@pytest.mark.xfail(reason=..., strict=False)` so the full suite stays exit-0 during execution (the 098 cross-plan TDD convention, `test_098_scope_governance.py:14-21`).
- [x] Conftest fixtures: reuse the existing `_FakeRedis` (`conftest.py:551`) / `make_tool_context` (`:621`) / `fake_redis` (`:615`) / `mock_asyncpg_pool` (`:507`) — no new shared fixtures needed.
- [x] Faked Storage recorder for `test_snapshot_materialize` — a local `_FakeStorage` download/upload recorder defined IN `test_099_skill_composition.py` (modeled on the conftest `_FakeRedis` XADD recorder), not in conftest (single-test use).
- [x] Framework install: none — pytest + venv already in place.

Test → SC mapping (all 9 stubs):
| Test | SC | Behavior |
|------|----|----|
| `test_skill_ref_additive_optional` | SC#1 | `skill_ref` parses on all 3 LLM configs; a pre-099 published row still `model_validate()`s |
| `test_toolcontext_field_default_none` | SC#3 | `ToolContext.skill_snapshot` defaults `None` |
| `test_skill_block_compose` | SC#1 | skill block at the seam in all 3 executors; `llm_single` omits file list; `""` when absent |
| `test_auto_whitelist` | SC#1 | `read_skill_file` ∈ both whitelist layers when present; inert on `llm_single`; snapshot ctx attached |
| `test_deep_noop` | SC#3 | `_handle_read_skill_file` byte-identical when `ctx.skill_snapshot is None` |
| `test_snapshot_routing` | SC#3 | gated branch routes to snapshot prefix when context present |
| `test_publish_gate_rejects` | SC#2 | gate raises `ValueError` on missing / not-visible / disabled skill |
| `test_snapshot_materialize` | SC#2 | instructions→JSONB + Storage file copy; run reads snapshot not live skill |
| `test_snapshot_immune_to_live_edit` | SC#2 | mutating the live skill after snapshot does not change the snapshot read |
| `test_kickoff_snapshot_wiring` | SC#2 | kickoff calls validate + materialize-if-needed; `ValueError → 400` |

---

## Manual-Only Verifications

> Authored per D-12 (representative-4) + CLAUDE.md SC#10 4-axis bandwidth. These rows run LIVE against `http://localhost:5173/` (test login `fhdmrd@gmail.com` / `123456`) at phase verification. The Deep byte-identical SC#3 proof is automated (`test_deep_noop`) AND re-confirmed live (row L5 below).

**Pre-req fixture:** a published workflow whose `llm_agent` phase carries a `skill_ref` to a real, enabled, owned skill that has ≥ 1 attached file (re-use a `_099uat` fixture skill + a small `.md` reference file). Run it once to materialize the snapshot (first-kickoff), then mutate/delete the live skill to prove immutability (row L6).

| ID | Axis | Behavior | Requirement | Why Manual | Test Instructions |
|----|------|----------|-------------|------------|-------------------|
| L1 | Cross-provider (OpenAI) | Skill instructions compose into the phase framing AND `read_skill_file` round-trips from the snapshot | WFSKILL-01 / SC#1 | Live LLM call; provider-agnostic string append proven per provider | Set thread model to an OpenAI model; run the skill-bearing workflow; confirm the phase output reflects the skill's instructions and the run log shows a `read_skill_file` call returning the snapshot file's contents |
| L2 | Cross-provider (Anthropic) | same as L1 | WFSKILL-01 / SC#1 | Live LLM call | Set model to an Anthropic model; repeat L1 |
| L3 | Cross-provider (Google) | same as L1 | WFSKILL-01 / SC#1 | Live LLM call | Set model to a Google model; repeat L1 |
| L4 | Cross-provider (OpenRouter) | same as L1 | WFSKILL-01 / SC#1 | Live LLM call | Set model to an OpenRouter model; repeat L1 |
| L5 | Multi-tool | A skill-bearing phase uses `read_skill_file` (auto-whitelisted) + `search_documents` in ONE phase | WFSKILL-01 / SC#1 | 2+ tools in one prompt | Author the phase prompt to both read the skill file AND search the project KB; confirm both tool calls fire and both results inform the output |
| L6 | Parallel-thread | Thread A runs the skill-bearing workflow phase while Thread B accepts a new Deep prompt | WFSKILL-01 / SC#3 | Two live threads; asserts no cross-thread snapshot/whitelist bleed | Start the workflow in Thread A; while it streams, send a Deep prompt in Thread B that calls `load_skill` + `read_skill_file`; confirm Thread B's Deep behavior is normal (live skill, NOT the snapshot) and Thread A's whitelist did not leak into Thread B |
| L7 | Long-message | A skill with long instructions (≥ 5 KB) composes into the framing without truncation; the phase still completes | WFSKILL-01 / SC#1 | Long-context manual probe | Use a `_099uat` skill whose `instructions` ≥ 5 KB; run the workflow; confirm the phase completes and the output reflects late-in-the-instructions content (proves no truncation) |
| L8 | Deep red-line (SC#3 live) | Deep-mode `load_skill` + `read_skill_file` is byte-identical to a pre-099 baseline across the representative-4 | WFSKILL-01 / SC#3 | Live SSE diff vs baseline capture | In a Deep thread (no workflow), call `load_skill` + `read_skill_file` on a real skill across OpenAI/Anthropic/Google/OpenRouter; the returned file bytes + SSE stream must match a pre-099 baseline (every touched path is a literal no-op outside workflows) |
| L9 | Immutability (SC#2 live) | Editing/deleting the live skill after first-kickoff does NOT change a subsequent run | WFSKILL-01 / SC#2 | Requires a real publish→run→mutate sequence | After L1 materializes the snapshot, edit the skill's instructions (and delete one attached file) via the Skills UI; re-run the SAME published workflow; confirm the phase still uses the ORIGINAL snapshotted instructions + the deleted file is still readable from the snapshot copy |
| L10 | Publish-gate (SC#2 live) | A `skill_ref` to a disabled / deleted / non-visible skill is refused with a 400 at kickoff (never silent) | WFSKILL-01 / SC#2 | Live error-path probe | Disable the referenced skill, then kick off the workflow; confirm a 400 with a descriptive message (gate fired) — NOT a silent run on a resurrected skill |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task maps to a `test_099_skill_composition.py::test_*`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the new test file + the `_FakeStorage` recorder)
- [x] No watch-mode flags (all commands are single-run `-x` / `-q`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-10
