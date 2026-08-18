# Phase 197: Guided Authoring — Research

**Researched:** 2026-08-18
**Domain:** Frontend composition on a shipped React/Zustand authoring surface + one additive backend response field
**Confidence:** HIGH (every claim below is a `file:line` read or a command run in this session; two are refutations of inherited prose)
**Base commit measured against:** `61f779e599d6fa1f0d4ea5db712b50fd3d5331e9` (`develop`)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied from `.planning/phases/197-guided-authoring/197-CONTEXT.md`. **Do not re-litigate.**

- **D-05 — THE FAST DOOR STAYS FAST, AND IT IS FENCED MECHANICALLY, NOT JUDGED.** The pre-draft
  describe screen is **byte-unchanged** — zero new controls, zero new required input, zero new
  gates. Proved by whole-`container.innerHTML` captures taken **on the tree BEFORE the change**.
  188.1's lesson binding: *a characterization baseline only proves something if it PREDATES the
  change.* Satisfies ROADMAP **SC#3** by construction.
- **D-01 — Guidance is ON THE DRAFT, AFTER.** Not a pre-draft interview, not mid-generation.
- **D-02 — A NEW SIBLING SURFACE, NOT A WIDENED `SeedReceipt`.** `SeedReceipt.tsx` is a
  **governance** receipt. Its docblock is fenced (*"authors no sentence of its own"*, *"declares no
  predicate of its own"*, *"imports nothing from the API client, names no route and opens no
  request"*) and widening its charter costs exactly the guarantees that make it checkable.
- **D-03 — ANSWERS EDIT IN PLACE. NO RE-GENERATION.** Through `builderStore.ts`. Known limit stated
  rather than hidden: the rest of the draft was built around the OLD answer.
- **D-04 — THE SURFACE ARRIVES WITH THE DRAFT AND IS DISMISSIBLE.**
- **D-06 — FRESH GENERATIONS ONLY.** Not re-opened drafts, forks or hand-built canvas workflows.
- **D-07 — FIVE FIXED ROWS, ALWAYS ALL OF THEM, ALWAYS THE SAME ORDER.** (1) Knowledge-base scope
  `project_folder_id`; (2) the bound template; (3) the durable business requirement
  `business_requirement`; (4) the workflow name; (5) the deliverable.
- **D-08 — THE DELIVERABLE ROW COVERS THE DELIVERABLE AND NOTHING ELSE. THERE IS NO SUPPRESSION TO
  REPORT.** 193.2's fix is a prompt clause, not a post-hoc deletion.
- **D-09 — A FIXED `.ts` VOCABULARY MODULE. THE AI WRITES NO QUESTION TEXT.**
- **D-10 — WHETHER THE MODULE IS NEW OR EXTENDS AN EXISTING ONE IS OPEN.** Binding rule: **one
  module, no sentence inside the component.**
- **D-11 — THE ROWS *ARE* THE PUBLISH REQUIREMENTS**, derived from the gauntlet's own predicates.
- **D-12 — ONE SHARED SOURCE, AND IT IS THE SERVER'S.** `grounding.py:1007`
  `business_requirement_missing`, `:1000` `BUSINESS_REQUIREMENT_MISSING_MESSAGE`. The predicate is
  **MOVED, not merely checked** (the 187-24 move).
- **D-13 — `POST /workflows/generate`'s RESPONSE IS WIDENED, ADDITIVELY.** The readiness verdict per
  row is **server-derived**. ⚠ The field **MUST be optional, and an ABSENT field must never render
  as "everything is fine."**
- **D-14 — A MECHANICAL FENCE AGAINST THE FOURTH D-22 INSTANCE.** A test that fails when the
  authoring contract advertises a field the authoring path never populates or never surfaces.
  ⚠ **The fence needs a positive control.**
- **D-15 — THE AUTHOR EDITS THE NAME. THE SLUG IS UNTOUCHED.** Accepted cost: name and slug can
  disagree.
- **D-16 — THE `AI-proposed` MARK MEANS "A MODEL WROTE THIS". IT NEVER MEANS "THIS IS GOOD" OR
  "THIS IS DURABLE".**
- **D-17 — AN INLINE FIELD ON THE ROW, NOT `ForkNameDialog.tsx`.**

### Claude's Discretion

- **Row order** among the five, and the exact wording of all five sentences — bounded by D-09, D-16
  and the shipped `REQUIREMENT_INVITATION` voice.
- **Whether the surface states D-03's limit** (that answering does not re-shape phases written for
  the old answer) — and if so, in one line or per affected row.
- **Whether the name row wears the `name_seeded_by_ai` mark**, given the row is already presented as
  something the AI chose. ⚠ **See `## Contradicts a locked decision` below — this option is not
  free.**
- **Whether `D-10`'s vocabulary module is new or extends `templateFirstVocabulary.ts`.**
- **What a row shows when its answer is already correct** — the same words as when it is not, or a
  quieter state.
- **Whether the dismissal in D-04 is remembered** across a reload within the drafting session.

### Deferred Ideas (OUT OF SCOPE)

- **`BUG-260815-06`** — the structural-gate refusal names nothing actionable. Re-open trigger: the
  next phase touching the publish gauntlet's refusal copy, **OR** a second report of an author stuck
  on an unexplained refusal.
- **`BUG-260809-02`** — a canvas-built workflow can never be published. ⚠ **STATE.md's correction
  applies: the report's frontmatter reads `status: closed`, `folded_into: quick-260809-klo`. D-06's
  recorded consequence does not exist.** Verified again this session — see `## Contradicts a locked
  decision`.
- **`BUG-260731-03`** — a workflow's KB can only be chosen on the pre-draft describe screen. Row 1
  answers this for a fresh draft only.
- **`SEED-164` / 193.2 D-25** — a workflow that deliberately pauses for a person.
- **Slug renaming.** D-15 leaves the slug alone.
- **Per-step model as a sixth row.** `ModelField` exists (196); not asked, not included.
- **Canvas-surface bugs** `BUG-260813-01`, `BUG-260807-01`, `BUG-260808-01` — adjacent surface, not
  routing candidates.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **AUTH-02** | *A user drafting from a description is guided through the decisions that matter, rather than getting one shot at a prompt and a finished draft.* (`REQUIREMENTS.md:27`) | §Row-by-row control inventory (which of the five decisions already have a control and which do not); §D-12 predicate audit (what the gate actually requires); §D-13 wire chain (how a server verdict reaches the surface); §D-05 fence (the shipped baseline that proves the fast door unchanged) |

⚠ **Read `REQUIREMENTS.md:34-60` (the AUTH-03 correction note) before planning.** Its recorded
lesson is the one this phase is most exposed to: *"a requirement that names a solution rather than a
user's goal will be built to literally."* AUTH-02's own wording says **"guided through the decisions
that matter"**, and D-07 fixes what "the decisions that matter" means. The correction's warning is
that a fixed list can be built literally while the goal goes unmet — so the acceptance bar is sketch
174's screen and the G-4 rows below, not the row count.
</phase_requirements>

---

## Summary

This phase is a **composition change on a shipped surface plus one additive backend field**. Almost
everything it needs already exists; the research value is in saying precisely *what* exists, *where*,
and which two of the five rows are genuinely net-new.

Three measurements change the plan's shape and none of them was assumed:

1. **The D-05 characterization baseline ALREADY EXISTS and already predates this phase by four
   phases.** `frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` (670 lines) holds
   **six** whole-`container.innerHTML` captures of the Builder's pre-draft describe screen
   (`flagOn`/`flagOff` × `empty`/`composing`/`error`), captured at `594fdc8d` on the unmoved tree,
   plus `WorkflowDoorSwitch.baseline.test.tsx` for the loose door and `FLAG_OFF_DESCRIBE_MARKUP`
   (Phase 187) for the CTA group. **The plan does not need to author a baseline; it needs to make
   "zero deletions in that file" a mechanical criterion.** That is strictly stronger than a fresh
   capture, because a fresh one would postdate the phase's own context.

2. **Only ONE of D-07's five rows has a server publish predicate.** Measured across the whole
   gauntlet: stage 1 `business_requirement_missing`, stage 2 `lint_workflow` (slugs, indices,
   reachability), stage 2.5 interactive phases, stage 2.6 grounding fidelity (folder ⊆, unregistered
   tools, unregistered skill refs). **Nothing anywhere refuses a publish for a missing KB binding, a
   missing template, a missing/AI-chosen name, or the deliverable.** D-11's claim — *"the rows ARE
   the publish requirements"* — is therefore true of row 3 and of nothing else. This is not a reason
   to change D-11; it is a reason the plan must not invent four server predicates to make D-11 read
   evenly.

3. **Row 5 is far cheaper than the sketch priced it, and row 4 is more expensive than D-15 reads.**
   Row 5 needs **no new store action and no new field** — the terminal `llm_emit` step's
   *Instructions* (`config.prompt`) is already editable through `patchConfig`, and the page already
   exports a `jumpToStep` seam the problems tray uses. Row 4, conversely, needs a **new store
   action** (there is no `setName`) *and* — if it wears the AI mark — a **net-new definition-level
   provenance field**, because `name_seeded_by_ai` is a **`PhaseSpec`** field, not a
   `WorkflowDefinition` one.

**Primary recommendation:** Ship the one-card parent (sketch 174) composing `SeedReceipt`'s output
with a five-row decisions list; give rows 1–4 real controls and row 5 a **jump to the terminal emit
step's Instructions** (option ii below, priced at roughly the same cost as making it display-only);
carry D-13's readiness verdict for **row 3 only**, spelled as a discriminated union that can say *"I
could not read it"*; and land the D-05 assertion (the shipped baseline green, zero deletions) in
**plan 01, before any source edit**.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| The five question sentences | Frontend / vocabulary module | — | D-09: zero provider calls, assertable by character-identity. `doorVocabulary.ts` / `templateFirstVocabulary.ts` are the shipped precedent |
| Per-row **readiness verdict** (is this answered?) | **API / Backend** | — | D-12/D-13/187-24. The predicate lives in `grounding.py`; a client-side derivation is the exact drift D-182-06 forbids |
| Per-row **current answer** (what was chosen) | Frontend (read off the definition) | — | Already in `meta` / `phases`. `requirementIsAiProposed` (`WorkflowBuilderPage.tsx:2140-2143`) is the shipped precedent for reading a definition field with no `useState` mirror |
| Writing an answer | Frontend / `builderStore` → shipped PATCH loop | API (persistence) | D-03. `selectDefinition` (`builderStore.ts:327`) already spreads `meta` into the PATCH body, so a `meta` write needs zero change to the write loop |
| The emit tool's advertised contract | **API / Backend** | — | `WF_SCHEMA = WorkflowDefinition.model_json_schema()` (`workflow_authoring.py:229`). D-14's fence is a backend test |
| Card composition / dismissal | Frontend (page-owned state) | — | D-04, and `SeedReceipt`'s `open` is already caller-owned (`SeedReceiptProps.open`) |
| Publish enforcement | **API / Backend** | — | Untouched by this phase (D-11, 193.2 D-09) |

---

## Standard Stack

**No new packages.** This phase adds no dependency to either half of the product.

### Core (already installed, already used on this exact surface)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | shipped | The surface | The whole Builder |
| Zustand (`builderStore`) | shipped | D-03's write path | `builderStore.ts:379-760`; `zundo` temporal middleware for undo |
| Pydantic v2 | shipped | `WorkflowDefinition` | `backend/app/models/harness.py` — `extra="forbid"` |
| Vitest + Testing Library | shipped | The D-05 baseline and every fence | `WorkflowBuilderPage.preDraft.baseline.test.tsx` |
| pytest | shipped | D-14's fence | `backend/tests/unit/test_workflow_authoring_requirement.py` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new decisions component | Widening `SeedReceipt` | **Refused by D-02**, and measured: its suite enforces *"declares no predicate of its own"* and *"imports nothing from the API client"* with `?raw` source fences and positive controls (`SeedReceipt.tsx:16-18, 38-43`) |
| A new definition-level `name_seeded_by_ai` | Reusing `PhaseSpec.name_seeded_by_ai` | **Not possible** — different model, different level. See `## Contradicts a locked decision` |
| A new `setName` store action | `patchConfig` | `patchConfig` writes a **phase's** config (`builderStore.ts:548-557`); `name` is definition-level `meta` |

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** No `npm install`, no `pip install`.
Verified against the predicted `files_modified` in `197-CONTEXT.md` `<code_context>`: every file is
existing source or a new first-party module. The Package Legitimacy Gate is therefore vacuous here
and is recorded as skipped-with-reason rather than run against an empty set.

---

## Row-by-row control inventory — the measurement the plan is built on

**This is the highest-value table in this document.** For each of D-07's five rows: does a control
exist today, where, and what does answering it call?

