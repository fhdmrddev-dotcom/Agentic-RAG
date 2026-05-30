"""Unit tests for backend/app/api/workspace.py:_decode_inline_content.

Phase 084 Plan 05: pin every bytea wire shape we've seen across the UAT.
Specifically locks in the ``\\x...`` hex-bytea branch added 2026-05-28 to
fix the REST /content empty-body blocker (Test 9 in 084-HUMAN-UAT.md)
where supabase-py returns ``content_inline`` as a hex-escape string.
"""

from __future__ import annotations

import base64


def test_decode_inline_content_bytes() -> None:
    from app.api.workspace import _decode_inline_content
    assert _decode_inline_content(b"hello world") == "hello world"


def test_decode_inline_content_bytearray() -> None:
    from app.api.workspace import _decode_inline_content
    assert _decode_inline_content(bytearray(b"hello world")) == "hello world"


def test_decode_inline_content_memoryview() -> None:
    from app.api.workspace import _decode_inline_content
    assert _decode_inline_content(memoryview(b"hello world")) == "hello world"


def test_decode_inline_content_hex_bytea_str() -> None:
    """The exact shape supabase-py v2.x returns -- confirmed via runtime
    probe 2026-05-28 ('\\x68656c6c6f20776f726c64' for 'hello world')."""
    from app.api.workspace import _decode_inline_content
    assert _decode_inline_content(r"\x68656c6c6f20776f726c64") == "hello world"


def test_decode_inline_content_hex_bytea_str_uppercase() -> None:
    """`bytes.fromhex` is case-insensitive; document the contract."""
    from app.api.workspace import _decode_inline_content
    assert _decode_inline_content(r"\x68656C6C6F") == "hello"


def test_decode_inline_content_base64_str_fallback() -> None:
    """Older supabase-py / direct JSON path may emit base64. Keep the
    fallback so future client downgrades don't regress."""
    from app.api.workspace import _decode_inline_content
    encoded = base64.b64encode(b"hello world").decode("ascii")
    assert _decode_inline_content(encoded) == "hello world"


def test_decode_inline_content_dict_buffer() -> None:
    """Some supabase-py builds wrap bytea as {"type": "Buffer", "data": [...]}.
    Defense-in-depth so a future client upgrade can't silently regress."""
    from app.api.workspace import _decode_inline_content
    buf = {"type": "Buffer", "data": list(b"hello world")}
    assert _decode_inline_content(buf) == "hello world"


def test_decode_inline_content_none() -> None:
    from app.api.workspace import _decode_inline_content
    assert _decode_inline_content(None) == ""


def test_decode_inline_content_malformed_string_returns_empty() -> None:
    """Unrecognized string shape: not hex-bytea, not valid base64 -- must
    not raise; return '' so the endpoint stays robust."""
    from app.api.workspace import _decode_inline_content
    # `not!base64@@@` isn't valid base64 and doesn't start with `\x`.
    assert _decode_inline_content("not!base64@@@") == ""


def test_decode_inline_content_empty_string() -> None:
    from app.api.workspace import _decode_inline_content
    # base64.b64decode('') returns b'' -> decodes to ''. Treat as ''.
    assert _decode_inline_content("") == ""
