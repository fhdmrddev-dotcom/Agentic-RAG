"""Phase 193.2 Plan 08 (AUTH-03 / SC#1 / SC#2 / SC#4 / D-08 / D-20) — the k/N frequency harness.

WHAT THIS PROVES, AND THE ONLY SHAPE IN WHICH IT MAY BE STATED
    Plans ``193.2-05`` and ``193.2-07`` changed what a language model is ASKED to emit:
    the DELIVERABLE RULE now tells it that a step which pauses for a person makes the
    workflow unpublishable, and the same prompt now asks for a durable
    ``business_requirement``. Neither change is a contract. **D-08 makes this fix
    explicitly NON-DETERMINISTIC: when the model emits nothing the fallback is today's
    exact behaviour, so the phase may claim a MEASURED REDUCTION IN FREQUENCY and NEVER
    AN ABSENCE.**

    The rule, stated once here and again verbatim in ``193.2-FREQUENCY.md``:

        Baseline (pre-fix, from ``BUG-260815-01`` + ``193.1-11-SUMMARY.md``):
        ``business_requirement`` 0/N; ``llm_human_input`` 2/2 with a template, 4/6
        overall. Post-fix measured: k/N. The claim is a reduction, not an absence — the
        publish gate stays because a prompt cannot guarantee absence.

    ⚠ **NO CASE IN THIS FILE MAY ASSERT ABSENCE.** There is no
    ``assert llm_human_input not in ...`` and no ``assert business_requirement`` over a
    real call anywhere below. The DETERMINISTIC properties (the prompt literal, the
    schema, the stamp, the fallback) are already pinned by
    ``backend/tests/unit/test_workflow_authoring_requirement.py``. **Frequency is an
    ARTIFACT, not an assertion.** The single hard assertion permitted over driven output
    is the SC#4 control, and it is expressed as a FLOOR against 193.1's measured 3/3 —
    never against 100%. See ``_SC4_FLOOR_DESCRIPTION`` and the long note beside it.

TWO ARMS PER ROW — AND THE SECOND ONE EXISTS BECAUSE THE PLAN'S PREMISE WAS HALF FALSE
    ``193.2-08-PLAN.md`` says to reuse the 193.1 UAT kit's ten-field ``.docx`` *"so SC#2
    and SC#4 measure the same artefact"*. **Measured at plan time, that is FALSE, and it
    is recorded rather than smoothed:** 193.1's ``render_template`` **3/3** figure was
    driven on a DIFFERENT placeholder set — the eight-key *weekly project status* list
    (``193.1-UAT.md``, rows A/B/C) with its own describe string. Same kit folder,
    different artefact. A ten-field QBR arm therefore cannot be compared to 3/3 as an
    equality; only as a floor.

    The operator authorized a SECOND arm on that basis (checkpoint, 2026-08-15). So each
    driven row is measured TWICE:

      - **ARM ``kit10``** — the kit's ten-field ``Northwind-QBR-Template.docx``, parsed
        with the shipped parser, plus a QBR describe. What the plan asked for.
      - **ARM ``uat8``** — 193.1's exact eight keys and 193.1's exact describe string, so
        figure 3 is a **LIKE-FOR-LIKE comparison against its measured 3/3** and a
        3/3 -> 2/3 shaped degradation is DETECTABLE rather than silently clearing a
        strict-majority floor.

    ⚠ **If the two arms DISAGREE on figure 3, that disagreement is itself the finding.
    State it; never average it away.**

THE ROSTER IS NARROWED TO TWO, AND THE OTHER SIX ARE RECORDED — NEVER DROPPED (D-20)
    ``CLAUDE.md`` §"UAT scoreboard recipe" requires the full native roster plus
    OpenRouter. That rule is written for the CHAT path, where a per-request
    ``model``/``provider`` reaches the composer. **The authoring path is not that path.**
    ``resolve_authoring_model`` (``workflow_authoring.py:185-207``) returns
    ``settings.harness_authoring_model``, else the first of
    ``("claude-opus-4-8", "gpt-5.5")`` whose registry entry carries a truthy
    ``forced_emission`` — its own docstring says *"NOT the composer's selected model"*.
    ``harness_authoring_model`` has no ``app_settings`` column and no Settings UI, so in
    a shipping backend only those two ids are reachable. Scoring the other six would
    measure a configuration that does not ship — the exact error the roster rule itself
    warns about.

    So the board is **2 DRIVE rows + 6 recorded ⛔ N/A rows**, each N/A carrying its
    reason as a string. They are seeded into ``_RESULTS`` **at module import**, so the
    full eight-row table is emitted even if every driven row is skipped and even if the
    driven test is never collected. A scoreboard that lists only what passed is not a
    scoreboard; one that silently omits rows is worse.

WHAT IS COUNTED — FOUR FIGURES, AND THE FOURTH IS NOT IN THE PLAN
    Per driven row, per arm, over N calls:

      1. ``business_requirement`` non-empty                     — k/N  (SC#1)
      2. an ``llm_human_input`` phase present                   — k/N  (SC#2)
      3. a ``render_template`` phase present                    — k/N  (SC#4 CONTROL)
      4. an ``external_action`` phase present                   — k/N  (DISPLACEMENT)

    ⚠ **Figure 4 was added on an inherited finding from ``193.2-06``, not from the plan.**
    Plan 05's new clause forbids ``llm_human_input`` and ``ask_user``, so the model may
    DISPLACE onto ``external_action``, which the publish gate genuinely does not refuse
    (``_interactive_phase_failures`` matches exactly two shapes). **A displacement is
    NOT a publish failure and must never be reported as one:** the armed action-risk
    checkpoint is auto-continued on a golden run (``harness_engine.py:837``) and the send
    is skipped at ``phase_types.py`` GATE 1, so an ``external_action`` phase cannot wedge
    a publish. Widening the gate is FORBIDDEN — ``test_publish_service.py::
    test_the_armed_checkpoint_is_not_a_validator`` pins that emptiness deliberately
    (D-19 CONFLICT-1 Option B, REJECTED). The counter exists to make a composition SHIFT
    visible, nothing more.

    The ``ask_user`` validator count (the gate's SECOND refused shape) and the
    ``business_requirement_seeded_by_ai`` provenance flag (plan ``193.2-07``) are recorded
    per call alongside them, so plan ``193.2-09``'s visible mark is measured against
    something real rather than assumed.

ZERO GLOBAL MUTATION
    ``generate_workflow_definition`` takes ``settings`` as a PARAMETER
    (``workflow_authoring.py:323-333``) — the route happens to pass the app-level
    ``Settings``, but the function never reads a global. Each row therefore passes its own
    ``SimpleNamespace(harness_authoring_model=<row id>)`` stub. Nothing in this file
    patches or rebinds a module-level singleton, no ``app_settings`` row is written, and
    there is no way for one row to contaminate the next or to leave the operator's
    environment altered. This is copied verbatim from the 187 analog's device.

THE TEMPLATE IS THE REAL ARTEFACT, PARSED — NOT A HAND-TYPED NAME LIST (arm ``kit10``)
    ``BUG-260815-01`` measured the interactive composition **2 for 2 with a bound
    template**, so a describe alone would not reproduce the condition under test. Arm
    ``kit10``'s ten placeholder names are read out of the 193.1 UAT kit's own ``.docx``
    with the SHIPPED parser (``parse_docx_template_variables`` ->
    ``placeholder_names_from_parsed``), the same assembly both product doors use. A
    hand-typed list would be a second copy of the document's contents, free to drift.

    ⚠ Arm ``uat8``'s eight names ARE hand-copied, deliberately and with its reason: they
    are transcribed verbatim from ``193.1-UAT.md`` — the RECORD OF WHAT WAS DRIVEN — and
    the source document that produced them is not identified in the kit, so there is
    nothing to re-parse. For a like-for-like re-drive the measurement record is the
    correct source; for arm ``kit10`` the document is.

    ⚠ **Both describes deliberately OMIT the kit README's sentence "Do not add a step
    that asks me for input."** That sentence is UAT guidance for a human operator;
    including it would suppress the very thing SC#2 exists to measure and would make
    figure 2 a measurement of the INSTRUMENT rather than of the prompt change. It is an
    instrument choice, not an oversight, and it is guarded by
    ``test_no_driven_describe_pre_answers_the_measurement`` — which runs free, with no
    opt-in, on every describe constant in this file.

RUNNING IT (opt-in — this file makes REAL, PAID provider calls)
    The driven rows are gated on ``RUN_193_2_AUTHORING=1`` AND a reachable Supabase AND a
    readable template, so a plain ``pytest tests/ -q`` collects them, records them ⛔ with
    the reason, skips them, and makes zero network calls.

        cd backend
        RUN_193_2_AUTHORING=1 ./venv/Scripts/python.exe -m pytest \
            tests/integration/test_193_2_authoring_frequency.py -q -s

    ⚠ **COST CAP (operator-authorized, checkpoint 2026-08-15): 2 rows x 2 arms x N=5 =
    20 generations, worst case 40 provider calls** with the service's single retry. Do
    not exceed it without returning to the checkpoint.

    Knobs: ``FREQ_193_2_N`` (calls per row PER ARM, default 5, the plan's N >= 5),
    ``FREQ_193_2_USER_ID`` (else the first ``profiles`` row), ``FREQ_193_2_TIMEOUT``
    (per-call wall-clock ceiling, default 300 s), ``FREQ_193_2_OUT`` (scoreboard path),
    ``FREQ_193_2_TEMPLATE`` (the kit ``.docx``), ``FREQ_193_2_RAW`` (optional DIRECTORY
    for the raw emitted definitions — point it OUTSIDE the watched tree).

SKIP DESIGN — copied from the analog, and the reason is copied with it
    The gate is applied **per row INSIDE the test**, never as a module ``pytestmark``. A
    collection-time skip would also skip the registry guard (which needs no key, no
    network and no Supabase — a completeness guard that only runs under an opt-in cannot
    catch the registry edit it exists to catch), and it could not let a blocked row RECORD
    itself ⛔ before skipping.

SECRETS (T-193.2-08-A, the analog's T-187-07-01 rule copied verbatim)
    Provider keys are read through the shipped settings object and are never logged,
    printed, or written to the scoreboard. Key presence is recorded as a BOOLEAN only —
    ``key_configured=bool(getattr(settings, f"{provider}_api_key", ""))``. The key VALUE
    never leaves that expression. ``CallOutcome`` carries counters and the requirement's
    LENGTH, never its text, so grounded KB content cannot reach a committed artifact
    through the scoreboard.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from dataclasses import dataclass, field
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


OPT_IN_ENV = "RUN_193_2_AUTHORING"
N_ENV = "FREQ_193_2_N"
USER_ID_ENV = "FREQ_193_2_USER_ID"
TIMEOUT_ENV = "FREQ_193_2_TIMEOUT"
OUT_ENV = "FREQ_193_2_OUT"
TEMPLATE_ENV = "FREQ_193_2_TEMPLATE"
RAW_OUT_ENV = "FREQ_193_2_RAW"

DEFAULT_N = 5  # the plan's floor: N >= 5 per driven row, PER ARM
DEFAULT_CALL_TIMEOUT_S = 300.0

# The 193.1 UAT kit's template — arm ``kit10``'s artefact.
DEFAULT_TEMPLATE_PATH = r"C:\Users\fhdmr\Desktop\uat-193.1-qbr\template\Northwind-QBR-Template.docx"

# ── Arm ``kit10`` ──────────────────────────────────────────────────────────────
# Taken from the 193.1 UAT kit README step 2, MINUS its final sentence ("Do not add a
# step that asks me for input.") — see the module docstring. It names no skill and no
# folder, so the measurement is about the PROMPT and the grounding, not about grounding
# fidelity.
DESCRIBE_KIT10 = (
    "Produce a quarterly business review for our customer Northwind Logistics, covering "
    "Q3 2026. Use our knowledge base for their usage data, support history, meeting notes "
    "and commercial position."
)

# ── Arm ``uat8`` — 193.1's EXACT shape, so figure 3 is like-for-like ────────────
# Transcribed verbatim from ``193.1-UAT.md``: the describe used for its Calls A and B
# (deliberately SILENT about a template — post-D-26 the GROUNDING asserts provision, and
# that is precisely what 193.1-11 re-drove to 3/3), and the eight placeholder keys that
# drive produced. See the module docstring for why these are copied rather than parsed.
DESCRIBE_UAT8 = (
    "Produce a weekly project status report for stakeholders, built from our knowledge "
    "base. Gather the current status, risks and upcoming work, then produce the finished "
    "report document."
)
PLACEHOLDERS_UAT8: tuple[str, ...] = (
    "accomplishments",
    "milestones",
    "overall_rag_status",
    "planned_next",
    "project_name",
    "reporting_period",
    "risks_blockers",
    "summary",
)


@dataclass(frozen=True)
class Arm:
    """One measured condition. Two arms per driven row (see the module docstring)."""

    key: str
    describe: str
    label: str
    like_for_like_with_193_1: bool


ARMS: tuple[Arm, ...] = (
    Arm(
        key="kit10",
        describe=DESCRIBE_KIT10,
        label="the kit's 10-field Northwind-QBR-Template.docx (parsed) + a QBR describe",
        like_for_like_with_193_1=False,
    ),
    Arm(
        key="uat8",
        describe=DESCRIBE_UAT8,
        label="193.1's exact 8 keys + 193.1's exact describe — LIKE-FOR-LIKE with its 3/3",
        like_for_like_with_193_1=True,
    ),
)


# ── The SC#4 control's floor, and the reasoning that sets it ────────────────────
# 193.1 measured ``render_template`` present on **3 of 3** post-fix runs (and 6 of 6
# counting its declared accidental second triplet); its PRE-fix state was **0 of 3**.
# Those two are the only states ever measured on this branch. A STRICT MAJORITY separates
# them with margin: the pre-fix state fails it by construction, the post-fix state clears
# it.
#
# ⚠ WHY THE HARD ASSERTION IS NOT SET AT 100%, AND WHY THAT IS NOT A LOOPHOLE.
# D-08 forbids turning a language model's frequency into a pass/fail gate: a 4-of-5 arm
# would then RED on ordinary sampling noise and manufacture a regression that is not
# there — the exact dishonesty this file exists to prevent, only pointed the other way.
# So the ASSERTION is the floor, and the DETECTION the operator asked for is carried by
# the REPORT: the like-for-like arm's rate is compared against 193.1's 100% and any
# shortfall is flagged ``SC#4-DEGRADED`` in the row's evidence, in the emitted scoreboard
# and in ``193.2-FREQUENCY.md``. A 3/3 -> 2/3 shaped drop is therefore VISIBLE rather
# than silently clearing the floor — which is what "detectable" requires — without a
# stochastic test becoming a stochastic gate.
_SC4_FLOOR_DESCRIPTION = (
    "a strict majority of the successful calls (k*2 >= n) — 193.1 measured 3/3 post-fix "
    "against 0/3 pre-fix; this floor separates those two measured states and is NOT a "
    "claim of 100%"
)


def _sc4_floor_met(k: int, n: int) -> bool:
    """The SC#4 control floor: a strict majority of the successful calls."""
    return k * 2 >= n


