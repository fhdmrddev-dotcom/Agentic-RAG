---
phase: 187-business-vocabulary-ai-seeded-canvas
reviewed: 2026-08-02T03:17:14Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/models/harness.py
  - backend/app/services/harness/grounding.py
  - backend/app/services/harness_engine.py
  - backend/app/services/workflow_authoring.py
  - backend/tests/integration/test_187_authoring_roster.py
  - backend/tests/unit/test_182_severity_codes.py
  - backend/tests/unit/test_182_validate.py
  - backend/tests/unit/test_185_engine_attachment.py
  - backend/tests/unit/test_187_armed_checkpoint_property.py
  - backend/tests/unit/test_187_authoring_step_names.py
  - backend/tests/unit/test_ask_user_disposition.py
  - backend/tests/unit/test_harness_models.py
  - frontend/src/components/workflows/PhaseNode.test.tsx
  - frontend/src/components/workflows/PhaseNode.tsx
  - frontend/src/components/workflows/PhaseSpineGraph.test.tsx
  - frontend/src/components/workflows/PhaseSpineGraph.tsx
  - frontend/src/components/workflows/ProblemsTray.test.tsx
  - frontend/src/components/workflows/ProblemsTray.tsx
  - frontend/src/components/workflows/SeedReceipt.test.tsx
  - frontend/src/components/workflows/SeedReceipt.tsx
  - frontend/src/components/workflows/StarterTemplatePicker.test.tsx
  - frontend/src/components/workflows/StarterTemplatePicker.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/__fixtures__/canvasFixtures.ts
  - frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
  - frontend/src/components/workflows/canvasModel.purity.test.ts
  - frontend/src/components/workflows/canvasModel.test.ts
  - frontend/src/components/workflows/canvasModel.ts
  - frontend/src/components/workflows/definitionOps.test.ts
  - frontend/src/components/workflows/definitionOps.ts
  - frontend/src/components/workflows/phaseVocabulary.corpus.test.ts
  - frontend/src/components/workflows/phaseVocabulary.test.ts
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.describe.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
status: issues_found
---

# Phase 187: Code Review Report

**Reviewed:** 2026-08-02T03:17:14Z
**Depth:** standard
**Files Reviewed:** 38 (15 production source, 23 test/fixture/snapshot)
**Status:** issues_found

## Summary

The four items flagged as highest-risk in the review brief hold up under adversarial reading:

- **The `harness_engine.py` armed-checkpoint hoist is correct on the paths it covers.** The
  checkpoint sits between the pre-gate pass and the `while True:` loop; `is_action_risk` is a
  caller-supplied parameter (never a `phase` read inside the helper); the Pitfall-4 disposition
  short-circuit at `harness_engine.py:1055-1059` genuinely skips `_failing_on_failure` rather
  than computing-then-overriding it; every non-approval branch returns a non-`None` outcome so
  the body cannot run. `_is_action_risk_finding` is fully deleted with no stale references.
  One residual fail-safe path is flagged below (WR-01) — it is fail-*closed* on "does the body
  run", but it re-introduces the exact `_failing_on_failure(phase, None)` read the block above
  it removes, and no test drives it.
- **Provenance stamping cannot be forged.** `workflow_authoring.py:355-365` recomputes
  `name_seeded_by_ai` from the trimmed `name` unconditionally after `model_validate()`, so a
  model payload claiming either value is discarded. (A separate non-generate write path is
  flagged as WR-05.)
- **`unbound_retrieval` is canvas-only.** It is minted inside `validate_workflow` only, sits
  outside the sealed grounding `try/except`, and calls the pure zero-I/O `grounding_cause`.
  It is registered in both `_ROUTE_ASSIGNED_CODES` and `_INCOMPLETE_CODES`, so `_severity`
  never takes the fail-loud branch. No publish path reaches it.
- **`StarterTemplatePicker` reaches no forward seam.** Its only `@/lib/api` import is
  `listStarterWorkflows`; no router, no store, no create/update/publish/generate/validate
  symbol is imported or referenced. Both new surfaces are correctly gated on `canvasEnabled`.
- **`toCanvas` stays pure** — it mutates nothing, captures only frozen module-scope defaults,
  and the purity suite exercises the injected `nameContext` path.

