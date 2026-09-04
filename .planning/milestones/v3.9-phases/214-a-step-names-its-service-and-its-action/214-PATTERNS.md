# Phase 214: A Step Names Its Service and Its Action — Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 33 (7 new · 26 modified)
**Analogs found:** 30 / 33
**Upstream input:** `214-CONTEXT.md` (24 decisions) + four generated BUILD-CONTRACTs. No RESEARCH.md is owed (D-214-24).

> ⚠ **This file goes PAST CONTEXT.md's `## Existing Code Insights`.** That section names the
> reusable assets; this one reads them and reports the shape a new file must copy, with line
> numbers taken from HEAD on 2026-08-28. Every excerpt below is verbatim from the tree.

---

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `backend/app/services/connectors/args.py` | service (pure leaf) | transform | `backend/app/services/connectors/grants.py` | **exact** |
| `frontend/src/components/workflows/argumentVocabulary.ts` | vocabulary/config | — | `frontend/src/components/workflows/doorVocabulary.ts` | **exact** |
| `frontend/src/components/workflows/publishRefusalVocabulary.ts` | vocabulary/config | — | `doorVocabulary.ts` (`DESCRIBE_REFUSAL`, :265) | **exact** |
| `frontend/src/components/workflows/stepIdentityVocabulary.ts` | vocabulary/config | — | `doorVocabulary.ts` | **exact** |
| the argument editor (`ArgumentEditor.tsx` + row/source-picker leaves) | component | request-response (author-driven) | `GovernanceSection.tsx` / `ExternalActionSection.tsx` | **exact** |
| the step-identity element (`StepIdentity.tsx`) | component | read-only presentational | `connectionMark.tsx::ConnectionMarkGlyph` + `phaseGlyph.tsx` | **exact** |
| the chat launch form (D-214-04) | component | request-response | `library/RunModal.tsx` | role-match |

### Modified files

| Modified file | Role | Data flow | Closest in-repo pattern to follow | Match |
|---|---|---|---|---|
| `backend/app/services/harness/phase_types.py` (`_adapter_args` :2125, `_external_action_inputs` :1861, `_BODY_ARG_FOR_CAPABILITY` :2056) | service | transform | `human_input.py`'s verbatim-move + re-import cut | **exact** |
| `backend/app/services/harness/publish_service.py` (stage 2, :174-188) | service (gate) | batch/validation | its own stage-2 block + `_block` (:460) | **exact** |
| `backend/app/services/harness/reachability.py` (`_check_input_contracts` :70, `LINT_CODES` :54) | service (pure lint) | transform | itself — the shape STEP-03 copies | **exact** |
| `backend/app/services/harness/grounding.py::_external_action_clause` (:1255-1294) | service (pure composer) | transform | itself; the new param is the D-214-14 shape | **exact** |
| `backend/app/services/harness_engine.py` | service | event-driven | its existing Gate-5 connection resolve | role-match |
| `backend/app/db/workflows.py::load_run_phases` (:1370-1386) | db reader | CRUD read | `get_latest_completed_workflow_run` (:1440-1490) + `models/thread.py::phase_output_object` | **exact** |
| `backend/app/api/workflow_runs.py` (`WorkflowRunPhaseRead`) | model + serializer | request-response | its own :764-778 parse-once idiom | **exact** |
| `backend/app/models/thread.py` (`WorkflowPhaseState` :196-243) | model | request-response | its own D-200.1-02-A same-commit rule | **exact** |
| `backend/app/api/threads.py` (:1234-1247) | controller | request-response | the sibling builder in `workflow_runs.py` | **exact** |
| `backend/app/models/harness.py` (`tool_args` :319, `inputs` :567, a new per-arg source field) | model | — | `ExternalActionPhaseConfig`'s `_StrictBase` + D-13 comment block | **exact** |
| `backend/app/models/user_settings.py::_GOVERNED_FEATURES` (:1191-1214) | config | — | the `visual_workflow_canvas` / `live_connectors` entries themselves | **exact** |
| `frontend/src/components/workflows/McpToolPicker.tsx` (:68, :610-638) | component | request-response | deletion — no analog needed | n/a |
| `frontend/src/components/workflows/ConnectionPicker.tsx` (:362-420, :500-527) | component (store-bound) | CRUD | its own `handleSelectTool` / `bind` patch discipline | **exact** |
| `frontend/src/components/workflows/ExternalActionSection.tsx` (:96-116) | component (leaf) | — | its own re-open trigger; drop the 3 dead props | **exact** |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` (:69, :78, :1473, :1494) | component (host) | — | the `GovernanceSection` one-gated-line insertion at :1494 | **exact** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` (:2817) + 4 pins | page | — | Phase 213's `ConnectionFormPanel.test.tsx:571` pin change | **exact** |
| `frontend/src/components/workflows/library/RunModal.tsx` (:557-582) | component | request-response | the hint-line block it replaces | **exact** |
| `frontend/src/components/workflows/doorVocabulary.ts` (:265) | vocabulary | — | itself | **exact** |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (:246, :462-471, :493-521) | component | request-response | its own `refusingDescribe` spread-conditional idiom | **exact** |
| `frontend/src/components/panel/PhaseCard.tsx` (`classifyFailure` :236-256) | component | read-only | itself — narrow the sentinel's CONDITION, never its words | **exact** |
| `frontend/src/components/panel/PhaseTimeline.tsx` | component | read-only | `PhaseCard` mount | **exact** |
| `frontend/src/components/workflows/RunSpine.tsx` (:184, :312-319) | component | read-only | the `titleOf` prop seam | **exact** |
| `frontend/src/components/workflows/RunStepList.tsx` (:105, :164, :221) | component | read-only | the `titleOf` prop seam | **exact** |
| `frontend/src/components/workflows/RunTranscript.tsx` (:349, :616) | component | read-only | the `titleOf` prop seam | **exact** |
| `frontend/src/components/chat/RunCard.tsx` | component | streaming | `providerLogo` mount at :4 | role-match |
| `frontend/src/types/index.ts` (`Phase` :1018-1062, `error` doc at :188) | types | — | the additive-union comment discipline at :1022-1061 | **exact** |
| `frontend/src/lib/api/workflows.ts` (`WorkflowRunPhase` :534-564) | types | — | the `step_count` `0`-vs-`null` field-doc at :554-563 | **exact** |
| `frontend/src/components/settings/connectionMark.tsx` | utility (mark map) | — | move-or-share; see §4 | **exact** |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | component | read-only | its stage rows | role-match |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | hook | request-response | itself | role-match |

---

## Pattern Assignments

### 1 · `backend/app/services/connectors/args.py` — NEW (service, pure leaf, transform)

**Analog:** `backend/app/services/connectors/grants.py` (92 L, Phase 213). Secondary:
`backend/app/services/harness/human_input.py` (340 L, Phase 200) for the *cut* itself.

#### 1a · The module shape to copy — `grants.py` is 92 lines and this is its whole skeleton

**Header — states the leaf invariant as a RULE, not a hope** (`grants.py:1-18`):

```python
"""Phase 213 (GRANT-01 / GRANT-02 / D-213-00 / D-213-05 / D-213-06) —
Tool grant resolution and posture evaluation.

This module is the single leaf module responsible for determining the effective approval
posture of a tool execution across all connection shapes (both native Capability and MCP).

── THE HONEST LEAF INVARIANT ──────────────────────────────────────────────────────────
This module is a strict leaf and MUST NEVER import ``phase_types`` or ``harness_engine``.
Gate 5.5 in ``phase_types.py`` delegates to this module so posture evaluation logic is
centralized and testable without inflating the harness executors.
"""
```

**Imports — three lines, and NOTHING from `harness/`** (`grants.py:19-27`):

```python
from __future__ import annotations

import logging
from typing import Any, Literal

ToolGrantPosture = Literal["allow", "ask", "deny"]
_LEGAL_POSTURES: frozenset[str] = frozenset({"allow", "ask", "deny"})

logger = logging.getLogger(__name__)
```

**Explicit `__all__`** (`grants.py:29-34`):

```python
__all__ = [
    "ToolGrantPosture",
    "_LEGAL_POSTURES",
    "resolve_effective_posture",
    "is_tool_allowed",
]
```

**The signature discipline — `Any` for the domain object, never a `harness` import**
(`grants.py:36-39`, `:88-92`):

```python
def resolve_effective_posture(
    connection: Any,
    tool_name: str | None,
) -> ToolGrantPosture:
    ...

def is_tool_allowed(connection: Any, tool_name: str | None) -> bool:
    """Predicate checking if a tool has an effective posture of 'allow'."""
    return resolve_effective_posture(connection, tool_name) == "allow"
```

