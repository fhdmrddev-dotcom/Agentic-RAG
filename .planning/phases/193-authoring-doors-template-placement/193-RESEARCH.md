# Phase 193: Authoring Doors + Template Placement — Research

**Researched:** 2026-08-13
**Measured at HEAD:** `58a402bc` (`docs(state): record phase 193 context session`)
**Domain:** React/TS frontend copy extraction + a definition-derived three-state predicate
**Confidence:** HIGH on everything measured in-repo and against the live DB; MEDIUM on the one
product question this research escalates (see `## The escalation`).

---

## Summary

This phase is smaller than it looks in three of its four deliverables and **substantially larger
than CONTEXT.md models it in the fourth**.

The three small ones check out exactly as CONTEXT describes. `WorkflowDoorSwitch.tsx` is
385 L / 8 commits / 6 phases as stated; the `doorGroup` extraction seam is already drawn in the
source; `libraryVocabulary.ts` gives a clean flat-`export const` precedent for `doorVocabulary.ts`;
`definition` is already on the wire and already normalized onto `LibraryRow.def`, so **D-16's
"no backend change" is confirmed twice over** — once at `db/workflows.py:289/309/349`, once at
`libraryRow.ts` where the read-shape already lives on every library row. `tsc` is 33, the count
gate is green at `total 3437 · failed 0`, and — unusually for this project — **both count-gate
knobs already cover all five affected suites**, so the two-knob trap does not fire here.

The fourth deliverable, AUTH-03, is where the research changes the phase. The BUILD-CONTRACT and
CONTEXT both state the template signal as *"the definition admits `render_template` in a phase tool
whitelist"*. Measured against 223 live `workflow_definitions` rows, **exactly zero definitions
whitelist `render_template` in `available_tools`** — the real signal is a phase whose
`config.phase_type == "llm_emit"`, and the single registered emitter is `render_template`. That
correction is cheap. The expensive one is behind it: **16 of the 17 published workflows that would
carry the mark already BIND a library template in `definition.assets[]`, and for those the run-time
upload is unreachable code** — `_exec_llm_emit` resolves the bound asset first and
`resolve_template_source` returns on Branch 1 without ever consulting the ephemeral upload. Under
the contract's predicate the phase would print *"needs a template"* on 17 rows, 16 of which need
nothing from the user, and would keep a labelled `Template to fill` control on 17 rows where 16
discard whatever is uploaded. Under the honest predicate (*emit phase AND no bound asset*) the mark
lands on **1 of 145 published rows**. Both numbers are re-derivable; the choice between them is a
product decision, not a research call.

**Primary recommendation:** plan wave 1 exactly as D-08 specifies (it is provable and low-risk), and
**do not plan AUTH-03's predicate until the operator rules on the escalation in `## The escalation`**.
Everything else in the phase can proceed in parallel with that question open.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: The door wording is VARIANT D — "the mix."** B's door NAMES with C's two uppercase TIER
  labels. Everything else in D is variant B verbatim.
- **D-02: Variant D is DERIVED, never re-typed.** `build.cjs` defines `D_FROM_C = {doorA.tier,
  doorB.tier}` and reads B for every other id. **The planner must port column D of the contract's
  COPY table, not re-transcribe strings from this file.**
- **D-03: The header-strip restack is IN SCOPE.** ⚠ The sketch draws NO mockup of it — the
  acceptance bar for the restack is D-04/D-05/D-06, not the sketch page.
- **D-04: The demotion is "quiet escape + divider."** The return control stays in the strip but
  drops its border/box, becomes plain muted text, and gains a divider between it and the door
  label. The `🔒 judge always-on` badge keeps its far-edge position, unchanged.
- **D-05: One component serves BOTH header variants.** ⚠ Care required with the `ml-auto` class
  that is already conditional on `inline`; preserve the character-for-character non-inline class
  list.
- **D-06: Rejected — moving the return control into `headerLead`** (it renders only when `inline`).
- **D-07: ⚠ G-5 FIRES on `WorkflowDoorSwitch.tsx`, and the file is ABSENT from the CLAUDE.md
  hot-file ledger.** 8 commits / 6 phases (124, 155, 184, 184.1, 186, 187) / 385 L. **193 owes it a
  ledger row at close.**
- **D-08: G-5 is honoured BY CONSTRUCTION, in the 192.1 order — the extraction ships FIRST, in its
  own wave.** Wave 1 = pure move, zero text changed, baselines captured on the UNMOVED tree BEFORE
  the move. Wave 2+ = variant D's copy + the D-04 restack.
- **D-09: Rejected — a G-5 override.** No override is recorded for this phase.
- **D-10: The module is `frontend/src/components/workflows/doorVocabulary.ts`.** Deliberately NOT
  under `library/`.
- **D-11: ALL 20 COPY ids move into the module**, including the 2 ids variant D inherits unchanged.
- **D-12: The describe-hint stays THREE NAMED FRAGMENTS composed in JSX** (`frag1/frag2/frag3` as
  plain strings; the component owns the `<b>` markup).
- **D-13: The mark is a PLAIN TEXT SEGMENT in the card's identity line** — muted, separated by the
  same `·`. No chip, no badge, no new colour, no new component.
- **D-14: Slot — after provenance, before recency.** ⚠ Do NOT place it first.
- **D-15: When the wire does not say, render NOTHING — silence, never a guess.** (card)
- **D-16: ⚠ AUTH-03 needs NO backend change — measured, not assumed.**
- **D-17: For a workflow that does NOT fill a template, render NOTHING** in the Run modal. Not
  greyed, not disabled — absent.
- **D-18: The control gains the label `Template to fill`.**
- **D-19: The provenance line stays VERBATIM and moves with the control.**
  `Stored untrusted — never run as code, never fed to the fill engine.` Rewording was REJECTED.
- **D-20: ⚠ THE MODAL'S UNKNOWN-FALLBACK IS THE OPPOSITE OF THE CARD'S, AND THE ASYMMETRY IS
  DELIBERATE.** Unknown ⇒ card renders nothing, modal renders the control exactly as today. ⇒ the
  predicate must be **three-state**, not boolean. Do not "fix" this into consistency.

### Claude's Discretion

- The exact Tailwind classes for the demoted return control and the divider (D-04), within the
  shipped token vocabulary.
- The internal shape of `doorVocabulary.ts` (nested object vs flat keys), provided all 20 ids from
  column D are present and the hint fragments stay separate strings (D-12).
- Whether `DoorHeaderStrip.tsx` also absorbs the door-label `<span>` or only the return control and
  badge — the constraint is D-05, not a specific boundary.
- Test-file placement and naming, following the shipped `WorkflowDoorSwitch.test.tsx` convention.

### Deferred Ideas (OUT OF SCOPE)

- **BUG-260813-01 — the workflow canvas stays DARK in light mode.** Left `open`, routed to
  `/gsd:fast` under G-3. Re-open trigger: any phase touching `WorkflowCanvas.tsx`'s render props.
- **Moving the return control into the breadcrumb (`headerLead`)** — rejected by D-06. Re-open
  trigger: a future phase making the standalone band's breadcrumb unconditional.
- **A refactor phase for `WorkflowCard.tsx`** — 193 makes it the card's 3rd phase. Per G-5 the NEXT
  phase to touch it owes a refactor recommendation first. Not 193's debt.
- **Merging door copy and library copy into one `workflowVocabulary.ts`** — rejected by D-10.
  Re-open trigger: a third vocabulary module on the workflow surface.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim, `.planning/REQUIREMENTS.md:26,28`) | Research Support |
|---|---|---|
| **AUTH-01** | A user can tell the two authoring doors apart and predict what each will do, before choosing. *(SEED-147)* | §B (the 20 COPY strings, their exact line map, and the **21st string the contract does not govern**), §C (column D verbatim), §F (how to prove wave 1 is a pure move), §E (the four suites that assert door copy today) |
| **AUTH-03** | A user can find where to supply a template for a workflow that fills one. *(SEED-110 — the capability shipped in Phase 152; this is placement and discoverability, NOT a rebuild)* | §A (the real admission predicate, measured against 223 live rows), **§The escalation** (the bound-asset finding that changes which rows qualify), §D (both consumer surfaces at file:line, and the two DOM baselines D-17/D-18 will red) |

⚠ **AUTH-03's wording is "where to SUPPLY"**, not "which workflows produce a file". That distinction
is the whole of `## The escalation` below — it is the requirement's own word, not a research gloss.
</phase_requirements>

---

## Corrections to inherited claims

Measured at HEAD `58a402bc`. Every command is given so each row is re-runnable rather than believed.

### Claims that MEASURE TRUE (verified, not assumed)

| Claim | Source | Command | Result |
|---|---|---|---|
| `WorkflowDoorSwitch.tsx` = **385 L / 8 commits / 6 phases** (124, 155, 184, 184.1, 186, 187) | D-07 | `git log --oneline -- <f> \| wc -l`; `wc -l <f>`; `git log --format=%s -- <f> \| sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \| sed -E 's/-.*//' \| sort -u` | **8 · 385 · exactly those six** ✓ |
| `WorkflowCard.tsx` = **7 commits / 747 L**, ledger stale at 6/721 | CONTEXT canonical_refs | same | **7 · 747** ✓ — ledger row is stale as CONTEXT says. (Derivation note: 6 of the 7 are feat/chore, the 7th is `1ae9e4d2 docs(192.1-08)`. Both counts are defensible; the PLAN should quote 7 with this derivation, the habit the `WorkflowsPage.tsx` ledger row keeps.) |
| `RunModal.tsx` = **430 L** | CONTEXT canonical_refs | `wc -l` | **430** ✓ (1 commit, `192-06`) |
| `PublishedWorkflow` at **`api.ts:1364-1386`**, `definition?:` at **`:1368`** | CONTEXT canonical_refs / D-16 | `grep -n "definition?: WorkflowDefinitionJSON"` | **`:1368`**, interface spans **1364–1386** ✓ |
| `definition` is on the SELECT list | D-16 | `grep -n definition backend/app/db/workflows.py` | ✓ at **`:289`** (published), **`:309`** (published + project filter) and **`:349`** (starters) — *three* SELECTs, not one. Claim holds. |
| `headerLead` renders **only when `inline` is true** | D-06 | read `WorkflowDoorSwitch.tsx:202, 221, 321` | ✓ all three sites gate on `inline` |
| `ml-auto` is already conditional on `inline` | D-05 | `WorkflowDoorSwitch.tsx:170` | ✓ `${inline ? "" : "ml-auto "}` on the judge badge |
| `tsc --noEmit -p tsconfig.app.json` baseline = **33** | project standing figure | run it | **33** ✓ |
| The COPY table has **20 ids**, D substitutes **18** | D-11 / D-02 | count the contract table | **20 ids · 18 D-substitutions** ✓ (the 2 inherited are `describe.h1` and `hint.frag3`) |

