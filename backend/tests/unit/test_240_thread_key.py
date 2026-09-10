"""Phase 240 (SRC-05 / D-3 / D-240-05) — the conversation key, derived from the message itself.

⛔ **THE FATE THIS FILE IS WRITTEN AGAINST.** ROADMAP 240 predicts its own failure mode in as many
words: *"`thread_key` is stored and read by nothing — the exact fate `message_id` / `in_reply_to`
/ `references` already suffered here."* Those three headers are parsed today and copied into
`metadata`, and **nothing anywhere reads them back**. Adding a fourth write would satisfy the
letter of SRC-05 and none of its point.

## Why the headers and not Gmail's `threadId`

D-3 calls this a **retrieval-grouping** column, not a provider id. A provider thread id is
meaningless outside that provider and outside that account, so it could never group a manually
uploaded `.eml` with its synced twin — and manual upload is where essentially all mail in this
Library is today.

⭐ Google's own reference argues for the same choice: the `threadId` field description states that
adding a message to a thread requires *"the `References` and `In-Reply-To` headers … in compliance
with RFC 2822"*. Gmail derives its thread from the headers this rule reads.

⚠ **The known weakness, recorded rather than hidden.** A client that omits `References` breaks the
chain and its message becomes a thread of one. That is a *visible* degradation — a singleton
conversation someone can see — never a wrong grouping. The failure direction matters more than the
failure rate.

## The fixture factory

`make_thread(n)` is this phase's most valuable artefact and is imported by `240-03`'s SC#1
measurement. It builds a real quoting thread: message 1 states a distinctive paragraph, and every
reply quotes it under an `On … wrote:` line with `>` prefixes — the shape that makes a 14-message
thread contain message 1 fourteen times, each body differing by the accreted quote block so hash
dedup never fires.
"""

from __future__ import annotations

from email.message import EmailMessage

import pytest

from app.services.email_extraction_service import (
    MAX_THREAD_KEY_CHARS,
    parse_eml_bytes,
    thread_key_for,
)

#: The sentence message 1 says and every reply quotes. Distinctive enough to count occurrences.
DISTINCTIVE_PARAGRAPH = "The renewal price is 41,200 euros and it is fixed until March."

CRLF = "\r\n"


def _quote_block(prior_body: str) -> str:
    """A reply's accreted quote trail, in the Gmail dialect."""
    quoted = CRLF.join("> " + line for line in prior_body.split(CRLF))
    return f"On Mon, 07 Sep 2026 at 09:00, Alice <alice@example.com> wrote:{CRLF}{quoted}"


def make_thread(
    n: int,
    *,
    dialect: str = "gmail",
    with_references: bool = True,
) -> list[bytes]:
    """`n` RFC-822 messages of ONE conversation, each reply quoting everything before it.

    `dialect` selects how the quote trail is introduced — `gmail`, `outlook` or `original` —
    because `strip_quoted_replies` recognises a FINITE set of introductions and a dialect it does
    not know is a dialect whose quotes survive into the chunks.
    """
    messages: list[bytes] = []
    bodies: list[str] = []
    for i in range(1, n + 1):
        if i == 1:
            body = f"Hello,{CRLF}{CRLF}{DISTINCTIVE_PARAGRAPH}{CRLF}{CRLF}Alice"
        else:
            own = f"Noted, thanks — reply number {i}."
            prior = bodies[-1]
            if dialect == "outlook":
                trail = (
                    f"From: Alice <alice@example.com>{CRLF}"
                    f"Sent: Monday, 07 September 2026 09:00{CRLF}"
                    f"To: Bob <bob@example.com>{CRLF}{CRLF}{prior}"
                )
            elif dialect == "original":
                trail = f"-----Original Message-----{CRLF}{prior}"
            else:
                trail = _quote_block(prior)
            body = f"{own}{CRLF}{CRLF}{trail}"
        bodies.append(body)

        msg = EmailMessage()
        msg["Subject"] = "Renewal" if i == 1 else "Re: Renewal"
        msg["From"] = "alice@example.com" if i % 2 else "bob@example.com"
        msg["To"] = "bob@example.com" if i % 2 else "alice@example.com"
        msg["Date"] = f"Mon, 07 Sep 2026 {9 + i:02d}:00:00 +0000"
        msg["Message-ID"] = f"<msg-{i}@example.com>"
        if i > 1:
            msg["In-Reply-To"] = f"<msg-{i - 1}@example.com>"
            if with_references:
                msg["References"] = " ".join(f"<msg-{k}@example.com>" for k in range(1, i))
        msg.set_content(body)
        messages.append(msg.as_bytes())
    return messages


def _simple(**headers: str) -> bytes:
    msg = EmailMessage()
    msg["Subject"] = headers.pop("subject", "A subject")
    msg["From"] = "a@example.com"
    msg["Date"] = "Mon, 07 Sep 2026 09:00:00 +0000"
    for k, v in headers.items():
        msg[k.replace("_", "-")] = v
    msg.set_content("body")
    return msg.as_bytes()


