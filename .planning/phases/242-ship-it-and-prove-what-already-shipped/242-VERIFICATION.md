---
phase: 242-ship-it-and-prove-what-already-shipped
verified: 2026-09-11T09:40:00Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 / D-245-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: complete
status_note: "⭐ CLOSED under D-242-08 (operator). Was `human_needed`; the only remaining item — Row 5 on production — was measured UNRUNNABLE (242 is not deployed; 70 commits sit on develop) and is DEFERRED to the next promotion to production, with the parity walk folded into it. Rows 1-4 driven and pass."
score: "4.5 / 5 (CLOSED) — SC#2, SC#3, SC#5 verified mechanically AND driven; SC#4 measured against cloud (24/25, the one FAIL labelled expected); SC#1 driven 4/5 locally, its production row owed"
overrides_applied: 0
solo_run: true
independent_review: false
verified_at_commit: bed950f04
close_audited_at_commit: 5f683ff12
uat: "4 of 5 rows driven in a real browser — 242-UAT-RESULTS.md" 
base_commit: 7ac71638ecf25e234399eeba81ef996742d414bc
human_verification:
  - test: "SC#1 / VALIDATION Row 1 — Settings → Search, change exactly one field (RRF-K 60 → 61), save, read the PUT /settings REQUEST PAYLOAD in DevTools → Network"
    expected: "Payload contains exactly one key {\"rrf_k\": 61}; response 200; reload shows 61. A payload of {} is the silent-drop failure and is the WORST outcome."
    why_human: "The deliverable is which fields travelled over the wire from a real browser. Every fence shipped for it is synthetic (jsdom + mocked api)."
  - test: "SC#1 / VALIDATION Row 5 — the same drive ON THE DEPLOYED PRODUCT (cloud)"
    expected: "200, one key in the payload."
    why_human: "Names PRODUCTION. No automated path exists. ⭐ Expected to pass on evidence already gathered (cloud holds 100 / 50, both in range) — so a pass proves the NEW payload shape reached production, NOT that a bug was cured there."
  - test: "SC#2 / VALIDATION Rows 2 + 3 — with multimodal_max_vision_calls = 1001 stored ON LOCAL, (a) edit only Search breadth and save; (b) re-enter 1001 yourself and save; (c) the mirror — type 2000"
    expected: "(a) 200, payload carries only hnsw_ef_search. (b) banner reads 'was already set to 1001 … nothing you just changed is at fault'. (c) banner reads the OLD sentence — the new branch must not swallow the old one."
    why_human: "The refusal COPY is read by a person off a live banner; the backend helper is fenced but the wiring to the rendered banner is not."
  - test: "SC#4 — walk the NON-CODE deploy parity half per docs/DEPLOYMENT-WORKFLOW.md (env vars in Coolify/Vercel, seed rows in app_settings, provider keys, SANDBOX_IMAGE tag)"
    expected: "Each item confirmed present in cloud or recorded as deliberately absent."
    why_human: "Operator credentials to Coolify / Vercel dashboards. Explicitly named operator-owed in REQUIREMENTS.md and STATE.md — honestly deferred, but the criterion as written is not met."
  - test: "SC#4 — RE-DRIVE scripts/verify-v40-cloud-migrations.sql against cloud over the Supabase MCP (a read; no approval needed)"
    expected: "20/20 PASS."
    why_human: "This verifier agent has no Supabase MCP tool. The 20/20 verdict is currently a CLAIM in a commit message and REQUIREMENTS.md — the orchestrator, which has the MCP, closes this in one execute_sql call. ⚠ The ROADMAP's own failure list names 'verified by re-reading the record' as the failure mode."
  - test: "Operator-owed write — apply migration 178 to CLOUD (per-action approval)"
    expected: "app_settings_multimodal_max_vision_calls_bound and app_settings_vision_max_pages_bound exist in production."
    why_human: "A production write. Low urgency — cloud holds 100 / 50, both in range; the constraint is the backstop. Until it lands, SC#3's property does NOT hold on the database production serves from."
---

# Phase 242: Ship It — and Prove What Already Shipped · Verification Report

**Phase Goal:** An operator can change a search setting and save it on the database production actually serves from, a bound that was added in Python becomes a constraint the schema enforces, and every SHIP claim the register still carries as owed work is replaced by either a measurement or a written retirement.

