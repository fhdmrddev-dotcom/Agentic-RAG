---
phase: 196-registry-backed-model-picker-canvas
plan: 06
subsystem: workflow-definition-crud
tags: [authz, input-validation, model-registry, refusal-register, g-5, AUTH-04, SC#2]
requires:
  - phase: 196-04
    provides: "backend/app/services/model_registry.py — build_model_registry_rows, the ONE union this refusal derives its known set from"
  - phase: 186
    provides: "update_draft's three-cause refusal register + the deliberately-dull not_found this refusal must not disturb"
  - phase: 149
    provides: "_registry_row's enabled semantics (absent override row == enabled) that the membership set inherits"
provides:
  - "registered_model_ids() — the union-derived MEMBERSHIP set (disabled + deprecated + DB-only rows INCLUDED)"
  - "unregistered_phase_models() — the lazy offender probe that lets the update door resolve ownership before it refuses"
  - "assert_phase_models_registered(definition, *, previous=None) — the object-shaped 400 with D-08's grandfather"
  - "POST /workflows and PATCH /workflows/{id} both refuse a NEWLY-INTRODUCED unregistered config.model"
affects:
  - "196-05 (ModelField — the picker's disable is now courtesy backed by a server wall)"
  - "196-09 (owes the hot-file ledger re-derivation for backend/app/api/workflows.py — D-23)"
tech-stack:
  added: []
  patterns:
    - "lazy refusal probe: ask the cheap question (is there an offender?) before paying for the owner-scoped read the grandfather needs — which is also what puts OWNERSHIP before the refusal"
    - "not-owned FALLS THROUGH to the existing write rather than raising, so a new refusal cannot become an existence oracle"
    - "route-level policy, never a Pydantic validator, when the invariant must be allowed to be false for already-stored data"
key-files:
  created:
    - backend/tests/test_196_save_refusal.py
  modified:
    - backend/app/services/model_registry.py
    - backend/app/api/workflows.py
key-decisions:
  - "The known set derives from build_model_registry_rows, NEVER from the narrower offerable helper. Two incompatible `enabled` semantics ship today; the narrower one would refuse a SAVE for ~32 models the engine runs — a different lie, not an absence of one."
  - "MEMBERSHIP, not availability: a DISABLED model still saves (D-10). Making disabled a save-time refusal would mean disabling a model retroactively breaks every workflow naming it — the same brittleness D-08 forbids for a retired row."
  - "In update_draft, a row the caller does NOT own falls through to the existing 0-row UPDATE instead of raising. A 400 for a stranger would be an existence oracle wearing a different status code; a pre-emptive 404 would have turned an owner's published-row PATCH from 409 into 404."
  - "The grandfather is matched by PHASE SLUG, not by value-anywhere-in-the-definition. Value-anywhere would make the 'newly-introduced' scoping vacuous — one retired model would license it on every node."
  - "The stored-row read is LAZY. 239 of 257 stored phases carry no model, so the ordinary autosave pays zero extra queries, and the existing mocked-pool route tests keep byte-identical call sequences."
  - "The publish gauntlet is deliberately NOT given an eighth stage — measured-empty gap, recorded with a re-open trigger."
requirements-completed: [AUTH-04]
duration: ~45min
completed: 2026-08-18
---

# Phase 196 Plan 06: The Save-Path Model Refusal Summary

**`config.model` was validated by nothing — not on save, not at publish, not at run. Both
write doors now refuse a newly-introduced unregistered model with an object-shaped 400,
after ownership and before any write, while a blank, a disabled and an already-stored value
all still save.**

## Performance

- **Duration:** ~45 min (bootstrap → task 2 commit)
- **Tasks:** 2/2
- **Files created:** 1 · **Files modified:** 2
- **Commits:** `d49956de` (RED) · `b5b80441` (GREEN)

## What shipped

| Layer | Change |
|---|---|
| Service (leaf) | `registered_model_ids` · `unregistered_phase_models` · `assert_phase_models_registered` · `_phase_model_pairs` |
| Route | `create_draft` — one awaited call after the status force, before the write |
| Route | `update_draft` — the lazy offender probe, the owner-scoped read, the same awaited call with `previous` |
| Tests | 11 cases, zero DB access, runs on a machine with no Postgres |

## The Task 1 RED output, verbatim

```
=========================== short test summary info ===========================
FAILED tests/test_196_save_refusal.py::test_create_refuses_a_new_unregistered_model_before_any_write
FAILED tests/test_196_save_refusal.py::test_patch_refuses_a_newly_introduced_unregistered_model
FAILED tests/test_196_save_refusal.py::test_patch_grandfathers_an_already_stored_unregistered_value
FAILED tests/test_196_save_refusal.py::test_patch_grandfather_is_scoped_to_the_same_phase_slug
FAILED tests/test_196_save_refusal.py::test_a_non_owner_patch_carrying_an_unregistered_model_is_the_same_dull_404
FAILED tests/test_196_save_refusal.py::test_the_ordering_holds_for_a_blank_model_too
6 failed, 5 passed, 1 warning in 0.80s
```

And the RED is the RIGHT red — the create door's failure reason, verbatim:

```
E               Failed: DID NOT RAISE <class 'fastapi.exceptions.HTTPException'>
```

⚠ **Five cases were GREEN at Task 1, and that is stated rather than smoothed.** The plan's
Task 1 `<action>` authors the leaf helpers AND the test file in the same task, so the two
pure-leaf cases (`registered_ids_are_the_union…`, `blank_and_empty_and_phaseless…`) and
three no-offender route cases had their subject already present. **The six that failed are
exactly the six that depend on a route hook**, which is what Task 2 adds. Post-Task-2:
**11 passed**.

## The live re-derivation, with its command

Re-derived at execution time per the plan's instruction (an operator can author a workflow
between planning and execution — and one did: **242 definitions at plan time, 270 now**).

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