# ══════════════════════════════════════════════════════════════════════════════
# The roster — 2 DRIVE + 6 recorded N/A (D-20)
# ══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class RosterRow:
    """One provider group's row. DRIVE rows carry a real, registry-resolved model id;
    N/A rows carry the REASON they are not a ``resolve_authoring_model`` candidate."""

    provider: str
    model_id: str | None
    drive: bool
    na_reason: str
    native_tools: bool = False
    emit_tier: str = ""
    forced_emission: Any = None
    key_configured: bool = False


# The reason string every N/A row shares, stated once so it cannot drift row to row.
_NOT_A_CANDIDATE = (
    "not a `resolve_authoring_model` candidate — the authoring model is "
    "`settings.harness_authoring_model` (env-only: no `app_settings` column, no Settings "
    "UI, needs a backend restart) or the first forced_emission-capable entry of "
    "('claude-opus-4-8', 'gpt-5.5'). Driving this provider would measure a configuration "
    "that does not ship"
)

# ⚠ The moonshot row carries an EXTRA finding, and it is recorded as NOT THIS PHASE'S.
# ``test_187_authoring_roster.py:44-52`` measured it: ``resolve_authoring_model``'s branch
# 1 returns ``settings.harness_authoring_model`` WITHOUT checking ``forced_emission`` /
# ``emit_tier``, so an explicitly-set moonshot model hands an UNFORCEABLE model to
# ``forced_emit(schema_model=WorkflowDefinition)``. That is a real finding about the knob
# (adjacent to open bug ``BUG-260731-01``); 193.2 changes nothing on that path.
_MOONSHOT_EXTRA = (
    " ALSO: an explicitly-set moonshot model hands an UNFORCEABLE model to `forced_emit` "
    "(`emit_tier: coerce`, no `forced_emission`; branch 1 of `resolve_authoring_model` "
    "does not validate). A REAL FINDING about the knob, adjacent to BUG-260731-01 — "
    "NOT this phase's, and recorded rather than dropped"
)

