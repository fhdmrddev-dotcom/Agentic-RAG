# Phase 076: Confidence Recalibration - Research

**Researched:** 2026-05-24
**Domain:** Statistical calibration of cosine similarity thresholds for RAG confidence scoring
**Confidence:** HIGH

## Summary

Phase 076 re-derives the `_compute_confidence` threshold constants at `backend/app/api/threads.py:530-542` against the post-071.3 default-set chunk score distribution. The post-071.3 extraction stack (camelot tables + pymupdf_full images + legacy text + `none` equations) produces a structurally different chunk population than the Phase 32.5 era (pdfplumber + pypdf). The calibration script queries the live Supabase instance, replays audit_log queries + synthetic queries through the existing embedding/retrieval path, collects `avg_similarity` values, and determines whether the current 0.55/0.40 thresholds still produce meaningful bucket proportions (high/medium/low).

The deliverables are: (1) a reusable `scripts/calibrate_confidence.py` that anyone can re-run, (2) updated threshold constants if the distribution has materially shifted, (3) a PROJECT.md appendix entry documenting the calibration date/result, and (4) a verification that `pdf_extraction_runs.engine` column is populated for recent extractions (ensuring per-extractor lineage is observable).

**Primary recommendation:** Build the calibration script first (Plan 01), then apply findings + update constants + document (Plan 02). The script is the durable artifact; the threshold update is a mechanical consequence of its output.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Use real user-uploaded corpus (already extracted under post-071.3 defaults) -- no re-extraction needed
- D-02: Query set = all audit_log search.query entries + ~20 synthetic calibration queries (prose, table-referencing, image-referencing, out-of-domain)
- D-03: Calibration measures avg_similarity per query (same value _avg_cosine() returns)
- D-04: Validate-or-adjust approach -- measure distribution first, keep 0.55/0.40 if bucket proportions are sensible (~30%/45%/25%), adjust if shifted
- D-05: Target is intent-level preservation from Phase 32.5 (high=clearly matched, medium=reasonable, low=weak/out-of-domain)
- D-06: SEED-022 (camelot precision) deferred -- tables don't enter document_chunks
- D-07: knowledge_health.py threshold alignment is Claude's discretion -- align if thresholds move, leave if unchanged
- D-08: Commit reusable scripts/calibrate_confidence.py (connects to Supabase, runs queries, prints histogram + recommended thresholds, writes JSON)
- D-09: Script runs against live local Supabase (reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from backend/.env)
- D-10: Thresholds stay as Python constants at _compute_confidence (no promotion to app_settings)

### Claude's Discretion
- Plan split (2 plans) -- dependency shape determines cut
- pdf_extraction_runs telemetry verification method -- basic SQL assertion sufficient
- test_citations_confidence.py -- update threshold assertions if values change; generalize if they don't
- PROJECT.md appendix formatting -- text tables + quartiles preferred over committed images

### Deferred Ideas (OUT OF SCOPE)
- SEED-022 deeper precision audit (camelot false-positive tables)
- SEED-027 tables-to-chunks ingestion
- Promote thresholds to app_settings (Phase 081.1 scope)
- Embedding model evaluation (SEED-020)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RAG-RECAL-01 | Confidence thresholds recalibrated after Docling lands -- Q-v2.6-03 chosen path executed and the resulting score distributions documented in PROJECT.md | Calibration script + threshold derivation + PROJECT.md appendix + pdf_extraction_runs telemetry verification |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Similarity score computation | Database (pgvector RPC) | -- | `match_document_chunks` computes `1 - (embedding <=> query_embedding)` server-side |
| Query embedding | API / Backend | -- | `embed_texts()` calls OpenAI API synchronously |
| Confidence level derivation | API / Backend | -- | Pure Python function `_compute_confidence()` in threads.py |
| Threshold constant storage | API / Backend | -- | Python constants in source code (D-10) |
| Calibration execution | CLI Script | Database | Standalone script reads Supabase directly via psycopg2 / supabase-py |
| Telemetry observability | Database | -- | `pdf_extraction_runs.engine` column already populated by extraction_service.py |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| psycopg2 | 2.9.x (already installed) | Direct Postgres queries in calibration script | Same pattern as observe-run.py; avoids supabase-py async complexity in standalone script |
| python-dotenv | 1.x (already installed) | Load backend/.env for credentials | Project convention per observe-run.py pattern |
| numpy | 1.x (already in venv) | Percentile/histogram calculations for distribution analysis | Standard for statistical work; avoid hand-rolling percentile math |
| openai | 1.x (already installed) | `embed_texts` equivalent for synthetic queries | Required for embedding generation; reuse existing openai_service pattern |

