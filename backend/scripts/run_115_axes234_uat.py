"""Phase 115 SC#10 axes 2-4 — multi-tool, parallel-thread, long-message.

Drives the real Deep agent loop via the authenticated chat endpoint.
  Axis 2 (multi-tool): one prompt should emit query_documents_by_view AND search_documents.
  Axis 3 (parallel-thread): two threads fired ~concurrently; verify each thread's tool
          result/source_refs are scoped to its own run (no cross-thread bleed).
  Axis 4 (long-message): a >= 5 KB prompt ending in the view-tool call; verify it still fires.

TOK env = a logged-in browser JWT. Writes scripts/115_axes234_results.json
"""
import os, json, time, threading, urllib.request, urllib.error
import psycopg2

TOK = os.environ["TOK"]
BASE = "http://localhost:8000"
DSN = "postgresql://postgres:postgres@localhost:54322/postgres"
TOOL = "query_documents_by_view"
MODEL, PROVIDER = "gpt-5.4-mini", "openai"  # confirmed-clean tool emitter for the axis proofs


def api(method, path, body=None, timeout=150):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Authorization": "Bearer " + TOK, "Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(r, timeout=timeout)
        return resp.status, json.loads(resp.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def new_thread(title):
    st, thr = api("POST", "/threads", {"title": title})
    return thr.get("id") if isinstance(thr, dict) else None


def poll(conn, run_id, limit=140):
    t0 = time.time(); status = None
    while time.time() - t0 < limit:
        cur = conn.cursor(); cur.execute("select status, error from runs where run_id=%s", (run_id,))
        row = cur.fetchone(); conn.commit(); cur.close()
        status = row[0] if row else None
        if status in ("completed", "failed", "cancelled", "error"):
            return status, (row[1] if row else None)
        time.sleep(3)
    return status, "timeout"


def tools_used(msgs):
    names, qdv = [], None
    for m in msgs:
        for tc in (m.get("tool_calls") or []):
            names.append(tc.get("name"))
            if tc.get("name") == TOOL:
                qdv = tc.get("args") or tc.get("arguments")
    return names, qdv


def source_ref_ids(msgs):
    ids = set()
    for m in msgs:
        for c in (m.get("citations") or []):
            ids.add(c.get("document_id") or c.get("id"))
    return ids


def final_answer(msgs):
    for m in reversed(msgs):
        if m.get("role") == "assistant" and (m.get("content") or "").strip():
            return m["content"][:300]
    return ""


def main():
    conn = psycopg2.connect(DSN)
    out = {}

    # ── Axis 2: multi-tool ──────────────────────────────────────────────
    tid = new_thread("115 multitool")
    prompt = ("List the documents in my \"Reports\" view, then search my documents for "
              "anything about RPA adoption success factors. Use the right tool for each step.")
    st, resp = api("POST", f"/threads/{tid}/messages",
                   {"content": prompt, "model": MODEL, "provider": PROVIDER, "agent_mode": "default"})
    status, err = poll(conn, resp.get("run_id")) if isinstance(resp, dict) and resp.get("run_id") else ("post_fail", resp)
    _, msgs = api("GET", f"/threads/{tid}/messages")
    msgs = msgs if isinstance(msgs, list) else []
    names, qdv = tools_used(msgs)
    out["multi_tool"] = {"run_status": status, "tools_used": names,
                          "has_query_documents_by_view": TOOL in names,
                          "has_search_documents": "search_documents" in names,
                          "qdv_args": qdv, "answer": final_answer(msgs)}
    print("AXIS2 multi-tool:", out["multi_tool"]["tools_used"])

    # ── Axis 3: parallel-thread (fire two threads ~concurrently) ────────
    tA, tB = new_thread("115 parallel A"), new_thread("115 parallel B")
    runs = {}

    def fire(tid_, key, content):
        st_, r_ = api("POST", f"/threads/{tid_}/messages",
                      {"content": content, "model": MODEL, "provider": PROVIDER, "agent_mode": "default"})
        runs[key] = r_.get("run_id") if isinstance(r_, dict) else None

    thA = threading.Thread(target=fire, args=(tA, "A", "Open my \"Reports\" view; how many documents are in it?"))
    thB = threading.Thread(target=fire, args=(tB, "B", "Open my \"Dana's Docs\" view; how many documents are in it?"))
    thA.start(); thB.start(); thA.join(); thB.join()
    sA, _ = poll(conn, runs.get("A")) if runs.get("A") else ("post_fail", None)
    sB, _ = poll(conn, runs.get("B")) if runs.get("B") else ("post_fail", None)
    _, mA = api("GET", f"/threads/{tA}/messages"); mA = mA if isinstance(mA, list) else []
    _, mB = api("GET", f"/threads/{tB}/messages"); mB = mB if isinstance(mB, list) else []
    nA, qA = tools_used(mA); nB, qB = tools_used(mB)
    idsA, idsB = source_ref_ids(mA), source_ref_ids(mB)
    out["parallel_thread"] = {
        "A": {"run_status": sA, "qdv_args": qA, "answer": final_answer(mA), "n_source_refs": len(idsA)},
        "B": {"run_status": sB, "qdv_args": qB, "answer": final_answer(mB), "n_source_refs": len(idsB)},
        "source_refs_disjoint": idsA.isdisjoint(idsB) if (idsA and idsB) else None,
        "distinct_views_requested": qA != qB,
    }
    print("AXIS3 parallel:", "A.qdv=", qA, "B.qdv=", qB, "disjoint_refs=", out["parallel_thread"]["source_refs_disjoint"])

    # ── Axis 4: long-message (>= 5 KB prompt ending in the view call) ───
    filler = ("Context dump (ignore this filler, it is only here to make the prompt long). " * 120)
    assert len(filler) >= 5000, len(filler)
    tid = new_thread("115 longmsg")
    long_prompt = filler + "\n\nNow, ignoring all the filler above: open my \"Reports\" view and tell me exactly how many documents it contains."
    st, resp = api("POST", f"/threads/{tid}/messages",
                   {"content": long_prompt, "model": MODEL, "provider": PROVIDER, "agent_mode": "default"})
    status, err = poll(conn, resp.get("run_id")) if isinstance(resp, dict) and resp.get("run_id") else ("post_fail", resp)
    _, msgs = api("GET", f"/threads/{tid}/messages"); msgs = msgs if isinstance(msgs, list) else []
    names, qdv = tools_used(msgs)
    out["long_message"] = {"prompt_bytes": len(long_prompt), "run_status": status,
                            "emitted_tool": TOOL in names, "qdv_args": qdv, "answer": final_answer(msgs)}
    print("AXIS4 long-message:", "emitted=", TOOL in names, "args=", qdv)

    conn.close()
    with open("scripts/115_axes234_results.json", "w") as f:
        json.dump(out, f, indent=1)
    print("\nWROTE scripts/115_axes234_results.json")


if __name__ == "__main__":
    main()
