"""305-REVIEW-04 WR-04-02 — the outbound guard must never pass a result shape it does not understand.

Before the fix, with the switch ON:
* a handler that returned a ``CallToolResult`` skipped the guard entirely (dispatch only guarded a
  ``BaseModel``), so its text reached the client unread;
* a field typed ``RedactableText | None`` or ``list[RedactableText]`` was not recognised as
  redactable (the REDACTABLE marker sits one level down in the annotation) and passed unmasked;
* a ``dict`` / ``tuple`` field was never visited.

None of these is reachable through the three 305 tools, but 308 reuses this module unchanged, so the
rule is: redact what is typed redactable at any depth, and WITHHOLD any shape the walker cannot read.
A pass-through list fences every plain ``str`` the three result models carry today.
"""
from __future__ import annotations

import typing

from mcp import types
from pydantic import BaseModel

from app.mcp import results as R
from app.services.outbound_guard import WITHHELD, guard

ORG = "44444444-4444-4444-8444-444444444444"
EMAIL = "jane.doe@example.com"


async def _on(_org):
    return True


async def _off(_org):
    return False


class _Optional(BaseModel):
    note: R.RedactableText | None = None


class _Listed(BaseModel):
    notes: list[R.RedactableText]


class _WithDict(BaseModel):
    extra: dict[str, str]


class _WithTuple(BaseModel):
    pair: tuple[str, str]


async def test_an_optional_redactable_field_is_masked():
    out = await guard(_Optional(note=f"mail {EMAIL}"), org_id=ORG, is_on=_on)
    assert out is not WITHHELD
    assert out.note == "mail [email removed]"


async def test_an_optional_redactable_field_left_empty_is_fine():
    model = _Optional()
    out = await guard(model, org_id=ORG, is_on=_on)
    assert out is not WITHHELD and out.note is None


async def test_a_list_of_redactable_text_is_masked_item_by_item():
    out = await guard(_Listed(notes=["plain", f"to {EMAIL}"]), org_id=ORG, is_on=_on)
    assert out is not WITHHELD
    assert out.notes == ["plain", "to [email removed]"]


async def test_a_dict_field_is_withheld_when_on_and_passed_through_when_off():
    model = _WithDict(extra={"k": EMAIL})
    assert await guard(model, org_id=ORG, is_on=_on) is WITHHELD
    assert await guard(model, org_id=ORG, is_on=_off) is model


async def test_a_tuple_field_is_withheld_when_on():
    assert await guard(_WithTuple(pair=(EMAIL, "x")), org_id=ORG, is_on=_on) is WITHHELD


async def test_a_call_tool_result_is_withheld_when_on_and_passed_through_when_off():
    result = types.CallToolResult(content=[types.TextContent(type="text", text=EMAIL)], is_error=False)
    assert await guard(result, org_id=ORG, is_on=_on) is WITHHELD
    assert await guard(result, org_id=ORG, is_on=_off) is result


# ── the fence: every plain str the shipped result models carry is NAMED as pass-through ─────────

PASS_THROUGH = {
    "Passage.document_id", "Passage.link",
    "FolderEntry.folder_id",
    "DocumentEntry.document_id", "DocumentEntry.link",
    "ListResult.next_cursor",
    "ReadResult.document_id", "ReadResult.link", "ReadResult.next_cursor",
}


def _carries_str(annotation) -> bool:
    if annotation is str:
        return True
    return any(_carries_str(a) for a in typing.get_args(annotation) if not isinstance(a, (str, int)))


def _str_fields(model: type[BaseModel], seen: set) -> set[str]:
    out: set[str] = set()
    if model in seen:
        return out
    seen.add(model)
    for name, info in model.model_fields.items():
        ann = info.annotation
        nested = [a for a in (ann, *typing.get_args(ann)) if isinstance(a, type) and issubclass(a, BaseModel)]
        for sub in nested:
            out |= _str_fields(sub, seen)
        if any(meta is R.REDACTABLE for meta in info.metadata):
            continue
        if typing.get_origin(ann) is typing.Literal:
            continue
        if _carries_str(ann):
            out.add(f"{model.__name__}.{name}")
    return out


def test_every_plain_str_in_the_shipped_result_models_is_a_named_pass_through():
    seen: set = set()
    found = set()
    for model in (R.SearchResult, R.ListResult, R.ReadResult):
        found |= _str_fields(model, seen)
    assert found == PASS_THROUGH, (
        "a result model gained a plain str field: type it RedactableText, or add it here ON PURPOSE"
    )