And the union membership question the D-08 branch actually turns on:

```
union= 69 code= 61 ovr= 37
phases_with_model= 18 unknown_phases= 0 unknown_ids= {}
gpt-5.4 in union: True | gpt-5.2 in union: True
```

| Quantity | Plan/RESEARCH | **Measured 2026-08-18** | Verdict |
|---|---|---|---|
| workflow definitions | 242 | **270** | ⓘ +28 since planning |
| phases across them | 257 | **257** | ✅ |
| phases with no model | 239 (93 %) | **239** | ✅ |
| phases with a model | 18, all `gpt-5.4` | **18, all `gpt-5.4`** | ✅ |
| **phases in the D-08 unknown state** | 0 | **0** | ✅ |
| registry union size | 69 | **69** | ✅ |

**The D-08 grandfather branch is dead code today, as a MEASUREMENT** — zero phases carry a
model the union does not know. It exists so D-08's promise is true the day it stops being
dead, and `test_patch_grandfathers_an_already_stored_unregistered_value` is what keeps it
honest while the population is empty.

## D-11, re-confirmed by command at execution time (not inherited)

```
$ grep -n '"model"' backend/app/services/workflow_authoring.py
(exit 1 — zero hits)
```

And `generate_workflow` reads, verbatim from the source at `api/workflows.py:1583` and
`:1610`:

```
# NOT persisted (persistence is REQ-1's explicit POST /workflows create).
  - ``{ok: True, definition}`` -> a draft object the Builder loads (NOT persisted);
```

**The AI-draft path is therefore covered STRUCTURALLY by the two hooks, with no separate
guard.** The generator emits no `config.model`, and even if it did, the definition it
returns is unpersisted — the client must POST or PATCH it, which is where the refusal lives.
*Having the drafter choose a fit model* stays explicitly OUT (it collides with AUTH-02 /
Phase 197).

## The publish path — a known, MEASURED-EMPTY gap, with its re-open trigger

**Publish reads the STORED definition, so a definition saved before this phase could carry
an unregistered `config.model` and publish without ever meeting the refusal. That is real.**
It is also measured empty: **0 of 257 stored phases are in the unknown state** (command
above), and the 18 that carry a model carry `gpt-5.4`, which is registry-known and enabled.

**No eighth gauntlet stage was added, deliberately.** The gauntlet's ordering is doubly
documented (*"the two docstrings must never disagree"*), `publish_service.py` is itself a
G-5-firing file (19 commits / 7 phases), and a stage there would be a genuine second concern
added to catch an empty population. D-10's run-time enabled-check already covers the
dangerous half for every path including publish.

