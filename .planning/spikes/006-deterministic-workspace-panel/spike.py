"""
Spike 006 — Deterministic, provider-independent workspace-panel population.

Question (HEART of the spike, per operator):
  Can we decide SMARTLY + NATURALLY whether a task deserves a todo/workspace
  reflection, and then fill it DETERMINISTICALLY from the cross-provider
  tool-call activity stream — WITHOUT relying on the model voluntarily calling
  write_todos, and WITHOUT forcing a panel on simple one-shot chats?

Approach under test:
  (A) Derive the panel from the tool-call ACTIVITY stream (provider-agnostic;
      the same shared SSE vocabulary that already renders run-card steps for
      every provider). Use execute_code's `description` field for labels.
  Honor an explicit plan when the model DID call write_todos (richest source).

Smart gate (deterministic):
  Populate the panel ONLY when the run shows genuine multi-step work:
    - the model called write_todos (explicit plan), OR
    - >= 2 "meaningful" tool calls were observed (execute_code / search_documents
      / sub-agent / workspace_write — i.e. real work steps, not write_todos itself).
  Otherwise -> NO panel (stays clean). A 0-tool Q&A or a 1-tool lookup never
  triggers a checklist.

Runs entirely on REAL captured fixtures + 2 synthetic clean cases. No network,
no LLM keys, deterministic.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# Tool calls that represent real "work steps" worth tracking (NOT write_todos,
# which is the plan itself, and NOT trivial/meta tools).
MEANINGFUL_TOOLS = {"execute_code", "search_documents", "workspace_write", "analyze_document", "sub_agent"}

# Minimum meaningful steps before an UNPLANNED run earns a panel.
GATE_MIN_STEPS = 2


def humanize(tc):
    """Best-effort human label for a single tool call (the derive path)."""
    name = tc.get("name")
    desc = tc.get("description")
    if desc:
        return desc
    pretty = {
        "execute_code": "Run code",
        "search_documents": "Search documents",
        "workspace_write": "Write workspace file",
        "analyze_document": "Analyze document",
    }.get(name, name)
    return pretty


def should_populate(tool_calls):
    """The SMART GATE — deterministic, provider-independent."""
    wrote_todos = any(tc.get("name") == "write_todos" for tc in tool_calls)
    meaningful = [tc for tc in tool_calls if tc.get("name") in MEANINGFUL_TOOLS]
    return wrote_todos or len(meaningful) >= GATE_MIN_STEPS, wrote_todos, len(meaningful)


def derive_panel(tool_calls):
    """Produce the panel task list deterministically.

    Source precedence:
      1. If write_todos was called -> use the LATEST write_todos snapshot
         (the model's own plan + final statuses) — richest, honor it.
      2. Else -> derive one task per meaningful tool call, label from
         description (or humanized tool name), status from the call's status.
    """
    todos_calls = [tc for tc in tool_calls if tc.get("name") == "write_todos"]
    if todos_calls:
        latest = todos_calls[-1]["todos"]
        return ("write_todos (honored)",
                [{"label": t["content"], "status": t["status"]} for t in latest])
    # derive from activity
    items = []
    for tc in tool_calls:
        if tc.get("name") in MEANINGFUL_TOOLS:
            status = "completed" if tc.get("status") == "done" else (tc.get("status") or "pending")
            items.append({"label": humanize(tc), "status": status})
    return ("activity-derived", items)


def render(panel):
    if not panel:
        return "    (clean — no panel)"
    return "\n".join(f"    [{ 'x' if t['status']=='completed' else ('~' if t['status']=='in_progress' else ' ') }] {t['label']}" for t in panel)


def main():
    data = json.load(open(os.path.join(HERE, "fixtures.json"), encoding="utf-8"))
    results = []
    for fx in data["fixtures"]:
        populate, wrote, n_meaningful = should_populate(fx["tool_calls"])
        source, panel = derive_panel(fx["tool_calls"]) if populate else (None, [])
        results.append({
            "id": fx["id"], "provider": fx["provider"], "populate": populate,
            "source": source, "panel": panel, "n_meaningful": n_meaningful, "wrote_todos": wrote,
        })
        print(f"\n=== {fx['id']}  ({fx['provider']}, status={fx['run_status']}) ===")
        print(f"    gate: populate={populate}  (write_todos={wrote}, meaningful_steps={n_meaningful})")
        print(f"    source: {source}")
        print(render(panel))

    # ---- Assertions: the gate must behave smart + natural ----
    by_id = {r["id"]: r for r in results}
    checks = []
    def check(name, cond):
        checks.append((name, cond))
    check("simple Q&A stays CLEAN", by_id["simple-qa"]["populate"] is False)
    check("single lookup stays CLEAN", by_id["single-search"]["populate"] is False)
    check("failed/0-tool run stays CLEAN", by_id["google-failed"]["populate"] is False)
    check("openai multi-step POPULATES", by_id["openai-3step"]["populate"] is True)
    check("anthropic (NO write_todos) NOW POPULATES", by_id["anthropic-3step"]["populate"] is True)
    check("anthropic panel has 3 semantic items", len(by_id["anthropic-3step"]["panel"]) == 3)
    check("anthropic items are semantic (not 'Run code')",
          all(it["label"] != "Run code" for it in by_id["anthropic-3step"]["panel"]))

    print("\n\n=== GATE / DERIVATION CHECKS ===")
    allok = True
    for name, cond in checks:
        print(f"    [{'PASS' if cond else 'FAIL'}] {name}")
        allok = allok and cond
    print(f"\nVERDICT: {'VALIDATED' if allok else 'INVALIDATED'}")
    return 0 if allok else 1


if __name__ == "__main__":
    raise SystemExit(main())
