---
phase: 196-registry-backed-model-picker-canvas
plan: 04
subsystem: model-capability-registry
tags: [api, authz, allowlist-projection, model-registry, emit_tier, extraction, g-5, AUTH-04]
requires:
  - phase: 196-01
    provides: "emit_tier on model_capabilities_overrides (mig 120) + the overlay + the 8-member _MODEL_CAP_COLUMNS this extraction reads"
  - phase: 149
    provides: "_registry_row / GET /admin/models / the router-level operator default-deny that must NOT be widened"
  - phase: 167
    provides: "me_preferences.py — the non-operator, top-level, authed-read precedent this route copies"
provides:
  - "backend/app/services/model_registry.py — build_model_registry_rows (the ONE union) + to_author_row (the six-key allowlist)"
  - "GET /models/registry — the non-operator author read of the live registry union"
  - "run_default_model — the model a RUN would actually inherit, resolved server-side (Open Q1/Q4 answered)"
  - "emit_tier on the wire for the first time (D-13)"
  - "frontend AuthorModelRow + getAuthorModelRegistry"
affects:
  - "196-05 (ModelField — the picker consumes getAuthorModelRegistry)"
  - "196-09 (owes hot-file ledger rows for admin.py / main.py / lib/api.ts — D-23)"
tech-stack:
  added: []
  patterns:
    - "run_model_resolution.py extraction discipline: verbatim body move, PATCH SURFACE docstring section, explicit __all__, function-local collaborator imports"
    - "allowlist PROJECTION at a trust boundary (the _MODEL_CAP_COLUMNS habit applied to a response), asserted by key-set EQUALITY"
    - "gate-not-widened proven BY CONTRAST in one test file with one seeded identity"
key-files:
  created:
    - backend/app/services/model_registry.py
    - backend/app/api/model_registry.py
    - backend/tests/test_196_model_registry_route.py
  modified:
    - backend/app/api/admin.py
    - backend/app/main.py
    - frontend/src/lib/api.ts
key-decisions:
  - "_MODEL_CAP_COLUMNS STAYS in admin.py and the leaf imports it function-locally: it is the SQLi/PATCH allowlist set_model_capability interpolates into the upsert column list, and moving it would put that allowlist a hop away from the writer that enforces it. _infer_provider_for was never admin.py's — it lives in app.config and both modules import it from there. Exactly one definition of each."
  - "The author projection is an explicit six-key ALLOWLIST (_AUTHOR_ROW_FIELDS), never a del of unwanted keys. Measured: _registry_row emits 14 fields, to_author_row emits 6, 8 are dropped."
  - "is_default is OMITTED deliberately, not forgotten — it answers 'is this app_settings.llm_model?', a different question from 'what would a run use?'. run_default_model answers the latter through the run's own chain."
  - "run_default_model fails SOFT to null: an honest absence degrades the picker label; a 500 would take the whole picker down over a cosmetic clause."
  - "The enabled semantics are _registry_row's (absent override row == enabled), which is what the RUNTIME enforcement agrees with. A picker narrower than the engine is a different lie, not an absence of one."
  - "AuthorModelRow is a STANDALONE TS interface, not a Pick/extends of the operator row — structural, so a field added to the operator row later cannot travel to authors by inheritance."
patterns-established:
  - "Trust-boundary projection: allowlist in code + key-set EQUALITY assertion + raw-body substring backstop"
  - "Un-widened-gate proof: the 200 and the 404 in ONE test, with ONE seeded identity, so the two claims cannot drift apart"
requirements-completed: [AUTH-04]
duration: 25min
completed: 2026-08-18
---

# Phase 196 Plan 04: The Non-Operator Model-Registry Union Summary

**One function now answers "what models exist", and a workflow author can finally read it — six
allowlisted fields, `emit_tier` on the wire for the first time, and an honestly-computed run
default — without `GET /admin/models` moving an inch.**

## Performance

- **Duration:** ~25 min (bootstrap → task 3 commit)
- **Tasks:** 3/3
- **Files created:** 3 · **Files modified:** 3
- **Commits:** `397dbebd` · `705ac760` · `bc6abeb1`

## What shipped

