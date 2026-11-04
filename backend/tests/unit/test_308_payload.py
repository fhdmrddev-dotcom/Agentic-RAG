"""Phase 308-02 (D-14 / D-15 / D-41; T-308-14) — typed, text-free webhook payloads through the
redaction guard's ONE opt-in.

* THIN IS LITERAL: every payload model carries ids, a status, a timestamp and a link — no name,
  title, filename, input, output, error or free text, and no field typed ``dict`` / ``Any`` /
  ``tuple`` / ``set`` anywhere in the tree (D-14).
* ``outbound_guard.guard(..., textless_ok=True)`` with the org switch ON returns a text-free model
  whose frozen bytes equal the switch-OFF bytes; the DEFAULT (``textless_ok=False``) still withholds
  it, exactly as 305 shipped; a dict inside a text-free model is still WITHHELD (D-41).
* No module under ``backend/app/mcp/`` passes ``textless_ok`` — MCP behaviour is byte-identical.
"""
from __future__ import annotations

import ast
import json
import typing
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import BaseModel, ConfigDict, ValidationError

from app.mcp import results as R
from app.models import webhook as W
from app.services import outbound_guard
from app.services.outbound_guard import WITHHELD, guard, redactable_fields

ORG = UUID("44444444-4444-4444-8444-444444444444")
RUN = UUID("aaaaaaaa-0000-4000-8000-000000000001")
WF = UUID("bbbbbbbb-0000-4000-8000-000000000002")
DOC = UUID("dddddddd-0000-4000-8000-000000000003")
FOLDER = UUID("ffffffff-0000-4000-8000-000000000004")
ENDPOINT = UUID("eeeeeeee-0000-4000-8000-000000000005")
T0 = datetime(2026, 11, 4, 12, 0, 0, tzinfo=timezone.utc)

PAYLOAD_MODELS = [
    W.RunEvent, W.DocumentEvent, W.TestEvent, W.RunEventData, W.DocumentEventData, W.TestEventData,
]
FORBIDDEN_FIELD_NAMES = {"name", "title", "filename", "input", "output", "error", "text"}


async def _on(_org):
    return True


async def _off(_org):
    return False


def _run_event(**over):
    kw = dict(type="run.finished", event_id_created_at=T0, run_id=RUN, workflow_id=WF, org_id=ORG,
              status="completed", origin_kind="schedule")
    kw.update(over)
    return W.build_run_event(**kw)


def _doc_event():
    return W.build_document_event(event_id_created_at=T0, document_id=DOC, folder_id=FOLDER, org_id=ORG)


def _test_event():
    return W.build_test_event(ENDPOINT, T0)


def _all_events():
    return [_run_event(), _run_event(type="run.waiting", status="paused", origin_kind=None,
                                     workflow_id=None), _doc_event(), _test_event()]


# ── the shape (D-14) ───────────────────────────────────────────────────────────────────────


def test_the_test_message_is_fixed():
    assert W.TEST_MESSAGE == "This is a test event from Syrel."


@pytest.mark.parametrize("model", PAYLOAD_MODELS, ids=lambda m: m.__name__)
def test_no_payload_model_declares_redactable_text(model):
    assert redactable_fields(model) == set()


@pytest.mark.parametrize("model", PAYLOAD_MODELS, ids=lambda m: m.__name__)
def test_no_field_could_carry_a_persons_words(model):
    assert not (set(model.model_fields) & FORBIDDEN_FIELD_NAMES), model.model_fields.keys()


def _annotations_in(annotation):
    yield annotation
    for arg in typing.get_args(annotation):
        yield from _annotations_in(arg)


@pytest.mark.parametrize("model", PAYLOAD_MODELS, ids=lambda m: m.__name__)
def test_no_field_is_untyped_or_a_container_the_guard_cannot_read(model):
    for name, info in model.model_fields.items():
        for ann in _annotations_in(info.annotation):
            origin = typing.get_origin(ann) or ann
            assert ann is not typing.Any, f"{model.__name__}.{name} is Any"
            assert origin not in (dict, tuple, set, frozenset, list), f"{model.__name__}.{name}: {ann}"


@pytest.mark.parametrize("model", PAYLOAD_MODELS, ids=lambda m: m.__name__)
def test_every_payload_model_is_frozen_and_forbids_extra(model):
    assert model.model_config.get("extra") == "forbid"
    assert model.model_config.get("frozen") is True


def test_the_envelope_is_type_timestamp_data():
    for event in _all_events():
        assert set(type(event).model_fields) == {"type", "timestamp", "data"}


def test_run_event_carries_ids_status_origin_and_the_run_link():
    event = _run_event()
    assert event.type == "run.finished"
    assert event.timestamp == T0
    d = event.data
    assert (d.run_id, d.workflow_id, d.org_id, d.status, d.origin_kind) == (RUN, WF, ORG, "completed", "schedule")
    assert d.link == R.run_link(str(RUN))


