"""Minimal Redis-stream event monitor for a live agent run.

Usage: python scripts/run_event_monitor.py <run_id>

Emits one line per *interesting* event (skips sub_agent_delta / planning /
code_stdout / delta noise). Exits when the run is complete.
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections import Counter

import redis

if len(sys.argv) < 2:
    print("usage: run_event_monitor.py <run_id>", flush=True)
    sys.exit(2)

run_id = sys.argv[1]
stream = f"run:{run_id}"
url = os.environ.get("REDIS_URL", "redis://localhost:6379")
r = redis.Redis.from_url(url, decode_responses=True)

counts: Counter[str] = Counter()
last = "0"
TERMINAL = {"completion_done", "run_complete", "stream_end"}
print(f"[monitor] {stream}", flush=True)

deadline = time.time() + 1500
while time.time() < deadline:
    try:
        evs = r.xread({stream: last}, count=500, block=8000)
    except Exception as e:
        print(f"[monitor] redis error: {e}", flush=True)
        time.sleep(3)
        continue
    if not evs:
        continue
    for _stream, msgs in evs:
        for mid, fields in msgs:
            last = mid
            raw = fields.get("data") or fields.get("event") or "{}"
            try:
                ev = json.loads(raw)
            except Exception:
                continue
            t = ev.get("type", "?")
            counts[t] += 1
            if t == "tool_args_progress":
                bytes_ = ev.get("total_args_bytes_so_far") or ev.get("args_bytes_streamed")
                name = ev.get("name") or ev.get("tool_name") or "?"
                idx = ev.get("tool_index") if "tool_index" in ev else ev.get("index", "?")
                print(
                    f"[ARGS-PROG #{counts[t]}] tool={name} idx={idx} bytes={bytes_}",
                    flush=True,
                )
            elif t == "iteration_start":
                print(f"[ITER] iteration={ev.get('iteration','?')}", flush=True)
            elif t == "tool_preparing":
                print(f"[PREP] tool={ev.get('name','?')} idx={ev.get('index','?')}", flush=True)
            elif t == "tool_start":
                args_keys = list((ev.get("args") or {}).keys())
                print(f"[START] tool={ev.get('name','?')} args_keys={args_keys}", flush=True)
            elif t == "tool_end":
                print(f"[END] tool={ev.get('name','?')}", flush=True)
            elif t == "sub_agent_start":
                print(
                    f"[SUB-START] kind={ev.get('kind','?')} desc={(ev.get('description') or '')[:80]}",
                    flush=True,
                )
            elif t == "sub_agent_done":
                print(f"[SUB-DONE] kind={ev.get('kind','?')}", flush=True)
            elif t == "error":
                print(f"[ERROR] {json.dumps(ev)[:300]}", flush=True)
            elif t in TERMINAL:
                print(f"[DONE] type={t} | counts={dict(counts)}", flush=True)
                sys.exit(0)

print(f"[monitor] deadline reached. counts={dict(counts)}", flush=True)
