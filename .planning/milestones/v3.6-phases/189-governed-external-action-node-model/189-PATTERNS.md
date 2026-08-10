# Phase 189: Governed External-Action Node Model — Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 35 (2 new source · 1 new migration · 4 new test files · 1 new doc · 27 modified)
**Analogs found:** 33 / 35 with a shipped precedent · 2 with none (flagged)

**Every `file:NNN` below was re-derived on the working tree on 2026-08-07.** Where RESEARCH or
CONTEXT gave a pointer that moved, the correction is stated in-line and collected in
§ "Pointer corrections". Every excerpt is copied source, not paraphrase.

---

## The three most load-bearing analogs

If an executor reads only three things before writing code, read these:

1. **`render_template` in `phase_types.py:279-327`** — the shipped proof that a name can ride
   `available_tools` for the WHITELIST while being invisible to the model. This is D-22's entire
   argument, already written in this codebase's own words. Copy the *shape*, not the schema.
2. **`GovernanceSection.tsx` + its ONE-LINE mount at `PhaseFormPanel.tsx:1046-1048`** — the
   G-5-honouring precedent. 185 added a whole governance feature to a 1095-line panel for three
   lines of JSX. `ExternalActionSection.tsx` gets exactly this treatment.
3. **`harness_engine.py:1605-1632`** — 101.1's sentinel-key branch. The executor signals a
   non-`completed` terminal by putting a key on its ordinary output dict; the engine branches on
   that key to pick the status write, **inside** the `if/else` that already falls through to
   `advance_current_phase`. D-05's "the run CONTINUES" is satisfied by PLACEMENT, not by new
   control flow.

---

## File Classification

### Backend

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/models/harness.py` | model (schema contract) | request-response | `LlmEmitPhaseConfig` `:128-160` (same file) | **exact** |
| `backend/app/services/harness/phase_types.py` | service (executor + registry) | transform | `_exec_programmatic` `:433-463` · `_exec_llm_single` `:466-489` · `PHASE_TYPE_REGISTRY_ENTRIES` `:1658-1666` | **exact** |
| `backend/app/services/harness/grounding.py` | service (governance rule home) | transform | `KB_TOOLS` / `KB_TOOLS_SORTED` `:797-803` | **exact** |
| `backend/app/services/harness/publish_service.py` | service (gate) | request-response | `_interactive_phase_failures` `:500-540` | role-match ⚠ |
| `backend/app/services/harness_engine.py` | service (orchestrator) | event-driven | the `_emit_failure` branch `:1605-1632` | **exact** |
| `backend/app/services/workflow_authoring.py` | service (prompt assembly) | request-response | itself `:62-70` | **exact** |
| `backend/app/db/workflows.py` | data access | CRUD | `complete_phase` `:970-982` | **exact** |
| `backend/app/api/workflow_runs.py` | route (wire schema) | request-response | prose only — the wire is `str` | n/a |

### Migration

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/115_workflow_phases_recorded_not_sent.sql` | migration | schema | `114_harness_audit_action_risk_pending.sql` (whole file) | **exact** |
| `supabase/full-schema.sql` | build artifact | — | regenerated, **never hand-edited** | n/a |

### Frontend — derivation layer

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `frontend/src/types/index.ts` | model (types) | — | `Phase["status"]` union `:1020` | **exact** |
| `frontend/src/lib/phaseState.ts` | utility (derivation) | transform | `DB_PHASE_STATUS` `:41-47` + `canvasReading` `:122-140` (same file) | **exact** |
| `frontend/src/lib/phaseGlyph.tsx` | utility (resolver) | transform | itself `:42-67` + the same-commit rule `:33-36` | **exact** |

### Frontend — vocabulary layer

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `frontend/src/components/workflows/runVocabulary.ts` | utility (canvas vocabulary) | transform | `RUN_READING_WORD` `:61-69` · `STATIC_CLAUSE` `:170-178` · `RING_GEOMETRY` `:313-333` | **exact** (×2) / **none** (×1 — the 8th shape) |
| `frontend/src/components/workflows/phaseVocabulary.ts` | utility (node vocabulary) | transform | `derivedFace` `:516-580` + the three maps `:152-183` | **exact** |
| `frontend/src/components/workflows/soulData.ts` | config data | — | `PHASE_GLYPHS` `:43-50` | **exact** |
| `frontend/src/components/workflows/nodePresentation.ts` | config data | — | `ICON_TINT` `:83-90` | **exact** |
| `frontend/src/components/workflows/definitionOps.ts` | utility (closed set + ops) | transform | `PhaseTypeId` `:63-69` · `PHASE_TYPE_ORDER` `:76-83` · `SLUG_BASE` `:828-835` · `requiredConfigFor` `:871-891` | **exact** |

### Frontend — surfaces

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `frontend/src/components/workflows/canvasModel.ts` | utility (projection) | transform | `isArmed` `:260-262` + `buildPhaseData` `:285-302` | **exact** |
| `frontend/src/components/workflows/PhaseNode.tsx` | component (adapter) | — | the badge tuple `:214-220` | **exact** |
| `frontend/src/components/workflows/NodeRunOverlay.tsx` | component | — | `RING_STROKE` `:134-142` | **exact** |
| `frontend/src/components/panel/PhaseCard.tsx` | component (dev panel) | — | `STATUS_META.unknown` `:101-111` | **exact** |
| `frontend/src/components/panel/PhaseTimeline.tsx` | component (a11y announcer) | — | `milestoneFor` switch `:60-74` | role-match |
| `frontend/src/components/workflows/GovernanceSection.tsx` | component (form section) | — | itself — `DIAL_TYPES` `:90` | **exact** |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | component (panel shell) | — | the GovernanceSection mount `:1046-1048` | **exact** |
| **`frontend/src/components/workflows/ExternalActionSection.tsx`** *(NEW)* | component (form section) | — | **`GovernanceSection.tsx` (whole file, 321 L)** | **exact** |

### Tests, gates and docs

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/tests/unit/test_189_external_action_model.py` *(NEW)* | test (unit) | — | `tests/unit/test_harness_models.py` | role-match |
| `backend/tests/unit/test_189_no_egress.py` *(NEW)* | test (source fence) | — | `PhaseNodeCard.test.tsx:100-113` (the `?raw` idiom) | **cross-language adaptation** |
| `backend/tests/test_migration_115.py` *(NEW)* | test (live-DB integration) | CRUD | **`backend/tests/test_139_migration_090.py`** | **exact** |
| `frontend/.../ExternalActionSection.test.tsx` *(NEW)* | test (component) | — | `GovernanceSection.test.tsx` | **exact** |
| `frontend/src/components/workflows/PhaseNodeCard.test.tsx` | test (rewrite T1) | — | `:2146-2159` (the slot-1 guard) | **exact** |
| `frontend/src/components/workflows/WorkflowCanvas.test.tsx` | test (rewrite T2) | — | `:422-423` | **exact** |
| `scripts/vitest-count-gate.cjs` | config (gate) | — | `TARGETS` `:527` / `BASELINE` `:122` | **exact** |
| **`docs/CONNECTOR-ARCHITECTURE.md`** *(NEW)* | documentation | — | **`docs/SANDBOX-PACKAGES.md`** | **exact** |
| `.planning/prd-reset/DECISIONS.md` | documentation (register) | — | **`D-v3.4-01` at `:1400-1409`** | **exact** |
| `CLAUDE.md` | documentation (pointer) | — | the `SANDBOX-PACKAGES.md` pointer line | **exact** |
| `.planning/ROADMAP.md` | documentation | — | prose correction (113 → 114) | n/a |

---

## Pattern Assignments

### 1 · `backend/app/models/harness.py` (model, request-response)

**Analog:** `LlmEmitPhaseConfig` — the 6th member, added at 101.1, in the SAME FILE.

**The additive-growth contract** (`harness.py:10-21`, verbatim — this is the mechanism, quoted
in the module docblock, not a comment on it):

```python
The two Literal sets GROW ADDITIVELY, and always have. ``phase_type`` went 5 -> 6
at Phase 101.1 (the ``llm_emit`` member); the validator ``kind`` set went 4 -> 9 at
Phase 102 (GATE-01 / D-12) and 9 -> 10 at Phase 185 (GOVERN-03 —
``action_risk_approval``). Growth is SAFE because every value a stored JSONB row
can already carry still validates: an old row never names the new member, and an
unrecognized kind fails CLOSED downstream in ``run_gates``. What must NOT change is
an EXISTING member's spelling — renaming one orphans every stored row that uses it
— nor the mechanism around them: the discriminator, ``extra='forbid'`` and the
union structure remain LOCKED.
```

**The member docblock to copy** (`harness.py:128-160` — note it calls itself *the standard
extension*; `ExternalActionPhaseConfig`'s docblock should make the same claim for the 7th):

```python
class LlmEmitPhaseConfig(_StrictBase):
    """Phase 101.1 (D-04) — the 6th phase type: a SEALED FORCED EMIT.

    ...

    Additive-optional / ZERO-MIGRATION: appended to the ``PhaseConfig`` union as the
    6th discriminated member (the standard extension — the 5 existing members were added
    this way). ``_StrictBase`` rejects unknown keys (T-101.1-01-01); old JSONB phase rows
    without ``llm_emit`` still ``model_validate()``. The optional shape-symmetry fields
    mirror the other LLM members so the family stays uniform.
    """

    phase_type: Literal["llm_emit"]
    prompt: str
    emitter: str = "render_template"  # the EMITTER_REGISTRY key (closed-dict resolved)
