"""Phase 102 (D-01 / SEED-082) — the ``citation_policy`` enum dispositions.

Plan 04 GREEN (un-marked from the Plan-01 Wave-0 RED stubs). One policy family governs
the citation gate (and the judge gate): ``strict | flag | partial | draft``. ``strict``
is the DEFAULT and stays byte-identical (today's honest-fail, handled inline in
``_exec_llm_emit`` — never routed through ``emit_policy``). Every non-strict mode marks
or blanks — never a silent pass-off of unverified data as authoritative (T-102-04-03).

``flag``/``partial``/``draft`` are pure ``emit_policy.apply_citation_policy`` transforms
over the WR-02-persisted field-map (NO new emit shot — the deterministic driver
re-renders the modified map). Imports INSIDE the body.
"""

from __future__ import annotations

import pytest


def test_strict_is_byte_identical():
    """``citation_policy="strict"`` (default) -> the uncited disposition is the existing
    state-(b) honest fail; ``apply_citation_policy`` REFUSES strict (the strict path is
    inline, never routed here) so it can never silently deliver an uncited map."""
    from app.models.harness import LlmEmitPhaseConfig
    from app.services.harness import emit_policy

    # The default is strict (the enum default, Plan 02).
    cfg = LlmEmitPhaseConfig(phase_type="llm_emit", prompt="x")
    assert cfg.citation_policy == "strict"

    # strict is the inline honest-fail path — apply_citation_policy must REFUSE it so a
    # refactor can never accidentally deliver an uncited map under strict.
    with pytest.raises(ValueError):
        emit_policy.apply_citation_policy(
            field_map={"scalars": {}, "collections": {}},
            gate={"uncited_leaves": ["k"]},
            policy="strict",
        )


def test_flag_delivers_with_marks():
    """``flag`` -> delivers WITH visible marks + a coverage summary (never silent)."""
    from app.services.harness import emit_policy

    # WR-06 (102-08): the verdict carries the FULL "{location}.{field}" leaf string
    # exactly as check_coverage produces it for the flat scalar shape (scalar.k), not
    # the bare field name — matching is on the full (location, field) pair.
    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": [{"key": "k", "value": "v", "citation": None}], "rows": []},
        gate={"uncited_leaves": ["scalar.k"]},
        policy="flag",
    )
    assert applied["delivered"] is True
    assert "unverified" in str(applied).lower()
    assert applied.get("coverage_summary")
    # The uncited value was actually MARKED in the returned field-map.
    assert "[unverified]" in applied["field_map"]["scalars"][0]["value"]


def test_flag_marks_legacy_envelope():
    """``flag`` over the LEGACY generic envelope (the executor's legacy_map shape) marks
    the uncited scalar — leaf-name matching handles the dotted ``scalar.k`` verdict key."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": {"k": {"value": "v", "source_chunk_id": None}}, "collections": {}},
        gate={"uncited_leaves": ["scalar.k"]},
        policy="flag",
    )
    assert applied["delivered"] is True
    assert "[unverified]" in applied["field_map"]["scalars"]["k"]["value"]


def test_partial_blanks_uncited():
    """``partial`` -> blanks the ``gate["uncited_leaves"]`` values + a gap list; delivers."""
    from app.services.harness import emit_policy

    # WR-06 (102-08): full-pair leaf string (scalar.k), as check_coverage produces it.
    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": [{"key": "k", "value": "v", "citation": None}], "rows": []},
        gate={"uncited_leaves": ["scalar.k"]},
        policy="partial",
    )
    assert applied["delivered"] is True
    assert applied.get("gap_list")  # the blanked-key gap list
    # The uncited value was actually BLANKED (null-over-invent).
    assert applied["field_map"]["scalars"][0]["value"] is None


def test_draft_labels_and_delivers():
    """``draft`` -> no citation enforcement, doc labeled DRAFT, delivers."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": [{"key": "k", "value": "v", "citation": None}], "rows": []},
        gate={"uncited_leaves": ["k"]},
        policy="draft",
    )
    assert applied["delivered"] is True
    assert "draft" in str(applied).lower()
    # draft does NOT enforce citations — the value is delivered unmarked + unblanked.
    assert applied["field_map"]["scalars"][0]["value"] == "v"


