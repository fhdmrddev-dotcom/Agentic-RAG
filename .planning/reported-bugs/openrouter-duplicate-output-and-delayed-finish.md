---
id: BUG-260523-03
title: OpenRouter agent run emits duplicate pptx outputs + visible "still running" delay after task complete
reported: 2026-05-23
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, frontend/output-files, backend/agent-loop, openrouter]
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 46e8a63
  date: 2026-05-23
---

# BUG-260523-03: OpenRouter run produces duplicate final outputs + delayed "done" indicator

## What we observed

User ran the "search Fahed Mrad dissertation, make a professional pptx" prompt on an OpenRouter model. Observed (DB-confirmed: 510s run, completed, `minimax/minimax-m2.7` at 2026-05-23 01:48Z, 13 tool calls):

1. **Multiple code-execution iterations** — the agent generated and re-executed code several times across the run. Some iterations failed (`Traceback`, `prs not found`, `ERROR`), some succeeded.
2. **Two final pptx artifacts** appeared in the chat: one labeled with charts (the "complete" version) and an earlier intermediate version without charts. The user did not request two artifacts; the agent's intermediate-then-final pattern surfaced both as if they were both "final outputs".
3. **Visible "still running" delay after the task was actually finished** — the UI continued showing the in-flight indicator (top-bar spinner / "Executing code" pill / disabled composer) for a noticeable window AFTER the model's last token landed and the artifact was visibly downloadable. Only after this delay did the UI flip to a settled state.

Comparable Anthropic run on the same prompt also went through many iterations (>15 reported by user) but only produced one final artifact — the duplicate-output issue is OpenRouter-specific in this test, while the **delayed-done** symptom is shared.

## Why it matters

Combined effect: a long agent run that DID succeed looks broken or stuck. Users either kill the run mid-flight (losing work) or assume the app froze. The duplicate-output behavior also bloats the chat surface with redundant artifacts, making it harder to find the actual deliverable.

The delayed-done specifically erodes trust in the streaming indicator — once users learn the indicator can lie ("still running" when the run is actually done), they stop reading it, which makes legitimately-still-running flows harder to diagnose.

## Hypothesized cause

Two independent root causes layered into one observed failure cluster:

**(a) Duplicate-output (OpenRouter only):** The pinned "Final outputs" panel and per-cell `<OutputFileCard>` both render output files. When OpenRouter's agent loop generates an intermediate pptx (saved successfully) AND later replaces it with a final pptx of the same logical name, both files survive in the cumulative `_previous_files_in_run` set inside `backend/app/api/threads.py` (around the cumulative-cross-iteration set at ~line 1574 per the 075.2 verifier notes). The set is keyed by `filename`, so two distinct filenames (e.g., `defense_slides_1_8.pptx` and `Fahed_Mrad_DBA_Defense.pptx`) both legitimately land — but to the user they're "two final outputs" because there's no UI signal of "this one supersedes that one." Could also be exacerbated by `Phase 075.1` ToolCallPanel dedup not de-duping across the cumulative-output dimension.

**(b) Delayed-done:** Likely the `kind=done` SSE event vs the per-tool `tool_end` events emit in an order where the UI's `isStreaming` flag stays true until a late event lands. Suspect culprit: the `_isTransientStreamEnd` filter at `StreamsProvider.tsx:128` (widened in Phase 075.1) treats some `kind=done` cases as transient (waiting for snapshot to confirm), and only flips `isStreaming: false` after the snapshot returns. On a slow snapshot (cold-cache hit), this adds noticeable latency between "stream actually done" and "UI shows done." The 067.5 / 075.1 timing patches may have widened the transient window unintentionally.

## Suggested fix path

**(a) Duplicate-output:** Decide product semantics first — do we want "show all output files ever produced this run" or "show only the latest version of each (de-duped by content-hash or by user-intent label)?" If the latter, key `_previous_files_in_run` by content hash instead of filename, OR add a UI-only de-dup pass in `<OutputFilesList>` that hides earlier versions superseded by later ones with the same logical name.

**(b) Delayed-done:** Instrument the `kind=done` → UI-settled latency with a console.timeline marker, then narrow the window:
- Confirm `useIsStreaming` flips to false within X ms of the SSE `done` event
- If not, check if `_isTransientStreamEnd` is holding the run open waiting on a snapshot probe that should fire faster (or shouldn't fire at all on the happy path)
- Tighten the snapshot timeout / make the indicator flip on `done` directly when no transient conditions are detected

Both fall under Phase 075.4 scope (streaming reliability polish) — same wave as BUG-260523-01 (cross-thread input lock) since they all touch StreamsProvider state.

## Related

- Phase 075.1 — widened `_isTransientStreamEnd` (might be implicated in delayed-done)
- Phase 075.2 — ToolCallPanel dedup (sibling code; may apply similar pattern for output files)
- BUG-260523-01 — global isStreaming flag (sibling problem in same store)
- BUG-260522-02 — backend `final_output_files` payload omits url/size (different layer, but same panel)
