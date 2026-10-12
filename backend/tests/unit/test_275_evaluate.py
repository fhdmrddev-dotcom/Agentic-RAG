"""Phase 275-03 (RET-03 / D-06 / D-11 / D-19 / D-20 / D-22..D-25 / D-34) — the ONE retention rule.

``app.services.retention.evaluate.evaluate(family, ctx, now)`` decides what happens to one version
family. Preview, the org dry run, the nightly sweep, the confirm re-check and the Library's
document-states all call it, so "what Preview showed" and "what the sweep did" cannot disagree
(Pitfall 14). These cases pin the decision ORDER and every fail-closed state:

  private → held → no_policy → collision → not_previewed → no_date → kept/unarchived → due/not_due,
  and an existing matching queue row → pending.

The Halden & Co. case at the bottom is the sketch's own 24-document worked example
(``.planning/sketches/275-retention-legal-hold/index.html`` :199-263, today = 12 Oct 2026). Its
expected buckets were COMPUTED by running the sketch's own ``evaluate()`` in node — never
hand-typed — and are quoted with that provenance next to each assertion.
"""
from __future__ import annotations

import dataclasses
import inspect
from datetime import date, datetime, timezone

import pytest

from app.services.retention.evaluate import (
    ARCHIVE_KINDS,
    DISPOSE_KINDS,
    QUEUE_DELETE_KINDS,
    UNDECIDABLE_KINDS,
    Decision,
    EvalContext,
    FamilyFacts,
    PolicyFacts,
    QueueMarker,
    SkipMarker,
    Stage,
    evaluate,
    fingerprint,
    kept_for_text,
    scope_text,
)

NOW = datetime(2026, 10, 12, 2, 0, tzinfo=timezone.utc)


def policy(
    pid="P",
    *,
    name=None,
    folder=None,
    type_norm=None,
    sub=True,
    clock="document_date",
    s1=(1, "years", "archive"),
    s2=None,
    revision=1,
    previewed=1,
):
    return PolicyFacts(
        id=pid,
        name=name or f"Policy {pid}",
        scope_kind="folder" if folder else "class",
        folder_id=folder,
        include_subfolders=sub,
        document_type_norm=type_norm,
        clock=clock,
        stage1=Stage(*s1),
        stage2=Stage(*s2) if s2 else None,
        revision=revision,
        previewed_revision=previewed,
    )


def family(
    key="F",
    *,
    latest="d1",
    rows=None,
    folder=None,
    type_norm=None,
    date_typed=None,
    created=datetime(2020, 1, 1, tzinfo=timezone.utc),
    archived=None,
    visible=True,
    name=None,
):
    return FamilyFacts(
        family_key=key,
        latest_id=latest,
        row_ids=tuple(rows or (latest,)),
        file_paths=tuple(f"u/{r}" for r in (rows or (latest,))),
        org_id="org",
        folder_id=folder,
        document_type_norm=type_norm,
        date_typed=date_typed,
        created_at=created,
        archived_at=archived,
        org_visible=visible,
        name=name or key,
    )


def ctx(*policies, parents=None, held=None, skips=None, pending=None):
    return EvalContext(
        folder_parent=parents or {},
        folder_policies={p.folder_id: p for p in policies if p.scope_kind == "folder"},
        class_policies={p.document_type_norm: p for p in policies if p.scope_kind == "class"},
        held=held or {},
        skips=skips or {},
        pending=pending or {},
    )


# ── the order, case by case ────────────────────────────────────────────────────────────────

def test_a_private_document_is_never_covered():
    p = policy(folder="f1")
    d = evaluate(family(folder="f1", date_typed=date(2010, 1, 1), visible=False), ctx(p), NOW)
    assert d.kind == "private"
    assert d.policy_ids == ("P",), "Preview counts private documents the policy would have covered"
    assert d.kind not in DISPOSE_KINDS


def test_held_comes_before_every_policy_decision():
    p = policy(folder="f1")
    d = evaluate(
        family(folder="f1", date_typed=date(2010, 1, 1)),
        ctx(p, held={"F": datetime(2026, 8, 3, tzinfo=timezone.utc)}),
        NOW,
    )
    assert d.kind == "held"
    assert d.held_since == datetime(2026, 8, 3, tzinfo=timezone.utc)