[VERIFIED: project codebase] -- all packages already in backend/requirements.txt or backend venv; no new dependencies needed.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json (stdlib) | -- | Write calibration results to output JSON file | Always -- D-08 mandates JSON output |
| statistics (stdlib) | -- | Basic stats (median, mean, stdev) if numpy unavailable | Fallback only -- numpy preferred |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| psycopg2 direct | supabase-py client | supabase-py adds async complexity unnecessary for a one-shot script; psycopg2 is simpler and already used by observe-run.py |
| numpy for stats | scipy.stats | overkill -- we only need percentiles/histogram, not full statistical tests |
| Standalone script | pytest-based test | Script is the right form factor -- it's a diagnostic/operational tool, not a test |

**Installation:**
```bash
# No new packages needed -- all dependencies already in backend venv
```

## Architecture Patterns

### System Architecture Diagram

```
                    scripts/calibrate_confidence.py
                              |
                   +----------+----------+
                   |                     |
           [Load backend/.env]    [Parse CLI args]
                   |                     |
                   v                     v
    +-------------------------------+  +------------------+
    | Supabase Postgres (psycopg2)  |  | OpenAI API       |
    |  - audit_log (query replay)   |  | (embed_texts)    |
    |  - document_chunks (count)    |  +------------------+
    |  - pdf_extraction_runs        |           |
    +-------------------------------+           |
                   |                            |
                   v                            v
    +-------------------------------+  +------------------+
    | Query Replay Engine           |  | Synthetic Query  |
    | - Fetch audit_log queries     |  | Generator        |
    | - Re-embed each query         |  | (~20 queries)    |
    +-------------------------------+  +------------------+
                   |                            |
                   +----------+---------+------+
                              |
                              v
              +-------------------------------+
              | match_document_chunks RPC     |
              | (returns similarity scores)   |
              +-------------------------------+
                              |
                              v
              +-------------------------------+
              | Distribution Analysis         |
              | - Percentiles (P10..P90)      |
              | - Histogram bins              |
              | - Bucket proportions at       |
              |   current 0.55/0.40 thresholds|
              | - Recommended thresholds      |
              +-------------------------------+
                              |
                   +----------+----------+
                   |                     |
                   v                     v
    +------------------+   +---------------------------+
    | stdout: human-   |   | JSON output file          |
    | readable report  |   | (date, sample_size,       |
    | with histogram   |   |  thresholds, quartiles,   |
    +------------------+   |  bucket_proportions)      |
                           +---------------------------+
```

### Recommended Project Structure
```
scripts/
  calibrate_confidence.py    # NEW: reusable calibration script (D-08)

backend/app/api/
  threads.py                 # MODIFIED: _compute_confidence thresholds (if needed)
  knowledge_health.py        # MODIFIED: align thresholds (if D-07 fires)

backend/tests/unit/
  test_citations_confidence.py  # MODIFIED: update threshold assertions (if changed)
```

### Pattern 1: Standalone Script with backend/.env Loading
**What:** Scripts that need Supabase/OpenAI access load credentials from `backend/.env` using `python-dotenv`, connect via `psycopg2` for Postgres or standard SDK clients for APIs.
**When to use:** Operational/diagnostic tools that run outside the FastAPI app context.
**Example:**
```python
# Source: scripts/observe-run.py (existing project pattern)
from pathlib import Path
from dotenv import load_dotenv

def _load_env():
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if not env_path.exists():
        print(f"ERROR: backend/.env not found at {env_path}")
        sys.exit(1)
    load_dotenv(env_path)
```

### Pattern 2: RPC-based Similarity Scoring
**What:** The calibration script calls `match_document_chunks` RPC (same path as production) to get similarity scores, ensuring the calibration measures the exact same metric the runtime uses.
**When to use:** When the calibration must mirror production behavior exactly.
**Example:**
```python
# Source: backend/app/services/retrieval_service.py:47 + supabase/full-schema.sql:120-135
# Production path: embed query -> call match_document_chunks RPC -> avg similarity
# Calibration equivalent via psycopg2:
cur.execute("""
    SELECT 1 - (dc.embedding <=> %s::vector) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.user_id = %s
      AND 1 - (dc.embedding <=> %s::vector) > %s
      AND d.is_latest = true
    ORDER BY dc.embedding <=> %s::vector
    LIMIT %s
""", (embedding, user_id, embedding, match_threshold, embedding, top_k))
```

