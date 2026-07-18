---
phase: 148-governance-audit-users-feature-visibility
plan: 05
subsystem: backend-api-governance
tags: [VIS-01, feature-visibility, require_visible, GET-features, run-carveouts, security-wall]
requires:
  - phase: 148-02
    provides: "require_visible(feature) 403-not-404 gate factory + feature_audience resolver + _GOVERNED_FEATURES cold-default map"
  - phase: 146
    provides: "operator_service.is_operator (the ONE swappable audience boundary)"
provides:
  - "GET /features — authenticated per-user effective feature->bool map (operator all-True; end user only Everyone-audience features); NOT operator-gated"
  - "require_visible('skill_studio') on evals.py (router + router_evals), skill_tuner.py, skill_test_cases.py — every endpoint gated (router-level)"
  - "require_visible('model_management') on settings.py GET/PUT ''/reembed (per-endpoint); GET /settings/providers left ungated (Run carve-out)"
  - "require_visible('workflow_authoring') on workflows.py create/drafts/patch/delete/publish/generate (per-endpoint); GET /published+/starters ungated; threads.py launch untouched"
  - "require_visible('governance_health') on document_governance.py (router-level, every endpoint); knowledge_health.py left ungated (A4)"
affects:
  - "148-07 (frontend useEffectiveFeatures consumes GET /features; nav vanish + graceful 403 bounce)"
  - "148-06 (operator admin endpoints; the visibility-set PUT flips these gates' audience at runtime)"
tech-stack:
  added: []   # zero new packages
  patterns:
    - "router-level require_visible for no-carve-out governed routers (safe-by-construction; mirrors require_operator) — per-endpoint decorator dependencies=[] only where a Run carve-out must stay ungated"
    - "GET /features derives the UI-hide map from the SAME is_operator + feature_audience seams the gate uses, so the hide and the API refusal can never disagree"
key-files:
  created:
    - backend/app/api/features.py
  modified:
    - backend/app/main.py
    - backend/app/api/evals.py
    - backend/app/api/skill_tuner.py
    - backend/app/api/skill_test_cases.py
    - backend/app/api/settings.py
    - backend/app/api/workflows.py
    - backend/app/api/document_governance.py
key-decisions:
  - "Router-level require_visible for the four no-carve-out governed routers (evals both, skill_tuner, skill_test_cases, document_governance) — guarantees EVERY endpoint is gated (the plan's primary requirement) and a future endpoint cannot forget it; per-endpoint only on settings.py/workflows.py where router-gating would 403 the Run carve-outs (RESEARCH anti-pattern is scoped to exactly those two files)."
  - "Skipped requirements.mark-complete for VIS-01 — the API enforcement wall is done, but VIS-01's frontend hide/bounce half (148-07) is unshipped; marking now would be a false green. Completes at phase verify-work (148-02/148-04 substrate precedent)."
patterns-established:
  - "Run carve-outs left ungated + annotated with a DO-NOT-GATE comment (GET /settings/providers, GET /workflows/published|starters) so a future editor can't self-inflict an end-user outage."
requirements-completed: []   # VIS-01 deferred to phase verify-work (frontend half in 148-07)
duration: ~30min
completed: 2026-07-11
---

# Phase 148 Plan 05: VIS-01 API Enforcement Wall (GET /features + require_visible) Summary

