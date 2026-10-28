"""Phase 298-03 (ORG-06 / D-19 / D-21 / D-33) — the pure half of the org move, without a DB.

The live half (every refusal class driven against real Postgres, the one-transaction write, the
audit row, membership in both orgs, TOCTOU) is ``tests/integration/test_298_org_move_live.py``.

Here: the exact sentences (UI-SPEC §4 copy contract — item in curly quotes, cause, way out; exact
plurals, never ``document(s)``), kind / id validation (422, never a lookup), the refusal order, the
count folding the confirm reads (UI-D18), the audit metadata shape (D-20), and two source fences:
the receipt is an INSERT on the transaction connection (never the swallowing ``write_audit_entry``)
and membership is checked inside ``con.transaction()``.
"""
from __future__ import annotations

import importlib
import inspect
import re

import pytest


@pytest.fixture
def mod():
    return importlib.import_module("app.services.org_move")


def _code(mod) -> str:
    src = inspect.getsource(mod)
    src = re.sub(r'"""[\s\S]*?"""', '""', src)  # docstrings out
    return "\n".join(line.split("#", 1)[0] for line in src.splitlines())


# ── §1 validation ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize("kind", ["folder", "document", "draft"])
def test_the_three_kinds_parse(mod, kind):
    assert mod.parse_kind(kind) == kind


@pytest.mark.parametrize("kind", ["thread", "run", "published", "", None, "FOLDER"])
def test_any_other_kind_is_a_worded_422(mod, kind):
    with pytest.raises(mod.MoveRefused) as e:
        mod.parse_kind(kind)
    assert e.value.status == 422
    assert e.value.sentence == mod.BAD_KIND


@pytest.mark.parametrize(
    "value",
    ["not-a-uuid", "", None, "1234", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa}"],
)
def test_a_non_uuid_id_is_a_422(mod, value):
    with pytest.raises(mod.MoveRefused) as e:
        mod.parse_id(value)
    assert e.value.status == 422


def test_a_canonical_uuid_parses_case_insensitively(mod):
    assert str(mod.parse_id("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA")) == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


# ── §2 the words ──────────────────────────────────────────────────────────────


def test_plurals_are_exact(mod):
    assert mod.plural(1, "document", "documents") == "1 document"
    assert mod.plural(0, "document", "documents") == "0 documents"
    assert mod.plural(14, "document", "documents") == "14 documents"


def test_the_ui_spec_exemplars_verbatim(mod):
    assert mod.s_org_shared("Q3 Contracts", "Personal") == (
        "“Q3 Contracts” is shared with everyone in Personal. Make it private first, then move it."
    )
    assert mod.s_legal_hold("Q3 Contracts", "Personal") == (
        "“Q3 Contracts” is under a legal hold, so it stays in Personal until the hold is released."
    )
    assert mod.s_watched("Q3 Contracts") == (
        "“Q3 Contracts” is kept in sync from a connected source. Stop watching it first, then move it."
    )
    assert mod.s_retention_policy("Q3 Contracts", "Personal") == (
        "“Q3 Contracts” has a retention policy in Personal. An org admin must remove it first."
    )
    assert mod.s_retention_queue("folder", "Q3 Contracts", 2) == (
        "2 documents in “Q3 Contracts” are waiting on a retention decision."
    )
    assert mod.s_not_owned_documents("Q3 Contracts", 3) == (
        "“Q3 Contracts” holds 3 documents you don't own, so it can't move as a whole."
    )
    assert mod.s_chats("Q3 Contracts", 2, "Personal") == (
        "2 chats in Personal use “Q3 Contracts”. Moving it would cut them off from it."
    )
    assert mod.s_workflows("Q3 Contracts", "Contract review", 0) == (
        "The workflow “Contract review” uses “Q3 Contracts”. Moving the folder would stop it running."
    )
    assert mod.s_collision("MSA.pdf", "Acme Legal") == "“MSA.pdf” is already in Acme Legal."
    assert mod.s_version_split("MSA.pdf") == (
        "“MSA.pdf” has earlier versions outside this folder, so they would be split across organizations."
    )
    assert mod.s_processing("folder", "Q3 Contracts", 3) == (
        "3 documents in “Q3 Contracts” are still processing. Try again when they finish."
    )
    assert mod.s_expert("Q3 Contracts", "Personal") == "An Expert installed in Personal reads “Q3 Contracts”."
    assert mod.s_classification_rule("Q3 Contracts", "Personal") == (
        "A classification rule in Personal files documents into “Q3 Contracts”."
    )
    assert mod.s_saved_view("Invoices", "Q3 Contracts") == "The saved view “Invoices” looks inside “Q3 Contracts”."
    assert mod.s_recall_check("folder", "Q3 Contracts") == "A recall check expects a document in “Q3 Contracts”."
    assert mod.s_draft_folder("Q3 Contracts", "Personal", "Acme Legal") == (
        "Its knowledge base “Q3 Contracts” is in Personal. Pick a folder from Acme Legal first, then move it."
    )
    assert mod.s_family_in_folder("MSA.pdf") == (
        "“MSA.pdf” has a version inside a folder, so it can't move on its own."
    )


