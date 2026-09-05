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
