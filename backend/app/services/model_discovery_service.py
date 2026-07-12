"""model_discovery_service.py — Phase 149 Plan 02 (MODEL-02).

The concurrent external fan-out that model discovery runs on. It is a
lift-and-wrap of ``scripts/curate_models.py`` (the hardcoded endpoint table,
per-shape id extractors, google/anthropic pagination, newest-first sort),
converted from blocking ``requests`` to ``httpx.AsyncClient`` + ``asyncio.gather``,
plus the genuinely net-new diff computation and the propose-only
"unknown — you set it" capability-fill asymmetry that is the SC#3 hero.

Two public entry points:

  ``discover_all(keyed)``   — async fan-out over ``PROVIDER_ENDPOINTS`` returning
                              honest per-provider outcomes (no_key / http-* / ok).
  ``compute_diff(...)``     — partition the discovered ids against an INJECTED
                              ``current`` registry into new/changed/vanished, with
                              new models landing ``enabled=false`` and capabilities
                              filled ONLY where the provider returned them.

Security posture (149 threat model):

  * SSRF (T-149-03) — URLs come ONLY from the hardcoded ``PROVIDER_ENDPOINTS``
    allowlist. No function parameter ever accepts a URL/base from a caller.
  * Info-disclosure (T-149-04) — per-provider failure is NAMES-ONLY
    (``http-{status}`` / ``error-{ExceptionName}``); the response body and the
    API key are never echoed (curate_models.py:218 discipline).
  * Routing integrity / SC#3 (T-149-05) — ``compute_diff`` never fills or
    auto-enables a capability the provider did not return.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Provider /models endpoint table — copied VERBATIM from curate_models.py:67.
# This is a hardcoded code-constant allowlist: no client-supplied URL ever
# reaches the HTTP client (the SSRF defense, Pitfall 7 / T-149-03).
#   auth styles: bearer        — Authorization: Bearer <key>
#                anthropic     — x-api-key + anthropic-version headers
#                google_query  — ?key=<key> query param (never printed)
#                public        — no auth required (openrouter; key used if set)
# ─────────────────────────────────────────────────────────────────────────────
PROVIDER_ENDPOINTS: dict[str, dict[str, str]] = {
    "openai":     {"url": "https://api.openai.com/v1/models",
                   "auth": "bearer", "key_env": "OPENAI_API_KEY"},
    "anthropic":  {"url": "https://api.anthropic.com/v1/models",
                   "auth": "anthropic", "key_env": "ANTHROPIC_API_KEY"},
    "google":     {"url": "https://generativelanguage.googleapis.com/v1beta/models",
                   "auth": "google_query", "key_env": "GOOGLE_API_KEY"},
    "deepseek":   {"url": "https://api.deepseek.com/models",
                   "auth": "bearer", "key_env": "DEEPSEEK_API_KEY"},
    "moonshot":   {"url": "https://api.moonshot.ai/v1/models",
                   "auth": "bearer", "key_env": "MOONSHOT_API_KEY"},
    "zhipu":      {"url": "https://api.z.ai/api/paas/v4/models",
                   "auth": "bearer", "key_env": "ZHIPU_API_KEY"},
    "minimax":    {"url": "https://api.minimax.io/v1/models",
                   "auth": "bearer", "key_env": "MINIMAX_API_KEY"},
    "openrouter": {"url": "https://openrouter.ai/api/v1/models",
                   "auth": "public", "key_env": "OPENROUTER_API_KEY"},
}

# Per-request timeout (rerank_service.py idiom; ~12s per the plan D-149-11).
_PER_REQUEST_TIMEOUT_S = 12.0
# Defensive pagination cap (matches curate_models.py).
_PAGE_GUARD = 20

# The ONLY two providers whose /models exposes any capability metadata
# (RESEARCH §"Provider /models Capability Matrix" — the SC#3 evidence base).
_CAPS_PROVIDERS = frozenset({"google", "openrouter"})

# The propose-only sentinel for a capability the provider did NOT return. The UI
# renders this as the amber "unknown — you set it" input. It is a distinct
# string — NEVER a guessed value, NEVER a boolean, NEVER an auto-enable.
UNKNOWN = "unknown"

# The capability fields discovery can ever fill (context/token limits +
# native tool support). Every other capability is operator-set.
_CAP_FIELDS = ("context", "max_output", "native_tools")


# ─────────────────────────────────────────────────────────────────────────────
# Id extractors — lifted VERBATIM from curate_models.py (openai-compat / minimax
# / sort). Each returns (id, sort_key) tuples; sort_key is a created timestamp
# (epoch int or ISO string) when the API exposes one, else None.
# ─────────────────────────────────────────────────────────────────────────────
def _extract_openai_compat(payload: dict) -> list[tuple[str, object]]:
    """OpenAI-compatible shape: {"data": [{"id": ..., "created": epoch?}]}.
    Used by openai / deepseek / moonshot / zhipu / openrouter (and tried first
    for minimax)."""
    out: list[tuple[str, object]] = []
    for el in payload.get("data") or []:
        if isinstance(el, dict):
            mid = el.get("id") or el.get("model")
            if mid:
                out.append((str(mid), el.get("created") or el.get("created_at")))
    return out


def _extract_minimax(payload: object) -> list[tuple[str, object]]:
    """MiniMax (api.minimax.io): defensively probe the DOCUMENTED int'l shapes
    in order — OpenAI-compat data[], then model_list[], then a bare list.
    Provider-docs-first: shape confirmed against the live response, never
    assumed (platform.minimax.io)."""
    if isinstance(payload, dict):
        compat = _extract_openai_compat(payload)
        if compat:
            return compat
        for list_key in ("model_list", "models", "model"):
            entries = payload.get(list_key)
            if isinstance(entries, list):
                out: list[tuple[str, object]] = []
                for el in entries:
                    if isinstance(el, dict):
                        mid = el.get("id") or el.get("model") or el.get("name")
                        if mid:
                            out.append((str(mid), el.get("created")))
                    elif isinstance(el, str):
                        out.append((el, None))
                if out:
                    return out
    if isinstance(payload, list):  # bare array of ids/objects
        out = []
        for el in payload:
            if isinstance(el, str):
                out.append((el, None))
            elif isinstance(el, dict) and (el.get("id") or el.get("model")):
                out.append((str(el.get("id") or el.get("model")), el.get("created")))
        return out
    return []


def sort_newest_first(models: list[tuple[str, object]]) -> list[str]:
    """Newest-first when the API exposes created stamps (epoch ints or ISO
    strings — both sort correctly within their own type); else descending
    lexical (approximates newest-first for versioned ID families). Preserves id
    casing verbatim via the stored str(id) (Pitfall 6)."""
    stamped = [(m, s) for m, s in models if s is not None]
    if stamped and len(stamped) >= max(1, len(models) // 2):
        key_of = {m: s for m, s in stamped}

        def _key(item: tuple[str, object]):
            s = key_of.get(item[0])
            if isinstance(s, (int, float)):
                return (1, float(s), item[0])
            if isinstance(s, str):
                return (0, 0.0, s)  # ISO strings sort lexically = chronologically
            return (-1, 0.0, item[0])

        unstamped = sorted((m for m, s in models if s is None), reverse=True)
        ordered = [m for m, _ in sorted(stamped, key=_key, reverse=True)]
        return ordered + unstamped
    return sorted((m for m, _ in models), reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Capability extractors — the SC#3 evidence base. ONLY OpenRouter and Google
# return capability metadata from /models; everything else is IDs-only.
# ─────────────────────────────────────────────────────────────────────────────
def _extract_caps_openrouter(payload: dict) -> dict[str, dict]:
    """OpenRouter → context_length + top_provider.max_completion_tokens +
    supported_parameters (contains "tools" → native_tools bool)."""
    caps: dict[str, dict] = {}
    for el in payload.get("data") or []:
        if not isinstance(el, dict):
            continue
        mid = el.get("id") or el.get("model")
        if not mid:
            continue
        entry: dict = {}
        if el.get("context_length") is not None:
            entry["context"] = el["context_length"]
        top = el.get("top_provider")
        if isinstance(top, dict) and top.get("max_completion_tokens") is not None:
            entry["max_output"] = top["max_completion_tokens"]
        sp = el.get("supported_parameters")
        if isinstance(sp, list):
            entry["native_tools"] = "tools" in sp
        caps[str(mid)] = entry
    return caps


def _extract_caps_google(payload: dict) -> dict[str, dict]:
    """Google → inputTokenLimit + outputTokenLimit. There is NO clean tools
    boolean (only supportedGenerationMethods), so native_tools stays unknown."""
    caps: dict[str, dict] = {}
    for el in payload.get("models") or []:
        if not isinstance(el, dict) or not el.get("name"):
            continue
        mid = str(el["name"])
        if mid.startswith("models/"):
            mid = mid[len("models/"):]
        entry: dict = {}
        if el.get("inputTokenLimit") is not None:
            entry["context"] = el["inputTokenLimit"]
        if el.get("outputTokenLimit") is not None:
            entry["max_output"] = el["outputTokenLimit"]
        caps[mid] = entry
    return caps


# ─────────────────────────────────────────────────────────────────────────────
# Async fan-out
# ─────────────────────────────────────────────────────────────────────────────
async def _fetch_models(
    client: httpx.AsyncClient, provider: str, key: str | None
) -> tuple[list[tuple[str, object]], dict[str, dict]]:
    """GET the provider's live /models endpoint; return ([(id, sort_key)], caps).

    Handles per-provider auth + pagination at the service boundary (CLAUDE.md
    provider-docs-first). Raises RuntimeError("http-{status}") on a non-200 —
    a names-only message with no body echo (T-149-04)."""
    cfg = PROVIDER_ENDPOINTS[provider]
    url = cfg["url"]
    headers: dict[str, str] = {}
    params: dict[str, str] = {}

    if cfg["auth"] == "bearer":
        headers["Authorization"] = f"Bearer {key}"
    elif cfg["auth"] == "anthropic":
        headers["x-api-key"] = key or ""
        headers["anthropic-version"] = "2023-06-01"
        params["limit"] = "1000"
    elif cfg["auth"] == "google_query":
        params["key"] = key or ""
        params["pageSize"] = "1000"
    elif cfg["auth"] == "public" and key:
        headers["Authorization"] = f"Bearer {key}"  # optional; endpoint is public

    models: list[tuple[str, object]] = []
    caps: dict[str, dict] = {}
    page_guard = 0
    while True:
        page_guard += 1
        if page_guard > _PAGE_GUARD:  # defensive pagination cap
            break
        resp = await client.get(
            url, headers=headers, params=params, timeout=_PER_REQUEST_TIMEOUT_S
        )
        if resp.status_code != 200:
            # Names-only failure: status code + provider, never the body.
            raise RuntimeError(f"http-{resp.status_code}")
        payload = resp.json()

        if provider == "google":
            # {"models": [{"name": "models/gemini-..."}], "nextPageToken"?}
            for el in payload.get("models") or []:
                if isinstance(el, dict) and el.get("name"):
                    mid = str(el["name"])
                    if mid.startswith("models/"):
                        mid = mid[len("models/"):]
                    models.append((mid, None))
            caps.update(_extract_caps_google(payload))
            token = payload.get("nextPageToken")
            if token:
                params["pageToken"] = str(token)
                continue
            break

        if provider == "anthropic":
            # {"data": [{"id", "created_at"}], "has_more", "last_id"}
            models.extend(_extract_openai_compat(payload))
            if payload.get("has_more") and payload.get("last_id"):
                params["after_id"] = str(payload["last_id"])
                continue
            break

        if provider == "minimax":
            models.extend(_extract_minimax(payload))
            break

        if provider == "openrouter":
            models.extend(_extract_openai_compat(payload))
            caps.update(_extract_caps_openrouter(payload))
            break

        # openai / deepseek / moonshot / zhipu — OpenAI-compat, IDs only.
        models.extend(_extract_openai_compat(payload))
        break

    # De-dup preserving first occurrence (pagination overlap defense).
    seen: set[str] = set()
    deduped: list[tuple[str, object]] = []
    for mid, stamp in models:
        if mid not in seen:
            seen.add(mid)
            deduped.append((mid, stamp))
    return deduped, caps


async def _fetch_provider(
    client: httpx.AsyncClient, provider: str, key: str | None
) -> dict:
    """Return the honest per-provider outcome dict for a single provider.

    Never raises — a network exception or non-200 becomes an honest status so
    one provider's failure cannot abort the fan-out (the 058/060 lesson)."""
    cfg = PROVIDER_ENDPOINTS[provider]

    # A provider with no key (and auth != public) is SKIPPED, not failed.
    if not key and cfg["auth"] != "public":
        return {"provider": provider, "status": "no_key"}

    try:
        models, caps = await _fetch_models(client, provider, key)
    except RuntimeError as e:  # non-200 → names-only http-{status}
        msg = str(e)
        status = msg if msg.startswith("http-") else f"error-{type(e).__name__}"
        return {"provider": provider, "status": status, "ids": []}
    except Exception as e:  # network / parse — names-only, body never echoed
        return {"provider": provider, "status": f"error-{type(e).__name__}", "ids": []}

    return {
        "provider": provider,
        "status": "ok",
        "ids": sort_newest_first(models),
        "caps": caps,
        "capabilities_returned": provider in _CAPS_PROVIDERS,
    }


