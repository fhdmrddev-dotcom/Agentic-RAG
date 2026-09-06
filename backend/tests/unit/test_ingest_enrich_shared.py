"""BUG-260905-06 — the two ingest paths must run the SAME enrichment step.

⛔ THE BUG THIS FILE EXISTS FOR. Phase 229 built `splice_document` as the one ingest splice.
Phase 230 then added a durable queue *inside* it: given a `job_id` it stops delegating to
`ingest_document` and runs its own inline chunk/embed loop. That loop was written without the
metadata step, so from the cutover onward every uploaded document reached `completed` with no
title, no date, no document_type, no chunk context header, and no vision transcription.

⚠ 5,600 TESTS DID NOT CATCH IT, AND THE REASON IS THE LESSON. Both paths had tests. Neither
  test asserted that the two paths AGREE, so a step present in one and absent from the other
  was invisible to the whole suite. The operator found it by noticing that yesterday's
  uploads had blank metadata and older ones did not.

**The rule these tests encode:** when two code paths serve one user-visible outcome, test the
AGREEMENT, not each path separately. A per-path test can only ever prove a path does what it
does.
"""
from __future__ import annotations

import inspect
import re
from pathlib import Path

import pytest

from app.services.ingest_enrich import EnrichedIngest, enrich_for_ingest

_BACKEND = Path(__file__).resolve().parents[2]
_SPLICE = _BACKEND / "app" / "services" / "ingest_splice.py"
_DOCUMENTS = _BACKEND / "app" / "api" / "documents.py"
#: The ONE shared enrichment home both ingest paths call (BUG-260905-06 / BUG-260906-01).
_ENRICH = _BACKEND / "app" / "services" / "ingest_enrich.py"


