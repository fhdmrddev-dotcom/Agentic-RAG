"""Phase 187 Plan 07 (VOCAB-02 / SC#10 / D-187-13) — the per-provider generation roster.

WHAT THIS PROVES
    Plan 187-02 added one sentence to ``AUTHORING_SYSTEM_PROMPT`` asking for a short,
    plain-language ``name`` on every phase. A prompt instruction is not a contract: each
    provider has its own emission path (``emit_tier`` force_strict / force / coerce, native
    vs non-native tool use), and an instruction that survives OpenAI's strict json_schema
    can still be dropped by a coerced Moonshot emit. This file drives ONE real generation
    per provider group and asserts that EVERY phase of the emitted definition carries a
    non-empty ``name``.

WHAT IT DOES NOT PROVE
    It does NOT prove the ``HARNESS_AUTHORING_MODEL`` env var reaches
    ``resolve_authoring_model`` in a running backend. That knob is env-only (no Settings UI,
    no ``app_settings`` row, no sync) and needs a backend restart to observe — it stays
    manual row **M7** in ``187-VALIDATION.md``.

THE ROSTER IS DERIVED, NEVER RE-TYPED (CLAUDE.md §"UAT scoreboard recipe")
    ``MODEL_CAPABILITIES`` is the source of truth. ``derive_roster()`` imports it, groups on
    ``provider`` and picks ONE representative per group with a documented ordering heuristic
    (newest version tuple parsed out of the id). A hand-typed list of eight strings would rot
    the moment a provider is added or a model is superseded — and that rot is invisible,
    because the stale id still runs, it just measures a model we no longer ship.
    ``test_roster_is_derived_from_the_live_registry`` is the guard on that property and it
    runs in the DEFAULT suite (see the skip design below).

    Measured 2026-08-02 on ``develop``: **61 models across 8 provider groups** — openai,
    anthropic, google, deepseek, moonshot, minimax, zhipu, openrouter. This REFUTES the
    187-SPEC's crude parse on two counts: DeepSeek IS in the registry (two v4 entries), and
    the ids carrying no ``forced_emission`` are five (all three moonshot natives plus the two
    OpenRouter moonshot rows), not the SPEC's figure. The shape test re-derives all of this
    at run time so a future edit cannot silently shrink the board.

ZERO GLOBAL MUTATION
    ``generate_workflow_definition`` takes ``settings`` as a PARAMETER
    (``workflow_authoring.py:221-231``) — the route happens to pass the app-level env
    ``Settings``, but the function never reads a global. So each row passes its own
    ``SimpleNamespace(harness_authoring_model=<row id>)`` stub. Nothing in this file patches
    or rebinds a module-level singleton, there is no serialisation requirement between rows,
    and no way for one row to contaminate the next or to leave the operator's environment
    altered. (The 187-SPEC assumed the rows had to drive a global and therefore run serially;
    that assumption is superseded by the measured signature.)

THE MOONSHOT ROW IS THE INTERESTING ONE
    ``resolve_authoring_model``'s branch 1 returns ``settings.harness_authoring_model``
    WITHOUT checking ``forced_emission`` / ``emit_tier`` — only the fallback branch validates.
    The moonshot representative is ``emit_tier`` coerce with no ``forced_emission``, so an
    explicitly-set moonshot model hands an unforceable model to
    ``forced_emit(schema_model=WorkflowDefinition)``. If that row is ❌ this is a REAL FINDING
    ABOUT THE KNOB (adjacent to open bug ``BUG-260731-01``), not a broken test. It is
    deliberately NOT ``xfail``-ed: a predicted failure recorded as a finding is worth more
    than a green suite that hides it.

RUNNING IT (opt-in — this file makes REAL, PAID provider calls)
    The live rows are gated on ``RUN_187_AUTHORING_ROSTER=1`` AND a reachable Supabase, so a
    plain ``pytest tests/ -q`` collects them, skips them, and makes zero network calls.

        cd backend
        RUN_187_AUTHORING_ROSTER=1 ./venv/Scripts/python.exe -m pytest \
            tests/integration/test_187_authoring_roster.py -q -s

    Optional knobs: ``ROSTER_187_USER_ID`` (else the first ``profiles`` row),
    ``ROSTER_187_TIMEOUT`` (per-row wall-clock ceiling, default 300 s),
    ``ROSTER_187_OUT`` (scoreboard path, default ``<tmp>/phase187_roster_scoreboard.md``).

SKIP DESIGN — a deliberate deviation from the plan's letter, recorded in 187-07-SUMMARY
    The plan asked for a module-level ``pytestmark = pytest.mark.skipif(...)``. That would
    also skip ``test_roster_is_derived_from_the_live_registry``, which is the mitigation for
    T-187-07-02 (roster completeness) and needs no key, no network and no Supabase. A
    completeness guard that only runs under an opt-in cannot catch the registry edit it
    exists to catch. So the gate is applied per-row INSIDE the live test instead, which
    additionally lets a blocked row RECORD itself ⛔ before skipping — the plan's own
    "record, never omit" requirement, which a collection-time skip mark cannot satisfy.

RECORD, NEVER OMIT
    Every row writes into ``_RESULTS`` before it can pass, fail, block or time out, and a
    module-scoped finalizer always emits the full 8-row table (rows never reached are
    printed as ⛔ not-run). A scoreboard that lists only what passed is not a scoreboard.

SECRETS (T-187-07-01)
    Provider keys are read through the shipped settings object and are never logged,
    printed, or written to the scoreboard. Key presence is recorded as a BOOLEAN only.
"""

