# Phase 187: Business Vocabulary + AI-Seeded Canvas — Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 8 new · 11 modified
**Analogs found:** 17 / 19 (2 files have a partial analog only — see §"No Analog Found")
**Measured at:** `develop` @ `132b9b26`, working tree clean of tracked source changes

> Every line number below was read in this session. Where RESEARCH.md and this file disagree on a
> line, this file is the later read — but re-verify before quoting a number into a task, because
> `WorkflowBuilderPage.tsx` and `harness_engine.py` both move under edits.

---

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `frontend/src/components/workflows/SeedReceipt.tsx` | component (leaf) | event-driven arrival → render | `GovernanceSection.tsx` (file/mount shape) + `ProblemsTray.tsx` (per-step server-derived list, caller-owned `open`) | exact (two analogs, split by concern) |
| `frontend/src/components/workflows/SeedReceipt.test.tsx` | test | render + interaction + source fence | `GovernanceSection.test.tsx` | exact |
| `frontend/src/components/workflows/StarterTemplatePicker.tsx` | component (leaf picker) | request-response (`GET /workflows/starters`) → local state write | `StepTypePicker.tsx` | exact |
| `frontend/src/components/workflows/StarterTemplatePicker.test.tsx` | test | interaction + source fence | `StepTypePicker.test.tsx` / `GovernanceSection.test.tsx` | exact |
| `frontend/src/components/workflows/phaseVocabulary.corpus.test.ts` | test (pure-function corpus) | batch/transform | `canvasModel.fixtures.test.ts` over `__fixtures__/canvasFixtures.ts` | **exact — the corpus already exists** |
| `backend/tests/unit/test_187_armed_checkpoint_property.py` | test (property over validator sets) | event-driven control flow | `test_pre_post_timing.py:60-108` (the `body_ran` sentinel) + `test_ask_user_disposition.py:31-70` (armed fixtures) | exact (two analogs) |
| `backend/tests/unit/test_187_authoring_step_names.py` | test (integration + roster) | request-response (real `forced_emit`) | `test_103_nl_generate.py` | role-match — roster half has **no analog** |
| flag-OFF describe-screen pin (extend `WorkflowBuilderPage.header.test.tsx`, or a sibling file) | test (markup pin) | — | `WorkflowBuilderPage.header.test.tsx:296-322` (`FLAG_OFF_HEADER_MARKUP`) | exact (named by CONTEXT) |

### Modified files

| Modified file | Role | Data flow | Pattern the edit must respect | Precedent to copy |
|---|---|---|---|---|
| `frontend/src/components/workflows/phaseVocabulary.ts` | utility (the ONE vocabulary module) | pure transform | purity + totality contracts in its own header (`:1-41`) | `groundingCause` / `groundingCauseOf` pair (`:246-310`) |
| `frontend/src/components/workflows/canvasModel.ts` | utility (projection) | pure transform | PURE projection, byte-identical when the option is omitted | `ToCanvasOptions.kbTools` + `NO_KB_TOOLS` (`:295-332`) |
| `frontend/src/components/workflows/PhaseNode.tsx` | component (adapter) | props → slots | adapter-only change; no `PhaseNodeData` key, no projection change | `:140-144` swap; `:183-192` reservation comment |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | component | props → DOM | TITLE agreement only (D-187-16); `?raw` guards forbid a local copy | `:125` swap; `:177-189` chrome |
| `frontend/src/components/workflows/definitionOps.ts` | utility (pure ops + copy constants) | transform | one config-edit home; narrow patch types are typecheck-enforced | `patchPhaseConfig` (`:202-210`) / `setPhaseGovernance` (`:212-243`) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | page (composition) | orchestration | **two gated mount lines only** (D-187-14 — diff is a phase gate) | the spread-conditional at `:1790-1802`; the flag branch at `:1758-1770` |
| `backend/app/models/harness.py` | model | schema | additive-optional, `bool = False`, **never** a `@model_validator` | `grounding_escalated` (`:208-235`) |
| `backend/app/services/harness/grounding.py` | service (the ONE grounding home) | transform at the run seam | never persisted; append-never-prepend; identity return when nothing to add | `effective_phase` docblock (`:877-915`) |
| `backend/app/services/harness_engine.py` | service (engine) | event-driven control flow | reuse `_resolve_failure_with_ask_user`; reuse the two existing audit event types | pre-gate block (`:695-739`); `_is_armed_action_risk` (`:2148-2170`) |
| `backend/app/api/workflows.py` | route | request-response | a new code MUST be registered or `_severity` fails LOUD to `error` | `business_requirement` mint (`:648-659`) + `_ROUTE_ASSIGNED_CODES` (`:459-469`) |
| `backend/app/services/workflow_authoring.py` | service | request-response (provider) | prompt string only; response schema unchanged | `AUTHORING_SYSTEM_PROMPT` final sentence (`:87-88`) |

---

## Pattern Assignments — NEW FILES

### `frontend/src/components/workflows/SeedReceipt.tsx` (component, event-driven)

**Analog A — the FILE AND MOUNT shape:** `frontend/src/components/workflows/GovernanceSection.tsx`
(321 L). This is the shape CLAUDE.md's hot-file ledger praises and D-187-14 names: one component
file that holds the whole surface, mounted from the page in one gated expression.

Its docblock states the four properties the receipt must copy verbatim in spirit — copy the
*structure* of this header, not its words:

```tsx
// Source: GovernanceSection.tsx:10-16, :55-59 (shipped)
/**
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` — the same
 * `STRANDING_REASON` / `StepTypePicker` idiom, and for the same reason: a refusal
 * reason that lives inside a component is a refusal reason nobody can test for drift.
 * Its suite asserts character-identity against those imported names. This module
 * imports nothing from the API client, names no route and opens no request; a `?raw`
 * fence in `GovernanceSection.test.tsx` proves it, with a positive control.
 *
 * A LEAF, not a wired surface: presentational and caller-driven. It reads no context,
 * fetches nothing, holds no store reference […]
 */
