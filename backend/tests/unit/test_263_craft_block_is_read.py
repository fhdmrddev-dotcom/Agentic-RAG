"""Phase 263 (PACK-15 / D-263-13) — ⛔ THIS FILE IS THE DELIVERABLE, not a test of a feature.

PACK-15 asks for *reuse* of `skill-creator`, not a second authoring engine. D-263-04's literal
wording — "drive `skill-creator`" — was refuted by measurement: the row's `instructions` are a
seven-step INTERACTIVE HUMAN INTERVIEW LOOP ("Move one step at a time and keep the user in
control"), it names tools a sealed forced-emit shot cannot expose, and its step 3 tells the model
to call the skill-saving tool — which conflicts with the forced emitter AND with D-263-03's "the
write path is the existing POST /skills". D-263-13 is the operator-ratified correction: reuse it
as DATA — its craft block, read from the DB at call time — never as an engine.

⭐ WITHOUT THIS FILE, "we reused `skill-creator`" IS A SENTENCE. With it, it is a measurement:

  - Stub the DB read to `""` and NO craft doctrine survives in the composed system prompt. If the
    module had inlined the doctrine as module prose — which is exactly the shape
    `skill_proposer_service._PROPOSER_SYSTEM_PROMPT` has, and exactly what this fence refuses —
    the tokens would still be there and this assertion goes red.
  - The positive arm (block supplied ⇒ all six tokens present) is what stops the fence passing by
    asserting nothing. A fence with only a negative arm is satisfied by a module that composes an
    empty string.

⚠ THE SIX TOKENS ARE DERIVED FROM THE LIVE DB ROW, NOT TRANSCRIBED FROM A MIGRATION FILE. That
distinction has already cost this phase twice: `263-RESEARCH.md` quoted migration 087 when 089 had
rewritten the row, and `263-02-PLAN.md` / `263-PATTERNS.md` then named 089 as live when — measured
against the live row at `263-02` — **093** (`093_skill_creator_sandbox_library_awareness.sql`) had
rewritten it again and added a SIXTH craft bullet. The live-read fence next door
(`tests/integration/test_263_craft_block_live_read.py`) is what keeps that honest; these six are
the tokens present in 087, 089 AND 093, which is what makes them safe to pin here.
"""

from __future__ import annotations

import pathlib

import pytest

import app.services.skill_body_authoring as mod
from app.services.skill_body_authoring import (
    AuthoredSkillBody,
    SkillBodyAuthoringDisabled,
    _extract_craft_block,
    author_skill_body,
)

_MODULE_SOURCE = pathlib.Path(
    __file__
).resolve().parents[2] / "app" / "services" / "skill_body_authoring.py"

# Present in migrations 087, 089 AND 093's rewrites of the row — see the module docstring.
# `Progressive disclosure` is pinned as a PREFIX: 089 extended that bullet's heading to
# "Progressive disclosure — but know the limit."
CRAFT_TOKENS = (
    "Apply this craft",
    "Imperative form",
    "Explain the why, sparingly",
    "overfit",
    "pushy-but-honest",
    "Progressive disclosure",
)

# The agent-tool choreography that must NEVER reach a body-authoring prompt: it is false in
# this context (a proposal is instructions-only; SEED-104 file attachment is deferred) and it
# would instruct the model to call tools this sealed shot does not expose.
TOOL_TOKENS = (
    "save_skill",
    "workspace_write",
    "read_skill_file",
    "search_documents",
    "execute_code",
    "Skill Studio",
    "Skills page",
)

# A craft block shaped like the live one: doctrine bullets, plus a fifth that MIXES doctrine
# with tool choreography (that mixing is real — it is migration 089's fifth bullet).
_FAKE_CRAFT_BLOCK = (
    "Apply this craft (it is what makes skills work or fail):\n"
    "- **Imperative form.** Write directives to the agent.\n"
    "- **Explain the why, sparingly.** A short reason beats a wall of MUST rules.\n"
    "- **Generalize, don't overfit.** Describe the shape of the task.\n"
    "- **A pushy-but-honest description.** Never claim more than the skill does.\n"
    "- **Progressive disclosure — but know the limit.** Keep the core instructions lean.\n"
)