from __future__ import annotations

import asyncio
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

# ── backend/.env (pytest does not load it; uvicorn does) ────────────────────────
# Read the FILE, not ``app.config.settings``: ``tests/conftest.py:10-11`` setdefaults
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY to SENTINELS before any app import, and a real
# process env var wins over the .env file in pydantic-settings — so the settings object in
# a pytest process points at a Supabase project that does not exist. The provider api_keys
# are untouched by that conftest and resolve normally from .env.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_DIR / ".env"

try:  # pragma: no cover - trivial import guard
    from dotenv import dotenv_values as _dotenv_values

    _DOTENV: dict[str, str | None] = _dotenv_values(_ENV_FILE) if _ENV_FILE.exists() else {}
except ImportError:  # pragma: no cover
    _DOTENV = {}


OPT_IN_ENV = "RUN_187_AUTHORING_ROSTER"
USER_ID_ENV = "ROSTER_187_USER_ID"
TIMEOUT_ENV = "ROSTER_187_TIMEOUT"
OUT_ENV = "ROSTER_187_OUT"

DEFAULT_ROW_TIMEOUT_S = 300.0

# A realistic, multi-step business task. Deliberately mentions no skill and no folder, so a
# clean run exercises the NAME instruction rather than grounding fidelity, and deliberately
# implies a confirm step so the emitted definition has a phase whose type name ("human
# input") is exactly the unhelpful label the per-step ``name`` is supposed to replace.
DESCRIBE = (
    "Every Monday morning, put together a renewal-risk briefing for the accounts team. "
    "Work out which customer contracts come up for renewal in the next sixty days, "
    "summarise what has changed on each account since last quarter, flag the ones that "
    "look like they might churn, check the flagged list with me before it goes out, and "
    "then write up the briefing as plain text I can paste into an email."
)


# ══════════════════════════════════════════════════════════════════════════════
# The derivation — the ONLY place a roster row comes from
# ══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class RosterRow:
    """One provider group's representative. Every field is DERIVED from the registry."""

    provider: str
    model_id: str
    native_tools: bool
    emit_tier: str
    forced_emission: Any
    key_configured: bool
    group_size: int


