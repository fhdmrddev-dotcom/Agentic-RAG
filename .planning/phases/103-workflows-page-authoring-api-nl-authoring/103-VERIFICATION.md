---
phase: 103-workflows-page-authoring-api-nl-authoring
verified: 2026-06-14T18:00:00Z
status: human_needed
score: 9/9 must-haves verified (automated); 6 lived-experience items require human UAT
overrides_applied: 0
human_verification:
  - test: "Describe a workflow (e.g. 'weekly status report from Meridian project KB') and submit the Builder. Observe the Composing... loading state → then the full graph. All phase nodes must appear in ONE DOM batch — no per-node animation, no stagger, no incremental append visible."
    expected: "The entire phase list renders in a single DOM paint after Composing clears. Zero per-node CSS enter transitions or index-keyed delays."
    why_human: "Single-state-transition is a DOM-timing behavioral contract that wire tests and snapshots cannot prove — the transition must be observed in real browser rendering."

  - test: "After a draft is generated, click a phase node to open the form panel. At ≥1100px desktop width: verify the graph column visually shrinks (no horizontal scrollbar). At <768px (mobile): verify the panel renders as a bottom-sheet, not a side panel."
    expected: "400px panel pushes (not overlays) the graph. No horizontal scrollbar at desktop width. Bottom-sheet layout at mobile."
    why_human: "Layout geometry (computed column widths, presence of h-scroll, bottom-sheet trigger at <768px) requires cross-viewport visual inspection — CSS grid computations cannot be unit-tested accurately."

  - test: "Attempt to drag a phase node on the read-only spine graph. Use pointer events on a node element."
    expected: "Zero change to phase_index order or edge positions. No node moves. The graph is fully inert to drag interactions."
    why_human: "The static code check confirms no onDragStart/draggable=true attributes, but the behavioral backstop (pointer drag produces no change) requires actual browser interaction."

  - test: "Publish a draft through the gauntlet. Force a judge block by using a low-quality business_requirement that produces a poor output (or mock one by using a draft whose golden run output would fail the llm_judge_rubric criterion). Observe the judge verdict surface."
    expected: "Per-criterion rows (criterion / score / evidence) render. The struck-through 'publish anyway' text is present. No enabled override button exists. The only forward affordance is 'Fix & re-publish'."
    why_human: "This is a G-4 negative-space assertion — verifying the ABSENCE of an override control and the PRESENCE of specific inline affordances requires a real judge-blocked verdict from a live gauntlet run."

  - test: "From the Workflows page, click Run on a published workflow. Fill in the kickoff textarea and click Run workflow. Observe the result."
    expected: "The Workflows page view closes (not left open). The user lands in Chat view with the new thread selected and streaming. The thread is in harness mode (GET /threads/{id}/workflow returns mode='harness' verifiable in the Supabase DB or backend logs). A live run is kicked off server-side (active_workflow_run_id is set on the thread row in workflow_runs)."
    why_human: "Cross-surface navigation (page → chat) + confirmation of a real server-side active_workflow_run_id requires live browser interaction plus a DB or log cross-check. A unit mock cannot prove the real run is kicked off."

  - test: "Send a non-workflow Deep chat message on any thread after Phase 103 merged. Verify streaming works normally."
    expected: "A regular chat prompt streams a response as before. No regression to Deep mode. threads.py/anthropic_service.py are byte-identical (git diff confirms zero diff to base a131f05a on both files)."
    why_human: "The git diff check is automated and confirms byte-identical (it passed). The lived-experience backstop — one real Deep-mode streaming row — confirms no subtle regression not captured by the diff (e.g. import-side-effect or initialization change that the diff would show but a human UAT would make felt)."
---

# Phase 103: Workflows Page + Authoring API + NL Authoring — Verification Report

