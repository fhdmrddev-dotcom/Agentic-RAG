---
id: BUG-260913-01
title: The Google Drive adapter never writes `metadata.source.path` — on EITHER door — so path-based classification rules are silently inert for every Drive document
reported: 2026-09-13
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/sources, backend/ingestion, backend/watches, classification, frontend/library]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-253]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 008ece30b4fda5b9311fbdae2405dfbf1d94fb26
  date: 2026-09-13
---

# BUG-260913-01: The Google Drive adapter never writes `metadata.source.path`

## What we observed

Driven live in a real browser on 2026-09-13 during Phase 245's DEBT-01 / DEBT-02 UAT.

A `path contains '/Finance/'` **arrival-scope** classification rule was created through the real
surface (`RuleBuilderPanel`), stored correctly as
`{"op":"contains","field":"path","value":"/Finance/"}` with `rule_scope: watch`, suggesting a move
to `245-UAT-DELETABLE`. A file was placed in Google Drive at
`/245-UAT-throwaway-DELETABLE/Finance/` and imported **through both doors**:

| door | file | result |
|---|---|---|
| manual folder-import | `245-UAT-finance-invoice.txt` | `completed` · `folder_id: None` · `source.path: **null**` · **no `folder_suggestion` key** |
| watch loop (`Sync now`, `last_status: success`) | `245-UAT-finance-statement-watch.txt` | `completed` · `folder_id: None` · `source.path: **null**` · **no `folder_suggestion` key** |

**The rule fired on neither door.** It is not a rule-engine fault: the field the rule matches on
was never written, so `contains` had nothing to compare.

### The decisive measurement — it is the ADAPTER, not the door

Grouping the whole corpus by source system and whether `path` is populated:

| source system | `path` populated | count |
|---|---|---|
| `google` | ✅ yes | 27 |
| `google` | ❌ no | 41 |
| `microsoft` | ✅ yes | 2 |
| `microsoft` | ❌ no | 1 |

Every populated `google` value is **mail**: `/INBOX` (25), `/CATEGORY_FORUMS` (2). Every populated
`microsoft` value is **OneDrive**: `/Attachments/Practical_Project_Management_Guide_Recreated.docx`,
`/Attachments/Project Management Tutorial…txt` — the two documents Phase 238 drove for rows M-6/M-7.

⭐ **Not one Google *Drive* document in the corpus has a path** — including the pre-existing `CV`
watch, whose three documents (`Fahed Mrad_CV_Sep_2024.pdf`, `…Aug_2025.pdf`, `…Sep_2025.pdf`) all
read `path: null`. That watch has been running since before this phase.

So the split is **by adapter**, not by door: **Gmail sets it · Microsoft Graph sets it · Google
Drive never does.**

## Why it matters

⛔ **Every path-based classification rule is silently inert for Google Drive documents**, which is
the largest connected source in this deployment. No error, no warning: the import reports success,
the rule stays enabled, the rule list shows it as active, and it simply never matches. A user who
writes `path contains '/Contracts/'` gets a rule that looks correct, reads correctly in the UI, and
does nothing forever.

It also silently weakens anything else keyed on provenance path for Drive: `missing_at_source`
reasoning, folder-shaped filters, and any future routing that assumes `source.path` exists.

## Hypothesized cause

**Hypothesis, not finding.** Phase 238 fixed the `path` writer for the **Microsoft Graph** adapter
(its own note records `metadata.source` having two writers, and its M-6/M-7 evidence shows
`/Attachments/...` populated). The **Google Drive** adapter shipped in Phase 232 and appears never
to have had the equivalent fix — Phase 238-04's *"display ≠ stored; the walk no longer mutates
`SourceFile.path`"* change is the most likely place the Drive adapter's `path` is dropped or never
set. Compare `backend/app/services/sources/` — the Drive adapter against the Graph adapter — at the
point where `SourceFile` becomes the stored `metadata.source` envelope.

## ⚠ Superseded first diagnosis — kept deliberately, because the way it was wrong is the lesson