def _async_return(value):
    async def _inner(*_args, **_kwargs):
        return value

    return _inner


def _wire_happy_path(monkeypatch, *, craft_block: str, emitted):
    """Patch every seam around the one thing under test, and return the capture box.

    ``forced_emit`` is patched in THIS module's namespace (it is a top-level import), so the
    box records the exact kwargs the real provider call would have received — that is what
    makes the prompt assertions a measurement of the shipped call rather than of a helper.
    """
    box: dict = {}

    async def _fake_forced_emit(**kwargs):
        box["kwargs"] = kwargs
        return {"emitted": emitted}

    monkeypatch.setattr(mod, "forced_emit", _fake_forced_emit)
    monkeypatch.setattr(mod, "_load_craft_block", _async_return(craft_block))
    monkeypatch.setattr(mod, "resolve_skill_builder_model", lambda _s: "claude-haiku-4-5-20251001")
    monkeypatch.setattr("app.models.user_settings.self_improve_enabled", lambda: True)
    return box


async def _author(**overrides):
    kwargs = {
        "pool": object(),
        "skill_name": "contract-risk-register",
        "skill_description": "Draft a structured risk register from a commercial contract.",
        "why_needed": "The Expert's blueprint requires a repeatable risk-extraction procedure.",
        "expert_name": "Senior Commercial Counsel",
        "expert_description": "Reviews contracts and produces defensible risk assessments.",
        "user_settings": object(),
    }
    kwargs.update(overrides)
    return await author_skill_body(**kwargs)


# ── Fence 1: the doctrine is BORROWED, not owned ────────────────────────────────


async def test_stubbed_empty_craft_block_leaves_zero_doctrine_in_the_prompt(monkeypatch):
    """⛔ THE FENCE. Stub the DB read to empty; the composed system prompt must carry NONE of
    the craft doctrine — because the module contributes none of its own."""
    box = _wire_happy_path(monkeypatch, craft_block="", emitted={"instructions": "x", "summary": "y"})

    await _author()

    prompt = box["kwargs"]["system_prompt"]
    # Still NON-EMPTY: Anthropic rejects an empty system block with a 400, so "contributes no
    # doctrine" must not degrade into "sends no system prompt".
    assert prompt.strip(), "system prompt must stay non-empty even with no craft block"
    leaked = [t for t in CRAFT_TOKENS if t in prompt]
    assert leaked == [], f"module contributed its own craft doctrine: {leaked}"


async def test_supplied_craft_block_reaches_the_prompt_intact(monkeypatch):
    """The positive arm — without it, a module composing an empty string would pass above."""
    box = _wire_happy_path(
        monkeypatch, craft_block=_FAKE_CRAFT_BLOCK, emitted={"instructions": "x", "summary": "y"}
    )

    await _author()

    prompt = box["kwargs"]["system_prompt"]
    missing = [t for t in CRAFT_TOKENS if t not in prompt]
    assert missing == [], f"borrowed doctrine did not reach the prompt: {missing}"


async def test_the_emitter_and_schema_are_the_ones_this_module_declares(monkeypatch):
    """The shot is a forced emission of the flat, single-typed body model — not a chat turn."""
    box = _wire_happy_path(monkeypatch, craft_block="", emitted={"instructions": "x", "summary": "y"})

    await _author()

    kwargs = box["kwargs"]
    assert kwargs["emitter"] == "emit_skill_body"
    assert kwargs["schema_model"] is AuthoredSkillBody
    assert kwargs["strict"] is False
    assert kwargs["tools"][0]["function"]["name"] == "emit_skill_body"


# ── The extraction itself ───────────────────────────────────────────────────────


