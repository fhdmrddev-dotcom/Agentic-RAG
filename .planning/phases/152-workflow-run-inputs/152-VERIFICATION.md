---
phase: 152-workflow-run-inputs
verified: 2026-07-15T01:00:00Z
status: gaps_found
score: 6/7 must-haves verified (1 NEW BLOCKER surfaced during re-verification)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "CR-01/D-LOCK-05: delete cascade now cancels the LIVE producer identity (runs.run_id, the RUN_TASKS key) before the delete — confirmed by source read + git-history trace (threads.py:1223/2011 uuid ↔ workflows.py producer_id) + the route-level test_route_cascade_cancels_via_producer_identity spy assertion (producer_id != workflow_run_id, awaited once)."
    - "WR-01: is_global cascade with another user's runs now refused 409 (count_foreign_runs_on_global) before any cancel/delete side effect; preview docstring corrected."
    - "WR-04: doRun wraps upload+postMessage in try/catch, best-effort deleteThread on failure, re-throws so the verbatim 422 still surfaces (source-confirmed, no orphan-thread leak)."
    - "WR-05: RunModal's '' option truthfully labels 'Workflow default' for bound workflows (with folder name when visible, bare when invisible) and 'All documents' only for unbound workflows (source-confirmed at WorkflowsPage.tsx:1151-1155)."
  gaps_remaining: []
  regressions:
    - "The WR-03 gap-closure fix (152-06, scope.py A4 branch) itself removed the pre-existing 'override must be a member of the author's OWN project subtree' check and never restored it — despite the function's own docstring still asserting that bound holds ('Membership in the project subtree is necessary but NOT sufficient'). This is a NEW critical/blocker-grade regression, independently flagged by the fresh 152-REVIEW.md gap-closure re-review (findings.critical: 1, status: issues_found) and empirically reproduced by this verifier against the LIVE code (see Gap #1 below). It is unfixed as of the latest commit (838b2b70, which only adds the review doc — no follow-up fix commit exists)."
overrides: []
gaps:
  - truth: "Retrieval scope is bound server-side so a per-run override can never widen it beyond the workflow's own project (D-04/D-06/WFIN-02 narrow-only contract)"
    status: failed
    reason: "For a BOUND workflow that declares ANY per-phase folder_scope (the A4 composition path), resolve_run_scope_root's A4 branch (backend/app/services/harness/scope.py:153-168, introduced/rewritten by 152-06's WR-03 fix) checks ONLY that the override's OWN subtree intersects each declared phase folder_scope — it no longer checks that the override is a member of the AUTHOR's project subtree at all. Any owner-visible STRICT ANCESTOR of the bound project (e.g. a workspace root folder containing both the bound project and an unrelated sibling project) trivially satisfies the per-phase intersection (the project's own folder_scope descendants are still inside the ancestor's subtree), so it is ACCEPTED as the override and returned as the scope root. That root then flows straight into resolve_project_subtree() at the kickoff/resume/Continue call sites, so the run's actual retrieval subtree includes the unrelated sibling project — a same-account cross-project confidentiality leak. Confirmed three ways: (1) direct source read of scope.py:153-168 shows no `override not in project_subtree` check anywhere in the function despite the docstring's own claim at lines 132-138; (2) the fresh 152-REVIEW.md gap-closure re-review (reviewed 2026-07-14T20:19:42Z, AFTER commits cb7cb1e4..a052d30d) independently found and labeled this 'critical', with a concrete repro and a suggested fix — no commit since (git log tops out at 838b2b70, a docs-only commit) touches scope.py again; (3) this verifier reproduced it empirically by calling resolve_run_scope_root() directly against a P(project)/A1(phase scope)/P2(unrelated sibling) folder tree with override=R (ancestor of both P and P2) — result: root='R', resolved retrieval subtree=['R','P','A1','P2'], confirming P2 (the sibling project) leaks into the run's retrieval scope. The identical missing check is mirrored (and therefore also broken) in the frontend's overrideOptions filter (WorkflowsPage.tsx:1033-1050, from 152-07's WR-03 frontend mirror) — the UI actively OFFERS the escaping folder as a selectable option, so this is reachable through ordinary use, not just a theoretical backend path."
    artifacts:
      - path: "backend/app/services/harness/scope.py"
        issue: "A4 branch (lines 153-168) of resolve_run_scope_root drops the project-subtree membership check the pre-152-06 code enforced; only the per-phase intersection (WR-03's original fix) remains."
      - path: "frontend/src/pages/WorkflowsPage.tsx"
        issue: "overrideOptions (lines 1033-1050) mirrors the same incomplete check — filters only on the candidate's own subtree intersecting each phase folder_scope, never on candidate membership in the author's project subtree — so the escaping folder is offered in the Run modal's scope <select>."
    missing:
      - "Re-instate the 'override ⊆ author project subtree' membership check in scope.py's A4 branch ALONGSIDE the existing per-phase intersection check (152-REVIEW.md's own suggested fix block is ready to apply verbatim: resolve author project_subtree, drop override if not a member, THEN apply the existing per-phase intersection test)."
      - "Mirror the same author-subtree membership filter in WorkflowsPage.tsx's overrideOptions (intersect candidates with the already-computed author subtree before the per-phase filter)."
      - "A regression test with an override that is a STRICT ANCESTOR of the project root carrying an unrelated sibling subtree, asserting the override is dropped (this verifier's ad hoc repro, run outside the watched tree via the scratchpad, is not a committed test — a real backend + frontend test is still needed)."
