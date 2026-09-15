"""Phase 250 — run honesty inside the agent loop (HONEST-01, HONEST-02).

Two requirements, two failure modes, one file because they share a blast radius.

HONEST-01 (`BUG-260906-01`) — context trimming evicted the user's OWN question while keeping the
tool results that question produced, and the model then apologised for losing a question the
person had just asked. ⭐ The asymmetry that makes the fix obvious once stated: **a tool result is
re-derivable by re-running the tool; a user question is not.**

HONEST-02 (`BUG-260722-02`) — a model that produced no visible text got ONE sentence for every
possible cause: *"empty response after N iteration(s)"*. It names a count and a workaround and
says nothing about what happened.

⚠ Fence §2.2 is the load-bearing one in this file and the reason it exists is written into it:
`full_reasoning_content` is RESET inside the loop, so an implementation that reads it reports
"no reasoning" about a model that reasoned on every iteration — the honesty fix shipping a lie.
"""
import re
from pathlib import Path

import pytest

from app.services.context_window import (
    trim_messages_to_fit,
    estimate_messages_tokens,
)


# ---------------------------------------------------------------------------
# Message factories — same shapes as tests/unit/test_context_window.py
# ---------------------------------------------------------------------------

def _sys(content: str) -> dict:
    return {"role": "system", "content": content}


def _user(content: str) -> dict:
    return {"role": "user", "content": content}


def _assistant(content: str) -> dict:
    return {"role": "assistant", "content": content}


def _assistant_tc(tool_calls: list) -> dict:
    return {"role": "assistant", "content": None, "tool_calls": tool_calls}


def _tool(tool_call_id: str, content: str) -> dict:
    return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


def _tc(id: str, name: str = "search_documents", args: str = "{}") -> dict:
    return {"id": id, "type": "function", "function": {"name": name, "arguments": args}}


def _bug_shaped_history(turns: int = 8, chunk_chars: int = 4000) -> list[dict]:
    """The `BUG-260906-01` shape: short user questions, fat tool payloads.

    Each turn is: user question → assistant(tool_calls) → tool result carrying a full
    document chunk. This is exactly the thread the report describes — *"the trim kept the
    tool results and dropped the user turn"*.
    """
    msgs: list[dict] = [_sys("You are a helpful agent.")]
    for i in range(turns):
        msgs.append(_user(f"QUESTION-{i}: what does the policy say about clause {i}?"))
        msgs.append(_assistant_tc([_tc(f"call-{i}")]))
        msgs.append(_tool(f"call-{i}", "DOCUMENT CHUNK " + ("x" * chunk_chars)))
        msgs.append(_assistant(f"Clause {i} says ..."))
    return msgs


def _user_contents(msgs: list[dict]) -> list[str]:
    """User messages EXCLUDING the synthetic trim marker injected by _build_candidate."""
    from app.services.context_window import _TRIM_MARKER

    return [
        m["content"]
        for m in msgs
        if m.get("role") == "user" and m.get("content") != _TRIM_MARKER
    ]


# ===========================================================================
# §1 — HONEST-01: the user's question is evicted LAST
# ===========================================================================

def test_1_1_user_questions_survive_when_tool_results_could_go_instead():
    """SC#1 — a long thread keeps every question the user asked.

    ⛔ RED before the fix: the trimmer removes strictly oldest-first, so QUESTION-0 and
    its neighbours go while their (far larger) tool payloads in later turns stay.
    """
    msgs = _bug_shaped_history(turns=8, chunk_chars=4000)
    asked = _user_contents(msgs)
    assert len(asked) == 8

    # A budget that forces heavy trimming but leaves ample room for eight one-line
    # questions — the whole point is that questions are cheap and chunks are not.
    budget = estimate_messages_tokens(msgs) // 3
    out = trim_messages_to_fit(msgs, max_tokens=budget, reserve_recent=10)

    assert estimate_messages_tokens(out) <= budget, "trim must still fit the budget"
    kept = _user_contents(out)
    assert kept == asked, (
        "HONEST-01: every user question must survive a trim while any tool result "
        f"remains. Dropped: {sorted(set(asked) - set(kept))}"
    )


