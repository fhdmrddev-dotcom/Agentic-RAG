---
phase: 189
plan: 09
subsystem: backend-harness-executors
tags: [wave-4, red-to-green, no-egress, closed-registry, consequence-not-receipt, falsification-plants]
requires:
  - "189-01 — tests/unit/test_189_no_egress.py (3 V10 REDs observed at HEAD)"
  - "189-04 — grounding.EXTERNAL_ACTION_CAPABILITIES, the ONE runtime home of the D-15 set"
  - "189-07 — models.harness.ExternalActionPhaseConfig (capability + derived available_tools)"
  - "app.services.harness.phase_types PHASE_TYPE_REGISTRY_ENTRIES (shipped)"
  - "app.services.tool_dispatcher.dispatch_tool phase_whitelist refusal (shipped, Phase 091)"
provides:
  - "_exec_external_action — the 7th phase-type executor (D-01/D-02/D-05/D-22)"
  - "the `recorded_intent` sentinel key — the producer half of the D-05 seam (189-11 consumes it)"
  - "the NOT-SENT output body + the T-189-26 receipt fence with its positive control"
  - "V02 — _execute_phase resolves external_action, with an unregistered-type control"
  - "V10 GREEN — SC#4's only mechanical proof"
  - "four DRIVEN proofs that D-03 rides the shipped whitelist with no second guard"
  - "the NL generator's 7th phase-type bullet"
affects:
  - "189-11 (the engine branch that reads `recorded_intent` and writes recorded_not_sent)"
  - "189-08/10/12/13/14/15/16 (the client rollout — NOT started here)"
tech-stack:
  added: []
  patterns:
    - "_exec_programmatic's closed-registry raise, copied in shape and in voice"
    - "the 101.1 sentinel-key-on-an-ordinary-output-dict signal (output['failure'] -> fail_phase)"
    - "the source fence read against the FILE, not the behaviour — which forbids naming a transport even to deny it"
    - "three wrong-fix plants driven into production source, each observed RED"
key-files:
  created: []
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/app/services/workflow_authoring.py
    - backend/tests/unit/test_189_no_egress.py
    - backend/tests/test_harness_engine.py
    - backend/tests/test_harness_whitelist.py
decisions:
  - "The executor names NO transport identifier anywhere, not even in a docstring denying it. Two source fences read this file rather than its behaviour, and both caught an earlier draft of the docstring — a fence with a prose exemption is a fence somebody widens later."
  - "The rendered `text` clips long values; the `recorded_intent` record keeps them WHOLE. The body is for a human, the record is the data Phase 190 will one day actually send."
  - "The receipt fence excises the ONE sanctioned occurrence of a forbidden token (`What this step would have done`) as a visible string before scanning, rather than special-casing `done` inside the rule. An exemption you can see is not a rule you can widen."
  - "test_phase_dispatch_routes_each_of_5_types keeps its stale NAME on purpose — it is referenced by the §D15 baseline command and two prior SUMMARYs, and a rename would make green-to-green comparison across plans ungreppable. The roster inside it is the contract."
metrics:
  duration: "~70 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 5
  tests_added: 12
---

# Phase 189 Plan 09: The Seventh Executor — It Records, and It Sends Nothing Summary

**`_exec_external_action` resolves a capability against the closed set, writes a record that
cannot be read as a receipt, and provably makes no network call.** All three of plan 189-01's
V10 REDs are green with both inertness controls intact; the `mcp` source fence caught my own
docstring and was honoured rather than exempted; and three wrong fixes were planted into
production source and each observed RED — under two of them **the three V10 cases stayed
GREEN**, reproducing 189-05's PLANT E finding exactly.

## What was built

