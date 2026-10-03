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

import dataclasses
import json
import logging
from typing import TYPE_CHECKING, Any, Literal, Sequence, get_args

from pydantic import BaseModel, ConfigDict, ValidationError

from app.models.document_search import _is_iso_day
from app.models.document_view import ViewCondition
from app.services.audit_service import write_audit_entry
from app.services.retrieval_scope import canonical_stored_values
from app.services.retrieval_service import search_documents

if TYPE_CHECKING:
    from app.services.tool_dispatcher import ToolContext, ToolResult

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════════════════════
# 272-04 Task 1 — parse, validate and canonicalise `filters` (D-03 / D-04 / D-05 / D-20 / D-26)
# ═════════════════════════════════════════════════════════════════════════════════════════════
#
# ⛔ ONE dialect (D-03): `filters` IS Find's condition list and the legacy `metadata_filter` is
#   mapped onto `eq` conditions here — both then go through the 271 compiler (via 272-03's
#   resolver). Nothing in this module compiles a condition.
# ⛔ Import-cycle rule (Pitfall 5): document_view_resolver / document_search_service /
#   view_filter_compiler are imported FUNCTION-LOCALLY only (fenced by test_272_filter_validation).

# D-03 — the operator vocabulary is DERIVED from ViewCondition.op, never retyped (a test asserts
# set equality), so a widened compiler Literal widens the tool's parse with it.
_VIEW_OPS: tuple[str, ...] = get_args(ViewCondition.model_fields["op"].annotation)
_SearchOp = Literal[_VIEW_OPS]  # type: ignore[valid-type]

# Find's three timestamptz date words (FindDate, resolved BEFORE the compiler — Pitfall 14: a custom
# def keyed like one of them is shadowed by the date word). ``date`` — the document's OWN date and
# the default for any period (D-05) — is NOT here: it is the compiler field ``date_typed``.
DATE_WORDS: tuple[str, ...] = ("added", "source_created", "source_modified")
_DATE_WORD_OPS: tuple[str, ...] = ("before", "after", "between", "within_next", "older_than")
_DOCUMENT_DATE_OPS: tuple[str, ...] = ("eq", "gte", "lte", "is_empty") + _DATE_WORD_OPS
_SCALAR_OPS: frozenset[str] = frozenset({"eq", "gte", "lte", "before", "after", "contains"})
_UNITS: tuple[str, ...] = ("days", "weeks", "months")
# Pitfall 12 — the rule a non-ISO date operand is refused with (a PostgREST 400 would otherwise
# read as "retrieval unavailable").
_ISO_RULE = (
    "write days as YYYY-MM-DD; for a month or a quarter use between with two YYYY-MM-DD days "
    "(e.g. 2025-10-01 and 2025-10-31)"
)
# 271 WR-04 — `.in_()` does not escape these inside a value, so a spelling carrying one never
# rides `one_of`.
_IN_UNSAFE = ('"', ",", "(", ")")


class SearchCondition(BaseModel):
    """One ``filters`` entry — 272-02's argument contract (``{field, op, value, value2, values, unit}``)."""

    model_config = ConfigDict(extra="ignore")

    field: str
    op: _SearchOp
    value: str | int | float | bool | None = None
    value2: str | int | float | None = None
    values: list[str | int | float] | None = None
    unit: Literal["days", "weeks", "months"] | None = None


@dataclasses.dataclass(frozen=True)
class FilterRefusal:
    """A filter the tool will not run, with the values the model could use instead (D-04)."""

    field: str
    message: str
    allowed: list[str] = dataclasses.field(default_factory=list)


def _parse_condition(entry: Any) -> SearchCondition | FilterRefusal:
    if not isinstance(entry, dict):
        return FilterRefusal(
            "filters",
            'Each filter must be an object such as {"field": "date", "op": "between", '
            '"value": "2025-10-01", "value2": "2025-10-31"}. Retry with that shape.',
        )
    field = entry.get("field")
    if not isinstance(field, str) or not field.strip():
        return FilterRefusal("filters", "Each filter needs a `field` naming what to filter on. Retry with one.")
    if entry.get("op") in (None, ""):
        return FilterRefusal(
            field,
            f"The filter on {field} has no `op`. Use one of: {', '.join(_VIEW_OPS)}.",
            list(_VIEW_OPS),
        )
    try:
        return SearchCondition.model_validate(entry)
    except ValidationError as exc:
        loc = exc.errors()[0].get("loc") or ("",)
        if loc[0] == "op":
            return FilterRefusal(
                field,
                f"'{entry.get('op')}' is not a filter operator. Valid operators: {', '.join(_VIEW_OPS)}.",
                list(_VIEW_OPS),
            )
        if loc[0] == "unit":
            return FilterRefusal(
                field, f"`unit` must be one of: {', '.join(_UNITS)}.", list(_UNITS),
            )
        return FilterRefusal(
            field, f"The filter on {field} is malformed ({exc.errors()[0].get('msg')}). Retry with plain values.",
        )


