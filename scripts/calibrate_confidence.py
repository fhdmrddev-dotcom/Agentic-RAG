"""
calibrate_confidence.py -- Phase 076 reusable confidence threshold calibration.

Connects to Supabase Postgres, replays audit_log queries + synthetic calibration
queries through the embedding+retrieval pipeline, collects avg_similarity values,
prints a human-readable report, and writes results to a JSON output file.

Usage:
  cd backend
  ./venv/Scripts/python.exe ../scripts/calibrate_confidence.py [--user-id UUID] [--output results.json] [--top-k 10] [--match-threshold 0.01]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants — current thresholds from threads.py:530-542 (Phase 32.5 calibration)
# ---------------------------------------------------------------------------
CURRENT_HIGH_THRESHOLD = 0.55
CURRENT_MEDIUM_THRESHOLD = 0.40

# D-04: target bucket proportions (roughly 30% high / 45% medium / 25% low)
TARGET_BUCKET_PROPORTIONS = {"high": 0.30, "medium": 0.45, "low": 0.25}
BUCKET_TOLERANCE = 0.15  # how far from target is acceptable

DEFAULT_TOP_K = 10
DEFAULT_MATCH_THRESHOLD = 0.01  # very low to see full distribution (Pitfall 3)

EMBEDDING_MODEL = "text-embedding-3-small"


# ---------------------------------------------------------------------------
# Synthetic calibration queries (D-02: ~20 queries across 4 categories)
# ---------------------------------------------------------------------------
SYNTHETIC_QUERIES = [
    # --- prose (5-6): general document content understanding ---
    {"text": "What are the main findings discussed in the introduction?",
     "category": "prose"},  # probes intro section retrieval
    {"text": "Summarize the methodology used in this research",
     "category": "prose"},  # probes methods/methodology sections
    {"text": "What conclusions does the author draw from the results?",
     "category": "prose"},  # probes conclusion section
    {"text": "Explain the theoretical framework underlying this study",
     "category": "prose"},  # probes theoretical/literature content
    {"text": "What limitations does the author acknowledge?",
     "category": "prose"},  # probes limitations discussion
    {"text": "Describe the background context and motivation for this work",
     "category": "prose"},  # probes abstract/background

    # --- table_referencing (4-5): tabular data, numbers, comparisons ---
    {"text": "Compare the values in Table 3 across all experimental conditions",
     "category": "table_referencing"},  # probes specific table retrieval
    {"text": "What numerical results are reported in the performance evaluation?",
     "category": "table_referencing"},  # probes quantitative results
    {"text": "Show me the statistical significance values from the experiments",
     "category": "table_referencing"},  # probes p-values/statistics
    {"text": "What are the key metrics reported in the comparison table?",
     "category": "table_referencing"},  # probes comparison data
    {"text": "List the parameters and their values from the configuration table",
     "category": "table_referencing"},  # probes parameter tables

    # --- image_referencing (3-4): figures, diagrams, charts ---
    {"text": "Describe the architecture shown in Figure 2",
     "category": "image_referencing"},  # probes architecture diagrams
    {"text": "What does the flow diagram illustrate about the system design?",
     "category": "image_referencing"},  # probes flow/system diagrams
    {"text": "Explain the trends visible in the bar chart of results",
     "category": "image_referencing"},  # probes charts/graphs
    {"text": "What components are depicted in the system overview figure?",
     "category": "image_referencing"},  # probes overview figures

    # --- out_of_domain (5-6): topics unlikely to be in any academic corpus ---
    {"text": "What is the recipe for chocolate chip cookies?",
     "category": "out_of_domain"},  # cooking -- should score low
    {"text": "Who won the FIFA World Cup in 2022?",
     "category": "out_of_domain"},  # sports -- should score low
    {"text": "What are the lyrics to Bohemian Rhapsody by Queen?",
     "category": "out_of_domain"},  # pop culture -- should score low
    {"text": "How do I change a flat tire on a Honda Civic?",
     "category": "out_of_domain"},  # automotive -- should score low
    {"text": "What are the best vacation destinations in Southeast Asia?",
     "category": "out_of_domain"},  # travel -- should score low
    {"text": "Explain the rules of cricket in simple terms",
     "category": "out_of_domain"},  # sports -- should score low
]


# ---------------------------------------------------------------------------
# Environment and connection helpers
# ---------------------------------------------------------------------------

def _load_env():
    """Load backend/.env so we get DATABASE_URL / OPENAI_API_KEY."""
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


def _get_db_connection():
    """Connect to Supabase Postgres via psycopg2 using DATABASE_URL env var."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. "
              "Run via the backend venv: backend/venv/Scripts/python.exe")
        sys.exit(1)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        # Fall back to common local Supabase default (same as observe-run.py)
        db_url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        print("INFO: DATABASE_URL not set; using local Supabase default")

    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {type(e).__name__}: {e}")
        sys.exit(1)