```

**The union to append to** (`harness.py:162-172`):

```python
PhaseConfig = Annotated[
    Union[
        ProgrammaticPhaseConfig,
        LlmSinglePhaseConfig,
        LlmAgentPhaseConfig,
        LlmBatchAgentsPhaseConfig,
        LlmHumanInputPhaseConfig,
        LlmEmitPhaseConfig,
    ],
    Field(discriminator="phase_type"),
]
```

**The `model_validator(mode="after")` pattern for D-04** — `WorkflowDefinition` already carries
two, both STRUCTURAL-ONLY, both iterating `self.phases` (`harness.py:321-333`):

```python
    @model_validator(mode="after")
    def _folder_scope_requires_project(self) -> "WorkflowDefinition":
        # D-07 STRUCTURAL half only: a per-phase folder_scope needs a project_folder_id
        # to be a subset of. The DB-aware ⊆ check (against the real folder subtree)
        # lives in Plan 03's scope.py — do NOT add DB logic here.
        for phase in self.phases:
            scope = getattr(phase.config, "folder_scope", None)
            if scope and self.project_folder_id is None:
                raise ValueError(
                    f"phase '{phase.slug}' declares folder_scope but the workflow has no "
                    f"project_folder_id for it to be a subset of"
                )
        return self
```

⚠ **Both shipped validators RAISE.** RESEARCH §A4 recommends the 189 one **COERCE** instead
(fail-closed, never bricks a stored row). That is a deliberate departure from the analog and the
plan owes it a sentence in the docblock — copying the shape but inverting the disposition is
exactly the kind of silent divergence a reviewer cannot see.

**`action_risk_armed` — the field the coercion pins** (`harness.py:235`, on `PhaseSpec`, shared by
ALL types, which is why `Literal[True]` cannot work):

```python
    action_risk_armed: bool = False     # GOVERN-03 / D-185-08 — stop and ask a human before this step runs
```

**The precedent for a structural-not-representable governance property** — `PhaseSpec`'s own
docblock at `:221-227`, which is the argument D-04 reuses verbatim:

```
#     Both are DERIVED at read time from data already in the row and are NEVER stored
#     — which is what makes SPEC Req 3 true BY CONSTRUCTION rather than by a code
#     audit: "a detected step set back to free-to-think" is not a representable value,
#     so a stale or hand-edited JSONB row cannot lie about it.
```

⚠ **`slug: str` at `:202` is unconstrained** — no pattern, no enum, no reserved-word list. Any
slug-keyed lookup 189 adds must be `own()`-guarded (see Shared Pattern C).

---

### 2 · `backend/app/services/harness/phase_types.py` (service/executor, transform)

**Analog A — the closed-registry raise: `_exec_programmatic` (`:433-463`).** This is the one
executor that resolves a name against a closed registry and raises; it is D-02 already written:

```python
async def _exec_programmatic(phase, accumulated_outputs: dict, ctx) -> dict:
    """Run a server-controlled pure-Python fn resolved against the closed registry.

    The ``fn`` is looked up in PROGRAMMATIC_PHASE_REGISTRY (closed dict — an unknown
    name raises, never eval'd: T-091-12). ...
    """
    fn_name = phase.config.fn
    fn = PROGRAMMATIC_PHASE_REGISTRY.get(fn_name)
    if fn is None:
        raise KeyError(
            f"programmatic phase {phase.slug!r}: fn {fn_name!r} is not registered "
            f"in PROGRAMMATIC_PHASE_REGISTRY (closed dict — register it explicitly)"
        )
