---
phase: 189
plan: 07
subsystem: backend-harness-models
tags: [wave-3, red-to-green, additive-union-growth, structural-governance, prose-correction, falsification-plants]
requires:
  - "189-01 — tests/unit/test_189_external_action_model.py (8 REDs observed at HEAD)"
  - "189-04 — grounding.EXTERNAL_ACTION_CAPABILITIES, the ONE runtime home of the D-15 set"
  - "app.models.harness PhaseConfig union + PhaseSpec (shipped)"
provides:
  - "ExternalActionPhaseConfig — the 7th PhaseConfig union member (D-01)"
  - "capability: a closed Literal of exactly three, mechanically fenced == EXTERNAL_ACTION_CAPABILITIES (D-15/T-189-11)"
  - "available_tools DERIVED from capability by a config-level model_validator (D-03)"
  - "action_risk_armed COERCED to True on every write path, by a PhaseSpec model_validator (D-04)"
  - "the D-26 prose corrections — FOUR sites, not the two named"
affects:
  - "189-09 (the executor — phase.config.capability / available_tools are now real)"
  - "189-11 (the headline publish test — an external_action definition now parses)"
  - "189-08/10/12/13/14/15 (the client rollout — NOT started here)"
  - "185's L-2 fence in test_185_detection.py — NARROWED, and the reason is recorded"
tech-stack:
  added: []
  patterns:
    - "LlmEmitPhaseConfig's additive-member docblock voice, restated for the 7th"
    - "a model_validator that COERCES rather than raises (fail-closed, never bricks a stored row)"
    - "the cross-module agreement fence: get_args(Literal) == the runtime frozenset"
    - "the wrong-fix plant, driven into production source and observed RED before the green is trusted"
key-files:
  created: []
  modified:
    - backend/app/models/harness.py
    - backend/app/api/runs.py
    - backend/tests/unit/test_189_external_action_model.py
    - backend/tests/unit/test_harness_models.py
    - backend/tests/unit/test_185_detection.py
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/GovernanceSection.tsx
decisions:
  - "available_tools is TOTAL REPLACEMENT by [capability], not a merge. A merge would let an author park search_documents on the step, and detection is available_tools ∩ KB_TOOLS — the step would silently arm the grounding dial. Replacement is fail-CLOSED: the whitelist can only get narrower than what was asked for."
  - "The D-04 pin lives on PhaseSpec, not WorkflowDefinition, even though WorkflowDefinition would have left 185's shipped no-validator fence untouched. A WorkflowDefinition-level validator only fires when a WHOLE definition is parsed; a PhaseSpec parsed alone would read unarmed."
  - "185's test_the_models_module_declares_no_model_validator_on_phase_spec was NARROWED, not deleted. It forbade ANY validator on PhaseSpec as a PROXY for L-2's real claim; the replacement asserts the property (the only validator is the named D-04 pin AND the class slice stores no grounding cause) and is strictly stronger."
  - "backend/app/api/runs.py was corrected although it is NOT in files_modified: its resolve_phase_available_tools docstring enumerates the tool-bearing config types and D-03 falsified that enumeration. Nobody else owns it — 189-09 requires its diff to be EMPTY."
metrics:
  duration: "~85 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 7
  tests_added: 6
---

# Phase 189 Plan 07: The 7th `phase_type`, and Two Governance Properties Made Structural Summary

**`ExternalActionPhaseConfig` is the 7th `PhaseConfig` union member, and the two things it must
never lie about — its whitelist and its arming — are now DERIVED by the model rather than
trusted from the payload.** All eight of plan 189-01's REDs are green; the 185 fence that
forbade the mechanism D-04 requires was found, driven RED, and NARROWED to the property it was
actually proxying; and two wrong fixes were planted into production source and each observed RED
before the green was trusted.

## What was built

| File | Change | Result |
|---|---|---|
| `backend/app/models/harness.py` | the 7th member + its `available_tools` derivation + the `PhaseSpec` arming pin + 4 prose corrections | +216 / −13 |
| `backend/tests/unit/test_185_detection.py` | the L-2 fence narrowed to its property + the disjointness case | +147 / −16 |
| `backend/tests/unit/test_harness_models.py` | 2 new tests + 2 new parametrize rows | +80 / −5 |
| `backend/tests/unit/test_189_external_action_model.py` | the cross-module agreement fence | +38 / −0 |
| `frontend/src/components/workflows/phaseVocabulary.ts` | D-26 — comment-only | +24 / −6 |
| `frontend/src/components/workflows/GovernanceSection.tsx` | D-26 — comment-only, **2 sites** | +22 / −5 |
| `backend/app/api/runs.py` | D-26 — comment-only, a 4th site nobody named | +13 / −5 |

