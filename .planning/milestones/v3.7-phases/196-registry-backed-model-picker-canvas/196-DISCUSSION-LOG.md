# Phase 196: Registry-Backed Model Picker (canvas) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 196-registry-backed-model-picker-canvas
**Areas discussed:** Reported-bug routing, Which list IS the registry, Blank + unknown values, How hard the refusal is, Fitness at pick time (SEED-135), Folded-bug direction, Ledger debt

---

## Reported-bug routing (MANDATORY cross-check)

Three open `surface: Agentic-RAG` reports overlap the model-selection domain. None is on the canvas,
so all three were scope-fence questions rather than obvious folds.

| Option | Description | Selected |
|--------|-------------|----------|
| Leave all three open | Honour the ROADMAP's canvas-only fence; all stay `open` pointing at the SEED-040/088 sweep | (selected, then superseded) |
| Fold BUG-260731-01 | The inert judge knob — same "control that looks authoritative while code decides" disease | ✓ |
| Fold BUG-260718-04 | Chat model selection not remembered per thread | ✓ |

**User's choice:** Initially a contradictory multi-select (leave-all-open *and* two folds). Clarified
in a follow-up single-select: **"Fold 260731-01 + 260718-04"**, leaving only BUG-260809-01 open.

**Notes:** The contradiction was surfaced rather than silently resolved, because the two readings lead
to materially different phases. The fold widens the ROADMAP's stated canvas-only fence, so it is
recorded in CONTEXT.md as an explicit operator decision with the original fence quoted, not smuggled
into scope. BUG-260809-01's `re_open_trigger` records the review with the reason it was NOT folded —
per the project's own lesson that a `status:` frontmatter IS the routing index.

---

## Which list IS the registry

Presented after measuring both candidate sets live rather than describing them.

| Option | Description | Selected |
|--------|-------------|----------|
| New union endpoint | Non-operator GET returning the union `_registry_row` already builds (69 ids). Only source showing BOTH `gpt-5.5` and the local LM Studio models. Cost: one new route + its authz story | ✓ |
| `allowed_models` (`/me/preferences`) | Zero new backend; already governed and re-validated server-side. Cost: silently drops 35 code-registry models | |
| `verified_models` (`/settings`) | Zero new backend; what JudgeModelPicker consumes. Cost: hides all 8 DB-only ids incl. every local model | |

**User's choice:** New union endpoint.