### Claims that MEASURE FALSE

**C-1 — ⚠ THE `render_template` ADMISSION PREDICATE IS WRONG IN THE BUILD CONTRACT, IN THE SKETCH
README, AND IN CONTEXT.md BY REFERENCE.**
All three say a fill phase *"admits `render_template` in its phase tool whitelist
(`backend/app/services/harness/phase_types.py:388` is the authority)"*. `:388` is real
(`if "render_template" in (whitelist or frozenset()):`) and the whitelist field is
`config.available_tools` (`backend/app/models/harness.py:95, 112`). But measured against every
`workflow_definitions` row in the live local DB:

```
rows with render_template in available_tools:  []          # ZERO, out of 223 rows / 64 phases
llm_emit phases with an explicit emitter key:  79
llm_emit phases relying on the default:         0
```

The live signal is **`phases[].config.phase_type == "llm_emit"`** (79 such phases across the
corpus), whose `emitter` is `"render_template"` in all 79 — and `EMITTER_REGISTRY` has exactly one
entry (`emitters.py:183`, `register_emitter("render_template")`), so an `llm_emit` phase renders a
template *by construction* today. The `available_tools` path is real code (`_exec_llm_agent` /
`_exec_llm_batch_agents`) with **zero live callers**. A predicate written to the contract's letter
would mark **nothing**.

**C-2 — ⚠ THE TWO-BADGE CEILING IS ON THE WRONG CARD.**
D-13 justifies plain text by saying *"the card **structurally forbids a third badge** — an
`@ts-expect-error` control pins it, observed RED at 34 type errors and back at 33 (188.2)"*.
Measured: that control is `PhaseNodeCard.test.tsx:321-345`, guarding `BadgeSlots`, a max-2 tuple on
the **canvas node card** (`components/workflows/PhaseNodeCard.tsx`). Under
`components/workflows/library/` there is **no `BadgeSlots` import, no `@ts-expect-error`, and no
badge ceiling of any kind** (`grep -rn "BadgeSlots\|ts-expect-error" frontend/src/components/workflows/library/`
returns three prose hits about *word-badges* and nothing else). **D-13's conclusion still stands on
its other, stronger ground** — SEED-155 / UAT U8, where sketch 163 drew a chip the library card
could not render — but the planner must not write a task or a fence that claims a typecheck
enforces this on `library/WorkflowCard.tsx`. It does not.

**C-3 — the `jsonb` string-scalar trap is LIVE and is the DOMINANT shape.**
`select jsonb_typeof(definition), count(*) from workflow_definitions group by 1` →
**`string: 194`, `object: 29`**. 120 of 145 *published* rows are string scalars. Any SQL written at
plan or verify time using `definition->'phases'` **silently returns zero rows for 87 % of the
library**. Normalize first: `(definition #>> '{}')::jsonb` (all 194 parse to an object — verified).
**The frontend is unaffected** — `backend/app/api/workflows.py:92-112 _coerce_definition` `json.loads`
a string and hands the wire a dict, so `PublishedWorkflow.definition` is always an object or `null`.
Record this so nobody "discovers" it a third time.

**C-4 — the count-gate `BASELINE_TOTAL` marker comment is stale.**
`scripts/vitest-count-gate.cjs:1520` reads `// ⚠ 3384 (192.1-06)`; the reduce computes **3413** and
the gate prints `pinned total 3413`. Tenth recorded staleness event on that marker. Not this phase's
debt; correct it in passing if a pin is touched anyway.

**C-5 — two CONTEXT.md canonical-ref filenames do not exist.**
`.planning/seeds/SEED-147-authoring-doors-not-legible.md` → the file is
**`SEED-147-workflow-doors-not-legible.md`**. `.planning/seeds/SEED-110-run-time-template-upload.md`
→ **`SEED-110-workflow-runtime-template-file-upload.md`**. Nothing typechecks prose.

**C-6 — CLAUDE.md's `PhaseNodeCard.tsx` ledger row says "badge slot 1 is still EMPTY and reserved
for 189 (D-12)".** `canvasModel.ts:139` now reads *"both badge slots are now SPENT"* (189-13 spent
it). Out of 193's scope; recorded so a future reader does not plan against an empty slot.

**C-7 — CLAUDE.md's `libraryVocabulary.ts` figure (`223 → 439`) measures 448**, and the 188.1 row's
`eslint src/components/workflows/` figure (`6 → 5`) measures **10**. Both out of scope; both stated
rather than smoothed.

---

## Project Constraints (from CLAUDE.md)

| Directive | How it binds 193 |
|---|---|
| **G-2 sketch before plan for UX** | **SATISFIED** — sketch 164, operator picked variant D (`20ca7cf7`). ⚠ But see `## Where the acceptance bar does NOT reach` — the sketch covers 1 of 4 deliverables. |
| **G-5 refactor between feature waves** | **FIRES** on `WorkflowDoorSwitch.tsx`. Honoured by construction via D-08's wave order. **193 owes a ledger row at close** with re-derivable figures. |
| **G-4 lived-experience UAT** | Owed. Operator-defined "I'd recognize failure here" rows, driven by looking, never by `getElementById` (D-27). |
| **G-3 lightweight commands** | Does not apply — this is multi-file with new modules. |
| **G-7 gap-closure round cap** | N/A at first planning pass. Run `node scripts/check-gap-closure-rounds.cjs 193` if `gaps_found` ever returns. |
| **Worktrees ENABLED** | Every worktree runs `bash scripts/bootstrap-worktree.sh "$(pwd)"` FIRST. `GSD_VITEST_MAX_WORKERS=4`, **≤ 2 concurrent vitest runs** (at 3 the gate goes non-deterministic — measured in 192-05). Assert the dispatched base SHA in every executor prompt: 12 of 12 worktrees in Phase 192 forked from the wrong base. **Never `rm -rf` a worktree** — `bash scripts/teardown-worktree.sh`. |
| **UAT scoreboard recipe** | The 4-axis cross-provider board is **NOT triggered** — no streaming, agent loop or provider routing. G-4 rows are. |
| **Reported-bugs cross-check** | Done at discuss-time: BUG-260813-01 left `open`, routed to `/gsd:fast`, NOT folded. No other `surface: Agentic-RAG` open report overlaps `affected_areas` with the doors or the library card. |
| **No LangChain / no LangGraph / Pydantic for structured output** | Not touched — this phase writes no backend code. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Door copy (20 strings) | Browser / Client | — | Pure presentation. Lives in a `.ts` leaf so `react-refresh/only-export-components` (an ACTIVE error in this repo — 10 hits in `components/workflows/`) does not fire on a component file. |
| Header-strip layout (D-04) | Browser / Client | — | Tailwind class change inside one extracted component. |
| `render_template` admission predicate | Browser / Client | API (read-only) | The API already projects `definition`; the derivation is a pure function over data the client already holds (`LibraryRow.def`). **No backend tier owns any part of this.** |
| Template mark on the card | Browser / Client | — | One text segment in an already-composed line. |
| Run-modal label + render condition | Browser / Client | — | Presentation only. The upload path (`POST` → `kind='template_input'`, `workspace.py:281`) is untouched. |

**Nothing in this phase crosses a tier boundary.** D-16 is confirmed from both ends: the SELECT list
projects `definition` (`db/workflows.py:289/309/349`), and `libraryRow.ts` already normalizes it onto
`LibraryRow.def: DefShape | undefined` for the shipped *Makes a file* and *Strict* chips.

---

## A. The `render_template` admission predicate

### A.1 The definition-side field name — re-derived, not trusted

Two paths exist in the backend. Only one is live.

| Path | Definition-side shape | Authority | Live rows |
|---|---|---|---|
| **Tool whitelist** | `phases[].config.available_tools: string[]` containing `"render_template"` | `models/harness.py:95` (`LlmAgentPhaseConfig`), `:112` (`LlmBatchAgentsPhaseConfig`); consumed at `phase_types.py:388` | **0 of 223** |
| **Emit phase** | `phases[].config.phase_type == "llm_emit"`, with `config.emitter` (default `"render_template"`, `models/harness.py:156`) | `phase_types.py:1193 _exec_llm_emit`; `emitters.py:183` registers the ONLY emitter | **79 phases** across 78 rows |

`EMITTER_REGISTRY` has exactly one entry (`grep -n register_emitter backend/app/services/harness/emitters.py`
→ one call site at `:183`), so **today `phase_type == "llm_emit"` ⟺ renders a template**. The
`emitter` key is explicitly present on all 79 live phases, but the Pydantic default means a
definition may omit it — and **the shipped `RunModal.test.tsx` fixtures do omit it**
(`boundPublished` / `unboundPublished` at `:70-96` declare
`config: { phase_type: "llm_emit", citation_policy: "draft" }` and no `emitter`). A predicate that
*required* an explicit `emitter === "render_template"` would read those fixtures as non-admitting
and blow up all six whole-`innerHTML` baselines. **Treat an absent `emitter` on an `llm_emit` phase
as `"render_template"`, matching the model default.**

### A.2 Live-data verification (psycopg2 → `127.0.0.1:54322`, `backend/venv/Scripts/python.exe`)

⚠ **The string-scalar trap fired on the first query and is reported rather than worked around.**
`jsonb_object_keys(definition)` raised `InvalidParameterValue: cannot call jsonb_object_keys on a
scalar`. Shape census:

```
jsonb_typeof(definition):   string 194  ·  object 29        (223 rows total)
of the 194 strings:         all 194 parse to an OBJECT via (definition #>> '{}')::jsonb
published rows:             145   (120 string · 25 object)
```

Normalizing every row in Python and counting phase types:

```
llm_agent 27 · llm_single 17 · llm_emit 12 · llm_human_input 3 · programmatic 2 ·
llm_batch_agents 2 · external_action 1        (object rows only — 64 phase elements)
```

Across ALL 223 normalized rows: **79 `llm_emit` phases**, **0 `available_tools` hits**,
**74 `assets[]` entries, every one `kind: "template"`**.

