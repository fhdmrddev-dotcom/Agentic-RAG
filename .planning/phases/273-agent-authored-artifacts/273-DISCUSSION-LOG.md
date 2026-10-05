# Phase 273: Agent-Authored Artifacts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-03
**Phase:** 273-agent-authored-artifacts
**Areas discussed:** How the agent emits it, Follow-ups & attached rows, Where it shows + PNG coexistence, Hot-file refactor first (G-5), G-4 scenarios

---

## How the agent emits it

| Question | Options | Selected |
|---|---|---|
| Emission channel | New tool `show_artifact` (29→30, recorded) · Spec inside answer text | New tool ✓ |
| Rows source | Inline in the call · Reference a prior tool result · Both | Inline ✓ |
| Provenance | Quiet server-derived caption · No caption | Caption ✓ |
| Chart kinds | line/bar/area/scatter · + pie · line+bar only | line/bar/area/scatter ✓ |

## Follow-ups & attached rows

| Question | Options | Selected |
|---|---|---|
| Re-encode mechanism | Re-call by reference · Agent re-sends rows inline · UI controls, no model | By reference ✓ |
| Allowed transforms | Encoding+filter+sort · + aggregate · Encoding only | Encoding+filter+sort ✓ |
| History | New immutable artifact · Update in place | New artifact ✓ |
| Row cap | 500, refuse above · 2,000, truncate with caption | 500 refuse ✓ |

## Where it shows + PNG coexistence

| Question | Options | Selected |
|---|---|---|
| Placement | Block after answer text · Interleaved in text · Inside tool rail | Block after text ✓ |
| PNG path | Only when a file is asked for · Agent decides freely | Only for files ✓ |
| Invalid spec | Model first, notice last · Notice only | Model first ✓ |
| Table/metric | Sortable table + metric w/ delta · + CSV download · Static | Sortable + delta ✓ |

## Hot-file refactor first (G-5)

| Question | Options | Selected |
|---|---|---|
| `tool_dispatcher.py` | Narrow cut + record override · Full split as wave 1 · Insert refactor phase 272.1 | Narrow cut ✓ (OV-273-02) |
| `agent_loop.py` | One hook, guidance in tool description · Take prompt-assembly seam now | One hook ✓ (OV-273-03) |
| Frontend live data | One new SSE event + one mount · Ride existing tool_end | New SSE event ✓ |

## G-4 scenarios (multi-select)

All four selected: chart → "make it bar" → "only Q3" · reload identical · broken spec shows notice · PNG still works when asked.

## Claude's Discretion

Persistence shape (table vs JSONB column), exact arg schema (Gemini-safe), Explorer/sub-agent exposure (rec: top-level only), byte cap, notice wording, frontend validation approach, plan count 3-5.

## Deferred Ideas

Aggregate transforms; CSV download; on-artifact UI controls; pie; interleaving; artifacts in workflows/sub-agents; full dispatcher split + prompt-assembly seam (still owed).
