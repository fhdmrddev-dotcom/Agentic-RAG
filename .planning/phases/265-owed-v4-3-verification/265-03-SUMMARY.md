---
phase: 265-owed-v4-3-verification
plan: 03
subsystem: verification
tags: [VERIFY-03, D-08, live-uat]
requirements: [VERIFY-03]
key-files:
  modified:
    - .planning/phases/265-owed-v4-3-verification/265-UAT-LOG.md
    - .planning/milestones/v4.3-phases/256-every-token-is-counted-and-kept/256-VERIFICATION.md
    - .planning/milestones/v4.3-phases/261-an-expert-you-can-author/261-VERIFICATION.md
    - scripts/launch-langsmith-mcp.py
    - .gitignore
completed: 2026-09-24
---

# 265-03 Summary — 256's two owed rows (D-08) and 261's three rows (VERIFY-03)

**All five rows are driven and all five PASS.** Two of them carry the operator's own verdict (D-06).

| id | result | one line |
|---|---|---|
| UAT-265-256-2 | ✅ PASS | a REAL process restart (PID 56412 → 54832, listener gone, curl exit 7 in between); a77ed2c0 still reads 135142 / 10317 / 4 legs in the DB, and the API prices exactly those tokens ($0.0529) |
| UAT-265-256-3 | ✅ PASS | a real-provider gauntlet reached the QUAL-01 judge; persisted judge delta +506 / +250 = LangSmith's reported usage for the single `gpt-5.4-mini` judge shot (exact); obs `-OBS`: the LangSmith run is named "ChatDeepseek" |
| UAT-265-261-1 | ✅ PASS (operator) | authoring: bundles 3 → 3 (draft, pre-Save) → 4 (Save) → 3 (delete), documents at 165 throughout, the PDF is nowhere in the Library |
| UAT-265-261-2-user / -role | ✅ PASS | three distinct accounts and `created_by ≠ caller` on every line: outside gets 404/404 and is not listed, inside gets 200 and a successful invite, for both the user grant and the role grant |
| UAT-265-261-3 | ✅ PASS (operator) | union: one run read Train-the-Trainer (thread folder ToT) and the billing SOP (Expert folder SOPs); tool floor: `execute_code` wrote `uat265-summary.md` (2547 B) |

## Fixtures (kept; removal SQL is in the log)

`uat265-author` (org-admin), `uat265-inside` (dept-admin), `uat265-outside` (member): each has ONE membership in the
dev org `22f9c615`. Also kept: Expert `253ba288…` (granted), the probe threads, and the draft `2f39686b…`
"UAT-265 judge probe".

## Deviations

1. **Inline orchestrator execution:** the plan needs Chrome MCP and LangSmith MCP.
2. **LangSmith unblock:** `langsmith-mcp-server` had never been installed. Installing it into `backend/venv` would
   move the uvicorn and langsmith pins and add langchain-core, so it went into a gitignored
   `.tools/langsmith-mcp-venv`, which the launcher now prefers. The operator reconnected.
3. **256 row 3 method:** the judge delta was read as the golden row's after-judge minus at-completion value, rather
   than persisted − Σ(non-judge calls). LangSmith's 30k page budget cannot return streamed usage fields, so the
   provider side was matched with FQL equality filters plus negative controls. The golden draft was a COPY with its
   `send_email` step removed.
4. **261 row 3 first attempt as the author found no documents:** both folders are the operator's private ones.
   Re-driven as the owner; recorded as triage input `UAT-265-261-3-ACCESS`.
5. **261 row 2 reset quirk:** `active_expert_id: null` does not clear an Expert (`clear_active_expert` does). The
   positive control still holds (see the log).
6. No screenshots (the tab was hidden). Evidence is API captures, rendered text, SQL and LangSmith.

## Triage inputs for plan 05

`UAT-265-261-3-ACCESS` (an Expert or thread may name folders the caller cannot read; a granted Expert carries no
folder access) · `UAT-265-256-3-OBS` (the LangSmith run name mislabels the provider).

## Self-Check: PASSED
(256-VERIFICATION `driven:` count 2 · 261-VERIFICATION `driven:` 3, `operator_confirmed:` 2, `pending` 0 · no
password or token in `.planning`)