def test_1_2_the_last_user_question_is_never_evicted():
    """The hard floor the code's own comment already claimed but did not enforce."""
    msgs = _bug_shaped_history(turns=6, chunk_chars=6000)
    newest_question = _user_contents(msgs)[-1]

    # Brutal budget: only a handful of messages can survive.
    out = trim_messages_to_fit(msgs, max_tokens=400, reserve_recent=10)

    assert newest_question in _user_contents(out), (
        "HONEST-01: the message the turn cannot proceed without must be the last thing "
        "evicted, never the first"
    )


def _dominant_payload_history(turns: int = 6, payload_chars: int = 200_000) -> list[dict]:
    """The shape `_bug_shaped_history` structurally EXCLUDES: ONE dominant payload.

    ⚠ CR-01. `_bug_shaped_history` spreads its bulk over MANY medium tool results
    (`chunk_chars=4000/6000`), so the overflow is always caused by groups the protected
    tail does not hold. That is why every §1 fence passed while the floor was broken.

    Here the single 200 KB payload sits in the NEWEST group — the one `protect_tail`
    keeps — so PASS 1-3 can empty everything they are allowed to touch and the context
    STILL overflows. That is what drives PASS 4's last-resort arm, and that arm is
    reached by no other test in this file.
    """
    msgs: list[dict] = [_sys("You are a helpful agent.")]
    for i in range(turns):
        msgs.append(_user(f"QUESTION-{i}: what does the policy say about clause {i}?"))
        msgs.append(_assistant(f"Clause {i} says ..."))
    msgs.append(_user("FINAL QUESTION: summarise every clause for the board."))
    msgs.append(_assistant_tc([_tc("call-final")]))
    msgs.append(_tool("call-final", "DOCUMENT " + ("x" * payload_chars)))
    return msgs


@pytest.mark.parametrize("max_tokens", [6_000, 12_000, 20_000])
def test_1_2b_one_oversized_tool_result_does_not_evict_the_question_it_produced(
    max_tokens: int,
):
    """CR-01 — the floor must hold when the OVERSIZED group is the protected one.

    The docstring scopes the give-up arm to *"the question ALONE exceeds the entire
    budget"*. This question is 52 characters against a 20,000-token budget, so that
    escape hatch does not apply: the 200 KB tool result is what overflows, and a tool
    result is re-derivable by re-running the tool while the question is not.

    ⛔ Before the fix this returned `[system, trim_marker]` at all three budgets —
    every question gone, INCLUDING the newest, while the payload that caused the
    overflow was the thing the tail protected.
    """
    msgs = _dominant_payload_history()
    newest_question = _user_contents(msgs)[-1]

    out = trim_messages_to_fit(msgs, max_tokens=max_tokens, reserve_recent=10)

    assert newest_question in _user_contents(out), (
        f"CR-01: at budget {max_tokens} the newest user question was evicted to keep a "
        "tool result that is re-derivable — the exact BUG-260906-01 inversion HONEST-01 "
        "claims to have fixed"
    )
    assert estimate_messages_tokens(out) <= max_tokens, (
        "D-078-02: the returned list must still fit"
    )


def test_1_2c_an_oversized_question_does_not_evict_the_models_final_reply():
    """CR-01, the OTHER direction — the fence against over-correcting.

    The obvious fix for `test_1_2b` is "prefer the protected group carrying no user
    turn". It was driven, and it breaks `D-078-01`: it throws away a 13-character final
    reply to keep the oversized user message that is the ACTUAL cause of the overflow.
    `test_trim_protected_overrun_preserves_last_message` and `..._trims_inward` in
    `test_context_window.py` both go red on it.

    ⭐ This pair is the point: neither party to the last-resort arm is unconditionally
    protected, so a fence for only one of them licenses breaking the other. The rule the
    two fences agree on is *the group causing the overflow pays.*
    """
    msgs = [
        _sys("You are a helpful agent."),
        _user("OVERSIZED QUESTION: " + ("y" * 200_000)),
    ]
    final_reply = _assistant("Here is the short answer.")
    msgs.append(final_reply)

    out = trim_messages_to_fit(msgs, max_tokens=2_000, reserve_recent=10)

    assert final_reply in out, (
        "D-078-01: the model's own final turn must survive an oversized QUESTION — "
        "HONEST-01's asymmetry orders eviction, it does not make user turns immortal"
    )
    assert estimate_messages_tokens(out) <= 2_000, "D-078-02: the list must still fit"


