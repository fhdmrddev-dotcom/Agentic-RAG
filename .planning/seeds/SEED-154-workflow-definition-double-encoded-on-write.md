---
id: SEED-154
title: "Every workflow definition the app writes is DOUBLE-ENCODED — `json.dumps()` is handed to a connection that already has `encoder=json.dumps`, so `definition` lands as a jsonb STRING scalar and every `definition->…` query silently sees nothing"
status: planted
planted: 2026-08-12
planted_by: Claude Code, while checking whether the 42 duplicate workflow names were seeded or created (operator asked for the check 2026-08-12). Found by measurement, then CONFIRMED by an A/B against the app's own codec.
surface: Agentic-RAG
severity: warning
category: backend / data integrity / silent-failure
priority: medium-high
scope: Small fix, careful rollout — one binding per write site, plus a decision about the 83 already-written rows. NOT a schema change.
affected_areas: [workflow-definitions, harness, publish-gauntlet, admin-queries, analytics, migrations]
relates_to:
  - "The recorded `definition` jsonb string-scalar trap — this seed is its CAUSE. The trap was known and worked around; the write that creates it was never fixed."
  - SEED-085 (terminology) — only in that `definition->>'name'` returning NULL was mistaken for a naming defect on 2026-08-12; see "What this is NOT"
  - Phase 192.1 / LIB-05 — the duplicate-name investigation that surfaced this. The two are unrelated causes; 192.1 must not absorb this.
trigger_when:
  - Any SQL is written against `definition->…` — it will silently return nothing on 83 of 104 local rows
  - Any migration backfills, audits, or reports over workflow definitions
  - Any admin/analytics surface counts phase types, models, or tools across workflows
  - The next person adds a defensive `isinstance(x, str)` unwrap instead of fixing the write — that is the third one
---

# SEED-154: the definition is stored as a string that looks like an object

## Confirmed, not inferred

**The app registers a jsonb codec on every pooled connection** (`app/dependencies.py:76-82`):

```
await conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')
```

**And then hands it something already serialized** (`app/db/workflows.py:496`, and identically at the
two UPDATE sites `:580-598`):

```
json.dumps(definition.model_dump(mode="json"))   ->  $4::jsonb
```

So the value is dumped twice. **A/B tested against a real connection with that exact codec, into a
temp table inside a rolled-back transaction:**

| binding | `jsonb_typeof` | `d->'phases'` |
|---|---|---|
| `json.dumps(payload)` — **what the app does** | **`string`** | — |
| `payload` (the raw dict) | `object` | length 1 |

**Measured in the live dev database:** `jsonb_typeof(definition)` is **`string` on 83 of the
operator's 104 rows** and `object` on 20. **Zero of the 83 have a readable `phases` array.**

## ⚠ Why it survived: the docstring says the opposite, in as many words

`create_workflow_definition`'s own docstring (`db/workflows.py:477-478`) states:

> *"The `definition` JSONB is `json.dumps(definition.model_dump(mode="json"))` + `$N::jsonb` (mirror
> create_workflow_run — **this file uses no pool JSONB codec**)."*

**That claim is false.** The codec is registered by the pool's `init=` callback, so it applies to every
connection this file uses. A grep for the risk lands on a comment that says the risk is not present.
**Prose asserted a property that no test held**, and the property flipped when Phase 073 introduced
the pool codec.

## What actually breaks

**Not the app** — and that is why nobody noticed. The read path is defensively patched in at least two
places, each unwrapping the symptom:

- `services/harness_engine.py:1976-1977` — `if isinstance(definition, str): definition = json.loads(definition)`
- `services/harness/publish_service.py:139-143` — the same shape

**Two independent defensive unwraps are the tell.** Someone met this twice and patched the reader both
times; the writer was never touched.

**What breaks is every query that reasons about a definition in SQL**, silently and with no error:

- `definition->'phases'` → nothing (the already-recorded trap; `phase_type` lives at `phase['config']`)
- `definition->>'name'` → NULL
- any audit, migration backfill, admin count, analytics rollup, or ad-hoc investigation

**It also actively misleads investigation.** On 2026-08-12 this produced a false finding: 85 rows
appeared to have "a name column disagreeing with a definition name", which was written up as a
fork-naming propagation defect and had to be retracted. The rows had no JSON name because **you cannot
key into a string scalar**. A silent data-shape bug does not just hide data — it manufactures wrong
conclusions in anyone who queries around it.

## The fix, and the part that needs care

