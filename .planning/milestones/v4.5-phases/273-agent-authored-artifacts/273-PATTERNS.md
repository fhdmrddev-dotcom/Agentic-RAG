# Phase 273: Agent-Authored Artifacts - Pattern Map

**Mapped:** 2026-10-03 (HEAD `8c166d575`, `develop`)
**Files analyzed:** 44 new or modified (backend 18, frontend 25, script 1)
**Analogs found:** 41 / 44 (3 have no analog; see the last section)

All line numbers were measured at this HEAD. These hot files move every phase, so re-check a line
range before quoting it in a PLAN action.

---

## File Classification

### Backend

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/models/artifact.py` (NEW) | model | transform/validate | `backend/app/models/harness.py` (`_StrictBase` :39-42, discriminated `PhaseConfig` :470-481) | exact |
| `backend/app/services/show_artifact_tool.py` (NEW) | service (tool handler) | request-response + event emit | `backend/app/services/search_documents_tool.py` (272 D-15 narrow cut) | exact |
| `backend/app/services/artifact_history.py` (NEW) | utility (pure transform + reload attach) | transform / batch read | redact: the `execute_code` persisted-result rewrite `agent_loop.py:3127-3163`; attach: `_enrich_messages_with_runs` `threads.py:290-...` | role-match |
| `backend/app/db/artifacts.py` (NEW) | model/DB helper (asyncpg) | CRUD (insert RETURNING, keyed get) | `backend/app/db/workspace.py` (:27-75 upsert RETURNING, :141-162 keyed get) | exact |
| `supabase/migrations/202_message_artifacts.sql` (NEW) | migration | DDL + RLS | `supabase/migrations/195_expert_installs_and_seed_retirement.sql` :24-85 + `messages` SELECT policy `full-schema.sql:7185` + autofill trigger `full-schema.sql:5421` | exact |
| `scripts/full-schema-supplement.sql` (MOD) | config (ACL mirror) | DDL | its own 195 block `:504-509` | exact |
| `backend/app/services/tool_dispatcher.py` (MOD, FIRES) | registry | — | its own 272 line `:48-49` + `:4538`; `ToolContext` accumulator fields `:135-142`; `_SUB_AGENT_EXCLUDED` `:4103` | exact |
| `backend/app/services/openai_service.py` (MOD, FIRES) | config (tool schema) | — | `QUERY_DOCUMENTS_BY_VIEW_TOOL` `:176-258` (type arrays, nested object) + `get_tools` `:1186-1240` | exact |
| `backend/app/services/agent_loop.py` (MOD, FIRES) | service (loop) | event-driven | 272 by-reference kwarg `:2119`, `:2172`, `:3051`; persist site `:1976-1979` | exact |
| `backend/app/services/harness/grounding.py` (MOD, FIRES) | service | — | `schema_tool_names` `:477` | exact |
| `backend/app/api/threads.py` (MOD, FIRES) | controller (read routes) | request-response | `_enrich_messages_with_runs` call sites `:593-598` (snapshot) and `:1501-1506` (get_messages) | exact |
| `backend/app/models/message.py` (MOD) | model | — | `MessageResponse` optional list fields `:111-112` | exact |
| `backend/tests/unit/test_273_migration_202_shape.py` (NEW) | test | text assertions | `backend/tests/unit/test_266_migration_195_shape.py` | exact |
| `backend/tests/unit/test_273_tool_wiring.py` (NEW) | test | — | `test_272_search_tool_move.py` + `test_085_tool_registration.py:270-292` | exact |
| `backend/tests/unit/test_273_show_artifact_tool.py` (NEW) | test | fake ctx / AsyncMock | `test_272_search_tool_move.py` (SimpleNamespace + AsyncMock ctx) | role-match |
| `backend/tests/unit/test_273_artifact_models.py` / `_artifact_history.py` / `_reload_attach.py` (NEW) | test | pure | (pure pytest, no fixture needed) | role-match |
| Count-pin tests (EDIT): `test_085_tool_registration.py`, `test_259_closed_core_inventory.py`, `test_261_closed_core_inventory.py`, `test_267_handoff.py`, `test_267_tool_floor_union.py`, `test_272_search_tool_move.py`, `test_tool_dispatcher.py`, `test_255_extension_contract_guard.py` | test | — | themselves | exact |
| `scripts/run-273-board.py` (NEW) | script | batch | `scripts/run-272-board.py` | exact |

### Frontend

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `components/chat/artifacts/ArtifactBlock.tsx` (NEW) | component (the one mount body) | render list | `FinalOutputsPanel` `MessageItem.tsx:131-142` | role-match |
| `components/chat/artifacts/ArtifactFrame.tsx` (NEW) | component | render | UI-SPEC §ArtifactFrame markup (no code analog for a `<figure>` card) | partial |
| `components/chat/artifacts/artifactRegistry.ts` (NEW) | utility (closed map) | lookup | `lib/toolNames.ts` (`own()` read `:117-119`) + `tool-bodies/index.ts` registry shape | exact |
| `components/chat/artifacts/artifactSpec.ts` (NEW) | utility (guard) | transform/validate | `tool-bodies/SearchDocumentsBody.tsx:14-28` (defensive `typeof` narrowing of an untrusted payload) | partial |
| `components/chat/artifacts/artifactCopy.ts` (NEW) | config (copy) | — | `components/chat/composerCopy.ts` (one home for strings, `?raw`-fenced) | role-match |
| `components/chat/artifacts/chartModel.ts` (NEW) | utility (pure) | transform | `components/chat/toolStepDerivation.ts` (pure derivations split out of a component) | role-match |
| `components/chat/artifacts/ChartArtifact.tsx` (NEW, lazy) | component | render (recharts) | `components/health/RetrievalTrendChart.tsx` (line/area, custom Tooltip) + `components/library/OutcomesByTypeChart.tsx` (bar, `stackId`, `radius`) | exact |
| `components/chat/artifacts/TableArtifact.tsx` (NEW) | component | render + local sort | none with sortable `<th aria-sort>` found; follow UI-SPEC | partial |
| `components/chat/artifacts/MetricArtifact.tsx` (NEW) | component | render | none; UI-SPEC is the contract | partial |
| `components/chat/artifacts/ArtifactNotice.tsx` (NEW, also error-boundary fallback) | component | render | none; **no React error boundary exists anywhere in `frontend/src`** (grep `componentDidCatch\|getDerivedStateFromError\|ErrorBoundary` = 0) | **none** |
| `components/chat/tool-bodies/ShowArtifactBody.tsx` (NEW) | component (rail body + `summarize`) | render | `components/chat/tool-bodies/SearchDocumentsBody.tsx` (272-05, reads structured refusal keys) | exact |
| `components/chat/tool-bodies/index.ts` (MOD, no row) | registry | — | itself `:7-59` | exact |
| `components/chat/ToolCallDetails.tsx` (MOD, no row) | component | — | `ToolArgsBlock` `:20-49`, `ToolResultBlock` `:56-130` | exact |
| `components/chat/ToolCallPanel.tsx` (MOD) | component | — | `hideBody={isExecuteCode}` `:355-369`; `ToolArgsBlock` mount `:381` | exact |
| `components/chat/StepRow.tsx` (MOD, no row) | component | — | node classes `:222-243` | exact |
| `components/chat/toolStepDerivation.ts` (MOD, **NOT in research list, no ledger row**) | utility | derive | `nodeStateOf` `:56-60` | exact |
| `components/chat/MessageItem.tsx` (MOD, FIRES) | component | render | `FinalOutputsPanel` mount `:998-1000`, `RunTerminalStatus` `:965-966` | exact |
| `providers/StreamsProvider.tsx` (MOD, FIRES) | provider | event-driven | `onFinalOutputFiles` `:1113-1120` | exact |
| `lib/api/threads.ts` (MOD) | service (SSE + mapper) | streaming / transform | `final_output_files` branch `:1036-1041`, callback type `:549-555`, mapper `:84-176` | exact |
| `lib/toolNames.ts` (MOD, no row) | config | lookup | `TOOL_PHRASES` `:86-115` | exact |
| `lib/toolMeta.ts` (MOD, FIRES) | utility | — | `toolLabel` `:9-30` | exact |
| `types/index.ts` (MOD) | model (types) | — | `Message.finalOutputFiles` `:247-254` | exact |
| `index.css` (MOD) | config | — | `:root` / `.dark` token blocks (`--warning` `:47`, `--card` `:21` / `:119`) | exact |
| `components/workflows/toolNames.test.ts` (EDIT fixture, Pitfall 8) | test | — | itself `:53-58`, `:110-120` | exact |
| `scripts/vitest-count-gate.cjs` (MOD, both knobs) | config | — | itself (`TARGETS` + `BASELINE`) | exact |
| Frontend tests (NEW): `artifacts/__tests__/*`, `ShowArtifactBody.test.tsx`, `ToolCallPanel.showArtifact.test.tsx`, `threads.artifact.test.ts`, `MessageItem.artifacts.test.tsx` | test | — | `tool-bodies/SearchDocumentsBody.test.ts` (`?raw` backend fence `:9-12`) | exact |

---

## Pattern Assignments

### `backend/app/models/artifact.py` (model, validate)

**Analog:** `backend/app/models/harness.py`

**Imports + strict base** (`harness.py:27-42`):
```python
from __future__ import annotations

import logging
import re
from typing import Annotated, Any, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

logger = logging.getLogger(__name__)


class _StrictBase(BaseModel):
    """Base for all harness config models — rejects unknown keys (D-07)."""

    model_config = ConfigDict(extra="forbid")
```

**Discriminated union** (`harness.py:470-481`), the shape for `ShowArtifactArgs`:
```python
PhaseConfig = Annotated[
    Union[
        ProgrammaticPhaseConfig,
        LlmSinglePhaseConfig,
        ...
        ExternalActionPhaseConfig,  # 189 CONN-01 (D-01) — the 7th, appended
    ],
    Field(discriminator="phase_type"),
]
```

**Module docblock rule to copy** (`harness.py:10-24`): it states which Literal sets may grow, and that
the discriminator, `extra='forbid'` and the union structure are LOCKED. `artifact.py` should state the
opposite for its component set: exactly three, frozen (I-1), parity-fenced against the SQL CHECK and
the frontend registry.

**Stringified-arg coercion** comes from `tool_dispatcher.py:4269-4280` (BUG-260529-01), moved into a
`field_validator(mode="before")` as RESEARCH Code Example 2 lines 533-536 shows:
```python
    # BUG-260529-01: some models (e.g. free OpenRouter llama-3.3-70b) serialize the
    # nested `todos` arg as a JSON string. Coerce + guard so valid stringified
    # payloads succeed and bad shapes return a self-correcting error (not a crash).
    if isinstance(todos_in, str):
        try:
            todos_in = json.loads(todos_in)
        except (ValueError, TypeError):
            return ToolResult(
                result="write_todos: 'todos' must be a JSON array of objects, not a string"
            )
```

**Literal derivation precedent** (`search_documents_tool.py:68-71`): derive a vocabulary from a
model with `get_args(...)` instead of re-typing it. Use the same idea to export
`ARTIFACT_COMPONENTS = get_args(<component Literal>)` so the migration-shape test and the frontend
`?raw` fence compare against one source.

---

### `backend/app/services/show_artifact_tool.py` (service / tool handler, request-response + emit)

**Analog:** `backend/app/services/search_documents_tool.py`

**Module docblock + import-cycle rule** (`search_documents_tool.py:1-24`). Copy the structure: what
moved, that `tool_dispatcher` keeps ONE registry line, the patch-where-used warning, and:
```python
⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). ``ToolContext`` is a type-only import; ``ToolResult`` is
imported inside the handler.
```

**Imports** (`search_documents_tool.py:25-55`):
```python
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, ValidationError

if TYPE_CHECKING:
    from app.services.tool_dispatcher import ToolContext, ToolResult

logger = logging.getLogger(__name__)
```

**Handler entry with the function-local import** (`search_documents_tool.py:1183-1198`):
```python
async def handle_search_documents(args: dict, ctx: ToolContext) -> ToolResult:
    """``search_documents`` — honour the filter end to end (FIND-07; D-03 … D-25).

    Order: parse → the D-09 lock → ...
    """
    # Function-local on purpose (D-15 / T-272-03): tool_dispatcher imports THIS module at load,
    # so a module-level import of it would cycle. By call time the dispatcher is fully loaded.
    from app.services.tool_dispatcher import ToolResult

    query = args["query"]
    parsed = parse_filter_args(args)
    if isinstance(parsed, FilterRefusal):
        return _invalid_filter(ctx, query, parsed, [], ToolResult)
```

**Refusal arm as its own small function returning `ToolResult(result=json.dumps({...}))`**
(`search_documents_tool.py:888-913`). Copy the arm-per-outcome layout, but **change the payload keys**:
272 uses a top-level `"error"` key, and `ToolResultBlock` renders `parsed.error` verbatim in
destructive italic (`ToolCallDetails.tsx:67-71`, leak L-4). The `show_artifact` refusal uses
`{"status": "refused", "reason": <people-safe>, "detail": <model-facing>}` (RESEARCH Pattern 3).
```python
def _refused_retry(
    ctx: Any, query: str, locked: set, requested: Sequence[dict], ToolResult: Any,
    violated: Sequence[str] | None = None,
):
    """D-09: a search that drops (or, WR-02, widens) a field whose filter matched nothing is refused."""
    ...
    return ToolResult(
        result=json.dumps({
            "error": "refused_retry",          # ⛔ do NOT copy this key for show_artifact
            ...
            "instruction": (...),
        }),
        citations=[],
        source_refs=[],
    )
```

**Guard on context** (RESEARCH Code Example 4): `ctx.parent_run_id is not None or ctx.phase_whitelist is not None`
refuses. Those fields are declared at `tool_dispatcher.py:154` and `:165`.

**SSE emit after a pool write** (`tool_dispatcher.py:2741-2763`, `_handle_workspace_write`). The
`artifact` emit follows this call shape, emitting the RETURNING row (Pattern 4):
```python
        result = await ws_write_file(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            user_id=UUID(ctx.current_user["id"]),
            ...
        )
        await ctx.emit(
            ctx.redis, ctx.run_id, 'workspace_file_written',
            id=result["file_id"],
            path=result["path"],
            ...
        )
```

**Caption source** = the by-reference `ctx.turn_tool_calls` list (new field, see `tool_dispatcher.py`
below). Entries there have the shape built at `agent_loop.py:3165-3174`
(`tool_call_id, name, args, result[:2000], status`), so the caption reads `name` and the doc/page
args of earlier `query_tables` / `query_documents` / `search_documents` calls in the same list.

---

### `backend/app/services/artifact_history.py` (utility, pure transform + batched reload read)

**Analog for `redact_artifact_args`:** the persisted-result rewrite for `execute_code`
(`agent_loop.py:3125-3163`). It is the existing precedent for "persist a different shape than the
live result so reload matches live" (I-2). The new function rewrites `args.rows`, never mutates the
input, and carries `thought_signature` through untouched (it is a sibling key added at
`agent_loop.py:3173`). Draft body: RESEARCH Code Example 3 (lines 561-573).

**Analog for `attach_artifacts`:** `_enrich_messages_with_runs` (`threads.py:290-...`). Copy:
- signature shape `(messages: list[dict], *, thread_id, user_id, supabase) -> list[dict]`, mutating in
  place and returning the same list (`threads.py:290-301`);
- ONE batched `aexec(supabase.table(...).select(...).eq("thread_id", ...).eq("user_id", ...))` with the
  explicit `.eq("user_id", ...)` as defense-in-depth beside RLS (`threads.py:315-341`);
- the docblock style that states why the lookup is keyed the way it is (there: `runs.message_id` has no
  UNIQUE; here: Gemini `call_{idx}` ids collide, so key by the parsed `artifact_id`).
```python
async def _enrich_messages_with_runs(
    messages: list[dict],
    *,
    thread_id: str,
    user_id: str,
    supabase: Client,
) -> list[dict]:
    """D-075-03: shared runs-FK merge for /messages and /snapshot.
    ...
    Defense-in-depth: .eq("user_id", ...) alongside RLS policy
    runs_select_own (migration 035 lines 47-49).
    """
    runs_resp = await aexec(
        supabase.table("runs")
        .select("run_id, message_id, status, model, provider, started_at, completed_at, "
                "org_id, input_tokens, output_tokens")
        .eq("thread_id", thread_id)
        .eq("user_id", user_id)
        ...
```
Use `.in_("id", ids)` for the artifact select (one round trip, RESEARCH Pattern 6).

---

### `backend/app/db/artifacts.py` (asyncpg helper, CRUD)

**Analog:** `backend/app/db/workspace.py`

**Module docblock (dual-caller pool contract)** (`workspace.py:1-17`): helpers take a first positional
`pool` and only call `.fetchrow/.fetch/.fetchval/.execute`. Also copy the security line from
`db/runs.py:15-17`:
```python
SECURITY (T-073-02): ALL value substitutions use $N positional placeholders.
No f-strings or string-interpolation methods on SQL strings, ever.
```

**Imports** (`workspace.py:19-24`):
```python
from __future__ import annotations

from datetime import datetime
from uuid import UUID

import asyncpg
```

**INSERT … RETURNING with keyword-only args** (`workspace.py:27-75`):
```python
async def upsert_workspace_file(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    path: str,
    ...
) -> tuple[UUID, bool]:
    row = await pool.fetchrow(
        """
        INSERT INTO workspace_files
            (thread_id, path, size_bytes, mime_type, ...)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ...
        RETURNING id, (xmax = 0) AS is_new
        """,
        thread_id, path, size_bytes, mime_type, ...
    )
    return row["id"], row["is_new"]
```
For the artifact: `RETURNING *` and return `dict(row)` (the wire contract both SSE and reload use).

**JSONB codec warning** (`workspace.py:89-94`): pass dicts straight through; `json.dumps` here
double-encodes into a JSON string. The `spec` and `caption` columns must follow this.

**Keyed read returning `dict | None`** (`workspace.py:141-162`). The artifact lookup must bind
`id AND thread_id AND user_id` because the pool is RLS-bypassing (RESEARCH Pitfall 11):
```python
    row = await pool.fetchrow(
        """
        SELECT ... FROM workspace_files
        WHERE thread_id = $1 AND path = $2
        """,
        thread_id, path,
    )
    return dict(row) if row else None
```

**Org stamping:** `db/runs.py:19-35` documents that `org_id=None` falls to the mig-106 autofill trigger
but guesses for two-org users (D-268-07). Pass `org_id` explicitly when the caller has it (RESEARCH
Code Example 4 passes `ctx.current_user.get("org_id")`).

---

### `supabase/migrations/202_message_artifacts.sql` (migration, DDL + RLS)

**Analog:** `supabase/migrations/195_expert_installs_and_seed_retirement.sql`

**Header** (`195:1-22`): phase/requirement ids, WHY paragraph, then:
```sql
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- ============================================================================

BEGIN;
```

**Table + COMMENT ON each column** (`195:27-63`). Copy the per-column `COMMENT ON COLUMN` habit.

**RLS + privileges block, PUBLIC first** (`195:68-85`):
```sql
ALTER TABLE public.expert_installs ENABLE ROW LEVEL SECURITY;

-- Default privileges gave anon/authenticated ALL on a new public table; take them back
-- (PUBLIC first — the CLAUDE.md trap), then grant only what is needed.
REVOKE ALL ON TABLE public.expert_installs FROM PUBLIC;
REVOKE ALL ON TABLE public.expert_installs FROM anon;
REVOKE ALL ON TABLE public.expert_installs FROM authenticated;
GRANT SELECT ON TABLE public.expert_installs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_installs TO service_role;

DROP POLICY IF EXISTS "expert_installs_member_read" ON public.expert_installs;
CREATE POLICY "expert_installs_member_read" ON public.expert_installs
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()));

-- There is NO authenticated write policy, and no client write grant, on purpose: ...
```
Differences for 202: the service_role grant drops UPDATE (D-08 immutability), and the policy predicate
must be the **messages** predicate, not 195's org-only one (I-5 "exactly the parent message's
visibility"). Copy it from `supabase/full-schema.sql:7185`:
```sql
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));
```
**Org autofill trigger**, same as messages (`full-schema.sql:5421`):
```sql
CREATE TRIGGER messages_autofill_org_id BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');
```
Full draft: RESEARCH Code Example 5 (lines 600-640). After the paste, regenerate
`supabase/full-schema.sql` with `bash scripts/regenerate-full-schema.sh` (never hand-edit).

### `scripts/full-schema-supplement.sql` (ACL mirror)

**Analog:** its own 195 block (`full-schema-supplement.sql:504-509`):
```sql
-- migration 195 — expert_installs: members READ their org's installs; only the backend writes (D-266-08)
REVOKE ALL ON TABLE public.expert_installs FROM PUBLIC;
REVOKE ALL ON TABLE public.expert_installs FROM anon;
REVOKE ALL ON TABLE public.expert_installs FROM authenticated;
GRANT SELECT ON TABLE public.expert_installs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_installs TO service_role;
```
Append a `-- migration 202 — message_artifacts` block directly after it, with no UPDATE in the
service_role grant.

---

### `backend/app/services/tool_dispatcher.py` (MOD, FIRES: 1 import, 1 registry line, 1 field, 1 token)

**Import + re-export line** (`:48-49`), the 272 precedent:
```python
# Phase 272 (D-15) — handler moved to search_documents_tool.py; registry/handler split still OWED (→273)
from app.services.search_documents_tool import handle_search_documents as _handle_search_documents
```
Add the twin for `show_artifact_tool.handle_show_artifact`, and the comment names OV-273-02.

**Registry line** (`:4532-4569`). Copy the per-phase comment style of the last entries:
```python
    # Phase 151 (FILE-01) — registry + get_tools BOTH (self_improve-gated); G-5: handler + one line, threads.py untouched
    "attach_skill_file": _handle_attach_skill_file,
}
```

**New `ToolContext` field** goes beside the 272 accumulator (`:136-142`), same comment discipline
(who sets it, that it is by reference, that it is `None` on every unwired caller):
```python
    # Phase 272 (D-09) — per-turn STRUCTURAL retry lock for search_documents. ...
    # By-reference run accumulator (the dead_gap_tokens_in_run shape): init once in
    # agent_loop.py, threaded into BOTH ToolContext builds — ...
    # None on every unwired (harness/eval/test) caller => the lock is a no-op.
    empty_filter_fields_in_run: set | None = None
```
New: `turn_tool_calls: list[dict] | None = None` (RESEARCH Pattern 5). Unlike 272's set, do NOT share it
with task sub-agents (show_artifact is excluded from them).

**Sub-agent exclusion** (`:4098-4103`):
```python
_SUB_AGENT_EXCLUDED: frozenset[str] = frozenset({"task", "ask_user", "write_todos"})
```
Add `"show_artifact"` and extend the comment above it.

---

### `backend/app/services/openai_service.py` (MOD, FIRES: 1 schema, 1 `get_tools` entry, 1 constant)

**Schema analog:** `QUERY_DOCUMENTS_BY_VIEW_TOOL` (`:176-258`), which already ships type arrays and a
nested object across the roster:
```python
                                    "value": {"type": ["string", "number", "boolean", "null"]},
                                    "value2": {
                                        "type": ["string", "number", "null"],
                                        "description": "Upper bound for 'between'.",
                                    },
```
The prompt-in-description style (when to use, when NOT to use, one rule per sentence) is
`WRITE_TODOS_TOOL` `:1029-1041`. D-11's PNG guidance and the compact example call go there, never in
`SYSTEM_PROMPT`. The full schema draft is RESEARCH Code Example 1 (lines 476-516).

⚠ **Stale comment to ignore:** `openai_service.py:261-266` says a multi-type `type:[...]` array
"ALSO 400s google-genai". That was true before `google_service._translate_nullable_type`
(`google_service.py:270-309`), which now collapses every list-valued `type` to its first non-null
member plus `nullable: true`, recursively through `_sanitize_schema_for_google` (`:312-340`). The
show_artifact type arrays are safe for that reason; the wiring test should still convert the schema
through `_convert_tools_to_google` as RESEARCH did.

**`get_tools` placement** (`:1189-1197`). show_artifact is ungated, so it goes in the base list. Base
25 becomes 26, and all-on 28 becomes 29 (pins at `test_085_tool_registration.py:280-292`):
```python
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, QUERY_DOCUMENTS_BY_VIEW_TOOL,
             ...
             # Phase 085 — D-085-25 — 3 new tools (24-tool toolbox after this line)
             WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL]
```
Add `CHAT_ONLY_TOOLS = frozenset({"show_artifact"})` beside the schema (RESEARCH Pitfall 8).

### `backend/app/services/harness/grounding.py` (MOD, FIRES: 1 line)

**Site** (`:477-478`):
```python
    schema_tool_names = {t["function"]["name"] for t in get_tools(None)}
    fidelity_tool_names = schema_tool_names | EXTERNAL_ACTION_CAPABILITIES
```
Subtract `CHAT_ONLY_TOOLS` from `schema_tool_names`, so the harness offer set stays 28 and
`components/workflows/toolNames.test.ts:56` (`OFFERED_TOOL_IDS` length 28) stays true.

---

### `backend/app/services/agent_loop.py` (MOD, FIRES: 2 kwargs + 1 hook)

**Kwarg in BOTH ToolContext builds**, beside the 272 one:
- resume build `:2156-2172`: `empty_filter_fields_in_run=_empty_filter_fields_in_run,  # 272 (D-09) — retry lock (by-reference)`
- main build `:3035-3051`: the same line.

Add `turn_tool_calls=persisted_tool_calls,  # 273 — caption source (by-reference)` after each.
`persisted_tool_calls` is defined at `:1905` (`persisted_tool_calls: list[dict] = []`), above both
builds, so no new init is needed (unlike 272's `:2119`).

**The one persist hook** (`:1976-1979`):
```python
        if persisted_tool_calls:
            completed_tools = [tc for tc in persisted_tool_calls if tc.get("status") == "done"]
            if completed_tools:
                row["tool_calls"] = _strip_nul(completed_tools)
```
Insert `completed_tools = redact_artifact_args(completed_tools)` before the `row["tool_calls"]` line
(RESEARCH Code Example 3).

**What is NOT touched:** the in-turn assistant message uses the raw `tc["arguments"]` string, and
`_reconstruct_history` re-sends `json.dumps(tc.get("args", {}))` (`:1077`) plus the persisted
`thought_signature` (`:1085-1089`). The redaction only changes what that line later reads.

---

### `backend/app/api/threads.py` (MOD, FIRES: 2 read-route calls, 0 send-path branches)

**Analog:** the shared-helper call that already runs in both routes.
- `get_snapshot` `:593-598`
- `get_messages` `:1501-1506`
```python
    messages = await _enrich_messages_with_runs(
        messages,
        thread_id=thread_id,
        user_id=current_user["id"],
        supabase=supabase,
    )

    return messages
```
Add one `messages = await attach_artifacts(messages, thread_id=..., user_id=..., supabase=supabase)`
after each. Both routes already use the user-JWT client (`Depends(get_user_supabase_client)`, `:1469`),
so RLS enforces the read.

### `backend/app/models/message.py` (MOD: 1 field)

**Analog** (`message.py:111-112`):
```python
    tool_calls: list[dict] | None = None
    source_refs: list[dict] | None = None
```
Add `artifacts: list[dict] | None = None` with a Phase 273 comment, like the run_id comment block
at `:116-126`.

---

### Backend tests

**`test_273_migration_202_shape.py`** copies `test_266_migration_195_shape.py:1-70` wholesale:
- the docblock warning that assertions run over comment-stripped text and that live RLS is measured by
  SQL after the paste;
- `REPO_ROOT = Path(__file__).resolve().parents[3]`, the `MIGRATION` and `SUPPLEMENT` paths;
- `_strip_comments`, `_norm`, `_code`, `_statements`;
- `test_migration_file_exists_with_digits_only_prefix` (glob `202_*.sql`);
- the CHECK literal extraction `re.search(r"CHECK \(status IN \(([^)]*)\)\)", code)`, re-pointed at
  `component IN (...)` and compared to `ARTIFACT_COMPONENTS`.

**`test_273_tool_wiring.py`** copies `test_272_search_tool_move.py`:
- registry entry `is` the module handler (same object);
- no module-level `tool_dispatcher` import in the new module (AST walk);
- if a git-blob comparison is used, `subprocess.run([...], text=True, encoding="utf-8")`, since
  `encoding` is load-bearing on Windows (`test_272_search_tool_move.py:40-50`);
- `get_tools` counts via `SimpleNamespace(web_search_enabled=..., sandbox_enabled=...)`
  (`test_085_tool_registration.py:276-292`).

**Count-pin edits (Pitfall 10):** update every `29`/key-set pin in the 8 files listed in RESEARCH
§Validation row "closed core" in the same plan as the registry line. Do not touch
`test_module7_tools.py` or `test_explorer_agent.py`; they are already in the frozen 71.

---

### `scripts/run-273-board.py` (script, batch)

**Analog:** `scripts/run-272-board.py` (405 lines). Copy:
- module docblock with `--seed` / `--run` modes and literal verdict rules (`:1-27`);
- the utf-8 stdout reconfigure, `sys.path` inserts and `import conc_probe as kit` (`:29-48`);
- `_EVIDENCE` pointed at `.planning/phases/273-agent-authored-artifacts/evidence/board`;
- `_wait_run` (`:204-213`) and `_collect` (`:216-231`). Extend `_collect` with
  `SELECT … FROM message_artifacts WHERE thread_id = %s ORDER BY created_at`;
- `run_board` (`:324-379`): `sc10.derive_roster()`, `sc10.probe_keys`, the ⛔ blocked row when there is
  no key, per-request `model` + `provider` on `POST /threads/{id}/messages`, evidence JSON per run, and
  `BOARD_TABLE` output;
- `main` (`:382-401`): `kit.load_env()`, `kit.assert_localhost_only()`, `_single_org` assertion.

For the follow-up prompt, the second `POST` goes to the SAME thread, not a fresh one, and the verdict
asserts zero retrieval/code tool calls in the second run (reuse `_RETRIEVAL_TOOLS` `:71-74` plus
`execute_code`).

---

### `frontend/src/lib/api/threads.ts` (MOD: SSE branch + callback type + mapper)

**Callback type** (`:549-555`):
```ts
  onFinalOutputFiles?: (files: { filename: string; url?: string; size?: number; is_hero?: boolean }[]) => void
```
Add `onArtifact?: (raw: unknown) => void`. The payload stays `unknown` until the render guard runs.

**SSE branch** (`:1036-1041`), with no `return` so the cursor advance below still fires (the
panel-event note at `:1052-1057`):
```ts
        else if (t === "final_output_files" && callbacks.onFinalOutputFiles)
          callbacks.onFinalOutputFiles(
            (parsed.files ?? []) as { filename: string; url?: string; size?: number; is_hero?: boolean }[],
          )
```

**Mapper destructure** (`:96-117`). Add `artifacts` to the destructure so it does not leak through
`...rest` unshaped, and map it with an explicit `Array.isArray` guard (the `activeConnectorIds`
idiom at `:130`):
```ts
    // Phase 223 (BUG-260902-03 / D-223-06 / D-223-07): preserve [] as [] and null/undefined as undefined
    activeConnectorIds: active_connector_ids != null ? active_connector_ids : undefined,
```
The reload reconstruction precedent for files is `:149-174`. Artifacts do NOT re-parse
`tool_calls`, because the backend attaches the rows server-side (Pattern 6).

### `frontend/src/providers/StreamsProvider.tsx` (MOD, FIRES: ONE handler)

**Analog** (`:1108-1120`):
```tsx
    onFinalOutputFiles: (files: { filename: string; url?: string; size?: number; is_hero?: boolean }[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, finalOutputFiles: files } : m)),
      )
    },
```
`onArtifact` APPENDS with dedupe by `id` (replay-safe), not full replace. Draft: RESEARCH Code Example 6.
Same invariant as the comment at `:1111-1112`: never touch `m.content`.

### `frontend/src/types/index.ts` (MOD: additive)

**Analog** (`:247-254`):
```ts
  /** Phase 075.1 Plan 04 Atom E (...): cumulative
   * sandbox-output file list emitted by the backend `final_output_files`
   * SSE event after the agent loop terminates. ... Absent for runs that produced
   * no output files. */
  finalOutputFiles?: { filename: string; url?: string; size?: number; is_hero?: boolean }[]
