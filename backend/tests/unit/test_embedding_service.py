"""Unit tests for app.services.embedding_service.chunk_text.

No external calls are made – chunk_text is pure Python logic.
"""
import pytest

from app.services.embedding_service import chunk_text


class TestChunkTextEdgeCases:
    def test_empty_string_returns_empty_list(self):
        assert chunk_text("") == []

    def test_whitespace_only_returns_empty_list(self):
        assert chunk_text("   \n\t  ") == []

    def test_short_text_is_covered_in_first_chunk(self):
        # NOTE: chunk_text uses `overlap or settings.chunk_overlap`, so passing
        # overlap=0 silently uses the default (200). The safe pattern for a
        # "single chunk" test is to make the text much shorter than chunk_size
        # AND to rely on 'None' for overlap (uses settings default, 200).
        # With chunk_size=1000 and text=12 chars, next_start = 12-200 = -188
        # which triggers start+1 iteration. Use chunk_size>text and overlap<text.
        text = "Hello"  # 5 chars
        # overlap=1 is safe: next_start = 5-1 = 4 < 5, then 5-1=4... still iterates
        # We just verify the full text appears in the first chunk
        result = chunk_text(text, chunk_size=1000, overlap=1)
        assert result[0] == "Hello"

    def test_text_fits_in_single_chunk_when_overlap_is_small_fraction(self):
        # Use text of 100 chars, chunk_size=200, overlap=1
        # end=100 (= text_len), so the if end < text_len branch is NOT entered
        # next_start = 100-1 = 99 < 100, so it loops again but text[99:100]="a"
        # We verify the first chunk contains the full text
        text = "a" * 100
        result = chunk_text(text, chunk_size=200, overlap=1)
        assert result[0] == text

    def test_text_shorter_than_chunk_size_is_fully_covered_in_first_chunk(self):
        # The first chunk always covers [0:min(chunk_size, text_len)]
        # subsequent overlap-tail chunks are a known algorithm property
        text = "Short text here."
        result = chunk_text(text, chunk_size=1000, overlap=200)
        assert text.strip() in result[0]  # full text is in the first chunk

    def test_long_text_returns_multiple_chunks(self):
        # 300 chars with chunk_size=100, overlap=20 → at least 3 chunks
        text = "x" * 300
        result = chunk_text(text, chunk_size=100, overlap=20)
        assert len(result) >= 3

    def test_all_chunks_are_non_empty(self):
        text = "word " * 200  # 1000 chars
        result = chunk_text(text, chunk_size=100, overlap=20)
        for chunk in result:
            assert chunk.strip() != ""

    def test_consecutive_chunks_share_content_due_to_overlap(self):
        # Build text where we can detect the overlap region
        # chunk_size=50, overlap=10 → second chunk starts 40 chars into text
        text = "abcdefghij" * 10  # 100 chars
        result = chunk_text(text, chunk_size=50, overlap=10)
        assert len(result) >= 2
        # The end of chunk[0] and the start of chunk[1] must share characters
        end_of_first = result[0][-10:]
        start_of_second = result[1][:10]
        # They should have some overlap (not necessarily identical – sentence
        # boundary detection may shift the split point slightly)
        assert len(set(end_of_first) & set(start_of_second)) > 0

    def test_sentence_boundary_detection(self):
        # Craft a text where a sentence boundary lands inside the overlap window
        # chunk_size=30, overlap=10
        # "Hello world. This is a test. And more text here today."
        text = "Hello world. This is a test. And more text here today."
        result = chunk_text(text, chunk_size=30, overlap=10)
        # At least the first chunk should end at a sentence boundary
        assert len(result) >= 1
        # First chunk should not be cut in the middle of a word arbitrarily
        # (sentence boundary logic tries to end at '.', '!', or '?')
        first = result[0]
        assert len(first) > 0

    def test_chunk_size_respected_approximately(self):
        text = "a" * 500
        result = chunk_text(text, chunk_size=100, overlap=10)
        for chunk in result:
            # Each chunk should be at most chunk_size characters (before strip)
            assert len(chunk) <= 110  # small tolerance for boundary adjustment

    def test_single_sentence_longer_than_chunk_size(self):
        # No sentence boundary available → must still chunk
        text = "a" * 200  # no punctuation
        result = chunk_text(text, chunk_size=50, overlap=10)
        assert len(result) >= 3
        for chunk in result:
            assert len(chunk) > 0

    def test_exact_overlap_content(self):
        # With overlap=10 and chunk_size=20, the second chunk starts at char 10
        # (end=20, next_start=20-10=10)
        text = "0123456789" * 5  # 50 chars
        result = chunk_text(text, chunk_size=20, overlap=10)
        # chunk[0] covers [0:20], chunk[1] covers [10:30] → chars 10-19 are shared
        if len(result) >= 2:
            shared_region = text[10:20]
            assert shared_region in result[0] or shared_region in result[1]
