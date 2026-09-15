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


# Share of a model's REAL context window reserved for the system prompt, the skill
# catalog and general slack. This one IS proportional — a bigger window generally
# carries a bigger system prompt — unlike the tool schemas, which are a FIXED cost
# and are therefore measured rather than estimated (see _tool_schema_tokens).
_PROMPT_OVERHEAD_FRACTION: float = 0.10

# Measured token cost of the advertised tool payload, cached per process.
_TOOL_SCHEMA_TOKENS: int | None = None


def _tool_schema_tokens() -> int:
    """Approximate token cost of the tool schemas sent on EVERY request.

    ``trim_messages_to_fit`` counts only the messages list, so this payload is
    invisible to it — yet it rides the same wire request and counts against the same
    window. Measured 2026-08-18: the default 28-tool Deep toolbox is ~6.9k tokens,
    i.e. 21% of a 32k local model's entire window before a single message.

    MEASURED, never hardcoded: an operator who disables web search / sandbox /
    self-improve ships a smaller toolbox, and a future phase that adds tools ships a
    bigger one. Both are reflected automatically. Cached per process because the
    toolbox only changes with capability flags, and this is called once per agent
    iteration. Returns 0 on any failure, which degrades to the pre-existing
    (unreserved) behaviour rather than raising on the hot path.
    """
    global _TOOL_SCHEMA_TOKENS
    if _TOOL_SCHEMA_TOKENS is None:
        try:
            # Lazy import — openai_service imports this module at module scope, so a
            # top-level import here would be a cycle.
            from app.services.openai_service import get_tools
            _TOOL_SCHEMA_TOKENS = estimate_tokens(json.dumps(get_tools()))
        except Exception:
            logger.warning("_tool_schema_tokens: could not size the toolbox", exc_info=True)
            _TOOL_SCHEMA_TOKENS = 0
    return _TOOL_SCHEMA_TOKENS


def _output_reserve(model: str | None, max_out: int | None) -> int:
    """Tokens to hold back for the model's own reply.

    ⚠ NOT ``max_out``. The registry's ``max_output_tokens`` is a CEILING that
    ``openai_service._resolve_max_tokens`` clamps DOWN to — it is not what the app
    asks for. Many catalog rows set it equal to the context window (measured
    2026-08-18: ``moonshotai/kimi-k2.5`` 262,144 / 262,144, ``minimax/minimax-01``
    1,000,192 / 1,000,192), so subtracting it wholesale reserved the entire window and
    collapsed five OpenRouter models to the floor — a cross-provider regression from a
    change whose whole purpose was local models.

    So reserve what the request will ACTUALLY carry, by asking the same resolver the
    request path uses. Falls back to ``max_out`` only if that resolver is unreachable;
    the self-consistency guard in ``resolve_context_budget`` then catches a pathological
    row rather than letting it through.
    """
    try:
        # Lazy import — openai_service imports this module at module scope.
        from app.services.openai_service import _resolve_max_tokens
        return int(_resolve_max_tokens(None, None, effective_model=model, db_max_output_cap=max_out))
    except Exception:
        logger.warning(
            "_output_reserve: could not resolve the real output size for model=%s; "
            "falling back to the registry ceiling", model, exc_info=True,
        )
        return int(max_out or 0)


def _resolve_registry_window(model: str | None) -> tuple[int | None, int | None]:
    """Best-effort SYNC read of the operator-set ``context_window_tokens`` /
    ``max_output_tokens`` for ``model`` from the model registry.

    Mirrors ``openai_service._resolve_db_native_tools`` in structure and for the same
    reason: ``resolve_context_budget`` is SYNC (both call sites in ``agent_loop.py``
    call it without an ``await``), so we cannot reach the async DB overlay here.
    Instead we read the SAME 30s-TTL ``_model_overrides_cache`` the async request path
    warms — ``agent_loop.py`` calls ``get_model_capability_async(effective_model)``
    immediately before opening the stream, and ``_load_model_overrides`` loads every
    enabled override row with all its columns.

    Returns ``(None, None)`` on a cold cache, an absent row, or null columns — never
    raises. That is the default-inert path: ``resolve_context_budget`` then behaves
    byte-identically to before this function existed.
    """
    if not model:
        return None, None
    try:
        # Lazy import breaks the context_window <-> user_settings import cycle,
        # mirroring _resolve_db_native_tools' own lazy import.
        from app.models.user_settings import _model_overrides_cache
        row = _model_overrides_cache.get(model)
        if row is not None:
            window = row.get("context_window_tokens")
            max_out = row.get("max_output_tokens")
            return (
                int(window) if window else None,
                int(max_out) if max_out else None,
            )
    except Exception:
        logger.warning(
            "_resolve_registry_window: sync cache read failed for model=%s; "
            "falling back to the static context chain",
            model,
            exc_info=True,
        )
    return None, None


