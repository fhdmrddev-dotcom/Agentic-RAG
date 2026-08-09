#!/usr/bin/env python
"""set-feature-visibility.py — turn a governed feature on/off from the command line.

WHY THIS EXISTS
---------------
`live_connectors` (Phase 190, D-26) is in the backend's `PUT /admin/visibility`
allowlist but was never added to the Control Room's `GovernedFeature` map, so the
operator UI has no card for it (deferred item D-190-DEF-09). Without this script the
only way to turn it on is pasting JS into the browser devtools console, which is not a
reasonable thing to ask an operator to do.

This writes `app_settings.feature_visibility` directly. That is the same column the API
writes, but it BYPASSES the operator audit ledger — acceptable for local dev, NOT a
substitute for the Control Room card, which is still owed.

USAGE
    python scripts/set-feature-visibility.py --list
    python scripts/set-feature-visibility.py live_connectors on
    python scripts/set-feature-visibility.py live_connectors off

`on` writes audience "everyone". That exact value is load-bearing: Phase 190's CR-03 fix
made the executor require a positive "everyone", so "operators" or "role" leave sending
OFF even though the UI would look enabled.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(os.path.dirname(HERE), "backend")
load_dotenv(os.path.join(BACKEND, ".env"))

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 missing — run this with backend/venv/Scripts/python.exe")

DB = os.getenv("SUPABASE_DB_URL") or "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Mirrors backend/app/api/admin.py `_VISIBILITY_FEATURES`. Kept as a literal so a typo
# fails here rather than writing a key nothing reads.
KNOWN = {
    "skill_studio",
    "model_management",
    "governance_health",
    "workflow_authoring",
    "visual_workflow_canvas",
    "live_connectors",
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("feature", nargs="?", help="feature key, e.g. live_connectors")
    ap.add_argument("state", nargs="?", choices=["on", "off"], help="on => audience 'everyone'")
    ap.add_argument("--list", action="store_true", help="show current visibility and exit")
    args = ap.parse_args()

    conn = psycopg2.connect(DB)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id, feature_visibility FROM app_settings LIMIT 1")
    row = cur.fetchone()
    if row is None:
        return _err("app_settings has no row — is the local database seeded?")
    row_id, current = row
    if isinstance(current, str):
        current = json.loads(current)
    current = current or {}

    if args.list or not args.feature:
        print("Current feature_visibility:\n")
        for key in sorted(KNOWN):
            entry = current.get(key)
            audience = entry.get("audience") if isinstance(entry, dict) else None
            shown = audience or "off  (absent => cold default)"
            mark = "ON " if audience == "everyone" else "off"
            print(f"  [{mark}] {key:24} {shown}")
        print("\nUsage: python scripts/set-feature-visibility.py <feature> <on|off>")
        return 0

    if args.feature not in KNOWN:
        return _err(f"unknown feature {args.feature!r}. Known: {', '.join(sorted(KNOWN))}")
    if not args.state:
        return _err("missing state — pass 'on' or 'off'")

    audience = "everyone" if args.state == "on" else "off"
    before = (current.get(args.feature) or {}).get("audience", "absent (=> off)")
    current[args.feature] = {"roles": [], "groups": [], "audience": audience}

    cur.execute(
        "UPDATE app_settings SET feature_visibility = %s WHERE id = %s",
        (json.dumps(current), row_id),
    )

    # Verify by reading back, never by trusting the UPDATE.
    cur.execute("SELECT feature_visibility FROM app_settings WHERE id = %s", (row_id,))
    after_raw = cur.fetchone()[0]
    if isinstance(after_raw, str):
        after_raw = json.loads(after_raw)
    after = (after_raw.get(args.feature) or {}).get("audience")
    if after != audience:
        return _err(f"write did not stick — expected {audience!r}, database reads {after!r}")

    # ASCII only: the Windows console here is cp1252 and a check-mark raises
    # UnicodeEncodeError *after* the write has already landed — which reads as a failure
    # when it is actually a success. Measured 2026-08-10.
    print(f"{args.feature}: {before}  ->  {after}   [OK] verified by read-back")
    if args.feature == "live_connectors" and audience == "everyone":
        print("\nSettings -> Connections will now show the 'Add connection' button.")
        print("Backend caches settings, so give it a few seconds or reload the page.")
    return 0


def _err(msg: str) -> int:
    print(f"ERROR: {msg}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