def test_no_folder_or_class_policy_is_no_policy():
    d = evaluate(family(folder="f9", type_norm="invoice", date_typed=date(2010, 1, 1)), ctx(policy(folder="f1")), NOW)
    assert d.kind == "no_policy" and d.policy_ids == ()


def test_a_folder_and_a_class_policy_that_differ_collide_and_nothing_happens():
    fp = policy("PF", folder="f1", s1=(7, "years", "archive"))
    cp = policy("PC", type_norm="invoice", s1=(10, "years", "delete"))
    d = evaluate(family(folder="f1", type_norm="invoice", date_typed=date(2000, 1, 1)), ctx(fp, cp), NOW)
    assert d.kind == "collision", "D-24: never 'longest keep wins'"
    assert d.policy_ids == ("PF", "PC")
    assert d.kind in UNDECIDABLE_KINDS and d.kind not in DISPOSE_KINDS


def test_a_folder_and_a_class_policy_with_identical_rules_agree():
    fp = policy("PF", folder="f1", s1=(7, "years", "archive"))
    cp = policy("PC", type_norm="invoice", s1=(7, "years", "archive"))
    d = evaluate(family(folder="f1", type_norm="invoice", date_typed=date(2000, 1, 1)), ctx(fp, cp), NOW)
    assert d.kind == "archive"
    assert d.policy_ids == ("PF", "PC")


def test_a_policy_saved_without_a_preview_of_this_revision_does_nothing():
    p = policy(folder="f1", revision=3, previewed=2)
    d = evaluate(family(folder="f1", date_typed=date(2000, 1, 1)), ctx(p), NOW)
    assert d.kind == "not_previewed" and d.kind not in DISPOSE_KINDS


def test_document_date_clock_with_no_document_date_is_no_date_with_no_fallback():
    p = policy(folder="f1", clock="document_date")
    d = evaluate(
        family(folder="f1", date_typed=None, created=datetime(2001, 1, 1, tzinfo=timezone.utc)), ctx(p), NOW,
    )
    assert d.kind == "no_date", "D-22: created_at is NEVER a fallback for the document date"


def test_date_added_clock_uses_created_at_even_when_a_document_date_exists():
    p = policy(folder="f1", clock="date_added", s1=(1, "years", "archive"))
    fam = family(folder="f1", date_typed=date(2000, 1, 1), created=datetime(2026, 6, 1, tzinfo=timezone.utc))
    d = evaluate(fam, ctx(p), NOW)
    assert d.kind == "not_due"
    assert d.due_at == date(2027, 6, 1)


def test_nearest_ancestor_folder_policy_wins_and_two_depths_never_collide():
    outer = policy("OUT", folder="top", s1=(1, "days", "delete"))
    inner = policy("IN", folder="mid", s1=(50, "years", "archive"))
    parents = {"leaf": "mid", "mid": "top", "top": None}
    d = evaluate(family(folder="leaf", date_typed=date(2020, 1, 1)), ctx(outer, inner, parents=parents), NOW)
    assert d.kind == "not_due" and d.policy_ids == ("IN",), "D-23: the nearest folder policy decides"


def test_a_folder_policy_without_subfolders_does_not_cover_a_child_folder():
    p = policy(folder="top", sub=False, s1=(1, "days", "archive"))
    parents = {"child": "top", "top": None}
    child = evaluate(family(folder="child", date_typed=date(2020, 1, 1)), ctx(p, parents=parents), NOW)
    own = evaluate(family(folder="top", date_typed=date(2020, 1, 1)), ctx(p, parents=parents), NOW)
    assert child.kind == "no_policy"
    assert own.kind == "archive"


def test_a_folder_walk_with_a_cycle_ends():
    p = policy(folder="z", s1=(1, "days", "archive"))
    parents = {"a": "b", "b": "a"}
    d = evaluate(family(folder="a", date_typed=date(2020, 1, 1)), ctx(p, parents=parents), NOW)
    assert d.kind == "no_policy"


def test_the_latest_row_decides_and_the_decision_carries_every_row():
    p = policy(folder="f1", s1=(1, "years", "archive"))
    fam = family(latest="v3", rows=("v1", "v2", "v3"), folder="f1", date_typed=date(2020, 1, 1))
    d = evaluate(fam, ctx(p), NOW)
    assert d.kind == "archive"
    assert set(d.row_ids) == {"v1", "v2", "v3"}, "D-25: versions age and dispose together"
    assert "v3" in (d.fingerprint or "")


