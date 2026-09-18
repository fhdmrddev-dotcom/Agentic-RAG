# Phase 253: The bootstrap artifact tells the whole truth — Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 7 (2 created, 5 modified)
**Analogs found:** 7 / 7 — **no file in this phase is without a close analog.** The two "new" files
each have an existing sibling that already does 80% of the job.

⭐ **The headline finding, and it changes how P1 should be planned:**
`scripts/build-recall-bench.py` (Phase 241) **already builds a throwaway database on the local
Supabase cluster, applies `supabase/full-schema.sql` wholesale, installs the Supabase default-ACL
preamble, and then reads as `authenticated` inside a rolled-back transaction.** D-01, D-02, D-03 and
D-06 are not new territory — they are a re-use with **one deliberate departure** (D-02 requires the
preamble be DERIVED from `pg_default_acl`; the bench HARD-TYPES it). Plan P1 that does not open that
file will re-invent a guard (`assert_bench_target`) that already exists and is already fenced RED.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| **NEW** `scripts/check-greenfield-privileges.py` | gate / standalone harness | batch + DB I/O (create → apply → assert → drop) | `scripts/build-recall-bench.py` | **exact** (same role, same data flow, same cluster, same artifact) |
| **NEW** `backend/tests/unit/test_253_*.py` (column fence) | test | file-I/O + transform (cross-language set equality) | `backend/tests/unit/test_211_closed_set_agreement.py` | **exact** |
| `scripts/full-schema-supplement.sql` §5 | config artifact (DDL, hand-maintained, pasteable) | batch | its own §5 block (lines 194-262) + migrations `129:85-105`, `151:90-102`, `168/169/172`, `177:70-100` | **exact** (self-analog; copy-from-migration rule) |
| `supabase/full-schema.sql` (ACL tail) | generated artifact | batch (pure `cat` append) | `scripts/regenerate-full-schema.sh:137-150` | **exact** — mechanism measured, see §"How the tail is produced" |
| `scripts/check-schema-acl-parity.cjs` | gate / utility | transform (text parity) | itself + `scripts/check-seeds-register.cjs` (`--self-test` + `--files` + fixture register) | **exact** |
| `docs/HOT-FILE-LEDGER.md` + CLAUDE.md scan table | register / doc | table row | `frontend/src/lib/workspaceAllowedExt.ts` row (`10638`) + section (`11876-11898`) | **exact** |
| `.planning/seeds/SEED-266-*.md` `status_note` | register frontmatter | text | SEED-266's own 2026-09-16 entry | **exact** (self-analog) |

---

## Pattern Assignments

### 1. `scripts/check-greenfield-privileges.py` (gate, batch + DB I/O) — **NEW**

**Primary analog:** `scripts/build-recall-bench.py` (1162 lines, Phase 241 / 241-02 / 241-04).
**Secondary analogs:** `scripts/apply_migration_178.py` (sync psycopg2 apply-a-file script, 234 L),
`scripts/verify-v40-cloud-migrations.sql` (the **privilege-assertion SQL idiom** — read this before
writing a single assertion), `backend/tests/unit/test_241_bench_safety.py` (how the Python DB script
is driven RED without a database).

#### 1a. Shebang + module docstring shape (`build-recall-bench.py:1-64`)

```python
#!/usr/bin/env python
"""Phase 241 (241-02 / QUEUE-06 / D-07 / D-08) — build a throwaway ``recall_bench``
database on the LOCAL Docker Postgres, big enough and SKEWED enough for ...

⛔ SAFETY, which is this script's whole point. It issues irreversible database-level
drop and create statements against a local Postgres cluster that also holds the
operator's live Supabase development data -- 159 documents and 7,953 chunks that no
migration, no backup and no fixture can restore. Two independent properties keep that
safe: ``assert_bench_target`` runs before every one of them ...

Usage
-----
    python scripts/build-recall-bench.py \\
        --source-dsn postgresql://postgres:postgres@127.0.0.1:54322/postgres \\
        ...
"""
from __future__ import annotations
```

#### 1b. The DSN target guard — **copy this whole seam, do not re-derive it** (`:80-210`)

```python
BENCH_DB_NAME = "recall_bench"
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})
_ACCEPTED_SCHEMES = frozenset({"postgres", "postgresql"})
ALLOWED_PORTS = frozenset({54322})

class BenchTargetRefused(RuntimeError):
    """The requested target is not a loopback ``recall_bench`` database."""

def assert_bench_target(dsn: str) -> None:
    parsed = urllib.parse.urlparse(dsn)
    if parsed.scheme.lower() not in _ACCEPTED_SCHEMES: raise BenchTargetRefused(...)
    # ⛔ THE HOST LIST ARM, AND IT MUST RUN FIRST. `urlparse(...).port` RAISES ValueError on
    #    a multi-host netloc, so no later arm may read `.port` before this one has refused.
    hostspec = parsed.netloc.rpartition("@")[2]
    if "," in hostspec: raise BenchTargetRefused(... "comma-separated host LIST" ...)
    if parsed.query: raise BenchTargetRefused(... "query parameters can carry host= overrides" ...)
    if host.lower() not in LOOPBACK_HOSTS: raise BenchTargetRefused(...)
    if database != BENCH_DB_NAME: raise BenchTargetRefused(
        f"... The check is equality, never a substring, so {BENCH_DB_NAME}_prod is refused too.")

def maintenance_dsn(bench_dsn: str) -> str:
    """The same server, ``postgres`` database — the only place a database can be made."""
    parsed = urllib.parse.urlparse(bench_dsn)
    return urllib.parse.urlunparse(parsed._replace(path="/postgres"))
```

⚠ **D-06 (unique-per-run scratch name) BREAKS this guard's `==` as written.** `assert_bench_target`
refuses anything whose database name is not the single constant — deliberately, *"never a
substring, so `recall_bench_prod` is refused too"*. A `greenfield_<pid>_<ts>` name needs the
equality replaced by an **anchored regex on a generated-name grammar** (e.g.
`^greenfield_acl_[0-9]{1,10}_[0-9]{1,14}$`), and the `DROP`/`CREATE` must still interpolate a value
this script GENERATED, never one parsed from a flag. State that departure in the plan; it is the one
place the analog cannot be copied verbatim.

#### 1c. asyncpg acquisition + the `backend/venv` invocation (`:421-434`)

```python
def _require_asyncpg():
    try:
        import asyncpg  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - environment, not logic
        raise SystemExit(
            "asyncpg is required and is already a backend dependency; run this with "
            "backend/venv/Scripts/python"
        ) from exc
    return asyncpg

async def connect(dsn: str, *, read_only: bool = False):
    asyncpg = _require_asyncpg()
    conn = await asyncpg.connect(dsn)
    if read_only:
        await conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
        await conn.execute("SET default_transaction_read_only = on")
    return conn
```

**Invocation on Windows (measured, two independent sources):**
- `scripts/build-recall-bench.py:426-428` — *"run this with `backend/venv/Scripts/python`"*
- `scripts/apply_migration_178.py:25` — `Run: backend/venv/Scripts/python scripts/apply_migration_178.py`

