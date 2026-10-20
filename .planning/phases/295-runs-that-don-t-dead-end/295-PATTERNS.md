# Phase 295: Runs That Don't Dead-End - Pattern Map

**Mapped:** 2026-10-20 (HEAD `fc4226ecf`; every line number below was re-read at this HEAD, and RESEARCH's numbers matched)
**Files analyzed:** 46 (new + modified, backend + frontend + tests)
**Analogs found:** 44 / 46 (2 have no analog: the `run_workflow`-free reconciler sweep over `workflow_runs`, and `AskFolderChoice`, which has a *pattern* analog but no component analog by design)

> CONTEXT amendments D-36..D-51 supersede the earlier decisions. Where UI-SPEC and an amendment disagree, this map flags it. **One real conflict:** UI-SPEC E.2 says `no_template_bound` is `error` severity in `/validate`, and D-45 (R2) says `incomplete` (`_INCOMPLETE_CODES`). Per CONTEXT, the amendment wins. The planner should record that UI-SPEC decision 8 is overridden.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/services/harness/engine_ask.py` **NEW** | service (extracted seam) | event-driven (pause/resume) | `backend/app/services/harness/human_input.py` (200 verbatim extraction + re-import) | exact |
| `backend/app/services/harness_engine.py` | service (engine loop) | event-driven | itself: `HumanInputTimeout` → `PhaseOutcome("pause_run")` arm `:1102-1121` / `:2444-2458` | exact |
| `backend/app/services/harness/grounding.py` | utility (pure predicate) | transform | `grounding_cause` `:1183-1189` (pure, `getattr` totality idiom) | exact |
| `backend/app/services/harness/phase_types.py` | service (executors) | transform | `_prior_output_text` `:171-189`; scope expr `:636-641`; `_surface_failure_message` `:372-384` | exact (self) |
| `backend/app/services/harness/human_input.py` | service | event-driven | its own shutdown branch `:283-287` (CancelledError on sentinel) | exact (self) |
| `backend/app/services/harness/reachability.py` | utility (pure lint) | transform | `_check_input_contracts` `:297-330` + `LINT_CODES` `:131-139` | exact |
| `backend/app/services/harness/emit_cause.py` | utility (vocabulary) | transform | `_NO_TEMPLATE_SENTENCE` `:121`, `KIND_NO_TEMPLATE` `:80` | exact (self) |
| `backend/app/api/workflows.py` | controller | request-response | `_INCOMPLETE_CODES` `:741-753` (`unbound_retrieval` precedent) | exact |
| `backend/app/services/harness/validator_kinds.py` | service (judge seam) | transform | `_judge_graded_text` `:184-202` (`field_map` append arm) | exact (self) |
| `backend/app/services/harness/publish_service.py` | service | batch (golden run) | its own `finally` `:1758-1789`; stage-2 lint `:177-191` | exact (self) |
| `backend/app/services/workflow_kickoff.py` | service (preflight) | request-response | `preflight_workflow_kickoff` `HTTPException` refusals `:229-243` | exact (self) |
| `backend/app/services/scheduler_service.py` | service | batch | `launch_scheduled_run` `:54` | role-match |
| `backend/app/services/template_asset_service.py` | service (predicate) | CRUD read | Branch-2 `template_input` SELECT `:209-226` | exact (self) |
| `backend/app/services/run_producer.py` | service | event-driven (F2) | F2 `_finish_wf` `:360-385` + engine `fail_run` arm `:2460-2475` | exact |
| `backend/app/services/run_reconciler.py` | service (boot sweep) | batch | `_reconcile_chat_runs` `:201-253` | role-match |
| `backend/app/db/workflows.py` | model/DB writer | CRUD | `record_phase_not_sent` `:2007-2033`, `pause_run` `:2219` | exact |
| `backend/app/api/runs.py` | controller | request-response | `AskUserResponseBody` `:553-561`; `_fail_redrive` `:569`; `_redrive_paused_workflow_run` `:635-760` | exact (self) |
| `backend/app/api/panel.py` | controller | request-response | `/pending` projection `:205-230` (`draft` field, D-12) | exact (self) |
| `backend/app/api/workflow_runs.py` | controller (wire) | request-response | 289 `confidence` field `:271-285` + populate `:1108-1137`; 288 `waiting_on` `:338-347, :408`; `compose_waiting_on` call `:874-882` | exact |
| `backend/app/api/workflow_run_evidence.py` | controller (wire) | request-response | `RunEvidenceRun` `:71-81`, phase `confidence` `:136` | exact |
| `backend/app/api/threads.py` | controller (panel projection) | request-response | `_failure_reason` normalisation `:2348-2351` → `WorkflowPhaseState(...)` | exact |
| `backend/app/models/thread.py` | model | — | `WorkflowPhaseState` `:344` (`failure_reason`) | exact |
| `frontend/src/components/panel/PendingAskCard.tsx` | component | request-response | itself: `paused` prop (289-01), `hasDeadline` `:358`, chips `:703-745` | exact (self) |
| `frontend/src/components/panel/enginePause.ts` **NEW** (name per UI-SPEC "e.g.") | utility (pure) | transform | `components/workflows/verdictModel.ts` (pure module) / `soulData.ts` helpers | role-match |
| `frontend/src/components/panel/AskFolderChoice.tsx` **NEW** | component (leaf) | — | Select pattern in `components/health/MoveToFolderDialog.tsx:69-81`; leaf shape of `WaitingOnLine.tsx` | pattern-only |
| `frontend/src/components/workflows/StepEvidenceLine.tsx` | component (leaf) | — | itself (289 confidence arm) | exact (self) |
| `frontend/src/components/workflows/RunEndReasonLine.tsx` **NEW** | component (leaf) | — | `components/workflows/WaitingOnLine.tsx` | exact |
| `frontend/src/components/workflows/evidenceVocabulary.ts` | vocabulary | — | `NO_MATCH_EXPLANATION`, `whyItStopped` `:169` | exact (self) |
| `frontend/src/components/workflows/evidenceView.ts` | utility (view model) | transform | step row `:250-262` (`confidence: row.confidence`) | exact (self) |
| `frontend/src/components/workflows/RunEvidenceReport.tsx` | component | — | `:314` `<StepEvidenceLine confidence=…/>`; `:179` `{view.outcome}` | exact (self) |
| `frontend/src/components/workflows/RunSpine.tsx` | component | — | `:190` intersection type + `:416` mount | exact (self) |
| `frontend/src/components/panel/PhaseCard.tsx` | component | — | `RunSpine.tsx:416` mount | role-match |
| `frontend/src/components/workflows/verdictModel.ts` | utility (pure) | — | `BLOCKED_SENTENCE` `:182` | exact (self) |
| `frontend/src/pages/WorkflowRunPage.tsx` | page | — | `:1302` `<WaitingOnLine waitingOn={run?.waiting_on} />` | exact (self) |
| `frontend/src/lib/api/workflows.ts` | API types | — | `confidence?: RunPhaseConfidence \| null` `:664-676`; `WorkflowRunWaitingOn` | exact (self) |
| `frontend/src/types/index.ts` | types | — | `PendingAsk` `:1352-1370` (`draft?` additive); `Phase.failureReason` | exact (self) |
| `frontend/src/providers/StreamsProvider.tsx` | provider (mapper) | streaming | `failureReason: row?.failure_reason` `:4758`, `:4808` | exact (self) |
| `frontend/src/lib/api/threads.ts` | API client | request-response | `answerAskUser` `:1490` / `AskUserAnswerBody` | exact (self) |
| `backend/tests/integration/test_214_argument_seams.py` | test (fixture) | — | its own teardown (D-43 fix) | self |
| Tests (new, 8 files) | test | — | see §Tests | — |

---

## Pattern Assignments

### Plan 1, the seam first (D-51 / D-32): `harness/engine_ask.py` NEW + `harness_engine.py` re-import

**Analog:** `backend/app/services/harness/human_input.py` (the 200 extraction out of `phase_types.py`). Secondary: `tool_dispatcher.py` → `services/tools/` (278-03), proven by `tests/unit/test_278_pure_move.py`.

**Module docstring + imports + `__all__` shape** (`human_input.py:1-57`, abridged):
```python
"""The ``llm_human_input`` phase executor — the run's human gate.

EXTRACTED FROM ``app.services.harness.phase_types`` on 2026-08-19 (Phase 200 / D-13) ...
The bodies below are a **VERBATIM move**, not a rewrite. The cut was driven by a
script that asserted the pre-move line boundaries first and aborted on drift ...
⚠ CONSUMERS WERE DELIBERATELY NOT REPOINTED ... ``phase_types.py`` re-imports both names ...
    app.services.harness.phase_types._exec_llm_human_input
        is app.services.harness.human_input._exec_llm_human_input
⚠ THE RE-IMPORT IS LOAD-BEARING AND MUST NOT BE "TIDIED" AWAY ...
⚠ THE HONEST LEAF INVARIANT ... **this module must never import ``phase_types`` back.**
⚠ AND THE PATCH SURFACE MOVED WITH THE FUNCTION. ``subscribe_for_response`` is bound
as a module GLOBAL here, so a test that patched ``phase_types.subscribe_for_response``
now patches a name the executor no longer reads. Nine such sites across five shipped
test files were repointed in the extraction commit — measured RED first ...
"""
from __future__ import annotations
import asyncio
import logging
from app.config import settings
from app.services.ask_user_service import subscribe_for_response
logger = logging.getLogger(__name__)
__all__ = ["HumanInputTimeout", "_exec_llm_human_input", "_latest_phase_text"]
```

**Re-import in the old home** (`phase_types.py:131-132`):
```python
# ── llm_human_input — MOVED to app.services.harness.human_input (G-5 / D-13, 2026-08-19) ──
from app.services.harness.human_input import _exec_llm_human_input, _latest_phase_text  # noqa: F401
```
⚠ The **cycle trap** applies to `harness_engine.py`. A top-level import of anything under `app.services.harness` runs the package `__init__`, which runs `phase_types.register_all()`, which imports back from the engine. The engine works around this with a **lazy** import inside `_run_phase_with_gates` (`harness_engine.py:1083-1089`):
```python
    # 200 (D-10): bound ONCE here rather than per-attempt, and LAZILY — a top-level
    # import of anything under ``app.services.harness`` runs that package's __init__ →
    # ``phase_types.register_all()`` → imports back from THIS module before the registry
    # is bound (the cycle the whole package documents). ...
    from app.services.harness.human_input import HumanInputTimeout  # noqa: PLC0415
```
The planner must decide how `harness_engine` re-exports `engine_ask` names that tests patch at module level, such as `harness_engine._resolve_failure_with_ask_user` (22 test references). A plain top-level `from app.services.harness.engine_ask import …` may hit this cycle. **Measure it in a fresh interpreter** (test_278 rule 7, below). If it cycles, the fallback is to keep `engine_ask` free of any `app.services.harness` package import at module level, or to make it a sibling module outside the package (`app/services/engine_ask.py`). Record whichever you choose.

**Names to move verbatim** (all at HEAD `harness_engine.py`): `_OnFailure` (`:620`), `_parse_on_failure` (`:623`), `_failing_on_failure` (`:654`), `_route_on_failure` (`:1248`), `_ask_user_choices_from_finding` (`:1280`), `_ACTION_RISK_APPROVE_CHOICE` (`:1342`), `_ABORT_LIKE_CHOICES` (`:1349`), `_is_abort_choice` (`:1352`), `_ACTION_RISK_FINDING_PREFIX` (`:1384`), `_resolve_failure_with_ask_user` (`:1387-1714`). **Must NOT move:** `PhaseOutcome = namedtuple(...)` (`:616`), its preceding `# The outcome of running a phase…` comment block, and the outcome arms `if outcome.kind == "pause_run":` … `# ── fail_run:` (`:2444-2460`). These are fenced by `backend/tests/test_200_human_gate_pause.py:294-341`, which slices `inspect.getsource(harness_engine)` between those exact markers.

**Pure-move proof test.** Copy the structure of `backend/tests/unit/test_278_pure_move.py` into the new `tests/unit/test_295_engine_ask_seam.py`:
- `PHASE_BASE_SHA` constant + `_blob_at_base()` via `git show` with **`encoding="utf-8"`**, which is load-bearing on Windows (`:230-243`).
- `_bindings(src)` AST map of top-level def/class/Assign (`:250-260`); compare `ast.dump` of each moved name at base vs its new home.
- "one home per name" (a copy, not a move, fails).
- "same object" re-export check (`:452-461`):
```python
        assert getattr(td, name) is getattr(home, name), (
            f"tool_dispatcher.{name} is not the object in {home_mod} — a copy, not a re-export"
        )
```
- a fresh-interpreter import probe and `symtable` global-binding check (rule 7). A moved body that reads `write_audit` / `_emit` / `subscribe_for_response` as globals must find them bound in `engine_ask`.
- a `RETIRED = {}` dict for deliberate later retirement (SEED-177 shape).

**Patch-target convention (patch-where-used).** After the move, `monkeypatch.setattr(harness_engine, "write_audit", …)` and `harness_engine._emit` **no longer intercept** calls made from `engine_ask` (6 + 2 sites). Repoint them to `engine_ask.write_audit` / `engine_ask._emit` in the extraction commit, **after measuring RED** (the `human_input` precedent: "Nine such sites across five shipped test files were repointed"). Tests that patch `harness_engine._resolve_failure_with_ask_user` to stub the whole helper keep working **only if** the engine call sites read the name through the `harness_engine` module global. A re-export binding does that; a lazy local import inside the caller does not. Pick one form and state it.

---

### Plan 1/2, the durable engine-ask pause (D-01 / D-18 / D-37 / D-50): `engine_ask.py` + one call change in `harness_engine.py`

**Analog:** the human-gate pause. `HumanInputTimeout` is raised in `human_input.py:306-309`, caught at `harness_engine.py:1102-1121`, and returned as `PhaseOutcome("pause_run", None, None, str(_pause))`. The existing arm does the rest (`harness_engine.py:2444-2458`):
```python
        if outcome.kind == "pause_run":
            await pause_run(pool, run_id)
            await write_audit(
                pool, run_id, user_id=_audit_user_id,
                event_type="policy_applied",
                metadata={
                    "policy": "human_gate_pause",
                    "phase": phase.slug,
                    "reason": outcome.reason,
                },
            )
            await _emit(redis, stream_run_id, "run_paused",
                phase=phase.slug, reason=outcome.reason,
            )
            return  # stop — resumable, not terminal
```
The arm must keep: no `CancelledError` / `finish_run(` / `cancel_phase(` / `_expire_pending_ask_user(` text, and the order `pause_run(pool, run_id)` < `write_audit(` < `"run_paused"` (`test_200_human_gate_pause.py:303-341`). ⚠ **That test also fails on a comment that quotes a forbidden token** (`harness_engine.py:2436-2443` records the trap). The `policy` value is hard-coded to `"human_gate_pause"`. If engine asks need their own policy name (RESEARCH §G wants a behaviour-level count via `policy_applied`), carry the policy name **on the outcome** rather than branching inside the arm. That keeps the arm's G-5 count and the fence intact.

**Where the engine ask is decided today.** Two call sites change:
- the post-gate exit (`harness_engine.py:1216-1225`):
```python
        _clear_retry_feedback(ctx)
        return await _resolve_failure_with_ask_user(
            phase, cause, attempt, failed_idx,
            run_id=run_id, pool=pool, redis=redis, ctx=ctx,
            _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
            produced_output=output, is_pre=False,
            reason_is_final=diagnosed,
        )
```
- the armed checkpoint (`harness_engine.py:1067-1076`), which calls `_resolve_failure_with_ask_user(phase, _ACTION_RISK_FINDING_PREFIX + sentence, 0, None, …, is_pre=True, is_action_risk=True)`. It returns `None` on approve, else an outcome.

RESEARCH §B (`:483-494`) places the new branch **inside** the moved helper's `if not is_action_risk:` arm, as `if not is_pre and is_engine_citation_gate(phase, failed_idx): return await engine_citations_pause(...)`. Done that way, the engine call sites stay byte-identical, and harness_engine's G-5 touch is only the re-import plus the answer-consume step (Pattern 5) plus `_resume_run`.

**Pause write order** (Pattern 4; WRITE-before-EMIT; `pause_run` before the prompt row, so an early answer finds `status='paused'` (`api/runs.py:697`)). **Lease release** (Pitfall 1) is an extra `, claimed_at = NULL` on `pause_run`'s single UPDATE (`db/workflows.py:2219-2260`). It stays green against `test_200_human_gate_pause.py:153-157`, which matches only the substring `UPDATE workflow_runs SET status = 'paused'` and the `NOT IN ('completed', 'failed', 'cancelled')` guard.

**Answer consume on re-drive.** Copy `human_input.py:169-192` (the single-use, explicitly keyed flag):
```python
    _resume_tcid = getattr(ctx, "resume_answered_tool_call_id", None)
    if _resume_tcid:
        try:
            ctx.resume_answered_tool_call_id = None
        except Exception:  # noqa: BLE001 — a frozen ctx must not sink the phase
            logger.debug("llm_human_input: could not clear the resume flag", exc_info=True)
        _pool = getattr(ctx, "pool", None)
        if _pool is not None:
            from app.db.workflows import get_ask_user_response  # noqa: PLC0415
            _durable = await get_ask_user_response(_pool, run_id, str(_resume_tcid))
            if _durable is not None:
                _answer = _resolve_answer_text(
                    _durable.get("response_text"), _durable.get("choice_index"), options
                )
```
Difference for engine asks: consume **only if** the active phase's `_awaiting_answer.tool_call_id == _resume_tcid`. Otherwise leave the flag for the human executor. Then resolve through an **exact-label allow-list**, never `_is_abort_choice`'s "anything else → Proceed" (T-185-04-01).

**Server-built choices.** `_ask_user_choices_from_finding` (`:1280-1312`) is the shipped home for option lists, and its docstring rule binds: "EVERY string returned from here MUST be classified by `_is_abort_choice`". `test_ask_user_disposition.py` enforces that every presented pair is classified. The new citation labels (`Search another folder` / `Continue without sources` / `Stop the run`) either join that classification or live in an engine-ask allow-list that the invariant test is extended to cover. Do not leave them unclassified.

**Cancel sentinel → CancelledError (D-49).** Copy the shutdown branch (`human_input.py:283-287`):
```python
    if payload and payload.get("kind") == "shutdown":
        raise asyncio.CancelledError(
            "llm_human_input interrupted by server shutdown — phase left active "
            "for the boot-time resume sweep (096-09)"
        )
```
Add a sibling arm for `kind == "cancel"` here, and in the author-validator waiter inside `engine_ask._resolve_failure_with_ask_user` (moved from `:1594-1598` / `:1630-1633`). ⚠ Keep `if payload is None:` (`:306`) gated strictly on `None`. Its own comment warns that widening it converts a cancel into a pause.

**Prompt row no longer best-effort (D-50 / Pitfall 4).** The insert at moved-`:1508-1543` logs and continues today. For an engine ask, return `PhaseOutcome("fail_run", None, None, <words>)` on insert failure (fail closed).

---

### Plan 1/4, `_resume_run` terminalize on escape (D-41 / Pitfall 3): `harness_engine.py:3139-3149`

**Today** (0 branches):
```python
async def _resume_run(run_id: UUID, definition: WorkflowDefinition, ctx, *, pool, redis) -> None:
    """Re-drive a claimed stranded run through the engine (rides run_workflow). ..."""
    await run_workflow(run_id, definition, ctx, pool=pool, redis=redis)
```
**Analog for the terminalize:** the F2 shape in `run_producer.py:366-385`, where a non-shutdown escape calls `_finish_wf(pool, run_id, "cancelled" if (terminal_status == "cancelled" or _cancel_known) else "failed")` inside `except BaseException`, plus the audit/emit order of the engine `fail_run` arm (`harness_engine.py:2461-2475`):
```python
            await fail_phase(pool, phase_id, outcome.reason)
            await finish_run(pool, run_id, "failed")
            await write_audit(
                pool, run_id, user_id=_audit_user_id,
                event_type="run_failed", metadata={"reason": outcome.reason},
            )
            await _emit(redis, stream_run_id, "run_failed", reason=outcome.reason)
```
Also copy the guarded single-UPDATE "terminal write is the guard" posture of `_fail_redrive` (`api/runs.py:569-620`, 289-REVIEW WR-02): `UPDATE workflow_runs SET status='failed' WHERE id=$1 AND status = ANY($2) RETURNING id`, and only the winner writes the audit. Re-raise after. **Shutdown must stay excluded** (the `is_app_shutting_down` gate). Anti-pattern (RESEARCH): no `try/finally` around `run_workflow`'s loop (rejected at `harness_engine.py:2383-2394`); the terminalize goes in `_resume_run`.

**Sweep `continue` when the definition won't load** (`harness_engine.py:3213-3224`). Replace the bare `continue` with the `_fail_redrive(... from_statuses=("paused","active"), reason=_REDRIVE_NO_DEFINITION_REASON)` shape (289-REVIEW WR-06 precedent, `api/runs.py:710-723`), then `continue`.

**Boot sweep must not re-ask a paused engine ask (Pitfall 2).** Analog: the sweep's existing human branch just above `:3205` (`resume_pending_prompt(..., pending.get("timeout_seconds") or settings.ask_user_max_timeout_seconds)`, plus "answered → fall through; run_workflow re-reads the durable answer"). Add: `_awaiting_answer` present and unanswered → `continue` (leave paused); answered → set `ctx.resume_answered_tool_call_id` before `_resume_run`.

---

### Plan 2, the gate predicate: `grounding.py`

**Analog:** `grounding_cause` (`grounding.py:1183-1189`), pure and `getattr`-total:
```python
    if set(getattr(phase.config, "available_tools", None) or ()) & KB_TOOLS:
        return "detected"
    if getattr(phase.config, "citation_policy", None) == "strict":
        return "already-set"
    if getattr(phase, "grounding_escalated", False):
        return "escalated"
    return None
```
The appended spec it must recognise (`:1404-1413`) **stays unchanged**, because `test_185_engine_attachment.py:77` pins `spec.on_failure == "fail_run"`:
```python
    if grounding_cause(phase) == "detected":
        extra.append(
            ValidatorSpec(
                kind="citations_required", timing="post", on_failure="fail_run",
                max_retries=2, config={"mode": "retrieved_and_cited"},
            )
        )
```
Add ONE function, `is_engine_citation_gate(phase, failed_idx)` (RESEARCH Pattern 2, verbatim there). The **locked** predicate (D-36) is `bool(getattr(phase, "grounding_escalated", False))`, read directly and **not** through `grounding_cause`. Whether it lives here or in `engine_ask` is a G-5 call: grounding gets ONE touch, so put the second predicate in `engine_ask.py`.

---

### Plan 2, the prior-output reader (D-10 / D-11 / D-46): `phase_types.py`

**Today** (`phase_types.py:171-189`):
```python
def _prior_output_text(accumulated_outputs: dict) -> str:
    if not accumulated_outputs:
        return ""
    texts = [
        (v.get("text") if isinstance(v, dict) else None)
        for v in accumulated_outputs.values()
    ]
    texts = [t for t in texts if t]
    if not texts:
        return ""
    return texts[-1] if len(texts) == 1 else "\n\n".join(texts)
```
Change: map ONE `_handoff_text(out)` helper (RESEARCH §C) over the outputs instead of `v.get("text")`. A human output is recognised by `"answer" in out and out.get("tool_call_id") is not None`, which is the shape `human_input.py:327` returns (`{"text": prompt, "answer": answer, "tool_call_id": tool_call_id}`). The unsourced note lives **only here** (Pitfall 10).

**`_latest_phase_text` skip (R9)** goes in `human_input.py:330-340`, not in `phase_types` (it moved there in 200). It is reached from `phase_types._external_action_inputs` through the re-import:
```python
    for out in reversed(list(accumulated_outputs.values())):
        if isinstance(out, dict) and isinstance(out.get("text"), str) and out["text"].strip():
            return out["text"]
```
Add a `"answer" in out` skip. Keep `test_198_node_vocabulary.py:130-139` green.

**Scope override (D-03 / D-39), ONE expression** at `phase_types.py:636-641`:
```python
    _proj = getattr(ctx, "folder_subtree_ids", None)            # the resolved project subtree (or None)
    _phase_scope = getattr(phase.config, "folder_scope", None)
    _effective = (
        [f for f in _proj if f in set(map(str, _phase_scope))]  # narrow-only ∩ — keep a list (Pitfall 1)
        if _proj is not None and _phase_scope else _proj
    )
```
→ `_proj` becomes `_override if _override is not None else getattr(ctx, "folder_subtree_ids", None)` (RESEARCH Pattern 6). The override must stay a **list**, because a set breaks supabase-py JSON. ⚠ phase_types has ONE G-5 touch, and this would be a second touch on top of `_prior_output_text`. Count it: 289-02's claim was "`ast.If` 113 → 113, defs 55 → 55". If both land, record each as one expression / one helper with the arithmetic, or move the override computation into `engine_ask` and pass the result on ctx (still one expression here).

**D-23 suppression flag.** The guard goes on the executor's `_surface_failure_message` (`phase_types.py:372-384`), which lazily delegates to `harness_engine._surface_failure_message`:
```python
async def _surface_failure_message(ctx, run_id, reason, pool):
    from app.services.harness_engine import _surface_failure_message as _engine_surface
    return await _engine_surface(ctx, run_id, reason, pool)
```
The engine arm that already surfaces is `harness_engine.py:2473` (`await _surface_failure_message(ctx, run_id, outcome.reason, pool)`). Pitfall 6 lists the arms that must surface once after suppression: missing `skip_to` (`:2515`), valid `skip_to`, and completed-with-`failure` (`:2587`).

---

### Plan 2, the `_awaiting_answer` stash writer (D-40): `db/workflows.py`

**Analog:** `record_phase_not_sent` (`db/workflows.py:2007-2033`). It is phase-keyed, writes one atomic UPDATE, has a cancelled fence, and **does not pre-encode JSON**:
```python
    await pool.execute(
        "UPDATE workflow_phases SET status='recorded_not_sent', output=$2::jsonb, updated_at=now(), completed_at = now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'",
```
New writer: `UPDATE workflow_phases SET output=$2::jsonb, updated_at=now() WHERE id=$1 AND status='active'`. Do **not** set `completed_at`; the phase stays active. ⚠ Pass the dict, never `json.dumps(...)`. The 200.1 docstring (`complete_phase`, `:1890-1900`) records that pre-encoding produced 527/588 jsonb string scalars. ⚠ The key must not be top-level `tool_call_id`, because `_is_llm_human_input` keys on `"tool_call_id" in output` (`harness_engine.py:3352-3354`). Nest it under `_awaiting_answer`.

---

### Plan 2, the answer body + pending projection: `api/runs.py`, `api/panel.py`, `lib/api/threads.ts`

**Answer body** (`api/runs.py:553-561`). Add ONE optional field, the same shape as `choice_index`:
```python
class AskUserResponseBody(BaseModel):
    tool_call_id: str
    response_text: str
    choice_index: "int | None" = None
```
→ `folder_id: "str | None" = None`. Server re-validates it against the stored `folder_option_ids` (V5 allow-list); a client id is never trusted.

**Pending projection** (`api/panel.py:218-230`). Copy the 093 D-12 additive `draft` line:
```python
                # D-12: the prior-phase draft the user is confirming (defensive .get —
                # older prompt rows predate the draft field → None, harmless).
                "draft": payload.get("draft"),
```
→ `"engine_pause": payload.get("engine_pause"),`. The same key must ride the SSE `ask_user_prompt` payload (UI-SPEC A.4: "present on BOTH the SSE and GET payloads"). ⚠ `api/panel.py` has **no ledger row** (5 commits / 4 phases, RESEARCH Wave 0). Add a row and section in the same commit.

**Re-drive** (`api/runs.py:635-760`). Unchanged in shape. It already sets `ctx.resume_answered_tool_call_id = tool_call_id` (`:733`), requires `status='paused'` + anchor + `is_golden_run = false` (`:690-700`), and logs `re-drive skipped, run … already claimed` (`:707`), which is Pitfall 1's warning sign.

**Client** (`frontend/src/lib/api/threads.ts:1490`). `answerAskUser(runId, body: AskUserAnswerBody)` gains the optional `folder_id` on `AskUserAnswerBody`. UI-SPEC E.4: surface the server's `detail`, never a constant (this function is the precedent for a constant hiding the server's words).

