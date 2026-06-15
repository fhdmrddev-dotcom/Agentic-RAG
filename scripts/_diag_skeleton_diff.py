"""TEMP diagnostic (092.5-06 BLOCK triage). Offline skeleton diff per provider.
Pure: reads saved JSON, no network/keys. Delete after use."""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from scripts.capture_run_events import skeleton, diff_skeletons  # noqa: E402

BASE = pathlib.Path("scripts/.sse_baseline")
AFTER = pathlib.Path("scripts/.sse_after")
PROVIDERS = ["openai", "anthropic", "google", "deepseek", "moonshot", "zhipu", "minimax", "openrouter"]


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


for prov in PROVIDERS:
    bp, ap = BASE / f"{prov}.json", AFTER / f"{prov}.json"
    if not bp.exists() or not ap.exists():
        print(f"\n===== {prov}: MISSING ({'baseline' if not bp.exists() else 'after'}) =====")
        continue
    before, after = load(bp), load(ap)
    sb, sa = skeleton(before), skeleton(after)
    diffs = diff_skeletons(before, after)
    # terminal classification of each side
    def terminal(events):
        for e in reversed(events):
            if e.get("type") in ("done", "stream_end"):
                return f"{e.get('type')}(error={e.get('error') is not None})"
        return "NO-TERMINAL"
    print(f"\n===== {prov}: {len(diffs)} edit-region(s) | BEFORE {len(before)}ev/{len(sb)}skel  AFTER {len(after)}ev/{len(sa)}skel =====")
    print(f"  terminal: BEFORE={terminal(before)}  AFTER={terminal(after)}")
    for op, b, a in diffs:
        print(f"  [{op}] before={b}  ->  after={a}")
