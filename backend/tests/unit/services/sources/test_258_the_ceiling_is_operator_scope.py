"""SEED-258 — ⛔ THE FILE CEILING IS OPERATOR SCOPE. A user may not raise it for themselves.

The seed's own failure list names this first: *"The knob lands in `user_settings`, so a user can
raise a DoS guard for themselves."* The ceiling bounds how much memory ONE in-flight request can
buffer from a remote server we do not control. A per-user knob is not a guard, it is a dial on
the attack.

⚠ THIS IS A STRUCTURAL FENCE, and it is deliberately structural: a behavioural test can only
check the escalation route somebody thought to try, whereas this refuses the SHAPE — the knob
appearing anywhere on the per-user preference surface at all.

Positive control included: the fence must be able to fail. If the scan cannot find the writer it
is supposed to read, it says so instead of passing.
"""

import inspect

import app.api.settings as settings_api
import app.models.user_settings as us

KNOB = "source_max_file_size_mb"


def test_the_knob_is_written_only_through_the_app_settings_writer():
    """`save_app_settings` writes the `app_settings` singleton. `save_user_settings`-shaped
    per-user writers must never see this key."""
    src = inspect.getsource(settings_api)

    assert f'updates["{KNOB}"]' in src, (
        "POSITIVE CONTROL FAILED — the scan cannot find the app_settings write for "
        f"{KNOB!r}, so everything below would pass vacuously. Fix the fence, not the code."
    )

    # The one and only assignment target is the `updates` dict that `save_app_settings`
    # consumes. Any OTHER dict receiving this key is a per-user or per-org write.
    offenders = [
        line.strip()
        for line in src.splitlines()
        if f'"{KNOB}"]' in line and 'updates["' not in line
    ]
    assert not offenders, (
        f"{KNOB} is being written somewhere other than the app_settings `updates` dict: "
        f"{offenders} — a DoS guard a user can raise for themselves is not a guard (SEED-258)."
    )


def test_the_knob_is_not_a_per_user_preference():
    """`user_settings.preferences` (mig 011) is the per-user JSONB surface. The ceiling is not
    in it, and `load_user_settings` must not narrow or widen it per caller."""
    src = inspect.getsource(us)

    assert "preferences->>'default_model'" in src, (
        "POSITIVE CONTROL FAILED — the per-user preferences surface this fence scans has "
        "moved; re-point the fence before trusting it."
    )

    for line in src.splitlines():
        if "preferences" in line and KNOB in line:
            raise AssertionError(
                f"{KNOB} appears on the per-user preferences surface: {line.strip()!r}"
            )


def test_the_accessor_takes_no_user_argument():
    """⭐ The strongest form of the fence: there is no per-caller input to give it.

    `source_max_file_bytes()` resolves the global singleton and nothing else. A signature that
    accepted a `user_id` would be the first step toward a per-user ceiling even if today's body
    ignored it.
    """
    sig = inspect.signature(us.source_max_file_bytes)
    assert list(sig.parameters) == [], (
        f"source_max_file_bytes() grew parameters {list(sig.parameters)} — the ceiling is a "
        "global operator setting and must not become resolvable per caller (SEED-258)."
    )
