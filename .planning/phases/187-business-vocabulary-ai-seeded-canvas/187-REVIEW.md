---
phase: 187-business-vocabulary-ai-seeded-canvas
reviewed: 2026-08-02T08:43:10Z
depth: standard
round: 2 (gap closure)
prior_round:
  reviewed: 2026-08-02T03:17:14Z
  commit: 20ae79b6
  path: .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-REVIEW.md
  findings: 2 critical / 7 warning / 5 info
  scope: 38 files (the full phase)
diff_base: ee5fff3b
files_reviewed: 10
files_reviewed_list:
  - frontend/src/components/workflows/SeedReceipt.test.tsx
  - frontend/src/components/workflows/SeedReceipt.tsx
  - frontend/src/components/workflows/StepTypePicker.test.tsx
  - frontend/src/components/workflows/StepTypePicker.tsx
  - frontend/src/components/workflows/definitionOps.test.ts
  - frontend/src/components/workflows/definitionOps.ts
  - frontend/src/components/workflows/phaseVocabulary.corpus.test.ts
  - frontend/src/components/workflows/phaseVocabulary.test.ts
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
carried_forward:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 187: Code Review Report — Round 2 (gap closure)

**Reviewed:** 2026-08-02T08:43:10Z
**Depth:** standard
**Round:** 2 (gap closure — plans 187-16 / 187-17 / 187-18, diff base `ee5fff3b`)
**Files Reviewed:** 10 (3 production source, 7 test)
**Status:** issues_found

## Summary

The closure round was scoped to four round-1 findings. **Three are genuinely closed
(CR-01, CR-02, WR-02); one is closed for the symptom it named but not for the property
its fix docblock now claims (WR-03).** The evidence is code, not commit messages — see
`## Round 1 disposition`.

Verification actually run for this pass:

- `npx vitest run` over the five changed workflow suites: **5 files / 452 tests passed**.
- `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx`: **113 passed**.
- The WR-02 backend justification was re-derived rather than inherited:
  `_build_phase_tool_context` is called from **exactly two** executors —
  `_exec_llm_agent` (`backend/app/services/harness/phase_types.py:521`) and
  `_exec_llm_batch_agents` (`:635`). `_exec_llm_single` (`:466`),
  `_exec_llm_human_input` (`:686`) and `_exec_llm_emit` (`:1151`) never call it. The
  gate's membership is correct.
- `LlmEmitPhaseConfig.citation_policy` at live HEAD is
  `Literal["strict","flag","partial","draft"] = "strict"` — `backend/app/models/harness.py:158`
  (round 1 cited `:155`; the value set is unchanged).