```

**Consequence for the plan:** the receipt's copy (the four sketch-150-B load-bearing sentences)
belongs in `definitionOps.ts` as exported constants, NOT as literals inside `SeedReceipt.tsx`. That
is the same home `GROUNDING_LOCK_REFUSAL` / `ACTION_RISK_ARMED_NOTE` already use, and it is what
makes the test able to assert character-identity.

**Analog B — the CONTENT shape (a per-step list of server-derived findings, rendered verbatim,
caller-owned open/dismiss):** `frontend/src/components/workflows/ProblemsTray.tsx`.

```tsx
// Source: ProblemsTray.tsx:81-97 (shipped) — the prop contract to mirror
export interface ProblemsTrayProps {
  /** The grouped server response — `verdictModel.groupVerdicts` output, nothing else. */
  groups: VerdictGroups
  /** The definition's phases, used ONLY to put a plain-language name on a row. A slug
   *  with no matching phase still renders; it just names itself. */
  phases: readonly PhaseSpecJSON[]
  /** Owned by the caller. This component never opens itself. */
  open: boolean
  /** The summary line was activated. */
  onToggle: () => void
  /** A phase-keyed row was activated — take the author to that step. */
  onJumpToStep: (slug: string) => void
}
```

and its three binding rules (`ProblemsTray.tsx:23-29`, `:40-53`):

```tsx
// ── EVERY FINDING RENDERS […] the row shows the server's own `message` verbatim.
//    There is no code table here and no friendly-message map […] (D-182-06).
// ── It does NOT auto-open […] `open` is owned by the caller and this component only
//    ever asks for a toggle.
// XSS (T-184-08-01): every server-authored string […] renders as a plain React text
//    child. React escapes text children; the raw-HTML prop is never used here.
```

**The ⌥ reveal accessor both analogs use** (copy exactly — never a second provider):

```tsx
// Source: ProblemsTray.tsx:117-119 / StepTypePicker.tsx:92-93 (shipped)
// The app-wide reveal, READ (never owned) here — the shipped fail-closed accessor.
// Null outside a provider means plain language, no control, no crash.
const showTechnical = useTechnicalNamesOptional()?.showTechnical ?? false
```

**The reason string comes from the shipped derivation, not from the receipt** (D-187-08). Import it:

```ts
// Source: phaseVocabulary.ts:297-310 (shipped) — the receipt becomes its SECOND consumer
export function groundingCauseOf(phase: PhaseSpecJSON, kbTools: readonly string[]): GroundingCause
```

**Glyph constraint (icon-convention §4, binding).** `✕` is already spoken for on the canvas surface
(`PhaseNodeCard.tsx:56` — "the ✕-delete and ＋-insert affordances"), `⛨` is the governance seal
(`PhaseNodeCard.tsx:440`), `⤳` is the skip branch (`PhaseNode.tsx:238`, `PhaseSpineGraph.tsx:201`),
and `✦`/`✓` are **unshipped proposals**. `✕` as a plain dismiss OUTSIDE the canvas already ships at
`PhaseFormPanel.tsx:766` and `PublishGauntlet.tsx:228` with the a11y treatment to copy:

```tsx
// Source: PhaseFormPanel.tsx:745-766 (shipped)
{/* hidden from the a11y tree so the announcement is the label, not "✕". */}
<span aria-hidden="true">✕</span>
```

---

### `frontend/src/components/workflows/SeedReceipt.test.tsx` (test)

**Analog:** `frontend/src/components/workflows/GovernanceSection.test.tsx`.

**The fixture idiom** (the server list mirrored as a fixture, never owned by the component):

```tsx
// Source: GovernanceSection.test.tsx:48-55 (shipped)
/** The server's list, mirrored here as a FIXTURE only — the component never owns it. */
const KB_TOOLS = [
  "search_documents", "query_documents", "read_document",
  "analyze_document", "get_related_documents",
]
```

**The `?raw` source fence with a positive control** (the house idiom — every new component file in
`components/workflows/` ships one):

```tsx
// Source: GovernanceSection.test.tsx:32, :418-440 (shipped)
import governanceSectionSource from "./GovernanceSection?raw"
// …
describe("GovernanceSection — source purity", () => {
  it("imports nothing from the API client and opens no request", () => {
    expect(governanceSectionSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(governanceSectionSource).not.toMatch(/fetch\(/)
    expect(governanceSectionSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })
  it("takes every sentence from the one vocabulary home rather than authoring any", () => {
    expect(governanceSectionSource).toMatch(/from\s+["']@\/components\/workflows\/definitionOps["']/)
    expect(governanceSectionSource).toMatch(/GROUNDING_LOCK_REFUSAL/)
  })
})
```

**For Req 5's "no node-by-node staging animation" acceptance**, the same fence shape is the cheapest
proof: a negative regex over `SeedReceipt?raw` for `setTimeout` / `setInterval` / a stagger index.
`StepTypePicker.tsx:145` shows the ONE animation this codebase allows on an arriving panel
(`animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none`) — an
entrance on the panel, never per row.

---

### `frontend/src/components/workflows/StarterTemplatePicker.tsx` (component, request-response)

**Analog:** `frontend/src/components/workflows/StepTypePicker.tsx` (218 L) — an exact structural
match: a hand-rolled panel with an `open` prop, an `onDismiss`, and plain-language rows.

**Do not add a dependency.** `frontend/src/components/ui/` contains `alert-dialog`, `dialog`,
`dropdown-menu`, `scroll-area`, `select`, `sheet`, `tooltip` — **there is no `popover.tsx`**. The
shipped picker in this exact folder hand-rolls the panel rather than reaching for Radix, and its
dismissal handling encodes a measured finding that a Radix primitive would not have:

```tsx
// Source: StepTypePicker.tsx:66-77, :95-132 (shipped)
export interface StepTypePickerProps {
  phases: readonly PhaseSpecJSON[]
  index: number
  onChoose: (type: PhaseTypeId) => void
  /** Escape, or a click outside. REQUIRED — a menu with no way out is not a menu. */
  onDismiss: () => void
  /** Closed renders nothing at all: no hidden DOM, no stale focus trap. */
  open: boolean
}
// …
useEffect(() => {
  if (!open) return
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss() }
  window.addEventListener("keydown", onKeyDown)
  return () => window.removeEventListener("keydown", onKeyDown)
}, [open, dismiss])

// ⚠ CAPTURE PHASE, and it is not defensive style — it is the only phase that works
// here. The canvas plane is driven by d3-zoom, which calls `stopPropagation()` on
// mousedown to own its pan gesture […] Measured live: pressing `.react-flow__pane`
// reached window 0 times bubbling and 1 time capturing.
useEffect(() => {
  if (!open) return
  const onPointer = (event: MouseEvent) => {
    const panel = panelRef.current
    if (panel && event.target instanceof Node && !panel.contains(event.target)) dismiss()
  }
  window.addEventListener("mousedown", onPointer, true)
  return () => window.removeEventListener("mousedown", onPointer, true)
}, [open, dismiss])

if (!open) return null
```

> Note for the planner: the capture-phase reasoning is a **canvas-plane** finding. The template
> picker lives on the *describe screen*, where no d3-zoom plane exists — copy the structure, and
> record whether capture is still required or simplify deliberately rather than by omission.

**The row shape** (`StepTypePicker.tsx:159-215`): a `role="menuitem"` button carrying a 3D mark on a
tinted tile, a plain-language line, a `<small>` sub-line, and the technical identifier **only** under
the reveal. For the starter rows, icon-convention §4 finding #36 overrides the mark: **a workflow is
its SPINE, never one glyph** — so the tile slot becomes the starter's phase spine (each starter is
`llm_agent → llm_emit`, measured), not `renderPhaseMark(...)` of any single type.

**The API client is already shipped and un-gated** — do not add a route or a filter:

```ts
// Source: frontend/src/lib/api.ts:1363-1368 (shipped)
export async function listStarterWorkflows(signal?: AbortSignal): Promise<PublishedWorkflow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/starters`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list starter workflows (status ${res.status})`)
  return (await res.json()) as PublishedWorkflow[]
}
```

⚠ **This breaks the `?raw` "no API client import" fence** that `StepTypePicker` and
`GovernanceSection` both carry. Decide deliberately: either the picker fetches (and its fence asserts
`listStarterWorkflows` and *only* that, with a positive control), or the page fetches and hands
`starters` in as a prop (which keeps the leaf pure and matches `ProblemsTray`'s `groups` prop). The
page already mocks `mockListStarters` in `WorkflowBuilderPage.header.test.tsx:60`, so the fetch
already has a home upstream.

---

### `frontend/src/components/workflows/phaseVocabulary.corpus.test.ts` (test, pure-function)

**Analog:** `frontend/src/components/workflows/canvasModel.fixtures.test.ts` — and the corpus SC#5
names **already exists as a checked-in fixture module**. Do not transcribe a second one.

```ts
// Source: __fixtures__/canvasFixtures.ts:286-360 (shipped) — ALL_FIXTURES names, in order:
//   research_summarize / plan_execute_verify / literature_review / doc_qa_human   (the 4 canonical seeds)
//   risk-register / weekly-status-report / compliance-gap-report                   (the 3 Starter Library rows)
//   pm-weekly-status-report / pm-risk-register                                     (the PM pack)
//   eval_coverage (5-phase max) / empty draft / single phase / branching /
//   unresolvable skip / non-contiguous phase_index
```

Its header states the rule the corpus test inherits (`canvasFixtures.ts:12-19`):

```ts
/* TRANSCRIBED, NEVER READ LIVE. Two live database reads on the same day disagreed […]
 * A snapshot test whose input drifts is not a gate. Every entry below is therefore copied
 * from a CHECKED-IN artifact and carries a JSDoc line naming that artifact by `file:line` […]
 * This module performs no I/O of any kind. */
```

**The sweep idiom to copy** (`canvasModel.fixtures.test.ts:17-52, :54-90`):

```ts
describe("canvasFixtures — the corpus itself (SC#4 coverage)", () => {
  it("registers at least 14 fixtures in the sweep list", () => {
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(14)
  })
  it("names a source for every fixture (transcribed, or explicitly hand-authored)", () => {
    for (const f of ALL_FIXTURES) {
      expect(f.source.length).toBeGreaterThan(0)
      expect(/:\d+|hand-authored, test-only/.test(f.source)).toBe(true)
    }
  })
})

describe.each(ALL_FIXTURES)("toCanvas sweep — $name", ({ phases }) => { /* per-fixture assertions */ })
```

**The corpus test is `nodeTitle()`-over-fixtures, NOT a DOM scrape** (D-187-16). `describe.each(ALL_FIXTURES)`
+ `nodeTitle(phase, ctx)` is the whole shape. Two hard notes the planner must carry into the test:

1. `canvasFixtures.ts` transcribes **only** `slug`, `phase_index`, `config.phase_type`,
   `config.citation_policy` and `validators[]` — it deliberately omits `skill_ref`, `folder_scope`
   and template assets (`canvasFixtures.ts:28-32`). The derived tier reads exactly the omitted
   fields. **The corpus must be extended, and each new field carries its own `file:line` JSDoc
   source line** or the fixture module's own "names a source" test fails.
2. `plan_execute_verify` (`canvasFixtures.ts:53-66`) is the documented D-187-15 exception: `plan`
   and `verify` are both bare `llm_single`, so both resolve to `null` and render `"Write it up"`.

**A second, independent corpus already exists** for a wider read:
`__fixtures__/corpusDump.json` (108 redacted definitions, phases only, with a `_provenance` block),
consumed by `canvasModel.roundtrip.test.ts:41, :100-106`. Its provenance-assertion idiom is the
template if the plan wants a broader SC#5 check-1 sweep.

---

### `backend/tests/unit/test_187_armed_checkpoint_property.py` (test, property)

**Analog A — the observable ("was the body invoked"), driving the real function:**
`backend/tests/unit/test_pre_post_timing.py:60-108`. This is the exact harness the SC#6 property
needs, already shipped and green:

```python
# Source: backend/tests/unit/test_pre_post_timing.py:60-108 (shipped)
def test_pre_gate_runs_before_body_and_routes_failure():
    body_ran = {"value": False}

    async def _fake_execute_phase(phase, accumulated, ctx):
        body_ran["value"] = True
        return {"text": "body output"}

    phase = PhaseSpec(
        slug="p", phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="freshness", timing="pre", on_failure="fail_run")],
    )

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
    assert body_ran["value"] is False
