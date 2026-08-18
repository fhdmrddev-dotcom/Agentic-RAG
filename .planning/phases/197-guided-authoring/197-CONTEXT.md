# Phase 197: Guided Authoring - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning — ⚠ **but G-2 fires: `/gsd:sketch 197` is owed BEFORE `/gsd:plan-phase 197`**

<domain>
## Phase Boundary

**What this phase delivers:** a freshly AI-generated workflow draft arrives with the
decisions the AI made on the author's behalf **made visible and answerable in place**,
instead of being silently baked in.

Today the fast door is genuinely one-shot: `useTemplateFirstDraft.ts` owns the describe
text, the pre-draft KB choice, the template attach and the CTA → **one** `/workflows/generate`
call → `workflow_authoring.py:323` returns a whole multi-phase `WorkflowDefinition` →
`SeedReceipt.tsx` **explains what was auto-applied**. The author is *told* what was decided
and is never *asked*.

**This phase changes the ASKING, not the generating.** The one-shot generation is untouched.
The pre-draft describe screen is untouched. The publish gate is untouched. What is added is a
decisions surface on the **drafted** view.

**Explicitly OUT of scope** (each with a home named in `<deferred>`):
- Any change to the pre-draft describe screen (that is the D-05 red line, below).
- Any change to the publish gauntlet's pass/fail behaviour (193.2 D-09 stands).
- A durable human-in-the-loop pause (`SEED-164`).
- Hand-built canvas workflows and re-opened drafts — the surface is **fresh generations only**.
- Making publish refusals actionable (`BUG-260815-06`, deferred with a trigger).

</domain>

<decisions>
## Implementation Decisions

### The red line (pre-named by the ROADMAP)

- **D-05 — THE FAST DOOR STAYS FAST, AND IT IS FENCED MECHANICALLY, NOT JUDGED.**
  ⚠ `ROADMAP.md:677` and `ROADMAP.md:365` both reference *"Phase 197's D-05 red line"* — a
  forward reference to a decision that did not exist until this file. **It is numbered D-05
  here deliberately so those two pointers resolve.** The red line: *guidance must not turn
  "Describe & run" into the strict door.*

  **The falsifiable form (chosen over two judgement-based alternatives):** the **pre-draft
  describe screen is byte-unchanged** — zero new controls, zero new required input, zero new
  gates. Proved the way 193.1 proved its own extraction: whole-`container.innerHTML` captures
  of the pre-draft screen taken **on the tree BEFORE the change**, held green after.
  ⚠ **188.1's lesson is binding here: a characterization baseline only proves something if it
  PREDATES the change.** A capture taken after the first edit proves nothing.

  This also satisfies **ROADMAP SC#3** (*a user can still get a one-shot draft*) **by
  construction** rather than by a separate feature — the one-shot path IS the path; guidance is
  what you may do next.

### Where the guidance lives

- **D-01 — Guidance is ON THE DRAFT, AFTER.** Not a pre-draft interview, not clarifying
  questions mid-generation. The draft still arrives in one shot; its decisions then become
  answerable. Rejected: *before `/generate`* (puts friction on the fast door's critical path —
  the exact thing D-05 forbids); *during* (two provider calls, non-deterministic question
  count, and 193.2 measured prompt-level behaviour as a **reduction, never a guarantee**).

- **D-02 — A NEW SIBLING SURFACE, NOT A WIDENED `SeedReceipt`.**
  ⚠ **Measured during discussion and worth not re-deriving:** `SeedReceipt.tsx` is **not** a
  general "here is what I decided" receipt — it is a **governance** receipt. It lists steps that
  got the ⛨ seal and why, and nothing else. Its docblock binds it hard and each clause is
  enforced by a source fence with a positive control: *"authors no sentence of its own"*,
  *"declares no predicate of its own"*, *"imports nothing from the API client, names no route
  and opens no request"*. It has no line for KB scope, template, requirement or name.
  **Widening its charter would cost exactly the guarantees that make it checkable.**
  So: a **new sibling** arrives beside it on the drafted view — same shape, same voice, same
  "nothing has been committed" close. ⚠ **Two receipts stacked on one screen is a composition
  problem, and it is the sketch's problem** (see G-2, below).

