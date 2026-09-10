---
seed_id: SEED-265
title: Narrow a search by connection or by saved View — SC#2 names two filter axes that do not exist, and Phase 241 deliberately did not build them
created: 2026-09-10
planted_during: Phase 241 (QUEUE-06), plan 241-04 — the verdict
status: planted
priority: medium
surface: Agentic-RAG
severity: minor            # Nothing is broken. This is an ABSENT capability, not a defect.
folded_into: null
relates_to:
  - `backend/app/services/retrieval_service.py` — `search_documents`, whose whole filter surface is
    `metadata_filter` and `folder_ids`. Any new axis is a parameter here first.
  - `backend/app/services/tool_dispatcher.py` — the `search_documents` tool schema the model sees.
    An axis absent here is an axis no agent can ever ask for.
  - `supabase/migrations/154_connection_scoped_visibility.sql:148-174` — `match_document_chunks`,
    the seven-predicate scan. `documents.source_connection_id` is READ here for VISIBILITY and is
    not exposed as a caller-supplied FILTER.
  - `.planning/phases/241-recall-at-corpus-scale/241-VALIDATION.md` — where SC#2 is scored
    honestly-partial and this seed is cited as the carry-forward.
trigger_when: >
  The FIRST surface appears that would actually narrow a search by connection or by saved View —
  a UI control on a search or chat surface, a `search_documents` tool-schema parameter, or a
  workflow binding that passes one. Building the filter before that surface exists ships a
  parameter with no caller, which is the presence-without-behaviour shape this project has paid
  for repeatedly. A retrieval-quality phase that adds ANY new caller-supplied filter axis also
  fires this, because the two axes below should be decided together with it rather than bolted on.
---

# SEED-265 — the two SC#2 filter axes that do not exist

## Why this exists

ROADMAP Phase 241 SC#2 reads:

> A search narrowed by **folder, saved View, connection or source** returns what an unnarrowed
> search would have found **within that scope** — the filter does not silently drop results that
> are there.

Four axes are named. **Two of them are not implemented anywhere in the product**, and Phase 241
scored SC#2 **honestly-partial** rather than quietly measuring three and reporting a pass.

## What was measured (2026-09-10, Phase 241 — re-derive rather than doubt)

### The tool signature is two parameters wide

`search_documents` accepts exactly **`metadata_filter`** and **`folder_ids`**. There is no
`connection_id`, no `view_id`, no `source_system` parameter — not in the Python signature, not in
the tool schema the model is shown, and not in `match_document_chunks`'s argument list.

### The two missing metadata keys

The live corpus's metadata keys, counted:

```
title(145) summary(142) document_type(135) topics(134) language(134) _confidence(126)
author(90) date(86) source(63) email_*(28) _classification(8) _vision(7)
attachments(5) contract_value(3) _takeoff(3) _images(1)
```

**There is no `source_connection_id` key and no `source_system` key.** So neither axis is even
reachable by the generic `metadata @>` escape hatch, which is how a third axis turned out to be
reachable after all (below).

### Three axes ARE reachable, and Phase 241 measured all three

| Axis | How it is reached | Measured at 241 |
|---|---|---|
| folder | `p_folder_ids` — a real RPC parameter | ✅ measured, 3 tenant selectivities |
| arbitrary metadata | `metadata @> '{"document_type": …}'` | ✅ measured |
| **`source.system`** | `metadata->'source'` is a NESTED OBJECT (`{path, system, version, external_id}`), so `{"source":{"system":"google"}}` matches by jsonb containment | ✅ measured — reachable after all, and only because the shape was inspected rather than assumed |

⭐ **The `source.system` finding is the reason this seed is worth reading before building anything.**
The phase's own context first listed it among the unreachable axes; inspecting the actual jsonb
shape moved it into the measured column at zero cost. **Check the shape before concluding an axis
is missing.**

### `source_connection_id` exists — on the wrong side of the boundary

`documents.source_connection_id` is a real, populated column (66 connection-sourced documents at
the phase's start), and `match_document_chunks` already reads it — through
`connection_doc_is_visible()`, as part of the **visibility** predicate. So the column is present
and the scan already touches it. **What is absent is a caller-supplied filter on it.** That is a
smaller gap than "the data does not exist", and it is exactly why this is a seed and not a defect.

## Why it was NOT built

Nothing today would call it. No UI control, no tool-schema parameter, no workflow binding would
pass a connection id or a View id into a search. A filter exercised only by the measurement
harness is a green fence beside no behaviour — the shape this project has now paid for at Phase
235 (a `data-testid` presence assertion that could not see content drift), at Phase 240 (a fence
that stayed green when the call it guarded was deleted) and at Phase 239 (`Boolean(mcp_server_url)`
printing "Ready as source" for rows that resolved no adapter).

⛔ **Adding the parameter would have made SC#2 score green while changing nothing a user can do.**
That is a worse outcome than a partial score with a reason.

## Likely shape when it lands

1. **Decide the two axes together.** A saved View is already a stored filter expression; the
   natural implementation is *resolve the View to a `metadata_filter` + `folder_ids` pair* rather
   than a third RPC parameter. Connection-by-id is a genuine new predicate on `documents`. They are
   different mechanisms and should not be assumed symmetric because SC#2's sentence lists them
   side by side.
2. **The surface comes first, not the parameter.** Whatever fires `trigger_when` defines the
   argument shape; do not guess it in advance.
3. **Re-run Phase 241's harness on the new axis.** `scripts/measure-recall.py` takes filter shapes
   as data (`FILTER_SHAPES` in `backend/app/services/recall_eval.py`) — a new axis is a new entry,
   and the before/after is then the same measurement that already exists. **The instrument is
   already built; that is what this phase leaves behind.**
4. ⚠ **Whatever ships must respect the selectivity finding.** Phase 241 measured a 0.2%-share
   tenant getting `recall@20 = 0.040 / underfill 0.960` on the shipped `ef_search = 40`. A NEW,
   more selective filter axis makes the caller's effective share smaller, not larger — so a
   connection filter on a small connection is the most starvation-prone query the product could
   offer. Ship it with the `hnsw.ef_search` / `hnsw.iterative_scan` settings understood, not after.

## Deliberately NOT in scope

Retrieval *quality* (SEED-020 / 059 / 087 / 153 / 243 — embedding model, re-ranker, exact-identifier
keyword semantics). Per-tenant partial indexes or partitioning (SEED-076 §4, still deferred with its
own trigger). Any change to the visibility predicate — `connection_doc_is_visible()` is a security
boundary and a caller-supplied *filter* must narrow within it, never widen past it.
