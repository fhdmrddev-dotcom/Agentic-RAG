---
phase: 182-server-validation-seam
plan: 01
subsystem: api
tags: [python, fastapi, pydantic, pytest, refactor, harness, workflow-authoring, grounding, anti-drift]

# Dependency graph
requires:
  - phase: 103-nl-workflow-authoring
    provides: "_assemble_grounding / _check_grounding_fidelity / _skill_registry / _render_folder_tree / _resolve_template_placeholders / _grounding_failed — the grounding compute + the 3 fidelity rules (the code MOVED by this plan)"
  - phase: 102-publish-gauntlet
    provides: "publish_service stage-1 inline D-13 business_requirement predicate (now the shared business_requirement_missing); assert_folder_scopes_subset (scope.py, reused verbatim); reachability.lint_workflow (pure, untouched)"
  - phase: 181-revert-foundation
    provides: "require_canvas 404-when-off gate the Wave-2 routes will attach (not used in this plan — backend extraction only)"
provides:
  - "backend/app/services/harness/grounding.py — the ONE shared grounding source (D-182-06 red line): GroundingBundle + assemble_grounding_bundle + render_grounding_prompt + the 3 atomic fidelity rules + grounding_verdicts (per-node collector) + _check_grounding_fidelity (short-circuit wrapper) + business_requirement_missing"
  - "workflow_authoring._assemble_grounding / _check_grounding_fidelity as THIN delegates returning byte-identical output (NL generation unchanged)"
  - "publish_service stage-1 sourcing the D-13 predicate from the shared business_requirement_missing (no inline copy)"
  - "backend/tests/test_182_extraction_parity.py — extraction-parity golden pin + one-source structural guard + two-presentations guard + exact NL-gen test COUNT guard"
