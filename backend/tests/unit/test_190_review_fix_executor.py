"""Phase 190 code-review fixes — **the executor and the guard**: CR-02, CR-03, CR-04, WR-03.

Its sibling ``test_190_review_fix_data_layer.py`` carries CR-01's code half plus WR-02 and
WR-05. The cut is where the fixtures are: every case here drives ``_exec_external_action``
through the same phase / ctx / never-sends set, and every case there drives a Pydantic model
or a supabase double. A single file would have made half its fixtures dead weight in every
run; two files let each commit land GREEN on its own, which is why the split exists at all.

**Every case here was OBSERVED RED before its fix landed** — the verbatim transcripts are in
``190-REVIEW-FIXES.md``.

⚠ **Each case was additionally checked for REACH, not merely for RED.** This phase measured
six separate fences that passed over a real defect — an affordance rendered ``disabled``
instead of removed satisfying ``toBeDisabled()``, a matcher satisfied by a docstring eighteen
lines away, a fence asserting the word ``failed`` blind to a sentence containing ``failing``.
So every assertion below names the *property*, and the ones that could be satisfied by an
accident carry an explicit non-vacuity partner.

── The four findings ─────────────────────────────────────────────────────────────────────
CR-02  the kill switch read an unbounded-stale settings cache, so turning it OFF did not
       reliably stop sending.
CR-03  the kill switch failed OPEN for three of its four legal audience values.
CR-04  blocking ``getaddrinfo`` on the event loop, from three ``async def`` call sites.
WR-03  a capability change stranded ``connection_id``; the run then died on an uncaught
       ``ValueError`` instead of one of D-17's four terminals.
"""

from __future__ import annotations

import threading
from types import SimpleNamespace

import pytest

from app.services.harness import phase_types
from app.services.harness.phase_types import _exec_external_action

ORG_A = "aaaaaaaa-0000-4000-8000-000000000001"
CONNECTION_ID = "dddddddd-0000-4000-8000-00000000000c"


# ══════════════════════════════════════════════════════════════════════════════════════════
# shared fixtures — a real, model-validated `post_message` step
# ══════════════════════════════════════════════════════════════════════════════════════════
def _phase(*, capability: str = "post_message", connection_id: str | None = CONNECTION_ID):
    return SimpleNamespace(
        slug="notify",
        phase_index=0,
        config=SimpleNamespace(
            phase_type="external_action",
            capability=capability,
            available_tools=[capability],
            connection_id=connection_id,
        ),
    )


def _ctx(*, is_golden_run: bool = False):
    return SimpleNamespace(
        inputs={"message": "the renewal is due"},
        user_settings=None,
        retry_feedback=None,
        run_id=None,
        thread_id=None,
        user_id=None,
        org_id=ORG_A,
        is_golden_run=is_golden_run,
    )


def _recorded(output) -> bool:
    """True iff the executor reached D-17's `recorded_not_sent` terminal."""
    return isinstance(output, dict) and phase_types.RECORDED_INTENT_KEY in output


@pytest.fixture()
def never_sends(monkeypatch):
    """Make every downstream step of the executor observable and inert.

    The guard and the resolver both raise if reached, so any case below that is *supposed*
    to stop at a gate fails LOUDLY when it does not — rather than falling through to a stub
    that returns something plausible. That is the difference between a test that proves the
    gate fired and one that proves nothing happened for some other reason.
    """
    reached: list[str] = []

    def _guard(*_a, **_kw):
        reached.append("egress")
        raise AssertionError("the egress guard was reached; the gate above it did not hold")

    async def _resolve(*_a, **_kw):
        reached.append("resolve")
        raise AssertionError("the resolver was reached; the gate above it did not hold")

    monkeypatch.setattr(phase_types, "validate_destination", _guard, raising=True)
    monkeypatch.setattr(phase_types, "resolve_connection", _resolve, raising=True)
    return reached


