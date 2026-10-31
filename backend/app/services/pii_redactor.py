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
    envelope ids (Pitfall 9). The card is looked for at every digit-group start of a run, so an
    expiry, a CVV or a quantity next to it does not hide it (305-REVIEW-04 BL-04-01).
  * **IBANs** -> ``[IBAN removed]`` — the ISO 13616 country length table + the mod-97 check,
    tried from every "two letters + two digits" start (a VAT id before it cannot swallow it).
  * **secrets** -> ``[secret removed]`` — key prefixes (``srl_live_``, ``srl_mcp_``, ``sk-``,
    ``sk-ant-``, ``sk-proj-``, ``gh[pousr]_``, ``github_pat_``, ``AKIA``/``ASIA``,
    ``xox[baprs]-``, ``whsec_``, ``AIza``), three-part JWTs (``eyJ….eyJ….…``, wherever they sit,
    links included — a JWT is a bearer token), and high-entropy tokens of 32..128 characters that
    mix upper case, lower case and digits. Excluded by shape: canonical UUIDs, hex digests, paths
    (a leading ``/``, or leading segments that are words — never after a secret keyword or as a
    ``NAME=`` value, so a slash-bearing base64 key is still caught), and anything that is part of a link (a scheme or ``www.`` in the same word, a ``?``/``&`` query
    parameter, a percent-encoded neighbour) — measured on the local corpus, 30 of 30 sampled
    entropy hits were link tracking tokens before those exclusions (305-04 v1). ``NAME=value``
    is judged on the value, so an env line keeps its name.

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
from functools import lru_cache
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


# A filename such as ``Contact sheet jane@example.com.txt`` must keep its extension: when the last
# label is a common file extension AND a dotted domain remains without it, the extension is not
# part of the address (``office@company.md`` keeps ``.md`` — no dot would remain).
_FILE_EXTENSIONS = frozenset({
    "pdf", "txt", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "md", "json", "xml", "html",
    "htm", "png", "jpg", "jpeg", "gif", "eml", "msg", "zip", "rtf", "odt", "ods", "tsv", "log",
})


def _emails(text: str) -> Iterator[tuple[int, int]]:
    for m in _EMAIL.finditer(text):
        start, end = m.start(), m.end()
        address = m.group(0)
        domain = address[address.index("@") + 1:]
        head, _, last = domain.rpartition(".")
        if last.lower() in _FILE_EXTENSIONS and "." in head:
            end -= len(last) + 1
        yield start, end


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

# Zero-width, so EVERY "two letters + two digits" start is tried (305-REVIEW-04 BL-04-01): a
# consuming pattern let an earlier token (a VAT id, an unknown country code) swallow the real IBAN,
# and when that token failed validation the IBAN inside it was never looked at.
_IBAN_START = re.compile(r"\b(?=([A-Z]{2})\d{2})")
_IBAN_BODY = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")


def _mod97(compact: str) -> bool:
    rearranged = compact[4:] + compact[:4]
    total = 0
    for ch in rearranged:
        total = (total * (100 if ch.isalpha() else 10) + int(ch, 36)) % 97
    return total == 1


def _iban_end(text: str, start: int, need: int) -> int | None:
    """End of ``need`` body characters after ``start + 4``, each optionally after ONE space."""
    i, n = start + 4, len(text)
    while need:
        if i < n and text[i] == " " and i + 1 < n and text[i + 1] in _IBAN_BODY:
            i += 1
        if i >= n or text[i] not in _IBAN_BODY:
            return None
        i += 1
        need -= 1
    return i


def _ibans(text: str) -> Iterator[tuple[int, int]]:
    taken = -1
    for m in _IBAN_START.finditer(text):
        start = m.start()
        if start < taken:
            continue
        length = IBAN_LENGTHS.get(m.group(1))
        if length is None:
            continue
        end = _iban_end(text, start, length - 4)
        if end is None or (end < len(text) and text[end].isalnum()):
            continue  # too short, or the country length would cut a word in half
        if _mod97(text[start:end].replace(" ", "")):
            taken = end
            yield start, end


# ── cards ───────────────────────────────────────────────────────────────────────────────────

# A whole run of digits joined by single spaces or hyphens. The card is looked for at every GROUP
# start inside it (305-REVIEW-04 BL-04-01): a greedy, non-overlapping candidate grew into the
# expiry, the CVV or a quantity next to the card, failed the brand or Luhn check as a whole, and
# the real number inside it was never tried.
_DIGIT_RUN = re.compile(r"(?<!\d)\d(?:[ \-]?\d)*")
_CARD_LENGTHS = (19, 18, 17, 16, 15, 14, 13)  # longest first: a 19-digit Visa is not cut to 16
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


@lru_cache(maxsize=4096)
def _brand_lengths(head: str) -> tuple[int, ...]:
    """The card lengths, longest first, that some brand allows for this 6-digit IIN head
    (``card_brand`` reads only the first six digits and the length)."""
    return tuple(n for n in _CARD_LENGTHS if card_brand(head + "0" * (n - len(head))))


def _keyword_near(rx: re.Pattern, text: str, start: int, end: int) -> bool:
    before = text[max(0, start - KEYWORD_WINDOW):start]
    after = text[end:end + KEYWORD_WINDOW]
    return bool(rx.search(before) or rx.search(after))


