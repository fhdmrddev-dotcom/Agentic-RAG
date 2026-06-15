"""
curate_models.py — Phase 096 Plan 08 (D-05) full-registry model curation pass.

Hits each provider's LIVE /models endpoint with the operator's key from
backend/.env (NAMES-only discipline: env-var names + model IDs are printed,
key VALUES never — T-096-08-01) and diffs the live truth against the FOUR
curation targets:

  1. MODEL_CAPABILITIES         backend/app/config.py (the capability registry)
  2. _SUB_AGENT_MODEL_DEFAULTS  backend/app/config.py (the table harness eval
                                rows actually use — Pitfall 1, accepted Open-Q1)
  3. eval PROVIDERS constant    scripts/eval_cross_provider.py (Deep-mode rows)
  4. Settings available_models  app_settings.provider_model_lists (live local
                                DB data, NOT code — read via psycopg2)

Greppable names-only report markers (one fact per line):

  CURATE_SKIP    <provider> <reason>           key missing / fetch failed —
                                               never blocks other providers
  CURATE_LIVE    <provider> <id>               every live ID (newest-first when
                                               the API exposes created stamps,
                                               else descending lexical)
  CURATE_MISSING <provider> <id>               live flagship-family ID absent
                                               from MODEL_CAPABILITIES
  CURATE_STALE   <provider> <id> <target>      a curation-target ID NOT in the
                                               live list (the case-sensitive
                                               silent-downgrade trap detector)
  CURATE_DEFAULT <provider> current=<id> live_newest=<id>
                                               _SUB_AGENT_MODEL_DEFAULTS row vs
                                               the live newest family ID

Reuses the eval_cross_provider.py plumbing (load_env / assert_localhost_only —
RESEARCH "Don't Hand-Roll"). The provider HTTP half is exempt from the
localhost gate (it talks to the real provider APIs by design); the DB half is
NOT — assert_localhost_only() runs BEFORE any psycopg2 connection
(T-096-08-02).

Usage
-----
  backend/venv/Scripts/python.exe scripts/curate_models.py             # all 8
  backend/venv/Scripts/python.exe scripts/curate_models.py --provider anthropic
  backend/venv/Scripts/python.exe scripts/curate_models.py --skip-db   # no app_settings diff
  backend/venv/Scripts/python.exe scripts/curate_models.py --help
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
# backend/ for `from app.config import ...`; scripts/ for eval_cross_provider.
sys.path.insert(0, str(_REPO_ROOT / "backend"))
sys.path.insert(0, str(_REPO_ROOT / "scripts"))

# ─────────────────────────────────────────────────────────────────────────────
# Provider /models endpoint table (096-08-PLAN <interfaces>; provider-docs-first:
# each provider's response SHAPE differs — parsed per-provider below, never
# assuming OpenAI's shape transfers).
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

HTTP_TIMEOUT_S = 30

# Flagship-family include filters for CURATE_MISSING + live_newest resolution.
# CURATE_LIVE always prints EVERY id; these filters only scope which live IDs
# are worth flagging as registry gaps (chat-capable flagship families — not
# embeddings/audio/image/realtime utility models). openrouter has no entry:
# its catalog is hundreds of third-party models and the tier is best-effort,
# never gating (D-03) — no MISSING reporting there.
_FAMILY_INCLUDE: dict[str, re.Pattern[str]] = {
    "openai":    re.compile(r"^(gpt-[45]|o\d)", re.IGNORECASE),
    "anthropic": re.compile(r"^claude-", re.IGNORECASE),
    "google":    re.compile(r"^gemini-", re.IGNORECASE),
    "deepseek":  re.compile(r"^deepseek-", re.IGNORECASE),
    "moonshot":  re.compile(r"^(kimi-|moonshot-)", re.IGNORECASE),
    "zhipu":     re.compile(r"^glm-", re.IGNORECASE),
    "minimax":   re.compile(r"^minimax-", re.IGNORECASE),
}

# Utility-model noise excluded from CURATE_MISSING (NOT from CURATE_LIVE).
# Dated snapshots (-YYYYMMDD / -YYYY-MM-DD) are kept — Anthropic's live list
# is dated-ID-only, and resolving exact dated IDs is the whole point (A1/A2).
_MISSING_EXCLUDE = re.compile(
    r"(embed|whisper|tts|audio|realtime|image|dall-e|moderation|transcribe|"
    r"search-preview|computer-use|codex|chatgpt|instruct|davinci|babbage)",
    re.IGNORECASE,
)

_CURATION_TARGET_NAMES = (
    "MODEL_CAPABILITIES",
    "_SUB_AGENT_MODEL_DEFAULTS",
    "EVAL_PROVIDERS",
    "available_models",
)


def _requests():
    try:
        import requests  # noqa: PLC0415 — local import keeps --help fast
    except ImportError:
        print(
            "ERROR: requests not installed in this Python. "
            "Run via the backend venv: backend/venv/Scripts/python.exe"
        )
        sys.exit(1)
    return requests


# ─────────────────────────────────────────────────────────────────────────────
# Live /models fetch — one function per response shape. Every function returns
# a list of (model_id, sort_key) where sort_key is a created timestamp (epoch
# int or ISO string) when the API exposes one, else None. NOTHING from the
# request (URL with key, headers, raw bodies) is ever printed.
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


def fetch_live_models(provider: str, key: str | None) -> list[tuple[str, object]]:
    """GET the provider's live /models endpoint; return [(id, sort_key)].

    Handles per-provider auth + pagination at the service boundary of this
    script (CLAUDE.md provider-docs-first). Raises RuntimeError with a
    names-only message on HTTP failure (no body echo — bodies could contain
    request-identifying material)."""
    requests = _requests()
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
    page_guard = 0
    while True:
        page_guard += 1
        if page_guard > 20:  # defensive pagination cap
            break
        resp = requests.get(url, headers=headers, params=params, timeout=HTTP_TIMEOUT_S)
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

        # openai / deepseek / moonshot / zhipu / openrouter — OpenAI-compat.
        models.extend(_extract_openai_compat(payload))
        break

    # De-dup preserving first occurrence (pagination overlap defense).
    seen: set[str] = set()
    deduped: list[tuple[str, object]] = []
    for mid, stamp in models:
        if mid not in seen:
            seen.add(mid)
            deduped.append((mid, stamp))
    return deduped


def sort_newest_first(models: list[tuple[str, object]]) -> list[str]:
    """Newest-first when the API exposes created stamps (epoch ints or ISO
    strings — both sort correctly within their own type); else descending
    lexical (approximates newest-first for versioned ID families)."""
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

        # Sort stamped entries newest-first, unstamped last (descending lexical).
        unstamped = sorted((m for m, s in models if s is None), reverse=True)
        ordered = [m for m, _ in sorted(stamped, key=_key, reverse=True)]
        return ordered + unstamped
    return sorted((m for m, _ in models), reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Curation-target loaders
# ─────────────────────────────────────────────────────────────────────────────

def load_registry_targets():
    """Import the three code-side targets straight from the live modules —
    no regex parsing drift (the eval script has a __main__ guard; importing
    it is side-effect-free)."""
    from app.config import (  # noqa: PLC0415 — after sys.path insert
        MODEL_CAPABILITIES,
        MODEL_CONTEXT_DEFAULTS,
        _SUB_AGENT_MODEL_DEFAULTS,
    )
    from eval_cross_provider import PROVIDERS  # noqa: PLC0415

    return MODEL_CAPABILITIES, MODEL_CONTEXT_DEFAULTS, _SUB_AGENT_MODEL_DEFAULTS, PROVIDERS


def load_settings_model_lists() -> dict[str, list[str]]:
    """Read Settings available_models (app_settings.provider_model_lists JSONB)
    from the LOCAL DB. assert_localhost_only() MUST already have run (the DB
    half is inside the gate — T-096-08-02). Constant SQL, no parameters, single
    global row."""
    import json  # noqa: PLC0415

    try:
        import psycopg2  # noqa: PLC0415
        from psycopg2.extras import RealDictCursor  # noqa: PLC0415
    except ImportError:
        print(
            "ERROR: psycopg2 not installed in this Python. "
            "Run via the backend venv: backend/venv/Scripts/python.exe"
        )
        sys.exit(1)
    db_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_DSN")
        or "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    )
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT provider_model_lists FROM app_settings WHERE id = 'global'"
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        return {}
    pml = row.get("provider_model_lists") or {}
    if isinstance(pml, str):  # double-serialization defense (user_settings.py:344)
        try:
            pml = json.loads(pml)
        except (ValueError, TypeError):
            pml = {}
    return pml if isinstance(pml, dict) else {}


# ─────────────────────────────────────────────────────────────────────────────
# Report
# ─────────────────────────────────────────────────────────────────────────────

def report_env_presence() -> None:
    """PRESENCE/ABSENCE only — never values (project secrets rule). Covers all
    8 provider keys this script can use plus the DB vars the Settings diff
    needs (the eval script's own presence report omits DEEPSEEK/MOONSHOT)."""
    checks = [
        "SUPABASE_URL",
        "DATABASE_URL",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLE_API_KEY",
        "DEEPSEEK_API_KEY",
        "MOONSHOT_API_KEY",
        "ZHIPU_API_KEY",
        "MINIMAX_API_KEY",
        "OPENROUTER_API_KEY",
    ]
    print("## Environment (presence only — secret VALUES are never printed)\n")
    for name in checks:
        print(f"  - {name}: {'set' if os.getenv(name) else 'MISSING'}")
    print()


def diff_provider(
    provider: str,
    live_ids: list[str],
    caps: dict,
    sub_defaults: dict[str, str],
    eval_providers: list[tuple[str, str]],
    settings_lists: dict[str, list[str]] | None,
) -> None:
    """Emit the greppable names-only diff for ONE provider with a live list."""
    live_set = set(live_ids)
    family = _FAMILY_INCLUDE.get(provider)

    for mid in live_ids:
        print(f"CURATE_LIVE {provider} {mid}")

    # MISSING — live flagship-family IDs absent from MODEL_CAPABILITIES.
    if family is not None:
        for mid in live_ids:
            if (
                family.search(mid)
                and not _MISSING_EXCLUDE.search(mid)
                and mid not in caps
            ):
                print(f"CURATE_MISSING {provider} {mid}")

    # STALE — curation-target IDs not in the live list (case-sensitive check:
    # the silent-downgrade trap lives in exact-ID mismatches).
    for mid, cap in caps.items():
        if cap.get("provider") == provider and mid not in live_set:
            print(f"CURATE_STALE {provider} {mid} MODEL_CAPABILITIES")
    default_id = sub_defaults.get(provider, "")
    if default_id and default_id not in live_set:
        print(f"CURATE_STALE {provider} {default_id} _SUB_AGENT_MODEL_DEFAULTS")
    for p, m in eval_providers:
        if p == provider and m not in live_set:
            print(f"CURATE_STALE {provider} {m} EVAL_PROVIDERS")
    if settings_lists is not None:
        for m in settings_lists.get(provider, []):
            if m not in live_set:
                print(f"CURATE_STALE {provider} {m} available_models")

    # DEFAULT — defaults-table row vs live newest family ID.
    if default_id:
        if family is not None:
            family_live = [
                m for m in live_ids
                if family.search(m) and not _MISSING_EXCLUDE.search(m)
            ]
        else:
            family_live = live_ids
        live_newest = family_live[0] if family_live else "-"
        print(f"CURATE_DEFAULT {provider} current={default_id} live_newest={live_newest}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="curate_models.py",
        description=(
            "D-05 model curation: live /models fetch per provider + names-only "
            "diff against MODEL_CAPABILITIES, _SUB_AGENT_MODEL_DEFAULTS, the "
            "eval PROVIDERS constant, and Settings available_models "
            "(app_settings data). Prints model IDs and env-var NAMES only — "
            "never key values."
        ),
    )
    parser.add_argument(
        "--provider",
        choices=sorted(PROVIDER_ENDPOINTS),
        help="Fetch + diff only this provider (default: all 8).",
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Skip the app_settings available_models diff (no DB connection).",
    )
    args = parser.parse_args(argv)

    # Reuse the eval script's plumbing (RESEARCH "Don't Hand-Roll").
    from eval_cross_provider import assert_localhost_only, load_env  # noqa: PLC0415

    load_env()
    report_env_presence()

    caps, _ctx_defaults, sub_defaults, eval_providers = load_registry_targets()

    settings_lists: dict[str, list[str]] | None = None
    if not args.skip_db:
        # LOCALHOST HARD-GATE before ANY DB read (T-096-08-02). The provider
        # HTTP calls above/below are exempt — they target the real provider
        # APIs by design; the app/DB half is not.
        assert_localhost_only()
        settings_lists = load_settings_model_lists()

    selected = [args.provider] if args.provider else list(PROVIDER_ENDPOINTS)
    fetched_any = False
    for provider in selected:
        cfg = PROVIDER_ENDPOINTS[provider]
        key = os.getenv(cfg["key_env"]) or None
        if key is None and cfg["auth"] != "public":
            print(f"CURATE_SKIP {provider} key-missing")  # never blocks others
            continue
        try:
            live = fetch_live_models(provider, key)
        except Exception as e:  # HTTP failure / network — names-only reason
            reason = str(e) if str(e).startswith("http-") else f"error-{type(e).__name__}"
            print(f"CURATE_SKIP {provider} {reason}")
            continue
        if not live:
            print(f"CURATE_SKIP {provider} empty-live-list")
            continue
        fetched_any = True
        live_ids = sort_newest_first(live)
        print(f"\n## {provider} — {len(live_ids)} live models\n")
        diff_provider(
            provider, live_ids, caps, sub_defaults, eval_providers, settings_lists,
        )

    print(
        "\nCuration targets diffed: "
        + ", ".join(_CURATION_TARGET_NAMES[: 3 if args.skip_db else 4])
    )
    return 0 if fetched_any else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
