---
phase: 182-server-validation-seam
plan: 02
subsystem: api
tags: [python, fastapi, pydantic, pytest, tdd, workflow-authoring, validation-seam, anti-drift, feature-flag]

# Dependency graph
requires:
  - phase: 182-server-validation-seam
    provides: "182-01's harness/grounding.py — assemble_grounding_bundle / grounding_verdicts / business_requirement_missing (the ONE shared grounding source both routes consume)"
  - phase: 181-revert-foundation
    provides: "require_canvas() — the byte-identical-404-when-off gate (pre-auth, operators included) both new routes attach"
  - phase: 102-publish-gauntlet
    provides: "reachability.lint_workflow (pure, imported module-direct) + publish_service._interactive_phase_failures (module-level pure) — reused verbatim, zero adaptation"
  - phase: 103-nl-workflow-authoring
    provides: "api/workflows.py router + create_draft raw-WorkflowDefinition-body pattern + _coerce_user_id + the co-located route-model convention"
provides:
  - "POST /workflows/validate — the SINGLE SOURCE OF VALIDATION TRUTH: a {ok, verdicts} envelope aggregating the FULL static publish gauntlet (lint + grounding fidelity + business_requirement + interactive-phase), per-node keyed, severity-classified, always HTTP 200, read-only"
  - "GET /workflows/grounding-bundle — the cacheable server-sourced palette {tools, folders, skills, template_placeholders} Phase 184's node-config dropdowns bind to (never a frontend constant)"
  - "Verdict / ValidateResponse / GroundingBundleResponse route models + the _severity classifier (the D-182-03 taxonomy incl. the no_terminal empty-vs-broken split)"
  - "backend/tests/unit/test_182_validate.py — the 12-test verdict matrix (every code, per-node keying, both severities, ok semantics, structural gate assertion)"
  - "backend/tests/test_182_grounding_bundle.py — 6 offline tests: 404-never-403 both callers + unbuilt-route parity, real-registry server-sourcing proof, faked-bundle field mapping, malformed-id 422, structural gate assertion"