```
Add `artifacts?: ArtifactRecordWire[]` to `Message` (`:174`) and export the wire type, which matches
the frozen RETURNING-row fixture (RESEARCH §Recommended Plan Grouping, last paragraph).

### `frontend/src/components/chat/MessageItem.tsx` (MOD, FIRES: ONE mount)

**Placement:** directly after the content region (the `: null}` ternary close at `:940`) and before
`<RunTerminalStatus message={message} isStreaming={isStreaming} />` (`:965-966`). That keeps it above
the live indicators (`:967-980`), `FinalOutputsPanel` (`:998-1000`) and the SeamCards (`:1001+`), as
UI-SPEC §Placement requires.

**Mount shape to copy** (`:998-1000`):
```tsx
        {message.finalOutputFiles && message.finalOutputFiles.length > 0 && (
          <FinalOutputsPanel files={message.finalOutputFiles} />
        )}
```
**Sub-component analog** for `ArtifactBlock` (`:129-142`): a typed prop taken from
`NonNullable<Message[...]>`, one wrapper with a `data-testid`, mapped children, and no local state
that changes MessageItem's hook order:
```tsx
type FinalOutputFile = NonNullable<Message["finalOutputFiles"]>[number]

function FinalOutputsPanel({ files }: { files: FinalOutputFile[] }) {
  return (
    <div className="mt-3 border-t border-border/60 pt-3.5" data-testid="final-outputs-panel">
      ...
        {files.map((f, i) => (
          <OutputFileCard key={`gen-${i}`} file={f} />
        ))}
```
`ArtifactBlock` lives in its own file (D-16) and keys by `artifact.id`, not by index.

---

### `frontend/src/components/chat/artifacts/ChartArtifact.tsx` (component, recharts, lazy)

**Analogs:** `components/health/RetrievalTrendChart.tsx` and `components/library/OutcomesByTypeChart.tsx`.

**Imports + axis/grid styling** (`RetrievalTrendChart.tsx:1-10, 99-113`):
```tsx
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
...
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <Tooltip content={<CustomTooltip />} />
```
UI-SPEC overrides: grid is solid (no `strokeDasharray`), ticks are 12px, `minTickGap={16}`.

**Custom tooltip as a function component** (`RetrievalTrendChart.tsx:23-50`). Keep the
`({ active, payload })` signature and the early `return null`; restyle to the UI-SPEC tooltip classes.

**Line `activeDot` ring** (`RetrievalTrendChart.tsx:150`):
```tsx
            activeDot={{ r: 5, stroke: "hsl(var(--card))", strokeWidth: 2, fill: "hsl(var(--primary))" }}
```
**Bar `stackId` + `radius`** (`OutcomesByTypeChart.tsx:92-97`):
```tsx
          <Bar dataKey="chunks" stackId="a" radius={[0, 0, 2, 2]} name="chunks">
          <Bar dataKey="failed" stackId="a" fill="#f87171" radius={[2, 2, 0, 0]} name="could not read" />
```
⛔ **Do not copy:** `isAnimationActive={true}` / `animationDuration` (`RetrievalTrendChart.tsx:120-153`).
UI-D-09 requires `isAnimationActive={false}` on every series. Also do not copy the literal hex fill
(`OutcomesByTypeChart.tsx:97`); series colours come from `var(--chart-N)`.

**Lazy loading.** Use `HealthTab.tsx:24-28` for a named export, or `ExecuteCodeBody.tsx:12-14`:
```tsx
const RetrievalTrendChart = lazy(() =>
  import("@/components/health/RetrievalTrendChart").then((m) => ({
    default: m.RetrievalTrendChart,
  })),
)
...
          <Suspense fallback={<ChartSkeleton />}>
```
The 273 fallback is the same frame with an empty 240px body and `aria-busy="true"`, not
`ChartSkeleton` (UI-SPEC §Lazy load).

### `frontend/src/components/chat/artifacts/artifactRegistry.ts` (closed map)

**Analog:** `lib/toolNames.ts:77, 86-119`. It holds a plain-object table and reads it through `own()`
from `components/workflows/ownProperty.ts`. That file is the tree's one spelling of the WR-04
prototype-key guard and has zero imports by contract:
```ts
import { own } from "@/components/workflows/ownProperty"
...
export function toolName(id: string): string {
  return own(TOOL_PHRASES, id) ?? id
}
```
Import `own` rather than inlining `Object.prototype.hasOwnProperty.call`. The
`ownProperty.ts` docblock says new inline copies are not wanted. A miss returns `null`, which
renders `ArtifactNotice("unknown-component")`. The `toolNames.ts:18-23` docblock also warns that
prose spelling out the forbidden bracket-read form trips its own acceptance grep, so the 273 docblock
should not spell it either.

⚠ `tool-bodies/index.ts:56` (`TOOL_SUMMARIES[tc.name]`) is an existing bracket read on the rail
path. It does not need fixing for this phase, but do not copy it into the artifact registry.

### `frontend/src/components/chat/artifacts/artifactSpec.ts` (guard) and `artifactCopy.ts`

**Guard analog:** `SearchDocumentsBody.tsx:14-28`, which narrows an untrusted parsed payload with
`typeof` and `Array.isArray` checks before reading fields, and returns `null` on a bad shape. The 273
guard returns `{ok: false, reason: <catalogue code>}` instead and never surfaces the raw value.

**Copy home:** `components/chat/composerCopy.ts`, a port of a sketch's copy file with every
user-visible string in one module, fenced by `?raw`. `artifactCopy.ts` holds the UI-SPEC
§Copywriting and §Notice reason catalogue strings.

**Parity fence across the stack** (`tool-bodies/SearchDocumentsBody.test.ts:9-12`):
```ts
import { describe, expect, it } from "vitest"
import type { ToolCall } from "@/types"
import { summarize } from "./SearchDocumentsBody"
import handlerSource from "../../../../../backend/app/services/search_documents_tool.py?raw"
```
Use the same `?raw` import of `backend/app/models/artifact.py` to assert the frontend registry keys
equal the backend component Literal.

---

### Rail: `tool-bodies/ShowArtifactBody.tsx` (NEW) + `tool-bodies/index.ts` (MOD)

**Analog:** `tool-bodies/SearchDocumentsBody.tsx` (whole file, 71 lines). Copy:
- a named `summarize(tc: ToolCall): string` export that `JSON.parse`s `tc.result` in a try/catch and
  maps each structured outcome to its essence string (`:30-43`);
- a private `summarizeOutcome(parsed)` that reads the handler's keys (`:14-28`). For 273 the keys are
  `status === "refused"` plus `reason`; never `detail`;
- a default-export body component taking `{ parsed }`.

**Registration** (`tool-bodies/index.ts:7-59`): add the import, the `export { … }` entry, a
`TOOL_BODIES.show_artifact` entry and a `TOOL_SUMMARIES.show_artifact` entry. Per RESEARCH Pitfall 1,
also export from this file ONE set such as `ARGS_BODY_HIDDEN = new Set(["execute_code", "show_artifact"])`,
which both `ToolCallPanel` and `ToolCallDetails` read.

### `frontend/src/components/chat/ToolCallDetails.tsx` (MOD, no ledger row: L-2, L-3, L-4)

- **L-2** `ToolArgsBlock` (`:20-49`) does `JSON.stringify(val)` for object args (`:41`). Return `null`
  early for names in the hidden set.
- **L-4** the `parsed?.error` arm (`:66-71`) runs BEFORE the per-tool dispatch:
  ```tsx
  if (parsed?.error) {
    return (
      <div className="mt-1.5 ml-8 text-xs text-destructive italic">{parsed.error}</div>
    )
  }
  ```
  The `show_artifact` refusal payload has no `error` key, so it skips this arm. Add a test that pins it.
- **L-3** dispatch chain (`:76-94`): add
  `else if (tc.name === "show_artifact") content = <TOOL_BODIES.show_artifact parsed={parsed} />` before
  the `GenericBody` fallback (`:92-93`), which would otherwise print 1,500 characters of the result.

### `frontend/src/components/chat/ToolCallPanel.tsx` (MOD: L-1)

**Site** (`:355-369`):
```tsx
                    const isExecuteCode = tc.name === "execute_code"
                    ...
                      <ToolArgsLivePanel
                        ...
                        hideBody={isExecuteCode}
                      />
```
Replace the name check with a read of the shared hidden set. The `ToolArgsBlock` mount at `:381` is
covered by the early return in `ToolCallDetails`.

### `frontend/src/components/chat/toolStepDerivation.ts` + `StepRow.tsx` (MOD: `refused` node, UI-D-02)

⚠ **Research listed only `StepRow.tsx`, but the state is derived elsewhere.** `NodeState` is declared
in `StepRow.tsx` and imported at `toolStepDerivation.ts:14`, and the derivation is
`toolStepDerivation.ts:56-60`:
```ts
export function nodeStateOf(tc: ToolCall): NodeState {
  if (tc.status === "running" || tc.status === "preparing") return "active"
  if (tc.status === "done" || tc.status === "interrupted") return "done"
  return "queued"
}
```
Add a `refused` arm that reads the structured marker from `tc.result`, not from the tool name (UI-D-02).
`toolStepDerivation.ts` has **no scan-list row** in `docs/HOT-FILE-LEDGER.md`, so the ledger gate will
report `[no-row]` unless a row is added in the editing commit.

**Styling** (`StepRow.tsx:222-243`). Add one class arm per element, in the existing `cn(...)` lists:
```tsx
            node === "done" && "bg-success border-success",
            ...
            node === "queued" && "bg-card border-border",
```
New: `node === "refused" && "bg-amber-600 border-amber-600 dark:bg-warning dark:border-warning"`, and the
step-number arm `text-amber-700 dark:text-warning`. The rail line (`:211-219`) treats any non-queued
node as filled, so `refused` reads as a completed step, which is correct.

### `frontend/src/lib/toolNames.ts` + `lib/toolMeta.ts` (MOD)

- `TOOL_PHRASES` (`toolNames.ts:86-115`) is alphabetical. Add `show_artifact: "Show an artifact"`
  between `save_skill` and `search_documents`. **Knock-on:** `components/workflows/toolNames.test.ts:119`
  asserts the table's key set EQUALS the harness `OFFERED_TOOL_IDS` (length 28 at `:56`). Amend that
  fixture to `OFFERED ∪ CHAT_ONLY` with a comment naming Phase 273, as RESEARCH Open Question 3
  recommends.
- `toolLabel` (`toolMeta.ts:9-30`) is the if-chain of activity strings:
  ```ts
  if (name === "execute_code") return "Executing code"
  ```
  Add `if (name === "show_artifact") return "Showing an artifact"`. The ellipsis is added by callers
  (see `Generating ${toolLabel(tc.name)}…` at `ToolCallPanel.tsx:362-364`).
- `toolSummary` (`toolMeta.ts:32-55`) falls through to `args.query` / `args.filename`. show_artifact has
  neither, so it returns `null`. Nothing to add unless the rail should preview the title.

### `frontend/src/index.css` (MOD: `--chart-1..4`)

Declare the four slot variables once in `:root` (`:21-48` block) and once in `.dark` (`:119+`) with the
same hex values (UI-SPEC §Data-viz palette). No `--chart-*` exists today (RESEARCH measured).

---

## Shared Patterns

### By-reference run accumulator on ToolContext
**Source:** `tool_dispatcher.py:135-142` + `agent_loop.py:2119, 2172, 3051`
**Apply to:** `turn_tool_calls` (tool_dispatcher, agent_loop, show_artifact_tool)
Declare it once with a `None` default, thread it into BOTH ToolContext builds by reference, and treat
`None` as "unwired caller → degrade" (caption says "Values provided by the agent").

### Function-local import to break the dispatcher cycle
**Source:** `search_documents_tool.py:21-23, 52-53, 1191-1193`
**Apply to:** `show_artifact_tool.py`, and `artifact_history.py` if it ever needs `ToolResult`
`TYPE_CHECKING` import at module level, real import inside the function.

### Pool queries bind the owner explicitly
**Source:** `db/runs.py:15-17` (positional `$N` only), `db/workspace.py:150-161`
**Apply to:** `db/artifacts.py`
The asyncpg pool is RLS-bypassing (`config.py:1201`). Every read binds `thread_id` and `user_id`.

### Reads through the user client go through `aexec` with explicit `.eq("user_id")`
**Source:** `threads.py:328-341`, `:1485-1491`
**Apply to:** `artifact_history.attach_artifacts`

### New table privileges: PUBLIC first, SELECT-only for `authenticated`
**Source:** `195_…sql:68-85`, `full-schema-supplement.sql:504-509`
**Apply to:** migration 202 and its supplement mirror

### Stable live-vs-reload record
**Source:** the `execute_code` persisted-result rebuild `agent_loop.py:3125-3163` and its reload mapper
`threads.ts:149-174`
**Apply to:** the artifact SSE payload, the reload attach and `_mapMessageResponse`
Live and reload must carry the same object. Here that object is the RETURNING row, emitted as-is.

### Structured refusal the UI can read without echoing model text
**Source:** `search_documents_tool.py:869-913` (payload per outcome) + `SearchDocumentsBody.tsx:14-28`
(UI reads the keys)
**Apply to:** `show_artifact_tool.py` refusals, `ShowArtifactBody.summarize`, `nodeStateOf`
Keep the key names `status`/`reason`/`detail`, and never use `error` (see L-4).

### Own-property table reads
**Source:** `components/workflows/ownProperty.ts` via `lib/toolNames.ts:77, 117-119`
**Apply to:** `artifactRegistry.ts`, the kind-chip label map and the notice reason catalogue

### Backend ↔ frontend parity fence by `?raw`
**Source:** `tool-bodies/SearchDocumentsBody.test.ts:12`
**Apply to:** registry keys vs the backend Literal, and refusal keys vs the handler

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Per-artifact error boundary (inside `ArtifactBlock.tsx` or its own file) | component (class) | render fallback | No React error boundary exists anywhere in `frontend/src` (grep for `componentDidCatch`, `getDerivedStateFromError` and `ErrorBoundary` returns 0). This is the first one. Write a minimal class component whose fallback is `ArtifactNotice("render-failed")`. |
| `components/chat/artifacts/TableArtifact.tsx` | component | local sort | No sortable `<th aria-sort>` table in the tree. Use UI-SPEC §TableArtifact as the contract. |
| `components/chat/artifacts/MetricArtifact.tsx` | component | render | No single-value metric component with a delta. Use UI-SPEC §MetricArtifact (`AnimatedNumber` exists in `components/ui/` but animates, which conflicts with UI-D-09). |

Test-environment note: `src/setupTests.ts` has no `ResizeObserver` polyfill. The existing
workaround is a file-local mock (`test-utils/handleSpike.test.tsx:27`,
`pages/WorkflowRunPage.test.tsx:146-147`). Either copy that or keep chart logic in `chartModel.ts`
and test it purely (RESEARCH Pitfall 9).

---

## Findings the planner should act on (not in RESEARCH)

1. **`toolStepDerivation.ts` must be in `files_modified`.** The `refused` node is derived at
   `toolStepDerivation.ts:56-60`, not in `StepRow.tsx`. The file has no ledger scan-list row, so the
   ledger gate will report `[no-row]`.
2. **There is no error boundary to copy.** `ArtifactBlock`'s per-item boundary is new code (a class
   component), and D-12/SC#2 depend on it.
3. **`openai_service.py:261-266` has a stale comment** saying type arrays 400 on Gemini. The
   sanitizer at `google_service.py:270-340` collapses them now. Leave the comment alone, or correct
   it beside the original; just don't let it argue the planner out of the type-array schema.
4. **`ToolResultBlock`'s `parsed?.error` arm runs before the dispatch chain**
   (`ToolCallDetails.tsx:66-71`). The no-`error`-key refusal payload is the only thing that keeps L-4
   closed, so pin it in a test.

## Metadata

**Analog search scope:** `backend/app/{services,db,models,api}`, `backend/app/services/harness`,
`backend/tests/unit`, `supabase/migrations`, `supabase/full-schema.sql`, `scripts/`,
`frontend/src/{components/chat,components/chat/tool-bodies,components/health,components/library,components/workflows,providers,lib,lib/api,types}`, `frontend/src/index.css`
**Files scanned:** ~40 read or grepped
**Pattern extraction date:** 2026-10-03
