# Phase 185: Graded Governance — Per-Node Grounding Mode + Action-Risk Dial — Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 16 (6 backend · 6 frontend · 4 test)
**Analogs found:** 14 / 16 exact-or-role match · **2 net-new with no analog**

Every excerpt below was read from the live tree in this session. Line numbers are current truth as of
2026-07-29 and agree with `185-RESEARCH.md`.

> **Read order for the executor:** `185-SPEC.md` → `185-CONTEXT.md` (§F is authoritative) →
> `185-RESEARCH.md` → this file. This file answers *"what existing code do I copy?"* and nothing else.
> It re-decides no lock.

---

## File Classification

| Target file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `backend/app/models/harness.py` (2 `PhaseSpec` booleans + 1 `ValidatorSpec.kind` literal) | model | transform | `PhaseSpec.name` (`:194`) · `LlmEmitPhaseConfig` (`:123-154`) | **exact** |
| `backend/app/services/harness/validator_kinds.py` — new `citations_required` mode `retrieved_and_cited` | validator | transform | the shipped `presence` branch, same fn (`:211-221`) | **exact** |
| `backend/app/services/harness/validator_kinds.py` — new kind `action_risk_approval` (`timing:"pre"`) | validator | request-response | `freshness` (`:511-580`) — the ONLY shipped pre-timing kind | **exact** |
| `backend/app/services/harness_engine.py:1118` — effective-phase synthesis | service | transform | `graft_skill_snapshots` (`skill_snapshot.py:263-289`), called at `harness_engine.py:1458-1460` | **exact** |
| `backend/app/services/harness/grounding.py` — `KB_TOOLS` + `grounding_cause` + `effective_phase` | service | transform | `business_requirement_missing` (`:763-771`) · `_unregistered_skill_ref` (`:642-648`) | **exact** |
| `backend/app/api/workflows.py` — `kb_tools` on `GroundingBundleResponse` | API/model | request-response | the `degraded` field addition (`:376-390` + `:712-717`) | **exact** |
| `frontend/.../GovernanceSection.tsx` **(NEW)** | component | request-response | `StepTypePicker.tsx` (218 L, whole file) + `GatesRail` (`PhaseFormPanel.tsx:617-657`) | **exact** |
| `frontend/.../FlowEdge.tsx` + `edgeTypes` map **(NEW)** | component | transform | **NO EDGE ANALOG EXISTS.** Nearest structural: `nodeTypes` (`WorkflowCanvas.tsx:208-218`) + `PhaseNode.tsx:141` adapter | **partial — net-new** |
| `frontend/.../phaseVocabulary.ts` — DELETE `groundingFor` + `GROUNDINGS` | utility | transform | **no prior clean vocabulary deletion in this tree** | **none — inventory instead** |
| `frontend/.../PhaseNodeCard.tsx` — Wave-1 137-D→137-B rebuild + seal + verdict move | component | transform | its own verdict mark (`:293-306`) · `CANVAS_LAYOUT` (`canvasModel.ts:62-77`) · `.planning/sketches/themes/canvas-184.css:182-208` | **exact** |
| `frontend/.../canvasModel.ts` — thread 2 booleans + `edge.data.armed` | utility | transform | `buildPhaseData` (`:187-199`) · `pushEdge` (`:260-265`) · `fromCanvas` (`:403-421`) | **exact** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` — caller-owned governance write | page/controller | event-driven | `onPhaseChange` (`:1043-1049`) → `builderStore.patchConfig` (`:478-487`) → `definitionOps.patchPhaseConfig` (`:202-210`) · `gatesFor` (`:308-312`) | **exact** |
| `backend/tests/unit/test_185_detection.py` **(NEW)** | test | — | `test_182_validate.py` (builders) + `test_harness_models.py` (strict-parse) | **exact** |
| `backend/tests/unit/test_185_engine_attachment.py` **(NEW)** | test | — | `test_ask_user_disposition.py` (`:29-95`) | **exact** |
| `frontend/.../GovernanceSection.test.tsx` **(NEW)** | test | — | `StepTypePicker.test.tsx:155-181` + `PhaseFormPanel.rails.test.tsx:23-79` | **exact** |
| `frontend/.../FlowEdge.test.tsx` **(NEW)** | test | — | `WorkflowCanvas.test.tsx:224-239` (the tab-stop walk) | **role match** |

---

## Pattern Assignments — Backend

### 1. `backend/app/models/harness.py` (model, additive-optional)

**Analog A — `PhaseSpec.name`, `:189-194`** (the D-185-06 precedent, verbatim):

```python
class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig  # parsed via discriminator
    validators: list[ValidatorSpec] = Field(default_factory=list)
    name: str | None = None  # REQ-3 — additive; serializes into the definition JSONB; pre-103 rows validate with it absent
```

**The comment convention to copy is that one trailing comment.** Its three clauses are the template:
`<REQ/D id>` — `additive` — `pre-<phase> rows validate with it absent`. Nothing else in the file documents
pre-existing-row safety; this is the whole idiom.

**Analog B — `LlmEmitPhaseConfig` docblock, `:123-137`** (the 101.1 extension, for the *why* paragraph):

```python
    """Phase 101.1 (D-04) — the 6th phase type: a SEALED FORCED EMIT.
    ...
    Additive-optional / ZERO-migration: appended to the ``PhaseConfig`` union as the
    6th discriminated member (the standard extension — the 5 existing members were added
    this way). ``_StrictBase`` rejects unknown keys (T-101.1-01-01); old JSONB phase rows
    without ``llm_emit`` still ``model_validate()``.
    """
```

**Analog C — `WorkflowDefinition`'s 098 block, `:228-235`** (the *section-header* form when adding ≥2 fields):

```python
    # ── 098 additive-optional schema lock (zero-migration; old JSONB rows model_validate() to defaults) ──
    project_folder_id: UUID | None = None                                                    # D-01 / PROJ-01
    output_target_folder: UUID | None = None                                                 # D-08 (shape only)
```

**Copy this:** the trailing-comment shape from A, the "zero-migration / old rows `model_validate()`"
sentence from B, and the `# ── <phase> … ──` section header from C when adding both booleans together.

**Change this:**
- Both new fields are `bool = False`, **not** `X | None = None` — D-185-08 requires absence to be
  unambiguous. That is the one deviation from `name`'s spelling.
- The comment must additionally carry D-185-07's *intent-only* clause: `detected` / `already-set` are
  **derived**, never stored, so "a detected step set back to free-to-think" is unrepresentable.
- **Do NOT touch any `PhaseConfig` union member** (L-12). The union's `extra="forbid"` would force a 6×
  copy-paste.

**Also in this file — `ValidatorSpec.kind`, `:178-182`** (must gain `"action_risk_approval"`):

```python
    kind: Literal[
        "json_schema", "regex_match", "workspace_file_exists", "programmatic",
        "citations_required", "freshness", "structure_check",
        "output_file_valid", "llm_judge_rubric",
    ]
```

**Change this:** the module docblock at `:15-16` says *"the two Literal sets remain LOCKED (do NOT change
them)"* — that note is **stale** (Phase 102 already grew this literal 4→9). Correct the docblock in the
same edit (L-11), the way Phase 102 amended `ValidatorSpec`'s own docstring at `:173-175`.

---

### 2. `validator_kinds.py` — the new `citations_required` mode (validator, transform)

**Analog: the shipped `presence` branch in the SAME function, `:199-221`.**

Registration mechanism, verbatim (`:199-200`) — this is the *only* registration form in the file:

```python
# ── 1. citations_required (wraps check_coverage; D-14 two modes) ──────────────
@register_validator("citations_required")
async def _validate_citations_required(output: dict, config: dict, ctx) -> GateResult:
```

The mode-branch + `GateResult` construction idiom to imitate (`:209-221`):

```python
    mode = config.get("mode", "deterministic")

    if mode == "presence":
        text = _output_text(output)
        pattern = config.get("pattern", r"\[\d+\]|\(doc[^)]*\)")
        try:
            n = len(re.findall(pattern, text))
        except re.error as e:
            return GateResult(False, f"citations_required: invalid marker pattern: {e}")
        need = config.get("min_markers", 1)
        if n >= need:
            return GateResult(True, None)
        return GateResult(False, f"citations_required: only {n}/{need} citation markers")
```

And the blocker the new mode exists to route around (`:223-226`):

```python
    # deterministic / emit mode — wrap check_coverage.
    fm = output.get("field_map")
    if fm is None:
        return GateResult(False, "citations_required: no field_map on output")
```

**Copy this:**
- The `mode = config.get("mode", "deterministic")` dispatch — add a **third** `if mode == "..."` branch
  ABOVE the deterministic fall-through, exactly as `presence` sits.
- `GateResult(False, f"citations_required: <what was missing>")` — the `"<kind>: <reason>"` message prefix
  is universal in this file and is what the retry-feedback loop shows the model.
