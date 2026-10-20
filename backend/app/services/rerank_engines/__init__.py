"""Rerank / decision engines (Phase 294-01, DEC-01).

The engine table is ``registry.py``; this module answers the questions every caller asks of it:
which engine a stored ``rerank_provider`` names, which model to send, which key to use, and
whether the citation check (plan 03) can run.

⛔ Keys are read from ``user_settings.providers`` BY ``id`` (``"openrouter"`` / ``"openai"``) or
from ``rerank_api_key`` — never from a ``base_url`` (D-02: no TypeSafe direct path exists, and
Jev's endpoint is not under OpenRouter's ``/api/v1``). A key is never logged and never returned
anywhere except to the adapter that sends it.
"""
from __future__ import annotations

import logging
import os
import re
import threading
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from app.config import settings
from app.services.rerank_engines.registry import (
    COHERE_RERANK_URL,
    ENGINES,
    JEV_DECISIONS_URL,
    LEGACY_ALIASES,
    OPENAI_DECISIONS_URL,
    EngineSpec,
)
from app.utils.environment import current_environment

__all__ = [
    "CheckAvailability",
    "DecisionMalformed",
    "DecisionRefused",
    "DecisionTimeout",
    "MissingEngineKey",
    "citation_check_availability",
    "get_engine",
    "Endpoint",
    "FAULT_BASE_ENV",
    "FAULT_DUMMY_TOKEN",
    "resolve_credentials",
    "resolve_endpoint",
    "resolve_model",
    "target_for",
]

logger = logging.getLogger(__name__)


class MissingEngineKey(RuntimeError):
    """A hosted engine is selected but no key is stored for it. The message is the engine id."""


class DecisionMalformed(ValueError):
    """A decision response is missing an answer or answers with the wrong type (never the body)."""


class DecisionRefused(RuntimeError):
    """An OpenAI Decisions answer was a refusal; a rerank then fails whole and falls back."""


class DecisionTimeout(TimeoutError):
    """The Jev fan-out did not finish inside its overall budget."""


def get_engine(provider_id: str | None) -> EngineSpec | None:
    """``"api"`` → Cohere (the pre-294 spelling); an unknown or empty id → None."""
    if not provider_id:
        return None
    pid = LEGACY_ALIASES.get(provider_id, provider_id)
    return ENGINES.get(pid)


def resolve_model(spec: EngineSpec, rerank_model: str | None) -> str:
    """The stored model when it belongs to this engine, else the engine's default.

    One ``rerank_model`` setting serves every engine, so after switching engines the stored value
    is usually another engine's name (``rerank-v3.5`` under Jev). Sending it would fail every call.
    """
    if rerank_model and re.search(spec.model_pattern, rerank_model):
        return rerank_model
    return spec.default_model


