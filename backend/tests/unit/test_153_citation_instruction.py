"""Wave-0 unit tests for the retrieval-gated dual-channel citation instruction.

TDD (RED first): these fail with ImportError until ``citation_markers.py`` provides
``apply_citation_instruction`` + ``CITATION_INSTRUCTION``.

The injection MUST be byte-identical on non-retrieval turns (D-12/D-14) and MUST
reach BOTH the native ``active_system_prompt`` channel AND the compat ``messages[0]``
system-role entry (SC#10 / Pitfall 1 — Anthropic silently drops mid-list system
messages, so a single channel is not enough). No provider fork on the shared path.
"""

import copy

from app.services.citation_markers import (
    CITATION_INSTRUCTION,
    apply_citation_instruction,
    format_citation_manifest,
    _deduplicate_citations,
)


def _chunk(doc_id: str, chunk_index: int = 0, filename: str = "doc.pdf") -> dict:
    return {
        "document_id": doc_id,
        "filename": filename,
        "chunk_index": chunk_index,
        "passage": "some passage",
        "similarity": 0.7,
        "is_full_doc": False,
        "version_number": 1,
    }


def _base_messages() -> list[dict]:
    return [
        {"role": "system", "content": "BASE SYSTEM PROMPT"},
        {"role": "user", "content": "what does the doc say?"},
    ]


BASE_SYS = "BASE SYSTEM PROMPT"


class TestByteIdenticalOffRetrieval:
    def test_no_inject_without_retrieval(self):
        # Empty retrieval set -> the prompt is byte-identical (D-12/D-14): the system
        # prompt is returned unchanged and messages are not touched at all.
        msgs = _base_messages()
        msgs_before = copy.deepcopy(msgs)
        out_sys = apply_citation_instruction(BASE_SYS, msgs, [])
        assert out_sys == BASE_SYS
        assert msgs == msgs_before  # deep-equal — no mutation of the messages list


class TestDualChannelInject:
    def test_dual_channel_inject(self):
        cits = [_chunk("a"), _chunk("b", chunk_index=2)]
        msgs = _base_messages()
        out_sys = apply_citation_instruction(BASE_SYS, msgs, cits)

        manifest = format_citation_manifest(_deduplicate_citations(cits))

        # Native channel: the returned system prompt carries the instruction + manifest.
        assert out_sys != BASE_SYS
        assert out_sys.startswith(BASE_SYS)  # base preserved, note appended
        assert CITATION_INSTRUCTION in out_sys
        assert manifest in out_sys

        # Compat channel: the messages[0] system-role entry has the SAME note.
        sys_entry = next(m for m in msgs if m["role"] == "system")
        assert CITATION_INSTRUCTION in sys_entry["content"]
        assert manifest in sys_entry["content"]
        # The non-system message is untouched.
        assert msgs[1] == {"role": "user", "content": "what does the doc say?"}

    def test_manifest_matches_dedup_order(self):
        # Duplicate + out-of-order hits: the injected manifest numbering equals the
        # dedup-order manifest, so the numbers the model sees line up with the footer.
        cits = [
            _chunk("b", chunk_index=2, filename="roadmap.md"),
            _chunk("a", chunk_index=0, filename="Q3.pdf"),
            _chunk("b", chunk_index=2, filename="roadmap.md"),  # duplicate of #1
        ]
        out_sys = apply_citation_instruction(BASE_SYS, _base_messages(), cits)
        expected = format_citation_manifest(_deduplicate_citations(cits))
        assert expected in out_sys
        # Dedup collapses the two identical (document_id, chunk_index) hits -> 2 rows.
        assert expected.count("\n") == 1


class TestIdempotency:
    def test_idempotent_or_fresh(self):
        cits = [_chunk("a")]
        msgs = _base_messages()

        out1 = apply_citation_instruction(BASE_SYS, msgs, cits)
        # Re-apply against the already-injected system prompt + messages.
        out2 = apply_citation_instruction(out1, msgs, cits)

        # No double-append: the instruction appears exactly once in both channels.
        assert out2.count(CITATION_INSTRUCTION) == 1
        sys_entry = next(m for m in msgs if m["role"] == "system")
        assert sys_entry["content"].count(CITATION_INSTRUCTION) == 1
        # Fresh re-application is stable (same content the second time).
        assert out2 == out1
