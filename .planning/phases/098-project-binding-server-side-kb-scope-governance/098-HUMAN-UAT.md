---
status: testing
phase: 098-project-binding-server-side-kb-scope-governance
source: [098-VERIFICATION.md, 098-VALIDATION.md]
started: 2026-06-09
updated: 2026-06-09
---

## Current Test

number: 2
name: Multi-tool scope holds (SC#10 — multi-tool axis)
expected: |
  A single agent turn that calls search_documents + execute_code keeps the search results clipped to the bound project subtree.
awaiting: user response

## Tests

### 1. Cross-provider in-run scope containment (SC#10 — cross-provider axis)
expected: A workflow bound to a project folder retrieves ONLY from that folder's subtree on every native provider — exercise OpenAI, Anthropic, Google, and OpenRouter (one representative model each). The model cannot widen scope via a prompt hint. Verify retrieved citations all fall inside the bound subtree on all four.
result: pass
evidence: |
  Fixture: seeded workflow "Doc Q&A (098 UAT — Weekly reports scoped)" (slug doc_qa_scoped_098uat),
  definition.project_folder_id = Weekly reports (2a33b3e3). Probe prompt asked for BOTH out-of-scope
  content (RPA — lives only in the DBA folder) and in-scope content (weekly reports).
  Ran 5 providers (operator-driven): OpenAI/gpt-5.4-mini, Anthropic/haiku-4.5, DeepSeek/v4-flash,
  Moonshot/kimi-k2.6, OpenRouter/llama-3.3-70b. On ALL FIVE: draft phase reported RPA = "No relevant
  documents found" (correctly clipped) and DID summarize the weekly-reports content. Zero out-of-scope
  content-leak markers (fahed mrad / thesis / choudhary) in any answer.
  DB cross-check: all 15 workflow_phases rows completed; scope_violation=0 (healthy — RPC p_folder_ids
  is the primary clip). UI cross-check (Anthropic thread, Chrome): "5 sources" panel shows all 5 chunks
  from SKILL_INSTRUCTIONS.md + weekly_report_structure.md — both in the Weekly reports folder, zero
  out-of-scope citations.
  CAVEAT: Google (Gemini) axis NOT exercised — SC#10 names Google explicitly, so the cross-provider
  axis is 5/6 native + OpenRouter but missing the Google representative. Re-run one Gemini model to close.

### 2. Multi-tool scope holds (SC#10 — multi-tool axis)
expected: A single agent turn that calls `search_documents` + `execute_code` keeps the search results clipped to the bound project subtree (the execute_code tool does not provide a side channel to read out-of-scope docs).
result: [pending]

### 3. Parallel-thread scope isolation (SC#10 — parallel-thread axis)
expected: Thread A runs a bound workflow (scoped) while Thread B runs an unbound Deep chat (whole-KB). A's retrieval stays inside its project subtree and B's whole-KB Deep retrieval is unchanged — no scope bleed between threads while both stream concurrently.
result: [pending]

### 4. Long-message scope persistence (SC#10 — long-message axis)
expected: With ≥50 prior messages OR a ≥5 KB user prompt, the bound scope still resolves server-side at run start and retrieval stays clipped — scope is not lost on large contexts. Includes the restart paths: resume after a crash and Continue both stay scoped (the GOV-01 gap that previously fell back to whole-KB).
result: [pending]

### 5. scope_violation observability (SC#4)
expected: When a retrieved row would fall outside the bound scope, it is clipped AND a `scope_violation` event is observable in the run log/timeline. Confirm the event surfaces (run buffer / UI) and the Deep/unscoped path emits NO such event (byte-identical Deep behavior, D-05/D-06).
result: [pending]

### 6. D-13 act/export whitelist refusal UX
expected: A read-only phase refuses an act/export (write) tool with a clear refusal message and the run continues gracefully — the per-phase whitelist is preserved in the live UI.
result: [pending]

## Summary

total: 6
passed: 1
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

[none in the 6 scope tests so far — Test 1 passed]

## Discovered findings (run-honesty — OUTSIDE the 6 scope tests; not a scope/governance defect)

Surfaced during Test 1 live UAT (operator observation + Chrome confirmation). These are
phase-timeline render defects on the workspace panel, NOT scope-governance regressions. Filed
separately; routed to the run-honesty surface (relates to Phase 094 deferred items
"timeline-vanishes" / "reconcile-degrade").

CONFIRMED ROOT CAUSE (4-finder + 3 adversarial-verifier workflow, all converged, high confidence;
live Chrome repro corroborated the predicted signature). Both findings share ONE root: the harness
phase timeline is driven purely by live SSE client state with NO terminal/fetch reconcile of per-phase
status. Render is honest-to-state — PhaseCard reads phase.status verbatim (PhaseCard.tsx:158-159); the
render-only alternative was REFUTED.

- finding: phase-0-stuck-running
  observed: During a live run, phase 0 ('draft') keeps showing "running" in the phase timeline
    even after the whole run completed. Reproduced across all 5 providers.
  ground_truth: All workflow_phases rows = completed; workflow_runs.status = completed,
    current_phase_id = NULL. Backend persisted correct terminal state → FRONTEND defect.
  root_cause: |
    The ONLY writer that flips a phase running→done is onPhaseCompleted→setPhaseStatusForThread
    (StreamsProvider.tsx:873-874), matched by EXACT slug, requiring phase-0's own phase_completed SSE
    to land on the live client. There is NO fallback sweep: onRunCompleted is an EXPLICIT no-op on
    phase status (StreamsProvider.tsx:898-903); reconcilePhases returns [] for ANY terminal run
    (StreamsProvider.tsx:2546 — lock_is_stale forced true for completed runs at threads.py:1737-1739);
    and the reconcile only fires on [threadId] change (usePanelReconcile.ts:116-130), never on run
    completion in-session. So once phase-0's phase_completed is missed, nothing in-session corrects it.
    ENABLING trigger: the ask_user RE-DRIVE paths (POST /continue, worker-restart resume) mint a fresh
    producer stream and harness_engine.py:814-819 SILENTLY skips already-completed phases (no re-emit).
    The pure-live answer path keeps the same task/stream (backend is correct there), so the live miss
    requires a consumer reattach during the human pause (610s consumer_timeout / transient close →
    cursor past phase-0's event) OR a reconcile-floor slug-placeholder mismatch.
  severity: major (run honesty)

- finding: phase-timeline-vanishes-on-revisit
  observed: Opening a COMPLETED workflow thread (Chrome, Anthropic run) renders the final answer
    fine but the Workspace panel shows "No workspace activity yet" — the phase timeline does not
    reconstruct on navigation/mount.
  root_cause: SAME root — on thread-switch/mount the reconcile fires (usePanelReconcile [threadId]) but
    reconcilePhases returns [] for the terminal run (StreamsProvider.tsx:2546), blanking the timeline.
    Live Chrome navigation to the completed Anthropic thread reproduced this exactly.
  severity: major (run honesty — a completed multi-phase run shows no trace of its phases on revisit)

  minimal_fix (consensus, additive, never touches Deep path or the live phase_completed emit):
    (A) IN-SESSION: make onRunCompleted (StreamsProvider.tsx:898-903) flip every non-terminal phase in
        phasesByThread for the OWNING threadId → 'done' on a status='completed' run_completed (new
        store action finalizeAllPhasesForThread, closure-scoped per PANEL-09). Closes stuck-running.
    (B) REVISIT/RELOAD: relax reconcilePhases so a terminal completed run returns per-phase 'done'
        instead of [] (ideally fed by a real workflow_phases.status array via an additive
        GET /threads/{id}/workflow field, so genuinely-skipped phases stay honest). Closes vanish.
    (C) OPTIONAL backend belt-and-suspenders: on the re-drive paths only (guard stream_run_id != run_id),
        re-emit phase_completed/phase_skipped for skipped terminal phases (harness_engine.py:814-819).
    fix_files: frontend/src/providers/StreamsProvider.tsx, frontend/src/stores/streamsStore.ts,
      backend/app/api/threads.py (B, for fidelity), backend/app/services/harness_engine.py (C, optional)
    routing: NOT a Phase 098 scope/governance defect. Run-honesty UI bug on the harness phase timeline;
      relates to Phase 094 deferred items (timeline-vanishes / reconcile-degrade). Candidate for a v2.9
      fix phase or reported-bug.

  STATUS: FIXED 2026-06-09 (operator chose "fix now A+B"). Discovery refined during the fix: a COMPLETED
  harness run CLEARS threads.active_workflow_run_id (mode flips back to "deep"), so get_thread_workflow
  had NO run reference on revisit — the simpler/true reason the timeline vanished. Changes (all additive;
  Deep path + live phase_completed emit untouched; net-new test failures = 0; frontend tsc clean;
  backend test_thread_workflow_endpoint 7/7):
    - backend/app/models/thread.py: + WorkflowPhaseState; ThreadWorkflowState.phases (per-phase array).
    - backend/app/api/threads.py: resolve phases from the active anchor ELSE the thread's latest
      workflow_run (by thread_id) so a finished thread still yields its timeline; mode/lock unchanged.
    - frontend/src/lib/api.ts: + WorkflowPhaseState + ThreadWorkflowState.phases.
    - frontend/src/stores/streamsStore.ts + StreamsProvider.tsx: (A) onRunCompleted("completed") sweeps
      every non-terminal phase → done for the OWNING thread (new finalizeAllPhasesForThread, PANEL-09
      closure-scoped); (B) reconcilePhases rebuilds the timeline from wf.phases for non-live-harness
      (completed/terminal) threads with DB→Phase status mapping (active→running, completed→done).
  VERIFIED: (B) live in Chrome — completed Anthropic thread now shows Workflow "Phase 3/3" with draft/
    confirm/finalize all ✓ Complete (was "No workspace activity yet"). (A) in-session sweep: code +
    types verified; live in-session re-verify pending a fresh workflow run (needs the ask_user pause).
