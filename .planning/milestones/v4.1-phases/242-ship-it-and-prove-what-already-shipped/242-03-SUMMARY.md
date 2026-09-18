# 242-03 — SUMMARY (the review round)

**Executed 2026-09-11** · **Commits:** `f61c49046` (the fixes) · `bca6de5ae` (ledger).
⚠ **Not a gap-closure round.** `node scripts/check-gap-closure-rounds.cjs 242` reads
**`plans: 2 total · 0 gap-closure`** and exits 0 — G-7 does not fire. This is the standard
code-review pass (`.planning/config.json` → `code_review: true`), plus the verifier's findings.
No PLAN.md; the 243-06 precedent.

**Inputs:** `242-VERIFICATION.md` (gsd-verifier — 3/5 mechanical, 2/5 operator-owed, **0 failed**)
and `242-REVIEW.md` (gsd-code-reviewer — **0 critical, 10 warning, 9 info**).

---

## ⭐ The finding that mattered: a hole in the fence this phase is proudest of

**WR-01.** `242-02-SUMMARY.md` records planting a hard-coded `hnsw_ef_search: 40` baseline and
watching `§1 FIXTURE B` catch it. That was true — and it was **narrower than the file's own ⚠⚠ block
claimed**.

For a key to be caught by §1 FIXTURE B, its fixture value must differ from the corresponding
`useState` **initial**. **Nine of the 24 did not:**

| key | fixture held | `useState` initial |
|---|---|---|
| `embedding_base_url` | `""` | `""` |
| `rerank_enabled` | `false` | `false` |
| `rerank_provider` | `"api"` | `"api"` |
| `rerank_model` | `""` | `""` |
| `rerank_top_n` | `5` | `5` |
| **`retrieval_match_threshold`** | **`0.3`** | **`0.3`** |
| `hybrid_search_enabled` | `true` | `true` |
| `vector_search_weight` | `1` | `1` |
| `keyword_search_weight` | `1` | `1` |

⛔ **So writing `retrieval_match_threshold: 0.3` as a constant — the exact mistake the file's own
warning block describes for `hnsw_ef_search` — was GREEN against every case in the suite.** And
`0.3` is the value an operator is most likely to drag the threshold *back* to, which is precisely
when a silent drop bites.

**Fixed and driven:** FIXTURE B now differs from the `useState` initial on **all 24 keys**, each
annotated with the initial it is escaping. Planting `retrieval_match_threshold: 0.3` now reds
**§1 FIXTURE B** and **§2b**; it was green before.

⭐ **The general lesson, written into the module's ledger section so it outlives this phase:** *the
fence proves non-drift only as wide as its fixture.* A 25th key added to `hydrate`, `full` and
`searchPayloadFrom` but not to FIXTURE B is **unproven, however green the suite looks.**

---

## The rest, each with what it changed

