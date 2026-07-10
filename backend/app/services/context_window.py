"""Context window management — token estimation and sliding-window trimming.

Uses tiktoken cl100k_base for OpenAI models (gpt-*, o1, o3) when tiktoken is installed;
falls back to a character-based heuristic (1 token ~ 4 chars) for all other providers.
"""
from __future__ import annotations

import json
import logging

from app.config import settings, PROVIDER_CONTEXT_DEFAULTS, MODEL_CONTEXT_DEFAULTS, get_model_capability

logger = logging.getLogger(__name__)

try:
    import tiktoken as _tiktoken
    _TIKTOKEN_AVAILABLE = True
    _CL100K: "tiktoken.Encoding | None" = None
except ImportError:
    _tiktoken = None  # type: ignore[assignment]
    _TIKTOKEN_AVAILABLE = False
    _CL100K = None
    logger.warning(
        "tiktoken not installed — token estimation uses chars/4 heuristic. "
        "Install with: pip install tiktoken"
    )


def _get_cl100k() -> "tiktoken.Encoding | None":
    """Return cached cl100k_base encoder, or None if tiktoken unavailable.

    Called once at module load to warm the encoder cache and avoid
    first-request latency (tiktoken downloads vocab on first call).
    """
    global _CL100K
    if _CL100K is None and _TIKTOKEN_AVAILABLE:
        _CL100K = _tiktoken.get_encoding("cl100k_base")  # type: ignore[union-attr]
    return _CL100K


# Warm encoder at startup to avoid first-request latency (Pitfall 3 from RESEARCH.md)
_get_cl100k()


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

# Phase 123-02 CTX-03 (A3 default — Claude's-discretion-tunable). Pinned load_skill
# tool-result groups are kept out of the trim loop as a THIRD protected class
# (alongside the system message and the reserve_recent tail), but they are capped
# at this fraction of max_tokens so pinning can never starve the recent-message
# budget (T-123-02-01 / Pitfall 5). Over budget → evict the least-recently-loaded
# pinned skill + insert the honest _TRIM_MARKER (never silent — D-14).
PIN_BUDGET_FRACTION = 1.0 / 3


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


def estimate_tokens(text: str | None, model: str = "") -> int:
    """Estimate token count. Uses tiktoken cl100k_base for OpenAI models when available.

    Falls back to chars/4 heuristic for all other providers or when tiktoken
    is not installed. The `model` parameter is optional — omitting it gives chars/4.

    Plan 075.4-02 D-075.4-NN: registry-driven gate. Replaces the hardcoded
    ``model.startswith("gpt-") or model.startswith(("o1", "o3"))`` heuristic with
    ``get_model_capability(model).get("provider") == "openai"``. Unregistered
    OpenAI models routed via the inference layer (``_infer_provider_for`` matches
    ``gpt-*`` / ``o1-9-`` patterns) still resolve to ``provider="openai"`` and
    hit the tiktoken path; non-OpenAI models fall through to chars/4 as before.

    Args:
        text: String to estimate. Returns 0 for None/empty.
        model: Model ID (e.g. "gpt-4o"). Empty string or non-OpenAI → chars/4.
    """
    if not text:
        return 0
    if model and get_model_capability(model).get("provider") == "openai":
        enc = _get_cl100k()
        if enc is not None:
            return max(1, len(enc.encode(text)))
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

    trimmed_any = False

    # Phase 123-02 CTX-03 — pull pinned load_skill groups out of `rest` as a THIRD
    # protected class (kept like the protected tail, never entered into the trimmable
    # removal loop). This happens BEFORE the protected-tail split so a skill loaded
    # near the front of the conversation still survives. The atomic-group partition
    # MIRRORS _remove_oldest_atomic's grouping rules so a pinned group always carries
    # its assistant+tool_calls parent alongside its tool-result (Pitfall 2 — never an
    # orphaned tool message). De-dupe to the latest group per skill, cap total pinned
    # at PIN_BUDGET_FRACTION * max_tokens, and evict the least-recently-loaded pinned
    # group on overflow with the honest _TRIM_MARKER (D-14 — never silent).
    pinned_groups, rest, pin_trimmed = _extract_pinned_skill_groups(rest, max_tokens)
    pinned_msgs = [m for group in pinned_groups for m in group]
    if pin_trimmed:
        trimmed_any = True

    # Protected tail — always kept
    if reserve_recent > 0 and len(rest) > reserve_recent:
        protected = rest[-reserve_recent:]
        trimmable = list(rest[:-reserve_recent])
    else:
        protected = rest[:]
        trimmable = []

    # Keep trimming until we fit or there's nothing left to trim
    while trimmable:
        candidate_messages = _build_candidate(
            system_msg, trimmable, protected, trimmed_any, pinned_msgs
        )
        if estimate_messages_tokens(candidate_messages) <= max_tokens:
            break

        # Remove oldest atomic unit from trimmable
        n_removed = _remove_oldest_atomic(trimmable)
        if n_removed == 0:
            # Nothing left to remove
            break
        trimmed_any = True

    # Phase 078 CQ-CTX-01 D-078-01: after trimmable is exhausted, progressively
    # trim oldest protected messages inward. Hard floor: system_msg + last user msg.
    # Mirrors Claude.ai / ChatGPT behavior (silently drops older turns, never errors).
    # D-078-02: no error raised — always return a valid list that fits.
    if not trimmable:
        while len(protected) > 1:
            candidate = _build_candidate(system_msg, [], protected, True, pinned_msgs)
            if estimate_messages_tokens(candidate) <= max_tokens:
                break
            n_removed = _remove_oldest_atomic(protected)
            if n_removed == 0:
                break
            trimmed_any = True

    return _build_candidate(system_msg, trimmable, protected, trimmed_any, pinned_msgs)