def parse_filter_args(args: dict) -> list[SearchCondition] | FilterRefusal:
    """``filters`` → conditions, then ``metadata_filter`` pairs appended as ``eq`` conditions (D-03).

    Neither present → ``[]`` (no filter). A malformed argument → a :class:`FilterRefusal`.
    """
    conditions: list[SearchCondition] = []
    raw = args.get("filters")
    if raw is not None:
        if not isinstance(raw, list):
            return FilterRefusal(
                "filters",
                "`filters` must be a list of conditions, each like "
                '{"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}. Retry with a list.',
            )
        for entry in raw:
            parsed = _parse_condition(entry)
            if isinstance(parsed, FilterRefusal):
                return parsed
            conditions.append(parsed)
    legacy = args.get("metadata_filter")
    if legacy:
        if not isinstance(legacy, dict):
            return FilterRefusal(
                "metadata_filter",
                "`metadata_filter` must be an object of {field: value} pairs; prefer `filters`.",
            )
        for key, value in legacy.items():
            entry = (
                {"field": key, "op": "one_of", "values": value}
                if isinstance(value, list)
                else {"field": key, "op": "eq", "value": value}
            )
            parsed = _parse_condition(entry)
            if isinstance(parsed, FilterRefusal):
                return parsed
            conditions.append(parsed)
    return conditions


def _as_dict(c: SearchCondition) -> dict:
    out: dict = {"field": c.field, "op": c.op}
    for key in ("value", "value2", "values", "unit"):
        v = getattr(c, key)
        if v is not None:
            out[key] = list(v) if key == "values" else v
    return out


def _whole_number(v: Any) -> int | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v if v >= 0 else None
    if isinstance(v, float) and v.is_integer() and v >= 0:
        return int(v)
    if isinstance(v, str) and v.strip().isdigit():
        return int(v.strip())
    return None


def _number(v: Any) -> int | float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        s = v.strip()
        try:
            return int(s)
        except ValueError:
            pass
        try:
            f = float(s)
        except ValueError:
            return None
        return f if f == f and f not in (float("inf"), float("-inf")) else None
    return None


def _date_condition(d: dict, label: str) -> dict | FilterRefusal:
    """D-05 / Pitfall 12 — date operands are ISO days; relative spans are whole numbers + a unit."""
    field, op = d["field"], d["op"]
    if op in ("within_next", "older_than"):
        n = _whole_number(d.get("value"))
        if n is None:
            return FilterRefusal(
                field, f"{op} on {label} needs a whole number in `value` (e.g. 7), not '{d.get('value')}'.",
            )
        if d.get("unit") is None:
            return FilterRefusal(field, f"{op} on {label} needs `unit`: one of {', '.join(_UNITS)}.", list(_UNITS))
        d["value"] = n
        return d
    if op == "is_empty":
        return d
    operands = [d.get("value")] + ([d.get("value2")] if op == "between" else [])
    bad = next((v for v in operands if not _is_iso_day(v)), None)
    if bad is not None or any(v is None for v in operands):
        return FilterRefusal(field, f"{label} needs a day, not '{bad}': {_ISO_RULE}.")
    return d


def _pick_spelling(value: str, spellings: list[str]) -> dict:
    """D-20 — the stored spelling(s) of a free custom string, as condition operands."""
    if len(spellings) == 1:
        return {"op": "eq", "value": spellings[0]}
    if any(ch in s for s in spellings for ch in _IN_UNSAFE):
        # 271 WR-04: `.in_()` would split / mis-quote this value — one exact containment instead,
        # the exact-case spelling when there is one, else the first stored spelling.
        return {"op": "eq", "value": value if value in spellings else spellings[0]}
    return {"op": "one_of", "values": list(spellings)}


