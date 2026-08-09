---
phase: 189-governed-external-action-node-model
plan: 04
subsystem: backend-harness-grounding
tags: [wave-2, governance-boundary, publish-gauntlet, red-to-green, prose-correction, security]
requires:
  - "app.services.harness.grounding.assemble_grounding_bundle / _unregistered_tools (shipped)"
  - "189-02 — V21 authored RED, V22 authored green and proved non-vacuous by an observed plant"
  - "189-01 — tests/unit/test_189_external_action_model.py EXPECTED_CAPABILITIES (the D-15 closed set)"
provides:
  - "EXTERNAL_ACTION_CAPABILITIES — the ONE home of the D-15 closed set, in grounding.py beside KB_TOOLS"
  - "the D-20 governance boundary: GroundingBundle.tool_names is now a strict SUPERSET of GroundingBundle.tools"
  - "D-06 half one — stage 2.6 rule 2 no longer refuses a workflow that declares a capability"
  - "a matched assertion PAIR pinning the boundary from both sides (in tool_names / out of tools)"
affects:
  - "189-05 (CONFLICT 1 remains RED and is untouched by this plan)"
  - "189-07 (the 7th phase_type — its available_tools now passes the publish gate)"
  - "189-09 (ExternalActionSection — MUST NOT widen toolOptions; see deferred-items D-189-DEF-02)"
  - "189-11 (the headline publish test — CONFLICT 2's half of it is now clear)"
tech-stack:
  added: []
  patterns:
    - "KB_TOOLS' one-home header block, restated for a second closed set — with the wire twin deliberately NOT copied"
    - "two named local sets at one boundary, rather than a phase_type exemption inside a shared rule"
    - "the falsified-prose correction shipped in the SAME COMMIT as the change that falsified it"
    - "anti-vacuity by matched pair: the same fact asserted positively in one suite and negatively in another"
key-files:
  created:
    - .planning/phases/189-governed-external-action-node-model/deferred-items.md
  modified:
    - backend/app/services/harness/grounding.py
    - backend/tests/unit/test_103_grounding_fidelity.py
decisions:
  - "Took the plan's SECOND acceptable shape: GroundingBundle.tool_names carries the widened membership set and GroundingBundle.tools the narrow author-facing list. This was not a style preference — 189-02's V21 reads bundle.tool_names off the production assembler, so the widening had to land in that field or the RED could not flip."
  - "FOUR prose claims were falsified by the union, not the one the plan named. All four corrected in the same commit."
  - "backend/tests/test_182_grounding_bundle.py was NOT modified. It is in the plan's files_modified, but V22 was already green and had to STAY green — editing the only guard between this change and a governance hole, in the commit that could open that hole, is the one edit worth refusing."
metrics:
  duration: "~40 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 1
  files_modified: 2
  tests_added: 1
---

# Phase 189 Plan 04: Resolve CONFLICT 2 — the Fidelity Gate Widens, the Author-Facing Rail Does Not Summary

**`GroundingBundle.tool_names` and `GroundingBundle.tools` were the same value; they are now
deliberately different, and the difference IS the governance boundary.** The three D-15
capabilities are admitted to the publish-gate membership set and refused entry to the
author-facing whitelist rail — D-06's stage-2.6 blocker is gone, the D-20 leak stayed shut,
and both halves were proved by an observed plant rather than asserted.

## What was built

| File | Change | Result |
|---|---|---|
| `backend/app/services/harness/grounding.py` | `EXTERNAL_ACTION_CAPABILITIES` + the union at one boundary + **four** prose corrections | +85 / −11 |
| `backend/tests/unit/test_103_grounding_fidelity.py` | 1 new test — the union is PROVED APPLIED | +35 |
| `backend/tests/test_182_grounding_bundle.py` | **UNCHANGED, on purpose** — see Deviation 3 | — |

| Commit | Task |
|---|---|
| `ac51449a` | Task 1 — the closed set, one home, no wire twin |
| `44092d43` | Task 2 — the union + the same-commit prose correction + the proof test |

---

## THE RED → GREEN PAIR (V21)

**BEFORE — verbatim from `189-02-SUMMARY.md`, re-measured at this plan's start (`3 failed, 10 passed`):**