```

⚠ **Pointer correction:** RESEARCH quotes this at `:441-446`. Measured: `fn_name` at `:442`,
`fn = ...get()` at `:443`, the `raise KeyError(` at `:445`, closing at `:448`.

**Analog B — the smallest executor: `_exec_llm_single` (`:466-489`).** The signature and return
shape a 7th executor copies:

```python
async def _exec_llm_single(phase, accumulated_outputs: dict, ctx) -> dict:
    """One bounded LLM call — no tools. The phase prompt is the system framing.
    ...
    """
    ...
    return {"text": content or ""}
```

⇒ **`async def _exec_external_action(phase, accumulated_outputs: dict, ctx) -> dict`**, returning
`{"text": <the not-sent block>, "recorded_intent": {...}}`. Every executor returns a plain `dict`
and every output carries `text` by convention — `_latest_phase_text` (`:1641-1651`) scans for it:

```python
def _latest_phase_text(accumulated_outputs: dict) -> str:
    """... every phase executor returns ``{"text": <answer>}``, so the
    latest non-empty ``text`` is the prior phase's output ..."""
    for out in reversed(list(accumulated_outputs.values())):
        if isinstance(out, dict) and isinstance(out.get("text"), str) and out["text"].strip():
            return out["text"]
    return ""
```

**Analog C — the registry line (`:1654-1666`).** Note the comment convention: the 6th carries its
phase number inline. The 7th should read `# 189 — the 7th (the governed external action, D-01):`

```python
# ── registration ──────────────────────────────────────────────────────────
# The 6 executors keyed by phase_type — the engine's PHASE_TYPE_REGISTRY dispatch
# seam (Plan 02) resolves each of these. 101.1 (D-04) adds the 6th: ``llm_emit`` (the
# SEALED FORCED EMIT — the only path that produces a typed deliverable).
PHASE_TYPE_REGISTRY_ENTRIES: dict = {
    "programmatic": _exec_programmatic,
    "llm_single": _exec_llm_single,
    "llm_agent": _exec_llm_agent,
    "llm_batch_agents": _exec_llm_batch_agents,
    "llm_human_input": _exec_llm_human_input,
    # 101.1 — the 6th (the forced-emit phase, D-04):
    "llm_emit": _exec_llm_emit,
}
```

**Analog D — ⭐ THE D-22 PRECEDENT: `render_template`.** `_effective_tools` is at **`:279`**
(RESEARCH's `:296-320` points into the middle of its docblock). The two-layer paragraph at
`:299-314`, verbatim — this is the single most important excerpt in the phase:

```python
      - **Layer 1 — the SCHEMAS the model actually sees** are NOT the names on
        ``ToolContext.available_tools``; they are the function-schemas in the
        ``tools_override`` list built by ``apply_tool_budget(<candidates>, model,
        whitelist)``. ``apply_tool_budget`` can only FILTER schemas it is GIVEN — a
        whitelisted NAME with no SCHEMA in the candidate list is a no-op. The base
        candidate list is ``get_tools(user_settings)``, which has NO render_template
        schema (Deep stays byte-identical — that schema is NEVER added to
        ``get_tools()``). ...
      - **Layer 2 — the DISPATCH backstop** is ``ToolContext.available_tools`` /
        ``phase_whitelist=frozenset(_tools)`` (consumed by
        ``tool_dispatcher.dispatch_tool``): it refuses a hallucinated tool NAME at
        dispatch time. It does NOT control which schemas the model sees.
```

⇒ **The 189 shape is `render_template` MINUS layer 1.** `render_template` opts INTO layer 1 via
`_phase_tools_override` (`:330-347`, which appends `RENDER_TEMPLATE_TOOL` when whitelisted). The
three capabilities do **not** — they never gain a schema, so they exist for layer 2 (the whitelist
declaration) and the executor alone. **No `_TOOL_REGISTRY` entry, no `get_tools()` schema, no
`*_TOOL` constant in 189.** All three are 190's.

**Layer-2 enforcement point** (`_build_phase_tool_context:400-429`) — the field the plan should
name, not just `resolve_phase_available_tools`:

```python
        # D-05 layer 2 — the dispatch-time backstop for hallucinated tool names.
        phase_whitelist=frozenset(_tools),
```

---

### 3 · `backend/app/services/harness/grounding.py` (service, transform)

**Analog: `KB_TOOLS` / `KB_TOOLS_SORTED` (`:786-803`).** D-20's `EXTERNAL_ACTION_CAPABILITIES`
sits BESIDE this, in this shape, with a header block making the same one-home argument:

```python
# ── Phase 185 (GOVERN-01 / D-185-09) — the KB-reading rule ────────────────────
#
# THE ONE HOME, and the reason it is here rather than in the canvas: this list DEFINES
# which steps are governed, so a second copy is a safety hole, not a duplication smell.
# The day a 6th KB tool lands, a frontend constant would silently stop marking it and the
# author would see an ungoverned step that the engine gates anyway. That is the exact drift
# D-182-06's RED LINE (see this module's docblock) was written against. The client receives
# this list as DATA on ``GET /workflows/grounding-bundle`` and performs only the trivial set
# intersection, for zero-lag display; it never enforces.


KB_TOOLS: frozenset[str] = frozenset({
    "search_documents", "query_documents", "read_document",
    "analyze_document", "get_related_documents",
})
# The wire/JSON form, mirroring how ``GroundingBundle`` already carries ``tools: list[str]``
# (JSON-friendly, sorted) beside ``tool_names: set[str]`` (membership) for the same values.
KB_TOOLS_SORTED: list[str] = sorted(KB_TOOLS)
```

⚠ **Copy the CONSTANT, not the wire half.** `KB_TOOLS_SORTED` exists because the client receives
KB_TOOLS as data. D-20 says the opposite for capabilities: **they stay off the wire.** An
`EXTERNAL_ACTION_CAPABILITIES_SORTED` would be the first step toward the leak the decision exists
to prevent.

**The disjointness rule to verify against (`:832`):**

```python
    if set(getattr(phase.config, "available_tools", None) or ()) & KB_TOOLS:
        return "detected"
```

Measured disjoint: `send_email`, `create_ticket`, `post_message` ∉ `KB_TOOLS` ✅ — so
`grounding_cause` returns `None` and an `external_action` step is *free to think*, carrying **no
⛨ seal**. That is correct, not a bug.

**The union point for Conflict 2 (`:388`), and the prose it falsifies (`:426-428`, `:446-447`):**

```python
    tool_names = {t["function"]["name"] for t in get_tools(None)}
```

```python
    return GroundingBundle(
        tools=sorted(tool_names),
        tool_names=tool_names,
```

```python
    ``", ".join(bundle.tools)`` is exactly the old ``", ".join(sorted(tool_names))``
    (``tools == sorted(tool_names)`` by construction).
```

⚠ **That last sentence becomes FALSE the moment `tool_names` is widened and `tools` is not.**
`grounding.py:446-447` must be corrected IN THE SAME COMMIT, with the reason recorded — otherwise
189 ships a docblock that lies about a governance boundary.

**The rule that blocks publish today (`:643-651`):**

```python
def _unregistered_tools(phase, tool_names: set[str]) -> list[str]:
    """Rule 2 — the ``available_tools`` entries of one phase that are NOT in the registry
    (order-preserving, so the short-circuit presentation reports the same first offender
    the pre-extraction code did)."""
    return [
        tool
        for tool in (getattr(phase.config, "available_tools", None) or [])
        if tool not in tool_names
    ]
```

---

### 4 · `backend/app/services/harness/publish_service.py` (service/gate, request-response)

**Analog: `_interactive_phase_failures` (`:500-540`)** — the pre-run block, and the *reason*
Conflict 1 exists. Note it names exactly two shapes and the armed checkpoint is neither:

```python
def _interactive_phase_failures(definition) -> list:
    """Named failures for any INTERACTIVE phase blocking the synchronous publish (WR-04).
    ...
      - an ``llm_human_input`` phase (``config.phase_type == "llm_human_input"``), or
      - any validator whose ``on_failure == "ask_user"`` (the D-11 interactive
        disposition — it pauses the run waiting for a human to choose).
    ...
    """
    failures: list = []
    for phase in getattr(definition, "phases", []) or []:
        slug = getattr(phase, "slug", None)
        config = getattr(phase, "config", None)
        if getattr(config, "phase_type", None) == "llm_human_input":
```

⚠ **THIS IS A BAD ANALOG TO EXTEND, and D-19 says so.** Adding `external_action` here is
Conflict-1 Option B, which contradicts D-06 outright. It is excerpted so the executor can
RECOGNISE it and NOT copy it.

**The pattern to copy instead — `is_golden_run` as a keyword-only, default-False thread.**
Measured: `is_golden_run` appears in `db/workflows.py:150,180,182,194,203,262` and
`publish_service.py:14,244,802,811`, and **in `harness_engine.py` ZERO times** — confirming D-19's
"it exists as a column but is NOT threaded into ctx; that threading is the work."

```python
# Source: backend/app/db/workflows.py:150  (the keyword-only, default-off precedent)
    is_golden_run: bool = False,
```

```python
# Source: backend/app/db/workflows.py:262
    ``is_golden_run=False`` keyword-only precedent: default OFF = byte-identical.
```

**Follow that spelling exactly:** keyword-only, `bool = False`, so every non-golden call site is
byte-identical. That is the same additive discipline `harness.py:10-21` states for the union.

**The armed checkpoint the golden run hits (`harness_engine.py:754`):**

```python
    if getattr(phase, "action_risk_armed", False):
```

**The indefinite wait (`harness_engine.py:1104`):**

```python
    timeout_seconds = None if is_action_risk else min(
```

---

### 5 · `backend/app/services/harness_engine.py` (service/orchestrator, event-driven)

**Analog: the `_emit_failure` sentinel branch (`:1604-1632`), verbatim.** 189 adds a THIRD branch
in this exact `if/else`:

```python
        # ── completed: persist output (2-phase write step 2), advance ──────────
        output = outcome.output
        durable_output = _persist_output(output)
        # Phase 101.1-07 (gap 1 — the "phase stuck active" half): a GRACEFUL emit
        # failure (an honest state a-e return from _exec_llm_emit, or the layer-6
        # catch-all) comes back as a NORMAL phase output carrying a ``failure`` key —
        # the run would otherwise "complete" and the active phase would never flip.
        # Flip THIS phase to ``failed`` (reusing the existing fail_phase write — no new
        # schema) so workflow_phases never strands in active/completed while the
        # deliverable was never produced. Additive + harness-only: a Deep success output
        # has no ``failure`` key, so this is a literal no-op on the shared path.
        _emit_failure = output.get("failure") if isinstance(output, dict) else None
        if _emit_failure:
            await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
        else:
            await complete_phase(pool, phase_id, durable_output)
        accumulated_outputs[phase.slug] = output
        last_output = output
        ...
        # 4. Advance current_phase + audit/emit the transition.
        next_phase_id = ordered[i + 1]["id"] if i + 1 < len(ordered) else None
        await advance_current_phase(pool, run_id, next_phase_id)
```

**Three properties the 189 branch inherits by placement, all measurable:**

1. **The run CONTINUES for free.** `advance_current_phase` at `:1632` is unconditional within this
   block; the `fail_run` / `skip_to` branches (`:1533`, `:1561`) `return`/`continue` *before*
   reaching it. A third `elif` inside the same `if/else` cannot accidentally halt the run.
2. **The comment shape is load-bearing.** The 101.1 comment states WHY the sentinel exists, WHAT
   would go wrong without it, and that it is a **literal no-op on the shared path**. The 189
   comment owes the same three things — the D-14 red line (Deep stays byte-identical) is exactly
   this claim.
3. **The audit follow-through is conditional too** (`:1633-1640`): `if _emit_failure:` suppresses
   the `phase_completed` receipt. **189 must decide the same question explicitly** — a
   `recorded_not_sent` phase writing `phase_completed` would be the `consequence ≠ receipt`
   violation D-09 and the Control-Room rule both forbid.

---

### 6 · `backend/app/db/workflows.py` (data access, CRUD)

**Analog: `complete_phase`.** ⚠ **Pointer correction:** RESEARCH cites `:975`; measured
`async def complete_phase` is at **`:970`** (`:975` is inside its docstring; the SQL is `:978-982`).

```python
async def complete_phase(pool: asyncpg.Pool, phase_id: UUID, output: dict) -> None:
    """Flip to ``completed`` AND write ``output`` in ONE atomic UPDATE.

    Called ONLY after the output is durable. The status flip and the output
    write are a single statement (never two) so a crash between them is
    impossible — the resumability invariant (HARNESS-03).
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps(output),
    )
```

**The three siblings, for the section shape** (`mark_phase_active:959` · `fail_phase:985` ·
`skip_phase:1007`, all under the banner `# ── workflow_phases writes (PHASE-KEYED → id) ──` at
`:958`). Every one is a single `pool.execute`, every docstring ends with the same
`PHASE-KEYED write → WHERE id=$1` line. **Copy that convention literally** — it is how the file
signals which key a write is on.

⇒ `record_phase_not_sent(pool, phase_id, output)` → `SET status='recorded_not_sent',
output=$2::jsonb, updated_at=now()`, placed as the 5th in this run, with the atomicity sentence
carried over (the resumability invariant applies identically).

⚠ **Do NOT copy `fail_phase`'s payload merge** (`payload = {**(output or {}), "_failure_reason":
reason}`). `recorded_not_sent` is not a failure and owes no `_failure_reason` key — the status-repair
scripts read that key.

---

### 7 · `supabase/migrations/115_workflow_phases_recorded_not_sent.sql` (NEW, migration)

**Analog: `114_harness_audit_action_risk_pending.sql` — excerpted VERBATIM, whole file.**
Measured: 114 is the live head (`ls supabase/migrations/ | tail` → `114_...` last), so 115 is free.

```sql
-- 114_harness_audit_action_risk_pending.sql
-- Phase 185 (GOVERN-03 / BUG-260731-02) — extend the harness_audit event_type CHECK
-- with the ONE armed-action-risk-pause kind: 'action_risk_pending'.
--
-- WHY: an armed action-risk checkpoint does not park — it KILLS the run. Measured on
-- workflow_runs.id = 80c8823d (definition sc10-armed-f77e72, gpt-5.5): `retrieve`
-- completed, `emit` reached its timing:"pre" approval gate, and the run then died with
--   ValueError: write_audit event_type must be one of the 22 harness_audit kinds
--   (059 + 069 + 070), got 'action_risk_pending'
-- leaving a phase permanently `active` under a run marked `failed`, and nobody asked.
-- Plan 185-05 introduced the kind FOR HONESTY (harness_engine.py:697-711 — announcing
-- `gate_failed` on an armed pause would tell the ledger something went wrong when
-- nothing did), but never registered the new word at either layer that admits an audit
-- kind. Registering the Python allow-list alone would only move the failure from a
-- ValueError to a Postgres 23514 mid-run — hence this migration.
--
-- ALTER (NOT CREATE — harness_audit exists since 059; the CHECK was last widened by
-- 070). Adds exactly ONE literal (22 → 23) and changes nothing else: no table, no
-- column, no index, no grant. Does NOT touch the INSERT-only RLS on harness_audit, so
-- the receipt immutability guarantee holds. The closed-vocabulary property the CHECK
-- exists for is preserved — this widens it by one REVIEWED literal, and the Python set
-- is pinned equal to this list by backend/tests/unit/test_audit_event_registration.py.
--
-- Apply by pasting into the Supabase SQL editor (or psycopg2 to local :54322 per the
-- 100/099/101.1 precedent) — NEVER `supabase db push` / `db reset` (preserves dev
-- data); then `bash scripts/regenerate-full-schema.sh` (no reset), commit both.
-- Task 3 [BLOCKING] (operator, autonomous:false) applies it + regenerates full-schema.
-- This plan ONLY AUTHORS the file — it is NOT applied here.
--
-- NOTE (T-185-13-03): DROP+ADD CONSTRAINT takes a brief ACCESS EXCLUSIVE lock on
-- harness_audit. Immaterial on local dev; on cloud this belongs in the standing
-- migration-parity window (migs 099→114 land together), not mid-traffic.

ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
        'phase_started','phase_completed','phase_transition',
        ...
        -- 185 (GOVERN-03 / BUG-260731-02) — the armed action-risk pause:
        'action_risk_pending'
    )
);
```

**The header carries eight load-bearing elements, all of which 115 owes:** (1) the WHY with
measured evidence · (2) ALTER-not-CREATE · (3) "adds exactly ONE literal and changes nothing else"
· (4) the does-NOT-touch-RLS line · (5) the paste-into-SQL-editor instruction · (6) the
`regenerate-full-schema.sh` follow-through · (7) "this plan ONLY AUTHORS the file" · (8) the
ACCESS EXCLUSIVE lock note for the cloud parity window.

**Two deliberate DEPARTURES from the analog:**

- ⚠ **Use `= ANY (ARRAY[…])`, not `IN (…)`.** 114 used `IN`; the shipped `workflow_phases`
  constraint uses `= ANY (ARRAY[…])` (`full-schema.sql:1932`, re-verified — still 5 values, still
  that line). Matching the live shape keeps the regeneration diff to one line.
- ⚠ **There is NO Python literal set to pin.** 114's header points at
  `test_audit_event_registration.py`; `workflow_phases.status` has no Python enum — the statuses
  are string literals inside four `UPDATE`s. 115's header must NOT claim a pin that does not exist.

⚠ **D-17 trap, restated at the point of writing:** the constraint takes `'recorded_not_sent'`.
A plan that puts `'Not sent — recorded'` in the CHECK has misread the decision.

**Test analog: `backend/tests/test_139_migration_090.py`** — the live-DB constraint gate, and the
right model for `test_migration_115.py`:

```python
"""Phase 139 Plan 03 (SI-02) — LIVE-DB gate for the kind-discriminated skill_proposals
extension defined in supabase/migrations/090_skill_proposals_description_kind.sql.
...
Those are DB-level integrity gates below the route validation — the only honest proof is
exercising the REAL constraint against the REAL local DB (a mock store cannot reproduce a
CHECK firing or the relaxed NOT NULL). This file is therefore the live-DB gate.

All DB writes occur INSIDE a transaction that ROLLS BACK (no dev-data mutation). ...
The ONLY clean skips are when :54322 is unreachable (no live DB to gate) OR migration 090
is unapplied ... The test is EXPECTED to green-skip until Plan 139-03 Task 2 applies 090 to
the live DB; once applied it MUST PASS.
"""

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)
```

**Copy all four properties:** rollback-only writes · nested savepoints for the rejection branch ·
the two named clean-skip conditions · the "green-skip until applied, MUST PASS after" contract.
That contract is what lets Wave 3's authoring half land before the operator's apply.

---

### 8 · `frontend/src/lib/phaseState.ts` (utility/derivation, transform)

**Analog: the file itself — it is the ONE derivation home** (`:12-20`: *"this module holds the
DERIVATION, never the VOCABULARY. Two vocabularies are correct here… Two DERIVATIONS are not"*).

```ts
export const DB_PHASE_STATUS: Record<string, Phase["status"]> = {
  pending: "pending",
  active: "running",
  completed: "done",
  failed: "failed",
  skipped: "skipped",
}
```
*(`:41-47`. Its docblock at `:36-39` says the five keys are **exactly**
`workflow_phases_status_check` — that sentence is falsified by migration 115 and owes a same-commit
correction.)*

```ts
export function phaseStatusFromDb(raw: string): Phase["status"] {
  if (!Object.prototype.hasOwnProperty.call(DB_PHASE_STATUS, raw)) return "unknown"
  return DB_PHASE_STATUS[raw]
}
```
*(`:76-79` — total, own-guarded. **No change needed**: it reads the map.)*

```ts
export type CanvasReading =
  | "not-started"
  | "running"
  | "done"
  | "failed"
  | "skipped"
  | "waiting-for-you"
  | "unknown"
