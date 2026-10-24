"""run-292-board.py — Phase 292 (292-03) SC#10 cross-provider board for the three new artifact types (D-26).

Reuses run-273-board.py's helpers (loaded with importlib: the filename has hyphens) — the roster
derivation, the local-DB assertion, the per-request model + provider turn driver and the reload
reader — so this board measures exactly what 273's did, for diagram / comparison / timeline.

Every mode runs against the LOCAL stack only: ``conc_probe.assert_localhost_only`` and
``_assert_local_db`` (127.0.0.1 / localhost DSN and Redis) run before any request or DB write.
The operator runs uvicorn; this script never starts or stops it.

  --roster         Print the effective roster derivation (run-273's ``derive_roster``) and exit.
  --seed           As the dev user (real JWT, explicit X-Org-Id after asserting ONE org), upload the
                   three generated fixtures idempotently by filename, wait for ``completed``, then
                   assert the REAL ``retrieval_service.search_documents`` returns each one.
  --run            Per derived row: a fresh thread, ONE turn asking for a diagram, a comparison and a
                   timeline (per-request model + provider; no setting mutated). Verdicts per type:
                     V1 emitted   a ``show_artifact`` call, status done, not refused, whose result
                                  names an artifact id that IS a ``message_artifacts`` row of that
                                  component carrying this run's ``run_id``.
                     V2 rendered  (backend half) GET /threads/{id}/messages returns that record (never
                                  ``{missing: true}``) and the reload count equals the thread's rows;
                                  the frontend-guard half is ``frontend/uat/292-board-render.test.ts``.
                   Plus observations: elements carrying a resolved source, refusal reasons verbatim.
  --long           The same turn on ONE row with a >= 5 KB prompt (the three fixtures inlined).
  --parallel       Thread A's board turn and thread B's timeline turn sent back to back (B while A
                   streams); each run's artifacts must land in its own thread.
  --reload-check   For every board evidence file: GET the thread's messages again and compare each
                   artifact's spec + caption + label byte-for-byte with the first reload and the DB.
  --refusal-probe  Call ``handle_show_artifact`` directly (real local pool, insert patched to raise):
                   component ``mindmap``, ``flowchart``, and a diagram ``from_artifact`` a stored table.
  --craft-bad-row  Under the local-DB lock: a dedicated thread for the dev user with one assistant
                   message whose done ``show_artifact`` call names a diagram row whose spec has an
                   edge to a missing node ``zz`` (satisfies migration 213's CHECKs). Prints the ids.

Usage (backend venv, repo root):
    backend/venv/Scripts/python.exe scripts/run-292-board.py --roster
    backend/venv/Scripts/python.exe scripts/run-292-board.py --seed
    backend/venv/Scripts/python.exe scripts/run-292-board.py --run [--providers openai,google]
    backend/venv/Scripts/python.exe scripts/run-292-board.py --long --providers openai
"""
from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import os
import re
import secrets
import sys
import time
from pathlib import Path
from types import SimpleNamespace

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO / "scripts"))
sys.path.insert(0, str(_REPO / "backend"))

import conc_probe as kit  # noqa: E402

_spec = importlib.util.spec_from_file_location("run_273_board", _REPO / "scripts" / "run-273-board.py")
b273 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(b273)  # type: ignore[union-attr]

_PHASE_DIR = _REPO / ".planning" / "phases" / "292-more-ways-to-show-it"
_EVIDENCE = _PHASE_DIR / "evidence"
_FIXTURES = _EVIDENCE / "fixtures"
_LOCK = Path(os.getenv("LOCALAPPDATA", "C:/Users/fhdmr/AppData/Local")) / "Temp" / "agentic-rag-localdb.lock"
LOCAL_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

