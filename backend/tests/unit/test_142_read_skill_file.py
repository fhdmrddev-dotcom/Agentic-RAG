"""Phase 142 (SRH-01 / SC#3 / D-11) — honest read_skill_file for non-Python scripts.

These tests pin the two skill-file READ surfaces that Plan 03 makes honest:

  1. ``_decode_skill_file_bytes`` returns a bundled ``.js``/``.sh``/... file as
     reference TEXT prefixed with a "[reference only — ... cannot execute it]"
     caveat, REPLACING today's misleading json "binary — upload a text version"
     message. (SC#3 / D-11)
  2. A truly-binary type (PNG magic bytes) STILL returns the json "binary"
     message — the existing else-branch is untouched. (D-02)
  3. Byte-symmetry — because both read paths (the live-skill read AND the 099
     snapshot read) call the SAME shared ``_decode_skill_file_bytes``, a ``.js``
     payload returns the IDENTICAL string through either path. Driving BOTH call
     sites of ``_handle_read_skill_file`` proves the 099 SC#3 red line holds for
     the new branch (Pitfall 3 — extend the shared function, get symmetry free).

RED before Task 2: today ``.js``/``.sh`` fall through to the else-branch and come
back as a json "binary file" error, so the caveat/source assertions and the
byte-symmetry equality (json-error-string == json-error-string is actually equal,
so symmetry alone is not enough — the caveat assertions are the real RED gate)
all fail until the ``elif ext in SCRIPT_EXTS`` branch lands.

Offline only — a local ``_FakeStorage`` download recorder + a no-op skills-table
query stand-in (modeled on test_099_skill_composition), no live Storage/DB.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

from app.services.tool_dispatcher import (
    SCRIPT_EXTS,
    _decode_skill_file_bytes,
    _handle_read_skill_file,
)

JS_SOURCE = "const greet = (name) => console.log(`hi ${name}`);\nexport default greet;\n"
SH_SOURCE = "#!/usr/bin/env bash\nset -euo pipefail\necho \"packaging deck\"\n"
# A real PNG header — a genuinely binary payload that must STAY reported as binary.
PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


class _FakeStorage:
    """Faked Supabase Storage download recorder (minimal copy of the test_099 shape).

    ``register(path, payload)`` seeds a bytes payload; ``download(path)`` returns it
    (recording the path in ``self.downloads``) or raises like a 404; ``from_(bucket)``
    returns self so ``supabase.storage.from_("skill-files").download(...)`` resolves.
    """

    def __init__(self):
        self._files: dict[str, bytes] = {}
        self.downloads: list[str] = []

    def register(self, path: str, payload: bytes):
        self._files[path] = payload

    def from_(self, bucket):
        return self

    def download(self, path):
        self.downloads.append(path)
        if path not in self._files:
            raise FileNotFoundError(f"{path} not found in fake storage")
        return self._files[path]


class _LiveSkillQuery:
    """No-op fluent skills-table query stand-in for the live read path (mirrors test_099).

    ``.execute()`` resolves the skill to a fixed owner+id so the live path builds
    ``owner-id/skill-id/<filename>`` as its storage path.
    """

    def select(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return SimpleNamespace(data={"id": "skill-id", "user_id": "owner-id"})


# ── (1) SC#3 / D-11 — non-Python scripts decode as honest reference text ──────
def test_js_returns_reference_text():
    """A ``.js`` payload returns a STRING (not a json error) starting with the
    "[reference only —" caveat and containing the original source verbatim."""
    assert "js" in SCRIPT_EXTS  # single-source guard (Plan 01 constant)
    out = _decode_skill_file_bytes("helper.js", JS_SOURCE.encode("utf-8"))

    # Not a json error object — a plain reference-text string.
    assert isinstance(out, str)
    assert out.startswith("[reference only")
    # Names the file + its script kind, and says it is not executable here.
    assert "helper.js" in out
    assert "js" in out
    assert "cannot execute" in out or "runs Python only" in out
    # The real source is included for reference reading.
    assert "const greet" in out
    assert "export default greet" in out


def test_sh_returns_reference_text():
    """A ``.sh`` payload likewise decodes to caveat + source, not a binary error."""
    out = _decode_skill_file_bytes("build.sh", SH_SOURCE.encode("utf-8"))

    assert isinstance(out, str)
    assert out.startswith("[reference only")
    assert "build.sh" in out
    assert "packaging deck" in out
    # It is NOT the old json binary error.
    assert '"error"' not in out


# ── (2) D-02 — truly-binary types keep the unchanged binary else-branch ───────
def test_true_binary_still_binary():
    """A real binary (PNG magic bytes) STILL returns the json "binary" message —
    the existing else-branch is untouched (D-02)."""
    out = _decode_skill_file_bytes("photo.png", PNG_BYTES)

    payload = json.loads(out)  # must still be a json error object
    assert "error" in payload
    assert "binary" in payload["error"].lower()
    # And it must NOT have been reshaped into the reference-only caveat.
    assert "reference only" not in out


# ── (3) D-11 byte-symmetry — live read path == 099 snapshot read path ─────────
async def test_byte_symmetry_live_equals_snapshot(make_tool_context):
    """For the same ``.js`` payload, the LIVE read path and the 099 SNAPSHOT read
    path return the IDENTICAL string — both call the shared ``_decode_skill_file_bytes``
    (the 099 SC#3 red line holds for the new SCRIPT_EXTS branch)."""
    js_bytes = JS_SOURCE.encode("utf-8")

    # LIVE path — no snapshot; resolves owner-id/skill-id/helper.js.
    live_storage = _FakeStorage()
    live_storage.register("owner-id/skill-id/helper.js", js_bytes)
    live_supabase = SimpleNamespace(
        storage=live_storage,
        table=lambda *_a, **_k: _LiveSkillQuery(),
    )
    live_ctx = make_tool_context(supabase=live_supabase, skill_snapshot=None)
    live_result = await _handle_read_skill_file(
        {"skill_name": "Deck Skill", "filename": "helper.js"}, live_ctx
    )

    # SNAPSHOT path — a 099 skill snapshot; resolves snapshots/run/phase/helper.js.
    snap_storage = _FakeStorage()
    snap_storage.register("snapshots/run/phase/helper.js", js_bytes)
    snap = SimpleNamespace(
        skill_id="skill-id",
        name="Deck Skill",
        description=None,
        instructions="i",
        files=["helper.js"],
        storage_prefix="snapshots/run/phase",
    )
    snap_supabase = SimpleNamespace(
        storage=snap_storage,
        table=lambda *_a, **_k: _LiveSkillQuery(),
    )
    snap_ctx = make_tool_context(supabase=snap_supabase, skill_snapshot=snap)
    snap_result = await _handle_read_skill_file(
        {"skill_name": "Deck Skill", "filename": "helper.js"}, snap_ctx
    )

    # The two paths downloaded from DIFFERENT prefixes but decoded IDENTICALLY.
    assert any(p.startswith("snapshots/") for p in snap_storage.downloads)
    assert all("snapshots/" not in p for p in live_storage.downloads)
    assert live_result.result == snap_result.result
    assert live_result.result.startswith("[reference only")
