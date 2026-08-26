"""Phase 190 (CONN-03 SC#3 / D-09 / D-32) — **SC#3 IS SATISFIED BY NOT ADDING AN EVALUATOR.**

**This phase added no evaluator, and that sentence is the whole finding.** SC#3 asks that a
composed field cannot be turned into a template injection. Phase 190 did not build a
sandbox, did not harden a renderer and did not mitigate anything to earn that — it composed
**no** fields. ``_adapter_args`` is a CLOSED two-column lookup: the upstream phase's text
goes into one named argument per capability, and every other resolved input is projected onto
the adapter's declared schema or dropped. There is no syntax, no interpolation, no ``{{ }}``
and no evaluator anywhere on this path.

So what follows is a **fence over an EXISTING property**, not a new mitigation, and it must
be read that way. Over-claiming here would be the exact failure mode the ``external_action``
node type exists to avoid — a step that reads *"Complete"* for something that did not happen.
D-09, verbatim from CONTEXT:

    "A new expression syntax on the business canvas is out of scope and out of character — it
     is the same supply-chain-shaped affordance `docs/CONNECTOR-ARCHITECTURE.md` rules out
     'ever'. SC#3's proof is therefore largely a fence over an existing property, and the plan
     must say so rather than claiming to have built something."

── WHAT THIS FILE PROVES, AND WHAT IT DOES NOT ───────────────────────────────────────────

It PROVES four properties, each a property rather than a patch:

  1. **No evaluator exists on the connector path.** Not "``eval`` is not called on line N" —
     no bare ``eval``/``exec``/``compile``/``__import__`` and no unsandboxed Jinja environment
     anywhere under ``connectors/**``, ``security/egress.py`` or ``harness/phase_types.py``.
  2. **A composed field renders LITERALLY.** ``{{7*7}}`` reaches the adapter as five
     characters, not as ``49``. That is VALIDATION row T9 driven as behaviour rather than as
     source, through the real executor, and it is the half a source fence cannot give you.
  3. **The shipped sandboxed path is still the only Jinja path in the app.** A REGRESSION
     fence over somebody else's code — ``template_render_service.py:657`` and
     ``tool_dispatcher.py:2473``, both ``SandboxedEnvironment(autoescape=True)``. 190 did not
     write those lines and does not claim them; it asserts they have not moved.
  4. **D-32's scope fence** — three capabilities, seven phase types, one new config field,
     and no retry/queue machinery. A fourth capability is a PHASE, never a quiet dictionary
     entry, and a closure round that grew one would turn this RED (G-7).

It does NOT prove that the sandbox is unescapable, and makes no claim about Jinja's own
security. Nothing here depends on that: the property is that no user-supplied string ever
reaches a template engine on this path at all.

── EVERY FENCE CARRIES A POSITIVE CONTROL, AND EACH WAS DRIVEN RED ───────────────────────
Four plants, each a real line in real production source, each restored md5-identical and
recorded verbatim in ``190-14-SUMMARY.md``. Three of them exist to prove the walk REACHES all
three of its roots — 190-13's lesson was a fence whose preconditions were never set, so it
could not have fired at all.
"""

from __future__ import annotations

import re
from pathlib import Path
from types import MappingProxyType, SimpleNamespace

import pytest

# backend/tests/unit/<this file>  ->  parents[2] == backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_APP_ROOT = _BACKEND_ROOT / "app"
_CONNECTORS_ROOT = _APP_ROOT / "services" / "connectors"
_EGRESS = _APP_ROOT / "security" / "egress.py"
_PHASE_TYPES = _APP_ROOT / "services" / "harness" / "phase_types.py"

#: The two shipped Jinja construction sites SC#3 is proved AGAINST. Neither was written by
#: this phase; both are asserted unmoved. Measured at plan time with
#: ``grep -rn "Environment(" backend/app --include=*.py`` -> four hits, of which exactly these
#: two are constructions and the other two are prose quoting them.
_SANDBOXED_SITES = (
    _APP_ROOT / "services" / "template_render_service.py",
    _APP_ROOT / "services" / "tool_dispatcher.py",
)

