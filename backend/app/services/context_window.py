"""Context window management — token estimation and sliding-window trimming.

Uses a character-based token estimation heuristic (1 token ~ 4 chars for English).
No external API calls or tiktoken dependency required — runs in <1ms.
"""
from __future__ import annotations

import json
import logging

from app.config import settings, PROVIDER_CONTEXT_DEFAULTS, MODEL_CONTEXT_DEFAULTS

logger = logging.getLogger(__name__)


def _parse_model_limits(raw: str) -> dict[str, int]:
    """Parse 'model-id=tokens,model-id=tokens' into a dict.

    Uses = as separator to avoid ambiguity with model IDs that contain colons
    (e.g. minimax/minimax-m2.5:free).
    """
    result: dict[str, int] = {}
    for entry in raw.split(","):
        entry = entry.strip()
        if "=" not in entry:
            continue
        model, _, raw_tokens = entry.partition("=")
        model = model.strip()
        try:
            result[model] = int(raw_tokens.strip())
        except ValueError:
            pass
    return result

# Marker inserted after the system prompt when history is trimmed
_TRIM_MARKER = (
    "[Earlier conversation history was trimmed to fit context window. "
    "Some prior context may be missing.]"
)


def resolve_context_budget(active_provider: str, model: str = "") -> int:
    """Return context budget for main agent based on active model and provider.

    Priority:
    1. CONTEXT_WINDOW_MAX_TOKENS env var if set (non-zero) — global override
    2. MODEL_CONTEXT_LIMITS env var — per-model override (format: model-id=tokens,...)
    3. MODEL_CONTEXT_DEFAULTS — hardcoded per-model practical limits
    4. PROVIDER_CONTEXT_DEFAULTS — per-provider fallback
    5. 100,000 absolute fallback
    """
    if settings.context_window_max_tokens > 0:
        return settings.context_window_max_tokens

    if model:
        env_overrides = _parse_model_limits(settings.model_context_limits)
        if model in env_overrides:
            return env_overrides[model]
        if model in MODEL_CONTEXT_DEFAULTS:
            return MODEL_CONTEXT_DEFAULTS[model]

    return PROVIDER_CONTEXT_DEFAULTS.get(active_provider, 100_000)


