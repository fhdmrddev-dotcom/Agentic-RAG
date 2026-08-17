---
phase: 196-registry-backed-model-picker-canvas
plan: 01
subsystem: model-capability-registry
tags: [migration, emit_tier, model-registry, operator-control, A7-pin, SEED-172]
requires:
  - "supabase/migrations/053 (model_overrides_read_all SELECT RLS — no new policy needed)"
  - "backend/app/services/forced_emit.py::_RUNGS_BY_TIER (layer 2 of the A7 pin)"
  - "backend/app/config.py::_LLM_CALL_TIMEOUT_MIN_S/_MAX_S (imported, never retyped)"
provides:
  - "model_capabilities_overrides.emit_tier — nullable text + named CHECK (migration 120, APPLIED to local)"
  - "get_model_capability_async overlays emit_tier from the DB (D-14)"
  - "PATCH /admin/models/{id} accepts emit_tier through _MODEL_CAP_ENUM_COLUMNS (T-196-IV2)"
  - "_MODEL_CAP_INT_BOUNDS — per-column int range refusals (T-196-IV2b / SEED-172 finding 3)"
  - "ModelRegistryRow.emit_tier + the registry tab's first enum control"
affects:
  - "Every later 196 plan — D-14 is the hard prerequisite for the picker"
tech-stack:
  added: []
  patterns:
    - "migration 099 header (APPLY/THEN/CLOUD PARITY) + migration 081 inline enum CHECK"
    - "test_audit_event_registration.py pin shape: highest-migration-wins, comment-strip-before-match, both-direction equality, positive control over the SAME extractor, non-vacuity floor"
    - "test_149_default_guard.py _RecordingPool `.calls` empty assertion — proves a guard fires BEFORE the write"
key-files:
  created:
    - supabase/migrations/120_model_capabilities_overrides_emit_tier.sql
    - backend/tests/unit/test_196_emit_tier_two_layer_pin.py
    - backend/tests/test_196_emit_tier_overlay.py
  modified:
    - backend/app/config.py
    - backend/app/api/admin.py
    - frontend/src/lib/api.ts
    - frontend/src/components/admin/ModelRegistryTab.tsx
    - backend/tests/test_149_model_write.py
    - frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx
    - frontend/src/components/admin/__tests__/ModelRegistryTab.a11y.test.tsx
decisions:
  - "The CHECK is `emit_tier IS NULL OR emit_tier IN (...)` rather than a bare IN. A bare IN already admits NULL (NULL IN (...) is NULL, not false), but relying on that is a silent property."
  - "_ADD_MODEL_CAP_COLUMNS deliberately NOT extended with emit_tier — the PATCH path is the correction knob D-14 asks for, and a newly added row can be PATCHed immediately."
  - "Timeout bounds are IMPORTED from app.config, not retyped, so the PATCH door and the env parser cannot drift."
  - "context_window_tokens (1, 10_000_000) and max_output_tokens (1, 1_000_000) are sanity caps chosen here — no shipped clamp existed to mirror. Their only job is rejecting 0/negatives/absurdities, never curation."
metrics:
  tasks_completed: 4
  tasks_total: 4
  commits: 5
---

# Phase 196 Plan 01: Registry-Backed emit_tier Summary

`emit_tier` is now a real, operator-correctable value end to end — column, overlay, PATCH guard,
client type, operator control — unblocking every other plan in this phase.

## What shipped

| Layer | Change |
|---|---|
| DB | migration 120 — nullable `emit_tier text` + named CHECK, applied to local |
| Read | `get_model_capability_async` overlays `emit_tier` from the DB (D-14) |
| Write | `_MODEL_CAP_COLUMNS` 7→8, new `_MODEL_CAP_ENUM_COLUMNS`, new `_MODEL_CAP_INT_BOUNDS` |
| Client | `ModelRegistryRow.emit_tier` / `ModelCapabilityPatch.emit_tier` |
| Operator | the registry tab's first enum control, in user words |

