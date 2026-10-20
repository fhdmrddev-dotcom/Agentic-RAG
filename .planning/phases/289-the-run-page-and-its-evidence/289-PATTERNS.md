# Phase 289: The Run Page and Its Evidence - Pattern Map

**Mapped:** 2026-10-19
**Files analyzed:** 27 (11 new source, 10 modified source, 6 new/edited tests)
**Analogs found:** 26 / 27. The print block has only a weak analog.

Line numbers were re-read on 2026-10-19 at HEAD `8ade4e228`. Where RESEARCH quoted a range, the range below is the one measured today.

## File Classification

| New/Modified File | Plan | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `backend/app/db/workflows.py` (2 tokens) | 01 | db query | request-response | itself, `:1731` and `:2329` | exact (in-place fix) |
| `backend/app/api/runs.py` (`_fail_redrive` + guard move) | 01 | controller helper | event-driven (background task) | `harness_engine.py:2460-2469` fail_run arm | exact |
| `frontend/src/components/panel/PendingAskCard.tsx` (`paused?` prop) | 01 | component | request-response | itself, `hasDeadline` / `NO_DEADLINE_WAITING_LINE` arm `:336-359, :618-629` | exact |
| `frontend/src/pages/WorkflowRunPage.tsx` (P1 prop, P3 early return) | 01 + 03 | page | request-response | itself, `:1135-1157` load-screen early return; `:1539-1551` card mount | exact |
| `backend/app/services/harness/phase_confidence.py` (new) | 02 | pure service helper | transform | `harness_engine._finalize_run_grounding` `:341-389` | exact |
| `backend/app/services/task_service.py` (`kb_search_calls`) | 02 | service | transform (accumulate) | itself, F7 harvest `:798-808` + return `:1000-1010` | exact |
| `backend/app/services/harness/phase_types.py` (one key ×2) | 02 | executor | transform | itself, `:924-938` and `:1055-1061` | exact |
| `backend/app/api/workflow_runs.py` (`confidence` field; P4 string) | 02 + 04 | wire model + serializer | request-response | itself, `:102-150` model, `:1027-1084` serializer | exact |
| `frontend/src/lib/api/workflows.ts` (optional type field) | 02 | api types | request-response | itself, `WorkflowRunPhaseRead` type | exact |
| `frontend/src/components/workflows/StepEvidenceLine.tsx` (new) | 02 | leaf component | render | `WaitingOnLine.tsx` (leaf shape) + `ConfidenceChip.tsx` (028 anatomy) | role-match ×2 |
| `frontend/src/components/workflows/evidenceVocabulary.ts` (new) | 02 | vocabulary | static | `receiptVocabulary.ts` | role-match (note the glyph rule) |
| `frontend/src/components/workflows/RunSpine.tsx` (one leaf mount) | 02 | component | render | itself, `spine-ask` slot `:410-414` | exact |
| `backend/app/api/workflow_run_evidence.py` (new) | 03 | controller | request-response | `api/workflow_runs.py` read_workflow_run `:852-910` + `runs.py:618-631` pool fetchrow | exact (composite) |
| `backend/app/services/run_evidence.py` (new) | 03 | pure composer | transform | `workflow_runs.py:1027-1084` + `:1214-1239` | role-match |
| `backend/app/main.py` (one `include_router`) | 03 | config | — | `main.py:897` | exact |
| `backend/app/middleware/canvas_gate.py` (one member) | 03 | config | — | `canvas_gate.py:103-107` | exact |
| `frontend/src/lib/api/runEvidence.ts` (new) | 03 | api client | request-response | `lib/api/workflows.ts:768-816` | exact |
| `frontend/src/lib/runDeepLink.ts` (new) | 03 | utility | boot-time read | `App.tsx:155-167` `?connections=1` read | exact |
| `frontend/src/components/workflows/RunEvidenceReport.tsx` (new) | 03 | page-level component | request-response + file download | `WorkflowRunPage.tsx:1126-1157` (load/missing screens) + `AuditTab.tsx:222-233` (download) | role-match |
| `frontend/src/components/workflows/evidenceView.ts` (new) | 03 | pure view-model | transform | `receiptVocabulary.ts` composed-reading functions | partial |
| `frontend/src/App.tsx` (initializer seed) | 03 | app shell | boot-time read | `App.tsx:155-167` | exact |
| `frontend/src/components/layout/ChatLayout.tsx` (`activeRunId` seed) | 03 | layout | state seed | `ChatLayout.tsx:304` | exact |
| `frontend/src/index.css` (one `@media print`) | 03 | style | — | `docs/docs.css:408-410` | weak |
| `backend/tests/test_289_ask_user_sql.py` (new, DB-backed) | 01 | test | DB integration | `tests/integration/test_284_resolve_live.py:30-70` | exact |
| `backend/tests/unit/test_289_redrive_failure.py` (new) | 01 | test | unit, fake pool | `tests/test_200_human_gate_pause.py:378-456` | exact |
| `backend/tests/unit/test_289_run_evidence.py`, `test_289_phase_confidence.py` (new); `test_200_1_deliverable_text.py` (edit) | 02/03 | test | unit | `test_214_argument_seams.py:305-319` (direct coroutine call); `test_200_1_deliverable_text.py:118-137` | exact |
| `StepEvidenceLine.test.tsx`, `RunEvidenceReport.test.tsx`, `PendingAskCard.paused.test.tsx` (new) | 01-03 | test | vitest | `WaitingOnLine.test.tsx`; `panel/__tests__/PendingAskCard.test.tsx:1-41` | exact |

