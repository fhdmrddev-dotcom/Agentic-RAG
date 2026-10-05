"""run-274-board.py — Phase 274 (274-05) planted-fact board for thread-scoped attachments (D-03, D-04).

Four modes, all against the LOCAL stack only (the conc_probe localhost hard-gate runs before any
request, and the DB / Redis DSNs are asserted to be 127.0.0.1 / localhost). The roster, the
single-org assertion, the send and the run wait are IMPORTED from ``run-273-board.py`` (hyphenated
filename, so ``importlib.util.spec_from_file_location``) — never re-typed.

  --roster   Print the EFFECTIVE roster derivation (run-273's ``derive_roster``: the seed overlaid by
             ``model_capabilities_overrides``, enabled + not deprecated, newest id per provider) and
             exit. Required rows: the 7 native providers + OpenRouter.

  --run      Per derived row (D-03 / D-04 / D-05):
               1. a fresh thread; a planted token ``ATT274-<provider>-<8 hex>`` that exists nowhere
                  else; a short ``.md`` file stating ``The Meridian freight-cap clearance code is
                  <token>.``, uploaded with ``POST .../workspace/files?lifetime=thread`` (the
                  composer's door);
               2. the ``workspace_files`` row must read ``expires_at IS NULL`` and
                  ``kind = 'template_input'`` (D-05);
               3. ``What is the Meridian freight-cap clearance code in the file I attached?`` with a
                  per-request ``model`` + ``provider`` (no global setting is mutated); PASS iff the
                  PERSISTED assistant message contains the token;
               4. the same question in a SECOND fresh thread (no attachment) — PASS iff the token is
                  ABSENT from its persisted answer;
               5. ``POST /document-search`` with ``name=<token>`` → ``total == 0``;
               6. ``documents`` / ``document_chunks`` hold no row containing the token (D-01).
             A row with no key, or a derive-blocked row, is written ⛔ with its reason — never dropped.
             One JSON per row under ``evidence/board/``; ``BOARD_TABLE`` printed at the end.

  --promote-probe
             The API half of G-4 #1 / #3 / #4 (the Chrome half is driven separately):
               * attach a > 256 KB PDF (bucket-stored, Pitfall 6) with ``?lifetime=thread`` and read
                 ``documents`` count before/after the attach (unchanged — G-4 #1 API half);
               * preview + promote into folder X (nested) → 201 ``saved``, ``documents.folder_id``
                 == X, ``library-links`` carries the mark; wait for ``completed``;
               * D-14: a same-named, different-bytes PDF → preview reads ``next_version 2`` and
                 ``duplicate_of null``; promote → version 2, version 1 stays (``is_latest`` false);
               * D-13: the ORIGINAL bytes from a SECOND thread into folder Y → preview names X in
                 ``duplicate_of``; promote → 200 ``already`` with ``folder_id`` X;
               * D-08 / D-11: ``storage.objects`` under ``<uid>/<thread>/`` > 0 before the thread
                 delete and 0 after (asserted on the table, never on ``remove()``'s return); the
                 Library copy still exists in X and downloads byte-identical via its signed URL.

  --fixtures DIR
             Write the Chrome-drive fixtures (fresh planted tokens, distinct bytes from the probe):
             a small PDF with a planted sentence (G-4 #1/#2), a > 256 KB PDF (G-4 #4), and a
             same-named different-bytes PDF in ``DIR/v2/`` (G-4 #3's version warning). Prints the
             tokens + sha256s.

Usage (backend venv, repo root; the operator runs uvicorn):
    backend/venv/Scripts/python.exe scripts/run-274-board.py --roster
    backend/venv/Scripts/python.exe scripts/run-274-board.py --run [--providers openai,google]
    backend/venv/Scripts/python.exe scripts/run-274-board.py --promote-probe
    backend/venv/Scripts/python.exe scripts/run-274-board.py --fixtures <dir>
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import secrets
import sys
import time
from pathlib import Path

try:  # ⛔ / ✅ in the output — never let a cp1252 console kill the run
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

_REPO = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("run_273_board", _REPO / "scripts" / "run-273-board.py")
b273 = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(b273)  # also puts scripts/ and backend/ on sys.path

import conc_probe as kit  # noqa: E402

_PHASE_DIR = _REPO / ".planning" / "phases" / "274-thread-scoped-attachments"
_EVIDENCE = _PHASE_DIR / "evidence"

QUESTION = "What is the Meridian freight-cap clearance code in the file I attached?"
FACT_LINE = "The Meridian freight-cap clearance code is {token}."
BUCKET = "workspace-files"

# Probe folders (G-4 #3/#4 API half). Chosen from the dev user's existing tree by PATH and
# re-resolved at run time, so a missing folder fails loud instead of promoting somewhere else.
PROBE_FOLDER_X = ("Client ACME", "Q3 Contracts")
PROBE_FOLDER_Y = ("Engineering",)


# ── fixtures ────────────────────────────────────────────────────────────────────────────────────

def make_pdf(lines: list[str], *, min_bytes: int = 0, seed: str = "") -> bytes:
    """A text PDF (reportlab, uncompressed so ``min_bytes`` is reachable with plain text)."""
    from reportlab.lib.pagesizes import A4  # noqa: PLC0415
    from reportlab.pdfgen import canvas  # noqa: PLC0415

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4, pageCompression=0, invariant=1)
    c.setTitle(f"274 fixture {seed}")

    def page(text_lines: list[str]) -> None:
        y = 800
        c.setFont("Helvetica", 9)
        for ln in text_lines:
            c.drawString(40, y, ln[:120])
            y -= 12
        c.showPage()

    page(lines)
    n = 0
    filler = ("Section {p}.{i}: shipping schedules, carrier allocations and lane capacity notes for the "
              "quarter; figures are indicative and subject to the master agreement. ref {seed}-{p}-{i}")
    while min_bytes and len(buf.getvalue()) < min_bytes:
        n += 1
        page([filler.format(p=n, i=i, seed=seed) for i in range(60)])
        if n > 400:
            break
    c.save()
    data = buf.getvalue()
    if min_bytes and len(data) < min_bytes:
        raise SystemExit(f"fixture PDF only {len(data)} bytes < {min_bytes}")
    return data


def _token(provider: str) -> str:
    return f"ATT274-{provider}-{secrets.token_hex(4)}"


def write_fixtures(out_dir: str) -> int:
    d = Path(out_dir)
    (d / "v2").mkdir(parents=True, exist_ok=True)
    t_small, t_big = _token("chrome"), _token("keeper")
    small = make_pdf(["Meridian supplier brief (Phase 274 G-4 fixture).", "",
                      FACT_LINE.format(token=t_small),
                      "Unique word for the document-search negative: quillfeather" + t_small[-8:] + "."],
                     seed=t_small)
    big = make_pdf(["Meridian keeper file (Phase 274 G-4 #4 fixture).", "", FACT_LINE.format(token=t_big)],
                   min_bytes=300 * 1024, seed=t_big)
    v2 = make_pdf(["Meridian supplier brief — REVISED (different bytes, same name).", "",
                   "Revision marker " + secrets.token_hex(6)], seed="v2")
    files = {"274-g4-meridian-brief.pdf": small, "274-g4-keeper.pdf": big}
    for name, data in files.items():
        (d / name).write_bytes(data)
    (d / "v2" / "274-g4-meridian-brief.pdf").write_bytes(v2)
    print(f"FIXTURES dir={d.resolve()}")
    for p, data in ((d / "274-g4-meridian-brief.pdf", small), (d / "274-g4-keeper.pdf", big),
                    (d / "v2" / "274-g4-meridian-brief.pdf", v2)):
        print(f"FIXTURE {p.resolve()} bytes={len(data)} sha256={hashlib.sha256(data).hexdigest()}")
    print(f"FIXTURE planted token (brief) = {t_small} · unique word = quillfeather{t_small[-8:]}")
    print(f"FIXTURE planted token (keeper) = {t_big}")
    return 0


# ── shared helpers ──────────────────────────────────────────────────────────────────────────────

def _new_thread(base, h, title) -> str:
    t = kit._requests().post(f"{base}/threads", headers=h, timeout=15, json={"title": title})
    t.raise_for_status()
    return t.json()["id"]


def _upload(base, h, thread_id, name, data: bytes, mime: str) -> tuple[int, dict]:
    r = kit._requests().post(f"{base}/threads/{thread_id}/workspace/files", params={"lifetime": "thread"},
                             headers=h, timeout=60, files={"file": (name, data, mime)})
    try:
        body = r.json()
    except ValueError:
        body = {"raw": r.text[:300]}
    return r.status_code, body


def _ws_rows(conn, thread_id) -> list[dict]:
    return kit._fetchall(conn, "SELECT id::text AS id, path, kind, expires_at, size_bytes, content_storage_path, "
                               "library_document_id::text AS library_document_id, library_link "
                               "FROM workspace_files WHERE thread_id = %s ORDER BY created_at", (thread_id,))


def _storage_count(conn, user_id, thread_id) -> int:
    row = kit._fetchone(conn, "SELECT count(*) AS n FROM storage.objects WHERE bucket_id = %s AND name LIKE %s",
                        (BUCKET, f"{user_id}/{thread_id}/%"))
    return int(row["n"])


def _docs_count(conn, user_id) -> int:
    return int(kit._fetchone(conn, "SELECT count(*) AS n FROM documents WHERE user_id = %s", (user_id,))["n"])


def _watches_count(conn, user_id) -> int:
    return int(kit._fetchone(conn, "SELECT count(*) AS n FROM connector_watches WHERE user_id = %s", (user_id,))["n"])


def _token_in_library(conn, token) -> int:
    row = kit._fetchone(conn, "SELECT count(*) AS n FROM documents WHERE filename ILIKE %s OR id IN "
                              "(SELECT document_id FROM document_chunks WHERE content ILIKE %s)",
                        (f"%{token}%", f"%{token}%"))
    return int(row["n"])


def _search(base, h, name) -> tuple[int, int | None]:
    r = kit._requests().post(f"{base}/document-search", headers=h, timeout=30, json={"name": name})
    if r.status_code != 200:
        return r.status_code, None
    return 200, r.json().get("total")


def _turn(conn, base, h, thread_id, entry, timeout) -> dict:
    run_id, err = b273._send(base, h, thread_id, QUESTION, entry["model"], entry["provider"])
    if not run_id:
        return {"error": err}
    status = b273._wait_run(conn, run_id, timeout)
    run = kit._fetchone(conn, "SELECT status, model, provider, error, started_at, completed_at FROM runs "
                              "WHERE run_id = %s", (run_id,))
    msgs = b273._run_messages(conn, thread_id, run["started_at"], None)
    calls = [tc for m in msgs for tc in (m["tool_calls"] or [])]
    return {
        "run_id": run_id, "run_status": status,
        "run": {k: (str(v) if v is not None else None) for k, v in (run or {}).items()},
        "assistant_messages": [{"id": m["id"], "content": m["content"]} for m in msgs],
        "tool_call_names": [tc.get("name") for tc in calls],
        "final": (msgs[-1]["content"] or "").strip() if msgs else "",
    }


# ── --run ───────────────────────────────────────────────────────────────────────────────────────

def run_board(token: str, org_id: str, user_id: str, conn, args) -> int:
    import sc10_188_run_board as sc10  # noqa: PLC0415

    base = kit.base_url()
    h = b273._headers(token, org_id)
    roster, settings = b273.derive_roster(conn)
    probe = sc10.probe_keys([r for r in roster if not r.get("derive_blocked")], settings)
    wanted = set(filter(None, args.providers.split(","))) if args.providers else None
    out = _EVIDENCE / args.out
    out.mkdir(parents=True, exist_ok=True)
    docs_before, watches_before = _docs_count(conn, user_id), _watches_count(conn, user_id)
    print(f"BOARD documents(user) before = {docs_before} · connector_watches(user) before = {watches_before}")

    table = []
    for entry in roster:
        pid = entry["provider"]
        row = {"provider": pid, "model": entry["model"], "required": entry["required"],
               "calling_mode": entry.get("calling_mode")}
        if entry.get("derive_blocked"):
            row["blocked"] = entry["derive_blocked"]
        elif not entry["required"] and not (wanted and pid in wanted):
            row["blocked"] = "extra (self-hosted) group — not one of the required 8; not driven unless named in --providers"
        elif wanted and pid not in wanted:
            continue
        elif not probe[pid]["has_key"]:
            row["blocked"] = "no API key configured (override_provider returned settings unchanged)"
        if row.get("blocked"):
            table.append(row)
            print(f"BOARD {pid} ⛔ {row['blocked']}")
            (out / f"{pid}-blocked.json").write_text(json.dumps(row, indent=2, default=str), encoding="utf-8")
            continue

        tok = _token(pid)
        fname = f"meridian-clearance-{pid}.md"
        body = f"# Meridian supplier note\n\n{FACT_LINE.format(token=tok)}\n"
        thread_a = _new_thread(base, h, f"274 board {pid} A")
        code, up = _upload(base, h, thread_a, fname, body.encode("utf-8"), "text/markdown")
        ws = _ws_rows(conn, thread_a)
        d05 = (code in (200, 201) and len(ws) == 1 and ws[0]["expires_at"] is None
               and ws[0]["kind"] == "template_input")
        a = _turn(conn, base, h, thread_a, entry, args.timeout) if code in (200, 201) else {"error": f"upload HTTP {code}: {up}"}
        a_text = "\n".join((m["content"] or "") for m in a.get("assistant_messages", []))
        v_answer = tok in a_text

        thread_b = _new_thread(base, h, f"274 board {pid} B (negative)")
        b = _turn(conn, base, h, thread_b, entry, args.timeout)
        b_text = "\n".join((m["content"] or "") for m in b.get("assistant_messages", []))
        v_second = (b.get("run_status") is not None and not b.get("error")) and tok not in b_text
        s_code, s_total = _search(base, h, tok)
        lib_rows = _token_in_library(conn, tok)

        row.update({
            "token": tok, "thread_a": thread_a, "thread_b": thread_b,
            "upload_http": code, "d05": "PASS" if d05 else "FAIL",
            "ws_row": {k: (str(v) if v is not None else None) for k, v in (ws[0] if ws else {}).items()},
            "answer": "PASS" if v_answer else "FAIL", "run_a_status": a.get("run_status"),
            "a_tools": a.get("tool_call_names"), "a_final": (a.get("final") or a.get("error") or "")[:400],
            "second_thread": "PASS" if v_second else "FAIL", "run_b_status": b.get("run_status"),
            "b_tools": b.get("tool_call_names"), "b_final": (b.get("final") or b.get("error") or "")[:400],
            "search_http": s_code, "search_total": s_total,
            "search_neg": "PASS" if (s_code == 200 and s_total == 0) else "FAIL",
            "library_rows_with_token": lib_rows, "db_neg": "PASS" if lib_rows == 0 else "FAIL",
        })
        (out / f"{pid}-{a.get('run_id') or 'nosend'}.json").write_text(json.dumps({
            "provider": pid, "model": entry["model"], "calling_mode_predicted": entry.get("calling_mode"),
            "file": {"name": fname, "body": body}, "question": QUESTION, "verdicts": {
                k: row[k] for k in ("d05", "answer", "second_thread", "search_neg", "db_neg")},
            "row": row, "turn_a": a, "turn_b": b, "upload_response": up,
        }, indent=2, default=str), encoding="utf-8")
        print(f"BOARD {pid} {entry['model']} D05={row['d05']} ANSWER={row['answer']} "
              f"SECOND={row['second_thread']} SEARCH={row['search_neg']}(total={s_total}) DB={row['db_neg']} "
              f"A={a.get('run_status')} tools={a.get('tool_call_names')} B={b.get('run_status')} "
              f"threads={thread_a},{thread_b}")
        table.append(row)

    docs_after, watches_after = _docs_count(conn, user_id), _watches_count(conn, user_id)
    print(f"BOARD documents(user) after = {docs_after} (delta {docs_after - docs_before}) · "
          f"connector_watches(user) after = {watches_after} (delta {watches_after - watches_before})")
    (out / "board-summary.json").write_text(json.dumps({
        "rows": table, "documents_before": docs_before, "documents_after": docs_after,
        "watches_before": watches_before, "watches_after": watches_after,
    }, indent=2, default=str), encoding="utf-8")
    print("\nBOARD_TABLE")
    print("| Provider | Model (derived) | Mode (predicted) | D-05 row | Planted fact answered | 2nd-thread negative | "
          "document-search negative | DB negative | Tools (thread A) |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in table:
        if r.get("blocked"):
            print(f"| {r['provider']} | {r['model']} | {r.get('calling_mode') or '—'} | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | {r['blocked']} |")
        else:
            print(f"| {r['provider']} | {r['model']} | {r['calling_mode']} | {r['d05']} | {r['answer']} | "
                  f"{r['second_thread']} | {r['search_neg']} | {r['db_neg']} | {', '.join(r['a_tools'] or []) or '—'} |")
    return 0


# ── --promote-probe ─────────────────────────────────────────────────────────────────────────────

def _folder_by_path(conn, user_id, parts: tuple[str, ...]) -> str:
    parent = None
    fid = None
    for name in parts:
        sql = ("SELECT id::text AS id FROM folders WHERE user_id = %s AND name = %s AND "
               + ("parent_id IS NULL" if parent is None else "parent_id = %s"))
        params = (user_id, name) if parent is None else (user_id, name, parent)
        rows = kit._fetchall(conn, sql, params)
        if len(rows) != 1:
            raise SystemExit(f"folder path {' / '.join(parts)} not uniquely resolvable at {name!r} ({len(rows)})")
        fid = parent = rows[0]["id"]
    return fid


def _wait_doc(conn, doc_id, timeout=600) -> str | None:
    deadline, status = time.time() + timeout, None
    while time.time() < deadline:
        status = (kit._fetchone(conn, "SELECT status FROM documents WHERE id = %s", (doc_id,)) or {}).get("status")
        if status in ("completed", "failed"):
            return status
        time.sleep(3)
    return status


def promote_probe(token: str, org_id: str, user_id: str, conn, args) -> int:
    req = kit._requests()
    base = kit.base_url()
    h = b273._headers(token, org_id)
    out = _EVIDENCE / "g4-api"
    out.mkdir(parents=True, exist_ok=True)
    log: dict = {"user_id": user_id, "org_id": org_id}

    def note(key, value):
        log[key] = value
        print(f"PROBE {key} = {json.dumps(value, default=str)}")

    fx, fy = _folder_by_path(conn, user_id, PROBE_FOLDER_X), _folder_by_path(conn, user_id, PROBE_FOLDER_Y)
    note("folder_X", {"path": " / ".join(PROBE_FOLDER_X), "id": fx})
    note("folder_Y", {"path": " / ".join(PROBE_FOLDER_Y), "id": fy})

    tok = _token("probe")
    name = "274-g4-api-keeper.pdf"
    big = make_pdf(["Meridian keeper file (Phase 274 API probe).", "", FACT_LINE.format(token=tok)],
                   min_bytes=300 * 1024, seed=tok)
    v2 = make_pdf(["Meridian keeper file — REVISED (same name, different bytes).", "",
                   "Revision " + secrets.token_hex(6)], seed=tok + "v2")
    note("fixture", {"name": name, "bytes": len(big), "sha256": hashlib.sha256(big).hexdigest(), "token": tok,
                     "v2_bytes": len(v2), "v2_sha256": hashlib.sha256(v2).hexdigest()})

    # ── G-4 #1 API half: attach writes no Library row ──
    t1 = _new_thread(base, h, "274 G-4 API probe T1 (keeper)")
    docs0, watches0 = _docs_count(conn, user_id), _watches_count(conn, user_id)
    code, up = _upload(base, h, t1, name, big, "application/pdf")
    docs1 = _docs_count(conn, user_id)
    ws = _ws_rows(conn, t1)
    note("attach", {"thread": t1, "http": code, "documents_before": docs0, "documents_after": docs1,
                    "ws_row": {k: (str(v) if v is not None else None) for k, v in ws[0].items()} if ws else None})
    if code not in (200, 201) or not ws:
        raise SystemExit("attach failed")
    f1 = ws[0]["id"]
    s_code, s_total = _search(base, h, tok)
    note("search_after_attach", {"http": s_code, "total": s_total, "library_rows_with_token": _token_in_library(conn, tok)})

    # ── G-4 #3: preview + promote into X ──
    r = req.get(f"{base}/threads/{t1}/workspace/files/{f1}/promote-preview", headers=h, params={"folder_id": fx}, timeout=60)
    note("preview_X", {"http": r.status_code, "body": r.json()})
    r = req.post(f"{base}/threads/{t1}/workspace/files/{f1}/promote", headers=h, json={"folder_id": fx}, timeout=120)
    promoted = r.json()
    note("promote_X", {"http": r.status_code, "body": promoted})
    doc_id = promoted.get("document_id")
    drow = kit._fetchone(conn, "SELECT id::text AS id, folder_id::text AS folder_id, filename, status, version_number, "
                               "is_latest FROM documents WHERE id = %s", (doc_id,))
    note("document_row", drow)
    note("folder_matches_X", drow and drow["folder_id"] == fx)
    r = req.get(f"{base}/threads/{t1}/workspace/library-links", headers=h, timeout=30)
    note("library_links_after_promote", {"http": r.status_code, "body": r.json()})
    note("ws_mark", {k: (str(v) if v is not None else None) for k, v in _ws_rows(conn, t1)[0].items()})
    status = _wait_doc(conn, doc_id)
    note("document_status_after_wait", status)
    r = req.get(f"{base}/threads/{t1}/workspace/library-links", headers=h, timeout=30)
    note("library_links_after_completed", {"http": r.status_code, "body": r.json()})

    # ── D-14: same name, different bytes → version 2 ──
    code, _ = _upload(base, h, t1, name, v2, "application/pdf")
    f2 = [w for w in _ws_rows(conn, t1) if w["id"] != f1][0]["id"]
    r = req.get(f"{base}/threads/{t1}/workspace/files/{f2}/promote-preview", headers=h, params={"folder_id": fx}, timeout=60)
    note("preview_v2_X", {"upload_http": code, "http": r.status_code, "body": r.json()})
    r = req.post(f"{base}/threads/{t1}/workspace/files/{f2}/promote", headers=h, json={"folder_id": fx}, timeout=120)
    p2 = r.json()
    note("promote_v2_X", {"http": r.status_code, "body": p2})
    note("versions_in_X", kit._fetchall(conn, "SELECT id::text AS id, version_number, is_latest, status FROM documents "
                                              "WHERE user_id = %s AND folder_id = %s AND filename = %s ORDER BY version_number",
                                        (user_id, fx, name)))

    # ── D-13: the ORIGINAL bytes from a second thread into Y → already, names X ──
    t2 = _new_thread(base, h, "274 G-4 API probe T2 (already)")
    code, _ = _upload(base, h, t2, name, big, "application/pdf")
    g1 = _ws_rows(conn, t2)[0]["id"]
    r = req.get(f"{base}/threads/{t2}/workspace/files/{g1}/promote-preview", headers=h, params={"folder_id": fy}, timeout=60)
    note("preview_original_Y", {"thread": t2, "upload_http": code, "http": r.status_code, "body": r.json()})
    r = req.post(f"{base}/threads/{t2}/workspace/files/{g1}/promote", headers=h, json={"folder_id": fy}, timeout=120)
    note("promote_original_Y", {"http": r.status_code, "body": r.json()})
    note("documents_in_Y_with_name", kit._fetchone(conn, "SELECT count(*) AS n FROM documents WHERE user_id = %s AND "
                                                         "folder_id = %s AND filename = %s", (user_id, fy, name))["n"])

    # ── G-4 #4: delete T1 and T2; bytes go, the keeper stays ──
    for label, tid in (("T1", t1), ("T2", t2)):
        before = _storage_count(conn, user_id, tid)
        r = req.delete(f"{base}/threads/{tid}", headers=h, timeout=60)
        time.sleep(1)
        after = _storage_count(conn, user_id, tid)
        rows_after = int(kit._fetchone(conn, "SELECT count(*) AS n FROM workspace_files WHERE thread_id = %s", (tid,))["n"])
        note(f"delete_{label}", {"thread": tid, "storage_objects_before": before, "http": r.status_code,
                                 "storage_objects_after": after, "workspace_files_after": rows_after})
    keeper = kit._fetchone(conn, "SELECT id::text AS id, folder_id::text AS folder_id, status, filename, is_latest "
                                 "FROM documents WHERE id = %s", (doc_id,))
    note("keeper_after_delete", keeper)
    r = req.post(f"{base}/documents/{doc_id}/download-url", headers=h, timeout=30)
    dl = {"http": r.status_code}
    if r.status_code == 200:
        url = r.json()["url"]
        g = req.get(url, timeout=60)
        dl.update({"get_http": g.status_code, "bytes": len(g.content), "sha256": hashlib.sha256(g.content).hexdigest(),
                   "equals_original": g.content == big})
    note("keeper_download", dl)
    note("watches_unchanged", {"before": watches0, "after": _watches_count(conn, user_id)})

    (out / f"promote-probe-{tok}.json").write_text(json.dumps(log, indent=2, default=str), encoding="utf-8")
    print(f"PROBE evidence → {out / f'promote-probe-{tok}.json'}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--roster", action="store_true")
    g.add_argument("--run", action="store_true")
    g.add_argument("--promote-probe", action="store_true")
    g.add_argument("--fixtures", metavar="DIR")
    ap.add_argument("--providers", default="")
    ap.add_argument("--timeout", type=int, default=420)
    ap.add_argument("--out", default="board", help="evidence subdirectory (default 'board')")
    args = ap.parse_args()
    if args.fixtures:
        return write_fixtures(args.fixtures)
    kit.load_env()
    kit.assert_localhost_only()
    b273._assert_local_db()
    conn = kit.connect_db()
    conn.autocommit = True
    if args.roster:
        b273.derive_roster(conn)
        return 0
    token = kit.get_bearer_token()
    user_id = b273._user_id(token)
    org_id = b273._single_org(conn, user_id)
    print(f"dev user {user_id} · single org {org_id} (asserted from org_members)")
    if args.promote_probe:
        return promote_probe(token, org_id, user_id, conn, args)
    return run_board(token, org_id, user_id, conn, args)


if __name__ == "__main__":
    sys.exit(main())