**Where the DSN comes from: NOWHERE — it is hard-coded to loopback, on purpose.** Both analogs refuse
to read an env var:
- `apply_migration_178.py:18-20` — *"⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ. … This script cannot reach cloud even by accident."*
- `build-recall-bench.py:987` — argparse `default=f"postgresql://postgres:postgres@127.0.0.1:54322/{BENCH_DB_NAME}"`, still passed through `assert_bench_target`.
- `backend/tests/conftest.py:17-19` records the same fact from the other side: *"`postgres_dsn` defaults to the LIVE local Postgres (127.0.0.1:54322)"*.

⛔ **Do not read `backend/.env` and do not read `POSTGRES_DSN`.** Both analogs rejected that, and the
recorded reason is that an env var is how a local-only script reaches cloud by accident.

#### 1d. Create / drop, both behind the guard (`:450-473`)

```python
async def create_bench_database(bench_dsn: str) -> None:
    assert_bench_target(bench_dsn)
    conn = await connect(maintenance_dsn(bench_dsn))
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{BENCH_DB_NAME}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{BENCH_DB_NAME}"')
    finally:
        await conn.close()

async def teardown_bench_database(bench_dsn: str) -> None:
    assert_bench_target(bench_dsn)
    conn = await connect(maintenance_dsn(bench_dsn))
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{BENCH_DB_NAME}" WITH (FORCE)')
        still_there = await conn.fetchval(
            "SELECT count(*) FROM pg_database WHERE datname = $1", BENCH_DB_NAME)
        if still_there:
            raise RuntimeError(f"{BENCH_DB_NAME} is still present in pg_database after teardown")
    finally:
        await conn.close()
```

`DROP DATABASE IF EXISTS … WITH (FORCE)` **is** D-06's "drop-if-exists guard", already written.
Teardown **proves** the drop by re-reading `pg_database` — copy that; a `finally: drop` that is not
verified is how a scratch DB accumulates on a shared cluster.

#### 1e. The preamble — D-02's ONE departure from the analog (`:227-330`)

The analog carries a hand-typed block and says so:

```sql
-- These four statements are the REAL database's own `pg_default_acl` rows, read back
-- verbatim from the operator's local Supabase rather than invented here. They run in the
-- prelude — BEFORE the apply — precisely so every table the artifact creates acquires them
-- at CREATE time, which is the same mechanism production uses.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
```

⭐ **D-02 requires this be DERIVED from the live cluster's `pg_default_acl` instead of typed** — and
the analog's own comment *"read back verbatim from the operator's local Supabase rather than invented
here"* is the argument FOR deriving it, made by a file that then typed it anyway. Two measured facts
support the derivation being sound and one complicates it:

- CONTEXT §code_context: `public` carries default ACLs from **two** owners (`postgres`,
  `supabase_admin`), both `arwdDxtm` on TABLES. The typed block above names **only `postgres`'s** —
  so the analog's preamble is already an under-statement of the live cluster.
- `grep -rln "ALTER DEFAULT PRIVILEGES" supabase/migrations/` → nothing, so `pg_default_acl` is
  pristine stock and is a legitimate source.
- ⚠ **`defaclrole` matters.** `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin …` can only be
  issued by a role that is a member of `supabase_admin`; the derivation must either issue it as the
  superuser `postgres` connection (which the maintenance DSN already is) or record why a row was
  skipped. The query to write (state it, do not guess the output):
  `SELECT pg_get_userbyid(d.defaclrole) AS owner, n.nspname, d.defaclobjtype, d.defaclacl
     FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname = 'public';`
  D-02 also requires the derived text be **printed into the harness's own evidence** — the analog's
  habit of echoing what it did (`apply_migration_178.py:88-89` echoes server NOTICEs) is the model.

