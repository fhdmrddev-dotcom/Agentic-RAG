---
seed_id: SEED-272
title: "A failed attachment copy is never given up on and never recovers — WR-03's cap does not fire"
created: 2026-09-12
planted_during: Phase 244, /gsd:verify-work round 2, driving 244-10-UAT-ROW.md Arm 4 (UAT gap G-7)
status: planted
surface: Agentic-RAG
severity: major
category: sandbox / attachments / resilience
priority: high
relates_to:
  - backend/app/services/tool_dispatcher.py          # :1838-1844 the two weak-keyed records + the cap; :2000-2035 the loop
  - backend/app/services/sandbox_service.py          # :16-17 module-level `_sessions`, PER PROCESS
  - backend/app/config.py                            # :1346 — this project's own record of the WORKER_COUNT=2 hazard class
  - backend/tests/unit/test_244_attachment_hydration.py   # cases F1/F2/F3 — every one runs on a MagicMock
  - .planning/phases/244-the-chat-shell-and-the-composer/244-UAT.md   # gap G-7, with the full driven readings
trigger_when: >
  The next phase whose `files_modified` names `backend/app/services/tool_dispatcher.py` or
  `backend/app/services/sandbox_service.py` — **or** any report that an attached file "never
  showed up" in a chat, whichever comes first. ⛔ Also fires immediately if anyone proposes
  RAISING `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS`: the cap is not being hit, so tuning it is a no-op
  that would look like a fix.
---

# The finding

`244-14` (review `WR-03`) rewrote attachment hydration so a failed copy is **named on every
attempt**, retried up to `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS = 2`, then **given up on once**. The
naming half works and is genuinely valuable — it is what stops the ten-wasted-round silence that
cost UAT `L-5`. **The cap's own contract does not hold, in either direction.**

Driven 2026-09-12 in a real browser against a real container, with the failure induced by the
method `244-10-UAT-ROW.md` itself sanctions (rename the `storage.objects` row aside; no code
edited):

| What WR-03 promises | What was measured |
|---|---|
| the note is GONE on the 3rd attempt — given up on, once | note **present on attempts 3, 4, 5 and 8** — five separate `execute_code` calls, never once absent |
| repair Storage after a blip and the file ARRIVES | object restored and **verified downloadable** (`GET /storage/v1/object/workspace-files/…` → HTTP 200, 1,077,795 bytes, service role). The very next call still reported `StorageApiError` and the file still did not appear |

⇒ *"a single blip costs the file for the session"* — the exact sentence `244-14` set out to
disprove — **is still true**.

# What was ruled OUT by measurement, so this is not guesswork

Two controls were driven, and they are the reason this seed can be specific:

- **The container persists across calls.** A marker file appended once per run accumulated to two
  lines (`1789229711.99`, `1789229820.63`). So this is not session churn.
- **The SUCCESS record works.** The container copy of an already-hydrated `.pdf` was overwritten
  in-container with the bytes `b'TAMPERED'`, and the NEXT `execute_code` still read `b'TAMPERED'` —
  i.e. `_hydrated_files` correctly suppressed a re-copy.

So the fault is specific to the **failed-path bookkeeping**, not to session lifetime and not to
`already` in general. That is a much smaller search area than "hydration is broken".

# Cause — a CANDIDATE, never a diagnosis

`_sessions`, `_hydrated_files` and `_hydration_failures` are module-level / weak-keyed **per
process**, while `WORKER_COUNT=2` is this project's default and `_find_existing_container` lets a
second worker **re-attach to the same container**. That would reproduce exactly what was measured:
one container, but per-worker counters each advancing at half rate. `config.py:1346` already
records this hazard class in another feature.

⛔ **It does not by itself explain the step-4 failure** (no recovery after repair), so it is a lead
to test, not a conclusion to build on.

⚠ **Limitation of the induction, stated so the next person does not re-learn it:** the outage was
made by renaming the `storage.objects` row, not by a network transient. A backend caching anything
keyed to that row would look identical from outside. **Rule that out first** — it is the cheapest
possible first move and it decides whether there is one bug here or two.

# What closing this needs

1. The failure counter must survive wherever the **session** does — across workers if the
   **container** does.
2. A recovery path: once Storage is healthy again the file must hydrate, rather than staying failed
   for the rest of a ~30-minute session.
3. ⛔ **A test driven against a REAL session across more than one `execute_code` call.** Cases
   F1/F2/F3 all run on a `MagicMock`, and a fake session cannot show this — which is precisely why
   a green suite shipped alongside it. This is the same lesson `G-6` cost the phase nineteen plans
   earlier: *a fence proves a component behaves when handed a shape, never that the product hands
   it that shape.*
