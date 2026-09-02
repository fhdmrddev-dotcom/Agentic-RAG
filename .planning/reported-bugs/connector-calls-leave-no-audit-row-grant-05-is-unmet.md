---
id: BUG-260902-05
title: An approved connector call to a third party leaves NO audit row — the only tools audited are the internal ones that never leave the building (GRANT-05 unmet in shipped Phase 213)
reported: 2026-09-02
surface: Agentic-RAG
severity: blocking
status: folded
affected_areas: [backend/tool-dispatcher, connectors, grants, audit, governance]
folded_into: "223"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 6cd98c81c
  date: 2026-09-02
---

# BUG-260902-05: the calls that stay inside are logged; the calls that leave are not

## What we observed

A **fully successful, human-approved, live third-party call** was driven end to end:

1. Operator armed **Google Workspace** on a chat thread.
2. Agent proposed `search_files` with `query: rate sheet`, `limit: 50`.
3. Posture was `ask` → the run **paused** and rendered the approval card.
4. **The operator clicked `Approve once`** at ~14:41.
5. The call executed against the live Google Drive API with the operator's OAuth token and
   returned an honest answer.

**Elapsed: 41 seconds. Run status `completed`. The chain works.**

⛔ **And it appears in no audit ledger anywhere.** Measured immediately afterwards:

| table | rows | newest entry |
|---|---|---|
| `audit_log` | 6,256 | **14:09:32** — *before* the call |
| `operator_audit_log` | 921 | 2026-09-01 |
| `harness_audit` | 3,195 | 2026-08-29 |

## ⭐ The finding, stated precisely

`tool_dispatcher.py` **does** write audit rows — eight call sites. Every one of them is an
**internal** tool:

| line | `action_type` | leaves the machine? |
|---|---|---|
| 746, 843, 1010 | `search.query` | no |
| 1360 | `skill.load` | no |
| 2253 | `code.execute` | no (sandbox) |
| 2302 | `memory.remember` | no |
| 2347 | `memory.recall` | no |

⛔ **There is no `write_audit_entry` on the connector service-tool path at all.**

⚠ **So the ledger records the three searches I ran against my own knowledge base, and does NOT
record the call that used the customer's OAuth token against Google.** The property is exactly
inverted: **the calls with no external consequence are audited; the call with external
consequence is not.**

## Why this is blocking, not major

ROADMAP **GRANT-05**, verbatim, for **shipped and verified Phase 213**:

> *"**Every** outbound call made through a connection appears in the audit ledger naming service,
> tool, actor and outcome."*

**Zero outbound calls appear.** The criterion is not partially met — it is met for the empty set.

⚠ **A refusal IS audited but a success is not.** `_spawn_tool_refused_audit` (`:4236`, fired at
`:4617`) writes a `tool_refused` row — and its own docstring notes it is *"only reached when
`ctx.phase_whitelist is not None` (a workflow is active), so in pure Deep-Mode calls this is never
invoked."* **In chat, neither the refusal nor the success is recorded.**

⚠ **This is what an audit ledger is FOR.** After an incident the question is *"what did this
system send to whom, on whose behalf, and who approved it?"* — and every part of that answer was
present in memory at execution time (connection name, tool name, arguments, the approving user,
the outcome) and was written down nowhere. **The approval card even displays all four fields
before the call and discards them after.**

## Related, and it is the same hole from the other side

`BUG-260902-03` records that `active_connector_ids` is a request-only field, never persisted. So
there is no record of *which connectors were armed*, and now no record of *which calls were made*.
**Together they mean a connector's activity in chat is entirely unreconstructable.**

## For whoever fixes it

- The data is all in hand at the call site — `matched_conn.name`, `matched_conn.id`,
  `action_tool_name`, `args`, `ctx.user_id`, and the result status. This is a missing write, not a
  missing design.
- ⚠ **`args` may contain sensitive values** (a query, a recipient, a document body). What the
  ledger stores is a decision, not an obvious copy-everything — but *service, tool, actor,
  outcome* are named by the criterion and none of those four is sensitive.
- ⚠ **Check `VALID_ACTION_TYPES`.** `write_audit_entry` swallows errors (noted at
  `documents.py:1882`), so a new `connector.call` action type that is not registered would fail
  **silently** and reproduce this bug with code that looks correct.

## Not determined

- Whether connector calls made from a **workflow** run (rather than chat) are audited — the
  `harness_audit` path exists and was not exercised here.
- Whether `Always allow` grants are audited when created (a permission change with no receipt
  would be the same defect one layer up).
