# Phase 110: DM Foundations - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 11 (5 CREATE migration/tests + 4 unit/integration tests + 3 MODIFY code + 1 generated artifact)
**Analogs found:** 11 / 11 (every shape exists as a proven in-repo precedent — this is disciplined copying, not invention)

> **Scope note for the planner/executor:** This is a PURE BACKEND-SUBSTRATE phase. No frontend files, no route, no tool, no UI. The single load-bearing risk is the audit lockstep + silent-swallow trap (see Shared Pattern A) — every test below exists to defeat a mock false-green, NOT to prove a happy path. All line anchors below were re-grepped at HEAD this session; where the research's cited line differs from HEAD it is noted inline.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/071_dm_foundations.sql` | migration | transform (DDL) | `supabase/migrations/070_*.sql` (numbering) + `full-schema.sql` skills RLS (`:1856/1954/2045/2110`) + audit CHECK (`:333`) + `app_settings` (`:259`) + org_id comment (`:734`) | exact (per-section) |
| `backend/app/services/audit_service.py` (MODIFY) | service | CRUD (audit write) | self — extend `VALID_ACTION_TYPES` (`:13-19`) + new `assert_action_types_synced` helper; lockstep idiom from `db/workflows.py:40-45` | exact (self-extend) |
| `backend/app/main.py` (MODIFY) | config (lifespan) | event-driven (startup) | Phase-081.1 post-pool-init block (`:225-231`) for HOME; `raise RuntimeError` hard-fail shape (`:429`/`:448`) for the RAISE | exact |
| `backend/app/models/user_settings.py` (MODIFY) | model/config | request-response (settings read) | `sandbox_enabled` field (`:134`) + `_val_bool` (`:318`) + `_build_settings_from_row` (`:473`) + `tool_args_progress_emit_boundary_bytes` defensive helper (`:545`) | exact |
| `supabase/full-schema.sql` (REGEN) | config (artifact) | — | generated output of `scripts/regenerate-full-schema.sh` — **NOT a manual edit target** | n/a |
| `backend/tests/integration/test_110_dm_audit_live.py` | test | CRUD (live round-trip) | `test_092_harness_audit_live.py` (verbatim harness) | exact |
| `backend/tests/integration/test_110_audit_drift_guard.py` | test | request-response (subset assert) | `test_092_harness_audit_live.py` harness + `pg_get_constraintdef` query | exact (harness) / role-match (assert) |
| `backend/tests/integration/test_110_dm_schema.py` | test | CRUD (schema + 2-user RLS) | `test_092_harness_audit_live.py` harness (two seeded users) | exact (harness) |
| `backend/tests/integration/test_110_flag.py` | test | request-response (column + read) | `test_092_harness_audit_live.py` harness + `load_app_settings` | role-match |
| `backend/tests/test_110_boot_guard.py` | test (unit) | event-driven (stub pool) | mock-based unit test; stub pool returns a constraint def missing one type | role-match (no exact stub-pool precedent) |
| `backend/tests/test_110_flag_default.py` | test (unit) | request-response (exception path) | `tool_args_progress_emit_boundary_bytes` defensive-default test pattern | role-match |

---

## Pattern Assignments

### `supabase/migrations/071_dm_foundations.sql` (migration, DDL transform)

**Analog:** `supabase/migrations/070_harness_validation_gate_library.sql` (numbering) + `full-schema.sql` sections cited below. Highest applied migration = `070` → **next free number is `071`** `[VERIFIED: ls migrations dir, this session]`. Filename MUST match `<digits>_name.sql`; **no letter suffixes** (`071b` is silently skipped by the Supabase CLI — CLAUDE.md). Wrap the whole file in one `BEGIN; … COMMIT;` so a partial failure rolls back atomically.

**Apply step is MANUAL → the plan task that applies it MUST be `autonomous:false`.** Operator pastes the full `071_…sql` into the Supabase SQL editor and runs it against live local DB :54322. NEVER `supabase db push` / `db reset` (CLAUDE.md — preserves dev data). Then `bash scripts/regenerate-full-schema.sh` (NO `--reset`), commit migration + regenerated `full-schema.sql` + the code edits together.