async def validate_and_canonicalise(
    conditions: Sequence[SearchCondition],
    *,
    user_id: str,
    supabase: Any,
    defs: Sequence[dict],
    whitelist: set[str],
    number_fields: set[str],
) -> list[dict] | FilterRefusal:
    """Every condition either canonicalised to what the stored data holds, or refused (D-04 / D-20).

    ``defs`` are the caller's field definitions (own + system-global, ``list_field_definitions``
    unchanged — D-26); ``whitelist`` / ``number_fields`` are ``_build_field_meta``'s, the same
    allowed-field source the compiler re-checks against. Built-in ``title`` / ``author`` /
    ``summary`` / ``document_type`` / ``language`` pass through: the compiler already matches them
    case-insensitively (ilike / lowercased eq).
    """
    custom = {
        d["field_key"]: d for d in defs
        if d.get("enabled") and d.get("field_key") and d["field_key"] not in DATE_WORDS
    }
    valid_fields = set(whitelist) | {"date"} | set(DATE_WORDS)
    out: list[dict] = []
    for c in conditions:
        d = _as_dict(c)
        field, op = d["field"], d["op"]
        if op in _SCALAR_OPS and d.get("value") in (None, ""):
            return FilterRefusal(field, f"The {op} filter on {field} needs a `value`.")
        if op == "one_of" and not d.get("values"):
            return FilterRefusal(field, f"The one_of filter on {field} needs a non-empty `values` list.")
        if op == "between" and (d.get("value") in (None, "") or d.get("value2") in (None, "")):
            return FilterRefusal(
                field, f"between on {field} needs both `value` (the start) and `value2` (the end), as YYYY-MM-DD days.",
            )

        # Date words first (Pitfall 14), then the document's own date (D-05).
        if field in DATE_WORDS:
            if op not in _DATE_WORD_OPS:
                return FilterRefusal(
                    field,
                    f"{field} is a date: use before, after or between with YYYY-MM-DD days, or "
                    f"within_next / older_than with a whole number and a unit — not {op}.",
                    list(_DATE_WORD_OPS),
                )
            r = _date_condition(d, field)
            if isinstance(r, FilterRefusal):
                return r
            out.append(r)
            continue
        if field == "date":
            if op not in _DOCUMENT_DATE_OPS:
                return FilterRefusal(
                    field, f"date (the document's own date) does not take {op}; use between, before or after.",
                    list(_DOCUMENT_DATE_OPS),
                )
            r = _date_condition(d, "date (the document's own date)")
            if isinstance(r, FilterRefusal):
                return r
            out.append(r)
            continue

        if field not in valid_fields:
            allowed = sorted(valid_fields)
            return FilterRefusal(
                field,
                f"There is no field named '{field}'. Valid fields: {', '.join(allowed)}. "
                "Retry with one of them, or ask which was meant.",
                allowed,
            )

        defn = custom.get(field)
        ftype = (defn or {}).get("field_type")
        if defn is not None and ftype == "enum":
            options = [str(o) for o in (defn.get("options") or [])]
            by_lower = {o.lower(): o for o in options}

            def _enum(v: Any) -> str | None:
                return by_lower.get(str(v).strip().lower())

            if op == "eq" or op == "contains":
                hit = _enum(d["value"])
                if hit is None:
                    return FilterRefusal(
                        field,
                        f"{field} has no value '{d['value']}'. Valid values: {', '.join(options)}. "
                        "Retry with one of them, or ask which was meant.",
                        options,
                    )
                d["value"] = hit
            elif op == "one_of":
                mapped = [_enum(v) for v in d["values"]]
                missing = [v for v, m in zip(d["values"], mapped) if m is None]
                if missing:
                    return FilterRefusal(
                        field,
                        f"{field} has no value '{missing[0]}'. Valid values: {', '.join(options)}. "
                        "Retry with one of them, or ask which was meant.",
                        options,
                    )
                d["values"] = mapped
        elif defn is not None and (ftype == "number" or field in number_fields):
            for key in ("value", "value2"):
                if key in d:
                    n = _number(d[key])
                    if n is None:
                        return FilterRefusal(field, f"{field} is a number field; '{d[key]}' is not a number.")
                    d[key] = n
            if "values" in d:
                nums = [_number(v) for v in d["values"]]
                if any(n is None for n in nums):
                    return FilterRefusal(field, f"{field} is a number field; every value must be a number.")
                d["values"] = nums
        elif defn is not None and ftype == "boolean" and op == "eq":
            b = {"true": True, "yes": True, "false": False, "no": False}.get(str(d["value"]).strip().lower())
            if b is None:
                return FilterRefusal(field, f"{field} is true or false, not '{d['value']}'.", ["true", "false"])
            d["value"] = b
        elif defn is not None and ftype in (None, "string") and op == "eq" and isinstance(d["value"], str):
            # D-20 — the compiler's custom `eq` is a CASE-SENSITIVE `@>` containment, so the value is
            # replaced by the stored spelling(s) read under the caller's RLS (272-03).
            try:
                spellings = await canonical_stored_values(user_id=user_id, field=field, value=d["value"])
            except Exception:  # noqa: BLE001 — best effort: an unread spelling keeps the value as given
                logger.warning("search_documents: stored spellings of %r could not be read", field, exc_info=True)
                spellings = []
            if spellings:
                picked = _pick_spelling(d["value"], spellings)
                d.pop("value", None)
                d.update(picked)
        out.append(d)
    return out


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
