"""Phase 075.3 Plan 01 Task 1 — probe Google's OpenAI-compat usage shape.

Locks D-075.3-01: pins whether Google's ``chunk.usage`` carries cumulative
running totals (overwrite-last-wins) or per-chunk deltas (``+=``).

Usage:
    cd backend && source venv/bin/activate            # Linux / macOS
    python scripts/probe_google_usage_shape.py

    # Windows PowerShell:
    cd backend
    venv\\Scripts\\python.exe scripts\\probe_google_usage_shape.py

Output:
    Per-chunk raw usage values + a concrete cumulative-vs-delta verdict.

Cost: ~$0.001 (one Gemini 2.5 Flash call, "count to five" prompt, ~30 tokens).

Security note (T-075.3-01-03): reads ``settings.google_api_key`` and passes
it into ``OpenAI(api_key=...)``. The key itself is NEVER printed / logged /
repr'd. Only token counts + verdict reach stdout.
"""
from __future__ import annotations

import os
import sys

# Mirror probe_multimodal.py:24 idiom — backend root on path so
# `from app.config import settings` resolves whether the script is invoked
# from `backend/` or via `python -m scripts.probe_google_usage_shape`.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from openai import OpenAI  # noqa: E402

from app.config import settings  # noqa: E402


def main() -> None:
    api_key = settings.google_api_key
    if not api_key:
        raise SystemExit(
            "GOOGLE_API_KEY not set in backend env — populate before running probe."
        )
    # SECURITY: do NOT print(api_key) anywhere. Pass directly into the SDK.

    client = OpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )

    print("Probing gemini-2.5-flash with prompt 'count to five'...")
    print()
    stream = client.chat.completions.create(
        model="gemini-2.5-flash",
        messages=[{"role": "user", "content": "count to five"}],
        stream=True,
        stream_options={"include_usage": True},
        max_tokens=200,
    )

    chunks_seen: list[dict] = []
    for i, chunk in enumerate(stream):
        usage = chunk.usage
        content = ""
        finish = None
        if chunk.choices:
            content = chunk.choices[0].delta.content or ""
            finish = chunk.choices[0].finish_reason
        row = {
            "i": i,
            "content_len": len(content),
            "content_preview": content[:30],
            "has_usage": usage is not None,
            "prompt_tokens": getattr(usage, "prompt_tokens", None) if usage else None,
            "completion_tokens": getattr(usage, "completion_tokens", None) if usage else None,
            "finish_reason": finish,
        }
        chunks_seen.append(row)
        print(
            f"chunk[{i:2d}]: "
            f"content_len={row['content_len']:3d} "
            f"has_usage={row['has_usage']} "
            f"p={row['prompt_tokens']} c={row['completion_tokens']} "
            f"finish={row['finish_reason']!r}"
        )

    print()
    print("=" * 60)
    print("VERDICT")
    print("=" * 60)

    completion_tokens_series = [
        c["completion_tokens"] for c in chunks_seen if c["completion_tokens"] is not None
    ]
    if not completion_tokens_series:
        print("INCONCLUSIVE: no chunk carried usage. Re-run with longer prompt.")
        return

    if len(completion_tokens_series) == 1:
        print(
            "INCONCLUSIVE: only one chunk carried usage. "
            "Google OpenAI-compat appears to follow strict OpenAI shape "
            "(usage on final chunk only). Sum-via-`+=` is safe — same as OpenAI."
        )
        print(f"  Series: {completion_tokens_series}")
        return

    is_monotonic_increasing = all(
        completion_tokens_series[i] <= completion_tokens_series[i + 1]
        for i in range(len(completion_tokens_series) - 1)
    )
    final_val = completion_tokens_series[-1]
    sum_val = sum(completion_tokens_series)

    if is_monotonic_increasing and sum_val > final_val * 1.5:
        print("CUMULATIVE — overwrite-last-wins is required.")
        print(f"  Series: {completion_tokens_series}")
        print(f"  Final value (= correct total): {final_val}")
        print(f"  Sum-via-`+=` would yield:       {sum_val} (WRONG — over-count)")
        print()
        print("Plan 01 D-075.3-02 confirmed: Google branch MUST overwrite, NOT accumulate.")
    elif not is_monotonic_increasing or sum_val == final_val:
        print("DELTA — `+=` is required.")
        print(f"  Series: {completion_tokens_series}")
        print(f"  Sum (= correct total): {sum_val}")
        print()
        print("Plan 01 D-075.3-02 OVERTURNED: Google branch needs `+=` like OpenAI.")
    else:
        print(f"AMBIGUOUS: series={completion_tokens_series}")
        print(f"  final={final_val} sum={sum_val} monotonic_increasing={is_monotonic_increasing}")
        print("Manually inspect; may need longer prompt to disambiguate.")


if __name__ == "__main__":
    main()