def _get_embedding(text: str) -> list[float]:
    """Embed a single query string using OpenAI text-embedding-3-small.

    Reads OPENAI_API_KEY from env. Returns the embedding vector as a list of floats.
    """
    try:
        from openai import OpenAI
    except ImportError:
        print("ERROR: openai package not installed. "
              "Run via the backend venv: backend/venv/Scripts/python.exe")
        sys.exit(1)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY not set in backend/.env")
        sys.exit(1)

    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=[text])
    return response.data[0].embedding


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def _fetch_audit_queries(conn, user_id: str | None) -> list[str]:
    """Fetch real search queries from audit_log.

    If user_id is None, auto-detect the user with the most search.query entries.
    Returns list of query_text values.
    """
    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if user_id is None:
            # Auto-detect user with most search.query entries
            cur.execute(
                "SELECT user_id, COUNT(*) as cnt "
                "FROM audit_log "
                "WHERE action_type = %s "
                "  AND metadata->>'query_text' IS NOT NULL "
                "GROUP BY user_id "
                "ORDER BY cnt DESC "
                "LIMIT 1",
                ("search.query",),
            )
            row = cur.fetchone()
            if row:
                user_id = str(row["user_id"])
                print(f"INFO: Auto-detected user_id={user_id} "
                      f"({row['cnt']} search.query entries)")
            else:
                print("WARNING: No search.query entries found in audit_log")
                return []

        # Fetch query texts for this user
        cur.execute(
            "SELECT metadata->>'query_text' AS query_text "
            "FROM audit_log "
            "WHERE action_type = %s "
            "  AND user_id = %s "
            "  AND metadata->>'query_text' IS NOT NULL "
            "ORDER BY created_at DESC "
            "LIMIT 100",
            ("search.query", user_id),
        )
        rows = cur.fetchall()

    return [r["query_text"] for r in rows if r["query_text"]]


# ---------------------------------------------------------------------------
# Calibration engine
# ---------------------------------------------------------------------------

def _avg_cosine(rows: list[dict]) -> float:
    """Average cosine similarity from vector search rows.

    Replicates exactly: retrieval_service.py:159-162
    """
    sims = [row["similarity"] for row in rows
            if row.get("similarity") and row["similarity"] > 0]
    return sum(sims) / len(sims) if sims else 0.0


def _run_calibration(
    conn,
    queries: list[str],
    embedding_fn,
    user_id: str,
    top_k: int,
    match_threshold: float,
) -> list[float]:
    """Run each query through the embedding+retrieval pipeline.

    For each query: embed, run pgvector similarity SQL, compute _avg_cosine.
    Returns list of avg_similarity floats (only > 0.0 values).
    """
    from psycopg2.extras import RealDictCursor

    avg_sims: list[float] = []
    total = len(queries)

    for i, query_text in enumerate(queries):
        if (i + 1) % 5 == 0 or i == 0:
            print(f"  Processing query {i + 1}/{total}...", flush=True)

        try:
            embedding = embedding_fn(query_text)
        except Exception as e:
            print(f"  WARNING: Failed to embed query {i + 1}: "
                  f"{type(e).__name__}: {e}")
            continue

        # Format embedding as pgvector-compatible string
        embedding_str = "[" + ",".join(str(f) for f in embedding) + "]"

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Production-equivalent similarity SQL
            # (matches match_document_chunks RPC logic)
            cur.execute(
                "SELECT 1 - (dc.embedding <=> %s::vector) AS similarity "
                "FROM document_chunks dc "
                "JOIN documents d ON d.id = dc.document_id "
                "WHERE dc.user_id = %s "
                "  AND 1 - (dc.embedding <=> %s::vector) > %s "
                "  AND d.is_latest = true "
                "ORDER BY dc.embedding <=> %s::vector "
                "LIMIT %s",
                (embedding_str, user_id, embedding_str,
                 match_threshold, embedding_str, top_k),
            )
            rows = cur.fetchall()

        avg_sim = _avg_cosine(rows)
        if avg_sim > 0.0:
            avg_sims.append(avg_sim)

    return avg_sims