## Task 1 — the A7 pin, observed RED verbatim

Recorded because a guard whose control was never observed red is not evidence, and because this
output cannot be reproduced once Task 3 turns it green.

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_196_emit_tier_two_layer_pin.py -q
```

```
F..                                                                      [100%]
================================== FAILURES ===================================
__________ test_a7_emit_tier_vocabulary_is_equal_across_three_layers __________
>       assert patch_set is not None, (
E       AssertionError: LAYER 3 IS MISSING: app.api.admin._MODEL_CAP_ENUM_COLUMNS['emit_tier'] does not exist, so the PATCH path has no enum guard at all. Every value the database's CHECK (120_model_capabilities_overrides_emit_tier.sql) would reject reaches Postgres as a raw 23514 instead of a 422, and every value it ACCEPTS is written unvalidated against the ladder in forced_emit._RUNGS_BY_TIER. Add the constant beside _MODEL_CAP_INT_COLUMNS / _MODEL_CAP_BOOL_COLUMNS and validate it in set_model_capability's guard loop.
E       assert None is not None

tests\unit\test_196_emit_tier_two_layer_pin.py:164: AssertionError
=========================== short test summary info ===========================
FAILED tests/unit/test_196_emit_tier_two_layer_pin.py::test_a7_emit_tier_vocabulary_is_equal_across_three_layers
1 failed, 2 passed, 1 warning in 3.38s
```

⚠ **`1 failed, 2 passed` is the shape that matters, not `1 failed`.** The two passing tests are the
positive control and the read-time-default check, both driving the SAME extractor over the SAME
migration — so the red is provably the missing third layer and NOT a parser that quietly stopped
matching, which a lone red assertion could not distinguish. Layer 3 is returned as `None` rather
than raised precisely so a bare `ImportError` collected before any assertion can never stand in for
the finding.

**The transition is verifiable, not asserted:** `git diff b9642dbd HEAD -- backend/tests/unit/test_196_emit_tier_two_layer_pin.py` is **empty**. The file is byte-identical since Task 1, so RED→GREEN came entirely from Task 3's code with the assertion text unchanged.

## Task 2 — how migration 120 was applied, and the idempotence MEASUREMENT

⚠ **Recorded verbatim rather than paraphrased as "pasted into the SQL editor", because it was not
pasted into the SQL editor.** The operator authorised the orchestrator to apply it directly: the
full contents of `120_model_capabilities_overrides_emit_tier.sql` were executed against the LIVE
local Postgres at `postgresql://postgres:postgres@127.0.0.1:54322/postgres` via
`backend/venv/Scripts/python.exe` + `psycopg2` with `autocommit=True`. This honours CLAUDE.md: the
rule forbids `supabase db push` and `supabase db reset` because they wipe dev data; this executes
exactly the statements the SQL editor would, against the same live DB, with no reset and no data
loss.

**Both runs measured:**

- **RUN 1: SUCCESS**, no error raised.
- **RUN 2 (the idempotence measurement): SUCCESS**, no error raised. **The migration IS idempotent.**

⚠ This is a MEASUREMENT, not an assumption — PATTERNS.md flagged it as proven by neither analog (099
has `IF NOT EXISTS` but no CHECK; 081 has the CHECK but no `IF NOT EXISTS`), and the migration
deliberately declines to claim idempotence in its own comment. Re-running raised no
duplicate-constraint error and created no second constraint: `pg_constraint` holds exactly **one**
matching CHECK after both runs. **The mechanism is that `ADD COLUMN IF NOT EXISTS` skips the entire
clause, INCLUDING its inline `CONSTRAINT ... CHECK`, once the column exists.** **Task 1's fallback
restructuring (a guarded `DO $$ ... pg_constraint ... $$` block) is therefore NOT needed and was not
applied.**

**Independent re-derivation** (run by the executor rather than trusting the numbers handed over):

```
column: ('text', 'YES', None)
constraints: 1
   model_capabilities_overrides_emit_tier_check -> CHECK (((emit_tier IS NULL) OR (emit_tier = ANY (ARRAY['force_strict'::text, 'force'::text, 'coerce'::text]))))
rows: 37 non-null emit_tier: 0
column count: 12
OK
```

Pre-apply state confirmed RESEARCH.md M-5 exactly — **11 columns, no `emit_tier`, 37 rows**; the
column count now reads **12**. **All 37 rows read NULL**, so every model that ships today behaves
byte-identically via the read-time `coerce` default.

⚠ **Postgres renders the constraint as `= ANY (ARRAY[...])`, not as `IN (...)`.** Any future
assertion must test for the three tier literals being present, never for the substring `IN (`.

## ⚠ OWED: `full-schema.sql` was NOT regenerated — blocked, not skipped

**`bash scripts/regenerate-full-schema.sh` could not be run by this agent.** The script hard-requires
Docker (`docker exec <supabase_db_*> pg_dump`, lines 65-68 and 101-107), and **`docker` is denied to
this agent** — both the script invocation and a bare `docker ps` were refused by the permission
layer.

**`supabase/full-schema.sql` was deliberately left untouched.** CLAUDE.md forbids hand-editing it,
and hand-assembling a schema dump would produce exactly the drift the same-commit rule exists to
prevent. **A wrong artifact is worse than a missing one**, because a stale `full-schema.sql` still
looks authoritative to a greenfield deploy.

**The owed command, verbatim, to be run from the repo root by the operator or an agent with Docker:**

```
bash scripts/regenerate-full-schema.sh
```

**No `--reset`** — the default is a live-DB dump that preserves dev data; `--reset` is destructive.
Afterwards confirm `grep -c emit_tier supabase/full-schema.sql` is greater than 0 and commit it
alongside migration 120. **This is the one Task 2 acceptance criterion this plan does not satisfy,
and it is named rather than quietly dropped.**

## Task 3 — the overlay, the enum guard, the folded SEED-172 bounds

- **Overlay (D-14).** `"emit_tier"` appended to the copy tuple in `get_model_capability_async`.
  `_build_inferred_defaults` is untouched and no derived view re-reads `forced_emission` /
  `strict_json_schema` (D-122-04 forbids it): `git diff aa65101d HEAD -- backend/app/config.py | grep "^+" | grep -c "forced_emission\|strict_json_schema\|_build_inferred_defaults"` → **0**.
- ⚠ **RESEARCH Pitfall 7 survives this plan deliberately, and is now PINNED rather than left to be
  rediscovered.** The SYNC `get_model_capability` still never reads the DB, so
  `get_model_capability("glm-4.7-flash")` still returns `capability_source="inferred"` with no
  `emit_tier`. `test_sync_path_still_never_reads_the_db` asserts exactly that, so a later reader
  cannot assume the overlay fixed both doors.
- **Enum guard (T-196-IV2).** `_MODEL_CAP_ENUM_COLUMNS` added beside its int/bool siblings; a fourth
  `elif` sits INSIDE the existing loop so it inherits both shipped properties — explicit `None` is a
  Reset, and the raise happens before any DB touch.
- **SEED-172 bounds (T-196-IV2b).** `_MODEL_CAP_INT_BOUNDS` rejects `0`, negatives and above-max for
  all three int columns. The timeout pair is **imported**, verified by assertion:
  `_MODEL_CAP_INT_BOUNDS["llm_call_timeout_seconds"] == (_LLM_CALL_TIMEOUT_MIN_S, _LLM_CALL_TIMEOUT_MAX_S)`.

**Tests — 31 passing, zero DB mutation.** `grep -c 'INSERT INTO\|UPDATE model_capabilities'` → **0**,
which is what keeps this plan free of CLAUDE.md rule 4's serialisation constraint (worktrees isolate
files, not Postgres). Every refusal case asserts the recording pool's `.calls` is **empty** — a guard
that raises after the upsert is not a guard, it is a log line. `glm-4.7-flash` and
`gemini-3.6-flash` appear 4 times; `gpt-5.4` appears **once, in the docstring explaining why it is
deliberately not a subject** (it is registry-known, enabled and `force_strict`, so it passes every
new check and would prove nothing).

