# Phase 217 — deferred items

Out-of-scope discoveries logged rather than fixed. Each carries a re-open trigger.

## 217-08 — two sketch-drive fences left RED because they are NOT this plan's

Measured 2026-08-29 while running `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs`
at plan 08's base (`6eaa83df5`, wave 2 merged). The drive reads **196 passed · 2 failed · 198
assertions**. Both failures are on `frontend/src/components/ingestion/DocumentUpload.tsx`, which is
**byte-unchanged by plan 08** (`git diff --numstat <base> HEAD -- <that file>` is empty and
`git status --short` on it is clean). They were introduced by **plan 217-07**, commit `50050df23`
*"feat(217-07): the upload band — a front door that names its folder"*, which rewrote that file.

| Fence | Why it reds | Who owns it |
|---|---|---|
| `D2 · the shipped input accepts 8 extensions` | the fence extracts a literal `accept="…"`; the shipped input is now `accept={acceptAttribute()}`, so the extraction is `(none)` and the count is 0 | 217-07 |
| `D3 · the shipped upload path reports no byte progress` | the fence greps the source for `onUploadProgress`; 217-07 added a DOCBLOCK containing that word (`DocumentUpload.tsx:45`) while the behaviour the fence asserts is still TRUE — a comment reds a source grep | 217-07 |

⚠ **`D2` is not merely stale — it is now BLIND.** It used to read "8 extensions" out of the
attribute; with the attribute computed, the fence measures nothing at all, so it can carry no claim
about the accepted set in either direction. `D2b` / `D2c` still pass, so a reader glancing at the
block sees mostly green and one red that looks like a count drifting.

**Not fixed here** under the scope boundary (only defects directly caused by this plan's own changes
are auto-fixed) and under this plan's explicit fence-ownership rule (*"⛔ Do not touch `A3b` (plan 06
owns it) or `A7b`/`A7c`/the `src()` paths (plan 04 owns them)"* — `D2`/`D3` are the same shape of
claim over plan 07's file). Both need re-pointing at `acceptedFormats.ts` / `acceptAttribute()`
rather than at the JSX literal, which is a rewrite of the assertion, not a number bump.

**Re-open trigger:** the next plan whose `files_modified` names
`.planning/sketches/218-the-library-and-its-tabs/drive.cjs` **or**
`frontend/src/components/ingestion/DocumentUpload.tsx` — plan 12 is the natural home.

---

## RESOLVED 2026-08-29 — the `D2` / `D3` sketch reds (orchestrator, at 217-08's merge)

Fixed at the wave-3 post-merge gate rather than deferred. Recorded here because the
*shape* of the defect is the finding, not the two red lines.

**It was a cross-plan seam — each side green alone.** 217-07 replaced `DocumentUpload.tsx`'s
transcribed `accept="..."` literal with a COMPUTED `accept={acceptAttribute()}`, which is the
better shape and passed every check 217-07 ran. `drive.cjs`'s `D2` parsed that literal with a
regex. Neither plan could see the break; only the merged tree shows it.

⚠ **And the break was NOT symmetrical, which is the part worth keeping:**

| fence | after 217-07 | why |
|---|---|---|
| `D2` | RED | the regex matched nothing — loud, and therefore harmless |
| `D2b` | **GREEN, VACUOUSLY** | `[].every(...)` is `true` |
| `D2c` | **GREEN, VACUOUSLY** | `![].includes(".msg")` is `true` |

Two fences reported PASS while measuring an empty set. **A guard that passes over nothing is
worse than one that fails**, and a run reading `2 failed` conceals that two of the greens were
also broken. 217-08 called `D2` *"blind, not stale"* and was exactly right.

**The repair.** `D2` now reads `acceptedFormats.ts` — the single constant the input computes
from — instead of the deleted literal, so it follows the source of truth rather than a
rendering of it. A new **`D2z` non-vacuity control** fails loudly at zero, so `D2b`/`D2c` can
never again pass over an empty list. `D2z` was **driven RED** against a moved source (renaming
`Object.freeze` in the constant) and fired; `acceptedFormats.ts` was restored **md5-identical**.

**`D3` was a different bug with the same cause.** It greps for `onUploadProgress`; 217-07 added
a docblock that *mentions* `onUploadProgress` to explain that there is none. A source grep
cannot tell code from prose, so a behavioural fence reddened over behaviour that is still true.
It now strips comments and reads code only.

**Result:** `196 passed / 2 failed` → **`199 passed / 0 failed / 199 assertions`**.
`BUILD-CONTRACT.generated.md` regenerated from the driver, never hand-edited.

**Carry-forward:** a fence that reads a *rendering* of a value breaks when the rendering is
improved. Prefer reading the constant. And every extract-then-quantify fence needs a
non-vacuity control beside it — the empty set satisfies `every` and `!includes` silently.

---

## RESOLVED 2026-08-29 — sketch fence `D4` inverted (orchestrator, at 217-10's merge)

`D4` asserted `documents.full_markdown` has **zero** non-test frontend references — a
BURIED-CAPABILITY audit: the parsed text was stored and nothing read it. Plan 217-10 shipped
`DocumentContentSection.tsx` + `lib/api/documents.ts`, so the fence began failing **at the exact
moment its subject stopped being a defect**. That is LIB-04 delivered, not a regression.

Same class as 217-04's `H2b`: **a verbatim check cannot tell "still buried (bad)" from
"deliberately surfaced (the goal)"** — it measured the symptom rather than the property.