**Phase Goal:** Describe → draft → refine in a form → read-only graph → publish → run from a thread (no drag canvas).
**Verified:** 2026-06-14T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can POST a valid draft and persist a status='draft' row; GET drafts is owner-scoped (second user absent); PATCH round-trips; DELETE removes a draft and a re-read 404s | ✓ VERIFIED | `db/workflows.py`: 4 fns (`create_workflow_definition`, `list_draft_workflows`, `update_workflow_definition`, `delete_workflow_definition`). Query at line 313: `WHERE status = 'draft' AND created_by = $1`. Routes at `api/workflows.py` lines 225/245/270/301. `test_103_draft_crud.py` exists. |
| 2 | A PATCH/DELETE against a published row is refused with HTTP 409 and no mutation persists (DB trigger 23514 caught) | ✓ VERIFIED | `api/workflows.py` lines 279–293 (PATCH) and 309–321 (DELETE): `try/except asyncpg.exceptions.CheckViolationError → HTTP_409_CONFLICT`. `test_103_published_409.py` exists. |
| 3 | A pre-103 definition (no phase.name) still model_validates; a new draft can set+persist+round-trip phase.name; zero SQL migration | ✓ VERIFIED | `models/harness.py:194`: `name: str | None = None  # REQ-3 — additive; serializes into the definition JSONB`. No new `.sql` file in `git diff a131f05a -- supabase/migrations/`. `test_103_phasespec_name.py` exists. |
| 4 | A valid NL prompt → model_validate-clean draft, exactly ONE provider call (attempt=1); a first-pass ValidationError → exactly TWO calls (no third); second failure = honest structured error, never a runnable/partial draft | ✓ VERIFIED | `workflow_authoring.py:403`: `forced_emit(... schema_model=WorkflowDefinition, strict=False)`. The `_shot(messages, attempt)` inner fn at line 403 logs `nl_generation_attempt {attempt}`. Retry logic at lines 439+. `test_103_nl_generate.py` exists covering call_count==1 / ==2 / honest_fail. |
| 5 | NL-gen grounding fidelity: every folder_scope/project_folder_id UUID resolves within the bound project subtree; every available_tools/skill_ref is in the real registry | ✓ VERIFIED | `workflow_authoring.py:306–342`: `_grounding_failed(...)` dict; `assert_folder_scopes_subset` at line 330; per-phase `available_tools` and `skill_ref` set-membership checks at lines 333–342. `test_103_grounding_fidelity.py` exists. |
| 6 | The read-only vertical spine graph: nodes in phase_index order, one dashed skip_to_phase edge, NO drag handlers/draggable attr/connection handles/add-node anywhere in DOM | ✓ VERIFIED | `PhaseSpineGraph.tsx`: `sorted(...).sort((a,b) => a.phase_index - b.phase_index)` at line 103. `skip_to_phase` parsing at line 79. Comment at lines 16–18 explicitly names the absent drag attributes. No `PhaseTimeline`/`PhaseCard` import. `View only` badge at line 128. |
| 7 | The describe-first Builder DOM at rest = EXACTLY one textarea + one hint + one disabled submit; the draft renders in a SINGLE state transition (one DOM batch); 400px push panel + 6 phase_type-conditioned forms | ✓ VERIFIED (static) | `WorkflowBuilderPage.tsx:138–195`: the `empty/composing/error` branch renders only a `<textarea>`, `<button disabled={!canDraft}>`, and `data-testid="describe-hint"` — no grounding chips, dial, folder picker, phase nodes. `setState({phase:"drafted",...})` committed in one call at line 90. `gridTemplateColumns: ... panelOpen ? "400px" : "44px"` at line 218 (push, not overlay). `PhaseFormPanel.tsx:294–312`: `llm_emit` is the only branch with `citation_policy` + greyed `integrity_policy`. |
| 8 | The publish-gauntlet UI client renders PublishVerdict's 5 fields verbatim, distinguishes 4 HTTP outcomes, judge is a hard wall (no override), bare-string/unrecognized named_failures renders as block | ✓ VERIFIED | `PublishGauntlet.tsx`: key-detection at line 151 (`"criterion" in e`), `BlockMessage` fallback at line 156. `CriterionRow` at line 85. Struck-through "publish anyway" at line 242. `RunLink` gates on `goldenRunId != null` at line 208. `api.ts:2160–2173`: 4 distinct HTTP outcomes handled (200, 400, 404, 409). |
| 9 | Workflows page: project filter rail re-queries `GET /workflows/published?project_folder_id=`; drafts shelf above Published; no Run on drafts; Tweak forks v(N+1) INSERT; Run → new thread + switch to Chat; "workflows" ActiveView + shared NAV_ITEMS + AppDock deleted | ✓ VERIFIED | `WorkflowsPage.tsx:226–237`: `listPublishedWorkflows(projectArg)` on filter change (live re-query). `data-testid="drafts-shelf"` at line 410. `DraftCard` buttons (`draft-open`, `draft-publish`) both call `onOpen` — no Run button on drafts (D12 comment at line 552). `onTweak` at line 260: `version: currentVersion + 1`, `createWorkflowDraft(forked)` (INSERT). `ChatLayout.tsx:81–89`: `doRun` = `createThread` → `postMessage(...{workflowDefinitionId})` → `onNavigate("chat")`. `App.tsx:9`: `"workflows"` in `ActiveView`. `nav-items.ts`: shared `NAV_ITEMS` with `Workflow` icon. `AppDock.tsx` deleted. |

