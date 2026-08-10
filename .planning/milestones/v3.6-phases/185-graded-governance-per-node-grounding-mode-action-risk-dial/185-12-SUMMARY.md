---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 12
subsystem: backend/harness
tags: [governance, citations, prompt-composition, validator-gates, workflow-harness, bug-fix]

# Dependency graph
requires:
  - phase: 185-02
    provides: "grounding.effective_phase — the ONE synthesis seam that attaches the citations_required ValidatorSpec to a detected step"
  - phase: 185-03
    provides: "the retrieved_and_cited validator mode (half (a) real-retrieval + half (b) marker count)"
provides:
  - "CITATION_MARKER_PATTERN / _EXAMPLES / _GUIDANCE — the single home of the citation marker format, read by BOTH the gate and the instruction"
  - "the retrieved_and_cited failure message now states the remedy, which the engine interpolates verbatim into ctx.retry_feedback with no engine change"
  - "_citation_instruction — the third additive system-prompt suffix, composed on _exec_llm_agent AND _exec_llm_batch_agents"
  - "the drift pin: a test that compiles the gate's own pattern and asserts every advertised example matches it"
affects: [188, workflow-publish-gauntlet, harness-prompt-composition]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "additive-suffix prompt composition: a helper returning '' when inactive, so byte-identity is structural rather than promised"
    - "instruction derived from the ATTACHED ValidatorSpec, never from a second detection call — the judge and the instruction cannot disagree"
    - "drift pin: compile the checker's own regex in a test and assert the human-facing example satisfies it"

key-files:
  created: []
  modified:
    - backend/app/services/harness/validator_kinds.py
    - backend/app/services/harness/phase_types.py
    - backend/tests/unit/test_185_detection.py
    - backend/tests/unit/test_validator_kinds.py

key-decisions:
  - "The producer is fixed, never the checker — a retrieved-but-unmarked answer STILL FAILS, asserted by test (T-185-12-01)"
  - "The instruction reads the attached ValidatorSpec, not a second grounding-cause call; phase_types imports nothing from grounding (literal grep pinned to 0)"
  - "min_markers is taken as the MAX across matching specs (D-185-05 lets an author's spec and the engine's both run), so the instruction can never under-ask"
  - "A spec carrying its OWN config['pattern'] gets no instruction — the shared guidance does not describe that regex, and advertising it would instruct the model to fail"
  - "presence's failure message stays byte-unchanged; only the retrieved_and_cited branch gained the remedy clause"

patterns-established:
  - "One-home format constants: the regex the checker compiles and the words the producer reads are composed from the same tuple, with a test that compiles one against the other"
  - "D-14 byte-identity asserted by prompt EQUALITY against the pre-plan composition, not by substring absence"

requirements-completed: []  # GOVERN-01 stays Pending — see "Requirement status" below.

# Metrics
duration: 12min
completed: 2026-07-30
---

# Phase 185 Plan 12: Close BUG-260730-01 — the citation gate is now legible to the model that must satisfy it Summary

**A detected grounded step is told the marker format in its own system prompt before attempt 1, from the same constant the gate compiles — the gate itself is no less strict, and a phase that earns no gate still produces a byte-identical prompt.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-30T14:07:33Z
- **Completed:** 2026-07-30T14:19:29Z
- **Tasks:** 3 of 3
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments

- **The bug is closed at its root cause.** The engine auto-attached a `citations_required` gate to a detected step and announced it nowhere — not in the step prompt, not at the attachment seam, not in the retry feedback. `_citation_instruction` now composes that announcement into the system prompt on both agent paths, derived from the attached `ValidatorSpec` itself.
- **The marker format has exactly one home.** `CITATION_MARKER_PATTERN` / `CITATION_MARKER_EXAMPLES` / `CITATION_MARKER_GUIDANCE` in `validator_kinds.py`. The `config.get("pattern", ...)` default now READS the constant (an author-supplied pattern still wins), the failure message reads the guidance, and `phase_types.py` reads the same guidance rather than re-typing or re-phrasing it.
- **The remedy reaches attempt 2 with no engine change.** `harness_engine.py:804` interpolates `gate.error_message` verbatim into `ctx.retry_feedback`, so appending the guidance to the `retrieved_and_cited` message improved the retry feedback for free — the minimum-blast-radius route, and it keeps the remedy text in the same module as the rule it remedies.
- **The gate did not get weaker.** Asserted, not asserted-about: a retrieved-but-unmarked output still fails, half (a) still owns the nothing-retrieved case, and the falsification of the drift pin was observed RED.