```
E       AssertionError: D-20 / CONFLICT 2: stage 2.6 rule 2 refuses
        ['create_ticket', 'post_message', 'send_email'] — the external-action capabilities D-03 puts
        in available_tools. Findings emitted:
        [{'code': 'unregistered_tool', 'phase': 'research', 'message': "phase 'research' references a non-registered tool 'create_ticket'"},
         {'code': 'unregistered_tool', 'phase': 'research', 'message': "phase 'research' references a non-registered tool 'post_message'"},
         {'code': 'unregistered_tool', 'phase': 'research', 'message': "phase 'research' references a non-registered tool 'send_email'"}].
E       assert {'create_tick... 'send_email'} == set()

tests\unit\test_103_grounding_fidelity.py:315: AssertionError
```

**AFTER:**

```
$ venv/Scripts/python.exe -m pytest \
    tests/unit/test_103_grounding_fidelity.py::test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding \
    tests/unit/test_103_grounding_fidelity.py::test_the_fidelity_membership_set_contains_the_capabilities \
    tests/unit/test_103_grounding_fidelity.py::test_a_genuinely_unknown_tool_still_produces_the_finding \
    tests/unit/test_103_grounding_fidelity.py::test_a_shipped_tool_is_still_accepted_alongside_a_capability \
    tests/test_182_grounding_bundle.py::test_external_action_capabilities_are_absent_from_the_author_facing_tool_options \
    -q --no-header
5 passed, 1 warning in 0.19s
```

All three finding dicts are gone, **and the two controls that forbid the cheap wrong fixes
still pass**: `test_a_genuinely_unknown_tool_still_produces_the_finding` (rule 2 was not
disabled) and `test_a_shipped_tool_is_still_accepted_alongside_a_capability` (rule 2 did not
become a pass-through). V22 is green.

---

## THE FIX, AND THE SHAPE IT DELIBERATELY IS NOT

`assemble_grounding_bundle` builds **two named sets** where it built one:

```python
schema_tool_names = {t["function"]["name"] for t in get_tools(None)}
fidelity_tool_names = schema_tool_names | EXTERNAL_ACTION_CAPABILITIES
```

```python
return GroundingBundle(
    tools=sorted(schema_tool_names),   # NARROW — the author-facing rail (V22 watches this)
    tool_names=fidelity_tool_names,    # WIDE  — the publish gate's membership set
```

**`_unregistered_tools` (stage 2.6 rule 2) is BYTE-IDENTICAL.** Re-derived by symbol search
after the change:

```
$ sed -n '/^def _unregistered_tools/,/^def _unregistered_skill_ref/p' grounding.py | grep -c 'phase_type'
0
```

The set was widened by three reviewed names, from one closed frozenset, at one boundary. The
rejected shape — a `phase_type` exemption inside a shared governance rule — was never written.

---

## ANTI-VACUITY: TWO PLANTS, BOTH OBSERVED RED

The phase's standing lesson is that a green must be green *for the stated reason*. Two plants
were driven into the production source and removed before commit
(`grep -c "PLANT" grounding.py` → **0**, verified after restore).

### PLANT 1 — remove the union (`fidelity_tool_names = schema_tool_names`)

```
FAILED tests/unit/test_103_grounding_fidelity.py::test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding
FAILED tests/unit/test_103_grounding_fidelity.py::test_the_fidelity_membership_set_contains_the_capabilities
4 failed, 10 passed
```

Both the flipped test **and the new membership test** swing. The green is the union's.

### PLANT 2 — `tools=sorted(fidelity_tool_names)`, the exact wrong fix D-20 rejects

```
FAILED tests/test_182_grounding_bundle.py::test_external_action_capabilities_are_absent_from_the_author_facing_tool_options
3 failed, 11 passed
```

```
E       assert frozenset({'c...'send_email'}) == set()
E         Extra items in the left set:
E         'create_ticket'
E         'send_email'
E         'post_message'
```

**This is the most valuable result of the plan, and it is a property the plan did not ask
for.** Under PLANT 2 the *entire fidelity suite stayed GREEN* (11 passed) while the
governance hole was wide open. The fidelity tests structurally **cannot** see the leak — V22
is the only guard, and it fires. That is why V22's continued green is a measurement here and
not a formality, and why `test_182_grounding_bundle.py` was left unedited.

---

## THE SAME-COMMIT PROSE CORRECTION — FOUR CLAIMS, NOT ONE