⚠ **`connection: Any` is load-bearing, not laziness.** It is what lets the module accept BOTH a
`ResolvedConnection` dataclass and a plain `dict` (`grants.py:55-62` branches on
`isinstance(connection, dict)`), which is exactly the two-caller situation `args.py` faces: the
executor holds Pydantic config objects, the publish lint holds a `WorkflowDefinition`.

**The dual-shape read** (`grants.py:55-62`) — copy this idiom for reading `config` / `tool_args`:

```python
    if isinstance(connection, dict):
        grants = connection.get("tool_grants") or {}
        default_posture = connection.get("default_approval_posture")
    else:
        grants = getattr(connection, "tool_grants", None) or {}
        default_posture = getattr(connection, "default_approval_posture", None)
```

**Fail-closed with a NAMED log, never a silent default** (`grants.py:71-84`).

#### 1b · What the callers pass in — measured

- **Executor side:** `phase_types.py:104` imports it flat — `from app.services.connectors.grants
  import resolve_effective_posture`. One import line, at module top, no lazy import. `args.py`
  gets the same treatment.
- **`args.py`'s inputs, from what the two callers actually hold:**
  - `adapter.INPUT_SCHEMA` (`MappingProxyType`, `jira_adapter.py:419-436`) *or* a discovered
    tool's `inputSchema` dict (`mcp_client.py:343`) — **already unified by
    `descriptors.py::descriptor_for` :169**, which emits `{"name", "title", "description",
    "inputSchema"}` for a capability row in the MCP sanitizer's own key order.
  - `phase.config` (`tool_args` + the new per-arg source field).
  - `accumulated_outputs` (executor) / the ordered `definition.phases` list (lint).
  - `ctx.inputs` (executor) / `definition.inputs[]` (lint).

#### 1c · How it is tested — `backend/tests/unit/test_213_gate55_execution.py`

**The leaf invariant is an AST assertion, not a comment** (`:28-44`):

```python
def test_leaf_module_invariant_does_not_import_harness_engine():
    """D-213-00: grants.py is a strict leaf and must never import phase_types or harness_engine."""
    import app.services.connectors.grants as grants_mod
    with open(grants_mod.__file__, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())

    imported_modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module)

    for mod in imported_modules:
        assert "phase_types" not in mod, f"grants.py imported phase_types: {mod}"
        assert "harness_engine" not in mod, f"grants.py imported harness_engine: {mod}"
```

The file's own docstring names the two-part structure to copy: *"1. Pure unit tests over
`app.services.connectors.grants` … 2. Gate 5.5 posture enforcement inside `_exec_external_action`
across both MCP and Capability shapes."* **That second half is the test that mocks neither side of
the seam** — CONTEXT's `⚠ What Phase 213 taught` requires exactly one such test here.

#### 1d · Does `grants.py` import from `harness/`? — **NO.** Its entire import set is
`logging` + `typing`. `args.py` must match: it may import `descriptors`/`protocol` siblings inside
`connectors/`, and nothing from `harness/`.

#### 1e · The CUT itself — copy `human_input.py`'s discipline, not just its outcome

`human_input.py:1-48` records four rules the `phase_types.py` leaf-cut must repeat:

1. **A VERBATIM move, script-driven, with pre-move line boundaries asserted first**
   (`human_input.py:11-15`): *"The cut was driven by a script that asserted the pre-move line
   boundaries first and aborted on drift … CONTEXT's own pointers were ~54 lines stale."*
   ⚠ CONTEXT's own pointers here (`:2151` for `_adapter_args`) are **already stale — it is at
   `:2125`.** Re-derive at plan time.
2. ⚠ **THE RE-IMPORT IS LOAD-BEARING** (`:16-23`): `phase_types.py` re-imports the moved names so
   every consumer and every registry entry stays character-identical. *"There is ONE object, not
   two."* Do not "tidy" it away.
3. **The leaf invariant is stated at its REAL strength** (`:31-36`) — `human_input.py` could not
   be a true leaf, so its rule is the narrower true one: *never import `phase_types` back.*
   `args.py` CAN be a true leaf (grants.py is), so state the stronger rule and assert it.
4. ⚠ **THE PATCH SURFACE MOVES WITH THE FUNCTION** (`:38-44`): nine `mock.patch` sites across five
   shipped test files had to be repointed, *measured RED first*. Grep for
   `patch("app.services.harness.phase_types._adapter_args"`-shaped sites before the cut.

#### 1f · The binding constraint, stated against the code it must replace

The predicate has to subsume what `_adapter_args` does today (`phase_types.py:2125-2149`):

```python
def _adapter_args(adapter, capability: str, resolved: dict) -> dict:
    """...
    **No expression language, no templating surface** (D-09). This is a closed two-column
    lookup; where a field must be COMPOSED the shipped ``SandboxedEnvironment(autoescape=True)``
    path is the only one that may do it, and this phase composes nothing.
    """
    declared = set(adapter.INPUT_SCHEMA.get("properties", {}))
    args = {key: value for key, value in resolved.items() if key in declared}
    body_arg = _BODY_ARG_FOR_CAPABILITY[capability]
    if body_arg in declared and body_arg not in args and resolved.get("content"):
        args[body_arg] = resolved["content"]
    return args
```

…and the invisible auto-fill D-214-03 makes visible is those last three lines, keyed by
(`phase_types.py:2056-2073`):

```python
_BODY_ARG_FOR_CAPABILITY: dict[str, str] = {
    "send_email": "body",
    "create_ticket": "description",
    "post_message": "text",
}

assert (
    set(_PRE_CREDENTIAL_DESTINATION)
    == set(_BODY_ARG_FOR_CAPABILITY)
    == set(EXTERNAL_ACTION_CAPABILITIES)
), (...)
```

⚠ **That module-scope `assert` moves with the map or breaks.** It is the D-04 three-way key
identity and it fires at import time.

⚠ **`_external_action_inputs` (`:1861-1908`) already carries the `_NON_ACTION_RUN_INPUTS`
exclusion-BY-NAME rule** — *"Excluded by NAME, never by heuristic. A prefix rule or a type test
would silently eat a real action input."* Any new source-arm resolution keeps that posture.

---

### 2 · The argument editor — NEW component (component, request-response)

**Analog:** `frontend/src/components/workflows/GovernanceSection.tsx` (435 L) and
`ExternalActionSection.tsx` (176 L).

#### 2a · ⚠ CONTEXT's claim VERIFIED — "one import plus one gated JSX expression" is **TRUE, and it is exactly two lines each**

Measured in `PhaseFormPanel.tsx` at HEAD:

| Component | import | mount |
|---|---|---|
| `ExternalActionSection` | `:69` | `:1473` |
| `GovernanceSection` | `:78` | `:1494` |

The literal mount lines:

```tsx
// PhaseFormPanel.tsx:1473 — inside the `card-outside` StepCardSection
<ExternalActionSection key={phase.slug} capability={asStr(cfg.capability)} toolName={asStr(cfg.tool_name)} onChange={set("capability")} onChangeShape={onChange} onPersist={onPersist} />

// PhaseFormPanel.tsx:1494 — top-level, gated on `rails`
{rails && <GovernanceSection phaseType={pt} availableTools={asList(cfg.available_tools)} kbTools={rails.kbTools ?? []}
  citationPolicy={asStr(cfg.citation_policy)} groundingEscalated={phase.grounding_escalated === true}
  actionRiskArmed={phase.action_risk_armed === true} onGovernanceChange={onGovernanceChange} />}
```