FIXTURES = ("292-invoice-approval-policy.md", "292-atlas-msa.md", "292-borealis-msa.md")
SEED_QUERIES = {
    "292-invoice-approval-policy.md": "invoice approval three-way match budget holder finance controller",
    "292-atlas-msa.md": "Atlas Logistics termination liability renewal notice deadline",
    "292-borealis-msa.md": "Borealis Freight termination liability cap",
}
NEW_TYPES = ("diagram", "comparison", "timeline")

BOARD_PROMPT = (
    "Using our documents: show how invoice approval works as a flow diagram; compare the Atlas and "
    "Borealis contracts on termination, liability and renewal; and show the Atlas contract's history "
    "and upcoming deadlines as a timeline."
)
PARALLEL_B_PROMPT = "Using our documents, show the Atlas contract's history and upcoming deadlines as a timeline."


def _local_dsn() -> str:
    dsn = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_DSN") or kit.DEFAULT_DB_URL
    if not re.search(r"@(127\.0\.0\.1|localhost):", dsn):
        raise SystemExit("REFUSING: the DB DSN is not 127.0.0.1/localhost (T-292-20)")
    return dsn


def _fixture_text(name: str) -> str:
    return (_FIXTURES / name).read_text(encoding="utf-8")


def long_prompt() -> str:
    parts = ["Here are three of our documents, inlined in full.\n"]
    for name in FIXTURES:
        parts.append(f"\n----- {name} -----\n{_fixture_text(name)}")
    parts.append("\n----- end of documents -----\n\n" + BOARD_PROMPT)
    text = "".join(parts)
    pad = 0
    while len(text.encode("utf-8")) < 5120:  # long-message axis: >= 5 KB
        pad += 1
        text = text.replace("\n----- end of documents -----",
                            f"\n(Atlas contract, repeated for reference, copy {pad})\n{_fixture_text('292-atlas-msa.md')}"
                            "\n----- end of documents -----", 1)
    return text


# ── --seed ──────────────────────────────────────────────────────────────────────────────────────

def seed(token: str, org_id: str, user_id: str, conn) -> int:
    requests = kit._requests()
    base = kit.base_url()
    h = b273._headers(token, org_id)
    ok_all = True
    for name in FIXTURES:
        row = kit._fetchone(conn, "SELECT id::text AS id, status FROM documents WHERE user_id = %s AND filename = %s "
                                  "AND is_latest = true ORDER BY created_at DESC LIMIT 1", (user_id, name))
        if row:
            doc_id = row["id"]
            print(f"SEED {name} exists id={doc_id} status={row['status']}")
        else:
            r = requests.post(f"{base}/documents/upload", headers=h, timeout=60,
                              files={"file": (name, _fixture_text(name).encode("utf-8"), "text/markdown")})
            print(f"SEED upload {name} HTTP {r.status_code}")
            r.raise_for_status()
            doc_id = r.json()["id"]
        deadline = time.time() + 300
        status = None
        while time.time() < deadline:
            status = (kit._fetchone(conn, "SELECT status FROM documents WHERE id = %s", (doc_id,)) or {}).get("status")
            if status in ("completed", "failed"):
                break
            time.sleep(2)
        chunks = (kit._fetchone(conn, "SELECT count(*) AS n FROM document_chunks WHERE document_id = %s", (doc_id,)) or {}).get("n")
        print(f"SEED {name} status={status} chunks={chunks}")
        ok_all = ok_all and status == "completed"

    from app.dependencies import get_supabase  # noqa: PLC0415
    from app.models.user_settings import load_user_settings  # noqa: PLC0415
    from app.services.retrieval_service import search_documents  # noqa: PLC0415
    sb = get_supabase()
    us = load_user_settings(user_id, sb)
    for name, query in SEED_QUERIES.items():
        rows, avg = asyncio.run(search_documents(query, user_id, sb, user_settings=us))
        names = [str(r.get("filename") or r.get("document_name") or "") for r in rows]
        found = name in names
        print(f"SEED search_documents({query!r}) -> {len(rows)} chunks · top files {names[:4]} · finds {name}: {found}")
        ok_all = ok_all and found
    print(f"SEED verdict: {'OK' if ok_all else 'FAIL'}")
    return 0 if ok_all else 1


