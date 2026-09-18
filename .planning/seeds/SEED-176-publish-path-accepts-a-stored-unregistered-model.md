---
seed_id: SEED-176
title: The publish gauntlet reads the STORED definition, so a workflow saved before Phase 196 can carry an unregistered `config.model` and publish without ever meeting the save-path refusal — measured population zero, no eighth stage added, deliberately
created: 2026-08-18
planted_during: Phase 196 close (plan 196-09); the gap was measured and the decline recorded by plan 196-06
status: planted
priority: low
relates_to:
  - Phase 196 D-09 / plan 196-06 — the save-path refusal at both write doors, which is the wall this
    seed says publish sits behind rather than in front of.
  - Phase 196 D-10 / plan 196-03 — the RUN-TIME enabled check in the harness, which already covers the
    dangerous half for every path INCLUDING publish.
  - Phase 196 D-08 — the grandfather branch for already-stored values, itself dead code by measurement
    with its own re-open trigger (see below).
  - Phase 102 / 127 — the 8-stage publish gauntlet and its doubly-documented ordering.
  - The hot-file ledger's publish_service.py section (docs/HOT-FILE-LEDGER.md) — a G-5-firing file,
    which is half the reason no eighth gauntlet stage was added.
trigger_when: >
  The first `workflow_definitions` row observed carrying a `config.model` absent from
  `build_model_registry_rows()`. The detecting query is below; a non-zero `unknown_phases` is the
  signal.
surface: Agentic-RAG
---

# The gap, stated plainly

Phase 196 put a wall in front of the two **write** doors. `POST /workflows` and
`PATCH /workflows/{id}` now refuse a **newly-introduced** unregistered `config.model` with an
object-shaped 400, after ownership and before any write.

**Publish does not go through either door.** It reads the **STORED** definition. So a definition saved
**before** this phase can carry an unregistered model and reach publish without ever meeting the
refusal. **That is real and it is not hand-waved.**

# It is measured EMPTY, and the command is here so the next reader re-derives

Run at plan `196-06`'s execution time against the live local Postgres:

```
$ cd backend && ./venv/Scripts/python.exe -c "
import psycopg2, json, collections
c=psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); cur=c.cursor()
cur.execute('select id, definition from workflow_definitions'); rows=cur.fetchall()
n=0; m=collections.Counter()
for _,d in rows:
    d=json.loads(d) if isinstance(d,str) else d
    for p in (d.get('phases') or []):
        n+=1; m[(p.get('config') or {}).get('model') or '<blank>']+=1
print(len(rows), n, dict(m))"
270 257 {'<blank>': 239, 'gpt-5.4': 18}
```

```
union= 69 code= 61 ovr= 37
phases_with_model= 18 unknown_phases= 0 unknown_ids= {}
gpt-5.4 in union: True | gpt-5.2 in union: True
```

| Quantity | Measured 2026-08-18 |
|---|---|
| workflow definitions | **270** (was 242 at planning time — an operator authored 28 in between) |
| phases across them | **257** |
| phases carrying NO model | **239** (93 %) |
| phases carrying a model | **18, all `gpt-5.4`** — registry-known and enabled |
| ⚠ **phases in the unknown state** | ⚠ **0** |

> **RE-OPEN TRIGGER — MECHANICAL. Re-run the two commands above; `unknown_phases` > 0 is the signal**,
> and `unknown_ids` names the offending model. ⚠ **Re-run it against CLOUD as well as local** — the
> populations are different databases and cloud config drift is this project's recorded #1 gotcha.

# Why no eighth gauntlet stage was added

Four reasons, and the first is the one that decides it:

1. ⚠ **It would be a genuine SECOND concern in a doubly-documented 8-stage ordering.** The gauntlet's
   sequence is recorded in two docstrings with a standing rule that *"the two docstrings must never
   disagree"*. Adding a stage means editing both, renumbering, and re-establishing the ordering
   evidence — to catch a population measured at **zero**.
2. **`publish_service.py` is a G-5-firing file** (20 commits / 8 phases / 1250 lines at this close).
   Adding a stage there inside a model-picker phase is smuggling a refactor's worth of risk into a
   feature phase, which is what G-5 exists to prevent.
3. ⚠ **D-10 already covers the dangerous half, for every path including publish.** The harness's
   run-time `_effective_model_checked` routes every per-phase model through the shipped enabled
   resolver and substitutes with a visible `model_fallback` sub-step and a durable `policy_applied`
   audit row. **An unregistered model cannot silently reach a provider**; what it can do is publish.
4. **The blast radius of getting it wrong is asymmetric.** A wrong eighth stage makes existing
   workflows unpublishable — the retroactive-brittleness failure D-08 exists to forbid. An absent
   eighth stage, today, blocks nothing that D-10 does not already catch.

# What to build when the trigger fires

**Not necessarily a stage.** Weigh these in order:

- **A pre-publish READ-ONLY report** — name the offending phase and model in the gauntlet's existing
  finding vocabulary without adding a gate. Catches the case, changes no publish outcome, costs no
  ordering edit.
- **A migration-time sweep** — rewrite or blank the offending `config.model` values once, then the
  population is empty by construction rather than by luck.
- **A stage, last.** If it is a stage, it must be **membership, never availability** (a DISABLED model
  must still publish — disabling a model retroactively breaking every workflow naming it is the same
  brittleness D-08 forbids), and it must grandfather **by phase slug**, never by value-anywhere.

# The sibling dead branch, recorded here so it is not rediscovered separately

**D-08's grandfather branch — the one that lets an already-stored unregistered value survive a PATCH —
is DEAD CODE TODAY BY MEASUREMENT, not by stubbing.** It is fully implemented and fully tested
(`test_patch_grandfathers_an_already_stored_unregistered_value`,
`test_patch_grandfather_is_scoped_to_the_same_phase_slug`); the population it serves is the same zero
measured above. It exists so D-08's promise is true the day it stops being dead, and the tests are
what keep it honest while the population is empty.

> **Its re-open trigger is the SAME query**: the first row observed carrying a `config.model` absent
> from `build_model_registry_rows()`. When that arrives, both this seed and the grandfather branch
> stop being hypothetical in the same instant.

# What this seed does NOT claim

- It does **not** claim any workflow has ever published with an unregistered model. **0 of 257 stored
  phases**, measured twice, with the command published.
- It does **not** claim publish is unguarded. Seven stages ship, and D-10 stands behind all of them at
  run time.
- ⚠ It does **not** claim the AI-draft path needs its own guard. `generate_workflow` emits no
  `config.model` (`grep -n '"model"' backend/app/services/workflow_authoring.py` → **zero hits**) and
  the definition it returns is **not persisted** — the client must POST or PATCH it, which is where
  the refusal already lives. That coverage is **structural**, which is stronger than a guard.
