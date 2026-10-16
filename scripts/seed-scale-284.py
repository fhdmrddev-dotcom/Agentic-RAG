"""Phase 284 (D-20 / R-07) — the synthetic scale account: 10,000 or 50,000 latest documents.

Creates two LOCAL GoTrue users in ONE org ("Scale 284"):

  * ``scale284@example.com``   — the OWNER, who holds the corpus;
  * ``scale284-b@example.com`` — the PEER, who owns NOTHING (the D-18 leak test's subject).

…and seeds the owner's documents (rows only — no storage bytes, no embeddings):

  size 10000 : 6,000 Root ·  3,000 in folder "Big" ·  1,000 across 10 small folders
  size 50000 : 30,000 Root · 10,000 in folder "Big" · 10,000 across 20 small folders
  both sizes : + exactly 20 owner documents in the org-shared folder "Shared 284" — the union's
               global leg, visible to the peer (the leak test's POSITIVE control). The owner's
               latest total is therefore size + 20, and is reported as such.

Per size: ~300 archived, ~300 ``processing`` with an ``ingestion_step`` (no ``ingestion_jobs``
rows), 25 ``failed`` (5 of them naming "429 rate limit"), 200 older versions (``is_latest =
false``, same filename, lower ``version_number``), ``chunk_count`` 1-60, ~500
``document_tables`` and ~500 ``document_images`` rows, six ``metadata.document_type`` values,
distinct ``created_at`` (1 s apart, oldest first), and ONE document ``scale284-2500-chunks.pdf``
with exactly 2,500 ``document_chunks`` rows (``embedding`` NULL). Deterministic:
``random.Random(284)`` and ids via ``uuid5`` — so the oldest document in "Big" is the same row on
every reseed of the same size (G-4 scenario B).

⛔ THE DSN IS HARD-CODED TO 127.0.0.1:54322 AND NO ENVIRONMENT VARIABLE IS READ FOR IT (the
   ``scripts/apply_migration_178.py`` posture). The GoTrue URL and keys come from ``backend/.env``
   through ``_271_gotrue_users._local_env`` — and the script REFUSES unless that URL is loopback,
   because creating a user against a cloud project is a production write.

⛔ THIS SEEDS THE OPERATOR'S LIVE DEV DATABASE. Every write and every delete is scoped to the two
   synthetic user ids (resolved from the fixed e-mails) or the synthetic org's fixed id, through
   ONE helper (``_scoped``) that refuses any other shape — the ``build-recall-bench.py`` "refuse
   shapes rather than inspect them" posture. ``--teardown`` proves the dev account's document
   count is identical before and after.

⛔ THE LOCAL-DB LOCK (Phase 275 rule; memory note "local-DB lock file between sessions"):
   ``C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock``. If it is absent this script
   takes it (O_EXCL — the ``set -o noclobber`` equivalent) and removes it at exit. If it exists,
   the script runs ONLY with ``--lock-held`` (the caller asserts it holds the lock itself) — it
   never deletes another session's lock, and never waits silently.

⚠ Pitfall 9: 50,000 INSERTs flow through the ``supabase_realtime`` publication. Close every
   Library tab before seeding.

Usage (from ``backend/`` with the venv):
    venv/Scripts/python ../scripts/seed-scale-284.py --size 10000 [--lock-held]
    venv/Scripts/python ../scripts/seed-scale-284.py --size 50000 [--lock-held]
    venv/Scripts/python ../scripts/seed-scale-284.py --status
    venv/Scripts/python ../scripts/seed-scale-284.py --teardown [--lock-held]
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

import asyncpg  # noqa: E402

from tests.integration._271_gotrue_users import _admin, _local_env  # noqa: E402
from tests.integration._284_scale_account import (  # noqa: E402
    BIG_FOLDER_NAME,
    CHUNKY_FILENAME,
    DEV_ACCOUNT_EMAIL,
    SCALE_ORG_NAME,
    SCALE_OWNER_EMAIL,
    SCALE_PASSWORD,
    SCALE_PEER_EMAIL,
    SHARED_FOLDER_NAME,
)

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
LOCK_PATH = Path("C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock")
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})

NS = uuid.UUID("2a8e4c1e-0284-4c84-9284-5ca1e0000284")
ORG_ID = uuid.uuid5(NS, "scale284-org")
BIG_ID = uuid.uuid5(NS, "scale284-folder-big")
SHARED_ID = uuid.uuid5(NS, "scale284-folder-shared")
BASE_TS = datetime(2026, 1, 1, tzinfo=timezone.utc)

SHAPES = {
    10000: {"root": 6000, "big": 3000, "small_folders": 10, "per_small": 100},
    50000: {"root": 30000, "big": 10000, "small_folders": 20, "per_small": 500},
}
SHARED_DOCS = 20
N_ARCHIVED = 300
N_PROCESSING = 300
N_FAILED = 25
N_RATE_LIMITED = 5
N_OLDER = 200
N_TABLE_DOCS = 250   # x 2 tables each = 500 rows
N_IMAGE_DOCS = 250   # x 2 images each = 500 rows
CHUNKY_CHUNKS = 2500
DOC_TYPES = ("invoice", "contract", "report", "memo", "spec", "letter")
STEPS = ("extracting", "extracting_tables", "extracting_images", "embedding")
EXTS = (
    (".pdf", "application/pdf"),
    (".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    (".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    (".csv", "text/csv"),
    (".txt", "text/plain"),
    (".md", "text/markdown"),
)
COPY_BATCH = 5000

DOC_COLUMNS = (
    "id", "user_id", "org_id", "folder_id", "filename", "file_path", "file_size", "mime_type",
    "status", "error_message", "chunk_count", "content_hash", "metadata", "version_number",
    "is_latest", "created_at", "updated_at", "ingestion_step", "extractor", "page_count",
    "archived_at", "ingest_visibility",
)  # `retrievable` is a GENERATED column (mig 205) — COPY refuses it


class ShapeRefused(RuntimeError):
    """A write or delete was asked for outside the synthetic scope."""


# ── the lock ─────────────────────────────────────────────────────────────────────────────────

class LocalDbLock:
    def __init__(self, held_by_caller: bool, what: str):
        self.held_by_caller = held_by_caller
        self.what = what
        self.mine = False

    def __enter__(self):
        if self.held_by_caller:
            if not LOCK_PATH.exists():
                raise SystemExit(
                    f"--lock-held was passed but {LOCK_PATH} does not exist — take the lock first"
                )
            return self
        try:
            fd = os.open(str(LOCK_PATH), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            holder = LOCK_PATH.read_text(encoding="utf-8", errors="replace").strip()
            raise SystemExit(
                f"the local-DB lock is held: {holder!r} — wait for it (never delete another "
                "session's lock; stale after 45 min — report it), or pass --lock-held if YOU hold it"
            )
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(f"seed-scale-284 {self.what} {datetime.now(timezone.utc).isoformat()}\n")
        self.mine = True
        return self

    def __exit__(self, *exc):
        if self.mine:
            try:
                LOCK_PATH.unlink()
            except FileNotFoundError:
                pass


# ── scope guard ──────────────────────────────────────────────────────────────────────────────

class Scope:
    """The ONLY values a write or delete may be scoped to."""

    def __init__(self, owner: uuid.UUID | None, peer: uuid.UUID | None):
        self.uids = {u for u in (owner, peer) if u is not None}
        self.org = ORG_ID

    def check_uid(self, uid) -> uuid.UUID:
        u = uuid.UUID(str(uid))
        if u not in self.uids:
            raise ShapeRefused(f"refusing a write scoped to user {u} — not a synthetic scale284 user")
        return u

    def check_org(self, org) -> uuid.UUID:
        o = uuid.UUID(str(org))
        if o != self.org:
            raise ShapeRefused(f"refusing a write scoped to org {o} — not the synthetic org")
        return o


async def _scoped(conn, scope: Scope, sql: str, *, uid=None, org=None) -> str:
    """Run a DELETE/UPDATE whose ONLY parameter is a synthetic uid ($1) or the synthetic org ($1)."""
    head = sql.lstrip().split()[0].upper()
    if head not in {"DELETE", "UPDATE"}:
        raise ShapeRefused(f"_scoped runs DELETE/UPDATE only, got {head}")
    if (uid is None) == (org is None):
        raise ShapeRefused("_scoped needs exactly one of uid= / org=")
    if "$1" not in sql or "$2" in sql:
        raise ShapeRefused("_scoped statements carry exactly one parameter, $1")
    value = scope.check_uid(uid) if uid is not None else scope.check_org(org)
    return await conn.execute(sql, value)


# ── helpers ──────────────────────────────────────────────────────────────────────────────────

def _assert_loopback_gotrue() -> None:
    env = _local_env()
    host = urlparse(env.get("SUPABASE_URL", "")).hostname or ""
    if host.lower() not in LOOPBACK_HOSTS:
        raise SystemExit(
            f"refusing: backend/.env SUPABASE_URL host {host!r} is not loopback — creating users "
            "against a non-local project is a production write"
        )


def _csv(rows) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    for row in rows:
        w.writerow(["" if v is None else v for v in row])
    return buf.getvalue().encode("utf-8")


async def _copy(conn, table: str, columns, rows: list) -> None:
    for i in range(0, len(rows), COPY_BATCH):
        await conn.copy_to_table(
            table, schema_name="public", columns=list(columns),
            source=io.BytesIO(_csv(rows[i : i + COPY_BATCH])), format="csv",
        )


async def _uid(conn, email: str) -> uuid.UUID | None:
    row = await conn.fetchrow("SELECT id FROM auth.users WHERE lower(email) = lower($1)", email)
    return row["id"] if row else None


def _ts(dt: datetime) -> str:
    return dt.isoformat()


# ── users and org ────────────────────────────────────────────────────────────────────────────

async def _ensure_user(conn, email: str) -> uuid.UUID:
    existing = await _uid(conn, email)
    if existing:
        return existing
    created = _admin().auth.admin.create_user(
        {"email": email, "password": SCALE_PASSWORD, "email_confirm": True}
    )
    return uuid.UUID(str(created.user.id))


async def _ensure_org(conn, scope: Scope, owner: uuid.UUID, peer: uuid.UUID) -> None:
    await conn.execute(
        "INSERT INTO public.organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        ORG_ID, SCALE_ORG_NAME,
    )
    for uid, email in ((owner, SCALE_OWNER_EMAIL), (peer, SCALE_PEER_EMAIL)):
        scope.check_uid(uid)
        # The signup trigger's personal org: drop the membership, then the org only when it is
        # named after this synthetic e-mail AND has no member left (never anyone else's org).
        personal = await conn.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1 AND org_id <> $2", uid, ORG_ID
        )
        for row in personal:
            await conn.execute(
                "DELETE FROM public.org_members WHERE user_id = $1 AND org_id = $2", uid, row["org_id"]
            )
            await conn.execute(
                "DELETE FROM public.organizations o WHERE o.id = $1 AND o.name = $2 "
                "AND NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = o.id)",
                row["org_id"], f"{email}'s Organization",
            )
        role = "org-admin" if uid == owner else "member"
        await conn.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, $3) "
            "ON CONFLICT (org_id, user_id) DO NOTHING",
            ORG_ID, uid, role,
        )


# ── the shape ────────────────────────────────────────────────────────────────────────────────

def build_rows(size: int, owner: uuid.UUID):
    shape = SHAPES[size]
    rng = random.Random(284)
    small_ids = [uuid.uuid5(NS, f"scale284-folder-small-{k:02d}") for k in range(1, shape["small_folders"] + 1)]
    folders = [(BIG_ID, BIG_FOLDER_NAME, False)] + [
        (fid, f"Small {k:02d}", False) for k, fid in enumerate(small_ids, start=1)
    ] + [(SHARED_ID, SHARED_FOLDER_NAME, True)]

    labels: list = [None] * shape["root"] + [BIG_ID] * shape["big"]
    for fid in small_ids:
        labels += [fid] * shape["per_small"]
    assert len(labels) == size
    rng.shuffle(labels)

    idx = list(range(size))
    picks = rng.sample(idx, N_ARCHIVED + N_PROCESSING + N_FAILED + N_OLDER)
    archived = set(picks[:N_ARCHIVED])
    processing = set(picks[N_ARCHIVED : N_ARCHIVED + N_PROCESSING])
    failed_list = picks[N_ARCHIVED + N_PROCESSING : N_ARCHIVED + N_PROCESSING + N_FAILED]
    failed = set(failed_list)
    rate_limited = set(failed_list[:N_RATE_LIMITED])
    older = set(picks[N_ARCHIVED + N_PROCESSING + N_FAILED :])  # completed, not archived
    chunky = next(i for i in idx if labels[i] is None and i not in archived | processing | failed | older)

    docs, old_rows, table_rows, image_rows, chunk_rows = [], [], [], [], []
    completed = []
    for i in idx:
        doc_id = uuid.uuid5(NS, f"scale284-{i}")
        ext, mime = EXTS[rng.randrange(len(EXTS))]
        filename = CHUNKY_FILENAME if i == chunky else f"scale284-{i:05d}{ext}"
        if i == chunky:
            mime = "application/pdf"
        created = BASE_TS + timedelta(seconds=i)
        updated = created + timedelta(seconds=rng.randint(60, 30 * 86400), microseconds=i % 1000000)
        status, error, step, chunks = "completed", None, None, rng.randint(1, 60)
        if i in processing:
            status, step, chunks = "processing", STEPS[i % len(STEPS)], None
        elif i in failed:
            status, chunks = "failed", 0
            error = ("Embedding provider returned 429 rate limit — retry later" if i in rate_limited
                     else "Extraction failed: the file could not be parsed")
            step = "failed"
        if i == chunky:
            chunks = CHUNKY_CHUNKS
        meta = {"document_type": DOC_TYPES[i % len(DOC_TYPES)], "seed": "scale284"}
        version = 2 if i in older else 1
        docs.append((
            doc_id, owner, ORG_ID, labels[i], filename, f"scale284/{doc_id}{ext}",
            rng.randint(10_000, 5_000_000), mime, status, error, chunks,
            f"scale284-{doc_id.hex}", json.dumps(meta), version, "t", _ts(created), _ts(updated),
            step, "scale284-seed", rng.randint(1, 40) if ext == ".pdf" else None,
            _ts(created + timedelta(days=1)) if i in archived else None, "private",
        ))
        if status == "completed":
            completed.append(doc_id)
        if i in older:
            old_id = uuid.uuid5(NS, f"scale284-old-{i}")
            old_rows.append((
                old_id, owner, ORG_ID, labels[i], filename, f"scale284/{old_id}{ext}",
                rng.randint(10_000, 5_000_000), mime, "completed", None, rng.randint(1, 60),
                f"scale284-{old_id.hex}", json.dumps(meta), 1, "f",
                _ts(created - timedelta(hours=1)), _ts(created - timedelta(hours=1)),
                None, "scale284-seed", None, None, "private",
            ))
        if i == chunky:
            for k in range(CHUNKY_CHUNKS):
                chunk_rows.append((uuid.uuid5(NS, f"scale284-chunk-{k}"), doc_id, owner, ORG_ID,
                                   f"scale284 seeded chunk {k}", k))

    for j in range(SHARED_DOCS):
        doc_id = uuid.uuid5(NS, f"scale284-shared-{j}")
        created = BASE_TS + timedelta(seconds=size + j)
        docs.append((
            doc_id, owner, ORG_ID, SHARED_ID, f"scale284-shared-{j:02d}.pdf",
            f"scale284/{doc_id}.pdf", 50_000 + j, "application/pdf", "completed", None, 3,
            f"scale284-{doc_id.hex}", json.dumps({"document_type": "report", "seed": "scale284"}),
            1, "t", _ts(created), _ts(created + timedelta(minutes=5)), None, "scale284-seed", 2,
            None, "private",
        ))

    pool = [d for d in completed]
    rng.shuffle(pool)
    for doc_id in pool[:N_TABLE_DOCS]:
        for t in range(2):
            table_rows.append((uuid.uuid4(), doc_id, owner, ORG_ID, t, json.dumps(["col_a", "col_b"]),
                               json.dumps([["1", "2"], ["3", "4"]]), 1))
    rng.shuffle(pool)
    for doc_id in pool[:N_IMAGE_DOCS]:
        for m in range(2):
            image_rows.append((uuid.uuid4(), doc_id, owner, ORG_ID, m, "seeded image", 1))
    return folders, docs, old_rows, table_rows, image_rows, chunk_rows


# ── status ───────────────────────────────────────────────────────────────────────────────────

async def status_of(conn) -> dict:
    owner = await _uid(conn, SCALE_OWNER_EMAIL)
    peer = await _uid(conn, SCALE_PEER_EMAIL)
    out: dict = {"owner": str(owner) if owner else None, "peer": str(peer) if peer else None}
    if owner is None:
        return out
    q = lambda sql, *a: conn.fetchval(sql, *a)  # noqa: E731
    out["owner_latest"] = await q("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest", owner)
    out["owner_rows_all_versions"] = await q("SELECT count(*) FROM documents WHERE user_id=$1", owner)
    out["root_latest"] = await q(
        "SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id IS NULL", owner)
    out["big_latest"] = await q(
        "SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id=$2", owner, BIG_ID)
    out["shared_latest"] = await q(
        "SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id=$2", owner, SHARED_ID)
    out["small_folders"] = await q(
        "SELECT count(*) FROM folders WHERE user_id=$1 AND name LIKE 'Small %'", owner)
    out["archived_latest"] = await q(
        "SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND archived_at IS NOT NULL", owner)
    out["status"] = {r["status"]: r["n"] for r in await conn.fetch(
        "SELECT status, count(*) n FROM documents WHERE user_id=$1 AND is_latest GROUP BY 1", owner)}
    out["older_versions"] = await q("SELECT count(*) FROM documents WHERE user_id=$1 AND NOT is_latest", owner)
    out["document_tables"] = await q("SELECT count(*) FROM document_tables WHERE user_id=$1", owner)
    out["document_images"] = await q("SELECT count(*) FROM document_images WHERE user_id=$1", owner)
    out["docs_with_2500_chunks"] = await q(
        "SELECT count(*) FROM (SELECT document_id FROM document_chunks WHERE user_id=$1 "
        "GROUP BY 1 HAVING count(*) = 2500) s", owner)
    out["peer_owns"] = await q("SELECT count(*) FROM documents WHERE user_id=$1", peer) if peer else None
    out["memberships"] = {
        str(r["user_id"]): [str(r["org_id"]), r["role"]] for r in await conn.fetch(
            "SELECT user_id, org_id, role FROM org_members WHERE user_id = ANY($1::uuid[])",
            [u for u in (owner, peer) if u])
    }
    return out


def _shape_matches(st: dict, size: int) -> bool:
    shape = SHAPES[size]
    return (
        st.get("owner_latest") == size + SHARED_DOCS
        and st.get("root_latest") == shape["root"]
        and st.get("big_latest") == shape["big"]
        and st.get("shared_latest") == SHARED_DOCS
        and st.get("small_folders") == shape["small_folders"]
        and st.get("older_versions") == N_OLDER
        and st.get("docs_with_2500_chunks") == 1
        and st.get("peer_owns") == 0
    )


# ── commands ─────────────────────────────────────────────────────────────────────────────────

async def _delete_owner_corpus(conn, scope: Scope, owner: uuid.UUID) -> None:
    # Children cascade from documents (ON DELETE CASCADE); deleted explicitly first so the
    # cascade does not have to discover them row by row.
    for table in ("document_chunks", "document_tables", "document_images"):
        await _scoped(conn, scope, f"DELETE FROM public.{table} WHERE user_id = $1", uid=owner)
    await _scoped(conn, scope, "DELETE FROM public.documents WHERE user_id = $1", uid=owner)
    await _scoped(conn, scope, "DELETE FROM public.folders WHERE user_id = $1", uid=owner)


async def seed(size: int) -> int:
    _assert_loopback_gotrue()
    conn = await asyncpg.connect(DSN)
    try:
        owner = await _ensure_user(conn, SCALE_OWNER_EMAIL)
        peer = await _ensure_user(conn, SCALE_PEER_EMAIL)
        scope = Scope(owner, peer)
        await _ensure_org(conn, scope, owner, peer)

        st = await status_of(conn)
        if _shape_matches(st, size):
            print(f"no-op: the owner already holds the {size} shape")
            print(json.dumps(st, indent=2))
            return 0

        triggers = await conn.fetch(
            "SELECT tgname, pg_get_triggerdef(oid) d FROM pg_trigger "
            "WHERE tgrelid = 'public.documents'::regclass AND NOT tgisinternal ORDER BY tgname")
        print("triggers on public.documents (kept enabled — none enqueues external work):")
        for t in triggers:
            print(f"  {t['tgname']}")
        print("⚠ Pitfall 9: these INSERTs flow through the supabase_realtime publication — "
              "close every Library tab.")

        folders, docs, old_rows, table_rows, image_rows, chunk_rows = build_rows(size, owner)
        async with conn.transaction():
            await _delete_owner_corpus(conn, scope, owner)
            for fid, name, shared in folders:
                await conn.execute(
                    "INSERT INTO public.folders (id, user_id, org_id, name, parent_id, is_org_shared) "
                    "VALUES ($1, $2, $3, $4, NULL, $5)",
                    fid, scope.check_uid(owner), scope.check_org(ORG_ID), name, shared)
            for row in docs + old_rows:
                scope.check_uid(row[1]); scope.check_org(row[2])
            await _copy(conn, "documents", DOC_COLUMNS, docs)
            await _copy(conn, "documents", DOC_COLUMNS, old_rows)
            await _copy(conn, "document_tables",
                        ("id", "document_id", "user_id", "org_id", "table_index", "headers", "rows", "page"),
                        table_rows)
            await _copy(conn, "document_images",
                        ("id", "document_id", "user_id", "org_id", "image_index", "description", "page"),
                        image_rows)
            await _copy(conn, "document_chunks",
                        ("id", "document_id", "user_id", "org_id", "content", "chunk_index"), chunk_rows)
        await conn.execute("VACUUM (ANALYZE) public.documents")
        await conn.execute("VACUUM (ANALYZE) public.document_chunks")
        st = await status_of(conn)
        print(json.dumps(st, indent=2))
        if not _shape_matches(st, size):
            print(f"FAIL: the seeded shape does not match the {size} contract")
            return 1
        print(f"seeded: {size} + {SHARED_DOCS} shared = {size + SHARED_DOCS} latest owner documents")
        return 0
    finally:
        await conn.close()


async def teardown() -> int:
    _assert_loopback_gotrue()
    conn = await asyncpg.connect(DSN)
    try:
        dev = await _uid(conn, DEV_ACCOUNT_EMAIL)
        dev_before = await conn.fetchval("SELECT count(*) FROM documents WHERE user_id = $1", dev) if dev else None
        owner = await _uid(conn, SCALE_OWNER_EMAIL)
        peer = await _uid(conn, SCALE_PEER_EMAIL)
        scope = Scope(owner, peer)
        async with conn.transaction():
            for uid in (owner, peer):
                if uid is None:
                    continue
                await _delete_owner_corpus(conn, scope, uid)
                await _scoped(conn, scope, "DELETE FROM public.org_members WHERE user_id = $1", uid=uid)
            await _scoped(conn, scope, "DELETE FROM public.org_members WHERE org_id = $1", org=ORG_ID)
            await _scoped(conn, scope, "DELETE FROM public.organizations WHERE id = $1", org=ORG_ID)
        admin = _admin()
        for uid in (owner, peer):
            if uid is not None:
                admin.auth.admin.delete_user(str(uid))
        dev_after = await conn.fetchval("SELECT count(*) FROM documents WHERE user_id = $1", dev) if dev else None
        print(f"dev account documents: before={dev_before} after={dev_after}")
        if dev_before != dev_after:
            print("FAIL: the dev corpus changed across teardown")
            return 1
        left = [e for e in (SCALE_OWNER_EMAIL, SCALE_PEER_EMAIL) if await _uid(conn, e)]
        if left:
            print(f"FAIL: users still present after teardown: {left}")
            return 1
        print("teardown complete: both synthetic users, their org, folders and documents removed")
        return 0
    finally:
        await conn.close()


async def status() -> int:
    conn = await asyncpg.connect(DSN)
    try:
        print(json.dumps(await status_of(conn), indent=2))
        return 0
    finally:
        await conn.close()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--size", type=int, choices=sorted(SHAPES))
    g.add_argument("--teardown", action="store_true")
    g.add_argument("--status", action="store_true")
    ap.add_argument("--lock-held", action="store_true",
                    help="the caller already holds the local-DB lock")
    args = ap.parse_args()
    if args.status:
        return asyncio.run(status())
    with LocalDbLock(args.lock_held, "teardown" if args.teardown else f"seed {args.size}"):
        if args.teardown:
            return asyncio.run(teardown())
        return asyncio.run(seed(args.size))


if __name__ == "__main__":
    sys.exit(main())
