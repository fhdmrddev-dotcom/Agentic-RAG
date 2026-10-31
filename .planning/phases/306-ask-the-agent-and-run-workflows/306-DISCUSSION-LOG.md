# Phase 306: Ask the Agent and Run Workflows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-31
**Phase:** 306-ask-the-agent-and-run-workflows
**Mode:** `--auto` (operator: "accept WR-02 and D-41, continue"). No question was put to the operator; each area took the recommended option.
**Areas discussed:** The ask path, Tool-set closure, Wait budget and handles, Idempotency, Needs-a-person, Thread history, Workflows over MCP, Admission, Spend and audit, Verification

---

## Tool-set closure (the central risk)

| Option | Description | Selected |
|--------|-------------|----------|
| Closed allow-list of read-only tools at the producer seam; fail closed if the seam cannot be proven | Roadmap research flag; a later tool is out until added on purpose | ✓ |
| Deny-list (`POWER_TOOLS` + connector writes) | A tool added later is IN by default | |
| Edit `agent_loop.py` / `threads.py` to filter | Forbidden by ROADMAP ("How we'd know this failed") | |

[auto] Tools — Q: "Allow-list or deny-list?" → Selected: "Allow-list, fail closed" (recommended)

## Wait budget and handles

| Option | Description | Selected |
|--------|-------------|----------|
| Setting, default 30 s, bounded 5..55 s; handle + `get_answer` past it | Under the measured ~60 s Claude Code limit (305 §5) | ✓ |
| Hold the call until the run ends | Claude Code abandons at ~60 s | |
| Stream progress notifications | Client support unmeasured; deferred | |

## Idempotency

[auto] Q: "Where is the key bound?" → Selected: "Redis, credential id + idempotency key, 24 h TTL, fail closed without Redis" (roadmap research flag)

## Needs-a-person

[auto] Q: "An ask that needs input?" → Selected: "End with 'needs input in the app' + link; never answered over MCP" (MCP-04 / MCP-06)

## Thread history

[auto] Q: "How is an MCP ask marked?" → Selected: "293 origin field, new MCP kind + key label, existing mark" (roadmap: reuse 293's mark)

## Workflows over MCP

[auto] Q: "Which runs can a key read?" → Selected: "Only runs this credential started; others get the identical refusal"
[auto] Q: "Read shape?" → Selected: "`key_run_read` pure-move extraction out of `inbound.py` as the first plan" (G-5)

## Admission

| Option | Description | Selected |
|--------|-------------|----------|
| Redis in-flight leases per org / credential / provider for outside starts only; in-app untouched; fail closed | GUARD-01, SEED-081 | ✓ |
| One global limiter in front of every run | Would slow in-app users (forbidden) | |

## Spend and audit

[auto] Q: "Spend?" → Selected: "Existing runs leg of the one per_root CTE, key on the run, 305 ledger arm" — no second spend query
[auto] Q: "Audit?" → Selected: "305's per-call seam; admission refusals as `api_key.refused` with `admission:<scope>`"

## Verification

[auto] Q: "Cross-provider?" → Selected: "Full 8-row roster, per-request model/provider, blocked rows ⛔ never dropped" (CLAUDE.md)
[auto] Q: "Burst?" → Selected: "≥ 30 concurrent outside starts in every MCP verification" (305 found BUG-261031-03/-04 that way)

## Claude's Discretion

- Tool names beyond the five, sentences, admission default numbers (from SEED-081 evidence), plan split within 4-5.

## Deferred Ideas

- Follow-up turns in an existing thread; per-call model choice; MCP progress notifications; SEED-081's remaining arms; SEED-397 proxy-aware address.