```

**Analog B — the armed fixtures and the mocked rendezvous:**
`backend/tests/unit/test_ask_user_disposition.py:31-70, :86-120`.

```python
# Source: backend/tests/unit/test_ask_user_disposition.py:41-70 (shipped)
def _armed_phase(slug="send-the-notice"):
    """Phase 185 (GOVERN-03) — a phase carrying the ARMED action-risk pre-gate, as
    ``grounding.effective_phase`` synthesizes it […]"""
    return PhaseSpec(
        slug=slug, phase_index=1,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="action_risk_approval", timing="pre",
                                  on_failure="ask_user", max_retries=0,
                                  config={"prompt": "Step 2 of 4 is about to run."})],
    )

_ARMED_FINDING = "action_risk:approval|Step 2 of 4 is about to run."

def _ctx():
    return SimpleNamespace(
        supabase=None, thread_id=None, current_user={"id": uuid4()},
        producer_run_id=uuid4(), emit=AsyncMock(),
    )
```

```python
# Source: test_ask_user_disposition.py:96-115 (shipped) — the rendezvous mock + receipt assertion
subscribe = AsyncMock(return_value={"kind": "response", "response_text": "Proceed anyway"})
with patch.object(harness_engine, "write_audit", write_audit), \
     patch("app.services.ask_user_service.subscribe_for_response", subscribe):
    outcome = asyncio.run(harness_engine._resolve_failure_with_ask_user(...))
