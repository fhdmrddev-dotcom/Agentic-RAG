---
id: BUG-260929-01
title: query_documents returns documents from a sibling Expert's folder inside a restricted Expert thread
reported: 2026-09-29
surface: Agentic-RAG
severity: major
status: fixed-pending-redrive
affected_areas: [backend/tools, RAG/retrieval, experts/scope]
folded_into: null
verified_closed_by: null   # closes only when the held security-compliance refusal turn is re-driven live and PASSES
related_seeds: []
re_open_trigger: "any phase whose files_modified names backend/app/services/tool_dispatcher.py, the query_documents service, or the Expert scope resolution (run_producer.py / expert_service.py); OR the operator asks to re-drive and ship the held security-compliance Expert — its refusal turn must be re-driven and PASS after the fix"
reproduces_on:
  branch: develop
  commit: b081cefd5f6ab0586db5cb9092e01293a63a0f5c
  date: 2026-09-29
---

# BUG-260929-01: `query_documents` ignores a restricted Expert's folder scope

## What we observed

Phase 269 plan 03 live drive, LOCAL stack, one fresh enterprise-tier test org
`9042e46f-745d-40d6-83eb-c6984d582ce1` with five installed starter Experts, each in its own install
folder. Model `deepseek-v4-flash` / provider `deepseek`.

- In the **security-compliance** Expert thread (a `restricted` Expert, install folder `16db0107-…`), the
  refusal turn asked for a figure that lives only in a SIBLING Expert's corpus.
- The agent called `query_documents` with raw SQL over `documents`. The tool result contained document
  `297c6ee8-739f-4b64-b5d6-073957e9f0b1` (`acme_q3_2026_financial_report.md`, title "ACME Corporation - Q3
  2026 Financial Results and Form 10-K Report", folder "Financial Reports & Filings") — the **Financial
  Analyzer's** installed document, **outside** the restricted Expert's install folder.
- The answer refused the figure but **disclosed that file's name and title** and offered to "step outside
  the current scope".
- `search_documents` in the same turn stayed inside the Expert's folder — the leak is on the
  `query_documents` path only.
- Of the ten live cited/refusal turns, this was the only one where `query_documents` returned a foreign
  document; contract-reviewer and operations-analyst also called `query_documents`, but their queries
  matched nothing foreign. So the other shipped Experts are **not immune** — their turns simply did not
  exercise the path.
- **Expected:** a restricted Expert's every retrieval tool is bounded to its install folder(s).
  **Actual:** `query_documents` saw same-org documents in a sibling folder.
- **No cross-tenant read was observed** — the foreign document was in the same org.

Evidence: `.planning/phases/269-starter-expert-library/evidence/06-security-compliance-refusal.txt`
(`VERDICT: FAIL`, supplementary tool-result scan), `269-UAT-LOG.md` footnote ².

## Why it matters

Severity: **major** (the operator's brief called it medium-high; the template enum has no such value).
A restricted Expert's promise is "answers from this knowledge only". Any restricted Expert whose agent
chooses `query_documents` can see sibling-folder document metadata (id, filename, title — possibly more,
depending on the SQL the model writes) within the org. It is why the security-compliance starter Expert
was HELD from migration 198 (D-269-09, ship fewer, never weaken), and it applies equally to the four
Experts that did ship.

## Hypothesized cause

⚠ **HYPOTHESIS, NOT VERIFIED — no code was read beyond the call site and none was changed.**
`tool_dispatcher._handle_query_documents` (`backend/app/services/tool_dispatcher.py:978-983`) bounds the
query by `folder_ids=ctx.folder_subtree_ids`. For an Expert-scoped thread with no thread folder, that
field may be unset/empty, which the `query_documents` service may treat as "no folder bound" (search all),
whereas `search_documents` applies the Expert's knowledge-folder scope through a different path. Compare
266 CR-01 ("empty restricted scope = search EVERYTHING"). The fix owner must verify which value
`folder_subtree_ids` carries for an Expert thread before changing anything.

## Surface classification

`Agentic-RAG` — this app's tool dispatcher and Expert scoping.

## Suggested routing

- **Fold into in-flight phase:** n/a — not a Phase 269 closure item (G-7: a closure round may not add
  capability, and 269 changed no code by design).
- **Defer to future phase / milestone:** the next phase touching Expert scope or `tool_dispatcher.py`
  (see `re_open_trigger`); the fix must come with a live refusal re-drive, not a unit test alone.
- **Plant as seed:** no — this is a defect, tracked here.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

None safe for users. Operator-side: do not ship a restricted Expert whose refusal drive shows any
`query_documents` hit outside its folder (the 269 evidence gate's supplementary scan does this).

## Reference / evidence links

- `.planning/phases/269-starter-expert-library/269-UAT-LOG.md` (footnote ², Operator lock)
- `.planning/phases/269-starter-expert-library/evidence/06-security-compliance-{install,cited,refusal}.txt`
- `supabase/migrations/198_starter_expert_library.sql` header (HELD BACK note)
- `backend/app/services/tool_dispatcher.py:978-983`

## ROOT CAUSE + FIX (2026-09-29, fast fix under G-3 — corrects the hypothesis above, original kept)

The hypothesis that `folder_subtree_ids` was unset for Expert threads was **REFUTED**: `query_documents` did apply the scope. The defect was in `sql_service._inject_folder_scope`: it appended `AND d.folder_id IN (...)` to the model's WHERE **without parentheses**. SQL binds AND tighter than OR, so `WHERE a OR b OR c AND folder` scoped only `c`; the leaking turn's query was `filename ILIKE .. OR filename ILIKE .. OR title ILIKE ..`. It affects every folder-scoped chat, not only Experts (RLS still confined it to the org — no cross-tenant read).

**Fix:** the whole existing predicate is parenthesised before the folder condition is ANDed on. `backend/tests/unit/test_sql_scope_or_precedence.py` (6 tests; 4 RED before the fix, 6 green after).

**Live proof (local DB, uat269 admin, Security folder `16db0107-…`):** the exact leaking query with the OLD injection returned `acme_q3_2026_financial_report.md` (folder `cc435f1e`, the Financial Analyzer's); through the fixed `query_documents` it returns `No results.` The 13 failing tests in the related `-k "sql or query_documents or folder_scope"` selection are the SAME set with and without the change (existing baseline red).

**Not done — deliberately:** security-compliance is still HELD and not shipped. Un-holding it needs its refusal turn re-driven live in a fresh enterprise-tier org with a PASS transcript (D-269-09), then re-promotion into a migration. The other four Experts' PASS verdicts were single samples that did not exercise the leaking query shape; they should be re-driven with an OR-shaped question before anyone claims strict isolation.
