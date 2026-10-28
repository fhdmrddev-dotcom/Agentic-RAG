---
phase: 295-runs-that-don-t-dead-end
reviewed: 2026-10-21T01:27:12Z
depth: standard
base: 7fdf86e70
head: 796c869192a4c67f348c3aa4fbef24d5b25bc2a0
independent_review: self
files_reviewed: 43
files_reviewed_list:
  - backend/app/api/panel.py
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/api/workflow_run_evidence.py
  - backend/app/api/workflow_runs.py
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/models/thread.py
  - backend/app/services/harness/emit_cause.py
  - backend/app/services/harness/engine_ask.py
  - backend/app/services/harness/grounding.py
  - backend/app/services/harness/human_input.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness/reachability.py
  - backend/app/services/harness/run_handoff.py
  - backend/app/services/harness/run_read_wire.py
  - backend/app/services/harness/validator_kinds.py
  - backend/app/services/harness_engine.py
  - backend/app/services/run_evidence.py
  - backend/app/services/run_lifecycle.py
  - backend/app/services/run_producer.py
  - backend/app/services/run_reconciler.py
  - backend/app/services/scheduler_service.py
  - backend/app/services/template_asset_service.py
  - backend/app/services/workflow_kickoff.py
  - frontend/src/components/panel/AskFolderChoice.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/panel/enginePause.ts
  - frontend/src/components/workflows/RunEndReasonLine.tsx
  - frontend/src/components/workflows/RunEvidenceReport.tsx
  - frontend/src/components/workflows/RunSpine.tsx
  - frontend/src/components/workflows/StepEvidenceLine.tsx
  - frontend/src/components/workflows/evidenceView.ts
  - frontend/src/components/workflows/evidenceVocabulary.ts
  - frontend/src/components/workflows/verdictModel.ts
  - frontend/src/lib/api/runEvidence.ts
  - frontend/src/lib/api/threads.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/stores/askDraftStore.ts
  - frontend/src/types/index.ts
findings:
  critical: 1
  warning: 7
  info: 8
  total: 16
status: issues_found
---

# Phase 295: Code Review Report

**Reviewed:** 2026-10-21T01:27:12Z
**Depth:** standard (phase diff `7fdf86e70..796c86919`, plus the code each changed path calls)
**Files Reviewed:** 43
**Status:** issues_found

## Summary

I read every changed file's diff in full, plus the callers and callees each new path depends on:
`finish_run`, `pause_run`, `claim_run`, `find_resumable_runs`, `get_ask_user_response`, `mark_phase_active`, `complete_phase`/`fail_phase`/`cancel_active_phases`, `resolve_run_scope_root`, `fetch_visible_folders`, `run_task_sub_agent`, the human-input resume path, the answer route and its re-drive, the scheduler's run-now route, and the main.py reconciler schedule.

What holds up well:
- **Terminal writes.** Every new run end (`end_run`, `record_failed_end`, `record_stop`, `finish_golden_run`, `resume_with_terminalize`, `fail_unloadable_definition`, the reconciler sweep) goes through ONE guarded `UPDATE … WHERE status = ANY(…) RETURNING`, so only the winner writes words. I found no path where two writers both write a reason. I found none where the reconciler can finalise a run with a live producer either: it needs every phase row terminal, `updated_at` older than the 300 s lease, and `status='active'`. Phase rows are inserted up front as `pending`, so a live run always has a non-terminal row until its last phase ends. One thing to know: `reconcile_orphaned_runs` also runs **periodically** (`main.py:463-485`), not only at boot, so the lease guard is load-bearing on a live box. It holds.
- **The engine ask allow-list.** Both halves hold: the route's 422 refusal and the consume-time re-check (exact labels, offered folder ids from the stash, `continue_allowed`, `_locked_now`). A forged label, a forged index, an unoffered folder and a forged Continue on a locked step are all refused or left paused. Folders are bounded by the owner's visibility through the same rule a run-start override already obeys (D-39).
- **RLS and blocking I/O.** No new user-JWT UPDATE on `runs`/`workflow_runs`. The new reads go through the owner-scoped JWT client or a pool behind an owner check. Every supabase-py call is wrapped in `aexec`.

