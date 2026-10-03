"""Phase 272 (D-15) — the ``search_documents`` tool handler, moved VERBATIM out of ``tool_dispatcher.py``.

The narrow cut: search_documents' handler, its audit write and (272-04) the D-09 retry lock live
here; the full registry/handler split of tool_dispatcher.py stays OWED and is flagged for Phase 273.

``tool_dispatcher`` keeps the ONE registry line (``"search_documents": _handle_search_documents``)
and re-exports this handler under that old private name, so every caller and every
``inspect.getsource(td._handle_search_documents)`` still resolves. ``tests/unit/test_272_search_tool_move.py``
proves the body is AST-identical to the PHASE_BASE handler apart from its name and the
function-local ``ToolResult`` import below.

⚠ PATCH-WHERE-USED: the handler resolves ``search_documents`` and ``write_audit_entry`` from THIS
module now. A test that patches ``app.services.tool_dispatcher.search_documents`` no longer
reaches it — patch ``app.services.search_documents_tool.<name>``.

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). ``ToolContext`` is a type-only import; ``ToolResult`` is
imported inside the handler.
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from app.services.audit_service import write_audit_entry
from app.services.retrieval_service import search_documents

if TYPE_CHECKING:
    from app.services.tool_dispatcher import ToolContext, ToolResult

logger = logging.getLogger(__name__)


async def handle_search_documents(args: dict, ctx: ToolContext) -> ToolResult:
    # Function-local on purpose (D-15 / T-272-03): tool_dispatcher imports THIS module at load,
    # so a module-level import of it would cycle. By call time the dispatcher is fully loaded.
    from app.services.tool_dispatcher import ToolResult

    metadata_filter = args.get("metadata_filter") or None
    try:
        results, avg_sim = await search_documents(
            args["query"], ctx.current_user["id"], ctx.supabase,
            metadata_filter=metadata_filter,
            user_settings=ctx.user_settings,
            folder_ids=ctx.folder_subtree_ids,
        )
    except Exception as exc:  # noqa: BLE001 — honest tool-result error, never raise into the loop
        # BUG-260815-05 — A SEARCH THAT COULD NOT RUN MUST NOT READ AS A SEARCH THAT
        # FOUND NOTHING. Measured 2026-08-15: the OpenAI balance hit zero, every
        # `search_documents` raised `RateLimitError insufficient_quota` from the QUERY
        # embedding (`retrieval_service._vector_search:73` -> `openai_service.embed_texts`),
        # and the operator was told, three golden runs in a row and by the only surface
        # they had, *"citations_required: nothing was retrieved (0 sources) — this step
        # reads your documents and must show where its answer came from"*. That sentence
        # sent them to re-check their documents, their folder and their prompt, all of
        # which were correct: 5 docs, 18 chunks, 0 null embeddings, matching org_id.
        #
        # ⚠ EVERY document in this product is embedded with an OpenAI model, so EVERY
        # search must embed its query at retrieval time. Embedding is the one path with
        # no provider fallback (chat routes across seven providers; embedding does not).
        # A zero balance therefore silently zeroes retrieval for the WHOLE knowledge
        # base — the blast radius is not one workflow.
        #
        # ⚠ THIS IS THE `resolve_template_placeholders` SHAPE (Phase 193.1, D-26), NOT a
        # new invention: *could not read* and *nothing to read* must never share a
        # message. The value here is the honest third state.
        #
        # ⚠ The exception is CONVERTED, never re-raised. `agent_loop`'s generic
        # `except Exception -> "Tool error: ..."` (`agent_loop.py:2598`) already caught
        # it, but that string is addressed to the MODEL; it is not a retrieval verdict
        # and it does not reach the phase record the author reads. Returning an explicit
        # unavailable result puts the reason where a person will meet it.
        logger.error("search_documents failed for run %s: %s", getattr(ctx, "run_id", None), exc)
        from app.services.openai_service import resolve_effective_embedding_provider
        provider = resolve_effective_embedding_provider(getattr(ctx, "user_settings", None))
        # BE-4 (217.1 / LIB-06 / D-217.1-34): a provider outage must be VISIBLE in the
        # analytics. Without this write, a failed search is indistinguishable from "your
        # library had no answer" — every `search.query` reader would count it (or not)
        # exactly like a real search that found nothing. The row carries `document_ids: []`
        # and the classified `retrieval_status: "provider_error"` literal — NEVER `str(exc)`,
        # which stays in the ToolResult.retrieval_error response object (T-217.1-15b).
        # THE WRITE IS FIRE-AND-FORGET DIAGNOSTICS AND MUST NOT BE ABLE TO KILL THE
        # HONEST RESULT BELOW - which is exactly what it did. 217.1-11 added this call
        # and the four Phase 210 tests that guard RAG-09 went RED with
        # "'ToolContext' object has no attribute 'spawn'", raised from INSIDE the
        # except arm: the AttributeError propagated past the `return`, so a provider
        # outage stopped producing `retrieval_unavailable` at all and raised into the
        # agent loop instead - the precise outcome the test named
        # `..._does_not_raise_into_the_agent_loop` exists to forbid.
        #
        # The ordering is the fix: an analytics row is worth having, and it is worth
        # strictly less than the sentence that tells a person their library could not be
        # searched. So the failure is logged and swallowed HERE, and nowhere else.
        try:
            ctx.spawn(write_audit_entry(
                user_id=ctx.current_user["id"],
                action_type="search.query",
                metadata={
                    "query_text": args["query"],
                    "document_ids": [],
                    "retrieval_status": "provider_error",
                    # Phase 268 (D-268-13): the run join keys — see the success write below.
                    "run_id": str(ctx.run_id),
                    "thread_id": str(ctx.thread_id),
                    "parent_run_id": str(ctx.parent_run_id) if ctx.parent_run_id else None,
                    "folder_ids": [str(f) for f in (ctx.folder_subtree_ids or [])],
                },
                supabase=ctx.supabase,
            ))
        except Exception:  # noqa: BLE001 - diagnostics may never mask the outage
            logger.warning(
                "search_documents: the provider-error audit row could not be scheduled; "
                "the retrieval failure itself is still reported", exc_info=True,
            )
        return ToolResult(
            result=json.dumps({
                "error": "retrieval_unavailable",
                "provider": provider,
                "detail": (
                    f"The document search could not run — the search provider ({provider}) returned: {exc}. "
                    "This is NOT a result of zero matches: your documents were never queried. "
                    "Say plainly that document search is unavailable; do not state or imply "
                    "that the knowledge base contains no relevant information."
                ),
            }),
            citations=[],
            source_refs=[],
            retrieval_error={
                "provider": provider,
                "detail": str(exc),
                "retrieval_status": "provider_error",
            },
        )
    # Phase 098 GOV-01 (SC#3 ⊆ assert + SC#4 clip + observable) — the loud runtime
    # backstop. The RPC p_folder_ids filter is the PRIMARY enforcement; this post-query
    # clip is the in-app guard for bugs / future tool paths (D-05/D-06). Gated on
    # `folder_subtree_ids is not None` so the shared search path is byte-identical for
    # Deep whole-KB (D-05a — mirrors _handle_glob:145); the additive folder_id enrich
    # key is inert when this block is skipped.
    if ctx.folder_subtree_ids is not None:
        _scope = set(map(str, ctx.folder_subtree_ids))   # Pitfall 1: set()-ify LOCALLY; the ctx channel stays a list
        _kept = [h for h in (results or []) if str(h.get("folder_id")) in _scope]
        _dropped = [h for h in (results or []) if str(h.get("folder_id")) not in _scope]
        if _dropped:   # RPC p_folder_ids is the primary filter → ~always empty in a healthy run (Pitfall 4)
            results = _kept
            try:
                await ctx.emit(
                    ctx.redis, ctx.run_id, "scope_violation",
                    dropped=len(_dropped),
                    out_of_scope_folders=sorted({str(h.get("folder_id")) for h in _dropped}),
                    query=args["query"],
                )
            except Exception:   # best-effort (D-06) — an emit failure must NOT break a clean retrieval
                logger.exception("scope_violation emit failed for run %s", getattr(ctx, "run_id", None))
    tool_result = json.dumps(results) if results else "No relevant documents found."

    source_refs: list[dict] = []
    citations: list[dict] = []
    similarity_score: float | None = None

    # Accumulate full citation objects for citations event (D-04, D-14)
    if results and isinstance(results, list):
        for hit in results:
            doc_id = hit.get("document_id") or hit.get("id")
            filename = hit.get("filename") or hit.get("document_name")
            if doc_id and filename:
                source_refs.append({"document_id": doc_id, "filename": filename})
                citations.append({
                    "document_id": doc_id,
                    "filename": filename,
                    "chunk_index": hit.get("chunk_index"),
                    "passage": hit.get("content"),  # Full text for persistence
                    "similarity": hit.get("similarity"),
                    "is_full_doc": False,
                    "version_number": hit.get("version_number", 1),
                    # Phase 231 TRUST-04 — a reader can tell machine-placed knowledge from
                    # knowledge somebody chose to upload. Both keys travel: the name is what
                    # gets rendered, the id is what survives a rename.
                    "source_connection_id": hit.get("source_connection_id"),
                    "source_connection_name": hit.get("source_connection_name"),
                })
        if avg_sim > 0.0:
            similarity_score = avg_sim

    # Phase 234 TRUST-03: Track if any returned citation came from an external connection
    if any(bool(c.get("source_connection_id")) for c in citations):
        try:
            ctx.has_connection_retrieval = True
        except Exception:
            pass

    # Audit: fire-and-forget inside async generator (AUDIT-02)
    _audit_doc_ids = list({
        h.get("document_id") or h.get("id")
        for h in (results or [])
        if h.get("document_id") or h.get("id")
    })
    # BE-5 (217.1 / LIB-07): persist the per-hit similarity the retrieval ALREADY returns
    # (retrieval_service.py:173 — it was being thrown away before reaching audit_log.metadata,
    # so `Average relevance` could only lie about a value the system has). Max similarity per
    # document (a document can contribute several chunks), rounded to 3 dp — matching
    # _fetch_low_confidence_queries' existing convention (knowledge_health.py:302).
    _sims: dict[str, float] = {}
    for h in (results or []):
        _did = h.get("document_id") or h.get("id")
        _s = h.get("similarity")
        if _did and isinstance(_s, (int, float)):
            _sims[_did] = max(_sims.get(_did, 0.0), round(float(_s), 3))
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="search.query",
        metadata={
            "query_text": args["query"],
            "document_ids": _audit_doc_ids,
            "similarities": _sims,
            # Phase 268 (D-268-13, additive): SC#3's "retrieved-chunk records" do not exist, so
            # every search row carries the keys that join it to its run — the ROOT run too, for a
            # sub-agent — and the scope actually handed to retrieval, evidence independent of the
            # result set. Readers only .get() known keys (api/audit.py, knowledge_health.py).
            "run_id": str(ctx.run_id),
            "thread_id": str(ctx.thread_id),
            "parent_run_id": str(ctx.parent_run_id) if ctx.parent_run_id else None,
            "folder_ids": [str(f) for f in (ctx.folder_subtree_ids or [])],
        },
        supabase=ctx.supabase,
    ))

    return ToolResult(
        result=tool_result,
        source_refs=source_refs,
        citations=citations,
        similarity_score=similarity_score,
    )