**The write is one change per site:** pass the dict, not `json.dumps(...)` — the codec does the
encoding. Three sites: `db/workflows.py:496` (INSERT) and `:587`/`:598` (both UPDATE branches). Check
whether `$N::jsonb` should also be dropped, and check `create_workflow_run`, which the docstring says
this mirrors — **if it mirrors it, it has the same bug.**

**The care is the 83 existing rows.** After the fix, new rows are objects and old rows are strings, so:

1. the defensive `isinstance(str)` unwraps **must stay** until a backfill lands, and
2. a backfill migration would need `definition = (definition #>> '{}')::jsonb` for rows where
   `jsonb_typeof(definition) = 'string'` — verified per-row, never blind, and
3. cloud rows may differ from local; re-derive there rather than assuming this ratio.

**Do not "fix" this by adding a third unwrap.**

## What this is NOT

- **NOT the duplicate-workflow-names problem.** That is `LIB-05` / Phase 192.1, and this seed was found
  while disproving a claimed link between them. They share a discovery session and nothing else.
- **NOT a schema change.** The column is already `jsonb` and correct; only what is put in it is wrong.
- **NOT currently user-visible.** No customer sees a symptom today. This is a data-integrity and
  investigation-correctness defect, which is why it is `warning` rather than blocker — and why it will
  keep costing an hour at a time until it is fixed.

## ⚠ It is NOT one column — `workflow_runs.inputs` is double-encoded on 100% of rows

Checked immediately after the above, because the docstring said this write *"mirrors
create_workflow_run"*. **It mirrors it including the bug.** `create_workflow_run`
(`db/workflows.py:149+`) binds `json.dumps(inputs)` into `$3::jsonb` and carries the identical
in-file claim *"(this file uses no pool JSONB codec)"*.

| column | `jsonb_typeof` in the live dev DB |
|---|---|
| `workflow_definitions.definition` | **`string` 83** · `object` 20 |
| `workflow_runs.inputs` | **`string` 205 — every single row** |
| `workflow_definitions.skill_snapshots` | `object` 1 · NULL 221 (not affected) |

`workflow_runs.inputs` at **100%** is the cleaner signal: `definition`'s 20 object rows are the
anomaly (some other path — seed SQL or a migration — wrote those), while every run this app has ever
recorded stored its inputs double-encoded. **So the defect is the file-wide binding convention, not a
slip at one call site**, and the fix must sweep `db/workflows.py` rather than patch three lines.

**Consequence worth naming:** you cannot currently query what workflows were run *with* — no SQL over
`inputs->>'…'` works. Any usage analytics, debugging-by-query, or per-customer reporting built on run
inputs would silently return nothing.

## Confidence

**Measured 2026-08-12:** the codec registration; the three `definition` write bindings; the A/B result
above; the 83/20 split; zero `phases` on the string rows; both defensive read unwraps; the
`create_workflow_run` binding and the 205/205 `inputs` result.
**Not checked:** `harness_audit` payload columns and any other jsonb column outside `db/workflows.py`
— **sweep them before sizing the fix**, since the two checked so far both had it.

## Related

[[SEED-085]] · Phase 192.1 / LIB-05 (adjacent discovery, unrelated cause)


---

## Routing at `/gsd:plan-phase 200.1` (2026-08-20) — LEFT OPEN, and the trigger did NOT fire

Phase 200.1 measured the **identical defect on a THIRD column** — `workflow_phases.output` is a jsonb
STRING SCALAR on **527 of 588** rows and on **484 of 484 `completed`** ones, from the identical cause
(`json.dumps` handed to a `$N::jsonb` parameter on a pool whose `_init_pg_connection` already registers
`encoder=json.dumps`). There, the phase takes **both** repairs — a shared read-side unwrap AND the
writer fix at the three terminal `workflow_phases` writers — with **no migration** (`D-200.1-01`).

⚠ **This seed is NOT folded and its status is unchanged, deliberately.** Phase 200.1 does not touch
`workflow_definitions.definition` or `workflow_runs.inputs` on the write path, and its plan `200.1-01`
asserts that by fence (`json.dumps(inputs)` and the four `json.dumps(definition.model_dump(...))` sites
are proved byte-unchanged). The deferral recorded in `STATE.md` and in migration 123's header —
*"flipping a writer alone gives a table with two shapes in it"* — is **honoured in writing**.

**What is worth carrying forward when this seed IS taken:** 200.1's argument for why `output` could be
repaired alone is migration 123's own stated condition — *one reader that already accepts BOTH shapes*.
That is the precondition to create for `definition` too, and it is cheaper than a migration. Trigger
unchanged: **the next phase that touches these columns on the WRITE path.**