The serious problem is one level up from the allow-list. **An answer is never checked against the question the run is waiting on now** (CR-01). A stale or replayed answer still re-drives a paused run. On an engine ask, that re-runs the step and throws the answer away. On a human step, the human step takes the other question's answer as its own. The second most important finding is the known item (d), which I assess under WR-01: a provider outage is offered as "found nothing", Continue keeps the raw provider error as a completed deliverable, and from there it can reach an external recipient.

Known items (a)–(c) are not re-reported. I found nothing worse than described for (b) or (c). For (c) I confirmed the mechanism: with D-49, the human wait raises `CancelledError` on the cancel sentinel, so the producer's F2 wins the `cancelled` write before `record_stop` can claim it.

## Critical Issues

### CR-01: An answer is not bound to the question the run is waiting on — a stale answer re-runs the step and is thrown away, or answers a different (human) step

**Files:**
- `backend/app/api/runs.py:990-1001, 1086`
- `backend/app/api/runs.py:768` (`_redrive_paused_workflow_run`)
- `backend/app/services/harness/engine_ask.py:1214-1225`
- `backend/app/services/harness/human_input.py:169-192`

**Status:** traced through the code end to end; not driven live.

**Issue:** For a harness run, `submit_ask_user_response` checks three things: ownership, the thread anchor, and (for an engine prompt) that the label/folder is one that prompt offered. It never checks that `body.tool_call_id` is the run's **current unanswered** prompt. Step 1b's terminal-status 409 does not protect this path either: the harness branch synthesizes `status: None`. Then `_redrive_paused_workflow_run` re-drives any `paused` run with `ctx.resume_answered_tool_call_id = body.tool_call_id`, whatever question that id belongs to.

