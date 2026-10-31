"""Phase 305-04 (GUARD-03; D-32 / D-34 / D-35 / D-56; T-305-10 / T-305-11 / T-305-32 / T-305-33) —
the outbound guard, pure and DB-free.

* switch OFF -> the SAME model object comes back (nothing is rewritten, nothing is copied);
* switch ON -> a new model where ONLY ``RedactableText`` fields changed; ids, links, citations,
  origin, cursors, offsets and version numbers are byte-identical, and the text block rendered from
  the guarded model carries the masks and every id and link;
* a read chunk is redacted over the caller's window, so a value split by the chunk boundary is
  masked in BOTH chunks;
* fail closed: a redactor that raises, or one that runs past the deadline, gives ``WITHHELD``;
* fail safe: a switch read that raises (or cannot find the org) REDACTS — never withholds, never
  passes the result through.
"""
from __future__ import annotations

import pytest

from app.mcp import results as R
from app.services import outbound_guard
from app.services.outbound_guard import WITHHELD, WITHHELD_SENTENCE, guard

ORG = "44444444-4444-4444-8444-444444444444"
DOC = "dddddddd-0000-4000-8000-000000000001"
DOC2 = "dddddddd-0000-4000-8000-000000000002"


async def _on(_org):
    return True


async def _off(_org):
    return False


def _search() -> R.SearchResult:
    return R.SearchResult(passages=[
        R.Passage(document_id=DOC, title="Contract for jane.doe@example.com.pdf",
                  passage="Reach Jane on +44 20 7946 0958 or jane.doe@example.com.",
                  citation=R.Citation(passage=3), link=R.doc_link(DOC), origin="external",
                  version_number=2),
        R.Passage(document_id=DOC2, title="Q3 revenue",
                  passage="Pay GB82 WEST 1234 5698 7654 32 with card 4111 1111 1111 1111.",
                  citation=R.Citation(passage=None), link=R.doc_link(DOC2), origin="library"),
    ])


def _read(text: str, *, offset=0, end=None, cursor=None) -> R.ReadResult:
    return R.ReadResult(document_id=DOC, title="Notes", link=R.doc_link(DOC), origin="library",
                        text=text, offset=offset, end=end if end is not None else offset + len(text),
                        total_chars=40_000, next_cursor=cursor)


def test_the_withheld_sentence_is_d35_verbatim():
    assert WITHHELD_SENTENCE == "This result was withheld because it could not be checked for personal data."


async def test_switch_off_returns_the_same_model_object():
    model = _search()
    assert await guard(model, org_id=ORG, is_on=_off) is model


async def test_switch_on_rewrites_only_redactable_text_fields():
    model = _search()
    out = await guard(model, org_id=ORG, is_on=_on)
    assert out is not model and out is not WITHHELD
    a, b = out.passages
    assert a.title == "Contract for [email removed].pdf"
    assert a.passage == "Reach Jane on [phone removed] or [email removed]."
    assert b.title == "Q3 revenue"
    assert b.passage == "Pay [IBAN removed] with card [card number removed]."
    for before, after in zip(model.passages, out.passages):
        assert after.document_id == before.document_id
        assert after.link == before.link
        assert after.citation == before.citation
        assert after.origin == before.origin
        assert after.version_number == before.version_number
    assert model.passages[0].passage.startswith("Reach Jane on +44")  # the input is untouched
    text = R.render(out)
    for mask in ("[email removed]", "[phone removed]", "[IBAN removed]", "[card number removed]"):
        assert mask in text
    for p in out.passages:
        assert p.document_id in text and p.link in text
    assert "jane.doe@example.com" not in text and "7946" not in text
    R.SearchResult.model_validate(out.model_dump(mode="json"))


async def test_listings_redact_folder_names_and_titles_but_keep_ids_and_cursors():
    cursor = R.encode_list_cursor(None, 50)
    model = R.ListResult(
        folders=[R.FolderEntry(folder_id=DOC2, name="Clients - ops@example.com")],
        documents=[R.DocumentEntry(document_id=DOC, title="call 020 7946 0958 tel.txt",
                                   link=R.doc_link(DOC), origin="library")],
        next_cursor=cursor,
    )
    out = await guard(model, org_id=ORG, is_on=_on)
    assert out.folders[0].name == "Clients - [email removed]"
    assert out.folders[0].folder_id == DOC2
    assert out.documents[0].document_id == DOC and out.documents[0].link == R.doc_link(DOC)
    assert out.next_cursor == cursor
    assert R.decode_list_cursor(out.next_cursor, None) == 50  # the redacted listing still pages


