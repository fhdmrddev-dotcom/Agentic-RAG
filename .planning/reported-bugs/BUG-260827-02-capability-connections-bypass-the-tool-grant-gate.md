---
id: BUG-260827-02
title: Slack, Jira and SMTP connections bypass the tool-grant gate entirely — `tool_grants` is enforced for MCP rows only
reported: 2026-08-27
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/connectors, backend/harness, security/egress, frontend/settings]
folded_into: 213
verified_closed_by: null
related_seeds: [SEED-146, SEED-205, SEED-207, SEED-214]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 4aa28090
  date: 2026-08-27
---

# BUG-260827-02: capability connections bypass the tool-grant gate

## What we observed

`backend/app/services/harness/phase_types.py:2511-2524` — Gate 6, the per-tool grant check — is
nested **inside** a test for the MCP shape:

```python
# ── GATE 6 · MCP Tool Dispatch (Phase 206 / CONN-02 / D-206-06) ───────────────────
if getattr(connection, "mcp_server_url", None):
    tool_name = getattr(phase.config, "tool_name", None)
    ...
    grants = getattr(connection, "tool_grants", {}) or {}
    is_granted = grants.get(tool_name) is True
    if not is_granted:
        ...  # refuse + write a `tool_refused` audit row
```

A **capability** connection (`slack` / `jira` / `smtp`) has `mcp_server_url = NULL` by
construction, so the whole block is skipped and the send proceeds to the adapter without any
grant being consulted.

**The claim this contradicts is written in our own source.** `descriptors.py`'s module docblock
states, of the descriptors it produces:

> *"⚠ A descriptor is an advertisement, not a permission: the executor's gate reads
> `tool_grants` only, and a missing key DENIES. That asymmetry is the desirable direction
> (T-211-05) — it is what makes a legacy connection presentable as a service without silently
> arming it."*

That sentence is true for **one of the two shapes**. For the shape it was written about — the
legacy capability connection — there is no gate to read `tool_grants` at all.

**Found by inspection, not by a failing test**, while answering an operator question about why
Slack/Jira/Email show one tool. No test covers it, in either direction.

### The second half, in the UI

`ConnectionFormPanel.handleSave` writes `tool_grants` only when the shape is `mcp`
(`draft.capability === "mcp"` on both the create and the update path). So a capability
connection's grants are **neither writable from the UI nor read at execution** — the field
exists on the row and on the model and is inert end to end for three of our services.

⚠ Commit `4aa28090` (Phase 212, D-4b) *removed the "Granted" checkbox* from a capability row's
action list for exactly this reason — a switch `Save` drops is a lie. That is the honest
rendering of this bug, **not a fix for it**, and it must not be read as one.

## Why it matters

The standing project rule is *"never add an outbound capability to `_TOOL_REGISTRY` before the
approval model exists."* This is the same trust boundary seen from the other side: for three
services the approval model **is already absent at run time** while the surrounding surface —
the field on the row, the docstring, the ledger vocabulary — reads as though it were present.

- **A person cannot withhold one action of a capability connection.** The only control is
  disabling the whole connection.
- **`tool_refused` audit rows can never be written for these three**, so the ledger's silence
  about them is indistinguishable from "nothing was ever refused".
- ⚠ **It gets worse the moment `BUG-260827-02`'s sibling work lands.** Today each capability
  connection performs exactly one action, so "grant the connection" and "grant the action"
  coincide and the gap is survivable. `SEED-214` proposes letting one connection hold **many**
  actions — at which point an ungated capability row means *every* action it holds is armed by
  the connection existing. **The unlock must not ship before this gate closes.**

Severity **major** rather than blocking: the blast radius is bounded by Phase 189/190's armed
run-time checkpoint (D-19) and the `live_connectors` kill-switch, both of which still apply. It
is the *per-tool* layer that is missing, not every layer.

## Hypothesized cause

**Hypothesis, not a finding.** Gate 6 was authored in Phase 206 for a feature that only existed
in the MCP shape — at that time `tool_grants` had no meaning for a capability row, because a
capability row had no tool list to grant from. Phase 211 gave capability rows a tool list
(`static_descriptors_for_capability`) and Phase 212 gave them a way to see it, but neither phase
revisited the gate's guard condition. The comment header still reads `MCP Tool Dispatch`, which
is an accurate description of what it guards and an inaccurate description of what its
surrounding docstrings claim it guards.

## Surface classification

`Agentic-RAG` — our own backend and frontend. Routing candidate at the four GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** **213** (Per-Tool Grants and the Approval Moment). This is
  precisely GRANT-04 — *"a tool that is denied, or was never granted, is refused, and the
  refusal names the grant that would allow it"* — and 213 already owns the migration that turns
  `tool_grants` from `dict[str, bool]` into a posture. Closing this in 213 costs a guard
  condition and a test; closing it anywhere else duplicates 213's own work.
- **Defer to future phase / milestone:** n/a.
- **Plant as seed:** n/a — `SEED-214` is the *capability-breadth* seed and names this bug as a
  hard prerequisite, but this bug is a defect in shipped code and belongs in a phase.
- **External — note only:** no.

## Workarounds

- **Today the exposure is small and should be stated precisely rather than alarmingly:** a
  capability connection holds exactly one action, so disabling the connection withholds
  everything it can do. The missing control is *partial* withholding, which currently has
  nothing to withhold.
- The `live_connectors` kill-switch (Control Room) refuses every external call org-wide.
- Phase 189/190's armed checkpoint (D-19) still pauses a run before an external action on the
  governed canvas surface.

## Reference / evidence links

- `backend/app/services/harness/phase_types.py:2511-2524` — the gate and its MCP-shaped guard
- `backend/app/services/connectors/descriptors.py` — the docblock whose claim this contradicts
- `backend/app/services/connector_service.py:624-626, 822` — *"`tool_grants` is UNTOUCHED by the
  descriptor … the executor's gate reads `tool_grants` alone"*
- `frontend/src/components/settings/ConnectionFormPanel.tsx` — `grantsArePersisted`, the UI half
- Commit `4aa28090` — Phase 212 D-4b, which surfaced this while fixing something else
- `.planning/phases/212-the-catalog-and-its-doors/212-SUMMARY-D4-D5.md`