- `canvasModel.isGrounded` really is `groundingCauseOf(phase, kbTools) !== null`
  (`canvasModel.ts:256`), so `SeedReceipt`'s `data-grounded-count === the number of ⛨
  marks the canvas draws` is a true claim.

What survives is concentrated in the **new** surface the fix introduced. The CR-01 repair
split one sentence into two; the second sentence — `seedReceiptCarriedLead`, the receipt's
only statement about `already-set` and `escalated` steps — reached production with **zero
assertions anywhere in the repo**, inside the very suite whose docblock claims *"every
sentence is compared character-for-character against its `definitionOps` export"*. That is
the CR-02 failure class recurring one plan later, and it is why this round still blocks.

---

## Round 1 disposition

### CR-01 — **CLOSED**

Round 1: the receipt's lead counted every non-null `groundingCause` and asserted *"N steps
read your documents, so I set them to must prove it"* over steps the AI never touched.

Evidence of closure:

- `SeedReceipt.tsx:212-217` splits the counts at the point of use:
  ```ts
  const detectedCount = rows.filter((row) => row.cause === "detected").length
  const carriedCount = rows.length - detectedCount
  const groundingLead = seedReceiptGroundingLead(detectedCount)
  const carriedLead  = seedReceiptCarriedLead(carriedCount)
  ```
- `SEED_RECEIPT_ONE_WAY_RULE` now lives **inside** the detected `<p>`
  (`SeedReceipt.tsx:262-272`) and is unreachable when `detectedCount === 0`. That closes
  the second half of CR-01 — round 1's concrete failure scenario rendered the one-way lock
  over an `already-set` step.
- `GroundedRow` gained `cause: Exclude<GroundingCause, null>` and each `<li>` carries
  `data-cause` (`:295`), so "the lead counts only these" is checkable rather than asserted
  in prose.
- The chosen shape deviates from round 1's *minimal* suggested fix (`if (cause !== "detected") continue`)
  and keeps all three causes in the list. That is the **better** of the two options round 1
  offered ("or split the lead so each cause gets its own honest sentence") and it is the
  one consistent with `canvasModel.isGrounded`: every step the canvas seals is still
  explained. Verified: `SeedReceipt.test.tsx:439-451` drives both the zero-detected and
  the escalated-only drafts and asserts the receipt's whole `textContent` does not contain
  the assembled needle `"so I set"`, with a positive control at `:430-437`.

Residual (new, not a CR-01 regression): the *carried* sentence is unguarded — **CR-03** —
and merges two causes that the module's own vocabulary keeps apart — **WR-09**.

### CR-02 — **CLOSED**

Round 1: `citation_policy: "loose"` is not a member of the backend `Literal`, so the
`already-set` branch was switched off inside the only suite guarding the receipt.

Evidence of closure:

- `SeedReceipt.test.tsx:127-150` — the `emit` fixture now carries the **shipped default**
  `citation_policy: "strict"`, which is the value `/generate`'s `model_dump(mode="json")`
  actually emits. `groundingCauseOf` therefore reports `already-set` and the branch is
  live: `SEALED_SLUGS` is 3 while `DETECTED_SLUGS` is 2 (`:161-163`).
- The zero-grounded case (`BARE_PHASES`, `:173-182`) reaches zero with `"draft"` — still a
  representable member — rather than with an unrepresentable one.
- A representability guard was added (`:293-306`): every fixture policy must be in
  `REPRESENTABLE_CITATION_POLICIES`, the assembled `POLICY_NEVER_REPRESENTABLE` must not
  be, and `"strict"` must be *exercised*, not merely permitted.
- The single conflated assertion round 1 named was split into two (`:248-265`): membership
  of the SEALED list and membership of the DETECTED subset. Strictly stronger.

Residual: the guard's member list is a hand-transcribed copy of the backend `Literal` with
no cross-language pin — **WR-10** — and its title over-claims its own scope — **IN-09**.

### WR-02 — **CLOSED**

Round 1: `derivedFace` tier (3) rendered `Search {folder}` on phase types that perform no
retrieval.

Evidence of closure:

- `phaseVocabulary.ts:516` — `if (inputs.folderName && GROUNDING_DIAL_TYPES.includes(inputs.phaseType))`.
  The shared constant is **read**, not re-typed, and `phaseVocabulary.test.ts` pins it at
  exactly `["llm_agent","llm_batch_agents"]` and at exactly one array literal in the
  module.
- The type-space sweep (`phaseVocabulary.test.ts`, "TYPE-SPACE SWEEP") derives its
  expectation from the imported constant and asserts non-vacuity in both directions.
- The two blind spots round 1 named are both now witnesses rather than assumptions: the
  corpus suite asserts a folder-bearing phase exists on **both** sides of the gate, and
  `WorkflowBuilderPage.canvas.test.tsx:2125-2132` adds the page-level negative witness
  (`brief`, an `llm_emit` with a sole *resolvable* `folder_scope`, must read the plain
  type sentence and never `Search Supplier Contracts`).
- Round 1 speculated that `llm_emit` "should be added to that predicate … the
  `LlmEmitPhaseConfig` docblock says it does [bound-scope retrieval]". The closure round
  **refuted that speculation with the executor** rather than inheriting it, and I
  independently confirmed it: `_exec_llm_emit` never calls `_build_phase_tool_context`.
  Excluding `llm_emit` is correct.

Residual: the `IDENTITY_BEARING_CONFIG_KEYS` docblock in `definitionOps.ts` still
describes `folder_scope` as unconditional tier (3) — **IN-08**.

### WR-03 — **PARTIALLY CLOSED**

Round 1: the `＋` menu row read `PHASE_TYPE_SENTENCES` directly, so it said *"Check with
you"* while the card that landed said *"Wait for your approval"*.

Closed for the named symptom:

- `StepTypePicker.tsx:185` now reads
  `nodeTitle(minimalPhaseFor(choice.type, PREVIEW_SLUG, index))`, and the file's
  `PHASE_TYPE_SENTENCES` import is gone.
- `StepTypePicker.test.tsx:517-523` fences the file at **zero** occurrences of the
  assembled `PHASE_TYPE_SENTENCES` identifier and at zero locally-declared sentence
  tables, with a planted-literal control at `:525-538`.
- `:196-246` measures each row against the resolver rather than against a string, with a
  blast-radius control derived by *filtering* `PHASE_TYPE_ORDER` (never a hand-typed list
  of five) and an explicit non-vacuity assertion that the two strings really differ.

**Not closed for the property the fix now claims.** The new docblock states the row
*"asks `nodeTitle` … over the very phase the caller will build"*, and the deliberate
omission of the page's `NameContext` breaks that for `llm_emit`. See **WR-08**.

### Out of scope in round 1 — carried forward, unchanged

The brief names "seven"; the committed round-1 body actually holds **ten** untouched
findings — five warnings (WR-01, WR-04, WR-05, WR-06, WR-07) and five infos (IN-01 … IN-05).
All ten are reproduced verbatim below. None of them was touched by `ee5fff3b..HEAD` (no
backend file and no other frontend file appears in the diff), so **all ten remain open**.
They are not re-litigated here.

<details>
<summary>Carried-forward round-1 findings (verbatim)</summary>

#### WR-01: The armed checkpoint's no-transport fail-safe re-introduces the `_failing_on_failure` read the Pitfall-4 short-circuit exists to delete

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

#### WR-04: The CANVAS-01 totality hardening added to `nodeTitle` is unreachable through the canvas — three sibling resolvers on the same object still throw

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

#### WR-05: `action_risk_approval` validators now get the armed *choices* with un-armed *semantics* — a regression of the T-185-04-01 allow-list on that path

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

#### WR-06: `name_seeded_by_ai` is client-writable on the create/update path, so a hand-typed name can be made deletable

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

#### WR-07: `total_phases`'s fallback composes a false position in the approval prompt

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

#### IN-01: Stale docblock — `_ROUTE_ASSIGNED_CODES` is described as "the 2 codes"

**File:** `backend/app/api/workflows.py:441`
**Issue:** The WR-05 composition table still reads
``_ROUTE_ASSIGNED_CODES`` — the 2 codes THIS route mints itself`` after
`unbound_retrieval` made it three. The block 20 lines below (`:460`) was updated; this one was
not.
**Fix:** `— the 3 codes THIS route mints itself`.

#### IN-02: Stale docblock — `technicalLine` still says "the reveal is a title swap today"

**File:** `frontend/src/components/workflows/PhaseNodeCard.tsx:194-197`
**Issue:** `/** An extra ⌥-reveal line. **Not passed by the 184 adapter** — the reveal is a
title swap today; … */`. After 187-09 the reveal is a *subtitle* swap. `PhaseNode.tsx` gained a
long explanation of the move; the card the adapter feeds did not. The project's own rule
(`PhaseNode.tsx:183-186`) treats a comment that misdescribes a slot as the same defect as a
false docblock.
**Fix:** replace "the reveal is a title swap today" with "the reveal swaps the SUBTITLE since
187-09 (D-187-16)"; leave the "still Phase 188's" claim, which is accurate.

#### IN-03: `PanelState` comment claims four states over a three-member union

**File:** `frontend/src/components/workflows/StarterTemplatePicker.tsx:88-95`
**Issue:** *"Four states, because a fetch has four outcomes"* sits directly above a union with
three members (`loading` / `ready` / `failed`); the fourth ("succeeded but empty") is folded
into `ready` and only reappears as a `rows.length === 0` branch at `:265`.
**Fix:** say so — "Three variants; the fourth outcome (succeeded-and-empty) is `ready` with an
empty `rows`, distinguished at render."

#### IN-04: `load()` is invoked from inside a `setState` updater

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

#### IN-05: `role="status"` and the heading/note paragraphs are non-`menuitem` children of `role="menu"`

**File:** `frontend/src/components/workflows/StarterTemplatePicker.tsx:270-300`
**Issue:** The panel declares `role="menu"` but its first three children are a heading div, a
`<p data-testid="starter-door-note">` and a `<p role="status">`. ARIA requires a `menu`'s
children to be `menuitem`/`menuitemradio`/`menuitemcheckbox`/`group`/`separator`; screen
readers may skip or mis-announce the note and the loading/failed/empty status. There is also no
arrow-key roving focus, which `menu` semantics imply.
**Fix:** either drop to `role="dialog"` / a plain labelled container (the rows stay ordinary
buttons), or move the heading, note and status outside the `role="menu"` element and
`aria-describedby` them from the trigger.

</details>

---

## Round 2 findings

New defects in the 10 changed files. Ids continue round 1's sequence so they cannot collide.

### Critical Issues

#### CR-03: The carried paragraph — the sentence the CR-01 fix introduced — has ZERO assertions anywhere in the repo, and the suite's own stated invariant is now false

**File:** `frontend/src/components/workflows/SeedReceipt.tsx:274-281`, `frontend/src/components/workflows/SeedReceipt.test.tsx:57-66`, `:530-578`

**Issue:**
187-16 split one lead into two. The second one is the receipt's **only** statement about
`already-set` and `escalated` steps:

```tsx
{carriedLead ? (
  <p data-testid="seed-receipt-carried" ...>{carriedLead}</p>
) : null}
```

Measured, repo-wide:

```
$ grep -rn "seed-receipt-carried" frontend/src/
frontend/src/components/workflows/SeedReceipt.tsx:276:          data-testid="seed-receipt-carried"
```

**One hit — the component itself.** `SeedReceipt.test.tsx` does not import
`seedReceiptCarriedLead` (its import block, `:57-66`, lists eight names and that is not one of
them), never queries `seed-receipt-carried`, and its "renders each sentence identically to its
`definitionOps` export" case (`:533-549`) enumerates *heading / lead / one-way / close* and
stops. No page suite touches it either.

Consequences, all of which ship green today:

1. **The paragraph could be deleted entirely** and every one of the 452 passing tests would
   still pass. Nothing asserts its presence.
2. **The count could be wrong** — `carriedCount` could be `rows.length`, or `0`, or
   `detectedCount` — and nothing would notice. `data-detected-count` and
   `data-grounded-count` are pinned; the carried number is pinned nowhere, and it is not
   exposed as an attribute either.
3. **The text could drift from `definitionOps`.** The suite's docblock (`:20-26`) states as a
   named property that *"every sentence is compared character-for-character against its
   `definitionOps` export, never against a hand-typed copy, because a hand-typed copy drifts
   in exactly the same silence the copy module exists to break (T-187-13-05)"*. That sentence
   is now false, and the exception is the sentence this round added. Under this project's own
   rule (`PhaseNode.tsx:183-186` — a comment that misdescribes is the same defect as a false
   docblock) the docblock is a defect independent of the coverage gap.

The nearest thing to coverage is the authorship fence at `:439-451`, which asserts the whole
receipt's `textContent` does **not** contain `"so I set"`. That passes if the carried paragraph
is absent, empty, or printing the wrong number — it only ever measures an absence.

This is CR-02's failure class one plan later: the closure round's own recorded lesson was
*"green over an unrepresentable fixture is not coverage"*, and the fix it wrote is protected by
no fixture at all. Because the receipt is SC#3's surface and the carried sentence is a
governance claim about who applied a lock, an unguarded regression here re-opens CR-01 silently.

**Fix:** import the formatter and assert it the same way its sibling is asserted — presence,
count and character identity — including the zero case.

```tsx
// SeedReceipt.test.tsx
import { seedReceiptCarriedLead, ... } from "./definitionOps"

