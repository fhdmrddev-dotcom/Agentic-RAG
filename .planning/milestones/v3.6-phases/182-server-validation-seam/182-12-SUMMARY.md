---
phase: 182-server-validation-seam
plan: 12
subsystem: api
tags: [workflow-validation, grounding, multi-tenancy, org-scoping, publish-gate, seed-correction, pytest, tdd, falsification]

# Dependency graph
requires:
  - phase: 182-server-validation-seam (plan 06)
    provides: "publish stage 2.6 — the authoritative grounding gate whose SCOPE this plan corrects"
  - phase: 182-server-validation-seam (plan 10)
    provides: "scope.folder_scope_violations — the non-raising ⊆ collector the restriction is threaded onto"
  - phase: 182-server-validation-seam (plan 11)
    provides: "the keyword-only strict= parameter on the SAME folder reads, and the degraded/grounding_unavailable fail-closed path the org failure now rides"
  - phase: 163-rls-rewrite-user-jwt-client-swap
    provides: "_resolve_publish_supabase's SELECT org_id (D-05 / T-163-05b) — the value that was read, used for the client, and discarded"
provides:
  - "folder_utils.fetch_visible_folders(..., restrict_org_ids=) — one optional org narrowing at the single point the caller's folder org set is resolved"
  - "grounding.assemble_grounding_bundle / grounding_verdicts (..., restrict_org_ids=) — the same narrowing for the skill registry and the ⊆ walk"
  - "scope.resolve_project_subtree / folder_scope_violations (..., restrict_org_ids=) — threaded, with assert_folder_scopes_subset deliberately excluded"
  - "publish_service._resolve_publish_supabase -> (client, org_id): one read, two consumers, refused on a falsy org on BOTH branches"
  - "tests/unit/test_182_publish_org_scope.py — 16 tests, the cross-org publish proof with the REAL gate running"
  - "a corrected SEED-130: no wrong security verdict, Option B annotated unsafe-as-written"
affects: [184-editable-canvas-live-validation, 185-graded-governance, 189-governed-external-action-node-model]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Narrow the SET the shared rule already consumes; never write a second predicate — a post-filter that drifts from the pushed-down query is the SEED-124/125 leak shape"
    - "Apply a scope restriction at the ONE point the unrestricted scope is already resolved, so the whole existing rule is reused by construction"
    - "An optional restriction is forwarded to internal callees ONLY when set, so an unrestricted call is byte-identical ON THE WIRE and every documented monkeypatch seam keeps its contract"
    - "A value read for one purpose that a second consumer also needs is RETURNED from the one read site, never re-read — a second read is how two scopes drift apart"
    - "Prove a scope restriction by asserting BOTH directions against the same fake: present unrestricted, absent restricted — a block alone can be an empty registry"
    - "A wrong recorded security verdict is a control failure; correcting the record is the mitigation when the code fix is deferred"

key-files:
  created:
    - backend/tests/unit/test_182_publish_org_scope.py
  modified:
    - backend/app/utils/folder_utils.py
    - backend/app/services/harness/scope.py
    - backend/app/services/harness/grounding.py
    - backend/app/services/harness/publish_service.py
    - backend/tests/unit/test_182_publish_grounding_stage.py
    - backend/tests/unit/test_182_grounding_degradation.py
    - .planning/seeds/SEED-130-workflow-template-placeholders-dead-path.md

key-decisions:
  - "The restriction is forwarded to internal callees ONLY when it is not None. An unconditional keyword broke 18 existing tests across two files outside files_modified, because these are DOCUMENTED monkeypatch seams. Conditional forwarding makes the plan's own 'byte-identical by construction' claim true on the wire, keeps the change scope-contained, and still fails LOUDLY if a stale double meets a restricted call"
  - "_resolve_publish_supabase reads the org on BOTH branches and RAISES on a falsy org in the caller-supplied branch too — the no-client branch already had the org-requiring factory to refuse for it, the supplied branch had nothing. A falsy org must never resolve to an unrestricted gate"
  - "The discriminating tests were authored as each task's RED gate rather than deferred to Task 3, so they were observed failing against genuinely pre-change code — the pattern 182-10 established. Task 3 kept the SEED correction and both mutation falsifications"
  - "Tests invalidated by Task 2's return-shape change were fixed IN Task 2's commit (the 182-11 precedent), so no commit in this plan leaves the suite red"
  - "assert_folder_scopes_subset deliberately did NOT gain the parameter, and /validate deliberately passes none — both asserted structurally so a verifier reads the asymmetry as a decision"

patterns-established:
  - "When a gate is org-scoped but scoped to the WRONG org, fix the SCOPE at the one resolution point; do not add a filter downstream of the rule"
  - "Falsify a scope fix twice: remove the argument (does the gate still fire?) and invert the operator (is the intersection the thing doing the work?)"