---

## Pattern Assignments

### `backend/app/db/workflows.py`: the SEED-360 SQL fix (plan 01)

**In-place, two tokens.** The `ask_user_response_exists` SQL is at `:1720-1740`; the token is at **`:1731`**. The `get_ask_user_response` SQL is at `:2319-2337`; the token is at **`:2329`**.
```sql
-- :1731 and :2329, inside the JOIN ... ON clause
         AND p.tool_calls->0->>'run_id' = $1::text        -- before: types $1 as text, then WHERE wr.id = $1 is uuid = text
         AND p.tool_calls->0->>'run_id' = $1::uuid::text  -- after
```
Do not touch anything else in either statement. The docstrings at `:1711-1718` and `:2304-2317` describe the WR-06 run-scoping that this fix keeps.

---

### `backend/app/api/runs.py`: `_fail_redrive` + guarded `_build_resume_context` (plan 01)

**Analog for the failure writers:** `harness_engine.py:2460-2469` (the `fail_run` arm). It uses the same three existing writers in the same order:
```python
await fail_phase(pool, phase_id, outcome.reason)
await finish_run(pool, run_id, "failed")
await write_audit(
    pool, run_id, user_id=_audit_user_id,
    event_type="run_failed", metadata={"reason": outcome.reason},
)
```
Writer signatures (`db/workflows.py`):
- `get_active_phase(pool, run_id) -> dict | None` (`:1672`)
- `fail_phase(pool, phase_id, reason, output=None)` (`:1961`)
- `finish_run(pool, run_id, status)` (`:2351`)
- `write_audit(pool, run_id, *, user_id, event_type, metadata)` (`:2511`). ⚠ `user_id` is **keyword-only and NOT NULL**. Pass the run owner `row["user_id"]` from the re-drive SELECT (`runs.py:619-631`).

**The two holes to close** (`runs.py:648-662`):
```python
await resume_run(pool, run_id)                       # :651  paused -> active
ctx = await _build_resume_context(dict(row), redis, pool)   # :653  OUTSIDE any guard (hole 2)
ctx.resume_answered_tool_call_id = tool_call_id

async def _wake():
    _failed = False
    try:
        await _resume_run(run_id, definition, ctx, pool=pool, redis=redis)
    except Exception:
        _failed = True
        logger.exception("ask_user_response: re-drive failed for run %s", run_id)   # :662  logs only (hole 1)
    finally:
        ...  # producer-shell finalize, :663-707. Keep it byte-identical.
```
**Conventions to keep:**
- Lazy imports inside the function body with `# noqa: PLC0415` (`:610-616`).
- "No path raises" (docstring `:575-578`). The helper must itself be wrapped so that a failing `fail_phase` never turns a recorded answer into a non-200.
- Log identifiers only, never token values (`:685-692`, T-256-14).
- `write_audit` validates `event_type` against `_AUDIT_EVENT_TYPES` (`:2555-2563`). `run_failed` is already registered.

---

### `frontend/src/components/panel/PendingAskCard.tsx`: `paused?: boolean` (plan 01)

**Analog: the card's own no-deadline arm.** That arm already makes the `remaining <= 0 → expired` transition unreachable and swaps the clock for a calm line. `paused` should copy this exactly.

