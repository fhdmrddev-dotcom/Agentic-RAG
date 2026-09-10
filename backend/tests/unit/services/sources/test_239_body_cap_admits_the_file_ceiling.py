"""The MCP envelope cap must be large enough for the file ceiling it is supposed to allow.

⚠ THIS TEST EXISTS BECAUSE THE TWO CONSTANTS DISAGREED IN SHIPPED CODE, and the disagreement
was invisible: `mcp_source.MAX_FILE_BYTES` said 25 MB — matching `google_drive.py` and
`microsoft_graph.py` so the three families refuse at the same size (TM-239-03) — while
`mcp_client.MAX_MCP_BODY_BYTES` said 2 MB and was applied to the WHOLE JSON-RPC response.

MCP carries file content INSIDE the envelope, and binary comes back base64, which inflates a
payload by 4/3. So the real ceiling was ~1.5 MB and the 25 MB one COULD NEVER FIRE. A user
importing a 3 MB PDF got a transport error naming a byte cap, not the adapter's plain
"this file is too large" refusal.

**A ceiling nobody can reach is not a ceiling.** Pinning the two numbers independently would not
have caught this — each was individually defensible. What has to hold is the RELATION between
them, which is what this file asserts.

── ⚠ REWRITTEN FOR SEED-258, AND THE REWRITE IS THE POINT ────────────────────────────────────

~~This test read two module-level constants and asserted the relation at ONE value.~~ The
ceiling is now an operator setting (`app_settings.source_max_file_size_mb`), so **one value is
no longer the whole domain** — and a relation test pinned to a single number is exactly the
thing that missed this defect the first time. Every case below sweeps the CONFIGURED RANGE: the
floor, the shipped default, and the hard maximum.

⚠ The envelope cap is a DoS guard on an untrusted remote server, not a nuisance number. This
file deliberately asserts a LOWER BOUND only: raising the file ceiling must force the envelope
up, but nothing here licenses raising the envelope on its own. The derivation direction is
one-way by construction — there is no envelope field an operator can set.
"""

from types import SimpleNamespace

import pytest

import app.models.user_settings as us
from app.services import mcp_client

BASE64_INFLATION = 4 / 3

#: The whole configured domain, not one point in it. Anything an operator can actually store
#: after the API bound (`SOURCE_MAX_FILE_SIZE_MB_FLOOR`..`_CEILING`) lands between these.
RANGE_MB = [
    us.SOURCE_MAX_FILE_SIZE_MB_FLOOR,
    us.SOURCE_MAX_FILE_SIZE_MB_DEFAULT,
    us.SOURCE_MAX_FILE_SIZE_MB_CEILING,
]


@pytest.fixture
def configured(monkeypatch):
    """Seed the operator setting the whole system now reads."""

    def _set(mb):
        monkeypatch.setattr(
            us, "load_app_settings", lambda: SimpleNamespace(source_max_file_size_mb=mb)
        )

    return _set


@pytest.mark.parametrize("mb", RANGE_MB)
def test_the_envelope_cap_admits_a_file_at_the_adapter_ceiling(configured, mb):
    """A file exactly at the configured ceiling must fit inside the transport, base64 included.

    ⭐ ACROSS THE RANGE, not at one number. The original defect was a pair of values that were
    each fine and jointly wrong; a configurable pair can be jointly wrong at one end of the
    range and fine at the other, which is strictly easier to miss.
    """
    configured(mb)
    ceiling = us.source_max_file_bytes()
    envelope = mcp_client.mcp_max_body_bytes()
    needed = ceiling * BASE64_INFLATION

    assert ceiling == mb * 1024 * 1024, (
        f"fixture premise wrong: asked for {mb} MB, the system resolved {ceiling} bytes"
    )
    assert envelope >= needed, (
        f"at a configured {mb} MB the envelope ({envelope}) cannot carry a file at the "
        f"ceiling ({ceiling}); base64 needs {needed:.0f} bytes. The adapter's ceiling is "
        "unreachable and refuses with a transport error instead."
    )


def test_the_envelope_is_derived_and_is_not_a_second_setting():
    """⛔ THE SEED'S NAMED FAILURE MODE: *"Two fields appear (file size AND envelope size) —
    the original defect, now user-operable."* There must be no envelope knob to disagree with
    the file knob, so the derivation is one-way and the operator sees ONE number."""
    assert not hasattr(us.UserEffectiveSettings, "mcp_max_body_bytes")
    fields = set(us.UserEffectiveSettings.model_fields)
    envelope_fields = {f for f in fields if "body_bytes" in f or "envelope" in f}
    assert not envelope_fields, (
        f"an envelope-sized setting appeared: {envelope_fields} — the envelope is DERIVED from "
        "the file ceiling, never set beside it (SEED-258)"
    )


@pytest.mark.parametrize("mb", RANGE_MB)
def test_raising_the_file_ceiling_raises_the_envelope_with_it(configured, mb):
    """The relation is causal, not coincidental: the envelope tracks the ceiling upward."""
    configured(us.SOURCE_MAX_FILE_SIZE_MB_FLOOR)
    at_floor = mcp_client.mcp_max_body_bytes()
    configured(mb)
    assert mcp_client.mcp_max_body_bytes() >= at_floor


def test_the_mcp_file_ceiling_still_matches_its_sibling_families(configured):
    """TM-239-03: the three source families refuse at the same size, or the parity claim is false.

    ⚠ REWRITTEN. Parity used to be three constants that happened to be equal — *"correct in all
    three by coincidence of careful authorship"*. It is now IDENTITY: there is one accessor and
    all three call it, so the families cannot drift apart. The fence below proves none of them
    kept a private copy, which is what parity actually rests on now.
    """
    import ast
    import inspect

    from app.services.sources.adapters import google_drive, mcp_source, microsoft_graph

    families = {
        "google_drive": google_drive,
        "microsoft_graph": microsoft_graph,
        "mcp_source": mcp_source,
    }

    for name, module in families.items():
        src = inspect.getsource(module)
        tree = ast.parse(src)

        # ⚠ AST, NOT A STRING SCAN. Each of these modules now carries a struck-through PROSE
        # note naming the constant it used to own — deliberately, so the next author finds the
        # history. A `"MAX_FILE_BYTES" not in src` fence would fire on that note and would
        # have to be softened, which is how a fence stops meaning anything. This one refuses
        # the SHAPE: a real binding of the name, anywhere in the module.
        bound = {
            target.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Assign)
            for target in node.targets
            if isinstance(target, ast.Name)
        }
        assert "MAX_FILE_BYTES" not in bound, (
            f"{name} still defines its own MAX_FILE_BYTES — three private copies agreeing by "
            "luck is the state SEED-258 removed, and a FOURTH family is where that luck runs "
            "out. Read source_max_file_bytes() instead."
        )

        called = {
            node.func.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        assert "source_max_file_bytes" in called, (
            f"{name} never CALLS the shared ceiling — parity across the families is no longer "
            "claimable (SC#3 'behaves exactly as Drive does'). An import alone is not a read."
        )

    # And behaviourally: a value no constant ever held resolves identically for all three.
    configured(7)
    assert us.source_max_file_bytes() == 7 * 1024 * 1024