| Layer | Change |
|---|---|
| Service | `build_model_registry_rows()` — the union, moved verbatim; `to_author_row()` — the six-key allowlist |
| Route | `GET /models/registry` — no prefix, no router-level dependency, `Depends(get_current_user)` alone |
| Route (existing) | `admin.py`'s `get_model_registry` reduced to a thin call; its gate byte-for-byte untouched |
| Client | `AuthorModelRow` + `getAuthorModelRegistry()` |
| Tests | 12 cases, zero DB mutation |

## The grep the plan asked for, verbatim

`<output>` requirement 1 — existing importers of the moved names:

```
$ grep -rn "_registry_row\|get_model_registry\|_infer_provider_for" backend/tests/
backend/tests/unit/test_reasoning_first_routing.py:57:def test_gpt_5_6_registry_rows_carry_reasoning_first():
```

**The single hit is a test FUNCTION NAME, not an import** — no test imports `_registry_row`,
`get_model_registry` or `_infer_provider_for` from `app.api.admin`. **The patch surface is
therefore EMPTY**, nothing was re-imported at module scope back into `admin.py`, and the leaf's
`PATCH SURFACE` docstring section says exactly that, including what to do if a later test starts
importing one (re-import in `admin.py`, never add a second definition).

## Where the two travelling module-scope names live, and why

| Name | Decision | Reason |
|---|---|---|
| `_infer_provider_for` | **Neither moved nor re-exported** — it lives in `app.config` and always did; `admin.py` only imports it. The leaf imports it from `app.config` at module scope, exactly as `admin.py` does. | The plan called it an "`admin.py` module-scope name"; reading the source showed it is `app.config`'s (`admin.py:40` imports it). Recorded because it changes the shape of the move: there was nothing to carry. |
| `_MODEL_CAP_COLUMNS` | **STAYS in `admin.py`**; the leaf imports it **function-locally** inside `_registry_row`. | It is the PATCH allowlist whose members `set_model_capability` interpolates into the upsert's column list (T-149-11 — the SQLi boundary), and plan 196-01 has just taken it 7 → 8. Moving it would put the SQLi allowlist a hop away from the writer that enforces it. Function-local so the `admin.py` → service → `admin.py` cycle never has to resolve at import time. |

**Exactly one definition of each, measured:** `grep -rn 'def _registry_row' backend/app | wc -l`
→ **1**; `grep -rn '_MODEL_CAP_COLUMNS = ' backend/app` → one real hit (`admin.py:135`; the second
grep hit is the differently-named `_ADD_MODEL_CAP_COLUMNS`).

## The re-derived union size — a reading, not a target

D-03 forbids pinning to the 69 measured on 2026-08-17. Re-derived against the live local DB with
RESEARCH.md's M-1 command:

```
$ cd backend && ./venv/Scripts/python.exe -c "…psycopg2 against 127.0.0.1:54322…"
code=61 enabled_ovr=34 overlap=26 db_only=8 union=69 total_rows=37
```

**It still equals 69 today.** That is a reading taken at 2026-08-18, not a constant: it moves the
moment an operator adds a registry row, which is precisely why the test computes its expectation
from `len(MODEL_CAPABILITIES)` plus the seeded DB-only ids and **`grep -c '== 69\|69 =='` on the
test file returns 0.**

The three numbers that motivate D-01 are unchanged and now confirmed on this tree: the code
registry alone is **61** (misses all 8 DB-only ids), the enabled-overrides list alone is **34**
(misses 35 code-registry ids), overlap **26**.

## The `enabled` semantics, stated so a count difference reads as a decision

`_registry_row` treats an **absent** override row as `enabled: true`; the allowed-set helper
backing `/me/preferences` treats an absent row as **not offerable** (34). Both ship today and they
are incompatible. **`_resolve_enabled_model` — the RUNTIME enforcement — agrees with
`_registry_row`**: it falls back only when an override row carries `enabled=false`. This route
therefore adopts `_registry_row`'s semantics, so the picker and the harness cannot disagree about
the same model. **A picker narrower than the engine is a different lie from the one AUTH-04
removes, not an absence of one.** The statement lives in the leaf's module docstring, and
`test_absent_override_row_reads_enabled` pins it.