def _atomic_groups(rest: list[dict]) -> list[list[dict]]:
    """Partition `rest` into atomic message groups, MIRRORING _remove_oldest_atomic.

    An atomic group is:
    - A single user/assistant message (without tool_calls), or
    - An assistant message with tool_calls PLUS all immediately following tool-role
      messages that reference those tool_call IDs, or
    - A lone tool-role message (parent already absent — kept as its own group so it
      is never silently merged into an unrelated turn).
    """
    groups: list[list[dict]] = []
    i = 0
    n = len(rest)
    while i < n:
        msg = rest[i]
        role = msg.get("role", "")
        if role == "assistant" and msg.get("tool_calls"):
            tool_ids = {tc.get("id") for tc in msg["tool_calls"] if tc.get("id")}
            group = [msg]
            j = i + 1
            while j < n and rest[j].get("role") == "tool" and rest[j].get("tool_call_id") in tool_ids:
                group.append(rest[j])
                j += 1
            groups.append(group)
            i = j
        else:
            groups.append([msg])
            i += 1
    return groups


def _extract_pinned_skill_groups(
    rest: list[dict],
    max_tokens: int,
) -> tuple[list[list[dict]], list[dict], bool]:
    """Phase 123-02 CTX-03 — pull pinned load_skill groups out of `rest`.

    A group is "pinned" if it contains a tool-result message carrying the
    ``_pinned_skill`` flag (set in agent_loop._reconstruct_history — never by
    sniffing the tool-result JSON). The flag value is the skill name, used for
    de-dupe. Returns ``(pinned_groups, remaining_rest, trimmed_any)``:

    - ``pinned_groups`` — kept verbatim out of the trim loop, in original order.
    - ``remaining_rest`` — every non-pinned group (plus de-duped/evicted pinned
      groups demoted back) flattened in original order, ready for the existing
      protected-tail split + trimmable removal loop.
    - ``trimmed_any`` — True if any pinned group was demoted (de-dupe or LRU
      eviction), so the caller inserts the honest _TRIM_MARKER.

    De-dupe keeps the LATEST group per skill name (Pitfall 3). The summed token
    estimate of the surviving pinned groups is capped at PIN_BUDGET_FRACTION *
    max_tokens; over budget, the least-recently-loaded (lowest original index)
    pinned group is evicted back into ``remaining_rest`` until the cap holds
    (T-123-02-01 — pinning never starves the recent-message budget).
    """
    groups = _atomic_groups(rest)

    # Identify pinned groups and the skill each pins.
    pinned_idx_to_skill: dict[int, str] = {}
    for gi, group in enumerate(groups):
        for m in group:
            if m.get("role") == "tool" and m.get("_pinned_skill"):
                pinned_idx_to_skill[gi] = m["_pinned_skill"]
                break

    if not pinned_idx_to_skill:
        # Fast path — no pins present → behavior is byte-identical to pre-CTX-03.
        return [], rest, False

    trimmed_any = False

    # De-dupe: keep only the LATEST group index per skill name; older duplicates
    # are demoted back into the trimmable pool.
    latest_idx_by_skill: dict[str, int] = {}
    for gi in sorted(pinned_idx_to_skill):
        latest_idx_by_skill[pinned_idx_to_skill[gi]] = gi
    kept_idx = set(latest_idx_by_skill.values())
    if len(kept_idx) < len(pinned_idx_to_skill):
        trimmed_any = True

    # Budget cap (LRU eviction): evict least-recently-loaded (lowest index) pinned
    # groups until the surviving pins fit within PIN_BUDGET_FRACTION * max_tokens.
    pin_budget = int(PIN_BUDGET_FRACTION * max_tokens)
    surviving = sorted(kept_idx)
    while surviving:
        pinned_flat = [m for gi in surviving for m in groups[gi]]
        if estimate_messages_tokens(pinned_flat) <= pin_budget:
            break
        # Evict the least-recently-loaded (lowest original index) pinned group.
        surviving.pop(0)
        trimmed_any = True

    surviving_set = set(surviving)
    pinned_groups = [groups[gi] for gi in surviving]
    remaining_rest = [
        m for gi, group in enumerate(groups) if gi not in surviving_set for m in group
    ]
    return pinned_groups, remaining_rest, trimmed_any


def _build_candidate(
    system_msg: dict | None,
    trimmable: list[dict],
    protected: list[dict],
    add_marker: bool,
    pinned: list[dict] | None = None,
) -> list[dict]:
    """Assemble the messages list from components.

    Phase 123-02 CTX-03: pinned load_skill groups are placed right after the
    system message (and the trim marker, if any) and BEFORE the trimmable +
    protected sections — kept like the protected tail, never trimmed.
    """
    result: list[dict] = []
    if system_msg:
        result.append(system_msg)
    if add_marker and trimmable is not None:
        # Only add marker if there WAS something trimmed (trimmable can still have content
        # but it was partially trimmed, or it was completely cleared)
        result.append({"role": "user", "content": _TRIM_MARKER})
    if pinned:
        result.extend(pinned)
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
        # Also remove any immediately following sibling tool messages with same parent.
        # Guard: only match on non-None IDs — if tool_call_id is None we cannot
        # reliably distinguish siblings from unrelated tool messages, so stop at one.
        tool_call_id = first.get("tool_call_id")
        if tool_call_id is not None:
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