The defects that survive are concentrated in the two net-new user-facing surfaces and in the
new derived-face tier, where the phase's own "never fabricate / never invent a reason" floors
are breached by reachable, default-valued configuration. Two of them are load-bearing enough
to block: the seed receipt will state a falsehood about governance on essentially every
generated workflow, and the test fixture that would have caught it uses a value the backend
cannot produce.

---

## Critical Issues

### CR-01: The seed receipt reports non-KB-reading steps as "reads your documents", and the `llm_emit` default makes it fire on nearly every generated draft

**File:** `frontend/src/components/workflows/SeedReceipt.tsx:173-190`, `frontend/src/components/workflows/definitionOps.ts:556-565`

**Issue:**
`SeedReceipt` builds its `rows` list from **any** non-null `groundingCauseOf` result:

```ts
const cause: GroundingCause = groundingCauseOf(phase, kbTools)
if (cause === null) continue
found.push({ ... })
```

`GroundingCause` has three non-null values — `"detected"`, `"already-set"`, `"escalated"` —
and only `"detected"` means "this step reads your documents". `rows.length` is then handed
straight to `seedReceiptGroundingLead`, which asserts *both* halves of a claim that is only
true for `detected`:

```ts
`${count} steps read your documents, so I set them to ${words}.`
```

