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

⚠ The envelope cap is a DoS guard on an untrusted remote server, not a nuisance number. This test
deliberately asserts a LOWER BOUND only: raising `MAX_FILE_BYTES` must force the envelope up,
but nothing here licenses raising the envelope on its own.
"""

from app.services.mcp_client import MAX_MCP_BODY_BYTES
from app.services.sources.adapters.mcp_source import MAX_FILE_BYTES

BASE64_INFLATION = 4 / 3


def test_the_envelope_cap_admits_a_file_at_the_adapter_ceiling():
    """A file exactly at MAX_FILE_BYTES must fit inside the transport, base64 included."""
    needed = MAX_FILE_BYTES * BASE64_INFLATION
    assert MAX_MCP_BODY_BYTES >= needed, (
        f"MAX_MCP_BODY_BYTES ({MAX_MCP_BODY_BYTES}) cannot carry a file at "
        f"MAX_FILE_BYTES ({MAX_FILE_BYTES}); base64 needs {needed:.0f} bytes. "
        "The adapter's ceiling is unreachable and refuses with a transport error instead."
    )


def test_the_mcp_file_ceiling_still_matches_its_sibling_families():
    """TM-239-03: the three source families refuse at the same size, or the parity claim is false."""
    from app.services.sources.adapters.google_drive import MAX_FILE_BYTES as DRIVE
    from app.services.sources.adapters.microsoft_graph import MAX_FILE_BYTES as GRAPH

    assert MAX_FILE_BYTES == DRIVE == GRAPH, (
        f"mcp={MAX_FILE_BYTES} drive={DRIVE} graph={GRAPH} — the families no longer agree, "
        "so 'behaves exactly as Drive does' (SC#3) is no longer true about size."
    )