requirements-completed: [VALID-01]

# Metrics
duration: 23min
completed: 2026-07-25
---

# Phase 182 Plan 12: WR-05 — Publish Gates on the Definition's Org, Not the Publisher's Union Summary

**The `org_id` that `_resolve_publish_supabase` reads specifically to scope the BYPASSRLS client is no longer discarded before the gate runs: it is returned alongside the client and threaded as one optional `restrict_org_ids` keyword into both of stage 2.6's org-gated reads, so a multi-org author can no longer publish an org-A definition whose `skill_ref` names an org-B skill or whose `folder_scope` names an org-B folder — proven by a cross-org publish test that leaves `assemble_grounding_bundle`, `grounding_verdicts` AND `_resolve_publish_supabase` unpatched, and falsified twice (arguments removed → it publishes; intersection inverted to a union → the folder half goes clean). SEED-130's wrong "not a security issue" verdict is corrected and its Option B annotated unsafe-as-written, so Phase 184 cannot inherit it.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-07-25T03:31:16Z (phase HEAD `c4d4924a`)
- **Completed:** 2026-07-25T03:54:50Z
- **Tasks:** 3 (all TDD — 5 commits: RED / GREEN / RED / GREEN / docs)
- **Files:** 8 (1 created, 7 modified) — the plan's 7 plus one Rule-3 fix, no deletions

## Accomplishments