### A.3 Candidate predicates, scored against the live library

| Predicate | Published: admits / no / unknown | All 223 rows |
|---|---|---|
| **P1** — contract's letter (`available_tools` ∋ `render_template`) | **0 / 145 / 0** | 0 / 223 / 0 |
| **P1′** — emit phase present | **17 / 128 / 0** | 79 / 144 / 0 |
| **P1″** — emit phase present, `phases: []` ⇒ unknown | **17 / 18 / 110** | 79 / 34 / 110 |
| **P2** — emit phase present **AND** no bound `assets[kind=="template"]` | **1 / 144 / 0** | 6 / 217 / 0 |

The single P2-admitting published row is `ephemeral-template-fill-101uat`. The 16 P1′ rows P2
excludes are `compliance-gap-report*`, `risk-register*`, `weekly-status-report*`, `pm-*`, `sc10-*`,
`slack-connector-uat-190`, `multitool-risk-fill-db50b21c` — all of them carrying
`assets: [{kind: "template", asset_id: "…/_library/….docx", …}]`.

⚠ **`phases: []` is 110 of 145 published rows (76 %).** Under P1′ those read as a positive *"does
not fill a template"*, which under D-17 **removes the shipped upload control from 110 published
rows** whose definition is a stub that was never authored. P1″ routes them to `unknown`, where D-20
keeps the control. The planner must decide this arm explicitly — it is not a detail.

### A.4 ⚠ The escalation — a bound template means the upload is dead code

This is the finding that most changes how the phase should be planned, and it is measured rather
than argued.

```
phase_types.py:1246   asset_ref = _emit_bound_asset_ref(definition)
phase_types.py:1255   src = await resolve_template_source(..., asset_ref=asset_ref, ...)

template_asset_service.py:143   # ── Branch 1: Library AssetRef (trusted → docxtpl) ──
template_asset_service.py:144   if asset_ref is not None:
                                     ... return _result(bytes=data, provenance="library", ...)
template_asset_service.py:194   # ── Branch 2: Ephemeral upload (untrusted → run_replace) ──
```

`_emit_bound_asset_ref` (`phase_types.py:861-878`) returns the first
`definition.assets[]` entry with `kind == "template"`. When it returns non-`None`, Branch 1
**returns unconditionally** — Branch 2, the `kind='template_input'` upload the Run modal stages, is
never reached. `grep -n asset_ref backend/app/services/harness/phase_types.py` shows five hits and
**no override path**: nothing clears `asset_ref` because a user uploaded something.

⇒ For the 16 published rows that bind a library template, `Template to fill` + an upload control is
a **promise the engine discards**, and `· needs a template` on the card is **false** — the workflow
already has its template.

⇒ AUTH-03's own wording is *"a user can find where to **supply** a template for a workflow that
fills one"*. P2 answers that question. P1′ answers a different one (*"which workflows produce a
file"*) — and that question is **already answered on this exact surface**: `soulDeliverable(def).kind
=== "file"` is `phases.some(p => p.config?.phase_type === "llm_emit")`, byte-for-byte the P1′
predicate, and it already drives the shipped ***Makes a file*** chip
(`libraryFilter.ts:173`). **Under P1′ the new mark would be true on exactly the rows the *Makes a
file* chip already selects — a second word for a fact the surface already states.**

**Recommendation to the planner:** put this to the operator before writing the predicate task.
Frame it with the two numbers (17 rows vs 1 row) and the two consequences (a mark that misinforms on
16 rows vs a mark that is almost never visible). A defensible third option exists and should be
offered: **two states, not one** — *"needs a template"* when P2 admits, *"fills a template"* (or
nothing) when an emit phase is bound. That costs one extra string and is the only reading in which
both the card and the modal are honest on all 145 rows.

### A.5 How the card derives its tier today (the pattern to sit beside, not duplicate)

`WorkflowCard.tsx` does **not** call `deriveTier` directly. The derivation lives one layer out:

```ts
// frontend/src/components/workflows/library/libraryFilter.ts:173-175
"makes-a-file": (row: LibraryRow) => soulDeliverable(row.def).kind === "file",
strict:         (row: LibraryRow) => tierForDefinition(row.def).id === TIERS.STRICT.id,
```

and both helpers live in `frontend/src/components/workflows/soulData.ts`:

```ts
// soulData.ts:67-82 — the loose read-shape
export interface DefShape {
  name?: string | null
  business_requirement?: string | null
  project_folder_id?: string | null
  inputs?: Array<{ key?: string }> | null
  input_keys?: string[] | null
  phases?: Array<{
    slug?: string; phase_index?: number; name?: string | null
    config?: { phase_type?: string; citation_policy?: string; [k: string]: unknown }
    validators?: Array<{ kind?: string }> | null
  }> | null
  [k: string]: unknown
}

// soulData.ts:161-171 — the nearest neighbour to the new predicate
export function soulDeliverable(def: DefShape | null | undefined): SoulDeliverable {
  const phases = def?.phases ?? []
  const hasEmit = phases.some((p) => p.config?.phase_type === "llm_emit")
  if (!hasEmit) return { kind: "chat" }
  ...
}
```

`libraryFilter.ts`'s own header states the rule the new predicate must obey: *"derive, do not
re-implement"* (`:19-20`).

### A.6 Recommended home and signature

**Home: `frontend/src/components/workflows/soulData.ts`**, immediately after `soulDeliverable`.

Why there and not `doorVocabulary.ts` or a new `library/` leaf:
- `DefShape` is declared there and is the argument type. A predicate elsewhere either re-imports
  `DefShape` (fine) or re-declares it (the drift `libraryFilter.ts:19` forbids by name).
- **Both consumers can import it.** `library/WorkflowCard.tsx` and `library/RunModal.tsx` already
  import from `@/components/workflows/soulData` (`RunModal.tsx:60`,
  `libraryRow.ts` imports `DefShape` from it). Fence **F4** forbids anything under `library/` naming
  a `WorkflowsPage` specifier — `soulData.ts` is not that, and is already imported across the fence.
- `soulData.ts` is a `.ts` leaf with no component export, so `react-refresh/only-export-components`
  cannot fire.
- `soulData.test.ts` exists and is pinned at **17** — an obvious, already-covered home for the new
  cases.

**Signature — three-state, per D-20:**

```ts
/** D-15 / D-20: three states, because the card and the Run modal fall back OPPOSITE ways.
 *  A boolean cannot express D-20 — `false` there would strip a shipped capability. */
export type TemplateAdmission = "admits" | "does-not-admit" | "unknown"

export function templateAdmission(def: DefShape | null | undefined): TemplateAdmission
```

Consumers, stated so the asymmetry is legible at both call sites:

```ts
// WorkflowCard.tsx  (D-15 — silence on anything but a positive yes)
const mark = templateAdmission(row.def) === "admits"

// RunModal.tsx      (D-20 — hide ONLY on a positive no)
const showTemplate = templateAdmission(def) !== "does-not-admit"
```

⚠ **Do not model this as a boolean with a `?? true` at one call site.** `soulDeliverable` is the
cautionary precedent right above it: it collapses `null` and `{phases: []}` into the same
`{kind:"chat"}` answer, which is correct for a *deliverable* label and would be a D-20 violation
here.

---

## B. The extraction seams (wave 1 must be provable as a pure move)

All line numbers re-derived at HEAD `58a402bc` against `frontend/src/components/workflows/WorkflowDoorSwitch.tsx`
(385 L). **No number below is copied from CONTEXT.md.**

### B.1 The header-strip spans — there are THREE bands, not two

| # | What | Lines | Notes |
|---|---|---|---|
| 1 | `doorGroup` docblock | **145–155** | Explains the `ml-auto` conditional; must travel with the code |
| 2 | `doorGroup` JSX fragment | **156–175** | `const doorGroup = ( <> … </> )` — back button `158–165`, door label `166`, judge badge `167–173` |
| 3 | Govern **standalone** band | **179–181** | `{!inline && (<div className="flex items-center gap-3 border-b border-border px-4 py-2">{doorGroup}</div>)}` |
| 4 | Govern **inline** pass-through | **202** | `{...(inline ? { headerLead, headerTrail: doorGroup } : {})}` |
| 5 | **Describe-door band** | **214–231** | Its OWN JSX. `{inline && headerLead}` at `221`, an identically-classed `‹ both doors` button at `222–229`, the `⚡ Describe & run` label at `230`. **Not `doorGroup`.** |
| 6 | Chooser breadcrumb band | **321–323** | `{inline && headerLead && (<div …>{headerLead}</div>)}` |

⚠ **D-05 names only bands 3 and 4.** Band 5 carries the same `‹ both doors` control with the same
class list and the same peer-reading problem, minus the judge badge. The COPY change *must* reach it
(the contract's `strip.back` row says *"the return control, **BOTH open doors**"*), but D-04's
restack is specified only for the govern strip. **The planner must resolve whether the D-04 demotion
applies to band 5 too.** Leaving it un-restacked ships two visually different return controls one
click apart; restacking it is a change with no mockup and no decision behind it.

### B.2 The `inline` prop — what it actually changes

`inline` appears at `88, 92, 103, 147, 151, 153, 170, 179, 199, 202, 215, 221, 318, 321`
(prose at 88/92/147/151/153/199/215/318). The four behavioural sites:

| Line | Effect |
|---|---|
| `170` | `${inline ? "" : "ml-auto "}` on the judge badge — the ONE class-level branch |
| `179` | `{!inline && …}` — the standalone band renders only when NOT inline |
| `202` | spread-conditional `{ headerLead, headerTrail: doorGroup }` — genuinely ABSENT when not inline |
| `221`, `321` | `{inline && headerLead}` — **D-06's claim VERIFIED**: `headerLead` renders only under `inline` |

**Why `ml-auto` is dropped when inline, mechanically:** `BuilderHeaderBar.tsx:53` already wraps
`trail` in `<div className="ml-auto flex shrink-0 items-center gap-2">`. A second `ml-auto` inside an
already-right-aligned flex group opens a gap. This is not folklore — it is one grep away and the
extracted component must reproduce it.

### B.3 The 20 COPY ids, current shipped strings, and their line

| id | current shipped string | line(s) |
|---|---|---|
| `chooser.h1` | `How do you want to build this?` | **325** |
| `chooser.sub` | `Pick the fast path or full control — nothing is locked, you can switch anytime.` | **327** |
| `doorA.tier` | `loose · fastest path` | **342** |
| `doorA.name` | `Describe &amp; run` | **344** |
| `doorA.desc` | `Say what recurring work this should do — the AI drafts the phases and sets the strictness.` | **346** |
| `doorA.note` | `nothing locked — switch to Author &amp; govern anytime` | **352** |
| `doorB.tier` | `power · full control` | **367** |
| `doorB.name` | `Author &amp; govern` | **369** |
| `doorB.desc` | `Open the full Builder — every advanced control, the live strictness tier, the locked judge.` | **371** |
| `doorB.note` | `citation policy · gate set · per-phase scope &amp; model` | **377** |
| `strip.back` | `‹ both doors` | **164 AND 228** ⚠ two JSX sites, one id |
| `strip.label` | `⚡ Describe &amp; run` | **230** |
| `describe.h1` | `What recurring work should this automate?` | **240** |
| `describe.cta` | `Draft the workflow` | **276** |
| `hint.frag1` | `drafts the phases` | **280** |
| `hint.frag2` | `sets the strictness` | **281** |
| `hint.frag3` | `asks about anything it had to guess` | **282** |
| `switch.prompt` | `Need citation policy, gates, or per-phase scope?` | **291** |
| `switch.cta` | `Author &amp; govern ›` | **298** |
| `soul.label` | `This workflow's soul` | **305** |