def test_two_stage_past_stage_two_archives_and_queues_delete():
    p = policy(folder="f1", clock="date_added", s1=(1, "days", "archive"), s2=(2, "days", "delete"))
    fam = family(folder="f1", created=datetime(2026, 10, 9, 12, tzinfo=timezone.utc))
    d = evaluate(fam, ctx(p), NOW)
    assert d.kind == "archive_and_queue_delete"
    assert d.queue_kind == "delete"
    assert d.kind in ARCHIVE_KINDS and d.kind in QUEUE_DELETE_KINDS


def test_two_stage_already_archived_past_stage_two_only_queues_delete():
    p = policy(folder="f1", clock="date_added", s1=(1, "days", "archive"), s2=(2, "days", "delete"))
    fam = family(folder="f1", created=datetime(2026, 10, 1, tzinfo=timezone.utc), archived=datetime(2026, 10, 3, tzinfo=timezone.utc))
    d = evaluate(fam, ctx(p), NOW)
    assert d.kind == "queue_delete"


def test_two_stage_between_the_stages_archives_then_says_when_delete_is_due():
    p = policy(folder="f1", clock="date_added", s1=(1, "days", "archive"), s2=(30, "days", "delete"))
    fam = family(folder="f1", created=datetime(2026, 10, 1, tzinfo=timezone.utc))
    assert evaluate(fam, ctx(p), NOW).kind == "archive"
    archived = dataclasses.replace(fam, archived_at=datetime(2026, 10, 2, tzinfo=timezone.utc))
    d = evaluate(archived, ctx(p), NOW)
    assert d.kind == "already_archived" and d.due_at == date(2026, 10, 31)


@pytest.mark.parametrize("action,kind,qkind", [
    ("archive", "archive", None),
    ("delete", "queue_delete", "delete"),
    ("review", "queue_review", "review"),
])
def test_stage_one_actions(action, kind, qkind):
    p = policy(folder="f1", s1=(1, "years", action))
    d = evaluate(family(folder="f1", date_typed=date(2020, 1, 1)), ctx(p), NOW)
    assert d.kind == kind and d.queue_kind == qkind


def test_an_archived_document_under_an_archive_policy_is_already_archived():
    p = policy(folder="f1", s1=(1, "years", "archive"))
    d = evaluate(family(folder="f1", date_typed=date(2020, 1, 1), archived=NOW), ctx(p), NOW)
    assert d.kind == "already_archived" and d.kind not in DISPOSE_KINDS


def test_not_yet_due_names_the_due_date():
    p = policy(folder="f1", s1=(7, "years", "archive"))
    d = evaluate(family(folder="f1", date_typed=date(2021, 4, 8)), ctx(p), NOW)
    assert d.kind == "not_due" and d.due_at == date(2028, 4, 8)


def test_a_matching_queue_row_is_pending_and_a_stale_one_is_not():
    p = policy(folder="f1", s1=(1, "years", "delete"))
    fam = family(folder="f1", date_typed=date(2020, 1, 1))
    first = evaluate(fam, ctx(p), NOW)
    assert first.kind == "queue_delete"
    same = {("P", "F", "delete"): QueueMarker(revision=1, fingerprint=first.fingerprint)}
    assert evaluate(fam, ctx(p, pending=same), NOW).kind == "pending"
    stale = {("P", "F", "delete"): QueueMarker(revision=1, fingerprint="something-else")}
    assert evaluate(fam, ctx(p, pending=stale), NOW).kind == "queue_delete"


def test_a_skip_marker_skips_until_the_policy_or_the_document_changes():
    p = policy(folder="f1", s1=(1, "years", "delete"), revision=2, previewed=2)
    fam = family(folder="f1", date_typed=date(2020, 1, 1))
    fp = evaluate(fam, ctx(p), NOW).fingerprint
    kept = {("P", "F"): SkipMarker(revision=2, fingerprint=fp, reason="kept", actor_name="Amira Sato")}
    d = evaluate(fam, ctx(p, skips=kept), NOW)
    assert d.kind == "kept" and d.skip is not None and d.skip.actor_name == "Amira Sato"

    older = {("P", "F"): SkipMarker(revision=1, fingerprint=fp, reason="kept")}
    assert evaluate(fam, ctx(p, skips=older), NOW).kind == "queue_delete", "a policy edit re-opens it"

    unarchived = {("P", "F"): SkipMarker(revision=2, fingerprint=fp, reason="unarchived")}
    assert evaluate(fam, ctx(p, skips=unarchived), NOW).kind == "unarchived"


