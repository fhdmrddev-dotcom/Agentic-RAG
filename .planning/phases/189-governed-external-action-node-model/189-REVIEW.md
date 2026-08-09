---
phase: 189-governed-external-action-node-model
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 58
files_reviewed_list:
  - backend/app/api/runs.py
  - backend/app/api/workflow_runs.py
  - backend/app/db/workflows.py
  - backend/app/models/harness.py
  - backend/app/services/harness/grounding.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness_engine.py
  - backend/app/services/workflow_authoring.py
  - backend/tests/test_182_grounding_bundle.py
  - backend/tests/test_harness_engine.py
  - backend/tests/test_harness_whitelist.py
  - backend/tests/test_migration_115.py
  - backend/tests/unit/test_103_grounding_fidelity.py
  - backend/tests/unit/test_185_detection.py
  - backend/tests/unit/test_189_external_action_model.py
  - backend/tests/unit/test_189_no_egress.py
  - backend/tests/unit/test_harness_models.py
  - backend/tests/unit/test_publish_service.py
  - frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/panel/PhaseTimeline.tsx
  - frontend/src/components/workflows/canvasModel.test.ts
  - frontend/src/components/workflows/canvasModel.ts
  - frontend/src/components/workflows/definitionOps.test.ts
  - frontend/src/components/workflows/definitionOps.ts
  - frontend/src/components/workflows/ExternalActionSection.test.tsx
  - frontend/src/components/workflows/ExternalActionSection.tsx
  - frontend/src/components/workflows/GovernanceSection.test.tsx
  - frontend/src/components/workflows/GovernanceSection.tsx
  - frontend/src/components/workflows/NodeCornerMarks.tsx
  - frontend/src/components/workflows/nodePresentation.ts
  - frontend/src/components/workflows/NodeRunOverlay.tsx
  - frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx
  - frontend/src/components/workflows/PhaseFormPanel.test.tsx
  - frontend/src/components/workflows/PhaseFormPanel.tsx
  - frontend/src/components/workflows/PhaseNode.test.tsx
  - frontend/src/components/workflows/PhaseNode.tsx
  - frontend/src/components/workflows/PhaseNodeCard.test.tsx
  - frontend/src/components/workflows/PhaseNodeCard.tsx
  - frontend/src/components/workflows/phaseNodeCardContract.ts
  - frontend/src/components/workflows/phaseVocabulary.corpus.test.ts
  - frontend/src/components/workflows/phaseVocabulary.test.ts
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/components/workflows/runVocabulary.test.ts
  - frontend/src/components/workflows/runVocabulary.ts
  - frontend/src/components/workflows/soulData.test.ts
  - frontend/src/components/workflows/soulData.ts
  - frontend/src/components/workflows/StepTypePicker.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/lib/phaseGlyph.tsx
  - frontend/src/lib/phaseState.test.ts
  - frontend/src/lib/phaseState.ts
  - frontend/src/types/index.ts
  - scripts/vitest-count-gate.cjs
  - supabase/full-schema.sql
  - supabase/migrations/115_workflow_phases_recorded_not_sent.sql
findings:
  critical: 2
  warning: 6
  info: 6
  total: 14
status: issues_found
---

# Phase 189: Code Review Report

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 58
**Status:** issues_found

## Summary

Phase 189 adds a 7th workflow `phase_type` (`external_action`), migration 115's
sixth `workflow_phases.status` literal (`recorded_not_sent`), a pure-Python
executor that records-and-sends-nothing, and the canvas/panel vocabulary for the
new terminal.

The **no-egress contract itself holds**. I traced every code path the executor can
reach: `_exec_external_action` (`backend/app/services/harness/phase_types.py:1777-1852`)
makes no network call, opens no client, invokes no model, and resolves its
capability against a closed frozenset. No capability is in `_TOOL_REGISTRY` or
`get_tools()`. Migration 115 is a correct one-literal widening and
`supabase/full-schema.sql:1932` reflects it. The falsification suites are genuinely
non-vacuous — the `_MCP_TOKEN` regex carries a positive control that already caught
its own author's spec, and `test_189_external_action_model.py` calls
`_external_action_config_cls()` first in every case so nothing is green for the
wrong reason. Nothing here is a tautology; that is unusual and worth saying.

Two findings are blockers, and both are about the phase's own headline claim rather
than about egress:

