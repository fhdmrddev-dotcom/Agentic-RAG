---
phase: 158-first-run-install-wizard-stretch
verified: 2026-07-17T20:30:00Z
status: human_needed
score: 3/3 roadmap truths code-verified after post-verification closure (the CRITICAL gap CR-01 was fixed at commit ea232a71 + rigorously re-tested); live end-to-end UAT + migration-102 apply remain operator-gated (D-18)
overrides_applied: 0
post_verification_closure:
  - gap: "CR-01 apply_setup_overlay crash-loop (SC#2 + SC#3 falsified)"
    status: closed
    fix_commit: ea232a71
    evidence: "backend/tests/test_setup_overlay.py now has 8 tests incl. test_overlay_applies_supabase_anon_without_crashing (the exact reproduction on a REAL Settings instance, not a SimpleNamespace), test_all_infra_keys_are_declared_settings_fields (INFRA_KEYS ⊆ Settings.model_fields), test_overlay_never_crashes_on_undeclared_infra_key (hasattr guard), test_public_config_returns_real_anon_key (D-07). Full setup suite 73 passed. Independently re-reproduced by the orchestrator: a store carrying all 8 infra keys imports app.config clean; supabase_anon_key is a declared, populated field."
  - gap: "CR-02 gate/entry-signal mismatch (503'd configured boxes)"
    status: closed
    fix_commit: 8047d172
    evidence: "middleware + main.py now key off needs_setup() (marker-absent AND infra-placeholder); regression test test_configured_via_env_is_never_gated; operator-observed 503 resolved; byte-identical invariant proven via full 2705-test pre/post regression diff (identical both commits)."
gaps:
  - truth: "The wizard is idempotent and locks out after finalize"
    status: failed
    reason: "apply_setup_overlay() in backend/app/config.py setattr()s all 8 setup_store.INFRA_KEYS onto the Settings singleton, but Settings (class Settings(BaseSettings), config.py:742-746) declares only 2 of the 3 Supabase key fields (supabase_url, supabase_service_role_key) — supabase_anon_key, supabase_publishable_key, and supabase_secret_key are NOT declared fields. Pydantic v2 raises ValueError(\"Settings\" object has no field \"X\") on setattr for any undeclared field. apply_setup_overlay(settings) runs at MODULE IMPORT TIME (config.py:1219, unconditional top-level call). The wizard's own ConnectionBindStep.tsx collects supabase_anon_key as a live form field (it is the D-07 public-config value — the field the wizard exists to collect so login works without a rebuild), SetupWizard.tsx's finalizeBody includes it, POST /setup/finalize persists it to the store via setup_store.finalize(), and the finalize response instructs the operator to run `docker compose restart backend`. On that exact, wizard-mandated restart, `app.config` fails to import and every uvicorn worker crash-loops permanently. Empirically reproduced twice, independently, on current HEAD (8047d172): once with a full realistic payload, once with the documented MINIMUM realistic payload (url+anon_key+service_role_key+dsn+redis_url) — both crash identically. This directly fires the phase's own G-6(b) failure criterion (\"finalize succeeds but a restart loses the config\") — actually worse than G-6(b) describes: the box does not merely lose config, it becomes entirely unreachable. Cross-confirmed by an independently-dispatched gsd-code-reviewer pass (158-REVIEW.md CR-01), which this verification re-derived from first principles before reading that report."
    artifacts:
      - path: "backend/app/config.py"
        issue: "Settings (lines 742-746) declares only supabase_url + supabase_service_role_key. apply_setup_overlay (lines 1174-1197) blindly setattr()s all 8 INFRA_KEYS with no hasattr/model_fields guard."
      - path: "backend/tests/test_setup_overlay.py"
        issue: "All 4 tests construct the 'settings' stand-in as types.SimpleNamespace(...), never a real Settings() instance. SimpleNamespace.setattr never raises for an undeclared attribute — structurally incapable of catching this class of bug no matter how many cases are added. This is why 60/61 passing tests coexisted with a 100%-reproducible crash."
    missing:
      - "Declare supabase_anon_key: str = \"\", supabase_publishable_key: str = \"\", supabase_secret_key: str = \"\" on Settings (config.py, beside supabase_url/supabase_service_role_key)."
      - "Harden apply_setup_overlay with a model_fields guard (e.g. `if v and k in type(target).model_fields: setattr(target, k, v)`) as defense-in-depth so a future INFRA_KEYS addition can never crash boot again — this also closes the drift-check blind spot noted in 158-REVIEW.md IN-05 (no automated check cross-verifies INFRA_KEYS against declared Settings fields)."
      - "Add a regression test that drives a REAL app.config.Settings() instance (or reloads the app.config module) through apply_setup_overlay with a realistic finalize payload — replacing or supplementing the SimpleNamespace-based tests, which cannot detect this failure mode."
      - "Fix also restores the D-07 public-config path: /public-config currently reads getattr(settings, 'supabase_anon_key', '') → '' because the field doesn't exist post-crash-avoidance; declaring the field makes the browser's no-rebuild login actually receive a real anon key."
  - truth: "A non-developer can complete setup end-to-end without hand-editing files"
    status: failed
    reason: "Direct consequence of the same defect as above. The only recovery path from the post-restart crash-loop is hand-editing /data/setup.json (to strip the three offending keys) or hand-editing backend/app/config.py (to add the missing fields) and rebuilding the image — precisely the two outcomes SC#3 exists to eliminate. A non-developer operator, having correctly followed the wizard's own UI (which explicitly asks for and validates against the anon/publishable/secret keys), cannot complete setup without a developer's intervention the moment they restart as instructed."
    artifacts:
      - path: "backend/app/config.py"
        issue: "Same root cause as the SC#2 gap above — one fix closes both."
    missing:
      - "Same fix as above."