# ---------------------------------------------------------------------------
# Plan 102-08 Task 1 — WR-06: full (location, field) leaf matching + invented +
# strict-fallback on a no-op. The Plan-04 leaf matching was on the BARE field
# name, which over-blanks a cited sibling cell with the same column key
# (risks0.risk_id uncited would blank risks1.risk_id cited). And invented leaves
# were ignored entirely. And a verdict that named offenders but matched NO leaf
# silently claimed success.
# ---------------------------------------------------------------------------


def _collection_field_map():
    """A legacy generic envelope with a 2-row collection sharing a column name.

    risks0.risk_id is UNCITED (no source), risks1.risk_id is CITED (real source).
    The WR-06 bug: matching on the bare 'risk_id' field name marks/blanks BOTH.
    """
    return {
        "scalars": {},
        "collections": {
            "risks": [
                {"risk_id": {"value": "R-uncited", "source_chunk_id": None}},
                {"risk_id": {"value": "R-cited", "source_chunk_id": "chunk-1"}},
            ]
        },
    }


def test_partial_does_not_blank_cited_sibling_cell():
    """WR-06: partial blanks ONLY the named uncited (location, field) leaf —
    a CITED sibling cell with the same column name is PRESERVED (the full
    (location, field) pair, not the bare field name)."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map=_collection_field_map(),
        gate={"uncited_leaves": ["risks0.risk_id"], "invented_leaves": []},
        policy="partial",
    )
    assert applied["delivered"] is True
    rows = applied["field_map"]["collections"]["risks"]
    # The uncited leaf was blanked …
    assert rows[0]["risk_id"]["value"] is None
    # … but the CITED sibling cell (same column name) is untouched.
    assert rows[1]["risk_id"]["value"] == "R-cited"


def test_flag_does_not_mark_cited_sibling_cell():
    """WR-06: flag marks ONLY the named uncited (location, field) leaf — the
    cited sibling cell with the same column name carries no [unverified] mark."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map=_collection_field_map(),
        gate={"uncited_leaves": ["risks0.risk_id"], "invented_leaves": []},
        policy="flag",
    )
    assert applied["delivered"] is True
    rows = applied["field_map"]["collections"]["risks"]
    assert "[unverified]" in rows[0]["risk_id"]["value"]
    assert "[unverified]" not in rows[1]["risk_id"]["value"]


def test_partial_blanks_invented_leaf():
    """WR-06: partial blanks INVENTED-citation leaves too (gate['invented_leaves']),
    not just uncited ones — an invented citation is no better than no citation."""
    from app.services.harness import emit_policy

    fm = {
        "scalars": {"top_risk": {"value": "made up", "source_chunk_id": "not-retrieved"}},
        "collections": {},
    }
    applied = emit_policy.apply_citation_policy(
        field_map=fm,
        gate={"uncited_leaves": [], "invented_leaves": ["scalar.top_risk"]},
        policy="partial",
    )
    assert applied["delivered"] is True
    assert applied["field_map"]["scalars"]["top_risk"]["value"] is None
    assert "top_risk" in applied["coverage_summary"]


def test_flag_marks_invented_leaf():
    """WR-06: flag marks INVENTED-citation leaves too."""
    from app.services.harness import emit_policy

    fm = {
        "scalars": {"top_risk": {"value": "made up", "source_chunk_id": "not-retrieved"}},
        "collections": {},
    }
    applied = emit_policy.apply_citation_policy(
        field_map=fm,
        gate={"uncited_leaves": [], "invented_leaves": ["scalar.top_risk"]},
        policy="flag",
    )
    assert applied["delivered"] is True
    assert "[unverified]" in applied["field_map"]["scalars"]["top_risk"]["value"]


