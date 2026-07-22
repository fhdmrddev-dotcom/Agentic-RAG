# Phase 167 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY rule: issues NOT directly caused by this plan's
changes are recorded here, not fixed.

## 167-04 (VIS-02) — pre-existing backend test rot (unrelated to VIS-02)

**Discovered during:** 167-04 Task 2 no-regression sweep.

While running the acceptance-criteria no-regression suites, 19 tests fail in
`tests/test_dual_mode_wiring.py` and `tests/test_provider_router.py`. These are
**pre-existing** — verified by reverting all 167-04 Task-2 source edits (`git checkout`
of `threads.py` + `run_model_resolution.py` to the Task-1 commit) and re-running: the
failure count is **identical (19 failed / 53 passed)** with and without the VIS-02 edits.

Root causes (both Phase 145/162.5/163/164 refactor rot, zero connection to VIS-02):
- `AttributeError: <module 'app.api.threads'> does not have the attribute 'insert_run'`
  — the test patches a symbol relocated by the 145-03 run-lifecycle / 162.5 leaf extraction.
- `ValueError: get_service_role_supabase requires an explicit org_id`
  — the harness/dual-mode fixtures were not updated for the Phase 163/164 org-scoped
  service-role factory signature.

**167-04 impact:** none. `tests/test_167_prefs.py` (7/7) and the D-A4 patch-surface suite
`tests/test_149_fallback_notice.py` (15/15) are green; the module-qualified overlay guard
did not disturb the `threads_mod` patch surface.

**Recommendation:** fold into the existing E2E/vitest-rot cleanup track (SEED-049 / SEED-056
sibling for backend) or a dedicated test-rot phase; update the dual-mode / provider-router
fixtures to the post-163 org_id factory + post-145 relocated symbols. Not in VIS-02 scope.