#### Section 1 — Audit CHECK DROP/ADD (11 → 19) — copy the EXACT current array verbatim

**Current `audit_log_action_type_check` to DROP** `[VERIFIED: full-schema.sql:333, no drift]`:
```sql
CONSTRAINT audit_log_action_type_check CHECK ((action_type = ANY (ARRAY['document.upload'::text, 'document.delete'::text, 'search.query'::text, 'code.execute'::text, 'skill.load'::text, 'thread.create'::text, 'thread.delete'::text, 'settings.update'::text, 'memory.remember'::text, 'memory.recall'::text, 'feedback.submit'::text])))
```
Count = **11**. The "11 → 19" claim is VERIFIED, not assumed.

**The DROP/ADD idiom** (no in-place append on a closed CHECK; same idiom migrations 059/069/070 used to extend `harness_audit.event_type`):
```sql
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- existing 11 (preserve VERBATIM — do not reorder/rename)
    'document.upload','document.delete','search.query','code.execute','skill.load',
    'thread.create','thread.delete','settings.update','memory.remember','memory.recall','feedback.submit',
    -- 8 new DM types (D-110-1, locked vocabulary — downstream phases consume as-is)
    'view.create','view.delete','relationship.create','relationship.delete',
    'classification.apply','classification.rule.create','metadata.update','metadata.field.create'
  ]::text[]));
```
The 8 new strings are the **locked vocabulary** (D-110-1): 113/114 → `view.create`/`view.delete`; 116 → `relationship.create`/`relationship.delete`; 118 → `classification.apply`/`classification.rule.create`; 112 → `metadata.update`; 111 → `metadata.field.create`. Plain `DROP + ADD` (not `NOT VALID`+`VALIDATE`) is safe — net-new values, no existing row violates the broader constraint; instant on dev (A1). Note for prod cutover only: a large `audit_log` takes an `ACCESS EXCLUSIVE` validation lock.

#### Section 2 — 4 CREATE TABLE + RLS (mirror `skills`, NOT `workflow_definitions` — see Shared Pattern B)

All four: `id uuid PK DEFAULT gen_random_uuid()`, owner FK `auth.users(id) ON DELETE CASCADE`, nullable `org_id uuid` **with no FK**, `ENABLE ROW LEVEL SECURITY`, the 4 RLS policies from Shared Pattern B, the verbatim org_id COMMENT from Shared Pattern C. Reconciled DDL (D-110-3 × ARCHITECTURE.md §1–4):

```sql
-- 3.1 document_views (folder_scope ON DELETE SET NULL — matches documents.folder_id)
CREATE TABLE public.document_views (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid,                                   -- forward-compat, NO FK
    name          text NOT NULL,
    filter_expr   jsonb NOT NULL DEFAULT '{}'::jsonb,
    folder_scope  uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    is_global     boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3.2 document_relationships (both doc FKs CASCADE — matches document_chunks/images/tables)
CREATE TABLE public.document_relationships (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid,                                   -- forward-compat, NO FK
    source_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    target_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    rel_type      text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT no_self_rel CHECK (source_doc_id <> target_doc_id),
    CONSTRAINT document_relationships_rel_type_check
      CHECK (rel_type = ANY (ARRAY['supersedes','amends','references','attached_to']::text[]))
);

-- 3.3 classification_rules (suggest_folder_id — see DESIGN DECISION below)
CREATE TABLE public.classification_rules (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id            uuid,                               -- forward-compat, NO FK
    name              text NOT NULL,
    match_expr        jsonb NOT NULL,
    suggest_folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,  -- A3: SET NULL recommended (ARCHITECTURE.md says CASCADE)
    is_global         boolean NOT NULL DEFAULT false,
    enabled           boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- 3.4 metadata_field_definitions (ONLY table with NULLABLE user_id; NULL = global/admin field)
CREATE TABLE public.metadata_field_definitions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,   -- NULLABLE per D-110-3
    org_id      uuid,                                               -- forward-compat, NO FK
    field_key   text NOT NULL,
    field_type  text NOT NULL DEFAULT 'string',
    description text,
    is_global   boolean NOT NULL DEFAULT false,
    enabled     boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mfd_reachable CHECK (user_id IS NOT NULL OR is_global = true)  -- A2: prevents an RLS-unreachable orphan row
);
```