# ---------------------------------------------------------------------------
# Distribution analysis
# ---------------------------------------------------------------------------

def _analyze_distribution(scores: list[float]) -> dict:
    """Compute distribution statistics and bucket proportions.

    Returns a dict with sample_size, min, max, mean, median, std,
    percentiles, bucket_proportions_at_current, and recommended action.
    Uses numpy if available, falls back to stdlib statistics.
    """
    if not scores:
        return {
            "sample_size": 0,
            "error": "No similarity scores collected",
            "recommended_action": "INSUFFICIENT_DATA",
        }

    try:
        import numpy as np
        arr = np.array(scores)
        analysis = {
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
        }
    except ImportError:
        # Fallback to stdlib statistics
        import statistics
        sorted_scores = sorted(scores)
        n = len(sorted_scores)
        analysis = {
            "sample_size": n,
            "min": sorted_scores[0],
            "max": sorted_scores[-1],
            "mean": statistics.mean(sorted_scores),
            "median": statistics.median(sorted_scores),
            "std": statistics.stdev(sorted_scores) if n > 1 else 0.0,
            "percentiles": {
                "p10": sorted_scores[int(n * 0.10)] if n > 10 else sorted_scores[0],
                "p25": sorted_scores[int(n * 0.25)],
                "p50": sorted_scores[int(n * 0.50)],
                "p75": sorted_scores[int(n * 0.75)],
                "p90": sorted_scores[int(n * 0.90)] if n > 10 else sorted_scores[-1],
            },
        }

    # Bucket proportions at current thresholds
    high_count = sum(1 for s in scores if s >= CURRENT_HIGH_THRESHOLD)
    medium_count = sum(1 for s in scores
                       if CURRENT_MEDIUM_THRESHOLD <= s < CURRENT_HIGH_THRESHOLD)
    low_count = sum(1 for s in scores if s < CURRENT_MEDIUM_THRESHOLD)
    n = len(scores)

    bucket_proportions = {
        "high": high_count / n,
        "medium": medium_count / n,
        "low": low_count / n,
    }
    analysis["bucket_proportions_at_current"] = bucket_proportions

    # D-04: validate-or-adjust decision
    high_ok = abs(bucket_proportions["high"] - TARGET_BUCKET_PROPORTIONS["high"]) < BUCKET_TOLERANCE
    medium_ok = abs(bucket_proportions["medium"] - TARGET_BUCKET_PROPORTIONS["medium"]) < BUCKET_TOLERANCE
    low_ok = abs(bucket_proportions["low"] - TARGET_BUCKET_PROPORTIONS["low"]) < BUCKET_TOLERANCE

    if high_ok and medium_ok and low_ok:
        analysis["recommended_action"] = "VALIDATED"
        analysis["reasoning"] = (
            "Bucket proportions at current thresholds (0.55/0.40) are within "
            f"{BUCKET_TOLERANCE:.0%} tolerance of target distribution "
            f"({TARGET_BUCKET_PROPORTIONS}). No threshold change needed."
        )
    else:
        analysis["recommended_action"] = "ADJUST"
        # Derive recommended thresholds from percentiles
        p70 = analysis["percentiles"]["p75"]  # ~top 30% boundary
        p25 = analysis["percentiles"]["p25"]  # ~bottom 25% boundary

        # Use P70 for high threshold (top 30% = high)
        try:
            import numpy as np
            p70_val = float(np.percentile(scores, 70))
        except ImportError:
            p70_val = sorted(scores)[int(len(scores) * 0.70)]

        analysis["recommended_thresholds"] = {
            "high": round(p70_val, 3),
            "medium": round(p25, 3),
        }
        deviations = []
        if not high_ok:
            deviations.append(
                f"high bucket: {bucket_proportions['high']:.1%} "
                f"(target ~{TARGET_BUCKET_PROPORTIONS['high']:.0%})"
            )
        if not medium_ok:
            deviations.append(
                f"medium bucket: {bucket_proportions['medium']:.1%} "
                f"(target ~{TARGET_BUCKET_PROPORTIONS['medium']:.0%})"
            )
        if not low_ok:
            deviations.append(
                f"low bucket: {bucket_proportions['low']:.1%} "
                f"(target ~{TARGET_BUCKET_PROPORTIONS['low']:.0%})"
            )
        analysis["reasoning"] = (
            "Bucket proportions deviate beyond tolerance: "
            + "; ".join(deviations)
            + f". Recommended thresholds derived from P70={p70_val:.3f} "
            f"and P25={p25:.3f}."
        )

    return analysis