def test_1_3_tool_pair_integrity_survives_the_new_order():
    """Invariant 2 — no orphaned tool result, and no assistant stripped of its results.

    ✅ Describes today's correct behaviour; it is the regression fence for the new rule.
    """
    msgs = _bug_shaped_history(turns=8, chunk_chars=3000)
    out = trim_messages_to_fit(
        msgs, max_tokens=estimate_messages_tokens(msgs) // 4, reserve_recent=10
    )

    live_ids: set[str] = set()
    for m in out:
        if m.get("role") == "assistant" and m.get("tool_calls"):
            live_ids |= {tc["id"] for tc in m["tool_calls"]}
    for m in out:
        if m.get("role") == "tool":
            assert m["tool_call_id"] in live_ids, (
                f"orphaned tool result {m['tool_call_id']} — its parent was removed"
            )

    # …and the converse: an assistant with tool_calls kept its results.
    for i, m in enumerate(out):
        if m.get("role") == "assistant" and m.get("tool_calls"):
            following = {
                x.get("tool_call_id")
                for x in out[i + 1 :]
                if x.get("role") == "tool"
            }
            for tc in m["tool_calls"]:
                assert tc["id"] in following, (
                    f"assistant kept but its tool result {tc['id']} was removed"
                )


def _split_group_history(turns: int = 6, chunk_chars: int = 3_000) -> list[dict]:
    """A history whose NEWEST atomic group is `assistant(2 tool_calls) + tool + tool`.

    ⚠ CR-02. `protected = rest[-reserve_recent:]` is a RAW INDEX slice, not a group-aware
    one, so a small `reserve_recent` cuts straight through this group and leaves headless
    tool results at the head of the protected tail.
    """
    msgs: list[dict] = [_sys("You are a helpful agent.")]
    for i in range(turns):
        msgs.append(_user(f"QUESTION-{i}: what does the policy say about clause {i}?"))
        msgs.append(_assistant(f"Clause {i} says ..."))
    msgs.append(_user("Final question about the docs?"))
    msgs.append(_assistant_tc([_tc("z1"), _tc("z2")]))
    msgs.append(_tool("z1", "CHUNK A " + ("a" * chunk_chars)))
    msgs.append(_tool("z2", "CHUNK B " + ("b" * chunk_chars)))
    return msgs


def _orphan_tool_ids(msgs: list[dict]) -> list[str]:
    """tool_call_ids answered by no PRECEDING assistant — what a provider 400s on."""
    live: set[str] = set()
    orphans: list[str] = []
    for m in msgs:
        if m.get("role") == "assistant" and m.get("tool_calls"):
            live |= {c.get("id") for c in m["tool_calls"] if c.get("id")}
        if m.get("role") == "tool" and m.get("tool_call_id") not in live:
            orphans.append(m.get("tool_call_id"))
    return orphans


@pytest.mark.parametrize("reserve_recent", [1, 2, 3, 4])
@pytest.mark.parametrize("max_tokens", [1_500, 3_500, 7_000, 12_000])
def test_1_3b_no_orphan_tool_message_ever_reaches_the_provider(
    reserve_recent: int, max_tokens: int
):
    """CR-02 — a headless `tool` message is a hard 400, not a degraded answer.

    OpenAI: *"messages with role 'tool' must be a response to a preceding message with
    'tool_calls'"*. Anthropic rejects an unmatched `tool_result` block the same way. So
    this is the whole run dying, not context quietly shrinking.

    ⛔ `test_1_3` claims this invariant and cannot see it: it drives `turns=8,
    reserve_recent=10`, a shape where the boundary happens to resolve before returning.
    This sweep picks `reserve_recent` values that SPLIT the newest atomic group, which is
    the only way the raw index slice strands a child.

    Measured before the fix: `rr=1 b=1500 ORPHANS=['z2']` and `rr=2 b=1500 ORPHANS=['z2']`.
    """
    out = trim_messages_to_fit(
        _split_group_history(), max_tokens=max_tokens, reserve_recent=reserve_recent
    )

    assert _orphan_tool_ids(out) == [], (
        f"CR-02: rr={reserve_recent} budget={max_tokens} returned a tool message with no "
        f"preceding tool_calls — roles={[m.get('role') for m in out]}"
    )