- **D-03 — ANSWERS EDIT IN PLACE. NO RE-GENERATION.** Answering a row writes straight into the
  draft definition through the store path an author's manual edit already takes
  (`builderStore.ts`). Instant, free, deterministic, and the author's answer is final by
  construction. Rejected: *answer-then-regenerate* — it costs a paid call per round, discards
  manual edits made in between, and 193.2 measured a fresh generation as non-deterministic, so
  **you may not get your draft back**.
  ⚠ **The known limit, to be stated rather than hidden:** the rest of the draft was built around
  the OLD answer. Changing the KB scope does not re-shape the phases that were written for the
  old scope. Whether the surface SAYS so is Claude's discretion (below); what is locked is that
  it must not silently discard the author's own edits.

- **D-04 — THE SURFACE ARRIVES WITH THE DRAFT AND IS DISMISSIBLE.** It appears when the draft
  lands — the moment the decisions were actually made — and can be dismissed. Guidance nobody
  finds is not guidance; `SeedReceipt` already sets the precedent of a card that arrives unasked.
  **Dismissal is what keeps it an offer rather than a wall.**

- **D-06 — FRESH GENERATIONS ONLY.** Not re-opened drafts, not forks, not hand-built canvas
  workflows. The surface exists because *an AI just made decisions on your behalf*; that is the
  only moment the claim is true. On a canvas build YOU made the decisions and a card reciting
  them is noise. ⚠ **Consequence recorded rather than smoothed:** this phase therefore does
  **NOT** close `BUG-260809-02` (a canvas-built workflow can never be published — no UI sets
  `business_requirement`) and does **NOT** close `BUG-260731-03` (an unbound workflow cannot be
  re-bound without regenerating). Both stay where they are; see `<deferred>`.

### Which decisions the surface carries

- **D-07 — FIVE FIXED ROWS, ALWAYS ALL OF THEM, ALWAYS THE SAME ORDER.**
  1. **Knowledge-base scope** (`project_folder_id`)
  2. **The bound template**
  3. **The durable business requirement** (`business_requirement`)
  4. **The workflow name**
  5. **The deliverable** — what this workflow produces

  Rejected: *only rows needing attention*, and *all rows with the weak ones flagged*. **Both
  require a per-row "did the AI get this right?" predicate, and for the requirement row NO SUCH
  PREDICATE EXISTS** — `SEED-163` measured `gpt-5.5` naming one-run parameters in **5 of 5**
  requirements, all 20 of which were still correctly stamped `seeded_by_ai`. The stamp's question
  is *"is this a copy of the describe text?"*, never *"is this durable?"*. A fixed row set is also
  **testable by count**, and it mirrors `SeedReceipt`'s own rule — *every* sealed step is listed,
  because *"never let the seal arrive unexplained"*.

- **D-08 — ⚠ CORRECTED MID-DISCUSSION: THE DELIVERABLE ROW COVERS THE DELIVERABLE AND NOTHING
  ELSE. THERE IS NO SUPPRESSION TO REPORT.**
  **The original decision was to surface 193.2's suppression of an `llm_human_input` step** — on
  the reasoning that a step being silently deleted from the author's draft is the D-22 pattern
  exactly. **That premise was FALSE and is recorded here rather than overwritten**, because the
  correction is the useful part.
  **Measured:** 193.2's fix is a **prompt clause**, not a post-hoc deletion —
  `workflow_authoring.py:141` instructs the model *"Do NOT add a step that pauses to ask the
  human (`llm_human_input`, or a validator whose `on_failure` is `ask_user`)"*, and its own
  comment at `:136-141` binds the claim: *"⚠ THE PUBLISH GATE STAYS (D-11). A prompt clause
  reduces how often the model composes such a step; it can never guarantee absence."*
  **Nothing is removed, so there is no event to surface.** The human-step case was therefore
  never a D-22 instance; D-22's three instances are closed by rows 3 and 4 and by D-14's fence.

### Who authors the questions

- **D-09 — A FIXED `.ts` VOCABULARY MODULE. THE AI WRITES NO QUESTION TEXT.**
  Five rows, five sentences, authored once in a vocabulary module — the shipped idiom on this
  exact surface (`doorVocabulary.ts` 304 lines, `templateFirstVocabulary.ts` 238,
  `governanceVocabulary.ts`, `definitionOps`). `SeedReceipt`'s docblock states the reason
  verbatim: *"a sentence that lives inside a component is a sentence nobody can test for drift."*
  Zero provider calls, assertable by character-identity, no new non-determinism on the fast door.
  Each row's **current answer** is read from the draft definition, not authored.
  Rejected: *the AI writes the questions* — a non-deterministic question set plus copy nobody can
  review before it reaches an author.

