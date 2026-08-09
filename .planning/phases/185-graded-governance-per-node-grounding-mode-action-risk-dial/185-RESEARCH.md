# Phase 185: Graded Governance — Per-Node Grounding Mode + Action-Risk Dial — Research

**Researched:** 2026-07-29
**Domain:** Harness engine validation gates + workflow canvas/panel authoring surface
**Confidence:** HIGH (every claim below comes from reading the file at the cited line in this session)
**Mode:** Verification research. SPEC.md (9 reqs / 23 criteria) and CONTEXT.md (D-185-01…16) are LOCKED.
This document does not re-decide them — it verifies their code claims, closes the four discretion items,
and reports three lock conflicts.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Verbatim from `185-CONTEXT.md` `<decisions>`:

**A. What the engine-attached gate actually checks**
- **D-185-01** — The gate checks real retrieval evidence AND a text marker. On a *detected* step
  (`llm_agent` / `llm_batch_agents`), the synthesized `citations_required` gate uses a **new deterministic
  mode** that (a) FAILS when the phase output's `citations` list is empty, and (b) requires ≥ 1 citation
  marker in the text (the shipped `presence` regex, default pattern `\[\d+\]|\(doc[^)]*\)`).
- **D-185-02** — The panel's "what this gate does" sentence must NOT reuse the emit wording. On an agent
  step the honest claim is *retrieved-and-pointed-at*, not *every value traceable*.
- **D-185-03** — Attachment point: parse-time effective phase. Rejected: injecting inside `run_gates`.
- **D-185-04** — Disposition: retry with feedback, then `fail_run`. `on_failure: fail_run`, `max_retries: 2`.
  Rejected: `ask_user`.
- **D-185-05** — When the author already declared a `citations_required` validator, the engine's gate runs
  TOO. Both specs run; first failure wins. Rejected: replacing the author's spec.

**B. Where the governance state lives**
- **D-185-06** — Both fields sit at `PhaseSpec` level, outside the config union. Siblings of `validators`
  and `name`.
- **D-185-07** — Store the author's INTENT only; derive everything else at read time. Persist **only** the
  escalation bit; derive mode + cause. Consequence — Req 3 becomes true BY CONSTRUCTION.
