---
phase: 182-server-validation-seam
plan: 03
subsystem: api
tags: [python, fastapi, pytest, cleanup, dead-code-removal, feature-flag, revert-gate, anti-drift]

# Dependency graph
requires:
  - phase: 182-server-validation-seam
    provides: "182-02's real require_canvas-gated routes — POST /workflows/validate + GET /workflows/grounding-bundle — the surface the retired canary's assertions were repointed onto"
  - phase: 181-revert-foundation
    provides: "require_canvas() (the byte-identical-404-when-off gate incl. the CR-01 pre-auth ordering) + canvas_canary.py + the two gate test suites (test_revert_byte_identical.py, test_181_flip_on.py) this plan retires/repoints"
provides:
  - "The Phase-181 /canvas/ping canary is GONE — canvas_canary.py deleted, its main.py import + include removed, no /canvas-prefixed route mounted anywhere"
  - "test_revert_byte_identical.py — the byte-identical acceptance gate now rides the REAL routes: 404-when-off (operator + user) on GET /grounding-bundle, a POST /validate probe with an in-test-validated minimal body, the CR-01 pre-auth pair, a mounted-route positive control, and a NEW authenticated-operator test that pins require_canvas's step order (D-181-01)"
  - "test_181_flip_on.py — the OFF→ON round trip on GET /workflows/grounding-bundle (404 off for operator+user, 200 on via the authenticate_canvas_request seam + a faked empty bundle), fully offline"