## Task 4 — the client field and the first enum control

- `ModelRegistryRow.emit_tier: "force_strict" | "force" | "coerce" | null`, plus the same union on
  `ModelCapabilityPatch`. The `.models` unwrap stays in the client.
- The tab's **first enum column** (`NUM_FIELDS` is int-only, `RowToggle` is boolean — neither was
  reusable). Three user-facing sentences, an OVR/DEF tag, a Reset that writes explicit `null`, and
  the raw token only under the ⌥ Technical-names reveal.
- ⚠ **`null` renders as `coerce`, not as blank.** Blank would imply "unknown", and the backend does
  not treat it that way — `forced_emit.py` reads `cap.get("emit_tier", "coerce")`, so an untracked
  model is ALREADY behaving as best-effort. "—" would hide a live behaviour behind a shrug.
- No logo added (`grep -c '@lobehub/icons'` → **0**). SC#3 fence holds: `git diff --name-only`
  contains neither `SettingsPage.tsx` nor `ModelPillRow.tsx`, and `verified_models` is unchanged.

**The Open-Q2 caption, verbatim as it appears in the source:**

> Setting this records what you believe the provider supports; nothing verifies it against the provider.

This is the whole of the phase's answer to provider-docs-first: surfacing an already-doc-verified
value (D-122-04) makes no new provider claim, but making it EDITABLE introduces an unverified
operator assertion, and the caption is what keeps that honest.

