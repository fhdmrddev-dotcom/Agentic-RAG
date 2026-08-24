# Phase 197: Guided Authoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 197-Guided Authoring
**Areas discussed:** When guidance happens, Which decisions get asked, Who authors the questions, How the fast door stays fast, Publish-readiness (D-22), Naming the workflow (D-24)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| When guidance happens | Interview before /generate, questions during, or answerable on the draft | ✓ |
| Which decisions get asked | What counts as "the decisions that matter" | ✓ |
| Who authors the questions | Fixed set vs AI-generated | ✓ |
| How the fast door stays fast | SC#2 + SC#3, the D-05 red line | ✓ |
| Publish-readiness (D-22) | The three-instance pattern; BUG-260815-06 routing | ✓ |
| Naming the workflow (D-24) | Routed here by 193.2; ForkNameDialog named as asset | ✓ |

**User's choice:** all six.
**Notes:** G-2 was surfaced before any question was asked — ROADMAP.md:677 flags it for this phase. Orchestrator recommended discuss-now / sketch-before-plan-phase, on the project's own precedent (`sketches/MANIFEST.md:514` records "G-2 sketch, BEFORE plan-phase") and on the argument that a sketch of guided authoring cannot be drawn until the shape is decided. Not overridden — `/gsd:sketch 197` remains owed.

---

## When guidance happens

### Q1 — Where in the describe→draft flow does the guidance live?

| Option | Description | Selected |
|--------|-------------|----------|
| On the draft, after | One-shot draft still arrives; its decisions become answerable in place. SeedReceipt is the precedent | ✓ |
| Before /generate | 2-3 questions on the describe screen before the CTA. ⚠ friction on the fast door's critical path — what D-05 forbids | |
| During — the AI asks | /generate returns questions, second call builds. ⚠ two calls, non-deterministic | |
| Both — before AND after | Minimal pre-draft ask + answerable decisions after. ⚠ two surfaces, still lands on the critical path | |

**User's choice:** On the draft, after.
**Notes:** → D-01. Satisfies SC#3 by construction — one-shot IS the path.

### Q2 — What does "answerable on the draft" actually mean?

⚠ **Orchestrator correction issued before this question:** `SeedReceipt.tsx` had been described as "the receipt". Measured, it is a **governance** receipt only — it lists ⛨-sealed steps and why, has no line for KB/template/requirement/name, and its docblock binds it with source fences ("authors no sentence of its own", "declares no predicate of its own", "opens no request"). "Make the receipt answerable" is therefore not a small edit to that file.

| Option | Description | Selected |
|--------|-------------|----------|
| A new sibling surface | Arrives beside SeedReceipt; same shape and voice; its fences stay intact | ✓ |
| Widen SeedReceipt's charter | One receipt for everything. ⚠ costs the guarantees that make it checkable | |
| Point at existing controls | A receipt that names each decision and links to its control. ⚠ a tour, not a question | |
| You decide | Leave the surface shape to the sketch | |

**User's choice:** A new sibling surface.
**Notes:** → D-02. Two stacked receipts is a composition problem left explicitly to `/gsd:sketch 197`.

### Q3 — When the author answers, what happens to the draft?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit in place, no re-generate | Writes through builderStore, the existing manual-edit path. Instant, free, deterministic | ✓ |
| Answer, then re-generate | Coherent whole definition. ⚠ paid call per round, discards manual edits, non-deterministic — you may not get your draft back | |
| In place, plus an offer to re-draft | Honest about the limit. ⚠ needs a shape-changing rule | |
| You decide | Leave the write path to research | |

**User's choice:** Edit in place, no re-generate.
**Notes:** → D-03. The known limit (phases were written for the old answer) is recorded; whether the surface SAYS so is Claude's discretion.

### Q4 — If the author ignores the surface and presses Publish?

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing changes — publish as today | Guidance is an offer, never a gate. Preserves 193.2 D-09 | ✓ |
| Unanswered decisions block publish | ⚠ This IS the strict door — what D-05 forbids | |
| Publish proceeds, but says what was unreviewed | ⚠ adds a step to the fast path; "unreviewed" is the only honest word available | |

**User's choice:** Nothing changes.
**Notes:** D-05 holds by construction rather than by care.

---

## Which decisions get asked

### Q1 — Which decisions does the surface carry? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| KB scope + template | The two shape decisions; homed only on the pre-draft screen today (BUG-260731-03) | ✓ |
| The durable requirement | business_requirement; the mark cannot see durability | ✓ |
| The workflow name | D-24; slug still free on a draft | ✓ |
| The deliverable + human steps | ⚠ scope line needed — SEED-164 | ✓ |

**User's choice:** all four.

### Q2 — How far does the deliverable/human-steps row go?

| Option | Description | Selected |
|--------|-------------|----------|
| Surface the suppression only | Report the removed human step and its reason; pause stays SEED-164 | ✓ (later REVERSED) |
| Deliverable only | Smallest, zero engine coupling | |
| Ask, and make it real | ⚠ this is SEED-164; a phase, not a row | |

