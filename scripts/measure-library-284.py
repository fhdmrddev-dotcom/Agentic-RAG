"""Phase 284 (D-21 / D-22) — the Library measurement table, BEFORE and AFTER.

Signs in as the synthetic owner (``scale284@example.com``) and times the request set the
Library issues, against a running backend (default the operator's ``http://127.0.0.1:8000``),
then reads the GROUND TRUTH from Postgres as ``postgres`` (asyncpg — no PostgREST cap) so every
reported total sits beside its own ``count(*)``.

For each surface, 5 runs: status · response bytes · median ms · max ms · rows returned · the
total the response reports (before: ``len(array)`` or the client-side count the Library derives
from it; after: the envelope's ``total``) · the DB ``count(*)`` · equal?

⚠ "ms" is WALL time of the HTTP round trip on loopback, measured by this client. The backend
   emits no Server-Timing header, so this is the honest proxy for server time, and is labelled
   so. The browser-rendered "Library load" figure is the G-4 drive's (284-05), not this table's.

⛔ BEFORE MUST BE MEASURED AGAINST BASE CODE. The operator's uvicorn serves the MAIN checkout
   (``C:/Vibe Apps/Agentic RAG``), not this worktree. So ``--label before`` first proves that
   every tracked ``backend/`` file in THIS tree (which must itself be at ``--plan-base``, with no
   ``backend/app`` change) is byte-identical to the main checkout's copy, and records the main
   checkout's HEAD. Any difference → exit 4, never a figure. (A file comparison rather than
   ``git -C <main> diff``: the executor sandbox forbids git commands aimed at another checkout,
   and a byte comparison of the served files is the stronger property anyway.)

⛔ The backend down → exit 3 "start the backend (operator) and re-run". Never a faked figure.

Usage (from ``backend/`` with the venv):
    venv/Scripts/python ../scripts/measure-library-284.py --label before --size 10000 --plan-base <sha>
    venv/Scripts/python ../scripts/measure-library-284.py --label after  --size 50000 --base-url http://127.0.0.1:8001
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"
sys.path.insert(0, str(BACKEND))

import asyncpg  # noqa: E402
import httpx  # noqa: E402

from tests.integration._284_scale_account import (  # noqa: E402
    BIG_FOLDER_NAME,
    SCALE_OWNER_EMAIL,
    legacy_visible_latest_ids,
    sign_in,
)

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MAIN_CHECKOUT = Path("C:/Vibe Apps/Agentic RAG")
PHASE_DIR = REPO / ".planning" / "phases" / "284-library-at-scale"
RUNS = 5

FIND_BODY = {"filter_expr": {"op": "and", "conditions": []}, "version": "latest",
             "sort": "added_desc", "offset": 0, "limit": 25}


def _main_head() -> str:
    head = (MAIN_CHECKOUT / ".git" / "HEAD").read_text(encoding="utf-8").strip()
    if not head.startswith("ref: "):
        return head
    ref = head[5:]
    loose = MAIN_CHECKOUT / ".git" / ref
    if loose.is_file():
        return f"{ref} @ {loose.read_text(encoding='utf-8').strip()}"
    packed = MAIN_CHECKOUT / ".git" / "packed-refs"
    for line in packed.read_text(encoding="utf-8").splitlines():
        if line.endswith(" " + ref):
            return f"{ref} @ {line.split()[0]}"
    return f"{ref} @ <unresolved>"


def prove_base_code(plan_base: str) -> dict:
    here = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True,
                          check=True).stdout.strip()
    changed = subprocess.run(["git", "diff", "--name-only", plan_base, "HEAD", "--", "backend/app"],
                             cwd=REPO, capture_output=True, text=True, check=True).stdout.split()
    dirty = subprocess.run(["git", "status", "--porcelain", "--", "backend/app"], cwd=REPO,
                           capture_output=True, text=True, check=True).stdout.split("\n")
    dirty = [d for d in dirty if d.strip()]
    if changed or dirty:
        print(f"FATAL: this tree's backend/app differs from {plan_base}: {changed + dirty}")
        raise SystemExit(4)
    files = subprocess.run(["git", "ls-files", "backend"], cwd=REPO, capture_output=True,
                           text=True, check=True).stdout.split("\n")
    files = [f for f in files if f.strip()]
    # Compared modulo line endings: core.autocrlf checks a fresh worktree out with CRLF while
    # the long-lived main checkout carries LF in many files (measured: 387 of them) — the same
    # content, and Python executes both identically. Any OTHER byte difference is a real one.
    def _norm(p: Path) -> bytes:
        return p.read_bytes().replace(b"\r\n", b"\n")

    diffs = []
    for rel in files:
        a, b = REPO / rel, MAIN_CHECKOUT / rel
        if not b.is_file() or _norm(a) != _norm(b):
            diffs.append(rel)
    if diffs:
        print(f"FATAL: the main checkout's backend differs from PLAN_BASE {plan_base} in "
              f"{len(diffs)} file(s): {diffs[:10]} — never measure BEFORE against changed code")
        raise SystemExit(4)
    return {"worktree_head": here, "plan_base": plan_base, "main_checkout_head": _main_head(),
            "tracked_backend_files_compared": len(files), "identical": True}


def _timed(client: httpx.Client, method: str, url: str, **kw):
    t0 = time.perf_counter()
    r = client.request(method, url, **kw)
    return r, (time.perf_counter() - t0) * 1000.0


def measure_surface(client, name, method, url, *, rows_of, total_of, db_count, **kw) -> dict:
    samples, last = [], None
    for _ in range(RUNS):
        r, ms = _timed(client, method, url, **kw)
        samples.append(ms)
        last = r
    try:
        body = last.json()
    except Exception:
        body = None
    rows = rows_of(body) if body is not None and last.status_code == 200 else None
    total = total_of(body) if body is not None and last.status_code == 200 else None
    return {
        "surface": name, "method": method, "url": url, "status": last.status_code,
        "bytes": len(last.content), "median_ms": round(statistics.median(samples), 1),
        "max_ms": round(max(samples), 1), "rows": rows, "reported_total": total,
        "db_count": db_count, "equal": (total == db_count) if total is not None else False,
        "samples_ms": [round(s, 1) for s in samples],
    }


def measure_parallel_set(client, name, requests_: list, db_count=None, note="") -> dict:
    samples, statuses, sizes = [], None, None
    for _ in range(RUNS):
        t0 = time.perf_counter()
        with ThreadPoolExecutor(max_workers=len(requests_)) as ex:
            res = list(ex.map(lambda rq: client.request(rq[0], rq[1], **rq[2]), requests_))
        samples.append((time.perf_counter() - t0) * 1000.0)
        statuses = [r.status_code for r in res]
        sizes = [len(r.content) for r in res]
    return {"surface": name, "method": "SET", "url": " + ".join(f"{m} {u}" for m, u, _ in requests_),
            "status": "/".join(map(str, statuses)), "bytes": sum(sizes),
            "median_ms": round(statistics.median(samples), 1), "max_ms": round(max(samples), 1),
            "rows": None, "reported_total": None, "db_count": db_count, "equal": None,
            "samples_ms": [round(s, 1) for s in samples], "note": note}


async def ground_truth() -> dict:
    conn = await asyncpg.connect(DSN)
    try:
        owner = await conn.fetchval("SELECT id FROM auth.users WHERE email = $1", SCALE_OWNER_EMAIL)
        if owner is None:
            raise SystemExit("the scale account is not seeded — run seed-scale-284.py first")
        big = await conn.fetchval("SELECT id FROM folders WHERE user_id=$1 AND name=$2", owner, BIG_FOLDER_NAME)
        f = conn.fetchval
        truth = {
            "owner": str(owner), "big_folder_id": str(big),
            "owner_latest_all": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest", owner),
            "root_latest_all": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id IS NULL", owner),
            "root_latest_unarchived": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id IS NULL AND archived_at IS NULL", owner),
            "big_latest_all": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id=$2", owner, big),
            "big_latest_unarchived": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id=$2 AND archived_at IS NULL", owner, big),
            "owner_latest_unarchived": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND archived_at IS NULL", owner),
        }
        truth["legacy_visible_latest"] = len(await legacy_visible_latest_ids(conn, str(owner)))
        return truth
    finally:
        await conn.close()


def _len(body):
    return len(body) if isinstance(body, list) else len((body or {}).get("documents") or [])


def _total(body):
    return body.get("total") if isinstance(body, dict) else len(body)


def run(label: str, size: int, base_url: str, plan_base: str | None) -> int:
    provenance = prove_base_code(plan_base) if label == "before" else {"plan_base": plan_base}
    try:
        h = httpx.get(f"{base_url}/health", timeout=5)
        if h.status_code != 200:
            raise RuntimeError(h.status_code)
    except Exception as e:  # noqa: BLE001
        print(f"backend not healthy at {base_url} ({e}) — start the backend (operator) and re-run")
        return 3
    truth = asyncio.run(ground_truth())
    token = sign_in(SCALE_OWNER_EMAIL)
    headers = {"Authorization": f"Bearer {token}"}
    big = truth["big_folder_id"]
    out = []
    with httpx.Client(base_url=base_url, headers=headers, timeout=120) as c:
        if label == "before":
            # The base API has no folder / paging params: the Library downloads the whole array
            # and derives Root / folder lists and totals from it in the browser.
            out.append(measure_surface(c, "GET /documents (whole list)", "GET", "/documents",
                                       rows_of=_len, total_of=_total, db_count=truth["owner_latest_all"]))
            out.append(measure_surface(c, "Root total as the Library derives it (array, folder_id null)", "GET", "/documents",
                                       rows_of=_len, total_of=lambda b: sum(1 for d in b if d.get("folder_id") is None),
                                       db_count=truth["root_latest_all"]))
            out.append(measure_surface(c, "Big folder total as the Library derives it (array, folder_id = Big)", "GET", "/documents",
                                       rows_of=_len, total_of=lambda b: sum(1 for d in b if d.get("folder_id") == big),
                                       db_count=truth["big_latest_all"]))
            out.append(measure_surface(c, "Picker read (whole list, as CreateLink/LegalHold/Takeoff download it)", "GET", "/documents",
                                       rows_of=_len, total_of=_total, db_count=truth["owner_latest_all"]))
            find = measure_surface(c, "POST /document-search page 1 (limit 25)", "POST", "/document-search",
                                   json=FIND_BODY, rows_of=_len, total_of=_total,
                                   db_count=truth["owner_latest_unarchived"])
            out.append(find)
            out.append(measure_parallel_set(c, "Library open request set (GET /documents + GET /folders, parallel)",
                                            [("GET", "/documents", {}), ("GET", "/folders", {})]))
        else:
            root = c.get("/documents", params={"folder_id": "root", "limit": 25})
            out.append(measure_surface(c, "GET /documents Root page 1 (limit 25)", "GET", "/documents?folder_id=root&limit=25",
                                       rows_of=_len, total_of=_total, db_count=truth["root_latest_unarchived"]))
            out.append(measure_surface(c, "GET /documents Big page 1 (limit 25)", "GET", f"/documents?folder_id={big}&limit=25",
                                       rows_of=_len, total_of=_total, db_count=truth["big_latest_unarchived"]))
            last_off = max(0, ((truth["big_latest_unarchived"] - 1) // 25) * 25)
            out.append(measure_surface(c, "GET /documents Big LAST page (limit 25)", "GET",
                                       f"/documents?folder_id={big}&limit=25&offset={last_off}",
                                       rows_of=_len, total_of=_total, db_count=truth["big_latest_unarchived"]))
            out.append(measure_surface(c, "POST /document-search page 1 (limit 25)", "POST", "/document-search",
                                       json=FIND_BODY, rows_of=_len, total_of=_total,
                                       db_count=truth["owner_latest_unarchived"]))
            out.append(measure_surface(c, "Picker read (POST /document-search limit 20)", "POST", "/document-search",
                                       json={**FIND_BODY, "limit": 20}, rows_of=_len, total_of=_total,
                                       db_count=truth["owner_latest_unarchived"]))
            out.append(measure_surface(c, "GET /library/summary", "GET", "/library/summary",
                                       rows_of=lambda b: None, total_of=lambda b: b.get("total"),
                                       db_count=truth["owner_latest_all"]))
            out.append(measure_parallel_set(c, "Library open request set (Root page + summary + folders, parallel)",
                                            [("GET", "/documents?folder_id=root&limit=25", {}),
                                             ("GET", "/library/summary", {}), ("GET", "/folders", {})]))
            del root

    record = {"label": label, "size": size, "base_url": base_url,
              "measured_at": datetime.now(timezone.utc).isoformat(), "provenance": provenance,
              "ground_truth": truth, "surfaces": out}
    mdir = PHASE_DIR / "measurements"
    mdir.mkdir(parents=True, exist_ok=True)
    (mdir / f"284-{label}-{size}.json").write_text(json.dumps(record, indent=2), encoding="utf-8")

    md = [f"\n### {label.upper()} — {size:,} seeded (+20 shared = {truth['owner_latest_all']:,} owner latest)\n",
          f"Measured {record['measured_at']} against `{base_url}`. Provenance: `{json.dumps(provenance)}`.",
          f"Ground truth (asyncpg as postgres): `{json.dumps({k: v for k, v in truth.items() if k not in ('owner',)})}`\n",
          "| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |",
          "|---|---|---|---|---|---|---|---|---|"]
    for s in out:
        md.append(f"| {s['surface']} | {s['status']} | {s['bytes']:,} | {s['median_ms']} | {s['max_ms']} | "
                  f"{'—' if s['rows'] is None else s['rows']} | {'—' if s['reported_total'] is None else s['reported_total']} | "
                  f"{'—' if s['db_count'] is None else s['db_count']} | "
                  f"{'—' if s['equal'] is None else ('yes' if s['equal'] else '**NO**')} |")
    with open(PHASE_DIR / "284-MEASUREMENTS.md", "a", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print("\n".join(md))
    return 0


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", choices=("before", "after"), required=True)
    ap.add_argument("--size", type=int, choices=(10000, 50000), required=True)
    ap.add_argument("--base-url", default="http://127.0.0.1:8000")
    ap.add_argument("--plan-base", default=None, help="required for --label before")
    a = ap.parse_args()
    if a.label == "before" and not a.plan_base:
        ap.error("--label before needs --plan-base <sha>")
    return run(a.label, a.size, a.base_url.rstrip("/"), a.plan_base)


if __name__ == "__main__":
    sys.exit(main())