| File | Change | Result |
|---|---|---|
| `backend/app/services/harness/phase_types.py` | the 7th executor + its registry line + 2 copy tables + their agreement fence | +209 / −5 |
| `backend/tests/unit/test_189_no_egress.py` | the D-02 raise case, the T-189-26 receipt fence + its positive control, the D-05 sentinel case | +210 / −0 |
| `backend/tests/test_harness_whitelist.py` | four DRIVEN proofs that D-03 rides the shipped guard | +149 / −0 |
| `backend/tests/test_harness_engine.py` | the roster to 7 + the V02 dispatch case with its control | +55 / −1 |
| `backend/app/services/workflow_authoring.py` | six → seven phase types, and the 7th bullet | +14 / −2 |

| Commit | Task |
|---|---|
| `b09bb361` | Task 1 — the executor, the registry line, V10 RED→GREEN, V02, and three plants |
| `d42b7533` | Task 2 — D-03 proven on the shipped guard (no second path) + the NL generator bullet |

**Whole-plan scope — exactly the five declared files, and the five untouchables are EMPTY:**

```
$ git diff --stat b09bb361~1..HEAD
 backend/app/services/harness/phase_types.py | 214 +++++++++++++++++++++++++++-
 backend/app/services/workflow_authoring.py  |  16 ++-
 backend/tests/test_harness_engine.py        |  56 +++++++-
 backend/tests/test_harness_whitelist.py     | 149 +++++++++++++++++++
 backend/tests/unit/test_189_no_egress.py    | 210 +++++++++++++++++++++++++++
 5 files changed, 637 insertions(+), 8 deletions(-)

$ git diff --stat b09bb361~1..HEAD -- backend/app/api/runs.py backend/app/services/tool_dispatcher.py \
    backend/app/services/openai_service.py backend/app/services/harness_engine.py \
    backend/app/api/threads.py supabase/ frontend/
(empty)

$ git diff --diff-filter=D --name-only b09bb361~1..HEAD    →  (empty; no deletions)
```

**`backend/app/api/runs.py`'s diff is EMPTY, as this plan required and as `189-07` arranged.**
It corrected that docstring in its own commit precisely so this plan would not have to.
`supabase/` is untouched — `189-06` is still paused at the operator's migration checkpoint.

---

## RED → GREEN, quoted side by side

### V10 — SC#4's only mechanical proof

**BEFORE** (re-measured on this working tree before a line was edited — the inherited claim
verified, not assumed: `3 failed, 53 passed` across the three plan files):

```
E       AssertionError: app.services.harness.phase_types._exec_external_action does not exist:
        the 7th executor has not landed yet (plan 189-09). This is the expected Wave-0 RED.
E       assert None is not None

tests\unit\test_189_no_egress.py:113: AssertionError

FAILED tests/unit/test_189_no_egress.py::test_the_external_action_executor_performs_no_network_io[send_email]
FAILED tests/unit/test_189_no_egress.py::test_the_external_action_executor_performs_no_network_io[create_ticket]
FAILED tests/unit/test_189_no_egress.py::test_the_external_action_executor_performs_no_network_io[post_message]
3 failed, 53 passed, 1 warning in 1.16s
```

**AFTER:**

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_189_no_egress.py tests/test_harness_engine.py \
    tests/test_harness_whitelist.py -q --no-header
69 passed, 1 warning in 1.09s
```

**Both inertness controls still PASS** (`test_the_transport_patch_is_not_inert` and its async
half): with the patch installed, `httpx.Client(...).get(...)` and
`httpx.AsyncClient(...).get(...)` each raise the `_EgressAttempted` sentinel. Without them V10
would be vacuous — a patch that bound nothing would let a live sender pass.

### V11 — the `mcp` source fence, and the thing it caught

```
$ grep -rniE "\bmcp\b" backend/app --include=*.py | wc -l
0
```

Green, with its positive control (eight must-fire haystacks, five must-not-fire near-misses).
**The fence fired once during this plan, on my own docstring** — see the Deviations section.

### V02 — the dispatch seam

```
$ venv/Scripts/python.exe -m pytest tests/test_harness_engine.py -q --no-header
41 passed   (was 40)
```

`PHASE_TYPE_REGISTRY_ENTRIES` now holds **7** keys and `_execute_phase` resolves
`external_action` without `PhaseTypeNotRegistered`, driven with an unregistered-type control
first so the absence of a raise is a measurement rather than a hopeful silence.

---

## The closed-set raise, verbatim

```python
    capability = getattr(phase.config, "capability", None)
    if capability not in EXTERNAL_ACTION_CAPABILITIES:
        raise KeyError(
            f"external_action phase {getattr(phase, 'slug', '?')!r}: capability "
            f"{capability!r} is not registered in EXTERNAL_ACTION_CAPABILITIES "
            f"(closed set — register it explicitly)"
        )
