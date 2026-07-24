---
phase: 182
slug: server-validation-seam
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 182 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `182-RESEARCH.md` → `## Validation Architecture`. The Per-Task
> Verification Map is filled by the planner once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (+ `pytest-asyncio` for `async def` tests) + Starlette `TestClient` |
| **Config file** | `backend/tests/conftest.py` (central `app.dependency_overrides` for `get_current_user`/`get_supabase`; `reset_mocks` autouse fixture) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_182_validate.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Live-DB gate** | psycopg2 module-level `skipif` on `POSTGRES_DSN` (`127.0.0.1:54322`) — the `test_workflows_routes.py` precedent |
| **Estimated runtime** | ~1–2s for the verdict unit set (no DB); full suite ~minutes |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/unit/test_182_validate.py -x` (the verdict unit set — sub-second, no DB)
- **After every plan wave:** Run `pytest tests/unit/test_103_*.py tests/test_revert_byte_identical.py tests/test_181_flip_on.py tests/test_181_off_audience.py -q` (extraction-regression + gate + canary-repoint — the anti-drift + revert backstops)
- **Before `/gsd:verify-work`:** Full `backend` suite must be green (esp. the untouched NL-gen tests proving zero-behavior-change)
- **Max feedback latency:** < 5 seconds for the per-task verdict set
- **No SC#10:** no streaming/provider/UI path — this is a backend static seam

---

## Per-Task Verification Map

> Filled by the planner. One row per task, mapped to the requirement / SC and a threat ref.
> Skeleton derived from the research test map below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | VALID-01 | — | — | unit | `pytest tests/unit/test_182_validate.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Research test map (source for the planner)

| Req / SC | Behavior | Test Type | File |
|----------|----------|-----------|------|
| SC#1 / VALID-01 | each lint code surfaces as a verdict (bad_index, orphan, unsatisfiable_skip, no_terminal, input_unsatisfied) | unit | `tests/unit/test_182_validate.py -k lint` |
| SC#1 | grounding-fidelity verdicts (unregistered tool / skill_ref / folder ⊄ subtree) | unit (mock supabase) | `... -k grounding` (mirror `test_103_grounding_fidelity.py`) |
| SC#1 | business_requirement-missing + interactive_phase verdicts | unit | `... -k static_gauntlet` |
| SC#2 | `GET /grounding-bundle` returns server-sourced tools/folders/skills (never a constant) | unit + live | `... -k bundle` |
| SC#2 (anti-drift INVARIANT) | extraction preserves NL-gen behavior — `_assemble_grounding` returns the SAME `(prompt, tool_names, skill_ids)` tuple | regression | re-run `test_103_nl_generate.py` + `test_103_grounding_fidelity.py` UNCHANGED |
| SC#3 | `POST /validate` + `GET /grounding-bundle` 404 (never 403) when flag off — operator AND user AND pre-auth | integration | repoint `test_revert_byte_identical.py` onto real routes |
| SC#3 | 200 when flag on | integration | repoint `test_181_flip_on.py` onto `GET /grounding-bundle` |
| SC#4 | every verdict maps to `phase == slug`; workflow-global findings carry `phase: null` | unit | `... -k per_node_keying` |
| SC#4 | severity classification (error vs incomplete) incl. `no_terminal` empty-vs-cycle split | unit | `... -k severity` |
| D-182-04 | canary gone: `/canvas/ping` is an unbuilt 404; `import canvas_canary` removed | regression | grep/import guard; both repointed test files green |

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_182_validate.py` — every verdict code + severity + per-node keying + `ok` semantics (mock `get_supabase`; monkeypatch the shared grounding module like `test_103_grounding_fidelity.py`)
- [ ] `backend/tests/test_182_grounding_bundle.py` — `GET /grounding-bundle` shape + `require_canvas` 404-when-off (live-DB skip-guarded for the real read)
- [ ] `backend/tests/test_182_extraction_parity.py` (or reuse existing 103 tests as the guard) — assert `_assemble_grounding` output is byte-identical post-extraction; assert `grounding.py` is the ONE source (no second grounding definition). **Guard the COUNT** of existing NL-gen tests so a silently-dropped test is caught (the 177 coverage-loss lesson)
- [ ] Repoint (not new): `test_revert_byte_identical.py` + `test_181_flip_on.py` off `/canvas/ping` onto the real routes
- [ ] Framework install: none — pytest/asyncio/TestClient already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real grounding-bundle content (live folder tree + enabled skills) | VALID-01 / SC#2 | Depends on live Supabase KB state | `GET /workflows/grounding-bundle` with a real session; confirm folders/skills/tools reflect the DB |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