#: The evaluator vocabulary, as PROPERTIES rather than substrings.
#:
#: ``Environment(``  — anything but ``SandboxedEnvironment(``. Written as a negative lookbehind
#: rather than a word boundary on purpose: ``\bEnvironment\(`` would also pass over
#: ``NativeEnvironment(``, which is an unsandboxed Jinja environment wearing a different name.
#: The property is *an environment that is not the sandboxed one*, not *the literal word*.
#:
#: ``eval`` / ``exec`` / ``compile`` — BARE calls only. ``aexec(`` (the shipped sandbox helper
#: at ``phase_types.py:752``) must not fire, and neither must ``re.compile(``; both are named
#: in the control below so the exclusions are driven rather than hoped for.
#: The shipped CONSTRUCTION, matched as an assignment rather than as a string.
#:
#: ⚠ **THIS PATTERN EXISTS BECAUSE PLANT F CAUGHT THE FENCE BEING INERT.** The first draft
#: asserted ``"SandboxedEnvironment(autoescape=True)" in text``, and when the construction at
#: ``template_render_service.py:657`` was really swapped for a bare ``Environment(``, that
#: assertion **still passed** — satisfied by the DOCSTRING eighteen lines above it, which
#: quotes the same string while constructing nothing. That is 190-02's lesson verbatim (a
#: docstring is a string literal, not a comment) and it was invisible until the plant ran.
#: The property is *the file CONSTRUCTS the sandboxed environment*, so the matcher requires an
#: assignment.
_SANDBOXED_CONSTRUCTION = re.compile(r"=\s*SandboxedEnvironment\(autoescape=True\)")

_EVALUATORS: dict[str, re.Pattern[str]] = {
    "an unsandboxed Jinja Environment": re.compile(r"(?<!Sandboxed)Environment\("),
    "a bare `eval(`": re.compile(r"(?<![A-Za-z0-9_])eval\("),
    "a bare `exec(`": re.compile(r"(?<![A-Za-z0-9_])exec\("),
    "a bare `compile(`": re.compile(r"(?<![A-Za-z0-9_])(?<!re\.)compile\("),
    "`__import__`": re.compile(r"__import__"),
}

#: T9's payload. Two expressions, because they fail differently and both must be proved
#: literal: ``{{7*7}}`` is arithmetic an evaluator would fold to ``49``, and
#: ``{{''.__class__}}`` is the object-graph walk every Python SSTI escape starts from.
#: Deliberately free of any other digit, so the ``"49" not in payload`` assertion has exactly
#: one possible source.
SSTI_PAYLOAD = "Renewal note: {{7*7}} and {{''.__class__}} — send these verbatim, please."
EVALUATED_MARKER = "49"

#: D-32. The pre-190 field set, re-derived from the tree rather than remembered:
#: ``git show 09808f6d^:backend/app/models/harness.py`` (the commit before the one that added
#: ``connection_id``) shows exactly ``phase_type``, ``capability``, ``available_tools``.
_PRE_190_CONFIG_FIELDS = frozenset({"phase_type", "capability", "available_tools"})
_ADDED_BY_190 = frozenset({"connection_id"})
_ADDED_BY_206 = frozenset({"tool_name", "tool_args"})

#: Field-NAME shapes that would mean an expression surface arrived. Checked as a property of
#: the name so an unforeseen 5th field is caught by what it is FOR, not by whether someone
#: remembered to add it to a list.
_EXPRESSION_SHAPED_NAMES = ("expr", "template", "mapping", "script", "eval", "jinja", "render")

