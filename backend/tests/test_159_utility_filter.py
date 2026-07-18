"""Phase 159 Plan 01 (MODEL-03) — utility-model suitability filter tests.

Covers the shared ``UTILITY_MODEL_EXCLUDE`` constant + ``is_utility_model()``
helper (the tuned chat-filter token set) and the display-only ``utility`` flag
that ``_build_new_entry`` stamps on each discovered ``new`` model.

The load-bearing invariant (D-159-01 / SC#3): the ``utility`` flag is display
metadata ONLY — it rides on ``new`` entries and NEVER leaks into ``compute_diff``'s
``changed``/``vanished`` groups, so the diff the operator confirms is byte-identical
to Phase 149.
"""
from __future__ import annotations

from app.services import model_discovery_service as mds


# ─────────────────────────────────────────────────────────────────────────────
# Classification — the tuned chat-filter token set (D-159-01).
# ─────────────────────────────────────────────────────────────────────────────
# The true non-chat utility models — these MUST be flagged utility=True so the
# discovery panel can hide them by default.
_UTILITY_IDS = [
    "text-embedding-3-large",   # embed
    "whisper-1",                # whisper
    "dall-e-3",                 # dall-e
    "tts-1",                    # tts
    "omni-moderation-latest",   # moderation
    "gpt-4o-transcribe",        # transcribe
]

# Valid chat/tool models — these MUST NOT be flagged. ``chatgpt-4o-latest`` is
# the headline case: the old curate_models regex wrongly excluded ``chatgpt``,
# hiding a real chat model. The tuned filter drops that chat-legacy token.
_CHAT_IDS = [
    "chatgpt-4o-latest",        # the survives-the-filter hero (D-159-01)
    "gpt-5.4",
    "claude-opus-4-8",
    "kimi-k3",
    "gemini-3.1-pro-preview",
    "deepseek-v4",
]


def test_is_utility_model_flags_non_chat_utility():
    for mid in _UTILITY_IDS:
        assert mds.is_utility_model(mid) is True, f"{mid} should be flagged utility"


def test_is_utility_model_passes_chat_models():
    for mid in _CHAT_IDS:
        assert mds.is_utility_model(mid) is False, f"{mid} must NOT be flagged utility"


def test_chatgpt_4o_latest_survives_the_filter():
    """The D-159-01 tuning proof: dropping the chat-legacy ``chatgpt`` token means
    a valid chat model is no longer wrongly hidden."""
    assert mds.is_utility_model("chatgpt-4o-latest") is False


def test_is_utility_model_is_null_safe():
    assert mds.is_utility_model("") is False
    assert mds.is_utility_model(None) is False  # type: ignore[arg-type]


def test_utility_model_exclude_defined_once():
    """The constant is a compiled regex (single DRY source imported by
    curate_models.py — see the grep acceptance criterion)."""
    import re

    assert isinstance(mds.UTILITY_MODEL_EXCLUDE, re.Pattern)


# ─────────────────────────────────────────────────────────────────────────────
# The display-only ``utility`` tag on _build_new_entry.
# ─────────────────────────────────────────────────────────────────────────────
def test_build_new_entry_carries_utility_flag():
    """A discovered-new entry carries a boolean ``utility`` key ALONGSIDE the
    pre-existing provider/model_id/enabled/capabilities keys (nothing removed)."""
    entry = mds._build_new_entry("openai", "gpt-x", {})

    assert set(entry) >= {"provider", "model_id", "enabled", "capabilities", "utility"}
    assert entry["provider"] == "openai"
    assert entry["model_id"] == "gpt-x"
    assert entry["enabled"] is False           # 149 opt-in-enable rule preserved
    assert isinstance(entry["utility"], bool)
    assert entry["utility"] is False           # gpt-x is a chat model


def test_build_new_entry_utility_flag_reflects_classification():
    assert mds._build_new_entry("openai", "text-embedding-3-large", {})["utility"] is True
    assert mds._build_new_entry("openai", "chatgpt-4o-latest", {})["utility"] is False


# ─────────────────────────────────────────────────────────────────────────────
# The confirmable diff is byte-identical — utility rides ONLY on ``new``.
# ─────────────────────────────────────────────────────────────────────────────
def test_utility_tag_only_on_new_entries():
    """SC#3 red line: the ``utility`` tag is display metadata on ``new`` entries
    only. ``changed`` and ``vanished`` — the groups the operator confirms against
    the registry — must NOT carry it (structurally identical to Phase 149)."""
    current = {
        # openai ok → gpt-old not returned → vanished.
        "gpt-old":    {"provider": "openai", "enabled": True},
        # google ok → context genuinely differs (1M stored vs 2M discovered) → changed.
        "gemini-pro": {"provider": "google", "context_window_tokens": 1_000_000,
                       "max_output_tokens": 8192},
    }
    discovered = [
        {"provider": "openai", "status": "ok",
         # a chat model AND a utility model, both genuinely new.
         "ids": ["gpt-5.6", "text-embedding-3-large"],
         "caps": {}, "capabilities_returned": False},
        {"provider": "google", "status": "ok",
         "ids": ["gemini-pro", "gemini-new"],
         "caps": {"gemini-pro": {"context": 2_000_000, "max_output": 8192},
                  "gemini-new": {"context": 1_000_000, "max_output": 8192}},
         "capabilities_returned": True},
    ]

    diff = mds.compute_diff(current, discovered)

    # Every `new` entry carries a boolean `utility` tag…
    assert diff["new"], "fixture should produce new entries"
    for entry in diff["new"]:
        assert "utility" in entry
        assert isinstance(entry["utility"], bool)

    # …and the tag is correctly classified end-to-end through compute_diff.
    new_by_id = {n["model_id"]: n for n in diff["new"]}
    assert new_by_id["text-embedding-3-large"]["utility"] is True
    assert new_by_id["gpt-5.6"]["utility"] is False

    # `changed` never carries `utility` — the confirmable diff is untouched.
    assert diff["changed"], "fixture should produce a changed entry"
    for entry in diff["changed"]:
        assert "utility" not in entry

    # `vanished` never carries `utility`.
    assert diff["vanished"], "fixture should produce a vanished entry"
    for entry in diff["vanished"]:
        assert "utility" not in entry


def test_changed_and_vanished_shape_unchanged():
    """Explicit shape assertion: `changed` == provider/model_id/changes;
    `vanished` == provider/model_id. No `utility` key leaked (D-159-01)."""
    current = {
        "gpt-old":    {"provider": "openai", "enabled": True},
        "gemini-pro": {"provider": "google", "context_window_tokens": 1_000_000,
                       "max_output_tokens": 8192},
    }
    discovered = [
        {"provider": "openai", "status": "ok", "ids": ["gpt-4o"],
         "caps": {}, "capabilities_returned": False},
        {"provider": "google", "status": "ok", "ids": ["gemini-pro"],
         "caps": {"gemini-pro": {"context": 2_000_000, "max_output": 8192}},
         "capabilities_returned": True},
    ]

    diff = mds.compute_diff(current, discovered)

    changed = next(c for c in diff["changed"] if c["model_id"] == "gemini-pro")
    assert set(changed) == {"provider", "model_id", "changes"}

    vanished = next(v for v in diff["vanished"] if v["model_id"] == "gpt-old")
    assert set(vanished) == {"provider", "model_id"}
