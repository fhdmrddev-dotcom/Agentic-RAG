---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 02
subsystem: backend/workflow-authoring
tags: [vocab-01, vocab-02, nl-authoring, provenance, zero-migration, tdd]
requires:
  - "PhaseSpec.name (Phase 103) already inside the extra=forbid union"
  - "grounding_escalated / action_risk_armed (Phase 185, D-185-08) — the additive-optional shape copied"
  - "forced_emit → the Phase 092.5 provider gateway (red line D-14: no second runtime)"
provides:
  - "PhaseSpec.name_seeded_by_ai — the additive-optional name-provenance marker (REQ-3)"
  - "a per-phase `name` instruction in AUTHORING_SYSTEM_PROMPT (Req 2)"
  - "a server-side post-validation provenance stamp on the NL generation success path"
  - "an automated 1 / 2 / never-3 provider-call budget regression"
affects:
  - "187-03+ (the derived node face reads `name` as tier 1; the demote-on-config-edit rule D-187-07 reads the marker)"
  - "187-07 (the live 8-row roster asserts a non-empty `name` on every phase)"
tech-stack:
  added: []
  patterns:
    - "additive-optional, zero-migration JSONB field (bool = False, never bool | None)"
    - "server-side stamp after model_validate — provenance is never read off a model payload"
    - "model_copy(update=...) rebuild, never in-place mutation, never a model-level validator hook"
    - "source-level PROPERTY assertion on a prompt constant, never a hand-typed copy of its prose"
key-files:
  created:
    - backend/tests/unit/test_187_authoring_step_names.py
  modified:
    - backend/app/models/harness.py
    - backend/app/services/workflow_authoring.py
    - backend/tests/unit/test_harness_models.py
decisions:
  - "D-187-03 honoured: the marker records PROVENANCE only; the node face stays a render-time derivation and is never stored"
  - "D-185-08 spelling inherited verbatim: bool = False, so absence has exactly one spelling"
  - "ValidatorSpec.kind's action_risk_approval Literal RETAINED (deliberate — see Deviations)"
  - "T-187-02-02 strengthened: the stamp overrides any provenance claim in the emitted payload"
metrics:
  duration: ~35 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 02: Per-step names + name provenance — Summary

The NL generator now authors a short, specific, plain-language `name` on every phase, and the
server records that the generator (not a human) wrote it — one sentence in a prompt string plus one
additive boolean, zero schema surface and zero migrations.

## What Was Built

**Task 1 — `PhaseSpec.name_seeded_by_ai` (`6a1661e6`).** One additive-optional field spelled
`bool = False`, copying `grounding_escalated`'s spelling exactly so "not set" has a single spelling
(D-185-08). Its docblock names REQ-3 / D-187-03 as the origin, states the zero-migration claim
(a pre-187 row carrying neither this key nor `name` still `model_validate()`s and reads `False`), and
is explicit that this is PROVENANCE, not a derivation — the node face is computed at render in
`phaseVocabulary.ts` and is never stored. Four new tests in `test_harness_models.py` (11 → 15).

**Task 2 — the prompt instruction + the stamp (`b45675ef`).** `AUTHORING_SYSTEM_PROMPT`'s final
bullet now also asks for a per-phase `name` saying what *that* step does rather than what its type
does, explicitly separate from the definition-level `name` the same sentence already requested. The
prompt's shape is unchanged (no new section) and the response schema is untouched. After the emitted
payload validates and grounding fidelity passes, `generate_workflow_definition` rebuilds
`wd.phases` via `model_copy(update=...)`, setting the marker `True` on every phase whose `name`
trims non-empty. The stamp sits on the **single success path**, so a first-emit result and a
retry-emit result are stamped identically. New file `test_187_authoring_step_names.py`, 8 tests,
fully mocked.

## Measured Baselines (captured at HEAD before editing, per the plan's acceptance criteria)

| Measurement | HEAD | After |
|---|---|---|
| `grep -c "model_validator" backend/app/models/harness.py` | **4** | **4** (unchanged) |
| `grep -n "name_seeded_by_ai" …/harness.py` | 0 | **1 declaration**, reads `bool = False` |
| `grep -c "action_risk_approval" …/harness.py` | 3 | 3 (Literal retained) |
| `test_harness_models.py` count | 11 | **15** (strictly greater) |
| `test_103_nl_generate.py` count | 6 | **6** (budget contract did not regress) |
| `test_185_engine_attachment.py` count | 22 | 22, all green |
| backend collection | 3504 (post-187-01) | **3516** (+12 net-new) |
| `git diff --stat -- supabase/migrations` | empty | **empty** |
| `grep -c "anthropic\|openai\|httpx"` in the new test file | — | **0** (no real network path) |

## TDD Gate Compliance

Both tasks observed RED before GREEN.

- **Task 1 RED:** 3 failed / 12 passed. The fourth behaviour (a misspelt `name_seeded_by_AI` key is
  rejected) is green on *both* sides by design — it is the `extra="forbid"` **control**, proving the
  union stayed intact rather than proving the new field exists.
