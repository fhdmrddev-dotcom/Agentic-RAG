---
phase: 136
slug: skill-publish-gate-gate-01
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
updated: 2026-07-03
---

# Phase 136 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, venv) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_publish_gate.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` · `cd frontend && npm run test --run` |
| **Estimated runtime** | ~60 seconds (backend) |

---

## Sampling Rate

- **After every task commit:** Run the touched behavior's quick command (backend `pytest -k`, frontend `npm run test -- <name>`)
- **After every plan wave:** Run full backend suite + `npm run test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> One row per task, derived from the Validation Architecture in 136-RESEARCH.md.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 136-01 | 1 | GATE-01 | — | Wave 0 test scaffold + shared `_FilterSupabase` fixtures (11 named stubs) | test-scaffold | `pytest tests/test_publish_gate.py --collect-only -q` | ❌ creates | ⬜ pending |
| 01-T2 | 136-01 | 1 | GATE-01 | T-136-04 | Migration 084 applied live; append-only + owner-only-SELECT RLS, no write policies (D-11) | migration | `psycopg2 to_regclass('public.skill_publish_overrides')` non-null | ❌ creates | ⬜ pending |
| 01-T3 | 136-01 | 1 | GATE-01 | T-136-05, T-136-07 | compute_publish_gate: D-03 numeric rule + D-04 content-equality (edit resets, promoted near-dup counts, interrupted excluded) | unit (service) | `pytest tests/test_publish_gate.py -k "gate_unmet or gate_met_after or edit_after_pass or promoted_near_dup or interrupted" -x -q` | ❌ (01-T1) | ⬜ pending |
| 02-T1 | 136-02 | 2 | GATE-01 | T-136-02, T-136-03, T-136-04, T-136-06 | Gated toggle (409 + gate payload / override → recorded row) + GET publish-gate; server is the gate (D-07/D-01) | unit (API) | `pytest tests/test_publish_gate.py -k "toggle_global_blocked or toggle_global_allowed or force_publish_records or unshare_never_gated" -x -q` | ❌ (01-T1) | ⬜ pending |
| 02-T2 | 136-02 | 2 | GATE-01 | T-136-01 | create_skill hard-sets is_global=false (D-08); import/save_skill stay private; reshare re-gates (D-09) | unit (API) | `pytest tests/test_publish_gate.py -q` (all 11) | ❌ (01-T1) | ⬜ pending |
| 03-T1 | 136-03 | 2 | GATE-01 | T-136-03 | PublishGate type + getPublishGate + override-capable toggle + hook passthrough (no client gate math) | typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.json` | ✅ (types/api/hook) | ⬜ pending |
| 03-T2 | 136-03 | 2 | GATE-01 | T-136-06 | PublishGateDialog renders server gate status (met X/N vs honest unmet + force) — D-05 | component | `cd frontend && npm run test -- PublishGateDialog --run` | ❌ creates | ⬜ pending |
| 03-T3 | 136-03 | 2 | GATE-01 | T-136-06 | SkillCard intercept: share→dialog, unshare→direct ungated (D-07) | typecheck + component | `cd frontend && npx tsc --noEmit && npm run test -- SkillCard --run` | ✅ (SkillCard) | ⬜ pending |
| 04-T1 | 136-04 | 3 | GATE-01 | T-136-03, T-136-04 | SkillEvalSection gate-status line + owner-visible override record from getPublishGate (D-06/D-02) | component | `cd frontend && npm run test -- SkillEvalSection --run` | ❌ creates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_publish_gate.py` — created in Plan 01 Task 1: `_FilterSupabase` in-memory store (tables skills / skill_versions / eval_runs / skill_publish_overrides, `.order().limit()` support), `_seed` helper (incl two-equal-instructions-versions for the D-04 near-dup case), `_override`/`_clear_overrides` dependency overrides, and 11 named `@pytest.mark.skip` stubs covering GATE-01 SC#1/2/3 + D-01/D-03/D-04/D-08/D-09.
- [ ] `frontend/src/components/skills/PublishGateDialog.test.tsx` — created in Plan 03 Task 2 (met + unmet-never_evaled branches, `vi.mock("@/lib/api")`).
- [ ] `frontend/src/components/skills/SkillEvalSection.test.tsx` — created in Plan 04 Task 1 (met + unmet + last_override branches, `vi.mock("@/lib/api")`).
- [ ] Framework install: none — pytest + vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| G-4 lived UAT — publish dialog UNMET path (share a never-evaled skill → blocked with honest status + evidence + Force-publish affordance; override succeeds) | GATE-01 (D-01/D-05) | User-visible dialog UX; lived-experience bar per G-4 | In the live app, on a private never-evaled skill click "Share globally" → confirm the dialog shows the honest unmet status + a pointer to run an eval + a Force-publish action; Force-publish → the skill goes global |
| G-4 lived UAT — publish dialog MET path (run a passing eval on the current version → share succeeds showing satisfied X/N) | GATE-01 (D-05/D-02) | Requires a real passing eval run + live dialog | Run an eval that passes on the skill's current instructions → click "Share globally" → confirm the dialog shows "Eval passed X/N on the current version" + Publish → skill goes global |
| G-4 lived UAT — unshare never gated + re-share re-gates | GATE-01 (D-07/D-09) | Lived toggle-both-ways | Unshare a global skill (no dialog, immediate) → re-share while the current version is unmet → confirm the gate blocks again (no grandfathering) |
| G-4 lived UAT — SkillEvalSection gate-status line + override record | GATE-01 (D-06/D-02) | Rendered inside the large eval surface; visual/lived | Open the skill's eval section → confirm the publish-readiness line reflects the current gate state; after a force-publish, confirm the "published without a passing eval" override record shows |

*Not SC#10-flagged (D-10): no streaming/agent-loop/provider surface — a single-provider lived pass on the dialog is the bar; NO cross-provider matrix.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (backend test module + 2 frontend test files)
- [x] No watch-mode flags (all frontend commands use `--run`)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-signed 2026-07-03 (execution pending)
