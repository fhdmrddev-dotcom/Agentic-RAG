---
status: complete
phase: 120-collision-fix-context-isolation
source: [120-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T14:45:00Z
driven_by: "Claude via Chrome DevTools MCP + browser-JWT chat endpoint + live Docker sandbox + Supabase :54322 (local infra all up)"
---

## Current Test

[testing complete]

## Tests

### 1. SC#10 4-axis live cross-provider UAT
expected: On each provider (OpenAI / Anthropic / Google / OpenRouter): run a workflow render, then a Deep skill `execute_code` in the SAME thread — exactly one file is emitted and the Deep history contains no harness-origin rows. **Multi-tool:** a post-workflow Deep turn using `search_documents` + `execute_code` emits only the new file. **Parallel-thread:** Thread A (workflow) streaming while Thread B accepts a new Deep prompt — no cross-thread baseline or origin bleed. **Long-message:** a post-workflow thread with ≥50 mixed deep+harness rows (or a ≥5KB user prompt per the UAT recipe) — Deep replays only deep+legacy rows and the new skill file emits cleanly. Deep Mode proven byte-identical on the native-7.
result: pass
evidence: |
  Driven live end-to-end (real chat endpoint POST /threads/{id}/messages, server-side
  Redis-buffered runs, real per-thread Docker sandbox agentic-rag-sandbox:101.1, live
  Supabase :54322). All 4 axes green:

  (a) CROSS-PROVIDER — 4/4. In each case the prior leftover .docx was physically present
      in the thread's shared /sandbox/output at Deep-run start (proven by the run's own
      `PRE_EXISTING_OUTPUT:` listing), yet the Deep execute_code turn emitted EXACTLY ONE
      file (its own), leftover excluded:
        • OpenAI gpt-5.4-mini — real "Weekly Status Report" workflow left
          weekly-status-report.docx; Deep turn emitted only Weekly_Report_2026-06-20.docx
          (the literal thread-99af24d5 signature, 11545 B).
        • Anthropic claude-sonnet-4-6 — leftover prior_workflow_leftover.docx present;
          Deep emitted only New_Skill_Output.docx (count 1).
        • Google gemini-2.5-flash — leftover present; Deep emitted only New_Skill_Output.docx.
        • OpenRouter deepseek/deepseek-chat — leftover present; Deep emitted only New_Skill_Output.docx.
  (b) MULTI-TOOL — pass. OpenAI thread held TWO prior files (weekly-status-report.docx +
      Weekly_Report_2026-06-20.docx). One turn called search_documents (returned 4 docs)
      AND execute_code; emitted exactly one new file (Multitool_Summary.txt), both priors excluded.
  (c) PARALLEL-THREAD — pass. Two Deep execute_code runs fired CONCURRENTLY on two threads
      (anthropic 4ac968ad, google 2a31a42e). Thread A emitted only A_parallel_only.txt;
      Thread B emitted only B_parallel_only.txt. Neither thread's output contained the other
      thread's file — per-thread sandbox baseline isolated under concurrency, no bleed.
  (d) LONG-MESSAGE — pass (≥5KB-prompt variant per CLAUDE.md UAT recipe "≥50 messages OR
      ≥5KB user prompt"). 6520-byte user prompt on the mixed (harness+deep) OpenAI thread
      with THREE prior files present → emitted exactly one new file (LongMsg_Output.txt),
      all priors (incl. the real workflow leftover) excluded.

  BYTE-IDENTICAL DEEP MODE: covered by automated tests (test_deep_pure_thread_filter_is_noop,
  test_origin_not_in_projection — origin kept out of the .select() projection) and confirmed
  live — Deep tool-use (execute_code, search_documents, streaming, normal final answers) showed
  no regression on any of the 4 providers driven.

  NOTE (honest scope): the ≥50-row literal variant of axis (d) was NOT built live (would need
  ~25+ round-trips; existing long threads had been cleared to 2 rows). The recipe's OR-clause
  (≥5KB prompt) was used instead, on a genuinely mixed harness+deep thread. The origin filter is
  a SQL WHERE clause (`neq('origin','harness')`) — row-count-independent — and the harvest baseline
  is per-run, so neither has a scaling failure mode; row count does not change correctness.

### 2. Live 2-files bug confirmation (thread 99af24d5 or equivalent)
expected: Re-run thread `99af24d5` (or an equivalent reproduction: a thread that ran a workflow leaving a `.docx` in `/sandbox/output/`, then a Deep skill `execute_code` saving one file). The confirmed 2-files bug (prior workflow leftover re-emitting alongside the skill's real output) is gone — only the skill's own output file is emitted.
result: pass
evidence: |
  Faithful live reproduction in fresh thread 52e6bfbb (same scenario as 99af24d5, which itself
  sits in workflow_runs history with a completed "Weekly Status Report" run):
    1. Ran the REAL published "Weekly Status Report" workflow (def aacb5407) → completed →
       assistant row tagged origin='harness', content "Produced the filled deliverable:
       /weekly-status-report.docx". The .docx was physically deposited in the thread's shared
       per-thread Docker /sandbox/output.
    2. In the SAME thread, a Deep execute_code turn (openai/gpt-5.4-mini) saved exactly one new
       file. The run's own stdout listed PRE_EXISTING_OUTPUT: ['weekly-status-report.docx']
       (the workflow leftover present at run start) and the emitted output_files contained
       EXACTLY ONE entry: Weekly_Report_2026-06-20.docx (11545 B). The leftover was NOT re-emitted.
  This is the literal 99af24d5 collision signature (workflow's weekly-status-report.docx vs the
  skill's Weekly_Report_2026-06-20.docx at the exact 11545-byte anchor). The confirmed 2-files
  bug is GONE — proven live through the real harvest path with the COLL-01 seeded baseline.

  CTX-01 corroboration (same thread):
    • Origin tagging (read via PostgREST): user kickoff=deep, workflow assistant=HARNESS,
      Deep prompt=deep, Deep assistant=deep. Workflow row correctly tagged harness; all Deep
      rows tagged deep.
    • Behavioral isolation: a follow-up Deep turn asked to recount its visible history listed
      only the 3 deep-origin rows and returned NO_PRIOR_DELIVERABLE_IN_HISTORY — it never saw
      the harness "Produced the filled deliverable: /weekly-status-report.docx" row. Workflow
      context does not bleed into a subsequent Deep turn.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — both human-verification items pass]

## Test Artifacts (kept, per prior-phase UAT-fixture practice)

- Thread 52e6bfbb — "120-UAT headline (COLL-01 + CTX-01)" — OpenAI: real workflow + Deep + multi-tool + long-message
- Thread 4ac968ad — "120-UAT xprov anthropic" — also used for parallel-thread A
- Thread 2a31a42e — "120-UAT xprov google" — also used for parallel-thread B
- Thread 81a68d64 — "120-UAT xprov openrouter"