@pytest.mark.parametrize("change", [
    {"latest_id": "d2", "row_ids": ("d1", "d2")},
    {"folder_id": "f1b"},
    {"date_typed": date(2019, 5, 5)},
    {"document_type_norm": "contract"},
])
def test_a_changed_document_drops_the_skip_marker(change):
    p = policy(folder="f1", s1=(1, "years", "delete"))
    parents = {"f1b": "f1", "f1": None}
    fam = family(folder="f1", date_typed=date(2020, 1, 1))
    fp = evaluate(fam, ctx(p, parents=parents), NOW).fingerprint
    kept = {("P", "F"): SkipMarker(revision=1, fingerprint=fp, reason="kept")}
    moved = dataclasses.replace(fam, **change)
    assert evaluate(moved, ctx(p, parents=parents, skips=kept), NOW).kind == "queue_delete"


def test_fingerprint_names_every_input():
    a = fingerprint("d1", date(2020, 1, 1), "f1", "invoice")
    assert a != fingerprint("d2", date(2020, 1, 1), "f1", "invoice")
    assert a != fingerprint("d1", date(2020, 1, 2), "f1", "invoice")
    assert a != fingerprint("d1", date(2020, 1, 1), "f2", "invoice")
    assert a != fingerprint("d1", date(2020, 1, 1), "f1", "contract")


@pytest.mark.parametrize("bad", [Stage(1, "weeks", "archive"), Stage(1, "years", "shred")])
def test_an_unreadable_rule_is_undecidable_never_a_disposal(bad):
    p = dataclasses.replace(policy(folder="f1"), stage1=bad)
    d = evaluate(family(folder="f1", date_typed=date(2000, 1, 1)), ctx(p), NOW)
    assert d.kind in UNDECIDABLE_KINDS and d.kind not in DISPOSE_KINDS


def test_rule_and_scope_text_are_the_sketch_sentences():
    p = policy(folder="/Finance/Invoices", s1=(7, "years", "archive"))
    assert kept_for_text(p) == "7 years after the document date"
    assert scope_text(p, folder_path="/Finance/Invoices") == "All documents in /Finance/Invoices (and subfolders)"
    two = policy(folder="x", clock="date_added", s1=(1, "days", "archive"), s2=(2, "days", "delete"))
    assert kept_for_text(two) == "1 day after added to the Library, delete after 2 days"
    cls = policy(type_norm="personnel record")
    assert scope_text(cls) == "Personnel records anywhere"


# ── purity fences (the health_verdict precedent) ─────────────────────────────────────────────

def test_the_module_does_no_io():
    from app.services.retention import evaluate as mod

    src = inspect.getsource(mod)
    for forbidden in ("app.db", "app.api", "asyncpg", "supabase", "app.dependencies", "httpx", "open("):
        assert forbidden not in src, f"evaluate must not reach {forbidden}"


def test_decision_and_facts_are_frozen():
    d = Decision(kind="no_policy", policy_ids=(), due_at=None, rule_text="")
    with pytest.raises(dataclasses.FrozenInstanceError):
        d.kind = "archive"  # type: ignore[misc]
    with pytest.raises(dataclasses.FrozenInstanceError):
        family().org_visible = False  # type: ignore[misc]


# ── the Halden & Co. worked example (sketch :199-263, today = 12 Oct 2026) ──────────────────
#
# Ported AS DATA from the sketch's DOCS array. Two mappings, each forced by a locked decision and
# recorded here so the port is auditable:
#   * P2 "Expired contracts" is folder /Contracts/Expired AND type Contract in the sketch. A stored
#     policy is ONE scope (migration 204 retention_policies_scope_shape), so it is ported as the
#     folder policy — every document in that folder is a Contract, so the covered set is identical.
#   * P3 "Personnel records" counts from "last modified" in the sketch. D-22 allows only the
#     document date or the date added, so P3 is ported with the document date and its expected
#     bucket comes from the sketch's evaluate() run with from="docDate".