**One-liner:** The server-side security wall for feature visibility — a tiny authenticated `GET /features` effective-map endpoint plus `require_visible(feature)` gates wired across the six governed routers (Skill Studio, model-management, workflow authoring, governance-health), with the three hard Run carve-outs (chat model picker, workflow published/starters, the threads.py launch) left ungated so end-user chat/run never breaks.

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **`GET /features`** (new `backend/app/api/features.py`, mounted top-level in `main.py`): returns `{"features": {feature: (operator OR audience=="everyone")}}` over the four governed keys. Authed via `get_current_user`, deliberately NOT operator-gated — a non-operator reaches it (200) to learn their own map. Derives the map from the SAME `is_operator` + `feature_audience` seams the gate uses, so the UI hide (148-07) and the API refusal can never disagree.
- **`require_visible('skill_studio')`** gates every endpoint of `evals.py` (both `router` and `router_evals`), `skill_tuner.py`, and `skill_test_cases.py` — attached at the router level (safe-by-construction).
- **`require_visible('model_management')`** gates `settings.py` `GET ""`, `PUT ""`, `GET /reembed-progress`, `POST /reembed` per-endpoint; **`GET /settings/providers` left ungated** (chat model picker Run carve-out).
- **`require_visible('workflow_authoring')`** gates `workflows.py` create/drafts/patch/delete/publish/generate per-endpoint; **`GET /published` + `GET /starters` left ungated** (Run picker feeds); **`threads.py` untouched** (the workflow launch stays for everyone — D-05).
- **`require_visible('governance_health')`** gates every endpoint of `document_governance.py` (router level); `knowledge_health.py` "Library Health" left ungated (A4).

## Task Commits

Each task was committed atomically:

1. **Task 1: GET /features effective-map endpoint + main.py mount** — `a1e3668c` (feat)
2. **Task 2: require_visible on Skill Studio + model_management routers (providers carve-out)** — `3eb6f84f` (feat)
3. **Task 3: require_visible on workflows (authoring, Run carve-out) + governance_health** — `b6b1eea1` (feat)

_Task 1 was `tdd="true"`; the RED target (`test_148_effective_features.py`) existed from the Wave-0 scaffold, so this was a single GREEN feat commit against it (no separate test commit — the failing test was already authored upstream)._

## Files Created/Modified

- `backend/app/api/features.py` (created) — the authenticated per-user `GET /features` effective-map router; `get_effective_features` maps over `_GOVERNED_FEATURES` via `is_operator` + `feature_audience`.
- `backend/app/main.py` — import + `include_router(features.router)` alongside the other feature routers (top-level, not under `/admin`).
- `backend/app/api/evals.py` — router-level `require_visible('skill_studio')` on `router` and `router_evals`; import updated.
- `backend/app/api/skill_tuner.py` — router-level `require_visible('skill_studio')`; import updated.
- `backend/app/api/skill_test_cases.py` — router-level `require_visible('skill_studio')`; import updated.
- `backend/app/api/settings.py` — per-endpoint `require_visible('model_management')` on the 4 management routes; `GET /providers` annotated as an ungated Run carve-out.
- `backend/app/api/workflows.py` — per-endpoint `require_visible('workflow_authoring')` on the 6 authoring routes; `/published` + `/starters` annotated as ungated Run feeds.
- `backend/app/api/document_governance.py` — router-level `require_visible('governance_health')`; import updated.

## Verification

- **Owned tests GREEN (5/5):** `test_148_effective_features.py` (2 — operator all-True; end user only Everyone) + `test_148_carveouts.py` (3 — settings gated/providers ungated; workflows authoring gated/published+starters ungated; no threads.py route gated).
- **146/147 regression backstop GREEN (78/78):** no regression on the shared auth path or any governed router.
- **Full `test_148_*.py` sweep:** 25 passed / 6 failed — every one of the 6 failures is a downstream Wave-0 stub owned by 148-06 (`test_148_disable.py` ×2, `test_148_enable.py` ×1, `test_148_view_platform_recorded.py` ×3). Expected-RED per the plan's `<verification>`; none are 148-05's responsibility.
- **`threads.py` untouched:** `git diff --stat backend/app/api/threads.py` empty — the workflow-launch carve-out is preserved by not touching it.
- **Acceptance greps:** skill_studio gate present in evals.py (×2, both routers) + skill_tuner.py (×1) + skill_test_cases.py (×1); model_management ×4 in settings.py with `GET /providers` carrying no gate; workflow_authoring ×6 in workflows.py; governance_health ×1 (router-level) in document_governance.py; no router-level `dependencies=` on the `settings.py` APIRouter.

