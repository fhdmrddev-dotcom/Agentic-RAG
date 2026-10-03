"""Phase 272 (D-13) — document readers, moved VERBATIM out of ``retrieval_service.py``.

Part of discharging the ``retrieval_service.py`` extraction that had been owed since Phase 231 (SEED-224);
``tests/unit/test_272_pure_move.py`` proves each function is AST-identical to its PHASE_BASE source.

Hit enrichment (filename / version / folder / connection provenance), filename → document id
resolution, and the full-document read ``analyze_document`` uses. ⛔ **What this module is NOT:**
it does not search and it does not decide who may read what — the retrieval RPCs and RLS do that.
The owner-scoped ``fetch_full_document`` FINDING (a fifth retrieval path, fail-closed) moved with
it unchanged and is still routed to a reviewer, not silently taken.
"""
from __future__ import annotations

from supabase import Client

from app.utils.db import aexec


async def _enrich_with_filenames(rows: list[dict], supabase: Client) -> list[dict]:
    if not rows:
        return []
    doc_ids = list({row["document_id"] for row in rows})
    docs_result = await aexec(
        supabase.table("documents")
        # Phase 231 TRUST-04 — `source_connection_id` joins the same additive projection
        # `folder_id` uses. It is the fact that distinguishes machine-placed knowledge from
        # knowledge somebody chose to upload, and a citation cannot carry what the read omits.
        .select("id, filename, metadata, version_number, folder_id, source_connection_id")
        .in_("id", doc_ids)
    )
    doc_map = {doc["id"]: doc for doc in (docs_result.data or [])}

    # Phase 231 TRUST-04 — resolve connection NAMES, not ids: "placed by Google Drive" is the
    # fact a reader can act on; a uuid is not.
    # ⚠ ONE extra query, and ONLY when a hit actually came from a connection. In a corpus with
    #   no connections — every corpus today — this costs nothing and the shape is unchanged.
    # ⚠ A name that cannot be resolved (deleted connection, or one this reader may not see) is
    #   left as None and the surface says "a connection" rather than inventing one. D-4 sets
    #   source_connection_id to NULL on delete, so an unresolved id is a real state, not an error.
    conn_ids = list({
        doc.get("source_connection_id")
        for doc in doc_map.values()
        if doc.get("source_connection_id")
    })
    conn_names: dict[str, str] = {}
    if conn_ids:
        conn_result = await aexec(
            supabase.table("connector_connections").select("id, name").in_("id", conn_ids)
        )
        conn_names = {c["id"]: c.get("name") or "" for c in (conn_result.data or [])}

    enriched = []
    for row in rows:
        doc = doc_map.get(row["document_id"], {})
        entry: dict = {
            "content": row["content"],
            "document_id": row["document_id"],
            "filename": doc.get("filename", "Unknown"),
            "chunk_index": row.get("chunk_index"),
            "similarity": row.get("similarity") or row.get("rrf_score") or row.get("rank") or 0.0,
            "version_number": doc.get("version_number", 1),
            # Phase 098 GOV-01 — additive folder_id for the post-query ⊆ scope clip
            # (Deep-inert: Deep consumers never read it; the return shape is unchanged).
            "folder_id": doc.get("folder_id"),
            # Phase 231 TRUST-04 — provenance travels with the hit, so the citation built
            # downstream carries the same fact the Library shows.
            "source_connection_id": doc.get("source_connection_id"),
            "source_connection_name": conn_names.get(doc.get("source_connection_id") or ""),
        }
        if doc.get("metadata"):
            entry["metadata"] = doc["metadata"]
        enriched.append(entry)
    return enriched


async def resolve_document_id(filename: str, user_id: str, supabase: Client) -> str | None:
    """Case-insensitive filename lookup for a user's document (latest version only). Tries exact match then partial match."""
    # Exact case-insensitive match — only resolve to the latest version
    result = await aexec(
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .ilike("filename", filename)
        .limit(1)
    )
    if result.data:
        return result.data[0]["id"]
    # Partial match (allows approximate filenames like "Elitefooty PRD")
    result = await aexec(
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .ilike("filename", f"%{filename}%")
        .limit(1)
    )
    if result.data:
        return result.data[0]["id"]
    return None


