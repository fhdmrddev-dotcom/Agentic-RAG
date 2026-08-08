"""Phase 190 (CONN-03 / D-04 / D-05) — THE STANDING FENCE OVER ``connectors/**``.

**Every fence in this file guards a PROPERTY, not a patch.** That distinction is the whole
reason the file exists, and it is the Phase-185 lesson stated as a rule: *a deny-list cannot
be made fail-closed by extension.* A fence that pins one string, one CIDR or one symbol is a
patch — it is satisfied the day someone spells the same thing differently. The four
properties asserted below are:

  1. **No module under this package references a transport at all** (D-05). Not "no
     ``httpx.``" — no transport module is imported and no attribute is read off one, in any
     spelling. Every socket comes from ``app.security.egress``.
  2. **The registry's key set IS the closed capability set** (D-04) — derived from
     ``EXTERNAL_ACTION_CAPABILITIES`` rather than agreeing with it by coincidence, so a
     fourth key is an ``AssertionError`` at IMPORT rather than a latent surface.
  3. **Every capability resolves to a real, importable adapter that claims its own key.**
     190-08 registered three module paths when one adapter existed; this is the check that
     turned that convenience into a promise with a date on it.
  4. **No adapter hand-builds an encoded credential** — and that fence is SCOPED, per plan
     190-11's explicit hand-off, because a blanket ban would be wrong for exactly one file.

── WHY THE MATCHER IS A REGEX MAP AND NOT D-05'S SIX SUBSTRINGS ──────────────────────────
D-05 names six tokens: ``httpx.``, ``requests.``, ``smtplib.``, ``urllib.request``,
``socket.`` and ``.sendmail(``. Plans 190-08 and 190-10 each fenced their own single file
with that tuple as a plain substring search, and handed the tree-wide walk here.

A plain substring search over a whole package is a patch in two directions at once, and both
were measured rather than imagined:

  * **It under-fires.** ``import requests`` — the line that makes ``requests.`` possible —
    contains none of the six tokens. A module could import every transport in the standard
    library and the substring fence would report green.
  * **It over-fires on prose.** These modules are 65 % docstring. A sentence that ends
    *"...to cap the number of requests."* contains ``requests.`` verbatim. A fence that
    flags English is a fence that gets loosened away, and the loosening is what actually
    removes the protection.

So each token is expressed as the PROPERTY it stands for — *a transport module is imported,
or an attribute is read off one* — and the positive control below then proves that **all six
of D-05's literal tokens still fire**, each embedded in a line of real source. The contract
is met by a superset, and the superset is driven rather than asserted.

── WHY EVERY FENCE HERE HAS A POSITIVE CONTROL, LISTED FIRST ─────────────────────────────
Three separate plans in this phase shipped a fence that checked nothing:

  * **190-02**'s source fence was INERT — a docstring is a string literal, not a comment, and
    only its positive control noticed.
  * **190-13** found a fence that *could not fire* because its preconditions were never set.
  * **189**'s own ``\\bmcp\\b`` matcher was falsified by its control before it ever shipped:
    it does not match ``MCPClient``, the single most likely spelling.

**A fence nobody has observed failing is not a fence.** Each property below was driven RED
against a real plant in real production source; the verbatim output is recorded in
``190-14-SUMMARY.md``, and every plant was restored md5-identical.
"""

from __future__ import annotations

import importlib
import re
from pathlib import Path

# backend/tests/unit/<this file>  ->  parents[2] == backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_CONNECTORS_ROOT = _BACKEND_ROOT / "app" / "services" / "connectors"

#: Measured at plan time with ``ls backend/app/services/connectors/*.py | wc -l`` -> **6**.
#: The names are pinned as well as the count, for the reason 190-13 recorded: a walk that
#: silently stops visiting the adapters would keep a plausible-looking count while covering
#: none of the files that can actually open a socket.
_EXPECTED_MODULES = frozenset({
    "__init__.py",
    "protocol.py",
    "registry.py",
    "smtp_adapter.py",
    "jira_adapter.py",
    "slack_adapter.py",
})