1. **The wire-around SC#2 forbids is reachable server-side.** D-20 widens the
   publish fidelity set with the three capability names *globally*. Nothing checks
   `phase_type`. The suite's own `test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding`
   drives an **`llm_agent`** phase whitelisting all three and asserts zero findings —
   the design's own test proves an ordinary, unarmed agent step can publish with
   `send_email` on its whitelist. The only barrier is the client rail's option list.
2. **The live run surface paints the recorded step "✓ Complete."** The engine
   deliberately emits no SSE for the `recorded_not_sent` branch, so the card stays
   `running` and both store sweeps flip `running → done`. The developer panel then
   announces "…complete" for the one step in the product whose entire reason for
   existing is that it did not complete.

Both are recorded in the phase's deferred items or defended in prose, but neither is
closed, and the prose in `grounding.py` and in `test_182_grounding_bundle.py`'s
failure message asserts finding CR-01 is *prevented* — a false safety claim is worse
than a known gap.

---

## Critical Issues

### CR-01: An unarmed `llm_agent` step can whitelist an external capability and publish clean

**File:** `backend/app/services/harness/grounding.py:428`
(reachable via `backend/app/services/harness/grounding.py:702-710`,
`backend/app/services/harness/publish_service.py` stage 2.6)

**Issue:**
`assemble_grounding_bundle` builds the fidelity membership set as

```python
fidelity_tool_names = schema_tool_names | EXTERNAL_ACTION_CAPABILITIES
```

and `_unregistered_tools` tests **every phase's** `available_tools` against that
union, with no `phase_type` term. `grep -rn "EXTERNAL_ACTION_CAPABILITIES" backend/app/`
confirms there are exactly two consumers — this line and the executor's own closed-set
raise. **No server-side rule anywhere restricts a capability name to an
`external_action` phase.**

`ExternalActionPhaseConfig`'s D-03 total-replacement validator
(`backend/app/models/harness.py:266-285`) only governs `external_action` configs.
`LlmAgentPhaseConfig.available_tools` is a free-form `list[str]`; the definition
JSONB reaches the server through `POST /workflows` / the draft PATCH / the NL
generator, none of which is the author-facing rail. So a definition carrying

```json
{"phase_type": "llm_agent", "prompt": "…", "available_tools": ["send_email"]}
```

parses, passes stage 2.6, and publishes — on a step with `action_risk_armed: false`
and no checkpoint.

This is *exactly* the threat the same commit's prose says is prevented:

- `grounding.py:411-417` — *"A capability in `tools` is a capability an author can tick
  on an ORDINARY, UNARMED `llm_agent` step — which wires around the `external_action`
  type's structural arming and makes `action_risk_armed` decorative. That is the
  wire-around SC#2 forbids."*
- `backend/tests/test_182_grounding_bundle.py:325` failure message — *"An author can
  now tick `send_email` on an ORDINARY, UNARMED llm\_agent step."*

The V22 guard those quotes belong to only fences `GroundingBundle.tools` (what the
**client rail is offered**). It does not fence what the **server accepts**. The
boundary is enforced by a UI option list.

The suite makes the gap explicit rather than hiding it:
`backend/tests/unit/test_103_grounding_fidelity.py:290` runs
`_unregistered_tool_findings(sorted(EXTERNAL_ACTION_CAPABILITIES))` over
`_definition_with_tool`'s fixture, which is an **`llm_agent`** phase
(`test_103_grounding_fidelity.py:23-42`, `"phase_type": "llm_agent"`), and asserts
`offenders == set()`.

Impact today is latent — D-22 keeps the names out of `_TOOL_REGISTRY`, so
`dispatch_tool` answers `"Unknown tool: send_email"`. It stops being latent the moment
Phase 190 registers a handler, at which point a published, unarmed agent step holds a
live egress name on its dispatch whitelist and the D-04 checkpoint never runs.

**Fix:** make rule 2 scope the capability names to the type that owns them, at the one
place the union is built or at the one place membership is tested. The
`grounding.py:420-423` note rejects "a `phase_type` exemption inside rule 2"; the
narrower shape below is not an exemption — rule 2 keeps firing on every name it ever
fired on, and the *widening* becomes conditional rather than the *rule*:

```python
# grounding.py — replace the global union at :428
schema_tool_names = {t["function"]["name"] for t in get_tools(None)}
# NOT unioned here. The capability is admissible only on the type that derives it.
fidelity_tool_names = schema_tool_names
```