**User's choice:** Surface the suppression only.
**Notes:** ⚠ **REVERSED at the end of the discussion on a measurement — see the correction below.**

### Q3 — Every row always, or only rows needing attention?

| Option | Description | Selected |
|--------|-------------|----------|
| Always all of them | Fixed rows, fixed order, testable by count; mirrors SeedReceipt's "every sealed step is listed" | ✓ |
| Only rows that need attention | ⚠ needs a per-row correctness predicate; none exists for the requirement | |
| All rows, but flag the ones needing attention | ⚠ inherits the same missing predicate | |

**User's choice:** Always all of them.
**Notes:** → D-07.

---

## Who authors the questions

### Q1 — Where does the question text and current answer come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed vocabulary module | The shipped idiom (doorVocabulary, templateFirstVocabulary, governanceVocabulary, definitionOps). Zero provider calls | ✓ |
| AI writes the questions | ⚠ non-deterministic question set on the fast door; unreviewable copy | |
| Fixed rows, AI-supplied answers | Same as option 1 with the point made explicit | |

**User's choice:** Fixed vocabulary module.
**Notes:** → D-09 / D-10. SeedReceipt's own reasoning quoted: "a sentence that lives inside a component is a sentence nobody can test for drift."

### Q2 — How does the server-known reason travel to the client?

| Option | Description | Selected |
|--------|-------------|----------|
| Widen /generate's response | Additive-optional field; server-derived, client invents nothing | ✓ |
| Stamp it on the definition | Survives reload. ⚠ a one-time authoring event living in the published artifact forever | |
| Derive it client-side | ⚠ directly against 187-24; refused | |
| You decide | Lock only that the reason is server-derived | |

**User's choice:** Widen /generate's response.
**Notes:** → D-13. ⚠ Payload changed by the later correction: it carries the publish-readiness verdict, not a suppression report.

### Q3 — Should 197 install something that stops the FOURTH D-22 instance?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — a mechanical fence | A test that fails when the contract advertises a field the path never populates or surfaces | ✓ |
| Yes — but as a documented checklist | ⚠ a written row goes stale and then answers the auditor with "satisfied" | |
| No — close the three instances only | ⚠ D-22 exists precisely to stop 197 re-deriving this | |

**User's choice:** a mechanical fence.
**Notes:** → D-14. Needs a positive control.

---

## How the fast door stays fast

### Q1 — What is the falsifiable form of SC#2?

| Option | Description | Selected |
|--------|-------------|----------|
| The pre-draft screen is byte-unchanged | innerHTML captures taken BEFORE the change, held green after (193.1's method, 188.1's lesson) | ✓ |
| Keystrokes-to-a-running-workflow unchanged | Closest to what "fast" means. ⚠ a driven UAT row, not a test | |
| The surface is ignorable at a glance | 193.1's own SC#4 wording. ⚠ a screen judgement; 193.1 closed with three such rows OWED | |
| Both 1 and 2 | Mechanical floor + lived proof | |

**User's choice:** byte-unchanged.
**Notes:** → D-05, the decision the ROADMAP already references by number.

### Q2 — Does the surface arrive on its own or is it opened?

| Option | Description | Selected |
|--------|-------------|----------|
| Arrives with the draft, dismissible | Guidance nobody finds is not guidance; dismissal keeps it an offer | ✓ |
| Collapsed by default, one click | ⚠ a collapsed row is easy to never open | |
| Only on request | ⚠ SC#1 says the user IS ASKED | |

**User's choice:** Arrives with the draft, dismissible. → D-04.

### Q3 — Which ways into the Builder get it?

| Option | Description | Selected |
|--------|-------------|----------|
| Only a freshly-generated draft | The only moment "the AI just decided these" is true | ✓ |
| Any draft, however it arrived | Would cover BUG-260731-03 and BUG-260809-02. ⚠ widens to "a decisions panel" | |
| Fresh + re-opened AI drafts | ⚠ needs a durable "AI-authored" signal | |

**User's choice:** Fresh generations only. → D-06, and the two bugs it consequently does NOT close are recorded as deferred.

---

## Publish-readiness (D-22)

### Q1 — How does 197 close "authoring doesn't know what publish requires"?

| Option | Description | Selected |
|--------|-------------|----------|
| The rows ARE the requirements | Derived from the gauntlet's own predicates; answering them IS becoming publish-ready | ✓ |
| A separate readiness strip | ⚠ two overlapping lists, a second place to drift | |
| Fix the refusals instead | That is BUG-260815-06. ⚠ repair, not guidance | |
| Rows derived from the gate, AND fix the refusals | Both ends of one root | |

**User's choice:** The rows ARE the requirements. → D-11.

### Q2 — What stops rows and predicates drifting apart?

