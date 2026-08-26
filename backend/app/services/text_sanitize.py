"""The ONE home for "make this string storable in a Postgres `text`/`jsonb` column".

⚠ THIS MODULE EXISTS BECAUSE THE PROJECT HAD THREE PRIVATE COPIES AND ONE PATH WITH NONE.
`agent_loop.py` and `tool_dispatcher.py` each strip NUL on the way to the DB, and
`email_extraction_service.scrub_text` was added in Phase 203 after a real `.msg` died with
``22P05: unsupported Unicode escape sequence — \u0000 cannot be converted to text``. The
DOCUMENT ingestion path stripped nothing at all, so BUG-260825-01 reproduced the identical
failure one path over: a `.txt` and a `.csv` carrying a NUL both reached
``status=failed`` / ``ingestion_step=embedding`` with that same `22P05`, MEASURED
2026-08-25 through the real ``POST /documents/upload`` endpoint.

⚠ POSTGRES REFUSES NUL IN `text` AT ANY DEPTH — there is no encoding that stores it, so this
cannot be pushed down to the driver or fixed with a cast. It has to be removed at the
boundary where the value is produced.

⚠ A NUL IS NOT ALWAYS REACHABLE, AND THAT IS WORTH KNOWING BEFORE BLAMING THIS MODULE FOR A
FAILURE IT CANNOT PREVENT. A `.docx` carrying a NUL dies EARLIER, inside `python-docx`, with
``Char 0x0 out of allowed range`` — XML forbids NUL, so lxml refuses to parse and no text is
ever produced. Scrubbing cannot save that file; only the producer can.

`email_extraction_service.scrub_text` re-exports `scrub_text` from here, so the Phase 203
import path stays live and its unit tests keep passing unedited.
"""
from __future__ import annotations

__all__ = ["scrub_text"]

#: The three C0 controls that carry meaning in ordinary document / email text.
_KEEP_CONTROLS = "\t\n\r"


def scrub_text(value: str | None) -> str:
    """Strip characters Postgres `text` cannot store, and normalise to a real string.

    Removes NUL and the other C0/C1 control characters, KEEPING the three whitespace
    controls that carry meaning in a body (``\t``, ``\n``, ``\r``). Never returns None.

    ⚠ Byte-identical to the Phase 203 `email_extraction_service.scrub_text` it replaces —
    the filter expression is unchanged, so every email fixture keeps its exact prior output.
    """
    if not value:
        return ""
    return "".join(
        ch for ch in str(value)
        if ch in _KEEP_CONTROLS or (ch >= " " and ch != "\x7f")
    )