For an `already-set` step neither half is true (it does not read documents, and the AI did
not set it — the author's `citation_policy` did). For an `escalated` step the second half is
false by definition (`seedReceiptStepReason` even renders "you turned this on by hand" on the
row directly beneath the lead that says "so I set them to must prove it").

**This is not an edge case.** `LlmEmitPhaseConfig.citation_policy`
(`backend/app/models/harness.py:155`) is `Literal["strict","flag","partial","draft"] = "strict"`,
and `/generate` returns `wd.model_dump(mode="json")` (`workflow_authoring.py:377`), which emits
defaults. So **every** `llm_emit` phase in **every** generated definition arrives at the client
with `citation_policy: "strict"`, which `groundingCauseOf`'s branch (2) resolves to
`"already-set"`. Both curated starter spines are `llm_agent → llm_emit`
(`StarterTemplatePicker.tsx:50-53`), so the deliverable step of the typical draft is listed.

**Failure scenario (concrete):** describe *"summarise last quarter's board minutes"* → the
generator emits `[llm_single "Draft the summary", llm_emit "Produce the deck"]` with no KB
tools anywhere. `kbTools ∩ available_tools = ∅` on both phases, so zero steps read the KB —
but `rows.length === 1` (the emit phase's default-strict policy), and the receipt renders:

> 1 step reads your documents, so I set it to must prove it.
> You can't turn that off — but you can see exactly where it applies.
> ⛨ **Produce the deck** — it already has to cite its sources

This directly falsifies two locked acceptance criteria:
- *"A seeded draft with grounded steps shows a receipt naming exactly those steps"*
- *"A seeded draft with zero grounded steps shows no grounded-step list"*

and it makes the surface built to discharge SC#3 state something false about what the AI did.

**Fix:** either restrict the list to the cause the lead sentence describes, or split the lead
so each cause gets its own honest sentence. The minimal, honest form:

```ts
// SeedReceipt.tsx — the receipt explains what the SEED applied. `already-set` is the
// author's own citation_policy and `escalated` is the author's own hand; neither was
// applied by this generation, so neither belongs under "so I set them to …".
const cause: GroundingCause = groundingCauseOf(phase, kbTools)
if (cause !== "detected") continue
```

and correspondingly tighten `seedReceiptGroundingLead`'s docblock to say it counts *detected*
steps only. If the wider list is wanted, `seedReceiptGroundingLead` must take the per-cause
counts and compose a sentence per cause rather than one sentence over a total.

---

### CR-02: `SeedReceipt.test.tsx` cannot detect CR-01 — its `llm_emit` fixtures use a `citation_policy` value the backend `Literal` forbids

**File:** `frontend/src/components/workflows/SeedReceipt.test.tsx:88-92`, `:104-108`

**Issue:**
The suite's two `llm_emit` fixtures are:

```ts
{ slug: "emit", phase_index: 4, name: "Produce the renewal pack",
  config: { phase_type: "llm_emit", citation_policy: "loose" } }
```

`"loose"` is **not a member** of `LlmEmitPhaseConfig.citation_policy`
(`backend/app/models/harness.py:155` — `Literal["strict","flag","partial","draft"]`, default
`"strict"`). No server response and no `model_validate()`-passing stored row can ever carry it.
Because `groundingCauseOf`'s `already-set` branch tests `citationPolicy === "strict"` exactly,
the fixture value silently disables that branch — which is precisely what lets

- `"lists EXACTLY the steps that read the documents, and no others"` (`:145-148`), and
- the D-187-10 zero-grounded case over `BARE_PHASES` (`:98-108`)

pass. Swap `"loose"` for the real default `"strict"` and both assertions go red on today's
component. This is a guard that measures an unrepresentable state and reports it as coverage of
the represented one — the exact failure class the phase's own RED-first discipline exists to
prevent.

**Fix:** make the fixtures use values the model can actually produce, and add the default-value
row explicitly:

```ts
// The value the server ACTUALLY emits: `citation_policy` defaults to "strict" on every
// llm_emit phase (harness.py:155), and /generate model_dump()s defaults. A fixture that
// avoids the default is a fixture that avoids the shipped shape.
{ slug: "emit", phase_index: 4, name: "Produce the renewal pack",
  config: { phase_type: "llm_emit", citation_policy: "strict" } }
```

plus a dedicated case pinning what the receipt says about an `already-set` step and about an
`escalated` step, so the lead sentence can never again claim authorship of a cause it did not
create.

---

## Warnings

### WR-01: The armed checkpoint's no-transport fail-safe re-introduces the `_failing_on_failure` read the Pitfall-4 short-circuit exists to delete

**File:** `backend/app/services/harness_engine.py:1065-1066`

**Issue:**
Ten lines after the short-circuit that deliberately never computes `_failing_on_failure` for an
armed caller, the transport guard does exactly that:

```python
if redis is None or run_id is None:
    return _route_on_failure(phase, error_message, attempt, failed_idx)
```

`_route_on_failure` calls `_parse_on_failure(_failing_on_failure(phase, failed_idx))`
(`:898`), and for the armed checkpoint `failed_idx is None`, so `_failing_on_failure` falls
back to *"the first validator carrying a `skip_to_phase` disposition if any, else
`validators[0].on_failure`"* (`:631-634`) — **the author's disposition, applied to a governance
checkpoint the author does not own.**

**Failure scenario:** an armed phase whose author declared any validator with
`on_failure="skip_to_phase:wrap-up"`, driven with `redis=None` (a resume/minimal ctx, a
degraded transport, or any future direct caller). The engine has already written
`action_risk_pending` to `harness_audit` and emitted it, then returns
`PhaseOutcome("skip_to", None, "wrap-up", …)` — the run silently jumps to another phase, the
ledger carries a "we paused for a person" consequence row for a pause that never happened, and
the failure reason blames a "gate failed after 1 attempt(s)" that was not a gate failure.

It is fail-*closed* on the property the property test asserts (the body does not run), which is
why `test_187_armed_checkpoint_property.py` cannot see it — every drive passes
`redis=object()` (`:551`). But it hands control of an armed step's routing back to the author's
list, which is the thing D-187-01 set out to make impossible.

**Fix:** make the armed path's no-transport degradation explicit and author-independent:

```python
if redis is None or run_id is None:
    # An armed checkpoint has no author disposition to fall back on — there is no
    # validator index and the author's routing is not this gate's to inherit. With no
    # transport the person CANNOT be asked, so the only honest outcome is a failed run.
    if is_action_risk:
        return PhaseOutcome(
            "fail_run", None, None,
            f"Phase {phase.phase_index + 1} ({phase.slug}) — the action-risk checkpoint "
            "could not reach anyone to ask; the step was not run",
        )
    return _route_on_failure(phase, error_message, attempt, failed_idx)
```

and add a `redis=None` row to `test_187_armed_checkpoint_property.py`'s space.

---

### WR-02: `derivedFace`'s folder tier claims "Search &lt;folder&gt;" on step types that cannot search

**File:** `frontend/src/components/workflows/phaseVocabulary.ts:466`

**Issue:**
Tier (3) is ungated by `phaseType`, unlike tier (2) which is explicitly gated on `llm_emit`
with a stated rationale:

```ts
if (inputs.folderName) return `Search ${inputs.folderName}`
```

`folder_scope` exists on `LlmSinglePhaseConfig` purely for shape symmetry, and the model says
so in the source: *"Load-bearing on llm_agent + llm_batch_agents; **inert on llm_single (no
tools)**. Carried here for shape symmetry across the family"* (`backend/app/models/harness.py:74-75`).
`grounding.grounding_cause`'s docblock makes the same point independently — `folder_scope` is
deliberately not an input there because *"it exists on all five LLM config members (including
`llm_single`, which has no tools at all), so reading it would auto-lock steps that read nothing."*