describe("SeedReceipt — the carried paragraph", () => {
  it("renders the carried sentence character-identically, over the CARRIED count", () => {
    renderReceipt() // 3 sealed, 2 detected ⇒ 1 carried
    expect(screen.getByTestId("seed-receipt-carried").textContent).toBe(
      seedReceiptCarriedLead(SEALED_SLUGS.length - DETECTED_SLUGS.length),
    )
  })

  it("renders it ALONE on the typical non-KB draft — no detected paragraph above it", () => {
    renderReceipt({ phases: STRICT_EMIT_ONLY_PHASES })
    expect(screen.queryByTestId("seed-receipt-grounding")).toBeNull()
    expect(screen.getByTestId("seed-receipt-carried").textContent).toBe(
      seedReceiptCarriedLead(1),
    )
  })

  it("renders NO carried paragraph when every seal is the AI's own doing", () => {
    // 2 detected, 0 carried — the zero case, which is what makes the two above bite.
    renderReceipt({ phases: [phaseBySlug(GROUNDED_PHASES, "contracts")] })
    expect(screen.queryByTestId("seed-receipt-carried")).toBeNull()
  })
})
```

and add the missing entry to the section-4 identity case so the docblock's claim becomes true
again. Consider also emitting `data-carried-count={carriedCount}`, so the third fact is
checkable the same way the other two are.

---

### Warnings

#### WR-08: The `＋` row still fails to preview the card for `llm_emit` whenever the definition carries a template asset — WR-03's stated property does not hold

**File:** `frontend/src/components/workflows/StepTypePicker.tsx:180-185`

**Issue:**
The fix's own docblock (`:8-16`) states the property it establishes: *"The row title asks
`nodeTitle` — THE one title resolution — over the very phase the caller will build with
`minimalPhaseFor` once `onChoose` fires."* But the call deliberately omits the name context:

```ts
const sentence = nodeTitle(minimalPhaseFor(choice.type, PREVIEW_SLUG, index))
```

The caller does **not** omit it. `WorkflowBuilderPage.tsx:613-617` builds one `nameContext`
whose `templateFilename` is read off the DEFINITION's `assets[]`, and both the card and the
"Added …" notice resolve through it (`:1005`, `:1551`, `:1577`, `:1639`). `derivedFace` tier
(2) fires on `llm_emit` from `templateFilename` alone — no phase-level binding is required
(`phaseVocabulary.ts:473-475`), and `phaseVocabulary.test.ts:251-254` pins exactly that: *"an
`llm_emit` step with only the definition template renders `Fill <filename>`"*.

**Failure scenario (concrete, and it is the shipped starter path):** fork the `risk-register`
starter — migration 094 ships it with a `template` asset, and `phaseVocabulary.corpus.test.ts`
asserts ≥3 corpus fixtures carry one. Open the canvas, press `＋` at any lane at or before the
deliverable (`allowedTypesAt` only refuses strictly *after* the last `llm_emit`, so the row is
enabled). The menu reads **"Produce the deliverable"**. Click it. The card that lands, and the
canvas notice that announces it, both read **"Fill risk-register.docx"**. Two sentences for one
choice, one click apart — verbatim the defect WR-03 was raised for, on a different type.

The suite cannot see it: `cardFaceFor` (`StepTypePicker.test.tsx:117-118`) calls `nodeTitle`
with no context either, so expectation and subject share the same blind spot, and the
blast-radius control at `:224-230` actively *pins* `llm_emit`'s row to
`PHASE_TYPE_SENTENCES.llm_emit`.

**Fix:** thread the context the caller will use, and prove the property rather than restating
it.

```tsx
// StepTypePickerProps
/** The page's ONE name context — the same object the card will resolve through
 *  (WorkflowBuilderPage.tsx:613). Omitted only where no caller holds one; a row that
 *  resolves through a different context is not a preview of the card. */