D-20 requires the falsified identity prose to be corrected in the commit that falsifies it.
The plan (and `189-02-SUMMARY.md`, and `189-PATTERNS.md`, and CONTEXT's D-20) all named
**one** site: `grounding.py:446-447`. A grep for the identity found **four**:

```
$ grep -n "same values\|sorted(tool_names)\|tools == sorted" grounding.py
107:    ``skill_ids`` are the membership SETS the fidelity rules test against (the same values,
111:    tools: list[str] = field(default_factory=list)  # sorted(tool_names) — JSON-friendly
446:    ``", ".join(bundle.tools)`` is exactly the old ``", ".join(sorted(tool_names))``
447:    (``tools == sorted(tool_names)`` by construction).
802:# (JSON-friendly, sorted) beside ``tool_names: set[str]`` (membership) for the same values.
```

All four are corrected in `44092d43`.

### The named one — `render_grounding_prompt`, before and after

**BEFORE:**

```python
    Lifted VERBATIM from ``workflow_authoring._assemble_grounding`` (the string-render
    half) so the NL prompt stays BYTE-IDENTICAL after the Phase 182 extraction.
    ``", ".join(bundle.tools)`` is exactly the old ``", ".join(sorted(tool_names))``
    (``tools == sorted(tool_names)`` by construction).
```

**AFTER** (abridged — the full text is in the file):

```python
    ⚠ **CORRECTED at Phase 189 (D-20), in the commit that falsified it.** ... That identity
    NO LONGER HOLDS: ``assemble_grounding_bundle`` now builds ``tool_names`` as a strict
    SUPERSET of ``tools`` — the LLM-facing schema names plus the closed
    ``EXTERNAL_ACTION_CAPABILITIES``. ``tool_names`` is the FIDELITY membership set;
    ``tools`` is the AUTHOR-FACING option list and deliberately excludes the capabilities,
    because it binds into ``PhaseFormPanel``'s whitelist rail and an author must never be
    able to whitelist an external capability on an unarmed step. ...

    **The BYTE-IDENTICAL guarantee this sentence exists to defend is UNCHANGED — and it is
    unchanged precisely BECAUSE ``tools`` was not widened.** The rendered prompt reads
    ``bundle.tools``, the narrow half, so the NL grounding prose is the same string it was
    before 189.
```

The last paragraph is the substantive finding: the sentence's *purpose* (NL-gen byte
identity) survives untouched, and it survives **because** of the security decision. The two
requirements are aligned, not in tension.

The other three: `GroundingBundle`'s docstring gained a ⚠ block naming the pair as a
governance boundary (and noting `skill_ids`/`skills` still mirror each other, so the reader
does not over-generalise); the `tools` field comment now reads *"NOT `sorted(tool_names)`"*;
and `KB_TOOLS_SORTED`'s comment drops *"for the same values"* and says the analogy is to the
list/set **shape** only.

---

## Deviations from Plan

### Rule 2 — missing critical functionality

**1. [Rule 2] The `_SORTED` acceptance grep would have been made VACUOUS by my own comment**

- **Found during:** Task 1, running the acceptance criteria.
- **Issue:** The plan requires
  `grep -c "EXTERNAL_ACTION_CAPABILITIES_SORTED" grounding.py` → **0**. My first draft of the
  header block spelled that token while explaining why it must not exist, and the grep
  returned **1**. A check for a name's absence cannot survive a comment that types the name.
