---
phase: 081
status: green
created: 2026-05-27
updated: 2026-05-27
green_count: 4
red_count: 0
gate: 4/4 runs GREEN required for phase close
---

# Phase 081: SEED-010 OpenRouter UAT Scoreboard

## Original .env Value (RESTORE AFTER UAT)

```
LLM_CALL_TIMEOUT_OVERRIDES=minimax/minimax-m2.5:free=900,moonshotai/kimi-k2.5=900,moonshotai/kimi-k2.6=900,minimax/minimax-m2.7=1800,claude-sonnet-4-6=1800,claude-opus-4-6=1800,claude-opus-4-7=1800,claude-sonnet-4-5=1800
```

## Pre-conditions Checklist

- [x] `backend/.env` contains `LLM_CALL_TIMEOUT_OVERRIDES` with `moonshotai/kimi-k2.5=10` and `minimax/minimax-m2.7=10`
- [x] Operator has restarted uvicorn after the .env change
- [x] Backend log shows: `LLM_CALL_TIMEOUT_OVERRIDES: tight per-call budget for 'moonshotai/kimi-k2.5': 10s` AND `tight per-call budget for 'minimax/minimax-m2.7': 10s`
- [x] Logged in as `fhdmrd@gmail.com` at `http://localhost:5173/`

## UAT Runs

### Row 1 — Kimi-k2.5 Simple Chat — GREEN

- **Model:** `moonshotai/kimi-k2.5` via OpenRouter
- **Prompt:** "Write a detailed 2000-word analysis of the evolution of artificial intelligence from the 1950s to present day, covering key milestones, breakthroughs, and paradigm shifts in the field."
- **Expected:** times out within ~10-15s
- **Verify DB:** `runs.status = 'timed_out'`, `runs.error` contains `'timed_out: 10s per-call deadline exceeded at iteration'` (NOT `GeneratorExit`)
- **Verify logs:** backend stdout shows `Run {run_id} timed out at iteration N (model=moonshotai/kimi-k2.5, budget=10s)`
- **Verify frontend:** timeout badge/error state visible on the message; title generated in sidebar
- **BUG-260526-02 observation:** [x] no leakage on OpenRouter route (no thinking/reasoning text visible before timeout)
- **run_id:** `908df10a-6308-4c19-b2c5-3cb124b589eb`
- **DB status:** `timed_out`
- **DB error:** `timed_out: 10s per-call deadline exceeded at iteration 2 (model=moonshotai/kimi-k2.5)`
- **Frontend observation:** Run card shows "Run · 4 tools · timed out - output limit · Step 3". Partial content streamed (intro paragraph of AI essay). "Resume" button visible. "Agent reached time limit" message displayed below content.
- **Title generated:** Yes — "Evolution of Artificial Intelligence: Key Milestones"
- **Verdict:** [x] GREEN

### Row 2 — Kimi-k2.5 Tool-Calling — GREEN

- **Model:** `moonshotai/kimi-k2.5` via OpenRouter
- **Prompt:** "Search my documents for any research about machine learning and write a comprehensive summary of the findings."
- **Expected:** times out during agent loop iteration (tool call or post-tool LLM call)
- **Verify DB:** `runs.status = 'timed_out'`, `runs.error` contains `'timed_out: 10s per-call deadline exceeded at iteration'` (NOT `GeneratorExit`)
- **Verify logs:** backend stdout shows `Run {run_id} timed out at iteration N (model=moonshotai/kimi-k2.5, budget=10s)`
- **Verify frontend:** timeout badge/error state visible on the message; title generated in sidebar
- **BUG-260526-02 observation:** [x] no leakage on OpenRouter route (no thinking/reasoning text visible)
- **run_id:** `1519d249-2f5c-454d-8ac1-94b04ccb706d`
- **DB status:** `timed_out`
- **DB error:** `timed_out: 10s per-call deadline exceeded at iteration 4 (model=moonshotai/kimi-k2.5)`
- **Frontend observation:** Run card shows "Run · 4 tools · timed out - output limit · Step 5" with 31.5s elapsed. Agent executed 4 tool calls (search_documents), found RPA/ML documents, produced partial summary referencing "Fahed Mrad Chapters 1-4.docx". "Resume" button + "Agent reached time limit" displayed.
- **Title generated:** Yes — "Machine Learning Research Summary Findings"
- **Verdict:** [x] GREEN