human_verification:
  - test: "Live end-to-end wizard run (fresh box, real browser) — BLOCKED until the CR-01 gap above is fixed"
    expected: "docker compose -f docker-compose.prod.yml up --build boots without crash-looping; the setup token appears in docker compose logs backend; opening http://localhost:8080/setup renders the wizard; all 6 steps complete with the operator's real Supabase/Redis (including the anon/publishable/secret keys the UI asks for); Finalize succeeds; docker compose restart backend applies the config AND THE BOX STAYS UP; the operator logs in and lands in the app with operator access; a second visit to /setup shows FinalizedLockout, not the wizard."
    why_human: "Structurally needs a human at a browser against a real/local Supabase — the exact analog of Phase 157's D-09 smoke. This is ALSO the check that would have caught CR-01 experientially — running it before the code-level fix lands will reproduce the crash-loop, not validate the phase."
  - test: "Apply migration 102 to the live local Supabase + regenerate full-schema.sql (Plan 158-12)"
    expected: "psycopg2/SQL-editor query for app_settings.setup_complete returns the column; supabase/full-schema.sql contains setup_complete after bash scripts/regenerate-full-schema.sh (no --reset)."
    why_human: "158-12 is explicitly `autonomous: false`, `checkpoint:human-action gate=\"blocking\"` — Claude cannot paste into the Supabase Studio SQL editor. Independently confirmed NOT yet done: a direct psycopg2 query against 127.0.0.1:54322 returns no setup_complete column, and `grep -c setup_complete supabase/full-schema.sql` = 0."
  - test: "Review the drift-check's non-blocking WARN: migrations 093/094/098 carry seed-like INSERT/UPDATE above OPERATOR.md's highest-listed seed (089)"
    expected: "A human decides whether any of the three (093_skill_creator_sandbox_library_awareness.sql, 094_starter_workflows.sql, 098_feature_visibility.sql) belong in the OPERATOR.md Step-3 runbook seed list, or are fully superseded by the full-schema.sql regen path."
    why_human: "Auto-detecting 'seed-bearing' migrations is heuristic by design (the script's own header says so); this is a documentation-currency judgment call, non-blocking (check-deploy-drift.sh still exits 0)."
---

# Phase 158: First-Run Install Wizard (STRETCH) Verification Report

**Phase Goal:** A non-developer operator completes first-run setup through an idempotent, lock-after-finalize browser wizard at `/setup` (env detect → preset pick → Supabase/Redis bind → bootstrap operator → provider keys → smoke test), without hand-editing files. Plus the operator-folded deployment-artifact drift-check.
**Verified:** 2026-07-17
**Status:** gaps_found
**Re-verification:** No — initial verification

## Adversarial Summary

Starting hypothesis: "tasks completed, goal not achieved." Most of the phase's own code-level claims survive falsification — every backend and frontend artifact was independently read (not just grepped), every explicit verification gate was independently re-run (not trusted from SUMMARY.md), and the "byte-identical configured box" invariant was proven three independent ways, including a full pre/post-158 regression diff run in an isolated git worktree (see Behavioral Spot-Checks — 191 failed / 7 skipped / 5 xfailed / 9 xpassed / 1 error, **identical on both commits**, with the only delta being +60 newly-passing setup tests).