## Task Commits

Each task was committed atomically:

1. **Task 1: Give the gate a remedy voice, from one home** — `7c7d8b84` (fix)
2. **Task 2: Tell the producer, on both agent paths, before attempt 1** — `46f773ff` (fix)
3. **Task 3: Pin it — the drift guard, the D-14 guard, and the reproduction** — `6c85a5e4` (test)

**Plan metadata:** see the final `docs(185-12)` commit.

## Files Created/Modified

- `backend/app/services/harness/validator_kinds.py` — the three marker-format constants (the single home); the `retrieved_and_cited` failure message gains the remedy clause; the validator docstring records that the producer is TOLD, and where, so a future reader cannot re-open the gap by removing the instruction and leaving the check.
- `backend/app/services/harness/phase_types.py` — `_citation_instruction(phase)`, the third additive suffix; composed into `_exec_llm_agent` (`:538`) and `_exec_llm_batch_agents` (`:619`), before the retry suffix. Each call site carries a `BUG-260730-01` why-comment.
- `backend/tests/unit/test_185_detection.py` — +27 tests: the drift pin, the strictness anti-regression, the D-14 equality guard, both-executor coverage, the attached-spec derivation in both directions, and a code-only one-home guard.
- `backend/tests/unit/test_validator_kinds.py` — the existing half-(b) test now asserts the remedy clause; its shipped `in`-style substring assertion is kept EXACTLY as it was, which is itself the proof the clause is appended rather than a rewrite.

## Observed evidence

### The reproduction, at the gate (quoted verbatim, run against the shipped validator)

Retrieved (non-empty `citations`) but unmarked prose — **still FAILS**:

```
citations_required: 0/1 citation markers in the answer — cite inline right after each
claim you make, using a marker of the form [1] or (doc-2), pointing at the passages you
retrieved
```

The leading `0/1 citation markers in the answer` is byte-identical to the production
failure on `workflow_runs.id = ded89703-44c4-4e40-b5fe-9af35a44a54d`; everything after the
dash is new. One line.

The same output with the advertised marker (`Revenue grew 4% [1].`) — **PASSES**,
`error_message is None`. The `(doc-2)` form passes too.

Half (a) is untouched and still distinguishable (empty `citations`, marker-stuffed text):

```
citations_required: nothing was retrieved (0 sources) — this step reads your documents and
must show where its answer came from
```

`presence` is byte-unchanged: `citations_required: only 0/1 citation markers`
(asserted by `==`, and `git diff` shows no edit to that return line).

### The instruction a detected step now carries

```
## Citations (required — this step reads the knowledge base)
Your answer is checked automatically before it is accepted: cite inline right after each
claim you make, using a marker of the form [1] or (doc-2), pointing at the passages you
retrieved. At least 1 such marker must appear in your final answer, and the answer must
rest on passages you actually retrieved. An answer with no marker is rejected and the step
is retried.
```

### The drift-pin falsification, observed RED

Substituting `CITATION_MARKER_EXAMPLES = ("<<1>>", "(doc-2)")` — a marker shape the gate's
pattern rejects — turned **two** tests red, then was reverted (`validator_kinds.py` verified
byte-identical to its committed state afterwards):