- **Task 2 RED:** 3 failed / 5 passed. The two net-new behaviours (the prompt property, the
  provenance stamp incl. its adversarial half) failed; the five budget/validation tests were green
  both sides because they pin **shipped** behaviour — that is exactly what a regression guard is.

Commits are `feat(...)` rather than a split `test(...)` → `feat(...)` pair because each task's RED
observation was recorded here rather than committed separately; the RED evidence above is the gate.

## Deviations from Plan

**None affecting behaviour.** Two acceptance criteria required a wording change to hold *literally*
rather than merely in spirit — both are recorded because the plan asked for the literal grep:

1. **`model_validator` grep count.** My first draft of the `PhaseSpec` docblock used the literal
   token `@model_validator` in the prose explaining why one must not be added, which pushed
   `grep -c` from 4 to 5 and broke the criterion. Reworded to "a model-level validator hook" with a
   pointer to the sibling block that *does* name the decorator (that block is shipped Phase 185
   prose and was not touched). Count back to **4**. No functional change.
2. **The no-network grep.** My stubs initially used the literal provider string `"anthropic"` (the
   shipped `test_103_nl_generate.py` idiom), which made
   `grep -c "anthropic\|openai\|httpx"` return 2 against a criterion demanding 0. Replaced with
   `STUB_PROVIDER = "stub-provider-not-a-real-one"` — a string matching no real provider. This is
   *stronger* than the original: `forced_emit` is patched out so the value is never routed on, and a
   deliberately fake provider name makes "this file cannot reach a network" self-evident rather than
   a claim in a docstring.

**Deliberate retention (the plan asked for this to be recorded):** `ValidatorSpec.kind`'s
`"action_risk_approval"` Literal member is **KEPT**. Research measured 0 stored rows naming it, so
removal is technically safe *on this DB* — but `harness.py:10-21` states the additive-only policy
(an existing member's spelling never changes, the set only grows), and removal would break three
shipped tests for zero benefit. `grep -c` still returns 3.

**One addition beyond the plan's four behaviours (Rule 2 — a correctness requirement of the stated
threat model).** T-187-02-02 says the marker is stamped server-side "so a model cannot claim a name
was hand-typed", but the plan's listed behaviours only covered the *blank-name* case. Added
`test_the_stamp_ignores_a_provenance_claim_in_the_emitted_payload`: a payload emitting
`name_seeded_by_ai: false` alongside a real name is still stamped `True`. Without it, a future
refactor that read the marker off the payload (instead of overriding it) would pass every other test
in the file.

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-187-02-01 (Tampering — definition JSONB) | mitigated | `test_misspelt_provenance_marker_is_still_rejected` — a near-miss key still raises `ValidationError`. No validator hook added (count 4 → 4). |
| T-187-02-02 (Spoofing — the marker) | mitigated, **strengthened** | Stamped after validation, unconditionally. Both the blank-name case and the adversarial payload-claim case are tested. |
| T-187-02-03 (DoS — provider budget) | mitigated | Three budget tests: exactly 1 on a valid first emit, exactly 2 on a first-pass failure, never 3 (asserted explicitly, including on the both-emits-fail path where the result is an honest failure carrying no partial draft). |
| T-187-02-04 (DoS — stored rows) | mitigated | `git diff --stat -- supabase/migrations` empty; verified after each task. |
| T-187-02-05 (V5 — emitted `name`) | accepted, unchanged | No sanitisation added; `name` renders as a plain React text child downstream. |

## Known Stubs

None. Both surfaces are wired end-to-end on the backend. The **consumer** side (the derived node
face reading `name` as tier 1, and the demote-on-config-edit rule reading the marker) is later
plans' scope by design, not a stub left here.

## Notes for Later Plans

- **The stamp is the only writer of `name_seeded_by_ai`.** Any other path that creates or edits a
  definition (the canvas save, the starter fork, the Tweak fork) leaves it at its stored value. The
  D-187-07 demote rule will be the first *reader*; it should clear `name` **and** the marker
  together, or a demoted phase will keep claiming AI provenance for a name it no longer has.
- **`test_103_nl_generate.py`'s `_valid_definition_dict` has an unnamed phase** and still passes —
  the stamp correctly leaves it `False`. That shipped file is now an incidental control for the
  blank-name branch.
- **Plan 187-07 owns the live roster.** Nothing in this plan makes a real provider call.

## Verification

```
pytest tests/unit/test_187_authoring_step_names.py tests/unit/test_103_nl_generate.py \
       tests/unit/test_harness_models.py tests/unit/test_185_engine_attachment.py -q
→ 51 passed
pytest tests/ -q --collect-only  → 3516 tests collected
git diff --stat -- supabase/migrations  → empty
```

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | `6a1661e6` | `feat(187-02): add name_seeded_by_ai provenance marker to PhaseSpec` |
| 2 | `b45675ef` | `feat(187-02): instruct a per-step name in the NL generator and stamp its provenance` |