- **D-10 — WHETHER THE MODULE IS NEW OR EXTENDS AN EXISTING ONE IS OPEN.** Both
  `templateFirstVocabulary.ts` and `doorVocabulary.ts` are the right shape and the right size.
  Planning decides; the binding rule is **one module, no sentence inside the component**.

### Publish-readiness — the shared root

- **D-11 — THE ROWS *ARE* THE PUBLISH REQUIREMENTS. THEY ARE DERIVED FROM THE GAUNTLET'S OWN
  PREDICATES, NOT PICKED BY TASTE.** `SEED-163` names the root of three separate defects:
  *"the authoring path makes decisions the author is never shown, and does not know what the
  publish gate requires."* This phase closes the second half by construction — answering the
  rows **is** how you become publish-ready, with no second surface and with the gate learning
  nothing new.

- **D-12 — ONE SHARED SOURCE, AND IT IS THE SERVER'S.** The predicates already live in one place:
  `backend/app/services/harness/grounding.py:1007` declares `business_requirement_missing` and
  `:1000` holds `BUSINESS_REQUIREMENT_MISSING_MESSAGE`, which `publish_service.py` reads at
  stage 1. **The authoring surface reads the SAME source; it does not carry a copy.**
  ⚠ This is precisely the **187-24** move, and its reasoning transfers verbatim: `SeedReceipt`
  had declared its own second copy of a predicate one line from the call it had to agree with;
  *"the two agreed, and would have gone on agreeing right up until the rule stopped being exact
  string equality."* The predicate was **MOVED, not merely checked**. Rejected here: a test
  asserting the two lists match (it proves the SETS agree, never that the ROW says what the GATE
  means), and a same-commit sync rule in CLAUDE.md (that file's own repeated finding is that a
  written row goes stale and then answers the auditor with `satisfied`).

- **D-13 — `POST /workflows/generate`'s RESPONSE IS WIDENED, ADDITIVELY.** It returns
  `{ok, definition}` today. The readiness verdict per row is **server-derived** and travels with
  the draft, so the client invents nothing — the same floor `SeedReceipt` holds
  (*"never INVENT a reason string client-side"*).
  ⚠ **The field MUST be optional, and an ABSENT field must never render as "everything is fine"**
  — the `model_registry` lesson (an absent override row means ENABLED) and `useModelRegistry`'s
  (*a failed read is `status: "failed"`, never an empty success*).
  ⚠ **This decision survived D-08's correction with a changed payload:** it was originally
  scoped to carry a suppression report; there is no suppression, so it carries the readiness
  verdict instead. Same mechanism, different content.
  Rejected: *derive it client-side* — directly against 187-24, refused.

- **D-14 — A MECHANICAL FENCE AGAINST THE FOURTH D-22 INSTANCE.**
  193.2's **D-22** hands 197 a **measured** pattern rather than one to re-derive: *if a third
  "the authoring path did not supply something it already had" appears, the pattern is the
  phase, not the field.* There are three:
  1. `SEED-157` — `/generate` **accepted** `template_placeholders` for five phases and the
     frontend **never sent it**.
  2. `SEED-163` — the emit tool **advertised** `business_requirement` and the prompt **never
     asked for it** (`grep -c` over the authoring module returned **0** before, **5** after).
  3. The AI-chosen **name** the author never gets to set (D-24 → row 4 here).

  **197 installs a test that fails when the authoring contract advertises a field the authoring
  path never populates or never surfaces.** Rejected: a documented checklist — *a prose note in
  a CONTEXT file is exactly as invisible as a hot file missing from the ledger*, which is this
  project's own standing lesson.
  ⚠ **The fence needs a positive control**, per the repeated finding that a fence swept against
  an empty set passes green while defending nothing (192.1, and SC#3 in 196).

### Naming (D-24 inherited from 193.2)

- **D-15 — THE AUTHOR EDITS THE NAME. THE SLUG IS UNTOUCHED.** 193.2 deferred naming for one
  measured reason: *a rename on a PUBLISHED row touches the slug that identity, forks and
  versioning key off.* **Leaving the slug alone removes that risk entirely**, and LIB-05 already
  shipped the machinery for telling same-named workflows apart. Accepted cost: name and slug can
  disagree.
  ⚠ **187 shipped `name_seeded_by_ai`** — the provenance shape is already there; whether the row
  wears the mark is Claude's discretion, bound by the caveat in D-16.

- **D-16 — THE `AI-proposed` MARK MEANS "A MODEL WROTE THIS". IT NEVER MEANS "THIS IS GOOD" OR
  "THIS IS DURABLE".** Carried verbatim from `SEED-163`'s close-out and binding on every string
  this phase writes. Measured basis: `gpt-5.5` named one-run parameters in **5 of 5** QBR
  requirements and **all 20 were still correctly stamped**, because the stamp's question is the
  anti-echo one. **No copy anywhere may imply otherwise.**

- **D-17 — AN INLINE FIELD ON THE ROW, NOT `ForkNameDialog.tsx`.**
  ⚠ **Recorded as a deliberate decision rather than left as silence, because 193.2 named that
  file as the asset for this work.** It is declined: `ForkNameDialog` exists for a different
  moment — naming a **copy that does not yet exist** before forking — whereas here the name
  already exists and is being edited. A modal for one of five rows breaks the surface's own
  grammar and adds a modal to a screen that just gained a card.

### Claude's Discretion

- **Row order** among the five, and the exact wording of all five sentences — bounded by D-09
  (the vocabulary module), D-16 (the mark claims authorship, never quality) and the shipped
  `REQUIREMENT_INVITATION` voice.
- **Whether the surface states D-03's limit** (that answering does not re-shape phases written
  for the old answer) — and if so, in one line or per affected row.