```
*(`:87-94` — the union whose widening FORCES four downstream tables.)*

```ts
export function canvasReading(phase: Phase | undefined): CanvasReading {
  if (!phase) return "not-started"
  if (phase.pendingAsk != null) return "waiting-for-you"
  switch (phase.status) {
    case "pending":
      return "not-started"
    ...
    default:
      return "unknown"
  }
}
```
*(`:122-140` — the switch arm 189 adds. The `default:` is the fail-closed floor and stays.)*

**✅ The fail-closed baseline, which is a genuine wave-ordering freedom:** before any vocabulary
lands, `phaseStatusFromDb("recorded_not_sent")` → `"unknown"` → `RUN_READING_WORD.unknown` =
`"State unknown"`. Never `"Complete"`. **The migration can ship before the words without lying.**

---

### 9 · `frontend/src/components/workflows/runVocabulary.ts` (utility/vocabulary, transform)

**Analog A — `RUN_READING_WORD` (`:61-69`), the D-16 home:**

```ts
export const RUN_READING_WORD: Record<CanvasReading, string> = {
  "not-started": "Not started",
  running: "Running",
  done: "Complete",
  failed: "Failed",
  skipped: "Skipped",
  "waiting-for-you": "Paused for your answer",
  unknown: "State unknown",
}
```

✅ **"Not sent — recorded" collides with none of the seven**, and specifically not with `Running`
or the waiting reading (D-07's binding constraint). ⚠ It shares a PREFIX with `"Not started"` —
a test asserting `.toContain("Not")` becomes ambiguous. Prefer exact-match assertions.

⚠ **The docblock at `:56-59` states a fence discipline the 189 entry inherits:** the badge's own
words are deliberately NOT quoted in this file because an acceptance grep asserts their absence,
*"a docblock that spelled them would make that check vacuous, which is the 187-24 lesson."*
**D-18's "Not connected" must therefore NOT be written into `runVocabulary.ts` prose either.**

**Analog B — the exhaustive-`Record` pattern, stated in the source (`:159-178`):**

```ts
/**
 * The clause for every reading whose clause is FIXED. Declared as an exhaustive
 * `Record<CanvasReading, …>` rather than as a switch with a `default:` arm, and that is
 * deliberate: an eighth reading added to `CanvasReading` later becomes a TYPECHECK
 * ERROR here, where a `default:` would have silently absorbed it as "no clause". The
 * compiler is the reminder, not a comment.
 * ...
 */
const STATIC_CLAUSE: Record<CanvasReading, string | null> = {
  "not-started": null,
  running: null,
  done: null,
  failed: null,
  skipped: CLAUSE_SKIPPED,
  "waiting-for-you": CLAUSE_WAITING,
  unknown: CLAUSE_UNKNOWN,
}
```

**189 is literally the "eighth reading … later" this sentence was written for.** Four tables fire:
`STATIC_CLAUSE` `:170` · `RING_GEOMETRY` `:313` · `RUN_READING_WORD` `:61` · `NodeRunOverlay.RING_STROKE` `:134`.

**Analog C — ⚠ `RING_GEOMETRY` (`:294-333`) IS NOT A TABLE FILL. Its docblock states a BUILD
CRITERION:**

```ts
/**
 * Seven readings, seven ring SHAPES (sketch 153-A). **The arc geometry IS the state;
 * colour only ever reinforces it.** That is a BUILD CRITERION, not a preference: with
 * colour switched off every reading must still be identifiable, and each row below is
 * unique in a property a test can assert —
 *
 *   • `not-started` — the only reading with NO arc
 *   • `running`     — the only one that moves, and statically the only SHORT single arc
 *   • `done`        — the only closed, unbroken ring
 *   • `waiting-for-you` — the only ring with ONE wide gap, at 12 o'clock ...
 *   • `failed`      — the only ring snapped into TWO arcs
 *   • `skipped`     — evenly dashed all the way round, coarse
 *   • `unknown`     — the only DOTTED ring, fine and sparse; deliberately not closed
 * ...
 */
export const RING_GEOMETRY: Record<CanvasReading, RingSpec> = {
  "not-started": { kind: "none" },
  running: { kind: "fraction", arc: { dash: 0.26, gap: 0.74, repeats: 1, gapCentre: null }, spinning: true },
  done: { kind: "solid" },
  failed: { kind: "fraction", arc: { dash: 0.42, gap: 0.08, repeats: 2, gapCentre: 0.375 }, spinning: false },
  skipped: { kind: "length", dash: 5, gap: 7 },
  "waiting-for-you": { kind: "fraction", arc: { dash: 0.74, gap: 0.26, repeats: 1, gapCentre: 0.75 }, spinning: false },
  unknown: { kind: "length", dash: 1.5, gap: 6 },
}
```

⚠ **NO ANALOG EXISTS for the 8th shape.** The occupied space is measurable: `gapCentre` `0.375`
(failed) and `0.75` (waiting) are taken; `length` ratios `5/7` (coarse) and `1.5/6` (fine) bracket
the texture axis. An 8th `length` row would be the WEAKEST distinction on the board. This is a plan
DECISION with a driven greyscale UAT row attached, not a table entry.

**Analog D — the total lookup (`:335-338`):**

```ts
/** TOTAL ring lookup — an unowned reading falls back to the unknown ring rather than to
 *  an inherited member, and never to the closed circle. */
export function ringSpecFor(reading: CanvasReading): RingSpec {
  return own(RING_GEOMETRY, reading) ?? RING_GEOMETRY.unknown
}
```

---

### 10 · `frontend/src/components/workflows/phaseVocabulary.ts` (utility/vocabulary, transform)

**Analog A — the three per-type maps (`:152-183`), all `Record<string, string>`, all silent to a
7th key:**

```ts
export const PHASE_TYPE_SENTENCES: Record<string, string> = {
  programmatic: "Prepare the inputs",
  llm_single: "Write it up",
  llm_agent: "Work out how to do it",
  llm_batch_agents: "Work on the parts together",
  llm_human_input: "Check with you",
  llm_emit: "Produce the deliverable",
}

/** The ONE supporting line 137-D allows beneath the title. */
export const PHASE_TYPE_SUBTITLES: Record<string, string> = {
  ...
  llm_emit: "Fills your template and produces the file",
}