| # | Row | Control on the **pre-draft** screen | Control on the **drafted** view | Store write | Server publish predicate |
|---|-----|---|---|---|---|
| 1 | **KB scope** (`project_folder_id`) | ✅ `<select data-testid="project-folder-picker">` — `WorkflowBuilderPage.tsx` describeScreen; the reusable `DescribeKbPicker.tsx` is mounted on the **loose** door (`WorkflowDoorSwitch.tsx:373`) | ✅ **YES** — `kbAffordance`, `WorkflowBuilderPage.tsx:1992-2055`, gated `canvasEnabled`, same `project-folder-picker` testid, 11 px | `setProjectFolder(id)` (`builderStore.ts:620-624`) | ❌ **NONE** (see conditional caveat below) |
| 2 | **Bound template** | ✅ `<DescribeTemplateRow>` (`WorkflowBuilderPage.tsx:1772`, `WorkflowDoorSwitch.tsx:390`) | ✅ **YES, but buried** — `<TemplateAttachSection>` inside the step form panel, gated `pt === "llm_emit"` (`PhaseFormPanel.tsx:1166`) | `setTemplateAsset(asset)` (`builderStore.ts:749-757`) | ❌ **NONE** |
| 3 | **Business requirement** | — (the describe `<textarea aria-label="business requirement">` is a *different* field) | ✅ **YES** — `requirementAffordance`, `WorkflowBuilderPage.tsx:2144-2196`, 11 px input + the `AI-proposed` mark | `setBusinessRequirement(text)` (`builderStore.ts:711-727`) — clears `business_requirement_seeded_by_ai` in the **same `set()`** | ✅ **YES** — `business_requirement_missing` (`grounding.py:1007`), publish stage 1 (`publish_service.py:163-173`) |
| 4 | **Workflow name** | ❌ none | ❌ **NONE — AND NO DISPLAY.** `WorkflowBuilderPage.tsx:2203` renders `{meta.slug ?? "Untitled workflow"}` | ❌ **NO ACTION EXISTS** — there is no `setName` in `BuilderStoreState` (`builderStore.ts:262-306`) | ❌ **NONE** |
| 5 | **Deliverable** | ❌ none | ⚠ **indirectly** — the terminal `llm_emit` step's *Instructions* field (`PhaseFormPanel.tsx:945/973/1017/1068/1104`, `onChange={set("prompt")}`) | `patchConfig(slug, {prompt})` (`builderStore.ts:548-557`) | ❌ **NONE** |

**Caveat on row 1's "NONE":** there *is* one conditional KB rule, and it is a **Pydantic model
validator**, not a gauntlet stage — `WorkflowDefinition._folder_scope_requires_project`
(`backend/app/models/harness.py:584-595`) raises when a phase declares `folder_scope` and
`project_folder_id is None`. It is a 422 at parse, not a publish verdict, and it is **unreachable
from any authoring control today**: `folder_scope` is a read-only display in `PhaseFormPanel` and no
authoring control writes it, pinned by a source assertion in the header suite
(`WorkflowBuilderPage.tsx:2024-2031`, verbatim). So it does not give row 1 a readiness verdict.

**Consequence the plan must absorb:** rows 1, 2 and 3 are *second homes* for shipped controls; rows
4 and 5 are *first appearances*. That is not the same work and should not be estimated as one wave.

---

## ⚠ Contradicts a locked decision

Three measurements contradict text in `197-CONTEXT.md`. None invalidates a decision; each narrows or
re-prices one, and each is stated here rather than planned around.

### C-1 — D-15's *"the provenance shape is already there"* is FALSE at the workflow level

**D-15 says:** *"187 shipped `name_seeded_by_ai` — the provenance shape is already there; whether
the row wears the mark is Claude's discretion."*

**Measured (run this session):**

```
WorkflowDefinition fields:  slug version name status phases project_folder_id
                            output_target_folder reingest_output version_policy
                            provenance inputs assets business_requirement
                            business_requirement_seeded_by_ai category

PhaseSpec has name_seeded_by_ai:            True
WorkflowDefinition has name_seeded_by_ai:   False
```

`name_seeded_by_ai` is declared at `backend/app/models/harness.py:435`, on **`PhaseSpec`** — it marks
that the generator wrote a *step's* name. It is stamped per-phase at
`workflow_authoring.py:464` (`update={"name_seeded_by_ai": bool(p.name and p.name.strip())}`). The
**workflow's** `name` (`WorkflowDefinition.name: str`, required, no default) has no provenance
sibling at all.

**Impact:** "the row wears the mark" is **not** a free discretion call. It costs a net-new
additive-optional `bool = False` on `WorkflowDefinition`, a server-side stamp on the single success
path, a demote-on-edit in the new store action's same `set()`, and the `extra="forbid"`
not-relaxed proof — i.e. the whole of `193.2-07`'s pattern repeated. That pattern is well-trodden
(zero migration, JSONB) but it is **a wave, not a checkbox**.

**Recommendation:** either take it deliberately as its own plan, or decline the mark for row 4 with
the reason recorded (the row's own sentence already says the AI chose the name, so the mark adds a
second claim of the same fact — and D-16 forbids the mark implying quality either way). Do **not**
let the plan inherit D-15's sentence as "already there".

### C-2 — D-06's recorded consequence for `BUG-260809-02` does not exist

`197-CONTEXT.md` `<deferred>` lists `BUG-260809-02` as *"(blocking) — a canvas-built workflow can
never be published … NOT closed by this phase."*