#: D-05 expressed as PROPERTIES. Each entry is ``name -> matcher``; the name is what a
#: failure message quotes, so a RED reads as a sentence rather than as a regex.
#:
#: The ``(?<![A-Za-z0-9_])`` prefix is what keeps ``websocket_handler`` and
#: ``fake_httpx_stub`` out, and the trailing ``[A-Za-z_]`` after each dot is what keeps
#: English sentences out — an attribute access is always followed by an identifier, a full
#: stop never is.
_BANNED_TRANSPORT: dict[str, re.Pattern[str]] = {
    "an attribute read off `httpx`": re.compile(r"(?<![A-Za-z0-9_])httpx\.[A-Za-z_]"),
    "an attribute read off `requests`": re.compile(r"(?<![A-Za-z0-9_])requests\.[A-Za-z_]"),
    "an attribute read off `smtplib`": re.compile(r"(?<![A-Za-z0-9_])smtplib\.[A-Za-z_]"),
    "an attribute read off `socket`": re.compile(r"(?<![A-Za-z0-9_])socket\.[A-Za-z_]"),
    "`urllib.request`": re.compile(r"(?<![A-Za-z0-9_])urllib\.request"),
    "a `.sendmail(` call": re.compile(r"\.sendmail\("),
    # The half a substring fence cannot see. Anchored at line start so a docstring that
    # merely says "we do not import requests here" is not a violation of itself.
    "a transport import": re.compile(
        r"^\s*(?:import|from)\s+(?:httpx|requests|smtplib|socket|urllib)(?![A-Za-z0-9_])"
    ),
}

#: D-05's six literal tokens, each inside a line of source as it would really be written.
#: The control asserts the property matchers above catch every one of them, which is what
#: ties this file's stronger matcher back to the CONTRACT's wording.
_D05_TOKENS_IN_REAL_LINES: dict[str, str] = {
    "httpx.": "    client = httpx.AsyncClient(timeout=10.0)",
    "requests.": "    resp = requests.post(url, json=payload)",
    "smtplib.": "    server = smtplib.SMTP_SSL(host, port)",
    "urllib.request": "    body = urllib.request.urlopen(url).read()",
    "socket.": "    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)",
    ".sendmail(": "    smtp.sendmail(sender, [recipient], raw)",
}

#: Lines that MUST NOT fire. Prose and near-miss identifiers, because a fence that flags
#: English produces noise, and noise is how a fence gets deleted.
_MUST_NOT_FIRE: tuple[str, ...] = (
    "    every socket comes from ``app.security.egress``",
    "    a cap on the number of concurrent requests.",
    "    def websocket_handler(scope, receive, send):",
    '    sender = "sendmailer@example.invalid"',
    "    # this module opens no socket and imports no transport",
    "    the binder owns the httpx client, so this file never does",
    "    _SOCKET_TIMEOUT_SECONDS = 10.0",
)

#: The credential-ENCODING vocabulary. 190-10's hand-off asked for it CASE-INSENSITIVELY —
#: a lowercase ``authorization`` header key is the same hand-built header in different
#: clothes, and a case-sensitive walk passes straight over it.
_CREDENTIAL_ENCODING: tuple[str, ...] = ("b64encode", "b64decode", "base64", "Authorization")

#: ⚠ **THE EXEMPTION IS THE POINT, AND IT IS SCOPED BY NAME (plan 190-11's hand-off).**
#: A tree-wide credential-header ban is correct for ``jira_adapter.py`` — that adapter hands
#: the pair to the transport library and the library encodes it, so a hand-built header there
#: would be a real regression. Applied to ``slack_adapter.py`` the SAME fence would be wrong:
#: an ``Authorization: Bearer`` header IS Slack's documented auth mechanism, there is nothing
#: encoded to hide, and the fence would be RED on correct code. A fence that is RED on correct
#: code gets deleted, taking the Jira half with it.
#:
#: So the exempt file is named, the reason is written down, and the property that replaces it
#: is named too — *the token appears in no body and in no refusal* — with the tests that
#: actually drive it listed, and their EXISTENCE asserted below rather than assumed.
_CREDENTIAL_FENCE_EXEMPT: dict[str, tuple[str, ...]] = {
    "slack_adapter.py": (
        "test_the_token_is_sent_in_the_HEADER_not_in_the_body",
        "test_the_bot_token_never_appears_in_a_failure",
    ),
}
_EXEMPTION_FENCED_BY = _BACKEND_ROOT / "tests" / "unit" / "test_190_slack_ok_false.py"


def _connector_python_files() -> list[Path]:
    return [p for p in _CONNECTORS_ROOT.rglob("*.py") if "__pycache__" not in p.parts]


# ── 1 · THE POSITIVE CONTROLS, FIRST IN THE FILE ──────────────────────────────


