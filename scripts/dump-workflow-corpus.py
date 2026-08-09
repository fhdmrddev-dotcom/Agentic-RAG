"""One-off READ-ONLY dump of the live workflow definition SHAPES (Plan 184-05 Task 2, D-184-17).

WHY: R2 says every field the canvas does not model must survive an edit session. The
proof is a property — `fromCanvas(toCanvas(p), p)` returns the same objects — and a
property is only as good as the shapes it runs over. D-184-17 says those shapes come
from a COMMITTED artifact plus a hand-rolled generator, so the round-trip suite reads a
FILE and performs zero I/O at test time. Phase 183's "no live read in a test" property
therefore survives intact.

This script is the one-off, human-run step that produces that artifact. It is:
  - READ-ONLY by construction. It runs exactly one SELECT and writes nothing back to
    the database: no row is added, changed or removed, and there is no `--apply` path.
    The plan's acceptance criterion is a case-insensitive grep for the three
    row-mutating SQL verbs followed by a space; this file must contain zero such lines,
    which is why the verbs are named here only as "the three row-mutating SQL verbs"
    rather than spelled out — a self-matching docstring would fail the very check it
    describes (D-ITEM-183-02: a guard must never force its own prose to lie).
    Additionally the connection is opened `readonly=True`, so the server itself would
    refuse a write even if one were somehow attempted.
  - SCOPED to `public.workflow_definitions`, and to five columns of it:
    `id`, `slug`, `version`, `status` and `definition->'phases'`. The rest of the
    definition JSONB is never read, so it can never be committed.
  - KEY-PRESERVING REDACTED. Every key survives (key PRESENCE is what the property
    tests); every free-text string value becomes the single character U+2026, and every
    identifier-shaped value becomes a stable synthetic one. Nothing tenant-identifying
    is written: no prompt bodies, no folder_scope values, no skill_ref or
    skill_snapshot.storage_prefix values, no org_id, no user_id, no created_by — none
    of those columns is even selected.
  - SHAPE-PRESERVING where the shape is the point. `phase_type`, `citation_policy`,
    `integrity_policy`, `emitter`, `merge_strategy`, validator `kind` / `timing` and the
    `on_failure` disposition are enum-ish, not free text, and the projection reads them,
    so their values are kept verbatim. Phase slugs are ALIASED through a per-row map, so
    a duplicate slug stays duplicated and a resolvable `skip_to_phase:<target>` stays
    resolvable — the two shapes the serializer's fail-safe and branch paths need.
  - IDENTIFIER-ONLY LOGGING. It prints counts and synthetic ids; never row content.
  - HONEST WHEN THE DATABASE IS DOWN. If 127.0.0.1:54322 refuses the connection it does
    NOT invent data: it writes the artifact with a zero `row_count`, an empty
    `definitions` array and a provenance note saying the database was unreachable and
    when, so a reader can never mistake an empty dump for an empty corpus. The hand-
    rolled generator (`__fixtures__/shapeGenerator.ts`) is where the real coverage
    lives, so the property suite stays meaningful either way.

It lives in `scripts/`, never under `backend/` — a scratch .py inside the uvicorn
`--reload` watch tree wedges the dev server on Windows.

Prerequisite: local Supabase running (`supabase start`, idempotent) and `psycopg2`
importable. `psycopg2` lives in the backend venv, so run this as:

    backend/venv/Scripts/python scripts/dump-workflow-corpus.py     # Windows
    backend/venv/bin/python    scripts/dump-workflow-corpus.py      # POSIX

Usage:
    python scripts/dump-workflow-corpus.py --help
    python scripts/dump-workflow-corpus.py            # dump, or write the honest empty
    python scripts/dump-workflow-corpus.py --out PATH # override the artifact path
"""

import argparse
import datetime
import json
import os
import re
import sys

# Local Supabase — the same DSN the shipped one-off scripts use against the live local
# DB (`scripts/repair_dirty_workflow_phases.py:36`). NEVER `supabase db push` /
# `db reset` (the project migration rule).
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# The ONE statement this script runs. Five columns, one table, no predicate that could
# widen. Kept as a module constant so the provenance block can record it verbatim.
QUERY = (
    "SELECT id::text, slug, version, status, definition->'phases' AS phases "
    "FROM public.workflow_definitions "
    "ORDER BY slug, version"
)