#: D-18's re-attempt vocabulary. Prose citing the decision is the ONLY admissible mention, so
#: the check reads PER LINE — the shipped rule in ``test_190_slack_ok_false.py``, generalised
#: from one file to the whole package (and to ``queue``).
#:
#: ⚠ ``idempot`` is deliberately absent, and the omission is a decision rather than an
#: oversight: three shipped prose lines carry the word on the CONTINUATION of a sentence whose
#: D-18 citation is on the line above (measured — ``jira_adapter.py:95``, ``protocol.py:207``,
#: ``smtp_adapter.py:53``). Including it would make this fence RED on correct code, and a fence
#: that is RED on correct code gets loosened away. Nothing is lost: real re-attempt machinery
#: cannot exist without one of the four tokens below.
_REATTEMPT_TOKENS = ("retry", "backoff", "sleep", "queue")


def _walked_paths() -> list[Path]:
    """``connectors/**`` plus the two single files the send path runs through."""
    package = [p for p in _CONNECTORS_ROOT.rglob("*.py") if "__pycache__" not in p.parts]
    return sorted(package) + [_EGRESS, _PHASE_TYPES]


# ── 1 · THE POSITIVE CONTROL, FIRST IN THE FILE ───────────────────────────────


def test_the_template_matcher_actually_matches():
    """Positive control — the evaluator matchers fire on real evaluators and on nothing else.

    Listed first because the fence below walks eight files and would report green over all of
    them if any one of these five patterns were mistyped. Two exclusions matter more than the
    matches and are therefore driven explicitly:

      * ``SandboxedEnvironment(`` must NOT fire — it is the shipped, correct construction, and
        a fence that flags it would be RED on the very code SC#3 is proved against;
      * ``aexec(`` and ``re.compile(`` must NOT fire — the first is the shipped sandbox helper
        this file walks past at ``phase_types.py:752``, the second is the standard-library
        regex compiler. Either false positive would make this fence noisy, and noise is how a
        fence gets deleted rather than fixed.
    """
    fires_on = {
        "an unsandboxed Jinja Environment": [
            "    jenv = Environment(autoescape=True)",
            "    jenv = jinja2.Environment()",
            "    jenv = NativeEnvironment()",
        ],
        "a bare `eval(`": ["    value = eval(user_supplied)"],
        "a bare `exec(`": ["    exec(source, namespace)"],
        "a bare `compile(`": ["    code = compile(src, '<str>', 'eval')"],
        "`__import__`": ["    mod = __import__(name)"],
    }
    assert set(fires_on) == set(_EVALUATORS), (
        "every evaluator pattern must carry at least one line proving it fires; missing: "
        f"{sorted(set(_EVALUATORS) - set(fires_on))!r}"
    )
    for name, lines in fires_on.items():
        for line in lines:
            assert _EVALUATORS[name].search(line), (
                f"the matcher for {name} failed to fire on {line!r} — the fence would walk "
                "eight files and prove nothing"
            )

    must_not_fire = (
        "    jenv = SandboxedEnvironment(autoescape=True)  # SSTI containment",
        "    from jinja2.sandbox import SandboxedEnvironment",
        "            await aexec(",
        "    _TOKEN = re.compile(r'x')",
        "    # this path evaluates nothing and compiles nothing",
        "    result = self.evaluate(case)",
        "    executor = ThreadPoolExecutor()",
    )
    for line in must_not_fire:
        hit = [name for name, pat in _EVALUATORS.items() if pat.search(line)]
        assert hit == [], (
            f"the evaluator matcher fired on {line!r} via {hit!r}. That line is the shipped "
            "correct construction, a stdlib call or prose — a fence that is RED on correct "
            "code is loosened away, and the loosening is what removes the protection."
        )