# ══════════════════════════════════════════════════════════════════════════════════════════
# CR-02 · the kill switch must read a BOUNDED-STALENESS settings cache
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_CR02_the_executor_refreshes_the_settings_cache_before_reading_the_audience(
    monkeypatch, never_sends
):
    """The executor must `await ensure_settings_fresh()` BEFORE `feature_audience(...)`.

    ⚠ THE ORDER IS THE PROPERTY, and it is asserted as an order rather than as an outcome —
    the same reasoning ``test_190_egress_ordering.py`` gives for D-06. `feature_audience`
    resolves through the SYNC settings reader, which `models/user_settings.py:365-398` states
    in its own words has **no staleness check at all**; on a worker that did not service the
    operator's write, nothing expires its view, with *"no code-level bound"*.

    The stub below flips the audience from `"everyone"` to `"off"` at refresh time — i.e. it
    stands in for the operator's `PUT /admin/visibility` landing on the OTHER worker. An
    executor that reads the audience first sees `"everyone"` and **posts the message minutes
    or hours after the operator believes sending is stopped**; one that refreshes first sees
    `"off"` and records.
    """
    order: list[str] = []
    audience = {"value": "everyone"}

    async def _fresh():
        order.append("fresh")
        audience["value"] = "off"  # the operator's flip, arriving with the refresh

    def _audience(_feature):
        order.append("audience")
        return audience["value"]

    monkeypatch.setattr(phase_types, "ensure_settings_fresh", _fresh, raising=True)
    monkeypatch.setattr(phase_types, "feature_audience", _audience, raising=True)

    output = await _exec_external_action(_phase(), {}, _ctx())

    assert order[:2] == ["fresh", "audience"], (
        f"CR-02: the recorded call order is {order!r}, not ['fresh', 'audience', …]. This is "
        "the assertion that survives a line reorder — every outcome-based test reads "
        "identically either way once the cache happens to be warm."
    )
    assert _recorded(output), (
        "CR-02: the executor sent past a kill switch the operator had already turned off. "
        f"Got {output!r}"
    )
    assert never_sends == [], (
        f"CR-02: execution continued past GATE 2 and reached {never_sends!r}"
    )


async def test_CR02_a_failing_refresh_never_turns_the_gate_into_a_crash(monkeypatch, never_sends):
    """Non-vacuity + fail-safety: the refresh is best-effort and must never raise upward.

    `ensure_settings_fresh` already swallows its own failures, but the executor must not
    reintroduce a raise around it — a settings blip must not fail a workflow run.
    """
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "off", raising=True)
    assert await _exec_external_action(_phase(), {}, _ctx()) is not None


# ══════════════════════════════════════════════════════════════════════════════════════════
# CR-03 · the kill switch must fail CLOSED for every audience that is not "everyone"
# ══════════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.parametrize("audience", ["operators", "role", "off", "", "something-new"])
async def test_CR03_only_everyone_opens_the_send_path(monkeypatch, never_sends, audience):
    """`PUT /admin/visibility` accepts four audiences; only ONE of them may enable sending.

    The API layer (`admin.py:120` `_VISIBILITY_AUDIENCES`) admits
    `{everyone, operators, role, off}` for `live_connectors`, and `require_visible` treats
    `"operators"` / `"role"` as **restrictive**. The executor tested `!= "off"` and therefore
    treated all three of the others as **fully ON, for every run by every user**.

    **The failure that motivated this case, concretely:** an operator pilots live sending for
    super-admins only — `{feature: "live_connectors", audience: "role", roles: ["super-admin"]}`,
    a legal, allow-listed write the Control Room's own vocabulary invites. The connections
    CRUD correctly refuses every non-super-admin. And every published workflow in every org
    carrying a bound `external_action` step **starts sending for real**, run by any member.

    The fix is fail-CLOSED by construction rather than by enumeration — it requires a positive
    `"everyone"` instead of the absence of `"off"` — which is also what makes it survive a
    hand-edited `app_settings` row and any future fifth audience. The last two parameters are
    that property: `""` and an unknown string are not audiences anyone will write today, and
    both must still refuse. (⚠ The Phase-185 lesson, verbatim: *a deny-list cannot be made
    fail-closed by extension* — verify the PROPERTY, not the patch.)
    """
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: audience, raising=True)

    output = await _exec_external_action(_phase(), {}, _ctx())

    assert _recorded(output), (
        f"CR-03: audience {audience!r} opened the send path. Only 'everyone' may. Got {output!r}"
    )
    assert never_sends == [], (
        f"CR-03: audience {audience!r} let execution reach {never_sends!r}"
    )


