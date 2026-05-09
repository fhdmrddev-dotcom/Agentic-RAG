---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 05
type: execute
wave: 4
depends_on: ["02", "03", "04"]
files_modified:
  - .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md
autonomous: false
requirements:
  - STREAM-04-polish

must_haves:
  truths:
    - "User's verbatim Gap-006 prompt completes end-to-end in dev app (no mid-iteration stop) — SC#1 + live regression"
    - "When a synthetic timeout is forced (LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10), the assistant message renders the 'Agent reached time limit' banner and a Resume button — confirms Plan 03 UI wiring is live"
    - "Clicking Resume re-POSTs the original prompt with full conversation context (returns assistant content; no error)"
    - "LangSmith dashboard trace for the synthetic-timeout run shows clean termination — NO `GeneratorExit` warning at run_helpers.py:1680"
    - "066-HUMAN-UAT.md filled with concrete observations: timestamps, screenshots-or-text-evidence, run_id values, LangSmith trace URLs"
    - "Final 066-HUMAN-UAT.md status: approved (or partial with explicit carry-forward justification per Phase 063 / 063.1 precedent)"
  artifacts:
    - path: ".planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md"
      provides: "Live UAT scoreboard for the 7 ROADMAP success criteria + Gap-006 regression evidence"
      contains: "Gap-006"
  key_links:
    - from: "Plan 02 per-LLM-call timer + Plan 03 frontend banner"
      to: "Live user observation in dev app"
      via: "Chrome MCP browser session at http://localhost:5173/"
      pattern: "approved"
    - from: "Plan 02 D-066-11 close-then-raise"
      to: "LangSmith dashboard trace inspection"
      via: "Manual browse to LangSmith project trace tree"
      pattern: "no GeneratorExit"
---

<objective>
Close Phase 066 by exercising the full backend + frontend stack under real conditions and recording observable evidence in `066-HUMAN-UAT.md`. The single-most-important assertion: re-run the user's verbatim Gap-006 prompt ("search for research authored by Fahed Mrad → professional short report → charts/diagrams → docx") and observe end-to-end completion. The single most important secondary assertion: force a synthetic per-LLM-call timeout and observe the new `timed_out` UX (banner + Resume) end-to-end, confirming Plan 02 + Plan 03 wiring is live, not just tested.

Purpose: Plans 01-04 deliver the contract; Plan 05 confirms the user's actual-world workflow is restored. Without this, the phase ships without proof that the Gap-006 user report is closed. This is the only plan that exercises real LLMs + real tools (sandbox, web_search, sub-agent, execute_code) at full fidelity — the test suite (Plan 04) covers correctness of the timeout machinery in isolation but not end-to-end agentic workflow restoration.

Output: `066-HUMAN-UAT.md` filled with structured evidence; one commit closing the phase.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-VALIDATION.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-02-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-03-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-04-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md

<interfaces>
<!-- The HUMAN-UAT.md format mirrors Phase 063.1's filled scoreboard. -->

Reference shape from .planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md:
- Frontmatter: phase, status (partial / approved), reviewed_at, project-level-approval boolean
- Sections: ## Summary, ## Success Criteria Scoreboard (table), ## Gaps (numbered), ## Evidence (per SC), ## Sign-off

User credentials (from MEMORY.md `reference_local_dev_app.md`):
- Dev app: http://localhost:5173/
- Test login: fhdmrd@gmail.com / 123456

Chrome MCP availability (from MEMORY.md `feedback_chrome_mcp_testing.md`): drive a real browser to verify UI changes.

Gap-006 verbatim prompt (from 063.1-HUMAN-UAT.md):
> "search for research authored by Fahed Mrad → professional short report → charts/diagrams → docx"
</interfaces>

<key_decisions>
**UAT structure follows the Phase 063.1 precedent.** Same scoreboard shape, same evidence-per-SC layout, same approval bifurcation (project-level approval vs UAT-file status — UAT can be `partial` while project is `approved` if carry-forward is non-blocking).

