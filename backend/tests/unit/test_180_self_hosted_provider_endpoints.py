"""SEED-173 — every self-hosted provider's endpoint AND key must survive a Settings round trip.

⛔ WHAT THIS CATCHES, AND WHY IT WAS INVISIBLE FOR THE WHOLE LIFE OF THE `lmstudio` PROVIDER.

Phase 111 (D-111-7) split `lmstudio` out of `ollama` as a first-class provider with its own
`lmstudio_base_url` in `config.py`. What it did NOT do was give that provider a column, a UI
field, or a write arm — and every one of those omissions is silent in a different way:

  1. `api/settings.py`'s PUT gated the base_url write on `p.id == "ollama"`. A base URL sent for
     `lmstudio` was accepted, dropped on the floor, and answered **HTTP 200 + "Saved"**. That is
     the genuinely silent half, and it is what an operator actually hits.
  2. `app_settings` had no `lmstudio_api_key` column, yet the PUT writes `f"{p.id}_api_key"` for
     EVERY provider in `KNOWN_PROVIDERS`. That key is a legal SQL identifier, so it sailed past
     `_VALID_COLUMN_NAME`, reached the one composed `UPDATE … SET`, and raised `UndefinedColumn`
     — taking the ENTIRE tab's save down with it, not just LM Studio. Same shape as mig 078
     (`skill_builder_model`, hidden ~10 days) and mig 176 (`hnsw_*`, test_241_cr01).
  3. `config.py`'s `key_map` HARDCODED `"ollama"` / `"lm-studio"` as the key. An operator's real
     bearer token — vLLM's `--api-key`, a tunnel behind auth — was discarded before it was ever
     sent. This is the arm that blocks SEED-173's actual requirement.

⚠ THE REAL LESSON IS THE DUPLICATION, WHICH IS WHY THESE TESTS BIND A TABLE AND NOT A BRANCH.
The `/v1` asymmetry (ollama stores WITHOUT `/v1` and has it appended; everyone else stores it
verbatim) was expressed as a separate `if provider == "ollama"` in FOUR files, and three of the
four simply had no second arm. A fence that pinned "lmstudio works" would be satisfied by a
fourth hand-written branch; these pin that ALL self-hosted providers are handled by ONE table,
so the next one added is correct by construction.
"""

import pytest

from app.config import (
    _PROVIDER_BASE_URLS,
    _SELF_HOSTED_PROVIDERS,
    normalize_self_hosted_base_url,
    resolve_self_hosted_base_url,
)
from app.models.user_settings import KNOWN_PROVIDERS, _build_providers
from app.security.secret_cipher import SECRET_COLUMNS

SELF_HOSTED = sorted(_SELF_HOSTED_PROVIDERS)


class TestTheTableIsTheSingleSourceOfTruth:
    """A self-hosted provider is DECLARED, never branched on."""

    def test_every_self_hosted_provider_is_a_known_provider(self):
        for pid in SELF_HOSTED:
            assert pid in KNOWN_PROVIDERS, f"{pid} is unreachable from the Settings UI"

    def test_a_self_hosted_provider_has_no_static_endpoint(self):
        """⛔ The empty string in _PROVIDER_BASE_URLS is what MAKES a provider self-hosted.

        If a row here ever gained a vendor URL, the static value and the operator's column
        would both be live and nothing would say which wins.
        """
        for pid in SELF_HOSTED:
            assert _PROVIDER_BASE_URLS[pid] == "", (
                f"{pid} is in _SELF_HOSTED_PROVIDERS but also carries a static base_url"
            )

    def test_the_generic_openai_compatible_slot_exists(self):
        """SEED-173's headline requirement: an endpoint we have NO vendor knowledge of.

        Ollama and LM Studio are two products; the requirement is *any* OpenAI-compatible
        server — vLLM, Unsloth, llama.cpp, something behind a tunnel.
        """
        assert "custom" in _SELF_HOSTED_PROVIDERS


class TestBaseUrlRoundTrip:
    """normalize_ and resolve_ MUST be inverses, or a save corrupts itself."""

    @pytest.mark.parametrize("pid", SELF_HOSTED)
    def test_typed_url_survives_a_save_and_reload(self, pid):
        typed = "https://confidential-manager-based-varying.trycloudflare.com/v1"
        stored = normalize_self_hosted_base_url(pid, typed)
        assert resolve_self_hosted_base_url(pid, stored) == typed

    @pytest.mark.parametrize("pid", SELF_HOSTED)
    def test_saving_twice_does_not_grow_a_second_v1(self, pid):
        """⛔ The concrete bug the old ollama-only strip existed to prevent.

        The UI re-submits whatever it last loaded, so a non-inverse pair compounds on every
        save: .../v1 -> .../v1/v1 -> .../v1/v1/v1. Idempotence is the property, not the strip.
        """
        typed = "https://tunnel.example.com/v1"
        once = resolve_self_hosted_base_url(pid, normalize_self_hosted_base_url(pid, typed))
        twice = resolve_self_hosted_base_url(pid, normalize_self_hosted_base_url(pid, once))
        assert once == twice == typed

    def test_ollama_keeps_its_legacy_no_v1_storage_shape(self):
        """Back-compat: rows already stored WITHOUT /v1 must still resolve correctly."""
        assert resolve_self_hosted_base_url("ollama", "http://localhost:11434") == (
            "http://localhost:11434/v1"
        )

    def test_lmstudio_and_custom_are_used_verbatim(self):
        """These two store the /v1 they were given — nothing re-adds it."""
        for pid in ("lmstudio", "custom"):
            assert resolve_self_hosted_base_url(pid, "https://h/v1") == "https://h/v1"


class TestOperatorKeyWins:
    """SEED-173 — a self-hosted endpoint may sit behind REAL auth."""

    @pytest.mark.parametrize("pid", SELF_HOSTED)
    def test_a_configured_key_is_not_replaced_by_the_dummy(self, pid):
        """⛔ RED before the fix: config.py hardcoded 'ollama' / 'lm-studio' as the key.

        A vLLM server started with --api-key, or a tunnel requiring a bearer token, was
        unreachable BY CONSTRUCTION — the operator's key was discarded before the call.
        """
        spec = _SELF_HOSTED_PROVIDERS[pid]
        row = {f"{pid}_api_key": "real-operator-token", str(spec["url_field"]): "https://h/v1"}
        built = {p.id: p for p in _build_providers(row)}
        assert built[pid].api_key == "real-operator-token"

    @pytest.mark.parametrize("pid", SELF_HOSTED)
    def test_an_empty_key_falls_back_to_a_placeholder(self, pid):
        """The OpenAI SDK refuses an empty api_key, and a bare local server has no auth."""
        built = {p.id: p for p in _build_providers({})}
        assert built[pid].api_key, f"{pid} would be sent an empty key and fail at the SDK"

    @pytest.mark.parametrize("pid", SELF_HOSTED)
    def test_the_key_column_is_encrypted_at_rest(self, pid):
        """A self-hosted key is a secret like any other — it must not be the one plaintext."""
        assert f"{pid}_api_key" in SECRET_COLUMNS


class TestTheUiCanNameEveryProvider:
    def test_no_provider_falls_back_to_its_raw_id(self):
        """⛔ `lmstudio` had no display name, so its card read the literal id for years."""
        for pid, meta in KNOWN_PROVIDERS.items():
            assert meta["name"] != pid, f"{pid} has no display name"