Props register (`:217-226`). Every optional prop has a docblock saying it defaults so that existing callers stay byte-identical:
```tsx
  /** ⚠ OPTIONAL, defaulting to `false` — so every existing caller renders exactly
   *  the card it rendered before this prop existed. ... */
  runIsOver?: boolean
```
Destructure with a default (`:286-295`): `runIsOver = false, ...`. Add `paused = false` the same way.

The transition to gate (`:345-359`):
```tsx
useEffect(() => {
  if (!hasDeadline) return            // <- add `|| paused` here (same early-return shape)
  if (state !== "pending") return
  if (remaining <= 0) {
    setState("expired")
    markSettled(tool_call_id)
    return
  }
  const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
  return () => clearTimeout(t)
}, [remaining, state, hasDeadline, markSettled, tool_call_id])
```
The clock slot and calm line to mirror (`:618-629`):
```tsx
{hasDeadline && (
  <span className="ml-auto text-[hsl(var(--muted-foreground-dim))]">{formatClock(remaining)}</span>
)}
{!hasDeadline && (
  <p className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground-dim))]">
    {NO_DEADLINE_WAITING_LINE}
  </p>
)}
```
The string being retired for paused runs is at `:574-577` (`No response within … — agent stopped`). Put the new paused sentence in a module-level constant beside `NO_DEADLINE_WAITING_LINE`, not as a JSX literal.

---

### `frontend/src/pages/WorkflowRunPage.tsx`: two touches (plans 01 and 03)

**P1, one prop at the single card mount** (`:1539-1551`). Thread it from the `runStatus` the page already holds (it is passed to the spine at `:1530`):
```tsx
<PendingAskCard
  key={ask.tool_call_id}
  ask={ask}
  reconcile={reconcileAsks}
  runIsOver={isTerminal}
  // + paused={runStatus === "paused"}
  action={actionOf(askAnchorSlug ?? "")}
  ...
```
**P3, the early return.** It sits **after every hook**, in the existing load-screen block (`:1126-1157`). Copy the shape of the `missing`/`broken` return; the evidence branch goes before it:
```tsx
if (!runId || loadPhase === "loading") { return (/* COPY_LOADING */) }      // :1126
if (loadPhase === "missing" || loadPhase === "broken") {                     // :1135
  const missing = loadPhase === "missing"
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <h1 className="font-headline text-xl font-semibold text-foreground">…</h1>
      <p className="max-w-md text-sm text-muted-foreground">…</p>
      … <Button variant="ghost" size="sm" onClick={onBack}>{COPY_BACK}</Button>
    </div>
  )
}
```
Insert `if (runId && (loadPhase === "missing" || (loadPhase === "ready" && run && isTerminal))) return <RunEvidenceReport … />` **before** `:1135`. The `missing` arm stays reachable only for `broken`.

⚠ G-5: no new `useState`/`useEffect` here. Count them before and after (288-03 precedent).

---

### `backend/app/services/harness/phase_confidence.py` (new, plan 02)

**Analog:** `harness_engine._finalize_run_grounding` (`:341-389`). It shows the lazy import, the cycle reason and the dict shape:
```python
    Deep helpers are lazy-imported (agent_loop imports this package transitively; a
    top-level import risks the same cycle phase_types breaks lazily).
    """
    from app.services.agent_loop import (
        CONFIDENCE_DISCLAIMER,
        _compute_confidence,
        _deduplicate_citations,
    )
    ...
    final_confidence: dict | None = None
    if run_similarity_scores:
        final_avg = sum(run_similarity_scores) / len(run_similarity_scores)
        level = _compute_confidence(final_avg)          # ⚠ NO settings here: default buckets (RESEARCH F3)
        disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
        final_confidence = {"level": level, "avg_similarity": round(final_avg, 4), "disclaimer": disclaimer}
```
**Chat's call, which the new helper must match (SC#5)** (`agent_loop.py:3546-3552`):
```python
if similarity_scores:
    final_avg = sum(similarity_scores) / len(similarity_scores)
    level = _compute_confidence(final_avg, user_settings)   # <- WITH user_settings
    disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
```
`_compute_confidence(avg_similarity, settings_obj=None, bucket_high=None, bucket_medium=None)` (`agent_loop.py:949-985`) reads `confidence_bucket_high` / `confidence_bucket_medium` off `settings_obj` with `getattr`, so `ctx.user_settings` passes straight in.

New-file shape: RESEARCH Pattern 3 (lines 238-250 of 289-RESEARCH.md). It returns `None` when not searched, `{"level":"none", …}` when searched with zero scores, else chat's dict.