human_verification:
  - test: "SC#10 4-axis cross-provider live UAT (folder-scope constraint)"
    expected: "A folder-scoped run retrieves ONLY from the chosen folder's subtree, identically across OpenAI / Anthropic / Google / OpenRouter"
    why_human: "Live LLM behavior under real provider routing; cannot be proven by grep/unit test (152-VALIDATION.md Manual-Only row 1). NOTE: this UAT row is also where the newly-confirmed scope-escape gap would most likely surface for a scoped workflow — recommend re-running it only AFTER Gap #1 is closed, or explicitly including a scoped-workflow-with-ancestor-override case in the UAT script."
  - test: "Multi-tool run: template upload + folder scope in one launch"
    expected: "Both inputs (template_input + folder override) take effect in the same run"
    why_human: "Requires a live run through the harness with real tool calls (152-VALIDATION.md row 2)"
  - test: "Parallel-thread: Thread A streaming while Thread B accepts a new prompt"
    expected: "No cross-contamination of template/folder inputs between threads"
    why_human: "Concurrency behavior not observable via static analysis (152-VALIDATION.md row 3)"
  - test: "Long-message: ≥50 prior messages OR ≥5KB user prompt in a folder-scoped run"
    expected: "Scope still constrains retrieval under context-window pressure"
    why_human: "Requires a live long-thread run (152-VALIDATION.md row 4)"
  - test: "Delete cascade destructive UAT: delete a workflow with runs + linked threads, including one truly in-flight run"
    expected: "Sheet counts match DB; threads survive as normal chats; KB untouched; no orphaned workflow_runs/workflow_phases; the in-flight run is ACTUALLY stopped (not just the DB rows removed)"
    why_human: "Destructive action requiring visual + DB confirmation. CR-01 is now code+test closed (route-level spy test proves the producer-identity cancel call), so this row should now pass — but it is still the correct final live confirmation before broad rollout."
  - test: "Template stored untrusted — never executed / never fed to the Jinja fill engine"
    expected: "kind='template_input', run_replace path (not docxtpl), no code execution even with SSTI-looking content"
    why_human: "Security provenance proof needs an actual upload + fill-path trace (152-VALIDATION.md row 6)"
---

# Phase 152: Workflow Run Inputs Verification Report (Gap-Closure Re-Verification)

**Phase Goal:** A user can feed a workflow run a file and choose its knowledge scope at launch from the Run modal, and can safely delete a workflow — all through one shared run-input channel wired into `create_workflow_run.inputs`.
**Verified:** 2026-07-15
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 152-05, 152-06, 152-07 against the prior 152-VERIFICATION.md BLOCKER + 4 Warnings)

## Goal Achievement

### Prior Gaps — Closure Status

