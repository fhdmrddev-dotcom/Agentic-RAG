#!/usr/bin/env python3
"""Phase 294 Plan 02 (D-18) — build and freeze the decision-engine held-out set.

Run it with the backend virtualenv, from the repository root. Two modes::

    # 1. dump a seeded, stratified sample of real chunks to the SCRATCHPAD (never the repo)
    backend/venv/Scripts/python scripts/build-decision-heldout.py --select --out <scratch>/candidates.json

    # 2. validate the questions written from that dump, then write the frozen fixture + sha256
    backend/venv/Scripts/python scripts/build-decision-heldout.py --freeze --questions <scratch>/questions.json

**Freeze first (D-18).** The fixture and its sha256 sidecar are committed before any engine is
measured, and ``app.services.decision_eval.load_heldout`` refuses a fixture whose bytes do not hash
to the sidecar. The questions are written from chunk TEXT only; nothing in this script calls an
engine, the reranker or the search path.

**Read-only.** Every statement here is a SELECT. The DSN is never printed (only host/database via
``recall_eval.dsn_label``), and the chunk dump goes wherever ``--out`` points, which must be outside
the repository.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import random
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import asyncpg  # noqa: E402

from app.services.recall_eval import (  # noqa: E402  (path setup must precede the import)
    EVAL_PROBES,
    RecallUnmeasurable,
    dsn_label,
)

DEFAULT_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DEV_USER_ID = "d8a54002-6a29-4b88-b918-cff2aa4a06d5"
SEED = 294
CANDIDATES = 48
MIN_CHUNK_CHARS = 300
MIN_CHUNK_ITEMS = 40
MIN_TOTAL_ITEMS = 50
VERBATIM_RUN = 6
EMBEDDING_MODEL = "text-embedding-3-small"

FIXTURE_PATH = _BACKEND_ROOT / "tests" / "unit" / "fixtures" / "decision_heldout_v1.json"
SHA_PATH = _BACKEND_ROOT / "tests" / "unit" / "fixtures" / "decision_heldout_v1.sha256"

SELECTION_RULE = (
    "Dev user d8a54002-6a29-4b88-b918-cff2aa4a06d5. Eligible documents: is_latest, status "
    "'completed', retrievable, not archived, not an EVAL_PROBES target. Eligible chunks: an "
    "embedding under text-embedding-3-small and at least 300 characters of content. Documents are "
    "grouped by file extension; each group is ordered by document id and shuffled with "
    "random.Random(294); groups are drawn round-robin in extension order until 48 documents are "
    "chosen; one chunk per document is drawn with the same generator from its eligible chunks in "
    "chunk_index order. One question per chunk, written from the chunk text only and paraphrased "
    "(no run of 6 or more consecutive words shared with the chunk). Probe items are the 10 "
    "EVAL_PROBES queries verbatim, each targeting its resolved document (exact filename, then stem). "
    "A chunk target is (document_id, chunk_index, chunk_sha256): the content hash is part of the "
    "identity because (document_id, chunk_index) is not unique in this corpus."
)

_EXIT_OK = 0
_EXIT_REFUSED = 2


# ─────────────────────────────────────────────────────────────────────────────
# Pure helpers (unit-testable, no I/O)
# ─────────────────────────────────────────────────────────────────────────────

def content_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _words(text: str) -> list[str]:
    return re.sub(r"[^0-9a-z]+", " ", text.lower()).split()


def shared_verbatim_run(question: str, chunk: str, n: int = VERBATIM_RUN) -> str | None:
    """The first run of ``n`` consecutive words the question shares with the chunk, or None.

    Case-insensitive, punctuation stripped. A question that copies the chunk lets the keyword arm
    win trivially, so the freeze rejects it.
    """
    q = _words(question)
    c = _words(chunk)
    if len(q) < n or len(c) < n:
        return None
    grams = {tuple(c[i : i + n]) for i in range(len(c) - n + 1)}
    for i in range(len(q) - n + 1):
        gram = tuple(q[i : i + n])
        if gram in grams:
            return " ".join(gram)
    return None


def serialise_fixture(payload: dict) -> bytes:
    """Sorted keys, two-space indent, LF line endings, trailing newline. The bytes that are hashed."""
    return (json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else "(none)"


# ─────────────────────────────────────────────────────────────────────────────
# Database reads (SELECT only)
# ─────────────────────────────────────────────────────────────────────────────

async def _connect(dsn: str) -> asyncpg.Connection:
    try:
        return await asyncpg.connect(dsn, timeout=10)
    except Exception as exc:
        raise RecallUnmeasurable(
            f"could not build the held-out set: no usable connection to {dsn_label(dsn)} "
            f"({type(exc).__name__})"
        ) from exc


async def resolve_probes(conn: asyncpg.Connection, user_id: str) -> list[dict]:
    """Each EVAL_PROBES target resolved to the user's latest document (exact name, then stem).

    The rule is recall_eval.resolve_probe_targets', scoped to the user's own documents. An
    unresolvable probe comes back with ``document_id`` None and is reported by name.
    """
    rows = await conn.fetch(
        """SELECT id::text AS id, filename FROM public.documents
           WHERE user_id = $1::uuid AND is_latest = true AND status = 'completed'
             AND retrievable AND archived_at IS NULL
           ORDER BY id""",
        user_id,
    )
    by_filename = {row["filename"].lower(): (row["id"], row["filename"]) for row in rows if row["filename"]}
    resolved: list[dict] = []
    for probe in EVAL_PROBES:
        target = probe["target_filename"].lower()
        hit = by_filename.get(target)
        if hit is None:
            stem = target.rsplit(".", 1)[0]
            for filename, candidate in by_filename.items():
                if stem and stem in filename:
                    hit = candidate
                    break
        resolved.append(
            {
                "query": probe["query"],
                "target_filename": probe["target_filename"],
                "document_id": hit[0] if hit else None,
                "filename": hit[1] if hit else None,
            }
        )
    return resolved


async def select_candidates(conn: asyncpg.Connection, user_id: str, exclude_docs: set[str]) -> list[dict]:
    rows = await conn.fetch(
        """SELECT d.id::text AS document_id, d.filename, c.chunk_index, c.content
           FROM public.document_chunks c
           JOIN public.documents d ON d.id = c.document_id
           WHERE c.user_id = $1::uuid
             AND d.is_latest = true AND d.status = 'completed' AND d.retrievable
             AND d.archived_at IS NULL
             AND c.embedding IS NOT NULL AND c.embedding_model = $2
             AND length(c.content) >= $3
           ORDER BY d.id, c.chunk_index""",
        user_id,
        EMBEDDING_MODEL,
        MIN_CHUNK_CHARS,
    )
    by_doc: dict[str, list[dict]] = defaultdict(list)
    names: dict[str, str] = {}
    for row in rows:
        if row["document_id"] in exclude_docs:
            continue
        by_doc[row["document_id"]].append(dict(row))
        names[row["document_id"]] = row["filename"] or ""

    rng = random.Random(SEED)
    groups: dict[str, list[str]] = defaultdict(list)
    for doc_id in sorted(by_doc):
        groups[_extension(names[doc_id])].append(doc_id)
    for ext in sorted(groups):
        rng.shuffle(groups[ext])

    chosen: list[str] = []
    order = sorted(groups)
    while len(chosen) < CANDIDATES and any(groups[ext] for ext in order):
        for ext in order:
            if groups[ext] and len(chosen) < CANDIDATES:
                chosen.append(groups[ext].pop(0))

    candidates: list[dict] = []
    for doc_id in chosen:
        chunk = rng.choice(by_doc[doc_id])
        candidates.append(
            {
                "document_id": doc_id,
                "filename": chunk["filename"],
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "chunk_sha256": content_sha256(chunk["content"]),
            }
        )
    return candidates


async def read_chunk(
    conn: asyncpg.Connection, document_id: str, chunk_index: int, chunk_sha256: str
) -> str | None:
    """The content of the chunk at (document, index) whose bytes hash to ``chunk_sha256``, or None.

    ⚠ ``(document_id, chunk_index)`` is NOT unique in this corpus (measured 2026-10-20: 1,200
    duplicated pairs, e.g. a table chunk and a text chunk both at index 0), so the content hash is
    what makes a chunk target exact.
    """
    rows = await conn.fetch(
        "SELECT content FROM public.document_chunks WHERE document_id = $1::uuid AND chunk_index = $2",
        document_id,
        chunk_index,
    )
    for row in rows:
        if content_sha256(row["content"]) == chunk_sha256:
            return row["content"]
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Modes
# ─────────────────────────────────────────────────────────────────────────────

def _refuse_repo_path(path: Path) -> None:
    resolved = path.resolve()
    if resolved == _REPO_ROOT or _REPO_ROOT in resolved.parents:
        raise RecallUnmeasurable(
            f"refusing to write the raw chunk dump inside the repository ({resolved}); "
            "point --out at the session scratchpad"
        )


async def run_select(dsn: str, user_id: str, out: Path) -> dict:
    _refuse_repo_path(out)
    conn = await _connect(dsn)
    try:
        probes = await resolve_probes(conn, user_id)
        exclude = {p["document_id"] for p in probes if p["document_id"]}
        candidates = await select_candidates(conn, user_id, exclude)
    finally:
        await conn.close()
    dump = {
        "user_id": user_id,
        "seed": SEED,
        "selection": SELECTION_RULE,
        "probes": probes,
        "candidates": candidates,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(dump, indent=2, ensure_ascii=False), encoding="utf-8")
    return dump


async def run_freeze(dsn: str, user_id: str, questions_path: Path) -> tuple[dict, list[str]]:
    authored = json.loads(questions_path.read_text(encoding="utf-8"))
    chunk_items = authored.get("items") or []
    rejected: list[str] = []

    conn = await _connect(dsn)
    try:
        probes = await resolve_probes(conn, user_id)
        items: list[dict] = []
        seen: set[str] = set()
        for entry in chunk_items:
            item_id = str(entry["id"])
            if item_id in seen:
                rejected.append(f"{item_id}: duplicate id")
                continue
            seen.add(item_id)
            content = await read_chunk(
                conn, entry["document_id"], int(entry["chunk_index"]), entry["chunk_sha256"]
            )
            if content is None:
                rejected.append(f"{item_id}: target chunk no longer matches the database")
                continue
            run = shared_verbatim_run(entry["query"], content)
            if run is not None:
                rejected.append(f"{item_id}: shares a {VERBATIM_RUN}-word verbatim run with its chunk: '{run}'")
                continue
            items.append(
                {
                    "id": item_id,
                    "kind": "chunk",
                    "query": entry["query"],
                    "target": {
                        "document_id": entry["document_id"],
                        "chunk_index": int(entry["chunk_index"]),
                        "chunk_sha256": entry["chunk_sha256"],
                        "filename": entry.get("filename"),
                    },
                }
            )
    finally:
        await conn.close()

    unresolved = [p["target_filename"] for p in probes if p["document_id"] is None]
    for index, probe in enumerate(probes, start=1):
        if probe["document_id"] is None:
            continue
        items.append(
            {
                "id": f"p{index:02d}",
                "kind": "probe",
                "query": probe["query"],
                "target": {"document_id": probe["document_id"], "filename": probe["filename"]},
            }
        )

    if rejected:
        return {}, rejected

    n_chunk = sum(1 for item in items if item["kind"] == "chunk")
    if n_chunk < MIN_CHUNK_ITEMS or len(items) < MIN_TOTAL_ITEMS:
        raise RecallUnmeasurable(
            f"held-out set too small: {n_chunk} chunk items (need {MIN_CHUNK_ITEMS}) and "
            f"{len(items)} items in total (need {MIN_TOTAL_ITEMS})"
        )

    payload = {
        "version": 1,
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "user_id": user_id,
        "seed": SEED,
        "selection": SELECTION_RULE,
        "unresolved_probes": unresolved,
        "items": sorted(items, key=lambda item: item["id"]),
    }
    data = serialise_fixture(payload)
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_PATH.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    SHA_PATH.write_bytes(f"{digest}  {FIXTURE_PATH.name}\n".encode("ascii"))
    return payload, []


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="build-decision-heldout.py")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--select", action="store_true", help="dump candidate chunks to --out")
    mode.add_argument("--freeze", action="store_true", help="validate --questions and write the fixture")
    parser.add_argument("--out", type=Path, help="where --select writes the dump (outside the repo)")
    parser.add_argument("--questions", type=Path, help="the authored questions file for --freeze")
    parser.add_argument("--dsn", default=DEFAULT_DSN, help="read-only Postgres DSN (default: local)")
    parser.add_argument("--user-id", default=DEV_USER_ID)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.select:
            if args.out is None:
                print("[build-decision-heldout] --select needs --out", file=sys.stderr)
                return _EXIT_REFUSED
            dump = asyncio.run(run_select(args.dsn, args.user_id, args.out))
            print(f"[build-decision-heldout] read {dsn_label(args.dsn)}")
            print(f"  candidates: {len(dump['candidates'])}")
            unresolved = [p["target_filename"] for p in dump["probes"] if p["document_id"] is None]
            print(f"  probes resolved: {len(dump['probes']) - len(unresolved)} of {len(dump['probes'])}")
            for name in unresolved:
                print(f"  UNRESOLVED probe target: {name}")
            print(f"  dump written to {args.out}")
            return _EXIT_OK

        if args.questions is None:
            print("[build-decision-heldout] --freeze needs --questions", file=sys.stderr)
            return _EXIT_REFUSED
        payload, rejected = asyncio.run(run_freeze(args.dsn, args.user_id, args.questions))
    except RecallUnmeasurable as exc:
        print(f"[build-decision-heldout] REFUSED: {exc}", file=sys.stderr)
        return _EXIT_REFUSED

    if rejected:
        print(f"[build-decision-heldout] REFUSED: {len(rejected)} item(s) rejected; nothing written", file=sys.stderr)
        for line in rejected:
            print(f"  rejected {line}", file=sys.stderr)
        return _EXIT_REFUSED

    items = payload["items"]
    print(f"[build-decision-heldout] read {dsn_label(args.dsn)}")
    print(f"  items: {len(items)} ({sum(1 for i in items if i['kind'] == 'chunk')} chunk, "
          f"{sum(1 for i in items if i['kind'] == 'probe')} probe)")
    print(f"  items rejected for a {VERBATIM_RUN}-word verbatim run: 0")
    for name in payload["unresolved_probes"]:
        print(f"  UNRESOLVED probe target: {name}")
    print(f"  sha256 {SHA_PATH.read_text(encoding='ascii').split()[0]}")
    print(f"  fixture written to {FIXTURE_PATH}")
    return _EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