- **Whether the name row wears the `name_seeded_by_ai` mark**, given the row is already
  presented as something the AI chose.
- **Whether `D-10`'s vocabulary module is new or extends `templateFirstVocabulary.ts`.**
- **What a row shows when its answer is already correct** — the same words as when it is not, or
  a quieter state. Not asked; no criterion depends on it.
- **Whether the dismissal in D-04 is remembered** across a reload within the drafting session.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirement and its seeds
- `.planning/REQUIREMENTS.md` §AUTH-02 (line 27) — the requirement this phase satisfies, and the
  AUTH-03 correction note (lines 34-60) explaining why an *unexamined assumption in a requirement*
  made Phase 193 build the wrong thing. Read the correction, not just the line.
- `.planning/seeds/SEED-051-generalized-nl-workflow-authoring.md` — AUTH-02's originating seed.
  Binding parts: *"Builder = AI heavy-lifts, human observes/approves/suggests (HITL). Drafts never
  auto-publish"*; the two grounding moments; the skill-vs-workflow distinction. ⚠ Its
  *"Execution = in a thread"* bullet is **SUPERSEDED** — the dated note at the foot governs.
- `.planning/seeds/SEED-163-authoring-does-not-propose-the-business-requirement.md` — **read in
  full.** Names the shared root, carries the D-22 three-instance pattern, and its close-out block
  carries D-16's caveat with the measurement behind it.
- `.planning/seeds/SEED-157-template-first-authoring-ai-drafts-blind.md` — D-22 instance 1.

### Inherited decisions (do NOT re-litigate)
- `.planning/phases/193.2-from-authored-to-runnable/193.2-CONTEXT.md` — **D-22** (lines 311-316,
  the three-instance pattern handed forward), **D-24** (lines 480-484, naming routed here with
  `ForkNameDialog.tsx` named), **D-25** (the human pause deferred to `SEED-164`), and **D-09**
  (the publish gate is not changed; pressing Publish is the consent).
- `.planning/phases/193.1-template-first-authoring/193.1-CONTEXT.md` — the *"fast door stays
  fast"* wording D-05 inherits (lines 145, 699), and the characterization-baseline discipline the
  D-05 fence copies.
- `.planning/ROADMAP.md` §"Phase 197: Guided Authoring" (lines 672-684) — the three success
  criteria, and the two forward references to *"Phase 197's D-05 red line"* (lines 365, 677).

### The code this phase touches or reads
- `backend/app/services/workflow_authoring.py` — `AUTHORING_SYSTEM_PROMPT` (:57), the
  human-step prompt clause and its binding comment (**:136-146**), `WF_SCHEMA` (:229),
  `EMIT_TOOL` (:232), `generate_workflow_definition` (:323).
- `backend/app/services/harness/grounding.py` — `BUSINESS_REQUIREMENT_MISSING_MESSAGE` (:1000),
  `business_requirement_missing` (:1007). **D-12's single source.**
- `backend/app/services/harness/publish_service.py` — stage 1, the consumer of the above.
- `backend/app/api/workflows.py` — the `/generate` route (D-13 widens its response).
- `frontend/src/components/workflows/SeedReceipt.tsx` — **read the docblock before writing a
  sibling.** It states the charter D-02 refuses to widen and the client-derivation floor D-13
  inherits.