def test_1_4_trim_is_a_noop_when_everything_fits():
    """D-14 — Deep Mode byte-identical. The fast path is untouched."""
    msgs = _bug_shaped_history(turns=2, chunk_chars=50)
    out = trim_messages_to_fit(msgs, max_tokens=1_000_000, reserve_recent=10)
    assert out is msgs, "a history that fits must be returned unchanged, same object"


def test_1_5_removal_always_makes_progress():
    """Invariant 3 — an all-user history must still terminate and still shrink.

    A user-last rule that never falls through would spin forever inside a request.
    """
    msgs = [_sys("sys")] + [_user(f"Q{i} " + "y" * 2000) for i in range(12)]
    out = trim_messages_to_fit(msgs, max_tokens=900, reserve_recent=10)
    assert len(out) < len(msgs), "the trimmer must make progress on an all-user history"
    assert out[0]["role"] == "system"
    assert _user_contents(out), "at least the newest question survives"


# ===========================================================================
# §2 — HONEST-02: an empty run says WHAT HAPPENED
#
# These fences read the SOURCE of the fallback branch rather than driving the whole
# agent loop. That is deliberate and it is a limitation stated rather than hidden:
# `run_agent_loop` is a 3300-line generator over redis + a provider SDK, and a fence
# that mocked all of it would pin the mock, not the product. What CAN be pinned
# statically is the thing the bug is about — the WORDS, the four arms, and the fact
# that the reasoning arm does not read a variable the loop resets. The behavioural
# proof is the cross-provider UAT rows in 250-UAT.md.
# ===========================================================================

_AGENT_LOOP = Path(__file__).resolve().parents[2] / "app" / "services" / "agent_loop.py"


def _agent_loop_src() -> str:
    return _AGENT_LOOP.read_text(encoding="utf-8")


def _fallback_block(src: str) -> str:
    """The `if not full_content:` fallback branch, up to its `_emit` call."""
    start = src.index("# Fallback: if the loop ended with no content produced")
    end = src.index("await _emit(redis, run_id, 'delta', content=fallback)", start)
    return src[start:end]


def _code_only(block: str) -> str:
    """The same block with `#` comments removed.

    ⭐ Written because the first cut of these fences FIRED ON THEIR OWN SUBJECT'S
    COMMENTS: the implementation's comment explains *why* it must not read
    `full_reasoning_content` and *why* no provider branch belongs here, so a raw
    substring fence read those explanations as violations. This is the Python twin of
    `frontend/src/lib/stripComments.testutil.ts` — **a text fence cannot tell code from
    a comment, and a fence that cannot is asserting about prose.**
    """
    out = []
    for line in block.splitlines():
        i = line.find("#")
        out.append(line if i == -1 else line[:i])
    return chr(10).join(out)


def _identifiers_only(block: str) -> str:
    """Comments AND string literals removed — what is left is structure.

    A fence about *shape* ("no provider branch here") must not fire on a user-facing
    SENTENCE that happens to contain the word, and a fence about *words* must not fire on
    the comment explaining the rule. Two different questions, two different readings of
    the same text: ``_code_only`` for the words, this one for the structure.
    """
    code = _code_only(block)
    code = re.sub(r'f?"(?:\\.|[^"\\])*"', " ", code)
    code = re.sub(r"f?'(?:\\.|[^'\\])*'", " ", code)
    return code


def test_2_1_the_fallback_names_what_happened_not_just_a_count():
    """SC#2 — four arms, each naming a distinct thing that actually occurred.

    ⛔ RED before the fix: one sentence, `empty response after N iteration(s)`.
    """
    block = _code_only(_fallback_block(_agent_loop_src()))
    lowered = block.lower()

    assert "not captured" in lowered or "unknown" in lowered, (
        "HONEST-02: the taxonomy needs an explicit unknown arm — a fallback that cannot "
        "tell must SAY it cannot tell, never invent a cause. run-honesty.md D2's own "
        "wording for this arm is 'Failure reason not captured by the backend'."
    )
    assert "reasoning" in lowered, (
        "HONEST-02: the reasoning-only arm is the case BUG-260722-02 was filed for"
    )
    assert "tool" in lowered, "HONEST-02: the tools-ran-but-no-answer arm is missing"
    # Four distinct user-facing sentences, not one string with an f-string count in it.
    sentences = re.findall(r'"[^"\n]{25,}"', block)
    assert len(sentences) >= 3, (
        f"expected a closed taxonomy of distinct messages, found {len(sentences)}: {sentences}"
    )