| # | Finding | What shipped |
|---|---|---|
| **WR-03** | Exporting non-components from `SettingsPage.tsx` trips `react-refresh/only-export-components` — **Fast Refresh broken on a 1,773-line form page**. Two lint errors where the base file had zero, and `npm run lint` is **not gated in CI** (only `lint:a11y` is), so nothing would have caught it. | Both helpers moved to `frontend/src/pages/settingsSearchPayload.ts`. `npx eslint` on both files is now **clean**. |
| **WR-10** | `§7` re-implemented `baseline ? onlyChanged(…) : full` instead of calling it — it would have stayed green if the component's fallback were changed to `{}`. | `searchBodyFor(full, baseline)` extracted; the component and the test now call the **same** function. |
| **WR-09** | The cloud verifier claimed *"every row PASS"* means parity while having **no row for migration 177** — the RLS/`anon` fix whose own header records that every gate stayed green while `app_settings` was world-writable. **The blind spot 177 exists to close, in the one artifact that could close it.** | Four `177` rows (RLS on ×2, `anon` cannot read/write, `anon` cannot execute `resize_embedding_column`) plus a labelled `178` row. Driven against cloud: **24 PASS / 1 FAIL**, the FAIL being 178, deliberately unapplied there. Verdict written into `242-VERIFICATION.md`. |
| **WR-04** | `getattr(await load_app_settings_async(), field, None)` over an object carrying **ten provider API keys and the Supabase management token**, with the result going straight into an HTTP 400 body. `field` is a literal at all four sites *today*. | `_BOUNDED_SETTINGS_FIELDS` allow-list; an unknown name logs and falls back. Two new cases: a secrets-bearing stub proves the key never reaches the detail, and a second asserts the allow-list covers every bound the `ast` detector finds. |
| **W-4 (verifier)** | `test_all_four_bound_sites_route_their_detail_through_it` asserted `count == 4` — **a fifth bound added without the helper keeps the count at 4 and passes silently.** | Expected count is now **derived from the `ast` detector**. Driven: planting a fifth bound reds **4 cases** across both fences; under `== 4` it reded none of them. |
| **WR-05** | The `except Exception` fallback was silent. A settings read failing here means it is failing elsewhere. | Logged with `exc_info=True`; behaviour unchanged. |
| **WR-08** | The clamp **announces nothing** on the SQL-editor paste path — a bug whose whole nature is *a value that changed without saying so*, repaired by another silent value change. | A `DO $$ … RAISE NOTICE $$` reports how many rows it clamped, or prints *"nothing to repair"*. The apply script echoes it. |
| **WR-07** | The NULL-arm plant's safety depended on `.replace("COMMIT;", "")` matching a **literal in another file**. Safe today, one rename from committing a destructive plant. | A word-boundary regex **plus an assertion** — if either statement survives the strip, the plant does not run at all. |
| **W-6 (verifier)** | ⛔ **A safety defect in `242-VALIDATION.md`, which I wrote.** Row 2's setup said *"run against an environment where 178 has NOT been applied, **or** temporarily DROP CONSTRAINT…"* and named no environment. **Cloud is exactly such an environment.** As written it told a reader to plant `1001` in **production** — an un-approved write that would then **break the very tab this phase repaired** for every real user. | Rows 2 and 3 now carry `⛔⛔ LOCAL ONLY. NEVER CLOUD.` in their own headers, with the original wording described rather than quietly replaced, and the rule stated: **a UAT row that mutates data must name its environment in its own header.** |

**Not taken, with reasons:** the verifier's W-3 (SC#3 is true of local and false of cloud until 178
is applied) is already named as operator-owed in three registers — it is a fact about the deploy
state, not a defect. W-5 (fixture-width) is the same finding as WR-01 and is fixed by it; the
residual — *a 25th key must also reach FIXTURE B* — is now written into the module's ledger section
rather than left as an observation.

---

## Gates, re-run after every change above

| gate | result |
|---|---|
| backend unit | `71 failed, 4548 passed, 2 xfailed, 2 xpassed` — failing **SET** vs `242-backend-base-set.txt`: `NEW: []`, `GONE: []`. ⛔ Ceiling held. |
| count gate | `total 8077 · failed 0 · pinned total 7307` · `count gate OK — 259/259`, no per-file decrease. **Unchanged from 242-02** — the review moved code between files and added backend cases; no frontend case count moved. |
| typecheck | `tsc -p tsconfig.app.json --noEmit` → **67**, set diff vs base **empty both ways**. |
| **eslint** | `npx eslint src/pages/SettingsPage.tsx src/pages/settingsSearchPayload.ts` → **clean**. This is the gate WR-03 exists for and it is **not in CI** — run it by hand when touching this page. |
| vite build | ✅ `built in 14.70s`. |
| ledger | exit 0 at `253 rows · subject: 14 files · watched: 3`. |
| `check-claude-md-size.cjs` | exit 0. |
| `check-gap-closure-rounds.cjs 242` | exit 0 — `2 plans · 0 gap-closure`. |

**Ledger, re-derived after these commits:** `settings.py` **38 / 20 / 972**, `SettingsPage.tsx`
**47 / 24 / 1773** (⭐ it **SHRANK** — the helpers moved out), and
`settingsSearchPayload.ts` **1 / 1 / 116** — whose row and section were added **at creation**, not
at its third phase, because an absent row makes G-5 absent forever at any count.

⚠ It was also missing from `242-02-PLAN.md`'s `files_modified`, which is what
`check-hot-file-ledger.cjs` reads — **the same blindness `243-04` hit from the other direction**, and
the gate passed anyway until the row was demanded. Added.

---

## What is still owed, unchanged by this round

- ⛔ **`242-VALIDATION.md`: 0 of 5 rows driven.** Row 1 first; read the network payload, not the banner.
- ⛔ Migration **178 → cloud** (operator; low urgency — cloud's values are in range).
- ⛔ The **non-code deploy parity walk**. Named in three registers; naming is not walking.
- `FieldRow`'s missing label association — a real accessibility gap on this tab, unfixed, named.