nameContext?: NameContext

// …in the row
const sentence = nodeTitle(minimalPhaseFor(choice.type, PREVIEW_SLUG, index), nameContext)
```

and add the falsifying case — with a template-bearing context, the `llm_emit` row must read
`Fill <filename>` and must NOT read `PHASE_TYPE_SENTENCES.llm_emit`. If threading is rejected,
the docblock must be narrowed to the claim the code actually holds ("the row previews the card
for a definition with no template asset") rather than left stating the general one.

---

#### WR-09: `seedReceiptCarriedLead` merges `already-set` and `escalated` into one "by its own settings" sentence, which misattributes the author's own act

**File:** `frontend/src/components/workflows/definitionOps.ts:613-620`, `frontend/src/components/workflows/SeedReceipt.tsx:213`

**Issue:**
```ts
? `1 step was already set to ${words} by its own settings.`
: `${count} steps were already set to ${words} by their own settings.`
```

`carriedCount` is `rows.length - detectedCount`, i.e. **`already-set` plus `escalated`**. The
two are not the same fact and this module keeps them apart everywhere else:

- `seedReceiptStepReason("already-set")` → `"it already has to cite its sources"`
- `seedReceiptStepReason("escalated")`  → `"you turned this on by hand"`
- `GROUNDING_WHY_ESCALATED` (`:475`)    → `"Because you turned this on by hand."`

So on an escalated-only draft the card reads, two lines apart:

> 1 step **was already set** to must prove it **by its own settings**.
> ⛨ **Weigh the supplier options** — **you turned this on by hand**

"already set … by its own settings" describes a policy default; `grounding_escalated` is the
author's deliberate act, and the receipt's whole job is saying *who did what*. This is CR-01's
shape at smaller scale — one sentence spanning two causes — and the fix's own docblock
(`:596-598`) asserts the property it breaks: *"the sentence … names the step's own settings as
what holds it"*.

Reachability is narrow but not zero: `grounding_escalated` is an ordinary `PhaseSpec` field and
`generate_workflow_definition` neither strips nor re-derives it (grepped: the symbol does not
appear in `backend/app/services/workflow_authoring.py`), so a model emission carrying it
validates and reaches the receipt. `SeedReceipt.test.tsx:387-402` already drives exactly this
draft — it just never reads the sentence (see CR-03).

**Fix:** either give the escalated cause its own sentence, or make the shared one
cause-agnostic so it claims nothing about *what* holds the step:

```ts
// Cause-agnostic, and true of both carried causes:
return count === 1
  ? `1 more step was already set to ${words} before I started.`
  : `${count} more steps were already set to ${words} before I started.`