**Failure scenario:** a generated definition with
`{phase_type: "llm_single", prompt: "Draft the summary", folder_scope: ["<supplier-contracts-uuid>"]}`
and a populated `folderNames` map renders the node face **"Search Supplier Contracts"**. The
step performs no retrieval; the face states a capability the step does not have. That is a
fabricated claim about what the step does, which is the floor `derivedFace`'s own docblock
(`:200-202`) says it holds.

The test suite cannot catch it: every folder-tier case in `phaseVocabulary.test.ts`
(`:249-290`) and `phaseVocabulary.corpus.test.ts` uses `phase_type: "llm_agent"`.

**Fix:** gate tier (3) on the types where `folder_scope` is load-bearing, reusing the shared
constant rather than a new literal list:

```ts
// (3) FOLDER SCOPE — gated on the RETRIEVAL types, for the same reason tier (2) is gated
//     on llm_emit. `folder_scope` is carried on llm_single for shape symmetry and is
//     INERT there (harness.py:74-75), so "Search <folder>" on one is a claim the step
//     cannot honour.
if (inputs.folderName && GROUNDING_DIAL_TYPES.includes(inputs.phaseType)) {
  return `Search ${inputs.folderName}`
}
```

(`llm_emit` should be added to that predicate only if the emit executor really does bound-scope
retrieval — the `LlmEmitPhaseConfig` docblock says it does, so a 3-member tuple named for its
meaning is the honest spelling.)

---

### WR-03: The new `llm_human_input` face contradicts the step-type picker one click earlier

**File:** `frontend/src/components/workflows/phaseVocabulary.ts:469`, `frontend/src/components/workflows/StepTypePicker.tsx:156`

**Issue:**
`derivedFace` tier (4) returns `"Wait for your approval"` for `llm_human_input`
unconditionally — with or without a name context — so `nodeTitle` can no longer reach
`PHASE_TYPE_SENTENCES.llm_human_input` (`"Check with you"`) for that type. The
`nodeTitle` docblock names this as a deliberate exception.

But `StepTypePicker` still renders its rows from that same map:

```ts
const sentence = PHASE_TYPE_SENTENCES[choice.type] ?? choice.type
```

**Failure scenario:** the author opens ＋ on the lane, reads the row **"Check with you"**,
clicks it, and the card that lands says **"Wait for your approval"**. Two sentences for one
choice, one click apart, both sourced from the module whose whole premise is *"a second copy of
the title resolution … is the drift this phase's red line forbids."* The picker's `?raw` /
copy-identity guards pass because both strings are still imported identifiers — the drift is
semantic, not lexical.

**Fix:** make the picker ask the same resolver the card will:

```ts
// The row must promise what the CARD will say — nodeTitle is the one resolver, and
// derivedFace tier (4) overrides the type sentence for llm_human_input (187-04).
const sentence = nodeTitle(
  { slug: "", phase_index: 0, config: { phase_type: choice.type } },
  /* no name context — the picker knows nothing bound yet */
)
```

or, if the picker must stay a pure map read, change
`PHASE_TYPE_SENTENCES.llm_human_input` to `"Wait for your approval"` and delete tier (4)'s
special case, so one string serves both surfaces.

---

### WR-04: The CANVAS-01 totality hardening added to `nodeTitle` is unreachable through the canvas — three sibling resolvers on the same object still throw