| Commit | Task |
|---|---|
| `22552460` | Task 1 — the 7th member, the derivation, the agreement fence, and the D-26 corrections (ONE commit) |
| `7d3891a4` | Task 2 — the D-04 arming pin, the narrowed 185 fence, and the disjointness case |

---

## RED → GREEN, every pair from 189-01

`189-01-SUMMARY.md`'s eight REDs, re-measured on this working tree before a line was edited:
**`8 failed, 2 passed`** — the inherited claim verified, not assumed.

| # | 189-01 test | RED (verbatim, at HEAD) | GREEN |
|---|---|---|---|
| 1 | `test_external_action_is_a_seventh_union_member` | `AssertionError: app.models.harness.ExternalActionPhaseConfig does not exist: D-01's 7th PhaseConfig union member (external_action) has not landed yet (plan 189-07).` | ✅ Task 1 |
| 2 | `…_unknown_key_on_the_external_action_config_still_422s` | same anti-vacuity guard | ✅ Task 1 |
| 3 | `test_a_pre_189_row_still_validates` | **green at HEAD and STILL GREEN** — the additive-growth control | ✅ unmoved |
| 4 | `test_action_risk_armed_cannot_be_stored_false_on_this_type` (**V06**) | `AssertionError: D-04: an external_action phase stored with action_risk_armed=false must read True after model_validate — the arming is not a default the author can clear` / `assert False is True` | ✅ **Task 2** |
| 5 | `test_a_shipped_type_may_still_be_unarmed` | **green at HEAD and STILL GREEN** — the negative control | ✅ unmoved |
| 6 | `…emptied_available_tools…[available_tools emptied to []]` (**V09**) | anti-vacuity guard | ✅ Task 1 |
| 6b | `…emptied_available_tools…[available_tools omitted entirely]` | anti-vacuity guard | ✅ Task 1 |
| 6c | `…emptied_available_tools…[available_tools omits its own capability]` | anti-vacuity guard | ✅ Task 1 |
| 7 | `…capability_set_is_exactly_three_and_disjoint_from_kb_tools` | anti-vacuity guard | ✅ Task 1 |
| 8 | `test_a_capability_outside_the_closed_set_is_refused` | anti-vacuity guard | ✅ Task 1 |

**V06's RED, verbatim, immediately before Task 2** (it was the ONLY remaining failure after Task 1
— the split was clean):

```
FAILED tests/unit/test_189_external_action_model.py::test_action_risk_armed_cannot_be_stored_false_on_this_type
1 failed, 29 passed, 1 warning in 0.63s
```

**AFTER both tasks:**

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_189_external_action_model.py \
    tests/unit/test_185_detection.py tests/unit/test_harness_models.py -q --no-header
96 passed, 1 warning in 0.54s
```

Both 189-01 controls — the pre-189 row and the unarmed `llm_single` — are green, and neither is
merely green: **PLANT C2 below drove `test_a_shipped_type_may_still_be_unarmed` RED**, so its
green is a measurement.

---

## The shape, and what it deliberately is NOT

```python
class ExternalActionPhaseConfig(_StrictBase):
    phase_type: Literal["external_action"]
    capability: Literal["send_email", "create_ticket", "post_message"]
    available_tools: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _available_tools_is_the_capability(self): ...   # available_tools := [capability]
```

```python
class PhaseSpec(_StrictBase):
    ...
    @model_validator(mode="after")
    def _external_action_is_always_armed(self):
        if isinstance(self.config, ExternalActionPhaseConfig) and not self.action_risk_armed:
            logger.info(...)
            self.action_risk_armed = True
        return self
