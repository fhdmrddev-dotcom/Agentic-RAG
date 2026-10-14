# Phase 281: A Refusal Names Its Cause - Pattern Map

**Mapped:** 2026-10-14 (phase base `afbc643df` / research base `ae7928a92`)
**Files analyzed:** 27 (4 new source/test leaves, 15 modified source files, 8 test files new or re-pinned)
**Analogs found:** 27 / 27 (every file has an in-repo analog, and 21 are exact role+flow matches)

> Amendments D-24..D-31 in `281-CONTEXT.md` supersede D-07/D-09/D-10/D-14. Every assignment below already
> follows the amended decisions. Line numbers were re-read at the phase base. Because these are hot files,
> **re-grep each anchor before editing**; do not trust the number.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/harness/emit_cause.py` **(NEW)** | utility (pure composer leaf) | transform | `backend/app/services/harness/emit_policy.py` (pure leaf called by `_exec_llm_emit`) + `grounding._approval_sentence` (one-composer precedent) | exact |
| `backend/app/services/harness/phase_types.py` (`_exec_llm_emit`, `_emit_failure_output`) | service (executor) | request-response (forced LLM shot loop) | itself: the existing state (a)/(b) arms at `:1596-1710` | exact (in-place) |
| `backend/app/services/harness_engine.py` (`_run_phase_with_gates`, `_route_on_failure`, `_resolve_failure_with_ask_user`, `run_workflow` emit branch) | service (engine loop) | event-driven (gate retry loop) | itself: the `HumanInputTimeout` function-local import `:1080-1086` + `_approval_sentence` lazy import `:886-890` | exact (in-place) |
| `backend/app/services/harness/freshness.py` | utility (raw-SQL read) | CRUD (read) | `retrieval_documents.py` / `kb.py` (`RETRIEVABLE_COLUMN` importers) | role-match (they use supabase-py `.eq`; this is the first raw-SQL importer) |
| `backend/app/services/workflow_authoring.py` (`_check_allowed_connections`) | service | request-response | `api/connectors.py:236-258` `reason_code` beside `message` (additive machine sub-code) | role-match |
| `frontend/src/components/workflows/describeRefusalVocabulary.ts` **(NEW)** | utility (vocabulary leaf) | transform (code → words) | `frontend/src/components/workflows/publishRefusalVocabulary.ts` (`Record<Kind,…>` table + next-step table) | exact |
| `frontend/src/components/workflows/describeRefusalVocabulary.test.ts` **(NEW)** | test | — | `runVocabulary.test.ts` (whole-table properties, read off the module) + `publishRefusalVocabulary.test.ts` | exact |
| `frontend/src/lib/api/knowledge.ts` (`GenerateResult`) | model (wire type) | request-response | `PublishVerdict.blocked_step?` at `:581-587` (optional additive field) | exact |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | hook | request-response | itself `:621-629` (`setErrorState` both arms) | exact (in-place) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` (error arm `:2176-2189`) | component (page) | request-response render | `ProblemsTray.tsx:303-308` (sentence + `showTechnical` mono code) | exact |
| `frontend/src/components/workflows/PublishGauntlet.tsx` (`RunLink`, props) | component | event-driven (navigation) | `history/RunLogPanel.tsx:74-80, 277-293` (`onOpenRun?` prop presence) | exact |
| `frontend/src/pages/WorkflowsPage.tsx` (`renderPublish`, `WorkflowDoorSwitch` mount) | component (page host) | event-driven | itself: `backToLibrary` guard `:794-801`, `RunLogPanel onOpenRun` `:842` | exact (in-place) |
| `frontend/src/components/layout/ChatLayout.tsx` (only if SEED-218 needs a nav callback) | component (layout) | event-driven | `<LibraryPage onNavigate={onNavigate} …>` `:918` + `LibraryPage.tsx:1265` | exact |
| `frontend/src/components/workflows/publishBlockedStep.ts` (`BLOCKED_STEP_NEXT`) | utility (vocabulary) | transform | itself `:166-170` + `REFUSE_NEXT` / `REFUSE_NEXT_REDISCOVER` split in `publishRefusalVocabulary.ts:125-137` | exact |
| `frontend/src/components/workflows/PublishBlockedStepCard.tsx` | component | render (verbatim server text) | itself `:86-91` | exact (className only) |
| `frontend/src/components/panel/PhaseCard.tsx` (`EMIT_FAILURE_COPY`, reason span) | component | render | itself `:222-248`, `:773` | exact (in-place) |
| `frontend/src/types/index.ts` (`EmitFailure`) | model | — | itself `:1328-1333` | exact |
| `frontend/src/components/workflows/runVocabulary.ts` (`failureClause`) | utility (vocabulary) | transform | itself `:181-194` | exact |
| `backend/tests/unit/test_281_emit_cause.py` **(NEW)** | test | — | `tests/unit/test_214_args_leaf.py` (AST leaf invariant + pure cases) | exact |
| `backend/tests/unit/test_llm_emit_executor.py` (additive SC#1 cases) | test | — | itself: `_patch_executor` fixture `:147-207`, `test_oracle_keys_reach_model_and_gate_coverage` `:829-887` | exact |
| `backend/tests/unit/test_281_engine_cause_precedence.py` **(NEW)** | test | — | `tests/unit/test_pre_post_timing.py:60-108` (patch `_execute_phase` + `run_gates` + drive `_run_phase_with_gates`) | exact |
| `backend/tests/unit/test_281_freshness_retrievable.py` **(NEW)** | test | — | `test_272_scope_resolver.py:371` (source fence) + a recording fake pool | role-match |
| `backend/tests/unit/test_214_describe_vocabulary.py` (sub-reason asserts) | test | — | itself `:182-245` (one test per `connection_not_allowed` arm) | exact |
| `backend/tests/integration/test_214_argument_seams.py` (S-7 inversion) | test (cross-language seam) | — | itself: S-1 vitest harness `:424-460` | exact |
| `frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx` (`SWEPT_SOURCES` 6→7) | test (copy fence) | — | itself `:608-685` | exact |
| `frontend/src/components/workflows/PublishGauntlet.test.tsx` (link arms) | test | — | itself `:200-235` + `ProblemsTray.test.tsx:597-627` (reveal) | exact |
| `docs/HOT-FILE-LEDGER.md` (4 new rows + sections, 3 stale rows) | config (governance) | — | `describeServiceMatch.ts` young row `:11249` + section `:7682-7686` | exact |

---

## Pattern Assignments

### `backend/app/services/harness/emit_cause.py` (NEW pure composer leaf, transform)

**Analog A, the pure sibling leaf:** `backend/app/services/harness/emit_policy.py` (211 L). It is pure, has no I/O,
and `_exec_llm_emit` calls it with a **function-local** import (`phase_types.py:1693`).

Header/imports shape (`emit_policy.py:1-54`): a long docstring states the rule, then the module is stdlib-only.
```python
"""Phase 102 (D-01 / SEED-082) — the citation_policy post-verdict disposition.
...
The function is PURE (no I/O) — the executor owns the audit receipt + the surface +
the render dispatch.
"""

from __future__ import annotations

import copy

_UNVERIFIED_MARK = "[unverified]"
_DRAFT_LABEL = "DRAFT — citations not enforced"
```
→ `emit_cause.py` follows the same shape: `from __future__ import annotations`, stdlib only, module-level word
constants (one per cause kind plus one "Check …" line per kind, D-03), and an `__all__` naming
`classify_shot`/`compose_emit_failure` (or the planner's names).

**Analog B, the one-composer contract:** `backend/app/services/harness/grounding.py:1212-1258` `_approval_sentence`.
Its docstring states the honesty rules, and the engine imports it lazily (`harness_engine.py:886-890`):
```python
        # The sentence is NEVER re-authored here. ``grounding._approval_sentence`` is the
        # one composer, its honesty rules (POSITION / IDENTITY / CONSEQUENCE, never
        # "approved" / "safe" / "proven") are asserted character-identically by a shipped
        # test, and it is the only thing needing ``len(definition.phases)``.
        from app.services.harness.grounding import _approval_sentence
```
→ Copy this docstring discipline. The never-say list is: no "fix", no promise, no "soon"/"later", no step name or
slug at the head of the string (RESEARCH anti-pattern: `step_name` stays the client's job via `nodeTitle`).

**Leaf invariant (binding, from ledger §phase_types):** the leaf must **never import `phase_types`**. The
`human_input.py:31-35` docblock states the precedent. Pin it with the AST test shape from
`test_214_args_leaf.py:48-68` (see the test assignment below).

**Input record shape (RESEARCH Pattern 1):** one JSON-safe dict per sealed shot, e.g.
`{"attempt": 2, "kinds": ["missing_fields"], "missing": ["rows"], "uncited": 0, "invented": 0}`. The kind set must
cover: `missing_fields`, `uncited`, `invented`, `narrated` (`model_failed_to_emit`, not truncated), `truncated`,
`provider_error`, plus one terminal kind each for `no_template_bound`, `render_failed`, `integrity_failed` and the
unexpected backstop, so the composer stays total. Output is plain text with `\n• ` bullets. The format is fixed in
plan 281-01's interface block, and the frontend only adds `whitespace-pre-line`.

---

### `backend/app/services/harness/phase_types.py` (executor, in-place)

**Current failure helper** (`:1329-1345`). Add the new keys here **additively**, and keep `_surfaced: True`:
```python
def _emit_failure_output(failure: str, message: str, *, field_map=None) -> dict:
    ...
    out: dict = {"text": message, "failure": failure, "_surfaced": True}
    if field_map is not None:
        out["field_map"] = field_map
    return out
```
→ Add a keyword-only `attempt_causes=None` and set `out["attempt_causes"]` when given. ⛔ Never add
`retrieved_ids`/`placeholder_keys` here (Finding 1: the validator would pass and the run would end `completed`).

**State (a) arm, which needs a record + composed text** (`:1596-1609`):
```python
            if result.get("failure"):
                # State (a): the model never emitted (after Plan 02 recovery + truncation guard).
                msg = (
                    "The model did not emit a structured field-map for the template "
                    "(it narrated prose or was truncated) and the deliverable was NOT produced. "
                    ...
                )
                await _emit_audit(ctx, event_type="emit_failed", metadata=_emit_audit_metadata(...))
                await _emit_phase_substep(ctx, phase, failure="model_failed_to_emit")  # state (a)
                await _surface_failure_message(ctx, run_id, msg, pool)
                return _emit_failure_output("model_failed_to_emit", msg)
```
→ Classify `result["failure"]`/`result["truncated"]` into `narrated` | `truncated` | `provider_error` (Pitfall 9).
Append a record, compose `msg` via the leaf (function-local import, like `:1693`), and return with
`attempt_causes=records`. The `failure` value stays `model_failed_to_emit`.

**State (b) reject arm, the taxonomy split** (`:1627-1686`). `missing_keys` is already computed per shot:
```python
            gate = check_coverage(legacy_map, retrieved_ids, placeholder_keys)
            missing_keys = [k for k in placeholder_keys if k not in gate["covered_keys"]]
            ...
            if (
                gate["uncited_value_count"] == 0
                and gate["invented_citation_count"] == 0
                and not (oracle and missing_keys)
            ):
                break  # gate passed — proceed to render
            # Rejected — per-attempt receipt, then retry-with-feedback or honest fail.
            rejected_md = _emit_audit_metadata(...)
            rejected_md["attempt"] = attempt
            await _emit_audit(ctx, event_type="emit_rejected", metadata=rejected_md)
            if retrieved_ids and attempt < _EMIT_MAX_ATTEMPTS:
                ...
                continue
            if citation_policy == "strict":
                msg = ( "The emitted field-map has uncited or invented values or is missing required "
                        "template keys — ..." )
                await _emit_phase_substep(ctx, phase, failure="citation_gate_rejected")  # state (b)
                await _surface_failure_message(ctx, run_id, msg, pool)
                return _emit_failure_output("citation_gate_rejected", msg, field_map=legacy_map)
```
→ Append the shot record immediately after `emit_rejected` (before the `continue`), so every shot is recorded.
Optionally add `rejected_md["missing_keys"] = missing_keys` (additive audit legibility, Finding 1). At the final
return, pick `template_fields_missing` when the terminal shot had `uncited == 0 and invented == 0` and only
missing keys, and keep `citation_gate_rejected` otherwise. Feed the substep the same value. The WR-06 non-strict
fallback (`:1700-1710`) keeps `citation_gate_rejected` (that path is citation-only).

**Placeholder names (D-02):** `oracle["scalars"] + oracle["collections"]` (`:1620-1621`), with `coll.col` column
misses appended at `:1632-1639`. The composer gets `missing_keys` in this oracle order. Do not re-parse the docx.

**Surface delegate stays** (`:367-377`). It is a lazy delegate to `harness_engine._surface_failure_message`. Tests
patch `phase_types._surface_failure_message`.

---

### `backend/app/services/harness_engine.py` (engine loop, in-place)

**Lazy-import rule** (`:1080-1086`). Any `app.services.harness.*` import must be function-local:
```python
    # 200 (D-10): bound ONCE here rather than per-attempt, and LAZILY — a top-level
    # import of anything under ``app.services.harness`` runs that package's __init__ →
    # ``phase_types.register_all()`` → imports back from THIS module before the registry
    # is bound (the cycle the whole package documents). ...
    from app.services.harness.human_input import HumanInputTimeout  # noqa: PLC0415
```
→ Bind `from app.services.harness.emit_cause import compose_emit_failure` the same way, next to this line. Bind
`emit_records: list = []` beside `attempt = 0; last_output = None` (`:1078-1079`).

**Gate-failed block, where precedence lands** (`:1149-1189`):
```python
        identical = output == last_output
        last_output = output

        await write_audit(
            pool, run_id, user_id=_audit_user_id, event_type="gate_failed",
            metadata={"phase": phase.slug, "attempt": attempt, "error": gate.error_message},
        )
        await _emit(redis, stream_run_id, "gate_failed",
            phase=phase.slug, attempt=attempt, error=gate.error_message,
        )

        exhausted = identical or attempt >= phase_max_retries
        if not exhausted:
            attempt += 1
            try:
                ctx.retry_feedback = (
                    f"Previous output failed validation: {gate.error_message}. Fix it."
                )
            except (AttributeError, TypeError):
                pass  # immutable stub ctx in some unit tests
            continue
        _clear_retry_feedback(ctx)
        return await _resolve_failure_with_ask_user(
            phase, gate.error_message, attempt, failed_idx,
            run_id=run_id, pool=pool, redis=redis, ctx=ctx,
            _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
            produced_output=output, is_pre=False,
        )
```
→ One rule, with no new branch family:
1. Extend `emit_records` from `output.get("attempt_causes")`.
2. Compute `diagnosed = output.get("failure") and output.get("_surfaced")` and `cause = compose(...) if diagnosed else gate.error_message`.
3. Use `cause` in the audit/SSE `error` and add `validator_error=gate.error_message` beside it in the metadata.
4. Use `cause` in `ctx.retry_feedback` (D-26, with its own test).
5. Pass `cause` plus `reason_is_final=diagnosed` to `_resolve_failure_with_ask_user`.

**Identity projection (Pitfall 4).** Replace `output == last_output` with a comparison that drops
`text`/`attempt_causes` when diagnosed. Pin it with the analog `test_harness_gates.py:200-227` (two identical
outputs give 2 executions, not 3).

**Reason prefix** (`_route_on_failure`, `:1192-1211`):
```python
def _route_on_failure(
    phase, error_message: str, attempt: int, failed_idx: int | None = None
) -> PhaseOutcome:
    disposition = _parse_on_failure(_failing_on_failure(phase, failed_idx))
    reason = (
        f"Phase {phase.phase_index + 1} ({phase.slug}) gate failed after "
        f"{attempt + 1} attempt(s): {error_message}"
    )
```
→ Add a keyword-only `reason_is_final: bool = False`, so `reason = error_message if reason_is_final else <prefix>`.
Thread it through `_resolve_failure_with_ask_user` (`:1321-1336`, which already uses keyword-only defaulted flags
`is_pre`/`is_action_risk`, the same idiom). Do the same at the ask_user variant `:1525-1527`. The default False
keeps every other caller byte-identical. `test_260828_09_*` prefix tests stay green.

**No-validator branch** (`:2512-2516`):
```python
        if _emit_failure:
            await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
```
→ Replace `str(_emit_failure)` with `compose_emit_failure(output.get("attempt_causes") or []) or str(_emit_failure)`,
using a function-local import (the `:2498-2501` `RECORDED_INTENT_KEY` lazy-import comment is the precedent).
`:2554/:2561` keep `str(_emit_failure)` as the transition metadata code.

**Do not touch** (ledger): the escape handler, `cancel_phase`, `finish_run`, and the pause arm (`:1095-1114`). The
ledger claims "honoured by construction" by AST def/call arithmetic (256-05 precedent).

---

### `backend/app/services/harness/freshness.py` (raw-SQL read, DEBT-07)

**Analog importers** (all use supabase-py, not raw SQL), e.g. `retrieval_documents.py:21, :90`:
```python
from app.services.retrieval_scope import RETRIEVABLE_COLUMN
...
        .eq(RETRIEVABLE_COLUMN, True)  # Phase 275 (D-18): an agent never resolves an archived / source-gone file
```
**The constant** (`retrieval_scope.py:75-78`). Import it and do not edit this file:
```python
# Phase 275 (D-36) — the ONE Python name for "may an agent read this document": migration 205's STORED
# generated column `retrievable` = archived_at IS NULL AND (source_state IS NULL OR source_state =
# 'live'). Every Python reader names this constant (expert_scope_statement imports it); none restates the rule.
RETRIEVABLE_COLUMN = "retrievable"
```
**Current SQL, both sites** (`freshness.py:56-63`, `:94-101`):
```python
    row = await pool.fetchrow(
        """
        SELECT max(created_at) AS newest
        FROM documents
        WHERE folder_id = ANY($1::uuid[])
        """,
        list(folder_ids),
    )
```
→ Hoist both statements to module constants built by **plain concatenation at import** (RESEARCH Code Examples),
guarded by `assert RETRIEVABLE_COLUMN.isidentifier()`. Do not use an f-string: the `test_272_scope_resolver.py:371`
idiom `re.search(r"f\"[^\"]*(SELECT|WHERE)", _SRC)` is the fence shape to reuse on this file. Keep `$N` binds only
(the module docstring's T-102-03-05 security note stays true and gains one sentence).

---

### `backend/app/services/workflow_authoring.py` (`_check_allowed_connections`, additive sub-reason)

**The three arms** (`:417-454`). Each returns the same code:
```python
        if not allowed_set:
            return {
                "ok": False,
                "error": "connection_not_allowed",
                "detail": (
                    f"phase '{phase.slug}' acts outside the app, but no connected service was "
                    "chosen for this workflow."
                ),
            }
        if connection_id is None or str(connection_id) not in allowed_set:
            return { "ok": False, "error": "connection_not_allowed", "detail": (...names a service that was not chosen...) }
        ...
        if tool_name is None or str(tool_name) not in set(actions):
            return { "ok": False, "error": "connection_not_allowed", "detail": (...uses an action that is not allowed...) }
```
**Sub-code precedent** (`api/connectors.py:236-243`): a machine sub-code rides beside the human text as its own key.
```python
        detail={
            "reason_code": CONNECTION_DISABLED_REASON,
            "message": str(exc),
        },
```
→ Add one key per arm (name at the planner's discretion, e.g. `"reason"`: `no_service_chosen` |
`service_not_allowed` | `action_not_allowed`). Hold the values as module constants so the tests import them and
do not retype them. Keep `error` and `detail` byte-identical. ⛔ No `definition`/`readiness` on a failure, and
`None` vs `[]` for `allowed` must never collapse (`:403-406`). Update the `generate_workflow_definition` docstring
(`:657-669`), which claims "NEEDS NO CLIENT CHANGE". That claim becomes false, so record the correction beside it.

**Test home:** `backend/tests/unit/test_214_describe_vocabulary.py:182-245`, which has one test per arm. Add
`assert result["<subfield>"] == <imported constant>` to each existing test.

---

### `frontend/src/components/workflows/describeRefusalVocabulary.ts` (NEW vocabulary leaf, code → words)

**Analog:** `publishRefusalVocabulary.ts`. The closed union and the compile-enforced `Record` pairing come from
`:93-102` and `:257-290`:
```ts
export type ArgumentGapKind =
  | "no_source"
  | "ask_undeclared"
  | ...
// ⚠ ADDING A SIXTH KIND IS A COMPILE ERROR until `REFUSAL_FOR_KIND` below gains its entry.
export const REFUSAL_FOR_KIND: Record<ArgumentGapKind, (facts: ArgumentGapFacts) => string> = {
  no_source: REFUSE_NO_SOURCE,
  ...
}
export const REFUSAL_NEXT_FOR_KIND: Record<ArgumentGapKind, string> = {
  no_source: REFUSE_NEXT,
  ...
  shape_unknown: REFUSE_NEXT_REDISCOVER,
}
```
→ Declare a closed union of the **known** keys: `connection_not_allowed:no_service_chosen` |
`…:service_not_allowed` | `…:action_not_allowed` | `no_authoring_model` | `could_not_generate` | `grounding_failed`.
Build a `Record<Key, {sentence, next}>` and one exported total resolver
`describeRefusal(code: string, sub?: string | null): {sentence, next}`. Only the resolver has the
unknown-code fallback, because it is the one place an untyped wire string enters.

**Import, never retype, door words** (D-24 copy fence). Use the `WorkflowBuilderPage.tsx:243-250` precedent:
```ts
import {
  DESCRIBE_CTA,
  ...
} from "@/components/workflows/doorVocabulary"
```
→ `import { SERVICES_LABEL } from "@/components/workflows/doorVocabulary"` and compose
`` `Go back, tick a service under “${SERVICES_LABEL}”, then draft again.` ``. ⛔ Do not edit `doorVocabulary.ts`
(a governed, contract-mirrored table).

**Wording (D-24 supersedes D-14):** `no_authoring_model` next = *"Ask whoever runs this workspace to set up a
drafting model."* (`config.py:1510` is env-only). `grounding_failed` = *"The draft pointed at a tool, skill or
folder this workflow can't use."* / *"Try again, or describe the work in more detail."* Fallback = *"Something
stopped the draft from being written."* / *"Try again."*

**File must exceed 1000 chars** (it joins `SWEPT_SOURCES`; the floor is at `WorkflowDoorSwitch.test.tsx:663`).
A docblock that records why each sentence is what it is clears that floor naturally.

---

### `frontend/src/components/workflows/describeRefusalVocabulary.test.ts` (NEW)

**Analog:** `runVocabulary.test.ts:1-48` docblock rules. Read words **off the module**, never retype them. Assert
whole-table properties (every key has a non-empty sentence and next, and all sentences are pairwise distinct).
Use exact-match, never substring. Add explicit cases:
- totality: every code + sub-reason resolves
- an unknown code returns the fallback, and the fallback text does **not** contain the code
- `SERVICES_LABEL` appears in the no-service next step (proves the import is used)
- none of the outputs contains `connection_not_allowed`, `no_authoring_model`, `could_not_generate` or `grounding_failed`

---

### `frontend/src/lib/api/knowledge.ts` (`GenerateResult`, wire type)

**Current** (`:766-770`):
```ts
/** The structured result of POST /workflows/generate. The route returns HTTP 200
 *  even on a FAILED generation (`ok:false`) — read the body, never throw on it. */
export type GenerateResult =
  | { ok: true; definition: WorkflowDefinitionJSON; readiness?: GenerateReadiness }
  | { ok: false; error: string; detail?: string }
```
**Analog for an optional additive field with a reason docblock:** `PublishVerdict.blocked_step?` (`:560-587`,
*"absent entirely from a pre-fix server, which is why it is optional"*).
→ Add `<subfield>?: string | null` to the `ok:false` arm only.

---

### `frontend/src/components/workflows/useTemplateFirstDraft.ts` (hook)

**Both error arms** (`:621-629`):
```ts
      } else {
        // ok:false is an HONEST failure — never a renderable broken draft.
        store.getState().setErrorState(result.error, result.detail)
      }
    } catch (e) {
      store.getState().setErrorState(
        "Couldn't generate the workflow.",
        e instanceof Error ? e.message : undefined,
      )
    }
```
→ Prefer **not** editing `builderStore.ts`, because error fields are root keys (ledger invariant: every `meta` key
reaches the wire). Store a resolvable key in `errorMessage`, e.g. `` `${result.error}:${result.<subfield>}` ``,
and resolve it on the page. ⚠ **Catch arm (D-24):** `e.message` can be an entitlement sentence
(`_core.ts:50-62` `entitlementRefusalMessage`). It must reach the screen as is, and the fallback must never hide
it. Keep `allowed_connection_ids` absent-vs-`[]` untouched. This file is a SWEPT SOURCE, so it spells no door
word.

---

### `frontend/src/pages/WorkflowBuilderPage.tsx` (error arm render)

**Current** (`:2176-2189`):
```tsx
          {builderPhase === "error" && (
            <div data-testid="generate-error" role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] text-foreground">
              <p className="font-medium">Couldn't generate — {errorMessage}</p>
              {errorDetail && <p className="mt-1 text-[12px] text-muted-foreground">{errorDetail}</p>}
              <p className="mt-1 text-[12px] text-muted-foreground">
                Nothing was saved. Adjust your description and try again.
              </p>
            </div>
          )}
```
**Reveal already in scope** (`:1334`): `const showTechnical = useTechnicalNamesOptional()?.showTechnical ?? false`.

**Render analog** (`ProblemsTray.tsx:303-308`): the sentence is always shown and the mono code only under the reveal.
```tsx
                      <span data-testid="problems-tray-message">{verdict.message}</span>
                      {showTechnical ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                          {verdict.code} · workflow-wide
                        </span>
                      ) : null}
```
(Same idiom: `StepTypePicker.tsx:511-515`.)
→ Render `describeRefusal(...).sentence`, then `.next`, then `{showTechnical && <span className="… font-mono text-[10px] …">{code}{sub ? ` · ${sub}` : ""}</span>}`.
Move the slug-bearing server `detail` behind `showTechnical` too (RESEARCH Pattern 5 / Security: info disclosure).
Honour the probe arithmetic: `useState[(<]` 21→21, `useEffect(` 7→7, `fetch(` 0→0 (ledger). Re-capture
`preDraft.baseline` `flagOff:error`/`flagOn:error` **deliberately**, with the reason written in the test file (the
193-08 precedent).

---

### `frontend/src/components/workflows/PublishGauntlet.tsx` (`RunLink` + one optional prop)

**Current** (`:379-407`):
```tsx
function RunLink({ goldenRunId }: { goldenRunId: string | null }) {
  if (goldenRunId != null) {
    return (
      <button type="button" data-testid="run-link" disabled
        title="Run view coming soon — the golden-run surface lands in a later phase (D-103-A)."
        className="mt-4 inline-flex cursor-not-allowed ... opacity-70">
        ▦ Golden run that was judged · {goldenRunId.slice(0, 8)}… (view coming soon)
      </button>
    )
  }
  return ( <div data-testid="no-run-note" ...> ... </div> )   // unchanged
}
```
Call sites are at `:1140-1141`. The props interface is `:107-130`. Its docblock idiom for an optional prop is
*"OPTIONAL AND ADDITIVE … absent ⇒ today's behaviour"* (`onRunningChange`).

**Prop-presence analog** (`history/RunLogPanel.tsx:74-80, 277-293`):
```tsx
  /**
   * Open a run. This is `ChatLayout.openRunSurface` — ...
   * Absent when the canvas layer is off, in which case rows render as plain text and offer
   * nothing to click: a dead control is worse than an absent one.
   */
  onOpenRun?: (runId: string) => void
...
                    {onOpenRun ? (
                      <button type="button" aria-label={openRunLabel(row.title)}
                        onClick={() => onOpenRun(row.runId)} ...>
                        {body}
                      </button>
                    ) : ( <div ...>{body}</div> )}
```
→ Add `onOpenRun?: (runId: string) => void` to `PublishGauntletProps` and destructure it at `:1162-1168`. In the
run arm, `if (!onOpenRun) return null`. Otherwise render an enabled button labelled
**`▦ Open the golden run that was judged ›`** (D-08: no id fragment, no "coming soon", no `title` promise) with
`onClick={() => onOpenRun(goldenRunId)}`. Pass it at both call sites. Replace the stale docblock (*"IR-02 …
deferred"*). Keep `HardWall` untouched (ledger: role-SET scan).

---

### `frontend/src/components/workflows/publishBlockedStep.ts` + `PublishBlockedStepCard.tsx` (D-28 next-step gating, pre-line)

**Current next line** (`publishBlockedStep.ts:166-170`):
```ts
export const BLOCKED_STEP_NEXT =
  "Open the trial run to see what this step actually produced, then fix that step on the canvas and publish again."
```
**Split-next precedent:** `publishRefusalVocabulary.ts:125-137` (`REFUSE_NEXT` vs `REFUSE_NEXT_REDISCOVER`, two
governed constants chosen by condition).
→ Add a second constant that does not mention opening the run, e.g. `BLOCKED_STEP_NEXT_NO_RUN`. Have the card pick
one based on a new optional `canOpenRun?: boolean` prop, passed from `PublishGauntlet` as `onOpenRun != null`.
`publishBlockedStep.ts`'s red line stays: it names no cause, validator or remedy (`:150-153`).

**Cause render** (`PublishBlockedStepCard.tsx:86-91`). Only the class changes:
```tsx
      <p data-testid="blocked-step-cause"
        className="px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-foreground">
        {blocked.cause}
      </p>
```
→ Add `whitespace-pre-line`. It stays a text child (no `dangerouslySetInnerHTML`). `publish_service.py` needs no
edit: `_REASON_PREFIX` (`:932`) does not match an unprefixed reason, so `cause = reason` (`:1035-1038`).

---

### `frontend/src/pages/WorkflowsPage.tsx` (guarded link + SEED-218 wiring)

**Existing guard** (`:787-801`):
```tsx
  const canLeaveBuilderRef = useRef<(() => boolean) | null>(null)
  ...
  const backToLibrary = useCallback(() => {
    // The guard runs FIRST and its refusal is total: ...
    if (canLeaveBuilderRef.current !== null && !canLeaveBuilderRef.current()) return
    setPageView("library")
    ...
```
**Existing pass-through precedent** (`:842`): `onOpenRun={onOpenRun}` into `RunLogPanel`, and the prop docblock at
`:244-253`.

**`renderPublish` mount** (`:942-975`): `<PublishGauntlet definitionId={draftId} onRunningChange={…} blockedReason={…} definition={…} onPublished={…} />`.
→ Add
`onOpenRun={onOpenRun ? (id) => { if (canLeaveBuilderRef.current !== null && !canLeaveBuilderRef.current()) return; onOpenRun(id) } : undefined}`.
It reuses the existing guard and adds no state. The 204-03 precedent is `+15/−0`, one prop.

**SEED-218 / D-27, `onOpenSettings` on the `<WorkflowDoorSwitch>` mount (`:895-…`).** The prop is declared at
`WorkflowDoorSwitch.tsx:205-215` and fired at `:674` (`onClick={() => onOpenSettings?.()}`). ⚠ `WorkflowsPage` has
**no navigation callback today** (its props are `folders`, `onLaunch`, `onOpenRun`), so wiring needs one new
optional prop threaded from `ChatLayout`. The precedent is `ChatLayout.tsx:918`
`<LibraryPage onNavigate={onNavigate} …>` plus `LibraryPage.tsx:1265`
`onNavigateToConnections={onNavigate ? () => onNavigate("connections") : undefined}`. `"connections"` is a real
`ActiveView` (`App.tsx:131`). The planner must decide between `"connections"` and `"settings"` against the governed
`DOOR_REFUSAL` text (*"connect it in Settings"*, `doorVocabulary.ts:534`). ⚠ This adds `ChatLayout.tsx` (a FIRING
hot file, `60 / 30 / 1134`) to `files_modified`, which RESEARCH's split did not list. Name it in the plan and read
its ledger section.

---

### `frontend/src/components/panel/PhaseCard.tsx`, `frontend/src/types/index.ts`, `frontend/src/components/workflows/runVocabulary.ts` (taxonomy follows the new value)

**Union** (`types/index.ts:1325-1333`):
```ts
export type EmitFailure =
  | "model_failed_to_emit"
  | "citation_gate_rejected"
  | "render_failed"
  | "integrity_failed"
  | "no_template_bound"
```
→ Add `| "template_fields_missing"` and update the "5 distinguishable" docblock to 6.

**Copy table** (`PhaseCard.tsx:222-248`). `Record<EmitFailure,…>` makes the new entry a typecheck requirement:
```ts
const EMIT_FAILURE_COPY: Record<EmitFailure, { reason: string; where: string }> = {
  ...
  citation_gate_rejected: {
    reason:
      "The emitted field-map had uncited or invented values — every value must cite a source that was actually retrieved. Rejected before render; the cited data is preserved.",
    where: "emit · citation gate rejected (uncited / invented)",
  },
```
→ Add a `template_fields_missing` entry whose copy does **not** contain "citation". **Reason render** (`:773`):
`<span className="text-[12px] font-semibold text-[hsl(0_80%_80%)]">{failure.reason}</span>` gets
`whitespace-pre-line` (the reconciled-run `fromRecord` arm `:357-363` renders `_failure_reason` verbatim).
`SUBSTEP_META` stays total over `EmitSubStep` (it.each-pinned).

**Exhaustive switch** (`runVocabulary.ts:181-194`):
```ts
    case "citation_gate_rejected":
    case "integrity_failed":
      return CLAUSE_FAILED_CHECKS
    default:
      return CLAUSE_FAILED_UNFINISHED
```
→ Add `case "template_fields_missing":` to the `CLAUSE_FAILED_CHECKS` group. This is a visible decision, which is
the docblock's own rule (`:174-180`). Its ledger row is missing, so add it before the plan is written (Pitfall 5).

---

### `backend/tests/unit/test_281_emit_cause.py` (NEW, leaf invariant + composer cases)

**Analog:** `tests/unit/test_214_args_leaf.py:48-68`:
```python
def test_leaf_module_invariant_does_not_import_harness():
    with open(args_mod.__file__, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())
    imported_modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module)
    for mod in imported_modules:
        assert "phase_types" not in mod, f"args.py imported phase_types: {mod}"
        assert "harness_engine" not in mod, ...
```
→ Same AST walk over `emit_cause.py`, asserting it never imports `phase_types` or `harness_engine` (drive RED with a
planted import first). Add an `__all__` exact-list test (`:71-88` idiom). Composer cases:
- merge by kind with counts
- first 5 fields + `and N more`
- one "Check …" line per kind
- "citation" appears only when an `uncited`/`invented` kind is present
- the golden-run fixture: 7 × missing `rows`, 2 × narrated, and 1 shot with 2 uncited values gives three bullets

---

### `backend/tests/unit/test_llm_emit_executor.py` (additive SC#1 executor cases)

**Fixture to reuse** (`:147-207`, `_patch_executor`). It patches `forced_emit`, `resolve_template_source`,
`write_audit` and `_surface_failure_message`, swaps the emitter, and supports a per-attempt `bag["forced_queue"]`.
**Closest case** is `test_oracle_keys_reach_model_and_gate_coverage` (`:829-887`). It builds an `EmitFieldMap` with
a wrongly named collection (`"collection": "risks"` where the template wants `"rows"`) and asserts on
`bag["forced_calls"][1]["system_prompt"]`.
→ SC#1 fixture: monkeypatch `phase_types._template_oracle` to return the measured compliance oracle
(`{'scalars': ['report_date','report_title','scope'], 'collections': ['rows'], 'columns': {'rows': [...]}}`).
Queue 3 × an `EmitFieldMap` with the scalars cited and the collection under `obligations`, all cited to ids in
`_live_shape_accumulated()`. Assert:
- `out["failure"] == "template_fields_missing"`
- `"rows" in out["text"]`
- `"citation" not in out["text"].lower()`
- `len(out["attempt_causes"]) == 3`
- `bag["surface_calls"][-1] == out["text"]` (one string)

Existing `test_citation_reject_*` (`:760-795`) keep `citation_gate_rejected` (uncited fixture).

---

### `backend/tests/unit/test_281_engine_cause_precedence.py` (NEW)

**Analog:** `tests/unit/test_pre_post_timing.py:60-108`. It needs no root conftest fixtures, so it does not hit the
`test_harness_gates` hang:
```python
    async def _fake_execute_phase(phase, accumulated, ctx):
        body_ran["value"] = True
        return {"text": "body output"}
    async def _fake_run_gates(ph, output, ctx, *, timing=None):
        from app.services.harness.validators import GateResult
        if timing == "pre":
            return GateResult(False, "freshness:staleness|stale", 0)
        return GateResult(True, None)
    ctx = SimpleNamespace(current_user={"id": uuid4()}, retry_feedback=None)
    with patch.object(harness_engine, "_execute_phase", _fake_execute_phase), \
         patch("app.services.harness.validators.run_gates", _fake_run_gates), \
         patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch.object(harness_engine, "_emit", AsyncMock()):
        outcome = asyncio.run(
            harness_engine._run_phase_with_gates(
                phase, {}, ctx,
                run_id=uuid4(), pool=object(), redis=object(),
                wall_clock=30, _audit_user_id=uuid4(),
            )
        )
    assert outcome.kind == "fail_run"
```
→ Stub `_execute_phase` to return a sequence of `_emit_failure_output(...)`-shaped dicts carrying `attempt_causes`.
Stub post `run_gates` to fail with `"citations_required: no field_map on output"`. Assert:
- `outcome.reason` == the composed string, with no `Phase N (`, no `citations_required` and no `no field_map`
- the `write_audit` mock's `gate_failed` metadata carries `error == cause` and `validator_error == <validator text>`
- `ctx.retry_feedback` carries the executor cause (D-26)
- two identical diagnosed outputs still exhaust at engine attempt 2 (identity projection)
- a non-diagnosed failure keeps the prefix (byte-identical)

D-04 twin: feed `outcome.reason` as `_failure_reason` into `publish_service._blocked_step` (the
`test_260828_09_*:150-160` shape) and assert `cause == reason == composed`.

---

### `backend/tests/unit/test_281_freshness_retrievable.py` (NEW, RED-first + non-restatement)

**Fence analog:** `test_272_scope_resolver.py:371-373`:
```python
def test_no_f_string_sql():
    assert not re.search(r"f\"[^\"]*(SELECT|WHERE)", _SRC)
    assert not re.search(r"f'[^']*(SELECT|WHERE)", _SRC)
```
→ Cases:
- a recording fake pool (`fetchrow`/`fetch` async methods appending `(sql, args)`) drives both functions and asserts `RETRIEVABLE_COLUMN` is in both captured SQL strings (RED at base)
- the `importlib.reload` sentinel test from RESEARCH Code Examples (restore in `finally`)
- the same no-f-string regex over `freshness.py`

`tests/unit/test_freshness.py` (validator-level, patches the functions) is unaffected.

---

### `backend/tests/integration/test_214_argument_seams.py` (S-7 inversion, D-15)

**Harness to copy** (S-1, `:424-460`): assert each target vitest file exists, skip if `node_modules` is absent, run
`npx --no-install vitest run <rel paths>` with `GSD_VITEST_MAX_WORKERS=2`, then require
`re.search(r"Tests\s+\d+\s+passed", out)`. That last check is the positive control against an exit 0 with zero cases.
```python
    env = {**os.environ, "GSD_VITEST_MAX_WORKERS": "2", "CI": "1"}
    rel = [str(t.relative_to(frontend)).replace("\\", "/") for t in targets]
    proc = subprocess.run(
        ["npx", "--no-install", "vitest", "run", *rel],
        cwd=str(frontend), env=env, capture_output=True, text=True, shell=(os.name == "nt"),
        timeout=900,
    )
```
**Test to invert** (`:1075-1116`): `test_S7_the_refusal_reaches_a_rendered_screen_and_the_screen_shows_the_RAW_CODE`.
→ Rename it to state the new truth. Flip `"{errorMessage}" in page` to an assertion that the page renders through
`describeRefusal`. Replace the `for vocab in (...)` absence loop (`:1110-1116`) with: the new table **does** map all
four codes, and S-7 runs `describeRefusalVocabulary.test.ts` plus the builder render test via the S-1 harness. Keep
`test_S7_the_generate_refusal_returns_the_new_code_from_the_real_service` (`:1062-1072`), and optionally extend it
to the sub-reason key.

---

### `frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx` (D-24(a) copy fence, 6 → 7)

**List + count** (`:608-615`, `:654`):
```ts
import templateFirstVocabularySource from "./templateFirstVocabulary?raw"
...
const SWEPT_SOURCES: { path: string; source: string }[] = [
  ...
  { path: "./templateFirstVocabulary.ts", source: templateFirstVocabularySource },
]
...
    expect(SWEPT_SOURCES).toHaveLength(6)
```
→ Add `import describeRefusalVocabularySource from "./describeRefusalVocabulary?raw"` with a docblock entry in the
`:589-606` style (why it joins), append the row, bump to `7` with a dated comment in the `:652-653` style, and drive
RED with a planted literal before trusting it. The `it.each` at `:704-709` then sweeps the new module
automatically.

---

### `frontend/src/components/workflows/PublishGauntlet.test.tsx` (link arms) and the builder reveal render test

**Existing link tests that must be re-pinned** (`:200-215`, `:836`) render `<PublishGauntlet definitionId="def-1" />`
with **no** `onOpenRun` and expect `run-link` present. Under D-28, these must pass `onOpenRun={vi.fn()}`. Add:
- flag-off arm: no prop, so no `run-link` and no "coming soon" anywhere (`:1509` already has a
  `not.toMatch(/coming soon|will be|shortly/i)` idiom)
- click calls the prop with the exact `golden_run_id`
- the label text equals D-08 exactly
- the next line under a missing prop does not say "Open the trial run"

**Reveal render analog** (`ProblemsTray.test.tsx:552-627`). It uses the real provider and the real toggle, with no
hand-set storage key:
```tsx
function RevealToggle() {
  const { toggle } = useTechnicalNames()
  return (<button type="button" data-testid="reveal-toggle" onClick={toggle}>technical names</button>)
}
...
    render(<TechnicalNamesProvider><RevealToggle /><ProblemsTray ... /></TechnicalNamesProvider>)
    expect(list.textContent ?? "").not.toContain(CODE)
    await userEvent.click(screen.getByTestId("reveal-toggle"))
    expect(screen.getByTestId("problems-tray-list").textContent ?? "").toContain(CODE)
```
→ Use the same shape for the builder's `generate-error` block. The code is absent with the reveal off, present with
it on, and the sentence stays in both states.

---

## Shared Patterns

### Server owns the sentence; the client renders it verbatim
**Source:** `publishBlockedStep.ts:150-153`, `PublishBlockedStepCard.tsx:82-91`, `PhaseCard.tsx:342-357`
**Apply to:** emit cause (backend composes; `PublishBlockedStepCard` and `PhaseCard` add only `whitespace-pre-line`).
The describe door is the **one** sanctioned client code→words table (SEED-221). Render as React text children,
never `dangerouslySetInnerHTML`.

### One composer, lazily imported across the harness package cycle
**Source:** `harness_engine.py:886-890` (`_approval_sentence`), `:1080-1086` (`HumanInputTimeout`), `:2498-2501`
(`RECORDED_INTENT_KEY`); `phase_types.py:1693` (`emit_policy`)
**Apply to:** every caller of `emit_cause` (executor, engine gate loop, no-validator `fail_phase` branch).

### Keyword-only, defaulted flags keep every other caller byte-identical
**Source:** `_resolve_failure_with_ask_user(..., is_pre: bool = False, is_action_risk: bool = False)` (`harness_engine.py:1321-1336`); `_approval_sentence(..., service_name=None, resolved_args=None)` (`grounding.py:1212-1248`)
**Apply to:** `reason_is_final`, `_emit_failure_output(..., attempt_causes=None)`.

### Optional prop = capability present (absent ⇒ render nothing)
**Source:** `RunLogPanel.tsx:74-80, 277-293`; `WorkflowsPage.tsx:244-253`; `ChatLayout.tsx:951-955` (`onOpenRun={canvasEnabled ? openRunSurface : undefined}`)
**Apply to:** `PublishGauntlet.onOpenRun`, `BLOCKED_STEP_NEXT` gating, `WorkflowDoorSwitch.onOpenSettings` (SEED-218).

### Technical-names reveal (one app-wide boolean)
**Source:** `useTechnicalNamesOptional()?.showTechnical ?? false` (`WorkflowBuilderPage.tsx:1334`, `StepTypePicker.tsx:211-212`); mono line `font-mono text-[10px] text-muted-foreground` (`ProblemsTray.tsx:304-308`, `StepTypePicker.tsx:511-515`)
**Apply to:** the describe-door code + sub-reason + server `detail`.

### Governed door words are imported, never retyped (D-24(a))
**Source:** `WorkflowBuilderPage.tsx:231-250` import block + comment; fence `WorkflowDoorSwitch.test.tsx:608-709`
**Apply to:** `describeRefusalVocabulary.ts` (`SERVICES_LABEL`), `WorkflowBuilderPage.tsx`, `useTemplateFirstDraft.ts`.

### Closed core and hot-file ledger
**Source:** `backend/tests/unit/test_255_extension_contract_guard.py` (7 phase types / 1 emitter / 30 tools / 10 validators); ledger young-row format `docs/HOT-FILE-LEDGER.md:11249` + section `:7682-7686`
**Apply to:** add rows **with sections, same commit, before or with the PLAN.md** (the guard hook fires at PLAN-write)
for `harness/emit_cause.py`, `harness/freshness.py`, `describeRefusalVocabulary.ts` and `runVocabulary.ts`.
Re-derive the stale rows `workflow_authoring.py` (16/10/1002), `PublishGauntlet.tsx` (19/9/1343) and
`lib/api/knowledge.ts` (4/3/812). Cell ≤ 200 chars.

## No Analog Found

None. Two files have only partial matches, noted so the planner reads RESEARCH alongside:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/app/services/harness/freshness.py` (edit) | utility | raw-SQL read | Every existing `RETRIEVABLE_COLUMN` importer uses supabase-py `.eq(...)`. This is the first raw-SQL splice, so the concatenation + `isidentifier()` form comes from RESEARCH Code Examples, not a codebase analog. |
| `backend/tests/unit/test_281_freshness_retrievable.py` | test | — | No existing unit test records SQL via a fake asyncpg pool in `tests/unit` (root `tests/conftest.py` has `mock_asyncpg_pool.calls`, but root suites are a different gate). Write a 10-line recording fake inline. |

## Metadata

**Analog search scope:** `backend/app/services/harness/`, `backend/app/services/{harness_engine,workflow_authoring,retrieval_scope,retrieval_documents}.py`, `backend/app/api/connectors.py`, `backend/tests/{unit,integration}/`, `backend/tests/test_harness_gates.py`, `frontend/src/components/{workflows,panel,layout}/`, `frontend/src/pages/`, `frontend/src/lib/api/`, `frontend/src/providers/TechnicalNamesProvider.tsx`, `docs/HOT-FILE-LEDGER.md`, `.planning/seeds/SEED-218*`
**Files scanned:** ~45
**Pattern extraction date:** 2026-10-14
**Discrepancies vs RESEARCH, for the planner:**
1. SEED-218 wiring needs a navigation callback that `WorkflowsPage` does not hold. That adds `ChatLayout.tsx` (FIRING) to the plan that owns D-27, unless the planner routes it differently.
2. Existing `PublishGauntlet.test.tsx` link tests (`:213`, `:836`) assume an unconditional `run-link`. They are deliberate re-pins under D-28 and must be recorded as such, not quietly edited.
