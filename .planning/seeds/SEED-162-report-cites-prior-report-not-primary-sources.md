---
seed_id: SEED-162
title: A produced deliverable cited a PRIOR deliverable (and the template itself) instead of primary sources
status: open
planted: 2026-08-14
planted_by: Quick task 260814-q5r end-to-end run — the finding that survived BUG-260814-01's refutation
surface: Agentic-RAG
severity: medium
affected_areas: [retrieval, RAG, workflow-runs, document-management, KB-hygiene]
requirements: [AUTH-03]
re_open_trigger: >
  Any workflow whose produced output is itself ingested into the KB the workflow retrieves from
  (the feedback loop), OR the first recurring customer deliverable, OR any phase touching
  retrieval ranking / source selection for llm_emit. Whichever comes first.
trigger_when: unset
---

# The report cited a previous report

## Measured, on a real run

Run `26b5a898-c0ca-4fbb-ae35-ed488bbf2eb2` (2026-08-14, `weekly-status-report` v1, completed,
produced a 37,585-byte `.docx`, 8/8 fields filled). Three of the eight fields were sourced from a
single document:

| field | source document | folder |
|---|---|---|
| `project_name` | `weekly-status-report.docx` | NULL (unfiled) |
| `reporting_period` | `weekly-status-report.docx` | NULL (unfiled) |
| `risks_blockers` | `weekly-status-report.docx` | NULL (unfiled) |

The other five came from `weekly-meeting-notes-week9.md` and `sprint-task-log.md` — the primary
sources you would want.

⚠ **This is NOT a scope violation.** That was investigated as `BUG-260814-01` and **refuted**: the
workflow declares no `project_folder_id` and no `folder_scope`, so a whole-KB search was correct.
And the citations are **real** — all 8 cited chunk ids were verified present in the emit phase's
own 41 `retrieved_ids`. Nothing malfunctioned.

## Why it is still a problem

`weekly-status-report.docx` (ingested 2026-06-19) is a *previous status report* or the template
itself sitting in the knowledge base. So the new report partly restates an old report rather than
deriving from this week's evidence.

**The failure mode is drift, and it is invisible:**

- every honesty gate passes — citations resolve, `invented_citation_count` is 0, coverage is clean
- the output looks perfect and is perfectly sourced
- but `risks_blockers` describing *last* period's risks in *this* period's report is exactly the
  error a weekly status report exists to prevent
- and it **compounds**: if each produced report is ingested, report N+1 cites report N, which cited
  report N−1. Nothing in the loop ever forces a return to primary evidence.

⚠ **`project_name` and `reporting_period` are the tell.** Those are the two most "stable-looking"
fields, and they are exactly the ones a model will happily lift from a prior document rather than
re-derive — which is why the drift starts silently at the boundary fields and works inward.

## Shapes worth considering (none decided)

1. **Exclude the workflow's own template from retrieval.** A bound template is an *instruction*,
   not *evidence*. It should arguably never be a citable source for the workflow that fills it.
   Cheapest, narrowest, and closes the template half outright.
2. **Recency / primary-source preference in the emit step's source selection** — prefer documents
   that are not themselves produced deliverables.
3. **Mark produced deliverables in the KB** (a provenance flag) so retrieval can de-prioritise or
   exclude them, and so a person can see the loop exists.
4. **Say it out loud on the run surface:** *"3 of 8 fields were sourced from a previous
   deliverable."* Does not prevent the drift, makes it visible — cheapest honest option, and the
   same shape as [[SEED-159]].

⚠ **Do not fix this by excluding unfiled (`folder_id IS NULL`) documents wholesale** — that is a
coincidence of this database, not the rule, and it would silently drop legitimate KB content.

Related: [[SEED-159]] (silent blanks — same run, same honesty class), `BUG-260814-01` (refuted;
this seed is what survived it).
