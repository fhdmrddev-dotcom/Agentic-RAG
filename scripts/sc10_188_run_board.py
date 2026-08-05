"""sc10_188_run_board.py — Phase 188 SC#10 cross-provider scoreboard driver.

CLAUDE.md's "UAT scoreboard recipe" binds this phase: the FULL native roster plus
OpenRouter — eight rows — and the roster is **derived by executing the registry**,
never transcribed (D-188-24). This script is the board's engine. It does three jobs:

  1. DERIVES the roster from ``app.config.MODEL_CAPABILITIES`` at run time (group by
     ``provider``, newest **registry-backed** id per group), printing the tie-break and
     each id's ``capability_source`` / ``emit_tier`` so a row measuring an ``inferred``
     configuration is visible rather than assumed.
  2. PROBES per-provider API-key availability BEFORE driving anything, by calling the
     very function whose failure mode is the trap — ``override_provider``.
  3. DRIVES one workflow run per provider and reads every verdict back from the
     DATABASE (``workflow_runs`` / ``workflow_phases`` / ``runs``), never from the UI.

⚠ THE THREE MEASURED TRAPS (188-RESEARCH.md Open Question 1 — inherited, not re-derived).
   Each one makes a naive board LIE, and each is handled explicitly below:

   T1. **Per-request ``model`` does NOT reach a harness phase; ``provider`` DOES.**
       ``wf_ctx.model = resolve_workflow_ctx_model(user_settings)`` reads
       ``user_settings.llm_model`` — never ``body.model`` (sub_agent_models.py:231-259).
       **So this board measures the PROVIDER axis, not the model axis.** A passing row is
       evidence about a provider SDK path; it is NOT evidence about the model id in the
       "requested" column. The board therefore records the EFFECTIVE model read back from
       the sub-agent ``runs`` rows (D-188-26).

   T2. **``override_provider`` fails SILENTLY without an API key.** It returns the
       settings **unchanged** when the target provider has no ``api_key``
       (user_settings.py:957-967), so a keyless row runs on the PREVIOUS provider and
       looks exactly like a pass. Two independent defences: the pre-flight probe below,
       and reading ``runs.provider`` back after. A requested-vs-effective mismatch is
       recorded ⛔ with its reason — never as a pass (T-188-11-01).

   T3. **``phase.config.model`` beats everything** (``_effective_model = phase.config.model
       or ctx.model``, phase_types.py:350-352). The default fixture
       (``research_summarize``) was checked and pins NO per-phase model; a fixture that
       did would guarantee a cross-provider mismatch on every row.
       Corollary — OpenRouter is the one genuinely risky row:
       ``_SUB_AGENT_MODEL_DEFAULTS["openrouter"]`` is ``""`` and openrouter is a
       ``_FLEXIBLE_PROVIDER``, so the inferred-provider gate never fires and the saved
       ``llm_model`` passes through **unslashed** to the OpenRouter SDK → a likely 404.
       The pre-flight prints that prediction; ``--openrouter-definition-slug`` lets the
       operator point the row at a fixture that pins a registry-backed OpenRouter id.

WHAT EACH ROW ASSERTS — and nothing more (D-188-25): the run reaches a terminal state,
and the per-node readings the canvas would paint AT that terminal state are correct
(``canvasReading`` applied to each ``workflow_phases.status``). NOT emit quality, NOT
citation behaviour, NOT tool-call fidelity. Those belong to other boards.

NO GLOBAL SETTING IS MUTATED (T-188-11-02). Every row is driven with a per-request
``provider`` on ``POST /threads/{id}/messages`` — the Phase-185-proven non-mutating
method — so the operator's environment is untouched and rows cannot contaminate each
other.

SECRETS (T-188-11-03): the key probe reports PRESENCE ONLY. No key value, no
``llm_api_key`` field, no prefix and no length is ever printed.

EVERY PROVIDER APPEARS (T-188-11-04). A row may be ⛔ with its reason and blocking id.
**Silent omission is not available** — a scoreboard that lists only what passed is not a
scoreboard.

Plumbing: the five-piece kit is REUSED BY IMPORT from ``conc_probe.py`` (load_env →
assert_localhost_only FIRST → report_env_presence → get_bearer_token → connect_db), the
same way ``longmsg_workflow_smoke.py`` does. Same LOCALHOST HARD-GATE; constant-string
allowlisted SQL with %s params only. The operator starts uvicorn first.

Usage
-----
  # Roster + key probe only — no runs driven, no backend needed:
  cd backend && ./venv/Scripts/python.exe ../scripts/sc10_188_run_board.py --derive-only

  # The full 8-row board (operator starts uvicorn first):
  backend/venv/Scripts/python.exe scripts/sc10_188_run_board.py

  # One row, or a subset:
  backend/venv/Scripts/python.exe scripts/sc10_188_run_board.py --providers anthropic,google

Greppable markers: SC10_ROSTER / SC10_KEY / SC10_ROW / SC10_TABLE / SC10_RESULT.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

# ⛔ / ⚠ / ✅ are part of the board vocabulary — never let a cp1252 console kill the run.
try:  # pragma: no cover - console plumbing
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts"))
sys.path.insert(0, str(_REPO_ROOT / "backend"))  # cwd-independent `import app.*`

import conc_probe as kit  # noqa: E402 — five-piece plumbing kit (localhost-gated)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — plain module constants, mirroring conc_probe.py's discipline.
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_WORKFLOW_SLUG = "research_summarize"
DEFAULT_ROW_TIMEOUT_S = 900

# A realistic business ask — the board measures whether the run REACHES a terminal
# state and paints correctly, not what the answer says (D-188-25).
DEFAULT_PROMPT = (
    "Summarise the main risks a mid-size company faces when it moves its document "
    "storage to a cloud provider, and what it should check before signing."
)

# workflow_runs_status_check: active | paused | cap_paused | completed | failed | cancelled.
_TERMINAL_WORKFLOW_STATES = frozenset({"completed", "failed", "cancelled"})

# ⚠ MIRROR of the SHIPPED derivation in `frontend/src/lib/phaseState.ts`
# (`DB_PHASE_STATUS` → `phaseStatusFromDb` → `canvasReading`). It is duplicated here
# because this is a Python driver and that is a TypeScript module — the two must be
# changed in the SAME COMMIT if the mapping ever moves. Keys are exactly
# `workflow_phases_status_check` (pending | active | completed | failed | skipped),
# which is what makes the set closed; anything else is `unknown`, never `done`.
_DB_STATUS_TO_READING = {
    "pending": "not-started",
    "active": "running",
    "completed": "done",
    "failed": "failed",
    "skipped": "skipped",
}
# Readings a TERMINAL run may legitimately paint. `running` means a stranded `active`
# row; `unknown` means a status this client does not recognise. Neither is acceptable
# once the run has stopped.
_TERMINAL_OK_READINGS = frozenset({"done", "failed", "skipped", "not-started"})

# ─────────────────────────────────────────────────────────────────────────────
# Allowlisted constant SQL (T-096-07-04 posture): full constant strings, %s params only.
# ─────────────────────────────────────────────────────────────────────────────

_SQL_SUB_RUNS = (
    "SELECT run_id::text AS run_id, model, provider, status "
    "FROM runs WHERE parent_run_id = %s ORDER BY started_at"
)
_SQL_WF_ROW = (
    "SELECT status, model, thread_id::text AS thread_id "
    "FROM workflow_runs WHERE id = %s"
)
_SQL_PHASES = (
    "SELECT phase_index, slug, status FROM workflow_phases "
    "WHERE workflow_run_id = %s ORDER BY phase_index"
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Roster derivation — EXECUTED against MODEL_CAPABILITIES, never transcribed.
# ─────────────────────────────────────────────────────────────────────────────

def _version_key(model_id: str) -> tuple[int, ...]:
    """Sortable version tuple for a model id.

    The vendor prefix is dropped first (``z-ai/glm-5.2`` → ``glm-5.2``) so the version
    comes from the MODEL, not from whoever resells it. Every numeric run is flattened,
    so ``gpt-5.6-sol`` → ``(5, 6)`` and ``claude-opus-4-8`` → ``(4, 8)``, which is why
    ``claude-sonnet-5`` → ``(5,)`` correctly outranks it.
    """
    tail = model_id.rsplit("/", 1)[-1]
    parts: list[int] = []
    for token in re.findall(r"\d+(?:\.\d+)*", tail):
        parts.extend(int(p) for p in token.split("."))
    return tuple(parts)


def derive_roster() -> list[dict]:
    """Group MODEL_CAPABILITIES by provider; return the newest registry-backed id each.

    D-188-24. Nothing here is a literal provider list — the groups ARE whatever the
    registry currently holds, so a ninth provider appears on the board the day it is
    added rather than the day someone remembers to retype the table.

    Tie-break, stated because it is a judgement and not a fact: among ids sharing the
    top version (``gpt-5.6-sol`` / ``-terra`` / ``-luna``; ``deepseek-v4-flash`` /
    ``-pro``) the LAST-DECLARED wins, because the registry appends newer members of a
    family beneath their siblings. Every tied id is printed, so the choice is auditable.

    An id absent from the registry resolves ``capability_source=inferred`` and silently
    loses ``emit_tier`` — a row driven on one would measure a WEAKER configuration than
    the one that ships — so only ``registry`` ids are eligible.
    """
    from app.config import MODEL_CAPABILITIES

    groups: dict[str, list[str]] = defaultdict(list)
    for model_id, cap in MODEL_CAPABILITIES.items():
        groups[str(cap.get("provider", "?"))].append(model_id)

    roster: list[dict] = []
    for provider, ids in groups.items():
        eligible = [
            m for m in ids
            if MODEL_CAPABILITIES[m].get("capability_source") == "registry"
        ]
        pool = eligible or ids  # if a group somehow has no registry id, say so below
        top = max(_version_key(m) for m in pool)
        tied = [m for m in pool if _version_key(m) == top]
        chosen = tied[-1]  # last-declared among the tie
        cap = MODEL_CAPABILITIES[chosen]
        roster.append({
            "provider": provider,
            "model": chosen,
            "capability_source": str(cap.get("capability_source", "inferred")),
            "emit_tier": str(cap.get("emit_tier", "coerce")),
            "native_tools": bool(cap.get("native_tools", False)),
            "group_size": len(ids),
            "registry_backed_in_group": len(eligible),
            "tied": tied,
        })
    roster.sort(key=lambda r: r["provider"])
    return roster


def print_roster(roster: list[dict]) -> None:
    print(f"SC10_ROSTER groups={len(roster)} (derived by executing MODEL_CAPABILITIES)")
    for r in roster:
        tie = f" tied_with={r['tied']}" if len(r["tied"]) > 1 else ""
        print(
            f"SC10_ROSTER provider={r['provider']} newest={r['model']} "
            f"capability_source={r['capability_source']} emit_tier={r['emit_tier']} "
            f"native_tools={r['native_tools']} ids_in_group={r['group_size']} "
            f"registry_backed={r['registry_backed_in_group']}{tie}"
        )
    print()


# ─────────────────────────────────────────────────────────────────────────────
# 2. Key probe — run BEFORE any kickoff, using the function whose no-op is the trap.
# ─────────────────────────────────────────────────────────────────────────────

def load_effective_settings() -> tuple[object, str]:
    """The run owner's effective settings, plus how they were obtained.

    Prefers the ASYNC path because it reads the ``app_settings`` row (DB key > env key);
    the sync path sees env only when the cache is cold, which would under-report keys.
    """
    from app.models.user_settings import load_app_settings, load_app_settings_async

    try:
        import asyncio
        return asyncio.run(load_app_settings_async()), "app_settings (async, DB-backed)"
    except Exception as exc:  # pragma: no cover — cold DB / no pool
        print(
            f"SC10_KEY WARN async settings load failed ({type(exc).__name__}); "
            "falling back to the env-only sync path — a key held ONLY in app_settings "
            "would read as MISSING below."
        )
        return load_app_settings(), "env only (sync fallback)"


def probe_keys(roster: list[dict], settings) -> dict[str, dict]:
    """Per-provider key availability + the model each row will ACTUALLY run on.

    This is not a guess about env-var names: it calls ``override_provider`` itself — the
    exact function that silently no-ops on a missing key (T2) — and then
    ``resolve_workflow_ctx_model``, which is literally step 7-8 of the traced chain. So
    the pre-flight is an EXECUTION of the production path, not a model of it.

    PRESENCE ONLY (T-188-11-03): the returned dict carries booleans and model ids. No key
    value ever enters it.
    """
    from app.models.user_settings import override_provider
    from app.services.sub_agent_models import resolve_workflow_ctx_model
    from app.config import _SUB_AGENT_MODEL_DEFAULTS

    baseline_provider = getattr(settings, "active_provider", "")
    saved_model = getattr(settings, "llm_model", "")
    print(
        f"SC10_KEY baseline active_provider={baseline_provider} "
        f"saved_llm_model={saved_model!r} "
        "(⚠ the saved llm_model — NOT any --model you pass — is what reaches a phase)"
    )

    probe: dict[str, dict] = {}
    for entry in roster:
        pid = entry["provider"]
        overridden = override_provider(settings, pid)
        has_key = getattr(overridden, "active_provider", "") == pid
        predicted = resolve_workflow_ctx_model(overridden) if has_key else ""
        request_model = _SUB_AGENT_MODEL_DEFAULTS.get(pid) or entry["model"]
        probe[pid] = {
            "has_key": has_key,
            "predicted_effective_model": predicted,
            "request_model": request_model,
            "provider_default_empty": not _SUB_AGENT_MODEL_DEFAULTS.get(pid),
        }
        note = ""
        if not has_key:
            note = (
                f" ⛔ override_provider returned the settings UNCHANGED — this row would "
                f"run on '{baseline_provider}' and look like a pass"
            )
        elif probe[pid]["provider_default_empty"]:
            note = (
                f" ⚠ _SUB_AGENT_MODEL_DEFAULTS['{pid}'] is empty and '{pid}' is a flexible "
                f"provider — the saved llm_model passes through UNSLASHED (predicted 404); "
                f"pin phase.config.model via --openrouter-definition-slug to drive it"
            )
        print(
            f"SC10_KEY provider={pid} api_key={'present' if has_key else 'MISSING'} "
            f"request_model={request_model} "
            f"predicted_effective_model={predicted or '(none)'}{note}"
        )
    print()
    return probe


# ─────────────────────────────────────────────────────────────────────────────
# 3. Per-node readings — the SHIPPED canvas derivation, applied to DB truth.
# ─────────────────────────────────────────────────────────────────────────────

def canvas_reading(db_status: str) -> str:
    """`phaseStatusFromDb` ∘ `canvasReading`, for a phase with no pending ask.

    ``waiting-for-you`` is deliberately unreachable here: it is driven by a live
    ``pendingAsk``, which is a run-stream value and not a column. The fixtures this board
    drives carry no human-input phase, so a DB-only mirror is complete for them.
    """
    return _DB_STATUS_TO_READING.get(db_status, "unknown")


def check_readings(phases: list[dict], definition_phase_count: int) -> tuple[bool, str]:
    """At a terminal run, every node must read done/failed/skipped/not-started.

    A ``running`` reading means an ``active`` row was stranded; an ``unknown`` reading
    means a status this client does not recognise. Both are exactly what SPEC Req 3
    forbids the canvas to smooth over, so both fail the row rather than being footnoted.

    Definition phases with no ``workflow_phases`` row read ``not-started`` — the correct
    reading for a step the harness never reached — so a short spine is reported, not
    failed.
    """
    readings = [(p["phase_index"], p["slug"], p["status"], canvas_reading(p["status"]))
                for p in phases]
    bad = [r for r in readings if r[3] not in _TERMINAL_OK_READINGS]
    detail = " ".join(f"{i}:{slug}={st}->{rd}" for i, slug, st, rd in readings) or "(no phase rows)"
    if definition_phase_count and len(phases) < definition_phase_count:
        detail += (
            f" | {definition_phase_count - len(phases)} definition phase(s) have no row "
            "-> read 'not-started'"
        )
    if not phases:
        return False, "no workflow_phases rows at all — nothing to paint | " + detail
    if bad:
        return False, (
            "forbidden reading at a terminal run: "
            + ", ".join(f"{r[1]}={r[2]}->{r[3]}" for r in bad)
            + " | " + detail
        )
    return True, detail


# ─────────────────────────────────────────────────────────────────────────────
# 4. Driving one row.
# ─────────────────────────────────────────────────────────────────────────────

def _blocked_row(provider: str, request_model: str, reason: str, blocking_id: str) -> dict:
    return {
        "provider": provider,
        "request_model": request_model,
        "effective": "—",
        "terminal": "not driven",
        "readings_ok": None,
        "readings": "—",
        "verdict": "⛔",
        "reason": reason,
        "blocking_id": blocking_id,
    }


def drive_row(conn, token: str, entry: dict, probe: dict, args,
              definition_id: str, definition_phase_count: int) -> dict:
    """Drive one provider row and read its verdict back from the database."""
    pid = entry["provider"]
    request_model = probe[pid]["request_model"]

    thread_id = kit.create_thread(token, f"SC#10 188 board — {pid}")
    producer_run_id = kit.kickoff_workflow(
        token, thread_id, args.prompt, pid, request_model, definition_id
    )
    workflow_run_id = kit.resolve_workflow_run_id(conn, thread_id)
    print(f"SC10_ROW {pid} thread={thread_id} producer_run={producer_run_id} "
          f"workflow_run={workflow_run_id}")

    deadline = time.time() + args.timeout
    status = None
    while time.time() < deadline:
        status = kit.workflow_status(conn, workflow_run_id)
        if status in _TERMINAL_WORKFLOW_STATES:
            break
        time.sleep(2)
    terminal = status if status in _TERMINAL_WORKFLOW_STATES else f"NOT TERMINAL ({status})"

    sub_runs = kit._fetchall(conn, _SQL_SUB_RUNS, (producer_run_id,))
    phases = kit._fetchall(conn, _SQL_PHASES, (workflow_run_id,))
    readings_ok, readings_detail = check_readings(phases, definition_phase_count)

    effective_providers = sorted({str(r["provider"]) for r in sub_runs if r["provider"]})
    effective_models = sorted({str(r["model"]) for r in sub_runs if r["model"]})
    effective = (
        "/".join(["+".join(effective_providers) or "?", "+".join(effective_models) or "?"])
        if sub_runs else "no sub-agent runs row"
    )

    row = {
        "provider": pid,
        "request_model": request_model,
        "effective": effective,
        "terminal": terminal,
        "readings_ok": readings_ok,
        "readings": readings_detail,
        "verdict": "PASS",
        "reason": "",
        "blocking_id": "",
        "workflow_run_id": workflow_run_id,
    }

    # Ordered from "the evidence is absent" through "the evidence contradicts the
    # request" to "the run itself did not finish" — most specific failure first.
    if not sub_runs:
        row.update(
            verdict="⛔",
            reason=(
                "no sub-agent `runs` row under the producer — the EFFECTIVE provider "
                "cannot be read back, so this row proves nothing (RESEARCH A2: only "
                "`run_task_sub_agent` was traced to `insert_run`). Use a fixture with an "
                "`llm_agent` phase, or read LangSmith instead."
            ),
            blocking_id="SC10-188-NOEVIDENCE",
        )
    elif effective_providers != [pid]:
        row.update(
            verdict="⛔",
            reason=(
                f"requested provider '{pid}' but `runs.provider` says "
                f"{effective_providers} — `override_provider` silently no-oped (missing "
                "key) or the row was misrouted. This is the trap the read-back exists to "
                "catch; it is NEVER a pass."
            ),
            blocking_id="SC10-188-MISROUTE",
        )
    elif terminal != "completed":
        row.update(
            verdict="⛔",
            reason=f"workflow_runs.status={terminal} after {args.timeout}s",
            blocking_id="SC10-188-RUN",
        )
    elif not readings_ok:
        row.update(
            verdict="⛔",
            reason=f"per-node readings wrong at a terminal run — {readings_detail}",
            blocking_id="SC10-188-PAINT",
        )
    return row


# ─────────────────────────────────────────────────────────────────────────────
# 5. Emission — one row per DERIVED provider, whatever happened to it.
# ─────────────────────────────────────────────────────────────────────────────

_METHOD_NOTE = (
    "**Method — read this before reading any row.** Each row is driven with a "
    "**per-request `provider`** on `POST /threads/{id}/messages` with "
    "`workflow_definition_id` set. **No global setting is mutated**, so the operator's "
    "environment is untouched and rows cannot contaminate each other. "
    "⚠ **This board measures the PROVIDER axis, NOT the model axis:** the per-request "
    "`model` never reaches a harness phase (`ctx.model` reads `user_settings.llm_model`), "
    "so the *Requested id* column is bookkeeping and the *Effective* column — read back "
    "from the sub-agent `runs` rows — is the evidence. Verdicts come from "
    "`workflow_runs` / `workflow_phases` / `runs`, never from the UI. Each row asserts "
    "only that the run reached a terminal state and that the canvas readings at that "
    "state are correct (D-188-25) — not emit quality, not citations, not tool fidelity."
)


def emit_table(rows: list[dict]) -> None:
    print("\nSC10_TABLE — paste into 188-UAT.md\n")
    print(_METHOD_NOTE + "\n")
    print("| # | Provider | Requested id | Effective provider/model (from `runs`) | "
          "Terminal `workflow_runs.status` | Node readings correct | Verdict | Reason / blocking id |")
    print("|---|---|---|---|---|---|---|---|")
    for i, r in enumerate(rows, 1):
        readings = "—" if r["readings_ok"] is None else ("Y" if r["readings_ok"] else "N")
        reason = r["reason"] or ""
        if r["blocking_id"]:
            reason = f"{reason} · `{r['blocking_id']}`"
        print(
            f"| {i} | `{r['provider']}` | `{r['request_model']}` | {r['effective']} | "
            f"{r['terminal']} | {readings} | {r['verdict']} | {reason or '—'} |"
        )
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Entry point.
# ─────────────────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None):
    p = argparse.ArgumentParser(
        prog="sc10_188_run_board.py",
        description=(
            "Phase 188 SC#10 cross-provider board. Derives the roster from "
            "MODEL_CAPABILITIES, probes API-key availability, drives one workflow run "
            "per provider with a per-request provider (no global setting is mutated), "
            "and reads every verdict back from the database. A row may be ⛔ with its "
            "reason and blocking id; it is never silently omitted."
        ),
    )
    p.add_argument("--derive-only", action="store_true",
                   help="Print the derived roster + key probe and exit. Drives nothing.")
    p.add_argument("--providers", default="",
                   help="Comma-separated subset to DRIVE. Every derived provider still "
                        "appears in the emitted table — undriven ones as ⛔.")
    p.add_argument("--workflow-slug", default=DEFAULT_WORKFLOW_SLUG,
                   help=f"Fixture workflow (default: {DEFAULT_WORKFLOW_SLUG} — checked: "
                        "no phase pins config.model, and phase 0 is an llm_agent so a "
                        "sub-agent runs row exists to read the effective provider from).")
    p.add_argument("--openrouter-definition-slug", default="",
                   help="Optional fixture slug for the OpenRouter row ONLY, carrying a "
                        "registry-backed OpenRouter id in phase.config.model (see T3).")
    p.add_argument("--prompt", default=DEFAULT_PROMPT)
    p.add_argument("--timeout", type=int, default=DEFAULT_ROW_TIMEOUT_S,
                   help=f"Per-row wall-clock bound in seconds (default {DEFAULT_ROW_TIMEOUT_S}).")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    kit.load_env()
    kit.assert_localhost_only()  # HARD-GATE before any DB connection or HTTP call

    roster = derive_roster()
    print_roster(roster)

    settings, source = load_effective_settings()
    print(f"SC10_KEY settings_source={source}")
    probe = probe_keys(roster, settings)

    if args.derive_only:
        print("SC10_RESULT DERIVE-ONLY — roster + key probe printed; no row driven.")
        return 0

    only = {p.strip() for p in args.providers.split(",") if p.strip()}

    try:
        token = kit.get_bearer_token()
        conn = kit.connect_db()
    except kit.BackendUnavailable as e:
        print(f"\nCANNOT RUN: {e}")
        print("This board needs (1) local Supabase up and (2) the backend uvicorn "
              "running in a visible terminal. Start them, then re-run.")
        return 1

    rows: list[dict] = []
    try:
        definition_id, definition = kit.resolve_definition(conn, args.workflow_slug)
        phases_def = definition.get("phases") or []
        definition_phase_count = len(phases_def)
        pinned = [p.get("slug") for p in phases_def if (p.get("config") or {}).get("model")]
        print(f"Fixture: {args.workflow_slug} ({definition_phase_count} phases, "
              f"pinned config.model on {pinned or 'none'})")
        if pinned:
            print("⚠ This fixture PINS a per-phase model — `phase.config.model` beats "
                  "ctx.model (T3), so every cross-provider row would mismatch by "
                  "construction. Choose a fixture with no pin.")
            return 1
        print()

        for entry in roster:
            pid = entry["provider"]
            if only and pid not in only:
                rows.append(_blocked_row(
                    pid, probe[pid]["request_model"],
                    f"not driven in this invocation (--providers={args.providers})",
                    "SC10-188-NOTDRIVEN",
                ))
                continue
            if not probe[pid]["has_key"]:
                rows.append(_blocked_row(
                    pid, probe[pid]["request_model"],
                    f"no API key configured for {pid} — `override_provider` returns the "
                    "settings UNCHANGED, so driving this row would silently measure "
                    f"'{getattr(settings, 'active_provider', '?')}' and read as a pass",
                    "SC10-188-NOKEY",
                ))
                continue

            row_definition_id = definition_id
            row_phase_count = definition_phase_count
            if pid == "openrouter" and args.openrouter_definition_slug:
                row_definition_id, or_def = kit.resolve_definition(
                    conn, args.openrouter_definition_slug
                )
                row_phase_count = len(or_def.get("phases") or [])
                print(f"SC10_ROW openrouter using pinned fixture "
                      f"{args.openrouter_definition_slug}")

            try:
                rows.append(drive_row(conn, token, entry, probe, args,
                                      row_definition_id, row_phase_count))
            except kit.BackendUnavailable as e:
                rows.append(_blocked_row(
                    pid, probe[pid]["request_model"],
                    f"backend refused the kickoff: {e}", "SC10-188-KICKOFF",
                ))

        emit_table(rows)
        passed = sum(1 for r in rows if r["verdict"] == "PASS")
        blocked = len(rows) - passed
        print(f"SC10_RESULT rows={len(rows)} pass={passed} blocked={blocked} "
              f"(every derived provider appears — silent omission is not available)")
        return 0 if blocked == 0 else 2
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