---

### Plan 2, the `unsourced` optional output field end to end (D-04): copy 289's `confidence`

| Hop | Analog (289 `confidence`) | New |
|---|---|---|
| Engine write | `phase_types.py:938-944`: `"confidence": phase_confidence(...)`, ONE dict key; branching lives in a helper module | `engine_ask` writes `unsourced: {continued_by, at}` onto the stashed output before `complete_phase`. **No phase_types change for this hop** |
| Run wire model | `api/workflow_runs.py:271-285`: `confidence: dict \| None = Field(default=None, description=...)` with the comment "JOINS THE LOCKSTEP … fenced by `test_200_1`'s set equality" | `unsourced: dict \| None = Field(default=None, ...)` on `WorkflowRunPhaseRead`. ⚠ Extend the `test_200_1_deliverable_text.py` set-equality lockstep in the same commit |
| Run populate | `:1108` `raw_confidence = obj.get("confidence") if isinstance(obj, dict) else None` … `:1137` `confidence=confidence_for_wire(...)` with the comment "POPULATED, not merely declared (the 214 rule)" | `unsourced=<allow-listed dict or None>` off the SAME single parse (`obj`) |
| `continued_by` | `compose_waiting_on` name chain (`api/workflow_runs.py:791-830`; call at `:874-882` with `owner_id`, `viewer_id`, `display_name`) | resolve server-side and viewer-aware (UI-SPEC B.1): owner → `{name} (you)`, others → `the person who started this run` |
| Evidence wire | `api/workflow_run_evidence.py:136` `confidence: RunEvidenceConfidence \| None = None` | `unsourced: ... \| None = None` on the evidence phase model |
| Panel wire | `api/threads.py:2348-2351` `_raw_reason = _obj.get("_failure_reason") …` → `WorkflowPhaseState(failure_reason=_reason, …)`; model `models/thread.py:344` | ONE field `unsourced` on `WorkflowPhaseState` + ONE kwarg |
| FE types | `lib/api/workflows.ts:664` `confidence?: RunPhaseConfidence \| null` + its interface `:670-676` | `unsourced?: RunPhaseUnsourced \| null` |
| FE panel type/mapper | `StreamsProvider.tsx:4758` `failureReason: row?.failure_reason,` and `:4808` `failureReason: r.failure_reason,` | `unsourced: row?.unsourced,` ×2 + `types/index.ts` `Phase.unsourced?` |
| View model | `evidenceView.ts:257` `confidence: row.confidence,` | `unsourced: row.unsourced ?? null,` |
| Leaf | `StepEvidenceLine.tsx` (below) | one new arm |
| Mounts | `RunSpine.tsx:416` `<StepEvidenceLine confidence={row.confidence} />`; `RunEvidenceReport.tsx:314` `<StepEvidenceLine confidence={r.confidence} />` | add `unsourced={…}` prop; `PhaseCard.tsx` ONE new mount |