**Two DESIGN DECISIONS the planner must make explicit in the DDL task:**
- **A3 — `classification_rules.suggest_folder_id` ON DELETE.** ARCHITECTURE.md §3 says CASCADE (folder delete destroys the rule). **Recommend SET NULL** (a rule is config, not a child of the folder — it should survive inert, consistent with `document_views.folder_scope`). MEDIUM-risk discrepancy; planner confirms.
- **A2 — `metadata_field_definitions` reachability CHECK.** With a nullable owner, `auth.uid() = user_id` is NULL (not true) when `user_id IS NULL`, so a global field is reached only via `OR is_global = true`. A `user_id NULL AND is_global false` row is silently RLS-unreachable. Recommend the `mfd_reachable` CHECK above (cheap, prevents the orphan class).

#### Section 3 — Indexes (Claude's discretion, recommend yes — all cheap forward-compat)
```sql
CREATE INDEX idx_<table>_org_id  ON public.<table> USING btree (org_id);   -- matches idx_workflow_definitions_created_by convention
CREATE INDEX idx_<table>_user_id ON public.<table> USING btree (user_id);  -- mirrors skills_user_id_idx; every RLS SELECT filters on user_id
CREATE INDEX idx_document_relationships_source ON public.document_relationships USING btree (source_doc_id);
CREATE INDEX idx_document_relationships_target ON public.document_relationships USING btree (target_doc_id);
```
NO GIN index on `filter_expr`/`match_expr` jsonb this phase — those query paths ship in 111+/113+; don't pre-optimize a path that doesn't exist.

#### Section 4 — Capability flag column (clone of `sandbox_enabled` / `token_capture_enabled`)
```sql
ALTER TABLE public.app_settings ADD COLUMN document_management_enabled boolean DEFAULT true;
COMMENT ON COLUMN public.app_settings.document_management_enabled IS
  'Phase 110 DMF-03. Master gate for net-new DM surfaces+tools (113-119). Default true => v3.0 behavior unchanged. Seam SEED-080 (v3.2) entitlement enforcement plugs into. NOT entangled with Phase 111 enrichment (D-110-2).';
```
The single `id='global'` row backfills automatically (`ADD COLUMN … DEFAULT true`) — no separate seed INSERT. Direct precedents at `full-schema.sql:293` (`sandbox_enabled boolean DEFAULT true`) and `:303` (`token_capture_enabled boolean DEFAULT true`).

---

### `backend/app/services/audit_service.py` (service, CRUD — MODIFY)

**Analog:** self. Two edits — extend the frozenset to 19, and add the shared `assert_action_types_synced(pool)` helper (single source of truth for boot + CI).

**Current `VALID_ACTION_TYPES` frozenset** `[VERIFIED: audit_service.py:13-19, no drift]`:
```python
VALID_ACTION_TYPES = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",   # Phase 33
    "feedback.submit",                    # Phase 39
})
```
Extend to **19** by adding the 8 D-110-1 strings (a `# Phase 110 DMF-01` comment block, mirroring the `# Phase 33`/`# Phase 39` annotation style). Edit this **in lockstep** with the migration's Section 1 array — out-of-sync = silent audit drop (Shared Pattern A).

**The swallow trap to design against** `[VERIFIED: audit_service.py:32-39, no drift]`:
```python
try:
    await aexec(supabase.table("audit_log").insert({
        "user_id": user_id, "action_type": action_type, "metadata": metadata,
    }))
except Exception as exc:
    logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
```
This `except Exception … logger.error` swallows the Postgres `23514` CHECK violation and **returns None normally**. A frozenset string absent from the live CHECK → a silently-dropped audit row + a "success" to the user. This is exactly why SC#4 must INSERT+SELECT against the live DB (NOT call `write_audit_entry` and assert its return — it always returns None). **Leave the swallow as-is (D-05); the drift guard is the control that makes it un-hide-able.**

