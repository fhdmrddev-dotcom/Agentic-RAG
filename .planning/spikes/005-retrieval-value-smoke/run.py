"""Spike 005 — retrieval-value smoke (the (b) leg of SEED-021).

The Spike 001 finding (extraction ceiling is 67, not 20 — the storage-layer
`_MAX_VISION_CALLS=20` hardcode was the bottleneck) means the SEED-021
re-open question collapses to:

  Does raising the cap from 20 → 100 (storing 47 more figures + descriptions)
  actually improve retrieval quality on figure-grounded queries against the
  EXISTING strong pipeline (hybrid search + reranker + 15+ tools)?

This script:
  1. Reports the current `app_settings.multimodal_max_vision_calls` value.
  2. Optionally bumps it to 100 (write/read via Supabase SQL editor — does
     NOT use `supabase db push` per CLAUDE.md).
  3. Tells the operator exactly what to do next (restart uvicorn, re-ingest
     thesis, run query set, hand-evaluate).
  4. Reads/writes SQL counts to record the before/after stored-figure count.

This is intentionally NOT an autonomous spike. The (b) leg requires human
hand-evaluation of answer quality across 5-10 figure-grounded queries; no
script can do that.

Run:
    backend/venv/Scripts/python.exe .planning/spikes/005-retrieval-value-smoke/run.py status
    backend/venv/Scripts/python.exe .planning/spikes/005-retrieval-value-smoke/run.py prep
    backend/venv/Scripts/python.exe .planning/spikes/005-retrieval-value-smoke/run.py revert
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ENV = REPO_ROOT / "backend" / ".env"


def get_supabase_client():
    """Build a supabase client from backend/.env without booting the FastAPI app."""
    sys.path.insert(0, str(REPO_ROOT / "backend"))
    try:
        from dotenv import load_dotenv  # type: ignore
    except ImportError:
        print("FAIL: python-dotenv not installed in backend venv", file=sys.stderr)
        sys.exit(2)
    load_dotenv(BACKEND_ENV)
    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        print("FAIL: supabase-py not installed in backend venv", file=sys.stderr)
        sys.exit(2)

    url = os.environ.get("SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
    )
    if not url or not key:
        print("FAIL: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY / SUPABASE_KEY) must be in backend/.env", file=sys.stderr)
        sys.exit(2)
    return create_client(url, key)


def cmd_status() -> int:
    """Print current app_settings.multimodal_max_* + per-thesis stored figure counts."""
    sb = get_supabase_client()

    # Current cap
    settings_row = sb.table("app_settings").select(
        "multimodal_max_vision_calls, multimodal_max_b64_bytes_kb"
    ).execute()
    if not settings_row.data:
        print("FAIL: app_settings table is empty — migration 044 may not have applied", file=sys.stderr)
        return 2
    s = settings_row.data[0]
    print(f"Current app_settings.multimodal_max_vision_calls  = {s.get('multimodal_max_vision_calls')}")
    print(f"Current app_settings.multimodal_max_b64_bytes_kb   = {s.get('multimodal_max_b64_bytes_kb')}")
    print(f"Current HARDCODED multimodal_service._MAX_VISION_CALLS = 20  (Phase 072 Plan 01 will remove this)")

    # Find thesis-shaped documents
    print("\nLooking for thesis-shaped documents (largest PDFs in `documents` table)...")
    docs = sb.table("documents").select(
        "id, filename, mime_type, created_at"
    ).eq("is_latest", True).order("created_at", desc=True).limit(20).execute()

    if not docs.data:
        print("  (no documents found — upload the thesis via the dev app first)")
        return 0

    print(f"  Found {len(docs.data)} recent documents:")
    for d in docs.data[:10]:
        # Per-doc image count
        imgs = sb.table("document_images").select("id", count="exact").eq("document_id", d["id"]).execute()
        total = imgs.count or 0
        empty = sb.table("document_images").select("id", count="exact").eq("document_id", d["id"]).eq("description", "").execute()
        empty_n = empty.count or 0
        print(f"    {d['id'][:8]}…  {d['filename'][:50]:<50}  images={total}  empty={empty_n}")
    return 0


def cmd_prep() -> int:
    """Document what the operator must do to run the retrieval smoke."""
    print(
        """
╔══════════════════════════════════════════════════════════════╗
║  SPIKE 005 — Retrieval Value Smoke (manual procedure)         ║
╚══════════════════════════════════════════════════════════════╝

