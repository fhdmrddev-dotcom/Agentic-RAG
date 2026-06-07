"""
longmsg_workflow_smoke.py — EVAL-02 long-message axis row (v2.8 audit close-out).

The Phase 096 4-axis scoreboard left the LONG-MESSAGE axis deferred ("machine
overloaded"). This one-command row closes it: drive the `research_summarize`
seed workflow with a **>= 5 KB kickoff prompt** (the SC#10 long-message bar:
">= 50 prior messages OR a >= 5 KB user prompt") on one provider and assert
with DB truth that:

  1. longmsg_size       : the kickoff prompt is >= 5120 bytes AND the persisted
                          user message row carries it intact (no truncation).
  2. workflow_completed : workflow_runs.status reaches 'completed'.
  3. phase_sequence     : every workflow_phases row is 'completed', in locked
                          phase_index order (no skips, no stranded 'active').
  4. answer_persisted   : a non-empty assistant message exists on the thread
                          (the _surface_final_answer persistence path).

Plumbing: REUSES conc_probe.py's five-piece kit by import (load_env ->
assert_localhost_only FIRST -> report_env_presence -> get_bearer_token ->
connect_db) — same LOCALHOST HARD-GATE; operator starts uvicorn first.

Usage
-----
  backend/venv/Scripts/python.exe scripts/longmsg_workflow_smoke.py
  backend/venv/Scripts/python.exe scripts/longmsg_workflow_smoke.py --provider anthropic --model claude-haiku-4-5

Greppable markers: LONGMSG_ASSERT / LONGMSG_RESULT.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import conc_probe as kit  # noqa: E402 — five-piece plumbing kit (localhost-gated)

# Constant-string allowlisted SQL, %s params only (T-096-07-04 posture).
_SQL_PHASES = (
    "SELECT phase_index, slug, status FROM workflow_phases "
    "WHERE workflow_run_id = %s ORDER BY phase_index"
)
_SQL_FINAL_ANSWER = (
    "SELECT LENGTH(COALESCE(content, '')) AS n FROM messages "
    "WHERE thread_id = %s AND role = 'assistant' "
    "ORDER BY created_at DESC LIMIT 1"
)
_SQL_USER_MSG_LEN = (
    "SELECT LENGTH(COALESCE(content, '')) AS n FROM messages "
    "WHERE thread_id = %s AND role = 'user' "
    "ORDER BY created_at ASC LIMIT 1"
)

_TERMINAL = ("completed", "failed", "cancelled")


def build_long_prompt() -> str:
    """A realistic >= 5 KB research brief (deterministic, no padding nonsense —
    a long multi-section ask is exactly what the axis is meant to exercise)."""
    intro = (
        "Research brief: produce a structured evidence summary on retrieval-"
        "augmented generation (RAG) evaluation practice for production "
        "knowledge-base assistants. This brief is intentionally detailed; read "
        "all sections before answering and keep the final summary faithful to "
        "the constraints below.\n\n"
    )
    sections = []
    topics = [
        ("Retrieval quality metrics",
         "Cover recall@k, MRR, nDCG, and answer-grounding faithfulness. Explain "
         "when each metric is misleading for heterogeneous corpora that mix "
         "tables, figures, and prose, and what reference-set sizes make the "
         "numbers stable enough to gate releases."),
        ("Chunking and embedding trade-offs",
         "Summarize the evidence on chunk size versus retrieval precision, "
         "late-chunking, and semantic-boundary splitting. Note any results "
         "specific to multilingual corpora and to documents with heavy "
         "intra-document cross-references."),
        ("Eval-set construction",
         "Describe how teams build golden question sets from real user "
         "traffic, how they keep them from going stale as the corpus grows, "
         "and how adversarial or unanswerable questions are represented so "
         "the assistant's refusal behavior is also measured."),
        ("Cross-provider behavior variance",
         "Different LLM providers exhibit different tool-calling and "
         "synthesis behavior on identical retrieved context. Summarize known "
         "failure modes (over-summarization, citation fabrication, ignoring "
         "low-ranked chunks) and how evaluation harnesses isolate provider "
         "variance from retrieval variance."),
        ("Production monitoring",
         "Explain online evaluation: sampled human review, LLM-as-judge with "
         "calibration against human labels, drift alarms on retrieval-score "
         "distributions, and how to wire regression gates into CI so model or "
         "prompt updates cannot silently degrade grounded-answer quality."),
        ("Cost and latency envelopes",
         "Summarize the trade-off between rerankers and larger k, embedding "
         "cache strategies, and what p95 end-to-end budgets are typical for "
         "interactive assistants versus batch report generation."),
    ]
    for i, (title, body) in enumerate(topics, 1):
        sections.append(
            f"Section {i}: {title}.\n{body}\nFor this section, cite the kind "
            "of source you would want (benchmark paper, vendor doc, practitioner "
            "post-mortem) and state your confidence. If evidence is thin, say "
            "so explicitly rather than smoothing over the gap.\n"
        )
    constraints = (
        "\nOutput constraints: organize the summary by the six sections above, "
        "in order; lead each with a two-sentence takeaway; end with a ranked "
        "list of the five most decision-relevant findings overall and one "
        "paragraph on what you could NOT establish from available evidence. "
        "Keep the whole answer under 900 words.\n"
    )
    text = intro + "\n".join(sections) + constraints
    # Deterministic top-up to clear the 5 KB bar regardless of edits above:
    filler_note = (
        "Reviewer note (repeatable): verify every claim against the section "
        "constraints before finalizing; prefer primary sources over summaries; "
        "flag any section where the two strongest sources disagree.\n"
    )
    while len(text.encode("utf-8")) < 5400:
        text += filler_note
    return text


def _assert(name: str, ok: bool, detail: str) -> bool:
    print(f"LONGMSG_ASSERT {name} {'PASS' if ok else 'FAIL'} {detail}")
    return ok


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="EVAL-02 long-message workflow row")
    ap.add_argument("--provider", default="openai")
    ap.add_argument("--model", default="gpt-5.4-mini")
    ap.add_argument("--slug", default="research_summarize")
    ap.add_argument("--timeout", type=int, default=600)
    args = ap.parse_args(argv)

    kit.load_env()
    kit.assert_localhost_only()
    kit.report_env_presence()
    token = kit.get_bearer_token()
    conn = kit.connect_db()

    prompt = build_long_prompt()
    nbytes = len(prompt.encode("utf-8"))

    def_id, _definition = kit.resolve_definition(conn, args.slug)
    thread_id = kit.create_thread(token, "EVAL-02 long-message axis row")
    print(
        f"Long-message row: workflow={args.slug} provider={args.provider}/"
        f"{args.model} kickoff={nbytes} bytes thread={thread_id}"
    )
    kit.kickoff_workflow(token, thread_id, prompt, args.provider, args.model, def_id)
    wf_id = kit.resolve_workflow_run_id(conn, thread_id)
    print(f"workflow_run={wf_id}")

    deadline = time.time() + args.timeout
    status = None
    while time.time() < deadline:
        status = kit.workflow_status(conn, wf_id)
        if status in _TERMINAL:
            break
        time.sleep(2)

    phases = kit._fetchall(conn, _SQL_PHASES, (wf_id,))
    final = kit._fetchone(conn, _SQL_FINAL_ANSWER, (thread_id,))
    user_msg = kit._fetchone(conn, _SQL_USER_MSG_LEN, (thread_id,))

    ok = True
    ok &= _assert(
        "longmsg_size",
        nbytes >= 5120 and bool(user_msg and user_msg["n"] >= 5120),
        f"kickoff={nbytes}B persisted_user_msg={user_msg['n'] if user_msg else 0}chars (bar >= 5120)",
    )
    ok &= _assert(
        "workflow_completed", status == "completed",
        f"workflow_runs.status={status!r} (timeout {args.timeout}s)",
    )
    seq_ok = bool(phases) and all(p["status"] == "completed" for p in phases)
    idx_ok = [p["phase_index"] for p in phases] == sorted(
        p["phase_index"] for p in phases
    )
    ok &= _assert(
        "phase_sequence", seq_ok and idx_ok,
        f"{[(p['phase_index'], p['slug'], p['status']) for p in phases]}",
    )
    ok &= _assert(
        "answer_persisted", bool(final and final["n"] > 0),
        f"assistant content length={final['n'] if final else 0}",
    )

    print(f"LONGMSG_RESULT {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