> **RE-OPEN TRIGGER:** the first `workflow_definitions` row observed carrying a
> `config.model` absent from `build_model_registry_rows()`. Re-derive with the union command
> above; a non-zero `unknown_phases` is the signal.

`git diff --name-only` does not contain `backend/app/services/harness/publish_service.py`
(grep count **0**), and the four diff hunks in `workflows.py` are at `:43` (db import),
`:65` (leaf import), `:1165` (`create_draft`) and `:1273` (`update_draft`) — the publish
route at `:1057-1120` is byte-unchanged.

## Security: the ordering is proven by test, never by comment

**T-196-ORACLE.** `update_draft`'s `not_found` is deliberately *"the dullest of them"*. A 400
that fired before ownership resolved would be an existence oracle wearing a different status
code. The shipped shape:

```python
if await unregistered_phase_models(body):
    stored = await get_definition(pool, definition_id, user_id=user_id)
    if stored is not None and str(stored.get("created_by")) == str(user_id):
        await assert_phase_models_registered(body, previous=...)
```

- A **non-owner** carrying an unregistered model falls through to the existing 0-row UPDATE
  and meets today's byte-identical `404 "draft not found"` — asserted directly by
  `test_a_non_owner_patch_carrying_an_unregistered_model_is_the_same_dull_404`, including
  `isinstance(detail, str)` so a dict detail (where a machine code would live) fails.
- ⚠ **`get_definition` also returns GLOBAL PUBLISHED rows to non-owners**, which is why the
  explicit `created_by == user_id` comparison is there rather than a bare `is not None`.
  Grandfathering off someone else's global row would have made the 400-vs-404 difference an
  oracle by a second route.

**T-196-IV1.** The refusal reaches no write, asserted rather than assumed: a `_RecordingPool`
records `execute`/`fetch`/`fetchrow` and must be empty, AND the db-layer writer's
`await_args_list` must be empty. A status-code-only assertion proves an error was raised, not
that a write was prevented.

**T-196-BRICK.** Scoped to newly-introduced values, matched by **phase slug** —
`test_patch_grandfather_is_scoped_to_the_same_phase_slug` fences the alternative, because a
value-anywhere match would make the scoping vacuous.

**T-196-SEMANTIC.** `grep -c 'enabled_model_allowed_set' backend/app/services/model_registry.py`
→ **0**. `test_registered_ids_are_the_union_including_disabled_and_db_only` asserts a
disabled row and a DB-only row are both members, with a non-vacuity floor
(`len(known) > len(_OVERRIDES)`).

**T-196-PUB** — accept, with the re-open trigger above. **T-196-SC** — no packages installed.

## Verification

| Check | Result |
|---|---|
| `pytest tests/test_196_save_refusal.py -q` (Task 1, RED) | **6 failed / 5 passed** |
| `pytest tests/test_196_save_refusal.py -q` (Task 2, GREEN) | **11 passed**, assertions byte-identical to Task 1 |
| `pytest test_196_save_refusal + test_186_concurrent_patch + test_103_draft_crud + test_103_published_409 + test_workflows_routes + test_196_model_registry_route -q` | **47 passed** |
| Backend suite — recorded pre-plan baseline | **211 failed, 4025 passed, 1 error** |
| Backend suite — post-plan | **211 failed, 4036 passed, 29 skipped, 5 xfailed, 9 xpassed, 1 error** (368.58s) |
| Failing count vs baseline | **IDENTICAL — 211 both runs**; passed **+11** = exactly this plan's 11 new cases |
| Pre-existing ERROR | `tests/integration/test_077_cross_cancel.py` — unchanged, 1 both runs |
| `grep -c 'assert_phase_models_registered' backend/app/api/workflows.py` | **3** (1 import + 2 call sites) ✅ |
| `grep -c 'model_validator' backend/app/models/harness.py` | **7** — unchanged from the pre-plan value ✅ |
| `grep -cE 'INSERT INTO\|UPDATE workflow_definitions' backend/tests/test_196_save_refusal.py` | **0** ✅ |
| `git diff --name-only` contains `publish_service.py` | **no** ✅ |
| `bash scripts/check-deploy-drift.sh` | **PASS** |
| Deleted files across the plan | **none** (`git diff --diff-filter=D` empty on both commits) |