**Measured:** `.planning/reported-bugs/` — the report's frontmatter reads `status: closed`,
`folded_into: quick-260809-klo`. The quick task shipped the very requirement input the sketches
render, and its docblock is in the tree at `WorkflowBuilderPage.tsx:2057-2078` (*"Quick 260809-klo —
THE CONTROL THAT CLOSES BUG-260809-02"*). STATE.md already absorbed this correction (lines 73-77);
CONTEXT.md was not updated. **Restated here so the plan does not re-record a false consequence.**

### C-3 — `BUG-260815-01` is closed, not owed to this phase

Session memory and `SEED-163`'s trail read as though two publish blockers were routed to
197/AUTH-02. **Measured:** `.planning/reported-bugs/template-first-drafts-cannot-be-published.md`
frontmatter — `status: closed`, `folded_into: "193.2"`, `verified_closed_by:` a driven UAT run
(definition `93a86e21`, run `b021c7b0`). Its `re_open_trigger` is a **single sighting** of an
interactive step on a template-first draft, and its uncovered residual is *"the rewritten two-arm
refusal copy has still never been read by a person — UAT row U2 was NOT DRIVEN."* Neither is 197's
work. **No open reported bug carries `folded_into: 197`** (verified by scanning every frontmatter in
`.planning/reported-bugs/`), so the `/gsd:plan-phase` reported-bugs touchpoint has nothing to
cover — record that as a checked-and-empty result, not as an unrun check.

---

## THE TWO SCOPE QUESTIONS — costed answers

### Q1 · Row 5 (the deliverable) — what would make it *answerable*?

**What derives the answer today.** `soulDeliverable(def)`
(`frontend/src/components/workflows/soulData.ts:172-183`):

```ts
export function soulDeliverable(def: DefShape | null | undefined): SoulDeliverable {
  const phases = def?.phases ?? []
  const hasEmit = phases.some((p) => p.config?.phase_type === "llm_emit")
  if (!hasEmit) return { kind: "chat" }
  const name = def?.name?.trim()
  const label = name ? `${name} · file` : "file deliverable"
  return { kind: "file", label }
}
```

⚠ **Two facts the sketch did not state and the plan must know:**

1. **It is not "derived from a terminal `llm_emit`" — it is `phases.some(...)`, order-independent,
   plus the workflow NAME.** So row 5's *label* is literally row 4's answer with `· file` appended.
   Rows 4 and 5 are coupled today; a plan that treats them as independent will produce a row 5 that
   changes when the author edits row 4 and cannot explain why.
2. **`soulDeliverable` is not rendered on the Builder at all.** `WorkflowSoul` (its only consumer,
   `WorkflowSoul.tsx:59`) mounts on `WorkspacePanel.tsx:166`, `library/WorkflowCard.tsx:718`,
   `PublishGauntlet.tsx:657` and `WorkflowDoorSwitch.tsx:451` — **never on
   `WorkflowBuilderPage`** (`grep -rn "<WorkflowSoul" frontend/src` → four mounts, none the
   Builder). Like row 4, row 5 is a **first appearance**, not a second control.

**Does `builderStore`'s write path express "edit a step's field"?** ✅ **YES.**
`patchConfig(slug, patch)` (`builderStore.ts:281`, impl `:548-557`) merges a patch into one step's
config through the pure `patchPhaseConfig` op, bumps `editSeq`, sets `lastEditKind: "config"` and
coalesces into the undo stack. **The claim in `sketch 173/README.md:76-79` — *"D-03's write path
(`builderStore`, one `set()`) does not express as a row edit"* — is REFUTED.** It expresses it
exactly; what it does not express is a *definition-level* name write (that is row 4's gap, not row
5's).

**The three options, priced.**

| Option | What ships | New store action? | New field? | Backend? | Files touched | Verdict |
|---|---|---|---|---|---|---|
| **(i) display-only** | Row 5 states *"A file, at the last step"* (or *"an answer in chat"*), with no control | ❌ none | ❌ none | ❌ none | 2 (the new card + the vocabulary module) | Cheapest, but **breaks the row grammar** — four rows hand you to a control and one does not, which is the *"a fact with no control"* the sketch already flagged as the weak arm |
| **(ii) row 5 jumps to the terminal emit step's *Instructions*** ⭐ | Row 5's action selects the terminal `llm_emit` phase, opening `PhaseFormPanel` on the field that actually decides what is produced | ❌ **none — `jumpToStep` already exists** (`WorkflowBuilderPage.tsx:1570`, already wired as `onJumpToStep` at `:1637` for the problems tray) | ❌ none | ❌ none | 3 (the card, the vocabulary module, one small pure `terminalEmitSlug(def)` derivation beside `soulDeliverable` in `soulData.ts`) | **RECOMMENDED** — same cost class as (i), keeps the grammar, and it is sketch 174's own stated rule: *"Each decision hands you to the control already on the screen — nothing is duplicated."* |
| **(iii) inline edit of the emit `prompt` on the row** | A textarea on the row writing `patchConfig(slug, {prompt})` | ❌ none (uses `patchConfig`) | ❌ none | ❌ none | 3, but **+1 conflict** | **REJECT** — it puts the *Instructions* field in two places at once. The page's own rule, quoted verbatim in the `kbAffordance` docblock (`WorkflowBuilderPage.tsx:2085`): *"A second, different answer to one question is drift."* Also: the emit prompt is a multi-line instruction, not a one-line answer; a row-sized box would truncate the thing it claims to show |

**Is row 5 genuinely larger than rows 1–4?** ❌ **No — measured, it is the SMALLEST.**
- Rows 1, 2, 3 each need the row + a jump/mount to an **existing** control (`setProjectFolder`,
  `setTemplateAsset`, `setBusinessRequirement` all shipped).
- **Row 4 needs a NEW store action** (`setName` — no such action exists, `builderStore.ts:262-306`)
  and, if it carries the AI mark, a **new backend field** (C-1).
- **Row 5 under option (ii) needs neither** — one pure derivation and one call to a shipped seam.

**Recommendation for the operator: option (ii).** It costs approximately what display-only costs,
preserves the five-row grammar, adds no store action, no field and no backend surface, and reuses
the exact seam the problems tray already uses. If the operator prefers a plainer surface, option (i)
is the honest fallback and its cost is one line of vocabulary — but it should be chosen because a
*fact* is the right thing to show, never because option (ii) was believed expensive.

---

### Q2 · Row 4 (the name) — is it the name's FIRST display?

✅ **CONFIRMED, against the real component.** `frontend/src/pages/WorkflowBuilderPage.tsx:2200-2211`:

```tsx
const identityGroup = (
  <>
    <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">
      {meta.slug ?? "Untitled workflow"}
    </span>
    <span className="… text-[11px] …">draft</span>
    {kbAffordance}
    {requirementAffordance}
  </>
)
```

The drafted header's identity slot renders **`meta.slug`**. `grep -n "meta.name" WorkflowBuilderPage.tsx`
returns nothing in a render position. So the workflow's **name is displayed nowhere on the drafted
Builder**, and row 4 is its first display, not a second control.

**Does D-15 (slug untouched) hold cleanly if the row both displays and edits the name?**

⚠ **It holds, but not *cleanly* — and the cost is a visible one the sketch already named.** After
this phase the header would show `northwind-qbr-fa65a43c` while the row shows and edits
`Northwind QBR`. Two strings for one concept, one of them machine-shaped, on the same screen. That
is the *"one screen, two answers to one question"* shape sketch 174's own defect log records
(README, *"the header contradicted the card"*).

**Three ways out, and the measurement that separates them:**

| Option | Cost | Risk |
|---|---|---|
| **(a) Leave the header on the slug; row 4 displays + edits `name`** | zero header change | The visible disagreement above. **Accepted by D-15 in words** (*"Accepted cost: name and slug can disagree"*) but D-15 was written before it was known the name appears *nowhere*, so what it accepted was a latent disagreement, not a rendered one |
| **(b) Header renders `meta.name ?? meta.slug`; row 4 edits `name`** ⭐ | One expression at `:2203` | ⚠ **`WorkflowBuilderPage.header.test.tsx` pins the flag-off `<header>` as literal markup** — `FLAG_OFF_HEADER_MARKUP` band 3 is the `<header>` hosting `identityGroup`, and its own note (`:2181-2184`) says *"a literal that stood unedited for NINE phases before Phase 193 re-captured it twice … and whose own note says the phase expects NO third."* A change at `:2203` is **inside band 3** and forces that third re-capture. **This is the single most likely surprise in the whole phase** and must be priced in the plan, not discovered by a red suite |
| **(c) Row 4 display-only, no edit** | zero | Fails D-15's own instruction (*"THE AUTHOR EDITS THE NAME"*) |

**Recommendation: (b), taken deliberately with the re-capture declared in the plan** — the D-15
decision is that the author edits the name, and a name the author edits which is then invisible
everywhere except the row that edited it is not a satisfied decision. The re-capture follows the
declared procedure the baseline files already establish (see §D-05 below); it is a known,
documented, one-time act, not a hazard. **Price it as its own task.**

⚠ **Whichever is chosen, `slug` is never written.** `setName` must write `meta.name` only.
`WorkflowDefinition.slug` is minted once at generation (`workflow_authoring.py:571` —
`{wd.slug}-{uuid4().hex[:8]}`) and is the key identity, forks and versioning use.

---

## D-12 — the predicate audit (the finding the plan must have BEFORE it is written)

**Question asked:** what exactly does the publish gate check for each of the five rows?

**Answer: ONE of five.** Full stage-by-stage enumeration, read from
`backend/app/services/harness/publish_service.py` (module docstring `:1-60`, body `:87-435`):

| Stage | What it checks | Source | Touches which D-07 row? |
|---|---|---|---|
| 0 | load + owner check (non-owner → `not_found`) | `publish_service.py:106-136` | none |
| — | `WorkflowDefinition` re-validation | `:150-158` | ⚠ only the conditional `_folder_scope_requires_project` (`harness.py:584`), unreachable in practice |
| **1** | **`business_requirement_missing(definition)`** → 400 | `:160-173`, predicate `grounding.py:1007`, message `grounding.py:1000` | ✅ **row 3, and only row 3** |
| 2 | `lint_workflow` — duplicate slugs, non-contiguous `phase_index`, unsatisfiable skips, orphan phases, no terminal | `:175-190`, impl `reachability.py:111-190` | none (purely structural) |
| 2.5 | interactive phases (`llm_human_input` / `on_failure: ask_user`) | `:191-232` | none |
| 2.6 | grounding fidelity — folder ⊆, unregistered tools, unregistered `skill_ref` | `:234-268`, rules `grounding.py:879-941` | none |
| 3 | the real golden run | `:270-345` | none |
| 4 | the judge verdict | `:347-391` | none |
| 5 | flip | `:393-435` | none |

**⚠ D-11's claim is narrower than it reads, and this is the plan-shaping finding.**

> D-11: *"THE ROWS ARE THE PUBLISH REQUIREMENTS. THEY ARE DERIVED FROM THE GAUNTLET'S OWN
> PREDICATES, NOT PICKED BY TASTE."*

Measured: **four of the five rows correspond to no gauntlet predicate whatsoever.** Nothing refuses a
publish because the workflow has no KB binding, no template, an AI-chosen name, or any particular
deliverable. Rows 1, 2, 4 and 5 are *decisions that change the result* — which is exactly what
ROADMAP SC#1 asks for — but they are **not** publish requirements.

**What this does NOT mean.** It is not a reason to re-open D-07 or D-11, and it is not a reason to
invent four new server predicates to make the surface read evenly. Inventing them would be a
publish-gate change, which `197-CONTEXT.md` `<domain>` puts explicitly out of scope (*"the publish
gate is untouched"*, 193.2 D-09).

**What it DOES mean, concretely, for the plan:**

1. **D-13's readiness verdict has exactly one honest row today.** The payload should carry a verdict
   for `business_requirement` and, for the other four, either say nothing or say
   `"not-a-publish-requirement"` — never `"ok"`, which would be the client inferring a green from an
   absence (the `useModelRegistry` lesson, below).
2. **The five rows' copy must not all sound like publish blockers.** The gate's own sentence
   (`BUSINESS_REQUIREMENT_MISSING_MESSAGE`: *"Add the Business requirement — one line saying what
   this workflow must deliver — before publishing."*) is the right register **for row 3 only**.
   Rows 1, 2, 4 and 5 must say *"here is what I chose"*, not *"before publishing"* — otherwise the
   surface makes four false claims about the gate. **This directly constrains D-09's vocabulary
   module and is Claude's-discretion wording bounded by a measured fact.**
3. **Where a per-row readiness verdict WOULD have to be computed, if a future phase wanted four
   more:** `backend/app/services/harness/grounding.py`, beside `business_requirement_missing`
   (`:1007`) in the section its own comment calls *"the shared D-13 publish invariant (Pitfall 4 —
   one source, even trivial)"* (`:986`). That is the one home; a second copy anywhere is the drift
   D-182-06 forbids by name. **Not this phase's work.**

---

## D-13 — widening `POST /workflows/generate`, additively

### The exact current response type, both sides

**Backend.** `backend/app/api/workflows.py:1596-1630`. ⚠ **The route declares NO
`response_model`** — `@router.post("/generate", dependencies=[…])` and the body is
`return result`, the service dict passed straight through. So **there is no FastAPI response schema
to widen.** The shape is owned entirely by
`workflow_authoring.generate_workflow_definition` (`workflow_authoring.py:323`), whose success return
is one line:

```python
# backend/app/services/workflow_authoring.py:572
return {"ok": True, "definition": wd.model_dump(mode="json")}
```

Failure returns are `{"ok": False, "error": <code>, "detail": …}` at `:351`, `:358`, `:375`, `:430`.

**Frontend.** `frontend/src/lib/api.ts:3432-3434`:

```ts
export type GenerateResult =
  | { ok: true; definition: WorkflowDefinitionJSON }
  | { ok: false; error: string; detail?: string }
```

Client function `generateWorkflow` at `api.ts:4133-4147`; it throws only on a real HTTP error and
casts the body (`:4146`).

### Where the field must be threaded — the full chain, with line numbers

| Hop | File:line | What changes |
|---|---|---|
| 1 | `workflow_authoring.py:572` | Add the key to the success dict |
| 2 | `api/workflows.py:1620-1630` | **Nothing** — the route passes the dict through untouched |
| 3 | `api.ts:3432-3434` | Add `readiness?: …` to the `ok: true` arm |
| 4 | `useTemplateFirstDraft.ts:504-542` | ⚠ **The real work.** `result.definition` is destructured at `:535` and only the definition reaches `onDrafted` at `:542`. The new field must be carried past that boundary |
| 5 | `useTemplateFirstDraft.ts:321` | `onDrafted: (definition: TemplateFirstDefinition) => void` — the callback signature must widen (second arg, or a payload object) |
| 6 | `WorkflowBuilderPage.tsx:809-812` | `onDrafted: (def) => { setShowReceipt(true); setReceiptPhases(def.phases) }` — add the readiness to page state, **beside `receiptPhases`, under the same snapshot discipline** |
| 7 | the new card | Consumes it as a prop |

⚠ **Hop 6 inherits `SeedReceiptProps.phases`'s snapshot contract verbatim.** That docblock
(`SeedReceipt.tsx:147-172`) is explicit: the prop is *"an immutable SNAPSHOT of one `POST /generate`
result, NEVER a live store selector"*, because every sentence the card renders is past-tense and
first-person. **The readiness verdict is the same class of value** — it describes what the server
said about *the generation*, not about the author's later edits. Hand it a live selector and the
card starts narrating the author's acts in the AI's voice, which is CR-01's shape for the fourth
time. Capture it beside `receiptPhases`, replaced on every generation.

⚠ **But rows 1–4 render the CURRENT answer, which IS live.** These are two different values and the
plan must keep them apart: *"what the server said at generation time"* (snapshot) versus *"what the
definition says now"* (live, read off `meta`, no `useState` mirror — the shipped
`requirementIsAiProposed` idiom at `WorkflowBuilderPage.tsx:2140-2143`). Conflating them is the
single most likely correctness bug in this phase.

### The absent-field rule — the shipped precedent and how it applies

⚠ **D-13's requirement: an ABSENT field must NEVER render as "everything is fine".**

**The precedent named in CONTEXT is `useModelRegistry`** — *a failed read is `status: "failed"`,
never an empty success*. `frontend/src/hooks/useModelRegistry.ts` (109 lines, Phase 196) models the
read as a **discriminated union with an explicit failure arm**, and 196's own close recorded the
consequence of *not* having one: `ModelField` **cannot express "I couldn't read the registry"**, so
on a `loading`/`unavailable` read the whole AI-model field is **absent from the form** — a product
decision STATE.md flags as *"awaiting the operator"* (`STATE.md:326-328`, `:362-365`).

**Corroborating precedent, and the stronger one:** `templateAdmission`
(`soulData.ts:243-260`) — **three states are load-bearing**, `"admits" | "does-not-admit" |
"unknown"`, and its docblock says explicitly that `soulDeliverable`'s collapse of `null` and
`{phases: []}` into one answer *"would be a D-20 violation here."* Two call sites fall back
**opposite ways** on `unknown`, deliberately.

**How it applies here — the concrete shape to build:**

```
readiness?: {                        // ABSENT = the server said nothing
  business_requirement: "missing" | "present"
  // …and NOTHING for rows 1/2/4/5 today (see the D-12 audit)
}
```

with a **client union that has three arms, not two**:

- field absent → **`"unknown"`** → the row renders its answer and **no verdict mark at all**
- field present, `"missing"` → the row renders the gate's own sentence
- field present, `"present"` → the row renders quietly / nothing

⚠ **The failure mode to fence:** a `readiness?: { … } = {}` default, or a
`readiness?.business_requirement === "missing"` read whose `false` branch renders a green tick.
Both turn *"the server did not say"* into *"the server said yes"*. A RED-first test that ships the
field absent and asserts **no positive verdict anywhere in the container** is the cheap proof.

---

## D-05 — the fence, in its falsifiable form (and the finding that changes the plan)

### ✅ The baseline ALREADY EXISTS and ALREADY PREDATES this phase

**File:** `frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` — **670 lines.**

**Mechanism, quoted from its own source:**

- `WorkflowBuilderPage.preDraft.baseline.test.tsx:255-257` —
  > *"The whole `container.innerHTML` is read, never a subtree: the screen ROOT's own attributes are
  > part of what the extraction must not change, and a subtree read would be blind to them."*
- The single shared helper `async function capture(row: CaptureRow)` (`:264-284`): one
  render → drive → settle → read `rendered.container.innerHTML` (`:282`) → unmount. Its own note
  (`:252-254`): *"A second helper is exactly how a capture and the assertion that guards it drift
  apart."*
- **Six states**, keyed identically on both sides (`ROWS` `:346-353`, `BASELINE` `:365-372`):
  `flagOff:empty` · `flagOff:composing` · `flagOff:error` · `flagOn:empty` · `flagOn:composing` ·
  `flagOn:error`. ⚠ *"SIX, NOT ONE, AND THE SECOND DIMENSION IS THE LOAD-BEARING ONE"* (`:340`) —
  the `canvasEnabled` flag changes what the screen renders.
- The assertion loop (`:396-403`) is `expect(await capture(ROWS[row])).toBe(BASELINE[row])`, guarded
  by a non-vacuity check `expect(BASELINE[row].length).toBeGreaterThan(0)` first.
- **Marker rows** (`:411-424`) assert each capture *contains* `describe-hint`,
  `aria-label="business requirement"`, `project-folder-picker` and both fixture folder names — so a
  state that quietly rendered nothing is a red, not a pass.
- The predate proof is **recorded verbatim in the docblock** (`:19-31`): `git rev-parse HEAD` →
  `5333518b2c969294fc0fce93b9549e30189531ff`, plus two `git show HEAD:<path>` calls returning
  `fatal: … does not exist in 'HEAD'` for the modules the later waves created.

**Two siblings that also predate:**
- `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` — the **loose/fast door's**
  describe screen (193-01). ⚠ There are **TWO near-identical pre-draft screens** and both contain the
  literal splice anchor `<div className="flex flex-col items-center gap-3">`
  (`WorkflowDoorSwitch.tsx:300`, `WorkflowBuilderPage.tsx:1579`) — *"a plan that assumes one is the
  other lands the feature on half the product"* (`preDraft.baseline.test.tsx:39-51`).
- `FLAG_OFF_DESCRIBE_MARKUP` at `WorkflowBuilderPage.describe.test.tsx:307` — the CTA group alone,
  captured in **Phase 187 wave 1**, six phases before 193.1.

### The rule the baseline itself states, and the criterion to lift from it

`preDraft.baseline.test.tsx:60-67`:

> *"a diff against these strings is a BEHAVIOUR CHANGE TO EXPLAIN, never a test to update.
> Re-capturing them to make a red run green deletes the only evidence anybody has that the pre-draft
> screen still renders what it rendered. `git diff --numstat` on this file must show ZERO DELETIONS
> through the extraction wave; the first wave that intentionally changes a rendered node re-captures
> ONCE, DECLARED in its own plan with a date and a reason, never quietly absorbed."*

**Measured history of that file** (`git log --numstat`):

| commit | ins | del | what |
|---|---|---|---|
| `594fdc8d` (193.1-01) | 438 | 0 | the capture, on the unmoved tree |
| `517ad56d` (193.1-01) | 61 | 0 | the `/generate` key-set pin |
| `02606a08` (193.1-07) | 120 | 0 | the wire + bind |
| `0a2742a3` (193.1-08) | 54 | **6** | **a DECLARED re-capture** |
| `f434d43c` (196-08) | 3 | 0 | additive |

So `del > 0` has happened exactly once, deliberately, with a plan declaring it. **That is the
criterion.**

### ⚠ What the plan must do, and WHEN

**Plan 01 — before any source edit — must:**

1. Run the three shipped baseline suites at the phase base commit and record the verdict verbatim:
   ```bash
   cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run \
     src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
     src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
     src/pages/WorkflowBuilderPage.describe.test.tsx
   ```
2. Record the base SHA and the file's numstat baseline.
3. **Declare the mechanical D-05 criterion**, checked at every wave merge and at phase close:
   ```bash
   git diff --numstat <phase-base-sha> HEAD -- \
     frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
     frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
   # the DELETIONS column must be 0 on both rows
   ```

**Do NOT author a new pre-draft baseline.** A capture taken now postdates `197-CONTEXT.md` and
proves the phase against itself; the shipped one predates by four phases and is strictly stronger.
Authoring a second would also create the exact *"a capture and the assertion that guards it drift
apart"* condition the file's own docblock names.

**⚠ The one thing this fence does NOT cover, stated rather than left implied:** it pins the
pre-draft screen. It says nothing about the **drafted** header, whose byte pin lives in
`WorkflowBuilderPage.header.test.tsx` (`FLAG_OFF_HEADER_MARKUP`) and which option (b) of Q2 above
deliberately re-captures. **These are two different literals with two different dispositions in this
phase — zero deletions on one, a declared re-capture on the other — and a plan that conflates them
will either block itself or waive the wrong one.**

---

## D-14 — the mechanical fence against a fourth D-22 instance

### What the fence should read, and against what — MEASURED

**The advertised contract** is `WF_SCHEMA` (`workflow_authoring.py:229`):

```python
WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))
EMIT_TOOL = {"type": "function", "function": {"name": "emit_workflow_definition",
             "description": "…", "parameters": WF_SCHEMA}}   # :232-239
```

**Measured this session** — the 15 top-level properties the emit tool advertises, against whether
`AUTHORING_SYSTEM_PROMPT` (3293 chars) names them:

| property | named in prompt |
|---|---|
| `slug` | ✅ |
| `version` | ✅ |
| `name` | ✅ |
| `status` | ✅ |
| `phases` | ✅ |
| `project_folder_id` | ✅ |
| `business_requirement` | ✅ (0 → 5 hits at 193.2-05 — *the whole of SEED-163 in one number*) |
| `output_target_folder` | ❌ |
| `reingest_output` | ❌ |
| `version_policy` | ❌ |
| `provenance` | ❌ |
| `inputs` | ❌ |
| `assets` | ❌ |
| `business_requirement_seeded_by_ai` | ❌ |
| `category` | ❌ |

**7 asked, 8 not.** So a naive fence *"every advertised field must be asked for"* fails on **eight**
fields today — most of which are correctly not asked (`business_requirement_seeded_by_ai` is
**deliberately** ignored from the model in both directions and stamped server-side after validation,
`workflow_authoring.py:552-561`; `category` is a starter-fork round-trip field, `harness.py:575-581`).

### The concrete, checkable form

**Home:** `backend/tests/unit/test_workflow_authoring_requirement.py` — it already exists and is
already the right file. Its docblock states the assertion philosophy this fence must inherit
(`:1-40`): *"asserts ONLY DETERMINISTIC properties: properties of a string constant, of the JSON
schema, and of the service's control flow"* and *"a reword must not turn this file red; a lost
CONTRACT must."*

**The fence, in two halves:**

**Half A — the emit contract.** A frozen `ADVERTISED_BUT_NOT_ASKED` allowlist, one entry per field,
**each carrying its reason in the literal** (the shipped `ADMISSION_CASES` idiom). The test:
`set(WF_SCHEMA["properties"]) - fields_named_in(AUTHORING_SYSTEM_PROMPT) == ADVERTISED_BUT_NOT_ASKED`.
A new field added to `WorkflowDefinition` and not consciously routed turns it **red on the commit
that adds it**, which is exactly the D-22 shape. A field *removed* from the allowlist without being
asked for also reds — so the allowlist cannot be quietly grown to silence the test without a reason
string being written.

**Half B — the request contract, and this is where the LIVE fourth instance is.**
`GenerateRequest` (`api/workflows.py:1583-1590`) declares four fields:

```python
describe: str
project_folder_id: UUID | None = None
template_asset_id: UUID | None = None
template_placeholders: list[str] | None = None
```

**Measured:** `grep -rn "template_asset_id" frontend/src --include=*.ts --include=*.tsx` (excluding
tests) returns **two hits, neither a send**: `api.ts:3440` (the type declaration on
`GenerateWorkflowBody`) and `api.ts:3956` (a *query string* on a different route). The only
production `/generate` call site — `useTemplateFirstDraft.ts:504-527` — sends `describe`,
`project_folder_id` (conditionally) and `template_placeholders` (conditionally). **`template_asset_id`
is accepted by the server and has never once been sent.**

⚠ **THIS IS A LIVE, CURRENTLY-UNCLOSED FOURTH D-22 INSTANCE.** It is `SEED-157`'s instance 1 half-
closed: 193.1-07 wired `template_placeholders`; `template_asset_id` was left, and `SEED-157` records
why (*"typed `UUID | None`, while the Phase-193 upload door mints a Storage path … Passing a real
asset id is a 422 before the handler runs. So that channel is unwirable as typed"*).

### ⚠ The positive control — and it is REAL, not planted

**The intentionally-failing case that proves the fence can fire is already in the tree.** Half B's
assertion — *every field of `GenerateRequest` is either sent by the one production call site or
listed in an `ACCEPTED_BUT_NEVER_SENT` allowlist with a reason* — **fails today on
`template_asset_id`** until that reason is written.

This is materially better than a planted literal, and the plan should say so: a fence whose positive
control is a synthetic plant has only ever been exercised against something the author invented; a
fence that turns red on a real, independently-recorded defect on its very first run has been
exercised against the wild. Recommended shape: land the fence RED (naming `template_asset_id`), then
add the allowlist entry citing `SEED-157`'s measured reason **in the same plan**, so the green state
carries the explanation rather than the silence.

⚠ **Also add a synthetic positive control anyway**, per the standing rule (192.1; SC#3 in 196): a
case that adds a fake field to a copy of the schema dict and asserts the checker reports it. The real
one proves it fires on a live defect; the synthetic one proves it keeps firing after the live defect
is allowlisted.

⚠ **The 187-24 prose trap, which hit four times in `196-08` including inside the comment written to
explain the first three:** these fences `grep` a raw source. **Build every needle at runtime or name
it by role.** Do not spell `template_asset_id` in a docstring that the same test greps for.

---

## D-03 — the write path, action by action

`builderStore.ts` — the exact signatures an answered row calls:

| Row | Action | Signature | Line | Notes |
|---|---|---|---|---|
| 1 | `setProjectFolder` | `(id: string \| null) => void` | decl `:293`, impl `:620-624` | `set({ meta: {...s.meta, project_folder_id: id}, dirty: true })`. Untracked; arms `dirty` itself |
| 2 | `setTemplateAsset` | `(asset: TemplateAssetDescriptor) => void` | decl `:301`, impl `:749-757` | **Replaces** the single `kind === "template"` entry and preserves every other asset — appending blindly leaves two entries with `.find` picking the older |
| 3 | `setBusinessRequirement` | `(text: string) => void` | decl `:297`, impl `:711-727` | ⭐ **the 193.2 move to copy** |
| 4 | ❌ **none exists** | would be `setName(name: string) => void` | — | See C-1 and Q2 |
| 5 | `patchConfig` | `(slug: string, patch: Readonly<Record<string, unknown>>) => void` | decl `:281`, impl `:548-557` | Structural-safe: two guards, delegates to the pure `patchPhaseConfig`, bumps `editSeq`, coalesces |

### The 193.2 move, verbatim — the shape row 4's new action must copy

`builderStore.ts:711-727`:

```ts
setBusinessRequirement: (text) => {
  const s = get()
  if (s.builderPhase !== "drafted") return
  set({
    meta: {
      ...s.meta,
      business_requirement: text,
      // ONE `set()`: the text and its provenance move together, so no ordering
      // between two writes can exist for a later reader to get wrong.
      business_requirement_seeded_by_ai: false,
    },
    dirty: true,
  })
},
```

**The five properties a `setName` must inherit, each with the docblock's own reason
(`builderStore.ts:631-710`):**

1. **The `builderPhase !== "drafted"` bail** — *"the shipped guard shape every document-scoped action
   carries, keeping the write out of the composing beat where `meta` is deliberately empty."*
2. **`dirty: true` in the same `set()`** — the store's subscription arms `dirty` on a change to the
   **`phases`** reference and on nothing else, so a `meta`-only write would be *"a genuine definition
   change the leave guard never noticed."*
3. **Untracked** — `partialize` narrows the undo stack to `phases`; *"an undo restores STEPS, never
   the workflow's identity."* Field-level `⌘Z` still works inside the input because the page's
   listener yields on `INPUT`/`TEXTAREA` (`WorkflowBuilderPage.tsx:742-744`).
4. **Provenance demoted in the SAME `set()`, with NO client-side comparison** — *"Comparing the new
   text against the seeded value, diffing it, or debouncing the decision would be exactly the second
   copy of a server predicate D-182-06 forbids by name … Provenance is decided in ONE place; this
   action only ever RETIRES it."*
5. **No trim, no empty-check** — *"The server owns the emptiness rule … a client that trimmed or
   nulled here would be a second copy of a server predicate."*

⚠ **`false` vs `delete` is NOT interchangeable and the reason is measured** (`:657-668`):
`definitionOps.patchPhaseConfig` **deletes** `name_seeded_by_ai` (`definitionOps.ts:313-316`) because
`PhaseSpec.name` / `name_seeded_by_ai` are OPTIONAL keys where absence is the only honest spelling;
`setBusinessRequirement` writes **`false`** because `WorkflowDefinition` DECLARES the field
`bool = False` with no `| None`. **If row 4 gains a definition-level provenance flag, it takes the
`false` arm** (declared, non-optional) — not `delete`, and never `undefined` (`extra="forbid"`).

### Typing note the plan will hit

`BuilderDefinition` (`WorkflowBuilderPage.tsx:540-548`) declares `slug`, `version`, `status`,
`business_requirement`, `project_folder_id`, `phases` and then `[k: string]: unknown`. **`name` is
NOT declared** — it lands under the index signature, so `meta.name` types as `unknown`.
`DefinitionMeta` is a key-remapped mapped type over `BuilderDefinition` (`builderStore.ts:178-180`),
spelled that way deliberately because `Omit` collapses an index-signature type to `{}`. So a `setName`
either narrows with `typeof meta.name === "string"` at the read site (the shipped
`requirementIsAiProposed` idiom, `WorkflowBuilderPage.tsx:2140-2143`) or declares `name?: string` on
`BuilderDefinition`. **Prefer declaring it** — it is a real field of the real model
(`WorkflowDefinition.name: str`, required) and the index signature is a fallback, not a design.

---

## Rows 1 and 2 — are the shipped controls actually mountable in the new context?

### `DescribeKbPicker.tsx` (194 lines) — ✅ trivially mountable

```ts
export interface DescribeKbPickerProps {
  value: string        // "" for none. The PARENT owns this
  onChange: (id: string) => void
  className?: string   // placement only
}
```

Fully controlled, zero pre-draft assumptions, holds no copy of `value`. **Currently mounted on ONE
surface only** — `WorkflowDoorSwitch.tsx:373` (the loose door). ⚠ **Not the Builder's own describe
screen**, which renders its own inline `<select data-testid="project-folder-picker">` (verbatim in
the baseline capture, `preDraft.baseline.test.tsx:366`). So the "one component, two mounts" rule is
aspirational for this one — the Builder already carries a **third, hand-rolled** answer.

### `DescribeTemplateRow.tsx` (276 lines) — ⚠ mountable, but its data source is the problem

```ts
export interface DescribeTemplateRowProps {
  state: TemplatePlaceholdersState   // the same union the rail's hook returns
  filename?: string
  onPickFile: (file: File) => void
  onClear: () => void
}
```

Presentational, owns no fetch. **But its `state` comes from `useTemplateFirstDraft`'s
`templateRead`, which is a *pre-draft* reading**, and its docblock records why the drafted-view
sibling could not be reused pre-draft:

> `DescribeTemplateRow.tsx:14-18` — *"`TemplateAttachSection.tsx` renders this same reading on the
> deliverable step's rail, and reusing it here was measured IMPOSSIBLE rather than merely awkward:
> it consults the server itself, keyed on a saved definition id AND a stored asset id, and NEITHER
> EXISTS BEFORE A DRAFT DOES."*

⚠ **That argument runs the other way too, and the plan must not miss it.** On a **fresh** generated
draft there is also **no saved definition id yet** (`draftId` is `null` until the first PATCH —
`WorkflowBuilderPage.tsx:810`, `onDraftStarted` sets `setDraftId(null)`). So `TemplateAttachSection`
may be equally unusable at the arrival moment, and `DescribeTemplateRow` needs a `state` nobody is
producing on the drafted view.

**Recommendation for row 2: do NOT mount either component in the card.** Row 2 should **state the
bound template's filename** — already read at `WorkflowBuilderPage.tsx:667` off
`assets.find(kind === "template")?.filename` — and, if it offers an action, **jump to the terminal
`llm_emit` step**, where `TemplateAttachSection` is already mounted (`PhaseFormPanel.tsx:1166`) and
already owns its own read. Same seam as row 5's option (ii). **This makes rows 2 and 5 one
mechanism, which is a simplification the plan should take deliberately.**

### ⚠ The drift question: how do a row and the 11 px header strip avoid being two answers?

The page's rule, verbatim (`WorkflowBuilderPage.tsx:2085`):

> *"A second, different answer to one question is drift."*

Read in context (`:2076-2090`) it is the argument for **promoting the KB chip into a control in this
exact group under this exact gate** — i.e. it forbids *a second different answer*, not *a second
render of the same one*. The header strip and a decisions row are already in the shipped tree in that
relationship: `kbAffordance` and the pre-draft `project-folder-picker` are the **same select, the
same `data-testid`, over the same `folderOptions`**, described by their own docblock as *"ONE
CONTROL, TWO MOUNT POINTS"* (`:2113-2117`).

**Three ways to stay on the safe side of that rule, and the measured argument for each:**

| Approach | Verdict |
|---|---|
| The row **renders the same component instance** the header does | ✅ Safe — literally one answer. Costs a shared-props extraction from a **G-5-firing 2398-line page** |
| The row **displays** the current answer and **jumps** to the header control | ✅ **RECOMMENDED** — sketch 174's own rule (*"Each decision hands you to the control already on the screen — nothing is duplicated"*), and 174's proposal already lights up `project-folder-picker` / `business-requirement-input` when *Change* is pressed. **One writer, one answer, one render.** ⚠ Needs a focus/scroll seam the page does not have yet for the header (it has `jumpToStep` for steps only) |
| The row **owns its own control** writing the same store action | ⚠ Risky — two rendered controls for one field. The store keeps them consistent (both read `meta`, no local mirror), so it is *a second render*, not *a second answer* — but it is exactly the shape sketch 174 shipped as a defect (*"the header contradicted the card"*, its README) and it doubles the surface a future edit must keep in step |

⚠ **The sketch's defect is instructive and the plan should carry the lesson, not just the verdict:**
174's header and card disagreed because React sets a `<select>`'s value as a **DOM property**, lost
on serialisation. In the real app both read `meta`, so that specific bug cannot recur — but the
*class* (one screen, two answers to one question, on the sketch whose whole subject is that a
decision has one answer) is precisely what row 1 risks.

⚠ **A note about the 11 px controls that the plan should surface to the operator.** Both header
affordances render at `text-[11px]` (`:2007`/`:2147`) and the requirement input is
`w-[240px] truncate`. STATE.md records that 193.2-09's mark shipped with **no browser UAT** and the
sliver is still owed (`SEED-163` close-out: *"the contrast of `text-[9px]` against Deep Midnight, and
whether 'AI-proposed' reads right beside a real sentence, are operator judgements nobody has made"*).
**If the plan routes rows 1 and 3 to those controls, it inherits an unjudged legibility question** —
which is a legitimate G-4 UAT row (U5 below), not a blocker.

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────────────────────┐
   author types a        │ PRE-DRAFT DESCRIBE SCREEN                │
   description  ────────▶│ WorkflowBuilderPage.tsx describeScreen    │
                         │ (govern door) │ WorkflowDoorSwitch (loose)│
                         │  ⛔ D-05 RED LINE — BYTE-UNCHANGED         │
                         │  fenced by preDraft.baseline.test.tsx     │
                         │  + WorkflowDoorSwitch.baseline.test.tsx   │
                         └───────────────┬──────────────────────────┘
                                         │ CTA
                                         ▼
                    useTemplateFirstDraft.ts:504  generateWorkflow({describe,
                                         │         project_folder_id?, template_placeholders?})
                                         ▼
                    api.ts:4133  POST /workflows/generate
                                         ▼
                    api/workflows.py:1599  (delegation only, NO response_model)
                                         ▼
                    workflow_authoring.py:323  ONE provider call, forced emit
                      ├─ EMIT_TOOL / WF_SCHEMA  ◀── D-14 FENCE READS HERE
                      ├─ server-stamps business_requirement_seeded_by_ai (:552)
                      ├─ mints a unique slug (:571)
                      └─ [D-13 ▸ NEW] readiness verdict, from grounding.py's
                                       business_requirement_missing (:1007)
                                         │
                    :572  return {ok, definition, readiness?}
                                         ▼
   ┌──────────── useTemplateFirstDraft.ts:535-542 ──────────────┐
   │  store.setDrafted(def)        ── the SINGLE transition      │
   │  onDrafted(def, readiness?)   ── ⚠ signature widens (:321)  │
   └───────────────────────┬────────────────────────────────────┘
                           ▼
   WorkflowBuilderPage.tsx:809  setShowReceipt / setReceiptPhases / [NEW] setReadiness
                           │              (SNAPSHOT discipline — SeedReceipt.tsx:147-172)
                           ▼
   ┌───── graphColumn  grid-rows-[auto auto minmax(0,1fr)]  [&>*:last-child]:row-start-3 ─────┐
   │  child 1  view toggle (:1896)                                                            │
   │  child 2  ▸ NEW PARENT ── ONE CARD ────────────────────────────────────────────────┐    │
   │            │  heading + "3 steps must prove their sources" ▸ <SeedReceipt/> UNCHANGED│    │
   │            │  "5 decisions I made for you"           ▸ <DecisionsList/>  NEW        │    │
   │            │     row 1 KB    → setProjectFolder      / jump to header picker        │    │
   │            │     row 2 tmpl  → jump to terminal emit step (TemplateAttachSection)   │    │
   │            │     row 3 req   → setBusinessRequirement / jump to header input        │    │
   │            │     row 4 name  → setName  ⚠ NEW ACTION                                │    │
   │            │     row 5 deliv → jumpToStep(terminalEmitSlug)  ⚠ NO new action        │    │
   │            │  closing line (SEED_RECEIPT_NOTHING_COMMITTED)                          │    │
   │            └──────────────────────────────────────────────────────────────────────┘    │
   │  child 3  graphChild  ◀── ⚠ A FOURTH CHILD STRANDS THIS (last-child pin)               │
   └────────────────────────────────────────────────────────────────────────────────────────┘
                           │ every write
                           ▼
   builderStore  ─▶ selectDefinition (:327 spreads meta) ─▶ useDraftPersistence ─▶ PATCH
                                                                          (unchanged loop)
```

### Recommended structure (new files only — the G-5 "honoured by construction" argument)

```
frontend/src/components/workflows/
├── DraftArrivalCard.tsx        # NEW — the PARENT. Composes <SeedReceipt/> + <DecisionsList/>
│                               #       into one visual card. Owns NO sentence, NO predicate.
├── DecisionsList.tsx           # NEW — the five rows. Reads answers off the definition,
│                               #       reads verdicts off the D-13 snapshot, calls store
│                               #       actions / the jump seams. Authors NO sentence.
├── decisionsVocabulary.ts      # NEW (or an extension of templateFirstVocabulary.ts — D-10)
└── soulData.ts                 # +1 pure export: terminalEmitSlug(def) — beside soulDeliverable
```

⚠ **`SeedReceipt.tsx` is NOT edited.** Its `open` prop is already caller-owned and it already
renders `null` on `open === false` with no hidden DOM (`SeedReceipt.tsx:113-118`). If the parent
needs the receipt's content inside a fold, the parent controls `open`; if it needs the receipt's
count for its own summary line, it derives that from the same `phases` prop it already holds. **Both
are compositions, not charter widenings.**

### Pattern 1 — the parent keeps the graph child count at THREE

**What:** `graphColumn` is a 3-row grid with `[&>*:last-child]:row-start-3`
(`WorkflowBuilderPage.tsx:1891`). Children today: view toggle → `SeedReceipt` → `graphChild`.

**Why it matters:** with four children, child 3 auto-places into row 3 *and* child 4 is forced there
by `last-child` — both land on the graph's `minmax(0,1fr)` row and the graph collapses. That is
exactly sketch 172's measured *"a fourth child in the graph column STRANDS the graph (collapses to
0 px)"* (`STATE.md:64-66`), and it is now confirmed structurally from the class list rather than from
the sketch.

**Consequence:** the one-card shape is not merely a design preference — **it is what keeps the layout
valid**. A plan that ships two sibling cards must also change the grid, which is an edit to line
1891 of a 2398-line G-5-firing page.

### Pattern 2 — snapshot vs live, kept apart

**What:** the card renders two kinds of value.
**When:** always.
```
SNAPSHOT (frozen at generation, replaced per generation):
  receiptPhases          — already shipped, WorkflowBuilderPage.tsx:811
  readiness              — D-13's new field, captured beside it
LIVE (read off the definition on every render, no useState mirror):
  meta.project_folder_id · meta.assets · meta.business_requirement ·
  meta.business_requirement_seeded_by_ai · meta.name
```
**Source:** `SeedReceipt.tsx:147-172` (the snapshot contract and why) +
`WorkflowBuilderPage.tsx:2110-2143` (the live-read idiom and why no mirror).

### Anti-Patterns to Avoid

- **Deriving a readiness verdict client-side.** Directly against 187-24 and D-13. The client
  intersects and renders; the server defines.
- **A `readiness ?? {}` default, or a two-arm boolean read.** Turns "the server did not say" into
  "the server said yes". Three arms, always.
- **A row whose copy says *"before publishing"* for rows 1/2/4/5.** Measured false — no gauntlet
  stage refuses on any of them.
- **Writing `slug` from row 4.** D-15.
- **A second copy of `soulDeliverable`'s emit test.** `soulData.ts:236-240` already refuses this by
  name: *"Nothing here re-implements a derivation `soulDeliverable` or `tierForDefinition` already
  owns."*
- **Widening `SeedReceipt`'s props to carry a decision.** D-02; and its suite's `?raw` fences will
  fail on an API-client import in any form, *including a type-only one and including prose*
  (`builderStore.ts:186-194` records the same trap firing on a docblock).
- **Spelling a fenced identifier in a docstring the same test greps.** Hit four times in `196-08`,
  including inside the comment written to explain the first three.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| "Is the requirement missing?" | A client-side `!text.trim()` | The server's verdict off D-13, sourced from `grounding.py:1007` | 187-24; and `setBusinessRequirement`'s docblock forbids a client emptiness rule **by name** (`builderStore.ts:706-710`) |
| "Which step produces the file?" | A new emit scan | One pure export beside `soulDeliverable` in `soulData.ts` | `soulData.ts:236-240` forbids a second derivation explicitly |
| Selecting a step from a row | New selection state | `jumpToStep` (`WorkflowBuilderPage.tsx:1570`), already wired as `onJumpToStep` (`:1637`) | *"the D-183-05 contract's one callback, not a second way to open the panel"* |
| Grounding cause per step | A KB-tool table | `groundingCauseOf` / `intersectingKbToolOf` in `phaseVocabulary.ts` | The predicate was MOVED there at 187-24, with a source fence + positive control |
| Attaching a template | A new upload control | `TemplateAttachSection` at `PhaseFormPanel.tsx:1166` | It owns its own server read; the pre-draft sibling exists only because that read is impossible pre-draft |
| Naming a fork | `ForkNameDialog.tsx` | An inline field | **D-17** — a different moment, and a modal on a screen that just gained a card |
| User-visible sentences | Strings in the component | A vocabulary module | D-09; *"a sentence that lives inside a component is a sentence nobody can test for drift"* (`SeedReceipt.tsx:14-15`) |

**Key insight:** on this surface every custom solution has a shipped, fenced owner, and the fences
are **source-level greps with positive controls**. A hand-rolled duplicate does not merely duplicate —
it turns an existing suite red, usually in a file the plan did not expect to touch.

---

## Common Pitfalls

### Pitfall 1 — Re-capturing a byte-identity literal to make a red run green
**What goes wrong:** a plan edits `identityGroup` (Q2 option b), `WorkflowBuilderPage.header.test.tsx`
reds on `FLAG_OFF_HEADER_MARKUP`, and the executor updates the literal.
**Why:** the failure looks like a stale fixture.
**How to avoid:** the baseline files' own rule — *"a diff against these strings is a BEHAVIOUR CHANGE
TO EXPLAIN, never a test to update"*. **Declare the re-capture in the plan, with a date and a
reason.** ⚠ Band 3's own note says the phase that wrote it *"expects NO third"* re-capture
(`WorkflowBuilderPage.tsx:2181-2184`) — this phase would be the third. Say so.
**Warning sign:** a plan task whose action is *"update the header markup pin"*.

### Pitfall 2 — Landing a fourth child in `graphColumn`
**What goes wrong:** the graph silently collapses to 0 px.
**Why:** `[&>*:last-child]:row-start-3` over a 3-row grid.
**How to avoid:** ONE parent; assert the child count of the `graphColumn` div.
**Warning sign:** a JSX diff adding a sibling next to `<SeedReceipt`.

### Pitfall 3 — Treating the readiness field as live state
**What goes wrong:** the card's past-tense first-person sentences start narrating the author's edits.
**Why:** it is passed as a store selector instead of captured at `onDrafted`.
**How to avoid:** capture beside `receiptPhases`; `SeedReceipt`'s fences live in
`WorkflowBuilderPage.canvas.test.tsx` (three real post-arrival edits) — copy that test shape.
**Warning sign:** `useBuilderStore(s => s.readiness)`.

### Pitfall 4 — Assuming `name_seeded_by_ai` exists at the workflow level
**What goes wrong:** a plan writes `meta.name_seeded_by_ai` and it silently lands in the JSONB index
signature on the client, then **422s on the server** (`extra="forbid"`).
**Why:** C-1 — it is a `PhaseSpec` field.
**How to avoid:** if the mark is wanted, add the field with 193.2-07's full pattern.
**Warning sign:** a task that says "reuse the shipped provenance flag" without a model change.

### Pitfall 5 — A vitest gate red read as a flake
**What goes wrong:** cap-fiddling instead of triage. **Or the inverse:** a real regression waved
through as SEED-171.
**Why:** CLAUDE.md's 2026-08-17/18 correction — the cap does **not** fix SEED-171's **five** flaky
suites, and `196-08` measured **249 real failures** from mock factories missing a newly-added export.
**How to avoid:** pull failing filenames from the gate's **own persisted JSON before any re-run**;
check each against `git diff --numstat <base> HEAD` and `git status --short`; never touch the cap.
⚠ Adding an export to `@/lib/api` (D-13, hop 3) is **exactly** `196-08`'s trigger — nine suites'
explicit `@/lib/api` mock factories threw at mount. **Expect it and budget the one-line-per-suite
fix.**
**Warning sign:** many suites failing at mount with an undefined-export error.

### Pitfall 6 — Mounting `DescribeTemplateRow` on the drafted view
**What goes wrong:** nothing produces its `state` there.
**Why:** the pre-draft reading lives in `useTemplateFirstDraft`; the drafted reading needs a saved
definition id which a fresh draft does not have yet.
**How to avoid:** row 2 states + jumps; it does not mount.
**Warning sign:** a plan importing `DescribeTemplateRow` into the new card.

### Pitfall 7 — A prose-tripped fence
**What goes wrong:** a docblock explaining a fence contains the string the fence greps for.
**Why:** these fences read RAW source.
**How to avoid:** build needles at runtime; name banned identifiers by role. `196-04` had three
acceptance greps fail on comments; `DescribeTemplateRow.tsx:31-34` records the same trap.

---

## Code Examples

### The 193.2 write (the shape rows 3 and 4 take)
```ts
// Source: frontend/src/components/workflows/builderStore.ts:711-727
setBusinessRequirement: (text) => {
  const s = get()
  if (s.builderPhase !== "drafted") return
  set({
    meta: { ...s.meta, business_requirement: text,
            business_requirement_seeded_by_ai: false },
    dirty: true,
  })
},
```

### The live read with no mirror (the shape every row's "current answer" takes)
```tsx
// Source: frontend/src/pages/WorkflowBuilderPage.tsx:2140-2143
const requirementIsAiProposed =
  meta.business_requirement_seeded_by_ai === true &&
  typeof meta.business_requirement === "string" &&
  meta.business_requirement !== ""
```
⚠ The `=== true` is the narrowing, and it is strict on purpose: *"an `unknown` off a JSONB row must
not be truthy-tested into a provenance claim."*

### The shared predicate D-12 reads (the ONE source)
```python
# Source: backend/app/services/harness/grounding.py:1000-1013
BUSINESS_REQUIREMENT_MISSING_MESSAGE: str = (
    "Add the Business requirement — one line saying what this workflow must deliver — "
    "before publishing."
)

def business_requirement_missing(definition: "WorkflowDefinition") -> bool:
    return not (definition.business_requirement or "").strip()
```
⚠ Its own comment: *"It reaches the author VERBATIM — `blockedReason` relays the first verdict's
message and D-182-06 forbids a client-side message map — so this string IS the UI copy."*

### The three-state union (the shape D-13's client read takes)
```ts
// Source: frontend/src/components/workflows/soulData.ts:243-247
export type TemplateAdmission = "admits" | "does-not-admit" | "unknown"
```
⚠ *"THE THREE STATES ARE LOAD-BEARING … this is NOT a boolean with a `?? true` at one call site."*

### The characterization capture (D-05's mechanism)
```ts
// Source: frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx:264-284
async function capture(row: CaptureRow): Promise<string> {
  const rendered = await mountPreDraft(row.canvasOn)
  /* …drive to the arm… */
  const html = rendered.container.innerHTML   // :282 — the WHOLE container, never a subtree
  rendered.unmount()
  return html
}
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Two receipts stacked on the drafted view | **ONE card, two components underneath** | sketch 174, 2026-08-18 | Arrival chrome 284 → **149 px**; graph 47% → **65%** of a 780 px screen |
| `SeedReceipt` always fully open | Foldable inside the parent | sketch 174 tab 3 vs tab 1 | *"the fold is an improvement to the arrival moment even setting the five decisions aside"* |
| `business_requirement` blank on every draft | Proposed by the generator + `AI-proposed` mark | 193.2 | 20/20 non-empty. **A reduction, never an absence** |
| The AI drafts blind to the template | `template_placeholders` sent | 193.1-07 | The deliverable branch flips 0/3 → 3/3 |
| `template_asset_id` accepted, never sent | ⚠ **still never sent** | — | **The live 4th D-22 instance — D-14's real positive control** |

**Deprecated/outdated in the inherited prose:**
- *"a canvas-built workflow can never be published"* (C-2) — closed by `quick-260809-klo`.
- *"`name_seeded_by_ai` — the provenance shape is already there"* (C-1) — `PhaseSpec` only.
- *"`builderStore` does not express a step edit as a row edit"* (sketch 173) — `patchConfig` does.
- *"`backend/app/api/threads.py` is the hottest file in the repository"* — refuted; `api.ts` is.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies how |
|---|---|
| No LangChain / LangGraph; raw SDK calls | Untouched — this phase adds no provider call |
| Pydantic for structured outputs | The D-13 field, if modelled, is Pydantic; `extra="forbid"` |
| Additive-optional over migration for definition JSONB | Any new definition field (row 4's provenance) — **zero migration**, the 187/193.2 pattern |
| Settings live in `user_settings`/`app_settings` | No new env var |
| Schema changes ship as numbered SQL migrations | **None expected.** If one appears, the plan has drifted from additive-optional |
| **G-2** sketch before plan for UX | ✅ **DISCHARGED** — 172, 173, 174 built and committed |
| **G-4** lived-experience UAT at scope time | See `## G-4 Lived-Experience UAT Rows` |
| **G-5** refactor between feature waves | ⚠ **Fires on six predicted files** — see below |
| **G-7** gap-closure round cap | Run `node scripts/check-gap-closure-rounds.cjs 197` before any `--gaps` routing |
| `GSD_VITEST_MAX_WORKERS=2` | Every gate run |
| Worktrees ENABLED; bootstrap first | `bash scripts/bootstrap-worktree.sh "$(pwd)"` as the FIRST action; **never `rm -rf`** |
| Serialize plans whose tests mutate the local DB | Applies if any plan drives a live publish |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` — currently 66,918 chars, 44.6% of limit |
| Hot-file ledger same-commit sync | A ledger row and its `docs/HOT-FILE-LEDGER.md` section in the SAME commit |

### G-5 scan — triples RE-DERIVED 2026-08-18 by the orchestrator (⚠ CONTEXT.md's table is stale on five of six rows; every one GREW)

| Predicted file | commits / phases / lines | CONTEXT said | G-5 | Disposition |
|---|---|---|---|---|
| `frontend/src/lib/api.ts` | **170 / 99 / 6154** | 97 | ⚠ **FIRES HARDEST** | Gains **one type arm**. Not covered by construction |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 42 / **15** / 2398 | 13 | **FIRES** | Gains the card mount + `onDrafted` payload (+ Q2 option b's one expression) |
| `backend/app/api/workflows.py` | 36 / **19** / 1984 | 18 | **FIRES** | ⚠ **May need ZERO change** — no `response_model`; the route passes the dict through |
| `backend/app/services/harness/grounding.py` | 18 / **6** / 1252 | 5 | **FIRES** | Read-only for D-12's single row. May need zero change |
| `frontend/src/components/workflows/builderStore.ts` | 11 / **6** / 837 | 5 | **FIRES** | Gains `setName` only |
| `backend/app/services/workflow_authoring.py` | 12 / 6 / 572 | 6 | **FIRES** | One key on the success dict |
| `frontend/src/components/workflows/SeedReceipt.tsx` | 6 / 1 / 360 | — | no | **NOT EDITED** (D-02) |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | 4 / 1 / 595 | — | no | Callback signature + payload |
| `backend/app/services/harness/publish_service.py` | 20 / 8 / 1250 | — | **FIRES** | **NOT EDITED** — gate untouched |

**The G-5 recommendation, produced FIRST as the guardrail requires:** the decisions surface, its
vocabulary module and the parent are **NEW files**, so the frontend half is **honoured by
construction** — the 193.1 precedent, where the pre-draft concern was cut to
`useTemplateFirstDraft.ts` *before* the feature that needed room.

**Two rows are NOT covered by construction:**
1. **`api.ts` (99 phases, 6154 lines, the hottest file in the repo).** ⚠ Its ledger row was added
   only at Phase 196; before that it was invisible to its own guardrail. The honest disposition here
   is *"gains one type-union arm and nothing else"* — a genuinely minimal touch. **The plan should
   record that as an explicit decision (a named seam declined, with a reason), not leave it silent** —
   `196-08`'s recorded outcome for `FieldLabel` is the precedent: *take it or name it, never
   neither.*
2. **`WorkflowBuilderPage.tsx` (15 phases, 2398 lines).** Every addition here is a mount or a
   callback payload. ⚠ Note the shipped vocabulary constants `REQUIREMENT_INVITATION` (`:388`),
   `REQUIREMENT_AI_MARK_LABEL` (`:428`) and `REQUIREMENT_AI_MARK_EXPLANATION` (`:432`) **live in this
   page, not in a vocabulary module.** D-09/D-10 make it tempting to move them into the new module —
   **that is a G-5-honouring extraction and should be a named decision** (taken or declined), because
   silently re-declaring them in the new module is the *two spellings of a locked string* failure
   `builderStore.ts:140-152` records by name.

⚠ **Re-derive every triple at phase close with the ledger's own recipe.** Five rows were found stale
on 2026-08-17 and three read `satisfied`.

---

## Runtime State Inventory

*(Included because D-13 changes a wire contract and row 4 may add a definition field. Every category
answered explicitly.)*

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | ⚠ **`WorkflowDefinition` lives in a JSONB column, and 194 of 223 rows store it as a jsonb STRING SCALAR** (`soulData.ts:227-233`, CLAUDE.md's jsonb string-scalar trap). A new definition field is **additive-optional with zero migration** (the 187 / 193.2 precedent: 112 files before and after, `extra="forbid"` proved not relaxed). **Existing rows simply lack the key**, which is the correct reading | **None** — no data migration. ⚠ But any client reading the new field must treat absent as absent, never as `false`-means-something |
| **Live service config** | **None** — this phase touches no n8n workflow, no Datadog service, no Tailscale ACL, no Cloudflare tunnel. Verified: the predicted `files_modified` contain no external service identifier | None |
| **OS-registered state** | **None** — no Task Scheduler entry, no pm2 process, no systemd unit. Verified by the absence of any script/daemon change in scope | None |
| **Secrets / env vars** | **None** — no new env var. `check-deploy-drift.sh` will confirm at close. D-09's *"zero provider calls"* means no new provider key either | None |
| **Build artifacts** | **None** — no `pyproject.toml` rename, no sandbox image tag change, no npm global. ⚠ `supabase/full-schema.sql` needs regeneration **only if** a numbered migration ships; none is expected (additive-optional) | None expected. If a migration does appear, `bash scripts/regenerate-full-schema.sh` (no `--reset`) becomes owed |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node + npm | frontend suites, count gate | ✅ | repo-pinned | — |
| Python venv | backend suites, D-14's fence | ✅ (`backend/venv/Scripts/python.exe` — used this session) | 3.12 | — |
| Local Supabase :54322 | only if a plan drives a live publish/DB read | ⚠ **not probed this session** | — | Every fence in this phase is unit-level; **no plan needs the DB**. If one does, see CLAUDE.md's Windows port-reservation trap |
| A configured LLM provider | **G-4 UAT rows only**, never the code | operator-gated | — | Automated fences are provider-free by construction (D-09) |
| Chrome DevTools MCP | G-4 rows | ✅ (used at 196 close) | — | ⚠ `take_screenshot` times out — read DOM geometry via `evaluate_script`. **But sketch 174's own lesson is that only LOOKING catches appearance defects** — the operator drives |
| Docker | not needed | denied to the agent layer | — | Prefer `bash scripts/...` wrappers |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** a live provider — every automated criterion holds without one.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Frontend framework | Vitest + @testing-library/react (jsdom) |
| Frontend config | `frontend/vitest.config.ts`; the gate is `scripts/vitest-count-gate.cjs` (100 commits / 3215+ lines) |
| Backend framework | pytest |
| Backend config | `backend/pytest.ini` / `pyproject` |
| Quick run (frontend, in-scope only) | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run <paths>` |
| Quick run (backend) | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_workflow_authoring_requirement.py -q` |
| Full frontend gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |
| Full backend | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit -q` |
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` ⚠ **the `-p` is load-bearing** — a bare `--noEmit` checks ZERO files |

### The suites that gate this work — every one already PINNED

| Suite | Pin | Why it gates |
|---|---|---|
| `WorkflowBuilderPage.preDraft.baseline.test.tsx` | **22** (`vitest-count-gate.cjs:403`) | ⭐ **D-05's fence.** Needs BOTH knobs — `src/pages` has no directory entry, only named files (`:2440-2470`) |
| `WorkflowDoorSwitch.baseline.test.tsx` | in BASELINE | The loose door's half of D-05 |
| `WorkflowBuilderPage.describe.test.tsx` | **30** (`:361`) | Holds `FLAG_OFF_DESCRIBE_MARKUP` (Phase 187) |
| `WorkflowBuilderPage.header.test.tsx` | **27** | ⚠ **`FLAG_OFF_HEADER_MARKUP`** — Q2 option b re-captures here |
| `WorkflowBuilderPage.canvas.test.tsx` | **128** (`:350`) | The receipt's snapshot fences (three real post-arrival edits) |
| `SeedReceipt.test.tsx` | **68** (`:242`) | ⚠ The `?raw` source fences that fail if D-02 is breached |
| `builderStore.test.ts` | **52** (`:1311`) | ⚠ Sweeps this source for the API-client specifier — **fires on PROSE too** |
| `useTemplateFirstDraft.test.tsx` | **58** (`:679`) | The `/generate` wire + `onDrafted` contract |
| `definitionOps.test.ts` | **243** (`:237`) | Where D-09's vocabulary lands if it extends |
| `phaseVocabulary.test.ts` | **117** (`:266`) | `groundingCauseOf` / `nodeTitle` |
| `soulData.test.ts` | **36** (`:517`) | ⭐ Row 5's derivation |
| `DescribeKbPicker.test.tsx` | **37** (`:335`) | Row 1's component |
| `DescribeTemplateRow.test.tsx` | **42** (`:624`) | Row 2's component |
| `PhaseFormPanel.test.tsx` | **38** (`:448`) | Rows 2/5's jump destination |
| `WorkflowDoorSwitch.test.tsx` | **44** (`:601`) | ⚠ Six swept sources incl. `WorkflowBuilderPage.tsx` and `useTemplateFirstDraft.ts` |
| `backend/tests/unit/test_workflow_authoring_requirement.py` | — | ⭐ **D-14's home** |
| `backend/tests/unit/test_182_publish_grounding_stage.py`, `test_publish_service.py` | — | Prove the gate is unchanged |

⚠ **New suites need BOTH gate knobs if they live under `src/pages`** (named files only, no directory
entry). Under `src/components/workflows` the directory entry runs them and only a BASELINE pin is
needed (`vitest-count-gate.cjs:2441`, `:2460-2470`). **Recommendation: put the new components under
`src/components/workflows`** — one knob instead of two, and it is where every sibling lives.

### Phase Requirements → Test Map

| Req | Behaviour | Type | Automated command | File exists? |
|---|---|---|---|---|
| AUTH-02 / SC#2 (D-05) | Pre-draft describe screen byte-unchanged, 6 states | characterization | `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` | ✅ **exists, predates by 4 phases** |
| AUTH-02 / SC#2 | Loose door byte-unchanged | characterization | `… src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` | ✅ exists |
| AUTH-02 / SC#2 | `git diff --numstat <base> HEAD -- <both baselines>` deletions == 0 | source | shell, at every wave merge | ❌ **Wave 0 — the plan declares it** |
| AUTH-02 / SC#1 | Exactly 5 rows, always, same order | unit | `… DecisionsList.test.tsx` | ❌ Wave 0 |
| AUTH-02 / SC#1 | Each row renders its CURRENT answer off the definition | unit | same | ❌ Wave 0 |
| AUTH-02 / SC#1 | Answering a row writes through the store; a second render agrees | unit | `… builderStore.test.ts` + list suite | ⚠ partly (rows 1-3 shipped) |
| AUTH-02 / D-02 | `SeedReceipt.tsx` byte-unchanged | source | `git diff --numstat <base> HEAD -- .../SeedReceipt.tsx` → `0 0` | ❌ Wave 0 |
| AUTH-02 / D-13 | **readiness ABSENT ⇒ no positive verdict anywhere** | unit ⭐ | list suite | ❌ Wave 0 |
| AUTH-02 / D-13 | readiness `"missing"` ⇒ the gate's own sentence, char-identical | unit | list suite | ❌ Wave 0 |
| AUTH-02 / D-13 | `/generate` success dict carries the key; failure arms do not | unit | `pytest -k generate_readiness` | ❌ Wave 0 |
| AUTH-02 / D-09 | Every string is an imported identifier — none literal in the component | source ⭐ | `?raw` sweep, `SeedReceipt.test.tsx` idiom | ❌ Wave 0 |
| AUTH-02 / D-14 | Advertised-but-not-asked == the allowlist | unit ⭐ | `pytest .../test_workflow_authoring_requirement.py -k advertised` | ❌ Wave 0 |
| AUTH-02 / D-14 | Accepted-but-never-sent == the allowlist (**RED on `template_asset_id`**) | unit ⭐ | same | ❌ Wave 0 |
| AUTH-02 / D-14 | Positive control — a synthetic extra field is reported | unit | same | ❌ Wave 0 |
| AUTH-02 / D-11 | **The publish gauntlet is byte-unchanged** | source | `git diff --numstat <base> HEAD -- backend/app/services/harness/publish_service.py` → `0 0` | ❌ Wave 0 |
| AUTH-02 / layout | `graphColumn` has exactly THREE children | unit ⭐ | `WorkflowBuilderPage.canvas.test.tsx` | ⚠ extend |
| AUTH-02 / snapshot | Post-arrival edits do not rewrite the card's past-tense sentences | unit | `WorkflowBuilderPage.canvas.test.tsx` (3 real edits) | ⚠ extend |
| AUTH-02 / D-15 | **`slug` is never written** | unit | `builderStore.test.ts` | ❌ Wave 0 |
| AUTH-02 / row 5 | `terminalEmitSlug` — null when no emit; last by `phase_index` when several | unit | `soulData.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the in-scope suites by path, `GSD_VITEST_MAX_WORKERS=2`, plus
  `npx tsc --noEmit -p tsconfig.app.json`
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **plus** the two
  numstat deletion checks **plus** `pytest backend/tests/unit -q`
- **Phase gate:** full suites green + every source fence + tsc at the baseline before `/gsd:verify-work`

### ⚠ How to read the count gate — the corrections that matter

**The last measured verdict** (`STATE.md:227-228`, Phase 196 close):
`count gate OK · total 4291 · failed 0 · pinned 4217 · 89/89`. tsc baseline **33**. Backend
**211 failed / 4046 passed**.

⚠ **These numbers HAVE ROTTED THREE TIMES, once in a single day.** Re-derive; never inherit.
**A growing total is the gate WORKING** — its contract is *no per-file DECREASE* and *zero failing*.

⚠ **`GSD_VITEST_MAX_WORKERS=2` STANDS, but it does NOT fix SEED-171's flaky suites.** The set is
**FIVE**, three of which fail with `AssertionError` rather than `STACK_TRACE_ERROR`:
`src/pages/WorkflowsPage.test.tsx` · `src/components/workflows/library/WorkflowCard.test.tsx` ·
`src/pages/WorkflowBuilderPage.session.test.tsx` · `src/pages/WorkflowRunPage.test.tsx` ·
`src/pages/WorkflowBuilderPage.canvas.test.tsx`.

⚠⚠ **AND ONE OF THE FIVE — `WorkflowBuilderPage.canvas.test.tsx` — IS A SUITE THIS PHASE EXTENDS.**
So a red run on it will be genuinely ambiguous. **Discipline, non-negotiable:** filenames from the
gate's own persisted JSON **before any re-run**; each checked against `git diff --numstat` and
`git status --short`; cap untouched. If it is in the diff, it is **not** provably a flake. Say
*"provably unmodified"*, never *"fine"* — one green sample is not proof of innocence.

⚠ **A red gate is sometimes REAL.** `196-08` hit **249 failures** because nine suites' `@/lib/api`
mock factories did not declare a newly-added export. **D-13 hop 3 adds a type, not a value, so this
specific trigger should not fire — but if the plan adds any runtime export to `api.ts`, expect it and
budget one mock line per suite.**

### Wave 0 gaps

- [ ] **`WorkflowBuilderPage.preDraft.baseline.test.tsx` run GREEN at the base SHA and the SHA
      recorded** — covers SC#2 / D-05. ⚠ **FIRST plan, before any source edit.**
- [ ] The numstat deletion criterion declared for both baseline files (D-05) and for
      `SeedReceipt.tsx` (D-02) and `publish_service.py` (D-11)
- [ ] `DecisionsList.test.tsx` — the five rows, their answers, their writes, and the readiness
      three-arm read
- [ ] `DraftArrivalCard.test.tsx` — one card; `SeedReceipt` composed unmodified; the graphColumn
      child-count assertion
- [ ] `decisionsVocabulary.test.ts` — character-identity + the `?raw` no-literal-sentence sweep with a
      positive control
- [ ] Backend cases in `test_workflow_authoring_requirement.py` — D-14 halves A and B + the synthetic
      positive control
- [ ] Backend case — the `/generate` success dict carries `readiness`; the four failure arms do not
- [ ] `soulData.test.ts` — `terminalEmitSlug`
- [ ] `builderStore.test.ts` — `setName` (if taken): writes `name`, never `slug`, arms `dirty`, bails
      outside `drafted`, untracked
- [ ] Gate pins for every new suite (BASELINE; **plus TARGETS if any lands under `src/pages`**)

**Framework install:** none needed.

---

## G-4 Lived-Experience UAT Rows

**G-4 binds — this phase touches user-visible UI.** Defined at scope time, not post-hoc. Authored
under `197-VALIDATION.md`, never as PLAN.md tasks.

⚠ **Sketch 174's own hardest-won lesson applies to every row: *geometry proves composition; only
looking proves appearance.* Three pages of green assertions did not notice that every page rendered
in LIGHT mode, or that the header contradicted the card. Screenshot / look, do not only measure.**

| Row | "I'd recognise failure here" | Method |
|---|---|---|
| **U1 — the arrival moment** | I describe a workflow, press the CTA, and what lands is **ONE card of about four lines**, not two stacked cards and not a wall. The workflow graph is still the biggest thing on screen | Operator, live browser. ⚠ Also check **below ~900 px** — sketch 172 measured 662 px of chrome leaving the graph 25 px at a 700 px column |
| **U2 — the fast door still feels fast** | I go to describe a workflow and the screen asks me for **nothing new**. No extra control, no extra required field, no new gate. It is the screen I used yesterday | Operator, live. ⚠ **BOTH doors** — the loose (`WorkflowDoorSwitch`) and the govern (`WorkflowBuilderPage`) screens are near-identical and a change can land on one |
| **U3 — a decision is answerable, and the answer sticks** | I open the decisions fold, change the knowledge base, and the header agrees instantly. I reload the draft and my answer is still there | Operator, live + a DB read of the definition JSONB |
| **U4 — the requirement row, on ≥ 2 providers** ⭐ | On one provider the requirement row shows something durable and I leave it. On another it names one run's parameters and I can see that and fix it **in the row** | ⚠ **MUST NOT be scored on one provider** — measured: **anthropic named a one-run parameter in 0 of 5, openai in 5 of 5** (`193.2-FREQUENCY.md` §6(c)). See the roster below |
| **U5 — the row and the header do not contradict** | The card says "Vendor contracts" and the header strip says the same. Never two answers to one question | Operator, live. ⚠ This is the exact defect sketch 174 shipped and caught only by looking |
| **U6 — the name row is the name's first honest display** | The row shows my workflow's **name**, and after I edit it the name I typed is what I see — not `northwind-qbr-fa65a43c` | Operator, live. ⚠ Q2's disposition decides what "honest" means here — drive it **after** that call, not before |
| **U7 — dismissal is an offer, not a wall** | I press ✕ and the card goes. The graph takes the space. Nothing is lost and nothing was saved | Operator, live |
| **U8 — the deliverable row leads somewhere real** | Pressing the deliverable row's action opens the step that actually produces the file, on the field that decides what it says | Operator, live (option ii only) |
| **U9 — legibility of the 11 px controls** ⚠ | If rows 1/3 route me to the header controls, I can actually **read** them — and the `AI-proposed` mark reads right beside a real sentence | Operator judgement. ⚠ **Inherits 193.2-09's owed sliver** — that mark shipped with no browser UAT and `SEED-163`'s close-out names the row as still owed. Thirty seconds; take it here |

### The cross-provider roster for U4 — DERIVED, never re-typed

Measured this session from `MODEL_CAPABILITIES` (`backend/app/config.py`): **8 provider groups, 61
models.**

```
anthropic  7 | deepseek 2 | google 7 | minimax 8
moonshot   3 | openai  17 | openrouter 9 | zhipu 8
```

Recipe (run it; do not copy the list above into a scoreboard):

```bash
cd backend && SUPABASE_URL=x SUPABASE_SERVICE_ROLE_KEY=y venv/Scripts/python.exe -c "
from app.config import MODEL_CAPABILITIES
from collections import defaultdict
g=defaultdict(list)
for k,v in MODEL_CAPABILITIES.items():
    g[v.get('provider') if isinstance(v,dict) else getattr(v,'provider',None)].append(k)
for p in sorted(g,key=str): print(p, len(g[p]), g[p])"
```

**Scope of the roster for THIS phase, stated rather than assumed.** CLAUDE.md's scoreboard recipe
requires the **full 8-row native roster** for any phase touching *streaming, agent loop, provider
routing, or UI state*. **This phase touches none of those** — D-09 makes it provider-free by
construction, and that is itself worth proving with one row.

So:

| Axis | This phase's obligation |
|---|---|
| **Cross-provider** | ⚠ **Split.** (a) **U4 is a GENERATION-QUALITY row and needs ≥ 2 providers minimum — anthropic and openai, because those are the two the 0/5-vs-5/5 contrast was measured on.** A third (google — historically the highest-risk tool-call row) is recommended. (b) **The SURFACE ITSELF must be shown provider-independent**: one row proving the five questions and the five verdicts are byte-identical across a provider switch. That is the honest reading of *"D-09's no-provider-call choice must be shown to hold."* |
| **Multi-tool** | Not applicable — no tool call on this path. **Record as ⛔ with the reason; never silently omit** |
| **Parallel-thread** | Not applicable — authoring is not a run. **Record as ⛔ with the reason** |
| **Long-message** | ⚠ **Applicable and worth one row** — a very long describe text produces a long `business_requirement` and a long name. **Does row 3's 240 px truncated input, or row 4's, become unusable?** This is a real failure mode, not a formality |

⚠ **Rows may be blocked, never silently omitted.** A provider with no key configured is recorded ⛔
with the reason and the blocking id. **A scoreboard that lists only what passed is not a
scoreboard.**

⚠ **Prefer a registry-backed model id per provider.** An id absent from `MODEL_CAPABILITIES`
resolves `capability_source=inferred` and silently loses `emit_tier` (SEED-040, SEED-135) — the row
would then measure a weaker configuration than the one that ships.

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is included.

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | No new route; `/generate` keeps `Depends(get_current_user)` (`workflows.py:1601`) |
| V3 Session Management | no | No session surface |
| V4 Access Control | ⚠ **indirectly — verify, do not assume** | `/generate` keeps `require_visible("workflow_authoring")` (`workflows.py:1598`). **The D-13 field must carry no cross-tenant data.** The readiness verdict is a function of the definition the caller just generated — no folder names, no ids, no other user's data |
| V5 Input Validation | ✅ **yes** | Pydantic `extra="forbid"` on `WorkflowDefinition`; `setName` writes a `str` and the server owns every emptiness rule (`grounding.py:894`). **No client-side validation rule may be added** (D-182-06) |
| V6 Cryptography | no | Nothing cryptographic |
| V7 Error Handling | ✅ yes | `{ok:false}` at HTTP 200 is the shipped honest-failure contract; the readiness field must not appear on failure arms |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| XSS via a model-authored string (the name, the requirement) rendered in the card | Tampering | **Plain React text children only.** `SeedReceipt.tsx:119-121` states the rule and its suite pins it: *"every server- or model-authored string … renders as a plain React text child. React escapes text children; the raw-HTML prop is never used here."* **Copy this into the new components** |
| Provenance laundering — the model emits `business_requirement_seeded_by_ai: true` (or a future `name_seeded_by_ai`) to make its own output look human, or vice-versa | Spoofing | **Already mitigated for row 3 and MUST be repeated for row 4:** the flag is stamped **server-side after validation** and the model's claim is ignored **in both directions**, each pinned and each driven RED (`workflow_authoring.py:552-561`). ⚠ `WF_SCHEMA` is `model_json_schema()`, so **the emit tool advertises the flag to the model** — laundering is reachable, not hypothetical |
| A client-invented reason string reaching the author | Repudiation | D-13/187-24: the message is the server's `BUSINESS_REQUIREMENT_MISSING_MESSAGE`, verbatim. No client message map |
| Cross-tenant leakage through a readiness verdict | Information disclosure | The verdict is computed from the caller's own just-generated definition. **Assert it names no folder, no id and no other row** |
| A `readiness` absence read as a pass | Repudiation / integrity | The three-arm union + the RED-first absent-field test |

⚠ **The one place to be careful:** if a future widening computes a readiness verdict for row 1 (KB
scope), it would need to read the folder tree — an **owner-scoped** read
(`assemble_grounding_bundle`, `grounding.py:342`). **Not this phase.** `196-06`'s recorded finding is
the reason to say so out loud: `get_definition` **returns global published rows to non-owners**,
which is why its code compares `created_by` explicitly rather than `is not None`.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| **A1** | The one-card parent can compose `SeedReceipt` with **zero edits** to `SeedReceipt.tsx` | Architecture | Low — `open` is caller-owned (`SeedReceiptProps.open`) and it renders `null` when closed. But if the parent needs the receipt's *counts* for its own summary line, it derives them from the same `phases` prop rather than asking the receipt. **Verify at plan time by writing the parent's summary-line derivation first** |
| **A2** | Row 5 option (ii)'s `jumpToStep` opens the panel **on the Instructions field** | Q1 | Medium — `jumpToStep` selects the step; it does not focus a field. If the operator expects focus, a focus seam is needed. **Sketch 174 already lights up a control on jump**, so the expectation exists |
| **A3** | Q2 option (b) forces exactly ONE `FLAG_OFF_HEADER_MARKUP` re-capture | Q2 | Medium — priced from band 3's own note; not driven this session. **Verify by running `WorkflowBuilderPage.header.test.tsx` after the change and reading which bands red** |
| **A4** | No SQL migration is needed even if row 4 gains a provenance flag | Runtime state | Low — 187 and 193.2 both shipped exactly this with zero migration (112 files before and after) |
| **A5** | The gate's flaky-suite risk on `WorkflowBuilderPage.canvas.test.tsx` is manageable because the plan edits it deliberately | Validation | Medium — it is both **in SEED-171's five** and **in this phase's scope**. Triage will be genuinely ambiguous; the discipline above is the only mitigation |
| **A6** | `backend/app/api/workflows.py` needs **zero** change for D-13 | D-13 | Low — measured: no `response_model`, `return result` passes the dict through (`:1620-1630`). ⚠ If a plan adds a `response_model` "for tidiness" it would **break** the pass-through and change the failure arms too |
| **A7** | The 8 provider groups in `MODEL_CAPABILITIES` are the current roster | G-4 | Low — measured this session. **Re-derive at UAT time**; a provider added between now and then would be silently missed |

---

## Open Questions (RESOLVED)

⚠ **ALL SIX WERE RESOLVED AT PLAN-PHASE, 2026-08-18 — this heading is a trace, not an open list.**
Two went to the operator and were answered; four were decided from measurement and are recorded in
the plan that makes the call. Nothing below is still open. Resolutions:

| # | Resolved by | Where it now lives |
|---|---|---|
| 1 | **operator's pick** — option (ii), jump | `197-CONTEXT.md` **D-18** · plans `197-04`, `197-07` |
| 2 | **operator's pick** — yes, switch the header | `197-CONTEXT.md` **D-19** · plan `197-10` |
| 3 | **DECLINED**, with a re-open trigger | `197-CONTEXT.md` **C-1** · plan `197-05` |
| 4 | **NEW module** `decisionsVocabulary.ts`, re-exporting the three page constants | plan `197-03` |
| 5 | honest absence + the jump; never *"no template"* on an `unknown` | plan `197-07` |
| 6 | **BUILD IT** — one verdict today, the other four **absent, never green** | `197-CONTEXT.md` **D-20** · plans `197-02`, `197-06` |

1. **Row 5 — display-only, or jump-to-emit-step?** *(RESOLVED: D-18 — operator picked option (ii))*
   - Known: `patchConfig` exists; `jumpToStep` exists; the Instructions field is already editable;
     `soulDeliverable` is not rendered on the Builder at all.
   - Unclear: whether the operator wants five rows that all *do something*, or four that do and one
     that states a fact.
   - **Recommendation: option (ii), jump.** Same cost class as display-only, preserves the grammar,
     zero new store actions and zero new fields. **Row 5 is the cheapest of the five, not the
     dearest** — the sketch's pricing was based on a claim about `builderStore` that is measurably
     wrong.

2. **Row 4 — does the header switch to the name?** *(RESOLVED: D-19 — operator picked yes, re-capture as its own task)*
   - Known: the header renders the slug; the name is displayed nowhere; the flag-off header is a
     byte-pinned literal whose own note says it expects no third re-capture.
   - Unclear: whether the operator will accept a rendered name/slug disagreement.
   - **Recommendation: yes, switch it, with the re-capture declared as its own task.** A name the
     author edits which is then invisible everywhere except the row that edited it is not a
     satisfied D-15.

3. **Does row 4 wear an AI-proposed mark?** *(RESOLVED: C-1 — DECLINED, trigger recorded in `197-05`)*
   - Known: `name_seeded_by_ai` is a `PhaseSpec` field; `WorkflowDefinition` has no equivalent.
   - **Recommendation: DECLINE for this phase**, with the reason recorded — the row's own sentence
     already says the AI chose the name, so the mark states the same fact twice, and D-16 forbids it
     meaning anything more. Re-open trigger: an author reporting they could not tell whether they or
     the AI named a workflow.

4. **D-10 — new module, or extend `templateFirstVocabulary.ts`?** *(RESOLVED: a NEW `decisionsVocabulary.ts` — plan `197-03`)*
   - Known: four shipped precedents; ⚠ `REQUIREMENT_INVITATION` / `REQUIREMENT_AI_MARK_*` live in
     `WorkflowBuilderPage.tsx` (`:388`, `:428`, `:432`), not in a module.
   - **Recommendation: a NEW module** (`decisionsVocabulary.ts`) that **re-exports** the three
     shipped page constants rather than re-declaring them — *"two spellings of a locked string is how
     a locked string stops being locked"* (`builderStore.ts:147`). A new module also keeps the G-5
     "honoured by construction" argument intact.

5. **What does row 2 show when no template is bound?** *(RESOLVED: honest absence + jump — plan `197-07`)*
   - Known: most drafts bind none; `templateAdmission` already models three states and its two call
     sites fall back **opposite ways** on `unknown`, deliberately.
   - **Recommendation:** state the honest absence (*"no document attached"*) and offer the jump. **Do
     not** render *"no template"* on an `unknown` — that is `templateAdmission`'s D-20 lesson.

6. **Is the D-13 readiness field worth building for ONE row?** *(RESOLVED: BUILD IT — D-20, plans `197-02` / `197-06`)*
   - Known: exactly one of five rows has a server predicate.
   - Argument for: D-12/187-24 make the *mechanism* the point — the alternative is a client-side
     `!text.trim()`, which is the second copy the project has now removed twice. The field also
     establishes the shape a future phase widens.
   - Argument against: one row's worth of payload threaded through five hops including
     `api.ts` (99 phases).
   - **Recommendation: build it**, and say plainly in the plan that it carries **one** verdict today
     and why the other four are absent rather than green. **A field that silently carried four
     invented greens would be strictly worse than no field.**

---

## Sources

### Primary (HIGH confidence — read this session, `file:line` cited throughout)

- `frontend/src/pages/WorkflowBuilderPage.tsx` — `:388`, `:428-435`, `:540-548`, `:742-744`, `:795-820`, `:1570`, `:1637`, `:1772`, `:1890-1946`, `:1992-2055`, `:2057-2211`, `:2240-2313`
- `frontend/src/components/workflows/builderStore.ts` — `:140-152`, `:178-206`, `:255-306`, `:327`, `:378-393`, `:548-582`, `:610-760`
- `frontend/src/components/workflows/SeedReceipt.tsx` — `:1-121` (docblock), `:146-190` (props)
- `frontend/src/components/workflows/soulData.ts` — `:122-183`, `:200-260`
- `frontend/src/components/workflows/useTemplateFirstDraft.ts` — `:321`, `:409`, `:445-448`, `:495-560`
- `frontend/src/components/workflows/DescribeKbPicker.tsx` — `:81-91`
- `frontend/src/components/workflows/DescribeTemplateRow.tsx` — `:1-60`, `:93-110`
- `frontend/src/components/workflows/TemplateAttachSection.tsx` — `:180-225`
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — `:945`, `:1166`
- `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` — `:373`, `:390`, `:451`
- `frontend/src/components/workflows/definitionOps.ts` — `:283-316`
- `frontend/src/lib/api.ts` — `:3432-3442`, `:3956`, `:4131-4147`
- `frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` — `:1-77`, `:250-300`, `:340-425` (**the D-05 fence**)
- `backend/app/services/workflow_authoring.py` — `:225-239`, `:300-340`, `:460-470`, `:520-572`
- `backend/app/services/harness/grounding.py` — `:727-770`, `:816-878`, `:879-982`, `:986-1013`, `:1029-1094`
- `backend/app/services/harness/publish_service.py` — `:1-60`, `:87-435`
- `backend/app/services/harness/reachability.py` — `:111-190`
- `backend/app/api/workflows.py` — `:1578-1631`
- `backend/app/models/harness.py` — `:435`, `:538`, `:575-605`
- `scripts/vitest-count-gate.cjs` — `:237-679`, `:1311-1417`, `:2440-2470`
- **Commands run this session:** `WorkflowDefinition.model_fields` enumeration; `WF_SCHEMA` properties × prompt-membership; `MODEL_CAPABILITIES` provider grouping; `git log --numstat` on the baseline file; `grep -rn "<WorkflowSoul"`; `grep -rn "template_asset_id" frontend/src`

### Secondary (HIGH — project documents)

- `.planning/phases/197-guided-authoring/197-CONTEXT.md` (D-01..D-17)
- `.planning/STATE.md` — the Phase 197 blocks, the sketch findings, Phase 196's close
- `.planning/sketches/174-the-line-that-opens/README.md` (**the acceptance bar**), `172/README.md`, `173/README.md`
- `.planning/seeds/SEED-163…md` (in full), `.planning/seeds/SEED-157…md`
- `.planning/REQUIREMENTS.md` §AUTH-02 `:27`, AUTH-03 correction `:34-60`
- `.planning/ROADMAP.md` `:672-684`
- `.planning/reported-bugs/template-first-drafts-cannot-be-published.md` (frontmatter)
- `CLAUDE.md` — worktrees, the cap corrections, SEED-171's five, the UAT roster, G-1..G-7, the ledger

### Tertiary (LOW — recorded, not relied on)

- Sketch 173's *"builderStore does not express a step edit as a row edit"* — **REFUTED by
  measurement** (`patchConfig`, `builderStore.ts:548`); recorded so the plan does not inherit it.
- Sketch 174's *"row 5 … derived from the last step"* — **partially refuted**: it is
  `phases.some(...)`, order-independent, plus the workflow name.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Row-by-row control inventory | **HIGH** | Every cell is a `file:line` read this session |
| D-12 predicate audit | **HIGH** | Every gauntlet stage enumerated from source; `lint_workflow` read in full |
| D-13 wire chain | **HIGH** | Both type declarations and all five hops read; the no-`response_model` fact measured |
| D-05 fence | **HIGH** | The baseline file read; its `git log --numstat` history derived |
| D-14 fence shape | **HIGH** | `WF_SCHEMA` × prompt membership computed live; the `template_asset_id` gap grepped |
| Row 5 pricing | **HIGH** | `patchConfig`, `jumpToStep`, `soulDeliverable` all read; `WorkflowSoul` mounts enumerated |
| Row 4 pricing | **HIGH** on the model facts, **MEDIUM** on the re-capture count (A3 — priced from a docblock, not driven) |
| Layout / graphColumn | **HIGH** | The grid class list read directly |
| Validation architecture | **HIGH** on pins and commands, **MEDIUM** on the numbers (they rot; re-derive) |
| G-4 rows | **MEDIUM** | Scenario design is judgement; the provider contrast behind U4 is measured |

**Research date:** 2026-08-18
**Valid until:** ~2026-08-25 (7 days) — this codebase moves fast; five ledger rows went stale in one
day and the count-gate numbers have rotted three times. **Re-derive every number before quoting it.**
