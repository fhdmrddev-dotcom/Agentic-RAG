# Phase 307 — deferred items (out of scope for the plan that found them)

## Found by 307-02

### 1. `test_305_refusals_live.py`'s audit assertion is vacuous in a spawned server

- **What:** `_305_live.serve()` copies `os.environ` into the spawned uvicorn. `tests/conftest.py`
  has already put placeholder `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` into `os.environ`, so
  every supabase-py write the spawned server makes (`api_key_auth.audit_key_call_now` and the
  throttled `api_key.refused` path) goes to a host that does not exist, and `write_audit_entry`
  swallows the error. asyncpg writes are unaffected, which is why `api_key.read` rows appear.
- **Measured:** 307-02's live round trip saw only `api_key.read` rows until its own `serve()`
  passed the local Supabase env through (`tests/integration/_307_live.py::serve`).
- **Effect on 305:** `test_every_refusal_is_one_identical_401` asserts
  `all(r["action_type"] == "api_key.refused" for r in rows)` and
  `reasons <= {"revoked", "expired"}` — both hold over an EMPTY set, so they never proved an
  attributable refusal is audited through the real app.
- **Fix (not taken here, `_305_live.py` is outside 307-02's files):** give `_305_live.serve` the
  same local-env pass-through, then make the 305 assertion require at least one row.
- **Route:** the next plan that edits `backend/tests/integration/_305_live.py`, or 307-05's
  close-out review.