assert outcome is None                 # pre-gate Proceed → run the body
assert write_audit.await_count == 1
```

**After the hoist, `_armed_phase` must become an `action_risk_armed=True` phase with the author's
own validators** — the fixture's whole shape changes and 8 shipped tests in this file drive it.
Plan that edit as a named task, not a side effect.

**Quantification without `hypothesis`** — measured: `hypothesis` is **not** a backend dependency and
no `backend/tests/unit` file imports `itertools`. So the "property" is a `pytest.mark.parametrize`
over an explicitly built validator-set space. The space RESEARCH.md requires, minimum:
`[]`, `[pre/ask_user]`, `[pre/fail_run]` (the Pitfall-4 fail-open), `[pre/skip_to_phase:X]`,
`[post/*]`, `[pre/ask_user, post/citations_required]`, and multi-pre permutations.

**The negative assertion** (the Phase-185 BLOCKER was a *false receipt*, not a missing prompt): on a
refusal, `write_audit` is awaited **zero** times with `event_type="validator_ask_user_approved"`.
`test_ask_user_disposition.py:539` (the typed-refusal / T-185-04-01 proof) is the shape to mirror.

---

### `backend/tests/unit/test_187_authoring_step_names.py` (test, integration + roster)

**Analog:** `backend/tests/unit/test_103_nl_generate.py` (332 L) — the same function, the same
mocking boundary, the same budget assertions Req 2 must not regress.

```python
# Source: backend/tests/unit/test_103_nl_generate.py:53-80 (shipped)
def _patch_grounding(monkeypatch):
    """Patch the grounding accessors inside workflow_authoring so no live folder/tool/
    skill/DB read happens […]"""
    import app.services.workflow_authoring as wa
    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(), set())
    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)
    async def _fake_fidelity(*_args, **_kwargs):
        return None
    monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)
    monkeypatch.setattr(wa, "resolve_authoring_model", lambda settings: "claude-opus-4-8")
```

```python
# Source: test_103_nl_generate.py:95-117 (shipped) — the provider-call-budget idiom Req 2 reuses
calls: list[int] = []
async def _fake_forced_emit(**kwargs):
    calls.append(1)
    return {"emitted": _valid_wd(), "failure": None}

# forced_emit is imported function-locally inside generate_workflow_definition →
# patch it on the module it is imported FROM.
import app.services.forced_emit as fe
monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

result = await wa.generate_workflow_definition(
    describe="…", supabase=object(), user_id="u1", settings=object(),
)
assert len(calls) == 1  # exactly ONE provider call
```

⚠ **Note `settings=object()` at `:114`.** This shipped test already proves RESEARCH.md's finding:
`settings` is a **parameter**, so each SC#10 roster row passes
`SimpleNamespace(harness_authoring_model="<id>")` — **no monkeypatch of a global, no contamination**.
D-187-13's "monkeypatches `settings.harness_authoring_model` per row" is superseded by this.

**The roster half has NO analog** — see §"No Analog Found".

---

### The flag-OFF describe-screen pin (D-181-01)

**Analog (named by CONTEXT):** `frontend/src/pages/WorkflowBuilderPage.header.test.tsx:296-322`.

```tsx
// Source: WorkflowBuilderPage.header.test.tsx:296-322 (shipped)
/**
 * The three bands' normalised `outerHTML`, outermost first, captured from the UNMODIFIED
 * page. It is deliberately verbatim rather than a shape assertion: the promise D-181-01
 * makes is about the markup a shipped user receives, and a "looks about right" matcher
 * cannot break when a wrapper is introduced or a band is re-parented.
 */
const FLAG_OFF_HEADER_MARKUP = [ /* three normalised outerHTML literals */ ].join("\n")

describe("Builder header, canvas flag OFF — the markup itself is pinned", () => {
  it("matches the captured flag-off header byte for byte", async () => {
    const { container } = await openDraftBuilder(OFF_VARIANTS[0].value)
    expect(headerMarkup(screen.getByTestId("builder-grid"), container)).toBe(FLAG_OFF_HEADER_MARKUP)
  })

  it("an OPERATOR-LIKE map produces the IDENTICAL markup (D-181-01, everyone included)", async () => {
    // Asserted as an equality against the same literal rather than as a second copied
    // literal — two literals can drift apart […]
    const { container } = await openDraftBuilder(OFF_VARIANTS[2].value)
    expect(headerMarkup(screen.getByTestId("builder-grid"), container)).toBe(FLAG_OFF_HEADER_MARKUP)
  })
})
```

Two properties to carry across verbatim: **(a) the operator-like variant is asserted against the
SAME literal**, never a second copy; **(b) the pin is written against the UNMODIFIED page first**
(`header.test.tsx:11-15`: *"Written first, against the UNMODIFIED page, its later failure means a
real regression rather than a new test finding its feet"*).

The file also already hoists the whole api surface the describe screen needs — reuse this exact
enumeration rather than a partial factory mock (`header.test.tsx:50-78`): `mockGenerate`,
`mockListFolders`, `mockListSkills`, `mockValidate`, `mockBundle`, **`mockListStarters`**, …

**Why the pin is owed** (measured, RESEARCH §"D-181-01 hazard"): `describeScreen` at
`WorkflowBuilderPage.tsx:1404-1483` is built on BOTH flag branches — only the `BuilderHeaderBar`
wrapper at `:1486-1493` is flag-dependent. A template line added to `:1450-1465` ships flag-OFF
unless it is `canvasEnabled`-gated, and **no shipped test would catch it**.

---

## Pattern Assignments — MODIFIED FILES

### `frontend/src/components/workflows/phaseVocabulary.ts`

**Current state — the function the derived tier goes into:**

```ts
// Source: phaseVocabulary.ts:160-174 (shipped)
/**
 * The node title (D-183-06). A real `phase.name` wins when it trims non-empty;
 * otherwise the plain-language sentence for the type; otherwise the raw type string
 * echoed honestly (never invent a sentence for a type we do not know […]).
 *
 * The SLUG NEVER appears in this string. It lives behind the ⌥ Technical-names
 * reveal, via `technicalTitle`.
 */
export function nodeTitle(phase: PhaseSpecJSON): string {
  const name = phase.name?.trim()
  if (name) return name
  const type = phase.config.phase_type
  return PHASE_TYPE_SENTENCES[type] ?? type
}
```

**The pattern the new tier must copy — the flat-core / phase-adapter pair** (`:239-310`), including
its defensive reads, because `PhaseConfigJSON` is the LOOSE JSONB read shape:

```ts
// Source: phaseVocabulary.ts:239-245, :288-310 (shipped)
/**
 * The flat inputs the cause is a pure function of. Flat rather than phase-shaped
 * because the panel holds these five values as separate props […] while the canvas
 * holds a whole phase — `groundingCauseOf` below is the phase-shaped adapter, so BOTH
 * consumers reach the same body and neither owns a second copy of the branch order.
 */
export interface GroundingInputs { /* … */ }

/**
 * The phase-shaped adapter over `groundingCause` […] it declares no branch of its own […]
 * `available_tools` and `citation_policy` are read defensively: `PhaseConfigJSON`
 * is the LOOSE definition-JSONB read shape, so a hand-edited row can carry either
 * as any JSON value, and a projection must not crash on one.
 */
export function groundingCauseOf(phase: PhaseSpecJSON, kbTools: readonly string[]): GroundingCause {
  const rawTools = phase.config.available_tools
  const citationPolicy = phase.config.citation_policy
  return groundingCause({
    phaseType: phase.config.phase_type,
    availableTools: Array.isArray(rawTools) ? rawTools.filter((t): t is string => typeof t === "string") : [],
    kbTools,
    groundingEscalated: phase.grounding_escalated === true,
    citationPolicy: typeof citationPolicy === "string" ? citationPolicy : undefined,
  })
}
```

**The branch-order comment idiom is load-bearing** and must be reproduced for the D-187-04
precedence (`bound skill → template → folder scope → human input → null`):

```ts
// Source: phaseVocabulary.ts:265-286 (shipped)
export function groundingCause(inputs: GroundingInputs): GroundingCause {
  // (1) DETECTED — the step reads your documents. Structural, never stored, and it
  //     wins over both branches below, which is what makes the lock one-way.
  // (2) ALREADY-SET — […]
  // (3) ESCALATED — […]
  return null
}
```

**The two module-level contracts the edit must not break** (`:31-40`): *"this module is pure and
client-side. It imports NOTHING from the API client"* and the CANVAS-01 **TOTALITY** contract
(*"every exported resolver is total […] NEVER throw"*). The injected name context is a parameter for
exactly this reason — the module cannot fetch.

**The docblock to correct in the same edit** (CONTEXT requires it):

```ts
// Source: phaseVocabulary.ts:121-126 (shipped — the figure is REFUTED)
/**
 * D-183-06 — the plain-language business sentence per `phase_type`, anchored to
 * sketch 137-D. Only 10 of 119 live phases carry a real `phase.name`, so this   ← REFUTED
 * fallback is the DOMINANT node face, not an edge case. […]
 */
```
Measured replacement: **0 of 57 phases across 27 well-formed rows** (145 of 172 rows are
double-encoded JSON strings the app cannot parse). The *conclusion* the docblock draws is
strengthened, not weakened, by the correction.

⚠ **NAME COLLISION.** `frontend/src/components/workflows/deriveTier.ts` (129 L) already exists — it
is the Phase-103 **strictness-tier** resolver (`TIERS.LOOSE`, commit `9f6cac92`). Do **not** name the
new function `deriveTier` / `deriveTierOf`. `derivedFaceOf` / `derivedFace` keeps the two legible.

### `frontend/src/components/workflows/canvasModel.ts`

**The exact precedent D-187-05 copies — extract it verbatim as the template:**

```ts
// Source: canvasModel.ts:295-332 (shipped, Phase 185 / D-185-09)
/**
 * Project a definition's phases onto the canvas.
 *
 * PURE (D-183-12). The input array is never mutated […]
 *
 * `options.kbTools` (Phase 185 / D-185-09) is the server's KB-reading tool list,
 * passed IN so this module stays PURE — it fetches nothing and hardcodes nothing;
 * the safety-DEFINING list has one home and it is the server's. It is OPTIONAL and
 * defaults to EMPTY, and the default is the safe direction stated out loud: an
 * unread palette marks NOTHING rather than un-marking something […]. Every
 * shipped caller that omits it therefore projects exactly as it did before.
 */
export interface ToCanvasOptions {
  /** The server-supplied KB-reading tool names. Absent or empty marks nothing. */
  kbTools?: readonly string[]
}

/** Module-scope so an omitted `kbTools` hands the same reference on every call —
 *  the projection must be deterministic to the byte (the snapshot gate depends
 *  on it) and a fresh `[]` per call is a needless identity change. */
const NO_KB_TOOLS: readonly string[] = Object.freeze([])

export function toCanvas(phases: PhaseSpecJSON[], options: ToCanvasOptions = {}): CanvasProjection {
  const nodes: CanvasNode[] = []
  const edges: CanvasEdge[] = []
  const kbTools = options.kbTools ?? NO_KB_TOOLS
  // …
}
```

**The frozen module-scope default is not decoration** — `canvasModel.fixtures.test.ts:86` holds a
`toMatchSnapshot()` over `toCanvas(phases)`. A fresh object per call is a needless identity change.

**The threading point:**

```ts
// Source: canvasModel.ts:277-291 (shipped)
/** Resolve every face value a phase card needs, once. */
function buildPhaseData(phase: PhaseSpecJSON, kbTools: readonly string[]): PhaseNodeData {
  const phaseType = phase.config.phase_type
  return {
    slug: phase.slug, phaseIndex: phase.phase_index, phaseType,
    title: nodeTitle(phase),                                   // ← gains the name ctx
    technicalTitle: technicalTitle(phase),
    subtitle: PHASE_TYPE_SUBTITLES[phaseType] ?? "",
    grounded: isGrounded(phase, kbTools),
    armed: isArmed(phase),
    waitsForYou: waitsForYou(phase),
  }
}
```

`buildPhaseData` is called once, at `canvasModel.ts:348`. `toCanvas` has exactly **one** production
call site (`WorkflowCanvas.tsx:879`); everything else is a test.

### `frontend/src/components/workflows/PhaseNode.tsx` + `PhaseSpineGraph.tsx`

**Canvas — the swap, adapter-only:**

```tsx
// Source: PhaseNode.tsx:140-144, :193-206 (shipped)
function PhaseNodeImpl({ data, selected }: NodeProps<PhaseCanvasNode>) {
  // The ⌥ reveal rides on `data` (set by the shell), so this leaf has no context
  // dependency of its own and there can never be a second technical-names state.
  const technical = data.technical === true
  const title = technical ? data.technicalTitle : data.title      // ← Req 4 moves THIS
  // …
  return <PhaseNodeCard … title={title} subtitle={data.subtitle} … />
}
```

**The comment that must be maintained, not left** (`PhaseNode.tsx:183-192`):

```tsx
// `status`, `technicalLine` and `stepNumber` are still deliberately NOT passed: Wave 0
// landed the seam and Phase 188 lands those. `verdict` WAS in that list until 184-10
// and `grounded` until 185-09 — the line is corrected each time rather than left,
// because a comment that still names a slot the component now fills is the same defect
// as a false docblock.
```

`technicalLine` stays unpassed (SPEC + D-187-16). `PhaseNodeCard.tsx` is **not modified**: a third
badge is a typecheck error (`BadgeSlots` max-2 tuple union, `PhaseNodeCard.tsx:148`) and no focusable
control may live inside the card (`PhaseNodeCard.tsx:50`).

**Spine — TITLE agreement only (D-187-16). The current line:**

```tsx
// Source: PhaseSpineGraph.tsx:123-125 (shipped)
// Resolved ONCE and used in BOTH the visible title and the accessible
// name, so they can never drift apart (WCAG 2.5.3 label-in-name).
const title = showTechnical ? technicalTitle(phase) : nodeTitle(phase)
```

**Measured: the spine has no subtitle slot.** Its second and third elements are raw and
unconditional, reveal-OFF included — leave them:

```tsx
// Source: PhaseSpineGraph.tsx:177-189 (shipped)
<span data-testid="node-title" className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
  {title}
</span>
<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
  {phase.config.phase_type}          {/* RAW type — unconditional */}
</span>
<span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
  phase_index {phase.phase_index}     {/* RAW index — unconditional */}
</span>
```
`:164`'s `aria-label` also carries the raw type. This is why SC#5 check 1 is a **pure-function**
assertion, never a DOM scrape.

### `frontend/src/components/workflows/definitionOps.ts`

**The one config-edit home the demote hooks into:**

```ts
// Source: definitionOps.ts:191-210 (shipped)
/**
 * Merge a phase-form patch into one phase's config, immutably.
 *
 * Deliberately does NOT renumber and does NOT reorder: a config edit cannot change run
 * order, and re-sorting here would make a keystroke in the inspector move a card.
 */
export function patchPhaseConfig(
  phases: readonly PhaseSpecJSON[], slug: string, patch: Readonly<Record<string, unknown>>,
): PhaseSpecJSON[] {
  return phases.map((p) => (p.slug === slug ? { ...p, config: { ...p.config, ...patch } } : p))
}
```

**The type-narrowing precedent for a PhaseSpec-level write** (the demote clears `name` and the
provenance marker — both PhaseSpec-level siblings, not config members):

```ts
// Source: definitionOps.ts:212-243 (shipped)
/** The only two fields `setPhaseGovernance` may write (D-185-10). */
export type PhaseGovernancePatch = Readonly<{
  grounding_escalated?: boolean
  action_risk_armed?: boolean
}>
// The parameter type admits ONLY the two booleans, so growing this into a general
// `PhaseSpec` writer is a typecheck error rather than a review comment (T-185-06-02).
export function setPhaseGovernance(
  phases: readonly PhaseSpecJSON[], slug: string, patch: PhaseGovernancePatch,
): PhaseSpecJSON[] {
  return phases.map((p) => (p.slug === slug ? { ...p, ...patch } : p))
}
```

**`nodeTitle` is already consumed here** (the D-187-05 "signature widening" question in Claude's
Discretion is about exactly this call):

```ts
// Source: definitionOps.ts:271-287 (shipped)
export function canRemovePhase(phases: readonly PhaseSpecJSON[], slug: string): RemovalOutcome {
  // …
  const lead = `"${nodeTitle(referrers[0])}"`
  // …
}
// This is a SHAPE predicate. It consults no server, produces no severity and no code.
```

**The copy-constant home.** `definitionOps.ts` is where every user-visible sentence in this folder
lives (`STRANDING_REASON`, `GROUNDING_LOCK_REFUSAL`, `ACTION_RISK_ARM_LABEL`, …). The receipt's
sentences and the picker's line go here, not into the components.

### `frontend/src/pages/WorkflowBuilderPage.tsx` — the D-187-14 budget

**The gated-mount precedent to hold the diff to** (the shape CLAUDE.md praises):

```tsx
// Source: WorkflowBuilderPage.tsx:1790-1802 (shipped, Phase 185)
// D-14 — SPREAD-CONDITIONAL, never `rails={canvasEnabled ? rails : undefined}`.
// With the flag off the prop must be genuinely ABSENT from the element, not
// present-and-undefined […]
//
// Phase 185's `onGovernanceChange` rides the SAME conditional rather than
// arriving as a second, unconditional prop. […] adding an always-on governance
// prop would leak the canvas contract into the Spine view, which is precisely
// what D-181-01's byte-identity promise forbids.
{...(canvasEnabled ? { rails, onGovernanceChange } : {})}
```

**The flag-branch precedent** (for the receipt's mount above the graph column):

```tsx
// Source: WorkflowBuilderPage.tsx:1551-1555 (shipped)
// D-183-03 — the strip renders ONLY when the flag resolves strictly on. With the
// flag off `graphChild` IS the grid's first child, exactly as it ships today: no
// wrapper element, no strip, no reserved space, nothing of the canvas in the DOM.
const graphColumn = canvasEnabled ? ( … ) : graphChild
```

**The arrival seam the receipt keys on** (one state transition, one DOM batch — the receipt must not
imply progress):

```tsx
// Source: WorkflowBuilderPage.tsx:1181-1188 (shipped)
if (result.ok) {
  // SINGLE STATE TRANSITION: commit the complete definition + "drafted" in
  // ONE store set. The graph renders whole, in one DOM batch (no timed reveal).
  const def = result.definition as unknown as BuilderDefinition
  if (projectFolderId && !def.project_folder_id) def.project_folder_id = projectFolderId
  store.getState().setDrafted(def)
}
```

`onDraft` is also reachable from the `autoDraft` hand-off (`:1205-1216`) — Claude's Discretion says
**yes, show the receipt there too**; state it in the plan.

**The describe-box seam the picker writes** — measured: it is `setDescribe`, NOT `initialDescribe`
(which is an upstream prop at `:512`, not settable from inside the page):

```tsx
// Source: WorkflowBuilderPage.tsx:558, :1416-1424 (shipped)
const [describe, setDescribe] = useState(initialDescribe ?? "")
// …
<textarea aria-label="business requirement" value={describe}
          onChange={(e) => setDescribe(e.target.value)} … />
```

**The one line at rest goes under the CTA**, beside the shipped hint:

```tsx
// Source: WorkflowBuilderPage.tsx:1450-1464 (shipped)
<div className="flex flex-col items-center gap-3">
  <button type="button" disabled={!canDraft} onClick={onDraft} …>
    {builderPhase === "composing" ? "Composing…" : "Draft the workflow"}
  </button>
  <p data-testid="describe-hint" className="text-center text-[13px] text-muted-foreground"> … </p>
</div>
```

**The name maps the derived tier needs are already built here** — do not fetch again
(`:1107-1133`, state at `:587`/`:589`, consumed by `PhaseFormPanel` at `:1782-1783`). Both graph
views are mounted by this same component (`WorkflowCanvas` at `:1516`, `PhaseSpineGraph` at `:1544`).

### `backend/app/models/harness.py` — the provenance marker

**The exact shape to copy, with its reasoning:**

```python
# Source: backend/app/models/harness.py:201-235 (shipped)
class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig
    validators: list[ValidatorSpec] = Field(default_factory=list)
    name: str | None = None  # REQ-3 — additive; serializes into the definition JSONB; pre-103 rows validate with it absent

    # (a) ADDITIVE / ZERO-MIGRATION, exactly like `name` above: a pre-185
    #     `workflow_definitions` JSONB row carrying NEITHER key still
    #     `model_validate()`s, and both read False. `bool = False` rather than
    #     `bool | None = None` is the one deliberate deviation from `name`'s
    #     spelling — D-185-08 requires absence to be unambiguous, so there is
    #     exactly one way to say "not set".
    # …
    #     Nothing here is a `model_validator` on purpose — the draft save path persists
    #     `model_dump(mode="json")`, so a derivation living in this model would be
    #     BAKED into the JSONB and would contradict (b) permanently.
    grounding_escalated: bool = False   # GOVERN-01 / D-185-08 — the author hand-locked this step
    action_risk_armed: bool = False     # GOVERN-03 / D-185-08 — stop and ask a human before this step runs
```

**The `ValidatorSpec.kind` Literal — the additive-only policy that says KEEP `action_risk_approval`:**

```python
# Source: backend/app/models/harness.py:175-198 (shipped)
class ValidatorSpec(_StrictBase):
    """… Additive in the same sense as 102's five: no stored row names it, so every
    pre-185 row still validates. It is registered here because ``ValidatorSpec`` is a
    ``_StrictBase`` and construction validates — a synthesized spec of an unlisted kind
    could not be built at all."""
    kind: Literal[ …, "action_risk_approval" ]  # 185 GOVERN-03 (D-185-12) — the armed pre-gate
```

### `backend/app/services/harness/grounding.py` — the append D-187-03 removes

**Preserve this docblock's reasoning when removing the armed arm** (`:877-915`, quoted in part):

```python
# Source: backend/app/services/harness/grounding.py:877-915 (shipped, D-185-05)
def effective_phase(phase, *, total_phases: int):
    """The phase the ENGINE runs: the authored validators PLUS any synthesized gates.

    **NEVER PERSISTED. Called from ``harness_engine.py``'s ``spec_by_slug`` seam ONLY.**
    …
    **This must never become a Pydantic ``model_validator``** (RESEARCH L-2) […] a
    ``@model_validator(mode="after")`` on ``PhaseSpec`` would bake the synthesized
    gate permanently into the stored definition on the very next save […]

    APPEND, NEVER PREPEND. ``harness_engine`` seeds the WR-03 retry bound from
    ``validators[0].max_retries``; prepending would change that seed for every phase
    that already carries authored validators. […]

    RETURNS THE PHASE ITSELF WHEN THERE IS NOTHING TO ADD — identity, by reference […]
    That is what makes "byte-identical when unset" (D-14) a STRUCTURAL property […]

    D-185-05 — WHEN THE AUTHOR ALREADY DECLARED A ``citations_required`` VALIDATOR, BOTH
    SPECS RUN. […]"""
```

**The two appends, measured** — the armed one is `:920-933` (the ROADMAP's `:951-953` citation is
wrong; `:951-953` is `if not extra: return phase` + the `model_copy`):

```python
# Source: grounding.py:920-933 (shipped) — THE APPEND D-187-03 REMOVES
if getattr(phase, "action_risk_armed", False):
    extra.append(ValidatorSpec(kind="action_risk_approval", timing="pre",
                               on_failure="ask_user", max_retries=0,
                               config={"prompt": _approval_sentence(phase, total_phases)}))

# Source: grounding.py:935-949 (shipped) — timing="post". CONFIRMED: it STAYS.
if grounding_cause(phase) == "detected":
    extra.append(ValidatorSpec(kind="citations_required", timing="post",
                               on_failure="fail_run", max_retries=2,
                               config={"mode": "retrieved_and_cited"}))
```

**The sentence composer the hoisted checkpoint calls directly** (never re-author it — its honesty
rules are asserted character-identically by `test_185_engine_attachment.py:407-451`):

```python
# Source: grounding.py:850-874 (shipped)
def _approval_sentence(phase, total_phases: int) -> str:
    """… It never says *approved*, *safe*, or *proven*: it states POSITION (which step,
    out of how many), IDENTITY (what the step is called) and CONSEQUENCE (the run is
    stopped here) […] Pure; no I/O."""
    label = getattr(phase, "name", None) or phase.slug
    return (f'Step {phase.phase_index + 1} of {total_phases}, "{label}", is about to run. '
            f"This step is marked as needing your approval first. "
            f"The run is waiting here and will not continue until you answer.")
```

⚠ `total_phases` is **not** in `_run_phase_with_gates`'s scope — it lives in `run_workflow`
(`harness_engine.py:1338`, `_total = len(definition.phases)`). Threading it is a signature change on
a function with many direct unit callers (`test_pre_post_timing.py:99`, `:135`,
`test_185_engine_attachment.py:629`, `test_dual_mode_wiring.py:1058`). Use an optional keyword with a
safe default so those callers stay valid.

### `backend/app/services/harness_engine.py` — the hoist

**The block being replaced, with the bypass comment at `:739`:**

```python
# Source: backend/app/services/harness_engine.py:695-750 (shipped)
pre = await run_gates(phase, {"_phase_inputs": accumulated_outputs}, ctx, timing="pre")
if not pre.passed:
    # ── Phase 185 (GOVERN-03 / RESEARCH L-5) — WAITING IS NOT FAILING ────────
    # […] Announcing ``gate_failed`` first would tell the ledger and the frontend that
    # something went wrong when nothing did — and the audit ledger's own vocabulary rule
    # (consequence ≠ receipt) makes that a correctness defect, not cosmetics.
    if _is_action_risk_finding(pre.error_message):          # ← D-187-03 DELETES the sniff
        await write_audit(pool, run_id, user_id=_audit_user_id,
                          event_type="action_risk_pending",
                          metadata={"phase": phase.slug, "timing": "pre"})
        await _emit(redis, stream_run_id, "action_risk_pending", phase=phase.slug)
    else:
        await write_audit(pool, run_id, user_id=_audit_user_id, event_type="gate_failed", …)
        await _emit(redis, stream_run_id, "gate_failed", …)
    outcome = await _resolve_failure_with_ask_user(
        phase, pre.error_message, 0, pre.validator_index,
        run_id=run_id, pool=pool, redis=redis, ctx=ctx,
        _audit_user_id=_audit_user_id, stream_run_id=stream_run_id, is_pre=True,
    )
    if outcome is not None:
        return outcome  # fail_run / skip_to_phase / aborted ask_user
    # outcome is None → ask_user Proceed: fall through and run the body.   ← :739 THE BYPASS

attempt = 0                                                               # ← :741
last_output = None
while True:                                                               # ← :743 (D-187-17: BEFORE this)
    output = await asyncio.wait_for(_execute_phase(...), timeout=wall_clock)   # ← :747 THE BODY
```

**The audit + emit pair the hoisted checkpoint reuses is right there** (`:712-721`) — reuse the two
event types verbatim (`action_risk_pending`, `validator_ask_user_approved`). **`harness_audit`'s
`event_type` is a closed CHECK of 23 values and this phase ships zero migrations.**

**The predicate D-187-03 deletes, and the docblock that explains why the reading must stay
per-CALL inside the helper:**

```python
# Source: harness_engine.py:925-941 (shipped)
_ACTION_RISK_FINDING_PREFIX = "action_risk:approval|"

def _is_action_risk_finding(error_message: str | None) -> bool:
    """True when a failing gate is the ARMED action-risk checkpoint (GOVERN-03).

    THE ONE READING of "this gate is about to WAIT for a person, not fail". It is
    taken off the FINDING rather than off the phase because the finding is what
    identifies WHICH validator failed — an armed phase can carry authored gates too,
    and only the armed one gets the armed treatment. Every other finding (freshness,
    citations, an authored regex) returns False here and keeps byte-identical
    behaviour on both call sites."""
    return (error_message or "").startswith(_ACTION_RISK_FINDING_PREFIX)
```

**The fail-open to close (Pitfall 4 — same class as the Phase-185 BLOCKER):**

```python
# Source: harness_engine.py:944-982 (shipped)
async def _resolve_failure_with_ask_user(
    phase, error_message: str, attempt: int, failed_idx: int | None, *,
    run_id, pool, redis, ctx, _audit_user_id, stream_run_id=None,
    produced_output=None, is_pre=False,
) -> PhaseOutcome | None:
    """… If the failing validator's ``on_failure`` is NOT ``ask_user``, delegate to the
    sync ``_route_on_failure`` […]"""
    disp = _parse_on_failure(_failing_on_failure(phase, failed_idx))
    if disp.kind != "ask_user":
        return _route_on_failure(phase, error_message, attempt, failed_idx)   # ← :979-982 MUST BE
                                                                              #   SHORT-CIRCUITED
                                                                              #   when is_action_risk
```

```python
# Source: harness_engine.py:993-1001 (shipped) — the per-call reading, replaced by a PARAMETER
# ONE predicate; every Phase-185 delta below branches on it. Read off the FINDING […]
# rather than off the phase, because the finding is what identifies WHICH validator
# failed — an armed phase can also carry authored gates, and only the armed one gets this
# disposition. An unarmed ``llm_human_input`` step and every freshness gate keep
# byte-identical behaviour […]
is_action_risk = _is_action_risk_finding(error_message)
```
→ becomes a keyword-only `is_action_risk: bool = False` parameter. **The five Phase-185 deltas below
it must be untouched**, in particular the exact-match allow-list at `:1194-1198` (the T-185-04-01
fail-open fix).

**The second armed reading that already exists — reconcile, do not claim uniqueness:**

```python
# Source: harness_engine.py:2148-2170 (shipped)
def _is_armed_action_risk(active_phase: dict, definition) -> bool:
    """True if the active phase row is an ARMED action-risk step (Phase 185 / L-7).
    …
    The two predicates are INDEPENDENT and deliberately kept so: this one is a second
    named reading beside ``_is_llm_human_input``, not a widening of it. […]"""
    for spec in getattr(definition, "phases", None) or []:
        if getattr(spec, "slug", None) == slug:
            return bool(getattr(spec, "action_risk_armed", False))
    return False
```
`test_185_engine_attachment.py:737-760` (`test_the_two_resume_predicates_are_independent`) pins it.

### `backend/app/api/workflows.py` — D-187-11's `incomplete` verdict

**The exact analog to copy — a ROUTE-minted finding, appended outside the sealed block:**

```python
# Source: backend/app/api/workflows.py:648-669 (shipped)
# (3) the D-13 business-requirement invariant — same predicate publish stage 1 calls,
# same named-failure prose.
if grounding.business_requirement_missing(body):
    findings.append({
        "code": "business_requirement",
        "phase": None,
        "message": ("a workflow must declare exactly one business_requirement before publish"),
    })

# (4) the WR-04 interactive-phase pre-run block — reused verbatim (one finding per phase).
findings.extend(
    {"code": "interactive_phase", "phase": f.get("phase"), "message": f.get("message")}
    for f in publish_service._interactive_phase_failures(body)
)
```

**Why the new check belongs beside these two and NOT inside the seal** (`:600-605`):

```python
# WHY THE PURE CHECKS LIVE OUTSIDE THE SEAL BELOW: lint, the D-13 business-requirement
# invariant and the interactive-phase check need NO registry and cannot fail, so a
# registry blip must cost the author the three GROUNDING rules only — not the whole
# validation.
```

**The two registrations the new code needs — measured:**

```python
# Source: workflows.py:459-479 (shipped)
# The two codes the ROUTE mints itself — neither owning module emits them:
_ROUTE_ASSIGNED_CODES: frozenset[str] = frozenset({"business_requirement", "interactive_phase"})

# The NOT-YET-READY set (D-182-03): the author is still building, not broken. A product
# decision, so these stay literals — deriving them would make the taxonomy unreadable.
_INCOMPLETE_CODES: frozenset[str] = frozenset({
    "input_unsatisfied", "business_requirement", "interactive_phase",
})
```

**What happens if you forget** (`workflows.py:530-539`) — this is not theoretical, `_ERROR_CODES` is
**derived** by subtraction so an unregistered code lands in the error bucket:

```python
# (4) UNKNOWN — fail LOUD, never soft (WR-05).
logger.warning(
    "POST /workflows/validate: unrecognised verdict code %r — classifying it as 'error' "
    "(fail-closed). Add it to the canonical set of the module that emits it "
    "(reachability.LINT_CODES / grounding.GROUNDING_VERDICT_CODES / "
    "workflows._ROUTE_ASSIGNED_CODES) and, if it is a still-building condition rather "
    "than a break, to workflows._INCOMPLETE_CODES.", code,
)
return "error"
```

**The machine that catches the omission** — `test_182_severity_codes.py` scans real emit sites:

```python
# Source: backend/tests/unit/test_182_severity_codes.py:41-58, :244-282 (shipped)
_LINT_EMIT_RE = re.compile(r'LintError\(\s*"([a-z_]+)"')
_VERDICT_EMIT_RE = re.compile(r'"code":\s*"([a-z_]+)"')
# …
assert set(workflows._ROUTE_ASSIGNED_CODES) == { … }     # ← this literal set must be updated
assert set(workflows._ROUTE_ASSIGNED_CODES).isdisjoint(owned)
```
Note `test_owning_modules_publish_their_canonical_code_sets` and
`test_every_known_code_classifies_exactly_as_the_pinned_table` (`:141`) hold **literal** expectations
— the new code lands in both, in the same commit.

**The intersection the check reads has ONE home** (`grounding.py:797-803` / `:806-840`) — import
`grounding.grounding_cause(phase)`, never a local KB-tool tuple.

### `backend/app/services/workflow_authoring.py` — the per-step `name`

**The sentence Req 2 extends — the constant's LAST line:**

```python
# Source: backend/app/services/workflow_authoring.py:87-88 (shipped; the constant starts at :57)
"- Give each phase a short `slug` and a sequential `phase_index` starting at 0; set "
"the definition `slug`, `version` (1), `name`, and `status` ('draft')."
```

The file's own header licenses the change and bounds it: *"Copy is Claude's discretion (the contracts
are locked, not the prose)"* (`:54-56`). The response schema is unchanged — `PhaseSpec.name` already
exists inside the `extra="forbid"` union.

**The resolver SC#10 drives (env-only, confirmed):**

```python
# Source: workflow_authoring.py:92-114 (shipped)
def resolve_authoring_model(settings) -> str | None:
    """… Resolution order:
      1. ``settings.harness_authoring_model`` if set.
      2. else the first registry default in ``("claude-opus-4-8", "gpt-5.5")`` whose
         ``get_model_capability(candidate).get("forced_emission")`` is truthy.
      3. else ``None`` […]"""
    model = getattr(settings, "harness_authoring_model", None)
    if model:
        return model
    from app.config import get_model_capability  # function-local (Pitfall 4 discipline)
    for candidate in ("claude-opus-4-8", "gpt-5.5"):
        cap = get_model_capability(candidate) or {}
        if cap.get("forced_emission"):
            return candidate
    return None
```

⚠ Note branch 1 does **not** validate `forced_emission` — which is exactly why the moonshot roster
row (`emit_tier="coerce"`, `forced_emission=None`) is a real finding if it fails, not a broken test.

---

## Shared Patterns

### 1. One home per rule, enforced by `?raw` source guards
**Source:** `PhaseSpineGraph.test.tsx:180-194`, `PhaseSpine.test.tsx:104-117`
**Apply to:** every frontend file this phase touches

```ts
// Source: PhaseSpineGraph.test.tsx:180-194 (shipped)
const src = phaseSpineGraphSource
expect(src).not.toMatch(/const PHASE_GLYPHS/)
expect(src).not.toMatch(/const PHASE_TYPE_LABELS/)
expect(src).not.toMatch(/(function|const)\s+parseSkipTarget/)
expect(src).not.toMatch(/interface (PhaseSpecJSON|PhaseConfigJSON|ValidatorJSON)/)
expect(src).not.toMatch(/lastIndexOf/)
expect(src).toMatch(/phaseVocabulary/)
expect(src).toMatch(/soulData/)
```

**What they actually assert (measured):** these are **negative regexes over the two spine files
only**. A new derivation added to `phaseVocabulary.ts` cannot trip them. They **would** trip if a
plan declared the derivation map inside `PhaseSpineGraph.tsx`. The rule still binds; the guard is
narrower than CONTEXT feared.

### 2. Copy constants live in `definitionOps.ts`, never inside a component
**Source:** `GovernanceSection.tsx:63-75` (the import block), `StepTypePicker.tsx:54-57`
**Apply to:** `SeedReceipt.tsx`, `StarterTemplatePicker.tsx`
Rationale, verbatim: *"a refusal reason that lives inside a component is a refusal reason nobody can
test for drift. Its suite asserts character-identity against those imported names."*

### 3. Client PREDICTS, server ENFORCES / invitation ≠ verdict
**Source:** `GovernanceSection.tsx:20-24`, `phaseVocabulary.ts:205-209`
**Apply to:** `SeedReceipt.tsx`, the `/validate` verdict
*"the safety-DEFINING list has one home and it is not this file"* — the receipt renders
`groundingCauseOf(phase, kbTools)` over the server's `kb_tools`; the **severity** is only ever the
server's (D-187-11 is a route verdict, never a chip).

### 4. Derive, never store
**Source:** `harness.py:218-229`, `phaseVocabulary.ts:31-34`, `grounding.py:886-891`
**Apply to:** the derived tier, the provenance marker
`test_grounding_declares_no_model_validator_in_CODE` (`test_185_engine_attachment.py:246`) is the
machine guard. It must stay green.

### 5. Additive-optional, zero-migration JSONB
**Source:** `harness.py:206`, `:234-235`
**Apply to:** the provenance marker on `PhaseSpec`
`bool = False`, never `bool | None = None` — *"absence must be unambiguous […] exactly one way to
say 'not set'"*.

### 6. Reuse the shipped ask_user substrate, never re-implement the pause
**Source:** `harness_engine.py:944-1229`
**Apply to:** the hoisted armed checkpoint
It already owns the durable prompt row, SUBSCRIBE-before-emit, the indefinite wait, the shutdown
`CancelledError` escape (`:1120`), the **exact-match approval allow-list** (`:1194` — the
T-185-04-01 fail-open fix) and the receipt write (`:1215`). Re-implementing any one re-opens a
closed BLOCKER.

### 7. Reuse the existing `harness_audit` event types
**Source:** `harness_engine.py:712-721`; `app.db.workflows._AUDIT_EVENT_TYPES`
**Apply to:** the hoisted checkpoint
`harness_audit.event_type` is a **closed CHECK of 23 values**. `action_risk_pending` and
`validator_ask_user_approved` are both present; metadata is free. A new kind needs a migration and
this phase ships zero (`BUG-260731-02` is the precedent where an unlisted kind **killed the run**).

### 8. Gated mount / spread-conditional (D-181-01 byte-identity)
**Source:** `WorkflowBuilderPage.tsx:1790-1802`, `:1551-1555`
**Apply to:** both new mounts
With the flag off the prop must be genuinely **ABSENT**, not present-and-undefined.

### 9. The canvas glyph vocabulary (icon-convention §4)
**Source (in-code):** `PhaseNodeCard.tsx:440` `⛨` · `PhaseNode.tsx:238` / `PhaseSpineGraph.tsx:201`
`⤳` · `FlowEdge.tsx:81, :108-118` `＋` and `✕` on the lane · `PhaseFormPanel.tsx:1079` `✦` (a
**skill-name** marker in the panel — not a canvas mark)
**Apply to:** the receipt's dismiss affordance and the picker's rows
There is **no category-icon vocabulary** — a workflow is its SPINE (#36). `✦`/`✓` as per-node review
marks are unshipped proposals and out of scope.

---

## No Analog Found

| File / concern | Role | Data flow | Why no analog |
|---|---|---|---|
| **The SC#10 roster derivation** (inside `test_187_authoring_step_names.py`) | test | batch | **Measured: no backend test derives a provider roster by grouping `MODEL_CAPABILITIES` on `provider`.** The only registry-importing tests read a single model's capability dict (`test_081_1_settings_migration.py:363-378`, `test_075_tool_args_progress.py:1021-1028`). `test_151_cross_provider_schema.py` is named "cross-provider" but is four hand-written per-translator functions with **zero `parametrize`**. `hypothesis` is not installed and no `backend/tests/unit` file imports `itertools`. Write the grouping fresh: `from app.config import MODEL_CAPABILITIES`, group on `["provider"]`, pick one representative per group, `@pytest.mark.parametrize` over the result. Never re-type the 8 ids. |
| **Reading `definition.assets[]` in the frontend** (the template tier) | utility | transform | **Measured: grep over `frontend/src` returns ZERO references to `assets`.** The builder carries them only incidentally — `DefinitionMeta` (`builderStore.ts:178-180`) is a key-remapped mapped type over `BuilderDefinition`'s index signature, so `assets` round-trips through `meta` untouched. This is the only genuinely new data read in Req 1, and it has no precedent to copy. Gate it on `phase_type === "llm_emit"` (RESEARCH Pitfall 2) or a definition-level filename renders on every phase. |
| **In-memory, per-draft dismissal that intentionally does NOT persist** | component state | — | `canvasNudge.ts` is the nearest neighbour and is the **counter-example**: it is the one module in the canvas surface allowed to touch browser storage, and `WorkflowBuilderPage.canvas.test.tsx:414-418` is a **shipped guard asserting the Builder page's source names no browser-storage API at all**. D-187-09's plain `useState` is therefore correct *and* structurally required — a `localStorage` key in the page would fail a shipped test. |

---

## Metadata

**Analog search scope:** `frontend/src/components/workflows/`, `frontend/src/components/ui/`,
`frontend/src/pages/`, `frontend/src/lib/api.ts`, `backend/app/models/`, `backend/app/services/harness/`,
`backend/app/services/harness_engine.py`, `backend/app/services/workflow_authoring.py`,
`backend/app/api/workflows.py`, `backend/tests/unit/`, `backend/tests/`
**Files read in full or in targeted ranges:** 24
**Analogs selected:** 17 (early stop — 3 strong matches per new file was reached)
**Pattern extraction date:** 2026-08-02

---

*Phase: 187-business-vocabulary-ai-seeded-canvas*