def test_singular_forms_read_as_english(mod):
    assert mod.s_chats("Q3", 1, "Personal") == "1 chat in Personal uses “Q3”. Moving it would cut it off from it."
    assert mod.s_retention_queue("folder", "Q3", 1) == "1 document in “Q3” is waiting on a retention decision."
    assert mod.s_processing("folder", "Q3", 1) == "1 document in “Q3” is still processing. Try again when it finishes."
    assert mod.s_not_owned_folders("Q3", 1) == "“Q3” holds 1 folder you don't own, so it can't move as a whole."
    assert mod.s_schedules("Brief", 1, "Personal") == "“Brief” has 1 schedule in Personal. Remove it first, then move it."
    assert mod.s_api_keys("Brief", 1, "Personal") == (
        "An API key in Personal can start “Brief”. Remove it from the key first, then move it."
    )
    assert mod.s_api_keys("Brief", 2, "Personal") == (
        "2 API keys in Personal can start “Brief”. Remove it from the keys first, then move it."
    )
    assert mod.s_live_run("Brief", 1) == "“Brief” has 1 run in progress. Wait for it to finish or stop it, then move it."


def test_a_root_document_is_one_item_to_the_reader(mod):
    assert mod.s_processing("document", "MSA.pdf", 3) == "“MSA.pdf” is still processing. Try again when it finishes."
    assert mod.s_retention_queue("document", "MSA.pdf", 2) == "“MSA.pdf” is waiting on a retention decision."
    assert mod.s_recall_check("document", "MSA.pdf") == "A recall check expects “MSA.pdf”."


def test_a_workflow_the_caller_cannot_open_is_never_named(mod):
    assert mod.s_workflows("Q3", None, 0) == "A workflow you can't open uses “Q3”. Moving the folder would stop it running."
    assert mod.s_workflows("Q3", "Brief", 2).endswith(" 2 other workflows use it too.")
    assert mod.s_workflows("Q3", "Brief", 1).endswith(" 1 other workflow uses it too.")


def test_a_draft_folder_in_an_unreadable_org_or_unseen_is_never_named(mod):
    assert mod.s_draft_folder("Q3", None, "Acme") == (
        "Its knowledge base “Q3” is in another organization. Pick a folder from Acme first, then move it."
    )
    assert mod.s_draft_folder(None, None, "Acme") == (
        "Its knowledge base is a folder you can't open. Pick a folder from Acme first, then move it."
    )


def test_published_and_starter_drafts_are_worded(mod):
    assert mod.s_published("Brief").startswith("“Brief” is published, and published workflows can't move")
    assert mod.s_system_global("Starter") == "“Starter” is a starter workflow everyone shares, so it can't move."


