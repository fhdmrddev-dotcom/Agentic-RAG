"""Phase 294 Plan 02 (D-18) — the decision held-out set is frozen, and its bytes are its hash.

The fixture is committed with its sha256 sidecar BEFORE any engine is measured. These tests pin
its shape and its hash, so an edit to the questions after the fact cannot pass silently, and
``decision_eval.load_heldout`` refuses the same mismatch at run time.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from app.services.recall_eval import EVAL_PROBES

FIXTURES = Path(__file__).resolve().parent / "fixtures"
FIXTURE = FIXTURES / "decision_heldout_v1.json"
SIDECAR = FIXTURES / "decision_heldout_v1.sha256"


def _payload() -> dict:
    return json.loads(FIXTURE.read_bytes().decode("utf-8"))


def test_bytes_hash_to_the_committed_sidecar():
    digest = hashlib.sha256(FIXTURE.read_bytes()).hexdigest()
    recorded = SIDECAR.read_text(encoding="ascii").split()[0]
    assert re.fullmatch(r"[0-9a-f]{64}", recorded)
    assert digest == recorded


def test_fixture_is_lf_only():
    # The hash is over these exact bytes; .gitattributes pins eol=lf so a Windows checkout cannot
    # rewrite them into CRLF and break the freeze.
    assert b"\r" not in FIXTURE.read_bytes()


def test_shape_and_minimum_sizes():
    payload = _payload()
    assert payload["version"] == 1
    items = payload["items"]
    assert len(items) >= 50
    chunk_items = [item for item in items if item["kind"] == "chunk"]
    assert len(chunk_items) >= 40
    for item in chunk_items:
        target = item["target"]
        assert re.fullmatch(r"[0-9a-f]{64}", target["chunk_sha256"])
        assert isinstance(target["chunk_index"], int)
        assert target["document_id"]
    assert {item["kind"] for item in items} <= {"chunk", "probe"}


def test_ids_are_unique():
    ids = [item["id"] for item in _payload()["items"]]
    assert len(ids) == len(set(ids))


def test_probe_items_are_exactly_the_eval_probes_less_the_named_unresolved_ones():
    payload = _payload()
    unresolved = set(payload["unresolved_probes"])
    expected = {probe["query"] for probe in EVAL_PROBES if probe["target_filename"] not in unresolved}
    probe_queries = [item["query"] for item in payload["items"] if item["kind"] == "probe"]
    assert len(probe_queries) == len(set(probe_queries))
    assert set(probe_queries) == expected
    # every unresolved name really is an EVAL_PROBES target, so nothing is dropped silently
    assert unresolved <= {probe["target_filename"] for probe in EVAL_PROBES}


def test_fixture_stores_questions_ids_and_hashes_never_chunk_text():
    # T-294-11: chunk content stays in the database; the fixture carries a hash of it.
    for item in _payload()["items"]:
        assert "content" not in item
        assert "content" not in item["target"]
