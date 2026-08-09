---
phase: 189
plan: 02
subsystem: backend-tests
tags: [wave-1, red-first, falsification, publish-gauntlet, governance, no-source-change]
requires:
  - "app.services.harness.publish_service (shipped — stage 2.5 / 2.6 / 3)"
  - "app.services.harness_engine._run_phase_with_gates + the D-187-01 armed checkpoint (shipped)"
  - "app.services.harness.grounding.assemble_grounding_bundle / grounding_verdicts (shipped)"
  - "app.services.ask_user_service.subscribe_for_response (shipped — patched, never awaited for real)"
provides:
  - "V20 precursor — the D-19 golden-run falsification, RED at HEAD with the timeout VALUE recorded"
  - "V21 — the D-20 stage-2.6 falsification, RED at HEAD across all three capabilities"
  - "V22 — the D-20 leak guard, authored green and proved non-vacuous by an observed plant"
  - "four standing controls that forbid the three REJECTED fix shapes (Option B, Option C, disabling rule 2)"
affects:
  - "189-04 (must turn V21 green by widening tool_names ONLY; V22 must stay green)"
  - "189-05 (must turn both D-19 cases green without disarming a live run)"
  - "189-11 (V20's final green)"
tech-stack:
  added: []
  patterns:
    - "test_187_armed_checkpoint_property.py's REAL-_run_phase_with_gates drive, narrowed to one observable"
    - "a raising sentinel recorder in place of subscribe_for_response — the wedge is instant, never awaited"
    - "read the production tool_names off assemble_grounding_bundle, never re-derive it from get_tools(None)"
    - "anti-vacuity: every absent-thing assertion carries its own positive control in the same test"
key-files:
  created: []
  modified:
    - backend/tests/unit/test_publish_service.py
    - backend/tests/unit/test_103_grounding_fidelity.py
    - backend/tests/test_182_grounding_bundle.py
    - .planning/phases/189-governed-external-action-node-model/189-VALIDATION.md
decisions:
  - "The plan's named file for CONFLICT 1 (tests/test_publish_gate.py) was measured WRONG — it is the Phase-136 SKILL publish gate and does not import publish_service at all. The falsification was authored in tests/unit/test_publish_service.py, the workflow gauntlet's actual home, and 189-VALIDATION.md's V20 pointer was corrected in the same wave."
  - "CONFLICT 1 is captured in TWO tests, not one: the PROPERTY (zero subscribes on a golden run) and the MECHANISM (the recorded timeout is None inside a 7200s budget), so 189-05's reader can tell which half moved."
  - "tool_names is read off the production assemble_grounding_bundle rather than recomputed from get_tools(None) — a re-typed set would stay RED after 189-04 and would have to be edited to go green, which is a test that measures the patch."
metrics:
  duration: "~50 min"
  completed: 2026-08-07
  tasks: 3
  commits: 3
  files_created: 0
  files_modified: 3
  tests_added: 9
---

# Phase 189 Plan 02: The Two Publish-Gauntlet Conflicts, Captured RED Summary

**D-06 ("a workflow containing the node PUBLISHES and RUNS") is now proved FALSE at HEAD —
twice, by driven tests, in 1.41 seconds** — plus the single net-new security property 189
owes, authored green and proved non-vacuous by an observed plant.

## What was built

| File | Rows | Tests added | At HEAD |
|---|---|---|---|
| `backend/tests/unit/test_publish_service.py` | **CONFLICT 1 / D-19 / V20 precursor** | 5 | **2 RED**, 3 controls green |
| `backend/tests/unit/test_103_grounding_fidelity.py` | **CONFLICT 2 / D-20 / V21** | 4 | **1 RED**, 3 controls green |
| `backend/tests/test_182_grounding_bundle.py` | **the D-20 leak guard / V22** | 1 | **green** (a standing fence) |

**No source file was modified.** `git diff --stat 86290a97~1..HEAD -- backend/app
frontend/src` is **empty**. (`supabase/` carries pre-existing Supabase-CLI snippet churn
that predates this plan and was never staged.)

---

## THE VERBATIM REDs

### CONFLICT 1 (D-19) — an armed phase kills a golden-run publish

Two independent REDs, both from a drive of the **REAL** `harness_engine._run_phase_with_gates`
over an **armed `llm_single` phase** — a SHIPPED type, so the defect is proved
**pre-existing** rather than one 189 introduces.

