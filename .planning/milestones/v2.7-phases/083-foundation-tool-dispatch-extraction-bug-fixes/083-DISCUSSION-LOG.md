# Phase 083: Foundation — Tool-Dispatch Extraction + Bug Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 083-foundation-tool-dispatch-extraction-bug-fixes
**Areas discussed:** Output files after reload, Kimi thinking detection, Timer stability on ID swap, Title gen model routing

---

## Output files after reload (BUG-260526-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Reconstruct client-side | Scan tool_calls JSONB for execute_code results with output_files in _mapMessageResponse. Zero migration. | |
| Persist to DB column | Add final_output_files JSONB column to messages. Requires migration. | |
| You decide | Claude picks based on codebase fit. | |

**User's initial question:** How is this dealt with in Claude.ai?

**Follow-up options presented:**

| Option | Description | Selected |
|--------|-------------|----------|
| Extract from tool_calls (Recommended) | Simplest: _mapMessageResponse scans tool_calls JSONB. Zero migration, zero new API call. | ✓ |
| Fetch from sandbox_files table | Closer to Claude.ai pattern: files as independent entities, separate API call on load. | |
| Both (belt and suspenders) | Extract from tool_calls + reconcile against sandbox_files. | |

**User's choice:** Extract from tool_calls JSONB
**Notes:** User asked how Claude.ai handles this. Explained that Claude.ai uses first-class file entities, but our architecture already has the data in tool_calls JSONB — simplest fix is client-side extraction.

---

## Kimi thinking detection (BUG-260526-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Provider-gated content gate (Recommended) | When provider is Moonshot/Kimi, inspect chunks for thinking markers, strip from full_content, accumulate into reasoning_content. | ✓ |
| Moonshot API field check | Check if Moonshot has a separate reasoning field we're not reading. | |
| You decide | Claude investigates during planning. | |

**User's choice:** Provider-gated content gate
**Notes:** None — straightforward selection.

---

## Timer stability on ID swap (BUG-260526-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Use run_id as stable key (Recommended) | key={`run-${msg.runId}`} for streaming assistant messages. React won't remount. | ✓ |
| Lift timer state to parent | Move timer state to streamsStore keyed by run_id. Survives remounts but adds store complexity. | |
| Preserve via ref + effect | Cache timer state in useRef keyed by run_id, restore on mount. Lighter but fragile. | |

**User's choice:** Use run_id as stable key
**Notes:** None — clean choice that prevents the problem at the source.

---

## Title gen model routing (BUG-260527-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Main model for single-tier providers (Recommended) | DeepSeek/Moonshot/MiniMax/GLM use user's main model. Multi-model providers keep sub-agent routing. Google max_tokens investigated. | ✓ |
| Dedicated _TITLE_MODEL_DEFAULTS | Separate dict from _SUB_AGENT_MODEL_DEFAULTS, tuned for title prompt. | |
| You decide | Claude investigates each provider during planning. | |

**User's choice:** Main model for single-tier providers
**Notes:** None — straightforward selection.

---

## Claude's Discretion

- Tool handler organization within tool_dispatcher.py
- ToolContext type choice (dataclass vs NamedTuple vs TypedDict)
- Test strategy for the extraction

## Deferred Ideas

- True resume from failure (continue mid-agent-loop instead of re-sending prompt) — user raised this; may benefit from Phase 085 ask_user pause/resume infrastructure
- anthropic-end-of-cycle-shows-actions-not-summary — deferred major bug, not 083 scope
- anthropic-excessive-tool-iterations — deferred minor bug, not 083 scope
