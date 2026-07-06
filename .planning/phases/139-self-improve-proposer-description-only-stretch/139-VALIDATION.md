---
phase: 139
slug: self-improve-proposer-description-only-stretch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 139 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `139-RESEARCH.md § Validation Architecture`. Requirement: **SI-02**.
> Carries **SC#10** (cross-provider) and **G-4** (lived-experience UAT) — see the 4-axis
> bandwidth and G-4 scenarios below.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 9.0.2 (`backend/pytest.ini`), asyncio tests |
| **Framework (frontend)** | vitest (existing; SEED-056 pre-existing rot — new tests must pass at HEAD) |
| **Backend test dir** | `backend/tests/` (`unit/`, `integration/`) |
| **Sibling tests to mirror** | `tests/test_skill_proposals_router.py`, `tests/test_skill_proposals.py`, `tests/integration/test_skill_tuner_routes.py`, `tests/unit/test_skill_tuner_service.py` |
| **Quick run command** | `cd backend && ./venv/Scripts/python -m pytest tests/integration/test_139_description_proposals.py -x -q` |
| **Full suite command** | `cd backend && ./venv/Scripts/python -m pytest -q` |
| **Frontend command** | `cd frontend && npm run test -- --run src/components/skills/studio/` |
| **Estimated runtime** | ~30–60 seconds (integration subset); full backend suite longer |

---

## Sampling Rate

- **After every task commit:** `cd backend && ./venv/Scripts/python -m pytest tests/integration/test_139_description_proposals.py -x -q`
- **After every plan wave:** `cd backend && ./venv/Scripts/python -m pytest -q` + `cd frontend && npm run test -- --run`
- **Before `/gsd:verify-work`:** Full backend suite green + the 4-axis UAT (below) driven live.
- **Max feedback latency:** ~60 seconds (integration subset)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are requirement-level and map 1:1 to SI-02
> behaviors. The planner MUST attach each to a concrete `<automated>` command and a task ID.

| # | Requirement | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|-------------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| V1 | SI-02 | Propose a description draft (`kind='description'`) from a Tuner winner; NEVER auto-publish, NEVER edit the live description | T-139 owner-scope | Draft row only; `skills.description` unchanged until approve | integration | `pytest tests/integration/test_139_description_proposals.py::test_propose_creates_draft_no_live_write -x` | ❌ W0 | ⬜ pending |
| V2 | SI-02 | Baseline wins → refuse to propose (honest-by-construction, D-02) | — | 400 "nothing to propose"; zero rows | integration | `pytest .../test_139_description_proposals.py::test_baseline_winner_refuses_propose -x` | ❌ W0 | ⬜ pending |
| V3 | SI-02 | Approve → `skills.description` written + new immutable version + `status='promoted'` | T-139 owner-scope | Only owner can approve; one version captured | integration | `pytest .../test_139_description_proposals.py::test_approve_writes_desc_and_version -x` | ❌ W0 | ⬜ pending |
| V4 | SI-02 | Reject → nothing changes (pure audit flip, `new_skill_version_id` NULL) | — | No description/version mutation | integration | `pytest .../test_139_description_proposals.py::test_reject_is_pure_audit -x` | ❌ W0 | ⬜ pending |
| V5 | SI-02 | Cross-user 404-not-403 on propose/approve/reject (IDOR) | T-139 IDOR (V4) | 404 masks existence for non-owner | integration | `pytest .../test_139_description_proposals.py::test_cross_user_404 -x` | ❌ W0 | ⬜ pending |
| V6 | SI-02 | Migration 090: `kind`-gated CHECK rejects `kind='description'` row with NULL `proposed_description`; `proposed_instructions` relaxed to nullable | — | DB CHECK is second gate | unit/DB | `pytest tests/test_139_migration_090.py::test_kind_check_constraint -x` (requires migration applied to live DB) | ❌ W0 | ⬜ pending |
| V7 | SI-02 | Frontend: baseline-winner card shows "nothing to propose"; rewrite-winner shows "Propose this description" | — | Honest affordance gating | frontend unit | `npm run test -- --run src/components/skills/studio/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_139_description_proposals.py` — propose / approve / reject / cross-user-404 (mirror `test_skill_proposals_router.py`)
- [ ] `backend/tests/test_139_migration_090.py` — `kind`-gated CHECK + nullable `proposed_instructions` (requires migration 090 applied to the live local DB via SQL editor / psycopg2 :54322 — NEVER `db push`)
- [ ] `frontend/src/components/skills/studio/*.test.tsx` — description-proposal card (baseline-wins vs rewrite-winner branches)
- [ ] Shared fixtures: reuse existing `conftest` skill/user fixtures + the tuner-scoreboard fixture from `test_skill_tuner_service.py`

*Framework already installed — no install step.*

---

## Manual-Only Verifications — 4-Axis UAT (D-12 / SC#10) + G-4

> Driven live via Chrome MCP + psycopg2 :54322. Each row is an observable pass/fail (what the DB / UI
> shows), not a subjective check. **Fresh page load per provider/context** (HMR keeps stale React
> modules — a known false-fail source).

| Axis | Behavior | Why Manual | PASS condition | FAIL condition |
|------|----------|------------|----------------|----------------|
| **Cross-provider (≥2 providers)** | Tuner beats baseline on the held-out per-provider scoreboard on both providers → Propose → Approve | Needs ≥2 live provider keys + real Tuner run | `skill_proposals.scoreboard_snapshot` has ≥2 provider cells; promoted `skills.description == proposed_description`; new `skill_versions` row | snapshot <2 columns, or a provider-specific fork in the diff |
| **Honest baseline-wins** | Tuner on a skill whose current description already wins (`winner.is_baseline=true`) | Needs a real held-out benchmark | UI shows "already running the best description", NO "Propose" affordance; forced `POST .../proposals` → 400; zero proposal rows | a proposal with `proposed_description == base`, or an empty diff, is created |
| **Parallel-thread isolation** | Propose+approve on skill A while a Tuner run streams on skill B (or a chat thread streams) | Concurrency, live streams | Skill A proposal/version/description correct; skill B run completes; no `scoreboard_snapshot` bleed; no event-loop stall | either operation blocks/corrupts the other |
| **Long-history** | Propose+approve on a skill with many prior `skill_versions` + `skill_proposals` | Needs seeded history | `base_skill_version_id` = true latest; `new_skill_version_id = MAX(version_number)+1`; card renders without perf regression | wrong base version, version-number collision (23505), or slow render |
| **G-4 — approve** | Approve → live description visibly updates AND exactly ONE new version appears in Versions tab | User-visible UI | one version, not two (Pitfall 2 guard) | two versions, or description not updated |
| **G-4 — reject** | Reject → card dismisses, live description unchanged, no version added | User-visible UI | description unchanged, no new version | any mutation |
| **G-4 — snapshot immutability** | Re-run Tuner after proposing (before approving) | User-visible UI | the PENDING proposal's scoreboard does NOT change (Pitfall 1 guard) | pending scoreboard mutates on Tuner re-run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] 4-axis UAT (cross-provider, honest-baseline-wins, parallel-thread, long-history) authored + drivable
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
