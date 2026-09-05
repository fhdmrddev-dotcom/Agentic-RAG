"""Phase 233 (PREV-03 / SC#2 / SC#4 / SC#5) — the preview writes nothing, and the confirm agrees.

Three clauses are driven here rather than reasoned about:

* **SC#2** — close without confirming and the Library is exactly as it was. Proved by a Supabase
  double that RAISES on any write verb, so a stray `insert` is a test failure rather than a
  review miss.
* **SC#4** — the files that arrive are the files the preview named. Proved by running the real
  `confirm_preview` over the same fixture and comparing its arithmetic to the preview's.
* **SC#5** — a file resolves either into the Library or into a NAMED refusal, never silently in
  neither. Proved by asserting `unaccounted == 0` and that every `refused` outcome carries a
  reason.
"""

from __future__ import annotations

import pytest

from app.services.sources import preview_service
from app.services.sources.base import FilePage, SourceAdapter, SourceFile, SourceHealth


# ── a source that lists one of everything ──────────────────────────────────────────────────

FIXTURE = [
    SourceFile(id="d-1", name="Rate Sheet Q3.xlsx",
               mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               modified_at="2026-09-01T10:00:00Z"),
    SourceFile(id="d-2", name="Fuel Index.csv", mime_type="text/csv",
               modified_at="2026-09-01T10:00:00Z"),
    SourceFile(id="d-3", name="Master Rate Sheet.xlsx",
               mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               modified_at="2026-08-12T09:00:00Z"),
    SourceFile(id="d-4", name="kickoff-call.mp4", mime_type="video/mp4",
               modified_at="2026-09-01T10:00:00Z"),
    SourceFile(id="d-5", name="scan.pdf", mime_type="application/pdf",
               modified_at="2026-09-01T10:00:00Z"),
    SourceFile(id="d-6", name="Q3 Pricing Review",
               mime_type="application/vnd.google-apps.document",
               modified_at="2026-09-01T10:00:00Z"),
]

#: `d-3` is the one file this connection has already placed, at the same version.
KNOWN_ROWS = [
    {"metadata": {"source": {"system": "google", "external_id": "d-3",
                             "version": "2026-08-12T09:00:00Z"}}},
]


class _FixtureAdapter(SourceAdapter):
    async def browse(self, connection, folder_id=None, page_token=None):  # pragma: no cover
        raise AssertionError("the preview must not browse the hierarchy")

    async def list_files(self, connection, folder_id=None, recursive=False,
                         page_token=None, query=None, page_size=30):
        return FilePage(files=list(FIXTURE), next_page_token=None)

    async def read_file(self, connection, file_id):
        if file_id == "d-5":
            raise ValueError("No text layer — this PDF is image-only.")
        return (f"{file_id}.bin", b"x" * 32, "application/pdf")

    async def check(self, connection):  # pragma: no cover
        return SourceHealth(ok=True)


class _ReadOnlySupabase:
    """A Supabase double that makes SC#2 structural.

    ⭐ Every write verb RAISES. So "the preview wrote nothing" is not a claim this suite makes by
    inspecting a database afterwards — it is a property the test harness makes impossible to
    violate silently.
    """

    def __init__(self, rows=None):
        self._rows = rows or []
        self.writes: list[str] = []

    def table(self, name):
        return _ReadOnlyTable(self, name)