export const PHASE_TYPE_LABELS: Record<string, string> = {
  ...
  llm_emit: "Deliverable",
}
```

Note the voice: SENTENCES are **verb-first, plain-language, business** ("Produce the deliverable");
SUBTITLES are **third-person mechanism** ("Fills your template and produces the file"); LABELS are
**terse technical nouns** ("Deliverable"). Match the register per map, not one phrase reused thrice.

**Analog B — ⭐ `derivedFace` (`:501-580`), the D-13 tier-2 ladder.** The numbered-comment form IS
the decision record; a new tier is inserted by the same most-specific-first test:

```ts
export function derivedFace(inputs: DerivedFaceInputs): string | null {
  // (1) BOUND SKILL — a bound skill states what *this* step does, so it wins over
  //     everything below. Most-specific-first is the whole argument for the
  //     precedence (D-187-04).
  if (inputs.skillName) return `Run the ${inputs.skillName}`

  // (2) TEMPLATE — gated on `llm_emit`, deliberately. ...
  if (inputs.phaseType === EMIT_PHASE_TYPE && inputs.templateFilename) {
    return `Fill ${inputs.templateFilename}`
  }

  // (3) FOLDER SCOPE — GATED on `GROUNDING_DIAL_TYPES`, and last of the three config
  //     tiers. ...
  if (inputs.folderName && GROUNDING_DIAL_TYPES.includes(inputs.phaseType)) {
    return `Search ${inputs.folderName}`
  }

  // (4) HUMAN INPUT — nothing is bound, but the type alone says what happens.
  if (inputs.phaseType === HUMAN_INPUT_PHASE_TYPE) return "Wait for your approval"

  // (5) otherwise NULL — the honest floor. Never fabricate; the caller falls through
  //     to the plain-language type sentence.
  return null
}
```

**Four properties the 189 tier inherits:**

1. **Each gate is a NAMED module-scope constant, never an inline literal.** `:453-454`:
   ```ts
   /** The one type that pauses for a person — the literal `waitsForYou` also reads. */
   const HUMAN_INPUT_PHASE_TYPE = "llm_human_input"
   ```
   ⇒ 189 declares `const EXTERNAL_ACTION_PHASE_TYPE = "external_action"` the same way.
2. **Pure function of flat inputs**, with `derivedFaceOf` (`:595-598`) as the phase-shaped adapter
   that *"declares NO branch of its own"* — that is what stops the panel and the canvas drifting.
3. **NEVER FABRICATE A CAPABILITY** (`:446-451`): *"rendering `Search {folder}` on a step whose
   executor performs no retrieval states something the step cannot do."* ✅ 189 is clean here —
   `capability` is stored ON THE CONFIG, so tier 3.5 needs no `NameContext` lookup at all and
   cannot miss.
4. ⚠ **`GROUNDING_DIAL_TYPES` is READ and NEVER edited** (`:551-553`, a D-185-15 red line):
   *"a third member would change grounding semantics."* An `external_action` node must not join it.

**⇒ The 189 tier, inserted between (3) and (4) as `(3.5) EXTERNAL CAPABILITY`, GATED on
`phaseType === EXTERNAL_ACTION_PHASE_TYPE`**, mapping the three closed capability names to three
sentences ("Sends an email" / "Creates a ticket" / "Posts a message").

---

### 11 · `frontend/src/components/workflows/canvasModel.ts` (utility/projection, transform)

**Analog: the delegating-predicate + `buildPhaseData` shape (`:255-302`).** Every face value is
resolved ONCE at projection time through a small named predicate that declares no rule of its own:

```ts
function isGrounded(phase: PhaseSpecJSON, kbTools: readonly string[]): boolean {
  return groundingCauseOf(phase, kbTools) !== null
}

/** GOVERN-03 — is a checkpoint armed on this step? Delegated for the same reason. */
function isArmed(phase: PhaseSpecJSON): boolean {
  return actionRiskArmed(phase)
}
```

```ts
function buildPhaseData(
  phase: PhaseSpecJSON,
  kbTools: readonly string[],
  nameContext: NameContext,
): PhaseNodeData {
  const phaseType = phase.config.phase_type
  return {
    slug: phase.slug,
    phaseIndex: phase.phase_index,
    phaseType,
    title: nodeTitle(phase, nameContext),
    technicalTitle: technicalTitle(phase),
    subtitle: PHASE_TYPE_SUBTITLES[phaseType] ?? "",
    grounded: isGrounded(phase, kbTools),
    armed: isArmed(phase),
    waitsForYou: waitsForYou(phase),
  }
}
```

⇒ **`notConnected: notConnectedOf(phase)`** as one more line, with `notConnectedOf` living in
`phaseVocabulary.ts` beside `actionRiskArmed` / `waitsForYou`. **Follow this shape exactly** — the
docblock at `:248-249` says the point is that *"every boolean on the node face has a name to argue
with rather than an inline ternary."*

**The field-doc convention on `PhaseNodeData` (`:142-151`)** — each boolean carries WHY it is
read-only on the canvas:

```ts
  /**
   * GOVERN-03 — an action-risk checkpoint is armed on this step. READ-ONLY on the
   * canvas: arming happens in the panel's governance section (sketch 147 — the
   * panel is where you SET, the canvas is where you SEE), and `PhaseNodeCard`
   * forbids any focusable control inside the card, so a clickable armed mark is
   * not representable here even in principle.
   */
  armed: boolean
  /** Badge slot 2 — true ONLY on `llm_human_input`. */
  waitsForYou: boolean
```

⚠ **Line `:138-139` is a prose claim 189 CHANGES:** *"both badge slots are committed to 188/189.
Badge slot 1 is deliberately EMPTY from this plan onward."* Six such claims flip; see § Shared
Pattern D.

⚠ **`:297` is an UNGUARDED WR-04 SINK — do not copy it, fix it while adding the 7th key.**
`PHASE_TYPE_SUBTITLES[phaseType] ?? ""` on a plain object literal. Measured: it is the ONLY read of
that map outside its declaration (`grep -n PHASE_TYPE_SUBTITLES` → `canvasModel.ts:47` import,
`:297` read, `phaseVocabulary.ts:162` declaration).
⚠ **Pointer correction:** RESEARCH §A1 F6 puts this read at `canvasModel.ts:~447`. It is at `:297`.

⚠ **`:199-203` is SUPERSEDED PROSE, NOT A REQUIREMENT** (Conflict 3, D-21). Verbatim:

```ts
   * Today only `true` and ABSENT are producible: SPEC Req 8 arms nothing by default
   * in 185 and no shipped step type performs outbound egress, so no step is
   * inherently risky yet. `false` is Phase 189's state — an external-action step
   * whose checkpoint the author turned off — and `FlowEdge` carries it now so the
   * unarmed reading is a shipped, tested behaviour rather than a promise.
```

D-04 makes `false` unreachable forever, and `checkpointOnTarget` (`:274-276`) already cannot
produce it: `return actionRiskArmed(phase) ? true : undefined`. **Correct the prose; build nothing.**

---

### 12 · `frontend/src/components/workflows/PhaseNode.tsx` (component/adapter)

**Analog: the badge-tuple assembly (`:214-220`) — the ONE line D-12/D-18 change.** Nothing else
constructs a `BadgeSlots` tuple anywhere in the tree:

```tsx
  const waitsForYou: BadgeSlot = {
    testId: "canvas-waits-for-you",
    tone: "primary",
    label: "Waits for you",
    dataAttr: { "data-waits-for-you": "true" },
  }
  const badges: BadgeSlots = data.waitsForYou ? [waitsForYou] : []
```

**The `BadgeSlot` object shape to mirror** — four fields: `testId` (kebab, `canvas-` prefixed),
`tone` (from the shared three-tone org vocabulary), `label`, `dataAttr` (a single kebab data
attribute, `"true"`-valued). ⇒ `{ testId: "canvas-not-connected", tone: …, label: "Not connected",
dataAttr: { "data-not-connected": "true" } }`.

**The type-enforced budget** (`phaseNodeCardContract.ts:94-104`):

```ts
/**
 * **THE 137-B TWO-BADGE BUDGET, ENFORCED BY THE TYPE SYSTEM.**
 *
 * A max-2 tuple union. Zero, one or two badges are representable; a third is a
 * TYPECHECK ERROR, not a review comment. That is deliberate and it is the mechanism
 * D-184-06 asks for: Phase 185 physically cannot spend this surface's badge budget on
 * a graded-governance chip, and Phase 188's run state cannot quietly become badge
 * three. No tool chips, no gate identifiers, no `phase_index` on the face (D-183-07).
 */
export type BadgeSlot2Tuple = readonly [BadgeSlot, BadgeSlot]
export type BadgeSlots = readonly [] | readonly [BadgeSlot] | BadgeSlot2Tuple
```

⚠ **ANTI-PATTERN, and it silently disarms the guard: `[...a, ...b]`.** A spread widens
`BadgeSlots` to `BadgeSlot[]` and retires the max-2 typecheck. **Build the tuple with explicit
branches.** Order is a tuple position, not a preference: `waitsForYou` is documented as **slot 2**
at three sites (`canvasModel.ts:150`, `PhaseNode.tsx:213`, `phaseVocabulary.ts:635`), so the new
badge is FIRST.

**⇒ Zero change to `PhaseNodeCard.tsx` or the five fenced siblings.** The card already renders the
tuple through its existing `badges?: BadgeSlots` prop. That is exactly what 188.2 cut the contract
out for, and it is how 189 honours the "prefer filling an existing slot" cost note.

---

### 13 · `frontend/src/components/workflows/ExternalActionSection.tsx` (NEW, component)

**Analog: `GovernanceSection.tsx` (321 L) — the G-5-honouring precedent, whole-file shape.**

**The mount, measured at `PhaseFormPanel.tsx:1046-1048` — ONE gated JSX expression:**

```tsx
        {rails && <GovernanceSection phaseType={pt} availableTools={asList(cfg.available_tools)} kbTools={rails.kbTools ?? []}
          citationPolicy={asStr(cfg.citation_policy)} groundingEscalated={phase.grounding_escalated === true}
          actionRiskArmed={phase.action_risk_armed === true} onGovernanceChange={onGovernanceChange} />}
```

Plus one import (`PhaseFormPanel.tsx:57`):

```tsx
import { GovernanceSection } from "./GovernanceSection"
```

**That is the whole panel-side cost of a full governance feature.** The ledger row says *"Keep this
shape — the next surface that needs the panel gets its own component and one gated line."*
189 is that next surface.

**Six properties the new component copies from `GovernanceSection.tsx:1-60`:**

```
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` — the same
 * `STRANDING_REASON` / `StepTypePicker` idiom, and for the same reason: a refusal
 * reason that lives inside a component is a refusal reason nobody can test for drift.
 * Its suite asserts character-identity against those imported names. This module
 * imports nothing from the API client, names no route and opens no request; a `?raw`
 * fence in `GovernanceSection.test.tsx` proves it, with a positive control.
 ...
 * A LEAF, not a wired surface: presentational and caller-driven. It reads no context,
 * fetches nothing, holds no store reference, and its only write is one of two booleans
 * handed back to the caller (D-185-10 — these fields are siblings of `validators`, and
 * `PhaseFormPanel`'s only write seam patches `config`).
```