def test_2_2_the_reasoning_arm_does_not_read_a_variable_the_loop_resets():
    """⭐ THE LOAD-BEARING FENCE OF THIS FILE.

    `full_reasoning_content` is assigned `""` INSIDE the loop (two sites). An arm that
    reads it reports *"the model produced no reasoning"* about a model that reasoned on
    every single iteration — the honesty fix itself lying, for exactly the reasoning
    family the bug is filed against.

    So: (a) the resets must still exist — this fence must not be satisfied by deleting
    them — and (b) the fallback block must not read that name.
    """
    src = _agent_loop_src()

    resets = re.findall(r"^\s*full_reasoning_content\s*=\s*\"\"\s*$", src, re.MULTILINE)
    assert len(resets) >= 2, (
        "the per-iteration resets are part of the provider contract (DeepSeek round-trip) "
        "— this fence must be satisfied by NOT READING the variable, never by deleting "
        f"the resets. Found {len(resets)}."
    )

    block = _identifiers_only(_fallback_block(src))
    assert "full_reasoning_content" not in block, (
        "HONEST-02: the fallback must not read `full_reasoning_content` — it is reset "
        "inside the loop, so reading it reports 'no reasoning' for a model that reasoned "
        "all run. Use a never-reset accumulator."
    )


def test_2_3_a_never_reset_reasoning_accumulator_exists_and_is_never_zeroed():
    """The positive half of §2.2 — the replacement must actually exist and survive.

    Any name the fallback uses for "did this run reason at all" must never appear on the
    left of a `= ""` / `= 0` / `= False` assignment inside the loop body.
    """
    src = _agent_loop_src()
    block = _code_only(_fallback_block(src))

    candidates = sorted(
        set(re.findall(r"\b(_?[a-z_]*reasoning[a-z_]*)\b", block))
        - {"reasoning", "reasoning_content"}
    )
    assert candidates, (
        "HONEST-02: the fallback must consult SOME never-reset reasoning signal"
    )

    for name in candidates:
        resets = re.findall(
            rf"^\s+{re.escape(name)}\s*=\s*(\"\"|0|False)\s*$", src, re.MULTILINE
        )
        # One initialisation before the loop is expected; a reset INSIDE the loop is the bug.
        assert len(resets) <= 1, (
            f"`{name}` is zeroed {len(resets)} times — a run-scoped honesty signal must be "
            "initialised once and never reset, or it reports 'no reasoning' for a model "
            "that reasoned on an earlier iteration"
        )


def test_2_4_the_actionable_tail_follows_the_diagnosis_rather_than_replacing_it():
    """The old sentence's one useful half is kept — after the diagnosis, not instead."""
    block = _code_only(_fallback_block(_agent_loop_src()))
    lowered = block.lower()
    assert "different model" in lowered or "smaller steps" in lowered, (
        "the actionable advice was true and useful; the fix adds a diagnosis in front of "
        "it, it does not delete it"
    )


def test_2_5_no_provider_branch_entered_the_shared_fallback():
    """Red line D-14 — provider differences stay at the adapter boundary."""
    structure = _identifiers_only(_fallback_block(_agent_loop_src()))
    assert "provider" not in structure.lower(), (
        "the taxonomy reads shared accumulators only; a provider branch here forks the "
        "shared path and belongs at the adapter/sanitizer boundary. Read with strings AND "
        "comments stripped: naming the provider in a SENTENCE the user reads is honest, "
        "BRANCHING on it here is the red line."
    )


# ===========================================================================
# §3 — CR-03: the reasoning arm must be REACHABLE, and arm 3 must not
#      assert a negative the backend never observed
# ===========================================================================

class _Chunk:
    """A minimal OpenAI-compat streaming chunk carrying only `usage`."""

    def __init__(self, **usage):
        self.usage = type("U", (), usage)() if usage else None
        self.choices = []