# ── --run / --long ──────────────────────────────────────────────────────────────────────────────

def _artifacts_full(conn, thread_id: str) -> list[dict]:
    return kit._fetchall(conn, "SELECT id, label, component, parent_id, run_id::text AS run_id, tool_call_id, "
                               "row_count, spec, caption, thread_id::text AS thread_id, created_at::text AS at "
                               "FROM message_artifacts WHERE thread_id = %s ORDER BY created_at", (thread_id,))


def _sourced_count(component: str, spec: dict) -> tuple[int, int]:
    enc = (spec or {}).get(component) or {}
    if component == "diagram":
        items = enc.get("nodes") or []
    elif component == "comparison":
        items = [c for t in (enc.get("terms") or []) for c in (t.get("cells") or [])]
    else:
        items = enc.get("events") or []
    return sum(1 for x in items if isinstance(x, dict) and x.get("source")), len(items)


def _score(turn: dict, arts: list[dict], reload_items: list, reload_code: int) -> dict:
    from app.models.artifact import is_refusal_result  # noqa: PLC0415
    from app.services.artifact_history import _artifact_id  # noqa: PLC0415

    run_id = turn.get("run_id")
    calls = [tc for m in turn.get("assistant_messages", []) for tc in (m.get("tool_calls") or [])]
    show = [tc for tc in calls if tc.get("name") == "show_artifact"]
    refusals = []
    for tc in show:
        if is_refusal_result(tc.get("result")):
            try:
                obj = json.loads(tc.get("result"))
            except (TypeError, ValueError):
                obj = {"raw": str(tc.get("result"))[:300]}
            refusals.append({"component": (tc.get("args") or {}).get("component"), "reason": obj.get("reason"),
                             "detail": obj.get("detail")})
    ok_ids = {_artifact_id(tc.get("result")) for tc in show
              if tc.get("status") == "done" and not is_refusal_result(tc.get("result"))}
    ok_ids.discard(None)
    by_id = {a["id"]: a for a in arts}
    reload_by_id = {x.get("id"): x for x in reload_items if isinstance(x, dict)}
    missing = [x for x in reload_items if not isinstance(x, dict) or x.get("missing") or "id" not in x]
    per_type = {}
    for comp in NEW_TYPES:
        rows = [a for a in arts if a["component"] == comp and a["run_id"] == run_id and a["id"] in ok_ids]
        v1 = bool(rows) and turn.get("run_status") == "completed"
        v2 = (v1 and reload_code == 200 and not missing and len(reload_items) == len(arts)
              and all(r["id"] in reload_by_id and not reload_by_id[r["id"]].get("missing") for r in rows))
        sourced = [_sourced_count(comp, r["spec"]) for r in rows]
        per_type[comp] = {
            "v1": "PASS" if v1 else "FAIL", "v2_backend": "PASS" if v2 else "FAIL",
            "artifact_ids": [r["id"] for r in rows], "labels": [r["label"] for r in rows],
            "sourced_elements": [f"{a}/{b}" for a, b in sourced],
        }
    return {
        "per_type": per_type,
        "tool_call_names": [tc.get("name") for tc in calls],
        "search_documents_calls": sum(1 for tc in calls if tc.get("name") == "search_documents"),
        "show_artifact_calls": len(show), "refusals": refusals,
        "artifact_rows": len(arts), "reload_records": len(reload_items), "reload_missing": len(missing),
        "other_components": sorted({a["component"] for a in arts if a["component"] not in NEW_TYPES}),
    }


