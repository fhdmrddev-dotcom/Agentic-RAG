"""Phase 291-02 (D-20 / SEED-133) — a grounding registry that could not be read refuses the
generate in server words BEFORE any provider call, never a silent blind ok. Plus the request
body's limits (T-291-14) and its forward-verbatim rule.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from tests.unit.test_291_generate_coverage import Harness, _definition, generate


@pytest.mark.asyncio
async def test_a_degraded_registry_refuses_before_any_paid_call(monkeypatch):
    from app.services.harness.grounding import grounding_unavailable_finding

    h = Harness(monkeypatch, [_definition()], degraded={"folders"})
    result = await generate()
    assert result == {
        "ok": False,
        "error": "could_not_generate",
        "reason_code": "grounding_unavailable",
        "detail": grounding_unavailable_finding(frozenset({"folders"}))["message"],
    }
    assert "folders" in result["detail"]
    assert h.calls == []


@pytest.mark.asyncio
async def test_a_3_tuple_fake_that_ignores_the_kwarg_leaves_the_path_unchanged(monkeypatch):
    import app.services.workflow_authoring as wa

    h = Harness(monkeypatch, [_definition()])

    async def _plain_fake(**_kwargs):  # the shipped fakes' exact shape
        return ("GROUNDED", set(), set())

    monkeypatch.setattr(wa, "_assemble_grounding", _plain_fake)
    result = await generate()
    assert result["ok"] is True
    assert len(h.calls) == 1


# ── GenerateRequest (the body) ────────────────────────────────────────────────────────────


def test_more_than_five_references_is_refused():
    from app.api.workflow_authoring_doors import GenerateRequest

    refs = [{"filename": f"r{i}.txt", "text": "x"} for i in range(6)]
    with pytest.raises(ValidationError):
        GenerateRequest(describe="d", references=refs)
    assert len(GenerateRequest(describe="d", references=refs[:5]).references) == 5


@pytest.mark.parametrize("bad_key", ["a{b", "a}b", "50%", "<x>", "a\x07b", ""])
def test_a_form_field_key_with_template_characters_is_refused(bad_key):
    from app.api.workflow_authoring_doors import GenerateRequest

    form = {
        "filename": "f.pdf",
        "arm": "form_fields",
        "fields": [{"key": bad_key, "label": "L", "type": "text", "origin": "exact"}],
    }
    with pytest.raises(ValidationError):
        GenerateRequest(describe="d", form=form)


def test_the_form_forbids_undeclared_keys_and_the_reference_arm():
    from app.api.workflow_authoring_doors import GenerateRequest

    with pytest.raises(ValidationError):
        GenerateRequest(describe="d", form={"filename": "f", "arm": "reference", "fields": []})
    with pytest.raises(ValidationError):
        GenerateRequest(describe="d", form={"filename": "f", "arm": "none", "fields": [], "x": 1})


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("body_extra", "want_form", "want_refs"),
    [
        ({}, None, None),
        ({"references": []}, None, []),
        (
            {"form": {"filename": "f.pdf", "arm": "form_fields", "fields": []},
             "references": [{"filename": "r.md", "text": "t"}]},
            {"filename": "f.pdf", "arm": "form_fields", "fields": [], "text": ""},
            [{"filename": "r.md", "text": "t"}],
        ),
    ],
)
async def test_the_door_forwards_form_and_references_VERBATIM(monkeypatch, body_extra, want_form, want_refs):
    import app.api.workflow_authoring_doors as doors
    import app.services.workflow_authoring as wa

    seen: dict = {}

    async def _fake_generate(**kwargs):
        seen.update(kwargs)
        return {"ok": True}

    async def _fake_pool():
        return None

    monkeypatch.setattr(wa, "generate_workflow_definition", _fake_generate)
    monkeypatch.setattr(doors, "get_pg_pool", _fake_pool)
    body = doors.GenerateRequest(describe="d", **body_extra)
    await doors.generate_workflow(body=body, current_user={"id": "u1"}, supabase=SimpleNamespace())
    assert seen["form"] == want_form
    assert seen["references"] == want_refs