**Leaf arm** (copy `StepEvidenceLine.tsx` anatomy):
```tsx
const CHIP_BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] whitespace-nowrap"
export function StepEvidenceLine({ confidence }: { confidence?: EvidenceLineConfidence | null }) {
  if (!confidence) return null
  ...
      {note ? (
        <span data-testid="step-evidence-note" className="mt-1 block text-xs italic text-muted-foreground">
          {note}
        </span>
      ) : null}
```
Change: the signature becomes `{ confidence, unsourced }`. The early `return null` must become "both absent → null", so the confidence arm renders unchanged when `unsourced` is absent. Use a structural read-shape interface (`EvidenceLineUnsourced`), never an import from the API module (the leaf rule in its header). The tone and glyph `◌` come from UI-SPEC B.1. The words go in `evidenceVocabulary.ts` (`UNSOURCED_*`), next to `NO_MATCH_EXPLANATION`.

**RunSpine read shape** (`RunSpine.tsx:188-190`). Widen the intersection the same way 289 did:
```ts
  phases: readonly (PhaseTimingRow & { confidence?: EvidenceLineConfidence | null })[]
```

---

### Plan 2, the card: `PendingAskCard.tsx` (ONE field via ONE helper) + `enginePause.ts` NEW + `AskFolderChoice.tsx` NEW