- **Fix:** Reworded to `` `…_SORTED` twin of the constant below `` and recorded *why* the
  name is not spelled — citing the identical shipped discipline in `runVocabulary.ts:56-59`
  (*"a docblock that spelled them would make that check vacuous, which is the 187-24
  lesson"*). Re-measured: **0**.
- **Files modified:** `backend/app/services/harness/grounding.py`
- **Commit:** `ac51449a`

**2. [Rule 2] THREE more falsified prose claims than the plan named**

- **Found during:** Task 2.
- **Issue:** D-20, CONTEXT, PATTERNS and `189-02-SUMMARY.md` all name `grounding.py:446-447`
  as *the* sentence to correct. A grep for the identity found four sites (listed above) —
  including the `tools` field's own inline comment, which is the single most likely line a
  future reader consults. Correcting one of four would have satisfied the letter of the
  clause and left three lies in the file.
- **Fix:** All four corrected in the same commit as the union.
- **Files modified:** `backend/app/services/harness/grounding.py`
- **Commit:** `44092d43`

**3. [Rule 2] The new test is a MATCHED PAIR, not a lone assertion**

- **Found during:** Task 2.
- **Issue:** The plan asks for "one further assertion: the widened membership set CONTAINS
  all three capabilities". Written alone it is satisfiable by a union that also widened
  `tools` — i.e. by the governance hole.
- **Fix:** `test_the_fidelity_membership_set_contains_the_capabilities` asserts the positive
  half **and** a second assertion that `search_documents` is still present (a union that
  *replaced* rather than widened the registry would otherwise pass). Its docstring names V22
  as its partner: the three names are IN `tool_names` here and OUT of `tools` there, and
  either assertion alone is satisfiable by a fix wrong in the other direction. PLANT 2 proved
  exactly that.
- **Files modified:** `backend/tests/unit/test_103_grounding_fidelity.py`
- **Commit:** `44092d43`

### A file the plan listed and I deliberately did NOT modify

**4. `backend/tests/test_182_grounding_bundle.py` is untouched.**

- The plan lists it in `files_modified` and its acceptance criteria say
  `git diff --stat` should list "grounding.py plus the two test files". It lists **two**
  files, not three.
- **Reason:** V22 was authored green by 189-02 and its entire job this plan is to STAY green.
  There was no assertion to add and nothing to fix. Editing the only guard standing between
  this change and a governance hole, inside the commit that could open that hole, is the one
  edit worth refusing — a guard modified by the same hand that wrote the code it guards is
  not evidence.
- The criterion's actual security intent is fully met and independently verified:
  `git diff --stat 86290a97..HEAD -- backend/app` lists `grounding.py` and nothing else, and
  `grep -c "send_email"` over `openai_service.py` and `tool_dispatcher.py` returns **0 / 0**
  (measured before AND after). No schema, no registry entry — D-22 holds.

---

## Re-derived, not inherited

Per the phase's standing rule, every load-bearing pointer was re-derived by symbol search on
2026-08-07.

| Claim | How re-derived | Result |
|---|---|---|
| `tool_names` is built from `get_tools(None)` at `grounding.py:388` | `grep -n "tool_names"` | ✅ HOLDS — `:388` exactly |
| `tools=sorted(tool_names)` at `:427-428` | same grep | ✅ HOLDS |
| the identity prose at `:446-447` | same grep | ✅ HOLDS — **and three more sites it did not name** |
| `KB_TOOLS` / `KB_TOOLS_SORTED` at `:797-803` | `grep -n "KB_TOOLS"` | ✅ HOLDS |
| the `render_template` asymmetry comment | `grep -n "def get_tools" -A 30 openai_service.py` | ✅ HOLDS — `:1133`, verbatim as quoted |
| `PhaseFormPanel`'s "THE OPTION SET IS THE SERVER'S" | `grep -n` | ✅ HOLDS — `:482`; **and it carries a second sentence nobody quoted — see D-189-DEF-02** |
| every consumer of `bundle.tool_names` | `grep -rn "tool_names" backend/app` | **3**: `publish_service.py:688`, `api/workflows.py:697`, `workflow_authoring.py:188`. All three are the SAME fidelity rule set, so one widening serves all three uniformly — this is what made the field-level shape correct rather than a local hack |
| 189-scope 9-file baseline | the §D15 command, re-run before any edit | ✅ **166 → (189-02) → 3 failed / 170 passed** |

---

## Verification

**The canonical 9-file 189-scope command — the delta accounted for exactly:**

```
$ venv/Scripts/python.exe -m pytest <the nine 189-scope files> -q --no-header
2 failed, 172 passed, 1 warning in 1.88s

FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette
FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_fields_come_from_the_bundle
```

| | RESEARCH baseline | After 189-02 | **After 189-04** | Accounted for by |
|---|---|---|---|---|
| failed | 2 | 3 | **2** | 189-02's CONFLICT-2 RED flipped GREEN |
| passed | 166 | 170 | **172** | V21 (+1) + the new membership proof (+1) |

**`test_182_grounding_bundle.py` reports EXACTLY its two named pre-existing failures** —
`test_grounding_bundle_returns_server_sourced_palette` and
`test_grounding_bundle_fields_come_from_the_bundle`, both `asyncpg … pool is closing`,
live-DB, unmoved. No third.

**The ten-file variant** (adding `tests/unit/test_publish_service.py`, per 189-02's
Deviation 1):

| | Before | After | Note |
|---|---|---|---|
| failed | 5 | **4** | CONFLICT 1's two REDs REMAIN — they are **189-05's**, untouched here |
| passed | 193 | **195** | |

**Blast-radius sweep — every suite in `backend/tests/` that mentions `tool_names`,
`grounding_bundle`, `assemble_grounding` or `render_grounding_prompt`** (17 files) was run.
It reported 13 failures. **All 13 were then measured PRE-EXISTING** by restoring both files
to HEAD (backed up to the scratchpad first, `md5sum`-verified on restore) and re-running: the
failure set is byte-identical with and without this plan's change. Eleven are
`test_threads_skills.py` (skills integration), one is `test_181_flip_on.py` (canvas ping),
and one is logged as **D-189-DEF-01**.

**Files unchanged, verified by grep AND by diff:**

```
$ grep -c "send_email" app/services/tool_dispatcher.py app/services/openai_service.py
app/services/tool_dispatcher.py:0
app/services/openai_service.py:0
$ git diff --stat 86290a97..HEAD -- backend/app
 backend/app/services/harness/grounding.py | 137 ++++++++++++++++++-----
```

`KB_TOOLS`' frozenset members and the `available_tools ∩ KB_TOOLS` detection expression are
untouched — re-derived by symbol search after the edits: the frozenset is `grounding.py:856`,
`KB_TOOLS_SORTED` is `:866` (only its comment changed), and the detection expression is
`:947`. Both constants shifted downward by this plan's own insertions, which is why these are
quoted as measured-after values rather than the pre-change ones.

---

## Deferred Issues

Two, both logged with concrete re-open triggers in
`.planning/phases/189-governed-external-action-node-model/deferred-items.md`:

- **D-189-DEF-01 — `test_182_extraction_parity.py`'s NL-gen count pin has been RED since
  189-02.** It asserts `test_103_grounding_fidelity.py` holds exactly **2** tests; 189-02
  took it to 6 and this plan to 7. **Dated, not assumed:** `git show fe7bd092~1` → 2,
  `git show fe7bd092` → 6. Pre-existing and out of this plan's file scope; the correct
  literal is unknowable until 189 stops adding tests to that file. The file is in neither the
  9- nor the 10-file phase-scope command, which is why nobody saw it.
- **D-189-DEF-02 — the author-facing tool rail will render a capability STRUCK THROUGH.**
  `PhaseFormPanel.tsx`'s docblock states that a name the registry lacks is *shown, struck
  through, and still pressable*. D-20 keeps the capabilities out of the rail's only options
  source, so any surface rendering the generic rail for an `external_action` phase paints a
  structurally-required capability as an error the author can toggle off. **This is a live
  constraint on plan 189-09**, which must scope the rail away or use its own section — never
  widen `toolOptions`.

## Authentication Gates

None.

## Known Stubs

None. This plan ships no placeholder values; every number above was measured today.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema change. This plan's
own threat register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-05** — EoP via `GroundingBundle.tools` → `PhaseFormPanel` `toolOptions` (**the D-20 hole; the single most important security property 189 owes**) | **mitigated** | `tools` is built from the NARROW set. V22 green. **PLANT 2 proved V22 is the only thing that can see this leak** — the whole fidelity suite stayed green while the hole was open. `openai_service.py` / `tool_dispatcher.py` untouched (0/0). |
| **T-189-10** — rule 2 weakened rather than widened | **mitigated** | `_unregistered_tools` byte-identical; `phase_type` count in its body = **0**; the hallucinated-tool control and the mixed-whitelist control both pass. |
| **T-189-11** — a second copy of the closed set drifting | **mitigated** | ONE home in `grounding.py` beside `KB_TOOLS`, with the analog's "a second copy is a safety hole" argument restated. No `_SORTED` wire twin (grep = 0). The Wave-0 suites already fence the set against `EXPECTED_CAPABILITIES`. |
| **T-189-12** — a capability colliding with a KB tool and silently arming the grounding dial | **mitigated** | Stated in the constant's header AND now asserted in code by a module-level assertion over two literals in the same file. Measured: `EXTERNAL_ACTION_CAPABILITIES & KB_TOOLS` → `frozenset()`. |
| **T-189-13** — a shipped docblock asserting a governance identity that is no longer true | **mitigated** | Four sites corrected in `44092d43`, the same commit that falsified them, each recording the reason. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

- `backend/app/services/harness/grounding.py` — FOUND
- `backend/tests/unit/test_103_grounding_fidelity.py` — FOUND
- `.planning/phases/189-governed-external-action-node-model/deferred-items.md` — FOUND
- commit `ac51449a` — FOUND
- commit `44092d43` — FOUND
- `grep -c "PLANT" backend/app/services/harness/grounding.py` → **0** (both plants removed)
- `grep -c "EXTERNAL_ACTION_CAPABILITIES_SORTED" backend/app/services/harness/grounding.py` → **0**