**File:** `frontend/src/components/workflows/canvasModel.ts:290`, `frontend/src/components/workflows/phaseVocabulary.ts:227`, `:347`, `:533`

**Issue:**
`nodeTitle` gained `phase.config?.phase_type ?? ""` with the comment *"an absent `config` is a
malformed author-supplied row, and a projection must resolve it rather than throw (CANVAS-01
totality)"* — and SPEC Req 1's acceptance criterion names exactly that case. But every path
that reaches `nodeTitle` from the canvas hits an unguarded read first:

- `canvasModel.ts:290` — `const phaseType = phase.config.phase_type` (**before** the
  `nodeTitle` call on the next line)
- `phaseVocabulary.ts:227` — `technicalTitle`: `const type = phase.config.phase_type`
- `phaseVocabulary.ts:347` — `groundingCauseOf`: `const rawTools = phase.config.available_tools`
- `phaseVocabulary.ts:533` — `waitsForYou`: `return phase.config.phase_type === …`

**Failure scenario:** `toCanvas([{slug: "a", phase_index: 0}])` throws
`TypeError: Cannot read properties of undefined (reading 'phase_type')` at `canvasModel.ts:290`
— the `nodeTitle` guard never executes. So the acceptance criterion is satisfied only by a
direct unit call to `nodeTitle`, not by the projection the criterion is about.

Reachability of an absent `config` through the API is low (`PhaseSpec.config` is required and
`WorkflowDefinition.model_validate()` 422s without it), which is why this is a Warning and not
a blocker — but either the guard should be real or the docblock claim should be withdrawn.

**Fix:** harden the three sibling readers the same way, or drop the `?.` and the totality
sentence from `nodeTitle` so the module does not claim a property it does not hold:

```ts
// phaseVocabulary.ts
export function technicalTitle(phase: PhaseSpecJSON): string {
  const type = phase.config?.phase_type ?? ""
  ...
}
export function waitsForYou(phase: PhaseSpecJSON): boolean {
  return phase.config?.phase_type === HUMAN_INPUT_PHASE_TYPE
}
// canvasModel.ts:290
const phaseType = phase.config?.phase_type ?? ""
```

---

### WR-05: `action_risk_approval` validators now get the armed *choices* with un-armed *semantics* — a regression of the T-185-04-01 allow-list on that path

**File:** `backend/app/services/harness/validator_kinds.py:714-744`, `backend/app/services/harness_engine.py:942-943`, `:1082`, `:1104`, `:1272`

**Issue:**
D-187-03 deleted the reader (`_is_action_risk_finding`) but deliberately kept both the
`"action_risk_approval"` member of `ValidatorSpec.kind` (`harness.py:193`) and the registered
validator, which still *always* returns
`GateResult(False, "action_risk:approval|" + prompt)`.

`_ask_user_choices_from_finding` still branches on that prefix (`:942-943`), so such a
validator still presents `["Approve and run this step", "Do not run it"]`. But
`is_action_risk` is now supplied only by the hoisted checkpoint, so for a validator-borne
finding it is `False`, and the three Phase-185 armed deltas are all skipped:

- **DELTA 2** — `timeout_seconds` becomes finite (`:1104`), so silence expires the prompt.
- **DELTA 3** — no `CancelledError` shutdown escape (`:1197`); a routine deploy fails the run.
- **T-185-04-01 allow-list** — `if is_action_risk and choice != _ACTION_RISK_APPROVE_CHOICE`
  (`:1272`) does not fire, so consent falls back to the `_is_abort_choice` **deny-list**. A
  typed `"sure"`, `"ok"`, `"yes go ahead"` or `"Do not run it."` (trailing period) reaches the
  Proceed branch, writes a `validator_ask_user_approved` receipt and runs the risky step. That
  is exactly the shape of the Phase-185 BLOCKER, and the recorded project lesson is that a
  deny-list cannot be made fail-closed.

Reachability today is narrow — research measured 0 stored rows naming this kind, and
`publish_service.py:464-503` refuses author-declared `ask_user` validators — but that fence is
recorded in-source as *slated for removal by the deferred Phase-103 background-job publish*
(`:478-479`). When it goes, this becomes an author-reachable governance bypass, and nothing in
the codebase will connect the two changes.

