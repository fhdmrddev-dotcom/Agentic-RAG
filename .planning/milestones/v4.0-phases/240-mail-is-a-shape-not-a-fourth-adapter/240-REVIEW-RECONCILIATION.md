---
type: review-reconciliation
phase: 240-mail-is-a-shape-not-a-fourth-adapter
written: 2026-09-14
author: claude
kind: measurement-not-review
verdict: partial — the BUILD range carries an independent review; the REVIEW-RESPONSE range carries none
---

# 240 — reconciling `independent_review: owed` against what actually exists

**Operator instruction, 2026-09-14:** *"go with 240 reconciliation, hand 238 to gemini."*

⛔ **THIS IS NOT A REVIEW AND MUST NOT BE READ AS ONE.** Claude built Phase 240
(`OV-240-01`: *"AGENTS.md §6.3 is unmet by construction"*), so Claude cannot be its independent
reviewer. What follows is **measurement**: which ranges of this phase carry an independent review,
which do not, and where the boundary falls. Every figure was derived from git, not read from a
record.

---

## 1 · The register understated it — two reviews exist, not zero

`240-VERIFICATION.md` reads `independent_review: owed # nobody who did not shape this build has
looked at it`. **That is not accurate.** Two review files exist:

| File | Scope | Files | Claims independence? |
|---|---|---|---|
| `240-REVIEW-BUILD.md` | `50f66ec39..962dfdfce^` — *"the ORIGINAL BUILD … the four plans plus the two in-phase fix commits"* | **21** | ✅ **YES** — `review_type: independent (OV-240-01 — AGENTS.md §6.3; the author of this range did not write this review)` |
| `240-REVIEW.md` | `962dfdfce^..HEAD (develop)`, dated 2026-09-09 | **9** | ⛔ **NO** — it carries **no `review_type` field at all**. The only `independent` in the file is body prose about a signature change |

⭐ The independent review was not decorative: it returned **2 Critical + 8 Warning + 6 Info**.

⚠ **So `owed` is wrong and `done` would also be wrong.** The honest value is **partial**.

---

## 2 · The coverage gap, measured

Across **every** commit whose subject is tagged `(240`, **48** source files under
`backend/`, `frontend/` and `supabase/` were touched. The two `files_reviewed_list` blocks name
**30** between them. **18 are in neither.**

**Non-test (8):**

```
backend/app/config.py
backend/app/services/sources/base.py          ← the source CONTRACT
backend/app/services/watch_service.py
frontend/src/lib/api.ts
frontend/src/lib/api/documents.ts
frontend/src/types/index.ts
supabase/full-schema.sql                       ← generated artifact, regenerated not authored
```

**Test (10):** `test_240_contract_unchanged.py` · `test_google_drive_adapter.py` ·
`test_source_adapter_conformance.py` · `test_watch_diff_completeness.py` · `test_240_thread_key.py` ·
`test_260909_transient_by_type_not_only_by_words.py` · `test_ingest_enrich_shared.py` ·
`DocumentConversationSection.test.tsx` · `ConnectedSourceSection.test.tsx` ·
`CreateWatchModal.test.tsx` · `watchProductMark.test.ts`

---

## 3 · ⭐ The cause, and it is the classic one: **the fixes that answered the reviews were never reviewed**

Both reviews were written on 2026-09-09/10. **Five commits then landed to close their findings**, and
those commits are outside both scopes:

```
a6897f703  fix(240): close code-review CR-01, CR-02 and WR-01 -- each verified first
6037d9099  fix(240): close the remaining review warnings -- WR-02..WR-08, IN-01/02/04
9e83203a2  fix(240): close review WR-01 and WR-03 -- batch correlation, archiving is not deletion
```

⛔ **`9e83203a2` (2026-09-10) is the one that matters.** It modified:

| File | Change |
|---|---|
| `backend/app/services/sources/base.py` | **+23** — the source contract |
| `backend/app/services/watch_service.py` | **+28 / −1** |

Its own message describes what it fixed: batch sub-responses paired **by position** while the request
wrote a `Content-ID` the parser discarded — *"harmless except at the 429 arm, where a permutation
discards a successful 200 and that message lands `(no subject).eml` with an empty `source_version`,
which `watch_service` can never re-read — mail is immutable, so nothing ever corrects it"*; and
Gmail's Archive removing the `INBOX` label made archived mail look **exactly like deleted mail** and
get marked `missing_at_source`.

**Those are consequential fixes to a trust-boundary phase, touching the contract file, and no review
— independent or otherwise — has looked at them.**

---

## 4 · ⚠ What I checked and did NOT find, recorded so nobody re-raises it

**The phase's `base.py` md5 claim is NOT refuted.** `240-VERIFICATION.md` asserts
*"`md5sum base.py` … `3b3d8770a6c9309f0635503d155dd8f7` both times · `git diff --numstat` prints
nothing"*. Measured:

| Point | md5 |
|---|---|
| claimed | `3b3d8770a6c9309f0635503d155dd8f7` |
| at `9e83203a2^` | `e934bf597b479c55f2edc124a8634ded` |
| at `9e83203a2` | `76d7fd86db88442aaa462d274bb2d01b` |
| at HEAD | `46f555296cd15fa3dd1d4095de8cb9cc` |

⭐ **The claim was scoped to the PLAN that made it and was true there.** The file has legitimately
moved since — through this phase's own later commits and through Phase 239's. **A claim is false only
within its own scope**, and this one is not. ⛔ Recorded because the mismatch *looks* like a refutation
at a glance, and publishing it as one would be precisely the error this project has paid for
repeatedly — a mechanism-shaped finding that a second command dissolves.

⚠ What IS fair to say: `9e83203a2`'s change to `base.py` is **data on the contract**
(`deletions_detectable`), which its own message calls out as *"never a provider branch"* — i.e. the
phase's shape thesis was **honoured**, not broken, by the fix. That reading is the builder's, and it
is exactly the kind of judgement an independent reviewer should test rather than inherit.

---

## 5 · Verdict and what it changes

**`independent_review: partial`**, with the boundary written down:

- ✅ **Covered independently:** the original build, `50f66ec39..962dfdfce^`, 21 files.
- ⛔ **NOT covered by any independent review:** the review-response commits — most importantly
  `9e83203a2`'s `base.py` (+23) and `watch_service.py` (+28/−1) — plus the 18-file gap in §2.
- ⛔ **`240-REVIEW.md` must not be counted as independent.** It carries no `review_type` field, and a
  reviewer's label is the only thing that distinguishes a review from a second opinion by the author.

**What this does NOT do:** it does not discharge `DEBT-06` for 240, and it does not review anything.
It converts *"nobody has looked at it"* — which was false — into a named, bounded gap somebody can
act on.

**Recommended next step (operator's call):** hand the review-response range
(`962dfdfce..HEAD` restricted to `(240` commits) to Gemini alongside 238. It is small — three commits
and two non-test files that matter — and it is the half of a trust-boundary phase that nobody has read.
