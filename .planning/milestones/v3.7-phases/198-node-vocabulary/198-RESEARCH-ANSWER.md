---
phase: 198-node-vocabulary
status: answered_ships_nothing
answered: 2026-08-20
answered_at_head: e0c57ef4
branch: develop
requirements: [NODE-01, NODE-02]
node_01_verdict: ships_nothing
node_02_verdict: already_satisfied
plans_written: 0
commits: 0
---

# Phase 198: Node Vocabulary — ANSWERED, shipping nothing

**This phase was never executed and does not need to be.** Its own ROADMAP entry says
*"Research-first — NODE-01 may legitimately ship nothing"*, and its SC#1 is a COUNT, not a build.
The count was taken. It is **zero**.

## SC#1 — the count. **0 of 264 phases.**

> *"count how many prompts in real workflows exist only to reshape data between two real steps.
> If the number is low, NODE-01 ships nothing and says so."*

**Measured 2026-08-20 against the live local DB at `127.0.0.1:54322`.**

| Population | Figure |
|---|---|
| `workflow_definitions` rows | **291** |
| …of which carry ≥ 1 phase | **119** |
| total phases across them | **264** |
| phases sitting STRICTLY BETWEEN two other steps | **38** |
| …excluding `external_action` + `llm_human_input` (real capabilities, not plumbing) | **25** |
| **middle phases whose prompt exists ONLY to reshape data** | **0** |
| **phases at ANY position matching a reshape verb** | **0** |

### The unwrap is load-bearing and this query used it

`workflow_definitions.definition` is a jsonb **STRING SCALAR on 261 of 291 rows** (measured this
session: `string` 261 · `object` 30 — the recorded trap, root-caused during Phase 200's finishing
pass to `_init_pg_connection`'s pool-level `encoder=json.dumps` double-encoding). A naive
`definition->'phases'` returns SQL NULL on 90% of the corpus and answers a **confident, vacuous 0**.
Every figure above was taken through:

```sql
(case when jsonb_typeof(definition)='string'
      then (definition #>> '{}')::jsonb
      else definition end)
```

### Non-vacuity control — the sweep is proven able to find things

A zero from a scan is worthless without a positive control on the same scan. Run on the identical
264-phase population:

- reshape verbs (`reformat|convert|transform|restructure|reshape|serial|json|csv|normali|flatten|rename`) → **0 hits**
- control verbs (`search|summar`) → **147 of 264 hits**

The scanner reads prompts correctly. The zero is a fact about the corpus, not about the query.

### What the 25 real middle prompts actually are

Read individually, not sampled. Every one does REAL work — knowledge-base retrieval
(`Search the knowledge base for Northwind Logistics support history…`), synthesis
(`Using the gathered evidence, write the content for a quarterly business review`), extraction with
citations, or chart generation via code. The closest candidate — `dba-research-stat-summary`
step 2/5, *"pull the statistical elements out of the DBA research … compile them into a clean,
structured dataset"* — is an ANALYSIS step over source documents, not a format conversion between
two steps' outputs.

The 15 phases with an EMPTY prompt were checked separately in case plumbing hides there. All are
`external_action` (a real capability), `programmatic` fan-out planners at **step 1** (never
between two steps), or the two `zz-200-06-*` test fixtures. **None is a reshape step.**

⚠ **Two seeded fixtures are still in the local DB** and are excluded from every "real workflow"
figure above: `zz-200-06-fixture-constructor`, `zz-200-06-fixture-harmless`. So are
`skip_probe_188uat` and the `*uat*` probes.

**⇒ NODE-01 SHIPS NOTHING.** The deterministic primitive has no population to serve. Authors are
not writing LLM prompts to reshape data between steps — when they need determinism they reach for
`execute_code`, which is the incumbent SEED-141 said any proposal must beat, and it is unbeaten
because it is unchallenged.

## SC#2 — vacuously satisfied

> *"Any primitive proposed answers three constraints explicitly."*

**No primitive is proposed.** The three constraints (the spine is LINEAR, governance vocabulary
assumes an AI step, a node's face is computed from its config) are therefore untested rather than
met — recorded so a future proposal cannot cite this phase as having cleared them.

## SC#3 — already satisfied, and DRIVEN

> *"Structured mid-run input is covered — starting from what `llm_human_input` already does, not
> from a blank form node."*

**Satisfied before this phase would have run, and proved by a real run rather than by reading code.**

- `llm_human_input` ships and appears **8 times** in the live corpus.
- Phase `200-03` EXTRACTED its executor out of `phase_types.py` into
  `backend/app/services/harness/human_input.py` — which also discharged this phase's own G-5 flag
  on that file, and did it as the vehicle for the fix rather than as tidying.
- `BUG-260816-06` is fixed there: an unanswered step now **pauses the run and never approves**
  (it previously timed out into a silent approval on four of five real runs at exactly the 300 s
  mark). `human_input.py:278-283` records the measurement in place.
- **Driven end to end 2026-08-20**: a published human-input workflow ran, the approval card
  rendered inside the run spine at its own step with the STEP'S OWN AUTHORED CHOICES (not a fixed
  Approve/Send back), and answering it resumed the run to completion. First time it had ever been
  seen render.

## What this phase does NOT close

- **NODE-01 is answered, not deleted.** Re-open trigger: **any workflow definition appearing whose
  middle step exists only to reshape data** — re-derive the count with the query above (unwrap
  included, control included). A single real instance is not a mandate; a shelf of them is.
- **Branching stays OUT and is a different question.** The spine is LINEAR by design and
  `WorkflowDefinition.phases` is a flat `list[PhaseSpec]` with no branch construct. Branching is
  backlog foundation 2 in `STATE.md` and is the best value per unit of work in the remaining
  backlog — but it is not NODE-01, and answering NODE-01 zero does not answer it.