## Decisions Made

- **Router-level vs per-endpoint (see key-decisions):** router-level `require_visible` for the four no-carve-out governed routers guarantees EVERY endpoint is gated (the plan's stated primary requirement — evals.py alone spans 15+ endpoints across two routers) and prevents a future endpoint from forgetting the gate, mirroring the `require_operator` router-level precedent. Per-endpoint (decorator `dependencies=[]`) is used ONLY on `settings.py` and `workflows.py`, where a router-level gate would 403 the Run carve-outs — exactly the scope the RESEARCH anti-pattern names. The carveouts test (which walks each route's flattened dependant tree) passes under both mechanisms.
- **VIS-01 not marked complete:** the API wall is done, but the requirement's frontend hide/bounce half (148-07) is unshipped; marking now = false green. Deferred to phase verify-work (148-02/148-04 substrate precedent).

## Deviations from Plan

**None in the Rule 1-4 sense** (no bug fix, missing-critical, blocking-issue, or architectural change was needed). One implementation-approach judgment call is recorded under Decisions Made: the plan's Task 2/3 text says "attach per-endpoint," and the RESEARCH Pattern 1 anti-pattern prohibits router-level gating on `settings.py`/`workflows.py` (the carve-out routers). For the four routers with NO carve-out, router-level attachment achieves the plan's explicit "gate EVERY endpoint" goal more robustly and is not prohibited by that anti-pattern. Per-endpoint is retained wherever a carve-out must stay ungated. Net contract is identical to the plan (every governed endpoint gated; all three Run carve-outs ungated; threads.py untouched).

## Known Stubs

None. `GET /features` returns a real per-user computed map; every gate is live and enforced server-side. Nothing renders empty/placeholder data.

## Threat Flags

None. All security-relevant surface introduced (the new `GET /features` endpoint, the `require_visible` 403s, the Run carve-outs) was enumerated in the plan's `<threat_model>` (T-148-05 GET /features / feature_audience, T-148-07 require_visible 403, T-148-08 Run carve-out over-gating) and mitigated as specified — no new endpoint, auth path, file-access pattern, or trust-boundary schema change beyond the plan.

## Issues Encountered

None. The `require_visible` factory + `feature_audience` resolver + `is_operator` seam were all delivered by 148-02, so this plan was pure wiring against a stable interface.

## User Setup Required

None — no external service configuration. (Migration 098's live apply is 148-03's operator step; this plan is code-only and depends on the resolver/gate substrate, not the applied column — `feature_audience` fails safe to the `_GOVERNED_FEATURES` cold default.)

## Next Phase Readiness

- **148-06** (operator admin endpoints) — the visibility-set `PUT /admin/visibility` will flip these gates' audience at runtime via `set_feature_visibility`; the gates read the same TTL-cached `feature_audience`, so a flip propagates within the ~30s cache TTL.
- **148-07** (frontend VIS-01) — `GET /features` is ready to be consumed by `useEffectiveFeatures`; the graceful-403 bounce contract is live (governed page fetches now return 403 for a non-operator).

## Self-Check: PASSED

- Files: FOUND `backend/app/api/features.py`, FOUND `backend/app/main.py`, FOUND `backend/app/api/evals.py`, FOUND `backend/app/api/skill_tuner.py`, FOUND `backend/app/api/skill_test_cases.py`, FOUND `backend/app/api/settings.py`, FOUND `backend/app/api/workflows.py`, FOUND `backend/app/api/document_governance.py`.
- Commits: FOUND `a1e3668c` (Task 1), FOUND `3eb6f84f` (Task 2), FOUND `b6b1eea1` (Task 3).

---
*Phase: 148-governance-audit-users-feature-visibility*
*Completed: 2026-07-11*