affects: [182-02-validate-and-bundle-routes, 182-03, 184-node-config-panel, 185-graded-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared rule source, two presentations (short-circuit dict for NL-gen, per-node collector for /validate) over the SAME atomic helpers"
    - "Structured bundle + separate prose renderer (one computation, three consumers: NL prompt, fidelity sets, JSON palette)"
    - "Byte-for-byte golden-literal prompt pin (never re-derived from the renderer under test)"
    - "Exact-literal test COUNT guard on a designated regression backstop (Phase-177 coverage-loss lesson)"

key-files:
  created:
    - backend/app/services/harness/grounding.py
    - backend/tests/test_182_extraction_parity.py
  modified:
    - backend/app/services/workflow_authoring.py
    - backend/app/services/harness/publish_service.py
    - backend/tests/unit/test_103_nl_generate.py

key-decisions:
  - "The shared grounding source is a NEW harness/grounding.py, NOT reachability.py — grounding touches the DB and would poison reachability's documented pure-import property (Pitfall 1); it is also deliberately NOT re-exported from harness/__init__.py"
  - "One rule set, two presentations: grounding_verdicts() appends per-node verdicts for /validate; _check_grounding_fidelity() short-circuits to the historical {ok,error,detail} dict for NL-gen — both call the same three atomic helpers so no rule can drift"
  - "assemble_grounding_bundle gained pool=None / project_folder_id=None defaults so the Wave-2 GET palette route can call it with supabase+user_id alone (project binding affects only the prose line and the ⊆ check, never the palette)"
  - "The NL grounding prompt is pinned by an explicit golden literal (not re-derived from render_grounding_prompt), plus exact-literal COUNT guards (2 + 6) on the Phase-103 backstop suites"
  - "VALID-01 left Pending — the requirement text ('the server exposes POST /workflows/validate') only becomes true in 182-02; all three 182 plans share the ID, so it is marked complete at phase end, not per-plan"

patterns-established:
  - "Anti-drift extraction: move a rule to ONE module, leave thin delegates behind, and add a structural test asserting the rule exists in the new home and NOWHERE else"
  - "Prove a guard has teeth out-of-tree before trusting it (mutate the input in a scratchpad script, confirm the assertion rejects it)"
  - "Baseline-diff a pre-existing failure before touching it — restore HEAD versions, re-run, compare counts"

requirements-completed: []  # VALID-01 is shared across 182-01/02/03; marked complete at phase end (see decisions)

# Metrics
duration: 24min
completed: 2026-07-24
---

# Phase 182 Plan 01: Shared Grounding Source Summary

**One shared `harness/grounding.py` now owns the grounding compute, the NL prose render and the three grounding-fidelity rules — NL generation and publish stage-1 are thin delegates with byte-identical behavior, and a golden-pin + count-guard test file makes any future drift fail loudly.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-24T22:12:00+04:00
- **Completed:** 2026-07-24T22:36:30+04:00
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **The phase crux shipped:** `backend/app/services/harness/grounding.py` is the single source of the grounding compute + the three fidelity rules. Everything downstream (the Wave-2 `POST /workflows/validate` verdicts, the `GET /workflows/grounding-bundle` palette, and NL generation) reads the SAME copy — this is the mechanism that makes it structurally impossible for the visual canvas to drift from the publish gauntlet (VALID-01 / D-182-02 / D-182-06).
- **Zero behavior change to NL generation**, proven three ways: the Phase-103 regression suites pass unchanged; the `(str, set, set)` tuple contract is asserted; and the NL grounding prose is pinned byte-for-byte against an explicit golden literal that rejects a reworded heading or a squashed blank line.
- **Two presentations, one rule set.** `grounding_verdicts()` collects every violation keyed by phase slug (what the canvas needs, SC#4); `_check_grounding_fidelity()` short-circuits to the historical `{ok, error, detail}` dict (what NL-gen has always returned). Both call the same three atomic helpers, so a rule cannot be fixed in one and left stale in the other.
- **The trivial rule got the same treatment.** Publish stage-1's inline D-13 `business_requirement` check is now the shared `business_requirement_missing()` one-liner (Pitfall 4) — a one-line rule still drifts when copy-pasted.
- **`reachability.py` stayed pure.** Grounding was deliberately kept out of it (and out of `harness/__init__.py`'s eager surface), so `/validate` can keep importing `lint_workflow` without dragging in DB code (Pitfall 1). Asserted by test, not by comment.
- **Owner scoping preserved exactly** — `fetch_visible_folders` and `_skill_registry` still scope by hand on `user_id` (service-role bypasses RLS), and the `run_in_threadpool` wrap on the blocking skill read moved with the compute (D-v2.5-01). The palette never widened (T-182-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the shared grounding source `harness/grounding.py`** — `53959efd` (feat)
2. **Task 2: Rewire `workflow_authoring` + publish stage-1 to delegate (byte-identical)** — `a95c18a0` (refactor)
3. **Task 3: Extraction-parity + one-source + NL-gen count-guard test** — `206083a8` (test)

**Plan metadata:** see the `docs(182-01)` commit that carries this SUMMARY + STATE/ROADMAP updates.

## Files Created/Modified

- `backend/app/services/harness/grounding.py` (NEW, 446 lines) — the ONE shared grounding source. `GroundingBundle` dataclass (`tools`/`tool_names`/`folders`/`skills`/`skill_ids`/`placeholders`); `assemble_grounding_bundle()` (the registry compute, `run_in_threadpool` wrap intact); `render_grounding_prompt()` (the NL prose, lifted verbatim); the moved helpers `_skill_registry` / `_render_folder_tree` / `_resolve_template_placeholders` / `_grounding_failed`; the three atomic rules `_folder_scope_violation` (reuses `assert_folder_scopes_subset` verbatim) / `_unregistered_tools` / `_unregistered_skill_ref`; `grounding_verdicts()`; `_check_grounding_fidelity()`; `business_requirement_missing()`.
- `backend/app/services/workflow_authoring.py` (MODIFIED, −184/+63) — `_assemble_grounding` and `_check_grounding_fidelity` are now thin delegates; the four moved helper definitions and the now-unused `run_in_threadpool` import are gone; the module docstring records the extraction and the "do not re-add a second copy" rule. Both symbols remain module attributes, so the Phase-103 `monkeypatch.setattr(wa, ...)` test seams are untouched.
- `backend/app/services/harness/publish_service.py` (MODIFIED, 8 lines) — stage 1 calls the shared `business_requirement_missing(definition)`; no residual inline predicate.
- `backend/tests/test_182_extraction_parity.py` (NEW, 6 tests) — parity/golden pin, one-source structural guard, two-presentations guard, exact COUNT guard (2 + 6), and a self-check that the counter itself has teeth.
- `backend/tests/unit/test_103_nl_generate.py` (MODIFIED, +14 test-only lines) — pre-existing rot fix (see Deviations); assertions and test COUNT unchanged.

## Decisions Made

- **Module location (Discretion item 1 → resolved):** a NEW `backend/app/services/harness/grounding.py`. Folding grounding into `reachability.py` would have added Supabase/folder imports to a module whose docstring guarantees "PURE — no I/O, no DB, no engine import", breaking the property that lets `/validate` import lint cheaply. Grounding is also *not* re-exported from `harness/__init__.py` for the same reason.
- **Bundle signature:** `assemble_grounding_bundle` takes `pool=None` and `project_folder_id=None` defaults. The palette is project-agnostic — a bound project only changes the NL prose line and narrows the per-phase `folder_scope` ⊆ check — so the Wave-2 `GET /workflows/grounding-bundle` route can call it with just `supabase` + `user_id`. `pool` is needed only when a `template_asset_id` must be resolved.
- **Golden-pin construction:** `_GOLDEN_PROMPT` is a hand-written literal, deliberately NOT produced by calling `render_grounding_prompt`. A pin derived from the code under test is vacuous.
- **`", ".join(bundle.tools)` replaces `", ".join(sorted(tool_names))`** in the render — identical output by construction (`tools == sorted(tool_names)`) and one less re-derivation.
- **VALID-01 left Pending.** The requirement's literal text is "the server exposes `POST /workflows/validate`" — that route lands in 182-02. All three 182 plans declare VALID-01, so marking it complete after plan 01 would have written a false traceability record. It gets marked at phase end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing rot in the plan's designated regression backstop**
- **Found during:** Task 2 (Rewire `workflow_authoring` + publish stage-1 to delegate)
- **Issue:** Task 2's verification gate is `pytest tests/unit/test_103_nl_generate.py ... -q` exiting 0, but `test_generate_route_delegates_and_does_not_persist` was already red. Phase 167 (VIS-01) attached `require_visible("workflow_authoring")` to `POST /workflows/generate` *after* the Phase-103 test was written; that test builds a bare `FastAPI()` app with none of conftest's seams, so the gate reached the live asyncpg pool with the non-UUID id `"u1"` and died in `is_operator` with `DataError: invalid UUID 'u1'` — before the route body under test ever ran. The plan names this file as THE extraction regression backstop, so a red test meant no backstop for the byte-identical claim.
- **Fix:** Added `monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=True))` following the canonical `test_148_require_visible.py` precedent (`is_operator` is the ONE swappable boundary, SEED-115). Test-only; no app code touched; every assertion and the test COUNT unchanged.
- **Files modified:** `backend/tests/unit/test_103_nl_generate.py`
- **Verification:** Confirmed pre-existing before fixing — restored the HEAD versions of the two modified app files and re-ran: identical failure (1 failed / 5 passed) at baseline. After the fix: 28 passed across the three Task-2 verification files.
- **Committed in:** `a95c18a0` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added a test for the "two presentations, one rule set" must-have**
- **Found during:** Task 3 (Extraction-parity test)
- **Issue:** The plan's `must_haves.truths` #3 asserts that `grounding.py` exposes `grounding_verdicts` over the SAME three rules while keeping `_check_grounding_fidelity` as a short-circuit wrapper — the core anti-drift claim. Task 3's `<behavior>` listed only 3 tests, none of which exercised the collector, so that truth would have shipped unverified.
- **Fix:** Added `test_two_presentations_over_the_same_rules` — one definition with two unregistered-tool violations: the collector reports both keyed to their phase slugs (`["research", "write"]`), the wrapper reports only the first as the historical `grounding_failed` dict, and a clean-registry case makes both agree. If a future edit fixes a rule in only one presentation, this diverges and fails.
- **Files modified:** `backend/tests/test_182_extraction_parity.py`
- **Verification:** 6 passed in the new file; the guard's teeth were proven out-of-tree (a reworded heading, a squashed blank line, and a dropped NL-gen test are all detected).
- **Committed in:** `206083a8` (Task 3 commit)

**3. [Rule 2 - Missing Critical] Skipped `requirements mark-complete` for VALID-01**
- **Found during:** State updates
- **Issue:** The state-update step instructs marking every requirement in the plan's frontmatter complete. VALID-01's text is "the server exposes `POST /workflows/validate`" — untrue until 182-02. All three 182 plans declare VALID-01.
- **Fix:** Left `REQUIREMENTS.md` untouched (VALID-01 stays `Pending`); recorded the reasoning as a STATE.md decision so 182-02/03 pick it up.
- **Files modified:** none (deliberate no-op)
- **Verification:** `grep VALID-01 .planning/REQUIREMENTS.md` still shows `- [ ]` and `| VALID-01 | Phase 182 | Pending |`.
- **Committed in:** n/a (no file change)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical)
**Impact on plan:** All three protect the plan's own guarantees — a working regression backstop, a tested must-have, and an honest requirements ledger. No scope creep: no new dependency, no new route, no migration, no frontend file touched.

## Issues Encountered

- **`state.update-progress` and `state.record-session` are no-ops against this STATE.md** (`"Progress field not found"` / `"No session fields found"` — the file uses a frontmatter `progress:` block and has no `Last session` / `Stopped At` fields). Handled with two minimal hand edits: `completed_plans: 3 → 4` and a descriptive `last_activity` on both the frontmatter and the Current Position block (`state.advance-plan` had truncated it to a bare date). `percent` left at 6 — it tracks phases (1/18), not plans.
- **`roadmap.update-plan-progress 182` had to be run twice.** The first run (before the SUMMARY existed) saw `summary_count: 0` and wrote status `Planned`; re-running after the SUMMARY landed picks up 1/3.
- **The backend unit suite has 63 pre-existing failures unrelated to this work** (retrieval, sql, explorer, multimodal, reembed, sandbox, lifespan, db_runs, module7_tools, extraction, streaming, forced_emit, etc.). Verified out of scope: none of those files reference `workflow_authoring`, `harness.grounding`, `publish_service`, or `business_requirement_missing`. Baseline at `5ebfe993` was **63 failed / 1386 passed**; after this plan it is **62 failed / 1393 passed** — exactly +6 new tests, +1 rot fixed, zero regressions. Not fixed, per the scope boundary.

## Known Stubs

None. Every symbol is real moved code or a real test; no placeholder values, no `TODO`/`FIXME` introduced. (The `template_placeholder` strings in `grounding.py` are the domain vocabulary for docx template fields, not stubs.)

## Threat Flags

None. This plan adds no network endpoint, no auth path, no schema change, and no new file-access pattern — the routes land in 182-02. The plan's threat register is satisfied: **T-182-03** (owner-scoped reads preserved verbatim on the move — `fetch_visible_folders` and `_skill_registry` still filter by `user_id`, asserted structurally by the one-source test), **T-182-05** (one shared rule source; `assert_folder_scopes_subset` reused verbatim, never re-derived), **T-182-SC** (zero package installs — confirmed, no `requirements.txt` / `package.json` change).

## Deployment-Artifact Parity

No action required. This plan reads no new `settings.*` attribute, adds no env var, no seed-bearing migration, no bundled service, and does not touch the sandbox image — so `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` and `SANDBOX_IMAGE` are all unaffected (`scripts/check-deploy-drift.sh` has nothing to flag).

## TDD Gate Compliance

Task 3 carried `tdd="true"`, but a classic RED-before-GREEN gate is structurally inapplicable to it: Task 3 is a *post-extraction regression guard*, and the behavior it guards was deliberately shipped by Tasks 1-2 (the plan's own sequencing). A test written to fail first would have had to assert the extraction had NOT happened. So there is a `test(...)` commit (`206083a8`) with no preceding `feat(...)`-for-this-test pair; the corresponding implementation commits are `53959efd` (feat) and `a95c18a0` (refactor).

The substitute for the RED gate — proving the guards are not vacuous — was run explicitly out-of-tree (scratchpad, never under `backend/`):

| Mutation | Guard | Result |
|---|---|---|
| `### KB folder tree (name + id)` → `### KB folders (name + id)` | golden prompt pin | REJECTED |
| blank line before `### Tool registry` removed | golden prompt pin | REJECTED |
| one `async def test_` renamed away in `test_103_nl_generate.py` | COUNT guard (6 → 5) | DETECTED |

## User Setup Required

None — no external service configuration, no env var, no migration, no operator action.

## Next Phase Readiness

**Ready for 182-02 (Wave 2 — the routes).** Everything Wave 2 needs is now importable from one place:

- `grounding_verdicts(wd, supabase=..., user_id=..., tool_names=..., skill_ids=...)` → the per-node `{code, phase, message}` list for the `/validate` verdict collector. Codes emitted: `folder_scope` (phase `None`, slug inside the message), `unregistered_tool`, `unregistered_skill`.
- `assemble_grounding_bundle(supabase=..., user_id=...)` → `GroundingBundle`; serialize `.tools` / `.folders` / `.skills` / `.placeholders` for `GET /workflows/grounding-bundle`. Pass `pool=` + `template_asset_id=` only when resolving template placeholders.
- `business_requirement_missing(definition)` → the D-13 verdict, already shared with publish stage-1.
- Still to import verbatim in 182-02 (untouched by this plan): `reachability.lint_workflow` (import module-direct to stay import-light) and `publish_service._interactive_phase_failures`.

**Notes for 182-02:**
- The verdict `severity` classification is the route's job (D-182-03) — `grounding_verdicts` deliberately does not classify, so the rules stay verbatim. Remember Pitfall 2: `no_terminal` is `incomplete` when `len(phases) == 0`, `error` otherwise.
- `require_canvas` ALONE on both routes — never stacked with `require_visible`, which raises 403 and would leak route existence (Pitfall 3).
- The canary retirement (D-182-04) is still open: `canvas_canary.py`, its `main.py` include, and the `/canvas/ping` references in **both** `test_revert_byte_identical.py` and `test_181_flip_on.py` (RESEARCH Open Q1 — the latter is not named in CONTEXT but will break).
- If you add a Phase-103 test, bump the literal in `test_182_extraction_parity.py::test_nl_gen_regression_test_count_unchanged` in the same commit.

**No blockers.**

## Self-Check: PASSED

| Claim | Verification |
|---|---|
| `backend/app/services/harness/grounding.py` exists | FOUND (446 lines ≥ min 90) |
| `backend/tests/test_182_extraction_parity.py` exists | FOUND (329 lines ≥ min 20) |
| `backend/app/services/workflow_authoring.py` modified | FOUND (contains `from app.services.harness.grounding import` + `return grounded, bundle.tool_names, bundle.skill_ids`) |
| `backend/app/services/harness/publish_service.py` modified | FOUND (contains `business_requirement_missing(`; 0 residual inline predicates) |
| Commit `53959efd` (Task 1) | FOUND in `git log --all` |
| Commit `a95c18a0` (Task 2) | FOUND in `git log --all` |
| Commit `206083a8` (Task 3) | FOUND in `git log --all` |
| Plan verification: `pytest tests/unit/test_103_nl_generate.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_publish_service.py tests/test_182_extraction_parity.py -q` | 34 passed |
| `reachability.py` gains no DB import | `grep -c "import supabase\|from app.utils.folder_utils"` → 0 |
| Registry compute defined exactly once | only `app/services/harness/grounding.py` matches the `get_tools(None)` compute |
| No files deleted by any task commit | `git diff --diff-filter=D HEAD~1 HEAD` empty for all 3 |

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-24*