**Fix:** since the kind can no longer be honoured, refuse it at the seam rather than silently
downgrading it. Either

```python
# validator_kinds.py — the hoisted checkpoint (D-187-01) is now the ONLY producer of the
# armed pause. A validator-borne action_risk_approval can no longer receive the armed
# treatment (indefinite wait / shutdown escape / exact-match allow-list), so it must not
# be allowed to present the armed CHOICES either.
@register_validator("action_risk_approval")
async def _validate_action_risk_approval(output: dict, config: dict, ctx) -> GateResult:
    return GateResult(
        False,
        "action_risk_approval is no longer an author-declarable gate (D-187-01) — "
        "arm the phase with action_risk_armed instead",
    )
```

or add a lint/publish rule rejecting the kind. Keep the `Literal` member either way, so stored
rows still `model_validate()`.

---

### WR-06: `name_seeded_by_ai` is client-writable on the create/update path, so a hand-typed name can be made deletable

**File:** `backend/app/models/harness.py:262`, `frontend/src/components/workflows/definitionOps.ts:263-289`

**Issue:**
The `PhaseSpec` docblock states the marker *"is never read off the emitted payload, so an
emission cannot claim that a name it just wrote was hand-typed."* That is true of
`generate_workflow_definition`, but `name_seeded_by_ai` is an ordinary model field, so it is
accepted verbatim by every other write path (`POST /workflows`, the autosave `PUT`, a
hand-edited JSONB row). Nothing on the server ever re-derives it outside `/generate`.

**Failure scenario:** a definition is saved with `{name: "Send the renewal notice",
name_seeded_by_ai: true}` where the name was authored by a person (an import, a fork of an
older draft, a client bug, or a crafted request). The author later toggles one entry in
`available_tools`; `patchPhaseConfig` (`definitionOps.ts:280-285`) sees
`invalidatesTheFace && seededName` and `delete next.name` — the author's writing is destroyed
with no notice, no marker and no confirmation. `definitionOps.ts:254-256` names that outcome as
data loss and says the marker exists to prevent it; the marker is trustworthy on exactly one of
the write paths.

**Fix:** either strip the field on non-generate writes so only the generator can set it, e.g.
in the create/update handler:

```python
# The provenance marker is SERVER-OWNED. Only generate_workflow_definition may set it;
# an inbound payload claiming it would let a hand-typed name be silently demoted later.
body = body.model_copy(update={"phases": [
    p.model_copy(update={"name_seeded_by_ai": False}) for p in body.phases
]})
```

or, if a round trip must preserve it, compare against the stored row and reject a client
transition of `False → True`.

---

### WR-07: `total_phases`'s fallback composes a false position in the approval prompt

**File:** `backend/app/services/harness_engine.py:766`

**Issue:**

```python
_total = total_phases if total_phases is not None else phase.phase_index + 1
sentence = _approval_sentence(phase, _total)
```

`_approval_sentence`'s honesty rules are POSITION / IDENTITY / CONSEQUENCE, and the fallback
knowingly breaks the first one: for phase index 1 of a 5-phase workflow it renders
*"Step 2 of 2"*, telling the person this is the last step when three more follow. The comment
concedes it *"degrades 'Step 2 of 5' to 'Step 2 of 2'"* and argues that is better than
crashing — but this is the sentence a human reads before authorising an irreversible action,
and a silently wrong position is exactly the class of copy the surrounding module refuses
elsewhere.

There is one production call site and it always passes the real value, so the fallback is dead
in production — which is the argument for making it loud rather than plausible.

**Fix:** fail loudly instead of composing a lie, so a future second call site is caught at
first run rather than in a governance prompt:

```python
if total_phases is None:
    raise ValueError(
        "_run_phase_with_gates: an armed phase needs total_phases — _approval_sentence "
        "states POSITION and a guessed total renders a false one (D-187-01)"
    )
sentence = _approval_sentence(phase, total_phases)
```

(Every in-repo caller — production and the property suite — already passes it.)

---

## Info

### IN-01: Stale docblock — `_ROUTE_ASSIGNED_CODES` is described as "the 2 codes"