```

Beside `_exec_programmatic`'s, whose shape and voice it copies deliberately:

```python
        raise KeyError(
            f"programmatic phase {phase.slug!r}: fn {fn_name!r} is not registered "
            f"in PROGRAMMATIC_PHASE_REGISTRY (closed dict — register it explicitly)"
        )
```

It names the phase slug, the offending value and the closed collection — all three asserted.
The docstring records, in as many words, that the `Literal` already rejects a bad name at parse
time and that **this is the deliberate SECOND line of defence for a row that reached the engine
another way**, so nobody deletes it as redundant.

⚠ The test for it had to reach the engine another way to mean anything: it builds a VALID phase,
drives the clean capability FIRST (so the raise is attributable to the NAME, not to a
raise-on-everything executor), then rewrites the stored value the way a hand-edited JSONB row
would — Pydantic v2 does not re-validate on assignment without `validate_assignment`.

---

## The output body — and why it cannot read as a receipt

Driven through the shipped code path with real resolved inputs:

```
NOT SENT — recorded only.

What this step would have done
  Action   : Sends an email
  recipient: sarah@acme.example
  subject  : Renewal summary
  content  : The Acme renewal is up on 12 September; three line items changed.

No email was sent. Nothing left this workflow. This is a record of an intention, not a receipt.
```

```python
{'capability': 'send_email',
 'inputs': {'recipient': 'sarah@acme.example', 'subject': 'Renewal summary',
            'content': 'The Acme renewal is up on 12 September; three line items changed.'}}
```

**The three binding rules of `189-UI-SPEC.md` §9d are a FENCE, not a convention.**
`_assert_reads_as_not_sent` asserts that the body opens with the negation, carries its
capability's negation from the CLOSED table (and **not** another capability's), ends by naming
what the record is NOT, and contains no success glyph and no past-tense success verb.

Two design notes worth carrying forward:

- **The `content` key is the resolved upstream text, not an invention.**
  `ExternalActionPhaseConfig` carries no input fields of its own — deliberately — so the
  material is the same two sources every neighbouring executor already reads: `ctx.inputs`
  (`_exec_programmatic`'s `run_inputs` bag) and `_latest_phase_text` (the reverse scan
  `_exec_llm_human_input` uses). An explicit run input named `content` WINS over the derived
  one; the author named it.
- **The record keeps values WHOLE; only the rendered text clips them at 500 chars.** The body
  is for a human. The record is the thing Phase 190 will one day actually send, and a truncated
  intent is a worse artefact than a long one. Asserted (`"…" not in record["inputs"]["content"]`).

---

## ANTI-VACUITY: three plants, each observed RED — and TWO of them invisible to V10

The prompt named 189-05's PLANT E as the precedent, and it transferred literally. All three
plants were driven into **production source**, observed, and removed. Restoration verified by
**md5sum against a pre-plant backup** (`01f6fe1a…` before and after) and `grep -c "PLANT"` → **0**.

### PLANT F — a receipt-shaped body (T-189-26's exact failure mode)

`_external_action_body` returns `"✓ Sends an email — done.\n\nDelivered successfully. Sent to …"`:

```
FAILED tests/unit/test_189_no_egress.py::test_the_recorded_output_body_cannot_read_as_a_receipt[send_email]
FAILED tests/unit/test_189_no_egress.py::test_the_recorded_output_body_cannot_read_as_a_receipt[create_ticket]
FAILED tests/unit/test_189_no_egress.py::test_the_recorded_output_body_cannot_read_as_a_receipt[post_message]
3 failed, 13 passed
```

```
E       AssertionError: T-189-26 rule 1: the body must OPEN with the negation, never with the
        action. Got: '✓ Sends an email — done.\n\nDelivered successfully. Sent to
        sarah@acme.example.'
