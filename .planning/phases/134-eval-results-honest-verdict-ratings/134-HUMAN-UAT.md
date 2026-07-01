---
status: complete
phase: 134-eval-results-honest-verdict-ratings
source: [134-VERIFICATION.md, 134-VALIDATION.md]
started: "2026-07-02"
updated: "2026-07-02"
driver: "Claude (self-driven per operator instruction — Chrome MCP + psycopg2 + Redis + backend logs + live API; no operator clicks)"
---

## Current Test

[testing complete — 9/9 passed. One major live-surface defect found mid-UAT was
diagnosed to root cause (SSE fetch-tap + Redis dumps + backend logs), fixed
(commit d0c0c10a), and re-verified live within the same session. Phase 134.1
(evals run silently) also shipped mid-session, incl. the POST-side anchor-thread
leak found during U-testing.]

## Tests

### 1. U1 — Cross-provider: OpenAI (EVAL-03)
expected: Eval a skill with a gpt-5.x model; cases complete. With/without arms graded; judge (`claude-opus-4-8`) verdict renders; verdict line reads "X/N passed".
result: pass
evidence: |
  Claude-driven (Chrome MCP + psycopg2 + Redis), 2026-07-02. Run b5c7c005 (openai/gpt-5.4-mini).
  Both arms status=completed, verdict_state=graded, judge_model=claude-opus-4-8 (DB).
  Redis stream clean: eval_case_started/done + eval_verdict ×2 arms → eval_complete{completed} → done{completed}.
  Rendered readout (browser): "0/1 with-skill cases passed" verdict line + per-arm "With skill · completed FAIL"
  / "Without skill · completed FAIL" each with the judge's one-line reason. Honest FAIL verdict (model claimed
  docx created without evidence) — grading honest, render correct. is_eval=True on the new eval thread (134.1 held).
note: |
  Live end-of-stream glitch observed once: session showed "Eval run ended with an error." + stale "Run … · running"
  until reload, though the server stream closed clean (done{completed}) and the DB was completed. Durable readout
  correct after remount. Logged for observation on U2-U4 with console/network tracking enabled (see Gaps).