- The regex half of the new mode should **call the same code path** as `presence`, not re-derive it —
  same default pattern literal, same `re.error` guard, same `min_markers` default.
- Registration is by **import side-effect** (`harness/__init__.py:27` does `from . import validator_kinds`).
  Nothing else is needed to register.

**Change this:**
- Half (a) reads `output["citations"]` (a list) — **never** `source_refs` (L-1: `source_refs` can be
  populated by non-KB tools; reading it weakens the gate).
- The docstring's `mode` list at `:203-207` must gain the third entry, matching the existing two-space
  bullet style.

---

### 3. `validator_kinds.py` — the new `action_risk_approval` kind (validator, request-response, `timing:"pre"`)

**Analog: `freshness`, `:511-580` — the ONLY shipped `timing="pre"` kind in the codebase.**

```python
# ── 5. freshness (timing=pre; net-new; wraps freshness.py queries) ────────────
@register_validator("freshness")
async def _validate_freshness(output: dict, config: dict, ctx) -> GateResult:
    """Deterministic KB freshness (D-09) — the first ``timing="pre"`` gate.
    ...
      1. stale sources: newest doc older than ``max_age_days`` -> FAIL with a
         ``freshness:staleness|...`` finding.
    """
```

and its structured-finding message form (`:568-571`):

```python
        return GateResult(
            False,
            f"freshness:staleness|newest source is {age:.0f}d old (> {max_age_days}d)",
        )
```

**Copy this:**
- The section-comment header `# ── N. <kind> (timing=pre; …) ────`.
- The signature `async def _validate_x(output: dict, config: dict, ctx) -> GateResult` — identical for
  every kind, pre or post.
- **The `"<prefix>:<subkind>|<payload>"` structured-finding string.** This is the load-bearing part:
  `_ask_user_choices_from_finding` (`harness_engine.py:822-844`) branches on exactly this
  `freshness:staleness|` prefix shape to derive the `ask_user` choice menu. `action_risk:approval|<sentence>`
  must follow it character-for-character in structure.
- The file's DISCIPLINE block (`:16-25`) applies verbatim: **never raise into `run_gates`**, fail closed,
  heavy imports function-local.

**Change this:**
- `action_risk_approval` **always returns `GateResult(False, ...)`** — it never inspects `output`. The
  pause is owned by the `on_failure: "ask_user"` disposition machinery
  (`_resolve_failure_with_ask_user`, `harness_engine.py:852-1034`), NOT by the validator body. That keeps
  the validators.py contract ("never blocks, never raises") intact. See RESEARCH §"The recommended
  mechanism".
- `freshness` fails closed on missing config; this kind has no required config beyond the prompt string.

**Companion excerpt — `run_gates`'s `timing` filter (`validators.py:214-249`)**, which the plan must not
break:

```python
async def run_gates(phase, output: dict, ctx, *, timing: str | None = None) -> GateResult:
    for idx, spec in enumerate(getattr(phase, "validators", None) or []):
        if timing is not None and getattr(spec, "timing", "post") != timing:
            continue  # the OTHER-phase timing — skip but keep idx the FULL-list index
        validator = VALIDATOR_REGISTRY.get(spec.kind)
        if validator is None:
            return GateResult(False, f"unknown validator kind {spec.kind!r} ...", idx)
        result = await validator(output, spec.config, ctx)
        if not result.passed:
            return result._replace(validator_index=idx)
    return GateResult(True, None)
```

`idx` is the index into the **FULL** list — this is why D-185-03 rejects injecting inside `run_gates` and
why the synthesized specs must be **APPENDED** at parse time.

---

### 4. `harness_engine.py:1118` — the effective-phase synthesis seam (service, transform)

**The seam, verbatim (`:1116-1118`):**

```python
    # Map the parsed definition's PhaseSpec by slug so we dispatch on the typed
    # config while iterating the durable rows in phase_index order.
    spec_by_slug = {p.slug: p for p in definition.phases}
```

consumed once, at `:1149`: `phase = spec_by_slug[row["slug"]]`.

**Analog — `graft_skill_snapshots`, the shipped per-run `PhaseSpec` transform at the same class of seam
(`backend/app/services/harness/skill_snapshot.py:263-289`):**

```python
def graft_skill_snapshots(definition, snapshots_map):
    """Re-attach persisted snapshots (099-07) onto a freshly-parsed definition.

    The materialized snapshots live in the workflow_definitions.skill_snapshots
    sibling column (NOT the locked definition JSONB), so a definition parsed from
    the DB carries None on every phase.config.skill_snapshot. This grafts each
    persisted snapshot back, keyed by phase slug, BEFORE validate/materialize at the
    read points (kickoff + run-definition load). ... A None/empty/missing-slug map is
    a no-op (graft is safe to call unconditionally). Malformed stored JSON raises
    pydantic.ValidationError (fail-closed — never silently runs a half-grafted definition).
    """
    if not snapshots_map:
        return definition
    from app.models.harness import SkillSnapshot

    for phase in definition.phases:
        if getattr(phase.config, "skill_ref", None) is None:
            continue
        ...
        phase.config.skill_snapshot = SkillSnapshot.model_validate(stored)
    return definition
```

and its call site (`harness_engine.py:1455-1461`):

```python
    _snaps = row.get("skill_snapshots")
    if isinstance(_snaps, str):
        _snaps = json.loads(_snaps)
    if _snaps:
        from app.services.harness.skill_snapshot import graft_skill_snapshots
        parsed = graft_skill_snapshots(parsed, _snaps)
    return parsed
```

**Copy this:**
- **The no-op-by-default shape.** `if not snapshots_map: return definition` is the identity early-return.
  `effective_phase` must mirror it: `if not extra: return phase` — an ungoverned phase is handed back
  **by reference**, which is what makes "byte-identical when unset" a structural property rather than a
  claim (D-14).
- **The docstring contract sentences**: where it is called FROM, what it must never do. `graft`'s
  "BEFORE validate/materialize at the read points" ↔ `effective_phase`'s "**NEVER persisted; called from
  `harness_engine.py:1118` only**".
- The **function-local import** at the call site (`from app.services.harness.skill_snapshot import ...`
  inside the function body) — `harness_engine` does not import these helpers at module top.
- `getattr(phase.config, "<field>", None)` for reading union-member-specific fields. The config is a
  discriminated union; only some members carry `available_tools` / `citation_policy`, and `getattr` with a
  default is the shipped totality idiom.

**Change this (important — do NOT copy this part):**
- `graft_skill_snapshots` **MUTATES in place** (`phase.config.skill_snapshot = ...`). `effective_phase`
  must **NOT** mutate — use `phase.model_copy(update={"validators": [*phase.validators, *extra]})`.
  Rationale: `graft` writes a field that *belongs* in the run's definition; 185 synthesizes a spec that
  must never be observable to any other reader, and mutation would leak into anything else holding the
  same parsed object.
- **APPEND, never prepend.** `harness_engine.py:684-686` seeds the retry bound from
  `validators[0].max_retries`. Prepending changes that seed for every phase with authored validators.
- **Never implement this as a Pydantic `model_validator`** (L-2): `db/workflows.py:349-356` persists
  `json.dumps(definition.model_dump(mode="json"))`, which would bake the synthesized gate into the JSONB
  permanently and contradict D-185-07.

---

### 5. `backend/app/services/harness/grounding.py` — `KB_TOOLS` + derivation helpers (service, transform)

**The module's RED-LINE docblock, `:1-16` (read before adding anything anywhere else):**

```python
"""Phase 182 (VALID-01 / D-182-02 / D-182-06) — the ONE shared grounding source.

This module is the anti-drift mechanism for the visual workflow canvas. ...
all read the SAME copy. **RED LINE (D-182-06 / D-14): there is exactly ONE copy of every
grounding rule and it lives here. No rule is ever re-implemented in a second backend
module, and NEVER client-side.** The canvas is a pure client of this seam.
```

plus the module-shape rule at `:41-46`:

```python
MODULE-SHAPE DISCIPLINE (Pitfall 1): grounding TOUCHES the DB (folder tree + skill
registry). It deliberately does NOT live in ``reachability.py``, which is documented
"PURE — no I/O, no DB, no engine import" ...
For the same reason this module is NOT re-exported from ``harness/__init__.py``; import
it module-direct (``from app.services.harness.grounding import ...``).
```

