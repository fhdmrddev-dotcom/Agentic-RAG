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