### 2. U2 — Cross-provider: Anthropic (EVAL-03)
expected: Eval with claude-opus/sonnet (provider-under-test == judge provider). Judge still independent-model-resolved; verdict honest; no self-judge shortcut.
result: pass
evidence: |
  Run 2f9af975 (anthropic/claude-opus-4-8 — judge model == tested model). with_skill: completed,
  graded FAIL·15 by claude-opus-4-8 (explicit provider= routing; no self-judge skip). without_skill:
  hit the REAL BUG-260701-01 prefill 400 → verdict_state=not_measured, verdict_passed=NULL,
  judge_model=NULL (judge never called — D-04 gate held under a real provider error). Rollup 0/1
  counts only measured. Redis stream clean (eval_* → eval_complete{completed} → done{completed}).
  (This row also pre-proves U8's honesty mechanics on a real 400 — U8 re-proves on claude-sonnet-5.)

### 3. U3 — Cross-provider: Google (EVAL-03)
expected: Eval with gemini-3.x. Single-typed verdict fields survive (no Gemini `type:[...]` trap); verdict renders.
result: pass
evidence: |
  Run ee7d81b0 (google/gemini-3.5-flash). Both arms completed + graded by claude-opus-4-8 — the
  single-typed JudgeVerdict fields survived (no Gemini type:[...] rejection; note the judge itself
  is Anthropic-routed, so the Gemini trap applies to the ARM completions, which succeeded). Durable
  readout renders the verdict. (Live view of this run was killed at open by the pre-fix race — see
  the diagnosed defect below; durable path verified via DB + post-fix rendering.)

### 4. U4 — Cross-provider: OpenRouter (EVAL-03)
expected: Eval with an OpenRouter representative. Verdict honest; OpenRouter treated as experimental (native-safe).
result: pass
evidence: |
  Run 23b584be (openrouter/moonshotai/kimi-k2.6) — run AFTER the live-surface fix landed, so this row
  also live-verifies the whole fixed flow end-to-end in the browser: eval_run_started seed at open,
  live per-arm rows ("with_skill → completed · FAIL" badge from eval_verdict SSE, "without_skill →
  running"), heartbeats keeping the stream alive through a 9-minute run, then AUTO-FINAL readout with
  NO manual reload: "Run 23b584be · completed" + "0/1 with-skill cases passed" + side-by-side arms with
  judge reasons + raw outputs. Both arms graded (FAIL 25 / FAIL 0 — honest: the model narrated a docx
  without evidence). A first attempt (ef1b938e) was killed by a backend --reload restart mid-run
  (BUG-260702-02 class, restart triggered by UAT's own earlier backend edits) — cleaned up to
  status=interrupted and re-run.

### 5. U5 — Multi-tool (EVAL-03)
expected: A case whose prompt exercises 2+ tools (`search_documents` + `execute_code`) with-skill. The multi-tool answer is graded; verdict reflects the actual deliverable.
result: pass
evidence: |
  Temp multi-tool case added via API (search Meridian risks + compute count/avg), run 787dedd5
  (openai/gpt-5.5, 3 cases). BOTH tools proven genuinely exercised: the graded answer names REAL
  KB artifacts (risk-log.md, Project-Meridian-Risk-Workshop-Notes.docx, risks M-01/M-04/M-05/
  M-06/M-07 — live search_documents against the Phase-097 corpus) + sandbox logs show real docx
  files built and uploaded during the run (execute_code). with_skill graded PASS·88; the judge's
  verdict cites the actual deliverable. Multi-case rollup correct: "2/3 with-skill cases passed".
  Temp case deleted after (docx restored to 1 case).

### 6. U6 — Parallel-thread (EVAL-03)
expected: Eval run streaming on skill A while chat thread B streams. No cross-talk; `eval_*`/verdict events only on the eval run buffer; both readouts correct.
result: pass
evidence: |
  While eval run 787dedd5 (docx, gpt-5.5, 3 cases) streamed live in the browser, thread B
  (d50a7e37) was created + streamed a chat completion via the API concurrently. Thread B's
  stream: iteration_start + 8 deltas + suggestions + stream_end — ZERO eval_* events. Eval
  buffer simultaneously: ONLY eval_* vocab (eval_run_started/case_started/heartbeat×3/
  case_done/verdict) — ZERO chat vocab. Eval UI kept live-rendering correctly mid-run
  ("with_skill → completed · FAIL", "without_skill → running") while thread B completed.
  Isolation holds in both directions.

### 7. U7 — Long-history (EVAL-03)
expected: A case with a ≥5 KB prompt (or long accumulated eval-thread context). Grading completes; no truncation of the verdict (forced-emit truncation-safe).
result: pass
evidence: |
  Temp case with a 7,453-byte prompt (24 numbered requirement paragraphs), same run 787dedd5.
  Grading completed: with_skill graded PASS·80, verdict_reason intact (541 chars, coherent —
  "reflects the long requirement list via numbered sections 1–24"; no truncation). The actual
  deliverable existed: sandbox uploaded mock_requirements_page.docx (40,499 bytes) during the
  run. Temp case deleted after.

### 8. U8 — Errored-arm honesty (EVAL-03 SC#1 / D-04 / D-11) — MOST LOAD-BEARING
expected: A without-skill baseline on claude-sonnet-5 hits the known BUG-260701-01 (assistant-prefill 400); that arm renders "not measured" (never a fabricated score); the with-skill arm, if it completes, still grades; rollup counts only measured cases.
result: pass
evidence: |
  Run d96e9a50 (anthropic/claude-sonnet-5). without_skill hit the REAL prefill 400
  (BadRequestError: 'This model does not support assistant message prefill') → DB:
  status=failed, verdict_state=not_measured, verdict_passed=NULL, judge_model=NULL
  (judge never called). BROWSER RENDER: "Without skill · failed" + "not measured" badge
  + the truncated real error — never a fabricated score. with_skill: completed, graded
  PASS·82 by claude-opus-4-8 (first judge-PASS of the session — sonnet-5 with the skill).
  Rollup renders "1/1 with-skill cases passed" — the errored baseline honestly EXCLUDED
  from the denominator. D-04 honesty gate proven against a genuine provider error, live.

### 9. U9 — Ratings persistence (EVAL-04)
expected: Thumbs up/down an answer, reload the run, re-rate (toggle/clear). Rating persists across reload; re-rating updates; a thumbs-DOWN on a judge-PASSED answer is captured (human↔judge disagreement signal for SI-01).
result: pass
evidence: |
  Live browser click-through on run d96e9a50's with-skill PASS answer (Chrome MCP):
  (1) thumbs-DOWN → button flips active (text-destructive), DB row rating='down' on a
  verdict_passed=TRUE result — the exact SI-01 disagreement combo. (2) FULL page reload
  → fresh mount renders the down-thumb ACTIVE + "1/1 with-skill cases passed" from the
  durable readout (persistence ✓). (3) toggle to UP → up active/down inactive; (4) clear
  (UP again) → nothing active; (5) re-rate DOWN → active again. DB throughout: EXACTLY 1
  eval_ratings row (UNIQUE upsert — never duplicated). Phase-135 disagreement query
  (verdict_passed IS TRUE AND rating='down') returns 1 row — signal captured + queryable.

## Summary

total: 9
passed: 9
issues: 0 open (1 major found mid-UAT → diagnosed → fixed → re-verified live, commit d0c0c10a)
pending: 0
skipped: 0
blocked: 0

runs_executed: 7 live eval runs (b5c7c005 openai/gpt-5.4-mini · 2f9af975 anthropic/opus-4-8 ·
  ee7d81b0 google/gemini-3.5-flash · ef1b938e openrouter/kimi-k2.6 [orphaned by --reload restart,
  cleaned] · 23b584be openrouter/kimi-k2.6 · d96e9a50 anthropic/claude-sonnet-5 · 787dedd5
  openai/gpt-5.5 3-case) + 1 parallel chat thread

## Gaps

<!-- Cross-cutting observations surfaced during UAT (not a single-U-test failure) -->
- observation: "Eval runs create real, visible chat threads that pollute the sidebar (34 = 10% of threads; 17 empty / 17 populated). Eval should run silently, DB-only."
  status: FIXED + live-verified (Phase 134.1, commits b073cced/58ec1da6; UAT follow-up: the POST-side
    anchor thread — the 'empty twin' — was a second uncovered creation site in evals.py, fixed during
    UAT; both threads per run now is_eval=true, sidebar clean)
  routed_to: "BUG-260702-01 (major) → folded into 134.1"
  severity: major
  during_test: 1
- observation: "Judge model (claude-opus-4-8 default) is settings-backed (harness_judge_model) but has NO Settings UI; single-provider/local-model orgs need it configurable."
  status: logged
  routed_to: "enhancement → SEED-100 / admin-panel plan (project_admin_panel_plan)"
  severity: minor
  during_test: 1

- truth: "The LIVE eval view survives to the final verdict — no spurious 'Eval run ended with an error.' + stale 'running' readout on a run that completed"
  status: failed → diagnosed → FIXED during UAT (live-verified on run 23b584be)
  reason: "Deterministic on every pre-fix run (U1/U2/U3). TWO server-side mechanisms, both eval-scoped
    violations of liveness invariants the chat stream guarantees: (a) open race — the POST returned the
    run_id before the job's first XADD, so a fast subscribe found no run:{id} key and GET /runs/{id}/stream
    Step 3b synthesized {type:error, error:buffer_expired_while_streaming} (tap-captured on ee7d81b0);
    (b) silent-arm timeout — eval arms emit nothing for their whole 40-70s (NO-OP emit swallows loop
    deltas), so the replay-tail consumer's Redis XREAD hit its ~30s socket timeout mid-run and closed with
    a synthetic error (backend logs: 'xread (tail phase) socket timeout' at +32s/+34s on b5c7c005/2f9af975).
    Client aggravator: SkillEvalSection treated ANY error terminal as fatal, fetched the readout once
    mid-run ('running', 0 rows) and never refreshed."
  severity: major
  test: 1
  root_cause: "eval stream lacked chat's liveness invariants (buffer-exists-before-subscribe + no-silent-gaps) + no client self-heal"
  artifacts:
    - path: "backend/app/api/evals.py"
      issue: "POST returned run_id before any XADD → open race (fixed: seed eval_run_started before return)"
    - path: "backend/app/services/eval_runner_service.py"
      issue: "arms silent for their full duration (fixed: eval_heartbeat pulse every 15s wrapping _run_arm)"
    - path: "frontend/src/components/skills/SkillEvalSection.tsx"
      issue: "fatal-error render on transient stream drops (fixed: bounded re-attach self-heal, durable-status probed)"
  missing: []
  debug_session: "inline (SSE fetch-tap in live page + Redis stream dumps + per-process backend logs)"
  fix_verified: "run 23b584be: 9-minute OpenRouter run, live badges throughout, auto-final readout, zero errors; 15/15 backend tests (incl. new test_arm_heartbeat_keeps_buffer_warm); vite build green"
