"""run-272-board.py — Phase 272 (272-05) SC#10 cross-provider board for FILTERED retrieval (D-17).

Two modes, both against the LOCAL stack only (the conc_probe localhost hard-gate runs first):

  --seed   As the dev user (real GoTrue password-grant JWT, the conc_probe kit), with an explicit
           ``X-Org-Id`` after asserting from ``org_members`` that the user is in exactly ONE org:
           create the enum field ``legal_entity`` (Acme GmbH / Beta Ltd) if absent, upload the
           VALIDATION §3 fixture reports (``272-board-*.md``, idempotent by filename), PATCH each
           one's ``date`` + ``legal_entity``, wait for ingestion, and assert a non-null
           ``date_typed`` and ≥ 1 chunk per report.

  --run    Derive the 8 rows from the registry at run time (``sc10_188_run_board.derive_roster``:
           newest registry-backed id per provider) and the key probe (``override_provider``), then
           for each row × prompt (a)/(b)/(c): a fresh thread, ``POST /threads/{id}/messages`` with a
           per-request ``model`` + ``provider`` (no global setting is mutated), wait for the run,
           and compute the verdict from the DATABASE: the run's ``audit_log`` ``search.query`` rows
           (``filters``, ``result_kind``, ``document_ids``) and EVERY persisted tool call of the
           thread's assistant messages (``messages.tool_calls``) plus its citations
           (``messages.source_refs``). Raw JSON per run → ``evidence/board/``.

Verdict rules — VALIDATION §3, applied literally (D-17: a correct answer WITHOUT a ``filters``
argument FAILS the row; D-22: prompt (c) FAILS if ANY later tool call retrieves content from
outside the filter). A provider with no key is recorded ⛔ with its reason, never omitted.

Usage (backend venv, repo root; the operator runs uvicorn):
    backend/venv/Scripts/python.exe scripts/run-272-board.py --seed
    backend/venv/Scripts/python.exe scripts/run-272-board.py --run [--providers openai,google]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import date
from pathlib import Path

try:  # ⛔ / ✅ in the output — never let a cp1252 console kill the run
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO / "scripts"))
sys.path.insert(0, str(_REPO / "backend"))

import conc_probe as kit  # noqa: E402

_EVIDENCE = _REPO / ".planning" / "phases" / "272-close-means-wrong" / "evidence" / "board"

FIELD_KEY = "legal_entity"
FIELD_OPTIONS = ["Acme GmbH", "Beta Ltd"]

# VALIDATION §3 fixture: distinct revenue figures, ISO dates, NO July document of any year.
FIXTURES = [
    ("272-board-acme-2025-09.md", "2025-09-15", "Acme GmbH", "EUR 1,180,000"),
    ("272-board-acme-2025-10.md", "2025-10-15", "Acme GmbH", "EUR 1,240,000"),
    ("272-board-beta-2025-10.md", "2025-10-20", "Beta Ltd", "GBP 860,000"),
    ("272-board-acme-2026-03.md", "2026-03-15", "Acme GmbH", "EUR 1,410,000"),
    ("272-board-beta-2026-03.md", "2026-03-18", "Beta Ltd", "GBP 905,000"),
]

PROMPTS = {
    "a": "What was October revenue?",
    "b": "What was revenue for Acme GmbH?",
    "c": "What was revenue for Acme GmbH in July?",
}

# Retrieval tools whose result carries document content (D-22's "any tool call" list).
_RETRIEVAL_TOOLS = {
    "search_documents", "grep", "grep_documents", "query_documents", "read_document",
    "analyze_document", "get_document", "fetch_document", "list_documents",
}

_NOTHING_RE = re.compile(
    r"no (?:documents?|reports?|records?|data|results?)|nothing (?:matched|was found|found)|"
    r"(?:couldn't|could not|did not|didn't|was unable to|unable to) find|"
    r"no .{0,40}match|don't have|do not have|not (?:available|found)|none of the",
    re.I,
)


def _headers(token: str, org_id: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Org-Id": org_id}


def _single_org(conn, user_id: str) -> str:
    rows = kit._fetchall(conn, "SELECT org_id::text AS org_id FROM org_members WHERE user_id = %s", (user_id,))
    if len(rows) != 1:
        raise SystemExit(f"dev user is in {len(rows)} orgs — refusing (an absence would be vacuous)")
    return rows[0]["org_id"]


def _user_id(token: str) -> str:
    import base64
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))["sub"]


# ── --seed ─────────────────────────────────────────────────────────────────────────────────────

def seed(token: str, org_id: str, user_id: str, conn) -> int:
    requests = kit._requests()
    base = kit.base_url()
    h = _headers(token, org_id)

    fields = requests.get(f"{base}/metadata-fields", headers=h, timeout=15)
    fields.raise_for_status()
    existing = {f["field_key"]: f for f in fields.json()}
    if FIELD_KEY in existing:
        print(f"SEED field {FIELD_KEY} exists type={existing[FIELD_KEY].get('field_type')} "
              f"options={existing[FIELD_KEY].get('options')}")
    else:
        r = requests.post(f"{base}/metadata-fields", headers=h, timeout=15, json={
            "field_key": FIELD_KEY, "field_type": "enum", "options": FIELD_OPTIONS,
            "description": "The legal entity a report belongs to (272 board fixture).",
        })
        print(f"SEED field {FIELD_KEY} created HTTP {r.status_code}")
        r.raise_for_status()

    ids: dict[str, str] = {}
    for name, iso, entity, figure in FIXTURES:
        row = kit._fetchone(conn, "SELECT id::text AS id FROM documents WHERE user_id = %s AND filename = %s "
                                  "AND is_latest = true", (user_id, name))
        if row:
            ids[name] = row["id"]
            print(f"SEED {name} exists id={row['id']}")
            continue
        month = date.fromisoformat(iso).strftime("%B %Y")
        body = (
            f"# {entity} — monthly financial report, {month}\n\n"
            f"Reporting entity: {entity}.\nReporting period: {month}.\n\n"
            f"Total revenue for the period: {figure}.\n\n"
            f"Revenue was driven by recurring service contracts and one-off project work. "
            f"Operating costs were in line with the budget for the period.\n"
        )
        r = requests.post(f"{base}/documents/upload", headers=h, timeout=60,
                          files={"file": (name, body.encode("utf-8"), "text/markdown")})
        print(f"SEED upload {name} HTTP {r.status_code}")
        r.raise_for_status()
        ids[name] = r.json()["id"]

    deadline = time.time() + 300
    pending = set(ids.values())
    while pending and time.time() < deadline:
        for doc_id in list(pending):
            row = kit._fetchone(conn, "SELECT status FROM documents WHERE id = %s", (doc_id,))
            if row and row["status"] in ("completed", "failed"):
                pending.discard(doc_id)
        time.sleep(2)
    if pending:
        raise SystemExit(f"ingestion did not finish for {sorted(pending)}")

    ok = True
    for name, iso, entity, _figure in FIXTURES:
        doc_id = ids[name]
        for field, value in (("date", iso), (FIELD_KEY, entity)):
            r = requests.patch(f"{base}/documents/{doc_id}/metadata", headers=h, timeout=15,
                               json={"field": field, "value": value})
            if r.status_code != 200:
                print(f"SEED PATCH {name} {field} HTTP {r.status_code} {r.text[:200]}")
                ok = False
        fact = kit._fetchone(conn, "SELECT status, date_typed::text AS d, metadata->>%s AS ent, "
                                   "(SELECT count(*) FROM document_chunks c WHERE c.document_id = documents.id) AS n "
                                   "FROM documents WHERE id = %s", (FIELD_KEY, doc_id))
        good = fact["status"] == "completed" and fact["d"] == iso and fact["ent"] == entity and fact["n"] >= 1
        ok &= good
        print(f"SEED {'OK ' if good else 'BAD'} {name} id={doc_id} status={fact['status']} date_typed={fact['d']} "
              f"{FIELD_KEY}={fact['ent']} chunks={fact['n']}")
    return 0 if ok else 1


# ── --run ──────────────────────────────────────────────────────────────────────────────────────

def _date_range(filters: list[dict]) -> tuple[str | None, str | None]:
    lo = hi = None
    for f in filters or []:
        if f.get("field") != "date":
            continue
        op, v, v2 = f.get("op"), f.get("value"), f.get("value2")
        if op == "between":
            lo, hi = v, v2
        elif op in ("gte", "after"):
            lo = v
        elif op in ("lte", "before"):
            hi = v
        elif op == "eq":
            lo = hi = v
    return lo, hi


def _entity_values(filters: list[dict]) -> set[str]:
    out: set[str] = set()
    for f in filters or []:
        if f.get("field") == FIELD_KEY:
            if f.get("value") is not None:
                out.add(str(f["value"]))
            out.update(str(v) for v in (f.get("values") or []))
    return out


def _wait_run(conn, run_id: str, timeout: int) -> str:
    deadline = time.time() + timeout
    status = None
    while time.time() < deadline:
        row = kit._fetchone(conn, "SELECT status FROM runs WHERE run_id = %s", (run_id,))
        status = row["status"] if row else None
        if status and status != "streaming":
            return status
        time.sleep(2)
    return f"NOT TERMINAL ({status})"


def _collect(conn, thread_id: str, run_id: str) -> dict:
    audits = kit._fetchall(
        conn,
        "SELECT id::text AS id, created_at::text AS at, metadata FROM audit_log "
        "WHERE action_type = 'search.query' AND (metadata->>'run_id' = %s OR metadata->>'parent_run_id' = %s "
        "OR metadata->>'thread_id' = %s) ORDER BY created_at",
        (run_id, run_id, thread_id),
    )
    msgs = kit._fetchall(
        conn,
        "SELECT id::text AS id, role, content, tool_calls, source_refs, created_at::text AS at "
        "FROM messages WHERE thread_id = %s ORDER BY created_at",
        (thread_id,),
    )
    run = kit._fetchone(conn, "SELECT status, model, provider, error FROM runs WHERE run_id = %s", (run_id,))
    return {"audits": audits, "messages": msgs, "run": run}


def _doc_facts(conn, doc_ids: set[str]) -> dict[str, dict]:
    if not doc_ids:
        return {}
    rows = kit._fetchall(
        conn,
        "SELECT id::text AS id, filename, date_typed::text AS d, metadata->>%s AS ent FROM documents "
        "WHERE id = ANY(%s::uuid[])",
        (FIELD_KEY, list(doc_ids)),
    )
    return {r["id"]: r for r in rows}


def verdict(conn, prompt_key: str, data: dict) -> dict:
    audits = data["audits"]
    assistant = [m for m in data["messages"] if m["role"] == "assistant"]
    answer = "\n".join((m["content"] or "") for m in assistant)
    tool_calls = [tc for m in assistant for tc in (m["tool_calls"] or [])]
    cited = {s.get("document_id") for m in assistant for s in (m["source_refs"] or []) if s.get("document_id")}
    facts = _doc_facts(conn, cited)
    calls_seen = [f"{tc.get('name')}({json.dumps(tc.get('args', {}), ensure_ascii=False)[:160]})" for tc in tool_calls]
    filtered_audits = [a for a in audits if (a["metadata"] or {}).get("filters")]
    notes: list[str] = []

    if prompt_key == "a":
        good_filter = [a for a in filtered_audits
                       if (lambda r: r[0] and r[1] and "2025-10-01" <= r[0] <= r[1] <= "2025-10-31")(
                           _date_range(a["metadata"]["filters"]))]
        range_in_answer = bool(re.search(r"October\s+2025|Oct(?:ober)?\.?\s+2025|2025-10", answer, re.I))
        in_oct = all((facts.get(d) or {}).get("d", "") and facts[d]["d"].startswith("2025-10") for d in cited)
        ok = bool(good_filter) and range_in_answer and bool(cited) and in_oct
        notes += [f"date filter in Oct 2025: {bool(good_filter)}", f"range in answer: {range_in_answer}",
                  f"citations {len(cited)} all October: {in_oct and bool(cited)}"]
        for fig in ("1,410,000", "905,000", "1,180,000"):
            if fig in answer:
                notes.append(f"⚠ out-of-filter figure {fig} in the answer")
    elif prompt_key == "b":
        good_filter = [a for a in filtered_audits if "Acme GmbH" in _entity_values(a["metadata"]["filters"])]
        all_acme = all((facts.get(d) or {}).get("ent") == "Acme GmbH" for d in cited)
        ok = bool(good_filter) and bool(cited) and all_acme
        notes += [f"legal_entity=Acme GmbH filter: {bool(good_filter)}",
                  f"citations {len(cited)} all Acme GmbH: {all_acme and bool(cited)}"]
    else:
        empty = [a for a in filtered_audits if (a["metadata"] or {}).get("result_kind") == "no_documents_matched"]
        says_nothing = bool(_NOTHING_RE.search(answer))
        # D-22: every tool call AFTER the first empty filtered search, and every audit row after it.
        leak = []
        if empty:
            first_at = empty[0]["at"]
            for a in audits:
                md = a["metadata"] or {}
                if a["at"] > first_at and md.get("result_kind") == "passages":
                    leak.append(f"search_documents passages docs={md.get('document_ids')}")
            seen_empty = False
            for tc in tool_calls:
                name = tc.get("name")
                if name == "search_documents" and not seen_empty:
                    res = str(tc.get("result", ""))
                    if "no_documents_matched" in res:
                        seen_empty = True
                    continue
                if seen_empty and name in _RETRIEVAL_TOOLS and name != "search_documents":
                    res = str(tc.get("result", ""))
                    if res and "error" not in res[:200].lower():
                        leak.append(f"{name} returned content ({len(res)} chars)")
        ok = bool(empty) and says_nothing and not cited and not leak
        notes += [f"filtered call returned no_documents_matched: {bool(empty)}", f"answer says nothing matched: {says_nothing}",
                  f"citations: {len(cited)}", f"later retrieval outside the filter: {leak or 'none'}"]
        if re.search(r"\d{1,3}(?:,\d{3}){1,}", answer):
            notes.append("⚠ a figure appears in the answer")
    return {
        "verdict": "PASS" if ok else "FAIL",
        "notes": notes,
        "tool_calls_inspected": calls_seen,
        "audit_ids": [a["id"] for a in audits],
        "audit_kinds": [(a["metadata"] or {}).get("result_kind") for a in audits],
        "audit_filters": [(a["metadata"] or {}).get("filters") for a in audits],
        "cited": {d: facts.get(d) for d in cited},
        "answer_excerpt": answer[:600],
    }


def run_board(token: str, org_id: str, conn, args) -> int:
    import sc10_188_run_board as sc10

    requests = kit._requests()
    base = kit.base_url()
    h = _headers(token, org_id)
    roster = sc10.derive_roster()
    sc10.print_roster(roster)
    settings, how = sc10.load_effective_settings()
    print(f"settings source: {how}")
    probe = sc10.probe_keys(roster, settings)
    wanted = set(args.providers.split(",")) if args.providers else None
    _EVIDENCE.mkdir(parents=True, exist_ok=True)
    table = []
    for entry in roster:
        pid = entry["provider"]
        if wanted and pid not in wanted:
            continue
        row = {"provider": pid, "model": entry["model"], "results": {}}
        if not probe[pid]["has_key"]:
            row["blocked"] = "no API key configured (override_provider returned settings unchanged)"
            table.append(row)
            print(f"BOARD {pid} ⛔ {row['blocked']}")
            continue
        for key in args.prompts:
            t = requests.post(f"{base}/threads", headers=h, timeout=15, json={"title": f"272 board {pid} ({key})"})
            t.raise_for_status()
            thread_id = t.json()["id"]
            r = requests.post(f"{base}/threads/{thread_id}/messages", headers=h, timeout=60,
                              json={"content": PROMPTS[key], "model": entry["model"], "provider": pid})
            if r.status_code not in (200, 201):
                row["results"][key] = {"verdict": "FAIL", "notes": [f"send HTTP {r.status_code}: {r.text[:200]}"]}
                continue
            run_id = r.json().get("run_id")
            status = _wait_run(conn, run_id, args.timeout)
            data = _collect(conn, thread_id, run_id)
            v = verdict(conn, key, data)
            v.update({"thread_id": thread_id, "run_id": run_id, "run_status": status,
                      "effective": data["run"]})
            if status != "completed":
                v["verdict"] = "FAIL"
                v["notes"].append(f"run status {status}: {(data['run'] or {}).get('error')}")
            row["results"][key] = v
            (_EVIDENCE / f"{pid}-{key}-{run_id}.json").write_text(
                json.dumps({"prompt": PROMPTS[key], "provider": pid, "model": entry["model"], **v,
                            "raw": data}, indent=2, default=str), encoding="utf-8")
            print(f"BOARD {pid} ({key}) {v['verdict']} run={run_id} status={status} | " + " · ".join(v["notes"]))
        table.append(row)
    (_EVIDENCE / "board-summary.json").write_text(json.dumps(table, indent=2, default=str), encoding="utf-8")
    print("\nBOARD_TABLE")
    for row in table:
        cells = [row.get("blocked") and "⛔" or row["results"].get(k, {}).get("verdict", "—") for k in ("a", "b", "c")]
        print(f"| {row['provider']} | {row['model']} | " + " | ".join(cells) + " |")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--seed", action="store_true")
    g.add_argument("--run", action="store_true")
    ap.add_argument("--providers", default="")
    ap.add_argument("--prompts", default="abc")
    ap.add_argument("--timeout", type=int, default=300)
    args = ap.parse_args()
    kit.load_env()
    kit.assert_localhost_only()
    token = kit.get_bearer_token()
    user_id = _user_id(token)
    conn = kit.connect_db()
    conn.autocommit = True
    org_id = _single_org(conn, user_id)
    print(f"dev user {user_id} · single org {org_id} (asserted from org_members)")
    return seed(token, org_id, user_id, conn) if args.seed else run_board(token, org_id, conn, args)


if __name__ == "__main__":
    sys.exit(main())