**New shared helper to add** (next to `VALID_ACTION_TYPES`; the boot guard AND the CI test both call it — single source of truth, no second parse to drift):
```python
async def assert_action_types_synced(pool) -> None:
    """Raise if VALID_ACTION_TYPES is NOT a subset of the live audit_log CHECK enum.
    Subset only (frozenset ⊆ live CHECK) — a frozenset type missing from the DB is the
    DANGEROUS direction (silent 23514 drop). A DB type not in the frozenset is harmless
    (no writer) and must NOT fail. Called from main.py lifespan (boot) AND the CI test.
    """
    import re
    row = await pool.fetchrow(
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint "
        "WHERE conname = 'audit_log_action_type_check'"
    )
    if row is None:
        raise RuntimeError(
            "audit drift guard: audit_log_action_type_check constraint missing from live DB "
            "(migration 071 not applied)."
        )
    live_check = set(re.findall(r"'([^']+)'", row["def"]))
    missing = VALID_ACTION_TYPES - live_check
    if missing:
        raise RuntimeError(
            f"audit drift guard: VALID_ACTION_TYPES not a subset of live audit_log CHECK enum; "
            f"missing from DB: {sorted(missing)}. Migration 071 is not applied. Audit writes for "
            f"these action types would SILENTLY drop (audit_service swallows 23514)."
        )
```
A4 note: pin the `re.findall(r"'([^']+)'", …)` parse against the live `pg_get_constraintdef` rendering in Wave 0 (standard Postgres renders `'string'::text` literals — should match). The harness `_AUDIT_EVENT_TYPES` lockstep at `db/workflows.py:40-45` is the discipline to **imitate, NOT reuse** (it guards a *different* table, `harness_audit.event_type`).

---

### `backend/app/main.py` (config/lifespan, event-driven startup — MODIFY)

**Analog (HOME):** the Phase-081.1 post-pool-init block. **Analog (RAISE shape):** the existing `raise RuntimeError(...)` startup hard-fails at `:429`/`:448`.

**Insertion point — between line 231 and line 233** `[VERIFIED: main.py:205-233, no drift from research]`. The pool is guaranteed live after :228; insert the drift guard immediately AFTER the settings-migration block (`:225-231`) and BEFORE the Phase-091 `_resume_stranded` block (`:233`):
```python
# main.py:225-231 — the pool IS live after this block (insertion anchor = end of :231)
from app.dependencies import get_pg_pool
try:
    await get_pg_pool()  # ensure pool exists before migration
    await _migrate_settings_override()
except Exception as e:
    logger.error("Settings migration failed (app continues with file fallback): %s", e)
# <<< INSERT THE DRIFT GUARD HERE (after :231, before :233) >>>
```

**CRITICAL — this block must HARD-FAIL (`raise`), UNLIKE every neighbor.** Redis ping (`:219-223`), settings migration (`:227-231`), resume sweep (`:238-248`) are ALL best-effort (log-and-continue). The drift guard is the OPPOSITE — a drift is a guaranteed silent prod audit hole, so crash startup loudly (D-110-4, mirroring the 075.4 `UnknownProviderError`-at-startup pattern). **Do NOT wrap it in a swallowing try/except** (the F4 copy-paste trap — surrounding blocks all swallow). Just call the shared helper, let it raise:
```python
# Phase 110 DMF-01 / D-110-4 — audit-enum drift guard. MUST hard-fail (unlike the
# best-effort blocks above): a frozenset⊄CHECK drift = a silent prod audit hole.
from app.services.audit_service import assert_action_types_synced
await assert_action_types_synced(await get_pg_pool())
```
The existing hard-fail precedent shape `[VERIFIED: main.py:429]`:
```python
raise RuntimeError(
    "ENABLE_TEST_FIXTURES=1 in production environment — refusing to start. ..."
)
```
Multi-worker note (`WORKER_COUNT=2`): the guard runs per worker — fine (read-only, idempotent; a drift crashes all workers identically). No locking.

