---
id: BUG-260916-01
title: A per-model timeout above 600s is accepted by the UI and silently cannot take effect — slow local models time out mid-task
reported: 2026-09-16
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/provider-routing, backend/agent-loop, admin/model-registry, local-models]
folded_into: null
verified_closed_by: null
related_seeds: ["SEED-289", "SEED-172"]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 3368dd444
  date: 2026-09-16
---

# BUG-260916-01: A timeout above 600s is accepted and cannot take effect

## What we observed

**Operator report, 2026-09-16, verbatim:** *"the local LLM is running on my GPU and it's slow …
it was timing out before it completes the task because it is slow on the GPU."*

**Measured on this commit, not reasoned:**

`get_llm_client` (`backend/app/services/openai_service.py:1251-1265`) builds `OpenAI(**kwargs)`
with **only** `api_key` and `base_url`. It passes **no `timeout=` and no `max_retries=`**, so the
SDK's own defaults bind. Read from the installed SDK:

```
openai SDK version       : 2.28.0
SDK DEFAULT_TIMEOUT      : Timeout(connect=5.0, read=600, write=600, pool=600)
SDK DEFAULT_MAX_RETRIES  : 2
built client .timeout    : Timeout(connect=5.0, read=600, write=600, pool=600)
built client .max_retries: 2
```

Meanwhile the app has its OWN per-model budget, `llm_call_timeout_seconds`, resolved 4-tier by
`get_per_call_timeout_async` and applied as the agent loop's per-call budget
(`agent_loop.py:2343`, `:2411`). The admin surface accepts a value in
`[_LLM_CALL_TIMEOUT_MIN_S, _LLM_CALL_TIMEOUT_MAX_S]` = **`[1, 3600]`**
(`config.py:665-666`, enforced at `admin.py:194`).

⛔ **So the effective ceiling is `min(per_model_budget, 600)` and NOTHING SAYS SO.** A value
between 601 and 3600 is accepted, stored, displayed back, and cannot do anything.

⭐ **THE OPERATOR ALREADY HIT THIS AND WORKED AROUND IT — WHICH IS THE EVIDENCE IT IS REAL.**
Their six LM Studio registry rows, read live:

| model_id | `llm_call_timeout_seconds` | effective |
|---|---|---|
| `openai/gpt-oss-20b` | **900** | **600** |
| `qwen3.5-9b-mtp` | **900** | **600** |
| `qwen3.6-35b-a3b-mtp` | **900** | **600** |
| `glm-4.7-flash` | 550 | 550 |
| `nvidia_nvidia-nemotron-nano-9b-v2` | 550 | 550 |
| `qwen-agentworld-35b-a3b` | 550 | 550 |

**Three rows are set to 900.** Somebody deliberately raised those past the default because the
model was too slow — and got 600.

⚠ **AND THE OTHER 13 LOCAL MODELS HAVE NO ROW AT ALL**, so they resolve
`_INFERRED_DEFAULT_TIMEOUT_S = 300` (`config.py:554`). That is the 5-minute cut-off the operator
is describing. The tool-loss set measured on `BUS-246` and this set are **the same models**.

## Why it matters

**Major.** A slow local model is the exact case the operator is building for, and the one control
that would fix it is a control that lies:

1. **A setting that cannot work is worse than a missing one.** A missing control sends you looking
   for another answer. A control you set to 900, which reports 900 back, sends you looking for a
   bug elsewhere — which is where the operator spent this time.
2. **Retries multiply the wait on the slowest hardware.** `max_retries=2` is 3 attempts. A model
   that cannot answer within 600s burns the budget again on each retry, so the operator waits far
   longer than the number they set before seeing a failure.
3. ⛔ **The failure is a timeout, not a capability error**, so nothing in the product attributes
   it to the timeout setting. It reads as "the local model doesn't work."

## Hypothesized cause

**Finding, not hypothesis** — the client construction and both SDK defaults were read directly on
this commit. What remains a hypothesis is only the retry interaction: whether the SDK's retry of an
`APITimeoutError` is reached before the loop's own `per_call_budget` cancels the call depends on
which number is larger, and that was **not** driven end to end here.

⚠ **This was already half-recorded and not acted on.** `BUS-246` carried it as *SEED-172 finding
#2*: *"`get_llm_client` sets no `timeout=`, so httpx's 600s read timeout binds above that and
`max_retries=2` triples the attempt. That bites exactly the local models this phase just
unblocked."* ⭐ **That note attributed the 600 to httpx and it is the OpenAI SDK's own
`DEFAULT_TIMEOUT` — httpx's own default is 5s.** The number was right, the mechanism named was
wrong, and it stayed open either way.

## Surface classification

`Agentic-RAG`. Backend provider routing plus the admin Model Registry surface that accepts the
value.

## Suggested routing

- **Fold into in-flight phase:** n/a — 252 is closed and 253 is scoped to the schema-ACL gap.
- **Defer to future phase / milestone:** yes — the **same phase as `SEED-289`**. Both are about
  the app guessing a local model's properties instead of serving the operator's own configuration,
  and both bite the identical model set.
- **Plant as seed:** covered by `SEED-289`; this report is its concrete, operator-observed half.
- **External — note only:** no.

### What the fix has to cover

1. **Pass the resolved budget to the client.** `get_llm_client` must receive the per-model
   `llm_call_timeout_seconds` and set `timeout=` from it, so the SDK stops imposing an invisible
   second ceiling.
2. **Decide `max_retries` deliberately.** 3 attempts against slow local hardware is a choice
   nobody made; it is the SDK default arriving by omission.
3. ⛔ **Make the bound honest either way.** If 3600 stays the accepted maximum, it must actually
   work; if a lower ceiling is correct, the UI must refuse above it and say why. **A stored value
   the system cannot honour is the defect, independent of which number is right.**

## Workarounds (prompt-side, code-side, or UI-side)

- **Today:** keep `llm_call_timeout_seconds` **at or below 600** so the number you set is the
  number you get. Above 600 is indistinguishable from 600.
- **For the 13 rowless local models**, add a registry row at all — otherwise they run on the 300s
  inferred default, which is half the reachable ceiling.

## Reference / evidence links

- `backend/app/services/openai_service.py:1251-1265` — `get_llm_client`, no `timeout=`, no
  `max_retries=`.
- `backend/app/config.py:554` — `_INFERRED_DEFAULT_TIMEOUT_S = 300`; `:658` —
  `DEFAULT_LLM_CALL_TIMEOUT_SECONDS = 300`; `:665-666` — the `[1, 3600]` bound.
- `backend/app/api/admin.py:194` — where that bound is enforced on operator input.
- `backend/app/services/agent_loop.py:2343`, `:2411` — where `per_call_budget` is applied.
- SDK defaults read live on `openai==2.28.0` (see table above).
- Live registry rows read from `model_capabilities_overrides`, 2026-09-16.
- `BUS-246` — the earlier half-record, with the mechanism misattributed to httpx.
- `SEED-289` — the sibling finding on the same model set.
