"""Backfill metadata for documents the durable queue ingested without it (BUG-260905-06).

⛔ WHAT WENT WRONG. Phase 230 cut `/upload` over to the durable ingestion queue. With a
`job_id`, `splice_document` stops delegating to `ingest_document` and runs its own inline
chunk/embed loop — and that loop was written without the enrichment step. So from the cutover
until the fix, every uploaded document reached `completed` carrying:

  * no title / date / author / document_type / custom fields;
  * no `[Document: … | Title: … | Date: …]` header on its embedded chunks;
  * no SEED-226 vision transcription (scans, drawings and images produced nothing).

This script repairs the first two for documents already in the library. It does NOT re-run
extraction of the document text itself.

⚠ WHAT IT CAN AND CANNOT REPAIR — state this plainly rather than implying a full cure:

  * **Metadata: fully repaired.** Re-derived from the stored text and written back.
  * **Chunk headers: repaired ONLY with --reembed.** The header is baked into the embedding
    vector at embed time. Rewriting metadata does not move an existing vector, so without
    `--reembed` the retrieval improvement does not appear. That flag re-embeds every chunk of
    the affected documents and COSTS MONEY.
  * **Vision transcription: NOT repaired here, at all.** A scanned PDF that produced no text
    has no text for this script to derive metadata from. Those documents must be re-uploaded
    or re-ingested through `/reingest`, which now runs the transcription. The script NAMES
    them at the end rather than silently skipping them.

USAGE (from `backend/`, with the venv active):

    python scripts/backfill_missing_metadata.py --dry-run          # show what would change
    python scripts/backfill_missing_metadata.py --since 2026-09-04 # repair metadata
    python scripts/backfill_missing_metadata.py --since 2026-09-04 --reembed

⚠ `--dry-run` is the DEFAULT-SAFE entry point and writes nothing. Run it first.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

# Run from anywhere: put `backend/` on the path so `app.*` resolves the same way it does
# under uvicorn. Sibling probe scripts rely on being invoked with backend/ as cwd; this one
# is an operator tool and should not have that trap.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("backfill")


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--since",
        default=None,
        help="ISO date (YYYY-MM-DD). Only documents created on/after this are considered. "
             "Defaults to the Phase 230 cutover day.",
    )
    p.add_argument("--dry-run", action="store_true", help="Report only; write nothing.")
    p.add_argument(
        "--reembed",
        action="store_true",
        help="Also re-embed each repaired document's chunks so the new context header is "
             "actually in the vectors. COSTS MONEY — off by default.",
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="Process documents even if they already HAVE metadata. Needed to run --reembed "
             "as a second pass: once metadata is repaired the rows no longer match the "
             "missing-metadata filter, so a later --reembed run would find nothing to do.",
    )
    p.add_argument("--limit", type=int, default=0, help="Stop after N documents (0 = all).")
    return p.parse_args(argv)


def _needs_metadata(doc: dict) -> bool:
    """A document counts as missing metadata when nothing a human would recognise is set.

    ⚠ `_`-prefixed keys DO NOT COUNT. `metadata.source` is stamped by the ingress door on
      every connector import, so a row can carry `{"source": {...}}` and still have no title,
      no date and no type — which is exactly the shape this bug produces for a Drive import.
      Treating a non-empty dict as "has metadata" would skip precisely the affected rows.
    """
    meta = doc.get("metadata")
    if not isinstance(meta, dict):
        return True
    visible = {k: v for k, v in meta.items() if not k.startswith("_") and k != "source"}
    return not any(v for v in visible.values())


def main(argv: list[str]) -> int:
    args = _parse_args(argv)

    from app.dependencies import get_supabase
    from app.models.user_settings import load_app_settings
    from app.services.ingest_enrich import enrich_for_ingest

    since = args.since or "2026-09-04"
    try:
        datetime.fromisoformat(since).replace(tzinfo=timezone.utc)
    except ValueError:
        log.error("--since must be an ISO date like 2026-09-04, got %r", since)
        return 2

    # Service-role client: the backfill reads and writes across users by design.
    supabase = get_supabase()
    app_settings = load_app_settings()

    resp = (
        supabase.table("documents")
        .select("id,filename,mime_type,metadata,full_markdown,user_id,status,created_at")
        .eq("status", "completed")
        .gte("created_at", since)
        .order("created_at", desc=False)
        .execute()
    )
    rows = list(resp.data or [])
    # ⚠ `--force` EXISTS BECAUSE THE FIRST DESIGN HAD A HOLE, found by running it: after a
    #   repair pass the rows carry metadata, so a follow-up `--reembed` matched NOTHING and
    #   reported "repaired: 0" while the chunk vectors still had no header. The two halves of
    #   the fix are separable in cost, so they must be separable in invocation too.
    candidates = rows if args.force else [d for d in rows if _needs_metadata(d)]

    log.info(
        "%d completed documents since %s; %d %s",
        len(rows), since, len(candidates),
        "selected (--force: metadata state ignored)" if args.force else "are missing metadata",
    )
    if args.limit:
        candidates = candidates[: args.limit]

    repaired, no_text, failed = 0, [], []

    for doc in candidates:
        doc_id = doc["id"]
        text = doc.get("full_markdown") or ""
        name = doc.get("filename") or doc_id

        if not text.strip():
            # ⚠ NAMED, NEVER SILENTLY SKIPPED. These are the scans and drawings: the queue
            #   produced no text for them, so there is nothing here to derive metadata from.
            #   They need a re-ingest, which now transcribes them.
            no_text.append(name)
            continue

        if args.dry_run:
            log.info("[dry-run] would repair %s (%d chars)", name, len(text))
            repaired += 1
            continue

        try:
            # ⚠ raw=b"" ON PURPOSE. The original bytes are in storage, not in this row, so no
            #   vision pass, table pass or DXF takeoff can run here. Passing empty bytes makes
            #   `enrich_for_ingest` skip exactly those steps rather than pretending to do them.
            enriched = enrich_for_ingest(
                document_id=doc_id,
                text=text,
                raw=b"",
                mime_type=doc.get("mime_type") or "",
                filename=doc.get("filename") or "",
                user_id=doc.get("user_id") or "",
                supabase=supabase,
                app_settings=app_settings,
            )
        except Exception as exc:  # noqa: BLE001 — one document must not stop the batch
            log.warning("enrichment failed for %s: %s", name, exc)
            failed.append(name)
            continue

        if enriched.metadata is None:
            log.warning("no metadata derived for %s — left unchanged", name)
            failed.append(name)
            continue

        try:
            supabase.table("documents").update(
                {"metadata": enriched.metadata}
            ).eq("id", doc_id).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("metadata write failed for %s: %s", name, exc)
            failed.append(name)
            continue

        repaired += 1
        title = (enriched.metadata or {}).get("title") or "(no title derived)"
        log.info("repaired %s -> %s", name, title)

        if args.reembed:
            _reembed(supabase, doc_id, doc.get("user_id") or "", enriched, app_settings)

    print()
    print(f"  repaired            : {repaired}")
    print(f"  failed              : {len(failed)}")
    print(f"  no text to work from: {len(no_text)}")
    if no_text:
        print()
        print("  !! These produced NO TEXT, so metadata cannot be derived from what is stored.")
        print("    They are the scans / drawings / images. Re-ingest them to transcribe:")
        for n in no_text[:40]:
            print(f"      - {n}")
        if len(no_text) > 40:
            print(f"      … and {len(no_text) - 40} more")
    if not args.reembed and repaired:
        print()
        print("  !! Chunk headers were NOT updated - the header lives inside the embedding")
        print("    vector, so re-run with --reembed to get the retrieval improvement too.")
    return 0


def _reembed(supabase, doc_id: str, user_id: str, enriched, app_settings) -> None:
    """Re-embed a document's chunks so the new context header reaches the vectors.

    ⚠ SEPARATE AND OPT-IN because it is the expensive half. Rewriting `documents.metadata`
      costs nothing; re-embedding every chunk of every repaired document is a real bill.
    """
    from app.services.embedding_service import embed_chunks

    try:
        rows = (
            supabase.table("document_chunks")
            .select("id,content,chunk_index")
            .eq("document_id", doc_id)
            .order("chunk_index", desc=False)
            .execute()
        ).data or []
        if not rows:
            return

        header = enriched.context_header
        model = app_settings.embedding_model or "text-embedding-3-small"
        texts = [(header + r["content"]) if header else r["content"] for r in rows]
        vectors = embed_chunks(texts, model=model, user_settings=app_settings)

        for row, vec in zip(rows, vectors):
            supabase.table("document_chunks").update({"embedding": vec}).eq(
                "id", row["id"]
            ).execute()
        log.info("  re-embedded %d chunks", len(rows))
    except Exception as exc:  # noqa: BLE001
        log.warning("  re-embed failed for %s: %s", doc_id, exc)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
