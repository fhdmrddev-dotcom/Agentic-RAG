---
seed_id: SEED-066
title: Persist + replay harness workspace/phase activity on reload — completed workflow runs show "No workspace activity yet"
status: planted
planted: 2026-06-07
phase_origin: Phase 096 live UAT (operator observation on the restart-smoke chats) — DB-verified
category: B — real UX/legibility gap (feature, not a crash); candidate for a future workflow-legibility phase
severity: minor (no data loss — the final answer persists; only the play-by-play is lost)
related_seeds: [SEED-064]
related_deferred: ["094→095 deferred 'timeline-vanishes'" — live-streaming timeline; this seed is the RELOAD/POST-COMPLETION counterpart]
relates_to:
  - "Workspace panel reconstructs from DURABLE state on reload; for harness workflow runs the per-phase sub-agent activity (e.g. search_documents round-trips) lives IN-MEMORY during the run and is never persisted (documented: eval README `arg_shape_ok=null` — harness sub-agent transcripts in-memory, tool args never persisted)"
  - "workflow_phases.output stores TEXT only (no tool-call/source-ref breakdown for the panel to redraw)"
  - "eval_coverage / literature_review workflows write NO workspace_files → workspace_files=0 → panel legitimately empty on reload"
  - "Live run feeds the panel from the Redis run stream (run:{id}); that buffer EXPIRES after terminal (REDIS-SETUP TTL) so the play-by-play is gone on later visits"
  - "frontend Workspace panel + StreamsProvider reconcile-on-fetch (D-v2.5-03)"
re_open_triggers:
  - A workflow-legibility / run-history phase is planned (this is its natural home; pairs with the 094→095 timeline work)
  - Users ask "what did the workflow actually do?" after a run completes (audit/explainability need)
  - The harness gains durable per-phase tool/source-ref persistence for any other reason (then replay is cheap to add)
  - v2.9 NL-workflow-authoring ships (authored workflows make post-run legibility more load-bearing)
priority: low-medium — legibility/trust improvement, not a correctness bug
suggested_phase: future workflow-legibility phase (not part of the SEED-063/064 fix phase)
---

# SEED-066 — Persist + replay harness workspace activity on reload

## What the operator saw (Phase 096 UAT, 2026-06-07)

After the restart-smoke runs completed, opening those chats (`restart-smoke
programmatic` / `llm_agent` / `ask_user`) shows the final answer in the
transcript but the **Workspace panel reads "No workspace activity yet"** — the
phase/tool play-by-play that was visible DURING the run is gone.

## Root cause (DB-verified — NOT a regression, NOT data loss)

For a completed harness workflow run, durable state has:
- `workspace_files` = 0 (these workflows write no files), and
- the assistant message carries no `tool_calls`, and
- `workflow_phases.output` is plain text.

The actual step activity (sub-agent `search_documents` calls in fanout/deep_dive)
ran inside sub-agents whose transcripts are in-memory by design, and the live
Redis run-stream that fed the panel expires after the run terminalizes. So on
reload the panel rebuilds from durable state and correctly finds nothing to
show. The FINAL ANSWER is preserved; only the "how it got there" is not.

This is the post-completion / reload counterpart of the 094→095 "timeline
vanishes" deferred item (which addressed the LIVE-streaming case).

## Fix direction (for a future legibility phase — not now)

1. Decide what's worth persisting per phase for replay: phase timeline (already
   in workflow_phases), plus a compact per-phase tool/source-ref summary
   (search_documents queries + grounding source_refs are already harvested into
   `workflow_phases.output.source_refs` for some phases — extend + render).
2. On reload, the Workspace panel reconstructs the phase timeline + per-phase
   tool/source summary from durable rows (not the expired live stream).
3. Keep it provider-uniform and honest (D-10/D-11a) — show what actually ran,
   never fabricate activity.
4. Scope-guard: full sub-agent transcript persistence is heavier (storage +
   privacy); a compact per-phase activity summary likely suffices for legibility.

## Vibe-coder plain summary

When a workflow finishes and you reopen the chat, the right-side Workspace panel
is empty — it says "no activity." Your answer is still there; what's missing is
the replay of the steps the agent took (the searches, the phases). That's
because those steps were shown live but never saved, so there's nothing to
re-draw later. It's not a bug from the restart fix and nothing was lost — it's a
"we don't save the play-by-play yet" gap. Worth fixing later if you want to look
back at what a finished workflow actually did.