```

**⚠ The three V10 cases stayed GREEN under PLANT F.** SC#4's headline proof asserts a `dict`
carrying a `str` `text` — a phase that told the operator "✓ Delivered successfully" while
sending nothing would have satisfied it completely. The fence added by this plan is the only
thing in the tree that can see it.

### PLANT G — a "helpful" default instead of the D-02 raise

`if capability not in EXTERNAL_ACTION_CAPABILITIES: capability = "send_email"`:

```
FAILED tests/unit/test_189_no_egress.py::test_a_capability_outside_the_closed_set_raises_in_the_executor
1 failed, 56 passed
```

```
E       Failed: DID NOT RAISE <class 'KeyError'>
```

### ⚠ PLANT H — the record silently skipped. THE PLANT E SHAPE, REPRODUCED.

"Nothing is sent" misread as "nothing happens": the executor returns a well-formed, correctly
worded output and records **no intent at all**.

```
FAILED …::test_the_recorded_output_body_cannot_read_as_a_receipt[send_email/create_ticket/post_message]
FAILED …::test_the_output_carries_the_recorded_intent_sentinel[send_email/create_ticket/post_message]
FAILED tests/test_harness_engine.py::test_external_action_dispatches_without_phase_type_not_registered
7 failed, 50 passed
```

```
E       AssertionError: D-05: the executor must carry a `recorded_intent` sentinel holding the
        structured record of what it WOULD have done; got None