```

**`available_tools` is TOTAL REPLACEMENT, not a merge — and that is a security decision, not a
style one.** A merge would let an author park `search_documents` alongside the capability, and
grounding detection is `available_tools ∩ KB_TOOLS`; the step would then read as
grounding-`detected` and be locked to a *must prove it* gate it can never satisfy, while reading
no knowledge base at all. Replacement makes that unrepresentable. It is fail-CLOSED in the only
direction that matters: **the whitelist can only ever get NARROWER than what was asked for.**

**The derived value IS persisted, and that is the requirement rather than a hazard.** The draft
path saves `model_dump(mode="json")`, so D-03 needs the capability in the STORED row for the
run-time re-read to find it. This is the OPPOSITE case to the one `PhaseSpec`'s grounding block
forbids: L-2 forbids baking a value that must stay free to CHANGE when the row changes; this one
is a function of `capability` alone and cannot change without rewriting the config.

**`isinstance`, not a `phase_type` string compare** — the discriminator's spelling is not re-typed
in the validator, so there is no second place for it to drift.

**Membership is `getattr`-free by construction:** the coercion runs on `PhaseSpec`, which every
write path parses through (the field default, a draft save, a canvas/panel edit, a direct JSONB
hand-edit, the publish gauntlet, the NL generator).

**The three rejected alternatives are named IN THE DOCSTRING**, per the plan: a `Literal[True]`
field (impossible — `action_risk_armed` is shared by all seven types), resolve-time enforcement in
the engine (protects the RUN, not the STORED ROW — the canvas would paint an unarmed edge on an
armed step), and a `WorkflowDefinition`-level validator (see the finding below).

### The coercion log lines, driven and quoted

```
INFO app.models.harness: 189 D-03: external_action available_tools ['search_documents'] replaced by
  the capability-derived ['create_ticket'] (the whitelist is derived from `capability`, never authored)
INFO app.models.harness: 189 D-04: phase 'notify' is external_action(create_ticket) and was stored
  unarmed; coercing action_risk_armed to True (structurally armed, not disarmable)
STORED -> {'slug': 'notify', ..., 'config': {'phase_type': 'external_action',
  'capability': 'create_ticket', 'available_tools': ['create_ticket']}, ...,
  'action_risk_armed': True, ...}