### Pattern 3: Validate-or-Adjust Decision Logic
**What:** Measure distribution first, compare bucket proportions at current thresholds, decide whether to adjust.
**When to use:** D-04 mandates this approach -- don't blindly change thresholds.
**Example:**
```python
# Pseudocode for the decision logic
current_high = 0.55
current_medium = 0.40

# Count queries in each bucket at current thresholds
high_pct = sum(1 for s in scores if s >= current_high) / len(scores)
medium_pct = sum(1 for s in scores if current_medium <= s < current_high) / len(scores)
low_pct = sum(1 for s in scores if s < current_medium) / len(scores)

# D-04: ~30%/45%/25% is the target distribution
if abs(high_pct - 0.30) < 0.15 and abs(medium_pct - 0.45) < 0.15:
    print("Thresholds validated -- no change needed")
else:
    # Derive new thresholds from percentiles
    new_high = np.percentile(scores, 70)  # Top 30% = high
    new_medium = np.percentile(scores, 25)  # Bottom 25% = low
    print(f"Recommended: high >= {new_high:.3f}, medium >= {new_medium:.3f}")
```

### Anti-Patterns to Avoid
- **Hard-coding synthetic queries in the script without documentation:** Each synthetic query should have a comment explaining what content type it targets (prose, table, image, out-of-domain) per D-02.
- **Using supabase-py async client in a standalone script:** Adds unnecessary complexity; psycopg2 sync is simpler and proven by observe-run.py.
- **Changing thresholds without documenting the distribution:** D-04 requires explicit evidence before any change. Always produce the histogram + quartiles first.
- **Bypassing the RPC function:** The calibration MUST use the same similarity computation as production (`1 - (embedding <=> query_embedding)`) to avoid measurement drift.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentile calculation | Manual sort + index math | `numpy.percentile()` | Edge cases with small sample sizes, interpolation modes |
| Histogram binning | Manual loop + bucket counting | `numpy.histogram()` | Handles edge bins, provides consistent bin edges |
| Embedding generation | Custom OpenAI call | `embed_texts()` from `openai_service.py` (import directly) | Must use identical model + parameters as production |
| Environment loading | os.environ manual parse | `python-dotenv` `load_dotenv()` | Handles quoting, comments, multiline values consistently |

**Key insight:** The calibration script must produce identical similarity scores to production. Any deviation in embedding model, vector comparison, or threshold logic would invalidate the calibration. Reuse production code paths wherever possible.

## Common Pitfalls

### Pitfall 1: Small Sample Size Skew
**What goes wrong:** With only ~5-20 real documents and a handful of audit_log queries, the distribution may not be statistically representative.
**Why it happens:** Personal corpus is small; operator's uploaded documents may cluster in a narrow domain.
**How to avoid:** D-02 compensates with ~20 synthetic queries designed to span prose/table/image/out-of-domain content types. The script should report sample size prominently and flag if N < 30 total queries.
**Warning signs:** If all scores cluster in a narrow band (e.g., all between 0.45-0.55), the thresholds may not be meaningful.

### Pitfall 2: Embedding Model Mismatch
**What goes wrong:** If the calibration script uses a different embedding model than what produced the stored chunk embeddings, similarity scores will be meaningless.
**Why it happens:** `text-embedding-3-small` is the default in `config.py:498`, but `user_settings.embedding_model` can override it. The stored chunks have embeddings from whatever model was active at ingestion time.
**How to avoid:** The script must use the same embedding model as the stored chunks. Read `app_settings.embedding_model` or default to `text-embedding-3-small` (the production default). Document which model was used in the output.
**Warning signs:** Similarity scores clustered near 0.0 or dramatically different from expected 0.3-0.7 range.

### Pitfall 3: match_threshold Filter Hiding Low Scores
**What goes wrong:** The `match_document_chunks` RPC has a `match_threshold` parameter (default 0.3) that filters out chunks below that similarity. This means the calibration never sees truly-low-similarity results.
**Why it happens:** The RPC is designed for production retrieval, not calibration. It drops rows below threshold before returning.
**How to avoid:** For calibration purposes, pass a very low `match_threshold` (e.g., 0.0 or 0.01) to see the full score distribution, OR accept that the production floor is 0.3 and calibrate only within the observable range. The second approach is correct here -- we're calibrating the same pipeline the user sees.
**Warning signs:** All similarity scores above 0.3 (because the RPC filtered everything else).