**Verified:** 2026-09-11 · **at commit `bed950f04`** (4 docs commits past the `681b82680` named in the request; all four are 242's own and are covered below)
**Status:** `human_needed`
**Re-verification:** No — initial verification.

---

## ⛔ THIS IS A SOLO RUN AND THIS DOCUMENT IS NOT AN INDEPENDENT REVIEW

No independent reviewer exists on this repository. Gemini (Antigravity) has been unavailable since
2026-09-09, so the `AGENTS.md` rule *"whoever REVIEWS a phase must not have shaped the build"* cannot
be honoured. **This is a self-verification by the same agent lineage that built the phase**, and it
must be read as one. It re-measured rather than re-read wherever a tool existed — every figure below
was driven in this session, and the two places where no tool existed are named as such rather than
scored.

⚠ **Phase 245's `DEBT-03` asks 238 / 240 / 241 to say "self-verified" in their own records with
`OV-SOLO-01` written into STATE.md. 242 and 243 now belong on that list too** — flagged here so
Phase 245's scope is sized against five phases, not three.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator saves Settings → Search **against the cloud database**, whatever an untouched field holds — verified by the **network response**, never the banner (SHIP-01) | ⏸ **HUMAN-OWED** | `242-VALIDATION.md` = `status: owed`, `driven: 0 / 5`. **No browser was opened at any point in this phase.** The mechanism that delivers it is verified (truth 2); the drive is not. The phase does **not** claim it — `SHIP-01` is deliberately UNTICKED in `REQUIREMENTS.md` on exactly this standard |
| 2 | A field the operator did not edit can no longer take the tab down — the tab submits only what changed; and a refusal naming an untouched field says the value *was already set that way* (SHIP-01) | ✓ **VERIFIED** | Re-derived, not read off the SUMMARY. `searchPayloadFrom` and `handleSaveSearch.full` carry **identical 24-key sets in identical order** (machine-diffed: `in full not baseline: []`, `in baseline not full: []`). Every baseline expression matches `hydrate`'s setter expression — checked field by field, see §"The silent-drop hunt". `_range_refusal_detail` reaches **all four** numeric bound sites (`settings.py:512, 544, 578, 677`) and cannot turn a 400 into a 500 (the read is inside the `try`). 54/54 frontend cases green across the four SettingsPage suites; 12/12 on `test_242_stored_value_refusal.py` |
| 3 | `app_settings.multimodal_max_vision_calls` cannot hold an out-of-range value — CHECK exists, out-of-range rows clamped by the same migration, re-running is safe. **The general fix, not the specific one** (SHIP-01) | ✓ **VERIFIED** | **Driven against the live local database in this session**, not read: both constraints exist with the right definitions, `1001` and `900` are **REFUSED** (`CheckViolation`), `NULL` **SUCCEEDS**, row unchanged at `(1000, 50)` — all inside a rolled-back transaction. Migration 178 clamps **before** `ADD CONSTRAINT` (order correct), uses `DROP CONSTRAINT IF EXISTS` (re-runnable), permits NULL, and `grep -c 1001` is **0**. **The class fence is NOT vacuous** — allow-list is literally `set()`, and a planted new Python bound (`retrieval_top_k`, 1..200, no CHECK) drove **3 cases RED**; `settings.py` restored **md5-identical** (`9002570f…`). ⚠ Scope caveat below |
| 4 | `verify-v40-cloud-migrations.sql` run **against cloud**, verdict in the phase record, `153-156, 166..176` each present; missing ones applied via the SQL editor; **and the non-code parity half walked** (SHIP-03) | ⚠ **PARTIAL — operator-owed** | The **script repair is VERIFIED by reading it**: the `156` row now reads `pg_attribute.attacl` (the real ACL, readable by any catalog reader) plus a `has_column_privilege` corroboration; the `176` row's polarity is now **PRESENCE = 2**, permanently, with the reason in the file. 20 rows covering all 15 migrations. ⛔ **The "20/20 PASS against cloud" verdict could NOT be re-driven by this verifier** — this agent has no Supabase MCP tool. ⛔ **The non-code parity half is NOT walked** — named operator-owed in `REQUIREMENTS.md` and `STATE.md` |
| 5 | The milestone record shows, **with evidence beside it**, that the v4.0 push landed at `1f313670b` (2026-09-10) and that 241's row 5 ran on a local substitute with its cloud window permanently closed (`dbd63864b`) — both as **decisions with a written reason**; `SEED-242` closed or re-armed with a named trigger (SHIP-02, SHIP-04) | ✓ **VERIFIED** | All four evidence commits exist and say what is claimed — `1f313670b` *"Merge master into production — deploy v4.0"* 2026-09-10; `dbd63864b` *"row 5 driven on a local substitute; cloud window is gone"*; `f63a8ebcc` *"app.\<domain\>/ serves the app"*; `e65610ac2` = `origin/production`, and `1f313670b` **is an ancestor of it** (verified). `241-HUMAN-UAT.md` reads `status: complete`. `REQUIREMENTS.md` carries SHIP-02/03/04 with evidence **inline** plus a dedicated closure section — these read as **decisions, not ticks**. `SEED-242` is `status: planted`, **re-armed** with a narrowed dated trigger (*"the NEXT promotion to `production` after 2026-09-11"*), and has a home in `docs/OPERATOR.md:480` and `STATE.md:207` |

**Score: 3/5 verified mechanically · 2/5 operator-owed · 0 FAILED.**

---

### The silent-drop hunt (SC#2, asked for explicitly)

The dangerous direction is a baseline that disagrees with `hydrate`, because a real edit then looks
unchanged and is never sent. **Every one of the 24 keys was checked against `hydrate`'s setter, by
hand, at HEAD:**

| Shape | Keys | Baseline vs `hydrate` |
|---|---|---|
| bare `data.x` | `embedding_model`, `embedding_base_url`, `embedding_dimensions`, `rerank_enabled`, `rerank_provider`, `rerank_model`, `rerank_top_n`, `multimodal_max_vision_calls`, `retrieval_top_k`, `retrieval_match_threshold`, `hybrid_search_enabled`, `hybrid_candidate_count`, `vector_search_weight`, `keyword_search_weight`, `rrf_k` | identical |
| `?? fallback` | `vision_model ?? ""`, `vision_max_pages ?? 50`, `hnsw_ef_search ?? 40`, `hnsw_iterative_scan ?? "off"` | identical, fallback for fallback |
| `\|\| fallback` | `embedding_provider \|\| "openai"`, `extraction_provider \|\| "openai"`, `extraction_model \|\| exPreset?.model \|\| ""` | identical, `exPreset` computed the same way on both sides |
| API keys | `embedding_api_key`, `rerank_api_key` | baseline is `KEY_PLACEHOLDER`; `hydrate` sets `""` when no key is stored — **but `full` writes `embeddingApiKey \|\| KEY_PLACEHOLDER`, which collapses `""` back to `KEY_PLACEHOLDER`.** So the two agree in both arms, and a key the operator actually types differs and is sent. ✓ |

**No field found where the baseline can silently drop a real edit.** The `null`-baseline arm sends
the full payload (`searchBaseline ? onlyChanged(full, searchBaseline) : full`), and `onlyChanged`
iterates `Object.keys(next)` so a key missing from the baseline is **always sent** — the safe
failure direction, and the source comment says so correctly.

`Object.is` vs `===`: the shipped comment is right and the plan's original rationale was wrong — the
only behavioural difference is `+0`/`-0` (sending), not `NaN`. Verified by reading, and the SUMMARY
declares the correction rather than hiding it.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/178_app_settings_vision_calls_bound.sql` | clamp → constraint, NULL legal, re-runnable | ✓ VERIFIED | 143 L. Clamp at `:77-85` **precedes** `ADD CONSTRAINT` at `:88-102`; `DROP CONSTRAINT IF EXISTS` before each add; `IS NULL OR …` in both CHECKs; two `COMMENT ON COLUMN` carrying SEED-226/227. Bounds **agree with Python** (1..1000 / 1..500) |
| `backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py` | non-vacuous class fence, EMPTY allow-list | ✓ VERIFIED | 391 L, **17 cases, all green**. `BOUNDS_WITHOUT_SCHEMA_CONSTRAINT = set()` — **confirmed empty at line 61**. Two independent detectors (narrow AST idiom + shape-independent loose). **Driven RED by this verifier** on a planted bound |
| `backend/tests/unit/test_242_stored_value_refusal.py` | the refusal seam, incl. the 400→500 guard | ✓ VERIFIED | 202 L, **12 passed**. §4 monkeypatches a raising `load_app_settings_async`; §5 parameterises all four fields; a wiring case counts the four call sites |
| `backend/app/api/settings.py` | one helper, four sites | ✓ VERIFIED | `_range_refusal_detail` at `:370-409`; called at `:512, 544, 578, 677`. Every SEED comment block preserved (`SEED-226/227/258` all present). 37/20/933 — ledger row **re-derived by this verifier and exact** |
| `frontend/src/pages/SettingsPage.tsx` | changed-fields-only payload | ✓ VERIFIED | `searchPayloadFrom` `:595`, `onlyChanged` `:639`, `searchBaseline` `:813` set inside `hydrate` at `:895`, `handleSaveSearch` diff at `:1008`. 46/24/1858 — ledger row **re-derived and exact** |
| `frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx` | two fixtures, the §2b non-default drive | ✓ VERIFIED | 416 L, 17 cases. `FIXTURE A` (all-NULL) **and** `FIXTURE B` (every nullable column non-default); §2b drives the stored-200 → 40 edit |
| `scripts/apply_migration_178.py` | local-only, no env read | ✓ VERIFIED | DSN hard-coded `127.0.0.1:54322` at `:25`; no `os.environ` / `getenv`; `db push`/`db reset` appear **only as prohibitions** |
| `scripts/verify-v40-cloud-migrations.sql` | both false FAILs repaired | ✓ VERIFIED (as code) | 20 rows; `156` → `pg_attribute.attacl` + `has_column_privilege`; `176` → presence, `= 2`. **Cloud verdict not re-drivable here** |
| `supabase/full-schema.sql` | regenerated, no `--reset` | ✓ VERIFIED | Both new constraint names present (4 hits). Local DB still holds its **1 real settings row at `(1000, 50)`** — a `--reset` would have wiped it |
| `.planning/REQUIREMENTS.md` | SHIP-02/03/04 closed with evidence | ✓ VERIFIED | Rows at `:199-202` carry commits, measurements and the two false-alarm explanations inline; a dedicated closure section follows the traceability table |
| `.planning/seeds/SEED-242-*.md` | re-armed with a named trigger | ✓ VERIFIED | `trigger_when` narrowed and dated; `status: planted`; homed in `docs/OPERATOR.md` + `STATE.md` |
| `.planning/seeds/SEED-271-*.md` | what survived the measurement | ✓ VERIFIED | 91 L — `retrieval_top_k` / `rrf_k` **unvalidated**, not merely unconstrained. Mechanically triggerable: the fence reds the commit that adds a bound without a migration |
| `242-VALIDATION.md` | G-4 rows, honestly scored | ✓ EXISTS, ⏸ UNDRIVEN | `status: owed`, `driven: 0 / 5`, first line says so in bold. See W-6 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `handleSaveSearch` | `PUT /settings` | `onlyChanged(full, searchBaseline)` → `commitSearchSave` → `updateSettings` | ✓ WIRED | Both the direct path and the re-embed-confirm path (`pendingSearchSave` → `commitSearchSave`) carry the **diffed** body, not `full` |
| `hydrate` | `searchBaseline` | `setSearchBaseline(searchPayloadFrom(data))` at `:895` | ✓ WIRED | Runs on load **and** after every successful save, so the baseline re-arms and a second save of the same edit sends `{}` |
| four bound sites | `_range_refusal_detail` | `detail=await …` | ✓ WIRED | 4/4. ⚠ See W-4 |
| Python bound | schema CHECK | `test_242_…_schema_constraints.py` | ✓ WIRED + **DRIVEN RED** | A planted `1 <= body.retrieval_top_k <= 200` with no migration reds §1, §2 and §2b |
| migration 178 | local Postgres | `scripts/apply_migration_178.py` | ✓ WIRED | Constraints present and **enforcing** — re-driven in this session |
| migration 178 | **cloud** Postgres | — | ⛔ **NOT WIRED, BY DECISION** | Deliberate: a production write needs per-action operator approval. Named in ROADMAP, SUMMARY, STATE and here |

---

## Behavioural Spot-Checks (all run in this session, at `bed950f04`)

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Class fence is green | `pytest tests/unit/test_242_settings_bounds_have_schema_constraints.py -q` | `17 passed` | ✓ PASS |
| Class fence can FAIL on a new unconstrained bound | plant `1 <= body.retrieval_top_k <= 200` in `settings.py`, re-run | `3 failed, 14 passed` — §1, §2, §2b | ✓ PASS (not vacuous) |
| `settings.py` restored after the plant | `md5sum` | `9002570f176da8eee7bfd0fa4fa10662` — identical; `git diff --stat` empty | ✓ PASS |
| Refusal seam | `pytest tests/unit/test_242_stored_value_refusal.py -q` | `12 passed` | ✓ PASS |
| Frontend SettingsPage suites | `vitest run` × 4 files | `4 passed (4) · 54 passed (54)` | ✓ PASS |
| Payload key sets agree | AST-free literal diff of the two 24-key objects | both 24, sets and **order** identical | ✓ PASS |
| Schema refuses what the API refuses (**VALIDATION Row 4, driven here**) | `update app_settings set multimodal_max_vision_calls=1001 / vision_max_pages=900 / =null` in a rolled-back txn | first two `CheckViolation`; NULL succeeded; row still `(1000, 50)` | ✓ PASS |
| Backend unit ceiling | `pytest tests/unit -q --continue-on-collection-errors` | `71 failed, 4546 passed, 2 xfailed, 2 xpassed` — failing **SET** diffed against `242-backend-base-set.txt`: **NEW `[]`, GONE `[]`** | ✓ PASS (ceiling held, zero headroom) |
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | `total 8077 · failed 0 · pinned total 7307` · `count gate OK — 259/259` | ✓ PASS |
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | **67 errors** — identical to the `242-BASELINE.md` base count | ✓ PASS |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | `91,301 chars · 60.9%` · exit 0 | ✓ PASS |
| Hot-file ledger | `node scripts/check-hot-file-ledger.cjs 242` | `subject: 13 files · watched: 2` · exit 0 | ✓ PASS |
| Ledger triples | `git log … / wc -l` re-derived | `settings.py 37/20/933` · `SettingsPage.tsx 46/24/1858` — **exactly as the rows claim** | ✓ PASS |
| Deploy drift | `bash scripts/check-deploy-drift.sh` | exit 0 | ✓ PASS |
| G-7 | `node scripts/check-gap-closure-rounds.cjs 242` | `2 plans · 0 gap-closure` · **G-7 clear** | ✓ PASS |
| No destructive apply | `grep "db push\|db reset"` over 178 + apply script | 2 hits, both **prohibitions** | ✓ PASS |
| Cloud migration verdict | — | ⛔ **SKIP — no Supabase MCP tool in this verifier agent** | ? SKIP → human |

---

## The ROADMAP's "How we'd know this failed" — item by item

| # | Failure mode | Verdict |
|---|---|---|
| 1 | *The tab is declared fixed on the strength of the operator's local install, and production is still refusing every save* | ✓ **AVOIDED.** The phase does not declare it fixed: `SHIP-01` is deliberately **UNTICKED**, `242-VALIDATION.md` is `status: owed`, and Row 5 names production explicitly. Cloud's value (`100`, in range) was measured at scoping. ⚠ I could not re-measure it — see W-1 |
| 2 | *A green banner is read off the screen instead of the network response* | ✓ **AVOIDED, structurally.** Every row in `242-VALIDATION.md` sits under a standing rule to read the payload and the response body, with the `241-HUMAN-UAT.md` row-3 quotation, and a closing *"what a driven row must record"* clause. And nothing was read off a banner because **no browser was opened** |
| 3 | *The bound is fixed for `multimodal_max_vision_calls` only, and the next settings column reproduces the identical outage* | ✓ **AVOIDED, and demonstrably so.** 178 covers **two** columns; the fence's allow-list is **empty**; and I **drove the fence RED** on a planted new bound. This is the strongest-evidenced criterion in the phase |
| 4 | *`SHIP-02` is re-planned as a drive, burns a plan, and cannot close* | ✓ **AVOIDED.** Zero plans spent on it; retired in writing with `dbd63864b` beside it, and the *why-not-re-plannable* stated (the pre-176 cloud shape exists nowhere) |
| 5 | *The cloud migration set is "verified" by re-reading the deploy record rather than querying the database* | ⚠ **AVOIDED BY THE PHASE, NOT BY THIS VERIFIER.** The phase repaired the checker and reports driving it against cloud. **I am re-reading its record**, which is this failure mode one register up. The orchestrator holds the MCP; one read closes it |
| 6 | *Migration 177/178 is applied with `db push` or `db reset`, and the operator's data goes with it* | ✓ **AVOIDED.** Apply script is hard-coded to `127.0.0.1:54322`, reads no env var, and both phrases appear only as prohibitions. The local `app_settings` row survives intact at `(1000, 50)`, 1 row — a reset would have destroyed it |

---

## Requirements Coverage

| Requirement | Source | Status | Evidence |
|---|---|---|---|
| SHIP-01 | 242-01, 242-02 | ⏸ **Code-complete, UAT-owed** | Three arms verified mechanically (constraint + payload + sentence). Correctly **left unticked** — the requirement's words are *"an operator can save the tab"* and every fence is synthetic |
| SHIP-02 | fast (`681b82680`) | ✓ **RETIRED in writing** | `241-HUMAN-UAT.md` `status: complete`; `dbd63864b` verified to exist and say so; the pre-176 window confirmed closed |
| SHIP-03 | fast (`05203a1ed`, `681b82680`) | ⚠ **Substantially satisfied, one half owed** | Script repair verified in code; cloud verdict claimed 20/20 (not re-drivable here); **non-code parity half explicitly owed** |
| SHIP-04 | fast (`681b82680`) | ✓ **CONFIRMED** | `origin/production` = `e65610ac2`; `1f313670b` is an ancestor — verified by `git merge-base --is-ancestor` |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` across all 10 phase-touched source files | — | **NONE.** The only matches are the legitimate `KEY_PLACEHOLDER` identifier |

---

## Warnings (none is a BLOCKER; each is a decision the orchestrator should see)

**W-1 — ✅ CLOSED BY THE ORCHESTRATOR, and the verdict now lives HERE rather than in a commit
message.** The verifier agent had no Supabase MCP tool and correctly refused to score a claim it
could not re-drive — the ROADMAP's own failure list names *"verified by re-reading the record"* as
the failure mode. The read was then driven directly (reads are free, no approval needed), against
project `esnfauggawekgbvkqkyf`, **on the post-review version of the script, which now carries four
rows for migration 177 and one for 178**:

```
2026-09-11 · scripts/verify-v40-cloud-migrations.sql vs CLOUD  →  24 PASS · 1 FAIL

  153  PASS  table ingestion_jobs
  154  PASS  ×4  (source_connection_id · ingest_visibility · connection_doc_is_visible ·
                  match_document_chunks and keyword_search_chunks both REPLACED)
  155  PASS  connector_connections.default_ingest_visibility
  156  PASS  ×2  explicit column-level GRANT to authenticated  +  has_column_privilege
  166  PASS  app_settings.vision_model + vision_max_pages
  167  PASS  resize_embedding_column resizes skill_embeddings
  168  PASS  table connector_watches
  169  PASS  table connector_watch_items
  170  PASS  documents.source_state
  171  PASS  no-op placeholder
  172  PASS  table connector_sync_runs
  173  PASS  classification_rules.rule_scope
  174  PASS  app_settings.source_max_file_size_mb
  175  PASS  documents.thread_key
  176  PASS  hnsw_ef_search + hnsw_iterative_scan PRESENT
  177  PASS  ×4  app_settings RLS on · user_settings RLS on ·
                 anon can NEITHER read nor write app_settings ·
                 anon cannot execute resize_embedding_column
  178  *** FAIL ***  app_settings bound CHECKs present   ← EXPECTED. 178 is deliberately not
                                                            applied to cloud (operator-owed).
```

⛔ **The one FAIL is the row that is LABELLED as an expected fail**, and it is the only migration in
the set this phase authored. Every migration `153-156, 166..177` is present.

⭐ **The four `177` rows did not exist when the verifier ran.** They were added by the code review's
WR-09, which pointed out that a parity checker claiming *"every row PASS means parity"* had **no row
for the one migration that is a security fix** — the RLS/`anon` fix whose own header records that
every gate in this project stayed green while `app_settings` was world-writable. That is precisely
the blind spot 177 exists to close, in the one artifact that could close it. **SC#4's migration half
is now measured, not claimed.**

**W-2 — SC#4's non-code parity half is not walked.** Env vars, seed rows, provider keys and
`SANDBOX_IMAGE` are **named operator-owed** in `REQUIREMENTS.md` and `STATE.md`. That is **honest** —
named, not silently ticked, which is exactly the distinction SC#5 asks for. But the criterion's
words are *"is walked per `docs/DEPLOYMENT-WORKFLOW.md`"*, and naming is not walking. Scored as
owed, not as satisfied.

**W-3 — SC#3's property does NOT hold on the database production serves from.** Migration 178 is
local-only by decision (per-action approval for a production write). So *"`multimodal_max_vision_calls`
cannot hold a value outside the bound"* is true of local and **false of cloud** today. The phase says
so in four places and rates it low-urgency on a measured ground (cloud holds 100 and 50). Recorded
here so the sentence is never quoted without its scope.

**W-4 — `test_all_four_bound_sites_route_their_detail_through_it` pins the count at exactly 4, which
a FIFTH site can pass silently.** It asserts `source.count("_range_refusal_detail(") == 4`. A future
bound added **without** the helper leaves the count at 4 and the case green. (Adding one **with** the
helper reds it, forcing a deliberate edit — that half works.) The blast radius is the *sentence*
only: the schema fence catches the new column independently, via §1's equality. Worth one line in the
test's own retirement note.

**W-5 — `searchPayloadFrom` mirrors `hydrate` across two hand-maintained 24-key literals, and §1's
drift proof is only as wide as its fixtures.** The source comment claims the fences *"prove the two
have not drifted"*. True for today's 24 keys, because `FIXTURE B` gives each a distinctive
non-default value. A **25th** field added to `hydrate` + `full` + `searchPayloadFrom` but **not** to
the fixtures would sit outside the proof. Cheap mitigation: assert `Object.keys(searchPayloadFrom(FIXTURE_B))`
is a subset of the fixture's own keys.

**W-6 — `242-VALIDATION.md` Row 2's setup does not fence the operator away from PRODUCTION.** It
reads: *"run against an environment where 178 has NOT been applied, or temporarily `ALTER TABLE …
DROP CONSTRAINT …`, set `multimodal_max_vision_calls = 1001`"*. **Cloud is precisely an environment
where 178 has not been applied**, and the row never says local-only — Row 4 does. Planting `1001` in
production would be an un-approved production write that breaks the very tab the phase repaired.
**Add `LOCAL ONLY` to Rows 2 and 3 before handing the file to the operator.**

**W-7 — SC#4 says the verdict is written *into this phase's record*; it was written into
`REQUIREMENTS.md` and a commit message.** Neither `242-01-SUMMARY.md` nor `242-02-SUMMARY.md`
carries it, and no `242-*` artifact did before this file. Now carried here — noted because the
phase whose SC#5 is *"the register holds the measurement"* should not be loose about which register.

**Info — the enum bound site does not route through the helper, correctly.**
`hnsw_iterative_scan` (`settings.py:704`) is a membership check, not a numeric range; both the fence
and the refusal seam exclude it **by name, in writing**, so its absence reads as a decision. Its
CHECK exists (migration 176) — confirmed in `pg_constraint`.

**Info — `backend/app/api/settings.py` is CRLF throughout in the working tree** (933 CRLF / 933 LF).
Harmless here, but it is the same class of thing that made `check-hot-file-ledger.cjs` pass
vacuously over a CRLF plan — the defect this phase found and fixed unprompted.

---

## What the phase found that it was not asked to find (verified, and worth carrying)

1. **`242-CONTEXT.md`'s five-column deferral was measured FALSE** — 174 and 176 had already
   constrained three of the five. **Confirmed independently:** `pg_constraint` on local holds
   `app_settings_source_max_file_size_mb_bounds`, `app_settings_hnsw_ef_search_bounds` and
   `app_settings_hnsw_iterative_scan_values`. The CONTEXT's *"178 is the first"* is wrong; 174 was.
2. **`retrieval_top_k` and `rrf_k` are UNVALIDATED, not merely unconstrained** — `settings.py:598-611`
   is a bare `is not None` on both. Verified by reading. `SEED-271`, with a mechanically-detectable
   trigger.
3. **`SettingsPage.a11y.test.tsx` was red on all four cases and in NEITHER gate knob** — repaired and
   adopted. All four green in this session.
4. **`check-hot-file-ledger.cjs` exited 0 over 0 parsed files on a CRLF plan.** Repaired; the gate now
   reports `subject: 13 files · watched: 2` on this phase.
5. **Migration 177 IS applied to cloud**, correcting `242-CONTEXT.md` D-242-07 — recorded in the
   ROADMAP, both SUMMARYs, STATE and REQUIREMENTS. ⚠ Same caveat as W-1: not re-drivable here.

---

## Gaps Summary

**There are no blocking gaps and nothing claimed-but-false was found.** Every mechanical claim I
could re-drive came back matching the record — the backend failing SET is byte-identical to the
baseline, the count gate reads `259/259 · failed 0 · 8077`, the typecheck reads 67, both ledger
triples re-derive exactly, the migration behaves as documented against the live local database, and
the class fence is provably capable of failing.

What is **not done** is not hidden: SC#1 names production and needs an operator with a browser;
SC#4's parity half needs an operator with dashboard credentials; migration 178 needs an operator's
per-action approval to reach cloud. All three are named in the ROADMAP, both SUMMARYs, `STATE.md`
and `242-VALIDATION.md` before this verification existed — which is the behaviour SC#5 was written to
produce, showing up in the phase's own conduct rather than only in its register.

The one residual that belongs to *this document* rather than to the phase is **W-1**: the cloud
verdict is currently believed rather than measured at this level. It costs one free MCP read to fix,
and the ROADMAP's own failure list is the reason to spend it.

---

_Verified: 2026-09-11T09:40:00Z_
_Verifier: Claude (gsd-verifier) — **SOLO RUN. This is a self-verification, not an independent review.**_

---

# ⚠⚠ CLOSE AUDIT — 2026-09-11, at `5f683ff12`

**This section SUPERSEDES the rows above where they conflict. Nothing above is deleted**, because
two of the conflicts are the interesting part: this document was *correct when written* and
*stale eight commits later*, which is this project's own most-repeated finding arriving inside the
very artifact that exists to catch it.

## What changed after this report was written

| Row above says | Now measured |
|---|---|
| Truth 1: *"`242-VALIDATION.md` = `status: owed`, `driven: 0 / 5`. **No browser was opened at any point in this phase**"* | ⭐ **FALSE NOW.** A browser was opened the same day. **Rows 1-4 driven and PASS** (`242-UAT-RESULTS.md`), Chrome DevTools MCP, every row scored on the `PUT /settings` request payload. **Row 5 (production) remains owed** — so Truth 1 moves from *fully owed* to **its production half owed**. |
| W-1: *"the cloud 20/20 verdict is a claim this verifier could not re-drive"* | ✅ **CLOSED.** Driven over the MCP against project `esnfauggawekgbvkqkyf` on the **post-review** script: **24 PASS / 1 FAIL**, the single FAIL being migration 178's row, which is *labelled* an expected fail because 178 is deliberately not applied to cloud. The verdict is written into this file, which is the register SC#4 names. |
| `verified_at_commit: bed950f04` | Eight commits stale. Frontmatter corrected; `close_audited_at_commit: 5f683ff12`. |

⭐ **The verifier was RIGHT to refuse to score SC#4.** It had no MCP tool and the ROADMAP's own
failure list names *"verified by re-reading the deploy record"* as the failure mode. Refusing, and
naming the one call that would fix it, is the behaviour that produced the measurement.

## Success criteria at the close — the honest board

| SC | Verdict |
|---|---|
| **1** — operator saves Search against the database production serves from | ⏸ **PRODUCTION HALF OWED.** Local half **driven and PASS**: one edit → `{"rrf_k":61}`, 12 bytes, 200, persisted across a reload. ⭐ **Row 2 is the criterion's substance and it PASSES**: with `1001` stored and the input rendering `invalid`, changing only *Search breadth* sent `{"hnsw_ef_search":50}` → **200** — the save the operator could not previously perform. |
| **2** — an untouched field can no longer take the tab down; a refusal names the stored value | ✅ **VERIFIED AND DRIVEN.** Both arms in a browser: the stored-value sentence at 400, and the old sentence **unchanged** when the value is genuinely typed. |
| **3** — the bound becomes a constraint; the general fix, not the instance | ✅ **VERIFIED AND DRIVEN.** Both CHECKs refuse `1001` / `900`; `NULL` accepted. ⭐ **The clamp fired on REAL data** during the close (`CLAMPED 1 row(s) … moved to the nearest bound, NOT reset to the column default`) — not a rolled-back plant. ⛔ **Caveat unchanged: true of LOCAL only until 178 reaches cloud.** |
| **4** — the migration set verified against cloud; the non-code parity half walked | ◐ **HALF DONE, HONESTLY SPLIT.** Migration half **measured: 24/25**. **Parity walk still owed** — operator credentials to Coolify / Vercel. Naming is not walking. |
| **5** — SHIP-02/03/04 read as decisions with evidence; SEED-242 closed or re-armed | ✅ **VERIFIED.** Evidence inline in `REQUIREMENTS.md`; `SEED-242` **re-armed** with a narrowed trigger, not closed. |

**Score: 3 fully verified · 1 half · 1 production-half-owed. Zero failed. Zero blocking gaps.**

## Corrections this phase made to its own inputs — all measured, none inherited

1. ⛔ `242-CONTEXT.md` D-242-07: *"migration 177 … written and NOT applied"* — **FALSE. It is applied
   to cloud.** 7/7 on its own VERIFY block; the advisor's `rls_disabled_in_public` **ERROR is gone**.
   **`BUG-260911-01` is remediated in production.**
2. ⛔ `242-CONTEXT.md` `<deferred>`: a five-column CHECK sweep — **three already had constraints**
   (174/176). Real gap was two columns; 178 closed both; the fence's allow-list is **EMPTY**.
3. ⛔ `242-CONTEXT.md` `<code_context>`: *"178 is the first"* CHECK on a bounded settings column —
   **174 was first.**
4. ⛔ `242-CONTEXT.md` `<deferred>` claims `retrieval_top_k` / `rrf_k` *"carry Python-side bounds"* —
   **they carry no bound anywhere.** → `SEED-271`.
5. ⛔ The ROADMAP named this phase's migration **177** in three places. It is **178**.
6. ⛔ `242-BASELINE.md` claimed *"no sibling agent"* — **a peer session was active throughout.**
7. ⛔ `242-VALIDATION.md` Row 2 could be read as applying to **cloud** — it would have planted `1001`
   in production and broken the tab this phase repaired.
8. ⛔ `242-VALIDATION.md` Row 3's steps **could not produce their own expected result** — a diffed
   payload drops a value equal to its baseline.

## Guards found passing vacuously — the phase's most transferable finding

- **`check-hot-file-ledger.cjs`** exited **0** over a CRLF plan file it had parsed **nothing** of
  (`subject: 0 files · watched: 0`, `ledger gate OK`). Fixed; driven both ways.
- **`SettingsPage.a11y.test.tsx`** was **RED on all four cases and in neither gate knob** — proven
  inherited at the base commit. Cause was the suite's own missing `EffectiveFeaturesProvider`.
- **`test_..._route_their_detail_through_it`** asserted `count == 4` — silent on a fifth bound. Now
  derived from the `ast` detector; a planted fifth bound reds **4 cases**.
- **`§1 FIXTURE B`** held the `useState` initial for **nine of 24 keys**, so a hard-coded baseline
  for any of them was green. Widened; the planted constant now reds two cases.

## ⛔ Owed at the close — nothing hidden

| # | Owed | Who |
|---|---|---|
| 1 | **`242-VALIDATION.md` Row 5** — the save on the deployed product | operator |
| 2 | **Migration 178 → cloud** (per-action approval). Low urgency; cloud holds 100/50, both in range | operator |
| 3 | **The non-code deploy parity walk** | operator |
| 4 | **L-5 short arm is a 243 row, not a 242 row** — listed here only so it is not mistaken for 242 debt | — |

⭐ **Add `get_advisors(security)` to the deploy parity checklist.** Every gate in this project stayed
green over a production exposure because every gate reads through the service role and **nothing in
the suite ever makes a request as `anon`**. One free read found it.

_Close audit: Claude, solo. **Still not an independent review** — `OV-SOLO-01` applies to this
section exactly as to the report above it._

## Gates at the close audit — and the count gate went RED

| gate | verdict |
|---|---|
| backend unit | `71 failed, 4548 passed, 2 xfailed, 2 xpassed` — failing **SET** vs `242-backend-base-set.txt`: **`NEW []`, `GONE []`**. Ceiling held, zero headroom, byte-identical set. |
| **count gate** | ⚠ **`total 8077 · failed 7 · pinned total 7307`** — **RED**, where every earlier run today read `failed 0`. |
| typecheck | 67, set diff empty (unchanged). |
| `check-deploy-drift.sh` | **PASS**. |
| ledger / CLAUDE.md-size / G-7 | all exit 0. |
| `full-schema.sql` | both new constraints present (4 matches). |
| `db push` / `db reset` | 2 grep hits, both the **prohibition** in a comment; zero invocations. |
| SEED-271 / SEED-242 | both `status: planted` — 271 new, 242 **re-armed**. |

### ⚠ The red run, triaged by PROCEDURE rather than by re-running it

⛔ **The failing filenames were captured from the gate's own persisted JSON BEFORE anything was
re-run** — the rule `195-08` was written after breaking it. Seven failures across **three** files:

| file | cases | status |
|---|---|---|
| `pages/WorkflowBuilderPage.canvas.test.tsx` | 1 | ⭐ **SEED-171's fifth named cap-independent flaky suite** |
| `workflows/library/WorkflowCard.test.tsx` | 2 | ⭐ **SEED-171's named flaky set** |
| `library/__tests__/sketchComposition.test.tsx` | 4 | a composition fence, recorded as a standing red in `243-BASELINE.md` |

**All three are PROVABLY UNMODIFIED by this phase** — `git diff <base>..HEAD` over each returns
**zero lines**, and Phase 242's entire frontend diff is five SettingsPage files (`+649 / −7`). None
of the four SettingsPage suites failed, and there was no per-file decrease.

⚠ **Recorded as an OBSERVATION, not as an acquittal.** SEED-171's own finding is that these suites
go red and green on byte-identical trees and that **one green sample proves nothing** — the inverse
holds too: one red sample proves nothing either. What is provable is that this phase did not touch
them.

⚠ **A contributing condition, named because it was true and not because it is convenient:** a
**peer session was driving a browser on this repository throughout**, and CLAUDE.md states that at
two concurrent test-running agents `count gate OK` goes non-deterministic regardless of cap.
⛔ **That is NOT offered as the cause.** It is the condition under which the run happened.

⭐ **Why this does not block the close:** the gate's contract is *no per-file DECREASE* and *zero
failing*; the second half is unmet, by suites this phase provably did not touch, two of which are
already registered as cap-independent flaky. **The deterministic evidence — the per-file deltas, the
four in-scope suites, the backend SET diff, the typecheck set diff — is all green.** A re-run on a
quiet tree is the right next measurement and is listed as owed rather than performed here, because
re-running until green is exactly the habit SEED-171 exists to prevent.

---

# ⭐ D-242-08 — ROW 5 IS DEFERRED BY OPERATOR DECISION, AND THE PHASE CLOSES

**Operator, 2026-09-11:** *"defer and proceed — let's make the deployment on a milestone
achievement or at the end of the milestone."*

## The measurement that made this the right call, taken before the decision

⛔ **PHASE 242'S CODE IS NOT IN PRODUCTION.** `origin/production` is at `e65610ac2`; **70 commits
on `develop` are not in it**, including every line this phase wrote. So Row 5 —
*"change one field on the deployed product and read the payload"* — **was never runnable**. Driving
it would have measured the OLD build and reported ~24 keys: a false failure.

⚠ **This is recorded as a METHOD error of mine, not just a fact.** I twice handed the operator a
step-by-step for Row 5 without first checking whether the code under test was deployed. The row's
own expected result was unreachable. **Check that the build under test is the build deployed, before
asking anyone to measure it.**

## What is deferred, and what is NOT

| | |
|---|---|
| **Deferred** | Row 5 only — the drive of the changed-fields payload **on production**. |
| **NOT deferred** | Everything the row would have proven about the CODE. Rows 1-4 are driven and pass on a real browser; the mechanism is verified. |
| **Re-open trigger** | ⭐ **The next promotion to `production`** — planned for a v4.1 milestone achievement or the milestone close. **Row 5 is driven AS PART OF that deploy's verification**, not as leftover 242 work. |

⭐ **This is a decision with a written reason, not owed work quietly carried forward** — the same
standard SC#5 applied to SHIP-02, applied now to this phase's own last row. Promoting 70 commits to
production to close one row whose expected result is already known is the wrong trade; the deploy
should be its own deliberate step with its own verification.

⚠ **And the deploy will carry a real obligation:** migration **178 is ALREADY in cloud** while the
code that assumes it is not. That is safe today — the deployed build sends all 24 fields, every
cloud value is in range, so saves succeed — but it is a **schema-ahead-of-code** state and the
promotion must not assume otherwise.

## Cloud state at the close — measured, not claimed

| | |
|---|---|
| Migration 178 | ✅ **APPLIED** by the operator. Both CHECKs present with the exact definitions; `app_settings` still holds its single row at `(100, 50)` |
| Migrations `153-178` | ✅ **25/25 PASS** — the previous run's single FAIL was 178's own row, now resolved. The verifier's stale *"EXPECTED FAIL"* label corrected in the same commit |
| Security advisor | ✅ **No ERROR-level findings.** Same WARN set as before the apply — nothing regressed |
| `BUG-260911-01` | ✅ remediated in production (migration 177) |

## Final status

**Phase 242: CLOSED.** SC#2, SC#3, SC#5 verified and driven. SC#4's migration half measured
(25/25); its parity walk **folds into the deferred deploy**, where it belongs. SC#1 verified on
every reachable surface, its production row deferred under D-242-08.

⛔ **Still true and still said plainly:** this was a **solo run**. `OV-SOLO-01` applies. No
independent reviewer has read this phase.

⚠ **One measurement owed, and it is cheap:** a count-gate re-run on a quiet tree. The close run read
`failed 7` across three files this phase provably never touched (two are SEED-171's registered
flaky suites) while a peer session was driving a browser here. Not a blocker; not an acquittal either.