def _version_key(model_id: str, cap: dict) -> tuple:
    """The documented ordering heuristic: 'newest' == the largest version tuple.

    Parse every run of digits out of the id's LAST path segment (so an OpenRouter
    ``vendor/model`` id is ranked on its model half, not its vendor half) and compare the
    resulting tuples. ``gpt-4.1`` -> (4, 1) beats ``gpt-4o`` -> (4,); ``claude-sonnet-5``
    -> (5,) beats ``claude-opus-4-8`` -> (4, 8); a dated id like
    ``claude-sonnet-4-5-20250929`` -> (4, 5, 20250929) correctly ranks BELOW (4, 8) because
    tuple comparison is left-to-right. An id with no digits sorts to the bottom, never
    raises.

    Ties (e.g. the three same-version OpenAI 5.6 variants, or the two DeepSeek v4 entries)
    break on ``llm_call_timeout_seconds`` then ``max_output_tokens`` — both are proxies for
    the heavier flagship tier within a version — and finally on the id itself so the
    selection is TOTAL and DETERMINISTIC. Verified 2026-08-02: this heuristic needs no
    override map; it picks the newest flagship in all eight groups.
    """
    numbers = tuple(int(n) for n in re.findall(r"\d+", model_id.rsplit("/", 1)[-1]))
    return (
        numbers,
        cap.get("llm_call_timeout_seconds") or 0,
        cap.get("max_output_tokens") or 0,
        model_id,
    )


def group_models_by_provider() -> dict[str, list[str]]:
    """Group the LIVE registry on ``provider``. Imported, never transcribed."""
    from app.config import MODEL_CAPABILITIES

    groups: dict[str, list[str]] = {}
    for model_id, cap in MODEL_CAPABILITIES.items():
        groups.setdefault(str(cap.get("provider")), []).append(model_id)
    return groups


def derive_roster() -> list[RosterRow]:
    """One representative per provider group, newest-first per ``_version_key``.

    Capability fields are read back through ``get_model_capability`` (NOT the raw dict) so
    the row measures what the SHIPPING lookup sees. That matters: the registry is
    case-sensitive, and an id the lookup misses degrades to ``capability_source='inferred'``
    with no ``emit_tier`` — a weaker configuration than the one that ships. The shape test
    asserts every row round-trips as ``registry``.
    """
    from app.config import MODEL_CAPABILITIES, get_model_capability, settings

    rows: list[RosterRow] = []
    for provider, model_ids in group_models_by_provider().items():
        model_id = max(model_ids, key=lambda m: _version_key(m, MODEL_CAPABILITIES[m]))
        cap = get_model_capability(model_id) or {}
        rows.append(
            RosterRow(
                provider=provider,
                model_id=model_id,
                native_tools=bool(cap.get("native_tools")),
                emit_tier=str(cap.get("emit_tier", "coerce")),
                forced_emission=cap.get("forced_emission"),
                # T-187-07-01: presence ONLY. The key value never leaves this expression.
                key_configured=bool(getattr(settings, f"{provider}_api_key", "")),
                group_size=len(model_ids),
            )
        )
    return sorted(rows, key=lambda r: r.provider)


ROSTER: list[RosterRow] = derive_roster()


# ══════════════════════════════════════════════════════════════════════════════
# The scoreboard — every row lands here BEFORE it can pass, fail, block or hang
# ══════════════════════════════════════════════════════════════════════════════


@dataclass
class RowResult:
    verdict: str  # "✅" | "❌" | "⛔"
    code: str  # machine-readable: ok / no-key / opt-in / supabase-unreachable / ...
    evidence: str


_RESULTS: dict[str, RowResult] = {}


def _record(row: RosterRow, verdict: str, code: str, evidence: str) -> None:
    _RESULTS[row.provider] = RowResult(verdict=verdict, code=code, evidence=evidence)


def _block(row: RosterRow, code: str, reason: str) -> None:
    """Record ⛔ with the reason + blocking id, THEN skip. Never silently omitted."""
    _record(row, "⛔", code, reason)
    pytest.skip(f"[{code}] {reason}")