def test_the_banned_token_matcher_actually_matches():
    """D-05 positive control — the matcher fires on real transport source, and only on it.

    Listed first, in the shipped ``test_189_no_egress.py`` idiom, because a typo in any one
    of these seven patterns would make ``test_no_connector_module_names_a_transport`` green
    forever while walking six files and reading none of them.

    Three claims are driven here, and the second is the one that ties this file to D-05's
    actual wording:

      1. every pattern fires on at least one line that really contains what it names;
      2. **all six of D-05's literal tokens** fire, each inside a line of source as it would
         genuinely be written — so replacing the contract's substrings with properties made
         the fence stronger and not merely different;
      3. nothing in the must-not-fire corpus fires. Prose and near-miss identifiers
         (``websocket_handler``, ``sendmailer``, a sentence ending in "requests.") are the
         false positives that would make this fence noisy, and a noisy fence is loosened
         until it is decoration.
    """
    fires_on = {
        "an attribute read off `httpx`": "    client = httpx.AsyncClient()",
        "an attribute read off `requests`": "    requests.get(url)",
        "an attribute read off `smtplib`": "    smtplib.SMTP(host)",
        "an attribute read off `socket`": "    socket.socket()",
        "`urllib.request`": "    urllib.request.urlopen(url)",
        "a `.sendmail(` call": "    smtp.sendmail(f, t, raw)",
        "a transport import": "import requests",
    }
    assert set(fires_on) == set(_BANNED_TRANSPORT), (
        "every banned-transport pattern must carry a line proving it fires; missing: "
        f"{sorted(set(_BANNED_TRANSPORT) - set(fires_on))!r}"
    )
    for name, line in fires_on.items():
        assert _BANNED_TRANSPORT[name].search(line), (
            f"the D-05 matcher for {name} failed to fire on {line!r} — the fence would walk "
            "the package and prove nothing"
        )

    # Claim 2 — the CONTRACT's own six tokens, in real lines.
    for token, line in _D05_TOKENS_IN_REAL_LINES.items():
        hit = [name for name, pat in _BANNED_TRANSPORT.items() if pat.search(line)]
        assert hit, (
            f"D-05 names the token {token!r} and no property matcher fires on the line that "
            f"contains it: {line!r}. The regex map is only allowed to REPLACE the substring "
            "tuple while it remains a superset of it."
        )

    # Claim 3 — the boundary half.
    for line in _MUST_NOT_FIRE:
        hit = [name for name, pat in _BANNED_TRANSPORT.items() if pat.search(line)]
        assert hit == [], (
            f"the D-05 matcher fired on {line!r} via {hit!r}. That line is prose or a "
            "near-miss identifier; a fence that flags English gets loosened away, and the "
            "loosening is what removes the protection."
        )


def test_the_credential_encoding_matcher_actually_matches():
    """Positive control for the SCOPED credential-encoding fence (190-10 / 190-11).

    Case-insensitivity is driven, not documented: a lowercase ``authorization`` key is the
    same hand-built credential header, and 190-10's hand-off names that miss explicitly.
    """
    planted = (
        "import base64\n"
        'h = {"Authorization": "Basic " + base64.b64encode(pair).decode()}\n'
        "raw = base64.b64decode(h)\n"
    )
    for token in _CREDENTIAL_ENCODING:
        assert token.lower() in planted.lower(), (
            f"the credential-encoding matcher missed {token!r} on a plant that contains it"
        )

    lowercase_header = 'headers = {"authorization": "Basic " + encoded}'
    hits = [t for t in _CREDENTIAL_ENCODING if t.lower() in lowercase_header.lower()]
    assert "Authorization" in hits, (
        "the credential fence must match case-INSENSITIVELY: a lowercase `authorization` "
        "header key is the same hand-built header wearing different capitalisation"
    )


# ── 2 · THE WALK ITSELF MUST NOT BE VACUOUS ───────────────────────────────────


def test_the_walk_is_not_vacuous():
    """The fence below is only worth its green if it actually visited the package.

    Two independent floors, because the count alone is the weaker of the two: a walk that
    found six ``.py`` files none of which were adapters would satisfy a bare
    ``len(files) >= 6`` and cover nothing that can open a socket. 190-13's lesson —
    *check every fence you write for REACH* — is why the NAMES are pinned too.
    """
    files = _connector_python_files()
    assert len(files) >= 6, (
        f"the fence walked only {len(files)} python files under {_CONNECTORS_ROOT} — the "
        "walk is broken and the fence proves nothing (measured at plan time: 6, via "
        "`ls backend/app/services/connectors/*.py | wc -l`)"
    )

    walked = {p.name for p in files}
    missing = _EXPECTED_MODULES - walked
    assert missing == set(), (
        f"the walk did not visit {sorted(missing)!r}. A count-only floor would have passed "
        "here while covering none of the three files that can actually open a socket."
    )