def test_document_event_carries_ids_and_the_document_link():
    event = _doc_event()
    assert event.type == "document.ingested"
    d = event.data
    assert (d.document_id, d.folder_id, d.org_id, d.status) == (DOC, FOLDER, ORG, "completed")
    assert d.link == R.doc_link(str(DOC))


def test_test_event_carries_the_endpoint_and_the_fixed_message():
    event = _test_event()
    assert event.type == "webhook.test"
    assert event.data.endpoint_id == ENDPOINT
    assert event.data.message == W.TEST_MESSAGE


def test_the_test_message_cannot_be_anything_else():
    with pytest.raises(ValidationError):
        W.TestEventData(endpoint_id=ENDPOINT, message="Jane's phone is +44 20 7946 0958")


@pytest.mark.parametrize("bad", [
    dict(status="running"), dict(origin_kind="email"), dict(type="run.started"),
])
def test_run_event_literals_are_closed(bad):
    with pytest.raises(ValidationError):
        _run_event(**bad)


def test_extra_fields_are_refused():
    with pytest.raises(ValidationError):
        W.RunEventData(run_id=RUN, workflow_id=WF, org_id=ORG, status="completed", origin_kind="app",
                       link="https://x/app/runs/1", title="Payroll")


def test_the_links_are_imported_never_copied():
    src = Path(W.__file__).read_text(encoding="utf-8")
    assert "def doc_link" not in src and "def run_link" not in src
    assert "from app.mcp.results import" in src


# ── serialisation (D-11: the exact bytes are signed and sent) ──────────────────────────────


def test_serialize_payload_is_canonical_ascii_json():
    event = _run_event()
    body = W.serialize_payload(event)
    assert isinstance(body, bytes)
    body.decode("ascii")
    assert body == json.dumps(
        event.model_dump(mode="json"), separators=(",", ":"), ensure_ascii=True, sort_keys=True,
    ).encode("ascii")
    assert W.serialize_payload(_run_event()) == body
    assert json.loads(body)["data"]["run_id"] == str(RUN)


# ── the guard's one opt-in (D-41 / D-15) ───────────────────────────────────────────────────


@pytest.mark.parametrize("event", _all_events(), ids=lambda e: e.type)
async def test_switch_on_with_textless_ok_gives_byte_identical_bytes(event):
    off = await guard(event, org_id=str(ORG), is_on=_off, textless_ok=True)
    on = await guard(event, org_id=str(ORG), is_on=_on, textless_ok=True)
    assert on is not WITHHELD and off is not WITHHELD
    assert W.serialize_payload(on) == W.serialize_payload(off) == W.serialize_payload(event)


async def test_the_default_still_withholds_a_text_free_model_exactly_as_305_shipped():
    assert await guard(_run_event(), org_id=str(ORG), is_on=_on) is WITHHELD


async def test_switch_off_returns_the_model_either_way():
    event = _run_event()
    assert await guard(event, org_id=str(ORG), is_on=_off) is event
    assert await guard(event, org_id=str(ORG), is_on=_off, textless_ok=True) is event


class _SneakyData(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    run_id: UUID
    extra: dict


class _SneakyTuple(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    run_id: UUID
    extra: tuple


@pytest.mark.parametrize("model", [
    _SneakyData(run_id=RUN, extra={"note": "Jane +44 20 7946 0958"}),
    _SneakyTuple(run_id=RUN, extra=("Jane",)),
])
async def test_a_container_inside_a_text_free_model_is_still_withheld(model):
    assert await guard(model, org_id=str(ORG), is_on=_on, textless_ok=True) is WITHHELD


async def test_a_raw_dict_is_withheld_even_with_textless_ok():
    assert await guard({"run_id": str(RUN)}, org_id=str(ORG), is_on=_on, textless_ok=True) is WITHHELD


async def test_an_unreadable_switch_still_passes_a_text_free_model_with_textless_ok():
    async def broken(_org):
        raise RuntimeError("db down")

    event = _run_event()
    out = await guard(event, org_id=str(ORG), is_on=broken, textless_ok=True)
    assert out is not WITHHELD
    assert W.serialize_payload(out) == W.serialize_payload(event)


def test_textless_ok_is_the_last_keyword_only_parameter_and_defaults_false():
    import inspect

    params = list(inspect.signature(outbound_guard.guard).parameters.values())
    last = params[-1]
    assert last.name == "textless_ok"
    assert last.kind is inspect.Parameter.KEYWORD_ONLY
    assert last.default is False


def test_no_mcp_module_passes_textless_ok():
    mcp_dir = Path(R.__file__).resolve().parent
    offenders = []
    for path in sorted(mcp_dir.rglob("*.py")):
        src = path.read_text(encoding="utf-8")
        if "textless_ok" in src:
            offenders.append(str(path))
            continue
        for node in ast.walk(ast.parse(src)):
            if isinstance(node, ast.Call) and any(k.arg == "textless_ok" for k in node.keywords):
                offenders.append(str(path))
    assert offenders == []
    assert len(list(mcp_dir.rglob("*.py"))) > 5, "the scan collapsed — it walked no MCP modules"
