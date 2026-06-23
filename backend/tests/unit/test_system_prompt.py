"""Phase 122 Plan 04 (TDP-01) — string-presence guard for the shared SYSTEM_PROMPT.

The ungated `execute_code.description` nudge (D-122-08) is a one-bullet, provider-agnostic
prompt instruction telling the model to set a short, SPECIFIC description for what its code
produces (never a generic phrase like "Run code"). The user sees that label live in the
workspace panel.

This guard pins the exact shipped phrase so the nudge cannot be silently deleted from the
G-5 hot file `agent_loop.py` (T-122-04-01 mitigation). It mirrors the
`inspect`/source-grep guard style of `test_gateway_forcing.py`.
"""


def test_system_prompt_has_execute_code_label_nudge():
    """The shared SYSTEM_PROMPT carries the ungated execute_code.description nudge.

    Asserts the load-bearing fragments of the exact phrase the plan ships so a silent
    deletion (or a watering-down to a generic instruction) fails CI:
      - it targets the `description` field,
      - it instructs a "specific label",
      - it forbids the generic "Run code" phrase,
      - it grounds the why in the "workspace panel" the user sees.
    """
    from app.services.agent_loop import SYSTEM_PROMPT

    lower = SYSTEM_PROMPT.lower()
    # Targets the description field with a specific-label instruction.
    assert "description" in SYSTEM_PROMPT
    assert "specific label" in lower
    # Forbids the generic phrase (the floor TDP-01 lifts every provider above).
    assert "run code" in lower
    # Grounds the why — the user sees this label live in the workspace panel.
    assert "workspace panel" in lower


def test_execute_code_nudge_is_provider_agnostic():
    """The nudge must NOT add Anthropic-specific extraction.

    BUG-260528-03's stated cause is WRONG — `tool_args_progress` is already cross-provider
    in all 3 adapters (D-122-08). The nudge is a single, provider-agnostic instruction in
    the SHARED prompt; it must not branch by provider name.
    """
    from app.services import agent_loop

    prompt = agent_loop.SYSTEM_PROMPT
    # No provider-name special-casing leaked into the shared prompt nudge.
    for token in ("anthropic", "openai-only", "tool_args_progress"):
        assert token not in prompt.lower(), token
