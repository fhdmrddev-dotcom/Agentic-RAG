---
phase: 276-public-docs-api-reference-video-library
plan: 01
subsystem: api-docs, brand
tags: [docs-04, docs-03, docs-06, openapi, fastapi, brand, logo]
requires: []
provides:
  - "backend/app/api/api_docs.py: production-gated /docs, /redoc, /openapi.json, /docs/oauth2-redirect"
  - "scripts/export-openapi.py: build_snapshot() (one home for the snapshot + drift test)"
  - "scripts/build-public-openapi.cjs: snapshot -> docs/public/api/openapi.public.json, --check"
  - "docs/public/api/openapi.public.json: public 'Syrel API' spec (for 276-03's API reference page)"
  - "Iris logo on landing nav/footer, app header, login card, favicon, video LogoPlaceholder"
affects: [276-03 (reads openapi.public.json, inherits Navigation brand block), 276-05 (re-derives ledger triples)]
tech-stack:
  added: []
  patterns:
    - "optional HTTPBearer(auto_error=False) + explicit 401 for a sign-in gate (FastAPI 0.115.6 answers a missing header with 403)"
    - "settings read per request, never at import, so the gate tracks the live env"
    - "brand SVGs placed as <img>, never inline (shared gradient ids g/h)"
key-files:
  created:
    - backend/app/api/api_docs.py
    - backend/tests/unit/test_276_api_docs_gate.py
    - backend/tests/unit/test_276_openapi_snapshot_fresh.py
    - scripts/export-openapi.py
    - scripts/build-public-openapi.cjs
    - docs/public/api/openapi.public.json
    - frontend/src/docs/__tests__/publicOpenapi.test.ts
    - .github/workflows/public-openapi.yml
    - frontend/public/brand/syrel-lockup-iris.svg
    - frontend/public/brand/syrel-mark-iris.svg
    - frontend/src/landing/__tests__/landingBrand.test.ts
    - .planning/phases/276-public-docs-api-reference-video-library/deferred-items.md
  modified:
    - backend/app/main.py
    - deploy/onebox.env.example
    - docs/OPERATOR.md
    - docs/DEPLOYMENT-WORKFLOW.md
    - frontend/public/favicon.svg
    - frontend/index.html
    - frontend/app.html
    - frontend/src/landing/components/Navigation.tsx
    - frontend/src/landing/components/LandingFooter.tsx
    - frontend/src/landing/components/CompareSection.tsx
    - frontend/src/landing/__tests__/LandingPage.test.tsx
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/auth/AuthCardShell.tsx
    - frontend/src/pages/AuthPage.tsx
    - video/src/components/ui.tsx
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "DOCS-04 implemented as FastAPI(docs_url=None, redoc_url=None, openapi_url=None) + a router serving the same four paths behind one router-level dependency; the token check is the existing get_current_user called directly"
  - "Public spec version is derived from docs/history (newest file whose Shipped value starts with a date): 4.4"
  - "Untagged /health and /models get tag 'system' (System group); knowledge-health and library tags join the Documents group (IA grouping row omitted them)"
  - "Secret scan uses key-shaped patterns (sk-<8+ key chars>, eyJ<10+>), because the literal 'sk-' occurs in 'Task-1' inside a surviving docstring"
  - "Video LogoPlaceholder keeps its export name and size prop; renders the mark + lowercase 'syrel' in a size x size box"
metrics:
  duration: "~1h40m"
  completed: 2026-10-04
  tasks: 3
  files: 29
---

# Phase 276 Plan 01: Gated API docs, public Syrel API spec, Iris logo pass Summary

Production now refuses unauthenticated `/docs`, `/redoc` and `/openapi.json` (401, sign-in only) while local stays open; the OpenAPI snapshot has a drift test and a filtered public "Syrel API" spec with a `--check` CI backstop; and the Iris logo replaces the placeholder on the landing, app header, login card, favicon and video scenes in one commit.

## What was built

### Task 1 — DOCS-04 gated live API explorer (`f2f71923e` RED, `0b110f39f` GREEN)
- `backend/app/api/api_docs.py`: `_docs_gated()` reads `settings.environment` per request (`production`/`prod`, case and spaces ignored). `require_api_docs_access` returns at once when not gated; when gated, no bearer gives 401 `"Sign in to view the API reference."` with `WWW-Authenticate: Bearer`; a bearer goes through the existing `get_current_user` (401 bad token, 503 auth unreachable, 403 banned). All four routes are `include_in_schema=False`. `/openapi.json` returns `request.app.openapi()`, so the Phase 182 canvas filter still applies.
- `main.py`: `docs_url=None, redoc_url=None, openapi_url=None` in the constructor; `api_docs` import + one `include_router`; one boot log line `API docs: GATED (...)` / `API docs: OPEN (...)` (D-20); the Phase 182 sentence struck through with `CORRECTED 2026-10-04 (Phase 276, D-03, operator-approved)`. `app.openapi = build_canvas_aware_openapi(app)` unchanged.
- `ENVIRONMENT` meaning corrected (strike + reason) in `deploy/onebox.env.example` and `docs/OPERATOR.md`; `docs/DEPLOYMENT-WORKFLOW.md` gained §5 rows (Coolify `ENVIRONMENT=production`, Vercel "Include source files outside of the Root Directory" ON), a §6 post-deploy `curl ... /docs` must print `401`, and a changelog line. Nothing was deployed or pushed.
- RED (seen failing before `api_docs.py` existed, 8 of 18): `test_production_refuses_unauthenticated_docs_with_401[/docs|/redoc|/openapi.json|/docs/oauth2-redirect]`, `test_production_spellings_also_gate[prod| Production |PRODUCTION]`, `test_production_refuses_an_invalid_bearer`. GREEN: 18/18.