affects: [182-03-canary-retirement, 183-read-only-canvas, 184-node-config-panel, 185-graded-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aggregate-and-classify route: the handler CALLS the verbatim checks and only assigns severity — it never owns a rule"
    - "Same lint code, split severity by definition state (no_terminal: empty draft = incomplete, unreachable terminal = error)"
    - "Read-only advice endpoint: always 200 with a machine-renderable verdict envelope; the enforcing gate stays at publish"
    - "Structural gate assertion via route dependant qualnames (require_canvas.<locals>._dep vs require_visible.<locals>._dep) — proves the gate WITHOUT a live flag/DB"
    - "Offline server-sourcing proof: let the REAL assembler run against the conftest mock supabase so the pure in-process registry (get_tools) proves the palette is not a constant"

key-files:
  created:
    - backend/tests/unit/test_182_validate.py
    - backend/tests/test_182_grounding_bundle.py
  modified:
    - backend/app/api/workflows.py

key-decisions:
  - "Both routes are declared as explicit STATIC segments immediately after GET /starters — AHEAD of every /{definition_id} route (the /drafts precedent) — so no present or future path param can shadow them"
  - "template_asset_id is typed UUID | None (not str) — a free 422 on a malformed query value instead of a silent degrade to [], and consistent with GenerateRequest.template_asset_id in the same file"
  - "The pg pool is resolved LAZILY (only when template_asset_id is supplied) — the base palette read never forces pool creation, which also makes the 200-shape test provable fully offline"
  - "Took the plan's explicit OR: the bundle shape is proven OFFLINE (no psycopg2 live-DB skip guard). A DSN-reachability guard would prove Postgres is up, not that the palette is right — the palette flows through supabase-py, which conftest overrides with a mock either way. The stronger always-running proof is asserting `tools` contains the REAL registry (search_documents)"
  - "grounding is imported as a MODULE (grounding.<fn>) for the file's stated patchability discipline; lint_workflow is imported module-direct from reachability by NAME to keep the pure-import property intact (Pitfall 1)"
  - "VALID-01 marked COMPLETE here: its text ('the server exposes POST /workflows/validate that reuses lint_workflow + grounding-fidelity verbatim') is literally true as of this plan. Plan 03 (canary retirement) also declares the ID but adds no route — 182-01 deliberately deferred the mark to whichever plan made the text true"

patterns-established:
  - "Classify, never re-implement: a seam that previews another gate's rules imports every check verbatim and adds exactly one interpretive layer (severity)"
  - "Prove a route's GATE structurally (inspect dependant.dependencies qualnames) so the assertion survives flag/DB state and cannot silently pass on a stacked 403 dependency"
  - "Baseline-diff a suspicious failure set by checking out the pre-plan file version, re-running the identical set, and comparing counts before touching anything"

requirements-completed: [VALID-01]

# Metrics
duration: 22min
completed: 2026-07-24
---

# Phase 182 Plan 02: Server Validation Seam Routes Summary

**`POST /workflows/validate` now returns the full static publish gauntlet as a per-node, severity-classified `{ok, verdicts}` envelope — and `GET /workflows/grounding-bundle` serves the server-computed palette — both reusing every existing check verbatim behind Phase 181's byte-identical-404 canvas gate.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-24T18:53:48Z
- **Completed:** 2026-07-24T19:15:00Z (approx.)
- **Tasks:** 2 (Task 1 executed TDD: RED then GREEN)
- **Files modified:** 3 (2 created, 1 modified) — +831 / −2 lines

## Accomplishments

- **VALID-01 is delivered.** `POST /workflows/validate` exists, takes a raw `WorkflowDefinition`, and returns `{ok, verdicts}` aggregating **all four** static publish blockers — structural lint, grounding fidelity, the D-13 business requirement, and the WR-04 interactive-phase block. The canvas can now preview *everything* that would bounce it at publish, from one server-side source.
- **Nothing was re-implemented.** The handler calls `lint_workflow` (module-direct from `reachability`), `grounding.grounding_verdicts`, `grounding.business_requirement_missing`, and `publish_service._interactive_phase_failures` — the SAME copies publish stage 1/2/2.5 call, and the same shared grounding module 182-01 extracted. The route's only interpretive act is assigning `severity`. This is the anti-drift mechanism the whole phase exists for (D-182-06 / red line D-14).
- **The `no_terminal` trap is handled** (Pitfall 2). `lint_workflow` emits one code for two very different situations. `_severity` splits them off the definition the route already holds: `phases == []` → `incomplete` (an empty canvas paints grey "still building"), an unreachable terminal → `error` (red "this is broken"). Both cases are pinned by their own test.
- **`ok` is honest.** `ok == (verdicts == [])`, so an `incomplete`-only verdict set still blocks — severity is an orthogonal UI hint, not a pass/fail axis. Pinned by a test that asserts `ok is False` for a definition whose ONLY finding is a missing business requirement.
- **The palette is provably server-sourced.** `GET /workflows/grounding-bundle` returns `{tools, folders, skills, template_placeholders}` straight off `assemble_grounding_bundle`. The test proves `tools` is the genuine in-process tool registry (it contains `search_documents`, and is sorted) — not a literal authored in the route and not a frontend constant (Pitfall 1 / SC#2).
- **Both routes gate on `require_canvas` ALONE.** Never stacked with `require_visible` (which raises 403 and would leak route existence when the canvas is on but authoring visibility is restricted — Pitfall 3). Proven two ways: a live 404-never-403 probe for an operator AND an end user with unbuilt-route body parity, plus a *structural* assertion on the route's dependency qualnames that holds regardless of flag or DB state.
- **`/validate` is read-only by construction** — no `pool`, no write helper, no publish call anywhere in the handler; always HTTP 200. Publish remains the only enforcing gate (T-182-04).
- **Zero regressions.** Equivalent-scope suite: **62 failed / 1411 passed** vs 182-01's **62 failed / 1393 passed** — exactly +18 net-new tests, no new failures.

## Task Commits

Each task was committed atomically (Task 1 carried `tdd="true"`, so it is a RED/GREEN pair):

1. **Task 1 — RED:** verdict-set backstop, 12 failing tests — `d2b19551` (test)
2. **Task 1 — GREEN:** `Verdict` / `ValidateResponse` / `_severity` + `POST /workflows/validate` — `0613dccd` (feat)
3. **Task 2:** `GroundingBundleResponse` + `GET /workflows/grounding-bundle` + its 6 tests — `423a9f1d` (feat)

**Plan metadata:** see the `docs(182-02)` commit that carries this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified

- `backend/app/api/workflows.py` (**MODIFIED**, +267/−2) — a new `Phase 182 (VALID-01) — the server VALIDATION SEAM` section inserted after `GET /starters` and AHEAD of every `/{definition_id}` route:
  - `Verdict` (`code` / `phase` / `message` / `severity: Literal["error","incomplete"]`), `ValidateResponse` (`ok` + `verdicts`), `GroundingBundleResponse` (`tools` / `folders` / `skills` / `template_placeholders`);
  - `_ERROR_CODES` + `_severity(code, *, phases_empty)` — the D-182-03 taxonomy with the `no_terminal` split;
  - `POST /validate` — `dependencies=[Depends(require_canvas())]`, body `WorkflowDefinition` (422 for free via `extra="forbid"`), aggregates the 4 verbatim checks, always 200;
  - `GET /grounding-bundle` — `dependencies=[Depends(require_canvas())]`, optional `?template_asset_id=` (UUID), lazily-resolved pool, owner-scoped read;
  - imports: `Literal`, `require_canvas`, `from app.services.harness import grounding, publish_service`, and `from app.services.harness.reachability import lint_workflow` (module-direct — the exact literal the plan's key-link pins).
- `backend/tests/unit/test_182_validate.py` (**NEW**, 364 lines, 12 tests) — the verdict matrix. Clean-definition `ok`; all five lint codes; `unregistered_tool` / `unregistered_skill` keyed to their phase slug; `folder_scope` as workflow-global with the slug in the message; `business_requirement` + `interactive_phase`; the `no_terminal` empty(incomplete)-vs-unreachable(error) split; `input_unsatisfied` as incomplete; a closed-taxonomy assertion; and the structural `require_canvas`-alone gate assertion. Fully offline — the handler is called directly with `grounding.assemble_grounding_bundle` monkeypatched to a fake bundle.
- `backend/tests/test_182_grounding_bundle.py` (**NEW**, 202 lines, 6 tests) — flag-off 404 (asserted `!= 403`) for operator AND user + unbuilt-route body parity; the real-registry server-sourcing proof; a fully-faked bundle proving field-by-field mapping (and that the fidelity-only `tool_names`/`skill_ids` sets do NOT leak onto the wire); the malformed-`template_asset_id` 422; the structural gate assertion.

## Decisions Made

- **Route placement / ordering.** Declared as explicit STATIC segments right after `GET /starters`, i.e. before `PATCH /{definition_id}` and `DELETE /{definition_id}`. There is no `GET /{definition_id}` today, but the `/drafts` precedent is "static before path-param", and placing them at the end of the file would have left a future `GET /{definition_id}` free to shadow `/grounding-bundle`. `_coerce_user_id` is defined further down and resolves at request time (noted in a comment).
- **`template_asset_id: UUID | None`** rather than the plan's `str | None` — see Deviations #1.
- **Lazy pool resolution.** `pool = await get_pg_pool() if template_asset_id is not None else None`. `assemble_grounding_bundle` needs a pool ONLY to resolve a template asset's bytes (`_resolve_template_placeholders` returns `[]` before touching `pool` when no asset id is given), so the base palette read never forces asyncpg pool creation — and the 200-shape test is provable with no live DB. Bundle output is identical either way.
- **`project_folder_id` is not passed to the bundle from either route.** It does not affect the palette (a bound project narrows only the per-phase `folder_scope` ⊆ check, which `assert_folder_scopes_subset` reads off the definition itself, plus the NL prose line). Passing it would have implied a coupling that does not exist.
- **Import style, split deliberately.** `grounding` as a MODULE (`grounding.assemble_grounding_bundle(...)`) so the shared source stays monkeypatchable — the file's own stated discipline ("imported as MODULES so the route's delegate stays patchable in tests"), and the seam every 182-02 test uses. `lint_workflow` by NAME from `app.services.harness.reachability` — the module-direct import that keeps `reachability`'s documented pure-import property (Pitfall 1) and the literal the plan's key-link greps for.
- **Offline bundle-shape proof over the live-DB skip guard** (the plan's explicit OR). A `POSTGRES_DSN` psycopg2 guard proves Postgres is reachable, not that the palette is correct: the palette reads flow through `supabase-py`, which conftest overrides with a MagicMock for every TestClient request, so a "live-guarded" route test would still read the mock. The always-running substitute is stronger — let the REAL assembler run and assert `tools` is the genuine `get_tools(None)` registry (contains `search_documents`, sorted), plus a fully-faked bundle for exact field mapping.
- **The gate is asserted structurally, not only behaviorally.** A behavioral 404 probe can't distinguish "gated by `require_canvas`" from "gated by something else that also 404s", and a stacked `require_visible` would be invisible while its audience is `everyone`. Inspecting the route's `dependant.dependencies` qualnames (`require_canvas.<locals>._dep` vs `require_visible.<locals>._dep`) pins the acceptance criterion exactly, for both routes.
- **VALID-01 marked complete.** Its text — "The server exposes `POST /workflows/validate` that reuses the existing `reachability.lint_workflow` + grounding-fidelity checks verbatim … the canvas never re-implements the rules client-side" — is literally true as of `0613dccd` (and no frontend file was touched at all). 182-01 deliberately left it `Pending` for exactly this plan; plan 03 (canary retirement) also declares the ID but adds no route, so a re-mark there is idempotent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Typed `template_asset_id` as `UUID | None` instead of the plan's `str | None`**
- **Found during:** Task 2 (`GET /grounding-bundle`)
- **Issue:** The plan's action text specified `template_asset_id: str | None = None`. With `str`, a malformed value (`?template_asset_id=not-a-uuid`) flows into `_resolve_template_placeholders` → `resolve_template_source`, misses, and is swallowed by that function's broad `except` → the caller gets a silent `200` with `template_placeholders: []`, indistinguishable from "this template has no placeholders". That is a V5 input-validation gap on the phase's only other net-new input surface, and it contradicts the same file's existing `GenerateRequest.template_asset_id: UUID | None`.
- **Fix:** Typed the query param `UUID | None`. FastAPI coerces and returns a **422** for a malformed id (the same posture RESEARCH names — "path/query UUIDs coerced by FastAPI"), and `_resolve_template_placeholders` accepts a `UUID` unchanged (it does `str(template_asset_id)` internally).
- **Files modified:** `backend/app/api/workflows.py`, `backend/tests/test_182_grounding_bundle.py`
- **Verification:** `test_grounding_bundle_rejects_a_malformed_template_asset_id` asserts the 422; the no-param path still returns `template_placeholders: []` (`test_grounding_bundle_returns_server_sourced_palette`).
- **Committed in:** `423a9f1d` (Task 2 commit)

**2. [Rule 3 - Blocking] Resolved the pg pool lazily so the palette route is testable offline**
- **Found during:** Task 2 (`GET /grounding-bundle`)
- **Issue:** The plan says to "get the pg pool via the existing `get_pg_pool()` helper". Called unconditionally, `await get_pg_pool()` opens a real asyncpg pool on the FIRST line of the handler — before the assembler is even reached. That makes Task 2's own verification gate (`pytest tests/test_182_grounding_bundle.py`) dependent on a live Postgres for the 200-shape read, even with `assemble_grounding_bundle` monkeypatched, and it forces pool creation in production for a read that never uses it.
- **Fix:** `pool = await get_pg_pool() if template_asset_id is not None else None`. The pool is needed ONLY to resolve a template asset's bytes; `_resolve_template_placeholders` returns `[]` before touching `pool` when no asset id is supplied, so the bundle result is byte-identical for the base palette.
- **Files modified:** `backend/app/api/workflows.py`
- **Verification:** all 6 bundle tests pass with no live DB; the `?template_asset_id=` path still receives a real pool (unchanged code path into `assemble_grounding_bundle`).
- **Committed in:** `423a9f1d` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed a wrong unbuilt-route parity probe in my own new test**
- **Found during:** Task 2 (first run of the new test file)
- **Issue:** I copied `test_revert_byte_identical.py`'s parity probe shape (`GET /canvas/__definitely_not_a_route__` → 404) onto `/workflows`. It fails there: a single unknown segment under `/workflows` MATCHES `PATCH`/`DELETE /workflows/{definition_id}` path-wise, so a `GET` returns **405 Method Not Allowed**, not 404. The assertion failed comparing `{"detail": "Not Found"}` to `{"detail": "Method Not Allowed"}`.
- **Fix:** the parity probe now uses a two-segment path no route can match (`/workflows/__nope__/__nope__` — every 2-segment workflow route has a literal second segment), with a comment recording why. The assertion is now the stronger `resp.json() == unknown.json() == {"detail": "Not Found"}`.
- **Files modified:** `backend/tests/test_182_grounding_bundle.py`
- **Verification:** 6/6 green; the probe genuinely returns 404 (asserted before the comparison).
- **Committed in:** `423a9f1d` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing-critical, 1 bug — all inside this plan's own files)
**Impact on plan:** None on scope. No new dependency, no migration, no frontend file, no third route, no change to any existing route or check. Two deviations harden/enable the plan's own acceptance gates; one fixed a defect in a test I wrote.

## Issues Encountered

- **Full-tree vs unit-tier baseline.** The carried-forward baseline (**62 failed / 1393 passed**) is the *unit tier plus the 182 test files*, not the whole `tests/` tree — a full `pytest -q` is **200 failed / 2984 passed** because `tests/integration/` needs live services. Measured on the matching scope (`tests/unit` + `tests/test_182_extraction_parity.py` + `tests/test_182_grounding_bundle.py`): **62 failed / 1411 passed** = the identical 62 pre-existing failures and exactly +18 net-new passing tests.
- **Five workflow-named failures in a broad `-k "workflow or canvas or …"` sweep were confirmed PRE-EXISTING** by baseline-diff, not inspection: checked out `ea1c8b58`'s `backend/app/api/workflows.py`, re-ran the identical set (`test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org` + `test_dual_mode_wiring.py` + `test_thread_workflow_endpoint.py`) → **17 failed / 44 passed**, then restored my version → **17 failed / 44 passed**. Byte-identical both sides. (Root causes are old: `test_published_workflows_list_endpoint` still expects the pre-103 response shape without the additive `definition` key; the others are unrelated harness/thread rot.) Not fixed — out of scope.
- **Both `require_canvas()` and `require_visible()` return a closure literally named `_dep`,** so a gate assertion cannot key on `__name__`. `__qualname__` (`require_canvas.<locals>._dep`) distinguishes them; the two structural tests use that.

## Known Stubs

None. Every symbol is a real route, a real model, or a real test. No hardcoded empty value flows to a UI (the `template_placeholders: []` default is the documented per-template semantics, not a placeholder), and no `TODO`/`FIXME` was introduced.

## Threat Flags

None beyond the plan's own register — every net-new surface was anticipated and is mitigated:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-182-01** Information Disclosure (route-existence leak) | mitigated | Both routes carry `Depends(require_canvas())` and NOTHING else; `require_visible` appears nowhere on them. Proven behaviorally (404, asserted `!= 403`, for operator AND user, with unbuilt-route body parity) AND structurally (dependency-qualname assertions on both routes). |
| **T-182-02** Tampering (body parsing) | mitigated | `POST /validate` takes `body: WorkflowDefinition` (`extra="forbid"`) — never relaxed to a dict. A `folder_scope` on an unbound workflow 422s at the shape tier before the handler; the query param is now UUID-coerced (Deviation #1). |
| **T-182-03** Information Disclosure (palette widening) | mitigated | Both routes pass only `user_id=str(_coerce_user_id(current_user))` into the shared assembler, whose reads are hand-scoped on `user_id`; no route accepts or forwards a caller-supplied user/org id. |
| **T-182-04** Tampering/Elevation (bypassing the whitelist) | mitigated | All checks run server-side off the server-computed bundle. `/validate` holds no pool, performs no write, calls no publish/executor, and always returns 200 — read-only advice; publish stays the enforcing gate. |
| **T-182-SC** Supply chain | accepted (satisfied) | Zero installs — no `requirements.txt` change, no new import outside the repo. |

## Deployment-Artifact Parity

No action required. Neither route reads a new `settings.*` attribute, and this plan adds no env var, no migration, no seed row, no bundled service, and no `SANDBOX_IMAGE` change — so `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` and the sandbox tag are all unaffected (`scripts/check-deploy-drift.sh` has nothing to flag). The routes are reachable only when an operator flips `visual_workflow_canvas` on; its cold default is `"off"` (404 for everyone), so a cloud deploy of this code is a no-op until that flip.

## TDD Gate Compliance

Task 1 carried `tdd="true"` and ran a clean gate sequence:

| Gate | Commit | Evidence |
|---|---|---|
| RED | `d2b19551` (`test`) | 12 tests written first, all failing for the right reason — `AssertionError: route POST /workflows/validate is not mounted` / missing handler. No test passed unexpectedly. |
| GREEN | `0613dccd` (`feat`) | Same 12 tests, 12 passed, zero test-file edits between RED and GREEN. |
| REFACTOR | — | Not needed; no cleanup pass changed behavior, so no empty `refactor` commit was manufactured. |

Task 2 was not TDD-flagged (plan authored it as a single implement+test task) and shipped as one `feat` commit.

## User Setup Required

None. No env var, no migration, no external service, no operator action to land this code.

**To exercise the routes live** (not required by this plan): an operator flips `visual_workflow_canvas` to an `everyone`/`role` audience in the feature-visibility map. Until then both routes return the byte-identical 404 for everyone, operators included — which is the intended REVERT posture, and is what the tests assert.

## Next Phase Readiness

**Ready for 182-03 (canary retirement + test repointing).** Both real routes now exist, so the throwaway `GET /canvas/ping` canary's job is done:

- `GET /workflows/grounding-bundle` is the clean drop-in for every `/canvas/ping` assertion — a GET with no body confound (Pitfall 5), and `test_grounding_bundle_404s_when_off_for_operator` / `..._for_user` in this plan are already the repointed shape (copy them, don't reinvent).
- For `test_canvas_ping_200_after_flip_on`, the flip-on 200 is provable offline exactly as `test_grounding_bundle_returns_server_sourced_palette` does it: `_flipped_on(monkeypatch)` + patch `deps.authenticate_canvas_request` to inject a caller + patch `deps.is_operator` false. **No live DB or `assemble_grounding_bundle` monkeypatch is needed** — the real assembler resolves cleanly against conftest's mock supabase (folders/skills → `[]`, tools → the real registry).
- For the `POST /workflows/validate` 404-when-off probe, send a MINIMAL VALID body so only the flag can 404. A working minimal body: `{"slug": "x", "version": 1, "name": "X", "phases": []}` (`phases: []` is shape-valid; it would otherwise return an `incomplete` `no_terminal`).
- The pre-auth 404 test must keep popping the `get_current_user` override and leaving `authenticate_canvas_request` REAL — with the override popped, an absent/bogus token must still 404.
- **Heads-up for 182-03:** the unbuilt-route parity probe under `/workflows` needs a **two-segment** unknown path — a single unknown segment matches `PATCH`/`DELETE /workflows/{definition_id}` and yields 405, not 404 (Deviation #3).

**For 184 (node-config panel + per-node badges):** consume `POST /workflows/validate` for badges (`verdict.phase == node id == phase.slug`; `phase: null` = workflow-global) and `GET /workflows/grounding-bundle` for dropdowns. Do not re-derive `severity` client-side and never hardcode a tool/folder/skill list — that is the exact Pitfall-1 warning sign. **For 185 (graded governance):** the grounding-MODE verdict is an ADDITIVE code on the same `verdicts` list; extend `_severity` and `grounding.py`, never a second envelope.

**No blockers.**

## Self-Check: PASSED

| Claim | Verification |
|---|---|
| `backend/tests/unit/test_182_validate.py` exists | FOUND (364 lines ≥ min 40) |
| `backend/tests/test_182_grounding_bundle.py` exists | FOUND (202 lines ≥ min 30) |
| `backend/app/api/workflows.py` modified | FOUND (+267/−2; contains `/validate`) |
| Commit `d2b19551` (Task 1 RED) | FOUND in `git log` |
| Commit `0613dccd` (Task 1 GREEN) | FOUND in `git log` |
| Commit `423a9f1d` (Task 2) | FOUND in `git log` |
| Plan verification: `pytest tests/unit/test_182_validate.py tests/test_182_grounding_bundle.py -q` | 18 passed |
| Per-wave backstop: `tests/unit/test_103_*.py` + extraction-parity + revert/flip-on/off-audience + publish_service | 77 passed (0 failed) |
| Key link → `harness/grounding.py` | `grep -c "assemble_grounding_bundle"` → 5 (plus `grounding_verdicts`, `business_requirement_missing`) |
| Key link → `harness/reachability.py` (module-direct) | `grep -c "from app.services.harness.reachability import lint_workflow"` → 1 |
| Key link → `require_canvas` gate | present on BOTH new routes; `require_visible` on NEITHER (structural tests assert it) |
| No net-new suite failures | equivalent scope: 62 failed / 1411 passed vs 182-01's 62 / 1393 → +18 tests, +0 failures |
| The 5 workflow-named failures are pre-existing | baseline-diff at `ea1c8b58`: 17 failed / 44 passed on BOTH sides |
| No files deleted by any task commit | `git diff --diff-filter=D HEAD~1 HEAD` empty for all 3 commits |

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-24*