- **D-185-08** — Two flat optional booleans, not one nested object. e.g. `grounding_escalated: bool = False`
  and `action_risk_armed: bool = False` (final names are the planner's call; the *shape* is locked).

**C. Who computes detection, and how the surface writes it**
- **D-185-09** — The KB tool list is SERVER-supplied; the client only does the intersection. KB membership
  ships on the **existing** `GET /workflows/grounding-bundle` payload. Rejected: a hardcoded frontend
  `KB_TOOLS` constant.
- **D-185-10** — The governance section gets its OWN caller-owned write prop. `WorkflowBuilderPage` owns
  the write via a new handler. Rejected: widening `PhaseConfigPatch`.
- **D-185-11** — Show the synthesized gate at author time; never block publish. The gate appears in the
  panel's `gates` rail as a `🔒` **locked** row. The publish gauntlet gains NO new blocking stage.

**D. How the armed action-risk checkpoint runs**
- **D-185-12** — Mechanism: a synthesized PRE-gate validator. A new registered kind (e.g.
  `action_risk_approval`, `timing: "pre"`) attached by the **same** parse-time effective-phase mechanism as
  the citation gate. Approve → `GateResult(True)`; decline → `GateResult(False)` → routes via
  `on_failure: fail_run`. *Known caveat to design against: the researcher must confirm
  `subscribe_for_response`'s no-timeout semantics and how the boot-time resume sweep re-subscribes across
  multiple uvicorn workers.*
- **D-185-13** — The wait renders on the SHIPPED `ask_user` prompt surface. Zero new run-time surface.
- **D-185-14** — The approval prompt text is ENGINE-GENERATED from the step. **No new authored-message
  field.** The armed wording MAY say the run waits; the unarmed `llm_human_input` copy must NOT.

**E. Which step types carry a dial**
- **D-185-15** — The dial exists ONLY on `llm_agent` and `llm_batch_agents`. `llm_emit` shows its grounding
  state as **read-only** text. `llm_single` / `llm_human_input` / `programmatic` render **no dial element
  at all** (absent, not disabled).
- **D-185-16** — A step type with no dial still renders the governance section, carrying the locked phrase
  **"Nothing to prove here"** and no control.

### Claude's Discretion

- Exact field names for the two PhaseSpec booleans (D-185-08 locks the shape, not the spelling).
- The exact registered `mode` string for the new `citations_required` behaviour (D-185-01).
- The exact `grounding-bundle` payload extension carrying KB membership (D-185-09) — whether a separate
  `kb_tools` array or a per-tool flag; the researcher should read the shipped payload shape first.
- The generated prompt's precise sentence construction (D-185-14), subject to the Req 9 honesty rule.

→ All four are closed in `## Discretion Items — Recommendations` below.

### Deferred Ideas (OUT OF SCOPE)

- **`PhaseNodeCard` 137-D → 137-B geometry rebuild** — its own task. **185 places its marks against 137-B
  and must not also rebuild the card.**
- **`.docx` / `.pptx` / `.xlsx` / `.pdf` inline preview** → its own insert phase immediately after 185.
- **The review moment (145), the round trip (146), a dedicated run surface, and a colour-blind-safe
  run-state shape** → **Phase 188**.
- **"Someone else approved it"** → **Phase 186**.
- **Armed-on-by-default for external actions** → **Phase 189**.
- **The stepNumber slot** — renders nothing today (D-183-07).
- **Sketch-143-B fallback** (a stitched rail outside the border) — documented swap, not a redesign.
- **`BUG-260609-02` / `BUG-260609-04`** — Phase-188 affinity, NOT folded here.
- **`spike-nl-workflow-authoring.md`** — VOCAB track, belongs to Phase 187.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **GOVERN-01** | Each node carries a grounding mode; *must prove it* auto-attaches the immutable `citations_required` coverage gate; *free to think* is ungated; a workflow freely MIXES both; the strict gate is structurally enforced and NOT author-loosenable-away; Deep byte-identical when unset (D-14). *(the "confidence gate" phrase was amended out at spec time)* | `## The Attachment Seam` (the one-line seam at `harness_engine.py:1118`); `## Verified Code Facts` rows 1-9 (`PhaseSpec`, `ValidatorSpec`, `citations_required`, the `field_map` blocker); `## Discretion Items` D-1/D-2 (field names + mode string) |
| **GOVERN-02** | The canvas visibly marks each node's governance state; rails apply graded | `## Frontend Mount Points` (seal placement, verdict-mark relocation, `groundingFor` deletion inventory, the detour edge); `## ⚠ Lock Conflicts` LC-1 (the `edgeTypes` drift) and LC-2 (the verdict-mark overlap) |
| **GOVERN-03** | Each node can carry an action-risk checkpoint built on the `llm_human_input` substrate | `## The ask_user Substrate` (indefinite wait, multi-worker, restart, event-loop safety); `## Discretion Items` D-4 (generated prompt); `## Landmines` L-4…L-8 |

</phase_requirements>

---

## Summary

**Everything the engine half of this phase needs already exists, and the attachment point is one line.**
`harness_engine.py:1118` builds `spec_by_slug = {p.slug: p for p in definition.phases}` — the single
chokepoint every run (fresh kickoff *and* boot-time resume) passes through, downstream of every
`WorkflowDefinition.model_validate()` and upstream of `_run_phase_with_gates`. Swapping it for
`{p.slug: effective_phase(p, total) for p in definition.phases}` satisfies Req 4 ("fires whether or not the
definition declares it, including on already-published definitions") without touching the save path, the
publish path, or Deep. The `timing="pre"` gate pass (`harness_engine.py:695`) already runs before the
executor body and already routes an `ask_user` disposition through `_resolve_failure_with_ask_user`, which
already pauses on the durable-prompt/pub-sub substrate and already returns `None` to mean *"the human
approved — run the body"*. D-185-12's mechanism is not just precedented, it is 90% shipped.

**Three of the locks contain factual errors about the shipped tree, all inherited from sketch 147's build
note or from reasoning about the 137-B card that was never built.** (1) There is **no `edgeTypes`
registration anywhere in `frontend/src`** — `WorkflowCanvas.tsx:279` is a comment saying the opposite; the
detour edge is net-new canvas infrastructure. (2) Moving the verdict mark to `-left-2 top-1.5` on the
**shipped 137-D card** puts it 14×8 px on top of the icon well, so the SPEC's new "0 overlaps" acceptance
criterion cannot pass until the out-of-scope 137-B rebuild lands. (3) D-185-11's "visible to `/validate`
for free" is only true for the golden run inside publish; `/validate` returns *problems*, never *gates*, so
the panel's `🔒` row must be synthesized client-side — which is fine and is what D-185-09 already implies.

**The headline landmine is confirmed and is worse than stated.** `validator_kinds.py:224-226` returns
`GateResult(False, "citations_required: no field_map on output")` when `output["field_map"]` is absent, and
neither `_exec_llm_agent` (`phase_types.py:489-495`) nor `_exec_llm_batch_agents` (`:584-590`) ever produces
one — their output is `{text, sub_run_id(s), source_refs, citations, similarity_scores}`. Attaching the
shipped mode unchanged fails 100% of detected steps. A second, previously unnamed hazard sits beside it:
the pre-gate pass writes a `gate_failed` audit row **and emits a `gate_failed` SSE event** before it can
pause for approval (`harness_engine.py:697-704`), so every armed step would announce a failure to the
frontend merely for waiting.

**Primary recommendation:** attach both synthesized specs by **appending** to `phase.validators` inside a
new pure function in `backend/app/services/harness/grounding.py` (the D-182-06 one-rule-one-home module),
called from exactly two consumers — `harness_engine.py:1118` (enforcement) and nothing else server-side;
the panel's locked-row display is a client-side intersection against a new server-supplied `kb_tools` array
on `GET /workflows/grounding-bundle`. Never implement the attachment as a Pydantic `model_validator` — the
draft save path is `json.dumps(definition.model_dump(mode="json"))` (`db/workflows.py:339,356`) and would
bake the synthesized gate permanently into the JSONB, which directly contradicts D-185-07.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| KB_TOOLS list (the safety-defining names) | API / Backend (`harness/grounding.py`) | — | D-182-06 red line: exactly ONE copy of every grounding rule, server-side |
| Detection (`available_tools ∩ KB_TOOLS`) | API / Backend (enforcement) | Browser / Client (prediction only) | Client intersects for zero-lag display; the server's run-time gate is unconditional (D-185-09) |
| Synthesized `citations_required` gate | API / Backend (`harness_engine`) | — | Req 4: fires on already-published definitions; never client-reachable |
| Synthesized `action_risk_approval` pre-gate | API / Backend (`harness_engine` + `validator_kinds`) | — | The wait must survive the client entirely |
| Approval prompt render + answer POST | Browser / Client (shipped `ask_user` surface) | API (`/pending` replay) | D-185-13 — zero new run-time surface |
| Grounding dial + refusal text | Browser / Client (new governance component) | — | Authoring only; writes an intent boolean |
| Canvas seal + detour edge | Browser / Client (`PhaseNodeCard` + a new custom edge) | — | Pure projection (D-14 red line) |
| Persisting the two intent booleans | Browser / Client → API `PATCH /workflows/{id}` | Database (JSONB) | Zero migrations; additive-optional `PhaseSpec` fields |

---

## Verified Code Facts

Every row read in this session. Line numbers are the **current truth**.

### Backend

| # | Claim (from SPEC/CONTEXT) | Status | Current truth |
|---|---|---|---|
| 1 | `PhaseSpec` at `models/harness.py:189-194` with the `name` additive-optional precedent | **VERIFIED** | `harness.py:189-194`. `name: str | None = None  # REQ-3 — additive; serializes into the definition JSONB; pre-103 rows validate with it absent` at `:194` |
| 2 | 6-member `extra="forbid"` `PhaseConfig` union at `:157-167` | **VERIFIED** | `:157-167`, `Field(discriminator="phase_type")`. `_StrictBase` = `ConfigDict(extra="forbid")` at `:27-30` |
| 3 | `ValidatorSpec` at `:170-187`, `kind` Literal membership | **VERIFIED (with a caveat)** | `:170-187`. The `kind` Literal has **9** members, not the 4 the module docblock claims (`:9-16` says "the two Literal sets remain LOCKED (do NOT change them)" — that note is **stale**: Phase 102 already grew it 4→9). Field is `config: dict`, **not** `params`. Full text quoted below. |
| 4 | `available_tools` exists only on `LlmAgentPhaseConfig` / `LlmBatchAgentsPhaseConfig` | **VERIFIED** | `:80` and `:97`. `citation_policy` only on `LlmEmitPhaseConfig:153`. `folder_scope` on all 5 LLM members (`:70, :89, :108, :145`) — confirming SPEC Req 2's "`folder_scope` is not a detection input" is necessary, not decorative |
| 5 | `citations_required` validator at `validator_kinds.py:198-238`, `field_map` blocker at `:224` | **VERIFIED** | Registration `@register_validator("citations_required")` at `:199`; fn `:200-239`. `fm = output.get("field_map")` at `:224`; `if fm is None: return GateResult(False, "citations_required: no field_map on output")` at `:225-226`. `presence` branch `:211-221` with default pattern `r"\[\d+\]|\(doc[^)]*\)"` at `:213` and `min_markers` default 1 at `:218` |
| 6 | `run_gates` at `validators.py:215-248`, `validator_index` contract | **VERIFIED (line drift −1/+1)** | `async def run_gates(phase, output: dict, ctx, *, timing: str | None = None) -> GateResult` at `validators.py:214`; body `:230-249`. **It is `async`.** `idx` is the enumerate index into the **FULL** `phase.validators` list even when `timing` filters (`:230-232` + the docstring's CRITICAL note at `:225-228`). `GateResult = namedtuple("GateResult", ["passed","error_message","validator_index"], defaults=[None])` at `:55-57` |
| 7 | Registry API for a new kind | **VERIFIED** | `VALIDATOR_REGISTRY: dict[str, Callable[[dict,dict,object], Awaitable[GateResult]]]` at `validators.py:62-64`; decorator `register_validator(kind)` at `:73-85`. Registration is by **import side-effect** — `harness/__init__.py:27` does `from . import validator_kinds`. An unregistered kind **fails closed** in `run_gates` (`:233-241`) |
| 8 | `_run_phase_with_gates` at `harness_engine.py:670-760`; pre-gate at `:695`; WR-03 rebinding at `:684-694` | **VERIFIED (line drift)** | `async def _run_phase_with_gates(` at `harness_engine.py:637`; body `:666-797`. Pre-gate `pre = await run_gates(phase, {"_phase_inputs": accumulated_outputs}, ctx, timing="pre")` at **`:695`** (exact). WR-03 seed `validators = list(...)` / `phase_max_retries = validators[0].max_retries if validators else 2` at **`:684-686`**; rebind at `:755-757`. `_route_on_failure` at `:800-819` |
| 9 | `_exec_llm_agent` output shape at `phase_types.py:422-495` | **VERIFIED** | `async def _exec_llm_agent` at `:422`; returns at `:489-495`: `{"text", "sub_run_id", "source_refs", "citations", "similarity_scores"}`. **No `field_map`.** |
| 10 | `_exec_llm_batch_agents` at `:560-592` | **VERIFIED (drift)** | `async def _exec_llm_batch_agents` at `:499`; returns at `:584-590`: `{"text", "sub_run_ids", "source_refs", "citations", "similarity_scores"}` |
| 11 | `_exec_llm_human_input` at `:594+`, timeout clamp | **VERIFIED** | `:594`. Clamp `timeout_seconds = min(phase.config.timeout_seconds, settings.ask_user_max_timeout_seconds)` at `:608-610`. Blocks at `:685-687`. Returns `{"text": prompt, "answer": answer, "tool_call_id": tool_call_id}` at `:722`. **Also carries a shutdown branch at `:696-706` that raises `asyncio.CancelledError` — this is the precedent the armed gate must copy (see L-6)** |
| 12 | `:1176` executor-internal emit citation gate — do not touch | **VERIFIED (nearby)** | `:1176-1189` is the emit oracle/user-turn assembly; the executor-internal citation gate runs `:1188-1340` (`_emit_failure_output("citation_gate_rejected", ...)` at `:1313` and `:1337`). Do not touch any of it |
| 13 | Citations come from the retrieval tool via the sub-agent loop (`task_service.py:930-937`) | **VERIFIED** | `sub_citations.extend(tr.citations)` at `task_service.py:765` (harvested off `ToolResult`); returned in the dict at `:929-937` (`"citations": sub_citations` at `:935`) |
| 14 | Folded at `harness_engine.py:296-302` | **VERIFIED** | `_accumulate_phase_grounding` at `:279-303`; `cites = output.get("citations")` / `run_citations.extend(cites)` at `:300-302` |
| 15 | `grounding.py` is the D-182-06 one-home module | **VERIFIED** | Module docblock `:1-74`. **RED LINE at `:13-15`**: "there is exactly ONE copy of every grounding rule and it lives here. No rule is ever re-implemented in a second backend module, and NEVER client-side." Exports `GroundingBundle` (`:100-134`), `assemble_grounding_bundle` (`:289`), `grounding_verdicts` (`:654`), `_check_grounding_fidelity` (`:721`), `business_requirement_missing` (`:763`), `GROUNDING_VERDICT_CODES`, `grounding_unavailable_finding` (`:496`). **NOT re-exported from `harness/__init__.py`** — import module-direct (`:45-46`) |
| 16 | `GET /workflows/grounding-bundle` route + response model | **VERIFIED** | Route `@router.get("/grounding-bundle", ...)` at `api/workflows.py:651-655`; handler `get_grounding_bundle` at `:656`. Response model `GroundingBundleResponse` at `:356-390`. Payload quoted below |
| 17 | `/validate` seam + `lint_workflow` | **VERIFIED** | `lint_workflow(definition: WorkflowDefinition) -> list[LintError]` at `harness/reachability.py:111`, called at `api/workflows.py:575`. The route returns `ValidateResponse(ok=..., verdicts=[Verdict(code, phase, message, severity)])` at `:645-653`. **It reports problems, never gates** |
| 18 | The 5 `KB_TOOLS` names are real registry names | **VERIFIED** | All 5 resolve in `tool_dispatcher._TOOL_REGISTRY`: `read_document:4014`, `search_documents:4015`, `query_documents:4016`, `analyze_document:4018`, `get_related_documents:4041` |
| 19 | `apply_tool_budget` could drop a whitelisted KB tool on a low-`max_tools` provider | **NOT FOUND — the opposite is true** | `openai_service.py:1173-1203`: "**NEVER drop a whitelisted tool** … If the whitelist alone exceeds the cap, keep ALL whitelist tools". Verified negative — this is *not* an SC#10 hazard |

**`ValidatorSpec` verbatim (`backend/app/models/harness.py:170-187`)** — the planner must synthesize two of these:

```python
class ValidatorSpec(_StrictBase):
    """HARNESS-04 gate kinds (091 owns execution; this is the shape).

    Phase 102 (GATE-01): + 5 library kinds (D-12) + timing (D-10) + ask_user
    on_failure value (D-11, on_failure stays a str — skip_to_phase:<slug> already
    parses, so ask_user is just one more recognized value, not a new type).
    """

    kind: Literal[
        "json_schema", "regex_match", "workspace_file_exists", "programmatic",
        "citations_required", "freshness", "structure_check",
        "output_file_valid", "llm_judge_rubric",
    ]
    config: dict = Field(default_factory=dict)
    on_failure: str = "fail_run"  # fail_run | retry | skip_to_phase:<slug> | ask_user (D-11)
    max_retries: int = 2
    timing: Literal["pre", "post"] = "post"  # D-10 — default post = every existing gate byte-unchanged
```

`PhaseSpec` verbatim (`:189-194`):

```python
class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig  # parsed via discriminator
    validators: list[ValidatorSpec] = Field(default_factory=list)
    name: str | None = None  # REQ-3 — additive; serializes into the definition JSONB; pre-103 rows validate with it absent
```

**`GroundingBundleResponse` verbatim payload shape (`backend/app/api/workflows.py:373-390`)** — D-185-09 extends this:

```python
class GroundingBundleResponse(BaseModel):
    tools: list[str] = Field(default_factory=list)
    folders: list[PaletteFolder] = Field(default_factory=list)
    skills: list[PaletteSkill] = Field(default_factory=list)
    template_placeholders: list[str] = Field(default_factory=list)
    degraded: list[str] = Field(default_factory=list)
```

Four flat, independent lists. `PaletteFolder` (`:335-340`) and `PaletteSkill` (`:343-353`) are explicit
projections, never raw rows (CR-02).

### Frontend

| # | Claim | Status | Current truth |
|---|---|---|---|
| 20 | `PhaseFormPanel.tsx` is 1078 lines | **VERIFIED** | Exactly 1078 |
| 21 | `PhaseGateRow` discriminated union at `:85-107` | **VERIFIED** | Type at `:83-85`; docblock `:66-82`. Verbatim below |
| 22 | `PhaseFormRails` with `gates` + `toolOptions` | **VERIFIED** | `:104-108`. Verbatim below |
| 23 | `onChange: (patch: PhaseConfigPatch) => void` patches `config` only | **VERIFIED** | Prop at `:120`; `export type PhaseConfigPatch = Record<string, unknown>` at `:60`. The `onRemove`-belongs-to-the-caller precedent is spelled out at `:76-79` |
| 24 | The gates rail mounts inside the panel | **VERIFIED** | `{rails && <GatesRail gates={rails.gates} />}` at **`:1032`**, the LAST child of the scroll body, immediately before `</div></aside>` at `:1033-1035`. `GatesRail` itself at `:617-657`. Order rail at `:762` |
| 25 | `groundingFor()` at `phaseVocabulary.ts:223`, 3 badge strings | **VERIFIED** | `GROUNDINGS` const at `:191-195`; strings `"Must cite its sources"` / `"Flags uncited claims"` / `"No sources needed"` at `:192/193/194`. `groundingFor` at `:223-230`. Its docblock at `:200-201` names Phase 185 as the replacer. `waitsForYou` at `:236-238` |
| 26 | Verdict mark at `-right-2 top-1.5`, `PhaseNodeCard.tsx:298` | **VERIFIED** | `"pointer-events-none absolute -right-2 top-1.5 z-[8] grid h-[22px] w-[22px]"` at **`:298`**. Guarded by `mark ? (...) : null` at `:293-306` |
| 27 | No-focusable-control rule at `:37-48`; asserted in `WorkflowCanvas.test.tsx:231-238` | **VERIFIED** | Docblock `:37-48`. Test `it("no focusable control exists INSIDE any node (the double-tab-stop mistake)")` at `WorkflowCanvas.test.tsx:231-238`, asserting `node.querySelectorAll("button, a, [tabindex]")` is length 0 for every `.react-flow__node`. Companion test at `:225-229` pins `[tabindex="0"]` node count == phase count |
| 28 | 137-D geometry at `:311-313`; `NODE_MIN_HEIGHT` | **VERIFIED** | Icon well `"pointer-events-none absolute left-0 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center"` at `:313`. `CANVAS_LAYOUT` at `canvasModel.ts:62-77`: `NODE_WIDTH: 260`, `NODE_MIN_HEIGHT: 96`, `PITCH_X: 320`, `LANE_Y: 0`, `EDGE_ANCHOR_Y: 28`, `END_CAP_SIZE: 40`. Card inner is `ml-6 … py-3 pl-10 pr-3` at `:238-240`. **Two-badge budget is a max-2 tuple union (`BadgeSlots`) — a third badge is a typecheck error (`:32-35`)** |
| 29 | `WorkflowCanvas.tsx:279` registers an `edgeTypes` entry named `flow` | **❌ NOT FOUND — HARD DRIFT** | `:273-289` is `DEFAULT_EDGE_OPTIONS` (an arrow marker). The docblock at `:276-279` says the **opposite**: *"Edge CLASSIFICATION rides on `data.kind`, not on `edge.type` — setting `edge.type` would make the library look up an `edgeTypes` entry named `flow` and fall back with a warning, since 183 registers none."* `grep -rn "edgeTypes" frontend/src` returns **exactly one hit — that comment**. See LC-1 |
| 30 | `WorkflowCanvas.tsx:618-627` — the ✕ geometry | **VERIFIED** | `:596-631`. `EDIT_AFFORDANCE` at `:314-327`: `INSERT_SIZE: 26`, `REMOVE_SIZE: 24`, `GAP: PITCH_X - NODE_WIDTH` (= **60**), `INSERT_Y: LANE_Y + EDGE_ANCHOR_Y` (= **28**), `PICKER_DROP: 22`, `PICKER_WIDTH: 300`. ✕ transform at `:613-627`: x = `lane + NODE_WIDTH/2 - 12`, y = `heightAt(pos) - 12 + verticalOffsetFor(...)` — i.e. card-centred, straddling the card's bottom edge |
| 31 | `canvasModel.ts:88` — `edge.data.kind` | **VERIFIED** | `CANVAS_EDGE_KINDS` at `:89-97`: `flow` / `skip` / `end`. `CanvasEdgeData { kind: CanvasEdgeKind }` at `:147-149`; `CanvasEdge = Edge<CanvasEdgeData>` at `:152`. Edges are pushed with `data: { kind: ... }` at `:264`, `:278`, `:313`, `:341` — **`type` is never set on any edge** |
| 32 | `toCanvas` / `fromCanvas` round-trip + reference identity | **VERIFIED** | `toCanvas` at `:214`; `fromCanvas` at `:403-421`. **`fromCanvas` returns the SAME `PhaseSpecJSON` objects it was handed** (`out.push(phase)` at `:419`) — docblock `:358-370` calls this "CARRY-THROUGH BY REFERENCE, NEVER A RECONSTRUCTION", proven by `toBe` identity in `canvasModel.roundtrip.test.ts`. **Consequence: the two new PhaseSpec booleans round-trip for free.** `PhaseNodeData` (`:108-125`) carries `grounding: Grounding` and `waitsForYou: boolean`, set at `:196-197` |
| 33 | `useGroundingBundle` feeds `toolOptions` | **VERIFIED** | `frontend/src/hooks/useGroundingBundle.ts`. The ONLY caller of `GET /workflows/grounding-bundle` (docblock `:3-5`). Returns a 4-member union `{idle} | {loading} | {ready, tools, folders, skills, degraded: readonly []} | {unavailable, reason, tools}` (`:57-90`) |
| 34 | `useLiveValidation` — the app's only `/validate` call | **VERIFIED** | `useLiveValidation` at `:193`. State union at `:118-127`: `verdicts` / `degraded` members carry `verdicts: Verdict[]`. Canvas receives `verdicts` as a **prop** (docblock `:8`) |
| 35 | `WorkflowBuilderPage` owns the gates derivation | **VERIFIED** | `gatesFor(phase)` at `WorkflowBuilderPage.tsx:308-312`, importing `groundingFor` at `:142`. Returns `grounding.mode === "open" ? [] : [{ label: grounding.words, locked: true }]` |
| 36 | `scripts/vitest-count-gate.cjs` pins per-file counts | **VERIFIED** | `BASELINE` at `:58-75` (16 files, `BASELINE_TOTAL` 424 at `:77`); `TARGETS` at `:80-91`. Fails on `[count-decrease]`; **an increase is allowed**. Relevant pins: `phaseVocabulary.test.ts: 42`, `WorkflowCanvas.test.tsx: 31`, `canvasModel.test.ts: 26`, `PhaseFormPanel.test.tsx: 19`, `PhaseNodeCard.test.tsx` is **not** pinned (postdates the 424 pin) |

**`PhaseGateRow` + `PhaseFormRails` verbatim (`PhaseFormPanel.tsx:83-108`):**

```ts
export type PhaseGateRow =
  | { label: string; locked: true }
  | { label: string; locked: false; onRemove: () => void }

export interface PhaseFormRails {
  order: { index: number; total: number }
  toolOptions: string[] | "degraded"
  gates: PhaseGateRow[]
}
```

**`PhaseSpecJSON` verbatim (`phaseVocabulary.ts:65-71`)** — gains the two booleans:

```ts
export interface PhaseSpecJSON {
  slug: string
  phase_index: number
  name?: string | null
  config: PhaseConfigJSON
  validators?: ValidatorJSON[]
}
```

### Complete `groundingFor` / badge-string deletion inventory (Req 6 + Req 7)

`grep -rn "groundingFor|waitsForYou|Must cite its sources|Flags uncited claims|No sources needed"` over
`frontend/src`. Every site below must be reconciled — deletion must be **complete**:

| File | Line(s) | What |
|---|---|---|
| `components/workflows/phaseVocabulary.ts` | 191-195, 223-230 | `GROUNDINGS` const + `groundingFor` — **the deletion target** |
| `components/workflows/canvasModel.ts` | 41, 196 | imports + `grounding: groundingFor(phase)` on `PhaseNodeData` |
| `components/workflows/canvasModel.ts` | 121 | `PhaseNodeData.grounding` field declaration (`:118-119` comment "Badge slot 1") |
| `components/workflows/PhaseNode.tsx` | 170-176 | `badges: BadgeSlots = data.waitsForYou ? [grounding, waitsForYou] : [grounding]` — the grounding badge slot is consumed here |
| `pages/WorkflowBuilderPage.tsx` | 142, 293, 310 | import + `gatesFor()` docblock + call |
| `components/workflows/phaseVocabulary.test.ts` | 13, 30, 165-233 | ~10 `it()` blocks over `groundingFor` — **pinned at 42; deletion trips `[count-decrease]`** |
| `components/workflows/canvasModel.test.ts` | 317, 326, 329-330 | asserts every node carries `grounding` + `waitsForYou` |
| `components/workflows/WorkflowCanvas.test.tsx` | 303 | `expect(chip.textContent).toContain("No sources needed")` — **pinned at 31** |
| `components/workflows/PhaseFormPanel.rails.test.tsx` | 112, 228, 248 | fixture labels `"Must cite its sources"` (not pinned) |
| `components/workflows/PhaseFormPanel.tsx` | 47, 97 | two docblock mentions naming Phase 185 as the replacer |

`waitsForYou` is **NOT** deleted (it is badge slot 2 and is unrelated to grounding), but note Req 7's
banned-term grep must not false-positive on it.

---

## The Attachment Seam

### The one line

```python
# backend/app/services/harness_engine.py:1118  (inside run_workflow)
spec_by_slug = {p.slug: p for p in definition.phases}
```

Used at `:1149` (`phase = spec_by_slug[row["slug"]]`) and nowhere else. This is **the** seam:

- It is downstream of **every** `WorkflowDefinition.model_validate()` — both the fresh-kickoff parse
  (`workflow_kickoff.py:227` → `from app.models.harness import WorkflowDefinition`) and the resume parse
  (`harness_engine._load_run_definition:1449`).
- It is upstream of `_run_phase_with_gates`, which owns the pre-gate pass, the post-gate pass, the WR-03
  retry rebinding and `_route_on_failure`. Every one of those reads `phase.validators` off the object this
  dict hands over.
- **It never touches the save path.** `create_draft`/`update_draft` (`api/workflows.py:822`, `:887`) hand the
  Pydantic body straight to `db/workflows.py:349-356`, which does
  `json.dumps(definition.model_dump(mode="json"))`. Since the synthesis happens *inside `run_workflow`*, no
  synthesized `ValidatorSpec` can ever be persisted.
- It leaves `workflow_phases` rows untouched (they are minted from the original definition; `_is_llm_human_input`
  at `:1866-1880` reads their stored `config`).

**Shipped precedent for exactly this idiom:** `graft_skill_snapshots(parsed, _snaps)` at
`harness_engine.py:1458-1460` — a post-parse, pre-consumption transform that returns an augmented
definition without ever writing it back.

### Recommended shape

Put the pure function in `backend/app/services/harness/grounding.py` (the D-182-06 one-home module — read
its RED LINE at `:13-15` before adding a derivation anywhere else):

```python
# backend/app/services/harness/grounding.py  (new, additive)

KB_TOOLS: frozenset[str] = frozenset({
    "search_documents", "query_documents", "read_document",
    "analyze_document", "get_related_documents",
})
KB_TOOLS_SORTED: list[str] = sorted(KB_TOOLS)   # the wire form for the palette

def grounding_cause(phase) -> str | None:
    """'detected' | 'already-set' | 'escalated' | None. Pure; no I/O. D-185-07."""
    tools = set(getattr(phase.config, "available_tools", None) or ())
    if tools & KB_TOOLS:
        return "detected"                     # detection WINS over escalation (SPEC Req 3)
    if getattr(phase.config, "citation_policy", None) == "strict":
        return "already-set"
    if getattr(phase, "grounding_escalated", False):
        return "escalated"
    return None

def effective_phase(phase, *, total_phases: int):
    """The phase the ENGINE runs: authored validators + any synthesized gates.
    NEVER persisted. Called from harness_engine.py:1118 only."""
    extra: list[ValidatorSpec] = []
    if getattr(phase, "action_risk_armed", False):
        extra.append(ValidatorSpec(
            kind="action_risk_approval",
            timing="pre",
            on_failure="ask_user",
            max_retries=0,
            config={"prompt": _approval_sentence(phase, total_phases)},
        ))
    if grounding_cause(phase) == "detected":
        extra.append(ValidatorSpec(
            kind="citations_required",
            timing="post",
            on_failure="fail_run",
            max_retries=2,
            config={"mode": "retrieved_and_cited"},
        ))
    if not extra:
        return phase                           # identity — byte-identical for every ungoverned phase
    return phase.model_copy(update={"validators": [*phase.validators, *extra]})
```

### APPEND, never prepend — and why it matters

`harness_engine.py:685` seeds the retry bound from `validators[0].max_retries`. Prepending a synthesized
spec would change that seed for every phase that already has authored validators. Appending keeps
`validators[0]` the author's first spec, so the seed is byte-identical. The WR-03 rebinding at `:755-757`
fires **before** the `exhausted` check at `:772`, so a later failing index still governs the bound
correctly. `_failing_on_failure(phase, failed_idx)` (`:615`) and `_route_on_failure` (`:800`) both index the
same effective list `run_gates` enumerated, so `validator_index` stays correct end-to-end. **No off-by-one.**

### D-185-05 (both gates run) holds for free

With append + `run_gates`'s first-failure-wins loop (`:230-249`), an author's deliberately weak
`{kind: citations_required, config: {mode: presence, min_markers: 0}}` runs at index 0 and **passes**, then
the engine's spec runs at index N and fails. The author's spec cannot displace the engine's.

### D-185-11 — "visible to `/validate` and the publish gauntlet for free" is only HALF true

**FALSE for `/validate`.** `POST /workflows/validate` (`api/workflows.py:509`) parses the body, runs
`lint_workflow`, `grounding_verdicts`, `business_requirement_missing` and `_interactive_phase_failures`, and
returns `ValidateResponse(ok, verdicts)` — a list of *problems*. A synthesized gate that would pass produces
no verdict, and a gate that would fail cannot be known at author time. `/validate` will never surface it.
**The panel's `🔒` locked row must be synthesized client-side** from the same `available_tools ∩ kb_tools`
intersection D-185-09 already puts in the client. This is consistent — not a conflict — but the planner must
not write a task that expects `/validate` to return it.

**TRUE, and with a bite, for publish.** `publish_service.publish` runs a **real golden run** through
`run_workflow` (stage list quoted at `api/workflows.py:766-771`). That run passes through `:1118`, so a
detected step whose golden run retrieves nothing will now fail the golden-run stage and block publish. No
new *stage* is added (D-185-11's letter holds), but publish **behaviour changes** for detected steps. Given
every `workflow_definitions` row is throwaway test data (operator), this is acceptable — but it must be
stated in the plan, not discovered in UAT.

---

## The ask_user Substrate

Read in full: `backend/app/services/ask_user_service.py` (297 lines),
`harness_engine._resolve_failure_with_ask_user:852-1034`, `resume_stranded_workflows:1743-1863`,
`phase_types._exec_llm_human_input:594-722`.

### Signature and no-timeout semantics

```python
# backend/app/services/ask_user_service.py:122-146
async def subscribe_for_response(
    redis: "aioredis.Redis",
    run_id: UUID,
    tool_call_id: str,
    timeout_seconds: float,
) -> "dict | None":
```

- **It is `async`.** `timeout_seconds` is a **required positional** typed `float`. There is **no shipped
  no-timeout mode.**
- It delegates to `_subscribe_and_block` (`:53-119`), whose wait is
  `await asyncio.wait_for(_wait(), timeout=timeout_seconds)` at `:104`.
- **`asyncio.wait_for(coro, timeout=None)` waits forever.** Passing `None` therefore produces an indefinite
  wait *at runtime*, even though the annotation says `float`. `subscribe_for_response` passes the value
  straight through (`:144-146`) — **but `resume_pending_prompt` does `float(timeout_seconds)` at `:215` and
  would `TypeError` on `None`.** Both live call sites also hard-cast: `harness_engine.py:973` and
  `phase_types.py:686` both write `float(timeout_seconds)`.
- **Recommendation:** widen the annotation to `timeout_seconds: float | None` and add one sentence to the
  docstring ("`None` = wait indefinitely — the Phase 185 armed-checkpoint disposition"). Do **not** invent a
  parallel `subscribe_forever` helper; that is a second copy of the load-bearing SUBSCRIBE→SADD→block
  ordering (Pitfall 2).

### Return values

| Wake reason | Return |
|---|---|
| User answered | `{"kind": "response", "response_text": str, "choice_index": int | None}` (`publish_response:233-237`) |
| User hit Stop | `{"kind": "cancel"}` (`publish_cancel_sentinel:258`) |
| Graceful app shutdown | `{"kind": "shutdown"}` (`broadcast_shutdown_sentinel_to_all:279`) |
| Timeout | `None` |
| Unparseable payload | `None` (`:97-101`) |

There is **no "disconnect" wake** — a closed browser tab is invisible to the subscriber. The prompt row is
durable (`messages` row with `tool_calls[0].kind == "ask_user_prompt"`), so the user can answer later from
`/pending`.

### Multi-worker: YES, cross-worker rendezvous works

Redis **pub/sub**, one channel per paused call: `ask_user:{run_id}:{tool_call_id}` (`:75`), advertised in
the SET `ask_user:channels:{run_id}` (`:76, :80`) with a 3600s safety TTL (`:81`). The module docblock at
`:9-16` states the design intent explicitly: *"cross-worker rendezvous — POST may land on any worker, paused
handler may be on any worker."* Redis broadcasts a PUBLISH to every subscriber on the channel regardless of
connection, so worker A's blocked run receives an answer POSTed to worker B. `WORKER_COUNT=2` is safe.

`publish_response` returns the subscriber count; **0 means the SUBSCRIBE is dead**, and the POST endpoint
still returns 200 because the response row was persisted first (`:228-230`, RESEARCH §A.7).

### Event-loop safety (D-v2.5-01): SAFE

The wait is a **pure asyncio poll loop** — `await pubsub.get_message(ignore_subscribe_messages=True,
timeout=1.0)` in a `while True` (`:88-101`), wrapped in `asyncio.wait_for`. `redis.asyncio`'s `get_message`
is a coroutine; nothing blocks the event loop and nothing occupies a threadpool worker. An **indefinite wait
costs one suspended coroutine and one Redis pub/sub connection** — not a thread, not the loop.

The shipped safe idiom to copy is `_resolve_failure_with_ask_user` (`harness_engine.py:852-1034`), which
waits at `:972-974`:

```python
from app.services.ask_user_service import subscribe_for_response
payload = await subscribe_for_response(redis, run_id, tool_call_id, float(timeout_seconds))
```

**Note the important structural fact:** this wait does **not** happen inside `run_gates`. `run_gates`
returns a `GateResult`, and the *caller* (`_run_phase_with_gates`) then routes to
`_resolve_failure_with_ask_user`, which owns the durable row, the emit, the wait and the receipt. D-185-12's
prose says the block goes "inside a gate abstraction"; the **shipped disposition machinery is a strictly
better home and is already wired for the pre-gate case** (see the recommendation below).

### Restart survival: PARTIAL — and the resume sweep will NOT re-subscribe an armed gate

An indefinite wait does **not** survive a process restart: the task dies with the worker. Recovery depends
on `resume_stranded_workflows` (`:1743-1863`), and here is the concrete gap:

1. `find_resumable_runs` anchors on a `workflow_phases` row with `status='active'`. **This is satisfied** —
   `run_workflow` calls `mark_phase_active(pool, phase_id)` at `:1156` *before* `_run_phase_with_gates` at
   `:1173`, so the phase is durably active while the pre-gate blocks. The run is findable.
2. `claim_run` CAS (`:1773`) means exactly one worker resumes. Fine.
3. **The re-subscribe branch is gated on `_is_llm_human_input(active)` (`:1778`)**, which returns True only
   when the active phase's stored `config.phase_type == "llm_human_input"` **or** its stored `output` dict
   contains a `tool_call_id` (`:1866-1880`). An armed `llm_agent` step matches **neither**: its config type
   is `llm_agent`, and its output was never persisted (the phase never completed). ⇒ **`resume_pending_prompt`
   is never called for an armed checkpoint.**
4. The sweep therefore falls through to `_resume_run` → `run_workflow`, which re-runs the active phase from
   the top → the pre-gate fires again → a **new** `tool_call_id`, a **new** durable prompt row, a **new**
   subscribe.

Net effect: the run does not advance and the person is re-asked — which satisfies fail-closed — but the
**old prompt row is orphaned**, and on a *graceful* shutdown it is not expired either (`run_workflow`'s
escape handler skips `_expire_pending_ask_user` when `is_app_shutting_down()` — `:1204-1216`, the 096-09
fix). `/pending` can then serve a dead prompt whose channel has no subscriber. **That is precisely G-4
scenario 3's stated failure mode ("the prompt survived but is unreachable").** See L-7.

### The recommended mechanism (closes D-185-12's caveat)

Register `action_risk_approval` as a normal validator kind that **always fails** with a structured message,
and let the shipped disposition machinery own the wait:

```python
# backend/app/services/harness/validator_kinds.py  (additive)
@register_validator("action_risk_approval")
async def _validate_action_risk_approval(output: dict, config: dict, ctx) -> GateResult:
    """GOVERN-03 — always FAILS, so the ask_user disposition owns the pause.
    Never blocks, never raises: the gate contract is preserved verbatim."""
    return GateResult(False, "action_risk:approval|" + (config.get("prompt") or ""))
```

with `ValidatorSpec(kind="action_risk_approval", timing="pre", on_failure="ask_user", max_retries=0)`.
The shipped flow then runs itself:

| Step | Shipped code |
|---|---|
| Pre-gate pass runs it before the executor body | `harness_engine.py:695` |
| Failure routes to the disposition helper with `is_pre=True` | `:705-710` |
| Helper sees `on_failure == "ask_user"` and pauses | `:887-890`, `:972-974` |
| Choices derived from the structured message prefix | `_ask_user_choices_from_finding:822-844` (the `freshness:staleness|` idiom — extend with an `action_risk:approval|` branch) |
| Approve → governance receipt + `return None` = **run the body** | `:1005-1033` |
| Decline → `PhaseOutcome("fail_run", ...)` | `:1000-1003` |
| Arming changes neither `len(phases)` nor any `phase_index` | true by construction — no phase is added |

**Deltas the planner must specify** (each is small and named):

1. `_resolve_failure_with_ask_user` computes `timeout_seconds` at `:907-912` from
   `phase.config.timeout_seconds` clamped by `settings.ask_user_max_timeout_seconds`. For an
   `action_risk_approval` failing spec it must be **`None`**, passed through to
   `subscribe_for_response(..., None)` (drop the `float()` cast at `:973`). Emit/prompt-row
   `timeout_seconds` should carry `0` or `null` so the frontend does not render a false countdown.
2. Prompt copy: `:903-906` composes *"A validation check on phase 'X' flagged: …"* — wrong for an armed
   step. Use the generated sentence carried in the gate's `error_message` (after the `action_risk:approval|`
   prefix) verbatim.
3. `payload is None` at `:980-984` → `fail_run` "unanswered". With `timeout=None` this branch becomes
   unreachable for armed gates except on an unparseable payload; keep it (fail-closed).
4. `{"kind": "shutdown"}` must **not** be treated as a decision — see L-6.
5. The pre-gate emits `gate_failed` at `:702-704` before pausing — see L-5.

**Nothing downstream assumes a run makes progress.** Searched: `runs:active` / `runs_by_thread:` are the
Redis stream-buffer keys; the Redis stream is `XADD … maxlen=10000, approximate=True` (`ask_user_service.py:175-176`)
with no TTL-based reaping of a live run; `harness_resume_lease_seconds` (`:1773`) is a *claim* lease
consulted only by the boot sweep, not a watchdog; `wall_clock` (`asyncio.wait_for` at `:721-724`) wraps
`_execute_phase` **only** — the pre-gate is outside it. **No watchdog will kill an indefinite pre-gate wait.**
The one real bound is the 3600s TTL on `ask_user:channels:{run_id}` (`:81`), which only affects the
cancel/shutdown *sweeps* finding the channel — an expired SET entry means a Stop or a graceful shutdown
would fail to wake a >1h wait. Worth a `redis.expire` refresh or a longer TTL for armed gates; flagged as
L-8, low severity.

---

## Frontend Mount Points

### 1. The governance section — `PhaseFormPanel.tsx`

**Mount at `:1032`**, replacing/adjacent to the existing gates rail, as the last children of the scroll body:

```tsx
        {rails && <GovernanceSection … />}     {/* NEW — its own component file */}
        {rails && <GatesRail gates={rails.gates} />}
      </div>
    </aside>
```

- G-5 is honoured by construction: `PhaseFormPanel.tsx` gains **one JSX line + one import**. The section
  ships as `frontend/src/components/workflows/GovernanceSection.tsx`.
- Every branch must stay gated on `rails` being present — the panel serves **both** the flag-off Spine view
  and the Canvas view from one instance (docblock `:40-48`, `:129-138`). `rails` absent ⇒ byte-identical
  render (D-181-01). The guard suite is `PhaseFormPanel.rails.test.tsx`.
- The `PhaseGateRow` union already makes "a locked gate with a remove button" unrepresentable — D-185-11's
  `🔒` row is `{ label: "…", locked: true }`, nothing more.
- `GatesRail`'s footnote at `:651-654` already says *"A locked check came with a choice above it — change
  what made it apply and it goes. There is no switch."* That is the refusal vocabulary already in the tree;
  reuse its voice.

### 2. The write prop — `WorkflowBuilderPage.tsx`

`onChange` is config-only (`:60`, `:120`, and the explicit `onRemove`-belongs-to-the-caller precedent at
`:76-79`). D-185-10's new prop:

```ts
/** D-185-10 — the PhaseSpec-level governance write. Caller-owned for the same reason
 *  `PhaseGateRow.onRemove` is: these fields are siblings of `validators`, and this
 *  panel's only write seam patches `config`. */
onGovernanceChange?: (patch: { grounding_escalated?: boolean; action_risk_armed?: boolean }) => void
```

Implemented in `WorkflowBuilderPage` next to `gatesFor` (`:308-312`), producing a **new** `PhaseSpecJSON`
object for the edited phase and leaving every other phase object identical by reference (`fromCanvas`'s
carry-through invariant, `canvasModel.ts:358-370`). Note `definitionOps` is the sole DEFINITION→DEFINITION
mutation home (`:377-379`) — the setter belongs there, not in `canvasModel`.

### 3. Live intersection — no lag, no reload (G-4 scenario 1)

`useGroundingBundle` already returns `tools` and will return `kb_tools` (see D-3). The chip toggle already
flows `onChange → page state → phase.config.available_tools`. Computing
`available_tools ∩ kb_tools` as a **derived value during render** (not in state, not in an effect) makes the
dial, the strike-through and the canvas seal move on the *same commit* as the chip. `useGroundingBundle`
fires once per `enabled` and never polls (docblock `:32-38`), so the KB list is already in hand.

### 4. `PhaseNodeCard.tsx` — the seal and the verdict mark

- **Seal**: a new non-interactive `<span>` at top-right, sibling of the verdict mark, rendered whenever
  `data.grounded === true`, **never conditional on run state** (SPEC constraint). Sketch 143-A's locked CSS
  (`graded-governance.md:129-138`): `top: 11px; right: 11px; width/height 21px; border-radius 50%;
  z-index 6; background hsl(220 30% 100% / .1); border 1px solid hsl(220 30% 100% / .34)`. Plus the
  reinforcement edge `.node.proven { border-color: hsl(220 30% 100% / .34) }`.
- **It must carry no `role`, no `tabIndex`, no handler** — the card's `:37-48` rule, asserted by
  `WorkflowCanvas.test.tsx:231-238`. Mirror the verdict mark's `pointer-events-none` (`:298`).
- **The two-badge budget is a typecheck fence** (`:32-35`): `BadgeSlots` is a max-2 tuple union. Deleting
  the grounding badge frees slot 1 for 188/189 — **do not fill it.**
- **Verdict mark relocation `-right-2` → `-left-2`** at `:298`: a one-token change plus rewriting the
  docblock at `:286-292` (which currently justifies *right* by reasoning from 137-B). **See LC-2 — on the
  shipped 137-D card this creates a new 14×8 px overlap with the icon well.**

### 5. The detour edge — `WorkflowCanvas.tsx` + `canvasModel.ts`

**This is net-new infrastructure (LC-1), not a data change.** Concretely required:

1. A new component `frontend/src/components/workflows/FlowEdge.tsx` implementing the two paths.
2. `const edgeTypes = { flow: FlowEdge } as const` — a module-level frozen object (react-flow warns and
   re-renders if the map identity changes per render), registered on `<ReactFlow edgeTypes={edgeTypes} …>`.
3. `toCanvas` must set `type: CANVAS_EDGE_KINDS.flow` on flow edges (`canvasModel.ts:264`) — it currently
   sets **only** `data.kind`. This changes the rendered path for **every** flow edge, so the edge component
   must reproduce today's default rendering when unarmed-and-not-risky, or the whole canvas visibly shifts.
4. Extend `CanvasEdgeData` (`:147-149`) with the armed state: `{ kind: CanvasEdgeKind; armed?: boolean }`,
   set from the **target** phase's `action_risk_armed` in `toCanvas`.
5. `DEFAULT_EDGE_OPTIONS` (`:283-289`) supplies the arrow marker — a custom edge must render
   `markerEnd` itself or it loses the arrowhead.

**Verified detour geometry, lifted verbatim from `.planning/sketches/147-the-armed-mark/index.html:481-499`.**
All coordinates are inside the 60px gap box, origin at the gap's left edge; `INSERT_Y = 28`, `GAP = 60`:

```js
ARC  = 'M0,28 C14,28 16,62 30,62 C44,62 46,28 60,28'
LINE = 'M0,28 L60,28'

// ARMED — the arc IS the path; NO straight line may run past it
<path d={ARC} fill="none" stroke="hsl(220 30% 100% / .62)" strokeWidth={2}/>
<circle cx={30} cy={62} r={4.5} fill="none" stroke="hsl(220 30% 100% / .85)" strokeWidth={1.6}/>
// label "you say yes" at y = INSERT_Y + 44 = 72

// NOT ARMED — faint dashed ghost + a solid line straight through
<path d={ARC} fill="none" stroke="hsl(220 30% 100% / .17)" strokeWidth={1.5} strokeDasharray="3 3"/>
<circle cx={30} cy={62} r={4.5} fill="none" stroke="hsl(220 30% 100% / .2)" strokeWidth={1.4} strokeDasharray="2 2"/>
<path d={LINE} fill="none" stroke="var(--color-border)" strokeWidth={2}/>
// label "nobody asked" at y = 72
```

Container: `width: GAP (60)`, `height: INSERT_Y + 60 (88)`, `pointer-events: none`, `svg { overflow: visible }`.

**Clearance, computed by the sketch, not asserted:**
- The ＋ box is 26px centred in the gap at `INSERT_Y` ⇒ x 17…43, y 15…41. The arc's tightest point inside
  that x-range sits **8.2 px below** the ＋'s bottom edge; the curve **never enters the box**.
- The ✕ is card-centred at y = H−12…H+12 (`WorkflowCanvas.tsx:613-627`) — **on the card**, not in the gap.
  The detour lives entirely in the gap ⇒ clear of the ✕.
- The rejected *countersign* would have landed exactly on the ✕; the rejected *waiting card* grazes it by
  ~5px. Both are recorded as rejected — do not revisit.

---

## Discretion Items — Recommendations

### D-1 — Field names for the two `PhaseSpec` booleans

**Recommendation (adopt D-185-08's own illustrative spelling verbatim):**

```python
class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig
    validators: list[ValidatorSpec] = Field(default_factory=list)
    name: str | None = None
    # ── Phase 185 (GOVERN-01 / GOVERN-03, D-185-06/07/08). Additive; pre-185 rows
    # validate with both absent. INTENT ONLY — `detected` and `already-set` are derived
    # at read time from config, so "a detected step set back to free-to-think" is not a
    # representable value. Follows the `name` precedent above literally.
    grounding_escalated: bool = False   # GOVERN-01 — the author hand-locked this step
    action_risk_armed: bool = False     # GOVERN-03 — stop and ask a human before this step runs
```

Rationale: `bool = False` (not `bool | None`) makes absence unambiguous, exactly as D-185-08 requires;
`grounding_escalated` names the **only** authored cause of the three, which is the whole point of D-185-07;
`action_risk_armed` matches the operator's own vocabulary ("armed", "arming", "the armed mark") throughout
sketch 147 and SPEC Req 8, so the code and the design docs share one word. `escalated` also matches the
locked cause name in the one-way lock table (`graded-governance.md:24-28`).

Side effect to state in the plan: `model_dump(mode="json")` now writes `"grounding_escalated": false,
"action_risk_armed": false` into every saved draft JSONB. This is additive and harmless (identical to what
`name: null` already does), but the first save after 185 is not a zero-diff save.

### D-2 — The registered `mode` string

Shipped modes on `citations_required` (`validator_kinds.py:209-226`): `"deterministic"` (default), `"emit"`
(accepted alias), `"presence"`.

**Recommendation: `"retrieved_and_cited"`.**

```python
if mode == "retrieved_and_cited":
    # GOVERN-01 / D-185-01 — the DETECTED-agent-step mode. Two halves, both required:
    #   (a) real retrieval evidence — output["citations"] non-empty. These objects come
    #       from the retrieval TOOL via the sub-agent loop (task_service.py:765), so the
    #       model cannot fake them.
    #   (b) >= 1 citation marker in the text — the shipped `presence` check, so the
    #       answer POINTS AT what it retrieved instead of merely having searched.
    # NOT check_coverage: that is computable only over a structured leaf set (a field_map),
    # which no agent step produces (phase_types.py:489-495 / :584-590). D-185-02.
```

Rationale: it names **what it checks**, so a `gate_failed` audit row reading
`citations_required: mode=retrieved_and_cited` is self-documenting in the ledger; it collides with no
shipped literal; and it cannot be confused with `deterministic`/`emit` (a `field_map` check) or bare
`presence` (markers only). Runner-up: `"agent"` — elegant symmetry with `"emit"`, rejected because it names
a phase family rather than a check, and the milestone's whole thesis is that governance copy must say what
it does. Failure messages should follow the shipped format:
`f"citations_required: nothing was retrieved (0 sources) — this step reads your documents and must show where its answer came from"` and
`f"citations_required: {n}/{need} citation markers in the answer"`.

### D-3 — The `grounding-bundle` payload extension

**Recommendation: a separate flat `kb_tools: list[str]` array, served unconditionally and unfiltered.**

```python
# backend/app/api/workflows.py — GroundingBundleResponse (additive, after `tools`)
    # Phase 185 (D-185-09 / GOVERN-01): the KB-reading tool names. The client intersects
    # this with a phase's available_tools so the dial, the strike-through and the seal move
    # on the same render as a tool chip — no network hop for a refusal reason. The client
    # NEVER enforces (harness_engine.py:1118 does, unconditionally), so a wrong client read
    # is a display bug, never a safety hole. NOT filtered by `tools`: this is the
    # safety-DEFINING list, and a degraded palette must not silently un-mark a locked step.
    kb_tools: list[str] = Field(default_factory=list)
```

served as `kb_tools=grounding.KB_TOOLS_SORTED` at `api/workflows.py:704-716`, and mirrored on
`GroundingBundle` (`grounding.py:111-134`) so `assemble_grounding_bundle` remains the one computation.

Why not a per-tool flag: `tools` is `list[str]` on the wire and typed `tools: string[]` on **both** members
of `useGroundingBundle`'s union (`:66`, `:88`). Converting it to `list[{name, is_kb}]` is a breaking change
to a shipped, cacheable, near-static route and to every consumer of `PhaseFormRails.toolOptions`
(`string[] | "degraded"`). A separate array is purely additive, mirrors the shipped shape exactly (four
flat independent lists + `degraded`), and satisfies a trivially checkable invariant (`kb_tools` is a fixed
5-element constant, independent of the caller's registry). It is also readable from the
`kind: "unavailable"` member, which matters: a degraded folder/skill read must not stop the canvas marking
a grounded step.

### D-4 — The generated approval-prompt sentence (D-185-14)

**Recommendation** — composed at synthesis time (`effective_phase`, where `len(definition.phases)` is in
hand) and carried in `ValidatorSpec.config["prompt"]`:

```python
def _approval_sentence(phase, total_phases: int) -> str:
    label = phase.name or phase.slug
    return (
        f"Step {phase.phase_index + 1} of {total_phases}, “{label}”, is about to run. "
        f"This step is marked as needing your approval first. "
        f"The run is waiting here and will not continue until you answer."
    )
```

Choices, via the shipped structured-finding extension point (`_ask_user_choices_from_finding:822-844`):

```python
if msg.startswith("action_risk:approval|"):
    return ["Approve and run this step", "Do not run it"]
```

Honesty checks against Req 9's third bullet:
- **Armed copy MAY say the run waits** — it does, and with an indefinite `subscribe_for_response` it is now
  *true*, which is exactly the `references/approval-and-review.md` "TWO ENGINE TRUTHS" gap this closes.
- **Unarmed `llm_human_input` copy must NOT** — untouched. `_exec_llm_human_input:607` still renders
  `phase.config.prompt` verbatim with its clamped timeout. Zero characters change on that path.
- It never says *approved*, *safe*, or *proven*; it states position, identity and consequence only.

⚠ **Blocking prerequisite:** `_is_abort_choice` (`harness_engine.py:847-850`) matches only
`("abort", "cancel", "stop", "")`. **`"Do not run it"` would be read as PROCEED.** The set must gain the
decline phrase (or the `action_risk` branch must map choices explicitly). This is a one-line change that
cannot affect the freshness gates (their choices are literally `"Proceed anyway"` / `"Abort"`), but it is a
**fail-open bug if forgotten**. See L-4.

### D-5 (bonus) — the at-rest canvas mark for an armed checkpoint

SPEC §Constraints says sketches "locked no winner" for this. **That is stale.** Sketch 147 closed it on
2026-07-29 (`.planning/sketches/147-the-armed-mark/README.md:142-166`, commit `e55b3c09`) and the SPEC's own
Req 8 amendment carries the conclusion: **the detour**, panel-owned arming, read-only canvas mark. The exact
geometry constants are transcribed above in `## Frontend Mount Points §5` — hand them to the executor
verbatim; do not re-derive.

---

## Validation Architecture

`.planning/config.json` → `workflow.nyquist_validation: true` ⇒ this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | pytest (`backend/tests/unit/`), run from the `venv` |
| Framework (frontend) | vitest 4 + @testing-library/react (`frontend/`) |
| Config file | `frontend/vitest.config.*`; backend `backend/pytest.ini` / `pyproject` |
| Quick run (backend) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_validator_kinds.py tests/unit/test_harness_models.py tests/unit/test_ask_user_disposition.py -x -q` |
| Quick run (frontend) | `cd frontend && npx vitest run src/components/workflows src/hooks/useGroundingBundle.test.ts` |
| Full suite + count gate | `node scripts/vitest-count-gate.cjs` (**must be run — see L-9**) |
| Typecheck | `cd frontend && npx tsc -b` (**`-b`, not `--noEmit` — the v3.3 lesson**) |

**Existing files new tests should sit beside:**
`backend/tests/unit/test_validator_kinds.py`, `test_harness_models.py`, `test_ask_user_disposition.py`,
`test_182_validate.py`, `test_citation_policy.py`;
`frontend/src/components/workflows/{phaseVocabulary,canvasModel.roundtrip,PhaseNodeCard,PhaseFormPanel.rails,WorkflowCanvas}.test.tsx`,
`frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`.

### The 23 acceptance criteria → cheapest honest proof

| # | SPEC acceptance criterion | Proof | Where |
|---|---|---|---|
| 1 | Pre-185 JSONB row `model_validate()`s | pytest | `test_harness_models.py` — a fixture dict with neither new key |
| 2 | `git diff -- supabase/migrations` is 0 lines; head still 113 | grep/CI | `scripts/check-deploy-drift.sh` sibling; a one-line plan verification step |
| 3 | Grounding field round-trips `toCanvas`→`fromCanvas` with reference identity | vitest | `canvasModel.roundtrip.test.ts` — `toBe` identity; **holds by construction** (`canvasModel.ts:419`) |
| 4 | Each of the 5 `KB_TOOLS`, in isolation, detects → cause `detected` | pytest (parametrized ×5) | new `test_185_detection.py` beside `test_182_validate.py` |
| 5 | `llm_agent` w/ only non-KB tools = free; `llm_single` never auto-locks; `llm_emit` strict → `already-set` | pytest | same file |
| 6 | `folder_scope` alone never triggers detection | pytest | same file — a phase with `folder_scope` and empty `available_tools` |
| 7 | Hand-escalated step + KB tool → cause flips to `detected`, undo disappears | pytest **+** vitest | `grounding_cause()` unit test; DOM test that the undo control is absent |
| 8 | No code path sets a `detected` step back to *free to think* | **grep assertion** | true by construction (D-185-07): grep proves no writer of a `mode`/`cause` field exists. A source-guard test in the `canvasModel.purity.test.ts` idiom |
| 9 | Published definition + KB tool + **no** declared validator → run fails on uncited output | pytest (engine-level) | new `test_185_engine_attachment.py` — drive `run_workflow` with a stub ctx; assert `run_failed` |
| 10 | Deleting the validator from the JSONB does not remove enforcement | pytest | same file — same fixture with `validators: []` |
| 11 | Deep chat path byte-identical (D-14) | **grep/diff fence + existing suite** | `git diff --stat` over `agent_loop.py` / `tool_dispatcher.py` must be **0**; `revertByteIdentical.test.tsx` (frontend half). See L-10 |
| 12 | Refused dial press renders the reason as text-queryable DOM; `getByTitle` finds none | vitest | new `GovernanceSection.test.tsx` — `getByText(/…/)` + `expect(() => getByTitle(reason)).toThrow()` |
| 13 | A step type where grounding cannot apply renders **no** dial (query returns null, not disabled) | vitest | same file — `queryByRole("button", {name: /Free to think/})` is `null` for `llm_single` / `programmatic` / `llm_human_input` |
| 14 | 0 occurrences of the three retired badge strings in the workflow tree | **grep assertion** | plan verification step over `frontend/src/components/workflows` + `frontend/src/pages` |
| 15 | 0 for each banned term in user-visible strings; ≥1 for each required term | **grep assertion** | same. Careful: `N/A` and `Proven` need word-boundary anchoring to avoid false hits |
| 16 | The corner seal renders identically across idle / running / needs-you / failed | vitest **+ operator UAT** | vitest can pin *"the seal markup does not read `status`"* (a props-fence test); the *visual* claim is **UAT-only** (G-4 #2) |
| 17 | A colour-stripped render still distinguishes grounded from open | **operator UAT only** | jsdom has no computed paint; screenshot with `filter: grayscale(1)` |
| 18 | Arming on a 5-step workflow leaves `len(phases)==5`, every `phase_index` unchanged, canvas renders 5 nodes | pytest **+** vitest | `effective_phase` adds no phase (pytest); `toCanvas` node count (vitest) |
| 19 | Checkpoint **set** + `subscribe_for_response` → `None` ⇒ the run does NOT advance | pytest | `test_ask_user_disposition.py` sibling; monkeypatch `subscribe_for_response`; assert the next phase's executor was never called |
| 20 | Checkpoint **unset** ⇒ `_exec_llm_human_input` byte-identical | pytest **+ git diff** | existing `test_ask_user_disposition.py` must pass unchanged; `git diff` on `_exec_llm_human_input:594-722` shows 0 lines |
| 21 | `PhaseFormPanel.tsx` grows by a mount point only | **grep/diff assertion** | `git diff --stat frontend/src/components/workflows/PhaseFormPanel.tsx` ≤ ~4 lines; the section is its own file |
| 22 | SC#10 UAT covers 4 providers + multi-tool + parallel-thread + long-message | **cross-provider UAT** | `185-VALIDATION.md`, rows below |
| 23 *(Req 6 amendment)* | Verdict mark renders at the card's LEFT; zone check over {icon, verdict, seal, stepNumber, run-state} reports 0 overlaps | vitest (geometry unit test) | **⚠ cannot pass on the shipped 137-D card — see LC-2** |
| 24 *(Req 8 amendment)* | The canvas armed mark has no `role="button"`, no `tabIndex`, no click handler; exactly ONE tab stop per node | vitest | extend `WorkflowCanvas.test.tsx:231-238` (already walks every node); add an assertion over the detour edge's DOM |

### Sampling rate

- **Per task commit:** the quick run for the half being touched (backend pytest subset **or** the frontend
  workflows subset) + `npx tsc -b`.
- **Per wave merge:** `node scripts/vitest-count-gate.cjs` + `cd backend && venv/Scripts/python -m pytest tests/unit -q`.
- **Phase gate:** both full suites green **and** the 4 G-4 lived-experience scenarios **and** the SC#10
  scoreboard, before `/gsd:verify-work`.

### Wave 0 gaps

- [ ] `backend/tests/unit/test_185_detection.py` — covers criteria 4, 5, 6, 7, 8
- [ ] `backend/tests/unit/test_185_engine_attachment.py` — covers 9, 10, 18, 19
- [ ] `frontend/src/components/workflows/GovernanceSection.test.tsx` — covers 12, 13, 21
- [ ] `frontend/src/components/workflows/FlowEdge.test.tsx` — covers 24 + the detour geometry
- [ ] **`scripts/vitest-count-gate.cjs` `BASELINE` update** for `phaseVocabulary.test.ts` (42) and
      `WorkflowCanvas.test.tsx` (31) — a *decrease* is a hard gate failure and deleting `groundingFor`'s
      ~10 `it()` blocks causes one. This edit must land in the **same commit** as the deletion, with the new
      pin measured, not guessed. (L-9)
- [ ] No framework install needed — pytest and vitest both ship.

### G-4 lived-experience UAT — MANDATORY, operator-defined at scope time, carried verbatim from CONTEXT §specifics

Chrome MCP drives all four at phase verification. **Wire format + screenshot are insufficient.**

1. **Watch a step lock in front of you.** Switch on *Search your documents* and watch three things move at
   once with no reload: the loose side strikes through, pressing it prints the refusal reason as readable
   text, the canvas card grows its corner seal. *Failure: any of the three lags behind the chip, flickers,
   or only appears after a refresh.*
2. **The seal survives a live run.** Launch a run; watch a grounded card go idle → running → needs-you →
   failed. *Failure: the seal dims, hides, shifts, or is swallowed by the status colour — at exactly the
   moment it matters most.*
3. **Arm it and walk away.** Arm an outbound step, launch, close the tab, come back much later. *Failure:
   the run advanced on its own (today's behaviour), or the prompt survived but is unreachable.*
4. **The detour reads as a detour.** Armed: the connector visibly leaves the flow and returns through the
   person-point, with NO straight line past it. Unarmed: faint dashed ghost with the line through.
   *Failure: armed and unarmed are indistinguishable at a glance, or the arc collides with the ✕ or ＋.*

### SC#10 cross-provider scoreboard (mandatory — CLAUDE.md §"UAT scoreboard recipe")

Authored in `185-VALIDATION.md`, **not** in PLAN.md tasks.

| Axis | Row | What it proves |
|---|---|---|
| OpenAI | grounded `llm_agent` w/ `search_documents`, no declared validator | citations non-empty ⇒ gate passes |
| Anthropic (native) | same definition | same — the native tool-use path populates `ToolResult.citations` identically |
| Google | same definition | **the highest-risk row** — see L-3 |
| OpenRouter | same definition | experimental path; fix only if native-safe |
| Multi-tool | one prompt exercising `search_documents` **+** `execute_code` on a detected step | the KB tool is still called when it competes with another |
| Parallel-thread | Thread A mid-armed-wait while Thread B launches a second run | one indefinite pub/sub subscriber does not starve the other; `WORKER_COUNT=2` |
| Long-message | ≥50 prior messages or ≥5 KB prompt on a detected step | citations still harvested after context pressure |
| **Negative row (add)** | a detected step where the model answers **without** searching | the gate FAILS honestly and the retry feedback names what was missing |

---

## Landmines

### L-1 — The `field_map` blocker (confirmed, and the exact keys)

`validator_kinds.py:224-226` fails closed when `output["field_map"]` is absent. Detection fires only on
`llm_agent` / `llm_batch_agents`, whose outputs are:

```python
# phase_types.py:489-495 (_exec_llm_agent)
{"text", "sub_run_id", "source_refs", "citations", "similarity_scores"}
# phase_types.py:584-590 (_exec_llm_batch_agents)
{"text", "sub_run_ids", "source_refs", "citations", "similarity_scores"}
```

**Both `source_refs` and `citations` are present.** The new mode must read **`citations`** (D-185-01's
letter), not `source_refs`: `citations` are the deduped, passage-bearing objects the Deep path treats as
authoritative (`_finalize_run_grounding:307-355` prefers `unique_citations` over `source_refs`), and
`source_refs` can be populated by non-KB tools. Reading `source_refs` would weaken the gate. `field_map`
appears on the agent path in **exactly zero** places.

### L-2 — Do NOT implement attachment as a Pydantic `model_validator`

`create_draft` / `update_draft` (`api/workflows.py:822`, `:887`) hand the parsed `WorkflowDefinition`
straight to `db/workflows.py:349-356`, which persists `json.dumps(definition.model_dump(mode="json"))`. A
`@model_validator(mode="after")` on `PhaseSpec` would therefore **bake the synthesized gate permanently into
the JSONB on the next save** — after which removing the KB tool would leave the gate attached forever,
breaking Req 3's "removing the tool is the only exit" and directly contradicting D-185-07's derive-don't-store
rule. Use the `harness_engine.py:1118` seam.

### L-3 — SC#10: the real divergence is *whether the tool is called*, not how citations are shaped

`citations` are built by the **dispatcher's tool handlers** and harvested off `ToolResult`
(`task_service.py:763-767`) — a provider-independent path. `apply_tool_budget` **never drops a whitelisted
tool** (`openai_service.py:1193-1196`), so the KB tool is always in the schema list. **Verified negative:
neither is an SC#10 hazard.**

The divergence lives one layer up: whether the *model* emits a tool call at all, which is entirely
provider-behavioural and rides `_stream_one_iteration`'s per-provider parsing. A model that answers from the
prompt without searching produces `citations == []` ⇒ the gate fails ⇒ **the same definition passes on one
provider and fails the run on another.** Known provider-specific hazards already in this repo that could
suppress the tool call: the Gemini multi-type `type:[...]` schema rejection (sanitized at
`_translate_nullable_type`) and the DeepSeek DSML leak strip in `openai_compat.py`. **Google is the highest-risk
row.** The negative UAT row above is what exposes it. Per the provider-docs-first rule, research each
provider's own tool-use documentation before attributing a failure to our code.

This is arguably the gate working as designed — a "must prove it" step that retrieved nothing *should*
fail — but the plan must state that expectation up front so a Google failure is not read as a regression.

### L-4 — `_is_abort_choice("")` is True; `"Do not run it"` is FALSE ⇒ fail-open

`harness_engine.py:847-850`:

```python
def _is_abort_choice(choice: str) -> bool:
    return (choice or "").strip().lower() in ("abort", "cancel", "stop", "")
```

An unrecognised decline phrase falls through to the **Proceed** branch (`:1005-1034`), writing a
`validator_ask_user_approved` receipt and running the risky step. Extend the set (or map the
`action_risk:approval|` choices explicitly). One line; a fail-open bug if missed.

### L-5 — Every armed step emits a `gate_failed` SSE before it can pause

The pre-gate failure path writes an audit row **and** emits `gate_failed` to the producer stream
(`harness_engine.py:697-704`) *before* calling `_resolve_failure_with_ask_user`. An armed step that is
merely waiting would announce a failure to the chat/canvas. The frontend's existing `gate_failed` handler
would render it as a problem.

**Fix:** branch on the failing spec's kind — for `action_risk_approval`, emit a distinct
`action_risk_pending` event (or suppress the emit and let the `ask_user_prompt` at `:958-964` be the only
signal), and write the audit row under a truthful `event_type` (`action_risk_pending`, not `gate_failed`).
The audit ledger's vocabulary rule ("consequence ≠ receipt") makes this a correctness issue, not cosmetics.

### L-6 — A graceful restart mid-wait currently FAILS the run

With `subscribe_for_response` returning `{"kind": "shutdown"}`, `_resolve_failure_with_ask_user` computes
`choice = ""` (the payload is not `kind: "response"`), `_is_abort_choice("")` → **True** → `fail_run`. Safe
(not fail-open), but it destroys the run on a routine deploy and violates G-4 scenario 3.

**Fix — copy the shipped precedent verbatim.** `_exec_llm_human_input:696-706` raises
`asyncio.CancelledError` on a shutdown payload so the phase stays `active` and the durable prompt row
survives; `run_workflow`'s escape handler skips prompt expiry when `is_app_shutting_down()`
(`:1204-1216`). Do exactly the same in `_resolve_failure_with_ask_user`, quoting 096-09.

### L-7 — The boot-time resume sweep will not re-subscribe an armed pre-gate

`resume_stranded_workflows:1778` gates the re-subscribe branch on `_is_llm_human_input(active)`
(`:1866-1880`), which is False for an armed `llm_agent` (config type is `llm_agent`; output is `None`). The
run *is* re-driven and *is* re-asked with a fresh `tool_call_id` — fail-closed — but the **old** pending
prompt row is never expired on the graceful-shutdown path, so `/pending` can serve a dead, unanswerable
card. That is G-4 scenario 3's named failure.

**Two viable fixes (planner's call, but pick one explicitly):**
(a) widen the sweep's branch — detect an armed active phase (`spec.action_risk_armed` on the loaded
definition) and call `resume_pending_prompt` with `timeout_seconds=None`; or
(b) before re-driving an armed phase, call `_expire_pending_ask_user` for that run so exactly one live
prompt exists. (b) is smaller; (a) preserves the same `tool_call_id` and is what "waits for you" really means.

### L-8 — The `ask_user:channels:{run_id}` SET has a 3600s TTL

`ask_user_service.py:81` — `await redis.expire(channels_set_key, 3600)`. After an hour the channel is no
longer advertised, so `publish_cancel_sentinel` (user Stop) and `broadcast_shutdown_sentinel_to_all`
(graceful restart) **cannot find** a still-waiting armed gate. The wait itself survives (the SUBSCRIBE is
independent), but the run becomes un-Stoppable and un-drainable. An indefinite wait routinely exceeds an
hour. **Fix:** refresh the TTL periodically inside the wait loop, or use a longer/absent TTL when
`timeout_seconds is None`. Low severity, real.

### L-9 — Deleting `groundingFor` trips the vitest count gate

`scripts/vitest-count-gate.cjs` `BASELINE` (`:58-75`) pins `phaseVocabulary.test.ts: 42` and
`WorkflowCanvas.test.tsx: 31`, and the gate exits 1 on `[count-decrease]`. `phaseVocabulary.test.ts:165-233`
is ~10 `it()` blocks over `groundingFor`; `WorkflowCanvas.test.tsx:300-304` asserts `"No sources needed"`.
The pins must be re-measured and updated **in the same commit** as the deletion. (This is the Phase-177
lesson working exactly as designed — it is a speed bump, not a bug.)

### L-10 — The D-14 Deep byte-identity fence for this phase

Files this phase touches that are **also** on the Deep chat path:

| File | Deep exposure | Guard |
|---|---|---|
| `backend/app/services/harness/validators.py` | **None** — `run_gates` / `VALIDATOR_REGISTRY` are harness-only; Deep never calls them | Grep: no `run_gates` reference in `agent_loop.py` / `tool_dispatcher.py` |
| `backend/app/services/harness/validator_kinds.py` | **None** — harness-only, registered by `harness/__init__.py` import | same |
| `backend/app/services/harness_engine.py` | **None** — the engine is the workflow executor; Deep uses `agent_loop.py` | same |
| `backend/app/models/harness.py` | **None** — parses `workflow_definitions` JSONB only | same |
| **`backend/app/services/ask_user_service.py`** | **YES** — the Deep dispatcher's `ask_user` tool shares `publish_response` / the cancel + shutdown sweeps, though `tool_dispatcher.py:3824` documents that it does **not** call `subscribe_for_response` | **The concrete fence:** widening the `timeout_seconds` annotation to `float \| None` is a type-only change; the default path is byte-identical because no existing caller passes `None`. Assert it with a pytest that the Deep `ask_user` handler's timeout behaviour is unchanged, **plus** `git diff` showing only the annotation + docstring lines changed in `_subscribe_and_block`/`subscribe_for_response` |
| `backend/app/services/harness/grounding.py` | **None** — not imported by `agent_loop`; `harness/__init__.py:45-46` explicitly keeps it out of the package re-export | Grep |
| `backend/app/api/workflows.py` | **None** — a separate router from `api/threads.py` | Grep |
| Every `frontend/src/components/workflows/*` + `pages/WorkflowBuilderPage.tsx` | **None** — canvas/authoring only | `revertByteIdentical.test.tsx` (flag-off) + `PhaseFormPanel.rails.test.tsx` (rails-absent) |

**Recommended plan verification step:** `git diff --stat` restricted to
`backend/app/services/agent_loop.py backend/app/services/tool_dispatcher.py backend/app/services/openai_service.py backend/app/services/anthropic_service.py`
must be **0 lines**. That is the concrete, greppable D-14 proof.

### L-11 — `ValidatorSpec.kind` Literal must grow, and the module docblock says not to

`models/harness.py:15-16` says *"the two Literal sets remain LOCKED (do NOT change them)"*. That note is
**stale** — Phase 102 already grew `kind` from 4 to 9. Adding `"action_risk_approval"` is additive (old rows
still validate) and is required, because `ValidatorSpec` is `_StrictBase` and construction validates.
Update the docblock in the same edit so the next reader is not misled.

### L-12 — `extra="forbid"` round-trip is safe, but only for the two flat booleans

Adding `grounding_escalated` / `action_risk_armed` to `PhaseSpec` is the exact `PhaseSpec.name` pattern
(`:194`). Every pre-185 row still `model_validate()`s. **Do not** add anything to a `PhaseConfig` union
member — D-185-06 rejected that, and the union's `extra="forbid"` would make a 6× copy-paste a permanent
maintenance hazard.

### L-13 — Detection must beat escalation, or Req 3 breaks

SPEC Req 3: *"cause `escalated` → the author may undo, **unless** detection subsequently applies, at which
point detection wins and the undo disappears."* The `grounding_cause()` sketch above checks `detected`
**first**, so an escalated step that later gains `search_documents` reports `detected` and the undo affordance
disappears — with the stored `grounding_escalated: true` simply becoming inert. Removing the tool restores
`escalated` (and the undo). This is the correct total ordering; do not reorder the branches.

### L-14 — `llm_emit` + `already-set` is derived from a field the dial does not own

`citation_policy` lives only on `LlmEmitPhaseConfig:153` and is already an editable dial elsewhere in the
panel. D-185-15 makes `llm_emit` **read-only text** in the governance section. Do not render a second
control for it, or two surfaces one scroll apart will make opposite claims about the same stored value —
the exact defect `phaseVocabulary.ts:208-213` documents for `"partial"`.

---

## ⚠ Lock Conflicts

Three. None is fatal; each needs an explicit planner decision.

### LC-1 — `edgeTypes` does not exist. The detour IS net-new canvas infrastructure. **(HIGH)**

**The lock says** (SPEC Req 8 amendment, and `147/README.md:164-166`):
> *"this is a custom edge, not a node change — it rides the `edgeTypes` entry named `flow` that
> `WorkflowCanvas.tsx:279` already registers … **No net-new canvas infrastructure.**"*

**The tree says** the opposite. `grep -rn "edgeTypes" frontend/src` returns **exactly one hit**, and it is a
comment at `WorkflowCanvas.tsx:279` asserting that no such registration exists:

> *"Edge CLASSIFICATION rides on `data.kind`, not on `edge.type` — setting `edge.type` would make the
> library look up an `edgeTypes` entry named `flow` and fall back with a warning, since 183 registers none."*

`:277-289` is `DEFAULT_EDGE_OPTIONS` (an arrow marker), not a type map. `canvasModel.ts` sets
`data: { kind: … }` on all four edge-push sites (`:264, :278, :313, :341`) and **never sets `type`**.

**Impact:** four net-new pieces (a `FlowEdge` component, a module-level `edgeTypes` map, `edge.type` now set
in `toCanvas`, and `markerEnd` re-rendered inside the custom edge), and — because `type` was previously
unset — **every flow edge on the canvas switches from the library default renderer to ours.** The unarmed,
non-risky path must reproduce today's rendering exactly or the whole canvas visibly changes. This is real
scope the SPEC's "no net-new infrastructure" line hid.

**Recommendation:** keep the detour (the shape is operator-locked and the geometry is verified), but plan it
as its own task with its own visual-regression check on ordinary flow edges. Do not let a "just wire the
data" estimate stand.

### LC-2 — Moving the verdict mark to `-left-2` collides with the icon on the SHIPPED card **(HIGH)**

**The lock says** (SPEC Req 6 amendment): the verdict mark moves to `-left-2 top-1.5`, and adds the
acceptance criterion *"a zone check over {icon, verdict, seal, stepNumber, run-state slot} reports **0
overlaps between rendered marks**."* Separately, SPEC §Out-of-scope forbids rebuilding `PhaseNodeCard.tsx`
from 137-D to 137-B: *"185 places its marks against 137-B and must not also rebuild the card."*

**Computed against the shipped component** (`PhaseNodeCard.tsx:238-240, 293-313`; `canvasModel.ts:62-77`):

```
outer container   260 × 96, position: relative
icon well         absolute left-0 top-1/2 h-14 w-14 -translate-y-1/2
                  → x   0 … 56    y  20 … 76
verdict at -left-2 top-1.5, 22 × 22
                  → x  -8 … 14    y   6 … 28
                  ────────────────────────────────
                  OVERLAP           14 × 8 px
```

Today at `-right-2` (x 246…268) there is no icon overlap — only the 3×17 px seal collision sketch 147
identified. **Moving left trades one overlap for another, on the card that actually renders.** The overlap
lands on the icon well's *bounding box*; the well's visible `rounded-full` disc does not reach that corner
(distance 31.9 px from centre vs a 28 px radius), so it may look acceptable while a bounding-box zone check
— which is how sketch 147 computed the 3×17 px figure — **fails**.

**Options for the planner (pick explicitly):**
1. **Sequence the 137-B rebuild first.** Land the deferred card-geometry task (`padding-top` 34→42,
   `NODE_MIN_HEIGHT` 96→104, icon to top, 248 px) as a prerequisite wave, then 185's marks land against the
   card the SPEC assumes. Cleanest; costs a task the SPEC pushed out.
2. **Keep the verdict at `-right-2` for 185 and place the seal at top-**left**.** Violates Req 6's
   "top-right is CLAIMED for governance" — a lock, so this needs operator sign-off.
3. **Move it and accept the residual**, replacing acceptance criterion 23 with "0 overlaps *between the
   verdict mark and the seal*" and recording the icon graze as a deferred item that the 137-B task clears.
   Cheapest; weakens a criterion the operator explicitly added.

**Researcher's recommendation: option 1.** The SPEC itself says 185 "places its marks against 137-B"; the
only way that sentence is true is if 137-B exists when 185's marks land. Options 2 and 3 both require
amending a lock.

### LC-3 — D-185-11's "visible to `/validate` … for free" is false for `/validate` **(MEDIUM)**

**The lock says:** *"Parse-time attachment (D-185-03) makes it visible to `/validate` and the publish
gauntlet. Use that visibility: the gate appears in the panel's `gates` rail as a `🔒` locked row."*

**The tree says** `POST /workflows/validate` returns `ValidateResponse(ok, verdicts)` where a `Verdict` is
`{code, phase, message, severity}` (`api/workflows.py:645-653`) — a list of **problems**. It has no channel
for "here is a gate that will run". A passing synthesized gate produces nothing, and whether a future run
will retrieve anything is unknowable at author time (D-185-11 says so itself).

**Resolution (no lock amendment needed):** the outcome D-185-11 wants is still achieved — the client already
holds `available_tools` and (per D-3) `kb_tools`, so `gatesFor()` in `WorkflowBuilderPage.tsx:308-312`
synthesizes the `🔒` row locally. The **publish** half of the claim *is* true and does bite (the golden run
now enforces the gate). The planner must simply not write a task that expects `/validate` to return the row.

**Nothing else conflicts.** D-185-01 through D-185-16 are otherwise implementable exactly as written against
the tree as it stands on 2026-07-29.

---

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every mechanism reuses shipped code: `pydantic`,
`redis.asyncio`, `@xyflow/react` v12 and `vitest` are all already dependencies. The Package Legitimacy Gate
is therefore not applicable — no `slopcheck` run, no registry verification, and nothing for the planner to
gate behind a `checkpoint:human-verify`.

If a task proposes a new dependency (e.g. an SVG path helper for the detour edge), that is a scope change:
the detour is expressible in raw `<path d="…">` with the constants transcribed above.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python venv (`backend/venv`) | all backend work + pytest | ✓ | project rule | — |
| Redis (docker-compose.dev.yml) | the armed-checkpoint pub/sub UAT | ✓ | local container | none — UAT 3 needs it |
| Supabase local (CLI) | run/publish UAT, `/pending` replay | ✓ | local container | — |
| Node + vitest | frontend suites + the count gate | ✓ | vitest 4 | — |
| Chrome MCP | the 4 G-4 lived-experience scenarios | ✓ (can hang) | — | operator-clicks + psycopg2 (`:54322`) per the shipped fallback |
| 4 provider API keys (OpenAI / Anthropic / Google / OpenRouter) | SC#10 scoreboard | operator-held | — | **none** — SC#10 cannot be descoped |

**Missing dependencies with no fallback:** none identified.

---

## Project Constraints (from CLAUDE.md)

Directives that bind this phase; the planner must verify compliance:

- **Python backend must use a `venv`.** Every pytest command in this document is venv-relative.
- **No LangChain, no LangGraph — raw SDK calls only.** Nothing here adds an orchestration layer.
- **Pydantic for structured LLM outputs.** `ValidatorSpec` / `PhaseSpec` extensions follow the shipped
  `_StrictBase` idiom.
- **Migrations policy:** numbered SQL under `supabase/migrations/`, applied via the SQL editor. **This phase
  ships zero migrations; live head stays at 113.**
- **Stream chat responses via SSE.** The `ask_user_prompt` / `gate_failed` events ride the existing stream —
  see L-5 for the event-vocabulary correction.
- **No blocking I/O inside async handlers (D-v2.5-01).** Verified safe: the indefinite wait is a pure
  asyncio poll (`ask_user_service.py:88-104`), not a threadpool occupant.
- **Provider-docs-first.** Any SC#10 divergence must be researched against the provider's own tool-use
  documentation before being attributed to our code (L-3).
- **Workflow guardrails:** G-2 satisfied (sketches 142/143/144/147 operator-approved). G-5 honoured by
  construction — `PhaseFormPanel.tsx` (1078 L) gains a mount point only; the governance section is its own
  component. **Record the G-5 fire as honoured-by-construction in STATE.md.** Note `WorkflowCanvas.tsx`
  (1505 L) is now the largest workflow file and LC-1 adds to it — worth a G-5 note for Phase 188.
- **G-4 lived-experience UAT gate:** the four operator-defined scenarios above are mandatory and
  Chrome-MCP-driven.
- **SC#10 UAT scoreboard recipe:** all four axes, authored in `185-VALIDATION.md`, never in PLAN.md tasks.
- **Sketch-findings skill:** `Skill("sketch-findings-agentic-rag")` must be loaded when touching
  `PhaseNodeCard`, `WorkflowCanvas`, `PhaseFormPanel`, `canvasModel`, or any governance/refusal copy.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `asyncio.wait_for(coro, timeout=None)` waits indefinitely, so passing `None` through `subscribe_for_response` gives an indefinite wait | The ask_user Substrate | Low — documented Python stdlib behaviour, but **verify with one unit test before building on it** |
| A2 | Redis pub/sub delivers to a subscriber on a different uvicorn worker | The ask_user Substrate | Low — this is pub/sub's defining property and the module docblock (`:9-16`) states it is the shipped design intent; a UAT row (parallel-thread) proves it |
| A3 | Google is the highest-risk SC#10 row for a suppressed tool call | Landmines L-3 | Medium — inferred from the repo's own Gemini schema-trap history, not measured. The negative UAT row is what settles it |
| A4 | The bounding-box zone check in acceptance criterion 23 is what the operator meant (sketch 147 computed the 3×17 px figure that way) | ⚠ Lock Conflicts LC-2 | Medium — if a circle-aware check was meant, LC-2 softens to cosmetic |
| A5 | `run_gates`'s `phase` argument is the same object handed over by `spec_by_slug`, so a `model_copy` swap at `:1118` reaches every gate consumer | The Attachment Seam | Low — traced through `:1149 → :1173 → :695/:740`; no other read of `definition.phases` exists inside the run loop |
| A6 | `publish_service.publish`'s golden run goes through `run_workflow` (and therefore `:1118`) | The Attachment Seam | Low — the stage list at `api/workflows.py:766-771` says "a REAL golden run"; **confirm the exact call in `publish_service.py` during planning** |

---

## Open Questions

1. **Which LC-2 option does the operator want?**
   - What we know: the shipped card is 137-D; the SPEC's marks are drawn against 137-B; the 137-B rebuild is
     explicitly out of scope for 185; moving the verdict left creates a 14×8 px icon overlap on 137-D.
   - What's unclear: whether the operator accepts a prerequisite card-geometry wave inside this phase's
     sequencing, or prefers to weaken acceptance criterion 23.
   - Recommendation: surface it at plan-check as a one-question decision. Default to option 1 (sequence the
     rebuild first) — it is the only option that makes the SPEC's own sentence true.

2. **L-7: which resume fix?** (re-subscribe the same `tool_call_id`, or expire-then-re-ask.)
   - What we know: both are fail-closed; (a) preserves the prompt identity the user is looking at, (b) is a
     smaller diff.
   - Recommendation: (a), because G-4 scenario 3's stated failure is "the prompt survived but is
     unreachable" — re-asking with a new id *is* that failure from the user's chair.

3. **Does `publish_service` mint a `WorkflowDefinition` separately from `run_workflow`?** Not traced in this
   session. If it drives the engine through a different entry point, that entry needs the same
   `effective_phase` swap. **Confirm during planning** (one grep in `publish_service.py`).

4. **Does the frontend render a countdown from `ask_user_prompt.timeout_seconds`?** If so, an armed prompt
   must send `null`/`0` and the renderer must handle it as "no deadline" rather than "expired". Not traced;
   check `PendingAsk` / the Phase 094 frame during planning.

---

## Sources

### Primary (HIGH confidence) — read in full or in the cited range, this session

- `backend/app/models/harness.py` (1-240)
- `backend/app/services/harness/validators.py` (complete, 250 lines)
- `backend/app/services/harness/validator_kinds.py` (1-280)
- `backend/app/services/harness_engine.py` (175-215, 279-360, 640-1041, 1118-1290, 1425-1465, 1727-1897)
- `backend/app/services/harness/phase_types.py` (410-740, 1165-1190; function map)
- `backend/app/services/harness/grounding.py` (1-140; function map)
- `backend/app/services/ask_user_service.py` (complete, 297 lines)
- `backend/app/api/workflows.py` (335-420, 560-930)
- `backend/app/services/task_service.py` (700-775, 915-945)
- `backend/app/services/openai_service.py` (1173-1203)
- `backend/app/db/workflows.py` (331-360)
- `backend/app/services/tool_dispatcher.py` (3555-3585, 4014-4041)
- `frontend/src/components/workflows/PhaseFormPanel.tsx` (1-140, 617-657, 1020-1045)
- `frontend/src/components/workflows/PhaseNodeCard.tsx` (25-95, 180-240, 275-335)
- `frontend/src/components/workflows/WorkflowCanvas.tsx` (270-330, 495-512, 605-640)
- `frontend/src/components/workflows/canvasModel.ts` (54-160, 214-260, 355-422)
- `frontend/src/components/workflows/phaseVocabulary.ts` (60-80, 190-238)
- `frontend/src/components/workflows/WorkflowCanvas.test.tsx` (225-310)
- `frontend/src/pages/WorkflowBuilderPage.tsx` (285-340)
- `frontend/src/hooks/useGroundingBundle.ts` (1-90), `useLiveValidation.ts` (function map)
- `scripts/vitest-count-gate.cjs` (1-95)

### Design locks (operator-approved — constraints, not options)

- `.claude/skills/sketch-findings-agentic-rag/references/graded-governance.md` (20-145) — the one-way lock
  table, `KB_TOOLS`, the lobotomy-not-loophole refusal copy, the seal-is-load-bearing rule, the binding
  vocabulary table, the dial/seal/refusal CSS
- `.planning/sketches/147-the-armed-mark/README.md` (complete) + `index.html` (455-545) — the detour
  geometry, the occupancy audit, panel-owns-arming
- `.planning/phases/185-.../185-SPEC.md`, `185-CONTEXT.md`
- `.planning/ROADMAP.md` (235-255, 365-378), `.planning/REQUIREMENTS.md` §GOVERN, `CLAUDE.md`

### Not consulted

No WebSearch / WebFetch / Context7 was used. Every question in scope was answerable from the tree, per the
phase constraint "prefer reading the codebase over the web". The one web-shaped question (per-provider
tool-call behaviour, L-3) is deferred to UAT under the provider-docs-first rule, where measured evidence
beats documentation.

---

## Metadata

**Confidence breakdown:**
- Backend attachment seam + gate mechanics: **HIGH** — every line read; the seam is one line and has a
  shipped precedent (`graft_skill_snapshots`)
- ask_user substrate (indefinite wait, multi-worker, event-loop safety): **HIGH** — full module read; only
  A1 (the `timeout=None` pass-through) is untested-in-repo
- Restart / resume behaviour: **HIGH** — the `_is_llm_human_input` gap is read directly from `:1778` + `:1866-1880`
- Frontend mount points: **HIGH** — all types quoted verbatim from source
- The `edgeTypes` drift (LC-1): **HIGH** — a single-hit grep over the whole `frontend/src`
- The verdict-mark overlap (LC-2): **MEDIUM-HIGH** — geometry computed from the shipped Tailwind classes and
  `CANVAS_LAYOUT`; depends on A4 (bounding-box vs circle-aware zone check)
- Cross-provider divergence (L-3): **MEDIUM** — the *mechanism* is verified (citations are tool-built, and
  `apply_tool_budget` never drops a whitelisted tool); the *ranking* of Google as highest-risk is inferred

**Research date:** 2026-07-29
**Valid until:** 2026-08-28 (30 days — the tree is stable between phases; re-verify line numbers if any
`184.x` or `185` wave lands first)
