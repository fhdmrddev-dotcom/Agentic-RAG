---
seed_id: SEED-276
title: Every local Python script pays ~2 s per call because `localhost` resolves `::1` first while uvicorn binds IPv4 only — and that latency made one real bug structurally invisible to every drive harness in the repo
created: 2026-09-14
planted_during: BUS-171 triage of BUS-040 — found as an ORPHAN, named in a handover 14 days ago and held by no register
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - SEED-275 — a gate blind because of its SCAN SET. ⚠ SAME FAMILY, LOWER LAYER: this is a harness
    blind because of its TRANSPORT. Both are instruments that cannot see the thing they are pointed at.
  - SEED-274 — a gate whose threshold is not a stable property.
relates_to_registers:
  - "memory reference_vite_binds_ipv6_only — the FRONTEND half of the same asymmetry, already
    recorded: probe `localhost`, never `127.0.0.1`. ⚠ The backend half points the OPPOSITE way, which
    is exactly why one memory does not cover both."
trigger_when: >
  ANY of: (1) a local drive script, UAT harness or probe is written against the backend — this seed
  decides whether it uses `127.0.0.1` or `localhost`; (2) anyone reports local scripts being "slow"
  without a profiler; (3) a timing-sensitive or race-shaped bug is investigated with a Python client
  and NOT reproduced — the harness may be too slow to see it; (4) uvicorn's bind configuration is
  touched for any reason.
---

# SEED-276 — the harness was slower than the bug

## What was measured

Recorded in `BUS-040` (2026-08-31) and never given a home:

```
127.0.0.1  ->    4 ms
[::1]      -> 2048 ms
```

`localhost` resolves **`::1` first** on this box. **uvicorn binds IPv4 only.** So every Python client
using `localhost:8000` — `urllib`, `requests`, every drive script in this repo — waits out a full
IPv6 connection failure before falling back, **~2 seconds per call**.

## ⭐ Why it is worth a seed rather than a footnote

It did not merely cost time. **It made a real defect structurally unreachable.**

`BUS-040` found that the SSE stream answered `buffer_expired_while_streaming` when opened **0 ms**
after the send POST — the producer is detached and had not written the buffer yet, so healthy runs
were being killed. Its own words:

> ⚠ **NO DRIVE SCRIPT IN THIS REPO COULD EVER HAVE SEEN IT** — they are Python clients on
> `localhost:8000`, which resolves `::1` first while the backend binds IPv4 only … so urllib always
> lost the race while Chrome lost it the other way.

⛔ **A harness slower than the bug cannot see the bug.** The 2 s penalty was not noise around the
measurement; it *was* the reason the race never reproduced. Every script in the repo was, by
construction, testing a timeline in which the bug does not exist.

## ⚠ The asymmetry that makes one rule insufficient

This project already records the **frontend** half — *"vite binds IPv6 ONLY: probe `localhost`, never
`127.0.0.1`"*. **The backend half points the opposite way.** A single remembered rule of the form
*"always use X"* is therefore wrong half the time, which is very likely why this one was never
written down: it contradicts a rule that is already true elsewhere.

| Target | Correct probe | Why |
|---|---|---|
| Vite dev server | `localhost` | binds IPv6 only |
| uvicorn backend | **`127.0.0.1`** | binds IPv4 only |

## What the answer should look like

1. **Cheap and immediate:** every local script and probe targets **`127.0.0.1:8000`**, never
   `localhost:8000`. Costs nothing, needs no change to the app.
2. **Structural:** bind uvicorn **dual-stack** so the distinction stops existing. ⚠ Verify rather
   than assume — a dual-stack bind on Windows is not automatic, and the Windows port-reservation
   trap already documented in `CLAUDE.md` lives in this same neighbourhood.
3. ⛔ **Do NOT treat this as a performance nit.** The reason to fix it is that timing-sensitive
   defects are invisible to a harness carrying a 2 s handicap — and this repo has already lost one
   real bug to exactly that.

## Why it was an orphan

`BUS-040` was a session handover carrying ~15 findings. Three were addressed to the operator as
actions, four were flagged *"found and did not fix"*, and this one sat in a sentence inside a
paragraph about something else, marked *"worth fixing separately"*. **Nothing swept it for 14 days.**
That is the `BUS-171` third-arm case exactly: an item closed on age would have taken this with it.

## Reference

- `BUS-040` (2026-08-31) — the measurement and the `buffer_expired_while_streaming` story.
- memory `reference_vite_binds_ipv6_only` — the frontend half, pointing the other way.
- `CLAUDE.md` § the Windows port-reservation trap — adjacent networking territory on this box.