### Pitfall 4: Confusing Per-Call avg_sim with Per-Chunk Similarity
**What goes wrong:** `_compute_confidence` receives the average across top-N chunks for a single query, not individual chunk similarities.
**Why it happens:** The function signature is `_compute_confidence(avg_similarity: float)` and it receives `sum(similarity_scores) / len(similarity_scores)` where `similarity_scores` is a list of per-search-call averages.
**How to avoid:** The calibration must mirror this: for each query, compute `_avg_cosine(rows)` over the returned chunks, then analyze the distribution of THOSE averages. Don't analyze raw per-chunk similarities.
**Warning signs:** Scores in the 0.8-0.95 range (likely looking at individual chunk scores, not averaged).

### Pitfall 5: audit_log metadata Schema
**What goes wrong:** Assuming `audit_log.metadata` contains query embeddings or similarity scores.
**Why it happens:** Optimistic assumption about what's logged.
**How to avoid:** audit_log stores `{"query_text": str, "document_ids": list[str]}` -- only the query text, not the results or scores. The script must re-execute each query through the embedding + RPC pipeline to get similarity scores.
**Warning signs:** KeyError on `metadata["similarity"]` or similar.

## Code Examples

### Calibration Script Core Loop
```python
# Source: derived from backend/app/services/retrieval_service.py:159-162 + 237-305
# [VERIFIED: codebase grep]

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor

def calibrate(conn, user_id: str, queries: list[str], embedding_fn, top_k: int = 10, match_threshold: float = 0.01):
    """Run each query through the retrieval pipeline and collect avg_similarity scores."""
    avg_sims = []
    for query_text in queries:
        embedding = embedding_fn([query_text])[0]
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
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
            rows = cur.fetchall()
        
        if rows:
            sims = [r["similarity"] for r in rows if r["similarity"] and r["similarity"] > 0]
            avg_sim = sum(sims) / len(sims) if sims else 0.0
            if avg_sim > 0.0:
                avg_sims.append(avg_sim)
    
    return avg_sims
```

### Distribution Analysis Output
```python
# Source: project convention from observe-run.py (structured markdown output)
# [VERIFIED: codebase]

def analyze_distribution(scores: list[float], current_high: float = 0.55, current_medium: float = 0.40):
    """Produce the calibration report."""
    arr = np.array(scores)
    report = {
        "sample_size": len(scores),
        "min": float(arr.min()),
        "max": float(arr.max()),
        "mean": float(arr.mean()),
        "median": float(np.median(arr)),
        "std": float(arr.std()),
        "percentiles": {
            "p10": float(np.percentile(arr, 10)),
            "p25": float(np.percentile(arr, 25)),
            "p50": float(np.percentile(arr, 50)),
            "p75": float(np.percentile(arr, 75)),
            "p90": float(np.percentile(arr, 90)),
        },
        "current_thresholds": {"high": current_high, "medium": current_medium},
        "bucket_proportions_at_current": {
            "high": float((arr >= current_high).mean()),
            "medium": float(((arr >= current_medium) & (arr < current_high)).mean()),
            "low": float((arr < current_medium).mean()),
        },
    }
    return report
```

