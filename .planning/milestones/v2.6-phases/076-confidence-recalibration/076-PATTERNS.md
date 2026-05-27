# Phase 076: Confidence Recalibration - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 4 (1 new, 3 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/calibrate_confidence.py` | utility (CLI diagnostic) | batch / request-response | `scripts/observe-run.py` | exact |
| `backend/app/api/threads.py` (lines 530–542) | utility function | transform | `backend/app/api/threads.py` (same file, same function — update-in-place) | exact |
| `backend/app/api/knowledge_health.py` (lines 13–14) | config constant | N/A | `backend/app/api/threads.py:530–542` | exact (same constant pattern) |
| `backend/tests/unit/test_citations_confidence.py` | test | N/A | same file — update-in-place | exact |

---

## Pattern Assignments

### `scripts/calibrate_confidence.py` (new CLI utility, batch)

**Analog:** `scripts/observe-run.py`

**Imports / module header pattern** (observe-run.py lines 1–26):
```python
"""
calibrate_confidence.py — Phase 076 reusable confidence threshold calibration.

Connects to Supabase, runs synthetic + audit_log queries through the retrieval
path, collects avg_similarity values, prints histogram + recommended thresholds,
and writes a JSON output file.

Usage:
  cd backend
  ./venv/Scripts/python.exe ../scripts/calibrate_confidence.py [--user-id UUID] [--output results.json]
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
```

**Env-loading pattern** (observe-run.py lines 36–48):
```python
def _load_env():
    """Load backend/.env so we get SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("ERROR: python-dotenv not installed in this Python. "
              "Run via the backend venv: backend/venv/Scripts/python.exe")
        sys.exit(1)
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if not env_path.exists():
        print(f"ERROR: backend/.env not found at {env_path}")
        sys.exit(1)
    load_dotenv(env_path)
```

**psycopg2 connection pattern** (observe-run.py lines 146–153):
```python
import psycopg2
from psycopg2.extras import RealDictCursor

db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
if not db_url:
    db_url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

conn = psycopg2.connect(db_url)
with conn.cursor(cursor_factory=RealDictCursor) as cur:
    cur.execute("SELECT ...", (param,))
    rows = cur.fetchall()
conn.close()
```

**Parameterized SQL pattern** (observe-run.py lines 154–172 — never string-format user data):
```python
cur.execute(
    "SELECT run_id, thread_id, status FROM runs WHERE run_id = %s",
    (run_id,),
)
```

**Structured Markdown stdout pattern** (observe-run.py lines 288–305):
```python
def main():
    _load_env()
    print(f"# Confidence calibration report\n")
    print(_section_one(...))
    print(_section_two(...))

if __name__ == "__main__":
    main()
```

**Graceful import-error handling** (observe-run.py lines 56–57, langsmith_recent_failures.py lines 19–29):
```python
try:
    import psycopg2
except ImportError:
    print("_skipped: psycopg2 not installed_\n")
    return "..."
```

**env-path resolution pattern** (langsmith_recent_failures.py lines 25–29 — top-level, no function wrapper):
```python
ENV_PATH = Path(__file__).resolve().parent.parent / "backend" / ".env"
if not ENV_PATH.is_file():
    print(f"ERROR: .env not found at {ENV_PATH}", file=sys.stderr)
    sys.exit(1)
load_dotenv(ENV_PATH)
```

**Core retrieval loop to mirror** — derived from `retrieval_service.py:159–162` and `retrieval_service.py:283`:
```python
# Production _avg_cosine — calibration must replicate this exact computation
def _avg_cosine(rows: list[dict]) -> float:
    sims = [row["similarity"] for row in rows if row.get("similarity") and row["similarity"] > 0]
    return sum(sims) / len(sims) if sims else 0.0
```