**RED 1 — the property.** `test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run`:

```
E       AssertionError: D-19 / CONFLICT 1: an armed phase SUBSCRIBED TO THE ASK CHANNEL on a golden run.
        subscribe_for_response was awaited 1 time(s) with timeout_seconds=[None] — and `None` is what
        ask_user_service.subscribe_for_response's own docstring calls 'wait indefinitely'. Nobody is
        watching a synchronous publish's ask channel, so this burns the full
        settings.harness_publish_max_seconds budget and the publish returns
        blocked_stage='golden_run_timeout'. D-06 ('a workflow containing the node PUBLISHES and RUNS')
        is FALSE while this is true. Owner: plan 189-05.
E       assert [None] == []
E
E         Left contains one more item: None

tests\unit\test_publish_service.py:729: AssertionError
```

> **The two numbers the plan asked to be recorded verbatim:**
> **subscribe call count — expected `0`, observed `1`.**
> **recorded `timeout_seconds` — `None`.**

**RED 2 — the mechanism.** `test_the_armed_golden_run_subscribe_carries_the_indefinite_wait`:

```
E       AssertionError: D-19 / CONFLICT 1 mechanism: the golden run's armed checkpoint awaited
        subscribe_for_response with timeout_seconds=[None]. `None` is harness_engine's
        `timeout_seconds = None if is_action_risk` — the indefinite wait — inside a request bounded at
        7200s. That is the 2-hour publish death, stated as the value that causes it.
E       assert None not in [None]
E        +  where [None] = namespace(timeouts=[None], body_invoked=False, wedged=True).timeouts

tests\unit\test_publish_service.py:764: AssertionError
```

`settings.harness_publish_max_seconds` was **read from config, not re-typed**, and asserted
== **7200** before the drive — so the "2 hours" in every prose account of this defect is now
a measured figure inside the suite rather than an inherited one.

**⚠ NOTHING WAITED.** `subscribe_for_response` is replaced by `_SubscribeRecorder`, which
records the positional `timeout_seconds` and **raises `_AskChannelSubscribed`** instead of
awaiting. The hang is proved by its MECHANISM (the resolved value and the path taken), never
by wall clock. The whole 25-test file runs in **0.57 s**.

**Controls that PASS today** (each one forbids a specific REJECTED fix shape):

| Test | What it forbids |
|---|---|
| `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` | Turning RED 1 green by **disarming the checkpoint everywhere** — the wire-around D-04/SC#2 forbid. Asserts `timeouts == [None]`, `wedged is True` AND `body_invoked is False`. |
| `test_the_armed_checkpoint_is_not_a_validator` | **CONFLICT-1 Option B** — naming armed phases in `_interactive_phase_failures`, which makes the workflow unpublishable and contradicts D-06 outright. Carries a positive control that the helper still flags `llm_human_input` and `ask_user`, so the emptiness is a measurement. |
| `test_an_armed_definition_reaches_the_stage_3_golden_run` | The composition end-to-end through the real `publish` pipeline: `blocked_stage != "interactive_phase"` and `_drive_golden_run.assert_awaited_once()`. This is the door the indefinite subscribe walks through. |

**Option C** (publishing a synthetic approval onto the ask channel, which writes a
`validator_ask_user_approved` receipt claiming a human approved when none did — the
`consequence ≠ receipt` rule) is not mechanically fenced here; the receipt-count assertion
that catches it already ships as `test_187_armed_checkpoint_property.py::test_p3_…`. Named
in the docstring so 189-05 meets it as a constraint rather than rediscovers it.

---

### CONFLICT 2 (D-20 / V21) — a capability in `available_tools` blocks stage 2.6

`test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding` — the
**verbatim finding dicts, all three**:

```
E       AssertionError: D-20 / CONFLICT 2: stage 2.6 rule 2 refuses
        ['create_ticket', 'post_message', 'send_email'] — the external-action capabilities D-03 puts
        in available_tools. Findings emitted:
        [{'code': 'unregistered_tool', 'phase': 'research', 'message': "phase 'research' references a non-registered tool 'create_ticket'"},
         {'code': 'unregistered_tool', 'phase': 'research', 'message': "phase 'research' references a non-registered tool 'post_message'"},
         {'code': 'unregistered_tool', 'phase': 'research', 'message': "phase 'research' references a non-registered tool 'send_email'"}].
        tool_names is built from get_tools(None) (the LLM-facing SCHEMA list) and D-22 keeps these
        three OFF it, so a workflow containing the node BLOCKS at stage 2.6 and D-06 is FALSE.
        Fix: union EXTERNAL_ACTION_CAPABILITIES into tool_names for the fidelity check ONLY — never
        into GroundingBundle.tools (the D-20 leak, fenced by V22), never as a phase_type exemption
        inside rule 2.
E       assert {'create_tick... 'send_email'} == set()

tests\unit\test_103_grounding_fidelity.py:315: AssertionError
```

The finding dict for `send_email`, isolated as the plan asked:

```python
{'code': 'unregistered_tool',
 'phase': 'research',
 'message': "phase 'research' references a non-registered tool 'send_email'"}
```

Asserted on the **SET**, so a partial fix registering only one name cannot pass.

**Controls that PASS today:**

- `test_a_genuinely_unknown_tool_still_produces_the_finding` — `["definitely_not_a_tool"]`
  still produces **exactly one** finding, with its `code`, `phase` slug and message all
  asserted. **This forbids turning V21 green by disabling rule 2**, which would retire a
  shipped governance rule rather than widen it by three reviewed names. It also proves the
  RED's `offenders == set()` target is reachable at all — same helper, same `tool_names`
  source, same definition shape.
- `test_a_shipped_tool_is_still_accepted_alongside_a_capability` — a real registered tool
  stays clean in the **mixed** whitelist (`search_documents` + the three), the shape a real
  workflow produces. Forbids a fix that turns rule 2 into a pass-through.
- `test_the_capability_set_agrees_with_the_wave_0_suite` — the closed set is asserted equal
  to `test_189_external_action_model.EXPECTED_CAPABILITIES` and `len == 3` (D-15), so a
  fourth name, a rename or a typo fails loudly in whichever Wave-0 file is edited second.

---

### V22 — the D-20 leak guard, and the plant that proved it fires

`test_external_action_capabilities_are_absent_from_the_author_facing_tool_options`
**PASSES at HEAD.** It is a standing fence authored *before* the change that could break
it, not a Wave-0 RED — so its value depends entirely on it being non-vacuous. That was
**driven, not assumed**: `get_tools()` was temporarily patched to advertise a `send_email`
schema (the exact wrong fix D-20 rejects), and the guard went RED:

```
E       AssertionError: D-20 GOVERNANCE HOLE: ['send_email'] reached GroundingBundle.tools, which is
        served on GET /workflows/grounding-bundle and bound straight into PhaseFormPanel's
        author-facing whitelist rail. An author can now tick 'send_email' on an ORDINARY, UNARMED
        llm_agent step — bypassing the external_action type's structural arming and wiring around the
        gate D-04 and SC#2 make undisarmable. The stage-2.6 fidelity gate must be widened via
        tool_names ONLY (a closed EXTERNAL_ACTION_CAPABILITIES frozenset unioned in for the fidelity
        check), never via get_tools() / GroundingBundle.tools.
E       assert frozenset({'send_email'}) == set()

tests\test_182_grounding_bundle.py:322: AssertionError

1 failed, 7 deselected, 1 warning in 0.36s
```

**The plant was removed before commit and is provably not in the tree:**
`grep -c "PLANT" backend/tests/test_182_grounding_bundle.py` → **0**, and the committed
diff's only "plant" occurrences are the two docstring lines that record this observation.

The guard carries **three** assertions, and the first two exist solely so the third cannot
pass vacuously: `tools` is **non-empty**, `tools` contains a **known shipped tool**
(`search_documents` — so it is demonstrably the real registry rather than an arbitrary
non-empty list), and only then `tools` is **disjoint** from the closed capability set. A
disjointness assertion against an empty list is vacuous, and a vacuous security guard is
worse than none.

---

## Deviations from Plan

### Rule 3 — a blocking issue: **the plan's named file for CONFLICT 1 was measured WRONG**

**1. [Rule 3 — Blocking] `backend/tests/test_publish_gate.py` is the SKILL publish gate, not the workflow gauntlet**