async def discover_all(keyed: dict[str, str | None]) -> list[dict]:
    """Fan out concurrently to every provider in the hardcoded allowlist and
    return one list of honest per-provider outcome dicts (D-149-11).

    ``keyed`` maps ``provider -> api_key|None`` (the caller resolves keys from
    settings — see ``keyed_from_settings``). This function reads NO settings and
    accepts NO URL, keeping it pure/testable and SSRF-safe. Providers absent
    from ``keyed`` are treated as unkeyed. Iteration is over ``PROVIDER_ENDPOINTS``
    only — never over caller-supplied keys — so an unknown key cannot inject a
    request."""
    async with httpx.AsyncClient() as client:
        providers = list(PROVIDER_ENDPOINTS)
        results = await asyncio.gather(
            *(_fetch_provider(client, p, keyed.get(p)) for p in providers),
            return_exceptions=True,
        )

    out: list[dict] = []
    for provider, res in zip(providers, results):
        if isinstance(res, BaseException):
            # Belt-and-suspenders: _fetch_provider already catches, but never
            # let a stray gather exception drop a provider from the result.
            out.append({
                "provider": provider,
                "status": f"error-{type(res).__name__}",
                "ids": [],
            })
        else:
            out.append(res)
    return out


def keyed_from_settings() -> dict[str, str | None]:
    """Build the ``{provider: api_key|None}`` map from env-configured settings.

    The pure fan-out (``discover_all``) takes this as input so it never reads
    settings itself. The Plan 05 operator endpoint calls this to resolve keys.
    Only providers in ``PROVIDER_ENDPOINTS`` are considered."""
    key_map: dict[str, str] = {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "google": settings.google_api_key,
        "deepseek": settings.deepseek_api_key,
        "moonshot": settings.moonshot_api_key,
        "zhipu": settings.zhipu_api_key,
        "minimax": settings.minimax_api_key,
        "openrouter": settings.openrouter_api_key,
    }
    return {p: (key_map.get(p) or None) for p in PROVIDER_ENDPOINTS}


