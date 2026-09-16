#!/usr/bin/env python
"""Phase 253 (253-01 / CRED-03 / D-01..D-06) — does a database BORN FROM
``supabase/full-schema.sql`` carry the same TABLE and COLUMN privileges as one built by
replaying ``supabase/migrations/``?

This is measured against a REAL scratch database, **as the `authenticated` role**, not by
comparing text. ``pg_dump`` runs with ``--no-privileges`` (scripts/regenerate-full-schema.sh),
so the generated half of the artifact carries NO table ACL of its own: every REVOKE a
migration issues is absent from a greenfield bootstrap unless it is mirrored into
``scripts/full-schema-supplement.sql``. Absent, silently, and in the permissive direction.

⛔ MC-1 — THE HARNESS APPLIES ``supabase/full-schema.sql`` **ALONE**, and that is deliberate.
   The supplement is already the artifact's byte-identical TAIL: measured at plan time and
   re-asserted at run time by this script, ``tail -n $(wc -l < scripts/full-schema-supplement.sql)
   supabase/full-schema.sql`` and ``scripts/full-schema-supplement.sql`` both hash to
   ``6a58a47651156ef6dccdf75b93365e66``. ``supabase/SETUP.md``'s one-paste story is
   ``full-schema.sql`` alone, so a harness that applied "both" would measure a bootstrap no
   operator performs. Because the equality is asserted here before every run, this script is
   also a same-commit-rule checker (D-11) for free: if the supplement and the artifact's tail
   ever diverge, it exits 2 before touching a database.

⛔ SAFETY, which is half this script's point. It issues irreversible ``CREATE DATABASE`` and
   ``DROP DATABASE`` statements against a local Postgres cluster that ALSO holds the
   operator's live Supabase development data -- 159 documents and 7,953 chunks that no
   migration, no backup and no fixture can restore. ``assert_greenfield_target`` runs before
   every one of them, and the database name those statements interpolate is one THIS SCRIPT
   GENERATED (``os.getpid()`` + ``int(time.time())``), never one parsed from a flag. There is
   no ``--dsn`` flag and no environment variable is read (S-5): an env var is how a local-only
   script reaches cloud by accident, and both analogs
   (``scripts/apply_migration_178.py``, ``scripts/build-recall-bench.py``) rejected it by name.

⛔ ``supabase db reset`` / ``supabase db push`` are FORBIDDEN by CLAUDE.md and appear nowhere
   in this file. The scratch database exists precisely so neither is needed.

── THE THREE WAYS A PRIVILEGE HARNESS LIES, AND WHAT IS DONE ABOUT EACH ──────────────────

1. **No default privileges -> a FALSE GREEN (D-03).** ``pg_default_acl`` is PER-DATABASE, so a
   brand-new database has none of Supabase's stock
   ``GRANT ALL ON TABLES TO anon, authenticated, service_role``. Without them the tables the
   artifact creates carry NO grants at all, ``authenticated`` is refused everywhere for the
   WRONG reason, and SC#1 passes while proving nothing. So the preamble is DERIVED from the
   live cluster's own ``pg_default_acl`` (D-02), PRINTED into this script's evidence, and the
   run REFUSES to continue (exit 2) if that query returns zero rows.

2. **``row_security`` left OFF -> a refusal that is about the SESSION, not the privilege.**
   ``supabase/full-schema.sql:33`` is ``SET row_security = off``; ``pg_dump`` emits it and it
   is a SESSION setting, so it survives the apply and every later statement on that connection
   runs with RLS DISABLED. Re-enabled explicitly after the apply, and again with ``SET LOCAL``
   inside every read issued as ``authenticated``. (SEED-266 arm (b), in action.)

3. **``information_schema.column_privileges`` -> a false verdict that says nothing.** It
   returns only the grants the CONNECTING role can see, so it comes back EMPTY under a role
   that is neither grantor nor grantee. Repaired at D-242-05 in
   ``scripts/verify-v40-cloud-migrations.sql:70-92`` and refused here: every assertion is
   ``has_table_privilege`` / ``has_column_privilege``, with ``pg_class.relacl`` /
   ``pg_attribute.attacl`` printed as the corroborating half.

── THE ASSERTION SET IS DERIVED, WITH NO EXCEPTION LIST (D-05) ───────────────────────────
Every ``GRANT`` / ``REVOKE`` on a TABLE or COLUMN in ``supabase/migrations/`` is parsed and
REPLAYED, in ascending migration-number then line order, onto a model seeded with the stock
default privileges. **LAST STATEMENT WINS** -- that is the rule, written down here so a
reviewer can audit it rather than infer it, and it is the same rule Postgres itself applies
when a later migration re-grants what an earlier one revoked. The resulting expectation table
is PRINTED. The statement count and the file list are re-derived at run time and printed too:
MC-2 measured that the CONTEXT's "7 tables / 25 statements" does not reproduce, so this script
reports the number it read and never a constant.

Exit codes (D-04):
    0  clear           -- the greenfield artifact carries the migrations' privilege posture
    1  violation       -- at least one privilege differs
    2  harness error   -- including a SKIP. ⛔ A SKIP IS A THIRD VERDICT AND IS NOT EXIT 0.
                          Exit 0 on an unreachable database re-creates exactly the vacuous
                          pass this project has now measured three times.

Usage
-----
    backend/venv/Scripts/python scripts/check-greenfield-privileges.py

    backend/venv/Scripts/python scripts/check-greenfield-privileges.py --self-test-skip
        Drives the unreachable-database SKIP path against a hardcoded dead port so the third
        verdict can be SEEN rather than assumed (D-19). It parses no value, reaches no
        database and can create or drop nothing.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import pathlib
import re
import sys
import time
import urllib.parse

# ── paths, all derived from this file's own location ──────────────────────────
# scripts/<this file>  ->  parents[1] == repo root. If this file is moved, fix the arithmetic
# here rather than deleting the assertions below.
REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
FULL_SCHEMA = REPO_ROOT / "supabase" / "full-schema.sql"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"

# ── the ONE safe target ───────────────────────────────────────────────────────

LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})
_ACCEPTED_SCHEMES = frozenset({"postgres", "postgresql"})

#: The local Supabase Postgres port. Deliberately ONE value rather than a range.
#:
#: ⚠ SAY WHAT THIS DOES NOT DO. A port cannot prove a cluster is local -- an SSH tunnel bound
#:   to 54322 forwards a remote cluster onto loopback and passes every check in this file.
#:   What it removes is every port the operator never meant to use (WR-01).
ALLOWED_PORTS = frozenset({54322})

#: ⛔ THE ANCHORS ARE LOAD-BEARING. ``assert_bench_target`` (build-recall-bench.py:202-207)
#:   compares the database name with ``==`` against a single constant, and says in its own
#:   message that equality is what makes ``recall_bench_prod`` refusable. D-06 requires a
#:   UNIQUE-PER-RUN name, so equality is not available here -- and an UNANCHORED pattern would
#:   accept ``greenfield_acl_1_1_prod``, which is somebody's database. ``^``/``$`` plus
#:   ``fullmatch`` is what restores the property equality used to provide. Task 2 RED arm 3
#:   drives exactly that string and asserts it is refused.
GREENFIELD_DB_PATTERN = re.compile(r"^greenfield_acl_[0-9]{1,10}_[0-9]{1,14}$")

#: The maintenance connection: the same local server, ``postgres`` database -- the only place
#: a database can be created or dropped. Hardcoded to loopback, like
#: ``scripts/apply_migration_178.py:34``, and for the recorded reason: this script cannot
#: reach cloud even by accident.
MAINTENANCE_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

#: Drives the SKIP verdict. Nothing listens here; the constant is in this file, not in a flag.
_DEAD_PORT_DSN = "postgresql://postgres:postgres@127.0.0.1:54399/postgres"

#: Non-vacuity floor for the migration scan. A FLOOR, never an exact figure -- the gate must
#: survive new migrations but not a collapsed scan set. ⚠ MEASURED, NOT ASSUMED:
#: ``ls supabase/migrations | grep -cE '^[0-9]+_.*\.sql$'`` = 148 at 2026-09-16. Same value
#: and same reasoning as ``scripts/check-schema-acl-parity.cjs:63``; Phase 242 measured a
#: sibling gate printing ``subject: 0 files`` and ``ledger gate OK`` in one breath (S-2).
MIN_MIGRATION_FILES = 120

EXIT_CLEAR = 0
EXIT_VIOLATION = 1
EXIT_HARNESS = 2

#: The three PostgREST-reachable roles. ``postgres`` is the owner and is never asserted about.
ROLES = ("anon", "authenticated", "service_role")

#: Privileges ``has_table_privilege`` accepts and that a migration in this repo can name.
#: ⚠ ``MAINTAIN`` (PG17) is deliberately NOT asserted: it is not grantable per column and no
#:   migration here names it, so including it would add noise, not coverage.
TABLE_PRIVILEGES = ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER")

#: The four privileges Postgres allows at COLUMN granularity.
COLUMN_PRIVILEGES = ("SELECT", "INSERT", "UPDATE", "REFERENCES")

#: ``aclitem`` privilege letters -> names, for rendering ``pg_default_acl`` back into DDL.
_ACL_LETTERS = {
    "r": "SELECT",
    "w": "UPDATE",
    "a": "INSERT",
    "d": "DELETE",
    "D": "TRUNCATE",
    "x": "REFERENCES",
    "t": "TRIGGER",
    "X": "EXECUTE",
    "U": "USAGE",
    "C": "CREATE",
    "c": "CONNECT",
    "T": "TEMPORARY",
    "m": "MAINTAIN",
}

_DEFACL_OBJTYPE = {"r": "TABLES", "S": "SEQUENCES", "f": "FUNCTIONS", "T": "TYPES"}


class GreenfieldTargetRefused(RuntimeError):
    """The requested target is not a generated, loopback ``greenfield_acl_*`` database."""


class VacuousScanError(RuntimeError):
    """The scan set collapsed; a verdict over it would be worse than absent."""


class HarnessError(RuntimeError):
    """The harness could not measure. Never reported as a pass."""


class SkipVerdict(RuntimeError):
    """No database to measure. A THIRD verdict -- printed, and exit 2, never exit 0."""


# ── the target guard (D-06) ───────────────────────────────────────────────────


def assert_greenfield_target(dsn: str) -> None:
    """Refuse anything that is not a generated throwaway greenfield database on this machine.

    Copied wholesale from ``build-recall-bench.py``'s ``assert_bench_target`` (which is itself
    fenced RED by ``backend/tests/unit/test_241_bench_safety.py``), with ONE departure: the
    database-name arm is an ANCHORED regex over a generated-name grammar rather than ``==``
    against a constant, because D-06 requires a unique name per run. See
    ``GREENFIELD_DB_PATTERN``.

    ⛔ WR-01 -- WHY THIS FUNCTION REFUSES SHAPES RATHER THAN INSPECTING THEM. ``urllib.parse``
    and ``asyncpg`` do not agree about what a DSN means. Measured against asyncpg 0.31.0,
    ``postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/x`` reports
    ``hostname == 'localhost'`` to urlparse while asyncpg FAILS OVER to
    ``prod.example.com:5432``. A guard whose job is to be STRUCTURALLY INCAPABLE of reaching a
    non-local database must refuse every DSN shape it cannot reason about.

    Raises ``GreenfieldTargetRefused`` naming the offending host or database.
    """
    parsed = urllib.parse.urlparse(dsn)

    if parsed.scheme.lower() not in _ACCEPTED_SCHEMES:
        raise GreenfieldTargetRefused(
            f"refusing target {dsn!r}: scheme {parsed.scheme!r} is not a postgres URL "
            "(a keyword or unix-socket DSN cannot be proven loopback)"
        )

    # ⛔ THE HOST LIST ARM, AND IT MUST RUN FIRST. `urlparse(...).port` RAISES ValueError on a
    #    multi-host netloc ("Port could not be cast to integer value as
    #    '54322,prod.example.com:5432'"), so no later arm may read `.port` before this one has
    #    refused. `rpartition("@")` splits on the LAST `@`, the userinfo separator.
    hostspec = parsed.netloc.rpartition("@")[2]
    if "," in hostspec:
        raise GreenfieldTargetRefused(
            f"refusing target {dsn!r}: {hostspec!r} is a comma-separated host LIST, which "
            "cannot be proven loopback -- asyncpg fails over to the later hosts and "
            "urlparse().hostname never reports them. Name exactly one loopback host."
        )

    # ⛔ THE QUERY-STRING ARM. A keyword this guard does not model is exactly a shape it cannot
    #    reason about. Nothing legitimate needs one here.
    if parsed.query:
        raise GreenfieldTargetRefused(
            f"refusing target {dsn!r}: query parameters ({parsed.query!r}) can carry "
            "host= / hostaddr= / port= / dbname= overrides that redirect the connection past "
            "this guard. Drop the query string."
        )

    host = parsed.hostname
    if not host:
        raise GreenfieldTargetRefused(
            f"refusing target {dsn!r}: no host in the DSN, so it cannot be proven loopback "
            f"(allowed: {sorted(LOOPBACK_HOSTS)})"
        )
    if host.lower() not in LOOPBACK_HOSTS:
        raise GreenfieldTargetRefused(
            f"refusing host {host!r}: the greenfield scratch database is LOCAL-ONLY and this "
            f"host is not loopback (allowed: {sorted(LOOPBACK_HOSTS)}). The right database "
            "name on the wrong cluster is still the wrong cluster."
        )

    try:
        port = parsed.port
    except ValueError as exc:
        raise GreenfieldTargetRefused(
            f"refusing target {dsn!r}: the port could not be parsed ({exc})"
        ) from exc
    if port not in ALLOWED_PORTS:
        raise GreenfieldTargetRefused(
            f"refusing port {port!r}: the greenfield scratch database is built only on the "
            f"local Supabase Postgres (allowed: {sorted(ALLOWED_PORTS)}). A DSN with no port "
            "means libpq's 5432, which is not where local Supabase listens. Loopback alone is "
            "not enough: an SSH tunnel on another port forwards a remote cluster onto 127.0.0.1."
        )

    database = parsed.path.lstrip("/")
    if "/" in database:
        raise GreenfieldTargetRefused(
            f"refusing target {dsn!r}: the path {parsed.path!r} does not name exactly one database"
        )
    if GREENFIELD_DB_PATTERN.fullmatch(database) is None:
        raise GreenfieldTargetRefused(
            f"refusing database {database!r}: only a database this script GENERATED may be "
            f"created or dropped, and the grammar is anchored "
            f"({GREENFIELD_DB_PATTERN.pattern!r}, matched with fullmatch). The anchors are "
            "load-bearing: an unanchored pattern would accept 'greenfield_acl_1_1_prod', and "
            "the operator's live 'postgres' database is refused by the same arm."
        )


def generate_db_name() -> str:
    """A name unique to THIS process and THIS second, matching the anchored grammar.

    ⛔ The ``CREATE`` / ``DROP`` statements may only ever interpolate a value produced here.
    Nothing is parsed from a flag, an environment variable or a file.
    """
    return f"greenfield_acl_{os.getpid()}_{int(time.time())}"


def scratch_dsn(db_name: str) -> str:
    """The maintenance DSN with its database swapped for the generated scratch name."""
    parsed = urllib.parse.urlparse(MAINTENANCE_DSN)
    return urllib.parse.urlunparse(parsed._replace(path=f"/{db_name}"))


# ── the documented deltas from production (carried from build-recall-bench.py) ─

# ⛔⛔ REFUSAL COMMENT -- do not lift the `auth` block below without this paragraph.
#
# The hand-rolled `auth.uid()` stub exists ONLY inside this throwaway scratch database; it must
# never be copied into `supabase/migrations/` nor into `full-schema.sql`, because production's
# `auth.uid()` is Supabase Auth's own and a hand-rolled one would be an authentication bypass
# on the 156 call sites that ask it who the caller is. It is created here, at run time, by a
# throwaway harness, precisely so that it can never reach a deploy artifact. (T-253-08.)
#
# The `storage` and publication blocks are NOT security-bearing: nothing measured here reads
# them. They exist because full-schema.sql's cross-schema supplement WRITES INTO objects a
# fresh database does not have, and a partial apply would poison every verdict downstream.
#
# ⚠ The default-privilege block that used to live at the end of build-recall-bench.py's
#   PRELUDE_SQL is deliberately NOT here: D-02 requires it to be DERIVED from the live
#   cluster's own `pg_default_acl` rather than typed. See `derive_default_privilege_preamble`.
PRELUDE_SQL = """
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(
           current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
           ''
         )::uuid;