## Verification

| Check | Result |
|---|---|
| `pytest tests/unit/test_196_emit_tier_two_layer_pin.py tests/test_196_emit_tier_overlay.py -x -q` | **31 passed** |
| Backend suite — pre-plan baseline | **212 failed, 3963 passed** |
| Backend suite — final | **211 failed, 3995 passed** |
| New failures vs baseline (id-level diff) | **ZERO** |
| `npx tsc --noEmit -p tsconfig.app.json` | 33 errors, **0 in any file this plan touched** |
| `vitest ControlRoomPage.test.tsx` | 7 passed |
| `vitest ModelRegistryTab.test.tsx + .a11y.test.tsx` | 36 passed (incl. the axe check) |
| `bash scripts/check-deploy-drift.sh` | **PASS** |
| Live-DB column/CHECK assertion | **OK** (above) |

**Backend suites were diffed at the ID level, not by count.** Passed rose by 32 = this plan's 31 new
tests + one pre-existing flaky test that happened to go green.

⚠ **A mid-run measurement showed 4 apparent new failures, and it was wrong — recorded because
discarding it silently would be the dishonest move.** An intermediate full run read
`216 failed, 3990 passed` and the id-diff named four `tests/integration/test_085_ask_user_handler.py`
cases (`..._timeout_returns_timed_out`, `..._parallel_calls_isolated`, `..._cancel_sentinel...`,
`..._choice_click_out_of_range...`). **That run overlapped concurrent `vitest` and `tsc` runs on the
same box**, and those four are async timeout/parallel-isolation tests. They pass in isolation (28/28
with `test_149_model_write.py`) and do not appear in the final quiet-box run. They are **provably
unmodified by this plan** — no file under `ask_user` is in this plan's diff. Per CLAUDE.md's own
rule, one green sample is not proof of innocence: say "provably unmodified", never "fine".

⚠ **`npx tsc --noEmit -p tsconfig.app.json` does NOT exit 0, and it did not before this plan
either.** 33 errors remain across 17 files (the known SEED-056-class rot: `useMessages.test`,
`ChatAreaMode.test`, `streamsStore.ts`, `SettingsPage.tsx`, …). **Zero are in any file this plan
touched** — `... | grep -i "ModelRegistry\|lib/api.ts"` returns nothing. The plan's acceptance
criterion asked for exit 0; that criterion was not reachable on this tree at the base commit, so the
honest bar is the per-file result, which is clean.

