#!/usr/bin/env python
"""Phase 241 (241-02 / QUEUE-06 / D-07) — the recall bench builder.

⚠ SEAM ONLY at this point (241-02 Task 1). The guard below exists, and has been seen to
fail, BEFORE this file is allowed to contain a single irreversible statement. The build,
copy, synthesis, skew, report and teardown arrive in Task 2.

⛔ SAFETY, which is this script's whole point. It will issue irreversible
database-level drop and create statements against a local Postgres cluster that also
holds the operator's live Supabase development data -- 159 documents and 7,953 chunks
that no migration, no backup and no fixture can restore. The one property that keeps
that safe is ``assert_bench_target``: the database name must EQUAL ``recall_bench``
(never a substring match) and the host must be loopback.
``backend/tests/unit/test_241_bench_safety.py`` drives both arms RED against planted
defects and fences the source so no destructive statement can be reached without the
guard running first.

⛔⛔ THE ONE DOCUMENTED DELTA FROM PRODUCTION — recorded here at Task 1 so it can never
be discovered as a surprise. ``supabase/full-schema.sql`` references ``auth.uid()`` in
156 places and ``auth.users(...)`` in 43 foreign keys, but creates only schema
``public``; on a real deploy Supabase Auth supplies both. So this builder will create a
minimal ``auth.users`` table and a hand-rolled ``auth.uid()`` reading the
``request.jwt.claims`` GUC. **That stub exists ONLY inside `recall_bench`; it must never
be copied into `supabase/migrations/` nor into `full-schema.sql`, because production's
`auth.uid()` is Supabase Auth's own and a hand-rolled one would be an authentication
bypass on 156 call sites.**
"""

from __future__ import annotations

import urllib.parse

# ── the ONE safe target ───────────────────────────────────────────────────────

BENCH_DB_NAME = "recall_bench"
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})
_ACCEPTED_SCHEMES = frozenset({"postgres", "postgresql"})


class BenchTargetRefused(RuntimeError):
    """The requested target is not a loopback ``recall_bench`` database."""


def assert_bench_target(dsn: str) -> None:
    """Refuse anything that is not the throwaway bench on this machine.

    The comparison on the database name is ``==`` and never ``in``:
    ``recall_bench_prod`` and ``myrecall_bench`` are somebody's databases, and a
    substring match would hand them to an irreversible drop. The host must be loopback,
    because the right database name on the wrong cluster is still the wrong cluster.

    Raises ``BenchTargetRefused`` naming the offending host or database, so the refusal
    is readable in a terminal without re-reading this file.
    """
    parsed = urllib.parse.urlparse(dsn)

    if parsed.scheme.lower() not in _ACCEPTED_SCHEMES:
        raise BenchTargetRefused(
            f"refusing target {dsn!r}: scheme {parsed.scheme!r} is not a postgres URL "
            "(a keyword or unix-socket DSN cannot be proven loopback)"
        )

    host = parsed.hostname
    if not host:
        raise BenchTargetRefused(
            f"refusing target {dsn!r}: no host in the DSN, so it cannot be proven "
            f"loopback (allowed: {sorted(LOOPBACK_HOSTS)})"
        )
    if host.lower() not in LOOPBACK_HOSTS:
        raise BenchTargetRefused(
            f"refusing host {host!r}: the recall bench is LOCAL-ONLY and this host is "
            f"not loopback (allowed: {sorted(LOOPBACK_HOSTS)}). The right database "
            "name on the wrong cluster is still the wrong cluster."
        )

    database = parsed.path.lstrip("/")
    if "/" in database:
        raise BenchTargetRefused(
            f"refusing target {dsn!r}: the path {parsed.path!r} does not name exactly "
            "one database"
        )
    if database != BENCH_DB_NAME:
        raise BenchTargetRefused(
            f"refusing database {database!r}: only the throwaway {BENCH_DB_NAME!r} "
            "database may be built or dropped by this script. The check is equality, "
            f"never a substring, so {BENCH_DB_NAME}_prod is refused too."
        )