def _drive_row(conn, base, h, entry, prompt, timeout, title) -> dict:
    t = kit._requests().post(f"{base}/threads", headers=h, timeout=15, json={"title": title})
    t.raise_for_status()
    thread_id = t.json()["id"]
    turn = b273._drive_turn(conn, base, h, thread_id, prompt, entry, timeout)
    arts = _artifacts_full(conn, thread_id)
    code, reload_items, by_msg = b273._reload(base, h, thread_id)
    score = _score(turn, arts, reload_items, code) if turn.get("run_id") else {"error": turn.get("error")}
    return {"thread_id": thread_id, "turn": turn, "arts": arts, "reload_code": code,
            "reload_items": reload_items, "by_msg": by_msg, "score": score}


def _roster_rows(conn, args):
    import sc10_188_run_board as sc10  # noqa: PLC0415
    roster, settings = b273.derive_roster(conn)
    probe = sc10.probe_keys([r for r in roster if not r.get("derive_blocked")], settings)
    wanted = set(filter(None, args.providers.split(","))) if args.providers else None
    return roster, probe, wanted


def _blocked_reason(entry, probe, wanted) -> str | None:
    pid = entry["provider"]
    if entry.get("derive_blocked"):
        return entry["derive_blocked"]
    if not entry["required"] and not (wanted and pid in wanted):
        return "extra (self-hosted) group — not one of the required 8; not driven unless named in --providers"
    if not probe[pid]["has_key"]:
        return "no API key configured (override_provider returned settings unchanged)"
    return None


def _write_evidence(out: Path, name: str, entry: dict, prompt: str, res: dict) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    p = out / name
    p.write_text(json.dumps({
        "provider": entry["provider"], "model": entry["model"], "thread_id": res["thread_id"],
        "prompt_bytes": len(prompt.encode("utf-8")), "prompt": prompt if len(prompt) < 600 else prompt[:600] + "…",
        "calling_mode_predicted": entry.get("calling_mode"), "score": res["score"],
        "turn_data": res["turn"], "message_artifacts": res["arts"],
        "reload_http": res["reload_code"], "reload_artifacts": res["reload_items"], "reload_by_message": res["by_msg"],
    }, indent=2, default=str), encoding="utf-8")
    return p


def _print_row(entry, res):
    s = res["score"]
    if "per_type" not in s:
        print(f"BOARD {entry['provider']} {entry['model']} ERROR {s.get('error')} thread={res['thread_id']}")
        return
    pt = s["per_type"]
    cells = " ".join(f"{c}=V1:{pt[c]['v1']}/V2:{pt[c]['v2_backend']}/src:{pt[c]['sourced_elements']}" for c in NEW_TYPES)
    print(f"BOARD {entry['provider']} {entry['model']} run={res['turn'].get('run_status')} {cells} "
          f"search_documents={s['search_documents_calls']} show_artifact={s['show_artifact_calls']} "
          f"refusals={s['refusals']} thread={res['thread_id']}")