# ── 3 · D-05 — NO MODULE UNDER THIS PACKAGE NAMES A TRANSPORT ─────────────────


def test_no_connector_module_names_a_transport():
    """**D-05, the package's one contract:** every socket comes from ``app.security.egress``.

    An adapter that opened its own connection would be validated by NOTHING — no scheme
    check, no allow-list, no address check, no DNS pin, no redirect refusal, no size cap —
    while every functional test in this suite stayed green, because a functional test asks
    whether the message went, not which socket carried it.

    Offenders are reported with file, line number and the line itself, so a failure is a
    work item rather than a boolean.

    **PLANT A** (recorded verbatim in ``190-14-SUMMARY.md``): a real
    ``httpx.AsyncClient()`` inserted into ``slack_adapter.py``, observed RED here, restored
    md5-identical, ``grep -c PLANT`` -> 0.
    """
    offenders: list[str] = []
    for path in _connector_python_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            for name, pattern in _BANNED_TRANSPORT.items():
                if pattern.search(line):
                    rel = path.relative_to(_BACKEND_ROOT).as_posix()
                    offenders.append(f"{rel}:{lineno}: {name} — {line.strip()}")

    assert offenders == [], (
        "D-05: a module under backend/app/services/connectors/ references a transport "
        "directly. Every socket must come from `app.security.egress`, whose binders "
        "validate and PIN the destination; a client built here is guarded by nothing.\n"
        + "\n".join(offenders)
    )


# ── 4 · D-04 — THE CLOSED REGISTRY, AND THAT IT RESOLVES ──────────────────────


def test_every_capability_resolves_to_an_importable_adapter():
    """Each capability imports a real adapter that claims its OWN key.

    190-08 declared all three module paths when only ``smtp_adapter`` existed — deliberately,
    so the D-04 assert was meaningful from the first commit rather than growing quietly. Two
    of the three entries therefore pointed at modules that did not exist, and the registry's
    docstring named THIS test as the check that would turn that convenience into a promise
    with a date on it. This is that date.

    A lazy-import registry that names a missing module, or an adapter registered under the
    wrong key, fails here rather than at 3 a.m. on somebody's run — which for
    ``send_email`` would mean a bot token handed to a mail host.
    """
    from app.services.connectors.registry import get_adapter
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    for capability in sorted(EXTERNAL_ACTION_CAPABILITIES):
        adapter = get_adapter(capability)
        assert getattr(adapter, "CAPABILITY", None) == capability, (
            f"D-04: the adapter registered under {capability!r} declares "
            f"CAPABILITY={getattr(adapter, 'CAPABILITY', None)!r}. The registry key and the "
            "adapter's own name are two spellings of one fact and must not drift — a "
            "mis-wired registry would send a ticket through the mail adapter and report "
            "success."
        )
        schema = getattr(adapter, "INPUT_SCHEMA", None)
        assert schema and schema.get("properties"), (
            f"the {capability!r} adapter declares no INPUT_SCHEMA properties, so "
            "`_adapter_args` would project every resolved input onto nothing and the step "
            f"would send an empty payload: {schema!r}"
        )


def test_the_registry_key_set_is_derived_not_retyped():
    """D-04 — the key set **IS** ``EXTERNAL_ACTION_CAPABILITIES``, not a list that agrees today.

    Equality alone is a patch: a hand-typed list that happens to match passes it, and then
    drifts the day the closed set grows. So the SOURCE is asserted too — ``registry.py`` must
    reference the frozenset by name — which is the property that survives someone "simplifying"
    the derivation into a literal.

    **PLANT B** (recorded verbatim in ``190-14-SUMMARY.md``): a fourth key added to
    ``_ADAPTERS``. The module-scope ``assert`` fires at IMPORT — an ``AssertionError`` for the
    whole app rather than a latent surface — which is exactly D-32's scope fence doing its job:
    a fourth capability is a phase, never a quiet dictionary entry.
    """
    from app.services.connectors import registry
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    assert set(registry._ADAPTERS) == set(EXTERNAL_ACTION_CAPABILITIES), (
        "D-04: the adapter registry's key set disagrees with EXTERNAL_ACTION_CAPABILITIES: "
        f"{sorted(set(registry._ADAPTERS) ^ set(EXTERNAL_ACTION_CAPABILITIES))!r}"
    )

    source = Path(registry.__file__).read_text(encoding="utf-8")
    reference = re.compile(r"^\s*(?:from\s+\S+\s+)?import\s+.*EXTERNAL_ACTION_CAPABILITIES", re.M)
    # The matcher's own control — an import line must fire, a passing mention must not, or
    # a docstring that merely NAMES the frozenset would satisfy this fence forever.
    assert reference.search(
        "from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES"
    ), "the derivation matcher does not fire on a real import line"
    assert not reference.search(
        "    # the keys agree with EXTERNAL_ACTION_CAPABILITIES by construction"
    ), "the derivation matcher fires on prose — a comment would satisfy it forever"

    assert reference.search(source), (
        "D-04: registry.py does not IMPORT EXTERNAL_ACTION_CAPABILITIES, so the assert above "
        "is comparing two hand-typed lists that agree today. The capability set has ONE "
        "runtime home and every consumer must be keyed off it."
    )