HALDEN_FOLDERS = {
    "/Finance": None, "/Finance/Invoices": "/Finance", "/Finance/Reports": "/Finance",
    "/Contracts": None, "/Contracts/Expired": "/Contracts",
    "/HR": None, "/HR/Personnel": "/HR", "/HR/Policies": "/HR",
    "/Projects": None, "/Projects/Atlas": "/Projects",
}

# id, name, type, folder, document date, added, archived — verbatim from index.html :200-223
HALDEN_DOCS = [
    ("i1", "Invoice INV-0412", "invoice", "/Finance/Invoices", "2016-05-03", "2022-01-10", "2026-09-14"),
    ("i2", "Invoice INV-0598", "invoice", "/Finance/Invoices", "2017-11-20", "2022-01-10", None),
    ("i3", "Invoice INV-0611", "invoice", "/Finance/Invoices", "2018-02-07", "2022-01-10", None),
    ("i4", "Invoice INV-0733", "invoice", "/Finance/Invoices", "2018-12-14", "2022-01-10", None),
    ("i5", "Invoice INV-0877", "invoice", "/Finance/Invoices", "2019-09-10", "2022-01-10", None),
    ("i6", "Invoice INV-0902 (scan)", "invoice", "/Finance/Invoices", None, "2022-01-10", None),
    ("i7", "Invoice INV-1043", "invoice", "/Finance/Invoices", "2021-04-08", "2022-01-10", None),
    ("i8", "Invoice INV-1188", "invoice", "/Finance/Invoices", "2024-06-30", "2024-07-02", None),
    ("i9", "Invoice INV-1290", "invoice", "/Finance/Invoices", "2025-04-09", "2025-04-10", None),
    ("c1", "Halvorsen Supply Agreement", "contract", "/Contracts/Expired", "2014-03-02", "2021-11-03", None),
    ("c2", "Brightwater Office Lease", "contract", "/Contracts/Expired", "2013-06-18", "2021-11-03", None),
    ("c3", "Kessler Services Agreement", "contract", "/Contracts/Expired", "2014-09-30", "2021-11-03", None),
    ("c4", "Olsen Consulting SOW", "contract", "/Contracts/Expired", "2015-01-12", "2021-11-03", None),
    ("c5", "Meridian Mutual NDA", "contract", "/Contracts/Expired", "2015-08-04", "2021-11-03", None),
    ("c6", "Fjord Logistics MSA", "contract", "/Contracts/Expired", None, "2021-11-03", None),
    ("c7", "Halvorsen Amendment 1", "contract", "/Contracts/Expired", "2016-03-01", "2021-11-03", None),
    ("c8", "Ostrava Distribution Agreement", "contract", "/Contracts/Expired", "2017-05-22", "2021-11-03", None),
    ("h1", "Personnel file — E. Lindqvist", "personnel record", "/HR/Personnel", "2014-02-01", "2021-06-01", None),
    ("h2", "Personnel file — M. Kaur", "personnel record", "/HR/Personnel", "2018-09-01", "2021-06-01", None),
    ("h3", "Personnel file — T. Brandt", "personnel record", "/HR/Personnel", "2016-04-11", "2021-06-01", None),
    ("a1", "Halvorsen correspondence 2013–2016", "correspondence", "/Projects/Atlas", "2016-06-30", "2023-03-12", None),
    ("a2", "Atlas kickoff deck", "presentation", "/Projects/Atlas", "2023-03-01", "2023-03-12", None),
    ("r1", "Q3 2025 Revenue Report", "report", "/Finance/Reports", "2025-10-01", "2025-10-04", None),
    ("p1", "Remote Work Policy", "policy", "/HR/Policies", "2024-08-01", "2024-08-30", None),
]

# Holds (sketch :236-239): H1 covers c1, c7 directly and /Projects/Atlas (a1, a2); H2 is released.
HALDEN_HELD = {"c1", "c7", "a1", "a2"}