---

### `backend/app/services/task_service.py`: `kb_search_calls` (plan 02)

**Analog:** the F7 accumulator in the same loop.
- Declarations `:736-739`:
  ```python
  sub_source_refs: list[dict] = []
  sub_citations: list[dict] = []
  sub_similarity_scores: list[float] = []
  sub_retrieval_error: dict | None = None
  ```
  Add `sub_kb_search_calls = 0`.
- Harvest `:798-808`. It is per tool call, inside `for idx, tc in enumerate(tool_calls)`, after `tr = await dispatch_tool(tc.get("name") or "", parsed_args, sub_ctx)` (`:788`). Increment it when `tc.get("name") == "search_documents"`.
- Return `:1000-1010` is an additive key, the same argument as the F7 comment at `:979-984`: `"retrieval_error": sub_retrieval_error,` then `+ "kb_search_calls": sub_kb_search_calls`.

---

### `backend/app/services/harness/phase_types.py`: one key on two returns (plan 02)

`_exec_llm_agent` return (`:924-938`):
```python
    return {
        "text": result["summary"],
        "sub_run_id": str(result["sub_run_id"]),
        "source_refs": agent_source_refs,
        "citations": result.get("citations") or [],
        "similarity_scores": result.get("similarity_scores") or [],
        "retrieval_error": result.get("retrieval_error"),
        # + "confidence": phase_confidence(result.get("similarity_scores"),
        #                                  bool(result.get("kb_search_calls")),
        #                                  getattr(ctx, "user_settings", None)),
        **_measure(len(agent_source_refs), "sources"),
    }
```
`_exec_llm_batch_agents` return (`:1055-1061`) builds `batch_similarity_scores` at `:1043-1049`. Use `any(r.get("kb_search_calls") for r in results)` for `searched`.
⚠ G-5 OWED file: +0 `If`, +0 `def`. Import the helper lazily inside the function or at module top. The helper owns the branching.

---

### `backend/app/api/workflow_runs.py`: `confidence` on `WorkflowRunPhaseRead` (plan 02) + sentence (plan 04)

**Lockstep rule** (`:131-136`): the model field, the projection and the serializer move together, because `response_model` drops undeclared keys silently.

Model (`:102-150`): add `confidence: dict | None = Field(default=None, description=…)` in the `Field(description=…)` register used by `started_at`.

Serializer (`:1027-1084`). Read the field **off the same single parse**, by name:
```python
obj = phase_output_object(row.get("output"))                 # :1034 — the ONE door
...
raw_reason = obj.get("_failure_reason") if isinstance(obj, dict) else None   # :1050 — the by-name read idiom
...
phases.append(WorkflowRunPhaseRead(slug=row["slug"], ..., service_name=service_name))   # :1062-1083
```
Add `confidence=` here. A field that is declared but never passed ships `null` everywhere; see the warning at `:1074-1079`.

**Fence to edit in the same commit:** `tests/unit/test_200_1_deliverable_text.py`
- `_EXPECTED_PHASE_KEYS` (`:118-132`): add `"confidence"`. It is set equality, so do not relax it to a superset.
- `_ALLOW_LISTED_OUTPUT_KEYS = {"text", "_failure_reason"}` (`:137`): add `"confidence"`.

**Plan 04 sentence restore** (`compose_waiting_on`, `:781-782`):
```python
    if window_passed:
        sentence = f"Still waiting on {who}."
```
Change it only after S5 is driven green, and update `test_288_waiting_on.py` in the same commit.

---

### `backend/app/api/workflow_run_evidence.py` (new, plan 03)

**Analog A, module conventions:** `api/workflow_runs.py:51-99`.
```python
from __future__ import annotations
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.dependencies import canvas_caller, require_canvas
from app.models.thread import phase_output_object, step_identity, declared_phase_measure
from app import dependencies as deps        # module import, NOT `from … import get_pg_pool` (binds None at import; reason at api/admin.py:243)

router = APIRouter(prefix="/workflow-runs", tags=["workflow-runs"])
```
**Analog B, the route decorator and auth** (`workflow_runs.py:852-865`):
```python
@router.get(
    "/{workflow_run_id}",
    response_model=WorkflowRunRead,
    # D-182-05 / D-188-16 — this list holds require_canvas ALONE. The 403-raising visibility
    # gate must never join it (a 403 leaks the route's existence)
    dependencies=[Depends(require_canvas())],
)
async def read_workflow_run(
    workflow_run_id: UUID,
    current_user: dict = Depends(canvas_caller),   # WR-08: consume, never re-resolve
```
⚠ The module docblock (`:41-45`) says the 403 visibility dependency and the shared current-user resolver must **not be spelled** in this module, even in comments. A literal-grep fence counts them. Copy that discipline.