**Analog for one-touch:** 289-01 added ONE optional `paused` prop, one constant and one render arm, with `useState` 7 → 7 (ledger `PendingAskCard.tsx — Phase 289 (289-01)`). Existing wait-line arms (`PendingAskCard.tsx:651-667`):
```tsx
        {hasDeadline && !paused && (
          <span className="ml-auto text-[hsl(var(--muted-foreground-dim))]">{formatClock(remaining)}</span>
        )}
      ...
      {!hasDeadline && (
        <p className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground-dim))]">
          {NO_DEADLINE_WAITING_LINE}
        </p>
      )}
      {hasDeadline && paused && (
        <p className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground-dim))]">
          {PAUSED_WAITING_LINE}
        </p>
      )}
```
With D-37 (`timeout_seconds=None`), `hasDeadline` (`:358`, `typeof timeout_seconds === "number"`) is false for engine asks. The card then already shows `NO_DEADLINE_WAITING_LINE` and no clock, so the window rule needs **no new arm**. The single new read is `ask.engine_pause`, passed through a pure helper (`enginePause.ts`: needs-folder, answered-stop words). That helper also gates the ONE `AskFolderChoice` mount below the chips (`:703-745`). Submit (`:422-430`) gains `folder_id` from the helper's result only. Chips need no change, because labels come from `ask.options` verbatim.