⚠ **The literal token `enabled_model_allowed_set` does not appear in either new module**, per the
plan's fence — the docstring names it descriptively ("the allowed-set helper in
`app.models.user_settings` that backs `/me/preferences`") instead. Same for `require_operator` in
the route module and `gpt-5.4` in the run-default docstring: **three acceptance criteria were
mechanical greps that my first draft failed on PROSE, not on code**, and each was reworded rather
than waived. The three measured run-default candidate ids that the docstring may no longer name
are recorded here instead, which is where the plan asked for them: `app_settings.llm_model` reads
`deepseek-v4-flash`, the sub-agent default is `gpt-5.4-mini`, and `gpt-5.4` is merely what 18
stored phases happen to carry — **no two agree**, which is the whole argument for computing the
value instead of writing one down.

## Security: the boundary this plan opened, and the wall it did not move

**T-196-AC2 is proven by contrast in one file with one identity.** `test_admin_models_still_404_for_the_same_identity`
seeds a single non-operator identity (`_pg_pool.set_fetchrow_result(None)` — the
`test_149_model_gate.py` posture) and, in the same test body, asserts:

- `GET /models/registry` → **200**
- `GET /admin/models` → **404**, `res.json() == {"detail": "Not Found"}`, JSON content-type

Both halves in one test so the claims cannot drift apart, and so nobody can read the 200 as
evidence the gate was widened to produce it. **`git diff` on `admin.py` shows zero changes to the
`APIRouter(prefix="/admin", …)` construction** (`git diff … | grep -c 'APIRouter'` → **0**).

**T-196-LEAK is asserted as key-set EQUALITY, and it is non-vacuous.** Measured directly:

```
raw keys: 14 ['capability_source','context_window_tokens','deprecated','deprecated_reason',
              'emit_tier','enabled','is_default','is_locked','llm_call_timeout_seconds',
              'max_output_tokens','model_id','native_tools','overridden_fields','provider']
projected: {'model_id','provider','capability_source','enabled','deprecated','emit_tier'}
dropped:   ['context_window_tokens','deprecated_reason','is_default','is_locked',
            'llm_call_timeout_seconds','max_output_tokens','native_tools','overridden_fields']
```

14 → 6. The projection does real work, so an equality assertion that passes is evidence. A second
case greps the **raw serialized body** for eight forbidden substrings plus the seeded
operator-prose `deprecated_reason` ("internal: vendor incident 2026-08 — operator eyes only"), so
a leak nested anywhere below row top level still fails.

**Threat register dispositions honoured:** T-196-AC1 (mitigate — tested), T-196-AC2 (mitigate —
tested by contrast), T-196-LEAK (mitigate — allowlist + equality + substring backstop),
T-196-LEAK2 / T-196-TENANCY / T-196-DOS / T-196-SC (accept, unchanged by this plan; no packages
installed).

## Open Q1/Q4: `run_default_model` is computed, never guessed

`_resolve_run_default_model` walks the same chain `workflow_kickoff.py:485` walks —
`load_app_settings_async()` → `apply_user_model_default(...)` → `resolve_workflow_ctx_model(...)`
— and returns `None` on an empty resolution. It does **not** read `_registry_row.is_default`
(stamped from `app_settings.llm_model`, a different function — that mismatch IS Open Q4), and
`grep -c "gpt-5.4" backend/app/api/model_registry.py` → **0**.

Three cases cover it, and they are mutually distinguishable rather than three shades of `is None`:

- the value equals a **re-derivation of the same chain performed inside the test**, with an
  explicit **non-vacuity floor** (`assert expected`) so a future fixture change that empties the
  chain fails loudly instead of making this case and the null case agree trivially;
- a chain resolving to `""` surfaces as **`null`**;
- a chain that **raises** still returns 200 with `run_default_model: null` and a full `models`
  list — fail-soft, verified, not asserted.

## Verification

