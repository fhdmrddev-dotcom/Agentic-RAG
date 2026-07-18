"""Phase 147 (FLAG-01 / D-04 layer 1 HIDE) — the fail-closed capability HIDE seam.

``get_tools()`` must omit ``SAVE_SKILL_TOOL`` from the returned schema when the
self-improvement operator kill-switch is OFF, so a model never even SEES (and thus
never tries) a disabled capability. When the flag is ON/absent the tool list is
byte-identical to today (set-equal to the baseline) — the Phase 091 whitelist no-op
precedent: the gate changes NOTHING until an operator flips it.

This is the first of the two D-04 fail-closed seams; the second (refuse at
``dispatch_tool``) lives in ``test_147_flag_refuse.py``.
"""
from types import SimpleNamespace

from app.services.openai_service import get_tools


def _names(schemas):
    return {t["function"]["name"] for t in schemas}


def _effective(*, self_improve, web=True, sandbox=True):
    """A minimal effective-settings bag carrying only the three flag attributes
    ``get_tools`` reads (web / sandbox held ON so self_improve is the sole variable)."""
    return SimpleNamespace(
        self_improve_enabled=self_improve,
        web_search_enabled=web,
        sandbox_enabled=sandbox,
    )


def test_save_skill_hidden_when_self_improve_off():
    names = _names(get_tools(_effective(self_improve=False)))
    assert "save_skill" not in names, "self_improve OFF must hide save_skill from the schema"


def test_save_skill_present_when_self_improve_on():
    names = _names(get_tools(_effective(self_improve=True)))
    assert "save_skill" in names, "self_improve ON must advertise save_skill (byte-identical)"


def test_only_difference_is_save_skill():
    """Byte-identical set equality against the baseline: flipping self_improve OFF removes
    EXACTLY the self_improve-gated tools and nothing else (web/sandbox held constant). Proves
    the gate does not disturb any other tool (Deep Mode unchanged when nothing is disabled).
    Phase 151-04 added ``attach_skill_file`` under the same ``self_improve_enabled`` gate,
    so the gated set is now {save_skill, attach_skill_file}."""
    on = _names(get_tools(_effective(self_improve=True)))
    off = _names(get_tools(_effective(self_improve=False)))
    assert on - off == {"save_skill", "attach_skill_file"}
    assert off - on == set()