This report first concluded *"the **manual-import door** writes a null path; the watch door is
fine"*, on the strength of the manual import plus the contrasting `/INBOX` mail documents. **That
was wrong, and it was wrong because it generalised from one door before the other had been
measured.** Driving the watch arm — the second door D-05 insisted on — produced `path: null` too,
which is what redirected the diagnosis from the door to the adapter. Had only the manual arm been
driven, this would have been filed against the wrong component and a Drive-wide defect would have
been recorded as a folder-import bug. **Driving BOTH doors is what produced the correct cause.**

## Surface classification

`Agentic-RAG` — this app, the Google Drive source adapter.

## Suggested routing

- **Fold into in-flight phase:** n/a — ⛔ deliberately NOT folded into 245. D-16 caps any in-phase
  fix at G-3 (≤ 1 file, ≤ 10 lines, no schema/API surface); this needs an adapter change plus a
  cross-adapter fence, and 245 has no plan budget for it. **Finding it and filing it is the
  complete response.**
- **Defer to future phase / milestone:** the next phase touching Google Drive ingestion or
  classification rules.
- **Plant as seed:** n/a — concrete defect, concrete repro.
- **External — note only:** no.

⭐ **A fence is owed with the fix, not just the fix:** the same gap existed on Microsoft until 238
and on Drive since 232, so a test asserting *every* source adapter populates `source.path` is what
stops this recurring on the next adapter. That is the shape `backend/app/services/sources/base.py`
already invites.

## Consequences for Phase 238's UAT row M-9

Row M-9 reads *"a `path contains '/Finance/'` rule fires for a file that IS in that folder"*, and
238 is a **Microsoft Graph** phase — so M-9's own provider is **OneDrive**, where `path` IS
populated. ⚠ **This drive exercised Google Drive, not OneDrive**, so it does not settle M-9; it
found a different and wider defect. M-9's Microsoft arm remains owed (no `/Finance/` folder exists
in the OneDrive account and creating one is an operator action).

## Workarounds

- For Google Drive documents, write rules against `name`, `type`, `source_system` or
  `source_connection_id` — all of which are populated — rather than `path`.
- Gmail and OneDrive sources are unaffected; path rules work there.

## Reference / evidence links

- Phase 245 UAT: `.planning/phases/245-the-verification-debt-discharged-or-retired-in-writing/245-UAT-RESULTS.md`
- Phase 238 Defect 3, rows M-6/M-7/M-9: `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md`
- Phase 245 CONTEXT **D-05** — required both doors; that requirement is what produced the correct cause.
- `backend/app/services/sources/preview_service.py` (238-04 *display ≠ stored*), `backend/app/services/sources/base.py`.

## ⭐ Why it is SILENT — added 2026-09-13 during Phase 245's UAT, found by the OPERATOR

⚠ **`path` is not rendered on any screen in the product.** Measured, not assumed:

- `frontend/src/components/metadata/DocumentDetailPanel.tsx` — **zero** matches for
  `source_path` / `metadata.source` / a path field. The document detail panel never shows it.
- Across all of `frontend/src`, the **only** file mentioning `source_path` / `source.path` is
  `frontend/src/components/classification/RuleBuilderPanel.tsx:119` — the list of fields a rule
  may be written AGAINST.

⛔ **So the product lets a user build a rule on a field it will never display.** That is the
mechanism behind the word *silently* in this bug's title, and it is a **second, separable defect**
from the null write: even once the adapter is fixed, a user whose path rule matches nothing has no
surface anywhere that shows what `path` actually holds. Fixing only the adapter leaves the
diagnosis impossible for the next provider that regresses.

⭐ **How it was found is the point.** During Phase 245's UAT the operator was told to "look at the
source path in the detail panel" and replied *"I did not see in the metadata source path"* — the
instruction was wrong, and being wrong is what exposed the field's invisibility. **A bug whose
observation step cannot be carried out is telling you something about the product**, not about the
reader. ⚠ This is also why the row was scored from the artifact and not from the screen: the
screen cannot answer it.

**Consequence for any fix plan:** repairing `import_service` alone closes half of this. The other
half is surfacing `path` where a person can read it — the detail panel is the natural home
(`DocumentDetailPanel.tsx`, which already renders per-field metadata with a `ConfidenceChip`).