**The count is 20** ✓ and it is a *count of ids*, not of JSX sites — `strip.back` is one id at two
sites, which is precisely the drift the vocabulary module removes.

### B.4 ⚠ THE 21ST STRING — the govern strip label is NOT in the contract

`WorkflowDoorSwitch.tsx:166` renders
`<span className="text-[13px] font-medium text-foreground">🔧 Author &amp; govern</span>` —
the current-door label inside the **govern** strip. The COPY table's `strip.label` row is scoped
*"describe-door header — the current-door label `<span>`"*. There is no `strip.labelGovern` row.

It was never captured either: `dom.generated.json` has exactly three keys —
`["chooser", "describe", "runModal"]` — and the sketch's emitter never renders the govern door.

**Consequence, stated plainly:** after variant D ships, the words *"Author & govern"* survive in
**exactly one place in the product — the govern door's own header strip** — while the door card that
opens it says *"Build it myself"* and the switch-strip CTA says *"Build it myself ›"*. That is the
inverse of the AUTH-01 failure SEED-147 reports: a control whose name does not match the door it
belongs to. And `BuilderHeaderBar.tsx:16-18` specifically documents preserving *"the `🔧 Author &
govern` label that the plan's illustrative row sketch omitted"* — so it is load-bearing prose
somewhere else too.

**The planner cannot invent a replacement**: D-02 forbids re-typing strings outside column D, and
neither B nor C declares this id. **Escalate.** The cheap fix is a `strip.labelGovern` row added to
`build.cjs`'s COPY table with a B value and a re-run of `node build.cjs && node assemble.cjs` — the
contract regenerates, the audit re-verifies, and the operator picks one string. The alternative is
to leave `🔧 Author & govern` and record the inconsistency as a deliberate deviation.

### B.5 Strings in the file the contract does NOT govern (do not silently move them)

`Open ›` (`349`, `374`), the textarea `aria-label="business requirement"` (`244`), its placeholder
(`248`), the judge badge's `title` attribute (`169`), `🔒 judge always-on` (`172`), and the hint's
non-bold connective text (`279, 281, 282`). D-11 says *"ALL 20 COPY ids"* — these are not among
them. Moving them is scope the contract's audit cannot verify.

### B.6 Who imports `WorkflowDoorSwitch`

**Exactly one production importer.**

```
frontend/src/pages/WorkflowsPage.tsx:99    import { WorkflowDoorSwitch } from "@/components/workflows/WorkflowDoorSwitch"
frontend/src/pages/WorkflowsPage.tsx:785   <WorkflowDoorSwitch … {...(canvasEnabled ? { inline: true, headerLead: breadcrumbGroup } : {})} … />
frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx:39   (the suite)
```

Every other file matching the name (`BuilderHeaderBar.tsx`, `DescribeKbPicker.tsx`, `PhaseNode.tsx`,
`PhaseNodeCard.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowBuilderPage.header.test.tsx`,
`WorkflowsPage.test.tsx`) mentions it **in prose comments only** — verified by grepping for the
import specifier rather than the identifier.

`inline` is fed by `canvasEnabled`, so the **standalone** band (the one whose bytes are pinned) is
the **flag-OFF** path.

### B.7 `libraryVocabulary.ts` export shape (the D-10 precedent to mirror)

448 L, and the shape is **flat, one named `export const` per string, SCREAMING_SNAKE, one docblock
each** — plus three `as const satisfies Record<…>` tables and four small functions:

```ts
export const FORK_VERB = "Make my own copy"                       // :78
export const SEARCH_LABEL = "Search workflows"                    // :158
export const OWN_YOURS: (typeof CHIP_WORDS)["yours"]["label"] = "Yours"   // :256
export const CHIP_WORDS = { … } as const satisfies Record<ChipId, ChipWord>  // :52
export function forkFailedMessage(name: string, conflict: boolean): string   // :149
```

Its header states the governing rule: *"EVERY USER-FACING STRING ON THE LIBRARY SURFACE, IN ONE
HOME. The words are LOCKED in `192-CONTEXT.md` and MIRRORED here"* — the same relationship
`doorVocabulary.ts` will have to the BUILD-CONTRACT.

⚠ **The AUTH-03 strings are LIBRARY strings, not door strings.** `card.templateMark` renders in
`library/WorkflowCard.tsx` and `run.templateLabel` in `library/RunModal.tsx`, both inside the
fence-swept `library/` subtree whose one-home rule is `libraryVocabulary.ts`. **They belong there,
not in `doorVocabulary.ts`.** D-11's "all 20" is the doors table only.

---

## C. The sketch's BUILD-CONTRACT — column D verbatim

`.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md`, table at `:31-52`.
**Port this column. Do not re-transcribe from CONTEXT.md (D-02).**

| id | **D · THE PICK** |
|---|---|
| `chooser.h1` | `How do you want to start?` |
| `chooser.sub` | `Both end up in the same place. You can switch between them at any time.` |
| `doorA.tier` | `you write one paragraph` ⬅ **from C** |
| `doorA.name` | `Draft it for me` |
| `doorA.desc` | `Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.` |
| `doorA.note` | `you can open the full editor at any point — nothing is locked in` |
| `doorB.tier` | `you decide every setting` ⬅ **from C** |
| `doorB.name` | `Build it myself` |
| `doorB.desc` | `Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step.` |
| `doorB.note` | `what it must cite · required checks · per-step sources & model` |
| `strip.back` | `‹ Change how I start` |
| `strip.label` | `⚡ Drafting it for you` |
| `describe.h1` | *(inherit — `What recurring work should this automate?` unchanged)* |
| `describe.cta` | `Write the first draft` |
| `hint.frag1` | `writes the steps` |
| `hint.frag2` | `sets how strict it is` |
| `hint.frag3` | `asks about anything it had to guess` *(same as shipped — inherited, still an id)* |
| `switch.prompt` | `Need to set citations, checks, or per-step sources yourself?` |
| `switch.cta` | `Build it myself ›` |
| `soul.label` | `What this will do` |

**Composed hint, variant D (contract `:62`), so the build composes rather than guesses:**

> You describe the goal — the AI **writes the steps**, **sets how strict it is**, and **asks about
> anything it had to guess**.

The non-bold connectives (`You describe the goal — the AI `, `, `, `, and `, `.`) stay in JSX per
D-12; only the three fragments are data.

**Substitution audit** (contract `:80-82`): B 18 matched / 0 missed · C 19 / 0 · **D 18 / 0**.
20 ids − 2 inherited (`describe.h1`, `hint.frag3`) = 18. Arithmetic checks.

### C.1 The AUTH-03 rows, verbatim (contract `:71-76`)

| id | status | where | text | rule |
|---|---|---|---|---|
| `card.templateMark` | **NEW** | `library/WorkflowCard.tsx` — a mark in the row's existing provenance region | `needs a template` | Rendered when, and ONLY when, the definition admits `render_template` in a phase tool whitelist (`backend/app/services/harness/phase_types.py:388` is the authority). Absent — not greyed, not disabled — otherwise. |
| `run.templateLabel` | **NEW** | `library/RunModal.tsx` — a label above `testid="run-template-upload"` | `Template to fill` | Only for a workflow whose definition admits `render_template`. Turns a nameless quiet button into a named, expected input. |
| `run.templateAbsent` | **CHANGE** | `library/RunModal.tsx` — the wrapper around `testid="run-template-upload"` | *(control not rendered)* | TODAY the upload renders on EVERY workflow unconditionally. The ~100 rows that never fill a template each carry a control they cannot use, which is the discoverability problem inverted. Proposal: render nothing for them. |
| `run.provenance` | **SHIPPED — keep verbatim** | `library/RunModal.tsx` — `testid="run-provenance"` | `Stored untrusted — never run as code, never fed to the fill engine.` | This sentence is load-bearing security honesty from Phase 152 (a `template_input` file is NEVER routed to the Jinja engine). It must survive any promotion of the control unchanged. |

⚠ Two of these four rows' `rule` cells rest on the predicate corrected in **C-1** above, and
`card.templateMark`'s "~100 rows" figure is a sketch-time estimate — measured, it is **128 of 145
published rows** under P1′, or **144 of 145** under P2.

### C.2 Contract rows marked SHIPPED · keep verbatim

Only **one**: `run.provenance`. Confirmed byte-exact against the live source —
`RunModal.tsx:359` reads `Stored untrusted — never run as code, never fed to the fill engine.`
(em dash `—`, one space either side, terminal full stop). D-19 is satisfied by not touching it.

### C.3 ⚠ Which contract strings the real component cannot render (the SEED-155 check)

Every string in the 20-row COPY table **is renderable** — the doors panel is the real component's
DOM (`dom.generated.json` was captured by `emit.test.tsx.src` rendering the real
`WorkflowDoorSwitch`), and `build.cjs` verifies each substitution matched that DOM (D: 18/0).
For the doors, sketch drift is impossible by construction.

**The AUTH-03 half carries the full SEED-155 risk, and it is worse than "a proposal with a mockup":**

- The sketch's `template` tab renders the **real `RunModal` DOM** with prose beside it
  (`build.cjs:268-278`). It draws **no picture at all** of `Template to fill`, of the hidden
  control, or of `· needs a template` on the card.
- So `card.templateMark`, `run.templateLabel` and `run.templateAbsent` have **no visual acceptance
  bar of any kind**. They are table rows, not mockups.
- This is the *same* structural exposure as U8 — a specified atom with nothing rendered to check it
  against — differing only in that 164 does not draw a wrong picture, it draws none.

One concrete renderability hazard worth naming now: the shipped file input is
`className="hidden" tabIndex={-1} aria-label="Upload template file"` (`RunModal.tsx:307-314`).
`Template to fill` must therefore be a **text node** (a `<p>`/`<span>`), **not** a
`<label htmlFor>` — a label bound to a `hidden`, `tabIndex={-1}` input is an a11y regression, and
`RunModal.a11y.test.tsx` is pinned at 16 and will notice.

---

## D. The two consumer surfaces

### D.1 `library/RunModal.tsx` (430 L) — the template block

| Element | Line(s) |
|---|---|
| **The whole block wrapper** (what D-17 conditionally removes) | **306–361** — `<div className="flex flex-col gap-1.5">` … `</div>` |
| Hidden file input, `aria-label="Upload template file"`, `tabIndex={-1}` | **307–315** |
| Staged-file card `data-testid="run-template-file"` + `aria-label="Remove template"` | **316–335** |
| The button `data-testid="run-template-upload"` | **337–352** |
| Submitting label `{submitting ? "Uploading…" : "Upload template"}` | **350** |
| `data-testid="run-upload-error"` `role="alert"` | **353–357** |
| **`data-testid="run-provenance"`** | **358–360**, string at **359** |
| Where D-18's label goes (immediately inside the wrapper, above the input) | insert at **307** |
| `const def = wf.definition as DefShape | undefined` — the predicate's input, already in scope | **90** |

**Provenance string, byte-exact:** `Stored untrusted — never run as code, never fed to the fill engine.`

⚠ **`launchError` is NOT template-only, and hiding the wrapper hides it.**
`handleRun` (`:184-200`) does `setLaunchError(e instanceof Error ? e.message : "Run failed")` on
**any** `onRun` rejection — the comment at `:111-113` describes it as the upload 422 because that is
its commonest cause, but a scope failure, a network failure or any other launch error lands in the
same node at `:353-357`, **inside the wrapper D-17 removes**. If the block is hidden, a launch
failure on a non-template workflow becomes silent. That is precisely the WR-03 defect Phase 192's
gap round had to repair on this same page. **The plan must either lift `run-upload-error` outside
the conditional wrapper or prove no non-template rejection can reach it.**

### D.2 `library/WorkflowCard.tsx` (747 L) — the identity line

```tsx
// :543-561
<div data-testid="row-identity" className={IDENTITY_CLASSES}>
  <span className={owned ? IDENTITY_OWN_YOURS : IDENTITY_OWN_SHARED}>{identity.own}</span>
  {identityParts.map((part, index) => (
    <Fragment key={`${index}-${part}`}>
      <span aria-hidden="true">{IDENTITY_SEPARATOR}</span>
      <span>{part}</span>
    </Fragment>
  ))}