1. **Every user-visible string is an imported identifier from `definitionOps`** — never a literal
   in the component. (`GovernanceSection.tsx:63-75` imports eleven of them.)
2. **A leaf**: no context, no fetch, no store; writes flow back through one callback prop.
3. **A `?raw` fence in its own suite** proving it names no API route, with a positive control.
4. **A named type-gate constant** (`:90`):
   ```tsx
   /**
    * The two step types that carry a dial (D-185-15). Mirrors the backend rule exactly:
    * `available_tools` exists only on `LlmAgentPhaseConfig` and `LlmBatchAgentsPhaseConfig`,
    * so these are the only types `grounding_cause` can ever report `detected` for.
    */
   const DIAL_TYPES: readonly string[] = ["llm_agent", "llm_batch_agents"]
   ```
5. **A control that could never do anything is REMOVED, not disabled** (`:44-48`) — *"But the
   SECTION still renders (D-185-16), carrying the locked phrase, so a step that is held to nothing
   can never read as a build that forgot to render its control."*
6. **A refusal's reason is REAL DOM TEXT wired by `aria-describedby` — never a `title` attribute
   (the 184-07 lesson)** (`:29-30`). ⇒ D-04's "armed, on, non-interactive" refusal reuses this
   exact affordance and the 185 refusal vocabulary, not new copy.

**The per-type gate site in the panel** — the capability editor mounts as a 7th sibling of these
six branches (`PhaseFormPanel.tsx:780, 805, 841, 893, 952, 988`):

```tsx
          {/* ── llm_emit: the ONLY type with citation_policy + integrity_policy (greyed) ── */}
          {pt === "llm_emit" && (
```

⚠ **The option set is the SERVER'S** (`PhaseFormPanel.tsx:482`, verbatim — RESEARCH cites `:483`,
off by one):

```
 * THE OPTION SET IS THE SERVER'S. It arrives as `rails.toolOptions`, which `useGroundingBundle`
 * fills from `GET /workflows/grounding-bundle` and from nothing else. There is no frontend
 * list of tool ids here or anywhere upstream of here — a client-assembled whitelist would let
 * knowledge-base content whitelist itself, which is the elevation of privilege the
 * server-owned registry exists to prevent.
```