def test_no_sentence_carries_a_code_or_a_placeholder(mod):
    samples = [
        mod.NOT_FOUND, mod.TARGET_NOT_MEMBER, mod.SOURCE_NOT_MEMBER, mod.BAD_KIND, mod.BAD_ID,
        mod.s_name_in_target("MSA.pdf", "Acme"), mod.s_relationship("MSA.pdf", "Personal"),
        mod.s_archived("folder", "Q3", 2), mod.s_retention_receipt("folder", "Q3", 2, "Personal"),
        mod.s_shared_documents("folder", "Q3", 2, "Personal"),
    ]
    for s in samples:
        assert "{" not in s and "_" not in s and "(s)" not in s, s
        assert s.endswith("."), s


# ── §3 order, counts, receipt ─────────────────────────────────────────────────


def test_refusals_come_out_in_the_d33_order_whatever_the_insertion_order(mod):
    found = {"collision": ["c"], "org_shared": ["a"], "chats": ["b1", "b2"]}
    assert mod.order_refusals(found) == ["a", "b1", "b2", "c"]


def test_an_unknown_refusal_code_is_a_programming_error(mod):
    with pytest.raises(ValueError):
        mod.order_refusals({"nope": ["x"]})


def test_the_order_names_every_d33_class(mod):
    for code in (
        "org_shared", "legal_hold", "watched", "retention_policy", "retention_queue",
        "retention_receipt", "archived", "not_owned_folders", "not_owned_documents", "chats",
        "workflows", "expert", "classification_rule", "saved_view", "recall_check", "processing",
        "version_split", "family_in_folder", "relationship", "collision", "published",
        "system_global", "live_run", "schedules", "api_keys", "draft_folders",
    ):
        assert code in mod.REFUSAL_ORDER, code
    assert len(set(mod.REFUSAL_ORDER)) == len(mod.REFUSAL_ORDER)


def test_counts_fold_per_kind(mod):
    c = mod.fold_counts("folder", folder_count=3, latest_documents=14, earlier_versions=2)
    assert (c.subfolders, c.documents, c.earlier_versions, c.past_runs) == (2, 14, 2, 0)
    c = mod.fold_counts("folder", folder_count=1)
    assert (c.subfolders, c.documents) == (0, 0)
    c = mod.fold_counts("document", earlier_versions=2)
    assert (c.subfolders, c.documents, c.earlier_versions) == (0, 1, 2)
    c = mod.fold_counts("draft", past_runs=3)
    assert (c.documents, c.past_runs) == (0, 3)


def test_the_audit_metadata_names_kind_item_both_orgs_and_counts(mod):
    p = mod.MovePreview(
        kind="folder", item_id="i", item_name="Q3", from_org_id="a", from_org_name="A",
        to_org_id="b", to_org_name="B", counts=mod.fold_counts("folder", folder_count=2, latest_documents=1),
    )
    assert mod.audit_metadata(p) == {
        "kind": "folder", "item_id": "i", "from_org": "a", "to_org": "b",
        "counts": {"subfolders": 1, "documents": 1, "earlier_versions": 0, "past_runs": 0},
    }


def test_the_child_tables_are_the_measured_set(mod):
    assert set(mod.DOCUMENT_CHILD_TABLES) == {
        "document_chunks", "document_images", "document_tables", "pdf_extraction_runs", "ingestion_jobs",
    }


# ── §4 source fences (D-35) ───────────────────────────────────────────────────


def test_the_receipt_is_an_insert_never_write_audit_entry(mod):
    code = _code(mod)
    assert "write_audit_entry" not in code
    assert len(re.findall(r"INSERT INTO (public\.)?audit_log", code, re.IGNORECASE)) == 1


def test_membership_and_locks_run_inside_the_transaction(mod):
    src = inspect.getsource(mod.execute_move)
    body = src.split("async with con.transaction():", 1)
    assert len(body) == 2, "execute_move opens no transaction"
    assert "_prepare(" in body[1] and "lock=True" in body[1]
    prepare = inspect.getsource(mod._prepare)
    assert prepare.count("_MEMBER_SQL") >= 2  # target AND source, on the same connection
    assert "FOR UPDATE" in _code(mod)


def test_there_is_no_bulk_entry_point(mod):
    public = [n for n, v in vars(mod).items() if inspect.iscoroutinefunction(v) and not n.startswith("_")]
    assert sorted(public) == ["execute_move", "preview_move"]