```

**And again the three V10 cases stayed GREEN.** This is D-05's rejected alternative — *skipping
the step* — arriving through the back door: a governed step that appears to run, satisfies the
phase's headline test, and leaves nothing behind. 189-05 found the same shape one layer up; the
lesson is now two-for-two and should be treated as a standing requirement rather than a habit.

### PLANT I — "an external action drives no model, so it needs no whitelist"

`_effective_tools` returns `[]` for `external_action` configs:

```
FAILED tests/test_harness_whitelist.py::test_external_action_phase_whitelist_carries_its_capability
1 failed, 27 passed
```

```
E       AssertionError: assert frozenset() == frozenset({'send_email'})
E         Extra items in the right set:
E         'send_email'
```

Restored; md5 `67c1dd93…` before and after, `grep -c "PLANT"` → **0**.

---

## D-03 is PROVEN on the shipped guard — no second path was built

Four cases, all DRIVEN, none of which writes a guard:

| Case | What it drives | Why it is not a re-statement |
|---|---|---|
| `…whitelist_carries_its_capability` | `_build_phase_tool_context` itself — the **main run's** builder | asserting `frozenset(config.available_tools)` would prove a property of the test, not of the run path |
| `…refuses_a_tool_not_on_its_whitelist` | `dispatch_tool`'s shipped refusal | `execute_code` (arbitrary sandboxed Python) is refused on this phase with the byte-identical `tool_not_available_in_phase` envelope |
| `…with_no_handler_is_a_SOFT_error` | `dispatch_tool` → `"Unknown tool: send_email"` | ⚠ asserted deliberately, with a comment forbidding a later "fix" into a raise |
| `…re_read_server_side_so_a_lying_client_changes_nothing` | `resolve_phase_available_tools` (the **Continue** re-read) | a client submitting `["execute_code","search_documents"]` gets `["create_ticket"]` — 189-07's total replacement makes the whitelist strictly NARROWER, never wider |

**The soft-error assertion is the one a future reader is likeliest to "fix", so it carries its
reason inline:** for a phase whose whole point is that nothing is sent, a harmless "unknown
tool" sentence is the SAFEST failure mode available if some future agent ever hallucinates
`send_email` as a tool call. It is what D-22's no-registry-entry choice produces, and it is the
`render_template` two-layer shape MINUS layer 1.

**Measured, not asserted:**

```
$ grep -c "phase_whitelist" backend/app/services/tool_dispatcher.py      →  7   (HEAD: 7 — unmoved)
$ git diff --stat b09bb361~1..HEAD -- backend/app/services/tool_dispatcher.py   →  (empty)
$ git diff --stat b09bb361~1..HEAD -- backend/app/api/runs.py                   →  (empty)
```

---

## The NL generator's 7th bullet

```
- external_action: acts outside the app (`capability`); always asks approval, records rather than sends.
```

`"The 6 phase types you can compose"` → `"The 7 phase types you can compose"`
(`grep -c "The 6 phase types"` → **0**, `"The 7 phase types"` → **1**,
`grep -c "external_action"` → **2** — the bullet plus its comment).

**LENGTH IS A CONSTRAINT AND IT WAS MEASURED, NOT EYEBALLED.** The six shipped bullets are
67 / 60 / 84 / 85 / 121 / 83 characters — **median 83.5**, so the +25 % bound is **104.4**. The
new bullet is **104**. An over-long bullet is a nudge, and a nudge in a generator prompt skews
composition toward the type it describes.

**The three `capability` values are deliberately NOT listed.** The emit tool advertises the
`WorkflowDefinition` schema, whose `Literal` already enumerates them; a second copy in the
prompt is one more place for them to drift. Both facts an author needs are present: it always
stops for approval before acting outside, and in this milestone it records rather than sends.

Without this bullet Phase 187's AI-seed could never emit an `external_action` node and the
type would be reachable only by hand.

---

## Deviations from Plan

### Rule 2 — missing critical functionality

**1. [Rule 2] The executor's docstring may name NO transport identifier, not even to deny one**

- **Found during:** Task 1, on the first run after the executor landed.
- **Issue:** the docstring said *"No `httpx`, no `requests`, no socket, no MCP client — there is
  ZERO MCP code in `backend/app`"*. **`test_no_mcp_identifiers_in_backend_app` went RED on it**,
  and separately the plan's own acceptance criterion greps this executor's body for
  `httpx|requests|aiohttp|socket` and requires **0** — which read **2**. Both fences read the
  FILE, not the behaviour, so a denial is indistinguishable from a use.
- **Fix:** the docstring now states the property without naming any transport, and **records why
  it cannot** — a fence with a prose exemption is a fence somebody widens later, and *"the token
  appears zero times in the app"* is a claim you can only make if it appears zero times. The
  paragraph explaining this is itself the paragraph that tripped both fences, which is noted in
  it as the best available argument for them.
- **Measured after:** the executor-body grep → **0**; the tree-wide `mcp` grep → **0**.
- **Commit:** `b09bb361`

**2. [Rule 2] The receipt fence needs a sanctioned exemption for the subjunctive header, made VISIBLE**

- **Found during:** Task 1, writing the fence.
- **Issue:** the plan forbids the past-tense success verb `done`. UI-SPEC §9d's own mandated
  block header is **"What this step would have done"**. A naive substring rule would have made
  the specified body unwritable; a naive fix (drop `done` from the token list) would have let a
  real `— done.` through, which is exactly what PLANT F emitted.
- **Fix:** the ONE sanctioned occurrence is excised as a named constant BEFORE the scan
  (`_SUBJUNCTIVE_HEADER`), rather than special-cased inside the rule. An exemption you can see
  is not a rule you can widen — and PLANT F confirms `done` still fires everywhere else.
- **Commit:** `b09bb361`

**3. [Rule 2] The two copy tables are fenced against the closed set at import time**

- **Found during:** Task 1.
- **Issue:** the closing negation and the business phrase are keyed by capability. A 4th
  capability added to `EXTERNAL_ACTION_CAPABILITIES` alone would `KeyError` at run time in the
  best case, or silently fall back to a generic sentence in a "defensive" refactor — which is
  how "No email was sent." becomes something softer.
- **Fix:** a module-level `assert` that the two tables' keys and `EXTERNAL_ACTION_CAPABILITIES`
  are the same set, in the same shape `grounding.py` already puts under that frozenset. Static
  and data-independent: it can only fire when someone edits one of the three spellings.
- **Commit:** `b09bb361`

**4. [Rule 2] Two tests the plan did not ask for**

`test_the_output_carries_the_recorded_intent_sentinel` (×3) asserts the D-05 producer half —
the record's keys are exactly `{capability, inputs}`, the resolved inputs carry both sources,
and the record is NOT clipped. **PLANT H is invisible without it.** And
`test_the_receipt_fence_actually_fires` drives six receipt-shaped plants through
`_assert_reads_as_not_sent`, one per rule, so the fence's green is a measurement rather than a
hope — the same vacuity class 189-01's `mcp` matcher control guards.

### Rule 3 — a blocking issue

**5. [Rule 3 — Blocking] `test_phase_dispatch_routes_each_of_5_types` asserted a 6-member SET**

- **Found during:** Task 1, before the registry line landed.
- **Issue:** `test_harness_engine.py:232` asserts `set(PHASE_TYPE_REGISTRY) == {…6 names}`. A
  7th key makes it RED — an inherited fence, not a defect.
- **Fix:** `external_action` added to the roster with its inline reason. **The test's stale NAME
  was deliberately left alone:** it is referenced by the §D15 baseline command and by two prior
  SUMMARYs, and renaming it would make green-to-green comparison across plans ungreppable. The
  roster inside it is the contract; the name was already stale at 101.1, and the docstring now
  says so.
- **Commit:** `b09bb361`

---

## Re-derived, not inherited

Every load-bearing figure was re-taken on this working tree on 2026-08-07.

| Claim | How | Result |
|---|---|---|
| the three V10 REDs | re-run before any edit | ✅ **3 failed / 53 passed**, exactly as 189-01 recorded |
| nine-file 189-scope baseline | re-run before any edit | **2 failed / 177 passed** (⚠ RESEARCH §D15's `166 passed` is stale — 189-07 added 11) |
| `tests/unit` pre-plan | the three plan files reverted to `b09bb361~1` and the suite re-run | ✅ **65 failed / 1733 passed** — 189-07's figure CONFIRMED by measurement, not carried |
| `grep -rniE "\bmcp\b" backend/app` | run | ✅ **0** |
| `send_email` in `openai_service.py` / `tool_dispatcher.py` | `grep -c` | ✅ **0 / 0** — D-22 holds, both files untouched |
| `grep -c "phase_whitelist" tool_dispatcher.py` | HEAD vs now | ✅ **7 / 7** — no parallel guard |
| the six shipped prompt bullets' lengths | computed, not eyeballed | 67/60/84/85/121/83, **median 83.5** |
| `_exec_programmatic` / `_exec_llm_single` / `_effective_tools` / `PHASE_TYPE_REGISTRY_ENTRIES` | symbol search, never a line seek | `:433` / `:466` / `:279` / `:1658` at read time — **all four HELD**; no pointer in this plan's `<read_first>` was stale |
| `ExternalActionPhaseConfig` carries no input fields | read the class | ✅ HOLDS — "NO SHAPE-SYMMETRY OPTIONALS, and the omission is the decision" |
| `_StrictBase` has no `validate_assignment` | read `model_config` | ✅ HOLDS — which is what makes the hand-edited-row test possible |

⚠ **One caution for the next plan.** `tests/unit` now reads **62 failed**, and project memory
carries a stale **"62-red"** figure for that suite from a completely different composition. The
two numbers agreeing is a coincidence. The defensible statement is the DELTA, below.

---

## Verification

**The plan's `<verification>` command:**

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_189_no_egress.py tests/test_harness_engine.py \
    tests/test_harness_whitelist.py -q --no-header
69 passed, 1 warning in 1.09s
```

