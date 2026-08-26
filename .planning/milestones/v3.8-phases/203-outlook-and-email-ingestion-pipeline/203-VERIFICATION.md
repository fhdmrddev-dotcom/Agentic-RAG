---
phase: 203-outlook-and-email-ingestion-pipeline
verified: 2026-08-26
status: passed_retroactively
retroactive: true
retroactive_reason: "No VERIFICATION.md existed. Written at milestone close from evidence RE-DERIVED at HEAD, never transcribed."
requirements: "EML-01, EML-02"
gaps_count: 2
---

# Phase 203 - Verification Report (RETROACTIVE)

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


**Phase Goal:** `.msg` and `.eml` files ingest, threads dedup, attachments link.

**Requirements:** EML-01, EML-02  
**Verified:** 2026-08-26 - **Status:** `passed_retroactively`

## Measured at HEAD on 2026-08-26

`pytest tests/unit/test_email_ingestion.py` -> **31 passed**

## Evidence

- `203-01-SUMMARY.md` records the parse / dedup / attachment-link path.
- `REQUIREMENTS.md` marks EML-01 and EML-02 **Complete (2026-08-24)**.
- **A REAL defect on this path was found and fixed by real data**, twice - v3.7's close (`22P05`, a NUL in a MAPI subject) and again 2026-08-25 (`97881102` *fix(ingestion): MIME door refused docx/pdf, and no path stripped NUL*). A path that has been broken by real files and repaired carries stronger evidence than one that has only ever been mocked.

## Gaps and honest limits

- **Two ingestion bugs were closed on LOCAL-ONLY evidence and still owe cloud verification** - a `.docx` + `.pdf` upload, and an OpenRouter model that 404'd whose **model id was never captured**. Carried into the next milestone.
- No recorded live UAT of thread dedup across two genuinely related `.msg` files.

## Verdict

Requirement(s) **EML-01, EML-02** are satisfied by code whose evidence was re-derived on 2026-08-26.
The gaps above are recorded as **carried debt**, not blockers - none of them claims the shipped
behaviour is absent. **This is not a claim that the phase was verified when it shipped.**