```

The input was `action_risk_armed: false` **and** `available_tools: ["search_documents"]` — the
worst-case hand-edited row. Both lies are gone from the STORED dump, and the KB tool with them.

---

## ⚠ THE FINDING: a shipped 185 fence FORBADE the mechanism D-04 requires

**`tests/unit/test_185_detection.py::test_the_models_module_declares_no_model_validator_on_phase_spec`
asserts that `PhaseSpec`'s source slice contains NO `@model_validator`.** Nothing named it —
not the plan, not CONTEXT's D-04, not RESEARCH §A4 (which RECOMMENDS exactly the shape the fence
forbids), not PATTERNS §1 (which excerpts the two `WorkflowDefinition` validators as the analog).
It was found by reading `test_185_detection.py`'s test list before editing it, and it went RED the
moment the pin landed:

```
E       assert not <re.Match object; span=(5249, 5265), match='@model_validator'>
tests\unit\test_185_detection.py:438: AssertionError
```

**It was NARROWED, not deleted, and the difference is the whole point.** The old assertion was a
PROXY for L-2's real claim — *the draft save persists `model_dump(mode="json")`, so a value
DERIVED here is BAKED into the JSONB, after which removing the KB tool would leave the step locked
forever (Req 3 inverted)*. The D-04 pin is the opposite case: it bakes a value that must NEVER
change. So the proxy was replaced by the property, in three parts:

1. **the ONLY validator on `PhaseSpec` is the NAMED D-04 pin** (`_external_action_is_always_armed`)
   — a second one, or a rename, fails here. Counting was rejected in favour of naming, so a second
   validator cannot arrive under cover of the first;
2. **the class slice ASSIGNS or DECLARES none of the forbidden cause tokens**, checked with the
   same `_code_only` / `_stores` machinery (and therefore the same positive controls) the
   `grounding.py` guard above it uses; and
3. both detectors keep a positive control, so a green here is a measurement.

**Part 2 is STRICTLY STRONGER than what the test asserted before**: the old regex would have
passed a `PhaseSpec` that cached `grounding_cause` in a plain field, because a plain field carries
no decorator at all. The narrowing is recorded in the test's own docstring, in `PhaseSpec`'s
comment block, and here — a loosened fence nobody explained is indistinguishable from a fence
somebody gave up on.

**The alternative that would have left the fence untouched was considered and REJECTED:** a
`model_validator` on `WorkflowDefinition` (where the two shipped ones live) is outside the fence's
class-scoped slice and would have passed it silently. It is also WEAKER — it only fires when a
WHOLE definition is parsed, so a `PhaseSpec` parsed on its own (which the engine, this suite and
any future partial-update path all do) would read unarmed. Passing a fence by moving out of its
scope is not the same as satisfying it.

---

## ANTI-VACUITY: three plants, each observed RED

The phase's standing lesson (189-04: the plausible wrong fix was planted and the whole fidelity
suite stayed green; 189-05: under PLANT E **both** original REDs stayed green) is now mandatory
practice. All plants were driven into **production source**, observed, and removed. Restoration
verified by **md5sum against a pre-plant backup** and `grep -c "PLANT"` → **0 / 0**.

### PLANT A — a fourth name in ONE spelling (the drift the agreement fence exists for)

`capability: Literal[…, "wire_transfer"]` in `harness.py` only, leaving
`grounding.EXTERNAL_ACTION_CAPABILITIES` at three:

```
FAILED …::test_the_capability_set_is_exactly_three_and_disjoint_from_kb_tools
FAILED …::test_the_literal_and_the_runtime_frozenset_are_the_same_closed_set
FAILED …::test_a_capability_outside_the_closed_set_is_refused
4 failed, 26 passed
```

```
E       assert {'create_tick...ire_transfer'} == {'create_tick... 'send_email'}
E         Extra items in the left set:
E         'wire_transfer'
```

The new fence fires for its own reason. Note what it catches that nothing else does: 189-01's D-15
test reads only the **Literal**, and `test_103_grounding_fidelity.py` reads only the **frozenset**
— so a name added to the frozenset alone (an unenforced capability) is visible to NEITHER.

### PLANT B — a DEFAULT instead of a coercion (the plan's own named wrong fix)

`… and "action_risk_armed" not in self.model_fields_set` — arm only when the key is ABSENT,
leaving an explicit `false` intact:

```
FAILED tests/unit/test_189_external_action_model.py::test_action_risk_armed_cannot_be_stored_false_on_this_type
FAILED tests/unit/test_185_detection.py::test_no_external_action_capability_ever_arms_the_grounding_dial
2 failed, 94 passed
```

```
E       assert False is True
E        +  where False = PhaseSpec(slug='notify', …, action_risk_armed=False, …).action_risk_armed
```

This is the plausible-and-wrong reading of "armed by default": it satisfies the ABSENT-key half of
V06 and fails the STORED-FALSE half — i.e. exactly the hand-edited JSONB row D-04 exists to
refuse. **Two tests saw it, one of them the new 185 case**, which is why that case asserts the
arming as well as the cause.

### PLANT C2 — arm EVERYTHING (drop the `isinstance` scope)

```
FAILED tests/unit/test_189_external_action_model.py::test_a_shipped_type_may_still_be_unarmed
FAILED tests/unit/test_harness_models.py::test_pre_185_phase_row_parses_without_the_governance_keys
2 failed, 94 passed
```

```
E       assert True is False
E        +  where True = PhaseSpec(slug='write', phase_index=0, config=LlmSinglePhaseConfig(…),
                                   …, action_risk_armed=True, …).action_risk_armed
```

189-01 flagged this as the way V06 could pass while changing the governance posture of six shipped
types. Its control fires — **and a SECOND, shipped fence fires too**
(`test_pre_185_phase_row_parses_without_the_governance_keys`, Phase 185's own zero-migration
assertion), which 189-01 could not have known about.

*(A first attempt at this plant, `PLANT C`, crashed on `self.config.capability` for non-external
types and produced 12 noisy failures. It was refined to `getattr(..., "capability", "n/a")` so the
RED is attributable to the arming rather than to an AttributeError — a plant whose failures you
cannot attribute measures nothing.)*

---

## D-26 — the same-commit prose corrections: FOUR sites, not two

D-26 names `phaseVocabulary.ts:271-276` and `GovernanceSection.tsx:86-89`. **The executor prompt's
instruction to grep rather than trust the line numbers was load-bearing: a grep found four.**

| # | Site | Named by D-26? | The falsified claim |
|---|---|---|---|
| 1 | `phaseVocabulary.ts` `GROUNDING_DIAL_TYPES` docblock (**`:271`, re-derived as `:270-276`**) | ✅ | *"`available_tools` exists only on `LlmAgentPhaseConfig` and `LlmBatchAgentsPhaseConfig`"* |
| 2 | `GovernanceSection.tsx` `DIAL_TYPES` docblock (**`:86-89`**) | ✅ | the same sentence, re-typed |
| 3 | `GovernanceSection.tsx` **module docblock**, *"WHICH STEPS CARRY A DIAL"* (`:39-44`) | ❌ **NO** | *"They are the only configs with `available_tools`, i.e. the only steps that can ever SATISFY the gate"* |
| 4 | `backend/app/api/runs.py` `resolve_phase_available_tools` docstring (`:672-679`) | ❌ **NO** | *"Tool-bearing phase configs (llm_agent / llm_batch_agents) carry the whitelist"* — already incomplete (`llm_emit` in neither list) and now wrong |

**Site 3 is the exact shape 189-04 hit** (its plan named one site; a grep found four, including the
line a future reader is likeliest to consult). Correcting sites 1 and 2 alone would have satisfied
the letter of D-26 and left the same lie **twelve lines above** one of them.

### Before → after, site 1

**BEFORE:**
```ts
 * The two step types that can carry a grounding dial (D-185-15). Mirrors the
 * backend rule exactly: `available_tools` exists only on `LlmAgentPhaseConfig`
 * and `LlmBatchAgentsPhaseConfig`, so these are the only types the server's
 * `grounding_cause` can ever report `detected` for …
```

**AFTER (abridged):**
```ts
 * The two step types that can carry a grounding dial (D-185-15). Mirrors the
 * backend rule exactly: these are the only types whose tools can ever INTERSECT
 * the server's `KB_TOOLS`, which is the one thing `grounding_cause` reports
 * `detected` for …
 *
 * ⚠ CORRECTED at Phase 189 (D-03 / D-26), in the commit that falsified it. …
 * THE CONSTANT IS UNCHANGED AND STILL CORRECT — only its stated reason moved. A
 * third type carrying `available_tools` does not make it grounding-capable: an
 * `external_action` step's list is DERIVED from its `capability`, and the three
 * capabilities are disjoint from `KB_TOOLS` by construction … `GROUNDING_DIAL_TYPES`
 * is READ here and NEVER edited (a D-185-15 red line); `external_action` must not
 * be added to it.
```

**Two more prose claims inside `PhaseSpec` were falsified by Task 2** and corrected in Task 2's own
commit: both *"Nothing here is a `model_validator` on purpose"* (the 185 block) and *"Nothing here
is a model-level validator hook, on purpose"* (the 187 block). The RULE each defends is unchanged
and is now stated as the rule rather than as the absence of a decorator. The module docblock's
growth record (`5 -> 6` → `… and 6 -> 7`) and the `# ── 5 phase-type configs` header (already
false since 101.1) were corrected in Task 1's.