This spike CANNOT be fully scripted. It needs human hand-evaluation. Here's
the procedure end-to-end:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Snapshot current state (20-figure cap)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1a. Make sure the thesis is uploaded via the app (http://localhost:5173).
    Note the document_id from the URL or run:
        python .planning/spikes/005-retrieval-value-smoke/run.py status

1b. Pick 5–10 figure-grounded test queries. Suggestions (adapt to your
    thesis's actual figures):
      Q1. "What does Figure 3 show?"
      Q2. "Describe the architecture diagram on page 12."
      Q3. "What trend is visible in the chart on page 8?"
      Q4. "Summarize the experimental results figure."
      Q5. "What's labeled in the system flowchart?"
      ... etc

1c. With cap=20, run all queries via the chat UI. Record answers verbatim
    in the RESULTS table below (in this file's results section, or in a
    side note).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Apply temporary cap-raise (preview of Phase 072 Plan 01)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2a. In the Supabase SQL editor (NEVER `supabase db push`), run:

      UPDATE app_settings SET multimodal_max_vision_calls = 100 WHERE id = 'global';

2b. Apply this ONE-LINE preview patch to multimodal_service.py — replace:

      _MAX_VISION_CALLS = 20

    with:

      _MAX_VISION_CALLS = 100   # spike-005 preview of D-072-08; reverted before commit

    DO NOT COMMIT this change. It is a throwaway preview of what Phase 072
    Plan 01 will do properly (read from app_settings instead of hardcode).

2c. Restart uvicorn.

2d. Re-ingest the thesis via the app (click Reingest on the document, OR
    POST /documents/{id}/reingest).

2e. After ingestion completes, verify via SQL:

      SELECT count(*) AS total,
             count(*) FILTER (WHERE description != '') AS with_desc,
             count(*) FILTER (WHERE description = '') AS empty
      FROM document_images WHERE document_id = '<thesis-id>';

    Expected: total ≈ 67 (matching Spike 001), with_desc up to 100.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Re-run the same query set under the lifted cap
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3a. Run Q1–Q10 from Step 1 verbatim. Record answers.

3b. For each query, score Δ vs the cap=20 baseline:
      ↑↑ much better (substantively different, more accurate)
      ↑  modestly better (more detail, still right)
      =  no observable difference
      ↓  worse (hallucination, irrelevant detail)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Revert preview + record verdict
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4a. Revert the multimodal_service.py one-line patch (or git checkout it).

4b. Optional: revert the SQL setting:
      UPDATE app_settings SET multimodal_max_vision_calls = 20 WHERE id = 'global';
    (Plan 01 will set the default to 100 properly when it ships.)

4c. Restart uvicorn.

4d. Fill in the RESULTS section of this spike's README with the verdict:
      GREEN — most queries scored ↑ or ↑↑. Plan 01 is justified.
      YELLOW — mixed. Some queries improved, others didn't. Worth shipping
               Plan 01 (it's cheap) but don't expect dramatic retrieval gains.
      RED — no queries improved. Storage is NOT the retrieval bottleneck.
            Consider downscoping Plan 01 OR shipping it as low-priority and
            redirecting effort elsewhere (e.g., chunking, reranker tuning).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run `... revert` after the smoke to print the SQL revert command + reminder.
""")
    return 0


def cmd_revert() -> int:
    """Print the SQL revert command + reminder about the multimodal_service.py patch."""
    print("""
Reverting Spike 005 preview state:

1. In Supabase SQL editor:
     UPDATE app_settings SET multimodal_max_vision_calls = 20 WHERE id = 'global';

2. Revert the one-line patch to backend/app/services/multimodal_service.py:
     git checkout backend/app/services/multimodal_service.py
   (OR manually flip _MAX_VISION_CALLS back to 20.)

3. Restart uvicorn so the change takes effect.

4. Optional verification:
     python .planning/spikes/005-retrieval-value-smoke/run.py status
   ...should show multimodal_max_vision_calls = 20 again.
""")
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in ("status", "prep", "revert"):
        print(__doc__, file=sys.stderr)
        return 2
    if sys.argv[1] == "status":
        return cmd_status()
    if sys.argv[1] == "prep":
        return cmd_prep()
    if sys.argv[1] == "revert":
        return cmd_revert()
    return 2


if __name__ == "__main__":
    sys.exit(main())