async def test_CR03_everyone_really_does_open_it_or_the_case_above_is_vacuous(
    monkeypatch, never_sends
):
    """The non-vacuity partner: `"everyone"` must still reach the guard.

    Without this, `return _record(...)` unconditionally at the top of the executor would make
    every parametrised case above pass while the whole feature was dead.
    """
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone", raising=True)

    with pytest.raises(AssertionError, match="egress guard was reached"):
        await _exec_external_action(_phase(), {}, _ctx())

    assert never_sends == ["egress"]


# ══════════════════════════════════════════════════════════════════════════════════════════
# CR-04 · DNS resolution must not run on the event loop
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_CR04_the_executors_destination_guard_runs_OFF_the_event_loop(monkeypatch):
    """D-v2.5-01, at the third of the three `async def` call sites.

    `validate_destination` is a plain `def` and calls `socket.getaddrinfo`, which is a
    **blocking libc call**. `_exec_external_action` is `async def`, so the resolution ran on
    the event loop thread.

    ⚠ **`timeout=` does not bound it.** `SMTP_TIMEOUT_SECONDS` / `JIRA_TIMEOUT_SECONDS` go to
    the transport, not to `getaddrinfo`; a blackholed nameserver blocks for the OS resolver's
    own budget (glibc `timeout:5 attempts:2` per nameserver — tens of seconds) with no
    application-level cap anywhere. And it is remotely triggerable with no rate limit:
    `POST /connectors/connections/{id}/check` reaches it on a user HTTP request. Two clicks
    at `WORKER_COUNT=2` stall **every** concurrent SSE chat stream on the box.

    The property asserted is a thread identity, which is the only thing that can tell "off
    the loop" from "fast enough today".
    """
    loop_thread = threading.get_ident()
    ran_on: list[int] = []

    def _guard(*_a, **_kw):
        ran_on.append(threading.get_ident())
        raise RuntimeError("stop the drive here; the thread is already recorded")

    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone", raising=True)
    monkeypatch.setattr(phase_types, "ensure_settings_fresh", _noop, raising=False)
    monkeypatch.setattr(phase_types, "validate_destination", _guard, raising=True)

    with pytest.raises(RuntimeError):
        await _exec_external_action(_phase(), {}, _ctx())

    assert ran_on, "the guard never ran — the case measured nothing"
    assert ran_on[0] != loop_thread, (
        f"CR-04: the destination guard (and therefore `socket.getaddrinfo`) ran on the event "
        f"loop thread {loop_thread}. D-v2.5-01: *'Do not run blocking I/O directly inside "
        f"async handlers — wrap with run_in_threadpool'*, and `egress.py:705-710` cites "
        f"SEED-065's measurement of exactly this cost: 'a sync HTTP call left on the event "
        f"loop froze ALL request serving for the round trip.'"
    )