def _clean(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def resolve_credentials(spec: EngineSpec, user_settings: Any) -> str | None:
    """The key the engine authenticates with, or None. Never logged."""
    source = spec.key_source
    if source is None:
        return None
    if source == "rerank_api_key":
        if user_settings is not None:
            return _clean(getattr(user_settings, "rerank_api_key", None))
        return _clean(settings.rerank_api_key)
    if user_settings is not None:
        for provider in getattr(user_settings, "providers", None) or []:
            if getattr(provider, "id", None) == source:
                return _clean(getattr(provider, "api_key", None))
        return None
    return _clean(getattr(settings, f"{source}_api_key", None))


@dataclass(frozen=True)
class CheckAvailability:
    available: bool
    engine: str | None          # "jev" | "openai_decisions" | None
    reason: str | None          # "off" | "engine_reorders_only" | "key_missing" | None


def citation_check_availability(user_settings: Any) -> CheckAvailability:
    """Whether the citation check (D-13) can run under the current engine settings."""
    enabled = user_settings.rerank_enabled if user_settings is not None else settings.rerank_enabled
    if not enabled:
        return CheckAvailability(False, None, "off")
    provider = user_settings.rerank_provider if user_settings is not None else settings.rerank_provider
    spec = get_engine(provider)
    if spec is None:
        return CheckAvailability(False, None, "off")
    if not spec.citation_check:
        return CheckAvailability(False, None, "engine_reorders_only")
    if resolve_credentials(spec, user_settings) is None:
        return CheckAvailability(False, spec.id, "key_missing")
    return CheckAvailability(True, spec.id, None)


# ── Dev-only fault path (Phase 294 Task 4, D-22 enabler, T-294-31) ──────────────────────────────
#
# ``DECISION_ENGINE_FAULT_BASE_URL`` points Jev and OpenAI Decisions at
# ``scripts/decision-fault-server.py`` so the live drive can force every engine failure through
# the real app. ⛔ It can redirect a request that would carry a provider key, so:
#   N1 — honoured ONLY for an EXPLICIT ENVIRONMENT local / development / dev / test (unset does
#        not qualify — a production box that forgot ENVIRONMENT must not honour it);
#   N2 — the URL must be http(s) to exactly 127.0.0.1 / localhost / ::1 with an int port and a
#        plain path, no query / fragment / userinfo / backslash / whitespace / control character,
#        and the outgoing URL is REBUILT from the validated parts (never the raw string);
#   N3 — when honoured, the bearer token is ``FAULT_DUMMY_TOKEN``, never the stored key.
# Read per call (``backend/.env`` reaches os.environ through main.py's load_dotenv). Cohere is
# never redirected.

FAULT_BASE_ENV = "DECISION_ENGINE_FAULT_BASE_URL"
FAULT_DUMMY_TOKEN = "fault-server-dummy-token-294"
_FAULT_ENVIRONMENTS = frozenset({"local", "development", "dev", "test"})
_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})
_PLAIN_PATH = re.compile(r"^[A-Za-z0-9._~/-]*$")
_FAULT_IGNORED = (
    "DECISION_ENGINE_FAULT_BASE_URL ignored: needs ENVIRONMENT=local|development|dev|test "
    "and a loopback URL"
)
_fault_warned: set[str] = set()
_fault_warn_lock = threading.Lock()


@dataclass(frozen=True)
class Endpoint:
    url: str
    fault: bool            # True only when the guard honoured the override


def _warn_once(kind: str, msg: str, *args: Any) -> None:
    with _fault_warn_lock:
        if kind in _fault_warned:
            return
        _fault_warned.add(kind)
    logger.warning(msg, *args)


def _validated_fault_base(raw: str) -> str | None:
    """The rebuilt ``scheme://host:port[/path]`` for a strictly loopback URL, else None."""
    if not raw.isascii():                                  # fullwidth / unicode hosts
        return None
    if any(c.isspace() or ord(c) < 0x20 or ord(c) == 0x7F or c == "\\" for c in raw):
        return None
    if "?" in raw or "#" in raw or "@" in raw:             # query, fragment, userinfo (even empty)
        return None
    try:
        parts = urlsplit(raw)
        host = parts.hostname
        port = parts.port
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or host is None or port is None:
        return None
    if parts.username is not None or parts.password is not None:
        return None
    host = host.lower()
    if host not in _LOOPBACK_HOSTS or not 1 <= port <= 65535:
        return None
    path = parts.path
    if not _PLAIN_PATH.match(path) or any(seg in (".", "..") for seg in path.split("/")):
        return None
    netloc_host = "[::1]" if host == "::1" else host
    return f"{parts.scheme}://{netloc_host}:{port}{path.rstrip('/')}"


def resolve_endpoint(spec: EngineSpec) -> Endpoint:
    """The vendor URL, unless the dev-only fault override passes every guard. Read per call."""
    vendor = {"jev": JEV_DECISIONS_URL, "openai_decisions": OPENAI_DECISIONS_URL,
              "cohere": COHERE_RERANK_URL}[spec.id]
    vendor_path = {"jev": "/api/alpha/decisions", "openai_decisions": "/v1/decisions"}.get(spec.id)
    raw = os.getenv(FAULT_BASE_ENV)
    if not raw or vendor_path is None:
        return Endpoint(vendor, False)
    base = _validated_fault_base(raw)
    if base is None or current_environment() not in _FAULT_ENVIRONMENTS:
        _warn_once("ignored", _FAULT_IGNORED)
        return Endpoint(vendor, False)
    _warn_once("active", "DECISION_ENGINE_FAULT_BASE_URL is ACTIVE: decision engines are pointed at %s "
                         "(dev-only)", base)
    return Endpoint(base + vendor_path, True)


def target_for(spec: EngineSpec, api_key: str) -> tuple[str, str]:
    """(url, bearer token) for a decision engine: the dummy token whenever the fault path is on."""
    endpoint = resolve_endpoint(spec)
    return endpoint.url, (FAULT_DUMMY_TOKEN if endpoint.fault else api_key)