### pdf_extraction_runs Telemetry Verification
```python
# Source: supabase/full-schema.sql:436-447
# [VERIFIED: codebase]

def verify_telemetry(conn):
    """Verify pdf_extraction_runs.engine is populated for recent extractions."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT engine, COUNT(*) as count
            FROM pdf_extraction_runs
            WHERE completed_at > NOW() - INTERVAL '30 days'
            GROUP BY engine
            ORDER BY count DESC
        """)
        rows = cur.fetchall()
        # Expect: at least one row with engine matching post-071.3 defaults
        # (e.g., 'composable[legacy/camelot/pymupdf_full/none]')
        return rows
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 32.5 thresholds (high>=0.70, medium>=0.50) | Recalibrated to high>=0.55, medium>=0.40 | 2026-04-18 (Phase 32.5) | Most correct answers were showing "low" under old thresholds |
| pdfplumber + pypdf text chunks | camelot tables + pymupdf_full images + legacy text + none equations | 2026-05-17 (Phase 071.3) | Different chunk content/density may shift score distribution |
| Docling-first extraction | Per-aspect dispatcher with non-Docling defaults | 2026-05-17 (Phase 071.3) | Formally reversed Docling-first thesis; "swap-by-default optionality" now |

**Deprecated/outdated:**
- Phase 32.5 calibration values (0.55/0.40) may or may not still be correct -- this phase determines that
- The "Docling-first" thesis from v2.6 PRD is formally retired per D-v2.6-05

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | numpy is already installed in the backend venv | Standard Stack | LOW -- if missing, `pip install numpy` is trivial; script can fall back to stdlib statistics |
| A2 | psycopg2 can pass vector embeddings as string-formatted arrays to pgvector | Code Examples | MEDIUM -- may need explicit `::vector` cast or pgvector Python adapter; verify at implementation time |
| A3 | The user has sufficient audit_log entries to provide meaningful query replay data | Common Pitfalls | LOW -- D-02 compensates with synthetic queries; even 0 audit entries is handled |

## Open Questions

1. **Exact pgvector embedding format for psycopg2**
   - What we know: pgvector accepts `'[0.1, 0.2, ...]'::vector` format in SQL
   - What's unclear: Whether psycopg2 needs a custom type adapter or if string casting suffices
   - Recommendation: Test with a simple SELECT first; if needed, use `psycopg2.extensions.adapt` or format as string literal `'[...]'`

2. **User ID to use for calibration**
   - What we know: audit_log is keyed on user_id; document_chunks has RLS via user_id
   - What's unclear: Whether to hardcode the operator's user_id or make it a CLI arg
   - Recommendation: CLI arg with auto-detection from audit_log (pick the user with the most search.query entries)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | backend/pytest.ini |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_citations_confidence.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_citations_confidence.py -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAG-RECAL-01 | _compute_confidence returns correct level for updated thresholds | unit | `pytest tests/unit/test_citations_confidence.py -x` | Exists (update if thresholds change) |
| RAG-RECAL-01 | Calibration script runs without error on live DB | smoke/manual | `cd backend && venv/Scripts/python.exe ../scripts/calibrate_confidence.py` | Wave 0 (new) |
| RAG-RECAL-01 | pdf_extraction_runs.engine populated | smoke/manual | SQL assertion in calibration script | N/A (built into script) |

### Sampling Rate
- **Per task commit:** `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_citations_confidence.py -x -q`
- **Per wave merge:** Full unit test suite for confidence + calibration script dry-run
- **Phase gate:** Calibration script produces valid JSON output + test_citations_confidence.py green

### Wave 0 Gaps
- [ ] `scripts/calibrate_confidence.py` -- the calibration script itself (Plan 01 deliverable)
- [ ] Update `test_citations_confidence.py` threshold assertions if values change (Plan 02 deliverable)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes (minor) | Script uses service-role key; must not expose in output |
| V5 Input Validation | yes (minor) | Script validates CLI args; SQL uses parameterized queries |
| V6 Cryptography | no | -- |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in calibration script | Tampering | Parameterized queries via psycopg2 %s placeholders (already in code pattern) |
| Service-role key exposure in script output | Information Disclosure | Never print SUPABASE_SERVICE_ROLE_KEY; only use for DB connection |

## Sources

### Primary (HIGH confidence)
- `backend/app/api/threads.py:530-542` -- `_compute_confidence` function (current thresholds verified: high>=0.55, medium>=0.40)
- `backend/app/services/retrieval_service.py:159-162` -- `_avg_cosine` implementation
- `supabase/full-schema.sql:120-135` -- `match_document_chunks` RPC (similarity = `1 - (embedding <=> query_embedding)`)
- `supabase/full-schema.sql:436-447` -- `pdf_extraction_runs` table schema
- `supabase/full-schema.sql:275-282` -- `audit_log` table schema (action_type constraint includes 'search.query')
- `backend/app/api/threads.py:2530-2566` -- search_documents call site (avg_sim accumulation)
- `backend/tests/unit/test_citations_confidence.py` -- existing test assertions
- `scripts/observe-run.py` -- project pattern for standalone scripts with env loading
- `.planning/phases/071.3-*/071.3-05-SUMMARY.md` -- Q-v2.6-03 locked at "re-run on new defaults"

### Secondary (MEDIUM confidence)
- Phase 32.5 memory (`project_phase32_5_chunking_fixes.md`) -- confirms original calibration shifted from 0.70/0.50 to 0.55/0.40
- Phase 044 summary -- confirms test_citations_confidence.py was updated for Phase 32.5 thresholds

### Tertiary (LOW confidence)
- None -- all critical claims verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project; patterns proven by observe-run.py
- Architecture: HIGH -- direct examination of production code paths; clear integration points
- Pitfalls: HIGH -- verified by reading actual data schemas and function signatures

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable -- threshold calibration is a one-time operation per extractor change)