- **Closed WR-05 at both halves of the gate.** At HEAD, a definition in org A whose phase `skill_ref` named an org-B skill **published**, because `assemble_grounding_bundle` resolved visibility from `_resolve_caller_org_ids(supabase, user_id)` — every org the publisher belongs to. The observed pre-fix verdict, captured live: `published: True`, `blocked_stage: None`, golden run driven, version flipped. It now blocks at `grounding_fidelity` with `unregistered_skill` keyed to the offending phase. The folder half behaves identically: an org-B-shared folder under the org-A project root used to make the ⊆ check pass and now yields a keyed `folder_scope` verdict.
- **The intersection happens exactly twice, at the two points the caller's org set is ALREADY resolved.** Once in `folder_utils.fetch_visible_folders` (immediately after `_resolve_caller_org_ids`, before `is_in_global_subtree` walks anything) and once in `grounding.assemble_grounding_bundle` (immediately after `_resolve_caller_org_ids`, before `_skill_registry` receives the set). Nothing downstream changed: `build_skill_visibility_or`, `skill_row_visible` and `is_in_global_subtree` are byte-identical and simply get a smaller set. Verified by grep against the HEAD values recorded before editing — `is_org_shared` in `grounding.py` **4 → 4**, `build_skill_visibility_or|skill_row_visible` **4 → 4**.
- **Both ENCODINGS of the skill rule are narrowed, and the test proves it.** Because the intersection lands on `caller_org_ids` before `_skill_registry`, the pushed-down PostgREST `.or_()` predicate loses org B *and* the in-Python post-filter rejects it. The mechanism test asserts the org-B id is absent from `sb.last("skills").or_arg`, so a fix that only narrowed one encoding would fail — that asymmetry is exactly what SEED-125 was.
- **One read, two consumers.** `_resolve_publish_supabase` now returns `(client, org_id)`. The org is read on BOTH branches — a caller-supplied client does not mean "no tenant" — and a falsy org is REFUSED on both: the no-client branch already had `get_service_role_supabase`'s refusal, the supplied branch now refuses itself. That refusal lands in plan 182-11's fail-closed `except` as `grounding_unavailable`, which BLOCKS.
- **Every unrestricted caller is byte-identical, on the wire and not merely in outcome.** The restriction is forwarded to internal callees only when set (see Decisions #1). NL generation, `/validate`, run-start kickoff, resume, Continue and the four `/folders` routes issue the exact same calls they did at HEAD. `grep -c "restrict_org_ids" app/api/workflows.py` is **0**, asserted by a source test so the asymmetry is legible.
- **`assert_folder_scopes_subset` deliberately did NOT gain the parameter**, and the reasoning is written into its docstring: every caller of the raising form acts AS ITSELF (a runner starting their own run, an author generating their own draft), so narrowing them would break correct behaviour rather than close a leak. A signature test pins the three-parameter shape.
- **Corrected SEED-130 (WR-06) without touching a line of source.** The seed recorded a flat security clearance *and* offered, as one of two fixes, removing the `UUID` annotation that is the only containment. Both are now corrected; the seed stays `open` with `folded_into: null`, all four original `re_open_triggers` and all three `confirmed` entries intact, and one trigger added: the ownership gate ships in the same commit as whichever option is chosen. Frontmatter re-verified to parse as strict YAML (deferred item D3 counts 29 seeds that do not — this is not one).
- **IN-05 recorded in-source as a deliberate deferral**, with a note that it predates the tuple change and that the tuple adds no read — so it cannot be mistaken for something this plan introduced.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | Task 1 RED — the org restriction mechanism | `0c383396` | test |
| 2 | Task 1 GREEN — one restriction, two intersections | `b0f19602` | feat |
| 3 | Task 2 RED — the cross-org publish proof | `9d4f2c9b` | test |
| 4 | Task 2 GREEN — publish gates on the definition's org | `75b23bbe` | feat |
| 5 | Task 3 — SEED-130 verdict correction (WR-06) | `b9578929` | docs |

No REFACTOR commits — the change adds one parameter and one intersection at each of two points; nothing was left to clean up.

## Files Created/Modified

- **`backend/app/utils/folder_utils.py`** — `fetch_visible_folders` gained keyword-only `restrict_org_ids: set[str] | None = None` (a SECOND keyword-only addition alongside 182-11's `strict`, not a replacement) plus a three-line intersection immediately after `_resolve_caller_org_ids`. The docstring states the polarity explicitly (`None` unrestricted, `set()` no org-shared visibility, never re-read as unrestricted), states WHY the intersection belongs at this point (it reuses the whole ancestor walk instead of writing a second predicate — the SEED-124 lesson), and names who passes it. `fetch_all_folders`, `_resolve_caller_org_ids`, `is_in_global_subtree`, `_null_foreign_global_owner` and `get_globally_visible_folder_ids` are untouched.
- **`backend/app/services/harness/scope.py`** — the same parameter on `resolve_project_subtree` and `folder_scope_violations`, threaded through. The module docstring's T-098-02 threat note gained an ORG DIMENSION paragraph (owner scoping stopped being sufficient once `is_org_shared` existed; a caller acting on behalf of a definition needs a second narrowing). `assert_folder_scopes_subset` gained a DELIBERATELY-WITHOUT paragraph naming each of its four callers and why each must keep the unrestricted view. The canonical seam-contract comment (why the keyword is forwarded only when set) lives here, referenced from the other two sites.
- **`backend/app/services/harness/grounding.py`** — the parameter on `assemble_grounding_bundle`, `grounding_verdicts` and the private `_folder_scope_violations`; the skills intersection immediately after `_resolve_caller_org_ids`. The module docstring gained "THE SECOND ORG DIMENSION (WR-05)" under OWNER + ORG SCOPING, naming the run-time flip and the SEED-124/125 family. `_skill_registry`'s body, the shared predicate imports, every verdict message and `GROUNDING_VERDICT_CODES` are unchanged.
- **`backend/app/services/harness/publish_service.py`** — `_resolve_publish_supabase` returns `(client, org_id)`, reads the org before the branch, and refuses a falsy org on both. Its docstring records the second responsibility (one read, two consumers, so client scope and gate scope can never disagree). `_grounding_fidelity_failures` unpacks and passes `restrict_org_ids={str(org_id)}` to BOTH grounding calls, with the full WR-05 rationale in the docstring; 182-11's degraded branch, shared finding builder and never-raise contract are preserved verbatim. `_drive_golden_run` unpacks into a throwaway name with a comment saying the golden run is scoped by the client alone. The IN-05 deferral comment sits above the stage-2.6 call site. `publish_workflow`'s orchestration is unchanged.
- **`backend/tests/unit/test_182_publish_org_scope.py`** (new, **750 lines, 16 tests**) — module docstring names the phase, VALID-01, WR-05, the defect, the run-time consequence and the SEED-124/125 lineage. Group A (8) pins the MECHANISM: both-directions skill proof incl. the pushed-down predicate, empty-set fail-closed polarity, omitted-keyword byte-identity, the folder half, composition with 182-11's `strict=`, the ⊆ walk end to end with its positive control, and the `assert_folder_scopes_subset` signature. Group B (8) drives the REAL publish orchestration.
- **`backend/tests/unit/test_182_publish_grounding_stage.py`** (+11/-2) — the `resolve` AsyncMock returns `(_SUPABASE_SENTINEL, _DEF_ORG_ID)` against a new module-level org constant; `_publish_env`'s docstring names the tuple AND records that patching this seam is precisely why this file could not have caught WR-05. The `resolve_raises` branch, all 7 tests and every assertion are otherwise unchanged.
- **`backend/tests/unit/test_182_grounding_degradation.py`** (+7/-3) — the two `_resolve_publish_supabase` patches return `(client, _ORG)`. Nothing else; all 19 tests unchanged. See Deviations.
- **`.planning/seeds/SEED-130-workflow-template-placeholders-dead-path.md`** — see Accomplishments.

## Falsification Record

Both mutations were applied to the real source from the session scratchpad, observed, and reverted from a scratchpad backup with `md5sum -c` **and** an empty `git diff` on both files. No scratch `.py` was written anywhere under `backend/`; no `git stash`, no `git clean`, no blanket reset.

### (0) The natural REDs — the strongest evidence, because the code was genuinely pre-change

**Task 1 RED** (`0c383396`): **8 of 8** failed, seven of them the literal absence of the parameter:

```
E  TypeError: assemble_grounding_bundle() got an unexpected keyword argument 'restrict_org_ids'   (x2)
E  TypeError: fetch_visible_folders() got an unexpected keyword argument 'restrict_org_ids'        (x3)
E  TypeError: grounding_verdicts() got an unexpected keyword argument 'restrict_org_ids'           (x2)
E  assert 'restrict_org_ids' in mappingproxy(... folder_scope_violations ...)
```

**Task 2 RED** (`9d4f2c9b`): **4 failed / 12 passed**, and the load-bearing failure states the defect as a test artifact:

```
E  AssertionError: WR-05: an org-A definition referencing an org-B skill PUBLISHED, because the
   gate asked 'can this publisher see it?' instead of 'is this definition grounded in its own org?'
E  assert True is False                                    (published is True — the skill half)
E  assert True is False                                    (published is True — the folder half)
E  TypeError: cannot unpack non-iterable _FakeSupabase object   (the (client, org_id) contract)
E  assert True is False                                    (published is True — the falsy-org branch)
```

The 12 green in Task 2's RED are Group A (already fixed by Task 1) plus the two positive controls and the unreadable-org fail-closed path — parity guards that must NOT change, green in RED **by design**, the same posture 182-10 and 182-11 recorded.

### (a) Both `restrict_org_ids={str(org_id)}` arguments REMOVED from stage 2.6 → 2 failures

```
E  AssertionError: WR-05: an org-A definition referencing an org-B skill PUBLISHED, because the
   gate asked 'can this publisher see it?' instead of 'is this definition grounded in its own org?'
E  assert True is False        (the skill half)
E  assert True is False        (the folder half)
2 failed, 14 passed
```

**The load-bearing part of this observation is what did NOT fail.** Under the same mutation, the entire rest of the phase-182 surface — `test_182_validate`, `test_182_folder_scope_keying`, `test_182_publish_grounding_stage`, `test_182_severity_codes`, `test_publish_service`, `test_182_extraction_parity`, `test_182_grounding_bundle`, `test_revert_byte_identical`, `test_181_flip_on`, `test_182_grounding_degradation` — reported **106 passed, 0 failed**. The new file is the SOLE discriminator against a gate scoped to the publisher's union, which is precisely why it had to be written.

### (b) The `fetch_visible_folders` intersection changed to a UNION → 4 failures

```
E  AssertionError: WR-05 (folder half): an org-B folder stayed visible while acting on behalf of
   an org-A definition
E  assert 'bbbb2222-...-000000000001' not in {'aaaa1111-...0001', 'aaaa1111-...0002', 'bbbb2222-...0001'}
E  assert {'aaaa1111-...0001','aaaa1111-...0002','bbbb2222-...0001'} == {'aaaa1111-...0001','aaaa1111-...0002'}
E  AssertionError: []
   assert [] == ['folder_scope']      (the ⊆ walk went CLEAN — the fabricated green)
E  assert True is False               (and the publish-level folder test published)
4 failed, 12 passed
```

The chain is visible in one run: a wider org set → a wider visible folder set → a wider resolved subtree → no `folder_scope` verdict → a published definition. One operator is the entire difference.

### Restoration

```
app/services/harness/publish_service.py: OK      (md5sum -c against the backup)
app/utils/folder_utils.py:               OK
git diff --stat -- <both files>       ->  empty
tests/unit/test_182_publish_org_scope.py -> 16 passed
```

## Verification Evidence

### Baselines recorded BEFORE editing

| Measurement | HEAD (`c4d4924a`) | After |
|---|---|---|
| Phase-182 9-file surface | **87 passed, 0 failed** | **87 passed, 0 failed** |
| `grep -c "is_org_shared" grounding.py` | 4 | **4** (unchanged — no second predicate) |
| `grep -c "build_skill_visibility_or\|skill_row_visible" grounding.py` | 4 | **4** (unchanged — the shared rule's use) |
| `grep -c "restrict_org_ids" app/api/workflows.py` | 0 | **0** (`/validate` deliberately unrestricted) |
| `grep -c "= await _resolve_publish_supabase(" publish_service.py` | 2 | **2** (both now tuple unpacks) |
| `grep -c "SELECT org_id FROM workflow_definitions"` | 1 | **1** (one read, two consumers) |

### Test runs

| Gate | Result |
|---|---|
| Task 1 `<verify>` (5 suites) | 34 passed, **1 pre-existing failed (D1)** |
| Task 1 acceptance (8 suites) | 68 passed, **1 pre-existing failed (D1)** |
| Task 2 `<verify>` (`182_publish_grounding_stage`, `publish_service`) + validate + degradation | **74 passed** |
| Task 3 `<verify>` (`182_publish_org_scope`, `182_publish_grounding_stage`, `publish_service`) | **included in the 74** |
| Plan `<verification>` (12 files) | **115 passed**, 1 pre-existing failed (D1) |
| Phase-182 9-file baseline | **87 passed, 0 failed** (unchanged) |
| Adjacent sweep (`182_grounding_degradation`, `integration/test_folders`, `integration/test_kb`, `182_canvas_gate`, `181_off_audience`, `103_lint_block`, `103_draft_crud`, `harness_resume`) | **107 passed, 0 failed** |
| `test_dual_mode_wiring.py` | 15 failed, 38 passed — **exactly D2's recorded 15**, zero net-new |
| `python -c "import app.main"` | exit **0** |
| Import smoke over every affected caller (`api/folders`, `api/kb`, `agent_loop`, `harness/scope`, `workflow_kickoff`, `workflow_authoring`, `api/runs`, `harness_engine`, `main`) | exit **0** |

### Acceptance greps

| Check | Required | Observed |
|---|---|---|
| `restrict_org_ids: set[str] \| None = None` across the 3 files | 5 (see correction below) | **6** — 1 `folder_utils` + 2 `scope` + 3 `grounding` |
| intersection sites | exactly 2, each right after `_resolve_caller_org_ids` | **2** — `folder_utils.py` and `grounding.py`, one each |
| `is_org_shared` in `grounding.py` | unchanged from HEAD | **4 = 4** |
| shared-predicate refs in `grounding.py` | unchanged from HEAD | **4 = 4** |
| `assert_folder_scopes_subset` signature | 3 parameters, no restriction | `definition`, `supabase`, `user_id` — pinned by a runtime `inspect.signature` test |
| `None` / `set()` semantics stated | in both `fetch_visible_folders` and `assemble_grounding_bundle` docstrings | present in both |
| `restrict_org_ids={str(org_id)}` in `publish_service.py` | 2 | **2** |
| `= await _resolve_publish_supabase(` | 2, both tuple unpacks | **2** — `resolved, org_id = ...` and `supabase, _golden_run_org_id = ...` |
| one `SELECT org_id`, no early `return supabase` | yes | 1 / **0** |
| `restrict_org_ids` in `app/api/workflows.py` | 0 | **0**, asserted by a source test |
| IN-05 named in `publish_service.py` | ≥ 1 | **1**, above the stage-2.6 call site |
| one-source guard tokens (`available_tools` / `skill_ref`) in `publish_service.py` | 0 / 0 | **0 / 0** |
| `def test_` in the new file | ≥ 5 | **16** (750 lines; plan floor was 150) |
| `assemble_grounding_bundle` in the new file | NOT patched | **10 mentions, 0 patches** — see the patch-stack note below |
| unrestricted-present + restricted-absent assertions | both | present (skills and folders) |
| `AsyncMock(return_value=(_SUPABASE_SENTINEL` | 1 | **1** |
| SEED-130 `status: open` / `folded_into: null` | both | both |
| `grep -c "Not a security issue"` in SEED-130 | 0 | **0** (also 0 case-insensitively) |
| "unsafe as written" on Option B + `## Correction (Phase 182 gap closure` | present | **2** / **1** |
| SEED-130 frontmatter strict-YAML parse | parses | parses — 5 `re_open_triggers` (4 original + 1 new), 3 `confirmed` unchanged |
| `template_asset_service.py` touched | no | **no** — `git status` clean for that path |

### How the new file's patch stack differs from `_publish_env` (recorded per the plan's criterion)

`test_182_publish_grounding_stage._publish_env` patches **seven** seams; this file's `_publish_env` patches **five**. The two it deliberately omits are the whole point:

| Seam | Sibling file | This file |
|---|---|---|
| `app.db.workflows.get_definition` / `write_audit` / `publish_definition` | patched | patched |
| `publish_service._drive_golden_run` / `_judge_golden_output` | patched | patched |
| `publish_service._resolve_publish_supabase` | **patched** (returns a sentinel + a fixed org) | **NOT patched** — the real helper reads the definition's org from the pool |
| `grounding.assemble_grounding_bundle` | **patched** (a synthetic bundle) | **NOT patched** — the real org gate runs against the offline fake client |
| `grounding.grounding_verdicts` | not patched | not patched |

The sibling file tests the grounding RULES against a fixed org; this file tests the org SCOPE. Patching `_resolve_publish_supabase` is exactly why the sibling could not have caught WR-05, and that sentence is now in its `_publish_env` docstring.

### Scope containment

`git diff --name-only 0c383396~1 HEAD` lists **8 files** — the plan's 7 plus `test_182_grounding_degradation.py` (Deviation 1). `git diff --diff-filter=D` across the whole range is **empty** — no deletions. Every file was staged by explicit path; never `git add .` / `-A`, leaving the ~400 unrelated `.claude/` modifications and the 4 pre-existing untracked `backend/` files alone. No new untracked file was created anywhere in the repo. No migration, no `requirements.txt` change, no new import, no frontend file.

## Decisions Made

Four judgement calls beyond the plan's explicit decisions.

**1. The restriction is forwarded to internal callees ONLY when it is not `None`.** Threading `restrict_org_ids=restrict_org_ids` unconditionally — the literal reading of the plan — broke **18 tests** across `test_182_folder_scope_keying.py` (15 of its 16) and `test_098_scope_governance.py` (2 net-new), with `TypeError: _fake_resolve() got an unexpected keyword argument 'restrict_org_ids'`. The cause is structural, not incidental: `fetch_visible_folders`, `resolve_project_subtree` and `folder_scope_violations` are **documented monkeypatch seams** (`test_182_folder_scope_keying.py`'s own module docstring names `resolve_project_subtree` as *the* seam that lets the REAL ⊆ walk run against a fake subtree). Adding a keyword to a seam's call shape is a breaking change to that seam's contract — every existing double, and every future one, must grow a parameter it ignores.

Forwarding only when set gives three properties the unconditional form does not: (i) the plan's own must-have — "every existing caller is byte-identical BY CONSTRUCTION" — becomes true *on the wire*, not merely in outcome; (ii) the change stays inside `files_modified` instead of editing 18 tests in two unscoped files, avoiding the Phase-177 coverage-loss risk; (iii) a RESTRICTED call still passes the keyword explicitly, so a stale double meeting a real tenancy narrowing fails **loudly** rather than silently ignoring it — strictly better than a `**kwargs` swallow. The rule is written out once, in `scope.resolve_project_subtree`, and referenced from the other two sites so it reads as a decision.

**2. `_resolve_publish_supabase` RAISES on a falsy org in the caller-supplied branch.** The plan says the supplied branch must not return `(supabase, None)` and that "a falsy org must never resolve to an unrestricted gate", but the mechanism it names (the org-requiring factory) only exists on the *other* branch. Returning `(supabase, None)` would make the restriction `{"None"}` — accidentally fail-closed, and fail-closed by coincidence is not a control. An explicit refusal makes both branches agree, and stage 2.6's fail-closed wrapper turns it into `grounding_unavailable`, which BLOCKS. Pinned by `test_a_falsy_definition_org_blocks_rather_than_publishing_unrestricted`, which was RED (`published is True`) before the change.

**3. The discriminating tests were authored as each task's RED gate rather than deferred to Task 3.** The plan marks all three tasks `tdd="true"` but assigns no test file to Tasks 1 or 2 — internally inconsistent, since TDD requires the test to precede the source change. Authoring them one and two tasks earlier makes them strictly stronger evidence: they were observed failing against *genuinely pre-change* code, not only against a temporarily-mutated implementation. This is the pattern 182-10 recorded (`patterns-established`: "Author the discriminating test as the task's RED gate"). Task 3 kept the SEED correction and both plan-mandated mutation falsifications, which were then executed on top.

**4. Tests invalidated by Task 2's return-shape change were fixed in Task 2's commit.** The plan assigns the resolver-fake update to Task 3, which would have left the suite red across two commits. The invalidation is *causally* owned by the change that causes it, so it was folded in — the 182-11 precedent. Consequence: every commit in this plan leaves the phase surface green, which matters for bisect. The plan's Task-2 criterion ("0 failed *after Task 3 updates the resolver fake*") is satisfied more strongly, not weakened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `test_182_grounding_degradation.py` also patches the tuple-returning resolver**

- **Found during:** Task 2, before running the verify command.
- **Issue:** the plan's `<interfaces>` identified only `test_182_publish_grounding_stage.py` as needing the `(client, org_id)` update. `tests/unit/test_182_grounding_degradation.py` — **created by plan 182-11, after this plan was written** — patches `_resolve_publish_supabase` at two sites (`AsyncMock(return_value=object())` and `AsyncMock(return_value=_skills_boom_client())`). Both would raise `TypeError: cannot unpack non-iterable object` under the new return shape, taking two of 182-11's 19 WR-01 proofs red.
- **Fix:** both patches now return `(client, _ORG)` with a one-line comment naming plan 182-12 / WR-05. No assertion, no test name and no other line in the file changed; the test count stays **19**.
- **Files modified:** `backend/tests/unit/test_182_grounding_degradation.py` (an 8th file, outside the plan's `files_modified`).
- **Commit:** `75b23bbe`

No Rule 1, Rule 2 or Rule 4 items arose. No package was installed; `requirements.txt` is untouched.

### Acceptance-criteria corrections (not code deviations)

**1. The signature-literal grep totals 6, not 5 — and the criterion is internally inconsistent.** Task 1's criterion says "in all four signatures … totals 5" and then enumerates *five* functions. The plan's own action text additionally requires the private `_folder_scope_violations` to carry the parameter ("thread it into `_folder_scope_violations`, which threads it into `scope.folder_scope_violations`"). Formatted consistently with its five siblings, that is a sixth matching line. **All five enumerated public signatures have the literal** (`folder_utils` 1, `scope` 2 = `resolve_project_subtree` + `folder_scope_violations`, `grounding` 2 = `assemble_grounding_bundle` + `grounding_verdicts`), plus the private helper the plan requires (`grounding.py:571`). The criterion's intent — every function that gained the parameter has it keyword-only with a `None` default — holds exactly; only the arithmetic was off by the helper the same plan mandates.

**2. Task 1's "0 failed" gate is unreachable — the true result is 34 passed / 1 pre-existing failed.** The criterion assumes `tests/test_098_scope_governance.py` is fully green. `test_run_start_resolution` is **deferred item D1**, logged by plan 182-04: it fails at `harness_engine.py` → `dependencies.py` with `ValueError: get_service_role_supabase requires an explicit org_id`, inside `_build_resume_context`, before any code this plan touches is reachable. Not chased (SCOPE BOUNDARY). Plans 182-04, 182-10 and 182-11 all recorded the same correction for the same suite.

**3. Falsification (a) reaches 2 tests, not the plan's implied 1.** The criterion asks to confirm "test (1) FAILS by publishing the org-B-referencing definition". It does — and so does the publish-level folder test, because both grounding calls lost their restriction. The extra failure is recorded rather than trimmed; the more informative measurement is the **106 passed** everywhere else, which establishes the new file as the sole discriminator.

## Issues Encountered

- **The unconditional keyword's 18-test blast radius** (Decisions #1) was caught by running the Task-1 acceptance suite before committing, not after. It is the only substantive obstacle this plan hit.
- **The SEED-130 correction initially defeated its own acceptance grep** — the same trap 182-11 documented. Quoting the false claim as provenance ("This seed recorded … '**Not a security issue.**'") is good writing and leaves `grep -c "Not a security issue"` at **2**. Reworded to describe the claim without reproducing it, with a parenthetical saying *why* it is not quoted. Now **0** case-sensitively and **0** case-insensitively.
- **The pre-existing D1 and D2 failures** both reproduce at their recorded counts (1 and 15 respectively). Neither was chased, per `deferred-items.md` and the orchestrator's instruction; neither is causally reachable from this plan's changes.
- **No new `deferred-items.md` entry was needed.** No out-of-scope discovery beyond D1/D2, both already logged.

## Threat Model Coverage

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-182-52 (EoP — cross-tenant reference through the publisher's org union) | mitigate | **Closed — the gap this plan exists to fix.** The definition's `org_id` is returned by `_resolve_publish_supabase` and passed as `restrict_org_ids={str(org_id)}` into both grounding calls. Pinned by a cross-org publish test with the REAL gate running and falsified by removing both arguments (2 failures; 106 unaffected tests elsewhere). |
| T-182-53 (Tampering — a duplicated visibility rule) | mitigate | **Held.** The intersection happens at exactly two points, each immediately after `_resolve_caller_org_ids`. `grep` proves `is_org_shared` (4→4) and the shared-predicate references (4→4) are unchanged in `grounding.py`; `build_skill_visibility_or`, `skill_row_visible` and `is_in_global_subtree` are byte-identical. The mechanism test additionally asserts the PUSHED-DOWN predicate narrows, so the two encodings cannot drift apart. |
| T-182-54 (EoP — a fail-open restriction) | mitigate | **Closed.** `None` = unrestricted, `set()` = no org-shared visibility; stated in both docstrings and pinned by `test_an_empty_restriction_is_fail_closed_never_unrestricted`, which asserts even the caller's OWN org resolves nothing under an empty restriction. A falsy definition org is refused on both branches of the resolver and lands in 182-11's `grounding_unavailable`, which BLOCKS — pinned by two tests. |
| T-182-55 (Info disclosure — narrowing run-start / NL-gen by accident) | accept | **Held, and now asserted.** `assert_folder_scopes_subset` did not gain the parameter (runtime `inspect.signature` test) and `/validate` passes none (`grep -c` 0, asserted by a source test). Both asymmetries are written into docstrings as decisions with the caller list that justifies them. |
| T-182-56 (EoP — arbitrary cross-tenant object read via `template_asset_id`) | mitigate (documentation control) | **Closed as scoped.** No source changed — the dead-path fix stays deferred to Phase 184. SEED-130's security verdict is corrected against re-verified source facts (`resolve_template_source` Branch 1 accepts `user_id` and never reads it; the download is a raw service-role bucket read), Option B is annotated unsafe-as-written with the required ownership gate spelled out, and a `re_open_trigger` now requires that gate in the same commit. The control being fixed is the record. |
| T-182-57 (DoS — an extra `org_members` round-trip) | accept | **Held.** No query was added: the intersection reuses the set `_resolve_caller_org_ids` already resolves, and `_resolve_publish_supabase` still performs its single `SELECT org_id` (grep: 1) — now returned rather than discarded. IN-05's pre-existing double resolution is recorded in-source, explicitly noted as predating this change. |
| T-182-58 (Repudiation — a publish that passed but under-performs at run time) | mitigate | **Closed by construction.** The gate's scope and the runner's scope are now the same org, so a failing run is a real failure rather than an unattributable discrepancy between "the gate said yes" and "the runner says no". |
| T-182-SC (package installs) | accept | Zero installs. No `requirements.txt` change, no new import in any of the four source files. |

## Known Stubs

None. A scan of the four source files and three test files for `TODO` / `FIXME` / `placeholder` / "coming soon" / "not available" returned no new hits. The `{}` empty-kwargs expression at each forwarding site is the semantically correct "no restriction" call shape (Decisions #1), not unwired data; the empty-set restriction path is a deliberate fail-closed scope, documented and tested as such.

## Threat Flags

None. No new network endpoint, no new auth path, no new file access, no schema change, no migration, no frontend file, no new dependency. The change NARROWS an existing service-role read's effective scope and adds one refusal on an existing helper.

## User Setup Required

None — backend-only. No environment variable, migration, seed row, cloud configuration, package install or frontend change. No deployment-artifact parity obligation (no env var read, no seed-bearing migration, no bundled service, no sandbox image tag).

## Next Phase Readiness

- **Phase 184's canvas inherits a `/validate` that is deliberately unchanged.** An author validating their own draft still sees their own full view; only PUBLISH narrows. If Phase 184 ever wants the canvas to preview what the *definition's org* can reach, the keyword already exists and the decision is recorded — but it is a new decision, not an omission this plan left behind.
- **Phase 185 (graded governance) inherits a correctly-scoped registry.** A per-node `grounding_mode` verdict added to the same collector automatically evaluates against the definition's own org on the publish path, because the restriction rides `assemble_grounding_bundle` and `grounding_verdicts` rather than any individual rule.
- **Phase 184 can no longer inherit SEED-130's wrong verdict.** The seed now says what the source actually does, names the incidental containment, and blocks Option B behind an ownership gate that must ship in the same commit. The dead-path fix itself is still Phase 184's, unchanged.
- **Deliberately still open, recorded rather than forgotten:**
  - **IN-05** — `publish_workflow` keeps `supabase=None` between stage 2.6 and the golden run, so `_resolve_publish_supabase` runs twice per publish and each self-constructed client opens an httpx client that is never closed. Recorded in-source above the stage-2.6 call site. Re-open trigger: any restructuring of `publish_workflow`'s client lifecycle, or the next resource-leak pass.
  - **WR-03** (narrow the ⊆ rule's `except ValueError`) — untouched, still recorded in `grounding.py`'s source.
  - **The second folders round-trip** — `resolve_project_subtree` reads the tree again; now with the same restriction, so the two reads agree about scope even though they are separate round-trips.
  - **`_resolve_caller_org_ids`' own unguarded `aexec`** — unchanged; guarded at both grounding call sites by 182-11.
- **Carried forward unchanged:** `deferred-items.md` D1-D4. D1 and D2 were re-observed at their recorded counts this session; D3 was re-confirmed not to include SEED-130 (its frontmatter parses); D4 was not re-touched.
- This was the **LAST plan** of the round-2 gap closure and of phase 182. Remaining gap-closure plans: **none**.

## Self-Check: PASSED

All 8 claimed files exist on disk and all 5 claimed commits resolve in `git log --all`:

- FOUND: `backend/app/utils/folder_utils.py`, `backend/app/services/harness/scope.py`, `backend/app/services/harness/grounding.py`, `backend/app/services/harness/publish_service.py`, `backend/tests/unit/test_182_publish_org_scope.py`, `backend/tests/unit/test_182_publish_grounding_stage.py`, `backend/tests/unit/test_182_grounding_degradation.py`, `.planning/seeds/SEED-130-workflow-template-placeholders-dead-path.md`
- FOUND: `0c383396`, `b0f19602`, `9d4f2c9b`, `75b23bbe`, `b9578929`

Claimed counts independently re-confirmed by both `grep -c` and `pytest`: **16** tests in the new file (750 lines), **7** in `test_182_publish_grounding_stage.py` (unchanged), **19** in `test_182_grounding_degradation.py` (unchanged).

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