**The nine-file 189-scope command (§D15) — only the two named pre-existing failures:**

```
$ venv/Scripts/python.exe -m pytest <the nine §D15 files> -q --no-header
2 failed, 178 passed, 3 warnings in 2.05s

FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette
FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_fields_come_from_the_bundle
```

| | Before | After | Delta | Accounted for by |
|---|---|---|---|---|
| failed | 2 | **2** | 0 | the two pre-existing `asyncpg … pool is closing` live-DB rows, unmoved |
| passed | 177 | **178** | **+1** | the new V02 dispatch case |

**BLAST RADIUS — the whole `tests/unit` tree, measured BOTH ways and accounted for EXACTLY.**
The three files in `tests/unit`'s reach were swapped to their `b09bb361~1` contents, the suite
re-run, and the files restored (`git diff HEAD -- backend/` → empty afterwards):

| | pre-plan | after 189-09 | Delta |
|---|---|---|---|
| `tests/unit` failed | **65** | **62** | **−3** |
| `tests/unit` passed | **1733** | **1744** | **+11** |

**−3 = the three V10 cases flipping green. +11 = those 3 plus the 8 new tests in
`test_189_no_egress.py`. The reconciliation is exact, so this plan introduced ZERO regressions
anywhere in `tests/unit`** — including the 62 pre-existing failures, which are unmoved.

