---
phase: 076-confidence-recalibration
reviewed: 2026-05-25T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/calibrate_confidence.py
  - backend/app/api/threads.py
  - backend/app/api/knowledge_health.py
  - backend/tests/unit/test_citations_confidence.py
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 076: Code Review Report

**Reviewed:** 2026-05-25T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 076 recalibrated confidence thresholds from 0.55/0.40 to 0.54/0.38 based on calibration evidence (N=121 queries). The three production files (`threads.py`, `knowledge_health.py`, `test_citations_confidence.py`) are internally consistent -- all agree on the 0.54/0.38 values. SQL injection checks pass: all psycopg2 queries in the calibration script use parameterized `%s` placeholders. No credential leakage in stdout or JSON output. Two warnings and three informational items were found.

## Warnings

### WR-01: Calibration script CURRENT_*_THRESHOLD constants are stale after Phase 076 update

**File:** `scripts/calibrate_confidence.py:25-26`
**Issue:** The script defines `CURRENT_HIGH_THRESHOLD = 0.55` and `CURRENT_MEDIUM_THRESHOLD = 0.40`, which were the pre-Phase 076 values. These constants drive both the bucket analysis (lines 336-339) and the human-readable report (lines 450-490). After Phase 076 updated production thresholds to 0.54/0.38, re-running the script (as PROJECT.md's "Re-run" instruction suggests) will produce misleading output: the report will label bucket proportions against the old thresholds, print "Current thresholds: high >= 0.55, medium >= 0.40", and the JSON output's `current_thresholds` field will record stale values. The `recommended_action` (VALIDATED vs ADJUST) will also evaluate against wrong baselines.
**Fix:**
```python
# lines 25-26: update to match production values
CURRENT_HIGH_THRESHOLD = 0.54
CURRENT_MEDIUM_THRESHOLD = 0.38
```
Also update line 357 which hardcodes the old thresholds in a string literal:
```python
# line 357: change from
"Bucket proportions at current thresholds (0.55/0.40) are within "
# to
"Bucket proportions at current thresholds (0.54/0.38) are within "
```

### WR-02: SYSTEM_PROMPT hedging threshold inconsistent with new low-confidence boundary

**File:** `backend/app/api/threads.py:448`
**Issue:** The SYSTEM_PROMPT instructs the LLM: "If ALL returned chunks have similarity below 0.4, the answer is likely not in the documents." But `_compute_confidence` now classifies scores in [0.38, 0.40) as "medium" confidence (not "low"). This creates a gap: the code says "medium confidence, no disclaimer" but the LLM prompt says "likely not in the documents." The mismatch is small (0.02 spread) and the prompt is advisory guidance rather than a hard programmatic check, but it may cause the LLM to hedge on answers the system otherwise considers medium-confidence.
**Fix:**
```python
# line 448: change "0.4" to "0.38" to match the new low threshold
"similarity below 0.38, the answer is likely not in the documents — say so explicitly: "
```
Alternatively, keep 0.4 as a deliberate "round number for the LLM" and add a comment documenting the intentional gap. Either way, the mismatch should be an explicit decision rather than an accidental drift.

## Info

### IN-01: Duplicate user_id auto-detection query in calibration script

**File:** `scripts/calibrate_confidence.py:573-588`
**Issue:** The `_fetch_audit_queries()` function (lines 171-187) already auto-detects the user with the most `search.query` entries when `user_id` is None. The `main()` function then runs the identical query again (lines 573-588) to determine `calibration_user_id`. This is redundant -- the same DB query executes twice.
**Fix:** Have `_fetch_audit_queries()` return the detected `user_id` alongside the query list (e.g., return a tuple `(queries, detected_user_id)`), and use that in `main()` instead of re-querying.

### IN-02: Unused test constants `medium_upper` and `low` in CONFIDENCE_THRESHOLDS

**File:** `backend/tests/unit/test_citations_confidence.py:21,23`
**Issue:** The `CONFIDENCE_THRESHOLDS` dict defines `"medium_upper": 0.53` and `"low": 0.37` but neither is referenced in any test assertion. They serve as implicit documentation of the just-below-boundary values but are not tested. Adding boundary tests that exercise these values (e.g., `assert _compute_confidence(0.53) == "medium"` and `assert _compute_confidence(0.37) == "low"`) would strengthen the test suite.
**Fix:** Add two explicit boundary tests:
```python
def test_just_below_high_is_medium(self):
    """0.53 (just below 0.54) maps to 'medium'."""
    assert _compute_confidence(CONFIDENCE_THRESHOLDS["medium_upper"]) == "medium"

def test_just_below_medium_is_low(self):
    """0.37 (just below 0.38) maps to 'low'."""
    assert _compute_confidence(CONFIDENCE_THRESHOLDS["low"]) == "low"
```

### IN-03: New OpenAI client instantiated per embedding call in calibration script

**File:** `scripts/calibrate_confidence.py:153`
**Issue:** `_get_embedding()` creates a new `OpenAI(api_key=...)` client on every call. The calibration run processes ~121 queries, resulting in 121 client instantiations. Each instantiation creates a new httpx session. This is not a correctness issue but adds unnecessary overhead for a script that may take minutes to run.
**Fix:** Move client creation to module level or pass it as a parameter:
```python
# In main(), before the calibration loop:
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
embedding_fn = lambda text: client.embeddings.create(
    model=EMBEDDING_MODEL, input=[text]
).data[0].embedding
```

---

_Reviewed: 2026-05-25T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
