"""Phase 305-04 (GUARD-03; D-32 / D-34 / D-35 / D-56; T-305-10 / T-305-11 / T-305-32 / T-305-33) —
the ONE outbound choke point for personal data.

Every MCP tool result passes ``guard`` in ``app.mcp.dispatch`` between the handler and the
rendering, so nothing leaves the MCP path except through here. Phase 308 reuses this module
unchanged for its own outbound path: the redactor is a ``Redactor`` protocol, the switch is a
callable, and nothing here knows about MCP.

**What is rewritten, and what never is (D-34).** The walker visits a Pydantic result model and
rewrites ONLY the fields whose annotation carries ``app.mcp.results.REDACTABLE`` (``RedactableText``:
passage text, read text, titles, folder names) — by TYPE, never by field name or by pattern. Ids,
cursors, links, ``origin``, citations, offsets and version numbers are plain fields and are passed
through byte-identical, so a redacted result still pages and its documents still open. The caller
renders the text block FROM the guarded model, so ``structuredContent`` and the text cannot diverge.

**The overlap window (D-56 / Pitfall 8).** A read chunk is one slice of a longer document; a phone,
email or IBAN cut by the chunk boundary matches in neither half. A caller may pass, per field, the
text just before and after it (``window={"text": (before, after)}``): spans are found over
``before + text + after`` and every span that INTERSECTS the field masks the intersecting part. The
next chunk, with its own window, masks its half too.

**Two failure rules, deliberately different:**

  * **fail closed** — the redactor raised, or the cooperative deadline (2 s, checked before and
    after every field) passed: return ``WITHHELD``. The caller answers with ``WITHHELD_SENTENCE``
    and audits ``redaction_blocked``. The result is NEVER sent unredacted.
  * **fail safe** — the switch could not be read (the read raised, or found no org): treat it as
    ON and redact. Not knowing whether an org asked for redaction is never a reason to skip it, and
    not a reason to withhold either — the redactor can still run.

The switch is read live on every call through the ``is_on`` callable (stricter than D-36's 30 s
bound).
"""
from __future__ import annotations

import time
from typing import Any, Awaitable, Callable, Protocol

from pydantic import BaseModel

from app.mcp.results import REDACTABLE
from app.services.pii_redactor import DeterministicRedactor, Span, apply

WITHHELD_SENTENCE = "This result was withheld because it could not be checked for personal data."


class _Withheld:
    """The one value ``guard`` returns when a result could not be checked."""

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return "WITHHELD"


WITHHELD = _Withheld()


class Redactor(Protocol):
    name: str

    def spans(self, text: str) -> list[Span]: ...


DEFAULT: Redactor = DeterministicRedactor()


class _DeadlinePassed(Exception):
    pass


def redactable_fields(model_type: type[BaseModel]) -> set[str]:
    """The names of the fields typed ``RedactableText`` on ``model_type`` (by annotation)."""
    return {
        name for name, info in model_type.model_fields.items()
        if any(meta is REDACTABLE for meta in info.metadata)
    }


async def guard(
    model: BaseModel,
    *,
    org_id: str,
    is_on: Callable[[str], Awaitable[Any]],
    redactor: Redactor = DEFAULT,
    deadline_s: float = 2.0,
    window: dict[str, tuple[str, str]] | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> BaseModel | _Withheld:
    """``model`` unchanged when the org's switch is off; a redacted copy when on; ``WITHHELD``
    when it could not be checked (see the module docstring)."""
    try:
        on = (await is_on(org_id)) is not False
    except Exception:  # noqa: BLE001 — fail SAFE: an unreadable switch redacts
        on = True
    if not on:
        return model
    deadline = clock() + deadline_s
    try:
        return _walk(model, redactor, deadline, clock, window or {}, top=True)
    except Exception:  # noqa: BLE001 — fail CLOSED: raise, deadline, anything
        return WITHHELD


def _check(deadline: float, clock: Callable[[], float]) -> None:
    if clock() > deadline:
        raise _DeadlinePassed


def _walk(value: Any, redactor: Redactor, deadline: float, clock, window: dict, *, top: bool) -> Any:
    if isinstance(value, BaseModel):
        targets = redactable_fields(type(value))
        update: dict[str, Any] = {}
        for name in type(value).model_fields:
            current = getattr(value, name)
            if name in targets and isinstance(current, str):
                _check(deadline, clock)
                ctx = window.get(name) if top else None
                redacted = _redact_field(current, redactor, ctx)
                _check(deadline, clock)
                if redacted != current:
                    update[name] = redacted
            elif isinstance(current, (BaseModel, list)):
                walked = _walk(current, redactor, deadline, clock, window, top=False)
                if walked is not current:
                    update[name] = walked
        return value.model_copy(update=update) if update else value
    if isinstance(value, list):
        walked = [_walk(v, redactor, deadline, clock, window, top=False) for v in value]
        return walked if any(a is not b for a, b in zip(walked, value)) else value
    return value


def _redact_field(text: str, redactor: Redactor, ctx: tuple[str, str] | None) -> str:
    if not text:
        return text
    if not ctx:
        return apply(text, list(redactor.spans(text)))
    before, after = ctx
    full = before + text + after
    lo, hi = len(before), len(before) + len(text)
    local: list[Span] = []
    for start, end, mask in redactor.spans(full):
        s, e = max(start, lo), min(end, hi)
        if s < e:
            local.append(Span(s - lo, e - lo, mask))
    return apply(text, local)