affects: [183-read-only-canvas, 184-node-config-panel, 185-graded-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retire a scaffold probe by MIGRATING its assertions onto the real surface, never by deleting them — the gate grows WITH the surface it protects"
    - "Paired 404-off / 200-on probe on the SAME path: the 200 is what makes the 404 provably the GATE rather than an absent route"
    - "Self-proving test fixture: model_validate() the 'minimal VALID body' inside the test so schema drift can never silently turn a 404 assertion into a 422 that passes for the wrong reason"
    - "Discriminating gate test: inject the auth seam so the anonymous-caller fold cannot be the cause, isolating WHICH gate step fired"

key-files:
  created: []
  modified:
    - backend/app/main.py
    - backend/tests/test_revert_byte_identical.py
    - backend/tests/test_181_flip_on.py
  deleted:
    - backend/app/api/canvas_canary.py

key-decisions:
  - "Kept the `test_canvas_ping_*` FUNCTION names (the plan made renaming optional): they are the identifiers the 182-VALIDATION / RESEARCH / must_haves maps reference by literal name, so renaming would break traceability for zero behavior gain. Only the probed PATH changed; a docstring note records why the name is retained"
  - "Left a tombstone comment at the old include site in main.py naming the retired route and where the gate moved — a future `canvas/ping` grep lands on an explanation instead of nothing. Deliberately worded WITHOUT the `canvas_canary` token so the plan's literal `grep -rn canvas_canary backend/app/` == 0 acceptance criterion holds"
  - "The unbuilt-route parity probe moved from `/canvas/__definitely_not_a_route__` into the /workflows namespace as a TWO-segment path — same-namespace parity is the stronger claim now that /canvas is entirely unmounted, and two segments dodge the 405 trap (a single unknown segment matches PATCH/DELETE /workflows/{definition_id}). Status asserted 404 before the body comparison, so a 405 would fail loudly rather than silently"
  - "Faked assemble_grounding_bundle in the flip-on 200 test (the plan's instruction) even though 182-02 proved the real assembler resolves offline — keeps test_181_flip_on.py a pure GATE test, independent of registry/DB contents. The palette's real contents stay pinned in test_182_grounding_bundle.py, its rightful owner"
  - "Did NOT re-mark VALID-01: 182-02 already marked it Complete when POST /workflows/validate landed, and this plan adds no route (a re-mark is a no-op — the 182-02 decision anticipated exactly this)"

patterns-established:
  - "Delete a temporary probe only once its assertions have been re-homed on the real surface and re-run green — never as a standalone cleanup commit"
  - "Prove a repointed assertion is not vacuous by mutating the ONE variable it claims to be sensitive to (flip the flag, confirm the assertion fails), then revert"
  - "Baseline-diff a suspicious failure set by restoring the pre-plan file versions with a targeted per-file `git checkout <sha> -- <paths>` and re-running the IDENTICAL scope before touching anything"

requirements-completed: []  # VALID-01 was marked Complete in 182-02; this plan adds no route (see decisions)

# Metrics
duration: 11min
completed: 2026-07-24
---

# Phase 182 Plan 03: Canary Retirement Summary

**The throwaway Phase-181 `/canvas/ping` canary is deleted, and both 181 gate suites now prove the byte-identical-404-when-off posture on the REAL `POST /workflows/validate` + `GET /workflows/grounding-bundle` routes — including a new test that pins the flag check ahead of the operator no-op on a genuinely authenticated call.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-24T19:17:31Z
- **Completed:** 2026-07-24T19:28:58Z
- **Tasks:** 2
- **Files:** 4 touched (1 deleted, 3 modified) — +175 / −61 lines

## Accomplishments

- **The canary is fully retired (D-182-04).** `backend/app/api/canvas_canary.py` is deleted, `canvas_canary` is gone from `main.py`'s `app.api` import list, and its `include_router` line is removed. Verified structurally, not just by grep: `app.main` imports clean and **zero `/canvas`-prefixed routes remain mounted** (192 routes, both real 182 routes still present). Dead code died a phase earlier than the 181 "182/183" deferral allowed.
- **The gate did not shrink when the canary died — it moved onto the real surface and got STRONGER.** Every 404-when-off assertion was migrated, not dropped. The acceptance gate now rides the routes it actually protects: a body-free `GET /workflows/grounding-bundle` (the canary's exact shape) plus `POST /workflows/validate`.
- **The full blast radius was handled (RESEARCH Open Q1).** CONTEXT D-182-04 named only `test_revert_byte_identical.py`, but `test_181_flip_on.py` also probed `/canvas/ping` — and its `test_canvas_ping_200_after_flip_on` would have **failed outright** on delete (no route → 404, not 200). Both files are repointed and green.
- **Pitfall 5 (the 422-vs-404 race) is closed by construction, not by hope.** The `POST /validate` off-probe sends `{"slug": "x", "version": 1, "name": "X", "phases": []}` and the test **`model_validate()`s that body against the real `WorkflowDefinition`** before probing. So the "minimal VALID body" property is *proven in-test* rather than asserted in a comment — if a future schema change invalidated the body, the test fails loudly instead of quietly passing on a 422 that looks like a 404. The probe also asserts `!= 422` and `!= 405`.
- **The 404s can no longer pass for the wrong reason.** Two independent controls: (1) a **mounted-route positive control** asserting `(path, method)` is genuinely in `app.routes`, so "404" can never mean "never built"; (2) the **paired 200-when-on** probe on the same path in `test_181_flip_on.py`. Empirically confirmed — with the flag flipped on, that path returns 200 with the genuine 28-tool registry palette.
- **NEW: the D-181-01 step order is now actually pinned at route level** (see Deviations #1). The pre-existing operator/user probes send no `Authorization` header, so `authenticate_canvas_request` resolves `None` and the gate 404s at its *anonymous-caller fold* — their `is_operator` patch is never even reached, so their 404 did not prove the flag caused it. `test_require_canvas_404s_for_an_authenticated_operator_when_off` injects the caller seam (ruling out the auth fold) with `is_operator` true and the flag off, and demands 404. That is the load-bearing "off resolves BEFORE the operator no-op" property, and it was **falsification-tested**: flipping the flag on makes it fail with `assert 200 == 404`.
- **The 405 trap was verified, not assumed** (the Wave-2 lesson). The unbuilt-route parity probe uses a two-segment `/workflows/__nope__/__nope__` path, and the test asserts it returns 404 **before** comparing bodies — so a 405 fails loudly rather than silently.
- **Zero regressions, proven by baseline-diff.** Identical scope, pre-plan app code vs post-plan: **65 failed / 1405 passed on BOTH sides** — byte-identical (see Issues).

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete the canary route + remove its `main.py` wiring** — `b9682a9b` (chore)
2. **Task 2: Repoint BOTH 181 test files onto the real routes** — `937af683` (test)

**Plan metadata:** see the `docs(182-03)` commit carrying this SUMMARY + STATE/ROADMAP updates.

## Files Created/Modified

- `backend/app/api/canvas_canary.py` (**DELETED**, −30) — the whole throwaway module (`GET /canvas/ping` behind `require_canvas()`). Its own docstring anticipated this removal.
- `backend/app/main.py` (**MODIFIED**, +6/−2) — `canvas_canary` dropped from the line-657 `from app.api import ...` list (every other module untouched); the `include_router(canvas_canary.router)` line replaced by a 5-line tombstone recording D-182-04, naming the real routes that now carry the gate, and instructing future readers to add 404-when-off assertions to the REAL route rather than re-adding a probe.
- `backend/tests/test_revert_byte_identical.py` (**MODIFIED**, +109/−21 → 266 lines, 4 → **5** tests):
  - module docstring rewritten to record the repoint and *why* each route was chosen (GET = no body confound; POST = valid body per Pitfall 5);
  - two module constants `_BUNDLE_PATH` / `_VALIDATE_PATH` + `_MINIMAL_VALID_DEFINITION`;
  - `test_require_canvas_404s_when_off` — operator + user on `GET /grounding-bundle`, plus the in-test-validated `POST /validate` probe (`!= 403`, `!= 422`, `!= 405`) and the mounted-route positive control;
  - **`test_require_canvas_404s_for_an_authenticated_operator_when_off` (NEW)** — the discriminating D-181-01 step-order test;
  - `test_require_canvas_404s_pre_auth_when_off` — CR-01 anonymous + bogus-token pair repointed, `get_current_user` override still popped and `authenticate_canvas_request` left REAL, a third pre-auth probe added on `POST /validate`, and the parity probe moved to the two-segment `/workflows` path;
  - `test_existing_governed_features_unchanged` — **untouched** (hits `/features` only).
- `backend/tests/test_181_flip_on.py` (**MODIFIED**, +66/−8 → 189 lines, 7 tests, count unchanged):
  - module docstring records the repoint + the retained-name rationale; `_CANVAS_PATH` constant;
  - the 3 canary tests repointed onto `GET /workflows/grounding-bundle` (`!= 403` added to both 404 tests);
  - `test_canvas_ping_200_after_flip_on` keeps the `authenticate_canvas_request` seam (fake caller id upgraded to a UUID — see Deviations #2) and fakes `assemble_grounding_bundle` to an empty bundle, asserting 200 **and** the exact palette envelope so the 200 provably came from the real handler;
  - the 5 `/features` tests — **untouched**.

## Decisions Made

- **Retained the `test_canvas_ping_*` function names.** The plan made renaming optional. Those literals are referenced by name in `182-VALIDATION.md`, `182-RESEARCH.md` (Open Q1), `182-PATTERNS.md` and this plan's own `must_haves.truths` #4 — renaming would break every one of those traceability links for a cosmetic gain. The acceptance criterion is `grep -c "canvas/ping" == 0`, which is about the *path* (`canvas/ping`) not the identifier (`canvas_ping`); it passes. A docstring note tells the next reader the name is deliberate and only the path changed.
- **Tombstone comment at the old include site,** worded to avoid the `canvas_canary` token so the literal `grep -rn "canvas_canary" backend/app/` == 0 criterion holds while still naming `/canvas/ping` — so a future grep for the vanished route lands on an explanation. This is why the criterion drove a reword rather than a deletion (see Deviations #3).
- **Same-namespace parity probe.** `/canvas/__definitely_not_a_route__` would still have returned 404 (the prefix is now entirely unmounted), so "verbatim" was viable — but the *claim* being made is "the gated route is indistinguishable from an unbuilt route", and that is strongest when the comparison path is a sibling under `/workflows`. Two segments are mandatory there (405 trap); the assertion shape (`no_auth.json() == unknown.json() == {"detail": "Not Found"}`) is unchanged.
- **Faked the bundle in the flip-on test.** 182-02 established the real assembler resolves fine offline, so this was optional — but `test_181_flip_on.py` is a *gate* suite, and a gate test that would break when the tool registry changes is coupled to the wrong thing. Faking keeps it a pure OFF→ON gate proof; `test_182_grounding_bundle.py` remains the owner of the palette's real contents.
- **VALID-01 not re-marked.** 182-02 marked it Complete when the route landed and explicitly noted a plan-03 re-mark would be idempotent. This plan adds no route, so `REQUIREMENTS.md` is left alone.
- **Left the historical `/canvas/ping` mentions in `.planning/` docs and `PROJECT.md` intact.** Those are the phase-completion ledger (Phase 181's operator live-close UAT recorded probing that route). Rewriting shipped history to satisfy a grep would be falsification, not cleanup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the discriminating authenticated-operator 404 test — the plan's must-have #5 was otherwise unproven at route level**
- **Found during:** Task 2 (reading `require_canvas` to reason about the flip-on path)
- **Issue:** `must_haves.truths` #5 claims "the byte-identical 404 posture is proven on the REAL canvas routes **for everyone incl. operators**". It was not. `require_canvas` 404s at *two* different steps: (1) the flag is off, and (2) the flag is live but `authenticate_canvas_request` returns `None`. The TestClient sends no `Authorization` header, and conftest overrides `get_current_user` — **not** `authenticate_canvas_request` — so the "operator" and "user" probes were really *anonymous* calls whose `monkeypatch.setattr(deps, "is_operator", ...)` is never reached (step 3 is unreachable when step 2 folds). Their 404 therefore did not attribute the block to the flag, and would still be 404 if D-181-01's ordering were reversed. This is a pre-existing property of the 181 canary tests inherited by the repoint, and it left the phase's headline red-line claim (an operator sees no phantom canvas) resting on a test that could not detect its violation.
- **Fix:** `test_require_canvas_404s_for_an_authenticated_operator_when_off` — patches `authenticate_canvas_request` to inject a caller (so step 2 *cannot* be the cause), patches `is_operator` true, leaves the flag off, and asserts 404 on both real routes. Now the 404 is attributable to step 1, the flag, on a genuinely authenticated operator call.
- **Files modified:** `backend/tests/test_revert_byte_identical.py`
- **Verification:** Falsification-tested out of band — swapping `_cold_off` for a flipped-on settings map made it fail with `AssertionError: assert 200 == 404`, the 200 body being the genuine 28-entry tool registry. Mutation reverted; 21/21 green after.
- **Committed in:** `937af683` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Upgraded the flip-on fake caller's id from `"u-1"` to a UUID**
- **Found during:** Task 2 (repointing `test_canvas_ping_200_after_flip_on`)
- **Issue:** The 181 fake caller returned `{"id": "u-1", ...}`. Harmless for the canary (whose handler ignored the caller), but the real route's handler runs `_coerce_user_id(current_user)` → `UUID(user_id)`. It happens not to blow up today only because `current_user` comes from conftest's `get_current_user` override rather than this seam — i.e. the test is one refactor away from a confusing `ValueError: badly formed hexadecimal UUID string` that would look like a gate failure.
- **Fix:** Returns `00000000-0000-0000-0000-000000000001`, mirroring `test_182_grounding_bundle.py::_inject_caller`.
- **Files modified:** `backend/tests/test_181_flip_on.py`
- **Verification:** flip-on test green; asserts the exact palette envelope, so the real handler demonstrably ran.
- **Committed in:** `937af683` (Task 2 commit)

**3. [Rule 3 - Blocking] Reworded my own tombstone comment + cleared stale bytecode to satisfy Task 1's acceptance grep**
- **Found during:** Task 1 verification
- **Issue:** Task 1's acceptance criterion is `grep -rn "canvas_canary" backend/app/` returns nothing. My first tombstone comment contained the literal `canvas_canary.router`, and `app/api/__pycache__/canvas_canary.cpython-312.pyc` survived the source deletion — so the verification gate reported `RESIDUAL REFS FOUND` on both.
- **Fix:** Reworded the tombstone to reference the retired route by path (`"/canvas/ping"`) and the module by description rather than by symbol name, preserving the documentation value with zero grep collision; deleted the orphaned `.pyc` (confirmed `__pycache__` is gitignored, so nothing to stage). Harmless in principle — CPython won't import a `__pycache__` `.pyc` without its source — but an orphaned bytecode file for a deleted module is exactly the kind of thing that produces a phantom import much later.
- **Files modified:** `backend/app/main.py` (comment only)
- **Verification:** `grep -rn "canvas_canary" backend/app/` → no matches (source or bytecode); repo-wide, `canvas_canary` appears in **no** code file under `backend/ frontend/ scripts/ docs/ deploy/`.
- **Committed in:** `b9682a9b` (Task 1 commit)

**4. [Rule 2 - Missing Critical] Added a mounted-route positive control + `!= 405` / `!= 422` guards**
- **Found during:** Task 2 (heeding the carry-forward warning about assertions that pass for the wrong reason)
- **Issue:** A bare `assert status_code == 404` on a flag-gated route is ambiguous by construction: it passes identically when the route is missing, when the path matched but the method didn't (405 is *not* 404, but a typo'd path would be), and — for the POST — when the body 422s. Repointing onto new paths is exactly when a path typo is most likely, and the resulting test would be permanently green and permanently worthless.
- **Fix:** `test_require_canvas_404s_when_off` now asserts `(_BUNDLE_PATH, "GET")` and `(_VALIDATE_PATH, "POST")` are genuinely in `app.routes`, plus `!= 405` and `!= 422` on the POST probe. Combined with `test_181_flip_on.py`'s 200-on-the-same-path, the 404 is unambiguously the gate.
- **Files modified:** `backend/tests/test_revert_byte_identical.py`
- **Verification:** Both controls pass; the mount assertions carry failure messages naming the vacuity ("the 404 is vacuous").
- **Committed in:** `937af683` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 missing-critical) — all inside this plan's own files
**Impact on plan:** None on scope. No new dependency, no migration, no frontend file, no route added or changed, no production behavior altered (the only app-code change is a deletion + an import-list edit). Three deviations harden the plan's own acceptance gates against passing-for-the-wrong-reason; one satisfied a literal acceptance criterion. Net test count +1 (4 → 5 in `test_revert_byte_identical.py`); `test_181_flip_on.py` stays at 7.

## Issues Encountered

- **3 `test_181_off_audience.py` failures appear ONLY in a combined run with `tests/unit` — confirmed PRE-EXISTING by baseline-diff, not by inspection.** `test_admin_visibility_accepts_canvas_off` / `..._accepts_canvas_everyone` / `..._rejects_bogus_audience_for_canvas` pass 9/9 when that file runs alone, and fail when `tests/unit` runs first — classic cross-test pollution. Because this plan deletes a route, "did I cause it?" had to be answered properly: I restored the pre-plan `canvas_canary.py` + `main.py` via a targeted `git checkout HEAD~2 -- <paths>`, re-ran the **identical** scope (`tests/unit tests/test_181_off_audience.py`), and got **65 failed / 1405 passed** — then restored my versions and got **65 failed / 1405 passed** again. Byte-identical both sides, so the pollution predates this plan and is out of scope (the plan's own gate, which does not run `tests/unit`, is 21/21 green). Worth a future look as a test-isolation issue, not a product bug.
- **Suite arithmetic reconciles exactly.** Equivalent scope incl. the 182 files: **65 failed / 1429 passed** vs 182-02's **62 failed / 1411 passed** — the deltas are entirely the three suites 182-02 didn't include in its scope (+21 tests: 18 passing + the 3 polluted `off_audience` failures). No net-new failure from this plan.
- **The extraction-parity COUNT guard needed no change.** Its literals (2 and 6) pin `tests/unit/test_103_grounding_fidelity.py` and `tests/unit/test_103_nl_generate.py`, neither of which this plan touches. `test_182_extraction_parity.py` is 6/6 green and the literals are untouched — deliberately confirmed rather than assumed, per the carry-forward warning.
- **`require_canvas`'s two 404 sources are a permanent test-design hazard** worth carrying forward: any future "404 when off" assertion that does not inject `authenticate_canvas_request` is really testing the anonymous fold, not the flag. Documented in the new test's docstring.

## Known Stubs

None. This plan deletes code and repoints assertions; it introduces no placeholder value, no hardcoded empty that reaches a UI, and no `TODO`/`FIXME`. The faked empty `GroundingBundle` in the flip-on test is a deliberate test double (the palette's real contents are pinned in `test_182_grounding_bundle.py`), not a stub.

## Threat Flags

None. This plan **removes** a network endpoint and adds none; no auth path, schema, or file-access pattern changed. The plan's register is satisfied:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-182-01** Information Disclosure (route-existence leak when off) | mitigated — **strengthened** | The byte-identical 404 is now asserted on the REAL routes for: an anonymous caller, a bogus-token caller, an end user, an operator, and (new) a genuinely **authenticated** operator — the last one being the case that actually pins the flag ahead of the operator no-op (D-181-01). Parity against an unbuilt same-namespace path is asserted body-for-body. Retiring the canary shrank the reachable-route set; the gate's coverage grew. |
| **T-182-02** Tampering (`POST /validate` 404-probe body) | mitigated | The off-probe body is `model_validate()`d against the real `WorkflowDefinition` **in-test**, and the probe asserts `!= 422` — so a 422 can never masquerade as the flag's 404. `extra="forbid"` untouched. |
| **T-182-SC** Supply chain | accepted (satisfied) | Zero installs. No `requirements.txt` / `package.json` change; net −30 lines of app code. |

## Deployment-Artifact Parity

No action required, and verified rather than assumed: `bash scripts/check-deploy-drift.sh` → **RESULT: PASS**. This plan reads no new `settings.*` attribute and adds no env var, migration, seed row, bundled service, or `SANDBOX_IMAGE` change, so `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` and the sandbox tag (`agentic-rag-sandbox:101.1`, consistent everywhere) are unaffected. The 2 WARNs the script reports (the >#089 seed-migration review list; `docker compose` unavailable locally) are pre-existing and unrelated. Deploying this code is a strict no-op for users: it removes an endpoint that returned 404 for everyone anyway while `visual_workflow_canvas` is off (its cold default).

## TDD Gate Compliance

Neither task carried `tdd="true"`, and the RED→GREEN gate is structurally inapplicable to this plan: Task 1 is a deletion and Task 2 *migrates existing assertions* onto new paths. A RED-first commit would have had to assert the canary was already gone before deleting it.

The substitute for the RED gate — proving the repointed assertions are not vacuous — was run explicitly:

| Mutation / control | Guard | Result |
|---|---|---|
| flag flipped ON in the new authenticated-operator test | the `== 404` assertion | **FAILED** as required (`assert 200 == 404`, body = the real 28-tool registry) → the assertion is flag-sensitive, then reverted |
| route-mount lookup in `app.routes` | positive control | both `(GET, /workflows/grounding-bundle)` and `(POST, /workflows/validate)` mounted → the off-state 404s are the GATE, not absence |
| `client.get("/workflows/__nope__/__nope__")` | parity probe | genuinely **404** (asserted before the body comparison) → the 405 trap is dodged, verified not assumed |
| `WorkflowDefinition.model_validate(_MINIMAL_VALID_DEFINITION)` | in-test body validation | passes → the POST probe's 404 cannot be a disguised 422 |
| `python -c "import app.main"` + route enumeration | canary removal | clean import; **0** `/canvas`-prefixed routes; both real routes still mounted |

Commit types are honest to content: `chore` for the deletion, `test` for the test-only repoint. No `feat` was manufactured for a plan that ships no feature.

## User Setup Required

None. No env var, no migration, no external service, no operator action.

## Next Phase Readiness

**Phase 182 is code-complete — ready for `/gsd:verify-work 182`.** All three waves have landed: the shared grounding source (182-01), the two real routes (182-02), and the canary retirement (182-03).

**For Phase 183 (read-only canvas):**
- The revert gate's contract is unchanged and now lives entirely on real routes — **every new canvas route MUST append its own 404-when-off probe** to `test_require_canvas_404s_when_off` in `test_revert_byte_identical.py`. Copy the `_BUNDLE_PATH` block (and, for a POST, the in-test-validated-body block).
- **Do not add a 404-when-off assertion without injecting `authenticate_canvas_request`** if you intend to claim it proves the *flag* blocked the call. Without the injection you are testing the anonymous-caller fold; `test_require_canvas_404s_for_an_authenticated_operator_when_off` is the pattern to copy.
- Pair every new 404-off probe with a 200-on probe on the same path (or a mount assertion). A lone 404 assertion is satisfied by a typo'd path.
- Under `/workflows`, an unbuilt-route parity probe needs a **two-segment** path — a single unknown segment yields 405, not 404.
- There is no longer any `/canvas`-prefixed route in the app. Phase 183's routes belong on `api/workflows.py` (G-5 red line), not a new `/canvas` router, unless a phase deliberately decides otherwise.

**Carry-forward (not a blocker):** the 3 `test_181_off_audience.py` failures under `tests/unit` pollution are pre-existing test-isolation debt, proven byte-identical at baseline. Worth a targeted fixture-teardown fix in a future cleanup, but nothing in the product is broken.

**No blockers.**

## Self-Check: PASSED

| Claim | Verification |
|---|---|
| `backend/app/api/canvas_canary.py` deleted | MISSING as intended (`test ! -f` ok); `git show --stat b9682a9b` shows `delete mode 100644` |
| `canvas_canary` gone from `backend/app/` | `grep -rn "canvas_canary" backend/app/` → no matches (source **and** bytecode) |
| `canvas_canary` gone repo-wide (code) | `grep -rn` across `backend/ frontend/ scripts/ docs/ deploy/` → NONE |
| No `/canvas` route mounted | `python -c` route enumeration → `canvas-prefixed routes still mounted: []`; 192 routes total |
| App boots with the canary removed | `python -c "import app.main"` → `import ok` |
| Both real routes still mounted | `validate mounted: True`, `grounding-bundle mounted: True` |
| `backend/tests/test_revert_byte_identical.py` repointed | FOUND (266 lines, 5 tests); `grep -c "workflows/grounding-bundle"` → 3, `"workflows/validate"` → 3 |
| `backend/tests/test_181_flip_on.py` repointed | FOUND (189 lines, 7 tests); `grep -c "workflows/grounding-bundle"` → 4 |
| Zero stale canary-path refs in the two files | `grep -c "canvas/ping"` → **0** and **0** |
| Zero stale canary-path refs in ANY backend test | `grep -rn "canvas/ping" backend/tests/` → NONE |
| Commit `b9682a9b` (Task 1) | FOUND in `git log` |
| Commit `937af683` (Task 2) | FOUND in `git log` |
| Plan verification gate | `pytest tests/test_revert_byte_identical.py tests/test_181_flip_on.py tests/test_181_off_audience.py -q` → **21 passed** |
| Phase backstops + NL-gen zero-behavior-change | revert + flip-on + off-audience + 182_validate + grounding_bundle + extraction_parity + 103_nl_generate + 103_grounding_fidelity → **53 passed, 0 failed** |
| COUNT guard literals unchanged (2 / 6) | `test_182_extraction_parity.py` 6/6 green; neither `test_103_*` file touched |
| No net-new suite failures | baseline-diff, identical scope: **65 failed / 1405 passed on BOTH sides** (pre-plan app code vs HEAD) |
| New operator test is not vacuous | flag-on mutation → `assert 200 == 404` FAILED as required, then reverted |
| Parity probe genuinely 404s (405 trap) | asserted `unknown.status_code == 404` before the body comparison; green |
| Deploy-artifact parity | `scripts/check-deploy-drift.sh` → **RESULT: PASS** |
| Only the intended file was deleted | `git diff --diff-filter=D HEAD~1 HEAD` → `canvas_canary.py` only (Task 1); empty (Task 2) |
| No stray files staged | each commit staged with explicit per-file `git add` / `git rm`; `git diff --cached --stat` verified 2 files per commit |

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-24*
