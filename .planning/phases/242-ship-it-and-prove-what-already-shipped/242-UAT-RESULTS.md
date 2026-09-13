---
phase: 242-ship-it-and-prove-what-already-shipped
kind: uat-results
driven: 2026-09-11
driver: "claude (solo — OV-SOLO-01), Chrome DevTools MCP"
environment: "local dev — vite :5173 (IPv6 ::1 only), backend :8000, Supabase :54322; operator's own signed-in session"
rows_driven: [1, 2, 3, 4]
rows_owed: [5]
verdict: "4 of 5 PASS · row 5 (cloud) operator-owed"
---

# Phase 242 — UAT results, driven in a real browser

⚠ **First time a browser has been opened on this phase.** Everything before this was mechanical —
fences, gates, typechecks, a `pg_constraint` read. Those keep their value; **this is the other kind
of evidence**, and SC#1's words are *"an operator opens Settings → Search … and the save succeeds"*.

⛔ **Every row below is scored on the `PUT /settings` REQUEST PAYLOAD and HTTP status read out of
DevTools → Network, never on a banner.** `241-HUMAN-UAT.md` row 3 recorded this project making
exactly that mistake: *"a red banner is exactly what a PASSING refusal looks like"*.

**Starting state, measured:** `multimodal_max_vision_calls = 1000` · `vision_max_pages = 50` ·
`rrf_k = 60` · `hnsw_ef_search` NULL (UI renders 40 via the documented `??` fallback).

---

## Row 1 — one edit, one key ✅ **PASS**

Changed *RRF-K constant* `60 → 61`, clicked **Save Search Settings**.

```
PUT http://localhost:8000/settings          → 200
content-length: 12
Request Body:  {"rrf_k":61}
```

⭐ **Exactly one key.** Before this phase the same click sent all 24. And the stored
`multimodal_max_vision_calls = 1000` — sitting exactly on the bound — did not ride along.

**Persistence confirmed by a full page reload**, not by the banner: after `F5` and re-opening
Settings → Search, *RRF-K constant* reads **61**.

⛔ **The `{}` failure mode did NOT occur** — that was the outcome to fear (a save reporting success
while changing nothing), and the body was a real one-key payload.

---

## Row 2 — a value you never typed can no longer take the tab down ✅ **PASS — this is SHIP-01**

**Setup (LOCAL ONLY):** dropped `app_settings_multimodal_max_vision_calls_bound`, set
`multimodal_max_vision_calls = 1001`, waited out the **30 s settings cache** (`_SETTINGS_CACHE_TTL`),
reloaded. **The UI then showed `Images read per document = 1001` with `invalid="true"` on the
input — the operator's original bug state, reproduced.**

Changed *Search breadth* `40 → 50` only. Clicked Save.

```
PUT http://localhost:8000/settings          → 200
content-length: 21
Request Body:  {"hnsw_ef_search":50}
```

⭐⭐ **This is the save the operator could not perform.** Before this phase the identical action
returned **HTTP 400 — *"Images read per document must be between 1 and 1000"*** — on a field they
had not opened, about a value they never typed, while editing search breadth. The stored `1001` is
still `1001` in the database and is simply **not in the request**.

⭐ And it is the Phase 246 unblock, driven rather than argued: `hnsw_ef_search` is the knob
`RECALL-01`'s remedy is delivered on, and it saved while a poisoned sibling sat in the same row.

---

## Row 3 — the refusal names the cause ✅ **PASS (both arms)** · ⚠ **AND THE ROW AS WRITTEN WAS NOT DRIVABLE**

### ⚠⚠ A defect in this phase's own VALIDATION doc, found by driving it

Row 3 said: *"open the **Images read per document** field, **re-enter 1001 yourself**, and save."*
**That cannot produce the sentence, by construction.** After D-242-02 the payload is a diff against
the hydrated baseline — and re-entering `1001` over a stored `1001` compares **equal**, so the key
is dropped and nothing is sent. The row describes an interaction whose outcome it then asserts, and
the two cannot both be true.

⭐ **The code already said so and the row did not read it.** `_range_refusal_detail`'s docstring:
*"D-242-02 makes the untouched-field path unreachable FROM THE UI — it does not make it
unreachable… any other client can send the stored value back."* **That is the drive**, and it is the
honest one.

### Arm A — the stored-value sentence, driven as "another client" ✅

