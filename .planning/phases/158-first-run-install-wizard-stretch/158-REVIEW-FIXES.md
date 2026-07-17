---
phase: 158-first-run-install-wizard-stretch
fixed_at: 2026-07-17
review_path: .planning/phases/158-first-run-install-wizard-stretch/158-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
verified_intact: 1
addressed_via_test: 1
deferred: 4
status: partial
base_commit: 8047d172
---

# Phase 158: Code Review Fix Report

**Source review:** `158-REVIEW.md` (2 critical, 6 warning, 5 info)
**Base:** `8047d172` (the CR-02 fix — verified intact, not re-done)
**Branch:** `develop` (main tree; worktrees OFF per environment instruction)

## Summary

- **Fixed (7):** CR-01, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06 — each an atomic commit.
- **Verified intact (1):** CR-02 (already fixed at `8047d172`; not touched, only built on).
- **Addressed via test (1):** IN-05 (the `INFRA_KEYS ⊆ Settings fields` cross-check, folded into CR-01's tests).
- **Deferred with reasons (4):** IN-01, IN-02, IN-03, IN-04.

**Final gates (all green):**
- `python -c "import app.main"` → OK
- `pytest tests/test_setup_*.py -q` → **73 passed** (baseline 61 + 12 new tests)
- Frontend `tsc -b` → **0 net-new** (29 pre-existing errors in untouched files: `api.test.ts`, `SettingsPage.*`, `StreamsProvider.tsx`, `streamsStore.ts`; identical count with my 2 frontend files stashed)
- Frontend `vite build` → **exit 0**
- Security contract unchanged: every `/setup/*` write stays token + finalize-latch gated. Migration 102 NOT applied; `full-schema.sql` NOT regenerated (operator-gated).

## Fixed Issues

### CR-01 — overlay `setattr`s undeclared Settings fields → crash-loop after finalize
**Commit:** `ea232a71` · **Files:** `backend/app/config.py`, `backend/tests/test_setup_overlay.py`
**Fix (both halves):**
- (a) Declared `supabase_anon_key` / `supabase_publishable_key` / `supabase_secret_key` (`str = ""`) on `Settings`, beside the existing `supabase_url` / `supabase_service_role_key`. This fixes the crash AND the empty-anon `/public-config` (D-07 login).
- (b) Guarded `apply_setup_overlay` to `setattr` only keys the target `hasattr` — a future `INFRA_KEY` without a matching field is now SKIPPED, never a boot-bricking `ValueError`. (`hasattr`, not `type(target).model_fields`, so the guard is also correct for the `SimpleNamespace` targets the unit tests drive.)
**Tests (4 new):** every `INFRA_KEY` is a declared field (IN-05); overlay applies all infra keys without crashing; the guard skips an undeclared key; `/public-config` returns the real anon key. `import app.config` clean; `settings.supabase_anon_key` now populated from env.

### WR-04 — `/operator` reflected `str(exc)` verbatim → DB host/role leak
**Commits:** `f09100af` (+ refinement `7880f350`) · **Files:** `backend/app/api/setup.py`, `backend/tests/test_setup_operator.py`
**Fix:** Added `_is_password_policy_error`. Order matters: an **asyncpg/OSError denylist runs FIRST** (always sanitized — its message can carry `password authentication failed for user "postgres"`), THEN a password-**policy phrasing** match (not the bare word "password") surfaces a GoTrue rejection verbatim (T-158-06 UX). `/operator` now returns the verbatim policy message OR a generic sanitized message; the raw DB error never reaches the caller.
**Note on the two commits:** the initial fix keyed only on exception type/module; the full-suite run showed `test_setup_idempotent.py` models the GoTrue error as a plain `ValueError`, so the refinement added policy-phrase matching (keeping the denylist first) — a single logical fix, split because the regression surfaced two commits later and the WR-04 commit was no longer HEAD (no history rewrite).
**Tests (2 new):** a DB error's host/role never reaches the 400 detail; a GoTrue password error is still verbatim. (Existing `test_operator_password_policy_error_maps_to_400_not_500` stays green.)

### WR-06 — `useAuth` subscribed to the pre-hydrate client → no-rebuild login never updates UI
**Commit:** `f494ea21` · **Files:** `frontend/src/lib/supabase.ts`, `frontend/src/hooks/useAuth.ts`
**Fix (event re-bind — normal path unchanged):** `supabase.ts` exports `SUPABASE_CLIENT_REHYDRATED` and dispatches it as a `window` event **only when `hydrateSupabaseFromRuntime` actually reassigns** the client. `useAuth` re-runs `getSession` + re-subscribes `onAuthStateChange` on that event (tearing down the stale subscription). The baked-VITE path never reassigns → no event → byte-identical behaviour.
**Gate:** 0 net-new `tsc`; `supabase.test.ts` + `SetupWizard.test.tsx` → 10 passed; `vite build` exit 0.

### WR-03 — `probe_submitted_redis` built the client outside the try → 500 on malformed URL
**Commit:** `7078ec22` · **Files:** `backend/app/services/setup_service.py`, `backend/tests/test_setup_probe.py`
**Fix:** Moved `aioredis.from_url(...)` INSIDE the try (it parses eagerly and raises `ValueError` on a bad scheme / empty string); guarded the `finally` close for an unbound client. `/validate` + `/detect` now return the sanitized `{state:down, reason}` instead of 500.
**Test (1 new):** empty + schemeless URLs return `down`, never raise (confirmed `from_url` raises `ValueError` at parse for `""` and `not-a-redis-url`).

### WR-01 — operator-bootstrap duplicate path skipped the upsert → unrecoverable stuck state
**Commit:** `1c5e9a8d` · **Files:** `backend/app/services/setup_service.py`, `backend/tests/test_setup_operator.py`
**Fix:** Extracted the `operator_users` `ON CONFLICT DO NOTHING` upsert into `_upsert_operator_row(pg_dsn, user_id)` and call it on BOTH the created AND the duplicate path (no-op on an unresolved id). A partial first attempt (auth user created, operator-row insert failed) now self-heals on retry instead of returning `already_exists` forever with no row.
**Test (1 new):** the duplicate path with a resolvable existing id still upserts.
**Residual (pre-existing, review-noted):** `_find_existing_user_id` reads only the first `list_users()` page, so on a very busy box the id may not resolve (upsert then no-ops). Not in scope; recorded as a follow-up.

### WR-05 — schema auto-runner 500'd on a non-privilege DB error instead of the guide
**Commit:** `7294572d` · **Files:** `backend/app/api/setup.py`, `backend/tests/test_setup_schema_bootstrap.py` (new)
**Fix:** Broadened the `/setup/schema-bootstrap` fallback — after the `SchemaBootstrapPrivilegeError` case, a broad `except Exception` also degrades to the copy-guide. ANY runner failure (non-privilege `asyncpg.PostgresError`, `OSError`, missing artifacts) now returns `{fallback:"guide", seed_sequence}`, never a 500 — honouring the "never a half-applied silent success, always the guide" MUST.
**Tests (3 new):** privilege, non-privilege, and missing-artifacts failures all return the guide.
**Container limitation (SUMMARY note, not fixed here per guidance):** the backend image build context is `backend/`, so `supabase/full-schema.sql` is NOT bundled — the auto-runner (a D-10 SHOULD) always degrades to the copy-guide (a valid MUST) in the shipped one-box container. Bundling `supabase/` into the image is deferred; the guide path is correct and now covers the failure gracefully.

### WR-02 — WORKER_COUNT=2 token double-mint race
**Commit:** `1cfdb6df` · **Files:** `backend/app/services/setup_store.py`, `backend/tests/test_setup_token.py`
**Fix (mitigation):** `get_or_create_token` re-reads the store after minting and returns the persisted value, so two co-booting workers converge on the same last-persisted token (the one `verify_token` accepts) rather than one worker announcing a stale candidate that 401s.
**Test (1 new):** a clobbering sibling write makes us return the persisted race-winner.
**Residual (follow-up, noted per guidance):** the write-write window is fully closed only by an OS-level file lock / `O_EXCL` sentinel (cross-platform, larger/riskier). Deferred; the finalize lock remains the real security boundary, so this is a UX/robustness improvement not a security fix.

## Verified Intact (not modified)

### CR-02 — gate keys off `needs_setup`, not the finalize marker alone
Already fixed at base `8047d172`. Confirmed intact and built upon:
- `main.py:310` → `_setup_mode = needs_setup(_setup_cfg)` (+ reconcilers/audit-guard gated on `if not _setup_mode`).
- `middleware/setup.py` → `_is_configured_via_env()` un-gates a hand-filled 157 box.
- `tests/test_setup_gate.py::test_configured_via_env_is_never_gated` present and passing.

## Info: addressed / deferred

- **IN-05 (addressed via test):** `test_all_infra_keys_are_declared_settings_fields` (in the CR-01 commit) pins `INFRA_KEYS ⊆ Settings.model_fields` — exactly the cross-check IN-05 recommended; a future INFRA_KEY without a field now trips a test. The drift-check *script* wasn't changed (the more direct invariant is now enforced).
- **IN-01 (DEFERRED — reviewer's suggested fix is unsafe):** the suggested `v.strip().startswith("<") and endswith(">")` would BREAK the actual onebox `supabase_url` placeholder `https://<project-ref>.supabase.co` (it does not start with `<`), regressing fresh-box detection to a CR-level failure. `_is_placeholder` is only ever applied to `supabase_url` (a URL that never legitimately contains `<>`), so the `p<a>ss`-DSN false-positive it targets cannot reach the call site. A safe regex tightening has ~nil real payoff; deferred rather than risk the primary detection.
- **IN-02 (DEFERRED):** plaintext-at-rest window when `SECRETS_ENCRYPTION_KEY` is blank at provider-key save. Self-heals via the boot secret-sweep when a key is supplied + the box restarts. This is an OPERATOR.md note / re-encrypt-on-finalize enhancement, not a clean localized code fix.
- **IN-03 (DEFERRED):** non-atomic store read-modify-write. Same root as WR-02 (the WR-02 mitigation improves the token case). Benign today per the review (`os.replace` keeps the file uncorrupt; only concurrent-with-first-finalize writers race). Full fix = the same OS-level lock noted for WR-02.
- **IN-04 (DEFERRED — out of the requested scope):** drift-check `docker compose config` soft-warns a genuinely broken compose. Not in the guidance's fix list; a `check-deploy-drift.sh` hardening for a future pass.

---

_Fixed: 2026-07-17 · Fixer: Claude (gsd-code-fixer) · Iteration: 1_
