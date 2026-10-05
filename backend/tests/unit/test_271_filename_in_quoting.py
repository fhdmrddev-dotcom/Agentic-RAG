r"""271-REVIEW WR-04 — a filename with ``"`` or ``\`` inside a PostgREST ``in.(...)`` list.

postgrest-py 2.29.0's ``.in_()`` (``sanitize_param``) wraps a value in double quotes when it
contains ``,:()`` and escapes NOTHING inside them. The review predicted a 500; that was
MEASURED against the local PostgREST (14.10) and is wrong in a worse direction:
``filename=in.("Q3 "final", draft.pdf")`` returns **200** and parses as the two names
``"Q3 "final"`` and `` draft.pdf"``. So the lineage read silently misses the document — its
version tag reads 1, "Has earlier versions" drops it — and the relationship filter cannot
follow an older endpoint with such a name to its latest row. Nothing says anything.

These cases run the service against a WIRE-FAITHFUL fake: every ``.in_`` goes through the real
``sanitize_param`` and then PostgREST's measured list grammar (``parse_pgrst_in_list``), so a
quoting defect changes the ANSWER, which is what is asserted.
"""

from __future__ import annotations

import pytest
from postgrest.utils import sanitize_param

from tests.unit.test_271_search_core import (
    CALLER,
    FakePostgrest,
    FakeQuery,
    doc,
    parse_pgrst_in_list,
    patched,  # noqa: F401 — the shared seam-patching fixture
    run,
)

# Both characters the escaper must handle, plus every one sanitize_param reacts to.
NASTY = 'Q3 "final", draft (v2):x\\y.pdf'


class WireQuery(FakeQuery):
    """``.in_`` evaluated over what the SERVER would parse from postgrest-py's encoding."""

    def in_(self, col, values):
        wire = "(" + ",".join(sanitize_param(v) for v in values) + ")"
        self.calls.append(("in_", col, parse_pgrst_in_list(wire)))
        return self


class WirePostgrest(FakePostgrest):
    def table(self, name):
        return WireQuery(self, name)


# ─────────────────────────────── the grammar pin ───────────────────────────────


@pytest.mark.parametrize(
    "wire, parsed",
    [
        ('("a\\"b")', ['a"b']),
        ('("a\\\\b")', ["a\\b"]),
        ('("a\\b")', ["ab"]),
        ("(a\\b)", ["a\\b"]),
        ('("a,b")', ["a,b"]),
        ('("Q3 "final", draft.pdf")', ['"Q3 "final"', ' draft.pdf"']),
        ("(u1,u2)", ["u1", "u2"]),
    ],
)
def test_the_fake_grammar_matches_postgrest_14_10_as_measured(wire, parsed):
    assert parse_pgrst_in_list(wire) == parsed


def test_postgrest_py_alone_cannot_carry_the_name():
    # The defect itself, at the library: the server would read two wrong names.
    wire = "(" + sanitize_param(NASTY) + ")"
    assert parse_pgrst_in_list(wire) != [NASTY]


def test_the_service_quoting_round_trips_every_awkward_name():
    from app.services.document_search_service import _pg_in_list

    names = [NASTY, "plain.pdf", 'only"quote.pdf', "only\\slash.pdf", "a,b(c):d.pdf", ""]
    assert parse_pgrst_in_list(_pg_in_list(names)) == names


# ─────────────────────────────── through the service ───────────────────────────────


def _lineage_client():
    return WirePostgrest(
        {
            "documents": [
                doc("n1", filename=NASTY, version_number=1, is_latest=False),
                doc("n2", filename=NASTY, version_number=2, is_latest=True),
            ]
        }
    )


@pytest.mark.asyncio
async def test_a_nasty_filename_keeps_its_version_facts(patched):
    result = await run(_lineage_client(), name="Q3")
    [row] = result["documents"]
    assert row["id"] == "n2"
    assert row["version_count"] == 2
    assert row["has_earlier"] is True


@pytest.mark.asyncio
async def test_has_earlier_versions_still_finds_a_nasty_filename(patched):
    result = await run(_lineage_client(), version="has_earlier")
    assert [d["id"] for d in result["documents"]] == ["n2"]


@pytest.mark.asyncio
async def test_a_relationship_endpoint_with_a_nasty_filename_follows_to_its_latest(patched):
    p = "dddddddd-0000-4000-8000-000000000001"
    c1 = "dddddddd-0000-4000-8000-0000000000c1"
    c2 = "dddddddd-0000-4000-8000-0000000000c2"
    client = WirePostgrest(
        {
            "documents": [
                doc(p, filename="P.pdf"),
                doc(c1, filename=NASTY, version_number=1, is_latest=False),
                doc(c2, filename=NASTY, version_number=2, is_latest=True),
            ],
            "document_relationships": [
                {"source_doc_id": c1, "target_doc_id": p, "rel_type": "supersedes", "user_id": CALLER},
            ],
        }
    )
    result = await run(client, relationship={"verb": "supersedes", "document_id": p})
    assert [d["id"] for d in result["documents"]] == [c2]
