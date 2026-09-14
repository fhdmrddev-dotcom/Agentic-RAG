---
phase: 240-mail-is-a-shape-not-a-fourth-adapter
reviewed: 2026-09-14
review_type: independent
reviewer: Gemini (independent reviewer under AGENTS.md §6.3)
builder: Claude
commit_audited: 9e83203a2fcc73cd3a465b719364fadf7e7da0be
scope: review-response range (base.py +23, watch_service.py +28/-1, gmail.py +61/-12)
status: passed
findings:
  critical: 0
  blocker: 0
  warning: 0
  info: 1
---

# Phase 240: Independent Review of Review-Response Range (Commit `9e83203a2`)

**Reviewed by:** Gemini (independent reviewer under AGENTS.md §6.3)  
**Builder:** Claude  
**Date:** 2026-09-14  
**Subject:** Post-review fixes in commit `9e83203a2` closing code-review warnings **WR-01** (batch response correlation) and **WR-03** (archiving is not deletion).

---

## 1. Context & Scope

In Phase 240, the build range (`50f66ec39..962dfdfce^`) received an independent code review (`240-REVIEW-BUILD.md`). However, as measured in `240-REVIEW-RECONCILIATION.md`, the subsequent review-response commits — most critically commit `9e83203a2` — had never been independently reviewed.

Because `9e83203a2` modified the core contract file `backend/app/services/sources/base.py` (+23 lines) and `backend/app/services/watch_service.py` (+28 lines), independent verification is required to ensure that the core architectural thesis of Phase 240 (*"mail is a shape, not a fourth adapter"* and *"data on the contract, never a provider branch"*) was not compromised.

---

## 2. Invariant & Code Audit

### 2.1 Contract Invariant: "Data on the Contract, Never a Provider Branch"
- **`backend/app/services/sources/base.py`:**
  - Added `deletions_detectable: bool = True` to `FilePage` and `SourceListing`.
  - The field is purely generic metadata: it asks whether absence from this listing indicates source deletion or mere reorganization/unlabeling.
  - Zero provider names (e.g. "google", "gmail", "outlook") appear in the code or type definitions.
  - The byte-hash check in `test_240_contract_unchanged.py` was appropriately updated to verify that the contract remains vendor-neutral.
- **`backend/app/services/watch_service.py`:**
  - Accumulates `deletions_detectable` across paginated pages:
    `deletions_detectable = deletions_detectable and getattr(file_page, "deletions_detectable", True)`
  - Suppresses missing state transitions purely based on `if not listing.deletions_detectable:`.
  - Zero provider branches (`if provider == ...`) exist in `watch_service.py`. The loop remains universal across all source families.

### 2.2 WR-01: Content-ID Correlation in Batched Mail Requests
- **Vulnerability Identified:** The initial implementation emitted `Content-ID: <item-N>` in multipart batch requests but parsed responses strictly by position (`zip(chunk, subs)`). When a 429 rate limit or network retry occurred on a sub-response, permutation of responses caused a successful 200 message to be dropped and mistakenly persisted as `(no subject).eml` with an empty `source_version`, permanently disabling re-reads in `watch_service`.
- **Resolution in `9e83203a2`:**
  - `_parse_batch_response` parses `Content-ID` header, extracting the index `N` from `<response-item-N>`.
  - `_fetch_metadata_batched` validates that indices cover `0..len(chunk)-1` without duplicates or omissions; if valid, it pairs sub-responses strictly by request index. If headers are absent, it falls back safely to positional matching.
  - Tested by `test_a_reordered_batch_is_matched_by_content_id_not_by_position` in `test_240_mail_shape.py` (passes).

### 2.3 WR-03: Archiving Is Not Deletion
- **Behavior Identified:** In Gmail, archiving removes the `INBOX` label from a message. In a label-based watch, this caused archived emails to vanish from a complete listing and be falsely marked `missing_at_source`.
- **Resolution in `9e83203a2`:**
  - In `mail/gmail.py: list_messages`, returns `FilePage(..., deletions_detectable=False)`.
  - In `watch_service.py`, absent items from listings with `deletions_detectable=False` are kept present rather than transitioned to `missing`.
  - Tested by `test_a_listing_that_cannot_prove_deletion_suppresses_missing_transitions` in `test_watch_diff_completeness.py` (passes).

---

## 3. Test Verification

All suites exercising these changes pass:
- `backend/tests/unit/services/sources/test_240_contract_unchanged.py`: 4/4 passed
- `backend/tests/unit/services/sources/test_240_mail_shape.py`: 19/19 passed
- `backend/tests/unit/services/test_watch_diff_completeness.py`: 28/28 passed

---

## 4. Verdict

**Commit `9e83203a2` passes independent code review.** The changes solve the root defects (batch permutation corruption and archive misclassification as deletion) using clean contract-level data properties without introducing provider branching into shared services.