- `frontend/src/components/workflows/useTemplateFirstDraft.ts` — owns the describe text, the
  pre-draft KB choice, the CTA rule and the generate call. **The D-05 fence is a fence on this
  hook's screen.** Its docblock also documents the callback-out contract a new concern must follow.
- `frontend/src/components/workflows/builderStore.ts` — D-03's write path.
- `frontend/src/components/workflows/templateFirstVocabulary.ts` (238 ln),
  `doorVocabulary.ts` (304 ln) — D-09's precedent and D-10's candidates.
- `frontend/src/lib/api.ts:4131-4139` — `generateWorkflow`, the client half of D-13.

### Standing project rules that bind this phase
- `CLAUDE.md` §"Workflow guardrails" — **G-2** (fires; see below), **G-5** (fires on five
  predicted files; see `<code_context>`), **G-4** (lived-experience UAT rows at scope time), G-7.
- `CLAUDE.md` §"UAT scoreboard recipe" — the full native roster is **8 rows**, derived from
  `MODEL_CAPABILITIES`, never re-typed. Relevant because D-09's *"no provider call"* choice must
  be shown to hold, and because generation quality varies by provider (measured: anthropic 0/5
  vs openai 5/5 on one-run parameters).
- `docs/HOT-FILE-LEDGER.md` — sections for every file named in `<code_context>`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SeedReceipt.tsx` (360 ln)** — the *shape* to copy, not the file to edit (D-02): a card that
  arrives unasked with the draft, lists rows with reasons, and closes by saying nothing has been
  committed. Its fences are the pattern the new sibling should adopt.
- **The vocabulary-module idiom** — `doorVocabulary.ts`, `templateFirstVocabulary.ts`,
  `governanceVocabulary.ts`, `definitionOps`. Four shipped precedents for D-09.
- **`builderStore.ts`** — the store D-03 writes through. 193.2 established the exact move: clear a
  provenance flag **in the same `set()`** that writes the text, with no client-side comparison.
- **`name_seeded_by_ai` (187) / `business_requirement_seeded_by_ai` (193.2)** — two shipped
  additive-optional provenance flags on a JSONB column, **zero migration**, `extra="forbid"`
  proved not relaxed, stamped server-side after validation on the single success path.
- **`DescribeKbPicker.tsx` / `DescribeTemplateRow.tsx`** — the existing controls for rows 1 and 2,
  today mounted **only** on the pre-draft screen. `DescribeTemplateRow`'s docblock records the
  one-component-two-mounts rule; a third mount is the established move.

### Established Patterns
- **A predicate lives in ONE place, and it MOVES rather than gets checked** (187-24). Binding on
  D-12.
- **No sentence inside a component** — every user-visible string is an imported identifier, so
  drift is assertable by character-identity.
- **Never invent a reason client-side** — the client intersects and renders; the server defines.
- **Additive-optional over migration** for anything stored on the definition JSONB.
- **A fence needs a positive control**, or it passes green while defending nothing.

### Integration Points
- `POST /workflows/generate` response shape → `api.ts:4131` `generateWorkflow` →
  `useTemplateFirstDraft`'s `onDrafted` callback → the page → the new surface. **D-13's field
  travels this whole chain.**
- `grounding.py`'s predicates → a server-side readiness verdict → the same chain. **D-12.**

### ⚠ G-5 SCAN — FIRES ON FIVE OF THE SIX PREDICTED FILES

Scanned against `CLAUDE.md`'s hot-file ledger, per the standing rule that discuss-phase scans
predicted `files_modified` against the table:

| Predicted file | ledger triple | G-5 |
|---|---|---|
| `frontend/src/lib/api.ts` | **170 / 97 / 6154** | ⚠ **FIRES HARDEST — the hottest file in the repo** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 42 / 13 / 2398 | **FIRES** |
| `backend/app/api/workflows.py` | 36 / 18 / 1984 | **FIRES** — ledger says *extraction due, not taken* |
| `backend/app/services/harness/grounding.py` | 18 / 5 / 1252 | **FIRES** |
| `frontend/src/components/workflows/builderStore.ts` | 11 / 5 / 837 | **FIRES** |
| `backend/app/services/workflow_authoring.py` | 12 / 6 / 572 | **FIRES** |

**The refactor recommendation, produced FIRST as G-5 requires:** the decisions surface and its
vocabulary module are **NEW files**, so the frontend half is **honoured by construction** — the
193.1 precedent, where the pre-draft concern was cut to `useTemplateFirstDraft.ts` *before* the
feature that needed room. **The one row that is not covered by construction is `api.ts`**, which
gains a response type and nothing else, and which has been invisible to its own guardrail for 97
phases. ⚠ **Re-derive every triple with the ledger's own recipe before planning** — five rows were
found stale on 2026-08-17 and three of them read `satisfied`, so a cell must not be trusted.

</code_context>

<specifics>
## Specific Ideas

- **The ROADMAP pre-named this phase's D-05 before it existed.** Two ROADMAP lines point at
  *"Phase 197's D-05 red line"*. The numbering above is chosen so those pointers resolve —
  changing it breaks two live references.
- **`SeedReceipt` is a governance receipt, not a decisions receipt.** This was measured during
  the discussion and is the single fact that shaped D-02. Anyone reading "make the receipt
  answerable" without opening the file will reach for the wrong edit.
- **The publish-refusal message already exists and already names its own control** —
  `BUSINESS_REQUIREMENT_MISSING_MESSAGE`: *"Add the Business requirement — one line saying what
  this workflow must deliver — before publishing."* D-12's rows should sound like this, because
  it is the sentence the gate itself uses.
- **Generation quality is provider-dependent, measurably.** `193.2-FREQUENCY.md`: anthropic named
  a one-run parameter in **0 of 5** requirements; openai in **5 of 5**. An author on one provider
  has real work to do on row 3 that an author on another does not. **UAT must not score row 3 on
  one provider.**

</specifics>

<deferred>
## Deferred Ideas

- **`BUG-260815-06` (major, `status: open`) — the structural-gate refusal names nothing
  actionable** while the precise reason is computed and stored **verbatim in `harness_audit`**.
  Shares this phase's root, and deliberately not folded: it is repair on the **publish** surface,
  not guidance on the **authoring** surface, and SC#1 asks for the author to be *asked*, not
  better refused.
  **Re-open trigger:** the next phase touching the publish gauntlet's refusal copy, **OR** a
  second report of an author stuck on an unexplained refusal.
  ⚠ **THIS MUST BE WRITTEN INTO THE REPORT'S FRONTMATTER, NOT ONLY HERE.** The project's standing
  lesson is that *a bug's `status:` frontmatter IS the index* — prose saying "stays open" inside a
  record the scan skips hid a live bug for two months. `status` stays `open`, `folded_into` stays
  `null`, and the trigger goes in the frontmatter.

- **`BUG-260809-02` (blocking) — a canvas-built workflow can never be published**, because no UI
  sets `business_requirement`. **NOT closed by this phase**, a direct consequence of D-06
  (fresh generations only). The decisions surface would fix it if it covered canvas builds.
  **Re-open trigger:** any phase that widens the surface beyond fresh generations, or the next
  report of a canvas-built workflow that cannot publish.

- **`BUG-260731-03` — a workflow's KB can only be chosen on the pre-draft describe screen**; an
  unbound workflow searches the WHOLE KB and cannot be re-bound without regenerating. Row 1
  answers this **for a fresh draft only**; a re-opened draft is still stuck. Same D-06 cause.
  **Re-open trigger:** the same widening, or a report of an unbound published workflow.

- **`SEED-164` / 193.2 **D-25** — a workflow that deliberately pauses for a person and can still
  be published.** 193.2 named the expensive half explicitly: *the durable pause on REAL runs, not
  publish.* D-08's correction shows there is not even a suppression to surface — the current
  behaviour is a prompt clause, measured as a reduction (0/20), never an absence.
  **Re-open trigger:** already carried by `SEED-164`; a user asking for a genuine
  human-in-the-loop workflow raises it from seed to requirement.

- **Slug renaming.** D-15 leaves the slug alone. A published rename touches the key identity,
  forks and versioning use.
  **Re-open trigger:** a report of a name/slug disagreement confusing someone, or a phase that
  takes up workflow identity.

- **Per-step model as a sixth row.** 196 just shipped `ModelField` (the registry-backed picker,
  mounted 4×) — so the control exists. Not asked, not included; five rows was the answer.
  **Re-open trigger:** a report that the AI chose a wrong model for a step.

- **Canvas-surface bugs left open, not routing candidates:** `BUG-260813-01` (canvas stays dark
  in light mode, minor), `BUG-260807-01` / `BUG-260808-01` (WR-04 prototype-key sinks, minor).
  Adjacent surface, not the describe door.

</deferred>

---

*Phase: 197-Guided Authoring*
*Context gathered: 2026-08-18*
