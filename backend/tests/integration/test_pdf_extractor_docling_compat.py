"""Phase 070 SC#2: Docling + supabase-py coexistence CI gate (Q-v2.6-01 resolution test)."""
import os
from pathlib import Path

import pytest

# Module-top imports: spike must fail loudly at collection if either lib is broken.
# (Diverges from probe_multimodal.py's lazy import — Pitfall #1.)
from docling.document_converter import DocumentConverter
from supabase import create_client

FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "extraction" / "reference.pdf"


def test_docling_supabase_coexist():
    """D-070-01: import + instantiate both libs in one process; Docling convert returns non-empty markdown."""
    assert FIXTURE_PATH.exists(), f"Missing reference fixture: {FIXTURE_PATH}"

    # Docling: full convert + non-empty assertion.
    converter = DocumentConverter()
    result = converter.convert(str(FIXTURE_PATH))
    markdown = result.document.export_to_markdown()
    assert isinstance(markdown, str) and len(markdown) > 0, (
        f"Docling produced empty markdown for {FIXTURE_PATH}; got {markdown!r}"
    )

    # Supabase: instantiate (not invoke) — proves create_client() doesn't trip httpx-pin conflict.
    sb_url = os.environ.get("SUPABASE_URL", "https://test.supabase.co")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    client = create_client(sb_url, sb_key)
    assert client is not None


def test_supabase_smoke_post_resolution():
    """D-070-02 / D-070-12: smoke the Supabase SDK + storage surface against the resolved httpx pin.

    Read-only — no INSERT/UPDATE/DELETE (T-070-02 threat-model mitigation).
    Bypasses the conftest autouse mock by not taking a `client` fixture and calling
    create_client(...) directly (Pitfall #2).
    """
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or sb_url.startswith("https://test."):
        pytest.skip("real Supabase not configured (SUPABASE_URL unset or pointing at test.supabase.co)")

    sb = create_client(sb_url, sb_key)

    # Table smoke — D-070-07
    resp = sb.table("documents").select("id").limit(1).execute()
    assert hasattr(resp, "data"), f"supabase table().select().execute() returned no .data attr: {resp!r}"
    assert isinstance(resp.data, list)

    # Storage smoke — D-070-12
    storage_list = sb.storage.from_("documents").list("", {"limit": 1})
    assert isinstance(storage_list, list)