$$;

CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    public boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1 : array_length(_parts, 1) - 1];
END
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- ⚠ MEASURED, not assumed (241-02 Task 3). Without these grants the database builds perfectly
-- and then answers `42501 permission denied for schema auth` on the FIRST query issued as
-- `authenticated` -- because RLS policy expressions evaluate `auth.uid()` as the CALLING role.
-- Real Supabase ships these grants on its own `auth` schema; a stub that omits them is not
-- faithful, and an unfaithful stub produces a refusal that is about the stub.
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT ON storage.buckets, storage.objects TO authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
"""

# full-schema.sql installs `on_auth_user_created`. Nothing here inserts an auth.users row, so
# this drop is privilege-NEUTRAL -- it is carried from the analog so that no later arm can
# provision an organisation as a side effect of a probe. Dropped AFTER the apply, never before:
# the apply must still exercise it.
DROP_SIGNUP_TRIGGER_SQL = "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users"


# ── driver plumbing ───────────────────────────────────────────────────────────


def _require_asyncpg():
    try:
        import asyncpg  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - environment, not logic
        raise HarnessError(
            "asyncpg is required and is already a backend dependency; run this with "
            "backend/venv/Scripts/python"
        ) from exc
    return asyncpg


async def connect_or_skip(dsn: str):
    """Connect, or raise ``SkipVerdict`` naming the reason and the remedy.

    ⛔ A SKIP IS A THIRD VERDICT. The caller prints it and exits **2**. Exit 0 on an
    unreachable database is the vacuous pass this project has measured three times.
    """
    asyncpg = _require_asyncpg()
    try:
        return await asyncpg.connect(dsn, timeout=10)
    except (OSError, asyncio.TimeoutError) as exc:
        parsed = urllib.parse.urlparse(dsn)
        raise SkipVerdict(
            f"greenfield privileges SKIPPED -- no Postgres on {parsed.hostname}:{parsed.port} "
            f"({type(exc).__name__}: {exc}); start it with scripts/start-local-infra.ps1"
        ) from exc


def _line_of_offset(text: str, offset: int) -> int:
    return text.count("\n", 0, max(offset - 1, 0)) + 1


def _md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def _tail_lines(data: bytes, n: int) -> bytes:
    """The last ``n`` lines, exactly as ``tail -n n`` would slice them."""
    lines = data.splitlines(keepends=True)
    return b"".join(lines[-n:])


def assert_supplement_is_the_artifact_tail() -> tuple[str, int]:
    """MC-1 / D-11 -- the supplement IS ``full-schema.sql``'s tail, byte for byte.

    Asserted BEFORE any database is touched, so this script doubles as the same-commit-rule
    checker for a pairing nothing else automates (S-6). Returns ``(md5, line_count)``.
    """
    if not SUPPLEMENT.exists():
        raise HarnessError(f"{SUPPLEMENT} does not exist")
    if not FULL_SCHEMA.exists():
        raise HarnessError(f"{FULL_SCHEMA} does not exist")
    supplement = SUPPLEMENT.read_bytes()
    artifact = FULL_SCHEMA.read_bytes()
    n_lines = len(supplement.splitlines())
    tail = _tail_lines(artifact, n_lines)
    if _md5(tail) != _md5(supplement):
        raise HarnessError(
            "SAME-COMMIT RULE BROKEN (D-11 / MC-1): the last "
            f"{n_lines} lines of supabase/full-schema.sql hash to {_md5(tail)} while "
            f"scripts/full-schema-supplement.sql hashes to {_md5(supplement)}. The tail is "
            "produced by a plain `cat \"${SUPPLEMENT}\"` at "
            "scripts/regenerate-full-schema.sh:137-151, so these two must be identical. "
            "Apply the SAME text to both, in the SAME commit."
        )
    return _md5(supplement), n_lines


# ── the DERIVED default-privilege preamble (D-02, D-03) ───────────────────────


def _render_default_privileges(rows) -> tuple[list[str], list[str]]:
    """Render ``pg_default_acl`` rows back into ``ALTER DEFAULT PRIVILEGES`` statements.

    Returns ``(statements, notes)``. Nothing is typed: the privilege SETS, the object types
    and the grantee roles all come from the live cluster's catalog.

    ⚠ ``defaclrole`` (the OWNER) is reported in a note rather than replayed with ``FOR ROLE``.
      A default-privilege row only fires for objects created BY ITS OWN ROLE, and every object
      in the scratch database is created by the connecting superuser ``postgres``. Replaying a
      ``supabase_admin`` row verbatim would apply to objects nothing here creates -- it would
      be faithful text and an inert grant, which is the most expensive kind of false green.
      So the row's privilege set is replayed for the CREATING role, and the source owner is
      printed beside it so the substitution is auditable rather than silent.
    """
    statements: list[str] = []
    notes: list[str] = []
    # (objtype, frozenset(privs)) -> sorted role list
    grouped: dict[tuple[str, frozenset[str]], set[str]] = {}
    for row in rows:
        objtype_raw = row["defaclobjtype"]
        objtype = objtype_raw.decode() if isinstance(objtype_raw, (bytes, bytearray)) else str(objtype_raw)
        obj = _DEFACL_OBJTYPE.get(objtype)
        owner = row["owner"]
        acl = row["defaclacl"] or []
        if obj is None:
            notes.append(f"  [not-replayed] owner={owner} objtype={objtype!r}: unknown default-ACL object type")
            continue
        for item in acl:
            text = str(item)
            grantee, _, rest = text.partition("=")
            letters = rest.split("/", 1)[0]
            grantee = grantee.strip() or "PUBLIC"
            if grantee == "postgres":
                # The owner of every object here; it needs no replayed grant.
                continue
            privs = set()
            for ch in letters:
                name = _ACL_LETTERS.get(ch)
                if name is None:
                    notes.append(f"  [not-replayed] owner={owner} {grantee}: unknown ACL letter {ch!r} in {text!r}")
                    continue
                privs.add(name)
            if not privs:
                notes.append(f"  [not-replayed] owner={owner} {grantee}: no recognisable privilege in {text!r}")
                continue
            grouped.setdefault((obj, frozenset(privs)), set()).add(grantee)
            notes.append(f"  source row: owner={owner} objtype={obj} acl={text}")

    for (obj, privs), roles in sorted(grouped.items(), key=lambda kv: (kv[0][0], sorted(kv[0][1]))):
        statements.append(
            f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
            f"GRANT {', '.join(sorted(privs))} ON {obj} TO {', '.join(sorted(roles))};"
        )
    return statements, notes


async def derive_default_privilege_preamble(maintenance_conn, log) -> list[str]:
    """Read ``pg_default_acl`` from the live cluster and render it back into DDL (D-02).

    ⛔ D-03 -- A HARNESS THAT OMITS THIS PREAMBLE IS A FALSE GREEN. ``pg_default_acl`` is
    PER-DATABASE, so a brand-new database has none of Supabase's stock
    ``GRANT ALL ON TABLES TO anon, authenticated, service_role``. Without it the tables the
    artifact creates carry no grants at all, ``authenticated`` is refused EVERYWHERE for the
    wrong reason, and SC#1 passes while proving nothing about ``connector_tokens``. The run
    REFUSES to continue (exit 2) when the query returns zero rows, for the same reason.
    """
    rows = await maintenance_conn.fetch(
        """
        SELECT pg_get_userbyid(d.defaclrole) AS owner, n.nspname, d.defaclobjtype, d.defaclacl
        FROM pg_default_acl d
        JOIN pg_namespace n ON n.oid = d.defaclnamespace
        WHERE n.nspname = 'public';
        """
    )
    if not rows:
        raise HarnessError(
            "pg_default_acl returned ZERO rows for schema public on the live cluster. D-03: "
            "without the stock default privileges the scratch database's tables carry no "
            "grants at all, `authenticated` is refused for the WRONG reason, and SC#1 would "
            "pass while proving nothing. Refusing to report a verdict."
        )

    owners = sorted({row["owner"] for row in rows})
    statements, notes = _render_default_privileges(rows)

    log("derived default-privilege preamble (pg_default_acl):")
    log(f"  pg_default_acl rows read: {len(rows)} · distinct defaclrole owners: {len(owners)} ({', '.join(owners)})")
    for note in notes:
        log(note)
    for stmt in statements:
        log(f"  RENDERED  {stmt}")
    if not statements:
        raise HarnessError(
            "pg_default_acl returned rows but none rendered into an ALTER DEFAULT PRIVILEGES "
            "statement -- see the [not-replayed] notes above. D-03 refuses this run."
        )
    return statements


# ── the derived assertion set (D-05, no exception list) ───────────────────────


def _strip_sql_comments(sql: str) -> str:
    """⛔ COMMENTS MUST GO FIRST.

    Migration tails carry entirely-commented VERIFY blocks that quote GRANT statements;
    counting those would inflate the expected set and make this gate fail against a CORRECT
    artifact -- and a false red is how a guard gets switched off.
    """
    out = []
    for line in sql.split("\n"):
        i = line.find("--")
        out.append(line if i == -1 else line[:i])
    return "\n".join(out)


def _split_top_level(text: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    cur: list[str] = []
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    return [p.strip() for p in parts if p.strip()]


#: Matches a table/column GRANT or REVOKE across newlines. ``privs`` is non-greedy so it stops
#: at the FIRST ``ON``; a column list never contains the token.
_ACL_RE = re.compile(
    r"^\s*(?P<verb>GRANT|REVOKE)\s+(?P<privs>.+?)\s+ON\s+(?:TABLE\s+)?"
    r"(?P<table>[A-Za-z0-9_.\"]+)\s+(?:TO|FROM)\s+(?P<roles>.+)$",
    re.IGNORECASE | re.DOTALL,
)

#: Shapes this parser is NOT about. ``EXECUTE ON FUNCTION`` belongs to
#: ``scripts/check-schema-acl-parity.cjs`` (the function half, Phase 252); the rest cannot be
#: modelled as a table ACL.
_NOT_A_TABLE_ACL = re.compile(r"\bON\s+(FUNCTION|SCHEMA|SEQUENCE|DATABASE|LANGUAGE|TYPE|ROUTINE)\b", re.IGNORECASE)

_PRIV_RE = re.compile(r"^(?P<name>[A-Za-z ]+?)\s*(?:\((?P<cols>[^)]*)\))?$", re.DOTALL)


def _parse_statement(chunk: str):
    """``(verb, [(privilege, columns|None)], table, [roles])`` or ``None``."""
    if _NOT_A_TABLE_ACL.search(chunk):
        return None
    m = _ACL_RE.match(chunk)
    if not m:
        return None
    verb = m.group("verb").upper()
    table = m.group("table").replace('"', "").lower()
    if "." not in table:
        table = f"public.{table}"

    privs: list[tuple[str, tuple[str, ...] | None]] = []
    for item in _split_top_level(m.group("privs")):
        pm = _PRIV_RE.match(item.strip())
        if not pm:
            return None
        name = " ".join(pm.group("name").split()).upper()
        if name == "ALL PRIVILEGES":
            name = "ALL"
        cols_raw = pm.group("cols")
        cols = tuple(c.strip().lower() for c in cols_raw.split(",") if c.strip()) if cols_raw else None
        privs.append((name, cols))

    roles = [r.strip().rstrip(";").strip().lower() for r in m.group("roles").split(",")]
    roles = [r for r in roles if r]
    return verb, privs, table, roles


class PrivilegeModel:
    """Replay of every table/column ACL statement, seeded with the stock default privileges.

    ⛔ THE RULE IS **LAST STATEMENT WINS**, in ascending migration-number then line order --
    written down here so a reviewer can audit it rather than infer it. It is the same rule
    Postgres applies when a later migration re-grants what an earlier one revoked, which is
    exactly what migrations 150 and 156 do to 118's column-by-column re-grant.
    """

    def __init__(self) -> None:
        self.table: dict[tuple[str, str], set[str]] = {}
        self.column: dict[tuple[str, str, str], set[str]] = {}
        self.tables: set[str] = set()
        self.provenance: list[str] = []

    def _seed(self, role: str, table: str) -> set[str]:
        key = (role, table)
        if key not in self.table:
            # Supabase's stock `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
            # authenticated, service_role` is what every table starts with. Seeded lazily so
            # only tables a migration actually names are asserted about.
            self.table[key] = set(TABLE_PRIVILEGES)
        return self.table[key]

    def apply(self, verb, privs, table, roles, where: str) -> None:
        self.tables.add(table)
        for role in roles:
            if role not in ROLES:
                continue
            tbl = self._seed(role, table)
            for name, cols in privs:
                names = set(TABLE_PRIVILEGES) if name == "ALL" else {name}
                if verb == "REVOKE":
                    if cols is None:
                        tbl -= names
                        for key in list(self.column):
                            if key[0] == role and key[1] == table:
                                self.column[key] -= names
                    else:
                        for col in cols:
                            self.column.setdefault((role, table, col), set())
                            self.column[(role, table, col)] -= names
                else:
                    if cols is None:
                        tbl |= names
                    else:
                        for col in cols:
                            self.column.setdefault((role, table, col), set()).update(names)
            rendered = "; ".join(
                name if cols is None else f"{name}({', '.join(cols)})" for name, cols in privs
            )
            direction = "TO" if verb == "GRANT" else "FROM"
            self.provenance.append(f"    {where}: {verb} {rendered} ON {table} {direction} {role}")

    def table_expectation(self, role: str, table: str, priv: str) -> bool:
        return priv in self.table.get((role, table), set())

    def column_expectation(self, role: str, table: str, column: str, priv: str) -> bool:
        if priv in self.table.get((role, table), set()):
            return True
        return priv in self.column.get((role, table, column), set())


def derive_expectations(migrations_dir: pathlib.Path = MIGRATIONS_DIR, min_files: int = MIN_MIGRATION_FILES):
    """Scan every migration, parse every table/column ACL, replay them into a model.

    ⛔ NO EXCEPTION LIST (D-05). An exception list is a thing that rots; a complete statement
    of the posture is not.

    Returns ``(model, files_scanned, statement_count, per_file_counts)``.
    Raises ``VacuousScanError`` below the non-vacuity floor.
    """
    try:
        names = os.listdir(migrations_dir)
    except OSError as exc:
        raise VacuousScanError(f"cannot read the migrations directory {migrations_dir} ({exc})") from exc

    files = sorted(
        (n for n in names if re.match(r"^\d+_.*\.sql$", n)),
        key=lambda n: (int(re.match(r"^(\d+)", n).group(1)), n),
    )
    if len(files) < min_files:
        raise VacuousScanError(
            f"only {len(files)} migration file(s) matched in {migrations_dir}, below the floor "
            f"of {min_files} -- refusing to report a verdict over a collapsed scan set. "
            "A gate that passes over nothing is worse than absent."
        )

    model = PrivilegeModel()
    per_file: dict[str, int] = {}
    total = 0
    for name in files:
        sql = _strip_sql_comments((migrations_dir / name).read_text(encoding="utf-8", errors="replace"))
        # Statement order inside a file follows its own text order, which is line order.
        for chunk in sql.split(";"):
            parsed = _parse_statement(chunk)
            if parsed is None:
                continue
            verb, privs, table, roles = parsed
            model.apply(verb, privs, table, roles, where=f"migrations/{name}")
            per_file[name] = per_file.get(name, 0) + 1
            total += 1
    return model, files, total, per_file


# ── applying the artifact ─────────────────────────────────────────────────────


async def apply_artifact(conn, preamble: list[str]) -> None:
    asyncpg = _require_asyncpg()
    await conn.execute(PRELUDE_SQL)
    for stmt in preamble:
        await conn.execute(stmt)

    sql = FULL_SCHEMA.read_text(encoding="utf-8")
    try:
        await conn.execute(sql)
    except asyncpg.PostgresError as exc:
        position = getattr(exc, "position", None)
        where = ""
        if position:
            line = _line_of_offset(sql, int(position))
            where = f" at {FULL_SCHEMA.name}:{line}: {sql.splitlines()[line - 1].strip()!r}"
        raise HarnessError(
            f"full-schema.sql failed to apply{where} -- {type(exc).__name__}: {exc}"
        ) from exc
    await conn.execute(DROP_SIGNUP_TRIGGER_SQL)

    # ⛔ NOT OPTIONAL. `supabase/full-schema.sql:33` is `SET row_security = off;` -- pg_dump
    #    emits it and it is a SESSION setting, so it survives the apply and every later
    #    statement this connection issues would run with RLS DISABLED. A refusal read under
    #    that session is about the SESSION, not about the privilege, and reading it as a grant
    #    failure sends the next reader to the wrong fix. SEED-266 arm (b).
    await conn.execute("SET row_security = on")


# ── measuring, as `authenticated` ─────────────────────────────────────────────


async def _columns_of(conn, table: str) -> list[str]:
    schema, _, relname = table.partition(".")
    rows = await conn.fetch(
        """
        SELECT a.attname
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        """,
        schema,
        relname,
    )
    return [r["attname"] for r in rows]


async def assert_derived_set(conn, model: PrivilegeModel, log) -> list[str]:
    """Measure every derived expectation with ``has_table_privilege`` / ``has_column_privilege``.

    ⛔ NEVER ``information_schema.column_privileges``: it returns only the grants the CONNECTING
    role can see, so under a role that is neither grantor nor grantee it comes back EMPTY --
    a false verdict that says nothing about the database (repaired at D-242-05 in
    ``scripts/verify-v40-cloud-migrations.sql:70-92``). The catalog half below reads
    ``pg_class.relacl`` / ``pg_attribute.attacl``, which are the real ACLs.
    """
    violations: list[str] = []

    t_roles: list[str] = []
    t_tables: list[str] = []
    t_privs: list[str] = []
    expected_table: list[bool] = []
    c_roles: list[str] = []
    c_tables: list[str] = []
    c_cols: list[str] = []
    c_privs: list[str] = []
    expected_col: list[bool] = []

    log("")
    log("derived expectation table (last statement wins; no exception list):")
    for table in sorted(model.tables):
        columns = await _columns_of(conn, table)
        if not columns:
            violations.append(
                f"[missing-table] {table} is named by a migration ACL but does not exist in a "
                "database bootstrapped from supabase/full-schema.sql"
            )
            continue
        for role in ROLES:
            if (role, table) not in model.table:
                continue
            tbl_privs = sorted(model.table[(role, table)])
            granted_cols = sorted(
                f"{col}:{'/'.join(sorted(p))}"
                for (r, t, col), p in model.column.items()
                if r == role and t == table and p
            )
            log(f"  {table:42s} {role:14s} table={tbl_privs or '[]'}")
            if granted_cols:
                log(f"  {'':42s} {'':14s} column={granted_cols}")
            for priv in TABLE_PRIVILEGES:
                t_roles.append(role)
                t_tables.append(table)
                t_privs.append(priv)
                expected_table.append(model.table_expectation(role, table, priv))
            for col in columns:
                for priv in COLUMN_PRIVILEGES:
                    c_roles.append(role)
                    c_tables.append(table)
                    c_cols.append(col)
                    c_privs.append(priv)
                    expected_col.append(model.column_expectation(role, table, col, priv))

    measured_table = await conn.fetch(
        """
        SELECT x.r, x.t, x.p, has_table_privilege(x.r, x.t, x.p) AS ok
        FROM unnest($1::text[], $2::text[], $3::text[]) AS x(r, t, p)
        """,
        t_roles,
        t_tables,
        t_privs,
    )
    for row, expected in zip(measured_table, expected_table):
        if bool(row["ok"]) != expected:
            violations.append(
                f"[table-privilege] has_table_privilege({row['r']!r}, {row['t']!r}, {row['p']!r}) "
                f"= {bool(row['ok'])}, the migrations say {expected}"
            )

    measured_col = await conn.fetch(
        """
        SELECT x.r, x.t, x.c, x.p, has_column_privilege(x.r, x.t, x.c, x.p) AS ok
        FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS x(r, t, c, p)
        """,
        c_roles,
        c_tables,
        c_cols,
        c_privs,
    )
    for row, expected in zip(measured_col, expected_col):
        if bool(row["ok"]) != expected:
            violations.append(
                f"[column-privilege] has_column_privilege({row['r']!r}, {row['t']!r}, "
                f"{row['c']!r}, {row['p']!r}) = {bool(row['ok'])}, the migrations say {expected}"
            )

    log(
        f"  derived checks issued: {len(expected_table)} table-level · {len(expected_col)} column-level"
    )
    return violations


_SUPPLEMENT_GRANT_BLOCK = re.compile(
    r"GRANT\s+SELECT\s*\((?P<cols>[^)]*)\)\s*ON\s+public\.connector_connections\s+TO\s+authenticated",
    re.IGNORECASE | re.DOTALL,
)


def supplement_section5_columns() -> tuple[str, ...] | None:
    """The column list §5 grants, or ``None`` when the block was not found.

    ``None`` rather than ``()`` is load-bearing: an empty list and "the regex did not match"
    are different facts, and conflating them is how a cross-file fence ships green while
    reading nothing.
    """
    sql = _strip_sql_comments(SUPPLEMENT.read_text(encoding="utf-8", errors="replace"))
    match = _SUPPLEMENT_GRANT_BLOCK.search(sql)
    if match is None:
        return None
    return tuple(c.strip().lower() for c in match.group("cols").split(",") if c.strip())


async def _read_as_authenticated(conn, sql: str) -> tuple[bool, str]:
    """Issue a REAL read as ``authenticated``. Returns ``(succeeded, detail)``.

    Each probe gets its OWN transaction: a refused read aborts the transaction, so a shared one
    would report every later probe as 'current transaction is aborted' -- a refusal about the
    harness rather than about the privilege.
    """
    try:
        async with conn.transaction():
            await conn.execute("SET LOCAL row_security = on")
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.fetch(sql)
            await conn.execute("RESET ROLE")
        return True, "the read SUCCEEDED"
    except Exception as exc:  # noqa: BLE001 - the cause is reported verbatim
        return False, f"{type(exc).__name__}: {exc}"


async def assert_named_cases(conn, log) -> list[str]:
    """The four named cases, asserted EXPLICITLY on top of the derived set.

    A parser regression must not be able to make SC#1 silently unmeasured, so these do not go
    through ``derive_expectations`` at all.
    """
    violations: list[str] = []
    log("")
    log("named cases (SC#1, SC#2, BUG-260911-01's pair):")

    # A POSITIVE CONTROL first. If `connector_tokens` were unreachable as `authenticated` for
    # some unrelated reason, the two refusals below would read as green while proving nothing.
    ok, detail = await _read_as_authenticated(conn, "SELECT id FROM public.connector_tokens LIMIT 1")
    log(f"  [control ] SELECT id FROM public.connector_tokens as authenticated -> {detail}")
    if not ok:
        violations.append(
            "[control] `authenticated` cannot read even the GRANTED column `id` of "
            f"public.connector_tokens ({detail}). The two ciphertext refusals below would then "
            "be green for the wrong reason, so this run proves nothing about SC#1."
        )

    for column in ("access_token_ciphertext", "refresh_token_ciphertext"):
        ok, detail = await _read_as_authenticated(
            conn, f"SELECT {column} FROM public.connector_tokens LIMIT 1"
        )
        log(f"  [SC#1    ] SELECT {column} FROM public.connector_tokens as authenticated -> {detail}")
        if ok:
            violations.append(
                f"[SC#1] `authenticated` CAN read public.connector_tokens.{column} on a database "
                "bootstrapped from supabase/full-schema.sql alone. Migration 129's own comment "
                "says this column 'must NEVER be granted SELECT to authenticated or anon'; "
                "129:85/88 and 151:90 revoke it and pg_dump --no-privileges cannot carry a "
                "REVOKE, so the greenfield bootstrap ships it readable. This is CR-01."
            )

    section5 = supplement_section5_columns()
    if section5 is None:
        violations.append(
            "[SC#2] the §5 `GRANT SELECT ( ... ) ON public.connector_connections TO "
            "authenticated` block was not found in scripts/full-schema-supplement.sql -- a "
            "green here would mean the block moved, not that the columns are readable"
        )
    else:
        log(f"  [SC#2    ] supplement §5 grants {len(section5)} columns on public.connector_connections")
        rows = await conn.fetch(
            """
            SELECT x.c, has_column_privilege('authenticated', 'public.connector_connections', x.c, 'SELECT') AS ok
            FROM unnest($1::text[]) AS x(c)
            """,
            list(section5),
        )
        unreadable = [r["c"] for r in rows if not r["ok"]]
        if unreadable:
            violations.append(
                f"[SC#2] `authenticated` cannot SELECT {unreadable} on public.connector_connections "
                "even though the supplement's own §5 grants them. Every connector list read "
                "names every response column, so one missing column answers 42501 for the whole "
                "table -- it looks like an outage, not a permissions bug."
            )
        else:
            log(f"  [SC#2    ] all {len(section5)} are readable as authenticated")

    for table in ("public.app_settings", "public.user_settings"):
        readable = await conn.fetchval("SELECT has_table_privilege('anon', $1, 'SELECT')", table)
        log(f"  [BUG-260911-01] has_table_privilege('anon', {table!r}, 'SELECT') = {bool(readable)}")
        if readable:
            violations.append(
                f"[BUG-260911-01] `anon` can SELECT {table} on a greenfield bootstrap. These are "
                "the EXACT two tables the production read path found with RLS disabled and anon "
                "holding all privileges; migration 177:70,71,79,100 closes it on every database "
                "that ran it, and the bootstrap artifact re-opens it."
            )

    # The corroborating catalog half (never information_schema.column_privileges).
    relacl = await conn.fetchval(
        "SELECT coalesce(c.relacl::text, '(none)') FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname='public' AND c.relname='connector_tokens'"
    )
    attacl = await conn.fetch(
        """
        SELECT a.attname, coalesce(a.attacl::text, '(none)') AS acl
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='connector_tokens'
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        """
    )
    log(f"  [catalog ] pg_class.relacl public.connector_tokens = {relacl}")
    for row in attacl:
        log(f"  [catalog ] pg_attribute.attacl connector_tokens.{row['attname']} = {row['acl']}")

    return violations


# ── create / teardown, both guarded ───────────────────────────────────────────


async def create_scratch_database(maintenance_conn, db_name: str) -> None:
    assert_greenfield_target(scratch_dsn(db_name))
    await maintenance_conn.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
    await maintenance_conn.execute(f'CREATE DATABASE "{db_name}"')


async def teardown_scratch_database(maintenance_conn, db_name: str, log) -> None:
    """Drop through the same guard, then PROVE it is gone.

    A ``finally: drop`` that is not verified is how a scratch database accumulates on a shared
    cluster -- and this cluster is the operator's live development Postgres.
    """
    assert_greenfield_target(scratch_dsn(db_name))
    await maintenance_conn.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
    still_there = await maintenance_conn.fetchval(
        "SELECT count(*) FROM pg_database WHERE datname = $1", db_name
    )
    if still_there:
        raise HarnessError(f"{db_name} is still present in pg_database after teardown")
    log(f"teardown verified: pg_database has 0 rows for {db_name}")


# ── entry point ───────────────────────────────────────────────────────────────


async def _run(log) -> int:
    supplement_md5, supplement_lines = assert_supplement_is_the_artifact_tail()
    log(
        f"MC-1 / D-11 tail identity OK -- scripts/full-schema-supplement.sql ({supplement_lines} "
        f"lines) == the last {supplement_lines} lines of supabase/full-schema.sql, md5 {supplement_md5}"
    )

    model, files, statement_count, per_file = derive_expectations()
    log(
        f"migration scan -- files read: {len(files)} (floor {MIN_MIGRATION_FILES}) · "
        f"table/column GRANT+REVOKE statements parsed: {statement_count} · "
        f"tables named: {len(model.tables)}"
    )
    log("  per-file statement counts: " + " · ".join(f"{k.split('_')[0]} ({v})" for k, v in sorted(per_file.items())))
    log("  tables: " + ", ".join(sorted(model.tables)))

    maintenance = await connect_or_skip(MAINTENANCE_DSN)
    db_name = generate_db_name()
    scratch = None
    try:
        preamble = await derive_default_privilege_preamble(maintenance, log)
        await create_scratch_database(maintenance, db_name)
        log(f"scratch database created: {db_name}")

        scratch = await connect_or_skip(scratch_dsn(db_name))
        await apply_artifact(scratch, preamble)
        log("supabase/full-schema.sql applied ALONE (MC-1: the supplement is already its tail)")

        violations = await assert_derived_set(scratch, model, log)
        violations += await assert_named_cases(scratch, log)
    finally:
        if scratch is not None:
            await scratch.close()
        try:
            await teardown_scratch_database(maintenance, db_name, log)
        finally:
            await maintenance.close()

    log("")
    if violations:
        log(f"{len(violations)} PRIVILEGE VIOLATION(S) -- a greenfield bootstrap does not carry them:")
        for v in violations:
            log(f"  {v}")
        log("")
        log(
            "pg_dump runs with --no-privileges, so supabase/full-schema.sql carries NO table ACL\n"
            "of its own. A privilege these migrations narrow is therefore ABSENT from every\n"
            "greenfield bootstrap -- silently, and in the permissive direction. Mirror each\n"
            "statement above into scripts/full-schema-supplement.sql, copying it from the\n"
            "migration rather than retyping it, and apply the SAME text to\n"
            "supabase/full-schema.sql's tail in the SAME COMMIT."
        )
        log(f"greenfield privileges FAILED -- {len(violations)} violation(s).")
        return EXIT_VIOLATION

    log(
        f"greenfield privileges OK -- {len(files)} migrations scanned, {statement_count} table/column "
        f"ACL statements replayed, every expectation measured as the granted role on a database "
        f"bootstrapped from supabase/full-schema.sql alone."
    )
    return EXIT_CLEAR


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover - older interpreters / redirected streams
        pass

    def log(msg: str = "") -> None:
        print(msg, flush=True)

    if "--self-test-skip" in argv:
        # Drives the THIRD verdict so it can be SEEN rather than assumed (D-19). It reaches a
        # port nothing listens on, creates nothing and drops nothing.
        try:
            asyncio.run(connect_or_skip(_DEAD_PORT_DSN))
        except SkipVerdict as exc:
            log(str(exc))
            log("greenfield privileges SKIPPED -- exit 2, never 0. A skip is not a pass.")
            return EXIT_HARNESS
        log("FATAL: the dead-port DSN connected; the skip path could not be driven")
        return EXIT_HARNESS

    if argv:
        log(f"FATAL: unknown argument(s) {argv!r}. This script takes no DSN and reads no "
            "environment variable (S-5); the only flag is --self-test-skip.")
        return EXIT_HARNESS

    try:
        return asyncio.run(_run(log))
    except SkipVerdict as exc:
        log(str(exc))
        log("greenfield privileges SKIPPED -- exit 2, never 0. A skip is not a pass.")
        return EXIT_HARNESS
    except (GreenfieldTargetRefused, VacuousScanError, HarnessError) as exc:
        log(f"FATAL: {type(exc).__name__}: {exc}")
        return EXIT_HARNESS


if __name__ == "__main__":
    sys.exit(main())