```python
# grounding.py — _unregistered_tools (:702), the ONE membership site
def _unregistered_tools(phase, tool_names: set[str]) -> list[str]:
    # D-20 / SC#2: a capability is admissible ONLY on the phase type whose
    # `available_tools` is DERIVED from it (models/harness.py D-03). On every other
    # type the name is a wire-around of the structural arming and must still block.
    allowed = tool_names
    if getattr(phase.config, "phase_type", None) == "external_action":
        allowed = tool_names | EXTERNAL_ACTION_CAPABILITIES
    return [t for t in (getattr(phase.config, "available_tools", None) or []) if t not in allowed]
```

Then add the missing negative control beside the existing case:

```python
async def test_a_capability_on_an_llm_agent_step_still_blocks_publish():
    """SC#2 — the capability is admissible on external_action and NOWHERE else."""
    findings = await _unregistered_tool_findings(["send_email"])  # llm_agent fixture
    assert len(findings) == 1 and "send_email" in findings[0]["message"]
```

and re-point `test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding`
at an `external_action` phase, which is the shape D-06 actually needs to publish.

---

### CR-02: A `recorded_not_sent` phase renders and announces as "Complete" on the live surface

**File:** `backend/app/services/harness_engine.py:1764-1800`
(consumed by `frontend/src/providers/StreamsProvider.tsx:2843-2877`,
`frontend/src/components/panel/PhaseTimeline.tsx:87-88`)

**Issue:**
The `elif _recorded_intent:` branch writes the audit row and **deliberately emits no
SSE at all** (`harness_engine.py:1792-1800`). The consequence is not the intended
"the client learns the truth on reconcile" — it is that the phase card never leaves
`running` in the live session, and two store sweeps then upgrade it to `done`:

- `finalizeEarlierPhasesForThread` (`StreamsProvider.tsx:2858-2877`) — fired from
  `onPhaseStarted` (`:989`) when the **next** phase goes live. Any external-action
  step that is not the last phase is repainted `done` **mid-run**, within
  milliseconds.
- `finalizeAllPhasesForThread` (`:2837-2853`) — fired from `onRunCompleted` at
  `status === "completed"` (`:1043`). Catches the last-phase case.

Both sweeps' predicate is `p.status === "running" || p.status === "retrying"`, and a
recorded step is `running` because nothing ever resolved it. Downstream:

- `PhaseCard`'s `STATUS_META.done` renders `✓ Complete`
  (`panel/PhaseCard.tsx:112`) — the checkmark
  `tests/unit/test_189_no_egress.py:335` bans from the output body, on the card
  describing that body.
- `milestoneFor` (`PhaseTimeline.tsx:75-76`) announces
  *"Phase N of M, notify, complete"* to a screen-reader user. The carefully-added
  `case "recorded-not-sent"` arm at `:87-88` is unreachable from the live path.
- On the canvas, `canvasReading` receives `done` and `runReadingWord` prints
  *"Complete"* instead of *"Not sent — recorded"*.

`reconcilePhases` (`StreamsProvider.tsx:3382-3420`) is correct — a resolved DB row
wins over the positional floor — so a **reload** shows the truth. That is precisely
SPEC Req 4's failure shape restated: the live view and the reload disagree about
whether work happened, and the live view is the one claiming success. It is the same
class of defect 188-02 and CR-06 each closed one function at a time, recurring a
third time.

The engine comment at `:1798-1800` acknowledges the gap and defers it. It is filed
but not closed, and the state it produces is the single reading this phase exists to
make impossible.

**Fix:** the sweeps must not be able to *invent* a terminal for a step whose terminal
they were never told. The narrowest correct fix is at the producer — emit an additive
event the sweeps and the reducer can both read, exactly as `phase_failed` was added
for the emit-failure branch:

```python
# harness_engine.py, inside the `elif _recorded_intent:` branch, after write_audit
await _emit(redis, stream_run_id, "phase_recorded_not_sent",
            phase=phase.slug, phase_index=phase.phase_index)
```

```ts
// StreamsProvider.tsx, beside onPhaseFailed
onPhaseRecordedNotSent: (phase) =>
  useStreamsStore.getState().actions
    .setPhaseStatusForThread(threadId, phase, "recorded-not-sent"),
```

An unhandled event is inert for any older client, and `"recorded-not-sent"` is
already a `Phase["status"]` member with a `STATUS_META` row, a `canvasReading` arm
and a `milestoneFor` sentence — every consumer is already built.