**File:** `backend/app/api/workflows.py:441`
**Issue:** The WR-05 composition table still reads
``_ROUTE_ASSIGNED_CODES`` — the 2 codes THIS route mints itself`` after
`unbound_retrieval` made it three. The block 20 lines below (`:460`) was updated; this one was
not.
**Fix:** `— the 3 codes THIS route mints itself`.

### IN-02: Stale docblock — `technicalLine` still says "the reveal is a title swap today"

**File:** `frontend/src/components/workflows/PhaseNodeCard.tsx:194-197`
**Issue:** `/** An extra ⌥-reveal line. **Not passed by the 184 adapter** — the reveal is a
title swap today; … */`. After 187-09 the reveal is a *subtitle* swap. `PhaseNode.tsx` gained a
long explanation of the move; the card the adapter feeds did not. The project's own rule
(`PhaseNode.tsx:183-186`) treats a comment that misdescribes a slot as the same defect as a
false docblock.
**Fix:** replace "the reveal is a title swap today" with "the reveal swaps the SUBTITLE since
187-09 (D-187-16)"; leave the "still Phase 188's" claim, which is accurate.

### IN-03: `PanelState` comment claims four states over a three-member union

**File:** `frontend/src/components/workflows/StarterTemplatePicker.tsx:88-95`
**Issue:** *"Four states, because a fetch has four outcomes"* sits directly above a union with
three members (`loading` / `ready` / `failed`); the fourth ("succeeded but empty") is folded
into `ready` and only reappears as a `rows.length === 0` branch at `:265`.
**Fix:** say so — "Three variants; the fourth outcome (succeeded-and-empty) is `ready` with an
empty `rows`, distinguished at render."

### IN-04: `load()` is invoked from inside a `setState` updater

**File:** `frontend/src/components/workflows/StarterTemplatePicker.tsx:160-165`
**Issue:**
```ts
setOpen((wasOpen) => { if (!wasOpen) load(); return !wasOpen })
```
State updaters must be pure; React double-invokes them under StrictMode and may re-invoke them
when rebasing an update. `requested.current` currently absorbs the duplicate, so no double GET
is observable today — but the guard is incidental, and `load()` itself calls
`setState({kind:"loading"})` from inside another component's update.
**Fix:** read `open` and branch outside the updater:
```ts
const toggle = useCallback(() => {
  if (!open) load()
  setOpen((wasOpen) => !wasOpen)
}, [open, load])
```

### IN-05: `role="status"` and the heading/note paragraphs are non-`menuitem` children of `role="menu"`

**File:** `frontend/src/components/workflows/StarterTemplatePicker.tsx:270-300`
**Issue:** The panel declares `role="menu"` but its first three children are a heading div, a
`<p data-testid="starter-door-note">` and a `<p role="status">`. ARIA requires a `menu`'s
children to be `menuitem`/`menuitemradio`/`menuitemcheckbox`/`group`/`separator`; screen
readers may skip or mis-announce the note and the loading/failed/empty status. There is also no
arrow-key roving focus, which `menu` semantics imply.
**Fix:** either drop to `role="dialog"` / a plain labelled container (the rows stay ordinary
buttons), or move the heading, note and status outside the `role="menu"` element and
`aria-describedby` them from the trigger.

---

## Notes on scope

Items named in `<known_and_not_findings>` (the 33 pre-existing `tsc -b` errors, the
`PublishGauntlet`/`WorkflowBuilderPage.session` cross-file flake, the 62 backend unit failures,
the deliberately un-threaded `canRemovePhase`, the dormant template arm, and `WorkflowCanvas.tsx`'s
size) were verified as already-owned and are **not** reported above.

Two brief items were checked and found sound, recorded here so they are not re-litigated:
`toCanvas` non-mutation and frozen-default identity hold under the injected `nameContext`
(`canvasModel.purity.test.ts:280-354`); and the `graphColumn` grid rewrite
(`grid-rows-[auto_auto_minmax(0,1fr)]` + `[&>*:last-child]:row-start-3`) places correctly in
both the receipt-open and receipt-dismissed child counts.

---

_Reviewed: 2026-08-02T03:17:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