⚠ **The suite comparison is COUNT-level, not id-level** — the same honest limitation 196-04
recorded. No per-id baseline list exists to diff against. What can be said: the failing count
is exactly equal (211 = 211) and the passed delta is exactly the 11 cases this plan adds.

⚠ **No frontend test was run.** This plan is backend-only and a third concurrent vitest agent
makes the count gate non-deterministic regardless of cap. `git diff --name-only` names zero
files under `frontend/`.

## Deviations from Plan

### [Rule 3 - Blocking] The plan's update-door ordering is UNSATISFIABLE as literally written

- **Found during:** Task 2 planning, reading `db/workflows.py:710-810`.
- **Issue:** the plan says *"place the call **after** the existing ownership/`not_found`
  resolution has produced the stored row"* and separately *"BEFORE any write"*. **Those two
  cannot both hold**, because `update_draft` has no ownership resolution before its write —
  ownership lives INSIDE `update_workflow_definition`, as the `created_by = $2` conjunct on
  the UPDATE itself, disambiguated afterwards by an owner-scoped probe. By the time the plan's
  "stored row" exists, the write has already happened.
- **Fix:** a **lazy owner-scoped read** in the route. `unregistered_phase_models(body)` asks
  the cheap question first; only when there is an offender does the route call
  `get_definition(pool, definition_id, user_id=user_id)` and check `created_by`. Both of the
  plan's requirements then hold literally — ownership is resolved first, and the 400 fires
  before any write.
- **Why lazy and not unconditional:** an unconditional pre-read would have cost every autosave
  an extra query for a grandfather that can never apply (239 of 257 stored phases carry no
  model), and it would have changed the call sequence every mocked-pool route test in
  `test_186_concurrent_patch.py` depends on. `test_the_ordering_holds_for_a_blank_model_too`
  pins the laziness so it cannot silently become unconditional.
- **Why not-owned FALLS THROUGH instead of raising a pre-emptive 404:** a pre-emptive 404
  would have turned an **owner's** PATCH of their own **published** row into a 404 where it is
  a 409 `already_published` today. Falling through preserves all three of today's refusals
  byte-for-byte and still keeps the 400 off the non-owner path.
- **Files:** `backend/app/api/workflows.py`, `backend/app/services/model_registry.py`
- **Commit:** `b5b80441`

### [Rule 3 - Blocking] The plan's `<15 changed lines` criterion, measured and MISSED at 22

- **Measured:** `git diff --stat backend/app/api/workflows.py` → **22 insertions, 0
  deletions**. Split, because the split is the point: **9 code lines, 13 comment lines.**
- The nine code lines, verbatim:
  ```
  +    get_definition,
  +from app.services.model_registry import assert_phase_models_registered, unregistered_phase_models
  +    await assert_phase_models_registered(body)
  +    if await unregistered_phase_models(body):
  +        stored = await get_definition(pool, definition_id, user_id=user_id)
  +        if stored is not None and str(stored.get("created_by")) == str(user_id):
  +            await assert_phase_models_registered(
  +                body, previous=_coerce_definition(stored.get("definition"))
  +            )
  ```
