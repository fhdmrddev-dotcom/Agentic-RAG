# SSE-Diff Runbook — Phase 089 byte-identical native-7 proof (SC#3)

> **Authored by Claude. EXECUTED by the operator.** The live provider keys live only
> in the operator's `backend/.env`, so the operator runs every step here. Claude does
> not run this driver (D-089-11 hybrid). After capturing the BEFORE baseline, the
> operator pastes the per-provider confirmation back.

The Phase 089 agent-loop extraction (`threads.py` → `backend/app/services/agent_loop.py`)
is a PURE behavior-preserving lift. Its acceptance bar is **byte-identical SSE per
provider**, NOT "tests pass" — the suite mocks the LLM and so proves only plumbing,
never the per-provider round-trip invariants. The proof is two-pronged (D-089-08):

- **(a) SSE structural-skeleton diff:** capture each provider's SSE event sequence
  BEFORE the lift, capture the identical run AFTER, assert the **structural-skeleton**
  diff is EMPTY (`diff_skeletons`).
- **(b) Eval backstop:** `scripts/eval_cross_provider.py` `EVAL_SUMMARY` native-7 all-pass
  BEFORE and AFTER.

> **SC#3 MECHANISM NOTE (established empirically 2026-05-30).** A *raw* per-index
> SSE diff is NOT a valid gate: repeating the SAME pre-move loop on Anthropic 3×
> produced 36 / 33 / 34 events — the LLM streams the same content in a varying number
> of `delta` / `tool_args_progress` chunks, so the raw diff is non-empty even with
> ZERO code change. The **structural skeleton** (`capture_run_events.skeleton` /
> `diff_skeletons` — event-type order + tool names/sequence + code-exec lifecycle +
> terminal classification, collapsing the volatile chunk-types) WAS byte-identical
> across all 3 runs (24-token skeleton). The skeleton is the SC#3 pass/fail gate; the
> raw `diff_event_streams` is kept for forensic inspection only. The turnkey driver
> `scripts/capture_sse_baseline.py --mode after` already gates on the skeleton.

**This plan (089-02) runs in Wave 1 — BEFORE the verbatim move (Plan 03) and the CF-01
sweep (Plan 04). So the BEFORE baseline below is captured against the PRE-MOVE loop NOW.**
The AFTER procedure runs in Plan 04 / post-lift.

---

## 0. Prereqs (operator)

1. **Start the backend uvicorn yourself in a visible terminal — NEVER `run_in_background`.**
   (`feedback_user_starts_backend`; Claude never starts the backend for this driver.)
   Multi-worker default is fine (`WORKER_COUNT=2`).
2. Local **Supabase** up (`supabase start`) and local **Redis** up
   (`docker compose -f docker-compose.dev.yml up -d`). The capture reads the
   `run:{run_id}` Redis stream directly.
3. **Native-7 keys present** in `backend/.env`. Confirm with the eval's presence report
   (presence only — never values):
   ```
   backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --help
   ```
   then run the eval once (step 4 below) and read its
   `## Environment (presence only — secret VALUES are never printed)` block —
   `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / (deepseek/moonshot keys) /
   `ZHIPU_API_KEY` / `MINIMAX_API_KEY` must each read `set`.
4. The localhost hard-gate refuses any non-localhost `SUPABASE_URL` — keep `backend/.env`
   pointed at LOCAL Supabase.

> **native-7** = `openai`, `anthropic`, `google`, `deepseek`, `moonshot`, `zhipu`/GLM,
> `minimax` (D-089-05; `_PROVIDER_BASE_URLS` is the source of truth). These are the hard
> pass/fail bar. OpenRouter is best-effort (logged, not blocking — D-089-07); Ollama is
> opportunistic.

The per-provider models come from `scripts/eval_cross_provider.py` `PROVIDERS`:

| Provider | Model (PROVIDERS row) |
|----------|-----------------------|
| openai | `gpt-5.4-mini` |
| anthropic | `claude-haiku-4-5` |
| google | `gemini-3.5-flash` |
| deepseek | `deepseek-v4-flash` |
| moonshot | `kimi-k2.6` |
| zhipu | `glm-4-flash` |
| minimax | `minimax-m2.7` |

---

## 1. The representative multi-tool prompt (PINNED — identical before + after)

Claude's discretion per D-089-10; SC#10 multi-tool axis. **Use this exact string for
every provider, before AND after** — identical input is what makes the diff meaningful.

**`SSE_DIFF_PROMPT`** (primary — `search_documents` + `execute_code`):

```
Search my documents for the main research question, then write and run Python code that prints a one-line summary of what you found.
```

**`SSE_DIFF_PROMPT_TODOS`** (variant — `write_todos` + `execute_code`, the BUG-260529-01
arg-shape surface):

```
Plan a 3-step analysis of my Q3 data as a todo list, then write and run code that prints the first step.
```

Run the primary prompt for the SSE-diff. The todos variant is an optional second capture
that exercises the `write_todos` arg-shape path on weak models.

---

## 2. BEFORE procedure (run NOW — Wave 1, against the pre-move loop)

For **each** native-7 provider, drive the pinned prompt through the REAL HTTP route
(per-request provider/model override — NOT a `user_settings` UPDATE — so no global state
mutation), wait for terminal, then capture + normalize the SSE stream and save it.

The capture utilities are in `scripts/capture_run_events.py`:
`capture_run_events(redis, run_id)` (reads `XRANGE run:{run_id} - +`),
`normalize(events)` (drops `captured_at`, masks `message_id`/`run_id`), and
`diff_event_streams(before, after)` (`[]` == PASS).

```python
# operator-run driver (uses the eval's own auth + route helpers + the capture helper).
# Run inside the backend venv: backend/venv/Scripts/python.exe this_driver.py
import asyncio, json, pathlib
import redis.asyncio as aioredis