async def resolve_document(filename: str, user_id: str, supabase: Client) -> dict | None:
    """``resolve_document_id``'s lookup, returning ``{"id", "filename"}`` — the RESOLVED name.

    Phase 273-REVIEW WR-03: a tool that resolves a model-typed name (``query_tables``) must report
    the document it actually read, not echo the model's spelling — the show_artifact caption is
    built from that result and D-04 says it is never written by the model. Same two queries, same
    order, as ``resolve_document_id`` (which stays byte-identical for its existing callers).
    """
    for pattern in (filename, f"%{filename}%"):
        result = await aexec(
            supabase.table("documents")
            .select("id, filename")
            .eq("user_id", user_id)
            .eq("is_latest", True)
            .ilike("filename", pattern)
            .limit(1)
        )
        if result.data:
            return {"id": result.data[0]["id"], "filename": result.data[0].get("filename")}
    return None


async def fetch_full_document(document_id: str, user_id: str, supabase: Client) -> dict | None:
    """Fetch complete document content for the analyze_document sub-agent.

    Prefers `full_markdown` (the raw extracted text stored at ingest time) over
    concatenating chunks. Chunks now have context-enriched embeddings but store
    raw content, so either path produces clean text — but `full_markdown` avoids
    any repeated context headers if the chunk storage format ever changes.
    """
    # Phase 231 TRUST-04 — `source_connection_id` must be SELECTED here or the citation this
    # function feeds carries a key that is always None: a field written and never readable, which
    # is the same shape as Phase 230's `claimed_at` before its sweeper existed.
    #
    # ⚠ FINDING, DELIBERATELY NOT ACTED ON IN THIS PHASE — this read is OWNER-SCOPED
    #   (`.eq("user_id", user_id)`), so it is a FIFTH retrieval path and it does NOT honour the
    #   connection-scoped predicate the four sites now share. Consequence: a second org member
    #   can find an org-visible connection document through search, but `analyze_document` on it
    #   returns nothing.
    #   ✅ It fails CLOSED — narrower than the new rule, never wider — which is why it is a
    #      usability gap and not a leak, and why widening it is not urgent.
    #   ⛔ It is NOT widened here on purpose: the four sites moved together inside ONE transaction
    #      precisely so no fifth definition of "who may read this" could drift from them. Adding a
    #      fifth in Python, in a different commit, is the exact hazard H-1 is written against.
    #      Routed to the reviewer as a decision, not silently taken.
    doc_result = await aexec(
        supabase.table("documents")
        .select("id, filename, metadata, version_number, full_markdown, source_connection_id")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
    )
    if not doc_result.data:
        return None

    doc = doc_result.data

    # Use full_markdown when available (set during ingestion from the raw extracted text)
    full_text = doc.get("full_markdown") or ""
    if not full_text:
        # Fallback: reassemble from chunks (documents ingested before full_markdown was stored)
        chunks_result = await aexec(
            supabase.table("document_chunks")
            .select("content")
            .eq("document_id", document_id)
            .order("chunk_index")
        )
        full_text = "\n\n".join(c["content"] for c in (chunks_result.data or []))

    # Phase 231 TRUST-04 — resolve the connection's NAME here too, so the full-document citation
    # says the same thing as a search-hit citation. ⚠ ONE query, and only when this document
    # actually came from a connection.
    source_connection_id = doc.get("source_connection_id")
    source_connection_name = None
    if source_connection_id:
        conn_result = await aexec(
            supabase.table("connector_connections")
            .select("id, name")
            .eq("id", source_connection_id)
            .limit(1)
        )
        rows = conn_result.data or []
        # An unresolved name stays None — the surface then says "a connection" rather than
        # inventing one. D-4 nulls the id on delete, so this is a real state, not an error.
        source_connection_name = (rows[0].get("name") if rows else None) or None

    return {
        "document_id": doc["id"],
        "filename": doc["filename"],
        "metadata": doc.get("metadata"),
        "content": full_text,
        "source_connection_id": source_connection_id,
        "source_connection_name": source_connection_name,
    }
