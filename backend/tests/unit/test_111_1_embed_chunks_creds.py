"""Phase 111.1 Wave-0 (RED) — embed_chunks threads user_settings (EMBED-04 / D-13).

The headline bug fix: `embed_chunks` (ingest path) currently DROPS `user_settings`
and falls back to env creds, so a configured non-default embedder ingests with the
WRONG client while the query path (`retrieval_service` -> embed_texts) uses the
configured one — a silent mixed-vector-space split.

Fix (Plan 03): `embed_chunks(chunks, model=None, user_settings=None)` forwards
`user_settings` to `embed_texts`, so chunk-time and query-time resolve the SAME
`get_embedding_client`. RED convention: import inside the body; xfail(strict=False).
"""

import inspect

import pytest


def test_embed_chunks_accepts_user_settings_kwarg():
    from app.services.embedding_service import embed_chunks

    sig = inspect.signature(embed_chunks)
    assert "user_settings" in sig.parameters, (
        "embed_chunks must accept user_settings so ingest + query resolve the same embedder"
    )


def test_embed_chunks_forwards_user_settings_to_embed_texts(monkeypatch):
    import app.services.embedding_service as es

    captured = {}

    def _fake_embed_texts(texts, model=None, user_settings=None):
        captured["user_settings"] = user_settings
        captured["model"] = model
        return [[0.0] for _ in texts]

    monkeypatch.setattr(es, "embed_texts", _fake_embed_texts)

    sentinel = object()
    es.embed_chunks(["a", "b"], model="text-embedding-3-small", user_settings=sentinel)

    assert captured["user_settings"] is sentinel, (
        "embed_chunks must thread user_settings through to embed_texts (no env-cred fallback)"
    )


def test_embed_chunks_empty_short_circuit():
    """Non-xfail anchor: the empty-input short-circuit already exists today."""
    from app.services.embedding_service import embed_chunks

    assert embed_chunks([]) == [], "empty chunk list returns [] without calling the embedder"
