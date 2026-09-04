"""Phase 221 plan 02 (D-221-04) — what will NOT work, before someone asks it to.

── WHY THIS EXISTS ────────────────────────────────────────────────────────────────────
On 2026-08-31 three of six Google applications were switched off in the Cloud project and
the connection panel said nothing about any of them. The only way to find out was to run a
tool in chat and read the refusal. All six are on now, and that state is one console toggle
away from being false again.

── THREE STATES, BECAUSE THEIR REMEDIES ARE OPPOSITE (D-221-04) ───────────────────────
``api_off``       the API is switched off in the Cloud project. A console visit fixes it and
                  reconnecting is useless.
``scope_missing`` the token predates the scope. One re-consent fixes it and the console is
                  useless.
``unknown``       we could not establish either. NEVER rendered as a problem with Google.

Collapsing the first two into one "not working" badge reproduces the exact defect this work
was opened to close: handed a bare ``HTTP 403``, a real model call told the operator to
re-consent scopes that were already correct.

── ⚠ NO SECOND PARSER ─────────────────────────────────────────────────────────────────
``_http.error_reason`` and ``_http.activation_url`` are imported, never reimplemented. Two
parsers that disagree is precisely how a refusal comes to name the wrong cause, and this
module would be the second one. The substring predicate below is the SAME predicate
``_http._raise_for`` uses, deliberately, so the panel and the refusal cannot disagree.

── ⚠ `error.message` NEVER TRAVELS ────────────────────────────────────────────────────
Nothing in this module reads it, returns it or logs it. A Google error body echoes the
request, which for Drive and Gmail is the person's own search query. Only ``error.status``
and ``details[].reason`` — a closed enum vocabulary that cannot contain user text — leave
here, and even those leave only as one of the four state words above.

── ⚠ THE SCOPE ARM MAKES NO NETWORK CALL ──────────────────────────────────────────────
``connector_tokens.scopes`` is a stored array, so a missing scope is decidable from the row
alone. Only the enablement arm probes, and only for applications whose scope IS granted —
probing one we already know is unauthorised would spend a round trip to learn nothing.

── ⚠ OPERATOR-TRIGGERED, ALWAYS ───────────────────────────────────────────────────────
Every call here runs on the existing Check action, which a person presses. Never on render,
never on page load, never on a schedule. SEED-209/210/211/212 fence automatic or background
reach-out and this stays on the right side of that line.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal, NamedTuple
from uuid import UUID

from app.security.egress import send_pinned_http
from app.services.google._http import activation_url, error_reason
from app.services.oauth_refresh_service import get_fresh_access_token

logger = logging.getLogger(__name__)

__all__ = [
    "APPLICATION_PROBES",
    "ApplicationProbe",
    "AvailabilityState",
    "classify_probe_response",
    "probe_google_applications",
]

AvailabilityState = Literal["ready", "api_off", "scope_missing", "unknown"]


class ApplicationProbe(NamedTuple):
    """Everything one application needs to be asked whether it works.

    ⚠ ONE TABLE, NOT TWO. An earlier shape split the scope/service declaration into
    ``service_tools.py`` and kept the URL here, and two tables that must agree is this
    repository's most-repeated defect. The invariant the split was meant to buy — *an
    application cannot exist without a probe* — is bought instead by
    ``test_every_google_application_has_a_probe``, which walks ``SERVICE_TOOL_SPECS`` and
    fails on any ``app`` key missing from this dict. A fence beats a convention.
    """

    #: The OAuth scope this application's READS require. Decidable from the stored row.
    scope: str
    #: The name Google reports in ``details[].metadata.service`` for a SERVICE_DISABLED.
    #: Recorded for provenance and for the fence below; the classification does not need it.
    service: str
    #: The egress allow-list key the probe travels under — the application's OWN read key,
    #: never a shared one. A Calendar probe must not be able to reach Gmail.
    capability: str
    #: One cheap authenticated GET.
    url: str
    params: tuple[tuple[str, str], ...] = ()


#: An obviously-invalid document id. A 404 from Sheets or Docs PROVES the API answered,
#: which is exactly the discrimination this probe needs and the cheapest way to get it.
#: ⚠ It must not resemble a real id — this string is sent to Google and appears in their
#: logs, so it says what it is.
_PROBE_ID = "agentic-rag-availability-probe-not-a-real-document"


#: app key -> how to ask whether it works.
APPLICATION_PROBES: dict[str, ApplicationProbe] = {
    "drive": ApplicationProbe(
        scope="https://www.googleapis.com/auth/drive.readonly",
        service="drive.googleapis.com",
        capability="drive_read",
        url="https://www.googleapis.com/drive/v3/about",
        params=(("fields", "kind"),),
    ),
    "gmail": ApplicationProbe(
        scope="https://www.googleapis.com/auth/gmail.readonly",
        service="gmail.googleapis.com",
        capability="gmail_read",
        url="https://gmail.googleapis.com/gmail/v1/users/me/profile",
    ),
    "sheets": ApplicationProbe(
        scope="https://www.googleapis.com/auth/spreadsheets.readonly",
        service="sheets.googleapis.com",
        capability="sheets_read",
        url=f"https://sheets.googleapis.com/v4/spreadsheets/{_PROBE_ID}",
        params=(("fields", "spreadsheetId"),),
    ),
    "docs": ApplicationProbe(
        scope="https://www.googleapis.com/auth/documents.readonly",
        service="docs.googleapis.com",
        capability="docs_read",
        url=f"https://docs.googleapis.com/v1/documents/{_PROBE_ID}",
    ),
    "calendar": ApplicationProbe(
        scope="https://www.googleapis.com/auth/calendar.readonly",
        service="calendar-json.googleapis.com",
        capability="calendar_read",
        url="https://www.googleapis.com/calendar/v3/users/me/calendarList",
        params=(("maxResults", "1"),),
    ),
    "contacts": ApplicationProbe(
        scope="https://www.googleapis.com/auth/contacts.readonly",
        service="people.googleapis.com",
        capability="contacts_read",
        url="https://people.googleapis.com/v1/people/me",
        params=(("personFields", "names"),),
    ),
}


def classify_probe_response(status_code: int, body: bytes | str | None) -> tuple[AvailabilityState, str]:
    """``(state, console_url)`` for one probe response. Pure — no I/O, no raising.

    ⚠ THE PREDICATE IS `_http._raise_for`'s, ON PURPOSE. That function decides the same
    fork at the refusal site (``"SERVICE_DISABLED" in reason or "accessNotConfigured" in
    reason``). Writing a cleverer one here would let the panel and the refusal disagree
    about the same connection on the same afternoon.

    ⚠ A 404 IS `ready`, AND THAT IS THE POINT. The Sheets and Docs probes deliberately ask
    for a document that cannot exist: an answer of *"no such document"* proves the API is
    switched on and the token carries the scope, which is the whole question. Any other 4xx
    reads the same way for the same reason — the API answered.

    ⚠ A 401 IS `unknown`, NOT `ready` — and this is a considered narrowing of the plan's
    *"any other 4xx is ready"*. A 401 means the token itself was rejected, so the
    application was never reached and nothing about it was measured. Calling that `ready`
    would assert a fact nobody established; calling it `api_off` would name the wrong
    cause. The credential arm of the Check action already reports a bad token in its own
    words, so `unknown` here leaves that sentence the only one on screen.
    """
    if 200 <= status_code < 300:
        return "ready", ""

    reason = error_reason(body)

    if "SERVICE_DISABLED" in reason or "accessNotConfigured" in reason:
        return "api_off", activation_url(body)

    if "SCOPE_INSUFFICIENT" in reason or "insufficientPermissions" in reason:
        # ⚠ NO CONSOLE URL, EVER, ON THIS ARM. The remedies are opposite; handing someone a
        # console link for a scope problem sends them to the one place that cannot fix it.
        return "scope_missing", ""

    if status_code == 401:
        return "unknown", ""

    if 400 <= status_code < 500:
        return "ready", ""

    # 5xx, or anything else: Google had a bad moment. That is not a fact about this
    # application's configuration and must never render as one.
    return "unknown", ""


async def _probe_one(
    app: str,
    probe: ApplicationProbe,
    connection_id: str | UUID,
    token: str,
) -> dict[str, Any]:
    """One application, one GET, one verdict. Never raises."""
    try:
        resp = await send_pinned_http(
            probe.capability,
            "GET",
            probe.url,
            params=dict(probe.params),
            headers={"authorization": f"Bearer {token}", "Accept": "application/json"},
            # ⚠ 20s, MATCHING `_http.get_json`, AND THE 8s FIRST CUT WAS MEASURED TOO
            # TIGHT. Six probes run concurrently and each takes ~2s in isolation, which
            # looked like ample headroom — but under the running server two of four live
            # checks reported a DIFFERENT healthy application as `unknown` each time.
            # A spurious "Could not check Sheets just now" on a working connection is
            # exactly the noise this whole surface exists to remove, and it teaches people
            # to ignore the line that matters. The probe is operator-triggered and bounded
            # by one Check press, so a longer ceiling costs nothing anybody waits on twice.
            timeout=20.0,
            max_bytes=64 * 1024,
        )
    except Exception as exc:  # noqa: BLE001
        # ⚠ EVERY failure to REACH Google is `unknown`, never `api_off`. An egress refusal,
        # a DNS miss, a timeout and an oversized body are all "we did not find out" — and
        # rendering any of them as "your API is switched off" is a refusal naming the wrong
        # cause, which is the defect family this whole module exists to remove.
        logger.warning(
            "Google availability probe for %s could not reach the API: %s", app, type(exc).__name__
        )
        return {"app": app, "state": "unknown", "console_url": None}

    state, console = classify_probe_response(resp.status_code, resp.body)
    if state != "ready":
        # The enum half only — see the module docstring.
        logger.info(
            "Google availability: %s is %s (HTTP %s)%s",
            app, state, resp.status_code, error_reason(resp.body),
        )
    return {"app": app, "state": state, "console_url": console or None}


async def probe_google_applications(
    connection_id: str | UUID,
    granted_scopes: list[str] | tuple[str, ...] | None,
) -> list[dict[str, Any]]:
    """One verdict per Google application, for the Check action. Never raises.

    ⚠ THE SCOPE ARM RESOLVES FIRST AND WITHOUT A NETWORK CALL. An application whose scope
    is absent from the stored token is `scope_missing` by arithmetic, and is NOT probed —
    a round trip that can only return a 403 we already predicted is a round trip that buys
    nothing and costs the person two seconds.

    ⚠ NO TOKEN AT ALL means we measured nothing, so every application is `unknown`. It is
    NOT six `scope_missing` verdicts: the connection is broken as a whole and the Check
    action's own credential verdict is the sentence that says so.
    """
    scopes = set(granted_scopes or ())

    needs_network: list[tuple[str, ApplicationProbe]] = []
    verdicts: dict[str, dict[str, Any]] = {}

    for app, probe in APPLICATION_PROBES.items():
        if probe.scope not in scopes:
            verdicts[app] = {"app": app, "state": "scope_missing", "console_url": None}
        else:
            needs_network.append((app, probe))

    if needs_network:
        try:
            token = await get_fresh_access_token(connection_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Google availability: no usable token (%s)", type(exc).__name__)
            token = None
        if not token:
            for app, _ in needs_network:
                verdicts[app] = {"app": app, "state": "unknown", "console_url": None}
        else:
            # Concurrent: six independent GETs against six different Google services, each
            # under its own egress key. Serial would make the Check action take six times
            # as long for no property anyone needs.
            results = await asyncio.gather(
                *(_probe_one(app, probe, connection_id, token) for app, probe in needs_network),
                return_exceptions=True,
            )
            for (app, _), result in zip(needs_network, results):
                if isinstance(result, BaseException):
                    # `_probe_one` already swallows everything; this is the belt to that
                    # braces, so one unexpected raise cannot empty the whole list.
                    logger.warning("Google availability: %s raised %s", app, type(result).__name__)
                    verdicts[app] = {"app": app, "state": "unknown", "console_url": None}
                else:
                    verdicts[app] = result

    # Stable order — the declaration order, which is the order the panel groups in.
    return [verdicts[app] for app in APPLICATION_PROBES if app in verdicts]