**Two distinct UAT runs:**
1. **Gap-006 regression (PRIMARY):** Re-run the user's exact prompt with the production per-call budgets (180s default; whichever model the user has selected). Verify completion + no `runs.status='timed_out'` in the runs table for this run.
2. **Synthetic timed_out (SECONDARY):** Set `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` in `backend/.env`, restart backend, run a deliberately-slow prompt (e.g., "explain quantum mechanics in detail with 5 examples and step-by-step reasoning" against a slow reasoning model). Verify the assistant message renders "Agent reached time limit" banner + Resume button. Click Resume; verify it re-POSTs and returns content.

**LangSmith inspection:** After the synthetic timeout run, check LangSmith project dashboard for the trace. Confirm the trace's exception column shows `TimeoutError` (clean termination) — NOT `GeneratorExit` (regression of D-066-11).

**Carry-forward policy (Phase 063 / 063.1 precedent):** If any SC requires environmental setup the user can't complete in this session (e.g., LangSmith dashboard temporarily down, specific reasoning-model API key not configured), file as Gap-NNN and mark UAT `partial` with explicit carry-forward to the next manual UAT pass. Project-level approval is decoupled from UAT-file status.

**Stopgap removal:** D-066-12 says the `RUN_HARD_TIMEOUT_SECONDS=600` stopgap in `backend/.env` becomes obsolete when 066 lands. The env var is silently parsed-and-ignored by Pydantic (`extra="ignore"`). The user CAN remove the line from `.env` for cleanliness but it has no functional effect either way. Plan 05 step 4 documents removal as a documentation-discipline action; not a blocker.
</key_decisions>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Real LLM provider ↔ test prompt | Real API calls cost money; the user's account is charged. Test setup minimizes spend by reusing prior conversation if available. |
| Operator env config ↔ runtime behavior | LLM_CALL_TIMEOUT_OVERRIDES env value drives the synthetic timeout; ensure restart picks it up before testing. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-066-15 | Information Disclosure | Real prompt sent to upstream LLM contains user-identifying info (Fahed Mrad name) | accept | Per CLAUDE.md, the app's threat model treats LLM provider as trusted (already required for normal operation). The Gap-006 prompt is the user's own — they consent to the upstream call by virtue of running it. |
| T-066-16 | Tampering | Stopgap `RUN_HARD_TIMEOUT_SECONDS=600` is mistakenly assumed to be the fix; user doesn't validate the actual code paths | mitigate | Plan 05 explicitly verifies the synthetic-timeout flow (sets per-call to 10s + slow prompt + observes timed_out banner) — proves the new architecture is doing the work, not the stopgap. |
| T-066-17 | DoS | Synthetic timeout test accidentally consumes provider rate limits | accept | Single-test surface, single user. Existing rate-limit budgets handle it. |
</threat_model>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Apply 066-HUMAN-UAT.md scaffold + drive primary Gap-006 regression run + record evidence</name>
  <files>.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md</files>
  <action>See <how-to-verify> below — this is a checkpoint:human-verify task. Pre-flight: executor authors the 066-HUMAN-UAT.md scaffold (frontmatter + Scoreboard table + empty Evidence sections per the template in how-to-verify Section A). Then user drives the dev app (http://localhost:5173/, login fhdmrd@gmail.com/123456), submits the verbatim Gap-006 prompt, observes end-to-end completion, and reports outcome with timestamps + run_id + LangSmith trace URL.</action>
  <verify>
    <automated>test -f "C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md" &amp;&amp; grep -q "Gap-006" "C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md"</automated>
  </verify>
  <done>066-HUMAN-UAT.md scaffold authored; user replied "gap-006 closed — completed in Ns" with concrete evidence (run_id, elapsed seconds, LangSmith trace URL); SC#1 + Gap-006 regression rows in scoreboard updated to GREEN with that evidence.</done>
  <what-built>Plans 01-04 are landed. Backend exposes per-LLM-call timeouts with `timed_out` lifecycle; frontend renders distinct banner + Resume on `timed_out`; integration tests bind the contract. Now: confirm the user's actual workflow is restored.</what-built>
  <how-to-verify>

**A. Pre-flight (executor does this BEFORE the user takes over):**

1. Create `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` with this scaffold (use the Write tool):

   ```markdown
   ---
   phase: 066-adaptive-run-timeouts-lifecycle-states
   status: pending  # → partial | approved
   reviewed_at: null
   project_level_approval: pending  # → approved | blocked
   ---

   # Phase 066 — HUMAN-UAT Scoreboard

   ## Summary

   Phase 066 closed Gap-006 (LLM agent stops mid-iteration on complex
   tool-call prompts). Replaced 120s total-deadline asyncio.timeout wrapper
   with per-LLM-call budget that resets on tool-call boundaries; split
   `cancelled` (user-Stop) vs `timed_out` (system per-call deadline) lifecycle
   states; SDK stream closes cleanly on TimeoutError so LangSmith trace ends
   without GeneratorExit.

   This UAT verifies the user-visible behavior end-to-end with a real LLM,
   real tools (sandbox / web_search / sub-agent / execute_code), and live
   LangSmith trace inspection.

   ## Success Criteria Scoreboard

   | SC | Description | Status | Evidence |
   |----|-------------|--------|----------|
   | SC#1 | Complex multi-tool agent ("search → report → charts → docx") completes end-to-end | pending | _Filled by Task 1 below_ |
   | SC#2 | Per-LLM-call timer fires within ε of budget; tool exec outside budget | pending | Plan 04 test_066_per_call_timer.py — `pytest tests/integration/test_066_per_call_timer.py -v` |
   | SC#3 | runs.status admits 5 values; Pydantic Literal mirrors | pending | Plan 04 test_066_status_enum.py + Plan 01 Task 2 SQL editor smoke test |
   | SC#4 | runs.error non-NULL with discriminator prefix on every non-completed terminal | pending | Plan 04 test_066_terminal_classification.py + DELETE partition guard |
   | SC#5 | SSE consumer receives distinct timed_out terminal event | pending | Plan 04 test_066_sse_terminal.py |
   | SC#6 | Frontend renders "Agent reached time limit" banner + Resume on timed_out | pending | _Filled by Task 2 below (synthetic timeout run)_ |
   | SC#7 | LangSmith trace shows clean termination (no GeneratorExit) | pending | Plan 04 test_066_langsmith_clean.py + _Task 2 LangSmith dashboard inspection_ |
   | Gap-006 regression | User's verbatim prompt completes end-to-end | pending | _Filled by Task 1 below_ |

   ## Evidence

   ### SC#1 + Gap-006 regression

   _Awaiting Task 1 run._

   ### SC#6 + SC#7 (live)

   _Awaiting Task 2 run._

   ## Gaps

   _None at the start of Phase 066 UAT. Add as Gap-NNN format if encountered._

   ## Sign-off

   - [ ] All ROADMAP success criteria green or carry-forward-with-justification
   - [ ] Gap-006 regression confirmed closed by re-running the user's prompt
   - [ ] LangSmith trace inspection shows no GeneratorExit on synthetic-timeout run
   - [ ] STATE.md updated to reflect Phase 066 closure
   ```

2. Verify the dev app is running:
   ```bash
   curl -fsS http://localhost:5173/ > /dev/null && echo "frontend up" || echo "frontend DOWN — start it"
   curl -fsS http://localhost:8000/health > /dev/null && echo "backend up" || echo "backend DOWN — start it"
   ```
   If either is down, instruct the user to start them (`cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000` and `cd frontend && npm run dev`) before proceeding.

3. Confirm the stopgap is in place pre-test (D-066-12):
   ```bash
   grep -E "^RUN_HARD_TIMEOUT_SECONDS=" backend/.env || echo "NOT SET — proceed (Plan 02 made it a no-op anyway)"
   ```
   Document the value in Task 1's Evidence block. Then verify the new arch is active by checking the per-call budget is being read:
   ```bash
   cd backend && venv/Scripts/python.exe -c "from app.config import get_per_call_timeout, settings; m = settings.llm_model; print(f'active model: {m}, per-call budget: {get_per_call_timeout(m, settings)}s')"
   ```
   Document the model + budget in the UAT.

**B. User-driven steps (executor instructs the user):**

4. **Open the dev app** at http://localhost:5173/ and log in (`fhdmrd@gmail.com / 123456`).

5. **Create a new chat thread** scoped to whatever folder contains research authored by Fahed Mrad (or none — General mode works).

6. **Submit Gap-006 prompt verbatim:**
   ```
   search for research authored by Fahed Mrad → professional short report → charts/diagrams → docx
   ```
   (Or paste from the user's clipboard if they have an exact string from their Gap-006 report.)

7. **Observe end-to-end execution.** Expected behavior:
   - Multiple tool calls fire (search_documents, possibly analyze_document, execute_code for charts + docx)
   - Each tool's `tool_executing` heartbeat appears in the UI (Phase 056 elapsed-time counter ticks)
   - Final assistant content renders WITH the chart + docx output cards
   - No "Response stopped" or "Agent reached time limit" banner
   - The chat enters the "completed" terminal state (no Resume button)

8. **Capture evidence in `066-HUMAN-UAT.md` under SC#1 + Gap-006 regression Evidence:**
   - Start timestamp
   - End timestamp (calculate elapsed)
   - Final assistant message length (chars or screenshot)
   - List of tool calls fired (from the tool-call panel)
   - Output files generated (chart .png, .docx)
   - LangSmith trace URL for this run (from LangSmith dashboard)
   - `runs.status` value after completion (query Supabase Studio: `SELECT status, error, completed_at - started_at AS elapsed FROM public.runs WHERE thread_id='<your-thread-id>' ORDER BY started_at DESC LIMIT 1;`)
   - Confirm `status = 'completed'` AND `error IS NULL`

9. **Reply with one of:**
   - `gap-006 closed — completed end-to-end in <N>s` → mark SC#1 + Gap-006 regression GREEN; proceed to Task 2
   - `gap-006 still failing — <details>` → STOP. File a new gap for follow-up; do NOT proceed to commit. Capture the failure mode (was it timed_out? failed? cancelled? completed with wrong content?) and the LangSmith trace URL.
   - `gap-006 partially worked — <details>` → record specific observations; we'll decide together whether this is approved-with-carry-forward or block.
  </how-to-verify>
  <resume-signal>Reply with the Gap-006 regression outcome ("gap-006 closed — completed in Ns" / "gap-006 still failing — ..." / "gap-006 partially worked — ...") and the actual elapsed time + LangSmith trace URL.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Synthetic timeout run — verify Plan 03 banner + Resume button + LangSmith clean trace</name>
  <files>.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md, backend/.env</files>
  <action>See <how-to-verify> below — this is a checkpoint:human-verify task. Pre-flight: developer adds LLM_CALL_TIMEOUT_OVERRIDES=&lt;active-model&gt;=10 to backend/.env, restarts backend, then submits a deliberately-slow prompt in the dev app. Observes the &quot;Agent reached time limit&quot; banner + Resume button render on the assistant message. Verifies via SQL editor that runs.status='timed_out' and runs.error startswith 'timed_out:'. Inspects LangSmith dashboard trace for the synthetic-timeout run — confirms NO GeneratorExit warning at run_helpers.py:1680. Cleanup: removes the LLM_CALL_TIMEOUT_OVERRIDES line + restarts backend. Updates SC#6 + SC#7 rows in 066-HUMAN-UAT.md with concrete evidence.</action>
  <verify>
    <automated>grep -E "^SC#6.*Evidence" "C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md" || grep -q "timed_out" "C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md"</automated>
  </verify>
  <done>User replied "synthetic timeout closed — banner + resume + clean trace all confirmed" with: (a) banner copy text observed = &quot;Agent reached time limit&quot;, (b) Resume button appeared, (c) Resume click fired a new POST, (d) LangSmith trace exception column shows TimeoutError (NOT GeneratorExit). 066-HUMAN-UAT.md SC#6 + SC#7 evidence rows filled; backend/.env reverted to remove the synthetic override.</done>
  <what-built>Task 1 confirmed Gap-006 regression is closed (the new architecture admits the user's complex agent without timing out). Task 2 confirms the *opposite* — when a budget IS exceeded, the new lifecycle UX surfaces correctly.</what-built>
  <how-to-verify>

**A. Pre-flight: configure the synthetic timeout.**

1. Add or update `LLM_CALL_TIMEOUT_OVERRIDES` in `backend/.env` to set the active model's per-call budget to **10 seconds**. Example (if active model is `claude-sonnet-4-6`):
   ```
   LLM_CALL_TIMEOUT_OVERRIDES=claude-sonnet-4-6=10
   ```
   Or query the active model first:
   ```bash
   cd backend && venv/Scripts/python.exe -c "from app.config import settings; print(settings.llm_model)"
   ```
   then set accordingly. Document the chosen `<model>=10` value in the UAT.

2. **Restart the backend** so the env var is picked up:
   ```bash
   # Ctrl-C the existing uvicorn, then:
   cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
   ```

3. Verify the override is loaded:
   ```bash
   cd backend && venv/Scripts/python.exe -c "from app.config import get_per_call_timeout, settings; print(get_per_call_timeout(settings.llm_model, settings))"
   ```
   Expected: `10`

**B. User-driven test:**

4. **In the dev app** (refresh the page if needed to pick up frontend HMR — though no frontend code changed in this task so HMR not strictly required).

5. **Submit a deliberately-slow prompt** that will spend more than 10s in the FIRST LLM call (no tool calls — pure thinking):
   ```
   Explain quantum mechanics in extensive detail. Include the historical development from Planck onwards, all major interpretations (Copenhagen, Many-Worlds, Pilot Wave, Consistent Histories, Relational, QBism), and 10 detailed worked-example calculations showing wavefunction collapse, entanglement, and tunneling. Take your time and be thorough.
   ```

   The 10s budget should fire BEFORE the LLM finishes the first chunk-emission, producing a `timed_out` terminal state.

6. **Observe the UI:** Within ~10-15 seconds of submitting:
   - Streaming briefly appears (delta tokens may render before the timer fires)
   - The chat then renders the **"Agent reached time limit"** banner italic text below the assistant bubble
   - A **Resume** button (with the RotateCcw icon) appears below the assistant bubble
   - No "Response stopped" text (that's the cancelled-path banner — wrong for this scenario)

7. **Capture evidence in `066-HUMAN-UAT.md` under SC#6 + SC#7 Evidence:**
   - Screenshot or text capture of the banner + Resume button
   - The exact model used + per-call budget setting
   - `runs.status` value (query Supabase Studio with the thread_id):
     ```sql
     SELECT status, error, completed_at - started_at AS elapsed
     FROM public.runs
     WHERE thread_id='<your-thread-id>'
     ORDER BY started_at DESC LIMIT 1;
     ```
     Expected: `status = 'timed_out'`, `error LIKE 'timed_out: 10s per-call deadline exceeded at iteration % (model=%)'`

8. **Click Resume.** Expected:
   - The original prompt re-posts (network tab shows POST /threads/{tid}/messages)
   - A new assistant placeholder appears
   - With the 10s budget still in place, this run will ALSO timed_out — that's expected; the test is whether Resume successfully re-fires, not whether it succeeds.
   - Document: did the click trigger a new POST? Did a new assistant bubble appear?

9. **LangSmith trace inspection (SC#7 live confirmation):**
   - Open the LangSmith project dashboard for this app's project
   - Find the most recent trace (the synthetic-timeout run from step 5)
   - Inspect the trace tree
   - **Required observation:** the trace should END with a TimeoutError or clean stream-end. There should be NO `GeneratorExit` warning at `langsmith/run_helpers.py:1680` in the trace's exception column.
   - Document: what does the exception column show? If "GeneratorExit" appears, this is a D-066-11 regression — file Gap-NNN.

10. **Cleanup:**
    - Remove the `LLM_CALL_TIMEOUT_OVERRIDES=<model>=10` line from `backend/.env` (or set it to a sensible production value like 240/600).
    - Restart backend.
    - (Optional, D-066-12 documentation discipline) Remove the now-obsolete `RUN_HARD_TIMEOUT_SECONDS=600` stopgap line from `backend/.env`. The Pydantic `extra="ignore"` setting means leaving it has no effect; removing it is documentation hygiene only.

11. **Reply with one of:**
    - `synthetic timeout closed — banner + resume + clean trace all confirmed` → mark SC#6 + SC#7 GREEN; proceed to Task 3
    - `synthetic timeout failed: <details>` → STOP. Capture which assertion failed (banner copy wrong? Resume not present? LangSmith trace dirty?). File Gap-NNN.
  </how-to-verify>
  <resume-signal>Reply with the synthetic-timeout outcome including: (a) banner copy text observed, (b) whether Resume button appeared, (c) whether Resume click fired a new POST, (d) LangSmith trace exception column content.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Finalize 066-HUMAN-UAT.md scoreboard + commit Phase 066 closure</name>
  <files>.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md</files>
  <read_first>
    - .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md (after Task 1 + Task 2 user replies)
    - .planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md (status formatting precedent — partial vs approved + project-level decoupling)
    - .planning/STATE.md (will be updated by /gsd:transition or /gsd:verify-work — Plan 05 just commits the UAT-md)
  </read_first>
  <action>
**Subtask 3a — Finalize scoreboard:** Update `066-HUMAN-UAT.md` with Task 1 + Task 2 evidence rolled into each SC row. Set frontmatter:

- `status: approved` if all 7 SC + Gap-006 regression are GREEN
- `status: partial` if any SC needs carry-forward (with explicit reason)
- `project_level_approval: approved` if Gap-006 is closed AND no NEW user-blocking gaps surfaced (Phase 063.1 precedent: project can be approved while UAT is partial)
- `project_level_approval: blocked` only if Gap-006 still produces mid-iteration stops on real complex prompts
- `reviewed_at: <ISO timestamp>`

Add a `## Sign-off` section with concrete claim references. Example structure:

```markdown
## Sign-off

**Project-level:** approved / blocked (per Phase 063 precedent)
**UAT file:** approved / partial (per criteria below)

- [x] SC#1 — Gap-006 regression closed: prompt completed in <N>s, multi-tool agent worked end-to-end (Task 1 evidence)
- [x] SC#2-#5,#7 — automated tests green per Plan 04 (`pytest tests/integration/test_066_*.py` — committed in 066-04-SUMMARY.md)
- [x] SC#6 — banner + Resume confirmed live with synthetic timeout (Task 2 evidence)
- [x] SC#7 — LangSmith trace clean (no GeneratorExit) confirmed live (Task 2 evidence)
- [ ] Stopgap removal: D-066-12 RUN_HARD_TIMEOUT_SECONDS=600 line in backend/.env (optional documentation cleanup; no functional effect)
```

If any task surfaced a Gap-NNN, append it under `## Gaps` with the format:

```markdown
### Gap-006-followup-N — <short title>

- **Surfaced by:** Plan 05 Task <N> (synthetic timeout test)
- **Symptom:** <observed deviation from expected>
- **Likely root cause:** <leading hypothesis>
- **Disposition:** carry-forward to <follow-on phase / next manual UAT pass>
- **Blocking:** yes / no — <justification>
```

**Subtask 3b — Commit:**

Stage exactly the UAT file:

```bash
git add .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md
```

Commit (HEREDOC — model on Phase 063.1 plan 05's closing commit):

```
docs(066-05): close phase with HUMAN-UAT scoreboard + Gap-006 regression evidence

Phase 066 — Adaptive Run Timeouts & Lifecycle States closed. Replaced
120s total-deadline wrapper with per-LLM-call budget; split cancelled
(user) vs timed_out (system) lifecycle; "Agent reached time limit"
banner + Resume button on timed_out per D-066-09/10; LangSmith trace
ends cleanly per D-066-11.

UAT scoreboard:
- SC#1 (Gap-006 regression closed): user's verbatim multi-tool prompt
  ("search → report → charts → docx") completed end-to-end. Run elapsed:
  <N>s. Final runs.status='completed', error=NULL.
- SC#2-#5, #7 automated: Plan 04 test_066_*.py suite green.
- SC#6 live: synthetic 10s per-call budget produced "Agent reached time
  limit" banner + Resume button on the assistant message. Resume click
  re-fired POST /threads/{tid}/messages.
- SC#7 live: LangSmith trace for synthetic-timeout run shows clean
  TimeoutError termination, no GeneratorExit at run_helpers.py:1680.

Status: approved / partial — see 066-HUMAN-UAT.md frontmatter for
project-level vs UAT-file disposition.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; test -f .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md</automated>
    <automated>grep -q "Gap-006" "C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md"</automated>
    <automated>grep -E "^status:" "C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md" | grep -E "approved|partial"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --pretty=%s | grep -q "066-05"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --name-only --pretty=format: | grep -c "066-HUMAN-UAT.md" | tr -d ' ' | grep -E "^1$"</automated>
  </verify>
  <done>
    - 066-HUMAN-UAT.md exists with all 7 SCs + Gap-006 regression filled
    - Frontmatter `status` is `approved` or `partial` (NOT `pending`)
    - Frontmatter `project_level_approval` is `approved` or `blocked` (NOT `pending`)
    - `reviewed_at` is set to a real ISO timestamp
    - Single commit named "docs(066-05): ..."
    - Commit touches exactly the UAT file
  </done>
</task>

</tasks>

<verification>
- 066-HUMAN-UAT.md committed with concrete evidence (timestamps, runs.status query results, LangSmith trace URLs)
- Gap-006 regression confirmed closed at the user level (Task 1)
- Synthetic timeout flow confirmed: banner + Resume + clean trace (Task 2)
- One commit landed
</verification>

<success_criteria>
- All 7 ROADMAP success criteria for Phase 066 are GREEN or carry-forward-with-justification per Phase 063 precedent
- Gap-006 from Phase 063.1 HUMAN-UAT.md is closed by user observation (NOT just by automated tests)
- LangSmith trace dashboard shows clean TimeoutError termination on synthetic-timeout run (D-066-11 verified live)
- 066-HUMAN-UAT.md frontmatter `status` is `approved` or `partial`; `project_level_approval` is `approved` or `blocked`
</success_criteria>

<output>
After completion, create `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-05-SUMMARY.md` documenting:
- Final UAT outcomes per SC (table with timestamps, run_ids, observations)
- Total elapsed time of Gap-006 regression run vs the legacy 120-152s cluster from STATE.md
- Concrete model + budget combo used in the synthetic-timeout test
- LangSmith trace URLs for both runs
- Any Gap-NNN surfaced + carry-forward disposition
- Confirmation `RUN_HARD_TIMEOUT_SECONDS` env line was either removed (cleanup) or left in place (no-op — both acceptable per D-066-12)
- Recommendation for next phase / milestone close
</output>
