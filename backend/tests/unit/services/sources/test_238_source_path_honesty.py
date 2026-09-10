"""Phase 238 (D-238-07 / SEED-253) — a `path` fact is real or it is absent. Never fabricated.

⛔ THE DEFECT THIS FILE CLOSES, quoted from SEED-253 and re-driven here:

    path contains '/Finance/'   -> False    (even for a file that IS in Finance)
    path contains 'Rates'       -> True     (it is matching the FILENAME)

`path` is one of only seven fields a watch rule may name. A person picked it, wrote a
folder-shaped rule, saved it with a 200 — and got silence forever, while a *substring* rule
matched the filename and made the same dead rule look alive. Before Phase 237 `path` matched
nothing and the rule was obviously broken; the fabrication is what made it plausible.

⚠ **AND A CORRECTION TO THE SEED, MEASURED 2026-09-07 rather than inherited.** SEED-253 says
production *always* substitutes `/<filename>`. That is true of the **watch → ingest** path and
NOT of the preview path: `preview_service._walk_folder` builds a real breadcrumb from the
traversal (`:333-334`) before any fallback runs. So the live defect was narrower than the seed
states, and the narrower version is the one that got fixed — at `ingest_enrich.py`, where a
fabricated value reached a RULE, rather than at `preview_service.py`, where it reaches a row a
person is looking at.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.classification_matcher import match_metadata

BACKEND = Path(__file__).resolve().parents[4]

WATCHED = {"name", "path", "type", "size", "date", "source_system", "source_connection_id"}


def _contains(field: str, value: str) -> dict:
    return {"op": "and", "conditions": [{"field": field, "op": "contains", "value": value}]}


# ── the user-visible consequence, driven both ways ───────────────────────────────────────


def test_a_folder_rule_matches_a_real_path():
    """What the Graph adapter now supplies: `parentReference.path` + the file name."""
    facts = {"path": "/Documents/Finance/Q3 Rates.pdf", "name": "Q3 Rates.pdf"}
    assert match_metadata(_contains("path", "/Finance/"), facts, WATCHED) is True


def test_a_folder_rule_does_not_match_an_absent_path():
    """The fix. An unknown folder is UNKNOWN — the rule declines rather than guessing."""
    facts = {"name": "Q3 Rates.pdf"}
    assert match_metadata(_contains("path", "/Finance/"), facts, WATCHED) is False


def test_the_fabricated_path_was_the_thing_that_lied():
    """⭐ THE REGRESSION, PRESERVED AS A TEST rather than as a paragraph.

    This is what the old `or f"/{filename}"` produced, and it is why the defect was invisible:
    the folder rule the person wrote returned False while a substring rule they did NOT write
    returned True, so the field looked functional to anyone poking at it."""
    fabricated = {"path": "/Q3 Rates.pdf", "name": "Q3 Rates.pdf"}
    assert match_metadata(_contains("path", "/Finance/"), fabricated, WATCHED) is False
    assert match_metadata(_contains("path", "Rates"), fabricated, WATCHED) is True, (
        "the fabricated value matched the FILENAME — that is the whole bug"
    )


# ── the fabrication is gone, and the real value is written ───────────────────────────────


def test_ingest_enrich_no_longer_fabricates_a_path():
    """A source fence, because the alternative is standing up the whole enrichment pipeline
    to prove one `or` is absent. It asserts the removed EXPRESSION, not a mention."""
    src = (BACKEND / "app" / "services" / "ingest_enrich.py").read_text(encoding="utf-8")
    assert 'src_path = source_info.get("path")' in src
    assert 'f"/{filename}" if filename else None' not in src, (
        "the /<filename> fabrication is back — SEED-253 reopened"
    )


def test_EVERY_writer_of_metadata_source_carries_the_path_key():
    """⭐ THE TEST THAT WOULD HAVE CAUGHT THE 2026-09-07 LIVE MISS.

    `metadata.source` has TWO writers — `watch_service` (the scheduled loop) and
    `import_service.import_single_file` (the door a person clicks in Library -> Add files).
    Phase 238 added the `path` key to the first and missed the second, so two OneDrive files
    landed in the same Library minutes apart and only the watched one carried a folder path.
    A folder-shaped rule silently never matched anything imported by hand.

    ⚠ The miss was invisible to every per-writer test, because each writer did what its own
    test asked. **The claim that needs pinning is about the SET of writers**, which is why this
    asserts over a list rather than in two separate cases — adding a third writer without its
    `path` key fails here."""
    writers = {
        "app/services/watch_service.py": '"path": item.path,',
        "app/services/sources/import_service.py": '"path": source_path,',
    }
    for rel, needle in writers.items():
        src = (BACKEND / rel).read_text(encoding="utf-8")
        assert '"external_id"' in src, f"{rel} is no longer a metadata.source writer — update this test"
        assert needle in src, (
            f"{rel} writes metadata.source WITHOUT a path key. Both writers must carry it, or "
            "a document's folder is known through one door and unknown through the other."
        )


def test_watch_service_writes_the_path_key_into_metadata_source():
    """⚠ The key was ABSENT, which made `ingest_enrich`'s path arm dead code: the fix at one
    end only works because the other end now supplies the fact."""
    src = (BACKEND / "app" / "services" / "watch_service.py").read_text(encoding="utf-8")
    assert '"path": item.path,' in src


def test_no_source_module_falls_back_to_the_drive_adapter():
    """D-238-09.2 / the fourth leak. Two modules resolved an unknown connection to Google —
    `import_service` keyed off the connection's DISPLAY NAME, so a Microsoft connection called
    'Google migration' would have been read by the Drive adapter under a Microsoft token."""
    for rel in ("app/services/watch_service.py", "app/services/sources/import_service.py"):
        src = (BACKEND / rel).read_text(encoding="utf-8")
        assert 'SourceRegistry.get_adapter("google")' not in src, rel


@pytest.mark.parametrize("value", ["/Q3 Rates.pdf", "/report.docx"])
def test_a_bare_filename_is_not_a_path_the_contract_would_accept(value: str):
    """The invariant the conformance suite asserts per-adapter, stated once in words: a path
    names a FOLDER. One slash and a filename is the fabrication, not a location."""
    assert value.count("/") == 1, "fixture sanity"
    assert not value.rstrip("/").rsplit("/", 1)[0], "a bare filename has no folder part"