| Check | Result |
|---|---|
| `pytest tests/test_196_model_registry_route.py -q` | **12 passed** |
| `pytest tests/test_196_model_registry_route.py tests/test_149_registry_read.py tests/test_149_model_gate.py tests/test_149_model_write.py tests/test_196_emit_tier_overlay.py tests/unit/test_196_emit_tier_two_layer_pin.py -q` | **60 passed** |
| Route-enumerating suites (`146_operator_gate`, `148_carveouts`, `revert_byte_identical`, `182_grounding_bundle`, `188_workflow_run_read`, `190_connectors_api`) | **40 passed** |
| Backend suite — pre-plan baseline | **211 failed, 4012 passed, 2 errors** (392.91s) |
| Backend suite — post-plan | **211 failed, 4025 passed, 1 error** (362.47s) |
| Failing count vs baseline | **IDENTICAL — 211 both runs** |
| `npx tsc --noEmit -p tsconfig.app.json` | **33 errors across 19 files — identical to the wave-1 recorded baseline; ZERO in `src/lib/api.ts`** |
| `bash scripts/check-deploy-drift.sh` | **PASS** |
| Live-DB union size (M-1) | **69** (`code=61 enabled_ovr=34 overlap=26 db_only=8 total_rows=37`) |
| Deleted files across the plan | **none** (`git diff --diff-filter=D` empty) |

⚠ **The suite comparison is COUNT-level, not id-level, and that is a real limitation rather than
a claim.** The baseline run captured only `tail -5`, so no per-id baseline list exists to diff
against. What can be said honestly: the failing count is **exactly equal** (211 = 211), passed
rose by **+13** = this plan's 12 new tests plus one previously-ERRORing case
(`test_openai_compat_dsml_strip`, errors 2 → 1) that resolved on its own; that case is **provably
unmodified by this plan** — nothing under `openai_compat` is in this diff — but per CLAUDE.md's
own rule, one green sample is not proof of innocence, so it is recorded as an observation.

⚠ **`npx tsc --noEmit -p tsconfig.app.json` does NOT exit 0, and the plan's acceptance criterion
asking for exit 0 is unreachable on this tree.** Wave 1 recorded the same 33-error baseline before
this plan started. The honest bar is per-file, and it is clean: `grep -c '^src/lib/api.ts('` →
**0**. (`src/lib/api.test.ts` carries one long-standing `StreamCallbacks` error at line 131,
present before this plan and untouched by it.)

## Deviations from Plan

### [Rule 1 - Bug] The leaf's module docstring raised a real `SyntaxWarning`

- **Found during:** Task 1 verification — pytest surfaced
  `SyntaxWarning: invalid escape sequence '\|'` pointing at `model_registry.py:1`.
- **Issue:** the docstring quotes the plan's `grep -rn "_registry_row\|get_model_registry\|…"`
  command; `\|` is not a valid Python escape, so every import of the module emitted a warning.
- **Fix:** made the module docstring a raw string (`r"""`). Verified with
  `python -W error::SyntaxWarning -c "import app.services.model_registry"` → clean import.
- **Commit:** `397dbebd`

### [Rule 3 - Blocking] Three acceptance greps failed on PROSE, not on code

- **Found during:** Tasks 2 and 3 acceptance checks.
- **Issue:** `grep -c 'require_operator'` on the route module returned **1**;
  `grep -c "gpt-5.4"` returned **2**; `grep -rn 'enabled_model_allowed_set'` on the two new
  modules returned **1**; `grep -cE 'INSERT INTO|UPDATE model_capabilities'` on the test file
  returned **1**; `grep -c 'Pick<ModelRegistryRow\|extends ModelRegistryRow'` on `api.ts` returned
  **1**. **Every one of those hits was inside a comment or docstring explaining why the thing must
  NOT be there.**
- **Why it is not pedantry:** the criteria are mechanical fences, and a fence that a comment can
  trip is a fence that will be waived the next time it fires. Each was reworded to name the
  concept without the literal token (e.g. "`admin.py`'s router-level operator default-deny",
  "the allowed-set helper in `app.models.user_settings` that backs `/me/preferences`"), and each
  reworded passage now says explicitly that a grep for the token here must come back empty — so
  the prose defends the fence instead of tripping it. The measured facts the docstrings lost (the
  three candidate run-default ids) are recorded in this summary instead, which is where the plan's
  `<output>` section asked for them.
- **Files:** `backend/app/api/model_registry.py`, `backend/app/services/model_registry.py`,
  `backend/tests/test_196_model_registry_route.py`, `frontend/src/lib/api.ts`
- **Commits:** `705ac760`, `bc6abeb1`

### [Rule 2 - Missing critical] A non-vacuity floor on the run-default test

- **Found during:** Task 2 — the "matches the run chain" case and the "null when empty" case would
  BOTH have asserted `is None` had the chain resolved to nothing under the fixture, and neither
  would have proven anything.
