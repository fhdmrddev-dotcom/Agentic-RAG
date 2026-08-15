# SEED-163 — NL authoring writes the whole workflow but leaves the one field that blocks publish blank

**Planted:** 2026-08-15, by the operator during Phase 193.1 end-to-end UAT
**Surface:** Agentic-RAG — workflow authoring (describe door) → publish gauntlet
**Status:** open

---

## What happened

The operator uploaded a knowledge base and a `.docx` template, described a Quarterly Business
Review workflow, and the AI authored a five-phase definition from that description. They then
could not publish it, because **`business_requirement` was empty and they had to type it by
hand** — restating, in a second field, what they had already written in the describe box.

Their words: *"we are describing to the AI and the AI creates the workflow, but then I have
again manually to enter the business objective."*

## Measured, not assumed

- `WorkflowDefinition.business_requirement: str | None = None` (`backend/app/models/harness.py:538`)
  — free text, no format constraint.
- **`backend/app/services/workflow_authoring.py` never sets it.** `grep -c business_requirement`
  over that module returns **0**. The emit produces phases, not this field.
- The publish gauntlet blocks on it at **stage 1**, returning 400
  (`backend/app/services/harness/publish_service.py:7,77`), via the shared predicate
  `business_requirement_missing` (`grounding.py:1007`).
- The author-facing string is `BUSINESS_REQUIREMENT_MISSING_MESSAGE` (`grounding.py:1000`):
  *"Add the Business requirement — one line saying what this workflow must deliver — before
  publishing."*

## Why this is a MOVED gap, not a new one

The same docblock records `BUG-260809-02`: the message used to read *"a workflow must declare
exactly one business_requirement before publish"* — **naming an internal snake_case field at a
user who had nowhere to type it.** The fix added the control and rewrote the copy to point at
its label.

⚠ **But the fix addressed discoverability, not redundancy.** The control now exists and is
findable; the author is still asked to author the same intent twice. **The gap moved one step
down the funnel rather than closing.** That is worth stating plainly, because a future reader
looking at `BUG-260809-02`'s closure would reasonably assume this was handled.

## Why it is small

The authoring service **already receives the `describe` text** — it is the sole input to
`generate_workflow_definition`. A one-line business requirement is strictly less inference than
the five phases it already emits. The natural shape is **propose, don't decide**: the emit
returns a suggested one-liner, the field arrives pre-filled, and the author edits or replaces it.

## What NOT to do

- ⚠ **Do not silently copy `describe` verbatim into `business_requirement`.** They are different
  things — `describe` is a task instruction (*"produce a QBR for Northwind covering Q3"*), the
  requirement is a durable statement of what the workflow must deliver for **any** run
  (*"produce a client-ready QBR for a named account from our own records"*). A verbatim copy
  would bake one run's parameters into the workflow's definition of done, and the publish
  gauntlet's later stages read this field.
- ⚠ **Do not auto-publish off an auto-filled field.** The publish gate is a human checkpoint by
  design; pre-filling it must not also satisfy it. The author still presses publish.
- ⚠ **The field must stay editable and must not become derived-only** — a workflow's stated
  purpose is the one thing an author should always be able to overrule.

## Re-open trigger

**Fold this into the next phase that touches NL authoring or the describe door** — currently
**197 / AUTH-02** (*deepen the fast door*) is the likeliest home, since it is already scoped to
that surface. If a user reports the double-entry again before then, that is corroboration and
raises it from friction to a defect.

## Related

- `BUG-260809-02` — the ancestor: no UI set the field at all.
- `SEED-157` — the same shape one field over: `/generate` accepted `template_placeholders` for
  five phases and the frontend never sent it. **Both are cases of the authoring path not
  supplying something it already had.** If a third appears, the pattern is the phase, not the field.
