# Phase 159 — Deferred / Out-of-Scope Items

Out-of-scope discoveries logged during execution (per GSD executor SCOPE BOUNDARY rule —
only auto-fix issues DIRECTLY caused by the current task; pre-existing failures in unrelated
files are logged, not fixed).

## Plan 03 (2026-07-18)

### Pre-existing test failure — `test_eval_runner.py::test_post_applies_provider_override_to_user_settings`

- **Symptom:** `POST /skills/{id}/evals/runs` returns `403 {"detail":"This feature is available to administrators only."}`; the test expects `202`.
- **Root cause:** the eval-run endpoint is behind the Phase-148 (VIS-01) `require_visible` operator/feature-visibility gate. The test overrides auth to a non-operator `OWNER` and does not make the `skill_studio`/eval feature audience `everyone`, so the gate denies with 403. This is gate/visibility test rot, NOT an eval-runner logic bug.
- **Why out of scope for Plan 03:** Plan 03 only touched `supabase/migrations/103_*.sql`, `user_settings.py` (added a defaulted `model_discovery_filter_enabled` field + readback), `settings.py` (`FullSettingsResponse` field + `_build_response` serialization), and `main._DIRECT_COLUMNS`. None of these touch `require_visible` / `feature_audience` / the eval endpoint. The test builds settings via `UserEffectiveSettings.model_construct(...)`, which applies the new field's default and cannot raise on it. Confirmed non-causal: after fixing the one genuinely-affected helper (`tests/unit/test_settings.py::_fake_settings`), this 403 persists unchanged, and the failure mode is a clean gate denial (403), not a construction error.
- **Note:** an empirical clean-HEAD re-run was attempted via a throwaway `git worktree` but was blocked by a Windows `Filename too long` limit on a deep `.planning/milestones/v2.6-phases/...` path (environment limitation, unrelated to the code). Non-causation is established by code analysis above.
- **Disposition:** leave for a future eval/visibility-gate test-hygiene pass (candidate alongside the known SEED-056 vitest rot / pre-existing backend failures noted in PROJECT.md). Do NOT fix in Phase 159.
