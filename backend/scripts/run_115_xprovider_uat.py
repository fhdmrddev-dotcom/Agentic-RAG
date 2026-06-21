"""Phase 115 SC#10 axis-1 — cross-provider live tool-emission UAT.

Drives the REAL Deep agent loop (POST /threads/{tid}/messages, agent_mode=default)
for each native-7 provider + OpenRouter, sending 3 query modes (catalog / saved-view /
inline-filter). Observes whether the live model emits `query_documents_by_view`, fills
the polymorphic arg correctly, and gets the leak-safe resolved total.

Auth: TOK env (a logged-in browser JWT for the UAT user). Run:
  TOK="<jwt>" venv/Scripts/python scripts/run_115_xprovider_uat.py
Writes results to scripts/115_xprovider_results.json
"""
import os, json, time, urllib.request, urllib.error
import psycopg2

TOK = os.environ["TOK"]
BASE = "http://localhost:8000"
DSN = "postgresql://postgres:postgres@localhost:54322/postgres"
UAT_USER = "d8a54002-6a29-4b88-b918-cff2aa4a06d5"
TOOL = "query_documents_by_view"

# representative model per provider (solid tool-users; Gemini = schema proof; MiniMax = watch-point)
PROVIDERS = [
    ("openai", "gpt-4o"),
    ("anthropic", "claude-sonnet-4-6"),
    ("google", "gemini-2.5-flash"),
    ("deepseek", "deepseek-v4-pro"),
    ("moonshot", "kimi-k2.6"),
    ("zhipu", "glm-5.1"),
    ("minimax", "MiniMax-M2.7"),
    ("openrouter", "deepseek/deepseek-v4-pro"),
]

QUERIES = [
    ("catalog", "What saved views and filterable document fields do I have available? List them."),
    ("saved_view", "Open my \"Reports\" view and tell me exactly how many documents it contains."),
    ("inline_filter", "Using my documents, how many have a document_type of \"financial report\"? Give the number."),
]


def api(method, path, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Authorization": "Bearer " + TOK,
                                        "Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(r, timeout=timeout)
        return resp.status, json.loads(resp.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, (e.read().decode()[:300])


def run_status(conn, run_id):
    cur = conn.cursor()
    cur.execute("select status, error from runs where run_id=%s", (run_id,))
    row = cur.fetchone(); cur.close()
    return row if row else (None, None)


def find_tool_call(messages):
    """Return the query_documents_by_view tool_call dict from the latest assistant msg, or None."""
    for m in reversed(messages):
        for tc in (m.get("tool_calls") or []):
            if tc.get("name") == TOOL:
                return tc
    return None


def latest_assistant_text(messages):
    for m in reversed(messages):
        if m.get("role") == "assistant" and (m.get("content") or "").strip():
            return (m.get("content") or "")[:400]
    return ""


def main():
    conn = psycopg2.connect(DSN)
    results = []
    for provider, model in PROVIDERS:
        # fresh thread per provider
        st, thr = api("POST", "/threads", {"title": f"115 UAT {provider}"})
        if st not in (200, 201) or not isinstance(thr, dict):
            results.append({"provider": provider, "model": model, "error": f"thread create {st}: {thr}"})
            continue
        tid = thr.get("id") or thr.get("thread_id")
        pres = {"provider": provider, "model": model, "thread": tid, "queries": {}}
        for qkey, prompt in QUERIES:
            st, resp = api("POST", f"/threads/{tid}/messages",
                           {"content": prompt, "model": model, "provider": provider, "agent_mode": "default"})
            if st not in (200, 201) or not isinstance(resp, dict):  # POST /messages returns 201
                pres["queries"][qkey] = {"post_status": st, "post_body": resp}
                continue
            run_id = resp.get("run_id")
            # poll to terminal
            status, err = "pending", None
            t0 = time.time()
            while time.time() - t0 < 100:
                status, err = run_status(conn, run_id)
                conn.commit()  # refresh snapshot
                if status in ("completed", "failed", "cancelled", "error"):
                    break
                time.sleep(3)
            # fetch messages for tool_calls
            mst, msgs = api("GET", f"/threads/{tid}/messages")
            msgs = msgs if isinstance(msgs, list) else []
            tc = find_tool_call(msgs)
            emitted = tc is not None
            args, total = None, None
            if tc:
                args = tc.get("args") or tc.get("arguments")
                res = tc.get("result")
                if isinstance(res, str):
                    try:
                        res = json.loads(res)
                    except Exception:
                        res = None
                if isinstance(res, dict):
                    total = res.get("total")
            pres["queries"][qkey] = {
                "run_status": status, "run_error": (err or "")[:160],
                "emitted_tool": emitted, "args": args, "resolved_total": total,
                "answer": latest_assistant_text(msgs),
            }
            time.sleep(1)
        results.append(pres)
        print(f"DONE {provider}/{model}: " + ", ".join(
            f"{q}={'EMIT' if v.get('emitted_tool') else v.get('run_status') or 'noemit'}"
            for q, v in pres["queries"].items()))
    conn.close()
    with open("scripts/115_xprovider_results.json", "w") as f:
        json.dump(results, f, indent=1)
    print("\nWROTE scripts/115_xprovider_results.json")


if __name__ == "__main__":
    main()