def estimate_tokens(text: str | None) -> int:
    """Estimate token count for a string using chars/4 heuristic.

    Returns 0 for None or empty strings.
    """
    if not text:
        return 0
    return max(1, len(text) // 4)


def estimate_messages_tokens(messages: list[dict]) -> int:
    """Estimate total token count for a list of OpenAI-format messages.

    Accounts for:
    - Message role (~1 token each)
    - Content string
    - tool_calls JSON (if present)
    - 4 tokens of OpenAI per-message overhead
    """
    total = 0
    for msg in messages:
        # Per-message overhead (OpenAI adds tokens for role, delimiters)
        total += 4

        # Role token
        total += 1

        # Content
        content = msg.get("content")
        if content:
            total += estimate_tokens(content)

        # Tool calls (serialized to JSON for estimation)
        # JSON is punctuation-heavy ({, ", :, [) so tokenises at ~3 chars/token not 4
        tool_calls = msg.get("tool_calls")
        if tool_calls:
            total += max(1, len(json.dumps(tool_calls)) // 3)

    return total


def trim_messages_to_fit(
    messages: list[dict],
    max_tokens: int,
    reserve_recent: int = 10,
) -> list[dict]:
    """Trim oldest non-system messages to fit within max_tokens.

    Rules:
    - System message (index 0, role="system") is ALWAYS preserved.
    - The last `reserve_recent` messages are ALWAYS preserved.
    - Oldest messages in the trimmable section are removed first.
    - Tool call sequences are removed atomically: removing an assistant message
      with tool_calls also removes all immediately following tool-role messages
      that reference those tool_call IDs, and vice versa.
    - After any trimming, a synthetic user message is inserted after the system
      prompt to signal context loss to the LLM.
    - Returns messages unchanged if already within max_tokens.

    Args:
        messages: Full messages list (system + history).
        max_tokens: Maximum allowed token count.
        reserve_recent: Number of trailing messages to always preserve.

    Returns:
        Trimmed (or unchanged) messages list.
    """
    if not messages:
        return messages

    # Fast path — already fits
    if estimate_messages_tokens(messages) <= max_tokens:
        return messages

    # Separate system message
    if messages[0].get("role") == "system":
        system_msg: dict | None = messages[0]
        rest = messages[1:]
    else:
        system_msg = None
        rest = messages[:]

    # Protected tail — always kept
    if reserve_recent > 0 and len(rest) > reserve_recent:
        protected = rest[-reserve_recent:]
        trimmable = list(rest[:-reserve_recent])
    else:
        protected = rest[:]
        trimmable = []

    trimmed_any = False

    # Keep trimming until we fit or there's nothing left to trim
    while trimmable:
        candidate_messages = _build_candidate(system_msg, trimmable, protected, trimmed_any)
        if estimate_messages_tokens(candidate_messages) <= max_tokens:
            break

        # Remove oldest atomic unit from trimmable
        n_removed = _remove_oldest_atomic(trimmable)
        if n_removed == 0:
            # Nothing left to remove
            break
        trimmed_any = True

    # Final build — add marker if any trimming occurred
    if trimmed_any or (
        trimmable == [] and estimate_messages_tokens(
            _build_candidate(system_msg, [], protected, False)
        ) > max_tokens
    ):
        trimmed_any = True

    return _build_candidate(system_msg, trimmable, protected, trimmed_any)


def _build_candidate(
    system_msg: dict | None,
    trimmable: list[dict],
    protected: list[dict],
    add_marker: bool,
) -> list[dict]:
    """Assemble the messages list from components."""
    result: list[dict] = []
    if system_msg:
        result.append(system_msg)
    if add_marker and trimmable is not None:
        # Only add marker if there WAS something trimmed (trimmable can still have content
        # but it was partially trimmed, or it was completely cleared)
        result.append({"role": "user", "content": _TRIM_MARKER})
    result.extend(trimmable)
    result.extend(protected)
    return result


def _remove_oldest_atomic(trimmable: list[dict]) -> int:
    """Remove the oldest atomic message group from the start of trimmable (in-place).

    An atomic group is:
    - A single user/assistant message (without tool_calls)
    - An assistant message with tool_calls PLUS all immediately following tool-role
      messages that reference those tool_call IDs
    - A tool-role message PLUS its parent assistant+tool_calls message and any
      sibling tool messages (to avoid orphaned tool results)

    Returns the number of messages removed.
    """
    if not trimmable:
        return 0

    first = trimmable[0]
    first_role = first.get("role", "")

    # Case: assistant message with tool_calls → remove it plus all its tool results
    if first_role == "assistant" and first.get("tool_calls"):
        tool_ids = {tc.get("id") for tc in first["tool_calls"] if tc.get("id")}
        # Collect the assistant message itself
        to_remove = 1
        # Collect immediately following tool messages that reference these IDs
        for msg in trimmable[1:]:
            if msg.get("role") == "tool" and msg.get("tool_call_id") in tool_ids:
                to_remove += 1
            else:
                break
        del trimmable[:to_remove]
        return to_remove

    # Case: tool message at the start (orphaned or parent already removed upstream)
    # Remove it plus look backwards — but since we only trim from the start, we
    # need to also pull the parent assistant+tool_calls block if it precedes this.
    # In practice, since we process front-to-back, a tool message at index 0 means
    # its parent was already removed (shouldn't happen in well-formed history).
    # Just remove it to avoid orphan errors.
    if first_role == "tool":
        to_remove = 1
        # Also remove any immediately following sibling tool messages with same parent
        tool_call_id = first.get("tool_call_id")
        for msg in trimmable[1:]:
            if msg.get("role") == "tool" and msg.get("tool_call_id") == tool_call_id:
                to_remove += 1
            else:
                break
        del trimmable[:to_remove]
        return to_remove

    # Default: plain message, remove just the first one
    del trimmable[0]
    return 1
