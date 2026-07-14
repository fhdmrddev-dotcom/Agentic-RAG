---
phase: 152-workflow-run-inputs
verified: 2026-07-14T23:00:00Z
status: gaps_found
score: 6/7 must-haves verified (1 BLOCKER)
overrides_applied: 0
gaps:
  - truth: "An in-flight run is cancelled first via the 064 zombie-heal path, never deleted out from under the engine (D-LOCK-05)"
    status: failed
    reason: "delete_workflow_cascade's cancel-first loop calls _cancel_run_internals(run_id=r['id'], ...) using workflow_runs.id. But for a run started via the normal kickoff path, the live producer task is registered in RUN_TASKS keyed by the PRODUCER runs.run_id (threads.py:2011), not the workflow_runs id. RUN_TASKS.get(<workflow_run_id>) misses, so the live task is never cancelled; the durable zombie-heal fallback also targets the wrong table/id (finalize_run_terminal on 'runs' WHERE run_id=<workflow_run_id> matches 0 rows). Confirmed by direct source read (backend/app/api/workflows.py:509-528, backend/app/api/threads.py:2011, backend/app/services/run_lifecycle.py) — this is CR-01 in 152-REVIEW.md, unresolved (no commit after 927975c3 touches it). Net effect: DELETE /{id}/cascade hard-deletes workflow_runs/workflow_phases out from under a still-running engine task, which keeps making LLM/tool calls, silently no-ops its own state writes, keeps streaming to the user, and can persist a ghost assistant message into a thread the user was just told is 'Deleted · recorded'. This defeats the locked decision D-LOCK-05 and makes the shipped amber banner copy ('It's cancelled safely first, then the workflow is deleted') false for the common case."
    artifacts:
      - path: "backend/app/api/workflows.py"
        issue: "Cancel-first loop at delete_workflow_cascade (~L505-528) passes the wrong run identity to _cancel_run_internals — cancels nothing for kickoff-started live runs."
    missing:
      - "Resolve the LIVE producer identity (JOIN runs ON thread_id + status='streaming', per 152-REVIEW.md CR-01's suggested fix) and cancel through that id, mirroring the admin.py Kill path."
      - "Durably terminalize the workflow_runs row (finish_run) and publish the ask_user cancel sentinel keyed by the WORKFLOW run id before the delete, to cover the paused/cross-worker cases."
      - "A live UAT / integration test that seeds an actually-streaming run and asserts the stream stops before/at delete (152's tests only exercise the db helpers, never an in-flight cancel — 152-REVIEW.md IN-02)."
human_verification:
  - test: "SC#10 4-axis cross-provider live UAT (folder-scope constraint) — OpenAI / Anthropic / Google / OpenRouter"
    expected: "A folder-scoped run retrieves ONLY from the chosen folder's subtree, identically across all 4 providers"
    why_human: "Live LLM behavior under real provider routing; cannot be proven by grep/unit test (152-VALIDATION.md Manual-Only row 1)"
  - test: "Multi-tool run: template upload + folder scope in one launch"
    expected: "Both inputs (template_input + folder override) take effect in the same run"
    why_human: "Requires a live run through the harness with real tool calls (152-VALIDATION.md row 2)"
  - test: "Parallel-thread: Thread A streaming while Thread B launches a new run"
    expected: "No cross-contamination of template/folder inputs between threads"
    why_human: "Concurrency behavior not observable via static analysis (152-VALIDATION.md row 3)"
  - test: "Long-message: ≥50 prior messages or ≥5KB prompt in a folder-scoped run"
    expected: "Scope still constrains retrieval under context-window pressure"
    why_human: "Requires a live long-thread run (152-VALIDATION.md row 4)"
  - test: "Delete cascade destructive UAT: delete a workflow with runs + linked threads, including one truly in-flight run"
    expected: "Sheet counts match DB; threads survive as normal chats; KB untouched; no orphaned workflow_runs/workflow_phases; the in-flight run is ACTUALLY stopped (not just the DB rows removed)"
    why_human: "Destructive action requiring visual + DB confirmation; this is also the row that would empirically surface CR-01 (152-VALIDATION.md row 5)"
  - test: "Template stored untrusted — never executed / never fed to the Jinja fill engine"
    expected: "kind='template_input', run_replace path (not docxtpl), no code execution even with SSTI-looking content"
    why_human: "Security provenance proof needs an actual upload + fill-path trace (152-VALIDATION.md row 6)"
---

# Phase 152: Workflow Run Inputs Verification Report