⚠ **This creates a REAL TENSION the plan must resolve explicitly.** D-20 keeps the three
capabilities OUT of `GroundingBundle.tools` — so the capability picker's three options cannot come
from `rails.toolOptions`, yet this docblock forbids a frontend option list. **Two coherent exits,
and the plan must NAME one:** (a) a new server-sourced field on the bundle carrying the capability
set *separately* from `tools` (RESEARCH Open Q2 says 190 may want exactly this), or (b) a
frontend `Literal` triple justified as *the discriminated-union mirror* rather than as an options
source — which `definitionOps.ts:58-61` already licenses for `PhaseTypeId` (*"The 6 members of the
backend's `PhaseConfig` discriminated union … CLOSED"*). **(b) is the closer analog**: the
capability is a `Literal` on the config, exactly like `phase_type`, and `PhaseTypeId` is the
shipped precedent for mirroring one.

---

### 14 · `frontend/src/components/workflows/definitionOps.ts` (utility, transform)

**Analog: the closed-set block (`:56-83`) — and the docblock names its backend source:**

```ts
// ── The closed phase-type set ──────────────────────────────────────────────────

/**
 * The 6 members of the backend's `PhaseConfig` discriminated union
 * (`harness.py:157-167`). CLOSED: a slug and a minimal phase are only ever derived
 * from this set, never from user text.
 */
export type PhaseTypeId =
  | "programmatic"
  | "llm_single"
  | "llm_agent"
  | "llm_batch_agents"
  | "llm_human_input"
  | "llm_emit"

/**
 * The FIXED presentation order of the step-type picker (D-184-11). It is a `readonly`
 * tuple, not a set, because "the picker's third option moved" is a UX regression a
 * test should catch.
 */
export const PHASE_TYPE_ORDER = [
  ...
] as const satisfies readonly PhaseTypeId[]
```

⚠ **That docblock's `harness.py:157-167` pointer is ALREADY STALE** — measured, the union is at
`harness.py:162-172`. Correct it while adding the 7th member; it is the same drift class 188.2
found four times in `icon-convention.md`.

⚠ **`PHASE_TYPE_ORDER` is `satisfies`, not exhaustive — a SUBSET satisfies it.** Omitting the 7th
compiles cleanly and the picker simply never offers the type. Silent.

**The two TYPECHECK-FORCED sites — the only two in the whole frontend:**

```ts
const SLUG_BASE = {
  programmatic: "prepare",
  llm_single: "write",
  llm_agent: "search",
  llm_batch_agents: "parallel",
  llm_human_input: "ask",
  llm_emit: "deliver",
} as const satisfies Record<PhaseTypeId, string>
```
*(`:828-835`. The base tokens are single plain-language verbs/nouns — `send` or `act` fits the
register; `external_action` does not.)*

```ts
function requiredConfigFor(type: PhaseTypeId): Record<string, unknown> {
  switch (type) {
    case "programmatic":
      return { fn: "" }
    ...
    case "llm_emit":
      return { prompt: "" }
    default: {
      const _never: never = type
      void _never
      return {}
    }
  }
}
```
*(`:871-891` — the `const _never: never = type` exhaustiveness guard is what makes a 7th member a
compile error. Its docblock at `:860-865` states the rule for what belongs: **required keys only,
never a field with a backend default** — so `available_tools: []` yes, `capability` only if it has
no default.)*

---

### 15 · The 7th glyph — `soulData.ts` + `lib/phaseGlyph.tsx` (SAME COMMIT)

**Analog: `PHASE_GLYPHS` (`soulData.ts:43-50`)** — ✅ CONTEXT's correction confirmed; it is NOT in
`phaseVocabulary.ts`:

```ts
export const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "gear",
  llm_single: "memo",
  llm_agent: "compass",
  llm_batch_agents: "handshake",
  llm_human_input: "raised-hand",
  llm_emit: "package",
}
```

**Its paired resolver (`lib/phaseGlyph.tsx:42-67`):**

```tsx
import Gear from "~icons/fluent-emoji/gear"
import Memo from "~icons/fluent-emoji/memo"
import Compass from "~icons/fluent-emoji/compass"
import Handshake from "~icons/fluent-emoji/handshake"
import RaisedHand from "~icons/fluent-emoji/raised-hand"
import Package from "~icons/fluent-emoji/package"
...
const PHASE_GLYPH_MARKS: Record<string, PhaseMark> = {
  programmatic: Gear,
  llm_single: Memo,
  llm_agent: Compass,
  llm_batch_agents: Handshake,
  llm_human_input: RaisedHand,
  llm_emit: Package,
}
```

**The same-commit rule, verbatim (`phaseGlyph.tsx:33-36`):**

```
 * a dim or generic mark means the step type is unreadable. Both maps below —
 * this one and `soulData.PHASE_GLYPHS` — swapped in the SAME commit: swapping
 * one alone leaves phaseGlyph() returning the old component while the string
 * fallback changed, a silent split-brain.
```

**The precedent that presence ≠ suitability (`soulData.ts:35-40`)** — the exact defect U1 checks
for:

```
// Phase 184-01 Task 2 (D-184-07): the two cross-cutting swaps — `llm_agent` to
// "compass" and `llm_batch_agents` to "handshake" (its previous silhouettes mark
// measured luminance 34.5 on Deep Midnight, ~4x dimmer than the other five, and
// disappeared). Sketch 137-B makes the 3D mark the SOLE carrier of step type, so
// this is a correctness fix, not a taste call.
```

**The tint entry (`nodePresentation.ts:83-90`)** — the whole of the type-colour budget:

```ts
/**
 * The per-step-type tint that sits BEHIND the floating mark — the whole of this
 * surface's type-colour budget (137-D). Values are the sketch's, expressed against
 * the same hue family the app already ships; every card body stays neutral.
 */
export const ICON_TINT: Record<string, string> = {
  programmatic: "hsl(200 85% 62% / 0.36)",
  ...
  llm_emit: "hsl(258 90% 70% / 0.40)",
}

export const DEFAULT_TINT = "hsl(220 30% 100% / 0.18)"
```

---

### 16 · `frontend/src/components/panel/PhaseCard.tsx` (component, dev panel)

**Analog: `STATUS_META`'s own `unknown` row (`:101-111`)** — the last entry added, and the model
for how a forced row documents *why the compiler demanded it*:

```tsx
const STATUS_META: Record<Phase["status"], StatusMeta> = {
  pending: { glyph: "○", text: "Locked", textClass: "text-panel-muted-foreground" },
  ...
  // Phase 188 Plan 02 (RUNVIZ-02 / D-188-08 / D-188-06) — ADDED, nothing above changed.
  // This row exists because the compiler demanded it: `Phase["status"]` gained
  // `"unknown"` so `reconcilePhases` could stop resolving an unrecognised
  // `workflow_phases.status` to `done`, and `Record<Phase["status"], …>` then forced the
  // developer panel to state that honestly too. That forcing is the mechanism, not
  // collateral damage. The `?` is INHERITED from `VERDICT_MARK.unknown`
  // (`workflows/nodePresentation.ts:185`) rather than invented — 188 spends zero net-new
  // glyphs. ...
  unknown: { glyph: "?", text: "Unknown", textClass: "text-panel-muted-foreground" },
}
```

Two rules the 189 row inherits: **ADDED, nothing above changed**, and **inherit a glyph rather than
inventing one**.

⚠ **`PHASE_TYPE_LABEL` (`:43-49`) IS A BAD ANALOG — DO NOT EXTEND IT.** It is already incomplete
(5 entries; `llm_emit` absent) and degrades gracefully by design:

```tsx
const PHASE_TYPE_LABEL: Record<string, PhaseTypeMeta> = {
  programmatic: { label: "Server step", glyph: "⚙", oneLiner: "A fixed server function ran — no AI." },
  llm_single: { label: "AI write step", glyph: "✎", oneLiner: "One AI message — think/write." },
  llm_agent: { label: "AI agent step", glyph: "🤖", oneLiner: "An AI agent using allowed tools, looping until done." },
  llm_batch_agents: { label: "Parallel agents", glyph: "⛓", oneLiner: "Many AI agents at once, results merged." },
  llm_human_input: { label: "Needs you", glyph: "☺", oneLiner: "Paused — waiting for your input." },
}
const UNKNOWN_PHASE_META: PhaseTypeMeta = { label: "Step", glyph: "•", oneLiner: "A workflow step ran." }
```

**The right move is to DECLINE the 7th entry and RECORD the declination**, exactly as
`PhaseNode.tsx:231` argues (*"Declining a slot is a decision, recorded here rather than discovered
later"*). The developer panel already treats an unmapped type honestly.

---

## Shared Patterns

### A · The exhaustive `Record<Union, T>` as a compiler-enforced reminder

**Source:** `runVocabulary.ts:159-164` (quoted in full at §9-B).
**Apply to:** every per-state table 189 widens.

**Which tables are FORCED vs SILENT — measured, and the asymmetry is the phase's biggest execution
risk:**

| Forced (compiler names it) | Silent (only this list finds it) |
|---|---|
| `definitionOps.SLUG_BASE` `:828` | `definitionOps.PHASE_TYPE_ORDER` `:76` (`satisfies` — a subset passes) |
| `definitionOps.requiredConfigFor` `:871` | `phaseVocabulary` ×3 `:152/:162/:176` |
| `PhaseCard.STATUS_META` `:89` | `soulData.PHASE_GLYPHS` `:43` |
| `runVocabulary.RUN_READING_WORD` `:61` | `phaseGlyph.PHASE_GLYPH_MARKS` `:60` (⚠ but a missing slug FAILS THE BUILD) |
| `runVocabulary.STATIC_CLAUSE` `:170` | `nodePresentation.ICON_TINT` `:83` |
| `runVocabulary.RING_GEOMETRY` `:313` | `lib/phaseState.DB_PHASE_STATUS` `:41` |
| `NodeRunOverlay.RING_STROKE` `:134` | `lib/phaseState.canvasReading` `:122` (`default:` absorbs it) |
| | `PhaseTimeline.milestoneFor` `:60` (`default:` absorbs it) |
| | `PhaseFormPanel.PHASE_TYPE_FRIENDLY` `:169` |

Plus **~16 `toHaveLength(6)` assertion pins** the count gate cannot see (it pins test COUNTS, not
assertions). The warning sign is **a green `tsc` and a red vitest**.

### B · Closed registry, never dynamic resolution

**Source:** `phase_types.py:442-448` (§2-A).
**Apply to:** the capability lookup in `_exec_external_action`.
**Siblings sharing the rule:** `_TOOL_REGISTRY`, `PROGRAMMATIC_PHASE_REGISTRY`, `EMITTER_REGISTRY`
— *a name not present raises*. Never resolved dynamically, never eval'd.

### C · `own<T>()` on every keyed lookup (WR-04)

**Source:** `frontend/src/components/workflows/ownProperty.ts` — 86 L, **zero imports**, whose
zero-import property is its contract:

```ts
export function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? (table as Record<string, T>)[key]
    : undefined
}
```

**Apply to:** any slug-keyed or type-keyed lookup 189 adds — and to `canvasModel.ts:297`, the one
unguarded sink already in the blast radius.

**Why it is not ceremony** (`ownProperty.ts:59-65`): every table is a plain object literal, so it
INHERITS `constructor` / `toString` / `__proto__`; `TABLE[key] ?? fallback` **does not fire its
fallback** for those names. Measured value for `constructor` was literally `[Function Object]`.

⚠ **TWO SPELLINGS COEXIST, AND THE PLAN MUST NOT MERGE THEM.** `runVocabulary.ts:84-88` keeps its
own module-private `own<T>(table, reading: CanvasReading)` — a different second-parameter type,
constrained by that file's own `?raw` fences. `ownProperty.ts:77-80` states the boundary
explicitly: *"THE CONSTRAINT IT NAMED IS UNTOUCHED … this module does not import it, widen it, or
ask it to change."* Four further inline guards (`phaseState.ts:77`, `phaseGlyph.tsx:92`,
`PhaseNode.tsx:165`, `nodePresentation.ts:128`) are deliberately left in place — consolidating them
is `188.2-DEFERRED.md`'s, not 189's.

### D · Six prose claims that flip from "reserved" to "spent"

Spending badge slot 1 falsifies a documented reservation asserted in **six source files and guarded
by two live test suites**. All re-derived 2026-08-07:

| # | Site | Text |
|---|---|---|
| 1 | `PhaseNodeCard.tsx:39-40` | *"Badge slot 1 stays EMPTY and RESERVED FOR PHASE 189 (D-12)"* |
| 2 | `canvasModel.ts:138-139` | *"both badge slots are committed to 188/189. Badge slot 1 is deliberately EMPTY"* |
| 3 | `NodeCornerMarks.tsx:25-27` (also `:217`, `:223`) | *"the freed slot belongs to 188 / 189"* |
| 4 | `PhaseNode.tsx:211` | *"Slot 1 is therefore still empty and now belongs to Phase 189 alone."* |
| 5 | `PhaseNode.tsx:259` | *"would spend the corner the seal claims or a badge slot 188/189 owns"* |
| 6 | `phaseNodeCardContract.ts:6-7` | *"189 adds a slot to a contract of this size rather than to a 797-line component"* |
| T1 | `PhaseNodeCard.test.tsx:2156` | *"Non-vacuity: it is a real badge row, and slot 1 is still empty and still reserved."* |
| T2 | `WorkflowCanvas.test.tsx:422-423` | `it("NO phase node carries a grounding chip — slot 1 is empty and reserved")` |

**T1 and T2 are REWRITTEN, not deleted** — from "absent on every node" to "absent unless
not-connected", each with a positive control. T1's current body, for the shape to preserve:

```tsx
describe("188-06 — the card body budget, and the three slots 188 does NOT spend", () => {
  it("spends ZERO badge slots — the badge row is byte-identical at every reading", () => {
    const rows = ALL_READINGS.map((reading) => {
      const { container, unmount } = renderCard({ badges: [waitsBadge], status: reading })
      expect(container.querySelectorAll("[data-tone]")).toHaveLength(1)
      const row = container.querySelector("[data-tone]")!.closest("div")!.outerHTML
      unmount()
      return row
    })
    for (const row of rows) expect(row).toBe(rows[0])
    // Non-vacuity: it is a real badge row, and slot 1 is still empty and still reserved.
    expect(rows[0]).toContain("Waits for you")
    expect(rows[0].length).toBeGreaterThan(0)
  })
```

⚠ **Two invariants 189 must NOT break, both mechanically driven RED by 188.2:**
- **No focusable control inside the card** — `PhaseNodeCard.test.tsx:255-264`:
  ```tsx
  describe("PhaseNodeCard — ONE TAB STOP PER NODE (the leaf-level mirror)", () => {
    it("contains NO focusable control of any kind", () => {
      const { container } = renderCard({ ..., badges: [groundingBadge, waitsBadge], selected: true })
      expect(container.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    })
  ```
  The badge is a `<span>`. Keep it so.
- **Top-right is the governance seal's** — `phaseNodeCardContract.ts:196`: *"the card is CLAIMED for
  governance — 188/189 may not take it."* The badge row is not top-right; no conflict.

### E · The `?raw` source fence

**Source:** `PhaseNodeCard.test.tsx:100-113`.
⚠ **Pointer correction: RESEARCH §C13 places this at `:260-267`. Measured at `:100-113`.** The
`toHaveLength(6)` pin is at `:545` ✅ (RESEARCH correct there).

```tsx
const CARD_SUBTREE_PATHS = [
  "./PhaseNodeCard.tsx",
  "./phaseNodeCardContract.ts",
  "./ownProperty.ts",
  "./NodeCornerMarks.tsx",
  "./NodeRunOverlay.tsx",
  "./NodeIconWell.tsx",
] as const
const CARD_MODULES = import.meta.glob("./*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>
const cardSubtreeSource = CARD_SUBTREE_PATHS.map((path) => CARD_MODULES[path] ?? "").join("\n")
```

**Apply to:** `test_189_no_egress.py` — the SC#4 source fence, adapted to Python (read the
`backend/app` tree and assert `mcp` / outbound-HTTP identifiers are absent, **with a positive
control** so the fence cannot pass vacuously).

**And to:** the new `ExternalActionSection.test.tsx`, mirroring `GovernanceSection.test.tsx`'s
no-API-client fence.

⚠ **189 should NOT touch `CARD_SUBTREE_PATHS`.** §C11's trace keeps every edit outside the six
fenced files. If a plan proposes a seventh module here, that is the signal to reconsider the
design, not to move the pin (`PhaseNodeCard.test.tsx:95-99` explains why: *"the other FIFTEEN would
stay green while covering nothing at all"*).

### F · The `docs/` architecture doc + its pointer entry

**Source A — `docs/SANDBOX-PACKAGES.md:1-13`** (the doc conventions; measured across all five files
in `docs/`: SCREAMING-KEBAB filename, **no YAML front matter**, single `# Title` H1, `##` sections,
referenced BY NAME from `CLAUDE.md`):

```markdown
# Sandbox packages — what `execute_code` can import

Canonical reference for the Python packages preinstalled in the agent's code-execution
sandbox (the `execute_code` tool). **This is the human-readable single source of truth.**
The machine truth is the `pip install` line in
[`backend/Dockerfile.sandbox`](../backend/Dockerfile.sandbox); this doc must be kept in
sync with it (see "Keeping this in sync" below).

> Why this doc exists: on 2026-07-08 a skill authored by skill-creator instructed the
> agent to use `fpdf2` for a PDF — a library that is **not** installed ...
```

Note the shape: **H1 → one-paragraph "what this is" → an explicit `> Why this doc exists` block
naming the dated incident.** For 189 that block is the MCP-first verdict's basis (SEED-013/014 +
the `.planning/research/deep-dive/{BEAM,GLEAN,N8N}.md` crawl) and its **dated re-open trigger**.

**Source B — `D-v3.4-01` at `.planning/prd-reset/DECISIONS.md:1400-1409`.** ⭐ It is itself a
POINTER entry that does not restate its doc, which is exactly what D-10 requires:

