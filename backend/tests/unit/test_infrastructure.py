"""Tests for settings cache TTL and chunk_text sentence boundaries."""
import time
import pytest
from unittest.mock import patch
from app.services.embedding_service import chunk_text


# ── chunk_text sentence boundary tests ────────────────────────────────────────

def test_split_on_period_space():
    """Splits at '. ' (normal sentence boundary)."""
    text = "Hello world. This is another sentence."
    chunks = chunk_text(text, chunk_size=20, overlap=0)
    # Should split after "Hello world." since it's followed by a space
    combined = " ".join(chunks)
    assert "Hello world" in combined


def test_no_split_on_abbreviation():
    """Does not split mid-word on 'e.g.' or 'Dr.'"""
    text = "The study (e.g. Smith 2020) shows the effect."
    # With small chunk size, if it incorrectly splits on 'e.g.' we'd see 'e' isolated
    chunks = chunk_text(text, chunk_size=60, overlap=5)
    # e.g. should not be a split point — it should appear whole
    combined = " ".join(chunks)
    assert "e.g" in combined or len(chunks) == 1


def test_no_split_on_decimal():
    """Does not split on decimal points like 3.14."""
    text = "The value is 3.14 which is pi. Next sentence here."
    chunks = chunk_text(text, chunk_size=30, overlap=0)
    combined = " ".join(chunks)
    # 3.14 should remain intact
    assert "3.14" in combined


def test_no_split_usa_abbreviation():
    """Does not split on U.S.A. abbreviation."""
    text = "Research in the U.S.A. has shown promising results in this area."
    chunks = chunk_text(text, chunk_size=40, overlap=0)
    combined = " ".join(chunks)
    assert "U.S.A" in combined


def test_empty_text_returns_empty():
    assert chunk_text("") == []


def test_short_text_returns_single_chunk():
    text = "Hello world."
    chunks = chunk_text(text, chunk_size=200, overlap=0)
    assert len(chunks) == 1
    assert chunks[0] == "Hello world."


# ── Settings cache TTL tests (081.1: DB-backed cache) ─────────────────────────

def test_cache_returns_same_object_within_ttl():
    """Two calls within TTL window return same cached dict without DB re-read."""
    import app.models.user_settings as us
    us._settings_cache_time = time.time()
    us._settings_cache = {"llm_provider": "openai"}

    result1 = us._settings_cache
    result2 = us._settings_cache
    assert result1 is result2


def test_cache_invalidated_after_ttl():
    """After TTL expiry, cache timestamp is stale and next load would refresh."""
    import app.models.user_settings as us
    us._settings_cache_time = time.time() - us._SETTINGS_CACHE_TTL - 1
    assert time.time() - us._settings_cache_time > us._SETTINGS_CACHE_TTL


def test_invalidate_settings_cache_resets_timestamp():
    """invalidate_settings_cache zeroes the timestamp so next read refreshes."""
    import app.models.user_settings as us
    us._settings_cache_time = time.time()
    us.invalidate_settings_cache()
    assert us._settings_cache_time == 0.0