def test_3_1_openai_reasoning_tokens_are_accumulated_from_usage():
    """CR-03 part 1 — the signal the app ALREADY receives must be read.

    `stream_options={"include_usage": True}` is set on every streaming call
    (`openai_service.py`), so a gpt-5.x Chat Completions stream delivers
    `usage.completion_tokens_details.reasoning_tokens` on its final chunk. Before this
    fix nothing read it, so `reasoning_chars_this_run` stayed 0 and the arm written *"for
    exactly the gpt-5.6 reasoning family the bug is filed against"* could not fire for
    that family.

    ⚠ This is NOT `reasoning_delta`. Tokens are not characters, and the fix must not
    pretend otherwise — that is what `test_3_3` pins.
    """
    from app.services.provider_gateway.openai_compat import _accumulate_chunk_usage

    details = type("D", (), {"reasoning_tokens": 512})()
    chunk = _Chunk(prompt_tokens=100, completion_tokens=900,
                   completion_tokens_details=details)

    result = _accumulate_chunk_usage(chunk, "openai", None, None)

    assert len(result) == 3, (
        "CR-03: _accumulate_chunk_usage must carry a reasoning-token total alongside "
        "input/output, or the OpenAI reasoning signal has nowhere to go"
    )
    assert result[2] == 512, f"reasoning tokens not accumulated: {result!r}"


def test_3_2_google_reasoning_tokens_overwrite_rather_than_sum():
    """The Google cumulative-usage branch must treat reasoning the same way.

    `D-075.3-01-probe-locked`: Google emits CUMULATIVE running totals every chunk, so
    `+=` over-counts by 2-3x. A reasoning total added to that branch with the wrong
    arithmetic silently corrupts the same way the billing figures would.
    """
    from app.services.provider_gateway.openai_compat import _accumulate_chunk_usage

    details = type("D", (), {"reasoning_tokens": 300})()
    chunk = _Chunk(prompt_tokens=10, completion_tokens=50,
                   completion_tokens_details=details)

    result = _accumulate_chunk_usage(chunk, "google", 10, 50, 300)

    assert result[2] == 300, (
        f"Google's branch must OVERWRITE the reasoning total (last-wins), got {result!r}"
    )


def test_3_3_the_token_arm_never_claims_characters_it_did_not_count():
    """CR-03 — a token count must never be rendered as a character count.

    Arm 1's precise sentence reports `{n:,} characters of reasoning`, counted from
    `reasoning_delta` text. `usage.reasoning_tokens` is a different unit and a different
    observation; rendering it through that sentence would be exactly the overclaim
    HONEST-02 exists to remove.
    """
    src = _agent_loop_src()
    block = _fallback_block(src)
    code = _code_only(block)

    assert "reasoning_tokens_this_run" in code, (
        "CR-03: the fallback must be able to report reasoning observed as TOKENS"
    )
    for line in code.splitlines():
        if "reasoning_tokens_this_run" in line and "characters" in line:
            raise AssertionError(
                f"CR-03: a token tally rendered as characters — {line.strip()!r}"
            )


def test_3_4_arm_three_does_not_assert_a_negative_it_cannot_observe():
    """CR-03 part 2 — 'no reasoning' is a claim about the model's internals.

    The Anthropic adapter runs with thinking OFF by design (D-05) and emits no reasoning
    event; the Google adapter emits none either. For those paths the backend has observed
    NOTHING about reasoning, so enumerating 'no reasoning' as a fact is the same overclaim
    class arm 4 exists to avoid. The block comment already admits the limitation — a
    comment is not a mitigation, because the user reads the sentence.
    """
    src = _agent_loop_src()
    block = _fallback_block(src)

    strings = re.findall(r'f"([^"]*)"', block)
    joined = " ".join(strings)

    assert "no reasoning" not in joined, (
        "CR-03: the user-facing fallback still asserts 'no reasoning' for providers "
        "whose reasoning the backend cannot see"
    )
    assert "may have been thinking" in joined or "do not report reasoning" in joined, (
        "CR-03: having dropped the false certainty, the sentence must say WHY it cannot "
        "tell — otherwise the user just loses information"
    )
