"""Phase 300-03 (NOTE-03 / D-02..D-06 / D-22) — the run-waiting email can say only five things.

The renderer is pure: no DB, no Settings, nothing but ``primary_frontend_origin()``. Its inputs
are the workflow name, the org name, how long the run has waited, the run id and the pause kind.
There is no parameter a prompt, a question, a document or a step output could arrive through —
asserted on the signature, not on a comment (T-300-19).

UI-SPEC S1 is the copy contract (subject, sentence variants, plain-text layout, duration words).
"""
from __future__ import annotations

import inspect
import uuid

import pytest

from app.config import settings
from app.services import email_provider
from app.services import run_waiting_email as rwe

RUN_ID = uuid.UUID("c41d8e2a-0b7e-4c2f-9e2d-5b7f0a63c41d")
EVIL_NAME = '</a><script>alert(1)</script> & "Q3"'
EVIL_ORG = "<b>Acme</b>"


@pytest.fixture(autouse=True)
def origin(monkeypatch):
    monkeypatch.setattr(settings, "frontend_url", "https://app.example.com")


# ── duration words (UI-D7: floor, never round up) ──────────────────────────────────────

@pytest.mark.parametrize("seconds, words", [
    (-5, "less than a minute"), (0, "less than a minute"), (59, "less than a minute"),
    (60, "1 minute"), (119, "1 minute"), (180, "3 minutes"), (3599, "59 minutes"),
    (3600, "1 hour"), (7199, "1 hour"), (47 * 3600 + 3599, "47 hours"),
    (48 * 3600, "2 days"), (72 * 3600 - 1, "2 days"), (10 * 86400, "10 days"),
])
def test_duration_words_floor(seconds, words):
    assert rwe.duration_words(seconds) == words


# ── the plain-text layout (verbatim) ───────────────────────────────────────────────────

def test_the_plain_text_is_the_ui_spec_layout_verbatim():
    out = rwe.render_run_waiting(workflow_name="Compliance Gap Report", org_name="Acme",
                                 waited_seconds=180, run_id=RUN_ID, kind="approval")
    assert out.text == (
        "Compliance Gap Report in Acme has been waiting 3 minutes for your approval.\n"
        "\n"
        "Open the run:\n"
        f"https://app.example.com/app/runs/{RUN_ID}\n"
        "\n"
        "Don't want these emails? Turn them off in Settings.\n"
        "https://app.example.com/app/settings?tab=preferences"
    )


def test_a_question_asks_for_your_answer():
    out = rwe.render_run_waiting(workflow_name="Report", org_name="Acme", waited_seconds=120,
                                 run_id=RUN_ID, kind="question")
    assert out.text.splitlines()[0] == "Report in Acme has been waiting 2 minutes for your answer."


@pytest.mark.parametrize("org", [None, ""])
def test_no_org_drops_the_in_phrase(org):
    out = rwe.render_run_waiting(workflow_name="Report", org_name=org, waited_seconds=120,
                                 run_id=RUN_ID, kind="question")
    assert out.text.splitlines()[0] == "Report has been waiting 2 minutes for your answer."
    assert " in <strong>" not in out.html


@pytest.mark.parametrize("name", [None, ""])
def test_no_workflow_name_reads_a_workflow(name):
    out = rwe.render_run_waiting(workflow_name=name, org_name="Acme", waited_seconds=120,
                                 run_id=RUN_ID, kind="approval")
    assert out.subject == "A workflow is waiting on you"
    assert out.text.startswith("A workflow in Acme has been waiting")


# ── subject (D-02) ─────────────────────────────────────────────────────────────────────

def test_the_subject_names_the_workflow_and_is_never_escaped():
    out = rwe.render_run_waiting(workflow_name="Q&A <review>", org_name="Acme", waited_seconds=60,
                                 run_id=RUN_ID, kind="question")
    assert out.subject == "Q&A <review> is waiting on you"


def test_a_crafted_name_cannot_forge_a_header_or_a_line():
    out = rwe.render_run_waiting(workflow_name="Report\r\nBcc: x@y", org_name="Ac\nme",
                                 waited_seconds=60, run_id=RUN_ID, kind="question")
    assert "\r" not in out.subject and "\n" not in out.subject
    assert out.subject.endswith(" is waiting on you")
    assert len(out.text.splitlines()) == 7


