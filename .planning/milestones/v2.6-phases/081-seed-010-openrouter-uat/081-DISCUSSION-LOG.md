# Phase 081: SEED-010 OpenRouter UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 081-seed-010-openrouter-uat
**Areas discussed:** Verification depth, Test prompt design, BUG-260526-02 scope

---

## Verification Depth

| Option | Description | Selected |
|--------|-------------|----------|
| DB + logs only | Check runs.status='timed_out' in Supabase + backend logs show clean timeout format. Same depth as 067.2 Row 8. Quick, matches the ~30 min time box. | |
| DB + logs + frontend | Also verify the frontend shows a timeout badge/error state, and title generation works. Adds Chrome MCP verification but takes longer. | ✓ |
| Full pipeline | DB + logs + frontend + SSE event replay + LangSmith trace. Thorough but may exceed 30 min for 4 runs. | |

**User's choice:** DB + logs + frontend
**Notes:** Adds frontend verification via Chrome MCP on top of the 067.2 Row 8 precedent. SSE replay and LangSmith are excluded to stay within time box.

---

## Test Prompt Design

| Option | Description | Selected |
|--------|-------------|----------|
| 1 simple + 1 tool-call per model | Per model: Run 1 = simple chat prompt. Run 2 = multi-tool prompt. Tests both plain-timeout and mid-agent-loop timeout. | ✓ |
| All simple prompts | All 4 runs use simple chat prompts. Simpler but doesn't test mid-tool-call timeout. | |
| You decide | Claude picks appropriate prompts during execution. | |

**User's choice:** 1 simple + 1 tool-call per model
**Notes:** Covers both streaming timeout and agent-loop timeout paths.

---

## BUG-260526-02 Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Observe and document | During the 4 runs, note whether OpenRouter-routed Kimi exhibits thinking leakage. Document as observation. Does NOT affect pass/fail. | ✓ |
| Fold as formal gate | Add a 5th check: verify no thinking text in Kimi responses on OpenRouter. Phase RED if found. | |
| Ignore entirely | Don't check for thinking leakage at all. | |

**User's choice:** Observe and document
**Notes:** Free observation opportunity since we're already exercising Kimi on OpenRouter. Won't block the timeout UAT.

---

## Claude's Discretion

- Exact prompt wording for 4 runs (must exceed 10s response time)
- Screenshot vs text-based evidence collection
- Run execution order

## Deferred Ideas

1. Title generation not working for some providers — needs new bug report
2. Duplicated summarizing agents / reading documents in tool panel — possibly BUG-260526-01 extension
3. Final output download section should be outside tool panel — UX feature request
4. Overall timer sometimes does not appear — BUG-260526-04 (already tracked)
5. Pulsing app logo below tool panel (Claude.ai-style "still working" indicator) — UX feature request