- **Found during:** Task 1, at the `<read_first>` step.
- **Issue:** The plan named `backend/tests/test_publish_gate.py` in `files_modified`, in its
  `must_haves.artifacts`, and in its `key_links` — and instructed *"Use its existing
  publish-driving fixture and its judge mock. Do not build a second harness."* **That
  instruction is not satisfiable.** Measured 2026-08-07: the file is *"Phase 136 (GATE-01) —
  skill publish gate"*, 503 lines about `compute_publish_gate(supabase, skill_id, user_id)`
  over `eval_runs` / `skill_versions` rows. It has **no publish-driving fixture, no judge
  mock, and does not import `publish_service` at all** —
  `grep -rln "publish_service\|run_publish_gauntlet\|golden_run" backend/tests/` returns
  twelve files and **this is not one of them**. The claim was inherited: `189-RESEARCH.md`
  §D15 names it as one of "the two Conflict surfaces" and `189-VALIDATION.md` V20 pointed
  `pytest tests/test_publish_gate.py -q` at it.
- **Fix:** Authored the CONFLICT-1 falsification in **`backend/tests/unit/test_publish_service.py`**
  — *"Phase 102 (QUAL-01) — the server-side publish path"*, which owns `_definition_row`,
  the `_call` publish driver, the `_judge_golden_output` mock, the `_drive_golden_run` mock,
  `_interactive_definition_row`, `test_interactive_phase_failures_helper_detects_both_forms`
  and the shipped `golden_run_timeout` test. That is the plan's "existing publish-driving
  fixture and its judge mock", and the new tests reuse all of it — no second harness was
  built. Putting a workflow-gauntlet test in a skill-gate file would have violated
  CLAUDE.md's one-home-per-concern rule and left the next reader with two homes.
- **Also fixed, so the false claim is not inherited a third time:** `189-VALIDATION.md`'s
  V20 row now points at `tests/unit/test_publish_service.py` and names the four tests
  189-05 must respect; the Test-Infrastructure table records that **the 9-file backend
  command does NOT cover the D-19 falsification** and must be run as ten.
  `189-RESEARCH.md` is left untouched — it is a dated measurement record, not a live map.
- **Files modified:** `backend/tests/unit/test_publish_service.py`,
  `.planning/phases/189-governed-external-action-node-model/189-VALIDATION.md`
- **Commit:** `86290a97`

### Rule 2 — missing critical functionality

**2. [Rule 2] CONFLICT 1 is captured as TWO tests, not one**

- **Found during:** Task 1.
- **Issue:** The plan's case 1 asserts the call count *and* the `None` timeout in one test.
  Combined, a 189-05 fix that made the golden run subscribe with a SHORT timeout would fail
  both, and a reader of the single failure could not tell which half had moved — while a fix
  that skipped the subscribe entirely (the correct one) would silence both at once with no
  record of which property carried the weight.
- **Fix:** Split into the PROPERTY (`…does_not_subscribe_to_the_ask_channel_on_a_golden_run`
  — zero subscribes) and the MECHANISM
  (`…subscribe_carries_the_indefinite_wait` — `None`, inside the 7200 s budget read from
  config). Both are RED today; both are recorded verbatim above.
- **Files modified:** `backend/tests/unit/test_publish_service.py`
- **Commit:** `86290a97`

**3. [Rule 2] The anti-vacuity control was moved INSIDE the CONFLICT-1 property test**

- **Found during:** Task 1, applying 189-01's recorded lesson directly.
- **Issue:** `assert golden.timeouts == []` is trivially satisfied by a drive that never
  reached the checkpoint — a broken fixture, a `PhaseSpec` that failed to arm, an
  `effective_phase` that dropped the flag. It would then be **green forever, proving
  nothing**, which is exactly the failure class 189-01 caught in its own plan.
- **Fix:** The property test runs the NON-golden drive FIRST and asserts it subscribed
  exactly once, before asserting the golden drive's silence. The named control
  (`test_a_live_non_golden_run_still_pauses_on_an_armed_phase`) is kept as well — the
  in-test control makes the RED honest; the named one is the standing fence 189-05 must not
  break. Additionally `_drive_armed_phase` asserts `raw.action_risk_armed is True` before
  driving, so a fixture that silently stopped being armed fails as an assertion.