_NA_ROWS: tuple[tuple[str, str], ...] = (
    ("google", _NOT_A_CANDIDATE),
    ("deepseek", _NOT_A_CANDIDATE + " (`strict_json_schema` is also inert — D-122-04)"),
    ("zhipu", _NOT_A_CANDIDATE + " (GLM)"),
    ("minimax", _NOT_A_CANDIDATE),
    ("moonshot", _NOT_A_CANDIDATE + "." + _MOONSHOT_EXTRA),
    ("openrouter", _NOT_A_CANDIDATE + " (`native_tools: False` — the non-native tool path)"),
)

# The two ids ``resolve_authoring_model`` can actually return, read straight off the
# shipped resolver's fallback list. The registry guard asserts each resolves
# ``capability_source == 'registry'`` with a truthy ``forced_emission``.
_DRIVE_MODEL_IDS: tuple[str, ...] = ("claude-opus-4-8", "gpt-5.5")


def build_roster() -> list[RosterRow]:
    """The eight rows: two driven, six recorded N/A. Capability fields are read back
    through ``get_model_capability`` (NOT the raw dict) so a DRIVE row measures what the
    SHIPPING lookup sees — an id the lookup misses degrades to
    ``capability_source='inferred'``, silently loses ``emit_tier``, and would make the row
    measure a WEAKER configuration than the one that ships (SEED-135)."""
    from app.config import get_model_capability, settings

    rows: list[RosterRow] = []
    for model_id in _DRIVE_MODEL_IDS:
        cap = get_model_capability(model_id) or {}
        provider = str(cap.get("provider") or "unknown")
        rows.append(
            RosterRow(
                provider=provider,
                model_id=model_id,
                drive=True,
                na_reason="",
                native_tools=bool(cap.get("native_tools")),
                emit_tier=str(cap.get("emit_tier", "coerce")),
                forced_emission=cap.get("forced_emission"),
                # T-193.2-08-A: presence ONLY. The key value never leaves this expression.
                key_configured=bool(getattr(settings, f"{provider}_api_key", "")),
            )
        )
    for provider, reason in _NA_ROWS:
        rows.append(
            RosterRow(
                provider=provider,
                model_id=None,
                drive=False,
                na_reason=reason,
                key_configured=bool(getattr(settings, f"{provider}_api_key", "")),
            )
        )
    return rows