def run_board(token, org_id, conn, args) -> int:
    base = kit.base_url()
    h = b273._headers(token, org_id)
    roster, probe, wanted = _roster_rows(conn, args)
    out = _EVIDENCE / args.out
    table = []
    for entry in roster:
        pid = entry["provider"]
        if wanted and pid not in wanted and entry["required"]:
            continue
        reason = _blocked_reason(entry, probe, wanted)
        row = {"provider": pid, "model": entry["model"], "required": entry["required"],
               "calling_mode": entry.get("calling_mode")}
        if reason:
            row["blocked"] = reason
            print(f"BOARD {pid} ⛔ {reason}")
            table.append(row)
            continue
        res = _drive_row(conn, base, h, entry, BOARD_PROMPT, args.timeout, f"292 board {pid}")
        rid = res["turn"].get("run_id") or "nosend"
        row.update({"thread_id": res["thread_id"], "run_id": rid, "run_status": res["turn"].get("run_status"),
                    "score": res["score"],
                    "evidence": str(_write_evidence(out, f"{pid}-{rid}.json", entry, BOARD_PROMPT, res).relative_to(_REPO))})
        _print_row(entry, res)
        table.append(row)
    (_EVIDENCE / f"{args.out}-summary.json").write_text(json.dumps(table, indent=2, default=str), encoding="utf-8")
    print("\nBOARD_TABLE")
    print("| Provider | Model (derived) | Mode | diagram V1/V2 | comparison V1/V2 | timeline V1/V2 | sourced d/c/t | search calls | refusals |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in table:
        if r.get("blocked"):
            print(f"| {r['provider']} | {r['model']} | {r.get('calling_mode') or '—'} | ⛔ | ⛔ | ⛔ | — | — | {r['blocked']} |")
            continue
        s = r["score"]
        if "per_type" not in s:
            print(f"| {r['provider']} | {r['model']} | {r['calling_mode']} | ERROR | ERROR | ERROR | — | — | {s.get('error')} |")
            continue
        pt = s["per_type"]
        print(f"| {r['provider']} | {r['model']} | {r['calling_mode']} | "
              + " | ".join(f"{pt[c]['v1']}/{pt[c]['v2_backend']}" for c in NEW_TYPES)
              + f" | {','.join(';'.join(pt[c]['sourced_elements']) or '-' for c in NEW_TYPES)}"
              + f" | {s['search_documents_calls']} | {len(s['refusals'])}: "
              + "; ".join(f"{x['component']}: {x['reason']}" for x in s["refusals"]) + " |")
    return 0


def run_long(token, org_id, conn, args) -> int:
    base = kit.base_url()
    h = b273._headers(token, org_id)
    roster, probe, wanted = _roster_rows(conn, args)
    target = (args.providers or "openai").split(",")[0]
    entry = next((r for r in roster if r["provider"] == target), None)
    if not entry or _blocked_reason(entry, probe, {target}):
        raise SystemExit(f"--long: no drivable row for {target}")
    prompt = long_prompt()
    size = len(prompt.encode("utf-8"))
    print(f"LONG prompt = {size} bytes (long-message axis needs >= 5120)")
    assert size >= 5120
    res = _drive_row(conn, base, h, entry, prompt, args.timeout, f"292 long {target}")
    rid = res["turn"].get("run_id") or "nosend"
    p = _write_evidence(_EVIDENCE / args.out, f"{target}-long-{rid}.json", entry, prompt, res)
    _print_row(entry, res)
    print(f"LONG evidence {p.relative_to(_REPO)}")
    return 0


def run_parallel(token, org_id, conn, args) -> int:
    base = kit.base_url()
    h = b273._headers(token, org_id)
    roster, probe, wanted = _roster_rows(conn, args)
    target = (args.providers or "openai").split(",")[0]
    entry = next((r for r in roster if r["provider"] == target), None)
    if not entry or _blocked_reason(entry, probe, {target}):
        raise SystemExit(f"--parallel: no drivable row for {target}")
    req = kit._requests()
    ta = req.post(f"{base}/threads", headers=h, timeout=15, json={"title": f"292 parallel A {target}"}).json()["id"]
    tb = req.post(f"{base}/threads", headers=h, timeout=15, json={"title": f"292 parallel B {target}"}).json()["id"]
    run_a, err_a = b273._send(base, h, ta, BOARD_PROMPT, entry["model"], entry["provider"])
    time.sleep(1.5)
    a_status_when_b_sent = (kit._fetchone(conn, "SELECT status FROM runs WHERE run_id = %s", (run_a,)) or {}).get("status")
    run_b, err_b = b273._send(base, h, tb, PARALLEL_B_PROMPT, entry["model"], entry["provider"])
    print(f"PARALLEL A run={run_a} {err_a} · A status when B was sent: {a_status_when_b_sent} · B run={run_b} {err_b}")
    st_a = b273._wait_run(conn, run_a, args.timeout) if run_a else "nosend"
    st_b = b273._wait_run(conn, run_b, args.timeout) if run_b else "nosend"
    arts = kit._fetchall(conn, "SELECT id, label, component, thread_id::text AS thread_id, run_id::text AS run_id "
                               "FROM message_artifacts WHERE run_id IN (%s, %s) ORDER BY created_at", (run_a, run_b))
    ok = (a_status_when_b_sent == "streaming" and st_a == "completed" and st_b == "completed"
          and all((a["run_id"] == run_a and a["thread_id"] == ta) or (a["run_id"] == run_b and a["thread_id"] == tb) for a in arts)
          and any(a["run_id"] == run_a for a in arts) and any(a["run_id"] == run_b for a in arts))
    doc = {"provider": target, "model": entry["model"], "thread_a": ta, "thread_b": tb, "run_a": run_a, "run_b": run_b,
           "a_status_when_b_sent": a_status_when_b_sent, "status_a": st_a, "status_b": st_b, "artifacts": arts,
           "verdict": "PASS" if ok else "FAIL"}
    out = _EVIDENCE / "parallel"
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{target}-parallel.json").write_text(json.dumps(doc, indent=2, default=str), encoding="utf-8")
    for a in arts:
        print(f"PARALLEL artifact {a['id']} {a['label']} thread={a['thread_id']} run={a['run_id']}")
    print(f"PARALLEL verdict {doc['verdict']} (A {st_a}, B {st_b})")
    return 0


def reload_check(token, org_id, conn, args) -> int:
    base = kit.base_url()
    h = b273._headers(token, org_id)
    d = _EVIDENCE / args.out
    rows = []
    for f in sorted(d.glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        code, items, _ = b273._reload(base, h, doc["thread_id"])
        first = {x["id"]: x for x in doc.get("reload_artifacts", []) if isinstance(x, dict) and x.get("id")}
        db = {a["id"]: a for a in _artifacts_full(conn, doc["thread_id"])}
        same = []
        for x in items:
            if not isinstance(x, dict) or x.get("missing"):
                same.append(False)
                continue
            key = lambda r: json.dumps({k: r.get(k) for k in ("label", "component", "spec", "caption", "row_count")}, sort_keys=True)
            same.append(x["id"] in first and key(x) == key(first[x["id"]]) and x["id"] in db and key(x) == key(db[x["id"]]))
        ok = code == 200 and bool(items) and all(same) and len(items) == len(first)
        rows.append({"file": f.name, "provider": doc["provider"], "thread_id": doc["thread_id"], "records": len(items),
                     "identical": ok})
        print(f"RELOAD {doc['provider']:<10} {f.name} records={len(items)} identical_to_first_reload_and_db={ok}")
    (_EVIDENCE / f"{args.out}-reload-check.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    return 0


# ── --refusal-probe ─────────────────────────────────────────────────────────────────────────────

async def _probe_async(user_id: str, org_id: str, conn) -> int:
    import asyncpg  # noqa: PLC0415
    from unittest.mock import patch  # noqa: PLC0415
    from app.dependencies import _init_pg_connection  # noqa: PLC0415
    from app.services import show_artifact_tool as sat  # noqa: PLC0415

    table = kit._fetchone(conn, "SELECT thread_id::text AS thread_id, label FROM message_artifacts WHERE user_id = %s "
                                "AND component = 'table' ORDER BY created_at DESC LIMIT 1", (user_id,))
    if not table:
        raise SystemExit("--refusal-probe: the dev user has no stored table to reference")
    print(f"PROBE stored table: {table['label']} in thread {table['thread_id']}")
    pool = await asyncpg.create_pool(_local_dsn(), min_size=1, max_size=2, init=_init_pg_connection)
    emitted: list = []

    async def _emit(*a, **k):
        emitted.append((a, k))

    async def _no_insert(*a, **k):
        raise AssertionError("insert_artifact called on a refusal path")

    diagram = {"nodes": [{"id": "a", "label": "Request"}, {"id": "b", "label": "Approve"}],
               "edges": [{"from": "a", "to": "b"}]}
    cases = [
        ("mindmap", {"component": "mindmap", "title": "Ideas", "diagram": diagram}, sat.__name__),
        ("flowchart", {"component": "flowchart", "title": "Invoice approval", "diagram": diagram}, sat.__name__),
        ("diagram from a stored table", {"component": "diagram", "title": "Invoice approval",
                                         "from_artifact": table["label"]}, sat.__name__),
    ]
    rc = 0
    try:
        for name, args, mod in cases:
            ctx = SimpleNamespace(redis=None, run_id=None, thread_id=table["thread_id"], pool=pool,
                                  current_user={"id": user_id, "org_id": org_id}, emit=_emit,
                                  tool_call_id="call_292probe", parent_run_id=None, phase_whitelist=None,
                                  turn_tool_calls=[], turn_citations=[])
            with patch(f"{mod}.insert_artifact", new=_no_insert):
                res = await sat.handle_show_artifact(args, ctx)
            obj = json.loads(res.result)
            keys_ok = set(obj) == {"status", "reason", "detail"} and obj["status"] == "refused"
            rc |= 0 if keys_ok else 1
            print(f"PROBE {name}: keys={sorted(obj)} keys_exact={keys_ok}")
            print(f"PROBE {name}: payload={json.dumps(obj, ensure_ascii=False)}")
        print(f"PROBE emitted events on refusal paths: {len(emitted)} (must be 0)")
        rc |= 1 if emitted else 0
    finally:
        await pool.close()
    return rc


def refusal_probe(token, org_id, user_id, conn) -> int:
    before = (kit._fetchone(conn, "SELECT count(*) AS n FROM message_artifacts", ()) or {}).get("n")
    rc = asyncio.run(_probe_async(user_id, org_id, conn))
    after = (kit._fetchone(conn, "SELECT count(*) AS n FROM message_artifacts", ()) or {}).get("n")
    print(f"PROBE message_artifacts rows before={before} after={after} (no DB write on refusal: {before == after})")
    return rc | (0 if before == after else 1)


# ── --craft-bad-row ─────────────────────────────────────────────────────────────────────────────

def craft_bad_row(token, org_id, user_id, conn) -> int:
    from app.services.artifact_history import redact_artifact_args  # noqa: PLC0415
    from app.services.show_artifact_tool import build_encoded_result  # noqa: PLC0415

    _local_dsn()
    try:
        fd = os.open(str(_LOCK), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise SystemExit(f"REFUSING: the local-DB lock is held ({_LOCK})")
    os.write(fd, f"292-03 craft-bad-row {time.strftime('%Y-%m-%dT%H:%M:%S')}".encode())
    os.close(fd)
    try:
        base = kit.base_url()
        h = b273._headers(token, org_id)
        thread_id = kit._requests().post(f"{base}/threads", headers=h, timeout=15,
                                         json={"title": "292 crafted bad diagram row"}).json()["id"]
        art_id = "a_" + "".join(secrets.choice("0123456789abcdefghijklmnopqrstuvwxyz") for _ in range(10))
        call_id = "call_292crafted" + secrets.token_hex(4)
        spec = {"title": "Invoice approval", "diagram": {
            "nodes": [{"id": "recv", "label": "Invoice received", "kind": "start", "source": None},
                      {"id": "ok", "label": "Matches the purchase order?", "kind": "decision", "source": None},
                      {"id": "paid", "label": "Paid", "kind": "end", "source": None}],
            "edges": [{"from": "recv", "to": "ok", "label": None}, {"from": "ok", "to": "paid", "label": "Yes"},
                      {"from": "ok", "to": "zz", "label": "No"}]}}
        caption = {"row_count": 3, "sources": [], "source_count": 0, "lineage": None}
        row = {"id": art_id, "label": "diagram 1", "component": "diagram", "spec": spec, "row_count": 3}
        result = build_encoded_result(row)
        args = {"component": "diagram", "title": "Invoice approval", "diagram": spec["diagram"]}
        tool_calls = redact_artifact_args([{"tool_call_id": call_id, "name": "show_artifact", "args": args,
                                            "result": result, "status": "done"}])
        cur = conn.cursor()
        cur.execute("INSERT INTO messages (thread_id, user_id, org_id, role, content) VALUES (%s, %s, %s, 'user', %s)",
                    (thread_id, user_id, org_id, "Show how invoice approval works as a flow diagram."))
        time.sleep(0.05)
        cur.execute("INSERT INTO messages (thread_id, user_id, org_id, role, content, tool_calls) "
                    "VALUES (%s, %s, %s, 'assistant', %s, %s::jsonb) RETURNING id::text",
                    (thread_id, user_id, org_id,
                     "Invoices are matched against the purchase order, then approved and paid.",
                     json.dumps(tool_calls)))
        msg_id = cur.fetchone()[0]
        cur.execute("INSERT INTO message_artifacts (id, thread_id, user_id, org_id, run_id, tool_call_id, parent_id, "
                    "label, component, spec, caption, row_count) VALUES (%s, %s, %s, %s, NULL, %s, NULL, 'diagram 1', "
                    "'diagram', %s::jsonb, %s::jsonb, 3)",
                    (art_id, thread_id, user_id, org_id, call_id, json.dumps(spec), json.dumps(caption)))
        conn.commit() if not conn.autocommit else None
        print(f"CRAFT thread={thread_id} assistant_message={msg_id} artifact={art_id} tool_call={call_id}")
        print(f"CRAFT persisted args (redacted): {json.dumps(tool_calls[0]['args'], ensure_ascii=False)}")
        code, items, _ = b273._reload(base, h, thread_id)
        print(f"CRAFT reload HTTP {code} items={json.dumps(items, default=str)[:400]}")
        out = _EVIDENCE / "crafted"
        out.mkdir(parents=True, exist_ok=True)
        (out / "crafted-bad-row.json").write_text(json.dumps({
            "thread_id": thread_id, "assistant_message_id": msg_id, "artifact_id": art_id, "tool_call_id": call_id,
            "spec": spec, "persisted_tool_calls": tool_calls, "reload_http": code, "reload_artifacts": items,
        }, indent=2, default=str), encoding="utf-8")
    finally:
        _LOCK.unlink(missing_ok=True)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    for m in ("roster", "seed", "run", "long", "parallel", "reload-check", "refusal-probe", "craft-bad-row"):
        g.add_argument(f"--{m}", action="store_true")
    ap.add_argument("--providers", default="")
    ap.add_argument("--timeout", type=int, default=420)
    ap.add_argument("--out", default="board", help="evidence subdirectory under evidence/ (default 'board')")
    args = ap.parse_args()
    kit.load_env()
    kit.assert_localhost_only()
    b273._assert_local_db()
    _local_dsn()
    conn = kit.connect_db()
    conn.autocommit = True
    if args.roster:
        b273.derive_roster(conn)
        return 0
    token = kit.get_bearer_token()
    user_id = b273._user_id(token)
    org_id = b273._single_org(conn, user_id)
    print(f"dev user {user_id} · single org {org_id} (asserted from org_members)")
    if args.seed:
        return seed(token, org_id, user_id, conn)
    if args.long:
        return run_long(token, org_id, conn, args)
    if args.parallel:
        return run_parallel(token, org_id, conn, args)
    if args.reload_check:
        return reload_check(token, org_id, conn, args)
    if args.refusal_probe:
        return refusal_probe(token, org_id, user_id, conn)
    if args.craft_bad_row:
        return craft_bad_row(token, org_id, user_id, conn)
    return run_board(token, org_id, conn, args)


if __name__ == "__main__":
    sys.exit(main())