def test_the_walk_is_not_vacuous():
    """The fence below is only worth its green if it reached all three of its roots.

    190-13 found a fence that could not have fired because its preconditions were never set.
    So the walk's own reach is asserted: the connector package, ``security/egress.py`` and
    ``harness/phase_types.py`` must each be in it by name. A count-only floor would pass while
    covering the package and neither single file.
    """
    walked = _walked_paths()
    assert len(walked) >= 8, (
        f"the evaluator fence walked only {len(walked)} files — the walk is broken and the "
        "fence proves nothing (measured at plan time: 8 = 6 package modules + egress.py + "
        "phase_types.py)"
    )
    for required in (_CONNECTORS_ROOT / "slack_adapter.py", _EGRESS, _PHASE_TYPES):
        assert required in walked, (
            f"the walk did not reach {required.name} — one of the three roots the send path "
            "actually runs through is uncovered"
        )
        assert required.exists(), f"{required} does not exist; the fence is pointed at nothing"


# ── 2 · NO EVALUATOR EXISTS ON THE CONNECTOR PATH ─────────────────────────────


def test_no_unsandboxed_jinja_environment_exists_on_the_connector_path():
    """SC#3's source half — **there is no evaluator here to attack.**

    The strongest available mitigation for template injection is the absence of a template
    engine, and that is what this path has. This asserts the absence rather than trusting it.

    **PLANTS C, D and E** (verbatim in ``190-14-SUMMARY.md``): a real
    ``Environment(autoescape=True)`` in ``phase_types.py``, a real ``eval(`` in
    ``slack_adapter.py`` and a real ``__import__`` in ``egress.py`` — one per root, so the
    walk's reach is proved by observation rather than by the assertion above alone. All three
    restored md5-identical, ``grep -c PLANT`` -> 0.
    """
    offenders: list[str] = []
    for path in _walked_paths():
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            for name, pattern in _EVALUATORS.items():
                if pattern.search(line):
                    rel = path.relative_to(_BACKEND_ROOT).as_posix()
                    offenders.append(f"{rel}:{lineno}: {name} — {line.strip()}")

    assert offenders == [], (
        "SC#3 / D-09: an evaluator appeared on the connector send path. This phase's entire "
        "SSTI answer is that no expression is ever evaluated here — a composed field is a "
        "closed two-column lookup, not a template. Found:\n" + "\n".join(offenders)
    )


# ── 3 · T9 AS BEHAVIOUR — A COMPOSED FIELD RENDERS LITERALLY ──────────────────


class _RecordingAdapter:
    """A ``post_message`` adapter that records what it was handed and sends nothing.

    Stubbed rather than real on purpose: the property under test belongs to the COMPOSITION
    layer (``_adapter_args``), not to Slack. Recording at the seam is also what makes the
    assertion exact — it reads the argument object itself, not a rendering of it.
    """

    CAPABILITY = "post_message"
    INPUT_SCHEMA = MappingProxyType({
        "type": "object",
        "properties": {"text": {"type": "string"}, "channel": {"type": "string"}},
    })

    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def send(self, *, args, credential, config, capability=None):
        from app.services.connectors.protocol import AdapterResult

        self.calls.append({"args": dict(args), "config": dict(config), "capability": capability})
        return AdapterResult(ok=True, provider_message="", raw_status=200, detail="")

    async def check(self, *, credential, config):  # pragma: no cover - not driven here
        raise NotImplementedError