---

### `backend/app/models/user_settings.py` (model/config, request-response — MODIFY)

**Analog:** `sandbox_enabled` — the exact boolean-DEFAULT-true template through the whole chain. Three edits + an optional defensive wrapper.

**Edit 1 — `UserEffectiveSettings` field** (place near `sandbox_enabled` at `:134` for locality) `[VERIFIED: user_settings.py:133-134]`:
```python
# existing precedent at :133-134:
# Sandbox
sandbox_enabled: bool
# ADD (Phase 110 DMF-03 — master DM capability gate, migration 071; default True => unchanged behavior):
document_management_enabled: bool = True
```

**Edit 2 — `_build_settings_from_row` resolution line** (near the `sandbox_enabled` mapping at `:473`) `[VERIFIED: user_settings.py:473]`:
```python
# existing precedent at :473:
sandbox_enabled=_val_bool(row, "sandbox_enabled", "sandbox_enabled", True),
# ADD (env_attr=None — app_settings-only, no env fallback per CLAUDE.md "env vars are for secrets/infra only"):
document_management_enabled=_val_bool(row, "document_management_enabled", None, True),
```

**`_val_bool` contract** (why default-on holds) `[VERIFIED: user_settings.py:318-329]`:
```python
def _val_bool(row: dict, key: str, env_attr: str | None = None, default: bool = False) -> bool:
    v = row.get(key)
    if v is not None:
        return bool(v)
    if env_attr is not None:
        return bool(getattr(env_settings, env_attr, default))
    return default
```
A cold-cache / missing column → `v is None`, `env_attr is None` → returns `default=True`. Default-on guaranteed at the resolution layer.

**Read-helpers callers will use** (113–119 call these; 110 only lands the field) `[VERIFIED: user_settings.py:504-517]`:
```python
def load_app_settings() -> UserEffectiveSettings: ...           # sync, cache-backed (:504)
async def load_app_settings_async() -> UserEffectiveSettings: ...  # async, cache-refresh (:514)
# usage: if load_app_settings().document_management_enabled: ...
```

**Edit 3 (optional convenience wrapper — recommended) — defensive default-on helper.** Mirror `tool_args_progress_emit_boundary_bytes()` (`:545`), the EXACT "return a safe default on any read failure" precedent:
```python
def document_management_enabled() -> bool:
    """Phase 110 DMF-03 — master DM capability gate. Defensive: True on any read failure
    (a settings-read failure must NOT hide DM surfaces — default-on, D-110-2)."""
    try:
        return load_app_settings().document_management_enabled
    except Exception:  # noqa: BLE001 — defensive: default-on on cold cache / DB read failure
        return True
```
The `tool_args_progress_emit_boundary_bytes()` precedent (`:545-563`) does exactly this (try → `load_app_settings()...`; except → hardcoded fallback). **Note the polarity flip:** that helper falls back to a fixed VALUE; this one falls back to `True` (default-ON). F8 trap = returning `False` here would silently hide DM despite the default-on guarantee.

**Do NOT** wire this flag to any surface (none exist in 110) and do NOT touch the Phase-111 enrichment path (D-110-2: enrichment has its OWN knob, deliberately not behind this master flag).

---

### `supabase/full-schema.sql` (config artifact — REGENERATED, never hand-edited)

**Not a manual edit target.** It is the single-file deploy artifact regenerated by `bash scripts/regenerate-full-schema.sh` (NO `--reset` — dumps the live DB schema after migration 071 is applied). The executor runs the script and commits the diff alongside `071_…sql` + the code edits. F9 trap: never `--reset` (wipes dev data) and never hand-edit.

---

### Live-DB test harness (shared by all 4 `integration/` tests)

**Analog: `backend/tests/integration/test_092_harness_audit_live.py` — copy the harness VERBATIM.** Its docstring literally says "THIS IS THE TEST THAT CLOSES THE 091 MOCK BLIND SPOT" — it is THE precedent for "a live audit test that defeats a mock false-green." Copy these four pieces exactly:

```python
# DSN (:42-45):
_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)
# PG_AVAILABLE skipif (:48-75) — skips cleanly (never errors) when :54322 is down:
PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(not PG_AVAILABLE, reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; ...")
# Function-scoped pg_pool fixture (:82-105) — function scope REQUIRED (asyncpg pools are
# event-loop-bound; pytest-asyncio creates a fresh loop per test). Includes the jsonb codec init.
@pytest_asyncio.fixture
async def pg_pool(): ...
# Seeded throwaway auth.users + FK-safe teardown (:108-144) — audit_log.user_id FKs
# auth.users(id) ON DELETE CASCADE, so a REAL auth.users row is required for the INSERT.
@pytest_asyncio.fixture
async def test_thread_user(pg_pool): ...
```
**For 110, extend the `test_thread_user` teardown to also `DELETE FROM audit_log WHERE user_id = $1`** (the new tables' rows + audit probes share the seeded user). For the 2-user RLS test (`test_110_dm_schema.py`), seed TWO `auth.users` rows the same way.

> **Test-skip caveat (verification bar):** these tests SKIP (not fail) when :54322 is down — so a green run on a DB-down machine is NOT a pass. The phase gate requires them GREEN against the live DB **with migration 071 applied**.

---

### `backend/tests/integration/test_110_dm_audit_live.py` (test, CRUD live round-trip — SC#4, the load-bearing gate)

Parametrized live INSERT+SELECT over **ALL 8** new action types (not a subset — each is an independent closed-CHECK string; the 8 ARE the population). Raw asyncpg (NOT `write_audit_entry` — that swallows):
```python
@pytest.mark.parametrize("action_type", sorted(NEW_DM_ACTION_TYPES))  # the 8 D-110-1 strings
async def test_dm_audit_type_round_trips_live(pg_pool, test_thread_user, action_type):
    _thread_id, user_id = test_thread_user
    await pg_pool.execute(  # raises asyncpg CheckViolationError on drift — NOT swallowed (that's the point)
        "INSERT INTO audit_log (user_id, action_type, metadata) VALUES ($1, $2, $3::jsonb)",
        user_id, action_type, json.dumps({"phase": "110", "probe": True}),
    )
    row = await pg_pool.fetchrow(
        "SELECT action_type FROM audit_log WHERE user_id = $1 AND action_type = $2",
        user_id, action_type,
    )
    assert row is not None, f"audit row for {action_type} did not land — CHECK enum drift"
    assert row["action_type"] == action_type
```
Mock-proof: a drift raises `CheckViolationError` on INSERT (RED) or SELECT returns None (RED). Optional belt-and-suspenders: also drive ONE type through the real `write_audit_entry` (supabase-py path) + SELECT it back.

### `backend/tests/integration/test_110_audit_drift_guard.py` (test, subset assert — SC#3 CI half)

Calls the SAME shared `assert_action_types_synced(pool)` from `audit_service` (single source of truth — no second parse). RED on drift, before deploy, without waiting for a boot crash:
```python
async def test_valid_action_types_subset_of_live_check(pg_pool):
    from app.services.audit_service import assert_action_types_synced
    await assert_action_types_synced(pg_pool)  # raises RuntimeError on drift → test RED
```

### `backend/tests/integration/test_110_dm_schema.py` (test, schema + 2-user RLS — SC#1)

Asserts (via `pg_constraint`/`information_schema`): 4 tables exist with `rowsecurity = true`, each `org_id` nullable + no FK (F7 trap), the `auth.uid()=user_id OR is_global` SELECT shape. **Live 2-user RLS sample:** seed users A + B (test_092 fixture pattern, two rows); user B's SELECT of A's private row → 0 rows; B's SELECT of a global (`is_global=true`) row → returns it. Cover the cross-user path on ≥2 of the 4 tables + the nullable-`user_id` global-field path on `metadata_field_definitions` (the only nullable-owner deviation). The other two share the identical policy shape — schema-assert their policies match. (Note: RLS predicates evaluate `auth.uid()` — drive via the authenticated/anon role or `set_config('request.jwt.claim.sub', ...)`, since a raw superuser asyncpg pool bypasses RLS. Planner pins the exact role-switch mechanism in Wave 0.)

### `backend/tests/integration/test_110_flag.py` (test, column + read — SC#5)

`SELECT document_management_enabled FROM app_settings WHERE id='global'` returns `true`; `load_app_settings_async().document_management_enabled is True`.

### `backend/tests/test_110_boot_guard.py` (test, unit — SC#3 boot half)

Unit (NOT integration — `tests/`, not `tests/integration/`). Construct a STUB pool whose `fetchrow` returns a `pg_get_constraintdef` def **missing one of the 19 types**, assert `assert_action_types_synced(stub)` raises `RuntimeError`. Also assert it raises when `fetchrow` returns `None` (constraint absent). No live DB needed — the stub is the point (proves the guard fires before a real boot crash).

### `backend/tests/test_110_flag_default.py` (test, unit — SC#5 default-on)

Force `load_app_settings()` to raise (monkeypatch), assert the defensive `document_management_enabled()` wrapper returns `True` (F8 trap — must NOT default OFF). Mirrors the `tool_args_progress_emit_boundary_bytes()` defensive-default test shape.

---

## Shared Patterns

### A. Audit lockstep + silent-swallow (the phase's reason to exist)
**Source:** `audit_service.py:13-19` (frozenset) ⇄ `full-schema.sql:333` (CHECK) ⇄ `db/workflows.py:40-45` (the lockstep-discipline comment to imitate).
**Apply to:** the migration Section 1, the `audit_service.py` frozenset edit, ALL audit tests.
`write_audit_entry` swallows `23514` and returns None — a frozenset/CHECK mismatch fails **silently**. Mocks false-green it completely (`tests/test_audit.py` is all-mock). Therefore: (1) edit both halves in one commit; (2) SC#4 is LIVE raw-asyncpg INSERT+SELECT, never a mock, never `write_audit_entry`'s return value; (3) the boot+CI drift guard makes the swallow un-hide-able. This is the D-102 "static would false-green" trap — design verification against the swallow, not the happy path.

### B. RLS shape — mirror `skills` (user_id + is_global), NOT `workflow_definitions`
**Source:** `skills` policies `[VERIFIED: full-schema.sql:1856/1954/2045/2110]`; `workflow_definitions` global-INSERT forcing `[VERIFIED: :1961/:2052]`.
**Apply to:** all 4 new tables.
**THE TRAP (F5):** `workflow_definitions` keys on `created_by uuid NOT NULL` (`:720`), so its policies read `auth.uid() = created_by`. The 4 DM tables use `user_id` (D-110-3) — copying `workflow_definitions` verbatim references a **non-existent column**. Use `skills` as the template (it keys on `user_id` + `is_global` — the exact DM shape); borrow ONLY the global-INSERT `WITH CHECK ((auth.uid()=user_id) AND (is_global=false))` from `workflow_definitions`.

`skills` precedent (the template) `[VERIFIED verbatim, this session]`:
```sql
CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));   -- :2110
CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT WITH CHECK ((auth.uid() = user_id));                              -- :1954 (skills does NOT force is_global=false)
CREATE POLICY "Users can update own skills" ON public.skills FOR UPDATE USING ((auth.uid() = user_id));                                   -- :2045
CREATE POLICY "Users can delete own skills" ON public.skills FOR DELETE USING ((auth.uid() = user_id));                                   -- :1856
```
`workflow_definitions` global-INSERT forcing (the clause to BORROW) `[VERIFIED verbatim]`:
```sql
... FOR INSERT WITH CHECK (((auth.uid() = created_by) AND (is_global = false)));   -- :1961
... FOR UPDATE USING ((auth.uid() = created_by)) WITH CHECK (((auth.uid() = created_by) AND (is_global = false)));   -- :2052
```
**Recommended per-table shape (owner = `user_id`):**
```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own and global <table>" ON public.<table>
  FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));
CREATE POLICY "Users can insert own <table>" ON public.<table>
  FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));   -- borrow workflow_definitions forcing
CREATE POLICY "Users can update own <table>" ON public.<table>
  FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can delete own <table>" ON public.<table>
  FOR DELETE USING ((auth.uid() = user_id));
```
**There is NO DB admin role** `[VERIFIED: no role/claim predicate anywhere in full-schema.sql RLS]`. Globals are service-role/migration-seeded only (the service-role key bypasses RLS). Forcing `is_global = false` in WITH CHECK = "no end-user request can create a global row" — do NOT build an admin predicate this phase. For `metadata_field_definitions` (nullable `user_id`), a global row reaches users only via `OR is_global = true` — hence the A2 reachability CHECK.

### C. Forward-compat `org_id` (Pitfall 7) — verbatim comment, nullable, no FK
**Source:** `full-schema.sql:734` (and :465/:766/:796 — the 4 workflow-table precedents).
**Apply to:** all 4 new tables.
```sql
COMMENT ON COLUMN public.<table>.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';
```
Keep the comment grep-consistent (the existing 4 tables say "v2.8" — note the v3.0 milestone in the migration header rather than diverging the comment). `org_id` MUST be nullable with NO FK and NOT NULL (F7 trap — over-building tenancy now breaks the v3.3 re-key). The re-keyable seam = `auth.uid() = user_id` (swappable for `org_membership(...)` in v3.3) + the nullable column. Do NOT inline two-valued logic into any helper (110 ships no read paths, so there is nothing to route yet).

### D. Migration apply + regen discipline (autonomous:false)
**Source:** CLAUDE.md "Schema changes ship as numbered SQL migrations" + `scripts/regenerate-full-schema.sh` header.
**Apply to:** the migration task + the regen task.
1. Author `071_dm_foundations.sql` (one `BEGIN;…COMMIT;`, all 4 sections). 2. **MANUAL apply (`autonomous:false`):** operator pastes into the Supabase SQL editor → runs vs live :54322; NEVER `db push`/`db reset`. 3. `bash scripts/regenerate-full-schema.sh` (NO `--reset`). 4. Sync `VALID_ACTION_TYPES` + boot guard + settings field in the SAME commit. 5. Commit migration + regenerated `full-schema.sql` + code together. 6. Run the live tests vs the migrated DB — must be GREEN.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/tests/test_110_boot_guard.py` (stub-pool half) | test (unit) | event-driven | No existing unit test stubs an asyncpg pool to feed a fake `pg_get_constraintdef` def. The HARNESS analog (test_092) is live-DB; the stub-pool assertion is genuinely net-new (a small `MagicMock`/fake `fetchrow` returning a constraint-def string is sufficient — no precedent to copy, trivial to write). |

> Everything else has an exact or strong in-repo analog. There is no "use RESEARCH.md patterns instead" gap — the research is entirely internal-precedent-grounded and every shape was re-anchored to live source this session.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/full-schema.sql` (audit CHECK, app_settings, skills/workflow_definitions RLS, org_id comments, FK ON DELETE patterns), `backend/app/services/audit_service.py`, `backend/app/main.py` (lifespan + hard-fail precedents), `backend/app/models/user_settings.py` (settings read chain), `backend/app/db/workflows.py` (lockstep-to-imitate), `backend/tests/integration/test_092_harness_audit_live.py` (live-DB harness).
**Files scanned:** 8 source/schema files + 1 test harness, all re-anchored at HEAD.
**HEAD drift check:** audit CHECK (`:333`), skills RLS (`:1856/1954/2045/2110`), workflow_definitions RLS (`:1961/:2052/:2117`), `app_settings` (`:259-306`), org_id comment (`:734`), frozenset (`audit_service.py:13-19`), swallow (`:32-39`), lifespan insertion (`main.py:225-233`), `_val_bool` (`:318`), `sandbox_enabled` field (`:134`), `_build_settings_from_row` line (`:473`), helpers (`:504-517`, `:545`) — ALL confirmed, no drift from the research's cited anchors. Next free migration number = `071` (highest applied = `070`).
**Pattern extraction date:** 2026-06-15