- **Fix:** added `assert expected, "fixture non-vacuity: …"` before the equality assertion. It
  passes, which is what makes the null case a genuine contrast rather than a restatement.
- **Commit:** `705ac760`

### [Correction to the plan's interfaces block, not a deviation]

The plan's `<interfaces>` describes `_infer_provider_for` as an `admin.py` module-scope name that
"travels with" `_registry_row`. **It is `app.config`'s** (`admin.py:40` imports it), so nothing
travelled — the leaf imports it from the same place. The plan's own instruction ("re-open every
file — line numbers rot") is what surfaced this.

## G-5 / D-22 note — three touched files are ABSENT from the hot-file ledger, and all three FIRE

Triples RE-DERIVED at close with CLAUDE.md's own recipe (six-digit quick-task buckets excluded),
never copied forward:

| File | commits / phases / lines | In ledger? | G-5 |
|---|---|---|---|
| `frontend/src/lib/api.ts` | **169 / 97 / 6143** | **NO** | ⚠ **FIRES hard** — 97 phases, and it is invisible to its own guardrail |
| `backend/app/main.py` | **72 / 53 / 783** | **NO** | ⚠ **FIRES** |
| `backend/app/api/admin.py` | **32 / 12 / 1733** | **NO** | ⚠ **FIRES** |

⚠ **`frontend/src/lib/api.ts` at 97 phases would be the HOTTEST file by phase count in the entire
ledger** — ahead of `backend/app/api/threads.py`, which CLAUDE.md currently calls "the hottest file
in the repository" at **76** phases / 234 commits. It has no row at all. This is exactly the `WorkflowsPage.tsx` failure mode CLAUDE.md records: a
file escapes G-5 for years purely by not being written down. **Plan 196-09 owes a ledger row AND a
`docs/HOT-FILE-LEDGER.md` detail section for all three, under the same-commit sync rule, with
figures re-derived at that close** — the `admin.py` figures recorded by plan 196-01 four hours ago
(`30 / 11 / 1718`) are **already stale** against today's `32 / 12 / 1733`, which is the ledger's own
most-repeated finding reproducing itself inside a single phase.

**G-5 is honoured by construction for this plan regardless:** every change to a firing file is
additive or subtractive-in-the-right-direction — `admin.py` LOST 87 lines and gained 13 (code
moved OUT), `main.py` gained one import name and one `include_router` line, `api.ts` gained one
interface and one function with a **purely additive diff** (`git diff` shows no `-` lines beyond
the file header, so `getModelRegistry`'s body and `ModelRegistryRow` are byte-unchanged).

The three files CREATED by this plan (`backend/app/services/model_registry.py`,
`backend/app/api/model_registry.py`, `backend/tests/test_196_model_registry_route.py`) are at
0 phases and owe a ledger row the moment they reach a third.

## Note for the phase verifier — a VALIDATION.md command that will not resolve as written

`196-VALIDATION.md:78` names the union-size row's command as
`pytest backend/tests/test_196_model_registry_route.py::test_union_size -x`. The shipped case is
named **`test_union_size_is_code_registry_plus_db_only_rows`** (descriptive, so a red run names the
finding). A `::` nodeid must match exactly; **`-k test_union_size` resolves it by substring**.
Recorded rather than silently renaming the test, because VALIDATION.md is phase-level and not in
this plan's `files_modified`.

## Known Stubs

None. No placeholder values and no unwired data source — `getAuthorModelRegistry` talks to the
shipped route, which talks to the same union function `/admin/models` uses. The picker that
consumes it is plan 196-05's deliverable, which is scope, not a stub.

## Threat Flags

None. No new network egress, no new file access, no schema change, and the only new trust boundary
(`GET /models/registry`) is the one the plan's `<threat_model>` already enumerates and this plan
mitigates.

## Self-Check: PASSED

- `backend/app/services/model_registry.py` — FOUND
- `backend/app/api/model_registry.py` — FOUND
- `backend/tests/test_196_model_registry_route.py` — FOUND
- commits `397dbebd`, `705ac760`, `bc6abeb1` — all FOUND in `git log`
- `.planning/STATE.md` / `.planning/ROADMAP.md` — deliberately UNTOUCHED (orchestrator-owned;
  `git diff --stat` against the base names six files, none of them under `.planning/` except this
  summary)
