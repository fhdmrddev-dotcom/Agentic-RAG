---
status: complete
phase: 141-template-input-resolver-run-scope-stretch
source: [141-VERIFICATION.md]
started: "2026-07-07T19:38:36Z"
updated: "2026-07-08T00:35:00Z"
resolution: "operator-accepted resolver-verified (2026-07-08); D-141-07 render SMOKE premise corrected (workflow-fill-only tool) and re-scoped to a workflow run as a non-blocking follow-up. No code gap."
---

## Current Test

[session concluded — operator accepted resolver-verified. Both items blocked by an invalid Deep-turn premise; render SMOKE re-scoped to a workflow fill-phase run (141-VALIDATION.md, corrected) as a non-blocking follow-up. Verification flipped human_needed → passed.]

## Tests

### 1. D-141-07 cross-provider render SMOKE
expected: One representative model (any single provider — the resolver is provider-agnostic; NOT the full SC#10 4-axis) uploads a `.docx` in a Deep turn and renders it via `render_template`. The deliverable is produced, in-scope, and byte-correct — no regression against the now-live `run_claim` column.
result: blocked
blocked_by: test-premise-invalid
reason: |
  Live Chrome UAT (Anthropic/claude-sonnet-5, fresh Deep chat) established that `render_template` is NOT reachable from a Deep turn. Verified two ways:
  (a) The agent, given the exact args, replied it has no `render_template` tool and refused to fake it.
  (b) Backend confirms by design: `get_tools(user_settings)` has NO `render_template`; it is appended to the tool candidate list ONLY when a workflow FILL phase whitelist admits `"render_template"` (`phase_types.py:265,275`; `openai_service.py:649-650`). It is a workflow-fill-only tool, never a Deep-chat tool.
  Steps that DID work live: fresh Deep thread created; a minimal .docx template uploaded to the thread's workspace (panel shows FILES 1, `TEMPLATE`, 1004 B, expires 23h — the ephemeral template_input row); the agent's `workspace_list` found it. Only the render step is unreachable in Deep mode.
  This is a UAT-premise defect, NOT a Phase 141 code defect. The resolver mechanism itself IS verified: 13/13 automated (`test_141_run_scope.py`), the verifier's rollback-only live-DB psycopg2 probe using the production WHERE/foreign-probe SQL, and secure-phase 10/10 (threats_open 0).
  CORRECT re-scope: exercise `render_template` inside a WORKFLOW run that has a render_template fill phase consuming a thread template — Deep chat cannot drive it.

### 2. (Optional) Live cross-run repro lived-glance
expected: A workflow-phase render claims the template (stamps `run_claim = str(W)`); a subsequent Deep-turn render attempt on the same template surfaces the honest "This template belongs to a different run or context. Upload it again for this run." message — never the file bytes, never the foreign run's id/filename. Same-mode reuse (Deep→Deep, same-workflow-run across phases) still resolves normally.
result: blocked
blocked_by: test-premise-invalid
reason: |
  Depends on Test 1's render_template path. The claim is stamped by `resolve_template_source` on first resolve, which only runs via `render_template` (workflow-fill-only) — so staging both a workflow-run claim AND a Deep render attempt requires a workflow with a render_template fill phase, not a Deep turn. Cross-run block is already proven at the SQL level by the verifier's live production-SQL probe.

## Summary

total: 2
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 2

## Gaps

<!-- No resolver/code gap. The gap is in the UAT premise (D-141-07 as worded assumes a Deep-turn render, but render_template is a workflow-fill-only tool). Re-scope the render SMOKE to a workflow fill-phase run. Resolver correctness stands on: 13/13 automated + verifier live production-SQL probe + secure 10/10. -->