</div>

// :498-502
const identityParts: string[] = [
  ...identity.segs,
  ...(identity.ofN === null ? [] : [identity.ofN]),
  ...(identity.when === null ? [] : [identity.when]),
]
```

- `IDENTITY_SEPARATOR = "·"` at **`:307`**. Separators are emitted **between** present parts and
  nowhere else — `null`s are dropped in `identityParts`, never rendered as blanks (`:492-497`).
- **Child order verified.** `WorkflowCard.test.tsx:598-618` asserts the node is
  `column.children[1]` (0-based) inside the `min-w-0` column — i.e. **DOM position 2, 1-based**,
  which is what D-14 means. `children[0]` is the name row, `children[2]` the folder chip.
  A planner writing `children[2]` for the identity line will be wrong.
- **D-14's slot is ambiguous as written and must be pinned.** The full grammar is
  `own · segs… · ofN · when`. "After provenance, before recency" is satisfied by **any** index in
  `identityParts` before `when`. The CONTEXT example (`Yours · needs a template · changed 2 months ago`)
  cannot disambiguate, because that row has no `segs` and no `ofN`. **Recommend index 0 of
  `identityParts`** (immediately after `own`), because it reads *whose it is · what it needs · which
  copy · when* and keeps `when` last where 192.1 put it.
- **The card computes some things from `row` and none about slugs/versions.** `CHIP_PREDICATES.yours(row)`
  is computed in-card at `:484`; `row.def` is already on the row type. So calling
  `templateAdmission(row.def)` in the card is consistent with shipped practice and needs **no new
  prop**. The alternative — a field on `RowIdentity` — is a category error (`identity` is defined as
  *"a property of the row's place in the LIST"*, `:391-397`) and forces `rowIdentity.ts` to learn
  about definitions.
- **The 188.2 two-badge ceiling does NOT apply here** — see correction **C-2**. D-13's plain-text
  ruling is still right, on SEED-155 grounds.

**Blast radius on the card's own suite:** `WorkflowCard.test.tsx` (1132 L, pinned **80**) has an
`identityParts(node)` helper asserting the full ordered text array
(`:632-649`, e.g. `[OWN_SHARED, "Copy of … starter", STATE_DRAFT, "43 share this name", "changed 2 months ago"]`).
Any new segment reds those grammar cases — which is correct, and is the right place to pin the new
order.

---

## E. Test topology and the gates this phase must not break

### E.1 Measured baselines to pin against

| Gate | Command | **Measured at `58a402bc`** |
|---|---|---|
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` | **33 errors** |
| ESLint (workflows subtree) | `cd frontend && npx eslint src/components/workflows/` | **10 errors, 0 warnings**, in 5 files: `BuilderStoreProvider.tsx` 3, `ConnectionPicker.tsx` 4, `FlowEdge.tsx` 1, `SelectedPhaseSlugContext.tsx` 1, `StepTypePicker.test.tsx` 1 |
| ESLint (the 5 touched files) | `npx eslint …DoorSwitch.tsx …WorkflowCard.tsx …RunModal.tsx …libraryVocabulary.ts …soulData.ts` | **0 / 0** — clean, so any new error is this phase's |
| Count gate | `cd frontend && GSD_VITEST_MAX_WORKERS=4 node ../scripts/vitest-count-gate.cjs` | **exit 0** · `total 3437` · `failed 0` · `pinned total 3413` · `64/64 pinned files` · drift `+24` |

