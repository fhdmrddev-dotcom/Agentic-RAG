---
phase: 143
slug: starter-workflow-library-stretch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 143 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `143-RESEARCH.md` § Validation Architecture. This is a seed/content + one
> additive shelf + a fresh-copy fork phase — NOT a streaming/agent-loop change, so the
> SC#10 4-axis UAT does NOT apply (no provider routing / run-state touched).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest (`backend/tests/unit`, `backend/tests/integration`) |
| **Frontend framework** | Vitest + Testing Library (`*.test.tsx`; note ~14–17 pre-existing rot tests — baseline-fail at HEAD, ignore per SEED-056) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` (existing) |
| **Backend quick run** | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_starter_workflows.py -x` |
| **Frontend quick run** | `cd frontend && npx vitest run src/pages/WorkflowsPage.test.tsx` |
| **Full backend suite** | `backend/venv/Scripts/python.exe -m pytest backend/tests -q` |
| **Estimated runtime** | quick ~5–15 s · full backend ~2–4 min |

---

## Sampling Rate

- **After every task commit:** the relevant quick-run (`pytest -x` for the touched db/route test; `vitest run WorkflowsPage.test.tsx` for the shelf/fork).
- **After every plan wave:** full backend unit + integration for `workflows`; frontend `WorkflowsPage` + `WorkspacePanel` (regression check for the shared-helper de-dupe, Pitfall 3).
- **Before `/gsd:verify-work`:** full suite green + the SC-d manual UAT (all 3 starters fork → bind KB → run → produce a `.docx`).
- **Max feedback latency:** ~15 s (quick) / ~4 min (wave merge).

---

## Per-Task Verification Map

| SC / Req | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC-a / WF-01 | `list_starter_workflows` returns ONLY curated globals (`is_global=true AND definition->>'category'='starter'`), NOT the 5 mig-061 scaffolds | T-143 V4 | Starters query returns only world-readable published globals — no private leak | unit (db) | `pytest backend/tests/unit/test_starter_workflows.py::test_starters_query_excludes_scaffolds -x` | ❌ Wave 0 | ⬜ pending |
| SC-b / WF-01 | `list_published_workflows(owned_only=true)` → `created_by=me` only (no global double-render); **default** still returns `is_global OR mine` (picker/run-soul/threads.py unchanged) | T-143 (Pitfall 3) | Scoped narrow narrows-not-widens; default byte-identical | unit (db) | `pytest backend/tests/unit/test_starter_workflows.py::test_published_owned_only_and_default -x` | ❌ Wave 0 | ⬜ pending |
| SC-c / WF-01 | Fresh-copy fork mints new suffixed slug + v1 + `is_global=false` + `created_by=caller`; opens Builder; does NOT mutate the published starter | T-143 V4 | Fork = fresh INSERT (owner-safe); frozen starter never UPDATEd | frontend unit + manual | `npx vitest run src/pages/WorkflowsPage.test.tsx` | ⚠️ extend | ⬜ pending |
| SC-c (backend) / WF-01 | `POST /workflows` forces `is_global=false`/`draft`/`created_by`; 409 on slug/version collision | T-143 V4/V5 | create route already owner-binds server-side | integration | `pytest backend/tests/integration/test_workflows_routes.py -k fork -x` | ⚠️ extend | ⬜ pending |
| Endpoint / WF-01 | `GET /workflows/starters` returns the 3 seeded rows; `GET /workflows/published?scope=mine` narrows | T-143 V4 | owner-scoped read; constant JSONB literal (no injection) | integration | `pytest backend/tests/integration/test_workflows_routes.py -k "starters or scope" -x` | ❌ Wave 0 | ⬜ pending |
| SC-e / WF-01 | Shelf order Starters → Published → Drafts (published/starters no longer buried under drafts — folds BUG-260628-01) | — | — | frontend unit + manual | `npx vitest run src/pages/WorkflowsPage.test.tsx` (assert section order) | ⚠️ extend | ⬜ pending |
| SC-d / WF-01 | Each of the 3 seeded starters runs end-to-end KB→document against a populated KB; strict citations gate satisfied | T-143 (Pitfall 1/2, A1) | re-homed seed-user template resolves for a non-operator forker; no private-Storage dependency | **manual UAT** | operator: fork → bind KB with content → Run → verify `.docx` output + citations (D-143-4a, seeds bypass gauntlet by construction) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_starter_workflows.py` — covers SC-a, SC-b (`list_starter_workflows`; `owned_only` param default-off symmetry).
- [ ] `backend/tests/integration/test_workflows_routes.py` additions — `GET /workflows/starters`, `?scope=mine`, fork 409.
- [ ] `frontend/src/pages/WorkflowsPage.test.tsx` additions — Starters shelf render, `onUseStarter` fork (new slug + v1, no starter mutation), section order.

*Existing pytest + vitest infrastructure covers everything else — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each of the 3 starters forks + runs to a real `.docx` (A1: re-homed seed-user template resolves for a non-operator account) | WF-01 (SC-d) | Seeds bypass the 8-stage publish gauntlet by construction (D-143-4a) — there is no user/KB to golden-run against at seed time; the honest check is a real fork+run | For each starter: (1) fork via "Use this starter" → confirm a new owned draft opens in the Builder; (2) bind a KB folder that HAS matching content (PM demo corpus for Risk Register / Weekly Status; author a small compliance corpus for Compliance Gap Report); (3) Publish the fork through its own gauntlet, then Run; (4) confirm a `.docx` output file is produced and opens clean, with citations present; (5) confirm the published starter row is unchanged. Ideally run at least one fork from a **non-operator** account to validate A1 (service-role Storage read across users). |
| Empty-KB honesty | WF-01 (Pitfall 2) | Strict-gate failure is correct behavior, not a bug | Fork a starter, run against an empty/mismatched KB → confirm the run fails with a "no supporting evidence" citation gap (D-143-7 strict), not a silent/fabricated output. |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency (SC-d is legitimately manual per D-143-4a)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files
- [ ] No watch-mode flags (`vitest run`, `pytest -x` — one-shot)
- [ ] Feedback latency < 15s (quick) / < 4min (wave)
- [ ] `nyquist_compliant: true` set in frontmatter (flip when Wave 0 files land)

**Approval:** pending
