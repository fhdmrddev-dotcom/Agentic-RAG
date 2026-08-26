---
phase: 201-csv-and-structured-tabular-ingestion
verified: 2026-08-26
status: passed_retroactively
retroactive: true
retroactive_reason: "No VERIFICATION.md existed. Written at milestone close from evidence RE-DERIVED at HEAD, never transcribed."
requirements: "TAB-01"
gaps_count: 2
---

# Phase 201 - Verification Report (RETROACTIVE)

> ## THIS REPORT IS RETROACTIVE, AND SAYS SO IN ITS OWN FRONTMATTER
>
> It was written on **2026-08-26**, at milestone close, because `/gsd:audit-milestone` found that
> **seven of v3.8's twelve phases had no `VERIFICATION.md` at all** - 201, 202, 203, 204, 205,
> 206 and 209. The phases shipped; the verification ARTEFACT was never written. This file closes
> the artefact gap and **must not be read as a contemporaneous verification**.
>
> **What that costs, stated plainly:** a verification written at execution time can catch a phase
> before anything is built on top of it. This one cannot - five later phases already stand on this
> work. What it can still do honestly is **re-derive the evidence at today's HEAD** rather than
> transcribe the phase's own SUMMARY, and that is what the scorecard below does. Every number in
> it was MEASURED on 2026-08-26, not copied.
>
> **`status: passed_retroactively` is deliberately NOT `passed`.** It records that the code
> satisfies its requirement on evidence re-derived today - never that the phase was verified when
> it shipped, which it was not.


**Phase Goal:** A CSV or spreadsheet becomes queryable structured data - `document_tables` rows that `query_table` can read.

**Requirements:** TAB-01  
**Verified:** 2026-08-26 - **Status:** `passed_retroactively`

## Measured at HEAD on 2026-08-26

`pytest tests/unit/test_tabular_text_extraction.py tests/unit/test_aspect_engines_tables.py` -> **31 passed**

## Evidence

- `201-01-SUMMARY.md` records the shipped extraction path and its task commits.
- `REQUIREMENTS.md` marks TAB-01 **Complete (2026-08-24)**.
- Phase 202 CONSUMES this phase's output and its own tests pass - a downstream phase depending on it is live evidence the contract holds.

## Gaps and honest limits

- **No live UAT artefact exists for a real spreadsheet upload through the browser.** The tests exercise extraction; nobody recorded driving a file through the Documents UI.
- v3.7's close recorded that a real `.msg` died on `22P05` (a NUL byte) that **5,438 green frontend tests and 91 green ingestion tests could not catch**. That was the sibling ingestion path, and it is the standing reason a green unit suite is not sufficient evidence for an ingestion phase.

## Verdict

Requirement(s) **TAB-01** are satisfied by code whose evidence was re-derived on 2026-08-26.
The gaps above are recorded as **carried debt**, not blockers - none of them claims the shipped
behaviour is absent. **This is not a claim that the phase was verified when it shipped.**
