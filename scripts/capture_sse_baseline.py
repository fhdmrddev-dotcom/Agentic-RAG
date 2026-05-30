"""Phase 089 SC#3 turnkey SSE-diff driver — capture BEFORE baseline / assert AFTER diff.

Materializes scripts/SSE_DIFF_RUNBOOK.md §2 (BEFORE) and §3 (AFTER) into one
operator-run command so the byte-identical native-7 proof is a single invocation
in each direction. Additive proof-harness tooling (D-089-09) — touches NO agent-loop code.

OPERATOR-RUN ONLY (live provider keys live in the operator's backend/.env, D-089-11).
Start uvicorn yourself in a visible terminal first (feedback_user_starts_backend);
local Supabase + Redis must be up. Run from the repo root inside the backend venv:

    # BEFORE the lift (Wave 1, against the pre-move loop) — saves baselines:
    backend/venv/Scripts/python.exe scripts/capture_sse_baseline.py --mode before

    # AFTER the lift (Plan 04, against the extracted loop) — asserts empty diff:
    backend/venv/Scripts/python.exe scripts/capture_sse_baseline.py --mode after

native-7 = openai, anthropic, google, deepseek, moonshot, zhipu/GLM, minimax (hard
pass/fail). OpenRouter best-effort (logged, not blocking — D-089-07). Any non-empty
native-7 diff in --mode after BLOCKS the phase: the lift changed behavior.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import pathlib
import sys

# --- repo-root bootstrap: `python scripts/x.py` puts scripts/ on sys.path, not the
#     repo root, so `from scripts.* import ...` would fail. Insert the repo root. ---
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

import redis.asyncio as aioredis  # noqa: E402

from scripts.eval_cross_provider import (  # noqa: E402
    PROVIDERS,
    DEFAULT_RUN_TIMEOUT_S,
    load_env,
    assert_localhost_only,
    get_bearer_token,
    connect_db,
    create_thread,
    run_prompt,
    wait_for_run,
)
from scripts.capture_run_events import (  # noqa: E402
    capture_run_events,
    normalize,
    diff_event_streams,
)

# The PINNED representative multi-tool prompt — identical BEFORE and AFTER
# (SSE_DIFF_RUNBOOK.md §1; search_documents + execute_code, SC#10 multi-tool axis).
SSE_DIFF_PROMPT = (
    "Search my documents for the main research question, then write and run "
    "Python code that prints a one-line summary of what you found."
)
BASELINE_DIR = pathlib.Path("scripts/.sse_baseline")

# native-7 are the hard pass/fail bar; openrouter/ollama are best-effort.
NATIVE_7 = {"openai", "anthropic", "google", "deepseek", "moonshot", "zhipu", "minimax"}


async def _run_one(token, conn, redis, provider: str, model: str):
    """Drive the pinned prompt through the real HTTP route, capture + normalize."""
    thread_id = create_thread(token, f"sse-diff {provider}")
    run_id = run_prompt(token, thread_id, SSE_DIFF_PROMPT, provider, model)
    status = wait_for_run(conn, run_id, DEFAULT_RUN_TIMEOUT_S)
    events = normalize(await capture_run_events(redis, run_id))
    return status, events


async def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 089 SC#3 SSE-diff driver")
    parser.add_argument(
        "--mode",
        choices=["before", "after"],
        default="before",
        help="before = capture + save baselines (Wave 1); after = diff vs baseline (Plan 04)",
    )
    parser.add_argument(
        "--provider",
        default=None,
        help="optional single-provider run (e.g. zhipu); default runs the full matrix",
    )
    args = parser.parse_args()

    load_env()
    assert_localhost_only()
    token = get_bearer_token()
    conn = connect_db()
    redis = aioredis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True
    )
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)

    targets = [(p, m) for p, m in PROVIDERS if args.provider in (None, p)]
    if not targets:
        print(f"No provider matched --provider {args.provider!r}. Known: "
              f"{[p for p, _ in PROVIDERS]}")
        conn.close()
        await redis.aclose()
        return 2

    native7_failures = []
    print(f"=== SSE-diff driver — mode={args.mode} — {len(targets)} provider(s) ===")
    for provider, model in targets:
        is_hard = provider in NATIVE_7
        tag = "native-7" if is_hard else "best-effort"
        try:
            status, events = await _run_one(token, conn, redis, provider, model)
        except Exception as exc:  # noqa: BLE001 — report, never abort the whole matrix
            print(f"  ✗ {provider}/{model} [{tag}]: capture FAILED — {type(exc).__name__}: {exc}")
            if is_hard:
                native7_failures.append((provider, f"capture error: {exc}"))
            continue

        if args.mode == "before":
            (BASELINE_DIR / f"{provider}.json").write_text(
                json.dumps(events, indent=2), encoding="utf-8")
            ok = status == "completed"
            mark = "✓" if ok else "⚠"
            print(f"  {mark} BEFORE {provider}/{model} [{tag}]: status={status}, "
                  f"{len(events)} events -> scripts/.sse_baseline/{provider}.json")
            if not ok and is_hard:
                native7_failures.append((provider, f"run status={status} (not completed)"))
        else:  # after
            baseline_path = BASELINE_DIR / f"{provider}.json"
            if not baseline_path.exists():
                print(f"  ✗ AFTER {provider} [{tag}]: NO baseline at {baseline_path} — "
                      f"run --mode before against the pre-move loop first")
                if is_hard:
                    native7_failures.append((provider, "missing BEFORE baseline"))
                continue
            before = json.loads(baseline_path.read_text(encoding="utf-8"))
            diff = diff_event_streams(before, events)
            if diff == []:
                print(f"  ✓ AFTER {provider}/{model} [{tag}]: status={status}, "
                      f"PASS (empty diff, {len(events)} events)")
            else:
                print(f"  ✗ AFTER {provider}/{model} [{tag}]: status={status}, "
                      f"BLOCK — {len(diff)} diffs")
                for idx, b, a in diff[:10]:
                    print(f"      [{idx}] before={b}  after={a}")
                if is_hard:
                    native7_failures.append((provider, f"{len(diff)} SSE diffs"))

    conn.close()
    await redis.aclose()

    print("=" * 60)
    if args.mode == "after":
        if native7_failures:
            print(f"SSE_DIFF_RESULT: BLOCK — {len(native7_failures)} native-7 provider(s) diverged:")
            for p, why in native7_failures:
                print(f"  - {p}: {why}")
            return 1
        print("SSE_DIFF_RESULT: PASS — all native-7 diffs empty (SC#3 byte-identical confirmed)")
        return 0
    else:
        if native7_failures:
            print(f"SSE_DIFF_RESULT: BASELINE INCOMPLETE — {len(native7_failures)} native-7 "
                  f"provider(s) did not capture cleanly (resolve before the lift):")
            for p, why in native7_failures:
                print(f"  - {p}: {why}")
            return 1
        print("SSE_DIFF_RESULT: BASELINE CAPTURED — all native-7 baselines saved to "
              "scripts/.sse_baseline/ (run --mode after in Plan 04)")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