ROSTER: list[RosterRow] = build_roster()

# The (row, arm) pairs actually driven, plus the six N/A rows, as pytest parameters.
_PARAMS: list[tuple[RosterRow, Arm | None]] = [
    (row, arm) for row in ROSTER if row.drive for arm in ARMS
] + [(row, None) for row in ROSTER if not row.drive]
_PARAM_IDS: list[str] = [
    f"{row.provider}-{arm.key}" if arm else row.provider for row, arm in _PARAMS
]


# ══════════════════════════════════════════════════════════════════════════════
# The scoreboard — every row lands here BEFORE it can pass, fail, block or hang
# ══════════════════════════════════════════════════════════════════════════════


@dataclass
class CallOutcome:
    """One real ``generate_workflow_definition`` call, reduced to counters.

    Deliberately carries NO emitted prose (T-193.2-08-A): the requirement's LENGTH is
    recorded, its text is not, so grounded KB content cannot reach a committed artifact
    through this object.
    """

    index: int
    ok: bool
    error: str = ""
    requirement_present: bool = False
    requirement_chars: int = 0
    requirement_seeded_by_ai: bool = False
    llm_human_input: int = 0
    ask_user_validators: int = 0
    render_template: int = 0
    external_action: int = 0
    phase_types: list[str] = field(default_factory=list)


@dataclass
class ArmResult:
    verdict: str  # "✅" | "❌" | "⛔"
    code: str
    evidence: str
    calls: list[CallOutcome] = field(default_factory=list)


@dataclass
class RowResult:
    verdict: str  # "✅" | "❌" | "⛔"
    code: str  # machine-readable: ok / opt-in / no-key / supabase-unreachable / n-a / ...
    evidence: str


# The eight-row board (D-20) and the per-arm detail. Both are seeded at module IMPORT.
_RESULTS: dict[str, RowResult] = {}
_ARM_RESULTS: dict[tuple[str, str], ArmResult] = {}


def _kn(k: int, n: int) -> str:
    return f"{k}/{n}"


def _record_arm(row: RosterRow, arm: Arm, verdict: str, code: str, evidence: str,
                calls=None) -> None:
    _ARM_RESULTS[(row.provider, arm.key)] = ArmResult(
        verdict=verdict, code=code, evidence=evidence, calls=list(calls or [])
    )
    _refresh_row(row)


def _record_row(row: RosterRow, verdict: str, code: str, evidence: str) -> None:
    _RESULTS[row.provider] = RowResult(verdict=verdict, code=code, evidence=evidence)


def _refresh_row(row: RosterRow) -> None:
    """Recompute a DRIVE row's board verdict from its arms — worst verdict wins, and
    every arm's code appears, so a row can never read green while an arm is blocked."""
    arms = [(a, _ARM_RESULTS.get((row.provider, a.key))) for a in ARMS]
    verdicts = [r.verdict for _, r in arms if r]
    verdict = "⛔" if "⛔" in verdicts else ("❌" if "❌" in verdicts else "✅")
    codes = " · ".join(f"{a.key}: {r.code}" for a, r in arms if r)
    evidence = " ‖ ".join(f"[{a.key}] {r.evidence}" for a, r in arms if r)
    _record_row(row, verdict, codes, evidence)


def _block_arm(row: RosterRow, arm: Arm | None, code: str, reason: str) -> None:
    """Record ⛔ with the reason, THEN skip. Never silently omitted."""
    if arm is None:
        _record_row(row, "⛔", code, reason)
    else:
        _record_arm(row, arm, "⛔", code, reason)
    pytest.skip(f"[{code}] {reason}")


# ⚠ SEEDED AT MODULE IMPORT (D-20). The six N/A rows are recorded here, before any test
# runs, so the full eight-row table is emitted even when the driven test is never
# collected — e.g. a ``-k`` selection, a collection error, or a bare ``pytest -q`` that
# skips everything. "Record all eight; never drop six" cannot depend on a test executing.
for _row in ROSTER:
    if _row.drive:
        for _arm in ARMS:
            _ARM_RESULTS[(_row.provider, _arm.key)] = ArmResult(
                "⛔", "not-run", "arm was not executed in this session"
            )
        _refresh_row(_row)
    else:
        _record_row(_row, "⛔", "n-a", _row.na_reason)