If shipping the new event is genuinely out of scope, the sweeps must at minimum stop
claiming success for an unresolved step of this type; but note that leaves the card
stuck on `Running` for the rest of the session, which is honest but wrong, so the
event is the real fix.

---

## Warnings

### WR-01: Migration 115's DROP+ADD is neither atomic nor idempotent

**File:** `supabase/migrations/115_workflow_phases_recorded_not_sent.sql:84-85`

**Issue:** Two bare statements, no transaction, no `IF EXISTS`. Pasted into the
Supabase SQL editor each runs in its own implicit transaction. If the session drops,
the editor times out, or the `ADD` is edited/interrupted between the two, the table is
left with **no** `workflow_phases_status_check` at all — the closed vocabulary the
whole migration exists to preserve, gone, fail-open, and silently (nothing reads
`pg_constraint` at boot). Re-pasting after a partial apply errors on the `DROP`
because the constraint is already gone. The file's own header calls the closed
vocabulary "the property the CHECK exists for" and then ships the one apply shape that
can drop it.

**Fix:**

```sql
BEGIN;
ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (
    status = ANY (ARRAY[
        'pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text,
        'recorded_not_sent'::text
    ])
);
COMMIT;
```

`backend/tests/test_migration_115.py` already gates the result and needs no change.

---

### WR-02: The recorded intent sweeps in the whole run-input bag, including `kickoff_prompt`

**File:** `backend/app/services/harness/phase_types.py:1722-1742`

**Issue:**

```python
resolved: dict = {str(k): v for k, v in (getattr(ctx, "inputs", None) or {}).items()}
```