### Task 2 — snapshot freshness + public spec (`659bf75d7` RED, `c66f0689e` GREEN, `ab3db5218` fix)
- `scripts/export-openapi.py`: `build_snapshot()` = `FastAPI.openapi(app)` (class method, no canvas hook, no DB) minus `/__test__`; writes `indent=1`, ASCII-escaped, no trailing newline. Running it after `api_docs` was mounted left `docs/public/api/openapi.snapshot.json` byte-identical (`git diff --exit-code` exit 0): **231 paths / 282 ops / 216 schemas**.
- `test_276_openapi_snapshot_fresh.py` loads `build_snapshot` via importlib (one home). Falsified by deleting `/document-search` from the snapshot: the test failed; snapshot restored.
- `scripts/build-public-openapi.cjs` → `docs/public/api/openapi.public.json`: **189 paths / 232 ops / 204 schemas**, title "Syrel API", version **4.4** (derived; 27 history files parsed, v4.5 reads "in progress"), description states no API keys / PATs / service accounts and SEED-013. Drops all 22 `/admin` paths (D-16), `/setup/*`, `/public-config`, both OAuth callbacks, `/evals/*`, `/api/sources/*`, `/__test__/*`. `x-badges` "UI-internal: may change" on `/knowledge-health/*` (8 ops) and the five other flagged paths (D-17). `x-tagGroups` = the 7 IA groups. Reusable `X-Org-Id` header parameter. No `servers` entry. Orphan schemas pruned by `$ref` closure.
- **V45_OPERATIONS confirmed against the snapshot:** `post /document-search` (Phase 271) and `post /documents/{document_id}/download-url` (Phase 270). Both carry "Not yet released". A missing listed op exits 1 `[missing-v45-op] <op>`; an ungrouped tag exits 1 `[ungrouped-tag] <tag>`.
- `publicOpenapi.test.ts` (node env, 11 tests) drives the missing-op, ungrouped-tag and `--check` drift arms on temp copies. `.github/workflows/public-openapi.yml` runs `--check`.
- RED: snapshot test failed with `FileNotFoundError: scripts/export-openapi.py`; vitest failed with `Cannot find module scripts/build-public-openapi.cjs`.

