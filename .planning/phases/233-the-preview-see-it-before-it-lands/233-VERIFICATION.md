# Phase 233 — The Preview: See It Before It Lands · VERIFICATION

**Date:** 2026-09-05 · **Built and verified by:** Claude (Gemini out for this phase, by operator direction).
⚠ **The reviewer built it.** `AGENTS.md 6.3` normally forbids that; the operator explicitly assigned
this phase to one agent, so it is recorded as a **known weakening of the review**, not as a pass that
satisfies the rule. What is offered instead of an independent reviewer is that **every honesty claim
below was driven against a planted defect**, and both source files were restored **md5-identical**.

---

## Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| **#1** four honest lists before anything is imported | ✅ **PASS** | `SourcePreviewPanel.test.tsx` — four `<section data-bucket>`s in order, four verbatim labels, four legend items. ⭐ Driven RED: dropping the fourth bucket fires **4** assertions. |
| **#2** close without confirming, Library exactly as it was | ✅ **PASS** | `test_preview_service.py::test_preview_writes_nothing` uses a Supabase double whose **every write verb raises**, so SC#2 is structural rather than inspected. Frontend: the read door is called, the write door is not; Cancel prints the four zeros. |
| **#3** where each file would land, before any row exists | ✅ **PASS** | Every `add` item carries a `destination`; a rule-suggested one is marked. Rules are evaluated as a **READ** — `build_suggestion` resolves a folder NAME, nothing is minted. |
| **#4** the files that arrive are the files the preview named | ✅ **PASS** | `confirm_preview` **re-runs `build_preview`** — one classifier, two invocations. `test_the_preview_and_the_confirm_do_not_disagree` asserts `actually_added == preview_said_added`. The reconciliation line is the on-screen receipt. |
| **#5** never imported twice, never silently in neither | ✅ **PASS** | `outcome` is `Literal["added","here","refused"]` on both sides of the wire — a fourth value is a `ValidationError`, not a surprise. `unaccounted == 0` asserted. A duplicate mint deliberately does **not** schedule `splice_document`, so it is not embedded again. ⭐ Driven RED: stripping a refusal's cause fires. |

---

## The honesty fences, and the defects planted against them

| Planted defect | Fires | Restored |
|---|---|---|
| the `here` reason claims a content hash (backend) | ✅ 1 | md5-identical |
| the fourth bucket is dropped from the surface | ✅ 4 | md5-identical |
| collapsing a section hides its **count** as well as its files | ✅ 1 | md5-identical |
| a refusal becomes a colour instead of a name | ✅ 1 | md5-identical |
| the `Already here` qualifier is rewritten to *"matched by content hash"* | ✅ 4 | md5-identical |

⚠ **The frontend hash guard is REGION-SCOPED and asserts its region was found.** The equivalent guard
in sketch 229 was **proven broken before it was trusted** — its first version searched the whole
document, so the overclaim survived elsewhere and the sub-region regex silently matched nothing. That
trap is avoided here deliberately, not by luck.

---

## Gates

### Frontend count gate — **OK**, and it repaired an inherited red

```
  total 7498  ·  failed 0  ·  pinned total 6771
count gate OK — 224/224 pinned files present, no per-file decrease, 0 failing.
```

**Baseline captured BEFORE any work in this phase, on the merge base:**
`total 7463 · failed 2 · pinned total 6731`.

⚠ **The two baseline failures were INHERITED and are named rather than absorbed.** Both were in
`src/components/ingestion/__tests__/IngestionStrip.test.tsx`, whose ORDERED fence extracts the
`ingestion_step` writes from `documents.py`'s live source. `7cca8f50a` (**`229-03`**, the email
attachment splice cascade) added `"ingestion_step": "failed"` to that file — a **terminal marker**,
not a pipeline stage — and the fence counted it, so the "exactly six" control went red.

**The fence was doing its job; what it caught was a real drift.** Repaired here with a NAMED
exclusion (`TERMINAL_MARKERS`) plus a **positive control asserting the marker really is written**,
exactly mirroring how the legitimate `None` reset is already handled. Its pin was also **under-set at
25 against 30 actual**, so it was re-pinned to **31**.

### Backend unit gate — **NO REGRESSION**, and the CLAUDE.md ceiling is already exceeded

| | failed | passed |
|---|---|---|
| merge base (this phase's source stashed, its tests removed) | **72** | 3567 |
| with Phase 233 | **72** | **3601** (+34) |

⚠ **`CLAUDE.md` locks the ceiling at 71 with zero headroom, and the tree measured 72 BEFORE this
phase started.** That is a pre-existing condition, measured rather than asserted — the two runs above
differ only by this phase's `+34` passing cases. **Phase 233 adds no failure.** The stale ceiling is
recorded for whoever owns it; it is not this phase's to move.

---

## What was NOT done, stated as a decision

⛔ **No live cross-provider / lived-experience UAT (G-4) was run.** It needs a running backend, a real
Google Drive connection with real files, and a person at the screen. Every criterion above is proved
at the unit grain and at the wire grain; **none of them has been watched happening.** The owed rows:

1. Point at a real Drive folder → four buckets, counts sum, the hatched segment reads as uncertainty.
2. Close without confirming → check `documents`, `document_chunks`, `folders`, `ingestion_jobs` are unchanged.
3. Confirm → the counts match, the bar dissolves, a refusal names its cause.
4. Confirm the same folder twice → nothing is imported again and nothing is embedded again.
5. A native Google Doc that IS already in the Library → previews as *can't tell*, resolves to *already here*.

**Run row 2 first** — it is the one criterion whose failure is invisible from the screen.