**Targeted:**

| Command | Result |
|---|---|
| `pytest tests/unit/test_189_no_egress.py -q` | **16 passed** (was 3 failed / 5 passed) |
| `pytest tests/test_harness_engine.py -q` | **41 passed** (was 40) |
| `pytest tests/test_harness_whitelist.py -q` | **12 passed** (was 8) |
| `pytest tests/unit/test_audit_event_registration.py -q` | **green — D-09 holds, no new audit event type** |
| `pytest tests/test_182_grounding_bundle.py -k "author_facing or external_action"` | **1 passed — V22 still GREEN** |
| `pytest tests/unit/test_187_authoring_step_names.py -q` | **green — the prompt edit did not break its `name` assertions** |

**Acceptance greps:**

| Check | Command | Result |
|---|---|---|
| no transport in the executor body | grep over the 189 block | **0** ✅ |
| D-22 holds | `grep -c "send_email"` over `tool_dispatcher.py` / `openai_service.py` | **0 / 0** ✅ |
| the registry has SEVEN keys | `len(PHASE_TYPE_REGISTRY_ENTRIES)` | **7** ✅, the new line carries an inline `# 189 CONN-01` comment |
| additive diff | every `-` line in `phase_types.py` | **5 deletions, ALL prose** (a docblock count, two comment lines, a docstring count) — **no shipped executor's body changed** ✅ |
| plants removed | `grep -c "PLANT"` + md5 vs backups | **0**, md5 identical ✅ |

**Frontend: untouched.** `git diff -- frontend/` is empty across the whole plan, so no `tsc` and
no count-gate movement is possible. (Neither was re-run; there is nothing for them to see.)

---

## Deferred Issues

None new. Two pre-existing items were **not** touched, and one constraint is carried forward:

- **`D-189-DEF-01`** — `test_182_extraction_parity.py::test_nl_gen_regression_test_count_unchanged`,
  RED since 189-02. **Verified as not mine:** it fails `assert 7 == 2` counting test defs in
  `tests/unit/test_103_grounding_fidelity.py`, a file this plan adds nothing to.
- the two `test_182_grounding_bundle.py` `pool is closing` failures — live-DB, pre-existing,
  unmoved and still exactly two.
- **`D-189-DEF-02` is carried, not closed.** `PhaseFormPanel`'s generic tool rail would render a
  capability struck through and still pressable. This plan does not touch the frontend, so the
  constraint stands unchanged for **189-13**: **scope the generic rail AWAY from `external_action`
  rather than widening `toolOptions`.** This plan strengthens the argument twice over — the
  capability is not in `_TOOL_REGISTRY` or `get_tools()` (V22 green), so widening the rail is the
  D-20 leak; and `available_tools` is DERIVED by total replacement, so an author cannot
  legitimately edit that list at all.

