---
id: BUG-260828-01
title: The approval pause names the tool and the arguments but never the SERVICE — in either connection shape
reported: 2026-08-28
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/harness, workflows/approval, connections]
folded_into: 214
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 5bbfa24aa
  date: 2026-08-28
---

# BUG-260828-01: The approval pause never names the service

## What we observed

Driven as real workflow runs against the live local stack during Phase 213's driven check
(`213-SUMMARY.md` §3). Both connection shapes, verbatim prompts:

**MCP shape** — an `external_action` step bound to the DeepWiki MCP connection:

> Step 1 of 1, "Read the DeepWiki structure", is about to run. This step is marked as needing your
> approval first. The run is waiting here and will not continue until you answer. It will run
> "read_wiki_structure". What it will send — repoName: anthropics/claude-code.

**Capability shape** — an `external_action` step bound to the Slack connection:

> … It will run "post_message" **through post_message**. What it will send — text: 213 driven check …

Expected (ROADMAP Phase 213 SC#3): *"the run pauses and shows a person **the service**, the tool and
the exact arguments"*. The tool and the arguments are shown. **The service is shown in neither
shape** — it is omitted entirely on MCP, and on a capability row the slot is filled with the
capability verb, which repeats the tool.

## Why it matters

The person approving is told *what verb runs with what payload* and not *where it goes*. On the
operator's own rows that means a GitHub, DeepWiki or Notion pause names no destination at all, and a
Slack pause reads as a tautology. Two connections to the same service, or a connection bound to the
wrong workspace, are indistinguishable at the only moment a person can stop the send — which is the
moment the whole approval model exists for.

## Hypothesized cause

**Verified, not hypothesised.** `_external_action_clause` (`backend/app/services/harness/grounding.py:1283`)
composes the clause from `phase.config` alone:

```python
service = getattr(config, "capability", None)
where = f" through {service}" if service else ""
```

- An MCP row carries `capability = None`, so the clause is dropped. That is deliberate and its
  reason is sound (*"never draw a name the system cannot know"* — the same rule that keeps an SMTP
  connection on the neutral mark instead of borrowing Gmail's).
- A capability row carries the SAME value in `tool` and `service`, because `tool_name` is null for
  that shape and both fall back to `capability`.

The connection's real identity (`name`, `service_id`) is known — it is on `connector_connections` —
but the composer is deliberately **pure** (no pool, no connection lookup) and the engine calls it
before Gate 5 has resolved anything. So naming the service means either resolving the connection
earlier or passing the resolved name into the composer. That is a design choice, not a typo, and is
why this is a bug report rather than a fast-fix.

## Surface classification

`Agentic-RAG` — this app's harness and workflow surface.

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 213 is closed; recorded as a finding, not a further
  gap-closure round — G-7).
- **Defer to future phase / milestone:** **Phase 214** (*A Step Names Its Service and Its Action*) —
  the phase whose entire subject is a step naming its service. This bug is the run-time half of it.
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds

Name the destination in the step's own `name` — the pause quotes it verbatim ("Step 1 of 1, *…*").
That is authoring discipline, not a guarantee.

## Reference / evidence links

- `.planning/phases/213-per-tool-grants-and-the-approval-moment/213-SUMMARY.md` §3, finding D-1
- `backend/app/services/harness/grounding.py:1242-1293` (`_external_action_clause`)
- ROADMAP Phase 213 SC#3

## Phase 214 close (plan `214-15`, 2026-08-28) — why this stays `folded` and is NOT `closed`

`214-06` reports it fixed on **both** connection shapes — the capability row and the MCP row —
with the approval composer taking the service it cannot know as a parameter, and with a failing
connection lookup no longer able to kill the pause. `214-11` carried the identity onto
`PendingAskCard`.

⛔ **`verified_closed_by` stays `null` pending G4-6**, which asks two things no unit test
asserts together: that the pause names the SERVICE (not `post_message` twice, not a nameless
MCP row) and that it lists **all three** arguments including the launch-asked one and the
upstream one.

⚠ **`T-214-06-03` is PARTIAL and is recorded as an OPEN FINDING rather than a mitigation.**
`_resolve_failure_with_ask_user`'s governance receipt writes `metadata["finding"] =
error_message`, and for an ARMED checkpoint that string is the entire approval sentence — so
D-213-14's *"shown once, recorded never"* holds for `_write_send_receipt` and **fails** for the
approval receipt. Pre-existing since Phase 187; **this phase WIDENED its content to
launcher-supplied and LLM-produced text.** It needs an operator decision — see `SEED-223`.