async def test_a_composed_field_containing_a_template_expression_renders_LITERALLY(monkeypatch):
    """**VALIDATION row T9, driven as behaviour.** ``{{7*7}}`` reaches the adapter as itself.

    A source fence proves no evaluator is *written* on this path. It cannot prove that no
    evaluator is *reached* — through a helper, a library default, a Pydantic validator. So the
    real executor is driven end to end with a hostile payload in the composed field, and the
    argument object handed to the adapter is read directly.

    ``49`` is what an evaluator would have produced, and the control below proves that rather
    than assuming it: the same string rendered through the app's own
    ``SandboxedEnvironment(autoescape=True)`` DOES fold to ``49``. Without that control,
    ``"49" not in payload`` would be an assertion about a number nobody had shown was
    reachable — which is the vacuous half of every fence in this phase.

    ⚠ Note what the control also shows: ``{{''.__class__}}`` raises inside the sandbox rather
    than rendering. That is exactly why the LITERAL property matters more than sandbox
    quality — a sandboxed evaluator on this path would turn an ordinary business sentence into
    a phase failure, before anyone got to the question of escapes.
    """
    from jinja2.sandbox import SandboxedEnvironment

    from app.models.harness import WorkflowDefinition
    from app.services.harness import phase_types

    # ── the control: `49` is genuinely what evaluation produces ──
    assert EVALUATED_MARKER in SandboxedEnvironment(autoescape=True).from_string(
        "{{7*7}}"
    ).render(), (
        "the control failed: `{{7*7}}` does not fold to `49` even under the app's own Jinja "
        "environment, so the assertion below is looking for something unreachable"
    )
    assert EVALUATED_MARKER not in SSTI_PAYLOAD, (
        "the payload already contains the evaluated marker — the assertion below could never "
        "distinguish a literal render from an evaluated one"
    )

    wf = WorkflowDefinition.model_validate({
        "slug": "phase-190-ssti-probe",
        "version": 1,
        "name": "Phase 190 SSTI probe",
        "status": "draft",
        "phases": [{
            "slug": "notify",
            "phase_index": 0,
            "config": {
                "phase_type": "external_action",
                "capability": "post_message",
                "available_tools": ["post_message"],
                "connection_id": "dddddddd-0000-4000-8000-00000000000c",
            },
        }],
    })
    phase = wf.phases[0]

    adapter = _RecordingAdapter()

    async def _resolver(*_args, **_kwargs):
        return SimpleNamespace(
            id="dddddddd-0000-4000-8000-00000000000c",
            capability="post_message",
            config={"channel": "C0190FENCE"},
            secret="xoxb-SSTI-FENCE-SENTINEL",
        )

    # D-26's kill-switch ON, and the guard stubbed to a permitted triple — both are
    # PRECONDITIONS of reaching the adapter at all. With the switch at its cold default the
    # step records instead of sending and every assertion below would pass vacuously; the
    # `calls` assertion is what makes that impossible rather than merely unlikely.
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone")
    monkeypatch.setattr(
        phase_types, "validate_destination", lambda *a, **k: ("93.184.216.34", "slack.com", 443)
    )
    monkeypatch.setattr(phase_types, "resolve_connection", _resolver, raising=True)
    monkeypatch.setattr(phase_types, "get_adapter", lambda _cap: adapter, raising=True)

    ctx = SimpleNamespace(
        inputs={"content": SSTI_PAYLOAD},
        user_settings=None,
        retry_feedback=None,
        run_id=None,
        thread_id=None,
        user_id=None,
        org_id="aaaaaaaa-0000-4000-8000-000000000001",
        is_golden_run=False,
    )

    output = await phase_types._exec_external_action(phase, {}, ctx)

    assert len(adapter.calls) == 1, (
        f"the adapter was called {len(adapter.calls)} times, not once. The drive never "
        "reached the send seam, so nothing below is measuring the payload — this is the "
        "vacuity guard, not a formality."
    )
    payload = adapter.calls[0]["args"]["text"]

    assert "{{7*7}}" in payload, (
        f"T9: the composed field did not reach the adapter verbatim. Something on this path "
        f"consumed the expression: {payload!r}"
    )
    assert "{{''.__class__}}" in payload, (
        f"T9: the object-graph expression did not reach the adapter verbatim: {payload!r}"
    )
    assert EVALUATED_MARKER not in payload, (
        f"T9 / SC#3: `{{{{7*7}}}}` was EVALUATED — `49` reached the adapter payload. An "
        f"expression evaluator exists on the connector send path: {payload!r}"
    )
    assert payload == SSTI_PAYLOAD, (
        f"the composed field was transformed on the way to the adapter. It must arrive as the "
        f"author wrote it: {payload!r} != {SSTI_PAYLOAD!r}"
    )

    # The same property on the surface a PERSON reads. A body that evaluated the expression
    # would be the same defect wearing a different hat.
    body = output["text"]
    assert "{{7*7}}" in body and EVALUATED_MARKER not in body, (
        f"the rendered phase body evaluated the expression: {body!r}"
    )