- **Files modified:** `backend/tests/unit/test_publish_service.py`
- **Commit:** `86290a97`

**4. [Rule 2] `tool_names` is read off the PRODUCTION assembler, never recomputed**

- **Found during:** Task 2.
- **Issue:** The obvious way to write V21 is
  `tool_names = {t["function"]["name"] for t in get_tools(None)}` — a second copy of
  `grounding.py`'s line. **D-20's fix widens `tool_names` INSIDE `assemble_grounding_bundle`**,
  so a test carrying its own copy would stay RED after 189-04 and would have to be *edited*
  to go green. That is the definition of a test that measures the patch instead of the
  property, and it is how a fix gets "verified" by the same hand that wrote it.
- **Fix:** `_production_tool_names()` calls `assemble_grounding_bundle(supabase=MagicMock(),
  user_id=<uuid>)` and returns `bundle.tool_names` — literally the value
  `publish_service._grounding_fidelity_failures` passes into `grounding_verdicts`. It also
  asserts the set is non-empty first, so an assembler returning nothing cannot make every
  membership test report a violation for the wrong reason.
- **Files modified:** `backend/tests/unit/test_103_grounding_fidelity.py`
- **Commit:** `fe7bd092`

**5. [Rule 2] A third V21 control: a registered tool in a MIXED whitelist**

- **Found during:** Task 2.
- **Issue:** The plan's two cases prove the capabilities are refused and a hallucination is
  caught, but neither would notice a 189-04 fix that widened `tool_names` so far it stopped
  discriminating (e.g. an unconditional union, or a truthiness bug).
- **Fix:** `test_a_shipped_tool_is_still_accepted_alongside_a_capability` drives
  `["search_documents", *capabilities]` in ONE call — the shape a real workflow produces —
  and asserts the registered name is never reported.
- **Files modified:** `backend/tests/unit/test_103_grounding_fidelity.py`
- **Commit:** `fe7bd092`

**6. [Rule 1 — Bug] The V21 helper used a non-UUID caller id, sending the skills read down its fail-closed path**

- **Found during:** Task 2, on the first run.
- **Issue:** The file's existing fixtures pass `user_id="u1"`. `grounding._skill_registry`
  coerces that through `coerce_uid` → `UUID()`, which raises
  `ValueError: badly formed hexadecimal UUID string`; `assemble_grounding_bundle` catches
  it, logs a full traceback and marks the bundle `degraded`. Harmless for this test (only
  `tool_names` is read, and it is computed outside both guarded reads) — but it printed a
  traceback into every run, which is exactly how a real failure gets normalised into
  background noise.
- **Fix:** A module-level `_UID` UUID literal used for both the bundle call and
  `grounding_verdicts`, with the reason recorded in its own comment. Output is now clean.
- **Files modified:** `backend/tests/unit/test_103_grounding_fidelity.py`
- **Commit:** `fe7bd092`

**7. [Rule 2] V22 reads the bundle OFFLINE rather than over HTTP**

- **Found during:** Task 3.
- **Issue:** The threat is the WIRE (`GET /workflows/grounding-bundle` → `PhaseFormPanel`'s
  `toolOptions`), so an HTTP drive looks like the faithful choice. But the two shipped
  route-driving tests in this very file are the **two pre-existing `asyncpg … pool is
  closing` failures**, and the plan's acceptance criterion requires the file to still report
  **exactly two**. A third DB-dependent test would either add a third failure or make the
  count environment-dependent.
- **Fix:** Read `bundle.tools` from the production assembler offline. The route's
  field-mapping half is already pinned by the shipped
  `test_grounding_bundle_fields_come_from_the_bundle`, and the docstring says so rather than
  re-driving it. Failure count verified unchanged at exactly two.
- **Files modified:** `backend/tests/test_182_grounding_bundle.py`
- **Commit:** `a5af250d`

### Re-derived, not inherited

Per the phase's standing rule, every load-bearing pointer was re-derived by symbol search on
2026-08-07 rather than seeking to a line number:

| Claim | How re-derived | Result |
|---|---|---|
| `tests/test_publish_gate.py` is the workflow publish surface | read the file; `grep -rln "publish_service\|golden_run" tests/` | ❌ **FALSE** — Phase-136 SKILL gate; not in the 12-file list. See Deviation 1 |
| `_interactive_phase_failures` blocks exactly two shapes | `grep -n` → `publish_service.py:500`; read the body | ✅ HOLDS — `llm_human_input` + `on_failure == "ask_user"` |
| the armed checkpoint is not a validator | `grep -n "action_risk_armed"` → `harness_engine.py:754`; its own comment | ✅ HOLDS — read directly off the phase, hoisted out of `phase.validators` by D-187-01 |
| `timeout_seconds = None if is_action_risk` | `grep -n` → `harness_engine.py:1104` | ✅ HOLDS — passed straight through at `:1174` |
| `harness_publish_max_seconds` == 7200 | asserted from `app.config.settings` in the suite | ✅ HOLDS |
| `tool_names` is built from `get_tools(None)` | `grep -n "tool_names = "` → `grounding.py:388` | ✅ HOLDS |
| `GroundingBundle.tools == sorted(tool_names)` today | `grounding.py:427-428` | ✅ HOLDS — and this is the identity 189-04 breaks; `render_grounding_prompt`'s prose at `:446-447` asserts it and must be corrected in the same commit |
| `effective_phase` no longer synthesizes an armed validator | read its docstring | ✅ HOLDS — 187-06 deleted that synthesis; only `citations_required` is synthesized |
| unbound definitions skip rule 1's DB read | `scope.folder_scope_violations` docstring | ✅ HOLDS — `project_folder_id is None` → `[]`, so `supabase=object()` is safe |
| 189-scope backend baseline | the 9-file §D15 command, re-run | ✅ **166 passed / 2 failed** — exactly the two named `pool is closing` rows |
| `tests/unit/test_publish_service.py` baseline | run before any edit | **20 passed / 0 failed** |

---

## Verification

**The 9-file 189-scope command — the DELTA accounted for exactly:**

```
$ backend/venv/Scripts/python.exe -m pytest <the nine 189-scope files> -q --no-header
3 failed, 170 passed, 1 warning in 1.95s

FAILED tests/unit/test_103_grounding_fidelity.py::test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding
FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette
FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_fields_come_from_the_bundle
```

| | Baseline | Now | Delta | Accounted for by |
|---|---|---|---|---|
| failed | 2 | 3 | **+1** | Task 2's intentional CONFLICT-2 RED |
| passed | 166 | 170 | **+4** | Task 2's 3 controls + Task 3's V22 |

The two `pool is closing` failures are **unmoved and still exactly two**, both named.

