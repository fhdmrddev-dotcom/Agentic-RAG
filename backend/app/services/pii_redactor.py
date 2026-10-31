"""Phase 305-04 (GUARD-03; D-33 / D-56; T-305-11) — the deterministic, in-house PII redactor.

What it masks, with exactly these words (the org admin card quotes the first one):

  * **email addresses** -> ``[email removed]``
  * **phone numbers** -> ``[phone removed]`` — international form (``+`` or ``00``) always; a
    national number ONLY with a phone keyword (tel, phone, telephone, mobile, fax, call, WhatsApp)
    within 24 characters, because grouped national shapes are mostly numeric tables (R-21: 97 of
    111 phone candidates on the local corpus were tables).
  * **card numbers** -> ``[card number removed]`` — brand IIN + brand length + Luhn, AND a
    4-4-4-4 / 4-6-5 grouping or a card keyword within 24 characters. Luhn alone accepts about one
    random digit run in ten, and the two corpus runs that passed IIN + length were DocuSign
    envelope ids (Pitfall 9).
  * **IBANs** -> ``[IBAN removed]`` — the ISO 13616 country length table + the mod-97 check.
  * **secrets** -> ``[secret removed]`` — key prefixes (``srl_live_``, ``srl_mcp_``, ``sk-``,
    ``sk-ant-``, ``sk-proj-``, ``gh[pousr]_``, ``github_pat_``, ``AKIA``/``ASIA``,
    ``xox[baprs]-``, ``whsec_``, ``AIza``), three-part JWTs (``eyJ….eyJ….…``), and high-entropy
    tokens of 32+ characters that mix upper case, lower case and digits — canonical UUIDs and hex
    digests are excluded by shape.

⛔ **NAMES ARE NOT COVERED** (GUARD-03). Recognising a person's name needs a model, not a pattern;
the org admin card, ``docs/OPERATOR.md`` and this docblock all say so. Postal addresses, dates of
birth and national id numbers are not covered either.

**No dependency.** Stdlib ``re`` plus two checksums (Luhn, mod-97): no Presidio, no spaCy, no cloud
DLP — the result is deterministic, offline, and the same on every worker.

**Bounded and linear (T-305-11).** Every pattern is a single pass with bounded repetition and no
nested unbounded quantifier; the anchored lookbehinds stop a candidate from starting mid-run, so a
long run of one character class costs O(run), not O(run²). Inputs are bounded by the caller: a
read chunk is ``READ_BUDGET`` (8,000) + the 128-character overlap window on each side, a search
passage is one ingest chunk, a title is a filename. Anything over ``MAX_INPUT`` raises rather than
being scanned.

**Fail-closed by its caller.** This module raises on its own errors and never swallows them;
``services/outbound_guard`` turns ANY exception (or its 2 s deadline) into a withheld result, never
an unredacted one.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Callable, Iterator, NamedTuple

MAX_INPUT = 64_000
KEYWORD_WINDOW = 24
ENTROPY_MIN_LEN = 32
ENTROPY_MIN_BITS = 4.0

MASKS = {
    "email": "[email removed]",
    "phone": "[phone removed]",
    "card": "[card number removed]",
    "iban": "[IBAN removed]",
    "secret": "[secret removed]",
}


class Span(NamedTuple):
    start: int
    end: int
    mask: str


# ── secrets ─────────────────────────────────────────────────────────────────────────────────

_SECRET_PATTERNS = [
    re.compile(r"\bsrl_(?:live|mcp)_[A-Za-z0-9_\-]{8,}"),
    re.compile(r"\bsk-(?:ant-|proj-)[A-Za-z0-9_\-]{16,}"),
    re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}"),
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"\bwhsec_[A-Za-z0-9+/=]{16,}"),
    re.compile(r"\bAIza[0-9A-Za-z_\-]{35}(?![0-9A-Za-z_\-])"),
    re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}"),
]


def _has_digit_and_letter(s: str) -> bool:
    return any(c.isdigit() for c in s) and any(c.isalpha() for c in s)


def _secrets(text: str) -> Iterator[tuple[int, int]]:
    for rx in _SECRET_PATTERNS:
        for m in rx.finditer(text):
            if rx.pattern.startswith(r"\bsk-[") and not _has_digit_and_letter(m.group(0)[3:]):
                continue  # a bare "sk-" body must look like a key, not a hyphenated word
            yield m.start(), m.end()


# ── email ───────────────────────────────────────────────────────────────────────────────────

_EMAIL = re.compile(
    r"(?<![A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]{1,64}@(?:[A-Za-z0-9\-]{1,63}\.){1,8}[A-Za-z]{2,24}"
    r"(?![A-Za-z0-9\-])"
)


def _emails(text: str) -> Iterator[tuple[int, int]]:
    for m in _EMAIL.finditer(text):
        yield m.start(), m.end()


# ── IBAN ────────────────────────────────────────────────────────────────────────────────────

IBAN_LENGTHS = {
    "AD": 24, "AE": 23, "AL": 28, "AT": 20, "AZ": 28, "BA": 20, "BE": 16, "BG": 22, "BH": 22,
    "BI": 27, "BR": 29, "BY": 28, "CH": 21, "CR": 22, "CY": 28, "CZ": 24, "DE": 22, "DJ": 27,
    "DK": 18, "DO": 28, "EE": 20, "EG": 29, "ES": 24, "FI": 18, "FK": 18, "FO": 18, "FR": 27,
    "GB": 22, "GE": 22, "GI": 23, "GL": 18, "GR": 27, "GT": 28, "HR": 21, "HU": 28, "IE": 22,
    "IL": 23, "IQ": 23, "IS": 26, "IT": 27, "JO": 30, "KW": 30, "KZ": 20, "LB": 28, "LC": 32,
    "LI": 21, "LT": 20, "LU": 20, "LV": 21, "LY": 25, "MC": 27, "MD": 24, "ME": 22, "MK": 19,
    "MN": 20, "MR": 27, "MT": 31, "MU": 30, "NI": 28, "NL": 18, "NO": 15, "OM": 23, "PK": 24,
    "PL": 28, "PS": 29, "PT": 25, "QA": 29, "RO": 24, "RS": 22, "RU": 33, "SA": 24, "SC": 31,
    "SD": 18, "SE": 24, "SI": 19, "SK": 24, "SM": 27, "SO": 23, "ST": 25, "SV": 28, "TL": 23,
    "TN": 24, "TR": 26, "UA": 29, "VA": 22, "VG": 24, "XK": 20, "YE": 30,
}

_IBAN = re.compile(r"\b([A-Z]{2})(\d{2})((?: ?[A-Z0-9]){10,30})")


def _mod97(compact: str) -> bool:
    rearranged = compact[4:] + compact[:4]
    total = 0
    for ch in rearranged:
        total = (total * (100 if ch.isalpha() else 10) + int(ch, 36)) % 97
    return total == 1


def _ibans(text: str) -> Iterator[tuple[int, int]]:
    for m in _IBAN.finditer(text):
        length = IBAN_LENGTHS.get(m.group(1))
        if length is None:
            continue
        need, end = length - 4, None
        for i in range(m.start(3), m.end(3)):
            if text[i] != " ":
                need -= 1
                if need == 0:
                    end = i + 1
                    break
        if end is None or (end < len(text) and text[end].isalnum()):
            continue  # too short, or the country length would cut a word in half
        compact = text[m.start():end].replace(" ", "")
        if _mod97(compact):
            yield m.start(), end


# ── cards ───────────────────────────────────────────────────────────────────────────────────

_CARD = re.compile(r"(?<![\d])(?:\d[ \-]?){12,18}\d(?!\d)")
_CARD_GROUPED = (
    re.compile(r"\d{4}([ \-])\d{4}\1\d{4}\1\d{4}"),
    re.compile(r"\d{4}([ \-])\d{6}\1\d{5}"),
)
_CARD_KEYWORD = re.compile(r"\b(?:card|visa|mastercard|amex|credit|debit|cc)\b", re.IGNORECASE)


def _luhn(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def card_brand(digits: str) -> str | None:
    """The brand whose IIN range AND length both fit, or ``None``."""
    n = len(digits)
    p2, p3, p4, p6 = (int(digits[:k]) for k in (2, 3, 4, 6))
    if digits[0] == "4" and n in (13, 16, 19):
        return "visa"
    if (51 <= p2 <= 55 or 2221 <= p4 <= 2720) and n == 16:
        return "mastercard"
    if p2 in (34, 37) and n == 15:
        return "amex"
    if (p4 == 6011 or p2 == 65 or 644 <= p3 <= 649 or 622126 <= p6 <= 622925) and 16 <= n <= 19:
        return "discover"
    if 3528 <= p4 <= 3589 and 16 <= n <= 19:
        return "jcb"
    if (300 <= p3 <= 305 or p2 in (36, 38, 39)) and 14 <= n <= 19:
        return "diners"
    return None


def _keyword_near(rx: re.Pattern, text: str, start: int, end: int) -> bool:
    before = text[max(0, start - KEYWORD_WINDOW):start]
    after = text[end:end + KEYWORD_WINDOW]
    return bool(rx.search(before) or rx.search(after))


def _cards(text: str) -> Iterator[tuple[int, int]]:
    for m in _CARD.finditer(text):
        raw = m.group(0)
        digits = re.sub(r"\D", "", raw)
        if not 13 <= len(digits) <= 19 or card_brand(digits) is None or not _luhn(digits):
            continue
        grouped = any(rx.fullmatch(raw) for rx in _CARD_GROUPED)
        if grouped or _keyword_near(_CARD_KEYWORD, text, m.start(), m.end()):
            yield m.start(), m.end()


# ── phones ──────────────────────────────────────────────────────────────────────────────────

_PHONE_INTL = re.compile(r"(?<![\w+])(?:\+|(?<!\d)00)[1-9](?:[ .\-()]{0,3}\d){6,14}(?!\d)")
_PHONE_NATIONAL = (
    re.compile(
        r"(?<![\w+])(?:\(\d{2,5}\)[ .\-]?\d{2,8}|\d{2,5}[ .\-]\d{2,8})(?:[ .\-]\d{2,8}){0,3}(?!\w)"
    ),
    re.compile(r"(?<![\w+])\d{7,13}(?!\w)"),
)
_PHONE_KEYWORD = re.compile(r"\b(?:tel|phone|telephone|mobile|fax|call|whatsapp)\b", re.IGNORECASE)


def _phones(text: str) -> Iterator[tuple[int, int]]:
    for m in _PHONE_INTL.finditer(text):
        if 7 <= sum(c.isdigit() for c in m.group(0)) <= 15:
            yield m.start(), m.end()
    for rx in _PHONE_NATIONAL:
        for m in rx.finditer(text):
            if not 7 <= sum(c.isdigit() for c in m.group(0)) <= 13:
                continue
            if _keyword_near(_PHONE_KEYWORD, text, m.start(), m.end()):
                yield m.start(), m.end()


# ── high-entropy tokens ─────────────────────────────────────────────────────────────────────

_TOKEN = re.compile(r"(?<![A-Za-z0-9_\-+/=])[A-Za-z0-9_\-+/=]{%d,}" % ENTROPY_MIN_LEN)
_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_HEX = re.compile(r"[0-9a-fA-F]+")


def shannon_bits(s: str) -> float:
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in Counter(s).values()) if n else 0.0


def _entropy(text: str) -> Iterator[tuple[int, int]]:
    for m in _TOKEN.finditer(text):
        tok = m.group(0)
        if _UUID.fullmatch(tok) or _HEX.fullmatch(tok):
            continue
        if not (any(c.isupper() for c in tok) and any(c.islower() for c in tok)
                and any(c.isdigit() for c in tok)):
            continue  # slugs, snake_case identifiers and words are not tokens
        if shannon_bits(tok) >= ENTROPY_MIN_BITS:
            yield m.start(), m.end()


# ── the chain ───────────────────────────────────────────────────────────────────────────────

# Ordered: an earlier recognizer's span wins any overlap (a key prefix beats the entropy test, an
# IBAN's digits never become a card).
RECOGNIZERS: list[tuple[str, Callable[[str], Iterator[tuple[int, int]]]]] = [
    ("secret", _secrets),
    ("email", _emails),
    ("iban", _ibans),
    ("card", _cards),
    ("phone", _phones),
    ("secret", _entropy),
]


class DeterministicRedactor:
    """The ``outbound_guard.Redactor`` the MCP path uses (``name`` is recorded nowhere secret)."""

    name = "deterministic-v1"

    def spans(self, text: str) -> list[Span]:
        if len(text) > MAX_INPUT:
            raise ValueError(f"redactor input over {MAX_INPUT} characters")
        claimed: list[Span] = []
        for kind, recognize in RECOGNIZERS:
            mask = MASKS[kind]
            for start, end in recognize(text):
                if any(start < c.end and c.start < end for c in claimed):
                    continue
                claimed.append(Span(start, end, mask))
        claimed.sort()
        return claimed

    def redact(self, text: str) -> str:
        return apply(text, self.spans(text))

    def labelled_spans(self, text: str) -> list[tuple[str, int, int]]:
        """``(recognizer, start, end)`` — for ``scripts/measure-redaction.py`` only."""
        kinds = {mask: kind for kind, mask in MASKS.items()}
        return [(kinds[s.mask], s.start, s.end) for s in self.spans(text)]


def apply(text: str, spans: list[Span]) -> str:
    out, at = [], 0
    for start, end, mask in spans:
        out.append(text[at:start])
        out.append(mask)
        at = end
    out.append(text[at:])
    return "".join(out)