def _cards(text: str) -> Iterator[tuple[int, int]]:
    for m in _DIGIT_RUN.finditer(text):
        raw, base = m.group(0), m.start()
        idx = [i for i, c in enumerate(raw) if c != " " and c != "-"]  # offsets of the digits
        if len(idx) < 13:
            continue
        run = "".join(raw[i] for i in idx)
        # A window may start only where a group starts and end only where a group ends, so a
        # compact run (one group) is judged whole, never as its digit-by-digit sub-windows.
        a, count = 0, len(idx)
        while a <= count - 13:
            if (a and idx[a] == idx[a - 1] + 1) or run[a] not in "23456":
                a += 1
                continue  # not a group start, or no brand IIN starts with this digit
            hit = None
            for n in _brand_lengths(run[a:a + 6]):
                b = a + n - 1
                if b >= count or (b + 1 < count and idx[b + 1] == idx[b] + 1):
                    continue
                digits = run[a:b + 1]
                if not _luhn(digits):
                    continue
                s, e = idx[a], idx[b] + 1
                if any(rx.fullmatch(raw[s:e]) for rx in _CARD_GROUPED) or _keyword_near(
                        _CARD_KEYWORD, text, base + s, base + e):
                    hit = (base + s, base + e, b)
                    break
            if hit is None:
                a += 1
                continue
            yield hit[0], hit[1]
            a = hit[2] + 1


# ── phones ──────────────────────────────────────────────────────────────────────────────────

# The international form must START a token: preceded by nothing, whitespace or ( [ : ; | " ' > *.
# Measured 305-04 v1: a "00" after a decimal point ("0.002 33.1"), a comma ("1,002") or a hyphen
# (a UUID group "-0045…") is not a phone number.
_PHONE_INTL = re.compile(r"(?<![^\s(\[:;|\"'>*])(?:\+|00)[1-9](?:[ .\-()]{0,3}\d){6,14}(?!\d)")
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


ENTROPY_MAX_LEN = 128
_WORD_START = re.compile(r"[\s<(\[{\"']")
_PERCENT = re.compile(r"%[0-9A-Fa-f]{2}")


# A path's leading segments are words ("docs/archive/…", "ss/c/u001/…"): lower case and digits,
# with at most a leading capital. A base64 secret's segments are not (305-REVIEW-04 WR-04-01:
# "two or more slashes" alone let 13.5% of random 40-char base64 keys through. With no keyword,
# this shape lets about 1% through (mostly a leading "/" plus another "/": an absolute-path
# shape); after a secret keyword or as a NAME= value, none. It re-admitted 0 of the 5 corpus
# tokens the old rule dropped — all five were absolute paths).
_PATH_SEGMENT = re.compile(r"[A-Za-z]?[a-z0-9_\-]*")
_SECRET_KEYWORD = re.compile(
    r"(?<![a-z])(?:key|secret|token|passw(?:or)?d|pwd|credential|auth)", re.IGNORECASE
)


def _path_shaped(tok: str) -> bool:
    segments = tok.split("/")
    if len(segments) < 3:
        return False  # one slash is no path: "/<token>" and "<a>/<b>" are judged as tokens
    return tok.startswith("/") or all(_PATH_SEGMENT.fullmatch(s) for s in segments[:-1])


def _inside_url(text: str, start: int) -> bool:
    """True when the token sits in a URL: the whitespace-delimited word it belongs to (looked back
    at most 2,048 chars) carries a scheme or starts with ``www.``."""
    lo = max(0, start - 2048)
    i = start
    while i > lo and not _WORD_START.match(text[i - 1]):
        i -= 1
    prefix = text[i:start]
    return "://" in prefix or prefix.lower().startswith("www.")


def _entropy(text: str) -> Iterator[tuple[int, int]]:
    """Measured 305-04 v1: 30 of 30 sampled hits were URL tracking tokens, so a token in a URL, a
    path-shaped token and a blob over 128 chars (tracking payloads, base64 data) are not secrets
    here. A key-shaped secret IN a URL is still caught by the prefix recognizers, which run first."""
    for m in _TOKEN.finditer(text):
        start, end = m.start(), m.end()
        tok = m.group(0)
        if text[start - 1:start] in ("?", "&"):
            continue  # a query parameter of a link (measured 305-04 v2)
        body = tok.rstrip("=")
        named = "=" in body
        if named:  # NAME=value: judge the value alone (an env line keeps its name)
            cut = body.rfind("=") + 1
            start, tok = start + cut, tok[cut:]
            if len(tok) < ENTROPY_MIN_LEN:
                continue
        if _PERCENT.match(text, end) or _PERCENT.fullmatch(text[max(0, start - 3):start]):
            continue  # percent-encoded neighbours: a fragment of a URL (measured 305-04 v2)
        if _UUID.fullmatch(tok) or _HEX.fullmatch(tok):
            continue
        if len(tok) > ENTROPY_MAX_LEN:
            continue
        if "/" in tok and _path_shaped(tok) and not (
                named or _SECRET_KEYWORD.search(text[max(0, start - KEYWORD_WINDOW):start])):
            continue  # a path — unless it is a NAME= value or follows a secret keyword
        if _inside_url(text, start):
            continue
        if not (any(c.isupper() for c in tok) and any(c.islower() for c in tok)
                and any(c.isdigit() for c in tok)):
            continue  # slugs, snake_case identifiers and words are not tokens
        if shannon_bits(tok) >= ENTROPY_MIN_BITS:
            yield start, end


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