- **Engine ask (new in 295).** The run is paused on engine ask T2, and an answer arrives for an earlier engine ask T1. This can be the second tab's stale card after a "Search another folder" re-pause, or a replay. The route sees T1's prompt row, which is valid, so nothing is refused. The re-drive runs, but `consume_engine_answer` sees stash tcid T2 ≠ T1 and returns `None`. So the KB step **re-executes** (search + LLM spend), fails the gate again and pauses with a new T3. T2's prompt row is never expired, so `/pending` now serves two live cards. Answering T2 then re-runs the step again: the stash is now T3. Every answer to a superseded card is discarded and the question comes back. That is a dead end with a cost meter, and it is exactly what the phase exists to remove.
- **Human step (mechanism pre-existing since Phase 200, now fed by 295's engine prompts).** The run is paused on a human step H, and an answer arrives for an already-answered engine ask T1. `consume_engine_answer` finds no stash and returns `None`, leaving the flag set. Then `_exec_llm_human_input` reads `get_ask_user_response(run, T1)` and completes H with T1's answer (e.g. "Continue without sources"). The person was never asked H. The run proceeds, possibly into an external action, and the evidence page records the owner as having answered H.

The 244-15 note in `PendingAskCard.tsx` already says a sibling home on the workflow path is not cleared by SSE, and SEED-361 shows the multi-home card is live. A stale answerable card is a real UI state, not a forged-request-only scenario. Only the owner can trigger this, so it is not a cross-user hole. It is still an approval-integrity and data-integrity defect: a person's answer to question A gets recorded as their answer to question B.

**Fix (≈15 lines, no schema):**
```python
# api/runs.py, Step 1c, harness branch only — before the persist:
if _origin == "harness":
    pending = await workflows_db.get_unanswered_ask_user(pool, run_id)
    if not pending or pending.get("tool_call_id") != body.tool_call_id:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="This question is no longer the one the run is waiting on.")
# human_input.py:169 — consume only the id this step itself asked:
_resume_tcid = getattr(ctx, "resume_answered_tool_call_id", None)
if _resume_tcid and str(_resume_tcid) != str(_own_active_tcid(ctx, phase)):  # the row's tool_call_id
    _resume_tcid = None   # not this step's question: ask again, never borrow another answer
```
Also expire the prior engine prompt row whenever `engine_pause` writes a new stash for the same phase.

## Warnings

### WR-01 (assessment of known item (d)): a provider failure is offered as "found nothing", and Continue makes the raw provider error a completed deliverable

**Files:**
- `backend/app/services/harness/engine_ask.py:748-760` (`finding_from_output`)
- `backend/app/services/harness/phase_types.py:932-948`
- `backend/app/services/task_service.py:930-937`

**Issue:** When the sub-agent's provider call raises, `run_task_sub_agent` sets `summary = f"Sub-agent failed: {str(e)}"` and `status = "error"`. `_exec_llm_agent` drops `status`, so the phase output is `{text: "Sub-agent failed: …", citations: [], retrieval_error: None}`. `finding_from_output` classifies that as `no_sources`. Three things follow:
1. **Wrong words.** The person reads "Searched <folder> and found nothing", and may be offered "Search another folder", which cannot fix an outage. This contradicts D-06 ("an outage keeps failing with its outage sentence").
2. **The gate is replayed against a dead provider.** The gate's retry budget is spent re-calling it before the pause appears.
3. **Continue persists the error as output.** It completes the step with `text = "Sub-agent failed: <provider message>"` plus the unsourced mark. Before 295 the gate failed the run and that text was never kept as a deliverable.

**What can leak:** `str(e)` of an SDK error is the vendor's message body. The 295-07 run showed Anthropic's "credit balance is too low". OpenAI rate-limit bodies name the account's `org-…` id, model and quota figures. 401 bodies carry a partially masked key. Self-hosted endpoints can echo host or URL details in connection errors. Once Continue keeps it, the text reaches:
- (i) the next model's input, through `handoff_text` with the unsourced note;
- (ii) **an external action's body verbatim** if the next step is one, because `human_input._latest_phase_text` reads raw `text`;
- (iii) the evidence page, its export and the receipt. Colleagues can open the evidence page.

**Severity:** WARNING, not critical. The card shows the error as the draft, so the Continue is an informed click. But a "found nothing" prompt invites exactly that click.

**Fix (≈6 lines):**
- Carry `"status": result.get("status")` on the llm_agent / batch phase outputs.
- In `finding_from_output`, return `"outage"` when `out.get("status") == "error"`. The shipped D-06 route then fails the run with words.
- Optionally clamp a sub-agent's stored `summary` to a fixed sentence, keeping the vendor body in logs only.

### WR-02: After "Search another folder" finds nothing again, the new pause re-offers the folder that just came up empty

**Files:**
- `backend/app/services/harness/engine_ask.py:880-889` (`_searched_ids`)
- `backend/app/services/harness/run_handoff.py:49-50`

**Issue:** The re-run searches `ctx.phase_scope_override[slug]` (`phase_scope_ids`). But when it pauses again, `_searched_ids` builds "already searched" from `ctx.folder_subtree_ids` only, ignoring the override. So the chosen folder F is not in `searched`, passes `permitted_folder_options`, and is offered again. The label shows its name, from `phase_scope_label`. D-03 says "a dead option is worse than a missing one".

**Fix:** In `_searched_ids`, union `getattr(ctx, "phase_scope_override", {}).get(slug)` with the project subtree before narrowing by the step scope.

### WR-03: D-23 adds a new failure chat message to every valid `skip_to` on any phase with validators

**Files:**
- `backend/app/services/harness_engine.py:2026`
- `backend/app/services/harness/run_handoff.py:95-124`

**Issue:** `claim_failure_message` sets `engine_owns_failure_message` for any phase with validators. Every KB-detected step has at least the appended gate. The valid-`skip_to` arm then always calls `surface_if_engine_owned(… outcome.reason …)`. The executors that surface messages are the `llm_emit` ones only. For an `llm_agent` / `llm_single` / batch phase routed by `skip_to_phase`, the thread had **zero** failure messages before 295 and now gets one. The message reads "Phase N (slug) gate failed after K attempt(s): <raw validator message>", posted mid-run, and the run then continues and completes. A loop-shaped `skip_to` posts one per iteration. `test_a_valid_skip_to_surfaces_once_when_the_engine_owned_the_message` covers only the emit shape.

**Fix:** Set the flag only when the executor would surface, i.e. `phase.config.phase_type == "llm_emit" and validators`. Otherwise gate the skip_to arm's surface on the executor having been silenced (a ctx counter the wrapper increments).

### WR-04: The engine-ask card still offers a free-text answer that the server always refuses, and the refusal's words are discarded

**Files:**
- `frontend/src/components/panel/PendingAskCard.tsx:800-833`
- `frontend/src/lib/api/threads.ts:1507`
- `backend/app/services/harness/engine_ask.py:1088-1107`

**Issue:** The "Always-present free-text" box renders for engine pauses too. Typing an answer without picking a choice gives `label=None`, so the server returns 422 "That choice is not one this question offers.". `answerAskUser` throws `ApiError("Failed to submit ask_user answer", status)` without reading the body, so the card shows "Your answer was refused (422). It has not been saved." The server-built plain-word refusals (including the locked-step sentence) never reach the person.

**Fix:** When `readEnginePause(ask)` is non-null, hide the textarea and its "or" divider (one condition in the card, or a flag from `enginePause.ts`). Separately, have `answerAskUser` read `detail` for 422 and show it.

### WR-05: The judge's design note puts server instructions inside the untrusted graded content, with no closing delimiter

**File:** `backend/app/services/harness/validator_kinds.py:206-213, 252-255`

**Issue:** `_RECORDED_INTENT_NOTE` sits in the graded user content, right after model-produced `text` and before model-produced `recorded_intent.inputs`. It is instruction text ("Not sending is the correct, designed behaviour… Grade whether…") under a heading that claims "(data, written by the server)". The data block that follows has no end marker.

Before 295, nothing in the graded content was a legitimate server instruction. Now one is, and its legitimacy rests only on an in-band heading. KB-derived or Drive-synced text (TRUST-03 untrusted) can print the same heading, in any workflow, to steer `overall_passed`. The schema-bound verdict does not stop the model from choosing `true`. A smaller side effect: an in-run `llm_judge_rubric` on a live run tells the judge "not sending is correct" even when the step was recorded only because a send grant was missing.

**Fix:**
- Move the note into the system prompt: an optional paragraph in `JUDGE_RUBRIC_CORE`, filled only when the output carries `recorded_intent`. That keeps the byte-identity pin for other workflows.
- Keep only the inputs in the graded content, wrapped in an explicit begin/end fence. A per-call nonce is cheap.

### WR-06: The "Search another folder" list is not narrowed to the run's org

**Files:**
- `backend/app/services/harness/engine_ask.py:850`
- `backend/app/services/harness/scope.py:245`

**Status:** reasoned, not driven.

**Issue:** `permitted_folder_options` calls `fetch_visible_folders(supabase, owner)` without `restrict_org_ids`. That resolves the owner's whole org set. For a multi-org owner (the dev account is in two orgs), an org-A run is offered org-B org-shared folders. The re-run's results then live in an org-A run whose evidence page org-A colleagues can open. This is the same acceptance rule a run-start override already uses (D-39 parity), so it is not a new rule. But the publish gate deliberately narrows this exact call by the definition's org (the WR-05 / T-182-54 note in `folder_utils`), and a new per-step widening surface inherits the gap.

**Fix:** Pass `restrict_org_ids={str(ctx.org_id)}` when the run's org is known. If it is unknown, pass `set()` (fail closed, owned folders only).

### WR-07: `engine_pause` pauses the run and releases its lease, then the pause arm calls `pause_run` again after the card is live

**Files:**
- `backend/app/services/harness/engine_ask.py:991, 1036-1054`
- `backend/app/services/harness_engine.py:1941-1955`

**Status:** reasoned; the window is milliseconds.

**Issue:** `engine_pause` writes `pause_run`, setting `claimed_at = NULL`, then the prompt row, then emits the card. Afterwards the original producer still tears down the phase's Redis watchers and reaches the shipped arm, which calls `pause_run` again. An answer that lands in that gap is re-driven (`resume_run` → `active`, `claim_run`). The original producer's second `pause_run` then flips the **running** re-drive back to `paused` and clears its claim. The run reads "Paused for your answer" while it runs, and a second answer or the boot sweep can claim it, giving two producers.

**Fix:** Make the arm's write idempotent for this case. Skip `pause_run` when the outcome came from an engine ask (the reason string or a flag on the outcome), or narrow the arm's UPDATE to `WHERE status = 'active' AND claimed_at IS NOT DISTINCT FROM <this producer's stamp>`.

## Info

### IN-01: The unloadable-definition sweep fails a paused run but leaves its prompt live
**File:** `backend/app/services/harness_engine.py:2744`. `fail_unloadable_definition` → `end_run` never calls `_expire_pending_ask_user`, so `/pending` keeps serving a card for a failed run. The answer then 404s and the card shows "expired". **Fix:** expire after a winning end, as the reconciler sweep does.

### IN-02: The reconciler marks a run whose every step completed as `failed`
**File:** `backend/app/services/run_reconciler.py:321`. A crash between the last `complete_phase` and `finish_run(completed)` gives a run with all steps `completed`, which then reads `failed`, "its steps had ended", even though the deliverable exists. That is D-21's rule as written. Consider `completed` when every step is `completed`/`recorded_not_sent`.

### IN-03: The `_awaiting_answer` stash survives on a cancelled step
**File:** `backend/app/db/workflows.py:2142` (`cancel_active_phases`). A Stop on a paused engine ask keeps `output._awaiting_answer`, including `produced_output` (the unaccepted draft) and folder names. Today's readers only read top-level keys, but any future raw-output reader or export would ship it. **Fix:** strip `_awaiting_answer` in `cancel_active_phases` (`output - '_awaiting_answer'`).

### IN-04: Colleague views withhold the name in one place and show it in another
**Files:** `backend/app/services/run_evidence.py:229`, `run_handoff.py:347-351`, `engine_ask.py:1278`. The unsourced mark shows a colleague "the person who started this run". The same page's `started_by`, and stored end reasons such as "Stopped by <name>." or "<name> chose not to run …", name that person. This is not a leak, since only the owner can answer or Stop and colleagues already see the owner's name. But the two rules disagree.

### IN-05: The run-now route reports a template refusal as a launch failure
**File:** `backend/app/api/schedules.py:271-276`. It returns "Failed to launch schedule: <sentence>". The generic `except Exception` also echoes raw exception text for any error (pre-existing). On the tick, `except ScheduledLaunchRefused: continue` re-fires a refused schedule every period with no backoff or disable.

### IN-06: "Search another folder" on an armed KB step asks for the armed approval again
**File:** `backend/app/services/harness/engine_ask.py:380, 1158-1170`. The approval is single-use and was consumed on the earlier re-drive, so the folder re-run re-asks it. This is probably intended (never skip an approval), but nothing records it as a decision.

### IN-07: A code-like audit string can now surface as "Why it stopped"
**Files:** `backend/app/api/runs.py:654-657`, `run_read_wire.py:resolve_end_reason`. `_fail_redrive` writes `run_failed {"reason": "ask_user re-drive failed"}`. When no active phase got the worded reason, the new `end_reason` line renders that string. **Fix:** write `reason` (the worded sentence) into the audit metadata.

### IN-08: The recorded-intent note applies even when the recording was not by design
**File:** `backend/app/services/harness/validator_kinds.py:206`. See WR-05's last sentence. Worth an operator decision on whether a live run recorded only for a missing grant should get the "designed behaviour" note.

---

_Reviewed: 2026-10-21T01:27:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
