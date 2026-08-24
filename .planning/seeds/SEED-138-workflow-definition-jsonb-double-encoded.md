---
seed_id: SEED-138
title: "workflow_definitions.definition is stored as a jsonb STRING for 118 of 145 rows and a jsonb OBJECT for 27 — both encodings are being written concurrently, so `definition->'key'` silently returns NULL for 81% of rows and no SQL predicate over definition contents can be trusted"
status: open
planted: 2026-07-31
phase_origin: "Surfaced 2026-07-31 while diagnosing BUG-260731-03 (a publish-gauntlet judge failure traced to an unbound workflow). The diagnostic query `select definition->'project_folder_id' …` returned NULL — which turned out to mean 'this row is a jsonb string', not 'this workflow is unbound'. The two are indistinguishable in SQL today, which is precisely why this matters."
folded_into: null
category: "Data-encoding consistency / observability — not a live user-facing defect (the app tolerates both shapes on read), but it silently disables every SQL-side capability the jsonb column exists to provide: predicates, GIN indexing, admin/analytics queries, and any future migration or backfill that reads inside the definition."
related_seeds: [SEED-132]
related_decisions:
  - "`backend/app/db/workflows.py:349` documents the intended write contract verbatim: 'The ``definition`` JSONB is ``json.dumps(definition.model_dump(mode=\"json\"))`` + ``$N::jsonb`` (mirror create_workflow_run — this file uses no pool JSONB codec).' With asyncpg and NO registered jsonb codec, a Python str parameter is sent as text and `$N::jsonb` casts it to a jsonb OBJECT. So this path should produce objects, and the intent is clearly an object."
  - "`backend/app/services/harness/publish_service.py:127-133` already tolerates the string form (`if isinstance(raw_definition, str): json.loads(...)`) before `WorkflowDefinition.model_validate`. That tolerance is why nothing has broken — and also why nothing has surfaced the divergence."
confirmed:
  - "The split is real and roughly 4:1. `select jsonb_typeof(definition), count(*) from workflow_definitions group by 1` → `string: 118`, `object: 27` (145 total, local dev DB, 2026-07-31)."
  - "BOTH encodings are being written concurrently — this is NOT a legacy-then-fixed story. Created-at ranges OVERLAP: objects span 2026-05-31 → 2026-07-30, strings span 2026-06-14 → 2026-07-31. Two live write paths disagree."
  - "The consequence is silent. For a jsonb string, `definition->'project_folder_id'` returns SQL NULL rather than erroring, and `jsonb_set(definition, '{k}', …)` raises `cannot set path in scalar`. So reads degrade quietly and writes fail loudly — the worst combination for auditing."
  - "The app is unaffected at runtime: `publish_service.py:127-133` json.loads-es a string definition before validating, so both shapes parse."
  - "The most recent app-authored draft (`d4ed9d41-8ac5-42fe-b143-c3fc86517b9e`, the Compliance Gap Report that triggered this investigation) is a STRING, while two recently script-inserted probes (`SC10 armed-wait probe`, `SC10 multi-tool probe`) are OBJECTS."
needs_confirmation:
  - "WHICH write path emits the string form. Not identified — this is the seed's main open question and must be answered before any backfill. `db/workflows.py:366` and `:420` (asyncpg, `json.dumps(...)` + `$N::jsonb`, no pool codec) should produce OBJECTS by asyncpg's text-then-cast semantics, and the file's own docstring says so. The two supabase-py writers found (`skill_snapshot.py:253`, `workflow_kickoff.py:210`) touch `skill_snapshots` and `status`, NOT `definition`. So the string-producing writer was not located in a first pass. Candidates to check: any PostgREST/supabase-py write of `definition` elsewhere, a pool that DOES register a jsonb codec (making the str get JSON-encoded rather than cast), the NL-generate/draft-stamp path, or seed/fixture scripts. Verify by writing one definition through each path in a scratch DB and reading back `jsonb_typeof`."
  - "Whether a backfill is wanted at all. Project memory records that all `workflow_definitions` rows are test data / fixtures with no grandfathering to design around, so `delete + reseed` may be strictly cheaper and safer than an UPDATE over 118 rows. Decide that BEFORE writing migration SQL — a normalising migration on fixture data is wasted risk."
  - "Whether any shipped code reads inside `definition` from SQL. If yes, it is silently wrong for 81% of rows TODAY and this seed's priority rises from medium to high. Grep for `definition->`, `definition->>`, `definition #>`, and `jsonb_path_query(definition` across `backend/`, `supabase/migrations/`, and any admin/analytics query."
