---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 02
subsystem: api
tags: [python, pydantic, fastapi, harness, workflow-definition, grounding, governance, pytest, zero-migration]

# Dependency graph
requires:
  - phase: 182-workflow-validation-seam
    provides: "harness/grounding.py — the D-182-06 one-rule-one-home module, GroundingBundle, assemble_grounding_bundle, and the GET /workflows/grounding-bundle palette route"
  - phase: 103-workflow-studio
    provides: "PhaseSpec.name — the additive-optional / zero-migration extension precedent on an extra='forbid' model"
  - phase: 102-quality-gates
    provides: "ValidatorSpec.kind (grown 4 -> 9), timing='pre', the ask_user on_failure value"
provides:
  - "PhaseSpec.grounding_escalated and PhaseSpec.action_risk_armed — two flat additive-optional booleans at PhaseSpec level (D-185-06/08); pre-185 workflow_definitions JSONB rows still model_validate()"
  - "ValidatorSpec.kind grown 9 -> 10 with action_risk_approval (D-185-12) — 185-04's armed pre-gate can now be constructed"
  - "grounding.KB_TOOLS (frozenset) + grounding.KB_TOOLS_SORTED (wire form) — the ONE backend home for the 5 KB-reading tool names"
  - "grounding.grounding_cause(phase) -> 'detected' | 'already-set' | 'escalated' | None — pure, zero-I/O, branch order load-bearing"
  - "GroundingBundle.kb_tools, populated unconditionally in assemble_grounding_bundle (including on the degraded path)"
  - "GroundingBundleResponse.kb_tools on GET /workflows/grounding-bundle — the client reads the list as DATA, never hardcodes it"
  - "backend/tests/unit/test_185_detection.py — 38 cases covering SPEC acceptance criteria 4-8 plus the palette half of D-185-09"
