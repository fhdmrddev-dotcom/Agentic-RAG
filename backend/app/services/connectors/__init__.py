"""Phase 190 (CONN-02 / CONN-03) — the first-party connector adapters.

THE ONE CONTRACT OF THIS PACKAGE, and it is a security property rather than a style rule:

    No HTTP or SMTP client is constructed anywhere under this package; every socket
    comes from ``app.security.egress``.

That sentence is D-05, and it is the same sentence ``secret_cipher.py`` carries with a
different noun (*"no ``Fernet(...)`` is constructed anywhere else in the app"*). It is
enforced mechanically, not remembered: plan 190-14 walks every module under this package
for the banned transport tokens and requires ZERO, with a positive control proving the
matcher is not inert. An adapter that opens its own connection would be validated by
nothing — no scheme check, no allow-list, no address check, no DNS pin, no redirect
refusal, no size cap — while every functional test stayed green.

Two consequences worth stating, because both are easy to undo by accident:

  1. **A vendor SDK is not importable here.** ``slack_sdk`` and friends each build their
     own client, which is precisely the thing this package may not do. The adapters speak
     the vendor's documented wire format through the shared binders instead (RESEARCH
     §R11 / §R12), which is also why this phase installs no package at all.
  2. **There is no Model Context Protocol client in this package, and that is
     deliberate** (D-01/D-32). ``ConnectorAdapter`` borrows that standard's call SHAPE so
     an Open-Platform client can later register adapters THROUGH this seam rather than
     beside it — see ``protocol.py`` for the amendment, its re-open trigger, and why the
     three-letter acronym is never spelled anywhere under ``backend/app``. The standing
     fence in ``tests/unit/test_189_no_egress.py`` requires ZERO occurrences of it across
     the whole tree, and this phase leaves that fence untouched and green.

Modules:
  ``protocol.py``      — the seam: ``ConnectorAdapter``, ``AdapterResult``,
                         ``AdapterCheckResult``, ``AdapterError``
  ``registry.py``      — capability -> adapter, keyed off ``EXTERNAL_ACTION_CAPABILITIES``
  ``smtp_adapter.py``  — ``send_email`` (plan 190-08)
  ``jira_adapter.py``  — ``create_ticket`` (plan 190-10)
  ``slack_adapter.py`` — ``post_message`` (plan 190-11)
"""
