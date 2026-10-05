---
seed_id: SEED-334
title: An admin "must filter" flag on a metadata field, so a provider that will not emit the filter cannot answer without it
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "FIRED 2026-10-03 at Phase 272's close: the SC#10 board recorded Google (gemini-3.5-flash) UNMET on (a)/(b)/(c) because it does not emit the filter reliably, and MiniMax-M3 UNSTABLE run to run. Re-surface when a phase scopes per-provider tool policy, makes the tool roster provider-aware, touches search_documents_tool.py or metadata_fields.py, or a customer reports a period/entity answer scoped by prompt instead of filter."
trigger_paths: ["backend/app/services/search_documents_tool.py", "backend/app/services/retrieval_scope.py", "backend/app/api/metadata_fields.py", "backend/app/services/google_service.py"]
trigger_surfaces: ["retrieval", "provider", "admin"]
migration_note:
relates_to: ["SEED-153", "272-CONTEXT.md D-01 and <deferred>", "272-VALIDATION.md §3 / §3b", "272-UAT-LOG.md 'Google 0/3 — bounded investigation'", "SEED-076"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-334: an admin "must filter" field flag

## The finding

Phase 272 (FIND-07) made `search_documents` accept a structured `filters` argument and fail closed
on an empty match. By D-01 the model decides which of the org's fields to filter on, and there is
no admin flag that forces it. The phase's own CONTEXT `<deferred>` recorded the revisit trigger:
*"Admin 'must filter' field flag: rejected for now (D-01). Revisit if the SC#10 board shows a
provider that will not emit filters reliably."*

That trigger fired at the phase close on 2026-10-03:

- **Google, `gemini-3.5-flash`: UNMET on all three prompts, on both boards.** The cause is the
  model's behaviour, and it was investigated. The `search_documents` schema reaches Gemini intact
  (`_sanitize_schema_for_google` keeps `filters` as `ARRAY` of `OBJECT` with all 6 item
  properties), and Gemini emitted well-formed filters 3 times. It still scoped (a) with
  `query_documents` SQL and `filters: []`, widened (b) on its own to an unfiltered search and an
  "ACME Corporation" title filter, and in (c) hit the 15-step iteration cap with no answer. Our
  part, F-2 (a matched document dropped by the threshold and by cross-document dedup), was fixed
  under D-27, and Google (b) still failed after that fix.
- **MiniMax, `MiniMax-M3`: UNSTABLE.** It went PASS to FAIL on (a) and FAIL to PASS on (c) between
  two boards, with neither change attributable to a code change. One sample is not a measurement.

The other six rows (openai, anthropic, deepseek, zhipu, moonshot, openrouter) emitted the filter on
every prompt.

## Why it matters

With D-01 alone, the filter is only as reliable as the model's willingness to emit it. A tenant
whose default model is Gemini can ask "October revenue" and get a figure scoped by a SQL `LIKE`,
or by nothing, and the visible "Filtered: …" line will be absent or will not match the answer.
That is the SEED-153 failure ("the wrong month, cited confidently") coming back through the
provider instead of through the tool. Nobody has reported it in production yet. The evidence is
the local board.

## When to surface

Any phase whose `files_modified` names `search_documents_tool.py`, `retrieval_scope.py`,
`metadata_fields.py` or `google_service.py`. Also any phase that scopes per-provider tool policy or
trims the tool roster per provider. Google's own function-calling guidance says to keep 10-20 tools
active, and we expose 28, so that phase and this flag are likely the same conversation.

## Scope estimate

Medium. It needs a boolean on the field definition (a migration and a settings UI control). It
also needs an enforcement point that refuses a `search_documents` call, and the sibling read tools
(`query_documents`, `grep`, `read_document`), when a must-filter field is in scope and absent from
the call. The sibling tools are the hard part: D-22 records that only `search_documents` is
structurally locked today.

## Breadcrumbs

- Board 1 and the re-runs: `.planning/phases/272-close-means-wrong/272-VALIDATION.md` §3 and §3b,
  `evidence/board/`, `evidence/board-rerun/`, `evidence/board-rerun-b/`.
- Google investigation (provider docs fetched 2026-10-03; sanitizer output; emission count):
  `272-UAT-LOG.md` → "Google 0/3 — bounded investigation".
- Operator decision, 2026-10-03: *"Close with Google recorded unmet"*. SC#4 is met on 6 of 8 rows
  by decision, not by every row passing.
- Commits: `9c6cfdeb5` (first board), `c0393f7b2` and `617d45754` (re-runs), `c29ec8635` (rulings).