def test_partial_falls_back_to_strict_when_no_leaf_modified():
    """WR-06 honesty: the verdict named offenders but NONE matched a real leaf
    (e.g. a stale/mismatched leaf string) — partial must FAIL BACK TO STRICT
    rather than claim a false success with a gap list of never-blanked keys."""
    from app.services.harness import emit_policy

    # The map has a cited scalar; the verdict names a leaf that is NOT in the map.
    fm = {"scalars": {"a": {"value": "v", "source_chunk_id": "chunk-1"}}, "collections": {}}
    applied = emit_policy.apply_citation_policy(
        field_map=fm,
        gate={"uncited_leaves": ["scalar.ghost"], "invented_leaves": []},
        policy="partial",
    )
    assert applied["delivered"] is False
    assert applied.get("fallback") == "strict"
    assert applied.get("reason")


def test_flag_falls_back_to_strict_when_no_leaf_modified():
    """WR-06 honesty: flag fails back to strict when the verdict named offenders
    but zero leaves were actually marked."""
    from app.services.harness import emit_policy

    fm = {"scalars": {"a": {"value": "v", "source_chunk_id": "chunk-1"}}, "collections": {}}
    applied = emit_policy.apply_citation_policy(
        field_map=fm,
        gate={"uncited_leaves": ["scalar.ghost"], "invented_leaves": []},
        policy="flag",
    )
    assert applied["delivered"] is False
    assert applied.get("fallback") == "strict"


def test_draft_unaffected_by_fallback():
    """WR-06: draft (no enforcement) never falls back — it always delivers."""
    from app.services.harness import emit_policy

    fm = {"scalars": {"a": {"value": "v", "source_chunk_id": "chunk-1"}}, "collections": {}}
    applied = emit_policy.apply_citation_policy(
        field_map=fm,
        gate={"uncited_leaves": ["scalar.ghost"], "invented_leaves": []},
        policy="draft",
    )
    assert applied["delivered"] is True
    assert applied["field_map"]["scalars"]["a"]["value"] == "v"


# ---------------------------------------------------------------------------
# Plan 102-08 Task 3 — UN-MOCKED render-gate round-trip (CR-02). The Plan-04
# tests above exercise only the pure apply_citation_policy transform; the
# verification flagged that the RENDER ROUND-TRIP was never driven — the
# previously-hollow path. These drive _render_template_post -> the REAL
# _handle_render_template with the citation gate UN-mocked (check_coverage + the
# gate condition are real). Mocking is allowed ONLY BELOW the gate: the strict
# reject returns AT the gate (resolve_template_source is never reached); the
# deliver cases pass the gate then stop at a mocked resolve_template_source so we
# assert on the GATE VERDICT (rejected vs proceeding past), not real docx bytes.
# ---------------------------------------------------------------------------


def _render_ctx():
    """A minimal ctx for _handle_render_template. The gate runs BEFORE any ctx use;
    the deliver cases only reach resolve_template_source (mocked), which reads these
    attrs to BUILD the call expression — their values are irrelevant (the mock ignores
    args)."""
    from types import SimpleNamespace

    return SimpleNamespace(
        pool=None,
        supabase=None,
        thread_id="t-1",
        current_user={"id": "u-1"},
        redis=None,
        run_id="r-1",
        emit=lambda *a, **k: None,
    )


def _uncited_field_map():
    """A legacy generic envelope with ONE uncited value — the strict gate rejects it
    (uncited_value_count == 1). retrieved_ids is empty so the value is uncited."""
    return {
        "scalars": {"top_risk": {"value": "supply chain", "source_chunk_id": None}},
        "collections": {},
    }


async def _drive_render(monkeypatch, field_map, *, citation_policy_applied):
    """Drive _render_template_post -> the REAL _handle_render_template gate. Mocks ONLY
    resolve_template_source (BELOW the gate) so a passing gate stops at template
    resolution with a known error verdict (status='error', reason='template_resolution')
    — we then distinguish 'rejected' (gate blocked) from 'proceeded past the gate'."""
    from app.services.harness import emitters

    async def _fake_resolve(**kwargs):
        # Below the gate — a passing gate reaches here; return a clean error so the
        # handler returns BEFORE touching the sandbox (we assert on the gate verdict).
        return {"error": "STOP-AFTER-GATE (resolve mocked below the gate)"}

    # Patch in the SOURCE module (the handler imports it function-locally).
    monkeypatch.setattr(
        "app.services.template_asset_service.resolve_template_source", _fake_resolve
    )

    resolved_template = {
        "filename": "risk-register.docx",
        "retrieved_ids": [],  # nothing retrieved -> the value is uncited
        "asset_ref": None,  # ephemeral-upload branch (no real asset resolution)
    }
    if citation_policy_applied is not None:
        resolved_template["citation_policy_applied"] = citation_policy_applied

    return await emitters._render_template_post(field_map, resolved_template, _render_ctx())