def _source(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# ── The agreement fence ───────────────────────────────────────────────────────────────


def test_both_ingest_paths_call_the_shared_enrichment():
    """⭐ THE ONE TEST THAT WOULD HAVE CAUGHT THIS. Neither path may skip enrichment.

    ⚠ IT ASSERTS THE CALL, NOT THE MENTION, AND THAT DISTINCTION WAS MEASURED. The first
      version searched for the bare string `enrich_for_ingest`, and when the fix was reverted
      to re-create the original bug this test STAYED GREEN — because the explanatory comment
      above the call still contained the name. A fence satisfied by a comment is not a fence.

    ⚠ AND IT ACCEPTS BOTH CALL SHAPES, which a first attempt did not: `documents.py` calls
      `enrich_for_ingest(...)` directly, while the async queue path passes it as a REFERENCE
      to `run_in_threadpool(enrich_for_ingest, ...)`. A regex demanding a following `(`
      failed the correct code — the test was wrong, not the fix.
    """
    for path in (_SPLICE, _DOCUMENTS):
        src = _source(path)
        # Drop comments and the import line, so neither prose about the call nor the import
        # alone can stand in for actually using it.
        uses = [
            line for line in src.split("\n")
            if "enrich_for_ingest" in line
            and not line.lstrip().startswith("#")
            and not line.lstrip().startswith(("from ", "import "))
        ]
        assert uses, (
            f"{path.name} does not USE enrich_for_ingest — the metadata step is missing "
            f"from an ingest path again"
        )


def test_the_queue_path_awaits_enrichment_off_the_event_loop():
    """⚠ `run_in_threadpool` is load-bearing, not style.

    `enrich_for_ingest` calls `asyncio.run` internally. Calling it inline from the async
    queue worker raises `RuntimeError: asyncio.run() cannot be called from a running event
    loop`, and its own broad `except` degrades that to `metadata=None` — reintroducing this
    exact bug in a form that looks like a working call.
    """
    src = _source(_SPLICE)
    m = re.search(r"run_in_threadpool\(\s*\n\s*enrich_for_ingest\b", src)
    assert m is not None, (
        "the queue path must call enrich_for_ingest through run_in_threadpool"
    )


def test_the_queue_path_writes_the_metadata_it_derives():
    """Deriving metadata and not persisting it is the same outcome as never deriving it."""
    src = _source(_SPLICE)
    assert "enriched.metadata" in src
    assert re.search(r'update\(\s*\n?\s*\{\s*"metadata":\s*enriched\.metadata', src), (
        "the queue path derives metadata but never writes it to the documents row"
    )


def test_the_queue_path_embeds_the_context_header():
    """⚠ THE HEADER IS THE HALF THAT IS EASY TO LOSE SILENTLY.

    It is prepended to each chunk BEFORE embedding and never stored on the chunk row, so a
    path that forgets it produces chunks that look identical in the database and retrieve
    worse. It is what lets "amount paid on 17 Jan" match a receipt whose date exists only in
    its filename — and what carries a truncated document's INCOMPLETE notice into every chunk.
    """
    src = _source(_SPLICE)
    assert "context_header" in src, "the queue path builds no chunk context header"
    assert re.search(r"context_header \+ c\b", src), (
        "the queue path must embed header+chunk, not the bare chunk"
    )


def test_the_queue_path_embeds_the_header_but_stores_the_raw_chunk():
    """The stored `content` must stay clean — the header belongs in the vector only."""
    src = _source(_SPLICE)
    assert re.search(r'"content":\s*c\b', src), (
        "the chunk row must store the raw chunk, never the header-prefixed text"
    )


# ── The shared function's contract ────────────────────────────────────────────────────


def test_enrichment_returns_every_field_the_chunk_stage_needs():
    fields = set(EnrichedIngest.__dataclass_fields__)
    assert fields == {"text", "metadata", "context_header", "vision"}


def test_enrichment_is_sync_so_callers_must_thread_it():
    """If this ever becomes `async def`, the `run_in_threadpool` call sites break loudly
    rather than silently degrading — which is the failure mode we are escaping."""
    assert not inspect.iscoroutinefunction(enrich_for_ingest)


def test_enrichment_is_keyword_only_so_a_caller_cannot_transpose_arguments():
    sig = inspect.signature(enrich_for_ingest)
    positional = [
        p for p in sig.parameters.values()
        if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
    ]
    assert positional == [], "enrich_for_ingest must be keyword-only"
    assert "user_id" in sig.parameters, (
        "user_id is required — the custom-field definitions read is user-scoped"
    )


# ── The backfill's near-miss ──────────────────────────────────────────────────────────


class _Settings:
    metadata_enrichment_mode = "legacy"
    extraction_model = ""
    extraction_provider = ""
    extraction_window_cap = 32000
    llm_model = "gpt-4o-mini"
    llm_api_key = "sk-test"
    llm_base_url = None
    multimodal_max_vision_calls = 100
    vision_model = ""
    vision_max_pages = 50


class _FakeTable:
    def __init__(self):
        self._rows = []

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def single(self):
        return self

    def update(self, *_a, **_k):
        return self

    def execute(self):
        class R:
            data = None
        return R()


class _FakeSupabase:
    def table(self, _name):
        return _FakeTable()


def test_an_image_with_no_bytes_is_not_stamped_as_transcribed():
    """⛔ A REAL NEAR-MISS IN THE BACKFILL TOOL, caught before it ran.

    The backfill calls this with `raw=b""` because the bytes live in storage, not on the row.
    Without the `raw and` guard, an image row would be stamped
    `_vision = {engine: "vision", pages_transcribed: 1, advisory: true}` for a transcription
    that never happened. A provenance record claiming work nobody did is worse than none —
    it is the "cannot tell inferred from parsed" failure the stamp exists to prevent, inverted.
    """
    out = enrich_for_ingest(
        document_id="d1",
        text="some text that already exists",
        raw=b"",
        mime_type="image/png",
        filename="photo.png",
        user_id="u1",
        supabase=_FakeSupabase(),
        app_settings=_Settings(),
    )
    assert out.vision is None
    assert not (out.metadata or {}).get("_vision")


def test_enrichment_never_raises_when_everything_it_needs_is_missing():
    """Best-effort by contract: a document that would ingest without enrichment still does."""
    out = enrich_for_ingest(
        document_id="d2",
        text="",
        raw=b"",
        mime_type="",
        filename="",
        user_id="u1",
        supabase=_FakeSupabase(),
        app_settings=_Settings(),
    )
    assert isinstance(out, EnrichedIngest)
    assert out.text == ""


@pytest.mark.parametrize(
    "meta,expected",
    [
        (None, True),
        ({}, True),
        ({"source": {"system": "google"}}, True),   # ingress stamp only — still unenriched
        ({"_confidence": {"title": 0.9}}, True),    # underscore keys do not count
        ({"title": "Q3 report"}, False),
        ({"title": ""}, True),                      # present but empty is still missing
    ],
)
def test_backfill_recognises_a_document_that_needs_metadata(meta, expected):
    """⚠ `metadata.source` MUST NOT COUNT AS METADATA.

    The ingress door stamps it on every connector import, so an affected Drive document
    carries a non-empty dict while having no title, no date and no type. Treating "non-empty
    dict" as "has metadata" would skip precisely the rows this backfill exists to repair.
    """
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "_backfill", _BACKEND / "scripts" / "backfill_missing_metadata.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod._needs_metadata({"metadata": meta}) is expected


# ── BUG-260905-07 — a failed extraction must not destroy a good one ──────────────────


def test_a_failed_extraction_never_clears_existing_metadata():
    """⛔ DATA LOSS, OBSERVED BY THE OPERATOR ON A REAL RE-INGEST.

    Enrichment degrades to `None` on ANY failure — provider error, timeout, a model that
    would not emit — and every one of those is swallowed by design (D-111-8: "a metadata
    failure never breaks ingestion"). The completion write passed `"metadata": metadata_dict`
    unconditionally, so that None went straight over the row: a transient provider blip
    permanently erased a document's title, date, type and every custom field.

    ⚠ The degradation contract says a metadata failure must not BREAK the ingestion. It never
      said it may DELETE what was already there.
    """
    src = _source(_DOCUMENTS)
    assert '"metadata": metadata_dict,' not in src, (
        "the completion write must not pass metadata unconditionally — a None clears the row"
    )
    assert '**({"metadata": metadata_dict} if metadata_dict is not None else {})' in src, (
        "the completion write must only set metadata when something was actually derived"
    )


def test_both_paths_refuse_to_write_a_null_metadata():
    """⚠ THE TWO PATHS MUST AGREE ON THIS TOO.

    The queue path already guarded it (`if enriched.metadata is not None`). Leaving the
    legacy arm unguarded would have re-opened the same two-paths-disagree gap that
    BUG-260905-06 closed — in the opposite direction, and as silent data loss.
    """
    assert "if enriched.metadata is not None:" in _source(_SPLICE)
    assert "if metadata_dict is not None else {}" in _source(_DOCUMENTS)


# ── BUG-260905-08 — a document whose bytes were never stored must not report success ──


def test_a_storage_failure_refuses_instead_of_ingesting_nothing():
    """⛔ MEASURED ON THE OPERATOR'S LIBRARY, not imagined.

    `Screenshot 2026-05-29 042925.png` uploaded at 19:56, reached `status=completed` with
    `chunk_count=0`, an EMPTY `error_message`, and a 404 from storage on its own `file_path`.
    The storage upload had failed, been logged at WARNING, and the flow carried on to enqueue
    a job for a file that does not exist.

    Everything downstream needs those bytes — re-ingest, preview, download, and the SEED-226
    vision pass. A row that looks successful and is unusable is worse than a visible refusal.
    """
    src = _source(_DOCUMENTS)
    i = src.index("Storage upload during /upload FAILED")
    tail = src[i : i + 2000]
    assert '"status": "failed"' in tail, (
        "a failed storage upload must mark the document failed"
    )
    assert "error_message" in tail, "the refusal must say why, not leave an empty message"
    assert "return" in tail, (
        "the handler must RETURN after a storage failure — enqueueing a job for bytes that "
        "do not exist produces an empty document that still completes"
    )


def test_the_storage_failure_is_logged_as_an_error_not_a_warning():
    """A silent-by-severity failure is how this one survived: it was `log.warning`."""
    src = _source(_DOCUMENTS)
    i = src.index("Storage upload during /upload FAILED")
    assert "log.error(" in src[max(0, i - 400) : i + 200]


# ── The queue path must refuse the two empty outcomes, like the legacy path always has ──


def test_the_queue_path_refuses_a_document_with_no_bytes():
    """⛔ THE HALF OF BUG-260905-08 THE `/upload` FIX DID NOT COVER.

    `/upload` now refuses when the storage PUT fails. Nothing refused when the later GET came
    back empty — and that is the path a WATCH LOOP takes, because it mints rows for files
    nobody uploaded. A mint that forgets the upload made every watched file an empty document
    that reported success.
    """
    src = _source(_SPLICE)
    assert "_expected_bytes_from_storage" in src, (
        "the queue path must distinguish 'storage returned nothing' from 'caller passed no raw'"
    )
    i = src.index("_expected_bytes_from_storage and not raw")
    tail = src[i : i + 1200]
    assert '"status": "failed"' in tail
    assert "error_message" in tail


def test_a_caller_that_deliberately_passes_no_bytes_is_not_failed():
    """⚠ The backfill tool passes `raw=b''` ON PURPOSE — the bytes live in storage and it only
    re-derives metadata. The guard must key on the storage branch, not on emptiness alone."""
    src = _source(_SPLICE)
    assert "_expected_bytes_from_storage = False" in src, (
        "the flag must default False so a deliberate empty-raw caller is untouched"
    )


def test_the_queue_path_refuses_to_complete_with_zero_chunks():
    """⛔ THE THIRD TWO-PATHS DISAGREEMENT. `ingest_document` has always refused here
    (documents.py: `if not chunks` -> failed + empty_text_message); the queue path fell through
    to `completed` with chunk_count=0 and an empty error_message."""
    src = _source(_SPLICE)
    assert "if total_recounted == 0:" in src, (
        "the queue path must refuse when nothing was indexed"
    )
    i = src.index("if total_recounted == 0:")
    tail = src[i : i + 900]
    assert "empty_text_message" in tail, (
        "it must reuse the legacy path's sentence — two paths refusing for the same reason "
        "must say the same thing"
    )


def test_the_zero_chunk_guard_uses_the_authoritative_recount_not_the_local_list():
    """⚠ A RESUMED job has an empty batch loop and a non-zero row count. Judging it on the
    in-memory `chunks` list would fail a document that is actually fine."""
    # ⚠ COMMENTS STRIPPED FIRST. A first version asserted on the raw source and failed on the
    #   guard's OWN comment, which quotes the legacy path's `if not chunks:` to explain the
    #   divergence. Prose about code is not code — in both directions.
    src = _source(_SPLICE)
    code = "\n".join(ln for ln in src.split("\n") if not ln.lstrip().startswith("#"))
    assert "if total_recounted == 0:" in code
    assert "if not chunks:" not in code.split("4d. Finalize")[-1], (
        "the finalize guard must read the recount, never the local chunk list"
    )


# ── BUG-260906-01 — classification is a step, so BOTH paths must run it ───────────────
#
# ⛔ THE FIFTH DEFECT OF ONE SHAPE, AND THE FIRST FOUR ARE ALREADY TESTED ABOVE. The
# Phase 118 rule-eval pass lived inline in `ingest_document`, ~330 lines below the metadata
# block that BUG-260905-06 extracted into `enrich_for_ingest`. The extraction walked past
# it, so a file arriving through a connector watch was chunked, embedded and marked
# `completed` carrying `metadata._classification = None` no matter which rule matched it.
#
# ⚠ MEASURED, not inferred (operator's live database, 2026-09-06): the one document ingested
#   by a watch read `folder=None | _classification=None` beside `classification_rules rows: 1`.
#   `grep -n classification` over the queue path returned exactly ONE hit — a comment.
#
# ⚠ THE TESTS BELOW ARE AGREEMENT TESTS, NEVER PER-PATH TESTS. A per-path classification
#   test would reproduce this bug's own cause: five defects have now shipped past a suite in
#   which both paths had tests and none asserted the two paths AGREE.


class _StubMetadata:
    """What a legacy-mode `extract_metadata` returns — only `model_dump` is consumed."""

    def __init__(self, payload: dict):
        self._payload = payload

    def model_dump(self, **_kw) -> dict:
        return dict(self._payload)


class _Result:
    def __init__(self, data):
        self.data = data


class _RoutingTable:
    """⚠ TABLE-AWARE ON PURPOSE. `_FakeTable` above answers `data=None` to everything, which
    can never serve a rule — so a classification test written against it would pass while
    proving nothing. This one dispatches on the table NAME the caller asked for.

    ⚠ `.or_()` IS A NO-OP HERE, DELIBERATELY. The real PostgREST `or` filter is applied by
      the server; a fake that honoured it would hide the very thing AR-118-02 exists to
      catch. Returning the rows UNFILTERED is what lets
      `test_a_foreign_users_rule_is_never_evaluated` drive the fail-closed Python re-filter.
    """

    def __init__(self, name: str, rules: list[dict], raise_on_rules: bool):
        self._name = name
        self._rules = rules
        self._raise = raise_on_rules

    def select(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def single(self):
        return self

    def update(self, *_a, **_k):
        return self

    def execute(self):
        if self._name == "classification_rules":
            if self._raise:
                raise RuntimeError("classification_rules read exploded")
            return _Result(list(self._rules))
        if self._name == "metadata_field_definitions":
            return _Result([])          # whitelist = built-ins only
        # `documents` -> the prior-metadata maybe_single read (no prior row).
        # `folders`   -> build_suggestion's fresh name resolve, which degrades to None.
        return _Result(None)


class _RoutingSupabase:
    def __init__(self, rules: list[dict], raise_on_rules: bool = False):
        self._rules = rules
        self._raise = raise_on_rules

    def table(self, name):
        return _RoutingTable(name, self._rules, self._raise)


_OWNER = "11111111-1111-1111-1111-111111111111"
_STRANGER = "22222222-2222-2222-2222-222222222222"

#: A rule that matches the stub metadata below. `document_type` is a DocumentMetadata
#: built-in, so it passes `validate_fields` against the built-ins-only whitelist.
_MATCHING_EXPR = {
    "op": "and",
    "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}],
}


def _own_rule() -> dict:
    return {
        "id": "rule-own-1",
        "name": "Invoices go to Finance",
        "user_id": _OWNER,
        "is_system_global": False,
        "enabled": True,
        "match_expr": _MATCHING_EXPR,
        "suggest_folder_id": "f0000000-0000-0000-0000-000000000001",
    }


@pytest.fixture
def _stub_extraction(monkeypatch):
    """Deterministic non-empty metadata with no network call.

    `enrich_for_ingest` imports `extract_metadata` FUNCTION-LOCALLY, so patching the module
    attribute lands on the call. `_Settings.metadata_enrichment_mode` is `"legacy"`, which
    is the arm that uses it.
    """
    import app.services.embedding_service as _es

    monkeypatch.setattr(
        _es,
        "extract_metadata",
        lambda _text: _StubMetadata({"document_type": "invoice", "title": "ACME"}),
    )


def _kwargs(supabase, user_id=_OWNER) -> dict:
    return {
        "document_id": "doc-classify-1",
        "text": "Invoice 4417 from ACME Ltd.",
        "raw": b"",
        "mime_type": "text/plain",
        "filename": "acme-invoice.txt",
        "user_id": user_id,
        "supabase": supabase,
        "app_settings": _Settings(),
    }


def _via_legacy_path(supabase, user_id=_OWNER) -> EnrichedIngest:
    """The shape `documents.py:2127` calls — a direct sync call from a BackgroundTask."""
    return enrich_for_ingest(**_kwargs(supabase, user_id))


def _via_queue_path(supabase, user_id=_OWNER) -> EnrichedIngest:
    """The shape `ingest_splice.py:618-621` calls — off the event loop, in a worker thread.

    ⚠ `run_in_threadpool` is not decoration here either. Driving the queue side through the
      REAL transport is the only way this test can tell "both paths run the step" from
      "the function contains the step".
    """
    import asyncio

    from starlette.concurrency import run_in_threadpool

    async def _drive():
        return await run_in_threadpool(enrich_for_ingest, **_kwargs(supabase, user_id))

    return asyncio.run(_drive())


def test_both_paths_derive_the_same_classification(_stub_extraction):
    """⭐ THE ONE TEST THAT WOULD HAVE CAUGHT THIS.

    ⚠ IT ASSERTS AGREEMENT, NOT PRESENCE. Checking only that one side produces a suggestion
      is exactly the test shape that let five of these ship: the legacy path was always
      green, and its greenness said nothing whatsoever about the queue path.
    """
    legacy = _via_legacy_path(_RoutingSupabase([_own_rule()]))
    queued = _via_queue_path(_RoutingSupabase([_own_rule()]))

    legacy_cls = (legacy.metadata or {}).get("_classification")
    queued_cls = (queued.metadata or {}).get("_classification")

    assert legacy_cls is not None, "the legacy upload path derived no classification"
    assert queued_cls is not None, (
        "the QUEUE path derived no classification — this is BUG-260906-01: every watched "
        "or synced file reaches `completed` with `_classification=None`"
    )
    assert legacy_cls["rule_id"] == "rule-own-1"
    assert legacy_cls == queued_cls, (
        "the two ingest paths disagree about the same document's classification"
    )


def test_a_foreign_users_rule_is_never_evaluated(_stub_extraction):
    """⛔ THE HIGHEST-STAKES PROPERTY OF THE MOVE — AR-118-02, driven not assumed.

    This read runs under the SERVICE-ROLE client with no request JWT: `auth.uid()` is NULL
    and RLS is BYPASSED, so the in-app `.or_(...)` predicate is the SOLE owner gate and the
    Python re-filter behind it is defence in depth. The fake deliberately returns an
    OVER-BROAD result (it ignores `.or_()`, exactly as a malformed server-side filter would)
    carrying a stranger's rule whose expression WOULD match this document.
    """
    foreign = _own_rule()
    foreign["id"] = "rule-stranger-1"
    foreign["user_id"] = _STRANGER
    foreign["is_system_global"] = False

    out = _via_legacy_path(_RoutingSupabase([foreign]))
    queued = _via_queue_path(_RoutingSupabase([foreign]))

    assert "_classification" not in (out.metadata or {}), (
        "another user's rule was evaluated against this uploader's metadata"
    )
    assert "_classification" not in (queued.metadata or {}), (
        "the queue path leaked another user's rule — the re-filter did not survive the move"
    )


def test_classification_never_blocks_ingestion(_stub_extraction):
    """⛔ THE SOFT FAILURE IS DELIBERATE BEHAVIOUR, NOT AN OVERSIGHT.

    A rules read that raises must degrade to "no suggestion" and let the document ingest.
    The alternative — a classification-config problem failing an ingestion outright — is the
    same class of defect D-111-8 forbids for metadata.
    """
    exploding = _RoutingSupabase([], raise_on_rules=True)

    out = _via_legacy_path(exploding)

    assert isinstance(out, EnrichedIngest)
    assert out.metadata is not None, "a classification failure destroyed the derived metadata"
    assert out.metadata.get("document_type") == "invoice"
    assert "_classification" not in out.metadata


def test_classification_lives_in_one_home_not_two():
    """The single-home fence. Modelled on `test_both_ingest_paths_call_the_shared_enrichment`,
    which learned two things the hard way and both apply here:

    ⚠ STRIP COMMENT LINES. A fence a comment can satisfy is not a fence — and the moved
      block carries an explanatory comment naming `classification_matcher` in the file it
      LEFT would be enough to fool a bare substring search.
    ⚠ DO NOT DEMAND A FOLLOWING `(`. The usage shapes differ (`classification_matcher` is
      imported as a MODULE, then dotted), so a regex tuned to one call shape fails correct code.
    """
    def _code_lines(path: Path) -> list[str]:
        return [
            line for line in _source(path).split("\n")
            if "classification_matcher" in line and not line.lstrip().startswith("#")
        ]

    for path in (_SPLICE, _DOCUMENTS):
        assert _code_lines(path) == [], (
            f"{path.name} evaluates classification rules itself — the step has two homes "
            f"again, which is precisely how BUG-260906-01 happened: {_code_lines(path)}"
        )

    enrich_uses = _code_lines(_ENRICH)
    assert enrich_uses, "ingest_enrich.py does not run the classification pass at all"
    assert any(
        not ln.lstrip().startswith(("from ", "import ")) for ln in enrich_uses
    ), "ingest_enrich.py only IMPORTS the matcher — an import is not a use"


def test_both_paths_produce_only_suggestions_never_auto_move(_stub_extraction):
    """RULES-01 / SC#4: Rules only ever suggest (metadata._classification), never auto-move.

    Neither ingest path may ever set folder_id or execute an autonomous move; classification
    output is strictly a suggestion with status='suggested'.
    """
    legacy = _via_legacy_path(_RoutingSupabase([_own_rule()]))
    queued = _via_queue_path(_RoutingSupabase([_own_rule()]))

    for path_name, res in (("legacy", legacy), ("queued", queued)):
        cls_meta = (res.metadata or {}).get("_classification")
        assert cls_meta is not None, f"{path_name} produced no classification"
        assert cls_meta.get("status") == "suggested", f"{path_name} status must be 'suggested'"
        assert "suggested_folder_id" in cls_meta, f"{path_name} missing suggested_folder_id"
        assert cls_meta.get("rule_id") == "rule-own-1"


def test_watch_rules_match_arrival_facts_and_produce_suggestion_on_both_paths():
    """RULES-01 / SC#1 / Operator Ruling 3: A watch rule must affect real documents at ingestion.

    A watch rule keying on arrival facts (name, mime/type, size, path, source facts) evaluates
    at ingestion and sets `metadata._classification` suggestion on both legacy and queue paths,
    allowing the human to accept via the VIS-06 fence, without auto-moving.
    """
    rule = {
        "id": "rule-watch-1",
        "name": "Incoming text files go to Text Archive",
        "user_id": _OWNER,
        "is_system_global": False,
        "enabled": True,
        "rule_scope": "watch",
        "match_expr": {
            "op": "and",
            "conditions": [
                {"field": "name", "op": "contains", "value": "acme"},
                {"field": "type", "op": "eq", "value": "text/plain"},
            ],
        },
        "suggest_folder_id": "f0000000-0000-0000-0000-000000000002",
    }
    legacy = _via_legacy_path(_RoutingSupabase([rule]))
    queued = _via_queue_path(_RoutingSupabase([rule]))

    for path_name, res in (("legacy", legacy), ("queued", queued)):
        cls_meta = (res.metadata or {}).get("_classification")
        assert cls_meta is not None, f"{path_name} produced no classification from watch rule"
        assert cls_meta.get("status") == "suggested", f"{path_name} status must be 'suggested'"
        assert cls_meta.get("suggested_folder_id") == "f0000000-0000-0000-0000-000000000002"
        assert cls_meta.get("rule_id") == "rule-watch-1"


