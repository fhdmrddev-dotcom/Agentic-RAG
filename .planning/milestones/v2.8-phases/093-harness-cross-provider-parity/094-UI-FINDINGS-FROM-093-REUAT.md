# Phase 094 UI/legibility inputs — harvested from the 093 D-21 LIVE re-UAT (2026-06-03)

> Handoff for **Phase 094 (Workflow Legibility + Mode Clarity)**. None of these blocked 093 (backend parity); all are UI/legibility/experience gaps 094 (+ a few SEEDs) own. Feed these into **`/gsd:sketch 094`** (G-2) — items #1 and #2 are the operator-stated acceptance bar.

## Operator-stated 094 acceptance bar (verbatim intent)
**Show the workflow's REAL steps and real tasks — transparency, not a spinner.** During the re-UAT the operator watched Claude read the live backend signals and said *"this is the exact behaviour … real steps and transparency on the workflow's real tasks"*:
- sub-agents spawned (+ count, e.g. "4 agents spawned")
- searches done (e.g. "6 searches"), tool calls (e.g. "16 tool calls")
- phase transitions (split → review → merge), "merge phase generating the integrated review", code-exec/file events, "done"

This is essentially surfacing the log-level granularity (`runs`/`workflow_runs` + tool events already on the SSE wire) into the panel timeline / harness RunCard. **The 094 sketch should be judged against this.**

## Findings (priority order)

1. **No live progress in chat during a run.** Chat shows only "Setting up agent…" for a few seconds, then a pulsing assistant icon, then the FULL response renders at once. Events are plumbed (093-05 wire-only) but nothing renders them live. → **094 SC#6** (intermediate output / live surface) + D-094-UNIFY.

2. **Draft-before-ask_user is invisible.** Doc Q&A pauses at "Does this draft answer your question? Add any corrections." but the **draft is never shown** anywhere (chat = "working…"; panel = ask card only). DB confirms no draft message is persisted — only user + final + the ask prompt; the draft is wire-only (093-05). You're asked to review/correct something you can't see. → **094 SC#6 / Deferred Item #1.** (Also: reword the ask prompt so it only makes sense once the draft renders.)

3. **Failed run renders empty (RC-4).** A `failed` harness run shows just the user's question — no answer, no error, no "failed" badge (composer silently re-unlocks). → **094 SC#6** (failed renders as failed *with a reason*, never empty/done-sentinel).

4. **Generated files not shown in the panel.** `execute_code` produced real artifacts (e.g. `distribution_chart.png`, `Demographic_Analysis_Report.txt`, `Dissertation_Demographic_Analysis.xlsx`) stored in `sandbox_files`/`code_executions`/storage, but the panel FILES section showed "No files yet" (it only surfaces `write_file` `workspace_files`). Data exists; not surfaced. → **SEED-037/038 (artifacts unification) + confirm coverage at 094/095 planning** so it isn't lost between phases.

5. **Mode toggle reads "Deep" during a running Harness workflow** (should read Harness / be unambiguous). → **094 / D-092-UX** mode clarity.

6. **Opaque between-phase state.** Between phases the "working…" indicator disappears, no Stop button, composer still locked — no signal of what's happening. → **094** phase timeline.

7. **(Ops, not 094-render)** Graceful shutdown **hangs** while a harness run holds an open SSE connection (Ctrl+C force-quit didn't override until the client disconnected), and a graceful shutdown **fails an in-flight human-input run** rather than preserving it resumable. Candidate: drain-streams-on-shutdown + preserve-paused-runs-as-resumable. Surfaced the Dim-3 abrupt-resume retest gap (Windows kill-friction).

## Related / routed elsewhere
- General-chat **intermittent silent send-drop** → `reported-bugs/general-chat-intermittent-silent-send-drop.md` (BUG-260603-01).
- Dim-5 result-quality (kimi-k2.6 execute fabricated data; MiniMax-M2.7 finalize reviewed-not-applied) → **SEED-050 / Phase 096 eval** + execute-phase & doc_qa-finalize prompt-tune candidates.
- **Bonus confirm:** parallel-thread test proved **no global isStreaming lockout** (Thread B composer unlocked while Thread A streamed) — the 075.3 regression (`reported-bugs/composer-locked-globally-during-any-stream.md`) is **not reproducing**; candidate to mark verified-closed.