# ─────────────────────────────────────────────────────────────────────────────
# Diff computation + propose-only capability fill (SC#3)
# ─────────────────────────────────────────────────────────────────────────────
def _build_new_entry(provider: str, model_id: str, model_caps: dict) -> dict:
    """A discovered-but-unknown model. Lands ``enabled=False`` with a per-field
    capability map: a concrete provider-returned value where present, else the
    ``UNKNOWN`` sentinel. The asymmetry (SC#3) falls out naturally because
    ``model_caps`` only carries the fields the provider actually returned —
    OpenRouter yields all three, Google only the token limits, everyone else
    nothing. NEVER a guessed value, NEVER an auto-enable (T-149-05)."""
    capabilities: dict = {}
    for field in _CAP_FIELDS:
        value = model_caps.get(field)
        capabilities[field] = value if value is not None else UNKNOWN
    return {
        "provider": provider,
        "model_id": model_id,
        "enabled": False,
        "capabilities": capabilities,
    }


def compute_diff(current: dict[str, dict], discovered: list[dict]) -> dict:
    """Partition discovered models against an INJECTED ``current`` registry.

    ``current`` maps ``model_id -> capability dict`` (each carrying a
    ``provider`` field). The caller supplies the registry union (config ∪ all
    DB rows) — the service reads NO DB itself, keeping it pure/testable and
    Wave-1-independent (D-149-12). ``discovered`` is the ``discover_all`` result.

    Returns a plain, JSON-serializable dict with three groups:

      ``new``      — returned ids absent from ``current``. Each lands
                     ``enabled=False`` with propose-only capability fill.
      ``changed``  — ids in both where a provider-RETURNED capability differs
                     from the stored value (only returned fields are compared).
      ``vanished`` — ``current`` ids belonging to an ``ok`` provider that were
                     NOT in that provider's returned set. A provider that
                     failed / had no key contributes NONE (its models are
                     unknown, not gone — the 058/060 lesson).

    The result is ephemeral — it lives only in the HTTP response; no proposals
    table is built and no staleness lifecycle exists."""
    # Only providers that responded ok contribute a DEFINITIVE returned set.
    ok_info: dict[str, dict] = {}
    for entry in discovered:
        if entry.get("status") == "ok":
            ids = list(entry.get("ids") or [])
            ok_info[entry["provider"]] = {
                "ids": ids,               # newest-first order preserved
                "id_set": set(ids),
                "caps": entry.get("caps") or {},
            }

    new: list[dict] = []
    changed: list[dict] = []

    # NEW + CHANGED — walk each ok provider's returned ids (newest-first kept).
    for provider, info in ok_info.items():
        provider_caps = info["caps"]
        for model_id in info["ids"]:
            model_caps = provider_caps.get(model_id, {})
            if model_id not in current:
                new.append(_build_new_entry(provider, model_id, model_caps))
                continue
            # changed: compare ONLY the fields the provider actually returned.
            stored = current[model_id]
            field_changes: dict = {}
            for field, value in model_caps.items():
                if field in _CAP_FIELDS and stored.get(field) != value:
                    field_changes[field] = {"from": stored.get(field), "to": value}
            if field_changes:
                changed.append({
                    "provider": provider,
                    "model_id": model_id,
                    "changes": field_changes,
                })

    # VANISHED — current ids of an OK provider that were not returned. A
    # failed / no_key provider is absent from ok_info → contributes none.
    vanished: list[dict] = []
    for model_id, cap in current.items():
        provider = cap.get("provider")
        info = ok_info.get(provider)
        if info is not None and model_id not in info["id_set"]:
            vanished.append({"provider": provider, "model_id": model_id})

    return {"new": new, "changed": changed, "vanished": vanished}