# ---------------------------------------------------------------------------
# Telemetry verification
# ---------------------------------------------------------------------------

def _verify_telemetry(conn) -> list[dict]:
    """Query pdf_extraction_runs grouped by engine for the last 30 days.

    Returns rows with engine + count. Verifies per-extractor lineage
    is observable (SC#4 requirement).
    """
    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT engine, COUNT(*) as count "
            "FROM pdf_extraction_runs "
            "WHERE completed_at > NOW() - INTERVAL '30 days' "
            "GROUP BY engine "
            "ORDER BY count DESC"
        )
        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Report printing
# ---------------------------------------------------------------------------

def _print_report(
    analysis: dict,
    telemetry: list,
    audit_count: int,
    synthetic_count: int,
):
    """Print structured Markdown report to stdout."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    sample_size = analysis.get("sample_size", 0)

    print("\n" + "=" * 60)
    print("# Confidence Calibration Report")
    print("=" * 60)
    print(f"Date: {now}")
    print(f"Embedding model: {EMBEDDING_MODEL}")
    print(f"Sample size: {sample_size} "
          f"({audit_count} audit_log + {synthetic_count} synthetic)")
    print(f"Current thresholds: high >= {CURRENT_HIGH_THRESHOLD}, "
          f"medium >= {CURRENT_MEDIUM_THRESHOLD}")

    if sample_size < 30:
        print("\n** WARNING: Sample size < 30. Results may not be "
              "statistically representative. **")

    if analysis.get("error"):
        print(f"\nERROR: {analysis['error']}")
        return

    # Distribution summary
    print("\n## Distribution Summary\n")
    print("| Metric     | Value    |")
    print("|------------|----------|")
    print(f"| Min        | {analysis['min']:.4f}   |")
    print(f"| Max        | {analysis['max']:.4f}   |")
    print(f"| Mean       | {analysis['mean']:.4f}   |")
    print(f"| Median     | {analysis['median']:.4f}   |")
    print(f"| Std Dev    | {analysis['std']:.4f}   |")

    # Percentiles
    pcts = analysis.get("percentiles", {})
    print("\n## Percentiles\n")
    print("| Percentile | Value    |")
    print("|------------|----------|")
    for key in ("p10", "p25", "p50", "p75", "p90"):
        if key in pcts:
            print(f"| {key.upper():10s} | {pcts[key]:.4f}   |")

    # Bucket proportions
    buckets = analysis.get("bucket_proportions_at_current", {})
    print(f"\n## Bucket Proportions at Current Thresholds "
          f"({CURRENT_HIGH_THRESHOLD} / {CURRENT_MEDIUM_THRESHOLD})\n")
    print("| Bucket                     | Proportion | Target |")
    print("|----------------------------|------------|--------|")
    print(f"| High (>= {CURRENT_HIGH_THRESHOLD})             "
          f"| {buckets.get('high', 0):.1%}      | ~30%   |")
    print(f"| Medium [{CURRENT_MEDIUM_THRESHOLD}, {CURRENT_HIGH_THRESHOLD})         "
          f"| {buckets.get('medium', 0):.1%}      | ~45%   |")
    print(f"| Low (< {CURRENT_MEDIUM_THRESHOLD})              "
          f"| {buckets.get('low', 0):.1%}      | ~25%   |")

    # Verdict
    action = analysis.get("recommended_action", "UNKNOWN")
    reasoning = analysis.get("reasoning", "")
    print(f"\n## Verdict: {action}\n")
    print(reasoning)

    if action == "ADJUST" and "recommended_thresholds" in analysis:
        rec = analysis["recommended_thresholds"]
        print(f"\nRecommended thresholds: "
              f"high >= {rec['high']:.3f}, medium >= {rec['medium']:.3f}")

    # Telemetry
    print("\n## Telemetry (pdf_extraction_runs, last 30 days)\n")
    if telemetry:
        print("| Engine                                          | Count |")
        print("|-------------------------------------------------|-------|")
        for row in telemetry:
            print(f"| {str(row.get('engine', 'NULL')):47s} | {row.get('count', 0):5d} |")
    else:
        print("No pdf_extraction_runs found in the last 30 days.")

    print("\n" + "=" * 60)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main():
    """CLI entry point for confidence calibration."""
    parser = argparse.ArgumentParser(
        description="Confidence threshold calibration for Agentic RAG"
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="UUID of the user to calibrate for. "
             "If not provided, auto-detects the user with the most "
             "search.query audit_log entries.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="calibration_results.json",
        help="Path to write JSON results (default: calibration_results.json)",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help=f"Number of chunks to retrieve per query (default: {DEFAULT_TOP_K})",
    )
    parser.add_argument(
        "--match-threshold",
        type=float,
        default=DEFAULT_MATCH_THRESHOLD,
        help=f"Minimum similarity threshold for retrieval "
             f"(default: {DEFAULT_MATCH_THRESHOLD})",
    )
    args = parser.parse_args()

    # 1. Load environment
    _load_env()
    print("Connecting to database...")

    # 2. Connect to database
    conn = _get_db_connection()

    try:
        # 3. Fetch audit_log queries
        print("Fetching audit_log queries...")
        audit_queries = _fetch_audit_queries(conn, args.user_id)
        audit_count = len(audit_queries)
        print(f"  Found {audit_count} audit_log queries")

        # Determine user_id for calibration
        # If user_id was not provided and auto-detect found one, we need it
        # for the retrieval queries. Re-detect if needed.
        calibration_user_id = args.user_id
        if calibration_user_id is None:
            from psycopg2.extras import RealDictCursor
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT user_id, COUNT(*) as cnt "
                    "FROM audit_log "
                    "WHERE action_type = %s "
                    "  AND metadata->>'query_text' IS NOT NULL "
                    "GROUP BY user_id "
                    "ORDER BY cnt DESC "
                    "LIMIT 1",
                    ("search.query",),
                )
                row = cur.fetchone()
                if row:
                    calibration_user_id = str(row["user_id"])
                else:
                    # No audit entries -- try to find any user with chunks
                    cur.execute(
                        "SELECT DISTINCT user_id FROM document_chunks LIMIT 1"
                    )
                    row = cur.fetchone()
                    if row:
                        calibration_user_id = str(row["user_id"])
                        print(f"INFO: No audit queries; using user_id={calibration_user_id} "
                              f"from document_chunks")
                    else:
                        print("ERROR: No document_chunks found. "
                              "Cannot run calibration without data.")
                        sys.exit(1)

        # 4. Prepare combined query set
        synthetic_texts = [q["text"] for q in SYNTHETIC_QUERIES]
        synthetic_count = len(synthetic_texts)
        all_queries = audit_queries + synthetic_texts
        print(f"  Total queries: {len(all_queries)} "
              f"({audit_count} audit + {synthetic_count} synthetic)")

        # 5. Run calibration
        print("\nRunning calibration pipeline...")
        start = time.time()
        scores = _run_calibration(
            conn=conn,
            queries=all_queries,
            embedding_fn=_get_embedding,
            user_id=calibration_user_id,
            top_k=args.top_k,
            match_threshold=args.match_threshold,
        )
        elapsed = time.time() - start
        print(f"  Calibration complete: {len(scores)} scores in {elapsed:.1f}s")

        # 6. Analyze distribution
        print("Analyzing distribution...")
        analysis = _analyze_distribution(scores)

        # 7. Verify telemetry
        print("Verifying pdf_extraction_runs telemetry...")
        telemetry = _verify_telemetry(conn)

        # 8. Print report
        _print_report(analysis, telemetry, audit_count, synthetic_count)

        # 9. Write JSON output
        output_data = {
            "calibration_date": datetime.now(timezone.utc).isoformat(),
            "embedding_model": EMBEDDING_MODEL,
            "parameters": {
                "top_k": args.top_k,
                "match_threshold": args.match_threshold,
                "user_id": calibration_user_id,
            },
            "query_counts": {
                "audit_log": audit_count,
                "synthetic": synthetic_count,
                "total": len(all_queries),
                "scores_collected": len(scores),
            },
            "current_thresholds": {
                "high": CURRENT_HIGH_THRESHOLD,
                "medium": CURRENT_MEDIUM_THRESHOLD,
            },
            "target_bucket_proportions": TARGET_BUCKET_PROPORTIONS,
            "bucket_tolerance": BUCKET_TOLERANCE,
            "analysis": analysis,
            "telemetry": telemetry,
            "raw_scores": [round(s, 6) for s in sorted(scores)],
            "synthetic_query_categories": {
                cat: sum(1 for q in SYNTHETIC_QUERIES if q["category"] == cat)
                for cat in set(q["category"] for q in SYNTHETIC_QUERIES)
            },
        }

        output_path = Path(args.output)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, default=str)
        print(f"\nResults written to: {output_path.resolve()}")

    finally:
        conn.close()

    print("\nDone.")


if __name__ == "__main__":
    main()