**PROVED comment-only, not asserted:**

```
$ git diff -U0 -- frontend/src | grep '^[+-]' | grep -v '^\(+++\|---\)' | grep -v '^[+-] *\(\*\|//\|/\*\)'
(empty)
```

Zero changed lines of executable code. `GROUNDING_DIAL_TYPES` and `DIAL_TYPES` are byte-identical
to HEAD (their declarations do not appear in the diff at all; only their line numbers moved,
`277 → 293` and `90 → 104`).

**The same-commit proof is the commit's own file listing** — this is why the plan merged part D
into Task 1 rather than making it a task:

```
$ git show --stat 22552460
 backend/app/api/runs.py                                | 13 +-
 backend/app/models/harness.py                          | 133 ++++++-
 backend/tests/unit/test_189_external_action_model.py   | 38 ++
 backend/tests/unit/test_harness_models.py              | 80 ++-
 frontend/src/components/workflows/GovernanceSection.tsx| 22 +-
 frontend/src/components/workflows/phaseVocabulary.ts   | 24 +-
```

---

## Deviations from Plan

### Rule 2 — missing critical functionality

**1. [Rule 2] `backend/app/api/runs.py` was corrected although it is NOT in `files_modified`**

- **Found during:** Task 1, grepping for the D-26 claim across the tree rather than trusting the
  two named line numbers.