**Analog C, a pool fetchrow with an explicit predicate** (`runs.py:618-633`):
```python
pool = await get_pg_pool()
row = await pool.fetchrow(
    """
    SELECT wr.id AS run_id, ...
    FROM workflow_runs wr
    JOIN threads t ON t.id = wr.thread_id
    WHERE wr.id = $1
      AND wr.status = 'paused'
      ...
    """,
    run_id,
)
if row is None:
    return False
```
**Analog D, the 404 body and the single-query rationale** (`workflow_runs.py:880-910`):
```python
# ``id`` and ``user_id`` are filtered on the SAME query on purpose. A two-step
# "fetch, then compare owner" would answer a foreign id along a different (slower,
# separately-failing) path than a nonexistent one, which is a probe channel.
...
if not run:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```
**Org membership: the table and columns** (`threads.py:736-740`, an RLS connection there; this route uses the pool with an explicit user id instead):
```python
"SELECT role FROM public.org_members WHERE org_id = $1 AND user_id = auth.uid()"
```
In the evidence SQL this becomes `EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = wr.org_id AND m.user_id = $2)`, inside the same `WHERE` as `wr.id = $1 AND wr.status IN ('completed','failed','cancelled')`. That is RESEARCH Pattern 1.

**Snapshot decode:** import `_coerce_definition` from `app.api.workflow_runs` (`:395-414`) and do not copy it. Keep the `is None` (not truthiness) fallback rule written at `:952-959`.

**Owner name, non-owner:** reuse `_WAITING_FALLBACK_NAME = "the person who started this run"` (`workflow_runs.py:738`) and the `_clean_label` lazy import (`:771`). The display-name read is `pool.fetchval("SELECT display_name FROM profiles WHERE id = $1", run["user_id"])` (`:831-832`). Send an email only when `viewer_is_owner` (A-06, `compose_waiting_on` `:773-780`).

---

### `backend/app/services/run_evidence.py` (new, plan 03): pure composers

- **Phase log:** copy the per-row derivation in `workflow_runs.py:1027-1061`: one `phase_output_object` parse, then `declared_phase_measure(obj)`, the `text` by-name read, and the `_failure_reason` strip-to-None.
- **Sources:** copy the allow-list loop at `workflow_runs.py:1217-1237`. It builds new dicts, uses `isinstance` guards on `document_id`/`filename`, and **ships neither `passage` nor `similarity`** (`WorkflowRunCitationRead` docblock `:375-383`). Dedupe with `agent_loop._deduplicate_citations` (`:988`), lazy-imported as in `harness_engine.py:361-365`.
- **Audit metadata:** `write_audit` stores `json.dumps(metadata)` into `$4::jsonb` (`db/workflows.py:2564-2571`), so each row is a string scalar. Unwrap it with `phase_output_object`, never with SQL `->>`.

---

### `backend/app/main.py` + `backend/app/middleware/canvas_gate.py` (plan 03, same commit)

`main.py:897`:
```python
app.include_router(workflow_runs.router)  # Phase 188 RUNVIZ-03 — GET /workflow-runs/{id}: …
```
Add `app.include_router(workflow_run_evidence.router)  # Phase 289 VIS-03 — …` below it.

`canvas_gate.py:103-107`, the member style:
```python
        # Phase 200.2 (RUN-05 / D-09) — the lazy per-step citation read.
        # TEMPLATE form: OpenAPI-half only (see the asymmetry note above); its request-path 404
        # comes from require_canvas. The existing /workflow-runs/{workflow_run_id} template is
        # segment-anchored and does NOT match this deeper path, so the new member is required.
        "/workflow-runs/{workflow_run_id}/phases/{phase_slug}/citations",
```
Add `"/workflow-runs/{workflow_run_id}/evidence"` with the same comment shape. Then run `tests/test_182_canvas_gate.py` and `tests/test_revert_byte_identical.py`.

---

### `frontend/src/lib/api/runEvidence.ts` (new, plan 03)