**Existing exported rule to match in shape — `business_requirement_missing`, `:760-771`** (the "even a
trivial check is still a rule, and one home" precedent):

```python
# ── the shared D-13 publish invariant (Pitfall 4 — one source, even trivial) ───


def business_requirement_missing(definition: "WorkflowDefinition") -> bool:
    """The D-13 publish invariant: a workflow must declare exactly one
    ``business_requirement`` before publish.

    Lifted from the inline predicate at publish stage 1 (``publish_service.py``) so BOTH
    publish and the ``/validate`` seam call ONE copy — a trivial check is still a rule,
    and a copy-pasted rule drifts (Pitfall 4 / D-182-06).
    """
    return not (definition.business_requirement or "").strip()
```

and the per-phase pure-rule form — `_unregistered_skill_ref`, `:642-648`:

```python
def _unregistered_skill_ref(phase, skill_ids: set[str]) -> str | None:
    """Rule 3 — the phase's ``skill_ref`` as a string when it is NOT in the enabled
    owner/global skill set, else ``None`` (an unset ``skill_ref`` is always clean)."""
    ref = getattr(phase.config, "skill_ref", None)
    if ref is not None and str(ref) not in skill_ids:
        return str(ref)
    return None
```

**Copy this:**
- `# ── <section name> (<why one home>) ───` section headers with two blank lines around them.
- A rule is a **small pure function taking `phase` (or `definition`) and returning a value or `None`**;
  it never classifies severity, never does I/O, and its docstring names the one home reason.
- `getattr(phase.config, "<field>", None)` for union-member fields (as above).
- Type-only import of `WorkflowDefinition` under `if TYPE_CHECKING:` (`:91-92`) to keep the module
  import-light.

**Change this:**
- `grounding_cause` and `effective_phase` are **pure, zero-I/O** — unlike most of this module, which
  touches the DB. Say so in the docstring so the next reader does not assume a pool is needed.
- **Branch order is load-bearing (L-13):** `detected` is checked FIRST, then `already-set`, then
  `escalated`. That total ordering is what makes SPEC Req 3's "detection wins and the undo disappears"
  true by construction. Do not reorder.
- Export `KB_TOOLS` as a `frozenset` plus a sorted `list` wire form (`KB_TOOLS_SORTED`), mirroring how
  `GroundingBundle` carries both `tools: list[str]` (JSON-friendly) and `tool_names: set[str]`
  (membership) for the same values — `grounding.py:111-112`.

---

### 6. `backend/app/api/workflows.py` — extending `GET /workflows/grounding-bundle` (API, request-response)

**Analog: `GroundingBundleResponse` itself, `:356-390`** — and specifically its most recent additive field,
`degraded`, which is the *closest prior additive extension* to this exact model:

```python
class GroundingBundleResponse(BaseModel):
    """The server-sourced PALETTE of valid building blocks (D-182-01).
    ...
    Kept a SEPARATE cacheable ``GET`` rather than embedded in the ``/validate`` response
    (D-182-01): ``/validate`` fires on every canvas edit; the palette is near-static."""

    tools: list[str] = Field(default_factory=list)
    # CR-02: EXPLICIT per-row models, never ``list[dict]``. ...
    folders: list[PaletteFolder] = Field(default_factory=list)
    skills: list[PaletteSkill] = Field(default_factory=list)
    template_placeholders: list[str] = Field(default_factory=list)
    # Round-3 CR-02 / verification Truth 8: the names of the registries that could NOT be
    # resolved for this request (``"folders"`` / ``"skills"``), sorted for a stable payload.
    # EMPTY is the only value that means "this palette is complete".
    #
    # Without this field the route was a LIAR AT SCALE ...
    degraded: list[str] = Field(default_factory=list)
```

and the handler's serialization tail, `:707-718`:

```python
    return GroundingBundleResponse(
        tools=bundle.tools,
        folders=bundle.folders,
        skills=bundle.skills,
        template_placeholders=bundle.placeholders,
        # The SAME ``bundle.degraded`` branch ``validate_workflow`` makes (:575), at the SAME
        # seam, from the SAME shared collector — this route was the one consumer that read the
        # bundle's data fields but not its honesty field. Nothing is filtered or synthesized
        # here ...
        degraded=sorted(bundle.degraded or ()),
    )
```

**Copy this:**
- A **flat, independent `list[str]` field with `Field(default_factory=list)`** — the payload's four-flat-
  lists shape. `degraded` is the exact precedent for "add one more flat list, purely additive".
- The block-comment-above-the-field form, naming the decision id and stating what the field's EMPTY value
  means.
- Serialize by **reading a field off the shared `GroundingBundle` dataclass**, never by computing in the
  route. Mirror `kb_tools` onto `grounding.GroundingBundle` (`grounding.py:100-132`) so
  `assemble_grounding_bundle` remains the one computation — the same discipline the `degraded` comment
  enforces.

**Change this:**
- `kb_tools` is served **unconditionally and unfiltered** — it is the safety-defining constant, not a
  per-caller registry read, so it is populated even on the `degraded` path (a degraded folder/skill read
  must not silently un-mark a locked step).
- Do **not** convert `tools` to `list[{name, is_kb}]`: `tools: string[]` is typed on both members of
  `useGroundingBundle`'s union (`useGroundingBundle.ts:70, :83`) and on `PhaseFormRails.toolOptions`
  (`string[] | "degraded"`).

**Client half — `frontend/src/lib/api.ts:3431-3437`** gains the mirrored field:

```typescript
export interface GroundingBundle {
  tools: string[]
  folders: { id: string; name: string; parent_id: string | null }[]
  skills: { id: string; name: string | null }[]
  template_placeholders: string[]
  degraded: string[]
}
```

`getGroundingBundle` (`:3508-3520`) returns the response untouched — no change needed there beyond the
type.

---

## Pattern Assignments — Frontend

### 7. NEW `frontend/src/components/workflows/GovernanceSection.tsx` (component, request-response)

**Analog A — `StepTypePicker.tsx` (whole file, 218 L): the self-contained panel-adjacent component with
the refusal idiom.**

Its docblock states the two rules this component must inherit (`:16-31`):

```
 * ── The refusal: offered DISABLED, WITH its reason, never hidden (R10b) ──
 * ... every row the definition's shape declines is
 * still rendered, disabled, with its sentence visible in the DOM beside it (not in a
 * `title`, not in a tooltip) and wired to the row through `aria-describedby`.
 *
 * ── This component AUTHORS NO REASON OF ITS OWN, and consults no server ──
 * Every row and every `disabledReason` comes from `definitionOps.allowedTypesAt`, the
 * pure shape predicate. ... **a refusal is a SHAPE rule, decided locally from the
 * phases already in hand; a verdict is a SERVER judgement.** ... This module therefore
 * imports nothing from the API client, names no server route, and opens no request; a
 * `?raw` fence and a whole-suite request spy in `StepTypePicker.test.tsx` both prove it,
 * each with a positive control.
```

The wiring, verbatim (`:152-206`, trimmed to the load-bearing lines):

```tsx
      {choices.map((choice) => {
        const reason = choice.disabledReason
        const refused = typeof reason === "string" && reason.length > 0
        const reasonId = `${baseId}-why-${choice.type}`
        return (
          <button
            type="button"
            data-refused={refused ? "true" : "false"}
            disabled={refused}
            aria-disabled={refused ? "true" : undefined}
            // The reason is REAL DOM text below, not a title attribute — assistive
            // technology reads the same sentence a sighted author reads.
            aria-describedby={refused ? reasonId : undefined}
            onClick={() => { if (refused) return; onChoose(choice.type) }}
          >
            ...
            <small
              id={refused ? reasonId : undefined}
              data-testid={refused ? `step-type-reason-${choice.type}` : undefined}
            >
              {refused ? reason : subtitle}
            </small>
          </button>
        )
      })}
```

The shared-constant source of the sentence — `definitionOps.ts:266-268`:

```typescript
/** The one stranding sentence, in the plain language the picker speaks (D-183-06). */
export const STRANDING_REASON =
  "This would come after the deliverable, so the workflow would no longer end with it."
```

and the two assertions that pin character-identity — `StepTypePicker.test.tsx:155-170`:

```tsx
  it("renders the reason CHARACTER-IDENTICAL to definitionOps' sentence (it authors none)", () => {
    renderPicker(withDeliverable, 3)
    expect(screen.getByTestId("step-type-reason-llm_single")).toHaveTextContent(STRANDING_REASON)
  })

  it("wires the row to its visible reason via aria-describedby", () => {
    const row = screen.getByTestId("step-type-choice-llm_single")
    const describedBy = row.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const reason = document.getElementById(describedBy as string)
    expect(reason?.textContent).toBe(STRANDING_REASON)
  })
```

**Analog B — `GatesRail`, `PhaseFormPanel.tsx:617-657`: the in-panel section shape** (this is the visual
neighbour the governance section sits beside, and its footnote is the refusal *voice* to reuse):

```tsx
function GatesRail({ gates }: { gates: PhaseGateRow[] }) {
  return (
    <section data-rail="gates" data-testid="rail-gates" className="mt-3 rounded border border-border bg-muted/40 px-2.5 py-2">
      <h3 className="text-[11px] font-medium text-foreground">Checks that run on this step</h3>
      ...
              <span aria-hidden="true">{gate.locked ? "🔒" : "○"}</span>
              <span className="min-w-0 flex-1 truncate">{gate.label}</span>
              {gate.locked ? (
                <span className="shrink-0 text-[10.5px] text-muted-foreground">Cannot be removed</span>
              ) : ( <button type="button" onClick={gate.onRemove} …>Remove</button> )}
      ...
      <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">
        A locked check came with a choice above it — change what made it apply and it goes.
        There is no switch.
      </p>
    </section>
  )
}
```

**Mount point — `PhaseFormPanel.tsx:1032`, the last child of the scroll body:**

```tsx
        {rails && <GatesRail gates={rails.gates} />}
      </div>
    </aside>
```

**Copy this:**
- The `<section data-testid="..." className="mt-3 rounded border border-border bg-muted/40 px-2.5 py-2">`
  + `<h3 className="text-[11px] font-medium text-foreground">` section frame.
- `useId()` → `${baseId}-why-...` for the reason element id (`StepTypePicker.tsx:86, :155`).
- `aria-describedby` pointing at a **rendered `<small>`/`<p>` with real text**; `data-refused` /
  `data-testid` hooks on both the control and the reason.
- **Refusal copy lives in a shared exported constant**, imported by both the component and its test, and
  asserted character-identical. (Home: `definitionOps.ts` alongside `STRANDING_REASON`, or a new
  `governanceVocabulary` constant — the planner's call, but it must be ONE exported const, not a literal
  in JSX.)
- `{rails && <GovernanceSection … />}` at the mount — **every branch gated on `rails`**, so a
  rails-absent render stays byte-identical (D-181-01). `PhaseFormPanel.rails.test.tsx` is the guard suite.

**Change this:**
- StepTypePicker renders refused rows **disabled**; D-185-15/Req 5 requires a step type that can never be
  grounded to render **NO dial element at all** (query returns `null`, not a disabled node). The
  *disabled-with-reason* treatment applies only to the **loose side of a locked step**, not to the
  whole control on a non-groundable type.
- D-185-16: a step type with no dial still renders the **section**, carrying "Nothing to prove here".
  Section always present; control conditionally absent.
- D-185-02: the "what this gate does" sentence on a **detected agent step** must NOT reuse the emit-path
  wording ("every value traceable"). The honest claim is *retrieved-and-pointed-at*.
- The write goes out through a **new caller-owned prop** (see §12), never through `onChange`.

---

### 8. NEW `FlowEdge.tsx` + a module-level `edgeTypes` map — **NET-NEW, NO ANALOG**

**Stated plainly: there is no custom edge anywhere in `frontend/src`.** Verified this session:
`grep -rn "BaseEdge|getBezierPath|getSmoothStepPath|EdgeProps|EdgeLabelRenderer" frontend/src` returns
**zero matches**; `grep -rn edgeTypes frontend/src` returns exactly one hit, and it is a comment asserting
the opposite of the SPEC's build note. This confirms LC-1 / D-185-18: the detour is net-new canvas
infrastructure, not a data change.

**The comment that must be rewritten — `WorkflowCanvas.tsx:276-289`:**

```tsx
/**
 * The arrow marker every edge wears. Edge CLASSIFICATION rides on `data.kind`, not
 * on `edge.type` — setting `edge.type` would make the library look up an
 * `edgeTypes` entry named `flow` and fall back with a warning, since 183 registers
 * none. Per-kind styling is applied below, off that same `data.kind`.
 */
const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16, height: 16,
    color: "hsl(var(--border))",
  },
}
```

**Nearest structural analog — the `nodeTypes` registration, `WorkflowCanvas.tsx:208-218`:**

```tsx
/**
 * MODULE SCOPE, never inside the component (Pattern 4). Declared in the render body
 * this object is new on every parent render, which makes React Flow warn ("It looks
 * like you have created a new nodeTypes object") and re-render every node. The keys
 * are exactly `CANVAS_NODE_TYPES`.
 */
const nodeTypes = {
  [CANVAS_NODE_TYPES.phase]: PhaseNode,
  [CANVAS_NODE_TYPES.unresolvedSkip]: UnresolvedSkipNode,
  [CANVAS_NODE_TYPES.endCap]: EndCapNode,
}
```

passed at `:1427-1431`:

```tsx
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
```

**How an `@xyflow/react` v12 custom component is written in this tree — `PhaseNode.tsx:141` and
`:213`:**

```tsx
function PhaseNodeImpl({ data, selected }: NodeProps<PhaseCanvasNode>) { … }
export const PhaseNode = memo(PhaseNodeImpl)
PhaseNode.displayName = "PhaseNode"

export function UnresolvedSkipNode({ data }: NodeProps<UnresolvedSkipCanvasNode>) { … }
```

and the memoization rationale worth mirroring (`:262-278`): a drag re-renders the subtree ~60×/s; without
`memo` the SVG is rebuilt every frame ("blinking while I drag").

**Copy this:**
- **Module-scope `const edgeTypes = { flow: FlowEdge } as const`** with the Pattern-4 docblock reason
  copied from `nodeTypes` (a per-render object identity makes react-flow warn and re-render everything).
  Keys must be exactly `CANVAS_EDGE_KINDS`, as `nodeTypes`' keys are exactly `CANVAS_NODE_TYPES`.
- `{ data, … }: EdgeProps<CanvasEdge>` destructured-props signature, `memo` + `displayName`, the same
  as the node components.
- `pointer-events: none` on every drawn mark (the card's `:290-292` rule generalizes: the canvas has one
  tab stop per node and the armed mark is READ-ONLY — no `role`, no `tabIndex`, no handler).

**Change this / net-new work the plan must budget for (D-185-18, four pieces):**
1. `FlowEdge.tsx` (new file) implementing armed + unarmed paths.
2. The module-level `edgeTypes` map + `edgeTypes={edgeTypes}` on `<ReactFlow>`.
3. `toCanvas` must now set `type: CANVAS_EDGE_KINDS.flow` on flow edges (`canvasModel.ts:260-265`) —
   it currently sets **only** `data.kind`. This switches **every** flow edge from the library's default
   renderer to ours.
4. `markerEnd` must be re-rendered inside the custom edge or the arrowhead is lost
   (`DEFAULT_EDGE_OPTIONS` no longer applies once `type` is set).
5. Rewrite the `:276-280` docblock, which currently documents the opposite of the new truth.

**Acceptance criterion the plan must carry:** an ordinary unarmed flow edge renders identically to today.

**Geometry — transcribe verbatim, do not re-derive** (from `185-RESEARCH.md` §"Frontend Mount Points §5",
lifted from `.planning/sketches/147-the-armed-mark/index.html:481-499`):

```js
ARC  = 'M0,28 C14,28 16,62 30,62 C44,62 46,28 60,28'
LINE = 'M0,28 L60,28'
```
container `width: GAP (60)` · `height: INSERT_Y + 60 (88)` · `pointer-events: none` · `svg { overflow: visible }`.
`GAP` and `INSERT_Y` already exist as `EDIT_AFFORDANCE.GAP` (60) and `EDIT_AFFORDANCE.INSERT_Y` (28) at
`WorkflowCanvas.tsx:314-327` — read them from that table, never as literals (that table's own docblock
says so).

---

### 9. `phaseVocabulary.ts` — DELETE `groundingFor()` + the 3 retired badge strings

**No analog: there is no prior clean deletion of a vocabulary helper in this tree.** Every prior phase in
this family *added* to `phaseVocabulary.ts`. This is a first — say so in the plan rather than pretending
there is a template.

**What is being deleted — `phaseVocabulary.ts:191-230`:**

```typescript
const GROUNDINGS = {
  strict: { mode: "strict", words: "Must cite its sources", glyph: "🔒" },
  flag: { mode: "flag", words: "Flags uncited claims", glyph: "◐" },
  open: { mode: "open", words: "No sources needed", glyph: "○" },
} as const satisfies Record<Grounding["mode"], Grounding>

export function groundingFor(phase: PhaseSpecJSON): Grounding {
  const validators = phase.validators ?? []
  const hasCitationGate = validators.some((v) => v?.kind === "citations_required")
  const policy = phase.config.citation_policy
  if (policy === "strict" || hasCitationGate) return GROUNDINGS.strict
  if (policy === "flag" || policy === "partial") return GROUNDINGS.flag
  return GROUNDINGS.open
}
```

Its docblock (`:197-201`) already names this phase as the replacer, so the deletion is pre-authorized in
the source itself.

**The complete call-site inventory (deletion must be TOTAL — re-verified against RESEARCH):**

| File | Line(s) | What must change |
|---|---|---|
| `components/workflows/phaseVocabulary.ts` | 191-195, 223-230 | delete `GROUNDINGS` + `groundingFor` |
| `components/workflows/canvasModel.ts` | 41, 196 | drop the import + `grounding: groundingFor(phase)` in `buildPhaseData` |
| `components/workflows/canvasModel.ts` | 118-121 | drop `PhaseNodeData.grounding` (the "Badge slot 1" comment) |
| `components/workflows/PhaseNode.tsx` | 170-176 | `badges: BadgeSlots = data.waitsForYou ? [grounding, waitsForYou] : [grounding]` — the grounding slot is consumed here |
| `pages/WorkflowBuilderPage.tsx` | 142, 293, 310 | import + `gatesFor()` docblock + call (see §12) |
| `components/workflows/phaseVocabulary.test.ts` | 13, 30, 165-233 | ~10 `it()` blocks over `groundingFor` — **pinned at 42** |
| `components/workflows/canvasModel.test.ts` | 317, 326, 329-330 | asserts every node carries `grounding` + `waitsForYou` — **pinned at 26** |
| `components/workflows/WorkflowCanvas.test.tsx` | 300-304 | `expect(chip.textContent).toContain("No sources needed")` — **pinned at 31** |
| `components/workflows/PhaseFormPanel.rails.test.tsx` | 112, 228, 248 | fixture labels `"Must cite its sources"` (not pinned) |
| `components/workflows/PhaseFormPanel.tsx` | 47, 97 | two docblock mentions naming Phase 185 as the replacer — rewrite, do not delete the reasoning |

**`waitsForYou` is NOT deleted** (badge slot 2, unrelated to grounding). Req 7's banned-term grep must not
false-positive on it.

**The test file whose `it()` count must be re-pinned:** `phaseVocabulary.test.ts` (42) and
`WorkflowCanvas.test.tsx` (31) — see §"Vitest count gate" below. `canvasModel.test.ts` (26) is also at
risk if its `grounding` assertions are removed rather than rewritten.

**Guard rail from the shipped code:** the two-badge budget is a **typecheck fence**
(`PhaseNodeCard.tsx:108-118`) — `BadgeSlots` is a max-2 tuple union. Deleting the grounding badge frees
slot 1 for 188/189. **Do not fill it** (SPEC Req 6: governance spends no word-badge).

---

### 10. `PhaseNodeCard.tsx` — the Wave-1 137-D → 137-B rebuild, the seal, the verdict move

#### 10a. Where the 137-B geometry actually lives — **the SPEC's path is wrong, and here is the right one**

The SPEC cites `canvas-184.css:170-171`. **There is no `canvas-184.css` under `frontend/`.** Verified this
session — the file exists at exactly two paths, both outside the app:

- `.planning/sketches/themes/canvas-184.css` — the sketch theme (source of truth)
- `.claude/skills/sketch-findings-agentic-rag/sources/themes/canvas-184.css` — the packaged mirror

`:170-171` is the **comment header** of the block, not the constants. The constants are `:182-208`,
verbatim:

```css
/* ════════════════════════ CARD SHAPE — 137-D vs 137-B ═══════════════════
   The operator moved the locked card from 137-D to 137-B on 2026-07-26. ...
   What B changes: the icon floats ABOVE a narrower, centre-aligned card, and
   there is NO per-step-type colour anywhere ...
   ───────────────────────────────────────────────────────────────────────── */
body.card-b .node {
  display: block; text-align: center; width: 248px;
  padding: 34px 20px 20px; margin-left: 0; margin-top: 30px; border-radius: 22px;
}
body.card-b .node .icowrap {
  left: 50%; top: -26px; transform: translateX(-50%); width: 62px; height: 62px;
}
body.card-b .node .icowrap::before {
  inset: -4px; background: radial-gradient(circle, hsl(220 30% 100% / .16), transparent 66%);
}
body.card-b .node .icowrap::after { bottom: -6px; width: 42px; height: 9px; background: rgba(0,0,0,.55); }
body.card-b .badges { justify-content: center; }
body.card-b .sub { margin-top: 6px; }
/* the step number moves inside — the top edge belongs to the floating icon now */
body.card-b .stepn { top: 12px; left: 12px; right: auto; }
/* per-node actions move to the BOTTOM edge; the top is taken. */
body.card-b .acts { top: auto; bottom: -12px; left: 50%; transform: translateX(-50%); }
/* the verdict mark moves off the icon's corner so the two never overlap */
body.card-b .vmark { left: auto; right: -8px; top: 6px; }
body.card-b .conn { width: 66px; }
body.card-b .conn .line { width: 54px; }
body.card-b .conn .tip { right: 6px; }
body.card-b .endpin { margin-left: 10px; }
```

**Findings the planner must record:**
- `width: 248px` and `padding: 34px 20px 20px` are the two constants D-185-17 amends
  (`padding-top` 34 → **42**; `NODE_MIN_HEIGHT` 96 → **104**). The CSS carries **34**, so the amended
  value exists ONLY in `185-CONTEXT.md` D-185-17 — the executor takes 42/104 from CONTEXT, everything
  else from this CSS block.
- **Nothing in `frontend/src` applies a `card-b` class** (verified: `card-b` appears in sketches, planning
  docs and one `PhaseNodeCard.tsx` docblock reference, never as a rendered className). The shipped
  component renders 137-D.
- `body.card-b .vmark { right: -8px; top: 6px }` — note the sketch theme itself keeps the verdict on the
  **right** under 137-B. The operator's 2026-07-29 decision (SPEC Req 6 amendment) **overrides** this:
  verdict → `-left-2 top-1.5`, seal keeps top-right. The CSS is the geometry source, **not** the
  occupancy decision.

#### 10b. The mark/seal rendering analog — same file, `PhaseNodeCard.tsx:286-306`

```tsx
      {/* The server's verdict mark, on the RIGHT edge (`themes/canvas-184.css`
          `body.card-b .vmark`). Under 137-B the TOP edge belongs to the floating 3D
          icon and the BOTTOM edge is reserved for the per-node actions 184-12 adds, so
          right is the only edge left — and it is also the one that never overlaps the
          icon. It is `pointer-events-none` and carries no control of any kind: one tab
          stop per node is a canvas-level invariant, and a pressable mark would make it
          two. */}
      {mark ? (
        <span
          data-testid="canvas-node-verdict"
          data-verdict={verdict}
          className={cn(
            "pointer-events-none absolute -right-2 top-1.5 z-[8] grid h-[22px] w-[22px]",
            "place-items-center rounded-full text-[11px] font-bold leading-none",
            mark.className,
          )}
        >
          <span aria-hidden="true">{mark.glyph}</span>
          <span className="sr-only">{mark.label}</span>
        </span>
      ) : null}
```

**Copy this exactly for the seal:** `{cond ? (<span …/>) : null}` guard, `pointer-events-none absolute
<corner> z-[N] grid h-[Npx] w-[Npx] place-items-center rounded-full`, an `aria-hidden` glyph plus an
`sr-only` label, and a docblock above it justifying the corner.

**Change this:**
- The verdict's `-right-2` → `-left-2` (one token) **and its docblock at `:286-292` must be rewritten** —
  it currently justifies *right* by reasoning from 137-B, on a component rendering 137-D. Same for
  `WorkflowCanvas.tsx:502-504`. Correcting both belongs to the Wave-1 plan (D-185-17).
- The seal is **never conditional on run state** — no `status` read anywhere in its markup. The
  props-fence test in §16 of VALIDATION pins that.
- The 3D-mark/icon-well block at `:308-332` (`absolute left-0 top-1/2 h-14 w-14 -translate-y-1/2`) is what
  moves to the top edge under 137-B (`left:50%; top:-26px; 62×62`).
- The card inner at `:238-247` (`ml-6 … py-3 pl-10 pr-3`, `flex flex-col justify-center`) becomes 137-B's
  `display: block; text-align: center; width: 248px; padding: 42px 20px 20px; border-radius: 22px`.

#### 10c. The frozen-const-table idiom — `canvasModel.ts:54-77`

```typescript
/**
 * CANVAS_LAYOUT — ONE frozen table, the `deriveTier.ts:57-79` const-table idiom. Every
 * placement number in this module reads from here and plan 183-06's CSS agrees with
 * the SAME table, so a stray literal cannot creep into either half.
 * ...
 */
export const CANVAS_LAYOUT = {
  /** Uniform node width — every card is the same width; content wraps, never widens. */
  NODE_WIDTH: 260,
  /** The floor a card may not shrink below; it grows DOWNWARD from here. */
  NODE_MIN_HEIGHT: 96,
  /** Horizontal distance between two adjacent phase columns. */
  PITCH_X: 320,
  /** The single spine lane every phase node sits on. */
  LANE_Y: 0,
  /** The lane below the spine where an unresolved-skip stub is parked. */
  SKIP_LANE_Y: 200,
  /** Handle offset from the node TOP (never 50%) — a taller card keeps its baseline. */
  EDGE_ANCHOR_Y: 28,
  /** The ○ end cap's square size. */
  END_CAP_SIZE: 40,
} as const satisfies Record<string, number>
```

**Copy this:** `as const satisfies Record<string, number>`, one `/** … */` line per constant naming *what
it means*, and the "one table, no stray literals" docblock. `NODE_MIN_HEIGHT: 96 → 104` lands here;
`NODE_WIDTH` stays 260 (the card is 248 **inside** a 260 node box under 137-B — record which number is
which in the plan, because the SPEC says "248 px centred card" while `NODE_WIDTH` is the node's box).

**Downstream reader to check:** `EDIT_AFFORDANCE` (`WorkflowCanvas.tsx:314-327`) derives `GAP` and
`INSERT_Y` from `CANVAS_LAYOUT`, so a `NODE_MIN_HEIGHT` change moves the ✕ (`:613-627`,
`y = heightAt(pos) - 12`).

---

### 11. `canvasModel.ts` — threading the two booleans + the armed edge state (utility, transform)

**Analog A — how a PhaseSpec-level field is threaded, `buildPhaseData` `:186-199`:**

```typescript
/** Resolve every face value a phase card needs, once. */
function buildPhaseData(phase: PhaseSpecJSON): PhaseNodeData {
  const phaseType = phase.config.phase_type
  return {
    slug: phase.slug,
    phaseIndex: phase.phase_index,
    phaseType,
    title: nodeTitle(phase),
    technicalTitle: technicalTitle(phase),
    subtitle: PHASE_TYPE_SUBTITLES[phaseType] ?? "",
    grounding: groundingFor(phase),
    waitsForYou: waitsForYou(phase),
  }
}
```

(`name` itself is threaded one level down, inside `nodeTitle(phase)` / `technicalTitle(phase)` in
`phaseVocabulary.ts` — i.e. **a PhaseSpec-level field reaches the face through a named total resolver, not
by being spread**.)

**Analog B — the edge push, `:260-265`:**

```typescript
      pushEdge({
        id: `seq:${phase.slug}->${successor.slug}`,
        source: phase.slug,
        target: successor.slug,
        data: { kind: CANVAS_EDGE_KINDS.flow },
      })
```

`type` is set on **none** of the four edge-push sites (`:264, :278, :313, :341`).

**Analog C — the reference-identity invariant 184 asserts, `fromCanvas` docblock `:358-369` + body
`:413-421`:**

```
 * CARRY-THROUGH BY REFERENCE, NEVER A RECONSTRUCTION. The returned array holds the
 * SAME `PhaseSpecJSON` objects the caller passed in as `source`. That is not an
 * optimisation — it is the only shape that can satisfy R2. `toCanvas` reads exactly
 * six things off a phase and DROPS everything else ... A field-by-field rebuild would
 * re-materialise Pydantic defaults where the source carried ABSENCE, and would
 * silently drop every field nobody remembered to copy ... Handing back the same object
 * makes that entire class of failure unrepresentable, and reference identity (`toBe`)
 * is a strictly stronger proof than any deep compare.
```

```typescript
  const out: PhaseSpecJSON[] = []
  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.phase) continue
    const phase = bySlug.get(node.id)
    if (phase !== undefined) out.push(phase)
  }
  return out
```

**Copy this:**
- Add the two booleans to `PhaseSpecJSON` (`phaseVocabulary.ts:65-71`) as **optional** fields, mirroring
  `name?: string | null`:
  ```typescript
  export interface PhaseSpecJSON {
    slug: string
    phase_index: number
    name?: string | null
    config: PhaseConfigJSON
    validators?: ValidatorJSON[]
  }
  ```
- Extend `CanvasEdgeData` (`:147-149`) additively: `{ kind: CanvasEdgeKind; armed?: boolean }` — set from
  the **target** phase's armed flag inside `toCanvas`.
- Keep every new value **resolved once at projection time** through a named total function, per
  `buildPhaseData`'s contract.

**Change this / do NOT break:**
- `fromCanvas` needs **zero changes** — the round trip is preserved *by construction* because it hands back
  the same objects. Acceptance criterion 3 (`toBe` identity in `canvasModel.roundtrip.test.ts`) therefore
  holds for free. Say so in the plan rather than budgeting work for it.
- `canvasModel.purity.test.ts:74-83` pins that node `data` must **never alias** the phase object. Copy
  values, never spread `phase` into `data`.
- The module is PURE (D-183-12): no DOM read, no clock, no randomness, no mutation of either input.
  The client-side KB intersection reads the server's `kb_tools` — pass it **in**, never fetch here.

---

### 12. `WorkflowBuilderPage.tsx` — the caller-owned governance write (page, event-driven)

**Analog A — the shipped caller-owned write chain.** `PhaseFormPanel`'s own docblock states the rule
(`:78-80`):

```
 * `onRemove` belongs to the CALLER because a gate is a `validators` entry, and this panel's
 * only write seam (`onChange`) patches `config`. The panel renders the rail; the page owns
 * the definition.
```

The page's handler, `WorkflowBuilderPage.tsx:1039-1049`:

```tsx
  // Merge a phase-form patch into the selected phase's config. The immutable merge
  // itself now lives in `definitionOps.patchPhaseConfig`, reached through the store's
  // `patchConfig` action — D-184-05 leaves exactly ONE mutation home, shared by both
  // views, so this page no longer declares its own copy of it.
  const onPhaseChange = useCallback(
    (patch: PhaseConfigPatch) => {
      if (selectedSlug === null) return
      store.getState().patchConfig(selectedSlug, patch)
    },
    [selectedSlug, store],
  )
```

The store action it calls, `builderStore.ts:477-487`:

```typescript
        // ── config edits: a run of them coalesces into ONE undo ──
        patchConfig: (slug, patch) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          if (!s.phases.some((p) => p.slug === slug)) return
          set({
            phases: patchPhaseConfig(s.phases, slug, patch),
            lastEditKind: "config",
            editSeq: s.editSeq + 1,
          })
        },
```

The pure op it delegates to, `definitionOps.ts:191-210`:

```typescript
/**
 * Merge a phase-form patch into one phase's config, immutably.
 *
 * Deliberately does NOT renumber and does NOT reorder: a config edit cannot change run
 * order, and re-sorting here would make a keystroke in the inspector move a card.
 * ...
 */
export function patchPhaseConfig(
  phases: readonly PhaseSpecJSON[],
  slug: string,
  patch: Readonly<Record<string, unknown>>,
): PhaseSpecJSON[] {
  return phases.map((p) =>
    p.slug === slug ? { ...p, config: { ...p.config, ...patch } } : p,
  )
}
```

**Analog B — `gatesFor()`, `WorkflowBuilderPage.tsx:292-312`** — where D-185-19's client-synthesized `🔒`
row is produced:

```tsx
/**
 * The gates rail, DERIVED exactly as the shipped `groundingFor()` derives grounding
 * today — `citation_policy` plus the presence of a `citations_required` validator, and
 * nothing else. **Phase 184 invents no authored grounding field**; Phase 185 replaces
 * this derivation and plugs into the same `rails.gates` array ...
 *
 * Every row is LOCKED, and that is the honest reading rather than a shortcut ... Offering
 * a Remove button that could not remove anything would be the "a removable gate with no
 * way to remove it" lie the row union exists to make un-representable.
 */
function gatesFor(phase: PhaseSpecJSON | null): PhaseGateRow[] {
  if (phase === null) return []
  const grounding = groundingFor(phase)
  return grounding.mode === "open" ? [] : [{ label: grounding.words, locked: true }]
}
```

and where it feeds the panel, `:753-760` + `:1558-1574`:

```tsx
    return { order: { index: at + 1, total: order.length }, toolOptions, gates: gatesFor(selectedPhase) }
```
```tsx
        <PhaseFormPanel
          phase={selectedPhase}
          open={panelOpen}
          onChange={onPhaseChange}
          onPersist={onPersist}
          onClose={clearSelection}
          // D-14 — SPREAD-CONDITIONAL, never `rails={canvasEnabled ? rails : undefined}`.
          {...(canvasEnabled ? { rails } : {})}
        />
```

**Copy this — the full four-layer chain, exactly:**
1. **`definitionOps.setPhaseGovernance(phases, slug, patch)`** — a new pure immutable op beside
   `patchPhaseConfig`, spreading at the **PhaseSpec level** (`{ ...p, ...patch }`) rather than into
   `config`. `definitionOps` is the sole DEFINITION→DEFINITION mutation home (`canvasModel.ts:377-379`).
2. **A new store action** mirroring `patchConfig`'s two guards (`builderPhase !== "drafted"`, slug
   exists) and its `lastEditKind` / `editSeq` bookkeeping. Decide `lastEditKind` deliberately — arming
   a checkpoint is closer to `"config"` (coalescing) than `"structural"`.
3. **A `useCallback` on the page** in `onPhaseChange`'s exact shape, closing over `selectedSlug` + `store`.
4. **A new optional prop on `PhaseFormPanel`** with the docblock naming the `onRemove` precedent
   (RESEARCH §"Frontend Mount Points 2" gives the wording).

`gatesFor()` gains the `🔒` locked row synthesized from `available_tools ∩ kb_tools` — same signature,
same all-rows-locked reasoning, and its docblock's "Phase 185 replaces this derivation" sentence gets
rewritten into the present tense.

**Change this:**
- `PhaseConfigPatch` must **not** be widened (D-185-10) — its own shipped docblock defines it as
  config-only. The new prop carries its own narrow type:
  `{ grounding_escalated?: boolean; action_risk_armed?: boolean }`.
- **No task may expect `/validate` to return the locked row** (D-185-19 / LC-3): `ValidateResponse`
  carries `{code, phase, message, severity}` *problems* only. The row is client-synthesized.
- Keep the `{...(canvasEnabled ? { rails } : {})}` spread-conditional untouched — that is the D-14
  mechanism for the flag-off panel.

---

## Shared Patterns

### S1 — Unrepresentable illegal states over documented rules
**Sources:** `PhaseGateRow` (`PhaseFormPanel.tsx:82-84`), the REQUIRED `onClose` (`:125-128`),
`BadgeSlots` max-2 tuple (`PhaseNodeCard.tsx:117-118`), `definitionOps.RemovalOutcome` (`:220`).
**Apply to:** D-185-07 (persist only the escalation bit ⇒ "a detected step set back to free-to-think" has
no representable value) and D-185-15 (the dial exists only where it could ever be satisfied).

```typescript
export type PhaseGateRow =
  | { label: string; locked: true }
  | { label: string; locked: false; onRemove: () => void }
```

### S2 — Refusal reasons are real DOM text wired by `aria-describedby`, never `title`
**Source:** `StepTypePicker.tsx:169-171, :197-206` + `definitionOps.STRANDING_REASON` (`:266-268`) +
the two character-identity assertions (`StepTypePicker.test.tsx:155-170`).
**Apply to:** the governance dial's refused side (Req 5, the 184-07 lesson). The component authors **no**
sentence of its own.

### S3 — One rule, one home, server-side (D-182-06)
**Source:** `grounding.py:13-15` RED LINE + `business_requirement_missing` (`:763-771`).
**Apply to:** `KB_TOOLS` (server-only constant, shipped to the client as data via `kb_tools`), and to
`grounding_cause` / `effective_phase`. The client duplicates **only the set intersection**, and it never
enforces — a wrong client read is a display bug by construction.

### S4 — Additive-optional, zero-migration model extension
**Source:** `PhaseSpec.name` (`harness.py:194`) · `LlmEmitPhaseConfig` docblock (`:123-137`) ·
`WorkflowDefinition`'s 098 block (`:228-235`) · `GroundingBundleResponse.degraded`
(`workflows.py:376-390`).
**Apply to:** both `PhaseSpec` booleans and the `kb_tools` payload field. `git diff -- supabase/migrations`
must stay 0 lines.

### S5 — Module-scope const tables, never a literal at a use site
**Source:** `CANVAS_LAYOUT` (`canvasModel.ts:62-77`) · `EDIT_AFFORDANCE` (`WorkflowCanvas.tsx:314-327`) ·
`nodeTypes` (`:214-218`) · `EDGE_STYLE` (`:292-300`).
**Apply to:** the seal geometry, the detour arc constants, `edgeTypes`, and the amended 42/104 values.
The Pattern-4 reason (a per-render object identity makes react-flow warn and re-render) applies to
`edgeTypes` verbatim.

### S6 — `"<kind>:<subkind>|<payload>"` structured gate findings
**Source:** `freshness` (`validator_kinds.py:568-578`) → `_ask_user_choices_from_finding`
(`harness_engine.py:822-844`).
**Apply to:** `action_risk:approval|<generated sentence>` — the choice-menu derivation branches on this
prefix. ⚠ `_is_abort_choice` (`harness_engine.py:847-850`) matches only `("abort","cancel","stop","")`;
a decline phrase not in that set is read as **PROCEED** (L-4, fail-open).

### S7 — The `?raw` source-guard fence, always with a positive control
**Source:** `canvasModel.purity.test.ts:14-17` idiom, used in `PhaseNodeCard.test.tsx:26-32, :37-47`,
`StepTypePicker.test.tsx:45`, `PhaseFormPanel.rails.test.tsx:26`, `definitionOps.test.ts`.
**Apply to:** acceptance criterion 8 ("no code path sets a detected step back to free to think") and
criterion 16 ("the seal markup does not read `status`"). A guard that can only pass by making a
neighbouring docblock lie is the D-ITEM-183-02 trap — assemble tokens rather than spelling them.

### S8 — D-14 byte-identity fence
**Source:** the `{...(canvasEnabled ? { rails } : {})}` spread-conditional (`WorkflowBuilderPage.tsx:1573`)
and its comment; `PhaseFormPanel.tsx:129-138`.
**Apply to:** every rails branch in the panel and the `if not extra: return phase` identity return in
`effective_phase`. Plan verification: `git diff --stat` over
`agent_loop.py tool_dispatcher.py openai_service.py anthropic_service.py` must be **0 lines**.

---

## Pattern Assignments — Tests

### T1 — `backend/tests/unit/test_185_detection.py` (NEW)

**Analog: `test_182_validate.py` (fixture builders) + `test_harness_models.py` (strict-parse assertions).**

Builder idiom, `test_182_validate.py:43-72`:

```python
def _definition(phases: list[dict], **extra) -> dict:
    base = {
        "slug": "validate-wf", "version": 1, "name": "Validate Workflow",
        "status": "draft", "business_requirement": _BR, "phases": phases,
    }
    base.update(extra)
    return base


def _llm_single(slug: str = "answer", index: int = 0, **config_extra) -> dict:
    cfg = {"phase_type": "llm_single", "prompt": "Answer the question."}
    cfg.update(config_extra)
    return {"slug": slug, "phase_index": index, "config": cfg, "validators": []}


def _llm_agent(slug: str = "research", index: int = 0, *, tools: list[str]) -> dict:
    return {
        "slug": slug, "phase_index": index,
        "config": {"phase_type": "llm_agent", "prompt": "Research the topic.",
                   "available_tools": tools},
        "validators": [],
    }
```

Its convention header, `:21-24`:

```
CONVENTION (Phase 102 posture): imports INSIDE the test bodies. No live DB — the route
handler is called DIRECTLY ... with `grounding.assemble_grounding_bundle` monkeypatched
to a fake bundle, so the whole verdict matrix runs offline.
```

Strict-parse analog for acceptance criterion 1 — `test_harness_models.py:38-52`:

```python
# A valid seed workflow with one PhaseSpec per phase_type (5 phases).
VALID_SEED = {
    "slug": "seed-workflow", "version": 1, "name": "Seed Workflow", "status": "published",
    "phases": [
        {"slug": "fetch", "phase_index": 0,
         "config": {"phase_type": "programmatic", "fn": "do_fetch"},
         "validators": [{"kind": "workspace_file_exists", "config": {"path": "out.txt"}}]},
        ...
```

**Copy:** the three `_definition` / `_llm_single` / `_llm_agent` builders **verbatim** (add `_llm_emit`
and `_llm_batch_agents` in the same shape), the docstring header form, `from __future__ import
annotations`, imports inside test bodies. Parametrize over the 5 KB names with `@pytest.mark.parametrize`.

**Change:** no route call and no monkeypatch needed — `grounding_cause` is pure. This file should be the
cheapest in the phase.

### T2 — `backend/tests/unit/test_185_engine_attachment.py` (NEW)

**Analog: `test_ask_user_disposition.py:29-95`** — the same helper, the same mocks, the same seam.

```python
# ── a minimal ctx + phase the helper accepts (no live redis/pool needed — mocked) ──
def _phase(slug="p", on_failure="ask_user"):
    from app.models.harness import PhaseSpec, ValidatorSpec

    return PhaseSpec(
        slug=slug, phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="freshness", timing="pre", on_failure=on_failure)],
    )


def _ctx():
    return SimpleNamespace(
        supabase=None, thread_id=None, current_user={"id": uuid4()},
        producer_run_id=uuid4(), emit=AsyncMock(),
    )
```

```python
    run_id = uuid4()
    redis = object()  # opaque — the helper only passes it to the mocked subscribe
    write_audit = AsyncMock()
    subscribe = AsyncMock(return_value={"kind": "response", "response_text": "Proceed anyway"})

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(), "freshness:staleness|newest source is 400d old (> 90d)",
                0, 0,
                run_id=run_id, pool=object(), redis=redis, ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is None  # Pre-gate Proceed -> None (signal: run the body).
```

**Copy:** `_phase()` / `_ctx()` helpers, `AsyncMock` + `patch.object` / `patch("…subscribe_for_response")`
pairing, `asyncio.run(...)` at the call, the docstring header naming which mocks are set and why
(`feedback_mock_completeness` — all network deps mocked, MagicMock attrs explicit).

**Change:** swap `kind="freshness"` for `kind="action_risk_approval"` and the finding string for
`"action_risk:approval|…"`. For acceptance criteria 9/10, drive the `effective_phase` synthesis directly
with a `validators: []` fixture rather than mocking the whole run loop.

### T3 — `frontend/.../GovernanceSection.test.tsx` (NEW)

**Analog A — `StepTypePicker.test.tsx:155-181`** (quoted in §7): the character-identity assertion, the
`aria-describedby` round trip through `document.getElementById`, and "does NOT call the handler when a
refused control is clicked".

**Analog B — `PhaseFormPanel.rails.test.tsx:23-79`**: the fixture + render-helper idiom for a
rails-bearing panel, and the D-14 marker-list technique.

```tsx
function phaseOf(config: Record<string, unknown>): PhaseSpecJSON {
  return { slug: "p", phase_index: 0, name: "A phase", config: config as PhaseSpecJSON["config"] }
}

const noop = () => {}

function railsOf(over: Partial<PhaseFormRails> = {}): PhaseFormRails {
  return { order: { index: 1, total: 3 }, toolOptions: [], gates: [], ...over }
}

/** The shipped `llm_agent` shape — the type that actually carries `available_tools`. */
const AGENT = { phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] }
```

**Copy:** `phaseOf` / `railsOf` / `AGENT` fixtures verbatim, the marker-list D-14 guard shape
(`RAIL_MARKERS` at `:71-79`), and the suite header that explains **why this is a net-new file and not an
absorption** — the Phase-177 lesson is stated at `:4-7`.

**Add (criterion 12/13):** `expect(() => screen.getByTitle(REFUSAL)).toThrow()` and
`expect(screen.queryByRole("button", { name: /Free to think/ })).toBeNull()` for `llm_single` /
`llm_human_input` / `programmatic`.

### T4 — `frontend/.../FlowEdge.test.tsx` (NEW)

**Analog: `WorkflowCanvas.test.tsx:224-239`** — the walk that proves the no-focusable-control invariant:

```tsx
describe("WorkflowCanvas — one tab stop per node (Pattern 3 Option A)", () => {
  it("the tabbable node count equals the phase count", () => {
    const { container } = renderCanvas(evalCoverage)
    const tabbable = container.querySelectorAll('.react-flow__node[tabindex="0"]')
    expect(tabbable).toHaveLength(evalCoverage.length)
  })

  it("no focusable control exists INSIDE any node (the double-tab-stop mistake)", () => {
    const { container } = renderCanvas(evalCoverage)
    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
  })
})
```

**Copy:** the container-query walk with the `expect(nodes.length).toBeGreaterThan(0)` non-vacuity guard —
that guard is the reason the assertion means anything, and criterion 24 needs the same shape over the
detour edge's DOM. Also copy `PhaseNodeCard.test.tsx`'s provider-less-render posture (`:4-9`) — the edge
component should render in isolation if it is genuinely presentational; if it cannot, it is doing too much.

**Add:** an armed-vs-unarmed path assertion over the `d=` attribute against the transcribed `ARC` / `LINE`
constants, and the "an ordinary unarmed flow edge renders identically to today" regression check
(D-185-18).

### T5 — The vitest count gate (how to update the baseline correctly)

**`scripts/vitest-count-gate.cjs:57-91`, verbatim:**

```javascript
// ── The pin. Keyed by BARE filename (testResults[].name is an absolute path). ──
const BASELINE = {
  "canvasModel.fixtures.test.ts": 100,
  "canvasModel.purity.test.ts": 69,
  "phaseVocabulary.test.ts": 42,
  "WorkflowCanvas.test.tsx": 31,
  "canvasModel.test.ts": 26,
  "PublishGauntlet.test.tsx": 24,
  "WorkflowBuilderPage.canvas.test.tsx": 22,
  "PhaseFormPanel.test.tsx": 19,
  "WorkflowBuilderPage.test.tsx": 15,
  "PhaseSpineGraph.test.tsx": 14,
  "soulData.test.ts": 14,
  "WorkflowDoorSwitch.test.tsx": 13,
  "PhaseSpine.test.tsx": 11,
  "deriveTier.test.ts": 9,
  "WorkflowSoul.test.tsx": 8,
  "revertByteIdentical.test.tsx": 7,
}

const BASELINE_TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0) // 424

// ── The Wave-0 blast radius (184-VALIDATION.md § "quick run command"). ──
const TARGETS = [
  "src/components/workflows",
  "src/pages/WorkflowBuilderPage.test.tsx",
  "src/pages/WorkflowBuilderPage.canvas.test.tsx",
  "src/components/admin/revertByteIdentical.test.tsx",
  // Added in 184.1. This suite is the ONLY thing pinning the flag-off Builder header ...
  // It is deliberately NOT added to BASELINE: it postdates the 424 pin, so it reports
  // as `new` and its own count is free to grow.
  "src/pages/WorkflowBuilderPage.header.test.tsx",
]
```

**Rules the executor must follow (the Phase-177 lesson):**
- A **decrease** fails the gate (`[count-decrease]`, exit 1). An **increase is allowed**.
- Deleting `groundingFor` removes ~10 `it()` blocks from `phaseVocabulary.test.ts` (pinned 42) and at
  least one from `WorkflowCanvas.test.tsx` (pinned 31). Both pins **must be re-measured** by running the
  gate and reading the reported counts — **never guessed** — and the `BASELINE` edit must land in the
  **same commit** as the deletion. `BASELINE_TOTAL`'s trailing `// 424` comment updates with it.
- The **new** suites (`GovernanceSection.test.tsx`, `FlowEdge.test.tsx`) are **NOT** added to `BASELINE` —
  they postdate the pin and report as `new`, exactly as `WorkflowBuilderPage.header.test.tsx` documents at
  `:85-90`. They ARE already inside the `src/components/workflows` target glob, so no `TARGETS` edit is
  needed either.
- `canvasModel.test.ts` (26) is at risk if its `grounding` assertions at `:317-330` are deleted rather
  than rewritten — prefer rewriting them onto the new fields.

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `frontend/src/components/workflows/FlowEdge.tsx` + the `edgeTypes` map | component | transform | **No custom `@xyflow/react` edge exists anywhere in `frontend/src`** — verified: zero matches for `BaseEdge` / `getBezierPath` / `getSmoothStepPath` / `EdgeProps` / `EdgeLabelRenderer`, and the single `edgeTypes` hit is a comment stating none is registered. The `nodeTypes` registration + `PhaseNode` adapter are the nearest structural analogs and are quoted in §8, but the edge component body itself is unprecedented. Budget it as net-new (D-185-18). |
| Deleting `groundingFor()` from `phaseVocabulary.ts` | utility | transform | **No prior clean deletion of a vocabulary helper in this tree** — every earlier phase in this family added to `phaseVocabulary.ts`. The substitute is the complete call-site inventory + the count-gate procedure in §9 and §T5. |

---

## Corrections to Upstream Documents (found while mapping)

1. **`canvas-184.css` is not in `frontend/`.** SPEC's `canvas-184.css:170-171` resolves to
   `.planning/sketches/themes/canvas-184.css` (mirrored at
   `.claude/skills/sketch-findings-agentic-rag/sources/themes/canvas-184.css`). `:170-171` is the block's
   comment header; the 137-B constants are `:182-208` and are quoted in full in §10a. No `card-b` class is
   applied anywhere in `frontend/src`.
2. **The CSS's own `body.card-b .vmark` keeps the verdict on the RIGHT** (`:204`). The operator's
   2026-07-29 occupancy decision (SPEC Req 6 amendment → verdict `-left-2`, seal top-right) overrides the
   sketch theme. Take geometry from the CSS, occupancy from the SPEC amendment.
3. **`graft_skill_snapshots` mutates in place.** It is the right analog for *where* and *when*, and the
   wrong analog for *how* — `effective_phase` must use `model_copy`. Called out in §4.
4. **The real write chain is four layers, not two.** `WorkflowBuilderPage` no longer declares its own
   merge: it goes page → `builderStore` action → `definitionOps` pure op. The D-185-10 handler must follow
   all four, not just add a page callback. Called out in §12.

---

## Metadata

**Analog search scope:** `backend/app/models/`, `backend/app/services/harness*/`, `backend/app/api/`,
`backend/tests/unit/`, `frontend/src/components/workflows/`, `frontend/src/pages/`,
`frontend/src/hooks/`, `frontend/src/lib/api.ts`, `scripts/`, `.planning/sketches/themes/`.
**Files read this session:** 24
**Pattern extraction date:** 2026-07-29