Inverted to assert the capability IS reachable, which is the property worth defending from here
on: a later refactor that quietly drops the last reader re-buries it, and this now reds. The
original claim is preserved verbatim in a comment above it, never overwritten.

⚠ **My first RED control did not fire, and the fence was innocent — I was wrong.** I renamed
`full_markdown` -> `full_markdownXX`, and `feMentions` uses a **substring** `includes()`, so the
needle was still present. Re-driven with a true rename (`-> parsedBody`): `refs = 0`, `D4` fires,
both files restored **md5-identical**, drive back to `199 passed / 0 failed`. Recorded because a
control that silently fails to fire is exactly how a fence gets believed without evidence.

⚠ **PREDICTED for wave 5 — `D5c` is the next one to go obsolete the same way.** It asserts *"the
frontend renders only COUNTS of tables/images today"*. Plan 217-11 renders tables as tables and
image descriptions, which makes that claim false BY SUCCEEDING. Plan 11's agent has been told to
invert it rather than delete it, on this same pattern.

---

## DEFERRED at the phase's CLOSE (`217-12`, 2026-08-29) — each with a re-open trigger

⛔ **A deferral with no re-open trigger is a deletion that looks like a decision.** Every item below
carries one.

### 1. Twelve comment-only `IngestionPage` references — DECLINED, not swept

`217-04` left them deliberately (later plans in the same wave owned several of the files, and a
same-wave edit would have collided). At close they are still present:
`App.tsx:288,290` · `ClassificationRulesPage.tsx:29` · `FilterBar.test.tsx:127` ·
`DocumentDetailPanel.tsx:307` · `RelationshipsSection.tsx:9` · `citationNav.tsx:11,56,129` ·
`GovernancePage.tsx:95` · `types/index.ts:328`.

**Declined at close rather than swept, and the reason is specific rather than caution.** Two of the
twelve sit in files where a *comment* is load-bearing to a fence: `types/index.ts` carries the
docblock that `217-08` deliberately wrote to avoid spelling `full_markdown`, because sketch fence
`D4` uses a **substring `includes()`** and a mention in a comment reds it. This phase has watched the
mention-vs-use trap fire **five times**; a cosmetic comment sweep across eleven files is exactly the
shape of edit that trips it, and it would land in the closing commit with no wave left to catch it.

**Re-open trigger:** the next phase whose `files_modified` names any of those files — sweep that
file's references in the same commit. ⛔ Any sweep of `types/index.ts` must re-run
`node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` in the same turn.

### 2. A real backend defect, found by `217-07` — RECORDED, deliberately NOT fixed here

A `.csv` announced as `application/vnd.ms-excel` is **accepted**, routed to `openpyxl`, and dies on
`BadZipFile` in the background: the upload returns **201** and the row later flips to `failed`.
`.xls` is absent from `_EXT_MIME_OVERRIDES` **and** `application/vnd.ms-excel` is absent from
`_UNRELIABLE_MIME_TYPES`. The one-line repair is written out verbatim in `217-07-SUMMARY.md`.

Also measured: `documents.py:559`'s comment claims the mime set *"holds fifteen"*; extraction counts
**fourteen**.

**Not fixed here** because it is outside every plan's `files_modified` and outside the Library's
scope — a backend ingestion-routing defect, not a Library surface one. ⚠ It is a **silent** failure
from the user's point of view (a 201 that becomes a `failed` row later), which makes it worth its own
`/gsd:fast`, not a footnote.

**Re-open trigger:** the next phase touching `backend/app/api/documents.py`'s mime handling — or,
sooner and cheaper, run it as a `/gsd:fast` (≤ 1 file, ≤ 10 lines, no schema or API surface, so G-3
applies). ⭐ It is also the cheapest way to produce the failing ingest that `G4-10` needs.

### 3. Three doc-space suites the gate STILL does not execute

`DocumentStatusBadge.test.tsx`, `FilterBar.test.tsx` and
`ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx` remain in **neither** count-gate knob.
`217-12` declined them on the recorded rule: 217 modifies neither `DocumentStatusBadge.tsx` nor
`FilterBar.tsx`, and adopting a suite makes the adopting phase the owner of its future rot in a gate
that requires 0 failing forever. The decline is written into `scripts/vitest-count-gate.cjs` itself,
never left silent.

⚠ **`DocumentStatusBadge.test.tsx` is the one that matters**, and the seam audit is why: it guards
the render path of `DocumentList.tsx:422`, the pre-existing `ingestion_step` consumer whose **input
changed** when `217-01` made the backend serialize that field.

**Re-open trigger:** Phase 218 owns the document space and is already named — in both
`scripts/vitest-count-gate.cjs` and `docs/HOT-FILE-LEDGER.md` — as the phase that should adopt
`src/components/metadata` at **directory** grain with its own measured number. These three are the
remaining gap at that moment.

### 4. Sixteen G-4 / manual rows, owed by DECISION

Recorded in full in `.planning/phases/217-the-library-one-home-for-documents/217-UAT.md`, one row
each, every one `⛔ OWED` with a named reason. ⭐ **`G4-4` is named as the row to drive FIRST** — it
is the only live catch for the D-217-10 defect, because a component test supplies whatever shape its
author chose and therefore passes before AND after the fix.

**Re-open trigger:** immediate — this is the phase's outstanding acceptance work, not a future idea.