### Task 3 — one-pass Iris logo + rename (`6487c22a9`, ONE commit, D-14)
- `frontend/public/brand/` lockup + mark copied unchanged from `docs/brand/`; `favicon.svg` = the mark.
- `Navigation.tsx` brand block → `<a href="/" aria-label="Syrel home"><img src="/brand/syrel-lockup-iris.svg" height={28} alt="" aria-hidden></a>` (links untouched — 276-03's job). `LandingFooter.tsx` mark img + "© {year} Syrel", font 13 → 14. `CompareSection.tsx` two `<th>` → "Syrel". `index.html` / `app.html` titles + descriptions → Syrel.
- `NavPanel.tsx` and `AuthCardShell.tsx`: Sparkles tile → Iris mark `<img alt="Syrel">`, unused `Sparkles` imports dropped. `AuthPage.tsx` title → "Syrel" (D-21).
- `video/src/components/ui.tsx` `LogoPlaceholder`: same export and `size` prop; renders the mark + lowercase "syrel" with `useId()`-suffixed gradient ids. Animated logo not used on any page (`syrel-logo-iris-animated` count in `frontend/src`: 0, D-15).
- `landingBrand.test.ts`: zero old-name matches across `src/landing` + `index.html`, refuses under 20 scanned files.

## Verification

| Check | Result |
|---|---|
| `pytest test_276_api_docs_gate.py test_182_canvas_auth.py tests/test_182_canvas_gate.py tests/test_184_uat02_staleness_bound.py` | 39 passed, **1 failed — inherited** (see Deferred) |
| `pytest test_276_*.py` | 20 passed |
| `node scripts/check-backend-unit-baseline.cjs` | `[GATE PASSED]` 71 failed, 6779 passed, 0 errors (ceiling 71) |
| `node scripts/build-public-openapi.cjs --check` | exit 0 — `189/231 paths, 204 schemas, version 4.4` |
| `npx vitest run src/landing src/docs/__tests__/publicOpenapi.test.ts src/components/layout src/components/auth src/pages/__tests__` | 41 files / 542 tests passed |
| `npx tsc -p tsconfig.app.json --noEmit` set diff | base 70 errors (measured after the TS2591 fix) → after 70; **0 new** |
| `bash scripts/check-deploy-drift.sh` | `RESULT: PASS` (1 WARN: docker compose denied, structural fallback) |
| `node scripts/check-claude-md-size.cjs` | `claude-md size gate OK` — CLAUDE.md 119,517 chars before Task 3 (under 120,000); row edits net ≤ 0 |
| `node scripts/check-hot-file-ledger.cjs 276` | `ledger gate OK — every watched file has a row.` (scan list 442 rows · subject 154 files · watched 39) |
| `node scripts/check-landing-drift.cjs` | exit 1 — `BUILTIN_TOOL_COUNT` source 30 vs facts.ts 29. **Inherited (D-22), not fixed.** |
| Acceptance greps | main.py: ctor kwargs 1, include 1, CORRECTED 1, canvas hook 1; Navigation lockup 1; mark 1 per NavPanel / AuthCardShell / LandingFooter; old name in `src/landing` + `index.html`: none |
| vitest count gate (`GSD_VITEST_MAX_WORKERS=2`, repo root, verbatim) | `total 9631 · failed 0 · pinned total 8874` / `count gate OK — 389/389 pinned files present, no per-file decrease, 0 failing.` (first run; cap not adjusted) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2591 in the new publicOpenapi test**
- **Found during:** Task 3 tsc baseline.
- **Issue:** the test used the `process` global; `tsconfig.app.json` has no node types, adding 1 new error.
- **Fix:** read `execPath` from `vi.importActual("node:process")`.
- **Commit:** `ab3db5218`

**2. [Rule 1 - Bug] Secret scan pattern**
- **Issue:** the plan's literal "no `sk-`" check would fail on "Task-1" in a surviving operation docstring (not a secret).
- **Fix:** the test asserts key-shaped patterns (`sk-` followed by 8+ key characters at a word start, `eyJ` + 10+), plus `supabase.co` and an email pattern.

**3. Tag-group additions**
- The IA grouping row omits `knowledge-health`, `library` and the untagged `/health` / `/models`. They are flagged or system routes that survive the filter, so `knowledge-health` and `library` join **Documents** and the two system routes get tag `system` (**System** group). Without this the ungrouped-tag rule would refuse the build.

**4. Badge description prefix**
- Flagged and v4.5 operations also get a bold prefix in their `description` (in addition to `x-badges`), the fallback RESEARCH A8 names in case the renderer ignores `x-badges`.

## Deferred Issues

- `backend/tests/test_182_canvas_gate.py::test_openapi_tracks_the_flag_in_both_directions_in_one_process` is **red at base `2b756b1cd`**. Shown by checking out the base `main.py`, re-running (still red), then restoring. The test's `_CANVAS_PATHS` constant is missing `/workflow-runs` and `/workflow-runs/{workflow_run_id}/phases/{phase_slug}/citations`, which the canvas filter now also hides. The file is outside `tests/unit` and the baseline gate. Logged in `deferred-items.md`.
- `video/src/components/ui.tsx` could not be fully type-checked in this worktree (`video/node_modules` is not junctioned, and adding a junction is unsafe for teardown). A TypeScript transpile syntax check gave 0 diagnostics. The full check is owed on the merged tree (276-05).

## Owed (operator / later plans)

- Post-deploy: `curl -s -o /dev/null -w '%{http_code}' https://<api-host>/docs` must print `401`; Coolify backend needs `ENVIRONMENT=production`; Vercel "Include source files outside of the Root Directory" ON (D-23). Not deployed.
- 276-02 owns adopting `src/docs` into the vitest count gate's TARGETS/BASELINE; `publicOpenapi.test.ts` is not gated until then.
- A browser cannot send a bearer on address-bar navigation, so in production the live explorer works only from clients that inject a header (accepted, D-20). The public reference is the browser path.

## Known Stubs

None. The public spec has real data; the brand assets are final.

## Threat Flags

None beyond the plan's threat model. T-276-01/02/03/04/06 are mitigated as planned; T-276-05 is accepted (the oauth2-redirect page sits behind the same gate).

## TDD Gate Compliance

Task 1: `test(...)` f2f71923e → `feat(...)` 0b110f39f. Task 2: `test(...)` 659bf75d7 → `feat(...)` c66f0689e. Both RED runs were seen failing before implementation.

## Self-Check: PASSED

All 8 key created files are present. All 6 commits (`f2f71923e`, `0b110f39f`, `659bf75d7`, `c66f0689e`, `ab3db5218`, `6487c22a9`) are in `git log`. STATE.md and ROADMAP.md were not modified (the orchestrator owns them).