A real authenticated `PUT /settings` from the page's own session (same bearer token, same
`x-org-id`), carrying only the stored value:

```
PUT /settings   body: {"multimodal_max_vision_calls": 1001}
→ 400
{"detail":"'Images read per document' was already set to 1001, which is outside the allowed
  range of 1–1000. That is what is blocking this save — nothing you just changed is at fault.
  Set it to a value between 1 and 1000 to save this tab."}
```

Every required element present: the **stored number**, the **field's human label**, *"was already
set to"*, and *"nothing you just changed is at fault"*.

### Arm B — the negative control, through the real UI ✅

Typed **2000** into the field myself and saved. The banner read, **verbatim**:

> Images read per document must be between 1 and 1000. 0 would silently stop every image from being
> read.

⭐ **The old sentence, unchanged** — which is the RIGHT one here, because I did type it, and it
carries what the bound buys (SEED-227). **The new branch did not swallow the old one.**

---

## Row 4 — the schema refuses what the API refuses ✅ **PASS**

Driven against the live local database after re-running migration 178 to restore the constraint:

```
update … multimodal_max_vision_calls = 1001   → REFUSED
   CheckViolation: violates check constraint "app_settings_multimodal_max_vision_calls_bound"
update … vision_max_pages = 900               → REFUSED
   CheckViolation: violates check constraint "app_settings_vision_max_pages_bound"
update … multimodal_max_vision_calls = null   → SUCCEEDED   (NULL is legal, deliberately)
```

⭐⭐ **THE CLAMP FIRED ON REAL DATA, NOT A ROLLED-BACK PLANT, AND IT ANNOUNCED ITSELF.** Re-running
178 over the genuinely-poisoned row printed:

```
NOTICE: 178: CLAMPED 1 row(s) of multimodal_max_vision_calls into 1..1000 and 0 row(s) of
        vision_max_pages into 1..500. The stored value was outside the range the API enforces;
        it has been moved to the nearest bound, NOT reset to the column default.
```

`1001 → 1000`. That is the WR-08 NOTICE doing the job it was added for, on the exact scenario it
was written for. **Rejected alternative visible in the outcome:** reset-to-default would have
written `100`, silently making every ingestion read 10× fewer images.

---

## Row 5 — on the database production serves from ⛔ **OWED — operator**

Not driven. Requires the deployed product.
⭐ **Expected to pass on evidence already gathered, and that is said up front so a pass is not
mis-read as proof of a cure:** cloud holds `multimodal_max_vision_calls = 100` and
`vision_max_pages = 50`, both in range, so **the tab already saved in production before this
phase**. What Row 5 proves is that the NEW payload shape reached production — not that a bug was
cured there.

---

## State left behind — restored, and stated

| value | at start | during UAT | now |
|---|---|---|---|
| `multimodal_max_vision_calls` | 1000 | 1001 (planted), NULL (row 4) | **1000** |
| `vision_max_pages` | 50 | 900 refused | **50** |
| `rrf_k` | 60 | 61 (row 1) | **60** |
| `hnsw_ef_search` | NULL (UI shows 40) | 50 (row 2) | **NULL** |
| the two CHECK constraints | present | dropped for row 2's setup | **present** |

⚠ **`hnsw_ef_search` is restored to NULL rather than to a literal 40**, and the reason is recorded
rather than hidden: the UI read `40` at the start, which is what BOTH a stored `40` and a NULL
produce (`data.hnsw_ef_search ?? 40`). NULL is the "unset" state and is what cloud holds. **If the
operator had deliberately set a literal 40, this is a difference they cannot see and I could not
distinguish** — say so rather than claim a perfect restore.

⛔ **Nothing was run against cloud.** Every write above is `127.0.0.1:54322`.

---

## What this changes in the phase record

- **SC#1** — its local half is now driven and passing. Its production half (Row 5) stays owed.
- **SC#2** — both halves driven: the untouched field no longer rides, and the refusal names the
  stored value.
- **SC#3** — Row 4 drives the constraint against a live database, the half the unit fence cannot.
- ⚠ **`242-VALIDATION.md` Row 3 needs its wording corrected** — it asserts an outcome its own steps
  cannot produce. Corrected in that file beside the original, because the wording was plausible and
  the next person writing a UAT row against a diffed payload will make the same assumption.