def test_extraction_strips_tool_choreography_but_keeps_the_doctrine():
    """⚠ The strip is REQUIRED, not defensive. The live fifth bullet mixes authoring doctrine
    with agent-tool choreography ON ONE LINE, so a whole-line strip would take
    `Progressive disclosure` out with it and a naive slice would carry `workspace_write` into a
    prompt where it is false. Both failure modes are asserted here at once."""
    instructions = (
        "## 3. Draft\n"
        "Write the instructions, then call `save_skill`. " + _FAKE_CRAFT_BLOCK.replace(
            "- **Progressive disclosure — but know the limit.** Keep the core instructions lean.\n",
            "- **Progressive disclosure — but know the limit.** Keep the core instructions lean. "
            "Prefer inlining content, since you have no tool to attach a file yourself — only the "
            "user can, via the upload option on the Skills page. `workspace_write` saves to a "
            "scratch area; a file there will 404 on `read_skill_file`.\n",
        )
        + "\n## 4. Evaluate honestly\nPoint the user to run the eval.\n"
    )

    block = _extract_craft_block(instructions)

    assert block, "the craft block must be found"
    survived = [t for t in TOOL_TOKENS if t in block]
    assert survived == [], f"agent-tool choreography leaked into the craft block: {survived}"
    missing = [t for t in CRAFT_TOKENS if t not in block]
    assert missing == [], f"doctrine was destroyed by the strip: {missing}"
    assert "## 4. Evaluate honestly" not in block, "the slice ran past the next heading"


def test_absent_heading_returns_empty_never_a_partial_slice():
    """A partial slice is worse than nothing: it would ship half a doctrine as if it were whole."""
    assert _extract_craft_block("## 1. Interview\nAsk focused questions.\n") == ""
    assert _extract_craft_block("") == ""


# ── D-263-14: only GENERATION is gated ──────────────────────────────────────────


async def test_flag01_off_refuses_before_any_model_resolution_or_db_read(monkeypatch):
    """⚠ POLARITY TRAP: `self_improve_enabled()` swallows read failures and returns True
    (default-ON, D-Q4), so a "disabled" case must PATCH THE FUNCTION — simulating a DB blip
    would assert the opposite of what it looks like it asserts."""
    box = _wire_happy_path(monkeypatch, craft_block="", emitted={"instructions": "x", "summary": "y"})

    reached: list[str] = []

    async def _spy_load(*_a, **_kw):
        reached.append("db")
        return ""

    monkeypatch.setattr(mod, "resolve_skill_builder_model", lambda _s: reached.append("model"))
    monkeypatch.setattr(mod, "_load_craft_block", _spy_load)
    monkeypatch.setattr("app.models.user_settings.self_improve_enabled", lambda: False)

    with pytest.raises(SkillBodyAuthoringDisabled):
        await _author()

    assert "kwargs" not in box, "a disabled path must never reach the provider"
    assert reached == [], f"the gate is not the FIRST statement — reached {reached}"


# ── The honest floor: None, never a fabricated body ─────────────────────────────


async def test_no_builder_model_returns_none_and_never_calls_the_provider(monkeypatch):
    box = _wire_happy_path(monkeypatch, craft_block="", emitted={"instructions": "x", "summary": "y"})
    monkeypatch.setattr(mod, "resolve_skill_builder_model", lambda _s: None)

    assert await _author() is None
    assert "kwargs" not in box, "no model resolved must mean no paid provider call"


async def test_emitted_none_is_returned_as_none_not_invented(monkeypatch):
    _wire_happy_path(monkeypatch, craft_block=_FAKE_CRAFT_BLOCK, emitted=None)

    assert await _author() is None


# ── Fence 3: this module authors, it does not WRITE (D-263-03) ──────────────────


def test_the_module_never_writes_a_skills_row():
    """The write path is the existing POST /skills. A module that both authored and persisted
    would be the second engine PACK-15 refuses, and would bypass that route's guards."""
    source = _MODULE_SOURCE.read_text(encoding="utf-8")
    for forbidden in ("INSERT INTO", "UPDATE public.skills", '.table("skills")', "DELETE FROM"):
        assert forbidden not in source, f"{forbidden!r} found — this module must not write"
    assert "SELECT instructions FROM public.skills" in source, "the craft read must be a SELECT"