**Similarity query via direct pgvector SQL** (from RESEARCH.md Code Examples, must match production):
```python
cur.execute("""
    SELECT 1 - (dc.embedding <=> %s::vector) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.user_id = %s
      AND 1 - (dc.embedding <=> %s::vector) > %s
      AND d.is_latest = true
    ORDER BY dc.embedding <=> %s::vector
    LIMIT %s
""", (str(embedding), user_id, str(embedding), match_threshold, str(embedding), top_k))
```

**audit_log query replay** — metadata schema confirmed at `threads.py:2566`:
```python
# audit_log stores: {"query_text": str, "document_ids": list[str]}
# Re-run each query through embedding+RPC pipeline to get fresh similarity scores
cur.execute("""
    SELECT metadata->>'query_text' AS query_text
    FROM audit_log
    WHERE action_type = 'search.query'
      AND user_id = %s
      AND metadata->>'query_text' IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 100
""", (user_id,))
```

**JSON output pattern** (observe-run.py lines 83–96):
```python
import json
# Write structured results to file
with open(output_path, "w") as f:
    json.dump(result_dict, f, indent=2)
```

**Validate-or-adjust decision logic** (RESEARCH.md Pattern 3):
```python
# D-04: ~30%/45%/25% is the target distribution
high_pct = sum(1 for s in scores if s >= current_high) / len(scores)
medium_pct = sum(1 for s in scores if current_medium <= s < current_high) / len(scores)
low_pct = sum(1 for s in scores if s < current_medium) / len(scores)

if abs(high_pct - 0.30) < 0.15 and abs(medium_pct - 0.45) < 0.15:
    verdict = "VALIDATED — no change needed"
else:
    new_high = np.percentile(scores, 70)
    new_medium = np.percentile(scores, 25)
    verdict = f"ADJUST: high >= {new_high:.3f}, medium >= {new_medium:.3f}"
```

**pdf_extraction_runs telemetry check** (RESEARCH.md Code Examples):
```python
cur.execute("""
    SELECT engine, COUNT(*) as count
    FROM pdf_extraction_runs
    WHERE completed_at > NOW() - INTERVAL '30 days'
    GROUP BY engine
    ORDER BY count DESC
""")
```

---

### `backend/app/api/threads.py` — `_compute_confidence` (lines 530–542)

**Analog:** Same function — update-in-place.

**Current function to preserve shape of** (threads.py lines 530–542):
```python
def _compute_confidence(avg_similarity: float) -> str:
    """Map average cosine similarity to confidence level (D-10).

    Thresholds are calibrated for text-embedding-3-small, where typical
    top-5 average scores are 0.50–0.70 for prose and 0.35–0.55 for
    structured/tabular content. The previous 0.7/0.5 thresholds caused
    almost all correct answers to show as "low" confidence.
    """
    if avg_similarity >= 0.55:
        return "high"
    elif avg_similarity >= 0.40:
        return "medium"
    return "low"
```

**Call site context** (threads.py lines 3485–3490 — do not change signature):
```python
if similarity_scores:
    final_avg = sum(similarity_scores) / len(similarity_scores)
    level = _compute_confidence(final_avg)
    disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
    _confidence_slot[:] = [{"level": level, "avg_similarity": round(final_avg, 4), "disclaimer": disclaimer}]
    await _emit(redis, run_id, 'confidence', level=level, avg_similarity=round(final_avg, 4), disclaimer=disclaimer)
```

**Rules for update:**
- Keep function signature `_compute_confidence(avg_similarity: float) -> str` unchanged — call site at line 3487 cannot change.
- Update only the numeric constants `0.55` and `0.40` if calibration script output recommends a change.
- Update the docstring to record the Phase 076 recalibration date, sample size, distribution summary, and reasoning (same pattern as Phase 32.5 comment preserved in the current docstring).
- If thresholds do NOT change, update only the docstring to record "validated: post-071.3 distribution matches Phase 32.5 baseline — no change needed."

---

### `backend/app/api/knowledge_health.py` — threshold constants (lines 13–14)

**Analog:** `backend/app/api/threads.py:538–541` (same constant pattern).