def _scoreboard_markdown() -> str:
    lines = [
        "| # | Provider | Model id | Mode | native_tools | emit_tier | forced_emission | "
        "Key configured | Verdict | Evidence |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for i, row in enumerate(ROSTER, start=1):
        res = _RESULTS.get(
            row.provider,
            RowResult("⛔", "not-run", "row was not executed in this session"),
        )
        lines.append(
            f"| {i} | {row.provider} | `{row.model_id or '—'}` | "
            f"{'DRIVE' if row.drive else 'N/A'} | {row.native_tools} | "
            f"{row.emit_tier or '—'} | {row.forced_emission} | {row.key_configured} | "
            f"{res.verdict} | {res.code} — {res.evidence} |"
        )
    lines.append("")
    lines.append(
        f"Rows: {len(ROSTER)} ({sum(1 for r in ROSTER if r.drive)} DRIVE, "
        f"{sum(1 for r in ROSTER if not r.drive)} recorded N/A). "
        "D-20 — record all eight; never drop six."
    )
    lines.append("")
    lines.append(
        "⚠ D-08 — the claim is a REDUCTION, not an absence. When the model emits nothing "
        "the fallback is today's exact behaviour, so the publish gate stays."
    )

    for row in ROSTER:
        for arm in ARMS:
            res = _ARM_RESULTS.get((row.provider, arm.key))
            if not (res and res.calls):
                continue
            n = len(res.calls)
            ok_calls = [c for c in res.calls if c.ok]
            lines.append("")
            lines.append(
                f"### {row.provider} — `{row.model_id}` · arm `{arm.key}` · N = {n}"
            )
            lines.append("")
            lines.append(f"_{arm.label}_")
            lines.append("")
            lines.append("| Figure | k/N | Pre-fix baseline |")
            lines.append("|---|---|---|")
            lines.append(
                f"| `business_requirement` non-empty (SC#1) | "
                f"**{_kn(sum(1 for c in ok_calls if c.requirement_present), n)}** | 0/N |"
            )
            lines.append(
                f"| `business_requirement_seeded_by_ai` stamped (193.2-07) | "
                f"**{_kn(sum(1 for c in ok_calls if c.requirement_seeded_by_ai), n)}** | "
                "n/a — the field is new in this phase |"
            )
            lines.append(
                f"| an `llm_human_input` phase present (SC#2) | "
                f"**{_kn(sum(1 for c in ok_calls if c.llm_human_input), n)}** | "
                "2/2 with a template; 4/6 overall |"
            )
            lines.append(
                f"| an `ask_user` validator present (the gate's 2nd shape) | "
                f"**{_kn(sum(1 for c in ok_calls if c.ask_user_validators), n)}** | "
                "not measured pre-fix |"
            )
            lines.append(
                f"| a `render_template` phase present (SC#4 CONTROL) | "
                f"**{_kn(sum(1 for c in ok_calls if c.render_template), n)}** | "
                + ("193.1 measured **3/3** — LIKE-FOR-LIKE |"
                   if arm.like_for_like_with_193_1
                   else "193.1's 3/3 was a DIFFERENT artefact — floor only |")
            )
            lines.append(
                f"| an `external_action` phase present (DISPLACEMENT — **NOT** a publish "
                f"failure) | **{_kn(sum(1 for c in ok_calls if c.external_action), n)}** | "
                "not measured pre-fix |"
            )
            lines.append(f"| the call returned `ok` | **{_kn(len(ok_calls), n)}** | — |")
            lines.append("")
            lines.append(
                "| call | ok | req chars | seeded | human_input | ask_user | "
                "render_template | external_action | phase types |"
            )
            lines.append("|---|---|---|---|---|---|---|---|---|")
            for c in res.calls:
                lines.append(
                    f"| {c.index} | {'✅' if c.ok else '❌ ' + c.error} | "
                    f"{c.requirement_chars} | {c.requirement_seeded_by_ai} | "
                    f"{c.llm_human_input} | {c.ask_user_validators} | "
                    f"{c.render_template} | {c.external_action} | "
                    f"`{', '.join(c.phase_types) or '—'}` |"
                )
    return "\n".join(lines)


@pytest.fixture(scope="module", autouse=True)
def _scoreboard_writer():
    """Always emit the FULL table at module teardown — including skipped and N/A rows."""
    yield
    out = Path(
        os.environ.get(OUT_ENV)
        or (Path(tempfile.gettempdir()) / "phase193_2_frequency_scoreboard.md")
    )
    table = _scoreboard_markdown()
    try:
        out.write_text(table, encoding="utf-8")
    except OSError:  # pragma: no cover — never fail a run over the artifact
        pass
    # The file (UTF-8, above) is the artifact of record. The echo below is a convenience
    # and must never be able to fail the session: a Windows console is cp1252, and printing
    # a verdict glyph there raises UnicodeEncodeError in TEARDOWN — which pytest reports as
    # an ERROR on the last row, i.e. the scoreboard would corrupt the very board it prints.
    # Measured on this box 2026-08-02 (the 187 analog). Re-encode with a replacement char.
    banner = f"\n\n=== Phase 193.2 k/N authoring-frequency scoreboard ===\n{table}\n\n(written to {out})\n"
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    print(banner.encode(encoding, errors="replace").decode(encoding, errors="replace"))


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


def _template_path() -> Path:
    return Path(os.environ.get(TEMPLATE_ENV) or DEFAULT_TEMPLATE_PATH)


def read_template_placeholders() -> list[str]:
    """Arm ``kit10``'s ten field names, PARSED out of the real kit ``.docx`` with the
    shipped assembly both product doors use. Returns ``[]`` when the file is unreadable —
    the caller records that as a ⛔ block rather than driving a measurement that could not
    reproduce the condition under test."""
    from app.services.template_render_service import (
        parse_docx_template_variables,
        placeholder_names_from_parsed,
    )

    path = _template_path()
    try:
        data = path.read_bytes()
    except OSError:
        return []
    return list(placeholder_names_from_parsed(parse_docx_template_variables(data)) or [])


def arm_placeholders(arm: Arm) -> list[str]:
    """The placeholder names for an arm: parsed for ``kit10``, transcribed for ``uat8``."""
    if arm.key == "uat8":
        return list(PLACEHOLDERS_UAT8)
    return read_template_placeholders()


def _count(wd) -> dict:
    """Reduce ONE validated ``WorkflowDefinition`` to the counters this file reports."""
    phase_types = [str(getattr(p.config, "phase_type", "")) for p in wd.phases]
    requirement = wd.business_requirement or ""
    return {
        "phase_types": phase_types,
        "requirement_present": bool(requirement.strip()),
        "requirement_chars": len(requirement.strip()),
        "requirement_seeded_by_ai": bool(wd.business_requirement_seeded_by_ai),
        "llm_human_input": sum(1 for t in phase_types if t == "llm_human_input"),
        "render_template": sum(
            1
            for p in wd.phases
            if getattr(p.config, "phase_type", "") == "llm_emit"
            and getattr(p.config, "emitter", "") == "render_template"
        ),
        "external_action": sum(1 for t in phase_types if t == "external_action"),
        "ask_user_validators": sum(
            1
            for p in wd.phases
            for v in (p.validators or [])
            if str(getattr(v, "on_failure", "")) == "ask_user"
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Tests
# ══════════════════════════════════════════════════════════════════════════════


def test_the_board_records_all_eight_provider_groups() -> None:
    """D-20's completeness guard. Runs ALWAYS — no key, no network, no Supabase.

    Two properties, and the second is the one that would catch a silently shrunken board:
    the roster carries one row per LIVE registry provider group (derived from
    ``MODEL_CAPABILITIES``, never transcribed), and every non-driven row carries a
    non-empty REASON. Six rows recorded as N/A with reasons is the requirement; six rows
    dropped is the failure this guard exists to make impossible.
    """
    from app.config import MODEL_CAPABILITIES

    live_groups = {str(cap.get("provider")) for cap in MODEL_CAPABILITIES.values()}

    assert len(live_groups) >= 8, (
        f"MODEL_CAPABILITIES now groups into {len(live_groups)} providers "
        f"({sorted(live_groups)}); CLAUDE.md's roster rule requires the FULL native "
        "roster plus OpenRouter (>= 8)."
    )
    assert {r.provider for r in ROSTER} == live_groups, (
        "the board's providers must equal the live registry's provider groups — "
        f"board={sorted(r.provider for r in ROSTER)} registry={sorted(live_groups)}. "
        "A provider was added to or removed from MODEL_CAPABILITIES and the board did "
        "not follow it; D-20 requires all eight RECORDED, two driven and six N/A."
    )
    assert len(ROSTER) == 8, f"expected 8 rows, got {len(ROSTER)}"
    assert sum(1 for r in ROSTER if r.drive) == 2, "exactly two DRIVE rows (D-20)"

    for row in ROSTER:
        if row.drive:
            continue
        assert row.na_reason.strip(), (
            f"the N/A row {row.provider!r} carries no reason — a scoreboard that lists "
            "only what passed is not a scoreboard, and one that records a blocked row "
            "without its reason is not evidence."
        )
        assert _RESULTS[row.provider].evidence.strip(), (
            f"{row.provider!r} was not seeded into _RESULTS at import — the full table "
            "must be emitted even if no test executes."
        )

    moonshot = next(r for r in ROSTER if r.provider == "moonshot")
    assert "BUG-260731-01" in moonshot.na_reason, (
        "the moonshot row must carry the unforceable-model finding, marked NOT this "
        "phase's (test_187_authoring_roster.py:44-52)."
    )
    assert "NOT this phase" in moonshot.na_reason


def test_both_driven_rows_are_registry_backed() -> None:
    """An id the SHIPPING lookup misses resolves ``inferred``, silently loses
    ``emit_tier``, and would make the row measure a WEAKER configuration than the one
    that ships (SEED-135). Runs WITHOUT the opt-in — a configuration guard that only
    runs under a paid opt-in cannot catch the registry edit it exists to catch."""
    from app.config import get_model_capability

    for row in ROSTER:
        if not row.drive:
            continue
        cap = get_model_capability(row.model_id) or {}
        assert cap.get("capability_source") == "registry", (
            f"{row.provider} DRIVE row {row.model_id!r} resolves "
            f"capability_source={cap.get('capability_source')!r} — not registry-backed. "
            "Check the id's capitalisation against MODEL_CAPABILITIES."
        )
        assert cap.get("provider") == row.provider
        assert cap.get("forced_emission"), (
            f"{row.model_id!r} carries no truthy forced_emission — "
            "`resolve_authoring_model`'s fallback branch would skip it, so driving it "
            "would measure a path the resolver cannot take."
        )


def test_no_driven_describe_pre_answers_the_measurement() -> None:
    """A guard on the INSTRUMENT, not on the model. Runs always, costs nothing.

    The 193.1 UAT kit's README tells a human operator to add *"Do not add a step that asks
    me for input."* to the describe. A describe carrying that sentence would suppress the
    very composition SC#2 measures, and figure 2 would then be a measurement of the
    instrument rather than of the prompt change. Every arm's describe is swept, so a third
    arm added later inherits the guard instead of re-deriving it.

    ⚠ The ``not in`` below is asserted over a CONSTANT DEFINED IN THIS FILE, never over
    model output. It is not an absence claim about a language model, which D-08 forbids.
    """
    for arm in ARMS:
        lowered = arm.describe.lower()
        for banned in (
            "do not add a step",
            "asks me for input",
            "llm_human_input",
            "human input",
        ):
            assert banned not in lowered, (
                f"arm {arm.key!r}'s describe contains {banned!r} — it would pre-answer "
                "SC#2's measurement. Frequency must be measured against a NEUTRAL "
                "describe."
            )


def test_the_two_arms_are_a_real_comparison() -> None:
    """Non-vacuity on the arms themselves. Free, no opt-in.

    Exactly one arm may claim to be like-for-like with 193.1's 3/3, and the two arms must
    differ in BOTH variables (describe and placeholder set) — otherwise the "the arms
    disagree" finding the operator asked for could not exist, and the like-for-like claim
    would be decoration. The 193.1 key list is also pinned at eight, because that is the
    number its 3/3 was measured with.
    """
    assert len(ARMS) == 2
    assert sum(1 for a in ARMS if a.like_for_like_with_193_1) == 1, (
        "exactly one arm is the like-for-like re-drive of 193.1's 3/3"
    )
    assert ARMS[0].describe != ARMS[1].describe, "the two arms share a describe"
    assert len(PLACEHOLDERS_UAT8) == 8, (
        "193.1's measured 3/3 was driven on EIGHT keys (193.1-UAT.md); a different count "
        "here would silently stop being like-for-like."
    )
    assert len(set(PLACEHOLDERS_UAT8)) == 8, "duplicate key in the 193.1 transcription"


def test_positive_control_every_counter_can_actually_fire() -> None:
    """⚠ THE CONTROL THAT MAKES A ZERO READABLE. Free, no opt-in, no network.

    This file's headline results are ZEROES — ``llm_human_input`` 0/5,
    ``external_action`` 0/5, ``ask_user`` 0/5. **A zero from a blind counter and a zero
    from a model that did not compose the shape are indistinguishable in the artifact**,
    and this project's standing lesson is that a fence never driven RED has never been
    shown to see anything (193.1 found four such fences; all four were caught by PLANTING,
    none by reading). So ``_count`` is driven against a definition that PLANTS every shape
    it claims to see, and against the shape the real runs actually produced.

    It also pins the discrimination that matters: ``render_template`` counts the
    ``emitter``, NOT merely an ``llm_emit`` phase. A counter keyed on the phase type would
    report a healthy SC#4 control for a workflow emitting something else entirely.
    """
    from app.models.harness import WorkflowDefinition

    def _emit(emitter: str, index: int) -> dict:
        return {
            "slug": f"emit{index}",
            "phase_index": index,
            "config": {"phase_type": "llm_emit", "prompt": "fill it", "emitter": emitter},
        }

    gather = {
        "slug": "gather",
        "phase_index": 0,
        "config": {"phase_type": "llm_agent", "prompt": "x", "available_tools": []},
    }
    base = {"slug": "plant", "version": 1, "name": "plant", "status": "draft"}

    planted = _count(
        WorkflowDefinition.model_validate(
            {
                **base,
                # whitespace-only: the requirement counter must read this as ABSENT
                "business_requirement": "   ",
                "phases": [
                    gather,
                    {
                        "slug": "confirm",
                        "phase_index": 1,
                        "config": {"phase_type": "llm_human_input", "prompt": "ok?"},
                    },
                    _emit("render_template", 2),
                    {
                        "slug": "act",
                        "phase_index": 3,
                        "config": {
                            "phase_type": "external_action",
                            "capability": "send_email",
                        },
                    },
                    {
                        "slug": "check",
                        "phase_index": 4,
                        "config": {"phase_type": "llm_single", "prompt": "y"},
                        "validators": [
                            {
                                "kind": "regex_match",
                                "config": {"pattern": "X"},
                                "on_failure": "ask_user",
                            }
                        ],
                    },
                ],
            }
        )
    )
    assert planted["llm_human_input"] == 1, "the SC#2 counter cannot see a planted step"
    assert planted["render_template"] == 1, "the SC#4 control counter cannot see a plant"
    assert planted["external_action"] == 1, "the displacement counter cannot see a plant"
    assert planted["ask_user_validators"] == 1, "the ask_user counter cannot see a plant"
    assert planted["requirement_present"] is False, (
        "a whitespace-only requirement must read ABSENT — otherwise SC#1's k/N would "
        "count a blank as a success"
    )
    assert planted["requirement_chars"] == 0

    # The NEGATIVE half: the shape the 20 real calls produced. Both halves are needed —
    # a counter that always returns 1 would pass the plants above and prove nothing.
    shipped = _count(
        WorkflowDefinition.model_validate(
            {
                **base,
                "business_requirement": "Deliver a client-ready QBR from our records.",
                "phases": [gather, _emit("render_template", 1)],
            }
        )
    )
    assert shipped["llm_human_input"] == 0
    assert shipped["external_action"] == 0
    assert shipped["ask_user_validators"] == 0
    assert shipped["render_template"] == 1
    assert shipped["requirement_present"] is True

    # ``render_template`` keys on the EMITTER, never on the phase type.
    other = _count(
        WorkflowDefinition.model_validate(
            {**base, "phases": [gather, _emit("generic_docx", 1)]}
        )
    )
    assert other["render_template"] == 0, (
        "the SC#4 control counted an `llm_emit` phase whose emitter is NOT "
        "`render_template` — it would report a healthy template branch for a workflow "
        "that emits something else."
    )


@pytest.mark.parametrize("row,arm", _PARAMS, ids=_PARAM_IDS)
async def test_authoring_frequency(row: RosterRow, arm: Arm | None) -> None:
    """N real generations per DRIVE row PER ARM; four k/N figures recorded, never asserted.

    ``settings`` is a stub scoped to this row (zero global mutation, zero contamination).
    Every gate below RECORDS the row/arm before it skips, so a blocked one appears on the
    board with its reason instead of vanishing.
    """
    if arm is None:
        _block_arm(row, None, "n-a", row.na_reason)
    if not os.environ.get(OPT_IN_ENV):
        _block_arm(row, arm, "opt-in", f"{OPT_IN_ENV} not set — live paid provider calls are opt-in")
    if not row.key_configured:
        _block_arm(row, arm, "no-key", f"no {row.provider}_api_key configured in this environment")
    if not _supabase_reachable():
        _block_arm(
            row,
            arm,
            "supabase-unreachable",
            f"SUPABASE_URL from {_ENV_FILE.name} is unset or unreachable — grounding "
            "assembly would degrade to an empty folder/skill registry",
        )
    placeholders = arm_placeholders(arm)
    if not placeholders:
        _block_arm(
            row,
            arm,
            "template-unreadable",
            f"arm {arm.key!r} resolved no placeholder names (template path "
            f"{_template_path()}) — BUG-260815-01 measured the interactive composition "
            "2-for-2 WITH a template, so a describe alone would not reproduce the "
            "condition under test",
        )

    from app.models.harness import WorkflowDefinition
    from app.services.workflow_authoring import generate_workflow_definition

    supabase = _make_supabase()
    user_id = _resolve_user_id(supabase)
    n = max(1, int(os.environ.get(N_ENV) or DEFAULT_N))
    timeout = float(os.environ.get(TIMEOUT_ENV) or DEFAULT_CALL_TIMEOUT_S)

    calls: list[CallOutcome] = []
    raw: list[dict] = []

    for i in range(1, n + 1):
        try:
            result = await asyncio.wait_for(
                generate_workflow_definition(
                    describe=arm.describe,
                    supabase=supabase,
                    user_id=user_id,
                    template_placeholders=placeholders,
                    # THE point of this file: a per-row settings stub. `settings` is a
                    # PARAMETER of the service, so nothing global is touched, no
                    # app_settings row is written, and the rows are independent of each
                    # other and of the operator's environment.
                    settings=SimpleNamespace(harness_authoring_model=row.model_id),
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            calls.append(CallOutcome(index=i, ok=False, error="timeout"))
            _record_arm(row, arm, "❌", "timeout", f"call {i} exceeded {timeout:.0f}s", calls)
            continue
        except Exception as exc:  # noqa: BLE001 — an honest failure is a recorded verdict
            calls.append(CallOutcome(index=i, ok=False, error=type(exc).__name__))
            _record_arm(row, arm, "❌", "raised", f"call {i}: {type(exc).__name__}", calls)
            continue

        if result.get("ok"):
            # SC#3 of the 187 analog — the extra="forbid" discriminated union IS the
            # safety mechanism; a definition that does not validate is not a measurement.
            wd = WorkflowDefinition.model_validate(result["definition"])
            counted = _count(wd)
            calls.append(CallOutcome(index=i, ok=True, **counted))
            raw.append(result["definition"])
        else:
            calls.append(
                CallOutcome(index=i, ok=False, error=str(result.get("error") or "not_ok"))
            )
        # RECORD BEFORE VERDICT — after every call, so a crash mid-arm still leaves the
        # calls so far on the board.
        _record_arm(row, arm, "…", "in-progress", f"{len(calls)}/{n} calls made", calls)

    ok_calls = [c for c in calls if c.ok]
    k_requirement = sum(1 for c in ok_calls if c.requirement_present)
    k_seeded = sum(1 for c in ok_calls if c.requirement_seeded_by_ai)
    k_human = sum(1 for c in ok_calls if c.llm_human_input)
    k_askuser = sum(1 for c in ok_calls if c.ask_user_validators)
    k_template = sum(1 for c in ok_calls if c.render_template)
    k_external = sum(1 for c in ok_calls if c.external_action)

    # ⚠ THE DETECTION HALF OF SC#4, which the FLOOR alone cannot give (see
    # `_SC4_FLOOR_DESCRIPTION`). On the like-for-like arm, 193.1's measured rate is 3 of
    # 3 — so ANY shortfall against 100% of the successful calls is flagged in the
    # evidence, in the emitted scoreboard and in `193.2-FREQUENCY.md`, making a
    # 3/3 -> 2/3 shaped drop visible rather than silently clearing a majority floor.
    degraded = ""
    if arm.like_for_like_with_193_1 and ok_calls and k_template < len(ok_calls):
        degraded = (
            f" ⚠ SC#4-DEGRADED: like-for-like with 193.1's measured 3/3 (100%), this arm "
            f"measured {_kn(k_template, len(ok_calls))} of its successful calls"
        )

    evidence = (
        f"N={n} · ok {_kn(len(ok_calls), n)} · business_requirement {_kn(k_requirement, n)} "
        f"(seeded_by_ai {_kn(k_seeded, n)}) · llm_human_input {_kn(k_human, n)} "
        f"(ask_user validators {_kn(k_askuser, n)}) · render_template {_kn(k_template, n)} "
        f"[SC#4 control] · external_action {_kn(k_external, n)} [displacement, NOT a "
        f"publish failure] — D-08: a reduction, never an absence{degraded}"
    )
    _record_arm(
        row,
        arm,
        "✅" if ok_calls else "❌",
        "ok" if ok_calls else "no-successful-call",
        evidence,
        calls,
    )

    raw_dir = os.environ.get(RAW_OUT_ENV)
    if raw_dir and raw:
        try:
            Path(raw_dir).mkdir(parents=True, exist_ok=True)
            (Path(raw_dir) / f"{row.provider}-{arm.key}.json").write_text(
                json.dumps(raw, indent=2), encoding="utf-8"
            )
        except OSError:  # pragma: no cover — never fail a run over the artifact
            pass

    # ── The ONLY hard assertion permitted over driven output (D-08) ────────────────
    #
    # ⚠ READ THIS BEFORE ADDING A SIBLING ASSERTION. The three other figures above are
    # ARTIFACTS, not assertions: a frequency claim about a language model belongs in
    # `193.2-FREQUENCY.md` as k/N, and asserting one here would turn a non-deterministic
    # measurement into a flaky gate that manufactures a false regression. There is
    # deliberately NO assertion that `business_requirement` was populated and NO
    # assertion that `llm_human_input` was absent — the phase claims a REDUCTION, never
    # an absence, and the publish gate stays precisely because a prompt cannot guarantee
    # one.
    #
    # SC#4 is different in kind. It is a NO-REGRESSION CONTROL on a branch that was
    # already measured working: a prompt change that reduced `llm_human_input` by
    # BREAKING the template branch would be a regression dressed as a fix, and this is
    # the only figure that can see it. The ASSERTION is the floor; the DETECTION of a
    # smaller drop is the `SC#4-DEGRADED` flag above, which is reported rather than
    # thrown — see the long note at `_SC4_FLOOR_DESCRIPTION` for why a 100% assertion
    # would itself be dishonest.
    #
    # A row where NO call succeeded is a different failure and says so in its own words:
    # reporting it as "the SC#4 control fell" would blame the template branch for an
    # outage that never reached it.
    if len(ok_calls) == 0:
        pytest.fail(
            f"{row.provider} ({row.model_id}) arm {arm.key!r}: {n} of {n} calls failed — "
            f"{[c.error for c in calls]}. No frequency was measured for this arm; the "
            "SC#4 control was not reached and must not be read as having fallen."
        )
    assert _sc4_floor_met(k_template, len(ok_calls)), (
        f"SC#4 CONTROL FELL: a `render_template` phase was present on only "
        f"{_kn(k_template, len(ok_calls))} of the successful calls for "
        f"{row.provider} ({row.model_id}) on arm {arm.key!r} ({arm.label}). The floor is "
        f"{_SC4_FLOOR_DESCRIPTION}. 193.1 measured 3/3 post-D-26 with a bound template; "
        "a prompt change that reduced `llm_human_input` by breaking the template branch "
        "is a regression dressed as a fix, and the D-26 grounding arms must NOT be "
        "weakened to buy it."
    )