# ── 4 · D-32 — THE SCOPE FENCE, ASSERTED RATHER THAN REMEMBERED ───────────────


def test_no_expression_language_was_added_to_the_phase_config():
    """D-32 — ``ExternalActionPhaseConfig`` gained exactly ONE field, and it is a reference.

    Two assertions, and the second is the one that survives an approved fifth field:

      * the field set is exactly the pre-190 three plus ``connection_id``. Re-derived, not
        remembered: ``git show 09808f6d^:backend/app/models/harness.py`` is the commit before
        the one that added it, and it carries exactly ``phase_type``, ``capability``,
        ``available_tools``;
      * **no field name is expression-shaped.** A future field called ``body_template`` or
        ``field_mapping`` would pass the first assertion the moment someone updated the
        expected set, and fail this one — which is the point. The property is *this step
        carries a reference, never a program*.
    """
    from app.models.harness import ExternalActionPhaseConfig

    actual = set(ExternalActionPhaseConfig.model_fields)
    expected = set(_PRE_190_CONFIG_FIELDS | _ADDED_BY_190 | _ADDED_BY_206)
    assert actual == expected, (
        f"D-32: ExternalActionPhaseConfig's field set is {sorted(actual)!r}, not "
        f"{sorted(expected)!r}."
    )

    expression_shaped = [
        field
        for field in actual
        if any(word in field.lower() for word in _EXPRESSION_SHAPED_NAMES)
    ]
    assert expression_shaped == [], (
        f"D-32 / D-09: {expression_shaped!r} names an expression, template or mapping surface "
        "on the business canvas. That affordance is the supply-chain-shaped one "
        "`docs/CONNECTOR-ARCHITECTURE.md` rules out 'ever', and SC#3's whole answer is that "
        "no evaluator exists here."
    )


def test_the_D32_scope_fence_holds_on_the_canvas_and_on_the_send_path():
    """D-32 — no 4th capability, no 8th phase type, no re-attempt machinery.

    G-7's structural failure is a closure round smuggling in a capability, and the cheapest
    place to smuggle one is a dictionary. So the three counts are pinned, and the
    re-attempt vocabulary is fenced per line.

    ⚠ **The remote-tool-protocol half is DELEGATED, not re-implemented.** The shipped
    ``test_189_no_egress.py::test_no_mcp_identifiers_in_backend_app`` sweeps every line under
    ``backend/app`` and requires zero, and its continued green is part of D-01's evidence that
    this phase built no client for that protocol. Duplicating it here would create a second
    fence to keep in step; asserting it still EXISTS is the honest alternative — an unchecked
    delegation is 190-13's defect exactly.
    """
    from app.models.harness import PhaseConfig
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES
    from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES

    assert len(EXTERNAL_ACTION_CAPABILITIES) == 3, (
        f"D-32: the capability set is {sorted(EXTERNAL_ACTION_CAPABILITIES)!r}. A fourth "
        "capability is a PHASE — a new vendor, a new wire format, a new failure contract and "
        "a new manual UAT row — never a fourth dictionary entry inside a closure round."
    )
    assert len(PHASE_TYPE_REGISTRY_ENTRIES) == 7, (
        f"D-32: {len(PHASE_TYPE_REGISTRY_ENTRIES)} phase types are registered, not 7: "
        f"{sorted(PHASE_TYPE_REGISTRY_ENTRIES)!r}. An 8th — in particular any 'run this code' "
        "node — is the arbitrary-code affordance this canvas does not have."
    )
    assert PhaseConfig is not None

    # The delegation, proved rather than asserted (190-13's lesson).
    delegated = _BACKEND_ROOT / "tests" / "unit" / "test_189_no_egress.py"
    delegated_text = delegated.read_text(encoding="utf-8")
    assert "def test_no_mcp_identifiers_in_backend_app(" in delegated_text, (
        "the tree-wide remote-tool-protocol fence this test delegates to has gone. D-01's "
        "amendment — first-party adapters instead of a client — is evidenced by that fence's "
        "green, and a delegation pointing at nothing is a hole with a comment over it."
    )

    # D-18 — no re-attempt machinery under the package. Prose citing the decision is the only
    # admissible mention, so the check reads PER LINE. This generalises the shipped per-file
    # rule in `test_190_slack_ok_false.py` to every module in the package, including the ones
    # that carry no adapter today.
    control = "    await asyncio.sleep(backoff); return await self._retry(req)  # queue it"
    assert [t for t in _REATTEMPT_TOKENS if t in control.lower()] == list(_REATTEMPT_TOKENS), (
        "the re-attempt matcher missed a token on a line that contains all four"
    )
    assert [t for t in _REATTEMPT_TOKENS if t in "  # D-18 forbids retry and backoff".lower()], (
        "the matcher must still SEE a prose line; the D-18 citation is what exempts it, not "
        "the matcher failing to fire"
    )

    offenders: list[str] = []
    for path in _walked_paths():
        if path in (_EGRESS, _PHASE_TYPES):
            continue  # both are shared modules with legitimate unrelated uses of these words
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1
        ):
            if any(token in line.lower() for token in _REATTEMPT_TOKENS) and "D-18" not in line:
                offenders.append(f"{path.name}:{lineno}: {line.strip()}")

    assert offenders == [], (
        "D-18 / D-32: re-attempt machinery appeared under connectors/**. At MOST once — no "
        "retry, no backoff, no sleep, no queue. A duplicate email is worse than a missing "
        "one, and a re-run is a deliberate human act.\n" + "\n".join(offenders)
    )