# Where the artifact lands. A committed fixture, read by the round-trip suite as a
# build-resolved JSON import — never re-read from the database at test time.
DEFAULT_OUT = os.path.join(
    "frontend", "src", "components", "workflows", "__fixtures__", "corpusDump.json"
)

# The redaction placeholder: ONE character, so a redacted value can never be mistaken
# for content and can never be long enough to look like a real prompt body.
PLACEHOLDER = "…"

# Values kept verbatim because they are ENUM-ish and the projection reads them. A
# redacted `phase_type` would erase the config union discriminator and with it every
# unit of coverage this dump exists to provide.
KEPT_KEYS = frozenset(
    {
        "phase_type",
        "citation_policy",
        "integrity_policy",
        "emitter",
        "merge_strategy",
        "version_policy",
        "kind",
        "timing",
        "status",
    }
)

_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_SKIP_PREFIX = "skip_to_phase:"


class _Aliases:
    """Stable synthetic names, assigned in first-seen order, per dump.

    Same original in ⇒ same synthetic out, so a duplicate stays a duplicate and a
    `skip_to_phase` that resolved against a real phase still resolves after redaction.
    """

    def __init__(self):
        self._uuids = {}
        self._slugs = {}
        self._rows = {}

    def uuid(self, value):
        if value not in self._uuids:
            n = len(self._uuids) + 1
            self._uuids[value] = f"00000000-0000-4000-8000-{n:012d}"
        return self._uuids[value]

    def row(self, value):
        if value not in self._rows:
            self._rows[value] = f"wf-{len(self._rows) + 1:03d}"
        return self._rows[value]

    def slug(self, row_key, value):
        table = self._slugs.setdefault(row_key, {})
        if value not in table:
            table[value] = f"step-{len(table) + 1}"
        return table[value]


def _redact_on_failure(value, row_key, aliases):
    """Keep the disposition, alias only the target after `skip_to_phase:`."""
    if not isinstance(value, str):
        return value
    if not value.startswith(_SKIP_PREFIX):
        return value  # `retry` / `fail_run` / `continue` — enum-ish, kept verbatim
    target = value[len(_SKIP_PREFIX) :].strip()
    if not target:
        return value
    return _SKIP_PREFIX + aliases.slug(row_key, target)


def _redact(value, row_key, aliases, key=None):
    """Key-preserving redaction. Every key survives; only VALUES are rewritten."""
    if isinstance(value, dict):
        return {k: _redact(v, row_key, aliases, key=k) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v, row_key, aliases) for v in value]
    if isinstance(value, str):
        if key == "slug":
            return aliases.slug(row_key, value)
        if key == "on_failure":
            return _redact_on_failure(value, row_key, aliases)
        if key in KEPT_KEYS:
            return value
        if _UUID_RE.match(value):
            return aliases.uuid(value)
        return PLACEHOLDER
    # numbers, booleans and null carry no tenant content and are structurally load-
    # bearing (`phase_index`, `max_parallel_agents`, `max_retries`), so they stay.
    return value


def _has_duplicate_slugs(phases):
    slugs = [p.get("slug") for p in phases if isinstance(p, dict)]
    return len(set(slugs)) != len(slugs)


def _has_index_gap(phases):
    indices = sorted(
        p.get("phase_index") for p in phases if isinstance(p, dict) and isinstance(p.get("phase_index"), int)
    )
    if len(indices) != len(phases) or not indices:
        return True
    return indices != list(range(len(indices)))


def _count_skips(phases):
    total = 0
    for phase in phases:
        if not isinstance(phase, dict):
            continue
        for validator in phase.get("validators") or []:
            if isinstance(validator, dict) and str(validator.get("on_failure", "")).startswith(_SKIP_PREFIX):
                total += 1
    return total


def _fetch():
    """Run the one SELECT. Returns (rows, None) or (None, reason) when unreachable."""
    try:
        import psycopg2  # imported lazily so `--help` works without the backend venv
    except ImportError as exc:
        return None, f"psycopg2 is not importable ({exc}) — run with the backend venv interpreter"

    try:
        conn = psycopg2.connect(DSN, connect_timeout=5)
    except Exception as exc:  # noqa: BLE001 — any connect failure is the same story
        return None, f"{type(exc).__name__}: {str(exc).strip()}"

    try:
        conn.set_session(readonly=True, autocommit=True)
        cur = conn.cursor()
        try:
            cur.execute(QUERY)
            return cur.fetchall(), None
        finally:
            cur.close()
    finally:
        conn.close()