from scripts.eval_cross_provider import (
    load_env, assert_localhost_only, get_bearer_token, connect_db,
    create_thread, run_prompt, wait_for_run, PROVIDERS, DEFAULT_RUN_TIMEOUT_S,
)
from scripts.capture_run_events import capture_run_events, normalize

SSE_DIFF_PROMPT = (
    "Search my documents for the main research question, then write and run "
    "Python code that prints a one-line summary of what you found."
)
BASELINE_DIR = pathlib.Path("scripts/.sse_baseline")   # BEFORE per-provider save path


async def main():
    load_env()
    assert_localhost_only()
    token = get_bearer_token()
    conn = connect_db()
    redis = aioredis.from_url(__import__("os").getenv("REDIS_URL", "redis://localhost:6379"),
                              decode_responses=True)
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    for provider, model in PROVIDERS:                      # native-7 (+ openrouter best-effort)
        thread_id = create_thread(token, f"sse-diff {provider}")
        run_id = run_prompt(token, thread_id, SSE_DIFF_PROMPT, provider, model)
        status = wait_for_run(conn, run_id, DEFAULT_RUN_TIMEOUT_S)
        events = normalize(await capture_run_events(redis, run_id))
        (BASELINE_DIR / f"{provider}.json").write_text(
            json.dumps(events, indent=2), encoding="utf-8")
        print(f"BEFORE {provider}/{model}: status={status}, {len(events)} events "
              f"-> scripts/.sse_baseline/{provider}.json")
    conn.close()
    await redis.aclose()

asyncio.run(main())
```

**Save path:** `scripts/.sse_baseline/<provider>.json` (one normalized event list per
native-7 provider). Commit these (or stash them where Plan 04 can read them) so the
AFTER run can diff against them. Note any provider whose run did not reach `completed` —
that is a capture problem to resolve before the lift, not a pass.

---

## 3. AFTER procedure (Plan 04 / post-lift)

Just run the turnkey driver in AFTER mode — it captures the identical pinned prompt per
provider against the EXTRACTED loop and asserts an empty **structural-skeleton** diff
against each saved baseline:

```
backend/venv/Scripts/python.exe scripts/capture_sse_baseline.py --mode after
```

It prints per-provider `PASS — skeleton identical` / `BLOCK — N structural skeleton diffs`
and a final `SSE_DIFF_RESULT: PASS|BLOCK` line. Equivalent inline form:

```python
from scripts.capture_run_events import capture_run_events, normalize, diff_skeletons
after = normalize(await capture_run_events(redis, run_id))
before = json.loads((BASELINE_DIR / f"{provider}.json").read_text(encoding="utf-8"))
diff = diff_skeletons(before, after)   # structural skeleton — the SC#3 gate
print(f"AFTER {provider}: {'PASS (empty skeleton diff)' if diff == [] else f'BLOCK — {len(diff)} structural diffs'}")
for idx, b, a in diff:
    print(f"  [{idx}] before={b}  after={a}")
```

- **Empty `diff_skeletons(before, after) == []` per native-7 provider == SC#3 PASS.**
- **Any non-empty SKELETON diff on a native-7 provider == the lift changed observable
  structure → investigate.** Re-run before+after 2–3× to rule out occasional LLM
  tool-path noise (the agent choosing a different number of tool calls); a *persistent*
  structural diff == a real regression → BLOCK the phase, do NOT proceed. (OpenRouter
  skeleton diff is logged, not blocking — D-089-07.)
- The raw `diff_event_streams` diff is expected to be non-empty (chunk-noise) and is
  informational only — never gate on it.

---

## 4. Native-7 gate vs OpenRouter best-effort

| Provider class | SSE-diff disposition |
|----------------|----------------------|
| native-7 (openai/anthropic/google/deepseek/moonshot/zhipu/minimax) | **HARD** — any non-empty diff blocks the phase |
| openrouter | best-effort — diff logged, NOT blocking (D-089-07) |
| ollama | opportunistic — capture if a local model is available |

---

## 5. Eval backstop (D-089-08 b) — run BEFORE and AFTER

In addition to the SSE-diff, run the cross-provider eval the full matrix BEFORE the lift
and AFTER, and record the `EVAL_SUMMARY` line both times:

```
backend/venv/Scripts/python.exe scripts/eval_cross_provider.py
```

- Expect the native-7 cells all `PASS` and the final `EVAL_SUMMARY N/M cells PASS` line to
  be identical (or strictly non-regressing) before vs after. Save both scoreboards.
- A single provider re-run for a fast check:
  `... scripts/eval_cross_provider.py --provider zhipu --prompt multi-tool`.

Both the empty SSE diff (per native-7 provider) AND the unchanged `EVAL_SUMMARY` native-7
all-pass are required for SC#3 to be green.