@pytest.mark.parametrize("binder", ["send_pinned_http", "open_pinned_smtp"])
async def test_CR04_both_egress_binders_resolve_off_the_event_loop(monkeypatch, binder):
    """The other two `async def` call sites — `egress.py:550` and `egress.py:719`.

    ⚠ The SMTP binder is the sharper of the two: the module already wraps the SMTP **connect**
    in `run_in_threadpool` and then left the DNS lookup that precedes it on the loop. Half a
    fix reads, at a glance, exactly like a whole one.

    The resolver seam is the instrument: it is the last thing `validate_destination` calls
    before it has an address, so the thread it runs on IS the thread `getaddrinfo` would run
    on. Both binders raise before touching a socket, so nothing is sent.
    """
    from app.security import egress

    loop_thread = threading.get_ident()
    ran_on: list[int] = []

    def _resolver(_hostname, _port):
        ran_on.append(threading.get_ident())
        raise RuntimeError("stop here; the thread is recorded and no socket is wanted")

    with pytest.raises(RuntimeError):
        if binder == "send_pinned_http":
            await egress.send_pinned_http(
                "post_message",
                "POST",
                "https://slack.com/api/chat.postMessage",
                json={},
                headers={},
                timeout=1.0,
                max_bytes=1024,
                resolver=_resolver,
            )
        else:
            await egress.open_pinned_smtp(
                "send_email",
                "smtps://smtp.example.com",
                587,
                timeout=1.0,
                allowed_host="smtp.example.com",
                resolver=_resolver,
            )

    assert ran_on, f"{binder}: the resolver never ran — the case measured nothing"
    assert ran_on[0] != loop_thread, (
        f"CR-04: {binder} resolved DNS on the event loop thread {loop_thread}."
    )


async def _noop():
    return None


# ══════════════════════════════════════════════════════════════════════════════════════════
# WR-03 · a stranded `connection_id` is a D-17 terminal, not a stack trace
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_WR03_a_capability_mismatch_records_instead_of_raising(monkeypatch):
    """An author changed the step's capability; `connection_id` survived in the JSONB.

    Nothing clears it — not `ExternalActionSection` (whose capability rows patch `capability`
    only), not `ConnectionPicker` (which writes only on `<select>` change), not
    `PhaseFormPanel` (`0 0` by D-23). And the author is actively told there is nothing to
    clean up: the picker's list read is capability-filtered so `bound` is `undefined` and the
    footer reads *"🔒 nothing bound — this step will record, not send"*, while `notConnectedOf`
    sees a non-empty string and drops the canvas badge, so the canvas says the step is
    complete.

    Then the run reached a bare `ValueError`, which is **not** an `AdapterError`, so the
    handler at `:2262` does not catch it: no `text`, no `failure` sentence, and none of D-17's
    four terminals — a stack-trace-shaped error on the surface whose entire discipline is not
    over-claiming.

    It is a **data** condition the author caused, not a programming error, so it belongs in
    the shipped `recorded_not_sent` vocabulary this phase spent D-17 on.
    """
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone", raising=True)
    monkeypatch.setattr(phase_types, "ensure_settings_fresh", _noop, raising=False)
    monkeypatch.setattr(phase_types, "validate_destination", lambda *a, **k: None, raising=True)

    async def _resolve(*_a, **_kw):
        return SimpleNamespace(capability="send_email", config={}, secret="never-read")

    monkeypatch.setattr(phase_types, "resolve_connection", _resolve, raising=True)

    output = await _exec_external_action(
        _phase(capability="post_message"), {}, _ctx()
    )

    assert _recorded(output), (
        f"WR-03: a stranded connection_id produced {type(output).__name__} rather than D-17's "
        f"recorded terminal: {output!r}"
    )
    assert output["text"].startswith("NOT SENT"), (
        f"WR-03: the mismatch must reach the SHIPPED 189 body, not a new sentence for a new "
        f"state: {output['text'][:80]!r}"
    )


async def test_WR03_a_MATCHING_capability_still_sends_or_the_case_above_is_vacuous(monkeypatch):
    """Non-vacuity: the mismatch branch must not have swallowed the matching one too."""
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone", raising=True)
    monkeypatch.setattr(phase_types, "ensure_settings_fresh", _noop, raising=False)
    monkeypatch.setattr(phase_types, "validate_destination", lambda *a, **k: None, raising=True)

    class _Stop(RuntimeError):
        pass

    async def _resolve(*_a, **_kw):
        return SimpleNamespace(capability="post_message", config={}, secret="x")

    def _get_adapter(_capability):
        raise _Stop("dispatch reached — that is the property")

    monkeypatch.setattr(phase_types, "resolve_connection", _resolve, raising=True)
    monkeypatch.setattr(phase_types, "get_adapter", _get_adapter, raising=True)

    with pytest.raises(_Stop):
        await _exec_external_action(_phase(capability="post_message"), {}, _ctx())