- **Not waived, and not smoothed by deleting comments.** The criterion's stated purpose is
  *"the call-out-not-a-concern shape"*, and the CODE diff satisfies it at 9. The overage is
  entirely the comment recording *why* the not-owned case falls through — which is the single
  most load-bearing line of reasoning in this plan and exactly the kind of thing this module's
  own culture (and this ledger's repeated finding) says must be written down at the site.
  ⚠ Recording it as a MISS rather than re-reading the criterion to fit: a fence that gets
  reinterpreted the first time it fires is not a fence.

### [Rule 3 - Blocking] An acceptance grep tripped on PROSE — the 196-04 finding, reproduced

- **Found during:** Task 1 acceptance.
  `grep -cE 'INSERT INTO|UPDATE workflow_definitions' backend/tests/test_196_save_refusal.py`
  returned **1**. The hit was inside the module docstring, in a sentence asserting that the
  grep must return 0.
- **Fix:** reworded to name the two SQL write verbs descriptively instead of quoting them, with
  an explicit note that a grep for the literals here must come back empty — so the prose
  defends the fence instead of tripping it. Now **0**.
- **Why not pedantry:** 196-04 hit this on five separate criteria and reached the same verdict.
  A fence a comment can trip is a fence that gets waived the next time it fires.
- **Commit:** `d49956de`

### [Correction to the plan's interfaces block, not a deviation]

The plan's `<interfaces>` says the AI-draft path is at `api/workflows.py:1577`. Re-read at
execution time it is **`:1572-1630`** (`generate_workflow` decorated at `:1573`). The plan's
own instruction — *"Re-open every file — line numbers rot"* — is what surfaced it. The
substance is unchanged and confirmed.

## G-5 — honoured by construction, and said rather than assumed

`backend/app/api/workflows.py` **FIRES**. Triple RE-DERIVED at close with CLAUDE.md's own
recipe (six-digit quick-task buckets excluded), never copied forward:

| Reading | commits / phases / lines |
|---|---|
| CLAUDE.md's table today | 35 / 17 / 1962 |
| **Measured 2026-08-18, this worktree** | **36 / 18 / 1984** |

⚠ **Stale again, and by one phase — this plan's own commit is the 36th.** The ledger's most
repeated finding reproducing itself inside a single phase, for the fourth recorded time on
this file.

**Why G-5 is honoured rather than triggered.** The ledger names the seam: *"this one module
hosts the definition CRUD, the validate/lint surface, the grounding palette, the publish
gauntlet, the run launcher and the template door"*, and applies one test — **does this add a
genuinely SECOND concern?** This plan adds **a validation on the definition CRUD this module
already owns**, with all of the LOGIC in `model_registry.py`; the file's contribution is one
import and two call sites, 9 code lines. Under the ledger's own test that is a **call-out, not
a concern** — the same verdict `260814-q5r` and `193.1` reached, on the same test. Taking the
named five-way split of a 1984-line module inside a model-picker phase would be smuggling a
refactor phase, which is what G-5 exists to prevent.

**Per G-5 the next phase adding a genuinely second concern here still owes a refactor
recommendation FIRST, and it inherits `36 / 18 / 1984`.**

### Files touched that are ABSENT from the hot-file ledger

| File | commits / phases / lines | In ledger? | G-5 |
|---|---|---|---|
| `backend/app/services/model_registry.py` | **2 / 1 / 368** | **NO** | no (1 phase) — young, created by 196-04 |
| `backend/tests/test_196_save_refusal.py` | 1 / 1 / 405 | n/a (test) | n/a |

`model_registry.py` is now the leaf behind BOTH the operator registry route, the author
registry route and the save-path refusal — three consumers at one phase. **It owes a ledger
row and a `docs/HOT-FILE-LEDGER.md` detail section the moment it reaches a third phase**, and
plan 196-09 (D-23) is where that obligation is discharged along with `api.ts` / `main.py` /
`admin.py` from 196-04. ⚠ The ledger is deliberately NOT edited here: the same-commit sync
rule would require both halves, and `docs/HOT-FILE-LEDGER.md` is not in this plan's
`files_modified`.

## Known Stubs

None. No placeholder value, no hardcoded empty collection reaching a UI, no unwired data
source. The `previous` grandfather branch is **dead code by measurement, not by stubbing** —
it is fully implemented and fully tested; the population it serves is currently empty, which
is stated in the docstring, in the test docstring and in this summary.

## Threat Flags

None. No new network endpoint, no new file access, no schema change. The one new refusal path
is enumerated in the plan's `<threat_model>` (T-196-IV1 / T-196-ORACLE / T-196-BRICK /
T-196-SEMANTIC) and each is mitigated by an asserting test rather than by a comment.

## Note for the phase verifier

⚠ **`assert_phase_models_registered` raises on the FIRST offender**, not on all of them. A
definition with two bad models reports one. That is deliberate (the picker fixes one field at
a time, and naming one phase is more actionable than a list) and it is stated in the
docstring — but a verifier expecting an array of offenders on the wire will not find one.

## Self-Check: PASSED

- `backend/app/services/model_registry.py` — FOUND
- `backend/app/api/workflows.py` — FOUND
- `backend/tests/test_196_save_refusal.py` — FOUND
- commits `d49956de`, `b5b80441` — both FOUND in `git log`
- `.planning/STATE.md` / `.planning/ROADMAP.md` — deliberately UNTOUCHED (orchestrator-owned);
  `git diff --name-only` against the dispatched base `3dd4844e` names three files, none of
  them under `.planning/` except this summary