# ── 5 · THE REGRESSION FENCE ON SOMEBODY ELSE'S CODE ──────────────────────────


def test_the_shipped_sandboxed_path_is_still_the_only_jinja_path():
    """The two shipped ``SandboxedEnvironment(autoescape=True)`` sites, unmoved — **and this
    test is a REGRESSION fence on code 190 did not write.**

    These are the files SC#3 is proved AGAINST: ``template_render_service.py:657`` and
    ``tool_dispatcher.py:2473``. Phase 190 authored neither, hardened neither, and claims
    neither. What it does is assert that they are still the only Jinja environments in the
    app — because the day a bare ``Environment()`` appears anywhere under ``backend/app``, the
    sentence *"the only Jinja path in this app is sandboxed"* stops being true, and every
    downstream claim that leans on it (including this file's) quietly stops being true too.

    The tree-wide half is the PROPERTY; the two named sites are the ANTI-VACUITY half. A walk
    that found no unsandboxed environment because it found no environment at all would satisfy
    the first assertion and fail the second, which is the failure this pairing exists to catch.

    **PLANT F**: ``SandboxedEnvironment(autoescape=True)`` -> ``Environment(autoescape=True)``
    at the ``template_render_service.py`` construction site, observed RED, restored
    md5-identical — and it earned its keep twice over. On the first run only the TREE-WIDE
    half fired; the named-site half **passed on the docstring**, which quotes the construction
    it does not perform. The matcher was strengthened to require an assignment and the plant
    re-driven until both halves went RED. That is the whole argument for driving plants rather
    than reasoning about fences.
    """
    # The construction matcher's own control, and it is not a formality — see the pattern's
    # docblock. A prose line quoting the construction must NOT satisfy this fence.
    assert _SANDBOXED_CONSTRUCTION.search(
        "    jenv = SandboxedEnvironment(autoescape=True)  # SSTI containment"
    ), "the construction matcher does not fire on a real assignment"
    assert not _SANDBOXED_CONSTRUCTION.search(
        "    ``SandboxedEnvironment(autoescape=True)`` is load-bearing and MANDATORY regardless"
    ), (
        "the construction matcher fires on the DOCSTRING that quotes it — which is exactly "
        "how this fence was inert until PLANT F ran (190-02's lesson: a docstring is a string "
        "literal, not a comment)"
    )

    for site in _SANDBOXED_SITES:
        text = site.read_text(encoding="utf-8")
        assert _SANDBOXED_CONSTRUCTION.search(text), (
            f"{site.name} no longer CONSTRUCTS SandboxedEnvironment(autoescape=True). Both "
            "halves are load-bearing and were recorded as such at the shipping site: the "
            "sandbox is SSTI containment, autoescape is XML-safety for `&<>`."
        )
        assert "from jinja2.sandbox import SandboxedEnvironment" in text, (
            f"{site.name} no longer imports the sandboxed environment from jinja2.sandbox"
        )

    app_files = [p for p in _APP_ROOT.rglob("*.py") if "__pycache__" not in p.parts]
    assert len(app_files) > 100, (
        f"the tree-wide walk visited only {len(app_files)} python files under {_APP_ROOT} — "
        "the walk is broken and this fence proves nothing (measured at plan time: 170)"
    )

    unsandboxed: list[str] = []
    for path in app_files:
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1
        ):
            if _EVALUATORS["an unsandboxed Jinja Environment"].search(line):
                unsandboxed.append(
                    f"{path.relative_to(_BACKEND_ROOT).as_posix()}:{lineno}: {line.strip()}"
                )

    assert unsandboxed == [], (
        "an unsandboxed Jinja environment exists under backend/app. Every template render in "
        "this app goes through SandboxedEnvironment(autoescape=True); a bare Environment() "
        "gives an author-supplied string full attribute access.\n" + "\n".join(unsandboxed)
    )