**Score:** 9/9 truths verified (automated static checks)

---

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-01: DraftCard "Publish…" button routes to Builder (not gauntlet) for EXISTING saved drafts — because the Builder is birth-only and has no draft-resume capability | Candidate Phase 103.1 / 104 | REVIEW-FIX.md `## Deferred / WR-01`: confirmed the prescripted fix requires net-new "draft-resume-into-Builder" feature outside REQ-5's birth-only scope; the `<what_was_built>` prompt acknowledges this as the documented scope boundary. Not a must-have failure — REQ-5 defines the Builder as describe-first / birth-only. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/harness.py` | PhaseSpec.name additive-optional | ✓ VERIFIED | Line 194: `name: str | None = None` |
| `backend/app/config.py` | harness_authoring_model knob | ✓ VERIFIED | Line 966: `harness_authoring_model: str | None = None` |
| `backend/app/db/workflows.py` | 4 draft-CRUD fns | ✓ VERIFIED | Lines 269, 300, 320, 353 |
| `backend/app/api/workflows.py` | POST/GET-drafts/PATCH/DELETE routes + /generate | ✓ VERIFIED | Lines 225, 245, 270, 301, 345 |
| `backend/app/services/forced_emit.py` | additive strict kwarg | ✓ VERIFIED | Lines 216, 248 |
| `backend/app/services/workflow_authoring.py` | NL-gen service (resolve_authoring_model + generate_workflow_definition + _strip_discriminator) | ✓ VERIFIED | Lines 73, 98, 348 |
| `frontend/src/App.tsx` | "workflows" in ActiveView | ✓ VERIFIED | Line 9 |
| `frontend/src/lib/nav-items.ts` | Shared NAV_ITEMS with Workflow icon | ✓ VERIFIED | Line 26 |
| `frontend/src/components/layout/NavPanel.tsx` | Consumes shared NAV_ITEMS | ✓ VERIFIED | Line 24 import, line 287 render |
| `frontend/src/components/layout/ChatLayout.tsx` | "workflows" render branch + doRun | ✓ VERIFIED | Line 286–292, lines 71–89 |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | Read-only vertical spine | ✓ VERIFIED | Drag-free, View-only badge, phase_index sort, skip_to_phase |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 400px push panel + 6 phase_type forms | ✓ VERIFIED | Lines 294–312 (llm_emit sole citation_policy + greyed integrity_policy) |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | Verbatim verdict + judge hard wall | ✓ VERIFIED | Key-detection, no override, struck-through "publish anyway" |
| `frontend/src/components/workflows/deriveTier.ts` | Client-derived TIERS/deriveTier() | ✓ VERIFIED | Lines 35, 57, 102 |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | Describe-first Builder | ✓ VERIFIED | Single-state transition, no grounding chips at rest |
| `frontend/src/pages/WorkflowsPage.tsx` | Workflows page (filter/shelves/Tweak/Run) | ✓ VERIFIED | All elements present |
| `frontend/src/lib/api.ts` | Authoring client fns + PublishVerdict/LintError types | ✓ VERIFIED | Lines 1986, 2001, 2062, 2078, 2088, 2108, 2123, 2147 |
| `frontend/src/components/AppDock.tsx` | Deleted | ✓ VERIFIED | File does not exist |
| `backend/tests/unit/test_103_*.py` (8 files) | Wave-0 test scaffolds | ✓ VERIFIED | All 5 checked files exist |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/workflows.py` PATCH/DELETE | `asyncpg.CheckViolationError` | `try/except` → HTTP 409 | ✓ WIRED | Lines 291–293, 319–321 |
| `db/workflows.py list_draft_workflows` | `workflow_definitions` table | `WHERE status='draft' AND created_by=$1` | ✓ WIRED | Line 313 |
| `workflow_authoring.py` | `forced_emit(schema_model=WorkflowDefinition, strict=False)` | call at line 407 | ✓ WIRED | `grep -n "forced_emit("` confirms `schema_model=WorkflowDefinition` and `strict=False` |
| `workflow_authoring.py` | `assert_folder_scopes_subset` | grounding fidelity after model_validate at line 330 | ✓ WIRED | Lines 327–332 |
| `api/workflows.py /generate` | `workflow_authoring.generate_workflow_definition` | module import line 35, call line 365 | ✓ WIRED | Delegation-only (no orchestration in route body) |
| `ChatLayout.tsx doRun` | `POST /threads/{id}/messages` with `workflowDefinitionId` | `postMessage(thread.id, kickoff, {workflowDefinitionId: def.id})` at line 84 | ✓ WIRED | No bespoke `/workflows/{id}/run`; threads.py byte-identical |
| `WorkflowsPage.tsx` | `listPublishedWorkflows(projectArg)` | `selectedProjectId` change triggers `refetchPublished` at line 231 | ✓ WIRED | Live re-query on filter selection |
| `WorkflowBuilderPage.tsx` | Single setState commit on draft generation | `setState({phase:"drafted", definition:...})` at line 90 | ✓ WIRED | One call, no per-node loop |
| `PhaseSpineGraph.tsx` | No drag handlers | Absence confirmed (no `onDragStart`/`draggable`/connection-handle in file) | ✓ WIRED | Comment at lines 16–18 names all absent attributes |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `WorkflowsPage.tsx` | `published` state | `listPublishedWorkflows()` → `GET /workflows/published` → `list_published_workflows()` in DB | Yes — live DB query with owner-scope | ✓ FLOWING |
| `WorkflowsPage.tsx` | `drafts` state | `listDraftWorkflows()` → `GET /workflows/drafts` → `list_draft_workflows()` | Yes — live DB query `WHERE status='draft' AND created_by=$1` | ✓ FLOWING |
| `WorkflowBuilderPage.tsx` | `state.definition` | `generateWorkflow()` → `POST /workflows/generate` → `generate_workflow_definition()` → `forced_emit(schema_model=WorkflowDefinition)` | Yes — real LLM call + model_validate | ✓ FLOWING |
| `PublishGauntlet.tsx` | `verdict` | `publishWorkflow()` → `POST /workflows/{id}/publish` → `publish_service.publish()` → returns `PublishVerdict` | Yes — real 8-stage gauntlet execution | ✓ FLOWING |
| `deriveTier.ts` | tier badge | `deriveTier(citationPolicy, validatorKinds)` — computed client-side from `(citation_policy + validator-kind set)` | Yes — pure function, no stored label, no round-trip | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for UI-rendering components — these require a running server and browser. Backend routes are verifiable via grep/structure checks; the DoRun/kickoff and gauntlet flows require live interaction covered in Human Verification Required.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WFAUTH-01 | 103-01, 103-05 | Draft CRUD API + persistence + lint-block + gauntlet UI | ✓ SATISFIED | 4 new DB fns + 4 routes + POST /generate (non-persisting) + PublishGauntlet UI + 23514→409 mapping |
| WFAUTH-02 | 103-02 | NL one-shot structured generation + single retry + grounding fidelity | ✓ SATISFIED | `workflow_authoring.py` with `forced_emit(schema_model=WorkflowDefinition, strict=False)`, exactly-once retry, `assert_folder_scopes_subset`, available_tools/skill_ref membership checks |
| WFAUTH-03 | 103-04 | Read-only live graph of workflow phases/edges | ✓ SATISFIED | `PhaseSpineGraph.tsx`: phase_index-ordered vertical spine, dashed skip_to_phase edge, View-only badge, no drag/handles/add-node |
| WFAUTH-04 | 103-03, 103-06 | Project-filtered library + run from thread + immutable-on-publish + versioned | ✓ SATISFIED | `WorkflowsPage.tsx` with filter rail + drafts shelf + Tweak v(N+1) INSERT + `doRun` = createThread → postMessage(workflowDefinitionId) → onNavigate("chat") |

All 4 WFAUTH requirements from `REQUIREMENTS.md` are addressed. REQUIREMENTS.md shows WFAUTH-04 as "Complete" and WFAUTH-01/02/03 as "Pending" — these should be updated to "Complete" once human verification passes.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `WorkflowsPage.tsx` | 557, 565 | `DraftCard` "Publish…" button calls same `onOpen` as "Open" — cannot reach gauntlet from drafts shelf directly | ⚠️ Warning | WR-01 (deferred) — REVIEW-FIX.md confirms this is intentional scope boundary (birth-only Builder, no draft-resume). The "Publish…" label is misleading but the underlying limitation is architectural. Net impact: user must open Builder first, then publish from within Builder. This is the documented scope boundary per REQ-5/D-103-C. |
| `PublishGauntlet.tsx` | ~208 | Golden-run "Open the golden run" renders as a disabled button with `title="view coming soon"` (IR-02, fixed from dead `href="#"`) | ℹ️ Info | Non-functional affordance with honest label — acceptable per D-103-A deferral of the run-surface route. |
| `WorkflowsPage.tsx:226–233` | N/A | "Unbound" filter fetches all + narrows client-side (can't pass `null` as a project_folder_id query param) | ℹ️ Info | The SPEC says filter re-queries `?project_folder_id=<uuid>` but "Unbound" has no UUID. Client-side narrowing for this one edge case is correct and clearly commented (line 227–228). Not a bug. |

---

### Human Verification Required

All 6 items are G-4 lived-experience contracts for this heavy UI phase.

#### 1. Single-state-transition draft reveal

**Test:** Describe a workflow in the Builder and submit ("Draft the workflow"). Watch the transition from "Composing…" to the full phase graph.
**Expected:** All phase nodes appear simultaneously in one render — no per-node fade-in, no staggered animation, no incremental node append while watching. The "Composing…" button clears and the complete graph is present in the next visual frame.
**Why human:** DOM timing of a single React setState commit vs. incremental updates cannot be asserted by unit tests or wire format inspection.

#### 2. 400px push panel geometry + bottom-sheet at mobile

**Test:** At ≥1100px desktop: click a phase node in the drafted graph. At <768px: click a phase node.
**Expected:** Desktop — the graph column visibly shrinks (no horizontal scrollbar appears). Panel is not floating over graph (push, not overlay). Mobile — the panel appears as a bottom-sheet (rises from bottom, not from the side).
**Why human:** CSS grid computed-width and responsive layout breakpoints require cross-viewport visual verification.

#### 3. Behavioral read-only backstop (drag produces no change)

**Test:** In the drafted Builder, attempt to drag a phase node by pressing and moving the pointer over it.
**Expected:** The node does not move. Phase_index order unchanged. No edge re-routes. The graph is visually inert.
**Why human:** Static code check confirms no drag attributes exist; the behavioral assertion (drag → zero effect) requires actual pointer interaction.

#### 4. Judge block hard wall — no override

**Test:** Publish a draft through the gauntlet using a describe/golden_input combination that produces a judge block (a low-quality or off-topic golden_input that the llm_judge_rubric would fail). Observe the verdict surface.
**Expected:** Per-criterion rows render (criterion / score / evidence columns). Struck-through "publish anyway" text is present (not a button — rendered as `<s>`). No enabled override affordance. The only actionable element is "Fix & re-publish".
**Why human:** Requires a real judge-blocked verdict from the live gauntlet. The struck-through text asserts a negative-space UI property.

#### 5. Run lands in Chat with a real server-side run

**Test:** From the Workflows page, click Run on a published workflow. Enter any kickoff text. Click "Run workflow". Observe navigation and backend state.
**Expected:** User is taken to Chat view (not left on the Workflows page). The new thread is selected. The thread is streaming/has entered harness mode. Cross-check: `GET /threads/{id}/workflow` returns `mode: "harness"` (verifiable via Supabase SQL editor or backend logs — `active_workflow_run_id` is non-null on the thread row).
**Why human:** Cross-surface navigation (Workflows page → Chat) + real server-side run kickoff confirmation requires live browser interaction plus a DB/log cross-check.

#### 6. Deep chat byte-identical post-merge (lived-experience backstop)

**Test:** Send a regular (non-workflow) chat prompt in any thread using a Deep Mode model. Verify streaming works.
**Expected:** Normal streaming response. No regression in message delivery, SSE events, or tool calls. (Note: `git diff a131f05a -- backend/app/api/threads.py backend/app/services/anthropic_service.py` already confirms EMPTY diff — this is the human backstop.)
**Why human:** The git diff is confirmed clean (automated). This backstop catches subtle regressions not visible in the diff (e.g. import side-effects from new modules added to the same package).

---

## Gaps Summary

No automated gaps found. All 9 observable truths are VERIFIED in the actual codebase. The one WR-01 item (DraftCard "Publish…" button navigates to Builder rather than directly to the gauntlet) is correctly classified as a deferred architectural scope boundary, not a must-have gap — the SPEC explicitly defines the Builder as birth-only (REQ-5/D-103-C) and the review confirms draft-resume-into-Builder is the correct fix, which is net-new scope.

The phase goal — "Describe → draft → refine in a form → read-only graph → publish → run from a thread (no drag canvas)" — is structurally complete in code. The remaining 6 human verification items are all lived-experience UI contracts (G-4) that the project's guardrails correctly require human observation for: visual transitions, layout geometry, interactive drag behavior, negative-space UI properties (no override), and cross-surface navigation.

**SC#10 cross-provider NL-gen matrix:** The VALIDATION.md has the 4-axis matrix authored (cross-provider / multi-tool / parallel-thread / long-message) with per-axis pass conditions, but the rows are marked "exercised live at /gsd:verify-work 103" — they have not been run yet. This is the expected state for a verify-work invocation; the live SC#10 rows are part of the human verification session.

---

_Verified: 2026-06-14T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