**Phase Goal:** A user can feed a workflow run a file and choose its knowledge scope at launch from the Run modal, and can safely delete a workflow — all through one shared run-input channel wired into `create_workflow_run.inputs`.
**Verified:** 2026-07-14
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC#1/WFIN-01) Run modal upload → run input, stored `kind='template_input'`, size/MIME-allowlisted, never routed to Jinja | ✓ VERIFIED | `WorkflowsPage.tsx` upload button stages a `File`; `ChatLayout.doRun` calls `uploadWorkspaceTemplate` (the existing `upload_template`/`validate_upload` route, unmodified — magic-byte + size gate + `kind='template_input'` stamp from Phase 100/151). No new fill-path code; `resolve_template_source` Branch 2 (pre-existing, unmodified) routes `template_input` to `run_replace`, never `docxtpl`. Provenance note renders verbatim: `Stored untrusted — never run as code, never fed to the fill engine.` (`WorkflowsPage.tsx:1210`). |
| 2 | (SC#2/WFIN-02) Run modal → chosen KB folder (author default + per-run override), server-enforced via Phase-098 resolver, model cannot widen, cross-provider uniform | ✓ VERIFIED (code-level); cross-provider proof is a pending live UAT | `resolve_run_scope_root()` (`backend/app/services/harness/scope.py:105`) implements owner-gated precedence (override > author default > thread fallback); wired at all 3 run-start sites — kickoff (`threads.py:1543`), resume (`harness_engine.py:1547`), Continue (`runs.py:931`). `MessageCreate.folder_id` optional UUID (`message.py:24`). Frontend `<select>` in `RunModal` (`WorkflowsPage.tsx:1120-1137`) sends `folder_id` only when it differs from the author default (D-06). 12/12 `test_152_folder_override.py` unit cases pass (override-owned, D-05 unowned-refused, D-06 absent, A4 composition). SC#10 4-axis cross-provider proof is explicitly a LIVE UAT not yet executed (152-VALIDATION.md: `wave_0_complete: false`, `Approval: pending`) — this is the documented 148-151 convention, not a code gap. |
| 3 | (SC#3/WFIN-03) Delete a workflow with a safe cascade, explicit disposition, confirmation, no orphaned runs/threads | ⚠️ PARTIAL — DB-level cascade verified; the "safe" cancel-first promise is FAILED | `delete_published_workflow_cascade` (`backend/app/db/workflows.py`) correctly hard-deletes definition+versions+runs in FK-safe order (runs first, satisfying `ON DELETE RESTRICT`), auto-cascades `workflow_phases`, auto-`SET NULL`s `threads.active_workflow_run_id` (threads kept). 4/4 live-PG `test_152_delete_cascade.py` tests pass, proving no DB orphans + owner-gate 404-collapse. **However** the cancel-first step (D-LOCK-05, a locked upstream decision + an explicit Plan-02 must-have truth) is broken for the common kickoff-started case — see Gap #1 below. |
| 4 | The per-run folder override is honored identically at kickoff, resume, and Continue (Pitfall 5) | ✓ VERIFIED | Source-confirmed: `resolve_run_scope_root` imported and called at `threads.py:1543`, `harness_engine.py:1547` (resume, reading `run["inputs"]`), and `runs.py:931` (Continue). Not a dead import — each call site feeds its result into the existing `resolve_project_subtree`. |
| 5 | `threads.py` shrinks-not-grows; the precedence lives in `scope.py`, not inline branches (G-5) | ✓ VERIFIED | `git diff --stat 205d9bcd..b1e6d18a -- backend/app/api/threads.py` → 18 insertions / 19 deletions (net −1 line); file is 2444 lines post-152 (was 2445). |
| 6 | The delete cascade endpoint lives in `api/workflows.py`, never `threads.py` (D-08/G-5 red line) | ✓ VERIFIED | `git diff --name-only 022a5509~1 b8d73267` (Plan-02 commit range) touches only `api/workflows.py`, `db/workflows.py`, `test_152_delete_cascade.py`. `threads.py` untouched. |
| 7 | The victim-naming delete sheet names exact server-sourced Removed/Kept counts, transitions in place with no optimistic vanish/undo, destructive weight only on Delete-forever | ✓ VERIFIED | `WorkflowsPage.tsx` — `getWorkflowDeletePreview` fetched on sheet open; exact copy `Delete this workflow?` / `Permanently removed` / `✎ Recorded with your name in the audit log.` present; card is removed only via `onDeleted()` re-fetch (no local filter). 37/37 frontend tests green (`RunModal.test.tsx` 7, `PublishedCardDelete.test.tsx` 7, `WorkflowsPage.test.tsx` 23). `▶ Run` / `Delete forever` are the only accent/destructive elements per source review. |

**Score:** 6/7 verified as fully passing; 1 explicitly FAILED (cancel-first, folded into truth #3's "safe cascade" claim).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/message.py` | `MessageCreate.folder_id: UUID \| None` | ✓ VERIFIED | Present at line 24; tested (`test_messagecreate_folder_id_optional`). |
| `backend/app/services/harness/scope.py` | `resolve_run_scope_root()` precedence + D-05 gate + A4 guard | ✓ VERIFIED | Present at line 105; matches documented precedence and owner-gate exactly. |
| `backend/app/api/threads.py` | kickoff persists `folder_id` + resolves via helper | ✓ VERIFIED | `resolve_run_scope_root` call at :1543; inline branch removed (net line shrink confirmed). |
| `backend/tests/test_152_folder_override.py` | override/D-05/D-06/A4 coverage | ✓ VERIFIED | 8 tests, all pass (ran live: 12 passed combined with delete-cascade file). |
| `backend/app/db/workflows.py` | `delete_published_workflow_cascade` + preview helper | ✓ VERIFIED | Both present; live-PG tested. |
| `backend/app/api/workflows.py` | distinct cascade DELETE + delete-preview GET + cancel-first | ⚠️ PARTIAL | Routes exist and are owner-gated/404-collapsing correctly, but the cancel-first call (L509-528) uses the wrong run identity — see Gap #1. |
| `backend/tests/test_152_delete_cascade.py` | FK-safe cascade, owner 404, cancel-first, preview counts | ⚠️ PARTIAL | 4/4 tests pass but — as 152-REVIEW.md IN-02 notes and I confirmed by reading the file — it tests ONLY the db helpers; no test exercises the route's cancel-first behavior or an actually-in-flight run, so the CR-01 defect had no test to catch it. |
| `frontend/src/pages/WorkflowsPage.tsx` | RunModal `<select>` + template upload + provenance note; PublishedCard ⋯-menu + delete Sheet | ✓ VERIFIED | All UI strings/controls found by direct grep + read (select, provenance note, ⋯-menu, sheet copy). |
| `frontend/src/components/layout/ChatLayout.tsx` | `doRun` sequencing createThread → upload → postMessage(folderId) | ✓ VERIFIED | Confirmed via 152-03-SUMMARY + code review (unchanged from claim); WR-04 (orphan thread on failed launch retry) is a real but non-blocking Warning, not a must-have. |
| `frontend/src/lib/api.ts` | `postMessage folderId`, `deleteWorkflowCascade`, `getWorkflowDeletePreview` | ✓ VERIFIED | grep confirms all three symbols present. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `threads.py` (kickoff) | `harness/scope.py` | `resolve_run_scope_root` call | ✓ WIRED | Confirmed at :1543. |
| `harness_engine.py` (resume) | `harness/scope.py` | `resolve_run_scope_root` call | ✓ WIRED | Confirmed at :1547, reads `run["inputs"]`. |
| `runs.py` (Continue) | `harness/scope.py` | `resolve_run_scope_root` call | ✓ WIRED | Confirmed at :931. |
| `WorkflowsPage.tsx` (RunModal) | `ChatLayout.tsx` | `onLaunch(def, kickoff, {templateFile, folderId})` | ✓ WIRED | Confirmed via 3-arg `onLaunch` contract + 37 passing frontend tests. |
| `ChatLayout.tsx` | `lib/api.ts` | `uploadWorkspaceTemplate` between createThread and postMessage | ✓ WIRED | Confirmed via SUMMARY + source read. |
| `api/workflows.py` (cascade route) | `run_lifecycle.py` | `_cancel_run_internals` cancel-first | ✗ WIRED-BUT-WRONG-IDENTITY | The call happens, but with `run_id=workflow_runs.id` instead of the producer `runs.run_id` that `RUN_TASKS` is actually keyed by (`threads.py:2011`) — the wiring exists syntactically but does not achieve the intended effect for the common case (CR-01). |
| `api/workflows.py` | `db/workflows.py` | `delete_published_workflow_cascade` call | ✓ WIRED | Confirmed at :531. |
| `WorkflowsPage.tsx` (delete sheet) | `lib/api.ts` | `getWorkflowDeletePreview` + `deleteWorkflowCascade` | ✓ WIRED | Confirmed via grep + 7 passing `PublishedCardDelete.test.tsx` cases. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| RunModal `<select>` | `folders` prop / `authorDefaultFolderId` | Passed down from `WorkflowsPage` (live folders fetch) | Yes | ✓ FLOWING |
| Delete-preview sheet | `preview.{versions,runs,threads,in_flight}` | `GET /workflows/{id}/delete-preview` → `delete_workflow_cascade_preview` → live `COUNT(*)` SQL against `workflow_runs`/`threads` | Yes | ✓ FLOWING (but see WR-01: counts aggregate across ALL users for `is_global` definitions, not just the owner's own runs — a real but non-must-have honesty gap, documented as a Warning) |
| Cancel-first loop | `inflight` rows | `pool.fetch(... wr.status IN ('active','paused','cap_paused'))` | Yes (real query) | ⚠️ QUERY REAL, ACTION INEFFECTIVE — the query correctly finds live rows, but the subsequent cancel call targets the wrong task registry key (CR-01), so the real data doesn't translate into a real cancel. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend phase 152 unit/integration suites pass | `venv/Scripts/python.exe -m pytest tests/test_152_folder_override.py tests/test_152_delete_cascade.py -q` | `12 passed` | ✓ PASS |
| Frontend phase 152 component suites pass | `npx vitest run RunModal.test.tsx PublishedCardDelete.test.tsx WorkflowsPage.test.tsx` | `3 files, 37 tests passed` | ✓ PASS |
| Frontend build is green | `npx vite build` | exit 0 (built in 6.86s) | ✓ PASS |
| `resolve_run_scope_root` wired at all 3 run-start sites (not dead import) | `grep -rn resolve_run_scope_root backend/app/api/threads.py backend/app/services/harness_engine.py backend/app/api/runs.py` + manual read of call sites | 1 real call site each, each feeding `resolve_project_subtree` | ✓ PASS |
| D-08/G-5 red line (delete cascade never touches threads.py) | `git diff --name-only 022a5509~1 b8d73267` | `threads.py` absent from the diff | ✓ PASS |
| CR-01 cancel-first identity mismatch | Direct read of `backend/app/api/workflows.py:509-528` + `backend/app/api/threads.py:2011` + `backend/app/services/run_lifecycle.py` | `_cancel_run_internals(run_id=r["id"], ...)` where `r["id"]` is `workflow_runs.id`; `RUN_TASKS` is keyed by the producer `run_id` set at `threads.py:2011` — confirmed mismatch, matches 152-REVIEW.md CR-01 exactly | ✗ FAIL (confirms the reviewer's finding; not fixed post-review) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` declared or referenced by this phase's PLAN/SUMMARY/VALIDATION files. Step 7c: SKIPPED (no declared probes — this phase uses pytest/vitest, not a probe harness).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| WFIN-01 | 152-03 | Template upload as run input, untrusted provenance | ✓ SATISFIED (code-level) | Upload button + sequencing + provenance note verified; backend reuse verified. REQUIREMENTS.md keeps it `Pending` by the documented 148-151 false-green-avoidance convention (closes at live UAT) — not a gap. |
| WFIN-02 | 152-01, 152-03 | Per-run folder-scope override, server-enforced, cross-provider | ✓ SATISFIED (code-level); cross-provider proof pending | Backend resolver + frontend `<select>` verified and tested; SC#10 live UAT still `pending` per 152-VALIDATION.md (expected, not a gap). |
| WFIN-03 | 152-02, 152-04 | Safe delete cascade, no orphans | ✗ PARTIALLY BLOCKED | DB cascade + UI are solid; the cancel-first sub-claim (D-LOCK-05, explicitly named in the requirement's own "safe cascade" framing and a Plan-02 must-have) is FAILED per CR-01. |

No orphaned requirements — REQUIREMENTS.md §Workflow & File Inputs lists exactly WFIN-01/02/03 for Phase 152, and all three are declared in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/workflows.py` | 509-528 | Cancel-first loop cancels by the wrong run identity | 🛑 Blocker | Defeats D-LOCK-05; see Gap #1 (CR-01) |
| `frontend/src/pages/WorkflowsPage.tsx` | 1041-1050, 1126, 989-992 | "All documents" option is dishonest for a bound workflow (sends `folderId: null` which resolves to the author default, not whole-KB) | ⚠️ Warning | UX honesty gap (152-REVIEW.md WR-05); does not violate the security truth (model still cannot widen scope) but misrepresents the run's actual scope to the user |
| `backend/app/db/workflows.py` / `api/workflows.py` | 474-477, 490-542 / 509-528 | Cascade on an `is_global` definition sweeps and cancels OTHER users' runs; preview counts aggregate cross-user with no signal | ⚠️ Warning | 152-REVIEW.md WR-01; today only seed-owner accounts can own `is_global` rows so blast radius is currently narrow, but the seam is live and undocumented in the sheet |
| `frontend/src/components/layout/ChatLayout.tsx` | 121-140 | Failed launch (422 upload / postMessage failure) leaks an orphan thread per retry | ⚠️ Warning | 152-REVIEW.md WR-04; UX/hygiene issue, not a security or data-integrity defect |
| `backend/app/services/harness/scope.py` | 150-157 | A4 guard checks "override ⊆ whole project subtree" but not "override intersects EACH declared phase's folder_scope" — an in-subtree override can still silently empty one phase's retrieval | ⚠️ Warning | 152-REVIEW.md WR-03; confirmed present in code as described |
| — | — | No TBD/FIXME/XXX/HACK/PLACEHOLDER debt markers found in any of the 10 touched core files | ℹ️ Info | Clean scan |

### Human Verification Required

### 1. SC#10 4-axis cross-provider live UAT (folder-scope constraint)
**Test:** Launch the same folder-scoped workflow on OpenAI, Anthropic, Google, and OpenRouter; ask "what documents do you have?"
**Expected:** The answer is constrained to the chosen folder's subtree identically on all 4 providers.
**Why human:** Live LLM behavior under real provider routing — this is the phase's own MANDATORY UAT axis (CLAUDE.md UAT scoreboard recipe); 152-VALIDATION.md shows it not yet executed (`wave_0_complete: false`, `Approval: pending`).

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
**Expected:** Sheet counts match DB; threads survive as normal chats; KB untouched; no orphaned `workflow_runs`/`workflow_phases`; the in-flight run's stream actually stops (does not keep producing tokens/messages after "Deleted · recorded").
**Why human:** Destructive action requiring visual + DB confirmation. **This is also the exact scenario that would empirically demonstrate Gap #1 (CR-01) — expect this row to reveal the live run continuing to stream/write after the delete confirms.**

### 6. Template provenance / SSTI proof
**Test:** Upload a template containing Jinja/SSTI-looking content (e.g. `{{ 7*7 }}` or `{% ... %}`) as a workflow run input.
**Expected:** Stored with `kind='template_input'`; the fill path uses `run_replace`, never `docxtpl`/Jinja; no code execution, no template evaluation.
**Why human:** Security provenance proof needs an actual upload + fill-path trace through a live run.

### Gaps Summary

Phase 152 is substantively built: all four plans' code artifacts exist, are wired end-to-end, and pass their scoped automated tests (12 backend + 37 frontend, both re-run live during this verification). The frontend build is green. The G-5/D-08 hot-file discipline (threads.py shrink, cascade endpoint kept out of threads.py) was independently confirmed via scoped git diffs, not just trusted from the SUMMARYs.

The one BLOCKER is CR-01 from the phase's own code review (152-REVIEW.md), confirmed still present by direct source inspection with no fix commit after the review landed: the delete cascade's cancel-first step cancels the wrong run identity for the common kickoff-started case, so `DELETE /{id}/cascade` can hard-delete `workflow_runs`/`workflow_phases` while the engine is still actively executing against them — LLM/tool calls keep firing, the SSE stream keeps reaching the user, and a ghost assistant message can land in a thread the user was just told was safely detached. This directly defeats the locked decision D-LOCK-05 ("never delete a live run out from under the engine") and makes the shipped amber-banner copy ("It's cancelled safely first...") false in the scenario it exists to describe. Per this phase's own review, no test — live or unit — currently exercises an actually-in-flight cancel, so this defect has no automated backstop; it would most likely surface during the mandatory SC#10 delete-cascade live UAT row.

Four Warnings (WR-01 cross-user blast radius on global definitions, WR-03 incomplete A4 per-phase guard, WR-04 orphan-thread-on-retry, WR-05 dishonest "All documents" label) are real and confirmed present in code, but none of them defeat a locked decision or a roadmap success criterion outright — they are quality/honesty gaps worth fixing before this ships broadly, not blockers to re-verification. They are documented here so the closure plan can address them alongside CR-01 if desired, but the BLOCKER gate is CR-01 alone.

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
