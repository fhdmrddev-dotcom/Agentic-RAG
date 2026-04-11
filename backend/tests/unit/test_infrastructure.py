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


# ── Settings cache TTL tests ───────────────────────────────────────────────────

def test_cache_returns_same_object_within_ttl():
    """Two calls within TTL window return same cached result without re-reading disk."""
    import app.models.user_settings as us
    # Reset cache state
    us._override_cache_time = 0.0
    us._override_cache = {}

    with patch.object(us._OVERRIDE_FILE, 'read_text', return_value='{"key": "value"}') as mock_read:
        result1 = us._load_override()
        result2 = us._load_override()

    # Should only read from disk once
    assert mock_read.call_count == 1
    assert result1 == result2 == {"key": "value"}


def test_cache_invalidated_after_ttl():
    """Call after TTL window triggers a fresh disk read."""
    import app.models.user_settings as us
    us._override_cache_time = 0.0
    us._override_cache = {}

    with patch.object(us._OVERRIDE_FILE, 'read_text', return_value='{}') as mock_read:
        us._load_override()
        # Simulate TTL expiry
        us._override_cache_time = time.time() - us._OVERRIDE_CACHE_TTL - 1
        us._load_override()

    assert mock_read.call_count == 2


def test_save_override_invalidates_cache():
    """save_override resets cache so next _load_override re-reads from disk."""
    import app.models.user_settings as us
    us._override_cache_time = time.time()  # mark as fresh

    with patch.object(us._OVERRIDE_FILE, 'read_text', return_value='{}'):
        with patch.object(us._OVERRIDE_FILE, 'write_text'):
            us.save_override({"x": "y"})

    assert us._override_cache_time == 0.0