def resolve_context_budget(active_provider: str, model: str = "") -> int:
    """Return context budget for main agent based on active model and provider.

    Priority:
    1. CONTEXT_WINDOW_MAX_TOKENS env var if set (non-zero) — global override
    2. MODEL_CONTEXT_LIMITS env var — per-model override (format: model-id=tokens,...)
    3. MODEL_CONTEXT_DEFAULTS — hardcoded per-model practical limits
    4. PROVIDER_CONTEXT_DEFAULTS — per-provider fallback
    5. 100,000 absolute fallback

    The result is then CLAMPED to what the model can physically accept, whenever the
    operator has declared ``context_window_tokens`` on its registry row.

    Why a clamp rather than another priority rung: every entry in the chain above is a
    *policy* choice (cost control, a conservative cap), whereas the registry value is a
    *physical* fact about the model. A policy may ask for less than the hardware allows;
    it may never ask for more, because exceeding the real window is not a degraded
    answer — it is a hard provider error. Measured 2026-08-18 against a local
    32,768-token model: the chain handed the trimmer 80,000 (the ``ollama`` provider
    default), so it never trimmed, and runs died with
    ``400: request (41206 tokens) exceeds the available context size (32768)`` — and,
    worse, with ``finish_reason=length`` mid-tool-call after the agent had gathered all
    its data, losing the deliverable on the final step.

    A clamp can only ever LOWER a budget toward a true limit, so no model gains context
    it did not have before. Models with no registry row, or a null
    ``context_window_tokens``, are byte-identical to the pre-clamp behaviour.

    Nothing here is hardcoded per model or per provider: the window and the output
    reserve both come from the registry row, which is operator-editable in the Model
    Registry UI (``_MODEL_CAP_COLUMNS`` allows PATCH on both columns). A deployment
    running a 200k local model just sets 200000 there.
    """
    if settings.context_window_max_tokens > 0:
        budget = settings.context_window_max_tokens
    elif model and model in (env_overrides := _parse_model_limits(settings.model_context_limits)):
        budget = env_overrides[model]
    elif model and model in MODEL_CONTEXT_DEFAULTS:
        budget = MODEL_CONTEXT_DEFAULTS[model]
    else:
        budget = PROVIDER_CONTEXT_DEFAULTS.get(active_provider, 100_000)

    window, max_out = _resolve_registry_window(model)
    if not window:
        return budget

    # Leave room for what trim_messages_to_fit cannot count: the model's own output
    # (per-model, from the registry), the tool schemas (measured — a fixed cost, so
    # NOT scaled by window size) and the system prompt (proportional).
    reserve = (
        _output_reserve(model, max_out)
        + _tool_schema_tokens()
        + int(window * _PROMPT_OVERHEAD_FRACTION)
    )

    # A row whose own reserve exceeds its own window is INTERNALLY INCONSISTENT — an
    # operator typo, or a catalog value copied into the wrong column. Clamping to a
    # floor there would hand the trimmer a catastrophic budget (measured 2026-08-18:
    # rows carrying max_output_tokens == context_window_tokens drove five OpenRouter
    # models to a 1,000-token budget). A bad row must be INERT, never destructive, so
    # we log it and hand back the chain budget untouched.
    if reserve >= window:
        logger.warning(
            "context_budget: registry row for model=%s is self-inconsistent "
            "(window=%d <= reserve=%d); ignoring the clamp and using chain_budget=%d",
            model, window, reserve, budget,
        )
        return budget

    ceiling = window - reserve
    if budget <= ceiling:
        return budget

    logger.info(
        "context_budget_clamped model=%s chain_budget=%d registry_window=%d "
        "max_output=%s -> %d",
        model, budget, window, max_out, ceiling,
    )
    return ceiling


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

    # Phase 250 HONEST-01 (BUG-260906-01) — FOUR ORDERED PASSES, and the order is the fix.
    #
    # The defect was not that the trimmer trimmed; it was WHAT it reached for first. A
    # thread that had absorbed several large `search_documents` payloads evicted the
    # user's own question while keeping the document chunks that question had produced,
    # and the model then apologised for losing a question the person had just asked.
    #
    # ⭐ A tool result is re-derivable by re-running the tool. A user question is not.
    # So every non-user group in BOTH sections goes before any user turn in EITHER —
    # which is why this is four passes and not two. A protected tail fat with tool
    # payloads must be allowed to shrink BEFORE `trimmable`'s questions are given up.
    def _fits() -> bool:
        return (
            estimate_messages_tokens(
                _build_candidate(system_msg, trimmable, protected, trimmed_any, pinned_msgs)
            )
            <= max_tokens
        )

    # PASS 1 — non-user groups out of the trimmable section.
    while trimmable and not _fits():
        if _remove_oldest_evictable(trimmable, allow_user=False) == 0:
            break
        trimmed_any = True

    # PASS 2 — non-user groups out of the protected tail, inward from the oldest. The
    # tail keeps the model's own final turn AND the newest user turn throughout
    # (D-078-01, and the floor the old comment claimed but did not enforce).
    while len(protected) > 1 and not _fits():
        if _remove_oldest_evictable(protected, allow_user=False, protect_tail=True) == 0:
            break
        trimmed_any = True

    # PASS 3 — only now may a user turn go, oldest first, out of trimmable.
    while trimmable and not _fits():
        if _remove_oldest_evictable(trimmable, allow_user=True) == 0:
            break
        trimmed_any = True

    # Phase 078 CQ-CTX-01 D-078-01: after trimmable is exhausted, progressively
    # trim oldest protected messages inward.
    # Mirrors Claude.ai / ChatGPT behavior (silently drops older turns, never errors).
    # D-078-02: no error raised — always return a valid list that fits.
    #
    # ⚠ Phase 250 HONEST-01 — THIS COMMENT USED TO READ "Hard floor: system_msg + last
    # user msg" AND THE CODE DID NOT DO THAT. `len(protected) > 1` protects the last
    # MESSAGE, and because agent_loop re-trims at the top of EVERY iteration — after tool
    # results have been appended — that last message is a tool result, not a question. The
    # floor is now enforced where it belongs: passes 1-2 strip every other group in both
    # sections before `_remove_oldest_evictable` will touch the newest-user group, and
    # when only it and the last group remain the LARGER one pays (⚠ CR-01 — this pass used
    # to give up the question FIRST, whatever its size; see that helper's docstring).
    # PASS 4 — last resort inside the protected tail (see _remove_oldest_evictable's
    # stated limitation: a question that alone exceeds the whole budget cannot be saved
    # by any ordering, and D-078-02 promises a list that fits rather than an exception).
    while len(protected) > 1 and not _fits():
        if _remove_oldest_evictable(protected, allow_user=True, protect_tail=True) == 0:
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


