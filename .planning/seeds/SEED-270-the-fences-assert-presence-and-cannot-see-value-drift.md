---
seed_id: SEED-270
title: This project's guard tests keep asserting PRESENCE, and presence cannot see the drift they were written to catch — five instances in one phase
created: 2026-09-10
planted_during: Phase 238 independent review, 2026-09-10 (WR-07, WR-08, IN-01, IN-02, IN-08)
status: planted
priority: high
surface: Agentic-RAG
severity: major     # No user-visible defect. It is the reason user-visible defects ship green.
folded_into: null
relates_to:
  - `backend/tests/unit/services/sources/test_238_source_path_honesty.py` — the writer-set fence
    that greps for the literal `'"path": source_path,'`.
  - `backend/tests/unit/services/sources/test_boundary_fence.py` — sees only `ast.Compare`, and
    exempts two modules with no reason recorded.
  - `backend/tests/unit/services/sources/test_source_adapter_conformance.py` — asserts the
    invariant per-adapter, where it holds, and never at `PreviewItem`, where it did not.
trigger_when: >
  ANY phase that writes a guard/fence/characterization test — i.e. most phases in this project.
  ⭐ Also fires as its own cleanup: an audit of the existing fence suite for the presence-vs-value
  pattern, since the five instances below were found in ONE phase by ONE review and nobody has
  looked at the rest.
---

# The pattern, stated once

**A guard that asserts a thing EXISTS cannot see that the thing became WRONG.** Phase 238's
BLOCKER (`CR-01`) shipped green through a suite written specifically to prevent it, because every
relevant fence checked shape and none checked value.

⭐ **This is not a Phase 238 problem.** It is the third independent appearance of the same failure:

| When | The fence | What it could not see |
|---|---|---|
| Phase 235 | a composition fence asserting blocks by `data-testid` | the CONTENT drifted; the fence stayed green over the shipped defect |
| Phase 240 | `'"user_id"' in body` | stayed GREEN when the real call was deleted |
| **Phase 238** | `'"path": source_path,'` grep | the KEY was present and the VALUE was fabricated |

# The five instances in Phase 238, each a distinct sub-species

1. **WR-08 — presence, not honesty.** `test_EVERY_writer_of_metadata_source_carries_the_path_key`
   greps for the literal `'"path": source_path,'`. Both writers had the key. One wrote a lie.
   **The fence's own name says `carries_the_path_key` — it is honest about what it checks, and what
   it checks is not what the phase needed.**
2. **WR-07 — the wrong AST node.** The boundary fence walks only `ast.Compare`, so a leak expressed
   any other way is invisible; it also never scans the file that carried leak #5.
3. **IN-01 — a test that cannot fail.** `test_a_bare_filename_is_not_a_path...` asserts only over
   its own literals. It tests Python, not the product.
4. **IN-02 — a "positive control" that is not one.** A case labelled *"THE POSITIVE CONTROL"* is a
   duplicate of the assertion above it with no planted defect. ⛔ **A control that cannot fail is
   worse than no control, because it is read as proof the fence works.**
5. **IN-08 — two modules exempted from the fence with no reason recorded.** An exemption added in
   the same phase that needed it is a finding, not a design.

# The rule to apply

⛔ **Assert the VALUE where the value is the deliverable.** Ask of every new fence: *"if the thing
I care about became WRONG but stayed PRESENT, would this go red?"* If the answer is no, the fence
is testing shape and the shape was never in doubt.

**Concretely:**
- A fence over a written fact drives the write and reads the stored value back — it does not grep
  the source for the assignment.
- A source-grep fence is legitimate ONLY for *absence* claims (*"nothing in this tree calls X"*),
  and even then must be driven RED against a planted call.
- **A positive control MUST have a planted defect and MUST be seen to fail.** Recording *"I drove
  it red"* means nothing unless the plant was the thing the fence claims to catch — Phase 240
  planted the wrong kind of defect and correctly saw nothing fire.
- **An exemption list carries a reason per entry, in the test body.** ⭐ Phase 241 did this right:
  it retired an egress fence under an explicit decision id with the reason written into the test.

# What an audit would look like

`grep -rl "fence\|guard\|characterization" backend/tests/unit | wc -l` gives the population. For
each: does it read a VALUE, or does it read source text / a key / a testid? The presence-only ones
are the candidates. ⚠ **Do not mass-rewrite them** — a fence that is presence-only but whose
subject genuinely is presence (a registry entry, an eager-import list) is correct as it stands.

Related: [[reference_presence_assertions_cannot_see_content_drift]], [[SEED-282]] (whose re-open
this pattern concealed), [[SEED-267]] (the same disease in the recall harness: a positive control
that did not fire).