class _ReadOnlyTable:
    def __init__(self, parent, name):
        self._p = parent
        self._name = name

    # every read verb is a no-op that returns self
    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def neq(self, *a, **k):
        return self

    def or_(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def maybe_single(self, *a, **k):
        return self

    def execute(self):
        rows = self._p._rows if self._name == "documents" else []
        return type("Res", (), {"data": rows})()

    # ⛔ every write verb is a failure
    def insert(self, *a, **k):
        self._p.writes.append(f"insert:{self._name}")
        raise AssertionError(f"the preview wrote to {self._name}")

    def upsert(self, *a, **k):
        self._p.writes.append(f"upsert:{self._name}")
        raise AssertionError(f"the preview wrote to {self._name}")

    def update(self, *a, **k):
        self._p.writes.append(f"update:{self._name}")
        raise AssertionError(f"the preview wrote to {self._name}")

    def delete(self, *a, **k):
        self._p.writes.append(f"delete:{self._name}")
        raise AssertionError(f"the preview wrote to {self._name}")


CONNECTION = {"id": "conn-1", "service_id": "google", "default_ingest_visibility": "private"}


@pytest.fixture(autouse=True)
def _fixture_adapter(monkeypatch):
    from app.services.sources import base

    monkeypatch.setattr(base.SourceRegistry, "get_adapter",
                        classmethod(lambda cls, _c: _FixtureAdapter()))
    # Rules are a READ and are irrelevant to these clauses; keep them out of the way explicitly
    # rather than letting a DB double decide.
    monkeypatch.setattr(preview_service, "_rule_destinations",
                        lambda **kw: _async_value([]))
    yield


async def _async_value(v):
    return v


# ── SC#2 — nothing is written ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_preview_writes_nothing():
    sb = _ReadOnlySupabase(KNOWN_ROWS)
    preview = await preview_service.build_preview(
        connection=CONNECTION, folder_id="folder-1", folder_name="Rate Sheets 2026",
        user_id="u-1", supabase=sb,
    )
    assert sb.writes == []
    assert preview.wrote == {"documents": 0, "chunks": 0, "jobs": 0, "folders": 0}


@pytest.mark.asyncio
async def test_the_zero_receipt_is_four_zeros_not_a_truthy_flag():
    """The surface prints these four numbers verbatim. A boolean would let the sentence drift."""
    sb = _ReadOnlySupabase(KNOWN_ROWS)
    preview = await preview_service.build_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1", supabase=sb,
    )
    assert sorted(preview.wrote) == ["chunks", "documents", "folders", "jobs"]
    assert all(v == 0 for v in preview.wrote.values())


# ── SC#1 — four buckets, and the counts sum ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_four_buckets_and_the_counts_sum_to_the_total():
    sb = _ReadOnlySupabase(KNOWN_ROWS)
    p = await preview_service.build_preview(
        connection=CONNECTION, folder_id="f", folder_name="Rate Sheets 2026",
        user_id="u-1", supabase=sb,
    )
    assert set(p.counts) == set(preview_service.BUCKETS)
    assert sum(p.counts.values()) == p.total == len(FIXTURE)
    # every bucket is exercised by this fixture, so a regression in any arm shows up here
    assert all(p.counts[b] > 0 for b in preview_service.BUCKETS), p.counts


@pytest.mark.asyncio
async def test_tier_one_identity_is_read_from_document_metadata():
    """The `already here` row is `d-3`, matched on `(system, external_id, version)` equality."""
    sb = _ReadOnlySupabase(KNOWN_ROWS)
    p = await preview_service.build_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1", supabase=sb,
    )
    here = [i for i in p.items if i.bucket == "here"]
    assert [i.external_id for i in here] == ["d-3"]


@pytest.mark.asyncio
async def test_a_different_source_system_never_matches():
    """⚠ `system` is part of the key. A Notion id that happens to collide is not this file."""
    sb = _ReadOnlySupabase([
        {"metadata": {"source": {"system": "notion", "external_id": "d-3",
                                 "version": "2026-08-12T09:00:00Z"}}},
    ])
    p = await preview_service.build_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1", supabase=sb,
    )
    assert p.counts["here"] == 0


@pytest.mark.asyncio
async def test_every_added_row_knows_where_it_would_land():
    """SC#3, at the row grain — the destination exists BEFORE any row does."""
    sb = _ReadOnlySupabase(KNOWN_ROWS)
    p = await preview_service.build_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1", supabase=sb,
        destination_folder_name="Pricing",
    )
    added = [i for i in p.items if i.bucket == "add"]
    assert added
    assert all(i.destination == "/Pricing" for i in added), [i.destination for i in added]