**Notes:** The measurement is what made this decidable — code registry **61**, enabled DB set **34**,
overlap only **26**. Each single-source option fails on a model the seeds specifically name:
`allowed_models` cannot offer `gpt-5.5` (SEED-135's measured *working* judge); `verified_models`
cannot offer `gemini-3.6-flash` (SEED-135's measured *failing* model) or any of SEED-172's three
hand-inserted LM Studio rows. Neither list was defensible once counted.

---

## Blank + unknown values

| Question | Options | Selected |
|---|---|---|
| How to represent blank (93 % of steps) | Named inherit option ✓ / Named inherit + 🔒 footer / Force an explicit pick | **Named inherit option** |
| How the effective default stays honest | Hedge it explicitly ✓ / Name the value only / No footer on inherit | **Hedge it explicitly** |
| A stored model in neither list | Keep as `(current)` + name consequence ✓ / Keep silently / Refuse to save | **Keep + name consequence** |

**Notes:** The disabled-model sub-question (asked in the previous round) resolved to *not offered, but
kept as `(current)` if already stored* — explicitly rejecting the variant that clears the value when
the form is opened, on the ground that viewing a workflow must not mutate it.

⚠ **A reading was made and stated aloud rather than re-asked:** answers 1 and 2 are in mild tension
(answer 1 declines a footer, answer 2 describes footer copy). The orchestrator's reading — the hedge
lives in the inherit option's own label, not in a separate footer card — was stated to the operator at
discuss-time and not contradicted. It is recorded in CONTEXT.md D-06 as a *reading open to
correction*, with a planner escape: a separate footer is allowed **if it carries the same hedge**.

The measurement that made this cheap: 257 phases, 239 blank, and the 18 explicit values are all the
same id (`gpt-5.4`) which passes every check the phase adds. The unknown-value rule protects zero rows
today and is future-proofing, stated as such.

---

## How hard the refusal is

| Question | Options | Selected |
|---|---|---|
| Where SC#2's refusal lives | Client + server on save ✓ / Client-only / Client + publish gate | **Client + server on save** |
| Add a harness enabled-check | Yes, mirror the chat fallback ✓ / No, authoring only / Notice without fallback | **Yes — mirror `_resolve_enabled_model`** |
| The AI-draft path | Verify then leave alone ✓ / Verify and fence it / Have the drafter pick | **Verify, then leave alone** |

**Notes:** The decisive fact was measured, not argued — `config.model` is validated by *nothing*
today, and `_effective_model` (`phase_types.py:393-395`) passes the string straight to the provider.
The Phase 149 enabled-check exists only on the chat send path. Client-only was rejected because it
would reduce SC#2 to "cannot be selected through the form", which is weaker than the criterion's
words and blind to the AI-draft path. Fencing the drafter (option 2 on question 3) was declined; the
grep evidence is to be *confirmed by research* rather than pinned by a test this phase writes.

---

## Fitness at pick time (SEED-135)

| Question | Options | Selected |
|---|---|---|
| Annotate fitness? | On `llm_emit` only ✓ / Plain list everywhere / Every AI step | **`llm_emit` only** |
| Add `emit_tier` to the DB overlay list | Yes, same phase ✓ / No, read-only fitness / Only if annotated | **Yes, same phase** |
| Judge fitness in scope? | Out — fix the wiring only ✓ / In, reproduce and root-cause / In, validate the judge write | **Out** |

**Notes:** Confirmed against source before asking: 17 `force_strict` / 39 `force` / 5 `coerce` across
61 rows; `emit_tier` has never been sent to the client (one prose comment in the whole frontend); and
the overlay list at `config.py:717-718` omits it, so every DB-only model — including all three local
ones — is `coerce` with no operator knob. That last fact is why the "read-only fitness" option was
rejected: SEED-135's own warning is that a surface reporting a value the operator cannot change is the
failure, not the fix.

Judge fitness stayed out on the seed's own terms: `gemini-3.5-flash` is `force` and still returned no
verdict, the `$defs`/`$ref` stripping hypothesis is rated MEDIUM and **never live-verified**, and the
seed explicitly forbids stating the cause as fact until a sanitized payload is captured. Building a
fitness facet on that would be building on an unverified hypothesis.

---

## Folded-bug direction

| Question | Options | Selected |
|---|---|---|
| BUG-260731-01 fix | Route consumers to DB settings ✓ / Declare it system-level in the UI / Route + validate fitness | **Route consumers to DB settings** |
| BUG-260718-04 restore | Derive from last message ✓ / Persist per-thread explicitly / Unfold it | **Derive from last message** |

**Notes:** Both selections are the reports' *own* recommended shapes, which is the cheapest kind of
agreement. The judge fix's binding condition — a test that sets the row and asserts the RESOLVED model
changes — was carried into CONTEXT.md verbatim, because the report itself names the absence of that
test as the reason the defect survived seventeen days. The third option on the judge question was
declined consistently with the fitness decision one round earlier (it would have partly reversed it).

---

## Ledger debt

| Option | Description | Selected |
|--------|-------------|----------|
| Rows for files this phase modifies | Discharge the obligation for changed files, name the rest | ✓ |
| All five, measured now | Close the whole hole while it is in hand | |
| `config.py` only, plus the modified ones | Take the second-hottest file in the tree | |

**User's choice:** Rows for files this phase modifies.

**Notes:** The audit that prompted this found **five files absent from the hot-file ledger entirely**,
so G-5 has never fired on any of them — including `backend/app/config.py` at **70 commits / 41 phases
/ 1275 L**, the second-hottest file measured anywhere in this project after `api/threads.py` (76).
The four not taken are named in CONTEXT.md D-22 so they are no longer invisible to the next audit,
which is the substantive half of the fix; writing detail sections about code this phase does not touch
would have converted a model-picker phase into a documentation phase.

---

## Claude's Discretion

- Route name and URL shape for the union endpoint — the contract is fixed, the URL is not.
- Component naming and file placement for the picker (`ModelField.tsx` is a suggestion).
- Visual form of the `llm_emit` fitness annotation (chip / suffix / `<optgroup>`) — only the
  *distinguishability before selection, in user words* is required.
- Wave and plan decomposition, including whether the three surfaces ship as separate plans.

## Deferred Ideas

- Judge fitness as a capability facet (SEED-135 item 6) — blocked on live verification.
- Refusing a `coerce`-tier judge at `settings.py:448-457` — deferred with judge fitness.
- The app-wide SEED-040 / SEED-088 model single-source sweep — its own milestone.
- Per-workflow (rather than per-step) default model — new capability.
- The AI drafter choosing a fit model per step — collides with AUTH-02 / Phase 197.
- A "re-measure loaded context" action in the Model Registry tab (SEED-172 finding 4).
- Numeric range validation on the registry PATCH path (SEED-172 finding 3) — may become free if D-14
  edits `set_model_capability`'s guards; the planner should check.
- Ledger rows for the four absent files 196 does not modify.

### Considered and explicitly rejected (not deferred — decided against)

- **A sketch under G-2.** The picker idiom ships twice already (`JudgeModelPicker` 137.1 / sketch
  024-A, `ModelDefaultPreference` 167); re-drawing a shipped atom is the structural sketch→build
  drift SEED-155 records. The operator was offered a sketch and did not take it.
- **Declaring the judge knob system-level in the UI** — honest and near-zero-risk, but it leaves the
  operator's stated goal (a cheaper judge) permanently impossible.
- **Clearing a disabled model when the step form opens** — mutating a saved workflow as a side effect
  of viewing it.