def _build(rows, aliases):
    definitions = []
    zero_phase = 0
    dup_slugs = 0
    gaps = 0
    max_phases = 0
    skips = 0

    for row_id, row_slug, version, status, phases in rows:
        phases = phases if isinstance(phases, list) else []
        row_key = row_id
        redacted = [_redact(p, row_key, aliases) for p in phases]

        if not phases:
            zero_phase += 1
        if _has_duplicate_slugs(phases):
            dup_slugs += 1
        if phases and _has_index_gap(phases):
            gaps += 1
        max_phases = max(max_phases, len(phases))
        skips += _count_skips(phases)

        definitions.append(
            {
                "id": aliases.uuid(row_id),
                "slug": aliases.row(row_slug),
                "version": version,
                "status": status,
                "phases": redacted,
            }
        )

    meta = {
        "rows_with_zero_phases": zero_phase,
        "rows_with_duplicate_slugs": dup_slugs,
        "rows_with_index_gaps": gaps,
        "max_phase_count": max_phases,
        "skip_to_phase_uses": skips,
    }
    return definitions, meta


NOTE_OK = (
    "PHASES ONLY, key-preserving redaction: every key is kept, every free-text string "
    "value is replaced with a single U+2026, and every identifier-shaped value is "
    "replaced with a stable synthetic one. No prompt bodies, no folder or skill "
    "identifiers, no tenant, owner or authoring-account columns — none of those are "
    "selected at all. Enum-ish values the projection reads (phase type, citation and "
    "integrity policy, emitter, merge strategy, validator kind and timing, the "
    "on_failure disposition) are kept verbatim, and phase slugs are aliased through a "
    "per-row map so duplicates stay duplicated and a resolvable branch stays "
    "resolvable. Regenerate with scripts/dump-workflow-corpus.py. NEVER read live at "
    "test time — the round-trip suite imports this file."
)

NOTE_UNREACHABLE = (
    "EMPTY BY HONESTY, NOT BY FACT. The local database was unreachable when this "
    "artifact was written, so NO shapes were read and none were invented. An empty "
    "definitions array here means 'not dumped', never 'the corpus is empty'. The "
    "hand-rolled shapeGenerator.ts carries the real coverage, so the round-trip "
    "property is meaningful without this file. Regenerate before phase verification: "
    "start the local stack, then run scripts/dump-workflow-corpus.py with the backend "
    "venv interpreter. Reason recorded in _provenance.unreachable_reason."
)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=(
            "READ-ONLY one-off: dump redacted workflow definition SHAPES to a committed "
            "JSON artifact for the D-184-17 round-trip property. Writes nothing to the "
            "database."
        )
    )
    parser.add_argument("--out", default=DEFAULT_OUT, help=f"artifact path (default: {DEFAULT_OUT})")
    args = parser.parse_args(argv)

    aliases = _Aliases()
    rows, unreachable = _fetch()

    if unreachable is None:
        definitions, meta = _build(rows, aliases)
        note = NOTE_OK
        print(f"read {len(definitions)} definition row(s); wrote no changes back")
        for entry in definitions:
            print(f"  {entry['slug']}  v{entry['version']}  {entry['status']}  phases={len(entry['phases'])}")
    else:
        definitions = []
        meta = {
            "rows_with_zero_phases": 0,
            "rows_with_duplicate_slugs": 0,
            "rows_with_index_gaps": 0,
            "max_phase_count": 0,
            "skip_to_phase_uses": 0,
        }
        note = NOTE_UNREACHABLE
        print(f"DATABASE UNREACHABLE — {unreachable}")
        print("writing the honest empty artifact; no shapes were invented")

    provenance = {
        "dumped_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "source": f"{DSN} · public.workflow_definitions",
        "query": QUERY,
        "row_count": len(definitions),
        "note": note,
    }
    provenance.update(meta)
    if unreachable is not None:
        provenance["unreachable_reason"] = unreachable

    payload = {"_provenance": provenance, "definitions": definitions}

    out_path = args.out
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"artifact written: {out_path}  (row_count={provenance['row_count']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
