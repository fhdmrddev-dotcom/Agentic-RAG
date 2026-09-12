"""BUG-260912-01 — `invalid_client` is the DEPLOYMENT's fault, not the user's.

── ⭐ THE DEFECT THIS SUITE EXISTS TO CLOSE ─────────────────────────────────────────────

Measured 2026-09-12 against the live local stack. `GOOGLE_OAUTH_CLIENT_SECRET` in
`backend/.env` no longer matched `GOOGLE_OAUTH_CLIENT_ID`, so Google answered every refresh::

    401 {"error": "invalid_client",
         "error_description": "The provided client secret is invalid."}

Three surfaces then told the operator three wrong things, and the operator had to ask a
model to find out what was actually broken:

  1. `classify_failure_cause` resolved it to `token_revoked` — via `_STATUS_CAUSE[401]` —
     whose sentence is *"Access to … was withdrawn"* and whose control is **Reconnect**.
  2. The operator reconnected. Reconnecting CANNOT work: the authorization-code exchange
     uses the same broken client secret (`oauth_service.resolve_client_credentials`).
  3. The folder picker rendered **"No subfolders"**.

⛔ THE BINDING DISTINCTION. `token_revoked` is a fact about ONE PERSON'S AUTHORISATION and
its fix is a user action. `app_credentials_invalid` is a fact about THIS DEPLOYMENT'S OAuth
app registration and its fix is an operator action. Offering Reconnect for the second is the
same defect `connection_disabled` was added to close, one cause over: a control that provably
cannot change the state it is offered for.

⚠ NON-VACUITY FIRST, the convention this package already follows.
"""

from __future__ import annotations

from typing import get_args

import pytest

from app.services.sources.failure_cause import (
    HARD_CAUSES,
    Cause,
    classify_failure_cause,
    is_hard,
)

#: The exact body Google returns, quoted from the 2026-09-12 measurement. Kept verbatim so a
#: reworded matcher that stops recognising the real thing reds here rather than in production.
GOOGLE_INVALID_CLIENT = (
    'Token refresh failed at google: 401 {\n  "error": "invalid_client",\n'
    '  "error_description": "The provided client secret is invalid."\n}'
)


def test_non_vacuity_the_union_names_the_new_cause() -> None:
    """⚠ RE-BASELINED 5 → 6, deliberately and in the same commit that widens the union.

    Every per-cause loop in `test_failure_cause.py` rests on `get_args(Cause)`; a union that
    did not actually gain a member would make this file's properties pass over nothing.
    """
    assert "app_credentials_invalid" in get_args(Cause)
    assert len(get_args(Cause)) == 6


def test_it_is_hard_because_the_next_tick_cannot_recover_from_it() -> None:
    """A wrong client secret is not a blip. No cadence of retries repairs it.

    ⚠ Stated as a DECISION, the way `connection_disabled` states its own: if this proves
    noisy the change is removing one member from `HARD_CAUSES`, and no branch moves.
    """
    assert "app_credentials_invalid" in HARD_CAUSES
    assert is_hard("app_credentials_invalid") is True


@pytest.mark.parametrize(
    "message",
    [
        GOOGLE_INVALID_CLIENT,
        '{"error": "invalid_client"}',
        "invalid_client",
        "The provided client secret is invalid.",
        "The OAuth client was not found. (invalid_client)",
    ],
)
def test_an_invalid_client_message_names_the_deployment_not_the_user(message: str) -> None:
    assert classify_failure_cause(message) == "app_credentials_invalid"


def test_the_401_status_row_does_not_outrank_the_invalid_client_tell() -> None:
    """⭐ THE HEART OF THE BUG, AND THE ONE ORDERING THAT MATTERS.

    `_STATUS_CAUSE` is consulted before the regexes because *"a code is a stronger signal
    than prose"* — and that rule is right. But `invalid_client` is not prose: it is the
    RFC 6749 §5.2 error code, a machine-readable enum that is STRICTLY MORE SPECIFIC than
    the transport status carrying it. Every `invalid_client` arrives on a 400 or a 401, so a
    status table consulted first makes this cause unreachable in practice.
    """
    assert classify_failure_cause(GOOGLE_INVALID_CLIENT, status_code=401) == (
        "app_credentials_invalid"
    )
    assert classify_failure_cause('{"error": "invalid_client"}', status_code=400) == (
        "app_credentials_invalid"
    )


@pytest.mark.parametrize("status_code", [401, 403])
def test_the_ordinary_401_still_reads_as_token_revoked(status_code: int) -> None:
    """⛔ THE CONTAINMENT. The new arm must fire on the TELL, never on the status class.

    A plain 401 with nothing to say about the client credentials is still a revoked token,
    and this is the assertion that reds if the new arm is widened into the status table.
    """
    assert classify_failure_cause(None, status_code=status_code) == "token_revoked"
    assert classify_failure_cause("Request had invalid authentication credentials.",
                                  status_code=status_code) == "token_revoked"


@pytest.mark.parametrize(
    "message",
    [
        "invalid_grant",
        "Token has been expired or revoked.",
        "The caller does not have permission",
        "insufficient authentication scopes",
    ],
)
def test_a_user_authorisation_failure_is_never_read_as_a_deployment_failure(message: str) -> None:
    """The mirror containment: `invalid_grant` and friends keep their own cause.

    ⚠ These two causes have OPPOSITE owners — one is fixed by the person holding the account,
    the other by the person holding the server — so a matcher that confused them would send
    every future operator down the wrong door.
    """
    assert classify_failure_cause(message) != "app_credentials_invalid"