def test_the_composition_layer_is_a_closed_lookup_not_a_language():
    """``_adapter_args`` projects onto a DECLARED schema and invents nothing.

    The behavioural drive above proves one payload arrives literally. This proves the shape
    that makes it true for every payload: an argument survives only if the adapter DECLARED
    it, and the upstream text lands in exactly one named field per capability. There is no
    rule that could be written in a config to change either — which is what "no expression
    language" means operationally.
    """
    from app.services.harness.phase_types import _BODY_ARG_FOR_CAPABILITY, _adapter_args
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    assert set(_BODY_ARG_FOR_CAPABILITY) == set(EXTERNAL_ACTION_CAPABILITIES), (
        "the body-argument map is not derived from the closed capability set: "
        f"{sorted(_BODY_ARG_FOR_CAPABILITY)!r}"
    )

    adapter = _RecordingAdapter()
    args = _adapter_args(
        adapter,
        "post_message",
        {
            "content": SSTI_PAYLOAD,
            "channel": "C0190FENCE",
            "kickoff_prompt_leftover": "must not survive",
            "smtp_password": "must not survive either",
        },
    )

    assert set(args) == {"text", "channel"}, (
        f"an undeclared argument reached the adapter: {sorted(args)!r}. The projection is "
        "fail-closed — only properties the adapter declares are passed — which is what keeps "
        "run scaffolding and, worse, a stray credential-shaped key out of a vendor request."
    )
    assert args["text"] == SSTI_PAYLOAD, (
        f"the upstream text was transformed on projection: {args['text']!r}"
    )


@pytest.mark.parametrize("capability", ["send_email", "create_ticket", "post_message"])
def test_every_capability_has_exactly_one_body_field_and_no_second_one(capability):
    """One capability, one named body field — the closed two-column lookup, per capability.

    Parametrised rather than looped so a single capability's regression names itself in the
    failure output. The property: a capability cannot acquire a SECOND composed field without
    editing this map, and editing it is a visible act rather than a config change.
    """
    from app.services.harness.phase_types import _BODY_ARG_FOR_CAPABILITY

    body_arg = _BODY_ARG_FOR_CAPABILITY[capability]
    assert isinstance(body_arg, str) and body_arg, (
        f"{capability!r} maps to {body_arg!r} — a capability with no body field would silently "
        "drop the upstream phase's text"
    )