```
FAILED tests/unit/test_185_detection.py::test_every_advertised_marker_example_matches_the_pattern_the_gate_compiles
                "instruction to the letter would still fail the gate"
            )
E           assert None
E            +  where None = <built-in method search of re.Pattern object at 0x...>('<<1>>')
E            +    where <built-in method search of re.Pattern object at 0x...> = re.compile('\\[\\d+\\]|\\(doc[^)]*\\)').search
tests\unit\test_185_detection.py:694: AssertionError

FAILED tests/unit/test_185_detection.py::test_the_gate_default_pattern_has_exactly_one_home
E           AssertionError: the default pattern rejected its own example '<<1>>'
E           assert False is True
tests\unit\test_185_detection.py:723: AssertionError

2 failed, 63 deselected
```

The second failure is the more interesting one: it went red *behaviourally*, by running the
real registered validator, which proves the pin is anchored to the pattern the gate actually
compiles rather than to a copy of it.

### Test counts

| Suite | Before | After |
|---|---|---|
| `test_185_detection.py` | 38 | **65** |
| `test_validator_kinds.py` | 13 | 13 (assertions strengthened in place) |
| **Touched suites combined** | **51** | **78** |
| Full `tests/unit` | 62 failed, 1589 passed, 2 xfailed, 2 xpassed | 62 failed, **1616** passed, 2 xfailed, 2 xpassed |