**`AskFolderChoice` Select pattern** (`components/health/MoveToFolderDialog.tsx:9-15, 69-81`):
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a folder..." />
            </SelectTrigger>
            <SelectContent>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
```
⛔ Copy the **pattern only**. `MoveToFolderDialog` imports `listFolders, moveDocument` from `@/lib/api` (`:17`), which would widen access (D-03). The leaf takes `folders` from `ask.engine_pause.folders` as a prop and imports no API. Selection state lives in `askDraftStore` keyed by `tool_call_id` (`PendingAskCard.tsx:56` imports `useAskDraft, useAskDraftStore`; the 282-02 one-draft rule).

**Backend twin of the window bug (R7).** `api/workflow_runs.py:881` passes `window_passed=run.get("status") == "paused"`. For an engine pause with no deadline this yields "window passed" at second 0. Key it on `prompt.timeout_seconds is not None and created_at + timeout < now` (one expression). `workflow_runs.py` is FIRING (289-REVIEW WR-05/06 last touch), so count it.

---

### Plan 3, the lint code (D-12 / D-45): `reachability.py`, `emit_cause.py`, `api/workflows.py`

**Code set** (`reachability.py:131-139`):
```python
LINT_CODES: frozenset[str] = frozenset(
    {
        "bad_index",
        "input_unsatisfied",
        "no_terminal",
        "orphan_phase",
        "unsatisfiable_skip",
    }
) | ARGUMENT_GAP_CODES
```
Add `"no_template_bound"` (it equals `emit_cause.KIND_NO_TEMPLATE`, `:80`). `test_182_severity_codes.py` asserts `scanned | ARGUMENT_GAP_CODES == LINT_CODES` over literal `LintError(` codes, so the literal and the set land in one commit (the comment at `:125-130` forbids re-typing codes "to help the scanner").

**Check placement.** Follow the `_check_input_contracts` call at the end of `lint_workflow` (`:457-463`):
```python
    errors.extend(
        _check_input_contracts(phases, definition=definition, tool_schemas=tool_schemas)
    )
    return errors
```
Add a sibling `errors.extend(_check_template_bound(phases, definition))` with the `LintError("input_unsatisfied", p.slug, "...")` triple shape (`:320-323`). It stays pure: it reads `definition.assets` only.

**Sentence** (`emit_cause.py:121`): `_NO_TEMPLATE_SENTENCE = "no template is attached to this step{detail}."`. Export ONE composer for the UI-SPEC E.1 sentence. If it is reworded at its home, re-run `test_281_*` and the emit-cause pins.

**Severity** (`api/workflows.py:741-753`). Copy the `unbound_retrieval` precedent and its warning:
```python
_INCOMPLETE_CODES: frozenset[str] = frozenset(
    {
        "input_unsatisfied",
        "business_requirement",
        "interactive_phase",
        # D-187-11: ... BOTH registrations are required: this one
        # AND ``_ROUTE_ASSIGNED_CODES`` above. ``_ERROR_CODES`` is DERIVED by subtraction ...
        "unbound_retrieval",
    }
)
```
⚠ Per that comment, a code registered in `_INCOMPLETE_CODES` must ALSO be in `_ROUTE_ASSIGNED_CODES`, or `_severity` logs a warning on every canvas edit. (UI-SPEC E.2 says `error`, but D-45 overrides it; see the header.)

**Publish stage 2** (`publish_service.py:177-191`) already calls `lint_workflow(definition, tool_schemas=tool_schemas)`, so it needs **zero edits** for D-12. The `verdictModel.ts` `BLOCKED_SENTENCE` (`:182`) gains a `lint:` key. It is a pure `Record<string,string>`; copy the `judge:` / `draft_changed:` entries.

---

### Plan 3, run-start refusal (D-13 / D-45): `workflow_kickoff.py`, `scheduler_service.py`, `template_asset_service.py`

**Refusal shape** (`workflow_kickoff.py:229-243`):
```python
        if _status not in ("published", "draft"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow is not runnable",
            )
```
Place the new check after `_kickoff_definition = WorkflowDefinition.model_validate(_raw_def)` (`:248`). Use `detail=<E.1 sentence>`. It refuses only when `lint_workflow` reports `no_template_bound` **and** no staged template exists.

**Staged-template predicate.** Add ONE helper next to Branch 2 (`template_asset_service.py:209-226`), with the same WHERE clause so the predicate cannot drift (Pitfall 9: a chat attachment with `expires_at NULL` never counts):
```sql
        FROM workspace_files
        WHERE thread_id = $1 AND created_by = $2 AND kind = 'template_input'
          AND (expires_at IS NULL OR expires_at > now())
          AND (expires_at IS NOT NULL OR $3::text IS NULL OR $3::text = 'deep')
          AND (run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)
```
Better still, have `resolve_template_source`'s Branch 2 and the new helper share one SQL constant. ⚠ `preflight_workflow_kickoff`'s docstring notes that test_147 asserts exactly ONE DB call on the refused-launch path. The new check must run after that path's single SELECT, or must not add a call on the refusal arm `test_147` drives.

**Scheduler.** `launch_scheduled_run` (`scheduler_service.py:54`) refuses with the same sentence, recorded through `record_schedule_outcome` (`:251, :340`). A scheduled run has no thread-staged template, so only the definition asset counts.

---

### Plan 3, the judge note (D-15 / D-16 / D-47): `validator_kinds.py`

**Analog: the same function's `field_map` append arm** (`validator_kinds.py:190-202`):
```python
    if not isinstance(output, dict):
        return str(output or "")
    graded = output.get("text") or ""
    fm = output.get("field_map")
    if fm:
        graded = (
            f"{graded}\n\n--- FILLED DELIVERABLE (each cell: value + its source citation) ---\n"
            f"{_render_field_map_for_judge(fm)}"
        )
    of = output.get("output_file")
    if of:
        graded = f"{graded}\n\n[deliverable file: {of.get('filename') or of.get('path')}]"
    return graded
```
Add one `ri = output.get("recorded_intent")` arm in the same style, a module-level `_RECORDED_INTENT_NOTE` constant (RESEARCH §E), and the full `ri["inputs"]` rendered in a delimited DATA block (T-102-03-02). Keep the validator message strings at `:289-343` byte-identical; `test_185_detection.py`, `test_validator_kinds.py` and `test_260828_09_*` pin them. The byte-identical-without-`recorded_intent` pin goes in the new `test_295_judge_recorded_intent.py`.

---

### Plan 3, D-14 (one expression): `harness_engine.py:1186-1190`

```python
        await write_audit(
            pool, run_id, user_id=_audit_user_id, event_type="gate_failed",
            metadata={"phase": phase.slug, "attempt": attempt, "error": cause,
                      "validator_error": gate.error_message},
        )
```
→ `"validator_error": cause if diagnosed else gate.error_message`. Re-pin `tests/unit/test_281_engine_cause_precedence.py:136` (`assert all(row["validator_error"] == VALIDATOR_TEXT for row in gate_rows)`) **deliberately, with a reason in the test body** (the SEED-177 retire-by-name rule).

---

### Plan 4, truthful ends: `publish_service.py` golden `finally`, `run_producer.py` F2, `run_reconciler.py`

**Golden `finally`** (`publish_service.py:1758-1789`) finalises only the `runs` shell via `finalize_run(...)`. Add ONE `finish_run(pool, run_id, …)` + `run_failed` audit when the `workflow_runs` row is still non-terminal. Use the guarded-UPDATE posture of `_fail_redrive` (above). Its own comment rule applies: "shell cleanup never masks the run's own outcome" (`except Exception: logger.warning(...)`).

**F2 audit** (`run_producer.py:366-385`). Inside the same `try`, after `_finish_wf(...)` writes `"failed"`, add `write_audit(..., event_type="run_failed", metadata={"reason": <composed words>})`, but **only when this call won the terminal write** (first-terminal-wins, `finish_run` guard `db/workflows.py:2351`). ⚠ `run_producer.py` is FIRING (ledger: "honoured by construction (282-01: ONE `_timed_out_error` helper)"), so this is ONE helper call.

**Reconciler sweep (D-21).** Analog: `_reconcile_chat_runs` (`run_reconciler.py:201-253`):
```python
    try:
        rows = await pool.fetch(
            "SELECT run_id, thread_id, started_at FROM runs WHERE status = ANY($1::text[])",
            statuses,
        )
    except Exception:
        logger.exception("reconcile: runs non-terminal query failed (app continues)")
        return 0
    flipped = 0
    for row in rows:
        run_id = row["run_id"]
        try:
            if not await _is_chat_orphan(...):
                continue  # too young OR fresh stream → live-but-quiet (never false-kill)
            await finalize_run_terminal(...)
            flipped += 1
        except Exception:
            logger.exception("reconcile: failed to terminalize chat run %s", run_id)
    return flipped
```
New `_reconcile_workflow_runs(pool)`: SELECT `workflow_runs` with `status='active'` where NOT EXISTS a non-terminal `workflow_phases` row **and** an age guard (the `grace_ms` idiom). Then finalise through `finish_run` + `run_failed` (reason `Finalised by the reconciler: its steps had ended.`), and expire pending prompts via the existing `_expire_pending_ask_user`. Wire it into `reconcile_orphaned_runs` (`:136-143`) as one more `flipped += await …` line under the same `SET NX` lock. ⛔ SEED-297: never write NULL totals (ledger section `run_reconciler.py`). `finish_run` does not touch usage columns, so do not use `finalize_run`.

---

### Plan 4, end reason on the run page / evidence (D-22): `RunEndReasonLine.tsx` NEW, `WorkflowRunPage.tsx` ONE mount

**Analog leaf** (`WaitingOnLine.tsx`, whole file):
```tsx
import type { WorkflowRunWaitingOn } from "@/lib/api/workflows"
export function WaitingOnLine({ waitingOn }: { waitingOn?: WorkflowRunWaitingOn | null }) {
  if (!waitingOn?.sentence) return null
  return (
    <span className="text-xs font-medium text-[hsl(var(--warning))]" data-testid="run-waiting-on" ...>
      {waitingOn.sentence}
    </span>
  )
}
```
Mount it once after `WorkflowRunPage.tsx:1302` (`<WaitingOnLine waitingOn={run?.waiting_on} />`). Words: `whyItStopped` (`evidenceVocabulary.ts:169`) + new `NO_REASON_RECORDED`. **Wire field analog:** 288 `waiting_on: WorkflowRunWaitingOn | None = None` on `WorkflowRunRead` (`api/workflow_runs.py:404-408`), with its "DECLARED here … PRODUCED by `_read_waiting_on`: the same lockstep" comment. Add `end_reason: str | None = None` there and on `RunEvidenceRun` (`workflow_run_evidence.py:71-81`). Normalise whitespace to `None` (the `threads.py:2349-2351` rule).

---

## Shared Patterns

### One optional field, populated, never merely declared
**Source:** `api/workflow_runs.py:1131-1137` ("214 — POPULATED, not merely declared. A field this loop declares and never passes ships `null` on every row").
**Apply to:** `unsourced`, `end_reason`, `engine_pause`. Every declared wire field needs a populate site and a test that drives a non-null value through the real serializer.

### Server builds the sentence; the leaf renders text children
**Source:** `WaitingOnLine.tsx` header; `PendingAskCard` renders `ask.prompt` / `ask.options` verbatim.
**Apply to:** pause prompt/options, `continued_by`, end reason, the template sentence. The never-say list (UI-SPEC copy contract) becomes a content sweep test.

### Exact-label allow-list on every answer (T-185-04-01)
**Source:** `_is_abort_choice` / `_ABORT_LIKE_CHOICES` (`harness_engine.py:1349-1352`) and the `test_ask_user_disposition.py` invariant.
**Apply to:** the engine-ask consume. An unmatched answer re-asks (stays paused) and is never a proceed. The locked re-check uses the live definition.

### First-terminal-wins with a guarded single UPDATE
**Source:** `_fail_redrive` (`api/runs.py:569-620`, 289-REVIEW WR-02); `finish_run` (`db/workflows.py:2351`); `pause_run`'s `NOT IN ('completed','failed','cancelled')` guard.
**Apply to:** `_resume_run`, sweep-load-fail, golden `finally`, F2 audit, reconciler sweep.

### G-5 arithmetic claim
**Source:** ledger 289-02 "`ast.If` 113 → 113, defs 55 → 55"; 289-01 "`useState` 7 → 7, `useEffect` 2 → 2"; 256-05 per-function AST table.
**Apply to:** every FIRING file below. Record before/after counts in the SUMMARY and the ledger section in the same commit.

### Content assertions, not testid presence
**Source:** memory `reference_presence_assertions_cannot_see_content_drift`; UI-SPEC B.2 binding rule.
**Apply to:** every frontend test for `Unsourced`, `continued by`, the note sentence, `No reason was recorded when this run failed.`

---

## G-5 one-touch constraints (from `docs/HOT-FILE-LEDGER.md` + CLAUDE.md FIRING table)

| File | Triple at last row | Ledger constraint / named seam | This phase's one touch |
|---|---|---|---|
| `harness_engine.py` | 62/25/3396 FIRES | seam owed: `run_workflow` loop vs `_run_phase_with_gates` vs armed block; 286 forecast: "a new branch … is the signal to propose extraction FIRST" | Plan 1 = the move (seam taken). After it: the re-import, one consume call, `_resume_run` terminalize, the D-14 expression. Plans touching it run serially |
| `harness/phase_types.py` | 57/29/3050 FIRES, G-5 OWED | 289-02: one dict entry per executor, branching in a helper module | `_prior_output_text` helper (D-11). The scope override is a second expression; count both or route through ctx |
| `harness/grounding.py` | 21/8/1414 | honoured by construction | ONE pure predicate |
| `harness/validator_kinds.py` | 15/7/791 | stale row; honoured by construction | ONE arm in `_judge_graded_text` |
| `harness/publish_service.py` | 31/14/2001 | 288-02: checks in existing seams | golden `finally` terminalize only (stage 2 needs 0 edits) |
| `run_reconciler.py` | 3/2/325 (row exists, ⛔ SEED-297) | never NULL totals | ONE sweep function + one call line |
| `run_producer.py` | 23/11/1145 | 282-01 one helper | ONE audit call in F2 |
| `PendingAskCard.tsx` | 19/10/1052 FIRES | seam: answer form vs countdown vs submit vs retirement; hooks 7/3 | ONE field via ONE helper + ONE leaf mount; `useState`/`useEffect` unchanged |
| `WorkflowRunPage.tsx` | 33/13/1594 | 289-04: ONE early return | ONE mount |
| `PhaseCard.tsx` | 18/12/796 | 281-03 one copy entry | ONE mount |
| `RunSpine.tsx` | 6/4/433 | 289-02 ONE mount | ONE prop |
| `api/workflow_runs.py` | 17/12/1295 | 289-02 field / 289-05 | `unsourced` + `end_reason` + `window_passed` expr: three touches. Justify or split the populate into a helper |
| `api/threads.py` | 271/91/2544 ⛔ | 279-02 ONE org helper | ONE field kwarg |
| `StreamsProvider.tsx` | 109/42/5004 ⛔ | 287-03 ONE passthrough | ONE field ×2 mappers (one concern) |
| `types/index.ts` | 100/79/1656 | seam OWED | `Phase.unsourced` **and** `PendingAsk.engine_pause`: two fields, the latter not in the UI-SPEC budget. Record it |
| `db/workflows.py` | 54/28/2767 | 289-01 two SQL casts | ONE writer + `pause_run` `claimed_at = NULL` |
| `api/runs.py` | 45/20/1845 | 289 WR-06 | ONE body field |
| `api/workflows.py` | 45/23/1647 split OWED | 286-01 seam taken | ONE code in two sets |
| `models/thread.py` | 22/15/537 | — | ONE field |
| `lib/api/workflows.ts`, `lib/api/threads.ts` | 10/10/1129, 16/10/1935 | additive types | ONE field each |
| `scheduler_service.py`, `workflow_kickoff.py`, `template_asset_service.py` | 6/3/421, 8/6/554, 4/3/344 | — | ONE refusal / ONE helper |
| **No row (add row + section in the same commit):** `api/panel.py` (5 commits), `harness/scope.py` (9), `ask_user_service.py` (5), `harness/human_input.py` (row count 1, re-derive) | | `check-hot-file-ledger.cjs` reports `[no-row]` | |

---

## Tests (extend vs new)

**New (Wave 0, RESEARCH test map):** `backend/tests/unit/test_295_engine_ask_seam.py` (copy `test_278_pure_move.py`), `test_295_engine_ask_pause.py`, `test_295_found_nothing_choices.py`, `test_295_prior_output_answer.py`, `test_295_template_lint.py`, `test_295_judge_recorded_intent.py`, `test_295_truthful_run_ends.py`; `backend/tests/test_295_engine_ask_redrive.py` (local DB, **serial**; copy the `_drive_pause` / `_sql_calls` / `_NoopRedis` harness in `backend/tests/test_200_human_gate_pause.py:140-160`).

**Extend / re-pin deliberately:**
- `tests/unit/test_281_engine_cause_precedence.py:136` (D-14, with a reason)
- `tests/unit/test_182_severity_codes.py` (lockstep)
- `tests/unit/test_200_1_deliverable_text.py` (wire set equality, `unsourced`)
- `tests/unit/test_ask_user_disposition.py` (new labels classified)
- `tests/unit/test_250_reconciler_gate.py`, `tests/test_run_reconciler.py`, `tests/test_228_cap_paused_reconcile.py` (sweep must not touch `cap_paused` totals)
- `tests/integration/test_214_argument_seams.py` (teardown fix, D-43)

**Must stay green (re-run per wave):** `tests/test_200_human_gate_pause.py`, `tests/test_harness_resume.py`, `tests/unit/test_289_redrive_failure.py`, `test_185_engine_attachment.py` (`:77` `on_failure == "fail_run"`), `test_187_armed_checkpoint_property.py`, `test_publish_service.py`, `test_288_pause_lint.py`, `test_103_lint_block.py`, `test_audit_event_registration.py` (no new audit kind), `test_189_no_egress.py`, `test_185_detection.py`, `test_validator_kinds.py`, `test_260828_09_publish_names_the_failing_step.py`, `test_198_node_vocabulary.py:130-139`, `test_289_run_evidence.py`, `test_289_evidence_contract.py`.

**Frontend:** extend `components/workflows/StepEvidenceLine.test.tsx`, `RunSpine.test.tsx`, `RunEvidenceReport.test.tsx`, `evidenceView.test.ts`, `WaitingOnLine.test.tsx` (copy for `RunEndReasonLine.test.tsx`), `verdictModel.test.ts`; `components/panel/__tests__/PendingAskCard.test.tsx`, `PendingAskCard.paused.test.tsx`, `PendingAskCard.retired.baseline.test.tsx`, `PendingAskStack.oneInput.test.tsx`; `components/panel/PhaseCard.test.tsx`; `pages/WorkflowRunPage.test.tsx`. ⚠ `pages/__tests__/__snapshots__/WorkflowRunPage.seam286.pin.test.tsx.snap` and `WorkflowBuilderPage.seam286.pin.test.tsx.snap` are **modified in the working tree** at mapping time. Establish base before any run-page change.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `run_reconciler._reconcile_workflow_runs` (new function) | service | batch | The reconciler has never touched `workflow_runs`. The chat sweep gives the loop and lock shape, but the oracle ("every phase terminal + age guard") has no precedent. Use RESEARCH D-21 / Pitfall 2 |
| `AskFolderChoice.tsx` | component | — | Every shipped folder picker fetches the whole folder list client-side (UI-SPEC A.3), so only the Select *pattern* is reused |

## Metadata

**Analog search scope:** `backend/app/services/{harness_engine.py, harness/*, run_*.py, workflow_kickoff.py, scheduler_service.py, template_asset_service.py, tool_dispatcher.py}`, `backend/app/{api,db,models}/`, `backend/tests/{unit,integration,.}`, `frontend/src/{components/panel,components/workflows,components/health,pages,providers,lib/api,types}`, `docs/HOT-FILE-LEDGER.md`
**Files scanned:** ~40 read or grepped at HEAD `fc4226ecf`
**Pattern extraction date:** 2026-10-20