## Deviations from Plan

### [Rule 3 - Blocking] The Phase-149 seven-column pin failed, by design

- **Found during:** Task 3 (surfaced by the full-suite id-diff, not by the plan's own tests).
- **Issue:** `tests/test_149_model_write.py::test_columns_constant_is_exactly_the_seven_editable`
  enumerates `_MODEL_CAP_COLUMNS` exactly. Taking it 7→8 broke it.
- **Why it is not noise:** those column names are interpolated into the upsert's column list
  (T-149-11), so that set is the SQLi boundary — the pin exists precisely so a new member cannot
  arrive unnoticed. **Its failing was the guard working.**
- **Fix:** updated deliberately, never weakened — renamed to `..._the_eight_editable`, `emit_tier`
  added, and a docstring recording that widening is legitimate only in the same commit as the new
  column's own guard, naming `_MODEL_CAP_ENUM_COLUMNS`. Same shape as migration 114 widening a closed
  vocabulary by one reviewed word.
- **Commit:** `db8b9ca5`

### [Rule 3 - Blocking] Two frontend fixtures broke on the new required field

- **Found during:** Task 4 typecheck.
- **Issue:** `emit_tier` is required (not optional) on `ModelRegistryRow`, so the `makeRow` factories
  in `ModelRegistryTab.test.tsx` and `ModelRegistryTab.a11y.test.tsx` no longer satisfied the type.
- **Fix:** `emit_tier: null` added to both — the honest shipped state for every pre-120 row. Required
  rather than optional was kept deliberately: optional would let a caller silently omit the field and
  reintroduce the "absent means unknown" ambiguity the WR-04 rule exists to kill.
- **Files:** beyond the plan's declared `files_modified` — recorded here rather than hidden.
- **Commit:** `4e9d14f1`

### [Blocked, not deviated] `full-schema.sql` regeneration

Docker is denied to this agent; see the OWED section above. Not worked around, not hand-edited.

## Owed / operator-gated

1. **`bash scripts/regenerate-full-schema.sh`** (no `--reset`) — blocked on Docker. See above.
2. **CLOUD PARITY OWED — paste migration 120 into the CLOUD Supabase SQL editor at promotion.**
   Operator-gated, **NOT performed**, and it must land in the same operation as any deploy of this
   code. Confirmed harmless to the deploy artifacts: `check-deploy-drift.sh` returned **PASS**, and
   migration 120 is **absent** from its seed-like-INSERT/UPDATE list — decisive evidence for
   RESEARCH.md assumption A3 (no env var, no seed row), measured rather than assumed.

## G-5 / D-22 note

All three source files edited (`config.py` 70/41/1275 — the second-hottest file measured anywhere in
this project; `admin.py` 30/11/1718; `ModelRegistryTab.tsx` 9/3/1083) are **absent from the hot-file
ledger**, which is why G-5 has never fired on them. Each change here is additive and narrow — one
overlay entry, two module constants plus one `elif`, one control beside the existing ones — so **G-5
is honoured by construction**. ⚠ **Plan 196-09 owes a ledger row AND a detail section for all three,
with figures RE-DERIVED at close**, never copied from D-22, since this ledger's own documented
failure mode is a figure going stale the same afternoon.

## Known Stubs

None. No placeholder values, no unwired data sources — the control writes through the same
`onSetCapability` chokepoint every other cell uses.

## Self-Check: PASSED

- `supabase/migrations/120_model_capabilities_overrides_emit_tier.sql` — FOUND
- `backend/tests/unit/test_196_emit_tier_two_layer_pin.py` — FOUND
- `backend/tests/test_196_emit_tier_overlay.py` — FOUND
- commits `b9642dbd`, `e0d1ad7b`, `f7137bb1`, `4e9d14f1`, `db8b9ca5` — all FOUND in `git log`
- `supabase/full-schema.sql` — deliberately UNCHANGED (blocked; recorded as owed, not claimed done)