```

(The "before I started" framing keeps property 2 — no authorship claim — while dropping the
false attribution to "settings". If the two causes are split instead, `SeedReceipt` already
carries `row.cause`, so the counts are one `filter` away.)

---

#### WR-10: The CR-02 representability guard is a hand-transcribed copy of the backend `Literal` with no cross-language pin — it can rot exactly the way CR-02 did

**File:** `frontend/src/components/workflows/SeedReceipt.test.tsx:104-109`

**Issue:**
```ts
const REPRESENTABLE_CITATION_POLICIES: readonly string[] = [
  "strict", "flag", "partial", "draft",
]
```

This is the entire mechanism keeping CR-02 closed, and it is a *transcription*. Nothing
connects it to `backend/app/models/harness.py:158`. If the backend `Literal` gains, loses or
renames a member — or, worse, if the **default** moves off `"strict"`, which is what makes the
`already-set` branch fire at all — this list stays green while describing a value set the
product no longer has. That is the same shape as the `"loose"` fixture: a local claim about a
remote type, unverified.

The project already has the right idiom for this and uses it 200 lines up the same module
family: `phaseVocabulary.ts:118-120` — `__fixtures__/skipParseCases.json` is *read by both*
the vitest suite and `backend/tests/unit/test_183_skip_parse_parity.py`, *"so neither language
can drift alone."* The CR-02 fix did not reach for it.

**Fix:** pin the member set and the default across the language boundary, in the shipped
fixture idiom:

```jsonc
// frontend/src/components/workflows/__fixtures__/citationPolicy.json
{ "members": ["strict", "flag", "partial", "draft"], "default": "strict" }
```

read by `SeedReceipt.test.tsx` for `REPRESENTABLE_CITATION_POLICIES` **and** by a backend unit
test asserting `get_args(LlmEmitPhaseConfig.model_fields["citation_policy"].annotation)` and
`.default` match it. Then a backend edit fails a backend test instead of silently un-covering a
frontend branch.

---

### Info

#### IN-06: The `GROUNDING_DIAL_TYPES` occurrence fence states a count that is wrong and cannot detect the deletion it describes

**File:** `frontend/src/components/workflows/phaseVocabulary.test.ts` (the T-187-17-02 block)

**Issue:**
```ts
// Three reads: the declaration, `groundingCause`'s dial check, and the folder
// tier's gate. A gate written as an inline literal would leave this at two.
const hits = phaseVocabularySource.match(/GROUNDING_DIAL_TYPES/g) ?? []
expect(hits.length).toBeGreaterThanOrEqual(3)
```

Measured at HEAD: `grep -c GROUNDING_DIAL_TYPES phaseVocabulary.ts` → **6**, of which only
three are code (`:277` declaration, `:312` dial check, `:516` gate). The other three
(`:441`, `:458`, `:477`) are prose. Deleting the gate at `:516` leaves **five** hits, so the
`>= 3` threshold still passes — the fence cannot fail for the reason its comment gives, and
"would leave this at two" is arithmetically wrong.

Its sibling ("the two dial type strings appear together in exactly ONE array literal") *does*
catch the inline-literal variant, so the pair is not useless — only the numeric one is
non-biting and mis-documented.

**Fix:** count code occurrences, not prose, e.g. strip block comments before matching, or
assert on the gate expression itself:
```ts
expect(phaseVocabularySource).toMatch(
  /if \(inputs\.folderName && GROUNDING_DIAL_TYPES\.includes\(inputs\.phaseType\)\)/,
)
```

#### IN-07: `"(3) a folder resolves last of the three config tiers, ahead of the human-input tier"` no longer demonstrates any ordering, and its comment contradicts itself

**File:** `frontend/src/components/workflows/phaseVocabulary.test.ts:208-223`

**Issue:** The body now reads
`derivedFace({ phaseType: "llm_agent", folderName: "Board Papers" })` → `"Search Board Papers"`.
After the WR-02 gate, tier (3) fires only on `GROUNDING_DIAL_TYPES` and tier (4) only on
`llm_human_input`, so **no input can reach both tiers** and the (3)-above-(4) ordering is now
unobservable by construction. The `it` title still claims it, and the trailing comment says
both *"it really is tier (3) beating a LOWER tier, not merely tier (3) alone"* **and**
*"`llm_agent` reaches no tier (4)"* — the second sentence refutes the first.

**Fix:** rename to what it now proves (`"(3) a folder names a retrieval step"`) and record in
the comment that the (3)/(4) ordering became unreachable when the gate landed, so a future
reader does not go looking for the assertion that used to prove it.

#### IN-08: `IDENTITY_BEARING_CONFIG_KEYS`'s stated rule is now violated by its own `folder_scope` member

**File:** `frontend/src/components/workflows/definitionOps.ts:193-225`

**Issue:** The docblock states the rule as *"a config edit clears a generator-seeded name
precisely when it could change what the step's face says about that step"* and justifies
`folder_scope` as *"tier (3) of `derivedFace`. The single scoped folder names the step."*
After 187-17 that is only true on `llm_agent` / `llm_batch_agents`. On the other four types a
`folder_scope` edit provably cannot change the face, yet `patchPhaseConfig` (`:270-287`) still
clears both `name` and `name_seeded_by_ai`. No UI path reaches it today —
`FolderScopeField` (`PhaseFormPanel.tsx:347`, `:835`) is a read-only display — so this is
recorded, not blocking.

**Fix:** update the justification to name the gate (as the `available_tools` entry already
does for its own deliberate over-breadth), or gate the demote on the phase type the same way
the tier is gated.

#### IN-09: The CR-02 representability guard's title over-claims — it skips `ESCALATED_PHASES` and every inline fixture

**File:** `frontend/src/components/workflows/SeedReceipt.test.tsx:293-306`

**Issue:** `it("every fixture policy in this file is a value the backend can produce (CR-02)")`
sweeps exactly three arrays (`GROUNDED_PHASES`, `BARE_PHASES`, `STRICT_EMIT_ONLY_PHASES`).
`ESCALATED_PHASES` (`:198-207`) and the four `phases` arrays declared inside `it` bodies
(`:324-331`, `:565-569`, `:594-604`, `:645-652`) are not covered. None carries a
`citation_policy` today, so the guard is correct now — but a future inline `llm_emit` fixture
with an unrepresentable policy would re-create CR-02 without tripping the guard named after it.

**Fix:** collect from one place — export a `const ALL_FIXTURE_PHASES` the guard sweeps and the
cases draw from — or narrow the title to the three arrays it actually reads.

#### IN-10: The receipt lists rows in array order, not run order, and duplicate slugs collide on `key` and `data-testid`

**File:** `frontend/src/components/workflows/SeedReceipt.tsx:193-206`, `:288-291`

**Issue:** Two small totality gaps in the row builder, both pre-existing but now more visible
because the list is the round's subject:

- The `for (const phase of phases)` walk uses the caller's array order. Every other module in
  this family resolves render order first (`definitionOps.orderPhases`, `canvasModel`'s
  identical comparator), so a definition whose JSONB order differs from `phase_index` order
  lists the receipt's steps in a different order from the canvas it explains. The prop doc
  ("The drafted definition's phases, in order") is an assumption, not a guarantee.
- `key={row.slug}` and `data-testid={`seed-receipt-step-${row.slug}`}` assume slug uniqueness.
  `removePhase`'s own docblock (`definitionOps.ts:180-182`) records that duplicate slugs are
  legal in the JSONB. Two sealed duplicates give React a duplicate key and make
  `getByTestId` throw in any future test that resolves that row.

**Fix:** sort by `(phase_index, slug)` before building rows (or accept the caller's order
explicitly in the prop doc), and key on `` `${row.slug}-${index}` `` while keeping `data-slug`
as the semantic hook the suite already resolves by.

---

## Notes on scope

- Items listed as known-and-not-findings were verified as already-owned and are **not**
  reported: the `PublishGauntlet` / `WorkflowCanvas` axe-concurrency flake under whole-glob
  parallel load (D-ITEM-02), and the 33 pre-existing repo-wide `tsc -b` errors (0 in
  `src/components/workflows/`, unchanged by this round).
- Performance is out of v1 scope. Not reported: `StepTypePicker` now allocates six
  `minimalPhaseFor` objects per render, and `SeedReceipt`'s `detectedCount` filter runs outside
  the `useMemo`. Neither is a correctness issue.
- Checked and found sound, recorded so they are not re-litigated: `canvasModel.isGrounded`
  and the receipt share one predicate, so `data-grounded-count` is honest; the
  `WorkflowBuilderPage.canvas.test.tsx` retype of `scan` from `llm_single` to
  `llm_batch_agents` loses no coverage and adds the previously-unmeasured half of the gated
  set; the corpus check-2 falsification control dropping from two members to one is the
  narrowing working (the replacement case measures the *reason* rather than asserting it in
  prose), and it still fails loudly if its remaining member is edited.

---

_Reviewed: 2026-08-02T08:43:10Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard · Round 2 (gap closure)_