## What plan 189-11 owes

**The engine seam.** `harness_engine.py`'s `_emit_failure` sentinel branch (re-derive by symbol;
it was `~:1605-1623` at plan time) gains a THIRD branch reading `output.get("recorded_intent")`
→ `record_phase_not_sent(...)` → `status = 'recorded_not_sent'`. **Placement is what buys "the
run continues"** — the unconditional `advance_current_phase` sits just below, so the third
branch inherits the CONTINUE for free rather than needing new control flow. The producer half is
shipped here and the key is exported as `phase_types.RECORDED_INTENT_KEY`, so the two ends cannot
drift on a bare string literal. ⚠ **That branch cannot be verified end-to-end until the operator
applies migration 115** — `workflow_phases_status_check` still caps `status` at five values.

## Authentication Gates

None.

## Known Stubs

None. No placeholder values, no hardcoded empties, no "coming soon". The executor's "no-op" is
the *specified behaviour* of this milestone (D-05), not a stub: it resolves a real capability,
composes a real body from real resolved inputs, and returns a real structured record. What 190
replaces is one function, by design.

## Threat Flags

None — this plan adds no network endpoint, no auth path, no file-access pattern and no schema
change. Its own register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-03** — Information Disclosure: outbound egress (**SC#4**) | **mitigated** | V10 green for all three capabilities with the transport patched to raise, plus BOTH inertness controls. V11 green with its positive control; `grep -rniE "\bmcp\b" backend/app` → **0**. The executor body names no transport identifier at all — and the fence caught the one draft that did. |
| **T-189-02** — Tampering: dynamic resolution of a capability name | **mitigated** | The closed-set raise, copying `_exec_programmatic`. Never `eval`'d, never defaulted. **PLANT G observed RED.** The comment recording it as the deliberate second line of defence is in the docstring. |
| **T-189-05** — EoP: the capability becoming an LLM-callable tool (**D-22**) | **mitigated** | No agent loop, no tools override, no model call. `grep -c "send_email"` → **0 / 0** over `tool_dispatcher.py` and `openai_service.py`; both diffs EMPTY. Case C and V22 both green. |
| **T-189-26** — Repudiation: a recorded intent that reads like a receipt | **mitigated** | The body opens with the negation, closes from the CLOSED table, names what the record is NOT, and carries no glyph or success verb — **driven RED by PLANT F**, whose failure the three V10 cases could not see. The fence itself has a six-plant positive control. |
| **T-189-27** — Spoofing: a client lying about a phase's tools | **accept-and-inherit, PROVEN** | `resolve_phase_available_tools` re-reads server-side, `dispatch_tool` refuses off-whitelist names with a `tool_refused` audit, and 189-07's total replacement makes a lying list strictly NARROWER. Four driven cases; no second guard built. |
| **T-189-28** — Tampering: the NL generator emitting a malformed `external_action` phase | **mitigated** | Generated definitions are re-parsed by `WorkflowDefinition.model_validate`, where `_StrictBase`, the `capability` Literal and the D-04 arming pin all apply. The bullet is length-bounded (104 vs a 104.4 ceiling) so it cannot skew generation toward the type. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

- `backend/app/services/harness/phase_types.py` — FOUND
- `backend/app/services/workflow_authoring.py` — FOUND
- `backend/tests/unit/test_189_no_egress.py` — FOUND
- `backend/tests/test_harness_engine.py` — FOUND
- `backend/tests/test_harness_whitelist.py` — FOUND
- `.planning/phases/189-governed-external-action-node-model/189-09-SUMMARY.md` — FOUND
- commit `b09bb361` — FOUND
- commit `d42b7533` — FOUND
- `git diff HEAD -- backend/` — EMPTY (no plant residue, no uncommitted work)
- `grep -c "PLANT"` over `phase_types.py` — **0**
</content>
</invoke>
