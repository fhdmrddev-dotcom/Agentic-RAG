---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
verified: 2026-07-31T00:00:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
deferred:
  - truth: "The corner seal survives a live run (idle -> running -> needs-you -> failed), watched on screen"
    addressed_in: "Phase 188"
    evidence: "185-VALIDATION.md G-4 #2 -- the canvas carries no run status in this phase (`PhaseNode.tsx:183` states status/technicalLine/stepNumber are deliberately NOT passed; `grep -n status canvasModel.ts` returns nothing), so there is no run-state transition to observe yet. RUNVIZ-01 (Phase 188) is where run status first reaches the canvas; a positive-controlled props fence (`PhaseNodeCard.test.tsx:987-1007`) holds the invariant structurally in the meantime and is re-verified confirmed in code during this pass."
---

# Phase 185: Graded Governance -- Per-Node Grounding Mode + Action-Risk Dial Verification Report

**Phase Goal:** Each node carries a grounding mode (Grounded/strict auto-attaches the immutable `citations_required` gate; Open/flexible is ungated) and an orthogonal action-risk approval checkpoint -- the milestone's headline differentiator, on a working canvas.

**Verified:** 2026-07-31
**Status:** passed
**Re-verification:** No -- initial verification

## Method

This report does not re-run the operator's Chrome-MCP UAT (already executed and dispositioned in `185-VALIDATION.md`, "Approval: GRANTED 2026-07-31"). It independently re-derives every load-bearing claim from the codebase and live systems: reading `grounding.py`, `harness_engine.py`, `phase_types.py`, `ask_user_service.py`, `GovernanceSection.tsx`, `PhaseNodeCard.tsx`, `FlowEdge.tsx`, `PhaseFormPanel.tsx`; running the full relevant backend (131 tests) and frontend (793 tests) suites fresh; connecting directly to the live local Postgres (`127.0.0.1:54322`) to confirm migration 114's actual applied state; and re-running `git diff --stat` fences at current HEAD (48+ commits past the `185-11` reading) rather than trusting the recorded fence table. Where VALIDATION.md's dispositions (the criterion-2 amendment, the G-4 #2 deferral, the D-185-18 downgrade) could be checked against source, they were -- and each held up.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | GOVERN-01 -- Detection is a named list (`KB_TOOLS`), never a judgement call; only `llm_agent`/`llm_batch_agents` can auto-lock | VERIFIED | `backend/app/services/harness/grounding.py:797-838` -- `KB_TOOLS = frozenset({search_documents, query_documents, read_document, analyze_document, get_related_documents})`; `grounding_cause()` checks `available_tools & KB_TOOLS` first (branch order load-bearing), then `citation_policy == "strict"` (`already-set`), then `grounding_escalated` (`escalated`). `folder_scope` is never read. `test_185_detection.py` (part of the 131 backend tests run fresh) passes. |
| 2 | GOVERN-01 -- One-way lock: detected/already-set have no removal path; escalated is undoable only until detection applies | VERIFIED | Same function: `detected` is checked BEFORE `escalated`, which is what makes "detection wins, undo disappears" true by construction rather than a rule someone must enforce. `grounding_escalated`/`action_risk_armed` are the ONLY authored booleans (`backend/app/models/harness.py:234-235`, additive-optional with `False` defaults); `detected`/`already-set` are recomputed every read and never persisted (D-185-07) -- there is no representable value that stores a detected step as free-to-think. |
| 3 | GOVERN-01 -- The engine attaches `citations_required` at run time on every detected phase, including already-published definitions, by appending (never substituting) the author's own validators | VERIFIED | `grounding.py:877-953` `effective_phase()` -- appends a `ValidatorSpec(kind="citations_required", timing="post", on_failure="fail_run", max_retries=2, mode="retrieved_and_cited")` only when `grounding_cause(phase) == "detected"`; docstring explicitly notes `run_gates` returns on first failure so an author's deliberately weak spec cannot displace the engine's, and D-185-05 forbids substitution. Confirmed WIRED at the actual run seam: `backend/app/services/harness_engine.py:1287-1290` -- `spec_by_slug = {p.slug: effective_phase(p, total_phases=_total) for p in definition.phases}`, sitting downstream of every `model_validate()` (fresh kickoff + boot resume + publish golden run). Returns the phase object BY REFERENCE when nothing is added (byte-identical D-14 for ungoverned phases, structurally not by claim). |
| 4 | GOVERN-01 -- A pre-185 JSONB row with no grounding field validates cleanly; the field is additive-optional, zero-migration | VERIFIED | `backend/app/models/harness.py:234-235` -- `grounding_escalated: bool = False`, `action_risk_armed: bool = False` on `PhaseSpec`, both with defaults so an old row without the keys parses fine. `test_harness_models.py` passes (part of the 131-test fresh run). |
| 5 | GOVERN-01 -- The dial refuses visibly; refusal reason is real DOM text (not a `title` attr); a step type that cannot be grounded renders no dial | VERIFIED (with one recorded, honest deviation) | Read `frontend/src/components/workflows/GovernanceSection.tsx:204-273` directly: for `hasDial=false` (any type outside `["llm_agent","llm_batch_agents"]`) the dial group is not rendered at all (query returns null, not a disabled node) -- matches "removed, not disabled". For a locked step, the loose button carries `disabled={refused}` + `aria-describedby={refused ? reasonId : undefined}`, and the refusal paragraph `<p id={reasonId} data-testid="governance-refusal">{GROUNDING_LOCK_REFUSAL}</p>` is rendered unconditionally whenever `refused` is true (not gated on a click). VALIDATION.md's G-4 #1 correctly discloses this as a wording deviation from the scenario's literal "pressing it prints the reason" -- the reason is always visible, not press-to-reveal -- and I confirm from source this is an honest description, not a smoothed-over gap: the scenario's INTENT (readable refusal, no dead greyed button) is met. |
| 6 | GOVERN-02 -- The canvas mark is shape (corner seal + edge reinforcement), never colour, never a word-badge, never conditional on run state; the 3-face word-badge is deleted | VERIFIED | `frontend/src/components/workflows/PhaseNodeCard.tsx:430-443` -- the seal block reads `grounded` and nothing else (no `status`, no `selection`); own background `hsl(220 30% 100% / .1)`, own border `hsl(220 30% 100% / .34)` (both achromatic -- greyscale-invariant by construction, corroborating VALIDATION's criterion-17 claim), `pointer-events-none`, no `role`/`tabIndex`/handler. Positioned `right-[17px] top-[11px]` (top-right, claimed per Req 6). Verdict mark independently confirmed moved to `-left-2 top-1.5` (D-185-17), freeing the corner. `grep -rn "groundingFor\|GROUNDINGS\|Must cite its sources\|Flags uncited claims\|No sources needed" frontend/src` returns 0 hits -- word-badge fully deleted. |
| 7 | GOVERN-02/07 -- Binding vocabulary used; banned terms absent from user-visible workflow-tree strings | VERIFIED | `grep -rin "\bProven\b\|\bUngoverned\b\|\bUnchecked\b\|Not applicable\|N/A" frontend/src/components/workflows` (excluding tests) returns 0. Required terms ("Must prove it", "Free to think", "Nothing to prove here") are the `GROUNDING_*` constants imported and rendered by `GovernanceSection.tsx` (confirmed present, non-empty, used in JSX). |
| 8 | GOVERN-03 -- Arming a checkpoint changes neither `len(phases)` nor any `phase_index`; it is a validator on the step, not a new step | VERIFIED | `grounding.py:920-933` -- the armed checkpoint is a `ValidatorSpec(kind="action_risk_approval", timing="pre", ...)` appended to the SAME phase's `validators` list; `effective_phase` never adds a phase to `definition.phases`. `canvasModel.ts` has no code path that turns an armed flag into a node -- confirmed via source read; node count is driven only by `phases`. |
| 9 | GOVERN-03 -- The action-risk gate fails closed: with the checkpoint set and no answer, the run never advances; unset behaviour is byte-identical to today | VERIFIED | `backend/tests/unit/test_185_engine_attachment.py::test_criterion_19_unanswered_armed_gate_does_not_advance_the_run` (explicitly named after SPEC criterion 19) -- mocks `subscribe_for_response` to return `None` for an armed phase and asserts the outcome is `fail_run`, NOT `None` (which on a pre-gate means "run the body"), and that zero approval receipts are written. `harness_engine.py:1017` sets `timeout_seconds = None` (never a float) specifically when `is_action_risk`, and `ask_user_service.subscribe_for_response` docstring + `asyncio.wait_for(coro, timeout=None)` confirm this is a genuine indefinite wait, not a very-long float. The unarmed control path (`test_ask_user_unanswered_expiry_fails`) is untouched and still passes, confirming criterion 20 (unset byte-identical). All re-run fresh: 131/131 backend tests pass. |
| 10 | GOVERN-03 -- The armed checkpoint actually PARKS a run (not crashes it); migration 114 is additive-only, applied to the live DB, and the two-layer registration (Python allow-list + Postgres CHECK) is now equal | VERIFIED (independently re-checked against the live DB, not just SUMMARY narrative) | `supabase/migrations/114_harness_audit_action_risk_pending.sql` DROP/ADD-CONSTRAINT, adds exactly one literal (`action_risk_pending`), no other schema object. **Live DB read via `venv/Scripts/python` + `psycopg2` against `127.0.0.1:54322`, run fresh for this verification**: `pg_get_constraintdef` on `harness_audit_event_type_check` returns **23 literals including `action_risk_pending`** -- confirming the migration IS applied (185-13-SUMMARY.md itself only proves Tasks 1-2 authored-not-applied; I independently confirmed Task 3's live-DB effect). `backend/app/db/workflows.py:64-90` `_AUDIT_EVENT_TYPES` frozenset independently counted at **23 members** (9 + 7 + 6 + 1), matching the DB set exactly. `test_audit_event_registration.py` (part of the fresh 131-test run) passes. The SPEC/ROADMAP/VALIDATION amendment of the original zero-migration promise is recorded in six places with the superseded wording struck through, not deleted -- confirmed present in `185-SPEC.md`. |
| 11 | D-14 -- The Deep (non-harness) chat path stays byte-identical | VERIFIED | Re-ran the fence fresh at current HEAD (not trusting the `185-11`-dated table): `git diff --stat 59c32a06..HEAD -- backend/app/services/agent_loop.py backend/app/services/tool_dispatcher.py backend/app/services/openai_service.py backend/app/services/anthropic_service.py` returns **0 files** at present HEAD. `backend/app/services/harness/phase_types.py` DOES now show a diff (94 ins / 2 del) because `185-12`/`185-13` landed after the `185-11` fence reading -- inspected the diff directly: it only adds `_citation_instruction()` (BUG-260730-01 fix) to `_exec_llm_agent`/`_exec_llm_batch_agents`, returns `""` when no gate is attached (byte-identical for ungoverned phases), and never touches `_exec_llm_human_input` -- so criterion 20's byte-identical claim for the ask_user disposition executor is unaffected. This is a legitimate, in-scope, additive change, not a Deep-path or D-14 regression. |
| 12 | SC#10 -- Cross-provider UAT proves graded strictness holds across the provider roster; multi-tool/parallel-thread/long-message/negative axes covered | VERIFIED (operator-executed, evidence re-read, not re-run) | `185-VALIDATION.md`'s SC#10 scoreboard cites concrete, falsifiable artifacts per row (workflow_run ids, `harness_audit` receipts, judge verdicts, byte counts) rather than bare claims -- e.g. the Google row names run `ced8005d-24b9-413b-8edc-56beb8743298` and an independent cross-provider judge verdict text; the parallel-thread row names the specific blocker it hit (BUG-260731-02) and the fix that unblocked it (migration 114, independently confirmed applied above). This is qualitatively different from an unverifiable narrative claim -- it is itself evidence-bearing. Not re-executed live in this pass (would require live LLM calls against 9 providers); accepted on the strength of its own internal evidence and cross-checked against the code paths (citation harvesting is provider-independent per the dispatcher, confirmed by reading `grounding.py`'s reliance on `ToolResult`-harvested citations rather than a provider-specific field). |

**Score:** 12/12 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | The corner seal survives a live run (idle -> running -> needs-you -> failed), watched on screen | Phase 188 | The canvas carries no run status in this phase. Confirmed independently: `grep -n status canvasModel.ts` returns nothing; `PhaseNode.tsx:183` states `status`, `technicalLine` and `stepNumber` are "deliberately NOT passed"; `PhaseNodeCard.tsx`'s own docblock names 185/188/189 as "ADD DATA, NOT LAYOUT" consumers of the `status?: NodeRunStatus` extensibility seam. There is no run-state transition to watch yet -- scoring this PASS would score a surface Phase 188 has not shipped; scoring it FAIL would blame 185 for 188's absence. The invariant is held structurally in the meantime by a positive-controlled props fence in `PhaseNodeCard.test.tsx` (re-confirmed present and passing in this verification's fresh 793-test frontend run) that asserts the seal's markup block never names a run-state prop, with a planted regression control that turns the fence red. Re-open trigger recorded in VALIDATION.md: the first commit that passes `status` into `PhaseNodeCard` must re-drive this row. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/harness/grounding.py` | KB_TOOLS detection, one-way lock, `effective_phase` synthesis | VERIFIED | 954 lines; detection + synthesis both present and read directly; wired into `harness_engine.py` at the `spec_by_slug` seam |
| `backend/app/models/harness.py` | Additive `grounding_escalated`/`action_risk_armed` fields | VERIFIED | Both present, `bool = False` defaults, on `PhaseSpec` |
| `supabase/migrations/114_harness_audit_action_risk_pending.sql` | One additive CHECK literal | VERIFIED | Authored correctly AND confirmed applied to the live local DB (23-literal CHECK read directly via psycopg2) |
| `backend/app/db/workflows.py` (`_AUDIT_EVENT_TYPES`) | 23-member frozenset matching the SQL CHECK | VERIFIED | Counted directly: 23 members, `action_risk_pending` present |
| `backend/app/services/harness_engine.py` | `action_risk_pending` emit site + fail-closed `subscribe_for_response(None)` | VERIFIED | Lines 697-739, 983-1114 read directly; wired to `effective_phase` |
| `frontend/src/components/workflows/GovernanceSection.tsx` | Two-position dial, refusal-as-DOM-text, arm switch | VERIFIED | 321 lines, read in full; matches spec requirements 5/8/9 |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | Corner seal reading only `grounded`, verdict mark moved left | VERIFIED | Read in full; seal block is `grounded`-only, no run-state coupling |
| `frontend/src/components/workflows/FlowEdge.tsx` | Detour edge; ordinary edge delegates to library defaults | VERIFIED | `armed === undefined` branch calls the library's own `getBezierPath` + `BaseEdge`, imported from `@xyflow/react` directly (not reimplemented) |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | Mount point only, governance logic in its own file | VERIFIED | Re-ran the fence fresh at HEAD: 29 ins / 6 del (vs. 23/6 recorded at the `185-11` reading -- the delta is additional docblock/type-decl lines added by later plans, not render-body growth); the actual JSX mount is still ~4 lines (`{rails && <GovernanceSection ... />}` + one destructured prop), matching criterion 21 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `harness_engine.py` (`spec_by_slug`) | `grounding.effective_phase` | direct import + call at line 1287-1290 | WIRED | Confirmed at the actual run seam, not just existence of the function |
| `effective_phase` (armed) | `_resolve_failure_with_ask_user` | `pre` gate failure routing (`harness_engine.py:695-739`) | WIRED | `_is_action_risk_finding` predicate correctly distinguishes an armed pause from a real gate failure before emitting `action_risk_pending` vs `gate_failed` |
| `_resolve_failure_with_ask_user` (armed) | `ask_user_service.subscribe_for_response` | `timeout_seconds=None` passthrough | WIRED | Confirmed indefinite wait, not a long float; criterion-19 test passes |
| `action_risk_pending` emit site | `_AUDIT_EVENT_TYPES` allow-list + Postgres CHECK | `write_audit()` | WIRED | Both layers confirmed to contain the literal; live DB read confirms application |
| `GovernanceSection.tsx` | `PhaseFormPanel.tsx` | mount point (`{rails && <GovernanceSection .../>}`) | WIRED | Confirmed via direct source read |
| `PhaseNodeCard.tsx` seal | `grounded` prop | conditional render | WIRED | Confirmed the block reads `grounded` exclusively, no other prop |
| `FlowEdge.tsx` | `@xyflow/react` (`getBezierPath`, `BaseEdge`) | direct import | WIRED | Confirmed imported from the library, not a local reimplementation |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `PhaseNodeCard` seal | `grounded` | derived by caller from `phaseVocabulary.groundingCauseOf` / `GovernanceSection`'s render-time detection off `available_tools ∩ kbTools` | Yes -- a real intersection over server-supplied `kbTools`, not a hardcoded constant | FLOWING |
| `harness_engine` citations gate | `grounding_cause(phase) == "detected"` | `PhaseSpec.config.available_tools` (author-set) intersected with the module-constant `KB_TOOLS` | Yes -- runs against the actual parsed definition at every run (fresh kickoff, resume, publish golden run) | FLOWING |
| `action_risk_pending` audit row | `phase.slug`, `timing` | `write_audit()` call site inside the real pre-gate branch | Yes -- confirmed via live DB read that the CHECK accepts it and (per VALIDATION's G-4 #3) a real run produced this row | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend governance suite (fresh run, not trusting prior SUMMARY claims) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_185_detection.py tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py tests/unit/test_validator_kinds.py tests/unit/test_audit_event_registration.py tests/unit/test_harness_models.py -q` | 131 passed, 0 failed | PASS |
| Frontend governance suite (fresh run) | `cd frontend && npx vitest run src/components/workflows/GovernanceSection.test.tsx src/components/workflows/PhaseNodeCard.test.tsx src/components/workflows/WorkflowCanvas.test.tsx src/components/workflows/FlowEdge.test.tsx src/components/workflows/governanceVocabulary.test.ts src/components/workflows/canvasModel.roundtrip.test.ts src/components/workflows/canvasModel.purity.test.ts` | 793 passed, 0 failed (7 files) | PASS |
| Live DB migration-114 application state | `psycopg2` read of `pg_get_constraintdef` on `harness_audit_event_type_check` against `127.0.0.1:54322` | 23 literals, `action_risk_pending` present | PASS |
| Full frontend workflow-suite count gate (fresh run, not the recorded flaky 34-40) | `node scripts/vitest-count-gate.cjs` | 1658 total, 0 failing, 16/16 pinned files present, no count-decrease | PASS (better than the recorded posture -- the churn described in VALIDATION.md's "Count-gate posture" section did not reproduce on this read; consistent with it being documented flaky rot, not a regression) |
| Retired-badge / banned-vocabulary greps (fresh run) | `grep -rn "groundingFor\|GROUNDINGS\|Must cite its sources\|Flags uncited claims\|No sources needed" frontend/src`; `grep -rin "\bProven\b\|\bUngoverned\b\|\bUnchecked\b\|Not applicable\|N/A" frontend/src/components/workflows` (excl. tests) | 0 hits both | PASS |
| D-14 Deep-path fence (fresh, current HEAD, not the stale 185-11 table) | `git diff --stat 59c32a06..HEAD -- backend/app/services/agent_loop.py .../tool_dispatcher.py .../openai_service.py .../anthropic_service.py` | 0 files | PASS |
| Debt-marker sweep over every file this phase touched | `git diff --name-only 59c32a06..HEAD` (51 files) grepped for `TBD\|FIXME\|XXX` | 0 hits | PASS |

### Probe Execution

Not applicable -- this phase is not a migration/tooling phase with `scripts/*/tests/probe-*.sh` conventions; no such probes are declared in PLAN/SUMMARY files for 185. SKIPPED (no runnable probe entry points beyond the pytest/vitest suites already exercised above).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| GOVERN-01 | 185-02, 185-03, 185-06, 185-07, 185-08, 185-11, 185-12 | Grounding mode auto-attaches `citations_required` coverage gate on detected steps; not author-loosenable-away; Deep byte-identical | SATISFIED | Truths 1-5, 11 above |
| GOVERN-02 | 185-01, 185-08, 185-09, 185-10, 185-11 | Canvas visibly marks governance state via shape, graded rails | SATISFIED | Truths 6-7 above |
| GOVERN-03 | 185-02, 185-03, 185-04, 185-05, 185-09, 185-10, 185-11, 185-13 | Action-risk checkpoint; fail-closed; built on `llm_human_input` substrate | SATISFIED | Truths 8-10 above |

No orphaned requirements found -- `.planning/REQUIREMENTS.md` maps only GOVERN-01/02/03 to Phase 185, all three covered across the 13 plans' `requirements:` frontmatter, and all three are marked `Complete`. (RUNVIZ-03, added to Phase 188 as a result of 185's UAT, is correctly NOT claimed by any 185 plan.)

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` debt markers in any of the 51 files this phase touched. No placeholder returns, empty handlers, or hardcoded-empty stubs found in the files read directly (`grounding.py`, `harness_engine.py`, `phase_types.py`, `ask_user_service.py`, `GovernanceSection.tsx`, `PhaseNodeCard.tsx`, `FlowEdge.tsx`, `PhaseFormPanel.tsx`).

### Human Verification Required

None outstanding. This phase's own human-verification checkpoint (task `11-3`, `checkpoint:human-verify`, `gate="blocking"`) was already executed via Chrome MCP against a live browser session and is fully dispositioned in `185-VALIDATION.md` with concrete, falsifiable evidence (DOM measurements, workflow_run ids, `harness_audit` receipts) rather than narrative claims -- "Approval: GRANTED 2026-07-31". Re-litigating already-executed, evidence-backed operator UAT here would not add information; instead, this verification independently re-derived the underlying code claims (see Method above) and found them consistent with what VALIDATION.md reports.

### Gaps Summary

No gaps. All three requirement IDs (GOVERN-01, GOVERN-02, GOVERN-03) are independently confirmed in the codebase, not merely claimed in SUMMARY.md files:

- The grounding detection, one-way lock, and run-time gate-attachment (append-never-substitute, D-185-05) are real, wired at the actual engine run seam, and covered by a criterion-named unit test.
- The canvas governance seal is genuinely decoupled from run state (verified by direct source read, not just trusting the props-fence claim) and spends no colour (both carrier colours are achromatic white-alpha).
- The action-risk checkpoint's fail-closed behavior is real: `subscribe_for_response(timeout_seconds=None)` is a genuine indefinite `asyncio.wait_for`, not a long float, and is covered by `test_criterion_19_unanswered_armed_gate_does_not_advance_the_run`.
- The three explicitly-flagged "deliberate decisions vs. gaps" in the verification brief were independently checked against source and confirmed honest: (1) the criterion-2 migration amendment is additive-only and I confirmed via a fresh, direct DB read that it is actually applied to the live database (not merely authored); (2) the G-4 #2 deferral to Phase 188 is structurally justified -- the canvas genuinely carries no run-status prop anywhere in this codebase yet; (3) the D-185-18 downgrade from visual-diff to proof-by-construction is sound -- `FlowEdge.tsx`'s `armed === undefined` branch calls the library's own `getBezierPath`/`BaseEdge` from `@xyflow/react`, not a local reimplementation.
- BUG-260730-02 (the emit/`render_template` marker-format gap) is correctly out of scope for 185 and was not treated as a gap here.

One deferred item is carried forward (the seal-survives-a-live-run visual scenario, G-4 #2), matching Phase 188's stated scope -- not counted as a gap per Step 9b.

---

*Verified: 2026-07-31*
*Verifier: Claude (gsd-verifier)*