@pytest.mark.asyncio
async def test_render_gate_rejects_strict_uncited(monkeypatch):
    """Strict (no citation_policy_applied): the REAL handler gate hard-rejects an uncited
    map — the default trust bar holds byte-identical (T-102-08-01)."""
    verdict = await _drive_render(
        monkeypatch, _uncited_field_map(), citation_policy_applied=None
    )
    assert verdict["status"] == "rejected"
    assert verdict["reason"] == "uncited_or_invented"


@pytest.mark.asyncio
async def test_render_gate_delivers_flag(monkeypatch):
    """flag: apply the policy, set citation_policy_applied='flag', drive the REAL gate —
    the gate does NOT reject (it proceeds past the citation gate to template resolution).
    The delivered map carries the [unverified] mark on the uncited value."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        _uncited_field_map(),
        gate={"uncited_leaves": ["scalar.top_risk"], "invented_leaves": []},
        policy="flag",
    )
    assert applied["delivered"] is True
    marked = applied["field_map"]
    assert "[unverified]" in marked["scalars"]["top_risk"]["value"]

    verdict = await _drive_render(monkeypatch, marked, citation_policy_applied="flag")
    # The gate did NOT reject — the call proceeded past it (stopped at the mocked resolve).
    assert verdict["status"] != "rejected"
    assert verdict.get("reason") != "uncited_or_invented"
    # Proof it reached BELOW the gate (template resolution), not bounced at the gate.
    assert verdict["reason"] == "template_resolution"


@pytest.mark.asyncio
async def test_render_gate_delivers_partial(monkeypatch):
    """partial: the uncited cell is BLANKED (value None) and a CITED sibling cell with
    the same column name is NOT blanked (WR-06); the gate does not reject; gap list set."""
    from app.services.harness import emit_policy

    fm = {
        "scalars": {},
        "collections": {
            "risks": [
                {"risk_id": {"value": "R-uncited", "source_chunk_id": None}},
                {"risk_id": {"value": "R-cited", "source_chunk_id": "chunk-1"}},
            ]
        },
    }
    applied = emit_policy.apply_citation_policy(
        fm,
        gate={"uncited_leaves": ["risks0.risk_id"], "invented_leaves": []},
        policy="partial",
    )
    assert applied["delivered"] is True
    rows = applied["field_map"]["collections"]["risks"]
    assert rows[0]["risk_id"]["value"] is None  # uncited blanked
    assert rows[1]["risk_id"]["value"] == "R-cited"  # CITED sibling preserved (WR-06)
    assert applied.get("gap_list")  # the blanked-leaf gap list

    # The blanked map still has a CITED value (risks1.risk_id) — drive it with retrieved
    # ids matching so the gate sees zero uncited; the policy made it gate-clean. Assert the
    # gate does NOT reject.
    verdict = await _drive_render(monkeypatch, applied["field_map"], citation_policy_applied="partial")
    assert verdict["status"] != "rejected"
    assert verdict["reason"] == "template_resolution"


@pytest.mark.asyncio
async def test_render_gate_delivers_draft(monkeypatch):
    """draft: no citation enforcement — the gate does not reject (policy applied) and the
    draft label is present in the policy result."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        _uncited_field_map(),
        gate={"uncited_leaves": ["scalar.top_risk"], "invented_leaves": []},
        policy="draft",
    )
    assert applied["delivered"] is True
    assert applied.get("draft_label")

    verdict = await _drive_render(monkeypatch, applied["field_map"], citation_policy_applied="draft")
    assert verdict["status"] != "rejected"
    assert verdict["reason"] == "template_resolution"