**Also carried by PRELUDE_SQL and still needed** (a fresh DB on the same cluster has no `auth` /
`storage` schema, and `full-schema.sql`'s supplement writes into both): the `auth` schema + `auth.users`
+ `auth.uid()` stub, `storage.buckets` / `storage.objects` / `storage.foldername`, the
`supabase_realtime` publication, and `GRANT USAGE ON SCHEMA auth/storage TO anon, authenticated,
service_role`. ⛔ The `auth.uid()` stub carries a **verbatim refusal comment** at `:224-235` that must
be lifted with it — *"it must never be copied into `supabase/migrations/` nor into `full-schema.sql`,
because production's `auth.uid()` is Supabase Auth's own and a hand-rolled one would be an
authentication bypass on 156 call sites."*

#### 1f. Applying the artifact, with a line number on failure (`:481-511`)

```python
async def apply_full_schema(conn, schema_path: pathlib.Path) -> None:
    """Apply the project's own bootstrap artifact wholesale, failing loudly."""
    asyncpg = _require_asyncpg()
    sql = schema_path.read_text(encoding="utf-8")
    await conn.execute(PRELUDE_SQL)
    try:
        await conn.execute(sql)
    except asyncpg.PostgresError as exc:
        position = getattr(exc, "position", None)
        ...
        raise RuntimeError(f"full-schema.sql failed to apply{where} -- {type(exc).__name__}: {exc}") from exc
    await conn.execute(DROP_SIGNUP_TRIGGER_SQL)
    # ⚠ MEASURED at 241-04. `full-schema.sql:33` is `SET row_security = off;` -- pg_dump
    # emits it and it is a SESSION setting, so it survives the apply and every later
    # statement this connection issues runs with RLS DISABLED. ...
    await conn.execute("SET row_security = on")
```

⚠⚠ **`SET row_security = on` after the apply is NOT optional and it is SEED-266 arm (b) in action.**
Without it the harness's own reads run RLS-off and a refusal reads as a privilege failure when it is
a session failure. This is the single highest-value line in the analog.

#### 1g. **Measuring as `authenticated`, never through the service role** (`:557-585`)

```python
async def _assert_readable_as_authenticated(conn) -> list[str]:
    tables = ("documents", "document_chunks", "folders", "connector_connections")
    async with conn.transaction():
        # Self-defending: `full-schema.sql:33` leaves `row_security = off` on whatever
        # session applied it, and a non-owner query against an RLS table then refuses with
        # `query would be affected by row-level security policy`. That refusal is about the
        # SESSION, not the privilege, and reading it as a grant failure sends the next
        # reader to the wrong fix -- so this asserts the privilege with RLS explicitly ON.
        await conn.execute("SET LOCAL row_security = on")
        await conn.execute("SET LOCAL ROLE authenticated")
        for table in tables:
            try:
                await conn.fetchval(f"SELECT count(*) FROM public.{table}")
            except Exception as exc:  # noqa: BLE001 - re-raised with the cause named
                raise RuntimeError(
                    f"the bench is unreadable as `authenticated`: public.{table} refused "
                    f"({type(exc).__name__}: {exc}). full-schema.sql carries no ACLs "
                    "(pg_dump --no-privileges) and pg_default_acl is per-database -- see "
                    "PRELUDE_SQL's default-privileges block.") from exc
        await conn.execute("RESET ROLE")
    return list(tables)
```

⭐ **`SET LOCAL ROLE authenticated` inside `async with conn.transaction()` is the operator's SC#1
framing, already implemented.** Copy the shape: *a real read AS the real role, rolled back, so it
measures the privilege rather than asserting about a catalog row.*

#### 1h. **The privilege-assertion SQL — read `scripts/verify-v40-cloud-migrations.sql:70-92` FIRST**

This is the one place where an obvious approach has been **measured wrong** in this repo:

```sql
-- ⚠ REPAIRED (D-242-05). `information_schema.column_privileges` shows only the grants the
--   CONNECTING role can see, so it returns empty for every column under a role that is neither
--   grantor nor grantee — a false FAIL that says nothing about the database. `pg_attribute.attacl`
--   is the column's real ACL and is readable by anyone who can read the catalog.
('156', 'that column carries an explicit column-level GRANT to authenticated (the 118 trap)',
 exists(select 1 from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace,
             lateral unnest(coalesce(a.attacl, '{}'::aclitem[])) as acl
        where n.nspname='public' and c.relname='connector_connections'
          and a.attname='default_ingest_visibility'
          and split_part(acl::text, '=', 1) = 'authenticated'
          and split_part(split_part(acl::text, '=', 2), '/', 1) like '%r%')),

-- The corroborating half: the question that actually matters, answered by Postgres itself and
-- independent of HOW the grant was expressed (column, table, or PUBLIC).
('156', 'authenticated can in fact SELECT that column (has_column_privilege)',
 has_column_privilege('authenticated', 'public.connector_connections',
                      'default_ingest_visibility', 'SELECT')),
```

⛔ **`information_schema.column_privileges` is the trap.** The supplement's own §5 header
(`:237-239`) still recommends it. `has_column_privilege(...)` / `has_table_privilege(...)` answer the
question D-05 asks — *does `authenticated` hold this, however it was granted* — and are the right
primitive for the derived assertion set. `pg_attribute.attacl` / `pg_class.relacl` are the
corroborating half.

#### 1i. Skip-with-a-stated-reason (D-04) — the analog is `scripts/check-security-advisors.sh`

That gate never skips silently; it prints a named reason and a remedy before exiting:

```bash
# Exit codes:
#   0 - Clean or only WARN-level findings present
#   1 - One or more ERROR-level security findings present, or missing config
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN environment variable is required ..." >&2
  echo "Generate a Personal Access Token in the Supabase Dashboard ..." >&2
  exit 1
fi
```

⚠ It exits **1**, not 0, on missing config. D-04 wants a **skip** (distinct from a pass and from a
violation). Recommend the repo's own three-code convention used by every `check-*.cjs`
(`0 clear · 1 violation · 2 harness error`) with the skip reported as a **distinct printed verdict
line plus exit 2**, e.g. `greenfield privileges SKIPPED — no Postgres on 127.0.0.1:54322 (…); start
it with scripts/start-local-infra.ps1`. Exit 0 on an unreachable database re-creates exactly the
vacuous-pass this project has now measured three times.

#### 1j. How this gets driven RED without a database — `backend/tests/unit/test_241_bench_safety.py`

```python
"""...This module needs **no network, no database and no environment variable**. It imports
the builder's pure validation seam and asserts on it, plus one SOURCE fence proving
that every destructive ``CREATE DATABASE`` / ``DROP DATABASE`` statement in the builder
is preceded, *in its own function*, by a call to that seam. ..."""

_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
_SCRIPT = _REPO_ROOT / "scripts" / "build-recall-bench.py"

def _load_builder():
    """Import scripts/build-recall-bench.py as a module (cached on sys.modules)."""
    if "build_recall_bench_under_test" in sys.modules:
        return sys.modules["build_recall_bench_under_test"]
    if not _SCRIPT.exists():
        raise ImportError(f"the recall-bench builder does not exist yet: {_SCRIPT} "
                          "(this is the RED state of 241-02 Task 1)")
    spec = importlib.util.spec_from_file_location("build_recall_bench_under_test", _SCRIPT)
    module = importlib.util.module_from_spec(spec); sys.modules[...] = module
    spec.loader.exec_module(module)
    return module
brb = _load_builder()
```

Named cases worth mirroring: `test_every_destructive_statement_sits_in_a_function_guarded_above_it`
(an `ast` walk), `test_the_guard_is_not_dead_code_when_destructive_statements_exist`.
⚠ **This is a `backend/tests/unit` file that fences a `scripts/` DB harness with no DB.** D-04
forbids the *harness* from entering `tests/unit`; it does **not** forbid a no-DB fence over it, and
the 241 precedent shows the project already draws that line exactly there.

---

### 2. `backend/tests/unit/test_253_*.py` — the `_TABLE_SELECTABLE_KEYS` column fence (test, file-I/O + transform) — **NEW**

**Analog: `backend/tests/unit/test_211_closed_set_agreement.py`** — the repo's canonical
*"a Python constant and a `.sql` file must agree"* fence. D-08 is the same shape with
`_TABLE_SELECTABLE_KEYS` in place of `EXTERNAL_ACTION_CAPABILITIES` and the supplement in place of
migration 116.

**Path resolution + imports (`:35-62`):**

```python
from __future__ import annotations
import re
from pathlib import Path
import pytest
from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

# backend/tests/unit/<this file>  ->  parents[2] == backend/, parents[3] == repo root
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BACKEND_ROOT.parent
_MIGRATION_116 = _REPO_ROOT / "supabase" / "migrations" / "116_connector_connections.sql"
```

For this phase: `_SUPPLEMENT = _REPO_ROOT / "scripts" / "full-schema-supplement.sql"` and
`from app.services.connector_service import _TABLE_SELECTABLE_KEYS`.
⚠ **No conftest fixture does repo-root resolution** — `backend/tests/conftest.py` sets env vars only.
Every test in this repo does its own `parents[N]`; `parents[3]` == repo root from
`backend/tests/unit/`, `parents[4]` from `backend/tests/unit/services/sources/`.
`test_183_skip_parse_parity.py:28` writes the arithmetic down as a comment *"if this file is moved,
fix the `parents[3]` arithmetic above rather than deleting this control"* — copy that habit.

**The extractor + the `None`-vs-empty-set distinction (`:181-205`):**

```python
#: Matches ``CHECK (capability IN ('a','b'))`` ... captures the LIST BODY as ``members``. Named
#: group, so a failure message can quote what it read rather than a group index.
_SQL_CAPABILITY_LIST = re.compile(r"...(?P<members>[^)\]]*)", re.IGNORECASE | re.DOTALL)
_SQL_STRING_LITERAL = re.compile(r"'([^']*)'")

def _capabilities_declared_in_sql(sql_text: str) -> set[str] | None:
    """``None`` rather than ``set()`` is load-bearing: an empty set and "the regex did not
    match" are different facts, and conflating them is exactly how a cross-language fence
    ships green while reading nothing."""
    match = _SQL_CAPABILITY_LIST.search(sql_text)
    if match is None: return None
    return set(_SQL_STRING_LITERAL.findall(match.group("members")))
```

**The falsify-the-extractor-first control (`:208-243`) — this is the non-negotiable part:**

```python
def test_the_sql_extractor_is_falsified_on_synthetic_input_first():
    """⚠ CONTROL — run before the real file is read anywhere in this module."""
    wrong = _capabilities_declared_in_sql("""capability text NOT NULL CHECK (capability IN (
            'send_email', 'wire_transfer')),""")
    assert wrong == {"send_email", "wire_transfer"}, (
        "the control clause carries a deliberately wrong member and the extractor must "
        f"REPORT it rather than normalise it away; it returned {wrong!r}. An extractor that "
        "cannot see a wrong member cannot see a drifted one either")
    prose = _capabilities_declared_in_sql(
        "-- The CLOSED capability set D-04 pins. SQL cannot import the Python frozenset")
    assert prose is None, (
        f"the extractor matched a line of prose about `capability` and returned {prose!r}; a "
        "fence that fires on English is a fence that gets loosened away")
```

⚠ For §5 the prose arm is **live, not hypothetical**: `full-schema-supplement.sql:222-240` is 19 lines
of comment that mention column names (`secret_ciphertext`, `mcp_server_url`, `tool_grants`,
`discovered_tools`, `service_id`) directly above the real `GRANT SELECT (`. An extractor that reads
comments will silently include `secret_ciphertext` — the **one column whose absence is the point**.

**The real assertion + the two non-vacuity guards (`:245-270`):**

```python
assert _MIGRATION_116.exists(), (
    f"{_MIGRATION_116} does not exist — the walk found nothing to check, so a green "
    "here would mean the file moved rather than that the constraint agrees")
declared = _capabilities_declared_in_sql(_MIGRATION_116.read_text(encoding="utf-8", errors="replace"))
assert declared is not None, (
    f"the capability CHECK clause was not found in {_MIGRATION_116.name}. The extractor "
    "is proved non-vacuous by the control above, so this means the DDL's shape changed "
    "— re-derive the matcher rather than deleting this case")
assert declared == set(EXTERNAL_ACTION_CAPABILITIES), (...)
```

**The value the fence binds to (`backend/app/services/connector_service.py:102-143`):**

```python
_RESPONSE_KEYS: tuple[str, ...] = tuple(ConnectorConnectionResponse.model_fields)
...
# DERIVED from the response model, excluding virtual/joined fields that live on other tables
# (e.g. `account_email` and `account_name` which live in `connector_tokens` table):
_NON_TABLE_RESPONSE_KEYS: frozenset[str] = frozenset({"account_email", "account_name"})
_TABLE_SELECTABLE_KEYS: tuple[str, ...] = tuple(k for k in _RESPONSE_KEYS if k not in _NON_TABLE_RESPONSE_KEYS)
_SELECTABLE_COLUMNS: str = ",".join(_TABLE_SELECTABLE_KEYS)
```

⭐ D-08's reason for a **pytest and not a JS regex** is legible right here: the value is
`tuple(ConnectorConnectionResponse.model_fields)` minus a frozenset. A regex can only pin a spelling.
`connector_service.py:112` already carries a module-scope `assert "secret_ciphertext" not in
_RESPONSE_KEYS` — the new fence sits beside that, not instead of it.
⚠ The `_TABLE_SELECTABLE_KEYS` **order** follows the Pydantic model; §5's list is hand-ordered.
**Assert set equality, and say so** — an ordered comparison would red on a harmless field reorder.

---

### 3. `scripts/full-schema-supplement.sql` §5 (config artifact, batch) — **MODIFIED**

**Analog: its own §5 block, verbatim** (`:194-262`). Every new table block copies this shape:
header comment explaining *why it lives in the supplement* → `REVOKE ALL … FROM anon;` →
`REVOKE ALL … FROM authenticated;` → one-column-per-line `GRANT SELECT ( … ) … TO authenticated;` →
table-level write grants.

```sql
-- ============================================================
-- 5. Column-level privilege: connector_connections.secret_ciphertext
--    (migration 118 / Phase 190 code-review finding CR-01)
-- ============================================================
-- ⚠ WHY THIS LIVES HERE RATHER THAN IN THE DUMP: regenerate-full-schema.sh runs
--    `pg_dump --no-privileges`, so full-schema.sql carries NO ACLs AT ALL ...
--    ⚠ ORDER MATTERS AGAINST THE DEFAULT PRIVILEGES. This block must run AFTER
--    the table exists and after any blanket grant, which it does: the supplement
--    is appended at the END of full-schema.sql.
REVOKE ALL ON public.connector_connections FROM anon;
REVOKE ALL ON public.connector_connections FROM authenticated;

-- One column per line so the OMISSION is visible in a diff. The column that is not
-- here is `secret_ciphertext`.
-- ⚠ MEASURED DRIFT, 2026-08-26 (Phase 211). This list had fallen FOUR COLUMNS behind the
--    live table, and the failure it ships is TOTAL rather than partial. ...
GRANT SELECT (
    id,
    org_id,
    created_by,
    capability,
    name,
    config,
    is_enabled,
    last_checked_at,
    last_check_verdict,
    created_at,
    updated_at,
    mcp_server_url,
    tool_grants,
    discovered_tools,
    service_id
) ON public.connector_connections TO authenticated;

-- Writes stay at TABLE level, INCLUDING the secret column: the org-admin create/edit
-- path runs on the user-JWT client and must be able to store an `enc:v1:` envelope.
-- A role may INSERT into and UPDATE a column it can never SELECT.
GRANT INSERT, UPDATE, DELETE ON public.connector_connections TO authenticated;
```

**The copy-from-the-migration sources, measured (D-10 / D-16 / D-17):**

`connector_tokens` — `supabase/migrations/129_connector_oauth_tokens.sql:85-99` + `151_connector_tokens_rls_policy.sql:90-102`:

```sql
-- 129:85
REVOKE ALL ON TABLE public.connector_tokens FROM anon, authenticated;
-- 129:88 / 151:92 (identical 9-column list; 151 re-states it and says so)
GRANT SELECT (
    id, connection_id, account_email, account_name, token_type,
    scopes, expires_at, created_at, updated_at
) ON public.connector_tokens TO authenticated;
-- 151:90
REVOKE ALL ON TABLE public.connector_tokens FROM anon;
```

(9 columns — matches the CONTEXT's measured *"`connector_tokens` has exactly 9 SELECT column grants to `authenticated`"*.)

`connector_watches` / `connector_watch_items` / `connector_sync_runs` — `168:118-120`, `169:115-117`,
`172:132-134`, all the same three-line shape:

```sql
REVOKE ALL ON TABLE public.connector_watches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watches TO service_role;
```

`app_settings` / `user_settings` — `177_rls_app_settings_user_settings.sql:70-71, 79, 100`:

```sql
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.app_settings FROM authenticated;
REVOKE ALL ON public.user_settings FROM anon;
-- `authenticated` keeps the table-level grants it needs for the policies above to be reachable;
-- the policies are what constrain it to its own row. DELETE is deliberately NOT granted a policy
-- — a user does not delete their settings row, the service role does.
REVOKE DELETE ON public.user_settings FROM authenticated;
```

**The five columns D-17 adds** (each with its migration named inline, per D-10):
`auth_type`, `status`, `error_message` ← `129:101-105`; `auth_type`, `status` also at `150:58`;
`default_ingest_visibility` ← `156:31-33` (+ `INSERT`/`UPDATE`, and a service_role triple at `:35-37`);
`default_approval_posture` ← `128:106`.

⚠ **RE-DERIVE THE SET; the CONTEXT's "25 statements / 7 tables" does not reproduce.** Measured now:

```
grep -rn -E "^\s*(GRANT|REVOKE)\s+" supabase/migrations/ | grep -viE "EXECUTE ON FUNCTION"
→ 32 statement STARTS across 11 files: 118, 126, 127, 128, 129, 150, 151, 156, 168, 169, 172, 177
```

Seven distinct tables ✓ (`connector_connections`, `connector_tokens`, `connector_watches`,
`connector_watch_items`, `connector_sync_runs`, `app_settings`, `user_settings`), but the statement
count and the per-table counts in D-16's table differ from a naive line scan. `126`, `127`, `150` are
**absent from D-16's narrative entirely** and each carries a `connector_connections` column grant.
D-05 says *no exception list* — so the gate's expected set and the supplement must cover these too.

---

### 4. `supabase/full-schema.sql` — the ACL tail (generated artifact) — **MODIFIED**

#### ⭐ How the tail is ACTUALLY produced — measured, not read off a comment

`scripts/regenerate-full-schema.sh:137-151`:

```bash
echo "[4/4] Writing header + dump + cross-schema supplement to ${TARGET}..."
{
  cat "${HEADER}"
  echo
  cat "${TMP2}"
  echo
  echo "-- ============================================================"
  echo "-- CROSS-SCHEMA SUPPLEMENT (storage buckets/policies, auth trigger,"
  echo "-- realtime publication) — appended by regenerate-full-schema.sh from"
  echo "-- scripts/full-schema-supplement.sql. See that file for maintenance notes."
  echo "-- ============================================================"
  echo
  cat "${SUPPLEMENT}"
} > "${TARGET}"
```

And `:101-107` is where `--no-privileges` lives (CONTEXT says `:104`; the flag is on line **104**
inside the `docker exec … pg_dump` invocation starting at `:101`):

```bash
docker exec -i "${DB_CONTAINER}" pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  -U postgres \
  -d postgres > "${TMP}"
```

**Measured this session, and it is the mechanism D-11 depends on:**

```
grep -n "CROSS-SCHEMA SUPPLEMENT" supabase/full-schema.sql   → 7250
wc -l supabase/full-schema.sql scripts/full-schema-supplement.sql → 7687 / 433
tail -n 433 supabase/full-schema.sql | diff - scripts/full-schema-supplement.sql → IDENTICAL
```

⭐ **The last 433 lines of `supabase/full-schema.sql` are BYTE-IDENTICAL to the supplement.**
The "ACL tail" is not hand-authored dump content — it is a `cat`. So D-11's same-commit rule is
honoured mechanically: **replace the file's tail region (everything from line 7255 to EOF, i.e. the
last `wc -l supplement` lines) with the new supplement text, byte for byte, and re-assert the
`tail -n N | diff` identity in the same task.** That does **not** violate CLAUDE.md's *never
hand-edit `full-schema.sql`* rule, because nothing about the dump half changes.

⛔ **Re-running `bash scripts/regenerate-full-schema.sh` is NOT available to the agent and must not
be planned as the mechanism:** it requires `docker` (`:65-68` hard-exits without it) and the
`supabase` CLI (`:60-63`), and Docker is denied here. It would also re-dump the **live** schema,
dragging in unrelated local drift. The `cat`-equivalent tail replacement + the `diff` assertion is
the reproducible, reviewable path. Name it in the plan so an executor does not reach for the script.

⚠ Two sentences in the supplement's own headers become **stale** the moment §5 grows and must ship
corrected in the same edit: `:200-201` *"`grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql` -> 0,
measured 2026-08-09"* (the CONTEXT measured **65** today) and the `:28-34` MAINTENANCE `ACLs ->`
source list, which names only 118 and 181.

---

### 5. `scripts/check-schema-acl-parity.cjs` (gate, transform) — **MODIFIED**

**Self-analog for the seam; `scripts/check-seeds-register.cjs` for the house style of a `--self-test`
gate with fixtures.**

#### 5a. The `analyse()` / `report()` split that D-12 and D-07 land inside (`:176-223`)

```js
/** The pure analysis — one implementation, driven by BOTH the CLI and `--self-test`. */
function analyse({ migrationsDir, supplementPath, minFiles = MIN_MIGRATION_FILES }) {
  const { migrationCount, acls } = scanMigrations(migrationsDir, minFiles);
  const mirroredSet = scanSupplement(supplementPath);
  const expected = new Map();          // signature -> Set<file>
  for (const { signature, file } of acls) {
    if (!expected.has(signature)) expected.set(signature, new Set());
    expected.get(signature).add(file);
  }
  const missing = [...expected.keys()].filter((s) => !mirroredSet.has(s)).sort();
  const mirrored = [...expected.keys()].filter((s) => mirroredSet.has(s)).sort();
  return { migrationCount, expected, missing, mirrored, statementCount: acls.length };
}

/** Print the verdict and return the exit code. `log` is injectable so --self-test can read it. */
function report(result, log = console.log) { ... }
```

⭐ **`expected` is keyed on `signature` ALONE — that IS CR-02.** `aclsIn` (`:126-134`) throws away
`m[1]` (the verb) and `m[3]` (the grantee) entirely:

```js
function aclsIn(sql, file) {
  const out = [];
  for (const chunk of statements(sql)) {
    const m = ACL_RE.exec(chunk);
    if (!m) continue;
    out.push({ signature: normaliseSignature(m[2]), file });   // ⛔ m[1] and m[3] discarded
  }
  return out;
}
```

D-12's rewrite is: capture all three, split `m[3]` on `,` into one entry per grantee, key on
`verb|signature|grantee`. `normaliseSignature` (`:84-103`) already strips the trailing `FROM|TO`
clause, so it is unaffected — **keep it byte-unchanged and keep its three `--self-test` normaliser
arms** (`:296-301`), which are the only proof the argument list is identity.

#### 5b. The comment stripper CR-03 replaces (`:105-121`)

```js
/**
 * Strip SQL line comments, then split into statements.
 * ⛔ COMMENTS MUST GO FIRST. Migration 181's tail carries an entirely-commented VERIFY block ...
 */
function statements(sql) {
  const stripped = sql.split('\n').map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    }).join('\n');
  return stripped.split(';');
}
const ACL_RE = /^\s*(REVOKE|GRANT)\s+EXECUTE\s+ON\s+FUNCTION\s+([\s\S]+?)\s+(?:FROM|TO)\s+([\s\S]+)$/i;
```

**The live CR-03 case, verified this session** — `supabase/migrations/180_app_settings_self_hosted_endpoints.sql:29-33`:

```sql
COMMENT ON COLUMN app_settings.lmstudio_base_url IS
  'LM Studio OpenAI-compatible endpoint. INCLUDES /v1 -- stored and used verbatim (unlike ollama_base_url, which omits /v1 and has it appended at load).';
COMMENT ON COLUMN app_settings.custom_base_url IS
  'Generic OpenAI-compatible endpoint (vLLM / Unsloth / llama.cpp / any tunnel). Stored and used VERBATIM -- include /v1 yourself.';
```

Both `--` sit **inside a single-quoted literal**; `indexOf('--')` truncates mid-string, leaving an
unterminated literal whose closing `'` and `;` land on a later line, so `;`-splitting is wrong from
that point on. D-15's single-pass lexer must track `'` (with `''` escape), `"` and `$tag$`.

⚠ **Also note `ACL_RE`'s `^\s*` anchor.** It only matches when the statement chunk *begins* with the
verb. Today's migrations happen to put GRANT/REVOKE at line start, but the anchor combined with a
correct lexer is a real interaction — decide it explicitly, and pin the decision in a `--self-test`
arm rather than in prose. The TABLE regex (D-07) needs `[\s\S]+?` across newlines regardless: every
`GRANT SELECT (` block in the migrations is **multi-line**.

#### 5c. The non-vacuity floor the table half inherits for free (`:53-66`, `:142-163`)

```js
const MIN_MIGRATION_FILES = 120;
/** Phase 242 measured a sibling gate exiting 0 over ZERO parsed files, twice. */
class VacuousScanError extends Error {}

function scanMigrations(dir, minFiles) {
  let names;
  try { names = fs.readdirSync(dir); }
  catch (e) { throw new VacuousScanError(`cannot read the migrations directory ${dir} (${e.code || e.message})`); }
  const files = names.filter((n) => /^\d+_.*\.sql$/.test(n)).sort();
  const migrationCount = files.length;
  if (migrationCount < minFiles) {
    throw new VacuousScanError(
      `only ${migrationCount} migration file(s) matched in ${dir}, below the floor of ${minFiles} — `
      + 'refusing to report a verdict over a collapsed scan set. '
      + 'A gate that passes over nothing is worse than absent.');
  }
  ...
}
```

#### 5d. The `--self-test` fixture shape D-18 extends (`:238-351`)

```js
const FIXTURE_MIGRATION = `-- 999: fixture
BEGIN;
REVOKE EXECUTE ON FUNCTION public.alpha() FROM PUBLIC;
...
-- VERIFY (entirely commented — must NOT be counted):
--   REVOKE EXECUTE ON FUNCTION public.never_real() FROM PUBLIC;
`;
/** Same file with every `alpha` line removed — the planted omission. */
const FIXTURE_SUPPLEMENT_MISSING_ONE = FIXTURE_SUPPLEMENT_COMPLETE
  .split('\n').filter((l) => !l.includes('public.alpha')).join('\n');

function runSelfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acl-parity-selftest-'));
  assertOutsideWatchedTree(path.resolve(tmp));
  const results = [];
  const check = (name, ok, detail) => { results.push({name, ok, detail});
    console.log(`  ${ok ? `${GRN}PASS${RST}` : `${RED}FAIL${RST}`}  ${name}${detail ? `  — ${detail}` : ''}`); };
  try {
    // Pad to the REAL floor so the fixture exercises the shipped constant, not a stand-in.
    for (let i = 1; i <= MIN_MIGRATION_FILES; i += 1) { fs.writeFileSync(..., '-- pad\n'); }
    ...
    const redLines = []; const redRes = analyse({ migrationsDir: migDir, supplementPath: supMissing });
    const redCode = report(redRes, (l) => redLines.push(l));
    check('RED arm 1: a planted omission exits 1', redCode === 1, `exit=${redCode}`);
    check('RED arm 2 (COUNTERFACTUAL): a MIRRORED signature is ABSENT from the failure output',
      !redOut.includes('public.beta(uuid, text)') && !redOut.includes('public.gamma(uuid)'),
      'the gate does not print everything it knows');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
```

Two idioms worth naming for D-18's four arms: **pad to the REAL `MIN_MIGRATION_FILES`** so the shipped
constant is exercised, and **`assertOutsideWatchedTree`** (`:230-236`), which refuses to build a
fixture inside `frontend/`, `backend/` or the repo root.

#### 5e. D-14's target — the failure text that claims more than the code checks (`:212-221`)

```js
  log(`
⛔ pg_dump runs with --no-privileges, so supabase/full-schema.sql carries NO function ACL of its
   own. ...
   ⚠ REVOKE … FROM PUBLIC must precede REVOKE … FROM anon: anon inherits from PUBLIC, so the
     role-level revoke changes nothing while the PUBLIC grant stands (measured in migration 177).`);
```

D-13 puts ordering out of scope → these two lines must go or be re-worded as *"not checked here"*.
⚠ The **same claim is repeated in two more places** and the same-commit honesty applies:
`check-schema-acl-parity.cjs:26-28` (*"Ordering (PUBLIC before anon) is asserted by the plan's own
checks"*) and `full-schema-supplement.sql:284-286`.

#### 5f. House style for the gate's own head (`check-seeds-register.cjs:1-56`)

```js
#!/usr/bin/env node
'use strict';
/**
 * check-seeds-register.cjs — REG-02's teeth (Phase 251, D-03/D-04).
 * WHY THIS EXISTS ...
 * ⛔ And a sweep is only worth what its SCAN SET is worth. Phase 242 measured
 *    `check-hot-file-ledger.cjs` printing `subject: 0 files` and `ledger gate OK` in the same
 *    breath, over a CRLF plan it could not parse. ...
 * USAGE
 *   node scripts/check-seeds-register.cjs                       # full register scan
 *   node scripts/check-seeds-register.cjs --files a.md b.md     # per-file mode (no count floor)
 *   node scripts/check-seeds-register.cjs --self-test           # D-04's arms, temp fixture register
 * EXIT  0 = clear · 1 = violation · 2 = harness error
 * ZERO DEPENDENCIES, and that is a RULE rather than a preference. ...
 * ⚠ NEVER NORMALISE ON DISK. This gate only reads. 159 of 284 seeds contain CR ...
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */
const root = path.resolve(__dirname, '..');
```

⚠ **CRLF is a live hazard for any new SQL/text parser here.** `check-seeds-register.cjs:50-54` records
that `core.autocrlf=true` with no `.gitattributes` means a normalising rewrite changes every
working-tree line while producing **no `git diff`** — and MEMORY records `git checkout -- <dir>`
moving 224 body digests for exactly this reason. **Make the new lexer `\r?\n`-tolerant and never
rewrite.**

---

### 6. `docs/HOT-FILE-LEDGER.md` + the CLAUDE.md scan table (register) — **MODIFIED**

**Two tables, different column counts. Both get a row, in the same commit as the detail section.**

`docs/HOT-FILE-LEDGER.md` scan table — header at `:10364`, parsed by
`check-hot-file-ledger.cjs` (`SCAN_HEADER = '| File | commits / phases / lines | G-5 | Disposition |'`,
`MIN_SCAN_ROWS = 150`):

```markdown
| File | commits / phases / lines | G-5 | Disposition |
|---|---|---|---|
| [`frontend/src/lib/workspaceAllowedExt.ts`](docs/HOT-FILE-LEDGER.md#frontendsrclibworkspaceallowedextts) | 1 / 1 / 54 | no (new) | young (created 244-02). Row added AT CREATION, per the `settingsSearchPayload.ts` precedent — an absent row is invisible to G-5 at any count |
| [`frontend/src/pages/settingsSearchPayload.ts`](docs/HOT-FILE-LEDGER.md#frontendsrcpagessettingssearchpayloadts) | 2 / 2 / 116 | no (2 phases) | Created by 242. Row added AT CREATION rather than at the third phase — an absent row makes G-5 absent forever, silently, at any count |
```

The link anchor is the path with every non-alphanumeric stripped and lowercased. The CLAUDE.md
FIRING-shortlist table is **three** columns (`Hot file (FIRING) | commits / phases / lines | Verdict
(abridged)`) and only carries FIRING rows.

The matching detail section (`docs/HOT-FILE-LEDGER.md:11876-11898`):

```markdown
## `frontend/src/lib/workspaceAllowedExt.ts`

**`1 / 1 / 54`** — created by `244-02` T1. Row added **at creation**.

**The single frontend source of the attachment allow-list.** ...

**Its guard.** `src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts` imports `workspace.py` with
`?raw`, parses ... and then asserts **set equality** against this constant. ...

⛔ **Do not add an extension here to make a test pass.** The fence was falsified by deleting `.pdf`
from this file: three of its six cases went red ... and the file was restored **md5-identical**
(`5a63ea3e3adca51608f084de66ec8219`).
```

**The 200-char cap is machine-enforced** — `scripts/check-claude-md-size.cjs:62-64`
(`LEDGER_CELL_LIMIT = 200`), applied to CLAUDE.md **and** `LEDGER_FILES = [docs/HOT-FILE-LEDGER.md]`
(`:235`), with three failure codes: `[disposition-too-long]`, `[duplicate-row]`,
`[malformed-row] … expected 6 cells`. Run it after writing the rows:
`node scripts/check-claude-md-size.cjs`.

#### ⚠⚠ THE FINDING THAT MATTERS MOST FOR D-23 — the ledger gate is STRUCTURALLY BLIND to all three new rows

`scripts/check-hot-file-ledger.cjs:49-68`:

```js
const EXEMPT = [
  ..., /^\.planning\//, /^docs\//, /^supabase\/migrations\//,
  /^scripts\//,                                     // ⛔
  /^deploy\//,
  /\.(md|sql|json|ya?ml|txt|css|svg|png|jpg|webp)$/, // ⛔
];
const WATCHED = [/^backend\/app\//, /^frontend\/src\//];
```

All three files D-23 names — `scripts/full-schema-supplement.sql`,
`scripts/check-schema-acl-parity.cjs`, `scripts/check-greenfield-privileges.py` — are **`^scripts/`
AND (for two of them) an exempt extension**. The gate will never demand these rows, never validate
them, and `node scripts/check-hot-file-ledger.cjs 253` will exit `0` whether they are written or not.

⭐ **That does not make D-23 optional — it makes it MANUAL, and it should be planned as a task with
its own evidence rather than as "run the gate".** It also means CR-08's *"`full-schema-supplement.sql`
is 8/5, G-5 FIRING, no ledger row for its entire life"* has a **structural** cause, not a careless
one: the guardrail's `WATCHED` list is `backend/app` + `frontend/src` only, so no `scripts/` file
has ever been able to acquire a row through the gate. Say that in the ledger section; it is the same
class of finding as `App.tsx` at 23 phases, one directory over. (Whether to widen `EXEMPT`/`WATCHED`
is **out of this phase's fixed scope** — CR-01/02/03/08 only — and belongs in a seed.)

**Triple re-derivation recipe (CLAUDE.md, verbatim — use it, do not copy a cell forward):**

```bash
git log --oneline -- <file> | wc -l                                    # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l  # phases
wc -l <file>                                                           # lines
```

⚠ Six-digit buckets (`260814`, `260912`) are dated quick tasks, not phases — subtract them.

---

### 7. `.planning/seeds/SEED-266-*.md` `status_note` (register frontmatter) — **MODIFIED**

**Self-analog — the seed's own 2026-09-16 entry is the format the 253 entry copies:**

```yaml
---
seed_id: SEED-266
title: full-schema.sql carries no table ACLs and leaks `SET row_security = off` — ...
created: 2026-09-10
planted_during: Phase 241 (QUEUE-06), plan 241-04 — found by RUNNING the artifact, not by reading it
status: partially-answered
partial: true
status_note: |
  ── 2026-09-16 · ROUTED at `/gsd:discuss-phase 252` (REG-02 sweep). Status moved
  `planted` -> `partially-answered`, `partial: true`, because exactly ONE of this seed's two
  measured defects is answered and the other is untouched.

  ⭐ ANSWERED — the missing-ACL half, for FUNCTIONS only. ...

  ⛔ STILL OPEN, and deliberately so:
  (a) TABLE and COLUMN privileges. §6 covers function EXECUTE only. ...
  (b) `SET row_security = off`. Byte-unchanged by 252; ...
  (c) `--no-privileges` itself (arm 3). NOT revisited, and the reason is recorded in
      `252-01-PLAN.md`: ...
---
```

The 253 entry is a **new `── 2026-09-XX · …` block appended inside the same `status_note: |`**,
naming arm (a) as answered and leaving (b)/(c) stated. Per D-23/Folded-Seeds, `status:` stays
`partially-answered` and `partial: true` stays.

**Contract + enum (`.planning/seeds/TEMPLATE.md:6-8`, and its TRIPLE rule at `:57-62`):**

```
status: planted   # planted | dormant | open | partially-answered | answered | folded | shipped | closed | deferred | superseded-id
partial: false    # true when the status is settled on ONE AXIS ONLY
status_note:      # required when the status line carried prose — the displaced bytes live here, verbatim
```

Verify with `node scripts/check-seeds-register.cjs --files .planning/seeds/SEED-266-*.md`
(per-file mode, no count floor). ⚠ `--phase 253` needs PLAN.md files to exist first — the CONTEXT's
register-sweep note says the REG-02 sweep must be re-run at `/gsd:plan-phase 253` for that reason.

---

## Shared Patterns

### S-1. Repo gate skeleton (applies to: the Node gate edits, and the Python harness by analogy)

**Source:** `check-schema-acl-parity.cjs:40-71, 353-372` · `check-seeds-register.cjs:1-56` ·
`check-hot-file-ledger.cjs:1-70`

```js
const root = path.resolve(__dirname, '..');
function fail(msg) { console.error(`FATAL: ${msg}`); process.exit(2); }
// EXIT  0 = clear · 1 = violation · 2 = harness error
function main() {
  const argv = process.argv.slice(2);
  const unknown = argv.filter((a) => a !== '--self-test');
  if (unknown.length) fail(`unknown argument(s): ${unknown.join(' ')}. usage: ...`);
  if (argv.includes('--self-test')) return runSelfTest();
  return report(analyse({ migrationsDir: MIGRATIONS_DIR, supplementPath: SUPPLEMENT }));
}
module.exports = { normaliseSignature, aclsIn, analyse, report, MIN_MIGRATION_FILES };
if (require.main === module) {
  try { process.exit(main()); }
  catch (e) {
    // ⛔ An uncaught throw becomes exit 2 (harness error), never Node's default 1 (violation).
    fail(e && e.stack ? e.stack : String(e));
  }
}
```

⚠ The `require.main === module` guard + `module.exports` is **required** if anything is to import
`analyse` — `check-seeds-register.cjs:43-48` records that no other `check-*.cjs` exports anything and
why the departure was made deliberately.

### S-2. Derive the scan set from the filesystem; refuse a collapsed one

**Source:** `check-schema-acl-parity.cjs:142-157` (above) · `check-seeds-register.cjs:17-22`
**Apply to:** the Node gate's table half (inherits it free) **and** the new Python harness — D-05's
assertion set is derived by scanning `supabase/migrations/`, so it needs its own floor. Phase 242's
measured failure (`subject: 0 files` + `ledger gate OK` in one breath) is the reason.

### S-3. Falsify the reader before trusting it; drive the counterfactual too

**Source:** `test_211_closed_set_agreement.py:208-243` (extractor falsified on synthetic input BEFORE
the real file is read) · `check-schema-acl-parity.cjs:320-322` (`RED arm 2 (COUNTERFACTUAL): a
MIRRORED signature is ABSENT from the failure output`) ·
`docs/HOT-FILE-LEDGER.md:11896-11898` (falsified by deleting `.pdf`, restored **md5-identical**).
**Apply to:** every arm of D-18, the pytest of D-08, and D-19's requirement that the greenfield
harness be shown **red against the unfixed supplement** before the mirror lands.

⚠ **Restoring md5-identical is part of the pattern, and MEMORY records it going wrong here:**
`git checkout -- <dir>` is not a restore on this box (autocrlf moved 224 body digests while
`git status` read clean). Restore **explicit paths** and verify by hash.

### S-4. Copy from the migration; never retype

**Source:** `full-schema-supplement.sql:300-305` (*"COPIED from …181 lines 45-122, group comments and
order included — an argument list is part of a function's identity, so nothing here is retyped"*) ·
`:418` (*"Copied from the migrations named above, not retyped"*) · `check-schema-acl-parity.cjs:76-79`.
**Apply to:** every new §5 block (D-10), with the source migration + line range named **inline**, so
the gate's expected set and the mirrored set are literally the same characters.

### S-5. A local-only DB script is hard-coded to loopback and says why

**Source:** `apply_migration_178.py:18-23` · `build-recall-bench.py:80-100, 128-210`
**Apply to:** `check-greenfield-privileges.py`. ⛔ No env var, no `.env` read, no cloud-reachable
shape. `CLAUDE.md` § *Supabase MCP* makes any cloud write approval-gated per action.

### S-6. Same-commit sync rules this phase is bound by

| Pair | Enforced by |
|---|---|
| supplement ⇄ `full-schema.sql` tail (D-11) | nothing automated — assert `tail -n N \| diff` in the task |
| ledger row ⇄ `docs/HOT-FILE-LEDGER.md` section | `scripts/check-claude-md-size.cjs` (cell cap / dup / malformed only) |
| seed `status:` ⇄ TEMPLATE enum ⇄ `check-seeds-register.cjs` `STATUS_ENUM` | `TEMPLATE.md:57-62` — "change all three, or change none" |
| new env var / bundled service / sandbox tag | `scripts/check-deploy-drift.sh` (not triggered by this phase) |

---

## No Analog Found

**None — every file in this phase has a close analog.** The two entries below are *gaps in the
wiring*, not gaps in the pattern, and both are findings the planner should carry:

| Thing | Why it matters here |
|---|---|
| **`check-schema-acl-parity.cjs` is invoked by NOTHING.** Measured: no match in `.claude/hooks/`, `.claude/get-shit-done/workflows/`, `.github/workflows/` (5 workflows: backend-tests, claude-md-size, deploy-artifacts, frontend-tests, landing-drift), `package.json`, or `docs/`. | **D-07 says "one gate, one home, one hook entry" and D-18 says `--self-test` "already runs wherever the gate runs".** Neither is true today — the gate runs only when a human types it. Compare `hot-file-ledger-guard.js` + `claude-md-size-guard.js`, which are real PostToolUse hooks. This is *the* thing that decides whether the four new RED arms are a guard or a file. Either wire it (a hook entry or a CI job beside `claude-md-size.yml`) or say in writing that it is hand-run. |
| **No existing script skips-with-a-reason on an unreachable dependency.** `check-security-advisors.sh` exits **1** on missing config; every `check-*.cjs` uses `2` for harness error. | D-04 needs a third verdict. Recommend a distinct printed line + exit **2**, never exit 0. |

Two further corrections the planner should carry into the plans:

1. **`scripts/full-schema-supplement.sql` is ALREADY inside `supabase/full-schema.sql`** (last 433
   lines, byte-identical). The harness applying *"`full-schema.sql` + the supplement"* applies the
   supplement **twice**. Harmless — every statement in the file is idempotent by design
   (`:17-18`) — but the plan should say which it means, because *"apply both"* reads as *"the
   supplement is a separate artifact a greenfield operator must also paste"*, and it is not:
   `supabase/SETUP.md`'s one-paste story is `full-schema.sql` alone.
2. **The D-16 measurement does not reproduce from a naive scan.** Re-derived here: **32** GRANT/REVOKE
   statement starts (excluding `EXECUTE ON FUNCTION`) across **11** migration files —
   `118, 126, 127, 128, 129, 150, 151, 156, 168, 169, 172, 177`. Seven distinct tables ✓, but
   `126`, `127` and `150` are named nowhere in the CONTEXT and each carries a `connector_connections`
   column grant. D-05's *"no exception list"* means they are in scope.

---

## Metadata

**Analog search scope:** `scripts/` (81 entries), `backend/scripts/`, `backend/app/db/`,
`backend/tests/unit/` + `backend/tests/integration/`, `supabase/migrations/` (148 files),
`docs/`, `.claude/hooks/`, `.github/workflows/`, `.planning/seeds/`.
**Files read in full or in targeted ranges:** 18.
**Commands run (all read-only):** `ls`, `wc -l`, `sed -n`, `grep`, `diff` on a `/tmp` copy. No
database was contacted, no source file was modified, `supabase db push` / `db reset` were not run.
**Not available and not attempted:** `psql` (absent from PATH), `docker` (denied), the Supabase MCP
(not needed for a read of the repo). Queries the harness will need against the live cluster are
**written out** in §1e and §1h rather than executed.
**Pattern extraction date:** 2026-09-16
