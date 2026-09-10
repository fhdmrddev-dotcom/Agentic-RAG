"""BUG-260905-12 — re-ingesting an image ERASED its metadata."""
from unittest.mock import patch
import pytest


class _Resp:
    def __init__(self, data): self.data = data


class _Q:
    def __init__(self, data): self._d = data
    def select(self, *a, **k): return self
    def eq(self, *a, **k): return self
    def maybe_single(self): return self
    def update(self, *a, **k): return self
    def execute(self): return _Resp(self._d)


class _SB:
    def __init__(self, prior): self.prior = prior
    def table(self, name):
        return _Q({"metadata": self.prior} if name == "documents" else [])


class _S:
    metadata_enrichment_mode = "enriched"
    extraction_model = "gpt-5.4-mini"
    extraction_provider = "openai"
    extraction_window_cap = 32000
    vision_model = ""
    llm_model = "gpt-4o"
    llm_api_key = "sk-test"
    llm_base_url = ""
    active_provider = "openai"


class _Legacy(_S):
    """The legacy branch returns an object with .model_dump() — a far smaller surface to stub
    than the enriched path's result/emitted pair, and it reaches the SAME merge."""

    metadata_enrichment_mode = "legacy"


def test_a_degraded_enrichment_must_not_erase_an_images_existing_metadata():
    from app.services.ingest_enrich import enrich_for_ingest

    prior = {
        "title": "Financial Statements 2024",
        "document_type": "financial statements",
        "date": "2024-12-31",
        "summary": "Consolidated statements of the Nestle Group.",
        "topics": ["finance"],
    }
    sb = _SB(prior)

    # Enrichment degrades — the documented, supported outcome.
    with patch("app.services.embedding_service.read_enabled_field_defs", return_value=[]), \
         patch("app.services.embedding_service.extract_metadata", side_effect=RuntimeError("no")), \
         patch("app.services.extractors.aspects.vision_text.transcribe_pages", return_value=""):
        out = enrich_for_ingest(
            document_id="doc-1",
            text="Nestle\nFinancial Statements 2024",
            raw=b"\x89PNG\r\n\x1a\n" + b"0" * 64,
            mime_type="image/png",
            filename="statements.png",
            user_id="user-1",
            supabase=sb,
            app_settings=_S(),
        )

    md = out.metadata or {}
    assert md.get("title") == "Financial Statements 2024", (
        "re-ingesting the image ERASED its title; got keys "
        + repr(sorted(k for k in md if not k.startswith("_")))
    )
    assert md.get("document_type") != "image", "the real document_type was overwritten by the placeholder"


def test_a_successful_extraction_can_still_change_metadata():
    """⚠ THE COUNTER-GUARD. Restoring prior fields unconditionally would make metadata
    permanently un-updatable — a worse bug than the erasure being fixed. A pass that DID
    derive metadata must win."""
    from app.services.ingest_enrich import enrich_for_ingest

    prior = {"title": "Old Title", "document_type": "invoice", "topics": ["stale"]}
    sb = _SB(prior)

    class _Emitted:
        @staticmethod
        def model_dump(**_kw):
            return {"title": "New Title", "document_type": "receipt"}

    with patch("app.services.embedding_service.read_enabled_field_defs", return_value=[]), \
         patch("app.services.embedding_service.extract_metadata", return_value=_Emitted()), \
         patch("app.services.extractors.aspects.vision_text.transcribe_pages", return_value=""):
        out = enrich_for_ingest(
            document_id="doc-2", text="a receipt", raw=b"\x89PNG\r\n\x1a\n" + b"0" * 64,
            mime_type="image/png", filename="r.png", user_id="u", supabase=sb,
            app_settings=_Legacy(),
        )

    md = out.metadata or {}
    assert md.get("title") == "New Title", "a successful extraction must be able to update"
    assert md.get("document_type") == "receipt"
    assert "stale" not in (md.get("topics") or []), "a dropped field must stay dropped"


def test_a_degrade_never_carries_a_previous_passes_vision_provenance_forward():
    """⛔ `_vision` describes THIS pass. Restoring a prior one claims a transcription that
    did not happen — the same lie the `raw and` guard exists to prevent."""
    from app.services.ingest_enrich import enrich_for_ingest

    prior = {
        "title": "Scanned Deed",
        "_vision": {"engine": "vision", "pages_transcribed": 9, "advisory": True},
        "_confidence": {"title": 0.9},
    }
    sb = _SB(prior)

    with patch("app.services.embedding_service.read_enabled_field_defs", return_value=[]), \
         patch("app.services.embedding_service.extract_metadata", side_effect=RuntimeError("no")), \
         patch("app.services.extractors.aspects.vision_text.transcribe_pages", return_value=""):
        out = enrich_for_ingest(
            document_id="doc-3", text="deed", raw=b"", mime_type="application/pdf",
            filename="deed.pdf", user_id="u", supabase=sb, app_settings=_S(),
        )

    md = out.metadata or {}
    assert md.get("title") == "Scanned Deed", "the degrade must still restore real fields"
    assert md.get("_vision", {}).get("pages_transcribed") != 9, (
        "a previous pass's vision provenance was carried forward"
    )
    assert "_confidence" not in md or md["_confidence"] == {}, "stale confidence carried forward"