⚠ **The claim is verified with ONE correction to its framing:** `ExternalActionSection` is mounted
INSIDE a `<StepCardSection>` wrapper (`:1461-1474`), not at panel top level. The argument editor
belongs in that same `card-outside` section (it is the same step's outbound surface), so its
insertion is **one import + one line inside an existing wrapper** — smaller than
`GovernanceSection`'s. `TemplateNameCheck` (`:1481`) and `TemplateAttachSection` (`:1492`) are two
more instances of the same one-gated-line shape.

⚠ **AND THE PANEL IS ALREADY BEING EDITED THIS PHASE ANYWAY.**
`ExternalActionSection.tsx:96-116` carries a re-open trigger that names this phase:

```
   * They stay in the prop contract because removing them would edit `PhaseFormPanel.tsx`,
   * which is outside this plan's `files_modified` and therefore outside its review. An
   * unused optional prop is a smaller debt than an unreviewed edit to a 2,800-line panel on
   * the hot-file ledger.
   *
   * RE-OPEN TRIGGER: *the first phase whose `files_modified` names `PhaseFormPanel.tsx`* —
   * at which point all three come out in one commit, with the panel's call site.
```

So `onChange` / `onChangeShape` / `onPersist` come off both the interface AND the `:1473` call
site in this phase's commit. **This makes the G-5 "honoured by construction" argument STRONGER,
not weaker:** the panel's net diff is one added import, one added JSX line, and three deleted
props.

#### 2b · The whole-file shape to copy — `ExternalActionSection.tsx`, property by property

Its header (`:1-52`) names the five properties by which it was itself copied from
`GovernanceSection.tsx`. The new component must reproduce all five:

1. **No sentence of its own** — every string is an imported identifier
   (`ExternalActionSection.tsx:57-63`):
   ```tsx
   import { useId } from "react"

   import {
     EXTERNAL_ACTION_HEADING,
     EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE,
   } from "@/components/workflows/definitionOps"
   import { type ExternalActionShape } from "@/components/workflows/externalShapeVocabulary"
   import { EXTERNAL_CAPABILITY_SENTENCES } from "@/components/workflows/phaseVocabulary"
   import { ConnectionPicker } from "./ConnectionPicker"
   ```
   → the phase's `argumentVocabulary.ts` is that import target.
2. **Consults no server** — a `?raw` source fence with a positive control proves it (§ Shared
   Patterns C).
3. **Class constants at module scope, never inline** (`:117-119`):
   ```tsx
   const SECTION_CLASSES = "col-span-2 rounded border border-border bg-muted/40 px-2.5 py-2"

   const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"
   ```
4. ⚠ **No runtime `export const` beside a component** (`:64-77`) — it is a
   `react-refresh/only-export-components` lint ERROR, **measured** (`eslint
   src/components/workflows/` went 5 → 10 on that rule). Derived constants stay module-private and
   the suite reads them from their ONE vocabulary home.
5. **A leaf: reads no context, fetches nothing, holds no store reference** (`:50-51`).
   The one exception is `ConnectionPicker`, *"the only child on this surface holding a store
   reference"* — which is where the argument editor's writes route (§2c).

**Derive during render; never fabricate** (`ExternalActionSection.tsx:120-124`):

```tsx
  // DERIVED DURING RENDER. An unrecognised or absent stored value derives NOTHING and
  // NEVER fabricates a row — the same rule `derivedFace` applies to the node face, which
  // falls through to the type sentence for exactly these values.
  const selected = EXTERNAL_ACTION_CAPABILITIES.includes(capability) ? capability : null
```

→ **this is D-214-08's unmatched-key rule and D-214-07's unknown-schema rule already written
down.** A `tool_args` key with no schema property derives NOTHING as a field and is surfaced as a
leftover; it is never dropped and never invented.

**`data-` attributes carry a SHAPE, never a wire id** (`ExternalActionSection.tsx:126-137`) — and
the file's own header states *"THE RAW CAPABILITY ID NEVER REACHES THE DOM FROM THIS FILE"*, which
is sketch 214 invariant #13 and sketch 216 invariant #4 verbatim.

#### 2c · Where the writes go — `ConnectionPicker.tsx`, which already owns them

```tsx
// ConnectionPicker.tsx:411-419
  const handleChangeArgs = useCallback(
    (args: Record<string, unknown>) => {
      if (store === null || slug === null) return
      store.getState().patchConfig(slug, { tool_args: args })
      store.getState().flushHistory()
    },
    [store, slug],
  )
```

Two binding rules on that surface, both already written and both load-bearing for D-214-01:

```tsx
// ConnectionPicker.tsx:394-395
   * ⚠ `tool_args` CLEARS WITH `tool_name`, NEVER WITHOUT IT — arguments for a tool that no
   * longer exists are the half-clear `ExternalActionSection`'s AR-05 reasoning refused.
```

```tsx
// ConnectionPicker.tsx:521-530 — the bind write
  const bind = (id: string | null) => {
    if (store === null || slug === null) return
    store.getState().patchConfig(slug, {
      connection_id: id,
      capability: undefined,
      tool_name: undefined,
      tool_args: undefined,
    })
    store.getState().flushHistory()
  }
```

⚠ **A new per-argument SOURCE field must join both clears in the same commit** — a source map for
a tool that no longer exists is the identical half-clear hazard, one field over.

The current `tool_args` read is a JSON-string `useSyncExternalStore` snapshot
(`ConnectionPicker.tsx:362-376`) — a `JSON.stringify`/`JSON.parse` round trip used purely to get a
stable identity for the store subscription. It stays; the editor consumes the parsed
`Record<string, unknown>`.

#### 2d · Deletion target — `McpToolPicker.tsx`

```tsx
// :68
export const MCP_TOOL_ARGS_LABEL = "Tool Arguments (JSON)"
```

The whole surface to remove: `:37` (`import { Textarea }`), `:212-217` (`argsJsonString` +
`jsonError` state), `:259-284` (`handleArgsChange`), `:610-638` (the `<Label>`/`<Textarea>`/
`{jsonError && …}` block, `data-testid="mcp-tool-args"` and `"mcp-args-error"`).
⚠ `onChangeArgs` is a prop on `McpToolPickerProps` and is wired from `ConnectionPicker`'s
`handleChangeArgs` — the prop stays (the new editor needs it), only the JSON surface goes.

---

### 3 · The failure-reason read seam (D-214-23) — `backend/app/db/workflows.py:1370-1386`

**Analog — THE prior art, and it is a shared helper rather than an idiom to re-type:**
`backend/app/models/thread.py::phase_output_object` (`:48-140`).

#### 3a · The exact parsing idiom (`models/thread.py:118-140`)

```python
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            decoded = json.loads(raw)
        # ⚠ `RecursionError` IS NOT A `ValueError`, AND THIS FUNCTION'S CONTRACT SAYS IT NEVER
        # RAISES. `json.loads` recurses per nesting level, so a deeply-nested payload —
        # `"[[[[...]]]]"` — blows the interpreter's stack and escapes a `(ValueError, TypeError)`
        # catch entirely. ...
        except (ValueError, TypeError, RecursionError):
            return None
        return decoded if isinstance(decoded, dict) else None
    return None
```

Its contract, verbatim from `:76-79`: *"A `dict` passes through unchanged. A `str` is
`json.loads`-ed and returned ONLY if it parses to a dict. `None`, a non-`str` non-`dict`, an
unparseable string, and a string that parses to a list / number / bool / null all return `None`."*

⚠ **`RecursionError` must be in the catch tuple.** It inherits from `RuntimeError`, not
`ValueError`, and the input is model-influenced. This was found by a code review, not by design.

#### 3b · How the consumer uses it — ONE parse per row, feeding every fact

`api/workflow_runs.py:764-778` is the shipped call site and the idiom to copy exactly:

```python
    for row in phase_rows:
        # ── 200.1 (RUN-04) — ONE parse per row, feeding BOTH reads ──
        # `phase_output_object` tolerates the jsonb string scalar AND the object shape;
        # a dict passes straight through `declared_phase_measure`'s own call to the same
        # helper, so handing it `obj` rather than the raw value changes no behaviour and
        # keeps the parse count at one. One parse, one home, two facts.
        obj = phase_output_object(row.get("output"))
        count, noun = declared_phase_measure(obj)
        raw_text = obj.get("text") if isinstance(obj, dict) else None
        deliverable_text = raw_text if isinstance(raw_text, str) and raw_text else None
```

→ **`_failure_reason` becomes the THIRD fact off that same single parse.** Do not add a second
door. The module import comment (`api/workflow_runs.py:69-76`) states the rule:

```python
# 200.1 (D-200.1-01) — `phase_output_object` is that same home's READ-SIDE UNWRAP, and the
# serializer below parses each row ONCE through it. `output` is a jsonb STRING SCALAR on
# 484 of 484 `completed` rows, so a second `isinstance(raw, dict)` test anywhere in this
# module would be dead on every row that matters — silently, because the absent arm renders
# honestly. There is one door; this module reads through it and never beside it.
from app.models.thread import declared_phase_measure, phase_output_object
```

⚠ **A weaker, string-tolerant-but-NOT-shared alternative also exists in this repo and should
NOT be copied:** `db/workflows.py:1447-1466` (`get_latest_completed_workflow_run`) re-implements
the unwrap inline with a bare `except Exception` and a `{"text": raw_output}` fallback. It is a
second copy of the read, which is precisely what `phase_output_object`'s docblock forbids. Note it
in the plan as an existing divergence, do not extend it.

#### 3c · The WRITER whose shape must be parsed — `db/workflows.py:1822-1842`

```python
async def fail_phase(
    pool: asyncpg.Pool, phase_id: UUID, reason: str, output: dict | None = None
) -> None:
    """...``_failure_reason`` always wins on a key collision (it is the status-repair scripts' key)."""
    payload: dict = {**(output or {}), "_failure_reason": reason}
    await pool.execute(
        "UPDATE workflow_phases SET status='failed', output=$2::jsonb, updated_at=now(), completed_at = now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'",
        phase_id,
        payload,
    )
```

⚠ `fail_phase` is ALREADY on the 200.1 writer repair (it binds the plain dict, not
`json.dumps(...)`). **New rows land as jsonb OBJECTS; the 38 historical string-scalar rows do
not.** So the read repair is the load-bearing half here, exactly as D-200.1-01 says — the writer
is already right.

#### 3d · The read to widen — `db/workflows.py:1370-1386`

```python
async def load_run_phases(pool: asyncpg.Pool, run_id: UUID) -> list[dict]:
    """All phases for a run, in ``phase_index`` order (resumability substrate).

    RUN-KEYED read → ``workflow_run_id`` (NOT ``run_id`` — that column does not
    exist on workflow_phases; would raise Postgres 42703).
    """
    rows = await pool.fetch(
        """
        SELECT id, slug, phase_index, status, output, started_at, completed_at
        FROM workflow_phases
        WHERE workflow_run_id = $1
        ORDER BY phase_index
        """,
        run_id,
    )
    return [dict(r) for r in rows]
```

⚠ **`output` IS ALREADY SELECTED — on all three readers.** `api/workflow_runs.py:755`
(`.select("slug, phase_index, status, started_at, completed_at, output")`) and
`api/threads.py:1204-1207` too. **No SELECT widens; no new column exists; no migration.** The
whole gap is projection.

⚠ **THE `.select()` STRING IS BYTE-PINNED.** `api/workflow_runs.py:750-754`: *"THE `.select()`
STRING BELOW IS BYTE-UNCHANGED BY 200.1 and must stay so … A `.select("*")` would also 'work' and
would WEAKEN the read; reject it (asserted at zero occurrences by this module's suite)."*

#### 3e · ⚠ THE TWO-WIRE-MODEL RULE — both models widen in the SAME commit

`models/thread.py:210-218`, verbatim:

```python
    # ⚠ THIS IS A SECOND, INDEPENDENT WIRE MODEL FOR THE SAME `workflow_phases` ROWS, and
    # that is why these fields are duplicated here rather than shared. `WorkflowRunPhaseRead`
    # (`api/workflow_runs.py`) feeds the RUN PAGE through a canvas-gated route; this one
    # feeds the CHAT surface's workspace panel (PhaseTimeline / PhaseCard) through an
    # UNGATED one. **Widening only the other model would ship a run page with durations and
    # a chat panel without them** — the same facts, two surfaces, silently disagreeing.
    # The two models must be widened in the SAME commit; they are the two halves of one
    # contract, not a model and its copy.
```

⚠ **AND THE ONE RECORDED EXCEPTION DOES NOT APPLY HERE.** `D-200.1-02-A` (`:220-234`) declined to
add `deliverable_text` to `WorkflowPhaseState` **because the chat surface already renders that
text as the assistant's message**. Nothing renders the failure reason on the chat panel today —
`PhaseCard.tsx:253` fires `reason_unknown` instead. So the rule applies at full strength, and
CONTEXT's failure mode #6 (*"the panel says 'Failure reason not captured' while chat shows the
reason"*) is exactly the disagreement the rule exists to prevent.

Three sites, one commit:
- `api/workflow_runs.py` — `WorkflowRunPhaseRead` + the `:764-778` loop.
- `models/thread.py` — `WorkflowPhaseState` (:240-243 is where the last four additive fields sit).
- `api/threads.py:1234-1247` — the builder, which today reads
  `_count, _noun = declared_phase_measure(r["output"])` **directly off the raw value**:

```python
            for r in phase_rows:
                _count, _noun = declared_phase_measure(r["output"])
                phases_list.append(
                    WorkflowPhaseState(
                        slug=r["slug"],
                        phase_index=r["phase_index"],
                        status=r["status"],
                        phase_type=slug_to_type.get(r["slug"]),
                        started_at=r["started_at"],
                        completed_at=r["completed_at"],
                        step_count=_count,
                        step_noun=_noun,
                    )
                )
```

→ port it to the `obj = phase_output_object(...)` parse-once shape first, then read both facts
off `obj`.

#### 3f · Where it is tested — `backend/tests/unit/test_200_1_phase_output_shape.py`

Its own docblock (`:1-20`) is the acceptance shape to reproduce:

```
  1. the read-side unwrap contract, INCLUDING a driven counterfactual that reproduces the
     old behaviour after the source is fixed — a fence that was never driven RED is a
     fence that could not fire; and
  2. the writer fence (Task 2), which proves new rows land as jsonb OBJECTS and that the
     SQL literals moved not one byte.

⚠ THE COUNTERFACTUAL IS A LOCAL RE-STATEMENT OF THE OLD GUARD, never an import of it.
Asserting against the shipped function post-fix would assert the fix against itself.
```

It imports `fail_phase` already (`:36`) and pins SQL byte-identity against a base SHA via
`git show` (`:41-56`). **The RED driver D-214-23(b) demands is a string-scalar `output` fixture on
a `failed` row** — that file already builds exactly that fixture shape (`:57-60`).
Frontend side: `grep -rn "_failure_reason" frontend/src` returns **ZERO** today; the client type
work is `types/index.ts` (`Phase`, whose `error` doc at `:188` says *"Only available for
live-streamed runs (not backfilled from DB)"* — that sentence stops being true) and
`lib/api/workflows.ts:534-564` (`WorkflowRunPhase`).

#### 3g · The sentinel — narrow the CONDITION, never the words

`panel/PhaseCard.tsx:236-256`:

```tsx
function classifyFailure(phase: Phase): ClassifiedFailure {
  const raw = (phase.error ?? "").trim()
  const slug = phase.slug || "this phase"
  ...
  // reason_unknown — MANDATORY fallback when the error/reason is empty. Never an
  // empty red card (DATA-CONTRACT §6).
  if (raw.length === 0) {
    return {
      kind: "reason_unknown",
      reason:
        "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success.",
      where: `phase: ${slug} · error field was empty`,
    }
  }
```

⚠ **`raw` is the ONE line that changes** — it becomes `(phase.error ?? phase.failureReason ??
"").trim()` or equivalent. The `reason_unknown` block is untouched (sketch 216 §4: *"Its condition
narrows; its words do not change"*), and `FAILED_REASON_UNKNOWN` in the new
`stepIdentityVocabulary.ts` is that string **character-identical** — copy it from here, do not
re-type it. Note that `where: "… error field was empty"` becomes literally false once a second
source exists; the plan must decide whether that clause is re-worded.

---

### 4 · The shared step-identity element (D-214-16/17) — NEW component

**Analog:** `frontend/src/components/settings/connectionMark.tsx` (294 L) for the mark;
`frontend/src/lib/phaseGlyph.tsx` (the shared-lib precedent) for where a cross-surface mark lives;
the `titleOf` prop seam for the name.

#### 4a · ⚠ `connectionMark.tsx` MOVES OR IS SHARED FREELY — measured, it has no `settings/` coupling

**Its complete import set** (`:83-115`):

```tsx
import type { ComponentType, SVGProps } from "react"
import { Mail, Plug } from "lucide-react"
import SlackIcon from "~icons/logos/slack-icon"
import JiraIcon from "~icons/logos/jira"
import McpIcon from "~icons/logos/model-context-protocol-icon"
import GithubIcon from "~icons/logos/github-icon"
import NotionIcon from "~icons/logos/notion-icon"
import GoogleIcon from "~icons/logos/google-icon"
import FigmaIcon from "~icons/logos/figma"
import LinearIcon from "~icons/logos/linear-icon"
import SentryIcon from "~icons/logos/sentry-icon"
import IntercomIcon from "~icons/logos/intercom-icon"
import MiroIcon from "~icons/logos/miro-icon"
import { cn } from "@/lib/utils"
```

**Zero imports from `components/settings/`, zero from `@/lib/api`, zero from any store or
context.** The `@/lib/api` abstention is deliberate and documented (`:133-139`): its input type is
**structural**, not `ConnectorConnection` —

```tsx
export interface ConnectionMarkShape {
  service_id?: string | null
  capability?: string | null
  mcp_server_url?: string | null
  tool_name?: string | null
}
```

*"A whole `ConnectorConnection` satisfies it, and so does a filter chip's bare `{ capability }`,
without this module importing from `@/lib/api`."*
→ **A run-surface phase config satisfies it too.** No widening is needed for the new consumers.

**Its exports** (4):

| Export | Line | Shape |
|---|---|---|
| `type ConnectionMark` | `:126` | `ComponentType<SVGProps<SVGSVGElement> & { size?: number \| string }>` |
| `type ConnectionMarkInk` | `:129` | `"self" \| "fill" \| "stroke"` |
| `interface ConnectionMarkShape` | `:140` | the structural input above |
| `interface ConnectionMarkEntry` | `:148` | `{ key: string; Mark: ConnectionMark; ink: ConnectionMarkInk }` |
| `const CONNECTION_MARK_KEYS` | `:199` | `Object.keys(MARKS)` — **the CAPABILITY keys only** |
| `function connectionMark(shape)` | `:204` | TOTAL; never null |
| `function ConnectionMarkGlyph({shape, size})` | `:285` | the ONE render path |

⚠ The maps themselves (`MARKS` :155, `MCP_MARK` :162, `NEUTRAL_MARK` :165, `SERVICE_MARKS` :168)
are **module-private and that is load-bearing** — same rule `phaseGlyph.tsx:47-50` states for its
own map: *"a second consumer reading the map directly would bypass `phaseGlyph()`'s own-property
guard."*

**Its ONE current consumer** is `ConnectionsTab.tsx:94` (`import { ConnectionMarkGlyph } from
"@/components/settings/connectionMark"`), plus two test files. **Move cost: one import line.**

**Verdict for the plan:** `frontend/src/lib/` is the shipped home for a cross-surface mark
resolver — `lib/phaseGlyph.tsx` and `lib/providerLogo.tsx` are both there, and `connectionMark.tsx`
itself already declares a local alias of `lib/phaseGlyph.tsx:66`'s `PhaseMark` with the reason
recorded (`:118-124`): *"if those ever diverge the widening belongs HERE — `lib/phaseGlyph.tsx` is
a `lib/` leaf with other consumers and must not be widened to accommodate a
`components/settings/` need."* ⚠ **Moving `connectionMark.tsx` to `lib/` makes that local alias
question live again** — record the decision either way, do not let the two type declarations
silently converge or diverge.

#### 4b · The size axis — the sketch asks for FOUR, the module has THREE

```tsx
// connectionMark.tsx:266-271
const SIZE_CLASS: Record<"row" | "chip" | "canvas", string> = {
  row: "h-4 w-4 flex-none",
  chip: "h-3 w-3 flex-none",
  canvas: "h-8 w-8 flex-none",
}
```

Sketch 216 counts *"19 step identities across 5 surfaces and 4 sizes"* and its invariant #1 says
*"size is a modifier, never a fork … assert the size prop selects a class rather than a branch."*
→ **Widen this Record by one key; do not branch.** The one render path stays:

```tsx
// connectionMark.tsx:285-294
export function ConnectionMarkGlyph({ shape, size }: { shape: ConnectionMarkShape; size: "row" | "chip" | "canvas" }) {
  const { Mark, ink } = connectionMark(shape)
  return <Mark aria-hidden="true" className={cn(SIZE_CLASS[size], INK_CLASS[ink])} />
}
```

⚠ `aria-hidden="true"` is correct and stays: *"a mark is never the accessible name of anything
here."* The identity's accessible name is its two words.

#### 4c · The INK contract — sketch 216 invariant #6 is testing THIS

```tsx
// connectionMark.tsx:273-277
const INK_CLASS: Record<ConnectionMarkInk, string> = {
  self: "",
  fill: "fill-current text-muted-foreground",
  stroke: "text-muted-foreground",
}
```

Three inks, each with a measured reason (`:64-84`): `self` adds nothing (Slack's 4 and Jira's 3
elements carry their own fills); `fill` is MCP + Intercom ONLY (bodies with zero fills and no
`currentColor`, invisible on Deep Midnight otherwise); `stroke` is lucide, and ⚠ **never a fill
utility** (lucide sets `fill="none" stroke="currentColor"` as presentation attributes and a CSS
rule on the same element beats them, filling the outline into a blob).
Tested at `frontend/src/components/settings/__tests__/connectionMark.test.tsx:430-470` — the
"resolved-but-EMPTY / resolved-but-IDENTICAL / resolved-but-INVISIBLE" block, reading
`svg.innerHTML` (`:54`). **Port that block, don't restate it in prose** — sketch 216 #6 says the
import fence structurally cannot catch invisibility.

#### 4d · The NAME half — the `titleOf` prop seam, already shared across three of the five surfaces

```tsx
// pages/WorkflowRunPage.tsx:983-991
  const titleBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const spec of specs) m.set(spec.slug, nodeTitle(spec))
    return m
  }, [specs])
  const titleOf = useCallback(
    (slug: string) => titleBySlug.get(slug) ?? slug,
    [titleBySlug],
  )
```

Passed to `RunSpine` / `RunStepList` / `RunTranscript` at `:1476`, `:1506`, `:1515`, `:1557`, and
consumed at `RunSpine.tsx:184,319`, `RunStepList.tsx:105,164,221`, `RunTranscript.tsx:349,616`.

**The resolver behind it** is `phaseVocabulary.ts:290-299`:

```tsx
export function nodeTitle(phase: PhaseSpecJSON, ctx: NameContext = NO_NAME_CONTEXT): string {
  const name = phase.name?.trim()
  if (name) return name
  const derived = derivedFaceOf(phase, ctx)
  if (derived) return derived
  const type = phase.config?.phase_type ?? ""
  return PHASE_TYPE_SENTENCES[type] ?? type
}
```

Its two floors (`:276-282`) are exactly the STEP-04 and sketch-215 invariants:
*"The SLUG NEVER appears in this string"* and *"A name is NEVER fabricated … an id-shaped face is
worse than a generic one."*

⚠ **The pattern the new element must follow is D-214-14's:** the CALLER resolves, the component
renders. `titleOf` is that pattern for the name; `service` (resolved from the connection row, not
from `config.capability`) is the same pattern for the service. **`RunSpine.tsx:30` already records
it**: *"the step's HUMAN NAME — the page's `titleOf`, the same `nodeTitle` the canvas paints."*
`PhaseCard`/`PhaseTimeline` (the chat panel) have no `titleOf` today — they read `Phase` from
`StreamsProvider`, so the element must accept its two strings as props rather than resolving them,
or the two surfaces will disagree.

#### 4e · The canvas glyph vocabulary — `references/icon-convention.md` §4, read before drawing

**Nothing new may be drawn.** §4's shipped table (with sources) is: `⛨` governance seal
(`NodeCornerMarks.tsx:266`) · `🔒` locked/one-way · `⤳` on-fail branch · `＋`/`✕` add/remove **on
the lane, never the card** · `↶`/`↷` undo/redo · `◆` a gauntlet stage · the **7** phase-type marks
from the ONE shared 3D map. Plus three standing rules:

- ⚠ **the top-right corner is CLAIMED by the governance seal** — sketch 215 invariant #10 (*"the
  blocked node's mark is an edge lane, never the top-right corner"*) is this rule, and D-185 owns
  it;
- **the word-badge carries NO glyph** (`PhaseNode.tsx`'s `waitsForYou` slot has a label and no
  glyph — *the WORD carries the meaning; tone is decoration*);
- **net-new marks must be FLAGGED as proposals**, and *"a sketch touching the canvas should be
  greppable for glyph literals, and every one should trace to a row in the table above."*

§1: one source for provider/model marks (`@lobehub/icons` via `lib/providerLogo.tsx`) — *"reuse
the seam, don't re-map per component."* `connectionMark.tsx` is the SERVICE analog of that seam
and D-214-17 forbids re-mapping it.

---

### 5 · The publish-gate lint (D-214-09/10) — `publish_service.py` stage 2

**Analog:** the stage-2 block itself, and `reachability.py::_check_input_contracts`.

#### 5a · The exact shape of a stage-2 lint (`publish_service.py:174-188`)

```python
    # ── stage 2: structural lint (pure; short-circuits BEFORE the golden run) ─────
    lint_errors = lint_workflow(definition)
    if lint_errors:
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="lint",
            named_failures=[
                {"code": e.code, "phase": e.phase_slug, "message": e.message}
                for e in lint_errors
            ],
            golden_run_id=None,
        )
```

Four sibling stages use the identical `return await _block(...)` form —
`stage="definition_invalid"` (:150), `"business_requirement"` (:163), `"lint"` (:176),
`"interactive_phase"` (:222), `"grounding"` (2.6). **A sibling lint stage is ~14 lines** and
CONTEXT leaves extend-vs-sibling to Claude's discretion; the file's own ordering rationale
(`:236-242`) is the argument to reproduce: *"it needs exactly what `/validate` needs — the
definition, the owner, and the server-side registries — and nothing whatsoever from a run."*

⚠ **A new lint stage MUST carry an ordering rationale comment.** Stage 2.5's block (`:190-218`) is
the shape: what it blocks, why it is cheap, and — critically — a preserved-and-corrected deferral
rather than a deleted one.

#### 5b · How a refusal is returned (`publish_service.py:460-494`)

```python
async def _block(
    pool,
    *,
    run_id,
    user_id,
    definition_id,
    stage: str,
    named_failures: list,
    golden_run_id,
) -> dict:
    """Write a ``publish_blocked`` receipt + return the D-08 structured verdict."""
    await _safe_audit(
        pool,
        run_id,
        user_id=user_id,
        event_type="publish_blocked",
        metadata={
            "definition_id": str(definition_id),
            "blocked_stage": stage,
            "named_failures": named_failures,
            "golden_run_id": str(golden_run_id) if golden_run_id else None,
        },
    )
    return {
        "published": False,
        "blocked_stage": stage,
        "named_failures": named_failures,
        "golden_run_id": golden_run_id,
    }
```

`_safe_audit` (`:497-515`) swallows a receipt-write failure *"a receipt-write failure NEVER fails
the publish … The receipt is the governance trail, not the gate."*
⚠ `named_failures` is a `list` of **either strings or dicts** depending on the stage — stage 2
emits `{"code", "phase", "message"}` dicts. **STEP-03's five refusal kinds (sketch 215 §4) map
onto `code`**, and the step name / argument name are extra keys the frontend composes from. The
backend must not compose the English sentence: D-213-15/-16 put refusals *in the backend gate* but
sketch 215 §1 puts the words in `publishRefusalVocabulary.ts` and asserts them for character
identity — so the wire carries **kind + step name + argument name**, and the client composes.

#### 5c · How refusals are worded and tested elsewhere in the flow

- **The predicate is shared, never duplicated** (`publish_service.py:160-162`): *"The predicate is
  the SHARED `grounding.business_requirement_missing` (Phase 182) — behavior identical, now one
  source with the canvas `/validate` seam."* ⭐ **That is D-214-00's mechanical argument already
  won once in this same file** — cite it in the plan.
- **The message constant is a named import, not an inline string**: `BUSINESS_REQUIREMENT_MISSING_MESSAGE`
  (`:170`), with *"ONE source with the /validate seam — see the constant's docblock."*

#### 5d · The predicate shape STEP-03 copies (`reachability.py:70-87`)

```python
def _check_input_contracts(phases) -> list[LintError]:
    """D-10 INPUT_UNSATISFIED: a phase's input_keys must be satisfiable by an
    upstream phase output (its slug, or a declared output_key) OR a known run input.
    Mirrors the executor's resolution (accumulated_outputs key OR run_inputs key)."""
    errors: list[LintError] = []
    produced: set[str] = set()
    for p in sorted(phases, key=lambda q: q.phase_index):
        input_keys = list(getattr(p.config, "input_keys", []) or [])
        for k in input_keys:
            if k not in produced and k not in _KNOWN_RUN_INPUT_KEYS:
                errors.append(LintError(
                    "input_unsatisfied", p.slug,
                    f"input_key {k!r} is never produced by an upstream phase or a run input",
                ))
        produced.add(p.slug)
        produced.update(getattr(p.config, "output_keys", []) or [])
    return errors
```

⚠ **The `produced` accumulator IS D-214-09's `From an earlier step` predicate**, already written:
a phase slug is upstream iff it is in `produced` at the moment this phase is visited. Reuse it;
do not write a second graph walk.

⚠ **`_KNOWN_RUN_INPUT_KEYS` (`:67`) MUST NOT BE WIDENED.** CONTEXT failure mode #10 names this
explicitly. The new check consults `definition.inputs[]` (`models/harness.py:567`), not this
allowlist. The allowlist keeps its own, narrower job.

**`LintError` and the ADD-A-CODE contract** (`reachability.py:31-63`):

```python
class LintError(NamedTuple):
    code: str
    phase_slug: str | None
    message: str
```

```python
# ADDING A CODE: a new ``LintError(...)`` code MUST be added to this set in the SAME
# commit. ``tests/unit/test_182_severity_codes.py`` scans this file's ``LintError(`` emit
# sites and fails when the two fall out of sync — the pairing is ENFORCED, not a
# convention, because a failures-only test differential cannot see a code that was added
# but never classified.
LINT_CODES: frozenset[str] = frozenset({
    "bad_index", "input_unsatisfied", "no_terminal", "orphan_phase", "unsatisfiable_skip",
})
```

⚠ **THIS IS A MECHANICAL, RED-DRIVEN GATE ON THIS PHASE.** If STEP-03's five kinds emit through
`LintError`, all five join `LINT_CODES` **and** `api/workflows.py`'s `/workflows/validate`
severity classifier (which composes its known set from `LINT_CODES` + grounding's) in the same
commit, or `test_182_severity_codes.py` goes red. Note also `reachability.py`'s purity claim
(`:53-54`): *"A plain set of strings: this module stays PURE (no I/O, no engine import), which is
exactly what lets `/validate` import `lint_workflow` import-light."* — `args.py` must be
import-light for the same reason, since the lint will import it.

---

### 6 · `RunModal.tsx:557-582` — the hint line that becomes real fields (brief)

The block to replace, verbatim (`:557-582`):

```tsx
          <div className="flex flex-col gap-2">
            {/* Declared input_keys → a HINT line only (never fake structured fields). */}
            <p data-testid="run-hint" className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              {anyAuthoredLabel ? (
                <span>
                  This workflow expects:{" "}
                  {inputFields.map((f, i) => (
                    <span key={`${f.key}-${i}`}>
                      {i > 0 && ", "}
                      {f.label ? (
                        <span className="text-foreground">{f.label}</span>
                      ) : (
                        <span className="font-mono text-foreground">{f.key}</span>
                      )}
                    </span>
                  ))}
                </span>
              ) : (
                <span>
                  This workflow expects: <span className="font-mono text-foreground">{keys.join(", ")}</span>
                </span>
              )}
            </p>
```

Three things the plan inherits from the surrounding docblock (`:490-556`):

1. **The refusal is CONDITIONAL, and the condition is now met.** The preserved-as-shipped block
   reads *"never fake structured fields … because nothing guaranteed the value would be used"*.
   D-214-04 supplies the guarantee. **Quote the original when replacing it** — that block is
   itself a worked example of the repo's keep-the-original-beside-the-correction rule
   (`:490-495`: *"the ORIGINAL IS KEPT VERBATIM RATHER THAN DELETED"*).
2. ⚠ **The two-arm/never-three rule survives**: *"An AUTHORED label is prose a human wrote → body
   face. A key with no label keeps the mono face it has always had. Two arms, never three:
   absence renders the key, never a fabricated friendly name."* A real field for an unlabelled key
   is labelled with the key, never with an invented sentence.
3. ⚠ **`RunModal.test.tsx` holds SIX whole-`innerHTML` captures** (`:551-556`). Replacing this
   block re-baselines them. Name that in the plan; do not discover it mid-run.

`InputFieldSpec.label` is a **required `str`** on the backend (`models/harness.py:504`) and
travels inside `WorkflowDefinition.inputs` (`:532`, list at `:567`).

---

### 7 · `doorVocabulary.ts:265` — the governed-refusal precedent (D-214-21) (brief)

```tsx
export const DESCRIBE_REFUSAL =
  "There is nothing here to draft from yet — describe the work in a sentence."
```

Its docblock (`:240-264`) carries five rules the new `DOOR_REFUSAL(...)` inherits:

- ⚠ **It describes a shipped rule; it does not create one.** *"A refusal SENTENCE is presentation;
  a refusal RULE would be behaviour."* → D-214-20's picker is the RULE, `DOOR_REFUSAL` is the
  sentence.
- ⚠ **It must never render at rest** — *"MECHANICAL … `WorkflowDoorSwitch.baseline.test.tsx` pins
  all six resting states byte for byte."* This is sketch 217 invariant #1.
- **No severity word, no exclamation, no mechanism: it names what is missing and what to do.**
- **The dash is an EM DASH (U+2014); the suite asserts the codepoint over the whole table.**
  → `DOOR_REFUSAL(...)`'s *"«service» is not connected — connect it in Settings, or describe this
  step without it."* uses the same character.
- **Never print a verdict nothing computes** (`:250-255`) — the reason the sheet's own vagueness
  caption was refused. Sketch 217 §4's whole-word-match-or-fall-back-to-unanchored rule is the
  same discipline applied to the anchor.

**The render site to extend** — `WorkflowDoorSwitch.tsx:246`, `:462-471`:

```tsx
  const refusingDescribe = describe.length > 0 && describe.trim().length === 0
  ...
            {refusingDescribe && (
              <div data-testid="describe-refusal" role="status" ...>
                <p className="text-[14px] leading-[1.5] text-destructive">{DESCRIBE_REFUSAL}</p>
```

Its idioms: `role="status"` not `alert` (*"the author is mid-typing"* — sketch 217 #14), the
**SPREAD-CONDITIONAL** for `aria-invalid` (`:428-431`) so the non-refusing DOM is character-identical,
and the disabled CTA that SAYS WHY (`DESCRIBE_CTA_REFUSED`, `:493-521`).
⚠ **CONFLICT TO RESOLVE AT PLAN TIME:** the shipped refusal spends `text-destructive` /
`border-destructive`; sketch 217 invariant #11 says the anchor *"spends warning, never
destructive"*, and sketch 214 #14 / 215 #9 assert `--destructive` is **absent** from the new
surfaces' rules. Two arms on one mechanism (sketch 217 §3) must not mean two colour budgets.

---

### 8 · `_GOVERNED_FEATURES` (D-214-19) — a seed row, not a migration (brief)

`backend/app/models/user_settings.py:1191-1214`:

```python
_GOVERNED_FEATURES: dict[str, str] = {
    "skill_studio": "operators",
    "model_management": "operators",
    "workflow_authoring": "everyone",
    "governance_health": "everyone",
    # Phase 181 (REVERT-01 / D-181-01,05): ... the 5th audience enum member "off" —
    # hidden from EVERYONE, operators included. This is the ONE authoritative cold default
    # (an unseeded feature_visibility key falls through to it), which is why NO migration is
    # needed: the app_settings.feature_visibility JSONB gains the key only on an operator
    # flip via set_feature_visibility's atomic `||` merge ("off" -> "everyone" and back).
    "visual_workflow_canvas": "off",
    # Phase 190 (CONN-03 / D-26): live outbound sending ...
    "live_connectors": "off",
}
```

**The change is `"off"` → `"everyone"` on ONE key**, plus its comment (which currently *describes*
the off default and would become false). `live_connectors` is untouched — the two comments must
stop being copies of each other.

⚠ **Deployment-artifact parity, same commit.** `scripts/check-deploy-drift.sh:32-38` checks the
**OPERATOR.md Step-3 seed table** (migration filenames) and hard-fails on a rename; it does **not**
today see `feature_visibility` — `grep -n "feature_visibility\|visual_workflow_canvas" docs/OPERATOR.md
scripts/check-deploy-drift.sh` returns **ZERO**. So the artifact half is a **documentation** update
to `docs/OPERATOR.md` Step 3 (`:137`), not a script change — but note it explicitly, because the
drift script cannot enforce what it cannot see.

The flip route is `admin.py:1077` → `set_feature_visibility(body.feature, body.audience, roles=...)`
(`user_settings.py:1295`), described at `admin.py:1055` as an *"atomic per-key JSONB `||` merge —
no lost-update clobber."*
⚠ **CONTEXT failure mode #7** — a criterion verified with the flag flipped by hand and the cold
default left `off` is Phase 209's exact failure. The change to `_GOVERNED_FEATURES` is what makes
the cold read correct; assert the COLD read, not a flipped DB.

---

## Shared Patterns

### A · Governed vocabulary, character-asserted (applies to all three new vocabulary modules)

**Source:** `frontend/src/components/workflows/doorVocabulary.ts` + `doorVocabulary.test.ts:1-55`
+ `frontend/src/components/workflows/__contracts__/doors-copy.generated.md`
**Apply to:** `argumentVocabulary.ts`, `publishRefusalVocabulary.ts`, `stepIdentityVocabulary.ts`,
and the `doorVocabulary.ts` additions.

The four rules, from `doorVocabulary.test.ts`'s own header:

1. **WHOLE-TABLE PROPERTIES, NEVER ROW ASSERTIONS.** *"a property stated only about the row being
   added is a property the next row can break in silence."* Nothing hand-lists an identifier —
   `ALL_DOOR_WORDS` is `Object.entries(doorVocabulary)`.
2. ⚠ **EXACT MATCH (`toBe`), NEVER A CONTAINMENT ASSERTION** — on these tables collisions are
   already the case (three door rows share one fragment). Demonstrated mechanically, not asserted
   in prose.
3. **The literal lives in the TEST, exactly once in the repository** (`COLUMN_D`), *"which makes
   the assertion a FALSIFICATION of the table rather than a copy of it"* — **and a further case
   RE-READS `BUILD-CONTRACT.generated.md` at test time and asserts the parsed column D equals
   `COLUMN_D`.** ⭐ That is the mechanism that binds these four sketch contracts to the build;
   copy it per new module.
4. **The leaf claim is ASSERTED, not documented** — `doorVocabulary.ts` imports NOTHING.
5. ⚠ **The 187-24 trap, which has fired on this exact surface twice:** a docblock that SPELLS a
   forbidden identifier makes a `?raw`-swept grep count its own prose. Assemble forbidden needles
   at runtime (`"EXTERNAL_SHAPE_" + "CAPABILITY_LABEL"`, `ExternalActionSection.test.tsx:333-334`).
   **This binds the deletion of `MCP_TOOL_ARGS_LABEL`**: the fence that proves it is gone must not
   name it in prose.

Composed-value ids (`ARG_READING_ASK(…)`, `REFUSE_NO_SOURCE(…)`, `STEP_IDENTITY(…)`) are functions
in the same module, asserted the same way. The existing composed precedent is
`branchConditionOf` / `EXTERNAL_CAPABILITY_SENTENCES` in `phaseVocabulary.ts:156-231`.

### B · "Its own component + one gated line" (the standing G-5 order on `PhaseFormPanel.tsx`)

**Source:** `ExternalActionSection.tsx:5-12` quoting the ledger row verbatim —
*"Keep this shape — the next surface that needs the panel gets its own component and one gated
line."*
**Apply to:** the argument editor. Four shipped instances to cite: `GovernanceSection` (:1494),
`ExternalActionSection` (:1473), `TemplateNameCheck` (:1481), `TemplateAttachSection` (:1492).
⚠ D-214-00 says the plan must **argue** this, not assume it. The argument is: net panel diff =
+1 import, +1 JSX line, −3 props (§2a).

### C · The `?raw` source fence with a positive control

**Source:** `frontend/src/components/workflows/ExternalActionSection.test.tsx:54-59`, `:296-334`
**Apply to:** the argument editor (no-server claim), the `MCP_TOOL_ARGS_LABEL` deletion sweep,
the "no textarea / no JSON / no key-value / no Advanced" fence (sketch 214 #1), and the
"no wire id reaches any run surface" fence extended to the five run surfaces (sketch 216 #4).

```tsx
import externalActionSectionSource from "./ExternalActionSection?raw"
// The CROSS-LANGUAGE half of D-23, read through the same `?raw` loader
// `definitionOps.test.ts:29` uses. ⚠ The obvious `node:fs` spelling is wrong here:
// `tsconfig.app.json` sets `types: ["vite/client"]` and nothing else, so a `node:*`
// import would add NEW errors to the tsc baseline every plan in this phase measures.
import harnessModelsSource from "../../../../backend/app/models/harness.py?raw"
```

The tree-wide sweep, with its non-vacuity control first (`:300-318`, `:326-334`):

```tsx
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>
    ...
    // NON-VACUITY FIRST — an empty glob makes every absence below free.
    expect(Object.keys(modules).length).toBeGreaterThan(200)
```

⚠ **A `?raw` import of a BACKEND `.py` file is the shipped cross-language fence idiom** — use it
for the `inputSchema`-derives-the-fields claim (D-214-05) rather than re-typing an adapter schema
into a fixture.

### D · One source, one branch — `inputSchema` for BOTH shapes

**Source:** `backend/app/services/connectors/descriptors.py:139-170`

```python
    return {
        "name": capability,
        "title": _TITLE_FOR_CAPABILITY[capability],
        "description": _DESCRIPTION_FOR_CAPABILITY[capability],
        # DERIVED from the adapter's own declaration — never retyped. See the docstring.
        "inputSchema": _plain_json(adapter.INPUT_SCHEMA),
    }
```

Two properties the field renderer depends on:
- `_plain_json` (`:122-136`) deep-copies the `MappingProxyType` — *"a read-only proxy is NOT
  JSON-serialisable … it is converted here, at the point of production."* So the client always
  sees plain JSON.
- The key set matches the MCP sanitizer's exactly (`mcp_client.py:340-352`), which forwards
  `name` / `description` / `inputSchema` always and `title` / `outputSchema` / `annotations` only
  when the server sent a usable value — *"absence stays meaningful."*
  ⚠ **WIDEN THE LIST, NEVER REMOVE IT** (`mcp_client.py:329-338`): *"a list of what we refuse
  cannot be made fail-closed (the measured v3.6 finding)."*

A concrete native schema the renderer is proved against — `jira_adapter.py:419-436`: flat `string`
properties, `required: [...]`, `additionalProperties: False`, each with a `description`. The
fail-closed unknown-key refusal is 20 lines below (`:452-456`):

```python
        unknown = sorted(set(args) - set(self.INPUT_SCHEMA["properties"]))
        if unknown:
            raise JiraArgumentsInvalid(f"undeclared argument(s) for create_ticket: {unknown}")
```

⚠ ⭐ **`smtp_adapter.INPUT_SCHEMA` (:293-311) declares EXACTLY `to`, `subject`, `body`** — Stitch's
`Cc` / `Reply to` rows are structurally refused (`SmtpArgumentsInvalid`, `:337`). **Never render a
field the schema does not declare.**

### E · Computed never stored (D-213-02, D-214-14, D-214-17)

**Source:** `grounding.py:1255-1294` (`_external_action_clause`) — the composer that stays pure:

```python
    config = getattr(phase, "config", None)
    if getattr(config, "phase_type", None) != "external_action":
        return ""

    tool = getattr(config, "tool_name", None) or getattr(config, "capability", None)
    if not tool:
        return ""

    service = getattr(config, "capability", None)
    where = f" through {service}" if service else ""
    clause = f' It will run "{tool}"{where}.'

    args = getattr(config, "tool_args", None)
    if isinstance(args, dict) and args:
        # Sorted so the sentence is stable across runs — an approval prompt that reorders
        # itself between a restart and its re-subscribe would read as a different request.
        rendered = ", ".join(f"{k}: {args[k]}" for k in sorted(args))
        clause += f" What it will send — {rendered}."
    return clause
```

**The measured tautology is `service = getattr(config, "capability", None)` on line 1281 — the
same value already in the tool slot on line 1279.** D-214-14's fix is a new parameter; the three
docblock rules above it are preserved verbatim:

- *"COMPOSED FROM `phase.config` ALONE, so this function stays PURE — no pool, no clock, no
  connection lookup."* → the SERVICE arrives as an argument; nothing else changes.
- *"NAME ONLY WHAT IS KNOWN … the service is simply not named rather than rendered as `None` or
  guessed."* → sketch 216 §3's third row: `It will run Post a message.` **Not "Unknown service".**
- *"THE ARGUMENTS ARE SHOWN HERE AND RECORDED NOWHERE. D-213-14 settled that asymmetry …
  This function must never become the source of an audit field."* → D-214-15's resolved-object
  change is display-only. The receipt's fixed key set is `_write_send_receipt`
  (`phase_types.py:2151-2190`): capability, connection id, destination host, raw_status, phase,
  phase_index, tool_name. **Nothing joins it.**

⚠ **Sorted-key stability is load-bearing** and must survive the switch to resolved args.

### F · Additive union / additive field, with the mechanism stated

**Source:** `frontend/src/types/index.ts:1022-1061` (`Phase.status`, widened three times) and
`lib/api/workflows.ts:554-563` (`step_count`'s `0`-vs-`null` rule).
**Apply to:** `Phase` gaining a failure-reason member, `WorkflowRunPhase` gaining `failure_reason`.
The discipline: state **why** the existing members cannot express the new fact, and name the
compiler-enforced consequence (`Record<Phase["status"], …>` forces every reader to state it).
⚠ Its sibling rule — `0` and `null` are different answers, never `?? 0` — transfers directly:
an **empty** failure reason and an **absent** one are different facts and must not collapse, or
the `reason_unknown` sentinel loses its meaning.

### G · A same-commit sync rule, three of which bind this phase

| Pair | Enforced by |
|---|---|
| a hot-file ledger ROW ↔ its `docs/HOT-FILE-LEDGER.md` SECTION | `scripts/check-claude-md-size.cjs` (200-char disposition cap) |
| a new `LintError` code ↔ `LINT_CODES` ↔ `/workflows/validate`'s classifier | `tests/unit/test_182_severity_codes.py` (scans `LintError(` emit sites) |
| `WorkflowRunPhaseRead` ↔ `WorkflowPhaseState` | `models/thread.py:210-218` (prose rule — **not** mechanically enforced) |
| `PHASE_GLYPH_MARK_KEYS` ↔ `soulData.PHASE_GLYPHS` | `soulData.test.ts` key-set identity |
| the sketch `BUILD-CONTRACT.generated.md` ↔ the vocabulary module | `doorVocabulary.test.ts`'s contract re-parse case |

⚠ **The third is the weakest and the one this phase most needs.** Consider making it mechanical
(a test asserting the two models' additive field sets agree) rather than inheriting a prose rule
that a phase can miss.

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| the chat launch form (D-214-04) | component | request-response | **Chat has no launch moment today.** `RunModal.tsx` is the nearest shape (a modal over `WorkflowDefinition.inputs[]`) but it is a library-page modal mounted from `WorkflowsPage`; nothing in `ChatArea` / `MessageInput` / `ChatLayout` opens a per-run form. The plan must decide the mount point; `ChatLayout.tsx` is the panel/route host and **fires G-5 at 21 phases**. Nearest partial precedent: `ChatLayout.launch.test.tsx` (an existing launch-path suite). |
| the per-argument SOURCE storage field | model | — | `ExternalActionPhaseConfig` is a `_StrictBase` (`extra='forbid'`) and D-13 deliberately kept it to `connection_id` + the action fields — *"NO SHAPE-SYMMETRY OPTIONALS, and the omission is the decision"* (`phase_types.py:1864-1866` quoting `models/harness.py`). There is **no existing per-key metadata field on any phase config** to copy. `validators: list[ValidatorSpec]` is the nearest structured-sibling shape. ⚠ A new field here is a schema decision with an egress consequence (`_pre_credential_destination` at `phase_types.py:2075-2101` reads `config.base_url` *"written now, driven by `tests/unit/test_190_egress_ordering.py`, so the day a destination DOES land on the step the guard is already ahead of the resolver"*) — **the threat model must cover what the new field may and may not carry**, and `ConnectionPicker`'s patch-sweep fence (which refuses `secret\|token\|password\|host\|base_url` and host-shaped values, `:507-511`) must be extended to it. |
| the schedule modal's real fields (D-214-04) | component | request-response | Not located in this pass; CONTEXT's deferred list also flags *"whether a schedule's free-form `inputs` dict stays API-only"* as raised-not-settled. Locate `backend/app/db/schedules.py`'s client surface at plan time — note that file's docblock (`:17`) already records the jsonb string-scalar defect, so the same read discipline (§3) applies. |

---

## Metadata

**Analog search scope:** `backend/app/services/connectors/`, `backend/app/services/harness/`,
`backend/app/db/`, `backend/app/api/`, `backend/app/models/`, `backend/tests/unit/`,
`frontend/src/components/{workflows,settings,panel,chat}/`, `frontend/src/{lib,types,pages}/`,
`.claude/skills/sketch-findings-agentic-rag/references/`.

**Files read in full or in targeted ranges:** 31.
**Analogs selected:** 5 primary (`grants.py`, `GovernanceSection.tsx`/`ExternalActionSection.tsx`,
`phase_output_object`, `connectionMark.tsx`, `publish_service.py` stage 2) + 3 secondary
(`human_input.py`, `reachability.py`, `doorVocabulary.ts`).

**Stale pointers found in CONTEXT.md while mapping** — re-derive at plan time, do not copy forward:

| CONTEXT says | Measured at HEAD 2026-08-28 |
|---|---|
| `_adapter_args` at `phase_types.py:2151` | **`:2125`** (`:2151` is `_write_send_receipt`) |
| `_external_action_inputs` at `:1861` | `:1861` ✅ |
| `_BODY_ARG_FOR_CAPABILITY` "fills body … (`phase_types.py:2151`)" | the map is at **`:2056`**, the fill at **`:2145-2148`** |
| `load_run_phases` at `db/workflows.py:1371` | **`:1370`** (`def` line) |
| `_GOVERNED_FEATURES` at `user_settings.py:1197-1203` | **`:1191-1214`** |
| `RunModal.tsx:552` hint line | **`:557-582`** |
| `connector_service.py:880` re-discovery | not re-verified this pass — verify before citing |
| `PhaseCard.tsx:253` sentinel | `classifyFailure` at **`:236`**, the `reason_unknown` block at **`:246-256`** |

**Pattern extraction date:** 2026-08-28.
