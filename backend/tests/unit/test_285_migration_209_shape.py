"""Phase 285-01 — migration 209's SHAPE, pinned against its text (D-01, D-06, D-07 as refined by
orchestrator ruling 1, D-14, D-19; T-285-05/06/07).

Migration 209 is the phase's only schema + data change:
  * ``connector_watch_items.failed_attempts`` (FIX-12, D-01) — consecutive failed reads, capped at 3
    in ``watch_service.sync_watch``;
  * ``connector_watch_items.minted`` (FIX-13, D-06) — true only when THIS watch minted the document;
    a purge deletes minted, unshared documents only;
  * a ONE-SHOT backfill of ``minted`` with the tightened D-07 predicate;
  * the D-14 heal of stuck ``pending`` documents (no job, older than 1 hour).

⛔ The properties that matter, and the plant that turns each red:
  * no function / procedure — PLANT: add ``CREATE OR REPLACE FUNCTION f() …``. D-19: a function
    would need SECURITY INVOKER + REVOKE FROM PUBLIC; DO blocks need neither.
  * ``ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0`` and ``… minted boolean
    NOT NULL DEFAULT false`` — PLANT: ``DEFAULT true`` on minted. Default false means a purge KEEPS
    any row nobody marked (data loss is the bug class being fixed).
  * the backfill sits inside ``IF v_fresh THEN`` with ``v_fresh`` read from
    ``information_schema.columns`` BEFORE the ALTER — PLANT: move the UPDATE out of the IF. A re-run
    would then overwrite markers the runtime wrote since (M-2/M-3).
  * the backfill predicate carries all four terms (connection, external id, born after its watch,
    10-minute window before first_seen_at) — PLANT: delete ``d.created_at >= w.created_at``. 8 local
    manual-import rows the D-07-as-written predicate would mark minted (RESEARCH §4).
  * heal: INSERT INTO ingestion_jobs BEFORE the UPDATE documents; the INSERT requires the bytes in
    ``storage.objects`` (bucket ``documents``), the UPDATE requires their absence; both carry the
    1-hour bound and the no-job guard — PLANT: drop the ``EXISTS (… storage.objects …)`` from the
    INSERT. A bytes-less row would be enqueued and "complete" empty (BUG-260905-08).
  * the heal block is delimited by the raw marker comments ``-- 209 HEAL BEGIN`` / ``-- 209 HEAL
    END`` — PLANT: delete one. Plan 03's live heal test extracts the text between them.
  * the ``connector_watch_items_failed_attempts_nonneg`` CHECK — PLANT: delete it.
  * the VERIFY block in the 207/208 layout — PLANT: delete ``as status, what from checks``.

⚠ Every code assertion runs over the migration text with ``--`` comments STRIPPED, so header prose
cannot satisfy or break an assertion. The marker and VERIFY assertions read the RAW text, because
both are comments by design. The applied state is measured by ``scripts/apply_migration_209.py``.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("209_*.sql"))
    assert len(matches) == 1, matches
    return matches[0]


def _raw() -> str:
    return _migration().read_text(encoding="utf-8")


def _strip_comments(sql: str) -> str:
    out = []
    for line in sql.splitlines():
        idx = line.find("--")
        if idx != -1:
            line = line[:idx]
        if line.strip():
            out.append(line)
    return "\n".join(out)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _code() -> str:
    return _norm(_strip_comments(_raw()))


def test_no_function_or_procedure_is_created() -> None:
    code = _code().lower()
    assert not re.search(r"create\s+(or\s+replace\s+)?(function|procedure)", code), (
        "D-19: 209 must use DO blocks only — a function would need SECURITY INVOKER + REVOKE FROM PUBLIC"
    )


def test_adds_failed_attempts_and_minted_columns() -> None:
    code = _code().lower()
    assert "add column if not exists failed_attempts integer not null default 0" in code
    assert "add column if not exists minted boolean not null default false" in code


def test_backfill_is_one_shot_inside_v_fresh() -> None:
    code = _code().lower()
    fresh = code.find("v_fresh boolean")
    alter = code.find("add column if not exists minted")
    assert fresh != -1 and alter != -1
    assert fresh < alter, "v_fresh must be computed BEFORE the ALTER adds the column"
    assert "information_schema.columns" in code[fresh:alter]
    if_fresh = code.find("if v_fresh then")
    update = code.find("set minted = true")
    else_ = code.find("else", if_fresh)
    assert if_fresh != -1 and update != -1
    assert if_fresh < update < else_, "the minted backfill UPDATE must sit inside IF v_fresh THEN"


def test_backfill_predicate_is_the_tightened_d07() -> None:
    code = _code().lower()
    start = code.find("set minted = true")
    end = code.find("get diagnostics", start)
    pred = code[start:end]
    assert "d.source_connection_id = w.connection_id" in pred
    assert "d.metadata->'source'->>'external_id' = i.external_id" in pred
    assert "d.created_at >= w.created_at" in pred
    assert "interval '10 minutes'" in pred and "i.first_seen_at" in pred


def test_heal_enqueues_only_with_bytes_then_fails_the_rest() -> None:
    code = _code().lower()
    ins = code.find("insert into public.ingestion_jobs")
    upd = code.find("update public.documents")
    assert ins != -1 and upd != -1
    assert ins < upd, "heal must enqueue FIRST, then fail what is left"
    insert_stmt = code[ins:code.find(";", ins)]
    update_stmt = code[upd:code.find(";", upd)]
    storage_exists = re.compile(
        r"(?<!not )exists \(select 1 from storage\.objects o where o\.bucket_id = 'documents'"
    )
    storage_not_exists = "not exists (select 1 from storage.objects o where o.bucket_id = 'documents'"
    assert storage_exists.search(insert_stmt), "the INSERT must require the bytes (D-14)"
    assert storage_not_exists not in insert_stmt
    assert storage_not_exists in update_stmt, "the UPDATE must require the bytes' absence"
    for stmt in (insert_stmt, update_stmt):
        assert "interval '1 hour'" in stmt
        assert "not exists (select 1 from public.ingestion_jobs" in stmt
        assert "d.status = 'pending'" in stmt


def test_heal_block_has_raw_markers() -> None:
    raw = _raw()
    assert raw.count("-- 209 HEAL BEGIN") == 1
    assert raw.count("-- 209 HEAL END") == 1
    begin = raw.find("-- 209 HEAL BEGIN")
    end = raw.find("-- 209 HEAL END")
    assert begin < end
    block = raw[begin:end].lower()
    assert "insert into public.ingestion_jobs" in block and "update public.documents" in block


def test_failed_attempts_nonneg_check_is_idempotent() -> None:
    code = _code().lower()
    assert "conname = 'connector_watch_items_failed_attempts_nonneg'" in code
    assert (
        "add constraint connector_watch_items_failed_attempts_nonneg check (failed_attempts >= 0)"
        in code
    )


def test_verify_block_in_the_208_layout() -> None:
    raw = _raw()
    lines = raw.splitlines()
    idx = next(i for i, ln in enumerate(lines) if ln.startswith("-- VERIFY"))
    body = lines[idx + 1:]
    assert body and all(ln.startswith("--   ") for ln in body if ln.strip()), (
        "VERIFY body lines must be '--   ' comments (pasteable, never executed)"
    )
    text = "\n".join(body)
    assert "with checks(what, ok)" in text
    assert "as status, what from checks" in text