affects: [185-03-engine-attachment, 185-04-armed-checkpoint, 185-06-governance-section, 185-07-canvas-seal, 185-08-detour-edge, 188-run-surface, 189-external-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derive-don't-store: the authored INTENT is a boolean on the model; every derived cause is recomputed at read time by a pure function, never persisted (no model_validator anywhere near the save path)"
    - "Python source-guard tests via `tokenize` — comments and string literals neutralised so the guard tests CODE, with the needle assembled from parts and every regex carrying a positive control"
    - "Route tests that drive the REAL bundle assembler behind a fake supabase, so the claim under test is what the assembler populates rather than what a stub was handed"

key-files:
  created:
    - backend/tests/unit/test_185_detection.py
    - .planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/deferred-items.md
  modified:
    - backend/app/models/harness.py
    - backend/app/services/harness/grounding.py
    - backend/app/api/workflows.py
    - backend/tests/unit/test_harness_models.py

key-decisions:
  - "Final field names: PhaseSpec.grounding_escalated and PhaseSpec.action_risk_armed, both `bool = False` — the one deliberate deviation from PhaseSpec.name's `X | None = None` spelling, because D-185-08 requires absence to be unambiguous"
  - "Final wire key: `kb_tools`, a flat `list[str]` on GroundingBundleResponse immediately after `tools` — `tools` keeps its shipped `list[str]` shape, so no useGroundingBundle / PhaseFormRails consumer breaks"
  - "grounding_cause lives in harness/grounding.py, NOT on the model — a model_validator would be baked into the JSONB by the draft save path's model_dump(mode='json') and would invert Req 3 (L-2)"
  - "The KB list is served UNCONDITIONALLY, outside every try/except in assemble_grounding_bundle: a degraded folders/skills read must never silently un-mark a locked step"
  - "The stale `the two Literal sets remain LOCKED` docblock was rewritten rather than deleted — growth is additive, an EXISTING member's spelling is what is locked"

patterns-established:
  - "Unrepresentable-illegal-state over documented-rule: SPEC Req 3 holds because no stored value can say a detected step is free to think, so a hand-edited JSONB row cannot lie"
  - "Falsification-before-green: the criterion-8 source guard was physically planted red against the shipped module and the failure output quoted, then reverted"

requirements-completed: [GOVERN-01, GOVERN-03]

# Metrics
duration: 24min
completed: 2026-07-29
---

# Phase 185 Plan 02: Detection Foundation Summary

**The two additive-optional governance intents landed on `PhaseSpec`, `KB_TOOLS` and a pure `grounding_cause()` got exactly one backend home in `harness/grounding.py`, and the palette route now ships the KB tool list as data — with zero migrations, zero engine behaviour change, and a source guard proving no derived cause is ever stored.**

## THE NAMES DOWNSTREAM PLANS MUST USE

Plans 185-03, 185-06, 185-07 and 185-08 reference these literally. They are final:

| What | Verbatim name | Where |
|---|---|---|
| The authored grounding intent | **`grounding_escalated`** (`bool = False`) | `PhaseSpec`, `backend/app/models/harness.py` |
| The authored action-risk intent | **`action_risk_armed`** (`bool = False`) | `PhaseSpec`, `backend/app/models/harness.py` |
| The armed pre-gate kind | **`"action_risk_approval"`** | `ValidatorSpec.kind` Literal, same file |
| The KB tool set (membership) | **`KB_TOOLS`** (`frozenset[str]`) | `backend/app/services/harness/grounding.py` |
| The KB tool list (wire/JSON) | **`KB_TOOLS_SORTED`** (`list[str]`) | same module |
| The cause derivation | **`grounding_cause(phase) -> str \| None`** | same module |
| The bundle field | **`GroundingBundle.kb_tools`** | same module |
| The wire payload key | **`kb_tools`** | `GroundingBundleResponse`, `backend/app/api/workflows.py` |

`grounding_cause` returns exactly one of `"detected"` / `"already-set"` / `"escalated"` / `None`.
`KB_TOOLS_SORTED == ["analyze_document", "get_related_documents", "query_documents", "read_document", "search_documents"]`.

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-29T14:30:00Z (approx — first task commit at 14:39:29Z)
- **Completed:** 2026-07-29T14:54:59Z
- **Tasks:** 3
- **Files modified:** 4 (+2 created)

## Accomplishments

- **Two flat booleans at `PhaseSpec` level, and a pre-185 row still parses.** `grounding_escalated` and `action_risk_armed` sit as siblings of `validators` and `name`, both `bool = False`. `PhaseSpec` is an `extra="forbid"` `_StrictBase`, so this is the whole zero-migration claim — and every row in `workflow_definitions` today is a pre-185 row. Pinned by `test_pre_185_phase_row_parses_without_the_governance_keys`. **Nothing was added to any `PhaseConfig` union member** (L-12) — `git diff` shows zero added lines between the six config class declarations.
- **`ValidatorSpec.kind` grew 9 → 10.** `"action_risk_approval"` is now constructible; without it 185-04's synthesized pre-gate would raise at build time, because `ValidatorSpec` validates on construction.
- **The stale module docblock is corrected.** `models/harness.py` claimed *"the two Literal sets remain LOCKED (do NOT change them)"* — untrue since Phase 102 grew `kind` 4 → 9 and Phase 101.1 grew `phase_type` 5 → 6. It now states that the sets grow additively (with the phase-by-phase history), that growth is safe because every stored value still validates, and that what is locked is an **existing member's spelling** plus the discriminator / `extra='forbid'` / union mechanism.
- **Detection has exactly one backend home.** `KB_TOOLS` (frozenset) + `KB_TOOLS_SORTED` (the JSON wire form, mirroring how `GroundingBundle` already carries `tools: list[str]` beside `tool_names: set[str]`) live in `harness/grounding.py` under the D-182-06 RED LINE. The greps confirm it: `grep -rn ... backend/app/services/ | grep -v harness/grounding.py | grep -c KB_TOOLS` → **0**.
- **`grounding_cause()` is pure, and its branch order is the mechanism.** `detected` is checked FIRST, then `already-set`, then `escalated`. That total ordering is what makes SPEC Req 3's *"detection wins and the undo disappears"* structural: an escalated step that later gains `search_documents` reports `detected`, its stored `grounding_escalated: True` goes **inert** (never rewritten), and removing the tool restores `escalated` with the undo. Pinned end-to-end in `test_detection_wins_over_escalation_and_the_bit_goes_inert`.
- **`folder_scope` is provably not a detection input.** It exists on all five LLM config members including `llm_single`, so reading it would auto-lock steps with no retrieval path — steps the gate could only ever fail. `test_folder_scope_alone_never_triggers_detection` covers both the scoped agent with an empty whitelist and the scoped `llm_single`.
- **The client can read the list instead of hardcoding it.** `GET /workflows/grounding-bundle` gains one additive flat `list[str]`, read off `bundle.kb_tools` and **never recomputed in the route** — the same discipline the shipped `degraded` comment already enforces. `tools` keeps its shipped `list[str]` shape, so no `useGroundingBundle` / `PhaseFormRails.toolOptions` consumer breaks.
- **Nothing enforces anything yet.** No engine call site reads either boolean; `effective_phase` and the `harness_engine.py:1118` seam are plan 185-03's.

## Task Commits

1. **Task 1: The two PhaseSpec booleans and the `action_risk_approval` kind** — `f3584c5b` (feat)
2. **Task 2: `KB_TOOLS` and the pure `grounding_cause()` derivation** — `04d475d4` (feat)
3. **Task 3: Serve the KB tool list on the shipped grounding-bundle route** — `9fe05885` (feat)

## Files Created/Modified

- `backend/app/models/harness.py` — `PhaseSpec.grounding_escalated` / `PhaseSpec.action_risk_armed` under a `# ── Phase 185 … ──` section header carrying the three required clauses (additive/zero-migration, intent-only, pointer to the one home); `ValidatorSpec.kind` 9 → 10; module docblock corrected.
- `backend/app/services/harness/grounding.py` — `KB_TOOLS` / `KB_TOOLS_SORTED` / `grounding_cause()` in a new end-of-module section; `GroundingBundle.kb_tools` field; `kb_tools=KB_TOOLS_SORTED` in the single `return GroundingBundle(...)`.
- `backend/app/api/workflows.py` — `GroundingBundleResponse.kb_tools` (after `tools`) and `kb_tools=bundle.kb_tools` in the route's single return. **Exactly 2 lines mention it**, both code.
- `backend/tests/unit/test_harness_models.py` — 3 new tests: the pre-185 parse, the `model_dump` round trip (with the not-a-zero-diff-save side effect recorded in the docstring), and the new validator kind.
- `backend/tests/unit/test_185_detection.py` — **NEW**, 38 tests: 10 parametrized single-tool detection cases across `llm_agent` + `llm_batch_agents`, the negative set, the `already-set` cases, `folder_scope`/`skill_ref` near-misses, the branch-order suite, the criterion-8 source guard with three positive controls, and 4 palette-route tests.
- `.planning/phases/185-.../deferred-items.md` — **NEW**, records the 62 pre-existing backend unit-test failures as out of scope.

## Decisions Made

- **Field names taken verbatim from D-185-08's own illustrative spelling.** `grounding_escalated` names the only AUTHORED cause of the three, which is exactly D-185-07's point; `action_risk_armed` matches the operator's own vocabulary ("armed", "the armed mark") in sketch 147 and SPEC Req 8, so code and design docs share one word.
- **`bool = False`, not `bool | None = None`.** The one deliberate deviation from the `PhaseSpec.name` precedent, per D-185-08: absence and explicit-off must be the same value, so there is exactly one way to say "not set".
- **The derivation section sits at the END of `grounding.py`**, following the `business_requirement_missing` placement idiom ("a trivial check is still a rule, and one home"). `KB_TOOLS_SORTED` is referenced earlier by `assemble_grounding_bundle`, which is fine — module-level names resolve at call time.
- **`kb_tools` is populated OUTSIDE every `try` block** in `assemble_grounding_bundle`, alongside a comment saying so. It is a module constant that cannot fail, and suppressing it on the degraded branch would let a PostgREST blip render a governed step as ungoverned while the engine went on gating it.
- **The route-level tests drive the REAL assembler behind a fake supabase**, rather than monkeypatching `assemble_grounding_bundle`. The claim under test is that the *assembler* populates the field on every path; a stubbed bundle would only prove the route copies what it was handed. A third test then swaps the assembler for one returning a sentinel list and asserts the response follows it — behavioural proof the route computes nothing.
- **No comment in `api/workflows.py` spells the wire key**, so the acceptance grep ("exactly 2 code lines") stays meaningful rather than being satisfied by prose.

## Falsification — the criterion-8 source guard was observed RED

Required evidence for acceptance criterion 8. `grounding_mode = "detected"` was planted at module scope in `backend/app/services/harness/grounding.py`, the guard run, and the plant reverted. Observed output:

```
E       AssertionError: `grounding.py` assigns or declares 'grounding_mode' — a cause must only ever be RETURNED by grounding_cause(), never stored (D-185-07)
E       assert not True
E        +  where True = _stores('"" from __future__ import annotations import logging from dataclasses import dataclass , field from typing import TYP... if getattr ( phase . config , "" , None ) == "" : return "" if getattr ( phase , "" , False ) : return "" return None', 'grounding_mode')
FAILED tests/unit/test_185_detection.py::test_grounding_module_never_stores_a_derived_cause[grounding_mode]
1 failed, 2 passed, 31 deselected
```

Note the `_code_only` output in the failure: every docstring and string literal is `""`, which is the point — the guard reads code, so it cannot be satisfied by editing prose (the D-ITEM-183-02 trap). The three forbidden needles (`grounding_cause`, `grounding_mode`, bare `cause`) are assembled from string fragments in the test file so they never appear literally. Three further live positive controls (`test_the_code_extractor_is_real_…`, `test_the_store_detector_is_real_…`) prove the extractor and the regex can go red on planted assignment, annotated-field and attribute-write shapes, and that a plain `return` does **not** trip them.

## Verification Evidence

| Check | Result |
|---|---|
| `pytest tests/unit/test_harness_models.py -q` | **11 passed** (8 shipped + 3 new) |
| `pytest tests/unit/test_185_detection.py -q` | **38 passed** |
| `pytest tests/unit -q -k "grounding or 185 or workflows"` | **90 passed** |
| `pytest tests/unit -q -k "grounding or 182 or harness or 185"` | **161 passed** |
| `git diff --stat -- supabase/migrations` (whole plan) | **0 files** — live head stays 113 |
| `git diff --stat -- frontend/` (whole plan) | **0 files** — backend-only |
| D-14 Deep fence: `git diff --stat -- agent_loop.py tool_dispatcher.py openai_service.py anthropic_service.py` | **0 files** |
| `grep -c "grounding_escalated: bool = False"` / `"action_risk_armed: bool = False"` | **1** / **1** |
| stale-docblock grep (`the two Literal sets remain LOCKED`, comments stripped) | **0** |
| KB list one-home grep (services minus `harness/grounding.py`, minus dispatcher) | **0** |
| `grep -n "kb_tools" backend/app/api/workflows.py` | exactly **2** lines, both code (`:384` field, `:727` serialization) |
| route-computes-nothing grep (`kb_tools=grounding.KB_TOOLS\|kb_tools=sorted(\|kb_tools=[`) | **0** |
| files touched by this plan | exactly the 5 in `files_modified` |

## Deviations from Plan

None — plan executed exactly as written. No auto-fix rule fired; no package installs; no architectural question arose.

Two small judgement calls inside the plan's own latitude, recorded for the record:

- The `grounding_cause` / `KB_TOOLS` section was placed at the **end** of `grounding.py` (the `business_requirement_missing` idiom) rather than adjacent to the `GroundingBundle` dataclass. Both satisfy the plan's "two-blank-lines-around section header" instruction.
- The plan's Task-3 note allowed the route test to live "beside the existing grounding-bundle tests (or in `test_185_detection.py` if no route suite exists)". A route suite does exist (`tests/test_182_grounding_bundle.py`, plus section (E) of `tests/unit/test_182_grounding_degradation.py`), but the tests were written in `test_185_detection.py` so this plan's whole diff is additive and 185's evidence lives in one file. The `_FakeQuery` / `_FakeSupabase` doubles were copied and trimmed rather than imported across test files.

## Issues Encountered

**The full `tests/unit` suite is not green, and was not green before this plan.** `pytest tests/unit -q` reports **62 failed / 1549 passed**. All 62 are pre-existing rot in unrelated files (`test_retrieval_service` 15, `test_sql_service` 12 with a sync/async `coroutine is not iterable` drift, `test_explorer_agent` 6, `test_multimodal_query` 5, and 11 more), plus one unmocked live-provider test (`test_forced_emit_judge_verdict_unmocked`). Verified out of scope by grepping all 17 failing files for `PhaseSpec|GroundingBundle|grounding_bundle|harness` — a single hit, the live-provider one. Logged to `deferred-items.md` with a re-open trigger; **not fixed** (executor scope boundary).

**Consequence for phase verification:** the plan's `<verification>` line "`pytest tests/unit -q` — green" is not achievable on this tree by any change this plan could make. Scope the run (`-k "grounding or 185 or workflows or harness"` → 161 passed) instead.

## Known Stubs

None. Every value this plan introduces is either a real constant, a real pure function, or a real wire field populated from one. No placeholder text, no empty-array-flowing-to-UI, no TODO.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change at a trust boundary. The one wire addition (`kb_tools`) is a fixed 5-element constant of public tool names already present in the shipped `tools` palette (T-185-02-03, disposition `accept`). T-185-02-01's mitigation is delivered structurally: a client can only ever set `grounding_escalated`, which is an ESCALATION — strictly the safe direction — and `detected` / `already-set` are unrepresentable as stored state.

## User Setup Required

None — no external service configuration, no environment variable, no migration. Live migration head stays at **113**.

## Next Phase Readiness

- **185-03 (engine attachment)** is unblocked and has everything it needs: `grounding_cause` to branch on, `ValidatorSpec(kind="citations_required", ...)` constructible, and the `harness_engine.py:1118` `spec_by_slug` seam untouched. Its `effective_phase` must **append** (never prepend — `harness_engine.py:684-686` seeds the retry bound from `validators[0].max_retries`) and must **not** be a Pydantic `model_validator` (L-2 — a `test_185_detection.py` guard already pins the second half of that for `PhaseSpec`).
- **185-04 (armed checkpoint)** can now construct `ValidatorSpec(kind="action_risk_approval", timing="pre", on_failure="ask_user")`. RESEARCH landmines L-4 (`_is_abort_choice("Do not run it")` is a **fail-open** bug), L-5 (the pre-gate emits `gate_failed` before it can pause), L-6 (a graceful restart mid-wait fails the run) and L-7 (the resume sweep will not re-subscribe an armed pre-gate) are all still open and are that plan's problem.
- **185-06 / 185-07 / 185-08 (frontend)** should read `kb_tools` off `useGroundingBundle` and intersect client-side. `frontend/src/lib/api.ts`'s `GroundingBundle` interface still needs the mirrored field — that is a frontend change and was correctly excluded here (`git diff --stat -- frontend/` is 0 files).
- **Side effect the surface plans must expect:** `model_dump(mode="json")` now writes `"grounding_escalated": false, "action_risk_armed": false` into every saved draft JSONB. Additive and harmless (identical to `name: null` since Phase 103), but the first save of any pre-185 definition is **not** a zero-diff save.

## Self-Check: PASSED

- `backend/app/models/harness.py` — FOUND
- `backend/app/services/harness/grounding.py` — FOUND
- `backend/app/api/workflows.py` — FOUND
- `backend/tests/unit/test_185_detection.py` — FOUND
- `backend/tests/unit/test_harness_models.py` — FOUND
- Commit `f3584c5b` — FOUND
- Commit `04d475d4` — FOUND
- Commit `9fe05885` — FOUND

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-29*