`ctx.inputs` is the run's launch bag, and on every live run it carries
`kickoff_prompt` (SEED-047, threaded by `_kickoff_prompt` at `:146-155` and confirmed
by the engine test's own ctx at `test_harness_engine.py:891`). So the rendered
NOT-SENT body prints

```
What this step would have done
  Action        : Sends an email
  kickoff_prompt: send Sarah the renewal summary
```

and `recorded_intent["inputs"]` persists it into `workflow_phases.output`. The block
is headed *"What this step would have done"*, so it is asserting that the user's
original chat question is an input to an email — which it is not. It also means every
launch-form field of the whole workflow, relevant or not, is restated as an
external-action parameter on a surface whose entire discipline is not over-claiming.

The three no-egress tests never see it because `_run_ctx()`
(`test_189_no_egress.py:148`) sets `inputs={}` and then assigns only hand-picked keys.

**Fix:** exclude the known run-scaffolding keys, or better, name the fields the record
is allowed to carry:

```python
# The run-scaffolding keys are NOT action inputs. `kickoff_prompt` is the user's
# chat question (SEED-047) and would render as a parameter of the send.
_NON_ACTION_RUN_INPUTS = frozenset({"kickoff_prompt"})

resolved: dict = {
    str(k): v
    for k, v in (getattr(ctx, "inputs", None) or {}).items()
    if str(k) not in _NON_ACTION_RUN_INPUTS
}
```

and add a case to `test_the_output_carries_the_recorded_intent_sentinel` driving a ctx
with `kickoff_prompt` set and asserting it is absent from `record["inputs"]`.

---

### WR-03: The no-egress falsification patches HTTP only — not SMTP, sockets or `urllib`

**File:** `backend/tests/unit/test_189_no_egress.py:84-100`

**Issue:** `_block_all_http` patches `httpx.Client.send` and
`httpx.AsyncClient.send`, and the docstring claims *"Patch every HTTP transport this
backend can reach."* The justification for the scope is that `requirements.txt` names
only `httpx`. But `smtplib`, `socket`, `urllib.request` and `subprocess` are all in the
standard library and need no requirement entry — and for a capability named
`send_email`, `smtplib.SMTP.sendmail` is the single most plausible way a future edit
would actually send something. Case B would return normally and report green over it.
The same is true of a raw `socket.socket.connect` or a `subprocess` shell-out to
`curl`.

The Case A source fence does not cover this either: it looks for the `mcp` token only.

**Fix:** widen the sentinel to the transports a plausible regression would use, and
extend the inertness control to match so the widening cannot be vacuous:

```python
def _block_all_http(monkeypatch) -> None:
    import smtplib, socket, urllib.request
    import httpx
    ...
    monkeypatch.setattr(httpx.Client, "send", _sync_send, raising=True)
    monkeypatch.setattr(httpx.AsyncClient, "send", _async_send, raising=True)
    monkeypatch.setattr(socket.socket, "connect", _sync_send, raising=True)
    monkeypatch.setattr(smtplib.SMTP, "__init__", _sync_send, raising=True)
    monkeypatch.setattr(urllib.request, "urlopen", _sync_send, raising=True)
```

with one added inertness case per transport, in the shape
`test_the_transport_patch_is_not_inert` already uses.

---

### WR-04: The capability picker is a `radiogroup` with three tab stops and no arrow-key navigation

**File:** `frontend/src/components/workflows/ExternalActionSection.tsx:138-169`

**Issue:** The container declares `role="radiogroup"` and each option declares
`role="radio"` with `aria-checked`, but the options are plain `<button>` elements with
no `tabIndex` management and no `onKeyDown`. The APG radio-group pattern requires
**one** tab stop for the group with Arrow keys moving the selection; here a keyboard
user gets three tab stops and no arrow behaviour, so the ARIA role announces a widget
that does not behave like one. `vitest-axe` cannot see this — `aria-required-children`
and `aria-checked` are both satisfied — so the suite's a11y coverage
(`ExternalActionSection.test.tsx:170-175` asserts only the role and the child count)
passes over it.

Every neighbouring governance control in this tree is a single `role="switch"` or a
two-button group with `aria-pressed`, so this is the first real radiogroup on the
surface and the pattern debt starts here.

**Fix:** either implement roving tabindex + arrow handling, or — cheaper and
consistent with `GovernanceSection`'s dial — drop to `aria-pressed` buttons in a
`role="group"`, which makes no widget-behaviour promise:

```tsx
<div role="group" aria-labelledby={headingId} data-testid="external-action-options" …>
  {EXTERNAL_ACTION_CAPABILITIES.map((name) => (
    <button type="button" aria-pressed={chosen} …>
```

If the radiogroup is kept, add `tabIndex={chosen || (selected === null && i === 0) ? 0 : -1}`
plus an `onKeyDown` moving selection on Arrow keys, and assert both in the suite.

---

### WR-05: The developer panel prints the raw client status slug to the user

**File:** `frontend/src/components/panel/PhaseTimeline.tsx:185`

**Issue:**

```ts
else if (activePhase) doingNow = `${activePhase.slug} — ${activePhase.status}`
```

interpolates the internal `Phase["status"]` member directly into user-visible copy.
For the six pre-189 members this reads tolerably (`notify — running`); for the member
189 adds it reads **`notify — recorded-not-sent`** — a kebab-case internal identifier
on the one surface in the phase whose whole discipline is that the stored slug, the
panel word and the canvas sentence are three deliberately different spellings (D-17).
Every other consumer in this phase routes through a vocabulary table; this line
bypasses `STATUS_META`, which already holds the correct panel word (`"Not sent"`,
`PhaseCard.tsx:152`).

**Fix:** route it through the table the file already has, e.g. export a
`statusWord(status)` from `PhaseCard.tsx` (or lift `STATUS_META` beside it) and use:

```ts
else if (activePhase) doingNow = `${activePhase.slug} — ${statusWord(activePhase.status)}`
```

---

### WR-06: The publish golden run executes the external-action body with the checkpoint skipped

**File:** `backend/app/services/harness_engine.py:802-812`,
`backend/app/services/harness/publish_service.py:857-863`

**Issue:** D-19 puts `is_golden_run` on the ctx bag and the armed checkpoint then
becomes a log line: *"the pause is skipped, the step still runs"*. For `external_action`
the arming is not an author preference — it is `PhaseSpec._external_action_is_always_armed`'s
structural pin, the single guarantee D-04 exists to make. The golden run bypasses it
unconditionally, with no phase-type carve-out.

Inert in 189 (the step records and sends nothing, and the phase row correctly lands
`recorded_not_sent` even on a golden run). It stops being inert the day Phase 190
makes the capability real: **publishing** a workflow would then perform the external
action, with nobody asked, once per publish attempt.

**Fix:** the golden run should skip the *body* of an external-action step, not just its
pause — the publish gauntlet is validating structure, not exercising side effects:

```python
# harness_engine._run_phase_with_gates, in the golden-run branch
if _armed and getattr(ctx, "is_golden_run", False):
    if isinstance(getattr(phase, "config", None), ExternalActionPhaseConfig):
        # The golden run validates STRUCTURE. A step whose whole purpose is to act
        # outside must not act during a publish — the checkpoint that would have
        # asked a person is exactly the one being skipped here.
        return PhaseOutcome("completed", {"text": "…", RECORDED_INTENT_KEY: {...}}, None, None)
```

At minimum, record the decision in `189-DEFERRED.md` with Phase 190 named as the
owner and a concrete re-open trigger, so the carve-out is not rediscovered from a
production send.

---

## Info

### IN-01: "Seven readings" prose survives the eighth reading

**File:** `frontend/src/components/workflows/runVocabulary.ts:333`, `:245`;
`frontend/src/components/workflows/NodeRunOverlay.tsx:224`

**Issue:** `RING_GEOMETRY`'s docblock opens *"Seven readings, seven ring SHAPES"* and
then enumerates eight; `NodeRunState.reading` says *"Which of the seven readings"*;
`NodeRunOverlay`'s JSX comment says *"All seven readings differ in a shape property"*.
This is the exact rot the same phase corrects in five other files with an explicit
"a count in prose rots on every additive growth" note.

**Fix:** drop the numeral — *"Every reading has its own ring SHAPE"* — as
`phaseVocabulary.ts:600` and `phase_types.py:19` already do.

### IN-02: `notConnectedOf`'s second line is a constant

**File:** `frontend/src/components/workflows/phaseVocabulary.ts:810-813`

**Issue:** `return true` after the type test means the "state test" has no false
branch; the function is type-conditional in fact. The docblock states this openly and
the two-line shape is a deliberate seam for Phase 190. Recorded only so a reader does
not mistake it for an oversight — and so the *"badge retires by data"* claim is read as
a future property, not a current one.

**Fix:** none needed now; Phase 190 replaces line 812 with the real predicate.

### IN-03: Cross-module invariants are enforced by module-level `assert`

**File:** `backend/app/services/harness/grounding.py:914`,
`backend/app/services/harness/phase_types.py:1689`

**Issue:** Both anti-drift fences are bare `assert` statements at import time. Python
run with `-O` strips them entirely, so the fence silently disappears in any
optimised deployment. Both are also duplicated by real pytest cases
(`test_189_external_action_model.py`, and the copy-table set equality), which is where
the load actually sits.

**Fix:** if the runtime check is meant to be load-bearing, raise explicitly:

```python
if EXTERNAL_ACTION_CAPABILITIES & KB_TOOLS:
    raise RuntimeError("D-03: an external-action capability collides with KB_TOOLS …")
```

### IN-04: A fourth hand-typed copy of the closed capability set is cross-checked against nothing

**File:** `backend/tests/test_182_grounding_bundle.py:274`

**Issue:** `test_103_grounding_fidelity.py:279` imports `EXPECTED_CAPABILITIES` from
`test_189_external_action_model.py` precisely so the two test-side copies cannot
drift. `test_182_grounding_bundle.py` declares its own frozenset and imports nothing —
so a fourth name added to the model, the frozenset and the other two test files would
leave V22 quietly checking a stale three-name set.

**Fix:** `from tests.unit.test_189_external_action_model import EXPECTED_CAPABILITIES`
and assert equality, exactly as the sibling file does.

### IN-05: `PhaseFormPanel` keeps a diverging local copy of `PHASE_TYPE_LABELS`

**File:** `frontend/src/components/workflows/PhaseFormPanel.tsx:174-181`

**Issue:** The local map already disagrees with the shared
`phaseVocabulary.PHASE_TYPE_LABELS` on `llm_human_input` ("Needs a person" vs "Needs
you"), which the comment records as *"a fact about the past, never a licence to invent
a second one"*. 189 adds the 7th entry to both, so the duplicate now needs maintaining
in two places for every future type.

**Fix:** import the shared map and keep a small override object for the one shipped
divergence, so an 8th type reaches the panel automatically.

### IN-06: The count gate's own header records a red `failed` column on a clean tree

**File:** `scripts/vitest-count-gate.cjs:667-688`

**Issue:** The header records that on 2026-08-07 an unmodified tree produced
**9 failing tests on one sample and 19 on another**, all passing in isolation. The
gate's documented contract is exit 1 on `numFailedTests > 0`. So either the gate is
currently red and being bypassed, or the failure check is not what the header says.
189 relies on this gate as its coverage backstop for 14 pin movements.

**Fix:** out of scope for 189's code, but the phase's verification story rests on it —
either quarantine the flaky files with a named allow-list the gate prints, or record in
`189-VALIDATION.md` which `failed` value was accepted and why.

---

_Reviewed: 2026-08-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