| Prior finding | Plan | Status | Evidence |
|---|---|---|---|
| BLOCKER CR-01/D-LOCK-05 (cancel-first uses wrong run identity) | 152-05 | ✓ CLOSED | Source-confirmed: `workflows.py` LEFT JOINs `runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming'`, cancels via `r["producer_id"]` — verified this is the SAME uuid registered as the `RUN_TASKS` key (`threads.py:1223` generates `run_id`, `threads.py:2011` does `RUN_TASKS[run_id] = task`, and the `runs` row is INSERTed with that same `run_id` via `register_run_start`→`insert_run`). Route-level test `test_route_cascade_cancels_via_producer_identity` spies `_cancel_run_internals` and asserts `called_run_id == producer_run` and `!= wf_run` — PASSED live. |
| WR-01 (is_global cascade sweeps other users' runs) | 152-05 | ✓ CLOSED | `count_foreign_runs_on_global` + 409 refuse before any side effect, placed after `_owned_slug_or_404` and before cancel-first — source-confirmed at `workflows.py:509-524`. Route test `test_route_wr01_refuse_global_cross_user` PASSED. Preview docstring corrected (no more "no cross-user count leak" claim). |
| WR-03 (in-subtree override can empty a declared phase's folder_scope) | 152-06 | ⚠️ CLOSED-BUT-REGRESSED | The narrow empty-intersection case IS fixed and test-locked (`test_a4_two_phase_empty_intersection_dropped` PASSED). **However the fix itself deleted a DIFFERENT, more fundamental check** — see new Gap #1 below. The original WR-03 symptom is gone; a worse one replaced it. |
| WR-04 (orphan thread on failed launch) | 152-07 | ✓ CLOSED | `doRun` wraps upload+postMessage in try/catch, `deleteLaunchThread(thread.id).catch(()=>{})` then re-throws — source-confirmed at `ChatLayout.tsx:145-158`. |
| WR-05 (dishonest "All documents" label) | 152-07 | ✓ CLOSED | Source-confirmed at `WorkflowsPage.tsx:1151-1155`: bound → `Workflow default — 📁 {name}` or bare `Workflow default`; unbound → `All documents`. |
| IN-02 (no test backstop for the cancel-first identity) | 152-05 | ✓ CLOSED | 4 new route-level tests added (httpx ASGITransport + dependency_overrides against live PG), all green. |

### New Finding (surfaced during this re-verification, not present in the prior report)

**Gap #1 — WR-03's own gap-closure fix (152-06) removed the "override ⊆ author project subtree" bound and never restored it.** This was independently caught by the fresh gap-closure code review (`152-REVIEW.md`, `findings.critical: 1`, `status: issues_found`, written AFTER plans 05-07 landed) and is **still unfixed** — `git log` for `scope.py` tops out at `3f1de56d` (152-06's fix commit), and the only commit after it (`838b2b70`) is docs-only (adds the review report, does not act on it).

This verifier independently reproduced the defect by calling `resolve_run_scope_root()` directly against a minimal folder tree (P = bound project, A1 = P's declared phase `folder_scope`, P2 = an unrelated sibling project, R = their common owner-visible parent) with `override_folder_id = R`:

```
resolved scope root: R
resolved retrieval subtree: ['R', 'P', 'A1', 'P2']
SIBLING PROJECT P2 IN RETRIEVAL SUBTREE: True
```

Any owner-visible **ancestor** of the bound project passes the current A4 check (its subtree trivially contains the project's own declared `folder_scope` descendants), so it is accepted as a valid override — exposing the ENTIRE subtree under that ancestor, including unrelated sibling projects, as the run's actual retrieval scope. The identical missing check is mirrored in the frontend's `overrideOptions` filter, so the escaping folder is **actively offered as a selectable option** in the Run modal — this is reachable through ordinary use of the shipped UI, not a theoretical-only backend path.

This directly contradicts:
- The phase's own must-have (152-01 PLAN frontmatter, D-04): *"Retrieval scope is bound server-side so the model cannot widen it."*
- WFIN-02's own requirement text: *"reusing the Phase 098 server-side scope resolver so the model cannot widen scope."*
- The function's own docstring, which still claims (unchanged from before the regression): *"Membership in the project subtree is necessary but NOT sufficient."* — the code no longer implements the "necessary" half at all.

**This is not the same issue the gap-closure context description characterized as a pre-existing, non-blocking "product-intent" observation.** That characterization matches a narrower, pre-152 case (an UNSCOPED bound workflow, where the override channel has only ever been gated by D-05 owner-reachability — accurately verified as fine in the prior 152-VERIFICATION.md truth #2). What this verifier found and reproduced is different and more severe: a **regression newly introduced by 152-06's own WR-03 fix**, specifically in the composition-guard branch that only fires for workflows that DO declare per-phase `folder_scope` — exactly the feature 152-06 was supposed to be hardening. 152-REVIEW.md itself labels it `critical`, not informational, and provides a ready-to-apply fix.

**152-06/152-07's SUMMARY.md self-checks both claim "WR-03 backend closed" / "WR-03 (frontend) closed."** That claim is true only for the narrow empty-intersection symptom the plan's own test targets; it is false for the broader "override must stay inside the author's own project" contract the same branch is also responsible for — the SUMMARYs do not mention this, and no plan or test in 05-07 exercises an override that is a strict ancestor of the project root. This is exactly the class of gap this verification process exists to catch independent of SUMMARY claims.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (WFIN-01) Run modal upload → run input, stored `kind='template_input'`, size/MIME-allowlisted, never routed to Jinja | ✓ VERIFIED | Unchanged since the prior verification (152-03, untouched by 05-07); re-confirmed no regression — `resolve_template_source` Branch 2 still routes `template_input` to `run_replace`, never `docxtpl`. |
| 2 | (WFIN-02) Run modal → chosen KB folder (author default + per-run override), server-enforced, model/override cannot widen scope beyond the bound project, cross-provider uniform | ✗ FAILED | The D-05 owner-reachability gate still holds (an override that isn't owner-visible at all is still refused). But for a SCOPED bound workflow (any declared per-phase `folder_scope`), the A4 branch no longer enforces "override ⊆ author project subtree" — see Gap #1. An owner-visible ancestor of the bound project widens retrieval to unrelated sibling projects. This is the phase's own D-04/D-06 narrow-only promise, broken. |
| 3 | (WFIN-03) Delete a workflow with a safe cascade — cancel-first actually cancels the live engine, explicit disposition, confirmation, no orphaned runs/threads | ✓ VERIFIED | CR-01 (cancel-first wrong identity) is genuinely closed (see Closure Status table); WR-01 cross-user 409 closed; 17/17 backend tests green including the route-level producer-identity spy test. Two residual Warnings remain (not blockers): WR-02 (cap_paused producers aren't matched by the cancel-first LEFT JOIN, so a cap-paused run's `runs` row isn't transitioned — the `workflow_runs` row IS still terminalized, so the delete itself is not corrupted) and a TOCTOU race between the WR-01 guard and the actual cascade (narrow window, no shared transaction) — both flagged in 152-REVIEW.md as Warnings, not blockers. |
| 4 | The per-run folder override is honored identically at kickoff, resume, and Continue (Pitfall 5) | ✓ VERIFIED (mechanism); ⚠️ inherits Gap #1 | `resolve_run_scope_root` is still called at all 3 sites unchanged since the prior verification — the WIRING is correct, but because the function itself now returns a widened root in the Gap #1 scenario, all 3 call sites inherit the same scope-escape. |
| 5 | `threads.py` shrinks-not-grows; delete cascade lives in `api/workflows.py`, never `threads.py` (G-5/D-08) | ✓ VERIFIED | `git diff --name-only` across all of 152-05/06/07 never touches `threads.py` — confirmed via each plan's own commit range; the red line held through gap closure. |
| 6 | The victim-naming delete sheet + WR-04/WR-05 UX fixes are honest and test-locked | ✓ VERIFIED | 35/35 frontend tests green (`RunModal.test.tsx`, `ChatLayoutLaunch.test.tsx`, `WorkflowsPage.test.tsx`), `npx vite build` exit 0. |

**Score:** 5/6 truths fully verified; 1 FAILED (truth #2, folding in truth #4's inherited exposure) — this is a NEW finding at re-verification, not a repeat of any previously-closed gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/workflows.py` | producer-identity cancel-first + WR-01 409 guard | ✓ VERIFIED | `producer_id` cancel, `count_foreign_runs_on_global` 409 guard, both source- and test-confirmed. |
| `backend/app/db/workflows.py` | `count_foreign_runs_on_global` + corrected preview docstring | ✓ VERIFIED | Present, `$N`/`ANY($1::uuid[])` binding only, docstring honest. |
| `backend/tests/test_152_delete_cascade.py` | route-level cancel-first/404/in_flight/WR-01 tests | ✓ VERIFIED | 8/8 green (4 pre-existing helper tests + 4 new route tests). |
| `backend/app/services/harness/scope.py` | A4 per-phase intersection guard (WR-03) | ⚠️ STUB-EQUIVALENT (incomplete fix) | The declared narrow fix IS present and tested, but it replaced a broader necessary check instead of adding to it — functionally a regression on the composition guard's overall contract (Gap #1). |
| `backend/tests/test_152_folder_override.py` | P/A/B empty-intersection case | ✓ VERIFIED (as scoped) | 9/9 green; does not cover the strict-ancestor-override case (the actual gap). |
| `frontend/src/pages/WorkflowsPage.tsx` | truthful scope label (WR-05) + override filter mirror (WR-03) | ⚠️ PARTIAL | WR-05 fully verified; the WR-03 mirror inherits the same incomplete backend contract (Gap #1). |
| `frontend/src/components/layout/ChatLayout.tsx` | best-effort deleteThread on failed launch (WR-04) | ✓ VERIFIED | try/catch + fire-and-forget `deleteLaunchThread` + re-throw, source-confirmed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `api/workflows.py` (cascade route) | `run_lifecycle.py` | `_cancel_run_internals(run_id=r["producer_id"], ...)` | ✓ WIRED-CORRECTLY | Producer identity now matches the `RUN_TASKS` key (traced `threads.py:1223`→`2011` uuid identity). |
| `api/workflows.py` | `ask_user_service.publish_cancel_sentinel` + `db/workflows.finish_run` | called before the delete txn | ✓ WIRED | Both present, source-confirmed, ordered before `delete_published_workflow_cascade`. |
| `scope.py` (A4 branch) | `phase_types.py:326` per-phase narrowing | override-subtree ∩ each phase `folder_scope` | ⚠️ WIRED-BUT-INCOMPLETE | The intersection check works as designed for the empty-intersection case; it no longer gates on author-subtree membership, so it under-constrains the overall composition guard (Gap #1). |
| `WorkflowsPage.tsx` (`overrideOptions`) | same A4 contract, client mirror | candidate-subtree ∩ each phase `folder_scope` | ⚠️ WIRED-BUT-INCOMPLETE | Mirrors the same incomplete backend contract — offers the escaping folder in the `<select>`. |
| `ChatLayout.tsx` (`doRun`) | `lib/api.ts deleteThread` | best-effort cleanup in catch, re-throw | ✓ WIRED | Confirmed at `ChatLayout.tsx:145-158`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| Cancel-first loop | `inflight` rows (`producer_id`) | `LEFT JOIN runs r ON r.thread_id=wr.thread_id AND r.status='streaming'` | Yes — real query, real cancel target | ✓ FLOWING |
| `resolve_run_scope_root` result | `override` / `author_root` | client `run_inputs["folder_id"]` → owner-gated → A4 branch | Yes, but the A4 branch under-constrains it (Gap #1) | ⚠️ FLOWING-BUT-OVERWIDE (empirically reproduced: `['R','P','A1','P2']` includes the unrelated sibling `P2`) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend phase-152 gap-closure suites pass | `cd backend && venv/Scripts/python.exe -m pytest tests/test_152_delete_cascade.py tests/test_152_folder_override.py -q` | `17 passed` | ✓ PASS |
| Frontend phase-152 gap-closure suites pass | `cd frontend && npx vitest run RunModal.test.tsx ChatLayoutLaunch.test.tsx WorkflowsPage.test.tsx` | `3 files, 35 tests passed` | ✓ PASS |
| Frontend build is green | `cd frontend && npx vite build` | exit 0 (built in 3.71s; only pre-existing chunk-size/dynamic-import warnings) | ✓ PASS |
| Producer-identity cancel reaches the RUN_TASKS key | Traced `threads.py:1223` (`run_id = uuid4()`) → `register_run_start`→`insert_run` (writes that same `run_id` into `runs.run_id`, `status='streaming'`) → `threads.py:2011` (`RUN_TASKS[run_id]=task`) against `workflows.py`'s `LEFT JOIN runs r ON r.thread_id=wr.thread_id AND r.status='streaming'` → `r.run_id AS producer_id` | Identity confirmed to match end-to-end | ✓ PASS |
| A4 override composition guard enforces "override ⊆ author project subtree" | Ad hoc probe (scratchpad, not committed) calling `resolve_run_scope_root()` directly with a P/A1/P2/R folder tree, `override=R` (ancestor of bound project P, containing unrelated sibling P2) | `root='R'`, `subtree=['R','P','A1','P2']` — P2 leaked into the resolved retrieval scope | ✗ FAIL — confirms Gap #1 / matches 152-REVIEW.md's critical finding exactly |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in the 7 gap-closure-touched files | grep across `workflows.py`, `db/workflows.py`, `scope.py`, `WorkflowsPage.tsx`, `ChatLayout.tsx`, both `test_152_*.py` | 0 matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` declared or referenced by this phase's PLAN/SUMMARY/VALIDATION files. Step 7c: SKIPPED (no declared probes — this phase uses pytest/vitest).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| WFIN-01 | 152-03 | Template upload as run input, untrusted provenance | ✓ SATISFIED (code-level) | Unchanged, no regression from gap-closure work. Stays `Pending` in REQUIREMENTS.md per the documented 148-151 convention (closes at live UAT) — not a gap. |
| WFIN-02 | 152-01, 152-03, 152-06, 152-07 | Per-run folder-scope override, server-enforced, cross-provider, narrow-only | ✗ BLOCKED | The narrow-only guarantee this requirement explicitly names ("so the model cannot widen scope") is broken for any bound workflow with declared per-phase `folder_scope` — see Gap #1. This is a genuine, code-provable failure, not a live-UAT-pending item. |
| WFIN-03 | 152-02, 152-04, 152-05 | Safe delete cascade, no orphans | ✓ SATISFIED (code-level); live UAT pending | The prior BLOCKER (CR-01) is closed and test-backed. WR-01 closed. Two residual Warnings (WR-02 cap_paused gap, WR-01 TOCTOU) are real but non-blocking per 152-REVIEW.md's own severity classification. Live destructive-delete UAT (152-VALIDATION.md row 5) remains the final confirmation gate. |

No orphaned requirements — REQUIREMENTS.md §Workflow & File Inputs lists exactly WFIN-01/02/03 for Phase 152, and all three are declared in at least one plan's `requirements:` frontmatter field (including the gap-closure plans 05-07).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/harness/scope.py` | 153-168 | A4 branch drops the "override ⊆ author project subtree" necessary check the docstring at 132-138 still claims exists | 🛑 Blocker | Gap #1 — same-account cross-project retrieval scope escape for any workflow declaring per-phase `folder_scope`; reachable through the shipped UI. |
| `frontend/src/pages/WorkflowsPage.tsx` | 1033-1050 | `overrideOptions` mirrors the same incomplete backend check | 🛑 Blocker (same root cause as above) | The Run modal actively offers the escaping folder as a selectable scope override. |
| `backend/app/api/workflows.py` | 509-547, 575 | WR-01's `count_foreign_runs_on_global` guard is not atomic with the cancel/cascade (TOCTOU) | ⚠️ Warning | Per 152-REVIEW.md WR-01 (re-review numbering) — narrow window, not a blocker; a run started by another user in the gap between the check and the delete would still be silently swept. |
| `backend/app/api/workflows.py` | 537-547 | Cancel-first LEFT JOIN matches only `r.status = 'streaming'`, missing `cap_paused` producers | ⚠️ Warning | Per 152-REVIEW.md WR-02 (re-review numbering) — the `workflow_runs` row is still durably terminalized via `finish_run`, so the delete itself is not corrupted, but a cap-paused producer's own `runs` row is left un-transitioned, relying on the boot-time reconciler. |
| — | — | No TBD/FIXME/XXX/HACK/PLACEHOLDER debt markers in any of the 7 gap-closure-touched files | ℹ️ Info | Clean scan. |

### Human Verification Required

### 1. SC#10 4-axis cross-provider live UAT (folder-scope constraint)
**Test:** Launch the same folder-scoped workflow on OpenAI, Anthropic, Google, and OpenRouter; ask "what documents do you have?"
**Expected:** The answer is constrained to the chosen folder's subtree identically on all 4 providers.
**Why human:** Live LLM behavior under real provider routing — this is the phase's own MANDATORY UAT axis. **Recommend deferring this run until Gap #1 is closed**, or explicitly adding a scoped-workflow-with-ancestor-override case to the script so the UAT surfaces the same leak this verifier found in code.

### 2. Multi-tool run: template upload + folder scope together
**Test:** Upload a docx template AND set a folder override in one launch; run a workflow that fills the template using folder-scoped retrieval.
**Expected:** Both inputs take effect in the same run.
**Why human:** Requires a live run through the harness with real tool calls.

### 3. Parallel-thread isolation
**Test:** Start a folder-scoped run in Thread A while it streams; open the Run modal in Thread B and launch with different inputs.
**Expected:** No cross-contamination of template/folder inputs between threads.
**Why human:** Concurrency behavior not observable via static analysis.

### 4. Long-message scope enforcement
**Test:** On a thread with ≥50 prior messages or a ≥5KB prompt, launch a folder-scoped run.
**Expected:** Scope still constrains retrieval under context-window pressure.
**Why human:** Requires a live long-thread run.

### 5. Delete cascade destructive UAT — INCLUDING an actually in-flight run
**Test:** Delete a workflow that has completed runs + linked threads AND one truly in-flight (actively streaming) run.
**Expected:** Sheet counts match DB; threads survive as normal chats; KB untouched; no orphaned `workflow_runs`/`workflow_phases`; the in-flight run's stream actually stops.
**Why human:** Destructive action requiring visual + DB confirmation. CR-01 is now code+test closed, so this row is expected to pass — this is the final live confirmation, not a re-test of a known-broken path.

### 6. Template provenance / SSTI proof
**Test:** Upload a template containing Jinja/SSTI-looking content (e.g. `{{ 7*7 }}` or `{% ... %}`) as a workflow run input.
**Expected:** Stored with `kind='template_input'`; the fill path uses `run_replace`, never `docxtpl`/Jinja; no code execution, no template evaluation.
**Why human:** Security provenance proof needs an actual upload + fill-path trace through a live run.

### Gaps Summary

The three gap-closure plans (152-05, 152-06, 152-07) genuinely closed everything the prior 152-VERIFICATION.md flagged: the delete-cascade cancel-first BLOCKER (CR-01/D-LOCK-05) now cancels through the correct producer identity (traced end-to-end and test-backed at the route level), WR-01's cross-user blast radius is fail-closed with a 409, WR-04's orphan-thread leak is fixed, and WR-05's dishonest scope label is now truthful. All 17 backend + 35 frontend touched-surface tests pass live, and the frontend build is clean. This is genuine progress, not a re-hash of the same gap.

However, this re-verification is not a rubber stamp of "gaps closed = phase done." Independently reading the fresh 152-REVIEW.md gap-closure re-review (which reviewed the actual diff plans 05-07 introduced, not just their target gaps) surfaced a **new BLOCKER that this verifier independently reproduced**: the WR-03 fix in 152-06 corrected the reported symptom (an in-subtree override emptying a phase's intersection) by **replacing** the pre-existing "override must stay inside the author's own project" check rather than **adding to it**. The result is a same-account cross-project retrieval scope escape for any bound workflow that declares per-phase `folder_scope` — exactly the composition feature the fix was supposed to be hardening. This directly contradicts the phase's own D-04 must-have ("bound server-side so the model cannot widen it") and WFIN-02's own requirement text, and is reachable through the shipped Run modal UI (the frontend mirror offers the same escaping folder as a selectable option). It is confirmed present in the current HEAD (838b2b70) with no follow-up fix commit.

Per the gap-closure context note this verifier was given, this finding was pre-characterized as a minor, pre-existing "product-intent" observation not worth blocking on. Independent verification does not support that framing: the actual 152-REVIEW.md labels it `critical`/`issues_found`, it is a NEW regression introduced by this very gap-closure wave (not a 152-01-era design tradeoff), and it was reproduced deterministically in code (not merely theorized). It is reported here as a BLOCKER, with the review's own ready-to-apply fix cited in `missing:`.

Recommend a short follow-up gap-closure plan (152-08 or similar) that: (1) re-instates the author-project-subtree membership check in `scope.py`'s A4 branch alongside the existing per-phase intersection check, (2) mirrors the same fix in `WorkflowsPage.tsx`'s `overrideOptions`, and (3) adds a strict-ancestor-override regression test on both sides. The two residual Warnings from the fresh review (WR-01 TOCTOU, WR-02 cap_paused matching) are real but non-blocking and can ride along or be deferred at the operator's discretion — they do not gate re-verification the way Gap #1 does.

---

_Verified: 2026-07-15_
_Verifier: Claude (gsd-verifier)_
