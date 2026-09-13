"""BUG-260912-01 — the operator must be able to LEARN that the client secret is wrong.

── ⭐ THE DEFECT ──────────────────────────────────────────────────────────────────────────

Measured 2026-09-12. `GOOGLE_OAUTH_CLIENT_SECRET` stopped matching `GOOGLE_OAUTH_CLIENT_ID`,
so Google answered `401 {"error": "invalid_client"}` to every refresh. The operator's ONE
diagnostic control — `POST /connectors/connections/{id}/check` — answered:

    "The provider refused to renew this authorisation."

That sentence is true of a revoked grant, a wrong secret, a deleted OAuth client and a
suspended project alike, and its implied next step (reconnect) is WRONG for three of the four.
The operator reconnected, nothing changed, and the real cause was only found by reading the
token endpoint's body out of a script.

⛔ THE RULE THAT MUST SURVIVE THIS FIX. `_check_oauth_connection`'s docstring narrows the
"vendor verbatim" convention on purpose: the token endpoint is the one place a request body
carries a refresh token, so its RAW BODY may never travel. This suite pins BOTH halves —
the operator gets a sentence naming the deployment's own credentials, and the provider's raw
body still does not reach the response.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.oauth_refresh_service import (
    OAuthClientCredentialsError,
    OAuthError,
    OAuthRevokedError,
    refresh_oauth_token_at_provider,
)

#: Google's exact answer, quoted from the 2026-09-12 measurement.
INVALID_CLIENT_BODY = {
    "error": "invalid_client",
    "error_description": "The provided client secret is invalid.",
}


def _resp(status: int, body: dict) -> httpx.Response:
    return httpx.Response(
        status,
        json=body,
        request=httpx.Request("POST", "https://oauth2.googleapis.com/token"),
    )


@pytest.mark.asyncio
async def test_invalid_client_raises_its_own_error_not_a_generic_one() -> None:
    """⭐ THE SEAM. A named exception is what lets every caller above say the right thing.

    Before this fix the 401 fell through to the generic `OAuthError`, whose message embeds
    `res.text` — so the ONLY place the cause existed was a log line, and every surface above
    flattened it to "the provider refused".
    """
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        post.return_value = _resp(401, INVALID_CLIENT_BODY)
        with pytest.raises(OAuthClientCredentialsError):
            await refresh_oauth_token_at_provider(
                provider="google",
                refresh_token="rt",
                client_id="cid",
                client_secret="wrong",
            )


@pytest.mark.asyncio
async def test_it_is_not_a_revoked_grant_because_the_owner_of_the_fix_differs() -> None:
    """⛔ THE CONTAINMENT THAT IS THE WHOLE POINT.

    `OAuthRevokedError` means *this person's authorisation ended* and its fix is Reconnect.
    `OAuthClientCredentialsError` means *this deployment's app registration is wrong* and
    Reconnect provably cannot fix it — the code exchange uses the same secret. If the new
    error were a subclass of the revoked one, every `except OAuthRevokedError` above would
    silently re-acquire the wrong sentence.
    """
    assert not issubclass(OAuthClientCredentialsError, OAuthRevokedError)
    assert issubclass(OAuthClientCredentialsError, OAuthError)


@pytest.mark.asyncio
async def test_the_raw_token_endpoint_body_never_rides_on_the_exception() -> None:
    """⛔ THE NARROWING THAT MUST SURVIVE. The body is where a refresh token would be.

    The error names the FACT. It does not carry the provider's response text, so no caller
    can accidentally render it.
    """
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        post.return_value = _resp(401, INVALID_CLIENT_BODY)
        with pytest.raises(OAuthClientCredentialsError) as caught:
            await refresh_oauth_token_at_provider(
                provider="google",
                refresh_token="super-secret-refresh-token",
                client_id="cid",
                client_secret="wrong",
            )
    text = str(caught.value)
    assert "super-secret-refresh-token" not in text
    assert "error_description" not in text


@pytest.mark.asyncio
async def test_invalid_grant_is_untouched_by_the_new_arm() -> None:
    """The mirror containment: the arm that already worked still works, and first."""
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        post.return_value = _resp(
            400, {"error": "invalid_grant", "error_description": "Token has been expired."}
        )
        with pytest.raises(OAuthRevokedError):
            await refresh_oauth_token_at_provider(
                provider="google", refresh_token="rt", client_id="cid", client_secret="s"
            )


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [400, 401])
async def test_both_status_codes_the_spec_allows_are_recognised(status: int) -> None:
    """RFC 6749 §5.2 lets the server answer `invalid_client` as either 400 or 401.

    ⚠ Google uses 401. Keying on one status alone would leave the other vendor silent.
    """
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        post.return_value = _resp(status, INVALID_CLIENT_BODY)
        with pytest.raises(OAuthClientCredentialsError):
            await refresh_oauth_token_at_provider(
                provider="google", refresh_token="rt", client_id="cid", client_secret="s"
            )


# ══════════════════════════════════════════════════════════════════════════════════════════
# THE OPERATOR'S ONE DIAGNOSTIC CONTROL — `POST /connectors/connections/{id}/check`
#
# ⭐ This is the answer to *"as an operator, how would I have known?"*. Everything above is
# plumbing; this is the surface a person presses.
# ══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_the_check_route_tells_the_operator_it_is_the_APP_credentials() -> None:
    """⭐ THE DELIVERABLE. Pressing Check on a connection whose deployment credentials are
    wrong must produce a sentence that (a) names the deployment rather than the user and
    (b) does NOT send the operator to Reconnect.

    Before this fix the same state produced *"The provider refused to renew this
    authorisation."* — true, useless, and pointing at the one action that cannot work.
    """
    from app.api import connectors as connectors_api

    settled = type("S", (), {"last_checked_at": "2026-09-12T05:10:58Z"})()

    with (
        patch(
            "app.services.oauth_refresh_service.get_fresh_access_token",
            new_callable=AsyncMock,
            side_effect=OAuthClientCredentialsError(
                "The OAuth application credentials configured on this server were rejected "
                "by the provider."
            ),
        ),
        patch.object(
            connectors_api.connector_service,
            "record_check_verdict",
            new_callable=AsyncMock,
            return_value=settled,
        ) as record,
    ):
        resp = await connectors_api._check_oauth_connection(
            connection_id="conn-1",
            active_org="org-1",
            service_id="google",
            token_status={"account_email": "someone@example.com", "scopes": []},
            supabase=object(),
        )

    assert resp.ok is False
    assert resp.verdict == "failed"
    assert resp.bucket == "rejected"
    record.assert_awaited_once()

    said = resp.provider_message.lower()
    # (a) it names WHOSE credentials are wrong — this server's, not this person's.
    assert "this server" in said or "application credentials" in said

    # (b) ⛔ it does NOT INSTRUCT the operator to reconnect.
    #
    # ⚠ THE FIRST CUT OF THIS ASSERTION WAS `"reconnect" not in said`, AND IT WAS WRONG —
    # recorded rather than quietly corrected, because the distinction it missed is the
    # deliverable. The shipped sentence contains the word "Reconnecting", in the clause
    # *"Reconnecting will not clear this"*. Naming the useless action in order to RULE IT OUT
    # is strictly better than staying silent about it: the operator has already tried it. A
    # substring ban cannot tell an instruction from a refusal, so the property is asserted as
    # what it actually is — the imperative must be absent and the refusal must be present.
    assert "reconnect it" not in said, "this must never read as an instruction to reconnect"
    assert "reconnecting will not" in said, (
        "the operator has already tried reconnecting — the sentence has to say it cannot work"
    )
    # And it names the action that DOES work, on the right side of the machine.
    assert "corrected on the server" in said


@pytest.mark.asyncio
async def test_a_genuinely_revoked_grant_still_says_reconnect() -> None:
    """⛔ THE CONTAINMENT. The new arm must not swallow the case Reconnect DOES fix."""
    from app.api import connectors as connectors_api

    settled = type("S", (), {"last_checked_at": "2026-09-12T05:10:58Z"})()

    with (
        patch(
            "app.services.oauth_refresh_service.get_fresh_access_token",
            new_callable=AsyncMock,
            side_effect=OAuthRevokedError("revoked"),
        ),
        patch.object(
            connectors_api.connector_service,
            "record_check_verdict",
            new_callable=AsyncMock,
            return_value=settled,
        ),
    ):
        resp = await connectors_api._check_oauth_connection(
            connection_id="conn-1",
            active_org="org-1",
            service_id="google",
            token_status={"account_email": "someone@example.com", "scopes": []},
            supabase=object(),
        )

    assert resp.bucket == "rejected"
    assert "reconnect" in resp.provider_message.lower()


@pytest.mark.asyncio
async def test_the_sentence_is_classified_by_the_shared_vocabulary() -> None:
    """⭐ THE WIRE. The route's own sentence must resolve to the new cause, so the Library's
    source surfaces reach the same verdict the Settings check does.

    ⚠ Two registers, ONE fact. A sentence the check route authors and the source classifier
    cannot recognise would be exactly the drift `failure_cause.py` exists to prevent.
    """
    from app.services.sources.failure_cause import classify_failure_cause

    assert (
        classify_failure_cause("The provided client secret is invalid.")
        == "app_credentials_invalid"
    )