| Option | Description | Selected |
|--------|-------------|----------|
| One shared source, server-side | grounding.py's predicates read directly, not copied — the 187-24 move | ✓ |
| A test asserting the lists match | ⚠ proves the SETS agree, never that the ROW says what the GATE means | |
| A same-commit sync rule in CLAUDE.md | ⚠ only to document one of the above, never instead | |
| You decide | Lock only that there is ONE server-side source | |

**User's choice:** One shared source, server-side. → D-12.

### Q3 — Where does BUG-260815-06 go?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer with a named re-open trigger | status stays open, folded_into stays null, trigger in the FRONTMATTER | ✓ |
| Fold it in anyway | ⚠ widens a phase scoped tightly to a fresh draft | |
| Route it to a named future phase | ⚠ v3.7 has only 198 left and it is research-first — a promise with no phase behind it | |

**User's choice:** Defer with a trigger.
**Notes:** The standing lesson was quoted — a bug's `status:` frontmatter IS the index; prose inside a skipped record hid a live bug for two months.

---

## Naming the workflow (D-24)

### Q1 — What can the author change, and does it touch the slug?

| Option | Description | Selected |
|--------|-------------|----------|
| Name only, slug untouched | Removes 193.2's stated reason for deferring entirely; LIB-05 already tells same-named rows apart | ✓ |
| Name and slug together, drafts only | Coherent forever after. ⚠ UNIQUE(slug, version), draftId in flight | |
| Name only, and mark it like the requirement | Reuses 187's name_seeded_by_ai. ⚠ the mark claims authorship, never quality | |

**User's choice:** Name only, slug untouched. → D-15. Whether it wears the mark is Claude's discretion.

### Q2 — Reuse ForkNameDialog.tsx?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline field on the row | Every other row is answered in place; a modal for one of five breaks the grammar | ✓ |
| Reuse ForkNameDialog | The asset 193.2 named. ⚠ built for a different moment — naming a copy that does not yet exist | |
| You decide | Leave it to the sketch | |

**User's choice:** Inline field. → D-17, recorded as a **deliberate decline** of a named asset rather than silence.

---

## ⚠ Correction issued at the close — a decision was REVERSED on a measurement

**"Surface the suppression only" rested on a false premise, and both halves are preserved.**

The orchestrator had proposed, and the user had chosen, that the deliverable row report 193.2's suppression of an `llm_human_input` step — on the reasoning that a step silently deleted from the author's draft is the D-22 pattern exactly.

**Measured before writing CONTEXT.md:** 193.2's fix is a **prompt clause**, not a post-hoc deletion. `workflow_authoring.py:141` instructs the model *"Do NOT add a step that pauses to ask the human (`llm_human_input`, or a validator whose `on_failure` is `ask_user`)"*, and its own comment at `:136-141` binds the claim: *"⚠ THE PUBLISH GATE STAYS (D-11). A prompt clause reduces how often the model composes such a step; it can never guarantee absence."* **Nothing is removed, so there is no event to surface.**

| Option | Description | Selected |
|--------|-------------|----------|
| Deliverable only — drop the suppression half | Honest; keeps the phase off the engine entirely | ✓ |
| Deliverable, plus the constraint stated plainly | Turns a rule discovered by refusal into one stated up front. ⚠ copy, not an answerable decision | |
| Report it when it DOES happen | Surfaces the measured residual. ⚠ a small engine touch; fires rarely (0/20) | |

**User's choice:** Deliverable only. → D-08.
**Consequence:** the human-step case was never a D-22 instance; D-22's three instances are closed by rows 3 and 4 and by D-14's fence. D-13 survives with a changed payload — the readiness verdict instead of a suppression report.

---

## Claude's Discretion

- Row order among the five, and the exact wording of all five sentences.
- Whether the surface states D-03's limit (answering does not re-shape phases written for the old answer).
- Whether the name row wears `name_seeded_by_ai`.
- Whether D-10's vocabulary module is new or extends `templateFirstVocabulary.ts`.
- What a row shows when its answer is already correct.
- Whether D-04's dismissal is remembered across a reload.

## Deferred Ideas

- `BUG-260815-06` — the structural-gate refusal names nothing actionable. Deferred with a frontmatter re-open trigger.
- `BUG-260809-02` — a canvas-built workflow can never be published. Not closed; a consequence of D-06.
- `BUG-260731-03` — a workflow's KB can only be chosen pre-draft. Answered for fresh drafts only; same D-06 cause.
- `SEED-164` / 193.2 D-25 — a durable human pause on real runs.
- Slug renaming.
- Per-step model as a sixth row (196's `ModelField` exists).
- Canvas-surface bugs left open, not routing candidates: `BUG-260813-01`, `BUG-260807-01`, `BUG-260808-01`.

## Not discussed (offered, declined)

Three gray areas were offered at the close and the user chose to proceed: what a row shows when its answer is already correct; whether the surface survives a reload; whether 196's `ModelField` earns a sixth row. The first two became Claude's discretion; the third became a deferred idea.