# ── the rule ───────────────────────────────────────────────────────────────────────────────


def test_every_message_of_a_thread_shares_one_key() -> None:
    """⭐ SC#3's substrate: fourteen messages, one conversation, one key."""
    keys = {thread_key_for(parse_eml_bytes(raw)) for raw in make_thread(14)}
    assert len(keys) == 1, f"a 14-message thread produced {len(keys)} keys: {sorted(keys)}"
    assert keys == {"msg-1@example.com"}, "the key must be the ROOT message's id, normalised"


def test_a_standalone_message_is_a_thread_of_one_not_a_null() -> None:
    """A message with an id and no chain is its OWN conversation — not "unknown"."""
    raw = _simple(Message_ID="<solo@example.com>")
    assert thread_key_for(parse_eml_bytes(raw)) == "solo@example.com"


def test_a_message_with_no_usable_header_yields_none() -> None:
    """⚠ NULL is the honest answer, and it is why the column is nullable.

    "This is not mail" and "this is mail whose client wrote no Message-ID" are different facts.
    A sentinel would make them indistinguishable — the mistake `metadata.source.path` already
    paid for at D-238-07.4.
    """
    raw = b"Subject: No identity\r\nFrom: a@example.com\r\n\r\nbody\r\n"
    assert thread_key_for(parse_eml_bytes(raw)) is None


def test_references_wins_over_in_reply_to_wins_over_own_id() -> None:
    """Precedence, asserted where all three differ so no two can be confused."""
    raw = _simple(
        Message_ID="<own@example.com>",
        In_Reply_To="<parent@example.com>",
        References="<root@example.com> <parent@example.com>",
    )
    assert thread_key_for(parse_eml_bytes(raw)) == "root@example.com"

    raw_no_refs = _simple(
        Message_ID="<own@example.com>", In_Reply_To="<parent@example.com>"
    )
    assert thread_key_for(parse_eml_bytes(raw_no_refs)) == "parent@example.com"

    raw_alone = _simple(Message_ID="<own@example.com>")
    assert thread_key_for(parse_eml_bytes(raw_alone)) == "own@example.com"


def test_normalisation_collapses_the_ways_one_id_can_be_written() -> None:
    """Angle brackets, case and surrounding whitespace must not create three conversations."""
    variants = ["<A@B.Example>", " a@b.example ", "<a@B.EXAMPLE>"]
    keys = {thread_key_for(parse_eml_bytes(_simple(Message_ID=v))) for v in variants}
    assert keys == {"a@b.example"}


def test_subject_is_never_an_input() -> None:
    """⛔ TM-240-08 — "Re: Budget" collides across unrelated conversations AND across people.

    A wrong grouping is worse than no grouping: it puts one person's mail in another
    conversation's answer, and nothing on the screen would say so.
    """
    a = _simple(subject="Re: Budget", Message_ID="<a@example.com>")
    b = _simple(subject="Re: Budget", Message_ID="<b@example.com>")
    assert thread_key_for(parse_eml_bytes(a)) != thread_key_for(parse_eml_bytes(b))


def test_an_oversized_message_id_is_truncated() -> None:
    """TM-240-07 — a Message-ID is attacker-LENGTH as well as attacker-content."""
    huge = "<" + ("x" * 5000) + "@example.com>"
    key = thread_key_for(parse_eml_bytes(_simple(Message_ID=huge)))
    assert key is not None
    assert len(key) == MAX_THREAD_KEY_CHARS


def test_control_characters_are_dropped() -> None:
    """TM-240-07 — a NUL in a header is how a v3.7 `22P05` reached Postgres from a `.msg`."""
    key = thread_key_for(
        parse_eml_bytes(_simple(Message_ID="<a\x00b@example.com>"))
    )
    assert key is not None
    assert "\x00" not in key
    assert "\n" not in key and "\r" not in key


@pytest.mark.parametrize("dialect", ["gmail", "outlook", "original"])
def test_the_factory_really_repeats_the_paragraph(dialect: str) -> None:
    """A control on the FIXTURE, not on the code.

    ⚠ If the factory did not actually accrete the quote trail, `240-03`'s SC#1 measurement would
    pass against a thread that never had the problem — a test proving nothing while looking green.
    """
    raws = make_thread(14, dialect=dialect)
    bodies = [parse_eml_bytes(r).body for r in raws]
    carriers = [b for b in bodies if DISTINCTIVE_PARAGRAPH in b]
    assert len(carriers) == 14, (
        f"the {dialect} fixture repeats the paragraph in {len(carriers)}/14 messages — "
        "it must be in ALL of them for the SC#1 measurement to mean anything"
    )