def _remove_oldest_evictable(
    seq: list[dict],
    *,
    allow_user: bool = True,
    protect_tail: bool = False,
) -> int:
    """Phase 250 HONEST-01 — remove the oldest atomic group that is safe to lose.

    ``_remove_oldest_atomic`` removes strictly oldest-first, which is why
    ``BUG-260906-01`` happened: a thread that had absorbed several large
    ``search_documents`` payloads evicted the user's OWN question while keeping the tool
    results that question had produced, and the model then apologised for losing a
    question the person had just asked.

    ⭐ The asymmetry that decides the order: **a tool result is re-derivable by re-running
    the tool; a user question is not.** So the oldest group carrying no ``user`` message
    goes first, and a user turn is only touched once nothing else is left.

    ``allow_user`` is the FIRST-PASS switch. ``trim_messages_to_fit`` now runs four
    ordered passes — non-user groups out of ``trimmable``, then non-user groups out of the
    protected tail, and only THEN user turns — because the eviction order has to hold
    ACROSS the two sections, not merely inside one. Without that, a protected tail fat
    with tool payloads could never shrink until every question in ``trimmable`` had
    already been thrown away, which is precisely the ``BUG-260906-01`` outcome.

    ``protect_tail`` switches the two call sites apart, and the difference is not
    cosmetic:

      * ``False`` (the trimmable section) — every group is ultimately evictable. The
        current question lives in the protected tail, so refusing to empty this section
        would simply stall the loop while the context still overflows. Order still
        prefers non-user groups.
      * ``True`` (the protected tail, after trimmable is exhausted) — this is where the
        floor lives. Passes 1-2 never touch either the last group or the group holding
        the newest user turn, so **both outlast every other group in both sections.**
        ⚠ Neither is protected UNCONDITIONALLY, and claiming that was CR-01: when only
        those two are left and they still overflow, the LARGER of them goes, because
        ``D-078-02`` promises a list that fits rather than an exception. That rule is
        what keeps both floors — the question survives an oversized tool result, and the
        model's final turn survives an oversized question (D-078-01);
        the newest-user group is the message the turn cannot proceed without, and is the
        floor the old comment claimed while the code protected only the last *message*.

    ⛔ **User turns are NEVER hoisted or reordered.** ``_build_candidate`` hoists pinned
    ``load_skill`` groups because a skill payload is self-contained; a question is not —
    hoisting it detaches it from the answer that follows it. This helper only changes
    WHICH group is removed, never WHERE the survivors sit.

    ⛔ **Every removal is a COMPLETE atomic group** (``_atomic_groups``, the same
    partition ``_remove_oldest_atomic`` mirrors), so an assistant with ``tool_calls``
    always leaves with its results and a lone orphan tool result is removed as its own
    group rather than stranded.

    ⚠ **Stated limitation, not an oversight.** When the protected tail has shrunk to the
    newest user group ALONE and it still overflows, the question is given up — at that
    point the question alone exceeds the entire budget and no ordering can save it, while
    ``D-078-02`` promises a list that fits rather than an exception. ``_TRIM_MARKER``
    remains the honest signal in that case.

    ⚠ **CR-01 — this limitation used to be much wider than the sentence above admitted,
    and the sentence is what hid it.** The give-up arm took ``keep[0]``, the newest user
    turn, so it fired whenever the PROTECTED TAIL held the oversized group — not only
    when the question itself was oversized. A 52-character question against a
    20,000-token budget was evicted by one 200 KB tool result. The claim *"every
    realistic shape never reaches this arm"* was false: the agent loop appends tool
    results into exactly that position and re-trims every iteration, so it is the loop's
    steady state. The arm now gives up the LARGER protected group — see the inline note,
    which records why the obvious inverse (prefer the non-user group) breaks ``D-078-01``
    and is not the fix either.

    Returns the number of messages removed. ``0`` means "nothing left that may go", which
    both callers already treat as their break condition — that is what guarantees the
    ``while`` loops terminate rather than spinning inside a request.
    """
    if not seq:
        return 0

    groups = _atomic_groups(seq)
    if not groups:
        return 0

    def _has_user(group: list[dict]) -> bool:
        return any(m.get("role") == "user" for m in group)

    keep: list[int] = []
    if protect_tail:
        newest_user_gi: int | None = None
        for gi in range(len(groups) - 1, -1, -1):
            if _has_user(groups[gi]):
                newest_user_gi = gi
                break
        # This list is only ever consulted by the last-resort arm below, which picks a
        # NON-USER entry before any user one — so the order entries are appended in does
        # not decide who is given up first (it did until CR-01, and it was wrong).
        if newest_user_gi is not None:
            keep.append(newest_user_gi)
        if (len(groups) - 1) not in keep:
            keep.append(len(groups) - 1)

    # 1 — the oldest group with no user turn at all.
    target: int | None = None
    for gi, group in enumerate(groups):
        if gi not in keep and not _has_user(group):
            target = gi
            break
    # 2 — the oldest group that may go. Guarantees progress.
    if target is None and allow_user:
        for gi in range(len(groups)):
            if gi not in keep:
                target = gi
                break
    # 3 — last resort: only the protected groups are left and they still do not fit, so
    # a protected group must go after all (D-078-02 — this function ALWAYS returns a list
    # that fits, it never raises). `keep` holds at most two groups here: the newest user
    # turn and the last group.
    #
    # ⚠ CR-01 — GIVE UP THE BIGGEST ONE, and neither "user first" nor "non-user first"
    # is the right rule. Both were driven and both break a floor:
    #
    #   * `keep[0]` (the newest user turn — what shipped) evicts a 52-character question
    #     to keep a 200 KB tool result sitting in the last group, then re-enters and eats
    #     the rest. Measured at a 20,000-token budget: `[system, trim_marker]`. That is
    #     the `BUG-260906-01` inversion this phase exists to remove.
    #   * The obvious inverse — prefer the non-user group — breaks `D-078-01` instead:
    #     `test_trim_protected_overrun_preserves_last_message` and `..._trims_inward` both
    #     go red, because it throws away a 13-character `"Recent reply."` to keep the
    #     1300-character user message that is the ACTUAL cause of the overflow.
    #
    # The floor was never "the question always wins" or "the last message always wins" —
    # it is that the group CAUSING the overflow is the one that should pay for it. Taking
    # the largest group is also what stops the cascade: one removal is far more likely to
    # suffice, so the `while` loop does not re-enter and strip the tail down to nothing.
    # Ties go to the group carrying no user turn, because a tool result is re-derivable by
    # re-running the tool and a question is not (HONEST-01's asymmetry, as the tiebreak).
    if target is None and allow_user and keep:
        target = max(
            keep,
            key=lambda gi: (
                estimate_messages_tokens(groups[gi]),
                _has_user(groups[gi]) is False,
            ),
        )
    if target is None:
        return 0

    start = sum(len(g) for g in groups[:target])
    n = len(groups[target])
    del seq[start : start + n]
    return n


def _remove_oldest_atomic(trimmable: list[dict]) -> int:
    """Remove the oldest atomic message group from the start of trimmable (in-place).

    ⚠ Phase 250: ``trim_messages_to_fit`` no longer calls this — it calls
    ``_remove_oldest_evictable``, which prefers groups carrying no user turn (HONEST-01).
    This strictly-oldest-first door is kept, byte-unchanged, because it is the primitive
    the newer helper's contract is stated against and because deleting a shipped function
    to tidy a diff is how a caller nobody grepped for breaks silently.

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
