"""Phase 300 (NOTE-03 / D-02..D-06 / D-22) — the run-waiting email, rendered from five facts.

── WHAT THIS EMAIL MAY CONTAIN, AND NOTHING ELSE (NOTE-03) ──────────────────────────────
  * the workflow's name           — ``<strong>``, HTML-escaped
  * the org's name                — ``<strong>``, HTML-escaped; dropped when the run has none
  * how long the run has waited   — floor words (``duration_words``), never seconds
  * the kind word                 — "answer" for a question, "approval" for an approval (D-04)
  * two links on ``primary_frontend_origin()`` — ``/app/runs/<id>`` and ``/app/settings?tab=preferences``,
    no token and no query string (D-05)

⛔ NEVER ACCEPT PROMPT TEXT. The signature takes exactly those inputs, keyword-only; there is no
parameter a question, an approval's text, a document or a step output could arrive through, and
``test_300_run_waiting_email`` pins the signature. The drainer that calls this selects none of
that content either. A question can carry anything a workflow author or a document put in it,
and an inbox is outside every access rule this app enforces.

The wait is passed in as seconds, computed by the caller from the notice's ``created_at`` (D-06)
and frozen at first claim, so a retry renders byte-identical mail. No expiry is ever stated
(D-06): a pause's deadline is per-type and stating one would be a promise.

Pure: no DB, no Settings read beyond ``primary_frontend_origin()``. The subject is plain text
(never entity-escaped) with every control character turned into a space (D-02).
"""
from __future__ import annotations

import html
from dataclasses import dataclass
from typing import Literal

from app.config import primary_frontend_origin
from app.services.email_provider import one_line, shell_html

SUBJECT_NAME_MAX = 120
_LINK_STYLE = "color:#4F46E5;font-weight:600"
_FOOTER_LINK_STYLE = "color:#6B7280;text-decoration:underline"


def duration_words(seconds: int) -> str:
    """UI-D7 floor words — never rounds up, so the email never claims more waiting than happened.

    under 60 s → "less than a minute"; 1-59 min → "1 minute" / "{n} minutes";
    1-47 h → "1 hour" / "{n} hours"; 48 h or more → "{n} days".
    """
    total = max(0, int(seconds))
    if total < 60:
        return "less than a minute"
    minutes = total // 60
    if minutes < 60:
        return "1 minute" if minutes == 1 else f"{minutes} minutes"
    hours = total // 3600
    if hours < 48:
        return "1 hour" if hours == 1 else f"{hours} hours"
    return f"{total // 86400} days"


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    text: str
    html: str


def render_run_waiting(
    *,
    workflow_name: str | None,
    org_name: str | None,
    waited_seconds: int,
    run_id,
    kind: Literal["question", "approval"],
) -> RenderedEmail:
    """Render the run-waiting email (UI-SPEC S1) from the five allowed facts."""
    if kind == "question":
        kind_word = "answer"
    elif kind == "approval":
        kind_word = "approval"
    else:
        raise ValueError("kind must be 'question' or 'approval'")

    name = one_line(workflow_name or "").strip() or "A workflow"
    org = one_line(org_name or "").strip()
    duration = duration_words(waited_seconds)
    origin = primary_frontend_origin()
    run_link = f"{origin}/app/runs/{run_id}"
    settings_link = f"{origin}/app/settings?tab=preferences"  # v4.8 audit W-2: the switch's tab

    subject_name = name if len(name) <= SUBJECT_NAME_MAX else name[: SUBJECT_NAME_MAX - 1] + "…"
    subject = f"{subject_name} is waiting on you"

    plain_where = f"{name} in {org}" if org else name
    sentence = f"{plain_where} has been waiting {duration} for your {kind_word}."
    text = "\n".join([
        sentence,
        "",
        "Open the run:",
        run_link,
        "",
        "Don't want these emails? Turn them off in Settings.",
        settings_link,
    ])

    html_where = f"<strong>{html.escape(name)}</strong>"
    if org:
        html_where += f" in <strong>{html.escape(org)}</strong>"
    inner = (
        f'<p style="margin:0 0 16px">{html_where} has been waiting {html.escape(duration)} '
        f"for your {kind_word}.</p>"
        f'<p style="margin:0 0 24px"><a href="{html.escape(run_link, quote=True)}" '
        f'style="{_LINK_STYLE}">Open the run</a></p>'
    )
    footer = (
        "<p style=\"margin:0\">Don't want these emails? "
        f'<a href="{html.escape(settings_link, quote=True)}" style="{_FOOTER_LINK_STYLE}">'
        "Turn them off in Settings.</a></p>"
    )
    return RenderedEmail(subject=subject, text=text, html=shell_html(inner, footer_html=footer))