async def test_a_read_keeps_offsets_and_its_cursor_still_pages():
    cursor = R.encode_read_cursor(DOC, 8000)
    model = _read("Email jane.doe@example.com now.", offset=0, end=8000, cursor=cursor)
    out = await guard(model, org_id=ORG, is_on=_on)
    assert out.text == "Email [email removed] now."
    assert (out.offset, out.end, out.total_chars, out.next_cursor) == (0, 8000, 40_000, cursor)
    assert R.decode_read_cursor(out.next_cursor, DOC, 40_000) == 8000


async def test_a_phone_split_by_the_chunk_boundary_is_masked_in_both_chunks():
    full = "Ops desk: please call +44 20 7946 0958 before noon about the invoice."
    cut = full.index("79") + 2  # the boundary falls inside the number
    first, second = full[:cut], full[cut:]
    assert "+44 20 79" in first and second.startswith("46 0958")

    out1 = await guard(_read(first), org_id=ORG, is_on=_on, window={"text": ("", second[:128])})
    out2 = await guard(_read(second, offset=cut), org_id=ORG, is_on=_on,
                       window={"text": (first[-128:], "")})
    assert out1.text == "Ops desk: please call [phone removed]"
    assert out2.text == "[phone removed] before noon about the invoice."
    # Non-vacuity: without the window, the halves alone do not match.
    bare1 = await guard(_read(first), org_id=ORG, is_on=_on)
    bare2 = await guard(_read(second, offset=cut), org_id=ORG, is_on=_on)
    assert bare1.text == first and bare2.text == second


async def test_an_email_and_an_iban_split_by_the_boundary_are_masked_in_both_chunks():
    full = "Write to jane.doe@example.com or pay GB82 WEST 1234 5698 7654 32 today."
    for needle in ("jane.doe@exa", "GB82 WEST 12"):
        cut = full.index(needle) + len(needle)
        first, second = full[:cut], full[cut:]
        out1 = await guard(_read(first), org_id=ORG, is_on=_on, window={"text": ("", second)})
        out2 = await guard(_read(second, offset=cut), org_id=ORG, is_on=_on, window={"text": (first, "")})
        assert needle not in out1.text
        assert not out2.text.startswith(second[:4]), (needle, out2.text)
        assert "[" in out1.text and out2.text.startswith("[")


class _Raises:
    name = "raises"

    def spans(self, text):
        raise RuntimeError("recognizer blew up")


class _Slow:
    """Advances a fake clock by 3 s per field, so the 2 s deadline passes on the first field."""
    name = "slow"

    def __init__(self, clock):
        self.clock = clock

    def spans(self, text):
        self.clock.now += 3.0
        return []


class _Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


async def test_a_redactor_that_raises_withholds_the_result():
    assert await guard(_search(), org_id=ORG, is_on=_on, redactor=_Raises()) is WITHHELD


async def test_a_redactor_past_the_deadline_withholds_the_result():
    clock = _Clock()
    out = await guard(_search(), org_id=ORG, is_on=_on, redactor=_Slow(clock), deadline_s=2.0, clock=clock)
    assert out is WITHHELD


async def test_a_redactor_inside_the_deadline_answers():
    clock = _Clock()

    class _Quick(_Slow):
        def spans(self, text):
            self.clock.now += 0.01
            return []

    out = await guard(_search(), org_id=ORG, is_on=_on, redactor=_Quick(clock), deadline_s=2.0, clock=clock)
    assert out is not WITHHELD


async def test_a_switch_read_that_raises_is_treated_as_on():
    async def _broken(_org):
        raise ConnectionError("pool closed")

    out = await guard(_search(), org_id=ORG, is_on=_broken)
    assert out is not WITHHELD
    assert out.passages[0].passage == "Reach Jane on [phone removed] or [email removed]."


async def test_a_switch_read_that_finds_no_org_is_treated_as_on():
    async def _missing(_org):
        return None

    out = await guard(_search(), org_id=ORG, is_on=_missing)
    assert "[email removed]" in out.passages[0].passage


async def test_the_switch_is_read_for_the_principals_org():
    seen = []

    async def _spy(org):
        seen.append(org)
        return False

    await guard(_search(), org_id=ORG, is_on=_spy)
    assert seen == [ORG]


def test_the_guard_walks_by_annotation_never_by_field_name():
    from pydantic import BaseModel

    class Odd(BaseModel):
        passage: str          # named like a redactable field, but plain str
        note: R.RedactableText

    fields = outbound_guard.redactable_fields(Odd)
    assert fields == {"note"}
    assert outbound_guard.redactable_fields(R.Passage) == {"title", "passage"}
    assert outbound_guard.redactable_fields(R.ReadResult) == {"title", "text"}
    assert outbound_guard.redactable_fields(R.FolderEntry) == {"name"}
    assert outbound_guard.redactable_fields(R.DocumentEntry) == {"title"}


def test_the_module_is_fail_closed_by_its_docblock():
    doc = outbound_guard.__doc__ or ""
    assert "fail closed" in doc.lower() and "308" in doc