The full-suite failure count is **identical** to the pre-plan baseline (62 — known
pre-existing rot, not this plan's), and the pass count rose by exactly 27, the number of
net-new tests. **No new failure.**

### Fences

| Fence | Result |
|---|---|
| `git diff --stat -- supabase/migrations frontend/` | 0 files |
| `git diff --stat -- agent_loop.py tool_dispatcher.py openai_service.py anthropic_service.py` | 0 files (the D-14 Deep fence) |
| `grep -c "grounding_cause" backend/app/services/harness/phase_types.py` | **0** |
| `grep -c "CITATION_MARKER" .../validator_kinds.py` | 12 |
| `grep -c "CITATION_MARKER" .../phase_types.py` | 3 |
| Files changed across all 3 commits | exactly the 4 in `files_modified` |

## Decisions Made

- **The instruction reads the attached spec, in both directions.** A phase carrying the spec
  without detection (the author-declared shape) IS instructed; a phase with a KB tool whose
  spec was not attached is silent. A helper that re-derived the cause would answer both
  backwards, which is why this is asserted behaviourally rather than left as a comment.
- **`min_markers` is the MAX across matching specs.** D-185-05 lets an author's spec and the
  engine's both run, so quoting the first spec found could tell the model "1 marker" while a
  sibling gate demanded 3 — the same asked-one-thing-judged-on-another shape as the bug.
  A spec whose only requirement is `min_markers: 0` produces no instruction (nothing to say).
- **A spec with its own `config["pattern"]` gets no instruction.** `CITATION_MARKER_GUIDANCE`
  describes the DEFAULT pattern; advertising `[1]` to a gate compiling some other regex would
  instruct the model to fail. Such a spec is author-declared, so its prompt is the author's
  job (the pre-185 `presence` contract). The engine-synthesized spec never sets `pattern`, so
  the detected case always gets its instruction.
- **`presence` was deliberately left out of the remedy clause.** A `presence` author opted in
  and wrote their own marker instructions — they were never the ones left uninformed — and the
  docstring's standing byte-unchanged claim stays true.
- **The detection function's name is not spelled anywhere in `phase_types.py`, in prose or
  code.** The guard for "no second detection call" is a literal file-level grep pinned to zero,
  so a prose mention would defeat it exactly as the D-ITEM-183-02 trap describes. The docstring
  says so explicitly, and a test asserts both the flattened code and the raw source.

## Deviations from Plan

**None — plan executed exactly as written.**

Two clarifications worth recording, neither a deviation:

1. **Task 1 listed `test_validator_kinds.py` in its `<files>` but its action only asked me to
   *confirm* the shipped `in`-style assertion survives an appended clause.** I confirmed it (13
   passed unchanged) and then also added the positive assertions for the new clause to that
   same test, so Task 1's acceptance criterion ("the error_message contains BOTH ... AND a
   concrete example marker") is pinned in the suite Task 1 names, not only in Task 3's.
2. **My first draft of `_citation_instruction`'s docstring spelled `grounding_cause` twice in
   prose**, which made `grep -c "grounding_cause" phase_types.py` return 2 instead of the
   required 0. Caught by running the invariant rather than assuming it; the docstring was
   reworded to make the same point without the literal, and now records *why* the name is
   absent so a future editor does not helpfully re-add it.

## Issues Encountered

- **The `grounding_cause` grep-0 invariant is satisfiable by prose, and so is breakable by
  prose.** Resolved as described above. This is the third recorded instance of the
  D-ITEM-183-02 trap in this project; the docstring now names the trap inline.
- **Nothing else.** No package installs, no migration, no architectural decision, no auth gate,
  no checkpoint.

## Threat Flags

None. The change adds prose to a system prompt the phase author already controls and a clause
to a failure message: no new input, no new fetch, no new write, no new tool, no new trust
boundary. The plan's four registered threats were dispositioned as follows:

| Threat | Disposition |
|---|---|
| T-185-12-01 (gate strictness tampering) | mitigated — `test_a_retrieved_but_unmarked_answer_STILL_FAILS_and_now_names_the_format` |
| T-185-12-02 (marker-shaped prose) | accepted as planned — half (a) reads `citations` off `ToolResult`, unchanged; `test_half_a_still_owns_the_nothing_retrieved_case` is its control |
| T-185-12-03 (the not-author-loosenable-away property) | mitigated — no spec appended, no ordering changed, and the instruction reads the attached spec rather than re-deciding governance |
| T-185-12-04 (the Deep chat path) | mitigated — 10 parametrized D-14 equality cases plus the explicit 4-file Deep git-diff fence |

## Known Stubs

None.

## Requirement status

**GOVERN-01 remains `Pending`, deliberately.** This plan closes the defect that blocked it, but
the operator UAT that would justify `Complete` has not run — re-running the operator's scenario
(a detected grounded step's golden run must be able to publish) is the step AFTER this one, and
it is recorded in `185-VALIDATION.md`, not self-certified here. Neither
`requirements.mark-complete` nor `state.advance-plan` was invoked.

## User Setup Required

None — no external service configuration, no env var, no migration.

## Next Phase Readiness

- **Ready for the operator gate.** Re-run the `Compliance Gap Report` starter's publish; its
  golden run's `retrieve` phase should now carry the marker instruction and clear the gate.
  The wire-level evidence is the phase's `system_prompt_override`; the observable outcome is a
  publish that completes.
- **If it still fails,** the distinguishing evidence is which half fires: `nothing was
  retrieved (0 sources)` is half (a) — a genuine retrieval miss, the expected non-bug
  185-11's checkpoint predicted, and NOT this defect. `N/1 citation markers in the answer`
  after this plan would mean the model saw the instruction and disobeyed it, which is a
  model-quality question, not a structural gap.
- **Pre-existing, out of scope, untouched:** the 62 pre-existing `tests/unit` failures, and
  four untracked files under `backend/` that predate this plan (`RUN-BACKEND.md`,
  `scripts/115_axes234_results.json`, `scripts/115_xprovider_results.json`,
  `settings_override.json.migrated`). None were created, staged, or gitignored here.

## Self-Check: PASSED

- `backend/app/services/harness/validator_kinds.py` — FOUND (modified, `7c7d8b84`)
- `backend/app/services/harness/phase_types.py` — FOUND (modified, `46f773ff`)
- `backend/tests/unit/test_185_detection.py` — FOUND (modified, `6c85a5e4`)
- `backend/tests/unit/test_validator_kinds.py` — FOUND (modified, `7c7d8b84`)
- Commit `7c7d8b84` — FOUND
- Commit `46f773ff` — FOUND
- Commit `6c85a5e4` — FOUND

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-30*