# ── 5 · THE SCOPED CREDENTIAL FENCE (190-11's hand-off, honoured by name) ─────


def test_no_adapter_hand_builds_an_encoded_credential_EXCEPT_where_the_vendor_requires_it():
    """No adapter encodes a credential by hand — **scoped, because one file legitimately must.**

    This is plan 190-11's hand-off honoured literally rather than generalised:

        *"The credential-header fence must be SCOPED, not tree-wide. 190-10's hand-off asks
        for the encoding vocabulary matched case-insensitively — correct for that file, and
        it would be WRONG applied to this one, where a bearer header is the vendor's own auth
        mechanism."*

    Measured at HEAD before this fence was written: ``Authorization`` appears exactly twice
    under the package, both in ``slack_adapter.py`` (a docstring sentence and the header dict
    it describes), and nowhere else. A tree-wide ban would therefore have been **RED on
    correct code from its first commit** — and a fence that is RED on correct code is deleted,
    taking the Jira half with it.

    So the exemption is named, and it is not a hole: ``slack_adapter.py`` is fenced on the
    stronger property instead — *the token appears in no body and in no refusal* — which is
    driven behaviourally in ``test_190_slack_ok_false.py``. The EXISTENCE of those two drives
    is asserted here, because 190-13's lesson is that an exemption pointing at a fence nobody
    checked is an exemption pointing at nothing.
    """
    exempt_text = _EXEMPTION_FENCED_BY.read_text(encoding="utf-8")
    for exempt_file, replacement_tests in _CREDENTIAL_FENCE_EXEMPT.items():
        for test_name in replacement_tests:
            assert f"def {test_name}(" in exempt_text, (
                f"{exempt_file} is exempt from the credential-encoding fence because "
                f"{_EXEMPTION_FENCED_BY.name}::{test_name} fences the stronger property "
                "instead — and that test does not exist. An exemption whose replacement is "
                "gone is a hole with a comment over it."
            )

    offenders: list[str] = []
    for path in _connector_python_files():
        if path.name in _CREDENTIAL_FENCE_EXEMPT:
            continue
        lowered_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        for lineno, line in enumerate(lowered_lines, start=1):
            for token in _CREDENTIAL_ENCODING:
                if token.lower() in line.lower():
                    rel = path.relative_to(_BACKEND_ROOT).as_posix()
                    offenders.append(f"{rel}:{lineno}: {token} — {line.strip()}")

    assert offenders == [], (
        "an adapter encodes a credential by hand. The transport library builds the header "
        "from the credential pair; a hand-built string is one interpolation away from a log "
        "line, and one refactor away from a request body.\n" + "\n".join(offenders)
    )


def test_the_registry_module_constructs_nothing_at_import():
    """D-05's corollary: importing the registry must not import a transport either.

    ``registry.py`` resolves adapter modules LAZILY, and the reason is written in its own
    docstring: importing the registry must not drag every vendor module into the import
    graph. That is a property with a mechanical test — import the registry into a fresh
    module object and assert the adapter modules are not yet loaded — and without it the
    lazy-import comment is a claim nobody checks.
    """
    import sys

    for name in list(sys.modules):
        if name.startswith("app.services.connectors."):
            del sys.modules[name]

    registry = importlib.import_module("app.services.connectors.registry")
    assert registry is not None

    loaded = [
        name
        for name in sys.modules
        if name.startswith("app.services.connectors.") and name.endswith("_adapter")
    ]
    assert loaded == [], (
        f"importing the registry loaded {loaded!r}. The resolution is meant to be lazy so a "
        "vendor module cannot enter the import graph of anything that merely asks which "
        "capabilities exist."
    )