def _scoreboard_markdown() -> str:
    lines = [
        "| Provider | Model id (derived) | native_tools | emit_tier | forced_emission | "
        "Key configured | Verdict | Evidence |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for row in ROSTER:
        res = _RESULTS.get(
            row.provider,
            RowResult("⛔", "not-run", "row was not executed in this session"),
        )
        lines.append(
            f"| {row.provider} | `{row.model_id}` | {row.native_tools} | {row.emit_tier} | "
            f"{row.forced_emission} | {row.key_configured} | {res.verdict} | "
            f"{res.code} — {res.evidence} |"
        )
    lines.append("")
    lines.append(f"Derived groups: {len(ROSTER)} (one representative each).")
    return "\n".join(lines)


@pytest.fixture(scope="module", autouse=True)
def _scoreboard_writer():
    """Always emit the FULL table at module teardown — including skipped and failed rows."""
    yield
    out = Path(os.environ.get(OUT_ENV) or (Path(tempfile.gettempdir()) / "phase187_roster_scoreboard.md"))
    table = _scoreboard_markdown()
    try:
        out.write_text(table, encoding="utf-8")
    except OSError:  # pragma: no cover — never fail a run over the artifact
        pass
    print("\n\n=== Phase 187 SC#10 roster scoreboard ===\n" + table + f"\n\n(written to {out})\n")


# ══════════════════════════════════════════════════════════════════════════════
# Live-environment resolution
# ══════════════════════════════════════════════════════════════════════════════


def _supabase_url() -> str:
    return str(_DOTENV.get("SUPABASE_URL") or "").strip()


def _supabase_key() -> str:
    return str(_DOTENV.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()


def _supabase_reachable() -> bool:
    url, key = _supabase_url(), _supabase_key()
    if not url or not key:
        return False
    try:
        import httpx

        resp = httpx.get(f"{url.rstrip('/')}/rest/v1/", headers={"apikey": key}, timeout=3.0)
        return resp.status_code < 500
    except Exception:  # noqa: BLE001 — unreachable is a verdict input, never an error
        return False


def _make_supabase():
    from supabase import create_client

    return create_client(_supabase_url(), _supabase_key())


def _resolve_user_id(supabase) -> str:
    """A real user id for the grounding reads. ``load_user_settings`` ignores it
    (``user_settings.py:970`` delegates straight to ``load_app_settings``), but
    ``_assemble_grounding`` scopes the folder tree and skill registry by it."""
    explicit = (os.environ.get(USER_ID_ENV) or str(_DOTENV.get(USER_ID_ENV) or "")).strip()
    if explicit:
        return explicit
    try:
        res = supabase.table("profiles").select("id").limit(1).execute()
        if res.data:
            return str(res.data[0]["id"])
    except Exception:  # noqa: BLE001
        pass
    return "00000000-0000-0000-0000-000000000000"


# ══════════════════════════════════════════════════════════════════════════════
# Tests
# ══════════════════════════════════════════════════════════════════════════════


def test_roster_is_derived_from_the_live_registry() -> None:
    """T-187-07-02 — the completeness + derive-never-retype guard. Runs ALWAYS.

    Cheap, offline, and the only thing standing between a registry edit and a silently
    shrunken scoreboard.
    """
    groups = group_models_by_provider()

    assert len(groups) >= 8, (
        f"MODEL_CAPABILITIES now groups into {len(groups)} providers ({sorted(groups)}); "
        "CLAUDE.md's roster rule requires the FULL native roster plus OpenRouter (>= 8). "
        "A provider was removed from the registry, or `provider` was misspelt on its rows."
    )
    for expected in ("deepseek", "moonshot"):
        assert expected in groups, (
            f"provider group {expected!r} missing from MODEL_CAPABILITIES — this is one of "
            "the two groups the 187-SPEC's hand parse got wrong; its absence means the "
            "board is measuring fewer providers than the app ships."
        )
    assert len(ROSTER) == len(groups), "one representative per group, no more, no less"
    assert len({r.provider for r in ROSTER}) == len(ROSTER), "duplicate provider in the roster"


def test_every_roster_row_is_registry_backed() -> None:
    """An id the SHIPPING lookup misses resolves ``inferred`` and loses ``emit_tier`` — the
    row would then measure a weaker configuration than the one that ships (SEED-135). The
    registry is case-sensitive, so this also pins the ``MiniMax``-style capitalisation."""
    from app.config import get_model_capability

    for row in ROSTER:
        cap = get_model_capability(row.model_id) or {}
        assert cap.get("capability_source") == "registry", (
            f"{row.provider} representative {row.model_id!r} resolves "
            f"capability_source={cap.get('capability_source')!r} — not registry-backed. "
            "Check the id's capitalisation against MODEL_CAPABILITIES."
        )
        assert cap.get("provider") == row.provider


@pytest.mark.parametrize("row", ROSTER, ids=[r.provider for r in ROSTER])
async def test_generated_definition_names_every_step(row: RosterRow) -> None:
    """SC#10 — one REAL generation per provider group; every phase must carry a ``name``.

    ``settings`` is a stub scoped to this row (zero global mutation, zero contamination).
    """
    if not os.environ.get(OPT_IN_ENV):
        _block(row, "opt-in", f"{OPT_IN_ENV} not set — live provider calls are opt-in")
    if not row.key_configured:
        _block(row, "no-key", f"no {row.provider}_api_key configured in this environment")
    if not _supabase_reachable():
        _block(
            row,
            "supabase-unreachable",
            f"SUPABASE_URL from {_ENV_FILE.name} is unset or unreachable — grounding "
            "assembly would degrade to an empty folder/skill registry",
        )

    from app.models.harness import WorkflowDefinition
    from app.services.workflow_authoring import generate_workflow_definition

    supabase = _make_supabase()
    user_id = _resolve_user_id(supabase)
    timeout = float(os.environ.get(TIMEOUT_ENV) or DEFAULT_ROW_TIMEOUT_S)

    try:
        result = await asyncio.wait_for(
            generate_workflow_definition(
                describe=DESCRIBE,
                supabase=supabase,
                user_id=user_id,
                # THE point of this file: a per-row settings stub. `settings` is a
                # PARAMETER of the service, so nothing global is touched and the rows are
                # independent of each other and of the operator's environment.
                settings=SimpleNamespace(harness_authoring_model=row.model_id),
            ),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        _record(row, "❌", "timeout", f"no emission within {timeout:.0f}s")
        pytest.fail(f"{row.provider}: generation exceeded {timeout:.0f}s")
    except Exception as exc:  # noqa: BLE001 — an honest failure is a recorded verdict
        _record(row, "❌", "raised", f"{type(exc).__name__}: {exc}")
        raise

    if not result.get("ok"):
        _record(
            row,
            "❌",
            str(result.get("error") or "not_ok"),
            str(result.get("detail") or "")[:300],
        )
        pytest.fail(
            f"{row.provider} ({row.model_id}, emit_tier={row.emit_tier}): generation failed "
            f"— error={result.get('error')!r} detail={result.get('detail')!r}"
        )

    # SC#3 — the extra="forbid" discriminated union IS the safety mechanism (T-187-07-05).
    wd = WorkflowDefinition.model_validate(result["definition"])

    unnamed = [p.slug for p in wd.phases if not (p.name or "").strip()]
    seeded = [p.slug for p in wd.phases if p.name_seeded_by_ai]
    if unnamed:
        _record(
            row,
            "❌",
            "unnamed-phase",
            f"{len(unnamed)}/{len(wd.phases)} phases had no name: {unnamed}",
        )
    else:
        _record(
            row,
            "✅",
            "ok",
            f"{len(wd.phases)} phases, every one named "
            f"({len(seeded)} stamped name_seeded_by_ai); "
            f"names: {[p.name for p in wd.phases]}",
        )

    assert not unnamed, (
        f"{row.provider} ({row.model_id}): {len(unnamed)} of {len(wd.phases)} phases carry "
        f"no name — offending slugs: {unnamed}. The per-step name instruction in "
        "AUTHORING_SYSTEM_PROMPT did not survive this provider's emission path."
    )
    assert wd.phases, f"{row.provider}: emitted a definition with zero phases"