The `+24` is the four known pre-existing drifted pins (`ExternalActionSection` +9,
`PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5, `builderStore` +6). **Not 193's debt** — this
would be the ninth consecutive plan to decline it for the same reason.

### E.2 Suite inventory and pins

| Suite | L | `it(`/`it.each` | **BASELINE pin** | In TARGETS? |
|---|---|---|---|---|
| `components/workflows/WorkflowDoorSwitch.test.tsx` | 418 | 23 / 0 | **23** | ✓ via directory `src/components/workflows` |
| `components/workflows/library/WorkflowCard.test.tsx` | 1132 | 63 / 6 | **80** | ✓ (same directory entry) |
| `components/workflows/library/librarySubtree.fences.test.ts` | 968 | 31 / 11 | **118** | ✓ (same) |
| `components/workflows/soulData.test.ts` | — | — | **17** | ✓ (same) |
| `pages/__tests__/RunModal.test.tsx` | 807 | 27 / 0 | **32** | ✓ named explicitly |
| `pages/__tests__/RunModal.a11y.test.tsx` | 398 | 16 / 0 | **16** | ✓ named explicitly |
| `pages/WorkflowBuilderPage.header.test.tsx` | — | — | **32** | ✓ named explicitly |
| `pages/WorkflowBuilderPage.describe.test.tsx` | — | — | **19** | ✓ named explicitly |
| `pages/WorkflowBuilderPage.canvas.test.tsx` | — | — | **128** | ✓ named explicitly |
| `pages/WorkflowsPage.test.tsx` | — | — | **52** | ✓ named explicitly |

**⚠ The two-knob trap does NOT fire on this phase — the first time in nine phases.** Every affected
suite is in **both** knobs. `TARGETS[0]` is the directory `"src/components/workflows"`, which sweeps
`WorkflowDoorSwitch.test.tsx`, everything under `library/`, and any **new** suite dropped there.
A new suite will therefore RUN but be UNPINNED until added to `BASELINE`; the plan must add it in the
same commit.

### E.3 ⚠ THE BLAST RADIUS CONTEXT.md DOES NOT NAME — four suites assert door copy, three of them
outside `components/workflows/`

`grep -rln "both doors\|Describe & run\|Author & govern\|Draft the workflow\|How do you want to build this\|This workflow's soul" frontend/src --include=*.test.tsx --include=*.test.ts`:

| Suite | hits | Why it matters |
|---|---|---|
| `components/workflows/WorkflowDoorSwitch.test.tsx` | 4 | expected — CONTEXT names it |
| `pages/WorkflowBuilderPage.describe.test.tsx` | 7 | **not named in CONTEXT** |
| `pages/WorkflowBuilderPage.canvas.test.tsx` | 2 | **not named in CONTEXT**; also the known-flaky suite (2/14 ≈ 14 %, STATE.md wave 8) |
| `pages/WorkflowBuilderPage.header.test.tsx` | 7 | **not named in CONTEXT — and it holds a byte-exact `innerHTML` literal of the entire `doorGroup` band** |

**`WorkflowBuilderPage.header.test.tsx:304` is the single biggest landmine in this phase.** It pins:

```
<div class="flex items-center gap-3 border-b border-border px-4 py-2"><button type="button"
data-testid="both-doors" class="rounded-md border border-border px-2.5 py-1 text-[13px]
text-muted-foreground hover:text-foreground">‹ both doors</button><span class="text-[13px]
font-medium text-foreground">🔧 Author &amp; govern</span><span data-testid="judge-locked"
title="…" class="ml-auto inline-flex …">…🔒 judge always-on</span></div>
```

— the full class list, the door label, the `ml-auto`, and the judge badge's `title`. It is consumed
at `:311` and `:321` (two assertions), plus `:352`
`getByRole("button", { name: "‹ both doors" })` and `:249` `toContain("‹ both doors")`.

Consequences the plan must encode:
1. **Wave 1 (pure move) must leave this literal GREEN with zero edits.** That is the strongest
   available proof the extraction was verbatim — better than any baseline 193 could author, because
   it predates the phase entirely.
2. **Wave 2 WILL red it** — twice, on the copy change and again on the D-04 restack. That re-capture
   is legitimate and must be recorded as a deliberate one-time re-capture with the reason, never a
   silent green.
3. **`frontend/src/pages/WorkflowBuilderPage.header.test.tsx` MUST appear in `files_modified`.**
   It is absent from CONTEXT.md's canonical refs.

### E.4 Fences — where `doorVocabulary.ts` may live, and what defends it

`librarySubtree.fences.test.ts:82-110` defines `LIBRARY_SUBTREE_PATHS`, an **explicit 12-path list**
(pinned by `expect(LIBRARY_SUBTREE_PATHS).toHaveLength(12)` at `:149`), globbed non-recursively over
`./*.{ts,tsx}` within `library/` only.

- **No fence forbids `components/workflows/doorVocabulary.ts` or `DoorHeaderStrip.tsx`.** They sit
  outside the swept directory entirely. **D-10's location is clear.**
- **Equally, no fence DEFENDS them.** F1 (no `title=`), F4 (no `WorkflowsPage` specifier), F5 (no
  copy overstating the search) and T-192-04 (no `dangerouslySetInnerHTML`) all stop at the `library/`
  boundary. The new modules ship unswept. The plan should decide deliberately whether that is
  acceptable or whether 193 authors its own small fence — and if it does, heed 192.1's E-2 lesson:
  **a fence swept against the empty string passes green while defending nothing.** Verify the SCOPE
  — *could it fire?* — by driving it RED against a real plant in a real file.
- **The `library/` fences DO bind the AUTH-03 edits**, because `WorkflowCard.tsx` and `RunModal.tsx`
  are both in the corpus. Specifically: **no `title=` attribute** on the new label or mark (F1,
  AST-parsed since 192-05), and **no `dangerouslySetInnerHTML`** (T-192-04, a RAW regex that reds on
  prose merely spelling the prop — do not write it in a comment).
- If any AUTH-03 string is re-homed into `libraryVocabulary.ts`, F5's `OVERSTATED_WORDS` sweep runs
  over it. `needs a template` and `Template to fill` contain none of them, but re-check after any
  operator reword.

### E.5 The two DOM baselines AUTH-03 will red

`RunModal.test.tsx:541-577` holds `RUN_MODAL_HTML_BASELINE` — **six whole-`innerHTML` captures**
(`BOUND_WITH_FOLDERS`, `UNBOUND_NO_PROJECT`, `NO_FOLDERS_SCOPE_HIDDEN`, `TEMPLATE_STAGED`,
`LAUNCH_ERROR`, plus the submitting state) taken by 192-03 at `CAPTURE_SHA =
14b309b4bd3b04ad5718caa821c24ddb613e2d3f`, when `library/RunModal.tsx` did not yet exist. The file's
own header (`:338`) warns: *"⚠ THE BASELINE MUST PREDATE THE CHANGE… re-capturing to make it green
deletes the only evidence the modal still renders what it rendered."*

Measured impact of D-17/D-18 on those six:
- Both fixtures (`boundPublished` `:70-81`, `unboundPublished` `:85-96`) declare
  `phases: [{ config: { phase_type: "llm_emit", citation_policy: "draft" } }]` and **no `emitter`
  key**. Under the recommended predicate (emitter defaults to `render_template`) all six rows
  **admit**, the control stays, and the only delta is D-18's one added label node. Small,
  predictable, re-capturable.
- **Under a predicate requiring an explicit `emitter` string, all six rows would read
  `does-not-admit`, the whole block would vanish, and every capture would red catastrophically** —
  including `TEMPLATE_STAGED` and `LAUNCH_ERROR`, whose entire subject is inside the removed
  wrapper. This is the concrete reason A.1's default rule is load-bearing rather than pedantic.

`RunModal.a11y.test.tsx` (pinned 16) covers focus order and the dialog contract; a new text node
above the input is inert there, a `<label htmlFor>` is not (see C.3).

---

## F. Characterization-baseline mechanics for wave 1

### F.1 The house method, proved four times (188.1, 188.2, 192-06, 192-08)

The verbatim-move proof this project uses is **mechanical, not asserted**:

```bash
# 1. The destination must not exist at the capture commit — the 188.1 lesson, discharged
#    rather than claimed:
git rev-parse HEAD
git show HEAD:frontend/src/components/workflows/DoorHeaderStrip.tsx   # must answer:
#   fatal: path '…' does not exist in 'HEAD'                          [exit 128]

# 2. After the move, sed the moved span out of the BASE blob and out of the NEW module,
#    strip the one added `export ` keyword, and diff:
git show <base>:frontend/src/components/workflows/WorkflowDoorSwitch.tsx \
  | sed -n '145,175p' > /tmp/before.txt
sed -n '<a>,<b>p' frontend/src/components/workflows/DoorHeaderStrip.tsx \
  | sed 's/^export //' > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt          # must be IDENTICAL

# 3. "Zero re-capture" = the baseline test file's diff has 0 DELETIONS.
git diff --numstat -- <the baseline test file>   # e.g. `143 0 …` — insertions only
```

192-06's record is the canonical statement: *"`RunModal.test.tsx`'s diff is 143 insertions / **0
deletions**, so not one `*_BASELINE` literal was edited."* **A baseline whose diff shows a deletion
did not prove the move; it was edited to agree with it.**

The capture commit must also touch **no source file**: 192-03 records
*"THIS PLAN MODIFIES NO SOURCE FILE… a source edit inside the capture commit would destroy the very
property the capture exists to establish."*

### F.2 What a `WorkflowDoorSwitch` baseline must capture

There is **no whole-DOM baseline for this component today** — the 23 shipped cases assert behaviour
(clicks, mounts, `?raw` source-greps), not markup. Wave 1 must author one. Minimum states, derived
from the file's own branching:

| # | State | Props |
|---|---|---|
| 1 | Chooser, standalone | `initialDoor` default, no `inline` |
| 2 | Chooser, inline + `headerLead` | `inline`, `headerLead=<nav/>` — exercises the `321-323` band |
| 3 | Describe door, standalone | click `door-card-describe` |
| 4 | Describe door, inline | `inline` + `headerLead` — exercises `{inline && headerLead}` at `221` |
| 5 | **Govern door, standalone** | `initialDoor="govern"`, no `inline` — **the `ml-auto` present branch** |
| 6 | **Govern door, inline** | `initialDoor="govern"`, `inline` — **the `ml-auto` absent branch, `headerTrail`** |

Rows 5 and 6 are the ones that matter: they are the only two that differ by exactly the D-05 class
conditional, and a baseline missing either cannot detect the `ml-auto` regression D-05 warns about.
Capture the **whole `innerHTML`** of the door root (`data-testid="door-govern"` / `door-describe` /
`workflow-doors`), not a subtree — the 192-03 default (`(m) => m.innerHTML`).

**A ready-made harness already exists and should be reused rather than reinvented:**
`.planning/sketches/164-telling-the-doors-apart/emit.test.tsx.src` renders the real component under
jsdom with the api seam mocked (`generateWorkflow`, `listFolders`, `listSkills` via `vi.hoisted`) and
dumps `innerHTML`. It captures only `chooser` and `describe`; adding the two govern states is a
ten-line change. Its mock set is the minimum the govern door needs (it mounts the real
`WorkflowBuilderPage`).

**Also free, and stronger than anything 193 can author:** `WorkflowBuilderPage.header.test.tsx:304`
is already a byte-exact capture of state 5's band, taken in Phase 184.1 — genuinely predating this
phase by nine phases. Wave 1 keeping it green **unedited** is the proof; state 5's new baseline is
belt-and-braces.

---

## G. Validation Architecture

Nyquist validation is **enabled** (`.planning/config.json` → `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|---|---|
| Framework | **vitest** + `@testing-library/react` (jsdom) |
| Config file | `frontend/vitest.config.ts` (via `vite.config.ts`); setup in `frontend/src/test/setup.ts` |
| Quick run command | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx src/components/workflows/library/WorkflowCard.test.tsx src/pages/__tests__/RunModal.test.tsx` |
| Full suite command | `cd frontend && GSD_VITEST_MAX_WORKERS=4 node ../scripts/vitest-count-gate.cjs` |
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` (**must stay 33**) |
| Lint | `cd frontend && npx eslint src/components/workflows/` (**10 pre-existing; must not grow**) |

⚠ `npx tsc --noEmit` **without `-p tsconfig.app.json` checks ZERO files** — a recorded trap in this
project. Always pass the project flag.
⚠ `GSD_VITEST_MAX_WORKERS=4` is calibrated for **two** concurrent runs. At three the gate goes
non-deterministic (192-05 measured `failed 6 → 0 → 1 → 3` on one commit).

### Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | File exists? |
|---|---|---|---|---|
| AUTH-01 | Wave 1: the 20 COPY strings render **byte-identically** after the move to `doorVocabulary.ts` | characterization | `npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx` | ❌ **Wave 0** — no DOM baseline exists (see §F.2) |
| AUTH-01 | Wave 1: `WorkflowBuilderPage.header.test.tsx:304`'s byte-exact band literal stays green **with zero edits** | characterization | `npx vitest run src/pages/WorkflowBuilderPage.header.test.tsx` | ✅ exists, pinned 32 |
| AUTH-01 | Every one of the 20 ids is exported from `doorVocabulary.ts` and equals column D | unit | new `doorVocabulary.test.ts` | ❌ **Wave 0** |
| AUTH-01 | The component imports every string from the module — **no door COPY literal survives in JSX** | source fence (`?raw`) | extend `WorkflowDoorSwitch.test.tsx` | ✅ file exists; the `?raw` idiom is already at `:22` |
| AUTH-01 | The hint composes **three separate fragments** (D-12), `<b>` markup owned by the component | unit | `WorkflowDoorSwitch.test.tsx` | ✅ |
| AUTH-01 | D-05: `DoorHeaderStrip` renders in **both** variants; `ml-auto` present iff **not** `inline` | unit | new `DoorHeaderStrip.test.tsx` | ❌ **Wave 0** |
| AUTH-01 | D-04: the return control carries **no border class**; a divider node sits between it and the label; the judge badge keeps the far edge | unit | `DoorHeaderStrip.test.tsx` | ❌ **Wave 0** |
| AUTH-03 | `templateAdmission` returns all **three** states over: emit phase / no emit phase / `undefined` / `null` / `{}` / `{phases: []}` / non-array `phases` | unit (pure) | `npx vitest run src/components/workflows/soulData.test.ts` | ✅ exists, pinned 17 |
| AUTH-03 | An `llm_emit` phase with **no `emitter` key** admits (the model default) | unit | `soulData.test.ts` | ✅ |
| AUTH-03 | D-15: the card renders the mark **only** on `"admits"`; `"does-not-admit"` and `"unknown"` are **indistinguishable** (both render nothing) | unit | `WorkflowCard.test.tsx` | ✅ pinned 80 |
| AUTH-03 | D-14: the mark's slot in `identityParts`, asserted **by child order**, never by class name | unit | `WorkflowCard.test.tsx` (`identityParts()` helper at `:632`) | ✅ |
| AUTH-03 | D-20: the modal hides the block **only** on `"does-not-admit"`; `"unknown"` renders it exactly as today | unit | `RunModal.test.tsx` | ✅ pinned 32 |
| AUTH-03 | D-19: `run-provenance` is byte-exact and travels with the control | unit + fence | `RunModal.test.tsx` | ✅ |
| AUTH-03 | A non-template launch failure is still **visible** (the `launchError` hazard, §D.1) | unit | `RunModal.test.tsx` | ❌ **Wave 0** — no such case today |
| AUTH-03 | D-18's label is a **text node**, not a `<label htmlFor>` bound to a hidden input | a11y | `npx vitest run src/pages/__tests__/RunModal.a11y.test.tsx` | ✅ pinned 16 |
| both | No `title=` and no raw-HTML escape hatch anywhere in `library/` | fence | `npx vitest run src/components/workflows/library/librarySubtree.fences.test.ts` | ✅ pinned 118 |

### Sampling Rate

- **Per task commit:** the quick run above **plus** `npx tsc --noEmit -p tsconfig.app.json` (33).
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=4 node ../scripts/vitest-count-gate.cjs` — exit 0, no
  per-file decrease, `tsc` 33, `eslint src/components/workflows/` ≤ 10.
- **Phase gate:** full suite green **and** the G-4 rows below driven, before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` (or an extension of
      the shipped suite) — six whole-`innerHTML` captures per §F.2, captured on the **unmoved** tree,
      in a commit that modifies **no source file**. Covers AUTH-01.
- [ ] `frontend/src/components/workflows/doorVocabulary.test.ts` — all 20 ids present, each equal to
      column D, exact-match assertions only (the `libraryVocabulary` header's rule: a `toContain` on
      a fragment is a vacuous fence).
- [ ] `frontend/src/components/workflows/DoorHeaderStrip.test.tsx` — both `inline` values, the
      `ml-auto` conditional, the D-04 shape.
- [ ] One new `RunModal.test.tsx` case for the non-template launch-failure visibility hazard.
- [ ] `BASELINE` entries in `scripts/vitest-count-gate.cjs` for every new suite, added in the same
      commit that creates it (the `librarySubtree.fences.test.ts:74-80` rule, one layer up).
- [ ] **No framework install needed.**

### Manual-only — the G-4 rows this phase owes

Three of the four deliverables have **no mockup**: the D-04 restack (the sketch says so at
`README.md:149-157`), and both AUTH-03 surfaces (`build.cjs:23` — *"a PROPOSAL, not a generated
dump"*). Those are exactly where sketch→build drift survives, and they must be driven by looking.

| Row | What | Why it cannot be automated |
|---|---|---|
| **U1** | Show the chooser to someone who has not seen the Builder. Ask, **before** they click, what each door will do. Record their words verbatim. | **SC#1 is a prediction by a human.** No assertion can measure it. This is the row the whole phase exists for. |
| **U2** | Count the perceived choices on the chooser and inside each open door. | **SC#2** — "the number of perceived choices does not increase". A structural count cannot see perception. |
| **U3** | With `visual_workflow_canvas` **OFF** (standalone band) and again **ON** (merged row), compare the restacked strip against `D-04`'s ASCII. Does the return control read as an *escape* rather than a peer? | **No mockup exists.** Pixel/weight judgement, both `inline` values, by looking. |
| **U4** | Open the Run modal on a workflow that **admits** and on one that **does not**. Is `Template to fill` findable without being told? Is the absence of the control on the second one *unremarkable* rather than *broken-looking*? | **SC#3.** The sketch draws neither state. |
| **U5** | Read a card carrying `· needs a template` beside one that does not. Does the mark read as a *requirement of you*, or as a *description of the workflow*? | This is the §A.4 escalation, checked at the surface. If it reads as a description, P1′ shipped and the mark says nothing new. |
| **U6** | Open the **govern** door after variant D lands. Does the header label agree with the door card that opened it? | The §B.4 21st-string finding, verified by eye. **A FAIL here is expected if the escalation is declined** — record it, do not paper over it. |
| **U7** | Trigger a launch failure on a workflow whose template block is hidden. Is the error visible? | The §D.1 hazard, end-to-end. |

**Driving notes (do not re-derive):** `take_screenshot` times out on this setup — read DOM geometry
via `evaluate_script`. `computer` clicks can deliver zero events; `hover` / `left_click_drag` work.
**Per D-27, no row may locate its target by `getElementById` on a known id** — that is the rule
Phase 192's re-drive broke and 192.1 restored.

---

## H. Risks and landmines

### H-1 · What could make wave 1's "pure move" unprovable

- **Capturing the baseline in the same commit as the move.** The 188.1 lesson; the capture commit
  must modify no source file, and the destination module must answer *"does not exist in 'HEAD'"*.
- **Editing `WorkflowBuilderPage.header.test.tsx:304` during wave 1.** It is the strongest pre-existing
  proof available. Any edit to it in wave 1 destroys that proof.
- **Reformatting during the move.** Prettier/`eslint --fix` on the moved span breaks the `sed`+`diff`
  identity. The only character that may be added is `export `.
- **Silently normalizing `&amp;`.** The source uses JSX entities (`Author &amp; govern`); a
  vocabulary module holds plain strings (`Author & govern`). The rendered `textContent` is identical,
  the **source bytes are not** — so the JSX-level `diff` will show a difference where the DOM shows
  none. **Plan the proof at the DOM level (`innerHTML` baselines), not the source level, for the
  20 strings**; keep the source-level `sed`+`diff` proof for the *structural* move
  (`doorGroup` → `DoorHeaderStrip.tsx`), where no entity conversion occurs.
- **Missing the second `strip.back` site (`:228`).** One id, two JSX sites. A move that catches only
  `:164` leaves a literal behind and the source fence will say so — if the fence sweeps for
  literals rather than for the import.

### H-2 · Module-scope import and ESM cycles

**No cycle risk exists here**, and this is verified rather than assumed:

- `doorVocabulary.ts` will be a **leaf** — plain string constants, zero imports. Nothing can import
  back into it. (Contrast `libraryVocabulary.ts`, which imports `TIERS` from `deriveTier` and types
  from `libraryRow` — still acyclic.)
- The 188.1 constraint on `WorkflowCanvas` was specific: `WorkflowCanvas` imports `FlowEdge`'s
  **value** at module scope for the `edgeTypes` map, so the extracted module must not import back.
  `DoorHeaderStrip.tsx` has the same shape — `WorkflowDoorSwitch` will import its value at module
  scope — so **`DoorHeaderStrip.tsx` must not import `WorkflowDoorSwitch`**. It has no reason to
  (it takes `onBack` / `inline` as props), but the plan should fence it the way 188.1 did: a `?raw`
  cycle fence with an inline positive control, driven RED against a deliberate back-import.
- `soulData.ts` is already imported by `libraryRow.ts`, `libraryFilter.ts` and `RunModal.tsx:60`.
  Adding one exported function creates no new edge.
- **`react-refresh/only-export-components` is an ACTIVE error in this repo** (10 hits in
  `components/workflows/`, including `FlowEdge.tsx:147` and `SelectedPhaseSlugContext.tsx:58`).
  `DoorHeaderStrip.tsx` may export **only** the component and its props type. Any shared runtime
  value belongs in the `.ts` leaf. This is the mechanical reason D-10 is right, stated as
  `PlaneEditingLayer.tsx:23-31` records after 188.1 measured it.

### H-3 · Lessons from the 192 / 192.1 waves that apply directly

| Lesson | Applies how |
|---|---|
| **Worktrees fork from the wrong base — 12 of 12 in Phase 192** | Keep the `git merge-base` assertion in **every** executor prompt. A baseline captured on the wrong base proves nothing. |
| **A fence swept against the empty string passes green** (192.1 E-1/E-2) | Any new fence must be driven RED against a real plant in a real file, and its **scope** verified — *could it fire?* Three of 192.1's fences held with nothing defending them. |
| **Both failure tests pinned the correct branch without entering the wrong one** (192 CR-01) | The card's D-15 tests must include a row that genuinely reaches `unknown`, not only rows that reach `admits` and `does-not-admit`. Same for the modal's `unknown` arm. |
| **`allSettled` was not what saved the library — verify the PROPERTY, not the patch** (192-10) | Do not assert that `templateAdmission` is *called*; assert the rendered outcome under each of the three states. |
| **The plan's own numbers went wrong in five of six waves** | Re-derive every line number at execution HEAD. §B's numbers are measured at `58a402bc`; **HEAD will have moved** by execution. |
| **A green suite proves nothing on its own — plant, observe RED, restore md5-identical** (192-09, eight plants) | Apply to the copy fence, the child-order assertion, and the three-state predicate. |
| **SEED-155 / U8: a sketch that draws an unrenderable atom is the failure mode** | The AUTH-03 surfaces have **no drawing at all**. Drive U4/U5 hardest. |
| **A stale STATE.md manufactures a request to redo finished work** | Hand-edit `STATE.md`; do NOT call `state.*` SDK verbs (seven write false records). |

### H-4 · Scope creep to decline explicitly

- **192's owed debt: nine module-private strings still awaiting a re-home into
  `libraryVocabulary.ts`** (STATE.md wave 8, item 3). Touching `RunModal.tsx` and `WorkflowCard.tsx`
  makes this tempting. It is **192's debt**; folding it in grows a commit that did not cause it.
- **The `+24` count-gate drift** (four pins outside this blast radius). Decline for the ninth time.
- **`WorkflowBuilderPage.canvas.test.tsx`'s ~14 % flake.** If it reds, check STATE.md wave 8 item 2
  before attributing it to 193.
- **`WorkflowCard.tsx` refactor.** 193 makes it the card's 3rd phase, which arms G-5 for the phase
  **after** this one. Explicitly deferred by CONTEXT; do not open it here.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Deciding whether a definition renders a template | A new walk over `phases[]` inside the card | `templateAdmission()` in `soulData.ts`, beside `soulDeliverable` | `libraryFilter.ts:19` states the rule by name: *"derive, do not re-implement"*. A second walk drifts from `soulDeliverable`, and the *Strict* chip is the recorded case where a hand-rolled copy was **measurably wrong** (WR-03). |
| Reading `definition` off the wire | A `JSON.parse` or a string guard in the component | `LibraryRow.def` (card) / `wf.definition as DefShape` (`RunModal.tsx:90`) | The API already `json.loads` the string scalar (`api/workflows.py:92-112`). A client-side parse would be dead code that looks defensive. |
| Composing the identity line's separators | Manual `·` interleaving | Splice into `identityParts` (`WorkflowCard.tsx:498-502`) | The `null`-dropping there is what makes the separator rule mechanical rather than a matter of care — a dangling `·` promises something then not said. |
| A vertical divider for D-04 | A new border utility | `<span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />` — the shipped idiom at `CanvasToolbar.tsx:212` | Already in the token vocabulary, already `aria-hidden`, already used in a toolbar strip. |
| Proving a verbatim move | Hand-typing the DOM the component "ought" to produce | Capture `innerHTML` from the tree as it ships (§F) | *"Records only what its author believed the markup was, and would ratify a move that changed the markup whenever the change happened to match the belief"* — `RunModal.test.tsx:333-337`. |
| A "does this need a template" backend endpoint | A new API field or route | Nothing — the data is already on the wire | D-16, confirmed at `db/workflows.py:289/309/349` **and** `libraryRow.ts`. |

**Key insight:** every input this phase needs already exists on the surface it renders on. The only
genuinely new artifact is one pure function and one vocabulary leaf.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node + npx (frontend toolchain) | all gates | ✓ | workspace `frontend/` | — |
| `tsc` via `tsconfig.app.json` | typecheck gate | ✓ | 33-error baseline reproduced | — |
| vitest + count gate | test gates | ✓ | `total 3437 · failed 0` | — |
| Local Supabase Postgres `127.0.0.1:54322` | live-data verification of §A | ✓ | 223 `workflow_definitions` rows | code + fixtures (used for the `phase_types.py` reading regardless) |
| `psycopg2` | the DB queries above | ✓ **only in `backend/venv`** | `backend/venv/Scripts/python.exe` | ⚠ the system `python` on PATH does **not** have it — a plain `python` invocation fails `ModuleNotFoundError` |
| Backend runtime | — | not needed | — | this phase writes no backend code |
| Chrome MCP | G-4 UAT rows | ✓ (with caveats) | — | `take_screenshot` times out; use `evaluate_script` for DOM geometry |

**Missing with no fallback:** none.

---

## Sources

### Primary (HIGH confidence) — measured in this repo at `58a402bc`

- `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (385 L) — every line number in §B
- `frontend/src/components/workflows/library/WorkflowCard.tsx` (747 L), `RunModal.tsx` (430 L),
  `libraryVocabulary.ts` (448 L), `libraryRow.ts`, `libraryFilter.ts`,
  `librarySubtree.fences.test.ts` (968 L)
- `frontend/src/components/workflows/soulData.ts` (172 L) — `DefShape`, `tierForDefinition`,
  `soulDeliverable`
- `frontend/src/lib/api.ts:1364-1386` — `PublishedWorkflow`; `:3315` — `WorkflowDefinitionJSON`
- `frontend/src/pages/WorkflowBuilderPage.header.test.tsx:249,304,311,321,352`;
  `frontend/src/pages/__tests__/RunModal.test.tsx:70-96,330-470,541-577`
- `frontend/src/components/workflows/PhaseNodeCard.test.tsx:321-345` — the real two-badge control
- `frontend/src/components/workflows/BuilderHeaderBar.tsx:16-18,53`;
  `CanvasToolbar.tsx:212`
- `scripts/vitest-count-gate.cjs` — `BASELINE` (64 files, 3413), `TARGETS` (12 entries), `:1520`
- `backend/app/services/harness/phase_types.py:325-390, 861-878, 1193-1260`
- `backend/app/models/harness.py:92-170`; `backend/app/services/harness/emitters.py:183`
- `backend/app/services/template_asset_service.py:120-215`;
  `backend/app/api/workflows.py:92-112`; `backend/app/db/workflows.py:289,309,349`
- **Live DB** `127.0.0.1:54322` — 223 `workflow_definitions` rows, queried via
  `backend/venv/Scripts/python.exe` + psycopg2; all four predicate scorings in §A.3
- `.planning/sketches/164-telling-the-doors-apart/` — `BUILD-CONTRACT.generated.md`, `README.md`,
  `build.cjs`, `dom.generated.json`, `emit.test.tsx.src`
- `.planning/REQUIREMENTS.md:26,28`; `.planning/ROADMAP.md:285-298`; `.planning/STATE.md`; `CLAUDE.md`

### Secondary (MEDIUM confidence)

- `.planning/phases/193-authoring-doors-template-placement/193-CONTEXT.md` — treated as constraint,
  with every factual claim in it re-derived (see `## Corrections to inherited claims`)
- Phase 188.1 / 188.2 / 192 / 192.1 records in `STATE.md` and `CLAUDE.md` for the move-proof method

### Tertiary (LOW confidence) — flagged for validation

- **None used.** No WebSearch, no external documentation, no Context7 lookup was needed: this phase
  introduces no library and touches no third-party API.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `phase_type == "llm_emit"` remains equivalent to *"renders a template"* | §A.1 | `EMITTER_REGISTRY` gains a second entry ⇒ the predicate over-marks. **Mitigation:** guard on `emitter ?? "render_template"`, not on `phase_type` alone, so a future non-template emitter reads as `does-not-admit` without a code change here. |
| A2 | The local DB's 223 rows are representative of the shapes a deployed library will hold | §A.3 | Cloud data could contain `available_tools`-whitelisting definitions. **Mitigation:** the recommended predicate checks BOTH paths, so it is a superset of either reading. |
| A3 | `phases: []` (110 published rows) is best read as `unknown` rather than a positive `no` | §A.3 | If read as `no`, D-17 strips the shipped upload from 76 % of the local library. **This is a decision for the plan, not an assumption to carry silently.** |
| A4 | The operator will want the D-04 restack applied to the describe door's band too | §B.1 | Two visually different return controls one click apart. **Escalate rather than assume.** |
| A5 | The govern strip's `🔧 Author & govern` label needs a variant-D counterpart | §B.4 | Ships the one string variant D was designed to retire, in the one place it is most visible. **Escalate.** |
| A6 | Re-capturing `WorkflowBuilderPage.header.test.tsx:304` in wave 2 is acceptable | §E.3 | It is the only pre-existing byte-exact proof of the strip. Re-capture is legitimate **only after** wave 1 proves the move with it green and unedited. |

---

## Open Questions

1. **Which predicate ships — P1′ (17 rows) or P2 (1 row)?** *(§A.4 — the escalation)*
   - **Known:** an emit phase means a template is rendered; a bound `assets[kind=="template"]` means
     the app supplies it and the user's upload is unreachable code (`template_asset_service.py:144`).
     16 of 17 published admitting rows are bound.
   - **Unclear:** whether the operator wants the mark to mean *"you must supply one"* (AUTH-03's own
     word) or *"this fills a template"* (which duplicates the shipped *Makes a file* chip).
   - **Recommendation:** put both numbers to the operator at plan time. Offer the two-state option
     (*needs a template* / *fills a template*) as the only reading honest on all 145 rows.

2. **What renders on `phases: []`?** *(§A.3)*
   - **Known:** 110 of 145 published rows. P1′ says `no`; P1″ says `unknown`.
   - **Recommendation:** `unknown`. A definition with no phases has told us nothing, and D-20 exists
     precisely so a stub does not silently strip a shipped capability.

3. **Does the D-04 restack apply to the describe door's band?** *(§B.1)*
   - **Known:** band 5 (`:214-231`) carries an identically-classed `‹ both doors`; D-04 and its
     diagram address only the govern strip.
   - **Recommendation:** yes, for the return control's demotion only (no judge badge exists there,
     so no divider question). Confirm with the operator — it has no mockup either way.

4. **Is there a `strip.labelGovern` id?** *(§B.4)*
   - **Known:** no. `dom.generated.json` never captured the govern door.
   - **Recommendation:** add the id to `build.cjs`, re-run `node build.cjs && node assemble.cjs`,
     and have the operator pick one string. Cheap, and it keeps D-02's "derived, never re-typed"
     property intact.

5. **Should 193 author a fence for the new modules outside `library/`?** *(§E.4)*
   - **Known:** nothing sweeps `components/workflows/*.ts` today. The new modules ship undefended.
   - **Recommendation:** one small fence — no door COPY literal outside `doorVocabulary.ts`, and the
     `DoorHeaderStrip` → `WorkflowDoorSwitch` cycle fence — each driven RED against a real plant.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Standard stack | **HIGH** | Zero new dependencies. Every module, helper and idiom this phase needs already ships and was read at file:line. |
| Architecture / extraction seams | **HIGH** | Every span, prop branch and importer re-derived from source at `58a402bc`; the `ml-auto` conditional's reason confirmed at `BuilderHeaderBar.tsx:53`. |
| The `render_template` predicate | **HIGH** on the mechanism (code + 223 live rows agree), **MEDIUM** on which predicate should ship (a product decision, escalated). |
| Test topology / gates | **HIGH** | `tsc`, eslint and the count gate were all executed, not quoted. Both count-gate knobs inspected directly. |
| Pitfalls | **HIGH** | Each landmine traced to a specific file:line or a recorded prior-phase measurement, not to general caution. |
| The G-4 / manual half | **MEDIUM** | Three of four deliverables have no mockup; the rows are specified but their outcome is inherently human. |

**Research date:** 2026-08-13
**Valid until:** ~2026-08-27 for the code findings (any commit touching the five files invalidates
the line numbers — re-derive at execution HEAD). The live-DB counts in §A.3 are valid until the next
workflow is published locally.