- **Issue:** `resolve_phase_available_tools`'s docstring enumerates which config types carry
  `available_tools`. D-03 falsifies that enumeration in this very commit. The plan's acceptance
  criterion is *"No docblock in the tree survives this commit stating a reason D-03 has made
  false"*, and its `<verification>` separately says `git diff --stat` should list the six declared
  files **and nothing else** — the two cannot both hold.
- **Fix:** corrected, comment-only, in Task 1's commit. **Nobody else owns it:** RESEARCH §A1
  flagged it as *"Prose only"* and **plan 189-09 requires `git diff --stat backend/app/api/runs.py`
  to be EMPTY**, so deferring it would have left the claim false for the rest of the phase.
- **Consequence, stated rather than smoothed:** the whole-plan `git diff --stat` lists **SEVEN**
  files, not six. `openai_service.py`, `tool_dispatcher.py`, `harness_engine.py` and `threads.py`
  are all still untouched (`git diff --stat` over each → empty).
- **Commit:** `22552460`

**2. [Rule 2] The shipped 185 L-2 fence was narrowed** — see the FINDING section above. Not a
choice between the plan and the fence: the plan's mandated mechanism and the fence's literal
wording are mutually exclusive, and the fence's own stated REASON does not cover this case.
- **Commit:** `7d3891a4`

**3. [Rule 2] `llm_emit` was added to `test_harness_models._MINIMAL_CONFIGS` alongside `external_action`**

- **Found during:** Task 1.
- **Issue:** measured while adding the 7th — **the 6th was never added at 101.1**. The shipped
  strict-parse contract suite has been proving 5 of 6 union members since then.
- **Fix:** both added, and the file's own docblock now states the RULE (*one entry per union
  member*) instead of a count that rots on every additive growth. A new test,
  `test_the_phase_config_union_is_exactly_the_declared_members`, asserts the parametrize list and
  the union have the same membership — so the next omission fails rather than passing silently.
- **Commit:** `22552460`

**4. [Rule 2] Two extra tests in `test_harness_models.py` the plan did not ask for**

`test_the_phase_config_union_is_exactly_the_declared_members` reads the union off the annotation
and pins the members **in order** (the growth contract's real claim is about SPELLING and ORDER —
a rename orphans stored rows, and a membership-only assertion sails past one), and
`test_the_discriminated_union_mechanism_is_untouched_by_the_seventh_member` asserts
`extra="forbid"` on the new member **and** on a shipped one, so "still forbids" cannot be true of
only the old members. Both replace acceptance criteria the plan wanted verified by eyeballing a
`git diff`.

### A measurement the plan's acceptance criteria assumed would not move

**5. `grep -c "extra=" harness.py` reads 7, not 6 — and `grep -c "action_risk_approval"` reads 4,
not 3.** Both deltas are PROSE, and both were checked line by line rather than waved through:
the new `extra=` occurrence is at `:186` (my class docblock explaining that `_StrictBase` rejects
unknown keys) and the new `action_risk_approval` at `:14` (the module docblock recording that 189
REUSES the kind rather than growing the set). The mechanism itself is unmoved:
`grep -c "model_config = ConfigDict"` → **1**, `_StrictBase`'s body is byte-identical, and the
`ValidatorSpec.kind` Literal still holds its ten members with `action_risk_approval` last.

---

## Re-derived, not inherited

Every baseline and every pointer was re-taken on this working tree on 2026-08-07.