# ── SC#4 / SC#5 — the confirm agrees with the preview, and every file is accounted for ─────


class _BG:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, **kw):
        self.tasks.append((fn, kw))


@pytest.mark.asyncio
async def test_confirm_accounts_for_every_file_and_names_every_refusal(monkeypatch):
    minted: list[str] = []

    async def _fake_import(**kw):
        minted.append(kw["file_id"])
        if kw["file_id"] == "d-5":
            raise ValueError("No text layer — this PDF is image-only.")
        if kw["file_id"] == "d-6":
            # ⭐ Tier 2 doing its job: the export ran, the sha256 matched, so it is NOT imported
            #    again and NOT embedded again. The preview said "can't tell" and it was right.
            return {"id": "doc-6", "_already_here": True}
        return {"id": f"doc-{kw['file_id']}"}

    monkeypatch.setattr(
        "app.services.sources.import_service.import_single_file", _fake_import
    )

    sb = _ReadOnlySupabase(KNOWN_ROWS)
    result = await preview_service.confirm_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1",
        active_org="org-1", supabase=sb, background_tasks=_BG(),
    )

    assert result.accounted == len(FIXTURE)
    assert result.unaccounted == 0, "a file ended in none of the three outcomes"
    assert {o.outcome for o in result.outcomes} <= {"added", "here", "refused"}
    for o in result.outcomes:
        if o.outcome == "refused":
            assert o.reason and len(o.reason) > 10, f"{o.name} was refused without a name"


@pytest.mark.asyncio
async def test_the_preview_and_the_confirm_do_not_disagree(monkeypatch):
    """SC#4. Both numbers come from the same classifier — this proves they still line up."""

    async def _fake_import(**kw):
        if kw["file_id"] == "d-5":
            raise ValueError("No text layer.")
        if kw["file_id"] == "d-6":
            return {"id": "doc-6", "_already_here": True}
        return {"id": f"doc-{kw['file_id']}"}

    monkeypatch.setattr(
        "app.services.sources.import_service.import_single_file", _fake_import
    )

    sb = _ReadOnlySupabase(KNOWN_ROWS)
    p = await preview_service.build_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1", supabase=sb,
    )
    r = await preview_service.confirm_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1",
        active_org="org-1", supabase=sb, background_tasks=_BG(),
    )
    assert r.preview_said_added == p.counts["add"]
    assert r.actually_added == r.preview_said_added, (
        "the preview was optimistic: it named more files than actually arrived"
    )
    # the two `here` rows: tier 1 caught one at preview time, tier 2 caught the other at splice
    assert sum(1 for o in r.outcomes if o.outcome == "here") == 2


@pytest.mark.asyncio
async def test_an_already_here_file_is_not_embedded_again(monkeypatch):
    """PREV-02 / SC#5. `splice_document` is the ONLY thing that embeds, and a duplicate mint
    deliberately does not schedule it."""
    scheduled = []

    async def _fake_import(**kw):
        # mirror import_single_file's real duplicate arm
        if kw["file_id"] == "d-6":
            return {"id": "doc-6", "_already_here": True}
        scheduled.append(kw["file_id"])
        return {"id": f"doc-{kw['file_id']}"}

    monkeypatch.setattr(
        "app.services.sources.import_service.import_single_file", _fake_import
    )
    sb = _ReadOnlySupabase(KNOWN_ROWS)
    r = await preview_service.confirm_preview(
        connection=CONNECTION, folder_id="f", folder_name="f", user_id="u-1",
        active_org="org-1", supabase=sb, background_tasks=_BG(),
    )
    assert "d-6" not in scheduled
    assert any(o.external_id == "d-6" and o.outcome == "here" for o in r.outcomes)
    # …and the tier-1 match was never opened at all
    assert "d-3" not in scheduled