def test_a_long_name_is_clipped_in_the_subject():
    out = rwe.render_run_waiting(workflow_name="x" * 200, org_name="Acme", waited_seconds=60,
                                 run_id=RUN_ID, kind="question")
    assert out.subject == "x" * 119 + "…" + " is waiting on you"


# ── HTML (D-22) ────────────────────────────────────────────────────────────────────────

def test_the_html_escapes_every_name_and_shows_them_only_as_text():
    out = rwe.render_run_waiting(workflow_name=EVIL_NAME, org_name=EVIL_ORG, waited_seconds=180,
                                 run_id=RUN_ID, kind="approval")
    import html as _html
    assert f"<strong>{_html.escape(EVIL_NAME)}</strong>" in out.html
    assert f"<strong>{_html.escape(EVIL_ORG)}</strong>" in out.html
    assert "<script" not in out.html
    assert "<b>Acme</b>" not in out.html
    # the plain text shows them unescaped, and adds no line
    assert EVIL_NAME in out.text and EVIL_ORG in out.text
    assert "&amp;" not in out.text
    assert len(out.text.splitlines()) == 7


def test_the_links_are_the_run_and_settings_with_no_token():
    """v4.8 audit W-2 (amended on purpose): the settings link names the Preferences tab, where the
    email switch lives, instead of whichever tab the reader used last. The query it carries is one
    public word (`tab=preferences`), never an id or a token; the run link still carries no query."""
    out = rwe.render_run_waiting(workflow_name="Report", org_name="Acme", waited_seconds=180,
                                 run_id=RUN_ID, kind="approval")
    run_link = f"https://app.example.com/app/runs/{RUN_ID}"
    settings_link = "https://app.example.com/app/settings?tab=preferences"
    assert f'href="{run_link}"' in out.html and ">Open the run</a>" in out.html
    assert f'href="{settings_link}"' in out.html
    assert ">Turn them off in Settings.</a>" in out.html
    assert "Don't want these emails?" in out.html
    assert "?" not in run_link and "token" not in settings_link
    assert "?" not in out.html.split("href=")[1].split('"')[1]
    assert "token" not in out.html and "token" not in out.text


def test_the_email_sits_on_the_shared_shell_with_its_footer():
    out = rwe.render_run_waiting(workflow_name="Report", org_name="Acme", waited_seconds=180,
                                 run_id=RUN_ID, kind="approval")
    assert 'alt="Syrel"' in out.html and "max-width:560px" in out.html
    assert "border-top:1px solid #E2E4E9" in out.html


def test_a_multi_origin_install_links_to_the_primary_origin(monkeypatch):
    monkeypatch.setattr(settings, "frontend_url", "https://a.example.com,https://b.example.com")
    out = rwe.render_run_waiting(workflow_name="Report", org_name="Acme", waited_seconds=180,
                                 run_id=RUN_ID, kind="approval")
    assert f"https://a.example.com/app/runs/{RUN_ID}" in out.text
    assert "https://a.example.com/app/settings?tab=preferences" in out.text
    assert "b.example.com" not in out.html and "b.example.com" not in out.text


def test_the_renderer_accepts_no_prompt_or_content_parameter():
    params = inspect.signature(rwe.render_run_waiting).parameters
    assert list(params) == ["workflow_name", "org_name", "waited_seconds", "run_id", "kind"]
    assert all(p.kind is inspect.Parameter.KEYWORD_ONLY for p in params.values())


# ── the invite on the shell (UI-D4) ────────────────────────────────────────────────────

def test_the_invite_is_composed_on_the_shell(monkeypatch):
    seen = []

    def _capture(msg, *, idempotency_key=None):
        seen.append(msg)
        return email_provider.SendOutcome("sent", provider="resend")

    monkeypatch.setattr(email_provider, "send_email", _capture)
    link = "https://app.example.com/invite?token=abc"
    outcome = email_provider.send_invite("p@example.com", link, "Acme\r\nBcc: x")

    assert outcome.status == "sent"
    (msg,) = seen
    assert msg.to == "p@example.com"
    assert msg.subject == "You're invited to Acme  Bcc: x on Syrel"
    assert "You have been invited to join <strong>Acme" in msg.html
    assert f'href="{link}"' in msg.html and ">Accept your invitation</a>" in msg.html
    assert 'alt="Syrel"' in msg.html
    assert "border-top" not in msg.html   # no footer on an invite
    assert msg.text == (
        "You have been invited to join Acme  Bcc: x on Syrel.\n\n"
        f"Accept your invitation:\n{link}"
    )