| Claim | How | Result |
|---|---|---|
| the eight 189-01 REDs | re-run before any edit | ✅ **8 failed / 2 passed**, exactly as recorded |
| `tsc --noEmit -p tsconfig.app.json` | run | ✅ **33**, before AND after |
| the frontend count gate | `node scripts/vitest-count-gate.cjs` | ✅ **2508 / 45 files**, unmoved |
| `test_harness_engine.py` | run | ✅ **40 passed**, before and after; no diff hunk in `harness_engine.py` |
| `test_185_detection.py` | run before any edit | **65 passed** → 66 after (+1 new case), with the narrowed fence green |
| `KB_TOOLS` at `grounding.py:797` | symbol search | ⚠ **STALE — it is `:856`** (189-04's own insertions moved it; `189-04-SUMMARY.md` records the new number). `EXTERNAL_ACTION_CAPABILITIES` is `:909`. |
| `action_risk_armed` at `harness.py:235` | symbol search | ⚠ **STALE at read time — `:235` was true at HEAD, `:362` after Task 1's insertions.** Re-derived by symbol, never by seek. |
| `PhaseSpec` has no `model_validator` | RESEARCH §A4 recommends adding one and does not mention the fence | ⚠ **A SHIPPED TEST FORBADE IT** — see the FINDING |
| the three capabilities ∩ `KB_TOOLS` | asserted as a SET in two suites | ✅ **∅** |
| `send_email` in `openai_service.py` / `tool_dispatcher.py` | `grep -c` | ✅ **0 / 0** — D-22 holds, both files untouched |

---

## Verification

**The 12-file 189-scope command, before and after — the delta accounted for EXACTLY:**

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_harness_models.py tests/test_harness_engine.py \
    tests/test_harness_whitelist.py tests/unit/test_185_detection.py \
    tests/unit/test_103_grounding_fidelity.py tests/test_182_grounding_bundle.py \
    tests/test_publish_gate.py tests/unit/test_audit_event_registration.py \
    tests/unit/test_189_no_egress.py tests/unit/test_189_external_action_model.py \
    tests/unit/test_publish_service.py tests/test_migration_115.py -q --no-header
5 failed, 205 passed, 3 skipped, 3 warnings
```

| | Before (re-derived) | After | Delta | Accounted for by |
|---|---|---|---|---|
| failed | **13** | **5** | **−8** | the eight 189-01 REDs flipped GREEN |
| passed | **191** | **205** | **+14** | 8 flipped + **6 new tests** (agreement fence · union pin · mechanism pin · 2 parametrize rows · the 185 disjointness case) |
| skipped | 3 | 3 | 0 | migration 115 — still 189-06's, still unapplied |

**The five remaining failures are named, and none is 189-07's:** two pre-existing
`test_182_grounding_bundle.py` `asyncpg … pool is closing` live-DB rows, and the three
`test_189_no_egress.py::test_the_external_action_executor_performs_no_network_io[…]` rows, which
are **plan 189-09's** by design.

**BLAST RADIUS — the WHOLE `tests/unit` tree, measured both ways rather than assumed.** The five
modified backend files were swapped to their pre-189-07 (`HEAD~1`) contents, the suite re-run, and
the files restored (md5-verified against the backups):

| | pre-189-07 | after 189-07 | Delta |
|---|---|---|---|
| `tests/unit` failed | **73** | **65** | **−8** |
| `tests/unit` passed | **1719** | **1733** | **+14** |

**The tree-wide delta is IDENTICAL to the 189-scope delta**, so this plan introduced **zero**
regressions anywhere in `tests/unit` — including the 65 pre-existing failures, which are unmoved.
(⚠ The `62-red` figure carried in project memory for `tests/unit` is stale; the measured
pre-189-07 number is **73**, and `test_189_no_egress.py` accounts for only 3 of the difference.)

**Frontend:**

```
$ npx tsc --noEmit -p tsconfig.app.json | grep -c "error TS"   →  33   (baseline, unmoved)
$ node scripts/vitest-count-gate.cjs
  count gate OK — 45/45 pinned files present, no per-file decrease, 0 failing.
  total 2508 · failed 0 · pinned total 2508
```

No frontend test count changed, so no count-gate pin moved. ⚠ Per `D-188.2-DEF-01` the gate's
`failed 0` is **not** read as a regression backstop here; the COUNT columns are.

**Scope:**

```
$ git diff --stat 22552460~1..HEAD
 7 files changed, 509 insertions(+), 31 deletions(-)
$ git diff --diff-filter=D --name-only 22552460~1..HEAD    →  (empty; no deletions)
$ git diff --stat 22552460~1..HEAD -- backend/app/services/openai_service.py
                                       backend/app/services/tool_dispatcher.py
                                       backend/app/services/harness_engine.py
                                       backend/app/api/threads.py               →  (all empty)
$ grep -c "PLANT" backend/app/models/harness.py backend/tests/unit/test_185_detection.py  →  0 / 0
```

`frontend/` is comment-only. **No client-side rollout was started** — the 7th type's enumeration
sites (`definitionOps`, `PHASE_GLYPHS`, `nodePresentation`, `PhaseFormPanel`, …) belong to plans
189-08/10/12/13/14/15 and are untouched.

---

## Deferred Issues

None new. Two pre-existing items were **not** touched:

- **`D-189-DEF-01`** — `test_182_extraction_parity.py`'s NL-gen count pin, RED since 189-02. This
  plan added **0** tests to `test_103_grounding_fidelity.py`, so it does not move the number again.
- **`D-189-DEF-02`** — the author-facing rail would render a capability struck through. Still a
  live constraint on **189-13** (the `ExternalActionSection` picker); this plan's total-replacement
  derivation of `available_tools` makes it MORE important, not less: an author cannot legitimately
  edit that list at all, so the generic rail must be scoped away from this type rather than
  widened.

**One thing later plans should know:** `189-UI-SPEC.md` describes a *"Not configured (type chosen,
no capability)"* node state. `capability` is a **required** `Literal` on the config — 189-01's D-15
fence reads `typing.get_args(annotation)` and would fail against `Literal[...] | None`, so an
optional capability is not available. That state is therefore CLIENT-side (an unsaved node, or a
stored value the client does not recognise falling through to the *Reach outside* type sentence),
never a stored `None`.

## Authentication Gates

None.

## Known Stubs

None. No placeholder values, no hardcoded empties, no "coming soon". Every number above was
measured today; the two new log strings are real diagnostics on real branches.

## Threat Flags

None — this plan adds no network endpoint, no auth path, no file-access pattern and no schema
change. Its own register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-01** — EoP: the D-04 disarm paths | **mitigated** | A `PhaseSpec` `model_validator` COERCES to True; every write path parses through it. V06 green for BOTH inputs, with the `llm_single` negative control still green. **PLANT B** (a default instead of a coercion) and **PLANT C2** (arm everything) each observed RED. |
| **T-189-02** — Tampering: dynamic resolution of an author-supplied capability | **mitigated** | `capability` is a `Literal` of exactly three; `wire_transfer` is a `ValidationError` at parse time. `_StrictBase` / `extra="forbid"` re-asserted on the new member by its own test. |
| **T-189-11** — the Literal and the frozenset drifting apart | **mitigated** | The cross-module agreement fence, **observed RED under PLANT A**. It is the ONLY test that can see a name added to the frozenset alone. |
| **T-189-05** — EoP: a capability reaching `get_tools()` / `_TOOL_REGISTRY` (D-20) | **mitigated** | `grep -c "send_email"` → **0 / 0** over `openai_service.py` and `tool_dispatcher.py`; both files have empty diffs. V22 still green. D-22 is stated in the class docblock so it is not "simplified" later. |
| **T-189-12** — Spoofing: a capability silently arming the grounding dial | **mitigated** | The new `test_185_detection.py` case asserts `grounding_cause is None` over the whole capability SET, with a `detected` positive control proving the read works. `GROUNDING_DIAL_TYPES` / `DIAL_TYPES` byte-identical. **And it is now structural**: total replacement means a KB tool cannot survive on this config at all. |
| **T-189-22** — DoS: a strict RAISE bricking a stored workflow | **mitigated** | BOTH validators COERCE. The reasoning is in each docstring, with an explicit *"do not tighten this into a raise later"*. |
| **T-189-13** — Repudiation: docblocks stating a reason D-03 falsified | **mitigated** | **Four** sites corrected in the same commit (two of them unnamed by D-26), plus two more inside `PhaseSpec` in Task 2's. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

- `backend/app/models/harness.py` — FOUND
- `backend/app/api/runs.py` — FOUND
- `backend/tests/unit/test_189_external_action_model.py` — FOUND
- `backend/tests/unit/test_harness_models.py` — FOUND
- `backend/tests/unit/test_185_detection.py` — FOUND
- `frontend/src/components/workflows/phaseVocabulary.ts` — FOUND
- `frontend/src/components/workflows/GovernanceSection.tsx` — FOUND
- `.planning/phases/189-governed-external-action-node-model/189-07-SUMMARY.md` — FOUND
- commit `22552460` — FOUND
- commit `7d3891a4` — FOUND