**The three 189-02 files (Task 1's file is NOT in the nine — see Deviation 1):**

```
$ backend/venv/Scripts/python.exe -m pytest tests/unit/test_publish_service.py \
    tests/unit/test_103_grounding_fidelity.py tests/test_182_grounding_bundle.py -q --no-header
5 failed, 33 passed, 3 warnings in 1.41s
```

| RED | Owner |
|---|---|
| `test_publish_service.py::test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run` | **189-05** |
| `test_publish_service.py::test_the_armed_golden_run_subscribe_carries_the_indefinite_wait` | **189-05** |
| `test_103_grounding_fidelity.py::test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding` | **189-04** |
| `test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette` | pre-existing, live-DB, not 189's |
| `test_182_grounding_bundle.py::test_grounding_bundle_fields_come_from_the_bundle` | pre-existing, live-DB, not 189's |

**Wall clock:** the whole plan's surface is **1.41 s**; `test_publish_service.py` alone is
**0.57 s** for 25 tests. **No test awaits the 7200 s path**, which was the hard constraint.

**No source touched:**

```
$ git diff --stat 86290a97~1..HEAD -- backend/app frontend/src
(empty)
$ git diff --stat 86290a97~1..HEAD -- backend/tests
 backend/tests/test_182_grounding_bundle.py        |  98 ++++++
 backend/tests/unit/test_103_grounding_fidelity.py | 212 ++++++++++++
 backend/tests/unit/test_publish_service.py        | 383 ++++++++++++++++++++++
 3 files changed, 693 insertions(+)
```

**Acceptance greps** (run against the ACTUAL files, per Deviation 1):

| Token | File | Count |
|---|---|---|
| `D-19` | `tests/unit/test_publish_service.py` | **13** |
| `D-06` | `tests/unit/test_publish_service.py` | **7** |
| `BUG-260731-02` | `tests/unit/test_publish_service.py` | **2** |
| `D-20` | `tests/unit/test_103_grounding_fidelity.py` | **7** |
| `D-06` | `tests/unit/test_103_grounding_fidelity.py` | **4** |
| `V21` | `tests/unit/test_103_grounding_fidelity.py` | **4** |
| `D-22` | `tests/unit/test_103_grounding_fidelity.py` | **2** |
| `D-20` | `tests/test_182_grounding_bundle.py` | **5** |
| `V22` | `tests/test_182_grounding_bundle.py` | **2** |
| `PLANT` | `tests/test_182_grounding_bundle.py` | **0** ✅ |

---

## What the next plans owe

| Plan | Must turn green | Must NOT break |
|---|---|---|
| **189-04** | `test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding` | `test_a_genuinely_unknown_tool_still_produces_the_finding` · `test_a_shipped_tool_is_still_accepted_alongside_a_capability` · `test_external_action_capabilities_are_absent_from_the_author_facing_tool_options` (V22) |
| **189-05** | `test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run` · `test_the_armed_golden_run_subscribe_carries_the_indefinite_wait` | `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` · `test_the_armed_checkpoint_is_not_a_validator` · `test_an_armed_definition_reaches_the_stage_3_golden_run` · `test_187_armed_checkpoint_property.py::test_p3_…` (no false approval receipt) |
| **189-11** | V20's final green — both conflicts fixed, an `external_action` workflow publishes | everything above |

**Three constraints these files now pin that a later plan could satisfy-and-break:**

1. **`test_a_live_non_golden_run_still_pauses_on_an_armed_phase` must keep passing.** The
   cheapest way to silence the golden-run subscribe is to stop arming, which turns
   `action_risk_armed` decorative and is the wire-around D-04 and SC#2 exist to forbid.
2. **`test_the_armed_checkpoint_is_not_a_validator` is a FENCE, not an oversight.** A future
   reader who "fixes" the hang by adding a case to `_interactive_phase_failures` is choosing
   REJECTED Option B and will fail this test. Its docstring says so.
3. **`test_external_action_capabilities_are_absent_from_the_author_facing_tool_options` (V22)
   must never go red.** It is the one guard between D-20's fix and a governance hole. 189-04
   widens `tool_names`; if it also widens `tools`, an author can whitelist `send_email` on
   an unarmed `llm_agent` step.

**One prose correction 189-04 inherits and must not skip:** `grounding.py:446-447`
(`render_grounding_prompt`'s docstring) asserts `tools == sorted(tool_names)` "by
construction". D-20 makes that FALSE. It must be corrected **in the same commit**, with the
reason recorded — otherwise 189 ships a docblock that lies about a governance boundary.

---

## Authentication Gates

None.

## Known Stubs

None. This plan ships no source code and no placeholder values; every assertion is live and
every number in this summary was measured today.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema change. The plan's
own threat register is addressed rather than deferred:

| Threat | Disposition | Where |
|---|---|---|
| **T-189-05** — EoP via `GroundingBundle.tools` → `PhaseFormPanel` `toolOptions` (the D-20 hole) | mitigated | V22, with the non-emptiness half AND an **observed plant** proving it fires |
| **T-189-06** — DoS on the publish request thread | mitigated | CONFLICT-1 RED 1 + RED 2; the test itself never awaits the real timeout (raising recorder) |
| **T-189-07** — Repudiation: a golden run auto-approving an armed checkpoint | mitigated | `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` pins that a live run still pauses; Option C is named in the docstring, and the receipt-count assertion that catches it already ships in `test_187_armed_checkpoint_property.py::test_p3_…` |
| **T-189-SC** — package installs | accept | 189 installs nothing; this plan added no dependency |

## Self-Check: PASSED

- `backend/tests/unit/test_publish_service.py` — FOUND
- `backend/tests/unit/test_103_grounding_fidelity.py` — FOUND
- `backend/tests/test_182_grounding_bundle.py` — FOUND
- `.planning/phases/189-governed-external-action-node-model/189-VALIDATION.md` — FOUND
- commit `86290a97` — FOUND
- commit `fe7bd092` — FOUND
- commit `a5af250d` — FOUND
- `git diff --stat -- backend/app frontend/src` for the plan's range — EMPTY, as required