### Row 3 — MiniMax-m2.7 Simple Chat — GREEN

- **Model:** `minimax/minimax-m2.7` via OpenRouter
- **Prompt:** "Write a detailed 2000-word analysis of the evolution of artificial intelligence from the 1950s to present day, covering key milestones, breakthroughs, and paradigm shifts in the field."
- **Expected:** times out within ~10-15s
- **Verify DB:** `runs.status = 'timed_out'`, `runs.error` contains `'timed_out: 10s per-call deadline exceeded at iteration'` (NOT `GeneratorExit`)
- **Verify logs:** backend stdout shows `Run {run_id} timed out at iteration N (model=minimax/minimax-m2.7, budget=10s)`
- **Verify frontend:** timeout badge/error state visible on the message; title generated in sidebar
- **run_id:** `5838affc-ef61-4f74-9b2d-8b515b4f2798`
- **DB status:** `timed_out`
- **DB error:** `timed_out: 10s per-call deadline exceeded at iteration 1 (model=minimax/minimax-m2.7)`
- **Frontend observation:** Run card shows "Run · 1 tool · timed out - output limit · Step 2" with 14.3s elapsed. "Agent reached time limit" displayed twice (once as heading, once as detail text). No content streamed before timeout.
- **Title generated:** Yes — "Evolution of Artificial Intelligence: 1950s to Present"
- **Verdict:** [x] GREEN

### Row 4 — MiniMax-m2.7 Tool-Calling — GREEN

- **Model:** `minimax/minimax-m2.7` via OpenRouter
- **Prompt:** "Search my documents for any research about machine learning and write a comprehensive summary of the findings."
- **Expected:** times out during agent loop iteration
- **Verify DB:** `runs.status = 'timed_out'`, `runs.error` contains `'timed_out: 10s per-call deadline exceeded at iteration'` (NOT `GeneratorExit`)
- **Verify logs:** backend stdout shows `Run {run_id} timed out at iteration N (model=minimax/minimax-m2.7, budget=10s)`
- **Verify frontend:** timeout badge/error state visible on the message; title generated in sidebar
- **run_id:** `7b873a9e-7d06-462c-a7a1-a070f764dcd1`
- **DB status:** `timed_out`
- **DB error:** `timed_out: 10s per-call deadline exceeded at iteration 0 (model=minimax/minimax-m2.7)`
- **Frontend observation:** "Agent reached time limit" displayed. Timed out at iteration 0 — model did not produce any content before the 10s deadline. Backend logged: `Agent loop produced no content for thread f27882c8-... — persisting empty assistant message` and `runs.usage missing for run=7b873a9e-... provider=openrouter model=minimax/minimax-m2.7`.
- **Title generated:** Yes — "Comprehensive Machine Learning Research Summary"
- **Verdict:** [x] GREEN

## BUG-260526-02 Observation Summary

- **Kimi-k2.5 on OpenRouter:** [x] no leakage — no thinking/reasoning text was visible in either the simple chat or tool-calling runs on the OpenRouter route. BUG-260526-02 appears to be specific to the direct Moonshot API route, not the OpenRouter proxy.
- **Action:** No update to `.planning/reported-bugs/kimi-thinking-leaks-into-content.md` needed — the bug scope remains direct Moonshot API only.

## Post-UAT Cleanup

- [x] `backend/.env` restored to original `LLM_CALL_TIMEOUT_OVERRIDES` value (see top of this file)
- [ ] Operator has restarted uvicorn after restore