re_open_triggers:
  - "PRIMARY — anyone writes a SQL predicate, view, index, or migration that reads INSIDE `definition` (`definition->…`, `definition->>…`, `jsonb_path_query`, a GIN index on `definition`). It will silently match only the 27 object rows and look like it works. This includes the obvious near-term one: an admin or operator query answering 'which workflows are unbound?' — the exact question BUG-260731-03 makes people want to ask, and the exact question this encoding makes unanswerable."
  - "Any Control-Room / operator surface that lists or filters workflows by something stored inside the definition (phase count, phase type, tools used, bound folder). Server-side filtering will be wrong; the surface would have to pull every row and filter in Python, which is a scaling trap rather than a bug."
  - "Cloud parity work that copies `workflow_definitions` between environments, or any dump/restore that assumes a uniform shape."
  - "A future `WorkflowDefinition` schema change that ships a data migration touching stored definitions — it must handle both shapes or it silently skips 81% of rows."
priority: medium
suggested_phase: "Unassigned — deliberately. This is a data-hygiene finding with no live user impact, so it should NOT displace roadmap work. Cheapest honest close is (1) identify the string-producing writer, (2) make it agree with `db/workflows.py`, (3) delete + reseed the fixture rows rather than migrate them. Natural pickup alongside any phase that adds SQL-side querying over definitions (a Control-Room workflows view, or an admin filter) — that is the moment the cost becomes real."
---

# SEED-138 — `workflow_definitions.definition` has two encodings in one column

## What was observed

```
select jsonb_typeof(definition), count(*), min(created_at)::date, max(created_at)::date
  from workflow_definitions group by 1;

  object   n=27    created 2026-05-31 .. 2026-07-30
  string   n=118   created 2026-06-14 .. 2026-07-31
```

The column is `jsonb`. For 118 rows its value is a JSON **scalar string** whose *content*
is the definition JSON — double-encoded. For 27 rows it is a proper JSON **object**.

The date ranges **overlap**, so this is not "we used to do it wrong and then fixed it."
Two write paths are live right now and they disagree.

## Why it is not currently breaking anything

`publish_service.py:127-133` defensively json.loads-es a string definition before
`WorkflowDefinition.model_validate`. Every runtime reader goes through Python, so both
shapes parse and the app behaves correctly. That tolerance is load-bearing and should not
be removed casually — but it is also why this has gone unnoticed.

## Why it still matters

The `jsonb` type buys exactly one thing over `text`: the database can look *inside* the
value. For 81% of rows it currently cannot.

- `definition->'project_folder_id'` returns **SQL NULL**, not an error, for a jsonb string.
- `jsonb_set(definition, '{k}', …)` raises `cannot set path in scalar`.
- A GIN index on `definition` would index 27 rows meaningfully and 118 as opaque strings.

So reads degrade **silently** and writes fail **loudly** — the worst pairing. A query that
looks correct, runs clean, and returns a plausible answer is wrong 4 times out of 5.

## The concrete way this already cost time

This seed was found while diagnosing BUG-260731-03. The natural diagnostic was:

```sql
select id, name, definition->'project_folder_id' from workflow_definitions;
```

For the blocked workflow that returned `NULL` — which was *interpreted* as "this workflow
is unbound", and happened to be true. But it would have returned `NULL` just the same for a
**correctly bound** workflow stored as a string. The two conditions are indistinguishable
in SQL today.

That is the sharp edge: **"which of my workflows are unbound?" is currently unanswerable in
SQL** — and BUG-260731-03 is precisely the bug that makes an operator want to ask it.

## How we would know this is closed

1. `select jsonb_typeof(definition), count(*) from workflow_definitions group by 1` returns
   a **single** row, `object`.
2. The write path that produced strings is identified and named in the fix commit — not
   just corrected. A backfill without a root cause re-diverges on the next write.
3. A test writes a definition through **every** production write path and asserts
   `jsonb_typeof(definition) = 'object'` for each. This is the regression guard; without it
   the column silently re-splits.
4. `publish_service.py:127-133`'s string tolerance is **kept** (defence in depth for any
   row that predates the fix or arrives from a restore) but is no longer *needed* — provable
   by a query returning zero string rows.
5. `select id from workflow_definitions where definition->'project_folder_id' is null`
   returns exactly the genuinely-unbound workflows, and a spot-check confirms a bound one
   is absent from that list. That is the query BUG-260731-03 wanted and could not have.


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