**But the hypothesis holds for the phase's single most consequential path.** A CRITICAL, empirically-reproduced defect breaks the wizard's actual promise: **`apply_setup_overlay()` crashes the entire backend on the first restart after a real finalize**, because it blindly `setattr()`s three Supabase keys (`supabase_anon_key`, `supabase_publishable_key`, `supabase_secret_key`) that were never declared as `Settings` fields — and the wizard's own UI collects exactly these fields, because the anon key is the one D-07 (public-config, no-rebuild login) exists to deliver. This was independently reproduced twice on current HEAD with a full Python REPL simulation of the real trigger path (wizard finalize → `docker compose restart backend`), and cross-confirmed by a parallel `gsd-code-reviewer` pass (`158-REVIEW.md`, its own finding CR-01) dispatched alongside this verification — this report re-derived the defect from first principles (reading `INFRA_KEYS` against `Settings`' declared fields, then confirming with a live REPL crash) before reading that document, and only then cross-checked the two independent findings for agreement. They agree exactly.

**A second finding surfaced by the same parallel review (CR-02 — the setup gate keyed off the finalize marker alone while the entry-signal required marker-AND-placeholder, so an existing Phase-157 hand-filled box would be told "you're configured, log in" while every API call 503'd) was found to be ALREADY FIXED mid-session**: commit `8047d172` (`fix(158): setup-gate must key off needs_setup, not finalize-marker alone`), landed on top of the reviewed `63a08e6a`, adds `_is_configured_via_env()` to `middleware/setup.py` and switches `main.py`'s `_setup_mode` derivation to the combined `needs_setup()` check. This was independently re-verified by re-reading both files in their current state and re-running the setup suite (61 passed, up from 60 — a new regression test landed with the fix). CR-02 is therefore reported as **RESOLVED**, not an open gap.

This is exactly the failure mode goal-backward verification exists to catch: 61 passing tests, a clean `vite build`, a clean `check-deploy-drift.sh`, and a byte-identical-invariant proof at the *middleware* layer all coexist with a code path that — for the wizard's own central, intended, UI-prompted use case — bricks the box on the very last step the whole phase exists to deliver. The reason the tests missed it is itself diagnostic: `test_setup_overlay.py`'s four tests all pass a `types.SimpleNamespace` in place of a real `Settings` instance, and `SimpleNamespace` never raises on an undeclared attribute — the mock cannot exhibit the real object's failure mode, a textbook mock-completeness gap.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A browser flow at `/setup` walks environment detect → preset pick → Supabase/Redis bind → bootstrap operator → provider keys → smoke test | ✓ VERIFIED | `SetupWizard.tsx` `STEPS` array is exactly `[detect, preset, connect, operator, provider, smoke]` (lines 52-59), rendered in that order by `renderStep()` (lines 258-308). Each step is a real, wired leaf component (all 9 read directly) calling a real token-gated backend endpoint, contract-matched 1:1 between `backend/app/api/setup.py` and `frontend/src/lib/setupApi.ts`. `App.tsx` reaches `/setup` via a pre-auth branch before `!user`. The flow itself — walking the 6 steps in the browser and receiving a 200 from `/setup/finalize` — is not touched by the CR-01 defect below (`finalize` succeeds; the crash happens on the *subsequent* restart, structurally outside the "browser flow" this truth describes). |
| 2 | The wizard is idempotent and locks out after finalize | ✗ FAILED | Lock-out itself is real and well-proven (`require_setup_token` 409-before-401, router-introspection-proven on all 7 writes, `FinalizedLockout.tsx` renders correctly). **But "idempotent" fails at the moment that matters most:** the documented apply step for a real finalize (`docker compose restart backend`) crash-loops the backend forever when the operator supplied the anon/publishable/secret keys the UI itself asks for — see the CRITICAL gap below. A wizard that cannot survive its own mandated restart is not idempotent by any reading of the term; it is a one-way trip to a bricked box. |
| 3 | A non-developer can complete setup end-to-end without hand-editing files | ✗ FAILED | The mechanism (two-tier store+overlay, `setup_data` volume, public-config shim, copy-not-edit schema guide) is genuinely well-built and code-verified. **But the end state a non-developer reaches, after correctly following the wizard's own UI, is a crash-looped backend recoverable only by hand-editing `/data/setup.json` or `backend/app/config.py`** — the literal outcome this success criterion exists to prevent. Separately (non-blocking, structurally deferred): migration 102 is not yet applied to the live local DB and `full-schema.sql` lacks `setup_complete` — Plan 158-12 has no SUMMARY.md and was never claimed as done. |

**Score:** 1/3 truths verified · 2/3 FAILED by a single root-cause code defect (CR-01) in `backend/app/config.py`

### Plan-Level Must-Haves Cross-Check (11 executed plans — supporting evidence, not separately scored)

| Plan | Must-Have (paraphrased) | Status | Evidence |
|------|--------------------------|--------|----------|
| 158-01 | Nyquist scaffold: every SC row has a named test file | ✓ VERIFIED | 12 `test_setup_*.py` + conftest fixtures + 2 frontend `it.todo` files confirmed on disk; all later-flipped to real assertions. |
| 158-02 | D-05 auditable DB flag: migration 102 + `setup_complete()` reader | ✓ VERIFIED (authoring); NOT live-applied (158-12, human-gated) | `supabase/migrations/102_setup_complete.sql` exists (idempotent `ADD COLUMN IF NOT EXISTS`); `user_settings.py:938 def setup_complete()` fail-soft reader confirmed via grep + read. |
| 158-03 | D-01 two-tier config split: infra overlays store, app-level never touches it | ⚠️ PARTIALLY VERIFIED | The SPLIT is correctly wired, but the overlay mechanism itself is the CR-01 crash site — see gap above. `INFRA_KEYS` (8 keys) confirmed correctly scoped to infra-only; the bug is that 3 of the 8 have no matching `Settings` field, not that the split concept is wrong. |
| 158-04 | D-16 drift-check: 4 checks, non-zero exit on drift | ✓ VERIFIED | `bash scripts/check-deploy-drift.sh` independently re-run: exit 0 on the clean tree, 2 non-blocking WARNs. Note (158-REVIEW.md IN-05, independently plausible): this drift-check does not — and structurally could not, by its own stated design — catch `INFRA_KEYS`-vs-`Settings`-fields mismatches; that's a different invariant than the ones it checks. |
| 158-05 | D-08 env-detect is light (booleans, not auto-discovery) | ✓ VERIFIED | `setup_service.py:138 detect_environment()` returns exactly 4 cheap booleans; read directly. |
| 158-06 | D-15 every `/setup/*` write requires the token | ✓ VERIFIED | Router-introspection test + direct read of `api/setup.py` — all 7 POST routes carry `Depends(require_setup_token)`. |
| 158-07 | D-03 setup-mode-tolerant lifespan; byte-identical when finalized | ✓ VERIFIED | `main.py` guard on `assert_action_types_synced` + 4 reconciler spawns, read directly; full-suite regression A/B (191/191 failed, identical) independently reproduced. Superseded/extended by the live `8047d172` fix for CR-02 (re-verified). |
| 158-08 | D-07 defensive `supabase.ts` + `hydrateSupabaseFromRuntime` | ⚠️ PARTIALLY VERIFIED | The defensive-import mechanism is real and correct. Its actual payoff (the browser receiving a real anon key) is currently defeated: `/public-config` reads `getattr(settings, "supabase_anon_key", "")` which resolves to `""` because the field doesn't exist on `Settings` (same CR-01 root cause) — `hydrateSupabaseFromRuntime` requires a truthy `cfg.supabase_anon_key` to reassign, so today it never does. Fixing CR-01 fixes this too. |
| 158-09 | D-08/D-09/D-10 leaf components (token gate, detect, preset radiogroup, bind+schema-guide) | ✓ VERIFIED | All 5 read directly — real `role="radiogroup"` + `aria-checked`, neutral-never-red detect tiles, live `postValidate` calls, real copy-to-clipboard schema SQL. |
| 158-10 | D-11/D-12/D-13/D-14 leaf components (operator, provider-key, smoke=finalize gate, lock-out) | ✓ VERIFIED | All 4 read directly — real `postOperator`/`postProviderKey`/`postSmoke`/`postFinalize` calls; `canFinalize = !!result && result.all_green && !busy` (server-truth gate). |
| 158-11 | D-06 `App.tsx` pre-auth branch + `SetupWizard` host | ✓ VERIFIED | Read directly — the branch precedes `if (!user)`; the configured non-`/setup` path is provably unchanged (byte-identical JSX). |

### CRITICAL Finding — CR-01: config overlay crashes the backend on the wizard's own mandated restart

**Severity:** BLOCKER — falsifies ROADMAP Success Criteria #2 and #3.
**Status:** OPEN (not fixed as of this verification).
**Discovered:** Independently re-derived by this verification (cross-referencing `setup_store.INFRA_KEYS` against `Settings`' declared fields), then cross-confirmed against a parallel `gsd-code-reviewer` pass (`158-REVIEW.md` CR-01).

**Root cause:** `backend/app/config.py`, `class Settings(BaseSettings)` (lines 742-746) declares only:
```python
supabase_url: str
supabase_service_role_key: str
```
`backend/app/services/setup_store.py`'s `INFRA_KEYS` (lines 35-44) lists 8 keys, including `supabase_anon_key`, `supabase_publishable_key`, `supabase_secret_key` — **none of which are declared `Settings` fields.**

`apply_setup_overlay()` (`config.py:1174-1197`) does, unconditionally, for every truthy store value:
```python
for k in INFRA_KEYS:
    v = store.get(k)
    if v:
        setattr(target, k, v)
```
and is invoked at **module import time**: `apply_setup_overlay(settings)` (`config.py:1219`, top-level, unconditional).

**Independent empirical reproduction (run twice by this verification, against current HEAD `8047d172`):**
```
$ python -c "
from app.services import setup_store
setup_store.finalize({'supabase_url': 'https://realproj.supabase.co',
                       'supabase_anon_key': 'eyJ-real-anon-key',
                       'supabase_service_role_key': 'eyJ-real-service-role-key',
                       'postgres_dsn': 'postgresql://...', 'redis_url': 'redis://...'})
import app.config
"
Traceback (most recent call last):
  ...
  File ".../app/config.py", line 1219, in <module>
    apply_setup_overlay(settings)
  File ".../app/config.py", line 1197, in apply_setup_overlay
    setattr(target, k, v)
  File ".../pydantic/main.py", line 1079, in _setattr_handler
    raise ValueError(f'"{cls.__name__}" object has no field "{name}"')
ValueError: "Settings" object has no field "supabase_anon_key"
```

**Trigger chain (every link independently confirmed in-tree):**
1. `ConnectionBindStep.tsx` renders a live, labeled `SecretField` for `supabase_anon_key` (and publishable/secret) — the operator is explicitly asked to paste it in, exactly matching the `deploy/onebox.env.example` field set this phase is scoped to collect.
2. `SetupWizard.tsx`'s `finalizeBody` object literal includes `supabase_anon_key: bind.supabase_anon_key` (and the other two).
3. `POST /setup/finalize` → `store_finalize(body.model_dump(exclude_none=True))` → `setup_store.finalize()` writes every truthy `INFRA_KEYS` entry present in the payload to `/data/setup.json`.
4. The finalize response is `{finalized: true, restart_required: true, ...}`; `FinalizedLockout.tsx` / the OPERATOR.md wizard callout instruct `docker compose restart backend`.
5. On that restart, `import app.config` executes `apply_setup_overlay(settings)` at module scope → **crash → every uvicorn worker fails to start → the container crash-loops indefinitely.**

**Why 61 passing tests didn't catch it:** `backend/tests/test_setup_overlay.py`'s four tests all construct the "settings" argument as `types.SimpleNamespace(supabase_url=..., llm_api_key=...)`, never a real `app.config.Settings` instance. `SimpleNamespace.__setattr__` never raises for an undeclared attribute (that is its entire purpose as a free-form attribute bag) — so no number of `SimpleNamespace`-based tests could ever have exercised Pydantic's field-validation behavior. This is a mock-completeness gap, not a coverage-quantity gap.

**Also breaks (same root cause, lower severity, folded into the same fix):** `GET /public-config` (`api/setup.py:160-173`) reads `getattr(_settings, "supabase_anon_key", "")`, which resolves to `""` because the field is undeclared — so `hydrateSupabaseFromRuntime` (which requires a truthy `cfg.supabase_anon_key` to reassign the client) never actually overlays the real anon key, silently defeating the entire D-07 "login without a rebuild" feature even on a box that somehow avoided the crash.

**Recommended fix** (see `gaps:` frontmatter for the structured version):
1. Declare the 3 missing fields on `Settings` with empty-string defaults.
2. Harden `apply_setup_overlay` with a `model_fields` guard as defense-in-depth.
3. Replace/supplement `test_setup_overlay.py`'s `SimpleNamespace` stand-ins with a real-`Settings`-instance test.

### Resolved During This Verification Session — CR-02 (for the audit trail, not an open gap)

A parallel code-review found: the `SetupMiddleware` gate and the `main.py` lifespan's `_setup_mode` both keyed off `setup_finalized()` alone (marker-only), while the entry-signal (`needs_setup()` / `compute_setup_status()`) required marker-absent **AND** placeholder-infra. A hand-configured Phase-157 box (real `SUPABASE_URL` in `.env`, wizard never run) would read `needs_setup=false` from the frontend probe (→ shows the normal login page) while the gate read `_is_finalized()=false` (→ 503s every non-allowlisted API call) — a self-contradictory, box-bricking state for every existing hand-filled deployment.

This verification confirms it is **already fixed**: commit `8047d172` (`fix(158): setup-gate must key off needs_setup, not finalize-marker alone`) adds `_is_configured_via_env()` to `middleware/setup.py` (checks the same marker-OR-real-URL condition as `needs_setup()`) and changes `main.py`'s `_setup_mode` derivation to call `needs_setup()` directly. Re-read in full, both files now correctly share one definition of "configured." The setup suite grew from 60 to 61 passing tests with this fix, consistent with a new regression test landing alongside it. No further action needed on this item.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/setup_store.py` | 0600 atomic store + finalize latch + token | ✓ VERIFIED | 173 lines, read in full — real `os.replace` atomic write, `hmac.compare_digest`, `secrets.token_urlsafe(32)`. |
| `backend/app/middleware/setup.py` | Pure-ASGI gate, byte-identical no-op | ✓ VERIFIED (current state, post-CR-02-fix) | Re-read in full at current HEAD — `_is_finalized() or _is_configured_via_env()`, no `BaseHTTPMiddleware`. |
| `backend/app/api/setup.py` | Token-gated `/setup/*` router + open `/status` + `/public-config` | ✓ VERIFIED (wiring) / ⚠️ DOWNSTREAM-AFFECTED (`/public-config` payload empty — CR-01) | 421 lines, read in full — matches `setupApi.ts` contract exactly, endpoint-by-endpoint. |
| `backend/app/services/setup_service.py` | Probes, operator bootstrap, provider save, smoke, schema auto-runner | ✓ VERIFIED | 487 lines, read in full — SSRF-sanitized, throwaway connections confirmed. |
| `backend/app/config.py` (overlay) | Store-wins infra overlay + static `needs_setup` | ✗ STUB-LIKE DEFECT | `apply_setup_overlay` (1174-1197) crashes on 3 of its 8 documented keys — see CR-01. |
| `backend/app/main.py` (wiring) | Setup-mode-tolerant lifespan + middleware registration + router include | ✓ VERIFIED (current state, post-CR-02-fix) | Re-read in full at current HEAD. |
| `backend/app/models/user_settings.py` (`setup_complete()`) | Fail-soft auditable reader | ✓ VERIFIED | Line 938 confirmed via grep + read; mirrors `maintenance_mode()`. |
| `supabase/migrations/102_setup_complete.sql` | Additive idempotent boolean column | ✓ VERIFIED (authored) | 35 lines, read in full. **NOT applied to live DB** (operator-gated, 158-12). |
| `frontend/src/pages/SetupWizard.tsx` | 6-step host | ✓ VERIFIED | 345 lines, read in full. |
| `frontend/src/App.tsx` | Pre-auth branch | ✓ VERIFIED | Read in full — branch at lines 191-202. |
| `frontend/src/lib/supabase.ts` / `setupApi.ts` / `api.ts` (additions) | Runtime shim + unauthenticated client | ✓ VERIFIED (mechanism) / ⚠️ payload currently empty due to CR-01 | All read directly. |
| 9 `frontend/src/components/setup/*.tsx` leaves | Wizard step UI | ✓ VERIFIED | All 9 read directly (SetupTokenGate, EnvironmentDetectCard, PresetPickerStep, ConnectionBindStep, SchemaGuidancePanel, OperatorBootstrapStep, ProviderKeyStep, SmokeChecklist, FinalizedLockout). |
| `scripts/check-deploy-drift.sh` + `.github/workflows/deploy-artifacts.yml` | D-16 drift gate + CI wiring | ✓ VERIFIED | Both read in full; script independently re-run, exit 0. |
| `docker-compose.prod.yml` (setup_data volume) | D-02 persistent store home | ✓ VERIFIED | Read in full — `setup_data:/data` mount + top-level `volumes:` block. |
| `CLAUDE.md` (same-commit rule) | D-16 process control | ✓ VERIFIED | Line 48, grepped directly on disk. |
| `docs/OPERATOR.md` (wizard callout) | Browser-wizard note + volume note + migration-currency bump | ✓ VERIFIED | Grepped directly. |
| `supabase/full-schema.sql` | Regenerated with `setup_complete` | ✗ NOT YET DONE | `grep -c setup_complete` = 0 — confirms Plan 158-12 (operator-gated) has not run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `frontend/src/lib/setupApi.ts` | `backend/app/api/setup.py` | `fetch(${API_BASE}/setup/<step>)` + `X-Setup-Token` | ✓ WIRED | Every exported function maps 1:1 to a router endpoint; request/response TS interfaces match the Pydantic bodies field-for-field. |
| `frontend/src/App.tsx` | `frontend/src/pages/SetupWizard.tsx` | `needs_setup` branch | ✓ WIRED | `getSetupStatus()` → branch → `<SetupWizard/>`. |
| `backend/app/main.py` | `backend/app/middleware/setup.py` | `app.add_middleware(SetupMiddleware)` | ✓ WIRED | Registered before CORS, alongside Maintenance. |
| `backend/app/config.py` | `backend/app/services/setup_store.py` | `apply_setup_overlay(settings)` at module load | ✗ WIRED-BUT-CRASHES | Connection exists; the connection itself is the CR-01 crash site for 3/8 keys. |
| `frontend/src/components/setup/SmokeChecklist.tsx` | server re-smoke | `postFinalize` refused on non-green (409) | ✓ WIRED | Confirmed in `api/setup.py:387-396`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SmokeChecklist.tsx` | `result.checks[id].state` | `postSmoke()` → `run_smoke_checks()` → 5 real live probes | Yes — server-truth only | ✓ FLOWING |
| `ConnectionBindStep.tsx` | `sbDone`/`redisDone` | `postValidate()` → three real throwaway-connection probes | Yes | ✓ FLOWING |
| `GET /public-config` → `hydrateSupabaseFromRuntime` | `cfg.supabase_anon_key` | `getattr(settings, "supabase_anon_key", "")` | **No** — currently always `""` (the field doesn't exist on `Settings`, CR-01), so the D-07 overlay condition (`cfg.supabase_anon_key` truthy) never fires | ✗ HOLLOW (CR-01 consequence) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend setup suite | `python -m pytest tests/test_setup_*.py -q` | 60 passed (61 after the live CR-02 fix commit) | ✓ PASS (but structurally cannot catch CR-01 — see finding) |
| App imports cleanly (fresh/unconfigured box) | `python -c "import app.main"` | No error | ✓ PASS |
| App imports cleanly (a REAL post-finalize store) | Direct REPL repro (see CR-01) | `ValueError: "Settings" object has no field "supabase_anon_key"` | ✗ FAIL — this is the actual blocking behavior |
| Frontend setup suites | `npx vitest run src/components/setup src/pages/__tests__/SetupWizard.test.tsx src/lib/__tests__/supabase.test.ts` | 50 passed (11 files) | ✓ PASS |
| Frontend production build | `npx vite build` | exit 0 | ✓ PASS |
| Deploy-drift gate | `bash scripts/check-deploy-drift.sh` | exit 0, 2 non-blocking WARNs (seed-candidates 093/094/098; docker-unavailable structural fallback) | ✓ PASS (does not check this invariant class — 158-REVIEW.md IN-05) |
| Live local DB has `setup_complete`? | `psycopg2` query against `127.0.0.1:54322` | `None` — column absent | Confirms 158-12 pending (expected, non-blocking) |
| `full-schema.sql` regenerated? | `grep -c setup_complete supabase/full-schema.sql` | `0` | Confirms 158-12 pending (expected, non-blocking) |
| Full backend suite — regression check | `pytest -q` on current HEAD | 191 failed, 2546 passed, 7 skipped, 5 xfailed, 9 xpassed, 1 error | ✓ MATCHES baseline below |
| Full backend suite — pre-158 baseline | `pytest -q` on commit `8d185b1b` (immediately pre-Phase-158), isolated `git worktree` | 191 failed, 2486 passed, 7 skipped, 5 xfailed, 9 xpassed, 1 error | ✓ IDENTICAL failure/error/skip/xfail/xpass set — the +60 passed is exactly the new setup tests; zero regression at the ASGI-middleware/lifespan-wiring layer this measures |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention applies to this phase. `scripts/check-deploy-drift.sh` is the phase's own probe-equivalent, independently re-run above (exit 0). Note: this script's four checks (preset keys, seed list, sandbox tag, compose parse) do not — and by design could not — detect CR-01's invariant class (a store-key declared in `setup_store.INFRA_KEYS` without a matching `Settings` field); that is a Python-object-shape check, not a deploy-artifact-text check.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DEPLOY-02 (STRETCH) | All 11 executed plans (`requirements: [DEPLOY-02]`) | "A first-run install wizard (browser flow at `/setup`, idempotent, locked out after finalize) walks a non-developer operator through environment detect → preset pick → Supabase/Redis bind → bootstrap operator → provider keys → smoke test" | ✗ BLOCKED | The "idempotent" and implicit "successfully completes" clauses are falsified by CR-01. |

No orphaned requirements: `REQUIREMENTS.md` maps DEPLOY-02 to Phase 158 only, and only Phase 158's plans declare it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/config.py` | 1174-1197 | Unguarded `setattr()` on a Pydantic model for keys not verified against `model_fields` | 🛑 BLOCKER | CR-01 — see above. |
| `backend/tests/test_setup_overlay.py` | 18, 46, 61, 74 | `SimpleNamespace` used as a `Settings` stand-in in all 4 tests | ⚠️ WARNING (root-cause contributor) | Structurally cannot detect CR-01's failure class; explains why 60-61 green tests coexisted with a reproducible crash. |
| `backend/tests/test_setup_idempotent.py` | 59-66 | `test_step_rerun_is_idempotent_no_duplicate_write` docstring promises a concrete per-step assertion the body never delivers (`assert hasattr(setup_api, "router")`) | ⚠️ WARNING (test hygiene) | The claim IS proven elsewhere (`test_provider_key_rerun_is_idempotent_single_write`, `test_operator_duplicate_returns_already_exists_200`) — this specific test is a stale, misleadingly-named placeholder. Recommend deleting or rewriting. |
| `backend/tests/test_setup_status.py` | 47-51 | `test_status_does_no_live_db_probe` docstring promises "Wave 2 asserts no asyncpg.connect is invoked" but the body is `assert hasattr(setup_service, "compute_setup_status")` | ⚠️ WARNING (test hygiene) | Independently verified true by direct source read (the function is synchronous, zero `await`/`asyncpg`) — but not via this test. Same cleanup recommendation. |
| `docs/OPERATOR.md` / `supabase/migrations/093,094,098` | — | Drift-check WARN: 3 migrations above the highest listed runbook seed (#089) carry non-boilerplate INSERT/UPDATE | ℹ️ INFO (non-blocking) | The tool working as designed — a human-review, documentation-currency question, not a functional defect. |

No `TBD`/`FIXME`/`XXX` debt markers found in any phase-158 production file. The `PLACEHOLDER` grep hits are legitimate pre-existing constant/comment uses, not stub markers.

### Human Verification Required

### 1. Live end-to-end wizard run — do not attempt until CR-01 is fixed

**Test:** From a clean checkout: fill real Supabase/Redis values (including the anon/publishable/secret keys) → `docker compose -f docker-compose.prod.yml up --build` → walk all 6 steps → Finalize → `docker compose restart backend`.
**Expected (post-fix):** The box stays up after restart; login succeeds; a second `/setup` visit shows the lock-out.
**Expected (pre-fix, i.e. right now):** The box will crash-loop on restart — this is not a useful UAT run until the code fix lands; running it now would simply reproduce CR-01 experientially rather than validate the phase.
**Why human:** Structurally needs a human at a browser against a real/local Supabase (Phase 157 D-09 analog).

### 2. Apply migration 102 + regenerate full-schema.sql (Plan 158-12)

**Test:** Paste `supabase/migrations/102_setup_complete.sql` into the local Supabase SQL editor (or psycopg2 to `127.0.0.1:54322`) → `bash scripts/regenerate-full-schema.sh` (no `--reset`).
**Expected:** `app_settings.setup_complete` exists on the live local DB; `supabase/full-schema.sql` contains `setup_complete`.
**Why human:** `autonomous: false` / `checkpoint:human-action gate="blocking"` per CLAUDE.md's migration discipline. Confirmed not yet done.

### 3. Review the drift-check's seed-candidate WARN (non-blocking, informational)

**Test:** Decide whether `093_skill_creator_sandbox_library_awareness.sql`, `094_starter_workflows.sql`, `098_feature_visibility.sql` need adding to the `docs/OPERATOR.md` Step-3 seed table.
**Expected:** A human judgment call, non-blocking.
**Why human:** Heuristic by the script's own design.

### Gaps Summary

One root-cause code defect (CR-01, `backend/app/config.py`'s `apply_setup_overlay`) falsifies two of the three ROADMAP Success Criteria. It is narrow (a 3-line fix: declare 3 missing `Settings` fields, optionally harden the overlay loop) but its blast radius is total — it bricks the backend on the wizard's own documented, mandated apply step, for the wizard's own central, UI-prompted use case (an operator who fills in the Supabase keys the form asks for). It was missed by 60-61 passing tests because the one test file that should have caught it (`test_setup_overlay.py`) mocks the `Settings` object as a `SimpleNamespace`, which cannot exhibit Pydantic's real validation behavior — the tests verify the OVERLAY LOGIC's polarity (store-wins) correctly, but never verify it against the REAL target object's shape.

Everything else this phase built is genuinely solid: the token gate, the finalize lock-out, the byte-identical middleware invariant (proven three independent ways including a full-suite pre/post regression diff), the 9 frontend components, the drift-check, and the migration authoring are all real, substantive, and wired — confirmed by direct reading, not SUMMARY-trust. A second critical finding from a parallel review (CR-02, the gate/entry-signal mismatch for hand-filled boxes) was found already resolved by a live fix commit during this verification session and is not an open gap.

**Recommended next step:** a small closure plan for CR-01 (declare the 3 fields + harden the overlay + fix the `SimpleNamespace` test gap), followed by re-verification, THEN the two human-gated steps (live UAT, migration apply) — attempting the live UAT before the code fix would only reproduce the crash.

---

_Verified: 2026-07-17_
_Verifier: Claude (gsd-verifier)_