HALDEN_POLICIES = [
    policy("P1", name="Finance invoices", folder="/Finance/Invoices", s1=(7, "years", "archive")),
    policy("P2", name="Expired contracts", folder="/Contracts/Expired", s1=(10, "years", "delete")),
    policy("P3", name="Personnel records", type_norm="personnel record", s1=(6, "years", "review")),
]


def _halden():
    fams = []
    for did, name, type_norm, folder, doc_date, added, archived in HALDEN_DOCS:
        fams.append(FamilyFacts(
            family_key=did, latest_id=did, row_ids=(did,), file_paths=(f"halden/{did}",), org_id="halden",
            folder_id=folder, document_type_norm=type_norm,
            date_typed=date.fromisoformat(doc_date) if doc_date else None,
            created_at=datetime.fromisoformat(added).replace(tzinfo=timezone.utc),
            archived_at=datetime.fromisoformat(archived).replace(tzinfo=timezone.utc) if archived else None,
            org_visible=True, name=name,
        ))
    c = ctx(
        *HALDEN_POLICIES, parents=HALDEN_FOLDERS,
        held={k: datetime(2026, 8, 3, tzinfo=timezone.utc) for k in HALDEN_HELD},
    )
    return {f.family_key: evaluate(f, c, NOW) for f in fams}


def _buckets(decisions, pid):
    out = {"act": set(), "hold": set(), "undecidable": set(), "not_yet": set(), "already": set()}
    for key, d in decisions.items():
        if pid not in d.policy_ids:
            continue
        if d.kind in DISPOSE_KINDS or d.kind == "pending":
            out["act"].add(key)
        elif d.kind == "held":
            out["hold"].add(key)
        elif d.kind in UNDECIDABLE_KINDS:
            out["undecidable"].add(key)
        elif d.kind == "not_due":
            out["not_yet"].add(key)
        elif d.kind == "already_archived":
            out["already"].add(key)
    return out


def test_halden_finance_invoices_matches_the_sketch():
    # node: sketch evaluate(P1) → act [i2,i3,i4,i5], unknown [i6], notyet [i7,i8,i9], already [i1]
    b = _buckets(_halden(), "P1")
    assert b == {
        "act": {"i2", "i3", "i4", "i5"}, "hold": set(), "undecidable": {"i6"},
        "not_yet": {"i7", "i8", "i9"}, "already": {"i1"},
    }
    d = _halden()
    assert d["i2"].due_at == date(2024, 11, 20) and d["i7"].due_at == date(2028, 4, 8)


def test_halden_expired_contracts_matches_the_sketch():
    # node: sketch evaluate(P2) → act [c2,c3,c4,c5], hold [c1,c7], unknown [c6], notyet [c8]
    # (the sketch's own History row: "4 would be deleted, 2 held, 1 undecidable", index.html :273)
    b = _buckets(_halden(), "P2")
    assert b == {
        "act": {"c2", "c3", "c4", "c5"}, "hold": {"c1", "c7"}, "undecidable": {"c6"},
        "not_yet": {"c8"}, "already": set(),
    }
    assert all(_halden()[k].kind == "queue_delete" for k in ("c2", "c3", "c4", "c5")), "D-08: deletes are QUEUED"


def test_halden_personnel_records_matches_the_sketch_with_the_document_date():
    # node: sketch evaluate({...P3, from:"docDate"}) → act [h1,h2,h3]
    b = _buckets(_halden(), "P3")
    assert b["act"] == {"h1", "h2", "h3"} and not b["hold"] and not b["undecidable"]
    assert {_halden()[k].kind for k in ("h1", "h2", "h3")} == {"queue_review"}


def test_halden_org_wide_totals():
    d = _halden()
    kinds = {k: v.kind for k, v in d.items()}
    assert sorted(k for k, v in kinds.items() if v in ARCHIVE_KINDS) == ["i2", "i3", "i4", "i5"]
    assert sorted(k for k, v in kinds.items() if v in QUEUE_DELETE_KINDS) == ["c2", "c3", "c4", "c5"]
    assert sorted(k for k, v in kinds.items() if v == "held") == ["a1", "a2", "c1", "c7"]
    assert sorted(k for k, v in kinds.items() if v in UNDECIDABLE_KINDS) == ["c6", "i6"]
    assert sorted(k for k, v in kinds.items() if v == "no_policy") == ["p1", "r1"]
    assert len(d) == 24
