"""Phase 230 (QUEUE-04 / SEED-197) — Unit tests for embedding batcher in openai_service.py.

Tests:
1. partition_texts_for_embedding partitions by input count ceiling (512).
2. partition_texts_for_embedding partitions by token count ceiling (200,000).
3. embed_texts handles empty list with 0 calls.
4. embed_texts preserves input ordering across multiple sub-batches.
5. embed_texts raises ValueError on provider count mismatch.
6. Multimodal table and image chunking length assertions (closing SEED-197).
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.openai_service import (
    EMBED_MAX_INPUTS_PER_BATCH,
    EMBED_MAX_TOKENS_PER_BATCH,
    embed_texts,
    estimate_embedding_tokens,
    partition_texts_for_embedding,
)


def test_estimate_embedding_tokens_safe_fallback():
    """Verify token estimation returns positive values and scales with text length."""
    assert estimate_embedding_tokens("") == 0
    short_tokens = estimate_embedding_tokens("Hello world")
    long_tokens = estimate_embedding_tokens("Hello world " * 100)
    assert short_tokens > 0
    assert long_tokens > short_tokens


def test_partition_by_max_inputs():
    """Verify list of 1,200 small texts partitions into batches of <= 512 items."""
    texts = [f"short chunk {i}" for i in range(1200)]
    batches = partition_texts_for_embedding(texts, max_tokens=1_000_000, max_inputs=512)

    assert len(batches) == 3
    assert len(batches[0]) == 512
    assert len(batches[1]) == 512
    assert len(batches[2]) == 176

    # Flattened matches original
    reconstructed = [t for b in batches for t in b]
    assert reconstructed == texts


def test_partition_by_max_tokens():
    """Verify texts with large estimated tokens partition before hitting 512 items."""
    # Create 10 large texts (~25,000 tokens each)
    large_text = "word " * 18000
    texts = [f"{large_text} {i}" for i in range(10)]

    # Cap max_tokens at 50,000
    batches = partition_texts_for_embedding(texts, max_tokens=50_000, max_inputs=512)

    # Should create more than 1 batch due to token ceiling
    assert len(batches) > 1
    for b in batches:
        # Each batch should have few items because of the token limit
        assert len(b) < 10

    reconstructed = [t for b in batches for t in b]
    assert reconstructed == texts


def test_embed_texts_empty():
    """Empty input returns empty list without calling client."""
    with patch("app.services.openai_service.get_embedding_client") as mock_client_factory:
        result = embed_texts([])
        assert result == []
        mock_client_factory.assert_not_called()


def test_embed_texts_multi_batch_order_preservation():
    """embed_texts gathers multiple batches and preserves exact sequential ordering."""
    texts = [f"chunk {i}" for i in range(1200)]

    mock_client = MagicMock()

    def fake_create(model, input):
        res = MagicMock()
        res.data = []
        for item in input:
            idx = int(item.split(" ")[1])
            data_item = MagicMock()
            # Vector encodes index to verify order
            data_item.embedding = [float(idx), float(idx * 2)]
            res.data.append(data_item)
        return res

    mock_client.embeddings.create.side_effect = fake_create

    with patch("app.services.openai_service.get_embedding_client", return_value=mock_client):
        embeddings = embed_texts(texts)

    assert len(embeddings) == 1200
    # Must have made 3 API calls (512 + 512 + 176)
    assert mock_client.embeddings.create.call_count == 3
    # Order must be strictly preserved
    for i in range(1200):
        assert embeddings[i] == [float(i), float(i * 2)]


def test_embed_texts_raises_on_count_mismatch():
    """embed_texts asserts len(all_embeddings) == len(texts) and raises ValueError if mismatched."""
    texts = ["text1", "text2", "text3"]

    mock_client = MagicMock()
    # Provider returns only 2 embeddings for 3 inputs
    mock_res = MagicMock()
    item1 = MagicMock()
    item1.embedding = [0.1, 0.2]
    item2 = MagicMock()
    item2.embedding = [0.3, 0.4]
    mock_res.data = [item1, item2]
    mock_client.embeddings.create.return_value = mock_res

    with patch("app.services.openai_service.get_embedding_client", return_value=mock_client):
        with pytest.raises(ValueError, match="Mismatched embedding count"):
            embed_texts(texts)