**Current constants to check** (knowledge_health.py lines 12–15):
```python
TOP_N = 10
LOW_CONF_THRESHOLD = 0.40   # D-02: avg similarity below this = low-confidence
HIGH_CONF_THRESHOLD = 0.50  # similarity at or above this = "matched well"
WINDOW_DAYS = 30             # D-07: most-retrieved and low-confidence window
```

**D-07 rule:** Only align these constants if `_compute_confidence` thresholds actually change in Plan 02. If thresholds stay at 0.55/0.40, leave `knowledge_health.py` untouched — Phase 081.1 will sweep it. If thresholds change, update `HIGH_CONF_THRESHOLD` to match the new `_compute_confidence` high boundary, and update the comment to note Phase 076 alignment.

Note: `LOW_CONF_THRESHOLD = 0.40` already matches `_compute_confidence`'s medium boundary — only `HIGH_CONF_THRESHOLD = 0.50` is the inconsistency (vs `_compute_confidence`'s `0.55`).

---

### `backend/tests/unit/test_citations_confidence.py`

**Analog:** Same file — update-in-place.

**Current threshold dict to mirror** (test_citations_confidence.py lines 19–24):
```python
CONFIDENCE_THRESHOLDS = {
    "high": 0.55,
    "medium_upper": 0.54,
    "medium_lower": 0.40,
    "low": 0.39,
}
```

**Test boundary pattern** (test_citations_confidence.py lines 52–74):
```python
def test_high_confidence_boundary(self):
    """Boundary value 0.7 maps to 'high' (inclusive)."""
    assert _compute_confidence(0.7) == "high"

def test_medium_confidence_boundary(self):
    """Boundary value 0.5 maps to 'medium' (inclusive)."""
    assert _compute_confidence(0.5) == "medium"
```

**Rules for update:**
- If thresholds change, update `CONFIDENCE_THRESHOLDS` dict values AND all boundary test assertions to use the new values.
- If thresholds stay at 0.55/0.40, the only change is fixing stale docstring comments in the test (e.g., `test_high_confidence_boundary` says `0.7` but tests `_compute_confidence(0.7)` which already returns "high" under 0.55 — the assertions pass but the docstrings are stale; update docstrings to match current reality).
- Never change the import line `from app.api.threads import _compute_confidence, _deduplicate_citations` — function names are stable.

---

## Shared Patterns

### env-loading (all scripts)
**Source:** `scripts/observe-run.py` lines 36–48
**Apply to:** `scripts/calibrate_confidence.py`
```python
env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(env_path)
```
Never use `os.environ` directly without `load_dotenv` first — `.env` may have vars not yet in shell environment.

### Parameterized SQL
**Source:** `scripts/observe-run.py` lines 154–172
**Apply to:** `scripts/calibrate_confidence.py` (all psycopg2 queries)
Always use `%s` placeholders. Never f-string or `.format()` SQL strings.

### Secrets never in stdout
**Source:** `scripts/langsmith_recent_failures.py` lines 32–33
**Apply to:** `scripts/calibrate_confidence.py`
```python
# Only read key names from env — never print their values
api_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # used for connection only
```
The script's stdout and JSON output must never contain `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or any other credential.

### Docstring calibration rationale
**Source:** `backend/app/api/threads.py` lines 530–537 (the existing Phase 32.5 docstring)
**Apply to:** Updated `_compute_confidence` docstring after calibration
Preserve the "why these numbers" narrative pattern. Add Phase 076 calibration date, sample size (N=), distribution summary (median, quartiles), and the validate-or-adjust verdict inline in the docstring.

---

## No Analog Found

All files have close analogs. No entries.

---

## Metadata

**Analog search scope:** `scripts/`, `backend/app/api/`, `backend/tests/unit/`, `backend/app/services/`
**Files read:** observe-run.py, langsmith_recent_failures.py, threads.py (530–542, 2525–2568, 3480–3498), retrieval_service.py (154–163, 237–305), knowledge_health.py (1–40), test_citations_confidence.py (full)
**Pattern extraction date:** 2026-05-24