**Analog:** `lib/api/workflows.ts:768-783` (and `:799-816`).
```ts
import { API_BASE, ApiError, getAuthHeaders } from "./_core"     // workflows.ts:13

export async function getWorkflowRun(runId: string, signal?: AbortSignal): Promise<WorkflowRunRead> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflow-runs/${encodeURIComponent(runId)}`, { headers, signal })
  if (!res.ok) throw new ApiError(`Failed to load the run (status ${res.status})`, res.status)
  return (await res.json()) as WorkflowRunRead
}
```
Keep `encodeURIComponent` (WR-07). The report branches on `err instanceof ApiError && err.status === 404` to show "This run isn't available".
⚠ The page tests mock `@/lib/api`. Decide whether the report imports from `@/lib/api/runEvidence` or a re-export, and mock under that exact specifier (RESEARCH: seam286 pin terminal cases).

---

### `frontend/src/lib/runDeepLink.ts` + `App.tsx` + `ChatLayout.tsx` (plan 03)

**Analog:** `App.tsx:155-167`. The `useState` initializer reads the query once:
```tsx
const [activeView, setActiveView] = useState<ActiveView>(() => {
  if (typeof window !== "undefined" && (window.location.pathname === "/admin/spend" || …)) {
    return "admin-spend"
  }
  const q = new URLSearchParams(window.location.search)
  if (q.get("connections") !== "1") return "chat"
  window.history.replaceState(null, "", window.location.pathname)
  return "connections"
})
```
⚠ Differences for `?run=`:
- Validate the value as a UUID in `readRunDeepLink()`.
- Do **not** `replaceState` in the initializer, or a reload loses the run (RESEARCH Pattern 5).
- Put the `run` check **before** the `connections` early return.

`ChatLayout.tsx:304`: `const [activeRunId, setActiveRunId] = useState<string | null>(null)` becomes `useState<string | null>(() => readRunDeepLink())`. ⚠ `canvasEnabled` (`:323`) is false until features load, so a positional fallback flashes first; that is accepted.

---

### `frontend/src/components/workflows/RunEvidenceReport.tsx` + `evidenceView.ts` (new, plan 03)

- **Loading and 404 screens:** copy the markup of `WorkflowRunPage.tsx:1126-1157` (centered column, `font-headline text-xl` heading, `max-w-md text-sm text-muted-foreground` body, ghost Back button).
- **JSON download:** copy the idiom in `AuditTab.tsx:222-233`. RESEARCH says not to add a shared helper in a hot file.
  ```ts
  function downloadCsv(filename: string, content: string): void {
    const blob = new Blob([content], { type: "text/csv" })   // -> "application/json"
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  ```
- **Text only:** render definition JSON as `<pre>{JSON.stringify(...)}</pre>`, never `dangerouslySetInnerHTML` (XSS row in RESEARCH Security).
- **Import ban:** do **not** import `RunReceipt` (`RunReceipt.test.tsx:276` pins its importers to `["WorkflowRunPage.tsx"]`). Reuse `receiptVocabulary.ts` and `phaseDuration.ts` words only.

---

### `frontend/src/components/workflows/StepEvidenceLine.tsx` (new, plan 02)

**Leaf shape, from `WaitingOnLine.tsx`** (whole file, 26 lines): a docblock saying LEAF with no hook, no API import and no sentence logic, then an early `return null`, then text-child rendering only.
```tsx
export function WaitingOnLine({ waitingOn }: { waitingOn?: WorkflowRunWaitingOn | null }) {
  if (!waitingOn?.sentence) return null
  return (
    <span className="text-xs font-medium text-[hsl(var(--warning))]" data-testid="run-waiting-on" …>
      {waitingOn.sentence}
    </span>
  )
}
```
**028 anatomy, from `ConfidenceChip.tsx:10-16, 46-61, 97-121`:** three inseparable atoms, `[glyph aria-hidden] + [WORD] + [· raw score tabular-nums]`, using panel-scoped AA tokens (`--panel-status-done`, `--panel-status-active`, `hsl(0_80%_80%)` for low). Never the global `--muted-foreground`.
```tsx
<span data-testid="confidence-chip" data-state="med" className={cn(BASE_CLASSES, SCORED_VARIANTS.med)}>
  <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
  <span className="tabular-nums">Med · {raw}</span>
</span>
```
⚠ Copy the **anatomy and tokens only**. Do not import `ConfidenceChip`: its `TIER` (0.75/0.5) is metadata confidence, and its `:31-34` says not to conflate it with retrieval buckets. Take the level from the server's `confidence.level`. Do not use `chat/ConfidenceBadge.tsx` either, which is colour-only with raw colour tokens.

**Mount point in `RunSpine.tsx`** (`:410-414`). There is one optional slot under the title row, and the evidence line goes beside it:
```tsx
{ask ? (
  <span data-testid="spine-ask" className="mt-1 block">
    {ask}
  </span>
) : null}
```
RunSpine imports nothing from `@/lib/api` at runtime (`:84`), so read `row.confidence` as a type-only shape.

---

### `frontend/src/components/workflows/evidenceVocabulary.ts` (new, plan 02)

**Analog:** `receiptVocabulary.ts:1-50`: one home for every governed string, exact-match assertions only, composed readings as functions, and no JSX literals in consumers.
⚠ **A conflict to resolve on purpose:** `receiptVocabulary.ts` rule 2 (`:44-46`) is **"ZERO GLYPH STRINGS … a mark on this surface is a decision for `icon-convention.md`"**. The evidence line needs ✓ ● ⚠ ○. So:
- the glyphs live in this **new** module, never in `receiptVocabulary.ts`;
- the plan records the glyph choice against `references/icon-convention.md` (sketch-findings skill).

---

### `frontend/src/index.css`: one `@media print` block (plan 03)

**Weak analog:** `docs/docs.css:408-410` is the only print block in `src/`:
```css
@media print {
  .d-tocpill { display: none; }
}
```
Use RESEARCH's recipe: `visibility:hidden` on everything, visible plus `position:absolute; inset:0; overflow:visible` on `[data-print-root]`, and Tailwind `print:hidden` on the export buttons.

---

## Test patterns

### DB-backed RED: `backend/tests/test_289_ask_user_sql.py`
**Analog:** `tests/integration/test_284_resolve_live.py:30-64`: optional asyncpg import, a hard-coded local DSN, a 2 s probe, and a module-level skip:
```python
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def _pg_ok() -> bool:
    if asyncpg is None:
        return False
    async def _probe():
        c = await asyncio.wait_for(asyncpg.connect(DSN), timeout=2.0)
        await c.close()
    try:
        asyncio.run(_probe()); return True
    except Exception:
        return False
pytestmark = pytest.mark.skipif(not _pg_ok(), reason=f"local Postgres not reachable at {DSN}")
```
Call the real `get_ask_user_response` / `ask_user_response_exists` with a random `uuid4()`. A read-only call must return `None`/`False` without raising. ⚠ It **skips** when Postgres is down, so record a run against a live DB as the RED evidence.

### Re-drive failure: `backend/tests/unit/test_289_redrive_failure.py`
**Analog:** `tests/test_200_human_gate_pause.py:378-456`. Reuse `_RedriveFakePool` (records `(sql, args)`, serves the paused row and the claim), `_paused_row()` and `_run_redrive()`, which monkeypatches `app.dependencies.get_pg_pool`, `harness_engine._load_run_definition`, `_build_resume_context` and `_resume_run`, then yields `await asyncio.sleep(0)` ×5 so the spawned task runs:
```python
async def _fake_resume(run_id, defn, ctx, *, pool, redis):
    spawned.append((run_id, ctx))          # -> plant `raise RuntimeError("boom")`
monkeypatch.setattr("app.services.harness_engine._resume_run", _fake_resume)
```
Assert on `_sqls(pool)`: a `failed` phase UPDATE, a `finish_run` to failed, and an INSERT of `harness_audit` with `run_failed`. Do the same for a raising `_build_resume_context`. ⚠ The analog lives in `tests/`, not `tests/unit/`. If the new file goes under `tests/unit`, import the helpers or copy the class.

### Evidence route unit test: `backend/tests/unit/test_289_run_evidence.py`
**Analog for calling the route coroutine directly:** `tests/integration/test_214_argument_seams.py:312-318`:
```python
from app.api.workflow_runs import read_workflow_run
result = await read_workflow_run(workflow_run_id=seed.run_id, current_user={"id": str(seed.user_id)}, supabase=...)
```
Call `read_run_evidence(workflow_run_id=…, current_user={"id": …})` with `app.dependencies.get_pg_pool` monkeypatched to a fake pool (`_RedriveFakePool` style). The 404 cases assert `exc.value.detail == "Run not found"` for nonexistent, other-org and non-terminal ids alike.

### Vitest leaf: `StepEvidenceLine.test.tsx`
**Analog:** `WaitingOnLine.test.tsx` (whole file). It uses the `// @vitest-environment jsdom` header, checks "renders nothing when absent" with `container.innerHTML === ""`, checks exact `textContent`, and renders hostile markup to prove it comes out as text. Apply "renders nothing" to `confidence == null` (D-09).

### Vitest card: `PendingAskCard.paused.test.tsx`
**Analog:** `panel/__tests__/PendingAskCard.test.tsx:9-41`. Mock `@/lib/supabase`, then partially mock `@/lib/api` with `importActual` so `ApiError` stays the real class and `answerAskUser` is a `vi.fn()`. Fixtures come from `./fixtures` (`mockPendingAskWithRunId`). Seed `created_at` far in the past so `initialRemaining` is 0 (`:337-342`), and assert that the Send control exists and that "agent stopped" is absent.

### Vitest report: `RunEvidenceReport.test.tsx`
No direct analog. Follow D-03 and the memory "presence assertions miss content drift": extract each section's text from the DOM and assert **set equality** with the view-model strings and with the JSON payload's arrays. Do not stop at testid presence.

---

## Shared Patterns

### 404 parity, never 403
**Sources:** `workflow_runs.py:26-39` (docblock), `:880-910`, `:1184-1197`.
**Apply to:** the evidence route.
- One query carries id, status and access together.
- Use `HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")`.
- `require_canvas()` is the only dependency, with `canvas_caller` for identity.

### Pool reads bypass RLS, so the WHERE clause is the boundary
**Sources:** `db/workflows.py:2316-2317` ("the pool bypasses RLS and the `WHERE` clause is the boundary"), `runs.py:618-631`.
**Apply to:** the evidence SQL and the SQL fix. No migration 211, and no RLS policy widening.

### The jsonb string-scalar unwrap
**Sources:** `models/thread.phase_output_object` (used at `workflow_runs.py:1034`, `:1215`) and `workflow_runs._coerce_definition` (`:395-414`).
**Apply to:** `workflow_phases.output`, `workflow_runs.definition_snapshot` and `harness_audit.metadata` (double-encoded by `write_audit` `:2570`).

### Lazy imports across the harness and agent_loop cycle
**Sources:** `harness_engine.py:358-365`, `runs.py:610-616`, `workflow_runs.py:771`.
**Apply to:** `phase_confidence.py`, `_fail_redrive`, the evidence composer's use of `_deduplicate_citations` and `_clean_label`. Each import is function-local with `# noqa: PLC0415`.

### Optional props default so callers stay byte-identical
**Source:** `PendingAskCard.tsx:217-226, 286-295`.
**Apply to:** `PendingAskCard.paused` and RunSpine's use of `row.confidence`.

### Non-owner minimisation (A-06)
**Source:** `compose_waiting_on` (`workflow_runs.py:764-786`).
**Apply to:** the evidence payload.
- The display name falls back to "the person who started this run".
- Email goes to the owner only.
- No prompt line for non-owners.
- No `passage`/`similarity` (`WorkflowRunCitationRead` `:375-383`).

### The lockstep wire field and its fence
**Sources:** `workflow_runs.py:131-136`, `test_200_1_deliverable_text.py:118-137`.
**Apply to:** `WorkflowRunPhaseRead.confidence`. Change the model, serializer, `_EXPECTED_PHASE_KEYS`, `_ALLOW_LISTED_OUTPUT_KEYS` and the TS type in one plan.

### The hot-file ledger in the same commit
**Apply to:** every new source file (`young (created 289-0N)`) and every touched hot file. Each needs a row plus a `docs/HOT-FILE-LEDGER.md` section in the same commit (RESEARCH Pitfall 7; precedent `ThreadWorkflowPicker.tsx`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend/src/index.css` print block | style | — | The only print rule in `src/` is a one-line `display:none` in `docs/docs.css:408-410`. The app has never printed a nested `overflow-hidden` shell. Use RESEARCH §Page integration "Print". |
| `RunEvidenceReport.test.tsx` content-equality assertions | test | — | No existing DOM == view-model == JSON set-equality test. Build it from D-03. |

## Metadata

**Analog search scope:** `backend/app/{api,db,services,services/harness,middleware}`, `backend/tests/{,unit,integration}`, `frontend/src/{pages,components/{workflows,panel,metadata,chat,admin,layout},lib/api,docs}`, `frontend/src/App.tsx`
**Files scanned:** ~30 read or grepped
**Pattern extraction date:** 2026-10-19