```markdown
## D-v3.4-01 — Tenancy-Model ADR (ratifies D-PRD-02)

**Status:** Ratified 2026-07-18
**Type:** Per-milestone architectural decision (v3.4). This is the FIRST `D-vX.Y-NN` entry recorded in this file — locked decision D-02 places the v3.4 tenancy pointer HERE (alongside the cross-milestone `D-PRD-NN` ADRs) AND in `.planning/PROJECT.md`'s Key Decisions table, so the milestone's biggest posture call is complete in both registers (belt-and-suspenders per the footer convention below).

The standalone Tenancy-Model ADR at `.planning/phases/160-tenancy-model-adr/160-ADR.md` ratifies the already-ACCEPTED `D-PRD-02` ... — a ratify-not-relitigate call, not a re-opening. It additionally locks, as binding for phases 161-168, ...

`D-PRD-02` itself is unchanged by this entry — see its section above for the full posture rationale. This is a pointer; the full ratification lives in `160-ADR.md`.
```

**Copy this shape exactly for `D-v3.6-01`:** `## D-v3.6-01 — <title>` · a `**Status:** Ratified
<date>` / `**Type:** Per-milestone architectural decision (v3.6).` header pair · 2-3 paragraphs of
what it locks · **a closing "This is a pointer; the full X lives in `<doc>`" sentence.**

⚠ **Do NOT copy `D-PRD-15`'s `### Context` / `### Decision` / `### Consequences` full-ADR shape** —
D-10 explicitly forbids restating the doc.

**Placement, measured:** after `D-v3.4-01` (which ends at `:1409`) and **before `## Cross-references`
at `:1411`**, plus a bullet in the `## Cross-references` list. `D-v3.6-01` is the correct id —
`D-v3.4-01` is the only `D-vX.Y-NN` entry in the file today.

⚠ **Add the `CLAUDE.md` pointer line in the SAME COMMIT.** All five `docs/` files are named from
`CLAUDE.md`; a sixth that is not is an orphan.

### G · Additive growth with a keyword-only default-off flag

**Source:** `db/workflows.py:150` + `:262` (`is_golden_run: bool = False` / *"keyword-only
precedent: default OFF = byte-identical"*).
**Apply to:** the D-19 `is_golden_run` ctx threading, and to any new optional signature 189 adds.
This is the Python sibling of `harness.py:10-21`'s additive-union rule and of the
`Partial<Record<…>>` "correct to leave unset" choice at `runVocabulary.ts:239`.

---

## No Analog Found

| File / element | Role | Data Flow | Why there is no precedent |
|---|---|---|---|
| **The 8th `RING_GEOMETRY` shape** (`runVocabulary.ts:313`) | design decision | — | The docblock at `:294-311` states a BUILD CRITERION — *identifiable by arc shape alone in greyscale* — and enumerates seven uniqueness properties that between them consume the obvious design space (`gapCentre` 0.375 and 0.75 taken; `length` ratios 5/7 and 1.5/6 bracketing the texture axis). **G-2 is waived for 189 by ROADMAP line 675, so there is no sketch to defer to.** This is a plan decision owing a driven greyscale UAT row (U3), not a table entry. |
| **The capability option source for `ExternalActionSection`** | data source | request-response | `PhaseFormPanel.tsx:482` forbids a frontend option list; D-20 forbids putting the capabilities on `GroundingBundle.tools`. No shipped surface sources author-facing options any third way. **The nearest analog is `PhaseTypeId` (`definitionOps.ts:63-69`) — a client mirror of a backend `Literal`, licensed as a union mirror rather than as an options source.** The plan must name which exit it takes; see §13. |

---

## Bad Analogs — flagged, because a wrong analog is worse than none

| Tempting analog | Why it is wrong here |
|---|---|
| `publish_service._interactive_phase_failures:500-540` | Extending it with `external_action` is Conflict-1 Option B and **contradicts D-06 outright** — the workflow becomes unpublishable. Excerpted only so it is recognised and declined. |
| `_exec_llm_human_input` (the ask_user substrate) | **Times out and returns NORMALLY — the run ADVANCES** (L2, re-verified: `timeout_seconds: int = 300` at `harness.py:126`, clamped to 1800; on `payload is None` it returns `{"text": …, "answer": "", …}`). The armed checkpoint uses `_resolve_failure_with_ask_user` with `timeout_seconds = None` (`harness_engine.py:1104`) and is **already fail-closed**. 189 must not reuse the `llm_human_input` substrate. |
| `canvasModel.ts:199-203`'s ghost-detour prose | Falsified by D-04; `false` is not producible from `checkpointOnTarget` (`:274-276`) today and never will be. **Correct the prose; build nothing** (D-21). |
| `grounding.py:446-447`'s `tools == sorted(tool_names)` claim | Becomes FALSE the moment Conflict 2 is resolved as recommended. Same-commit correction required. |
| `KB_TOOLS_SORTED` (`grounding.py:803`) | The wire half exists because the client receives KB_TOOLS as data. D-20 says capabilities stay OFF the wire — an `..._SORTED` sibling is the first step into the leak. |
| `panel/PhaseCard.PHASE_TYPE_LABEL:43-49` | Already 5-of-6 and degrades honestly by design. **Decline the 7th entry and record the declination**, per `PhaseNode.tsx:231`. |
| `[...a, ...b]` for the badge tuple | Widens `BadgeSlots` to `BadgeSlot[]` and silently retires the max-2 typecheck guard 188.2-01 drove RED. Explicit branches only. |
| `fail_phase`'s `_failure_reason` payload merge (`db/workflows.py:999`) | `recorded_not_sent` is not a failure. That key is the status-repair scripts'. Copy `complete_phase`, not `fail_phase`. |
| `runVocabulary.ts`'s module-private `own()` (`:84-88`) | Do not widen or import it — `ownProperty.ts:77-80` explicitly records that constraint as untouched. New sinks import `own` from `ownProperty.ts`. |
| `canvasModel.ts:297` `PHASE_TYPE_SUBTITLES[phaseType] ?? ""` | An unguarded WR-04 sink. Do not copy the expression; fix it while adding the 7th key. |

---

## Pointer corrections (re-derived 2026-08-07)

| Source | Claim | Measured | Verdict |
|---|---|---|---|
| RESEARCH §C13 | `CARD_SUBTREE_PATHS` at `PhaseNodeCard.test.tsx:260-267` | **`:100-113`** | ❌ **STALE — off by 160 lines** |
| RESEARCH §A1 F6 | `canvasModel.ts:~447` reads `PHASE_TYPE_SUBTITLES` | **`:297`** (the only read; `:47` is the import) | ❌ **STALE** |
| RESEARCH §A3 + Code Examples | `complete_phase` at `db/workflows.py:975` | `async def` at **`:970`**; SQL at `:978-982` | ⚠ off by 5 (points into the docstring) |
| RESEARCH §A2 + Pattern 2 | the closed-registry raise at `phase_types.py:441-446` | `raise KeyError(` at **`:445-448`**; `fn = …get()` at `:443` | ⚠ off by ~2 |
| CONTEXT / RESEARCH §A6 | `render_template` precedent at `phase_types.py:296-320` | `def _effective_tools` at **`:279`**; the two-layer paragraph at `:299-314`; body `:324-327` | ⚠ points into the docblock — anchor on `:279` |
| RESEARCH "Don't Hand-Roll" | `PhaseFormPanel.tsx:483` = *"THE OPTION SET IS THE SERVER'S"* | **`:482`** | ⚠ off by one |
| `definitionOps.ts:59-60` (in the TREE) | the union is at `harness.py:157-167` | **`harness.py:162-172`** | ❌ **STALE IN SOURCE — correct in the same commit** |
| `lib/phaseState.ts:36-39` (in the TREE) | *"the five keys are exactly `workflow_phases_status_check`"* | true today, **falsified by migration 115** | ⚠ owed a same-commit correction |
| ✅ verified exact | `harness.py:162` union · `:235` `action_risk_armed` · `:202` `slug: str` · `phase_types.py:1658` registry · `:433-463` `_exec_programmatic` · `:466-489` `_exec_llm_single` · `grounding.py:388/:427/:643/:797/:803` · `publish_service.py:500/:521/:531` · `harness_engine.py:754/:1104/:1605-1632` · `db/workflows.py:959/:985/:1007` · `full-schema.sql:1932` (still 5 values) · migration head **114** · `phaseNodeCardContract.ts:104/:196` · `PhaseNode.tsx:214-220` · `runVocabulary.ts:61/:170/:313` · `NodeRunOverlay.tsx:134` · `phaseState.ts:41/:76/:87/:122` · `soulData.ts:43` · `phaseGlyph.tsx:33-36/:60` · `nodePresentation.ts:83` · `definitionOps.ts:63/:76/:828/:871` · `phaseVocabulary.ts:152/:162/:176/:516-580` · `PhaseCard.tsx:43/:50/:89` · `PhaseFormPanel.tsx:1046-1048/:57` · `PhaseNodeCard.test.tsx:545/:2156` · `WorkflowCanvas.test.tsx:422-423` · `DECISIONS.md:1400/:1411` · `workflow_authoring.py:62` | | ✅ 33 pointers HOLD |
| ✅ new measurement | `is_golden_run` occurs in `db/workflows.py` (6×) and `publish_service.py` (4×) and in **`harness_engine.py` ZERO times** | | ✅ **confirms D-19: the threading is genuinely absent, and is the work** |

---

## Metadata

**Analog search scope:** `backend/app/models/` · `backend/app/services/harness/` ·
`backend/app/services/harness_engine.py` · `backend/app/db/` · `backend/app/api/` ·
`backend/tests/` · `supabase/migrations/` · `frontend/src/components/workflows/` ·
`frontend/src/components/panel/` · `frontend/src/lib/` · `docs/` · `.planning/prd-reset/`

**Files read for excerpts:** 26
**Pattern extraction date:** 2026-08-07
**Valid until:** re-derive every `:NNN` at execute time if the tree has moved — this repo has
shipped stale pointers in four consecutive phases, and this document found three more.
